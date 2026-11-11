import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { 
  UniversityDirectoryItem, 
  DepartmentItem,
  ClassSet, 
  FinancialTransaction, 
  DepartmentAdditionRequest, 
  FoundingClassRequest,
  WebsiteContentOverride,
  UserAccount 
} from '../../types';
import { 
  INITIAL_UNIVERSITIES, 
  calculateTotalImages 
} from '../../data/initialData';
import { CROWNFIELD_PUBLIC_LAW_SETS, CROWNFIELD_UNIVERSITY } from '../../data/crownfieldLawDemos';
import { Layer1ClassRepDashboard } from './Layer1ClassRepDashboard';
import { getTheme, applyTheme, toggleTheme, ThemeMode } from '../../utils/theme';
import { isPublicAppUrlConfigured, PRODUCTION_ORIGIN } from '../../utils/urlHelper';
import { ImageDropzone } from '../common/ImageDropzone';
import { 
  ArrowLeft,
  Database, 
  Sliders, 
  BarChart3, 
  DollarSign, 
  ShieldCheck, 
  Shield,
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  ExternalLink, 
  Eye, 
  EyeOff,
  LogOut, 
  Layers,
  Inbox,
  Sparkles,
  QrCode,
  Edit3,
  Clock,
  Image as ImageIcon,
  FolderPlus,
  Award,
  BookOpen,
  GraduationCap,
  Video,
  Upload,
  Play,
  Trash2,
  Calendar,
  Music,
  Volume2,
  Mail,
  MessageCircle,
  Film,
  TrendingUp,
  ShoppingBag,
  Coins,
  Share2,
  Palette,
  Users,
  Camera,
  Sun,
  Moon,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { DepartmentLegacyPlaqueModal } from './DepartmentLegacyPlaqueModal';
import { EditDepartmentModal } from './EditDepartmentModal';
import { EditUniversityModal } from './EditUniversityModal';
import { MasterAnnualRemindersSection } from './MasterAnnualRemindersSection';
import { MasterFoundingRequestsSection } from './MasterFoundingRequestsSection';
import { MasterWebsiteStatsSection } from './MasterWebsiteStatsSection';
import { MasterTestimonialsSection } from './MasterTestimonialsSection';
import { MasterDisputesSection } from './MasterDisputesSection';
import { MasterNextClassHandoffsSection } from './MasterNextClassHandoffsSection';
import { MasterSupportInboxSection } from './MasterSupportInboxSection';
import { MasterAlbumMediaSection } from './MasterAlbumMediaSection';
import { MasterAlbumVisualsSection } from './MasterAlbumVisualsSection';
import { MasterFinancesSection } from './MasterFinancesSection';
import { 
  fetchHostSupportMessages,
  apiClientSoftDeleteAlbum,
  apiClientRestoreAlbum,
  apiClientPermanentDeleteAlbum,
  apiClientUnpublishAlbum,
  getAuthStatus,
  AuthStatusResponse,
  uploadMediaToR2,
  migrateBase64ImagesOnServer
} from '../../utils/apiClient';
import { useFeedback } from '../common/FeedbackSystem';
import { DashboardProfileMenu } from '../common/DashboardProfileMenu';

interface Layer0MasterHostDashboardProps {
  currentUser: UserAccount;
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  transactions: FinancialTransaction[];
  additionRequests: DepartmentAdditionRequest[];
  foundingRequests: FoundingClassRequest[];
  contentOverride: WebsiteContentOverride;
  onUpdateUniversities: (unis: UniversityDirectoryItem[]) => void;
  onUpdateContentOverride: (content: WebsiteContentOverride) => void;
  onUpdateAdditionRequests: (reqs: DepartmentAdditionRequest[]) => void;
  onApproveFoundingRequest: (requestId: string, reviewNotes?: string) => void;
  onRejectFoundingRequest: (requestId: string, reason?: string) => void;
  onViewDepartmentAlbum: (setId: string) => void;
  onViewDepartmentLegacyWall?: (deptId: string, uniId?: string) => void;
  onEditDemoAlbum?: (setId: string) => void;
  onUpdateSingleSet?: (updatedSet: ClassSet) => void;
  onDeleteSetPermanently?: (setId: string) => void;
  onSwitchRole: (role: 'visitor') => void;
}

export const Layer0MasterHostDashboard: React.FC<Layer0MasterHostDashboardProps> = ({
  currentUser,
  universities,
  sets,
  transactions,
  additionRequests,
  foundingRequests,
  contentOverride,
  onUpdateUniversities,
  onUpdateContentOverride,
  onUpdateAdditionRequests,
  onApproveFoundingRequest,
  onRejectFoundingRequest,
  onViewDepartmentAlbum,
  onViewDepartmentLegacyWall,
  onEditDemoAlbum,
  onUpdateSingleSet,
  onDeleteSetPermanently,
  onSwitchRole,
}) => {
  const { showSuccess, showError, showWarning, showInfo, confirmWarning } = useFeedback();
  const [albumToDelete, setAlbumToDelete] = useState<{ set: ClassSet; isPermanent: boolean } | null>(null);
  const [typedConfirmName, setTypedConfirmName] = useState('');
  const [activeTab, setActiveTab] = useState<
    'album_demos' | 'seeder' | 'finances' | 'reminders' | 'editor' | 'testimonials' | 'disputes'
  >(() => {
    try {
      const rawSpot = sessionStorage.getItem('kohot_host_return_spot') || sessionStorage.getItem('kohot_host_last_state');
      if (rawSpot) {
        const parsed = JSON.parse(rawSpot);
        if (parsed?.tab && ['album_demos', 'seeder', 'finances', 'reminders', 'editor', 'testimonials', 'disputes'].includes(parsed.tab)) {
          return parsed.tab;
        }
      }
    } catch {}
    return 'album_demos';
  });
  const [adminHelpSupportSubTab, setAdminHelpSupportSubTab] = useState<'admin_help' | 'support' | 'requests'>('admin_help');
  const [newSupportCount, setNewSupportCount] = useState<number>(0);
  const [editingDemoSetId, setEditingDemoSetId] = useState<string | null>(null);
  const [seedingSuccessMsg, setSeedingSuccessMsg] = useState('');

  // Fetch count of new support messages for badge
  useEffect(() => {
    fetchHostSupportMessages().then((res) => {
      if (res.success) {
        setNewSupportCount(res.newCount);
      }
    });
  }, [activeTab]);

  // University Directory Search, Filter & Closable Pods State
  const [directorySearchTerm, setDirectorySearchTerm] = useState('');
  const [directoryUniFilter, setDirectoryUniFilter] = useState<string>('all');
  const [expandedDirectoryUnis, setExpandedDirectoryUnis] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    universities.forEach((u, i) => {
      init[u.id] = i < 2;
    });
    try {
      const rawSpot = sessionStorage.getItem('kohot_host_return_spot') || sessionStorage.getItem('kohot_host_last_state');
      if (rawSpot) {
        const parsed = JSON.parse(rawSpot);
        if (parsed?.uniId) {
          init[parsed.uniId] = true;
        }
      }
    } catch {}
    return init;
  });

  const toggleDirectoryUniExpand = (uniId: string) => {
    setExpandedDirectoryUnis((prev) => ({ ...prev, [uniId]: !prev[uniId] }));
  };

  // System Check State (Host only • No secret values)
  const [systemCheck, setSystemCheck] = useState<AuthStatusResponse | null>(null);
  const [isSystemChecking, setIsSystemChecking] = useState<boolean>(false);

  const runSystemCheck = async () => {
    setIsSystemChecking(true);
    try {
      const res = await getAuthStatus();
      setSystemCheck(res);
    } catch {
      setSystemCheck({
        googleClientIdSet: false,
        sessionSecretSet: false,
        hostEmailSet: false,
        databaseReachable: false,
        tablesPresent: false,
      });
    } finally {
      setIsSystemChecking(false);
    }
  };

  useEffect(() => {
    runSystemCheck();
  }, []);

  // Continuously persist current Host Dashboard tab and scroll position for instant context restoration
  useEffect(() => {
    try {
      const prevRaw = sessionStorage.getItem('kohot_host_last_state');
      const prev = prevRaw ? JSON.parse(prevRaw) : {};
      sessionStorage.setItem(
        'kohot_host_last_state',
        JSON.stringify({ ...prev, tab: activeTab, scrollY: window.scrollY })
      );
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    const handleHostScroll = () => {
      try {
        const prevRaw = sessionStorage.getItem('kohot_host_last_state');
        const prev = prevRaw ? JSON.parse(prevRaw) : {};
        sessionStorage.setItem(
          'kohot_host_last_state',
          JSON.stringify({ ...prev, tab: activeTab, scrollY: window.scrollY })
        );
      } catch {}
    };
    window.addEventListener('scroll', handleHostScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleHostScroll);
  }, [activeTab]);

  // Instant context-aware return to exact spot left from (Demo Album, Demo Dashboard, Directory, etc.)
  useLayoutEffect(() => {
    try {
      const rawSpot = sessionStorage.getItem('kohot_host_return_spot') || sessionStorage.getItem('kohot_host_last_state');
      if (!rawSpot) return;
      const spot = JSON.parse(rawSpot);
      sessionStorage.removeItem('kohot_host_return_spot');

      const restorePosition = () => {
        if (typeof spot.scrollY === 'number' && spot.scrollY >= 0) {
          window.scrollTo({ top: spot.scrollY, left: 0, behavior: 'instant' });
        }
        if (spot.elementId) {
          const el = document.getElementById(spot.elementId);
          if (el) {
            if (typeof spot.scrollY !== 'number') {
              el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
            }
            if (spot.uniId) {
              const scrollContainer = document.getElementById(`dept-scroll-${spot.uniId}`);
              if (scrollContainer) {
                scrollContainer.scrollTo({
                  left: Math.max(0, el.offsetLeft - 40),
                  behavior: 'instant' as ScrollBehavior,
                });
              }
            }
            el.classList.add('ring-2', 'ring-[#d4af37]', 'ring-offset-2', 'ring-offset-black');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-[#d4af37]', 'ring-offset-2', 'ring-offset-black');
            }, 2000);
          }
        }
      };

      restorePosition();
      requestAnimationFrame(restorePosition);
    } catch {}
  }, []);

  const filteredDirectoryUniversities = useMemo(() => {
    let list = universities;

    if (directoryUniFilter !== 'all') {
      list = list.filter((u) => u.id === directoryUniFilter);
    }
    if (directorySearchTerm.trim()) {
      const q = directorySearchTerm.toLowerCase().trim();
      list = list.filter((u) => {
        const matchesUni = u.name.toLowerCase().includes(q) || u.shortCode.toLowerCase().includes(q);
        const matchesDept = (u.departments || []).some(
          (d) => d.name.toLowerCase().includes(q) || 
                 (d.code && d.code.toLowerCase().includes(q)) || 
                 (d.faculty && d.faculty.toLowerCase().includes(q))
        );
        return matchesUni || matchesDept;
      });
    }

    // Sort: Priority/tagged institutions (isPriority) at the top, then alphabetically by name
    return [...list].sort((a, b) => {
      const aPriority = a.isPriority ? 1 : 0;
      const bPriority = b.isPriority ? 1 : 0;
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      return a.name.localeCompare(b.name);
    });
  }, [universities, directoryUniFilter, directorySearchTerm]);
  
  // Modals State
  const [selectedDeptForPlaque, setSelectedDeptForPlaque] = useState<{ dept: DepartmentItem; uni: UniversityDirectoryItem } | null>(null);
  const [selectedDeptForEdit, setSelectedDeptForEdit] = useState<{ dept: DepartmentItem; uni: UniversityDirectoryItem } | null>(null);
  const [selectedUniForEdit, setSelectedUniForEdit] = useState<UniversityDirectoryItem | null>(null);
  const [isAddUniOpen, setIsAddUniOpen] = useState(false);
  const [addingDeptUniId, setAddingDeptUniId] = useState<string | null>(null);

  // New University Seeding Form State
  const [newUniName, setNewUniName] = useState('');
  const [newUniShortCode, setNewUniShortCode] = useState('');
  const [newUniLogoUrl, setNewUniLogoUrl] = useState('');
  const [newUniOrderNumber, setNewUniOrderNumber] = useState<number>(universities.length + 1);
  const [newUniMotto, setNewUniMotto] = useState('');
  const [newUniWebsite, setNewUniWebsite] = useState('');
  const [newUniFaculty, setNewUniFaculty] = useState('');
  const [newUniDepartments, setNewUniDepartments] = useState('');
  const [newUniInstitutionType, setNewUniInstitutionType] = useState<'university' | 'polytechnic' | 'college_of_education'>('university');
  const [newUniIsPriority, setNewUniIsPriority] = useState<boolean>(false);

  // New Department Modal Form State
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptFaculty, setNewDeptFaculty] = useState('');
  const [newDeptLogoUrl, setNewDeptLogoUrl] = useState('');
  const [newDeptHeroUrl, setNewDeptHeroUrl] = useState('');
  const [newDeptCaption, setNewDeptCaption] = useState('');
  const [newDeptHod, setNewDeptHod] = useState('');
  const [newDeptPortal, setNewDeptPortal] = useState('');

  // Edit Module Form State
  const [editPlatformTitle, setEditPlatformTitle] = useState(contentOverride.platformTitle);
  const [editAnnouncement, setEditAnnouncement] = useState(contentOverride.platformAnnouncement);
  const [editAnnouncementActive, setEditAnnouncementActive] = useState(contentOverride.announcementActive);
  const [editMaxCap, setEditMaxCap] = useState(contentOverride.globalMaxImageCap);
  const [editSupportEmail, setEditSupportEmail] = useState(contentOverride.supportEmail);
  const [editCompressionResolution, setEditCompressionResolution] = useState(contentOverride.defaultCompressionResolution || 720);
  const [editCompressionQuality, setEditCompressionQuality] = useState(contentOverride.compressionQualityPercentage || 85);
  const [editMaxImagesPerAlbum, setEditMaxImagesPerAlbum] = useState(contentOverride.maxImagesPerAlbum || 400);
  const [editAlbumBgMusicUrl, setEditAlbumBgMusicUrl] = useState(contentOverride.albumBackgroundMusicUrl || '');
  const [editHeroVideoUrl, setEditHeroVideoUrl] = useState(contentOverride.heroVideoUrl || '');
  const [editHeroPosterUrl, setEditHeroPosterUrl] = useState(contentOverride.heroPosterUrl || '');
  const [editHeroVideoKey, setEditHeroVideoKey] = useState(contentOverride.heroVideoKey || '');
  const [editHeroPosterKey, setEditHeroPosterKey] = useState(contentOverride.heroPosterKey || '');
  const [isUploadingHeroMedia, setIsUploadingHeroMedia] = useState(false);
  const [isMigratingImages, setIsMigratingImages] = useState(false);
  const [migrationReport, setMigrationReport] = useState<{ migratedCount: number; albumsUpdated: number; failedCount: number } | null>(null);
  const [editClassAlbumTourUrl, setEditClassAlbumTourUrl] = useState(contentOverride.classAlbumCardVideoUrl || contentOverride.classAlbumTourUrl || '');
  const [editLegacyPlaqueTourUrl, setEditLegacyPlaqueTourUrl] = useState(contentOverride.legacyPlaqueCardVideoUrl || contentOverride.legacyPlaqueTourUrl || '');
  const [editAnnualReminderTourUrl, setEditAnnualReminderTourUrl] = useState(contentOverride.annualReminderTourUrl || contentOverride.annualReminderCardVideoUrl || '');
  
  // Website Sections Editable Text States
  // 1. Hero Section
  const [editHeroHeadlineLine1, setEditHeroHeadlineLine1] = useState(contentOverride.heroHeadlineLine1 || 'Beautiful');
  const [editHeroHeadlineLine2, setEditHeroHeadlineLine2] = useState(contentOverride.heroHeadlineLine2 || 'graduate memories');
  const [editHeroHeadlineLine3, setEditHeroHeadlineLine3] = useState(contentOverride.heroHeadlineLine3 || 'live here');
  const [editHeroSubtitle, setEditHeroSubtitle] = useState(contentOverride.heroSubtitle || 'From your classmates and portraits to the moments, words and stories you shared, KoHot gives your graduating class a beautiful place to remember it all.');
  const [editHeroCtaButtonText, setEditHeroCtaButtonText] = useState(contentOverride.heroCtaButtonText || 'Create Class Album');
  const [editHeroExploreButtonText, setEditHeroExploreButtonText] = useState(contentOverride.heroExploreButtonText || 'Explore Demo Albums');
  const [editHeroVideoCaptionTitle, setEditHeroVideoCaptionTitle] = useState(contentOverride.heroVideoCaptionTitle || 'The Physical to Digital Gateway');
  const [editHeroVideoCaptionSubtext, setEditHeroVideoCaptionSubtext] = useState(contentOverride.heroVideoCaptionSubtext || 'Scan the corridor plaque • Open your preserved class album');

  // 2. Pillars Section
  const [editPillarsEyebrow, setEditPillarsEyebrow] = useState(contentOverride.pillarsEyebrow || 'THE THREE PILLARS');
  const [editPillarsHeading, setEditPillarsHeading] = useState(contentOverride.pillarsHeading || 'Everything your class needs to leave a legacy');
  const [editPillarsSubtitle, setEditPillarsSubtitle] = useState(contentOverride.pillarsSubtitle || 'Three essential elements to preserve your people, your memories, and your story.');
  const [editPillar1Title, setEditPillar1Title] = useState(contentOverride.pillar1Title || 'The Class Album');
  const [editPillar1Description, setEditPillar1Description] = useState(contentOverride.pillar1Description || 'A private, interactive digital home for your class. Full individual graduate profiles, memorable moments, candid stories, and shared photos.');
  const [editPillar2Title, setEditPillar2Title] = useState(contentOverride.pillar2Title || 'The Legacy Plaque');
  const [editPillar2Description, setEditPillar2Description] = useState(contentOverride.pillar2Description || 'A physical, beautifully cast plaque installed permanently in your department corridor. A scannable gateway connecting campus corridors to your class album.');
  const [editPillar3Title, setEditPillar3Title] = useState(contentOverride.pillar3Title || 'The Annual Reminder');
  const [editPillar3Description, setEditPillar3Description] = useState(contentOverride.pillar3Description || 'An automated anniversary tradition. Every year on convocation day, every graduate receives a nostalgic notification reconnecting them to their memories.');

  // 3. How It Works & Department Legacy
  const [editHowItWorksEyebrow, setEditHowItWorksEyebrow] = useState(contentOverride.howItWorksEyebrow || 'THE JOURNEY');
  const [editHowItWorksHeading, setEditHowItWorksHeading] = useState(contentOverride.howItWorksHeading || 'How Your Class Leaves a Lasting Legacy');
  const [editDepartmentLegacyTitle, setEditDepartmentLegacyTitle] = useState(contentOverride.departmentLegacyTitle || 'ONE DEPARTMENT. MANY GENERATIONS.');
  const [editDepartmentLegacyDescription, setEditDepartmentLegacyDescription] = useState(contentOverride.departmentLegacyDescription || 'A living archive for your department. Preceding classes hand the baton forward, creating an unbroken chain of student milestones.');
  const [editPrivacyGuaranteeTitle, setEditPrivacyGuaranteeTitle] = useState(contentOverride.privacyGuaranteeTitle || 'Reassuring, Private & Student-Controlled');
  const [editPrivacyGuaranteeDescription, setEditPrivacyGuaranteeDescription] = useState(contentOverride.privacyGuaranteeDescription || 'Only classmates with verified invite links can upload or view unlisted albums. Student data is never sold or used for advertising.');

  // 4. Testimonials Section
  const [editTestimonialsEyebrow, setEditTestimonialsEyebrow] = useState(contentOverride.testimonialsEyebrow || 'THE LEGACY, IN THEIR WORDS');
  const [editTestimonialsHeading, setEditTestimonialsHeading] = useState(contentOverride.testimonialsHeading || 'What Graduating Classes Say');
  const [editTestimonialsSubtitle, setEditTestimonialsSubtitle] = useState(contentOverride.testimonialsSubtitle || 'Real experiences from class representatives and graduates who archived their milestones on KoHot.');

  // 5. KoHot Awards Section
  const [editAwardsEyebrow, setEditAwardsEyebrow] = useState(contentOverride.awardsEyebrow || 'OFFICIAL SPONSOR OF KOHOT’S LEGACY PRESERVATION');
  const [editAwardsHeading, setEditAwardsHeading] = useState(contentOverride.awardsHeading || 'KoHot Excellence & Class Legacy Awards');
  const [editAwardsBadge, setEditAwardsBadge] = useState(contentOverride.awardsBadge || 'COMING SOON');
  const [editAwardsDescription, setEditAwardsDescription] = useState(contentOverride.awardsDescription || 'Annual recognition celebrating the most creative class albums, outstanding department preservation, and legendary cohort class albums across universities.');

  const DEFAULT_LEGACY_BANNER_IMAGES = [
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1600&auto=format&fit=crop',
  ];
  const [editLegacyBannerImages, setEditLegacyBannerImages] = useState<string[]>(
    contentOverride.legacyBannerImages && contentOverride.legacyBannerImages.length === 4
      ? contentOverride.legacyBannerImages
      : DEFAULT_LEGACY_BANNER_IMAGES
  );

  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());
  const isLightMode = currentTheme === 'light';

  useEffect(() => {
    const syncTheme = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail === 'light' || customEvent.detail === 'dark') {
        setCurrentTheme(customEvent.detail);
      } else {
        setCurrentTheme(getTheme());
      }
    };
    window.addEventListener('kohot_theme_changed', syncTheme);
    return () => window.removeEventListener('kohot_theme_changed', syncTheme);
  }, []);

  const handleToggleDashboardTheme = () => {
    const next = toggleTheme(currentTheme);
    setCurrentTheme(next);
  };

  const [displayedOwnerName, setDisplayedOwnerName] = useState(currentUser.fullName || 'Seyi Dan');

  useEffect(() => {
    if (currentUser.fullName) setDisplayedOwnerName(currentUser.fullName);
  }, [currentUser.fullName]);

  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.fullName) {
        setDisplayedOwnerName(e.detail.fullName);
      }
    };
    window.addEventListener('kohot_user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('kohot_user_profile_updated', handleProfileUpdated);
  }, []);

  const [editorSavedMsg, setEditorSavedMsg] = useState(false);
  const [mediaSubTab, setMediaSubTab] = useState<'website' | 'albums' | 'stats'>('website');
  const [editBrandName, setEditBrandName] = useState(contentOverride.brandName || 'KOHOT');
  const [editWebsiteLogoUrl, setEditWebsiteLogoUrl] = useState(contentOverride.websiteLogoUrl || '');
  const [inspectingAlbumMediaId, setInspectingAlbumMediaId] = useState<string | null>(null);
  const [albumMediaSearch, setAlbumMediaSearch] = useState('');

  // Keep state synchronized with contentOverride so changes remain permanent across views and updates
  useEffect(() => {
    if (contentOverride) {
      setEditPlatformTitle(contentOverride.platformTitle || '');
      setEditAnnouncement(contentOverride.platformAnnouncement || '');
      setEditAnnouncementActive(Boolean(contentOverride.announcementActive));
      setEditMaxCap(contentOverride.globalMaxImageCap || 300);
      setEditSupportEmail(contentOverride.supportEmail || 'support@kohot.app');
      setEditCompressionResolution(contentOverride.defaultCompressionResolution || 720);
      setEditCompressionQuality(contentOverride.compressionQualityPercentage || 85);
      setEditMaxImagesPerAlbum(contentOverride.maxImagesPerAlbum || 400);
      setEditAlbumBgMusicUrl(contentOverride.albumBackgroundMusicUrl || '');
      setEditHeroVideoUrl(contentOverride.heroVideoUrl || '');
      setEditHeroPosterUrl(contentOverride.heroPosterUrl || '');
      setEditHeroVideoKey(contentOverride.heroVideoKey || '');
      setEditHeroPosterKey(contentOverride.heroPosterKey || '');
      setEditClassAlbumTourUrl(contentOverride.classAlbumCardVideoUrl || contentOverride.classAlbumTourUrl || '');
      setEditLegacyPlaqueTourUrl(contentOverride.legacyPlaqueCardVideoUrl || contentOverride.legacyPlaqueTourUrl || '');
      setEditAnnualReminderTourUrl(contentOverride.annualReminderTourUrl || contentOverride.annualReminderCardVideoUrl || '');

      setEditHeroHeadlineLine1(contentOverride.heroHeadlineLine1 || 'Beautiful');
      setEditHeroHeadlineLine2(contentOverride.heroHeadlineLine2 || 'graduate memories');
      setEditHeroHeadlineLine3(contentOverride.heroHeadlineLine3 || 'live here');
      setEditHeroSubtitle(contentOverride.heroSubtitle || 'From your classmates and portraits to the moments, words and stories you shared, KoHot gives your graduating class a beautiful place to remember it all.');
      setEditHeroCtaButtonText(contentOverride.heroCtaButtonText || 'Create Class Album');
      setEditHeroExploreButtonText(contentOverride.heroExploreButtonText || 'Explore Demo Albums');
      setEditHeroVideoCaptionTitle(contentOverride.heroVideoCaptionTitle || 'The Physical to Digital Gateway');
      setEditHeroVideoCaptionSubtext(contentOverride.heroVideoCaptionSubtext || 'Scan the corridor plaque • Open your preserved class album');

      setEditPillarsEyebrow(contentOverride.pillarsEyebrow || 'THE THREE PILLARS');
      setEditPillarsHeading(contentOverride.pillarsHeading || 'Everything your class needs to leave a legacy');
      setEditPillarsSubtitle(contentOverride.pillarsSubtitle || 'Three essential elements to preserve your people, your memories, and your story.');
      setEditPillar1Title(contentOverride.pillar1Title || 'The Class Album');
      setEditPillar1Description(contentOverride.pillar1Description || 'A private, interactive digital home for your class. Full individual graduate profiles, memorable moments, candid stories, and shared photos.');
      setEditPillar2Title(contentOverride.pillar2Title || 'The Legacy Plaque');
      setEditPillar2Description(contentOverride.pillar2Description || 'A physical, beautifully cast plaque installed permanently in your department corridor. A scannable gateway connecting campus corridors to your class album.');
      setEditPillar3Title(contentOverride.pillar3Title || 'The Annual Reminder');
      setEditPillar3Description(contentOverride.pillar3Description || 'An automated anniversary tradition. Every year on convocation day, every graduate receives a nostalgic notification reconnecting them to their memories.');

      setEditHowItWorksEyebrow(contentOverride.howItWorksEyebrow || 'THE JOURNEY');
      setEditHowItWorksHeading(contentOverride.howItWorksHeading || 'How Your Class Leaves a Lasting Legacy');
      setEditDepartmentLegacyTitle(contentOverride.departmentLegacyTitle || 'ONE DEPARTMENT. MANY GENERATIONS.');
      setEditDepartmentLegacyDescription(contentOverride.departmentLegacyDescription || 'A living archive for your department. Preceding classes hand the baton forward, creating an unbroken chain of student milestones.');
      setEditPrivacyGuaranteeTitle(contentOverride.privacyGuaranteeTitle || 'Reassuring, Private & Student-Controlled');
      setEditPrivacyGuaranteeDescription(contentOverride.privacyGuaranteeDescription || 'Only classmates with verified invite links can upload or view unlisted albums. Student data is never sold or used for advertising.');

      setEditTestimonialsEyebrow(contentOverride.testimonialsEyebrow || 'THE LEGACY, IN THEIR WORDS');
      setEditTestimonialsHeading(contentOverride.testimonialsHeading || 'What Graduating Classes Say');
      setEditTestimonialsSubtitle(contentOverride.testimonialsSubtitle || 'Real experiences from class representatives and graduates who archived their milestones on KoHot.');

      setEditAwardsEyebrow(contentOverride.awardsEyebrow || 'OFFICIAL SPONSOR OF KOHOT’S LEGACY PRESERVATION');
      setEditAwardsHeading(contentOverride.awardsHeading || 'KoHot Excellence & Class Legacy Awards');
      setEditAwardsBadge(contentOverride.awardsBadge || 'COMING SOON');
      setEditAwardsDescription(contentOverride.awardsDescription || 'Annual recognition celebrating the most creative class albums, outstanding department preservation, and legendary cohort class albums across universities.');
      setEditBrandName(contentOverride.brandName || 'KOHOT');
      setEditWebsiteLogoUrl(contentOverride.websiteLogoUrl || '');
      setEditLegacyBannerImages(
        contentOverride.legacyBannerImages && contentOverride.legacyBannerImages.length === 4
          ? contentOverride.legacyBannerImages
          : DEFAULT_LEGACY_BANNER_IMAGES
      );
    }
  }, [contentOverride]);

  const handleAudioBgUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)) {
      console.warn('Invalid audio file format. Only mp3, wav, m4a, aac, or ogg are allowed.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setEditAlbumBgMusicUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoTourUpload = (file: File, target: 'hero' | 'album' | 'plaque' | 'reminder') => {
    if (!file) return;
    const isMp4OrWebm = /^video\/(mp4|webm)$/i.test(file.type) || /\.(mp4|webm)$/i.test(file.name);
    if (!isMp4OrWebm) {
      showError('Invalid Video Format', 'Only MP4 or WebM videos are allowed.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showError('Video Too Large', 'Hero and tour videos must be 15 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      setIsUploadingHeroMedia(true);
      try {
        const uploaded = await uploadMediaToR2(dataUrl, {
          setId: 'site-hero',
          category: target === 'hero' ? 'hero-video' : `${target}-video`,
          fileName: file.name,
        });
        if (!uploaded.success || !uploaded.url) {
          showError('Video Upload Failed', uploaded.error || 'Failed to upload video to R2 storage. Please retry.');
          return;
        }
        if (target === 'hero') {
          setEditHeroVideoUrl(uploaded.url);
          if (uploaded.key) setEditHeroVideoKey(uploaded.key);
        } else if (target === 'album') {
          setEditClassAlbumTourUrl(uploaded.url);
        } else if (target === 'plaque') {
          setEditLegacyPlaqueTourUrl(uploaded.url);
        } else {
          setEditAnnualReminderTourUrl(uploaded.url);
        }
        showSuccess('Video Uploaded to R2', `Saved at ${uploaded.url}`);
      } finally {
        setIsUploadingHeroMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleHeroPosterUpload = (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showError('Poster Image Too Large', 'Poster image must be 2 MB or smaller (JPEG, PNG, or WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      setIsUploadingHeroMedia(true);
      try {
        const uploaded = await uploadMediaToR2(dataUrl, {
          setId: 'site-hero',
          category: 'hero-poster',
          fileName: file.name,
        });
        if (!uploaded.success || !uploaded.url) {
          showError('Poster Upload Failed', uploaded.error || 'Failed to upload poster image to R2. Please retry.');
          return;
        }
        setEditHeroPosterUrl(uploaded.url);
        if (uploaded.key) setEditHeroPosterKey(uploaded.key);
        showSuccess('Hero Poster Uploaded', `Saved at ${uploaded.url}`);
      } finally {
        setIsUploadingHeroMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleHostMigrateImages = async () => {
    setIsMigratingImages(true);
    try {
      const res = await migrateBase64ImagesOnServer({ all: true });
      if (!res.success) {
        showError('Image Migration Failed', res.error || 'Could not migrate base64 images to R2.');
        return;
      }
      setMigrationReport({
        migratedCount: res.migratedCount,
        albumsUpdated: res.albumsUpdated,
        failedCount: res.failedCount,
      });
      showSuccess(
        'R2 Image Migration Complete',
        `Migrated ${res.migratedCount} base64 image(s) across ${res.albumsUpdated} album(s) (${res.failedCount} failed).`
      );
    } finally {
      setIsMigratingImages(false);
    }
  };

  // Live Department Class Albums (Demo albums are strictly isolated in Album Demos, soft-deleted albums hidden)
  const liveSets = useMemo(() => sets.filter((s) => !s.id.startsWith('crownfield-') && !s.deletedAt), [sets]);

  // Recently deleted albums (kept for 30 days)
  const recentlyDeletedSets = useMemo(() => {
    return sets.filter((s) => Boolean(s.deletedAt));
  }, [sets]);

  // Pending deletion requests from class admins
  const pendingDeletionRequests = useMemo(() => {
    return sets.filter((s) => s.deletionRequest && s.deletionRequest.status === 'pending');
  }, [sets]);

  const pendingRequestsCount = additionRequests.filter((r) => r.status === 'Pending').length;

  const handleHostToggleKeepDeletedAlbum = (setId: string) => {
    const target = sets.find((s) => s.id === setId);
    if (!target) return;
    const nextKept = !target.keptByHostOnly;
    const updated: ClassSet = {
      ...target,
      keptByHostOnly: nextKept,
      keptByHostAt: nextKept ? new Date().toISOString() : undefined,
    };
    onUpdateSingleSet?.(updated);
    if (nextKept) {
      showSuccess(
        'Album Kept (Host Only)',
        `"${target.classSetName || target.departmentName}" will be preserved exclusively for the Host even if the admin does not recover it within 30 days.`
      );
    } else {
      showInfo(
        '30-Day Purge Resumed',
        `"${target.classSetName || target.departmentName}" has been returned to the standard 30-day automatic purge schedule.`
      );
    }
  };

  const handleHostToggleUnpublish = (setId: string) => {
    const target = sets.find((s) => s.id === setId);
    if (!target) return;
    const nextUnpublished = !target.isUnpublished;
    const updated: ClassSet = {
      ...target,
      isUnpublished: nextUnpublished,
      isPublished: !nextUnpublished,
      unpublishedAt: nextUnpublished ? new Date().toISOString() : undefined,
      unpublishedBy: nextUnpublished ? currentUser.email : undefined,
    };
    onUpdateSingleSet?.(updated);
    apiClientUnpublishAlbum(target.id, nextUnpublished);
    if (nextUnpublished) {
      showWarning('Album Unpublished', `"${target.classSetName || target.departmentName}" is now hidden from public visitors.`);
    } else {
      showSuccess('Album Published', `"${target.classSetName || target.departmentName}" is published live.`);
    }
  };

  const handleStartDeleteAlbum = (targetSet: ClassSet, isPermanent: boolean = false) => {
    setAlbumToDelete({ set: targetSet, isPermanent });
    setTypedConfirmName('');
  };

  // Ensure navigating away or switching tabs never leaves a deletion confirmation modal pending
  useEffect(() => {
    setAlbumToDelete(null);
    setTypedConfirmName('');
    const handleNavReset = () => {
      setAlbumToDelete(null);
      setTypedConfirmName('');
    };
    window.addEventListener('popstate', handleNavReset);
    window.addEventListener('hashchange', handleNavReset);
    return () => {
      window.removeEventListener('popstate', handleNavReset);
      window.removeEventListener('hashchange', handleNavReset);
    };
  }, [activeTab]);

  const handleConfirmHostDelete = () => {
    if (!albumToDelete) return;

    if (albumToDelete.isPermanent) {
      apiClientPermanentDeleteAlbum(albumToDelete.set.id, albumToDelete.set.classSetName);
      onDeleteSetPermanently?.(albumToDelete.set.id);
      showSuccess('Album Permanently Deleted', `"${albumToDelete.set.classSetName || albumToDelete.set.departmentName}" and all exclusively associated data were permanently erased.`);
    } else {
      const updated: ClassSet = {
        ...albumToDelete.set,
        deletedAt: new Date().toISOString(),
        deletedBy: currentUser.email || 'host',
        isPublished: false,
        isUnpublished: true,
        deletionRequest: albumToDelete.set.deletionRequest ? {
          ...albumToDelete.set.deletionRequest,
          status: 'approved',
        } : undefined,
      };
      onUpdateSingleSet?.(updated);
      apiClientSoftDeleteAlbum(albumToDelete.set.id, albumToDelete.set.classSetName);
      showSuccess('Album Soft-Deleted', `"${albumToDelete.set.classSetName || albumToDelete.set.departmentName}" has been moved to Recently Deleted (30-day recovery window) and hidden from all public views.`);
    }

    setAlbumToDelete(null);
    setTypedConfirmName('');
  };

  const handleRestoreAlbum = (setId: string) => {
    const target = sets.find((s) => s.id === setId);
    if (!target) return;
    const updated: ClassSet = {
      ...target,
      deletedAt: undefined,
      deletedBy: undefined,
    };
    onUpdateSingleSet?.(updated);
    apiClientRestoreAlbum(setId);
    showSuccess('Album Restored', `"${target.classSetName || target.departmentName}" has been restored to active status.`);
  };

  const handleDeclineDeletionRequest = (setId: string) => {
    const target = sets.find((s) => s.id === setId);
    if (!target || !target.deletionRequest) return;
    const updated: ClassSet = {
      ...target,
      deletionRequest: {
        ...target.deletionRequest,
        status: 'rejected',
      },
    };
    onUpdateSingleSet?.(updated);
    showInfo('Request Declined', 'The album deletion request was declined.');
  };

  // Analytics Metrics
  const totalActiveImages = calculateTotalImages(liveSets);
  const globalCap = contentOverride.globalMaxImageCap || 300;
  const usagePercentage = Math.min(100, Math.round((totalActiveImages / globalCap) * 100));

  // Financial Stats
  const totalRevenue = transactions
    .filter((t) => t.status === 'Paid')
    .reduce((acc, t) => acc + t.amount, 0);

  // Execute Automated Database Seeding Tool
  const handleExecuteDefaultSeed = () => {
    onUpdateUniversities(INITIAL_UNIVERSITIES);
    setSeedingSuccessMsg('Preloaded institutional directories and official logo URLs successfully re-seeded!');
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleAddNewUniversitySeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniName || !newUniLogoUrl) return;

    const parsedDepts = newUniDepartments
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    const defaultFacName = newUniFaculty.trim() || 'Faculty of Sciences';
    const deptItems: DepartmentItem[] = parsedDepts.length > 0 
      ? parsedDepts.map((dName, idx) => ({
          id: `dept-${newUniShortCode.toLowerCase()}-${idx + 1}`,
          universityId: newUniShortCode.toLowerCase() || `uni-${Date.now()}`,
          name: dName,
          code: dName.slice(0, 3).toUpperCase(),
          faculty: defaultFacName,
          logoUrl: newUniLogoUrl.trim(),
          heroImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
          caption: `${dName} academic sanctum, research corridors, and collective student milestones.`,
          officialPortal: newUniWebsite || 'https://edu.ng',
        }))
      : [
          {
            id: `dept-${newUniShortCode.toLowerCase()}-1`,
            universityId: newUniShortCode.toLowerCase() || `uni-${Date.now()}`,
            name: 'Computer Science',
            code: 'CSC',
            faculty: defaultFacName,
            logoUrl: newUniLogoUrl.trim(),
            heroImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
            caption: 'Computer Science academic sanctum, research corridors, and collective student milestones.',
            officialPortal: newUniWebsite || 'https://edu.ng',
          }
        ];

    const newUniItem: UniversityDirectoryItem = {
      id: newUniShortCode.toLowerCase() || `uni-${Date.now()}`,
      orderNumber: newUniOrderNumber || (universities.length + 1),
      name: newUniName.trim(),
      shortCode: newUniShortCode.trim() || 'UNI',
      location: 'Accredited Campus',
      logoUrl: newUniLogoUrl.trim(),
      motto: newUniMotto.trim() || 'Excellence & Integrity',
      officialWebsite: newUniWebsite.trim() || 'https://edu.ng',
      institutionType: newUniInstitutionType,
      isPriority: newUniIsPriority,
      departments: deptItems,
      faculties: [
        {
          facultyName: defaultFacName,
          departments: deptItems.map((d) => d.name),
        },
      ],
    };

    onUpdateUniversities([newUniItem, ...universities]);
    setNewUniName('');
    setNewUniShortCode('');
    setNewUniLogoUrl('');
    setNewUniMotto('');
    setNewUniWebsite('');
    setNewUniFaculty('');
    setNewUniDepartments('');
    setNewUniInstitutionType('university');
    setNewUniIsPriority(false);
    setNewUniOrderNumber(universities.length + 2);
    setSeedingSuccessMsg(`Successfully added Institution #${newUniItem.orderNumber} ${newUniItem.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleAddNewDepartment = (uniId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;

    const targetUni = universities.find((u) => u.id === uniId);
    if (!targetUni) return;

    const newDept: DepartmentItem = {
      id: `dept-${targetUni.shortCode.toLowerCase()}-${(targetUni.departments?.length || 0) + 1}-${Date.now()}`,
      universityId: uniId,
      name: newDeptName.trim(),
      code: newDeptCode.trim().toUpperCase() || newDeptName.slice(0, 3).toUpperCase(),
      faculty: newDeptFaculty.trim() || targetUni.faculties[0]?.facultyName || 'Faculty of Sciences',
      logoUrl: newDeptLogoUrl.trim() || targetUni.logoUrl,
      heroImageUrl: newDeptHeroUrl.trim() || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
      caption: newDeptCaption.trim() || `${newDeptName} department lecture theatres, faculty laboratories, and legacy milestones.`,
      hodName: newDeptHod.trim() || undefined,
      officialPortal: newDeptPortal.trim() || targetUni.officialWebsite,
    };

    const updatedUniversities = universities.map((u) => {
      if (u.id !== uniId) return u;
      const currentDepts = u.departments || [];
      return {
        ...u,
        departments: [...currentDepts, newDept],
      };
    });

    onUpdateUniversities(updatedUniversities);
    setAddingDeptUniId(null);
    setNewDeptName('');
    setNewDeptCode('');
    setNewDeptFaculty('');
    setNewDeptLogoUrl('');
    setNewDeptHeroUrl('');
    setNewDeptCaption('');
    setNewDeptHod('');
    setNewDeptPortal('');
    setSeedingSuccessMsg(`Successfully added Department: ${newDept.name} under ${targetUni.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleSaveEditedDepartment = (updatedDept: DepartmentItem, uniId: string) => {
    const updatedUniversities = universities.map((u) => {
      if (u.id !== uniId) return u;
      const currentDepts = u.departments || [];
      const updatedDepts = currentDepts.map((d) => (d.id === updatedDept.id ? updatedDept : d));
      return {
        ...u,
        departments: updatedDepts,
      };
    });

    onUpdateUniversities(updatedUniversities);
    setSelectedDeptForEdit(null);
    setSeedingSuccessMsg(`Updated Department Hero image & metadata for ${updatedDept.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleSaveEditedUniversity = (updatedUni: UniversityDirectoryItem) => {
    const updatedUniversities = universities.map((u) => (u.id === updatedUni.id ? updatedUni : u));
    onUpdateUniversities(updatedUniversities);
    setSelectedUniForEdit(null);
    setSeedingSuccessMsg(`Successfully updated Institutional Directory for ${updatedUni.name}!`);
    setTimeout(() => setSeedingSuccessMsg(''), 4000);
  };

  const handleSaveContentOverride = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateContentOverride({
      ...contentOverride,
      platformTitle: editPlatformTitle.trim(),
      platformAnnouncement: editAnnouncement.trim(),
      announcementActive: editAnnouncementActive,
      globalMaxImageCap: Number(editMaxCap),
      supportEmail: editSupportEmail.trim(),
      defaultCompressionResolution: Number(editCompressionResolution),
      compressionQualityPercentage: Number(editCompressionQuality),
      maxImagesPerAlbum: Number(editMaxImagesPerAlbum),
      albumBackgroundMusicUrl: editAlbumBgMusicUrl.trim(),
      heroVideoUrl: editHeroVideoUrl.trim(),
      heroPosterUrl: editHeroPosterUrl.trim() || undefined,
      heroVideoKey: editHeroVideoKey.trim() || undefined,
      heroPosterKey: editHeroPosterKey.trim() || undefined,
      classAlbumCardVideoUrl: editClassAlbumTourUrl.trim(),
      classAlbumTourUrl: editClassAlbumTourUrl.trim(),
      legacyPlaqueCardVideoUrl: editLegacyPlaqueTourUrl.trim(),
      legacyPlaqueTourUrl: editLegacyPlaqueTourUrl.trim(),
      annualReminderCardVideoUrl: editAnnualReminderTourUrl.trim(),
      annualReminderTourUrl: editAnnualReminderTourUrl.trim(),
      // Website Section Texts
      heroHeadlineLine1: editHeroHeadlineLine1.trim(),
      heroHeadlineLine2: editHeroHeadlineLine2.trim(),
      heroHeadlineLine3: editHeroHeadlineLine3.trim(),
      heroSubtitle: editHeroSubtitle.trim(),
      heroCtaButtonText: editHeroCtaButtonText.trim(),
      heroExploreButtonText: editHeroExploreButtonText.trim(),
      heroVideoCaptionTitle: editHeroVideoCaptionTitle.trim(),
      heroVideoCaptionSubtext: editHeroVideoCaptionSubtext.trim(),
      pillarsEyebrow: editPillarsEyebrow.trim(),
      pillarsHeading: editPillarsHeading.trim(),
      pillarsSubtitle: editPillarsSubtitle.trim(),
      pillar1Title: editPillar1Title.trim(),
      pillar1Description: editPillar1Description.trim(),
      pillar2Title: editPillar2Title.trim(),
      pillar2Description: editPillar2Description.trim(),
      pillar3Title: editPillar3Title.trim(),
      pillar3Description: editPillar3Description.trim(),
      howItWorksEyebrow: editHowItWorksEyebrow.trim(),
      howItWorksHeading: editHowItWorksHeading.trim(),
      departmentLegacyTitle: editDepartmentLegacyTitle.trim(),
      departmentLegacyDescription: editDepartmentLegacyDescription.trim(),
      privacyGuaranteeTitle: editPrivacyGuaranteeTitle.trim(),
      privacyGuaranteeDescription: editPrivacyGuaranteeDescription.trim(),
      testimonialsEyebrow: editTestimonialsEyebrow.trim(),
      testimonialsHeading: editTestimonialsHeading.trim(),
      testimonialsSubtitle: editTestimonialsSubtitle.trim(),
      awardsEyebrow: editAwardsEyebrow.trim(),
      awardsHeading: editAwardsHeading.trim(),
      awardsBadge: editAwardsBadge.trim(),
      awardsDescription: editAwardsDescription.trim(),
      brandName: editBrandName.trim() || 'KOHOT',
      websiteLogoUrl: editWebsiteLogoUrl.trim() || undefined,
      legacyBannerImages: editLegacyBannerImages,
    });
    setEditorSavedMsg(true);
    setTimeout(() => setEditorSavedMsg(false), 3000);
  };

  const handleApproveRequest = (request: DepartmentAdditionRequest) => {
    const targetUni = universities.find(
      (u) => u.name.toLowerCase() === request.institutionName.toLowerCase()
    );

    if (targetUni) {
      const targetFaculty = targetUni.faculties.find(
        (f) => f.facultyName.toLowerCase() === request.facultyName.toLowerCase()
      );

      if (targetFaculty) {
        if (!targetFaculty.departments.includes(request.requestedDepartment)) {
          targetFaculty.departments.push(request.requestedDepartment);
        }
      } else {
        targetUni.faculties.push({
          facultyName: request.facultyName,
          departments: [request.requestedDepartment],
        });
      }
      onUpdateUniversities([...universities]);
    }

    const updated = additionRequests.map((r) =>
      r.id === request.id ? { ...r, status: 'Approved' as const } : r
    );
    onUpdateAdditionRequests(updated);
  };

  if (editingDemoSetId) {
    const targetSet = sets.find((s) => s.id === editingDemoSetId) || CROWNFIELD_PUBLIC_LAW_SETS.find((s) => s.id === editingDemoSetId);
    if (targetSet) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#121214]">
          <Layer1ClassRepDashboard
            currentUser={{
              id: currentUser?.id || 'owner-admin',
              email: currentUser.email,
              fullName: displayedOwnerName || currentUser.fullName,
              role: 'master_host',
              assignedSetId: targetSet.id,
            }}
            currentSet={targetSet}
            contentOverride={contentOverride}
            onUpdateSet={(updated) => {
              if (onUpdateSingleSet) onUpdateSingleSet(updated);
            }}
            onViewAlbum={() => {
              setEditingDemoSetId(null);
              onViewDepartmentAlbum(targetSet.id);
            }}
            onSwitchRole={() => setEditingDemoSetId(null)}
            onBackToLanding={() => setEditingDemoSetId(null)}
            onMainDashboard={() => setEditingDemoSetId(null)}
            showMainButton={true}
          />
        </div>
      );
    }
  }

  return (
    <div 
      id="master-host-dashboard" 
      data-dashboard-theme={isLightMode ? 'light' : 'dark'}
      className={`min-h-screen pb-24 font-body transition-colors selection:bg-[#d4af37]/30 ${
        isLightMode 
          ? 'bg-[#f4f3ef] text-zinc-900 dashboard-light' 
          : 'bg-[#0b0d13] text-[#e2e4e9] dashboard-dark'
      }`}
    >
      {/* Top Command Banner - Clean, Unified Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-xl border-b px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors ${
        isLightMode 
          ? 'bg-white/95 border-slate-200/90 text-black shadow-xs' 
          : 'bg-[#12151e]/95 border-white/10 text-white'
      }`}>
        {/* Left: Host Title and Name (No links back to public site) */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="min-w-0 leading-tight">
            <div className="font-mono-tech text-[10px] uppercase tracking-wider text-amber-600 dark:text-[#d4af37] font-bold">
              Host
            </div>
            <div className={`font-syne font-bold text-xs sm:text-sm truncate ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>
              {displayedOwnerName}
            </div>
          </div>
        </div>

        {/* Right: Synced Dark/Light Mode Toggle & Master Host Profile Menu (Notification icon removed) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            id="host-dashboard-theme-toggle-btn"
            type="button"
            onClick={handleToggleDashboardTheme}
            title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              isLightMode
                ? 'bg-[#f8f7f4] hover:bg-slate-200/70 border-slate-300 text-zinc-800 shadow-xs'
                : 'bg-[#161a24] hover:bg-white/10 border-white/15 text-[#d4af37]'
            }`}
          >
            {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <DashboardProfileMenu
            currentUser={currentUser}
            roleTitle="Master Host"
            onLogout={() => onSwitchRole('visitor')}
            showNotifications={false}
          />
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8 space-y-8">
        {/* Command Navigation Tabs (Sticky Segmented Pill Bar matching Communications UI) */}
        <div
          id="host-command-nav-tabs"
          className={`sticky top-[57px] sm:top-[65px] z-30 p-1.5 rounded-full backdrop-blur-xl flex items-center gap-1.5 overflow-x-auto no-scrollbar border transition-colors ${
            isLightMode
              ? 'bg-white/95 border-slate-200/90 shadow-xs'
              : 'bg-[#12151e]/95 border-white/10 shadow-md'
          }`}
        >
          <button
            id="tab-album-demos-btn"
            onClick={(e) => {
              setActiveTab('album_demos');
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-syne font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'album_demos'
                ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                : isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'album_demos' ? 'text-black' : 'text-[#d4af37]'}`} />
            <span>Album Demos</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-bold ${
              activeTab === 'album_demos' ? 'bg-black/15 text-black' : 'bg-amber-400/20 text-amber-600 dark:text-amber-400'
            }`}>
              4
            </span>
          </button>

          <button
            id="tab-seeder-btn"
            onClick={(e) => {
              setActiveTab('seeder');
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-syne font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'seeder'
                ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                : isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Institutions Directory ({universities.length})</span>
          </button>

          <button
            id="tab-finances-btn"
            onClick={(e) => {
              setActiveTab('finances');
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-syne font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'finances'
                ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                : isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Coins className={`w-3.5 h-3.5 ${activeTab === 'finances' ? 'text-black' : 'text-emerald-500'}`} />
            <span>Finances</span>
          </button>

          <button
            id="tab-reminders-btn"
            onClick={(e) => {
              setActiveTab('reminders');
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-syne font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'reminders'
                ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                : isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageCircle className={`w-3.5 h-3.5 ${activeTab === 'reminders' ? 'text-black' : 'text-[#d4af37]'}`} />
            <span>KoHot Communications</span>
          </button>

          <button
            id="tab-editor-btn"
            onClick={(e) => {
              setActiveTab('editor');
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-syne font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                : isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film className={`w-3.5 h-3.5 ${activeTab === 'editor' ? 'text-black' : 'text-blue-500'}`} />
            <span>KoHot Media</span>
          </button>

          <button
            id="tab-testimonials-btn"
            onClick={(e) => {
              setActiveTab('testimonials');
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-syne font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'testimonials'
                ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                : isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award className={`w-3.5 h-3.5 ${activeTab === 'testimonials' ? 'text-black' : 'text-[#d4af37]'}`} />
            <span>Testimonials</span>
          </button>

          <button
            id="tab-disputes-btn"
            onClick={(e) => {
              setActiveTab('disputes');
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-syne font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'disputes'
                ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                : isLightMode ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className={`w-3.5 h-3.5 ${activeTab === 'disputes' ? 'text-black' : 'text-amber-500'}`} />
            <span>Admin Help &amp; Support</span>
            {(newSupportCount + pendingRequestsCount) > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-mono-tech font-bold animate-pulse">
                {newSupportCount + pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {/* =========================================================================
            0. ALBUM DEMOS SECTION (MINIMALIST MINI CARDS: UNIVERSITY + DEPT + MANAGE)
            ========================================================================= */}
        {activeTab === 'album_demos' && (
          <div id="album-demos-module" className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                { year: 2026, defaultId: 'crownfield-law-2026', name: 'Apex — Class of 2026' },
                { year: 2025, defaultId: 'crownfield-law-2025', name: 'Frontiers — Class of 2025' },
                { year: 2024, defaultId: 'crownfield-law-2024', name: 'Phoenix — Class of 2024' },
                { year: 2023, defaultId: 'crownfield-law-2023', name: 'Trailblazers — Class of 2023' },
              ].map((meta) => {
                const liveSet = sets.find((s) => s.id === meta.defaultId) || CROWNFIELD_PUBLIC_LAW_SETS.find((s) => s.id === meta.defaultId);
                if (!liveSet) return null;

                const uniLogo = liveSet.institutionLogoUrl || CROWNFIELD_UNIVERSITY.logoUrl;
                const deptLogo = liveSet.departmentLogoUrl || CROWNFIELD_UNIVERSITY.departments[0]?.logoUrl;

                return (
                  <div
                    key={liveSet.id}
                    id={`demo-card-${liveSet.id}`}
                    className={`rounded-2xl border p-4 transition-all shadow-sm flex flex-col justify-between gap-4 ${
                      isLightMode
                        ? 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                        : 'bg-[#18181b] border-white/10 text-white hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Logos: First University Logo, then Department Logo on white background */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-10 h-10 rounded-xl bg-white p-1 border border-amber-500/40 shadow-sm flex items-center justify-center shrink-0"
                            title={liveSet.institutionName}
                          >
                            <img
                              src={uniLogo}
                              alt={liveSet.institutionName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div
                            className="w-10 h-10 rounded-xl bg-white p-1 border border-amber-500/40 shadow-sm flex items-center justify-center shrink-0"
                            title={liveSet.departmentName}
                          >
                            <img
                              src={deptLogo}
                              alt={liveSet.departmentName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 text-[10px] font-mono-tech font-bold shrink-0">
                          Class of {liveSet.graduationYear}
                        </span>
                      </div>

                      {/* University Name, Department Name, and Class Set Name */}
                      <div className="space-y-1">
                        <p className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 truncate">
                          {liveSet.institutionName}
                        </p>
                        <p className={`font-syne font-bold text-xs truncate ${isLightMode ? 'text-slate-700' : 'text-zinc-200'}`}>
                          {liveSet.departmentName.toUpperCase().startsWith('DEPARTMENT')
                            ? liveSet.departmentName
                            : `Department of ${liveSet.departmentName}`}
                        </p>
                        <h3 className="font-syne font-extrabold text-sm tracking-tight truncate pt-0.5">
                          {liveSet.classSetName}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      id={`edit-demo-${liveSet.id}-btn`}
                      onClick={() => {
                        setEditingDemoSetId(null);
                        try {
                          sessionStorage.setItem(
                            'kohot_host_return_spot',
                            JSON.stringify({
                              tab: 'album_demos',
                              elementId: `demo-card-${liveSet.id}`,
                              scrollY: window.scrollY,
                            })
                          );
                        } catch {}
                        if (onEditDemoAlbum) {
                          onEditDemoAlbum(liveSet.id);
                        } else {
                          setEditingDemoSetId(liveSet.id);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-[#d4af37] hover:bg-amber-400 text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <span>Manage</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            1. INSTITUTIONS DIRECTORY SPREADSHEET (WITH EXPANDABLE UNIVERSITY & DEPARTMENT ROWS)
            ========================================================================= */}
        {activeTab === 'seeder' && (
          <div id="seeder-module" className="space-y-5">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#18181b] border border-white/12 space-y-4">
              {/* Compact Top Header & Controls (Album Admin Dashboard Style) */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.08]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-syne font-bold text-base sm:text-lg text-white">
                        Institutions Directory ({universities.length})
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 font-mono-tech text-[10px] text-zinc-300 uppercase">
                        Spreadsheet
                      </span>
                    </div>
                    <p className="font-body text-xs text-zinc-400 truncate">
                      Click any institution row to manage departments, legacy walls, and plaques.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const allExpanded: Record<string, boolean> = {};
                      const shouldExpand = Object.values(expandedDirectoryUnis).some((v) => !v);
                      universities.forEach((u) => {
                        allExpanded[u.id] = shouldExpand;
                      });
                      setExpandedDirectoryUnis(allExpanded);
                    }}
                    className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 font-mono-tech text-[11px] uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    {Object.values(expandedDirectoryUnis).some((v) => !v) ? 'Expand All' : 'Collapse All'}
                  </button>

                  <button
                    id="open-add-uni-btn"
                    type="button"
                    onClick={() => setIsAddUniOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-mono-tech text-[11px] tracking-wider uppercase font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-black" />
                    <span>Add Institution</span>
                  </button>
                </div>
              </div>

              {seedingSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono-tech flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{seedingSuccessMsg}</span>
                </div>
              )}

              {/* Compact Search Bar & University Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={directorySearchTerm}
                    onChange={(e) => setDirectorySearchTerm(e.target.value)}
                    placeholder="Search university, short code, department, or faculty..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0e1017] border border-white/12 text-white placeholder:text-zinc-500 font-mono-tech text-xs focus:border-[#d4af37] focus:outline-none"
                  />
                  {directorySearchTerm && (
                    <button
                      type="button"
                      onClick={() => setDirectorySearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={directoryUniFilter}
                  onChange={(e) => setDirectoryUniFilter(e.target.value)}
                  aria-label="Filter by institution"
                  className="px-3 py-2 rounded-xl bg-[#0e1017] border border-white/12 text-white font-mono-tech text-xs focus:border-[#d4af37] focus:outline-none cursor-pointer shrink-0"
                >
                  <option value="all">All Institutions ({universities.length})</option>
                  {[...universities]
                    .sort((a, b) => {
                      const aPriority = a.isPriority ? 1 : 0;
                      const bPriority = b.isPriority ? 1 : 0;
                      if (aPriority !== bPriority) return bPriority - aPriority;
                      return a.name.localeCompare(b.name);
                    })
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.isPriority ? '★ ' : ''}{u.name} ({u.shortCode})
                      </option>
                    ))}
                </select>
              </div>

              {/* POPUP MODAL: ADD NEW INSTITUTION (Inspired by Album Admin & Invite UI) */}
              {isAddUniOpen && (
                <div
                  className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
                  onClick={() => setIsAddUniOpen(false)}
                >
                  <div
                    className="w-full max-w-2xl max-h-[90vh] rounded-3xl bg-[#121318] border border-white/15 shadow-2xl overflow-hidden flex flex-col text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="px-6 py-4 bg-[#18181b] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/35 flex items-center justify-center text-[#d4af37] shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono-tech text-[10px] uppercase tracking-widest text-[#d4af37] font-bold block">
                            Institution Onboarding
                          </span>
                          <h4 className="font-syne font-bold text-base sm:text-lg text-white truncate">
                            Add New Institution
                          </h4>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddUniOpen(false)}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        aria-label="Close modal"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Modal Form Body */}
                    <form
                      onSubmit={handleAddNewUniversitySeed}
                      className="flex-1 overflow-y-auto p-6 space-y-5 text-xs font-body"
                    >
                      {/* Section 1: Core Identity */}
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                        <span className="font-mono-tech text-[10px] uppercase tracking-widest text-[#d4af37] font-bold block">
                          1. Institution Identity
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div className="sm:col-span-2">
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Institution Full Name *
                            </label>
                            <input
                              required
                              type="text"
                              value={newUniName}
                              onChange={(e) => setNewUniName(e.target.value)}
                              placeholder="e.g. Obafemi Awolowo University"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Short Code *
                            </label>
                            <input
                              required
                              type="text"
                              value={newUniShortCode}
                              onChange={(e) => setNewUniShortCode(e.target.value)}
                              placeholder="e.g. OAU"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white placeholder:text-zinc-600 font-mono-tech uppercase focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Institution Type
                            </label>
                            <select
                              value={newUniInstitutionType}
                              onChange={(e) => setNewUniInstitutionType(e.target.value as any)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white font-mono-tech focus:border-[#d4af37] focus:outline-none"
                            >
                              <option value="university">University</option>
                              <option value="polytechnic">Polytechnic</option>
                              <option value="college_of_education">College of Education</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Batch Order #
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={newUniOrderNumber}
                              onChange={(e) => setNewUniOrderNumber(Number(e.target.value))}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white font-mono-tech focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 cursor-pointer hover:bg-amber-500/15 transition-colors">
                              <input
                                type="checkbox"
                                checked={newUniIsPriority}
                                onChange={(e) => setNewUniIsPriority(e.target.checked)}
                                className="rounded border-zinc-700 text-[#d4af37] focus:ring-[#d4af37] w-4 h-4 cursor-pointer"
                              />
                              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                                Priority Partner
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Crest & Portal Details */}
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                        <span className="font-mono-tech text-[10px] uppercase tracking-widest text-[#d4af37] font-bold block">
                          2. Official Crest &amp; Metadata
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="sm:col-span-2">
                            <ImageDropzone
                              value={newUniLogoUrl}
                              onChange={setNewUniLogoUrl}
                              label="Official Institutional Crest / Logo *"
                              aspectRatio="1:1"
                              maxDimension={400}
                              required
                              helperText="Drag & drop or click to upload the official institution crest"
                            />
                          </div>

                          <div>
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Institutional Motto
                            </label>
                            <input
                              type="text"
                              value={newUniMotto}
                              onChange={(e) => setNewUniMotto(e.target.value)}
                              placeholder="e.g. For Learning and Culture"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Official Website Portal
                            </label>
                            <input
                              type="url"
                              value={newUniWebsite}
                              onChange={(e) => setNewUniWebsite(e.target.value)}
                              placeholder="https://oauife.edu.ng"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white placeholder:text-zinc-600 font-mono-tech focus:border-[#d4af37] focus:outline-none text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Initial Faculty & Departments */}
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3.5">
                        <span className="font-mono-tech text-[10px] uppercase tracking-widest text-[#d4af37] font-bold block">
                          3. Initial Faculty &amp; Departments (Optional)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div>
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Primary Faculty
                            </label>
                            <input
                              type="text"
                              value={newUniFaculty}
                              onChange={(e) => setNewUniFaculty(e.target.value)}
                              placeholder="e.g. Faculty of Law"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                              Initial Departments (Comma separated)
                            </label>
                            <input
                              type="text"
                              value={newUniDepartments}
                              onChange={(e) => setNewUniDepartments(e.target.value)}
                              placeholder="e.g. Public Law, Commercial Law, International Law"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090a0f] border border-white/12 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsAddUniOpen(false)}
                          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs uppercase tracking-wider cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-bold font-mono-tech text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                        >
                          Save Institution
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* SPREADSHEET TABLE VIEW */}
              {filteredDirectoryUniversities.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <Building2 className="w-8 h-8 text-zinc-500 mx-auto" />
                  <p className="font-syne font-bold text-sm text-white">No Universities or Departments Found</p>
                  <p className="font-mono-tech text-xs text-zinc-400">
                    No directory matches for "{directorySearchTerm}". Try clearing your search query or selecting another university.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectorySearchTerm('');
                      setDirectoryUniFilter('all');
                    }}
                    className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer"
                  >
                    Clear Search &amp; Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/15 bg-[#08090e] shadow-xl">
                  <table className="w-full text-left border-collapse min-w-[920px]">
                    <thead>
                      <tr className="bg-white/[0.05] border-b border-white/15 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                        <th className="py-3 px-3 border-r border-white/10 w-16 text-center">#</th>
                        <th className="py-3 px-3.5 border-r border-white/10">Institution</th>
                        <th className="py-3 px-3 border-r border-white/10 w-24">Code</th>
                        <th className="py-3 px-3 border-r border-white/10 w-44">Location &amp; Portal</th>
                        <th className="py-3 px-3 border-r border-white/10 w-28 text-center">Depts</th>
                        <th className="py-3 px-3 border-r border-white/10 w-28 text-center">Status</th>
                        <th className="py-3 px-3.5 text-right w-72">University Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-xs">
                      {filteredDirectoryUniversities.map((uni, uniIdx) => {
                        const cardNumber = uniIdx + 1;
                        const formattedOrder = String(cardNumber).padStart(2, '0');
                        const isExpanded = expandedDirectoryUnis[uni.id] !== false;
                        const q = directorySearchTerm.toLowerCase().trim();
                        const departmentsList = [...(uni.departments || [])]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .filter((d) => {
                            if (!q) return true;
                            return (
                              d.name.toLowerCase().includes(q) ||
                              (d.code && d.code.toLowerCase().includes(q)) ||
                              (d.faculty && d.faculty.toLowerCase().includes(q)) ||
                              uni.name.toLowerCase().includes(q) ||
                              uni.shortCode.toLowerCase().includes(q)
                            );
                          });

                        return (
                          <React.Fragment key={uni.id}>
                            {/* SPREADSHEET ROW: UNIVERSITY (LAYER 1) */}
                            <tr
                              id={`uni-compartment-${uni.id}`}
                              onClick={() => toggleDirectoryUniExpand(uni.id)}
                              className="bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer"
                            >
                              {/* # & Expand Toggle */}
                              <td className="py-3 px-3 border-r border-white/10 font-mono-tech font-bold text-center text-[#d4af37]">
                                <div className="flex items-center justify-center gap-1">
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                  )}
                                  <span>{formattedOrder}</span>
                                </div>
                              </td>

                              {/* Crest + Name + Motto */}
                              <td className="py-3 px-3.5 border-r border-white/10">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-black border border-white/15 shrink-0 flex items-center justify-center p-1">
                                    <img
                                      src={uni.logoUrl}
                                      alt={uni.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-syne font-bold text-sm text-white truncate">
                                      {uni.name}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 italic truncate">
                                      “{uni.motto || 'In Deed and in Truth'}”
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Short Code */}
                              <td className="py-3 px-3 border-r border-white/10 font-mono-tech">
                                <span className="px-2 py-0.5 rounded bg-white text-black font-bold text-[10px] uppercase">
                                  {uni.shortCode}
                                </span>
                              </td>

                              {/* Location & Portal */}
                              <td
                                className="py-3 px-3 border-r border-white/10 font-mono-tech text-[11px] text-zinc-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="truncate">{uni.location || 'Accredited Campus'}</div>
                                {uni.officialWebsite && (
                                  <a
                                    href={uni.officialWebsite}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#d4af37] hover:underline inline-flex items-center gap-1 text-[10px] mt-0.5"
                                  >
                                    <span>Official Portal</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </td>

                              {/* Department Count */}
                              <td className="py-3 px-3 border-r border-white/10 text-center font-mono-tech">
                                <span className="px-2.5 py-1 rounded-full bg-white/10 text-white font-bold text-[11px]">
                                  {departmentsList.length}
                                </span>
                              </td>

                              {/* Priority / Status */}
                              <td className="py-3 px-3 border-r border-white/10 text-center font-mono-tech">
                                {uni.isPriority ? (
                                  <span className="px-2 py-0.5 rounded-full bg-[#d4af37] text-black font-bold text-[10px] uppercase">
                                    Priority
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase">
                                    Active
                                  </span>
                                )}
                              </td>

                              {/* University Actions */}
                              <td
                                className="py-3 px-3.5 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    id={`edit-uni-btn-${uni.id}`}
                                    type="button"
                                    onClick={() => setSelectedUniForEdit(uni)}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-[11px] font-semibold border border-white/15 inline-flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3 text-zinc-300" />
                                    <span>Edit Institution</span>
                                  </button>

                                  <button
                                    id={`add-dept-btn-${uni.id}`}
                                    type="button"
                                    onClick={() => {
                                      if (addingDeptUniId === uni.id) {
                                        setAddingDeptUniId(null);
                                      } else {
                                        setAddingDeptUniId(uni.id);
                                        setNewDeptFaculty(uni.faculties?.[0]?.facultyName || 'Faculty of Sciences');
                                        setNewDeptLogoUrl(uni.logoUrl);
                                        if (!isExpanded) toggleDirectoryUniExpand(uni.id);
                                      }
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e6c158] text-black font-mono-tech text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    <FolderPlus className="w-3 h-3 text-black" />
                                    <span>{addingDeptUniId === uni.id ? 'Cancel' : '+ Add Department'}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* INLINE ADD DEPARTMENT FORM ROW */}
                            {isExpanded && addingDeptUniId === uni.id && (
                              <tr className="bg-[#0c0e16]">
                                <td colSpan={7} className="p-5 border-b border-white/10">
                                  <div className="max-w-3xl space-y-4">
                                    <div className="flex items-center gap-2">
                                      <Plus className="w-4 h-4 text-[#d4af37]" />
                                      <h5 className="font-syne font-bold text-sm text-white">
                                        Add Department to #{formattedOrder} {uni.name}
                                      </h5>
                                    </div>
                                    <form onSubmit={(e) => handleAddNewDepartment(uni.id, e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                      <div>
                                        <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                          Department Name *
                                        </label>
                                        <input
                                          required
                                          type="text"
                                          value={newDeptName}
                                          onChange={(e) => setNewDeptName(e.target.value)}
                                          placeholder="e.g. Electrical &amp; Electronics Engineering"
                                          className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                        />
                                      </div>

                                      <div>
                                        <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                          Department Code
                                        </label>
                                        <input
                                          type="text"
                                          value={newDeptCode}
                                          onChange={(e) => setNewDeptCode(e.target.value)}
                                          placeholder="e.g. EEE"
                                          className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                        />
                                      </div>

                                      <div>
                                        <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                          Faculty / College
                                        </label>
                                        <input
                                          type="text"
                                          value={newDeptFaculty}
                                          onChange={(e) => setNewDeptFaculty(e.target.value)}
                                          placeholder="e.g. Faculty of Engineering"
                                          className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                        />
                                      </div>

                                      <div>
                                        <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                          Head of Department (HOD)
                                        </label>
                                        <input
                                          type="text"
                                          value={newDeptHod}
                                          onChange={(e) => setNewDeptHod(e.target.value)}
                                          placeholder="e.g. Prof. S. A. Adeleke"
                                          className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                                        />
                                      </div>

                                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ImageDropzone
                                          value={newDeptHeroUrl}
                                          onChange={setNewDeptHeroUrl}
                                          label="Department Directory Hero Banner Image"
                                          aspectRatio="banner"
                                          maxDimension={1600}
                                          helperText="Hero cover banner displayed on the department's legacy wall"
                                        />

                                        <ImageDropzone
                                          value={newDeptLogoUrl}
                                          onChange={setNewDeptLogoUrl}
                                          label="Department Crest / Badge Logo"
                                          aspectRatio="1:1"
                                          maxDimension={400}
                                          helperText="Defaults to university crest if omitted"
                                        />
                                      </div>

                                      <div className="sm:col-span-2">
                                        <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                          Department Hero Caption (Host Curated)
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={newDeptCaption}
                                          onChange={(e) => setNewDeptCaption(e.target.value)}
                                          placeholder="A timeless celebration of academic distinction..."
                                          className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none font-sans"
                                        />
                                      </div>

                                      <div className="sm:col-span-2">
                                        <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                                          Department Portal Link
                                        </label>
                                        <input
                                          type="url"
                                          value={newDeptPortal}
                                          onChange={(e) => setNewDeptPortal(e.target.value)}
                                          placeholder="https://..."
                                          className="w-full px-3.5 py-2 rounded-lg bg-[#060709] border border-white/15 text-white placeholder:text-zinc-600 font-mono-tech focus:border-white/40 focus:outline-none"
                                        />
                                      </div>

                                      <div className="sm:col-span-2 pt-2 flex items-center justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setAddingDeptUniId(null)}
                                          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="submit"
                                          className="px-5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e6c158] text-black font-semibold font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                        >
                                          Save Department
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* EXPANDED SUB-SPREADSHEET FOR DEPARTMENTS UNDER THIS UNIVERSITY */}
                            {isExpanded && (
                              <tr className="bg-[#05060a]">
                                <td colSpan={7} className="p-0">
                                  {departmentsList.length === 0 ? (
                                    <div className="py-5 px-6 text-zinc-500 font-mono-tech text-xs border-l-4 border-[#d4af37]/40">
                                      No departments registered under {uni.shortCode} yet. Click "+ Add Department" on the row above.
                                    </div>
                                  ) : (
                                    <div className="border-l-4 border-[#d4af37]/60 pl-4 pr-3 py-3 space-y-2">
                                      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0b0d14]">
                                        <table className="w-full text-left border-collapse">
                                          <thead>
                                            <tr className="bg-white/[0.03] border-b border-white/10 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                                              <th className="py-2 px-3 border-r border-white/10 w-12 text-center">Dept</th>
                                              <th className="py-2 px-3 border-r border-white/10">Department &amp; Code</th>
                                              <th className="py-2 px-3 border-r border-white/10">Faculty &amp; HOD</th>
                                              <th className="py-2 px-3 border-r border-white/10 w-44">Legacy Status</th>
                                              <th className="py-2 px-3 border-r border-white/10">Class Albums</th>
                                              <th className="py-2 px-3 text-right w-80">Department Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-white/[0.06] text-xs">
                                            {departmentsList.map((dept, deptIdx) => {
                                              const deptAlbums = sets
                                                .filter((s) => {
                                                  if (s.id.startsWith('crownfield-')) return false;
                                                  const matchesDept =
                                                    s.departmentId === dept.id ||
                                                    (s.departmentName?.toLowerCase().trim() === dept.name.toLowerCase().trim() &&
                                                      (!s.institutionId || s.institutionId === uni.id));
                                                  if (!matchesDept) return false;
                                                  if (s.deletedAt) {
                                                    const daysPassed = Math.floor(
                                                      (Date.now() - new Date(s.deletedAt).getTime()) / (1000 * 60 * 60 * 24)
                                                    );
                                                    const daysRemaining = Math.max(0, 30 - daysPassed);
                                                    if (daysRemaining <= 0 && !s.keptByHostOnly) return false;
                                                  }
                                                  return true;
                                                })
                                                .sort((a, b) => b.graduationYear - a.graduationYear);

                                              return (
                                                <tr
                                                  key={dept.id}
                                                  id={`department-compartment-${dept.id}`}
                                                  className="hover:bg-white/[0.03] transition-colors"
                                                >
                                                  {/* Dept # */}
                                                  <td className="py-2.5 px-3 border-r border-white/10 text-center font-mono-tech text-[11px] text-zinc-500">
                                                    {formattedOrder}.{deptIdx + 1}
                                                  </td>

                                                  {/* Department Name, Code & Hero Thumbnail */}
                                                  <td className="py-2.5 px-3 border-r border-white/10">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                      <img
                                                        src={dept.heroImageUrl || dept.logoUrl || uni.logoUrl}
                                                        alt={dept.name}
                                                        referrerPolicy="no-referrer"
                                                        className="w-10 h-7 rounded object-cover bg-black border border-white/15 shrink-0"
                                                      />
                                                      <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                          <span className="font-syne font-bold text-xs text-white">
                                                            {dept.name}
                                                          </span>
                                                          {dept.code && (
                                                            <span className="text-[9px] font-mono-tech uppercase bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded">
                                                              {dept.code}
                                                            </span>
                                                          )}
                                                        </div>
                                                        {dept.caption && (
                                                          <p className="text-[10px] text-zinc-400 italic truncate max-w-xs">
                                                            “{dept.caption}”
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </td>

                                                  {/* Faculty & HOD */}
                                                  <td className="py-2.5 px-3 border-r border-white/10 font-mono-tech text-[11px] text-zinc-300">
                                                    <div>{dept.faculty || '—'}</div>
                                                    {dept.hodName && (
                                                      <div className="text-[10px] text-zinc-400">HOD: {dept.hodName}</div>
                                                    )}
                                                  </td>

                                                  {/* Legacy Status */}
                                                  <td className="py-2.5 px-3 border-r border-white/10">
                                                    {dept.legacy_status === 'established' ? (
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-semibold">
                                                        <Award className="w-2.5 h-2.5" />
                                                        <span>
                                                          Established {dept.founding_class_year ? `('${dept.founding_class_year})` : ''}
                                                        </span>
                                                      </span>
                                                    ) : dept.legacy_status === 'pending_verification' ? (
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-mono-tech font-semibold">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        <span>Under Review</span>
                                                      </span>
                                                    ) : (
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 text-[9px] font-mono-tech">
                                                        <Sparkles className="w-2.5 h-2.5" />
                                                        <span>Founding Available</span>
                                                      </span>
                                                    )}
                                                  </td>

                                                  {/* Class Albums */}
                                                  <td className="py-2.5 px-3 border-r border-white/10">
                                                    {deptAlbums.length === 0 ? (
                                                      <span className="text-[10px] font-mono-tech text-zinc-500">None yet</span>
                                                    ) : (
                                                      <div className="flex flex-wrap items-center gap-1.5">
                                                        {deptAlbums.map((album) => {
                                                          const isDeleted = Boolean(album.deletedAt);
                                                          return (
                                                            <div
                                                              key={album.id}
                                                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono-tech ${
                                                                isDeleted
                                                                  ? 'bg-red-950/20 border-red-500/30 text-red-300'
                                                                  : 'bg-black/50 border-white/10 text-zinc-200'
                                                              }`}
                                                            >
                                                              <span>'{String(album.graduationYear).slice(-2)}</span>
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  try {
                                                                    sessionStorage.setItem(
                                                                      'kohot_host_return_spot',
                                                                      JSON.stringify({
                                                                        tab: activeTab,
                                                                        uniId: uni.id,
                                                                        elementId: `department-compartment-${dept.id}`,
                                                                        scrollY: window.scrollY,
                                                                      })
                                                                    );
                                                                  } catch {}
                                                                  onViewDepartmentAlbum(album.id);
                                                                }}
                                                                className="text-[#d4af37] hover:underline font-bold cursor-pointer"
                                                              >
                                                                View
                                                              </button>
                                                              {isDeleted && (
                                                                <button
                                                                  type="button"
                                                                  onClick={() => handleHostToggleKeepDeletedAlbum(album.id)}
                                                                  className="text-amber-300 hover:underline cursor-pointer"
                                                                >
                                                                  {album.keptByHostOnly ? 'Kept' : 'Keep'}
                                                                </button>
                                                              )}
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                  </td>

                                                  {/* Department Actions: Edit Details, Legacy Plaque, View Legacy Wall */}
                                                  <td className="py-2.5 px-3 text-right">
                                                    <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                                                      <button
                                                        id={`edit-dept-btn-${dept.id}`}
                                                        type="button"
                                                        onClick={() => setSelectedDeptForEdit({ dept, uni })}
                                                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer border border-white/10"
                                                      >
                                                        <Edit3 className="w-3 h-3 text-zinc-300" />
                                                        <span>Edit Details</span>
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={() => setSelectedDeptForPlaque({ dept, uni })}
                                                        className="px-2.5 py-1 rounded-lg bg-[#d4af37]/15 hover:bg-[#d4af37]/25 text-[#d4af37] font-mono-tech text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer border border-[#d4af37]/30"
                                                        title="View Department Architectural Legacy Plaque"
                                                      >
                                                        <Award className="w-3 h-3 text-[#d4af37]" />
                                                        <span>Legacy Plaque</span>
                                                      </button>

                                                      {onViewDepartmentLegacyWall && (
                                                        <button
                                                          id={`view-legacy-wall-${dept.id}-btn`}
                                                          type="button"
                                                          onClick={() => {
                                                            try {
                                                              sessionStorage.setItem(
                                                                'kohot_host_return_spot',
                                                                JSON.stringify({
                                                                  tab: 'seeder',
                                                                  elementId: `department-compartment-${dept.id}`,
                                                                  uniId: uni.id,
                                                                  deptId: dept.id,
                                                                  scrollY: window.scrollY,
                                                                })
                                                              );
                                                            } catch {}
                                                            onViewDepartmentLegacyWall(dept.id, uni.id);
                                                          }}
                                                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer border border-white/10"
                                                          title="View Public Department Legacy Wall"
                                                        >
                                                          <BookOpen className="w-3 h-3 text-[#d4af37]" />
                                                          <span>View Legacy Wall</span>
                                                        </button>
                                                      )}
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            1B. FINANCES MODULE (DEDICATED TOP-LEVEL HOST FINANCES TAB)
            ========================================================================= */}
        {activeTab === 'finances' && (
          <MasterFinancesSection
            sets={liveSets}
            universities={universities}
            transactions={transactions}
            onUpdateSet={(updatedSet) => onUpdateSingleSet?.(updatedSet)}
            currentUserEmail={currentUser.email}
          />
        )}

        {/* =========================================================================
            2. EDIT MODULE: KOHOT MEDIA & ASSET CONTROL STUDIO
            ========================================================================= */}
        {activeTab === 'editor' && (
          <div id="editor-module" className="p-5 sm:p-6 rounded-2xl bg-[#18181b] border border-white/12 shadow-xl space-y-6">
            {/* Compact Header + Sub-tab Switcher Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Film className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-syne font-bold text-base sm:text-lg text-white">
                      KoHot Media &amp; Visuals
                    </h2>
                    {editorSavedMsg && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono-tech flex items-center gap-1 animate-fadeIn">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Published</span>
                      </span>
                    )}
                  </div>
                  <p className="font-body text-xs text-zinc-400 truncate">
                    Manage homepage tour reels, brand logo, album media, and platform statistics.
                  </p>
                </div>
              </div>

              {/* Sub-tab Switch: Website Media vs Album Media vs Website Statistics & Growth */}
              <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10 max-w-full overflow-x-auto no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    setMediaSubTab('website');
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    mediaSubTab === 'website'
                      ? 'bg-white text-black font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5 text-blue-400" />
                  <span>Website Media</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    setMediaSubTab('albums');
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    mediaSubTab === 'albums'
                      ? 'bg-white text-black font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Album Media ({liveSets.length})</span>
                </button>
                <button
                  id="subclip-website-stats-btn"
                  type="button"
                  onClick={(e) => {
                    setMediaSubTab('stats');
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    mediaSubTab === 'stats'
                      ? 'bg-white text-black font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Website Stats</span>
                </button>
              </div>
            </div>

            {mediaSubTab === 'stats' ? (
              <MasterWebsiteStatsSection
                sets={liveSets}
                universities={universities}
                contentOverride={contentOverride}
                onUpdateContentOverride={onUpdateContentOverride}
              />
            ) : mediaSubTab === 'albums' ? (
              <MasterAlbumMediaSection
                sets={sets}
                universities={universities}
                contentOverride={contentOverride}
                onUpdateContentOverride={onUpdateContentOverride}
                onViewDepartmentAlbum={onViewDepartmentAlbum}
                onUpdateSingleSet={onUpdateSingleSet}
                onDeleteSetPermanently={onDeleteSetPermanently}
                compressionResolution={editCompressionResolution}
                onUpdateCompressionResolution={setEditCompressionResolution}
                compressionQuality={editCompressionQuality}
                onUpdateCompressionQuality={setEditCompressionQuality}
                onSavePipeline={() => {
                  onUpdateContentOverride({
                    ...contentOverride,
                    defaultCompressionResolution: Number(editCompressionResolution),
                    compressionQualityPercentage: Number(editCompressionQuality),
                  });
                  setEditorSavedMsg(true);
                  setTimeout(() => setEditorSavedMsg(false), 3000);
                }}
              />
            ) : (
              <div className="space-y-8">
                <form onSubmit={handleSaveContentOverride} className="space-y-8 text-xs font-body">
                {/* 00. BRAND IDENTITY & LOGO (NO BACKGROUND, NO BORDER, ONLY THE LOGO) */}
                <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        00. Platform Brand Identity &amp; Header Logo
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Customize platform name and logo. The logo renders with no background or border at all — only the clean icon/graphic.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                        Brand Name
                      </label>
                      <input
                        type="text"
                        value={editBrandName}
                        onChange={(e) => setEditBrandName(e.target.value)}
                        placeholder="KOHOT"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-sm focus:outline-none focus:border-amber-400/50"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                        Logo Image URL (Transparent PNG / SVG)
                      </label>
                      <input
                        type="url"
                        value={editWebsiteLogoUrl}
                        onChange={(e) => setEditWebsiteLogoUrl(e.target.value)}
                        placeholder="https://... or upload below"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                  </div>

                  {/* Logo Live Preview: Absolutely NO background, NO border */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tech text-[10px] text-zinc-400 uppercase">
                        Current Header Logo (Pure Graphic - No Border / No Background):
                      </span>
                      <div className="p-1 flex items-center">
                        <BrandLogo
                          logoUrl={editWebsiteLogoUrl}
                          brandName={editBrandName}
                          textSize="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Upload Logo File</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = async (ev) => {
                                const dataUrl = ev.target?.result as string;
                                if (!dataUrl) return;
                                const uploaded = await uploadMediaToR2(dataUrl, {
                                  setId: 'site-hero',
                                  category: 'brand-logo',
                                  fileName: file.name,
                                });
                                if (!uploaded.success || !uploaded.url) {
                                  showError('Logo Upload Failed', uploaded.error || 'Could not upload logo to R2.');
                                  return;
                                }
                                setEditWebsiteLogoUrl(uploaded.url);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {editWebsiteLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditWebsiteLogoUrl('')}
                          className="text-rose-400 hover:text-rose-300 text-xs font-mono-tech"
                        >
                          Reset to Diamond Icon
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              
              {/* =========================================================================
                  AREA 1: HERO SECTION
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-amber-400/25 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        01. Website Hero Section
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Customize the main headline, narrative subtext, call-to-actions, and cinematic video.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                    Homepage Fold #1
                  </span>
                </div>

                {/* 3-line Headline Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Headline Line 1
                    </label>
                    <input
                      type="text"
                      value={editHeroHeadlineLine1}
                      onChange={(e) => setEditHeroHeadlineLine1(e.target.value)}
                      placeholder="Beautiful"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Headline Line 2 (Italicized)
                    </label>
                    <input
                      type="text"
                      value={editHeroHeadlineLine2}
                      onChange={(e) => setEditHeroHeadlineLine2(e.target.value)}
                      placeholder="graduate memories"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50 italic"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Headline Line 3
                    </label>
                    <input
                      type="text"
                      value={editHeroHeadlineLine3}
                      onChange={(e) => setEditHeroHeadlineLine3(e.target.value)}
                      placeholder="live here"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>

                {/* Supporting Statement / Subtitle */}
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Supporting Narrative Statement / Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={editHeroSubtitle}
                    onChange={(e) => setEditHeroSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-body text-xs focus:outline-none focus:border-amber-400/50 resize-y"
                  />
                </div>

                {/* Button CTAs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Primary CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={editHeroCtaButtonText}
                      onChange={(e) => setEditHeroCtaButtonText(e.target.value)}
                      placeholder="Create Class Album"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Secondary CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={editHeroExploreButtonText}
                      onChange={(e) => setEditHeroExploreButtonText(e.target.value)}
                      placeholder="Explore Demo Albums"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>

                {/* Hero Cinematic Video & Caption */}
                <div className="pt-3 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                      Hero Cinematic Video Asset &amp; Lower Caption
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-1 w-full aspect-video rounded-xl bg-black/80 border border-white/10 overflow-hidden relative flex items-center justify-center">
                      {editHeroVideoUrl ? (
                        <video
                          src={editHeroVideoUrl}
                          poster={editHeroPosterUrl || undefined}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-3 text-zinc-500">
                          <Film className="w-6 h-6 mx-auto mb-1 text-zinc-600" />
                          <span className="text-[10px] font-mono-tech">Crossfade Photos Active</span>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Video URL (MP4 / WebM max 15 MB)
                          </label>
                          <input
                            type="text"
                            placeholder="/media/albums/site-hero/..."
                            value={editHeroVideoUrl}
                            onChange={(e) => setEditHeroVideoUrl(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                          />
                        </div>
                        <div>
                          <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Hero Poster Image URL (JPEG/PNG/WebP max 2 MB)
                          </label>
                          <input
                            type="text"
                            placeholder="/media/albums/site-hero/..."
                            value={editHeroPosterUrl}
                            onChange={(e) => setEditHeroPosterUrl(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400/50"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingHeroMedia ? 'Uploading to R2...' : 'Upload Hero Video (MP4/WebM ≤15MB)'}</span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm"
                            disabled={isUploadingHeroMedia}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoTourUpload(file, 'hero');
                            }}
                          />
                        </label>

                        <label className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/15 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                          <span>Upload Poster</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={isUploadingHeroMedia}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleHeroPosterUpload(file);
                            }}
                          />
                        </label>

                        {editHeroVideoUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditHeroVideoUrl('');
                              setEditHeroVideoKey('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-mono-tech cursor-pointer ml-auto transition-colors"
                          >
                            Set to Default (Transition Images)
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono-tech text-zinc-400 ml-auto flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Default Active: Crossfade Transition Images</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Video Overlay Caption Title
                          </label>
                          <input
                            type="text"
                            value={editHeroVideoCaptionTitle}
                            onChange={(e) => setEditHeroVideoCaptionTitle(e.target.value)}
                            placeholder="The Physical to Digital Gateway"
                            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Video Overlay Caption Subtext
                          </label>
                          <input
                            type="text"
                            value={editHeroVideoCaptionSubtext}
                            onChange={(e) => setEditHeroVideoCaptionSubtext(e.target.value)}
                            placeholder="Scan the corridor plaque • Open your preserved class album"
                            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 2: CORE PILLARS SECTION (THE THREE PILLARS)
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-sky-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        02. Core Pillars Section
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Edit copy and tour video URLs for the 3 cornerstone features of the KoHot platform.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                    Homepage Fold #2
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Section Eyebrow
                    </label>
                    <input
                      type="text"
                      value={editPillarsEyebrow}
                      onChange={(e) => setEditPillarsEyebrow(e.target.value)}
                      placeholder="THE THREE PILLARS"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      value={editPillarsHeading}
                      onChange={(e) => setEditPillarsHeading(e.target.value)}
                      placeholder="Everything your class needs to leave a legacy"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3 Pillar Cards Content with Video Upload, Preview, and Default State */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Pillar 1 */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] text-amber-300 uppercase font-semibold">Pillar 1: Class Album</span>
                        {editClassAlbumTourUrl ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-bold">
                            Video Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 text-[9px] font-mono-tech">
                            Default Transition
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Title</label>
                        <input
                          type="text"
                          value={editPillar1Title}
                          onChange={(e) => setEditPillar1Title(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={editPillar1Description}
                          onChange={(e) => setEditPillar1Description(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Tour Video URL or Upload</label>
                        <input
                          type="url"
                          placeholder="https://... or upload video below"
                          value={editClassAlbumTourUrl}
                          onChange={(e) => setEditClassAlbumTourUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono-tech"
                        />
                      </div>
                      {editClassAlbumTourUrl && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black/80 border border-white/10">
                          <video src={editClassAlbumTourUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      <label className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video File</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoTourUpload(file, 'album');
                          }}
                        />
                      </label>
                      {editClassAlbumTourUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditClassAlbumTourUrl('')}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-mono-tech cursor-pointer ml-auto"
                        >
                          Set to Default
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono-tech text-zinc-500 ml-auto">
                          Default Transition
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pillar 2 */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] text-amber-300 uppercase font-semibold">Pillar 2: Legacy Plaque</span>
                        {editLegacyPlaqueTourUrl ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-bold">
                            Video Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 text-[9px] font-mono-tech">
                            Default Transition
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Title</label>
                        <input
                          type="text"
                          value={editPillar2Title}
                          onChange={(e) => setEditPillar2Title(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={editPillar2Description}
                          onChange={(e) => setEditPillar2Description(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Tour Video URL or Upload</label>
                        <input
                          type="url"
                          placeholder="https://... or upload video below"
                          value={editLegacyPlaqueTourUrl}
                          onChange={(e) => setEditLegacyPlaqueTourUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono-tech"
                        />
                      </div>
                      {editLegacyPlaqueTourUrl && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black/80 border border-white/10">
                          <video src={editLegacyPlaqueTourUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      <label className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video File</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoTourUpload(file, 'plaque');
                          }}
                        />
                      </label>
                      {editLegacyPlaqueTourUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditLegacyPlaqueTourUrl('')}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-mono-tech cursor-pointer ml-auto"
                        >
                          Set to Default
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono-tech text-zinc-500 ml-auto">
                          Default Transition
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pillar 3 */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] text-amber-300 uppercase font-semibold">Pillar 3: Annual Reminder</span>
                        {editAnnualReminderTourUrl ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono-tech font-bold">
                            Video Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 text-[9px] font-mono-tech">
                            Default Transition
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Title</label>
                        <input
                          type="text"
                          value={editPillar3Title}
                          onChange={(e) => setEditPillar3Title(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={editPillar3Description}
                          onChange={(e) => setEditPillar3Description(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-mono-tech mb-1">Tour Video URL or Upload</label>
                        <input
                          type="url"
                          placeholder="https://... or upload video below"
                          value={editAnnualReminderTourUrl}
                          onChange={(e) => setEditAnnualReminderTourUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono-tech"
                        />
                      </div>
                      {editAnnualReminderTourUrl && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black/80 border border-white/10">
                          <video src={editAnnualReminderTourUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      <label className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>Upload Video File</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoTourUpload(file, 'reminder');
                          }}
                        />
                      </label>
                      {editAnnualReminderTourUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditAnnualReminderTourUrl('')}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-mono-tech cursor-pointer ml-auto"
                        >
                          Set to Default
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono-tech text-zinc-500 ml-auto">
                          Default Transition
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 3: HOW IT WORKS & DEPARTMENT LEGACY SECTION
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        03. How It Works &amp; Department Legacy Section
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Manage section headers, department continuum messaging, and the privacy guarantee statement.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                    Homepage Fold #3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Journey Section Eyebrow
                    </label>
                    <input
                      type="text"
                      value={editHowItWorksEyebrow}
                      onChange={(e) => setEditHowItWorksEyebrow(e.target.value)}
                      placeholder="THE JOURNEY"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Journey Section Heading
                    </label>
                    <input
                      type="text"
                      value={editHowItWorksHeading}
                      onChange={(e) => setEditHowItWorksHeading(e.target.value)}
                      placeholder="How Your Class Leaves a Lasting Legacy"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Department Legacy Showcase */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2.5">
                    <span className="font-mono-tech text-[10px] text-zinc-300 uppercase font-semibold">
                      Department Continuum &amp; Corridor Plaque
                    </span>
                    <input
                      type="text"
                      value={editDepartmentLegacyTitle}
                      onChange={(e) => setEditDepartmentLegacyTitle(e.target.value)}
                      placeholder="ONE DEPARTMENT. MANY GENERATIONS."
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-bold"
                    />
                    <textarea
                      rows={2}
                      value={editDepartmentLegacyDescription}
                      onChange={(e) => setEditDepartmentLegacyDescription(e.target.value)}
                      placeholder="Department continuum narrative..."
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                    />
                  </div>

                  {/* Privacy Guarantee */}
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2.5">
                    <span className="font-mono-tech text-[10px] text-zinc-300 uppercase font-semibold">
                      Reassuring Privacy Guarantee
                    </span>
                    <input
                      type="text"
                      value={editPrivacyGuaranteeTitle}
                      onChange={(e) => setEditPrivacyGuaranteeTitle(e.target.value)}
                      placeholder="Reassuring, Private & Student-Controlled"
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-syne font-bold"
                    />
                    <textarea
                      rows={2}
                      value={editPrivacyGuaranteeDescription}
                      onChange={(e) => setEditPrivacyGuaranteeDescription(e.target.value)}
                      placeholder="Privacy statement..."
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-body resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 4: TESTIMONIALS SECTION ("IN THEIR WORDS")
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        04. Testimonials Section ("In Their Words")
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Headline and intro text for the alumni and class representative testimonials reel.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      id="editor-toggle-testimonials-btn"
                      onClick={() => {
                        const currentVal = contentOverride.showTestimonialsSection !== false;
                        onUpdateContentOverride({
                          ...contentOverride,
                          showTestimonialsSection: !currentVal,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 ${
                        contentOverride.showTestimonialsSection !== false
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {contentOverride.showTestimonialsSection !== false ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Turn OFF on Website</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Turn ON on Website</span>
                        </>
                      )}
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono-tech uppercase self-start sm:self-auto">
                      Homepage Fold #4
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Eyebrow
                    </label>
                    <input
                      type="text"
                      value={editTestimonialsEyebrow}
                      onChange={(e) => setEditTestimonialsEyebrow(e.target.value)}
                      placeholder="THE LEGACY, IN THEIR WORDS"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Heading
                    </label>
                    <input
                      type="text"
                      value={editTestimonialsHeading}
                      onChange={(e) => setEditTestimonialsHeading(e.target.value)}
                      placeholder="What Graduating Classes Say"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-syne font-bold text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Subtitle Statement
                    </label>
                    <input
                      type="text"
                      value={editTestimonialsSubtitle}
                      onChange={(e) => setEditTestimonialsSubtitle(e.target.value)}
                      placeholder="Real experiences from class representatives..."
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-body text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  AREA 5: CLASS ALBUM LEGACY PRESERVATION BANNER (4 CROSSFADING PHOTOS)
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <ImageIcon className="w-5 h-5 text-[#d4af37]" />
                    <div>
                      <h3 className="font-syne font-bold text-sm text-white">
                        05. Class Album Legacy Banner Images (Fade In / Fade Out)
                      </h3>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        These 4 rotating crossfading images appear before the website footer area with the text: <em>"Preserve your Legacy"</em> and the <em>"Create Class Album"</em> CTA.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditLegacyBannerImages(DEFAULT_LEGACY_BANNER_IMAGES)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-xs self-start sm:self-auto cursor-pointer transition-colors"
                  >
                    Reset 4 Photos
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const currentImgUrl = editLegacyBannerImages[slotIdx] || DEFAULT_LEGACY_BANNER_IMAGES[slotIdx];
                    return (
                      <div 
                        key={slotIdx}
                        className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono-tech text-[10px] uppercase font-bold text-[#d4af37]">
                              Banner Photo #{slotIdx + 1}
                            </span>
                            <span className="text-[10px] font-mono-tech text-zinc-500">
                              Frame {slotIdx + 1}/4
                            </span>
                          </div>

                          <div className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-black/80 border border-white/10 relative">
                            {currentImgUrl ? (
                              <img
                                src={currentImgUrl}
                                alt={`Banner ${slotIdx + 1}`}
                                className="w-full h-full object-cover filter contrast-[1.05]"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <ImageIcon className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono-tech uppercase text-zinc-400 mb-1">
                              Image URL
                            </label>
                            <input
                              type="url"
                              value={editLegacyBannerImages[slotIdx] || ''}
                              onChange={(e) => {
                                const nextImgs = [...editLegacyBannerImages];
                                nextImgs[slotIdx] = e.target.value;
                                setEditLegacyBannerImages(nextImgs);
                              }}
                              placeholder="https://images.unsplash.com/..."
                              className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-[11px] focus:outline-none focus:border-[#d4af37]"
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <label className="px-2.5 py-1 rounded-lg bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] border border-[#d4af37]/30 font-mono-tech text-[10px] flex items-center gap-1.5 cursor-pointer transition-colors">
                            <Upload className="w-3 h-3" />
                            <span>Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                                onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = async (ev) => {
                                    const dataUrl = ev.target?.result as string;
                                    if (!dataUrl) return;
                                    const uploaded = await uploadMediaToR2(dataUrl, {
                                      setId: 'site-hero',
                                      category: `legacy-banner-${slotIdx + 1}`,
                                      fileName: file.name,
                                    });
                                    if (!uploaded.success || !uploaded.url) {
                                      showError('Banner Upload Failed', uploaded.error || 'Could not upload banner image to R2.');
                                      return;
                                    }
                                    const nextImgs = [...editLegacyBannerImages];
                                    nextImgs[slotIdx] = uploaded.url;
                                    setEditLegacyBannerImages(nextImgs);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* =========================================================================
                  AREA 6: AMBIENT AUDIO & PLATFORM GLOBAL SETTINGS
                  ========================================================================= */}
              <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <Music className="w-5 h-5 text-[#d4af37]" />
                  <h3 className="font-syne font-bold text-sm text-white">
                    06. Ambient Soundtrack &amp; Platform Defaults
                  </h3>
                </div>

                {/* Audio Track */}
                <div className="p-4 rounded-xl bg-black/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {editAlbumBgMusicUrl ? (
                    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center shrink-0">
                          <Volume2 className="w-5 h-5 text-[#d4af37]" />
                        </div>
                        <div>
                          <p className="font-syne font-semibold text-white text-xs truncate">
                            Active Background Track
                          </p>
                          <p className="text-[10px] font-mono-tech text-emerald-400">
                            Loaded &amp; Ready for Playback
                          </p>
                        </div>
                      </div>

                      <audio
                        src={editAlbumBgMusicUrl}
                        controls
                        className="h-9 w-full sm:w-72 accent-[#d4af37]"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-zinc-500 font-mono-tech text-xs">
                      <Music className="w-5 h-5" />
                      <span>No background music active. Class Albums will play silently.</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-tech text-xs uppercase font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Track</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAudioBgUpload(file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditAlbumBgMusicUrl('https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs"
                  >
                    Load Sample Serene Piano
                  </button>
                  {editAlbumBgMusicUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAlbumBgMusicUrl('')}
                      className="text-rose-400 hover:text-rose-300 text-xs font-mono-tech ml-auto"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Platform Support & Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/5">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Brand Title
                    </label>
                    <input
                      type="text"
                      value={editPlatformTitle}
                      onChange={(e) => setEditPlatformTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={editSupportEmail}
                      onChange={(e) => setEditSupportEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                      Archival Cloud Guarantee
                    </label>
                    <div className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs flex items-center justify-between">
                      <span>Perpetual Storage</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SAVE ALL BUTTON */}
              <div className="flex items-center justify-between pt-2">
                <button
                  id="save-overrides-btn"
                  type="submit"
                  className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-9 rounded-full transition-all cursor-pointer shadow-xl hover:scale-105 active:scale-95"
                >
                  Publish Website Media &amp; Content Sections
                </button>

                  {editorSavedMsg && (
                    <span className="font-mono-tech text-xs text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Published to live website successfully!</span>
                    </span>
                  )}
                </div>
              </form>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            KOHOT COMMUNICATIONS (Department Executives Blast, Registered Album Admins, Next-Class Handoffs)
            ========================================================================= */}
        {activeTab === 'reminders' && (
          <MasterAnnualRemindersSection
            universities={universities}
            sets={liveSets}
            contentOverride={contentOverride}
            onUpdateContentOverride={onUpdateContentOverride}
            onViewDepartmentLegacyWall={(deptId, uniId) => onViewDepartmentLegacyWall?.(deptId, uniId)}
          />
        )}

        {/* =========================================================================
            8. TESTIMONIALS MODULE
            ========================================================================= */}
        {activeTab === 'testimonials' && (
          <MasterTestimonialsSection
            sets={liveSets}
            universities={universities}
            contentOverride={contentOverride}
            onUpdateContentOverride={(partial) => onUpdateContentOverride({ ...contentOverride, ...partial })}
          />
        )}

        {/* =========================================================================
            9. ADMIN HELP & SUPPORT MODULE (Unified with Sub-Clips: Admin Help, Support, Requests)
            ========================================================================= */}
        {activeTab === 'disputes' && (
          <div id="admin-help-and-support-module" className="max-w-3xl mx-auto space-y-5 animate-fadeIn">
            {/* Top Segmented Pill Switcher matching Screenshots 1 & 3 */}
            <div className="p-1.5 rounded-full bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 flex items-center justify-between gap-1 shadow-xs">
              <button
                id="subclip-admin-help-btn"
                type="button"
                onClick={() => setAdminHelpSupportSubTab('admin_help')}
                className={`flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-syne font-semibold transition-all cursor-pointer text-center ${
                  adminHelpSupportSubTab === 'admin_help'
                    ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Admin Help
              </button>
              <button
                id="subclip-support-btn"
                type="button"
                onClick={() => setAdminHelpSupportSubTab('support')}
                className={`flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-syne font-semibold transition-all cursor-pointer text-center ${
                  adminHelpSupportSubTab === 'support'
                    ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Support {newSupportCount}
              </button>
              <button
                id="subclip-requests-btn"
                type="button"
                onClick={() => setAdminHelpSupportSubTab('requests')}
                className={`flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-syne font-semibold transition-all cursor-pointer text-center ${
                  adminHelpSupportSubTab === 'requests'
                    ? 'bg-[#d4af37] text-black font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Requests {pendingRequestsCount}
              </button>
            </div>

            {adminHelpSupportSubTab === 'admin_help' ? (
              <MasterDisputesSection />
            ) : adminHelpSupportSubTab === 'support' ? (
              <MasterSupportInboxSection isLightMode={isLightMode} />
            ) : (
              <div id="requests-module" className="space-y-6 animate-fadeIn">
                {/* Unlisted Department Addition Inquiries */}
                <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 space-y-5 shadow-xs">
                  <div>
                    <h2 className="font-syne font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
                      Department addition requests
                    </h2>
                    <p className="font-body text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Incoming Class Rep inquiries requesting new universities or unlisted departments to be added to the directory.
                    </p>
                  </div>

                  <div className="space-y-3 font-body">
                    {additionRequests.length === 0 ? (
                      <div className="py-10 px-4 text-center rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/60 border border-slate-200/80 dark:border-white/10">
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-body">
                          No pending department requests in queue.
                        </p>
                      </div>
                    ) : (
                      additionRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-4 sm:p-5 rounded-2xl bg-[#f8f7f4] dark:bg-[#161a24]/80 border border-slate-200/90 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-syne font-bold text-slate-900 dark:text-white text-sm">
                                {req.requestedDepartment}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600 dark:text-slate-300 text-xs">{req.institutionName}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tech mt-1">
                              Faculty: {req.facultyName} • Rep: {req.requesterName} ({req.requesterEmail}, {req.requesterPhone})
                            </p>
                            {req.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 italic">"{req.notes}"</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {req.status === 'Pending' ? (
                              <button
                                onClick={() => handleApproveRequest(req)}
                                className="bg-[#d4af37] hover:bg-[#c5a028] text-black font-syne text-xs font-bold py-2.5 px-4 rounded-full transition-colors cursor-pointer"
                              >
                                Approve &amp; Seed
                              </button>
                            ) : (
                              <span className="text-xs font-mono-tech text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                Approved
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Owner-Only Institutional & Department Admin Modals */}
      {selectedUniForEdit && (
        <EditUniversityModal
          isOpen={true}
          onClose={() => setSelectedUniForEdit(null)}
          university={selectedUniForEdit}
          onSaveUniversity={handleSaveEditedUniversity}
        />
      )}

      {selectedDeptForEdit && (
        <EditDepartmentModal
          isOpen={true}
          onClose={() => setSelectedDeptForEdit(null)}
          department={selectedDeptForEdit.dept}
          university={selectedDeptForEdit.uni}
          onSaveDepartment={(updated) => handleSaveEditedDepartment(updated, selectedDeptForEdit.uni.id)}
        />
      )}

      {selectedDeptForPlaque && (
        <DepartmentLegacyPlaqueModal
          isOpen={true}
          onClose={() => setSelectedDeptForPlaque(null)}
          department={selectedDeptForPlaque.dept}
          university={selectedDeptForPlaque.uni}
          sets={sets}
        />
      )}

      {/* Host Album Deletion Confirmation Modal */}
      {albumToDelete && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-[#18181b] border-2 border-red-500/50 p-6 sm:p-8 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-red-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-lg text-white">
                    {albumToDelete.isPermanent ? 'Delete Album Permanently' : 'Delete Album (30-Day Recovery)'}
                  </h3>
                  <p className="font-mono-tech text-xs text-red-400">
                    {albumToDelete.isPermanent ? 'Irreversible Action • Exclusive Data & R2 Media Erased' : 'Retained in Recently Deleted for 30 Days'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAlbumToDelete(null);
                  setTypedConfirmName('');
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-body text-xs text-zinc-300 leading-relaxed">
              <p>
                {albumToDelete.isPermanent
                  ? `Are you sure you want to permanently delete "${albumToDelete.set.classSetName || albumToDelete.set.departmentName}" (${albumToDelete.set.institutionName} • Class of ${albumToDelete.set.graduationYear})?`
                  : `Are you sure you want to delete "${albumToDelete.set.classSetName || albumToDelete.set.departmentName}" (${albumToDelete.set.institutionName} • Class of ${albumToDelete.set.graduationYear})? It will be hidden from public views and retained in Recently Deleted for 30 days.`}
              </p>

              <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1.5 text-[11px] font-mono-tech text-zinc-300">
                <p className="text-amber-300 font-bold uppercase">
                  Album Impact Summary (ID: {albumToDelete.set.id}):
                </p>
                <p>• Admin Owner: <span className="text-white">{albumToDelete.set.classRepName || 'Unassigned'} ({albumToDelete.set.classRepEmail || 'No email'})</span></p>
                <p>• Graduate Profiles: <span className="text-white">{albumToDelete.set.students?.length || 0}</span></p>
                <p>• Memory Photos: <span className="text-white">{albumToDelete.set.memories?.reduce((acc, m) => acc + (m.images?.length || 0), 0) || 0}</span> across <span className="text-white">{albumToDelete.set.memories?.length || 0}</span> categories</p>
                <p>• Highlight Videos: <span className="text-white">{albumToDelete.set.videos?.length || 0}</span></p>
                {albumToDelete.isPermanent && (
                  <p className="text-red-300 pt-1">
                    Note: Only database rows and R2 media files exclusively belonging to this album will be permanently deleted. Shared institutional assets are preserved.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAlbumToDelete(null);
                  setTypedConfirmName('');
                }}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white font-mono-tech text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="host-confirm-delete-album-btn"
                type="button"
                onClick={handleConfirmHostDelete}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-red-600/30"
              >
                Delete Album
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
