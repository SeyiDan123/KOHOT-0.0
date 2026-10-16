import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function workerApiPlugin() {
  return {
    name: 'worker-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/')) {
          try {
            const workerModule = await server.ssrLoadModule('./worker/index.ts');
            const worker = workerModule.default;
            const fullUrl = `http://${req.headers.host || 'localhost:3000'}${req.url}`;
            
            const chunks: any[] = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : null;
            const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && bodyBuffer && bodyBuffer.length > 0;

            const webReq = new Request(fullUrl, {
              method: req.method,
              headers: req.headers,
              body: hasBody ? bodyBuffer : undefined,
            });

            const webRes = await worker.fetch(webReq, {
              GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '688826683374-i08rgemf0ghvdabmelefmplju2q0rauh.apps.googleusercontent.com',
              SESSION_SECRET: process.env.SESSION_SECRET || 'dev-session-secret-kohot-2025',
              HOST_EMAIL: process.env.HOST_EMAIL || 'seyidan03@gmail.com',
              PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
              RESEND_API_KEY: process.env.RESEND_API_KEY || '',
            });

            res.statusCode = webRes.status;
            webRes.headers.forEach((val: string, key: string) => {
              res.setHeader(key, val);
            });
            const resBuffer = await webRes.arrayBuffer();
            res.end(Buffer.from(resBuffer));
            return;
          } catch (err: any) {
            console.error('Worker API dispatch error:', err);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), workerApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env.APP_URL': JSON.stringify(process.env.APP_URL || ''),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
