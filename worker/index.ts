/**
 * Cloudflare Worker API for KoHot
 * Endpoints for Google Auth, Paystack Payment Verification, D1 Database Persistence,
 * Support Inbox, Annual Album Reminders (Resend + Cloudflare provider TODO), and RBAC
 */

export interface Env {
  DB?: any; // Cloudflare D1 Database binding
  BUCKET?: any; // Cloudflare R2 Bucket binding
  MEDIA?: any; // Local dev media binding
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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRandomHexToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sanitizePublicAlbum(rawAlbum: any): any {
  if (!rawAlbum || typeof rawAlbum !== 'object') return rawAlbum;
  const copy = { ...rawAlbum };
  delete copy.invitePin;
  delete copy.studentSubmissionToken;
  delete copy.adminPhone;
  delete copy.classRepPhone;
  if (Array.isArray(copy.students)) {
    copy.students = copy.students
      .filter((s: any) => !s.status || s.status === 'approved')
      .map((s: any) => {
        const sc = { ...s };
        if (!sc.contactVisible) {
          delete sc.personalEmail;
          delete sc.whatsapp;
        }
        delete sc.dobDay;
        delete sc.dobMonth;
        return sc;
      });
  }
  return copy;
}

async function getPlatformSettingsMap(env: Env): Promise<Record<string, string>> {
  const defaults: Record<string, string> = {
    student_fee_kobo: '50000',
    min_funded_to_publish: '10',
    profile_cap_default: '200',
    reinstate_days: '7',
    draft_retention_days: '30',
    gate_mode: 'publish',
    default_kohot_slots_per_album: '0',
  };
  if (!env.DB) return defaults;
  try {
    const res = await env.DB.prepare(`SELECT key, value FROM platform_settings`).all();
    for (const r of res?.results || []) {
      if (r && r.key) defaults[String(r.key)] = String(r.value);
    }
  } catch {}
  return defaults;
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
let cachedFirebaseCerts: { keys: any[]; expiresAt: number } | null = null;
let cachedAppleCerts: { keys: any[]; expiresAt: number } | null = null;

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

async function getFirebasePublicKeys(): Promise<any[]> {
  const now = Date.now();
  if (cachedFirebaseCerts && cachedFirebaseCerts.expiresAt > now) {
    return cachedFirebaseCerts.keys;
  }
  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('Failed to fetch Firebase SecureToken public keys');
  }
  const data = (await res.json()) as { keys: any[] };
  cachedFirebaseCerts = { keys: data.keys, expiresAt: now + 3600 * 1000 };
  return data.keys;
}

async function getApplePublicKeys(): Promise<any[]> {
  const now = Date.now();
  if (cachedAppleCerts && cachedAppleCerts.expiresAt > now) {
    return cachedAppleCerts.keys;
  }
  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) {
    throw new Error('Failed to fetch Apple public keys');
  }
  const data = (await res.json()) as { keys: any[] };
  cachedAppleCerts = { keys: data.keys, expiresAt: now + 3600 * 1000 };
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

  // Determine key source based on issuer (Google OAuth vs Firebase SecureToken vs Apple ID)
  const iss = String(payload.iss || '');
  const isFirebaseToken = iss.startsWith('https://securetoken.google.com/');
  const isAppleToken = iss === 'https://appleid.apple.com';

  // 1. Signature verification against provider public keys
  try {
    const keys = isFirebaseToken
      ? await getFirebasePublicKeys()
      : isAppleToken
      ? await getApplePublicKeys()
      : await getGooglePublicKeys();
    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) {
      return { valid: false, errorCode: 'token_invalid', reason: `No matching key ID (${header.kid}) found in provider certs` };
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

  // 2. Issuer & Audience check
  if (isFirebaseToken) {
    const expectedFirebaseProject = 'gen-lang-client-0472872006';
    if (
      payload.aud !== expectedFirebaseProject &&
      payload.aud !== expectedClientId &&
      !String(payload.aud || '').startsWith('688826683374')
    ) {
      return { valid: false, errorCode: 'audience_mismatch', reason: `Firebase audience mismatch: ${payload.aud}` };
    }
  } else if (isAppleToken) {
    // Apple token verified against Apple's JWK
  } else {
    const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return { valid: false, errorCode: 'token_invalid', reason: `Invalid issuer: ${payload.iss}` };
    }
    const audStr = String(payload.aud || '');
    if (
      audStr !== expectedClientId &&
      audStr !== 'gen-lang-client-0472872006' &&
      !audStr.endsWith('.apps.googleusercontent.com')
    ) {
      console.error(`[GoogleAuth] audience_mismatch: received aud="${payload.aud}", expected aud="${expectedClientId}"`);
      return { valid: false, errorCode: 'audience_mismatch', reason: `Audience mismatch: received ${payload.aud}, expected ${expectedClientId}` };
    }
  }

  // 3. Expiration check
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    return { valid: false, errorCode: 'token_expired', reason: `Token expired at ${payload.exp}, current time ${nowSec}` };
  }

  // 4. email_verified check
  if (payload.email && payload.email_verified === false) {
    return { valid: false, errorCode: 'email_not_verified', reason: 'Email is not marked as verified' };
  }

  return { valid: true, payload };
}

export async function verifyGoogleAccessToken(accessToken: string, expectedClientId: string): Promise<GoogleVerifyResult> {
  try {
    const [tokenInfoRes, userInfoRes] = await Promise.all([
      fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`),
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    if (!tokenInfoRes.ok && !userInfoRes.ok) {
      return { valid: false, errorCode: 'token_invalid', reason: 'Google access token rejected by Google OAuth2 endpoint' };
    }

    const tokenInfo = tokenInfoRes.ok ? ((await tokenInfoRes.json()) as any) : {};
    const userInfo = userInfoRes.ok ? ((await userInfoRes.json()) as any) : {};

    const audStr = String(tokenInfo.aud || tokenInfo.azp || '');
    if (
      expectedClientId &&
      audStr &&
      audStr !== expectedClientId &&
      !audStr.endsWith('.apps.googleusercontent.com')
    ) {
      return {
        valid: false,
        errorCode: 'audience_mismatch',
        reason: `Access token audience mismatch: got ${audStr}, expected ${expectedClientId}`,
      };
    }

    if (userInfo.email_verified !== true && userInfo.email_verified !== 'true' && tokenInfo.email_verified !== 'true') {
      return { valid: false, errorCode: 'email_not_verified', reason: 'Google account email is not verified' };
    }

    return {
      valid: true,
      payload: {
        email: userInfo.email || tokenInfo.email,
        name: userInfo.name || userInfo.given_name || 'Album Admin',
        picture: userInfo.picture || '',
        email_verified: true,
        sub: userInfo.sub || tokenInfo.sub,
      },
    };
  } catch (err: any) {
    return { valid: false, errorCode: 'token_invalid', reason: `Failed to verify access token: ${err.message}` };
  }
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

    // Helper: get current authenticated user from session (supports Bearer header for iframes + Cookie)
    const getSessionUser = async () => {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.slice(7).trim();
        if (bearerToken) {
          const verifiedBearer = await verifySessionToken(bearerToken, sessionSecret);
          if (verifiedBearer) return verifiedBearer;
        }
      }
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

    // 0b. Unpublish / Republish Album (Admin owner or Host)
    const unpublishMatch = path.match(/^\/api\/albums\/([^/]+)\/unpublish$/);
    if (unpublishMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(unpublishMatch[1]);
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = await request.json().catch(() => ({})) as any;
      const isUnpublished = body.unpublished !== false;
      const actorEmail = sessionUser.email;

      if (env.DB) {
        const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (albumRow) {
          const isOwner = String(albumRow.admin_user_id || '').toLowerCase() === actorEmail.toLowerCase();
          if (!isOwner && sessionUser.role !== 'master_host') {
            return new Response(JSON.stringify({ error: 'Forbidden: You do not own this album' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          const nextStatus = isUnpublished ? 'unpublished' : 'published';
          let parsed: any = {};
          try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
          parsed.unpublished = isUnpublished;
          parsed.published = !isUnpublished;
          parsed.lifecycleStatus = nextStatus;
          parsed.version = (Number(parsed.version) || 1) + 1;
          await env.DB.prepare(
            `UPDATE class_sets SET status = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(nextStatus, JSON.stringify(parsed), albumId).run();
        }
      }

      await logAudit(
        isUnpublished ? 'album_unpublished' : 'album_republished',
        `Album ${albumId} ${isUnpublished ? 'unpublished' : 'republished'} by ${actorEmail}`,
        actorEmail
      );

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
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = await request.json().catch(() => ({})) as any;
      const reason = (body.reason || '').trim();

      if (!reason) {
        return new Response(JSON.stringify({ error: 'Reason required for deletion request.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const actorEmail = sessionUser.email;
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

    // 0d. Soft Delete Album (Admin owner or Host, sets deletedAt, recoverable for 30 days)
    const softDeleteMatch = path.match(/^\/api\/albums\/([^/]+)\/delete$/);
    if (softDeleteMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(softDeleteMatch[1]);
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const actorEmail = sessionUser.email;
      const deletedAt = new Date().toISOString();

      if (env.DB) {
        const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (albumRow) {
          const isOwner = String(albumRow.admin_user_id || '').toLowerCase() === actorEmail.toLowerCase();
          if (!isOwner && sessionUser.role !== 'master_host') {
            return new Response(JSON.stringify({ error: 'Forbidden: You do not own this album' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          let parsed: any = {};
          try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
          parsed.deletedAt = deletedAt;
          parsed.published = false;
          parsed.lifecycleStatus = 'deleted';
          parsed.version = (Number(parsed.version) || 1) + 1;
          await env.DB.prepare(
            `UPDATE class_sets SET status = 'deleted', data_json = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(JSON.stringify(parsed), albumId).run();
        }
      }

      await logAudit(
        'album_soft_deleted',
        `Album ${albumId} soft-deleted by ${actorEmail}. Retained for 30 days.`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true, deletedAt }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0e. Restore Soft-Deleted Album (Admin owner within 30 days or Host)
    const restoreMatch = path.match(/^\/api\/albums\/([^/]+)\/restore$/);
    if (restoreMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(restoreMatch[1]);
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const actorEmail = sessionUser.email;

      if (env.DB) {
        const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (albumRow) {
          const isOwner = String(albumRow.admin_user_id || '').toLowerCase() === actorEmail.toLowerCase();
          if (!isOwner && sessionUser.role !== 'master_host') {
            return new Response(JSON.stringify({ error: 'Forbidden: You do not own this album' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          let parsed: any = {};
          try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
          delete parsed.deletedAt;
          const nextStatus = parsed.published ? 'published' : 'draft';
          parsed.lifecycleStatus = nextStatus;
          parsed.version = (Number(parsed.version) || 1) + 1;
          await env.DB.prepare(
            `UPDATE class_sets SET status = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(nextStatus, JSON.stringify(parsed), albumId).run();
        }
      }

      await logAudit(
        'album_restored',
        `Album ${albumId} restored by ${actorEmail}.`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0f. Permanent Delete Album (Host only)
    const permDeleteMatch = path.match(/^\/api\/albums\/([^/]+)\/delete-permanent$/);
    if (permDeleteMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(permDeleteMatch[1]);
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const actorEmail = sessionUser.email;

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
    const effectiveGoogleClientId = (
      env.GOOGLE_CLIENT_ID ||
      '688826683374-i08rgemf0ghvdabmelefmplju2q0rauh.apps.googleusercontent.com'
    ).trim();

    if (path === '/api/auth/status' && request.method === 'GET') {
      const d1Status = await checkD1Status(env.DB);
      return new Response(
        JSON.stringify({
          googleClientIdSet: Boolean(effectiveGoogleClientId.length > 0),
          sessionSecretSet: Boolean(sessionSecret.length > 0),
          hostEmailSet: Boolean(hostEmail.length > 0),
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
      return new Response(
        JSON.stringify({
          googleClientId: effectiveGoogleClientId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Unified OAuth Verification Endpoint (Google & Apple — Sign In & Auto Account Creation)
    if ((path === '/api/auth/google' || path === '/api/auth/oauth') && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          credential?: string;
          idToken?: string;
          accessToken?: string;
          token?: string;
          provider?: 'google' | 'apple';
          nameHint?: string;
          knownSets?: Array<{
            id: string;
            institutionId: string;
            departmentId: string;
            graduationYear: number;
            classSetName: string;
            classRepName: string;
            classRepEmail: string;
            classRepPhone?: string;
            activationStatus?: string;
          }>;
          knownPendingRequests?: Array<{
            id: string;
            applicantEmail: string;
            status: string;
          }>;
        };

        const idToken = body.credential || body.idToken || body.token;
        const accessToken = body.accessToken;

        if (!idToken && !accessToken) {
          console.error('[OAuth] token_invalid: Missing credential or accessToken in request');
          return new Response(
            JSON.stringify({
              error: 'token_invalid',
              message: 'Sign in failed. Please try again.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Cryptographically verify ID token first; if that fails and accessToken is present, verify accessToken
        let verifyRes = idToken
          ? await verifyGoogleIdToken(idToken, effectiveGoogleClientId)
          : await verifyGoogleAccessToken(accessToken!, effectiveGoogleClientId);

        if (!verifyRes.valid && accessToken && idToken) {
          verifyRes = await verifyGoogleAccessToken(accessToken, effectiveGoogleClientId);
        }

        if (!verifyRes.valid) {
          console.error(`[OAuth] ${verifyRes.errorCode}: ${verifyRes.reason}`);
          return new Response(
            JSON.stringify({
              error: verifyRes.errorCode,
              message: 'Sign in failed. Please try again.',
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const payload = verifyRes.payload;
        const userEmail = (payload.email || '').trim().toLowerCase();
        const userName = payload.name || payload.given_name || body.nameHint || userEmail.split('@')[0] || 'Class Admin';
        const userAvatar = payload.picture || '';

        if (!userEmail) {
          return new Response(
            JSON.stringify({
              error: 'email_not_verified',
              message: 'Could not retrieve a verified email address from your account.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Always generate a verified signupToken so authenticated users can also register albums seamlessly
        const signupToken = await createSignupToken(userEmail, userName, sessionSecret);

        // Automatically ensure user account exists in D1 if D1 is bound
        const d1Status = await checkD1Status(env.DB);
        if (d1Status.reachable && d1Status.tablesPresent) {
          try {
            const roleForDb = userEmail === hostEmail.trim().toLowerCase() ? 'master_host' : 'class_rep';
            await env.DB.prepare(
              `INSERT OR IGNORE INTO users (id, email, full_name, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
            )
              .bind(`usr-${Date.now()}`, userEmail, userName, roleForDb)
              .run();
          } catch {}
        }

        // 1. Role determination: Master Host check strictly from verified email
        if (userEmail === hostEmail.trim().toLowerCase()) {
          const hostUser = {
            id: 'usr-host',
            email: hostEmail,
            fullName: userName && userName !== 'Class Admin' ? userName : 'Seyi Dan',
            phone: '09036872687',
            role: 'master_host',
            avatar: userAvatar,
            avatarUrl: userAvatar,
          };
          const sessionToken = await createSessionToken(hostUser, sessionSecret);
          return new Response(JSON.stringify({ success: true, user: hostUser, signupToken, sessionToken }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Set-Cookie': `kohot_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`,
            },
          });
        }

        // 2. Gather registrations from D1 (if available) + client-known sets/requests
        let activeAlbums: Array<{
          id: string;
          institutionId: string;
          departmentId: string;
          graduationYear: number;
          classSetName: string;
          applicantName: string;
          applicantPhone?: string;
        }> = [];
        let hasPendingRegistration = false;

        if (d1Status.reachable && d1Status.tablesPresent) {
          const regQuery = await env.DB.prepare(
            `SELECT * FROM registrations WHERE LOWER(applicant_email) = ? ORDER BY created_at DESC`
          )
            .bind(userEmail)
            .all();

          const regs = regQuery.results || [];
          const activeRegs = regs.filter((r: any) => r.status === 'active');
          const pendingRegs = regs.filter((r: any) => r.status === 'pending');

          if (activeRegs.length > 0) {
            activeAlbums = activeRegs.map((r: any) => ({
              id: `${r.institution_id}-${r.department_id.replace(/^dept-/, '')}-${r.graduation_year}`,
              institutionId: r.institution_id,
              departmentId: r.department_id,
              graduationYear: r.graduation_year,
              classSetName: r.class_set_name,
              applicantName: r.applicant_name || userName,
              applicantPhone: r.applicant_phone || '',
            }));
          }
          if (pendingRegs.length > 0) {
            hasPendingRegistration = true;
          }
        }

        // Also check client-known active sets and pending founding requests (for local/hybrid storage)
        if (Array.isArray(body.knownSets)) {
          const matchingSets = body.knownSets.filter(
            (s) =>
              s.classRepEmail &&
              s.classRepEmail.trim().toLowerCase() === userEmail &&
              s.activationStatus !== 'pending_verification'
          );
          for (const s of matchingSets) {
            if (!activeAlbums.some((a) => a.id === s.id)) {
              activeAlbums.push({
                id: s.id,
                institutionId: s.institutionId,
                departmentId: s.departmentId,
                graduationYear: s.graduationYear,
                classSetName: s.classSetName,
                applicantName: s.classRepName || userName,
                applicantPhone: s.classRepPhone || '',
              });
            }
          }
        }

        if (Array.isArray(body.knownPendingRequests)) {
          const matchingPending = body.knownPendingRequests.some(
            (r) =>
              r.applicantEmail &&
              r.applicantEmail.trim().toLowerCase() === userEmail &&
              r.status === 'Pending'
          );
          if (matchingPending) {
            hasPendingRegistration = true;
          }
        }

        // 3. Existing User with Active Class Album(s) -> Sign in as Class Rep
        if (activeAlbums.length > 0) {
          const primaryAlbum = activeAlbums[0];
          const adminUser = {
            id: `usr-${primaryAlbum.id}`,
            email: userEmail,
            fullName: primaryAlbum.applicantName || userName,
            phone: primaryAlbum.applicantPhone || '',
            role: 'class_rep',
            assignedSetId: primaryAlbum.id,
            avatar: userAvatar,
            avatarUrl: userAvatar,
            albums: activeAlbums.map((a) => a.id),
          };

          const sessionToken = await createSessionToken(adminUser, sessionSecret);
          return new Response(
            JSON.stringify({
              success: true,
              user: adminUser,
              signupToken,
              sessionToken,
              albums: activeAlbums.length > 1 ? activeAlbums : undefined,
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Set-Cookie': `kohot_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`,
              },
            }
          );
        }

        // 4. Existing User with Pending Founding Class Approval -> Preserve Role Approval Gate
        if (hasPendingRegistration) {
          console.error('[OAuth] registration_pending: Registration awaiting approval');
          return new Response(
            JSON.stringify({
              error: 'registration_pending',
              message: 'Your registration is awaiting approval.',
              signupToken,
              email: userEmail,
              name: userName,
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 5. No Class Album Registered for this Email -> Do NOT auto-login to a demo album dashboard
        return new Response(
          JSON.stringify({
            success: false,
            error: 'no_registration',
            message: 'No class album is registered under this account yet. Use Create Class Album to register your graduating class.',
            signupToken,
            email: userEmail,
            name: userName,
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        console.error(`[OAuth] token_invalid: Exception during auth verification: ${err.message}`);
        return new Response(
          JSON.stringify({
            error: 'token_invalid',
            message: 'Sign in failed. Please try again.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1b. OAuth Signup Token Generator (Short-lived signed token containing verified email from Google or Apple)
    if (path === '/api/auth/google-signup-token' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          credential?: string;
          idToken?: string;
          accessToken?: string;
          token?: string;
          nameHint?: string;
        };
        const idToken = body.credential || body.idToken || body.token;
        const accessToken = body.accessToken;

        if (!idToken && !accessToken) {
          return new Response(
            JSON.stringify({ error: 'token_invalid', message: 'Missing OAuth credential' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let verifyRes = idToken
          ? await verifyGoogleIdToken(idToken, effectiveGoogleClientId)
          : await verifyGoogleAccessToken(accessToken!, effectiveGoogleClientId);

        if (!verifyRes.valid && accessToken && idToken) {
          verifyRes = await verifyGoogleAccessToken(accessToken, effectiveGoogleClientId);
        }

        if (!verifyRes.valid) {
          console.error(`[OAuth] signup token verification failed: ${verifyRes.errorCode}`);
          return new Response(
            JSON.stringify({
              error: verifyRes.errorCode,
              message: 'Account verification failed. Please try again.',
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const payload = verifyRes.payload;
        const verifiedEmail = (payload.email || '').trim().toLowerCase();
        const verifiedName = payload.name || payload.given_name || body.nameHint || verifiedEmail.split('@')[0] || 'Class Admin';

        // Automatically create user record in D1 if reachable
        const d1Status = await checkD1Status(env.DB);
        if (d1Status.reachable && d1Status.tablesPresent) {
          try {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO users (id, email, full_name, role, created_at) VALUES (?, ?, ?, 'class_rep', datetime('now'))`
            )
              .bind(`usr-${Date.now()}`, verifiedEmail, verifiedName)
              .run();
          } catch {}
        }

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
        console.error(`[OAuth] signup token generation error: ${err.message}`);
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

    // ============================================================================
    // 12. D1 PERSISTENCE ROUTES: ALBUMS, INSTITUTIONS, TRANSACTIONS, TESTIMONIALS, SITE CONTENT
    // ============================================================================

    // 12a. GET /api/albums — Role-filtered Album List
    // Public: only published albums & public fields
    // Admin: only the album(s) they own (admin_user_id === session user)
    // Host: all albums in D1
    if (path === '/api/albums' && request.method === 'GET') {
      const sessionUser = await getSessionUser();
      const albums: any[] = [];
      if (env.DB) {
        const res = await env.DB.prepare(`SELECT * FROM class_sets ORDER BY created_at DESC`).all();
        for (const row of res?.results || []) {
          let parsed: any = null;
          try {
            parsed = JSON.parse(row.data_json || '{}');
          } catch {
            continue;
          }
          if (!parsed || !parsed.id) continue;
          const rowStatus = String(row.status || parsed.lifecycleStatus || (parsed.deletedAt ? 'deleted' : parsed.unpublished ? 'unpublished' : parsed.published ? 'published' : 'draft'));
          parsed.lifecycleStatus = rowStatus;
          parsed.version = Number(parsed.version) || 1;

          const ownerEmail = String(row.admin_user_id || parsed.classRepEmail || '').toLowerCase();

          if (sessionUser?.role === 'master_host') {
            albums.push(parsed);
          } else if (sessionUser && ownerEmail && ownerEmail === sessionUser.email.toLowerCase()) {
            albums.push(parsed);
          } else {
            // Public visitor (or admin viewing non-owned albums): only published and non-deleted
            const isPublished = (rowStatus === 'published' || (rowStatus === 'active' && parsed.published === true)) && !parsed.unpublished && !parsed.deletedAt;
            if (isPublished) {
              albums.push(sanitizePublicAlbum(parsed));
            }
          }
        }
      }
      return new Response(JSON.stringify({ success: true, albums }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12b. POST /api/albums — Free Google Sign-Up Album Creation (Creates Draft Album)
    if (path === '/api/albums' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const sessionUser = await getSessionUser();
      let verifiedEmail = sessionUser?.email || '';
      let verifiedName = sessionUser?.fullName || body.adminName || '';

      if (body.signupToken) {
        const tokenPayload = await verifySignupToken(body.signupToken, sessionSecret);
        if (!tokenPayload || !tokenPayload.email) {
          return new Response(JSON.stringify({ error: 'Invalid or expired Google sign-up session. Please sign in with Google again.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        verifiedEmail = String(tokenPayload.email).toLowerCase().trim();
        verifiedName = tokenPayload.name || verifiedName;
      }

      if (!verifiedEmail) {
        return new Response(JSON.stringify({ error: 'Google sign-up verification is required.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const albumPayload = body.album || {};
      const institutionId = String(albumPayload.universityId || body.institutionId || '').trim();
      const departmentId = String(albumPayload.departmentId || body.departmentId || '').trim();
      const graduationYear = Number(albumPayload.graduationYear || body.graduationYear || new Date().getFullYear());

      if (!institutionId || !departmentId || !graduationYear) {
        return new Response(JSON.stringify({ error: 'Institution, department, and graduation year are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (env.DB) {
        const allSetsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
        const allRows = allSetsRes?.results || [];

        // Rule 1 & 5: One album per Google email at launch. If email already has an album, return it so dashboard opens immediately.
        const existingOwnedRow = allRows.find(
          (r: any) => String(r.admin_user_id || '').toLowerCase() === verifiedEmail.toLowerCase()
        );
        if (existingOwnedRow) {
          let existingAlbum: any = {};
          try { existingAlbum = JSON.parse(existingOwnedRow.data_json || '{}'); } catch {}
          const role = verifiedEmail.toLowerCase() === hostEmail ? 'master_host' : 'class_rep';
          const sessionToken = await createSessionToken(
            {
              id: `usr-${verifiedEmail.toLowerCase()}`,
              email: verifiedEmail.toLowerCase(),
              fullName: existingAlbum.classRepName || verifiedName || verifiedEmail.split('@')[0],
              role,
              assignedSetId: existingOwnedRow.id,
              exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
            },
            sessionSecret
          );
          return new Response(
            JSON.stringify({
              success: true,
              alreadyExists: true,
              album: existingAlbum,
              user: {
                id: `usr-${verifiedEmail.toLowerCase()}`,
                email: verifiedEmail.toLowerCase(),
                fullName: existingAlbum.classRepName || verifiedName || verifiedEmail.split('@')[0],
                role,
                assignedSetId: existingOwnedRow.id,
              },
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Set-Cookie': `kohot_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
              },
            }
          );
        }

        // Rule 6: Duplicate institution + department + year is blocked on the server with "Report a dispute" option
        const duplicateRow = allRows.find(
          (r: any) =>
            String(r.institution_id).toLowerCase() === institutionId.toLowerCase() &&
            String(r.department_id).toLowerCase() === departmentId.toLowerCase() &&
            Number(r.graduation_year) === graduationYear &&
            r.status !== 'deleted'
        );
        if (duplicateRow) {
          return new Response(
            JSON.stringify({
              error: 'duplicate_class_album',
              message: 'A class album for this institution, department, and graduation year is already registered.',
              canDispute: true,
              existingAlbumId: duplicateRow.id,
            }),
            {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const newAlbumId = String(albumPayload.id || `set-${institutionId}-${departmentId}-${graduationYear}-${Date.now()}`);
        const nowIso = new Date().toISOString();

        // Rule 4 & 8: Check for a KoHot slot allocation matching institution, department, and graduation year, and credit once
        let creditedSlots = 0;
        let creditedAllocationId: string | null = null;
        const allocRows = await env.DB.prepare(
          `SELECT * FROM slot_allocations WHERE institution_id = ? AND department_id = ? AND graduation_year = ?`
        ).bind(institutionId, departmentId, graduationYear).all();
        const waitingAlloc = (allocRows?.results || []).find((a: any) => a.status === 'waiting' && Number(a.quantity) > 0);

        if (waitingAlloc) {
          creditedSlots = Number(waitingAlloc.quantity) || 0;
          creditedAllocationId = waitingAlloc.id;
          await env.DB.prepare(
            `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
             VALUES (?, ?, ?, 'kohot_allocation', ?, 'KoHot', 0, ?, 'system', datetime('now'))`
          ).bind(
            `sled-alloc-${waitingAlloc.id}`,
            newAlbumId,
            creditedSlots,
            waitingAlloc.id,
            `alloc:${waitingAlloc.id}`
          ).run();

          await env.DB.prepare(
            `UPDATE slot_allocations SET status = 'credited', album_id = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(newAlbumId, waitingAlloc.id).run();
        } else {
          const settings = await getPlatformSettingsMap(env);
          const defaultSlots = Number(settings.default_kohot_slots_per_album) || 0;
          if (defaultSlots > 0) {
            creditedSlots = defaultSlots;
            await env.DB.prepare(
              `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
               VALUES (?, ?, ?, 'kohot_allocation', 'KoHot', 0, ?, 'system', datetime('now'))`
            ).bind(
              `sled-def-${newAlbumId}`,
              newAlbumId,
              defaultSlots,
              `default_alloc:${newAlbumId}`
            ).run();
          }
        }

        const initialSponsors = Array.isArray(albumPayload.sponsors) ? [...albumPayload.sponsors] : [];
        if (creditedSlots > 0 && !initialSponsors.some((s: any) => s.sponsorName === 'KoHot')) {
          initialSponsors.unshift({
            id: creditedAllocationId || `sp-kohot-${newAlbumId}`,
            sponsorName: 'KoHot',
            DisplayLabel: 'Sponsored by KoHot',
            quantity: creditedSlots,
            amountPaid: 0,
            reference: `KOHOT-ALLOC-${graduationYear}`,
            date: nowIso.split('T')[0],
            showSponsorNameOnAlbum: true,
            isKoHotCredit: true,
          });
        }

        const draftAlbum = {
          ...albumPayload,
          id: newAlbumId,
          universityId: institutionId,
          departmentId,
          graduationYear,
          classRepEmail: verifiedEmail,
          classRepName: albumPayload.classRepName || verifiedName || verifiedEmail.split('@')[0],
          published: false,
          unpublished: false,
          lifecycleStatus: 'draft',
          version: 1,
          profileSlotBalance: creditedSlots,
          totalSlotsCredited: creditedSlots,
          totalSlotsUsed: 0,
          sponsors: initialSponsors,
          createdAt: nowIso,
        };

        await env.DB.prepare(
          `INSERT OR REPLACE INTO users (id, email, full_name, phone, role, created_at) VALUES (?, ?, ?, ?, 'class_rep', datetime('now'))`
        ).bind(
          `usr-${verifiedEmail}`,
          verifiedEmail,
          draftAlbum.classRepName,
          draftAlbum.classRepPhone || ''
        ).run();

        await env.DB.prepare(
          `INSERT INTO class_sets (id, institution_id, department_id, graduation_year, title, admin_user_id, data_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
        ).bind(
          newAlbumId,
          institutionId,
          departmentId,
          graduationYear,
          draftAlbum.CohortLabel || `Class of ${graduationYear}`,
          verifiedEmail,
          JSON.stringify(draftAlbum)
        ).run();

        // Also seed admin's own profile in profile_submissions if present in students[0]
        if (Array.isArray(draftAlbum.students) && draftAlbum.students.length > 0) {
          const adminProfile = draftAlbum.students[0];
          await env.DB.prepare(
            `INSERT OR IGNORE INTO profile_submissions (id, album_id, payload_json, email, consent_at, source, payment_status, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'), 'admin', 'waived', 'approved', datetime('now'), datetime('now'))`
          ).bind(
            adminProfile.id || `prof-admin-${newAlbumId}`,
            newAlbumId,
            JSON.stringify({ ...adminProfile, isAdminProfile: true }),
            verifiedEmail
          ).run();
        }

        await logAudit(
          'album_created_draft',
          `Free draft album ${newAlbumId} created by ${verifiedEmail} (${institutionId} / ${departmentId} / ${graduationYear}). Credited slots: ${creditedSlots}`,
          verifiedEmail
        );

        const role = verifiedEmail.toLowerCase() === hostEmail ? 'master_host' : 'class_rep';
        const sessionToken = await createSessionToken(
          {
            id: `usr-${verifiedEmail}`,
            email: verifiedEmail,
            fullName: draftAlbum.classRepName,
            role,
            assignedSetId: newAlbumId,
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
          },
          sessionSecret
        );

        return new Response(
          JSON.stringify({
            success: true,
            album: draftAlbum,
            version: 1,
            creditedSlots,
            user: {
              id: `usr-${verifiedEmail}`,
              email: verifiedEmail,
              fullName: draftAlbum.classRepName,
              role,
              assignedSetId: newAlbumId,
            },
          }),
          {
            status: 201,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Set-Cookie': `kohot_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
            },
          }
        );
      }

      return new Response(JSON.stringify({ error: 'Database unavailable' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12c. PUT /api/albums/:id — Save Album with Ownership & Optimistic Version Check
    const putAlbumMatch = path.match(/^\/api\/albums\/([^/]+)$/);
    if (putAlbumMatch && request.method === 'PUT') {
      const albumId = decodeURIComponent(putAlbumMatch[1]);
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as any;
      const incomingAlbum = body.album || body;

      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const existingRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
      if (!existingRow) {
        return new Response(JSON.stringify({ error: 'Album not found in D1' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let existingData: any = {};
      try { existingData = JSON.parse(existingRow.data_json || '{}'); } catch {}

      const ownerEmail = String(existingRow.admin_user_id || existingData.classRepEmail || '').toLowerCase();
      const requesterEmail = sessionUser.email.toLowerCase();

      // Host rule: Host reads everything, edits no album content (except keepByHost retention flag)
      if (sessionUser.role === 'master_host' && ownerEmail !== requesterEmail) {
        if (body.hostOnlyRetentionUpdate || incomingAlbum.keepByHost !== existingData.keepByHost) {
          existingData.keepByHost = Boolean(incomingAlbum.keepByHost);
          existingData.version = (Number(existingData.version) || 1) + 1;
          await env.DB.prepare(
            `UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(JSON.stringify(existingData), albumId).run();
          return new Response(JSON.stringify({ success: true, version: existingData.version, album: existingData }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Forbidden: Host reads everything and edits no album content.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Admin ownership rule: admin_user_id must equal session user
      if (ownerEmail !== requesterEmail) {
        return new Response(JSON.stringify({ error: 'Forbidden: You can only read and save the album you own.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Version check: reject stale saves with 409 Conflict
      const currentVersion = Number(existingData.version) || 1;
      const clientVersion = body.version !== undefined ? Number(body.version) : (incomingAlbum.version !== undefined ? Number(incomingAlbum.version) : currentVersion);
      if (clientVersion !== currentVersion) {
        return new Response(
          JSON.stringify({
            error: 'version_conflict',
            message: 'Conflict: This album has a newer version on the server. Please reload before saving.',
            currentVersion,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Protect KoHot sponsor credit and immutable sponsor fields (amountPaid, quantity, reference)
      if (Array.isArray(existingData.sponsors)) {
        const existingSponsors = existingData.sponsors;
        const incomingSponsors = Array.isArray(incomingAlbum.sponsors) ? incomingAlbum.sponsors : existingSponsors;
        const mergedSponsors = existingSponsors.map((oldSp: any) => {
          const match = incomingSponsors.find((s: any) => s.id === oldSp.id || s.reference === oldSp.reference);
          const isKoHot = oldSp.isKoHotCredit || oldSp.sponsorName === 'KoHot' || String(oldSp.reference || '').startsWith('KOHOT-ALLOC');
          if (isKoHot) {
            return {
              ...oldSp,
              sponsorName: 'KoHot',
              DisplayLabel: 'Sponsored by KoHot',
              showSponsorNameOnAlbum: true,
              isKoHotCredit: true,
            };
          }
          if (!match) return oldSp;
          if (match.sponsorName !== oldSp.sponsorName) {
            logAudit(
              'sponsor_name_edited',
              `Sponsor name on ${albumId} changed from "${oldSp.sponsorName}" to "${match.sponsorName}" by ${requesterEmail}`,
              requesterEmail
            );
          }
          return {
            ...oldSp,
            sponsorName: match.sponsorName || oldSp.sponsorName,
            DisplayLabel: match.DisplayLabel || oldSp.DisplayLabel,
            showSponsorNameOnAlbum: match.showSponsorNameOnAlbum ?? oldSp.showSponsorNameOnAlbum,
            // Never change amount, quantity, or reference
            amountPaid: oldSp.amountPaid,
            quantity: oldSp.quantity,
            reference: oldSp.reference,
          };
        });
        // Add any genuinely new sponsors
        for (const inc of incomingSponsors) {
          if (!mergedSponsors.some((m: any) => m.id === inc.id || m.reference === inc.reference)) {
            mergedSponsors.push(inc);
          }
        }
        incomingAlbum.sponsors = mergedSponsors;
      }

      const nextVersion = currentVersion + 1;
      const nextStatus = incomingAlbum.deletedAt
        ? 'deleted'
        : incomingAlbum.unpublished
        ? 'unpublished'
        : incomingAlbum.published
        ? 'published'
        : 'draft';

      const updatedAlbum = {
        ...existingData,
        ...incomingAlbum,
        id: albumId,
        classRepEmail: existingRow.admin_user_id || existingData.classRepEmail,
        lifecycleStatus: nextStatus,
        version: nextVersion,
      };

      await env.DB.prepare(
        `UPDATE class_sets SET title = ?, status = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(
        updatedAlbum.CohortLabel || existingRow.title,
        nextStatus,
        JSON.stringify(updatedAlbum),
        albumId
      ).run();

      return new Response(
        JSON.stringify({
          success: true,
          version: nextVersion,
          album: updatedAlbum,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 12d. Institutions Directory Routes (GET public, PUT Host only)
    if (path === '/api/institutions' && request.method === 'GET') {
      const institutions: any[] = [];
      if (env.DB) {
        const res = await env.DB.prepare(`SELECT * FROM institutions`).all();
        for (const row of res?.results || []) {
          try {
            const parsed = JSON.parse(row.departments_json || '{}');
            if (parsed && parsed.id) {
              institutions.push(parsed);
            } else {
              institutions.push({
                id: row.id,
                name: row.name,
                shortName: row.short_name,
                type: row.type,
                location: row.location,
                logoUrl: row.logo_url,
                departments: Array.isArray(parsed) ? parsed : [],
              });
            }
          } catch {}
        }
      }
      return new Response(JSON.stringify({ success: true, institutions }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/institutions' && request.method === 'PUT') {
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const list = Array.isArray(body.institutions) ? body.institutions : [];
      if (env.DB) {
        for (const uni of list) {
          if (!uni || !uni.id) continue;
          await env.DB.prepare(
            `INSERT OR REPLACE INTO institutions (id, name, short_name, type, location, logo_url, departments_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).bind(
            uni.id,
            uni.name || '',
            uni.shortName || '',
            uni.type || 'Federal',
            uni.location || '',
            uni.logoUrl || '',
            JSON.stringify(uni)
          ).run();
        }
      }
      return new Response(JSON.stringify({ success: true, count: list.length }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12e. Transactions Routes (GET Host/Admin, POST Authenticated)
    if (path === '/api/transactions' && request.method === 'GET') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const transactions: any[] = [];
      if (env.DB) {
        const res = await env.DB.prepare(`SELECT * FROM transactions ORDER BY created_at DESC`).all();
        for (const r of res?.results || []) {
          let meta: any = {};
          try { meta = JSON.parse(r.raw_payload_json || '{}'); } catch {}
          const txItem = {
            id: r.id,
            reference: r.reference,
            universityId: meta.universityId || '',
            universityName: meta.universityName || '',
            departmentId: meta.departmentId || '',
            departmentName: meta.departmentName || '',
            graduationYear: Number(meta.graduationYear) || new Date().getFullYear(),
            amountPaid: Math.round((Number(r.amount_kobo) || 0) / 100),
            paymentMethod: r.channel || meta.paymentMethod || 'Paystack',
            status: r.status === 'success' ? 'Completed' : r.status || 'Completed',
            payerName: meta.payerName || '',
            payerEmail: meta.payerEmail || '',
            date: (r.paid_at || r.created_at || new Date().toISOString()).split('T')[0],
            paymentCategory: meta.paymentCategory || 'slot_purchase',
            slotsPurchased: Number(meta.slotsPurchased) || 0,
            sponsorName: meta.sponsorName || '',
            albumId: meta.albumId || r.registration_id || '',
          };
          if (sessionUser.role === 'master_host' || String(txItem.payerEmail).toLowerCase() === sessionUser.email.toLowerCase()) {
            transactions.push(txItem);
          }
        }
      }
      return new Response(JSON.stringify({ success: true, transactions }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/transactions' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const tx = body.transaction || body;
      if (env.DB && tx && tx.reference) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO transactions (id, registration_id, reference, amount_kobo, currency, status, channel, paid_at, raw_payload_json, created_at)
           VALUES (?, ?, ?, ?, 'NGN', 'success', ?, datetime('now'), ?, datetime('now'))`
        ).bind(
          tx.id || `tx-${Date.now()}`,
          tx.albumId || '',
          tx.reference,
          (Number(tx.amountPaid) || 0) * 100,
          tx.paymentMethod || 'Paystack',
          JSON.stringify(tx)
        ).run();
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12f. Testimonials Routes (GET Public/Host/Admin, POST Admin, PUT Host)
    if (path === '/api/testimonials' && request.method === 'GET') {
      const sessionUser = await getSessionUser();
      const testimonials: any[] = [];
      if (env.DB) {
        const res = await env.DB.prepare(`SELECT * FROM testimonials ORDER BY display_order ASC`).all();
        for (const r of res?.results || []) {
          const item = {
            id: r.id,
            albumId: r.album_id,
            submittedByUserId: r.submitted_by_user_id,
            adminFullName: r.admin_full_name,
            adminRoleTitle: r.admin_role_title,
            universityName: r.university_name,
            departmentName: r.department_name,
            graduationYear: Number(r.graduation_year),
            cohortLabel: r.cohort_label,
            rating: Number(r.rating) || 5,
            testimonialText: r.testimonial_text,
            adminAvatarUrl: r.admin_avatar_url || '',
            albumCoverUrl: r.album_cover_url || '',
            consentGiven: Boolean(r.consent_given),
            isPublic: Boolean(r.is_public),
            reviewStatus: r.review_status || 'pending',
            isFeatured: Boolean(r.is_featured),
            displayOrder: Number(r.display_order) || 999,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
          if (sessionUser?.role === 'master_host') {
            testimonials.push(item);
          } else if (sessionUser && item.submittedByUserId === sessionUser.email) {
            testimonials.push(item);
          } else if (item.reviewStatus === 'approved' && item.isPublic) {
            testimonials.push(item);
          }
        }
      }
      return new Response(JSON.stringify({ success: true, testimonials }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/testimonials' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const t = body.testimonial || body;
      const id = t.id || `test-${Date.now()}`;
      if (env.DB) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO testimonials (id, album_id, submitted_by_user_id, admin_full_name, admin_role_title, university_name, department_name, graduation_year, cohort_label, rating, testimonial_text, admin_avatar_url, album_cover_url, consent_given, is_public, review_status, is_featured, display_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(
          id,
          t.albumId || '',
          sessionUser.email,
          t.adminFullName || sessionUser.fullName || '',
          t.adminRoleTitle || 'Album Admin',
          t.universityName || '',
          t.departmentName || '',
          Number(t.graduationYear) || new Date().getFullYear(),
          t.cohortLabel || '',
          Number(t.rating) || 5,
          t.testimonialText || '',
          t.adminAvatarUrl || '',
          t.albumCoverUrl || '',
          t.consentGiven ? 1 : 0,
          t.isPublic !== false ? 1 : 0,
          sessionUser.role === 'master_host' ? (t.reviewStatus || 'approved') : 'pending',
          t.isFeatured ? 1 : 0,
          Number(t.displayOrder) || 999
        ).run();
      }
      return new Response(JSON.stringify({ success: true, id }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const putTestimonialMatch = path.match(/^\/api\/testimonials\/([^/]+)$/);
    if (putTestimonialMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
      const testId = decodeURIComponent(putTestimonialMatch[1]);
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (request.method === 'DELETE') {
        if (env.DB) {
          await env.DB.prepare(`DELETE FROM testimonials WHERE id = ?`).bind(testId).run();
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      if (env.DB) {
        const existing = await env.DB.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(testId).first();
        if (existing) {
          await env.DB.prepare(
            `UPDATE testimonials SET review_status = ?, is_featured = ?, is_public = ?, display_order = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(
            body.reviewStatus ?? existing.review_status,
            body.isFeatured !== undefined ? (body.isFeatured ? 1 : 0) : existing.is_featured,
            body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : existing.is_public,
            body.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order,
            testId
          ).run();
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12g. Site Content Overrides Routes (GET Public, PUT Host Only)
    if (path === '/api/site-content' && request.method === 'GET') {
      let content: any = null;
      if (env.DB) {
        const row = await env.DB.prepare(`SELECT * FROM website_content_overrides WHERE id = 'default'`).first();
        if (row && row.data_json) {
          try { content = JSON.parse(row.data_json); } catch {}
        }
        if (!content) {
          const fallback = await env.DB.prepare(`SELECT data_json FROM site_settings WHERE id = 'global_settings'`).first();
          if (fallback && fallback.data_json) {
            try { content = JSON.parse(fallback.data_json); } catch {}
          }
        }
      }
      return new Response(JSON.stringify({ success: true, content }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/site-content' && request.method === 'PUT') {
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const content = body.content || body;
      if (env.DB) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO website_content_overrides (id, data_json, updated_at) VALUES ('default', ?, datetime('now'))`
        ).bind(JSON.stringify(content)).run();
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================================
    // 13. PROFILE SUBMISSIONS & SLOT LEDGER ENGINE
    // ============================================================================

    // Helper to verify album ownership or Host
    const verifyAlbumAccess = async (albumId: string, allowHost = true) => {
      const user = await getSessionUser();
      if (!user) return { allowed: false, status: 401, error: 'Authentication required', user: null, albumRow: null, albumData: null };
      if (!env.DB) return { allowed: false, status: 500, error: 'Database unavailable', user, albumRow: null, albumData: null };
      const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
      if (!albumRow) return { allowed: false, status: 404, error: 'Album not found', user, albumRow: null, albumData: null };
      let albumData: any = {};
      try { albumData = JSON.parse(albumRow.data_json || '{}'); } catch {}
      const ownerEmail = String(albumRow.admin_user_id || albumData.classRepEmail || '').toLowerCase();
      const isOwner = ownerEmail === user.email.toLowerCase();
      const isHost = user.role === 'master_host';
      if (!isOwner && !(allowHost && isHost)) {
        return { allowed: false, status: 403, error: 'Forbidden: You do not own this album', user, albumRow, albumData };
      }
      return { allowed: true, status: 200, error: null, user, albumRow, albumData, isOwner, isHost };
    };

    const getAlbumSlotSummary = async (albumId: string) => {
      if (!env.DB) return { balance: 0, totalCredited: 0, totalUsed: 0, ledger: [], purchases: [] };
      const sumRow = await env.DB.prepare(
        `SELECT SUM(delta) as balance FROM slot_ledger WHERE album_id = ?`
      ).bind(albumId).first();
      const ledgerRes = await env.DB.prepare(
        `SELECT * FROM slot_ledger WHERE album_id = ? ORDER BY created_at DESC`
      ).bind(albumId).all();
      const purchasesRes = await env.DB.prepare(
        `SELECT * FROM slot_purchases WHERE album_id = ? ORDER BY created_at DESC`
      ).bind(albumId).all();
      const ledger = ledgerRes?.results || [];
      const balance = sumRow && sumRow.balance !== undefined && sumRow.balance !== null
        ? Number(sumRow.balance)
        : ledger.reduce((acc: number, r: any) => acc + (Number(r.delta) || 0), 0);
      const totalCredited = ledger.reduce((acc: number, r: any) => acc + (Number(r.delta) > 0 ? Number(r.delta) : 0), 0);
      const totalUsed = ledger.reduce((acc: number, r: any) => acc + (Number(r.delta) < 0 ? Math.abs(Number(r.delta)) : 0), 0);
      return {
        balance,
        totalCredited,
        totalUsed,
        ledger,
        purchases: purchasesRes?.results || [],
      };
    };

    // 13a. GET /api/albums/:albumId/slots/balance
    const slotBalanceMatch = path.match(/^\/api\/albums\/([^/]+)\/slots\/balance$/);
    if (slotBalanceMatch && request.method === 'GET') {
      const albumId = decodeURIComponent(slotBalanceMatch[1]);
      const access = await verifyAlbumAccess(albumId, true);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const summary = await getAlbumSlotSummary(albumId);
      const settings = await getPlatformSettingsMap(env);
      return new Response(
        JSON.stringify({
          success: true,
          ...summary,
          settings,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13b. POST /api/albums/:albumId/slots/purchase
    const slotPurchaseMatch = path.match(/^\/api\/albums\/([^/]+)\/slots\/purchase$/);
    if (slotPurchaseMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(slotPurchaseMatch[1]);
      const body = (await request.json().catch(() => ({}))) as any;
      const quantity = Math.max(1, Number(body.quantity) || 1);
      const reference = String(body.reference || `SLOT-${Date.now()}`).trim();
      const sponsorName = String(body.sponsorName || 'Class Sponsor').trim();
      const settings = await getPlatformSettingsMap(env);
      const unitFeeKobo = Number(settings.student_fee_kobo) || 50000;
      const amountKobo = Number(body.amountKobo) || quantity * unitFeeKobo;

      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const purchaseId = `spurch-${reference}`;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO slot_purchases (id, album_id, quantity, amount_kobo, reference, sponsor_name, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', datetime('now'))`
      ).bind(purchaseId, albumId, quantity, amountKobo, reference, sponsorName).run();

      await env.DB.prepare(
        `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, purchase_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
         VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        `sled-${reference}`,
        albumId,
        quantity,
        purchaseId,
        sponsorName,
        unitFeeKobo,
        `purchase:${reference}`,
        sponsorName
      ).run();

      const summary = await getAlbumSlotSummary(albumId);
      return new Response(
        JSON.stringify({
          success: true,
          purchaseId,
          ...summary,
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13c. PUT /api/albums/:albumId/slots/sponsor — Edit sponsor name only (immutable amount/qty/ref/balance, protect KoHot)
    const slotSponsorMatch = path.match(/^\/api\/albums\/([^/]+)\/slots\/sponsor$/);
    if (slotSponsorMatch && request.method === 'PUT') {
      const albumId = decodeURIComponent(slotSponsorMatch[1]);
      const access = await verifyAlbumAccess(albumId, false);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const ledgerId = body.ledgerId || body.id;
      const newSponsorName = String(body.sponsorName || '').trim();
      if (!newSponsorName) {
        return new Response(JSON.stringify({ error: 'Sponsor name cannot be empty.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ledgerRow = await env.DB.prepare(`SELECT * FROM slot_ledger WHERE id = ? AND album_id = ?`).bind(ledgerId, albumId).first();
      if (ledgerRow) {
        if (ledgerRow.kind === 'kohot_allocation' || ledgerRow.sponsor_name === 'KoHot') {
          return new Response(JSON.stringify({ error: 'cannot_modify_kohot_credit', message: 'KoHot credit cannot be renamed or removed.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const oldName = ledgerRow.sponsor_name;
        await env.DB.prepare(`UPDATE slot_ledger SET sponsor_name = ? WHERE id = ?`).bind(newSponsorName, ledgerId).run();
        if (ledgerRow.purchase_id) {
          await env.DB.prepare(`UPDATE slot_purchases SET sponsor_name = ? WHERE id = ?`).bind(newSponsorName, ledgerRow.purchase_id).run();
        }
        await logAudit(
          'sponsor_edited',
          `Sponsor name updated from "${oldName}" to "${newSponsorName}" on album ${albumId} (amount, quantity, reference, and balance untouched)`,
          access.user.email
        );
      }

      const summary = await getAlbumSlotSummary(albumId);
      return new Response(JSON.stringify({ success: true, ...summary }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 13d. POST /api/albums/:albumId/submissions/submit (and /api/albums/:albumId/profiles)
    const submitProfileMatch = path.match(/^\/api\/albums\/([^/]+)\/(?:submissions\/submit|profiles)$/);
    if (submitProfileMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(submitProfileMatch[1]);
      const body = (await request.json().catch(() => ({}))) as any;
      const profilePayload = body.profile || body.payload || body;
      const source: 'student' | 'admin' = body.source === 'admin' ? 'admin' : 'student';
      const email = String(profilePayload.personalEmail || body.email || '').trim().toLowerCase();

      if (!email) {
        return new Response(JSON.stringify({ error: 'A valid email address is required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (source === 'student' && !body.consent && !profilePayload.consentAt) {
        // Record consent timestamp on student submissions
        profilePayload.consentAt = new Date().toISOString();
      }

      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const settings = await getPlatformSettingsMap(env);
      const profileCap = Number(settings.profile_cap_default) || 200;

      // Check existing submissions for this album
      const existingSubsRes = await env.DB.prepare(
        `SELECT * FROM profile_submissions WHERE album_id = ?`
      ).bind(albumId).all();
      const allAlbumSubs = existingSubsRes?.results || [];
      const activeCount = allAlbumSubs.filter((s: any) => s.status !== 'declined' && s.status !== 'removed').length;

      const existingByEmail = allAlbumSubs.find(
        (s: any) => String(s.email || '').toLowerCase() === email && s.status !== 'removed'
      );

      if (!existingByEmail && activeCount >= profileCap) {
        return new Response(
          JSON.stringify({
            error: 'profile_cap_reached',
            message: `This class album has reached its maximum cap of ${profileCap} profiles.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingByEmail && source === 'student' && !['draft', 'changes_requested'].includes(existingByEmail.status)) {
        return new Response(
          JSON.stringify({
            error: 'duplicate_email',
            message: 'A profile with this email address has already been submitted for this album.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rawStatusToken = generateRandomHexToken(24);
      const tokenHash = await sha256Hex(rawStatusToken);
      const subId = existingByEmail?.id || profilePayload.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const paymentStatus = body.paymentStatus || profilePayload.paymentStatus || (profilePayload.paidReference ? 'paid' : 'unpaid');
      const nextStatus = body.saveAsDraft ? 'draft' : 'pending';

      const enrichedPayload = {
        ...profilePayload,
        id: subId,
        personalEmail: email,
        paymentStatus,
        claimsToBeCovered: Boolean(profilePayload.claimsToBeCovered || body.claimsToBeCovered),
        source,
        status: nextStatus,
        submittedAt: existingByEmail?.created_at || new Date().toISOString(),
      };

      await env.DB.prepare(
        `INSERT OR REPLACE INTO profile_submissions (id, album_id, payload_json, photo_key, email, consent_at, source, payment_status, paid_reference, status, decline_reason, declined_at, status_token_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, NULL, NULL, ?, datetime('now'), datetime('now'))`
      ).bind(
        subId,
        albumId,
        JSON.stringify(enrichedPayload),
        profilePayload.photoKey || null,
        email,
        source,
        paymentStatus,
        profilePayload.paidReference || body.paidReference || null,
        nextStatus,
        tokenHash
      ).run();

      return new Response(
        JSON.stringify({
          success: true,
          submissionId: subId,
          status: nextStatus,
          paymentStatus,
          statusToken: rawStatusToken,
          statusLink: `${url.origin}/?submission_token=${rawStatusToken}&album=${encodeURIComponent(albumId)}`,
          submission: enrichedPayload,
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13e. GET & PUT /api/submissions/status — Student status check & edit via hashed status token
    if (path === '/api/submissions/status' && (request.method === 'GET' || request.method === 'PUT')) {
      const rawToken = url.searchParams.get('token') || '';
      if (!rawToken || !env.DB) {
        return new Response(JSON.stringify({ error: 'Valid status token required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const tokenHash = await sha256Hex(rawToken);
      const subRow = await env.DB.prepare(
        `SELECT * FROM profile_submissions WHERE status_token_hash = ?`
      ).bind(tokenHash).first();

      if (!subRow) {
        return new Response(JSON.stringify({ error: 'Submission not found or link expired.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let payload: any = {};
      try { payload = JSON.parse(subRow.payload_json || '{}'); } catch {}

      if (request.method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            submission: {
              id: subRow.id,
              albumId: subRow.album_id,
              email: subRow.email,
              status: subRow.status,
              paymentStatus: subRow.payment_status,
              declineReason: subRow.decline_reason,
              declinedAt: subRow.declined_at,
              canEdit: subRow.status === 'draft' || subRow.status === 'changes_requested',
              payload,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PUT: Student can edit while draft or changes_requested
      if (subRow.status !== 'draft' && subRow.status !== 'changes_requested') {
        return new Response(
          JSON.stringify({
            error: 'locked',
            message: 'This profile can only be edited while in draft or when changes are requested.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = (await request.json().catch(() => ({}))) as any;
      const updatedPayload = {
        ...payload,
        ...(body.payload || body),
        id: subRow.id,
        personalEmail: subRow.email,
        status: body.saveAsDraft ? 'draft' : 'pending',
      };
      const nextStatus = body.saveAsDraft ? 'draft' : 'pending';
      await env.DB.prepare(
        `UPDATE profile_submissions SET payload_json = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(updatedPayload), nextStatus, subRow.id).run();

      return new Response(
        JSON.stringify({
          success: true,
          status: nextStatus,
          payload: updatedPayload,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13f. GET /api/albums/:albumId/submissions/list — List submissions + lazy 30-day draft purge
    const listSubsMatch = path.match(/^\/api\/albums\/([^/]+)\/submissions\/list$/);
    if (listSubsMatch && request.method === 'GET') {
      const albumId = decodeURIComponent(listSubsMatch[1]);
      const access = await verifyAlbumAccess(albumId, true);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const settings = await getPlatformSettingsMap(env);
      const retentionDays = Number(settings.draft_retention_days) || 30;
      const reinstateDays = Number(settings.reinstate_days) || 7;
      const nowMs = Date.now();

      const rowsRes = await env.DB.prepare(
        `SELECT * FROM profile_submissions WHERE album_id = ? ORDER BY created_at DESC`
      ).bind(albumId).all();

      const submissions: any[] = [];
      for (const r of rowsRes?.results || []) {
        const createdMs = new Date(r.created_at || Date.now()).getTime();
        const ageDays = Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24));

        // Rule 7: Unapproved draft profiles expire after draft_retention_days (30 days); warn from day 23
        if ((r.status === 'draft' || r.status === 'pending') && ageDays >= retentionDays) {
          await env.DB.prepare(`DELETE FROM profile_submissions WHERE id = ?`).bind(r.id).run();
          if (r.photo_key && env.BUCKET) {
            try { await env.BUCKET.delete(r.photo_key); } catch {}
          }
          continue;
        }

        let payload: any = {};
        try { payload = JSON.parse(r.payload_json || '{}'); } catch {}

        let canReinstate = false;
        if (r.status === 'declined' && r.declined_at) {
          const declinedMs = new Date(r.declined_at).getTime();
          const daysSinceDecline = (nowMs - declinedMs) / (1000 * 60 * 60 * 24);
          canReinstate = daysSinceDecline <= reinstateDays;
        }

        submissions.push({
          id: r.id,
          albumId: r.album_id,
          email: r.email,
          source: r.source,
          paymentStatus: r.payment_status,
          paidReference: r.paid_reference,
          status: r.status,
          declineReason: r.decline_reason,
          declinedAt: r.declined_at,
          canReinstate,
          purgeWarningDaysLeft: (r.status === 'draft' || r.status === 'pending') && ageDays >= 23 ? Math.max(0, retentionDays - ageDays) : null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          payload,
        });
      }

      const slotSummary = await getAlbumSlotSummary(albumId);
      return new Response(
        JSON.stringify({
          success: true,
          submissions,
          slotSummary,
          settings,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13g. POST /api/albums/:albumId/submissions/approve — Single or Batch Approve with Slot Ledger
    const approveSubsMatch = path.match(/^\/api\/albums\/([^/]+)\/submissions\/approve$/);
    if (approveSubsMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(approveSubsMatch[1]);
      const access = await verifyAlbumAccess(albumId, false);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as any;
      const targetIds: string[] = Array.isArray(body.submissionIds)
        ? body.submissionIds
        : body.submissionId
        ? [body.submissionId]
        : [];

      if (targetIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No profiles selected for approval.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let { balance } = await getAlbumSlotSummary(albumId);
      const allSubsRes = await env.DB.prepare(`SELECT * FROM profile_submissions WHERE album_id = ?`).bind(albumId).all();
      const allSubs = allSubsRes?.results || [];

      let approvedCount = 0;
      let slotsUsedCount = 0;
      const approvedIds: string[] = [];
      const skippedUnpaidIds: string[] = [];

      for (const reqId of targetIds) {
        let subRow = allSubs.find((s: any) => s.id === reqId);
        // If the profile was only in albumData.students[] and not yet in profile_submissions, create row on the fly
        if (!subRow && Array.isArray(access.albumData?.students)) {
          const stFromAlbum = access.albumData.students.find((s: any) => s.id === reqId);
          if (stFromAlbum) {
            const pStatus = stFromAlbum.paymentStatus || (stFromAlbum.paidReference ? 'paid' : 'unpaid');
            subRow = {
              id: stFromAlbum.id,
              album_id: albumId,
              payload_json: JSON.stringify(stFromAlbum),
              email: stFromAlbum.personalEmail || '',
              source: stFromAlbum.source || 'student',
              payment_status: pStatus,
              status: stFromAlbum.status || 'pending',
            };
          }
        }
        if (!subRow) continue;
        if (subRow.status === 'approved') {
          approvedIds.push(subRow.id);
          continue;
        }

        const isPaidOrWaived = subRow.payment_status === 'paid' || subRow.payment_status === 'waived';
        if (isPaidOrWaived) {
          // Rule 2: Paid or waived profiles use 0 slots
          let parsedPayload: any = {};
          try { parsedPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
          parsedPayload.status = 'approved';
          parsedPayload.usedSlot = false;
          await env.DB.prepare(
            `INSERT OR REPLACE INTO profile_submissions (id, album_id, payload_json, email, source, payment_status, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), datetime('now'))`
          ).bind(
            subRow.id,
            albumId,
            JSON.stringify(parsedPayload),
            subRow.email || '',
            subRow.source || 'student',
            subRow.payment_status
          ).run();
          approvedCount++;
          approvedIds.push(subRow.id);
        } else {
          // Rule 2: Unpaid profile requires available slot balance >= 1
          if (balance < 1) {
            skippedUnpaidIds.push(subRow.id);
            continue;
          }
          const cycle = Date.now();
          await env.DB.prepare(
            `INSERT INTO slot_ledger (id, album_id, delta, kind, idempotency_key, created_by, created_at)
             VALUES (?, ?, -1, 'use', ?, ?, datetime('now'))`
          ).bind(
            `sled-use-${subRow.id}-${cycle}`,
            albumId,
            `use:${subRow.id}:${cycle}`,
            access.user.email
          ).run();
          balance -= 1;
          slotsUsedCount += 1;

          let parsedPayload: any = {};
          try { parsedPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
          parsedPayload.status = 'approved';
          parsedPayload.usedSlot = true;
          await env.DB.prepare(
            `INSERT OR REPLACE INTO profile_submissions (id, album_id, payload_json, email, source, payment_status, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'unpaid', 'approved', datetime('now'), datetime('now'))`
          ).bind(
            subRow.id,
            albumId,
            JSON.stringify(parsedPayload),
            subRow.email || '',
            subRow.source || 'student'
          ).run();
          approvedCount++;
          approvedIds.push(subRow.id);
        }
      }

      if (approvedCount === 0 && skippedUnpaidIds.length > 0) {
        return new Response(
          JSON.stringify({
            error: 'insufficient_slots',
            message: 'Buy slots to approve unpaid profiles.',
            balanceLeft: balance,
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updatedSummary = await getAlbumSlotSummary(albumId);
      const statusMsg =
        slotsUsedCount === 1
          ? `1 slot used, ${updatedSummary.balance} left`
          : slotsUsedCount > 1
          ? `${approvedCount} approved · ${slotsUsedCount} slots used, ${updatedSummary.balance} left`
          : `${approvedCount} approved · 0 slots used, ${updatedSummary.balance} left`;

      return new Response(
        JSON.stringify({
          success: true,
          approvedCount,
          approvedIds,
          skippedUnpaidIds,
          slotsUsedCount,
          balanceLeft: updatedSummary.balance,
          slotSummary: updatedSummary,
          message: statusMsg,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13h. POST /api/albums/:albumId/submissions/decline — Decline with reason (returns slot if previously approved with a slot)
    const declineSubMatch = path.match(/^\/api\/albums\/([^/]+)\/submissions\/decline$/);
    if (declineSubMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(declineSubMatch[1]);
      const access = await verifyAlbumAccess(albumId, false);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const subId = String(body.submissionId || '').trim();
      const reason = String(body.reason || '').trim();
      if (!subId || !reason) {
        return new Response(JSON.stringify({ error: 'Submission ID and decline reason are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const subRow = await env.DB.prepare(`SELECT * FROM profile_submissions WHERE id = ? AND album_id = ?`).bind(subId, albumId).first();
      let slotReturned = false;
      const declinedAt = new Date().toISOString();

      if (subRow) {
        let parsedPayload: any = {};
        try { parsedPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
        const wasApprovedWithSlot = subRow.status === 'approved' && (parsedPayload.usedSlot || subRow.payment_status === 'unpaid');
        parsedPayload.status = 'declined';
        parsedPayload.declineReason = reason;
        parsedPayload.declinedAt = declinedAt;
        parsedPayload.usedSlot = false;

        await env.DB.prepare(
          `UPDATE profile_submissions SET status = 'declined', decline_reason = ?, declined_at = ?, payload_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(reason, declinedAt, JSON.stringify(parsedPayload), subId).run();

        if (wasApprovedWithSlot) {
          await env.DB.prepare(
            `INSERT INTO slot_ledger (id, album_id, delta, kind, idempotency_key, created_by, created_at)
             VALUES (?, ?, 1, 'return', ?, ?, datetime('now'))`
          ).bind(
            `sled-ret-${subId}-${Date.now()}`,
            albumId,
            `return:${subId}:${Date.now()}`,
            access.user.email
          ).run();
          slotReturned = true;
        }
      }

      const slotSummary = await getAlbumSlotSummary(albumId);
      return new Response(
        JSON.stringify({
          success: true,
          submissionId: subId,
          status: 'declined',
          declineReason: reason,
          declinedAt,
          slotReturned,
          slotSummary,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13i. POST /api/albums/:albumId/submissions/request-changes
    const reqChangesMatch = path.match(/^\/api\/albums\/([^/]+)\/submissions\/request-changes$/);
    if (reqChangesMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(reqChangesMatch[1]);
      const access = await verifyAlbumAccess(albumId, false);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const subId = String(body.submissionId || '').trim();
      const reason = String(body.reason || body.note || '').trim();
      if (!subId || !reason) {
        return new Response(JSON.stringify({ error: 'Submission ID and change request note are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const subRow = await env.DB.prepare(`SELECT * FROM profile_submissions WHERE id = ? AND album_id = ?`).bind(subId, albumId).first();
      if (subRow) {
        let parsedPayload: any = {};
        try { parsedPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
        parsedPayload.status = 'changes_requested';
        parsedPayload.declineReason = reason;
        await env.DB.prepare(
          `UPDATE profile_submissions SET status = 'changes_requested', decline_reason = ?, payload_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(reason, JSON.stringify(parsedPayload), subId).run();
      }

      return new Response(
        JSON.stringify({
          success: true,
          submissionId: subId,
          status: 'changes_requested',
          declineReason: reason,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13j. POST /api/albums/:albumId/submissions/reinstate — Reinstate within 7-day window
    const reinstateSubMatch = path.match(/^\/api\/albums\/([^/]+)\/submissions\/reinstate$/);
    if (reinstateSubMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(reinstateSubMatch[1]);
      const access = await verifyAlbumAccess(albumId, false);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const subId = String(body.submissionId || '').trim();
      const settings = await getPlatformSettingsMap(env);
      const reinstateDays = Number(settings.reinstate_days) || 7;

      const subRow = await env.DB.prepare(`SELECT * FROM profile_submissions WHERE id = ? AND album_id = ?`).bind(subId, albumId).first();
      if (subRow && subRow.declined_at) {
        const daysSince = (Date.now() - new Date(subRow.declined_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > reinstateDays) {
          return new Response(
            JSON.stringify({
              error: 'reinstate_window_expired',
              message: `Declined profiles can only be reinstated within ${reinstateDays} days.`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      let { balance } = await getAlbumSlotSummary(albumId);
      const isPaidOrWaived = subRow ? (subRow.payment_status === 'paid' || subRow.payment_status === 'waived') : Boolean(body.isPaid);

      if (!isPaidOrWaived && balance < 1) {
        return new Response(
          JSON.stringify({
            error: 'insufficient_slots',
            message: 'Buy slots to reinstate and approve this unpaid profile.',
            balanceLeft: balance,
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isPaidOrWaived) {
        const cycle = Date.now();
        await env.DB.prepare(
          `INSERT INTO slot_ledger (id, album_id, delta, kind, idempotency_key, created_by, created_at)
           VALUES (?, ?, -1, 'use', ?, ?, datetime('now'))`
        ).bind(`sled-use-${subId}-${cycle}`, albumId, `use:${subId}:${cycle}`, access.user.email).run();
      }

      if (subRow) {
        let parsedPayload: any = {};
        try { parsedPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
        parsedPayload.status = 'approved';
        parsedPayload.usedSlot = !isPaidOrWaived;
        delete parsedPayload.declineReason;
        delete parsedPayload.declinedAt;
        await env.DB.prepare(
          `UPDATE profile_submissions SET status = 'approved', decline_reason = NULL, declined_at = NULL, payload_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(JSON.stringify(parsedPayload), subId).run();
      }

      const slotSummary = await getAlbumSlotSummary(albumId);
      return new Response(
        JSON.stringify({
          success: true,
          submissionId: subId,
          status: 'approved',
          slotUsed: !isPaidOrWaived,
          slotSummary,
          message: !isPaidOrWaived ? `1 slot used, ${slotSummary.balance} left` : `Reinstated (0 slots used)`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13k. POST /api/albums/:albumId/submissions/remove — Remove profile (does NOT return slot)
    const removeSubMatch = path.match(/^\/api\/albums\/([^/]+)\/submissions\/remove$/);
    if (removeSubMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(removeSubMatch[1]);
      const access = await verifyAlbumAccess(albumId, false);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const subId = String(body.submissionId || '').trim();
      if (env.DB && subId) {
        await env.DB.prepare(
          `UPDATE profile_submissions SET status = 'removed', updated_at = datetime('now') WHERE id = ? AND album_id = ?`
        ).bind(subId, albumId).run();
      }
      const slotSummary = await getAlbumSlotSummary(albumId);
      return new Response(
        JSON.stringify({
          success: true,
          submissionId: subId,
          status: 'removed',
          slotReturned: false,
          slotSummary,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13l. Host KoHot Slot Allocations (/api/admin/slot-allocations)
    if (path === '/api/admin/slot-allocations' && (request.method === 'GET' || request.method === 'POST')) {
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (request.method === 'GET') {
        const res = await env.DB.prepare(`SELECT * FROM slot_allocations ORDER BY created_at DESC`).all();
        return new Response(JSON.stringify({ success: true, allocations: res?.results || [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const institutionId = String(body.institutionId || '').trim();
      const departmentId = String(body.departmentId || '').trim();
      const graduationYear = Number(body.graduationYear || new Date().getFullYear());
      const quantity = Math.max(1, Number(body.quantity) || 1);
      const note = String(body.note || 'Sponsored by KoHot').trim();
      const allocId = `alloc-${institutionId}-${departmentId}-${graduationYear}`;

      // Check if an album already exists for this institution + department + graduationYear
      const setsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
      const matchingAlbum = (setsRes?.results || []).find(
        (s: any) =>
          String(s.institution_id).toLowerCase() === institutionId.toLowerCase() &&
          String(s.department_id).toLowerCase() === departmentId.toLowerCase() &&
          Number(s.graduation_year) === graduationYear &&
          s.status !== 'deleted'
      );

      const status = matchingAlbum ? 'credited' : 'waiting';
      await env.DB.prepare(
        `INSERT OR REPLACE INTO slot_allocations (id, institution_id, department_id, graduation_year, quantity, note, status, album_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        allocId,
        institutionId,
        departmentId,
        graduationYear,
        quantity,
        note,
        status,
        matchingAlbum ? matchingAlbum.id : null,
        sessionUser.email
      ).run();

      if (matchingAlbum) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
           VALUES (?, ?, ?, 'kohot_allocation', ?, 'KoHot', 0, ?, ?, datetime('now'))`
        ).bind(
          `sled-alloc-${allocId}`,
          matchingAlbum.id,
          quantity,
          allocId,
          `alloc:${allocId}`,
          sessionUser.email
        ).run();
      }

      return new Response(
        JSON.stringify({
          success: true,
          allocation: { id: allocId, institutionId, departmentId, graduationYear, quantity, note, status, albumId: matchingAlbum?.id || null },
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 14. Single Album Retrieval by ID (Public: only published & public fields; drafts/unpublished/deleted return "not available")
    if (path.startsWith('/api/albums/') && request.method === 'GET') {
      const albumId = decodeURIComponent(path.replace('/api/albums/', ''));
      const sessionUser = await getSessionUser();
      if (env.DB) {
        const album = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (album && album.data_json) {
          let parsed: any = {};
          try { parsed = JSON.parse(album.data_json); } catch {}
          const rowStatus = String(album.status || parsed.lifecycleStatus || (parsed.deletedAt ? 'deleted' : parsed.unpublished ? 'unpublished' : parsed.published ? 'published' : 'draft'));
          const ownerEmail = String(album.admin_user_id || parsed.classRepEmail || '').toLowerCase();
          const isOwner = Boolean(sessionUser && ownerEmail && ownerEmail === sessionUser.email.toLowerCase());
          const isHost = Boolean(sessionUser && sessionUser.role === 'master_host');

          if (isHost || isOwner) {
            return new Response(JSON.stringify({ ...parsed, lifecycleStatus: rowStatus, version: Number(parsed.version) || 1 }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const isPubliclyAvailable = (rowStatus === 'published' || (rowStatus === 'active' && parsed.published === true)) && !parsed.unpublished && !parsed.deletedAt;
          if (!isPubliclyAvailable) {
            return new Response(JSON.stringify({ error: 'not_available', message: 'not available' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify(sanitizePublicAlbum(parsed)), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ error: 'not_available', message: 'not available' }), {
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
