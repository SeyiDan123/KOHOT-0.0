import {
  UniversityDirectoryItem,
  DepartmentItem,
  ClassSet,
  FinancialTransaction,
  DepartmentAdditionRequest,
  FoundingClassRequest,
  WebsiteContentOverride,
  UserAccount,
  TestimonialRecord,
  ClassAlbumRequest,
  NextClassHandoffInvite,
  AlbumDisputeRecord,
  AuditLogEntry,
} from '../types';
import { DEFAULT_LUXURY_THEMES } from '../utils/luxuryThemes';
import { CROWNFIELD_UNIVERSITY, CROWNFIELD_PUBLIC_LAW_SETS } from './crownfieldLawDemos';
import { UNILORIN_UNIVERSITY } from './unilorinDirectory';
import { OAU_UNIVERSITY, KWASU_UNIVERSITY } from './oauAndKwasuDirectories';
import { NIGERIAN_UNIVERSITIES_DIRECTORY } from './nigerianUniversitiesDirectory';

export const INITIAL_UNIVERSITIES: UniversityDirectoryItem[] = [
  UNILORIN_UNIVERSITY,
  OAU_UNIVERSITY,
  KWASU_UNIVERSITY,
  ...NIGERIAN_UNIVERSITIES_DIRECTORY,
].sort((a, b) => {
  const aPriority = a.isPriority ? 1 : 0;
  const bPriority = b.isPriority ? 1 : 0;
  if (aPriority !== bPriority) return bPriority - aPriority;
  return a.name.localeCompare(b.name);
});

export const INITIAL_SETS: ClassSet[] = [
  ...CROWNFIELD_PUBLIC_LAW_SETS,
];

// Start clean: no fake transactions, requests, testimonials, or admins except Crownfield static demo
export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [];

export const INITIAL_ADDITION_REQUESTS: DepartmentAdditionRequest[] = [];

export const INITIAL_FOUNDING_REQUESTS: FoundingClassRequest[] = [];

export const INITIAL_CONTENT_OVERRIDE: WebsiteContentOverride = {
  platformTitle: 'KoHot | The Curated Digital Class Album Platform',
  platformAnnouncement: 'Official Graduation Season: Secure your class legacy on KoHot with frictionless mobile photo submissions.',
  announcementActive: true,
  activationFeeUsd: 29.0,
  activationFeeNgn: 29000,
  whatsappSupportNumber: '+234 800 564 6827',
  supportEmail: 'concierge@kohot.app',
  termsSnippet: 'Strictly verified academic sets. Zero advertising. High-fidelity archival storage guaranteed.',
  globalMaxImageCap: 300,
  defaultCompressionResolution: 720,
  maxImagesPerAlbum: 400,
  showWebsiteStats: false,
  showTestimonialsSection: true,
  heroVideoUrl: '',
  albumBackgroundMusicUrl: '',
  classAlbumCardVideoUrl: '',
  legacyPlaqueCardVideoUrl: '',
  annualReminderCardVideoUrl: '',
  classAlbumTourUrl: '',
  legacyPlaqueTourUrl: '',
  annualReminderTourUrl: '',
  legacyBannerImages: [
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1600&auto=format&fit=crop',
  ],
  executiveBlastImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
  executiveBlastMessageTemplate: `Hello Department Executives & Student Leaders,\n\nPreserve the heritage, memories, and individual student achievements of your department's graduating class on KoHot.\n\nEstablish your official Department Class Album, install your corridor Legacy Plaque, and ensure your graduating set is remembered across generations.\n\nCreate your Class Album today at:\n{{website_url}}\n\nKoHot — Beautiful graduate memories live here.`,
  heroHeadlineLine1: 'Beautiful',
  heroHeadlineLine2: 'graduate memories',
  heroHeadlineLine3: 'live here',
  heroSubtitle: 'From your classmates and portraits to the moments, words and stories you shared, KoHot gives your graduating class a beautiful place to remember it all.',
  heroCtaButtonText: 'Create Class Album',
  heroExploreButtonText: 'Explore Demo Albums',
  heroVideoCaptionTitle: 'The Physical to Digital Gateway',
  heroVideoCaptionSubtext: 'Scan the corridor plaque • Open your preserved class album',
  pillarsEyebrow: 'THE THREE ELEMENTS',
  pillarsHeading: 'Everything your class needs to leave a legacy',
  pillarsSubtitle: 'Three essential elements to preserve your people, your memories, and your story.',
  pillar1Title: 'The Class Album',
  pillar1Description: 'A private, interactive digital home for your class. Full individual graduate profiles, memorable moments, candid stories, and shared photos.',
  pillar2Title: 'The Legacy Plaque',
  pillar2Description: 'A physical, beautifully cast plaque installed permanently in your department corridor. A scannable gateway connecting campus corridors to your class album.',
  pillar3Title: 'The Annual Reminder',
  pillar3Description: 'An automated anniversary tradition. Every year on convocation day, every graduate receives a nostalgic notification reconnecting them to their memories.',
  howItWorksEyebrow: 'THE JOURNEY',
  howItWorksHeading: 'How Your Class Leaves a Lasting Legacy',
  departmentLegacyTitle: 'ONE DEPARTMENT. MANY GENERATIONS.',
  departmentLegacyDescription: 'A living archive for your department. Preceding classes hand the baton forward, creating an unbroken chain of student milestones.',
  privacyGuaranteeTitle: 'Reassuring, Private & Student-Controlled',
  privacyGuaranteeDescription: 'Only classmates with verified invite links can upload or view unlisted albums. Student data is never sold or used for advertising.',
  testimonialsEyebrow: 'THE LEGACY, IN THEIR WORDS',
  testimonialsHeading: 'What Graduating Classes Say',
  testimonialsSubtitle: 'Real experiences from class representatives and graduates who archived their milestones on KoHot.',
  awardsEyebrow: 'OFFICIAL SPONSOR OF KOHOT’S LEGACY PRESERVATION',
  awardsHeading: 'KoHot Excellence & Class Legacy Awards',
  awardsBadge: 'COMING SOON',
  awardsDescription: 'Annual recognition celebrating the most creative class albums, outstanding department preservation, and legendary cohort class albums across universities.',
  darkLuxuryBackgrounds: DEFAULT_LUXURY_THEMES,
};

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-host',
    email: 'seyidan03@gmail.com',
    fullName: 'Seyi Dan',
    phone: '09036872687',
    role: 'master_host',
    masterToken: 'KOHOT-ROOT-2025',
  },
];

// Clean up any legacy data localStorage keys so browser keeps only UI preferences
export function purgeLegacyDataLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const legacyKeys = [
    'kohot_universities_v10',
    'kohot_sets_v12',
    'kohot_transactions_v2',
    'kohot_addition_requests_v1',
    'kohot_founding_requests_v1',
    'kohot_content_v2',
    'kohot_testimonials_records_v1',
    'kohot_testimonials_records_v2',
    'kohot_demo_testimonials_seeded_v2',
    'kohot_testimonial_request_statuses_v1',
    'kohot_class_album_requests_v1',
    'kohot_next_class_handoff_invites_v1',
    'kohot_album_disputes_v1',
    'kohot_audit_logs_v1',
  ];
  for (const k of legacyKeys) {
    try {
      window.localStorage.removeItem(k);
    } catch {}
  }
}

export function isCrownfieldDemoAlbum(idOrSet: string | ClassSet): boolean {
  const id = typeof idOrSet === 'string' ? idOrSet : idOrSet?.id;
  if (!id) return false;
  return CROWNFIELD_PUBLIC_LAW_SETS.some((d) => d.id === id) || String(id).startsWith('crownfield-');
}

export function getStoredUniversities(): UniversityDirectoryItem[] {
  return INITIAL_UNIVERSITIES;
}

export function saveStoredUniversities(_items: UniversityDirectoryItem[]): void {
  // Persisted to D1 via PUT /api/institutions (no browser localStorage data persistence)
}

export function getStoredSets(): ClassSet[] {
  return [...CROWNFIELD_PUBLIC_LAW_SETS];
}

export function saveStoredSets(_sets: ClassSet[]): void {
  // Persisted to D1 via POST/PUT /api/albums (Crownfield demo stays static in code)
}

export function getStoredTransactions(): FinancialTransaction[] {
  return INITIAL_TRANSACTIONS;
}

export function saveStoredTransactions(_txs: FinancialTransaction[]): void {
  // Persisted to D1 via POST /api/transactions
}

export function getStoredAdditionRequests(): DepartmentAdditionRequest[] {
  return INITIAL_ADDITION_REQUESTS;
}

export function saveStoredAdditionRequests(_reqs: DepartmentAdditionRequest[]): void {
  // Persisted to D1 via /api/department-requests
}

export function getStoredFoundingClassRequests(): FoundingClassRequest[] {
  return INITIAL_FOUNDING_REQUESTS;
}

export function saveStoredFoundingClassRequests(_reqs: FoundingClassRequest[]): void {
  // Founding class approval flow retired
}

export function getStoredContentOverride(): WebsiteContentOverride {
  return INITIAL_CONTENT_OVERRIDE;
}

export function saveStoredContentOverride(_content: WebsiteContentOverride): void {
  // Persisted to D1 via PUT /api/site-content
}

export function calculateTotalImages(sets: ClassSet[]): number {
  return sets.reduce((sum, s) => {
    const studentPhotos = s.students.length;
    const memoryPhotos = s.memories.reduce((mSum, m) => mSum + m.images.length, 0);
    const awardPhotos = s.awards.length;
    const voicePhotos = s.voices.length;
    const banners = 2; // banner and legacy group
    return sum + studentPhotos + memoryPhotos + awardPhotos + voicePhotos + banners;
  }, 0);
}

export const STORAGE_KEY_TESTIMONIALS = 'kohot_testimonials_records_v3';
export const STORAGE_KEY_DEMO_TESTIMONIALS_SEEDED = 'kohot_demo_testimonials_seeded_v3';
export const STORAGE_KEY_TESTIMONIAL_REQUESTS = 'kohot_testimonial_request_statuses_v1';

const DEMO_ADMIN_QUOTES_BY_YEAR: Record<number, { quote: string; date: string }> = {
  2026: {
    quote:
      'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening and our Public Law Class of 2026 album came together effortlessly.',
    date: '2026-01-15',
  },
  2025: {
    quote:
      'I didn’t have to design anything manually. I approved classmate profiles, organized our Law Dinner moments, and handed the department baton directly to the 2026 set.',
    date: '2025-11-16',
  },
  2024: {
    quote:
      'It opens fast on every phone, and our parents could browse our entire Phoenix Class of 2024 album, leadership honorees, and final-year moments from one link.',
    date: '2024-11-22',
  },
  2023: {
    quote:
      'Seeing every graduating class side by side on our department legacy wall makes our faculty feel like it has a living, breathing archive that our juniors can build upon.',
    date: '2023-11-25',
  },
};

export const DEMO_SAMPLE_TESTIMONIALS: TestimonialRecord[] = [...CROWNFIELD_PUBLIC_LAW_SETS]
  .sort((a, b) => b.graduationYear - a.graduationYear)
  .map((demoSet, idx) => {
    const adminStudent =
      demoSet.students.find(
        (s) => s.fullName.toLowerCase() === (demoSet.classRepName || '').toLowerCase()
      ) || demoSet.students[0];
    const adminPhoto =
      adminStudent?.photoUrl ||
      'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&auto=format&fit=crop&q=80';
    const quoteEntry = DEMO_ADMIN_QUOTES_BY_YEAR[demoSet.graduationYear] || {
      quote:
        'Our portraits, convocation memories, and parting words are preserved in one dignified home that our set can revisit every anniversary.',
      date: '2026-01-15',
    };
    const adminName = demoSet.classRepName || adminStudent?.fullName || 'Class Album Admin';
    const adminEmail = demoSet.classRepEmail || adminStudent?.email || 'admin@crownfield.edu.ng';

    return {
      id: `demo-test-${idx + 1}`,
      name: adminName,
      fullName: adminName,
      authorName: adminName,
      email: adminEmail,
      phone: demoSet.classRepPhone,
      role: 'Class Album Admin',
      authorRole: 'Class Album Admin',
      university: demoSet.institutionName,
      universityName: demoSet.institutionName,
      institutionName: demoSet.institutionName,
      universityId: demoSet.institutionId,
      department: demoSet.departmentName,
      departmentName: demoSet.departmentName,
      departmentId: demoSet.departmentId,
      classYear: demoSet.graduationYear,
      graduationYear: demoSet.graduationYear,
      classSetName: demoSet.classSetName,
      setId: demoSet.id,
      avatarUrl: adminPhoto,
      photoUrl: adminPhoto,
      testimonialText: quoteEntry.quote,
      quote: quoteEntry.quote,
      shortQuote: quoteEntry.quote,
      submissionDate: quoteEntry.date,
      createdAt: `${quoteEntry.date}T10:00:00.000Z`,
      submittedAt: `${quoteEntry.date}T10:00:00.000Z`,
      publicationPermission: 'public',
      permissionGranted: true,
      status: 'Approved',
      reviewStatus: 'approved',
      isFeatured: true,
      isVisible: true,
      isDemo: true,
      displayOrder: idx + 1,
    };
  });

export const INITIAL_TESTIMONIALS: TestimonialRecord[] = [...DEMO_SAMPLE_TESTIMONIALS];

let inMemoryTestimonials: TestimonialRecord[] | null = null;

export function getStoredTestimonials(): TestimonialRecord[] {
  if (inMemoryTestimonials !== null) {
    return inMemoryTestimonials;
  }
  try {
    if (typeof window !== 'undefined') {
      const seededFlag = window.localStorage.getItem(STORAGE_KEY_DEMO_TESTIMONIALS_SEEDED);
      const raw = window.localStorage.getItem(STORAGE_KEY_TESTIMONIALS);
      if (raw) {
        const parsed = JSON.parse(raw) as TestimonialRecord[];
        if (Array.isArray(parsed)) {
          if (!seededFlag) {
            window.localStorage.setItem(STORAGE_KEY_DEMO_TESTIMONIALS_SEEDED, '1');
            const existingIds = new Set(parsed.map((item) => item.id));
            const merged = [
              ...parsed,
              ...DEMO_SAMPLE_TESTIMONIALS.filter((d) => !existingIds.has(d.id)),
            ];
            window.localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(merged));
            inMemoryTestimonials = merged;
            return merged;
          }
          inMemoryTestimonials = parsed;
          return parsed;
        }
      }
      if (!seededFlag) {
        window.localStorage.setItem(STORAGE_KEY_DEMO_TESTIMONIALS_SEEDED, '1');
        window.localStorage.setItem(
          STORAGE_KEY_TESTIMONIALS,
          JSON.stringify(DEMO_SAMPLE_TESTIMONIALS)
        );
        inMemoryTestimonials = [...DEMO_SAMPLE_TESTIMONIALS];
        return inMemoryTestimonials;
      }
    }
  } catch {
    // ignore localStorage errors
  }
  inMemoryTestimonials = [...DEMO_SAMPLE_TESTIMONIALS];
  return inMemoryTestimonials;
}

export function saveStoredTestimonials(testimonials: TestimonialRecord[]): void {
  inMemoryTestimonials = testimonials;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_DEMO_TESTIMONIALS_SEEDED, '1');
      window.localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(testimonials));
    }
  } catch {
    // ignore localStorage errors
  }
}

export const STORAGE_KEY_CLASS_ALBUM_REQUESTS = 'kohot_class_album_requests_v1';
export const INITIAL_CLASS_ALBUM_REQUESTS: ClassAlbumRequest[] = [];

export function getStoredClassAlbumRequests(): ClassAlbumRequest[] {
  return INITIAL_CLASS_ALBUM_REQUESTS;
}

export function saveStoredClassAlbumRequests(_requests: ClassAlbumRequest[]): void {}

export const STORAGE_KEY_NEXT_CLASS_INVITES = 'kohot_next_class_handoff_invites_v1';
export const INITIAL_NEXT_CLASS_INVITES: NextClassHandoffInvite[] = [];

export function getStoredNextClassInvites(): NextClassHandoffInvite[] {
  return INITIAL_NEXT_CLASS_INVITES;
}

export function saveStoredNextClassInvites(_invites: NextClassHandoffInvite[]): void {}

export const STORAGE_KEY_ALBUM_DISPUTES = 'kohot_album_disputes_v1';
export const INITIAL_ALBUM_DISPUTES: AlbumDisputeRecord[] = [];

export function getStoredAlbumDisputes(): AlbumDisputeRecord[] {
  return INITIAL_ALBUM_DISPUTES;
}

export function saveStoredAlbumDisputes(_disputes: AlbumDisputeRecord[]): void {}

export const STORAGE_KEY_AUDIT_LOGS = 'kohot_audit_logs_v1';
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export function getStoredAuditLogs(): AuditLogEntry[] {
  return INITIAL_AUDIT_LOGS;
}

export function saveStoredAuditLogs(_logs: AuditLogEntry[]): void {}



