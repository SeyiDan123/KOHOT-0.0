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

export const STORAGE_KEY_TESTIMONIALS = 'kohot_testimonials_records_v2';
export const STORAGE_KEY_DEMO_TESTIMONIALS_SEEDED = 'kohot_demo_testimonials_seeded_v2';
export const STORAGE_KEY_TESTIMONIAL_REQUESTS = 'kohot_testimonial_request_statuses_v1';

export const DEMO_SAMPLE_TESTIMONIALS: TestimonialRecord[] = [
  {
    id: 'demo-test-1',
    name: 'Chiemeka Anthony Eze',
    fullName: 'Chiemeka Anthony Eze',
    authorName: 'Chiemeka Anthony Eze',
    email: 'chiemeka.eze@crownfield.edu.ng',
    role: 'Class Album Admin',
    authorRole: 'Class Album Admin',
    university: 'Crownfield University',
    universityName: 'Crownfield University',
    institutionName: 'Crownfield University',
    universityId: 'crownfield',
    department: 'Department of Public Law',
    departmentName: 'Department of Public Law',
    departmentId: 'dept-crownfield-law',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026 · Lex Invicta',
    setId: 'crownfield-law-2026',
    avatarUrl: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&auto=format&fit=crop&q=80',
    photoUrl: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&auto=format&fit=crop&q=80',
    testimonialText:
      'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening and our Public Law album came together effortlessly.',
    quote:
      'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening and our Public Law album came together effortlessly.',
    shortQuote:
      'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening and our Public Law album came together effortlessly.',
    submissionDate: '2026-01-15',
    createdAt: '2026-01-15T10:00:00.000Z',
    submittedAt: '2026-01-15T10:00:00.000Z',
    publicationPermission: 'public',
    permissionGranted: true,
    status: 'Approved',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 1,
  },
  {
    id: 'demo-test-2',
    name: 'Olumide Babatunde Bankole',
    fullName: 'Olumide Babatunde Bankole',
    authorName: 'Olumide Babatunde Bankole',
    email: 'olumide.bankole@crownfield.edu.ng',
    role: 'Class Album Admin',
    authorRole: 'Class Album Admin',
    university: 'Crownfield University',
    universityName: 'Crownfield University',
    institutionName: 'Crownfield University',
    universityId: 'crownfield',
    department: 'Department of Public Law',
    departmentName: 'Department of Public Law',
    departmentId: 'dept-crownfield-law',
    classYear: 2025,
    graduationYear: 2025,
    classSetName: 'Class of 2025 · The Jurisprudents',
    setId: 'crownfield-law-2025',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    testimonialText:
      'I didn’t have to design anything manually. I approved classmate profiles, organized our Dinner Night moments, and handed the department baton directly to the 2026 set.',
    quote:
      'I didn’t have to design anything manually. I approved classmate profiles, organized our Dinner Night moments, and handed the department baton directly to the 2026 set.',
    shortQuote:
      'I didn’t have to design anything manually. I approved classmate profiles, organized our Dinner Night moments, and handed the department baton directly to the 2026 set.',
    submissionDate: '2025-11-16',
    createdAt: '2025-11-16T10:00:00.000Z',
    submittedAt: '2025-11-16T10:00:00.000Z',
    publicationPermission: 'public',
    permissionGranted: true,
    status: 'Approved',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 2,
  },
  {
    id: 'demo-test-3',
    name: 'Hauwa Maryam Abdullahi',
    fullName: 'Hauwa Maryam Abdullahi',
    authorName: 'Hauwa Maryam Abdullahi',
    email: 'hauwa.abdullahi@unilorin.edu.ng',
    role: 'Class Album Admin',
    authorRole: 'Class Album Admin',
    university: 'University of Ilorin (UNILORIN)',
    universityName: 'University of Ilorin (UNILORIN)',
    institutionName: 'University of Ilorin (UNILORIN)',
    universityId: 'unilorin',
    department: 'Common Law',
    departmentName: 'Common Law',
    departmentId: 'dept-unilorin-law',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'unilorin-law-2026',
    avatarUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&auto=format&fit=crop&q=80',
    photoUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&auto=format&fit=crop&q=80',
    testimonialText:
      'Seeing every graduating class side by side on our department legacy wall makes our faculty feel like it has a living, breathing archive that our juniors can build upon.',
    quote:
      'Seeing every graduating class side by side on our department legacy wall makes our faculty feel like it has a living, breathing archive that our juniors can build upon.',
    shortQuote:
      'Seeing every graduating class side by side on our department legacy wall makes our faculty feel like it has a living, breathing archive that our juniors can build upon.',
    submissionDate: '2026-01-17',
    createdAt: '2026-01-17T10:00:00.000Z',
    submittedAt: '2026-01-17T10:00:00.000Z',
    publicationPermission: 'public',
    permissionGranted: true,
    status: 'Approved',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 3,
  },
  {
    id: 'demo-test-4',
    name: 'Adedayo Mofeoluwa',
    fullName: 'Adedayo Mofeoluwa',
    authorName: 'Adedayo Mofeoluwa',
    email: 'adedayo.mofeoluwa@oauife.edu.ng',
    role: 'Class Album Admin',
    authorRole: 'Class Album Admin',
    university: 'Obafemi Awolowo University (OAU)',
    universityName: 'Obafemi Awolowo University (OAU)',
    institutionName: 'Obafemi Awolowo University (OAU)',
    universityId: 'oau',
    department: 'Computer Science and Engineering',
    departmentName: 'Computer Science and Engineering',
    departmentId: 'dept-oau-cse',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'oau-cse-2026',
    avatarUrl: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400&auto=format&fit=crop&q=80',
    photoUrl: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400&auto=format&fit=crop&q=80',
    testimonialText:
      'It opens fast on every phone, and our parents could browse our entire Great Ife class album, leadership honorees, and final-year moments from one link.',
    quote:
      'It opens fast on every phone, and our parents could browse our entire Great Ife class album, leadership honorees, and final-year moments from one link.',
    shortQuote:
      'It opens fast on every phone, and our parents could browse our entire Great Ife class album, leadership honorees, and final-year moments from one link.',
    submissionDate: '2026-01-18',
    createdAt: '2026-01-18T10:00:00.000Z',
    submittedAt: '2026-01-18T10:00:00.000Z',
    publicationPermission: 'public',
    permissionGranted: true,
    status: 'Approved',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 4,
  },
  {
    id: 'demo-test-5',
    name: 'Zainab Bukola Balogun',
    fullName: 'Zainab Bukola Balogun',
    authorName: 'Zainab Bukola Balogun',
    email: 'zainab.balogun@kwasu.edu.ng',
    role: 'Class Album Admin',
    authorRole: 'Class Album Admin',
    university: 'Kwara State University (KWASU)',
    universityName: 'Kwara State University (KWASU)',
    institutionName: 'Kwara State University (KWASU)',
    universityId: 'kwasu',
    department: 'Aeronautical and Astronautical Engineering',
    departmentName: 'Aeronautical and Astronautical Engineering',
    departmentId: 'dept-kwasu-aae',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'kwasu-aae-2026',
    avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&auto=format&fit=crop&q=80',
    photoUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&auto=format&fit=crop&q=80',
    testimonialText:
      'Our portraits, convocation memories, and parting words are preserved in one dignified home that our set can revisit every anniversary.',
    quote:
      'Our portraits, convocation memories, and parting words are preserved in one dignified home that our set can revisit every anniversary.',
    shortQuote:
      'Our portraits, convocation memories, and parting words are preserved in one dignified home that our set can revisit every anniversary.',
    submissionDate: '2026-01-19',
    createdAt: '2026-01-19T10:00:00.000Z',
    submittedAt: '2026-01-19T10:00:00.000Z',
    publicationPermission: 'public',
    permissionGranted: true,
    status: 'Approved',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 5,
  },
];

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



