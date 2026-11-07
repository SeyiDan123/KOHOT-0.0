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

export const INITIAL_UNIVERSITIES: UniversityDirectoryItem[] = [
  UNILORIN_UNIVERSITY,
  {
    id: 'unilag',
    orderNumber: 2,
    name: 'University of Lagos (UNILAG)',
    shortCode: 'UNILAG',
    location: 'Akoka, Yaba, Lagos',
    logoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=160&auto=format&fit=crop&q=80',
    officialWebsite: 'https://unilag.edu.ng',
    motto: 'In Deed and in Truth',
    departments: [
      {
        id: 'dept-unilag-cs',
        universityId: 'unilag',
        name: 'Computer Science',
        code: 'CSC',
        faculty: 'Faculty of Science',
        logoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80',
        caption: 'Pioneering algorithmic excellence, software leadership, and digital transformation across Africa. Home to over five decades of groundbreaking tech innovators, researchers, and global industry captains.',
        officialPortal: 'https://csc.unilag.edu.ng',
        hodName: 'Prof. O. Balogun',
        legacy_status: 'available',
        legacyPlaqueInstalled: false,
        connectedClassAlbumIds: [],
      },
      {
        id: 'dept-unilag-eee',
        universityId: 'unilag',
        name: 'Electrical & Electronics Engineering',
        code: 'EEE',
        faculty: 'Faculty of Engineering',
        logoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=80',
        caption: 'Empowering future power engineers, telecommunications pioneers, and hardware architects driving high-voltage and embedded systems innovation.',
        officialPortal: 'https://eee.unilag.edu.ng',
        hodName: 'Prof. A. S. Olabisi',
        legacy_status: 'pending_verification',
        legacyPlaqueInstalled: false,
        pendingFoundingRequestId: 'fnd-req-unilag-eee-2024',
        connectedClassAlbumIds: [],
      },
      {
        id: 'dept-unilag-law',
        universityId: 'unilag',
        name: 'Commercial & Corporate Law',
        code: 'LAW',
        faculty: 'Faculty of Law',
        logoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&auto=format&fit=crop&q=80',
        caption: 'Training eminent jurists, international arbitration practitioners, and legal luminaries upholding constitutional integrity and commercial excellence.',
        officialPortal: 'https://law.unilag.edu.ng',
        hodName: 'Prof. I. A. Nwosu',
        legacy_status: 'available',
        legacyPlaqueInstalled: false,
        connectedClassAlbumIds: [],
      },
    ],
    faculties: [
      {
        facultyName: 'Faculty of Science',
        departments: [
          'Computer Science',
          'Mathematics',
          'Physics',
          'Chemistry',
          'Microbiology',
          'Cell Biology & Genetics',
        ],
      },
      {
        facultyName: 'Faculty of Engineering',
        departments: [
          'Electrical & Electronics Engineering',
          'Mechanical Engineering',
          'Civil & Environmental Engineering',
          'Systems Engineering',
          'Chemical Engineering',
        ],
      },
      {
        facultyName: 'Faculty of Social Sciences',
        departments: [
          'Economics',
          'Mass Communication',
          'Political Science',
          'Sociology',
          'Psychology',
        ],
      },
      {
        facultyName: 'Faculty of Law',
        departments: ['Commercial Law', 'Private & Property Law', 'Public Law', 'Jurisprudence & International Law'],
      },
      {
        facultyName: 'College of Medicine',
        departments: ['Medicine & Surgery (MBBS)', 'Dentistry', 'Pharmacy', 'Physiotherapy', 'Nursing Science'],
      },
    ],
  },
  {
    id: 'ui',
    orderNumber: 2,
    name: 'University of Ibadan (UI)',
    shortCode: 'UI',
    location: 'Ibadan, Oyo State',
    logoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=160&auto=format&fit=crop&q=80',
    officialWebsite: 'https://ui.edu.ng',
    motto: 'Recte Sapere Fons',
    departments: [
      {
        id: 'dept-ui-mbbs',
        universityId: 'ui',
        name: 'Medicine & Surgery (MBBS)',
        code: 'MBBS',
        faculty: 'Faculty of Clinical Sciences',
        logoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&auto=format&fit=crop&q=85',
        caption: 'The premier college of medicine in Sub-Saharan Africa, dedicated to exemplary clinical acumen, biomedical discovery, and compassionate healthcare delivery.',
        officialPortal: 'https://com.ui.edu.ng',
        hodName: 'Prof. K. A. Adeleke',
        legacy_status: 'available',
        legacyPlaqueInstalled: false,
        connectedClassAlbumIds: [],
      },
      {
        id: 'dept-ui-cs',
        universityId: 'ui',
        name: 'Computer Science',
        code: 'CSC',
        faculty: 'Faculty of Technology',
        logoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80',
        caption: 'Cultivating rigorous computational theory, advanced intelligence, and impactful cybernetic research in the historic ancient city of Ibadan.',
        officialPortal: 'https://tech.ui.edu.ng/cs',
        hodName: 'Prof. T. O. Falade',
        legacy_status: 'available',
        legacyPlaqueInstalled: false,
        connectedClassAlbumIds: [],
      },
    ],
    faculties: [
      {
        facultyName: 'Faculty of Technology',
        departments: [
          'Computer Science',
          'Electrical & Electronics Engineering',
          'Agricultural & Environmental Engineering',
          'Civil Engineering',
        ],
      },
      {
        facultyName: 'Faculty of Arts',
        departments: ['English & Literary Studies', 'History', 'Philosophy', 'Theatre Arts', 'Classics'],
      },
      {
        facultyName: 'Faculty of Clinical Sciences',
        departments: ['Medicine & Surgery', 'Physiology', 'Biochemistry', 'Human Nutrition'],
      },
    ],
  },
  {
    id: 'oau',
    orderNumber: 3,
    name: 'Obafemi Awolowo University (OAU)',
    shortCode: 'OAU',
    location: 'Ile-Ife, Osun State',
    logoUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=160&auto=format&fit=crop&q=80',
    officialWebsite: 'https://oauife.edu.ng',
    motto: 'For Learning and Culture',
    departments: [
      {
        id: 'dept-oau-cse',
        universityId: 'oau',
        name: 'Computer Science & Engineering',
        code: 'CSE',
        faculty: 'Faculty of Technology',
        logoUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1600&auto=format&fit=crop&q=80',
        caption: 'Nurturing relentless software innovators and computational architects on the beautiful architectural campus of Great Ife.',
        officialPortal: 'https://oauife.edu.ng/cse',
        hodName: 'Dr. M. A. Adegoke',
        legacy_status: 'pending_verification',
        legacyPlaqueInstalled: false,
        pendingFoundingRequestId: 'fnd-req-oau-cse-2025',
        connectedClassAlbumIds: [],
      },
    ],
    faculties: [
      {
        facultyName: 'Faculty of Technology',
        departments: [
          'Computer Science & Engineering',
          'Electronic & Electrical Engineering',
          'Mechanical Engineering',
          'Chemical Engineering',
        ],
      },
      {
        facultyName: 'Faculty of Environmental Design & Management',
        departments: ['Architecture', 'Urban & Regional Planning', 'Estate Management', 'Quantity Surveying'],
      },
      {
        facultyName: 'Faculty of Administration',
        departments: ['Accounting', 'Business Administration', 'Public Administration', 'International Relations'],
      },
    ],
  },
  {
    id: 'covenant',
    orderNumber: 4,
    name: 'Covenant University (CU)',
    shortCode: 'CU',
    location: 'Ota, Ogun State',
    logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=160&auto=format&fit=crop&q=80',
    officialWebsite: 'https://covenantuniversity.edu.ng',
    motto: 'Raising a New Generation of Leaders',
    departments: [
      {
        id: 'dept-covenant-arch',
        universityId: 'covenant',
        name: 'Architecture',
        code: 'ARC',
        faculty: 'College of Science & Technology',
        logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&auto=format&fit=crop&q=85',
        caption: 'Fostering avant-garde spatial design, sustainable urban morphology, and structural ingenuity for the contemporary African metropolis.',
        officialPortal: 'https://cst.covenantuniversity.edu.ng/architecture',
        hodName: 'Dr. B. Oladunni',
      },
      {
        id: 'dept-covenant-cs',
        universityId: 'covenant',
        name: 'Computer Science',
        code: 'CSC',
        faculty: 'College of Science & Technology',
        logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80',
        caption: 'Raising expert software engineers and cyber leaders equipped with visionary ethics and cutting-edge technical acumen.',
        officialPortal: 'https://covenantuniversity.edu.ng',
        hodName: 'Prof. A. A. Azeta',
      },
    ],
    faculties: [
      {
        facultyName: 'College of Science & Technology',
        departments: [
          'Computer Science',
          'Management Information System (MIS)',
          'Building Technology',
          'Biochemistry',
          'Architecture',
        ],
      },
      {
        facultyName: 'College of Engineering',
        departments: [
          'Information & Communication Engineering',
          'Electrical & Electronics Engineering',
          'Civil Engineering',
          'Petroleum Engineering',
        ],
      },
    ],
  },
  {
    id: 'unn',
    orderNumber: 5,
    name: 'University of Nigeria, Nsukka (UNN)',
    shortCode: 'UNN',
    location: 'Nsukka, Enugu State',
    logoUrl: 'https://images.unsplash.com/photo-1532649538693-f3a2ec1bf8bd?w=160&auto=format&fit=crop&q=80',
    officialWebsite: 'https://unn.edu.ng',
    motto: 'To Restore the Dignity of Man',
    departments: [
      {
        id: 'dept-unn-cs',
        universityId: 'unn',
        name: 'Computer Science',
        code: 'CSC',
        faculty: 'Faculty of Physical Sciences',
        logoUrl: 'https://images.unsplash.com/photo-1532649538693-f3a2ec1bf8bd?w=160&auto=format&fit=crop&q=80',
        heroImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80',
        caption: 'Historic cradle of computational sciences in Eastern Nigeria, restoring human dignity through technological innovation.',
        officialPortal: 'https://unn.edu.ng/department-of-computer-science',
        hodName: 'Prof. E. C. Okeke',
      },
    ],
    faculties: [
      {
        facultyName: 'Faculty of Physical Sciences',
        departments: ['Computer Science', 'Statistics', 'Geology', 'Pure & Industrial Chemistry'],
      },
      {
        facultyName: 'Faculty of Pharmaceutical Sciences',
        departments: ['Pharmacy', 'Pharmacology & Toxicology', 'Pharmaceutics'],
      },
    ],
  },
];

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

export const STORAGE_KEY_TESTIMONIALS = 'kohot_testimonials_records_v1';
export const STORAGE_KEY_DEMO_TESTIMONIALS_SEEDED = 'kohot_demo_testimonials_seeded_v1';
export const STORAGE_KEY_TESTIMONIAL_REQUESTS = 'kohot_testimonial_request_statuses_v1';

export const DEMO_SAMPLE_TESTIMONIALS: TestimonialRecord[] = [
  {
    id: 'demo-test-1',
    name: 'Chiamaka O.',
    authorName: 'Chiamaka O.',
    email: 'sample@kohot.invalid',
    role: 'Class Representative',
    authorRole: 'Class Representative',
    university: 'Sample University',
    universityName: 'Sample University',
    universityId: 'sample-uni',
    department: 'Department of Law',
    departmentName: 'Department of Law',
    departmentId: 'dept-sample-law',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'sample-set-2026',
    testimonialText:
      'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening.',
    quote:
      'We stopped chasing classmates for photos in WhatsApp groups. Everyone submitted their own profile in one evening.',
    submissionDate: '2026-01-15',
    createdAt: '2026-01-15T10:00:00.000Z',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 1,
  },
  {
    id: 'demo-test-2',
    name: 'Tunde A.',
    authorName: 'Tunde A.',
    email: 'sample@kohot.invalid',
    role: 'Final-year student',
    authorRole: 'Final-year student',
    university: 'Sample University',
    universityName: 'Sample University',
    universityId: 'sample-uni',
    department: 'Department of Law',
    departmentName: 'Department of Law',
    departmentId: 'dept-sample-law',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'sample-set-2026',
    testimonialText:
      'It opens fast on my phone, and my parents could browse our whole album from one link.',
    quote:
      'It opens fast on my phone, and my parents could browse our whole album from one link.',
    submissionDate: '2026-01-16',
    createdAt: '2026-01-16T10:00:00.000Z',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 2,
  },
  {
    id: 'demo-test-3',
    name: 'Hauwa M.',
    authorName: 'Hauwa M.',
    email: 'sample@kohot.invalid',
    role: 'Department President',
    authorRole: 'Department President',
    university: 'Sample University',
    universityName: 'Sample University',
    universityId: 'sample-uni',
    department: 'Department of Law',
    departmentName: 'Department of Law',
    departmentId: 'dept-sample-law',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'sample-set-2026',
    testimonialText:
      'Seeing every class on one legacy wall makes our department feel like it has a real history.',
    quote:
      'Seeing every class on one legacy wall makes our department feel like it has a real history.',
    submissionDate: '2026-01-17',
    createdAt: '2026-01-17T10:00:00.000Z',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 3,
  },
  {
    id: 'demo-test-4',
    name: 'Emeka N.',
    authorName: 'Emeka N.',
    email: 'sample@kohot.invalid',
    role: 'Class Album Admin',
    authorRole: 'Class Album Admin',
    university: 'Sample University',
    universityName: 'Sample University',
    universityId: 'sample-uni',
    department: 'Department of Law',
    departmentName: 'Department of Law',
    departmentId: 'dept-sample-law',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'sample-set-2026',
    testimonialText:
      "I didn't build anything. I approved profiles and added our event photos, and the album was ready.",
    quote:
      "I didn't build anything. I approved profiles and added our event photos, and the album was ready.",
    submissionDate: '2026-01-18',
    createdAt: '2026-01-18T10:00:00.000Z',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    isVisible: true,
    isDemo: true,
    displayOrder: 4,
  },
  {
    id: 'demo-test-5',
    name: 'Zainab B.',
    authorName: 'Zainab B.',
    email: 'sample@kohot.invalid',
    role: 'Graduate',
    authorRole: 'Graduate',
    university: 'Sample University',
    universityName: 'Sample University',
    universityId: 'sample-uni',
    department: 'Department of Law',
    departmentName: 'Department of Law',
    departmentId: 'dept-sample-law',
    classYear: 2026,
    graduationYear: 2026,
    classSetName: 'Class of 2026',
    setId: 'sample-set-2026',
    testimonialText:
      'My photo, my quote and my parting words are in one place I can open any time.',
    quote:
      'My photo, my quote and my parting words are in one place I can open any time.',
    submissionDate: '2026-01-19',
    createdAt: '2026-01-19T10:00:00.000Z',
    publicationPermission: 'public',
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



