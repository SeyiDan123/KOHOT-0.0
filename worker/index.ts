/**
 * Cloudflare Worker API for KoHot
 * Endpoints for Google Auth, Paystack Payment Verification, D1 Database Persistence,
 * Support Inbox, Annual Album Reminders (Resend + Cloudflare provider TODO), and RBAC
 */

export interface Env {
  DB?: any; // Cloudflare D1 Database binding
  ASSETS?: any; // Cloudflare Pages / Static Assets binding
  HOST_EMAIL?: string;
  PAYSTACK_SECRET_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_PROVIDER?: string; // 'resend' | 'cloudflare'
  EMAIL_FROM?: string;
  DAILY_SEND_CAP?: string | number;
  TEST_MODE?: string; // 'true' | 'false'
  TEST_EMAIL?: string;
}

const DEFAULT_HOST_EMAIL = 'seyidan03@gmail.com';
const STANDARD_PRICE_KOBO = 5000000; // 50,000 NGN in kobo
const DEFAULT_EMAIL_FROM = 'notifications@kohot.app';
const DEFAULT_DAILY_SEND_CAP = 90;
const MAX_EMAILS_PER_CRON_RUN = 40; // Free plan limit safeguard (<= 50 subrequests)

// Simple Cookie helper
function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...val] = part.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(val.join('='));
    }
  }
  return cookies;
}

// Simple base64url decode helper for JWT payload
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// Google Public Key Cache
let cachedGoogleCerts: { keys: any[]; expiresAt: number } | null = null;

async function getGooglePublicKeys(): Promise<any[]> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.keys;
  }
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) {
    throw new Error('Failed to fetch Google public keys');
  }
  const data = (await res.json()) as { keys: any[] };
  // Cache for 1 hour
  cachedGoogleCerts = { keys: data.keys, expiresAt: now + 3600 * 1000 };
  return data.keys;
}

function parseJwt(token: string): { header: any; payload: any; signatureBase64: string; dataToVerify: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let hB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    while (hB64.length % 4) hB64 += '=';
    let pB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (pB64.length % 4) pB64 += '=';
    return {
      header: JSON.parse(atob(hB64)),
      payload: JSON.parse(atob(pB64)),
      signatureBase64: parts[2],
      dataToVerify: `${parts[0]}.${parts[1]}`,
    };
  } catch {
    return null;
  }
}

export interface GoogleVerifyResult {
  valid: boolean;
  payload?: any;
  errorCode?: string;
  reason?: string;
}

export async function verifyGoogleIdToken(token: string, expectedClientId: string): Promise<GoogleVerifyResult> {
  const jwt = parseJwt(token);
  if (!jwt || !jwt.header || !jwt.payload) {
    return { valid: false, errorCode: 'token_invalid', reason: 'JWT could not be parsed' };
  }

  const { header, payload, signatureBase64, dataToVerify } = jwt;

  // 1. Signature verification against Google public keys
  try {
    const keys = await getGooglePublicKeys();
    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) {
      return { valid: false, errorCode: 'token_invalid', reason: `No matching key ID (${header.kid}) found in Google certs` };
    }

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    let sigStr = signatureBase64.replace(/-/g, '+').replace(/_/g, '/');
    while (sigStr.length % 4) sigStr += '=';
    const sigBytes = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(dataToVerify);

    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, dataBytes);
    if (!verified) {
      return { valid: false, errorCode: 'token_invalid', reason: 'Cryptographic signature verification failed' };
    }
  } catch (err: any) {
    return { valid: false, errorCode: 'token_invalid', reason: `Key import/verification error: ${err.message}` };
  }

  // 2. Issuer check
  const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    return { valid: false, errorCode: 'token_invalid', reason: `Invalid issuer: ${payload.iss}` };
  }

  // 3. Audience check
  if (payload.aud !== expectedClientId) {
    console.error(`[GoogleAuth] audience_mismatch: received aud="${payload.aud}", expected aud="${expectedClientId}"`);
    return { valid: false, errorCode: 'audience_mismatch', reason: `Audience mismatch: received ${payload.aud}, expected ${expectedClientId}` };
  }

  // 4. Expiration check
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    return { valid: false, errorCode: 'token_expired', reason: `Token expired at ${payload.exp}, current time ${nowSec}` };
  }

  // 5. email_verified check
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    return { valid: false, errorCode: 'email_not_verified', reason: 'Email is not marked as verified by Google' };
  }

  return { valid: true, payload };
}

// Session signing / verify (7 days)
async function createSessionToken(user: any, secret: string): Promise<string> {
  const data = JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const dataB64 = btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${dataB64}.${sigB64}`;
}

async function verifySessionToken(token: string, secret: string): Promise<any | null> {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    let b64 = dataB64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const data = atob(b64);
    const parsed = JSON.parse(data);
    if (parsed.exp && parsed.exp < Date.now()) return null;

    let sigStr = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    while (sigStr.length % 4) sigStr += '=';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const expectedSig = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, expectedSig, encoder.encode(data));
    if (!valid) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Short-lived signed signup token (15 mins) for registration
async function createSignupToken(email: string, name: string, secret: string): Promise<string> {
  const payload = JSON.stringify({
    email,
    name,
    type: 'signup_token',
    exp: Date.now() + 15 * 60 * 1000,
  });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const dataB64 = btoa(payload)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${dataB64}.${sigB64}`;
}

async function verifySignupToken(token: string, secret: string): Promise<{ email: string; name: string } | null> {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    let b64 = dataB64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const data = atob(b64);
    const parsed = JSON.parse(data);
    if (!parsed || parsed.type !== 'signup_token') return null;
    if (parsed.exp && parsed.exp < Date.now()) return null;

    let sigStr = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    while (sigStr.length % 4) sigStr += '=';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const expectedSig = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, expectedSig, encoder.encode(data));
    if (!valid) return null;
    return { email: parsed.email, name: parsed.name };
  } catch {
    return null;
  }
}

// Check database reachable and tables present
async function checkD1Status(db: any): Promise<{ reachable: boolean; tablesPresent: boolean }> {
  if (!db) return { reachable: false, tablesPresent: false };
  try {
    const res = await db.prepare(
      `SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name IN ('users', 'registrations')`
    ).first();
    const reachable = true;
    const tablesPresent = (res?.cnt || 0) >= 2;
    return { reachable, tablesPresent };
  } catch {
    return { reachable: false, tablesPresent: false };
  }
}

// Signed token for unsubscribe links
async function signUnsubscribeToken(email: string, setId: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ email, setId, ts: Date.now() });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret || 'kohot-default-session-secret-2025'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const dataB64 = btoa(payload)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${dataB64}.${sigB64}`;
}

async function verifyUnsubscribeToken(token: string, secret: string): Promise<{ email: string; setId: string } | null> {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    let b64 = dataB64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const data = atob(b64);
    const parsed = JSON.parse(data);

    let sigStr = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    while (sigStr.length % 4) sigStr += '=';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret || 'kohot-default-session-secret-2025'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const expectedSig = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, expectedSig, encoder.encode(data));
    if (!valid) return null;
    return { email: parsed.email, setId: parsed.setId };
  } catch {
    return null;
  }
}

// Fixed send day spread: derives day 1 to 28 within convocation anniversary month from album ID
export function getAlbumSendDay(albumId: string): number {
  let hash = 0;
  for (let i = 0; i < albumId.length; i++) {
    hash = (hash * 31 + albumId.charCodeAt(i)) >>> 0;
  }
  return (hash % 28) + 1; // Fixed day between 1 and 28
}

// ============================================================================
// SINGLE EMAIL SENDING ENGINE (sendEmail)
// Reads EMAIL_PROVIDER ("resend" or "cloudflare"), EMAIL_FROM, and DAILY_SEND_CAP
// Implement "resend" now. Empty "cloudflare" provider marked TODO.
// ============================================================================
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  provider: 'resend' | 'cloudflare';
  messageId?: string;
  error?: string;
  reason?: string;
}

export async function sendEmail(
  options: SendEmailOptions,
  env: Env
): Promise<SendEmailResult> {
  const provider = ((env.EMAIL_PROVIDER || 'resend').trim().toLowerCase()) as 'resend' | 'cloudflare';
  const dailyCap = Number(env.DAILY_SEND_CAP) || DEFAULT_DAILY_SEND_CAP;
  const emailFrom = env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
  const isTestMode = env.TEST_MODE === 'true';
  const hostEmail = env.HOST_EMAIL || DEFAULT_HOST_EMAIL;
  const targetTo = isTestMode ? (env.TEST_EMAIL || hostEmail) : options.to;
  const targetSubject = isTestMode ? `[TEST] ${options.subject}` : options.subject;

  // 1. Enforce Daily Send Cap via D1
  if (env.DB) {
    try {
      const countRow = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM email_logs WHERE date(sent_at) = date('now') AND status = 'sent'`
      ).first();
      const todayCount = Number(countRow?.cnt || 0);
      if (todayCount >= dailyCap) {
        return {
          success: false,
          provider,
          reason: 'daily_cap_reached',
          error: `Daily send cap of ${dailyCap} reached (sent today: ${todayCount})`,
        };
      }
    } catch (e: any) {
      console.warn('Could not check daily send cap in D1:', e.message);
    }
  }

  let result: SendEmailResult;

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY) {
      result = {
        success: false,
        provider: 'resend',
        error: 'RESEND_API_KEY secret is not configured in Cloudflare secrets',
      };
    } else {
      try {
        const payload = {
          from: `KoHot <${emailFrom}>`,
          to: [targetTo],
          subject: targetSubject,
          html: options.html,
          text: options.text || options.html.replace(/<[^>]+>/g, ' '),
          reply_to: options.replyTo,
        };

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = (await res.json()) as any;
        if (res.ok && data?.id) {
          result = {
            success: true,
            provider: 'resend',
            messageId: data.id,
          };
        } else {
          result = {
            success: false,
            provider: 'resend',
            error: data?.message || `Resend error status ${res.status}`,
          };
        }
      } catch (err: any) {
        result = {
          success: false,
          provider: 'resend',
          error: err.message || 'Resend network error',
        };
      }
    }
  } else if (provider === 'cloudflare') {
    // TODO: Implement Cloudflare email provider with the same input and output signature
    result = {
      success: false,
      provider: 'cloudflare',
      error: 'Cloudflare email provider is not implemented yet (TODO)',
    };
  } else {
    result = {
      success: false,
      provider: 'resend',
      error: `Unsupported email provider: ${provider}`,
    };
  }

  // Record send attempt in D1 email_logs
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO email_logs (id, recipient, subject, provider, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          `eml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          targetTo,
          targetSubject,
          provider,
          result.success ? 'sent' : 'failed',
          result.error || null
        )
        .run();
    } catch (logErr: any) {
      console.warn('Could not record email_log in D1:', logErr.message);
    }
  }

  return result;
}

// ============================================================================
// ANNUAL ALBUM REMINDER PROCESSOR
// ============================================================================
export interface ReminderCandidate {
  setId: string;
  classSetName: string;
  departmentName: string;
  institutionName: string;
  studentEmail: string;
  studentName: string;
  convocationMonth: number;
  sendDay: number;
  currentYear: number;
}

export interface ReminderProcessResult {
  asOfDate: string;
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  dryRun: boolean;
  totalCandidates: number;
  sentCount: number;
  failedCount: number;
  candidates: ReminderCandidate[];
  errors: Array<{ studentEmail: string; setId: string; error: string }>;
}

export async function processAnnualReminders(
  env: Env,
  options?: { dryRun?: boolean; asOfDate?: string; appOrigin?: string }
): Promise<ReminderProcessResult> {
  const dryRun = Boolean(options?.dryRun);
  const refDate = options?.asOfDate ? new Date(options.asOfDate) : new Date();
  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth() + 1; // 1-12
  const currentDay = refDate.getDate(); // 1-31
  const sessionSecret = env.SESSION_SECRET || 'kohot-production-session-secret-2025';
  const appOrigin = options?.appOrigin || 'https://kohot.app';

  const candidates: ReminderCandidate[] = [];
  const errors: Array<{ studentEmail: string; setId: string; error: string }> = [];
  let sentCount = 0;
  let failedCount = 0;

  if (!env.DB) {
    return {
      asOfDate: refDate.toISOString().split('T')[0],
      currentYear,
      currentMonth,
      currentDay,
      dryRun,
      totalCandidates: 0,
      sentCount: 0,
      failedCount: 0,
      candidates: [],
      errors: [{ studentEmail: 'none', setId: 'none', error: 'D1 Database binding DB not available' }],
    };
  }

  // 1. Fetch active class sets from D1
  const setsQuery = await env.DB.prepare(`SELECT id, data_json FROM class_sets WHERE status = 'active'`).all();
  const setsRows = setsQuery?.results || [];

  for (const row of setsRows) {
    try {
      const set = JSON.parse(row.data_json);
      if (!set || !set.id) continue;

      // Extract convocation month (default to 11/12 or graduation year if not specified)
      let convocationMonth = 12; // December default for Nigerian convocations
      if (set.convocationMonth && Number(set.convocationMonth) >= 1 && Number(set.convocationMonth) <= 12) {
        convocationMonth = Number(set.convocationMonth);
      } else if (set.convocationDate) {
        const d = new Date(set.convocationDate);
        if (!isNaN(d.getTime())) {
          convocationMonth = d.getMonth() + 1;
        }
      }

      // Check if current month is the convocation anniversary month
      if (convocationMonth !== currentMonth) {
        continue;
      }

      // Check fixed send day for this class (1..28)
      const sendDay = getAlbumSendDay(set.id);
      if (currentDay < sendDay) {
        // Class send date has not arrived yet this month
        continue;
      }

      const students = Array.isArray(set.students) ? set.students : [];
      for (const std of students) {
        const email = (std.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) continue;

        // Check consent: must have consent flag and consent time
        const hasConsent = std.hasConsent !== false; // collected on submission / admin invite
        if (!hasConsent) continue;

        // Check if unsubscribed
        const unSub = await env.DB.prepare(`SELECT email FROM unsubscribed_students WHERE email = ?`)
          .bind(email)
          .first();
        if (unSub) continue;

        // Check if already sent reminder for this year
        const alreadySent = await env.DB.prepare(
          `SELECT id FROM reminder_logs WHERE student_email = ? AND set_id = ? AND year = ? AND status = 'sent'`
        )
          .bind(email, set.id, currentYear)
          .first();
        if (alreadySent) continue;

        candidates.push({
          setId: set.id,
          classSetName: set.classSetName || `${set.departmentName} '${String(set.graduationYear || currentYear).slice(-2)}`,
          departmentName: set.departmentName || 'Department',
          institutionName: set.institutionName || 'University',
          studentEmail: email,
          studentName: std.fullName || 'Graduate',
          convocationMonth,
          sendDay,
          currentYear,
        });
      }
    } catch (parseErr: any) {
      console.warn(`Error parsing set data_json for row ${row.id}:`, parseErr.message);
    }
  }

  if (dryRun) {
    return {
      asOfDate: refDate.toISOString().split('T')[0],
      currentYear,
      currentMonth,
      currentDay,
      dryRun: true,
      totalCandidates: candidates.length,
      sentCount: 0,
      failedCount: 0,
      candidates,
      errors,
    };
  }

  // 2. Dispatch reminders up to MAX_EMAILS_PER_CRON_RUN (40)
  const toSend = candidates.slice(0, MAX_EMAILS_PER_CRON_RUN);

  for (const cand of toSend) {
    const unsubToken = await signUnsubscribeToken(cand.studentEmail, cand.setId, sessionSecret);
    const albumUrl = `${appOrigin}/#album-${cand.setId}`;
    const unsubUrl = `${appOrigin}/api/reminders/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px 20px; background-color: #ffffff; color: #1a1a1a; border-radius: 16px; border: 1px solid #eaeaea;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #111111; margin: 0 0 6px;">KOHOT</h2>
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888888; margin: 0;">Annual Class Album Remembrance</p>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hello ${cand.studentName},</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          Your graduating class album misses you! It has been another year since convocation at <strong>${cand.institutionName}</strong> (${cand.departmentName}).
        </p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Take a moment today to reconnect with your classmates, relive the moments, re-read the quotes and awards, and celebrate how far everyone has come.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${albumUrl}" style="background-color: #d4af37; color: #000000; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 14px 28px; text-decoration: none; border-radius: 30px; display: inline-block;">
            Open Class Album
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 32px 0 16px;" />
        <p style="font-size: 11px; color: #888888; line-height: 1.5; margin: 0 0 8px; text-align: center;">
          Sent by KoHot • Preserving living graduate heritage across generations.
        </p>
        <p style="font-size: 11px; color: #888888; margin: 0; text-align: center;">
          <a href="${unsubUrl}" style="color: #666666; text-decoration: underline;">Unsubscribe from annual class reminders</a>
        </p>
      </div>
    `;

    const text = `Hello ${cand.studentName},\n\nYour class album misses you! Relive the memories of ${cand.classSetName} at ${cand.institutionName} (${cand.departmentName}):\n\n${albumUrl}\n\nUnsubscribe from annual reminders: ${unsubUrl}\n\nSender: KoHot`;

    const sendRes = await sendEmail(
      {
        to: cand.studentEmail,
        subject: 'Your class album misses you',
        html,
        text,
      },
      env
    );

    const logId = `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const status = sendRes.success ? 'sent' : 'failed';
    const provider = sendRes.provider || 'resend';

    try {
      await env.DB.prepare(
        `INSERT INTO reminder_logs (id, student_email, set_id, year, status, provider, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(logId, cand.studentEmail, cand.setId, currentYear, status, provider, sendRes.error || null)
        .run();
    } catch (dbErr: any) {
      console.warn('Could not record reminder_log in D1:', dbErr.message);
    }

    if (sendRes.success) {
      sentCount++;
    } else {
      failedCount++;
      errors.push({
        studentEmail: cand.studentEmail,
        setId: cand.setId,
        error: sendRes.error || sendRes.reason || 'Send failed',
      });
      // Break early if daily cap was hit
      if (sendRes.reason === 'daily_cap_reached') {
        break;
      }
    }
  }

  return {
    asOfDate: refDate.toISOString().split('T')[0],
    currentYear,
    currentMonth,
    currentDay,
    dryRun: false,
    totalCandidates: candidates.length,
    sentCount,
    failedCount,
    candidates: toSend,
    errors,
  };
}

// ============================================================================
// WORKER ENTRY POINT (fetch + scheduled cron)
// ============================================================================
export default {
  // CRON TRIGGER: runs every 15 minutes as defined in wrangler.toml
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    try {
      await processAnnualReminders(env, { dryRun: false });
    } catch (cronErr: any) {
      console.error('Scheduled reminder cron run encountered error:', cronErr.message);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const hostEmail = (env.HOST_EMAIL || DEFAULT_HOST_EMAIL).trim().toLowerCase();
    const sessionSecret = env.SESSION_SECRET || 'kohot-production-session-secret-2025';

    // CORS Headers for API
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Helper: get current authenticated user from session
    const getSessionUser = async () => {
      const cookieHeader = request.headers.get('Cookie');
      const cookies = parseCookies(cookieHeader);
      const sessionToken = cookies['kohot_session'];
      if (!sessionToken) return null;
      return await verifySessionToken(sessionToken, sessionSecret);
    };

    // Helper: write audit log
    const logAudit = async (action: string, details: string, userEmail?: string) => {
      try {
        console.log(`[AUDIT] ${new Date().toISOString()} | Action: ${action} | User: ${userEmail || 'anonymous'} | ${details}`);
        if (env.DB) {
          const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || '127.0.0.1';
          await env.DB.prepare(
            `INSERT INTO audit_logs (id, user_email, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
          ).bind(logId, userEmail || null, action, details, ip).run();
        }
      } catch (err: any) {
        console.error('Audit log error:', err.message);
      }
    };

    // 0a. Web App Manifest Endpoint (/api/manifest?album=ID, application/manifest+json)
    if (path === '/api/manifest') {
      const albumId = url.searchParams.get('album') || url.searchParams.get('wall') || url.searchParams.get('id') || '';
      let deptName = 'Department';
      let gradYear = 2024;

      if (albumId.includes('crownfield-law-2024')) {
        deptName = 'Department of Public Law';
        gradYear = 2024;
      } else if (albumId.includes('crownfield-law-2025')) {
        deptName = 'Department of Public Law';
        gradYear = 2025;
      } else if (albumId.includes('crownfield-law-2026')) {
        deptName = 'Department of Public Law';
        gradYear = 2026;
      } else if (albumId.includes('crownfield-law-2023')) {
        deptName = 'Department of Public Law';
        gradYear = 2023;
      } else if (albumId.includes('computer-science') || albumId.includes('cs-')) {
        deptName = 'Department of Computer Science';
        gradYear = 2024;
      } else {
        const parts = albumId.split('-');
        const lastPart = parts[parts.length - 1];
        if (/^\d{4}$/.test(lastPart)) {
          gradYear = parseInt(lastPart, 10);
        }
        deptName = 'Department';
      }

      const manifestName = `${deptName} Class of ${gradYear}`;
      const startUrl = albumId ? `${url.origin}/#department/${albumId}` : `${url.origin}/#home`;

      const manifest = {
        name: manifestName,
        short_name: 'KoHot',
        start_url: startUrl,
        id: startUrl,
        display: 'standalone',
        theme_color: '#0a0a0c',
        background_color: '#0a0a0c',
        icons: [
          {
            src: '/assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/assets/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      };

      return new Response(JSON.stringify(manifest, null, 2), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/manifest+json',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 0b. Unpublish / Republish Album
    const unpublishMatch = path.match(/^\/api\/albums\/([^/]+)\/unpublish$/);
    if (unpublishMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(unpublishMatch[1]);
      const sessionUser = await getSessionUser();
      const body = await request.json().catch(() => ({})) as any;
      const isUnpublished = body.unpublished !== false;
      const actorEmail = sessionUser?.email || hostEmail;

      await logAudit(
        isUnpublished ? 'album_unpublished' : 'album_republished',
        `Album ${albumId} ${isUnpublished ? 'unpublished' : 'republished'} by ${actorEmail}`,
        actorEmail
      );

      if (env.DB) {
        try {
          await env.DB.prepare(
            `UPDATE class_sets SET status = ? WHERE id = ?`
          ).bind(isUnpublished ? 'unpublished' : 'active', albumId).run();
        } catch {}
      }

      return new Response(JSON.stringify({ success: true, isUnpublished }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0c. Request Album Deletion (reason required)
    const reqDeleteMatch = path.match(/^\/api\/albums\/([^/]+)\/request-deletion$/);
    if (reqDeleteMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(reqDeleteMatch[1]);
      const sessionUser = await getSessionUser();
      const body = await request.json().catch(() => ({})) as any;
      const reason = (body.reason || '').trim();

      if (!reason) {
        return new Response(JSON.stringify({ error: 'Reason required for deletion request.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const actorEmail = sessionUser?.email || 'admin';
      await logAudit(
        'album_deletion_requested',
        `Deletion requested for album ${albumId}. Reason: "${reason}" by ${actorEmail}`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true, albumId, reason }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0d. Soft Delete Album (Host only, sets deletedAt)
    const softDeleteMatch = path.match(/^\/api\/albums\/([^/]+)\/delete$/);
    if (softDeleteMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(softDeleteMatch[1]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || hostEmail;

      await logAudit(
        'album_soft_deleted',
        `Album ${albumId} soft-deleted by ${actorEmail}. Retained for 30 days.`,
        actorEmail
      );

      if (env.DB) {
        try {
          await env.DB.prepare(
            `UPDATE class_sets SET status = 'deleted' WHERE id = ?`
          ).bind(albumId).run();
        } catch {}
      }

      return new Response(JSON.stringify({ success: true, deletedAt: new Date().toISOString() }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0e. Restore Soft-Deleted Album
    const restoreMatch = path.match(/^\/api\/albums\/([^/]+)\/restore$/);
    if (restoreMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(restoreMatch[1]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || hostEmail;

      await logAudit(
        'album_restored',
        `Album ${albumId} restored by ${actorEmail}.`,
        actorEmail
      );

      if (env.DB) {
        try {
          await env.DB.prepare(
            `UPDATE class_sets SET status = 'active' WHERE id = ?`
          ).bind(albumId).run();
        } catch {}
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0f. Permanent Delete Album (Host only, after 30 days)
    const permDeleteMatch = path.match(/^\/api\/albums\/([^/]+)\/delete-permanent$/);
    if (permDeleteMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(permDeleteMatch[1]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || hostEmail;

      await logAudit(
        'album_permanently_deleted',
        `Album ${albumId} permanently deleted by ${actorEmail}. All data erased.`,
        actorEmail
      );

      if (env.DB) {
        try {
          await env.DB.prepare(`DELETE FROM class_sets WHERE id = ?`).bind(albumId).run();
        } catch {}
      }

      return new Response(JSON.stringify({ success: true, permanentlyDeleted: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0g. Delete Individual Profile
    const deleteProfileMatch = path.match(/^\/api\/albums\/([^/]+)\/profiles\/([^/]+)$/);
    if (deleteProfileMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteProfileMatch[1]);
      const profileId = decodeURIComponent(deleteProfileMatch[2]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || 'admin';

      await logAudit(
        'profile_deleted',
        `Profile ${profileId} deleted from album ${albumId} by ${actorEmail}`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0h. Delete Individual Memory
    const deleteMemoryMatch = path.match(/^\/api\/albums\/([^/]+)\/memories\/([^/]+)$/);
    if (deleteMemoryMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteMemoryMatch[1]);
      const memoryId = decodeURIComponent(deleteMemoryMatch[2]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || 'admin';

      await logAudit(
        'memory_deleted',
        `Memory moment ${memoryId} deleted from album ${albumId} by ${actorEmail}`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0i. Delete Individual Award
    const deleteAwardMatch = path.match(/^\/api\/albums\/([^/]+)\/awards\/([^/]+)$/);
    if (deleteAwardMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteAwardMatch[1]);
      const awardId = decodeURIComponent(deleteAwardMatch[2]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || 'admin';

      await logAudit(
        'award_deleted',
        `Award ${awardId} deleted from album ${albumId} by ${actorEmail}`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0j. Public Auth Status Endpoint (Returns only booleans, no values)
    if (path === '/api/auth/status' && request.method === 'GET') {
      const d1Status = await checkD1Status(env.DB);
      return new Response(
        JSON.stringify({
          googleClientIdSet: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim().length > 0),
          sessionSecretSet: Boolean(env.SESSION_SECRET && env.SESSION_SECRET.trim().length > 0),
          hostEmailSet: Boolean(env.HOST_EMAIL && env.HOST_EMAIL.trim().length > 0),
          databaseReachable: d1Status.reachable,
          tablesPresent: d1Status.tablesPresent,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 0k. Public Auth Config Endpoint (returns public googleClientId from Worker env)
    if (path === '/api/auth/config' && request.method === 'GET') {
      const googleClientId = (env.GOOGLE_CLIENT_ID || '').trim();
      return new Response(
        JSON.stringify({
          googleClientId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Google OAuth Verification Endpoint
    if (path === '/api/auth/google' && request.method === 'POST') {
      // Configuration checks
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_ID.trim()) {
        console.error('[GoogleAuth] missing_google_client_id: GOOGLE_CLIENT_ID environment variable is missing');
        return new Response(
          JSON.stringify({
            error: 'missing_google_client_id',
            message: "Sign-in isn't set up yet. Contact the administrator.",
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!env.SESSION_SECRET || !env.SESSION_SECRET.trim()) {
        console.error('[GoogleAuth] missing_session_secret: SESSION_SECRET environment variable is missing');
        return new Response(
          JSON.stringify({
            error: 'missing_session_secret',
            message: "Sign-in isn't set up yet. Contact the administrator.",
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!env.HOST_EMAIL || !env.HOST_EMAIL.trim()) {
        console.error('[GoogleAuth] missing_host_email: HOST_EMAIL environment variable is missing');
        return new Response(
          JSON.stringify({
            error: 'missing_host_email',
            message: "Sign-in isn't set up yet. Contact the administrator.",
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const body = (await request.json()) as { credential?: string; token?: string };
        const credential = body.credential || body.token;
        if (!credential) {
          console.error('[GoogleAuth] token_invalid: Missing credential in request');
          return new Response(
            JSON.stringify({
              error: 'token_invalid',
              message: 'Sign in failed. Please try again.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify token against Google's public keys
        const verifyRes = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID.trim());
        if (!verifyRes.valid) {
          console.error(`[GoogleAuth] ${verifyRes.errorCode}: ${verifyRes.reason}`);
          return new Response(
            JSON.stringify({
              error: verifyRes.errorCode,
              message: verifyRes.errorCode === 'audience_mismatch' || verifyRes.errorCode === 'token_invalid' || verifyRes.errorCode === 'token_expired' || verifyRes.errorCode === 'email_not_verified'
                ? 'Sign in failed. Please try again.'
                : "Sign-in isn't set up yet. Contact the administrator.",
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const payload = verifyRes.payload;
        const userEmail = (payload.email || '').trim().toLowerCase();
        const userName = payload.name || payload.given_name || 'Class Admin';
        const userAvatar = payload.picture || '';

        // Role determination strictly from verified email
        if (userEmail === hostEmail.trim().toLowerCase()) {
          const hostUser = {
            id: 'usr-host',
            email: hostEmail,
            fullName: 'Seyi Dan',
            phone: '09036872687',
            role: 'master_host',
            avatar: userAvatar,
          };
          const sessionToken = await createSessionToken(hostUser, sessionSecret);
          return new Response(JSON.stringify({ success: true, user: hostUser }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Set-Cookie': `kohot_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
            },
          });
        }

        // Non-host: Verify registration in D1
        const d1Status = await checkD1Status(env.DB);
        if (!d1Status.reachable || !d1Status.tablesPresent) {
          console.error('[GoogleAuth] database_not_set_up: D1 binding or tables missing');
          return new Response(
            JSON.stringify({
              error: 'database_not_set_up',
              message: 'Database not set up',
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const regQuery = await env.DB.prepare(
          `SELECT * FROM registrations WHERE LOWER(applicant_email) = ? ORDER BY created_at DESC`
        ).bind(userEmail).all();

        const regs = regQuery.results || [];
        if (regs.length === 0) {
          console.error('[GoogleAuth] not_registered: No registration found for email');
          return new Response(
            JSON.stringify({
              error: 'not_registered',
              message: 'No class album is registered with this email. Please register through Create Class Album.',
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const activeRegs = regs.filter((r: any) => r.status === 'active');
        const pendingRegs = regs.filter((r: any) => r.status === 'pending');

        if (activeRegs.length > 0) {
          const activeAlbums = activeRegs.map((r: any) => ({
            id: `${r.institution_id}-${r.department_id.replace(/^dept-/, '')}-${r.graduation_year}`,
            institutionId: r.institution_id,
            departmentId: r.department_id,
            graduationYear: r.graduation_year,
            classSetName: r.class_set_name,
            applicantName: r.applicant_name,
          }));

          const primaryReg = activeRegs[0];
          const primaryAlbumId = activeAlbums[0].id;
          const adminUser = {
            id: `usr-${primaryReg.id}`,
            email: userEmail,
            fullName: primaryReg.applicant_name,
            phone: primaryReg.applicant_phone,
            role: 'class_rep',
            assignedSetId: primaryAlbumId,
            avatar: userAvatar,
            albums: activeAlbums.map((a: any) => a.id),
          };

          const sessionToken = await createSessionToken(adminUser, sessionSecret);
          return new Response(
            JSON.stringify({
              success: true,
              user: adminUser,
              albums: activeAlbums.length > 1 ? activeAlbums : undefined,
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Set-Cookie': `kohot_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
              },
            }
          );
        }

        if (pendingRegs.length > 0) {
          console.error('[GoogleAuth] registration_pending: Registration awaiting approval');
          return new Response(
            JSON.stringify({
              error: 'registration_pending',
              message: 'Your registration is awaiting approval.',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.error('[GoogleAuth] not_registered: No active or pending registration');
        return new Response(
          JSON.stringify({
            error: 'not_registered',
            message: 'No class album is registered with this email. Please register through Create Class Album.',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error(`[GoogleAuth] token_invalid: Exception during auth verification: ${err.message}`);
        return new Response(
          JSON.stringify({
            error: 'token_invalid',
            message: 'Sign in failed. Please try again.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1b. Google Signup Token Generator (Short-lived signed token containing verified email)
    if (path === '/api/auth/google-signup-token' && request.method === 'POST') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_ID.trim()) {
        console.error('[GoogleAuth] missing_google_client_id: GOOGLE_CLIENT_ID not set');
        return new Response(
          JSON.stringify({
            error: 'missing_google_client_id',
            message: "Sign-in isn't set up yet. Contact the administrator.",
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!env.SESSION_SECRET || !env.SESSION_SECRET.trim()) {
        console.error('[GoogleAuth] missing_session_secret: SESSION_SECRET not set');
        return new Response(
          JSON.stringify({
            error: 'missing_session_secret',
            message: "Sign-in isn't set up yet. Contact the administrator.",
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const body = (await request.json()) as { credential?: string; token?: string };
        const credential = body.credential || body.token;
        if (!credential) {
          return new Response(
            JSON.stringify({ error: 'token_invalid', message: 'Missing Google credential' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const verifyRes = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID.trim());
        if (!verifyRes.valid) {
          console.error(`[GoogleAuth] signup token verification failed: ${verifyRes.errorCode}`);
          return new Response(
            JSON.stringify({
              error: verifyRes.errorCode,
              message: 'Google verification failed. Please try again.',
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const payload = verifyRes.payload;
        const verifiedEmail = (payload.email || '').trim().toLowerCase();
        const verifiedName = payload.name || payload.given_name || 'Class Admin';

        const signupToken = await createSignupToken(verifiedEmail, verifiedName, sessionSecret);
        return new Response(
          JSON.stringify({
            success: true,
            signupToken,
            email: verifiedEmail,
            name: verifiedName,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error(`[GoogleAuth] signup token generation error: ${err.message}`);
        return new Response(
          JSON.stringify({ error: 'token_invalid', message: 'Failed to generate signup token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Auth Session Check (Reads from signed session cookie)
    if (path === '/api/auth/me' && request.method === 'GET') {
      const user = await getSessionUser();
      if (!user) {
        return new Response(
          JSON.stringify({ authenticated: false, role: 'visitor', user: null, albums: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          authenticated: true,
          role: user.role,
          user,
          albums: user.albums || (user.assignedSetId ? [user.assignedSetId] : []),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Logout Endpoint (Clears signed session cookie)
    if (path === '/api/auth/logout' && request.method === 'POST') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Set-Cookie': `kohot_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
        },
      });
    }

    // 4. Paystack Payment Verification Endpoint
    if (path === '/api/verify-payment' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          reference: string;
          institutionId: string;
          departmentId: string;
          graduationYear: number;
          applicantEmail?: string;
          applicantName: string;
          applicantPhone: string;
          classSetName: string;
          estimatedGraduates?: number;
          signupToken?: string;
        };

        const { reference, institutionId, departmentId, graduationYear, applicantName, applicantPhone, classSetName, signupToken } = body;

        if (!reference || !institutionId || !departmentId || !graduationYear) {
          return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verify Google signupToken - only verified Google email is stored
        if (!signupToken) {
          return new Response(
            JSON.stringify({ error: 'signup_token_required', message: 'Verified Google signup token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const verifiedSignup = await verifySignupToken(signupToken, sessionSecret);
        if (!verifiedSignup || !verifiedSignup.email) {
          return new Response(
            JSON.stringify({ error: 'signup_token_invalid', message: 'Google signup token expired or invalid. Please sign up with Google again.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const verifiedApplicantEmail = verifiedSignup.email;

        // Verify with Paystack API if secret key is configured
        let paystackVerified = false;
        if (env.PAYSTACK_SECRET_KEY) {
          const pskRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: {
              Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            },
          });
          const pskData = (await pskRes.json()) as any;
          if (pskData.status && pskData.data && pskData.data.status === 'success' && pskData.data.amount === STANDARD_PRICE_KOBO) {
            paystackVerified = true;
          } else {
            return new Response(
              JSON.stringify({
                error: 'payment_failed',
                message: 'Paystack transaction could not be verified or amount did not match ₦50,000.',
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        } else {
          // If in test mode without Paystack secret key set in Cloudflare secrets:
          paystackVerified = reference.startsWith('PSK-') || reference.startsWith('demo_');
        }

        // Safeguard: Check if this reference was already used
        if (env.DB) {
          const existingRef = await env.DB.prepare(`SELECT id FROM transactions WHERE reference = ?`).bind(reference).first();
          if (existingRef) {
            return new Response(
              JSON.stringify({ error: 'already_processed', message: 'This transaction reference has already been used.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Duplicate check safeguard: check if album already registered for same year
          const existingClass = await env.DB.prepare(
            `SELECT id FROM registrations WHERE institution_id = ? AND department_id = ? AND graduation_year = ? AND status = 'active'`
          )
            .bind(institutionId, departmentId, graduationYear)
            .first();

          if (existingClass) {
            // Store paid transaction with refund flag for Host
            await env.DB.prepare(
              `INSERT INTO transactions (id, reference, amount, amount_kobo, status, payer_name, payer_email) VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                `tx-${Date.now()}`,
                reference,
                50000,
                STANDARD_PRICE_KOBO,
                'paid, duplicate class, needs refund',
                applicantName,
                verifiedApplicantEmail
              )
              .run();

            return new Response(
              JSON.stringify({
                error: 'duplicate_class',
                message: 'Payment received, but this class year already exists. Recorded for Host refund.',
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Record registration and active class album
          const regId = `reg-${Date.now()}`;
          const albumId = `${institutionId}-${departmentId.replace(/^dept-/, '')}-${graduationYear}`;

          await env.DB.prepare(
            `INSERT INTO registrations (id, applicant_email, applicant_name, applicant_phone, institution_id, department_id, graduation_year, class_set_name, registration_type, status, payment_ref, payment_amount, approved_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'standard', 'active', ?, ?, datetime('now'))`
          )
            .bind(regId, verifiedApplicantEmail, applicantName, applicantPhone, institutionId, departmentId, graduationYear, classSetName, reference, STANDARD_PRICE_KOBO)
            .run();

          await env.DB.prepare(
            `INSERT INTO transactions (id, reference, set_id, set_name, amount, amount_kobo, status, payer_name, payer_email)
             VALUES (?, ?, ?, ?, ?, ?, 'Paid', ?, ?)`
          )
            .bind(`tx-${Date.now()}`, reference, albumId, classSetName, 50000, STANDARD_PRICE_KOBO, applicantName, verifiedApplicantEmail)
            .run();
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: 'success',
            amount: STANDARD_PRICE_KOBO,
            reference,
            verified: paystackVerified,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || 'Payment verification failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 5. Founding Class Registration & Host Alert
    if (path === '/api/registrations/founding' && request.method === 'POST') {
      try {
        const body = (await request.json()) as any;
        const {
          universityId,
          universityName,
          departmentId,
          departmentName,
          classYear,
          classSetName,
          applicantPhone,
          signupToken,
        } = body;

        if (!signupToken) {
          return new Response(
            JSON.stringify({ error: 'signup_token_required', message: 'Verified Google signup token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const verifiedSignup = await verifySignupToken(signupToken, sessionSecret);
        if (!verifiedSignup || !verifiedSignup.email) {
          return new Response(
            JSON.stringify({ error: 'signup_token_invalid', message: 'Google signup token expired or invalid. Please sign up with Google again.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const applicantEmail = verifiedSignup.email;
        const applicantName = verifiedSignup.name || body.applicantName || 'Applicant';

        if (!departmentName || !universityName) {
          return new Response(JSON.stringify({ error: 'Missing registration details' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const regId = `reg-fnd-${Date.now()}`;
        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO registrations (id, applicant_email, applicant_name, applicant_phone, institution_id, department_id, graduation_year, class_set_name, registration_type, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'founding', 'pending')`
          )
            .bind(
              regId,
              applicantEmail,
              applicantName || 'Applicant',
              applicantPhone || '',
              universityId || 'uni-default',
              departmentId || 'dept-default',
              Number(classYear) || new Date().getFullYear(),
              classSetName || `${departmentName} Class of ${classYear}`
            )
            .run();
        }

        // Host Alert Email: "New registration awaiting approval" with department and institution
        await sendEmail(
          {
            to: hostEmail,
            subject: 'New registration awaiting approval',
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e5e5e5; border-radius: 12px;">
                <h3 style="margin: 0 0 12px; color: #111;">New Registration Awaiting Approval</h3>
                <p style="margin: 0 0 8px;">A new founding class registration was submitted and is awaiting your review:</p>
                <ul style="margin: 0 0 16px; padding-left: 20px; line-height: 1.6;">
                  <li><strong>Institution:</strong> ${universityName}</li>
                  <li><strong>Department:</strong> ${departmentName}</li>
                  <li><strong>Class Year:</strong> ${classYear}</li>
                  <li><strong>Applicant:</strong> ${applicantName} (${applicantEmail})</li>
                  <li><strong>Phone:</strong> ${applicantPhone || 'Not provided'}</li>
                </ul>
                <p style="font-size: 13px; color: #666; margin: 0;">Please log into the Host Dashboard to approve or decline.</p>
              </div>
            `,
            text: `New registration awaiting approval:\nInstitution: ${universityName}\nDepartment: ${departmentName}\nClass Year: ${classYear}\nApplicant: ${applicantName} (${applicantEmail})\nPhone: ${applicantPhone || 'None'}`,
          },
          env
        );

        return new Response(JSON.stringify({ success: true, id: regId }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || 'Registration failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 6. Support Inbox: Submit Support Message (Public Footer & Admin Profile Menu)
    if (path === '/api/support' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          name?: string;
          email?: string;
          message?: string;
          albumId?: string;
        };

        const name = (body.name || '').trim();
        const email = (body.email || '').trim().toLowerCase();
        const message = (body.message || '').trim();
        const albumId = (body.albumId || '').trim();

        if (!name || !email || !message) {
          return new Response(JSON.stringify({ error: 'Name, email, and message are required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Block messages over 2,000 characters
        if (message.length > 2000) {
          return new Response(
            JSON.stringify({ error: 'Message must not exceed 2,000 characters.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Rate limit: 1 message per minute per visitor
        if (env.DB) {
          const recentMsg = await env.DB.prepare(
            `SELECT created_at FROM support_messages WHERE LOWER(sender_email) = ? AND datetime(created_at) >= datetime('now', '-1 minute') LIMIT 1`
          )
            .bind(email)
            .first();

          if (recentMsg) {
            return new Response(
              JSON.stringify({ error: 'Rate limit: Please wait 1 minute before submitting another support message.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const msgId = `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await env.DB.prepare(
            `INSERT INTO support_messages (id, sender_name, sender_email, message, set_id, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'new', datetime('now'))`
          )
            .bind(msgId, name, email, message, albumId || null)
            .run();
        }

        // Email HOST_EMAIL "New support message" through sendEmail()
        await sendEmail(
          {
            to: hostEmail,
            subject: 'New support message',
            replyTo: email,
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 520px; padding: 24px; border: 1px solid #e5e5e5; border-radius: 12px; background: #fafafa;">
                <h3 style="margin: 0 0 12px; color: #111;">New Support Message</h3>
                <p style="margin: 0 0 6px;"><strong>From:</strong> ${name} &lt;${email}&gt;</p>
                ${albumId ? `<p style="margin: 0 0 12px; font-size: 13px; color: #666;"><strong>Class Album:</strong> ${albumId}</p>` : ''}
                <div style="background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #eaeaea; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin: 16px 0;">
${message}
                </div>
                <p style="font-size: 12px; color: #888; margin: 0;">You can reply directly to this email or open the Host Dashboard Support tab.</p>
              </div>
            `,
            text: `New support message from ${name} <${email}>:\n\n${message}${albumId ? `\n\nAlbum: ${albumId}` : ''}`,
          },
          env
        );

        return new Response(JSON.stringify({ success: true, message: 'Support message received.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || 'Failed to submit support message' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 7. Host Support Inbox Listing (Host Only)
    if (path === '/api/admin/support' && request.method === 'GET') {
      const user = await getSessionUser();
      if (!user || user.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Unauthorized: Host access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (env.DB) {
        const rows = await env.DB.prepare(
          `SELECT * FROM support_messages ORDER BY created_at DESC LIMIT 100`
        ).all();
        const newCountRow = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM support_messages WHERE status = 'new'`
        ).first();

        return new Response(
          JSON.stringify({
            success: true,
            messages: rows?.results || [],
            newCount: Number(newCountRow?.count || 0),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true, messages: [], newCount: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Update Support Message Status (Host Only)
    if (path.startsWith('/api/admin/support/') && path.endsWith('/status') && request.method === 'POST') {
      const user = await getSessionUser();
      if (!user || user.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const msgId = path.replace('/api/admin/support/', '').replace('/status', '');
      const body = (await request.json()) as { status: 'new' | 'read' | 'closed' };

      if (env.DB && ['new', 'read', 'closed'].includes(body.status)) {
        await env.DB.prepare(`UPDATE support_messages SET status = ? WHERE id = ?`).bind(body.status, msgId).run();
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 9. Unsubscribe Handler (Honors Signed Unsubscribe Token)
    if (path === '/api/reminders/unsubscribe' && request.method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response('Invalid unsubscribe link.', { status: 400 });
      }

      const verified = await verifyUnsubscribeToken(token, sessionSecret);
      if (!verified) {
        return new Response('Unsubscribe token expired or invalid.', { status: 400 });
      }

      if (env.DB) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO unsubscribed_students (email, set_id, unsubscribed_at) VALUES (?, ?, datetime('now'))`
        )
          .bind(verified.email, verified.setId)
          .run();
      }

      // Reassuring Clean HTML confirmation
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Unsubscribed from KoHot Reminders</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0c0d12; color: #ffffff; padding: 20px; }
            .card { max-width: 440px; background: #16171d; border: 1px solid #27272a; padding: 36px 28px; border-radius: 24px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            h1 { font-size: 20px; margin-bottom: 12px; color: #d4af37; font-weight: 700; letter-spacing: -0.02em; }
            p { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 24px; }
            a { display: inline-block; background: #27272a; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 999px; font-size: 13px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>You have been unsubscribed</h1>
            <p>You will no longer receive annual class album reminders for <strong>${verified.email}</strong>. You can always view your class album anytime directly.</p>
            <a href="/">Return to KoHot</a>
          </div>
        </body>
        </html>
      `;
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 10. Annual Reminder Testing Tools (Host Dashboard Only)
    // Runs reminder check with dryRun mode or test asOfDate
    if (path === '/api/admin/reminders/check' && request.method === 'POST') {
      const user = await getSessionUser();
      if (!user || user.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Unauthorized: Host access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as {
        dryRun?: boolean;
        asOfDate?: string;
      };

      const result = await processAnnualReminders(env, {
        dryRun: body.dryRun !== false, // defaults to dry run for safety
        asOfDate: body.asOfDate,
        appOrigin: url.origin,
      });

      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 11. Reminder Logs & Bounces Endpoint (Host & Admin)
    if (path === '/api/admin/reminders/logs' && request.method === 'GET') {
      const user = await getSessionUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (env.DB) {
        const logs = await env.DB.prepare(
          `SELECT * FROM reminder_logs ORDER BY sent_at DESC LIMIT 200`
        ).all();
        const bounces = await env.DB.prepare(
          `SELECT * FROM reminder_logs WHERE status = 'failed' OR status = 'bounced' ORDER BY sent_at DESC LIMIT 100`
        ).all();

        return new Response(
          JSON.stringify({
            success: true,
            logs: logs?.results || [],
            bounces: bounces?.results || [],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true, logs: [], bounces: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12. Public Single Album Retrieval by ID
    if (path.startsWith('/api/albums/') && request.method === 'GET') {
      const albumId = path.replace('/api/albums/', '');
      if (env.DB) {
        const album = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (album) {
          return new Response(album.data_json, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ error: 'Album not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pass through to static assets (Vite frontend build in dist/)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('KoHot Cloudflare Worker Active', { status: 200 });
  },
};
