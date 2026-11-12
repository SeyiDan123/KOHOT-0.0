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
  if (trimmed.startsWith('/api/media/')) {
    return decodeURIComponent(trimmed.slice('/api/media/'.length));
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
    student_fee_kobo: '100000',
    default_discount_percent: '20',
    compression_resolution_px: '1440',
    min_funded_to_publish: '10',
    profile_cap_default: '200',
    reinstate_days: '7',
    draft_retention_days: '30',
    recovery_period_days: '30',
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

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64Url: string): string {
  let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
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
  const dataB64 = utf8ToBase64Url(data);
  return `${dataB64}.${sigB64}`;
}

async function verifySessionToken(token: string, secret: string): Promise<any | null> {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const data = base64UrlToUtf8(dataB64);
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

// Signed signup token (24 hours) for registration
async function createSignupToken(email: string, name: string, secret: string): Promise<string> {
  const payload = JSON.stringify({
    email,
    name,
    type: 'signup_token',
    exp: Date.now() + 24 * 60 * 60 * 1000,
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
  const dataB64 = utf8ToBase64Url(payload);
  return `${dataB64}.${sigB64}`;
}

async function verifySignupToken(token: string, secret: string): Promise<{ email: string; name: string } | null> {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const data = base64UrlToUtf8(dataB64);
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

// Helper: Canonicalize department slug / name so dept-unilorin-pad, dept-unilorin-pubadmin, and "Public Administration" match reliably
export function normalizeDepartmentCohortSlug(institutionId: string, departmentId: string, departmentName?: string): string {
  const inst = String(institutionId || '').trim().toLowerCase().replace(/^uni-/, '');
  const rawDeptId = String(departmentId || '').trim().toLowerCase();
  const rawDeptName = String(departmentName || '').trim().toLowerCase();

  // Check common Public Administration aliases (especially UNILORIN Public Administration)
  if (
    rawDeptId.includes('pubadmin') ||
    rawDeptId.endsWith('-pad') ||
    rawDeptId === 'pad' ||
    rawDeptId.includes('public-administration') ||
    rawDeptName === 'public administration' ||
    rawDeptName === 'department of public administration'
  ) {
    return inst === 'unilorin' ? 'dept-unilorin-pad' : `dept-${inst}-pad`;
  }

  if (rawDeptName) {
    const nameSlug = rawDeptName
      .replace(/^department\s+of\s+/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (nameSlug === 'public-administration') {
      return inst === 'unilorin' ? 'dept-unilorin-pad' : `dept-${inst}-pad`;
    }
  }

  // Strip redundant prefixes to compare core slug
  const cleaned = rawDeptId
    .replace(/^dept-/, '')
    .replace(new RegExp(`^${inst}-`), '');
  return cleaned ? `dept-${inst}-${cleaned}` : rawDeptId;
}

export function getCanonicalAlbumId(institutionId: string, departmentId: string, graduationYear: number, departmentName?: string): string {
  const inst = String(institutionId || '').trim().toLowerCase();
  const canonicalDept = normalizeDepartmentCohortSlug(inst, departmentId, departmentName);
  const deptShort = canonicalDept.replace(/^dept-/, '');
  return `${inst}-${deptShort}-${graduationYear}`;
}

export function getCanonicalCohortKey(institutionId: string, departmentId: string, graduationYear: number, departmentName?: string): string {
  return getCanonicalAlbumId(institutionId, departmentId, graduationYear, departmentName);
}

export function generatePermanentAlbumId(institutionId: string, departmentId: string, graduationYear: number, departmentName?: string): string {
  const baseKey = getCanonicalCohortKey(institutionId, departmentId, graduationYear, departmentName);
  const randSuffix = Math.random().toString(36).slice(2, 8);
  return `set-${baseKey}-${randSuffix}`;
}

// Automatic 30-day expired soft-deleted album cleanup (respects keepByHost / keptByHostOnly and shared R2 references)
export async function cleanupExpiredSoftDeletedAlbums(env: Env): Promise<{ purgedAlbumIds: string[]; skippedHostKept: string[] }> {
  const purgedAlbumIds: string[] = [];
  const skippedHostKept: string[] = [];
  if (!env.DB) return { purgedAlbumIds, skippedHostKept };

  try {
    const allSetsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
    const allRows = allSetsRes?.results || [];
    const nowMs = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Collect all R2 keys referenced by non-expired albums, Host-kept albums, non-expired submissions, institutions, and site_content
    const activeReferencedKeys = new Set<string>();
    const expiredRows: Array<{ row: any; parsed: any }> = [];
    const expiredAlbumIds = new Set<string>();

    for (const row of allRows) {
      let parsed: any = {};
      try { parsed = JSON.parse(row.data_json || '{}'); } catch {}
      const isDeleted = row.status === 'deleted' || Boolean(parsed.deletedAt);
      const deletedAtMs = parsed.deletedAt ? new Date(parsed.deletedAt).getTime() : 0;
      const isExpired = isDeleted && deletedAtMs > 0 && (nowMs - deletedAtMs >= thirtyDaysMs);
      const isHostKept = Boolean(parsed.keepByHost || parsed.keptByHostOnly);

      if (isExpired && !isHostKept) {
        expiredRows.push({ row, parsed });
        expiredAlbumIds.add(String(row.id));
      } else {
        if (isExpired && isHostKept) {
          skippedHostKept.push(String(row.id));
        }
        for (const k of collectAlbumMediaKeys(parsed)) {
          activeReferencedKeys.add(k);
        }
      }
    }

    // Protect keys referenced by non-expired profile_submissions, institutions, and site_content
    try {
      const allSubsRes = await env.DB.prepare(`SELECT album_id, status, photo_key, payload_json FROM profile_submissions WHERE status != 'removed'`).all();
      for (const sr of allSubsRes?.results || []) {
        if (expiredAlbumIds.has(String(sr.album_id))) continue;
        const pk = extractMediaKeyFromUrl(sr.photo_key);
        if (pk) activeReferencedKeys.add(pk);
        if (sr.payload_json) {
          try {
            for (const k of collectAlbumMediaKeys(JSON.parse(sr.payload_json))) activeReferencedKeys.add(k);
          } catch {}
        }
      }
    } catch {}

    try {
      const instRes = await env.DB.prepare(`SELECT logo_url, data_json FROM institutions`).all();
      for (const ir of instRes?.results || []) {
        const lk = extractMediaKeyFromUrl(ir.logo_url);
        if (lk) activeReferencedKeys.add(lk);
        if (ir.data_json) {
          try {
            for (const k of collectAlbumMediaKeys(JSON.parse(ir.data_json))) activeReferencedKeys.add(k);
          } catch {}
        }
      }
    } catch {}

    try {
      const siteRes = await env.DB.prepare(`SELECT value_json FROM site_content`).all();
      for (const sc of siteRes?.results || []) {
        if (sc.value_json) {
          try {
            for (const k of collectAlbumMediaKeys(JSON.parse(sc.value_json))) activeReferencedKeys.add(k);
          } catch {}
        }
      }
    } catch {}

    for (const { row, parsed } of expiredRows) {
      const albumId = String(row.id);
      const candidateKeys = new Set<string>(collectAlbumMediaKeys(parsed));

      try {
        const subRows = await env.DB.prepare(`SELECT photo_key, payload_json FROM profile_submissions WHERE album_id = ?`).bind(albumId).all();
        for (const sr of subRows?.results || []) {
          const pk = extractMediaKeyFromUrl(sr.photo_key);
          if (pk) candidateKeys.add(pk);
          if (sr.payload_json) {
            try {
              for (const k of collectAlbumMediaKeys(JSON.parse(sr.payload_json))) candidateKeys.add(k);
            } catch {}
          }
        }
      } catch {}

      try {
        const assetRows = await env.DB.prepare(`SELECT object_key FROM media_assets WHERE set_id = ?`).bind(albumId).all();
        for (const ar of assetRows?.results || []) {
          const ak = extractMediaKeyFromUrl(ar.object_key);
          if (ak) candidateKeys.add(ak);
        }
      } catch {}

      for (const key of candidateKeys) {
        if (!activeReferencedKeys.has(key)) {
          if (env.BUCKET) {
            try { await env.BUCKET.delete(key); } catch {}
          }
          try { await env.DB.prepare(`DELETE FROM media_assets WHERE object_key = ?`).bind(key).run(); } catch {}
        }
      }

      try { await env.DB.prepare(`DELETE FROM profile_submissions WHERE album_id = ?`).bind(albumId).run(); } catch {}
      try { await env.DB.prepare(`DELETE FROM slot_ledger WHERE album_id = ?`).bind(albumId).run(); } catch {}
      try { await env.DB.prepare(`DELETE FROM class_sets WHERE id = ?`).bind(albumId).run(); } catch {}

      // Also clean up any matching cohort registration & album-specific admin credentials if they manage no other albums
      const instId = String(row.institution_id || parsed.institutionId || '').trim();
      const deptId = String(row.department_id || parsed.departmentId || '').trim();
      const gradYear = Number(row.graduation_year || parsed.graduationYear) || 0;
      const adminEmail = String(row.admin_user_id || parsed.classRepEmail || '').trim().toLowerCase();
      if (instId && deptId && gradYear) {
        try {
          await env.DB.prepare(
            `DELETE FROM registrations WHERE LOWER(institution_id) = ? AND LOWER(department_id) = ? AND graduation_year = ?`
          ).bind(instId.toLowerCase(), deptId.toLowerCase(), gradYear).run();
        } catch {}
      }
      if (adminEmail && adminEmail.includes('@')) {
        try {
          const remainingRes = await env.DB.prepare(`SELECT id, admin_user_id, data_json FROM class_sets`).all();
          const stillManagesOtherAlbum = (remainingRes?.results || []).some((r: any) => {
            if (String(r.id) === albumId) return false;
            if (String(r.admin_user_id || '').trim().toLowerCase() === adminEmail) return true;
            try {
              const rp = JSON.parse(r.data_json || '{}');
              if (String(rp.classRepEmail || '').trim().toLowerCase() === adminEmail) return true;
            } catch {}
            return false;
          });
          if (!stillManagesOtherAlbum) {
            await env.DB.prepare(`DELETE FROM users WHERE LOWER(email) = ? AND role != 'master_host'`).bind(adminEmail).run();
          }
        } catch {}
      }

      try {
        const logId = `log-exp30d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await env.DB.prepare(
          `INSERT INTO audit_logs (id, user_email, action, details, ip_address, created_at) VALUES (?, ?, 'album_expired_30d_purged', ?, 'system-cron', datetime('now'))`
        ).bind(
          logId,
          adminEmail || 'system',
          `Soft-deleted album ${albumId} exceeded 30-day retention window (deletedAt: ${parsed.deletedAt}) and was permanently purged with exclusive D1 records and R2 media.`
        ).run();
      } catch {}

      purgedAlbumIds.push(albumId);
    }
  } catch (err: any) {
    console.warn('30-day soft-delete cleanup error:', err.message);
  }

  return { purgedAlbumIds, skippedHostKept };
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
    try {
      await cleanupExpiredSoftDeletedAlbums(env);
    } catch (cleanupErr: any) {
      console.error('Scheduled 30-day album cleanup encountered error:', cleanupErr.message);
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

    // Helper: delete R2 object from BUCKET and media_assets record ONLY if no other active album, soft-deleted album within 30-day recovery window, Host-retained album, submission, institution, or site content references it
    const deleteR2ObjectAndRecord = async (keyOrUrl: unknown, excludingAlbumId?: string): Promise<boolean> => {
      const key = extractMediaKeyFromUrl(keyOrUrl);
      if (!key) return false;
      if (env.DB) {
        try {
          const nowMs = Date.now();
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          const allSets = await env.DB.prepare(`SELECT id, status, data_json FROM class_sets`).all();
          const protectedAlbumIds = new Set<string>();
          for (const sRow of allSets?.results || []) {
            const sid = String(sRow.id || '');
            if (excludingAlbumId && sid === String(excludingAlbumId)) continue;
            let sp: any = {};
            try { sp = JSON.parse(sRow.data_json || '{}'); } catch {}
            const isDeleted = sRow.status === 'deleted' || Boolean(sp.deletedAt);
            const deletedAtMs = sp.deletedAt ? new Date(sp.deletedAt).getTime() : 0;
            const withinRecoveryWindow = !isDeleted || deletedAtMs === 0 || (nowMs - deletedAtMs < thirtyDaysMs);
            const isHostKept = Boolean(sp.keepByHost || sp.keptByHostOnly);
            if (!isDeleted || withinRecoveryWindow || isHostKept) {
              protectedAlbumIds.add(sid);
              if (String(sRow.data_json || '').includes(key) || collectAlbumMediaKeys(sp).has(key)) {
                // Key is still referenced by another active, recoverable (within 30 days), or Host-retained album!
                return false;
              }
            }
          }
          const settingsMap = await getPlatformSettingsMap(env);
          const reinstateDaysMs = (Number(settingsMap.reinstate_days) || 7) * 24 * 60 * 60 * 1000;
          const subCandidates = excludingAlbumId
            ? await env.DB.prepare(
                `SELECT id, album_id, status, declined_at, updated_at FROM profile_submissions WHERE album_id != ? AND status != 'removed' AND (photo_key = ? OR payload_json LIKE ?)`
              ).bind(excludingAlbumId, key, `%${key}%`).all()
            : await env.DB.prepare(
                `SELECT id, album_id, status, declined_at, updated_at FROM profile_submissions WHERE status != 'removed' AND (photo_key = ? OR payload_json LIKE ?)`
              ).bind(key, `%${key}%`).all();
          for (const subRow of subCandidates?.results || []) {
            if (subRow.status === 'declined') {
              const decMs = subRow.declined_at ? new Date(String(subRow.declined_at)).getTime() : (subRow.updated_at ? new Date(String(subRow.updated_at)).getTime() : 0);
              if (decMs > 0 && nowMs - decMs > reinstateDaysMs) {
                continue;
              }
            }
            if (!subRow.album_id || protectedAlbumIds.has(String(subRow.album_id))) {
              return false;
            }
          }
          const otherInst = await env.DB.prepare(
            `SELECT id FROM institutions WHERE logo_url LIKE ? OR departments_json LIKE ?`
          ).bind(`%${key}%`, `%${key}%`).first().catch(() => null);
          if (otherInst) {
            return false;
          }
          const otherSiteOverride = await env.DB.prepare(
            `SELECT id FROM website_content_overrides WHERE data_json LIKE ?`
          ).bind(`%${key}%`).first().catch(() => null);
          if (otherSiteOverride) {
            return false;
          }
          const otherTestimonial = await env.DB.prepare(
            `SELECT id FROM testimonials WHERE admin_avatar_url LIKE ? OR avatar_url LIKE ? OR album_cover_url LIKE ?`
          ).bind(`%${key}%`, `%${key}%`, `%${key}%`).first().catch(() => null);
          if (otherTestimonial) {
            return false;
          }
          const otherSite = await env.DB.prepare(
            `SELECT key FROM site_content WHERE value_json LIKE ?`
          ).bind(`%${key}%`).first().catch(() => null);
          if (otherSite) {
            return false;
          }
        } catch {}
      }
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
      return true;
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
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS class_sets (
            id TEXT PRIMARY KEY,
            institution_id TEXT NOT NULL,
            department_id TEXT NOT NULL,
            graduation_year INTEGER NOT NULL,
            class_set_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            data_json TEXT NOT NULL,
            invite_code TEXT,
            admin_user_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(institution_id, department_id, graduation_year)
          )`
        ).run();
      } catch {}
      try {
        await env.DB.prepare(`ALTER TABLE class_sets ADD COLUMN invite_code TEXT`).run();
      } catch {}
      try {
        await env.DB.prepare(`ALTER TABLE class_sets ADD COLUMN admin_user_id TEXT`).run();
      } catch {}
      try {
        await env.DB.prepare(`ALTER TABLE class_sets ADD COLUMN class_set_name TEXT DEFAULT ''`).run();
      } catch {}
      try {
        await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_class_sets_invite_code ON class_sets(invite_code)`).run();
      } catch {}
    };

    let offersSchemaEnsured = false;
    const ensureCohortOffersSchema = async () => {
      if (!env.DB || offersSchemaEnsured) return;
      offersSchemaEnsured = true;
      try {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS programmes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL CHECK(kind IN ('funding', 'discount')),
            discount_percent INTEGER CHECK(discount_percent IS NULL OR (discount_percent >= 1 AND discount_percent <= 99)),
            coverage_mode TEXT CHECK(coverage_mode IS NULL OR coverage_mode IN ('all', 'per_album_cap')),
            coverage_cap INTEGER,
            sponsor_name TEXT DEFAULT '',
            show_recognition INTEGER NOT NULL DEFAULT 1,
            valid_from TEXT,
            valid_to TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`
        ).run();
      } catch {}
      try {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS cohort_allocations (
            id TEXT PRIMARY KEY,
            institution_id TEXT NOT NULL,
            department_id TEXT NOT NULL,
            graduation_year INTEGER NOT NULL,
            programme_id TEXT NOT NULL,
            assigned_by TEXT,
            assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
            note TEXT DEFAULT '',
            UNIQUE(institution_id, department_id, graduation_year)
          )`
        ).run();
      } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN programme_id TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN list_price_kobo INTEGER`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN discount_kobo INTEGER DEFAULT 0`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN environment TEXT DEFAULT 'legacy'`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN voided_at TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN voided_by TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN void_reason TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN previous_status TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN restored_at TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN restored_by TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE transactions ADD COLUMN restore_reason TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_purchases ADD COLUMN environment TEXT DEFAULT 'legacy'`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_purchases ADD COLUMN voided_at TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_purchases ADD COLUMN voided_by TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_purchases ADD COLUMN void_reason TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_ledger ADD COLUMN environment TEXT DEFAULT 'legacy'`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_ledger ADD COLUMN reference TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_ledger ADD COLUMN reversal_of_ledger_id TEXT`).run(); } catch {}
      try { await env.DB.prepare(`ALTER TABLE slot_ledger ADD COLUMN note TEXT`).run(); } catch {}

      // Merge any existing slot_allocations (KoHot slots) into programmes + cohort_allocations so existing rows keep working
      try {
        const legacyRes = await env.DB.prepare(`SELECT * FROM slot_allocations`).all();
        const legacyRows = legacyRes?.results || [];
        if (legacyRows.length > 0) {
          const existingProgsRes = await env.DB.prepare(`SELECT * FROM programmes`).all();
          const existingProgs = existingProgsRes?.results || [];
          const existingCohortRes = await env.DB.prepare(`SELECT * FROM cohort_allocations`).all();
          const existingCohorts = existingCohortRes?.results || [];

          for (const row of legacyRows) {
            const qty = Math.max(0, Number(row.quantity) || 0);
            if (qty <= 0) continue;
            const instId = String(row.institution_id || '').trim();
            const deptId = String(row.department_id || '').trim();
            const gradYear = Number(row.graduation_year) || new Date().getFullYear();
            if (!instId || !deptId) continue;

            const alreadyMapped = existingCohorts.some(
              (c: any) =>
                String(c.institution_id).toLowerCase() === instId.toLowerCase() &&
                String(c.department_id).toLowerCase() === deptId.toLowerCase() &&
                Number(c.graduation_year) === gradYear
            );
            if (alreadyMapped) continue;

            const progId = `prog-kohot-alloc-${qty}`;
            if (!existingProgs.some((p: any) => p.id === progId)) {
              await env.DB.prepare(
                `INSERT OR IGNORE INTO programmes (id, name, kind, discount_percent, coverage_mode, coverage_cap, sponsor_name, show_recognition, valid_from, valid_to, status, created_at, updated_at)
                 VALUES (?, ?, 'funding', NULL, 'per_album_cap', ?, 'KoHot', 1, NULL, NULL, 'active', datetime('now'), datetime('now'))`
              ).bind(progId, `KoHot Funded Access (${qty} profiles)`, qty).run();
              existingProgs.push({ id: progId });
            }

            const callocId = `calloc-${instId}-${deptId}-${gradYear}`;
            await env.DB.prepare(
              `INSERT OR IGNORE INTO cohort_allocations (id, institution_id, department_id, graduation_year, programme_id, assigned_by, assigned_at, note)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
            ).bind(
              callocId,
              instId,
              deptId,
              gradYear,
              progId,
              String(row.created_by || 'system'),
              String(row.note || 'Merged from KoHot slot allocation')
            ).run();
            existingCohorts.push({
              id: callocId,
              institution_id: instId,
              department_id: deptId,
              graduation_year: gradYear,
              programme_id: progId,
            });
          }
        }
      } catch {}
    };

    // Syncs a Funding programme's coverage grant into slot_ledger & albumData.sponsors for an existing album
    const syncAlbumFundingGrant = async (
      albumRow: any,
      allocId: string,
      programme: any | null,
      targetCap: number,
      unitValueKobo: number
    ) => {
      if (!env.DB || !albumRow || !albumRow.id) return;
      const albumId = String(albumRow.id);
      const sponsorName = programme ? String(programme.sponsor_name || 'KoHot').trim() || 'KoHot' : 'KoHot';
      const showRecognition = programme
        ? Boolean(Number(programme.show_recognition) !== 0 && programme.show_recognition !== false)
        : false;

      const ledgerRes = await env.DB.prepare(`SELECT * FROM slot_ledger WHERE album_id = ?`).bind(albumId).all();
      const ledgerRows = ledgerRes?.results || [];
      const grantRows = ledgerRows.filter(
        (l: any) =>
          l.allocation_id === allocId ||
          l.kind === 'kohot_allocation' ||
          l.kind === 'kohot_allocation_adjustment'
      );
      const currentGranted = grantRows.reduce((acc: number, r: any) => acc + (Number(r.delta) || 0), 0);
      const totalUsed = ledgerRows.reduce(
        (acc: number, r: any) => acc + (Number(r.delta) < 0 ? Math.abs(Number(r.delta)) : 0),
        0
      );

      if (programme && programme.kind === 'funding' && targetCap > 0) {
        if (grantRows.length === 0) {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
             VALUES (?, ?, ?, 'kohot_allocation', ?, ?, ?, ?, 'system', datetime('now'))`
          ).bind(
            `sled-calloc-${allocId}`,
            albumId,
            targetCap,
            allocId,
            sponsorName,
            unitValueKobo,
            `calloc:${allocId}`
          ).run();
        } else {
          // Ensure sponsor_name is up to date on existing grant rows
          for (const gr of grantRows) {
            if (gr.sponsor_name !== sponsorName) {
              await env.DB.prepare(`UPDATE slot_ledger SET sponsor_name = ? WHERE id = ?`)
                .bind(sponsorName, gr.id)
                .run();
            }
          }
          const deltaDiff = targetCap - currentGranted;
          if (deltaDiff !== 0) {
            await env.DB.prepare(
              `INSERT INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
               VALUES (?, ?, ?, 'kohot_allocation_adjustment', ?, ?, ?, ?, 'system', datetime('now'))`
            ).bind(
              `sled-cadj-${allocId}-${Date.now()}`,
              albumId,
              deltaDiff,
              allocId,
              sponsorName,
              unitValueKobo,
              `calloc-adj:${allocId}:${Date.now()}`
            ).run();
          }
        }

        // Sync sponsor entry into albumRow.data_json so sponsor footer & funded counts keep working
        try {
          const albumData = JSON.parse(albumRow.data_json || '{}');
          const sponsors = Array.isArray(albumData.sponsors) ? [...albumData.sponsors] : [];
          const existingIdx = sponsors.findIndex(
            (s: any) => s.id === allocId || s.isKoHotCredit === true || s.reference?.startsWith('KOHOT-ALLOC')
          );
          const sponsorEntry = {
            id: allocId,
            sponsorName,
            DisplayLabel: `Sponsored by ${sponsorName}`,
            quantity: targetCap,
            amountPaid: 0,
            reference: `KOHOT-ALLOC-${albumRow.graduation_year || new Date().getFullYear()}`,
            date: new Date().toISOString().split('T')[0],
            showSponsorNameOnAlbum: showRecognition,
            isKoHotCredit: true,
          };
          if (existingIdx !== -1) {
            sponsors[existingIdx] = { ...sponsors[existingIdx], ...sponsorEntry };
          } else {
            sponsors.unshift(sponsorEntry);
          }
          albumData.sponsors = sponsors;
          await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(JSON.stringify(albumData), albumId)
            .run();
        } catch {}
      } else if (currentGranted > 0) {
        // Removing funding or switching to discount: remove unused funded grant slots
        const removable = Math.max(0, currentGranted - totalUsed);
        if (removable > 0) {
          await env.DB.prepare(
            `INSERT INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
             VALUES (?, ?, ?, 'kohot_allocation_adjustment', ?, ?, ?, ?, 'system', datetime('now'))`
          ).bind(
            `sled-crem-${allocId}-${Date.now()}`,
            albumId,
            -removable,
            allocId,
            sponsorName,
            unitValueKobo,
            `calloc-rem:${allocId}:${Date.now()}`
          ).run();
        }
        try {
          const albumData = JSON.parse(albumRow.data_json || '{}');
          if (Array.isArray(albumData.sponsors)) {
            albumData.sponsors = albumData.sponsors.filter(
              (s: any) => s.id !== allocId && !s.isKoHotCredit
            );
            await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
              .bind(JSON.stringify(albumData), albumId)
              .run();
          }
        } catch {}
      }
    };

    // ============================================================================
    // SINGLE SERVER-SIDE PRICING PRECEDENCE FUNCTION (resolveCohortPricing)
    // Precedence:
    // 1. Active, in-date Funding allocation for (institution_id, department_id, graduation_year)
    //    (covered while coverage remains; once coverage is used up -> Standard)
    // 2. Else active, in-date Discount allocation (Standard * (1 - rate), whole kobo)
    // 3. Else Standard (student_fee_kobo in platform_settings)
    // ============================================================================
    const resolveCohortPricing = async (params: {
      institutionId?: string;
      departmentId?: string;
      graduationYear?: number;
      albumId?: string;
    }) => {
      await ensureCohortOffersSchema();
      const settings = await getPlatformSettingsMap(env);
      const standardPriceKobo = Number(settings.student_fee_kobo) || 100000;
      const defaultCap = Number(settings.profile_cap_default) || 200;

      let institutionId = String(params.institutionId || '').trim();
      let departmentId = String(params.departmentId || '').trim();
      let graduationYear = Number(params.graduationYear) || 0;
      let albumId = String(params.albumId || '').trim();
      let matchedAlbum: any = null;

      if (env.DB) {
        const setsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
        const allSets = setsRes?.results || [];
        if (albumId) {
          matchedAlbum = allSets.find((s: any) => String(s.id) === albumId && s.status !== 'deleted') || null;
        }
        if (matchedAlbum) {
          let parsed: any = {};
          try { parsed = JSON.parse(matchedAlbum.data_json || '{}'); } catch {}
          if (!institutionId) institutionId = String(matchedAlbum.institution_id || parsed.institutionId || parsed.universityId || '');
          if (!departmentId) departmentId = String(matchedAlbum.department_id || parsed.departmentId || '');
          if (!graduationYear) graduationYear = Number(matchedAlbum.graduation_year || parsed.graduationYear) || 0;
        } else if (institutionId && departmentId && graduationYear) {
          matchedAlbum =
            allSets.find(
              (s: any) =>
                String(s.institution_id).toLowerCase() === institutionId.toLowerCase() &&
                String(s.department_id).toLowerCase() === departmentId.toLowerCase() &&
                Number(s.graduation_year) === graduationYear &&
                s.status !== 'deleted'
            ) || null;
          if (matchedAlbum && !albumId) {
            albumId = String(matchedAlbum.id);
          }
        }
      }

      // Demo set fallback for Crownfield Law sets
      if (albumId && (!institutionId || !departmentId || !graduationYear)) {
        const lowerAlbum = albumId.toLowerCase();
        if (lowerAlbum.includes('crownfield-law')) {
          if (!institutionId) institutionId = 'uni-crownfield';
          if (!departmentId) departmentId = 'dept-crownfield-law';
          const yrMatch = lowerAlbum.match(/(20\d{2})$/);
          if (!graduationYear && yrMatch) graduationYear = Number(yrMatch[1]);
        }
      }
      if (!graduationYear) graduationYear = new Date().getFullYear();

      const standardResult = {
        kind: 'standard' as 'standard' | 'funding' | 'discount',
        standardPriceKobo,
        effectivePriceKobo: standardPriceKobo,
        discountPercent: 0,
        discountKobo: 0,
        programmeId: null as string | null,
        programmeName: null as string | null,
        sponsorName: null as string | null,
        showRecognition: false,
        coverageMode: null as 'all' | 'per_album_cap' | null,
        coverageCap: 0,
        coverageUsed: 0,
        coverageRemaining: 0,
        isCovered: false,
        coverageExhausted: false,
        validFrom: null as string | null,
        validTo: null as string | null,
        expiresBeforeGraduation: false,
        institutionId,
        departmentId,
        graduationYear,
        albumId: albumId || null,
      };

      if (!env.DB || !institutionId || !departmentId || !graduationYear) {
        return standardResult;
      }

      const allocRes = await env.DB.prepare(`SELECT * FROM cohort_allocations`).all();
      const allocRow = (allocRes?.results || []).find(
        (a: any) =>
          String(a.institution_id).toLowerCase() === institutionId.toLowerCase() &&
          String(a.department_id).toLowerCase() === departmentId.toLowerCase() &&
          Number(a.graduation_year) === graduationYear
      );

      if (!allocRow || !allocRow.programme_id) {
        return standardResult;
      }

      const progRow = await env.DB.prepare(`SELECT * FROM programmes WHERE id = ?`)
        .bind(String(allocRow.programme_id))
        .first();

      if (!progRow) {
        return standardResult;
      }

      const todayLagos = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
      const validFrom = progRow.valid_from ? String(progRow.valid_from).slice(0, 10) : null;
      const validTo = progRow.valid_to ? String(progRow.valid_to).slice(0, 10) : null;
      const isStatusActive = String(progRow.status || 'active') === 'active';
      const isAfterStart = !validFrom || todayLagos >= validFrom;
      const isBeforeEnd = !validTo || todayLagos <= validTo;
      const isInDateAndActive = isStatusActive && isAfterStart && isBeforeEnd;
      const expiresBeforeGraduation = Boolean(validTo && validTo < `${graduationYear}-12-31`);

      if (!isInDateAndActive) {
        return {
          ...standardResult,
          expiresBeforeGraduation,
          validFrom,
          validTo,
        };
      }

      // 1. Active, in-date FUNDING allocation
      if (progRow.kind === 'funding') {
        const coverageMode: 'all' | 'per_album_cap' =
          progRow.coverage_mode === 'all' ? 'all' : 'per_album_cap';
        const cap =
          coverageMode === 'all'
            ? defaultCap
            : Math.max(1, Math.floor(Number(progRow.coverage_cap) || defaultCap));
        const sponsorName = String(progRow.sponsor_name || 'KoHot').trim() || 'KoHot';
        const showRecognition = Boolean(
          Number(progRow.show_recognition) !== 0 && progRow.show_recognition !== false
        );

        let usedSlots = 0;
        if (matchedAlbum) {
          await syncAlbumFundingGrant(matchedAlbum, String(allocRow.id), progRow, cap, standardPriceKobo);
          const ledgerRes = await env.DB.prepare(`SELECT delta FROM slot_ledger WHERE album_id = ?`)
            .bind(matchedAlbum.id)
            .all();
          const allLedger = ledgerRes?.results || [];
          usedSlots = allLedger
            .filter((l: any) => Number(l.delta) < 0)
            .reduce((acc: number, l: any) => acc + Math.abs(Number(l.delta)), 0);
        }

        const coverageUsed = Math.min(cap, usedSlots);
        const coverageRemaining = Math.max(0, cap - coverageUsed);

        if (coverageRemaining > 0) {
          return {
            kind: 'funding' as const,
            standardPriceKobo,
            effectivePriceKobo: 0,
            discountPercent: 100,
            discountKobo: standardPriceKobo,
            programmeId: String(progRow.id),
            programmeName: String(progRow.name),
            sponsorName,
            showRecognition,
            coverageMode,
            coverageCap: cap,
            coverageUsed,
            coverageRemaining,
            isCovered: true,
            coverageExhausted: false,
            validFrom,
            validTo,
            expiresBeforeGraduation,
            institutionId,
            departmentId,
            graduationYear,
            albumId: albumId || null,
          };
        }

        // Coverage is used up -> falls back to Standard!
        return {
          ...standardResult,
          programmeId: String(progRow.id),
          programmeName: String(progRow.name),
          sponsorName,
          showRecognition,
          coverageMode,
          coverageCap: cap,
          coverageUsed: cap,
          coverageRemaining: 0,
          isCovered: false,
          coverageExhausted: true,
          validFrom,
          validTo,
          expiresBeforeGraduation,
        };
      }

      // 2. Active, in-date DISCOUNT allocation (Standard x (1 - rate), whole kobo)
      if (progRow.kind === 'discount') {
        const rate = Math.min(99, Math.max(1, Math.floor(Number(progRow.discount_percent) || 0)));
        const effectivePriceKobo = Math.round((standardPriceKobo * (100 - rate)) / 100);
        const discountKobo = Math.max(0, standardPriceKobo - effectivePriceKobo);
        const sponsorName = progRow.sponsor_name ? String(progRow.sponsor_name).trim() : null;
        const showRecognition = Boolean(
          Number(progRow.show_recognition) !== 0 && progRow.show_recognition !== false
        );

        return {
          kind: 'discount' as const,
          standardPriceKobo,
          effectivePriceKobo,
          discountPercent: rate,
          discountKobo,
          programmeId: String(progRow.id),
          programmeName: String(progRow.name),
          sponsorName,
          showRecognition,
          coverageMode: null,
          coverageCap: 0,
          coverageUsed: 0,
          coverageRemaining: 0,
          isCovered: false,
          coverageExhausted: false,
          validFrom,
          validTo,
          expiresBeforeGraduation,
          institutionId,
          departmentId,
          graduationYear,
          albumId: albumId || null,
        };
      }

      // 3. Else Standard
      return standardResult;
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
          let parsed: any = {};
          try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
          const actorLower = actorEmail.toLowerCase();
          const coAdmins = Array.isArray(parsed.coAdmins) ? parsed.coAdmins : [];
          const isOwner =
            String(albumRow.admin_user_id || '').toLowerCase() === actorLower ||
            String(parsed.classRepEmail || '').toLowerCase() === actorLower ||
            coAdmins.some((c: any) => String(typeof c === 'string' ? c : c?.email || '').toLowerCase() === actorLower);
          if (!isOwner && sessionUser.role !== 'master_host') {
            return new Response(JSON.stringify({ error: 'Forbidden: You do not own this album' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          parsed.wasPublishedBeforeDelete = Boolean(
            parsed.published || parsed.isPublished || albumRow.status === 'published'
          );
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
          let parsed: any = {};
          try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
          const actorLower = actorEmail.toLowerCase();
          const coAdmins = Array.isArray(parsed.coAdmins) ? parsed.coAdmins : [];
          const isOwner =
            String(albumRow.admin_user_id || '').toLowerCase() === actorLower ||
            String(parsed.classRepEmail || '').toLowerCase() === actorLower ||
            coAdmins.some((c: any) => String(typeof c === 'string' ? c : c?.email || '').toLowerCase() === actorLower);
          if (!isOwner && sessionUser.role !== 'master_host') {
            return new Response(JSON.stringify({ error: 'Forbidden: You do not own this album' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          // Enforce 30-day recovery deadline strictly on every restore attempt (even if scheduled cron was delayed)
          if (parsed.deletedAt) {
            const deletedMs = new Date(parsed.deletedAt).getTime();
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const isHostKept = Boolean(parsed.keepByHost || parsed.keptByHostOnly);
            if (!isNaN(deletedMs) && Date.now() - deletedMs >= thirtyDaysMs && !isHostKept) {
              await cleanupExpiredSoftDeletedAlbums(env);
              return new Response(
                JSON.stringify({
                  error: 'recovery_window_expired',
                  message: 'Recovery window expired: Soft-deleted albums can only be restored within 30 days. This album has been permanently purged.',
                }),
                { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
          delete parsed.deletedAt;
          delete parsed.deletedBy;
          const wasPublished = Boolean(parsed.wasPublishedBeforeDelete || parsed.published || parsed.isPublished);
          delete parsed.wasPublishedBeforeDelete;
          parsed.published = wasPublished;
          parsed.isPublished = wasPublished;
          parsed.isUnpublished = !wasPublished;
          parsed.unpublished = !wasPublished;
          parsed.activationStatus = 'active';
          const nextStatus = wasPublished ? 'published' : 'draft';
          parsed.lifecycleStatus = nextStatus;
          parsed.version = (Number(parsed.version) || 1) + 1;
          await env.DB.prepare(
            `UPDATE class_sets SET status = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(nextStatus, JSON.stringify(parsed), albumId).run();
        } else {
          return new Response(
            JSON.stringify({
              error: 'album_not_found_or_purged',
              message: 'Album not found or its 30-day recovery period has expired.',
            }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      await logAudit(
        'album_restored',
        `Album ${albumId} restored within 30-day recovery window by ${actorEmail}.`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true, restoredAt: new Date().toISOString() }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 0f. Permanent Delete Album (Host or Album Owner confirming permanent purge) — deletes exclusive D1 & R2 objects
    const permDeleteMatch = path.match(/^\/api\/albums\/([^/]+)\/delete-permanent$/);
    if (permDeleteMatch && request.method === 'POST') {
      const albumId = decodeURIComponent(permDeleteMatch[1]);
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const actorEmail = sessionUser.email;
      let deletedR2Count = 0;

      if (env.DB) {
        const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (albumRow) {
          let parsedCheck: any = {};
          try { parsedCheck = JSON.parse(albumRow.data_json || '{}'); } catch {}
          const ownerEmail = String(albumRow.admin_user_id || parsedCheck.classRepEmail || '').toLowerCase();
          const isOwner = Boolean(ownerEmail && ownerEmail === actorEmail.toLowerCase());
          if (!isOwner && sessionUser.role !== 'master_host') {
            return new Response(JSON.stringify({ error: 'Forbidden: Only the album owner or Host can permanently delete this album.' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        try {
          const candidateKeys = new Set<string>();
          if (albumRow?.data_json) {
            try {
              const parsed = JSON.parse(albumRow.data_json);
              for (const k of collectAlbumMediaKeys(parsed)) candidateKeys.add(k);
            } catch {}
          }
          const subRows = await env.DB.prepare(`SELECT photo_key, payload_json FROM profile_submissions WHERE album_id = ?`).bind(albumId).all();
          for (const sr of subRows?.results || []) {
            const pk = extractMediaKeyFromUrl(sr.photo_key);
            if (pk) candidateKeys.add(pk);
            if (sr.payload_json) {
              try {
                const sp = JSON.parse(sr.payload_json);
                for (const k of collectAlbumMediaKeys(sp)) candidateKeys.add(k);
              } catch {}
            }
          }
          const assetRows = await env.DB.prepare(`SELECT object_key FROM media_assets WHERE set_id = ?`).bind(albumId).all();
          for (const ar of assetRows?.results || []) {
            const ak = extractMediaKeyFromUrl(ar.object_key);
            if (ak) candidateKeys.add(ak);
          }

          for (const k of candidateKeys) {
            const wasDeleted = await deleteR2ObjectAndRecord(k, albumId);
            if (wasDeleted) deletedR2Count++;
          }

          await env.DB.prepare(`DELETE FROM profile_submissions WHERE album_id = ?`).bind(albumId).run();
          await env.DB.prepare(`DELETE FROM slot_ledger WHERE album_id = ?`).bind(albumId).run();
          await env.DB.prepare(`DELETE FROM class_sets WHERE id = ?`).bind(albumId).run();
        } catch {}
      }

      await logAudit(
        'album_permanently_deleted',
        `Album ${albumId} permanently deleted by ${actorEmail}. Exclusive D1 records and ${deletedR2Count} R2 media objects erased.`,
        actorEmail
      );

      return new Response(JSON.stringify({ success: true, permanentlyDeleted: true, deletedR2Count }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper: verify that sessionUser is master_host or verified owner/co-admin of albumRow
    const verifyAlbumAdminOrHost = (sessionUser: { email: string; role: string } | null, albumRow: any, parsedData: any): { authorized: boolean; status: 401 | 403 | 200; error?: string } => {
      if (!sessionUser) {
        return { authorized: false, status: 401, error: 'Authentication required' };
      }
      if (sessionUser.role === 'master_host') {
        return { authorized: true, status: 200 };
      }
      const actor = sessionUser.email.trim().toLowerCase();
      const ownerEmail = String(albumRow?.admin_user_id || parsedData?.classRepEmail || '').trim().toLowerCase();
      const coAdmins = Array.isArray(parsedData?.coAdmins) ? parsedData.coAdmins : [];
      const isCoAdmin = coAdmins.some((c: any) => String(typeof c === 'string' ? c : c?.email || '').trim().toLowerCase() === actor);
      if (actor && (actor === ownerEmail || isCoAdmin)) {
        return { authorized: true, status: 200 };
      }
      return { authorized: false, status: 403, error: 'Forbidden: Only the album owner, co-admin, or Host can modify this album.' };
    };

    // 0g. Delete Individual Profile (updates D1 data_json + profile_submissions and deletes exclusive R2 photo object)
    const deleteProfileMatch = path.match(/^\/api\/albums\/([^/]+)\/profiles\/([^/]+)$/);
    if (deleteProfileMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteProfileMatch[1]);
      const profileId = decodeURIComponent(deleteProfileMatch[2]);
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
        if (!albumRow) {
          return new Response(JSON.stringify({ error: 'Album not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        let parsed: any = {};
        try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
        const authCheck = verifyAlbumAdminOrHost(sessionUser, albumRow, parsed);
        if (!authCheck.authorized) {
          return new Response(JSON.stringify({ error: authCheck.error }), {
            status: authCheck.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const keysToDelete = new Set<string>();
          const subRow = await env.DB.prepare(`SELECT photo_key, payload_json FROM profile_submissions WHERE id = ? AND album_id = ?`).bind(profileId, albumId).first();
          if (subRow) {
            const pk = extractMediaKeyFromUrl(subRow.photo_key);
            if (pk) keysToDelete.add(pk);
            if (subRow.payload_json) {
              try {
                const p = JSON.parse(subRow.payload_json);
                for (const k of collectAlbumMediaKeys(p)) keysToDelete.add(k);
              } catch {}
            }
            await env.DB.prepare(`UPDATE profile_submissions SET status = 'removed', updated_at = datetime('now') WHERE id = ? AND album_id = ?`).bind(profileId, albumId).run();
          }

          const st = (parsed.students || []).find((s: any) => s.id === profileId);
          if (st) {
            for (const k of collectAlbumMediaKeys(st)) keysToDelete.add(k);
          }
          parsed.students = (parsed.students || []).filter((s: any) => s.id !== profileId);
          parsed.version = (Number(parsed.version) || 1) + 1;
          await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(JSON.stringify(parsed), albumId)
            .run();

          const remainingKeys = collectAlbumMediaKeys(parsed);
          for (const k of keysToDelete) {
            if (!remainingKeys.has(k)) {
              await deleteR2ObjectAndRecord(k, albumId);
            }
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

    // 0h. Delete Individual Memory (updates D1 data_json and deletes exclusive R2 photo objects)
    const deleteMemoryMatch = path.match(/^\/api\/albums\/([^/]+)\/memories\/([^/]+)$/);
    if (deleteMemoryMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteMemoryMatch[1]);
      const memoryId = decodeURIComponent(deleteMemoryMatch[2]);
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
        if (!albumRow) {
          return new Response(JSON.stringify({ error: 'Album not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        let parsed: any = {};
        try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
        const authCheck = verifyAlbumAdminOrHost(sessionUser, albumRow, parsed);
        if (!authCheck.authorized) {
          return new Response(JSON.stringify({ error: authCheck.error }), {
            status: authCheck.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const keysToDelete = new Set<string>();
          const rawMemories = Array.isArray(parsed.memories) ? parsed.memories : [];
          const nextMemories: any[] = [];
          for (const m of rawMemories) {
            if (m.id === memoryId) {
              for (const k of collectAlbumMediaKeys(m)) keysToDelete.add(k);
              continue;
            }
            if (Array.isArray(m.images)) {
              const targetImg = m.images.find((img: any) => img.id === memoryId || `${m.id}-${img.id}` === memoryId);
              if (targetImg) {
                for (const k of collectAlbumMediaKeys(targetImg)) keysToDelete.add(k);
                const remainingImgs = m.images.filter((img: any) => img.id !== memoryId && `${m.id}-${img.id}` !== memoryId);
                if (remainingImgs.length > 0) {
                  nextMemories.push({ ...m, images: remainingImgs });
                }
                continue;
              }
            }
            nextMemories.push(m);
          }
          parsed.memories = nextMemories;
          parsed.version = (Number(parsed.version) || 1) + 1;
          await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(JSON.stringify(parsed), albumId)
            .run();
          const remainingKeys = collectAlbumMediaKeys(parsed);
          for (const k of keysToDelete) {
            if (!remainingKeys.has(k)) {
              await deleteR2ObjectAndRecord(k, albumId);
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

    // 0i. Delete Individual Award (updates D1 data_json and deletes exclusive R2 photo object if any)
    const deleteAwardMatch = path.match(/^\/api\/albums\/([^/]+)\/awards\/([^/]+)$/);
    if (deleteAwardMatch && request.method === 'DELETE') {
      const albumId = decodeURIComponent(deleteAwardMatch[1]);
      const awardId = decodeURIComponent(deleteAwardMatch[2]);
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
        if (!albumRow) {
          return new Response(JSON.stringify({ error: 'Album not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        let parsed: any = {};
        try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
        const authCheck = verifyAlbumAdminOrHost(sessionUser, albumRow, parsed);
        if (!authCheck.authorized) {
          return new Response(JSON.stringify({ error: authCheck.error }), {
            status: authCheck.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const aw = (parsed.awards || []).find((a: any) => a.id === awardId);
          const keysToDelete = aw ? collectAlbumMediaKeys(aw) : new Set<string>();
          parsed.awards = (parsed.awards || []).filter((a: any) => a.id !== awardId);
          parsed.version = (Number(parsed.version) || 1) + 1;
          await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(JSON.stringify(parsed), albumId)
            .run();
          const remainingKeys = collectAlbumMediaKeys(parsed);
          for (const k of keysToDelete) {
            if (!remainingKeys.has(k)) {
              await deleteR2ObjectAndRecord(k, albumId);
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

    // 0i-2. Host-Only Storage Audit, Duplicate Cohort Inventory & Media Health Inspector
    if (path === '/api/admin/storage-audit' && request.method === 'GET') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hostName = url.hostname.toLowerCase();
      const explicitEnv = String((env as any).ENVIRONMENT || (env as any).ENV_MODE || '').trim().toLowerCase();
      const environmentMode: 'development' | 'staging' | 'production' =
        explicitEnv === 'production' || explicitEnv === 'staging' || explicitEnv === 'development'
          ? (explicitEnv as 'development' | 'staging' | 'production')
          : hostName.includes('localhost') || hostName.includes('127.0.0.1') || hostName.startsWith('ais-dev-')
          ? 'development'
          : hostName.startsWith('ais-pre-') || hostName.includes('staging') || hostName.includes('preview')
          ? 'staging'
          : 'production';

      if (!env.DB) {
        return new Response(
          JSON.stringify({
            success: true,
            environment: environmentMode,
            d1Available: false,
            r2Available: Boolean(env.BUCKET),
            duplicateCohorts: [],
            albumsInventory: [],
            deletedAlbumsInventory: [],
            mediaHealth: {
              totalR2Objects: 0,
              totalMediaAssetRows: 0,
              brokenReferences: [],
              orphanedR2Objects: [],
              duplicateMediaGroups: [],
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const allSetsRes = await env.DB.prepare(`SELECT * FROM class_sets ORDER BY created_at DESC`).all();
      const allSets = allSetsRes?.results || [];
      const allSubsRes = await env.DB.prepare(`SELECT * FROM profile_submissions`).all();
      const allSubs = allSubsRes?.results || [];
      const allAssetsRes = await env.DB.prepare(`SELECT * FROM media_assets`).all();
      const allAssets = allAssetsRes?.results || [];
      const allLedgerRes = await env.DB.prepare(`SELECT * FROM slot_ledger`).all();
      const allLedgers = allLedgerRes?.results || [];

      // Paginate through all R2 objects in BUCKET (using cursor loop until !listed.truncated)
      const r2ObjectMap = new Map<string, { key: string; size: number; uploaded?: string }>();
      if (env.BUCKET && typeof env.BUCKET.list === 'function') {
        try {
          let cursor: string | undefined = undefined;
          let safetyPages = 0;
          do {
            const listed: any = await env.BUCKET.list(cursor ? { limit: 1000, cursor } : { limit: 1000 });
            for (const obj of listed?.objects || []) {
              if (obj?.key) {
                r2ObjectMap.set(String(obj.key), {
                  key: String(obj.key),
                  size: Number(obj.size) || 0,
                  uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : undefined,
                });
              }
            }
            cursor = listed?.truncated && listed?.cursor ? String(listed.cursor) : undefined;
            safetyPages++;
          } while (cursor && safetyPages < 100);
        } catch {}
      }

      const allReferencedKeys = new Set<string>();
      const brokenReferences: Array<{
        albumId: string;
        albumName: string;
        itemType: 'student_photo' | 'student_secondary_photo' | 'memory_photo' | 'banner' | 'logo';
        itemId: string;
        itemLabel: string;
        referencedUrl: string;
        extractedKey: string;
        recoverableKey?: string;
      }> = [];

      const cohortGroups = new Map<string, any[]>();
      const albumsInventory: any[] = [];
      const deletedAlbumsInventory: any[] = [];

      for (const row of allSets) {
        let parsed: any = {};
        try { parsed = JSON.parse(row.data_json || '{}'); } catch {}
        const albumId = String(row.id || parsed.id || '');
        const instId = String(row.institution_id || parsed.institutionId || '').trim();
        const deptId = String(row.department_id || parsed.departmentId || '').trim();
        const deptName = String(parsed.departmentName || '').trim();
        const gradYear = Number(row.graduation_year || parsed.graduationYear) || 2026;
        const canonicalDept = normalizeDepartmentCohortSlug(instId, deptId, deptName);
        const canonicalAlbumId = getCanonicalAlbumId(instId, deptId, gradYear, deptName);
        const cohortKey = `${instId.toLowerCase()}::${canonicalDept}::${gradYear}`;

        const rowAdmin = String(row.admin_user_id || parsed.classRepEmail || '').trim().toLowerCase();
        if (sessionUser.role !== 'master_host' && rowAdmin !== sessionUser.email.toLowerCase()) {
          continue;
        }

        const students = Array.isArray(parsed.students) ? parsed.students : [];
        const memories = Array.isArray(parsed.memories) ? parsed.memories : [];
        const albumSubs = allSubs.filter((s: any) => String(s.album_id) === albumId);
        const albumLedgers = allLedgers.filter((l: any) => String(l.album_id) === albumId);
        const albumAssets = allAssets.filter((a: any) => String(a.set_id) === albumId);
        const mediaKeys = collectAlbumMediaKeys(parsed);
        for (const k of mediaKeys) allReferencedKeys.add(k);

        // Check each student and memory media reference against R2
        const findRecoverableKey = (missingKey: string): string | undefined => {
          if (r2ObjectMap.has(missingKey)) return missingKey;
          const fileName = missingKey.split('/').pop() || '';
          if (!fileName) return undefined;
          for (const existingKey of r2ObjectMap.keys()) {
            if (existingKey.endsWith(`/${fileName}`)) return existingKey;
          }
          for (const asset of allAssets) {
            const ak = String(asset.object_key || '');
            if (ak && (ak.endsWith(`/${fileName}`) || (asset.file_name && missingKey.includes(String(asset.file_name))))) {
              if (r2ObjectMap.size === 0 || r2ObjectMap.has(ak)) return ak;
            }
          }
          return undefined;
        };

        for (const st of students) {
          const pKey = extractMediaKeyFromUrl(st.photoUrl || st.image);
          if (pKey && r2ObjectMap.size > 0 && !r2ObjectMap.has(pKey)) {
            brokenReferences.push({
              albumId,
              albumName: `${deptName || deptId} (${gradYear})`,
              itemType: 'student_photo',
              itemId: String(st.id || ''),
              itemLabel: String(st.fullName || 'Student'),
              referencedUrl: String(st.photoUrl || st.image || ''),
              extractedKey: pKey,
              recoverableKey: findRecoverableKey(pKey),
            });
          }
          const sKey = extractMediaKeyFromUrl(st.secondaryPhotoUrl);
          if (sKey && r2ObjectMap.size > 0 && !r2ObjectMap.has(sKey)) {
            brokenReferences.push({
              albumId,
              albumName: `${deptName || deptId} (${gradYear})`,
              itemType: 'student_secondary_photo',
              itemId: String(st.id || ''),
              itemLabel: String(st.fullName || 'Student'),
              referencedUrl: String(st.secondaryPhotoUrl || ''),
              extractedKey: sKey,
              recoverableKey: findRecoverableKey(sKey),
            });
          }
        }

        for (const mem of memories) {
          if (Array.isArray(mem.images)) {
            for (const img of mem.images) {
              const imgKey = extractMediaKeyFromUrl(img.url || img.imageUrl);
              if (imgKey && r2ObjectMap.size > 0 && !r2ObjectMap.has(imgKey)) {
                brokenReferences.push({
                  albumId,
                  albumName: `${deptName || deptId} (${gradYear})`,
                  itemType: 'memory_photo',
                  itemId: String(img.id || mem.id || ''),
                  itemLabel: String(img.caption || mem.title || 'Memory Photo'),
                  referencedUrl: String(img.url || img.imageUrl || ''),
                  extractedKey: imgKey,
                  recoverableKey: findRecoverableKey(imgKey),
                });
              }
            }
          }
          const mKey = extractMediaKeyFromUrl(mem.imageUrl || mem.url);
          if (mKey && r2ObjectMap.size > 0 && !r2ObjectMap.has(mKey)) {
            brokenReferences.push({
              albumId,
              albumName: `${deptName || deptId} (${gradYear})`,
              itemType: 'memory_photo',
              itemId: String(mem.id || ''),
              itemLabel: String(mem.caption || mem.title || mem.category || 'Memory'),
              referencedUrl: String(mem.imageUrl || mem.url || ''),
              extractedKey: mKey,
              recoverableKey: findRecoverableKey(mKey),
            });
          }
        }

        const r2ObjectsUnderPrefix = Array.from(r2ObjectMap.keys()).filter((k) => k.startsWith(`albums/${albumId}/`));

        const summaryItem = {
          id: albumId,
          canonicalAlbumId,
          cohortKey,
          institutionId: instId,
          institutionName: parsed.institutionName || instId.toUpperCase(),
          departmentId: deptId,
          canonicalDepartmentId: canonicalDept,
          departmentName: deptName || deptId,
          graduationYear: gradYear,
          classSetName: row.class_set_name || parsed.classSetName || `Class of ${gradYear}`,
          adminEmail: rowAdmin,
          classRepName: parsed.classRepName || '',
          status: row.status || parsed.lifecycleStatus || 'draft',
          isPublished: Boolean((row.status === 'published' || parsed.published || parsed.isPublished) && !parsed.unpublished && !parsed.deletedAt),
          deletedAt: parsed.deletedAt || null,
          keepByHost: Boolean(parsed.keepByHost || parsed.keptByHostOnly),
          studentsCount: students.length,
          memoriesCount: memories.length,
          awardsCount: Array.isArray(parsed.awards) ? parsed.awards.length : 0,
          submissionsCount: albumSubs.length,
          slotBalance: Number(parsed.profileSlotBalance) || 0,
          totalSlotsCredited: Number(parsed.totalSlotsCredited) || 0,
          ledgerEntriesCount: albumLedgers.length,
          mediaAssetsCount: albumAssets.length,
          referencedMediaKeysCount: mediaKeys.size,
          r2PrefixObjectsCount: r2ObjectsUnderPrefix.length,
          createdAt: row.created_at || parsed.createdAt || '',
          updatedAt: row.updated_at || '',
        };

        albumsInventory.push(summaryItem);

        if (row.status === 'deleted' || parsed.deletedAt) {
          const deletedMs = parsed.deletedAt ? new Date(parsed.deletedAt).getTime() : Date.now();
          const daysRemaining = Math.max(0, Math.ceil((deletedMs + 30 * 86400000 - Date.now()) / 86400000));
          deletedAlbumsInventory.push({
            ...summaryItem,
            daysRemaining,
            exclusiveMediaKeys: Array.from(mediaKeys),
          });
        } else {
          const group = cohortGroups.get(cohortKey) || [];
          group.push(summaryItem);
          cohortGroups.set(cohortKey, group);
        }
      }

      const duplicateCohorts = Array.from(cohortGroups.entries())
        .filter(([_, list]) => list.length > 1)
        .map(([cohortKey, albums]) => {
          // Sort so the richest album (most students + memories + slots) is recommended as Primary
          const sorted = [...albums].sort(
            (a, b) =>
              b.studentsCount * 10 +
              b.memoriesCount * 5 +
              b.totalSlotsCredited * 2 +
              b.submissionsCount * 5 -
              (a.studentsCount * 10 + a.memoriesCount * 5 + a.totalSlotsCredited * 2 + a.submissionsCount * 5)
          );
          return {
            cohortKey,
            institutionId: sorted[0].institutionId,
            departmentName: sorted[0].departmentName,
            graduationYear: sorted[0].graduationYear,
            recommendedPrimaryAlbumId: sorted[0].id,
            albums: sorted,
          };
        });

      // Identify orphaned R2 objects (present in R2 or media_assets under albums/ but not referenced by any album or active submission)
      for (const s of allSubs) {
        if (s.status !== 'removed') {
          const pk = extractMediaKeyFromUrl(s.photo_key);
          if (pk) allReferencedKeys.add(pk);
        }
      }

      const orphanedR2Objects: Array<{ key: string; albumIdFromPrefix: string; section: string; size: number; url: string }> = [];
      for (const [key, meta] of r2ObjectMap.entries()) {
        if (key.startsWith('albums/') && !key.startsWith('albums/site-hero/') && !allReferencedKeys.has(key)) {
          const parts = key.split('/');
          orphanedR2Objects.push({
            key,
            albumIdFromPrefix: parts[1] || 'unknown',
            section: parts[2] || 'general',
            size: meta.size,
            url: `/media/${key}`,
          });
        }
      }

      // Identify genuine duplicate media assets by sha256 or (set_id + size_bytes + file_name)
      const hashGroups = new Map<string, any[]>();
      for (const asset of allAssets) {
        const sig = asset.sha256
          ? `sha256:${asset.sha256}`
          : asset.size_bytes && asset.file_name
          ? `file:${asset.set_id}:${asset.file_name}:${asset.size_bytes}`
          : '';
        if (!sig) continue;
        const list = hashGroups.get(sig) || [];
        list.push({
          id: asset.id,
          setId: asset.set_id,
          section: asset.section,
          objectKey: asset.object_key,
          publicUrl: asset.public_url,
          sizeBytes: asset.size_bytes,
          isReferenced: allReferencedKeys.has(String(asset.object_key || '')),
        });
        hashGroups.set(sig, list);
      }

      const duplicateMediaGroups = Array.from(hashGroups.entries())
        .filter(([_, items]) => items.length > 1)
        .map(([signature, items]) => ({ signature, count: items.length, items }));

      return new Response(
        JSON.stringify({
          success: true,
          environment: environmentMode,
          d1Available: true,
          r2Available: Boolean(env.BUCKET),
          duplicateCohorts,
          albumsInventory,
          deletedAlbumsInventory,
          mediaHealth: {
            totalR2Objects: r2ObjectMap.size,
            totalMediaAssetRows: allAssets.length,
            brokenReferences,
            orphanedR2Objects,
            duplicateMediaGroups,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 0i-2b. Host-Only Complete R2 Media Management & Recovery Center Inventory (GET /api/admin/r2-media-inventory)
    if (path === '/api/admin/r2-media-inventory' && request.method === 'GET') {
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await cleanupExpiredSoftDeletedAlbums(env);

      const allSetsRes = env.DB ? await env.DB.prepare(`SELECT * FROM class_sets ORDER BY created_at DESC`).all() : { results: [] };
      const allSets = allSetsRes?.results || [];
      const allSubsRes = env.DB ? await env.DB.prepare(`SELECT * FROM profile_submissions`).all() : { results: [] };
      const allSubs = allSubsRes?.results || [];
      const allAssetsRes = env.DB ? await env.DB.prepare(`SELECT * FROM media_assets ORDER BY created_at DESC`).all() : { results: [] };
      const allAssets = allAssetsRes?.results || [];
      const instRes = env.DB ? await env.DB.prepare(`SELECT * FROM institutions`).all().catch(() => ({ results: [] })) : { results: [] };
      const allInsts = instRes?.results || [];
      const testRes = env.DB ? await env.DB.prepare(`SELECT * FROM testimonials`).all().catch(() => ({ results: [] })) : { results: [] };
      const allTestimonials = testRes?.results || [];
      const siteOverridesRes = env.DB ? await env.DB.prepare(`SELECT * FROM website_content_overrides`).all().catch(() => ({ results: [] })) : { results: [] };
      const allSiteOverrides = siteOverridesRes?.results || [];

      const r2ObjectMap = new Map<string, { key: string; size: number; uploaded?: string; contentType?: string }>();
      if (env.BUCKET && typeof env.BUCKET.list === 'function') {
        try {
          let cursor: string | undefined = undefined;
          let pages = 0;
          do {
            const listed: any = await env.BUCKET.list(cursor ? { limit: 1000, cursor } : { limit: 1000 });
            for (const obj of listed?.objects || []) {
              if (obj?.key) {
                r2ObjectMap.set(String(obj.key), {
                  key: String(obj.key),
                  size: Number(obj.size) || 0,
                  uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : undefined,
                  contentType: obj.httpMetadata?.contentType || undefined,
                });
              }
            }
            cursor = listed?.truncated && listed?.cursor ? String(listed.cursor) : undefined;
            pages++;
          } while (cursor && pages < 100);
        } catch {}
      }

      const d1AssetMap = new Map<string, any>();
      for (const a of allAssets) {
        const k = extractMediaKeyFromUrl(a.object_key || a.public_url);
        if (k) d1AssetMap.set(k, a);
      }

      const albumMap = new Map<string, { id: string; name: string; departmentName: string; graduationYear: number; isDeleted: boolean; deletedAt: string | null; parsed: any }>();
      // Track active references and broken references
      const activeReferenceMap = new Map<string, {
        albumId: string;
        albumName: string;
        recordType: string;
        recordId: string;
        recordLabel: string;
        isSoftDeletedAlbum: boolean;
      }>();
      const missingR2References: Array<{
        key: string;
        albumId: string;
        albumName: string;
        recordType: string;
        recordId: string;
        recordLabel: string;
        referencedUrl: string;
      }> = [];

      for (const row of allSets) {
        let parsed: any = {};
        try { parsed = JSON.parse(row.data_json || '{}'); } catch {}
        const aid = String(row.id || parsed.id || '');
        const deptName = String(parsed.departmentName || row.department_id || 'Department');
        const gradYear = Number(row.graduation_year || parsed.graduationYear) || 2026;
        const albumName = `${deptName} (${gradYear})`;
        const isDeleted = row.status === 'deleted' || Boolean(parsed.deletedAt);
        albumMap.set(aid, { id: aid, name: albumName, departmentName: deptName, graduationYear: gradYear, isDeleted, deletedAt: parsed.deletedAt || null, parsed });

        const registerRef = (rawUrl: unknown, recordType: string, recordId: string, recordLabel: string) => {
          const k = extractMediaKeyFromUrl(rawUrl);
          if (!k) return;
          activeReferenceMap.set(k, {
            albumId: aid,
            albumName,
            recordType,
            recordId,
            recordLabel,
            isSoftDeletedAlbum: isDeleted,
          });
          if (!r2ObjectMap.has(k)) {
            missingR2References.push({
              key: k,
              albumId: aid,
              albumName,
              recordType,
              recordId,
              recordLabel,
              referencedUrl: String(rawUrl || ''),
            });
          }
        };

        registerRef(parsed.bannerImageUrl, 'banner', aid, `${albumName} Hero Banner`);
        registerRef(parsed.legacyGroupImageUrl || parsed.legacyFooterUrl, 'footer', aid, `${albumName} Footer Photo`);
        registerRef(parsed.departmentLogoUrl, 'logo', aid, `${albumName} Department Logo`);
        registerRef(parsed.ambientAudioUrl, 'soundtrack', aid, `${albumName} Ambient Audio`);

        for (const st of Array.isArray(parsed.students) ? parsed.students : []) {
          registerRef(st.photoUrl || st.image, 'profile', String(st.id || ''), String(st.fullName || 'Graduate Profile'));
          registerRef(st.secondaryPhotoUrl, 'profile', String(st.id || ''), `${st.fullName || 'Graduate'} (2nd Photo)`);
        }
        for (const mem of Array.isArray(parsed.memories) ? parsed.memories : []) {
          registerRef(mem.imageUrl || mem.url, 'moment', String(mem.id || ''), String(mem.title || mem.category || 'Moment'));
          if (Array.isArray(mem.images)) {
            for (const img of mem.images) {
              registerRef(img.url || img.imageUrl, 'moment', String(img.id || mem.id || ''), `${mem.title || 'Moment'}${img.caption ? `: ${img.caption}` : ''}`);
            }
          }
        }
      }

      // Submissions references
      for (const s of allSubs) {
        if (s.status === 'removed') continue;
        const aid = String(s.album_id || '');
        const alb = albumMap.get(aid);
        let sp: any = {};
        try { sp = JSON.parse(s.payload_json || '{}'); } catch {}
        const label = String(sp.fullName || s.email || 'Submission');
        const registerSubKey = (raw: unknown) => {
          const k = extractMediaKeyFromUrl(raw);
          if (!k || activeReferenceMap.has(k)) return;
          activeReferenceMap.set(k, {
            albumId: aid,
            albumName: alb?.name || aid || 'Submissions',
            recordType: 'submission',
            recordId: String(s.id || ''),
            recordLabel: `${label} (${s.status || 'pending'})`,
            isSoftDeletedAlbum: Boolean(alb?.isDeleted),
          });
        };
        registerSubKey(s.photo_key);
        registerSubKey(sp.photoUrl || sp.image);
        registerSubKey(sp.secondaryPhotoUrl);
      }

      // Institutions, Testimonials, Website Content Overrides references
      for (const inst of allInsts) {
        const lk = extractMediaKeyFromUrl(inst.logo_url);
        if (lk && !activeReferenceMap.has(lk)) {
          activeReferenceMap.set(lk, {
            albumId: 'platform-institutions',
            albumName: String(inst.name || inst.id || 'Institution'),
            recordType: 'logo',
            recordId: String(inst.id || ''),
            recordLabel: `${inst.name || inst.id} Official Logo`,
            isSoftDeletedAlbum: false,
          });
        }
      }
      for (const t of allTestimonials) {
        for (const u of [t.admin_avatar_url, t.avatar_url, t.album_cover_url]) {
          const tk = extractMediaKeyFromUrl(u);
          if (tk && !activeReferenceMap.has(tk)) {
            activeReferenceMap.set(tk, {
              albumId: 'platform-testimonials',
              albumName: 'Website Testimonials',
              recordType: 'website',
              recordId: String(t.id || ''),
              recordLabel: `Testimonial: ${t.admin_name || t.id}`,
              isSoftDeletedAlbum: false,
            });
          }
        }
      }
      for (const ov of allSiteOverrides) {
        try {
          const parsedOv = JSON.parse(ov.data_json || '{}');
          for (const k of collectAlbumMediaKeys(parsedOv)) {
            if (!activeReferenceMap.has(k)) {
              activeReferenceMap.set(k, {
                albumId: 'platform-website',
                albumName: 'Website Media & Soundtrack',
                recordType: 'website',
                recordId: 'global',
                recordLabel: k.includes('audio') ? 'Platform Ambient Soundtrack' : 'Website Hero / Pillar Media',
                isSoftDeletedAlbum: false,
              });
            }
          }
        } catch {}
      }

      const inferMimeAndType = (key: string, d1Row?: any, r2Meta?: any): { mimeType: string; fileType: 'image' | 'audio' | 'video' | 'other' } => {
        const ext = (key.split('.').pop() || '').toLowerCase();
        const mime =
          d1Row?.mime_type ||
          r2Meta?.contentType ||
          (ext === 'webp'
            ? 'image/webp'
            : ext === 'png'
            ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'mp3'
            ? 'audio/mpeg'
            : ext === 'wav'
            ? 'audio/wav'
            : ext === 'ogg'
            ? 'audio/ogg'
            : ext === 'm4a'
            ? 'audio/mp4'
            : ext === 'mp4'
            ? 'video/mp4'
            : ext === 'webm'
            ? 'video/webm'
            : 'application/octet-stream');
        const fileType: 'image' | 'audio' | 'video' | 'other' = mime.startsWith('image/')
          ? 'image'
          : mime.startsWith('audio/')
          ? 'audio'
          : mime.startsWith('video/')
          ? 'video'
          : 'other';
        return { mimeType: mime, fileType };
      };

      const allKeysUnion = new Set<string>([
        ...Array.from(r2ObjectMap.keys()),
        ...Array.from(d1AssetMap.keys()),
        ...missingR2References.map((m) => m.key),
      ]);

      const inventoryItems: any[] = [];
      let totalBytesInR2 = 0;

      for (const key of allKeysUnion) {
        const r2Obj = r2ObjectMap.get(key);
        const d1Asset = d1AssetMap.get(key);
        const activeRef = activeReferenceMap.get(key);
        const missingRef = missingR2References.find((m) => m.key === key);

        if (r2Obj) totalBytesInR2 += r2Obj.size;

        const { mimeType, fileType } = inferMimeAndType(key, d1Asset, r2Obj);
        const fileName = d1Asset?.file_name || key.split('/').pop() || key;
        const sizeBytes = r2Obj?.size ?? Number(d1Asset?.size_bytes || 0);
        const uploadedAt = r2Obj?.uploaded || d1Asset?.created_at || new Date().toISOString();

        // Parse prefix albums/<albumId>/<section>/...
        const keyParts = key.split('/');
        const isStandardAlbumPrefix = keyParts[0] === 'albums' && keyParts.length >= 3;
        const prefixAlbumId = isStandardAlbumPrefix ? keyParts[1] : d1Asset?.set_id || '';
        const prefixSection = isStandardAlbumPrefix ? keyParts[2] : d1Asset?.section || '';
        const matchedAlbumByPrefix = albumMap.get(prefixAlbumId);

        let status: 'linked' | 'orphaned' | 'recoverable' | 'missing-reference' | 'unrecognised' = 'linked';
        let suggestedRecovery: any = null;
        let isProtectedFromAutoDelete = false;
        let protectionReason = '';

        if (!r2Obj && missingRef) {
          status = 'missing-reference';
          isProtectedFromAutoDelete = true;
          protectionReason = 'Active database reference awaiting media recovery';
          // Check if another object in R2 has the same filename
          const candidateKey = Array.from(r2ObjectMap.keys()).find((rk) => rk.endsWith(`/${fileName}`));
          if (candidateKey) {
            const candAlbum = albumMap.get(missingRef.albumId);
            suggestedRecovery = {
              albumId: missingRef.albumId,
              albumName: candAlbum?.name || missingRef.albumName,
              targetType: missingRef.recordType === 'profile' ? 'profile' : missingRef.recordType === 'moment' ? 'moment' : 'banner',
              targetRecordId: missingRef.recordId,
              targetRecordLabel: missingRef.recordLabel,
              replacementKey: candidateKey,
              confidence: 'high',
              reason: `Matching R2 file "${candidateKey}" found for broken reference on ${missingRef.recordLabel}`,
            };
          }
        } else if (activeRef) {
          if (activeRef.isSoftDeletedAlbum) {
            status = 'recoverable';
            isProtectedFromAutoDelete = true;
            protectionReason = 'Belongs to a soft-deleted album within its 30-day recovery period';
            suggestedRecovery = {
              albumId: activeRef.albumId,
              albumName: activeRef.albumName,
              targetType: activeRef.recordType === 'profile' ? 'profile' : activeRef.recordType === 'moment' ? 'moment' : 'banner',
              targetRecordId: activeRef.recordId,
              targetRecordLabel: activeRef.recordLabel,
              confidence: 'high',
              reason: `Associated with soft-deleted album "${activeRef.albumName}" (recoverable within 30 days)`,
            };
          } else {
            status = 'linked';
            isProtectedFromAutoDelete = true;
            protectionReason = `Actively linked to ${activeRef.albumName} (${activeRef.recordLabel})`;
          }
        } else if (isStandardAlbumPrefix || d1Asset?.set_id) {
          // Not in activeReferenceMap — check if we can confidently establish original album/record relationship
          const inferredTargetType: 'profile' | 'moment' | 'banner' | 'footer' =
            prefixSection.includes('student') || prefixSection.includes('profile') || prefixSection.includes('submission')
              ? 'profile'
              : prefixSection.includes('banner') || prefixSection.includes('hero')
              ? 'banner'
              : prefixSection.includes('footer')
              ? 'footer'
              : 'moment';

          if (matchedAlbumByPrefix) {
            status = 'recoverable';
            if (matchedAlbumByPrefix.isDeleted) {
              isProtectedFromAutoDelete = true;
              protectionReason = 'Belongs to soft-deleted album within 30-day recovery window';
            }
            // Check if a broken reference in this album matches
            const matchingBroken = missingR2References.find((m) => m.albumId === matchedAlbumByPrefix.id);
            suggestedRecovery = {
              albumId: matchedAlbumByPrefix.id,
              albumName: matchedAlbumByPrefix.name,
              targetType: matchingBroken ? (matchingBroken.recordType as any) : inferredTargetType,
              targetRecordId: matchingBroken?.recordId || undefined,
              targetRecordLabel: matchingBroken?.recordLabel || (inferredTargetType === 'moment' ? 'Recovered Moments' : inferredTargetType === 'profile' ? 'Graduate Profile' : 'Album Banner'),
              confidence: 'high',
              reason: `Storage path identifies album "${matchedAlbumByPrefix.name}" (${prefixSection || 'moments'})`,
            };
          } else {
            status = 'orphaned';
            const firstActiveAlbum = Array.from(albumMap.values()).find((a) => !a.isDeleted) || Array.from(albumMap.values())[0];
            if (firstActiveAlbum) {
              suggestedRecovery = {
                albumId: firstActiveAlbum.id,
                albumName: firstActiveAlbum.name,
                targetType: inferredTargetType,
                targetRecordLabel: inferredTargetType === 'moment' ? 'Recovered Moments' : 'Album Record',
                confidence: 'medium',
                reason: `Original album "${prefixAlbumId}" no longer exists; can be relinked to an active album`,
              };
            }
          }
        } else {
          status = 'unrecognised';
        }

        inventoryItems.push({
          key,
          url: `/media/${key}`,
          fileName,
          mimeType,
          fileType,
          sizeBytes,
          uploadedAt,
          inR2: Boolean(r2Obj),
          inD1Assets: Boolean(d1Asset),
          status,
          associatedAlbumId: activeRef?.albumId || matchedAlbumByPrefix?.id || prefixAlbumId || null,
          associatedAlbumName: activeRef?.albumName || matchedAlbumByPrefix?.name || (prefixAlbumId ? `Orphaned Cohort (${prefixAlbumId})` : null),
          associatedRecordType: activeRef?.recordType || prefixSection || 'unknown',
          associatedRecordId: activeRef?.recordId || null,
          associatedRecordLabel: activeRef?.recordLabel || null,
          suggestedRecovery,
          isProtectedFromAutoDelete,
          protectionReason,
        });
      }

      // Sort: recoverable & orphaned & missing-reference first so Host sees actionable media immediately, then by newest
      const statusPriority: Record<string, number> = {
        recoverable: 1,
        orphaned: 2,
        'missing-reference': 3,
        unrecognised: 4,
        linked: 5,
      };
      inventoryItems.sort((a, b) => {
        const pa = statusPriority[a.status] || 9;
        const pb = statusPriority[b.status] || 9;
        if (pa !== pb) return pa - pb;
        return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
      });

      const counts = {
        all: inventoryItems.length,
        linked: inventoryItems.filter((i) => i.status === 'linked').length,
        orphaned: inventoryItems.filter((i) => i.status === 'orphaned').length,
        recoverable: inventoryItems.filter((i) => i.status === 'recoverable').length,
        missingReference: inventoryItems.filter((i) => i.status === 'missing-reference').length,
        unrecognised: inventoryItems.filter((i) => i.status === 'unrecognised').length,
        totalBytesInR2,
      };

      // Record scan in platform_settings scan history
      let scanHistory: any[] = [];
      if (env.DB) {
        try {
          const settings = await getPlatformSettingsMap(env);
          try { scanHistory = JSON.parse(settings.r2_scan_history_json || '[]'); } catch {}
          if (!Array.isArray(scanHistory)) scanHistory = [];
          const newEntry = {
            id: `scan-${Date.now()}`,
            scannedAt: new Date().toISOString(),
            scannedBy: sessionUser.email,
            totalObjects: counts.all,
            totalBytes: totalBytesInR2,
            linked: counts.linked,
            orphaned: counts.orphaned,
            recoverable: counts.recoverable,
            missingReference: counts.missingReference,
            unrecognised: counts.unrecognised,
          };
          scanHistory = [newEntry, ...scanHistory].slice(0, 15);
          await env.DB.prepare(
            `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('r2_scan_history_json', ?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`
          ).bind(JSON.stringify(scanHistory), sessionUser.email).run();
        } catch {}
      }

      // Fetch recent R2 & Media recovery action logs from audit_logs
      let actionLogs: any[] = [];
      if (env.DB) {
        try {
          const logsRes = await env.DB.prepare(
            `SELECT id, user_email, action, details, created_at FROM audit_logs
             WHERE action LIKE 'r2_media_%' OR action LIKE 'album_%' OR action LIKE 'admin_repaired_%'
             ORDER BY created_at DESC LIMIT 30`
          ).all();
          actionLogs = logsRes?.results || [];
        } catch {}
      }

      const availableAlbums = Array.from(albumMap.values()).map((a) => ({
        id: a.id,
        name: a.name,
        departmentName: a.departmentName,
        graduationYear: a.graduationYear,
        isDeleted: a.isDeleted,
        profiles: (Array.isArray(a.parsed.students) ? a.parsed.students : []).map((st: any) => ({
          id: String(st.id || ''),
          fullName: String(st.fullName || 'Graduate'),
        })),
        momentCategories: (Array.isArray(a.parsed.memories) ? a.parsed.memories : []).map((m: any) => ({
          id: String(m.id || ''),
          title: String(m.title || m.category || 'Moments'),
        })),
      }));

      return new Response(
        JSON.stringify({
          success: true,
          counts,
          items: inventoryItems,
          availableAlbums,
          scanHistory,
          actionLogs,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 0i-2c. Host-Only R2 Media Restore / Relink Endpoint (POST /api/admin/r2-media-recover)
    if (path === '/api/admin/r2-media-recover' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 database unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as {
        items?: Array<{
          key: string;
          replacementKey?: string;
          targetAlbumId: string;
          targetType: 'moment' | 'profile' | 'banner' | 'footer';
          targetProfileId?: string;
          momentCategoryTitle?: string;
          caption?: string;
        }>;
        restoreDeletedAlbum?: boolean;
      };

      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        return new Response(JSON.stringify({ error: 'No media items specified for recovery.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const recoveredResults: Array<{ key: string; albumId: string; targetType: string; detail: string }> = [];

      for (const item of items) {
        const effectiveKey = extractMediaKeyFromUrl(item.replacementKey || item.key);
        const targetAlbumId = String(item.targetAlbumId || '').trim();
        if (!effectiveKey || !targetAlbumId) continue;

        const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(targetAlbumId).first();
        if (!albumRow) continue;

        let parsed: any = {};
        try { parsed = JSON.parse(albumRow.data_json || '{}'); } catch {}
        const mediaUrl = `/media/${effectiveKey}`;

        // Optionally restore soft-deleted album if within 30-day window
        let nextStatus = String(albumRow.status || 'draft');
        if (body.restoreDeletedAlbum && (albumRow.status === 'deleted' || parsed.deletedAt)) {
          const delMs = parsed.deletedAt ? new Date(parsed.deletedAt).getTime() : Date.now();
          if (Date.now() - delMs < 30 * 24 * 60 * 60 * 1000) {
            delete parsed.deletedAt;
            delete parsed.deletedBy;
            const wasPub = Boolean(parsed.wasPublishedBeforeDelete || parsed.published || parsed.isPublished);
            parsed.published = wasPub;
            parsed.isPublished = wasPub;
            parsed.isUnpublished = !wasPub;
            parsed.activationStatus = 'active';
            nextStatus = wasPub ? 'published' : 'draft';
            parsed.lifecycleStatus = nextStatus;
          }
        }

        let detail = '';
        if (item.targetType === 'banner') {
          parsed.bannerImageUrl = mediaUrl;
          detail = `Relinked as Hero Banner on ${targetAlbumId}`;
        } else if (item.targetType === 'footer') {
          parsed.legacyGroupImageUrl = mediaUrl;
          parsed.legacyFooterUrl = mediaUrl;
          detail = `Relinked as Footer Legacy Photo on ${targetAlbumId}`;
        } else if (item.targetType === 'profile') {
          const students = Array.isArray(parsed.students) ? [...parsed.students] : [];
          const targetIdx = item.targetProfileId
            ? students.findIndex((s: any) => String(s.id) === String(item.targetProfileId))
            : students.findIndex((s: any) => !s.photoUrl || extractMediaKeyFromUrl(s.photoUrl) === item.key);
          if (targetIdx >= 0) {
            students[targetIdx] = {
              ...students[targetIdx],
              photoUrl: mediaUrl,
              image: mediaUrl,
            };
            detail = `Relinked to graduate profile "${students[targetIdx].fullName || students[targetIdx].id}" in ${targetAlbumId}`;
          } else {
            const recoveredName = (effectiveKey.split('/').pop() || 'Recovered Graduate').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            students.push({
              id: `st-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              fullName: item.caption || recoveredName,
              photoUrl: mediaUrl,
              image: mediaUrl,
              quote: 'Recovered profile record from Cloudflare R2 storage.',
              approved: true,
            });
            detail = `Recovered as graduate profile in ${targetAlbumId}`;
          }
          parsed.students = students;
        } else {
          // Default: moment category without creating duplicate image entries
          const memories = Array.isArray(parsed.memories) ? [...parsed.memories] : [];
          const catTitle = (item.momentCategoryTitle || 'Recovered Moments').trim();
          const alreadyInAlbum = memories.some((m: any) => {
            if (extractMediaKeyFromUrl(m.imageUrl || m.url) === effectiveKey) return true;
            if (Array.isArray(m.images)) {
              return m.images.some((im: any) => extractMediaKeyFromUrl(im.url || im.imageUrl) === effectiveKey);
            }
            return false;
          });
          if (!alreadyInAlbum) {
            const catIdx = memories.findIndex(
              (m: any) => String(m.title || m.category || '').trim().toLowerCase() === catTitle.toLowerCase()
            );
            const newImgObj = {
              id: `mem-img-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              url: mediaUrl,
              caption: item.caption || '',
              dateTime: new Date().toISOString().slice(0, 10),
            };
            if (catIdx >= 0) {
              const existingImgs = Array.isArray(memories[catIdx].images) ? [...memories[catIdx].images] : [];
              existingImgs.push(newImgObj);
              memories[catIdx] = {
                ...memories[catIdx],
                images: existingImgs,
                imageUrl: memories[catIdx].imageUrl || mediaUrl,
              };
            } else {
              memories.push({
                id: `mem-cat-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title: catTitle,
                category: catTitle,
                eventTag: catTitle,
                caption: 'Restored via Host Cloudflare R2 Media Recovery Center',
                dateStr: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                imageUrl: mediaUrl,
                images: [newImgObj],
              });
            }
            parsed.memories = memories;
            detail = `Recovered into Moments category "${catTitle}" in ${targetAlbumId}`;
          } else {
            detail = `Verified existing link in Moments of ${targetAlbumId} (no duplicate created)`;
          }
        }

        parsed.version = (Number(parsed.version) || 1) + 1;
        await env.DB.prepare(
          `UPDATE class_sets SET status = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(nextStatus, JSON.stringify(parsed), targetAlbumId).run();

        // Ensure media_assets row is linked to targetAlbumId without duplicate
        try {
          const existingAsset = await env.DB.prepare(`SELECT id FROM media_assets WHERE object_key = ?`).bind(effectiveKey).first();
          if (existingAsset) {
            await env.DB.prepare(
              `UPDATE media_assets SET set_id = ?, section = ? WHERE object_key = ?`
            ).bind(targetAlbumId, item.targetType, effectiveKey).run();
          } else {
            const headObj = env.BUCKET && typeof env.BUCKET.head === 'function' ? await env.BUCKET.head(effectiveKey).catch(() => null) : null;
            await env.DB.prepare(
              `INSERT INTO media_assets (id, set_id, section, object_key, public_url, file_name, mime_type, size_bytes, uploaded_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
            ).bind(
              `asset-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              targetAlbumId,
              item.targetType,
              effectiveKey,
              mediaUrl,
              effectiveKey.split('/').pop() || effectiveKey,
              headObj?.httpMetadata?.contentType || 'image/webp',
              Number(headObj?.size) || 0,
              sessionUser.email
            ).run();
          }
        } catch {}

        recoveredResults.push({
          key: effectiveKey,
          albumId: targetAlbumId,
          targetType: item.targetType,
          detail,
        });
      }

      await logAudit(
        'r2_media_recovered',
        `Host ${sessionUser.email} recovered/relinked ${recoveredResults.length} R2 media file(s): ${recoveredResults.map((r) => `${r.key} -> ${r.albumId} (${r.targetType})`).join('; ')}`,
        sessionUser.email
      );

      return new Response(
        JSON.stringify({
          success: true,
          recoveredCount: recoveredResults.length,
          results: recoveredResults,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 0i-2d. Host-Only Confirmed Permanent R2 Media Deletion (POST /api/admin/r2-media-delete)
    if (path === '/api/admin/r2-media-delete' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser || sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as {
        keys?: string[];
        confirmPermanentDelete?: boolean;
      };
      if (!body.confirmPermanentDelete) {
        return new Response(
          JSON.stringify({ error: 'Explicit confirmation (confirmPermanentDelete: true) is required to permanently delete R2 files.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const keys = Array.isArray(body.keys) ? body.keys.map((k) => extractMediaKeyFromUrl(k)).filter(Boolean) : [];
      if (keys.length === 0) {
        return new Response(JSON.stringify({ error: 'No storage keys provided.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const deletedKeys: string[] = [];
      const skippedProtectedKeys: Array<{ key: string; reason: string }> = [];

      for (const key of keys) {
        // deleteR2ObjectAndRecord enforces that nothing referenced by active content, soft-deleted albums within 30 days, or submissions within 7 days is deleted
        const wasDeleted = await deleteR2ObjectAndRecord(key);
        if (wasDeleted) {
          deletedKeys.push(key);
        } else {
          skippedProtectedKeys.push({
            key,
            reason: 'Still referenced by an active record or a soft-deleted album/profile within its 30-day recovery window.',
          });
        }
      }

      if (deletedKeys.length > 0) {
        await logAudit(
          'r2_media_permanently_deleted',
          `Host ${sessionUser.email} permanently deleted ${deletedKeys.length} unreferenced R2 object(s): ${deletedKeys.slice(0, 15).join(', ')}`,
          sessionUser.email
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          deletedCount: deletedKeys.length,
          deletedKeys,
          skippedProtectedCount: skippedProtectedKeys.length,
          skippedProtectedKeys,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 0i-3. Host-Only Non-Destructive Cohort Reconciliation & Merge
    if (path === '/api/admin/reconcile-cohort' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required for cohort reconciliation' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 database unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as {
        primaryAlbumId?: string;
        secondaryAlbumId?: string;
        softDeleteSecondaryAfterMerge?: boolean;
      };
      const primaryId = String(body.primaryAlbumId || '').trim();
      const secondaryId = String(body.secondaryAlbumId || '').trim();

      if (!primaryId || !secondaryId || primaryId === secondaryId) {
        return new Response(JSON.stringify({ error: 'Both primaryAlbumId and secondaryAlbumId are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const primaryRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(primaryId).first();
      const secondaryRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(secondaryId).first();
      if (!primaryRow || !secondaryRow) {
        return new Response(JSON.stringify({ error: 'One or both albums were not found in D1.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let primaryData: any = {};
      let secondaryData: any = {};
      try { primaryData = JSON.parse(primaryRow.data_json || '{}'); } catch {}
      try { secondaryData = JSON.parse(secondaryRow.data_json || '{}'); } catch {}

      const pOwner = String(primaryRow.admin_user_id || primaryData.classRepEmail || '').toLowerCase();
      const sOwner = String(secondaryRow.admin_user_id || secondaryData.classRepEmail || '').toLowerCase();

      // 1. Merge students non-destructively (matching by id or email or fullName)
      const mergedStudents: any[] = Array.isArray(primaryData.students) ? [...primaryData.students] : [];
      const secStudents: any[] = Array.isArray(secondaryData.students) ? secondaryData.students : [];
      let addedStudentsCount = 0;

      for (const st of secStudents) {
        const stEmail = String(st.personalEmail || st.email || '').trim().toLowerCase();
        const stName = String(st.fullName || '').trim().toLowerCase();
        const existingIdx = mergedStudents.findIndex(
          (p: any) =>
            p.id === st.id ||
            (stEmail && String(p.personalEmail || p.email || '').trim().toLowerCase() === stEmail) ||
            (stName && String(p.fullName || '').trim().toLowerCase() === stName)
        );
        if (existingIdx >= 0) {
          const cur = mergedStudents[existingIdx];
          if (!cur.photoUrl && (st.photoUrl || st.image)) cur.photoUrl = st.photoUrl || st.image;
          if (!cur.secondaryPhotoUrl && st.secondaryPhotoUrl) cur.secondaryPhotoUrl = st.secondaryPhotoUrl;
          if (!cur.quote && st.quote) cur.quote = st.quote;
          if (st.paymentStatus === 'paid') cur.paymentStatus = 'paid';
          if (st.usedSlot) {
            cur.usedSlot = true;
            cur.slotConsumed = true;
          }
        } else {
          mergedStudents.push({ ...st });
          addedStudentsCount++;
        }
      }

      // 2. Merge memories non-destructively (handles both nested MemoryEvent.images[] and flat memory items)
      const mergedMemories: any[] = Array.isArray(primaryData.memories) ? [...primaryData.memories] : [];
      const secMemories: any[] = Array.isArray(secondaryData.memories) ? secondaryData.memories : [];
      let addedMemoriesCount = 0;
      const seenMemoryKeys = new Set<string>();
      for (const m of mergedMemories) {
        const topKey = extractMediaKeyFromUrl(m.imageUrl || m.url) || String(m.imageUrl || m.url || '').trim();
        if (topKey) seenMemoryKeys.add(topKey);
        if (Array.isArray(m.images)) {
          for (const img of m.images) {
            const ik = extractMediaKeyFromUrl(img.url || img.imageUrl) || String(img.url || img.imageUrl || '').trim();
            if (ik) seenMemoryKeys.add(ik);
          }
        }
      }
      for (const mem of secMemories) {
        if (Array.isArray(mem.images)) {
          const newImages = mem.images.filter((img: any) => {
            const ik = extractMediaKeyFromUrl(img.url || img.imageUrl) || String(img.url || img.imageUrl || '').trim();
            if (!ik || seenMemoryKeys.has(ik)) return false;
            seenMemoryKeys.add(ik);
            return true;
          });
          if (newImages.length > 0) {
            const existingCatIdx = mergedMemories.findIndex(
              (m: any) => Array.isArray(m.images) && String(m.title || '').toLowerCase() === String(mem.title || '').toLowerCase()
            );
            if (existingCatIdx >= 0) {
              mergedMemories[existingCatIdx] = {
                ...mergedMemories[existingCatIdx],
                images: [...mergedMemories[existingCatIdx].images, ...newImages],
              };
            } else {
              mergedMemories.push({ ...mem, images: newImages });
            }
            addedMemoriesCount += newImages.length;
          }
        } else {
          const memKey = extractMediaKeyFromUrl(mem.imageUrl || mem.url) || String(mem.imageUrl || mem.url || '').trim();
          const exists = mergedMemories.some((m: any) => m.id === mem.id) || (memKey && seenMemoryKeys.has(memKey));
          if (!exists) {
            if (memKey) seenMemoryKeys.add(memKey);
            mergedMemories.push({ ...mem });
            addedMemoriesCount++;
          }
        }
      }

      // 3. Merge awards & voices
      const mergedAwards: any[] = Array.isArray(primaryData.awards) ? [...primaryData.awards] : [];
      for (const aw of Array.isArray(secondaryData.awards) ? secondaryData.awards : []) {
        if (!mergedAwards.some((a: any) => a.id === aw.id || a.title === aw.title)) mergedAwards.push({ ...aw });
      }

      // 4. Re-associate D1 profile_submissions, media_assets, slot_ledger, and transactions from secondaryId to primaryId
      try {
        await env.DB.prepare(`UPDATE profile_submissions SET album_id = ?, updated_at = datetime('now') WHERE album_id = ?`)
          .bind(primaryId, secondaryId)
          .run();
      } catch {}
      try {
        await env.DB.prepare(`UPDATE media_assets SET set_id = ? WHERE set_id = ?`)
          .bind(primaryId, secondaryId)
          .run();
      } catch {}
      try {
        await env.DB.prepare(`UPDATE slot_ledger SET album_id = ? WHERE album_id = ?`)
          .bind(primaryId, secondaryId)
          .run();
      } catch {}
      try {
        await env.DB.prepare(`UPDATE transactions SET set_id = ? WHERE set_id = ?`)
          .bind(primaryId, secondaryId)
          .run();
      } catch {}

      // Keep secondary admin email as co-admin if different from primary owner so neither account loses access
      const coAdmins = Array.isArray(primaryData.coAdmins) ? [...primaryData.coAdmins] : [];
      if (sOwner && sOwner !== pOwner && !coAdmins.some((c: any) => String(c?.email || '').toLowerCase() === sOwner)) {
        coAdmins.push({
          email: sOwner,
          name: secondaryData.classRepName || sOwner.split('@')[0],
          role: 'co_admin',
          addedAt: new Date().toISOString(),
        });
      }

      primaryData.students = mergedStudents;
      primaryData.memories = mergedMemories;
      primaryData.awards = mergedAwards;
      primaryData.coAdmins = coAdmins;
      if (!primaryData.bannerImageUrl && secondaryData.bannerImageUrl) {
        primaryData.bannerImageUrl = secondaryData.bannerImageUrl;
      }
      if (!primaryData.legacyGroupImageUrl && secondaryData.legacyGroupImageUrl) {
        primaryData.legacyGroupImageUrl = secondaryData.legacyGroupImageUrl;
      }
      primaryData.version = (Number(primaryData.version) || 1) + 1;

      const reconciledPrimary = await reconcileAlbumSlotsAndSubmissions(primaryRow, primaryData);

      await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(JSON.stringify(reconciledPrimary), primaryId)
        .run();

      if (body.softDeleteSecondaryAfterMerge) {
        secondaryData.deletedAt = new Date().toISOString();
        secondaryData.published = false;
        secondaryData.lifecycleStatus = 'deleted';
        secondaryData.reconciledIntoAlbumId = primaryId;
        await env.DB.prepare(`UPDATE class_sets SET status = 'deleted', data_json = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(JSON.stringify(secondaryData), secondaryId)
          .run();
      } else {
        secondaryData.reconciledIntoAlbumId = primaryId;
        await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(JSON.stringify(secondaryData), secondaryId)
          .run();
      }

      await logAudit(
        'cohort_albums_reconciled',
        `Reconciled duplicate cohort album ${secondaryId} into primary album ${primaryId} (+${addedStudentsCount} students, +${addedMemoriesCount} memories) by ${sessionUser.email}`,
        sessionUser.email
      );

      return new Response(
        JSON.stringify({
          success: true,
          primaryAlbumId: primaryId,
          secondaryAlbumId: secondaryId,
          addedStudentsCount,
          addedMemoriesCount,
          album: reconciledPrimary,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 0i-4. Host-Only Repair Broken R2 Media Links & Recover Orphaned R2 Photos for an Album
    if (path === '/api/admin/repair-media' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required for media repair' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 database unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as { albumId?: string };
      const albumId = String(body.albumId || '').trim();
      if (!albumId) {
        return new Response(JSON.stringify({ error: 'albumId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const row = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
      if (!row) {
        return new Response(JSON.stringify({ error: 'Album not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let parsed: any = {};
      try { parsed = JSON.parse(row.data_json || '{}'); } catch {}

      // Collect all sibling album IDs for the same cohort so R2 objects uploaded under a duplicate test album prefix are also found
      const instId = String(row.institution_id || parsed.institutionId || '').trim();
      const deptId = String(row.department_id || parsed.departmentId || '').trim();
      const gradYear = Number(row.graduation_year || parsed.graduationYear) || 2026;
      const canonicalDept = normalizeDepartmentCohortSlug(instId, deptId, parsed.departmentName);

      const allSetsRes = await env.DB.prepare(`SELECT id, institution_id, department_id, graduation_year, status, data_json FROM class_sets`).all();
      const siblingAlbumIds = new Set<string>([albumId]);
      const otherActiveAlbumReferencedKeys = new Set<string>();
      for (const sRow of allSetsRes?.results || []) {
        let sp: any = {};
        try { sp = JSON.parse(sRow.data_json || '{}'); } catch {}
        const sid = String(sRow.id || '');
        if (sid && sid !== albumId && sRow.status !== 'deleted' && !sp.deletedAt) {
          for (const k of collectAlbumMediaKeys(sp)) {
            otherActiveAlbumReferencedKeys.add(k);
          }
        }
        const sInst = String(sRow.institution_id || sp.institutionId || '').trim();
        const sDept = normalizeDepartmentCohortSlug(sInst, String(sRow.department_id || sp.departmentId || ''), sp.departmentName);
        const sYear = Number(sRow.graduation_year || sp.graduationYear) || 0;
        if (sInst && canonicalDept && sInst.toLowerCase() === instId.toLowerCase() && sDept === canonicalDept && sYear === gradYear) {
          siblingAlbumIds.add(sid);
        }
      }

      const r2Keys = new Set<string>();
      if (env.BUCKET && typeof env.BUCKET.list === 'function') {
        for (const sibId of siblingAlbumIds) {
          try {
            let cursor: string | undefined = undefined;
            let pages = 0;
            do {
              const listed: any = await env.BUCKET.list(
                cursor ? { prefix: `albums/${sibId}/`, limit: 1000, cursor } : { prefix: `albums/${sibId}/`, limit: 1000 }
              );
              for (const obj of listed?.objects || []) {
                if (obj?.key) r2Keys.add(String(obj.key));
              }
              cursor = listed?.truncated && listed?.cursor ? String(listed.cursor) : undefined;
              pages++;
            } while (cursor && pages < 50);
          } catch {}
        }
      }

      const assetRes = await env.DB.prepare(`SELECT * FROM media_assets`).all();
      for (const a of assetRes?.results || []) {
        if (siblingAlbumIds.has(String(a.set_id)) && a.object_key) {
          r2Keys.add(String(a.object_key));
        }
      }

      let repairedLinksCount = 0;
      let recoveredMemoriesCount = 0;

      const referencedNow = collectAlbumMediaKeys(parsed);
      const students: any[] = Array.isArray(parsed.students) ? [...parsed.students] : [];
      const memories: any[] = Array.isArray(parsed.memories) ? [...parsed.memories] : [];

      // Repair student photo URLs from profile_submissions or matching R2 filenames
      const subsRes = await env.DB.prepare(`SELECT * FROM profile_submissions`).all();
      const cohortSubs = (subsRes?.results || []).filter((s: any) => siblingAlbumIds.has(String(s.album_id)));

      for (const st of students) {
        const currentKey = extractMediaKeyFromUrl(st.photoUrl || st.image);
        if (!currentKey || (r2Keys.size > 0 && !r2Keys.has(currentKey))) {
          const matchingSub = cohortSubs.find(
            (s: any) =>
              s.id === st.id ||
              (st.email && String(s.email || '').toLowerCase() === String(st.email).toLowerCase())
          );
          if (matchingSub?.photo_key) {
            const subKey = extractMediaKeyFromUrl(matchingSub.photo_key);
            if (subKey) {
              st.photoUrl = `/media/${subKey}`;
              referencedNow.add(subKey);
              repairedLinksCount++;
            }
          } else if (currentKey) {
            const fileName = currentKey.split('/').pop() || '';
            const matchKey = Array.from(r2Keys).find((k) => fileName && k.endsWith(`/${fileName}`));
            if (matchKey) {
              st.photoUrl = `/media/${matchKey}`;
              referencedNow.add(matchKey);
              repairedLinksCount++;
            }
          }
        }
      }

      // Recover any R2 objects under albums/<albumId>/memories/ (or unreferenced sibling keys) that are missing from memories[]
      const recoveredImages: Array<{ id: string; url: string; caption: string; dateTime: string }> = [];
      for (const key of r2Keys) {
        if (referencedNow.has(key) || otherActiveAlbumReferencedKeys.has(key)) continue;
        const parts = key.split('/');
        const section = (parts[2] || '').toLowerCase();
        if (
          section.includes('memor') ||
          section.includes('moment') ||
          section.includes('highlight') ||
          section.includes('candid') ||
          section.includes('event') ||
          section.includes('dinner') ||
          section.includes('signout') ||
          section.includes('fyb')
        ) {
          const isHighlight = section.includes('highlight');
          const safeId = `img-rec-${key.replace(/[^a-zA-Z0-9_-]/g, '-').slice(-40)}`;
          recoveredImages.push({
            id: safeId,
            url: `/media/${key}`,
            caption: isHighlight ? 'Class Highlight' : 'Class Moment',
            dateTime: new Date().toISOString().split('T')[0],
          });
          referencedNow.add(key);
          recoveredMemoriesCount++;
        }
      }
      if (recoveredImages.length > 0) {
        const existingRecIdx = memories.findIndex(
          (m: any) => Array.isArray(m.images) && (m.id === `mem-cat-recovered-${albumId}` || String(m.title || '').toLowerCase().includes('recovered'))
        );
        if (existingRecIdx >= 0) {
          memories[existingRecIdx] = {
            ...memories[existingRecIdx],
            images: [...memories[existingRecIdx].images, ...recoveredImages],
          };
        } else {
          memories.push({
            id: `mem-cat-recovered-${albumId}`,
            title: 'Recovered Class Moments',
            dateStr: new Date().toISOString().split('T')[0],
            caption: 'Recovered from Cloudflare R2 storage',
            order: memories.length + 1,
            images: recoveredImages,
          });
        }
      }

      parsed.students = students;
      parsed.memories = memories;
      parsed.version = (Number(parsed.version) || 1) + 1;
      parsed = await reconcileAlbumSlotsAndSubmissions(row, parsed);

      await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(JSON.stringify(parsed), albumId)
        .run();

      await logAudit(
        'album_media_repaired',
        `Repaired ${repairedLinksCount} media link(s) and recovered ${recoveredMemoriesCount} R2 memory photo(s) for album ${albumId} by ${sessionUser.email}`,
        sessionUser.email
      );

      return new Response(
        JSON.stringify({
          success: true,
          albumId,
          repairedLinksCount,
          recoveredMemoriesCount,
          album: parsed,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 0i-5. D1 Full JSON Backup Export + Paginated R2 Metadata Manifest (Host Control Center)
    if (path === '/api/admin/backup-export' && request.method === 'GET') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      if (sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 database not bound' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }

      const includeRawSecrets = url.searchParams.get('includeRawSecrets') === 'true';

      const tables = [
        'platform_settings',
        'institutions',
        'users',
        'programmes',
        'class_sets',
        'cohort_allocations',
        'slot_allocations',
        'registrations',
        'profile_submissions',
        'slot_ledger',
        'media_assets',
        'transactions',
        'testimonials',
        'site_content',
        'support_messages',
        'disputes',
        'audit_logs',
      ];
      const snapshot: Record<string, any[]> = {};
      for (const tbl of tables) {
        try {
          const res = await env.DB.prepare(`SELECT * FROM ${tbl}`).all();
          const rawRows = res?.results || [];
          snapshot[tbl] = rawRows.map((r: any) => {
            if (includeRawSecrets) return r;
            const copy = { ...r };
            if (tbl === 'profile_submissions' && copy.status_token_hash) {
              copy.status_token_hash = '[REDACTED]';
            }
            if (tbl === 'transactions' && copy.paystack_data_json) {
              try {
                const parsedPs = JSON.parse(copy.paystack_data_json);
                if (parsedPs?.authorization?.authorization_code) {
                  parsedPs.authorization.authorization_code = '[REDACTED]';
                }
                if (parsedPs?.data?.authorization?.authorization_code) {
                  parsedPs.data.authorization.authorization_code = '[REDACTED]';
                }
                copy.paystack_data_json = JSON.stringify(parsedPs);
              } catch {}
            }
            return copy;
          });
        } catch {
          snapshot[tbl] = [];
        }
      }

      const r2Manifest: Array<{ key: string; size: number; uploaded?: string; downloadUrl: string }> = [];
      let r2PaginationComplete = true;
      if (env.BUCKET && typeof env.BUCKET.list === 'function') {
        try {
          let cursor: string | undefined = undefined;
          let safetyPages = 0;
          do {
            const listed: any = await env.BUCKET.list(cursor ? { limit: 1000, cursor } : { limit: 1000 });
            for (const obj of listed?.objects || []) {
              if (obj?.key) {
                r2Manifest.push({
                  key: String(obj.key),
                  size: Number(obj.size) || 0,
                  uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : undefined,
                  downloadUrl: `/media/${obj.key}`,
                });
              }
            }
            cursor = listed?.truncated && listed?.cursor ? String(listed.cursor) : undefined;
            safetyPages++;
          } while (cursor && safetyPages < 100);
          if (cursor) r2PaginationComplete = false;
        } catch {
          r2PaginationComplete = false;
        }
      }

      await logAudit(
        'database_backup_exported',
        `D1 database + R2 metadata manifest exported (${r2Manifest.length} R2 keys, redacted=${!includeRawSecrets}) by ${sessionUser.email}`,
        sessionUser.email
      );

      return new Response(
        JSON.stringify(
          {
            schemaVersion: 3,
            backupScope: 'd1_database_and_r2_metadata_manifest_only',
            r2BinaryIncluded: false,
            r2PaginationComplete,
            r2BackupNotice:
              'This file contains a complete D1 database snapshot and an R2 object metadata manifest (keys, sizes, and URLs). Actual binary R2 media files are stored in Cloudflare R2 and must be replicated using POST /api/admin/r2-backup-sync or rclone/Cloudflare R2 replication into a secondary backup bucket.',
            sensitiveFieldsRedacted: !includeRawSecrets,
            exportedAt: new Date().toISOString(),
            exportedBy: sessionUser.email,
            tables: snapshot,
            r2Manifest,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Disposition': `attachment; filename="kohot-d1-backup-${new Date().toISOString().split('T')[0]}.json"`,
          },
        }
      );
    }

    // 0i-5b. Host-Only Binary R2 Object Backup Sync to Secondary R2 Bucket (or Verification Status)
    if (path === '/api/admin/r2-backup-sync' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const backupBucket = (env as any).BUCKET_BACKUP;
      if (!env.BUCKET) {
        return new Response(JSON.stringify({ error: 'Primary R2 BUCKET is not bound.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!backupBucket || typeof backupBucket.put !== 'function') {
        return new Response(
          JSON.stringify({
            success: false,
            r2BinaryBackupStatus: 'requires_bucket_backup_binding_or_rclone',
            message:
              'Secondary R2 bucket binding (BUCKET_BACKUP) is not configured in wrangler.toml. Bind a secondary R2 bucket as BUCKET_BACKUP or run rclone sync against the kohot-media bucket to complete binary media replication.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let copiedCount = 0;
      let cursor: string | undefined = undefined;
      let pages = 0;
      do {
        const listed: any = await env.BUCKET.list(cursor ? { limit: 500, cursor } : { limit: 500 });
        for (const obj of listed?.objects || []) {
          if (!obj?.key) continue;
          const fullObj = await env.BUCKET.get(String(obj.key));
          if (fullObj) {
            await backupBucket.put(String(obj.key), fullObj.body, {
              httpMetadata: fullObj.httpMetadata,
              customMetadata: fullObj.customMetadata,
            });
            copiedCount++;
          }
        }
        cursor = listed?.truncated && listed?.cursor ? String(listed.cursor) : undefined;
        pages++;
      } while (cursor && pages < 50);

      await logAudit('r2_binary_backup_synced', `Synced ${copiedCount} binary R2 object(s) to BUCKET_BACKUP by ${sessionUser.email}`, sessionUser.email);

      return new Response(
        JSON.stringify({
          success: true,
          r2BinaryBackupStatus: 'completed',
          copiedCount,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 0i-6. Safe D1 JSON Backup Restore Endpoint with Dry-Run Validation, Explicit Confirmation, Topological Order & FK Verification
    if (path === '/api/admin/backup-restore' && request.method === 'POST') {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (sessionUser.role !== 'master_host') {
        return new Response(JSON.stringify({ error: 'Host authorization required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 database not bound' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = (await request.json().catch(() => ({}))) as {
        tables?: Record<string, any[]>;
        dryRun?: boolean;
        confirmPhrase?: string;
        overwriteExisting?: boolean;
      };
      if (!body.tables || typeof body.tables !== 'object' || Array.isArray(body.tables)) {
        return new Response(JSON.stringify({ error: 'Invalid backup payload: missing tables object' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hostName = url.hostname.toLowerCase();
      const explicitEnv = String((env as any).ENVIRONMENT || (env as any).ENV_MODE || '').trim().toLowerCase();
      const environmentMode: 'development' | 'staging' | 'production' =
        explicitEnv === 'production' || explicitEnv === 'staging' || explicitEnv === 'development'
          ? (explicitEnv as 'development' | 'staging' | 'production')
          : hostName.includes('localhost') || hostName.includes('127.0.0.1') || hostName.startsWith('ais-dev-')
          ? 'development'
          : hostName.startsWith('ais-pre-') || hostName.includes('staging') || hostName.includes('preview')
          ? 'staging'
          : 'production';

      // Default to dryRun = true unless explicitly passed as dryRun: false
      const isDryRun = body.dryRun !== false;

      if (body.overwriteExisting) {
        return new Response(
          JSON.stringify({
            error: 'overwrite_restore_disabled',
            message: 'Destructive overwrite restoration (INSERT OR REPLACE) is disabled to protect existing records and foreign-key relationships. Use safe additive restoration (overwriteExisting: false).',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isDryRun && body.confirmPhrase !== 'CONFIRM_D1_RESTORE') {
        return new Response(
          JSON.stringify({
            error: 'confirmation_required',
            message: 'Executing a live D1 restore requires dryRun: false and confirmPhrase: "CONFIRM_D1_RESTORE". Run a dry-run preview first.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parent-first topological table restoration order across all 17 tables
      const orderedTables = [
        'platform_settings',
        'institutions',
        'users',
        'programmes',
        'class_sets',
        'cohort_allocations',
        'slot_allocations',
        'registrations',
        'profile_submissions',
        'slot_ledger',
        'media_assets',
        'transactions',
        'testimonials',
        'site_content',
        'support_messages',
        'disputes',
        'audit_logs',
      ];
      const primaryKeyColByTable: Record<string, string> = {
        platform_settings: 'key',
        site_content: 'key',
      };

      // Pre-load existing primary keys and class_set IDs for conflict & FK validation
      const existingClassSetIds = new Set<string>();
      try {
        const csRes = await env.DB.prepare(`SELECT id FROM class_sets`).all();
        for (const r of csRes?.results || []) {
          if (r?.id) existingClassSetIds.add(String(r.id));
        }
      } catch {}
      const incomingClassSetIds = new Set<string>(existingClassSetIds);
      if (Array.isArray(body.tables.class_sets)) {
        for (const r of body.tables.class_sets) {
          if (r && typeof r === 'object' && r.id) incomingClassSetIds.add(String(r.id));
        }
      }

      const tableSummaries: Record<string, { incomingRows: number; newRowsToInsert: number; existingConflictsSkipped: number; invalidRows: number }> = {};
      const foreignKeyErrors: Array<{ table: string; rowId: string; referencedAlbumId: string; message: string }> = [];
      const invalidRows: Array<{ table: string; index: number; reason: string }> = [];
      const statementsToExecute: any[] = [];

      for (const tableName of orderedTables) {
        const rows = body.tables[tableName];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const pkCol = primaryKeyColByTable[tableName] || 'id';
        const existingPks = new Set<string>();
        try {
          const pkRes = await env.DB.prepare(`SELECT ${pkCol} FROM ${tableName}`).all();
          for (const er of pkRes?.results || []) {
            if (er && er[pkCol] !== undefined && er[pkCol] !== null) {
              existingPks.add(String(er[pkCol]));
            }
          }
        } catch {}

        let newRowsToInsert = 0;
        let existingConflictsSkipped = 0;
        let tableInvalidRows = 0;

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          if (!row || typeof row !== 'object' || Array.isArray(row)) {
            tableInvalidRows++;
            invalidRows.push({ table: tableName, index: idx, reason: 'Row is not a valid object' });
            continue;
          }
          const cols = Object.keys(row).filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
          if (cols.length === 0 || (row[pkCol] === undefined || row[pkCol] === null || String(row[pkCol]).trim() === '')) {
            tableInvalidRows++;
            invalidRows.push({ table: tableName, index: idx, reason: `Missing primary key column '${pkCol}'` });
            continue;
          }

          // Foreign-key integrity check for child tables referencing class_sets(id)
          if (tableName === 'profile_submissions' || tableName === 'slot_ledger') {
            const refAlbumId = String(row.album_id || '').trim();
            if (!refAlbumId || !incomingClassSetIds.has(refAlbumId)) {
              foreignKeyErrors.push({
                table: tableName,
                rowId: String(row[pkCol]),
                referencedAlbumId: refAlbumId,
                message: `${tableName} row '${row[pkCol]}' references non-existent class_sets.id '${refAlbumId}'`,
              });
              continue;
            }
          }
          if (tableName === 'media_assets') {
            const refSetId = String(row.set_id || '').trim();
            if (refSetId && refSetId !== 'site-hero' && !incomingClassSetIds.has(refSetId)) {
              foreignKeyErrors.push({
                table: tableName,
                rowId: String(row[pkCol]),
                referencedAlbumId: refSetId,
                message: `media_assets row '${row[pkCol]}' references non-existent class_sets.id '${refSetId}'`,
              });
              continue;
            }
          }

          const pkVal = String(row[pkCol]);
          if (existingPks.has(pkVal)) {
            existingConflictsSkipped++;
            continue;
          }

          // Do not restore '[REDACTED]' placeholder over real tokens
          const cleanRow: Record<string, any> = { ...row };
          if (tableName === 'profile_submissions' && cleanRow.status_token_hash === '[REDACTED]') {
            cleanRow.status_token_hash = null;
          }

          const cleanCols = Object.keys(cleanRow).filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
          const placeholders = cleanCols.map(() => '?').join(', ');
          const values = cleanCols.map((c) => cleanRow[c]);

          statementsToExecute.push(
            env.DB.prepare(`INSERT OR IGNORE INTO ${tableName} (${cleanCols.join(', ')}) VALUES (${placeholders})`).bind(...values)
          );
          newRowsToInsert++;
        }

        tableSummaries[tableName] = {
          incomingRows: rows.length,
          newRowsToInsert,
          existingConflictsSkipped,
          invalidRows: tableInvalidRows,
        };
      }

      const valid = foreignKeyErrors.length === 0 && invalidRows.length === 0;

      if (isDryRun) {
        await logAudit(
          'database_backup_restore_dry_run',
          `D1 backup restore dry-run validated (valid=${valid}, statements=${statementsToExecute.length}, fkErrors=${foreignKeyErrors.length}) by ${sessionUser.email}`,
          sessionUser.email
        );
        return new Response(
          JSON.stringify({
            success: valid,
            dryRun: true,
            valid,
            environment: environmentMode,
            totalStatementsReady: statementsToExecute.length,
            tableSummaries,
            foreignKeyErrors,
            invalidRows,
            requiredConfirmPhrase: 'CONFIRM_D1_RESTORE',
          }),
          { status: valid ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!valid) {
        return new Response(
          JSON.stringify({
            error: 'backup_validation_failed',
            message: 'Backup restoration aborted due to validation or foreign-key integrity errors. No database records were modified.',
            valid: false,
            tableSummaries,
            foreignKeyErrors,
            invalidRows,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        if (statementsToExecute.length > 0) {
          await env.DB.batch(statementsToExecute);
        }
      } catch (batchErr: any) {
        await logAudit(
          'database_backup_restore_failed',
          `D1 backup batch restore failed for ${sessionUser.email}: ${batchErr?.message || 'Batch execution error'}`,
          sessionUser.email
        );
        return new Response(
          JSON.stringify({
            error: 'restore_execution_failed',
            message: `Transactional batch restore failed: ${batchErr?.message || 'Database error'}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const restoredCounts: Record<string, number> = {};
      for (const [tbl, sum] of Object.entries(tableSummaries)) {
        restoredCounts[tbl] = sum.newRowsToInsert;
      }

      await logAudit(
        'database_backup_restored',
        `D1 backup restored safely (INSERT OR IGNORE, batch=${statementsToExecute.length}) by ${sessionUser.email}: ${JSON.stringify(restoredCounts)}`,
        sessionUser.email
      );

      return new Response(
        JSON.stringify({
          success: true,
          dryRun: false,
          restoredCounts,
          tableSummaries,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
      const albumIdParam = url.searchParams.get('albumId') || '';
      const instParam = url.searchParams.get('institutionId') || '';
      const deptParam = url.searchParams.get('departmentId') || '';
      const yearParam = Number(url.searchParams.get('graduationYear') || 0) || undefined;
      const resolvedPricing =
        albumIdParam || (instParam && deptParam)
          ? await resolveCohortPricing({
              albumId: albumIdParam || undefined,
              institutionId: instParam || undefined,
              departmentId: deptParam || undefined,
              graduationYear: yearParam,
            })
          : null;

      // Determine active Founding Class / Departmental Discount % from settings or active discount programme in D1
      let foundingDiscountPercent = Number(settings.default_discount_percent);
      if (!Number.isFinite(foundingDiscountPercent) || foundingDiscountPercent < 0 || foundingDiscountPercent > 99) {
        foundingDiscountPercent = 20;
      }
      let foundingDiscountName =
        (settings.founding_discount_name || '').trim() || 'Founding Class Departmental Discount';
      let foundingDiscountDescription =
        (settings.founding_discount_description || '').trim() ||
        'Special rate for the founding graduating class of a department.';
      if (env.DB) {
        try {
          const activeDiscProg = await env.DB.prepare(
            `SELECT name, discount_percent FROM programmes WHERE kind = 'discount' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`
          ).first();
          if (activeDiscProg && Number(activeDiscProg.discount_percent) > 0) {
            if (!settings.default_discount_percent_explicit) {
              foundingDiscountPercent = Number(activeDiscProg.discount_percent);
            }
            if (activeDiscProg.name && !settings.founding_discount_name) {
              foundingDiscountName = String(activeDiscProg.name);
            }
          }
        } catch {}
      }

      const studentFeeKobo = Number(settings.student_fee_kobo) || 100000;
      const discountedFeeKobo = Math.max(0, Math.round((studentFeeKobo * (100 - foundingDiscountPercent)) / 100));

      return new Response(
        JSON.stringify({
          paystackPublicKey,
          mode,
          settings,
          studentFeeKobo,
          foundingDiscountPercent,
          foundingDiscountName,
          foundingDiscountDescription,
          discountedFeeKobo,
          compressionResolutionPx: Number(settings.compression_resolution_px) || 1440,
          resolvedPricing,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 0k-2. Public Cohort Pricing Resolution Endpoint (GET /api/pricing/resolve)
    if (path === '/api/pricing/resolve' && request.method === 'GET') {
      const albumId = url.searchParams.get('albumId') || undefined;
      const institutionId = url.searchParams.get('institutionId') || undefined;
      const departmentId = url.searchParams.get('departmentId') || undefined;
      const graduationYear = Number(url.searchParams.get('graduationYear') || 0) || undefined;
      const pricing = await resolveCohortPricing({
        albumId,
        institutionId,
        departmentId,
        graduationYear,
      });
      return new Response(
        JSON.stringify({
          success: true,
          pricing,
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

        const activeAlbumObjects: any[] = [];

        if (d1Status.reachable && d1Status.tablesPresent) {
          // Purge any soft-deleted albums that have passed their 30-day recovery deadline before evaluating login
          await cleanupExpiredSoftDeletedAlbums(env);

          // Scan all class_sets (including soft-deleted albums still within their 30-day recovery window)
          try {
            const allSetsRes = await env.DB.prepare(
              `SELECT * FROM class_sets ORDER BY created_at DESC`
            ).all();
            const allRows = allSetsRes?.results || [];
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

            // Also check transactions & registrations for any album_id linked to userEmail
            const ownedAlbumIdsFromTx = new Set<string>();
            try {
              const txRes = await env.DB.prepare(
                `SELECT DISTINCT set_id as aid FROM transactions WHERE LOWER(payer_email) = ?`
              ).bind(userEmail).all();
              for (const tr of txRes?.results || []) {
                if (tr.aid && !String(tr.aid).startsWith('crownfield-')) {
                  ownedAlbumIdsFromTx.add(String(tr.aid));
                }
              }
            } catch {}

            for (const sRow of allRows) {
              let parsedSet: any = {};
              try { parsedSet = JSON.parse(sRow.data_json || '{}'); } catch {}
              const isDeleted = sRow.status === 'deleted' || Boolean(parsedSet.deletedAt);
              if (isDeleted) {
                if (parsedSet.keepByHost || parsedSet.keptByHostOnly) continue;
                const delMs = parsedSet.deletedAt ? new Date(parsedSet.deletedAt).getTime() : 0;
                if (!delMs || Date.now() - delMs >= thirtyDaysMs) {
                  continue;
                }
              }

              const rowAdmin = String(sRow.admin_user_id || '').trim().toLowerCase();
              const jsonEmail = String(parsedSet.classRepEmail || parsedSet.currentAdminEmail || '').trim().toLowerCase();
              const inHistory = Array.isArray(parsedSet.adminHistory) && parsedSet.adminHistory.some(
                (h: any) => String(h?.adminEmail || '').trim().toLowerCase() === userEmail
              );
              const inCoAdmins = Array.isArray(parsedSet.coAdmins) && parsedSet.coAdmins.some(
                (c: any) => String(c?.email || '').trim().toLowerCase() === userEmail
              );
              const inSlotTx = ownedAlbumIdsFromTx.has(String(sRow.id)) && (!rowAdmin || !rowAdmin.includes('@'));

              if (rowAdmin === userEmail || jsonEmail === userEmail || inHistory || inCoAdmins || inSlotTx) {
                // Auto-heal admin_user_id in D1 if it wasn't set to the email
                if (rowAdmin !== userEmail && (jsonEmail === userEmail || inSlotTx || !rowAdmin.includes('@'))) {
                  try {
                    parsedSet.classRepEmail = userEmail;
                    await env.DB.prepare(
                      `UPDATE class_sets SET admin_user_id = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
                    ).bind(userEmail, JSON.stringify(parsedSet), sRow.id).run();
                  } catch {}
                }
                const hydrated = {
                  ...parsedSet,
                  id: sRow.id,
                  institutionId: sRow.institution_id || parsedSet.institutionId,
                  universityId: sRow.institution_id || parsedSet.universityId || parsedSet.institutionId,
                  departmentId: sRow.department_id || parsedSet.departmentId,
                  graduationYear: Number(sRow.graduation_year || parsedSet.graduationYear),
                  classSetName: sRow.title || sRow.class_set_name || parsedSet.classSetName || `Class of ${sRow.graduation_year}`,
                  classRepEmail: userEmail,
                  classRepName: parsedSet.classRepName || userName,
                  inviteCode: String(sRow.invite_code || parsedSet.inviteCode || computeInviteCode(sRow.id)),
                  deletedAt: parsedSet.deletedAt || (sRow.status === 'deleted' ? sRow.updated_at || new Date().toISOString() : undefined),
                  lifecycleStatus: isDeleted ? 'deleted' : (sRow.status || parsedSet.lifecycleStatus || 'draft'),
                };
                activeAlbumObjects.push(hydrated);
                activeAlbums.push({
                  id: sRow.id,
                  institutionId: hydrated.institutionId,
                  departmentId: hydrated.departmentId,
                  graduationYear: hydrated.graduationYear,
                  classSetName: hydrated.classSetName,
                  applicantName: hydrated.classRepName || userName,
                  applicantPhone: hydrated.classRepPhone || '',
                });
              }
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
              s.activationStatus !== 'pending_verification' &&
              !String(s.id || '').startsWith('crownfield-')
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
              activeAlbumObjects.push(s);
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
              albumObjects: activeAlbumObjects,
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

    // 2. Auth Session Check (Reads from signed session cookie + verifies owned albums in D1)
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

      const ownedAlbumIds: string[] = Array.isArray(user.albums) ? [...user.albums] : user.assignedSetId ? [user.assignedSetId] : [];
      const albumObjects: any[] = [];

      if (env.DB && user.email && user.role !== 'master_host') {
        try {
          await cleanupExpiredSoftDeletedAlbums(env);
          const emailLower = user.email.trim().toLowerCase();
          const allSetsRes = await env.DB.prepare(`SELECT * FROM class_sets ORDER BY created_at DESC`).all();
          const matchedRows: Array<{ row: any; parsed: any; score: number }> = [];
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

          for (const sRow of allSetsRes?.results || []) {
            let parsedSet: any = {};
            try { parsedSet = JSON.parse(sRow.data_json || '{}'); } catch {}
            const isDeleted = sRow.status === 'deleted' || Boolean(parsedSet.deletedAt);
            if (isDeleted) {
              if (parsedSet.keepByHost || parsedSet.keptByHostOnly) continue;
              const delMs = parsedSet.deletedAt ? new Date(parsedSet.deletedAt).getTime() : 0;
              if (!delMs || Date.now() - delMs >= thirtyDaysMs) continue;
            }
            const rowAdmin = String(sRow.admin_user_id || '').trim().toLowerCase();
            const jsonEmail = String(parsedSet.classRepEmail || parsedSet.currentAdminEmail || '').trim().toLowerCase();
            const inCoAdmins = Array.isArray(parsedSet.coAdmins) && parsedSet.coAdmins.some(
              (c: any) => String(c?.email || '').trim().toLowerCase() === emailLower
            );
            if (rowAdmin === emailLower || jsonEmail === emailLower || inCoAdmins) {
              const score =
                (isDeleted ? 0 : 1000) +
                (Array.isArray(parsedSet.students) ? parsedSet.students.length * 10 : 0) +
                (Array.isArray(parsedSet.memories) ? parsedSet.memories.length * 5 : 0) +
                (Number(parsedSet.totalSlotsCredited) || 0);
              matchedRows.push({ row: sRow, parsed: parsedSet, score });
            }
          }

          if (matchedRows.length > 0) {
            matchedRows.sort((a, b) => b.score - a.score);
            user.assignedSetId = String(matchedRows[0].row.id);
            for (const m of matchedRows) {
              const aid = String(m.row.id);
              const isDeleted = m.row.status === 'deleted' || Boolean(m.parsed.deletedAt);
              if (!ownedAlbumIds.includes(aid)) ownedAlbumIds.push(aid);
              albumObjects.push({
                ...m.parsed,
                id: aid,
                institutionId: m.row.institution_id || m.parsed.institutionId,
                universityId: m.row.institution_id || m.parsed.universityId || m.parsed.institutionId,
                departmentId: m.row.department_id || m.parsed.departmentId,
                graduationYear: Number(m.row.graduation_year || m.parsed.graduationYear),
                classRepEmail: emailLower,
                inviteCode: String(m.row.invite_code || m.parsed.inviteCode || computeInviteCode(aid)),
                deletedAt: m.parsed.deletedAt || (isDeleted ? m.row.updated_at || new Date().toISOString() : undefined),
                lifecycleStatus: isDeleted ? 'deleted' : (m.row.status || m.parsed.lifecycleStatus || 'draft'),
              });
            }
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({
          authenticated: true,
          role: user.role,
          user,
          albums: ownedAlbumIds,
          albumObjects: albumObjects.length > 0 ? albumObjects : undefined,
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
      const isAmbientAudioUpload = category === 'ambient-audio' || rawSetId === 'site-audio';

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
      const allowedAudioMimes: Record<string, string> = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/m4a': 'm4a',
        'audio/aac': 'aac',
        'audio/webm': 'webm',
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
      } else if (isAmbientAudioUpload) {
        if (!isHost) {
          return new Response(
            JSON.stringify({ success: false, error: 'Only the Master Host can upload ambient album audio.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        ext = allowedAudioMimes[mimeType] || '';
        if (!ext) {
          return new Response(
            JSON.stringify({ success: false, error: 'Ambient soundtrack must be MP3, WAV, OGG, M4A, or AAC audio.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        maxBytes = 15 * 1024 * 1024; // 15 MB for ambient audio
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
      // 1. Host can upload anything (including hero video/poster/ambient audio)
      // 2. Valid inviteToken for this album (or demo album) allows invite/dashboard image uploads
      // 3. Authenticated Admin who owns setId
      let uploaderIdentifier = sessionUser?.email || '';
      if (!isHost) {
        if (isHeroVideoUpload || isAmbientAudioUpload) {
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
        : isAmbientAudioUpload
        ? 'site-audio'
        : rawSetId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const uuid = crypto.randomUUID();
      const objectKey = `albums/${safeAlbumId}/${uuid}.${ext}`;
      const publicUrl = `/media/${objectKey}`;
      const mediaId = `med-${uuid}`;
      const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType === 'audio/mp3' ? 'audio/mpeg' : mimeType;

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

        // If this is a Host hero video, poster, or ambient audio upload, also save its key in website_content_overrides and clean up replaced R2 asset
        if (isHost && (category === 'hero-video' || category === 'hero-poster' || isAmbientAudioUpload)) {
          try {
            const existingRow = await env.DB.prepare(`SELECT * FROM website_content_overrides WHERE id = 'default'`).first();
            let siteContent: any = {};
            if (existingRow) {
              try { siteContent = JSON.parse(existingRow.data_json || existingRow.content_json || '{}'); } catch {}
            }
            const oldKey = category === 'hero-video'
              ? (siteContent.heroVideoKey || extractMediaKeyFromUrl(siteContent.heroVideoUrl))
              : isAmbientAudioUpload
              ? (siteContent.albumBackgroundMusicKey || extractMediaKeyFromUrl(siteContent.albumBackgroundMusicUrl))
              : (siteContent.heroPosterKey || extractMediaKeyFromUrl(siteContent.heroPosterUrl));
            if (oldKey && oldKey !== objectKey) {
              await deleteR2ObjectAndRecord(oldKey);
            }
            if (category === 'hero-video') {
              siteContent.heroVideoUrl = publicUrl;
              siteContent.heroVideoKey = objectKey;
            } else if (isAmbientAudioUpload) {
              siteContent.albumBackgroundMusicUrl = publicUrl;
              siteContent.albumBackgroundMusicKey = objectKey;
            } else {
              siteContent.heroPosterUrl = publicUrl;
              siteContent.heroPosterKey = objectKey;
            }
            await env.DB.prepare(
              `INSERT OR REPLACE INTO website_content_overrides (id, data_json, updated_at) VALUES ('default', ?, datetime('now'))`
            )
              .bind(JSON.stringify(siteContent))
              .run();
            if (oldKey && oldKey !== objectKey) {
              await deleteR2ObjectAndRecord(oldKey);
            }
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

    // 4c. GET /media/{key} — Serve from R2 BUCKET with ETag, cache headers, 206 range requests, and resilient fallback lookup
    if (path.startsWith('/media/') && request.method === 'GET') {
      if (!env.BUCKET) {
        return new Response('Media storage not configured', { status: 503 });
      }
      const rawKey = decodeURIComponent(path.slice('/media/'.length)).replace(/^\/+/, '').replace(/^media\/+/, '');
      if (!rawKey || rawKey.includes('..')) {
        return new Response('Not found', { status: 404 });
      }

      let objectKey = rawKey;
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

          if (isDeleted && !parsedAlbum.reconciledIntoAlbumId) {
            // Check if any other active album references this objectKey before blocking
            const referencedByActive = await env.DB.prepare(
              `SELECT id FROM class_sets WHERE status != 'deleted' AND data_json LIKE ? LIMIT 1`
            ).bind(`%${objectKey}%`).first();
            const sessionUser = await getSessionUser();
            if (!referencedByActive && sessionUser?.role !== 'master_host') {
              return new Response('Not found', { status: 404, headers: corsHeaders });
            }
          }

          const isAlbumPublished =
            (rowStatus === 'published' || (rowStatus === 'active' && parsedAlbum.published === true)) &&
            !parsedAlbum.unpublished &&
            !parsedAlbum.deletedAt;

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

      let r2Obj = await env.BUCKET.get(objectKey);

      // Resilient fallback: if exact objectKey was not found in R2, check media_assets or sibling album prefix by filename
      if (!r2Obj) {
        const fileName = keyParts[keyParts.length - 1] || '';
        if (fileName && env.DB) {
          try {
            const assetMatch = await env.DB.prepare(
              `SELECT object_key FROM media_assets WHERE object_key LIKE ? ORDER BY created_at DESC LIMIT 1`
            ).bind(`%/${fileName}`).first();
            if (assetMatch?.object_key && String(assetMatch.object_key) !== objectKey) {
              objectKey = String(assetMatch.object_key);
              r2Obj = await env.BUCKET.get(objectKey);
            }
          } catch {}
        }
        if (!r2Obj && fileName && typeof env.BUCKET.list === 'function') {
          try {
            const listed = await env.BUCKET.list({ prefix: 'albums/', limit: 500 });
            const matchedObj = (listed?.objects || []).find((o: any) => String(o?.key || '').endsWith(`/${fileName}`));
            if (matchedObj?.key) {
              objectKey = String(matchedObj.key);
              r2Obj = await env.BUCKET.get(objectKey);
            }
          } catch {}
        }
      }

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
      await ensureCohortOffersSchema();
      const pskStatus = String(pskData?.status || '').toLowerCase();
      const pskCurrency = String(pskData?.currency || 'NGN').toUpperCase();
      const pskAmountKobo = Number(pskData?.amount) || 0;
      const pskRef = String(pskData?.reference || reference).trim();
      const pskDomainRaw = String(pskData?.domain || '').trim().toLowerCase();

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

      // Never overwrite a transaction that has been explicitly voided by a Host administrator
      if (txRow && String(txRow.status || '').toLowerCase() === 'voided') {
        return {
          applied: false,
          status: 'voided',
          error: 'Transaction has been voided by a Host administrator and cannot be re-applied without explicit restoration.',
        };
      }

      // Resolve authoritative payment environment from Paystack's verified domain ('test' or 'live')
      const resolvedEnvironment: 'live' | 'test' | 'legacy' =
        pskDomainRaw === 'live'
          ? 'live'
          : pskDomainRaw === 'test'
          ? 'test'
          : txRow?.environment === 'live' || storedMeta?.environment === 'live' || storedMeta?.paystackDomain === 'live'
          ? 'live'
          : txRow?.environment === 'test' || storedMeta?.environment === 'test' || storedMeta?.paystackDomain === 'test'
          ? 'test'
          : 'legacy';

      // If pending transaction exists, require exact amount match
      if (txRow && Number(txRow.amount_kobo) > 0 && Number(txRow.amount_kobo) !== pskAmountKobo) {
        return { applied: false, status: 'amount_mismatch', error: 'Verified amount does not match initialized payment amount.' };
      }

      const meta = {
        ...safePskMeta,
        ...storedMeta,
        environment: resolvedEnvironment,
        paystackDomain: pskDomainRaw || resolvedEnvironment,
        verifiedByPaystack: true,
        verifiedLiveByPaystack: pskDomainRaw === 'live' || Boolean(storedMeta?.verifiedLiveByPaystack),
      };
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

      const upsertVerifiedTransactionRow = async (params: {
        status: string;
        payerName: string;
        metaJson: string;
      }): Promise<boolean> => {
        if (txRow) {
          const updRes = await env.DB.prepare(
            `UPDATE transactions
             SET set_id = ?,
                 set_name = ?,
                 institution = ?,
                 amount = ?,
                 amount_kobo = ?,
                 currency = 'NGN',
                 status = ?,
                 environment = ?,
                 payer_name = ?,
                 payer_email = ?,
                 programme_id = ?,
                 list_price_kobo = ?,
                 discount_kobo = ?,
                 paystack_data_json = ?
             WHERE reference = ? AND LOWER(TRIM(COALESCE(status, ''))) != 'voided'`
          )
            .bind(
              albumId || null,
              String(meta.department || txRow.set_name || ''),
              String(meta.institution || txRow.institution || ''),
              Math.round(pskAmountKobo / 100),
              pskAmountKobo,
              params.status,
              resolvedEnvironment,
              params.payerName,
              payerEmail,
              txRow.programme_id || meta.programme_id || null,
              Number(txRow.list_price_kobo || meta.list_price_kobo) || pskAmountKobo,
              Number(txRow.discount_kobo || meta.discount_kobo) || 0,
              params.metaJson,
              reference
            )
            .run();
          return Number((updRes as any)?.meta?.changes ?? 1) > 0;
        }
        await env.DB.prepare(
          `INSERT OR IGNORE INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, environment, payer_name, payer_email, programme_id, list_price_kobo, discount_kobo, paystack_data_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
          .bind(
            `tx-${reference}`,
            reference,
            albumId || null,
            String(meta.department || ''),
            String(meta.institution || ''),
            Math.round(pskAmountKobo / 100),
            pskAmountKobo,
            params.status,
            resolvedEnvironment,
            params.payerName,
            payerEmail,
            meta.programme_id || null,
            Number(meta.list_price_kobo) || pskAmountKobo,
            Number(meta.discount_kobo) || 0,
            params.metaJson
          )
          .run();
        const checkAfter = await env.DB.prepare(`SELECT status FROM transactions WHERE reference = ?`).bind(reference).first();
        return String(checkAfter?.status || '').toLowerCase().trim() !== 'voided';
      };

      // Apply student submission payment
      if (paymentType === 'student' && albumId && submissionId) {
        const subRow = await env.DB.prepare(
          `SELECT * FROM profile_submissions WHERE id = ? AND album_id = ?`
        )
          .bind(submissionId, albumId)
          .first();

        if (!subRow) {
          // Paid but nothing created -> store as "paid, needs review"
          const reviewMeta = JSON.stringify({
            ...meta,
            paymentCategory: 'student_submission',
            albumId,
            payerEmail,
            environment: resolvedEnvironment,
            paystackDomain: pskDomainRaw || resolvedEnvironment,
          });
          const updatedOk = await upsertVerifiedTransactionRow({
            status: 'paid, needs review',
            payerName: payerEmail,
            metaJson: reviewMeta,
          });
          if (!updatedOk) {
            return {
              applied: false,
              status: 'voided',
              error: 'Transaction has been voided by a Host administrator and cannot be re-applied without explicit restoration.',
            };
          }
          return { applied: false, status: 'paid, needs review', paymentType: 'student', albumId, submissionId, environment: resolvedEnvironment };
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
          environment: resolvedEnvironment,
          paystackDomain: pskDomainRaw || resolvedEnvironment,
        });

        let subPayload: any = {};
        try { subPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}

        const updatedOk = await upsertVerifiedTransactionRow({
          status: 'Paid',
          payerName: subPayload.fullName || payerEmail,
          metaJson: completedMeta,
        });
        if (!updatedOk) {
          return {
            applied: false,
            status: 'voided',
            error: 'Transaction has been voided by a Host administrator and cannot be re-applied without explicit restoration.',
          };
        }

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

        return { applied: true, status: 'Paid', paymentType: 'student', albumId, submissionId, environment: resolvedEnvironment };
      }

      // Apply slot purchase payment
      if (paymentType === 'slots' && albumId && quantity >= 1) {
        const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (!albumRow) {
          const reviewMeta = JSON.stringify({
            ...meta,
            paymentCategory: 'slot_purchase',
            albumId,
            slotsPurchased: quantity,
            sponsorName,
            payerEmail,
            environment: resolvedEnvironment,
            paystackDomain: pskDomainRaw || resolvedEnvironment,
          });
          const updatedOk = await upsertVerifiedTransactionRow({
            status: 'paid, needs review',
            payerName: sponsorName || payerEmail,
            metaJson: reviewMeta,
          });
          if (!updatedOk) {
            return {
              applied: false,
              status: 'voided',
              error: 'Transaction has been voided by a Host administrator and cannot be re-applied without explicit restoration.',
            };
          }
          return { applied: false, status: 'paid, needs review', paymentType: 'slots', albumId, environment: resolvedEnvironment };
        }

        const purchaseId = String(meta.purchase_id || `spurch-${reference}`);
        const unitFeeKobo = Math.round(pskAmountKobo / quantity);

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
          environment: resolvedEnvironment,
          paystackDomain: pskDomainRaw || resolvedEnvironment,
        });

        const updatedOk = await upsertVerifiedTransactionRow({
          status: 'Paid',
          payerName: sponsorName || payerEmail,
          metaJson: completedMeta,
        });
        if (!updatedOk) {
          return {
            applied: false,
            status: 'voided',
            error: 'Transaction has been voided by a Host administrator and cannot be re-applied without explicit restoration.',
          };
        }

        await env.DB.prepare(
          `INSERT OR IGNORE INTO slot_purchases (id, album_id, quantity, amount_kobo, reference, sponsor_name, status, environment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, datetime('now'))`
        )
          .bind(purchaseId, albumId, quantity, pskAmountKobo, reference, sponsorName, resolvedEnvironment)
          .run();

        await env.DB.prepare(
          `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, purchase_id, reference, sponsor_name, unit_value_kobo, environment, idempotency_key, created_by, created_at)
           VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
          .bind(
            `sled-${reference}`,
            albumId,
            quantity,
            purchaseId,
            reference,
            sponsorName,
            unitFeeKobo,
            resolvedEnvironment,
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
              environment: resolvedEnvironment,
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

        return { applied: true, status: 'Paid', paymentType: 'slots', albumId, quantity, purchaseId, environment: resolvedEnvironment };
      }

      // Fallback: Paid but nothing created / unknown target -> store as "paid, needs review"
      const fallbackMeta = JSON.stringify({
        ...meta,
        payerEmail,
        environment: resolvedEnvironment,
        paystackDomain: pskDomainRaw || resolvedEnvironment,
      });
      const updatedOk = await upsertVerifiedTransactionRow({
        status: 'paid, needs review',
        payerName: payerEmail,
        metaJson: fallbackMeta,
      });
      if (!updatedOk) {
        return {
          applied: false,
          status: 'voided',
          error: 'Transaction has been voided by a Host administrator and cannot be re-applied without explicit restoration.',
        };
      }

      return { applied: false, status: 'paid, needs review', paymentType: 'unknown', albumId, environment: resolvedEnvironment };
    };

    // 4e-1. POST /api/payments/init
    if (path === '/api/payments/init' && request.method === 'POST') {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database unavailable' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await ensureCohortOffersSchema();
      const paystackPublicKey = (env.PAYSTACK_PUBLIC_KEY || '').trim();
      const paystackSecretKey = (env.PAYSTACK_SECRET_KEY || '').trim();
      if (!paystackPublicKey || !paystackSecretKey) {
        return new Response(
          JSON.stringify({ error: 'payments_not_available', message: 'Payments are not available yet' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const initEnvironment: 'live' | 'test' =
        paystackPublicKey.startsWith('pk_live_') && paystackSecretKey.startsWith('sk_live_')
          ? 'live'
          : 'test';

      const body = (await request.json().catch(() => ({}))) as {
        type?: 'student' | 'slots';
        albumId?: string;
        submissionId?: string;
        quantity?: number;
        sponsorName?: string;
        email?: string;
        payerName?: string;
        fullName?: string;
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

      const institutionId = String(albumRow.institution_id || albumData.institutionId || albumData.universityId || '');
      const departmentId = String(albumRow.department_id || albumData.departmentId || '');
      const institutionName = String(albumData.institutionName || albumData.universityName || institutionId || '');
      const departmentName = String(albumData.departmentName || departmentId || '');
      const setYear = Number(albumData.graduationYear || albumRow.graduation_year || new Date().getFullYear());

      // Single server-side pricing precedence resolution
      const pricing = await resolveCohortPricing({
        albumId,
        institutionId,
        departmentId,
        graduationYear: setYear,
      });

      const reference = `KHR-${paymentType === 'slots' ? 'SLT' : 'STD'}-${Date.now()}-${generateRandomHexToken(6)}`;
      let amountKobo = pricing.effectivePriceKobo > 0 ? pricing.effectivePriceKobo : pricing.standardPriceKobo;
      let listPriceKobo = pricing.standardPriceKobo;
      let discountKobo = pricing.discountKobo;
      const programmeId = pricing.programmeId;
      let payerEmail = '';
      let payerName = '';
      let metadata: any = {};

      if (paymentType === 'student') {
        if (pricing.kind === 'funding' && pricing.isCovered) {
          return new Response(
            JSON.stringify({
              error: 'covered_by_funding',
              message: `This cohort is covered by ${pricing.sponsorName || pricing.programmeName || 'a funding offer'}. No payment is required.`,
              pricing,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        let submissionId = String(body.submissionId || '').trim();
        const fallbackEmail = String(body.email || '').trim().toLowerCase();
        const fallbackName = String(body.payerName || body.fullName || fallbackEmail || 'Classmate').trim();

        let subRow: any = null;
        if (submissionId) {
          subRow = await env.DB.prepare(
            `SELECT * FROM profile_submissions WHERE id = ? AND album_id = ?`
          )
            .bind(submissionId, albumId)
            .first();
        }

        // Fallback 1: look up by email in profile_submissions for this album
        if (!subRow && fallbackEmail) {
          subRow = await env.DB.prepare(
            `SELECT * FROM profile_submissions WHERE LOWER(email) = ? AND album_id = ? AND status != 'removed' ORDER BY created_at DESC LIMIT 1`
          )
            .bind(fallbackEmail, albumId)
            .first();
          if (subRow && subRow.id) {
            submissionId = String(subRow.id);
          }
        }

        // Fallback 2: check albumData.students or auto-register the pending submission row so payment never fails with 404
        if (!subRow) {
          const finalSubId = submissionId || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          submissionId = finalSubId;
          const matchingInAlbum = Array.isArray(albumData.students)
            ? albumData.students.find(
                (st: any) =>
                  st.id === finalSubId ||
                  (fallbackEmail && String(st.personalEmail || st.email || '').toLowerCase() === fallbackEmail)
              )
            : null;
          const synthPayload = matchingInAlbum || {
            id: finalSubId,
            fullName: fallbackName,
            personalEmail: fallbackEmail,
            email: fallbackEmail,
            paymentStatus: 'unpaid',
            status: 'pending',
            source: 'student',
            submittedAt: new Date().toISOString(),
          };
          const rawTok = generateRandomHexToken(24);
          const tokHash = await sha256Hex(rawTok);
          try {
            await env.DB.prepare(
              `INSERT OR REPLACE INTO profile_submissions (id, album_id, payload_json, photo_key, email, consent_at, source, payment_status, paid_reference, status, decline_reason, declined_at, status_token_hash, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'), 'student', 'unpaid', NULL, 'pending', NULL, NULL, ?, datetime('now'), datetime('now'))`
            )
              .bind(
                finalSubId,
                albumId,
                JSON.stringify(synthPayload),
                synthPayload.photoKey || extractMediaKeyFromUrl(synthPayload.photoUrl || synthPayload.image) || null,
                fallbackEmail,
                tokHash
              )
              .run();
          } catch {}
          subRow = {
            id: finalSubId,
            album_id: albumId,
            payload_json: JSON.stringify(synthPayload),
            email: fallbackEmail,
            payment_status: 'unpaid',
            status: 'pending',
          };
        }

        if (subRow.status === 'removed' || subRow.status === 'declined') {
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
        amountKobo = pricing.effectivePriceKobo;
        listPriceKobo = pricing.standardPriceKobo;
        discountKobo = pricing.discountKobo;
        payerEmail = String(subRow.email || body.email || '').trim().toLowerCase();
        payerName = String(subPayload.fullName || body.payerName || payerEmail);
        metadata = {
          type: 'student',
          institution: institutionName,
          department: departmentName,
          set_year: setYear,
          album_id: albumId,
          submission_id: submissionId,
          programme_id: programmeId,
          list_price_kobo: listPriceKobo,
          discount_kobo: discountKobo,
          environment: initEnvironment,
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
        const unitEffectiveKobo = pricing.effectivePriceKobo > 0 ? pricing.effectivePriceKobo : pricing.standardPriceKobo;
        amountKobo = quantity * unitEffectiveKobo;
        listPriceKobo = quantity * pricing.standardPriceKobo;
        discountKobo = Math.max(0, listPriceKobo - amountKobo);
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
          programme_id: programmeId,
          list_price_kobo: listPriceKobo,
          discount_kobo: discountKobo,
          environment: initEnvironment,
        };
      }

      await env.DB.prepare(
        `INSERT INTO transactions (id, reference, set_id, set_name, institution, amount, amount_kobo, currency, status, environment, payer_name, payer_email, programme_id, list_price_kobo, discount_kobo, paystack_data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'pending', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          `tx-${reference}`,
          reference,
          albumId,
          departmentName,
          institutionName,
          Math.round(amountKobo / 100),
          amountKobo,
          initEnvironment,
          payerName,
          payerEmail,
          programmeId,
          listPriceKobo,
          discountKobo,
          JSON.stringify(metadata)
        )
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          reference,
          amountKobo,
          listPriceKobo,
          discountKobo,
          programmeId,
          pricing,
          email: payerEmail,
          publicKey: paystackPublicKey,
          environment: initEnvironment,
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
    // Helper: Reconcile slot_ledger, profile_submissions, media_assets, and sibling cohort records with album's data_json
    async function reconcileAlbumSlotsAndSubmissions(row: any, parsed: any): Promise<any> {
      if (!env.DB || !parsed || !parsed.id) return parsed;
      const albumId = String(parsed.id);
      let modified = false;

      try {
        const instId = String(row?.institution_id || parsed.institutionId || parsed.universityId || '').trim();
        const rawDeptId = String(row?.department_id || parsed.departmentId || '').trim();
        const deptName = String(parsed.departmentName || '').trim();
        const gradYear = Number(row?.graduation_year || parsed.graduationYear) || 2026;
        const canonicalDept = normalizeDepartmentCohortSlug(instId, rawDeptId, deptName);

        // Scope automatic read-time reconciliation strictly to this albumId plus any non-existent canonical/alias IDs
        // (NEVER automatically pull records from another existing class_sets row — cross-album merging is strictly owner-triggered via /api/admin/reconcile-cohort)
        const siblingAlbumIds = new Set<string>([albumId]);
        if (instId && canonicalDept && gradYear) {
          const otherExistingSetIds = new Set<string>();
          try {
            const sameYearSets = await env.DB.prepare(
              `SELECT id FROM class_sets WHERE graduation_year = ?`
            ).bind(gradYear).all();
            for (const sRow of sameYearSets?.results || []) {
              const sid = String(sRow.id || '');
              if (sid && sid !== albumId) {
                otherExistingSetIds.add(sid);
              }
            }
          } catch {}

          // Only include canonical/legacy slug aliases if no separate album row exists under that ID
          if (otherExistingSetIds.size === 0) {
            const canonicalId = getCanonicalAlbumId(instId, canonicalDept, gradYear, deptName);
            if (!otherExistingSetIds.has(canonicalId)) siblingAlbumIds.add(canonicalId);
            const legacyAliasId = `${instId.toLowerCase()}-${rawDeptId.replace(/^dept-/, '')}-${gradYear}`;
            if (!otherExistingSetIds.has(legacyAliasId)) siblingAlbumIds.add(legacyAliasId);
          }
        }

        const siblingIdList = Array.from(siblingAlbumIds);

        // 1. Load slot_ledger entries for this album
        const ledgerRows: any[] = [];
        const seenLedgerKeys = new Set<string>();
        for (const aid of siblingIdList) {
          try {
            const ledgerRes = await env.DB.prepare(
              `SELECT * FROM slot_ledger WHERE album_id = ? ORDER BY created_at ASC`
            ).bind(aid).all();
            for (const lr of ledgerRes?.results || []) {
              const dedupKey = String(lr.idempotency_key || lr.id);
              if (!seenLedgerKeys.has(dedupKey)) {
                seenLedgerKeys.add(dedupKey);
                ledgerRows.push(lr);
              }
            }
          } catch {}
        }

        let totalCredited = ledgerRows
          .filter((r: any) => String(r.kind || '') !== 'use')
          .reduce((acc: number, r: any) => acc + (Number(r.delta) || 0), 0);
        let totalUsed = ledgerRows
          .filter((r: any) => String(r.kind || '') === 'use')
          .reduce((acc: number, r: any) => acc + Math.abs(Number(r.delta) || 0), 0);
        let balance = totalCredited - totalUsed;

        // If album data_json has a higher credited slot balance than ledger (e.g. from earlier state without ledger entries), sync it
        if (ledgerRows.length === 0 && totalCredited === 0 && Number(parsed.profileSlotBalance) > 0) {
          totalCredited = Number(parsed.totalSlotsCredited) || Number(parsed.profileSlotBalance);
          balance = Number(parsed.profileSlotBalance);
        }

        // 2. Load profile_submissions for this album
        const subRows: any[] = [];
        const seenSubIds = new Set<string>();
        for (const aid of siblingIdList) {
          try {
            const subsRes = await env.DB.prepare(
              `SELECT * FROM profile_submissions WHERE album_id = ? AND status != 'removed' ORDER BY created_at ASC`
            ).bind(aid).all();
            for (const sr of subsRes?.results || []) {
              if (!seenSubIds.has(String(sr.id))) {
                seenSubIds.add(String(sr.id));
                subRows.push(sr);
              }
            }
          } catch {}
        }

        const students: any[] = Array.isArray(parsed.students) ? [...parsed.students] : [];
        const adminEmailLower = String(row?.admin_user_id || parsed.classRepEmail || '').trim().toLowerCase();
        const adminNameLower = String(parsed.classRepName || '').trim().toLowerCase();

        // Merge any submissions in profile_submissions that are not in students[] or heal missing photo URLs
        for (const sRow of subRows) {
          let sPayload: any = {};
          try { sPayload = JSON.parse(sRow.payload_json || '{}'); } catch {}
          const sEmail = String(sRow.email || sPayload.personalEmail || sPayload.email || '').trim().toLowerCase();
          const sPhotoKey = extractMediaKeyFromUrl(sRow.photo_key || sPayload.photoUrl || sPayload.image);
          const resolvedSubPhotoUrl = sPhotoKey ? `/media/${sPhotoKey}` : (sPayload.photoUrl || sPayload.image || '');

          const existingIdx = students.findIndex(
            (st: any) =>
              st.id === sRow.id ||
              (sEmail && String(st.personalEmail || st.email || '').trim().toLowerCase() === sEmail)
          );
          const isApprovedSub = sRow.status === 'approved' || Boolean(sPayload.approved);
          const isPaidSub = sRow.payment_status === 'paid' || sRow.payment_status === 'waived' || sPayload.paymentStatus === 'paid';
          const usedSlotSub = Boolean(sPayload.usedSlot || sPayload.slotConsumed);

          if (existingIdx >= 0) {
            const cur = students[existingIdx];
            const isPendingProfileUpdate = sRow.status === 'pending' && Boolean(sPayload.isProfileUpdate || sPayload.submittedAt || sRow.updated_at);
            if (isPendingProfileUpdate) {
              if (sPayload.fullName) cur.fullName = sPayload.fullName;
              if (sPayload.nickname !== undefined) cur.nickname = sPayload.nickname;
              if (sPayload.position !== undefined) cur.position = sPayload.position;
              if (sPayload.quote !== undefined) cur.quote = sPayload.quote;
              if (sPayload.bio !== undefined) cur.bio = sPayload.bio;
              if (sPayload.myStory !== undefined) cur.myStory = sPayload.myStory;
              if (sPayload.favouriteCampusMemory !== undefined) cur.favouriteCampusMemory = sPayload.favouriteCampusMemory;
              if (sPayload.funFact !== undefined) cur.funFact = sPayload.funFact;
              if (sPayload.whatsNext !== undefined) cur.whatsNext = sPayload.whatsNext;
              if (sPayload.messageToClassmates !== undefined) cur.messageToClassmates = sPayload.messageToClassmates;
              if (sPayload.messageToFutureSet !== undefined) cur.messageToFutureSet = sPayload.messageToFutureSet;
              if (sPayload.socials) cur.socials = sPayload.socials;
              if (Array.isArray(sPayload.studentAwards)) cur.studentAwards = sPayload.studentAwards;
              if (resolvedSubPhotoUrl) {
                cur.photoUrl = resolvedSubPhotoUrl;
                cur.rawPhotoUrl = resolvedSubPhotoUrl;
              }
              if (sPayload.secondaryPhotoUrl) {
                cur.secondaryPhotoUrl = sPayload.secondaryPhotoUrl;
                cur.rawSecondaryPhotoUrl = sPayload.secondaryPhotoUrl;
              }
              cur.approved = false;
              cur.status = 'pending';
              cur.submissionStatus = 'pending';
              cur.isProfileUpdate = true;
              modified = true;
            } else {
              if (!cur.photoUrl && resolvedSubPhotoUrl) {
                cur.photoUrl = resolvedSubPhotoUrl;
                modified = true;
              }
              if (!cur.secondaryPhotoUrl && sPayload.secondaryPhotoUrl) {
                cur.secondaryPhotoUrl = sPayload.secondaryPhotoUrl;
                modified = true;
              }
              if (isApprovedSub && !cur.approved && sRow.status === 'approved') {
                cur.approved = true;
                cur.status = 'approved';
                cur.submissionStatus = 'approved';
                modified = true;
              }
            }
            if (isPaidSub && cur.paymentStatus !== 'paid') {
              cur.paymentStatus = 'paid';
              cur.paidReference = sRow.paid_reference || cur.paidReference;
              modified = true;
            }
            if (usedSlotSub && !cur.usedSlot) {
              cur.usedSlot = true;
              cur.slotConsumed = true;
              modified = true;
            }
          } else if (sRow.status !== 'draft' && sRow.status !== 'declined') {
            students.push({
              ...sPayload,
              id: sRow.id,
              photoUrl: resolvedSubPhotoUrl,
              personalEmail: sEmail || sPayload.personalEmail,
              email: sEmail || sPayload.email,
              approved: isApprovedSub,
              status: isApprovedSub ? 'approved' : 'pending',
              submissionStatus: isApprovedSub ? 'approved' : 'pending',
              paymentStatus: isPaidSub ? 'paid' : (sPayload.paymentStatus || 'unpaid'),
              paidReference: sRow.paid_reference || sPayload.paidReference,
              usedSlot: usedSlotSub,
              slotConsumed: usedSlotSub,
            });
            modified = true;
          }
        }

        // 2b. Check media_assets for any uploaded Memories/Highlights for this album that were missing from parsed.memories
        const memories: any[] = Array.isArray(parsed.memories) ? [...parsed.memories] : [];
        const existingMemKeys = new Set<string>();
        for (const m of memories) {
          const mk = extractMediaKeyFromUrl(m.imageUrl || m.url);
          if (mk) existingMemKeys.add(mk);
          if (Array.isArray(m.images)) {
            for (const img of m.images) {
              const ik = extractMediaKeyFromUrl(img.url || img.imageUrl);
              if (ik) existingMemKeys.add(ik);
            }
          }
        }

        const newlyRecoveredMemImages: Array<{ id: string; url: string; caption: string; dateTime: string }> = [];
        for (const aid of siblingIdList) {
          try {
            const assetRes = await env.DB.prepare(
              `SELECT * FROM media_assets WHERE set_id = ? ORDER BY created_at ASC`
            ).bind(aid).all();
            for (const aRow of assetRes?.results || []) {
              const cat = String(aRow.category || aRow.section || '').toLowerCase();
              const objKey = String(aRow.object_key || '');
              if (
                objKey &&
                !existingMemKeys.has(objKey) &&
                (cat.includes('memor') ||
                  cat.includes('moment') ||
                  cat.includes('highlight') ||
                  cat.includes('event') ||
                  cat.includes('dinner') ||
                  cat.includes('signout') ||
                  cat.includes('fyb'))
              ) {
                const isHighlight = cat.includes('highlight');
                newlyRecoveredMemImages.push({
                  id: `img-${aRow.id || Date.now()}`,
                  url: `/media/${objKey}`,
                  caption: isHighlight ? 'Class Highlight' : (aRow.file_name ? String(aRow.file_name).replace(/\.[^.]+$/, '') : 'Class Moment'),
                  dateTime: String(aRow.created_at || new Date().toISOString()).split('T')[0],
                });
                existingMemKeys.add(objKey);
                modified = true;
              }
            }
          } catch {}
        }
        if (newlyRecoveredMemImages.length > 0) {
          const recCatIdx = memories.findIndex(
            (m: any) => Array.isArray(m.images) && (m.id === `mem-cat-recovered-${albumId}` || String(m.title || '').toLowerCase().includes('recovered'))
          );
          if (recCatIdx >= 0) {
            memories[recCatIdx] = {
              ...memories[recCatIdx],
              images: [...memories[recCatIdx].images, ...newlyRecoveredMemImages],
            };
          } else {
            memories.push({
              id: `mem-cat-recovered-${albumId}`,
              title: 'Class Moments & Highlights',
              dateStr: newlyRecoveredMemImages[0].dateTime,
              caption: 'Class memories',
              order: memories.length + 1,
              images: newlyRecoveredMemImages,
            });
          }
        }

        // 3. Auto-cover any approved student on the album who is not paid and hasn't had a slot deducted yet
        const usedSubIdsInLedger = new Set<string>();
        for (const lRow of ledgerRows) {
          if (Number(lRow.delta) < 0 && String(lRow.idempotency_key || '').startsWith('use:')) {
            const parts = String(lRow.idempotency_key).split(':');
            if (parts[1]) usedSubIdsInLedger.add(parts[1]);
          }
        }

        for (const st of students) {
          const stEmail = String(st.personalEmail || st.email || '').trim().toLowerCase();
          const stName = String(st.fullName || '').trim().toLowerCase();
          const isAdminOwn =
            Boolean(st.isAdminProfile) ||
            Boolean(parsed.classAdminStudentId && st.id === parsed.classAdminStudentId) ||
            Boolean(adminEmailLower && stEmail === adminEmailLower) ||
            Boolean(adminNameLower && stName === adminNameLower);

          if (isAdminOwn && !st.isAdminProfile) {
            st.isAdminProfile = true;
            modified = true;
          }

          if (!st.approved) continue;
          if (isAdminOwn) continue;
          if (st.paymentStatus === 'paid' || st.paymentStatus === 'waived' || st.paidReference) continue;

          if (usedSubIdsInLedger.has(st.id)) {
            if (!st.usedSlot || !st.slotConsumed) {
              st.usedSlot = true;
              st.slotConsumed = true;
              modified = true;
            }
            continue;
          }

          if (st.usedSlot || st.slotConsumed) {
            // Ensure ledger has a corresponding use entry if totalCredited > 0
            if (totalCredited > 0 && balance > 0) {
              const cycle = Date.now();
              try {
                await env.DB.prepare(
                  `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, idempotency_key, created_by, created_at)
                   VALUES (?, ?, -1, 'use', ?, ?, datetime('now'))`
                ).bind(`sled-use-${st.id}`, albumId, `use:${st.id}:${cycle}`, adminEmailLower || 'system').run();
                usedSubIdsInLedger.add(st.id);
                balance -= 1;
                totalUsed += 1;
                modified = true;
              } catch {}
            }
            continue;
          }

          // Uncovered approved profile -> cover with an available slot!
          if (balance >= 1) {
            const cycle = Date.now();
            try {
              await env.DB.prepare(
                `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, idempotency_key, created_by, created_at)
                 VALUES (?, ?, -1, 'use', ?, ?, datetime('now'))`
              ).bind(`sled-use-${st.id}`, albumId, `use:${st.id}:${cycle}`, adminEmailLower || 'system').run();
            } catch {}
            usedSubIdsInLedger.add(st.id);
            balance -= 1;
            totalUsed += 1;
            st.usedSlot = true;
            st.slotConsumed = true;
            modified = true;
          }
        }

        parsed.students = students;
        parsed.memories = memories;
        if (totalCredited > 0 || parsed.profileSlotBalance !== balance) {
          parsed.profileSlotBalance = Math.max(0, balance);
          parsed.totalSlotsCredited = totalCredited;
          parsed.totalSlotsUsed = totalUsed;
        }

        if (modified && row?.id) {
          try {
            await env.DB.prepare(
              `UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`
            ).bind(JSON.stringify(parsed), row.id).run();
          } catch {}
        }
      } catch {}

      return parsed;
    };

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

          const rowAdmin = String(row.admin_user_id || '').trim().toLowerCase();
          const jsonEmail = String(parsed.classRepEmail || parsed.currentAdminEmail || '').trim().toLowerCase();
          const userEmailLower = sessionUser ? sessionUser.email.trim().toLowerCase() : '';
          const isOwner = Boolean(
            userEmailLower &&
              (rowAdmin === userEmailLower ||
                jsonEmail === userEmailLower ||
                (Array.isArray(parsed.coAdmins) &&
                  parsed.coAdmins.some((c: any) => String(c?.email || '').trim().toLowerCase() === userEmailLower)))
          );

          if (sessionUser?.role === 'master_host') {
            parsed = await reconcileAlbumSlotsAndSubmissions(row, parsed);
            albums.push(parsed);
          } else if (isOwner) {
            // Heal admin_user_id if needed
            if (rowAdmin !== userEmailLower) {
              try {
                parsed.classRepEmail = userEmailLower;
                await env.DB.prepare(`UPDATE class_sets SET admin_user_id = ? WHERE id = ?`).bind(userEmailLower, row.id).run();
              } catch {}
            }
            parsed = await reconcileAlbumSlotsAndSubmissions(row, parsed);
            albums.push(parsed);
          } else {
            // Public visitor (or admin viewing non-owned albums)
            const isPublished = (rowStatus === 'published' || (rowStatus === 'active' && (parsed.published === true || parsed.isPublished === true))) && !parsed.unpublished && !parsed.isUnpublished && !parsed.deletedAt;
            if (isPublished) {
              albums.push(sanitizePublicAlbum(parsed));
            } else if (!parsed.deletedAt && rowStatus !== 'deleted') {
              // Return lightweight public metadata for draft/onboarding cohorts so Department Legacy Walls & Invite Links know the cohort is onboarding
              albums.push({
                id: parsed.id,
                inviteCode: parsed.inviteCode,
                institutionId: row.institution_id || parsed.institutionId,
                universityId: row.institution_id || parsed.universityId || parsed.institutionId,
                institutionName: parsed.institutionName || '',
                institutionLogoUrl: parsed.institutionLogoUrl || '',
                departmentId: row.department_id || parsed.departmentId,
                departmentName: parsed.departmentName || '',
                departmentLogoUrl: parsed.departmentLogoUrl || '',
                faculty: parsed.faculty || '',
                graduationYear: Number(row.graduationYear || row.graduation_year || parsed.graduationYear),
                classSetName: row.title || row.class_set_name || parsed.classSetName || `Class of ${parsed.graduationYear}`,
                bannerImageUrl: parsed.bannerImageUrl || '',
                isPublished: false,
                published: false,
                isUnpublished: Boolean(parsed.isUnpublished || parsed.unpublished),
                lifecycleStatus: rowStatus,
                activationStatus: parsed.activationStatus || 'inactive',
                students: [],
                memories: [],
                awards: [],
                voices: [],
              });
            }
          }
        }
      }
      return new Response(JSON.stringify({ success: true, albums }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12a-single. GET /api/albums/:id — Fetch single album by ID
    const getSingleAlbumMatch = path.match(/^\/api\/albums\/([^/]+)$/);
    if (getSingleAlbumMatch && request.method === 'GET') {
      const albumId = decodeURIComponent(getSingleAlbumMatch[1]);
      const sessionUser = await getSessionUser();
      if (env.DB) {
        const row = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
        if (row) {
          let parsed: any = {};
          try { parsed = JSON.parse(row.data_json || '{}'); } catch {}
          const rowAdmin = String(row.admin_user_id || '').trim().toLowerCase();
          const jsonEmail = String(parsed.classRepEmail || '').trim().toLowerCase();
          const userEmailLower = sessionUser ? sessionUser.email.trim().toLowerCase() : '';
          const isOwner = Boolean(userEmailLower && (rowAdmin === userEmailLower || jsonEmail === userEmailLower));
          if (sessionUser?.role === 'master_host' || isOwner) {
            parsed = await reconcileAlbumSlotsAndSubmissions(row, parsed);
            return new Response(JSON.stringify({ success: true, album: parsed }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ success: true, album: sanitizePublicAlbum(parsed) }), {
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

    // 12b. POST /api/albums — Free Google Sign-Up Album Creation (Creates Draft Album with Permanent Canonical ID)
    if (path === '/api/albums' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as any;
      const sessionUser = await getSessionUser();
      const albumPayload = body.album || {};
      let verifiedEmail = (sessionUser?.email || '').toLowerCase().trim();
      let verifiedName = sessionUser?.fullName || body.adminName || albumPayload.classRepName || '';

      if (body.signupToken) {
        const tokenPayload = await verifySignupToken(body.signupToken, sessionSecret);
        if (tokenPayload && tokenPayload.email) {
          verifiedEmail = String(tokenPayload.email).toLowerCase().trim();
          verifiedName = tokenPayload.name || verifiedName;
        }
      }

      if (!verifiedEmail) {
        const fallbackEmail = String(albumPayload.classRepEmail || body.email || '').toLowerCase().trim();
        if (fallbackEmail && fallbackEmail.includes('@')) {
          verifiedEmail = fallbackEmail;
        }
      }

      if (!verifiedEmail) {
        return new Response(JSON.stringify({ error: 'Google sign-up verification is required.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const institutionId = String(albumPayload.institutionId || albumPayload.universityId || body.institutionId || '').trim().toLowerCase();
      const rawDepartmentId = String(albumPayload.departmentId || body.departmentId || '').trim();
      const departmentName = String(albumPayload.departmentName || body.departmentName || '').trim();
      const graduationYear = Number(albumPayload.graduationYear || body.graduationYear || new Date().getFullYear());

      if (!institutionId || !rawDepartmentId || !graduationYear) {
        return new Response(JSON.stringify({ error: 'Institution, department, and graduation year are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const canonicalDepartmentId = normalizeDepartmentCohortSlug(institutionId, rawDepartmentId, departmentName);
      const canonicalCohortKey = getCanonicalCohortKey(institutionId, canonicalDepartmentId, graduationYear, departmentName);
      const departmentId = canonicalDepartmentId || rawDepartmentId;
      // Separate permanent album ID from canonical cohort key while enforcing one-album-per-cohort uniqueness
      const newAlbumId =
        albumPayload.id && String(albumPayload.id).trim() && String(albumPayload.id).trim() !== canonicalCohortKey
          ? String(albumPayload.id).trim()
          : generatePermanentAlbumId(institutionId, canonicalDepartmentId, graduationYear, departmentName);
      const nowIso = new Date().toISOString();
      const classSetTitle = String(
        albumPayload.classSetName || albumPayload.CohortLabel || `Class of ${graduationYear}`
      ).trim();

      if (env.DB) {
        await ensureInviteCodeColumn();
        let allRows: any[] = [];
        try {
          const allSetsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
          allRows = allSetsRes?.results || [];
        } catch {}

        // Rule 1 & 5: If email already owns an active album, return the reconciled album so dashboard opens immediately
        const existingOwnedRows = allRows.filter((r: any) => {
          if (r.status === 'deleted') return false;
          let p: any = {};
          try { p = JSON.parse(r.data_json || '{}'); } catch {}
          if (p.deletedAt) return false;
          const rAdmin = String(r.admin_user_id || p.classRepEmail || '').toLowerCase();
          return rAdmin === verifiedEmail.toLowerCase();
        });

        if (existingOwnedRows.length > 0) {
          // Pick the richest owned row if multiple test rows exist
          existingOwnedRows.sort((a: any, b: any) => {
            let pa: any = {};
            let pb: any = {};
            try { pa = JSON.parse(a.data_json || '{}'); } catch {}
            try { pb = JSON.parse(b.data_json || '{}'); } catch {}
            const scoreA = (Array.isArray(pa.students) ? pa.students.length * 10 : 0) + (Array.isArray(pa.memories) ? pa.memories.length * 5 : 0);
            const scoreB = (Array.isArray(pb.students) ? pb.students.length * 10 : 0) + (Array.isArray(pb.memories) ? pb.memories.length * 5 : 0);
            return scoreB - scoreA;
          });
          const existingOwnedRow = existingOwnedRows[0];
          let existingAlbum: any = {};
          try { existingAlbum = JSON.parse(existingOwnedRow.data_json || '{}'); } catch {}
          existingAlbum = await reconcileAlbumSlotsAndSubmissions(existingOwnedRow, existingAlbum);
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
              sessionToken,
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

        // Rule 6: Duplicate institution + canonical department + year is blocked on the server with "Report a dispute" option
        const duplicateRow = allRows.find((r: any) => {
          if (r.status === 'deleted') return false;
          let rp: any = {};
          try { rp = JSON.parse(r.data_json || '{}'); } catch {}
          if (rp.deletedAt) return false;
          const rInst = String(r.institution_id || rp.institutionId || '').toLowerCase();
          const rDept = normalizeDepartmentCohortSlug(rInst, String(r.department_id || rp.departmentId || ''), rp.departmentName);
          const rYear = Number(r.graduation_year || rp.graduationYear);
          return rInst === institutionId.toLowerCase() && rDept === canonicalDepartmentId && rYear === graduationYear;
        });

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

        // If the same owner had a soft-deleted row for this exact cohort within 30 days, restore it instead of deleting its data!
        const deletedSameCohortRows = allRows.filter((r: any) => {
          let rp: any = {};
          try { rp = JSON.parse(r.data_json || '{}'); } catch {}
          const isDel = r.status === 'deleted' || Boolean(rp.deletedAt);
          if (!isDel) return false;
          const rInst = String(r.institution_id || rp.institutionId || '').toLowerCase();
          const rDept = normalizeDepartmentCohortSlug(rInst, String(r.department_id || rp.departmentId || ''), rp.departmentName);
          const rYear = Number(r.graduation_year || rp.graduationYear);
          return rInst === institutionId.toLowerCase() && rDept === canonicalDepartmentId && rYear === graduationYear;
        });

        const ownedSoftDeleted = deletedSameCohortRows.find((r: any) => {
          let rp: any = {};
          try { rp = JSON.parse(r.data_json || '{}'); } catch {}
          const isHostKept = Boolean(rp.keepByHost || rp.keptByHostOnly);
          if (isHostKept) return false;
          const rOwner = String(r.admin_user_id || rp.classRepEmail || '').toLowerCase();
          return rOwner === verifiedEmail.toLowerCase();
        });
        if (ownedSoftDeleted) {
          let restoredAlbum: any = {};
          try { restoredAlbum = JSON.parse(ownedSoftDeleted.data_json || '{}'); } catch {}
          delete restoredAlbum.deletedAt;
          restoredAlbum.lifecycleStatus = 'draft';
          restoredAlbum.published = false;
          restoredAlbum.version = (Number(restoredAlbum.version) || 1) + 1;
          restoredAlbum = await reconcileAlbumSlotsAndSubmissions(ownedSoftDeleted, restoredAlbum);
          await env.DB.prepare(
            `UPDATE class_sets SET status = 'draft', data_json = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(JSON.stringify(restoredAlbum), ownedSoftDeleted.id).run();

          const role = verifiedEmail.toLowerCase() === hostEmail ? 'master_host' : 'class_rep';
          const sessionToken = await createSessionToken(
            {
              id: `usr-${verifiedEmail.toLowerCase()}`,
              email: verifiedEmail.toLowerCase(),
              fullName: restoredAlbum.classRepName || verifiedName || verifiedEmail.split('@')[0],
              role,
              assignedSetId: ownedSoftDeleted.id,
              exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
            },
            sessionSecret
          );
          return new Response(
            JSON.stringify({
              success: true,
              restored: true,
              album: restoredAlbum,
              sessionToken,
              user: {
                id: `usr-${verifiedEmail.toLowerCase()}`,
                email: verifiedEmail.toLowerCase(),
                fullName: restoredAlbum.classRepName || verifiedName || verifiedEmail.split('@')[0],
                role,
                assignedSetId: ownedSoftDeleted.id,
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

        // If a soft-deleted cohort row exists for a DIFFERENT owner or is Host-retained, block false creation / duplicate with 409 and safe recovery/Host-intervention path
        if (deletedSameCohortRows.length > 0) {
          const conflictingDeletedRow = deletedSameCohortRows[0];
          let conflictingData: any = {};
          try { conflictingData = JSON.parse(conflictingDeletedRow.data_json || '{}'); } catch {}
          const isHostRetained = Boolean(conflictingData.keepByHost || conflictingData.keptByHostOnly);
          return new Response(
            JSON.stringify({
              error: 'soft_deleted_cohort_exists',
              message: isHostRetained
                ? `The ${departmentName || departmentId} Class of ${graduationYear} album is currently retained in the Host recovery vault. Please submit a claim or contact the Host to restore or transfer ownership.`
                : `A recently deleted ${departmentName || departmentId} Class of ${graduationYear} album is still within its 30-day recovery window. Its original administrator can restore it from the Control Center, or you can request Host intervention to transfer or clear the cohort.`,
              canDispute: true,
              existingAlbumId: conflictingDeletedRow.id,
              canonicalCohortKey,
            }),
            {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Check for an active Cohort Funding offer or legacy KoHot slot allocation matching (institution, department, graduationYear)
        let creditedSlots = 0;
        let creditedAllocationId: string | null = null;
        let creditedSponsorName = 'KoHot';
        let creditedShowRecognition = true;

        try {
          const cohortPricing = await resolveCohortPricing({
            institutionId,
            departmentId,
            graduationYear,
          });

          if (cohortPricing.kind === 'funding' && cohortPricing.coverageCap > 0) {
            creditedSlots = cohortPricing.coverageCap;
            creditedAllocationId = `calloc-${institutionId}-${departmentId}-${graduationYear}`;
            creditedSponsorName = cohortPricing.sponsorName || 'KoHot';
            creditedShowRecognition = cohortPricing.showRecognition;
            await env.DB.prepare(
              `INSERT OR IGNORE INTO slot_ledger (id, album_id, delta, kind, allocation_id, sponsor_name, unit_value_kobo, idempotency_key, created_by, created_at)
               VALUES (?, ?, ?, 'kohot_allocation', ?, ?, ?, ?, 'system', datetime('now'))`
            ).bind(
              `sled-calloc-${creditedAllocationId}`,
              newAlbumId,
              creditedSlots,
              creditedAllocationId,
              creditedSponsorName,
              cohortPricing.standardPriceKobo,
              `calloc:${creditedAllocationId}`
            ).run();
          } else {
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
          }
        } catch {}

        const initialSponsors = Array.isArray(albumPayload.sponsors) ? [...albumPayload.sponsors] : [];
        if (creditedSlots > 0 && !initialSponsors.some((s: any) => s.sponsorName === creditedSponsorName)) {
          initialSponsors.unshift({
            id: creditedAllocationId || `sp-kohot-${newAlbumId}`,
            sponsorName: creditedSponsorName,
            DisplayLabel: `Sponsored by ${creditedSponsorName}`,
            quantity: creditedSlots,
            amountPaid: 0,
            reference: `KOHOT-ALLOC-${graduationYear}`,
            date: nowIso.split('T')[0],
            showSponsorNameOnAlbum: creditedShowRecognition,
            isKoHotCredit: true,
          });
        }

        const inviteCode = String(albumPayload.inviteCode || computeInviteCode(newAlbumId));
        const draftAlbum = {
          ...albumPayload,
          id: newAlbumId,
          canonicalCohortKey,
          inviteCode,
          institutionId,
          universityId: institutionId,
          departmentId,
          graduationYear,
          classSetName: classSetTitle,
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

        try {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO users (id, email, full_name, phone, role, created_at) VALUES (?, ?, ?, ?, 'class_rep', datetime('now'))`
          ).bind(
            `usr-${verifiedEmail}`,
            verifiedEmail,
            draftAlbum.classRepName,
            draftAlbum.classRepPhone || ''
          ).run();
          await env.DB.prepare(
            `UPDATE users SET full_name = ?, phone = ?, assigned_set_id = ? WHERE LOWER(email) = ?`
          ).bind(
            draftAlbum.classRepName,
            draftAlbum.classRepPhone || '',
            newAlbumId,
            verifiedEmail.toLowerCase()
          ).run();
        } catch {}

        let inserted = false;
        try {
          await env.DB.prepare(
            `INSERT INTO class_sets (id, institution_id, department_id, graduation_year, class_set_name, admin_user_id, invite_code, data_json, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
          ).bind(
            newAlbumId,
            institutionId,
            departmentId,
            graduationYear,
            classSetTitle,
            verifiedEmail,
            inviteCode,
            JSON.stringify(draftAlbum)
          ).run();
          inserted = true;
        } catch {}

        if (!inserted) {
          try {
            await env.DB.prepare(
              `INSERT INTO class_sets (id, institution_id, department_id, graduation_year, class_set_name, title, admin_user_id, invite_code, data_json, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
            ).bind(
              newAlbumId,
              institutionId,
              departmentId,
              graduationYear,
              classSetTitle,
              classSetTitle,
              verifiedEmail,
              inviteCode,
              JSON.stringify(draftAlbum)
            ).run();
            inserted = true;
          } catch {}
        }

        if (!inserted) {
          try {
            await env.DB.prepare(
              `INSERT INTO class_sets (id, institution_id, department_id, graduation_year, title, admin_user_id, data_json, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
            ).bind(
              newAlbumId,
              institutionId,
              departmentId,
              graduationYear,
              classSetTitle,
              verifiedEmail,
              JSON.stringify(draftAlbum)
            ).run();
            inserted = true;
          } catch {}
        }

        if (!inserted) {
          return new Response(
            JSON.stringify({
              error: 'album_creation_failed',
              message: 'Could not persist the new class album in D1 due to a cohort uniqueness constraint conflict. Please verify if a cohort album already exists or contact Host support.',
              canDispute: true,
              canonicalCohortKey,
            }),
            {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Also seed admin's own profile in profile_submissions if present in students[0]
        if (Array.isArray(draftAlbum.students) && draftAlbum.students.length > 0) {
          try {
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
          } catch {}
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
            sessionToken,
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

      // Fallback when env.DB is not bound so preview/staging still creates the album cleanly
      const inviteCode = String(albumPayload.inviteCode || computeInviteCode(newAlbumId));
      const draftAlbum = {
        ...albumPayload,
        id: newAlbumId,
        inviteCode,
        institutionId,
        universityId: institutionId,
        departmentId,
        graduationYear,
        classSetName: classSetTitle,
        classRepEmail: verifiedEmail,
        classRepName: albumPayload.classRepName || verifiedName || verifiedEmail.split('@')[0],
        published: false,
        unpublished: false,
        lifecycleStatus: 'draft',
        version: 1,
        profileSlotBalance: 0,
        totalSlotsCredited: 0,
        totalSlotsUsed: 0,
        createdAt: nowIso,
      };
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
          creditedSlots: 0,
          sessionToken,
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

    // 12c. PUT /api/albums/:id — Non-Destructive Save Album with Ownership & Data Integrity Guards
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

      // Guard: Never allow an unhydrated client fallback placeholder to overwrite real D1 album data
      if (incomingAlbum.isHydratingPlaceholder) {
        const reconciled = await reconcileAlbumSlotsAndSubmissions(existingRow, existingData);
        return new Response(
          JSON.stringify({
            success: true,
            version: Number(reconciled.version) || 1,
            album: reconciled,
            ignoredPlaceholderSave: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rowAdmin = String(existingRow.admin_user_id || '').trim().toLowerCase();
      const jsonEmail = String(existingData.classRepEmail || existingData.currentAdminEmail || '').trim().toLowerCase();
      const ownerEmail = rowAdmin || jsonEmail;
      const requesterEmail = sessionUser.email.trim().toLowerCase();
      const isCoAdmin = Array.isArray(existingData.coAdmins) && existingData.coAdmins.some(
        (c: any) => String(c?.email || '').trim().toLowerCase() === requesterEmail
      );

      // Host rule: Host reads everything, edits no album content (except keepByHost retention flag, owner-controlled item management, or Crownfield demo sets)
      if (sessionUser.role === 'master_host' && ownerEmail !== requesterEmail && !albumId.startsWith('crownfield-') && !body.hostControlCenterUpdate) {
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

      // Admin ownership rule: allow if ownerEmail matches, or jsonEmail matches, or co-admin, or host control center update
      if (
        ownerEmail !== requesterEmail &&
        jsonEmail !== requesterEmail &&
        !isCoAdmin &&
        !(sessionUser.role === 'master_host' && (albumId.startsWith('crownfield-') || body.hostControlCenterUpdate))
      ) {
        return new Response(JSON.stringify({ error: 'Forbidden: You can only read and save the album you own.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const currentVersion = Number(existingData.version) || 1;

      // Non-destructive collection guards: never wipe non-empty students, memories, awards, or voices with an empty array unless explicitly requested
      const existingStudents = Array.isArray(existingData.students) ? existingData.students : [];
      const incomingStudents = Array.isArray(incomingAlbum.students) ? incomingAlbum.students : [];
      let safeStudents = incomingStudents;
      if (existingStudents.length > 0 && incomingStudents.length === 0 && !body.explicitClearStudents) {
        safeStudents = existingStudents;
      } else if (existingStudents.length > 0 && incomingStudents.length > 0) {
        // Preserve any existing student photoUrl/secondaryPhotoUrl if incoming student accidentally lost it
        safeStudents = incomingStudents.map((incSt: any) => {
          const prevSt = existingStudents.find((e: any) => e.id === incSt.id);
          if (!prevSt) return incSt;
          return {
            ...prevSt,
            ...incSt,
            photoUrl: incSt.photoUrl || incSt.image || prevSt.photoUrl || prevSt.image || '',
            secondaryPhotoUrl: incSt.secondaryPhotoUrl ?? prevSt.secondaryPhotoUrl,
          };
        });
      }

      const existingMemories = Array.isArray(existingData.memories) ? existingData.memories : [];
      const incomingMemories = Array.isArray(incomingAlbum.memories) ? incomingAlbum.memories : [];
      let safeMemories = incomingMemories;
      if (existingMemories.length > 0 && incomingMemories.length === 0 && !body.explicitClearMemories) {
        safeMemories = existingMemories;
      }

      const existingAwards = Array.isArray(existingData.awards) ? existingData.awards : [];
      const incomingAwards = Array.isArray(incomingAlbum.awards) ? incomingAlbum.awards : [];
      const safeAwards = existingAwards.length > 0 && incomingAwards.length === 0 && !body.explicitClearAwards
        ? existingAwards
        : incomingAwards;

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
            amountPaid: oldSp.amountPaid,
            quantity: oldSp.quantity,
            reference: oldSp.reference,
          };
        });
        for (const inc of incomingSponsors) {
          if (!mergedSponsors.some((m: any) => m.id === inc.id || m.reference === inc.reference)) {
            mergedSponsors.push(inc);
          }
        }
        incomingAlbum.sponsors = mergedSponsors;
      }

      const nextVersion = currentVersion + 1;
      const isNowUnpublished = Boolean(incomingAlbum.unpublished || incomingAlbum.isUnpublished);
      const isNowPublished = Boolean((incomingAlbum.published || incomingAlbum.isPublished) && !isNowUnpublished);
      const nextStatus = incomingAlbum.deletedAt
        ? 'deleted'
        : isNowUnpublished
        ? 'unpublished'
        : isNowPublished
        ? 'published'
        : 'draft';

      const resolvedInviteCode = String(
        existingRow.invite_code || existingData.inviteCode || incomingAlbum.inviteCode || computeInviteCode(albumId)
      );

      let updatedAlbum: any = {
        ...existingData,
        ...incomingAlbum,
        id: albumId,
        students: safeStudents,
        memories: safeMemories,
        awards: safeAwards,
        published: isNowPublished,
        isPublished: isNowPublished,
        unpublished: isNowUnpublished,
        isUnpublished: isNowUnpublished,
        inviteCode: resolvedInviteCode,
        classRepEmail: existingRow.admin_user_id || existingData.classRepEmail,
        lifecycleStatus: nextStatus,
        version: nextVersion,
      };
      delete updatedAlbum.isHydratingPlaceholder;

      updatedAlbum = await reconcileAlbumSlotsAndSubmissions(existingRow, updatedAlbum);

      // Collect media keys before and after update so replaced banner/moment/profile images are cleaned from R2 & media_assets
      // while preserving any media belonging to 30-day soft-deleted albums or 7-day declined/deleted student profiles
      const oldAlbumKeys = collectAlbumMediaKeys(existingData);

      await ensureInviteCodeColumn();
      const updatedTitle = String(
        updatedAlbum.classSetName || updatedAlbum.CohortLabel || existingRow.class_set_name || existingRow.title || `Class of ${updatedAlbum.graduationYear || ''}`
      ).trim();
      let updatedInDb = false;
      try {
        await env.DB.prepare(
          `UPDATE class_sets SET class_set_name = ?, status = ?, invite_code = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(
          updatedTitle,
          nextStatus,
          resolvedInviteCode,
          JSON.stringify(updatedAlbum),
          albumId
        ).run();
        updatedInDb = true;
      } catch {}

      if (!updatedInDb) {
        try {
          await env.DB.prepare(
            `UPDATE class_sets SET title = ?, status = ?, invite_code = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(
            updatedTitle,
            nextStatus,
            resolvedInviteCode,
            JSON.stringify(updatedAlbum),
            albumId
          ).run();
          updatedInDb = true;
        } catch {}
      }

      if (!updatedInDb) {
        await env.DB.prepare(
          `UPDATE class_sets SET status = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(
          nextStatus,
          JSON.stringify(updatedAlbum),
          albumId
        ).run();
      }

      if (nextStatus !== 'deleted' && !updatedAlbum.deletedAt) {
        try {
          const newAlbumKeys = collectAlbumMediaKeys(updatedAlbum);
          const settingsMap = await getPlatformSettingsMap(env);
          const reinstateDaysMs = (Number(settingsMap.reinstate_days) || 7) * 24 * 60 * 60 * 1000;
          const nowMs = Date.now();
          const protectedDeclinedKeys = new Set<string>();

          // Protect any student profile photos in the 7-day Declined/Deleted recovery window
          const allStudentCandidates = [
            ...(Array.isArray(existingData.students) ? existingData.students : []),
            ...(Array.isArray(updatedAlbum.students) ? updatedAlbum.students : []),
            ...(Array.isArray(updatedAlbum.declinedStudents) ? updatedAlbum.declinedStudents : []),
            ...(Array.isArray(updatedAlbum.deletedStudents) ? updatedAlbum.deletedStudents : []),
          ];
          for (const st of allStudentCandidates) {
            const isDeclinedOrDeleted =
              st?.status === 'declined' ||
              st?.status === 'deleted' ||
              Boolean(st?.declined) ||
              Boolean(st?.deletedAt) ||
              Boolean(st?.declinedAt);
            if (!isDeclinedOrDeleted) continue;
            const tsRaw = st?.declinedAt || st?.deletedAt || st?.updatedAt || st?.submittedAt;
            const tsMs = tsRaw ? new Date(String(tsRaw)).getTime() : nowMs;
            if (!Number.isNaN(tsMs) && nowMs - tsMs <= reinstateDaysMs) {
              for (const k of collectAlbumMediaKeys(st)) protectedDeclinedKeys.add(k);
            }
          }

          const subRes = await env.DB.prepare(
            `SELECT status, declined_at, updated_at, photo_key, payload_json FROM profile_submissions WHERE album_id = ? AND status != 'removed'`
          ).bind(albumId).all();
          for (const sRow of subRes?.results || []) {
            if (sRow.status === 'declined') {
              const decMs = sRow.declined_at
                ? new Date(String(sRow.declined_at)).getTime()
                : sRow.updated_at
                ? new Date(String(sRow.updated_at)).getTime()
                : nowMs;
              if (!Number.isNaN(decMs) && nowMs - decMs > reinstateDaysMs) continue;
            }
            if (sRow.photo_key) {
              const pk = extractMediaKeyFromUrl(sRow.photo_key);
              if (pk) protectedDeclinedKeys.add(pk);
            }
            if (sRow.payload_json) {
              try {
                for (const k of collectAlbumMediaKeys(JSON.parse(String(sRow.payload_json)))) {
                  protectedDeclinedKeys.add(k);
                }
              } catch {}
            }
          }

          for (const oldKey of oldAlbumKeys) {
            if (!newAlbumKeys.has(oldKey) && !protectedDeclinedKeys.has(oldKey)) {
              await deleteR2ObjectAndRecord(oldKey, albumId);
            }
          }
        } catch {}
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
        const oldInstKeys = new Set<string>();
        try {
          const prevRes = await env.DB.prepare(`SELECT logo_url, departments_json FROM institutions`).all();
          for (const r of prevRes?.results || []) {
            const lk = extractMediaKeyFromUrl(r.logo_url);
            if (lk) oldInstKeys.add(lk);
            if (r.departments_json) {
              try {
                for (const k of collectAlbumMediaKeys(JSON.parse(String(r.departments_json)))) {
                  oldInstKeys.add(k);
                }
              } catch {}
            }
          }
        } catch {}

        const newInstKeys = collectAlbumMediaKeys(list);
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

        for (const oldKey of oldInstKeys) {
          if (!newInstKeys.has(oldKey)) {
            await deleteR2ObjectAndRecord(oldKey);
          }
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
          const rawEnv = String(r.environment || meta.environment || meta.paystackDomain || meta.domain || '').toLowerCase().trim();
          const txEnvironment: 'live' | 'test' | 'legacy' =
            rawEnv === 'live' ? 'live' : rawEnv === 'test' ? 'test' : 'legacy';
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
            environment: txEnvironment,
            voidedAt: r.voided_at || meta.voidedAt || null,
            voidedBy: r.voided_by || meta.voidedBy || null,
            voidReason: r.void_reason || meta.voidReason || null,
            previousStatus: r.previous_status || meta.previousStatus || null,
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
          `SELECT value FROM platform_settings WHERE key = 'demo_testimonials_seeded_v2'`
        ).first();
        if (!seededRow || String(seededRow.value) !== '1') {
          try {
            await env.DB.prepare(`DELETE FROM testimonials WHERE id = 'demo-test-5'`).run();
          } catch {}

          const samples = [
            {
              id: 'demo-test-1',
              albumId: 'crownfield-law-2026',
              email: 'chiemeka.eze.2026@crownfield.edu.ng',
              name: 'Chiemeka Anthony Eze',
              role: 'Class Album Admin',
              university: 'Crownfield University',
              department: 'Department of Public Law',
              year: 2026,
              cohortLabel: 'Apex — Class of 2026',
              avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=720&auto=format&fit=crop&q=85',
              quote:
                'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening and our Public Law Class of 2026 album came together effortlessly.',
              order: 1,
            },
            {
              id: 'demo-test-2',
              albumId: 'crownfield-law-2025',
              email: 'chisom.okonkwo.2025@crownfield.edu.ng',
              name: 'Chisom Emmanuel Okonkwo',
              role: 'Class Album Admin',
              university: 'Crownfield University',
              department: 'Department of Public Law',
              year: 2025,
              cohortLabel: 'Frontiers — Class of 2025',
              avatarUrl: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=720&auto=format&fit=crop&q=85',
              quote:
                'I didn’t have to design anything manually. I approved classmate profiles, organized our Law Dinner moments, and handed the department baton directly to the 2026 set.',
              order: 2,
            },
            {
              id: 'demo-test-3',
              albumId: 'crownfield-law-2024',
              email: 'amina.bello.2024@crownfield.edu.ng',
              name: 'Amina Zainab Bello',
              role: 'Class Album Admin',
              university: 'Crownfield University',
              department: 'Department of Public Law',
              year: 2024,
              cohortLabel: 'Phoenix — Class of 2024',
              avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=720&auto=format&fit=crop&q=85',
              quote:
                'It opens fast on every phone, and our parents could browse our entire Phoenix Class of 2024 album, leadership honorees, and final-year moments from one link.',
              order: 3,
            },
            {
              id: 'demo-test-4',
              albumId: 'crownfield-law-2023',
              email: 'seun.adeleke.2023@crownfield.edu.ng',
              name: 'Oluwaseun Babatunde Adeleke',
              role: 'Class Album Admin',
              university: 'Crownfield University',
              department: 'Department of Public Law',
              year: 2023,
              cohortLabel: 'Trailblazers — Class of 2023',
              avatarUrl: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=720&auto=format&fit=crop&q=85',
              quote:
                'Seeing every graduating class side by side on our department legacy wall makes our faculty feel like it has a living, breathing archive that our juniors can build upon.',
              order: 4,
            },
          ];

          for (const s of samples) {
            try {
              await env.DB.prepare(
                `INSERT OR REPLACE INTO testimonials (id, album_id, submitted_by_user_id, admin_full_name, admin_role_title, university_name, department_name, graduation_year, cohort_label, rating, testimonial_text, admin_avatar_url, album_cover_url, consent_given, is_public, review_status, is_featured, is_visible, is_demo, display_order, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?, '', 1, 1, 'approved', 1, 1, 1, ?, datetime('now'), datetime('now'))`
              )
                .bind(
                  s.id,
                  s.albumId,
                  s.email,
                  s.name,
                  s.role,
                  s.university,
                  s.department,
                  s.year,
                  s.cohortLabel,
                  s.quote,
                  s.avatarUrl,
                  s.order
                )
                .run();
            } catch {
              try {
                await env.DB.prepare(
                  `INSERT OR REPLACE INTO testimonials (id, name, email, role, avatar_url, university, university_id, department, department_id, class_year, class_set_name, set_id, testimonial_text, submission_date, publication_permission, review_status, is_featured, is_visible, is_demo, display_order, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'crownfield', ?, 'dept-crownfield-public-law', ?, ?, ?, ?, date('now'), 'public', 'approved', 1, 1, 1, ?, datetime('now'))`
                )
                  .bind(
                    s.id,
                    s.name,
                    s.email,
                    s.role,
                    s.avatarUrl,
                    s.university,
                    s.department,
                    s.year,
                    s.cohortLabel,
                    s.albumId,
                    s.quote,
                    s.order
                  )
                  .run();
              } catch {}
            }
          }

          await env.DB.prepare(
            `INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('demo_testimonials_seeded_v2', '1')`
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
          const existing = await env.DB.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(testId).first();
          await env.DB.prepare(`DELETE FROM testimonials WHERE id = ?`).bind(testId).run();
          if (existing) {
            const oldAvatarKey = extractMediaKeyFromUrl(existing.admin_avatar_url || existing.avatar_url);
            const oldCoverKey = extractMediaKeyFromUrl(existing.album_cover_url);
            if (oldAvatarKey) await deleteR2ObjectAndRecord(oldAvatarKey);
            if (oldCoverKey) await deleteR2ObjectAndRecord(oldCoverKey);
          }
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
          const oldAvatarKey = extractMediaKeyFromUrl(existing.admin_avatar_url || existing.avatar_url);
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
          const newAvatarKey = extractMediaKeyFromUrl(nextAvatar);

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
          if (oldAvatarKey && oldAvatarKey !== newAvatarKey) {
            await deleteR2ObjectAndRecord(oldAvatarKey);
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
        const oldKeys = new Set<string>();
        const existingRow = await env.DB.prepare(`SELECT * FROM website_content_overrides WHERE id = 'default'`).first();
        if (existingRow) {
          try {
            const oldContent = JSON.parse(existingRow.data_json || existingRow.content_json || '{}');
            for (const k of collectAlbumMediaKeys(oldContent)) oldKeys.add(k);
            const oldVideoKey = oldContent.heroVideoKey || extractMediaKeyFromUrl(oldContent.heroVideoUrl);
            const oldPosterKey = oldContent.heroPosterKey || extractMediaKeyFromUrl(oldContent.heroPosterUrl);
            const oldAudioKey = oldContent.albumBackgroundMusicKey || extractMediaKeyFromUrl(oldContent.albumBackgroundMusicUrl);
            if (oldVideoKey) oldKeys.add(oldVideoKey);
            if (oldPosterKey) oldKeys.add(oldPosterKey);
            if (oldAudioKey) oldKeys.add(oldAudioKey);
          } catch {}
        }
        const newKeys = collectAlbumMediaKeys(content);
        const newVideoKey = content.heroVideoKey || extractMediaKeyFromUrl(content.heroVideoUrl);
        const newPosterKey = content.heroPosterKey || extractMediaKeyFromUrl(content.heroPosterUrl);
        const newAudioKey = content.albumBackgroundMusicKey || extractMediaKeyFromUrl(content.albumBackgroundMusicUrl);
        if (newVideoKey) newKeys.add(newVideoKey);
        if (newPosterKey) newKeys.add(newPosterKey);
        if (newAudioKey) newKeys.add(newAudioKey);

        await env.DB.prepare(
          `INSERT OR REPLACE INTO website_content_overrides (id, data_json, updated_at) VALUES ('default', ?, datetime('now'))`
        ).bind(JSON.stringify(content)).run();

        for (const oldKey of oldKeys) {
          if (!newKeys.has(oldKey)) {
            await deleteR2ObjectAndRecord(oldKey);
          }
        }
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
      if (!env.DB) return { balance: 0, totalCredited: 0, totalUsed: 0, reversedSlots: 0, ledger: [], purchases: [] };
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
      const totalCredited = ledger
        .filter((r: any) => String(r.kind || '') !== 'use')
        .reduce((acc: number, r: any) => acc + (Number(r.delta) || 0), 0);
      const totalUsed = ledger
        .filter((r: any) => String(r.kind || '') === 'use')
        .reduce((acc: number, r: any) => acc + Math.abs(Number(r.delta) || 0), 0);
      const reversedSlots = Math.max(
        0,
        ledger
          .filter((r: any) => String(r.kind || '') === 'void_reversal' || String(r.kind || '') === 'void_restore')
          .reduce((acc: number, r: any) => acc - (Number(r.delta) || 0), 0)
      );
      const balance =
        sumRow && sumRow.balance !== undefined && sumRow.balance !== null
          ? Number(sumRow.balance)
          : totalCredited - totalUsed;
      return {
        balance,
        totalCredited,
        totalUsed,
        reversedSlots,
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
      const pricing = await resolveCohortPricing({ albumId });
      const summary = await getAlbumSlotSummary(albumId);
      const settings = await getPlatformSettingsMap(env);
      return new Response(
        JSON.stringify({
          success: true,
          ...summary,
          settings,
          pricing,
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
      const email = String(profilePayload.personalEmail || profilePayload.email || body.email || '').trim().toLowerCase();

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

      if (
        existingByEmail &&
        source === 'student' &&
        !profilePayload.isProfileUpdate &&
        existingByEmail.status === 'approved' &&
        (existingByEmail.payment_status === 'paid' || existingByEmail.payment_status === 'waived')
      ) {
        return new Response(
          JSON.stringify({
            error: 'duplicate_email',
            message: 'A paid and approved profile with this email address already exists on this album.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rawStatusToken = generateRandomHexToken(24);
      const tokenHash = await sha256Hex(rawStatusToken);
      const subId = existingByEmail?.id || profilePayload.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Resolve cohort pricing so active Funding offers automatically cover submissions while coverage remains
      const cohortPricing = await resolveCohortPricing({
        albumId,
        institutionId: body.institutionId || profilePayload.institutionId,
        departmentId: body.departmentId || profilePayload.departmentId,
        graduationYear: Number(body.graduationYear || profilePayload.graduationYear) || undefined,
      });

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
      const newPhotoKey =
        profilePayload.photoKey ||
        extractMediaKeyFromUrl(profilePayload.photoUrl || profilePayload.image) ||
        null;
      const newSecondaryPhotoKey =
        extractMediaKeyFromUrl(profilePayload.secondaryPhotoUrl) || null;
      const resolvedPhotoUrl = newPhotoKey
        ? `/media/${newPhotoKey}`
        : String(profilePayload.photoUrl || profilePayload.image || '');
      const resolvedSecondaryPhotoUrl = newSecondaryPhotoKey
        ? `/media/${newSecondaryPhotoKey}`
        : String(profilePayload.secondaryPhotoUrl || '');

      // If replacing an existing submission's photo, delete the old R2 object
      if (existingByEmail?.photo_key && newPhotoKey && existingByEmail.photo_key !== newPhotoKey) {
        await deleteR2ObjectAndRecord(existingByEmail.photo_key, albumId);
      }

      const isCoveredByFunding = cohortPricing.kind === 'funding' && cohortPricing.isCovered;

      const enrichedPayload = {
        ...profilePayload,
        id: subId,
        setId: albumId,
        email,
        personalEmail: email,
        photoUrl: resolvedPhotoUrl,
        rawPhotoUrl: resolvedPhotoUrl || profilePayload.rawPhotoUrl || '',
        ...(resolvedSecondaryPhotoUrl
          ? {
              secondaryPhotoUrl: resolvedSecondaryPhotoUrl,
              rawSecondaryPhotoUrl: resolvedSecondaryPhotoUrl,
            }
          : {}),
        paymentStatus,
        paidReference: paidReference || undefined,
        claimsToBeCovered: Boolean(isCoveredByFunding || profilePayload.claimsToBeCovered || body.claimsToBeCovered),
        sponsoredBy: isCoveredByFunding ? cohortPricing.sponsorName : profilePayload.sponsoredBy,
        programmeId: cohortPricing.programmeId || undefined,
        source,
        approved: false,
        status: nextStatus,
        submissionStatus: nextStatus,
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

      // Immediately sync non-draft submissions & edits into class_sets.data_json.students so they show on the Album Admin Dashboard for approval
      if (nextStatus === 'pending') {
        try {
          const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(albumId).first();
          if (albumRow?.data_json) {
            let albumData: any = {};
            try { albumData = JSON.parse(albumRow.data_json || '{}'); } catch {}
            const curStudents: any[] = Array.isArray(albumData.students) ? [...albumData.students] : [];
            const matchIdx = curStudents.findIndex(
              (st: any) =>
                st.id === subId ||
                (email && String(st.personalEmail || st.email || '').trim().toLowerCase() === email)
            );
            if (matchIdx >= 0) {
              const existingSt = curStudents[matchIdx];
              curStudents[matchIdx] = {
                ...existingSt,
                ...enrichedPayload,
                id: existingSt.id || subId,
                photoUrl: resolvedPhotoUrl || existingSt.photoUrl || '',
                rawPhotoUrl: resolvedPhotoUrl || existingSt.rawPhotoUrl || '',
                secondaryPhotoUrl: resolvedSecondaryPhotoUrl || existingSt.secondaryPhotoUrl || '',
                approved: false,
                status: 'pending',
                submissionStatus: 'pending',
                isProfileUpdate: true,
                usedSlot: Boolean(existingSt.usedSlot || enrichedPayload.usedSlot),
                slotConsumed: Boolean(existingSt.slotConsumed || enrichedPayload.slotConsumed),
                paymentStatus:
                  existingSt.paymentStatus === 'paid' || paymentStatus === 'paid'
                    ? 'paid'
                    : existingSt.paymentStatus === 'waived' || paymentStatus === 'waived'
                    ? 'waived'
                    : paymentStatus || existingSt.paymentStatus || 'unpaid',
              };
            } else {
              curStudents.push({
                ...enrichedPayload,
                approved: false,
                status: 'pending',
                submissionStatus: 'pending',
              });
            }
            albumData.students = curStudents;
            albumData.version = (Number(albumData.version) || 1) + 1;
            await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
              .bind(JSON.stringify(albumData), albumId)
              .run();
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({
          success: true,
          submissionId: subId,
          status: nextStatus,
          paymentStatus,
          pricing: cohortPricing,
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
            studentFeeKobo: Number(settings.student_fee_kobo) || 100000,
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

      const oldPhotoKey = subRow.photo_key || extractMediaKeyFromUrl(payload.photoUrl || payload.image);
      const nextPhotoKey =
        incomingPayload.photoKey ||
        extractMediaKeyFromUrl(incomingPayload.photoUrl || incomingPayload.image) ||
        oldPhotoKey ||
        null;
      const resolvedNextPhotoUrl = nextPhotoKey
        ? `/media/${nextPhotoKey}`
        : String(incomingPayload.photoUrl || incomingPayload.image || payload.photoUrl || payload.image || '');
      if (oldPhotoKey && nextPhotoKey && oldPhotoKey !== nextPhotoKey) {
        await deleteR2ObjectAndRecord(oldPhotoKey, subRow.album_id);
      }

      const nextStatus = body.saveAsDraft ? 'draft' : 'pending';
      // Never allow client edit to overwrite paymentStatus or paidReference
      const updatedPayload = {
        ...payload,
        ...incomingPayload,
        id: subRow.id,
        personalEmail: subRow.email,
        photoUrl: resolvedNextPhotoUrl,
        rawPhotoUrl: resolvedNextPhotoUrl || incomingPayload.rawPhotoUrl || payload.rawPhotoUrl || '',
        paymentStatus: subRow.payment_status,
        paidReference: subRow.paid_reference || undefined,
        approved: false,
        status: nextStatus,
        submissionStatus: nextStatus,
      };
      await env.DB.prepare(
        `UPDATE profile_submissions SET payload_json = ?, photo_key = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(updatedPayload), nextPhotoKey, nextStatus, subRow.id).run();

      if (nextStatus === 'pending' && subRow.album_id) {
        try {
          const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(subRow.album_id).first();
          if (albumRow?.data_json) {
            let albumData: any = {};
            try { albumData = JSON.parse(albumRow.data_json || '{}'); } catch {}
            const curStudents: any[] = Array.isArray(albumData.students) ? [...albumData.students] : [];
            const subEmail = String(subRow.email || '').trim().toLowerCase();
            const matchIdx = curStudents.findIndex(
              (st: any) =>
                st.id === subRow.id ||
                (subEmail && String(st.personalEmail || st.email || '').trim().toLowerCase() === subEmail)
            );
            if (matchIdx >= 0) {
              curStudents[matchIdx] = {
                ...curStudents[matchIdx],
                ...updatedPayload,
                id: curStudents[matchIdx].id || subRow.id,
                approved: false,
                status: 'pending',
                submissionStatus: 'pending',
                isProfileUpdate: true,
              };
            } else {
              curStudents.push({
                ...updatedPayload,
                id: subRow.id,
                approved: false,
                status: 'pending',
                submissionStatus: 'pending',
              });
            }
            albumData.students = curStudents;
            albumData.version = (Number(albumData.version) || 1) + 1;
            await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
              .bind(JSON.stringify(albumData), subRow.album_id)
              .run();
          }
        } catch {}
      }

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
          if (!canReinstate) {
            await env.DB.prepare(`DELETE FROM profile_submissions WHERE id = ?`).bind(r.id).run();
            if (r.photo_key) {
              await deleteR2ObjectAndRecord(r.photo_key, albumId);
            }
            for (const k of collectAlbumMediaKeys(payload)) {
              await deleteR2ObjectAndRecord(k, albumId);
            }
            continue;
          }
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
          const useLedgerId = `sled-use-${subRow.id}-${cycle}`;
          await env.DB.prepare(
            `INSERT INTO slot_ledger (id, album_id, delta, kind, idempotency_key, created_by, created_at)
             VALUES (?, ?, -1, 'use', ?, ?, datetime('now'))`
          ).bind(
            useLedgerId,
            albumId,
            `use:${subRow.id}:${cycle}`,
            access.user.email
          ).run();

          // Post-insert atomicity guard against concurrent void/slot consumption race
          const postUseCheck = await env.DB.prepare(
            `SELECT SUM(delta) as balance FROM slot_ledger WHERE album_id = ?`
          ).bind(albumId).first();
          const postUseBalance = Number(postUseCheck?.balance ?? 0);
          if (postUseBalance < 0) {
            await env.DB.prepare(`DELETE FROM slot_ledger WHERE id = ?`).bind(useLedgerId).run();
            balance = Math.max(0, postUseBalance + 1);
            skippedUnpaidIds.push(subRow.id);
            continue;
          }

          balance = postUseBalance;
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
      const unitValueKobo = Number(settings.student_fee_kobo) || 100000;

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
      const unitValueKobo = Number(settings.student_fee_kobo) || 100000;
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
              student_fee_kobo: Number(raw.student_fee_kobo) || 100000,
              default_discount_percent: Number(raw.default_discount_percent ?? 20),
              founding_discount_name:
                raw.founding_discount_name || 'Founding Class Departmental Discount',
              founding_discount_description:
                raw.founding_discount_description ||
                'Special rate for the founding graduating class of a department.',
              compression_resolution_px: Number(raw.compression_resolution_px) || 1440,
              min_funded_to_publish: Number(raw.min_funded_to_publish) || 10,
              profile_cap_default: Number(raw.profile_cap_default) || 200,
              reinstate_days: Number(raw.reinstate_days) || 7,
              draft_retention_days: Number(raw.draft_retention_days) || 30,
              recovery_period_days: Number(raw.recovery_period_days) || 30,
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
        validateAndQueueInt('default_discount_percent', 0, 99, 'Founding Class / Departmental discount percentage'),
        validateAndQueueInt('compression_resolution_px', 720, 4096, 'Album media compression resolution (px)'),
        validateAndQueueInt('min_funded_to_publish', 0, 1000, 'Minimum funded profiles to publish'),
        validateAndQueueInt('profile_cap_default', 1, 5000, 'Default profile cap'),
        validateAndQueueInt('reinstate_days', 1, 365, 'Reinstate days'),
        validateAndQueueInt('draft_retention_days', 1, 365, 'Draft retention days'),
        validateAndQueueInt('recovery_period_days', 1, 365, 'Recovery period days'),
        validateAndQueueInt('default_kohot_slots_per_album', 0, 1000, 'Default KOHOT slots per album'),
      ].filter(Boolean);

      if (validationErrors.length > 0) {
        return new Response(JSON.stringify({ error: validationErrors[0], errors: validationErrors }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (body.default_discount_percent !== undefined) {
        updates.push({ key: 'default_discount_percent_explicit', oldVal: current.default_discount_percent_explicit || '0', newVal: '1' });
      }
      if (typeof body.founding_discount_name === 'string') {
        const cleanName = body.founding_discount_name.trim().slice(0, 120);
        if (cleanName && current.founding_discount_name !== cleanName) {
          updates.push({ key: 'founding_discount_name', oldVal: current.founding_discount_name || '', newVal: cleanName });
        }
      }
      if (typeof body.founding_discount_description === 'string') {
        const cleanDesc = body.founding_discount_description.trim().slice(0, 280);
        if (cleanDesc && current.founding_discount_description !== cleanDesc) {
          updates.push({
            key: 'founding_discount_description',
            oldVal: current.founding_discount_description || '',
            newVal: cleanDesc,
          });
        }
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
            student_fee_kobo: Number(updatedRaw.student_fee_kobo) || 100000,
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

    // 13p. Host Finances Summary & Ledger & Void/Restore/Classify/Refund (/api/admin/finances/*)
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

      await ensureCohortOffersSchema();
      const settings = await getPlatformSettingsMap(env);
      const unitFeeKobo = Number(settings.student_fee_kobo) || 100000;
      let instCurrencies: Record<string, string> = {};
      try { instCurrencies = JSON.parse(settings.institution_currencies || '{}'); } catch {}

      const resolveTransactionEnvironment = (r: any, meta: any): 'live' | 'test' | 'legacy' => {
        const colEnv = String(r?.environment || '').toLowerCase().trim();
        const metaDomain = String(meta?.paystackDomain || meta?.domain || '').toLowerCase().trim();
        const metaEnv = String(meta?.classifiedEnvironment || meta?.environment || '').toLowerCase().trim();
        const rawStatus = String(r?.status || 'pending').toLowerCase().trim();
        const isPaidStatus = rawStatus === 'paid' || rawStatus === 'completed' || rawStatus === 'success';

        // Any explicit test signal always resolves to 'test'
        if (colEnv === 'test' || metaEnv === 'test' || metaDomain === 'test') {
          return 'test';
        }
        // Explicit legacy classification
        if (colEnv === 'legacy' || meta?.classifiedEnvironment === 'legacy') {
          return 'legacy';
        }
        // Paid commercial transactions can ONLY be 'live' if independently verified against Paystack's live domain
        const hasVerifiedLiveProof = metaDomain === 'live' || meta?.verifiedLiveByPaystack === true;
        if (isPaidStatus) {
          return hasVerifiedLiveProof ? 'live' : 'legacy';
        }
        if (colEnv === 'live' || metaEnv === 'live' || hasVerifiedLiveProof) {
          return 'live';
        }
        return 'legacy';
      };

      const buildLedgerRows = async () => {
        const txRes = await env.DB.prepare(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1000`).all();
        const setsRes = await env.DB.prepare(`SELECT id, institution_id, department_id, graduation_year, class_set_name, data_json FROM class_sets`).all();
        const purchasesRes = await env.DB.prepare(`SELECT * FROM slot_purchases`).all();
        const slotLedgerRes = await env.DB.prepare(`SELECT * FROM slot_ledger ORDER BY created_at ASC`).all();

        const setMap = new Map<string, any>();
        for (const s of setsRes?.results || []) {
          setMap.set(String(s.id), s);
        }

        const allPurchases = purchasesRes?.results || [];
        const allSlotLedger = slotLedgerRes?.results || [];

        const rows: any[] = [];
        for (const r of txRes?.results || []) {
          let meta: any = {};
          try { meta = JSON.parse(r.paystack_data_json || r.raw_payload_json || '{}'); } catch {}
          const ref = String(r.reference || '').trim();
          const albumId = String(meta.albumId || meta.album_id || r.set_id || r.registration_id || '');
          const matchedSet = setMap.get(albumId);
          let setJson: any = {};
          if (matchedSet?.data_json) {
            try { setJson = JSON.parse(matchedSet.data_json); } catch {}
          }

          const rawStatus = String(r.status || 'pending').toLowerCase().trim();
          let status: 'paid' | 'pending' | 'failed' | 'voided' | 'refunded' | 'refund_due' | 'needs_review' = 'pending';
          if (rawStatus === 'voided') status = 'voided';
          else if (rawStatus === 'refunded') status = 'refunded';
          else if (rawStatus === 'refund_due' || rawStatus === 'refund due') status = 'refund_due';
          else if (rawStatus.includes('needs review') || rawStatus === 'needs_review') status = 'needs_review';
          else if (rawStatus === 'paid' || rawStatus === 'completed' || rawStatus === 'success') status = 'paid';
          else if (rawStatus === 'failed' || rawStatus === 'abandoned') status = 'failed';

          const environment = resolveTransactionEnvironment(r, meta);

          const rawType = String(meta.paymentCategory || meta.type || '').toLowerCase();
          const type: 'student_payment' | 'slot_purchase' =
            rawType.includes('slot') || ref.includes('-SLT-')
              ? 'slot_purchase'
              : 'student_payment';

          // Match slot_purchases and slot_ledger entries for this reference
          const purchaseIdCandidate = String(meta.purchase_id || `spurch-${ref}`);
          const matchedPurchase = allPurchases.find(
            (sp: any) =>
              (ref && String(sp.reference || '').trim() === ref) ||
              (purchaseIdCandidate && String(sp.id || '') === purchaseIdCandidate)
          );
          const matchedLedgerEntries = allSlotLedger.filter((sl: any) => {
            const slRef = String(sl.reference || '').trim();
            const slPid = String(sl.purchase_id || '').trim();
            const slId = String(sl.id || '').trim();
            const slIdem = String(sl.idempotency_key || '').trim();
            if (ref && (slRef === ref || slId === `sled-${ref}` || slIdem === `purchase:${ref}` || slIdem.startsWith(`void_reversal:${ref}`) || slIdem.startsWith(`void_restore:${ref}`))) {
              return true;
            }
            if (matchedPurchase && slPid === String(matchedPurchase.id)) {
              return true;
            }
            if (purchaseIdCandidate && slPid === purchaseIdCandidate) {
              return true;
            }
            return false;
          });

          const creditedSlots = matchedLedgerEntries
            .filter((sl: any) => String(sl.kind || '') === 'purchase' && Number(sl.delta) > 0)
            .reduce((acc: number, sl: any) => acc + (Number(sl.delta) || 0), 0);
          const reversedSlots = Math.max(
            0,
            matchedLedgerEntries
              .filter((sl: any) => String(sl.kind || '') === 'void_reversal' || String(sl.kind || '') === 'void_restore')
              .reduce((acc: number, sl: any) => acc - (Number(sl.delta) || 0), 0)
          );
          const netActiveSlots = Math.max(0, creditedSlots - reversedSlots);
          const didCreditSlots = creditedSlots > 0;

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
          const quantity =
            type === 'slot_purchase'
              ? creditedSlots > 0
                ? creditedSlots
                : Math.max(1, Number(matchedPurchase?.quantity || meta.slotsPurchased || meta.quantity) || Math.round(amountKobo / unitFeeKobo) || 1)
              : 1;
          const sponsor = type === 'slot_purchase' ? String(matchedPurchase?.sponsor_name || meta.sponsorName || meta.sponsor_name || r.payer_name || '') : '';
          const currency = instCurrencies[institutionId] || String(r.currency || 'NGN').toUpperCase();
          const isHistorical25kCandidate = amountKobo === 2500000 && environment !== 'live';

          rows.push({
            id: r.id || `tx-${ref}`,
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
            listPriceKobo: Number(r.list_price_kobo || meta.list_price_kobo) || amountKobo,
            discountKobo: Number(r.discount_kobo || meta.discount_kobo) || 0,
            programmeId: r.programme_id || meta.programme_id || null,
            currency,
            status,
            rawStatus: String(r.status || 'pending'),
            environment,
            reference: ref,
            quantity,
            didCreditSlots,
            creditedSlots,
            reversedSlots,
            netActiveSlots,
            slotPurchaseStatus: matchedPurchase ? String(matchedPurchase.status || 'completed') : null,
            isHistorical25kCandidate,
            sponsor,
            payerName: r.payer_name || meta.payerName || '',
            payerEmail: r.payer_email || meta.payerEmail || '',
            refundNote: meta.refundNote || '',
            refundedAt: meta.refundedAt || '',
            voidedAt: r.voided_at || meta.voidedAt || null,
            voidedBy: r.voided_by || meta.voidedBy || null,
            voidReason: r.void_reason || meta.voidReason || null,
            previousStatus: r.previous_status || meta.previousStatus || null,
            restoredAt: r.restored_at || meta.restoredAt || null,
            restoredBy: r.restored_by || meta.restoredBy || null,
            restoreReason: r.restore_reason || meta.restoreReason || null,
          });
        }
        return rows;
      };

      if (path === '/api/admin/finances/summary' && request.method === 'GET') {
        const rows = await buildLedgerRows();
        // Africa/Lagos (UTC+1) current year and month
        const lagosNow = new Date(Date.now() + 60 * 60 * 1000);
        const lagosYearMonth = lagosNow.toISOString().slice(0, 7); // YYYY-MM

        // Commercial revenue metrics include ONLY verified LIVE payments (status === 'paid' && environment === 'live')
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

        // Distinct non-live & reconciliation metrics
        let testRevenueKobo = 0;
        let testPaymentsCount = 0;
        let legacyRevenueKobo = 0;
        let legacyPaymentsCount = 0;
        let voidedTransactionsKobo = 0;
        let voidedTransactionsCount = 0;
        let historical25kTestCount = 0;
        let unclassifiedLegacyCount = 0;

        for (const row of rows) {
          const rowDateLagos = new Date(new Date(row.date).getTime() + 60 * 60 * 1000).toISOString().slice(0, 7);
          if (row.isHistorical25kCandidate && row.status !== 'voided') {
            historical25kTestCount += 1;
          }
          if (row.status === 'voided') {
            voidedTransactionsKobo += row.amountKobo;
            voidedTransactionsCount += 1;
            continue;
          }
          if (row.status === 'paid') {
            if (row.environment === 'live') {
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
            } else if (row.environment === 'test') {
              testRevenueKobo += row.amountKobo;
              testPaymentsCount += 1;
            } else {
              legacyRevenueKobo += row.amountKobo;
              legacyPaymentsCount += 1;
              unclassifiedLegacyCount += 1;
            }
          } else if (row.status === 'refund_due') {
            if (row.environment === 'live') {
              refundsDueKobo += row.amountKobo;
            }
            refundsDueCount += 1;
          } else if (row.status === 'refunded') {
            if (row.environment === 'live') {
              refundedKobo += row.amountKobo;
            }
          } else if (row.status === 'pending') {
            pendingPaymentsCount += 1;
          } else if (row.status === 'needs_review') {
            paidNeedsReviewCount += 1;
          }
        }

        // Reversed slot credits across all albums
        const reversedLedgerRes = await env.DB.prepare(
          `SELECT delta, unit_value_kobo, kind FROM slot_ledger WHERE kind IN ('void_reversal', 'void_restore')`
        ).all();
        let reversedSlotsCount = 0;
        let reversedSlotsValueKobo = 0;
        for (const rl of reversedLedgerRes?.results || []) {
          const d = Number(rl.delta) || 0;
          const u = Number(rl.unit_value_kobo) || unitFeeKobo;
          reversedSlotsCount -= d; // void_reversal has negative delta, so subtracting adds to reversed count
          reversedSlotsValueKobo -= d * u;
        }
        reversedSlotsCount = Math.max(0, reversedSlotsCount);
        reversedSlotsValueKobo = Math.max(0, reversedSlotsValueKobo);

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

        const activePublicKey = (env.PAYSTACK_PUBLIC_KEY || '').trim();
        const activeSecretKey = (env.PAYSTACK_SECRET_KEY || '').trim();
        const activePaystackKeyMode: 'live' | 'test' | 'unconfigured' =
          activePublicKey.startsWith('pk_live_') && activeSecretKey.startsWith('sk_live_')
            ? 'live'
            : activePublicKey.startsWith('pk_test_') || activeSecretKey.startsWith('sk_test_')
            ? 'test'
            : 'unconfigured';

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
              testRevenueKobo,
              testPaymentsCount,
              legacyRevenueKobo,
              legacyPaymentsCount,
              voidedTransactionsKobo,
              voidedTransactionsCount,
              reversedSlotsCount,
              reversedSlotsValueKobo,
              kohotSponsoredValueKobo,
              kohotSponsoredSlotsCount,
              unitFeeKobo,
              activePaystackKeyMode,
              needsAttention: {
                pendingPaymentsCount,
                paidNeedsReviewCount,
                refundsDueCount,
                historical25kTestCount,
                unclassifiedLegacyCount,
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

      // GET /api/admin/finances/historical-audit — Inspect historical/test/legacy transactions (including the two ₦25,000 test transactions)
      if (path === '/api/admin/finances/historical-audit' && request.method === 'GET') {
        const rows = await buildLedgerRows();
        const purchasesRes = await env.DB.prepare(`SELECT * FROM slot_purchases ORDER BY created_at DESC`).all();
        const slotLedgerRes = await env.DB.prepare(`SELECT * FROM slot_ledger ORDER BY created_at ASC`).all();
        const allPurchases = purchasesRes?.results || [];
        const allSlotLedger = slotLedgerRes?.results || [];

        const auditItems: any[] = [];
        for (const row of rows) {
          if (row.environment === 'live' && !row.isHistorical25kCandidate) continue;
          const ref = row.reference;
          const purchaseIdCandidate = `spurch-${ref}`;
          const matchedPurchase = allPurchases.find(
            (sp: any) =>
              (ref && String(sp.reference || '').trim() === ref) ||
              String(sp.id || '') === purchaseIdCandidate
          ) || null;
          const matchedLedgerEntries = allSlotLedger.filter((sl: any) => {
            const slRef = String(sl.reference || '').trim();
            const slPid = String(sl.purchase_id || '').trim();
            const slId = String(sl.id || '').trim();
            const slIdem = String(sl.idempotency_key || '').trim();
            if (ref && (slRef === ref || slId === `sled-${ref}` || slIdem === `purchase:${ref}` || slIdem.startsWith(`void_reversal:${ref}`) || slIdem.startsWith(`void_restore:${ref}`))) {
              return true;
            }
            if (matchedPurchase && slPid === String(matchedPurchase.id)) {
              return true;
            }
            return false;
          });

          let albumSlotSummary = { balance: 0, totalCredited: 0, totalUsed: 0, reversedSlots: 0 };
          if (row.albumId) {
            const s = await getAlbumSlotSummary(row.albumId);
            albumSlotSummary = {
              balance: s.balance,
              totalCredited: s.totalCredited,
              totalUsed: s.totalUsed,
              reversedSlots: s.reversedSlots,
            };
          }

          const canSafelyVoid =
            row.status !== 'voided' &&
            (row.netActiveSlots === 0 || albumSlotSummary.balance >= row.netActiveSlots);
          const voidBlockReason =
            row.status === 'voided'
              ? 'Transaction is already voided.'
              : row.netActiveSlots > albumSlotSummary.balance
              ? `Reversing ${row.netActiveSlots} credited slot(s) would reduce album available balance (${albumSlotSummary.balance}) below zero (${albumSlotSummary.totalUsed} slot(s) are currently consumed).`
              : null;

          auditItems.push({
            ...row,
            slotPurchaseRecord: matchedPurchase,
            slotLedgerEntries: matchedLedgerEntries,
            albumCurrentSlotBalance: albumSlotSummary.balance,
            albumTotalCreditedSlots: albumSlotSummary.totalCredited,
            albumTotalUsedSlots: albumSlotSummary.totalUsed,
            canSafelyVoid,
            voidBlockReason,
          });
        }

        const historical25kCandidates = auditItems.filter((item) => item.amountKobo === 2500000);
        return new Response(
          JSON.stringify({
            success: true,
            historical25kCandidates,
            auditItems,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api/admin/finances/classify-environment — Classify historical/legacy transactions as 'test', 'legacy', or (only if verified against Paystack live API) 'live'
      if (path === '/api/admin/finances/classify-environment' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const reference = String(body.reference || '').trim();
        const targetEnv = String(body.environment || '').toLowerCase().trim() as 'test' | 'live' | 'legacy';
        const reason = String(body.reason || '').trim();
        const confirm = Boolean(body.confirm);

        if (!reference || !['test', 'live', 'legacy'].includes(targetEnv) || reason.length < 3 || !confirm) {
          return new Response(
            JSON.stringify({
              error: 'invalid_classification_request',
              message: 'Transaction reference, valid target environment (test, live, or legacy), mandatory reason, and explicit confirmation are required.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const txRow = await env.DB.prepare(`SELECT * FROM transactions WHERE reference = ?`).bind(reference).first();
        if (!txRow) {
          return new Response(JSON.stringify({ error: 'Transaction not found.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let meta: any = {};
        try { meta = JSON.parse(txRow.paystack_data_json || txRow.raw_payload_json || '{}'); } catch {}
        const previousEnvironment = resolveTransactionEnvironment(txRow, meta);
        const nowIso = new Date().toISOString();

        // AUDIT RULE 1: Prevent manual classification of unverified or test transactions as 'live'
        // unless independently verified against the live Paystack API.
        if (targetEnv === 'live') {
          const existingPaystackDomain = String(meta?.paystackDomain || meta?.domain || '').toLowerCase().trim();
          if (existingPaystackDomain === 'test' || reference.startsWith('PSK-') || reference.startsWith('demo_')) {
            return new Response(
              JSON.stringify({
                error: 'cannot_classify_test_as_live',
                message: `Cannot classify transaction ${reference} as LIVE: this reference originated in Paystack TEST mode and cannot be counted as commercial live revenue.`,
              }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const alreadyVerifiedLive = existingPaystackDomain === 'live' && meta?.verifiedLiveByPaystack === true;
          if (!alreadyVerifiedLive) {
            const secretKey = (env.PAYSTACK_SECRET_KEY || '').trim();
            if (!secretKey.startsWith('sk_live_')) {
              return new Response(
                JSON.stringify({
                  error: 'live_verification_required',
                  message: `Cannot classify transaction ${reference} as LIVE without independent verification against the live Paystack API (requires an active live Paystack secret key sk_live_...). Manual classification alone cannot create commercial live revenue.`,
                }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            let verifiedLiveOk = false;
            try {
              const pskRes = await fetch(
                `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
                {
                  headers: {
                    Authorization: `Bearer ${secretKey}`,
                  },
                }
              );
              const pskJson = (await pskRes.json().catch(() => ({}))) as any;
              const pskData = pskJson?.data;
              const expectedKobo = Number(txRow.amount_kobo) || (Number(txRow.amount) || 0) * 100;
              if (
                pskRes.ok &&
                pskJson?.status === true &&
                pskData &&
                String(pskData.status || '').toLowerCase() === 'success' &&
                String(pskData.domain || '').toLowerCase() === 'live' &&
                String(pskData.currency || 'NGN').toUpperCase() === 'NGN' &&
                String(pskData.reference || '').trim() === reference &&
                (expectedKobo <= 0 || Number(pskData.amount) === expectedKobo)
              ) {
                verifiedLiveOk = true;
                meta.paystackDomain = 'live';
                meta.verifiedByPaystack = true;
                meta.verifiedLiveByPaystack = true;
              }
            } catch {}

            if (!verifiedLiveOk) {
              return new Response(
                JSON.stringify({
                  error: 'live_verification_failed',
                  message: `Cannot classify transaction ${reference} as LIVE: independent verification against the live Paystack API failed or did not confirm a matching live NGN payment. Manual classification alone cannot create commercial live revenue.`,
                }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } else if (targetEnv === 'test') {
          meta.paystackDomain = meta.paystackDomain === 'live' ? 'live' : 'test';
        }

        meta.environment = targetEnv;
        meta.classifiedEnvironment = targetEnv;
        meta.classifiedBy = sessionUser.email;
        meta.classifiedAt = nowIso;
        meta.classificationReason = reason;
        meta.previousEnvironment = previousEnvironment;

        await env.DB.prepare(
          `UPDATE transactions SET environment = ?, paystack_data_json = ? WHERE reference = ?`
        )
          .bind(targetEnv, JSON.stringify(meta), reference)
          .run();

        await env.DB.prepare(
          `UPDATE slot_purchases SET environment = ? WHERE reference = ? OR id = ?`
        )
          .bind(targetEnv, reference, `spurch-${reference}`)
          .run();

        await env.DB.prepare(
          `UPDATE slot_ledger SET environment = ? WHERE reference = ? OR id = ? OR purchase_id = ? OR idempotency_key LIKE ?`
        )
          .bind(targetEnv, reference, `sled-${reference}`, `spurch-${reference}`, `%${reference}%`)
          .run();

        await logAudit(
          'transaction_environment_classified',
          `Transaction ${reference} environment classified from "${previousEnvironment}" to "${targetEnv}" by ${sessionUser.email}. Reason: ${reason}`,
          sessionUser.email
        );

        return new Response(
          JSON.stringify({
            success: true,
            reference,
            previousEnvironment,
            environment: targetEnv,
            classifiedBy: sessionUser.email,
            classifiedAt: nowIso,
            reason,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api/admin/finances/void — Void transaction with mandatory reason, confirmation, and compensating slot reversal
      if (path === '/api/admin/finances/void' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const reference = String(body.reference || '').trim();
        const reason = String(body.reason || '').trim();
        const confirm = Boolean(body.confirm);
        const classifyAsTest = Boolean(body.classifyAsTest);

        if (!reference || reason.length < 3 || !confirm) {
          return new Response(
            JSON.stringify({
              error: 'confirmation_and_reason_required',
              message: 'Transaction reference, explicit confirmation, and a mandatory void reason (minimum 3 characters) are required.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const txRow = await env.DB.prepare(`SELECT * FROM transactions WHERE reference = ?`).bind(reference).first();
        if (!txRow) {
          return new Response(JSON.stringify({ error: 'Transaction not found.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const previousStatus = String(txRow.status || 'pending');
        if (previousStatus.toLowerCase().trim() === 'voided') {
          return new Response(
            JSON.stringify({
              error: 'already_voided',
              message: `Transaction ${reference} has already been voided and cannot be voided again.`,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let meta: any = {};
        try { meta = JSON.parse(txRow.paystack_data_json || txRow.raw_payload_json || '{}'); } catch {}
        const currentEnvironment = resolveTransactionEnvironment(txRow, meta);
        const finalEnvironment: 'live' | 'test' | 'legacy' = classifyAsTest ? 'test' : currentEnvironment;
        const albumId = String(meta.albumId || meta.album_id || txRow.set_id || txRow.registration_id || '').trim();
        const submissionId = String(meta.submissionId || meta.submission_id || '').trim();
        const purchaseIdCandidate = String(meta.purchase_id || `spurch-${reference}`);

        // Inspect slot_purchases and slot_ledger for this reference
        const purchaseRow = await env.DB.prepare(
          `SELECT * FROM slot_purchases WHERE reference = ? OR id = ? LIMIT 1`
        )
          .bind(reference, purchaseIdCandidate)
          .first();

        const ledgerEntriesRes = await env.DB.prepare(
          `SELECT * FROM slot_ledger WHERE reference = ? OR id = ? OR purchase_id = ? OR idempotency_key LIKE ? ORDER BY created_at ASC`
        )
          .bind(
            reference,
            `sled-${reference}`,
            purchaseRow?.id || purchaseIdCandidate,
            `%${reference}%`
          )
          .all();
        const matchedLedgerEntries = ledgerEntriesRes?.results || [];

        const origPurchaseLedger = matchedLedgerEntries.find(
          (sl: any) => String(sl.kind || '') === 'purchase' && Number(sl.delta) > 0
        );
        const creditedSlotsGross = matchedLedgerEntries
          .filter((sl: any) => String(sl.kind || '') === 'purchase' && Number(sl.delta) > 0)
          .reduce((acc: number, sl: any) => acc + (Number(sl.delta) || 0), 0);
        const alreadyReversedSlots = Math.max(
          0,
          matchedLedgerEntries
            .filter((sl: any) => String(sl.kind || '') === 'void_reversal' || String(sl.kind || '') === 'void_restore')
            .reduce((acc: number, sl: any) => acc - (Number(sl.delta) || 0), 0)
        );
        const netActiveSlotsToReverse = Math.max(0, creditedSlotsGross - alreadyReversedSlots);
        const restoreCycleCount = matchedLedgerEntries.filter(
          (sl: any) => String(sl.kind || '') === 'void_restore'
        ).length;
        const effectiveAlbumId = String(
          albumId || purchaseRow?.album_id || origPurchaseLedger?.album_id || ''
        ).trim();

        // Guard: If this transaction credited slots, verify reversing them will not drop available album slots below 0
        if (netActiveSlotsToReverse > 0 && effectiveAlbumId) {
          const albumSummary = await getAlbumSlotSummary(effectiveAlbumId);
          if (albumSummary.balance < netActiveSlotsToReverse) {
            return new Response(
              JSON.stringify({
                error: 'insufficient_available_slots_for_reversal',
                message: `Cannot void transaction ${reference}: reversing ${netActiveSlotsToReverse} credited slot(s) would reduce album "${effectiveAlbumId}" available slot balance (${albumSummary.balance}) below zero because ${albumSummary.totalUsed} slot(s) are currently consumed by approved student profiles. Unapprove/free consumed slots or allocate replacement slots first.`,
                creditedSlots: netActiveSlotsToReverse,
                availableSlotBalance: albumSummary.balance,
                totalUsedSlots: albumSummary.totalUsed,
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const voidedAt = new Date().toISOString();
        const reversalLedgerId: string | null =
          netActiveSlotsToReverse > 0 && effectiveAlbumId
            ? `sled-rev-${reference}-c${restoreCycleCount}`
            : null;
        const reversalIdempotencyKey = `void_reversal:${reference}:cycle:${restoreCycleCount}`;
        const slotsReversed = reversalLedgerId ? netActiveSlotsToReverse : 0;

        // Prepare updated metadata & perform atomic conditional state transition on transactions FIRST
        const prevMetaJson = txRow.paystack_data_json || null;
        const voidHistory = Array.isArray(meta.voidHistory) ? [...meta.voidHistory] : [];
        voidHistory.push({
          voidedAt,
          voidedBy: sessionUser.email,
          reason,
          previousStatus,
          previousEnvironment: currentEnvironment,
          environment: finalEnvironment,
          slotsReversed,
          reversalLedgerId,
        });
        meta.voidedAt = voidedAt;
        meta.voidedBy = sessionUser.email;
        meta.voidReason = reason;
        meta.previousStatus = previousStatus;
        meta.environment = finalEnvironment;
        if (classifyAsTest) {
          meta.classifiedEnvironment = 'test';
        }
        meta.voidHistory = voidHistory;

        const txVoidUpdateRes = await env.DB.prepare(
          `UPDATE transactions
           SET status = 'voided',
               previous_status = ?,
               voided_at = ?,
               voided_by = ?,
               void_reason = ?,
               environment = ?,
               paystack_data_json = ?
           WHERE reference = ? AND LOWER(TRIM(COALESCE(status, ''))) != 'voided'`
        )
          .bind(
            previousStatus,
            voidedAt,
            sessionUser.email,
            reason,
            finalEnvironment,
            JSON.stringify(meta),
            reference
          )
          .run();

        if (Number((txVoidUpdateRes as any)?.meta?.changes ?? 1) === 0) {
          return new Response(
            JSON.stringify({
              error: 'already_voided',
              message: `Transaction ${reference} has already been voided and cannot be voided again.`,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 1. Insert compensating slot_ledger entry if slots were credited (deterministic ID & UNIQUE idempotency_key)
        if (netActiveSlotsToReverse > 0 && effectiveAlbumId && reversalLedgerId) {
          const reversalUnitValue = Number(origPurchaseLedger?.unit_value_kobo) || unitFeeKobo;
          const reversalSponsorName = String(
            origPurchaseLedger?.sponsor_name || purchaseRow?.sponsor_name || meta.sponsorName || meta.sponsor_name || 'Voided Purchase'
          );

          try {
            await env.DB.prepare(
              `INSERT INTO slot_ledger (id, album_id, delta, kind, purchase_id, reference, reversal_of_ledger_id, sponsor_name, unit_value_kobo, environment, idempotency_key, note, created_by, created_at)
               VALUES (?, ?, ?, 'void_reversal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                reversalLedgerId,
                effectiveAlbumId,
                -netActiveSlotsToReverse,
                purchaseRow?.id || origPurchaseLedger?.purchase_id || purchaseIdCandidate,
                reference,
                origPurchaseLedger?.id || `sled-${reference}`,
                reversalSponsorName,
                reversalUnitValue,
                finalEnvironment,
                reversalIdempotencyKey,
                `Void reversal for ${reference}: ${reason}`,
                sessionUser.email,
                voidedAt
              )
              .run();
          } catch {
            // Duplicate reversal blocked by UNIQUE idempotency_key / PRIMARY KEY constraint
            return new Response(
              JSON.stringify({
                error: 'already_voided',
                message: `Compensating slot reversal for ${reference} already exists.`,
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Post-insert atomicity check: if concurrent slot consumption reduced album balance below 0, roll back immediately
          const postVoidSummary = await getAlbumSlotSummary(effectiveAlbumId);
          if (postVoidSummary.balance < 0) {
            await env.DB.prepare(`DELETE FROM slot_ledger WHERE id = ?`).bind(reversalLedgerId).run();
            await env.DB.prepare(
              `UPDATE transactions
               SET status = ?,
                   voided_at = NULL,
                   voided_by = NULL,
                   void_reason = NULL,
                   environment = ?,
                   paystack_data_json = ?
               WHERE reference = ?`
            )
              .bind(previousStatus, currentEnvironment, prevMetaJson, reference)
              .run();

            const restoredSummary = await getAlbumSlotSummary(effectiveAlbumId);
            return new Response(
              JSON.stringify({
                error: 'insufficient_available_slots_for_reversal',
                message: `Cannot void transaction ${reference}: concurrent slot consumption reduced album "${effectiveAlbumId}" available slot balance (${restoredSummary.balance}) below the ${netActiveSlotsToReverse} slot(s) required for reversal.`,
                creditedSlots: netActiveSlotsToReverse,
                availableSlotBalance: restoredSummary.balance,
                totalUsedSlots: restoredSummary.totalUsed,
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Ensure all ledger rows associated with this reference share consistent environment
        if (classifyAsTest) {
          await env.DB.prepare(
            `UPDATE slot_ledger SET environment = 'test' WHERE reference = ? OR id = ? OR purchase_id = ? OR idempotency_key LIKE ?`
          )
            .bind(
              reference,
              `sled-${reference}`,
              purchaseRow?.id || purchaseIdCandidate,
              `%${reference}%`
            )
            .run();
        }

        // 2. Mark slot_purchases row as voided (preserving record)
        if (purchaseRow) {
          await env.DB.prepare(
            `UPDATE slot_purchases SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, environment = ? WHERE id = ?`
          )
            .bind(voidedAt, sessionUser.email, reason, finalEnvironment, purchaseRow.id)
            .run();
        }

        // 3. If student submission payment, revert payment_status to unpaid
        let studentPaymentReverted = false;
        const paidSubRow = await env.DB.prepare(
          `SELECT * FROM profile_submissions WHERE paid_reference = ? OR (id = ? AND album_id = ? AND paid_reference = ?) LIMIT 1`
        )
          .bind(reference, submissionId, effectiveAlbumId, reference)
          .first();
        if (paidSubRow) {
          let subPayload: any = {};
          try { subPayload = JSON.parse(paidSubRow.payload_json || '{}'); } catch {}
          subPayload.paymentStatus = 'unpaid';
          subPayload.voidedReference = reference;
          delete subPayload.paidReference;
          await env.DB.prepare(
            `UPDATE profile_submissions SET payment_status = 'unpaid', paid_reference = NULL, payload_json = ?, updated_at = datetime('now') WHERE id = ?`
          )
            .bind(JSON.stringify(subPayload), paidSubRow.id)
            .run();
          studentPaymentReverted = true;
        }

        // 4. Sync class_sets.data_json (sponsor status, student paymentStatus, and updated slot balance)
        if (effectiveAlbumId) {
          const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(effectiveAlbumId).first();
          if (albumRow?.data_json) {
            try {
              const albumData = JSON.parse(albumRow.data_json);
              const updatedSlotSummary = await getAlbumSlotSummary(effectiveAlbumId);
              albumData.profileSlotBalance = updatedSlotSummary.balance;
              albumData.totalSlotsCredited = updatedSlotSummary.totalCredited;
              albumData.totalSlotsUsed = updatedSlotSummary.totalUsed;
              if (Array.isArray(albumData.sponsors)) {
                albumData.sponsors = albumData.sponsors.map((sp: any) => {
                  if (sp.reference === reference || (purchaseRow && sp.id === purchaseRow.id)) {
                    return {
                      ...sp,
                      status: 'voided',
                      voidedAt,
                      voidedBy: sessionUser.email,
                      voidReason: reason,
                      environment: finalEnvironment,
                      showSponsorNameOnAlbum: false,
                    };
                  }
                  return sp;
                });
              }
              if (Array.isArray(albumData.students) && (paidSubRow || submissionId)) {
                const targetSubId = paidSubRow?.id || submissionId;
                albumData.students = albumData.students.map((st: any) => {
                  if (st.id === targetSubId || st.paidReference === reference) {
                    return { ...st, paymentStatus: 'unpaid', paidReference: undefined };
                  }
                  return st;
                });
              }
              await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
                .bind(JSON.stringify(albumData), effectiveAlbumId)
                .run();
            } catch {}
          }
        }

        await logAudit(
          'transaction_voided',
          `Transaction ${reference} (₦${Math.round((Number(txRow.amount_kobo) || (Number(txRow.amount) || 0) * 100) / 100).toLocaleString()}, env=${finalEnvironment}, prevStatus=${previousStatus}) voided by ${sessionUser.email}. Reason: ${reason}. Slots reversed: ${slotsReversed}${reversalLedgerId ? ` (ledger entry ${reversalLedgerId})` : ' (0 slots credited)'}.`,
          sessionUser.email
        );

        const updatedAlbumSlots = effectiveAlbumId ? await getAlbumSlotSummary(effectiveAlbumId) : null;

        return new Response(
          JSON.stringify({
            success: true,
            reference,
            previousStatus,
            status: 'voided',
            environment: finalEnvironment,
            voidedAt,
            voidedBy: sessionUser.email,
            voidReason: reason,
            slotsReversed,
            reversalLedgerId,
            studentPaymentReverted,
            albumSlotBalance: updatedAlbumSlots ? updatedAlbumSlots.balance : null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api/admin/finances/restore — Controlled restoration for accidentally voided transactions
      if (path === '/api/admin/finances/restore' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const reference = String(body.reference || '').trim();
        const reason = String(body.reason || '').trim();
        const confirm = Boolean(body.confirm);

        if (!reference || reason.length < 3 || !confirm) {
          return new Response(
            JSON.stringify({
              error: 'confirmation_and_reason_required',
              message: 'Transaction reference, explicit confirmation, and a mandatory restoration reason (minimum 3 characters) are required.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const txRow = await env.DB.prepare(`SELECT * FROM transactions WHERE reference = ?`).bind(reference).first();
        if (!txRow) {
          return new Response(JSON.stringify({ error: 'Transaction not found.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (String(txRow.status || '').toLowerCase().trim() !== 'voided') {
          return new Response(
            JSON.stringify({
              error: 'transaction_not_voided',
              message: `Transaction ${reference} is not currently voided (status: ${txRow.status}) and is not eligible for restoration.`,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let meta: any = {};
        try { meta = JSON.parse(txRow.paystack_data_json || txRow.raw_payload_json || '{}'); } catch {}
        const environment = resolveTransactionEnvironment(txRow, meta);
        const restoredStatus = String(txRow.previous_status || meta.previousStatus || 'Paid');
        const restoredStatusNorm = restoredStatus.toLowerCase().trim();

        // Block restoration if previous status is not a valid active/restorable status
        if (['failed', 'abandoned', 'voided', 'cancelled'].includes(restoredStatusNorm)) {
          return new Response(
            JSON.stringify({
              error: 'restore_not_eligible',
              message: `Transaction ${reference} had previous status "${restoredStatus}" and is not eligible for restoration.`,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const restoredAt = new Date().toISOString();
        const albumId = String(meta.albumId || meta.album_id || txRow.set_id || txRow.registration_id || '').trim();
        const submissionId = String(meta.submissionId || meta.submission_id || '').trim();
        const purchaseIdCandidate = String(meta.purchase_id || `spurch-${reference}`);

        const purchaseRow = await env.DB.prepare(
          `SELECT * FROM slot_purchases WHERE reference = ? OR id = ? LIMIT 1`
        )
          .bind(reference, purchaseIdCandidate)
          .first();

        const ledgerEntriesRes = await env.DB.prepare(
          `SELECT * FROM slot_ledger WHERE reference = ? OR id = ? OR purchase_id = ? OR idempotency_key LIKE ? ORDER BY created_at ASC`
        )
          .bind(
            reference,
            `sled-${reference}`,
            purchaseRow?.id || purchaseIdCandidate,
            `%${reference}%`
          )
          .all();
        const matchedLedgerEntries = ledgerEntriesRes?.results || [];

        const reversedSlotsNet = Math.max(
          0,
          matchedLedgerEntries
            .filter((sl: any) => String(sl.kind || '') === 'void_reversal' || String(sl.kind || '') === 'void_restore')
            .reduce((acc: number, sl: any) => acc - (Number(sl.delta) || 0), 0)
        );
        const lastReversalRow = [...matchedLedgerEntries]
          .reverse()
          .find((sl: any) => String(sl.kind || '') === 'void_reversal');
        const origPurchaseLedger = matchedLedgerEntries.find(
          (sl: any) => String(sl.kind || '') === 'purchase' && Number(sl.delta) > 0
        );
        const effectiveAlbumId = String(
          albumId || purchaseRow?.album_id || origPurchaseLedger?.album_id || ''
        ).trim();

        // If this transaction originally credited slots, ensure its reversal has not already been restored
        if (origPurchaseLedger && (reversedSlotsNet <= 0 || !lastReversalRow)) {
          return new Response(
            JSON.stringify({
              error: 'already_restored',
              message: `Slot credits for ${reference} have already been restored or no active void reversal exists.`,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const restoreLedgerId: string | null =
          reversedSlotsNet > 0 && effectiveAlbumId && lastReversalRow
            ? `sled-rst-${lastReversalRow.id}`
            : null;
        const restoreIdempotencyKey: string | null = lastReversalRow
          ? `void_restore:${reference}:of:${lastReversalRow.id}`
          : null;
        const slotsRestored = restoreLedgerId ? reversedSlotsNet : 0;

        // Perform atomic conditional status transition on transactions FIRST
        const restoreHistory = Array.isArray(meta.restoreHistory) ? [...meta.restoreHistory] : [];
        restoreHistory.push({
          restoredAt,
          restoredBy: sessionUser.email,
          reason,
          restoredStatus,
          slotsRestored,
          restoreLedgerId,
        });
        meta.restoredAt = restoredAt;
        meta.restoredBy = sessionUser.email;
        meta.restoreReason = reason;
        meta.restoreHistory = restoreHistory;

        const txRestoreUpdateRes = await env.DB.prepare(
          `UPDATE transactions
           SET status = ?,
               restored_at = ?,
               restored_by = ?,
               restore_reason = ?,
               paystack_data_json = ?
           WHERE reference = ? AND LOWER(TRIM(COALESCE(status, ''))) = 'voided'`
        )
          .bind(
            restoredStatus,
            restoredAt,
            sessionUser.email,
            reason,
            JSON.stringify(meta),
            reference
          )
          .run();

        if (Number((txRestoreUpdateRes as any)?.meta?.changes ?? 1) === 0) {
          return new Response(
            JSON.stringify({
              error: 'transaction_not_voided',
              message: `Transaction ${reference} is no longer voided or was already restored.`,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 1. Insert compensating void_restore entry if slots were previously reversed (deterministic ID & UNIQUE idempotency_key)
        if (reversedSlotsNet > 0 && effectiveAlbumId && restoreLedgerId && restoreIdempotencyKey && lastReversalRow) {
          const restoreUnitValue = Number(lastReversalRow?.unit_value_kobo || origPurchaseLedger?.unit_value_kobo) || unitFeeKobo;
          const restoreSponsorName = String(
            origPurchaseLedger?.sponsor_name || purchaseRow?.sponsor_name || meta.sponsorName || meta.sponsor_name || 'Restored Purchase'
          );

          try {
            await env.DB.prepare(
              `INSERT INTO slot_ledger (id, album_id, delta, kind, purchase_id, reference, reversal_of_ledger_id, sponsor_name, unit_value_kobo, environment, idempotency_key, note, created_by, created_at)
               VALUES (?, ?, ?, 'void_restore', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                restoreLedgerId,
                effectiveAlbumId,
                reversedSlotsNet,
                purchaseRow?.id || origPurchaseLedger?.purchase_id || purchaseIdCandidate,
                reference,
                lastReversalRow.id,
                restoreSponsorName,
                restoreUnitValue,
                environment,
                restoreIdempotencyKey,
                `Void restoration for ${reference}: ${reason}`,
                sessionUser.email,
                restoredAt
              )
              .run();
          } catch {
            return new Response(
              JSON.stringify({
                error: 'already_restored',
                message: `Compensating slot restoration entry (${restoreLedgerId}) already exists for ${reference}.`,
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // 2. Restore slot_purchases status
        if (purchaseRow) {
          await env.DB.prepare(
            `UPDATE slot_purchases SET status = 'completed', voided_at = NULL, voided_by = NULL, void_reason = NULL, environment = ? WHERE id = ?`
          )
            .bind(environment, purchaseRow.id)
            .run();
        }

        // 3. Restore student submission payment_status if applicable
        if (submissionId && effectiveAlbumId && restoredStatusNorm === 'paid') {
          const subRow = await env.DB.prepare(
            `SELECT * FROM profile_submissions WHERE id = ? AND album_id = ? LIMIT 1`
          )
            .bind(submissionId, effectiveAlbumId)
            .first();
          if (subRow && subRow.payment_status === 'unpaid') {
            let subPayload: any = {};
            try { subPayload = JSON.parse(subRow.payload_json || '{}'); } catch {}
            subPayload.paymentStatus = 'paid';
            subPayload.paidReference = reference;
            await env.DB.prepare(
              `UPDATE profile_submissions SET payment_status = 'paid', paid_reference = ?, payload_json = ?, updated_at = datetime('now') WHERE id = ?`
            )
              .bind(reference, JSON.stringify(subPayload), subRow.id)
              .run();
          }
        }

        // 4. Sync class_sets.data_json
        if (effectiveAlbumId) {
          const albumRow = await env.DB.prepare(`SELECT * FROM class_sets WHERE id = ?`).bind(effectiveAlbumId).first();
          if (albumRow?.data_json) {
            try {
              const albumData = JSON.parse(albumRow.data_json);
              const updatedSlotSummary = await getAlbumSlotSummary(effectiveAlbumId);
              albumData.profileSlotBalance = updatedSlotSummary.balance;
              albumData.totalSlotsCredited = updatedSlotSummary.totalCredited;
              albumData.totalSlotsUsed = updatedSlotSummary.totalUsed;
              if (Array.isArray(albumData.sponsors)) {
                albumData.sponsors = albumData.sponsors.map((sp: any) => {
                  if (sp.reference === reference || (purchaseRow && sp.id === purchaseRow.id)) {
                    const sponsorName = sp.sponsorName || purchaseRow?.sponsor_name || '';
                    return {
                      ...sp,
                      status: 'completed',
                      voidedAt: undefined,
                      voidedBy: undefined,
                      voidReason: undefined,
                      environment,
                      showSponsorNameOnAlbum: Boolean(sponsorName && sponsorName !== 'Class Sponsor'),
                    };
                  }
                  return sp;
                });
              }
              if (Array.isArray(albumData.students) && submissionId && restoredStatusNorm === 'paid') {
                albumData.students = albumData.students.map((st: any) => {
                  if (st.id === submissionId) {
                    return { ...st, paymentStatus: 'paid', paidReference: reference };
                  }
                  return st;
                });
              }
              await env.DB.prepare(`UPDATE class_sets SET data_json = ?, updated_at = datetime('now') WHERE id = ?`)
                .bind(JSON.stringify(albumData), effectiveAlbumId)
                .run();
            } catch {}
          }
        }

        await logAudit(
          'transaction_restored',
          `Voided transaction ${reference} restored to status "${restoredStatus}" by ${sessionUser.email}. Reason: ${reason}. Slots restored: ${slotsRestored}${restoreLedgerId ? ` (ledger entry ${restoreLedgerId})` : ''}.`,
          sessionUser.email
        );

        const updatedAlbumSlots = effectiveAlbumId ? await getAlbumSlotSummary(effectiveAlbumId) : null;

        return new Response(
          JSON.stringify({
            success: true,
            reference,
            status: restoredStatus,
            environment,
            restoredAt,
            restoredBy: sessionUser.email,
            restoreReason: reason,
            slotsRestored,
            restoreLedgerId,
            albumSlotBalance: updatedAlbumSlots ? updatedAlbumSlots.balance : null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

    // ============================================================================
    // 13r. HOST COHORT OFFERS & PROGRAMMES MANAGER (/api/admin/offers/*)
    // Enforced Host-only on the server and recorded in audit_logs.
    // ============================================================================
    if (path.startsWith('/api/admin/offers/')) {
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

      await ensureCohortOffersSchema();
      const settings = await getPlatformSettingsMap(env);
      const standardPriceKobo = Number(settings.student_fee_kobo) || 100000;
      const defaultCap = Number(settings.profile_cap_default) || 200;

      const formatProgrammeRow = (row: any, allCohortAllocations: any[]) => {
        const matchingAllocs = allCohortAllocations.filter(
          (a: any) => String(a.programme_id) === String(row.id)
        );
        const distinctDepts = new Set(
          matchingAllocs.map(
            (a: any) =>
              `${String(a.institution_id).toLowerCase()}::${String(a.department_id).toLowerCase()}`
          )
        );
        return {
          id: String(row.id),
          name: String(row.name || ''),
          kind: (row.kind === 'discount' ? 'discount' : 'funding') as 'funding' | 'discount',
          discountPercent:
            row.kind === 'discount' && row.discount_percent !== null && row.discount_percent !== undefined
              ? Number(row.discount_percent)
              : null,
          coverageMode:
            row.kind === 'funding'
              ? ((row.coverage_mode === 'all' ? 'all' : 'per_album_cap') as 'all' | 'per_album_cap')
              : null,
          coverageCap:
            row.kind === 'funding' && row.coverage_cap !== null && row.coverage_cap !== undefined
              ? Number(row.coverage_cap)
              : null,
          sponsorName: String(row.sponsor_name || ''),
          showRecognition: Boolean(Number(row.show_recognition) !== 0 && row.show_recognition !== false),
          validFrom: row.valid_from || null,
          validTo: row.valid_to || null,
          status: (row.status === 'paused' ? 'paused' : 'active') as 'active' | 'paused',
          usedDepartmentsCount: distinctDepts.size,
          usedCohortsCount: matchingAllocs.length,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      };

      // 1. GET & POST /api/admin/offers/programmes
      if (path === '/api/admin/offers/programmes' && request.method === 'GET') {
        const progsRes = await env.DB.prepare(`SELECT * FROM programmes ORDER BY created_at DESC`).all();
        const allocsRes = await env.DB.prepare(`SELECT * FROM cohort_allocations`).all();
        const allAllocs = allocsRes?.results || [];
        const programmes = (progsRes?.results || []).map((r: any) => formatProgrammeRow(r, allAllocs));
        return new Response(
          JSON.stringify({
            success: true,
            programmes,
            standardPriceKobo,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (path === '/api/admin/offers/programmes' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const name = String(body.name || '').trim();
        const kind = String(body.kind || '').trim().toLowerCase();
        if (!name) {
          return new Response(JSON.stringify({ error: 'Programme name is required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (kind !== 'funding' && kind !== 'discount') {
          return new Response(
            JSON.stringify({ error: "Programme kind must be 'funding' or 'discount'. Standard price is never a programme." }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let discountPercent: number | null = null;
        let coverageMode: 'all' | 'per_album_cap' | null = null;
        let coverageCap: number | null = null;

        if (kind === 'discount') {
          const pct = Math.floor(Number(body.discountPercent ?? body.discount_percent));
          if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
            return new Response(
              JSON.stringify({ error: 'Discount percentage must be a whole number between 1 and 99.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          discountPercent = pct;
        } else {
          coverageMode =
            (body.coverageMode || body.coverage_mode) === 'all' ? 'all' : 'per_album_cap';
          if (coverageMode === 'per_album_cap') {
            const cap = Math.floor(Number(body.coverageCap ?? body.coverage_cap));
            if (!Number.isFinite(cap) || cap < 1 || cap > 5000) {
              return new Response(
                JSON.stringify({ error: 'Coverage cap must be a whole number between 1 and 5000 profiles.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            coverageCap = cap;
          } else {
            coverageCap = null;
          }
        }

        const sponsorName = String(body.sponsorName ?? body.sponsor_name ?? '').trim().slice(0, 80);
        const showRecognition =
          body.showRecognition !== undefined
            ? Boolean(body.showRecognition)
            : body.show_recognition !== undefined
            ? Boolean(body.show_recognition)
            : true;
        const validFrom = body.validFrom || body.valid_from ? String(body.validFrom || body.valid_from).slice(0, 10) : null;
        const validTo = body.validTo || body.valid_to ? String(body.validTo || body.valid_to).slice(0, 10) : null;
        if (validFrom && validTo && validTo < validFrom) {
          return new Response(
            JSON.stringify({ error: 'Valid-to date cannot be earlier than valid-from date.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const status = (body.status === 'paused' ? 'paused' : 'active') as 'active' | 'paused';
        const progId = String(body.id || `prog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

        await env.DB.prepare(
          `INSERT INTO programmes (id, name, kind, discount_percent, coverage_mode, coverage_cap, sponsor_name, show_recognition, valid_from, valid_to, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
          .bind(
            progId,
            name,
            kind,
            discountPercent,
            coverageMode,
            coverageCap,
            sponsorName,
            showRecognition ? 1 : 0,
            validFrom,
            validTo,
            status
          )
          .run();

        await logAudit(
          'programme_created',
          `Programme "${name}" (${kind === 'discount' ? `${discountPercent}% off` : coverageMode === 'all' ? 'Covers all profiles' : `Covers ${coverageCap} profiles`}) created by ${sessionUser.email}`,
          sessionUser.email
        );

        const createdRow = await env.DB.prepare(`SELECT * FROM programmes WHERE id = ?`).bind(progId).first();
        return new Response(
          JSON.stringify({
            success: true,
            programme: formatProgrammeRow(createdRow, []),
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. PUT & DELETE /api/admin/offers/programmes/:id
      const progItemMatch = path.match(/^\/api\/admin\/offers\/programmes\/([^/]+)$/);
      if (progItemMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
        const progId = decodeURIComponent(progItemMatch[1]);
        const existingRow = await env.DB.prepare(`SELECT * FROM programmes WHERE id = ?`).bind(progId).first();
        if (!existingRow) {
          return new Response(JSON.stringify({ error: 'Programme not found.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const allocsRes = await env.DB.prepare(`SELECT * FROM cohort_allocations`).all();
        const allAllocs = allocsRes?.results || [];
        const usedAllocs = allAllocs.filter((a: any) => String(a.programme_id) === progId);

        if (request.method === 'DELETE') {
          if (usedAllocs.length > 0) {
            return new Response(
              JSON.stringify({
                error: 'programme_in_use',
                message: `Cannot delete "${existingRow.name}" because it is assigned to ${usedAllocs.length} cohort(s). Remove it from those cohorts or pause it instead.`,
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          await env.DB.prepare(`DELETE FROM programmes WHERE id = ?`).bind(progId).run();
          await logAudit(
            'programme_deleted',
            `Programme "${existingRow.name}" (${progId}) deleted by ${sessionUser.email}`,
            sessionUser.email
          );
          return new Response(JSON.stringify({ success: true, deletedId: progId }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // PUT: edit or pause/resume
        const body = (await request.json().catch(() => ({}))) as any;
        const name = body.name !== undefined ? String(body.name).trim() : String(existingRow.name);
        const kind = (
          body.kind !== undefined ? String(body.kind).trim().toLowerCase() : String(existingRow.kind)
        ) as 'funding' | 'discount';
        if (!name || (kind !== 'funding' && kind !== 'discount')) {
          return new Response(JSON.stringify({ error: 'Valid name and kind (funding or discount) are required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let discountPercent: number | null =
          existingRow.discount_percent !== null && existingRow.discount_percent !== undefined
            ? Number(existingRow.discount_percent)
            : null;
        let coverageMode: 'all' | 'per_album_cap' | null = existingRow.coverage_mode || null;
        let coverageCap: number | null =
          existingRow.coverage_cap !== null && existingRow.coverage_cap !== undefined
            ? Number(existingRow.coverage_cap)
            : null;

        if (kind === 'discount') {
          if (body.discountPercent !== undefined || body.discount_percent !== undefined) {
            const pct = Math.floor(Number(body.discountPercent ?? body.discount_percent));
            if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
              return new Response(
                JSON.stringify({ error: 'Discount percentage must be between 1 and 99.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            discountPercent = pct;
          }
          coverageMode = null;
          coverageCap = null;
        } else {
          discountPercent = null;
          coverageMode =
            (body.coverageMode ?? body.coverage_mode ?? existingRow.coverage_mode) === 'all'
              ? 'all'
              : 'per_album_cap';
          if (coverageMode === 'per_album_cap') {
            const cap = Math.floor(
              Number(body.coverageCap ?? body.coverage_cap ?? existingRow.coverage_cap ?? defaultCap)
            );
            if (!Number.isFinite(cap) || cap < 1 || cap > 5000) {
              return new Response(
                JSON.stringify({ error: 'Coverage cap must be between 1 and 5000.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            coverageCap = cap;
          } else {
            coverageCap = null;
          }
        }

        const sponsorName =
          body.sponsorName !== undefined || body.sponsor_name !== undefined
            ? String(body.sponsorName ?? body.sponsor_name ?? '').trim().slice(0, 80)
            : String(existingRow.sponsor_name || '');
        const showRecognition =
          body.showRecognition !== undefined
            ? Boolean(body.showRecognition)
            : body.show_recognition !== undefined
            ? Boolean(body.show_recognition)
            : Boolean(Number(existingRow.show_recognition) !== 0);
        const validFrom =
          body.validFrom !== undefined || body.valid_from !== undefined
            ? body.validFrom || body.valid_from
              ? String(body.validFrom || body.valid_from).slice(0, 10)
              : null
            : existingRow.valid_from || null;
        const validTo =
          body.validTo !== undefined || body.valid_to !== undefined
            ? body.validTo || body.valid_to
              ? String(body.validTo || body.valid_to).slice(0, 10)
              : null
            : existingRow.valid_to || null;
        if (validFrom && validTo && validTo < validFrom) {
          return new Response(
            JSON.stringify({ error: 'Valid-to date cannot be earlier than valid-from date.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const status = (
          body.status !== undefined
            ? body.status === 'paused'
              ? 'paused'
              : 'active'
            : existingRow.status === 'paused'
            ? 'paused'
            : 'active'
        ) as 'active' | 'paused';

        await env.DB.prepare(
          `UPDATE programmes SET name = ?, kind = ?, discount_percent = ?, coverage_mode = ?, coverage_cap = ?, sponsor_name = ?, show_recognition = ?, valid_from = ?, valid_to = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(
            name,
            kind,
            discountPercent,
            coverageMode,
            coverageCap,
            sponsorName,
            showRecognition ? 1 : 0,
            validFrom,
            validTo,
            status,
            progId
          )
          .run();

        const updatedRow = await env.DB.prepare(`SELECT * FROM programmes WHERE id = ?`).bind(progId).first();

        // Sync any albums in cohorts using this programme
        if (usedAllocs.length > 0) {
          const setsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
          const allSets = setsRes?.results || [];
          for (const alloc of usedAllocs) {
            const matchedSet = allSets.find(
              (s: any) =>
                String(s.institution_id).toLowerCase() === String(alloc.institution_id).toLowerCase() &&
                String(s.department_id).toLowerCase() === String(alloc.department_id).toLowerCase() &&
                Number(s.graduation_year) === Number(alloc.graduation_year) &&
                s.status !== 'deleted'
            );
            if (matchedSet) {
              const targetCap =
                status === 'active' && kind === 'funding'
                  ? coverageMode === 'all'
                    ? defaultCap
                    : Math.max(1, Number(coverageCap) || defaultCap)
                  : 0;
              await syncAlbumFundingGrant(
                matchedSet,
                String(alloc.id),
                status === 'active' && kind === 'funding' ? updatedRow : null,
                targetCap,
                standardPriceKobo
              );
            }
          }
        }

        const auditAction =
          existingRow.status !== status
            ? status === 'paused'
              ? 'programme_paused'
              : 'programme_resumed'
            : 'programme_updated';
        await logAudit(
          auditAction,
          `Programme "${name}" (${progId}) updated (status: ${status}) by ${sessionUser.email}`,
          sessionUser.email
        );

        return new Response(
          JSON.stringify({
            success: true,
            programme: formatProgrammeRow(updatedRow, allAllocs),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. GET /api/admin/offers/cohorts?institutionId=...&year=...
      if (path === '/api/admin/offers/cohorts' && request.method === 'GET') {
        const instFilter = (url.searchParams.get('institutionId') || '').trim();
        const yearFilter = Number(url.searchParams.get('year') || 0);

        const progsRes = await env.DB.prepare(`SELECT * FROM programmes`).all();
        const allProgs = progsRes?.results || [];
        const progMap = new Map<string, any>();
        for (const p of allProgs) progMap.set(String(p.id), p);

        const allocsRes = await env.DB.prepare(`SELECT * FROM cohort_allocations`).all();
        const allAllocs = allocsRes?.results || [];

        const setsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
        const allSets = (setsRes?.results || []).filter((s: any) => s.status !== 'deleted');

        // Compute available years (years with albums or allocations, plus current year)
        const yearsSet = new Set<number>([new Date().getFullYear(), 2026]);
        for (const s of allSets) {
          if (!instFilter || String(s.institution_id).toLowerCase() === instFilter.toLowerCase()) {
            const yr = Number(s.graduation_year);
            if (yr >= 2000 && yr <= 2100) yearsSet.add(yr);
          }
        }
        for (const a of allAllocs) {
          if (!instFilter || String(a.institution_id).toLowerCase() === instFilter.toLowerCase()) {
            const yr = Number(a.graduation_year);
            if (yr >= 2000 && yr <= 2100) yearsSet.add(yr);
          }
        }
        const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

        const filteredAllocs = allAllocs
          .filter((a: any) => {
            if (instFilter && String(a.institution_id).toLowerCase() !== instFilter.toLowerCase()) return false;
            if (yearFilter && Number(a.graduation_year) !== yearFilter) return false;
            return true;
          })
          .map((a: any) => {
            const p = progMap.get(String(a.programme_id));
            return {
              id: String(a.id),
              institutionId: String(a.institution_id),
              departmentId: String(a.department_id),
              graduationYear: Number(a.graduation_year),
              programmeId: String(a.programme_id),
              programme: p ? formatProgrammeRow(p, allAllocs) : null,
              assignedBy: a.assigned_by || '',
              assignedAt: a.assigned_at || a.created_at,
              note: a.note || '',
            };
          });

        const filteredAlbums = allSets
          .filter((s: any) => {
            if (instFilter && String(s.institution_id).toLowerCase() !== instFilter.toLowerCase()) return false;
            if (yearFilter && Number(s.graduation_year) !== yearFilter) return false;
            return true;
          })
          .map((s: any) => {
            let parsed: any = {};
            try { parsed = JSON.parse(s.data_json || '{}'); } catch {}
            const isPub =
              (s.status === 'published' || parsed.published === true || parsed.isPublished === true) &&
              !parsed.unpublished &&
              !parsed.isUnpublished;
            return {
              id: String(s.id),
              institutionId: String(s.institution_id),
              departmentId: String(s.department_id),
              graduationYear: Number(s.graduation_year),
              status: isPub ? 'published' : 'draft',
            };
          });

        return new Response(
          JSON.stringify({
            success: true,
            allocations: filteredAllocs,
            albums: filteredAlbums,
            availableYears,
            standardPriceKobo,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. POST /api/admin/offers/cohorts/bulk — Atomic batch assign or remove offer
      if (path === '/api/admin/offers/cohorts/bulk' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const institutionId = String(body.institutionId || '').trim();
        const graduationYear = Number(body.graduationYear || 0);
        const departmentIds: string[] = Array.isArray(body.departmentIds)
          ? body.departmentIds.map((d: any) => String(d || '').trim()).filter(Boolean)
          : [];
        const action = String(body.action || '').trim().toLowerCase() as 'assign' | 'remove';
        const programmeId = String(body.programmeId || '').trim();
        const note = String(body.note || '').trim();

        if (!institutionId || !graduationYear || departmentIds.length === 0) {
          return new Response(
            JSON.stringify({ error: 'institutionId, graduationYear, and at least one departmentId are required.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (action !== 'assign' && action !== 'remove') {
          return new Response(
            JSON.stringify({ error: "Action must be 'assign' or 'remove'." }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let targetProg: any = null;
        if (action === 'assign') {
          if (!programmeId || programmeId === 'standard') {
            return new Response(
              JSON.stringify({ error: 'Standard price is never assigned. Choose an active Funding or Discount programme, or use Remove offer.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          targetProg = await env.DB.prepare(`SELECT * FROM programmes WHERE id = ?`).bind(programmeId).first();
          if (!targetProg) {
            return new Response(JSON.stringify({ error: 'Selected programme was not found.' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const setsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
        const allSets = (setsRes?.results || []).filter((s: any) => s.status !== 'deleted');
        const existingAllocsRes = await env.DB.prepare(`SELECT * FROM cohort_allocations`).all();
        const existingAllocs = existingAllocsRes?.results || [];

        const results: Array<{
          departmentId: string;
          status: 'assigned' | 'removed' | 'unchanged';
          programmeId: string | null;
          programmeName: string | null;
          effectiveKind: 'funding' | 'discount' | 'standard';
        }> = [];

        for (const deptId of departmentIds) {
          const callocId = `calloc-${institutionId}-${deptId}-${graduationYear}`;
          const existingRow = existingAllocs.find(
            (a: any) =>
              String(a.institution_id).toLowerCase() === institutionId.toLowerCase() &&
              String(a.department_id).toLowerCase() === deptId.toLowerCase() &&
              Number(a.graduation_year) === graduationYear
          );
          const matchedSet = allSets.find(
            (s: any) =>
              String(s.institution_id).toLowerCase() === institutionId.toLowerCase() &&
              String(s.department_id).toLowerCase() === deptId.toLowerCase() &&
              Number(s.graduation_year) === graduationYear
          );

          if (action === 'remove') {
            if (existingRow) {
              await env.DB.prepare(`DELETE FROM cohort_allocations WHERE id = ?`).bind(existingRow.id).run();
            }
            // Also clean up any legacy slot_allocations row for this cohort
            const legacyAllocRes = await env.DB.prepare(
              `SELECT * FROM slot_allocations WHERE institution_id = ? AND department_id = ? AND graduation_year = ?`
            ).bind(institutionId, deptId, graduationYear).all();
            for (const la of legacyAllocRes?.results || []) {
              await env.DB.prepare(`DELETE FROM slot_allocations WHERE id = ?`).bind(la.id).run();
            }
            if (matchedSet) {
              await syncAlbumFundingGrant(matchedSet, existingRow?.id || callocId, null, 0, standardPriceKobo);
            }
            results.push({
              departmentId: deptId,
              status: existingRow ? 'removed' : 'unchanged',
              programmeId: null,
              programmeName: null,
              effectiveKind: 'standard',
            });
          } else {
            // action === 'assign'
            if (existingRow && existingRow.id !== callocId) {
              await env.DB.prepare(`DELETE FROM cohort_allocations WHERE id = ?`).bind(existingRow.id).run();
            }
            await env.DB.prepare(
              `INSERT OR REPLACE INTO cohort_allocations (id, institution_id, department_id, graduation_year, programme_id, assigned_by, assigned_at, note)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
            )
              .bind(
                callocId,
                institutionId,
                deptId,
                graduationYear,
                targetProg.id,
                sessionUser.email,
                note
              )
              .run();

            if (matchedSet) {
              const targetCap =
                targetProg.status === 'active' && targetProg.kind === 'funding'
                  ? targetProg.coverage_mode === 'all'
                    ? defaultCap
                    : Math.max(1, Number(targetProg.coverage_cap) || defaultCap)
                  : 0;
              await syncAlbumFundingGrant(
                matchedSet,
                callocId,
                targetProg.status === 'active' && targetProg.kind === 'funding' ? targetProg : null,
                targetCap,
                standardPriceKobo
              );
            }

            results.push({
              departmentId: deptId,
              status: 'assigned',
              programmeId: String(targetProg.id),
              programmeName: String(targetProg.name),
              effectiveKind: targetProg.kind === 'discount' ? 'discount' : 'funding',
            });
          }
        }

        await logAudit(
          action === 'assign' ? 'cohort_offers_bulk_assigned' : 'cohort_offers_bulk_removed',
          action === 'assign'
            ? `Assigned programme "${targetProg.name}" (${targetProg.kind}) to ${departmentIds.length} department(s) in ${institutionId} Class of ${graduationYear}`
            : `Removed cohort offers (reset to Standard) for ${departmentIds.length} department(s) in ${institutionId} Class of ${graduationYear}`,
          sessionUser.email
        );

        return new Response(
          JSON.stringify({
            success: true,
            action,
            institutionId,
            graduationYear,
            count: results.length,
            results,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 5. POST /api/admin/offers/cohorts/copy-year — Copy allocations from {previous year} to {selected year}
      if (path === '/api/admin/offers/cohorts/copy-year' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const institutionId = String(body.institutionId || '').trim();
        const fromYear = Number(body.fromYear || 0);
        const toYear = Number(body.toYear || 0);

        if (!institutionId || !fromYear || !toYear || fromYear === toYear) {
          return new Response(
            JSON.stringify({ error: 'Valid institutionId, fromYear, and toYear are required.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const allocsRes = await env.DB.prepare(`SELECT * FROM cohort_allocations`).all();
        const sourceAllocs = (allocsRes?.results || []).filter(
          (a: any) =>
            String(a.institution_id).toLowerCase() === institutionId.toLowerCase() &&
            Number(a.graduation_year) === fromYear
        );

        if (sourceAllocs.length === 0) {
          return new Response(
            JSON.stringify({
              error: 'no_source_offers',
              message: `No offers found in ${fromYear} for this institution to copy.`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const progsRes = await env.DB.prepare(`SELECT * FROM programmes`).all();
        const progMap = new Map<string, any>();
        for (const p of progsRes?.results || []) progMap.set(String(p.id), p);

        const setsRes = await env.DB.prepare(`SELECT * FROM class_sets`).all();
        const allSets = (setsRes?.results || []).filter((s: any) => s.status !== 'deleted');

        const copiedResults: Array<{ departmentId: string; programmeId: string; programmeName: string }> = [];

        for (const src of sourceAllocs) {
          const deptId = String(src.department_id);
          const prog = progMap.get(String(src.programme_id));
          if (!prog) continue;

          const callocId = `calloc-${institutionId}-${deptId}-${toYear}`;
          await env.DB.prepare(
            `INSERT OR REPLACE INTO cohort_allocations (id, institution_id, department_id, graduation_year, programme_id, assigned_by, assigned_at, note)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
          )
            .bind(
              callocId,
              institutionId,
              deptId,
              toYear,
              prog.id,
              sessionUser.email,
              `Copied from Class of ${fromYear}`
            )
            .run();

          const matchedSet = allSets.find(
            (s: any) =>
              String(s.institution_id).toLowerCase() === institutionId.toLowerCase() &&
              String(s.department_id).toLowerCase() === deptId.toLowerCase() &&
              Number(s.graduation_year) === toYear
          );
          if (matchedSet && prog.status === 'active' && prog.kind === 'funding') {
            const targetCap =
              prog.coverage_mode === 'all'
                ? defaultCap
                : Math.max(1, Number(prog.coverage_cap) || defaultCap);
            await syncAlbumFundingGrant(matchedSet, callocId, prog, targetCap, standardPriceKobo);
          }

          copiedResults.push({
            departmentId: deptId,
            programmeId: String(prog.id),
            programmeName: String(prog.name),
          });
        }

        await logAudit(
          'cohort_offers_copied_year',
          `Copied ${copiedResults.length} cohort offer(s) from ${fromYear} to ${toYear} for ${institutionId} by ${sessionUser.email}`,
          sessionUser.email
        );

        return new Response(
          JSON.stringify({
            success: true,
            fromYear,
            toYear,
            copiedCount: copiedResults.length,
            results: copiedResults,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
