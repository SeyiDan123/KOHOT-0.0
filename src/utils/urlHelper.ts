import { ClassSet, UniversityDirectoryItem } from '../types';

/**
 * URL and Deep-Linking Helper for KoHot Archival Systems
 * Guarantees that invite and album links remain durable and accessible
 * across external applications (WhatsApp, Telegram, X, SMS, Email, QR codes).
 */

export function getAppBaseUrl(): string {
  // If an environment APP_URL exists, use it when on localhost or private workstation hosts
  const envUrl = (typeof process !== 'undefined' && process.env?.APP_URL ? process.env.APP_URL : '').trim();

  if (typeof window === 'undefined') {
    return envUrl.replace(/\/+$/, '') || 'https://kohot.app';
  }

  const hostname = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : '';
  const isLocalOrWorkstation =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.includes('.cloudworkstations.dev');

  if (isLocalOrWorkstation && envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }

  // Use current origin and base pathname without trailing slash or index.html
  const origin = (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null')
    ? window.location.origin
    : '';
  const pathname = (typeof window !== 'undefined' && window.location?.pathname) ? window.location.pathname : '';
  const cleanPath = pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  return `${origin}${cleanPath}` || envUrl.replace(/\/+$/, '') || 'https://kohot.app';
}

export interface SetUrlParams {
  id: string;
  institutionId?: string;
  departmentId?: string;
  departmentName?: string;
  graduationYear?: number;
  classSetName?: string;
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
    ourStory: 'Permanent digital archive.',
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
    ourStory: `Official permanent digital archive for ${deptName}, ${matchedUni.name}.`,
    students: [],
    memories: [],
    awards: [],
    voices: [],
    videos: [],
    socials: { youtube: '', instagram: '', twitter: '', linkedin: '', website: '' },
  };

  return { set: synthesized, isSynthesized: true };
}
