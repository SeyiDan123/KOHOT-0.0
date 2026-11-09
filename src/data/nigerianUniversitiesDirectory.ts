import { DepartmentItem, UniversityDirectoryItem } from '../types';

// Symbolic hero banners tailored to each academic discipline (never used as logos)
export const DISCIPLINE_HERO_IMAGES = {
  LAW: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&auto=format&fit=crop&q=80',
  COMPUTER_SCIENCE: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80',
  ACCOUNTING: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1600&auto=format&fit=crop&q=80',
  BUSINESS: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&auto=format&fit=crop&q=80',
  PUBLIC_ADMIN: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1600&auto=format&fit=crop&q=80',
  MEDICINE: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1600&auto=format&fit=crop&q=80',
  PHARMACY: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1600&auto=format&fit=crop&q=80',
  ARCHITECTURE: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1600&auto=format&fit=crop&q=80',
  CIVIL_ENG: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=80',
  ELECTRICAL_ENG: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&auto=format&fit=crop&q=80',
  MECHANICAL_ENG: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=1600&auto=format&fit=crop&q=80',
  AERONAUTICAL_ENG: 'https://images.unsplash.com/photo-1517976487468-f20514c424f3?w=1600&auto=format&fit=crop&q=80',
  AGRICULTURE: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1600&auto=format&fit=crop&q=80',
  ECONOMICS: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&auto=format&fit=crop&q=80',
  MASS_COMM: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1600&auto=format&fit=crop&q=80',
  BIOCHEMISTRY: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1600&auto=format&fit=crop&q=80',
  CHEMISTRY: 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?w=1600&auto=format&fit=crop&q=80',
  MATHEMATICS: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1600&auto=format&fit=crop&q=80',
  PERFORMING_ARTS: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=1600&auto=format&fit=crop&q=80',
  HISTORY: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1600&auto=format&fit=crop&q=80',
  VETERINARY: 'https://images.unsplash.com/photo-1628009368231-7bb3cfc3829e?w=1600&auto=format&fit=crop&q=80',
  EDUCATION: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1600&auto=format&fit=crop&q=80',
  GEOLOGY: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=1600&auto=format&fit=crop&q=80',
  PSYCHOLOGY: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1600&auto=format&fit=crop&q=80',
};

// Maps each department code to its authentic Nigerian student association / portal emblem & vector icon
const getDepartmentVisualIdentity = (
  deptCode: string,
  fallbackColor: string
): { assoc: string; ringColor: string; accentColor: string; iconSvg: string } => {
  const c = deptCode.toUpperCase().trim();

  // 1. Computing & Informatics (NACOSS / CYB / SWE / AI)
  if (['CSC', 'CSE', 'SWE', 'CYB', 'IFT', 'DSC', 'ICS', 'ITC', 'MIS'].includes(c)) {
    return {
      assoc: 'NACOSS',
      ringColor: '#0F4C81',
      accentColor: '#0284C7',
      iconSvg: `<path d="M38 38 L30 45 L38 52 M62 38 L70 45 L62 52 M53 35 L47 55" fill="none" stroke="#0F4C81" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="27" r="2.5" fill="#0284C7"/>`,
    };
  }

  // 2. Law & Jurisprudence (LAWSAN)
  if (['PIL', 'CCL', 'PPL', 'JIL', 'LAW', 'ISL', 'CML', 'PRL', 'PUL', 'JCL'].includes(c)) {
    return {
      assoc: 'LAWSAN',
      ringColor: '#581C87',
      accentColor: '#B45309',
      iconSvg: `<path d="M50 26 L50 56 M34 34 L66 34 M42 56 L58 56" stroke="#581C87" stroke-width="2.6" stroke-linecap="round"/><path d="M34 34 L29 45 L39 45 Z M66 34 L61 45 L71 45 Z" fill="#B45309" stroke="#581C87" stroke-width="1.5"/>`,
    };
  }

  // 3. Medicine, Nursing, Dentistry & Health Sciences (NIMSA / NUNSA / NIMELSSA)
  if (['MBBS', 'BDS', 'NSC', 'MLS', 'PHT', 'RAD', 'ANA', 'PIO', 'PUH', 'OPT', ' EHS', 'NTD', 'VET', 'DVM'].includes(c)) {
    const assoc = c === 'NSC' ? 'NUNSA' : c === 'MLS' ? 'NIMELSSA' : c === 'DVM' || c === 'VET' ? 'NVMA' : 'NIMSA';
    return {
      assoc,
      ringColor: '#065F46',
      accentColor: '#DC2626',
      iconSvg: `<path d="M50 26 L50 56 M41 34 H59 M45 28 C38 33 62 39 45 45 C38 49 62 53 50 56" fill="none" stroke="#065F46" stroke-width="2.5" stroke-linecap="round"/><path d="M47 23 H53 V29 H59 V35 H53 V41 H47 V35 H41 V29 H47 Z" fill="#DC2626" opacity="0.22"/>`,
    };
  }

  // 4. Pharmacy & Pharmacology (PANS)
  if (['PHM', 'PCL', 'PHA', 'PCG', 'PCH', 'PMB'].includes(c)) {
    return {
      assoc: 'PANS',
      ringColor: '#115E59',
      accentColor: '#0D9488',
      iconSvg: `<path d="M36 39 H64 L60 53 Q50 58 40 53 Z" fill="#0D9488" opacity="0.2" stroke="#115E59" stroke-width="2.4"/><path d="M56 26 L47 39" stroke="#115E59" stroke-width="3.2" stroke-linecap="round"/><path d="M41 55 H59" stroke="#115E59" stroke-width="2.5" stroke-linecap="round"/>`,
    };
  }

  // 5. Electrical, Computer & Telecoms Engineering (NUES / NIEEE)
  if (['EEE', 'CPE', 'TCE', 'BME', 'ICE'].includes(c)) {
    return {
      assoc: 'NIEEE',
      ringColor: '#9A3412',
      accentColor: '#EA580C',
      iconSvg: `<path d="M53 25 L39 42 H49 L46 57 L61 39 H50 Z" fill="#EA580C" stroke="#9A3412" stroke-width="1.8" stroke-linejoin="round"/>`,
    };
  }

  // 6. Mechanical, Mechatronics, Aerospace, Metallurgical & Chemical Engineering (NUES / NIMechE)
  if (['MEE', 'MSE', 'MME', 'CHE', 'PGE', 'AAE', 'ABE', 'FST', 'IPE', 'MRE', 'AEE', 'WRE'].includes(c)) {
    const assoc = c === 'CHE' ? 'NSChE' : c === 'PGE' ? 'SPE' : 'NUES';
    return {
      assoc,
      ringColor: '#1E3A8A',
      accentColor: '#D97706',
      iconSvg: `<circle cx="50" cy="41" r="9" fill="none" stroke="#1E3A8A" stroke-width="3"/><circle cx="50" cy="41" r="3.5" fill="#D97706"/><path d="M50 27 V31 M50 51 V55 M36 41 H40 M60 41 H64 M40 31 L43 34 M57 48 L60 51 M60 31 L57 34 M43 48 L40 51" stroke="#1E3A8A" stroke-width="2.6" stroke-linecap="round"/>`,
    };
  }

  // 7. Civil, Structural & Environmental Design / Architecture (NICE / ADSA)
  if (['CVE', 'ARC', 'ESM', 'QSV', 'URP', 'BLD', 'SVG', 'IDD', 'FAA'].includes(c)) {
    const assoc = c === 'ARC' ? 'ADSA' : c === 'CVE' ? 'NICE' : 'FES';
    return {
      assoc,
      ringColor: '#3730A3',
      accentColor: '#CA8A04',
      iconSvg: `<path d="M50 26 L36 55 M50 26 L64 55 M40 46 H60" fill="none" stroke="#3730A3" stroke-width="2.6" stroke-linecap="round"/><circle cx="50" cy="26" r="3" fill="#CA8A04"/>`,
    };
  }

  // 8. Biochemistry, Microbiology, Biology, Botany & Zoology (NASS / NSBMB)
  if (['BCH', 'MCB', 'BIO', 'BOT', 'ZOO', 'PLB', 'GEN', 'BTH', 'EBS'].includes(c)) {
    return {
      assoc: 'NASS',
      ringColor: '#166534',
      accentColor: '#15803D',
      iconSvg: `<path d="M40 27 C40 36 60 36 60 45 C60 52 40 52 40 56 M60 27 C60 36 40 36 40 45 C40 52 60 52 60 56" fill="none" stroke="#166534" stroke-width="2.4" stroke-linecap="round"/><line x1="43" y1="32" x2="57" y2="32" stroke="#15803D" stroke-width="1.8"/><line x1="43" y1="45" x2="57" y2="45" stroke="#15803D" stroke-width="1.8"/>`,
    };
  }

  // 9. Chemistry, Physics, Mathematics, Statistics & Geology (CSN / NIP / NMS / NMGS)
  if (['CHM', 'ICH', 'PHY', 'MTH', 'STA', 'GEO', 'GLY', 'GPH', 'mar'].includes(c)) {
    const assoc = c === 'CHM' || c === 'ICH' ? 'SCSN' : c === 'PHY' ? 'NAPS' : c === 'GEO' || c === 'GLY' ? 'NMGS' : 'NAMS';
    return {
      assoc,
      ringColor: '#0369A1',
      accentColor: '#B45309',
      iconSvg: `<ellipse cx="50" cy="41" rx="16" ry="6.5" fill="none" stroke="#0369A1" stroke-width="2" transform="rotate(30 50 41)"/><ellipse cx="50" cy="41" rx="16" ry="6.5" fill="none" stroke="#0369A1" stroke-width="2" transform="rotate(-30 50 41)"/><circle cx="50" cy="41" r="3.2" fill="#B45309"/>`,
    };
  }

  // 10. Accounting, Finance, Economics & Management Sciences (NUASA / NESA / NAMBS)
  if (['ACC', 'BUS', 'BFN', 'PAD', 'MKT', 'ACT', 'IRP', 'ECO', 'ENT', 'TAX', 'LGM', 'coop'].includes(c)) {
    const assoc = c === 'ACC' ? 'NUASA' : c === 'ECO' ? 'NESA' : c === 'BFN' ? 'NUFBSA' : 'NAMBS';
    return {
      assoc,
      ringColor: '#1E293B',
      accentColor: '#B45309',
      iconSvg: `<rect x="35" y="44" width="5" height="11" rx="1" fill="#1E293B"/><rect x="44" y="38" width="5" height="17" rx="1" fill="#B45309"/><rect x="53" y="31" width="5" height="24" rx="1" fill="#1E293B"/><path d="M34 39 L45 33 L58 27" fill="none" stroke="#B45309" stroke-width="2.2" stroke-linecap="round"/>`,
    };
  }

  // 11. Mass Comm, Political Science, International Relations, Sociology & Psychology (NAMCS / NAPSS)
  if (['MAC', 'POS', 'SOC', 'PSY', 'GPY', 'IRS', 'CRM', 'PCR', 'DSS', 'SWK'].includes(c)) {
    const assoc = c === 'MAC' ? 'NAMCS' : c === 'POS' || c === 'IRS' ? 'NAPSS' : 'FSSA';
    return {
      assoc,
      ringColor: '#7C2D12',
      accentColor: '#0369A1',
      iconSvg: `<circle cx="50" cy="40" r="12" fill="none" stroke="#7C2D12" stroke-width="2.2"/><ellipse cx="50" cy="40" rx="5.5" ry="12" fill="none" stroke="#0369A1" stroke-width="1.8"/><line x1="38" y1="40" x2="62" y2="40" stroke="#7C2D12" stroke-width="1.8"/>`,
    };
  }

  // 12. Agriculture, Agronomy, Animal Science, Forestry & Fisheries (NAAS)
  if (['AGE', 'CPS', 'ANS', 'AEF', 'ARD', 'AGR', 'ANP', 'CRP', 'FWM', 'FIS', 'HRT', 'SOS', 'AEC', 'AXR', 'FST'].includes(c)) {
    return {
      assoc: 'NAAS',
      ringColor: '#14532D',
      accentColor: '#CA8A04',
      iconSvg: `<path d="M50 56 V28 M50 48 C41 46 38 38 44 34 C49 38 50 44 50 48 M50 42 C59 40 62 32 56 28 C51 32 50 38 50 42" fill="none" stroke="#14532D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="26" r="2.2" fill="#CA8A04"/>`,
    };
  }

  // 13. Arts, Humanities, Languages, History, Theatre & Education (FASA / NUESA)
  return {
    assoc: ['STE', 'EDM', 'LIS', 'EDU', 'ASE', 'SSE', 'HKE', 'GCO', 'ETL', 'BED', 'EFC'].includes(c) ? 'NUESA' : 'FASA',
    ringColor: fallbackColor || '#701A75',
    accentColor: '#B45309',
    iconSvg: `<path d="M34 33 Q42 30 50 34 Q58 30 66 33 V52 Q58 49 50 53 Q42 49 34 52 Z" fill="none" stroke="${fallbackColor || '#701A75'}" stroke-width="2.3" stroke-linejoin="round"/><line x1="50" y1="34" x2="50" y2="53" stroke="#B45309" stroke-width="2"/>`,
  };
};

// Generates a distinct, genuine-style departmental association crest on a crisp white background (#FFFFFF)
export const createUniversityDeptCrest = (
  uniShortCode: string,
  deptCode: string,
  primaryBg: string,
  shieldBg: string,
  accentGold = '#D4AF37'
): string => {
  const cleanCode = deptCode.slice(0, 4).toUpperCase();
  const cleanUni = uniShortCode.slice(0, 8).toUpperCase();
  const identity = getDepartmentVisualIdentity(cleanCode, primaryBg || shieldBg);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="18" fill="#FFFFFF" />
    <circle cx="50" cy="50" r="45" fill="#FFFFFF" stroke="${identity.ringColor}" stroke-width="2.5" />
    <circle cx="50" cy="50" r="40.5" fill="none" stroke="${accentGold}" stroke-width="1.2" stroke-dasharray="3,2" />
    <path d="M50 14 L78 26 L78 55 Q50 84 50 84 Q22 55 22 26 Z" fill="#F8FAFC" stroke="${identity.ringColor}" stroke-width="2.2" />
    <path d="M24 27 L50 16 L76 27 L76 34 L24 34 Z" fill="${identity.ringColor}" />
    <text x="50" y="30.5" font-family="'Space Grotesk', sans-serif" font-size="6.2" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.9">${identity.assoc}</text>
    ${identity.iconSvg}
    <rect x="28" y="59" width="44" height="13" rx="6.5" fill="${identity.ringColor}" stroke="${accentGold}" stroke-width="1.2" />
    <text x="50" y="68" font-family="'Space Grotesk', monospace, sans-serif" font-size="8.8" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.7">${cleanCode}</text>
    <text x="50" y="91.5" font-family="'Space Grotesk', sans-serif" font-size="6.2" font-weight="bold" fill="${identity.ringColor}" text-anchor="middle" letter-spacing="0.8">${cleanUni}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export type DeptCategory =
  | 'computing_core'
  | 'computing_adv'
  | 'eng_core'
  | 'eng_adv'
  | 'eng_pet'
  | 'law_core'
  | 'law_adv'
  | 'med_core'
  | 'med_allied'
  | 'pharm'
  | 'sci_core'
  | 'sci_earth'
  | 'soc_core'
  | 'soc_adv'
  | 'mgt_core'
  | 'mgt_adv'
  | 'env_core'
  | 'env_adv'
  | 'arts_core'
  | 'arts_adv'
  | 'agric_core'
  | 'agric_adv'
  | 'vet'
  | 'edu_core'
  | 'edu_adv';

interface DeptBlueprint {
  slug: string;
  name: string;
  code: string;
  faculty: string;
  category: DeptCategory;
  heroImageUrl: string;
  caption: string;
}

// Comprehensive NUC-accredited academic departments blueprint across Nigerian faculties
const MASTER_DEPARTMENT_BLUEPRINTS: DeptBlueprint[] = [
  // --- COMPUTING ---
  {
    slug: 'csc',
    name: 'Computer Science',
    code: 'CSC',
    faculty: 'Faculty of Computing & Informatics',
    category: 'computing_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.COMPUTER_SCIENCE,
    caption: 'Pioneering software engineering, algorithmic foundations, artificial intelligence, and digital transformation across Africa.',
  },
  {
    slug: 'swe',
    name: 'Software Engineering',
    code: 'SWE',
    faculty: 'Faculty of Computing & Informatics',
    category: 'computing_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.COMPUTER_SCIENCE,
    caption: 'Enterprise software architecture, distributed cloud systems, DevOps engineering, and full-stack product delivery.',
  },
  {
    slug: 'cyb',
    name: 'Cyber Security',
    code: 'CYB',
    faculty: 'Faculty of Computing & Informatics',
    category: 'computing_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.COMPUTER_SCIENCE,
    caption: 'Cryptographic protocols, network defense, ethical penetration testing, and digital forensics.',
  },
  {
    slug: 'ift',
    name: 'Information Technology & Systems',
    code: 'IFT',
    faculty: 'Faculty of Computing & Informatics',
    category: 'computing_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.COMPUTER_SCIENCE,
    caption: 'Information systems governance, database administration, enterprise cloud infrastructure, and data analytics.',
  },
  {
    slug: 'dsc',
    name: 'Data Science & Artificial Intelligence',
    code: 'DSC',
    faculty: 'Faculty of Computing & Informatics',
    category: 'computing_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.COMPUTER_SCIENCE,
    caption: 'Machine learning models, statistical computing, neural networks, and predictive intelligence.',
  },

  // --- ENGINEERING ---
  {
    slug: 'eee',
    name: 'Electrical and Electronics Engineering',
    code: 'EEE',
    faculty: 'Faculty of Engineering',
    category: 'eng_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ELECTRICAL_ENG,
    caption: 'Power generation and transmission grids, telecommunications, microelectronics, and embedded control systems.',
  },
  {
    slug: 'mee',
    name: 'Mechanical Engineering',
    code: 'MEE',
    faculty: 'Faculty of Engineering',
    category: 'eng_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MECHANICAL_ENG,
    caption: 'Thermodynamics, fluid mechanics, industrial manufacturing, robotics kinematics, and automotive systems.',
  },
  {
    slug: 'cve',
    name: 'Civil and Environmental Engineering',
    code: 'CVE',
    faculty: 'Faculty of Engineering',
    category: 'eng_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.CIVIL_ENG,
    caption: 'Structural design, geotechnical engineering, highway infrastructure, and sustainable water resources.',
  },
  {
    slug: 'che',
    name: 'Chemical Engineering',
    code: 'CHE',
    faculty: 'Faculty of Engineering',
    category: 'eng_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.CHEMISTRY,
    caption: 'Process plant simulation, petrochemical refining, biochemical reaction engineering, and industrial catalysis.',
  },
  {
    slug: 'cpe',
    name: 'Computer Engineering',
    code: 'CPE',
    faculty: 'Faculty of Engineering',
    category: 'eng_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ELECTRICAL_ENG,
    caption: 'Digital logic design, microprocessor architecture, VLSI hardware systems, and autonomous robotics.',
  },
  {
    slug: 'pet',
    name: 'Petroleum and Gas Engineering',
    code: 'PGE',
    faculty: 'Faculty of Engineering',
    category: 'eng_pet',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.GEOLOGY,
    caption: 'Reservoir simulation, drilling technology, natural gas processing, and sustainable energy transition.',
  },
  {
    slug: 'mte',
    name: 'Mechatronics and Systems Engineering',
    code: 'MSE',
    faculty: 'Faculty of Engineering',
    category: 'eng_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MECHANICAL_ENG,
    caption: 'Intelligent automation, cyber-physical control systems, industrial robotics, and precision instrumentation.',
  },
  {
    slug: 'abe',
    name: 'Agricultural and Bio-Resources Engineering',
    code: 'ABE',
    faculty: 'Faculty of Engineering',
    category: 'eng_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Mechanized crop processing, irrigation engineering, agro-machinery design, and post-harvest technology.',
  },
  {
    slug: 'mme',
    name: 'Metallurgical and Materials Engineering',
    code: 'MME',
    faculty: 'Faculty of Engineering',
    category: 'eng_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MECHANICAL_ENG,
    caption: 'Physical metallurgy, nanomaterials, corrosion engineering, and advanced composite manufacturing.',
  },
  {
    slug: 'fte',
    name: 'Food Science and Technology',
    code: 'FST',
    faculty: 'Faculty of Engineering',
    category: 'eng_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BIOCHEMISTRY,
    caption: 'Food bioprocessing, nutritional preservation, quality assurance, and industrial food safety.',
  },
  {
    slug: 'bme',
    name: 'Biomedical Engineering',
    code: 'BME',
    faculty: 'Faculty of Engineering',
    category: 'eng_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Medical device instrumentation, bionics, clinical engineering, and diagnostic imaging hardware.',
  },
  {
    slug: 'tce',
    name: 'Telecommunications Engineering',
    code: 'TCE',
    faculty: 'Faculty of Engineering',
    category: 'eng_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ELECTRICAL_ENG,
    caption: 'Wireless 5G/6G networks, optical fiber transmission, satellite communications, and RF engineering.',
  },

  // --- LAW ---
  {
    slug: 'law-pub',
    name: 'Public and International Law',
    code: 'PIL',
    faculty: 'Faculty of Law',
    category: 'law_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.LAW,
    caption: 'Constitutional jurisprudence, administrative law, international treaties, and fundamental human rights advocacy.',
  },
  {
    slug: 'law-com',
    name: 'Commercial and Corporate Law',
    code: 'CCL',
    faculty: 'Faculty of Law',
    category: 'law_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.LAW,
    caption: 'Corporate governance, intellectual property, maritime arbitration, taxation, and banking law.',
  },
  {
    slug: 'law-ppl',
    name: 'Private and Property Law',
    code: 'PPL',
    faculty: 'Faculty of Law',
    category: 'law_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.LAW,
    caption: 'Land law, equity and trusts, family jurisprudence, succession, and tortious liability.',
  },
  {
    slug: 'law-jil',
    name: 'Jurisprudence and International Law',
    code: 'JIL',
    faculty: 'Faculty of Law',
    category: 'law_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.LAW,
    caption: 'Legal philosophy, comparative legal systems, diplomatic law, and global conflict resolution.',
  },

  // --- MEDICINE & HEALTH SCIENCES ---
  {
    slug: 'mbbs',
    name: 'Medicine and Surgery (MBBS)',
    code: 'MBBS',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Exemplary clinical training, surgical precision, internal medicine, and compassionate patient care.',
  },
  {
    slug: 'den',
    name: 'Dentistry and Dental Surgery',
    code: 'BDS',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_allied',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Oral and maxillofacial surgery, restorative dentistry, orthodontics, and preventive dental health.',
  },
  {
    slug: 'nsc',
    name: 'Nursing Science',
    code: 'NSC',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Evidence-based clinical nursing, maternal and child health, critical care, and community health leadership.',
  },
  {
    slug: 'mls',
    name: 'Medical Laboratory Science',
    code: 'MLS',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BIOCHEMISTRY,
    caption: 'Clinical pathology, hematology, medical microbiology, histopathology, and molecular diagnostics.',
  },
  {
    slug: 'pht',
    name: 'Physiotherapy and Medical Rehabilitation',
    code: 'PHT',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_allied',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Neuro-musculoskeletal rehabilitation, sports medicine, cardiopulmonary therapy, and kinesiology.',
  },
  {
    slug: 'rad',
    name: 'Radiography and Radiation Science',
    code: 'RAD',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_allied',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Diagnostic medical imaging, MRI and CT modalities, ultrasonography, and radiation oncology.',
  },
  {
    slug: 'ana',
    name: 'Human Anatomy',
    code: 'ANA',
    faculty: 'Faculty of Basic Medical Sciences',
    category: 'med_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Gross anatomical sciences, neuroanatomy, embryology, histology, and biomedical anthropology.',
  },
  {
    slug: 'pio',
    name: 'Human Physiology',
    code: 'PIO',
    faculty: 'Faculty of Basic Medical Sciences',
    category: 'med_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Cardiovascular, endocrine, neurophysiological, and cellular mechanisms of human life.',
  },
  {
    slug: 'puh',
    name: 'Public and Community Health',
    code: 'PUH',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_allied',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MEDICINE,
    caption: 'Epidemiology, health policy, biostatistics, environmental health, and global disease prevention.',
  },
  {
    slug: 'ndd',
    name: 'Human Nutrition and Dietetics',
    code: 'NTD',
    faculty: 'College of Medicine & Health Sciences',
    category: 'med_allied',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BIOCHEMISTRY,
    caption: 'Clinical dietetics, community nutrition, metabolic health, and therapeutic food science.',
  },

  // --- PHARMACY ---
  {
    slug: 'pha',
    name: 'Pharmacy (Doctor of Pharmacy)',
    code: 'PHM',
    faculty: 'Faculty of Pharmaceutical Sciences',
    category: 'pharm',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.PHARMACY,
    caption: 'Clinical pharmacotherapy, drug discovery, pharmaceutics, pharmacognosy, and pharmaceutical chemistry.',
  },
  {
    slug: 'pcl',
    name: 'Pharmacology and Toxicology',
    code: 'PCL',
    faculty: 'Faculty of Pharmaceutical Sciences',
    category: 'pharm',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.PHARMACY,
    caption: 'Molecular drug action, neuropharmacology, clinical trials, and toxicological safety assessment.',
  },

  // --- PHYSICAL & LIFE SCIENCES ---
  {
    slug: 'bch',
    name: 'Biochemistry and Molecular Biology',
    code: 'BCH',
    faculty: 'Faculty of Science',
    category: 'sci_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BIOCHEMISTRY,
    caption: 'Enzymology, genetic engineering, metabolic pathways, and molecular biotechnology.',
  },
  {
    slug: 'mcb',
    name: 'Microbiology',
    code: 'MCB',
    faculty: 'Faculty of Science',
    category: 'sci_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BIOCHEMISTRY,
    caption: 'Virology, immunology, industrial fermentation, microbial genetics, and environmental microbiology.',
  },
  {
    slug: 'chm',
    name: 'Pure and Industrial Chemistry',
    code: 'CHM',
    faculty: 'Faculty of Science',
    category: 'sci_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.CHEMISTRY,
    caption: 'Organic synthesis, analytical spectroscopy, polymer science, and green chemical processes.',
  },
  {
    slug: 'phy',
    name: 'Physics and Engineering Physics',
    code: 'PHY',
    faculty: 'Faculty of Science',
    category: 'sci_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ELECTRICAL_ENG,
    caption: 'Solid-state physics, quantum mechanics, astrophysics, renewable solar energy, and geophysics.',
  },
  {
    slug: 'mth',
    name: 'Mathematics',
    code: 'MTH',
    faculty: 'Faculty of Science',
    category: 'sci_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MATHEMATICS,
    caption: 'Pure mathematical analysis, differential equations, topology, algebra, and computational modeling.',
  },
  {
    slug: 'sta',
    name: 'Statistics',
    code: 'STA',
    faculty: 'Faculty of Science',
    category: 'sci_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MATHEMATICS,
    caption: 'Stochastic processes, econometric modeling, biostatistics, and probabilistic risk inference.',
  },
  {
    slug: 'geo',
    name: 'Geology and Mineral Sciences',
    code: 'GEO',
    faculty: 'Faculty of Science',
    category: 'sci_earth',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.GEOLOGY,
    caption: 'Petroleum geology, hydrogeology, stratigraphy, mineral exploration, and earth tectonics.',
  },
  {
    slug: 'bio',
    name: 'Plant Biology and Biotechnology',
    code: 'PLB',
    faculty: 'Faculty of Science',
    category: 'sci_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Plant genetics, ethnobotany, biodiversity conservation, and ecological biotechnology.',
  },
  {
    slug: 'zoo',
    name: 'Zoology and Environmental Biology',
    code: 'ZOO',
    faculty: 'Faculty of Science',
    category: 'sci_earth',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Animal ecology, entomology, hydrobiology, parasitology, and wildlife conservation.',
  },
  {
    slug: 'gph',
    name: 'Applied Geophysics',
    code: 'GPH',
    faculty: 'Faculty of Science',
    category: 'sci_earth',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.GEOLOGY,
    caption: 'Seismic exploration, subsurface imaging, petrophysics, and groundwater geophysics.',
  },

  // --- SOCIAL SCIENCES ---
  {
    slug: 'eco',
    name: 'Economics',
    code: 'ECO',
    faculty: 'Faculty of Social Sciences',
    category: 'soc_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ECONOMICS,
    caption: 'Macroeconomic policy, monetary theory, development economics, and international trade analytics.',
  },
  {
    slug: 'mac',
    name: 'Mass Communication and Media Studies',
    code: 'MAC',
    faculty: 'Faculty of Social Sciences',
    category: 'soc_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.MASS_COMM,
    caption: 'Broadcast journalism, investigative reporting, strategic public relations, and digital media production.',
  },
  {
    slug: 'pos',
    name: 'Political Science and International Relations',
    code: 'POS',
    faculty: 'Faculty of Social Sciences',
    category: 'soc_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.PUBLIC_ADMIN,
    caption: 'Comparative politics, foreign policy analysis, democratic governance, and diplomatic studies.',
  },
  {
    slug: 'soc',
    name: 'Sociology and Anthropology',
    code: 'SOC',
    faculty: 'Faculty of Social Sciences',
    category: 'soc_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.PSYCHOLOGY,
    caption: 'Social stratification, criminology, demography, cultural anthropology, and urban development.',
  },
  {
    slug: 'psy',
    name: 'Psychology',
    code: 'PSY',
    faculty: 'Faculty of Social Sciences',
    category: 'soc_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.PSYCHOLOGY,
    caption: 'Clinical psychology, cognitive neuroscience, industrial-organizational behavior, and human development.',
  },
  {
    slug: 'gpy',
    name: 'Geography and Environmental Management',
    code: 'GPY',
    faculty: 'Faculty of Social Sciences',
    category: 'soc_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.GEOLOGY,
    caption: 'Geographic Information Systems (GIS), climatology, remote sensing, and regional planning.',
  },
  {
    slug: 'crm',
    name: 'Criminology and Security Studies',
    code: 'CRM',
    faculty: 'Faculty of Social Sciences',
    category: 'soc_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.LAW,
    caption: 'Criminal justice administration, forensic investigation, peacebuilding, and national security strategy.',
  },

  // --- MANAGEMENT SCIENCES ---
  {
    slug: 'acc',
    name: 'Accounting',
    code: 'ACC',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ACCOUNTING,
    caption: 'Financial reporting, forensic auditing, corporate taxation, and strategic cost management.',
  },
  {
    slug: 'bus',
    name: 'Business Administration and Management',
    code: 'BUS',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BUSINESS,
    caption: 'Corporate strategy, entrepreneurship, supply chain operations, and organizational leadership.',
  },
  {
    slug: 'bfn',
    name: 'Banking and Finance',
    code: 'BFN',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ECONOMICS,
    caption: 'Capital markets, investment portfolio management, corporate finance, and fintech innovation.',
  },
  {
    slug: 'pad',
    name: 'Public Administration',
    code: 'PAD',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.PUBLIC_ADMIN,
    caption: 'Public policy formulation, civil service reforms, local government administration, and public finance.',
  },
  {
    slug: 'mkt',
    name: 'Marketing and Consumer Studies',
    code: 'MKT',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BUSINESS,
    caption: 'Brand architecture, digital marketing analytics, consumer psychology, and global market strategy.',
  },
  {
    slug: 'irm',
    name: 'Actuarial Science and Insurance',
    code: 'ACT',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ACCOUNTING,
    caption: 'Quantitative risk modeling, pension mathematics, underwriting, and financial derivatives.',
  },
  {
    slug: 'hrm',
    name: 'Industrial Relations and Personnel Management',
    code: 'IRP',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BUSINESS,
    caption: 'Human capital strategy, labor law negotiation, organizational culture, and talent analytics.',
  },
  {
    slug: 'ent',
    name: 'Entrepreneurship and Innovation Studies',
    code: 'ENT',
    faculty: 'Faculty of Management Sciences',
    category: 'mgt_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BUSINESS,
    caption: 'Venture creation, small business scaling, venture capital financing, and industrial innovation.',
  },

  // --- ENVIRONMENTAL SCIENCES ---
  {
    slug: 'arc',
    name: 'Architecture',
    code: 'ARC',
    faculty: 'Faculty of Environmental Sciences',
    category: 'env_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ARCHITECTURE,
    caption: 'Avant-garde architectural design, sustainable urban morphology, and bioclimatic spatial engineering.',
  },
  {
    slug: 'esm',
    name: 'Estate Management and Valuation',
    code: 'ESM',
    faculty: 'Faculty of Environmental Sciences',
    category: 'env_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.BUSINESS,
    caption: 'Real estate investment appraisal, property valuation, land economics, and facility management.',
  },
  {
    slug: 'qsv',
    name: 'Quantity Surveying',
    code: 'QSV',
    faculty: 'Faculty of Environmental Sciences',
    category: 'env_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ARCHITECTURE,
    caption: 'Construction cost engineering, contract procurement, project auditing, and infrastructure economics.',
  },
  {
    slug: 'urp',
    name: 'Urban and Regional Planning',
    code: 'URP',
    faculty: 'Faculty of Environmental Sciences',
    category: 'env_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.ARCHITECTURE,
    caption: 'Smart city master-planning, sustainable transit corridors, housing policy, and metropolitan resilience.',
  },
  {
    slug: 'bld',
    name: 'Building Technology',
    code: 'BLD',
    faculty: 'Faculty of Environmental Sciences',
    category: 'env_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.CIVIL_ENG,
    caption: 'Construction project management, structural pathology, building services, and sustainable materials.',
  },
  {
    slug: 'svg',
    name: 'Surveying and Geoinformatics',
    code: 'SVG',
    faculty: 'Faculty of Environmental Sciences',
    category: 'env_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.GEOLOGY,
    caption: 'Geodesy, hydrographic surveying, satellite photogrammetry, and spatial land information systems.',
  },

  // --- ARTS & HUMANITIES ---
  {
    slug: 'els',
    name: 'English and Literary Studies',
    code: 'ELS',
    faculty: 'Faculty of Arts',
    category: 'arts_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.HISTORY,
    caption: 'Postcolonial African literature, comparative poetics, sociolinguistics, and creative writing.',
  },
  {
    slug: 'his',
    name: 'History and International Studies',
    code: 'HIS',
    faculty: 'Faculty of Arts',
    category: 'arts_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.HISTORY,
    caption: 'African historiography, diplomatic archives, geopolitical heritage, and international historiography.',
  },
  {
    slug: 'tha',
    name: 'Theatre, Film and Performing Arts',
    code: 'THA',
    faculty: 'Faculty of Arts',
    category: 'arts_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.PERFORMING_ARTS,
    caption: 'Dramaturgy, cinematography, stage directing, choreography, and cultural performance.',
  },
  {
    slug: 'phl',
    name: 'Philosophy',
    code: 'PHL',
    faculty: 'Faculty of Arts',
    category: 'arts_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.HISTORY,
    caption: 'Epistemology, ethics, symbolic logic, African philosophy, and political metaphysics.',
  },
  {
    slug: 'lin',
    name: 'Linguistics and Nigerian Languages',
    code: 'LIN',
    faculty: 'Faculty of Arts',
    category: 'arts_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.HISTORY,
    caption: 'Phonology, syntax, computational linguistics, and preservation of indigenous African languages.',
  },
  {
    slug: 'rel',
    name: 'Religious and Cultural Studies',
    code: 'REL',
    faculty: 'Faculty of Arts',
    category: 'arts_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.HISTORY,
    caption: 'Comparative theology, ethics, interfaith dialogue, and sociology of religion.',
  },
  {
    slug: 'fln',
    name: 'Foreign Languages (French & European Studies)',
    code: 'FRE',
    faculty: 'Faculty of Arts',
    category: 'arts_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.HISTORY,
    caption: 'Francophone literature, diplomatic translation, cross-cultural communication, and bilateral studies.',
  },

  // --- AGRICULTURE & VETERINARY MEDICINE ---
  {
    slug: 'age',
    name: 'Agricultural Economics and Extension',
    code: 'AGE',
    faculty: 'Faculty of Agriculture',
    category: 'agric_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Agribusiness value chains, rural development policy, farm management, and food security.',
  },
  {
    slug: 'cps',
    name: 'Crop Production and Soil Science',
    code: 'CPS',
    faculty: 'Faculty of Agriculture',
    category: 'agric_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Plant breeding, genetics, soil fertility conservation, and sustainable agronomy.',
  },
  {
    slug: 'ans',
    name: 'Animal Science and Livestock Production',
    code: 'ANS',
    faculty: 'Faculty of Agriculture',
    category: 'agric_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Livestock genetics, animal nutrition, pasture management, and sustainable pastoral production.',
  },
  {
    slug: 'fwm',
    name: 'Forestry and Wildlife Management',
    code: 'FWM',
    faculty: 'Faculty of Agriculture',
    category: 'agric_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Silviculture, ecosystem conservation, biodiversity management, and agroforestry.',
  },
  {
    slug: 'fis',
    name: 'Fisheries and Aquaculture Technology',
    code: 'FIS',
    faculty: 'Faculty of Agriculture',
    category: 'agric_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.AGRICULTURE,
    caption: 'Marine biology, commercial fish breeding, aquatic ecology, and sustainable aquaculture.',
  },
  {
    slug: 'vet',
    name: 'Veterinary Medicine (DVM)',
    code: 'DVM',
    faculty: 'Faculty of Veterinary Medicine',
    category: 'vet',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.VETERINARY,
    caption: 'Veterinary surgery, epidemiology, zoonotic disease control, and animal health welfare.',
  },

  // --- EDUCATION ---
  {
    slug: 'sed',
    name: 'Science and Technology Education',
    code: 'STE',
    faculty: 'Faculty of Education',
    category: 'edu_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.EDUCATION,
    caption: 'STEM curriculum innovation, instructional technology, and scientific pedagogy.',
  },
  {
    slug: 'edm',
    name: 'Educational Management and Guidance Counselling',
    code: 'EDM',
    faculty: 'Faculty of Education',
    category: 'edu_core',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.EDUCATION,
    caption: 'Institutional leadership, educational policy planning, and developmental counselling psychology.',
  },
  {
    slug: 'lis',
    name: 'Library and Information Science',
    code: 'LIS',
    faculty: 'Faculty of Education',
    category: 'edu_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.EDUCATION,
    caption: 'Archival preservation, digital libraries, information architecture, and knowledge management.',
  },
  {
    slug: 'bed',
    name: 'Business and Social Science Education',
    code: 'BED',
    faculty: 'Faculty of Education',
    category: 'edu_adv',
    heroImageUrl: DISCIPLINE_HERO_IMAGES.EDUCATION,
    caption: 'Business pedagogy, economics education, curriculum evaluation, and vocational leadership.',
  },
];

interface UniversitySpec {
  id: string;
  orderNumber: number;
  name: string;
  shortCode: string;
  location: string;
  logoUrl: string;
  officialWebsite: string;
  motto: string;
  primaryColor: string;
  shieldColor: string;
  categories: DeptCategory[];
  extraSlugs?: string[];
  excludeSlugs?: string[];
  legacyIdOverrides?: Record<
    string,
    {
      id: string;
      name?: string;
      hodName?: string;
      legacy_status?: 'available' | 'pending_verification' | 'established';
      pendingFoundingRequestId?: string;
    }
  >;
}

const ALL_CATEGORIES: DeptCategory[] = [
  'computing_core',
  'computing_adv',
  'eng_core',
  'eng_adv',
  'eng_pet',
  'law_core',
  'law_adv',
  'med_core',
  'med_allied',
  'pharm',
  'sci_core',
  'sci_earth',
  'soc_core',
  'soc_adv',
  'mgt_core',
  'mgt_adv',
  'env_core',
  'env_adv',
  'arts_core',
  'arts_adv',
  'agric_core',
  'agric_adv',
  'vet',
  'edu_core',
  'edu_adv',
];

const buildUniversityDirectory = (spec: UniversitySpec): UniversityDirectoryItem => {
  const catSet = new Set(spec.categories);
  const extraSet = new Set(spec.extraSlugs || []);
  const excludeSet = new Set(spec.excludeSlugs || []);

  const filteredBlueprints = MASTER_DEPARTMENT_BLUEPRINTS.filter((bp) => {
    if (spec.legacyIdOverrides?.[bp.slug]) return true;
    if (excludeSet.has(bp.slug)) return false;
    return catSet.has(bp.category) || extraSet.has(bp.slug);
  });

  const departments: DepartmentItem[] = filteredBlueprints.map((bp) => {
    const override = spec.legacyIdOverrides?.[bp.slug];
    const deptId = override?.id || `dept-${spec.id}-${bp.slug}`;
    const deptName = override?.name || bp.name;
    return {
      id: deptId,
      universityId: spec.id,
      name: deptName,
      code: bp.code,
      faculty: bp.faculty,
      logoUrl: createUniversityDeptCrest(spec.shortCode, bp.code, spec.primaryColor, spec.shieldColor),
      heroImageUrl: bp.heroImageUrl,
      caption: bp.caption,
      officialPortal: `${spec.officialWebsite}/${bp.slug}`,
      hodName: override?.hodName,
      legacy_status: override?.legacy_status || 'available',
      legacyPlaqueInstalled: false,
      pendingFoundingRequestId: override?.pendingFoundingRequestId,
      connectedClassAlbumIds: [],
    };
  });

  const facultyMap = new Map<string, string[]>();
  for (const d of departments) {
    const list = facultyMap.get(d.faculty) || [];
    if (!list.includes(d.name)) {
      list.push(d.name);
    }
    facultyMap.set(d.faculty, list);
  }

  return {
    id: spec.id,
    orderNumber: spec.orderNumber,
    name: spec.name,
    shortCode: spec.shortCode,
    location: spec.location,
    logoUrl: spec.logoUrl,
    officialWebsite: spec.officialWebsite,
    motto: spec.motto,
    departments,
    faculties: Array.from(facultyMap.entries()).map(([facultyName, deptNames]) => ({
      facultyName,
      departments: deptNames,
    })),
  };
};

// Authentic per-institution faculty & department configurations for Nigerian Federal, State, and Private Universities
const NIGERIAN_UNIVERSITY_SPECS: UniversitySpec[] = [
  {
    id: 'unilag',
    orderNumber: 4,
    name: 'University of Lagos (UNILAG)',
    shortCode: 'UNILAG',
    location: 'Akoka, Yaba, Lagos State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/d/d2/UniLagos.jpg',
    officialWebsite: 'https://unilag.edu.ng',
    motto: 'In Deed and in Truth',
    primaryColor: '#4A0E17',
    shieldColor: '#7C1626',
    // UNILAG does not have Agriculture or Veterinary Medicine faculties; strong in Law, Medicine, Engineering, Environmental, Mgt, Science, Arts
    categories: ALL_CATEGORIES.filter((c) => c !== 'agric_core' && c !== 'agric_adv' && c !== 'vet'),
    legacyIdOverrides: {
      csc: { id: 'dept-unilag-cs', name: 'Computer Science', hodName: 'Prof. O. Balogun' },
      eee: {
        id: 'dept-unilag-eee',
        name: 'Electrical & Electronics Engineering',
        hodName: 'Prof. A. S. Olabisi',
        legacy_status: 'pending_verification',
        pendingFoundingRequestId: 'fnd-req-unilag-eee-2024',
      },
      'law-com': { id: 'dept-unilag-law', name: 'Commercial & Corporate Law', hodName: 'Prof. I. A. Nwosu' },
    },
  },
  {
    id: 'ui',
    orderNumber: 5,
    name: 'University of Ibadan (UI)',
    shortCode: 'UI',
    location: 'Ibadan, Oyo State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/7/7e/University_of_Ibadan_logo.jpeg',
    officialWebsite: 'https://ui.edu.ng',
    motto: 'Recte Sapere Fons (To Think Straight is the Fount of Knowledge)',
    primaryColor: '#0A1931',
    shieldColor: '#183661',
    // UI has premier Medicine, Vet Medicine, Agriculture, Arts, Science, Technology, Law, Pharmacy, Education
    categories: ALL_CATEGORIES.filter((c) => c !== 'mgt_adv'),
    excludeSlugs: ['mkt', 'hrm'],
    legacyIdOverrides: {
      mbbs: { id: 'dept-ui-mbbs', name: 'Medicine & Surgery (MBBS)', hodName: 'Prof. K. A. Adeleke' },
      csc: { id: 'dept-ui-cs', name: 'Computer Science', hodName: 'Prof. T. O. Falade' },
    },
  },
  {
    id: 'unn',
    orderNumber: 6,
    name: 'University of Nigeria, Nsukka (UNN)',
    shortCode: 'UNN',
    location: 'Nsukka, Enugu State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://unn.edu.ng&size=256',
    officialWebsite: 'https://unn.edu.ng',
    motto: 'To Restore the Dignity of Man',
    primaryColor: '#0A2E1A',
    shieldColor: '#145230',
    categories: ALL_CATEGORIES,
    excludeSlugs: ['pet', 'tce', 'cyb'],
    legacyIdOverrides: {
      csc: { id: 'dept-unn-cs', name: 'Computer Science', hodName: 'Prof. E. C. Okeke' },
    },
  },
  {
    id: 'covenant',
    orderNumber: 7,
    name: 'Covenant University (CU)',
    shortCode: 'CU',
    location: 'Ota, Ogun State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://covenantuniversity.edu.ng&size=256',
    officialWebsite: 'https://covenantuniversity.edu.ng',
    motto: 'Raising a New Generation of Leaders',
    primaryColor: '#240B36',
    shieldColor: '#431463',
    // Covenant has 4 Colleges: Engineering, Leadership & Development Studies, Management & Social Sciences, Science & Technology (No Law, Medicine, Pharmacy, Vet, Agric, Education)
    categories: ['computing_core', 'eng_core', 'eng_pet', 'sci_core', 'soc_core', 'mgt_core', 'mgt_adv', 'env_core'],
    extraSlugs: ['che', 'bld', 'els', 'psy'],
    legacyIdOverrides: {
      arc: { id: 'dept-covenant-arch', name: 'Architecture', hodName: 'Dr. B. Oladunni' },
      csc: { id: 'dept-covenant-cs', name: 'Computer Science', hodName: 'Prof. A. A. Azeta' },
    },
  },
  {
    id: 'abu',
    orderNumber: 8,
    name: 'Ahmadu Bello University (ABU)',
    shortCode: 'ABU',
    location: 'Zaria, Kaduna State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/ABU_Zaria_logo.jpg',
    officialWebsite: 'https://abu.edu.ng',
    motto: 'Naturally Ahead',
    primaryColor: '#072A1E',
    shieldColor: '#104F38',
    categories: ALL_CATEGORIES,
    excludeSlugs: ['den'],
  },
  {
    id: 'uniben',
    orderNumber: 9,
    name: 'University of Benin (UNIBEN)',
    shortCode: 'UNIBEN',
    location: 'Ugbowo, Benin City, Edo State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://uniben.edu&size=256',
    officialWebsite: 'https://uniben.edu',
    motto: 'Knowledge for Service',
    primaryColor: '#3B0D4A',
    shieldColor: '#5B1873',
    categories: ALL_CATEGORIES.filter((c) => c !== 'computing_adv'),
    excludeSlugs: ['urp', 'qsv'],
  },
  {
    id: 'futa',
    orderNumber: 10,
    name: 'Federal University of Technology, Akure (FUTA)',
    shortCode: 'FUTA',
    location: 'Akure, Ondo State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://futa.edu.ng&size=256',
    officialWebsite: 'https://futa.edu.ng',
    motto: 'Technology for Self Reliance',
    primaryColor: '#1A1136',
    shieldColor: '#2E1E5C',
    // Specialized Federal University of Technology: Computing, Engineering, Earth/Mineral Sciences, Environmental, Agriculture, Basic Medical
    categories: ['computing_core', 'computing_adv', 'eng_core', 'eng_adv', 'sci_core', 'sci_earth', 'env_core', 'env_adv', 'agric_core', 'agric_adv'],
    extraSlugs: ['ana', 'pio', 'mls'],
  },
  {
    id: 'futminna',
    orderNumber: 11,
    name: 'Federal University of Technology, Minna (FUTMINNA)',
    shortCode: 'FUTMINNA',
    location: 'Minna, Niger State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Futminna_logo.jpg',
    officialWebsite: 'https://futminna.edu.ng',
    motto: 'Technology for Empowerment',
    primaryColor: '#0A2438',
    shieldColor: '#154266',
    categories: ['computing_core', 'computing_adv', 'eng_core', 'eng_adv', 'sci_core', 'sci_earth', 'env_core', 'env_adv', 'agric_core', 'edu_core'],
    extraSlugs: ['ent'],
    excludeSlugs: ['bme'],
  },
  {
    id: 'futo',
    orderNumber: 12,
    name: 'Federal University of Technology, Owerri (FUTO)',
    shortCode: 'FUTO',
    location: 'Ihiagwa, Owerri, Imo State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/1/16/FUTO_logo.png',
    officialWebsite: 'https://futo.edu.ng',
    motto: 'Technology for Service',
    primaryColor: '#0B2B1E',
    shieldColor: '#165239',
    categories: ['computing_core', 'computing_adv', 'eng_core', 'eng_adv', 'eng_pet', 'sci_core', 'sci_earth', 'env_core', 'env_adv', 'agric_core'],
    extraSlugs: ['puh', 'ana', 'pio', 'ent'],
  },
  {
    id: 'lasu',
    orderNumber: 13,
    name: 'Lagos State University (LASU)',
    shortCode: 'LASU',
    location: 'Ojo, Lagos State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Lagos_State_University_logo.png',
    officialWebsite: 'https://lasu.edu.ng',
    motto: 'For Truth and Service',
    primaryColor: '#0B1D3A',
    shieldColor: '#17376E',
    categories: ['computing_core', 'eng_core', 'law_core', 'law_adv', 'med_core', 'med_allied', 'sci_core', 'soc_core', 'soc_adv', 'mgt_core', 'mgt_adv', 'arts_core', 'arts_adv', 'edu_core', 'edu_adv'],
    extraSlugs: ['che', 'fis'],
  },
  {
    id: 'uniport',
    orderNumber: 14,
    name: 'University of Port Harcourt (UNIPORT)',
    shortCode: 'UNIPORT',
    location: 'Choba, Port Harcourt, Rivers State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://uniport.edu.ng&size=256',
    officialWebsite: 'https://uniport.edu.ng',
    motto: 'For Enlightenment and Self-Reliance',
    primaryColor: '#081E3E',
    shieldColor: '#123A73',
    categories: ['computing_core', 'eng_core', 'eng_pet', 'law_core', 'med_core', 'med_allied', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'soc_adv', 'mgt_core', 'mgt_adv', 'arts_core', 'agric_core', 'edu_core'],
    extraSlugs: ['che', 'mte', 'fis'],
  },
  {
    id: 'unizik',
    orderNumber: 15,
    name: 'Nnamdi Azikiwe University (UNIZIK)',
    shortCode: 'UNIZIK',
    location: 'Awka, Anambra State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/8/8e/Badge_of_Nnamdi_Azikiwe_University.png',
    officialWebsite: 'https://unizik.edu.ng',
    motto: 'Discipline, Self-Reliance and Excellence',
    primaryColor: '#0F243D',
    shieldColor: '#1D4370',
    categories: ['computing_core', 'eng_core', 'eng_adv', 'law_core', 'law_adv', 'med_core', 'med_allied', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'mgt_core', 'mgt_adv', 'env_core', 'env_adv', 'arts_core', 'arts_adv', 'agric_core', 'edu_core'],
    excludeSlugs: ['den', 'bme', 'tce'],
  },
  {
    id: 'buk',
    orderNumber: 16,
    name: 'Bayero University Kano (BUK)',
    shortCode: 'BUK',
    location: 'Kano, Kano State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/0/04/Bayerouniversitylogo.jpg',
    officialWebsite: 'https://buk.edu.ng',
    motto: 'Above Every Possessor of Knowledge is the All-Knowing',
    primaryColor: '#0A293B',
    shieldColor: '#164B69',
    categories: ['computing_core', 'computing_adv', 'eng_core', 'eng_adv', 'law_core', 'med_core', 'med_allied', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'soc_adv', 'mgt_core', 'env_core', 'env_adv', 'arts_core', 'agric_core', 'vet', 'edu_core', 'edu_adv'],
    excludeSlugs: ['mme', 'bme', 'tha'],
  },
  {
    id: 'unical',
    orderNumber: 17,
    name: 'University of Calabar (UNICAL)',
    shortCode: 'UNICAL',
    location: 'Calabar, Cross River State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/University_of_Calabar_Logo.jpg',
    officialWebsite: 'https://unical.edu.ng',
    motto: 'Knowledge for Service',
    primaryColor: '#0E2438',
    shieldColor: '#1A4266',
    categories: ['computing_core', 'eng_core', 'law_core', 'law_adv', 'med_core', 'med_allied', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'soc_adv', 'mgt_core', 'mgt_adv', 'arts_core', 'arts_adv', 'agric_core', 'agric_adv', 'edu_core', 'edu_adv'],
    excludeSlugs: ['den', 'irm', 'hrm'],
  },
  {
    id: 'uniuyo',
    orderNumber: 18,
    name: 'University of Uyo (UNIUYO)',
    shortCode: 'UNIUYO',
    location: 'Uyo, Akwa Ibom State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://uniuyo.edu.ng&size=256',
    officialWebsite: 'https://uniuyo.edu.ng',
    motto: 'Unity, Learning and Service',
    primaryColor: '#3B0F18',
    shieldColor: '#691B2B',
    categories: ['computing_core', 'eng_core', 'eng_pet', 'law_core', 'med_core', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'soc_adv', 'mgt_core', 'mgt_adv', 'env_core', 'env_adv', 'arts_core', 'arts_adv', 'agric_core', 'agric_adv', 'edu_core'],
    extraSlugs: ['che', 'abe', 'fte'],
    excludeSlugs: ['hrm'],
  },
  {
    id: 'unijos',
    orderNumber: 19,
    name: 'University of Jos (UNIJOS)',
    shortCode: 'UNIJOS',
    location: 'Jos, Plateau State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/e/ef/University_of_Jos_logo.jpg',
    officialWebsite: 'https://unijos.edu.ng',
    motto: 'Discipline and Dedication',
    primaryColor: '#0D213B',
    shieldColor: '#1B3F6E',
    categories: ['computing_core', 'eng_core', 'law_core', 'law_adv', 'med_core', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'soc_adv', 'mgt_core', 'env_core', 'env_adv', 'arts_core', 'arts_adv', 'agric_core', 'vet', 'edu_core', 'edu_adv'],
    excludeSlugs: ['svg', 'gph'],
  },
  {
    id: 'unimaid',
    orderNumber: 20,
    name: 'University of Maiduguri (UNIMAID)',
    shortCode: 'UNIMAID',
    location: 'Maiduguri, Borno State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/4/4d/University_of_Maiduguri_Teaching_Hospital_Logo.jpg',
    officialWebsite: 'https://unimaid.edu.ng',
    motto: 'Knowledge is Light',
    primaryColor: '#0A291F',
    shieldColor: '#144D3A',
    categories: ['computing_core', 'eng_core', 'law_core', 'law_adv', 'med_core', 'med_allied', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'mgt_core', 'arts_core', 'agric_core', 'agric_adv', 'vet', 'edu_core', 'edu_adv'],
    extraSlugs: ['che', 'abe', 'fte'],
  },
  {
    id: 'funaab',
    orderNumber: 21,
    name: 'Federal University of Agriculture, Abeokuta (FUNAAB)',
    shortCode: 'FUNAAB',
    location: 'Abeokuta, Ogun State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/9/98/FUNAAB_Logo.jpg',
    officialWebsite: 'https://funaab.edu.ng',
    motto: 'Knowledge for Development',
    primaryColor: '#092B18',
    shieldColor: '#145230',
    // Specialized Federal University of Agriculture: Agriculture, Vet Medicine, Engineering, Biosciences, Physical Sciences, Food/Nutrition
    categories: ['agric_core', 'agric_adv', 'vet', 'computing_core', 'eng_core', 'sci_core'],
    extraSlugs: ['abe', 'fte', 'mte', 'ndd', 'eco', 'bus', 'ent'],
  },
  {
    id: 'lautech',
    orderNumber: 22,
    name: 'Ladoke Akintola University of Technology (LAUTECH)',
    shortCode: 'LAUTECH',
    location: 'Ogbomoso, Oyo State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://lautech.edu.ng&size=256',
    officialWebsite: 'https://lautech.edu.ng',
    motto: 'Excellence, Integrity and Service',
    primaryColor: '#361212',
    shieldColor: '#612121',
    categories: ['computing_core', 'computing_adv', 'eng_core', 'med_core', 'sci_core', 'env_core', 'agric_core', 'mgt_core'],
    extraSlugs: ['che', 'abe', 'fte', 'urp', 'bld', 'gph'],
    excludeSlugs: ['pad'],
  },
  {
    id: 'aaua',
    orderNumber: 23,
    name: 'Adekunle Ajasin University, Akungba-Akoko (AAUA)',
    shortCode: 'AAUA',
    location: 'Akungba-Akoko, Ondo State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/69/WUGN_Adekunle_Ajasin_University_Fan_Club_logo.png',
    officialWebsite: 'https://aaua.edu.ng',
    motto: 'For Learning and Service',
    primaryColor: '#0E213D',
    shieldColor: '#1B3E70',
    categories: ['computing_core', 'law_core', 'law_adv', 'sci_core', 'sci_earth', 'soc_core', 'soc_adv', 'mgt_core', 'arts_core', 'arts_adv', 'agric_core', 'edu_core', 'edu_adv'],
  },
  {
    id: 'eksu',
    orderNumber: 24,
    name: 'Ekiti State University (EKSU)',
    shortCode: 'EKSU',
    location: 'Ado-Ekiti, Ekiti State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://eksu.edu.ng&size=256',
    officialWebsite: 'https://eksu.edu.ng',
    motto: 'Knowledge, Honour and Service',
    primaryColor: '#3B0E18',
    shieldColor: '#69192B',
    categories: ['computing_core', 'eng_core', 'law_core', 'med_core', 'sci_core', 'soc_core', 'soc_adv', 'mgt_core', 'mgt_adv', 'arts_core', 'agric_core', 'edu_core'],
    excludeSlugs: ['mls'],
  },
  {
    id: 'delsu',
    orderNumber: 25,
    name: 'Delta State University, Abraka (DELSU)',
    shortCode: 'DELSU',
    location: 'Abraka, Delta State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://delsu.edu.ng&size=256',
    officialWebsite: 'https://delsu.edu.ng',
    motto: 'Knowledge, Character and Service',
    primaryColor: '#0A213D',
    shieldColor: '#153F73',
    categories: ['computing_core', 'eng_core', 'eng_pet', 'law_core', 'med_core', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'mgt_core', 'arts_core', 'arts_adv', 'agric_core', 'edu_core', 'edu_adv'],
    extraSlugs: ['che'],
  },
  {
    id: 'rsu',
    orderNumber: 26,
    name: 'Rivers State University (RSU)',
    shortCode: 'RSU',
    location: 'Nkpolu-Oroworukwo, Port Harcourt, Rivers State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://rsu.edu.ng&size=256',
    officialWebsite: 'https://rsu.edu.ng',
    motto: 'Excellence and Creativity',
    primaryColor: '#0B213A',
    shieldColor: '#163E6E',
    categories: ['computing_core', 'eng_core', 'eng_pet', 'law_core', 'law_adv', 'med_core', 'sci_core', 'soc_core', 'mgt_core', 'mgt_adv', 'env_core', 'env_adv', 'agric_core', 'edu_core'],
    extraSlugs: ['che', 'abe', 'fte', 'fis'],
    excludeSlugs: ['hrm', 'irm'],
  },
  {
    id: 'babcock',
    orderNumber: 27,
    name: 'Babcock University (BU)',
    shortCode: 'BABCOCK',
    location: 'Ilishan-Remo, Ogun State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/e/ea/Babcock_University_Logo.jpg',
    officialWebsite: 'https://babcock.edu.ng',
    motto: 'Knowledge, Truth, Service',
    primaryColor: '#0A1E3C',
    shieldColor: '#153970',
    categories: ['computing_core', 'computing_adv', 'law_core', 'med_core', 'sci_core', 'soc_core', 'mgt_core', 'mgt_adv', 'agric_core', 'edu_core'],
    extraSlugs: ['puh', 'ndd', 'els', 'his', 'swk'],
    excludeSlugs: ['irm'],
  },
  {
    id: 'abuad',
    orderNumber: 28,
    name: 'Afe Babalola University, Ado-Ekiti (ABUAD)',
    shortCode: 'ABUAD',
    location: 'Ado-Ekiti, Ekiti State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://abuad.edu.ng&size=256',
    officialWebsite: 'https://abuad.edu.ng',
    motto: 'Labor Servitium et Integritas (Labour for Service and Integrity)',
    primaryColor: '#0A291C',
    shieldColor: '#144D35',
    categories: ['computing_core', 'eng_core', 'eng_pet', 'law_core', 'law_adv', 'med_core', 'pharm', 'sci_core', 'soc_core', 'mgt_core'],
    extraSlugs: ['che', 'mte', 'bme', 'arc', 'els', 'age'],
  },
  {
    id: 'bowen',
    orderNumber: 29,
    name: 'Bowen University',
    shortCode: 'BOWEN',
    location: 'Iwo, Osun State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bowen.edu.ng&size=256',
    officialWebsite: 'https://bowen.edu.ng',
    motto: 'Excellence and Godliness',
    primaryColor: '#0D1E3A',
    shieldColor: '#19396E',
    categories: ['computing_core', 'law_core', 'med_core', 'sci_core', 'soc_core', 'mgt_core', 'agric_core'],
    extraSlugs: ['swe', 'cyb', 'eee', 'mee', 'arc', 'pht', 'ndd', 'els', 'tha', 'rel'],
    excludeSlugs: ['pad'],
  },
  {
    id: 'pau',
    orderNumber: 30,
    name: 'Pan-Atlantic University (PAU)',
    shortCode: 'PAU',
    location: 'Ibeju-Lekki, Lagos State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/6/66/Logo_of_Pan-Atlantic_University.png',
    officialWebsite: 'https://pau.edu.ng',
    motto: 'Competence, Character and Service',
    primaryColor: '#0A1C38',
    shieldColor: '#14366B',
    // PAU offers specialized undergraduate programmes in SST, SMC, and SMSS (11 authentic departments)
    categories: ['computing_core', 'mgt_core'],
    extraSlugs: ['swe', 'eee', 'mee', 'eco', 'mac', 'ift'],
    excludeSlugs: ['pad'],
  },
  {
    id: 'nile',
    orderNumber: 31,
    name: 'Nile University of Nigeria',
    shortCode: 'NILE',
    location: 'Jabi, Abuja (FCT)',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/2/2a/Logo_of_Nile_University_Abuja_Nigeria.svg',
    officialWebsite: 'https://nileuniversity.edu.ng',
    motto: 'Build Your Success',
    primaryColor: '#0B1F3B',
    shieldColor: '#163B70',
    categories: ['computing_core', 'computing_adv', 'eng_core', 'eng_pet', 'law_core', 'med_core', 'soc_core', 'mgt_core'],
    extraSlugs: ['che', 'mte', 'arc', 'bch', 'mcb', 'els', 'crm'],
    excludeSlugs: ['mls', 'nsc'],
  },
  {
    id: 'udus',
    orderNumber: 32,
    name: 'Usmanu Danfodiyo University, Sokoto (UDUS)',
    shortCode: 'UDUS',
    location: 'Sokoto, Sokoto State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://udusok.edu.ng&size=256',
    officialWebsite: 'https://udusok.edu.ng',
    motto: 'Read in the Name of Your Lord',
    primaryColor: '#0A291D',
    shieldColor: '#144D37',
    categories: ['computing_core', 'eng_core', 'law_core', 'med_core', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'mgt_core', 'arts_core', 'arts_adv', 'agric_core', 'agric_adv', 'vet', 'edu_core', 'edu_adv'],
    excludeSlugs: ['tha', 'gph'],
  },
  {
    id: 'atbu',
    orderNumber: 33,
    name: 'Abubakar Tafawa Balewa University (ATBU)',
    shortCode: 'ATBU',
    location: 'Bauchi, Bauchi State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/6/6e/Abubakar_Tafawa_Balewa_University_%28crest%29.png',
    officialWebsite: 'https://atbu.edu.ng',
    motto: 'Doctrina Mater Artium (Learning is the Mother of All Arts)',
    primaryColor: '#0B243B',
    shieldColor: '#164570',
    categories: ['computing_core', 'eng_core', 'eng_adv', 'sci_core', 'sci_earth', 'env_core', 'env_adv', 'agric_core', 'mgt_core', 'edu_core'],
    extraSlugs: ['mbbs'],
    excludeSlugs: ['bme', 'tce', 'pad'],
  },
  {
    id: 'mouau',
    orderNumber: 34,
    name: 'Michael Okpara University of Agriculture, Umudike (MOUAU)',
    shortCode: 'MOUAU',
    location: 'Umudike, Abia State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/5/5a/Moua_logo.jpg',
    officialWebsite: 'https://mouau.edu.ng',
    motto: 'Knowledge, Food and Security',
    primaryColor: '#0A2919',
    shieldColor: '#144F30',
    categories: ['agric_core', 'agric_adv', 'vet', 'computing_core', 'eng_core', 'sci_core', 'mgt_core', 'edu_core'],
    extraSlugs: ['abe', 'fte', 'ndd', 'eco', 'ent'],
    excludeSlugs: ['pad'],
  },
  {
    id: 'uniosun',
    orderNumber: 35,
    name: 'Osun State University (UNIOSUN)',
    shortCode: 'UNIOSUN',
    location: 'Osogbo, Osun State',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a4/Osun_State_University.jpeg',
    officialWebsite: 'https://uniosun.edu.ng',
    motto: 'Living Spring of Knowledge and Culture',
    primaryColor: '#0A261B',
    shieldColor: '#144A34',
    categories: ['computing_core', 'eng_core', 'law_core', 'med_core', 'sci_core', 'soc_core', 'mgt_core', 'arts_core', 'agric_core', 'edu_core'],
    extraSlugs: ['urp', 'bld', 'esm', 'puh', 'lin', 'ent'],
  },
  {
    id: 'run',
    orderNumber: 36,
    name: "Redeemer's University (RUN)",
    shortCode: 'RUN',
    location: 'Ede, Osun State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://run.edu.ng&size=256',
    officialWebsite: 'https://run.edu.ng',
    motto: 'Running with a Vision',
    primaryColor: '#141B3D',
    shieldColor: '#253370',
    categories: ['computing_core', 'law_core', 'sci_core', 'soc_core', 'mgt_core', 'arts_core'],
    extraSlugs: ['cyb', 'eee', 'mee', 'cve', 'nsc', 'mls', 'ana', 'pio', 'psy'],
    excludeSlugs: ['pad'],
  },
  {
    id: 'aau-ekpoma',
    orderNumber: 37,
    name: 'Ambrose Alli University, Ekpoma (AAU)',
    shortCode: 'AAU',
    location: 'Ekpoma, Edo State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://aauekpoma.edu.ng&size=256',
    officialWebsite: 'https://aauekpoma.edu.ng',
    motto: 'Knowledge for Advancement',
    primaryColor: '#0D213B',
    shieldColor: '#193E6E',
    categories: ['computing_core', 'eng_core', 'law_core', 'med_core', 'sci_core', 'sci_earth', 'soc_core', 'mgt_core', 'env_core', 'env_adv', 'arts_core', 'agric_core', 'edu_core'],
    excludeSlugs: ['qsv', 'svg'],
  },
  {
    id: 'uniabuja',
    orderNumber: 38,
    name: 'University of Abuja (UNIABUJA)',
    shortCode: 'UNIABUJA',
    location: 'Gwagwalada, Abuja (FCT)',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://uniabuja.edu.ng&size=256',
    officialWebsite: 'https://uniabuja.edu.ng',
    motto: 'For Unity and Scholarship',
    primaryColor: '#09291C',
    shieldColor: '#134F36',
    categories: ['computing_core', 'eng_core', 'law_core', 'law_adv', 'med_core', 'sci_core', 'soc_core', 'soc_adv', 'mgt_core', 'arts_core', 'agric_core', 'vet', 'edu_core', 'edu_adv'],
    extraSlugs: ['che'],
    excludeSlugs: ['crm'],
  },
  {
    id: 'esut',
    orderNumber: 39,
    name: 'Enugu State University of Science and Technology (ESUT)',
    shortCode: 'ESUT',
    location: 'Agbani, Enugu State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://esut.edu.ng&size=256',
    officialWebsite: 'https://esut.edu.ng',
    motto: 'Technology for Service',
    primaryColor: '#2E1118',
    shieldColor: '#57202D',
    categories: ['computing_core', 'eng_core', 'eng_adv', 'law_core', 'med_core', 'pharm', 'sci_core', 'mgt_core', 'env_core', 'env_adv', 'agric_core', 'edu_core'],
    extraSlugs: ['mac', 'eco'],
    excludeSlugs: ['bme', 'tce', 'pcl'],
  },
  {
    id: 'fuoye',
    orderNumber: 40,
    name: 'Federal University Oye-Ekiti (FUOYE)',
    shortCode: 'FUOYE',
    location: 'Oye-Ekiti, Ekiti State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://fuoye.edu.ng&size=256',
    officialWebsite: 'https://fuoye.edu.ng',
    motto: 'Innovation and Character for National Transformation',
    primaryColor: '#0B291B',
    shieldColor: '#154F34',
    categories: ['computing_core', 'eng_core', 'eng_adv', 'law_core', 'med_core', 'pharm', 'sci_core', 'sci_earth', 'soc_core', 'soc_adv', 'mgt_core', 'arts_core', 'agric_core', 'agric_adv', 'edu_core'],
    excludeSlugs: ['bme', 'tce', 'pcl', 'gph'],
  },
  {
    id: 'fud',
    orderNumber: 41,
    name: 'Federal University Dutse (FUD)',
    shortCode: 'FUD',
    location: 'Dutse, Jigawa State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://fud.edu.ng&size=256',
    officialWebsite: 'https://fud.edu.ng',
    motto: 'Knowledge, Excellence and Service',
    primaryColor: '#0A261E',
    shieldColor: '#144A3A',
    categories: ['computing_core', ' computing_adv' as DeptCategory, 'med_core', 'sci_core', 'soc_core', 'agric_core'],
    extraSlugs: ['swe', 'cyb', 'acc', 'bus', 'bfn', 'els', 'crm', 'fwm', 'fis'],
    excludeSlugs: ['mls', 'nsc'],
  },
  {
    id: 'fulafia',
    orderNumber: 42,
    name: 'Federal University of Lafia (FULAFIA)',
    shortCode: 'FULAFIA',
    location: 'Lafia, Nasarawa State',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://fulafia.edu.ng&size=256',
    officialWebsite: 'https://fulafia.edu.ng',
    motto: 'Integrity, Innovation and Excellence',
    primaryColor: '#12213B',
    shieldColor: '#213E6E',
    categories: ['computing_core', 'med_core', 'sci_core', 'soc_core', 'mgt_core', 'arts_core', 'agric_core', 'edu_core'],
    extraSlugs: ['geo', 'swk', 'lis'],
    excludeSlugs: ['pad'],
  },
  {
    id: 'baze',
    orderNumber: 43,
    name: 'Baze University',
    shortCode: 'BAZE',
    location: 'Jabi, Abuja (FCT)',
    logoUrl: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bazeuniversity.edu.ng&size=256',
    officialWebsite: 'https://bazeuniversity.edu.ng',
    motto: 'Learn, To Live',
    primaryColor: '#0C1E3A',
    shieldColor: '#173A70',
    categories: ['computing_core', 'computing_adv', 'eng_core', 'eng_pet', 'law_core', 'soc_core', 'mgt_core', 'env_core'],
    extraSlugs: ['mbbs', 'bch', 'mcb', 'qsv', 'urp', 'bld'],
    excludeSlugs: ['pad', 'soc'],
  },
];

export const NIGERIAN_UNIVERSITIES_DIRECTORY: UniversityDirectoryItem[] =
  NIGERIAN_UNIVERSITY_SPECS.map(buildUniversityDirectory);
