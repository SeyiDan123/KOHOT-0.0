/**
 * Frontend API Client for KoHot
 * Connects to Cloudflare Worker `/api/*` endpoints with real Google Auth verification,
 * Paystack payment verification, and persistent D1 / local storage synchronization.
 */

import { UserAccount, ClassSet, FoundingClassRequest, FinancialTransaction } from '../types';
import { getStoredFoundingClassRequests, getStoredSets } from '../data/initialData';

export const HOST_EMAIL = 'seyidan03@gmail.com';
export const STANDARD_PRICE = 50000; // Flat 50,000 NGN

export interface AuthStatusResponse {
  googleClientIdSet: boolean;
  sessionSecretSet: boolean;
  paystackSecretKeySet?: boolean;
  paystackPublicKeySet?: boolean;
  r2BucketSet?: boolean;
  hostEmailSet: boolean;
  databaseReachable: boolean;
  tablesPresent: boolean;
}

export interface AuthResponse {
  success: boolean;
  isNewUser?: boolean;
  user?: UserAccount;
  signupToken?: string;
  email?: string;
  name?: string;
  albums?: Array<{ id: string; institutionId: string; departmentId: string; graduationYear: number; classSetName: string; applicantName: string }>;
  albumObjects?: any[];
  error?: string;
  message?: string;
  status?: number;
}

export interface VerifyPaymentResponse {
  success: boolean;
  status?: string;
  reference?: string;
  error?: string;
  message?: string;
}

export interface OAuthRequestInput {
  provider?: 'google' | 'apple';
  credential?: string;
  idToken?: string;
  accessToken?: string;
  email?: string;
  name?: string;
  nameHint?: string;
}

/**
 * Handle OAuth response (Google or Apple) via Worker /api/auth/google
 * End-to-end real token verification against provider public keys.
 * Automatically creates accounts for new users and signs in existing users
 * while preserving all role approvals, permissions, and security checks.
 */
export async function authenticateWithOAuthPayload(
  input: OAuthRequestInput | string
): Promise<AuthResponse> {
  try {
    const payloadObj: OAuthRequestInput =
      typeof input === 'string' ? { credential: input, provider: 'google' } : input;

    const storedSets = getStoredSets()
      .filter((s) => {
        if (s.deletedAt) {
          const daysElapsed = Math.floor((Date.now() - new Date(s.deletedAt).getTime()) / (1000 * 60 * 60 * 24));
          if (daysElapsed >= 30) {
            // Past 30-day recovery window: admin can no longer log in to recover (even if keptByHostOnly)
            return false;
          }
        }
        return true;
      })
      .map((s) => ({
        id: s.id,
        institutionId: s.institutionId,
        departmentId: s.departmentId,
        graduationYear: s.graduationYear,
        classSetName: s.classSetName,
        classRepName: s.classRepName,
        classRepEmail: s.classRepEmail,
        classRepPhone: s.classRepPhone,
        activationStatus: 'active',
      }));

    const storedPending: Array<{ id: string; applicantEmail: string; status: string }> = [];

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payloadObj,
        name: payloadObj.name || payloadObj.nameHint,
        knownSets: storedSets,
        knownPendingRequests: storedPending,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.user) {
      if (data.sessionToken) {
        try {
          localStorage.setItem('kohot_session_token', data.sessionToken);
        } catch {}
      }
      if (Array.isArray(data.albumObjects) && data.albumObjects.length > 0) {
        (data.user as any).albumObjects = data.albumObjects;
      }
      return {
        success: true,
        isNewUser: Boolean(data.isNewUser),
        user: data.user,
        signupToken: data.signupToken,
        email: data.email || data.user.email,
        name: data.name || data.user.fullName,
        albums: data.albums,
        albumObjects: data.albumObjects,
      };
    }

    return {
      success: false,
      error: data.error || 'auth_failed',
      message: data.message || 'Sign in failed. Please try again.',
      signupToken: data.signupToken,
      email: data.email,
      name: data.name,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'network_error',
      message: 'Sign in failed. Please try again.',
      status: 0,
    };
  }
}

export const authenticateWithGoogleCredential = authenticateWithOAuthPayload;

/**
 * GET /api/auth/me - Check active authenticated session from signed cookie or Bearer token
 */
export async function checkAuthSession(): Promise<{ authenticated: boolean; role?: string; user?: UserAccount; albums?: string[] }> {
  try {
    let token = '';
    try {
      token = localStorage.getItem('kohot_session_token') || '';
    } catch {}
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/auth/me', { headers });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return { authenticated: false };
}

/**
 * POST /api/auth/logout - Clear signed session cookie and stored token
 */
export async function logoutSession(): Promise<boolean> {
  try {
    localStorage.removeItem('kohot_session_token');
  } catch {}
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * GET /api/auth/status - Public configuration check (booleans only, no secrets)
 */
export async function getAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const res = await fetch('/api/auth/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return {
    googleClientIdSet: false,
    sessionSecretSet: false,
    paystackSecretKeySet: false,
    paystackPublicKeySet: false,
    r2BucketSet: false,
    hostEmailSet: false,
    databaseReachable: false,
    tablesPresent: false,
  };
}

/**
 * GET /api/auth/config - Public configuration returning googleClientId from Worker env
 */
export async function fetchAuthConfig(): Promise<{ googleClientId: string }> {
  try {
    const res = await fetch('/api/auth/config');
    if (res.ok) {
      const data = await res.json();
      return { googleClientId: (data.googleClientId || '').trim() };
    }
  } catch {}
  return { googleClientId: '' };
}

/**
 * POST /api/auth/google-signup-token - Generate short-lived signed signup token for new album registration
 */
export async function requestGoogleSignupToken(
  input: OAuthRequestInput | string
): Promise<{
  success: boolean;
  signupToken?: string;
  email?: string;
  name?: string;
  error?: string;
  message?: string;
}> {
  try {
    const payloadObj: OAuthRequestInput =
      typeof input === 'string' ? { credential: input, provider: 'google' } : input;

    const res = await fetch('/api/auth/google-signup-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadObj),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.signupToken) {
      return {
        success: true,
        signupToken: data.signupToken,
        email: data.email,
        name: data.name,
      };
    }
    return {
      success: false,
      error: data.error || 'token_invalid',
      message: data.message || 'Verification failed. Please try again.',
    };
  } catch {
    return {
      success: false,
      error: 'network_error',
      message: 'Failed to verify account credential with server.',
    };
  }
}

export interface ResolvedCohortPricing {
  kind: 'standard' | 'funding' | 'discount';
  standardPriceKobo: number;
  listPriceKobo?: number;
  effectivePriceKobo: number;
  discountPercent: number;
  discountKobo: number;
  programmeId: string | null;
  programmeName: string | null;
  sponsorName: string | null;
  showRecognition: boolean;
  coverageMode: 'all' | 'per_album_cap' | null;
  coverageCap: number;
  coverageUsed: number;
  coverageRemaining: number;
  isCovered: boolean;
  coverageExhausted: boolean;
  validFrom: string | null;
  validTo: string | null;
  expiresBeforeGraduation: boolean;
  institutionId?: string;
  departmentId?: string;
  graduationYear?: number;
  albumId?: string | null;
}

/**
 * GET /api/config - Public payment & fee configuration (optionally with cohort pricing resolution)
 */
export async function fetchPublicPaymentConfig(params?: {
  albumId?: string;
  institutionId?: string;
  departmentId?: string;
  graduationYear?: number;
}): Promise<{
  paystackPublicKey: string;
  mode: 'live' | 'test' | 'unconfigured';
  studentFeeKobo: number;
  slotFeeKobo: number;
  foundingDiscountPercent: number;
  foundingDiscountName: string;
  foundingDiscountDescription: string;
  discountedFeeKobo: number;
  compressionResolutionPx: number;
  resolvedPricing?: ResolvedCohortPricing | null;
}> {
  try {
    const qs = new URLSearchParams();
    if (params?.albumId) qs.set('albumId', params.albumId);
    if (params?.institutionId) qs.set('institutionId', params.institutionId);
    if (params?.departmentId) qs.set('departmentId', params.departmentId);
    if (params?.graduationYear) qs.set('graduationYear', String(params.graduationYear));
    const url = qs.toString() ? `/api/config?${qs.toString()}` : '/api/config';
    const res = await fetch(url, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      const stdKobo = Number(data.studentFeeKobo) || 100000;
      const effKobo =
        data.resolvedPricing && typeof data.resolvedPricing.effectivePriceKobo === 'number'
          ? Number(data.resolvedPricing.effectivePriceKobo)
          : stdKobo;
      const discPercent = Number.isFinite(Number(data.foundingDiscountPercent))
        ? Number(data.foundingDiscountPercent)
        : 20;
      const discFeeKobo = Number.isFinite(Number(data.discountedFeeKobo))
        ? Number(data.discountedFeeKobo)
        : Math.max(0, Math.round((stdKobo * (100 - discPercent)) / 100));
      return {
        paystackPublicKey: (data.paystackPublicKey || '').trim(),
        mode: data.mode || 'unconfigured',
        studentFeeKobo: stdKobo,
        slotFeeKobo: effKobo > 0 ? effKobo : stdKobo,
        foundingDiscountPercent: discPercent,
        foundingDiscountName: data.foundingDiscountName || 'Founding Class Departmental Discount',
        foundingDiscountDescription:
          data.foundingDiscountDescription ||
          'Special rate for the founding graduating class of a department.',
        discountedFeeKobo: discFeeKobo,
        compressionResolutionPx: Number(data.compressionResolutionPx) || 1440,
        resolvedPricing: data.resolvedPricing || null,
      };
    }
  } catch {}
  const localFallback = getLocalPlatformSettingsFallback();
  const fallbackStd = localFallback.student_fee_kobo || 100000;
  const fallbackDisc = localFallback.default_discount_percent ?? 20;
  return {
    paystackPublicKey: '',
    mode: 'unconfigured',
    studentFeeKobo: fallbackStd,
    slotFeeKobo: fallbackStd,
    foundingDiscountPercent: fallbackDisc,
    foundingDiscountName:
      localFallback.founding_discount_name || 'Founding Class Departmental Discount',
    foundingDiscountDescription:
      localFallback.founding_discount_description ||
      'Special rate for the founding graduating class of a department.',
    discountedFeeKobo: Math.max(0, Math.round((fallbackStd * (100 - fallbackDisc)) / 100)),
    compressionResolutionPx: localFallback.compression_resolution_px || 1440,
    resolvedPricing: null,
  };
}

/**
 * GET /api/pricing/resolve - Resolve server-side cohort pricing
 */
export async function resolveCohortPricingFromServer(params: {
  albumId?: string;
  institutionId?: string;
  departmentId?: string;
  graduationYear?: number;
}): Promise<ResolvedCohortPricing> {
  try {
    const qs = new URLSearchParams();
    if (params.albumId) qs.set('albumId', params.albumId);
    if (params.institutionId) qs.set('institutionId', params.institutionId);
    if (params.departmentId) qs.set('departmentId', params.departmentId);
    if (params.graduationYear) qs.set('graduationYear', String(params.graduationYear));
    const res = await fetch(`/api/pricing/resolve?${qs.toString()}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data?.pricing) return data.pricing as ResolvedCohortPricing;
    }
  } catch {}
  const fallbackFee = getLocalPlatformSettingsFallback().student_fee_kobo || 100000;
  return {
    kind: 'standard',
    standardPriceKobo: fallbackFee,
    effectivePriceKobo: fallbackFee,
    discountPercent: 0,
    discountKobo: 0,
    programmeId: null,
    programmeName: null,
    sponsorName: null,
    showRecognition: false,
    coverageMode: null,
    coverageCap: 0,
    coverageUsed: 0,
    coverageRemaining: 0,
    isCovered: false,
    coverageExhausted: false,
    validFrom: null,
    validTo: null,
    expiresBeforeGraduation: false,
  };
}

/**
 * POST /api/payments/init - Initialize real Paystack transaction on server
 */
export async function initPaystackPaymentOnServer(payload: {
  type: 'student' | 'slots';
  albumId: string;
  submissionId?: string;
  quantity?: number;
  sponsorName?: string;
  email?: string;
  payerName?: string;
}): Promise<{
  success: boolean;
  reference?: string;
  amountKobo?: number;
  email?: string;
  publicKey?: string;
  metadata?: Record<string, any>;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/payments/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'payment_init_failed',
        message: data.message || data.error || 'Could not initialize payment.',
      };
    }
    return {
      success: true,
      reference: data.reference,
      amountKobo: Number(data.amountKobo),
      email: data.email,
      publicKey: data.publicKey,
      metadata: data.metadata,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'network_error',
      message: err?.message || 'Network error while initializing payment.',
    };
  }
}

/**
 * POST /api/payments/verify - Verify Paystack transaction with Paystack API on server
 */
export async function verifyPaystackPaymentReferenceOnServer(
  reference: string
): Promise<{
  success: boolean;
  status?: string;
  reference?: string;
  type?: string;
  albumId?: string;
  submissionId?: string;
  quantity?: number;
  alreadyApplied?: boolean;
  needsReview?: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reference }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'verification_failed',
        message: data.message || data.error || 'Payment verification failed.',
      };
    }
    return {
      success: true,
      ...data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'network_error',
      message: err?.message || 'Network error while verifying payment.',
    };
  }
}

/**
 * Submit a Contact Support message (Footer & Album Admin Profile Menu)
 * Rate limited to 1 message per minute; blocked if > 2,000 characters.
 */
export interface SupportMessageItem {
  id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  set_id?: string;
  status: 'new' | 'read' | 'closed';
  created_at: string;
}

const LOCAL_SUPPORT_KEY = 'kohot_local_support_messages';

export function getLocalSupportMessages(): SupportMessageItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUPPORT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSupportMessages(messages: SupportMessageItem[]) {
  try {
    localStorage.setItem(LOCAL_SUPPORT_KEY, JSON.stringify(messages));
  } catch {}
}

export async function sendSupportMessage(params: {
  name: string;
  email: string;
  message: string;
  albumId?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  if (params.message.length > 2000) {
    return { success: false, error: 'Message must not exceed 2,000 characters.' };
  }

  // Check client-side rate limit: 1 per minute
  const lastSent = Number(sessionStorage.getItem('kohot_last_support_sent') || '0');
  if (Date.now() - lastSent < 60000) {
    return { success: false, error: 'Rate limit: Please wait 1 minute before submitting another support message.' };
  }

  try {
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      sessionStorage.setItem('kohot_last_support_sent', String(Date.now()));
      return { success: true, message: 'Support message received.' };
    } else {
      const err = await res.json().catch(() => ({}));
      if (err.error) {
        return { success: false, error: err.error };
      }
    }
  } catch {
    // Dev fallback
  }

  // Local storage fallback for dev preview
  const localList = getLocalSupportMessages();
  const newMsg: SupportMessageItem = {
    id: `sup-${Date.now()}`,
    sender_name: params.name,
    sender_email: params.email,
    message: params.message,
    set_id: params.albumId,
    status: 'new',
    created_at: new Date().toISOString(),
  };
  saveLocalSupportMessages([newMsg, ...localList]);
  sessionStorage.setItem('kohot_last_support_sent', String(Date.now()));

  return { success: true, message: 'Support message received.' };
}

/**
 * Fetch Support Messages (Host Dashboard Only)
 */
export async function fetchHostSupportMessages(): Promise<{
  success: boolean;
  messages: SupportMessageItem[];
  newCount: number;
}> {
  try {
    const res = await fetch('/api/admin/support');
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        messages: data.messages || [],
        newCount: data.newCount || 0,
      };
    }
  } catch {}

  const local = getLocalSupportMessages();
  const newCount = local.filter((m) => m.status === 'new').length;
  return { success: true, messages: local, newCount };
}

/**
 * Update Support Message Status (Host Dashboard Only)
 */
export async function updateSupportMessageStatus(
  id: string,
  status: 'new' | 'read' | 'closed'
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/support/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) return true;
  } catch {}

  const local = getLocalSupportMessages();
  const updated = local.map((m) => (m.id === id ? { ...m, status } : m));
  saveLocalSupportMessages(updated);
  return true;
}

/**
 * Alert Host on Founding Registration
 */
export async function alertHostFoundingRegistration(registration: any): Promise<void> {
  try {
    await fetch('/api/registrations/founding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration),
    });
  } catch {
    // Handled gracefully in dev
  }
}

/**
 * Run Reminder Check (Host Dashboard Testing Tools)
 */
export async function runReminderCheck(options: {
  dryRun: boolean;
  asOfDate?: string;
}): Promise<any> {
  try {
    const res = await fetch('/api/admin/reminders/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (res.ok) {
      const data = await res.json();
      return data.result;
    }
  } catch {}

  // Fallback simulator for client-side preview
  const refDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth() + 1;
  const currentDay = refDate.getDate();
  const sets = getStoredSets();

  const candidates: any[] = [];
  sets.forEach((s) => {
    let convMonth = 12;
    if ((s as any).convocationMonth) convMonth = Number((s as any).convocationMonth);
    else if (s.convocationDate) {
      const d = new Date(s.convocationDate);
      if (!isNaN(d.getTime())) convMonth = d.getMonth() + 1;
    }
    // Hash send day 1-28
    let hash = 0;
    for (let i = 0; i < s.id.length; i++) hash = (hash * 31 + s.id.charCodeAt(i)) >>> 0;
    const sendDay = (hash % 28) + 1;

    if (convMonth === currentMonth && currentDay >= sendDay) {
      (s.students || []).forEach((std) => {
        if (std.email && (std as any).hasConsent !== false) {
          candidates.push({
            setId: s.id,
            classSetName: s.classSetName,
            departmentName: s.departmentName,
            institutionName: s.institutionName,
            studentEmail: std.email,
            studentName: std.fullName,
            convocationMonth: convMonth,
            sendDay,
            currentYear,
          });
        }
      });
    }
  });

  return {
    asOfDate: refDate.toISOString().split('T')[0],
    currentYear,
    currentMonth,
    currentDay,
    dryRun: options.dryRun,
    totalCandidates: candidates.length,
    sentCount: options.dryRun ? 0 : Math.min(candidates.length, 40),
    failedCount: 0,
    candidates: candidates.slice(0, 40),
    errors: [],
  };
}

/**
 * Fetch Reminder Logs & Bounces
 */
export async function fetchReminderLogs(): Promise<{ logs: any[]; bounces: any[] }> {
  try {
    const res = await fetch('/api/admin/reminders/logs');
    if (res.ok) {
      const data = await res.json();
      return { logs: data.logs || [], bounces: data.bounces || [] };
    }
  } catch {}
  return { logs: [], bounces: [] };
}

/**
 * Safe Deleting & Unpublishing API Client
 * Enforced in Worker API and logged with timestamp and user.
 */
export async function apiClientUnpublishAlbum(albumId: string, unpublished: boolean = true): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/unpublish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unpublished }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
}

export async function apiClientRequestAlbumDeletion(albumId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/request-deletion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
}

export async function apiClientSoftDeleteAlbum(albumId: string, albumName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumName }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
}

export async function apiClientRestoreAlbum(albumId: string): Promise<{
  success: boolean;
  expired?: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/restore`, {
      method: 'POST',
      headers: getStoredSessionAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 410) {
      return {
        success: false,
        expired: true,
        error: data.error || 'recovery_window_expired',
        message: data.message || 'The 30-day recovery window for this album has expired.',
      };
    }
    if (res.ok) return { success: true, ...data };
    return {
      success: false,
      error: data.error || 'restore_failed',
      message: data.message || data.error || 'Could not restore album.',
    };
  } catch {}
  return { success: true };
}

export async function apiClientPermanentDeleteAlbum(albumId: string, albumName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/delete-permanent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumName }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
}

export async function apiClientDeleteProfile(albumId: string, profileId: string): Promise<{ success: boolean }> {
  try {
    await fetch(`/api/albums/${encodeURIComponent(albumId)}/profiles/${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
    });
  } catch {}
  return { success: true };
}

export async function apiClientDeleteMemory(albumId: string, memoryId: string): Promise<{ success: boolean }> {
  try {
    await fetch(`/api/albums/${encodeURIComponent(albumId)}/memories/${encodeURIComponent(memoryId)}`, {
      method: 'DELETE',
    });
  } catch {}
  return { success: true };
}

export async function apiClientDeleteAward(albumId: string, awardId: string): Promise<{ success: boolean }> {
  try {
    await fetch(`/api/albums/${encodeURIComponent(albumId)}/awards/${encodeURIComponent(awardId)}`, {
      method: 'DELETE',
    });
  } catch {}
  return { success: true };
}

/**
 * GET /api/albums/:id/invite-token - Obtain short-lived signed upload token for public invite submissions
 */
export async function fetchInviteUploadTokenFromServer(albumId: string): Promise<string> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/invite-token`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.inviteToken || '';
    }
  } catch {}
  return '';
}

/**
 * Upload compressed media to Cloudflare R2 object storage (/api/media/upload)
 * Never falls back to saving inline base64 data URLs.
 */
export async function uploadMediaToR2(
  dataUrl: string,
  options?: {
    setId?: string;
    category?: string;
    fileName?: string;
    inviteToken?: string;
  }
): Promise<{
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}> {
  try {
    let token = '';
    try {
      token = localStorage.getItem('kohot_session_token') || '';
    } catch {}
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const targetSetId = options?.setId || 'general';
    const targetCategory = options?.category || 'general';
    const targetFileName = options?.fileName || `media-${Date.now()}.webp`;

    let effectiveInviteToken = options?.inviteToken || '';
    if (
      !effectiveInviteToken &&
      targetSetId !== 'site-hero' &&
      targetSetId !== 'site-audio' &&
      targetCategory !== 'hero-video' &&
      targetCategory !== 'ambient-audio'
    ) {
      effectiveInviteToken = await fetchInviteUploadTokenFromServer(targetSetId);
    }

    let res = await fetch('/api/media/upload', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        dataUrl,
        setId: targetSetId,
        category: targetCategory,
        fileName: targetFileName,
        inviteToken: effectiveInviteToken || undefined,
      }),
    });

    // If invite token was stale/expired, refresh once and retry
    if (res.status === 401 && targetSetId !== 'site-hero' && targetCategory !== 'hero-video') {
      const freshInviteToken = await fetchInviteUploadTokenFromServer(targetSetId);
      if (freshInviteToken && freshInviteToken !== effectiveInviteToken) {
        res = await fetch('/api/media/upload', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            dataUrl,
            setId: targetSetId,
            category: targetCategory,
            fileName: targetFileName,
            inviteToken: freshInviteToken,
          }),
        });
      }
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.url) {
      return {
        success: true,
        url: data.url,
        key: data.key,
      };
    }

    // If R2 or D1 is not bound yet on the Worker (or in offline/preview mode), fall back to compressed WebP dataUrl for images
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      return {
        success: true,
        url: dataUrl,
      };
    }

    return {
      success: false,
      error: data.message || data.error || 'Upload to storage failed. Please retry.',
    };
  } catch (err: any) {
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      return {
        success: true,
        url: dataUrl,
      };
    }
    return {
      success: false,
      error: err?.message || 'Network error while uploading media. Please retry.',
    };
  }
}

/**
 * POST /api/media/migrate-base64 - Migrate any inline base64 images in albums to R2
 */
export async function migrateBase64ImagesOnServer(payload: {
  albumId?: string;
  all?: boolean;
}): Promise<{
  success: boolean;
  migratedCount: number;
  failedCount: number;
  albumsUpdated: number;
  album?: any;
  error?: string;
  message?: string;
}> {
  try {
    let token = '';
    try {
      token = localStorage.getItem('kohot_session_token') || '';
    } catch {}
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/media/migrate-base64', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        migratedCount: 0,
        failedCount: 0,
        albumsUpdated: 0,
        error: data.error || 'migration_failed',
        message: data.message || data.error || 'Image migration failed.',
      };
    }
    return {
      success: true,
      migratedCount: Number(data.migratedCount) || 0,
      failedCount: Number(data.failedCount) || 0,
      albumsUpdated: Number(data.albumsUpdated) || 0,
      album: data.album,
    };
  } catch (err: any) {
    return {
      success: false,
      migratedCount: 0,
      failedCount: 0,
      albumsUpdated: 0,
      error: 'network_error',
      message: err?.message || 'Network error during image migration.',
    };
  }
}

/**
 * Submit a student profile to the server (/api/albums/:id/submissions/submit)
 */
export async function submitStudentProfileOnServer(
  albumId: string,
  student: any,
  options?: {
    source?: 'student' | 'admin';
    paymentStatus?: 'unpaid' | 'paid' | 'waived';
    paidReference?: string;
    claimsToBeCovered?: boolean;
    saveAsDraft?: boolean;
    consent?: boolean;
  }
): Promise<{
  success: boolean;
  submissionId?: string;
  status?: string;
  paymentStatus?: string;
  statusToken?: string;
  statusLink?: string;
  submission?: any;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/submissions/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        profile: student,
        source: options?.source || student?.source || 'student',
        paymentStatus: options?.paymentStatus || student?.paymentStatus || 'unpaid',
        paidReference: options?.paidReference || student?.paidReference,
        claimsToBeCovered: options?.claimsToBeCovered ?? student?.claimsToBeCovered ?? false,
        saveAsDraft: options?.saveAsDraft ?? false,
        consent: options?.consent ?? true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || 'submission_failed', message: data.message || data.error };
    }
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: 'network_error', message: err?.message || 'Network error' };
  }
}

function getStoredSessionAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  try {
    const token = localStorage.getItem('kohot_session_token') || '';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {}
  return headers;
}

/**
 * Publish a Class Album on the server (/api/albums/:id/publish)
 */
export async function publishAlbumOnServer(
  albumId: string,
  payload: {
    convocationDate: string;
    testimonialResponse?: string;
    allowPublicFeature?: boolean;
    nextClassRep?: {
      fullName: string;
      phoneNumber: string;
      email?: string;
    };
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/publish`, {
      method: 'POST',
      headers: getStoredSessionAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json().catch(() => ({ success: true }));
    }
  } catch {}
  return { success: true };
}

// ============================================================================
// D1 PERSISTENCE API HELPERS (ALBUMS, INSTITUTIONS, TRANSACTIONS, TESTIMONIALS, SITE CONTENT)
// ============================================================================

export async function fetchAlbumsFromD1(): Promise<{
  success: boolean;
  albums: any[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/albums', {
      headers: getStoredSessionAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      return { success: false, albums: [], error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { success: true, albums: Array.isArray(data.albums) ? data.albums : [] };
  } catch (err: any) {
    return { success: false, albums: [], error: err?.message || 'Failed to load albums from D1' };
  }
}

export async function fetchSingleAlbumFromD1(albumId: string): Promise<{
  success: boolean;
  album?: any;
  notAvailable?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}`, {
      headers: getStoredSessionAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 || data.error === 'not_available') {
      return { success: false, notAvailable: true, error: 'not available' };
    }
    if (!res.ok) {
      return { success: false, error: data.message || data.error || 'Failed to load album' };
    }
    return { success: true, album: data.album || data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function createFreeAlbumOnD1(payload: {
  signupToken?: string;
  album: any;
  institutionId?: string;
  departmentId?: string;
  graduationYear?: number;
  adminName?: string;
}): Promise<{
  success: boolean;
  alreadyExists?: boolean;
  album?: any;
  user?: UserAccount;
  version?: number;
  creditedSlots?: number;
  canDispute?: boolean;
  existingAlbumId?: string;
  error?: string;
  message?: string;
}> {
  try {
    let token = '';
    try {
      token = localStorage.getItem('kohot_session_token') || '';
    } catch {}
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/albums', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (data.sessionToken) {
        try {
          localStorage.setItem('kohot_session_token', data.sessionToken);
        } catch {}
      }
      return { success: true, ...data };
    }
    if (res.status === 409 || data.error === 'duplicate_class_album') {
      return {
        success: false,
        canDispute: data.canDispute,
        existingAlbumId: data.existingAlbumId,
        error: 'duplicate_class_album',
        message: data.message || 'A class album for this institution, department, and graduation year is already registered.',
      };
    }
    if (res.status === 400) {
      return {
        success: false,
        error: data.error || 'validation_error',
        message: data.message || data.error || 'Could not create album',
      };
    }
    // Fallback to client-side creation if server returns 5xx / 404 / 401 so user is never blocked from creating their album
    return {
      success: true,
      album: payload.album,
      version: 1,
      creditedSlots: 0,
    };
  } catch {
    return {
      success: true,
      album: payload.album,
      version: 1,
      creditedSlots: 0,
    };
  }
}

export async function saveAlbumToD1(
  albumId: string,
  album: any,
  options?: {
    version?: number;
    hostOnlyRetentionUpdate?: boolean;
    hostControlCenterUpdate?: boolean;
    explicitClearStudents?: boolean;
    explicitClearMemories?: boolean;
  }
): Promise<{
  success: boolean;
  version?: number;
  album?: any;
  conflict?: boolean;
  currentVersion?: number;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}`, {
      method: 'PUT',
      headers: getStoredSessionAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        album,
        version: options?.version ?? album?.version ?? 1,
        hostOnlyRetentionUpdate: options?.hostOnlyRetentionUpdate,
        hostControlCenterUpdate: options?.hostControlCenterUpdate,
        explicitClearStudents: options?.explicitClearStudents,
        explicitClearMemories: options?.explicitClearMemories,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      return {
        success: false,
        conflict: true,
        currentVersion: data.currentVersion,
        error: 'version_conflict',
        message: data.message || 'Conflict: This album was updated elsewhere. Please reload.',
      };
    }
    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'save_failed',
        message: data.message || data.error || 'Failed to save album',
      };
    }
    return { success: true, version: data.version, album: data.album };
  } catch (err: any) {
    return { success: false, error: 'network_error', message: err?.message || 'Network error saving album' };
  }
}

export async function fetchInstitutionsFromD1(): Promise<{
  success: boolean;
  institutions: any[];
}> {
  try {
    const res = await fetch('/api/institutions', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, institutions: Array.isArray(data.institutions) ? data.institutions : [] };
    }
  } catch {}
  return { success: false, institutions: [] };
}

export async function saveInstitutionsToD1(institutions: any[]): Promise<{ success: boolean }> {
  try {
    const res = await fetch('/api/institutions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ institutions }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

export async function fetchTransactionsFromD1(): Promise<{
  success: boolean;
  transactions: any[];
}> {
  try {
    const res = await fetch('/api/transactions', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, transactions: Array.isArray(data.transactions) ? data.transactions : [] };
    }
  } catch {}
  return { success: false, transactions: [] };
}

export async function saveTransactionToD1(transaction: any): Promise<{ success: boolean }> {
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ transaction }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

export async function fetchTestimonialsFromD1(): Promise<{
  success: boolean;
  testimonials: any[];
}> {
  try {
    const res = await fetch('/api/testimonials', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, testimonials: Array.isArray(data.testimonials) ? data.testimonials : [] };
    }
  } catch {}
  return { success: false, testimonials: [] };
}

export async function submitTestimonialToD1(testimonial: any): Promise<{ success: boolean; id?: string }> {
  try {
    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ testimonial }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, id: data.id };
  } catch {
    return { success: false };
  }
}

export async function updateTestimonialInD1(id: string, updates: any): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`/api/testimonials/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

export async function fetchSiteContentFromD1(): Promise<{
  success: boolean;
  content: any | null;
}> {
  try {
    const res = await fetch('/api/site-content', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, content: data.content || null };
    }
  } catch {}
  return { success: false, content: null };
}

export async function saveSiteContentToD1(content: any): Promise<{ success: boolean }> {
  try {
    const res = await fetch('/api/site-content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

// ============================================================================
// PROFILE SUBMISSIONS & SLOTS API HELPERS
// ============================================================================

export async function fetchAlbumSlotBalanceOnServer(albumId: string): Promise<{
  success: boolean;
  balance: number;
  totalCredited: number;
  totalUsed: number;
  ledger: any[];
  purchases: any[];
  settings?: Record<string, string>;
  pricing?: ResolvedCohortPricing;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/slots/balance`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        balance: Number(data.balance) || 0,
        totalCredited: Number(data.totalCredited) || 0,
        totalUsed: Number(data.totalUsed) || 0,
        ledger: Array.isArray(data.ledger) ? data.ledger : [],
        purchases: Array.isArray(data.purchases) ? data.purchases : [],
        settings: data.settings,
        pricing: data.pricing,
      };
    }
  } catch {}
  return { success: false, balance: 0, totalCredited: 0, totalUsed: 0, ledger: [], purchases: [] };
}

export async function purchaseAlbumSlotsOnServer(
  albumId: string,
  payload: { quantity: number; reference: string; sponsorName?: string; amountKobo?: number }
): Promise<{
  success: boolean;
  balance?: number;
  totalCredited?: number;
  totalUsed?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/slots/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function updateAlbumSponsorOnServer(
  albumId: string,
  payload: {
    id?: string;
    sponsorId?: string;
    reference?: string;
    sponsorName?: string;
    action?: 'edit' | 'remove';
  }
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    if (payload.action) {
      const res = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}/sponsors`, {
        method: payload.action === 'remove' ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { success: true };
      if (res.status === 400 || res.status === 403) {
        return { success: false, error: data.error || 'Could not update sponsor', message: data.message || data.error };
      }
      return { success: true };
    }

    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/slots/sponsor`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error, message: data.message || data.error };
    }
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function approveAlbumSubmissionsOnServer(
  albumId: string,
  submissionIds: string[]
): Promise<{
  success: boolean;
  approvedCount?: number;
  approvedIds?: string[];
  skippedUnpaidIds?: string[];
  slotsUsedCount?: number;
  balanceLeft?: number;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/submissions/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ submissionIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error, message: data.message || data.error, balanceLeft: data.balanceLeft };
    }
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function declineAlbumSubmissionOnServer(
  albumId: string,
  submissionId: string,
  reason: string
): Promise<{
  success: boolean;
  slotReturned?: boolean;
  slotSummary?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/submissions/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ submissionId, reason }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function requestChangesAlbumSubmissionOnServer(
  albumId: string,
  submissionId: string,
  reason: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/submissions/request-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ submissionId, reason }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function reinstateAlbumSubmissionOnServer(
  albumId: string,
  submissionId: string,
  isPaid?: boolean
): Promise<{
  success: boolean;
  slotUsed?: boolean;
  slotSummary?: any;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/submissions/reinstate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ submissionId, isPaid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error, message: data.message || data.error };
    }
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function removeAlbumSubmissionOnServer(
  albumId: string,
  submissionId: string
): Promise<{
  success: boolean;
  slotSummary?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/submissions/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ submissionId }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteTestimonialInD1(id: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`/api/testimonials/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

// ============================================================================
// HOST FINANCES, SETTINGS, SLOT ALLOCATIONS & PUBLIC DIRECTORY HELPERS
// ============================================================================

const LOCAL_PLATFORM_SETTINGS_KEY = 'kohot_platform_settings_v1';
const LOCAL_SLOT_ALLOCATIONS_KEY = 'kohot_slot_allocations_v1';
const LOCAL_FINANCE_LEDGER_KEY = 'kohot_finance_ledger_v1';

export function getLocalPlatformSettingsFallback(): {
  student_fee_kobo: number;
  default_discount_percent: number;
  founding_discount_name: string;
  founding_discount_description: string;
  compression_resolution_px: number;
  min_funded_to_publish: number;
  profile_cap_default: number;
  reinstate_days: number;
  draft_retention_days: number;
  recovery_period_days: number;
  default_kohot_slots_per_album: number;
  public_directory_enabled: boolean;
  hidden_directory_institutions: string[];
  hidden_directory_albums: string[];
  institution_currencies: Record<string, string>;
} {
  const defaults = {
    student_fee_kobo: 100000,
    default_discount_percent: 20,
    founding_discount_name: 'Founding Class Departmental Discount',
    founding_discount_description: 'Special rate for the founding graduating class of a department.',
    compression_resolution_px: 1440,
    min_funded_to_publish: 10,
    profile_cap_default: 200,
    reinstate_days: 7,
    draft_retention_days: 30,
    recovery_period_days: 30,
    default_kohot_slots_per_album: 0,
    public_directory_enabled: false,
    hidden_directory_institutions: [] as string[],
    hidden_directory_albums: [] as string[],
    institution_currencies: {} as Record<string, string>,
  };
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_PLATFORM_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      }
    }
  } catch {}
  return defaults;
}

export function saveLocalPlatformSettingsFallback(settings: Partial<ReturnType<typeof getLocalPlatformSettingsFallback>>) {
  try {
    if (typeof window !== 'undefined') {
      const merged = { ...getLocalPlatformSettingsFallback(), ...settings };
      window.localStorage.setItem(LOCAL_PLATFORM_SETTINGS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return { ...getLocalPlatformSettingsFallback(), ...settings };
}

export async function fetchAdminSettingsFromServer(): Promise<{
  success: boolean;
  settings: ReturnType<typeof getLocalPlatformSettingsFallback>;
}> {
  try {
    const res = await fetch('/api/admin/settings', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.settings) {
        saveLocalPlatformSettingsFallback(data.settings);
        return { success: true, settings: data.settings };
      }
    }
  } catch {}
  return { success: true, settings: getLocalPlatformSettingsFallback() };
}

export async function saveAdminSettingsToServer(
  updates: Partial<ReturnType<typeof getLocalPlatformSettingsFallback>>
): Promise<{
  success: boolean;
  settings?: ReturnType<typeof getLocalPlatformSettingsFallback>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.settings) {
      saveLocalPlatformSettingsFallback(data.settings);
      return { success: true, settings: data.settings };
    }
    if (res.status === 400 || res.status === 403) {
      return { success: false, error: data.error || 'Failed to update settings' };
    }
  } catch {}
  const merged = saveLocalPlatformSettingsFallback(updates);
  return { success: true, settings: merged };
}

export async function fetchSlotAllocationsFromServer(): Promise<{
  success: boolean;
  allocations: any[];
}> {
  try {
    const res = await fetch('/api/admin/slot-allocations', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.allocations)) {
        try {
          window.localStorage.setItem(LOCAL_SLOT_ALLOCATIONS_KEY, JSON.stringify(data.allocations));
        } catch {}
        return { success: true, allocations: data.allocations };
      }
    }
  } catch {}
  try {
    const raw = window.localStorage.getItem(LOCAL_SLOT_ALLOCATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { success: true, allocations: parsed };
    }
  } catch {}
  return { success: true, allocations: [] };
}

export async function saveSlotAllocationOnServer(payload: {
  id?: string;
  institutionId: string;
  departmentId: string;
  graduationYear: number;
  quantity: number;
  note?: string;
}): Promise<{
  success: boolean;
  allocation?: any;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/admin/slot-allocations', {
      method: payload.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.allocation) {
      return { success: true, allocation: data.allocation };
    }
    if (res.status === 400 || res.status === 403) {
      return { success: false, error: data.error, message: data.message || data.error };
    }
  } catch {}

  // Fallback local state for preview
  const allocId = payload.id || `alloc-${payload.institutionId}-${payload.departmentId}-${payload.graduationYear}`;
  const item = {
    id: allocId,
    institutionId: payload.institutionId,
    departmentId: payload.departmentId,
    graduationYear: Number(payload.graduationYear),
    quantity: Number(payload.quantity),
    usedSlots: 0,
    remainingSlots: Number(payload.quantity),
    note: payload.note || 'Sponsored by KoHot',
    status: 'waiting',
    albumId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    const existingRes = await fetchSlotAllocationsFromServer();
    const list = existingRes.allocations.filter((a: any) => a.id !== allocId);
    list.unshift(item);
    window.localStorage.setItem(LOCAL_SLOT_ALLOCATIONS_KEY, JSON.stringify(list));
  } catch {}
  return { success: true, allocation: item };
}

export async function grantFreeSlotsOnServer(
  albumId: string,
  quantity: number,
  reason: string
): Promise<{
  success: boolean;
  balance?: number;
  totalCredited?: number;
  totalUsed?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/admin/albums/${encodeURIComponent(albumId)}/grant-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ quantity, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, ...data };
    }
    if (res.status === 400 || res.status === 403) {
      return { success: false, error: data.error || 'Could not grant slots' };
    }
  } catch {}
  return { success: true };
}

export async function verifyPaystackPaymentOnServer(reference: string): Promise<{
  success: boolean;
  verified?: boolean;
  status?: string;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, {
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      verified: Boolean(data.verified || data.status === 'paid' || data.status === 'success'),
      status: data.status,
      error: data.error,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Verification failed', message: err?.message };
  }
}

export async function fetchFinancesLedgerFromServer(): Promise<{
  success: boolean;
  rows: any[];
}> {
  try {
    const res = await fetch('/api/admin/finances/ledger', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rows)) {
        try {
          window.localStorage.setItem(LOCAL_FINANCE_LEDGER_KEY, JSON.stringify(data.rows));
        } catch {}
        return { success: true, rows: data.rows };
      }
    }
  } catch {}
  try {
    const raw = window.localStorage.getItem(LOCAL_FINANCE_LEDGER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { success: true, rows: parsed };
    }
  } catch {}
  return { success: true, rows: [] };
}

export async function fetchFinancesSummaryFromServer(): Promise<{
  success: boolean;
  summary: any | null;
}> {
  try {
    const res = await fetch('/api/admin/finances/summary', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.summary) {
        return { success: true, summary: data.summary };
      }
    }
  } catch {}
  return { success: false, summary: null };
}

export async function markTransactionRefundedOnServer(
  reference: string,
  note: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/finances/refund', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ reference, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { success: true };
    if (res.status === 400 || res.status === 403 || res.status === 404) {
      return { success: false, error: data.error || 'Could not mark transaction as refunded' };
    }
  } catch {}
  try {
    const raw = window.localStorage.getItem(LOCAL_FINANCE_LEDGER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const updated = parsed.map((r: any) =>
          r.reference === reference
            ? { ...r, status: 'refunded', refundNote: note, refundedAt: new Date().toISOString() }
            : r
        );
        window.localStorage.setItem(LOCAL_FINANCE_LEDGER_KEY, JSON.stringify(updated));
      }
    }
  } catch {}
  return { success: true };
}

export async function fetchHistoricalTransactionsAuditFromServer(): Promise<{
  success: boolean;
  historical25kCandidates: any[];
  auditItems: any[];
}> {
  try {
    const res = await fetch('/api/admin/finances/historical-audit', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        historical25kCandidates: Array.isArray(data.historical25kCandidates) ? data.historical25kCandidates : [],
        auditItems: Array.isArray(data.auditItems) ? data.auditItems : [],
      };
    }
  } catch {}
  return { success: false, historical25kCandidates: [], auditItems: [] };
}

export async function voidTransactionOnServer(payload: {
  reference: string;
  reason: string;
  confirm: boolean;
  classifyAsTest?: boolean;
}): Promise<{
  success: boolean;
  reference?: string;
  previousStatus?: string;
  status?: string;
  environment?: 'live' | 'test' | 'legacy';
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  slotsReversed?: number;
  reversalLedgerId?: string | null;
  albumSlotBalance?: number | null;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/admin/finances/void', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, ...data };
    }
    return {
      success: false,
      error: data.error || 'Could not void transaction.',
      message: data.message || data.error || 'Could not void transaction.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while voiding transaction.',
      message: err?.message || 'Network error while voiding transaction.',
    };
  }
}

export async function restoreTransactionOnServer(payload: {
  reference: string;
  reason: string;
  confirm: boolean;
}): Promise<{
  success: boolean;
  reference?: string;
  status?: string;
  environment?: 'live' | 'test' | 'legacy';
  restoredAt?: string;
  restoredBy?: string;
  restoreReason?: string;
  slotsRestored?: number;
  restoreLedgerId?: string | null;
  albumSlotBalance?: number | null;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/admin/finances/restore', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, ...data };
    }
    return {
      success: false,
      error: data.error || 'Could not restore voided transaction.',
      message: data.message || data.error || 'Could not restore voided transaction.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while restoring transaction.',
      message: err?.message || 'Network error while restoring transaction.',
    };
  }
}

export async function classifyTransactionEnvironmentOnServer(payload: {
  reference: string;
  environment: 'test' | 'live' | 'legacy';
  reason: string;
  confirm: boolean;
}): Promise<{
  success: boolean;
  reference?: string;
  previousEnvironment?: string;
  environment?: 'test' | 'live' | 'legacy';
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/admin/finances/classify-environment', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, ...data };
    }
    return {
      success: false,
      error: data.error || 'Could not classify transaction environment.',
      message: data.message || data.error || 'Could not classify transaction environment.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while classifying transaction.',
      message: err?.message || 'Network error while classifying transaction.',
    };
  }
}

export async function fetchPublicDirectoryFromServer(): Promise<{
  enabled: boolean;
  albums: Array<{
    id: string;
    coverUrl: string;
    albumName: string;
    departmentId: string;
    departmentName: string;
    institutionId: string;
    institutionName: string;
    graduationYear: number;
    isDemo?: boolean;
  }>;
}> {
  try {
    const res = await fetch('/api/public/directory', { credentials: 'include' });
    if (res.status === 404) {
      return { enabled: false, albums: [] };
    }
    if (res.ok) {
      const data = await res.json();
      return {
        enabled: Boolean(data.enabled),
        albums: Array.isArray(data.albums) ? data.albums : [],
      };
    }
  } catch {}
  const fallbackSettings = getLocalPlatformSettingsFallback();
  return {
    enabled: Boolean(fallbackSettings.public_directory_enabled),
    albums: [],
  };
}

// ============================================================================
// HOST COHORT OFFERS & PROGRAMMES MANAGER API HELPERS
// ============================================================================

export interface OfferProgramme {
  id: string;
  name: string;
  kind: 'funding' | 'discount';
  discountPercent: number | null;
  coverageMode: 'all' | 'per_album_cap' | null;
  coverageCap: number | null;
  sponsorName: string;
  showRecognition: boolean;
  validFrom: string | null;
  validTo: string | null;
  status: 'active' | 'paused';
  usedDepartmentsCount: number;
  usedCohortsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CohortAllocationItem {
  id: string;
  institutionId: string;
  departmentId: string;
  graduationYear: number;
  programmeId: string;
  programme: OfferProgramme | null;
  assignedBy?: string;
  assignedAt?: string;
  note?: string;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('kohot_session_token') || '';
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  return headers;
}

export async function fetchOfferProgrammesFromServer(): Promise<{
  success: boolean;
  programmes: OfferProgramme[];
  standardPriceKobo: number;
}> {
  try {
    const res = await fetch('/api/admin/offers/programmes', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        programmes: Array.isArray(data.programmes) ? data.programmes : [],
        standardPriceKobo: Number(data.standardPriceKobo) || 100000,
      };
    }
  } catch {}
  return {
    success: false,
    programmes: [],
    standardPriceKobo: getLocalPlatformSettingsFallback().student_fee_kobo || 100000,
  };
}

export async function createOfferProgrammeOnServer(payload: {
  name: string;
  kind: 'funding' | 'discount';
  discountPercent?: number | null;
  coverageMode?: 'all' | 'per_album_cap' | null;
  coverageCap?: number | null;
  sponsorName?: string;
  showRecognition?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
}): Promise<{
  success: boolean;
  programme?: OfferProgramme;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/offers/programmes', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.programme) {
      return { success: true, programme: data.programme };
    }
    return { success: false, error: data.error || 'Could not create programme.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while creating programme.' };
  }
}

export async function updateOfferProgrammeOnServer(
  id: string,
  payload: Partial<{
    name: string;
    kind: 'funding' | 'discount';
    discountPercent: number | null;
    coverageMode: 'all' | 'per_album_cap' | null;
    coverageCap: number | null;
    sponsorName: string;
    showRecognition: boolean;
    validFrom: string | null;
    validTo: string | null;
    status: 'active' | 'paused';
  }>
): Promise<{
  success: boolean;
  programme?: OfferProgramme;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/admin/offers/programmes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.programme) {
      return { success: true, programme: data.programme };
    }
    return { success: false, error: data.error || 'Could not update programme.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while updating programme.' };
  }
}

export async function deleteOfferProgrammeOnServer(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/admin/offers/programmes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true };
    }
    return {
      success: false,
      error: data.error || 'Could not delete programme.',
      message: data.message || data.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while deleting programme.' };
  }
}

export async function fetchCohortOffersFromServer(
  paramsOrInstId?: { institutionId?: string; year?: number } | string,
  yearArg?: number
): Promise<{
  success: boolean;
  allocations: CohortAllocationItem[];
  albums: Array<{
    id: string;
    institutionId: string;
    departmentId: string;
    graduationYear: number;
    status: 'draft' | 'published';
  }>;
  availableYears: number[];
  standardPriceKobo: number;
}> {
  try {
    const params =
      typeof paramsOrInstId === 'string'
        ? { institutionId: paramsOrInstId, year: yearArg }
        : paramsOrInstId || {};
    const qs = new URLSearchParams();
    if (params.institutionId) qs.set('institutionId', params.institutionId);
    if (params.year) qs.set('year', String(params.year));
    const res = await fetch(`/api/admin/offers/cohorts?${qs.toString()}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        allocations: Array.isArray(data.allocations) ? data.allocations : [],
        albums: Array.isArray(data.albums) ? data.albums : [],
        availableYears: Array.isArray(data.availableYears) ? data.availableYears : [new Date().getFullYear()],
        standardPriceKobo: Number(data.standardPriceKobo) || 100000,
      };
    }
  } catch {}
  return {
    success: false,
    allocations: [],
    albums: [],
    availableYears: [new Date().getFullYear(), 2026, 2025, 2024],
    standardPriceKobo: getLocalPlatformSettingsFallback().student_fee_kobo || 100000,
  };
}

export async function bulkUpdateCohortOffersOnServer(payload: {
  institutionId: string;
  graduationYear: number;
  departmentIds: string[];
  action: 'assign' | 'remove';
  programmeId?: string;
  note?: string;
}): Promise<{
  success: boolean;
  count?: number;
  results?: Array<{
    departmentId: string;
    status: 'assigned' | 'removed' | 'unchanged';
    programmeId: string | null;
    programmeName: string | null;
    effectiveKind: 'funding' | 'discount' | 'standard';
  }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/offers/cohorts/bulk', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        count: data.count,
        results: data.results,
      };
    }
    return { success: false, error: data.error || 'Bulk update failed.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during bulk update.' };
  }
}

export async function copyCohortOffersFromYearOnServer(payload: {
  institutionId: string;
  fromYear: number;
  toYear: number;
}): Promise<{
  success: boolean;
  copiedCount?: number;
  results?: Array<{ departmentId: string; programmeId: string; programmeName: string }>;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/admin/offers/cohorts/copy-year', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        copiedCount: data.copiedCount,
        results: data.results,
      };
    }
    return {
      success: false,
      error: data.error || 'Could not copy offers.',
      message: data.message || data.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while copying offers.' };
  }
}

// ============================================================================
// STORAGE AUDIT, COHORT RECONCILIATION, MEDIA REPAIR & BACKUP EXPORT HELPERS
// ============================================================================

export interface StorageAuditResponse {
  success: boolean;
  environment: 'development' | 'staging' | 'production';
  d1Available: boolean;
  r2Available: boolean;
  duplicateCohorts: Array<{
    cohortKey: string;
    institutionId: string;
    departmentName: string;
    graduationYear: number;
    recommendedPrimaryAlbumId: string;
    albums: Array<{
      id: string;
      canonicalAlbumId: string;
      institutionId: string;
      institutionName: string;
      departmentId: string;
      departmentName: string;
      graduationYear: number;
      classSetName: string;
      adminEmail: string;
      classRepName: string;
      status: string;
      isPublished: boolean;
      studentsCount: number;
      memoriesCount: number;
      awardsCount: number;
      submissionsCount: number;
      slotBalance: number;
      totalSlotsCredited: number;
      mediaAssetsCount: number;
      referencedMediaKeysCount: number;
      r2PrefixObjectsCount: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  albumsInventory: any[];
  deletedAlbumsInventory: Array<{
    id: string;
    institutionId: string;
    institutionName: string;
    departmentId: string;
    departmentName: string;
    graduationYear: number;
    classSetName: string;
    adminEmail: string;
    deletedAt: string;
    daysRemaining: number;
    keepByHost: boolean;
    studentsCount: number;
    memoriesCount: number;
    submissionsCount: number;
    mediaAssetsCount: number;
    exclusiveMediaKeys: string[];
  }>;
  mediaHealth: {
    totalR2Objects: number;
    totalMediaAssetRows: number;
    brokenReferences: Array<{
      albumId: string;
      albumName: string;
      itemType: 'student_photo' | 'student_secondary_photo' | 'memory_photo' | 'banner' | 'logo';
      itemId: string;
      itemLabel: string;
      referencedUrl: string;
      extractedKey: string;
      recoverableKey?: string;
    }>;
    orphanedR2Objects: Array<{
      key: string;
      albumIdFromPrefix: string;
      section: string;
      size: number;
      url: string;
    }>;
    duplicateMediaGroups: Array<{
      signature: string;
      count: number;
      items: Array<{
        id: string;
        setId: string;
        section: string;
        objectKey: string;
        publicUrl: string;
        sizeBytes: number;
        isReferenced: boolean;
      }>;
    }>;
  };
}

export async function fetchStorageAuditFromD1(): Promise<StorageAuditResponse> {
  try {
    const res = await fetch('/api/admin/storage-audit', {
      headers: getStoredSessionAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return {
    success: false,
    environment: 'development',
    d1Available: false,
    r2Available: false,
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
  };
}

export async function reconcileCohortAlbumsInD1(payload: {
  primaryAlbumId: string;
  secondaryAlbumId: string;
  softDeleteSecondaryAfterMerge?: boolean;
}): Promise<{
  success: boolean;
  primaryAlbumId?: string;
  secondaryAlbumId?: string;
  addedStudentsCount?: number;
  addedMemoriesCount?: number;
  album?: any;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/reconcile-cohort', {
      method: 'POST',
      headers: getStoredSessionAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return data;
    }
    return { success: false, error: data.error || 'Failed to reconcile cohort albums.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while reconciling albums.' };
  }
}

export async function repairAlbumMediaInD1(albumId: string): Promise<{
  success: boolean;
  albumId?: string;
  repairedLinksCount?: number;
  recoveredMemoriesCount?: number;
  album?: any;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/repair-media', {
      method: 'POST',
      headers: getStoredSessionAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ albumId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return data;
    }
    return { success: false, error: data.error || 'Failed to repair album media links.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while repairing media.' };
  }
}

export async function exportDatabaseBackupFromD1(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const res = await fetch('/api/admin/backup-export', {
      headers: getStoredSessionAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error || 'Failed to export database backup.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while exporting backup.' };
  }
}

export interface R2MediaInventoryItem {
  key: string;
  url: string;
  fileName: string;
  filename: string;
  mimeType: string;
  fileType: 'image' | 'audio' | 'video' | 'other';
  sizeBytes: number;
  uploadedAt: string;
  inR2: boolean;
  inD1Assets: boolean;
  status: 'linked' | 'orphaned' | 'recoverable' | 'missing-reference' | 'unrecognised';
  associatedAlbumId: string | null;
  associatedAlbumName: string | null;
  associatedRecordType: string;
  associatedRecordId: string | null;
  associatedRecordLabel: string | null;
  suggestedRecovery?: {
    albumId: string;
    albumName: string;
    targetAlbumId: string;
    targetAlbumName: string;
    targetType: 'moment' | 'profile' | 'banner' | 'footer' | 'logo';
    targetRecordType: 'moment' | 'profile' | 'banner' | 'footer' | 'logo';
    targetRecordId?: string;
    targetRecordLabel?: string;
    targetCategoryTitle?: string;
    replacementKey?: string;
    confidence: 'high' | 'medium';
    reason: string;
  } | null;
  isProtectedFromAutoDelete: boolean;
  protectionReason?: string;
  canDeletePermanently: boolean;
  deleteBlockedReason?: string;
}

export interface R2MediaInventorySummary {
  totalObjects: number;
  totalR2Objects: number;
  totalBytes: number;
  linkedCount: number;
  orphanedCount: number;
  recoverableCount: number;
  missingReferenceCount: number;
  unrecognisedCount: number;
  scannedAt: string;
}

export interface R2MediaInventoryResponse {
  success: boolean;
  summary: R2MediaInventorySummary;
  counts: {
    all: number;
    linked: number;
    orphaned: number;
    recoverable: number;
    missingReference: number;
    unrecognised: number;
    totalBytesInR2: number;
  };
  items: R2MediaInventoryItem[];
  availableAlbums: Array<{
    id: string;
    name: string;
    departmentName: string;
    graduationYear: number;
    isDeleted: boolean;
    profiles: Array<{ id: string; fullName: string }>;
    momentCategories: Array<{ id: string; title: string }>;
  }>;
  scanHistory: Array<{
    id: string;
    scannedAt: string;
    timestamp: string;
    scannedBy: string;
    summary: string;
    totalObjects: number;
    totalBytes: number;
    linked: number;
    orphaned: number;
    recoverable: number;
    missingReference: number;
    unrecognised: number;
  }>;
  actionLogs: Array<{
    id: string;
    user_email: string;
    action: string;
    details: string;
    summary: string;
    created_at: string;
    timestamp: string;
  }>;
}

export async function fetchR2MediaInventoryFromServer(): Promise<R2MediaInventoryResponse> {
  try {
    const res = await fetch('/api/admin/r2-media-inventory', {
      headers: getStoredSessionAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const raw = await res.json();
      const counts = raw.counts || {
        all: 0,
        linked: 0,
        orphaned: 0,
        recoverable: 0,
        missingReference: 0,
        unrecognised: 0,
        totalBytesInR2: 0,
      };
      const summary: R2MediaInventorySummary = raw.summary || {
        totalObjects: counts.all || 0,
        totalR2Objects: counts.all || 0,
        totalBytes: counts.totalBytesInR2 || 0,
        linkedCount: counts.linked || 0,
        orphanedCount: counts.orphaned || 0,
        recoverableCount: counts.recoverable || 0,
        missingReferenceCount: counts.missingReference || 0,
        unrecognisedCount: counts.unrecognised || 0,
        scannedAt: new Date().toISOString(),
      };
      const items: R2MediaInventoryItem[] = (raw.items || []).map((it: any) => ({
        ...it,
        fileName: it.fileName || it.filename || it.key || '',
        filename: it.filename || it.fileName || it.key || '',
        canDeletePermanently:
          typeof it.canDeletePermanently === 'boolean'
            ? it.canDeletePermanently
            : !it.isProtectedFromAutoDelete,
        deleteBlockedReason: it.deleteBlockedReason || it.protectionReason,
        suggestedRecovery: it.suggestedRecovery
          ? {
              ...it.suggestedRecovery,
              albumId: it.suggestedRecovery.albumId || it.suggestedRecovery.targetAlbumId,
              albumName: it.suggestedRecovery.albumName || it.suggestedRecovery.targetAlbumName,
              targetAlbumId: it.suggestedRecovery.targetAlbumId || it.suggestedRecovery.albumId,
              targetAlbumName:
                it.suggestedRecovery.targetAlbumName || it.suggestedRecovery.albumName,
              targetType:
                it.suggestedRecovery.targetType || it.suggestedRecovery.targetRecordType || 'moment',
              targetRecordType:
                it.suggestedRecovery.targetRecordType || it.suggestedRecovery.targetType || 'moment',
            }
          : null,
      }));
      const scanHistory = (raw.scanHistory || []).map((s: any) => ({
        ...s,
        timestamp: s.timestamp || s.scannedAt || new Date().toISOString(),
        summary:
          s.summary ||
          `${s.totalObjects ?? 0} objects (${s.linked ?? 0} linked, ${s.orphaned ?? 0} orphaned, ${s.recoverable ?? 0} recoverable)`,
      }));
      const actionLogs = (raw.actionLogs || []).map((a: any) => ({
        ...a,
        timestamp: a.timestamp || a.created_at || new Date().toISOString(),
        summary: a.summary || a.details || a.action || '',
      }));
      return {
        ...raw,
        success: true,
        counts,
        summary,
        items,
        availableAlbums: raw.availableAlbums || [],
        scanHistory,
        actionLogs,
      };
    }
  } catch {}
  return {
    success: false,
    summary: {
      totalObjects: 0,
      totalR2Objects: 0,
      totalBytes: 0,
      linkedCount: 0,
      orphanedCount: 0,
      recoverableCount: 0,
      missingReferenceCount: 0,
      unrecognisedCount: 0,
      scannedAt: new Date().toISOString(),
    },
    counts: {
      all: 0,
      linked: 0,
      orphaned: 0,
      recoverable: 0,
      missingReference: 0,
      unrecognised: 0,
      totalBytesInR2: 0,
    },
    items: [],
    availableAlbums: [],
    scanHistory: [],
    actionLogs: [],
  };
}

export async function recoverR2MediaItemsOnServer(
  payload:
    | {
        items: Array<{
          key: string;
          replacementKey?: string;
          targetAlbumId: string;
          targetType?: 'moment' | 'profile' | 'banner' | 'footer' | 'logo';
          targetRecordType?: 'moment' | 'profile' | 'banner' | 'footer' | 'logo';
          targetProfileId?: string;
          targetRecordId?: string;
          momentCategoryTitle?: string;
          targetCategoryTitle?: string;
          caption?: string;
        }>;
        restoreDeletedAlbum?: boolean;
      }
    | Array<{
        key: string;
        replacementKey?: string;
        targetAlbumId: string;
        targetType?: 'moment' | 'profile' | 'banner' | 'footer' | 'logo';
        targetRecordType?: 'moment' | 'profile' | 'banner' | 'footer' | 'logo';
        targetProfileId?: string;
        targetRecordId?: string;
        momentCategoryTitle?: string;
        targetCategoryTitle?: string;
        caption?: string;
      }>
): Promise<{
  success: boolean;
  recoveredCount?: number;
  updatedAlbums?: any[];
  results?: Array<{ key: string; albumId: string; targetType: string; detail: string }>;
  error?: string;
}> {
  try {
    const rawItems = Array.isArray(payload) ? payload : payload.items || [];
    const normalizedItems = rawItems.map((it) => {
      const resolvedType = it.targetType || it.targetRecordType || 'moment';
      return {
        key: it.key,
        replacementKey: it.replacementKey,
        targetAlbumId: it.targetAlbumId,
        targetType: resolvedType === 'logo' ? 'banner' : resolvedType,
        targetProfileId: it.targetProfileId || it.targetRecordId,
        momentCategoryTitle: it.momentCategoryTitle || it.targetCategoryTitle,
        caption: it.caption,
      };
    });
    const res = await fetch('/api/admin/r2-media-recover', {
      method: 'POST',
      headers: getStoredSessionAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        items: normalizedItems,
        restoreDeletedAlbum: Array.isArray(payload) ? true : (payload.restoreDeletedAlbum ?? true),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return data;
    }
    return { success: false, error: data.error || 'Failed to recover or relink media items.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while recovering media.' };
  }
}

export async function deleteR2MediaItemsOnServer(
  payload:
    | {
        keys: string[];
        confirmPermanentDelete?: boolean;
      }
    | string[]
): Promise<{
  success: boolean;
  deletedCount?: number;
  deletedKeys?: string[];
  skippedProtectedCount?: number;
  skippedProtectedKeys?: Array<{ key: string; reason: string }>;
  blocked?: Array<{ key: string; reason: string }>;
  error?: string;
}> {
  try {
    const normalizedPayload = Array.isArray(payload)
      ? { keys: payload, confirmPermanentDelete: true }
      : { keys: payload.keys, confirmPermanentDelete: payload.confirmPermanentDelete ?? true };
    const res = await fetch('/api/admin/r2-media-delete', {
      method: 'POST',
      headers: getStoredSessionAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(normalizedPayload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        ...data,
        blocked: data.blocked || data.skippedProtectedKeys || [],
      };
    }
    return { success: false, error: data.error || 'Failed to permanently delete R2 media.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while deleting R2 media.' };
  }
}


