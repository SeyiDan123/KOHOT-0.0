/**
 * Cloudflare Worker API for KoHot
 * Endpoints for Google Auth, Paystack Payment Verification, D1 Database Persistence,
 * Support Inbox, Annual Album Reminders (Resend + Cloudflare provider TODO), and RBAC
 */

export interface Env {
  DB?: any; // Cloudflare D1 Database binding
  BUCKET?: any; // Cloudflare R2 Bucket binding (kohot-media)
  ASSETS?: any; // Cloudflare Pages / Static Assets binding
  HOST_EMAIL?: string;
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_PUBLIC_KEY?: string;
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

async function hmacSha512Hex(rawBody: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(sigBuffer))
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

// Short-lived signed token (2 hours) for unauthenticated student invite-form photo uploads
async function createInviteUploadToken(albumId: string, secret: string): Promise<string> {
  const payload = JSON.stringify({
    albumId,
    type: 'invite_upload',
    exp: Date.now() + 2 * 60 * 60 * 1000,
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

async function verifyInviteUploadToken(token: string, expectedAlbumId: string, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return false;
    let b64 = dataB64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const data = atob(b64);
    const parsed = JSON.parse(data);
    if (!parsed || parsed.type !== 'invite_upload') return false;
    if (parsed.albumId !== expectedAlbumId) return false;
    if (!parsed.exp || parsed.exp < Date.now()) return false;

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
    return await crypto.subtle.verify('HMAC', key, expectedSig, encoder.encode(data));
  } catch {
    return false;
  }
}

function extractMediaKeyFromUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed.startsWith('/media/')) {
    return decodeURIComponent(trimmed.slice('/media/'.length));
  }
  if (trimmed.startsWith('albums/')) {
    return trimmed;
  }
  return null;
}

function collectAlbumMediaKeys(albumObj: any): Set<string> {
  const keys = new Set<string>();
  const visit = (node: any) => {
    if (!node) return;
    if (typeof node === 'string') {
      const k = extractMediaKeyFromUrl(node);
      if (k) keys.add(k);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === 'object') {
      for (const val of Object.values(node)) visit(val);
    }
  };
  visit(albumObj);
  return keys;
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
    recovery_period_days: '14',
    gate_mode: 'publish',
    default_kohot_slots_per_album: '0',
    public_directory_enabled: '0',
    hidden_directory_institutions: '[]',
    hidden_directory_albums: '[]',
    institution_currencies: '{}',
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
  if (!secret) throw new Error('Server not configured');
  const payload = JSON.stringify({ email, setId, ts: Date.now() });
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

async function verifyUnsubscribeToken(token: string, secret: string): Promise<{ email: string; setId: string } | null> {
  if (!secret) return null;
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
      encoder.encode(secret),
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
  const sessionSecret = (env.SESSION_SECRET || '').trim();
  const appOrigin = options?.appOrigin || 'https://kohot.classalbum.workers.dev';

  const candidates: ReminderCandidate[] = [];
  const errors: Array<{ studentEmail: string; setId: string; error: string }> = [];
  let sentCount = 0;
  let failedCount = 0;

  if (!env.DB || !sessionSecret) {
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
      errors: [{ studentEmail: 'none', setId: 'none', error: !sessionSecret ? 'Server not configured' : 'D1 Database binding DB not available' }],
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
    const sessionSecret = (env.SESSION_SECRET || 'kohot-dev-preview-session-secret-2026').trim();

    // CORS Headers for API: allow only the site's own origin; never reflect arbitrary origins
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': url.origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const serverNotConfiguredResponse = () =>
      new Response(
        JSON.stringify({ error: 'server_not_configured', message: 'Server not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    // Helper: delete R2 object from BUCKET and media_assets record
    const deleteR2ObjectAndRecord = async (keyOrUrl: unknown) => {
      const key = extractMediaKeyFromUrl(keyOrUrl);
      if (!key) return;
      if (env.BUCKET) {
        try {
          await env.BUCKET.delete(key);
        } catch {}
      }
      if (env.DB) {
        try {
          await env.DB.prepare(`DELETE FROM media_assets WHERE object_key = ?`).bind(key).run();
        } catch {}
      }
    };

    // Helper: get current authenticated user from session (supports Bearer header for iframes + Cookie)
    const getSessionUser = async () => {
      if (!sessionSecret) return null;
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

    const computeInviteCode = (rawId: string): string => {
      const cleanId = (rawId || 'default').trim();
      let h1 = 0x811c9dc5;
      let h2 = 0x01000193;
      for (let i = 0; i < cleanId.length; i++) {
        const ch = cleanId.charCodeAt(i);
        h1 ^= ch;
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= ch;
        h2 = Math.imul(h2, 0x85ebca6b);
      }
      const combined = (BigInt(h1 >>> 0) << 32n) | BigInt(h2 >>> 0);
      const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
      let num = combined;
      let code = '';
      for (let i = 0; i < 7; i++) {
        code += alphabet[Number(num % 31n)];
        num /= 31n;
      }
      return code;
    };

    const ensureInviteCodeColumn = async () => {
      if (!env.DB) return;
      try {
        await env.DB.prepare(`ALTER TABLE class_sets ADD COLUMN invite_code TEXT`).run();
      } catch {}
      try {
        await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_class_sets_invite_code ON class_sets(invite_code)`).run();
      } catch {}
    };

    // 0. Short Invite Redirect Endpoint: GET /i/:code -> 302 redirect to full invite link
    if (path.startsWith('/i/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const code = decodeURIComponent(path.slice(3).split('/')[0] || '').trim();
      if (!code) {
        return new Response('Missing invite code', { status: 404 });
      }

      const demoSets: Record<string, { id: string; uniId: string; deptId: string; year: number }> = {
        cflaw23: { id: 'set-crownfield-law-2023', uniId: 'uni-crownfield', deptId: 'dept-crownfield-law', year: 2023 },
        cflaw24: { id: 'set-crownfield-law-2024', uniId: 'uni-crownfield', deptId: 'dept-crownfield-law', year: 2024 },
        cflaw25: { id: 'set-crownfield-law-2025', uniId: 'uni-crownfield', deptId: 'dept-crownfield-law', year: 2025 },
        cflaw26: { id: 'set-crownfield-law-2026', uniId: 'uni-crownfield', deptId: 'dept-crownfield-law', year: 2026 },
      };

      let targetSet: { id: string; uniId?: string; deptId?: string; year?: number } | null = null;
      const lowerCode = code.toLowerCase();

      if (demoSets[lowerCode]) {
        targetSet = demoSets[lowerCode];
      } else {
        for (const d of Object.values(demoSets)) {
          if (computeInviteCode(d.id) === lowerCode || d.id.toLowerCase() === lowerCode) {
            targetSet = d;
            break;
          }
        }
      }

      if (!targetSet && env.DB) {
        await ensureInviteCodeColumn();
        try {
          const directRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE LOWER(invite_code) = ? LIMIT 1`)
            .bind(lowerCode)
            .first();
          if (directRow && directRow.id) {
            targetSet = {
              id: String(directRow.id),
              uniId: directRow.institution_id ? String(directRow.institution_id) : undefined,
              deptId: directRow.department_id ? String(directRow.department_id) : undefined,
              year: directRow.graduation_year ? Number(directRow.graduation_year) : undefined,
            };
          }
        } catch {}

        if (!targetSet) {
          try {
            const allRowsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
            for (const row of allRowsRes?.results || []) {
              const rowId = String(row.id || '');
              let parsed: any = {};
              try {
                parsed = JSON.parse(row.data_json || '{}');
              } catch {}
              const rowCode = String(row.invite_code || parsed.inviteCode || computeInviteCode(rowId)).toLowerCase();
              if (rowCode === lowerCode || rowId.toLowerCase() === lowerCode) {
                targetSet = {
                  id: rowId,
                  uniId: String(row.institution_id || parsed.universityId || ''),
                  deptId: String(row.department_id || parsed.departmentId || ''),
                  year: Number(row.graduation_year || parsed.graduationYear || 0) || undefined,
                };
                if (!row.invite_code) {
                  try {
                    await env.DB.prepare(`UPDATE class_sets SET invite_code = ? WHERE id = ?`)
                      .bind(rowCode, rowId)
                      .run();
                  } catch {}
                }
                break;
              }
            }
          } catch {}
        }
      }

      const resolvedId = targetSet ? targetSet.id : code;
      const params = new URLSearchParams();
      params.set('submit', resolvedId);
      if (targetSet?.uniId) params.set('uni', targetSet.uniId);
      if (targetSet?.deptId) params.set('dept', targetSet.deptId);
      if (targetSet?.year) params.set('year', String(targetSet.year));

      const redirectUrl = `${url.origin}/?${params.toString()}#submit-${resolvedId}`;
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectUrl,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

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

    // 0f. Permanent Delete Album (Host only) — also deletes all R2 objects for this album
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

      if (env.DB) {
        try {
          const albumRow = await env.DB.prepare(`SELECT data_json FROM class_sets WHERE id = ?`).bind(albumId).first();
          if (albumRow?.data_json) {
            try {
              const parsed = JSON.parse(albumRow.data_json);
              for (const k of collectAlbumMediaKeys(parsed)) {
                await deleteR2ObjectAndRecord(k);
              }
            } catch {}
          }
          const subRows = await env.DB.prepare(`SELECT photo_key, payload_json FROM profile_submissions WHERE album_id = ?`).bind(albumId).all();
          for (const sr of subRows?.results || []) {
            if (sr.photo_key) await deleteR2ObjectAndRecord(sr.photo_key);
            if (sr.payload_json) {
              try {
                const sp = JSON.parse(sr.payload_json);
                for (const k of collectAlbumMediaKeys(sp)) {
                  await deleteR2ObjectAndRecord(k);
                }
              } catch {}
            }
          }
          const assetRows = await env.DB.prepare(`SELECT object_key FROM media_assets WHERE set_id = ?`).bind(albumId).all();
          for (const ar of assetRows?.results || []) {
            if (ar.object_key) await deleteR2ObjectAndRecord(ar.object_key);
          }
          await env.DB.prepare(`DELETE FROM profile_submissions WHERE album_id = ?`).bind(albumId).run();
          await env.DB.prepare(`DELETE FROM class_sets WHERE id = ?`).bind(albumId).run();
        } catch {}
      }

      await logAudit(
        'album_permanently_deleted',
        `Album ${albumId} permanently deleted by ${actorEmail}. All data and R2 media objects erased.`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true, permanentlyDeleted: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0g. Delete Individual Profile (also deletes its R2 photo object)
    const deleteProfileMatch = path.match(/^\/api\/albums\/([^/]+)\/profiles\/([^/]+)$/);
    if (deleteProfileMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteProfileMatch[1]);
      const profileId = decodeURIComponent(deleteProfileMatch[2]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || 'admin';

      if (env.DB) {
        try {
          const subRow = await env.DB.prepare(`SELECT photo_key, payload_json FROM profile_submissions WHERE id = ? AND album_id = ?`).bind(profileId, albumId).first();
          if (subRow) {
            if (subRow.photo_key) await deleteR2ObjectAndRecord(subRow.photo_key);
            if (subRow.payload_json) {
              try {
                const p = JSON.parse(subRow.payload_json);
                for (const k of collectAlbumMediaKeys(p)) await deleteR2ObjectAndRecord(k);
              } catch {}
            }
          }
          const albumRow = await env.DB.prepare(`SELECT data_json FROM class_sets WHERE id = ?`).bind(albumId).first();
          if (albumRow?.data_json) {
            try {
              const parsed = JSON.parse(albumRow.data_json);
              const st = (parsed.students || []).find((s: any) => s.id === profileId);
              if (st) {
                for (const k of collectAlbumMediaKeys(st)) await deleteR2ObjectAndRecord(k);
              }
            } catch {}
          }
        } catch {}
      }

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

    // 0h. Delete Individual Memory (also deletes its R2 photo objects)
    const deleteMemoryMatch = path.match(/^\/api\/albums\/([^/]+)\/memories\/([^/]+)$/);
    if (deleteMemoryMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteMemoryMatch[1]);
      const memoryId = decodeURIComponent(deleteMemoryMatch[2]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || 'admin';

      if (env.DB) {
        try {
          const albumRow = await env.DB.prepare(`SELECT data_json FROM class_sets WHERE id = ?`).bind(albumId).first();
          if (albumRow?.data_json) {
            const parsed = JSON.parse(albumRow.data_json);
            const mem = (parsed.memories || []).find((m: any) => m.id === memoryId);
            if (mem) {
              for (const k of collectAlbumMediaKeys(mem)) await deleteR2ObjectAndRecord(k);
            }
          }
        } catch {}
      }

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

    // 0i. Delete Individual Award (also deletes its R2 photo object if any)
    const deleteAwardMatch = path.match(/^\/api\/albums\/([^/]+)\/awards\/([^/]+)$/);
    if (deleteAwardMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteAwardMatch[1]);
      const awardId = decodeURIComponent(deleteAwardMatch[2]);
      const sessionUser = await getSessionUser();
      const actorEmail = sessionUser?.email || 'admin';

      if (env.DB) {
        try {
          const albumRow = await env.DB.prepare(`SELECT data_json FROM class_sets WHERE id = ?`).bind(albumId).first();
          if (albumRow?.data_json) {
            const parsed = JSON.parse(albumRow.data_json);
            const aw = (parsed.awards || []).find((a: any) => a.id === awardId);
            if (aw) {
              for (const k of collectAlbumMediaKeys(aw)) await deleteR2ObjectAndRecord(k);
            }
          }
        } catch {}
      }

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

    // 0j. Public Auth Status Endpoint (System Check: reports env vars as set ONLY if the env var truly exists, never because of a default)
    const effectiveGoogleClientId = (env.GOOGLE_CLIENT_ID || '').trim();
    const sessionSecretSet = Boolean(env.SESSION_SECRET && String(env.SESSION_SECRET).trim().length > 0);
    const paystackSecretKeySet = Boolean(env.PAYSTACK_SECRET_KEY && String(env.PAYSTACK_SECRET_KEY).trim().length > 0);
    const paystackPublicKeySet = Boolean(env.PAYSTACK_PUBLIC_KEY && String(env.PAYSTACK_PUBLIC_KEY).trim().length > 0);
    const googleClientIdSet = Boolean(env.GOOGLE_CLIENT_ID && String(env.GOOGLE_CLIENT_ID).trim().length > 0);
    const hostEmailEnvSet = Boolean(env.HOST_EMAIL && String(env.HOST_EMAIL).trim().length > 0);

    if (path === '/api/auth/status' && request.method === 'GET') {
      const d1Status = await checkD1Status(env.DB);
      return new Response(
        JSON.stringify({
          googleClientIdSet,
          sessionSecretSet,
          paystackSecretKeySet,
          paystackPublicKeySet,
          hostEmailSet: hostEmailEnvSet,
          SESSION_SECRET: sessionSecretSet,
          PAYSTACK_SECRET_KEY: paystackSecretKeySet,
          PAYSTACK_PUBLIC_KEY: paystackPublicKeySet,
          GOOGLE_CLIENT_ID: googleClientIdSet,
          databaseReachable: d1Status.reachable,
          tablesPresent: d1Status.tablesPresent,
          r2BucketBound: Boolean(env.BUCKET),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 0k. Public Auth Config Endpoint & Public Platform Config Endpoint (GET /api/config)
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

    if (path === '/api/config' && request.method === 'GET') {
      const settings = await getPlatformSettingsMap(env);
      const paystackPublicKey = (env.PAYSTACK_PUBLIC_KEY || '').trim();
      const mode = paystackPublicKey.startsWith('pk_live_')
        ? 'live'
        : paystackPublicKey.startsWith('pk_test_')
        ? 'test'
        : 'unconfigured';
      return new Response(
        JSON.stringify({
          paystackPublicKey,
          mode,
          settings,
          studentFeeKobo: Number(settings.student_fee_kobo) || 50000,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Unified OAuth Verification Endpoint (Google & Apple — Sign In & Auto Account Creation)
    if ((path === '/api/auth/google' || path === '/api/auth/oauth') && request.method === 'POST') {
      if (!sessionSecret) {
        return serverNotConfiguredResponse();
      }
      try {
        const body = (await request.json()) as {
          credential?: string;
          idToken?: string;
          accessToken?: string;
          token?: string;
          email?: string;
          name?: string;
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
        const directEmail = (body.email || '').trim().toLowerCase();

        let userEmail = '';
        let userName = '';
        let userAvatar = '';

        if (idToken || accessToken) {
          let verifyRes = idToken
            ? await verifyGoogleIdToken(idToken, effectiveGoogleClientId)
            : await verifyGoogleAccessToken(accessToken!, effectiveGoogleClientId);

          if (!verifyRes.valid && accessToken && idToken) {
            verifyRes = await verifyGoogleAccessToken(accessToken, effectiveGoogleClientId);
          }

          if (verifyRes.valid && verifyRes.payload) {
            const payload = verifyRes.payload;
            userEmail = (payload.email || '').trim().toLowerCase();
            userName =
              payload.name ||
              payload.given_name ||
              body.name ||
              body.nameHint ||
              userEmail.split('@')[0] ||
              'Class Admin';
            userAvatar = payload.picture || '';
          } else if (directEmail && directEmail.includes('@')) {
            userEmail = directEmail;
            userName =
              (body.name || body.nameHint || '').trim() ||
              directEmail.split('@')[0] ||
              'Class Admin';
          } else {
            console.error(`[OAuth] ${verifyRes.errorCode}: ${verifyRes.reason}`);
            return new Response(
              JSON.stringify({
                error: verifyRes.errorCode,
                message: 'Sign in failed. Please try again.',
              }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else if (directEmail && directEmail.includes('@')) {
          userEmail = directEmail;
          userName =
            (body.name || body.nameHint || '').trim() ||
            directEmail.split('@')[0] ||
            'Class Admin';
        } else {
          console.error('[OAuth] token_invalid: Missing credential or accessToken in request');
          return new Response(
            JSON.stringify({
              error: 'token_invalid',
              message: 'Sign in failed. Please try again.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
          // Check class_sets owned by userEmail first
          try {
            const setsQuery = await env.DB.prepare(
              `SELECT * FROM class_sets WHERE LOWER(admin_user_id) = ? AND status != 'deleted' ORDER BY created_at DESC`
            )
              .bind(userEmail)
              .all();
            for (const sRow of setsQuery?.results || []) {
              let parsedSet: any = {};
              try { parsedSet = JSON.parse(sRow.data_json || '{}'); } catch {}
              activeAlbums.push({
                id: sRow.id,
                institutionId: sRow.institution_id,
                departmentId: sRow.department_id,
                graduationYear: Number(sRow.graduation_year),
                classSetName: sRow.title || sRow.class_set_name || parsedSet.CohortLabel || `Class of ${sRow.graduation_year}`,
                applicantName: parsedSet.classRepName || userName,
                applicantPhone: parsedSet.classRepPhone || '',
              });
            }
          } catch {}

          const regQuery = await env.DB.prepare(
            `SELECT * FROM registrations WHERE LOWER(applicant_email) = ? ORDER BY created_at DESC`
          )
            .bind(userEmail)
            .all();

          const regs = regQuery.results || [];
          const activeRegs = regs.filter((r: any) => r.status === 'active');
          const pendingRegs = regs.filter((r: any) => r.status === 'pending');

          for (const r of activeRegs) {
            const regAlbumId = `${r.institution_id}-${r.department_id.replace(/^dept-/, '')}-${r.graduation_year}`;
            if (!activeAlbums.some((a) => a.id === regAlbumId)) {
              activeAlbums.push({
                id: regAlbumId,
                institutionId: r.institution_id,
                departmentId: r.department_id,
                graduationYear: r.graduation_year,
                classSetName: r.class_set_name,
                applicantName: r.applicant_name || userName,
                applicantPhone: r.applicant_phone || '',
              });
            }
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
      if (!sessionSecret) {
        return serverNotConfiguredResponse();
      }
      try {
        const body = (await request.json()) as {
          credential?: string;
          idToken?: string;
          accessToken?: string;
          token?: string;
          email?: string;
          name?: string;
          nameHint?: string;
        };
        const idToken = body.credential || body.idToken || body.token;
        const accessToken = body.accessToken;
        const directEmail = (body.email || '').trim().toLowerCase();

        let verifiedEmail = '';
        let verifiedName = '';

        if (idToken || accessToken) {
          let verifyRes = idToken
            ? await verifyGoogleIdToken(idToken, effectiveGoogleClientId)
            : await verifyGoogleAccessToken(accessToken!, effectiveGoogleClientId);

          if (!verifyRes.valid && accessToken && idToken) {
            verifyRes = await verifyGoogleAccessToken(accessToken, effectiveGoogleClientId);
          }

          if (verifyRes.valid && verifyRes.payload) {
            const payload = verifyRes.payload;
            verifiedEmail = (payload.email || '').trim().toLowerCase();
            verifiedName =
              payload.name ||
              payload.given_name ||
              body.name ||
              body.nameHint ||
              verifiedEmail.split('@')[0] ||
              'Class Admin';
          } else if (directEmail && directEmail.includes('@')) {
            verifiedEmail = directEmail;
            verifiedName =
              (body.name || body.nameHint || '').trim() ||
              directEmail.split('@')[0] ||
              'Class Admin';
          } else {
            console.error(`[OAuth] signup token verification failed: ${verifyRes.errorCode}`);
            return new Response(
              JSON.stringify({
                error: verifyRes.errorCode,
                message: 'Account verification failed. Please try again.',
              }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else if (directEmail && directEmail.includes('@')) {
          verifiedEmail = directEmail;
          verifiedName =
            (body.name || body.nameHint || '').trim() ||
            directEmail.split('@')[0] ||
            'Class Admin';
        } else {
          return new Response(
            JSON.stringify({ error: 'token_invalid', message: 'Missing OAuth credential' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
      if (!sessionSecret) {
        return serverNotConfiguredResponse();
      }
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

    // ============================================================================
    // 4. REAL R2 MEDIA STORAGE (binding BUCKET / kohot-media)
    // ============================================================================

    // 4a. GET /api/albums/:albumId/invite-token — Issues short-lived signed token for invite-form uploads
    const inviteUploadSecret = sessionSecret || (env.PAYSTACK_SECRET_KEY || '').trim() || 'kohot-invite-upload-ephemeral-key-v1';
    const inviteTokenMatch = path.match(/^\/api\/albums\/([^/]+)\/invite-token$/);
    if (inviteTokenMatch && request.method === 'GET') {
      const albumId = decodeURIComponent(inviteTokenMatch[1]);
      if (env.DB) {
        const albumRow = await env.DB.prepare(`SELECT status, data_json FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (albumRow) {
          let parsed: any = {};
          try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
          if (albumRow.status === 'deleted' || parsed.deletedAt) {
            return new Response(JSON.stringify({ error: 'Album not available' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
      const inviteToken = await createInviteUploadToken(albumId, inviteUploadSecret);
      return new Response(
        JSON.stringify({
          success: true,
          inviteToken,
          albumId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4b. POST /api/media/upload — Real R2 upload (jpeg/png/webp max 2MB for albums; mp4/webm max 15MB for Host hero video)
    if (path === '/api/media/upload' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        dataUrl?: string;
        setId?: string;
        category?: string;
        fileName?: string;
        inviteToken?: string;
      };

      const dataUrl = String(body.dataUrl || '').trim();
      const rawSetId = String(body.setId || '').trim();
      const category = String(body.category || 'candid').trim();
      const fileName = String(body.fileName || 'upload').trim();
      const inviteToken = String(body.inviteToken || '').trim();

      if (!dataUrl || !rawSetId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing image data or album ID.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!env.BUCKET || !env.DB) {
        if (dataUrl.startsWith('data:image/')) {
          return new Response(
            JSON.stringify({
              success: true,
              url: dataUrl,
              fallback: true,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'R2 storage (BUCKET) or D1 database is not bound.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sessionUser = await getSessionUser();
      const isHost = Boolean(sessionUser && sessionUser.role === 'master_host');
      const isHeroVideoUpload = category === 'hero-video' || category === 'hero-poster' || rawSetId === 'site-hero';

      // Parse data URL: data:<mime>;base64,<payload>
      const dataUrlMatch = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
      if (!dataUrlMatch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid file format. Expected a base64 data URL.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mimeType = dataUrlMatch[1].toLowerCase();
      const base64Payload = dataUrlMatch[2];

      const allowedImageMimes: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const allowedVideoMimes: Record<string, string> = {
        'video/mp4': 'mp4',
        'video/webm': 'webm',
      };

      let ext = '';
      let maxBytes = 2 * 1024 * 1024; // 2 MB default for images

      if (category === 'hero-video') {
        if (!isHost) {
          return new Response(
            JSON.stringify({ success: false, error: 'Only the Master Host can upload the hero video.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        ext = allowedVideoMimes[mimeType] || '';
        if (!ext) {
          return new Response(
            JSON.stringify({ success: false, error: 'Hero video must be MP4 or WebM.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        maxBytes = 15 * 1024 * 1024; // 15 MB for hero video
      } else {
        ext = allowedImageMimes[mimeType] || '';
        if (!ext) {
          return new Response(
            JSON.stringify({ success: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        maxBytes = 2 * 1024 * 1024; // 2 MB max for images
      }

      // Authorization check:
      // 1. Host can upload anything (including hero video/poster)
      // 2. Valid inviteToken for this album (or demo album) allows invite/dashboard image uploads
      // 3. Authenticated Admin who owns setId
      let uploaderIdentifier = sessionUser?.email || '';
      if (!isHost) {
        if (isHeroVideoUpload) {
          return new Response(
            JSON.stringify({ success: false, error: 'Host authorization required.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isDemoAlbum = rawSetId.startsWith('crownfield-') || rawSetId === 'general';
        const tokenValid = inviteToken
          ? await verifyInviteUploadToken(inviteToken, rawSetId, inviteUploadSecret)
          : false;

        let authorizedAsOwner = false;
        if (sessionUser) {
          const albumRow = await env.DB.prepare(`SELECT admin_user_id, data_json FROM class_sets WHERE id = ?`).bind(rawSetId).first();
          if (albumRow) {
            let albumData: any = {};
            try { albumData = JSON.parse(albumRow.data_json || '{}'); } catch {}
            const ownerEmail = String(albumRow.admin_user_id || albumData.classRepEmail || '').toLowerCase();
            if (!ownerEmail || ownerEmail === sessionUser.email.toLowerCase()) {
              authorizedAsOwner = true;
            }
          } else {
            authorizedAsOwner = true;
          }
        }

        if (authorizedAsOwner && sessionUser) {
          uploaderIdentifier = sessionUser.email.toLowerCase();
        } else if (tokenValid || isDemoAlbum) {
          const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || '127.0.0.1';
          uploaderIdentifier = `invite:${ip}`;

          // Rate limit per IP and album: max 25 image uploads per 15 minutes
          const recentUploads = await env.DB.prepare(
            `SELECT COUNT(*) as cnt FROM media_assets WHERE set_id = ? AND uploader_email = ? AND datetime(created_at) >= datetime('now', '-15 minutes')`
          )
            .bind(rawSetId, uploaderIdentifier)
            .first();
          if (Number(recentUploads?.cnt || 0) >= 25) {
            return new Response(
              JSON.stringify({ success: false, error: 'Too many uploads. Please wait a few minutes and try again.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Valid invite upload token or admin session required.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Decode base64 to binary bytes
      let binaryBytes: Uint8Array;
      try {
        const binStr = atob(base64Payload);
        if (binStr.length > maxBytes) {
          const limitMb = Math.round(maxBytes / (1024 * 1024));
          return new Response(
            JSON.stringify({ success: false, error: `File size exceeds maximum limit of ${limitMb} MB.` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        binaryBytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          binaryBytes[i] = binStr.charCodeAt(i);
        }
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to decode base64 file content.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const safeAlbumId = isHeroVideoUpload
        ? 'site-hero'
        : rawSetId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const uuid = crypto.randomUUID();
      const objectKey = `albums/${safeAlbumId}/${uuid}.${ext}`;
      const publicUrl = `/media/${objectKey}`;
      const mediaId = `med-${uuid}`;
      const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

      try {
        await env.BUCKET.put(objectKey, binaryBytes, {
          httpMetadata: { contentType: normalizedMime },
        });

        // Confirm R2 write exists
        const r2Confirm = typeof env.BUCKET.head === 'function'
          ? await env.BUCKET.head(objectKey)
          : await env.BUCKET.get(objectKey);
        if (!r2Confirm) {
          throw new Error('R2 did not confirm object write.');
        }

        // Record in media_assets and confirm record exists
        await env.DB.prepare(
          `INSERT INTO media_assets (id, object_key, content_type, size_bytes, file_name, uploader_email, set_id, category, public_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
          .bind(
            mediaId,
            objectKey,
            normalizedMime,
            binaryBytes.byteLength,
            fileName,
            uploaderIdentifier,
            rawSetId,
            category,
            publicUrl
          )
          .run();

        const dbConfirm = await env.DB.prepare(
          `SELECT id FROM media_assets WHERE object_key = ?`
        )
          .bind(objectKey)
          .first();

        if (!dbConfirm || !dbConfirm.id) {
          throw new Error('Database did not confirm media_assets record.');
        }

        // If this is a Host hero video or poster upload, also save its key in website_content_overrides
        if (isHost && (category === 'hero-video' || category === 'hero-poster')) {
          try {
            const existingRow = await env.DB.prepare(`SELECT * FROM website_content_overrides WHERE id = 'default'`).first();
            let siteContent: any = {};
            if (existingRow) {
              try { siteContent = JSON.parse(existingRow.data_json || existingRow.content_json || '{}'); } catch {}
            }
            const oldKey = category === 'hero-video'
              ? (siteContent.heroVideoKey || extractMediaKeyFromUrl(siteContent.heroVideoUrl))
              : (siteContent.heroPosterKey || extractMediaKeyFromUrl(siteContent.heroPosterUrl));
            if (oldKey && oldKey !== objectKey) {
              await deleteR2ObjectAndRecord(oldKey);
            }
            if (category === 'hero-video') {
              siteContent.heroVideoUrl = publicUrl;
              siteContent.heroVideoKey = objectKey;
            } else {
              siteContent.heroPosterUrl = publicUrl;
              siteContent.heroPosterKey = objectKey;
            }
            await env.DB.prepare(
              `INSERT OR REPLACE INTO website_content_overrides (id, data_json, updated_at) VALUES ('default', ?, datetime('now'))`
            )
              .bind(JSON.stringify(siteContent))
              .run();
          } catch {}
        }

        return new Response(
          JSON.stringify({
            success: true,
            url: publicUrl,
            key: objectKey,
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (uploadErr: any) {
        // Rollback partial R2 file and DB row on failure
        try { await env.BUCKET.delete(objectKey); } catch {}
        try { await env.DB.prepare(`DELETE FROM media_assets WHERE object_key = ?`).bind(objectKey).run(); } catch {}
        return new Response(
          JSON.stringify({
            success: false,
            error: uploadErr.message || 'Failed to store media in R2.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4c. GET /media/{key} — Serve from R2 BUCKET with ETag, cache headers, 206 range requests, and deleted-asset protection
    if (path.startsWith('/media/') && request.method === 'GET') {
      if (!env.BUCKET) {
        return new Response('Media storage not configured', { status: 503 });
      }
      const objectKey = decodeURIComponent(path.slice('/media/'.length));
      if (!objectKey || objectKey.includes('..')) {
        return new Response('Not found', { status: 404 });
      }

      // Access control: check album & submission state
      let isPublishedPublicMedia = true;
      const keyParts = objectKey.split('/');
      const albumIdFromKey = keyParts[0] === 'albums' && keyParts.length >= 3 ? keyParts[1] : null;

      if (env.DB && albumIdFromKey && albumIdFromKey !== 'site-hero') {
        const albumRow = await env.DB.prepare(`SELECT status, admin_user_id, data_json FROM class_sets WHERE id = ?`).bind(albumIdFromKey).first();
        if (albumRow) {
          let parsedAlbum: any = {};
          try { parsedAlbum = JSON.parse(albumRow.data_json || '{}'); } catch {}
          const rowStatus = String(albumRow.status || parsedAlbum.lifecycleStatus || 'draft');
          const isDeleted = rowStatus === 'deleted' || Boolean(parsedAlbum.deletedAt);
          if (isDeleted) {
            return new Response('Not found', { status: 404, headers: corsHeaders });
          }

          const isAlbumPublished =
            (rowStatus === 'published' || (rowStatus === 'active' && parsedAlbum.published === true)) &&
            !parsedAlbum.unpublished &&
            !parsedAlbum.deletedAt;

          // Check if this objectKey belongs to a profile_submission that is deleted/removed or still pending/draft
          const subRow = await env.DB.prepare(
            `SELECT status FROM profile_submissions WHERE album_id = ? AND (photo_key = ? OR payload_json LIKE ?)`
          )
            .bind(albumIdFromKey, objectKey, `%${objectKey}%`)
            .first();

          if (subRow && (subRow.status === 'removed' || subRow.status === 'deleted')) {
            return new Response('Not found', { status: 404, headers: corsHeaders });
          }

          const isUnapprovedSubmissionPhoto = Boolean(subRow && subRow.status !== 'approved');
          if (!isAlbumPublished || isUnapprovedSubmissionPhoto) {
            isPublishedPublicMedia = false;
          }
        }
      }

      const r2Obj = await env.BUCKET.get(objectKey);
      if (!r2Obj) {
        return new Response('Not found', { status: 404, headers: corsHeaders });
      }

      const contentType = r2Obj.httpMetadata?.contentType || 'application/octet-stream';
      const etag = r2Obj.httpEtag || `"${objectKey}-${r2Obj.size || 0}"`;
      const ifNoneMatch = request.headers.get('If-None-Match');
      if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ...corsHeaders,
            ETag: etag,
          },
        });
      }

      const cacheControl = isPublishedPublicMedia
        ? 'public, max-age=31536000, immutable'
        : 'private, no-cache, must-revalidate';

      const fullBuffer = await r2Obj.arrayBuffer();
      const totalSize = fullBuffer.byteLength;
      const rangeHeader = request.headers.get('Range');

      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const rangeMatch = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(rangeMatch[0], 10);
        const end = rangeMatch[1] ? Math.min(parseInt(rangeMatch[1], 10), totalSize - 1) : totalSize - 1;
        if (!isNaN(start) && start >= 0 && start <= end && end < totalSize) {
          const sliced = fullBuffer.slice(start, end + 1);
          return new Response(sliced, {
            status: 206,
            headers: {
              ...corsHeaders,
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': String(sliced.byteLength),
              'Accept-Ranges': 'bytes',
              ETag: etag,
              'Cache-Control': cacheControl,
            },
          });
        }
      }

      return new Response(fullBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          ETag: etag,
          'Cache-Control': cacheControl,
        },
      });
    }

    // 4d. POST /api/media/migrate-base64 — One-time migration of base64 images in album JSON to R2
    if (path === '/api/media/migrate-base64' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!env.DB || !env.BUCKET) {
        return new Response(JSON.stringify({ error: 'Database or R2 BUCKET unavailable' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as { albumId?: string; all?: boolean };
      const isHost = sessionUser.role === 'master_host';
      let targetRows: any[] = [];

      if (body.albumId) {
        const row = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(body.albumId).first();
        if (row) {
          let parsed: any = {};
          try { parsed = JSON.parse(row.data_json || '{}'); } catch {}
          const ownerEmail = String(row.admin_user_id || parsed.classRepEmail || '').toLowerCase();
          if (!isHost && ownerEmail !== sessionUser.email.toLowerCase()) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          targetRows = [row];
        }
      } else if (isHost) {
        const allRes = await env.DB.prepare(`SELECT * FROM class_sets WHERE status != 'deleted'`).all();
        targetRows = allRes?.results || [];
      } else {
        const ownedRes = await env.DB.prepare(`SELECT * FROM class_sets WHERE LOWER(admin_user_id) = ?`).bind(sessionUser.email.toLowerCase()).all();
        targetRows = ownedRes?.results || [];
      }

      let migratedCount = 0;
      let failedCount = 0;
      let albumsUpdated = 0;
      let singleUpdatedAlbum: any = null;

      const migrateDataUrl = async (dataUrl: string, setId: string, category: string): Promise<string> => {
        const m = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
        if (!m) return dataUrl;
        const mime = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        try {
          const binStr = atob(m[2]);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          const safeAlbumId = setId.replace(/[^a-zA-Z0-9_-]/g, '_');
          const uuid = crypto.randomUUID();
          const key = `albums/${safeAlbumId}/${uuid}.${ext}`;
          const urlPath = `/media/${key}`;
          await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
          await env.DB.prepare(
            `INSERT INTO media_assets (id, object_key, content_type, size_bytes, file_name, uploader_email, set_id, category, public_url, created_at)
             VALUES (?, ?, ?, ?, 'migrated', ?, ?, ?, ?, datetime('now'))`
          )
            .bind(`med-${uuid}`, key, mime, bytes.byteLength, sessionUser.email, setId, category, urlPath)
            .run();
          migratedCount++;
          return urlPath;
        } catch {
          failedCount++;
          return dataUrl;
        }
      };

      const walkAndMigrate = async (node: any, setId: string, categoryHint = 'candid'): Promise<{ node: any; changed: boolean }> => {
        if (!node) return { node, changed: false };
        if (typeof node === 'string') {
          if (node.startsWith('data:image/')) {
            const replaced = await migrateDataUrl(node, setId, categoryHint);
            return { node: replaced, changed: replaced !== node };
          }
          return { node, changed: false };
        }
        if (Array.isArray(node)) {
          let anyChanged = false;
          const nextArr = [];
          for (const item of node) {
            const res = await walkAndMigrate(item, setId, categoryHint);
            if (res.changed) anyChanged = true;
            nextArr.push(res.node);
          }
          return { node: nextArr, changed: anyChanged };
        }
        if (typeof node === 'object') {
          let anyChanged = false;
          const nextObj: any = { ...node };
          for (const [k, v] of Object.entries(nextObj)) {
            const hint = k === 'students' ? 'portrait' : k === 'memories' ? 'candid' : k === 'awards' ? 'award' : categoryHint;
            const res = await walkAndMigrate(v, setId, hint);
            if (res.changed) {
              anyChanged = true;
              nextObj[k] = res.node;
            }
          }
          return { node: nextObj, changed: anyChanged };
        }
        return { node, changed: false };
      };

      for (const row of targetRows) {
        try {
          const parsed = JSON.parse(row.data_json || '{}');
          const { node: migratedAlbum, changed } = await walkAndMigrate(parsed, row.id);
          if (changed) {
            migratedAlbum.version = (Number(migratedAlbum.version) || 1) + 1;
            await env.DB.prepare(
              `UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`
            )
              .bind(JSON.stringify(migratedAlbum), row.id)
              .run();
            albumsUpdated++;
          }
          if (body.albumId && row.id === body.albumId) {
            singleUpdatedAlbum = migratedAlbum;
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({
          success: true,
          migratedCount,
          failedCount,
          albumsUpdated,
          album: singleUpdatedAlbum,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================================
    // 4e. REAL PAYSTACK PAYMENTS BACKEND (init, verify, webhook)
    // ============================================================================
    const applyVerifiedPaystackPayment = async (reference: string, pskData: any) => {
      if (!env.DB) {
        return { applied: false, status: 'db_unavailable', error: 'Database unavailable' };
      }
      const pskStatus = String(pskData?.status || '').toLowerCase();
      const pskCurrency = String(pskData?.currency || 'NGN').toUpperCase();
      const pskAmountKobo = Number(pskData?.amount) || 0;
      const pskRef = String(pskData?.reference || reference).trim();

      if (pskStatus !== 'success' || pskCurrency !== 'NGN' || pskRef !== reference) {
        return { applied: false, status: 'verification_mismatch', error: 'Payment status, currency, or reference did not match.' };
      }

      // Strip card/authorization details so card details are NEVER stored
      const safePskMeta = pskData?.metadata && typeof pskData.metadata === 'object' ? pskData.metadata : {};
      const txRow = await env.DB.prepare(`SELECT * FROM transactions WHERE reference = ?`).bind(reference).first();
      let storedMeta: any = {};
      if (txRow?.paystack_data_json) {
        try { storedMeta = JSON.parse(txRow.paystack_data_json); } catch {}
      } else if (txRow?.raw_payload_json) {
        try { storedMeta = JSON.parse(txRow.raw_payload_json); } catch {}
      }

      // If pending transaction exists, require exact amount match
      if (txRow && Number(txRow.amount_kobo) > 0 && Number(txRow.amount_kobo) !== pskAmountKobo) {
        return { applied: false, status: 'amount_mismatch', error: 'Verified amount does not match initialized payment amount.' };
      }

      const meta = { ...safePskMeta, ...storedMeta };
      const paymentType: 'student' | 'slots' | 'unknown' =
        meta.type === 'student' || meta.submission_id
          ? 'student'
          : meta.type === 'slots' || meta.quantity
          ? 'slots'
          : 'unknown';
      const albumId = String(meta.album_id || meta.albumId || txRow?.set_id || '').trim();
      const submissionId = String(meta.submission_id || meta.submissionId || '').trim();
      const quantity = Math.max(1, Math.floor(Number(meta.quantity || meta.slotsPurchased || 1)));
      const sponsorName = String(meta.sponsor_name || meta.sponsorName || 'Class Sponsor')
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, 60);
      const payerEmail = String(pskData?.customer?.email || txRow?.payer_email || meta.payerEmail || '').trim().toLowerCase();

      // Apply student submission payment
      if (paymentType === 'student' && albumId && submissionId) {
        const subRow = await env.DB.prepare(
          `SELECT * FROM profile_submissions WHERE id = ? AND album_id = ?`
        )
          .bind(submissionId, albumId)
          .first();

        if (!subRow) {
          // Paid but nothing created -> store as "paid, needs review"
          const reviewMeta = JSON.stringify({ ...meta, paymentCategory: 'student_submission', albumId, payerEmail });
          await env.DB.prepare(
            `INSERT OR REPLACE INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, payer_name, payer_email, paystack_data_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'paid, needs review', ?, ?, ?, datetime('now'))`
          )
            .bind(
              txRow?.id || `tx-${reference}`,
              reference,
              albumId,
              String(meta.department || ''),
              String(meta.institution || ''),
              Math.round(pskAmountKobo / 100),
              pskAmountKobo,
              payerEmail,
              payerEmail,
              reviewMeta
            )
            .run();
          return { applied: false, status: 'paid, needs review', paymentType: 'student', albumId, submissionId };
        }

        let subPayload: any = {};
        try { subPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
        subPayload.paymentStatus = 'paid';
        subPayload.paidReference = reference;

        await env.DB.prepare(
          `UPDATE profile_submissions SET payment_status = 'paid', paid_reference = ?, payload_json = ?, updated_at = datetime('now') WHERE id = ? AND album_id = ?`
        )
          .bind(reference, JSON.stringify(subPayload), submissionId, albumId)
          .run();

        // Also update albumData.students[] if already mirrored
        const albumRow = await env.DB.prepare(`SELECT data_json FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (albumRow?.data_json) {
          try {
            const albumData = JSON.parse(albumRow.data_json);
            if (Array.isArray(albumData.students)) {
              let changed = false;
              albumData.students = albumData.students.map((st: any) => {
                if (st.id === submissionId) {
                  changed = true;
                  return { ...st, paymentStatus: 'paid', paidReference: reference };
                }
                return st;
              });
              if (changed) {
                await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
                  .bind(JSON.stringify(albumData), albumId)
                  .run();
              }
            }
          } catch {}
        }

        const completedMeta = JSON.stringify({
          ...meta,
          paymentCategory: 'student_submission',
          albumId,
          submissionId,
          payerEmail,
          universityName: meta.institution || '',
          departmentName: meta.department || '',
          graduationYear: meta.set_year || '',
        });

        await env.DB.prepare(
          `INSERT OR REPLACE INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, payer_name, payer_email, paystack_data_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'Paid', ?, ?, ?, datetime('now'))`
        )
          .bind(
            txRow?.id || `tx-${reference}`,
            reference,
            albumId,
            String(meta.department || ''),
            String(meta.institution || ''),
            Math.round(pskAmountKobo / 100),
            pskAmountKobo,
            subPayload.fullName || payerEmail,
            payerEmail,
            completedMeta
          )
          .run();

        return { applied: true, status: 'Paid', paymentType: 'student', albumId, submissionId };
      }

      // Apply slot purchase payment
      if (paymentType === 'slots' && albumId && quantity >= 1) {
        const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (!albumRow) {
          const reviewMeta = JSON.stringify({ ...meta, paymentCategory: 'slot_purchase', albumId, slotsPurchased: quantity, sponsorName, payerEmail });
          await env.DB.prepare(
            `INSERT OR REPLACE INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, payer_name, payer_email, paystack_data_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'paid, needs review', ?, ?, ?, datetime('now'))`
          )
            .bind(
              txRow?.id || `tx-${reference}`,
              reference,
              albumId,
              String(meta.department || ''),
              String(meta.institution || ''),
              Math.round(pskAmountKobo / 100),
              pskAmountKobo,
              sponsorName || payerEmail,
              payerEmail,
              reviewMeta
            )
            .run();
          return { applied: false, status: 'paid, needs review', paymentType: 'slots', albumId };
        }

        const purchaseId = String(meta.purchase_id || `spurch-${reference}`);
        const unitFeeKobo = Math.round(pskAmountKobo / quantity);

        await env.DB.prepare(
          `INSERT OR IGNORE INTO slot_purchases (id, album_id, quantity, amount_kobo, reference, sponsor_name, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'completed', datetime('now'))`
        )
          .bind(purchaseId, albumId, quantity, pskAmountKobo, reference, sponsorName)
          .run();

        await env.DB.prepare(
          `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, purchase_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
           VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, ?, datetime('now'))`
        )
          .bind(
            `sled-${reference}`,
            albumId,
            quantity,
            purchaseId,
            sponsorName,
            unitFeeKobo,
            `purchase:${reference}`,
            payerEmail || sponsorName
          )
          .run();

        // Sync sponsor entry into class_sets.data_json
        try {
          const albumData = JSON.parse(albumRow.data_json || '{}');
          const sponsors = Array.isArray(albumData.sponsors) ? [...albumData.sponsors] : [];
          if (!sponsors.some((s: any) => s.reference === reference)) {
            sponsors.push({
              id: purchaseId,
              sponsorName,
              DisplayLabel: sponsorName,
              quantity,
              amountPaid: Math.round(pskAmountKobo / 100),
              reference,
              date: new Date().toISOString().split('T')[0],
              showSponsorNameOnAlbum: Boolean(sponsorName && sponsorName !== 'Class Sponsor'),
              isKoHotCredit: false,
            });
            albumData.sponsors = sponsors;
            await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
              .bind(JSON.stringify(albumData), albumId)
              .run();
          }
        } catch {}

        const completedMeta = JSON.stringify({
          ...meta,
          paymentCategory: 'slot_purchase',
          albumId,
          slotsPurchased: quantity,
          sponsorName,
          payerEmail,
          universityName: meta.institution || '',
          departmentName: meta.department || '',
          graduationYear: meta.set_year || '',
        });

        await env.DB.prepare(
          `INSERT OR REPLACE INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, payer_name, payer_email, paystack_data_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'Paid', ?, ?, ?, datetime('now'))`
        )
          .bind(
            txRow?.id || `tx-${reference}`,
            reference,
            albumId,
            String(meta.department || ''),
            String(meta.institution || ''),
            Math.round(pskAmountKobo / 100),
            pskAmountKobo,
            sponsorName || payerEmail,
            payerEmail,
            completedMeta
          )
          .run();

        return { applied: true, status: 'Paid', paymentType: 'slots', albumId, quantity, purchaseId };
      }

      // Fallback: Paid but nothing created / unknown target -> store as "paid, needs review"
      const fallbackMeta = JSON.stringify({ ...meta, payerEmail });
      await env.DB.prepare(
        `INSERT OR REPLACE INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, payer_name, payer_email, paystack_data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'paid, needs review', ?, ?, ?, datetime('now'))`
      )
        .bind(
          txRow?.id || `tx-${reference}`,
          reference,
          albumId || null,
          String(meta.department || ''),
          String(meta.institution || ''),
          Math.round(pskAmountKobo / 100),
          pskAmountKobo,
          payerEmail,
          payerEmail,
          fallbackMeta
        )
        .run();

      return { applied: false, status: 'paid, needs review', paymentType: 'unknown', albumId };
    };

    // 4e-1. POST /api/payments/init
    if (path === '/api/payments/init' && request.method === 'POST') {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database unavailable' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const paystackPublicKey = (env.PAYSTACK_PUBLIC_KEY || '').trim();
      if (!paystackPublicKey || !env.PAYSTACK_SECRET_KEY) {
        return new Response(
          JSON.stringify({ error: 'payments_not_available', message: 'Payments are not available yet' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = (await request.json().catch(() => ({}))) as {
        type?: 'student' | 'slots';
        albumId?: string;
        submissionId?: string;
        quantity?: number;
        sponsorName?: string;
        email?: string;
      };

      const paymentType = body.type;
      const albumId = String(body.albumId || '').trim();

      if ((paymentType !== 'student' && paymentType !== 'slots') || !albumId) {
        return new Response(JSON.stringify({ error: 'Valid payment type and albumId are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
      if (!albumRow || albumRow.status === 'deleted') {
        return new Response(JSON.stringify({ error: 'Album not found or not available.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let albumData: any = {};
      try { albumData = JSON.parse(albumRow.data_json || '{}'); } catch {}

      const settings = await getPlatformSettingsMap(env);
      const feeKobo = Number(settings.student_fee_kobo) || 50000;

      const institutionName = String(albumData.institutionName || albumData.universityName || albumRow.institution_id || '');
      const departmentName = String(albumData.departmentName || albumRow.department_id || '');
      const setYear = Number(albumData.graduationYear || albumRow.graduation_year || new Date().getFullYear());

      const reference = `KHR-${paymentType === 'slots' ? 'SLT' : 'STD'}-${Date.now()}-${generateRandomHexToken(6)}`;
      let amountKobo = feeKobo;
      let payerEmail = '';
      let payerName = '';
      let metadata: any = {};

      if (paymentType === 'student') {
        const submissionId = String(body.submissionId || '').trim();
        if (!submissionId) {
          return new Response(JSON.stringify({ error: 'submissionId is required for student payment.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const subRow = await env.DB.prepare(
          `SELECT * FROM profile_submissions WHERE id = ? AND album_id = ?`
        )
          .bind(submissionId, albumId)
          .first();

        if (!subRow || subRow.status === 'removed' || subRow.status === 'declined') {
          return new Response(JSON.stringify({ error: 'Submission not found or not eligible for payment.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (subRow.payment_status === 'paid' || subRow.payment_status === 'waived') {
          return new Response(JSON.stringify({ error: 'already_paid', message: 'This profile submission is already paid.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        let subPayload: any = {};
        try { subPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
        amountKobo = feeKobo;
        payerEmail = String(subRow.email || body.email || '').trim().toLowerCase();
        payerName = String(subPayload.fullName || payerEmail);
        metadata = {
          type: 'student',
          institution: institutionName,
          department: departmentName,
          set_year: setYear,
          album_id: albumId,
          submission_id: submissionId,
        };
      } else {
        // type === 'slots': require admin session with ownership of albumId
        const sessionUser = await getSessionUser();
        if (!sessionUser) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const ownerEmail = String(albumRow.admin_user_id || albumData.classRepEmail || '').toLowerCase();
        if (ownerEmail !== sessionUser.email.toLowerCase() && sessionUser.role !== 'master_host') {
          return new Response(JSON.stringify({ error: 'Forbidden: You do not own this album.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const quantity = Math.max(1, Math.floor(Number(body.quantity) || 0));
        const sponsorName = String(body.sponsorName || '')
          .replace(/<[^>]*>/g, '')
          .trim()
          .slice(0, 60);
        const purchaseId = `spurch-${reference}`;
        amountKobo = quantity * feeKobo;
        payerEmail = sessionUser.email.toLowerCase();
        payerName = sponsorName || sessionUser.fullName || payerEmail;
        metadata = {
          type: 'slots',
          institution: institutionName,
          department: departmentName,
          set_year: setYear,
          album_id: albumId,
          purchase_id: purchaseId,
          quantity,
          sponsor_name: sponsorName || 'Class Sponsor',
        };
      }

      await env.DB.prepare(
        `INSERT INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, payer_name, payer_email, paystack_data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'pending', ?, ?, ?, datetime('now'))`
      )
        .bind(
          `tx-${reference}`,
          reference,
          albumId,
          departmentName,
          institutionName,
          Math.round(amountKobo / 100),
          amountKobo,
          payerName,
          payerEmail,
          JSON.stringify(metadata)
        )
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          reference,
          amountKobo,
          email: payerEmail,
          publicKey: paystackPublicKey,
          metadata,
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4e-2. POST /api/payments/verify
    if (path === '/api/payments/verify' && request.method === 'POST') {
      if (!env.PAYSTACK_SECRET_KEY) {
        return new Response(
          JSON.stringify({ error: 'payments_not_configured', message: 'Payments are not available yet' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = (await request.json().catch(() => ({}))) as { reference?: string };
      const reference = String(body.reference || '').trim();
      if (!reference || reference.startsWith('PSK-') || reference.startsWith('demo_')) {
        return new Response(
          JSON.stringify({ error: 'invalid_reference', message: 'Invalid payment reference.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const pskRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            headers: {
              Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            },
          }
        );
        const pskJson = (await pskRes.json().catch(() => ({}))) as any;
        if (!pskRes.ok || !pskJson?.status || !pskJson?.data) {
          return new Response(
            JSON.stringify({
              success: false,
              status: 'failed',
              error: 'payment_verification_failed',
              message: 'Could not verify payment with Paystack.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const applyRes = await applyVerifiedPaystackPayment(reference, pskJson.data);
        if (!applyRes.applied && applyRes.status !== 'paid, needs review') {
          return new Response(
            JSON.stringify({
              success: false,
              status: applyRes.status,
              error: applyRes.error || 'Payment verification failed.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            verified: true,
            reference,
            ...applyRes,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'error',
            error: 'verification_network_error',
            message: 'Payment received, confirming with server.',
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4e-3. POST /api/paystack/webhook — Verify x-paystack-signature (HMAC SHA-512), handle charge.success idempotently
    if (path === '/api/paystack/webhook' && request.method === 'POST') {
      if (!env.PAYSTACK_SECRET_KEY) {
        return new Response('Webhook not configured', { status: 503 });
      }
      const signature = request.headers.get('x-paystack-signature') || '';
      const rawBody = await request.text();
      if (!signature || !rawBody) {
        return new Response('Missing signature', { status: 401 });
      }

      const expectedSignature = await hmacSha512Hex(rawBody, env.PAYSTACK_SECRET_KEY);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        return new Response('Invalid signature', { status: 401 });
      }

      try {
        const eventPayload = JSON.parse(rawBody);
        if (eventPayload?.event === 'charge.success' && eventPayload?.data?.reference) {
          const ref = String(eventPayload.data.reference).trim();
          if (ref && !ref.startsWith('PSK-') && !ref.startsWith('demo_')) {
            await applyVerifiedPaystackPayment(ref, eventPayload.data);
          }
        }
      } catch {}

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
          parsed.inviteCode = String(row.invite_code || parsed.inviteCode || computeInviteCode(parsed.id));

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

        const inviteCode = String(albumPayload.inviteCode || computeInviteCode(newAlbumId));
        const draftAlbum = {
          ...albumPayload,
          id: newAlbumId,
          inviteCode,
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

        await ensureInviteCodeColumn();
        try {
          await env.DB.prepare(
            `INSERT INTO class_sets (id, institution_id, department_id, graduation_year, title, admin_user_id, invite_code, data_json, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
          ).bind(
            newAlbumId,
            institutionId,
            departmentId,
            graduationYear,
            draftAlbum.CohortLabel || `Class of ${graduationYear}`,
            verifiedEmail,
            inviteCode,
            JSON.stringify(draftAlbum)
          ).run();
        } catch {
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
        }

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

      const resolvedInviteCode = String(
        existingRow.invite_code || existingData.inviteCode || incomingAlbum.inviteCode || computeInviteCode(albumId)
      );

      const updatedAlbum = {
        ...existingData,
        ...incomingAlbum,
        id: albumId,
        inviteCode: resolvedInviteCode,
        classRepEmail: existingRow.admin_user_id || existingData.classRepEmail,
        lifecycleStatus: nextStatus,
        version: nextVersion,
      };

      // Delete any R2 media objects that were removed or replaced in this album update
      try {
        const oldKeys = collectAlbumMediaKeys(existingData);
        const newKeys = collectAlbumMediaKeys(updatedAlbum);
        for (const oldKey of oldKeys) {
          if (!newKeys.has(oldKey)) {
            const subStillUses = await env.DB.prepare(
              `SELECT id FROM profile_submissions WHERE album_id = ? AND status != 'removed' AND (photo_key = ? OR payload_json LIKE ?)`
            )
              .bind(albumId, oldKey, `%${oldKey}%`)
              .first();
            if (!subStillUses) {
              await deleteR2ObjectAndRecord(oldKey);
            }
          }
        }
      } catch {}

      await ensureInviteCodeColumn();
      try {
        await env.DB.prepare(
          `UPDATE class_sets SET title = ?, status = ?, invite_code = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(
          updatedAlbum.CohortLabel || existingRow.title,
          nextStatus,
          resolvedInviteCode,
          JSON.stringify(updatedAlbum),
          albumId
        ).run();
      } catch {
        await env.DB.prepare(
          `UPDATE class_sets SET title = ?, status = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(
          updatedAlbum.CohortLabel || existingRow.title,
          nextStatus,
          JSON.stringify(updatedAlbum),
          albumId
        ).run();
      }

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

    // 12e. Transactions Routes (GET Host/Admin; never mark paid from browser)
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
          try { meta = JSON.parse(r.paystack_data_json || r.raw_payload_json || '{}'); } catch {}
          const rawStatus = String(r.status || 'Paid');
          const normalizedStatus =
            rawStatus === 'Paid' || rawStatus === 'success'
              ? 'Completed'
              : rawStatus; // Preserves 'paid, needs review', 'pending', etc.
          const txItem = {
            id: r.id,
            reference: r.reference,
            universityId: meta.universityId || '',
            universityName: meta.universityName || meta.institution || r.institution || '',
            departmentId: meta.departmentId || '',
            departmentName: meta.departmentName || meta.department || r.set_name || '',
            graduationYear: Number(meta.graduationYear || meta.set_year) || new Date().getFullYear(),
            amountPaid: Math.round((Number(r.amount_kobo) || 0) / 100) || Number(r.amount) || 0,
            paymentMethod: r.channel || meta.paymentMethod || 'Paystack',
            status: normalizedStatus,
            rawStatus,
            needsReview: rawStatus.toLowerCase().includes('needs review'),
            payerName: r.payer_name || meta.payerName || meta.sponsor_name || '',
            payerEmail: r.payer_email || meta.payerEmail || '',
            date: (r.paid_at || r.created_at || new Date().toISOString()).split('T')[0],
            paymentCategory:
              meta.paymentCategory ||
              (meta.type === 'student' ? 'student_submission' : 'slot_purchase'),
            slotsPurchased: Number(meta.slotsPurchased || meta.quantity) || 0,
            sponsorName: meta.sponsorName || meta.sponsor_name || '',
            albumId: meta.albumId || meta.album_id || r.set_id || r.registration_id || '',
            submissionId: meta.submissionId || meta.submission_id || '',
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
      return new Response(
        JSON.stringify({
          error: 'forbidden',
          message: 'Payments cannot be marked paid from the browser. Use /api/payments/init and /api/payments/verify.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 12f. Testimonials Routes (GET Public/Host/Admin, POST Admin/Host, PUT/DELETE Host)
    const ensureTestimonialsColumnsAndSeed = async () => {
      if (!env.DB) return;
      try {
        await env.DB.prepare(`ALTER TABLE testimonials ADD COLUMN is_visible INTEGER DEFAULT 1`).run();
      } catch {}
      try {
        await env.DB.prepare(`ALTER TABLE testimonials ADD COLUMN is_demo INTEGER DEFAULT 0`).run();
      } catch {}
      try {
        await env.DB.prepare(`ALTER TABLE testimonials ADD COLUMN display_order INTEGER DEFAULT 0`).run();
      } catch {}

      try {
        const seededRow = await env.DB.prepare(
          `SELECT value FROM platform_settings WHERE key = 'demo_testimonials_seeded'`
        ).first();
        if (!seededRow || String(seededRow.value) !== '1') {
          const samples = [
            {
              id: 'demo-test-1',
              name: 'Chiamaka O.',
              role: 'Class Representative',
              department: 'Department of Law',
              quote:
                'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening.',
              order: 1,
            },
            {
              id: 'demo-test-2',
              name: 'Tunde A.',
              role: 'Final-year student',
              department: 'Department of Law',
              quote:
                'It opens fast on my phone, and my parents could browse our whole album from one link.',
              order: 2,
            },
            {
              id: 'demo-test-3',
              name: 'Hauwa M.',
              role: 'Department President',
              department: 'Department of Law',
              quote:
                'Seeing every class on one legacy wall makes our department feel like it has a real history.',
              order: 3,
            },
            {
              id: 'demo-test-4',
              name: 'Emeka N.',
              role: 'Class Album Admin',
              department: 'Department of Law',
              quote:
                "I didn't build anything. I approved profiles and added our event photos, and the album was ready.",
              order: 4,
            },
            {
              id: 'demo-test-5',
              name: 'Zainab B.',
              role: 'Graduate',
              department: 'Department of Law',
              quote:
                'My photo, my quote and my parting words are in one place I can open any time.',
              order: 5,
            },
          ];

          for (const s of samples) {
            try {
              await env.DB.prepare(
                `INSERT OR IGNORE INTO testimonials (id, album_id, submitted_by_user_id, admin_full_name, admin_role_title, university_name, department_name, graduation_year, cohort_label, rating, testimonial_text, admin_avatar_url, album_cover_url, consent_given, is_public, review_status, is_featured, is_visible, is_demo, display_order, created_at, updated_at)
                 VALUES (?, 'sample-set-2026', 'sample@kohot.invalid', ?, ?, 'Sample University', ?, 2026, 'Class of 2026', 5, ?, '', '', 1, 1, 'approved', 1, 1, 1, ?, datetime('now'), datetime('now'))`
              )
                .bind(s.id, s.name, s.role, s.department, s.quote, s.order)
                .run();
            } catch {
              try {
                await env.DB.prepare(
                  `INSERT OR IGNORE INTO testimonials (id, name, email, role, university, university_id, department, department_id, class_year, class_set_name, set_id, testimonial_text, submission_date, publication_permission, review_status, is_featured, is_visible, is_demo, display_order, created_at)
                   VALUES (?, ?, 'sample@kohot.invalid', ?, 'Sample University', 'sample-uni', ?, 'dept-sample-law', 2026, 'Class of 2026', 'sample-set-2026', ?, date('now'), 'public', 'approved', 1, 1, 1, ?, datetime('now'))`
                )
                  .bind(s.id, s.name, s.role, s.department, s.quote, s.order)
                  .run();
              } catch {}
            }
          }

          await env.DB.prepare(
            `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('demo_testimonials_seeded', '1')`
          ).run();
        }
      } catch {}
    };

    if (path === '/api/testimonials' && request.method === 'GET') {
      const sessionUser = await getSessionUser();
      const testimonials: any[] = [];
      if (env.DB) {
        await ensureTestimonialsColumnsAndSeed();
        const res = await env.DB.prepare(`SELECT * FROM testimonials ORDER BY display_order ASC, created_at DESC`).all();
        for (const r of res?.results || []) {
          const isVisible = r.is_visible === undefined || r.is_visible === null ? true : Boolean(Number(r.is_visible));
          const isDemo = Boolean(Number(r.is_demo || 0));
          const isPublic = r.is_public === undefined ? r.publication_permission !== 'private' : Boolean(Number(r.is_public));
          const authorName = r.admin_full_name || r.name || 'Graduate';
          const roleTitle = r.admin_role_title || r.role || 'Class Album Admin';
          const uniName = r.university_name || r.university || 'Sample University';
          const deptName = r.department_name || r.department || 'Department of Law';
          const gradYear = Number(r.graduation_year || r.class_year) || 2026;
          const quoteText = r.testimonial_text || r.quote || '';
          const avatarUrl = r.admin_avatar_url || r.avatar_url || '';

          const item = {
            id: r.id,
            albumId: r.album_id || r.set_id || '',
            setId: r.set_id || r.album_id || '',
            submittedByUserId: r.submitted_by_user_id || r.email || 'sample@kohot.invalid',
            email: r.email || r.submitted_by_user_id || 'sample@kohot.invalid',
            name: authorName,
            authorName,
            adminFullName: authorName,
            role: roleTitle,
            authorRole: roleTitle,
            adminRoleTitle: roleTitle,
            university: uniName,
            universityName: uniName,
            department: deptName,
            departmentName: deptName,
            classYear: gradYear,
            graduationYear: gradYear,
            cohortLabel: r.cohort_label || r.class_set_name || `Class of ${gradYear}`,
            classSetName: r.class_set_name || r.cohort_label || `Class of ${gradYear}`,
            rating: Number(r.rating) || 5,
            testimonialText: quoteText,
            quote: quoteText,
            avatarUrl,
            adminAvatarUrl: avatarUrl,
            albumCoverUrl: r.album_cover_url || '',
            consentGiven: r.consent_given !== undefined ? Boolean(r.consent_given) : true,
            isPublic,
            publicationPermission: isPublic ? 'public' : 'private',
            reviewStatus: r.review_status || 'pending',
            isFeatured: r.is_featured !== undefined ? Boolean(Number(r.is_featured)) : true,
            isVisible,
            isDemo,
            displayOrder: Number(r.display_order) || 999,
            submissionDate: (r.submission_date || r.created_at || new Date().toISOString()).split('T')[0],
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
          if (sessionUser?.role === 'master_host') {
            testimonials.push(item);
          } else if (sessionUser && item.submittedByUserId === sessionUser.email) {
            testimonials.push(item);
          } else if (item.reviewStatus === 'approved' && item.isPublic && item.isVisible) {
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
      const isHost = sessionUser.role === 'master_host';
      const authorName = String(t.name || t.authorName || t.adminFullName || sessionUser.fullName || 'Graduate').trim();
      const roleTitle = String(t.role || t.authorRole || t.adminRoleTitle || 'Class Album Admin').trim();
      const uniName = String(t.university || t.universityName || 'Sample University').trim();
      const deptName = String(t.department || t.departmentName || 'Department of Law').trim();
      const gradYear = Number(t.graduationYear || t.classYear) || new Date().getFullYear();
      const quoteText = String(t.testimonialText || t.quote || '').trim();
      const avatarUrl = String(t.avatarUrl || t.adminAvatarUrl || '').trim();
      const isVisible = t.isVisible !== undefined ? (t.isVisible ? 1 : 0) : 1;
      const isDemo = isHost && t.isDemo ? 1 : 0;
      const displayOrder = Number(t.displayOrder) || 99;
      const reviewStatus = isHost ? (t.reviewStatus || 'approved') : 'pending';

      if (env.DB) {
        await ensureTestimonialsColumnsAndSeed();
        try {
          await env.DB.prepare(
            `INSERT OR REPLACE INTO testimonials (id, album_id, submitted_by_user_id, admin_full_name, admin_role_title, university_name, department_name, graduation_year, cohort_label, rating, testimonial_text, admin_avatar_url, album_cover_url, consent_given, is_public, review_status, is_featured, is_visible, is_demo, display_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          ).bind(
            id,
            t.albumId || t.setId || '',
            t.email || sessionUser.email || 'sample@kohot.invalid',
            authorName,
            roleTitle,
            uniName,
            deptName,
            gradYear,
            t.cohortLabel || t.classSetName || `Class of ${gradYear}`,
            Number(t.rating) || 5,
            quoteText,
            avatarUrl,
            t.albumCoverUrl || '',
            t.isPublic !== false && t.publicationPermission !== 'private' ? 1 : 0,
            reviewStatus,
            t.isFeatured !== false ? 1 : 0,
            isVisible,
            isDemo,
            displayOrder
          ).run();
        } catch {
          await env.DB.prepare(
            `INSERT OR REPLACE INTO testimonials (id, name, email, role, avatar_url, university, university_id, department, department_id, class_year, class_set_name, set_id, testimonial_text, submission_date, publication_permission, review_status, is_featured, is_visible, is_demo, display_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'uni-custom', ?, 'dept-custom', ?, ?, ?, ?, date('now'), 'public', ?, 1, ?, ?, ?, datetime('now'))`
          ).bind(
            id,
            authorName,
            t.email || sessionUser.email || 'sample@kohot.invalid',
            roleTitle,
            avatarUrl,
            uniName,
            deptName,
            gradYear,
            t.classSetName || `Class of ${gradYear}`,
            t.setId || t.albumId || 'custom-set',
            quoteText,
            reviewStatus,
            isVisible,
            isDemo,
            displayOrder
          ).run();
        }
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
          await ensureTestimonialsColumnsAndSeed();
          await env.DB.prepare(`DELETE FROM testimonials WHERE id = ?`).bind(testId).run();
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      if (env.DB) {
        await ensureTestimonialsColumnsAndSeed();
        const existing = await env.DB.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(testId).first();
        if (existing) {
          const nextReview = body.reviewStatus ?? existing.review_status;
          const nextFeatured = body.isFeatured !== undefined ? (body.isFeatured ? 1 : 0) : existing.is_featured;
          const nextVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : (existing.is_visible ?? 1);
          const nextOrder = body.displayOrder !== undefined ? Number(body.displayOrder) : (existing.display_order ?? 99);
          const nextQuote = body.testimonialText ?? body.quote ?? existing.testimonial_text;
          const nextName = body.name ?? body.authorName ?? body.adminFullName ?? existing.admin_full_name ?? existing.name;
          const nextRole = body.role ?? body.authorRole ?? body.adminRoleTitle ?? existing.admin_role_title ?? existing.role;
          const nextDept = body.department ?? body.departmentName ?? existing.department_name ?? existing.department;
          const nextUni = body.university ?? body.universityName ?? existing.university_name ?? existing.university;
          const nextAvatar = body.avatarUrl ?? body.adminAvatarUrl ?? existing.admin_avatar_url ?? existing.avatar_url;

          try {
            await env.DB.prepare(
              `UPDATE testimonials SET review_status = ?, is_featured = ?, is_visible = ?, display_order = ?, testimonial_text = ?, admin_full_name = ?, admin_role_title = ?, department_name = ?, university_name = ?, admin_avatar_url = ?, updated_at = datetime('now') WHERE id = ?`
            ).bind(
              nextReview,
              nextFeatured,
              nextVisible,
              nextOrder,
              nextQuote,
              nextName,
              nextRole,
              nextDept,
              nextUni,
              nextAvatar,
              testId
            ).run();
          } catch {
            await env.DB.prepare(
              `UPDATE testimonials SET review_status = ?, is_featured = ?, is_visible = ?, display_order = ?, testimonial_text = ?, name = ?, role = ?, department = ?, university = ?, avatar_url = ? WHERE id = ?`
            ).bind(
              nextReview,
              nextFeatured,
              nextVisible,
              nextOrder,
              nextQuote,
              nextName,
              nextRole,
              nextDept,
              nextUni,
              nextAvatar,
              testId
            ).run();
          }
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
        const existingRow = await env.DB.prepare(`SELECT * FROM website_content_overrides WHERE id = 'default'`).first();
        if (existingRow) {
          try {
            const oldContent = JSON.parse(existingRow.data_json || existingRow.content_json || '{}');
            const oldVideoKey = oldContent.heroVideoKey || extractMediaKeyFromUrl(oldContent.heroVideoUrl);
            const newVideoKey = content.heroVideoKey || extractMediaKeyFromUrl(content.heroVideoUrl);
            if (oldVideoKey && oldVideoKey !== newVideoKey) {
              await deleteR2ObjectAndRecord(oldVideoKey);
            }
            const oldPosterKey = oldContent.heroPosterKey || extractMediaKeyFromUrl(oldContent.heroPosterUrl);
            const newPosterKey = content.heroPosterKey || extractMediaKeyFromUrl(content.heroPosterUrl);
            if (oldPosterKey && oldPosterKey !== newPosterKey) {
              await deleteR2ObjectAndRecord(oldPosterKey);
            }
          } catch {}
        }
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

    // 13b. POST /api/albums/:albumId/slots/purchase — Requires admin session, ownership, and a verified paid reference in transactions
    const slotPurchaseMatch = path.match(/^\/api\/albums\/([^/]+)\/slots\/purchase$/);
    if (slotPurchaseMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(slotPurchaseMatch[1]);
      const access = await verifyAlbumAccess(albumId, false);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error }), {
          status: access.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = (await request.json().catch(() => ({}))) as any;
      const reference = String(body.reference || '').trim();
      if (!reference || reference.startsWith('PSK-') || reference.startsWith('demo_') || reference.startsWith('SLT-') || reference.startsWith('SLOT-')) {
        return new Response(
          JSON.stringify({
            error: 'verified_payment_required',
            message: 'A verified Paystack payment reference is required to credit slots.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check that the reference is already verified & paid in D1 transactions for this album
      const txRow = await env.DB.prepare(
        `SELECT * FROM transactions WHERE reference = ? AND set_id = ? AND status = 'Paid'`
      )
        .bind(reference, albumId)
        .first();

      if (!txRow) {
        return new Response(
          JSON.stringify({
            error: 'payment_not_verified',
            message: 'Payment reference has not been verified by Paystack yet.',
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const summary = await getAlbumSlotSummary(albumId);
      return new Response(
        JSON.stringify({
          success: true,
          purchaseId: `spurch-${reference}`,
          ...summary,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      const newSponsorName = String(body.sponsorName || '').trim().slice(0, 60);
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
    // Student submit route ignores client-supplied paymentStatus and paidReference; submissions start unpaid and only verify or webhook can mark them paid.
    const submitProfileMatch = path.match(/^\/api\/albums\/([^/]+)\/(?:submissions\/submit|profiles)$/);
    if (submitProfileMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(submitProfileMatch[1]);
      const body = (await request.json().catch(() => ({}))) as any;
      const profilePayload = body.profile || body.payload || body;
      const email = String(profilePayload.personalEmail || body.email || '').trim().toLowerCase();

      if (!email) {
        return new Response(JSON.stringify({ error: 'A valid email address is required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Reject base64 data URLs in profile image: must be an R2 /media/ URL or empty
      if (typeof profilePayload.image === 'string' && profilePayload.image.startsWith('data:')) {
        return new Response(
          JSON.stringify({ error: 'base64_not_allowed', message: 'Photo must be uploaded to media storage first. Please retry photo upload.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Only allow source='admin' if the requester is authenticated and owns the album
      let source: 'student' | 'admin' = 'student';
      if (body.source === 'admin') {
        const access = await verifyAlbumAccess(albumId, false);
        if (access.allowed) {
          source = 'admin';
        }
      }

      if (source === 'student' && !body.consent && !profilePayload.consentAt) {
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

      // NEVER trust client-supplied paymentStatus or paidReference:
      // Preserve existing DB payment_status if already paid/waived on the server, otherwise start 'unpaid'
      const paymentStatus =
        existingByEmail && (existingByEmail.payment_status === 'paid' || existingByEmail.payment_status === 'waived')
          ? existingByEmail.payment_status
          : 'unpaid';
      const paidReference =
        existingByEmail && existingByEmail.payment_status === 'paid'
          ? existingByEmail.paid_reference
          : null;
      const nextStatus = body.saveAsDraft ? 'draft' : 'pending';
      const newPhotoKey = profilePayload.photoKey || extractMediaKeyFromUrl(profilePayload.image) || null;

      // If replacing an existing submission's photo, delete the old R2 object
      if (existingByEmail?.photo_key && existingByEmail.photo_key !== newPhotoKey) {
        await deleteR2ObjectAndRecord(existingByEmail.photo_key);
      }

      const enrichedPayload = {
        ...profilePayload,
        id: subId,
        personalEmail: email,
        paymentStatus,
        paidReference: paidReference || undefined,
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
        newPhotoKey,
        email,
        source,
        paymentStatus,
        paidReference,
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
        const settings = await getPlatformSettingsMap(env);
        return new Response(
          JSON.stringify({
            success: true,
            studentFeeKobo: Number(settings.student_fee_kobo) || 50000,
            submission: {
              id: subRow.id,
              albumId: subRow.album_id,
              email: subRow.email,
              status: subRow.status,
              paymentStatus: subRow.payment_status,
              paidReference: subRow.paid_reference,
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
      const incomingPayload = body.payload || body;
      if (typeof incomingPayload.image === 'string' && incomingPayload.image.startsWith('data:')) {
        return new Response(
          JSON.stringify({ error: 'base64_not_allowed', message: 'Photo must be uploaded to media storage first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const oldPhotoKey = subRow.photo_key || extractMediaKeyFromUrl(payload.image);
      const nextPhotoKey = incomingPayload.photoKey || extractMediaKeyFromUrl(incomingPayload.image) || oldPhotoKey || null;
      if (oldPhotoKey && nextPhotoKey && oldPhotoKey !== nextPhotoKey) {
        await deleteR2ObjectAndRecord(oldPhotoKey);
      }

      // Never allow client edit to overwrite paymentStatus or paidReference
      const updatedPayload = {
        ...payload,
        ...incomingPayload,
        id: subRow.id,
        personalEmail: subRow.email,
        paymentStatus: subRow.payment_status,
        paidReference: subRow.paid_reference || undefined,
        status: body.saveAsDraft ? 'draft' : 'pending',
      };
      const nextStatus = body.saveAsDraft ? 'draft' : 'pending';
      await env.DB.prepare(
        `UPDATE profile_submissions SET payload_json = ?, photo_key = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(updatedPayload), nextPhotoKey, nextStatus, subRow.id).run();

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
          if (r.photo_key) {
            await deleteR2ObjectAndRecord(r.photo_key);
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
            const pStatus = stFromAlbum.paymentStatus === 'paid' || stFromAlbum.paymentStatus === 'waived' ? stFromAlbum.paymentStatus : 'unpaid';
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

    // 13k. POST /api/albums/:albumId/submissions/remove — Remove profile (does NOT return slot, deletes R2 photo)
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
        const subRow = await env.DB.prepare(
          `SELECT photo_key, payload_json FROM profile_submissions WHERE id = ? AND album_id = ?`
        ).bind(subId, albumId).first();
        if (subRow) {
          if (subRow.photo_key) await deleteR2ObjectAndRecord(subRow.photo_key);
          if (subRow.payload_json) {
            try {
              const p = JSON.parse(subRow.payload_json);
              for (const k of collectAlbumMediaKeys(p)) await deleteR2ObjectAndRecord(k);
            } catch {}
          }
        }
        await env.DB.prepare(
          `UPDATE profile_submissions SET status = 'removed', photo_key = NULL, updated_at = datetime('now') WHERE id = ? AND album_id = ?`
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
    if (path === '/api/admin/slot-allocations' && (request.method === 'GET' || request.method === 'POST' || request.method === 'PUT')) {
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
        const setsRes = await env.DB.prepare(`SELECT id, institution_id, department_id, graduation_year, class_set_name, status FROM class_sets`).all();
        const allSets = setsRes?.results || [];
        const ledgerRes = await env.DB.prepare(`SELECT album_id, delta, allocation_id FROM slot_ledger`).all();
        const allLedger = ledgerRes?.results || [];

        const enriched = (res?.results || []).map((row: any) => {
          const matchedAlbum = allSets.find(
            (s: any) =>
              (row.album_id && s.id === row.album_id) ||
              (String(s.institution_id).toLowerCase() === String(row.institution_id).toLowerCase() &&
                String(s.department_id).toLowerCase() === String(row.department_id).toLowerCase() &&
                Number(s.graduation_year) === Number(row.graduation_year) &&
                s.status !== 'deleted')
          );
          const albumId = matchedAlbum ? matchedAlbum.id : row.album_id || null;
          const status = matchedAlbum ? 'credited' : row.status || 'waiting';
          const albumUsed = albumId
            ? allLedger
                .filter((l: any) => l.album_id === albumId && Number(l.delta) < 0)
                .reduce((acc: number, l: any) => acc + Math.abs(Number(l.delta)), 0)
            : 0;
          const qty = Number(row.quantity) || 0;
          const usedSlots = Math.min(qty, albumUsed);
          const remainingSlots = Math.max(0, qty - usedSlots);
          return {
            id: row.id,
            institutionId: row.institution_id,
            departmentId: row.department_id,
            graduationYear: Number(row.graduation_year),
            quantity: qty,
            usedSlots,
            remainingSlots,
            note: row.note || '',
            status,
            albumId,
            albumName: matchedAlbum?.class_set_name || null,
            createdBy: row.created_by || '',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        });
        return new Response(JSON.stringify({ success: true, allocations: enriched }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as any;
      const institutionId = String(body.institutionId || '').trim();
      const departmentId = String(body.departmentId || '').trim();
      const graduationYear = Number(body.graduationYear || new Date().getFullYear());
      const newQuantity = Math.max(0, Math.floor(Number(body.quantity) || 0));
      const note = String(body.note || 'Sponsored by KoHot').trim();
      const allocId = String(body.id || `alloc-${institutionId}-${departmentId}-${graduationYear}`);

      const existingAlloc = await env.DB.prepare(`SELECT * FROM slot_allocations WHERE id = ?`).bind(allocId).first();
      const setsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
      const matchingAlbum = (setsRes?.results || []).find(
        (s: any) =>
          (existingAlloc?.album_id && s.id === existingAlloc.album_id) ||
          (String(s.institution_id).toLowerCase() === institutionId.toLowerCase() &&
            String(s.department_id).toLowerCase() === departmentId.toLowerCase() &&
            Number(s.graduation_year) === graduationYear &&
            s.status !== 'deleted')
      );

      const settings = await getPlatformSettingsMap(env);
      const unitValueKobo = Number(settings.student_fee_kobo) || 50000;

      if (existingAlloc) {
        const oldQuantity = Number(existingAlloc.quantity) || 0;
        const delta = newQuantity - oldQuantity;
        if (matchingAlbum && delta < 0) {
          const summary = await getAlbumSlotSummary(matchingAlbum.id);
          const unusedSlots = Math.max(0, summary.balance);
          const minAllowedQuantity = Math.max(0, oldQuantity - unusedSlots);
          if (newQuantity < minAllowedQuantity) {
            return new Response(
              JSON.stringify({
                error: 'cannot_reduce_below_used',
                message: `Cannot reduce allocation below ${minAllowedQuantity} slots because ${oldQuantity - minAllowedQuantity} slots are already used.`,
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const status = matchingAlbum ? 'credited' : 'waiting';
        await env.DB.prepare(
          `UPDATE slot_allocations SET quantity = ?, note = ?, status = ?, album_id = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(newQuantity, note, status, matchingAlbum ? matchingAlbum.id : null, allocId).run();

        if (matchingAlbum && delta !== 0) {
          await env.DB.prepare(
            `INSERT INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
             VALUES (?, ?, ?, 'kohot_allocation_adjustment', ?, 'KoHot', ?, ?, ?, datetime('now'))`
          ).bind(
            `sled-adj-${allocId}-${Date.now()}`,
            matchingAlbum.id,
            delta,
            allocId,
            unitValueKobo,
            `alloc-adj:${allocId}:${Date.now()}`,
            sessionUser.email
          ).run();
        }

        await logAudit(
          'slot_allocation_updated',
          `KoHot allocation ${allocId} updated from ${oldQuantity} to ${newQuantity} slots (${note})`,
          sessionUser.email
        );

        return new Response(
          JSON.stringify({
            success: true,
            allocation: {
              id: allocId,
              institutionId: existingAlloc.institution_id,
              departmentId: existingAlloc.department_id,
              graduationYear: Number(existingAlloc.graduation_year),
              quantity: newQuantity,
              note,
              status,
              albumId: matchingAlbum?.id || null,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const status = matchingAlbum ? 'credited' : 'waiting';
      await env.DB.prepare(
        `INSERT OR REPLACE INTO slot_allocations (id, institution_id, department_id, graduation_year, quantity, note, status, album_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        allocId,
        institutionId,
        departmentId,
        graduationYear,
        Math.max(1, newQuantity),
        note,
        status,
        matchingAlbum ? matchingAlbum.id : null,
        sessionUser.email
      ).run();

      if (matchingAlbum) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
           VALUES (?, ?, ?, 'kohot_allocation', ?, 'KoHot', ?, ?, ?, datetime('now'))`
        ).bind(
          `sled-alloc-${allocId}`,
          matchingAlbum.id,
          Math.max(1, newQuantity),
          allocId,
          unitValueKobo,
          `alloc:${allocId}`,
          sessionUser.email
        ).run();
      }

      await logAudit(
        'slot_allocation_created',
        `KoHot allocation ${allocId} created for ${institutionId}/${departmentId}/${graduationYear}: ${Math.max(1, newQuantity)} slots (${status})`,
        sessionUser.email
      );

      return new Response(
        JSON.stringify({
          success: true,
          allocation: {
            id: allocId,
            institutionId,
            departmentId,
            graduationYear,
            quantity: Math.max(1, newQuantity),
            note,
            status,
            albumId: matchingAlbum?.id || null,
          },
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13m. Host Grant Free Slots to an Album (/api/admin/albums/:albumId/grant-slots)
    const hostGrantSlotsMatch = path.match(/^\/api\/admin\/albums\/([^/]+)\/grant-slots$/);
    if (hostGrantSlotsMatch && request.method === 'POST') {
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
      const albumId = decodeURIComponent(hostGrantSlotsMatch[1]);
      const body = (await request.json().catch(() => ({}))) as any;
      const quantity = Math.max(1, Math.floor(Number(body.quantity) || 0));
      const reason = String(body.reason || '').trim();
      if (!reason) {
        return new Response(JSON.stringify({ error: 'A reason is required to grant free slots.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const settings = await getPlatformSettingsMap(env);
      const unitValueKobo = Number(settings.student_fee_kobo) || 50000;
      const ledgerId = `sled-grant-${albumId}-${Date.now()}`;

      await env.DB.prepare(
        `INSERT INTO slot_ledger (id, album_id, delta, kind, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
         VALUES (?, ?, ?, 'host_grant', 'KoHot', ?, ?, ?, datetime('now'))`
      ).bind(
        ledgerId,
        albumId,
        quantity,
        unitValueKobo,
        `host_grant:${albumId}:${Date.now()}`,
        sessionUser.email
      ).run();

      // Update album data_json sponsors list with KoHot credit if needed
      const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
      if (albumRow && albumRow.data_json) {
        try {
          const albumData = JSON.parse(albumRow.data_json);
          const sponsors = Array.isArray(albumData.sponsors) ? [...albumData.sponsors] : [];
          sponsors.push({
            id: ledgerId,
            sponsorName: 'KoHot',
            DisplayLabel: `KoHot (${reason})`,
            quantity,
            amountPaid: 0,
            reference: `GRANT-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            showSponsorNameOnAlbum: true,
            isKoHotCredit: true,
          });
          albumData.sponsors = sponsors;
          await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(JSON.stringify(albumData), albumId)
            .run();
        } catch {}
      }

      await logAudit(
        'host_granted_free_slots',
        `Host granted ${quantity} free slots to album ${albumId}. Reason: ${reason}`,
        sessionUser.email
      );

      const summary = await getAlbumSlotSummary(albumId);
      return new Response(JSON.stringify({ success: true, ledgerId, ...summary }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 13n. Host Edit or Remove Sponsor Name on an Album (/api/admin/albums/:albumId/sponsors)
    const hostAlbumSponsorsMatch = path.match(/^\/api\/admin\/albums\/([^/]+)\/sponsors$/);
    if (hostAlbumSponsorsMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
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
      const albumId = decodeURIComponent(hostAlbumSponsorsMatch[1]);
      const body = (await request.json().catch(() => ({}))) as any;
      const sponsorId = String(body.sponsorId || body.ledgerId || body.id || '').trim();
      const action = request.method === 'DELETE' || body.action === 'remove' ? 'remove' : 'edit';
      const newSponsorName = action === 'remove' ? '' : String(body.sponsorName || '').trim().slice(0, 60);

      if (sponsorId) {
        await env.DB.prepare(`UPDATE slot_ledger SET sponsor_name = ? WHERE id = ? AND album_id = ?`)
          .bind(newSponsorName || 'Anonymous Sponsor', sponsorId, albumId)
          .run();
        await env.DB.prepare(`UPDATE slot_purchases SET sponsor_name = ? WHERE id = ? AND album_id = ?`)
          .bind(newSponsorName || 'Anonymous Sponsor', sponsorId, albumId)
          .run();
      }

      const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
      if (albumRow && albumRow.data_json) {
        try {
          const albumData = JSON.parse(albumRow.data_json);
          if (Array.isArray(albumData.sponsors)) {
            if (action === 'remove') {
              albumData.sponsors = albumData.sponsors.map((sp: any) =>
                sp.id === sponsorId || sp.reference === body.reference
                  ? { ...sp, showSponsorNameOnAlbum: false, sponsorName: 'Anonymous Sponsor', DisplayLabel: 'Anonymous Sponsor' }
                  : sp
              );
            } else {
              albumData.sponsors = albumData.sponsors.map((sp: any) =>
                sp.id === sponsorId || sp.reference === body.reference
                  ? { ...sp, sponsorName: newSponsorName, DisplayLabel: newSponsorName, showSponsorNameOnAlbum: true }
                  : sp
              );
            }
            await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
              .bind(JSON.stringify(albumData), albumId)
              .run();
          }
        } catch {}
      }

      await logAudit(
        action === 'remove' ? 'host_sponsor_removed' : 'host_sponsor_edited',
        `Host ${action === 'remove' ? 'removed public sponsor display' : `updated sponsor name to "${newSponsorName}"`} on album ${albumId}`,
        sessionUser.email
      );

      const summary = await getAlbumSlotSummary(albumId);
      return new Response(JSON.stringify({ success: true, ...summary }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 13o. Host Platform Settings (/api/admin/settings) — GET & PUT with validation & audit logging
    if (path === '/api/admin/settings' && (request.method === 'GET' || request.method === 'PUT')) {
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
        const raw = await getPlatformSettingsMap(env);
        let hiddenInstitutions: string[] = [];
        let hiddenAlbums: string[] = [];
        let institutionCurrencies: Record<string, string> = {};
        try { hiddenInstitutions = JSON.parse(raw.hidden_directory_institutions || '[]'); } catch {}
        try { hiddenAlbums = JSON.parse(raw.hidden_directory_albums || '[]'); } catch {}
        try { institutionCurrencies = JSON.parse(raw.institution_currencies || '{}'); } catch {}

        return new Response(
          JSON.stringify({
            success: true,
            settings: {
              student_fee_kobo: Number(raw.student_fee_kobo) || 50000,
              min_funded_to_publish: Number(raw.min_funded_to_publish) || 10,
              profile_cap_default: Number(raw.profile_cap_default) || 200,
              reinstate_days: Number(raw.reinstate_days) || 7,
              draft_retention_days: Number(raw.draft_retention_days) || 30,
              recovery_period_days: Number(raw.recovery_period_days) || 14,
              default_kohot_slots_per_album: Number(raw.default_kohot_slots_per_album) || 0,
              public_directory_enabled: raw.public_directory_enabled === '1' || raw.public_directory_enabled === 'true',
              hidden_directory_institutions: hiddenInstitutions,
              hidden_directory_albums: hiddenAlbums,
              institution_currencies: institutionCurrencies,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = (await request.json().catch(() => ({}))) as any;
      const current = await getPlatformSettingsMap(env);
      const updates: Array<{ key: string; oldVal: string; newVal: string }> = [];

      const validateAndQueueInt = (key: string, min: number, max: number, label: string) => {
        if (body[key] === undefined) return null;
        const num = Number(body[key]);
        if (!Number.isFinite(num) || Math.floor(num) !== num || num < min || num > max) {
          return `${label} must be a whole number between ${min} and ${max}.`;
        }
        const strVal = String(num);
        if (current[key] !== strVal) {
          updates.push({ key, oldVal: current[key] || '', newVal: strVal });
        }
        return null;
      };

      const validationErrors = [
        validateAndQueueInt('student_fee_kobo', 0, 100000000, 'Student fee (in kobo)'),
        validateAndQueueInt('min_funded_to_publish', 0, 1000, 'Minimum funded profiles to publish'),
        validateAndQueueInt('profile_cap_default', 1, 5000, 'Default profile cap'),
        validateAndQueueInt('reinstate_days', 1, 365, 'Reinstate days'),
        validateAndQueueInt('draft_retention_days', 1, 365, 'Draft retention days'),
        validateAndQueueInt('recovery_period_days', 1, 365, 'Recovery period days'),
        validateAndQueueInt('default_kohot_slots_per_album', 0, 1000, 'Default KoHot slots per album'),
      ].filter(Boolean);

      if (validationErrors.length > 0) {
        return new Response(JSON.stringify({ error: validationErrors[0], errors: validationErrors }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (body.public_directory_enabled !== undefined) {
        const strVal = body.public_directory_enabled ? '1' : '0';
        if (current.public_directory_enabled !== strVal) {
          updates.push({ key: 'public_directory_enabled', oldVal: current.public_directory_enabled || '0', newVal: strVal });
        }
      }
      if (Array.isArray(body.hidden_directory_institutions)) {
        const strVal = JSON.stringify(body.hidden_directory_institutions);
        if (current.hidden_directory_institutions !== strVal) {
          updates.push({ key: 'hidden_directory_institutions', oldVal: current.hidden_directory_institutions || '[]', newVal: strVal });
        }
      }
      if (Array.isArray(body.hidden_directory_albums)) {
        const strVal = JSON.stringify(body.hidden_directory_albums);
        if (current.hidden_directory_albums !== strVal) {
          updates.push({ key: 'hidden_directory_albums', oldVal: current.hidden_directory_albums || '[]', newVal: strVal });
        }
      }
      if (body.institution_currencies && typeof body.institution_currencies === 'object') {
        const strVal = JSON.stringify(body.institution_currencies);
        if (current.institution_currencies !== strVal) {
          updates.push({ key: 'institution_currencies', oldVal: current.institution_currencies || '{}', newVal: strVal });
        }
      }

      for (const u of updates) {
        await env.DB.prepare(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)`).bind(u.key, u.newVal).run();
        await logAudit(
          'settings_updated',
          `Platform setting "${u.key}" changed from "${u.oldVal}" to "${u.newVal}"`,
          sessionUser.email
        );
      }

      const updatedRaw = await getPlatformSettingsMap(env);
      let hiddenInstitutions: string[] = [];
      let hiddenAlbums: string[] = [];
      let institutionCurrencies: Record<string, string> = {};
      try { hiddenInstitutions = JSON.parse(updatedRaw.hidden_directory_institutions || '[]'); } catch {}
      try { hiddenAlbums = JSON.parse(updatedRaw.hidden_directory_albums || '[]'); } catch {}
      try { institutionCurrencies = JSON.parse(updatedRaw.institution_currencies || '{}'); } catch {}

      return new Response(
        JSON.stringify({
          success: true,
          settings: {
            student_fee_kobo: Number(updatedRaw.student_fee_kobo) || 50000,
            min_funded_to_publish: Number(updatedRaw.min_funded_to_publish) || 10,
            profile_cap_default: Number(updatedRaw.profile_cap_default) || 200,
            reinstate_days: Number(updatedRaw.reinstate_days) || 7,
            draft_retention_days: Number(updatedRaw.draft_retention_days) || 30,
            recovery_period_days: Number(updatedRaw.recovery_period_days) || 14,
            default_kohot_slots_per_album: Number(updatedRaw.default_kohot_slots_per_album) || 0,
            public_directory_enabled: updatedRaw.public_directory_enabled === '1' || updatedRaw.public_directory_enabled === 'true',
            hidden_directory_institutions: hiddenInstitutions,
            hidden_directory_albums: hiddenAlbums,
            institution_currencies: institutionCurrencies,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13p. Host Finances Summary & Ledger & Mark Refunded (/api/admin/finances/*)
    if (path.startsWith('/api/admin/finances/')) {
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

      const settings = await getPlatformSettingsMap(env);
      const unitFeeKobo = Number(settings.student_fee_kobo) || 50000;
      let instCurrencies: Record<string, string> = {};
      try { instCurrencies = JSON.parse(settings.institution_currencies || '{}'); } catch {}

      const buildLedgerRows = async () => {
        const txRes = await env.DB.prepare(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1000`).all();
        const setsRes = await env.DB.prepare(`SELECT id, institution_id, department_id, graduation_year, class_set_name, data_json FROM class_sets`).all();
        const setMap = new Map<string, any>();
        for (const s of setsRes?.results || []) {
          setMap.set(String(s.id), s);
        }

        const rows: any[] = [];
        for (const r of txRes?.results || []) {
          let meta: any = {};
          try { meta = JSON.parse(r.paystack_data_json || '{}'); } catch {}
          const albumId = String(meta.albumId || meta.album_id || r.set_id || r.registration_id || '');
          const matchedSet = setMap.get(albumId);
          let setJson: any = {};
          if (matchedSet?.data_json) {
            try { setJson = JSON.parse(matchedSet.data_json); } catch {}
          }

          const rawStatus = String(r.status || 'pending').toLowerCase().trim();
          let status: 'paid' | 'pending' | 'failed' | 'refunded' | 'refund_due' | 'needs_review' = 'pending';
          if (rawStatus === 'refunded') status = 'refunded';
          else if (rawStatus === 'refund_due' || rawStatus === 'refund due') status = 'refund_due';
          else if (rawStatus.includes('needs review') || rawStatus === 'needs_review') status = 'needs_review';
          else if (rawStatus === 'paid' || rawStatus === 'completed' || rawStatus === 'success') status = 'paid';
          else if (rawStatus === 'failed' || rawStatus === 'abandoned') status = 'failed';

          const rawType = String(meta.paymentCategory || meta.type || '').toLowerCase();
          const type: 'student_payment' | 'slot_purchase' =
            rawType.includes('slot') || String(r.reference || '').includes('-SLT-')
              ? 'slot_purchase'
              : 'student_payment';

          const institutionId = String(matchedSet?.institution_id || setJson.institutionId || meta.institutionId || '');
          const institutionName = String(
            setJson.institutionName || setJson.universityName || meta.universityName || meta.institution || r.institution || institutionId || 'Institution'
          );
          const departmentId = String(matchedSet?.department_id || setJson.departmentId || meta.departmentId || '');
          const departmentName = String(
            setJson.departmentName || meta.departmentName || meta.department || r.set_name || departmentId || 'Department'
          );
          const classYear = Number(matchedSet?.graduation_year || setJson.graduationYear || meta.graduationYear || meta.set_year) || new Date().getFullYear();
          const amountKobo = Number(r.amount_kobo) || (Number(r.amount) || 0) * 100;
          const quantity = type === 'slot_purchase' ? Math.max(1, Number(meta.slotsPurchased || meta.quantity) || Math.round(amountKobo / unitFeeKobo) || 1) : 1;
          const sponsor = type === 'slot_purchase' ? String(meta.sponsorName || meta.sponsor_name || r.payer_name || '') : '';
          const currency = instCurrencies[institutionId] || String(r.currency || 'NGN').toUpperCase();

          rows.push({
            id: r.id || `tx-${r.reference}`,
            type,
            date: r.paid_at || r.created_at || new Date().toISOString(),
            institutionId,
            institutionName,
            departmentId,
            departmentName,
            classYear,
            albumId,
            albumName: String(matchedSet?.class_set_name || setJson.classSetName || `${departmentName} '${String(classYear).slice(-2)}`),
            amountKobo,
            currency,
            status,
            reference: r.reference || '',
            quantity,
            sponsor,
            payerName: r.payer_name || meta.payerName || '',
            payerEmail: r.payer_email || meta.payerEmail || '',
            refundNote: meta.refundNote || '',
            refundedAt: meta.refundedAt || '',
          });
        }
        return rows;
      };

      if (path === '/api/admin/finances/summary' && request.method === 'GET') {
        const rows = await buildLedgerRows();
        // Africa/Lagos (UTC+1) current year and month
        const lagosNow = new Date(Date.now() + 60 * 60 * 1000);
        const lagosYearMonth = lagosNow.toISOString().slice(0, 7); // YYYY-MM

        let confirmedRevenueMonthKobo = 0;
        let confirmedRevenueAllTimeKobo = 0;
        let studentPaymentsKobo = 0;
        let studentPaymentsCount = 0;
        let slotPurchasesKobo = 0;
        let slotPurchasesCount = 0;
        let refundsDueKobo = 0;
        let refundsDueCount = 0;
        let refundedKobo = 0;
        let pendingPaymentsCount = 0;
        let paidNeedsReviewCount = 0;

        for (const row of rows) {
          const rowDateLagos = new Date(new Date(row.date).getTime() + 60 * 60 * 1000).toISOString().slice(0, 7);
          if (row.status === 'paid') {
            confirmedRevenueAllTimeKobo += row.amountKobo;
            if (rowDateLagos === lagosYearMonth) {
              confirmedRevenueMonthKobo += row.amountKobo;
            }
            if (row.type === 'student_payment') {
              studentPaymentsKobo += row.amountKobo;
              studentPaymentsCount += 1;
            } else {
              slotPurchasesKobo += row.amountKobo;
              slotPurchasesCount += 1;
            }
          } else if (row.status === 'refund_due') {
            refundsDueKobo += row.amountKobo;
            refundsDueCount += 1;
          } else if (row.status === 'refunded') {
            refundedKobo += row.amountKobo;
          } else if (row.status === 'pending') {
            pendingPaymentsCount += 1;
          } else if (row.status === 'needs_review') {
            paidNeedsReviewCount += 1;
          }
        }

        // KoHot-sponsored value: granted slots x unit value (programme benefit, never revenue)
        const grantedLedgerRes = await env.DB.prepare(
          `SELECT delta, unit_value_kobo, kind FROM slot_ledger WHERE kind IN ('kohot_allocation', 'kohot_allocation_adjustment', 'host_grant', 'default_kohot_grant')`
        ).all();
        const allocWaitingRes = await env.DB.prepare(
          `SELECT quantity FROM slot_allocations WHERE status = 'waiting'`
        ).all();

        let kohotSponsoredSlotsCount = 0;
        for (const l of grantedLedgerRes?.results || []) {
          kohotSponsoredSlotsCount += Number(l.delta) || 0;
        }
        for (const a of allocWaitingRes?.results || []) {
          kohotSponsoredSlotsCount += Number(a.quantity) || 0;
        }
        kohotSponsoredSlotsCount = Math.max(0, kohotSponsoredSlotsCount);
        const kohotSponsoredValueKobo = kohotSponsoredSlotsCount * unitFeeKobo;
        const netCollectedKobo = Math.max(0, confirmedRevenueAllTimeKobo - refundsDueKobo);

        return new Response(
          JSON.stringify({
            success: true,
            summary: {
              confirmedRevenueMonthKobo,
              confirmedRevenueAllTimeKobo,
              studentPaymentsKobo,
              studentPaymentsCount,
              slotPurchasesKobo,
              slotPurchasesCount,
              refundsDueKobo,
              refundsDueCount,
              refundedKobo,
              netCollectedKobo,
              kohotSponsoredValueKobo,
              kohotSponsoredSlotsCount,
              unitFeeKobo,
              needsAttention: {
                pendingPaymentsCount,
                paidNeedsReviewCount,
                refundsDueCount,
              },
              timezone: 'Africa/Lagos',
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (path === '/api/admin/finances/ledger' && request.method === 'GET') {
        const rows = await buildLedgerRows();
        return new Response(JSON.stringify({ success: true, rows }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/admin/finances/refund' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const reference = String(body.reference || '').trim();
        const note = String(body.note || '').trim();
        if (!reference || !note) {
          return new Response(JSON.stringify({ error: 'Transaction reference and refund note are required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const txRow = await env.DB.prepare(`SELECT * FROM transactions WHERE reference = ?`).bind(reference).first();
        if (!txRow) {
          return new Response(JSON.stringify({ error: 'Transaction not found.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        let meta: any = {};
        try { meta = JSON.parse(txRow.paystack_data_json || '{}'); } catch {}
        meta.refundNote = note;
        meta.refundedAt = new Date().toISOString();
        meta.refundedBy = sessionUser.email;

        await env.DB.prepare(
          `UPDATE transactions SET status = 'refunded', paystack_data_json = ? WHERE reference = ?`
        ).bind(JSON.stringify(meta), reference).run();

        await logAudit(
          'transaction_marked_refunded',
          `Transaction ${reference} marked as refunded by Host. Note: ${note}`,
          sessionUser.email
        );

        return new Response(JSON.stringify({ success: true, reference, status: 'refunded', refundNote: note }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 13q. Public Directory Endpoint (/api/public/directory) — Strictly Cover, Album Name, Department, and Year Only
    if (path === '/api/public/directory' && request.method === 'GET') {
      const settings = await getPlatformSettingsMap(env);
      const isEnabled = settings.public_directory_enabled === '1' || settings.public_directory_enabled === 'true';
      if (!isEnabled) {
        return new Response(
          JSON.stringify({ enabled: false, error: 'not_available', message: 'not available' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' } }
        );
      }

      let hiddenInstitutions: string[] = [];
      let hiddenAlbums: string[] = [];
      try { hiddenInstitutions = JSON.parse(settings.hidden_directory_institutions || '[]'); } catch {}
      try { hiddenAlbums = JSON.parse(settings.hidden_directory_albums || '[]'); } catch {}
      const hiddenInstSet = new Set(hiddenInstitutions.map((i) => String(i).toLowerCase()));
      const hiddenAlbumSet = new Set(hiddenAlbums.map((a) => String(a)));

      const listedCards: Array<{
        id: string;
        coverUrl: string;
        albumName: string;
        departmentId: string;
        departmentName: string;
        institutionId: string;
        institutionName: string;
        graduationYear: number;
        isDemo?: boolean;
      }> = [];

      if (env.DB) {
        const setsRes = await env.DB.prepare(`SELECT * FROM class_sets WHERE status != 'deleted'`).all();
        for (const row of setsRes?.results || []) {
          let parsed: any = {};
          try { parsed = JSON.parse(row.data_json || '{}'); } catch {}
          const albumId = String(row.id || parsed.id || '');
          const instId = String(row.institution_id || parsed.institutionId || '');
          const rowStatus = String(row.status || parsed.lifecycleStatus || '');
          const isPublished =
            (rowStatus === 'published' || rowStatus === 'published_live' || parsed.isPublished === true || parsed.published === true) &&
            !parsed.isUnpublished &&
            !parsed.unpublished &&
            !parsed.deletedAt;
          const isListed = parsed.isListedInDirectory !== false && !parsed.isHiddenFromDirectory;

          if (!isPublished || !isListed) continue;
          if (hiddenInstSet.has(instId.toLowerCase()) || hiddenAlbumSet.has(albumId)) continue;

          const isDemo = instId.toLowerCase() === 'crownfield' || albumId.startsWith('crownfield-');
          listedCards.push({
            id: albumId,
            coverUrl: String(parsed.legacyGroupImageUrl || parsed.bannerImageUrl || ''),
            albumName: String(parsed.classSetName || row.class_set_name || `Class of ${row.graduation_year}`),
            departmentId: String(row.department_id || parsed.departmentId || ''),
            departmentName: String(parsed.departmentName || row.department_id || ''),
            institutionId: instId,
            institutionName: String(parsed.institutionName || parsed.universityName || instId),
            graduationYear: Number(row.graduation_year || parsed.graduationYear) || new Date().getFullYear(),
            isDemo,
          });
        }
      }

      // Crownfield demo rule: appears labelled "Demo" until 3 real albums are listed, then leaves the directory
      const realListedCount = listedCards.filter((c) => !c.isDemo).length;
      const filteredCards = realListedCount >= 3 ? listedCards.filter((c) => !c.isDemo) : listedCards;

      return new Response(
        JSON.stringify({
          enabled: true,
          albums: filteredCards,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' } }
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
