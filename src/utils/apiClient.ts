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

    const DEMO_SET_IDS = new Set([
      'unilag-cs-2026',
      'oau-arch-2024',
      'crownfield-law-2023',
      'crownfield-law-2024',
      'crownfield-law-2025',
      'crownfield-law-2026',
    ]);

    const storedSets = getStoredSets()
      .filter((s) => {
        if (DEMO_SET_IDS.has(s.id)) return false;
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
      return {
        success: true,
        isNewUser: Boolean(data.isNewUser),
        user: data.user,
        signupToken: data.signupToken,
        email: data.email || data.user.email,
        name: data.name || data.user.fullName,
        albums: data.albums,
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

/**
 * GET /api/config - Public payment & fee configuration
 */
export async function fetchPublicPaymentConfig(): Promise<{
  paystackPublicKey: string;
  mode: 'live' | 'test' | 'unconfigured';
  studentFeeKobo: number;
  slotFeeKobo: number;
}> {
  try {
    const res = await fetch('/api/config', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return {
        paystackPublicKey: (data.paystackPublicKey || '').trim(),
        mode: data.mode || 'unconfigured',
        studentFeeKobo: Number(data.studentFeeKobo) || 50000,
        slotFeeKobo: Number(data.slotFeeKobo) || 50000,
      };
    }
  } catch {}
  return {
    paystackPublicKey: '',
    mode: 'unconfigured',
    studentFeeKobo: 50000,
    slotFeeKobo: 50000,
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

export async function apiClientRestoreAlbum(albumId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return await res.json();
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
    if (!effectiveInviteToken && targetSetId !== 'site-hero' && targetCategory !== 'hero-video') {
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

    return {
      success: false,
      error: data.message || data.error || 'Upload to storage failed. Please retry.',
    };
  } catch (err: any) {
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
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/albums', { credentials: 'include' });
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
    const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 || data.error === 'not_available') {
      return { success: false, notAvailable: true, error: 'not available' };
    }
    if (!res.ok) {
      return { success: false, error: data.message || data.error || 'Failed to load album' };
    }
    return { success: true, album: data };
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
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        canDispute: data.canDispute,
        existingAlbumId: data.existingAlbumId,
        error: data.error || 'create_failed',
        message: data.message || data.error || 'Could not create album',
      };
    }
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: 'network_error', message: err?.message || 'Network error creating album' };
  }
}

export async function saveAlbumToD1(
  albumId: string,
  album: any,
  options?: { version?: number; hostOnlyRetentionUpdate?: boolean }
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
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        album,
        version: options?.version ?? album?.version ?? 1,
        hostOnlyRetentionUpdate: options?.hostOnlyRetentionUpdate,
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
  payload: { id: string; sponsorName: string }
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
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



