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

export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'tx-101',
    reference: 'KOHOT-TX-98201',
    date: '2024-06-12 14:23',
    setId: 'unilag-cs-2024',
    setName: 'The Nexus Pioneers (UNILAG CompSci 2024)',
    institution: 'University of Lagos',
    amount: 0,
    currency: 'NGN',
    status: 'Paid',
    source: 'class_album',
    category: 'Class Album Preservation',
    payerName: 'Oluwaseun Danladi (Class Album Admin)',
    payerEmail: 'admin.cs24@unilag.edu.ng',
    notes: 'Official Class Album digital preservation record.',
  },
  {
    id: 'tx-102',
    reference: 'KOHOT-TX-98202',
    date: '2026-06-12 11:05',
    setId: 'unilag-cs-2026',
    setName: 'The Tech Titans \'26 (UNILAG CompSci 2026)',
    institution: 'University of Lagos',
    amount: 0,
    currency: 'NGN',
    status: 'Paid',
    source: 'class_album',
    category: 'Class Album Preservation',
    payerName: 'Oluwaseun Danladi (Class Album Admin)',
    payerEmail: 'admin.cs26@unilag.edu.ng',
    notes: 'Official Class Album digital preservation record.',
  },
  {
    id: 'tx-103',
    reference: 'KOHOT-TX-98203',
    date: '2024-08-01 09:40',
    setId: 'oau-arch-2024',
    setName: 'Vitruvian Guild (OAU Architecture 2024)',
    institution: 'Obafemi Awolowo University',
    amount: 0,
    currency: 'NGN',
    status: 'Paid',
    source: 'class_album',
    category: 'Class Album Preservation',
    payerName: 'Tunde Adelegan (Class Album Admin)',
    payerEmail: 'adelegan.t@oauife.edu.ng',
    notes: 'Official Class Album digital preservation record.',
  },
];

export const INITIAL_ADDITION_REQUESTS: DepartmentAdditionRequest[] = [
  {
    id: 'req-01',
    institutionName: 'Federal University of Technology, Akure (FUTA)',
    requestedDepartment: 'Cybersecurity Science',
    facultyName: 'School of Computing',
    requesterName: 'Emmanuel Adeyemi',
    requesterEmail: 'rep.futa.cyber@gmail.com',
    requesterPhone: '+234 816 778 9900',
    notes: 'Graduating set of 85 students eagerly waiting to launch their KoHot album.',
    status: 'Pending',
    timestamp: '2024-08-14 16:20',
  },
];

export const INITIAL_FOUNDING_REQUESTS: FoundingClassRequest[] = [
  {
    id: 'fnd-req-unilag-eee-2024',
    universityId: 'unilag',
    universityName: 'University of Lagos (UNILAG)',
    facultyName: 'Faculty of Engineering',
    departmentId: 'dept-unilag-eee',
    departmentName: 'Electrical & Electronics Engineering',
    classYear: 2024,
    classSetName: 'The Tesla Cohort \'24',
    applicantName: 'Babatunde Alabi',
    applicantEmail: 'alabi.eee@unilag.edu.ng',
    applicantPhone: '+234 815 444 9900',
    estimatedGraduatesCount: 95,
    status: 'Pending',
    submissionDate: '2024-09-14 14:15',
    reviewNotes: 'Pioneer cohort application submitted by elected Class Representative with faculty adviser endorsement.',
  },
  {
    id: 'fnd-req-oau-cse-2025',
    universityId: 'oau',
    universityName: 'Obafemi Awolowo University (OAU)',
    facultyName: 'Faculty of Technology',
    departmentId: 'dept-oau-cse',
    departmentName: 'Computer Science & Engineering',
    classYear: 2025,
    classSetName: 'The Turing Guild \'25',
    applicantName: 'Tunde Adelegan',
    applicantEmail: 'adelegan.t@oauife.edu.ng',
    applicantPhone: '+234 803 777 2211',
    estimatedGraduatesCount: 110,
    status: 'Pending',
    submissionDate: '2024-09-12 10:30',
    reviewNotes: 'Faculty board verification in progress. Accreditation verified.',
  },
];

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
  // Website section text defaults
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

// Local storage keys
const STORAGE_KEY_UNIVERSITIES = 'kohot_universities_v10';
const STORAGE_KEY_SETS = 'kohot_sets_v12';
const STORAGE_KEY_TX = 'kohot_transactions_v2';
const STORAGE_KEY_REQUESTS = 'kohot_addition_requests_v1';
const STORAGE_KEY_FOUNDING_REQUESTS = 'kohot_founding_requests_v1';
const STORAGE_KEY_CONTENT = 'kohot_content_v2';
const STORAGE_KEY_CURRENT_USER = 'kohot_current_user_v1';

export function getStoredUniversities(): UniversityDirectoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNIVERSITIES);
    if (!raw) return INITIAL_UNIVERSITIES;
    const parsed: UniversityDirectoryItem[] = JSON.parse(raw);
    // Ensure UNILORIN is present even if an older cached copy existed
    if (!parsed.some((u) => u.id === 'unilorin')) {
      return [...parsed, UNILORIN_UNIVERSITY];
    }
    return parsed;
  } catch {
    return INITIAL_UNIVERSITIES;
  }
}

export function saveStoredUniversities(items: UniversityDirectoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_UNIVERSITIES, JSON.stringify(items));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredSets(): ClassSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETS);
    if (!raw) return INITIAL_SETS;
    const parsed: ClassSet[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_SETS;
    }
    const oldLegacyIds = ['unilag-cs-2026', 'unilag-med-2025', 'covenant-arch-2026', 'covenant-arch-2024'];
    const cleanedParsed = parsed.filter((s) => !oldLegacyIds.includes(s.id));
    const mergedSets = [...cleanedParsed];
    for (const demoSet of INITIAL_SETS) {
      if (!mergedSets.some((s) => s.id === demoSet.id)) {
        mergedSets.push(demoSet);
      }
    }
    return mergedSets.map((s) => {
      const match = INITIAL_SETS.find((init) => init.id === s.id);
      return {
        ...s,
        isPublished: s.isPublished !== undefined ? s.isPublished : (match?.isPublished ?? false),
        publishedAt: s.publishedAt || match?.publishedAt,
        convocationDate: s.convocationDate || match?.convocationDate,
        accentColor: s.accentColor !== undefined ? s.accentColor : (match?.accentColor ?? undefined),
        students: Array.isArray(s.students) ? s.students : [],
        memories: Array.isArray(s.memories) ? s.memories : [],
        voices: (() => {
          const list = Array.isArray(s.voices) && s.voices.length > 0 ? s.voices : (match?.voices || []);
          if (match?.voices && !list.some((v) => v.isPinned)) {
            const pinnedMatch = match.voices.find((v) => v.isPinned);
            if (pinnedMatch && !list.some((v) => v.id === pinnedMatch.id)) {
              return [pinnedMatch, ...list];
            }
          }
          return list;
        })(),
        socials: s.socials || match?.socials || {
          youtube: '',
          instagram: '',
          twitter: '',
          linkedin: '',
          facebook: '',
          tiktok: '',
          website: '',
        },
      };
    });
  } catch {
    return INITIAL_SETS;
  }
}

export function saveStoredSets(sets: ClassSet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredTransactions(): FinancialTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TX);
    return raw ? JSON.parse(raw) : INITIAL_TRANSACTIONS;
  } catch {
    return INITIAL_TRANSACTIONS;
  }
}

export function saveStoredTransactions(txs: FinancialTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(txs));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredAdditionRequests(): DepartmentAdditionRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REQUESTS);
    return raw ? JSON.parse(raw) : INITIAL_ADDITION_REQUESTS;
  } catch {
    return INITIAL_ADDITION_REQUESTS;
  }
}

export function saveStoredAdditionRequests(reqs: DepartmentAdditionRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(reqs));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredFoundingClassRequests(): FoundingClassRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FOUNDING_REQUESTS);
    return raw ? JSON.parse(raw) : INITIAL_FOUNDING_REQUESTS;
  } catch {
    return INITIAL_FOUNDING_REQUESTS;
  }
}

export function saveStoredFoundingClassRequests(reqs: FoundingClassRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FOUNDING_REQUESTS, JSON.stringify(reqs));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredContentOverride(): WebsiteContentOverride {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONTENT);
    if (!raw) return INITIAL_CONTENT_OVERRIDE;
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_CONTENT_OVERRIDE,
      ...parsed,
      defaultCompressionResolution: parsed.defaultCompressionResolution || 720,
      maxImagesPerAlbum: parsed.maxImagesPerAlbum || 400,
      showWebsiteStats: typeof parsed.showWebsiteStats === 'boolean' ? parsed.showWebsiteStats : false,
      showTestimonialsSection: typeof parsed.showTestimonialsSection === 'boolean' ? parsed.showTestimonialsSection : true,
      classAlbumTourUrl: parsed.classAlbumTourUrl || '',
      legacyPlaqueTourUrl: parsed.legacyPlaqueTourUrl || '',
      legacyBannerImages: (parsed.legacyBannerImages && parsed.legacyBannerImages.length === 4) ? parsed.legacyBannerImages : INITIAL_CONTENT_OVERRIDE.legacyBannerImages,
      darkLuxuryBackgrounds: parsed.darkLuxuryBackgrounds && parsed.darkLuxuryBackgrounds.length > 0 
        ? parsed.darkLuxuryBackgrounds 
        : DEFAULT_LUXURY_THEMES,
    };
  } catch {
    return INITIAL_CONTENT_OVERRIDE;
  }
}

export function saveStoredContentOverride(content: WebsiteContentOverride): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(content));
  } catch (e) {
    console.error(e);
  }
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
export const STORAGE_KEY_TESTIMONIAL_REQUESTS = 'kohot_testimonial_request_statuses_v1';

export const INITIAL_TESTIMONIALS: TestimonialRecord[] = [
  {
    id: 'test-unilag-cs-2024',
    name: 'Babatunde Adeleke',
    email: 'babatunde.adeleke@alumni.unilag.edu.ng',
    phone: '+234 802 345 6789',
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=320&auto=format&fit=crop&q=80',
    role: 'Class Album Admin',
    university: 'University of Lagos',
    universityId: 'unilag',
    faculty: 'Faculty of Science',
    department: 'Computer Science',
    departmentId: 'dept-unilag-cs',
    classYear: 2024,
    classSetName: 'Class of ’24',
    setId: 'unilag-cs-2024',
    testimonialText: 'Collecting 120 classmate portraits took less than four days on WhatsApp. Seeing our plaque on the science foyer wall made the whole thing feel real. It gave our class something we could leave behind.',
    submissionDate: '2024-06-18',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    requestStatus: 'featured',
  },
  {
    id: 'test-covenant-se-2024',
    name: 'Chioma Okonkwo',
    email: 'c.okonkwo@alumni.covenant.edu.ng',
    phone: '+234 813 456 7890',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=320&auto=format&fit=crop&q=80',
    role: 'Class Album Admin',
    university: 'Covenant University',
    universityId: 'cu',
    faculty: 'College of Science & Technology',
    department: 'Software Engineering',
    departmentId: 'dept-cu-se',
    classYear: 2024,
    classSetName: 'Class of ’24',
    setId: 'cu-se-2024',
    testimonialText: 'Paper photo albums can disappear or get damaged. KoHot gave our class somewhere we could always return to — especially when convocation comes around.',
    submissionDate: '2024-07-02',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    requestStatus: 'featured',
  },
  {
    id: 'test-oau-eee-2025',
    name: 'Farouk Al-Hassan',
    email: 'farouk.alhassan@alumni.oau.edu.ng',
    phone: '+234 815 678 9012',
    avatarUrl: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=320&auto=format&fit=crop&q=80',
    role: 'Class Album Admin',
    university: 'Obafemi Awolowo University',
    universityId: 'oau',
    faculty: 'Faculty of Technology',
    department: 'Electrical & Electronics Engineering',
    departmentId: 'dept-oau-eee',
    classYear: 2025,
    classSetName: 'Class of ’25',
    setId: 'oau-eee-2025',
    testimonialText: 'What stayed with me was the idea that our class could be connected to every class that comes after us. One plaque, many generations.',
    submissionDate: '2025-02-14',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    requestStatus: 'featured',
  },
  {
    id: 'test-abu-law-2024',
    name: 'Amina Bello',
    email: 'amina.bello@alumni.abu.edu.ng',
    phone: '+234 809 123 4567',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=320&auto=format&fit=crop&q=80',
    role: 'Class Album Admin',
    university: 'Ahmadu Bello University',
    universityId: 'abu',
    faculty: 'Faculty of Law',
    department: 'Public Law',
    departmentId: 'dept-abu-law',
    classYear: 2024,
    classSetName: 'Class of ’24',
    setId: 'abu-law-2024',
    testimonialText: 'The dashboard made it easy to review everything from my phone. What I expected to be stressful became surprisingly simple.',
    submissionDate: '2024-08-20',
    publicationPermission: 'public',
    reviewStatus: 'approved',
    isFeatured: true,
    requestStatus: 'featured',
  },
  {
    id: 'test-ui-med-2025-private',
    name: 'Dr. Ibrahim Sanni',
    email: 'i.sanni@alumni.ui.edu.ng',
    phone: '+234 803 987 6543',
    role: 'Class Album Admin',
    university: 'University of Ibadan (UI)',
    universityId: 'ui',
    faculty: 'Faculty of Clinical Sciences',
    department: 'Medicine & Surgery',
    departmentId: 'dept-ui-med',
    classYear: 2025,
    classSetName: 'Asclepius Set \'25',
    setId: 'ui-med-2025',
    testimonialText: 'The interface is very intuitive for the student body. We had a small bottleneck with older students having low network bandwidth during dinner night, but the frictionless upload handled it well.',
    submissionDate: '2025-05-10',
    publicationPermission: 'private',
    reviewStatus: 'pending',
    isFeatured: false,
    requestStatus: 'private',
    internalNotes: 'Private operational feedback regarding campus bandwidth during dinner night.',
  },
];

export function getStoredTestimonials(): TestimonialRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TESTIMONIALS);
    if (!raw) {
      saveStoredTestimonials(INITIAL_TESTIMONIALS);
      return INITIAL_TESTIMONIALS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_TESTIMONIALS;
  } catch (err) {
    console.error('Failed reading testimonials from storage:', err);
    return INITIAL_TESTIMONIALS;
  }
}

export function saveStoredTestimonials(testimonials: TestimonialRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(testimonials));
  } catch (err) {
    console.error('Failed saving testimonials to storage:', err);
  }
}

// =========================================================================
// CLASS ALBUM REQUESTS (INTEGRATED AUTH & ALBUM REQUEST FLOW)
// =========================================================================
export const STORAGE_KEY_CLASS_ALBUM_REQUESTS = 'kohot_class_album_requests_v1';

export const INITIAL_CLASS_ALBUM_REQUESTS: ClassAlbumRequest[] = [
  {
    id: 'req-unilag-eee-2026',
    userId: 'usr-rep-babatunde',
    applicantName: 'Babatunde Alabi',
    applicantEmail: 'alabi.eee@unilag.edu.ng',
    universityId: 'unilag',
    universityName: 'University of Lagos (UNILAG)',
    facultyName: 'Faculty of Engineering',
    departmentId: 'dept-unilag-eee',
    departmentName: 'Electrical & Electronics Engineering',
    graduationYear: 2026,
    estimatedClassSize: 95,
    classSetName: 'The Tesla Class ’26',
    classSlogan: 'Powering the Future with Innovation',
    academicYears: 5,
    applicantRole: 'Class Representative',
    whatsappNumber: '+234 815 444 9900',
    backupContact: {
      fullName: 'Aisha Lawal',
      phoneOrWhatsapp: '+234 815 444 9901',
      email: 'aisha.lawal@unilag.edu.ng',
      relationshipOrRole: 'Assistant Class Representative',
    },
    agreementAcceptance: {
      agreementVersion: '2026.1',
      acceptedByUserId: 'usr-rep-babatunde',
      acceptedByEmail: 'alabi.eee@unilag.edu.ng',
      acceptedAt: '2026-09-18T14:15:00.000Z',
      confirmedAuthorized: true,
      confirmedAccuracy: true,
    },
    lifecycleStatus: 'pending_review',
    status: 'Awaiting Approval',
    submissionDate: '2026-09-18 14:15',
    reviewNotes: 'Verified enrolled class rep. Academic set credentials cross-checked.',
  },
  {
    id: 'req-oau-law-2026',
    userId: 'usr-rep-tunde',
    applicantName: 'Tunde Adelegan',
    applicantEmail: 'adelegan.t@oauife.edu.ng',
    universityId: 'oau',
    universityName: 'Obafemi Awolowo University (OAU)',
    facultyName: 'Faculty of Law',
    departmentId: 'dept-oau-law',
    departmentName: 'Public Law',
    graduationYear: 2026,
    estimatedClassSize: 120,
    classSetName: 'The Jurisprudence Set ’26',
    classSlogan: 'Fiat Justitia Ruat Caelum',
    academicYears: 5,
    applicantRole: 'Department President',
    whatsappNumber: '+234 803 777 2211',
    backupContact: {
      fullName: 'Chinwe Okonjo',
      phoneOrWhatsapp: '+234 803 777 2212',
      email: 'chinwe.o@oauife.edu.ng',
      relationshipOrRole: 'General Secretary',
    },
    agreementAcceptance: {
      agreementVersion: '2026.1',
      acceptedByUserId: 'usr-rep-tunde',
      acceptedByEmail: 'adelegan.t@oauife.edu.ng',
      acceptedAt: '2026-09-19T10:30:00.000Z',
      confirmedAuthorized: true,
      confirmedAccuracy: true,
    },
    lifecycleStatus: 'pending_review',
    status: 'Awaiting Approval',
    submissionDate: '2026-09-19 10:30',
    reviewNotes: 'Faculty board verification in progress.',
  }
];

export function getStoredClassAlbumRequests(): ClassAlbumRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLASS_ALBUM_REQUESTS);
    if (!raw) {
      saveStoredClassAlbumRequests(INITIAL_CLASS_ALBUM_REQUESTS);
      return INITIAL_CLASS_ALBUM_REQUESTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_CLASS_ALBUM_REQUESTS;
  } catch (err) {
    console.error('Failed reading class requests from storage:', err);
    return INITIAL_CLASS_ALBUM_REQUESTS;
  }
}

export function saveStoredClassAlbumRequests(requests: ClassAlbumRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CLASS_ALBUM_REQUESTS, JSON.stringify(requests));
  } catch (err) {
    console.error('Failed saving class requests to storage:', err);
  }
}

// =========================================================================
// NEXT CLASS HANDOFF INVITES ("PASS THE BATON")
// =========================================================================
export const STORAGE_KEY_NEXT_CLASS_INVITES = 'kohot_next_class_handoff_invites_v1';

export const INITIAL_NEXT_CLASS_INVITES: NextClassHandoffInvite[] = [
  {
    id: 'invite-unilag-cs-2027',
    fromSetId: 'unilag-cs-2026',
    fromAdminName: 'Oluwaseun Danladi',
    fromAdminEmail: 'rep.cs24@unilag.edu.ng',
    targetUniversityId: 'unilag',
    targetUniversityName: 'University of Lagos (UNILAG)',
    targetDepartmentId: 'dept-unilag-cs',
    targetDepartmentName: 'Computer Science',
    targetClassYear: 2027,
    targetContactName: 'Chidinma Okafor',
    targetContactPhone: '+234 809 333 4455',
    inviteCode: 'BATON-CS27-UNILAG-9021',
    status: 'pending',
    createdAt: '2026-09-15 11:00',
    expiresAt: '2026-12-31 23:59',
  }
];

export function getStoredNextClassInvites(): NextClassHandoffInvite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NEXT_CLASS_INVITES);
    if (!raw) {
      saveStoredNextClassInvites(INITIAL_NEXT_CLASS_INVITES);
      return INITIAL_NEXT_CLASS_INVITES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_NEXT_CLASS_INVITES;
  } catch (err) {
    console.error('Failed reading next class invites:', err);
    return INITIAL_NEXT_CLASS_INVITES;
  }
}

export function saveStoredNextClassInvites(invites: NextClassHandoffInvite[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_NEXT_CLASS_INVITES, JSON.stringify(invites));
  } catch (err) {
    console.error('Failed saving next class invites:', err);
  }
}

// =========================================================================
// ALBUM DISPUTES / REVIEWS (CONFLICT RESOLUTION SYSTEM)
// =========================================================================
export const STORAGE_KEY_ALBUM_DISPUTES = 'kohot_album_disputes_v1';

export const INITIAL_ALBUM_DISPUTES: AlbumDisputeRecord[] = [
  {
    id: 'help-unilag-cs-2026-01',
    setId: 'unilag-cs-2026',
    universityName: 'University of Lagos (UNILAG)',
    facultyName: 'Faculty of Science',
    departmentName: 'Computer Science',
    graduationYear: 2026,
    classSetName: 'The Synergy Set',
    currentAdminName: 'Oluwaseun Danladi',
    claimantUserId: 'usr-student-ibrahim',
    claimantName: 'Ibrahim Adeleke',
    claimantEmail: 'ibrahim.adeleke@alumni.unilag.edu.ng',
    claimantPhone: '+234 812 999 1122',
    claimantRole: 'I need help transferring administration',
    disputeReason: '[I need help transferring administration] Requesting support regarding album administration handover and sign-out dinner photo curation.',
    helpReason: 'I need help transferring administration',
    explanation: 'Requesting review regarding album administration handover, class album publication status, and sign-out dinner photo curation.',
    backupContact: {
      name: 'Dr. A. B. Adeyemi',
      email: 'adeyemi@cs.unilag.edu.ng',
      phone: '+234 803 111 2233',
      role: 'Department Staff Adviser'
    },
    administrationHistory: [
      { date: '2026-01-15', action: 'Class Album Registered', actor: 'Oluwaseun Danladi (Class Admin)' },
      { date: '2026-01-16', action: 'Owner Verification Approved', actor: 'KoHot Host' },
      { date: '2026-09-16', action: 'Album Admin Help Request Filed', actor: 'Ibrahim Adeleke' }
    ],
    submittedAt: '2026-09-16 09:20',
    status: 'Open',
    decision: 'Pending',
    resolutionNotes: 'Owner review requested. Verify mutual recognition between current Class Admin and applicant.',
  }
];

export function getStoredAlbumDisputes(): AlbumDisputeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALBUM_DISPUTES);
    if (!raw) {
      saveStoredAlbumDisputes(INITIAL_ALBUM_DISPUTES);
      return INITIAL_ALBUM_DISPUTES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_ALBUM_DISPUTES;
  } catch (err) {
    console.error('Failed reading album disputes:', err);
    return INITIAL_ALBUM_DISPUTES;
  }
}

export function saveStoredAlbumDisputes(disputes: AlbumDisputeRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ALBUM_DISPUTES, JSON.stringify(disputes));
  } catch (err) {
    console.error('Failed saving album disputes:', err);
  }
}

// =========================================================================
// AUDIT LOGS (SECURITY & AUDIT RECORDING)
// =========================================================================
export const STORAGE_KEY_AUDIT_LOGS = 'kohot_audit_logs_v1';

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-init-01',
    timestamp: '2026-06-12T11:05:00.000Z',
    action: 'album_approved',
    actorUserId: 'usr-owner-001',
    actorRole: 'owner',
    targetId: 'unilag-cs-2026',
    details: 'Owner review completed and approved official Class Album for UNILAG Computer Science Class of 2026. Granted first-admin authorization to Oluwaseun Danladi.',
  },
  {
    id: 'audit-init-02',
    timestamp: '2026-08-01T09:40:00.000Z',
    action: 'album_approved',
    actorUserId: 'usr-owner-001',
    actorRole: 'owner',
    targetId: 'oau-arch-2024',
    details: 'Owner review completed and approved official Class Album for OAU Architecture Class of 2024. Granted first-admin authorization to Tunde Adelegan.',
  },
];

export function getStoredAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
    if (!raw) {
      saveStoredAuditLogs(INITIAL_AUDIT_LOGS);
      return INITIAL_AUDIT_LOGS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_AUDIT_LOGS;
  } catch (err) {
    console.error('Failed reading audit logs:', err);
    return INITIAL_AUDIT_LOGS;
  }
}

export function saveStoredAuditLogs(logs: AuditLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed saving audit logs:', err);
  }
}


