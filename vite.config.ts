import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import fs from 'fs';
import os from 'os';

function createDevStorage() {
  const storageDir = path.resolve(os.tmpdir(), 'kohot_dev_storage');
  const mediaDir = path.resolve(storageDir, 'media');
  const dbFile = path.resolve(storageDir, 'db.json');

  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  const loadDb = () => {
    try {
      if (fs.existsSync(dbFile)) {
        return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
      }
    } catch {}
    return { site_settings: {} };
  };

  const saveDb = (data: any) => {
    try {
      fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving dev DB:', err);
    }
  };

  const devMedia = {
    async put(key: string, data: any, options?: any) {
      const filePath = path.join(mediaDir, key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      let buf: Buffer;
      if (Buffer.isBuffer(data)) {
        buf = data;
      } else if (data instanceof ArrayBuffer) {
        buf = Buffer.from(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
      }
      fs.writeFileSync(filePath, buf);
      const metaPath = path.join(mediaDir, `${key}.meta.json`);
      fs.writeFileSync(metaPath, JSON.stringify(options || {}, null, 2));
      return { key, size: buf.length, httpEtag: `"${Date.now()}-${buf.length}"` };
    },

    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        if (!k) continue;
        const filePath = path.join(mediaDir, k);
        const metaPath = path.join(mediaDir, `${k}.meta.json`);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        } catch {}
      }
    },

    async get(key: string, options?: any) {
      let filePath = path.join(mediaDir, key);
      if (!fs.existsSync(filePath)) {
        const pubPath = path.resolve(__dirname, 'public', key);
        if (fs.existsSync(pubPath)) {
          filePath = pubPath;
        } else {
          return null;
        }
      }
      const stat = fs.statSync(filePath);
      const metaPath = path.join(mediaDir, `${key}.meta.json`);
      let meta: any = null;
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch {}
      }

      let fileBuffer = fs.readFileSync(filePath);
      const totalSize = stat.size;
      let rangeResult: { offset: number; length: number } | undefined = undefined;

      if (options?.range && typeof options.range === 'object' && typeof options.range.offset === 'number') {
        const clampedStart = Math.max(0, Math.min(options.range.offset, totalSize - 1));
        const requestedLen = typeof options.range.length === 'number' ? options.range.length : totalSize - clampedStart;
        const clampedEnd = Math.min(clampedStart + requestedLen - 1, totalSize - 1);
        fileBuffer = fileBuffer.subarray(clampedStart, clampedEnd + 1);
        rangeResult = {
          offset: clampedStart,
          length: fileBuffer.length,
        };
      } else {
        const rangeHeader = options?.range
          ? typeof options.range === 'string'
            ? options.range
            : options.range?.get?.('range') || options.range?.range
          : undefined;

        if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
          const match = rangeHeader.replace('bytes=', '').split('-');
          const start = parseInt(match[0], 10) || 0;
          const end = match[1] ? parseInt(match[1], 10) : totalSize - 1;
          const clampedEnd = Math.min(end, totalSize - 1);
          const clampedStart = Math.min(start, clampedEnd);
          fileBuffer = fileBuffer.subarray(clampedStart, clampedEnd + 1);
          rangeResult = {
            offset: clampedStart,
            length: fileBuffer.length,
          };
        }
      }

      const ext = key.split('.').pop()?.toLowerCase();
      const contentType =
        meta?.httpMetadata?.contentType ||
        (ext === 'webm'
          ? 'video/webm'
          : ext === 'mp4'
          ? 'video/mp4'
          : ext === 'mp3'
          ? 'audio/mpeg'
          : ext === 'wav'
          ? 'audio/wav'
          : ext === 'ogg'
          ? 'audio/ogg'
          : ext === 'm4a'
          ? 'audio/mp4'
          : ext === 'aac'
          ? 'audio/aac'
          : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg');

      return {
        size: totalSize,
        body: new Response(fileBuffer).body,
        range: rangeResult,
        httpMetadata: { contentType },
        httpEtag: `"${stat.mtimeMs}-${stat.size}"`,
      };
    },

    async head(key: string) {
      const filePath = path.join(mediaDir, key);
      if (!fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      const metaPath = path.join(mediaDir, `${key}.meta.json`);
      let meta: any = null;
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch {}
      }
      return {
        key,
        size: stat.size,
        uploaded: new Date(stat.mtimeMs),
        httpMetadata: meta?.httpMetadata || {},
        httpEtag: `"${stat.mtimeMs}-${stat.size}"`,
      };
    },

    async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
      const objects: Array<{ key: string; size: number; uploaded: Date; httpMetadata?: any }> = [];
      const walk = (dir: string, relPrefix = '') => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const relKey = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath, relKey);
          } else if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
            if (!options?.prefix || relKey.startsWith(options.prefix)) {
              const stat = fs.statSync(fullPath);
              let meta: any = null;
              const metaPath = `${fullPath}.meta.json`;
              if (fs.existsSync(metaPath)) {
                try {
                  meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                } catch {}
              }
              objects.push({
                key: relKey,
                size: stat.size,
                uploaded: new Date(stat.mtimeMs),
                httpMetadata: meta?.httpMetadata || {},
              });
            }
          }
        }
      };
      walk(mediaDir);
      objects.sort((a, b) => a.key.localeCompare(b.key));
      const limit = options?.limit || 1000;
      const startIdx = options?.cursor ? parseInt(options.cursor, 10) || 0 : 0;
      const slice = objects.slice(startIdx, startIdx + limit);
      const nextIdx = startIdx + limit;
      const truncated = nextIdx < objects.length;
      return {
        objects: slice,
        truncated,
        cursor: truncated ? String(nextIdx) : undefined,
      };
    },
  };

  const ensureTables = (dbData: any) => {
    const tables = [
      'users',
      'institutions',
      'registrations',
      'transactions',
      'class_sets',
      'support_messages',
      'reminder_logs',
      'unsubscribed_students',
      'email_logs',
      'media_assets',
      'website_content_overrides',
      'testimonials',
      'audit_logs',
      'department_addition_requests',
      'next_class_invites',
      'album_disputes',
      'platform_settings',
      'profile_submissions',
      'slot_ledger',
      'slot_purchases',
      'slot_allocations',
      'programmes',
      'cohort_allocations',
    ];
    for (const t of tables) {
      if (!Array.isArray(dbData[t])) {
        dbData[t] = [];
      }
    }
    const defaults: Record<string, string> = {
      student_fee_kobo: '100000',
      min_funded_to_publish: '10',
      profile_cap_default: '200',
      reinstate_days: '7',
      draft_retention_days: '30',
      gate_mode: 'publish',
      default_kohot_slots_per_album: '0',
    };
    for (const [k, v] of Object.entries(defaults)) {
      if (!dbData.platform_settings.some((r: any) => r.key === k)) {
        dbData.platform_settings.push({ key: k, value: v });
      }
    }
    return dbData;
  };

  const executeQuery = (query: string, boundArgs: any[], mode: 'first' | 'all' | 'run') => {
    const dbData = ensureTables(loadDb());
    const q = query.replace(/\s+/g, ' ').trim();
    const qUpper = q.toUpperCase();

    if (q.includes('sqlite_master')) {
      const row = { cnt: 18 };
      return mode === 'first' ? row : mode === 'all' ? { results: [row] } : { success: true };
    }

    if (q.includes('site_settings')) {
      if (qUpper.startsWith('SELECT')) {
        if (dbData.site_settings && dbData.site_settings.global_settings) {
          const row = {
            id: 'global_settings',
            data_json: dbData.site_settings.global_settings,
            updated_at: dbData.site_settings.updated_at || new Date().toISOString(),
          };
          return mode === 'first' ? row : { results: [row] };
        }
        return mode === 'first' ? null : { results: [] };
      } else {
        const dataJson = boundArgs[0];
        dbData.site_settings = {
          global_settings: typeof dataJson === 'string' ? dataJson : JSON.stringify(dataJson),
          updated_at: new Date().toISOString(),
        };
        saveDb(dbData);
        return { success: true };
      }
    }

    // Helper to match table name
    const matchTable = (sql: string): string | null => {
      const m =
        sql.match(/FROM\s+([a-zA-Z0-9_]+)/i) ||
        sql.match(/INTO\s+([a-zA-Z0-9_]+)/i) ||
        sql.match(/UPDATE\s+([a-zA-Z0-9_]+)/i) ||
        sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
      return m ? m[1] : null;
    };

    const table = matchTable(q);
    if (!table || !Array.isArray(dbData[table])) {
      return mode === 'first' ? null : mode === 'all' ? { results: [] } : { success: true };
    }

    const rows: any[] = dbData[table];

    // Special aggregate queries for slot_ledger
    if (table === 'slot_ledger' && qUpper.startsWith('SELECT') && qUpper.includes('SUM(')) {
      const albumId = boundArgs[0];
      const matching = rows.filter((r) => String(r.album_id) === String(albumId));
      const balance = matching.reduce((acc, r) => acc + (Number(r.delta) || 0), 0);
      const totalCredited = matching.reduce((acc, r) => acc + (Number(r.delta) > 0 ? Number(r.delta) : 0), 0);
      const totalUsed = matching.reduce((acc, r) => acc + (Number(r.delta) < 0 ? Math.abs(Number(r.delta)) : 0), 0);
      const resRow = { balance, total_credited: totalCredited, total_used: totalUsed };
      return mode === 'first' ? resRow : { results: [resRow] };
    }

    if (qUpper.startsWith('SELECT') && qUpper.includes('COUNT(*)')) {
      let filtered = [...rows];
      if (q.includes('WHERE album_id = ?') && boundArgs.length >= 1) {
        filtered = filtered.filter((r) => String(r.album_id) === String(boundArgs[0]));
        if (q.includes("status != 'declined'")) {
          filtered = filtered.filter((r) => r.status !== 'declined' && r.status !== 'removed');
        }
      } else if (q.includes('WHERE set_id = ?') && boundArgs.length >= 1) {
        const cutoffMs = Date.now() - 15 * 60 * 1000;
        filtered = filtered.filter((r) => {
          if (String(r.set_id) !== String(boundArgs[0])) return false;
          if (boundArgs.length >= 2 && String(r.uploader_email) !== String(boundArgs[1])) return false;
          const createdMs = r.created_at ? new Date(r.created_at).getTime() : 0;
          return createdMs >= cutoffMs;
        });
      }
      const resRow = { cnt: filtered.length, count: filtered.length };
      return mode === 'first' ? resRow : { results: [resRow] };
    }

    if (qUpper.startsWith('SELECT')) {
      let filtered = [...rows];
      const whereMatch = q.split(/WHERE/i)[1]?.split(/ORDER BY|LIMIT/i)[0];
      if (whereMatch) {
        let argIdx = 0;
        const conds = whereMatch.split(/\s+AND\s+/i);
        for (const cond of conds) {
          const c = cond.trim();
          const eqParam = c.match(/^LOWER\(([a-zA-Z0-9_]+)\)\s*=\s*LOWER\(\?\)$/i);
          const simpleEq = c.match(/^([a-zA-Z0-9_]+)\s*=\s*\?$/i);
          const simpleLiteral = c.match(/^([a-zA-Z0-9_]+)\s*=\s*'([^']*)'$/i);
          const simpleNumLiteral = c.match(/^([a-zA-Z0-9_]+)\s*=\s*([0-9]+)$/i);
          const notEqLiteral = c.match(/^([a-zA-Z0-9_]+)\s*!=\s*'([^']*)'$/i);
          if (eqParam) {
            const col = eqParam[1];
            const val = String(boundArgs[argIdx++] ?? '').toLowerCase();
            filtered = filtered.filter((r) => String(r[col] ?? '').toLowerCase() === val);
          } else if (simpleEq) {
            const col = simpleEq[1];
            const val = boundArgs[argIdx++];
            filtered = filtered.filter((r) => String(r[col] ?? '') === String(val ?? ''));
          } else if (simpleLiteral) {
            const col = simpleLiteral[1];
            const val = simpleLiteral[2];
            filtered = filtered.filter((r) => String(r[col] ?? '') === val);
          } else if (simpleNumLiteral) {
            const col = simpleNumLiteral[1];
            const val = Number(simpleNumLiteral[2]);
            filtered = filtered.filter((r) => Number(r[col]) === val);
          } else if (notEqLiteral) {
            const col = notEqLiteral[1];
            const val = notEqLiteral[2];
            filtered = filtered.filter((r) => String(r[col] ?? '') !== val);
          } else if (c.includes('?')) {
            argIdx++;
          }
        }
      }
      if (qUpper.includes('ORDER BY CREATED_AT DESC') || qUpper.includes('ORDER BY SENT_AT DESC') || qUpper.includes('ORDER BY UPDATED_AT DESC')) {
        filtered.sort((a, b) => String(b.created_at || b.updated_at || b.sent_at || '').localeCompare(String(a.created_at || a.updated_at || a.sent_at || '')));
      } else if (qUpper.includes('ORDER BY DISPLAY_ORDER ASC')) {
        filtered.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));
      }
      return mode === 'first' ? (filtered[0] || null) : { results: filtered };
    }

    if (qUpper.startsWith('INSERT')) {
      const isIgnore = qUpper.includes('OR IGNORE');
      const isReplace = qUpper.includes('OR REPLACE');
      const colsMatch = q.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map((s) => s.trim());
        const valsRaw = colsMatch[2].split(',').map((s) => s.trim());
        const newRow: Record<string, any> = {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        let argIdx = 0;
        cols.forEach((col, i) => {
          const vExpr = valsRaw[i] || '';
          if (vExpr === '?') {
            newRow[col] = boundArgs[argIdx++];
          } else if (vExpr.toLowerCase().includes('datetime')) {
            newRow[col] = new Date().toISOString();
          } else if (vExpr.startsWith("'") && vExpr.endsWith("'")) {
            newRow[col] = vExpr.slice(1, -1);
          } else if (vExpr.toUpperCase() === 'NULL') {
            newRow[col] = null;
          } else if (!isNaN(Number(vExpr))) {
            newRow[col] = Number(vExpr);
          } else {
            newRow[col] = boundArgs[argIdx++];
          }
        });

        const pkCol = table === 'platform_settings' ? 'key' : 'id';
        // Check idempotency_key uniqueness on slot_ledger
        if (table === 'slot_ledger' && newRow.idempotency_key) {
          const dupIdem = rows.findIndex((r) => r.idempotency_key === newRow.idempotency_key);
          if (dupIdem !== -1) {
            if (isIgnore) return { success: true };
            throw new Error('UNIQUE constraint failed: slot_ledger.idempotency_key');
          }
        }
        // Check UNIQUE(institution_id, department_id, graduation_year) on cohort_allocations
        if (table === 'cohort_allocations') {
          const dupCohort = rows.findIndex(
            (r) =>
              String(r.institution_id).toLowerCase() === String(newRow.institution_id).toLowerCase() &&
              String(r.department_id).toLowerCase() === String(newRow.department_id).toLowerCase() &&
              Number(r.graduation_year) === Number(newRow.graduation_year)
          );
          if (dupCohort !== -1) {
            if (isIgnore) return { success: true };
            if (isReplace || qUpper.includes('ON CONFLICT')) {
              rows[dupCohort] = { ...rows[dupCohort], ...newRow, updated_at: new Date().toISOString() };
              saveDb(dbData);
              return { success: true };
            }
          }
        }
        const existingIdx = rows.findIndex((r) => newRow[pkCol] !== undefined && String(r[pkCol]) === String(newRow[pkCol]));
        if (existingIdx !== -1) {
          if (isIgnore) return { success: true };
          if (isReplace || qUpper.includes('ON CONFLICT')) {
            rows[existingIdx] = { ...rows[existingIdx], ...newRow, updated_at: new Date().toISOString() };
          } else {
            rows[existingIdx] = { ...rows[existingIdx], ...newRow };
          }
        } else {
          rows.push(newRow);
        }
        saveDb(dbData);
      }
      return { success: true };
    }

    if (qUpper.startsWith('UPDATE')) {
      const setPart = q.split(/SET/i)[1]?.split(/WHERE/i)[0] || '';
      const wherePart = q.split(/WHERE/i)[1] || '';
      const setAssignments = setPart.split(',').map((s) => s.trim());
      let argIdx = 0;
      const updates: Record<string, any> = {};
      for (const assign of setAssignments) {
        const [colRaw, valExpr] = assign.split('=').map((s) => s.trim());
        if (!colRaw) continue;
        if (valExpr === '?') {
          updates[colRaw] = boundArgs[argIdx++];
        } else if (valExpr?.toLowerCase().includes('datetime')) {
          updates[colRaw] = new Date().toISOString();
        } else if (valExpr?.startsWith("'") && valExpr.endsWith("'")) {
          updates[colRaw] = valExpr.slice(1, -1);
        } else if (valExpr === 'NULL') {
          updates[colRaw] = null;
        } else if (!isNaN(Number(valExpr))) {
          updates[colRaw] = Number(valExpr);
        }
      }

      const whereConds = wherePart.split(/\s+AND\s+/i).map((s) => s.trim()).filter(Boolean);
      const whereChecks: Array<(r: any) => boolean> = [];
      for (const wc of whereConds) {
        const m = wc.match(/^([a-zA-Z0-9_]+)\s*=\s*\?$/);
        const mLit = wc.match(/^([a-zA-Z0-9_]+)\s*=\s*'([^']*)'$/);
        if (m) {
          const col = m[1];
          const val = boundArgs[argIdx++];
          whereChecks.push((r) => String(r[col] ?? '') === String(val ?? ''));
        } else if (mLit) {
          const col = mLit[1];
          const val = mLit[2];
          whereChecks.push((r) => String(r[col] ?? '') === val);
        }
      }

      for (let i = 0; i < rows.length; i++) {
        if (whereChecks.every((fn) => fn(rows[i]))) {
          rows[i] = { ...rows[i], ...updates };
        }
      }
      saveDb(dbData);
      return { success: true };
    }

    if (qUpper.startsWith('DELETE')) {
      const wherePart = q.split(/WHERE/i)[1] || '';
      let argIdx = 0;
      const whereConds = wherePart.split(/\s+AND\s+/i).map((s) => s.trim()).filter(Boolean);
      const whereChecks: Array<(r: any) => boolean> = [];
      for (const wc of whereConds) {
        const m = wc.match(/^([a-zA-Z0-9_]+)\s*=\s*\?$/);
        if (m) {
          const col = m[1];
          const val = boundArgs[argIdx++];
          whereChecks.push((r) => String(r[col] ?? '') === String(val ?? ''));
        }
      }
      if (whereChecks.length > 0) {
        dbData[table] = rows.filter((r) => !whereChecks.every((fn) => fn(r)));
        saveDb(dbData);
      }
      return { success: true };
    }

    return { success: true };
  };

  const devDb = {
    prepare(query: string) {
      let boundArgs: any[] = [];
      const stmt = {
        bind(...args: any[]) {
          boundArgs = args;
          return stmt;
        },
        async first() {
          return executeQuery(query, boundArgs, 'first');
        },
        async all() {
          return executeQuery(query, boundArgs, 'all');
        },
        async run() {
          return executeQuery(query, boundArgs, 'run');
        },
      };
      return stmt;
    },
  };

  return { devMedia, devDb };
}

function workerApiPlugin() {
  const { devMedia, devDb } = createDevStorage();

  return {
    name: 'worker-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && (req.url.startsWith('/api/') || req.url.startsWith('/media/') || req.url.startsWith('/i/'))) {
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
              GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
              SESSION_SECRET: process.env.SESSION_SECRET || 'kohot-dev-preview-session-secret-2026',
              HOST_EMAIL: process.env.HOST_EMAIL || 'seyidan03@gmail.com',
              PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
              PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY || '',
              RESEND_API_KEY: process.env.RESEND_API_KEY || '',
              BUCKET: devMedia,
              DB: devDb,
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
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
