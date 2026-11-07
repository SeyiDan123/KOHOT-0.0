import { ClassSet, UniversityDirectoryItem } from '../types';

/**
 * URL and Deep-Linking Helper for KoHot Archival Systems
 * Guarantees that invite and album links remain durable and accessible
 * across external applications (WhatsApp, Telegram, X, SMS, Email, QR codes).
 */

export const PRODUCTION_ORIGIN = 'https://kohot.classalbum.workers.dev';

/**
 * Checks whether a hostname or URL string belongs to a preview, staging, or local dev domain
 * (e.g., ais-dev-..., ais-pre-..., *.run.app, *.cloudworkstations.dev, localhost, 127.0.0.1).
 */
export function isPreviewOrDevOrigin(urlOrHost: string): boolean {
  const raw = (urlOrHost || '').trim().toLowerCase();
  if (!raw) return true;
  let host = raw;
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      host = new URL(raw).hostname.toLowerCase();
    }
  } catch {}
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('ais-dev-') ||
    host.startsWith('ais-pre-') ||
    host.includes('ais-dev-') ||
    host.includes('ais-pre-') ||
    host.endsWith('.run.app') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.includes('.cloudworkstations.dev') ||
    host.endsWith('.webcontainer.io')
  );
}

/**
 * Returns the configured public APP_URL if explicitly set to a public non-preview domain.
 */
export function getConfiguredPublicAppUrl(): string {
  const candidates: string[] = [];
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    if (metaEnv?.VITE_APP_URL) candidates.push(String(metaEnv.VITE_APP_URL));
    if (metaEnv?.APP_URL) candidates.push(String(metaEnv.APP_URL));
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env?.APP_URL) {
      candidates.push(String(process.env.APP_URL));
    }
  } catch {}

  for (const candidate of candidates) {
    const cleaned = candidate.trim().replace(/\/+$/, '');
    if (cleaned && !isPreviewOrDevOrigin(cleaned)) {
      return cleaned;
    }
  }
  return '';
}

/**
 * Returns true if a public non-preview APP_URL is configured.
 * Used by the Host System Check to warn when APP_URL is unset and falling back to production origin.
 */
export function isPublicAppUrlConfigured(): boolean {
  return Boolean(getConfiguredPublicAppUrl());
}

/**
 * Returns the canonical public base URL for invite, album, and QR links.
 * Never uses window.location.origin when it is a preview or dev domain (e.g., ais-dev-...).
 * If APP_URL is unset, falls back to the site's production origin (https://kohot.classalbum.workers.dev).
 */
export function getAppBaseUrl(): string {
  const configuredUrl = getConfiguredPublicAppUrl();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    const hostname = window.location.hostname || '';
    if (!isPreviewOrDevOrigin(hostname)) {
      const pathname = window.location.pathname || '';
      const cleanPath = pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
      return `${window.location.origin}${cleanPath}`;
    }
  }

  return PRODUCTION_ORIGIN;
}

export interface SetUrlParams {
  id: string;
  inviteCode?: string;
  institutionId?: string;
  departmentId?: string;
  departmentName?: string;
  graduationYear?: number;
  classSetName?: string;
}

/**
 * Generates or returns the deterministic short invite code for a class set.
 * Generated once per set and stored in class_sets.invite_code.
 */
export function getOrCreateInviteCode(setOrId: SetUrlParams | string): string {
  if (typeof setOrId !== 'string' && setOrId.inviteCode && setOrId.inviteCode.trim()) {
    return setOrId.inviteCode.trim();
  }
  const rawId = typeof setOrId === 'string' ? setOrId.trim() : (setOrId.id || '').trim();
  if (!rawId) return 'kohot26';

  // Known deterministic short codes for Crownfield demo sets
  if (rawId === 'crownfield-law-2026') return 'cflaw26';
  if (rawId === 'crownfield-law-2025') return 'cflaw25';
  if (rawId === 'crownfield-law-2024') return 'cflaw24';
  if (rawId === 'crownfield-law-2023') return 'cflaw23';

  // Deterministic 7-char base36 code derived from set ID so even before DB sync it resolves identically
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < rawId.length; i++) {
    const ch = rawId.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  let code = '';
  let v1 = h1;
  let v2 = h2;
  for (let i = 0; i < 7; i++) {
    const idx = ((i % 2 === 0 ? v1 : v2) + i * 7) % alphabet.length;
    code += alphabet[idx];
    if (i % 2 === 0) v1 = Math.floor(v1 / alphabet.length);
    else v2 = Math.floor(v2 / alphabet.length);
  }
  return code;
}

/**
 * Generates the short invite link (/i/{code}) which 302-redirects to the full invite link.
 */
export function getShortInviteUrl(setOrId: SetUrlParams | string): string {
  const base = getAppBaseUrl();
  const code = getOrCreateInviteCode(setOrId);
  return `${base}/i/${encodeURIComponent(code)}`;
}

/**
 * Generates an invite link for student profile submissions.
 * Includes both search parameters and hash fragment to guarantee delivery
 * through WhatsApp, Telegram, Twitter, and native SMS.
 */
export function getSubmitUrl(setOrId: SetUrlParams | string): string {
  const base = getAppBaseUrl();
  if (typeof setOrId === 'string') {
    const params = new URLSearchParams();
    params.set('submit', setOrId);
    return `${base}/?${params.toString()}#submit-${setOrId}`;
  }
  const set = setOrId;
  const params = new URLSearchParams();
  params.set('submit', set.id);
  if (set.institutionId) params.set('uni', set.institutionId);
  if (set.departmentId) params.set('deptId', set.departmentId);
  if (set.departmentName) params.set('dept', set.departmentName);
  if (set.graduationYear) params.set('year', String(set.graduationYear));
  if (set.classSetName) params.set('name', set.classSetName);

  return `${base}/?${params.toString()}#submit-${set.id}`;
}

/**
 * Generates a direct class album viewing link.
 */
export function getAlbumUrl(setOrId: SetUrlParams | string): string {
  const base = getAppBaseUrl();
  if (typeof setOrId === 'string') {
    const params = new URLSearchParams();
    params.set('album', setOrId);
    return `${base}/?${params.toString()}#album-${setOrId}`;
  }
  const set = setOrId;
  const params = new URLSearchParams();
  params.set('album', set.id);
  if (set.institutionId) params.set('uni', set.institutionId);
  if (set.departmentId) params.set('deptId', set.departmentId);
  if (set.departmentName) params.set('dept', set.departmentName);
  if (set.graduationYear) params.set('year', String(set.graduationYear));
  if (set.classSetName) params.set('name', set.classSetName);

  return `${base}/?${params.toString()}#album-${set.id}`;
}

export const getInviteShareLink = getSubmitUrl;
export const getAlbumShareLink = getAlbumUrl;

/**
 * Generates a department legacy plaque QR / corridor scan link.
 */
export function getDepartmentPlaqueUrl(deptId: string, uniId?: string): string {
  const base = getAppBaseUrl();
  const params = new URLSearchParams();
  params.set('dept', deptId);
  if (uniId) params.set('uni', uniId);
  return `${base}/?${params.toString()}#dept-${deptId}`;
}

/**
 * Reliable clipboard copy that handles iframes and restricted navigator permissions.
 */
export async function copyUrlToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback for iframe restrictions
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Resolves an existing class set from memory, or synthesizes a valid accredited
 * set if opened via an invite/album link on a device where local storage has not yet synced.
 */
export function resolveOrSynthesizeSet(
  matchedSetId: string | null,
  currentSets: ClassSet[],
  currentUnis: UniversityDirectoryItem[],
  params?: URLSearchParams
): { set: ClassSet; isSynthesized: boolean } {
  const fallback: ClassSet = currentSets[0] || {
    id: 'unilag-cs-2026',
    institutionId: 'unilag',
    institutionName: 'University of Lagos',
    institutionLogoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=200&auto=format&fit=crop&q=80',
    departmentId: 'dept-unilag-cs',
    departmentName: 'Computer Science',
    faculty: 'Faculty of Science',
    graduationYear: 2026,
    classSetName: "Computer Science Class of '26",
    isFoundingClass: true,
    estimatedGraduatesCount: 120,
    classRepName: 'Oluwaseun Danladi',
    classRepEmail: 'rep@unilag.edu',
    classRepPhone: '+234 812 345 6789',
    activationStatus: 'active',
    activationDate: '2026-01-15',
    activationRef: 'KOHOT-FND-001',
    bannerImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
    legacyGroupImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
    ourStory: '',
    students: [],
    memories: [],
    awards: [],
    voices: [],
    videos: [],
    socials: { youtube: '', instagram: '', twitter: '', linkedin: '', website: '' },
  };

  const targetId = matchedSetId || params?.get('submit') || params?.get('album') || '';
  if (!targetId) {
    return { set: fallback, isSynthesized: false };
  }

  // 1. Direct match in existing sets
  const existing = currentSets.find((s) => s.id === targetId);
  if (existing) {
    return { set: existing, isSynthesized: false };
  }

  // 2. Synthesize using URL params and the university directory
  const paramUniId = params?.get('uni');
  const paramDeptName = params?.get('dept');
  const paramDeptId = params?.get('deptId');
  const paramYear = params?.get('year') ? Number(params.get('year')) : undefined;
  const paramName = params?.get('name');

  const matchedUni: UniversityDirectoryItem =
    currentUnis.find((u) => u.id === paramUniId || targetId.startsWith(`${u.id}-`)) ||
    currentUnis[0];

  const yearMatch = targetId.match(/-(\d{4})$/);
  const gradYear = paramYear || (yearMatch ? Number(yearMatch[1]) : 2025);

  let matchedDept = matchedUni?.departments?.find(
    (d) => d.id === paramDeptId || (paramDeptName && d.name.toLowerCase() === paramDeptName.toLowerCase())
  );

  if (!matchedDept && matchedUni?.departments) {
    matchedDept = matchedUni.departments.find(
      (d) =>
        targetId.includes(d.id.replace(/^dept-/, '')) ||
        targetId.toLowerCase().includes(d.name.toLowerCase().replace(/[^a-z0-9]/g, '-'))
    );
  }

  const deptName = paramDeptName || matchedDept?.name || 'Department Cohort';
  const deptId =
    paramDeptId ||
    matchedDept?.id ||
    `dept-${matchedUni.id}-${deptName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  const synthesized: ClassSet = {
    id: targetId,
    institutionId: matchedUni.id,
    institutionName: matchedUni.name,
    institutionLogoUrl: matchedUni.logoUrl,
    departmentId: deptId,
    departmentName: deptName,
    faculty: matchedDept?.faculty || 'General Faculty',
    graduationYear: gradYear,
    classSetName: paramName || `${deptName} Class of '${String(gradYear).slice(-2)}`,
    isFoundingClass: true,
    estimatedGraduatesCount: 100,
    classRepName: 'Class Representative',
    classRepEmail: 'rep@institution.edu',
    classRepPhone: '+234 800 000 0000',
    activationStatus: 'active',
    activationDate: new Date().toISOString().split('T')[0],
    activationRef: `KOHOT-EXP-${gradYear}`,
    bannerImageUrl:
      matchedDept?.heroImageUrl ||
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
    legacyGroupImageUrl:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
    ourStory: '',
    students: [],
    memories: [],
    awards: [],
    voices: [],
    videos: [],
    socials: { youtube: '', instagram: '', twitter: '', linkedin: '', website: '' },
  };

  return { set: synthesized, isSynthesized: true };
}
