export type UserRole = 'visitor' | 'class_rep' | 'master_host';

export interface DepartmentItem {
  id: string; // Unique ID, e.g. "dept-unilag-cs"
  universityId: string; // Matches university ID e.g. "unilag"
  name: string; // e.g. "Computer Science"
  code?: string; // e.g. "CSC"
  faculty: string; // e.g. "Faculty of Science"
  logoUrl?: string; // Department badge / crest URL
  heroImageUrl: string; // Hero banner image for the department directory (editable strictly by owner)
  caption: string; // Department caption/narrative (editable strictly by owner)
  officialPortal?: string;
  hodName?: string;
  // Persistent Department Legacy source of truth
  legacy_status?: 'available' | 'pending_verification' | 'established';
  founding_class_id?: string;
  founding_class_year?: number;
  legacyPlaqueInstalled?: boolean;
  legacyPlaqueInstallationDate?: string;
  legacyPlaqueLocation?: string;
  legacyPlaqueQrCode?: string;
  connectedClassAlbumIds?: string[];
  pendingFoundingRequestId?: string;
}

export interface UniversityDirectoryItem {
  id: string;
  orderNumber?: number; // Numbered university (e.g. 1, 2, 3...)
  name: string;
  shortCode: string;
  location: string;
  logoUrl: string;
  officialWebsite: string;
  motto?: string;
  departments: DepartmentItem[]; // Departments organized as direct subsets of this university
  faculties?: {
    facultyName: string;
    departments: string[];
  }[];
}

export interface StudentProfile {
  id: string;
  setId: string;
  fullName: string;
  nickname?: string;
  position?: string; // e.g. "Department President", "Class Rep", "Social Secretary", "Tech Lead"
  leaderOrder?: number; // Custom admin-assigned hierarchy order (1, 2, 3...)
  photoUrl: string; // High-fidelity WebP compressed portrait
  rawPhotoUrl?: string; // Original uncropped image preserved across edits
  originalSizeKb?: number;
  compressedSizeKb?: number;
  quote?: string;
  bio?: string;
  email?: string; // Meant for annual reminder about this album to relive the experience
  instagramOrTwitter?: string;
  socials?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    tiktok?: string;
    github?: string;
    facebook?: string;
  };
  whatsappNumber?: string;
  isClassRep?: boolean;
  approved: boolean;
  approvedAt?: number | string;
  submittedAt: string;
}

export interface MemoryEventImage {
  id: string;
  url: string;
  rawUrl?: string; // Original uncropped image preserved across edits
  caption?: string;
  photographer?: string;
  dateTime?: string;
}

export interface MemoryEvent {
  id: string;
  setId: string;
  eventTag: 'Sign-out Day' | 'Dinner Party' | 'Cultural Day' | 'Final Defense' | 'Induction' | 'Bonfire Night' | string;
  title: string;
  dateStr: string;
  caption?: string; // Optional batch overview caption
  order?: number; // Custom admin-assigned hierarchical order (1, 2, 3...)
  images: MemoryEventImage[];
  eventDay?: number;
  eventMonth?: number;
  eventYear?: number;
  isDayUnknown?: boolean;
  dateExtractedAutomatically?: boolean;
  dateExtractionSource?: string;
  isConvocationBatch?: boolean;
}

export interface CohortReminderSettings {
  automaticRemindersEnabled: boolean;
  convocationDate: string; // e.g. "18 October 2024" or "October 2024"
  convocationDay?: number;
  convocationMonth?: number;
  convocationYear?: number;
  isConvocationDayUnknown?: boolean;
  lastDispatchedYear?: number;
  notificationEmails?: string[];
  extractedFromBatchId?: string;
  approvedAt?: string;
  nextReminderDate?: string;
}

export interface AwardItem {
  id: string;
  setId: string;
  category: string; // e.g. "Academic Titan", "Most Likely to Build a Unicorn", "Life of the Department", "Best Dressed"
  winnerName: string;
  winnerNickname?: string;
  winnerAvatar: string;
  rawAvatar?: string; // Original uncropped image preserved across edits
  trophyType: 'gold' | 'silver' | 'bronze' | 'crystal' | 'star' | string;
  votesCount: number;
  citation: string;
}

export interface DepartmentSocials {
  youtube?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
}

export interface DepartmentVideoItem {
  id: string;
  title: string;
  description?: string;
  youtubeUrl: string; // Compatible with YouTube, Vimeo, TikTok, Google Drive, Loom or direct MP4
  videoUrl?: string; // Any video link from any platform or direct file
  provider?: 'youtube' | 'vimeo' | 'tiktok' | 'drive' | 'loom' | 'direct' | 'other';
  thumbnailUrl?: string;
  dateStr?: string;
}

export interface AnnualReminderConfig {
  enabled: boolean;
  frequency: 'annual_anniversary' | 'fixed_calendar_date';
  fixedDateMonthDay?: string; // e.g., "10-15"
  subjectTemplate: string;
  bodyTemplate: string;
  senderName: string;
}

export interface UniversityReminderSetting {
  universityId: string;
  enabled: boolean;
  customNote?: string;
}

export interface DepartmentReminderSetting {
  departmentId: string;
  enabled: boolean;
  customNote?: string;
}

export interface VoiceItem {
  id: string;
  setId: string;
  lecturerName: string;
  title: string; // e.g. "Prof. O. Balogun - Head of Department"
  headshotUrl: string;
  rawHeadshotUrl?: string; // Original uncropped image preserved across edits
  partingQuote: string; // 2-sentence parting quote
  authorName?: string;
  authorNickname?: string;
  avatarUrl?: string;
  quote?: string;
  role?: string;
  featured?: boolean;
}

export type ClassAlbumLifecycleStatus = 
  | 'submitted' 
  | 'pending_review' 
  | 'approved' 
  | 'active_draft' 
  | 'published_live' 
  | 'transferred' 
  | 'archived' 
  | 'rejected' 
  | 'exceptional_review';

export interface BackupContact {
  fullName: string;
  phoneOrWhatsapp: string;
  email?: string;
  relationshipOrRole?: string; // e.g. "Assistant Class Rep", "General Secretary", "Course Advisor"
}

export interface AgreementAcceptanceRecord {
  agreementVersion: string; // e.g. "2026.1"
  acceptedByUserId: string;
  acceptedByEmail: string;
  acceptedAt: string; // ISO string
  confirmedAuthorized: boolean;
  confirmedAccuracy: boolean;
  ipAddressOrClientMeta?: string;
}

export interface AdminHistoryEntry {
  adminUserId: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  appointedAt: string;
  relinquishedAt?: string;
  reasonForTransition: 'initial_founder' | 'voluntary_transfer' | 'exceptional_recovery_reassignment';
  transferredToUserId?: string;
  notes?: string;
}

export interface AdminTransferRequest {
  id: string;
  setId: string;
  fromUserId: string;
  fromAdminName: string;
  fromAdminEmail: string;
  toName: string;
  toPhoneOrWhatsapp: string;
  toEmail: string;
  transferToken: string;
  status: 'pending_acceptance' | 'accepted' | 'cancelled' | 'expired';
  createdAt: string;
  acceptedAt?: string;
  acceptanceRecord?: AgreementAcceptanceRecord;
}

export interface AdminRecoveryRequest {
  id: string;
  setId: string;
  universityName: string;
  facultyName: string;
  departmentName: string;
  graduationYear: number;
  claimantUserId: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  claimantRole: string;
  reasonForRecovery: string;
  evidenceSummary?: string;
  submittedAt: string;
  status: 'submitted' | 'verifying_backup_contact' | 'reviewing_evidence' | 'resolved_approved' | 'dismissed';
  backupContactNotifiedAt?: string;
  ownerDecisionNotes?: string;
  resolvedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 
    | 'album_request_submitted' 
    | 'album_approved' 
    | 'album_rejected' 
    | 'admin_transferred' 
    | 'recovery_requested' 
    | 'recovery_resolved' 
    | 'album_published' 
    | 'profile_approved' 
    | 'settings_updated';
  actorUserId: string;
  actorRole: string;
  targetId: string;
  details: string;
}

export function getAlbumUniquenessKey(
  institutionId: string, 
  faculty: string, 
  departmentName: string, 
  graduationYear: number
): string {
  return `${(institutionId || '').trim().toLowerCase()}::${(faculty || '').trim().toLowerCase()}::${(departmentName || '').trim().toLowerCase()}::${graduationYear}`;
}

export interface ClassSet {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionLogoUrl: string;
  departmentId: string;
  departmentName: string;
  departmentLogoUrl?: string;
  faculty: string;
  graduationYear: number;
  classSetName: string; // e.g., "The Nexus Set '24"
  classSlogan?: string;
  classRepName: string;
  classRepEmail: string;
  classRepPhone: string;
  currentAdminUserId?: string;
  backupContact?: BackupContact;
  adminHistory?: AdminHistoryEntry[];
  agreementAcceptance?: AgreementAcceptanceRecord;
  lifecycleStatus?: ClassAlbumLifecycleStatus;
  activationStatus: 'active' | 'pending' | 'maintenance' | 'inactive';
  activationDate: string;
  activationRef: string;
  bannerImageUrl: string;
  legacyGroupImageUrl: string;
  ourStory: string;
  students: StudentProfile[];
  memories: MemoryEvent[];
  awards: AwardItem[];
  voices: VoiceItem[];
  socials?: DepartmentSocials;
  videos?: DepartmentVideoItem[];
  convocationDate?: string; // Formatted convocation date, e.g. "18 October 2024" or "October 2024"
  academicYears?: number; // Number of academic years together, e.g. 4, 5
  reminderSettings?: CohortReminderSettings;
  // Commercial & Founding status
  isFoundingClass?: boolean;
  estimatedGraduatesCount?: number; // Informational operational field, e.g. 120 (does NOT determine price)
  paymentStatus?: 'free_sponsored' | 'paid' | 'pending';
  pricePaid?: number; // ₦29,000 standard, or ₦0 for sponsored founding class
  isPublished?: boolean;
  publishedAt?: string;
  accentColor?: string; // Optional curated album accent color (one of 6: #7A263A, #176B6B, #3157C8, #285445, #633B63, #A6533C)
  backgroundThemeId?: string; // One of 8 dark luxury styles (burgundy, teal, forest, obsidian, amethyst, carbon, navy, espresso)
  plaquePrivacy?: PlaquePrivacySettings; // Privacy toggles for public Legacy Plaque QR code entry
  handoffInvite?: NextClassHandoffInvite;
  nextClassContact?: NextClassRepresentativeRecord;
  publishDraft?: PublishAlbumDraft;
  universityId?: string;
  universityName?: string;
  departmentCode?: string;
  legacyFooterUrl?: string;
}

export interface PlaquePrivacySettings {
  hideStudents?: boolean;
  hideMemories?: boolean;
  hideAwards?: boolean;
  hideVoices?: boolean;
  hideStory?: boolean;
  hideVideos?: boolean;
}

export interface AlbumAccentColor {
  id: string;
  name: string;
  hex: string;
  description: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
  };
}

export const ALBUM_ACCENT_COLORS: AlbumAccentColor[] = [
  {
    id: 'burgundy',
    name: 'Burgundy',
    hex: '#7A263A',
    description: 'Regal, academic, and deeply rooted in collegiate heritage.',
    badgeStyle: {
      bg: 'rgba(122, 38, 58, 0.18)',
      text: '#ECA0AE',
      border: 'rgba(122, 38, 58, 0.45)',
    },
  },
  {
    id: 'deep-teal',
    name: 'Deep Teal',
    hex: '#176B6B',
    description: 'Sophisticated marine depth with calm, modern intellect.',
    badgeStyle: {
      bg: 'rgba(23, 107, 107, 0.18)',
      text: '#72D7D7',
      border: 'rgba(23, 107, 107, 0.45)',
    },
  },
  {
    id: 'royal-blue',
    name: 'Royal Blue',
    hex: '#3157C8',
    description: 'Authoritative, vibrant, and boldly optimistic scholarly presence.',
    badgeStyle: {
      bg: 'rgba(49, 87, 200, 0.18)',
      text: '#9CB2FF',
      border: 'rgba(49, 87, 200, 0.45)',
    },
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    hex: '#285445',
    description: 'Botanical dignity, endurance, and quiet organic strength.',
    badgeStyle: {
      bg: 'rgba(40, 84, 69, 0.18)',
      text: '#8CD3B4',
      border: 'rgba(40, 84, 69, 0.45)',
    },
  },
  {
    id: 'deep-plum',
    name: 'Deep Plum',
    hex: '#633B63',
    description: 'Artistic, refined, and dignified ceremonial warmth.',
    badgeStyle: {
      bg: 'rgba(99, 59, 99, 0.18)',
      text: '#DBAFD8',
      border: 'rgba(99, 59, 99, 0.45)',
    },
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    hex: '#A6533C',
    description: 'Warm earth, clay pottery traditions, and architectural warmth.',
    badgeStyle: {
      bg: 'rgba(166, 83, 60, 0.18)',
      text: '#F5A997',
      border: 'rgba(166, 83, 60, 0.45)',
    },
  },
];

export interface NextClassRepresentativeRecord {
  name: string;
  phoneOrWhatsapp: string;
  graduatingYear: number; // e.g. 2027
  email?: string;
  addedAt?: string;
  source?: 'publish_step3' | 'invite_modal' | 'owner_manual';
}

export interface PublishAlbumDraft {
  setId: string;
  convocationDate: string;
  testimonialText: string;
  testimonialPermission: 'public' | 'private' | null;
  nextClassContact: NextClassRepresentativeRecord | null;
  savedAt: string;
}

export interface ClassAlbumRequest {
  id: string;
  userId: string; // Authenticated KoHot account ID
  applicantName: string;
  applicantEmail: string;
  universityId: string;
  universityName: string;
  facultyName: string;
  departmentId: string;
  departmentName: string;
  graduationYear: number;
  estimatedClassSize: number;
  classSetName: string;
  classSlogan?: string;
  academicYears: number; // Years Together
  applicantRole: 'Class Representative' | 'Department President' | 'Class Admin' | 'Other';
  whatsappNumber: string;
  backupContact: BackupContact;
  agreementAcceptance: AgreementAcceptanceRecord;
  lifecycleStatus?: ClassAlbumLifecycleStatus;
  status: 'Awaiting Approval' | 'Approved' | 'Rejected';
  submissionDate: string;
  reviewNotes?: string;
  generatedSetId?: string;
  claimedByNextClassInviteId?: string;
}

export interface NextClassHandoffInvite {
  id: string;
  fromSetId: string;
  fromAdminName: string;
  fromAdminEmail: string;
  fromClassYear?: number;
  targetUniversityId: string;
  targetUniversityName: string;
  targetDepartmentId: string;
  targetDepartmentName: string;
  targetClassYear: number;
  targetContactName: string;
  targetContactPhone: string;
  targetContactEmail?: string;
  inviteCode: string; // Single-use invitation token
  status: 'not_invited' | 'invited' | 'accepted' | 'requested' | 'approved' | 'inactive' | 'pending' | 'claimed' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt?: string;
  claimedByUserId?: string;
  claimedAt?: string;
  channel?: 'whatsapp' | 'sms' | 'telegram' | 'native_share';
  lastSentAt?: string;
  history?: Array<{
    action: string;
    timestamp: string;
    actor: string;
    channel?: string;
    notes?: string;
  }>;
}

export interface AlbumDisputeRecord {
  id: string;
  setId: string;
  universityName: string;
  facultyName?: string;
  departmentName: string;
  graduationYear: number;
  classSetName?: string;
  currentAdminName: string;
  claimantUserId: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  claimantRole: string;
  disputeReason: string;
  helpReason?: string;
  explanation?: string;
  backupContact?: {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
  };
  administrationHistory?: Array<{
    date: string;
    action: string;
    actor: string;
  }>;
  submittedAt: string;
  status: 'Open' | 'Under Review' | 'Resolved' | 'Dismissed';
  resolutionNotes?: string;
  decision?: 'Approved' | 'Rejected' | 'Pending';
  decisionDate?: string;
  reviewer?: string;
}

export type AlbumAdminHelpRecord = AlbumDisputeRecord;

export interface FoundingClassRequest {
  id: string;
  universityId: string;
  universityName: string;
  facultyName: string;
  departmentId: string;
  departmentName: string;
  classYear: number;
  classSetName?: string;
  classSlogan?: string;
  yearsTogether?: number;
  applicantRole?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  backupContact?: BackupContact;
  agreementAcceptance?: AgreementAcceptanceRecord;
  estimatedGraduatesCount: number; // Informational operational field
  status: 'Pending' | 'Approved' | 'Rejected';
  submissionDate: string;
  reviewNotes?: string;
}

export interface FinancialTransaction {
  id: string;
  reference: string;
  date: string;
  setId: string;
  setName: string;
  institution: string;
  amount: number;
  currency: string;
  status: 'Paid' | 'Pending' | 'Refunded';
  payerName: string;
  payerEmail: string;
  source?: 'class_album' | 'kohot_awards' | 'sashes' | 'future_products' | 'other';
  category?: string;
  notes?: string;
}

export type TestimonialPublicationPermission = 'public' | 'private';
export type TestimonialReviewStatus = 'pending' | 'approved' | 'revision_requested' | 'archived';
export type TestimonialRequestStatus = 
  | 'not_requested'
  | 'request_sent'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'private'
  | 'featured'
  | 'archived';

export interface TestimonialRecord {
  id: string;
  name?: string;
  authorName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role?: string; // 'Class Album Admin'
  authorRole?: string;
  university?: string;
  universityName?: string;
  universityId?: string;
  faculty?: string;
  department?: string;
  departmentName?: string;
  departmentId?: string;
  classYear?: number;
  graduationYear?: number;
  classSetName?: string;
  setId?: string;
  classRepId?: string;
  testimonialText?: string;
  quote?: string;
  submissionDate?: string;
  createdAt?: string;
  status?: string;
  publicationPermission?: TestimonialPublicationPermission; // 'public' | 'private'
  reviewStatus?: TestimonialReviewStatus; // 'pending' | 'approved' | 'revision_requested' | 'archived'
  isFeatured: boolean; // Only published to homepage if true AND approved AND public
  requestStatus?: TestimonialRequestStatus;
  requestSentAt?: string;
  internalNotes?: string;
  revisionNotes?: string;
}

export interface DepartmentAdditionRequest {
  id: string;
  institutionName: string;
  requestedDepartment: string;
  facultyName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

export interface WebsiteContentOverride {
  platformTitle: string;
  platformAnnouncement: string;
  announcementActive: boolean;
  activationFeeUsd: number;
  activationFeeNgn?: number; // Standard ₦29,000 Class Album price
  whatsappSupportNumber: string;
  supportEmail: string;
  termsSnippet: string;
  globalMaxImageCap: number; // 300 default
  // Technical settings managed exclusively by KoHot Owner (Master Host)
  defaultCompressionResolution: number; // e.g. 720 or 1080 (max dimension px)
  compressionQualityPercentage?: number; // e.g. 85 (%)
  maxImagesPerAlbum: number; // e.g. 400 images limit for album moments section
  // Brand Logo and Name (customizable without background or border)
  websiteLogoUrl?: string;
  brandName?: string;
  // Dark Luxury Background Styles (managed by owner, selected by albums)
  darkLuxuryBackgrounds?: Array<{
    id: string;
    name: string;
    description: string;
    accentHex: string;
    previewBg: string;
    textureUrl: string;
    cssGradient: string;
    overlayClass: string;
  }>;
  // KoHot Media Assets (stored & served through KoHot's configured storage infrastructure)
  heroVideoUrl?: string; // Owner Dashboard / Platform Hero Showcase Video
  albumBackgroundMusicUrl?: string; // Class Album ambient background music audio
  albumBackgroundMusicTitle?: string; // Optional track name
  classAlbumCardVideoUrl?: string; // Homepage Card Video for Class Album
  legacyPlaqueCardVideoUrl?: string; // Homepage Card Video for Legacy Plaque
  annualReminderCardVideoUrl?: string; // Homepage Card Video for Annual Reminder
  showWebsiteStats?: boolean; // Website Statistics module toggle (OFF by default)
  // Visual tour uploads for cards (short max 1min video or animation tour)
  classAlbumTourUrl?: string;
  legacyPlaqueTourUrl?: string;
  annualReminderTourUrl?: string;
  legacyBannerImages?: string[]; // 4 banner images of a happy graduating class for fade-in/fade-out before album footer
  executiveBlastImageUrl?: string; // Image of graduates for owner blast messages and department outreach links
  executiveBlastMessageTemplate?: string; // Customizable message clip for blasting department executives

  // Editable Website Sections
  // 1. Hero Section
  heroHeadlineLine1?: string;
  heroHeadlineLine2?: string;
  heroHeadlineLine3?: string;
  heroSubtitle?: string;
  heroCtaButtonText?: string;
  heroExploreButtonText?: string;
  heroVideoCaptionTitle?: string;
  heroVideoCaptionSubtext?: string;

  // 2. Pillars Section
  pillarsEyebrow?: string;
  pillarsHeading?: string;
  pillarsSubtitle?: string;
  pillar1Title?: string;
  pillar1Description?: string;
  pillar2Title?: string;
  pillar2Description?: string;
  pillar3Title?: string;
  pillar3Description?: string;

  // 3. How It Works & Department Legacy
  howItWorksEyebrow?: string;
  howItWorksHeading?: string;
  departmentLegacyTitle?: string;
  departmentLegacyDescription?: string;
  privacyGuaranteeTitle?: string;
  privacyGuaranteeDescription?: string;

  // 4. Testimonials Section
  showTestimonialsSection?: boolean; // Owner toggle to show/hide testimonials section on website
  testimonialsEyebrow?: string;
  testimonialsHeading?: string;
  testimonialsSubtitle?: string;

  // 5. KoHot Awards Section
  awardsEyebrow?: string;
  awardsHeading?: string;
  awardsBadge?: string;
  awardsDescription?: string;
}

// Exactly three automated email categories for normal product communications:
// 1. Class Album Approved (sent to the approved class administrator)
// 2. Class Album Is Live (sent to relevant registered/published class members when the album is published)
// 3. Annual Legacy Reminder (sent annually to relevant registered graduates/class members)
export type AutomatedProductEmailCategory =
  | 'album_registration_approved' // Class Album Approved
  | 'class_album_is_live'          // Class Album Is Live
  | 'annual_legacy_reminder';      // Annual Legacy Reminder

// Owner's Gmail routine approval/exception alert categories:
// 1. New Class Album/Admin Approval Request
// 2. Administration Takeover/Review Request
export type OwnerAlertEmailCategory =
  | 'owner_new_album_approval_alert'
  | 'owner_admin_takeover_review_alert';

export type EmailEventType =
  | AutomatedProductEmailCategory
  | OwnerAlertEmailCategory
  | 'album_registration_received'
  | 'owner_manual_whatsapp_followup'
  | 'admin_next_class_invitation'
  | 'admin_invite_other_departments';

export interface EmailLog {
  id: string;
  timestamp: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  event: EmailEventType;
  status: 'sent' | 'pending' | 'failed' | 'draft';
  category?: 'automated_product_email' | 'owner_routine_alert' | 'manual_operational';
  channel?: 'email' | 'whatsapp' | 'sms' | 'telegram' | 'native_share';
  metadata?: {
    setId?: string;
    departmentName?: string;
    graduationYear?: number;
    nextClassYear?: number;
    studentId?: string;
    albumUrl?: string;
    actionLink?: string;
    targetPhone?: string;
    initiatedBy?: string;
  };
}

export type CommunicationLog = EmailLog;

export interface EmailTemplate {
  id: EmailEventType;
  name: string;
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
  availableVariables: string[];
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  assignedSetId?: string; // For class_rep
  masterToken?: string; // For master_host
  phone?: string;
  avatarUrl?: string;
}

export interface NextClassInviteContext {
  inviteCode: string;
  departmentId: string;
  universityId: string;
  targetYear: number;
  fromYear: number;
}
