import { ClassSet, UniversityDirectoryItem, StudentProfile, AwardItem, MemoryEvent, VoiceItem } from '../types';

export const CROWNFIELD_UNIVERSITY: UniversityDirectoryItem = {
  id: 'crownfield',
  orderNumber: 10,
  name: 'Crownfield University',
  shortCode: 'CU',
  location: 'Victoria Island, Lagos',
  logoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=160&auto=format&fit=crop&q=80',
  officialWebsite: 'https://crownfield.edu.ng',
  motto: 'Lex et Veritas, Justitia Omnibus',
  departments: [
    {
      id: 'dept-crownfield-public-law',
      universityId: 'crownfield',
      name: 'Department of Public Law',
      code: 'PUB-LAW',
      faculty: 'Faculty of Law',
      logoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=160&auto=format&fit=crop&q=80',
      heroImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&auto=format&fit=crop&q=80',
      caption: 'Fostering judicial courage, constitutional acumen, and transformative legal scholarship across Africa. Home to generations of Senior Advocates, jurists, and reformative legal pioneers.',
      officialPortal: 'https://law.crownfield.edu.ng',
      hodName: 'Prof. Adeyemi Adeleke, SAN',
      legacy_status: 'established',
      founding_class_id: 'crownfield-law-2023',
      founding_class_year: 2023,
      legacyPlaqueInstalled: true,
      legacyPlaqueInstallationDate: '24 November 2023',
      legacyPlaqueLocation: 'Faculty of Law Moot Court Foyer, Crownfield Campus',
    },
  ],
};

interface StudentSeed {
  name: string;
  nickname: string;
  gender: 'M' | 'F';
  photoUrl: string;
  position?: string;
  quote: string;
  bio: string;
  handle: string;
}

const NIGERIAN_LAW_STUDENTS_MASTER: StudentSeed[] = [
  // 1. Male - President / Senior
  {
    name: 'Oluwaseun Babatunde Adeleke',
    nickname: 'The Jurist',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=720&auto=format&fit=crop&q=85',
    position: 'LAWSAN President',
    quote: 'The law must never be an instrument of subjugation, but an uncompromising shield for human dignity.',
    bio: 'Constitutional law scholar, winner of the National All-Nigeria Moot Court Championship. Aspiring Supreme Court advocate.',
    handle: '@seun_adeleke',
  },
  // 2. Female - Vice President
  {
    name: 'Amina Zainab Bello',
    nickname: 'Lady Justice',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=720&auto=format&fit=crop&q=85',
    position: 'Vice President, LAWSAN',
    quote: 'Justice is sweet only when the weak and the mighty stand on the exact same footing.',
    bio: 'First Class honors graduate, legal policy researcher, and advocate for child education reforms in northern Nigeria.',
    handle: '@amina_bello_esq',
  },
  // 3. Male - Chief Justice Moot Court
  {
    name: 'Chisom Emmanuel Okonkwo',
    nickname: 'Lord Denning',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=720&auto=format&fit=crop&q=85',
    position: 'Chief Justice, Crownfield Moot Court',
    quote: 'Precedents guide our path, but courage dictates where the law must evolve.',
    bio: 'Master orator with 14 moot court victories. Interned at leading appellate litigation chambers in Ikoyi.',
    handle: '@chisom_denning',
  },
  // 4. Female - General Secretary
  {
    name: 'Ifeoma Chiamaka Nwosu',
    nickname: 'Portia',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=720&auto=format&fit=crop&q=85',
    position: 'General Secretary',
    quote: 'Precision in drafting is the soul of persuasive advocacy.',
    bio: 'Corporate dispute resolution enthusiast, editor-in-chief of Crownfield Law Review, incoming associate at Banwo & Ighodalo.',
    handle: '@ifeoma_nwosu',
  },
  // 5. Male - Public Relations Officer
  {
    name: 'Folarin Gbolahan Balogun',
    nickname: 'Cicero',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=720&auto=format&fit=crop&q=85',
    position: 'Public Relations Officer',
    quote: 'Speak with relentless clarity; the truth requires neither embellishment nor fear.',
    bio: 'Broadcast journalist turned international human rights advocate. Spearheaded the Faculty Law Clinic pro-bono initiative.',
    handle: '@folarin_balogun',
  },
  // 6. Female - Financial Secretary
  {
    name: 'Damilola Folashade Adeleke',
    nickname: 'Lady Advocate',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=720&auto=format&fit=crop&q=85',
    position: 'Financial Secretary',
    quote: 'Fiscal integrity and ethical stewardship are the bedrocks of public trust.',
    bio: 'Taxation law and public finance specialist. Graduating with distinctions in Jurisprudence and Commercial Law.',
    handle: '@dami_adeleke',
  },
  // 7. Male - Class Rep
  {
    name: 'Chiemeka Anthony Eze',
    nickname: 'The Silk',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=720&auto=format&fit=crop&q=85',
    position: 'Class Representative',
    quote: 'Service to my classmates was the highest honor of my undergraduate years.',
    bio: 'Steered the cohort through 5 rigorous academic years with unmatched dedication, consensus-building, and poise.',
    handle: '@tonyeze_law',
  },
  // 8. Female - Welfare Director
  {
    name: 'Blessing Chioma Okoro',
    nickname: 'Mother of Equity',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=720&auto=format&fit=crop&q=85',
    position: 'Welfare Director',
    quote: 'Equity will not suffer a wrong to be without a remedy, nor a student without a helping hand.',
    bio: 'Public health legal advisor and community organizer. Founder of the Crownfield Mental Wellbeing in Law circle.',
    handle: '@blessing_okoro',
  },
  // 9. Male - Sports Director
  {
    name: 'Tariq Al-Mansoor Danladi',
    nickname: 'The Titan',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1507152832244-10d45c7eda57?w=720&auto=format&fit=crop&q=85',
    position: 'Sports Director',
    quote: 'Discipline in training translates into iron resilience at the Bar.',
    bio: 'Captain of the Crownfield Law Football Team, led the department to historic inter-faculty tournament victory.',
    handle: '@tariq_danladi',
  },
  // 10. Female - Legal Research Director
  {
    name: 'Ngozi Vivian Eke',
    nickname: 'The Lexicon',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=720&auto=format&fit=crop&q=85',
    position: 'Director of Legal Research',
    quote: 'Deep research reveals the legal nuances that transform an argument into an indomitable ruling.',
    bio: 'Author of 3 published law review commentaries on maritime jurisdiction in the Gulf of Guinea.',
    handle: '@ngozi_eke',
  },
  // 11. Male - Social Director
  {
    name: 'Kelechi Obinna Madu',
    nickname: 'Lord Chancellor',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1530268729831-4b0b9e170218?w=720&auto=format&fit=crop&q=85',
    position: 'Social Director',
    quote: 'The study of law is rigorous; companionship and laughter make the voyage worthwhile.',
    bio: 'Master of ceremonies for the iconic Law Dinners and Ball. Passionate entertainment and intellectual property lawyer.',
    handle: '@kelechi_madu',
  },
  // 12. Female - Academic Lead
  {
    name: 'Zainab Halima Mohammed',
    nickname: 'The Ratio',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=720&auto=format&fit=crop&q=85',
    position: 'Academic Committee Head',
    quote: 'Master the ratio decidendi, and you will command any courtroom.',
    bio: 'Pioneered peer-to-peer case law study groups that raised the department passing rate to 98% in Nigerian Legal System.',
    handle: '@zainab_mohammed',
  },
  // 13. Male - Assistant General Secretary
  {
    name: 'Babatunde Olumide Fashola',
    nickname: 'Blackstone',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=720&auto=format&fit=crop&q=85',
    quote: 'Order, diligence, and unwavering respect for due process.',
    bio: 'Specializing in administrative and regulatory compliance, incoming graduate trainee at Olaniwun Ajayi LP.',
    handle: '@babatunde_fashola',
  },
  // 14. Female - Human Rights Lead
  {
    name: 'Kemi Ronke Alabi',
    nickname: 'The Oracle',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?w=720&auto=format&fit=crop&q=85',
    quote: 'Never hesitate to stand alone if you are standing with justice.',
    bio: 'Lead organizer of the Crownfield Prison Decongestion & Legal Aid outreach across Lagos State custodial centres.',
    handle: '@kemi_alabi',
  },
  // 15. Male - Environmental Law Lead
  {
    name: 'Somtochukwu David Uzoh',
    nickname: 'The Advocate',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1520451644838-906a72aa7c86?w=720&auto=format&fit=crop&q=85',
    quote: 'Natural justice belongs to the soil, water, and generations yet unborn.',
    bio: 'Environmental and energy law enthusiast, researcher on Niger Delta environmental remediation jurisprudence.',
    handle: '@somto_uzoh',
  },
  // 16. Female - Tech Law Lead
  {
    name: 'Halima Aisha Garba',
    nickname: 'CyberJuris',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=720&auto=format&fit=crop&q=85',
    quote: 'Technology writes the future; the law must engineer its ethical boundaries.',
    bio: 'Fintech and cross-border data protection specialist, published author on the Nigeria Data Protection Act 2023.',
    handle: '@halima_garba',
  },
  // 17. Male - Dispute Specialist
  {
    name: 'Chidubem Paul Nwachukwu',
    nickname: 'Arbitrator',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1542178243-bc20204b769f?w=720&auto=format&fit=crop&q=85',
    quote: 'True victory lies in peaceful resolution before an adversarial trial even begins.',
    bio: 'Associate member of the Chartered Institute of Arbitrators (UK), runner-up in the African ADR moot tournament.',
    handle: '@chidubem_paul',
  },
  // 18. Female - Criminal Justice Specialist
  {
    name: 'Titilayo Omowunmi Ogunlesi',
    nickname: 'Clio',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=720&auto=format&fit=crop&q=85',
    quote: 'The measure of a society is how it treats those in custody.',
    bio: 'Criminal defense advocate and researcher on restorative justice models for youth rehabilitation in Nigeria.',
    handle: '@titi_ogunlesi',
  },
  // 19. Male - International Law Specialist
  {
    name: 'Emeka Victor Onyekachi',
    nickname: 'Grotius',
    gender: 'M',
    photoUrl: 'https://images.unsplash.com/photo-1584999734482-0361aecad844?w=720&auto=format&fit=crop&q=85',
    quote: 'Treaties and covenants bind nations; integrity binds individuals.',
    bio: 'International humanitarian law expert, delegate to the Model African Union Summit in Addis Ababa.',
    handle: '@emeka_victor',
  },
  // 20. Female - Valedictorian Candidate
  {
    name: 'Simisola Abidemi Martins',
    nickname: 'Prima Donna',
    gender: 'F',
    photoUrl: 'https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=720&auto=format&fit=crop&q=85',
    quote: 'Our voices will echo in courtrooms, boardrooms, and corridors of power across the globe.',
    bio: 'Class valedictorian with a 4.92 Cumulative GPA, recipient of the Faculty Dean’s Gold Medal for Legal Excellence.',
    handle: '@simi_martins',
  },
];

function generateStudentsForSet(setId: string, year: number): StudentProfile[] {
  return NIGERIAN_LAW_STUDENTS_MASTER.map((seed, idx) => ({
    id: `std-${setId}-${idx + 1}`,
    setId,
    fullName: seed.name,
    nickname: seed.nickname,
    position: seed.position,
    leaderOrder: seed.position ? idx + 1 : undefined,
    photoUrl: seed.photoUrl,
    rawPhotoUrl: seed.photoUrl,
    originalSizeKb: 3400 + (idx * 60),
    compressedSizeKb: 75 + (idx * 2),
    quote: seed.quote,
    bio: seed.bio,
    email: `${seed.handle.replace('@', '')}.${year}@crownfield.edu.ng`,
    instagramOrTwitter: seed.handle,
    socials: {
      linkedin: `https://linkedin.com/in/${seed.handle.replace('@', '')}`,
      instagram: seed.handle,
      twitter: seed.handle,
    },
    whatsappNumber: `+234803${(idx + 1).toString().padStart(7, '4')}`,
    isClassRep: seed.position?.includes('Class Representative') || false,
    approved: true,
    approvedAt: `202${year - 2020}-10-15`,
    submittedAt: `202${year - 2020}-09-20`,
  }));
}

function generateAwardsForSet(setId: string): AwardItem[] {
  return [
    {
      id: `awd-${setId}-1`,
      setId,
      category: 'Best Courtroom Orator',
      winnerName: 'Chisom Emmanuel Okonkwo',
      winnerNickname: 'Lord Denning',
      winnerAvatar: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=720&auto=format&fit=crop&q=85',
      trophyType: 'gold',
      votesCount: 142,
      citation: 'For unparalleled eloquence, constitutional mastery, and dominant arguments inside the Faculty Moot Court.',
    },
    {
      id: `awd-${setId}-2`,
      setId,
      category: 'Academic Titan of the Set',
      winnerName: 'Simisola Abidemi Martins',
      winnerNickname: 'Prima Donna',
      winnerAvatar: 'https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=720&auto=format&fit=crop&q=85',
      trophyType: 'gold',
      votesCount: 138,
      citation: 'Graduating top of the set with near-perfect grades across Constitutional, Criminal, and Commercial Law.',
    },
    {
      id: `awd-${setId}-3`,
      setId,
      category: 'Exemplary Leadership Award',
      winnerName: 'Oluwaseun Babatunde Adeleke',
      winnerNickname: 'The Jurist',
      winnerAvatar: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=720&auto=format&fit=crop&q=85',
      trophyType: 'gold',
      votesCount: 125,
      citation: 'For principled advocacy, unifying the class, and championing student welfare with unyielding integrity.',
    },
    {
      id: `awd-${setId}-4`,
      setId,
      category: 'Best Dressed & Regal Poise',
      winnerName: 'Kelechi Obinna Madu',
      winnerNickname: 'Lord Chancellor',
      winnerAvatar: 'https://images.unsplash.com/photo-1530268729831-4b0b9e170218?w=720&auto=format&fit=crop&q=85',
      trophyType: 'silver',
      votesCount: 118,
      citation: 'For carrying the dignity of the legal profession with timeless sartorial elegance and courtroom poise.',
    },
    {
      id: `awd-${setId}-5`,
      setId,
      category: 'Human Rights Champion',
      winnerName: 'Kemi Ronke Alabi',
      winnerNickname: 'The Oracle',
      winnerAvatar: 'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?w=720&auto=format&fit=crop&q=85',
      trophyType: 'silver',
      votesCount: 104,
      citation: 'For leading community prison decongestion visits and securing pro-bono bail for indigent citizens.',
    },
    {
      id: `awd-${setId}-6`,
      setId,
      category: 'Moot Court MVP',
      winnerName: 'Amina Zainab Bello',
      winnerNickname: 'Lady Justice',
      winnerAvatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=720&auto=format&fit=crop&q=85',
      trophyType: 'bronze',
      votesCount: 96,
      citation: 'For drafting winning appellate briefs and anchoring team victories at international university competitions.',
    },
  ];
}

function generateMemoriesForSet(setId: string, year: number): MemoryEvent[] {
  return [
    {
      id: `mem-${setId}-1`,
      setId,
      eventTag: 'Moot Court Trials',
      title: 'Moot Court Trials & Advocacy Battles',
      dateStr: `${year}-05-18`,
      caption: 'Heated courtroom debates and landmark constitutional simulations in the Crownfield Grand Moot Court.',
      images: [
        {
          id: `img-${setId}-1-1`,
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&auto=format&fit=crop&q=85',
          caption: 'Presiding bench during the final rounds of the All-Nigeria Law Students Moot Competition.',
        },
        {
          id: `img-${setId}-1-2`,
          url: 'https://images.unsplash.com/photo-1453733197783-64ac0d442b45?w=1200&auto=format&fit=crop&q=85',
          caption: 'Delivering closing submissions on executive overreach before visiting appellate judges.',
        },
      ],
    },
    {
      id: `mem-${setId}-2`,
      setId,
      eventTag: 'Dinner Party',
      title: 'Law Week & Cultural Gala Ball',
      dateStr: `${year}-06-22`,
      caption: 'An unforgettable night of regal glamour, live Afrobeat orchestra, and faculty awards banquet.',
      images: [
        {
          id: `img-${setId}-2-1`,
          url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&auto=format&fit=crop&q=85',
          caption: 'The Grand Ballroom glowing in royal navy and gold as classmates celebrate 5 years of sisterhood and brotherhood.',
        },
        {
          id: `img-${setId}-2-2`,
          url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=85',
          caption: 'Toast to the Bar: executives raising glasses to future Senior Advocates of Nigeria.',
        },
      ],
    },
    {
      id: `mem-${setId}-3`,
      setId,
      eventTag: 'Sign-out Day',
      title: 'Law Library Late-Night Study Sprints',
      dateStr: `${year}-04-10`,
      caption: 'Endless stacks of Nigerian Weekly Law Reports (NWLR), coffee-fueled banter, and deciphering ratio decidendi.',
      images: [
        {
          id: `img-${setId}-3-1`,
          url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&auto=format&fit=crop&q=85',
          caption: 'The Faculty Law Library at 2:00 AM: cramming Jurisprudence with loyal study partners.',
        },
      ],
    },
    {
      id: `mem-${setId}-4`,
      setId,
      eventTag: 'Induction',
      title: 'Convocation & Call to Bar Robing',
      dateStr: `${year}-10-24`,
      caption: 'The monumental moment of triumph: donning the wig and gown with tears of joy from proud parents.',
      images: [
        {
          id: `img-${setId}-4-1`,
          url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=85',
          caption: 'Caps thrown into the Lagos sky. We came, we argued, we conquered!',
        },
      ],
    },
  ];
}

function generateVoicesForSet(setId: string): VoiceItem[] {
  return [
    {
      id: `voc-${setId}-1`,
      setId,
      lecturerName: 'Prof. Adeyemi Adeleke, SAN',
      title: 'Head of Department & Professor of Constitutional Law',
      headshotUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=720&auto=format&fit=crop&q=85',
      partingQuote: 'You step out of Crownfield into a complex society hungry for moral courage. Remember: the finest lawyer is not merely the one who wins arguments, but the one whose character ennobles the rule of law.',
    },
    {
      id: `voc-${setId}-2`,
      setId,
      lecturerName: 'Dr. Folake Coker-Alatishe',
      title: 'Associate Professor of Public International Law',
      headshotUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=720&auto=format&fit=crop&q=85',
      partingQuote: 'Hold your head high in every forum. You carry the pedigree of Crownfield Public Law; let justice, compassion, and forensic rigor be your permanent trademarks.',
    },
    {
      id: `voc-${setId}-3`,
      setId,
      lecturerName: 'Justice Chikezie Nnamani (Rtd.)',
      title: 'Distinguished Jurist-in-Residence',
      headshotUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=720&auto=format&fit=crop&q=85',
      partingQuote: 'In the courtroom, your word is your bond. Never compromise your professional integrity for fleeting expedience.',
    },
    {
      id: `voc-${setId}-4`,
      setId,
      lecturerName: 'Dr. Aminu Garba',
      title: 'Senior Lecturer, Administrative & Human Rights Law',
      headshotUrl: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=720&auto=format&fit=crop&q=85',
      partingQuote: 'Defend the defenseless with the same vigor you would defend kings. Africa awaits your leadership.',
    },
  ];
}

export const CROWNFIELD_PUBLIC_LAW_SETS: ClassSet[] = [
  // 1. Trailblazers — Class of 2023
  {
    id: 'crownfield-law-2023',
    institutionId: 'crownfield',
    institutionName: 'Crownfield University',
    institutionLogoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=160&auto=format&fit=crop&q=80',
    departmentId: 'dept-crownfield-public-law',
    departmentName: 'Department of Public Law',
    faculty: 'Faculty of Law',
    graduationYear: 2023,
    academicYears: 5,
    classSetName: 'Trailblazers — Class of 2023',
    classSlogan: 'First to Dare, First to Lead',
    isFoundingClass: true,
    estimatedGraduatesCount: 120,
    paymentStatus: 'paid',
    pricePaid: 29000,
    classRepName: 'Oluwaseun Babatunde Adeleke',
    classRepEmail: 'seun.adeleke.2023@crownfield.edu.ng',
    classRepPhone: '+234 803 111 2023',
    isPublished: true,
    publishedAt: '2023-11-20',
    convocationDate: '2023-11-24',
    accentColor: '#176B6B',
    backgroundThemeId: 'dark-grey',
    activationStatus: 'active',
    activationDate: '2023-08-10',
    activationRef: 'KOHOT-CF-LAW-2023',
    bannerImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&auto=format&fit=crop&q=85',
    legacyGroupImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
    ourStory: `We arrived at Crownfield University with boundless optimism and crisp copies of Glanville Williams. As the Trailblazers, we bore the sacred responsibility of setting the standard for the Department of Public Law.

Through rigorous moot court trials, marathon drafting sessions at the Faculty Law Library, and spirited debates on constitutional jurisprudence, we transformed from anxious freshmen into an indomitable family of advocates. We are proud to have paved the path for every cohort that follows.`,
    students: generateStudentsForSet('crownfield-law-2023', 2023),
    awards: generateAwardsForSet('crownfield-law-2023'),
    memories: generateMemoriesForSet('crownfield-law-2023', 2023),
    voices: generateVoicesForSet('crownfield-law-2023'),
    videos: [
      {
        id: 'vid-crownfield-law-2023',
        title: 'Trailblazers Valedictory Documentary & Moot Championship',
        description: 'Official 5-year journey documentary of the pioneering Trailblazers at Crownfield University Faculty of Law.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ],
    socials: {
      instagram: '@crownfield_trailblazers23',
      linkedin: 'https://linkedin.com/company/crownfield-law-alumni',
      twitter: '@crownfield_law',
    },
  },

  // 2. Phoenix — Class of 2024
  {
    id: 'crownfield-law-2024',
    institutionId: 'crownfield',
    institutionName: 'Crownfield University',
    institutionLogoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=160&auto=format&fit=crop&q=80',
    departmentId: 'dept-crownfield-public-law',
    departmentName: 'Department of Public Law',
    faculty: 'Faculty of Law',
    graduationYear: 2024,
    academicYears: 5,
    classSetName: 'Phoenix — Class of 2024',
    classSlogan: 'Rising with Tenacity, Reigning in Justice',
    isFoundingClass: false,
    estimatedGraduatesCount: 135,
    paymentStatus: 'paid',
    pricePaid: 29000,
    classRepName: 'Amina Zainab Bello',
    classRepEmail: 'amina.bello.2024@crownfield.edu.ng',
    classRepPhone: '+234 803 222 2024',
    isPublished: true,
    publishedAt: '2024-11-15',
    convocationDate: '2024-11-22',
    accentColor: '#7A263A',
    backgroundThemeId: 'dark-grey',
    activationStatus: 'active',
    activationDate: '2024-07-15',
    activationRef: 'KOHOT-CF-LAW-2024',
    bannerImageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1600&auto=format&fit=crop&q=85',
    legacyGroupImageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=85',
    ourStory: `The Phoenix set rose through unprecedented challenges, navigating academic turbulence with grace, brotherhood, and intellectual dominance. We carried the torch passed by the Trailblazers and expanded its radiance into regional and global legal forums.

From founding the Legal Aid Clinic to representing Crownfield at international tribunals in The Hague, the Phoenix set proved that resilience is the true currency of champions.`,
    students: generateStudentsForSet('crownfield-law-2024', 2024),
    awards: generateAwardsForSet('crownfield-law-2024'),
    memories: generateMemoriesForSet('crownfield-law-2024', 2024),
    voices: generateVoicesForSet('crownfield-law-2024'),
    videos: [
      {
        id: 'vid-crownfield-law-2024',
        title: 'Phoenix: The Rise of Champions Documentary',
        description: 'Highlight reel and valedictory reflections of the Class of 2024.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ],
    socials: {
      instagram: '@crownfield_phoenix24',
      linkedin: 'https://linkedin.com/company/crownfield-law-alumni',
      twitter: '@crownfield_law',
    },
  },

  // 3. Frontiers — Class of 2025
  {
    id: 'crownfield-law-2025',
    institutionId: 'crownfield',
    institutionName: 'Crownfield University',
    institutionLogoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=160&auto=format&fit=crop&q=80',
    departmentId: 'dept-crownfield-public-law',
    departmentName: 'Department of Public Law',
    faculty: 'Faculty of Law',
    graduationYear: 2025,
    academicYears: 5,
    classSetName: 'Frontiers — Class of 2025',
    classSlogan: 'Breaking Boundaries, Shaping Horizons',
    isFoundingClass: false,
    estimatedGraduatesCount: 140,
    paymentStatus: 'paid',
    pricePaid: 29000,
    classRepName: 'Chisom Emmanuel Okonkwo',
    classRepEmail: 'chisom.okonkwo.2025@crownfield.edu.ng',
    classRepPhone: '+234 803 333 2025',
    isPublished: true,
    publishedAt: '2025-10-30',
    convocationDate: '2025-11-18',
    accentColor: '#3157C8',
    backgroundThemeId: 'dark-grey',
    activationStatus: 'active',
    activationDate: '2025-06-01',
    activationRef: 'KOHOT-CF-LAW-2025',
    bannerImageUrl: 'https://images.unsplash.com/photo-1453733197783-64ac0d442b45?w=1600&auto=format&fit=crop&q=85',
    legacyGroupImageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1600&auto=format&fit=crop&q=85',
    ourStory: `The Frontiers charted unexplored territory, bridging artificial intelligence, constitutional reforms, and human rights advocacy into modern legal practice. We refused to be confined by outdated dogma, pioneering legal tech initiatives that transformed departmental operations.

As we stand on the threshold of our Call to Bar, we leave behind a department richer in ambition, unity, and groundbreaking scholarship.`,
    students: generateStudentsForSet('crownfield-law-2025', 2025),
    awards: generateAwardsForSet('crownfield-law-2025'),
    memories: generateMemoriesForSet('crownfield-law-2025', 2025),
    voices: generateVoicesForSet('crownfield-law-2025'),
    videos: [
      {
        id: 'vid-crownfield-law-2025',
        title: 'Frontiers: Beyond the Horizon Documentary',
        description: 'Comprehensive retrospective of the Class of 2025 at Crownfield University Faculty of Law.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ],
    socials: {
      instagram: '@crownfield_frontiers25',
      linkedin: 'https://linkedin.com/company/crownfield-law-alumni',
      twitter: '@crownfield_law',
    },
  },

  // 4. Apex — Class of 2026
  {
    id: 'crownfield-law-2026',
    institutionId: 'crownfield',
    institutionName: 'Crownfield University',
    institutionLogoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=160&auto=format&fit=crop&q=80',
    departmentId: 'dept-crownfield-public-law',
    departmentName: 'Department of Public Law',
    faculty: 'Faculty of Law',
    graduationYear: 2026,
    academicYears: 5,
    classSetName: 'Apex — Class of 2026',
    classSlogan: 'At the Pinnacle of Honor',
    isFoundingClass: false,
    estimatedGraduatesCount: 150,
    paymentStatus: 'paid',
    pricePaid: 29000,
    classRepName: 'Chiemeka Anthony Eze',
    classRepEmail: 'chiemeka.eze.2026@crownfield.edu.ng',
    classRepPhone: '+234 803 444 2026',
    isPublished: true,
    publishedAt: '2026-10-20',
    convocationDate: '2026-11-20',
    accentColor: '#285445',
    backgroundThemeId: 'dark-grey',
    activationStatus: 'active',
    activationDate: '2026-05-15',
    activationRef: 'KOHOT-CF-LAW-2026',
    bannerImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&auto=format&fit=crop&q=85',
    legacyGroupImageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=85',
    ourStory: `Apex stands as the culmination of half a decade of uncompromised academic pursuit and camaraderie. We reached the pinnacle of student governance, courtroom debate, and scholastic excellence.

To our professors, mentors, and the three illustrious classes who paved the way before us: we carry your legacy forward into the highest echelons of the Nigerian Bar and global jurisprudence.`,
    students: generateStudentsForSet('crownfield-law-2026', 2026),
    awards: generateAwardsForSet('crownfield-law-2026'),
    memories: generateMemoriesForSet('crownfield-law-2026', 2026),
    voices: generateVoicesForSet('crownfield-law-2026'),
    videos: [
      {
        id: 'vid-crownfield-law-2026',
        title: 'Apex: The Pinnacle Valedictory & Call to Bar Tribute',
        description: 'Documentary celebrating the 5-year journey of the Apex Class of 2026.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ],
    socials: {
      instagram: '@crownfield_apex26',
      linkedin: 'https://linkedin.com/company/crownfield-law-alumni',
      twitter: '@crownfield_law',
    },
  },
];
