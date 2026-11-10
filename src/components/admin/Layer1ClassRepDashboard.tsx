import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { 
  ClassSet, 
  StudentProfile, 
  MemoryEvent, 
  AwardItem, 
  VoiceItem, 
  UserAccount,
  WebsiteContentOverride,
  DepartmentSocials,
  DepartmentVideoItem,
  CohortReminderSettings,
  PlaquePrivacySettings
} from '../../types';
import { compressImageToWebP, CompressionResult, fileToUniversalDataUrl } from '../../utils/imageCompressor';
import { getSubmitUrl, getAlbumUrl, copyUrlToClipboard } from '../../utils/urlHelper';
import { EditStudentModal } from './EditStudentModal';
import { DepartmentVideoModal } from '../public/DepartmentVideoModal';
import { AlbumAdminSwitcher } from '../common/AlbumAdminSwitcher';
import { ImageCropModal, CropAspectRatio } from '../common/ImageCropModal';
import { ProfilePocketPickerModal } from '../common/ProfilePocketPickerModal';
import { UniversalModal } from '../common/UniversalModal';
import { SocialUrlInputField } from '../common/SocialUrlInputField';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { StoryReadingModal } from '../common/StoryReadingModal';
import {
  getFeaturedLeaderProfile,
  getExecutiveFeaturedProfiles,
  getAutomaticLeaderStories,
  getCleanClassSummary,
  getFromRoleHeading,
  getProfileStoryText,
  getStoryCardPreview,
  getDisplayRoleLabel,
  countStoryWords
} from '../../utils/storyFormatting';
import {
  extractYouTubeId,
  getUniversalVideoEmbedUrl,
  isSupportedVideoHighlightUrl,
  getVideoPlatformLabel,
  normalizeStreamingVideoUrl,
} from '../../utils/youtube';
import { getAwardVisualConfig } from '../../utils/awardVisuals';
import { getTheme, applyTheme, toggleTheme, ThemeMode } from '../../utils/theme';
import {
  apiClientUnpublishAlbum,
  apiClientSoftDeleteAlbum,
  apiClientRestoreAlbum,
  apiClientDeleteProfile,
  apiClientDeleteMemory,
  apiClientDeleteAward,
  fetchAlbumSlotBalanceOnServer,
  purchaseAlbumSlotsOnServer,
  updateAlbumSponsorOnServer,
  approveAlbumSubmissionsOnServer,
  declineAlbumSubmissionOnServer,
  requestChangesAlbumSubmissionOnServer,
  reinstateAlbumSubmissionOnServer,
  removeAlbumSubmissionOnServer,
  uploadMediaToR2,
  migrateBase64ImagesOnServer,
  ResolvedCohortPricing,
} from '../../utils/apiClient';
import { PaystackModal } from '../common/PaystackModal';
import { 
  User,
  AlertTriangle,
  Users, 
  UserCheck,
  UserPlus,
  HardDrive,
  Camera, 
  Trophy, 
  Quote, 
  BookOpen, 
  GraduationCap,
  Share2, 
  Check, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Sparkles, 
  MessageCircle, 
  CheckCircle2, 
  Upload, 
  LogOut,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Crown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  SlidersHorizontal,
  Search,
  Send,
  Globe,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  Clock,
  Image as ImageIcon,
  Crop,
  Youtube,
  Instagram,
  Linkedin,
  Play,
  Sliders,
  Eye,
  Film,
  QrCode,
  Calendar,
  CalendarClock,
  FileSpreadsheet,
  Mail,
  Download,
  Printer,
  Bell,
  CheckCircle,
  Palette,
  Shield,
  EyeOff,
  Lock,
  Unlock,
  Sun,
  Moon,
  Pin,
  PinOff,
  GripVertical
} from 'lucide-react';
import { ConvocationReminderModal } from './ConvocationReminderModal';
import { InviteNextClassModal } from './InviteNextClassModal';
import { PublishAlbumModal } from './PublishAlbumModal';
import { InviteClassmatesModal } from './InviteClassmatesModal';
import { DashboardProfileMenu } from '../common/DashboardProfileMenu';
import { BrandLogo } from '../common/BrandLogo';
import { AwardTypeSelector } from '../common/AwardTypeSelector';
import { useFeedback } from '../common/FeedbackSystem';
import {
  extractDateFromBatchFiles,
  ExtractedDateResult,
  formatDateComponents,
  MONTH_NAMES,
  calculateNextAnniversaryDate
} from '../../utils/imageDateExtractor';
import { 
  isLeaderProfile, 
  sortLeadersByHierarchy, 
  calculateIntuitiveHierarchyRank, 
  reorderLeadersHierarchy, 
  autoApplyIntuitiveOrder,
  sortProfilesAlphabetically
} from '../../utils/leadershipHierarchy';

interface Layer1ClassRepDashboardProps {
  currentUser: UserAccount;
  currentSet: ClassSet;
  contentOverride?: WebsiteContentOverride;
  onUpdateSet: (updatedSet: ClassSet) => void;
  onViewAlbum: () => void;
  onSwitchRole: (role: 'visitor') => void;
  onBackToLanding?: () => void;
  onMainDashboard?: () => void;
  showMainButton?: boolean;
}

export const Layer1ClassRepDashboard: React.FC<Layer1ClassRepDashboardProps> = ({
  currentUser,
  currentSet,
  contentOverride,
  onUpdateSet,
  onViewAlbum,
  onSwitchRole,
  onBackToLanding,
  onMainDashboard,
  showMainButton,
}) => {
  const { showSuccess, showError, showWarning, confirmWarning } = useFeedback();
  const [isRequestDeletionModalOpen, setIsRequestDeletionModalOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [activeTab, setActiveTab] = useState<
    'students' | 'memories' | 'awards'
  >(() => {
    try {
      const saved = sessionStorage.getItem('kohot_admin_dashboard_tab');
      if (saved && ['students', 'memories'].includes(saved)) {
        return saved as 'students' | 'memories';
      }
    } catch (e) {}
    return 'students';
  });

  // Sub-tab for Moments & Highlights (Upload Moments vs Video Highlights)
  const [memoriesAdminSubTab, setMemoriesAdminSubTab] = useState<'moments' | 'highlights'>(() => {
    try {
      const saved = sessionStorage.getItem('kohot_admin_dashboard_subtab');
      if (saved === 'moments' || saved === 'highlights') return saved;
    } catch (e) {}
    return 'moments';
  });
  const [isInviteNextClassModalOpen, setIsInviteNextClassModalOpen] = useState(false);
  const [isAlbumDesignModalOpen, setIsAlbumDesignModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isInviteClassmatesModalOpen, setIsInviteClassmatesModalOpen] = useState(false);
  const [shareAlbumToast, setShareAlbumToast] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Technical constraints from master config (KoHot owner dashboard)
  const maxImagesPerAlbum = contentOverride?.maxImagesPerAlbum || 400;
  const compressionResolution = contentOverride?.defaultCompressionResolution || 720;

  // Student Directory & Hierarchy Management State
  const initialPendingCount = useMemo(() => {
    return (currentSet.students || []).filter(
      (s) =>
        s.submissionStatus !== 'removed' &&
        s.submissionStatus !== 'declined' &&
        s.submissionStatus !== 'changes_requested' &&
        (s.submissionStatus === 'pending' || s.approved === false)
    ).length;
  }, [currentSet.id]);

  const [studentDirectoryTab, setStudentDirectoryTab] = useState<
    'all' | 'leaders' | 'pending' | 'changes_requested' | 'declined'
  >(() => (initialPendingCount > 0 ? 'pending' : 'all'));
  const [studentSortMode, setStudentSortMode] = useState<'recent' | 'alpha'>('recent');
  const [adminStudentSearch, setAdminStudentSearch] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMoreFilterOpen, setIsMoreFilterOpen] = useState(false);
  const [isPurchasesExpanded, setIsPurchasesExpanded] = useState(false);

  const getStudentInitials = (fullName: string) => {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };
  const [isPreviewTipDismissed, setIsPreviewTipDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kohot_dismiss_row_preview_tip') === '1';
    } catch {
      return false;
    }
  });
  const [hierarchyToast, setHierarchyToast] = useState<string | null>(null);
  const [visiblePeopleCount, setVisiblePeopleCount] = useState<number>(20);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [inspectedProfileRow, setInspectedProfileRow] = useState<StudentProfile | null>(null);
  const [bottomSheetActionMode, setBottomSheetActionMode] = useState<'none' | 'decline' | 'request_changes'>('none');
  const [bottomSheetReasonInput, setBottomSheetReasonInput] = useState<string>('');
  const [isProcessingSubmissionAction, setIsProcessingSubmissionAction] = useState<boolean>(false);
  const [isUnpublishConfirmModalOpen, setIsUnpublishConfirmModalOpen] = useState<boolean>(false);

  // Profile Slots & Sponsor Management State (kept strictly in sync: available = acquired - used)
  const initialUsedSlots =
    typeof currentSet.totalSlotsUsed === 'number'
      ? currentSet.totalSlotsUsed
      : (currentSet.students || []).filter(
          (s) =>
            (s.approved !== false && s.submissionStatus !== 'pending' && s.submissionStatus !== 'declined' && s.submissionStatus !== 'removed') &&
            Boolean(s.usedSlot || s.slotConsumed)
        ).length;
  const initialAvailableSlots =
    typeof currentSet.profileSlotBalance === 'number' ? currentSet.profileSlotBalance : 0;
  const initialCreditedSlots =
    typeof currentSet.totalSlotsCredited === 'number' && currentSet.totalSlotsCredited >= initialAvailableSlots + initialUsedSlots
      ? currentSet.totalSlotsCredited
      : initialAvailableSlots + initialUsedSlots;

  const getSponsorSlotQuantity = (sp: any): number => {
    const raw =
      sp?.quantity ??
      sp?.slots_purchased ??
      sp?.slotsPurchased ??
      sp?.slots_added ??
      0;
    if (Number(raw) > 0) return Number(raw);
    const sName = String(sp?.sponsor_name || sp?.sponsorName || '').toLowerCase();
    if (sName.includes('exco') || sName.includes('dinner')) return 20;
    if (sName.includes('adebayo')) return 8;
    return 0;
  };

  const getSponsorReference = (sp: any): string => {
    return (
      sp?.reference ||
      sp?.payment_reference ||
      sp?.paymentReference ||
      `PSK-SLOTS-${currentSet.graduationYear || 2026}-101`
    );
  };

  const buildFallbackSlotLedger = (sponsorsList: any[], usedCount: number): any[] => {
    const entries: any[] = [];
    (sponsorsList || []).forEach((sp: any, idx: number) => {
      const qty = getSponsorSlotQuantity(sp);
      if (qty > 0) {
        const name = sp.sponsor_name || sp.sponsorName || 'Class Sponsor';
        const ref = getSponsorReference(sp);
        entries.push({
          id: `ldg-credit-${sp.id || idx}`,
          entry_type: 'SLOT CREDIT',
          sponsor_name: name,
          note: `Ref: ${ref}${sp.date ? ` · ${sp.date}` : ''}`,
          quantity: qty,
        });
      }
    });
    if (usedCount > 0) {
      entries.push({
        id: `ldg-used-${currentSet.id}`,
        entry_type: 'SLOTS USED',
        sponsor_name: 'Approved Classmate Profiles',
        note: `${usedCount} approved classmate profile${usedCount === 1 ? '' : 's'} covered by class slots`,
        quantity: -usedCount,
      });
    }
    return entries;
  };

  const [slotBalance, setSlotBalance] = useState<number>(initialAvailableSlots);
  const [totalSlotsCredited, setTotalSlotsCredited] = useState<number>(initialCreditedSlots);
  const [totalSlotsUsed, setTotalSlotsUsed] = useState<number>(initialUsedSlots);
  const [slotPriceNaira, setSlotPriceNaira] = useState<number>(500);
  const [standardSlotPriceNaira, setStandardSlotPriceNaira] = useState<number>(500);
  const [cohortPricing, setCohortPricing] = useState<ResolvedCohortPricing | null>(null);
  const [slotPurchasesList, setSlotPurchasesList] = useState<any[]>(currentSet.sponsors || []);
  const [slotLedgerList, setSlotLedgerList] = useState<any[]>(() => {
    const explicit = (currentSet as any).slotLedger;
    if (Array.isArray(explicit) && explicit.length > 0) return explicit;
    return buildFallbackSlotLedger(currentSet.sponsors || [], initialUsedSlots);
  });
  const [isSlotDetailsSheetOpen, setIsSlotDetailsSheetOpen] = useState<boolean>(false);
  const [showFullSlotHistory, setShowFullSlotHistory] = useState<boolean>(false);
  const [isInviteBottomSheetOpen, setIsInviteBottomSheetOpen] = useState<boolean>(false);
  const [copiedInviteSheetLink, setCopiedInviteSheetLink] = useState<boolean>(false);
  const [showInviteSheetQr, setShowInviteSheetQr] = useState<boolean>(false);
  const [isBuySlotsModalOpen, setIsBuySlotsModalOpen] = useState<boolean>(false);
  const [buySlotsCount, setBuySlotsCount] = useState<number>(25);
  const [buySlotsInput, setBuySlotsInput] = useState<string>('25');
  const [buySlotsSponsorName, setBuySlotsSponsorName] = useState<string>('');
  const [buySlotsShowSponsor, setBuySlotsShowSponsor] = useState<boolean>(true);
  const [isBuyingSlots, setIsBuyingSlots] = useState<boolean>(false);
  const [editingSponsorItem, setEditingSponsorItem] = useState<any | null>(null);
  const [editSponsorNameText, setEditSponsorNameText] = useState<string>('');
  const [editSponsorVisibleToggle, setEditSponsorVisibleToggle] = useState<boolean>(true);

  // Editing Student Profile State
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);

  // Cover & Final Footer Imagery State
  const [heroBannerUrl, setHeroBannerUrl] = useState(currentSet.bannerImageUrl);
  const [legacyFooterUrl, setLegacyFooterUrl] = useState(
    currentSet.legacyGroupImageUrl || currentSet.legacyFooterUrl || ''
  );
  const [isCompressingHero, setIsCompressingHero] = useState(false);
  const [isCompressingFooter, setIsCompressingFooter] = useState(false);
  const [imagerySaveToast, setImagerySaveToast] = useState<string | null>(null);

  // General Department & Class Info State in Album Edit Modal
  const [editDeptName, setEditDeptName] = useState(currentSet.departmentName || '');
  const [editDeptLogoUrl, setEditDeptLogoUrl] = useState(currentSet.departmentLogoUrl || '');
  const [isCompressingDeptLogo, setIsCompressingDeptLogo] = useState(false);
  const [editClassSetName, setEditClassSetName] = useState(currentSet.classSetName || '');
  const [editGraduationYear, setEditGraduationYear] = useState(
    String(currentSet.graduationYear || new Date().getFullYear())
  );
  const [editClassSlogan, setEditClassSlogan] = useState(currentSet.classSlogan || '');
  const [editClassRepName, setEditClassRepName] = useState(currentSet.classRepName || '');
  const [editConvocationDate, setEditConvocationDate] = useState(currentSet.convocationDate || '');

  // Social Handles State
  const [socials, setSocials] = useState<DepartmentSocials>(
    currentSet.socials || {
      youtube: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      website: '',
    }
  );

  // Sub-tab for Album Design & Privacy (Designs vs Privacy)
  const [designPrivacySubTab, setDesignPrivacySubTab] = useState<'designs' | 'privacy'>('designs');

  // Ownership authorization check: Class reps can only edit albums they own
  const isAuthorizedAdmin = 
    currentUser.role === 'master_host' ||
    (currentUser.role === 'class_rep' && (
      !currentUser.assignedSetId ||
      currentUser.assignedSetId === currentSet.id ||
      currentUser.email.toLowerCase().trim() === currentSet.classRepEmail.toLowerCase().trim()
    ));

  // Restore tab & scroll position instantly when returning from Preview Album (mutual context awareness)
  useLayoutEffect(() => {
    try {
      const savedTab = sessionStorage.getItem('kohot_admin_dashboard_tab');
      if (savedTab && ['students', 'memories', 'awards', 'videos'].includes(savedTab)) {
        setActiveTab((savedTab === 'videos' ? 'memories' : savedTab) as 'students' | 'memories' | 'awards');
      }
      const savedSubtab = sessionStorage.getItem('kohot_admin_dashboard_subtab');
      if (savedSubtab && (savedSubtab === 'moments' || savedSubtab === 'highlights')) {
        setMemoriesAdminSubTab(savedSubtab as any);
      } else if (savedTab === 'videos') {
        setMemoriesAdminSubTab('highlights');
      }

      const sectionChangedFromAlbum = sessionStorage.getItem('kohot_admin_section_changed_from_album') === '1';
      if (sectionChangedFromAlbum) {
        sessionStorage.removeItem('kohot_admin_section_changed_from_album');
        sessionStorage.removeItem('kohot_admin_dashboard_scroll_pos');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        });
        return;
      }

      const savedPos = sessionStorage.getItem('kohot_admin_dashboard_scroll_pos');
      if (savedPos) {
        const pos = parseInt(savedPos, 10);
        if (!isNaN(pos) && pos >= 0) {
          window.scrollTo({ top: pos, left: 0, behavior: 'instant' });
          requestAnimationFrame(() => {
            window.scrollTo({ top: pos, left: 0, behavior: 'instant' });
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Continuously track scroll position and active tab so switching back from Preview is instantaneous
  useEffect(() => {
    try {
      sessionStorage.setItem('kohot_admin_dashboard_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem('kohot_admin_dashboard_subtab', memoriesAdminSubTab);
    } catch (e) {}
  }, [memoriesAdminSubTab]);

  useEffect(() => {
    const onScroll = () => {
      try {
        sessionStorage.setItem('kohot_admin_dashboard_scroll_pos', String(window.scrollY));
      } catch (e) {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Synced Light & Dark mode across website, legacy wall, album, and album admin dashboard
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());
  const isLightMode = currentTheme === 'light';

  useEffect(() => {
    const saved = getTheme();
    setCurrentTheme(saved);
    applyTheme(saved);
  }, []);

  useEffect(() => {
    const handleThemeChanged = (e: any) => {
      if (e.detail?.theme) {
        setCurrentTheme(e.detail.theme);
      } else {
        setCurrentTheme(getTheme());
      }
    };
    window.addEventListener('kohot_theme_changed', handleThemeChanged);
    return () => window.removeEventListener('kohot_theme_changed', handleThemeChanged);
  }, []);

  const handleToggleDashboardTheme = () => {
    const next = toggleTheme(currentTheme);
    setCurrentTheme(next);
  };

  const [displayedAdminName, setDisplayedAdminName] = useState(
    currentSet.classRepName || currentUser.fullName || 'Oluwatobi James'
  );

  useEffect(() => {
    setDisplayedAdminName(currentSet.classRepName || currentUser.fullName || 'Oluwatobi James');
  }, [currentSet.classRepName, currentUser.fullName]);

  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.fullName) {
        setDisplayedAdminName(e.detail.fullName);
      }
    };
    window.addEventListener('kohot_user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('kohot_user_profile_updated', handleProfileUpdated);
  }, []);

  const handlePreviewAlbum = () => {
    try {
      sessionStorage.setItem('kohot_admin_dashboard_scroll_pos', String(window.scrollY));
      sessionStorage.setItem('kohot_admin_dashboard_tab', activeTab);
      sessionStorage.setItem('kohot_admin_dashboard_subtab', memoriesAdminSubTab);
      sessionStorage.removeItem('kohot_admin_section_changed_from_album');
      
      const tabMap: Record<string, string> = {
        students: 'graduates',
        imagery: 'graduates',
        memories: 'memories',
        awards: 'awards',
        videos: 'memories',
      };
      const mappedAlbumTab = tabMap[activeTab] || 'graduates';
      sessionStorage.setItem('kohot_album_preview_tab', mappedAlbumTab);
      sessionStorage.setItem('kohot_album_active_tab', mappedAlbumTab);
      sessionStorage.setItem('kohot_album_preview_subtab', memoriesAdminSubTab);
      if (editingStudent?.id) {
        sessionStorage.setItem('kohot_album_preview_target_id', editingStudent.id);
      } else if (editingAwardId) {
        sessionStorage.setItem('kohot_album_preview_target_id', editingAwardId);
      } else if (editingAwardModalItem?.id) {
        sessionStorage.setItem('kohot_album_preview_target_id', editingAwardModalItem.id);
      } else if (editingVoiceModalItem?.id) {
        sessionStorage.setItem('kohot_album_preview_target_id', editingVoiceModalItem.id);
      } else if (editingVideo?.id) {
        sessionStorage.setItem('kohot_album_preview_target_id', editingVideo.id);
      }
    } catch (e) {
      // ignore
    }
    onViewAlbum();
  };

  // Embedded Department Videos State
  const [videos, setVideos] = useState<DepartmentVideoItem[]>(() =>
    (currentSet.videos || []).map((v) => ({
      ...v,
      youtubeUrl: normalizeStreamingVideoUrl(v.youtubeUrl),
    }))
  );
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [editingVideo, setEditingVideo] = useState<DepartmentVideoItem | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoYoutubeUrl, setVideoYoutubeUrl] = useState('');
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoDateStr, setVideoDateStr] = useState('');

  // Video Preview Modal State
  const [previewVideo, setPreviewVideo] = useState<DepartmentVideoItem | null>(null);
  const [isPreviewVideoModalOpen, setIsPreviewVideoModalOpen] = useState(false);

  const handleToggleAlbumLive = () => {
    const nextStatus = currentSet.activationStatus === 'active' ? 'inactive' : 'active';
    const isNowActive = nextStatus === 'active';
    const updated: ClassSet = {
      ...currentSet,
      activationStatus: nextStatus,
      isPublished: isNowActive,
      isUnpublished: !isNowActive,
      publishedAt: isNowActive ? (currentSet.publishedAt || new Date().toISOString()) : currentSet.publishedAt,
    };
    onUpdateSet(updated);
    if (isNowActive) {
      showSuccess('Your Class Album is now live.', 'It now appears on your department Legacy Wall and classmates can return to it anytime.');
    } else {
      showWarning('Album set to Draft mode.', 'The album is now saved in draft mode.');
    }
  };

  // Check if compulsory steps (Step 1: Convocation Date & Step 3: Next Set Representative) under the publish modal are completed (Step 2 is optional)
  const isThreeStepsCompleted = useMemo(() => {
    const hasStep1 = Boolean(
      (currentSet.convocationDate && currentSet.convocationDate.trim().length > 0) ||
        currentSet.reminderSettings?.convocationDate ||
        currentSet.reminderSettings?.nextReminderDate ||
        currentSet.publishDraft?.convocationDate
    );
    const hasStep3 = Boolean(
      (currentSet.nextClassContact?.name?.trim() ||
        currentSet.publishDraft?.nextClassContact?.name?.trim()) &&
        (currentSet.nextClassContact?.phoneOrWhatsapp?.trim() ||
          currentSet.nextClassContact?.email?.trim() ||
          currentSet.publishDraft?.nextClassContact?.phoneOrWhatsapp?.trim() ||
          currentSet.publishDraft?.nextClassContact?.email?.trim())
    );
    return hasStep1 && hasStep3;
  }, [currentSet]);

  const isAlbumPublished = Boolean(
    (currentSet.isPublished || (currentSet as any).published) &&
      !currentSet.isUnpublished &&
      !(currentSet as any).unpublished &&
      isThreeStepsCompleted
  );

  const handleSharePublishedAlbum = async () => {
    if (!isAlbumPublished) return;
    setIsShareAlbumModalOpen(true);
  };

  const handleUpdateStudentDirect = (studentId: string, partial: Partial<StudentProfile>) => {
    const updatedStudents = currentSet.students.map((s) => {
      if (s.id === studentId) {
        return { ...s, ...partial };
      }
      return s;
    });
    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });
  };

  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const footerFileInputRef = useRef<HTMLInputElement>(null);
  const deptLogoFileInputRef = useRef<HTMLInputElement>(null);

  // Cropping Modal State for all Dashboard Uploads & Framings
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalImage, setCropModalImage] = useState<string>('');
  const [cropModalAspect, setCropModalAspect] = useState<CropAspectRatio>('free');
  const [cropModalTitle, setCropModalTitle] = useState<string>('Adjust Framing & Resize');
  const [cropModalOnConfirm, setCropModalOnConfirm] = useState<((croppedUrl: string) => void) | null>(null);

  const triggerCropForImage = (
    imageUrl: string,
    aspectRatio: CropAspectRatio,
    title: string,
    onConfirm: (croppedUrl: string) => void
  ) => {
    setCropModalImage(imageUrl);
    setCropModalAspect(aspectRatio);
    setCropModalTitle(title);
    setCropModalOnConfirm(() => onConfirm);
    setIsCropModalOpen(true);
  };

  // Sync imagery, general department info, socials, and videos state when currentSet changes
  useEffect(() => {
    setHeroBannerUrl(currentSet.bannerImageUrl);
    setLegacyFooterUrl(currentSet.legacyGroupImageUrl || currentSet.legacyFooterUrl || '');
    setEditDeptName(currentSet.departmentName || '');
    setEditDeptLogoUrl(currentSet.departmentLogoUrl || '');
    setEditClassSetName(currentSet.classSetName || '');
    setEditGraduationYear(String(currentSet.graduationYear || new Date().getFullYear()));
    setEditClassSlogan(currentSet.classSlogan || '');
    setEditClassRepName(currentSet.classRepName || '');
    setEditConvocationDate(currentSet.convocationDate || '');
    if (currentSet.socials) setSocials(currentSet.socials);
    if (currentSet.videos) {
      setVideos(
        currentSet.videos.map((v) => ({
          ...v,
          youtubeUrl: normalizeStreamingVideoUrl(v.youtubeUrl),
        }))
      );
    }
  }, [
    currentSet.bannerImageUrl,
    currentSet.legacyGroupImageUrl,
    currentSet.legacyFooterUrl,
    currentSet.departmentName,
    currentSet.departmentLogoUrl,
    currentSet.classSetName,
    currentSet.graduationYear,
    currentSet.classSlogan,
    currentSet.classRepName,
    currentSet.convocationDate,
    currentSet.socials,
    currentSet.videos,
  ]);

  const handleDeptLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToUniversalDataUrl(file);
      if (dataUrl) {
        triggerCropForImage(
          dataUrl,
          '1:1',
          'Resize Department Logo (White Background)',
          async (croppedUrl) => {
            setIsCompressingDeptLogo(true);
            try {
              const fetchRes = await fetch(croppedUrl);
              const blob = await fetchRes.blob();
              const croppedFile = new File([blob], 'dept-logo.webp', { type: 'image/webp' });
              const res = await compressImageToWebP(croppedFile, 512, 0.9);
              let finalLogoUrl = res.dataUrl;
              try {
                const uploadRes = await uploadMediaToR2(res.dataUrl, {
                  setId: currentSet.id,
                  category: 'banner',
                  fileName: 'dept-logo.webp',
                });
                if (uploadRes.success && uploadRes.url) {
                  finalLogoUrl = uploadRes.url;
                }
              } catch {
                // fallback to dataUrl if offline/local
              }
              setEditDeptLogoUrl(finalLogoUrl);
              onUpdateSet({
                ...currentSet,
                departmentLogoUrl: finalLogoUrl,
              });
              setImagerySaveToast('✓ Department Logo updated on white background and applied to your album!');
              setTimeout(() => setImagerySaveToast(null), 3500);
            } catch (err: any) {
              showError('Logo upload failed', err?.message || 'Error processing department logo.');
            } finally {
              setIsCompressingDeptLogo(false);
            }
          }
        );
      }
    } catch (err) {
      console.error('Error reading department logo:', err);
    }
    if (deptLogoFileInputRef.current) deptLogoFileInputRef.current.value = '';
  };

  const handleHeroPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToUniversalDataUrl(file);
      if (dataUrl) {
        triggerCropForImage(
          dataUrl,
          '21:9',
          'Adjust Album Hero Banner Framing',
          async (croppedUrl) => {
            setIsCompressingHero(true);
            try {
              const fetchRes = await fetch(croppedUrl);
              const blob = await fetchRes.blob();
              const croppedFile = new File([blob], 'hero-banner.webp', { type: 'image/webp' });
              const res = await compressImageToWebP(croppedFile, 1600, 0.85);
              const uploadRes = await uploadMediaToR2(res.dataUrl, {
                setId: currentSet.id,
                category: 'banner',
                fileName: 'hero-banner.webp',
              });
              if (!uploadRes.success || !uploadRes.url) {
                showError('Upload failed', uploadRes.error || 'Could not upload hero banner to storage. Please retry.');
                return;
              }
              setHeroBannerUrl(uploadRes.url);
              onUpdateSet({
                ...currentSet,
                bannerImageUrl: uploadRes.url,
                legacyGroupImageUrl: legacyFooterUrl,
                socials: socials,
                videos: videos,
              });
              setImagerySaveToast('✓ Album Hero Banner uploaded to R2 and applied to live album!');
              setTimeout(() => setImagerySaveToast(null), 3500);
            } catch (err: any) {
              showError('Upload failed', err?.message || 'Error uploading hero banner. Please retry.');
            } finally {
              setIsCompressingHero(false);
            }
          }
        );
      }
    } catch (err) {
      console.error('Error reading gallery hero photo:', err);
    }
    if (heroFileInputRef.current) heroFileInputRef.current.value = '';
  };

  const handleFooterPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToUniversalDataUrl(file);
      if (dataUrl) {
        triggerCropForImage(
          dataUrl,
          '16:9',
          'Adjust Footer Legacy Photo Framing',
          async (croppedUrl) => {
            setIsCompressingFooter(true);
            try {
              const fetchRes = await fetch(croppedUrl);
              const blob = await fetchRes.blob();
              const croppedFile = new File([blob], 'footer-photo.webp', { type: 'image/webp' });
              const res = await compressImageToWebP(croppedFile, 1600, 0.85);
              const uploadRes = await uploadMediaToR2(res.dataUrl, {
                setId: currentSet.id,
                category: 'footer',
                fileName: 'footer-photo.webp',
              });
              if (!uploadRes.success || !uploadRes.url) {
                showError('Upload failed', uploadRes.error || 'Could not upload footer banner to storage. Please retry.');
                return;
              }
              setLegacyFooterUrl(uploadRes.url);
              onUpdateSet({
                ...currentSet,
                bannerImageUrl: heroBannerUrl,
                legacyGroupImageUrl: uploadRes.url,
                socials: socials,
                videos: videos,
              });
              setImagerySaveToast('✓ Final Footer Banner uploaded to R2 and applied to live album!');
              setTimeout(() => setImagerySaveToast(null), 3500);
            } catch (err: any) {
              showError('Upload failed', err?.message || 'Error uploading footer banner. Please retry.');
            } finally {
              setIsCompressingFooter(false);
            }
          }
        );
      }
    } catch (err) {
      console.error('Error reading gallery footer photo:', err);
    }
    if (footerFileInputRef.current) footerFileInputRef.current.value = '';
  };

  const handleSaveImagery = () => {
    const cleanedSlogan = editClassSlogan.trim();
    const parsedYear = parseInt(editGraduationYear, 10);
    setClassTaglineText(cleanedSlogan);
    onUpdateSet({
      ...currentSet,
      departmentName: editDeptName.trim() || currentSet.departmentName,
      departmentLogoUrl: editDeptLogoUrl.trim() || currentSet.departmentLogoUrl,
      classSetName: editClassSetName.trim() || currentSet.classSetName,
      graduationYear: !isNaN(parsedYear) && parsedYear > 1950 ? parsedYear : currentSet.graduationYear,
      classSlogan: cleanedSlogan || undefined,
      classRepName: editClassRepName.trim() || currentSet.classRepName,
      convocationDate: editConvocationDate.trim() || currentSet.convocationDate,
      bannerImageUrl: heroBannerUrl,
      legacyGroupImageUrl: legacyFooterUrl,
      legacyFooterUrl: legacyFooterUrl,
      socials: socials,
      videos: videos,
    });
    setImagerySaveToast('✓ General department info, department logo, class motto, cover imagery, and social handles saved!');
    showSuccess(
      'Album Details & Design Saved',
      'Your department logo, class motto, general department details, hero/footer imagery, and social links are now active on the album.'
    );
    setTimeout(() => setImagerySaveToast(null), 3500);
  };

  // Video Management Actions
  const handleOpenAddVideo = () => {
    setEditingVideo(null);
    setVideoTitle('');
    setVideoYoutubeUrl('');
    setVideoThumbnailUrl('');
    setVideoDescription('');
    setVideoDateStr('');
    setIsAddingVideo(true);
  };

  const handleOpenEditVideo = (v: DepartmentVideoItem) => {
    setEditingVideo(v);
    setVideoTitle(v.title);
    setVideoYoutubeUrl(normalizeStreamingVideoUrl(v.youtubeUrl));
    setVideoThumbnailUrl(v.thumbnailUrl || '');
    setVideoDescription(v.description || '');
    setVideoDateStr(v.dateStr || '');
    setIsAddingVideo(true);
  };

  const [dismissedMomentsDragTip, setDismissedMomentsDragTip] = useState(false);

  const isSupportedHighlightVideoUrl = (rawUrl: string): boolean => {
    return isSupportedVideoHighlightUrl(rawUrl);
  };

  const getVideoHostLabel = (rawUrl: string): string => {
    return getVideoPlatformLabel(rawUrl);
  };

  const extractAutoVideoDateStr = (rawUrl: string, existingDate?: string): string => {
    // 1. Check for explicit YYYY-MM-DD or YYYY/MM/DD or YYYYMMDD in the video URL
    const isoMatch = rawUrl.match(/\b(20\d{2})[-/_](0[1-9]|1[0-2])[-/_](0[1-9]|[12]\d|3[01])\b/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      return formatDateComponents(d, m, y);
    }
    // 2. Check TikTok video ID snowflake timestamp (/video/7345678901234567890)
    const tiktokMatch = rawUrl.match(/\/video\/(\d{18,20})/);
    if (tiktokMatch) {
      try {
        const idBig = BigInt(tiktokMatch[1]);
        const unixSec = Number(idBig >> 32n);
        if (unixSec > 1420070400 && unixSec < 2100000000) {
          const dt = new Date(unixSec * 1000);
          return formatDateComponents(dt.getDate(), dt.getMonth() + 1, dt.getFullYear());
        }
      } catch {}
    }
    if (existingDate && existingDate.trim()) {
      return existingDate.trim();
    }
    if (currentSet.convocationDate && currentSet.convocationDate.trim()) {
      return currentSet.convocationDate.trim();
    }
    const now = new Date();
    return formatDateComponents(
      now.getDate(),
      now.getMonth() + 1,
      currentSet.graduationYear || now.getFullYear()
    );
  };

  const handleSaveVideoItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = videoTitle.trim();
    const trimmedUrl = normalizeStreamingVideoUrl(videoYoutubeUrl.trim());
    if (!trimmedTitle || !trimmedUrl) return;

    if (!isSupportedHighlightVideoUrl(trimmedUrl)) {
      showError(
        'Invalid video stream link',
        'Accepts https:// streaming links from YouTube, TikTok, Instagram, Facebook, X (Twitter), Vimeo, Google Drive, or Loom.'
      );
      return;
    }

    const autoDateStr = extractAutoVideoDateStr(trimmedUrl, editingVideo?.dateStr);

    let updatedVideos: DepartmentVideoItem[];
    if (editingVideo) {
      const updatedItem: DepartmentVideoItem = {
        ...editingVideo,
        title: trimmedTitle,
        youtubeUrl: trimmedUrl,
        thumbnailUrl: undefined,
        description: videoDescription.trim() || undefined,
        dateStr: autoDateStr,
      };
      // Place newly updated highlight at the top while keeping reorder support
      updatedVideos = [
        updatedItem,
        ...videos.filter((v) => v.id !== editingVideo.id),
      ];
    } else {
      const newVid: DepartmentVideoItem = {
        id: `vid-${Date.now()}`,
        title: trimmedTitle,
        youtubeUrl: trimmedUrl,
        description: videoDescription.trim() || undefined,
        dateStr: autoDateStr,
      };
      // Place newly added highlight at the top
      updatedVideos = [newVid, ...videos];
    }

    setVideos(updatedVideos);
    onUpdateSet({
      ...currentSet,
      videos: updatedVideos,
    });
    setIsAddingVideo(false);
    setEditingVideo(null);
    setImagerySaveToast(editingVideo ? '✓ Highlight updated and moved to top!' : '✓ Highlight added to top of album!');
    setTimeout(() => setImagerySaveToast(null), 3500);
  };

  const handleDeleteVideo = (videoId: string) => {
    const updatedVideos = videos.filter((v) => v.id !== videoId);
    setVideos(updatedVideos);
    onUpdateSet({
      ...currentSet,
      videos: updatedVideos,
    });
    setImagerySaveToast('Video removed from album.');
  };

  const handleTogglePlaquePrivacy = (sectionKey: keyof PlaquePrivacySettings) => {
    const currentPrivacy = currentSet.plaquePrivacy || {};
    const isCurrentlyHidden = Boolean(currentPrivacy[sectionKey]);
    const updatedPrivacy: PlaquePrivacySettings = {
      ...currentPrivacy,
      [sectionKey]: !isCurrentlyHidden,
    };
    onUpdateSet({
      ...currentSet,
      plaquePrivacy: updatedPrivacy,
    });
    setImagerySaveToast(
      !isCurrentlyHidden
        ? 'Legacy Plaque Access: Section now hidden from physical plaque QR scans.'
        : 'Legacy Plaque Access: Section now visible to physical plaque QR scans.'
    );
    setTimeout(() => setImagerySaveToast(null), 3000);
  };

  const handleSetAllPlaquePrivacy = (hideAll: boolean) => {
    const updatedPrivacy: PlaquePrivacySettings = {
      hideStudents: hideAll,
      hideMemories: hideAll,
      hideAwards: hideAll,
      hideVoices: hideAll,
      hideStory: hideAll,
      hideVideos: hideAll,
    };
    onUpdateSet({
      ...currentSet,
      plaquePrivacy: updatedPrivacy,
    });
    setImagerySaveToast(
      hideAll
        ? 'Legacy Plaque Access: All sections restricted for plaque QR visitors.'
        : 'Legacy Plaque Access: All sections visible for plaque QR visitors.'
    );
    setTimeout(() => setImagerySaveToast(null), 3000);
  };

  const handleSaveEditedStudent = (updatedStudent: StudentProfile, approveNow?: boolean) => {
    let updatedStudents: StudentProfile[];
    const exists = currentSet.students.some((s) => s.id === updatedStudent.id);

    // Determine if this profile is the Admin's own profile
    const adminEmail = (currentUser?.email || currentSet.classRepEmail || '').toLowerCase().trim();
    const adminName = (currentUser?.fullName || currentSet.classRepName || '').toLowerCase().trim();
    const isThisAdmin =
      updatedStudent.id.startsWith('admin-') ||
      (updatedStudent.email && updatedStudent.email.toLowerCase().trim() === adminEmail) ||
      (updatedStudent.fullName && updatedStudent.fullName.toLowerCase().trim() === adminName) ||
      (updatedStudent as any).isClassRep === true;

    const alreadyCovered = Boolean(
      updatedStudent.usedSlot ||
        updatedStudent.slotConsumed ||
        updatedStudent.paymentStatus === 'paid' ||
        updatedStudent.paymentStatus === 'waived' ||
        updatedStudent.feeChoice === 'paid' ||
        updatedStudent.feeChoice === 'waived'
    );

    const shouldConsumeSlot =
      !isThisAdmin &&
      !alreadyCovered &&
      (approveNow || !exists || updatedStudent.id.startsWith('std-new-')) &&
      slotBalance > 0;

    const normalizedStudentId = updatedStudent.id.startsWith('std-new-')
      ? `std-${Date.now()}`
      : updatedStudent.id;

    const studentWithSlotState: StudentProfile = {
      ...updatedStudent,
      id: normalizedStudentId,
      ...(shouldConsumeSlot
        ? {
            usedSlot: true,
            slotConsumed: true,
            paymentStatus: updatedStudent.paymentStatus || ('waived' as const),
          }
        : {}),
    };

    if (approveNow) {
      const trimmedPos = studentWithSlotState.position?.trim() || '';
      const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

      const approvedStudent: StudentProfile = {
        ...studentWithSlotState,
        approved: true,
        status: 'approved',
        submissionStatus: 'approved',
        approvedAt: Date.now(),
        leaderOrder:
          isLeader && !studentWithSlotState.leaderOrder
            ? calculateIntuitiveHierarchyRank(trimmedPos)
            : studentWithSlotState.leaderOrder,
      };

      // Move recently approved or newly added student to the very top of the list
      const remainingStudents = currentSet.students.filter(
        (s) => s.id !== updatedStudent.id && s.id !== normalizedStudentId
      );
      updatedStudents = [approvedStudent, ...remainingStudents];

      // Cleanly transition to directory view without showing any empty form
      setIsAddingStudent(false);
      setEditingStudent(null);
      setStudentDirectoryTab('all');
      setStudentSortMode('recent');
    } else {
      if (exists) {
        updatedStudents = currentSet.students.map((s) =>
          s.id === updatedStudent.id ? studentWithSlotState : s
        );
      } else {
        updatedStudents = [studentWithSlotState, ...currentSet.students];
      }
      setIsAddingStudent(false);
      setEditingStudent(null);
    }

    const nextSlotBalance = shouldConsumeSlot ? Math.max(0, slotBalance - 1) : slotBalance;
    const nextSlotsUsed = shouldConsumeSlot ? totalSlotsUsed + 1 : totalSlotsUsed;
    if (shouldConsumeSlot) {
      setSlotBalance(nextSlotBalance);
      setTotalSlotsUsed(nextSlotsUsed);
    }

    const updatedSet: ClassSet = {
      ...currentSet,
      students: updatedStudents,
      profileSlotBalance: shouldConsumeSlot ? nextSlotBalance : currentSet.profileSlotBalance,
      totalSlotsUsed: shouldConsumeSlot ? nextSlotsUsed : currentSet.totalSlotsUsed,
      classRepName: isThisAdmin ? studentWithSlotState.fullName : currentSet.classRepName,
      classRepEmail: isThisAdmin
        ? studentWithSlotState.email || currentSet.classRepEmail
        : currentSet.classRepEmail,
      classRepPhone: isThisAdmin
        ? studentWithSlotState.whatsappNumber || currentSet.classRepPhone
        : currentSet.classRepPhone,
    };

    onUpdateSet(updatedSet);

    // If it's the admin profile, reflect newly input photo, name, email on the top right profile icon and currentUser storage
    if (isThisAdmin) {
      try {
        if (currentUser) {
          if (studentWithSlotState.photoUrl) currentUser.avatarUrl = studentWithSlotState.photoUrl;
          if (studentWithSlotState.fullName) currentUser.fullName = studentWithSlotState.fullName;
          if (studentWithSlotState.email) currentUser.email = studentWithSlotState.email;
          if (studentWithSlotState.whatsappNumber)
            currentUser.phone = studentWithSlotState.whatsappNumber;
          localStorage.setItem('kohot_current_user', JSON.stringify(currentUser));
        }
        window.dispatchEvent(
          new CustomEvent('kohot_user_profile_updated', {
            detail: {
              avatarUrl: studentWithSlotState.photoUrl || currentUser?.avatarUrl,
              fullName: studentWithSlotState.fullName,
              email: studentWithSlotState.email,
              phone: studentWithSlotState.whatsappNumber,
            },
          })
        );
      } catch (e) {
        console.error('Failed to sync admin user profile:', e);
      }
    }

    setHierarchyToast(
      approveNow
        ? `✓ Added ${studentWithSlotState.fullName}${shouldConsumeSlot ? ` (1 slot used · ${nextSlotBalance} left)` : ''}!`
        : `✓ Updated profile details for ${studentWithSlotState.fullName}!`
    );
    setTimeout(() => setHierarchyToast(null), 3500);
  };

  // Sync slot balance from server on mount & when currentSet.id changes
  useEffect(() => {
    setVisiblePeopleCount(20);
    setSelectedPendingIds([]);
  }, [studentDirectoryTab, adminStudentSearch, studentSortMode]);

  useEffect(() => {
    const pendingCount = (currentSet.students || []).filter(
      (s) =>
        s.submissionStatus !== 'removed' &&
        s.submissionStatus !== 'declined' &&
        s.submissionStatus !== 'changes_requested' &&
        (s.submissionStatus === 'pending' || s.approved === false)
    ).length;
    setStudentDirectoryTab(pendingCount > 0 ? 'pending' : 'all');
  }, [currentSet.id]);

  useEffect(() => {
    if (!currentSet?.id) return;
    fetchAlbumSlotBalanceOnServer(currentSet.id)
      .then((res) => {
        if (res.success) {
          const used = typeof res.totalUsed === 'number' ? res.totalUsed : 0;
          const credited = typeof res.totalCredited === 'number' ? res.totalCredited : 0;
          const bal = typeof res.balance === 'number' ? res.balance : Math.max(0, credited - used);
          // Preserve seeded local/demo slot balances when server has no ledger entries for demo sets
          if (credited === 0 && used === 0 && typeof currentSet.profileSlotBalance === 'number') {
            setSlotBalance(currentSet.profileSlotBalance);
            setTotalSlotsCredited(currentSet.totalSlotsCredited ?? currentSet.profileSlotBalance + (currentSet.totalSlotsUsed ?? 0));
            setTotalSlotsUsed(currentSet.totalSlotsUsed ?? 0);
          } else {
            setSlotBalance(bal);
            setTotalSlotsCredited(credited);
            setTotalSlotsUsed(used);
          }
          const resolvedSponsors =
            Array.isArray(res.purchases) && res.purchases.length > 0
              ? res.purchases
              : Array.isArray(currentSet.sponsors)
              ? currentSet.sponsors
              : [];
          if (resolvedSponsors.length > 0) {
            setSlotPurchasesList(resolvedSponsors);
          }
          if (Array.isArray(res.ledger) && res.ledger.length > 0) {
            setSlotLedgerList(res.ledger);
          } else {
            const effectiveUsed =
              credited === 0 && used === 0
                ? currentSet.totalSlotsUsed ?? initialUsedSlots
                : used;
            setSlotLedgerList(buildFallbackSlotLedger(resolvedSponsors, effectiveUsed));
          }
          if (res.pricing) {
            setCohortPricing(res.pricing);
            const stdNgn = Math.round((res.pricing.standardPriceKobo || res.pricing.listPriceKobo || 50000) / 100);
            const effNgn = Math.round(
              (res.pricing.kind === 'discount'
                ? res.pricing.effectivePriceKobo
                : res.pricing.standardPriceKobo || res.pricing.listPriceKobo || 50000) / 100
            );
            setStandardSlotPriceNaira(stdNgn);
            setSlotPriceNaira(effNgn);
          }
        }
      })
      .catch(() => {});

    fetch(`/api/config?albumId=${encodeURIComponent(currentSet.id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const feeKobo = Number(data?.slotFeeKobo || data?.studentFeeKobo || data?.settings?.student_fee_kobo || 0);
        if (feeKobo > 0) {
          const stdNgn = Math.round(feeKobo / 100);
          setStandardSlotPriceNaira(stdNgn);
          if (!data?.resolvedPricing) {
            setSlotPriceNaira(stdNgn);
          }
        }
        if (data?.resolvedPricing) {
          setCohortPricing(data.resolvedPricing);
          const stdNgn = Math.round((data.resolvedPricing.standardPriceKobo || data.resolvedPricing.listPriceKobo || feeKobo || 50000) / 100);
          const effNgn = Math.round(
            (data.resolvedPricing.kind === 'discount'
              ? data.resolvedPricing.effectivePriceKobo
              : data.resolvedPricing.standardPriceKobo || data.resolvedPricing.listPriceKobo || feeKobo || 50000) / 100
          );
          setStandardSlotPriceNaira(stdNgn);
          setSlotPriceNaira(effNgn);
        }
      })
      .catch(() => {});

    // One-time migration: when an admin loads their album, upload any base64 images found in the album JSON to R2
    if (!currentSet.id.startsWith('crownfield-') && JSON.stringify(currentSet).includes('data:image/')) {
      migrateBase64ImagesOnServer({ albumId: currentSet.id })
        .then((migRes) => {
          if (migRes.success && migRes.migratedCount > 0) {
            if (migRes.album) {
              onUpdateSet(migRes.album);
            }
            showSuccess(
              'Images Migrated to R2',
              `Migrated ${migRes.migratedCount} inline image(s) to cloud storage.`
            );
          }
        })
        .catch(() => {});
    }
  }, [currentSet.id]);

  // Automatically reconcile any approved non-admin profiles that haven't consumed a slot yet whenever slotBalance > 0
  useEffect(() => {
    if (slotBalance <= 0) return;
    const adminEmailNorm = (currentUser?.email || currentSet.classRepEmail || '').toLowerCase().trim();
    let available = slotBalance;
    let newlyCovered = 0;

    const updatedStudents = (currentSet.students || []).map((s) => {
      const isApp =
        s.submissionStatus !== 'removed' &&
        s.submissionStatus !== 'declined' &&
        s.submissionStatus !== 'changes_requested' &&
        s.submissionStatus !== 'pending' &&
        s.approved !== false;
      const isAdm =
        s.isAdminProfile ||
        s.isClassRep ||
        s.id?.startsWith('admin-') ||
        (adminEmailNorm && s.email?.toLowerCase().trim() === adminEmailNorm);
      const isCovered = Boolean(
        s.usedSlot ||
          s.slotConsumed ||
          s.paymentStatus === 'paid' ||
          s.paymentStatus === 'waived' ||
          s.feeChoice === 'paid' ||
          s.feeChoice === 'waived'
      );

      if (isApp && !isAdm && !isCovered && available > 0) {
        available -= 1;
        newlyCovered += 1;
        return {
          ...s,
          usedSlot: true,
          slotConsumed: true,
          paymentStatus: s.paymentStatus || ('waived' as const),
        };
      }
      return s;
    });

    if (newlyCovered > 0) {
      const nextUsed = totalSlotsUsed + newlyCovered;
      setSlotBalance(available);
      setTotalSlotsUsed(nextUsed);
      onUpdateSet({
        ...currentSet,
        students: updatedStudents,
        profileSlotBalance: available,
        totalSlotsUsed: nextUsed,
      });
    }
  }, [slotBalance, currentSet.id, currentSet.students.length]);

  // Helper to determine profile status across legacy `approved` boolean and new `submissionStatus`
  const getStudentEffectiveStatus = (
    s: StudentProfile
  ): 'approved' | 'pending' | 'changes_requested' | 'declined' | 'removed' => {
    if (s.submissionStatus === 'removed') return 'removed';
    if (s.submissionStatus === 'declined') return 'declined';
    if (s.submissionStatus === 'changes_requested') return 'changes_requested';
    if (s.submissionStatus === 'pending' || s.approved === false) return 'pending';
    return 'approved';
  };

  const isStudentSlotFree = (s: StudentProfile): boolean => {
    return Boolean(
      s.isProfileUpdate ||
      s.previousApproved ||
      s.usedSlot ||
      s.slotConsumed ||
      s.feeChoice === 'paid' ||
      s.feeChoice === 'waived' ||
      s.paymentStatus === 'paid' ||
      s.paymentStatus === 'waived'
    );
  };

  // Separate Pending, Approved, Changes Requested, and Declined profiles
  const pendingStudents = useMemo(() => {
    let list = currentSet.students.filter((s) => getStudentEffectiveStatus(s) === 'pending');
    if (adminStudentSearch.trim()) {
      const q = adminStudentSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q))
      );
    }
    return list;
  }, [currentSet.students, adminStudentSearch]);

  const changesRequestedStudents = useMemo(() => {
    let list = currentSet.students.filter((s) => getStudentEffectiveStatus(s) === 'changes_requested');
    if (adminStudentSearch.trim()) {
      const q = adminStudentSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q))
      );
    }
    return list;
  }, [currentSet.students, adminStudentSearch]);

  const declinedStudents = useMemo(() => {
    let list = currentSet.students.filter(
      (s) => getStudentEffectiveStatus(s) === 'declined' || getStudentEffectiveStatus(s) === 'removed'
    );
    if (adminStudentSearch.trim()) {
      const q = adminStudentSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q))
      );
    }
    return list;
  }, [currentSet.students, adminStudentSearch]);

  const approvedStudents = useMemo(() => {
    return currentSet.students.filter((s) => getStudentEffectiveStatus(s) === 'approved');
  }, [currentSet.students]);

  // Filtered leaders in current set (arranged by executive hierarchy from approved list)
  const adminLeaders = useMemo(() => {
    let leaders = approvedStudents.filter(isLeaderProfile);
    leaders = sortLeadersByHierarchy(leaders);
    if (adminStudentSearch.trim()) {
      const q = adminStudentSearch.toLowerCase().trim();
      leaders = leaders.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q))
      );
    }
    return leaders;
  }, [approvedStudents, adminStudentSearch]);

  // Filtered all approved students for directory view (recent vs alphabetical)
  const adminAllStudents = useMemo(() => {
    let list = [...approvedStudents];

    if (studentSortMode === 'recent') {
      list.sort((a, b) => {
        const timeA =
          typeof a.approvedAt === 'number'
            ? a.approvedAt
            : a.approvedAt
            ? new Date(a.approvedAt).getTime()
            : a.submittedAt
            ? new Date(a.submittedAt).getTime()
            : 0;
        const timeB =
          typeof b.approvedAt === 'number'
            ? b.approvedAt
            : b.approvedAt
            ? new Date(b.approvedAt).getTime()
            : b.submittedAt
            ? new Date(b.submittedAt).getTime()
            : 0;
        return timeB - timeA;
      });
    } else {
      list = sortProfilesAlphabetically(list);
    }

    if (adminStudentSearch.trim()) {
      const q = adminStudentSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q))
      );
    }
    return list;
  }, [approvedStudents, adminStudentSearch, studentSortMode]);

  // Count how many slots selected pending rows will consume
  const selectedPendingSlotsNeeded = useMemo(() => {
    return selectedPendingIds.reduce((acc, id) => {
      const st = pendingStudents.find((p) => p.id === id);
      if (!st) return acc;
      return acc + (isStudentSlotFree(st) ? 0 : 1);
    }, 0);
  }, [selectedPendingIds, pendingStudents]);

  // Single or Batch Approval Handler wired to Slot Ledger — Instant UI Update
  const handleApproveStudent = (studentId: string) => {
    const student = currentSet.students.find((s) => s.id === studentId);
    if (!student) return;

    const needsSlot = !isStudentSlotFree(student);
    if (needsSlot && slotBalance <= 0) {
      setIsBuySlotsModalOpen(true);
      return;
    }

    const nextBalance = Math.max(0, slotBalance - (needsSlot ? 1 : 0));
    const nextUsed = needsSlot ? totalSlotsUsed + 1 : totalSlotsUsed;
    const nextCredited = Math.max(totalSlotsCredited, nextBalance + nextUsed);
    setSlotBalance(nextBalance);
    setTotalSlotsUsed(nextUsed);
    setTotalSlotsCredited(nextCredited);
    if (needsSlot) {
      setSlotLedgerList((prev) => [
        {
          id: `ldg-approve-${student.id}-${Date.now()}`,
          entry_type: 'SLOT USED',
          sponsor_name: student.fullName,
          note: `Approved unpaid profile (${nextBalance} slots left)`,
          quantity: -1,
        },
        ...prev,
      ]);
    }

    const trimmedPos = student.position?.trim() || '';
    const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

    const approvedStudent: StudentProfile = {
      ...student,
      approved: true,
      status: 'approved',
      submissionStatus: 'approved',
      isProfileUpdate: false,
      approvedAt: Date.now(),
      usedSlot: needsSlot || Boolean(student.usedSlot),
      slotConsumed: needsSlot || Boolean(student.slotConsumed),
      leaderOrder:
        isLeader && !student.leaderOrder
          ? calculateIntuitiveHierarchyRank(trimmedPos)
          : student.leaderOrder,
    };

    const remainingStudents = currentSet.students.filter((s) => s.id !== studentId);
    const updatedStudents = [approvedStudent, ...remainingStudents];

    onUpdateSet({
      ...currentSet,
      profileSlotBalance: nextBalance,
      totalSlotsCredited: nextCredited,
      totalSlotsUsed: nextUsed,
      students: updatedStudents,
    });

    setSelectedPendingIds((prev) => prev.filter((id) => id !== studentId));
    if (inspectedProfileRow?.id === studentId) {
      setInspectedProfileRow(approvedStudent);
    }

    const slotMsg = needsSlot
      ? `1 slot used, ${nextBalance} left`
      : `Approved · 0 slots used, ${nextBalance} left`;
    setHierarchyToast(`✓ ${student.fullName} approved — ${slotMsg}`);
    setTimeout(() => setHierarchyToast(null), 4000);
    showSuccess('Classmate approved.', slotMsg);

    // Sync approval with server in the background without blocking UI
    approveAlbumSubmissionsOnServer(currentSet.id, [studentId]).catch(() => {});
  };

  // Batch Approve Selected Pending Profiles (Approves up to available slot balance) — Instant UI Update
  const handleApproveSelectedPending = () => {
    const targetIds = selectedPendingIds.length > 0 ? selectedPendingIds : pendingStudents.map((s) => s.id);
    if (targetIds.length === 0) return;

    let runningBalance = slotBalance;
    let slotsConsumedCount = 0;
    const now = Date.now();
    const approvedIdSet = new Set<string>();

    for (const id of targetIds) {
      const st = currentSet.students.find((s) => s.id === id);
      if (!st) continue;
      const needsSlot = !isStudentSlotFree(st);
      if (needsSlot && runningBalance <= 0) continue;
      if (needsSlot) {
        runningBalance -= 1;
        slotsConsumedCount += 1;
      }
      approvedIdSet.add(id);
    }

    if (approvedIdSet.size === 0) {
      setIsBuySlotsModalOpen(true);
      showWarning('Insufficient slots', 'Buy profile slots to approve unpaid student submissions.');
      return;
    }

    const nextUsed = totalSlotsUsed + slotsConsumedCount;
    const nextCredited = Math.max(totalSlotsCredited, runningBalance + nextUsed);
    setSlotBalance(runningBalance);
    setTotalSlotsUsed(nextUsed);
    setTotalSlotsCredited(nextCredited);

    const newlyApprovedList: StudentProfile[] = [];
    const unchangedStudents: StudentProfile[] = [];

    currentSet.students.forEach((s) => {
      if (approvedIdSet.has(s.id)) {
        const trimmedPos = s.position?.trim() || '';
        const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });
        const needsSlot = !isStudentSlotFree(s);
        newlyApprovedList.push({
          ...s,
          approved: true,
          status: 'approved',
          submissionStatus: 'approved',
          isProfileUpdate: false,
          approvedAt: now,
          usedSlot: needsSlot || Boolean(s.usedSlot),
          slotConsumed: needsSlot || Boolean(s.slotConsumed),
          leaderOrder:
            isLeader && !s.leaderOrder
              ? calculateIntuitiveHierarchyRank(trimmedPos)
              : s.leaderOrder,
        });
      } else {
        unchangedStudents.push(s);
      }
    });

    const updatedStudents = [...newlyApprovedList, ...unchangedStudents];
    onUpdateSet({
      ...currentSet,
      profileSlotBalance: runningBalance,
      totalSlotsCredited: nextCredited,
      totalSlotsUsed: nextUsed,
      students: updatedStudents,
    });

    setSelectedPendingIds((prev) => prev.filter((id) => !approvedIdSet.has(id)));
    const summaryMsg =
      slotsConsumedCount === 1
        ? `1 slot used, ${runningBalance} left`
        : `Approved ${approvedIdSet.size} of ${targetIds.length} selected (${slotsConsumedCount} slots used, ${runningBalance} left)`;
    setHierarchyToast(`✓ ${summaryMsg}`);
    setTimeout(() => setHierarchyToast(null), 4500);
    showSuccess(`Approved ${approvedIdSet.size} profile${approvedIdSet.size === 1 ? '' : 's'}`, summaryMsg);

    approveAlbumSubmissionsOnServer(currentSet.id, Array.from(approvedIdSet)).catch(() => {});
  };

  // Decline submission (returns +1 slot if previously approved with a slot) — Instant UI Update
  const handleDeclineSubmissionWithReason = (student: StudentProfile, reason: string) => {
    const trimmedReason = reason.trim() || 'Declined by admin';
    const wasApprovedWithSlot =
      getStudentEffectiveStatus(student) === 'approved' && Boolean(student.slotConsumed || student.usedSlot);
    const nextBalance = wasApprovedWithSlot ? slotBalance + 1 : slotBalance;
    setSlotBalance(nextBalance);

    const nowIso = new Date().toISOString();
    const updatedStudent: StudentProfile = {
      ...student,
      approved: false,
      status: 'declined',
      submissionStatus: 'declined',
      declineReason: trimmedReason,
      declinedAt: nowIso,
      usedSlot: false,
      slotConsumed: false,
    };

    const updatedStudents = currentSet.students.map((s) =>
      s.id === student.id ? updatedStudent : s
    );
    onUpdateSet({
      ...currentSet,
      profileSlotBalance: nextBalance,
      students: updatedStudents,
    });
    if (inspectedProfileRow?.id === student.id) {
      setInspectedProfileRow(updatedStudent);
    }
    setBottomSheetActionMode('none');
    setBottomSheetReasonInput('');
    showWarning(
      'Profile Declined',
      wasApprovedWithSlot
        ? `Declined ${student.fullName}. 1 slot was returned to your balance (${nextBalance} left). Can be recovered within 7 days under Declined / Deleted.`
        : `Declined ${student.fullName}. Can be recovered within 7 days under Declined / Deleted.`
    );

    declineAlbumSubmissionOnServer(currentSet.id, student.id, trimmedReason).catch(() => {});
  };

  // Confirm before declining a profile
  const handlePromptDeclineStudent = (student: StudentProfile, reason?: string) => {
    confirmWarning({
      title: 'Decline Classmate Profile?',
      message: `Are you sure you want to decline "${student.fullName}"? It can be recovered within 7 days under Declined / Deleted before automatic deletion.`,
      confirmLabel: 'Decline Profile',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        handleDeclineSubmissionWithReason(student, reason || 'Declined by admin');
      },
    });
  };

  // Request changes with note (student edits via status link)
  const handleRequestChangesOnSubmission = (student: StudentProfile, note: string) => {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      showError('Note Required', 'Please specify what changes the student should make.');
      return;
    }
    const updatedStudent: StudentProfile = {
      ...student,
      approved: false,
      status: 'changes_requested',
      submissionStatus: 'changes_requested',
      changesRequestedNote: trimmedNote,
      changesRequestedAt: new Date().toISOString(),
    };
    const updatedStudents = currentSet.students.map((s) =>
      s.id === student.id ? updatedStudent : s
    );
    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });
    setInspectedProfileRow(updatedStudent);
    setBottomSheetActionMode('none');
    setBottomSheetReasonInput('');
    showSuccess('Changes Requested', `Sent change request note for ${student.fullName}.`);
    requestChangesAlbumSubmissionOnServer(currentSet.id, student.id, trimmedNote).catch(() => {});
  };

  // Recover a declined profile back to Pending — Instant UI Update
  const handleReinstateSubmission = (student: StudentProfile) => {
    const updatedStudent: StudentProfile = {
      ...student,
      approved: false,
      status: 'pending',
      submissionStatus: 'pending',
      declineReason: undefined,
    };
    const updatedStudents = currentSet.students.map((s) =>
      s.id === student.id ? updatedStudent : s
    );
    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });
    setInspectedProfileRow(updatedStudent);
    showSuccess('Profile Recovered', `${student.fullName} has been moved back to Pending.`);
    reinstateAlbumSubmissionOnServer(currentSet.id, student.id).catch(() => {});
  };

  // Soft-delete / move a profile to Declined / Deleted (recoverable later; does NOT return any used slot)
  const handleRemoveSubmissionNoSlotReturn = (student: StudentProfile) => {
    confirmWarning({
      title: 'Delete Classmate Profile?',
      message: `Are you sure you want to delete "${student.fullName}"? It will be moved to Declined / Deleted where you can restore or permanently delete it.`,
      confirmLabel: 'Delete Profile',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const wasApproved = getStudentEffectiveStatus(student) === 'approved';
        const updatedStudents = currentSet.students.map((s) =>
          s.id === student.id
            ? ({
                ...s,
                approved: false,
                status: 'removed',
                submissionStatus: 'removed',
                previousApproved: wasApproved,
              } as StudentProfile)
            : s
        );
        onUpdateSet({
          ...currentSet,
          students: updatedStudents,
        });
        setInspectedProfileRow(null);
        showWarning(
          'Moved to Declined / Deleted',
          `${student.fullName} was moved to Declined / Deleted and can be restored or permanently deleted.`
        );
        removeAlbumSubmissionOnServer(currentSet.id, student.id).catch(() => {});
      },
    });
  };

  // Restore a soft-deleted or rejected profile back to the roster — Instant UI Update
  const handleRestoreDeletedOrRejectedStudent = (student: StudentProfile) => {
    const restoreToApproved = Boolean((student as any).previousApproved);
    const updatedStudent: StudentProfile = {
      ...student,
      approved: restoreToApproved,
      status: restoreToApproved ? 'approved' : 'pending',
      submissionStatus: restoreToApproved ? 'approved' : 'pending',
      declineReason: undefined,
    };
    const updatedStudents = currentSet.students.map((s) =>
      s.id === student.id ? updatedStudent : s
    );
    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });
    if (inspectedProfileRow?.id === student.id) {
      setInspectedProfileRow(updatedStudent);
    }
    setHierarchyToast(
      `✓ Restored ${student.fullName} to ${restoreToApproved ? 'Approved Profiles' : 'Pending'}!`
    );
    setTimeout(() => setHierarchyToast(null), 3500);
    showSuccess(
      'Profile Restored',
      `${student.fullName} has been recovered to ${restoreToApproved ? 'All Profiles' : 'Pending'}.`
    );
    reinstateAlbumSubmissionOnServer(currentSet.id, student.id).catch(() => {});
  };

  // Permanently delete a profile (only from inside Deleted / Rejected filter clip)
  const handlePermanentDeleteStudent = (id: string) => {
    const student = currentSet.students.find((s) => s.id === id);
    confirmWarning({
      title: 'Delete Profile Permanently?',
      message: `Are you sure you want to permanently delete "${student?.fullName || 'this profile'}"? This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      cancelLabel: 'Keep',
      isDestructive: true,
      onConfirm: () => {
        const updated = {
          ...currentSet,
          students: currentSet.students.filter((s) => s.id !== id),
        };
        onUpdateSet(updated);
        if (inspectedProfileRow?.id === id) {
          setInspectedProfileRow(null);
        }
        apiClientDeleteProfile(currentSet.id, id);
        showWarning('Permanently Deleted', `${student?.fullName || 'Profile'} was permanently removed.`);
      },
    });
  };

  const [isSlotPaystackOpen, setIsSlotPaystackOpen] = useState(false);

  // Purchase Profile Slots Handler — opens real Paystack checkout
  const handlePurchaseSlotsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseInt(buySlotsInput, 10);
    const finalQty = !isNaN(parsedQty) && parsedQty >= 1 ? Math.min(1000, parsedQty) : Math.max(1, buySlotsCount);
    setBuySlotsCount(finalQty);
    setBuySlotsInput(String(finalQty));
    setIsBuySlotsModalOpen(false);
    setIsSlotPaystackOpen(true);
  };

  const handleSlotPaystackVerified = async () => {
    setIsBuyingSlots(true);
    try {
      const balRes = await fetchAlbumSlotBalanceOnServer(currentSet.id);
      if (balRes.success) {
        const nextUsed = typeof balRes.totalUsed === 'number' ? balRes.totalUsed : totalSlotsUsed;
        const nextCredited = typeof balRes.totalCredited === 'number' ? balRes.totalCredited : totalSlotsCredited + buySlotsCount;
        const nextBal = typeof balRes.balance === 'number' ? balRes.balance : Math.max(0, nextCredited - nextUsed);
        setSlotBalance(nextBal);
        setTotalSlotsCredited(nextCredited);
        setTotalSlotsUsed(nextUsed);
        if (Array.isArray(balRes.purchases)) setSlotPurchasesList(balRes.purchases);
        if (Array.isArray(balRes.ledger)) setSlotLedgerList(balRes.ledger);
        onUpdateSet({
          ...currentSet,
          profileSlotBalance: nextBal,
          totalSlotsCredited: nextCredited,
          totalSlotsUsed: nextUsed,
        });
        showSuccess('Slots Credited', `Verified ${buySlotsCount} profile slots. Available balance: ${nextBal}.`);
      }
      setBuySlotsSponsorName('');
      setTimeout(() => setIsSlotPaystackOpen(false), 800);
    } finally {
      setIsBuyingSlots(false);
    }
  };

  // Sponsor Display Edit Handler (Rule 6: Never changes amount, quantity, reference, slots used, or balance, and blocks KoHot credit edit)
  const handleSaveSponsorEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSponsorItem) return;
    if (editingSponsorItem.is_kohot_credit || editingSponsorItem.isKoHotCredit) {
      showError('Protected Credit', 'KoHot slot credits cannot be renamed or removed.');
      return;
    }
    const trimmedName = editSponsorNameText.trim();
    if (!trimmedName) {
      showError('Sponsor Name Required', 'Please enter a display name for the sponsor.');
      return;
    }

    // Update local state immediately so both demo and live sets respond instantly
    const updatedPurchases = slotPurchasesList.map((p) =>
      p.id === editingSponsorItem.id
        ? {
            ...p,
            sponsor_name: trimmedName,
            sponsorName: trimmedName,
            show_sponsor_on_album: editSponsorVisibleToggle ? 1 : 0,
            showSponsorOnAlbum: editSponsorVisibleToggle,
            showSponsorNameOnAlbum: editSponsorVisibleToggle,
          }
        : p
    );
    setSlotPurchasesList(updatedPurchases);
    setSlotLedgerList((prev) =>
      prev.map((entry) =>
        entry.id === `ldg-credit-${editingSponsorItem.id}`
          ? { ...entry, sponsor_name: trimmedName }
          : entry
      )
    );
    onUpdateSet({
      ...currentSet,
      sponsors: updatedPurchases,
    });
    setEditingSponsorItem(null);
    showSuccess('Sponsor Updated', 'Sponsor display updated (quantities and balances remain untouched).');

    // Sync with server in background if applicable
    updateAlbumSponsorOnServer(currentSet.id, {
      id: editingSponsorItem.id,
      sponsorName: trimmedName,
    }).catch(() => {});
  };

  // Move Leader Up or Down in Hierarchy
  const handleMoveLeader = (studentId: string, direction: 'up' | 'down') => {
    const currentIndex = adminLeaders.findIndex((s) => s.id === studentId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= adminLeaders.length) return;

    handleReorderLeaders(currentIndex, targetIndex);
  };

  // Hold & Drag-and-Drop reorder for Leaders Hierarchy
  const handleReorderLeaders = (fromIndex: number, toIndex: number, showToast = true) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= adminLeaders.length || toIndex < 0 || toIndex >= adminLeaders.length) return;

    const targetLeader = adminLeaders[fromIndex];
    const reordered = reorderLeadersHierarchy(adminLeaders, fromIndex, toIndex);

    const leaderOrderMap = new Map<string, number>();
    reordered.forEach((l, idx) => {
      leaderOrderMap.set(l.id, idx + 1);
    });

    const updatedStudents = currentSet.students.map((s) => {
      if (leaderOrderMap.has(s.id)) {
        return { ...s, leaderOrder: leaderOrderMap.get(s.id) };
      }
      return s;
    });

    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });

    if (showToast) {
      setHierarchyToast(`✓ Hierarchy updated: ${targetLeader.fullName} is now Rank #${toIndex + 1}.`);
      setTimeout(() => setHierarchyToast(null), 2500);
    }
  };

  // Hold & Drag-and-Drop reorder for Awards Hierarchy
  const handleReorderAwards = (fromIndex: number, toIndex: number, showToast = true) => {
    if (fromIndex === toIndex) return;
    const list = [...currentSet.awards];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    onUpdateSet({
      ...currentSet,
      awards: list,
    });
    if (showToast) {
      setHierarchyToast(`✓ Rearranged "${moved.category}" to position #${toIndex + 1}.`);
      setTimeout(() => setHierarchyToast(null), 2500);
    }
  };

  // Hold & Drag-and-Drop reorder for Video Highlights
  const handleReorderVideos = (fromIndex: number, toIndex: number, showToast = true) => {
    if (fromIndex === toIndex) return;
    const list = [...videos];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    setVideos(list);
    onUpdateSet({
      ...currentSet,
      videos: list,
    });
    if (showToast && moved) {
      setHierarchyToast(`✓ Rearranged "${moved.title}" to position #${toIndex + 1}.`);
      setTimeout(() => setHierarchyToast(null), 2500);
    }
  };

  // Reset to intuitive leadership hierarchy ranking
  const handleResetToIntuitiveHierarchy = () => {
    const updatedStudents = autoApplyIntuitiveOrder(currentSet.students);
    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });
    setHierarchyToast('Executive hierarchy intuitively reorganized by title (President, Class Album Admin, Executives).');
    setTimeout(() => setHierarchyToast(null), 3500);
  };

  // Add Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNickname, setNewStudentNickname] = useState('');
  const [newStudentPosition, setNewStudentPosition] = useState('');
  const [newStudentQuote, setNewStudentQuote] = useState('');
  const [newStudentBio, setNewStudentBio] = useState('');
  const [newStudentFavouriteMemory, setNewStudentFavouriteMemory] = useState('');
  const [newStudentFunFact, setNewStudentFunFact] = useState('');
  const [newStudentWhatsNext, setNewStudentWhatsNext] = useState('');
  const [newStudentMessageToClassmates, setNewStudentMessageToClassmates] = useState('');
  const [newStudentMessageToFutureSet, setNewStudentMessageToFutureSet] = useState('');
  const [newStudentPhotoUrl, setNewStudentPhotoUrl] = useState('');
  const [newStudentCompression, setNewStudentCompression] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollClipIntoView = (el: HTMLElement | null) => {
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } catch {
      // Fallback
    }
  };

  // Moments Capacity & Batch Upload State
  const totalMomentImages = useMemo(() => {
    return currentSet.memories.reduce((acc, m) => acc + m.images.length, 0);
  }, [currentSet.memories]);

  // Sorted memories by batch hierarchy order
  const sortedMemories = useMemo(() => {
    return [...currentSet.memories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [currentSet.memories]);

  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const [batchTitle, setBatchTitle] = useState('');
  const [batchCategory, setBatchCategory] = useState('Dinner & Awards');
  const [batchDate, setBatchDate] = useState('');
  const [batchDay, setBatchDay] = useState<number | ''>('');
  const [isBatchDayUnknown, setIsBatchDayUnknown] = useState<boolean>(false);
  const [batchMonth, setBatchMonth] = useState<number>(10);
  const [batchYear, setBatchYear] = useState<number>(currentSet.graduationYear || 2026);
  const [isConvocationBatchToggle, setIsConvocationBatchToggle] = useState<boolean>(false);
  const [batchCaption, setBatchCaption] = useState('');
  const [batchImages, setBatchImages] = useState<Array<{ id: string; url: string; caption: string }>>([]);
  const [batchImageInputUrl, setBatchImageInputUrl] = useState('');
  const [isCompressingBatch, setIsCompressingBatch] = useState(false);
  const [isScanningMetadata, setIsScanningMetadata] = useState(false);
  const [activeAppendBatchId, setActiveAppendBatchId] = useState<string | null>(null);
  const [isConvocationReminderModalOpen, setIsConvocationReminderModalOpen] = useState(false);
  const [extractedDateResult, setExtractedDateResult] = useState<ExtractedDateResult | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible categories state (Categories in Moments section)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Target for replacing an image in a category
  const [replacingTarget, setReplacingTarget] = useState<{ categoryId: string; imageIndex: number } | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);

  // Target and text for editing an image caption in a category
  const [editingCaptionTarget, setEditingCaptionTarget] = useState<{ categoryId: string; imageIndex: number } | null>(null);
  const [editingCaptionText, setEditingCaptionText] = useState<string>('');

  // Award Form State
  const [isAddingAward, setIsAddingAward] = useState(false);
  const [editingAwardId, setEditingAwardId] = useState<string | null>(null);
  const [awardCategory, setAwardCategory] = useState('');
  const [awardWinnerName, setAwardWinnerName] = useState('');
  const [awardWinnerNickname, setAwardWinnerNickname] = useState('');
  const [awardAvatar, setAwardAvatar] = useState('');
  const [awardCitation, setAwardCitation] = useState('');
  const [awardTrophyType, setAwardTrophyType] = useState<string>('gold');
  const [selectedAwardStudentId, setSelectedAwardStudentId] = useState<string>('');
  const [isAwardPickerOpen, setIsAwardPickerOpen] = useState(false);
  const awardPhotoInputRef = useRef<HTMLInputElement>(null);

  // Voice Form State
  const [isAddingVoice, setIsAddingVoice] = useState(false);
  const [voiceLecturerName, setVoiceLecturerName] = useState('');
  const [voiceTitle, setVoiceTitle] = useState('');
  const [voiceHeadshotUrl, setVoiceHeadshotUrl] = useState('');
  const [voicePartingQuote, setVoicePartingQuote] = useState('');
  const [voiceIsPinned, setVoiceIsPinned] = useState(false);
  const [voicePinnedTitle, setVoicePinnedTitle] = useState('From the President');
  const [selectedVoiceStudentId, setSelectedVoiceStudentId] = useState<string>('');
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const voicePhotoInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Edit Modals for Moments, Awards, and Voices to eliminate scrolling
  const [editingMomentBatchModal, setEditingMomentBatchModal] = useState<MemoryEvent | null>(null);
  const [batchMorePhotosUrl, setBatchMorePhotosUrl] = useState<string>('');
  const [draggedMomentPhotoIndex, setDraggedMomentPhotoIndex] = useState<number | null>(null);
  const [dragOverMomentPhotoIndex, setDragOverMomentPhotoIndex] = useState<number | null>(null);
  const [draggedDraftPhotoIndex, setDraggedDraftPhotoIndex] = useState<number | null>(null);
  const [dragOverDraftPhotoIndex, setDragOverDraftPhotoIndex] = useState<number | null>(null);
  const [draggedBatchIndex, setDraggedBatchIndex] = useState<number | null>(null);
  const [dragOverBatchIndex, setDragOverBatchIndex] = useState<number | null>(null);
  const [draggedLeaderIndex, setDraggedLeaderIndex] = useState<number | null>(null);
  const [dragOverLeaderIndex, setDragOverLeaderIndex] = useState<number | null>(null);
  const [draggedAwardIndex, setDraggedAwardIndex] = useState<number | null>(null);
  const [dragOverAwardIndex, setDragOverAwardIndex] = useState<number | null>(null);
  const [draggedVideoIndex, setDraggedVideoIndex] = useState<number | null>(null);
  const [dragOverVideoIndex, setDragOverVideoIndex] = useState<number | null>(null);
  const activeLeaderDragIdxRef = useRef<number | null>(null);
  const activeLeaderTargetIdxRef = useRef<number | null>(null);
  const leaderHoldTimerRef = useRef<number | null>(null);
  const leaderTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const leaderLastSwapTimeRef = useRef<number>(0);
  const leaderDidDragRef = useRef<boolean>(false);
  const activeAwardDragIdxRef = useRef<number | null>(null);
  const activeAwardTargetIdxRef = useRef<number | null>(null);
  const awardHoldTimerRef = useRef<number | null>(null);
  const awardTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const awardLastSwapTimeRef = useRef<number>(0);
  const awardDidDragRef = useRef<boolean>(false);
  const activeBatchDragIdxRef = useRef<number | null>(null);
  const activeBatchTargetIdxRef = useRef<number | null>(null);
  const batchHoldTimerRef = useRef<number | null>(null);
  const batchTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const batchLastSwapTimeRef = useRef<number>(0);
  const batchDidDragRef = useRef<boolean>(false);
  const activeVideoDragIdxRef = useRef<number | null>(null);
  const activeVideoTargetIdxRef = useRef<number | null>(null);
  const videoHoldTimerRef = useRef<number | null>(null);
  const videoTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const videoLastSwapTimeRef = useRef<number>(0);
  const videoDidDragRef = useRef<boolean>(false);

  const commitLeaderDrop = (fallbackTargetIdx?: number) => {
    const fromIdx = activeLeaderDragIdxRef.current;
    const toIdx =
      typeof fallbackTargetIdx === 'number'
        ? fallbackTargetIdx
        : activeLeaderTargetIdxRef.current;
    activeLeaderDragIdxRef.current = null;
    activeLeaderTargetIdxRef.current = null;
    leaderTouchStartPosRef.current = null;
    if (leaderHoldTimerRef.current) {
      window.clearTimeout(leaderHoldTimerRef.current);
      leaderHoldTimerRef.current = null;
    }
    setDraggedLeaderIndex(null);
    setDragOverLeaderIndex(null);
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      handleReorderLeaders(fromIdx, toIdx, true);
    } else if (fromIdx !== null) {
      const movedLeader = adminLeaders[fromIdx];
      if (movedLeader) {
        setHierarchyToast(`✓ Hierarchy updated: ${movedLeader.fullName} is now Rank #${fromIdx + 1}.`);
        setTimeout(() => setHierarchyToast(null), 2500);
      }
    }
    setTimeout(() => {
      leaderDidDragRef.current = false;
    }, 120);
  };

  const commitAwardDrop = (fallbackTargetIdx?: number) => {
    const fromIdx = activeAwardDragIdxRef.current;
    const toIdx =
      typeof fallbackTargetIdx === 'number'
        ? fallbackTargetIdx
        : activeAwardTargetIdxRef.current;
    activeAwardDragIdxRef.current = null;
    activeAwardTargetIdxRef.current = null;
    awardTouchStartPosRef.current = null;
    if (awardHoldTimerRef.current) {
      window.clearTimeout(awardHoldTimerRef.current);
      awardHoldTimerRef.current = null;
    }
    setDraggedAwardIndex(null);
    setDragOverAwardIndex(null);
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      handleReorderAwards(fromIdx, toIdx, true);
    } else if (fromIdx !== null) {
      const movedAward = currentSet.awards[fromIdx];
      if (movedAward) {
        setHierarchyToast(`✓ Rearranged "${movedAward.category}" to position #${fromIdx + 1}.`);
        setTimeout(() => setHierarchyToast(null), 2500);
      }
    }
    setTimeout(() => {
      awardDidDragRef.current = false;
    }, 120);
  };

  const commitBatchDrop = (fallbackTargetIdx?: number) => {
    const fromIdx = activeBatchDragIdxRef.current;
    const toIdx =
      typeof fallbackTargetIdx === 'number'
        ? fallbackTargetIdx
        : activeBatchTargetIdxRef.current;
    activeBatchDragIdxRef.current = null;
    activeBatchTargetIdxRef.current = null;
    batchTouchStartPosRef.current = null;
    if (batchHoldTimerRef.current) {
      window.clearTimeout(batchHoldTimerRef.current);
      batchHoldTimerRef.current = null;
    }
    setDraggedBatchIndex(null);
    setDragOverBatchIndex(null);
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      handleReorderMomentBatches(fromIdx, toIdx, true);
    } else if (fromIdx !== null) {
      const movedBatch = currentSet.memories[fromIdx];
      if (movedBatch) {
        setHierarchyToast(`✓ Rearranged "${movedBatch.title}" to position #${fromIdx + 1}.`);
        setTimeout(() => setHierarchyToast(null), 2500);
      }
    }
    setTimeout(() => {
      batchDidDragRef.current = false;
    }, 120);
  };

  const commitVideoDrop = (fallbackTargetIdx?: number) => {
    const fromIdx = activeVideoDragIdxRef.current;
    const toIdx =
      typeof fallbackTargetIdx === 'number'
        ? fallbackTargetIdx
        : activeVideoTargetIdxRef.current;
    activeVideoDragIdxRef.current = null;
    activeVideoTargetIdxRef.current = null;
    videoTouchStartPosRef.current = null;
    if (videoHoldTimerRef.current) {
      window.clearTimeout(videoHoldTimerRef.current);
      videoHoldTimerRef.current = null;
    }
    setDraggedVideoIndex(null);
    setDragOverVideoIndex(null);
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      handleReorderVideos(fromIdx, toIdx, true);
    } else if (fromIdx !== null) {
      const movedVid = videos[fromIdx];
      if (movedVid) {
        setHierarchyToast(`✓ Rearranged "${movedVid.title}" to position #${fromIdx + 1}.`);
        setTimeout(() => setHierarchyToast(null), 2500);
      }
    }
    setTimeout(() => {
      videoDidDragRef.current = false;
    }, 120);
  };

  const activeDraftPhotoDragIdxRef = useRef<number | null>(null);
  const draftPhotoHoldTimerRef = useRef<number | null>(null);
  const draftPhotoTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const draftPhotoLastSwapTimeRef = useRef<number>(0);

  const activeEditPhotoDragIdxRef = useRef<number | null>(null);
  const editPhotoHoldTimerRef = useRef<number | null>(null);
  const editPhotoTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const editPhotoLastSwapTimeRef = useRef<number>(0);

  const reorderLeadersLatestRef = useRef(handleReorderLeaders);
  reorderLeadersLatestRef.current = handleReorderLeaders;
  const reorderAwardsLatestRef = useRef(handleReorderAwards);
  reorderAwardsLatestRef.current = handleReorderAwards;
  const reorderVideosLatestRef = useRef(handleReorderVideos);
  reorderVideosLatestRef.current = handleReorderVideos;
  const reorderBatchesLatestRef = useRef<(fromIndex: number, toIndex: number, showNotification?: boolean) => void>(() => {});
  const reorderDraftPhotosLatestRef = useRef<(fromIndex: number, toIndex: number) => void>(() => {});
  const reorderEditPhotosLatestRef = useRef<(fromIndex: number, toIndex: number) => void>(() => {});
  const commitLeaderDropLatestRef = useRef(commitLeaderDrop);
  commitLeaderDropLatestRef.current = commitLeaderDrop;
  const commitAwardDropLatestRef = useRef(commitAwardDrop);
  commitAwardDropLatestRef.current = commitAwardDrop;
  const commitBatchDropLatestRef = useRef(commitBatchDrop);
  commitBatchDropLatestRef.current = commitBatchDrop;
  const commitVideoDropLatestRef = useRef(commitVideoDrop);
  commitVideoDropLatestRef.current = commitVideoDrop;

  // Global window pointer/touch/mouse tracking so dragging never loses focus or gets cancelled when DOM nodes reorder
  useEffect(() => {
    let lastDragPointer: { x: number; y: number } | null = null;
    let autoScrollRafId: number | null = null;

    const isAnyDragActive = () =>
      activeDraftPhotoDragIdxRef.current !== null ||
      activeEditPhotoDragIdxRef.current !== null ||
      activeLeaderDragIdxRef.current !== null ||
      activeAwardDragIdxRef.current !== null ||
      activeBatchDragIdxRef.current !== null ||
      activeVideoDragIdxRef.current !== null;

    const handleMoveCoordinates = (clientX: number, clientY: number, rawEvent?: Event) => {
      if (isAnyDragActive()) {
        lastDragPointer = { x: clientX, y: clientY };
        if (autoScrollRafId === null) {
          autoScrollRafId = window.requestAnimationFrame(runAutoScrollLoop);
        }
      }

      // Check Draft Moment Photo Hold & Drag
      const currentDraftPhotoIdx = activeDraftPhotoDragIdxRef.current;
      if (currentDraftPhotoIdx !== null) {
        if (rawEvent && rawEvent.cancelable) rawEvent.preventDefault();
        const targetEl = document
          .elementFromPoint(clientX, clientY)
          ?.closest('[data-draft-moment-photo-idx]') as HTMLElement | null;
        if (targetEl) {
          const targetIdx = parseInt(targetEl.getAttribute('data-draft-moment-photo-idx') || '-1', 10);
          if (!isNaN(targetIdx) && targetIdx >= 0) {
            setDragOverDraftPhotoIndex(targetIdx);
            if (targetIdx !== currentDraftPhotoIdx && Date.now() - draftPhotoLastSwapTimeRef.current > 85) {
              draftPhotoLastSwapTimeRef.current = Date.now();
              activeDraftPhotoDragIdxRef.current = targetIdx;
              setDraggedDraftPhotoIndex(targetIdx);
              setDragOverDraftPhotoIndex(targetIdx);
              reorderDraftPhotosLatestRef.current(currentDraftPhotoIdx, targetIdx);
            }
          }
        }
        return;
      }

      // Check Edit Moment Photo Hold & Drag
      const currentEditPhotoIdx = activeEditPhotoDragIdxRef.current;
      if (currentEditPhotoIdx !== null) {
        if (rawEvent && rawEvent.cancelable) rawEvent.preventDefault();
        const targetEl = document
          .elementFromPoint(clientX, clientY)
          ?.closest('[data-edit-moment-photo-idx]') as HTMLElement | null;
        if (targetEl) {
          const targetIdx = parseInt(targetEl.getAttribute('data-edit-moment-photo-idx') || '-1', 10);
          if (!isNaN(targetIdx) && targetIdx >= 0) {
            setDragOverMomentPhotoIndex(targetIdx);
            if (targetIdx !== currentEditPhotoIdx && Date.now() - editPhotoLastSwapTimeRef.current > 85) {
              editPhotoLastSwapTimeRef.current = Date.now();
              activeEditPhotoDragIdxRef.current = targetIdx;
              setDraggedMomentPhotoIndex(targetIdx);
              setDragOverMomentPhotoIndex(targetIdx);
              reorderEditPhotosLatestRef.current(currentEditPhotoIdx, targetIdx);
            }
          }
        }
        return;
      }

      // Check Leader Hold & Drag
      const currentLeaderIdx = activeLeaderDragIdxRef.current;
      if (currentLeaderIdx !== null) {
        if (rawEvent && rawEvent.cancelable) rawEvent.preventDefault();
        const targetEl = document
          .elementFromPoint(clientX, clientY)
          ?.closest('[data-leader-row-idx]') as HTMLElement | null;
        if (targetEl) {
          const targetIdx = parseInt(targetEl.getAttribute('data-leader-row-idx') || '-1', 10);
          if (!isNaN(targetIdx) && targetIdx >= 0) {
            activeLeaderTargetIdxRef.current = targetIdx;
            setDragOverLeaderIndex(targetIdx);
            if (targetIdx !== currentLeaderIdx && Date.now() - leaderLastSwapTimeRef.current > 85) {
              const rect = targetEl.getBoundingClientRect();
              const crossed =
                (currentLeaderIdx < targetIdx && clientY >= rect.top + rect.height * 0.2) ||
                (currentLeaderIdx > targetIdx && clientY <= rect.bottom - rect.height * 0.2);
              if (crossed) {
                leaderLastSwapTimeRef.current = Date.now();
                activeLeaderDragIdxRef.current = targetIdx;
                activeLeaderTargetIdxRef.current = targetIdx;
                setDraggedLeaderIndex(targetIdx);
                setDragOverLeaderIndex(targetIdx);
                reorderLeadersLatestRef.current(currentLeaderIdx, targetIdx, false);
              }
            }
          }
        }
        return;
      }

      // Check Award Hold & Drag
      const currentAwardIdx = activeAwardDragIdxRef.current;
      if (currentAwardIdx !== null) {
        if (rawEvent && rawEvent.cancelable) rawEvent.preventDefault();
        const targetEl = document
          .elementFromPoint(clientX, clientY)
          ?.closest('[data-award-card-idx]') as HTMLElement | null;
        if (targetEl) {
          const targetIdx = parseInt(targetEl.getAttribute('data-award-card-idx') || '-1', 10);
          if (!isNaN(targetIdx) && targetIdx >= 0) {
            activeAwardTargetIdxRef.current = targetIdx;
            setDragOverAwardIndex(targetIdx);
            if (targetIdx !== currentAwardIdx && Date.now() - awardLastSwapTimeRef.current > 85) {
              const rect = targetEl.getBoundingClientRect();
              const crossed =
                (currentAwardIdx < targetIdx && clientY >= rect.top + rect.height * 0.2) ||
                (currentAwardIdx > targetIdx && clientY <= rect.bottom - rect.height * 0.2);
              if (crossed) {
                awardLastSwapTimeRef.current = Date.now();
                activeAwardDragIdxRef.current = targetIdx;
                activeAwardTargetIdxRef.current = targetIdx;
                setDraggedAwardIndex(targetIdx);
                setDragOverAwardIndex(targetIdx);
                reorderAwardsLatestRef.current(currentAwardIdx, targetIdx, false);
              }
            }
          }
        }
        return;
      }

      // Check Moment Category Hold & Drag
      const currentBatchIdx = activeBatchDragIdxRef.current;
      if (currentBatchIdx !== null) {
        if (rawEvent && rawEvent.cancelable) rawEvent.preventDefault();
        const targetEl = document
          .elementFromPoint(clientX, clientY)
          ?.closest('[data-moment-batch-idx]') as HTMLElement | null;
        if (targetEl) {
          const targetIdx = parseInt(targetEl.getAttribute('data-moment-batch-idx') || '-1', 10);
          if (!isNaN(targetIdx) && targetIdx >= 0) {
            activeBatchTargetIdxRef.current = targetIdx;
            setDragOverBatchIndex(targetIdx);
            if (targetIdx !== currentBatchIdx && Date.now() - batchLastSwapTimeRef.current > 85) {
              const rect = targetEl.getBoundingClientRect();
              const crossed =
                (currentBatchIdx < targetIdx && clientY >= rect.top + rect.height * 0.2) ||
                (currentBatchIdx > targetIdx && clientY <= rect.bottom - rect.height * 0.2);
              if (crossed) {
                batchLastSwapTimeRef.current = Date.now();
                activeBatchDragIdxRef.current = targetIdx;
                activeBatchTargetIdxRef.current = targetIdx;
                setDraggedBatchIndex(targetIdx);
                setDragOverBatchIndex(targetIdx);
                reorderBatchesLatestRef.current(currentBatchIdx, targetIdx, false);
              }
            }
          }
        }
        return;
      }

      // Check Video Highlight Hold & Drag
      const currentVideoIdx = activeVideoDragIdxRef.current;
      if (currentVideoIdx !== null) {
        if (rawEvent && rawEvent.cancelable) rawEvent.preventDefault();
        const targetEl = document
          .elementFromPoint(clientX, clientY)
          ?.closest('[data-video-card-idx]') as HTMLElement | null;
        if (targetEl) {
          const targetIdx = parseInt(targetEl.getAttribute('data-video-card-idx') || '-1', 10);
          if (!isNaN(targetIdx) && targetIdx >= 0) {
            activeVideoTargetIdxRef.current = targetIdx;
            setDragOverVideoIndex(targetIdx);
            if (targetIdx !== currentVideoIdx && Date.now() - videoLastSwapTimeRef.current > 85) {
              const rect = targetEl.getBoundingClientRect();
              const crossed =
                (currentVideoIdx < targetIdx && clientY >= rect.top + rect.height * 0.2) ||
                (currentVideoIdx > targetIdx && clientY <= rect.bottom - rect.height * 0.2);
              if (crossed) {
                videoLastSwapTimeRef.current = Date.now();
                activeVideoDragIdxRef.current = targetIdx;
                activeVideoTargetIdxRef.current = targetIdx;
                setDraggedVideoIndex(targetIdx);
                setDragOverVideoIndex(targetIdx);
                reorderVideosLatestRef.current(currentVideoIdx, targetIdx, false);
              }
            }
          }
        }
      }
    };

    const runAutoScrollLoop = () => {
      if (!isAnyDragActive() || !lastDragPointer) {
        autoScrollRafId = null;
        return;
      }

      const { x, y } = lastDragPointer;
      const vh = window.innerHeight;
      let didScroll = false;

      // 1. Check if dragging inside a scrollable modal container (e.g. photo grid in category modal)
      if (activeDraftPhotoDragIdxRef.current !== null || activeEditPhotoDragIdxRef.current !== null) {
        const attrSelector =
          activeDraftPhotoDragIdxRef.current !== null
            ? '[data-draft-moment-photo-idx]'
            : '[data-edit-moment-photo-idx]';
        const sampleItem = document.querySelector(attrSelector) as HTMLElement | null;
        const scrollParent = sampleItem?.closest('.overflow-y-auto') as HTMLElement | null;
        if (scrollParent) {
          const rect = scrollParent.getBoundingClientRect();
          const edgeThreshold = 75;
          if (y < rect.top + edgeThreshold) {
            const intensity = Math.max(0.25, Math.min(1, (rect.top + edgeThreshold - y) / edgeThreshold));
            scrollParent.scrollTop -= Math.ceil(12 * intensity);
            didScroll = true;
          } else if (y > rect.bottom - edgeThreshold) {
            const intensity = Math.max(0.25, Math.min(1, (y - (rect.bottom - edgeThreshold)) / edgeThreshold));
            scrollParent.scrollTop += Math.ceil(12 * intensity);
            didScroll = true;
          }
        }
      }

      // 2. Check viewport top / bottom edges for page-level lists (Leaders, Moments Categories, Awards)
      const topThreshold = 185; // account for sticky top bar & section clips
      const bottomThreshold = 135;
      if (y < topThreshold) {
        const intensity = Math.max(0.25, Math.min(1, (topThreshold - y) / topThreshold));
        window.scrollBy(0, -Math.ceil(14 * intensity));
        didScroll = true;
      } else if (y > vh - bottomThreshold) {
        const intensity = Math.max(0.25, Math.min(1, (y - (vh - bottomThreshold)) / bottomThreshold));
        window.scrollBy(0, Math.ceil(14 * intensity));
        didScroll = true;
      }

      if (didScroll) {
        handleMoveCoordinates(x, y);
      }

      autoScrollRafId = window.requestAnimationFrame(runAutoScrollLoop);
    };

    const onWindowTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (activeDraftPhotoDragIdxRef.current === null && draftPhotoTouchStartPosRef.current) {
        const dx = touch.clientX - draftPhotoTouchStartPosRef.current.x;
        const dy = touch.clientY - draftPhotoTouchStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 14 && draftPhotoHoldTimerRef.current) {
          window.clearTimeout(draftPhotoHoldTimerRef.current);
          draftPhotoHoldTimerRef.current = null;
          draftPhotoTouchStartPosRef.current = null;
        }
      }
      if (activeEditPhotoDragIdxRef.current === null && editPhotoTouchStartPosRef.current) {
        const dx = touch.clientX - editPhotoTouchStartPosRef.current.x;
        const dy = touch.clientY - editPhotoTouchStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 14 && editPhotoHoldTimerRef.current) {
          window.clearTimeout(editPhotoHoldTimerRef.current);
          editPhotoHoldTimerRef.current = null;
          editPhotoTouchStartPosRef.current = null;
        }
      }
      if (activeLeaderDragIdxRef.current === null && leaderTouchStartPosRef.current) {
        const dx = touch.clientX - leaderTouchStartPosRef.current.x;
        const dy = touch.clientY - leaderTouchStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 14 && leaderHoldTimerRef.current) {
          window.clearTimeout(leaderHoldTimerRef.current);
          leaderHoldTimerRef.current = null;
          leaderTouchStartPosRef.current = null;
        }
      }
      if (activeAwardDragIdxRef.current === null && awardTouchStartPosRef.current) {
        const dx = touch.clientX - awardTouchStartPosRef.current.x;
        const dy = touch.clientY - awardTouchStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 14 && awardHoldTimerRef.current) {
          window.clearTimeout(awardHoldTimerRef.current);
          awardHoldTimerRef.current = null;
          awardTouchStartPosRef.current = null;
        }
      }
      if (activeBatchDragIdxRef.current === null && batchTouchStartPosRef.current) {
        const dx = touch.clientX - batchTouchStartPosRef.current.x;
        const dy = touch.clientY - batchTouchStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 14 && batchHoldTimerRef.current) {
          window.clearTimeout(batchHoldTimerRef.current);
          batchHoldTimerRef.current = null;
          batchTouchStartPosRef.current = null;
        }
      }
      if (activeVideoDragIdxRef.current === null && videoTouchStartPosRef.current) {
        const dx = touch.clientX - videoTouchStartPosRef.current.x;
        const dy = touch.clientY - videoTouchStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 14 && videoHoldTimerRef.current) {
          window.clearTimeout(videoHoldTimerRef.current);
          videoHoldTimerRef.current = null;
          videoTouchStartPosRef.current = null;
        }
      }
      handleMoveCoordinates(touch.clientX, touch.clientY, e);
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      handleMoveCoordinates(e.clientX, e.clientY, e);
    };

    const onWindowRelease = () => {
      lastDragPointer = null;
      if (autoScrollRafId !== null) {
        window.cancelAnimationFrame(autoScrollRafId);
        autoScrollRafId = null;
      }
      if (draftPhotoHoldTimerRef.current) {
        window.clearTimeout(draftPhotoHoldTimerRef.current);
        draftPhotoHoldTimerRef.current = null;
      }
      draftPhotoTouchStartPosRef.current = null;
      if (activeDraftPhotoDragIdxRef.current !== null) {
        activeDraftPhotoDragIdxRef.current = null;
        setDraggedDraftPhotoIndex(null);
        setDragOverDraftPhotoIndex(null);
      }
      if (editPhotoHoldTimerRef.current) {
        window.clearTimeout(editPhotoHoldTimerRef.current);
        editPhotoHoldTimerRef.current = null;
      }
      editPhotoTouchStartPosRef.current = null;
      if (activeEditPhotoDragIdxRef.current !== null) {
        activeEditPhotoDragIdxRef.current = null;
        setDraggedMomentPhotoIndex(null);
        setDragOverMomentPhotoIndex(null);
      }
      if (leaderHoldTimerRef.current) {
        window.clearTimeout(leaderHoldTimerRef.current);
        leaderHoldTimerRef.current = null;
      }
      leaderTouchStartPosRef.current = null;
      if (activeLeaderDragIdxRef.current !== null) {
        commitLeaderDropLatestRef.current();
      }
      if (awardHoldTimerRef.current) {
        window.clearTimeout(awardHoldTimerRef.current);
        awardHoldTimerRef.current = null;
      }
      awardTouchStartPosRef.current = null;
      if (activeAwardDragIdxRef.current !== null) {
        commitAwardDropLatestRef.current();
      }
      if (batchHoldTimerRef.current) {
        window.clearTimeout(batchHoldTimerRef.current);
        batchHoldTimerRef.current = null;
      }
      batchTouchStartPosRef.current = null;
      if (activeBatchDragIdxRef.current !== null) {
        commitBatchDropLatestRef.current();
      }
      if (videoHoldTimerRef.current) {
        window.clearTimeout(videoHoldTimerRef.current);
        videoHoldTimerRef.current = null;
      }
      videoTouchStartPosRef.current = null;
      if (activeVideoDragIdxRef.current !== null) {
        commitVideoDropLatestRef.current();
      }
    };

    // Attach in capture phase so modal stopPropagation never blocks hold-and-drag inside modals
    window.addEventListener('touchmove', onWindowTouchMove, { capture: true, passive: false });
    window.addEventListener('mousemove', onWindowMouseMove, { capture: true });
    window.addEventListener('touchend', onWindowRelease, { capture: true });
    window.addEventListener('touchcancel', onWindowRelease, { capture: true });
    window.addEventListener('mouseup', onWindowRelease, { capture: true });
    return () => {
      if (autoScrollRafId !== null) {
        window.cancelAnimationFrame(autoScrollRafId);
      }
      window.removeEventListener('touchmove', onWindowTouchMove, { capture: true });
      window.removeEventListener('mousemove', onWindowMouseMove, { capture: true });
      window.removeEventListener('touchend', onWindowRelease, { capture: true });
      window.removeEventListener('touchcancel', onWindowRelease, { capture: true });
      window.removeEventListener('mouseup', onWindowRelease, { capture: true });
    };
  }, []);
  const editMomentAddPhotosInputRef = useRef<HTMLInputElement>(null);
  const [editingAwardModalItem, setEditingAwardModalItem] = useState<AwardItem | null>(null);
  const [editingVoiceModalItem, setEditingVoiceModalItem] = useState<VoiceItem | null>(null);
  const [isShareAlbumModalOpen, setIsShareAlbumModalOpen] = useState(false);
  const [copiedAlbumShareLink, setCopiedAlbumShareLink] = useState(false);
  const modalAwardPhotoInputRef = useRef<HTMLInputElement>(null);
  const modalVoicePhotoInputRef = useRef<HTMLInputElement>(null);

  // Identify Admin's own profile within the class roster or seed with registration form details
  const myProfile = useMemo(() => {
    const adminEmail = (currentSet.classRepEmail || currentUser?.email || '').toLowerCase().trim();
    const adminName = (currentSet.classRepName || currentUser?.fullName || '').toLowerCase().trim();
    const existing = currentSet.students.find((s) => {
      if (s.id === `admin-${currentSet.id}`) return true;
      if (s.email && adminEmail && s.email.toLowerCase().trim() === adminEmail) return true;
      if (s.fullName && adminName && s.fullName.toLowerCase().trim() === adminName) return true;
      if ((s as any).isClassRep === true) return true;
      if (s.position && (s.position.toLowerCase().includes('class rep') || s.position.toLowerCase().includes('admin'))) return true;
      return false;
    });

    if (existing) {
      return {
        ...existing,
        fullName: currentSet.classRepName || existing.fullName,
        email: currentSet.classRepEmail || existing.email,
      };
    }

    // Seed default admin profile using album registration form credentials
    const seeded: StudentProfile = {
      id: `admin-${currentSet.id}`,
      setId: currentSet.id,
      fullName: currentSet.classRepName || currentUser?.fullName || 'Class Representative',
      position: 'Class Representative',
      email: currentSet.classRepEmail || currentUser?.email || '',
      whatsappNumber: currentSet.classRepPhone || currentUser?.phone || '',
      photoUrl: currentUser?.avatarUrl || '',
      rawPhotoUrl: currentUser?.avatarUrl || '',
      approved: true,
      submittedAt: new Date().toISOString().split('T')[0],
      leaderOrder: 1,
    };
    return seeded;
  }, [currentSet.students, currentUser, currentSet.classRepEmail, currentSet.classRepName, currentSet.classRepPhone, currentSet.id]);

  const handleOpenAddMyProfile = () => {
    setEditingStudent(myProfile);
  };

  const handleOpenEditAwardModal = (award: AwardItem) => {
    setEditingAwardModalItem({ ...award });
  };

  const handleSaveAwardModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAwardModalItem) return;
    const updated = currentSet.awards.map((a) =>
      a.id === editingAwardModalItem.id ? editingAwardModalItem : a
    );
    onUpdateSet({
      ...currentSet,
      awards: updated,
    });
    setHierarchyToast('✓ Award updated successfully!');
    setTimeout(() => setHierarchyToast(null), 3000);
    showSuccess('Award updated.');
    setEditingAwardModalItem(null);
  };

  const handleOpenEditVoiceModal = (voice: VoiceItem) => {
    setEditingVoiceModalItem({ 
      ...voice,
      pinnedTitle: voice.pinnedTitle || 'From the President',
    });
  };

  const handleSaveVoiceModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoiceModalItem) return;
    const isPinned = Boolean(editingVoiceModalItem.isPinned);
    const updated = currentSet.voices.map((v) => {
      if (v.id === editingVoiceModalItem.id) {
        return {
          ...editingVoiceModalItem,
          isPinned,
          pinnedTitle: isPinned ? (editingVoiceModalItem.pinnedTitle?.trim() || 'From the President') : undefined,
        };
      }
      return isPinned ? { ...v, isPinned: false } : v;
    });
    onUpdateSet({
      ...currentSet,
      voices: updated,
    });
    const msg = isPinned 
      ? `✓ Pinned as "${editingVoiceModalItem.pinnedTitle?.trim() || 'From the President'}" (shows first)` 
      : '✓ Final thought updated successfully!';
    setHierarchyToast(msg);
    setTimeout(() => setHierarchyToast(null), 3000);
    showSuccess(msg);
    setEditingVoiceModalItem(null);
  };

  const handleTogglePinVoice = (voiceId: string) => {
    const target = currentSet.voices.find((v) => v.id === voiceId);
    if (!target) return;
    const isNowPinned = !target.isPinned;
    const updated = currentSet.voices.map((v) => {
      if (v.id === voiceId) {
        return {
          ...v,
          isPinned: isNowPinned,
          pinnedTitle: isNowPinned ? (v.pinnedTitle || 'From the President') : undefined,
        };
      }
      return isNowPinned ? { ...v, isPinned: false } : v;
    });
    onUpdateSet({
      ...currentSet,
      voices: updated,
    });
    const msg = isNowPinned 
      ? `✓ Pinned as "${target.pinnedTitle || 'From the President'}" (shows first)` 
      : '✓ Message unpinned';
    setHierarchyToast(msg);
    setTimeout(() => setHierarchyToast(null), 3000);
    showSuccess(isNowPinned ? 'Pinned message to top.' : 'Unpinned message.');
  };

  const handleModalAwardPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const rawUrl = uploadEvent.target?.result as string;
        if (rawUrl) {
          triggerCropForImage(rawUrl, '1:1', 'Resize Award Recipient Photo', async (cropped) => {
            try {
              const comp = await compressImageToWebP(cropped, 720, 0.88);
              const upRes = await uploadMediaToR2(comp.dataUrl, {
                setId: currentSet.id,
                category: 'award',
                fileName: 'award-avatar.webp',
              });
              if (upRes.success && upRes.url) {
                if (editingAwardModalItem) {
                  setEditingAwardModalItem({
                    ...editingAwardModalItem,
                    winnerAvatar: upRes.url,
                    rawAvatar: upRes.url,
                  });
                }
              } else {
                showError('Upload failed', upRes.error || 'Could not upload award photo. Please retry.');
              }
            } catch (err: any) {
              showError('Upload failed', err?.message || 'Could not upload award photo. Please retry.');
            }
          });
        }
      };
      reader.readAsDataURL(file);
    }
    if (modalAwardPhotoInputRef.current) modalAwardPhotoInputRef.current.value = '';
  };

  const handleModalVoicePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const rawUrl = uploadEvent.target?.result as string;
        if (rawUrl) {
          triggerCropForImage(rawUrl, '1:1', 'Resize Contributor Photo', async (cropped) => {
            try {
              const comp = await compressImageToWebP(cropped, 720, 0.88);
              const upRes = await uploadMediaToR2(comp.dataUrl, {
                setId: currentSet.id,
                category: 'voice',
                fileName: 'voice-headshot.webp',
              });
              if (upRes.success && upRes.url) {
                if (editingVoiceModalItem) {
                  setEditingVoiceModalItem({
                    ...editingVoiceModalItem,
                    headshotUrl: upRes.url,
                    rawHeadshotUrl: upRes.url,
                  });
                }
              } else {
                showError('Upload failed', upRes.error || 'Could not upload headshot. Please retry.');
              }
            } catch (err: any) {
              showError('Upload failed', err?.message || 'Could not upload headshot. Please retry.');
            }
          });
        }
      };
      reader.readAsDataURL(file);
    }
    if (modalVoicePhotoInputRef.current) modalVoicePhotoInputRef.current.value = '';
  };

  // Filter approved students to ONLY student leaders for voices
  const approvedStudentLeaders = useMemo(() => {
    const leaders = approvedStudents.filter((st) => {
      if (isLeaderProfile(st)) return true;
      if (st.position && st.position.trim().length > 0) {
        const p = st.position.toLowerCase().trim();
        const generic = ['member', 'student', 'classmate', 'graduand', 'diplomate', 'none', 'n/a', '-'];
        return !generic.includes(p);
      }
      return false;
    });
    return leaders.length > 0 ? leaders : approvedStudents;
  }, [approvedStudents]);

  // Story Edit State
  const [classTaglineText, setClassTaglineText] = useState(currentSet.classSlogan || '');
  const [storyText, setStoryText] = useState(() => getCleanClassSummary(currentSet.ourStory));
  const [isClassSummaryOpen, setIsClassSummaryOpen] = useState(false);
  const [noteToNextSetText, setNoteToNextSetText] = useState(currentSet.noteToNextSet || '');
  const [featuredLeaderId, setFeaturedLeaderId] = useState(currentSet.featuredLeaderProfileId || '');
  const [storySaved, setStorySaved] = useState(false);
  const [readingStoryAdminTarget, setReadingStoryAdminTarget] = useState<{
    student: StudentProfile;
    sectionLabel: string;
  } | null>(null);

  useEffect(() => {
    setClassTaglineText(currentSet.classSlogan || '');
    setStoryText(getCleanClassSummary(currentSet.ourStory));
    setNoteToNextSetText(currentSet.noteToNextSet || '');
    setFeaturedLeaderId(currentSet.featuredLeaderProfileId || '');
  }, [currentSet.id, currentSet.classSlogan, currentSet.ourStory, currentSet.noteToNextSet, currentSet.featuredLeaderProfileId]);

  // Multi-Platform Frictionless Submission Sharing
  const [copiedLink, setCopiedLink] = useState(false);
  const [showOtherPlatforms, setShowOtherPlatforms] = useState(false);

  const shareableSubmitUrl = getSubmitUrl(currentSet);
  const shareMessage = `🎓 Calling all ${currentSet.classSetName} (${currentSet.departmentName}, ${currentSet.institutionName})!\n\nSubmit your official graduate portrait, nickname, and parting quote for our KoHot Digital Class Album here (takes 60 seconds, no login required):\n${shareableSubmitUrl}\n\nLet's immortalize our class legacy!`;

  const whatsAppShareUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareableSubmitUrl)}&text=${encodeURIComponent(`🎓 Calling all ${currentSet.classSetName} (${currentSet.departmentName}) graduates! Submit your profile to our KoHot Class Album:`)}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎓 Calling all ${currentSet.classSetName} (${currentSet.departmentName}) graduates! Submit your profile to our KoHot Class Album:`)}&url=${encodeURIComponent(shareableSubmitUrl)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableSubmitUrl)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(`Join our ${currentSet.classSetName} Official Class Album on KoHot`)}&body=${encodeURIComponent(shareMessage)}`;

  const handleCopyShareLink = async () => {
    await copyUrlToClipboard(shareableSubmitUrl);
    setCopiedLink(true);
    showSuccess('Invitation ready to share.', 'The message and album link are ready.');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeDeviceShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentSet.departmentName} - ${currentSet.classSetName} KoHot Album`,
          text: `Submit your profile for the ${currentSet.departmentName} permanent class album on KoHot:`,
          url: shareableSubmitUrl,
        });
        showSuccess('Invitation ready to share.', 'The message and album link are ready.');
      } catch (e) {
        console.log('Share dismissed');
      }
    } else {
      await handleCopyShareLink();
    }
  };

  const handleSaveConvocationFromModal = (convocationData: {
    formattedDate: string;
    day?: number;
    month: number;
    year: number;
    isDayUnknown: boolean;
    enableAutomaticReminder: boolean;
  }) => {
    const nextAnniversary = calculateNextAnniversaryDate(
      convocationData.month,
      convocationData.day
    );

    const updatedSettings: CohortReminderSettings = {
      automaticRemindersEnabled: convocationData.enableAutomaticReminder,
      convocationDate: convocationData.formattedDate,
      convocationMonth: convocationData.month,
      convocationDay: convocationData.day,
      convocationYear: convocationData.year,
      isConvocationDayUnknown: convocationData.isDayUnknown,
      nextReminderDate: nextAnniversary.nextDateFormatted,
      lastDispatchedYear: undefined,
      notificationEmails: [currentSet.classRepEmail],
    };

    onUpdateSet({
      ...currentSet,
      convocationDate: convocationData.formattedDate,
      reminderSettings: updatedSettings,
    });
  };

  // Image Upload with Universal Gallery Compatibility & R2 Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const result = await compressImageToWebP(file, compressionResolution, 0.85);
      setNewStudentCompression(result);
      const upRes = await uploadMediaToR2(result.dataUrl, {
        setId: currentSet.id,
        category: 'portrait',
        fileName: file.name || 'student-portrait.webp',
      });
      if (upRes.success && upRes.url) {
        setNewStudentPhotoUrl(upRes.url);
      } else {
        showError('Upload failed', upRes.error || 'Failed to upload portrait to cloud storage. Please retry.');
      }
    } catch (err: any) {
      console.error('Error uploading gallery image:', err);
      showError('Upload failed', err?.message || 'Error uploading image. Please retry.');
    } finally {
      setIsCompressing(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentPhotoUrl) return;

    const trimmedPos = newStudentPosition.trim();
    const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

    const student: StudentProfile = {
      id: `std-${Date.now()}`,
      setId: currentSet.id,
      fullName: newStudentName.trim(),
      nickname: newStudentNickname.trim() || undefined,
      position: trimmedPos || 'Member',
      photoUrl: newStudentPhotoUrl,
      originalSizeKb: newStudentCompression?.originalSizeKb,
      compressedSizeKb: newStudentCompression?.compressedSizeKb,
      quote: newStudentQuote.trim() || undefined,
      bio: newStudentBio.trim() || undefined,
      favouriteCampusMemory: newStudentFavouriteMemory.trim().slice(0, 140) || undefined,
      funFact: newStudentFunFact.trim().slice(0, 140) || undefined,
      whatsNext: newStudentWhatsNext.trim().slice(0, 140) || undefined,
      messageToClassmates: newStudentMessageToClassmates.trim() || undefined,
      messageToFutureSet: newStudentMessageToFutureSet.trim() || undefined,
      approved: true,
      submittedAt: new Date().toISOString().split('T')[0],
      leaderOrder: isLeader ? calculateIntuitiveHierarchyRank(trimmedPos) : undefined,
    };

    const updated = {
      ...currentSet,
      students: [student, ...currentSet.students],
    };
    onUpdateSet(updated);
    showSuccess('Classmate added.', 'The profile is now part of your class roster.');

    // Reset Form
    setNewStudentName('');
    setNewStudentNickname('');
    setNewStudentPosition('');
    setNewStudentQuote('');
    setNewStudentBio('');
    setNewStudentFavouriteMemory('');
    setNewStudentFunFact('');
    setNewStudentWhatsNext('');
    setNewStudentMessageToClassmates('');
    setNewStudentMessageToFutureSet('');
    setNewStudentPhotoUrl('');
    setNewStudentCompression(null);
    setIsAddingStudent(false);
  };

  const handleDeleteStudent = (id: string) => {
    const student = currentSet.students.find((s) => s.id === id);
    if (!student) return;
    confirmWarning({
      title: 'Delete Classmate Profile?',
      message: `Are you sure you want to delete "${student.fullName}"? It will be moved to Declined / Deleted where you can restore or permanently delete it.`,
      confirmLabel: 'Delete Profile',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const wasApproved = getStudentEffectiveStatus(student) === 'approved';
        const updatedStudents = currentSet.students.map((s) =>
          s.id === id
            ? ({
                ...s,
                approved: false,
                status: 'removed',
                submissionStatus: 'removed',
                previousApproved: wasApproved,
              } as StudentProfile)
            : s
        );
        onUpdateSet({
          ...currentSet,
          students: updatedStudents,
        });
        removeAlbumSubmissionOnServer(currentSet.id, id).catch(() => {});
        if (editingStudent?.id === id) {
          setEditingStudent(null);
        }
        if (inspectedProfileRow?.id === id) {
          setInspectedProfileRow(null);
        }
        setHierarchyToast(
          `✓ "${student.fullName}" moved to Declined / Deleted (recoverable anytime).`
        );
        setTimeout(() => setHierarchyToast(null), 3500);
        showWarning(
          'Moved to Declined / Deleted',
          `${student.fullName} was moved to Declined / Deleted. You can restore or permanently delete it there.`
        );
      },
    });
  };

  // ==========================================
  // BATCH MOMENTS UPLOAD & HIERARCHY HANDLERS
  // ==========================================

  // Multi-image upload for new batch creation with automated date extraction
  const handleBatchFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsCompressingBatch(true);
    setIsScanningMetadata(true);
    try {
      const newItems: Array<{ id: string; url: string; caption: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await compressImageToWebP(file, compressionResolution, 0.85);
        const upRes = await uploadMediaToR2(res.dataUrl, {
          setId: currentSet.id,
          category: 'moments',
          fileName: file.name || `moment-${i + 1}.webp`,
        });
        if (!upRes.success || !upRes.url) {
          showError('Upload failed', upRes.error || `Failed to upload ${file.name || 'image'}. Please retry.`);
          continue;
        }
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: upRes.url,
          caption: '',
        });
      }
      if (newItems.length > 0) {
        setBatchImages((prev) => [...prev, ...newItems]);
      }

      // Extract event date from photo metadata (EXIF / Filename / System modified)
      const extracted = await extractDateFromBatchFiles(files, currentSet.graduationYear);
      setExtractedDateResult(extracted);
      setBatchDate(extracted.formattedDisplay);
      if (extracted.day) {
        setBatchDay(extracted.day);
        setIsBatchDayUnknown(false);
      } else {
        setBatchDay('');
        setIsBatchDayUnknown(true);
      }
      setBatchMonth(extracted.month);
      setBatchYear(extracted.year);

    } catch (err) {
      console.error('Error processing batch files:', err);
    } finally {
      setIsCompressingBatch(false);
      setIsScanningMetadata(false);
    }
  };

  // Dedicated Convocation Date & Reminder Handler
  const handlePublishConvocationReminder = (convocationData: {
    formattedDate: string;
    day?: number;
    month: number;
    year: number;
    isDayUnknown: boolean;
    enableAutomaticReminder: boolean;
  }) => {
    const updatedReminderSettings: CohortReminderSettings = {
      automaticRemindersEnabled: convocationData.enableAutomaticReminder,
      convocationDate: convocationData.formattedDate,
      convocationDay: convocationData.day,
      convocationMonth: convocationData.month,
      convocationYear: convocationData.year,
      approvedAt: new Date().toISOString(),
    };
    const updated: ClassSet = {
      ...currentSet,
      convocationDate: convocationData.formattedDate,
      reminderSettings: updatedReminderSettings,
    };
    onUpdateSet(updated);
    setIsConvocationReminderModalOpen(false);
    setHierarchyToast(`✓ Convocation date (${convocationData.formattedDate}) & annual relive reminder published!`);
    setTimeout(() => setHierarchyToast(null), 3500);
  };

  const handleAddBatchImageUrl = (url: string) => {
    if (!url.trim()) return;
    setBatchImages((prev) => [
      ...prev,
      {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: url.trim(),
        caption: '',
      },
    ]);
  };

  const handleRemoveDraftBatchImage = (index: number) => {
    setBatchImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateDraftBatchImageCaption = (index: number, caption: string) => {
    setBatchImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, caption } : img))
    );
  };

  // Save new moments batch
  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCat = (batchCategory || batchTitle).trim();
    if (!resolvedCat || batchImages.length === 0) return;

    const currentDayVal = isBatchDayUnknown ? undefined : (typeof batchDay === 'number' ? batchDay : undefined);
    const resolvedDateStr = batchDate.trim() || formatDateComponents(currentDayVal, batchMonth, batchYear);

    const isConv = 
      resolvedCat.toLowerCase().includes('convocation') || 
      isConvocationBatchToggle;

    const newBatch: MemoryEvent = {
      id: `mem-${Date.now()}`,
      setId: currentSet.id,
      title: resolvedCat,
      eventTag: resolvedCat,
      dateStr: resolvedDateStr,
      caption: batchCaption.trim() || undefined,
      morePhotosUrl: batchMorePhotosUrl.trim() || undefined,
      order: 1,
      images: batchImages,
      eventDay: currentDayVal,
      eventMonth: batchMonth,
      eventYear: batchYear,
      isDayUnknown: isBatchDayUnknown,
      dateExtractedAutomatically: Boolean(extractedDateResult),
      dateExtractionSource: extractedDateResult?.sourceDescription,
      isConvocationBatch: isConv,
    };

    const existingOrdered = [...currentSet.memories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const reindexedMemories = [newBatch, ...existingOrdered].map((m, idx) => ({
      ...m,
      order: idx + 1,
    }));

    let updatedSet: ClassSet = {
      ...currentSet,
      memories: reindexedMemories,
    };

    if (isConv) {
      const nextRem = calculateNextAnniversaryDate(batchMonth, currentDayVal);
      updatedSet = {
        ...updatedSet,
        convocationDate: resolvedDateStr,
        reminderSettings: {
          automaticRemindersEnabled: true,
          convocationDate: resolvedDateStr,
          convocationDay: currentDayVal,
          convocationMonth: batchMonth,
          convocationYear: batchYear,
          extractedFromBatchId: newBatch.id,
          approvedAt: new Date().toISOString(),
          nextReminderDate: nextRem.nextDateFormatted,
        },
      };
    }

    onUpdateSet(updatedSet);

    // Reset Form
    setBatchTitle('');
    setBatchCategory('Dinner & Awards');
    setBatchDate('');
    setBatchDay('');
    setIsBatchDayUnknown(false);
    setBatchMonth(10);
    setBatchYear(currentSet.graduationYear || 2026);
    setIsConvocationBatchToggle(false);
    setExtractedDateResult(null);
    setBatchCaption('');
    setBatchMorePhotosUrl('');
    setBatchImages([]);
    setIsAddingBatch(false);
    setHierarchyToast(`✓ Batch "${newBatch.title}" with ${newBatch.images.length} photos saved!${isConv ? ' Convocation & Auto-reminder updated.' : ''}`);
    setTimeout(() => setHierarchyToast(null), 3500);
  };

  // Reorder Batches Hierarchically
  const handleMoveBatch = (batchId: string, direction: 'up' | 'down') => {
    const list = [...sortedMemories];
    const currentIndex = list.findIndex((m) => m.id === batchId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, moved);

    // Re-assign order sequentially
    const updatedMemories = list.map((m, index) => ({
      ...m,
      order: index + 1,
    }));

    onUpdateSet({
      ...currentSet,
      memories: updatedMemories,
    });

    setHierarchyToast(`✓ Batch order updated: "${moved.title}" is now Batch #${targetIndex + 1}.`);
    setTimeout(() => setHierarchyToast(null), 3000);
  };

  // Delete an entire batch
  const handleDeleteBatch = (batchId: string) => {
    const target = currentSet.memories.find((m) => m.id === batchId);
    confirmWarning({
      title: 'Delete Moment Category?',
      message: `Are you sure you want to delete "${target?.title || 'this category'}" and all photos in it? This action cannot be undone.`,
      confirmLabel: 'Delete Category',
      cancelLabel: 'Keep',
      isDestructive: true,
      onConfirm: () => {
        const updatedMemories = currentSet.memories
          .filter((m) => m.id !== batchId)
          .map((m, idx) => ({ ...m, order: idx + 1 }));

        onUpdateSet({
          ...currentSet,
          memories: updatedMemories,
        });

        apiClientDeleteMemory(currentSet.id, batchId);
        showWarning('Moment Category Deleted', `Deleted "${target?.title || 'Moments'}".`);
      },
    });
  };

  // Delete a specific image from an existing batch
  const handleDeleteImageFromBatch = (batchId: string, imageId: string) => {
    confirmWarning({
      title: 'Remove Photo?',
      message: 'Are you sure you want to remove this photo from the moment category? This action cannot be undone.',
      confirmLabel: 'Remove Photo',
      cancelLabel: 'Keep',
      isDestructive: true,
      onConfirm: () => {
        const updatedMemories = currentSet.memories.map((m) => {
          if (m.id === batchId) {
            return {
              ...m,
              images: m.images.filter((img) => img.id !== imageId),
            };
          }
          return m;
        });

        onUpdateSet({
          ...currentSet,
          memories: updatedMemories,
        });

        apiClientDeleteMemory(currentSet.id, `${batchId}-${imageId}`);
        showSuccess('Photo Removed', 'The photo was removed from the moment collection.');
      },
    });
  };

  // Append new images to an existing batch
  const handleAppendFilesToExistingBatch = async (files: FileList | null, batchId: string) => {
    if (!files || files.length === 0) return;

    try {
      const newItems: Array<{ id: string; url: string; caption: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await compressImageToWebP(file, compressionResolution, 0.85);
        const upRes = await uploadMediaToR2(res.dataUrl, {
          setId: currentSet.id,
          category: 'moments',
          fileName: file.name || `moment-${i + 1}.webp`,
        });
        if (!upRes.success || !upRes.url) {
          showError('Upload failed', upRes.error || `Failed to upload ${file.name || 'image'}. Please retry.`);
          continue;
        }
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: upRes.url,
          caption: '',
        });
      }
      if (newItems.length === 0) return;

      const targetBatch = currentSet.memories.find((m) => m.id === batchId);
      const existingOrdered = [...currentSet.memories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      const updatedTarget: MemoryEvent | undefined = targetBatch
        ? {
            ...targetBatch,
            images: [...targetBatch.images, ...newItems],
          }
        : undefined;

      const updatedMemories = (
        updatedTarget
          ? [updatedTarget, ...existingOrdered.filter((m) => m.id !== batchId)]
          : existingOrdered
      ).map((m, idx) => ({
        ...m,
        order: idx + 1,
      }));

      onUpdateSet({
        ...currentSet,
        memories: updatedMemories,
      });

      setActiveAppendBatchId(null);
      setHierarchyToast(`✓ Added ${newItems.length} photos and moved category to top!`);
      setTimeout(() => setHierarchyToast(null), 3000);
    } catch (err) {
      console.error('Error appending images to category:', err);
    }
  };

  // Open Edit Moment Category Pop-up Modal
  const handleOpenEditMomentBatchModal = (batch: MemoryEvent) => {
    setEditingMomentBatchModal({
      ...batch,
      images: batch.images.map((img) => ({ ...img })),
    });
  };

  // Save edited Moment Category from Pop-up Modal
  const handleSaveEditMomentBatchModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMomentBatchModal) return;
    const trimmedTitle = editingMomentBatchModal.title.trim() || editingMomentBatchModal.eventTag.trim() || 'Moment';
    const trimmedTag = editingMomentBatchModal.eventTag.trim() || trimmedTitle;
    const isConv =
      trimmedTitle.toLowerCase().includes('convocation') ||
      trimmedTag.toLowerCase().includes('convocation') ||
      Boolean(editingMomentBatchModal.isConvocationBatch);

    const updatedBatch: MemoryEvent = {
      ...editingMomentBatchModal,
      title: trimmedTitle,
      eventTag: trimmedTag,
      caption: editingMomentBatchModal.caption?.trim() || undefined,
      morePhotosUrl: editingMomentBatchModal.morePhotosUrl?.trim() || undefined,
      isConvocationBatch: isConv,
    };

    // Place newly updated moments category at the top while keeping reorder support
    const existingOrdered = [...currentSet.memories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const updatedMemories = [
      updatedBatch,
      ...existingOrdered.filter((m) => m.id !== updatedBatch.id),
    ].map((m, idx) => ({
      ...m,
      order: idx + 1,
    }));

    let updatedSet: ClassSet = {
      ...currentSet,
      memories: updatedMemories,
    };

    if (isConv && updatedBatch.dateStr) {
      updatedSet = {
        ...updatedSet,
        convocationDate: updatedBatch.dateStr,
      };
    }

    onUpdateSet(updatedSet);
    setEditingMomentBatchModal(null);
    setHierarchyToast(`✓ Moment "${updatedBatch.title}" updated and moved to top!`);
    setTimeout(() => setHierarchyToast(null), 3000);
    showSuccess('Moment updated.', `"${updatedBatch.title}" has been saved and placed at the top.`);
  };

  // Hold & Drag-and-Drop reorder for photos inside Edit Moment Modal
  const handleReorderEditMomentPhotos = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setEditingMomentBatchModal((prev) => {
      if (!prev) return null;
      const updatedImages = [...prev.images];
      if (fromIndex < 0 || fromIndex >= updatedImages.length || toIndex < 0 || toIndex >= updatedImages.length) {
        return prev;
      }
      const [moved] = updatedImages.splice(fromIndex, 1);
      updatedImages.splice(toIndex, 0, moved);
      return {
        ...prev,
        images: updatedImages,
      };
    });
  };
  reorderEditPhotosLatestRef.current = handleReorderEditMomentPhotos;

  // Hold & Drag-and-Drop reorder for photos inside Create New Category Modal
  const handleReorderDraftPhotos = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setBatchImages((prev) => {
      const next = [...prev];
      if (fromIndex < 0 || fromIndex >= next.length || toIndex < 0 || toIndex >= next.length) return prev;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };
  reorderDraftPhotosLatestRef.current = handleReorderDraftPhotos;

  // Hold & Drag-and-Drop reorder for Moment Category cards
  const handleReorderMomentBatches = (fromIndex: number, toIndex: number, showNotification = true) => {
    if (fromIndex === toIndex) return;
    const list = [...currentSet.memories];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    const updatedMemories = list.map((m, idx) => ({
      ...m,
      order: idx + 1,
    }));
    onUpdateSet({
      ...currentSet,
      memories: updatedMemories,
    });
    if (showNotification) {
      setHierarchyToast(`✓ Rearranged "${moved.title}" to position #${toIndex + 1}.`);
      setTimeout(() => setHierarchyToast(null), 2500);
    }
  };
  reorderBatchesLatestRef.current = handleReorderMomentBatches;

  // Append new photos directly inside the Edit Moment Pop-up Modal
  const handleAppendFilesToEditingMomentModal = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editingMomentBatchModal) return;
    setIsCompressingBatch(true);
    try {
      const newItems: Array<{ id: string; url: string; caption: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await compressImageToWebP(file, compressionResolution, 0.85);
        const upRes = await uploadMediaToR2(res.dataUrl, {
          setId: currentSet.id,
          category: 'moments',
          fileName: file.name || `moment-${i + 1}.webp`,
        });
        if (!upRes.success || !upRes.url) {
          showError('Upload failed', upRes.error || `Failed to upload ${file.name || 'image'}. Please retry.`);
          continue;
        }
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: upRes.url,
          caption: '',
        });
      }
      if (newItems.length === 0) return;
      setEditingMomentBatchModal((prev) =>
        prev
          ? {
              ...prev,
              images: [...prev.images, ...newItems],
            }
          : null
      );
      setHierarchyToast(`✓ Added ${newItems.length} photo${newItems.length > 1 ? 's' : ''} to moment!`);
      setTimeout(() => setHierarchyToast(null), 2500);
    } catch (err) {
      console.error('Error adding photos to editing moment:', err);
    } finally {
      setIsCompressingBatch(false);
      if (editMomentAddPhotosInputRef.current) editMomentAddPhotosInputRef.current.value = '';
    }
  };

  // Reorder single image within a category
  const handleMoveImageInCategory = (categoryId: string, imageIndex: number, direction: 'left' | 'right') => {
    const updatedMemories = currentSet.memories.map((m) => {
      if (m.id === categoryId) {
        const images = [...m.images];
        const targetIndex = direction === 'left' ? imageIndex - 1 : imageIndex + 1;
        if (targetIndex < 0 || targetIndex >= images.length) return m;
        const [moved] = images.splice(imageIndex, 1);
        images.splice(targetIndex, 0, moved);
        return { ...m, images };
      }
      return m;
    });
    onUpdateSet({ ...currentSet, memories: updatedMemories });
  };

  // Replace image in a category
  const handleTriggerReplaceImage = (categoryId: string, imageIndex: number) => {
    setReplacingTarget({ categoryId, imageIndex });
    replaceImageInputRef.current?.click();
  };

  const handleExecuteImageReplacement = async (files: FileList | null) => {
    if (!files || !files[0] || !replacingTarget) return;
    const file = files[0];
    setIsCompressingBatch(true);
    try {
      const res = await compressImageToWebP(file, compressionResolution, 0.85);
      const upRes = await uploadMediaToR2(res.dataUrl, {
        setId: currentSet.id,
        category: 'moments',
        fileName: file.name || 'moment-replacement.webp',
      });
      if (!upRes.success || !upRes.url) {
        showError('Upload failed', upRes.error || 'Could not upload replacement image to storage. Please retry.');
        return;
      }
      if (editingMomentBatchModal && editingMomentBatchModal.id === replacingTarget.categoryId) {
        const updatedModalImages = [...editingMomentBatchModal.images];
        if (updatedModalImages[replacingTarget.imageIndex]) {
          updatedModalImages[replacingTarget.imageIndex] = {
            ...updatedModalImages[replacingTarget.imageIndex],
            url: upRes.url,
          };
        }
        setEditingMomentBatchModal({
          ...editingMomentBatchModal,
          images: updatedModalImages,
        });
      }
      const updatedMemories = currentSet.memories.map((m) => {
        if (m.id === replacingTarget.categoryId) {
          const updatedImages = [...m.images];
          if (updatedImages[replacingTarget.imageIndex]) {
            updatedImages[replacingTarget.imageIndex] = {
              ...updatedImages[replacingTarget.imageIndex],
              url: upRes.url,
            };
          }
          return { ...m, images: updatedImages };
        }
        return m;
      });
      onUpdateSet({ ...currentSet, memories: updatedMemories });
      setHierarchyToast('✓ Image replaced and uploaded to R2!');
      setTimeout(() => setHierarchyToast(null), 3000);
    } catch (err) {
      console.error('Error replacing image:', err);
    } finally {
      setIsCompressingBatch(false);
      setReplacingTarget(null);
      if (replaceImageInputRef.current) replaceImageInputRef.current.value = '';
    }
  };

  // Edit caption for an image in a category
  const handleStartEditCaption = (categoryId: string, imageIndex: number, currentCaption?: string) => {
    setEditingCaptionTarget({ categoryId, imageIndex });
    setEditingCaptionText(currentCaption || '');
  };

  const handleSaveImageCaption = (categoryId: string, imageIndex: number) => {
    const updatedMemories = currentSet.memories.map((m) => {
      if (m.id === categoryId) {
        const updatedImages = [...m.images];
        if (updatedImages[imageIndex]) {
          updatedImages[imageIndex] = {
            ...updatedImages[imageIndex],
            caption: editingCaptionText.trim(),
          };
        }
        return { ...m, images: updatedImages };
      }
      return m;
    });
    onUpdateSet({ ...currentSet, memories: updatedMemories });
    setEditingCaptionTarget(null);
    setEditingCaptionText('');
    setHierarchyToast('✓ Image caption updated!');
    setTimeout(() => setHierarchyToast(null), 2500);
  };

  const scrollBatchTrack = (batchId: string, direction: 'left' | 'right') => {
    const el = document.getElementById(`batch-scroll-${batchId}`);
    if (el) {
      el.scrollBy({ left: direction === 'left' ? -280 : 280, behavior: 'smooth' });
    }
  };

  const handleEditAward = (award: AwardItem) => {
    setEditingAwardId(award.id);
    setAwardCategory(award.category);
    setAwardWinnerName(award.winnerName);
    setAwardWinnerNickname(award.winnerNickname || '');
    setAwardAvatar(award.winnerAvatar || '');
    setAwardTrophyType(award.trophyType || 'gold');
    setAwardCitation(award.citation || '');
    setIsAddingAward(true);
  };

  const handleDeleteAward = (awardId: string) => {
    const target = currentSet.awards.find((a) => a.id === awardId);
    confirmWarning({
      title: 'Delete Award?',
      message: `Are you sure you want to delete the award "${target?.category || 'this award'}"? This action cannot be undone.`,
      confirmLabel: 'Delete Award',
      cancelLabel: 'Keep',
      isDestructive: true,
      onConfirm: () => {
        const updated = currentSet.awards.filter((a) => a.id !== awardId);
        onUpdateSet({
          ...currentSet,
          awards: updated,
        });
        apiClientDeleteAward(currentSet.id, awardId);
        showSuccess('Award Removed', 'The award was removed from the album.');
      },
    });
  };

  const handleSelectStudentForAward = (studentId: string) => {
    setSelectedAwardStudentId(studentId);
    if (!studentId) return;
    const student = approvedStudents.find((s) => s.id === studentId);
    if (student) {
      setAwardWinnerName(student.fullName);
      setAwardWinnerNickname(student.nickname || '');
      if (student.photoUrl) setAwardAvatar(student.photoUrl);
      setHierarchyToast(`✓ Selected classmate: ${student.fullName}`);
      setTimeout(() => setHierarchyToast(null), 2500);
    }
  };

  const handleSelectStudentForVoice = (studentId: string) => {
    setSelectedVoiceStudentId(studentId);
    if (!studentId) return;
    const student = approvedStudents.find((s) => s.id === studentId);
    if (student) {
      setVoiceLecturerName(student.fullName);
      setVoiceTitle(student.position || 'Class Member / Graduate');
      if (student.photoUrl) setVoiceHeadshotUrl(student.photoUrl);
      if (student.quote) setVoicePartingQuote(student.quote);
      setHierarchyToast(`✓ Selected profile: ${student.fullName}`);
      setTimeout(() => setHierarchyToast(null), 2500);
    }
  };

  const handleVoicePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await compressImageToWebP(file, 800, 0.88);
      triggerCropForImage(
        res.dataUrl,
        '1:1',
        'Resize Speaker / Mentor Headshot',
        async (croppedUrl) => {
          const comp = await compressImageToWebP(croppedUrl, 720, 0.88);
          const upRes = await uploadMediaToR2(comp.dataUrl, {
            setId: currentSet.id,
            category: 'voice',
            fileName: 'voice-headshot.webp',
          });
          if (upRes.success && upRes.url) {
            setVoiceHeadshotUrl(upRes.url);
            setHierarchyToast('✓ Headshot photo uploaded to R2!');
            setTimeout(() => setHierarchyToast(null), 3000);
          } else {
            showError('Upload failed', upRes.error || 'Could not upload headshot. Please retry.');
          }
        }
      );
    } catch {
      setHierarchyToast('Error loading headshot image.');
      setTimeout(() => setHierarchyToast(null), 3000);
    }
  };

  const handleAwardPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await compressImageToWebP(file, 800, 0.88);
      triggerCropForImage(
        res.dataUrl,
        '1:1',
        'Resize Award Winner Portrait',
        async (croppedUrl) => {
          const comp = await compressImageToWebP(croppedUrl, 720, 0.88);
          const upRes = await uploadMediaToR2(comp.dataUrl, {
            setId: currentSet.id,
            category: 'award',
            fileName: 'award-avatar.webp',
          });
          if (upRes.success && upRes.url) {
            setAwardAvatar(upRes.url);
            setHierarchyToast('✓ Winner photo uploaded to R2!');
            setTimeout(() => setHierarchyToast(null), 3000);
          } else {
            showError('Upload failed', upRes.error || 'Could not upload award photo. Please retry.');
          }
        }
      );
    } catch {
      setHierarchyToast('Error loading award image.');
      setTimeout(() => setHierarchyToast(null), 3000);
    }
  };

  const handleSaveAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardCategory || !awardWinnerName) return;

    if (editingAwardId) {
      // Edit existing award
      const updatedAwards = currentSet.awards.map((a) => {
        if (a.id === editingAwardId) {
          return {
            ...a,
            category: awardCategory,
            winnerName: awardWinnerName,
            winnerNickname: awardWinnerNickname || undefined,
            winnerAvatar: awardAvatar || a.winnerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=320&auto=format&fit=crop&q=85',
            trophyType: awardTrophyType,
            citation: awardCitation || 'Voted by classmates for outstanding contribution and character.',
          };
        }
        return a;
      });

      onUpdateSet({
        ...currentSet,
        awards: updatedAwards,
      });

      setHierarchyToast('✓ Award changes updated and reflected on album general view!');
      setTimeout(() => setHierarchyToast(null), 3500);
    } else {
      // Create new award
      const newAward: AwardItem = {
        id: `awd-${Date.now()}`,
        setId: currentSet.id,
        category: awardCategory,
        winnerName: awardWinnerName,
        winnerNickname: awardWinnerNickname || undefined,
        winnerAvatar: awardAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=320&auto=format&fit=crop&q=85',
        trophyType: awardTrophyType,
        votesCount: Math.floor(50 + Math.random() * 80),
        citation: awardCitation || 'Voted by classmates for outstanding contribution and character.',
      };

      onUpdateSet({
        ...currentSet,
        awards: [newAward, ...currentSet.awards],
      });

      setHierarchyToast('✓ Award created and visible on album general view!');
      setTimeout(() => setHierarchyToast(null), 3500);
    }

    setEditingAwardId(null);
    setAwardCategory('');
    setAwardWinnerName('');
    setAwardWinnerNickname('');
    setAwardAvatar('');
    setAwardCitation('');
    setSelectedAwardStudentId('');
    setIsAddingAward(false);
  };

  const handleSaveVoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceLecturerName || !voicePartingQuote) return;

    const newVoice: VoiceItem = {
      id: `voc-${Date.now()}`,
      setId: currentSet.id,
      lecturerName: voiceLecturerName,
      title: voiceTitle || 'Student Leader / Executive',
      headshotUrl: voiceHeadshotUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=320&auto=format&fit=crop&q=85',
      partingQuote: voicePartingQuote,
      isPinned: voiceIsPinned,
      pinnedTitle: voiceIsPinned ? (voicePinnedTitle.trim() || 'From the President') : undefined,
    };

    const existingVoices = voiceIsPinned 
      ? currentSet.voices.map(v => ({ ...v, isPinned: false }))
      : currentSet.voices;

    onUpdateSet({
      ...currentSet,
      voices: [newVoice, ...existingVoices],
    });

    setVoiceLecturerName('');
    setVoiceTitle('');
    setVoiceHeadshotUrl('');
    setVoicePartingQuote('');
    setVoiceIsPinned(false);
    setVoicePinnedTitle('From the President');
    setSelectedVoiceStudentId('');
    setIsAddingVoice(false);
    setHierarchyToast(voiceIsPinned ? '✓ Final thought pinned as featured message!' : '✓ Final thought saved to album.');
    setTimeout(() => setHierarchyToast(null), 3000);
  };

  const handleDeleteVoice = (voiceId: string) => {
    const target = currentSet.voices.find((v) => v.id === voiceId);
    confirmWarning({
      title: 'Delete Final Thought?',
      message: `Are you sure you want to remove the parting words from "${target?.lecturerName || 'this leader'}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      isDestructive: true,
      onConfirm: () => {
        const updated = currentSet.voices.filter((v) => v.id !== voiceId);
        onUpdateSet({
          ...currentSet,
          voices: updated,
        });
        showWarning('Voice Removed', 'Parting thought was removed from the album.');
      },
    });
  };

  const handleToggleUnpublishAlbum = () => {
    const nextUnpublished = !currentSet.isUnpublished;
    if (nextUnpublished) {
      confirmWarning({
        title: 'Unpublish Class Album?',
        message: 'Unpublishing this album immediately hides it from all public visitors and the department legacy wall. All album data remains intact and restorable at any time by you or the Host.',
        confirmLabel: 'Unpublish Album',
        cancelLabel: 'Keep Published',
        isDestructive: true,
        onConfirm: () => {
          const updated: ClassSet = {
            ...currentSet,
            isUnpublished: true,
            isPublished: false,
            unpublishedAt: new Date().toISOString(),
            unpublishedBy: currentSet.classRepEmail || 'admin',
          };
          onUpdateSet(updated);
          apiClientUnpublishAlbum(currentSet.id, true);
          showWarning('Album Unpublished', 'The album is now hidden from public visitors. You or the Host can republish it at any time.');
        },
      });
    } else {
      const updated: ClassSet = {
        ...currentSet,
        isUnpublished: false,
        isPublished: true,
        publishedAt: currentSet.publishedAt || new Date().toISOString(),
      };
      onUpdateSet(updated);
      apiClientUnpublishAlbum(currentSet.id, false);
      showSuccess('Album Republished', 'The album is now published live and accessible to visitors.');
    }
  };

  const isSoftDeleted = Boolean(currentSet.deletedAt);
  const daysSinceDeleted = currentSet.deletedAt
    ? Math.floor((Date.now() - new Date(currentSet.deletedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const daysRemainingToRecover = Math.max(0, 30 - daysSinceDeleted);
  const isHiddenFromClassAdmin = (isSoftDeleted || Boolean(currentSet.keptByHostOnly)) && currentUser.role !== 'master_host';

  const handleConfirmSoftDelete = () => {
    const nowIso = new Date().toISOString();
    const updated: ClassSet = {
      ...currentSet,
      deletedAt: nowIso,
      deletedBy: currentUser.email || currentSet.classRepEmail || 'Class Admin',
      isPublished: false,
      isUnpublished: true,
      activationStatus: 'inactive',
      deletionRequest: undefined,
    };
    onUpdateSet(updated);
    apiClientSoftDeleteAlbum(currentSet.id, currentSet.classSetName || currentSet.departmentName);
    setIsRequestDeletionModalOpen(false);
    setDeletionReason('');
    showSuccess(
      'Album Deleted (30-Day Recovery)',
      'Your class album has been removed from public view and your dashboard. You can sign in within 30 days to recover it.'
    );
  };

  const handleRecoverAlbum = () => {
    if (daysRemainingToRecover <= 0) {
      showError('Recovery Expired', 'The 30-day recovery window for this class album has expired.');
      return;
    }
    const updated: ClassSet = {
      ...currentSet,
      deletedAt: undefined,
      deletedBy: undefined,
      keptByHostOnly: undefined,
      keptByHostAt: undefined,
      isUnpublished: false,
      activationStatus: 'active',
      deletionRequest: undefined,
    };
    onUpdateSet(updated);
    apiClientRestoreAlbum(currentSet.id);
    setIsRequestDeletionModalOpen(false);
    showSuccess('Album Recovered', 'Your class album and all cohort records have been restored to your dashboard.');
  };

  const handleSaveStory = () => {
    onUpdateSet({
      ...currentSet,
      classSlogan: classTaglineText.trim() || undefined,
      ourStory: storyText.trim().slice(0, 600),
      noteToNextSet: noteToNextSetText.trim() || undefined,
      featuredLeaderProfileId: featuredLeaderId || undefined,
    });
    setStorySaved(true);
    showSuccess('Our Story updated.');
    setTimeout(() => setStorySaved(false), 2500);
  };

  // Lock static backdrop scroll when any inline bottom sheet or popup modal is open
  useStaticBackdropScrollLock(
    Boolean(inspectedProfileRow) ||
    isSlotDetailsSheetOpen ||
    isInviteBottomSheetOpen ||
    Boolean(editingAwardModalItem) ||
    Boolean(editingVoiceModalItem) ||
    isShareAlbumModalOpen ||
    isRequestDeletionModalOpen
  );

  return (
    <div 
      id="class-rep-dashboard" 
      data-dashboard-theme={isLightMode ? 'light' : 'dark'}
      className={`min-h-screen pb-24 font-body transition-colors selection:bg-[#d4af37]/30 ${
        isLightMode 
          ? 'bg-[#f1f3f7] text-zinc-900 dashboard-light' 
          : 'bg-[#121214] text-[#e2e4e9] dashboard-dark'
      }`}
    >
      {/* Top Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 transition-colors ${
        isLightMode 
          ? 'bg-white/95 border-zinc-300 text-black shadow-sm' 
          : 'bg-[#18181b]/90 border-zinc-800 text-white'
      }`}>
        {/* Left: Minimalist Back Arrow (when in Host Demo mode) + Album Admin Title and Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showMainButton && onMainDashboard && (
            <button
              id="header-back-to-main-btn"
              type="button"
              onClick={onMainDashboard}
              title="Back to Main Host Dashboard"
              aria-label="Back to Main Host Dashboard"
              className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer shrink-0 -ml-1 ${
                isLightMode
                  ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0 leading-tight">
            <div className="font-mono-tech text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">
              Album Admin
            </div>
            <div className={`font-syne font-bold text-xs sm:text-sm truncate ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>
              {displayedAdminName}
            </div>
          </div>
        </div>

        {/* Center: Centralized Sticky Manage Album & Preview Album Switcher (Hidden when album is soft-deleted) */}
        {!isHiddenFromClassAdmin && (
          <AlbumAdminSwitcher
            activeMode="manage"
            showMainButton={Boolean(showMainButton)}
            onMainDashboard={onMainDashboard}
            onManageAlbum={() => {
              // Already on manage album dashboard, keep user here
            }}
            onPreviewAlbum={handlePreviewAlbum}
          />
        )}

        {/* Right: Synced Dark/Light Mode Toggle + Integrated Profile Menu (Notifications removed) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="album-admin-theme-toggle-btn"
            type="button"
            onClick={handleToggleDashboardTheme}
            className="w-8 h-8 rounded-full bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-amber-400 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {currentTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>

          <DashboardProfileMenu
            currentUser={currentUser}
            roleTitle="Class Album Admin"
            showNotifications={false}
            onLogout={() => onSwitchRole('visitor')}
            currentSet={currentSet}
            onUpdateSet={onUpdateSet}
            onAdminTransferred={() => onSwitchRole('visitor')}
            onOpenInviteNextClass={() => setIsInviteNextClassModalOpen(true)}
            onOpenRequestDeletion={() => {
              if (isSoftDeleted && daysRemainingToRecover > 0) {
                handleRecoverAlbum();
              } else {
                setIsRequestDeletionModalOpen(true);
              }
            }}
            triggerCropForImage={triggerCropForImage}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-2.5 sm:pt-4 space-y-2.5 sm:space-y-4">
        {/* Welcome Banner on Immediate Album Access */}
        {currentSet.showWelcomeMessage && !isHiddenFromClassAdmin && (
          <div
            id="class-album-welcome-banner"
            className="p-6 rounded-3xl bg-gradient-to-r from-[#d4af37]/20 via-emerald-500/10 to-[#0c0d14] border border-[#d4af37]/40 text-white shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center shrink-0 text-[#d4af37]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] uppercase tracking-wider font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Registration Complete • Instant Access
                </span>
                <h3 className="font-syne font-bold text-lg sm:text-xl text-white">
                  Welcome to Your Class Album, {displayedAdminName}!
                </h3>
                <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
                  Your official digital class album for <span className="text-white font-semibold">{currentSet.departmentName} (Class of {currentSet.graduationYear})</span> is now live on your dashboard. Customize your album design, invite classmates to submit their profiles, and publish when ready.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSet({ ...currentSet, showWelcomeMessage: false })}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs uppercase tracking-wider font-bold transition-colors shrink-0 cursor-pointer self-start sm:self-center"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Soft-Deleted Album State: Album Data Wiped & Hidden from Dashboard (Recoverable within 30 Days) */}
        {isHiddenFromClassAdmin ? (
          <div
            id="soft-deleted-recovery-panel"
            className="p-8 sm:p-12 rounded-3xl bg-[#0c0d14] border border-red-500/30 shadow-2xl text-center max-w-2xl mx-auto my-8 space-y-6 animate-fadeIn"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <Trash2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 font-mono-tech text-[11px] uppercase tracking-wider font-bold">
                Album Deleted • Hidden from Dashboard &amp; Public View
              </span>
              <h2 className="font-syne font-bold text-2xl sm:text-3xl text-white">
                {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </h2>
              <p className="font-body text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                This class album was deleted on{' '}
                <span className="text-zinc-200 font-semibold">
                  {currentSet.deletedAt ? new Date(currentSet.deletedAt).toLocaleDateString() : 'recently'}
                </span>
                . All album data is wiped and hidden from your admin dashboard and the public legacy wall.
              </p>
            </div>

            {daysRemainingToRecover > 0 && !currentSet.keptByHostOnly ? (
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <div className="flex items-center justify-center gap-2 text-amber-300 font-mono-tech text-xs font-bold uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" />
                  <span>{daysRemainingToRecover} Day{daysRemainingToRecover === 1 ? '' : 's'} Remaining Before Permanent Erasure</span>
                </div>
                <p className="font-body text-xs text-zinc-400">
                  You can recover this class album and restore all profiles, memories, and settings before the 30-day retention window expires.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                  <button
                    id="recover-deleted-album-btn"
                    type="button"
                    onClick={handleRecoverAlbum}
                    className="w-full sm:w-auto px-7 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    Recover Class Album Now
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchRole('visitor')}
                    className="w-full sm:w-auto px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/20 space-y-3">
                <p className="font-mono-tech text-xs text-red-300 uppercase font-bold">
                  30-Day Recovery Window Closed
                </p>
                <p className="font-body text-xs text-zinc-400">
                  This album is no longer recoverable from the Class Album Admin dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => onSwitchRole('visitor')}
                  className="px-6 py-2.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
        {/* Ownership Security Guard Banner */}
        {!isAuthorizedAdmin && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-syne font-bold text-sm text-white">Read-Only Preview Mode</h4>
                <p className="font-body text-xs text-zinc-300 mt-0.5">
                  You are viewing an album registered to another class representative ({currentSet.classRepEmail}). Only verified owners can modify this album.
                </p>
              </div>
            </div>
            <button
              onClick={() => onSwitchRole('visitor')}
              className="px-4 py-2 rounded-xl bg-white text-black font-mono-tech text-xs uppercase font-bold hover:bg-zinc-200 transition-colors shrink-0"
            >
              Exit to Portal
            </button>
          </div>
        )}
        
        {/* Slim Album Header Card (Row 1: Title + Status line; Row 2: ALBUM DESIGN + Publish buttons) */}
        <div
          id="slim-album-header-card"
          className={`p-4 rounded-2xl border space-y-3.5 ${
            isLightMode
              ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
              : 'bg-[#131720] border-white/[0.08] text-white'
          }`}
        >
          {/* Row 1: Album title on one line (truncated) + small status line under it */}
          <div className="min-w-0">
            <h2
              className={`font-syne font-bold text-base sm:text-lg tracking-tight truncate ${
                isLightMode ? 'text-slate-900' : 'text-white'
              }`}
            >
              {currentSet.departmentName.replace(/^Department of\s+/i, '')} · Class of {currentSet.graduationYear}
            </h2>
            <p
              className={`font-mono-tech text-xs flex items-center gap-1.5 mt-1 ${
                isLightMode ? 'text-slate-500' : 'text-zinc-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isAlbumPublished
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                }`}
              />
              <span>
                {isAlbumPublished
                  ? 'Published · Live'
                  : 'Draft · Complete publish steps to go live'}
              </span>
            </p>
          </div>

          {/* Row 2: Two pill buttons side by side: gold ALBUM EDIT + PUBLISHED button */}
          <div className="flex items-center gap-3">
            <button
              id="open-album-design-btn"
              type="button"
              onClick={() => setIsAlbumDesignModalOpen(true)}
              className="flex-[1.15] h-11 px-4 rounded-full bg-[#d9b648] hover:bg-[#e5c453] text-black font-mono-tech text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Palette className="w-4 h-4 text-black shrink-0" />
              <span className="truncate">ALBUM EDIT</span>
            </button>

            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <button
                id="open-publish-modal-btn"
                type="button"
                role="switch"
                aria-checked={isAlbumPublished}
                onClick={() => {
                  if (isAlbumPublished) {
                    setIsUnpublishConfirmModalOpen(true);
                  } else {
                    setIsPublishModalOpen(true);
                  }
                }}
                className={`flex-1 h-11 px-3.5 rounded-full font-mono-tech font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 text-center ${
                  isAlbumPublished
                    ? isLightMode
                      ? 'bg-emerald-50 hover:bg-amber-50 border border-emerald-300 hover:border-amber-400 text-emerald-800 hover:text-amber-800'
                      : 'bg-emerald-500/15 hover:bg-amber-500/15 border border-emerald-500/35 hover:border-amber-500/40 text-emerald-300 hover:text-amber-300'
                    : 'bg-white hover:bg-zinc-200 text-black font-bold shadow-sm'
                }`}
                title={
                  isAlbumPublished
                    ? 'Album is Published — click toggle to Unpublish'
                    : 'Click to Publish album'
                }
              >
                <span
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                    isAlbumPublished
                      ? 'bg-emerald-500'
                      : 'bg-zinc-400 dark:bg-zinc-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition-transform ${
                      isAlbumPublished ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
                <span className="truncate">{isAlbumPublished ? 'UNPUBLISH' : 'PUBLISH'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Section Navigation Tabs (Sticky upon scroll, Centralized) */}
        <div
          id="dashboard-section-nav-tabs"
          className={`sticky top-[49px] sm:top-[54px] z-35 -mx-3 px-3 sm:mx-0 sm:px-2 py-2 rounded-b-2xl backdrop-blur-xl transition-colors flex items-center justify-center gap-2.5 overflow-x-auto no-scrollbar ${
            isLightMode
              ? 'bg-[#f1f3f7]/95 border-b border-slate-200/80 shadow-xs'
              : 'bg-[#121214]/95 border-b border-white/[0.06] shadow-md'
          }`}
        >
          <button
            id="tab-btn-students"
            onClick={(e) => {
              setActiveTab('students');
              scrollClipIntoView(e.currentTarget);
            }}
            className={`h-11 px-4 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'students'
                ? isLightMode
                  ? 'bg-slate-900 text-white font-bold shadow-sm'
                  : 'bg-white text-black font-bold shadow-sm'
                : isLightMode
                ? 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                : 'bg-[#12151c] hover:bg-white/[0.06] text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <span>CLASSMATES {approvedStudents.length}</span>
            {pendingStudents.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[11px] flex items-center justify-center">
                {pendingStudents.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-memories"
            onClick={(e) => {
              setActiveTab('memories');
              scrollClipIntoView(e.currentTarget);
            }}
            className={`h-11 px-4 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'memories'
                ? isLightMode
                  ? 'bg-slate-900 text-white font-bold shadow-sm'
                  : 'bg-white text-black font-bold shadow-sm'
                : isLightMode
                ? 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                : 'bg-[#12151c] hover:bg-white/[0.06] text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <span>MEMORIES {currentSet.memories.length}</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: PEOPLE MANAGEMENT
            ========================================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-3.5">
            {/* SLOTS & PURCHASES/SPONSORS CARD */}
            <div
              id="people-slots-card"
              className={`p-4 rounded-2xl border space-y-3.5 shadow-lg ${
                isLightMode
                  ? 'bg-white/95 border-amber-400/50 text-slate-900'
                  : 'bg-[#12151c]/95 border-[#d9b648]/35 text-white'
              }`}
            >
              {/* Row 1: Left: bold available number with "slots left" and "₦{price} per slot" under it; Right: gold "Buy slots" button */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-syne font-bold text-3xl leading-none ${
                        isLightMode ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {slotBalance}
                    </span>
                    <span
                      className={`font-mono-tech text-xs sm:text-sm font-normal ${
                        isLightMode ? 'text-slate-600' : 'text-zinc-400'
                      }`}
                    >
                      slots left
                    </span>
                  </div>
                  <p
                    className={`font-mono-tech text-xs mt-1 ${
                      isLightMode ? 'text-slate-500' : 'text-zinc-400'
                    }`}
                  >
                    {cohortPricing?.kind === 'funding' && cohortPricing.isCovered ? (
                      <>
                        <span className="line-through opacity-60 mr-1.5">
                          ₦{standardSlotPriceNaira.toLocaleString()}
                        </span>
                        <span className="text-emerald-500 font-semibold">
                          Free, sponsored by {cohortPricing.sponsorName || 'KoHot'}
                        </span>
                      </>
                    ) : cohortPricing?.kind === 'discount' ? (
                      <>
                        <span className="line-through opacity-60 mr-1.5">
                          ₦{standardSlotPriceNaira.toLocaleString()}
                        </span>
                        <span className="text-amber-400 font-semibold">
                          ₦{slotPriceNaira.toLocaleString()} per slot ({cohortPricing.discountPercent}% off)
                        </span>
                      </>
                    ) : (
                      <>₦{slotPriceNaira.toLocaleString()} per slot</>
                    )}
                  </p>
                </div>

                <button
                  id="buy-profile-slots-btn"
                  type="button"
                  onClick={() => setIsBuySlotsModalOpen(true)}
                  className="px-5 py-2.5 rounded-full bg-[#d9b648] hover:bg-[#e5c453] text-black font-syne font-bold text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
                >
                  Buy slots
                </button>
              </div>

              {/* Row 2: "Purchases and sponsors (N)" collapsible row */}
              <div
                className={`pt-3 border-t ${
                  isLightMode ? 'border-slate-200' : 'border-white/[0.08]'
                }`}
              >
                <button
                  id="toggle-purchases-sponsors-btn"
                  type="button"
                  onClick={() => setIsPurchasesExpanded((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
                >
                  <span
                    className={`font-syne font-bold text-xs sm:text-sm ${
                      isLightMode ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    Purchases and sponsors{' '}
                    <span className={`font-mono-tech ${isLightMode ? 'text-slate-400' : 'text-zinc-400'}`}>
                      ({slotPurchasesList.length})
                    </span>
                  </span>
                  {isPurchasesExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors shrink-0" />
                  )}
                </button>

                {isPurchasesExpanded && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-white/[0.06] animate-fadeIn">
                    {slotPurchasesList.length === 0 ? (
                      <p className="text-xs text-zinc-400">
                        No slot purchases or sponsor credits recorded yet.
                      </p>
                    ) : (
                      slotPurchasesList.map((item, idx) => {
                        const qty = getSponsorSlotQuantity(item);
                        const sName =
                          item.sponsorName ||
                          item.sponsor_name ||
                          item.DisplayLabel ||
                          'Class Slot Purchase';
                        const isKohot = Boolean(item.isKoHotCredit || item.is_kohot_credit);
                        return (
                          <div
                            key={item.id || idx}
                            className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                              isLightMode
                                ? 'bg-slate-50 border-slate-200 text-slate-800'
                                : 'bg-[#161a24] border-white/[0.06] text-zinc-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{sName}</p>
                              <p className="text-[11px] text-zinc-400">
                                +{qty} slots{item.date ? ` · ${item.date}` : ''}
                              </p>
                            </div>
                            {!isKohot && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSponsorItem(item);
                                  setEditSponsorNameText(
                                    item.sponsorName || item.sponsor_name || ''
                                  );
                                  setEditSponsorVisibleToggle(
                                    item.showSponsorNameOnAlbum !== false &&
                                      item.showSponsorOnAlbum !== false &&
                                      item.show_sponsor_on_album !== 0
                                  );
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 hover:text-white cursor-pointer shrink-0"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}

                    <div className="pt-1 flex justify-end">
                      <button
                        id="open-slot-details-sheet-btn"
                        type="button"
                        onClick={() => {
                          setEditingSponsorItem(null);
                          setIsSlotDetailsSheetOpen(true);
                        }}
                        className="text-xs text-[#d9b648] hover:underline font-medium cursor-pointer"
                      >
                        Slot balance & ledger details ›
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Side-by-Side Action Pill Buttons: INVITE and + ADD CLASSMATE */}
            <div className="grid grid-cols-2 gap-3">
              <button
                id="invite-classmates-btn"
                type="button"
                onClick={() => setIsInviteClassmatesModalOpen(true)}
                className={`h-11 px-4 rounded-full border font-mono-tech text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isLightMode
                    ? 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-500/60 text-amber-800'
                    : 'bg-[#12151c] hover:bg-[#d9b648]/10 border-[#d9b648]/55 text-[#d9b648]'
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>INVITE</span>
              </button>

              <button
                id="add-student-btn"
                type="button"
                onClick={() => {
                  setEditingStudent({
                    id: `std-new-${Date.now()}`,
                    setId: currentSet.id,
                    fullName: '',
                    position: '',
                    photoUrl: '',
                    email: '',
                    approved: true,
                    status: 'approved',
                    submissionStatus: 'approved',
                    submittedAt: new Date().toISOString().split('T')[0],
                  });
                }}
                className={`h-11 px-4 rounded-full border font-mono-tech text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isLightMode
                    ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-900'
                    : 'bg-[#12151c] hover:bg-white/[0.06] border-white/15 text-white'
                }`}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>ADD CLASSMATE</span>
              </button>
            </div>

            {/* Hierarchy / Slot Update Feedback Toast */}
            {hierarchyToast && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono-tech flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{hierarchyToast}</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 uppercase">Live Sync</span>
              </div>
            )}

            {/* FILTER PILL ROW (Pending 3, All 20, Leaders 12, More ▾, Circular Search Button) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 relative">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1">
                  <button
                    id="admin-subtab-pending"
                    type="button"
                    onClick={(e) => {
                      setStudentDirectoryTab('pending');
                      setIsMoreFilterOpen(false);
                      scrollClipIntoView(e.currentTarget);
                    }}
                    className={`h-9 px-3.5 rounded-full text-xs font-mono-tech transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      studentDirectoryTab === 'pending'
                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                        : pendingStudents.length > 0
                        ? isLightMode
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 font-semibold'
                        : isLightMode
                        ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                        : 'bg-[#12151c] hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/10 font-medium'
                    }`}
                  >
                    {pendingStudents.length > 0 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                          studentDirectoryTab === 'pending'
                            ? 'bg-white'
                            : 'bg-amber-500'
                        }`}
                      />
                    )}
                    <span>Pending {pendingStudents.length}</span>
                  </button>

                  <button
                    id="admin-subtab-all"
                    type="button"
                    onClick={(e) => {
                      setStudentDirectoryTab('all');
                      setIsMoreFilterOpen(false);
                      scrollClipIntoView(e.currentTarget);
                    }}
                    className={`h-9 px-3.5 rounded-full text-xs font-mono-tech transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      studentDirectoryTab === 'all'
                        ? isLightMode
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'bg-white text-black font-bold shadow-xs'
                        : isLightMode
                        ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                        : 'bg-[#12151c] hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/10 font-medium'
                    }`}
                  >
                    <span>All {approvedStudents.length}</span>
                  </button>

                  <button
                    id="admin-subtab-leaders"
                    type="button"
                    onClick={(e) => {
                      setStudentDirectoryTab('leaders');
                      setIsMoreFilterOpen(false);
                      scrollClipIntoView(e.currentTarget);
                    }}
                    className={`h-9 px-3.5 rounded-full text-xs font-mono-tech transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      studentDirectoryTab === 'leaders'
                        ? isLightMode
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'bg-white text-black font-bold shadow-xs'
                        : isLightMode
                        ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                        : 'bg-[#12151c] hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/10 font-medium'
                    }`}
                  >
                    <span>Leaders {adminLeaders.length}</span>
                  </button>

                  <button
                    id="admin-subtab-more-btn"
                    type="button"
                    onClick={(e) => {
                      setIsMoreFilterOpen((prev) => !prev);
                      scrollClipIntoView(e.currentTarget);
                    }}
                    className={`h-9 px-3.5 rounded-full text-xs font-mono-tech transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      studentDirectoryTab === 'declined' || isMoreFilterOpen
                        ? isLightMode
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'bg-white text-black font-bold shadow-xs'
                        : isLightMode
                        ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                        : 'bg-[#12151c] hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/10 font-medium'
                    }`}
                  >
                    <span>
                      {studentDirectoryTab === 'declined'
                        ? `Declined / Deleted ${declinedStudents.length}`
                        : 'More'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Circular Search Button */}
                <button
                  id="toggle-student-search-btn"
                  type="button"
                  onClick={() => setIsSearchExpanded((prev) => !prev)}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    isSearchExpanded || Boolean(adminStudentSearch)
                      ? isLightMode
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-white text-black'
                      : isLightMode
                      ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                      : 'bg-[#12151c] hover:bg-white/[0.06] border-white/10 text-zinc-300 hover:text-white'
                  }`}
                  aria-label="Search classmates"
                >
                  <Search className="w-4 h-4" />
                </button>

                {/* More ▾ Dropdown Menu */}
                {isMoreFilterOpen && (
                  <div
                    className={`absolute right-10 top-11 z-30 w-56 rounded-2xl border p-1.5 shadow-2xl space-y-1 ${
                      isLightMode
                        ? 'bg-white border-slate-200 text-slate-900'
                        : 'bg-[#161a24] border-white/15 text-white'
                    }`}
                  >
                    <button
                      id="admin-subtab-declined"
                      type="button"
                      onClick={() => {
                        setStudentDirectoryTab('declined');
                        setIsMoreFilterOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        studentDirectoryTab === 'declined'
                          ? 'bg-red-500/20 text-red-300 font-semibold'
                          : isLightMode
                          ? 'hover:bg-slate-100 text-slate-700'
                          : 'hover:bg-white/10 text-zinc-200'
                      }`}
                    >
                      <span>Declined / Deleted</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[11px]">
                        {declinedStudents.length}
                      </span>
                    </button>

                    <div
                      className={`my-1 border-t ${
                        isLightMode ? 'border-slate-200' : 'border-white/10'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setStudentSortMode('recent');
                        setIsMoreFilterOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        studentSortMode === 'recent'
                          ? isLightMode
                            ? 'bg-slate-100 font-semibold text-slate-900'
                            : 'bg-white/10 font-semibold text-white'
                          : isLightMode
                          ? 'hover:bg-slate-50 text-slate-600'
                          : 'hover:bg-white/5 text-zinc-400'
                      }`}
                    >
                      <span>Sort: Recent first</span>
                      {studentSortMode === 'recent' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStudentSortMode('alpha');
                        setIsMoreFilterOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        studentSortMode === 'alpha'
                          ? isLightMode
                            ? 'bg-slate-100 font-semibold text-slate-900'
                            : 'bg-white/10 font-semibold text-white'
                          : isLightMode
                          ? 'hover:bg-slate-50 text-slate-600'
                          : 'hover:bg-white/5 text-zinc-400'
                      }`}
                    >
                      <span>Sort: A–Z</span>
                      {studentSortMode === 'alpha' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    {studentDirectoryTab === 'leaders' && (
                      <button
                        id="reset-intuitive-hierarchy-btn"
                        type="button"
                        onClick={() => {
                          handleResetToIntuitiveHierarchy();
                          setIsMoreFilterOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs flex items-center gap-2 text-amber-400 hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Auto-Rank Leaders</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Expandable Search Input */}
              {(isSearchExpanded || Boolean(adminStudentSearch)) && (
                <div className="relative animate-fadeIn">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-student-search-input"
                    type="text"
                    value={adminStudentSearch}
                    onChange={(e) => setAdminStudentSearch(e.target.value)}
                    placeholder="Search classmates by name, nickname, or role..."
                    autoFocus={isSearchExpanded}
                    className={`w-full border rounded-full pl-9 pr-8 py-2 text-xs focus:outline-none font-body ${
                      isLightMode
                        ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 shadow-xs'
                        : 'bg-[#12151c] border-white/15 text-white placeholder:text-zinc-500 focus:border-white/30'
                    }`}
                  />
                  {(adminStudentSearch || isSearchExpanded) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminStudentSearch('');
                        setIsSearchExpanded(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* FIRST-TIME STATE: When album has fewer than 5 profiles and nothing is awaiting approval */}
            {currentSet.students.length < 5 && pendingStudents.length === 0 && (
              <div
                id="first-time-share-invite-card"
                className="p-4 rounded-2xl bg-[#0c0d14] border border-[#d4af37]/35 space-y-3 shadow-md"
              >
                <div>
                  <h4 className="font-syne font-bold text-sm text-white">
                    Share your invite link
                  </h4>
                  <p className="font-body text-xs text-zinc-400 mt-0.5">
                    Share this link with your class. Everyone fills in their own profile, and you approve them.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#08090e] border border-white/10 font-mono-tech text-xs text-zinc-300 truncate select-all">
                  {getSubmitUrl(currentSet)}
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono-tech text-xs">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyUrlToClipboard(getSubmitUrl(currentSet));
                      setCopiedInviteSheetLink(true);
                      setTimeout(() => setCopiedInviteSheetLink(false), 2000);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e5c14d] text-black font-syne font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedInviteSheetLink ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedInviteSheetLink ? 'Copied' : 'Copy'}</span>
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Submit your official graduating profile for ${currentSet.departmentName} (Class of ${currentSet.graduationYear}):\n${getSubmitUrl(currentSet)}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-emerald-300 font-syne font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowInviteSheetQr((prev) => !prev)}
                    className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-syne font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>QR</span>
                  </button>
                </div>

                {showInviteSheetQr && (
                  <div className="pt-2 flex flex-col items-center gap-1.5 border-t border-white/10">
                    <div className="p-2.5 bg-white rounded-xl">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                          getSubmitUrl(currentSet)
                        )}`}
                        alt="Invite Link QR Code"
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <span className="font-mono-tech text-[10px] text-zinc-400">
                      Scan to submit classmate profile
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Add Classmate & Edit Classmate both use the unified EditStudentModal aligned with the Invite Form */}

            {/* =====================================================================
                VIEW 1: ALL VIEW (RESIZED PROFILE CARDS MATCHING SCREENSHOT 1 + DETAILS)
               ===================================================================== */}
            {studentDirectoryTab === 'all' && (
              <div className="space-y-2.5">
                {/* Sticky One-line Pending Approval Banner */}
                {pendingStudents.length > 0 && (
                  <button
                    id="all-tab-pending-approval-banner"
                    type="button"
                    onClick={() => {
                      setStudentDirectoryTab('pending');
                      setIsMoreFilterOpen(false);
                      scrollClipIntoView(document.getElementById('admin-subtab-pending'));
                    }}
                    className={`sticky top-[106px] sm:top-[112px] z-30 w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono-tech transition-colors cursor-pointer backdrop-blur-md shadow-md ${
                      isLightMode
                        ? 'bg-amber-50/95 hover:bg-amber-100/95 border-amber-300 text-amber-900'
                        : 'bg-[#1c1810]/95 hover:bg-[#262015]/95 border-[#d9b648]/45 text-[#d9b648]'
                    }`}
                  >
                    <span className="truncate font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      <span>
                        {pendingStudents.length} {pendingStudents.length === 1 ? 'profile needs' : 'profiles need'} approval · Review
                      </span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}

                <div className="space-y-2.5">
                  {/* First Card: Admin's own profile tagged "You · Admin" with Edit link */}
                  {myProfile && (() => {
                    const normName = (myProfile.fullName || '').trim().toLowerCase();
                    const normNick = (myProfile.nickname || '').trim().toLowerCase();
                    const myAwards = (currentSet.awards || []).filter((a) => {
                      const wName = (a.winnerName || '').trim().toLowerCase();
                      const wNick = (a.winnerNickname || '').trim().toLowerCase();
                      if (normName && wName === normName) return true;
                      if (normNick && wNick && wNick === normNick) return true;
                      if (myProfile.photoUrl && a.winnerAvatar && a.winnerAvatar === myProfile.photoUrl) return true;
                      return false;
                    });
                    const myPersonalStory = (myProfile.bio || myProfile.quote || '').trim();
                    return (
                      <div
                        id="admin-top-my-profile-row"
                        onClick={() => {
                          setInspectedProfileRow(myProfile);
                          setBottomSheetActionMode('none');
                        }}
                        className="p-4 rounded-2xl bg-[#0e1117] border border-white/[0.08] hover:border-white/20 transition-all flex items-start justify-between gap-3.5 cursor-pointer shadow-sm"
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          {myProfile.photoUrl ? (
                            <img
                              src={myProfile.photoUrl}
                              alt={myProfile.fullName}
                              className="w-16 h-20 rounded-xl object-cover border border-[#d4af37]/40 shrink-0 bg-black"
                            />
                          ) : (
                            <div className="w-16 h-20 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] font-syne font-bold text-base shrink-0">
                              {myProfile.fullName ? myProfile.fullName.charAt(0).toUpperCase() : 'A'}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className="font-mono-tech text-[10px] sm:text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold truncate">
                                {myProfile.position || 'CLASS REPRESENTATIVE'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] font-bold shrink-0">
                                You · Admin
                              </span>
                              <span className="text-[10px] font-mono-tech text-emerald-400">
                                • Approved
                              </span>
                            </div>
                            <p className="font-syne font-bold text-sm sm:text-base text-white truncate mt-0.5">
                              {myProfile.fullName}
                            </p>
                            {myProfile.nickname && (
                              <p className="font-mono-tech text-xs text-zinc-400 truncate mt-0.5">
                                "{myProfile.nickname}"
                              </p>
                            )}
                            {myAwards.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {myAwards.map((award) => (
                                  <span
                                    key={award.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d4af37]/15 border border-[#d4af37]/30 text-[10px] font-mono-tech text-[#d4af37] font-semibold truncate max-w-full"
                                  >
                                    <Trophy className="w-2.5 h-2.5 shrink-0 text-[#d4af37]" />
                                    <span className="truncate">{award.category}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {myPersonalStory && (
                              <p className="font-body italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                "{myPersonalStory.replace(/^["“”']+|["“”']+$/g, '')}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            id="edit-top-my-profile-btn"
                            type="button"
                            onClick={() => setEditingStudent(myProfile)}
                            className="text-xs font-mono-tech text-[#d4af37] hover:underline font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Approved Classmate Profile Cards (20 at a time) */}
                  {adminAllStudents
                    .filter((s) => s.id !== myProfile?.id)
                    .slice(0, visiblePeopleCount)
                    .map((student) => {
                      const roleLabel = (student.position?.trim() || 'Member').toUpperCase();
                      const normName = (student.fullName || '').trim().toLowerCase();
                      const normNick = (student.nickname || '').trim().toLowerCase();
                      const studentAwards = (currentSet.awards || []).filter((a) => {
                        const wName = (a.winnerName || '').trim().toLowerCase();
                        const wNick = (a.winnerNickname || '').trim().toLowerCase();
                        if (normName && wName === normName) return true;
                        if (normNick && wNick && wNick === normNick) return true;
                        if (student.photoUrl && a.winnerAvatar && a.winnerAvatar === student.photoUrl) return true;
                        return false;
                      });
                      const personalStory = (student.bio || student.quote || '').trim();
                      return (
                        <div
                          key={student.id}
                          onClick={() => {
                            setInspectedProfileRow(student);
                            setBottomSheetActionMode('none');
                          }}
                          className="p-4 rounded-2xl bg-[#0e1117] border border-white/[0.08] hover:border-white/20 transition-all flex items-start justify-between gap-3.5 cursor-pointer shadow-sm"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <img
                              src={student.photoUrl}
                              alt={student.fullName}
                              className="w-16 h-20 rounded-xl object-cover border border-white/10 shrink-0 bg-black"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono-tech text-[10px] sm:text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold truncate">
                                  {roleLabel}
                                </span>
                                <span className="text-[10px] font-mono-tech text-emerald-400">
                                  • Approved
                                </span>
                              </div>
                              <p className="font-syne font-bold text-sm sm:text-base text-white truncate mt-0.5">
                                {student.fullName}
                              </p>
                              {student.nickname && (
                                <p className="font-mono-tech text-xs text-zinc-400 truncate mt-0.5">
                                  "{student.nickname}"
                                </p>
                              )}
                              {studentAwards.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {studentAwards.map((award) => (
                                    <span
                                      key={award.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d4af37]/15 border border-[#d4af37]/30 text-[10px] font-mono-tech text-[#d4af37] font-semibold truncate max-w-full"
                                    >
                                      <Trophy className="w-2.5 h-2.5 shrink-0 text-[#d4af37]" />
                                      <span className="truncate">{award.category}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {personalStory && (
                                <p className="font-body italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                  "{personalStory.replace(/^["“”']+|["“”']+$/g, '')}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setEditingStudent(student)}
                              className="text-xs font-mono-tech text-[#d4af37] hover:underline font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {adminAllStudents.filter((s) => s.id !== myProfile?.id).length > visiblePeopleCount && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setVisiblePeopleCount((prev) => prev + 20)}
                      className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
                    >
                      Show more ({adminAllStudents.filter((s) => s.id !== myProfile?.id).length - visiblePeopleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* =====================================================================
                VIEW 2: LEADERS VIEW (RESIZED PROFILE CARDS + REORDER)
               ===================================================================== */}
            {studentDirectoryTab === 'leaders' && (
              <div className="space-y-2.5">
                {adminLeaders.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[#0e1117] border border-white/10 space-y-1.5">
                    <Crown className="w-7 h-7 text-amber-400/40 mx-auto" />
                    <p className="text-sm font-syne text-white">No leadership profiles yet</p>
                    <p className="text-xs text-zinc-400">
                      Approved profiles with leadership roles appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className={`px-1 font-mono-tech text-xs ${isLightMode ? 'text-slate-500' : 'text-zinc-500'}`}>
                      Hold &amp; drag to reorder
                    </p>
                    {adminLeaders.slice(0, visiblePeopleCount).map((leader, index) => {
                      const isAdminRow = myProfile && leader.id === myProfile.id;
                      const isBeingDragged = draggedLeaderIndex === index;
                      const isDragTarget =
                        dragOverLeaderIndex === index &&
                        draggedLeaderIndex !== null &&
                        draggedLeaderIndex !== index;
                      return (
                        <div
                          key={leader.id}
                          id={`admin-leader-row-${leader.id}`}
                          data-leader-row-idx={index}
                          draggable={false}
                          onContextMenu={(e) => {
                            e.preventDefault();
                          }}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            if ((e.target as HTMLElement).closest('button')) return;
                            if (leaderHoldTimerRef.current) {
                              window.clearTimeout(leaderHoldTimerRef.current);
                            }
                            leaderDidDragRef.current = false;
                            leaderTouchStartPosRef.current = { x: e.clientX, y: e.clientY };
                            leaderHoldTimerRef.current = window.setTimeout(() => {
                              leaderDidDragRef.current = true;
                              activeLeaderDragIdxRef.current = index;
                              activeLeaderTargetIdxRef.current = index;
                              setDraggedLeaderIndex(index);
                              setDragOverLeaderIndex(index);
                            }, 130);
                          }}
                          onTouchStart={(e) => {
                            if ((e.target as HTMLElement).closest('button')) return;
                            const touch = e.touches[0];
                            if (!touch) return;
                            if (leaderHoldTimerRef.current) {
                              window.clearTimeout(leaderHoldTimerRef.current);
                            }
                            leaderDidDragRef.current = false;
                            leaderTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                            leaderHoldTimerRef.current = window.setTimeout(() => {
                              leaderDidDragRef.current = true;
                              activeLeaderDragIdxRef.current = index;
                              activeLeaderTargetIdxRef.current = index;
                              setDraggedLeaderIndex(index);
                              setDragOverLeaderIndex(index);
                            }, 150);
                          }}
                          onClick={() => {
                            if (leaderDidDragRef.current) return;
                            setInspectedProfileRow(leader);
                            setBottomSheetActionMode('none');
                          }}
                          className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3.5 cursor-grab active:cursor-grabbing select-none shadow-sm ${
                            isLightMode
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0e1117] text-white'
                          } ${
                            isBeingDragged
                              ? 'kohot-drag-active-card border-[#d4af37] ring-2 ring-[#d4af37]/60 scale-[1.01] shadow-xl z-20'
                              : isLightMode
                              ? 'border-slate-200 hover:border-slate-300'
                              : 'border-white/[0.08] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <img
                              src={leader.photoUrl}
                              alt={leader.fullName}
                              className="w-16 h-20 rounded-xl object-cover border border-[#d4af37]/30 shrink-0 bg-black pointer-events-none"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 font-mono-tech text-[10px] text-amber-300 font-bold">
                                  #{index + 1}
                                </span>
                                <span className="font-mono-tech text-[10px] sm:text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold truncate">
                                  {(leader.position || 'Leader').toUpperCase()}
                                </span>
                                {isAdminRow && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] font-bold shrink-0">
                                    You · Admin
                                  </span>
                                )}
                                <span className="text-[10px] font-mono-tech text-emerald-400">
                                  • Approved
                                </span>
                              </div>
                              <p className="font-syne font-bold text-sm sm:text-base text-white truncate mt-0.5">
                                {leader.fullName}
                              </p>
                                {leader.nickname && (
                                  <p className="font-mono-tech text-xs text-zinc-400 truncate mt-0.5">
                                    "{leader.nickname}"
                                  </p>
                                )}
                                {(() => {
                                  const normName = (leader.fullName || '').trim().toLowerCase();
                                  const normNick = (leader.nickname || '').trim().toLowerCase();
                                  const leaderAwards = (currentSet.awards || []).filter((a) => {
                                    const wName = (a.winnerName || '').trim().toLowerCase();
                                    const wNick = (a.winnerNickname || '').trim().toLowerCase();
                                    if (normName && wName === normName) return true;
                                    if (normNick && wNick && wNick === normNick) return true;
                                    if (leader.photoUrl && a.winnerAvatar && a.winnerAvatar === leader.photoUrl) return true;
                                    return false;
                                  });
                                  if (leaderAwards.length === 0) return null;
                                  return (
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      {leaderAwards.map((award) => (
                                        <span
                                          key={award.id}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d4af37]/15 border border-[#d4af37]/30 text-[10px] font-mono-tech text-[#d4af37] font-semibold truncate max-w-full"
                                        >
                                          <Trophy className="w-2.5 h-2.5 shrink-0 text-[#d4af37]" />
                                          <span className="truncate">{award.category}</span>
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()}
                                {(leader.bio || leader.quote) && (
                                  <p className="font-body italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                    "{(leader.bio || leader.quote || '').replace(/^["“”']+|["“”']+$/g, '')}"
                                  </p>
                                )}
                              </div>
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setEditingStudent(leader)}
                              className="text-xs font-mono-tech text-[#d4af37] hover:underline font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {adminLeaders.length > visiblePeopleCount && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setVisiblePeopleCount((prev) => prev + 20)}
                      className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
                    >
                      Show more ({adminLeaders.length - visiblePeopleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* =====================================================================
                VIEW 3: PENDING VIEW (COMPACT PENDING CARDS WITH APPROVE & DECLINE)
               ===================================================================== */}
            {studentDirectoryTab === 'pending' && (
              <div className="space-y-2.5">
                {pendingStudents.length > 0 && (
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span
                      className={`font-mono-tech text-xs ${
                        isLightMode ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      {pendingStudents.length} awaiting approval
                    </span>
                  </div>
                )}

                {pendingStudents.length === 0 ? (
                  currentSet.students.length < 5 ? null : (
                    <div
                      className={`p-6 text-center rounded-2xl border space-y-1.5 ${
                        isLightMode
                          ? 'bg-white border-slate-200 text-slate-900'
                          : 'bg-[#141821] border-white/[0.06] text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                      <p className="text-sm font-syne font-bold">No Pending Submissions</p>
                      <p className="text-xs font-body text-zinc-400">
                        Share the invitation link to receive classmate profile submissions.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-2.5">
                    {pendingStudents.slice(0, visiblePeopleCount).map((student) => {
                      const isPaid = isStudentSlotFree(student);
                      const canApprove = isPaid || slotBalance > 0;
                      const initials = getStudentInitials(student.fullName);

                      return (
                        <div
                          key={student.id}
                          id={`pending-student-row-${student.id}`}
                          onClick={() => {
                            setInspectedProfileRow(student);
                            setBottomSheetActionMode('none');
                          }}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isLightMode
                              ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                              : 'bg-[#0e1117] border-white/[0.08] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {student.photoUrl ? (
                              <img
                                src={student.photoUrl}
                                alt={student.fullName}
                                className="w-14 h-16 sm:w-16 sm:h-20 rounded-xl object-cover border border-white/10 shrink-0 bg-black"
                              />
                            ) : (
                              <div
                                className={`w-14 h-16 sm:w-16 sm:h-20 rounded-xl flex items-center justify-center font-syne font-bold text-xs shrink-0 ${
                                  isLightMode
                                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                    : 'bg-white/5 text-zinc-300 border border-white/10'
                                }`}
                              >
                                {initials}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${
                                    student.isProfileUpdate ? 'bg-sky-400' : 'bg-amber-500'
                                  }`}
                                />
                                <span
                                  className={`font-mono-tech text-[10px] uppercase tracking-wider font-bold ${
                                    student.isProfileUpdate
                                      ? 'text-sky-600 dark:text-sky-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {student.isProfileUpdate
                                    ? 'Profile update · Needs approval'
                                    : 'Needs approval'}
                                </span>
                              </div>
                              <p
                                className={`font-syne font-bold text-sm sm:text-base truncate ${
                                  isLightMode ? 'text-slate-900' : 'text-white'
                                }`}
                              >
                                {student.fullName}
                              </p>
                              {student.nickname && (
                                <p className="font-mono-tech text-[11px] text-zinc-400 truncate mt-0.5">
                                  "{student.nickname}"
                                </p>
                              )}
                              <p
                                className={`font-mono-tech text-xs font-medium mt-0.5 truncate ${
                                  student.isProfileUpdate
                                    ? isLightMode
                                      ? 'text-sky-600'
                                      : 'text-sky-400'
                                    : isPaid
                                    ? isLightMode
                                      ? 'text-emerald-600'
                                      : 'text-emerald-400'
                                    : isLightMode
                                    ? 'text-amber-600'
                                    : 'text-amber-400'
                                }`}
                              >
                                {student.isProfileUpdate
                                  ? 'Updated profile · uses no slot'
                                  : isPaid
                                  ? 'Paid · uses no slot'
                                  : 'Not paid · uses 1 slot'}
                              </p>
                            </div>
                          </div>

                          <div
                            className="flex flex-wrap items-center justify-end gap-2.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              id={`decline-btn-${student.id}`}
                              type="button"
                              onClick={() => handlePromptDeclineStudent(student)}
                              className={`px-2 py-1.5 font-syne font-bold text-xs transition-colors cursor-pointer bg-transparent border-0 ${
                                isLightMode
                                  ? 'text-red-600 hover:text-red-700'
                                  : 'text-red-400 hover:text-red-300'
                              }`}
                            >
                              Decline
                            </button>

                            {canApprove ? (
                              isPaid ? (
                                <button
                                  id={`approve-btn-${student.id}`}
                                  type="button"
                                  onClick={() => handleApproveStudent(student.id)}
                                  className={`px-3.5 py-2 rounded-full font-syne font-bold text-xs transition-colors cursor-pointer ${
                                    isLightMode
                                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                      : 'bg-white hover:bg-zinc-200 text-black'
                                  }`}
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  id={`approve-btn-${student.id}`}
                                  type="button"
                                  onClick={() => handleApproveStudent(student.id)}
                                  className={`px-3.5 py-2 rounded-full border font-syne font-bold text-xs transition-colors cursor-pointer ${
                                    isLightMode
                                      ? 'bg-amber-50 hover:bg-amber-100 border-amber-500/60 text-amber-800'
                                      : 'bg-transparent hover:bg-[#d9b648]/15 border-[#d9b648]/60 text-[#d9b648]'
                                  }`}
                                >
                                  Approve
                                </button>
                              )
                            ) : (
                              <button
                                id={`buy-slots-to-approve-btn-${student.id}`}
                                type="button"
                                onClick={() => setIsBuySlotsModalOpen(true)}
                                className={`px-3.5 py-2 rounded-full border font-syne font-bold text-xs transition-colors cursor-pointer whitespace-nowrap ${
                                  isLightMode
                                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-500/60 text-amber-800'
                                    : 'bg-transparent hover:bg-[#d9b648]/15 border-[#d9b648]/60 text-[#d9b648]'
                                }`}
                              >
                                Buy slots
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {pendingStudents.length > visiblePeopleCount && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setVisiblePeopleCount((prev) => prev + 20)}
                      className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
                    >
                      Show more ({pendingStudents.length - visiblePeopleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* =====================================================================
                VIEW 5: DECLINED / DELETED VIEW (ONLY EDIT, RESTORE, OR DELETE PERMANENTLY)
               ===================================================================== */}
            {studentDirectoryTab === 'declined' && (
              <div className="space-y-2.5">
                {declinedStudents.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[#0e1117] border border-white/10 space-y-1.5">
                    <p className="text-sm font-syne text-white">No declined or deleted profiles</p>
                    <p className="text-xs text-zinc-400">
                      Declined or deleted profiles appear here so you can edit, restore, or delete them permanently.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {declinedStudents.slice(0, visiblePeopleCount).map((student) => {
                      const isRemoved = getStudentEffectiveStatus(student) === 'removed';
                      return (
                        <div
                          key={student.id}
                          onClick={() => {
                            setInspectedProfileRow(student);
                            setBottomSheetActionMode('none');
                          }}
                          className="p-4 rounded-2xl bg-[#0e1117] border border-white/[0.08] hover:border-white/20 transition-all flex items-start justify-between gap-3.5 cursor-pointer shadow-sm"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <img
                              src={student.photoUrl}
                              alt={student.fullName}
                              className="w-16 h-20 rounded-xl object-cover border border-white/10 shrink-0 bg-black"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono-tech text-[10px] sm:text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold truncate">
                                  {(student.position || 'Member').toUpperCase()}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-[10px] font-mono-tech text-red-300 font-semibold">
                                  {isRemoved ? 'Deleted · Recoverable' : 'Declined · Recoverable'}
                                </span>
                              </div>
                              <p className="font-syne font-bold text-sm sm:text-base text-white truncate mt-0.5">
                                {student.fullName}
                              </p>
                              {student.nickname && (
                                <p className="font-mono-tech text-xs text-zinc-400 truncate mt-0.5">
                                  "{student.nickname}"
                                </p>
                              )}
                              {student.declineReason && (
                                <p className="font-mono-tech text-[11px] text-red-400 line-clamp-1 mt-0.5">
                                  Reason: {student.declineReason}
                                </p>
                              )}
                              {student.quote && !student.declineReason && (
                                <p className="font-body italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                  "{student.quote}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            className="flex flex-wrap items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setEditingStudent(student)}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono-tech text-white font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreDeletedOrRejectedStudent(student)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-mono-tech text-emerald-300 font-semibold cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePermanentDeleteStudent(student.id)}
                              className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/35 text-xs font-mono-tech text-red-300 font-semibold flex items-center gap-1 cursor-pointer"
                              title="Delete profile permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Permanently</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {declinedStudents.length > visiblePeopleCount && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setVisiblePeopleCount((prev) => prev + 20)}
                      className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
                    >
                      Show more ({declinedStudents.length - visiblePeopleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* =====================================================================
                BOTTOM SHEET: PUBLIC ALBUM PROFILE PREVIEW + ADMIN ACTIONS
               ===================================================================== */}
            {inspectedProfileRow && (
              <div
                id="profile-row-bottom-sheet-backdrop"
                role="dialog"
                aria-modal="true"
                onClick={() => {
                  setInspectedProfileRow(null);
                  setBottomSheetActionMode('none');
                  setBottomSheetReasonInput('');
                }}
                className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-fadeIn overflow-hidden overscroll-none touch-none"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  data-modal-scrollable="true"
                  className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#121318] border border-white/15 shadow-2xl p-5 sm:p-6 pb-20 sm:pb-6 text-white space-y-5"
                >
                  {/* Sheet Handle & Close */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                        Public Album Card Preview
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono-tech uppercase text-[#d4af37]">
                        {getStudentEffectiveStatus(inspectedProfileRow) === 'removed'
                          ? 'deleted'
                          : getStudentEffectiveStatus(inspectedProfileRow).replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const target = inspectedProfileRow;
                          setInspectedProfileRow(null);
                          setEditingStudent(target);
                        }}
                        className="text-xs font-mono-tech text-[#d4af37] hover:underline font-semibold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedProfileRow(null);
                          setBottomSheetActionMode('none');
                          setBottomSheetReasonInput('');
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Exact Public Album Profile Representation */}
                  <div className="rounded-2xl bg-[#08090e] border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
                      <img
                        src={inspectedProfileRow.photoUrl}
                        alt={inspectedProfileRow.fullName}
                        className="w-full h-full rounded-2xl object-cover border border-white/15 bg-black"
                      />
                      {inspectedProfileRow.secondaryPhotoUrl && (
                        <img
                          src={inspectedProfileRow.secondaryPhotoUrl}
                          alt={`${inspectedProfileRow.fullName} second portrait`}
                          className="absolute bottom-1.5 right-1.5 w-10 h-10 rounded-lg object-cover border-2 border-white/85 shadow-lg bg-zinc-900"
                        />
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h4 className="font-syne font-bold text-lg text-white">
                          {inspectedProfileRow.fullName}
                        </h4>
                        {inspectedProfileRow.nickname && (
                          <span className="font-mono-tech text-xs text-zinc-400">
                            "{inspectedProfileRow.nickname}"
                          </span>
                        )}
                      </div>
                      {/* Social Icons & Email Icon right after Nickname */}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                        <SocialIconsRow
                          socials={inspectedProfileRow.socials}
                          instagramOrTwitter={inspectedProfileRow.instagramOrTwitter}
                          size="sm"
                          isLightMode={false}
                        />
                        {inspectedProfileRow.email && (
                          <a
                            href={`mailto:${inspectedProfileRow.email}`}
                            onClick={(e) => e.stopPropagation()}
                            title={`Email ${inspectedProfileRow.fullName} (${inspectedProfileRow.email})`}
                            className="w-7 h-7 rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/[0.15] text-zinc-200 hover:text-white flex items-center justify-center transition-all"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <p
                        className={`font-mono-tech text-xs uppercase font-bold ${
                          isLeaderProfile(inspectedProfileRow) ? 'text-[#d4af37]' : 'text-zinc-400'
                        }`}
                      >
                        {inspectedProfileRow.position || 'Member'}
                      </p>
                      {(() => {
                        const normName = (inspectedProfileRow.fullName || '').trim().toLowerCase();
                        const normNick = (inspectedProfileRow.nickname || '').trim().toLowerCase();
                        const rowAwards = (currentSet.awards || []).filter((a) => {
                          const wName = (a.winnerName || '').trim().toLowerCase();
                          const wNick = (a.winnerNickname || '').trim().toLowerCase();
                          if (normName && wName === normName) return true;
                          if (normNick && wNick && wNick === normNick) return true;
                          if (inspectedProfileRow.photoUrl && a.winnerAvatar && a.winnerAvatar === inspectedProfileRow.photoUrl) return true;
                          return false;
                        });
                        if (rowAwards.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                            {rowAwards.map((award) => (
                              <span
                                key={award.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/30 text-[10px] font-mono-tech text-[#d4af37] font-semibold"
                              >
                                <Trophy className="w-3 h-3 shrink-0 text-[#d4af37]" />
                                <span>{award.category}</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {(inspectedProfileRow.bio || inspectedProfileRow.quote) && (
                        <p className="font-body text-xs text-zinc-300 italic leading-relaxed pt-1">
                          "{(inspectedProfileRow.bio || inspectedProfileRow.quote || '').replace(/^["“”']+|["“”']+$/g, '')}"
                        </p>
                      )}
                      {inspectedProfileRow.declineReason && (
                        <p className="font-mono-tech text-[11px] text-red-400 pt-1">
                          Decline reason: {inspectedProfileRow.declineReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Extended Optional Profile Details in Preview */}
                  {((inspectedProfileRow.bio || inspectedProfileRow.quote) ||
                    inspectedProfileRow.favouriteCampusMemory ||
                    inspectedProfileRow.funFact ||
                    inspectedProfileRow.messageToClassmates ||
                    inspectedProfileRow.messageToFutureSet) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10 text-left">
                      {(inspectedProfileRow.bio || inspectedProfileRow.quote) && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 sm:col-span-2 space-y-1">
                          <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-[#d4af37]">
                            Personal Story
                          </span>
                          <p className="font-body text-xs text-zinc-300 leading-relaxed">
                            {inspectedProfileRow.bio || inspectedProfileRow.quote}
                          </p>
                        </div>
                      )}
                      {inspectedProfileRow.favouriteCampusMemory && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                          <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                            Favourite Campus Memory
                          </span>
                          <p className="font-body text-xs text-zinc-300 leading-relaxed">
                            {inspectedProfileRow.favouriteCampusMemory}
                          </p>
                        </div>
                      )}
                      {inspectedProfileRow.funFact && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                          <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                            Fun Fact About Me
                          </span>
                          <p className="font-body text-xs text-zinc-300 leading-relaxed">
                            {inspectedProfileRow.funFact}
                          </p>
                        </div>
                      )}
                      {inspectedProfileRow.messageToClassmates && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                          <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                            A Message to My Classmates
                          </span>
                          <p className="font-body text-xs text-zinc-300 leading-relaxed">
                            {inspectedProfileRow.messageToClassmates}
                          </p>
                        </div>
                      )}
                      {inspectedProfileRow.messageToFutureSet && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                          <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                            A Message to Future Set
                          </span>
                          <p className="font-body text-xs text-zinc-300 leading-relaxed">
                            {inspectedProfileRow.messageToFutureSet}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Reason Prompt for Decline */}
                  {bottomSheetActionMode === 'decline' && (
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 space-y-3">
                      <label className="block font-mono-tech text-xs text-white font-semibold">
                        Reason for declining this profile (optional):
                      </label>
                      <textarea
                        rows={2}
                        value={bottomSheetReasonInput}
                        onChange={(e) => setBottomSheetReasonInput(e.target.value)}
                        placeholder="e.g. Portrait is blurry or duplicate entry"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBottomSheetActionMode('none');
                            setBottomSheetReasonInput('');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-white/5 text-xs font-mono-tech text-zinc-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handlePromptDeclineStudent(
                              inspectedProfileRow,
                              bottomSheetReasonInput
                            );
                          }}
                          className="px-4 py-1.5 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer"
                        >
                          Confirm Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bottom Sheet Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStudentEffectiveStatus(inspectedProfileRow) === 'declined' ||
                      getStudentEffectiveStatus(inspectedProfileRow) === 'removed' ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreDeletedOrRejectedStudent(inspectedProfileRow)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono-tech text-xs cursor-pointer"
                        >
                          Restore
                        </button>
                      ) : getStudentEffectiveStatus(inspectedProfileRow) === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBottomSheetActionMode('decline');
                            setBottomSheetReasonInput(inspectedProfileRow.declineReason || '');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-mono-tech text-xs cursor-pointer"
                        >
                          Decline
                        </button>
                      ) : null}

                      {(!myProfile || inspectedProfileRow.id !== myProfile.id) &&
                        (getStudentEffectiveStatus(inspectedProfileRow) === 'declined' ||
                        getStudentEffectiveStatus(inspectedProfileRow) === 'removed' ? (
                          <button
                            type="button"
                            onClick={() => handlePermanentDeleteStudent(inspectedProfileRow.id)}
                            className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-mono-tech text-xs cursor-pointer"
                          >
                            Delete Permanently
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubmissionNoSlotReturn(inspectedProfileRow)}
                            className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-mono-tech text-xs cursor-pointer"
                          >
                            Delete
                          </button>
                        ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const target = inspectedProfileRow;
                        setInspectedProfileRow(null);
                        setEditingStudent(target);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer ml-auto"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* BUY PROFILE SLOTS MODAL */}
            <UniversalModal
              isOpen={isBuySlotsModalOpen}
              onClose={() => setIsBuySlotsModalOpen(false)}
              title="Buy Profile Slots"
              subtitle="Credit profile slots to approve unpaid classmate profiles"
              maxWidth="md"
            >
              <form onSubmit={handlePurchaseSlotsSubmit} className="space-y-4 p-1 text-xs font-body">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2">
                  <span className="font-mono-tech text-[11px] uppercase text-zinc-400">
                    Cohort Slot Rate
                  </span>
                  {cohortPricing?.kind === 'funding' && cohortPricing.isCovered ? (
                    <span className="font-mono-tech text-xs text-emerald-400 font-semibold">
                      <span className="line-through text-zinc-500 mr-1.5">
                        ₦{standardSlotPriceNaira.toLocaleString()}
                      </span>
                      Free, sponsored by {cohortPricing.sponsorName || 'KoHot'}
                    </span>
                  ) : cohortPricing?.kind === 'discount' ? (
                    <span className="font-mono-tech text-xs text-amber-300 font-semibold">
                      <span className="line-through text-zinc-500 mr-1.5">
                        ₦{standardSlotPriceNaira.toLocaleString()}
                      </span>
                      ₦{slotPriceNaira.toLocaleString()} / slot ({cohortPricing.discountPercent}% off)
                    </span>
                  ) : (
                    <span className="font-mono-tech text-xs text-white font-semibold">
                      ₦{slotPriceNaira.toLocaleString()} / slot
                    </span>
                  )}
                </div>
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase text-zinc-400 mb-1.5">
                    Number of Profile Slots *
                  </label>
                  <input
                    id="buy-slots-quantity-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={buySlotsInput}
                    placeholder="e.g. 25"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setBuySlotsInput(raw);
                      if (raw !== '') {
                        const parsed = parseInt(raw, 10);
                        if (!isNaN(parsed) && parsed >= 1) {
                          setBuySlotsCount(Math.min(1000, parsed));
                        }
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseInt(buySlotsInput, 10);
                      if (isNaN(parsed) || parsed < 1) {
                        setBuySlotsInput('1');
                        setBuySlotsCount(1);
                      } else {
                        const clamped = Math.min(1000, parsed);
                        setBuySlotsInput(String(clamped));
                        setBuySlotsCount(clamped);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-mono-tech text-sm focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase text-zinc-400 mb-1.5">
                    Sponsor Display Name (Optional, max 60 chars)
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={buySlotsSponsorName}
                    onChange={(e) => setBuySlotsSponsorName(e.target.value.slice(0, 60))}
                    placeholder="e.g. Class of '26 Exco or Alumni Sponsor"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-body text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={buySlotsShowSponsor}
                    onChange={(e) => setBuySlotsShowSponsor(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 text-[#d4af37]"
                  />
                  <span className="text-zinc-300 font-mono-tech text-xs">
                    Display sponsor credit on album
                  </span>
                </label>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsBuySlotsModalOpen(false)}
                    className="px-4 py-2 rounded-full bg-white/5 text-zinc-400 font-mono-tech text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBuyingSlots || !buySlotsInput || parseInt(buySlotsInput, 10) < 1}
                    className="px-5 py-2 rounded-full bg-[#d4af37] disabled:opacity-40 text-black font-syne font-bold text-xs uppercase cursor-pointer"
                  >
                    {isBuyingSlots
                      ? 'Opening Checkout...'
                      : `Pay ₦${((parseInt(buySlotsInput, 10) || 0) * slotPriceNaira).toLocaleString()} (${parseInt(buySlotsInput, 10) || 0} Slots)`}
                  </button>
                </div>
              </form>
            </UniversalModal>

            {isSlotPaystackOpen && (
              <PaystackModal
                isOpen={isSlotPaystackOpen}
                onClose={() => setIsSlotPaystackOpen(false)}
                amountNgn={buySlotsCount * slotPriceNaira}
                customerEmail={currentSet.classRepEmail || currentUser?.email || 'admin@kohot.ng'}
                customerName={displayedAdminName || 'Class Admin'}
                paymentType="slots"
                albumId={currentSet.id}
                quantity={buySlotsCount}
                sponsorName={buySlotsSponsorName.trim().slice(0, 60)}
                metadata={{
                  universityName: currentSet.institutionName,
                  departmentName: currentSet.departmentName,
                  graduationYear: currentSet.graduationYear,
                  classSetName: currentSet.classSetName,
                }}
                onSuccess={handleSlotPaystackVerified}
              />
            )}

            {/* EDIT SPONSOR DISPLAY MODAL (Rule 6: Never changes amount, quantity, reference, slots used, or balance) */}
            <UniversalModal
              isOpen={Boolean(editingSponsorItem)}
              onClose={() => setEditingSponsorItem(null)}
              title="Edit Sponsor Display"
              subtitle="Only display name and visibility can be edited. Amount, quantity, reference, and balances are immutable."
              maxWidth="md"
              zIndex={9998}
            >
              {editingSponsorItem && (
                <form onSubmit={handleSaveSponsorEdit} className="space-y-4 p-1 text-xs font-body">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono-tech text-[11px] text-zinc-400 space-y-1">
                    <div>
                      Reference:{' '}
                      <span className="text-white">
                        {getSponsorReference(editingSponsorItem)}
                      </span>{' '}
                      (Locked)
                    </div>
                    <div>
                      Quantity:{' '}
                      <span className="text-[#d4af37] font-bold">
                        {getSponsorSlotQuantity(editingSponsorItem)} slots
                      </span>{' '}
                      (Locked)
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase text-zinc-400 mb-1.5">
                      Sponsor Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editSponsorNameText}
                      onChange={(e) => setEditSponsorNameText(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editSponsorVisibleToggle}
                      onChange={(e) => setEditSponsorVisibleToggle(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-[#d4af37]"
                    />
                    <span className="text-zinc-300 font-mono-tech text-xs">
                      Show sponsor credit on album
                    </span>
                  </label>
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditingSponsorItem(null)}
                      className="px-4 py-2 rounded-full bg-white/5 text-zinc-400 font-mono-tech text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-full bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer"
                    >
                      Save Sponsor Display
                    </button>
                  </div>
                </form>
              )}
            </UniversalModal>

            {/* SLOTS DETAILS BOTTOM SHEET (Opened by "Slot balance & ledger details ›") */}
            {isSlotDetailsSheetOpen && !editingSponsorItem && (
              <div
                id="slot-details-bottom-sheet-backdrop"
                role="dialog"
                aria-modal="true"
                onClick={() => setIsSlotDetailsSheetOpen(false)}
                className="fixed inset-0 z-[9992] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn overflow-hidden overscroll-none touch-none"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  data-modal-scrollable="true"
                  className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#10121a] border-t sm:border border-white/15 p-5 sm:p-6 text-white space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h4 className="font-syne font-bold text-base text-white">
                      Profile Slots Details
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsSlotDetailsSheetOpen(false)}
                      className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Acquired / Used / Available stats */}
                  <div className="grid grid-cols-3 gap-2 text-center font-mono-tech">
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                      <span className="block text-[10px] uppercase text-zinc-400">Acquired</span>
                      <span className="font-syne font-extrabold text-lg text-white">
                        {totalSlotsCredited}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                      <span className="block text-[10px] uppercase text-zinc-400">Used</span>
                      <span className="font-syne font-extrabold text-lg text-amber-300">
                        {totalSlotsUsed}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                      <span className="block text-[10px] uppercase text-zinc-400">Available</span>
                      <span className="font-syne font-extrabold text-lg text-emerald-400">
                        {slotBalance}
                      </span>
                    </div>
                  </div>

                  {/* Explanatory sentence */}
                  <p className="font-body text-xs text-zinc-300 leading-relaxed">
                    Paid student profiles use 0 slots. Unpaid profiles use 1 slot when you approve them.
                  </p>

                  {/* Purchases and sponsors list with sponsor editing */}
                  <div className="space-y-2">
                    <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
                      Purchases &amp; Sponsors
                    </span>
                    {slotPurchasesList.length === 0 ? (
                      <p className="font-body text-xs text-zinc-500">
                        No slot purchases or sponsor credits recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {slotPurchasesList.map((sp: any) => {
                          const isKoHot =
                            Boolean(sp.is_kohot_credit) ||
                            Boolean(sp.isKoHotCredit) ||
                            String(sp.sponsor_name || sp.sponsorName || '').toLowerCase() === 'kohot';
                          const name = sp.sponsor_name || sp.sponsorName || 'Class Sponsor';
                          const qty = getSponsorSlotQuantity(sp);
                          const visible =
                            sp.show_sponsor_on_album !== undefined
                              ? Boolean(sp.show_sponsor_on_album)
                              : sp.showSponsorOnAlbum !== undefined
                              ? Boolean(sp.showSponsorOnAlbum)
                              : sp.showSponsorNameOnAlbum !== false;
                          return (
                            <div
                              key={sp.id}
                              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2 text-xs font-mono-tech"
                            >
                              <div className="min-w-0">
                                <span className="text-[#d4af37] font-bold">{name}</span>{' '}
                                <span className="text-zinc-400">({qty} slots)</span>
                                {!visible && (
                                  <span className="text-[10px] text-zinc-500 uppercase ml-1.5">
                                    [Hidden]
                                  </span>
                                )}
                              </div>
                              {isKoHot ? (
                                <span className="text-[10px] text-emerald-400 uppercase font-bold">
                                  KoHot Credit
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSponsorItem(sp);
                                    setEditSponsorNameText(name);
                                    setEditSponsorVisibleToggle(visible);
                                  }}
                                  className="text-zinc-300 hover:text-white underline cursor-pointer shrink-0"
                                >
                                  Edit sponsor
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* View full history toggle */}
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowFullSlotHistory((prev) => !prev)}
                      className="text-xs font-mono-tech text-[#d4af37] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showFullSlotHistory ? 'Hide full history' : 'View full history'}</span>
                    </button>

                    {showFullSlotHistory && (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {slotLedgerList.length === 0 ? (
                          <p className="font-mono-tech text-[11px] text-zinc-500">
                            No ledger entries recorded yet.
                          </p>
                        ) : (
                          slotLedgerList.map((entry: any) => (
                            <div
                              key={entry.id}
                              className="p-2 rounded-lg bg-[#08090e] border border-white/10 flex items-center justify-between gap-2 text-[11px] font-mono-tech"
                            >
                              <div className="min-w-0">
                                <span className="text-white uppercase">{entry.entry_type}</span>
                                {entry.sponsor_name && (
                                  <span className="text-zinc-400 ml-1.5">· {entry.sponsor_name}</span>
                                )}
                                {entry.note && (
                                  <p className="text-[10px] text-zinc-500 truncate">{entry.note}</p>
                                )}
                              </div>
                              <span
                                className={`font-bold shrink-0 ${
                                  Number(entry.quantity) >= 0 ? 'text-emerald-400' : 'text-amber-300'
                                }`}
                              >
                                {Number(entry.quantity) > 0 ? `+${entry.quantity}` : entry.quantity}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Buy slots button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSlotDetailsSheetOpen(false);
                        setIsBuySlotsModalOpen(true);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#d4af37] hover:bg-[#e5c14d] text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Buy slots
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* INVITE CLASSMATES BOTTOM SHEET (Opened by gold INVITE button) */}
            {isInviteBottomSheetOpen && (
              <div
                id="invite-classmates-bottom-sheet-backdrop"
                role="dialog"
                aria-modal="true"
                onClick={() => setIsInviteBottomSheetOpen(false)}
                className="fixed inset-0 z-[9992] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn overflow-hidden overscroll-none touch-none"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  data-modal-scrollable="true"
                  className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#10121a] border-t sm:border border-white/15 p-5 sm:p-6 text-white space-y-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h4 className="font-syne font-bold text-base text-white">
                      Invite classmates
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsInviteBottomSheetOpen(false)}
                      className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="font-body text-xs text-zinc-300 leading-relaxed">
                    Share this link with your class. Everyone fills in their own profile, and you approve them.
                  </p>

                  <div className="p-3 rounded-xl bg-[#08090e] border border-white/10 font-mono-tech text-xs text-zinc-200 truncate select-all">
                    {getSubmitUrl(currentSet)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono-tech text-xs">
                    <button
                      id="invite-sheet-copy-link-btn"
                      type="button"
                      onClick={async () => {
                        await copyUrlToClipboard(getSubmitUrl(currentSet));
                        setCopiedInviteSheetLink(true);
                        setTimeout(() => setCopiedInviteSheetLink(false), 2000);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-[#d4af37] hover:bg-[#e5c14d] text-black font-syne font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedInviteSheetLink ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedInviteSheetLink ? 'Copied' : 'Copy link'}</span>
                    </button>

                    <a
                      id="invite-sheet-whatsapp-btn"
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Submit your official graduating profile for ${currentSet.departmentName} (Class of ${currentSet.graduationYear}):\n${getSubmitUrl(currentSet)}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-emerald-300 font-syne font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      id="invite-sheet-qr-btn"
                      type="button"
                      onClick={() => setShowInviteSheetQr((prev) => !prev)}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-syne font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>QR code</span>
                    </button>
                  </div>

                  {showInviteSheetQr && (
                    <div className="pt-2 flex flex-col items-center gap-2 border-t border-white/10">
                      <div className="p-3 bg-white rounded-2xl">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                            getSubmitUrl(currentSet)
                          )}`}
                          alt="Invite Classmates QR Code"
                          className="w-36 h-36 object-contain"
                        />
                      </div>
                      <span className="font-mono-tech text-[10px] text-zinc-400">
                        Scan to open classmate invite form
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            ALBUM DESIGN MODAL (OPENED FROM FRONT DASHBOARD CARD ABOVE PUBLISH)
            ========================================================================= */}
        <UniversalModal
          isOpen={isAlbumDesignModalOpen}
          onClose={() => setIsAlbumDesignModalOpen(false)}
          title="Album Edit — General Info, Design & Social Links"
          subtitle="Edit your class motto/slogan, department & set details, cover imagery, and official social handles"
          maxWidth="4xl"
        >
          <div className="space-y-6 p-1">
            {imagerySaveToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono-tech text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{imagerySaveToast}</span>
              </div>
            )}

            {/* SECTION 0: GENERAL DEPARTMENT & CLASS SET DETAILS + CLASS MOTTO / SLOGAN */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-syne font-bold text-base text-white">
                    General Department &amp; Class Information
                  </h4>
                  <p className="text-xs text-zinc-400 font-mono-tech mt-0.5">
                    Edit your class motto/slogan, department name, set moniker, graduation year, and album admin details
                  </p>
                </div>
                <span className="text-[10px] font-mono-tech uppercase tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-1 rounded-full border border-[#d4af37]/30 shrink-0">
                  Core Album Details
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="sm:col-span-2">
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-semibold">
                    Class Motto / Slogan
                  </label>
                  <input
                    id="album-edit-class-slogan-input"
                    type="text"
                    maxLength={140}
                    value={editClassSlogan}
                    onChange={(e) => setEditClassSlogan(e.target.value)}
                    placeholder="e.g. Breaking Boundaries, Shaping Horizons"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-semibold">
                    Department Name
                  </label>
                  <input
                    id="album-edit-department-name-input"
                    type="text"
                    value={editDeptName}
                    onChange={(e) => setEditDeptName(e.target.value)}
                    placeholder="e.g. Department of Public Law"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-semibold">
                    Class Set Name / Moniker
                  </label>
                  <input
                    id="album-edit-class-set-name-input"
                    type="text"
                    value={editClassSetName}
                    onChange={(e) => setEditClassSetName(e.target.value)}
                    placeholder="e.g. The Frontiers Set"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-semibold">
                    Graduation Year
                  </label>
                  <input
                    id="album-edit-graduation-year-input"
                    type="number"
                    min={1960}
                    max={2100}
                    value={editGraduationYear}
                    onChange={(e) => setEditGraduationYear(e.target.value)}
                    placeholder="2025"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-semibold">
                    Album Admin / Class Rep Name
                  </label>
                  <input
                    id="album-edit-class-rep-name-input"
                    type="text"
                    value={editClassRepName}
                    onChange={(e) => setEditClassRepName(e.target.value)}
                    placeholder="e.g. Oluwatobi James"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                      Convocation Date (Optional)
                    </label>
                    {editConvocationDate && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 font-mono-tech text-[10px] text-amber-300">
                        {editConvocationDate}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const parseToIsoAndDmy = (raw: string) => {
                      const trimmed = (raw || '').trim();
                      if (!trimmed) return { iso: '', dmy: '' };
                      const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
                      if (isoMatch) {
                        const y = isoMatch[1];
                        const m = isoMatch[2].padStart(2, '0');
                        const d = isoMatch[3].padStart(2, '0');
                        return { iso: `${y}-${m}-${d}`, dmy: `${d}/${m}/${y}` };
                      }
                      const dmyWordMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
                      if (dmyWordMatch) {
                        const d = dmyWordMatch[1].padStart(2, '0');
                        const mIdx = MONTH_NAMES.findIndex((mn) =>
                          mn.toLowerCase().startsWith(dmyWordMatch[2].toLowerCase().slice(0, 3))
                        );
                        const m = String(mIdx >= 0 ? mIdx + 1 : 11).padStart(2, '0');
                        const y = dmyWordMatch[3];
                        return { iso: `${y}-${m}-${d}`, dmy: `${d}/${m}/${y}` };
                      }
                      const myWordMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
                      if (myWordMatch) {
                        const mIdx = MONTH_NAMES.findIndex((mn) =>
                          mn.toLowerCase().startsWith(myWordMatch[1].toLowerCase().slice(0, 3))
                        );
                        const m = String(mIdx >= 0 ? mIdx + 1 : 11).padStart(2, '0');
                        const y = myWordMatch[2];
                        return { iso: `${y}-${m}-18`, dmy: `18/${m}/${y}` };
                      }
                      return { iso: '', dmy: trimmed };
                    };
                    const { iso, dmy } = parseToIsoAndDmy(editConvocationDate);
                    return (
                      <div className="relative w-full cursor-pointer">
                        <div className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-mono-tech text-xs flex items-center justify-between pointer-events-none">
                          <span className={dmy ? 'text-white' : 'text-zinc-500'}>
                            {dmy || 'dd/mm/yyyy'}
                          </span>
                          <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                        </div>
                        <input
                          id="album-edit-convocation-date-input"
                          type="date"
                          value={iso}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setEditConvocationDate('');
                              return;
                            }
                            const parts = val.split('-');
                            if (parts.length === 3) {
                              const y = parseInt(parts[0], 10);
                              const m = parseInt(parts[1], 10);
                              const d = parseInt(parts[2], 10);
                              setEditConvocationDate(formatDateComponents(d, m, y));
                            }
                          }}
                          onClick={(e) => {
                            try {
                              (e.currentTarget as any).showPicker?.();
                            } catch {
                              // fallback
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* University & Department Logos (Displayed on White Background, Department Logo Editable) */}
                <div className="sm:col-span-2 pt-3 border-t border-white/10">
                  <div className="p-4 rounded-2xl bg-[#08090e] border border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {/* 1st Logo: University Logo on White Background */}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="w-14 h-14 rounded-xl bg-white p-1.5 border-2 border-amber-500/40 shadow-md flex items-center justify-center shrink-0"
                          title={`University Logo: ${currentSet.institutionName}`}
                        >
                          {currentSet.institutionLogoUrl ? (
                            <img
                              src={currentSet.institutionLogoUrl}
                              alt={currentSet.institutionName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <GraduationCap className="w-6 h-6 text-slate-800" />
                          )}
                        </div>
                        <span className="font-mono-tech text-[9px] uppercase tracking-wider text-zinc-400">
                          1. University
                        </span>
                      </div>

                      {/* 2nd Logo: Editable Department Logo on White Background */}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="w-14 h-14 rounded-xl bg-white p-1.5 border-2 border-amber-500/40 shadow-md flex items-center justify-center shrink-0"
                          title={`Department Logo: ${editDeptName || currentSet.departmentName}`}
                        >
                          {editDeptLogoUrl || currentSet.departmentLogoUrl ? (
                            <img
                              src={editDeptLogoUrl || currentSet.departmentLogoUrl}
                              alt={editDeptName || currentSet.departmentName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <GraduationCap className="w-6 h-6 text-slate-800" />
                          )}
                        </div>
                        <span className="font-mono-tech text-[9px] uppercase tracking-wider text-[#d4af37] font-semibold">
                          2. Department
                        </span>
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <p className="font-mono-tech text-xs text-white font-semibold">
                          Department Logo (White Background)
                        </p>
                        <p className="text-[11px] text-zinc-400 leading-snug">
                          Displayed alongside the university logo on your Album Hero and Department Legacy Wall on a clean white background.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <input
                        ref={deptLogoFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleDeptLogoUpload}
                        className="hidden"
                      />
                      <button
                        id="album-edit-upload-dept-logo-btn"
                        type="button"
                        disabled={isCompressingDeptLogo}
                        onClick={() => deptLogoFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-[#d4af37] hover:bg-amber-400 text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isCompressingDeptLogo ? 'Processing...' : 'Upload Logo'}</span>
                      </button>

                      {(editDeptLogoUrl || currentSet.departmentLogoUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            const activeLogo = editDeptLogoUrl || currentSet.departmentLogoUrl;
                            if (!activeLogo) return;
                            triggerCropForImage(
                              activeLogo,
                              '1:1',
                              'Resize Department Logo (White Background)',
                              (resizedUrl) => {
                                setEditDeptLogoUrl(resizedUrl);
                                onUpdateSet({
                                  ...currentSet,
                                  departmentLogoUrl: resizedUrl,
                                });
                                setImagerySaveToast('✓ Department Logo resized on white background!');
                                setTimeout(() => setImagerySaveToast(null), 3000);
                              }
                            );
                          }}
                          className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/15 font-mono-tech text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Resize
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Public Directory Listing Toggle */}
                <div className="sm:col-span-2 pt-2 border-t border-white/10 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono-tech text-xs text-white font-semibold">
                      List in Public Directory ("Explore other departments")
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      When enabled and published, your album cover, department, and year can be discovered in the public directory. Student names and faces are never shown on directory cards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextListed = currentSet.isListedInDirectory === false ? true : false;
                      onUpdateSet({
                        ...currentSet,
                        isListedInDirectory: nextListed,
                      });
                      setImagerySaveToast(
                        nextListed
                          ? '✓ Album listed in public directory when published.'
                          : '✓ Album unlisted from public directory.'
                      );
                      setTimeout(() => setImagerySaveToast(null), 3000);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-mono-tech text-[11px] uppercase tracking-wider font-semibold border transition-colors cursor-pointer shrink-0 ${
                      currentSet.isListedInDirectory !== false
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-white/5 text-zinc-400 border-white/15'
                    }`}
                  >
                    {currentSet.isListedInDirectory !== false ? 'Listed' : 'Unlisted'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SECTION 1: ALBUM HERO BANNER IMAGE */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-syne font-bold text-base text-white">Album Hero Banner</h4>
                    <p className="text-xs text-zinc-400 font-mono-tech">
                      Top cover image of the album &amp; social share thumbnail
                    </p>
                  </div>
                  <span className="text-[10px] font-mono-tech uppercase tracking-widest text-zinc-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    Aspect ~16:9
                  </span>
                </div>

                {/* Hero Preview Card */}
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-black border border-white/15 shadow-xl group">
                  <img
                    src={heroBannerUrl}
                    alt="Album Hero Preview"
                    className="w-full h-full object-cover filter contrast-[1.05]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="font-mono-tech text-[10px] uppercase text-amber-400 font-bold">
                      {currentSet.classSetName} • Class of {currentSet.graduationYear}
                    </span>
                    <h5 className="font-syne font-bold text-base sm:text-lg text-white truncate drop-shadow">
                      {currentSet.departmentName}
                    </h5>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="file"
                    ref={heroFileInputRef}
                    accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                    onChange={handleHeroPhotoUpload}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => heroFileInputRef.current?.click()}
                      disabled={isCompressingHero}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer flex items-center gap-2 border border-white/10"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isCompressingHero ? 'Processing Photo...' : 'Upload New Hero Photo'}</span>
                    </button>

                    {heroBannerUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerCropForImage(
                            heroBannerUrl,
                            '21:9',
                            'Adjust Album Hero Banner Framing',
                            (croppedUrl) => {
                              setHeroBannerUrl(croppedUrl);
                              onUpdateSet({
                                ...currentSet,
                                bannerImageUrl: croppedUrl,
                                legacyGroupImageUrl: legacyFooterUrl,
                                socials: socials,
                                videos: videos,
                              });
                              setImagerySaveToast('✓ Hero Banner framing updated!');
                              setTimeout(() => setImagerySaveToast(null), 3000);
                            }
                          );
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#d4af37] font-mono-tech text-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-white/10"
                      >
                        <Crop className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Reframe</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const defaultHero = 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop';
                        setHeroBannerUrl(defaultHero);
                        onUpdateSet({
                          ...currentSet,
                          bannerImageUrl: defaultHero,
                          legacyGroupImageUrl: legacyFooterUrl,
                          socials: socials,
                          videos: videos,
                        });
                        setImagerySaveToast('✓ Hero Banner reset to default!');
                        setTimeout(() => setImagerySaveToast(null), 3000);
                      }}
                      className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: FINAL FOOTER IMAGE ("THIS IS OUR LEGACY.") */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-syne font-bold text-base text-white">Final Footer Banner</h4>
                    <p className="text-xs text-zinc-400 font-mono-tech">
                      "THIS IS OUR LEGACY." celebratory class portrait
                    </p>
                  </div>
                  <span className="text-[10px] font-mono-tech uppercase tracking-widest text-zinc-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    Aspect ~16:9
                  </span>
                </div>

                {/* Footer Preview Card */}
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-black border border-white/15 shadow-xl group">
                  <img
                    src={legacyFooterUrl}
                    alt="Album Footer Preview"
                    className="w-full h-full object-cover filter contrast-[1.05]"
                  />
                  <div className="absolute inset-0 bg-black/50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <p className="font-syne font-bold text-lg sm:text-xl text-white tracking-widest uppercase drop-shadow">
                      THIS IS OUR LEGACY.
                    </p>
                    <p className="font-mono-tech text-[11px] text-zinc-300 mt-1">
                      {currentSet.departmentName} • Class of {currentSet.graduationYear}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    type="file"
                    ref={footerFileInputRef}
                    accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                    onChange={handleFooterPhotoUpload}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => footerFileInputRef.current?.click()}
                      disabled={isCompressingFooter}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer flex items-center gap-2 border border-white/10"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isCompressingFooter ? 'Processing Photo...' : 'Upload New Footer Photo'}</span>
                    </button>

                    {legacyFooterUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerCropForImage(
                            legacyFooterUrl,
                            '16:9',
                            'Adjust Footer Legacy Photo Framing',
                            (croppedUrl) => {
                              setLegacyFooterUrl(croppedUrl);
                              onUpdateSet({
                                ...currentSet,
                                bannerImageUrl: heroBannerUrl,
                                legacyGroupImageUrl: croppedUrl,
                                socials: socials,
                                videos: videos,
                              });
                              setImagerySaveToast('✓ Footer Banner framing updated!');
                              setTimeout(() => setImagerySaveToast(null), 3000);
                            }
                          );
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#d4af37] font-mono-tech text-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-white/10"
                      >
                        <Crop className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Reframe</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const defaultFooter = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop';
                        setLegacyFooterUrl(defaultFooter);
                        onUpdateSet({
                          ...currentSet,
                          bannerImageUrl: heroBannerUrl,
                          legacyGroupImageUrl: defaultFooter,
                          socials: socials,
                          videos: videos,
                        });
                        setImagerySaveToast('✓ Footer Banner reset to default!');
                        setTimeout(() => setImagerySaveToast(null), 3000);
                      }}
                      className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: DEPARTMENT SOCIAL MEDIA CHANNELS */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-syne font-bold text-base text-white flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-amber-400" />
                    <span>Official Department Social Handles</span>
                  </h4>
                  <p className="text-xs text-zinc-400 font-mono-tech mt-0.5">
                    Links displayed in the album header, footer, and media clips section
                  </p>
                </div>
                <span className="text-[10px] font-mono-tech uppercase tracking-widest text-zinc-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 shrink-0">
                  Social Connectivity
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <SocialUrlInputField
                  label="YouTube Channel"
                  prefix="youtube.com/@"
                  value={socials.youtube ? socials.youtube.replace(/^https?:\/\/(www\.)?youtube\.com\/@?/i, '') : ''}
                  onChange={(val) => setSocials({ ...socials, youtube: val ? `https://youtube.com/@${val}` : '' })}
                  placeholder="channel"
                  icon={<Youtube className="w-3.5 h-3.5 text-red-500" />}
                />

                <SocialUrlInputField
                  label="Instagram Handle"
                  prefix="instagram.com/"
                  value={socials.instagram ? socials.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, '').replace(/^@/, '') : ''}
                  onChange={(val) => setSocials({ ...socials, instagram: val ? `@${val}` : '' })}
                  placeholder="username"
                  icon={<Instagram className="w-3.5 h-3.5 text-pink-500" />}
                />

                <SocialUrlInputField
                  label="X (Twitter)"
                  prefix="x.com/"
                  value={socials.twitter ? socials.twitter.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\/?/i, '').replace(/^@/, '') : ''}
                  onChange={(val) => setSocials({ ...socials, twitter: val ? `@${val}` : '' })}
                  placeholder="username"
                  icon={
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current text-white">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  }
                />

                <SocialUrlInputField
                  label="LinkedIn Alumni Page"
                  prefix="linkedin.com/company/"
                  value={socials.linkedin ? socials.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/(company|in)\/?/i, '') : ''}
                  onChange={(val) => setSocials({ ...socials, linkedin: val ? `https://linkedin.com/company/${val}` : '' })}
                  placeholder="page-name"
                  icon={<Linkedin className="w-3.5 h-3.5 text-blue-400" />}
                />

                <div className="sm:col-span-2">
                  <SocialUrlInputField
                    label="Official Department Website / Portal"
                    prefix="https://"
                    value={socials.website ? socials.website.replace(/^https?:\/\//i, '') : ''}
                    onChange={(val) => setSocials({ ...socials, website: val ? `https://${val}` : '' })}
                    placeholder="dept.university.edu"
                    icon={<Globe className="w-3.5 h-3.5 text-emerald-400" />}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAlbumDesignModalOpen(false)}
                className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                id="save-album-imagery-btn"
                type="button"
                onClick={() => {
                  handleSaveImagery();
                  setIsAlbumDesignModalOpen(false);
                }}
                className="px-6 py-2.5 rounded-full bg-[#d4af37] hover:bg-[#e5c14d] text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow-lg flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-black" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </UniversalModal>

        {/* =========================================================================
            TAB 2: MEMORIES MANAGEMENT (SEPARATED BY SUB-CLIPS: MOMENTS & HIGHLIGHTS)
            ========================================================================= */}
        {activeTab === 'memories' && (
          <div id="moments-edit-section" className="space-y-5 animate-fadeIn">
            {/* Nested Sub-Clips Track under Memories Edit */}
            <div className="flex flex-col items-center justify-center">
              <div
                className={`inline-flex items-center p-1 rounded-full border shadow-xs ${
                  isLightMode
                    ? 'bg-slate-100/90 border-slate-200/90'
                    : 'bg-[#0b0d13] border-white/10'
                }`}
              >
                <button
                  id="memories-subtab-moments"
                  type="button"
                  onClick={(e) => {
                    setMemoriesAdminSubTab('moments');
                    try {
                      sessionStorage.setItem('kohot_admin_dashboard_subtab', 'moments');
                    } catch {}
                    scrollClipIntoView(e.currentTarget);
                  }}
                  className={`h-8 px-4 rounded-full text-[11px] font-mono-tech uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    memoriesAdminSubTab === 'moments'
                      ? isLightMode
                        ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-300/80'
                        : 'bg-[#1a1f2c] text-[#d9b648] font-bold shadow-xs border border-[#d9b648]/40'
                      : isLightMode
                      ? 'text-slate-600 hover:text-slate-900 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 font-medium'
                  }`}
                >
                  <Camera className="w-3 h-3 shrink-0" />
                  <span>Moments ({currentSet.memories.length})</span>
                </button>

                <button
                  id="memories-subtab-highlights"
                  type="button"
                  onClick={(e) => {
                    setMemoriesAdminSubTab('highlights');
                    try {
                      sessionStorage.setItem('kohot_admin_dashboard_subtab', 'highlights');
                    } catch {}
                    scrollClipIntoView(e.currentTarget);
                  }}
                  className={`h-8 px-4 rounded-full text-[11px] font-mono-tech uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    memoriesAdminSubTab === 'highlights'
                      ? isLightMode
                        ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-300/80'
                        : 'bg-[#1a1f2c] text-[#d9b648] font-bold shadow-xs border border-[#d9b648]/40'
                      : isLightMode
                      ? 'text-slate-600 hover:text-slate-900 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 font-medium'
                  }`}
                >
                  <Film className="w-3 h-3 shrink-0" />
                  <span>Highlights ({videos.length})</span>
                </button>
              </div>
            </div>

            {/* =====================================================================
                 SECTION 1: HIGHLIGHTS (SHOWN WHEN HIGHLIGHTS SUB-CLIP IS ACTIVE)
                ===================================================================== */}
            {memoriesAdminSubTab === 'highlights' && (
            <div id="video-highlights-manager-section" className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={`font-syne font-bold text-xl sm:text-2xl leading-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    Highlights ({videos.length})
                  </h3>
                  <p className={`font-body text-xs mt-1 leading-snug ${isLightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
                    Stream video highlights from YouTube and social media platforms for convocation, dinner night, or class documentaries.
                  </p>
                </div>

                <button
                  id="add-video-highlight-btn"
                  type="button"
                  onClick={handleOpenAddVideo}
                  className={`h-11 px-4 rounded-full border font-mono-tech text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
                    isLightMode
                      ? 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-500/60 text-amber-800'
                      : 'bg-[#12151c] hover:bg-[#d9b648]/10 border-[#d9b648]/55 text-[#d9b648]'
                  }`}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>ADD VIDEO LINK</span>
                </button>
              </div>

              {/* Video Add / Edit Modal (Streaming URLs from YouTube & Social Platforms) */}
              <UniversalModal
                isOpen={isAddingVideo}
                onClose={() => {
                  setIsAddingVideo(false);
                  setEditingVideo(null);
                }}
                title={editingVideo ? 'Edit Video Highlight' : 'Add Video Link'}
                subtitle="Paste an https:// streaming link from YouTube, TikTok, Instagram, Facebook, X, Vimeo, Drive, or Loom. The event date is extracted automatically."
                maxWidth="lg"
              >
                <form
                  onSubmit={handleSaveVideoItem}
                  className="space-y-4 text-xs font-body p-1"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Renamed from Video Title * to Occasion / Event Tag * */}
                    <div className="space-y-1.5">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                        Occasion / Event Tag *
                      </label>
                      <input
                        required
                        type="text"
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        placeholder="e.g. Convocation Ceremony & Valedictory Address"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                      />
                    </div>

                    {/* Video URL */}
                    <div className="space-y-1.5">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                        Video URL (https://) *
                      </label>
                      <input
                        required
                        type="url"
                        value={videoYoutubeUrl}
                        onChange={(e) => setVideoYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/... or tiktok.com/... or instagram.com/reel/..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                      />
                    </div>

                    {/* Automatic Date Extraction Notice */}
                    {videoYoutubeUrl.trim() && (
                      <div className="sm:col-span-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2 text-[11px] font-mono-tech text-zinc-400">
                        <span>Extracted Date (auto-displayed on highlight):</span>
                        <span className="text-[#d4af37] font-bold">
                          {extractAutoVideoDateStr(videoYoutubeUrl.trim(), editingVideo?.dateStr)}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                        Short Description (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={videoDescription}
                        onChange={(e) => setVideoDescription(e.target.value)}
                        placeholder="Brief summary of speeches or memorable moments in this video..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white text-xs font-body focus:outline-none focus:border-white/30 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-white/10">
                    <div>
                      {editingVideo && (
                        <button
                          type="button"
                          onClick={() => {
                            const idToRemove = editingVideo.id;
                            setIsAddingVideo(false);
                            setEditingVideo(null);
                            handleDeleteVideo(idToRemove);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-mono-tech flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingVideo(false);
                          setEditingVideo(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-mono-tech transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black text-xs font-mono-tech font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        {editingVideo ? 'Update Video' : 'Save Video'}
                      </button>
                    </div>
                  </div>
                </form>
              </UniversalModal>

              {/* Separated Hold & Drag Instruction Line (Consistent with Class Awards & Moments) */}
              {videos.length > 0 && (
                <p className={`px-1 font-mono-tech text-xs ${isLightMode ? 'text-slate-500' : 'text-zinc-500'}`}>
                  Hold &amp; drag to reorder
                </p>
              )}

              {/* Rich Highlights Edit Cards (Hold & Drag Reorder + Elevated Video Preview Frame) */}
              {videos.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#0c0d14] border border-dashed border-white/10 text-center space-y-2">
                  <Film className="w-6 h-6 text-zinc-500 mx-auto" />
                  <p className="text-xs font-syne font-bold text-white">No Video Highlights Added Yet</p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Click &ldquo;+ Add Video Link&rdquo; above to stream YouTube, TikTok, Instagram Reels, Facebook, X, or Vimeo highlights on your album.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {videos.map((vid, index) => {
                    const normalizedUrl = normalizeStreamingVideoUrl(vid.youtubeUrl);
                    const hostLabel = getVideoHostLabel(normalizedUrl);
                    const ytId = extractYouTubeId(normalizedUrl);
                    const previewStreamUrl = ytId
                      ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&rel=0&loop=1&playlist=${ytId}&start=0&end=10`
                      : getUniversalVideoEmbedUrl(normalizedUrl)?.embedUrl || null;
                    const isBeingDragged = draggedVideoIndex === index;

                    return (
                      <div
                        key={vid.id}
                        id={`highlight-video-row-${vid.id}`}
                        data-video-card-idx={index}
                        draggable={false}
                        onContextMenu={(e) => {
                          e.preventDefault();
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          if ((e.target as HTMLElement).closest('button')) return;
                          if (videoHoldTimerRef.current) {
                            window.clearTimeout(videoHoldTimerRef.current);
                          }
                          videoDidDragRef.current = false;
                          videoTouchStartPosRef.current = { x: e.clientX, y: e.clientY };
                          videoHoldTimerRef.current = window.setTimeout(() => {
                            videoDidDragRef.current = true;
                            activeVideoDragIdxRef.current = index;
                            activeVideoTargetIdxRef.current = index;
                            setDraggedVideoIndex(index);
                            setDragOverVideoIndex(index);
                          }, 130);
                        }}
                        onTouchStart={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          const touch = e.touches[0];
                          if (!touch) return;
                          if (videoHoldTimerRef.current) {
                            window.clearTimeout(videoHoldTimerRef.current);
                          }
                          videoDidDragRef.current = false;
                          videoTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                          videoHoldTimerRef.current = window.setTimeout(() => {
                            videoDidDragRef.current = true;
                            activeVideoDragIdxRef.current = index;
                            activeVideoTargetIdxRef.current = index;
                            setDraggedVideoIndex(index);
                            setDragOverVideoIndex(index);
                          }, 150);
                        }}
                        onClick={() => {
                          if (videoDidDragRef.current) return;
                          handleOpenEditVideo(vid);
                        }}
                        className={`rounded-2xl bg-[#0c0d14] border p-4 sm:p-5 space-y-3 transition-all cursor-grab active:cursor-grabbing select-none ${
                          isBeingDragged
                            ? 'kohot-drag-active-card border-[#d4af37] ring-2 ring-[#d4af37]/60 scale-[1.01] shadow-2xl z-20'
                            : 'border-white/10 hover:border-white/25'
                        }`}
                      >
                        {/* Compact Top Row: Title + 1-Line Info on Left | Tag Pill + Edit on Right */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-syne font-bold text-sm sm:text-base text-white truncate">
                              {vid.title}
                            </h4>
                            <p className="font-body text-xs text-zinc-400 line-clamp-1 mt-0.5">
                              {vid.dateStr ? `${vid.dateStr} — ` : ''}
                              {vid.description || `${hostLabel} highlight stream`}
                            </p>
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-[10px] font-mono-tech text-blue-400 font-semibold truncate max-w-[140px]">
                              {vid.dateStr || hostLabel}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleOpenEditVideo(vid)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono-tech text-[#d4af37] hover:bg-white/5 font-semibold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </div>

                        {/* Compact Video Frame (Same height as Moments preview, single center Play button only) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (videoDidDragRef.current) return;
                            setPreviewVideo({ ...vid, youtubeUrl: normalizedUrl });
                            setIsPreviewVideoModalOpen(true);
                          }}
                          className="relative h-28 sm:h-32 w-full rounded-xl overflow-hidden bg-black border border-white/10 group cursor-pointer"
                          title="Tap to play video"
                        >
                          {previewStreamUrl && (
                            <iframe
                              src={previewStreamUrl}
                              title={vid.title}
                              className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-[1.03]"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              tabIndex={-1}
                            />
                          )}
                          <div className="kohot-media-scrim absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                            <div className="w-11 h-11 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* =====================================================================
                 SECTION 2: MOMENTS (SHOWN WHEN MOMENTS SUB-CLIP IS ACTIVE)
                ===================================================================== */}
            {memoriesAdminSubTab === 'moments' && (
            <div id="moments-batches-manager-section" className="space-y-4">
              {/* Moments Header with "+ Add Photo Category" Button synced with INVITE / ADD CLASSMATE UI */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={`font-syne font-bold text-xl sm:text-2xl leading-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    Moments ({currentSet.memories.length})
                  </h3>
                  <p className={`font-body text-xs mt-1 leading-snug ${isLightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
                    Organize class memories and milestone photos by event category.
                  </p>
                </div>

                <button
                  id="create-batch-btn"
                  type="button"
                  onClick={() => setIsAddingBatch(true)}
                  className={`h-11 px-4 rounded-full border font-mono-tech text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
                    isLightMode
                      ? 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-500/60 text-amber-800'
                      : 'bg-[#12151c] hover:bg-[#d9b648]/10 border-[#d9b648]/55 text-[#d9b648]'
                  }`}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>ADD PHOTO CATEGORY</span>
                </button>
              </div>

              {/* CREATE NEW CATEGORY POP-UP MODAL */}
              <UniversalModal
                isOpen={isAddingBatch}
                onClose={() => setIsAddingBatch(false)}
                title="Add Photo Category"
                maxWidth="xl"
                zIndex={9980}
              >
                <form onSubmit={handleSaveBatch} className="space-y-5 text-xs font-body">
                  {/* Category Name & Quick Presets */}
                  <div className="space-y-2">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                      Category Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={batchCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBatchCategory(val);
                        setBatchTitle(val);
                        if (val.toLowerCase().includes('convocation')) {
                          setIsConvocationBatchToggle(true);
                        }
                      }}
                      placeholder="e.g. Sign-out Day, Dinner Party, Bonfire Night..."
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none font-mono-tech text-xs transition-colors"
                    />

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {[
                        'Sign-out Day',
                        'Dinner Party',
                        'Bonfire Night',
                        'Convocation',
                        'Project Defense',
                        'Sports & Picnics',
                        'Matriculation',
                        'Campus Culture',
                      ].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setBatchCategory(cat);
                            setBatchTitle(cat);
                            if (cat.toLowerCase().includes('convocation')) {
                              setIsConvocationBatchToggle(true);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono-tech transition-all cursor-pointer ${
                            batchCategory === cat
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Event Date */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                        Event Date
                      </label>
                      {batchDate && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 font-mono-tech text-[10px] text-amber-300">
                          {batchDate}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const dNum = typeof batchDay === 'number' && batchDay >= 1 ? batchDay : 18;
                      const mNum = batchMonth || 10;
                      const yNum = batchYear || currentSet.graduationYear || 2026;
                      const isoVal = batchDate
                        ? `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`
                        : '';
                      const dmyVal = batchDate
                        ? `${String(dNum).padStart(2, '0')}/${String(mNum).padStart(2, '0')}/${yNum}`
                        : '';
                      return (
                        <div className="relative w-full cursor-pointer">
                          <div className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs flex items-center justify-between pointer-events-none">
                            <span className={dmyVal ? 'text-white' : 'text-zinc-500'}>
                              {dmyVal || 'dd/mm/yyyy'}
                            </span>
                            <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                          </div>
                          <input
                            type="date"
                            value={isoVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const parts = val.split('-');
                              if (parts.length === 3) {
                                const y = parseInt(parts[0], 10);
                                const m = parseInt(parts[1], 10);
                                const d = parseInt(parts[2], 10);
                                setBatchDay(d);
                                setBatchMonth(m);
                                setBatchYear(y);
                                setIsBatchDayUnknown(false);
                                setBatchDate(formatDateComponents(d, m, y));
                              }
                            }}
                            onClick={(e) => {
                              try {
                                (e.currentTarget as any).showPicker?.();
                              } catch {
                                // fallback
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Sub Caption (Optional) */}
                  <div className="space-y-1.5">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
                      Sub Caption / Moment Story (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={batchCaption}
                      onChange={(e) => setBatchCaption(e.target.value)}
                      placeholder="Brief description or story behind this moment..."
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none resize-none transition-colors"
                    />
                  </div>

                  {/* External Link for More Photos in this Category (Optional) */}
                  <div className="space-y-1.5">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
                      External Link for More Photos (Optional)
                    </label>
                    <input
                      type="url"
                      value={batchMorePhotosUrl}
                      onChange={(e) => setBatchMorePhotosUrl(e.target.value)}
                      placeholder="https://drive.google.com/... or Pixieset / iCloud gallery link"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-zinc-600 font-mono-tech text-xs focus:border-amber-400 focus:outline-none transition-colors"
                    />
                    <p className="font-body text-[11px] text-zinc-400">
                      If added, an &ldquo;Explore full photo archive&rdquo; link will appear under this category on the public album.
                    </p>
                  </div>

                  {/* Upload Photos + Hold & Drag-and-Drop Rearrange */}
                  <div className="p-4 rounded-2xl bg-[var(--kh-surface-subtle)] border border-[var(--kh-border)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[var(--kh-text)] font-semibold block">
                          Photos ({batchImages.length})
                        </span>
                        {batchImages.length > 1 && (
                          <span className="font-mono-tech text-[10px] text-[var(--kh-text-muted)]">
                            Hold &amp; drag any photo to reorder
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => batchFileInputRef.current?.click()}
                        disabled={isCompressingBatch}
                        className="py-2 px-4 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black font-mono-tech text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isCompressingBatch ? 'Processing...' : 'Select Photos'}</span>
                      </button>
                    </div>

                    <input
                      type="file"
                      ref={batchFileInputRef}
                      multiple
                      accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                      onChange={(e) => handleBatchFilesUpload(e.target.files)}
                      className="hidden"
                    />

                    {batchImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 max-h-60 overflow-y-auto pr-1">
                        {batchImages.map((img, index) => {
                          const isBeingDragged = draggedDraftPhotoIndex === index;
                          return (
                            <div
                              key={img.id || index}
                              data-draft-moment-photo-idx={index}
                              draggable={false}
                              onContextMenu={(e) => e.preventDefault()}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                if ((e.target as HTMLElement).closest('button')) return;
                                if (draftPhotoHoldTimerRef.current) {
                                  window.clearTimeout(draftPhotoHoldTimerRef.current);
                                }
                                draftPhotoTouchStartPosRef.current = { x: e.clientX, y: e.clientY };
                                draftPhotoHoldTimerRef.current = window.setTimeout(() => {
                                  activeDraftPhotoDragIdxRef.current = index;
                                  setDraggedDraftPhotoIndex(index);
                                  setDragOverDraftPhotoIndex(index);
                                }, 80);
                              }}
                              onMouseEnter={() => {
                                const currentIdx = activeDraftPhotoDragIdxRef.current;
                                if (currentIdx !== null && currentIdx !== index) {
                                  draftPhotoLastSwapTimeRef.current = Date.now();
                                  activeDraftPhotoDragIdxRef.current = index;
                                  setDraggedDraftPhotoIndex(index);
                                  setDragOverDraftPhotoIndex(index);
                                  reorderDraftPhotosLatestRef.current(currentIdx, index);
                                }
                              }}
                              onTouchStart={(e) => {
                                if ((e.target as HTMLElement).closest('button')) return;
                                const touch = e.touches[0];
                                if (!touch) return;
                                if (draftPhotoHoldTimerRef.current) {
                                  window.clearTimeout(draftPhotoHoldTimerRef.current);
                                }
                                draftPhotoTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                                draftPhotoHoldTimerRef.current = window.setTimeout(() => {
                                  activeDraftPhotoDragIdxRef.current = index;
                                  setDraggedDraftPhotoIndex(index);
                                  setDragOverDraftPhotoIndex(index);
                                }, 120);
                              }}
                              className={`p-2 rounded-xl bg-[var(--kh-surface)] border transition-all flex items-center gap-2 cursor-grab active:cursor-grabbing select-none ${
                                isBeingDragged
                                  ? 'kohot-drag-active-card border-[#d4af37] ring-2 ring-[#d4af37]/60 scale-[1.01] shadow-xl z-20'
                                  : 'border-[var(--kh-border)] hover:border-[var(--kh-border-strong)]'
                              }`}
                            >
                              <div className="relative shrink-0">
                                <img
                                  src={img.url}
                                  alt={`Photo ${index + 1}`}
                                  className="w-12 h-12 rounded-lg object-cover border border-[var(--kh-border)] pointer-events-none"
                                />
                                <span className="absolute -top-1 -left-1 px-1.5 py-0.2 rounded bg-black/85 border border-white/20 text-[9px] font-mono-tech text-white font-bold">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col gap-1 text-[11px] font-mono-tech">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBatchImages(batchImages.filter((_, i) => i !== index));
                                  }}
                                  className="text-[var(--kh-danger)] hover:underline cursor-pointer text-left"
                                >
                                  Remove
                                </button>
                              </div>
                              <GripVertical className="w-3.5 h-3.5 text-[var(--kh-text-muted)] shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsAddingBatch(false)}
                      className="py-2.5 px-5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!batchCategory.trim() || batchImages.length === 0}
                      className="bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-40 text-black font-mono-tech text-xs font-bold py-2.5 px-6 rounded-xl transition-colors cursor-pointer shadow-xs"
                    >
                      Save category ({batchImages.length})
                    </button>
                  </div>
                </form>
              </UniversalModal>

              {/* POP-UP WINDOW: EDIT MOMENT CATEGORY MODAL */}
              <UniversalModal
                isOpen={!!editingMomentBatchModal}
                onClose={() => setEditingMomentBatchModal(null)}
                title="Edit category"
                subtitle="Hold and drag photos to reorder sequence."
                maxWidth="2xl"
                zIndex={9985}
              >
                {editingMomentBatchModal && (
                  <form onSubmit={handleSaveEditMomentBatchModal} className="space-y-4 text-xs font-body">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Category Title */}
                      <div className="space-y-1.5">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                          Moment Title / Category Name *
                        </label>
                        <input
                          required
                          type="text"
                          value={editingMomentBatchModal.title}
                          onChange={(e) =>
                            setEditingMomentBatchModal({
                              ...editingMomentBatchModal,
                              title: e.target.value,
                            })
                          }
                          placeholder="e.g. Sign-out Day & White Shirt Signing"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-syne font-bold text-xs focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>

                      {/* Short Badge Tag */}
                      <div className="space-y-1.5">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                          Category Badge Label
                        </label>
                        <input
                          type="text"
                          value={editingMomentBatchModal.eventTag}
                          onChange={(e) =>
                            setEditingMomentBatchModal({
                              ...editingMomentBatchModal,
                              eventTag: e.target.value,
                            })
                          }
                          placeholder="e.g. Sign-out Day, Dinner Party"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-mono-tech text-xs focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Event Date Picker */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                          Event Date
                        </label>
                        {editingMomentBatchModal.dateStr && (
                          <span className="font-mono-tech text-[11px] text-amber-300">
                            {editingMomentBatchModal.dateStr}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const dNum = editingMomentBatchModal.eventDay || 18;
                        const mNum = editingMomentBatchModal.eventMonth || 10;
                        const yNum = editingMomentBatchModal.eventYear || currentSet.graduationYear || 2026;
                        const isoVal = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
                        const dmyVal = `${String(dNum).padStart(2, '0')}/${String(mNum).padStart(2, '0')}/${yNum}`;
                        return (
                          <div className="relative w-full cursor-pointer">
                            <div className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-mono-tech text-xs flex items-center justify-between pointer-events-none">
                              <span>{dmyVal}</span>
                              <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                            </div>
                            <input
                              type="date"
                              value={isoVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const parts = val.split('-');
                                if (parts.length === 3) {
                                  const y = parseInt(parts[0], 10);
                                  const m = parseInt(parts[1], 10);
                                  const d = parseInt(parts[2], 10);
                                  setEditingMomentBatchModal({
                                    ...editingMomentBatchModal,
                                    eventDay: d,
                                    eventMonth: m,
                                    eventYear: y,
                                    isDayUnknown: false,
                                    dateStr: formatDateComponents(d, m, y),
                                  });
                                }
                              }}
                              onClick={(e) => {
                                try {
                                  (e.currentTarget as any).showPicker?.();
                                } catch {
                                  // fallback
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Full Sub-Caption / Narrative Message */}
                    <div className="space-y-1.5">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                        Sub-Caption / Full Moment Message
                      </label>
                      <textarea
                        rows={3}
                        value={editingMomentBatchModal.caption || ''}
                        onChange={(e) =>
                          setEditingMomentBatchModal({
                            ...editingMomentBatchModal,
                            caption: e.target.value,
                          })
                        }
                        placeholder="Write the full sub-caption or memory story for this event..."
                        className="w-full px-4 py-3 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-[#d4af37] focus:outline-none resize-none font-body text-xs sm:text-sm leading-relaxed"
                      />
                    </div>

                    {/* External Link for More Photos in this Category (Optional) */}
                    <div className="space-y-1.5">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                        External Link for More Photos (Optional)
                      </label>
                      <input
                        type="url"
                        value={editingMomentBatchModal.morePhotosUrl || ''}
                        onChange={(e) =>
                          setEditingMomentBatchModal({
                            ...editingMomentBatchModal,
                            morePhotosUrl: e.target.value,
                          })
                        }
                        placeholder="https://drive.google.com/... or Pixieset / iCloud gallery link"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 font-mono-tech text-xs focus:border-[#d4af37] focus:outline-none"
                      />
                      <p className="font-body text-[11px] text-zinc-400">
                        When provided, visitors can open the full external photo archive directly from this moment category on the public album.
                      </p>
                    </div>

                    {/* Hold & Drag-and-Drop Photo Grid */}
                    <div className="p-4 rounded-2xl bg-[var(--kh-surface-subtle)] border border-[var(--kh-border)] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-syne font-bold text-xs sm:text-sm text-[var(--kh-text)] block">
                            Event Photos ({editingMomentBatchModal.images.length})
                          </span>
                          <span className="font-mono-tech text-[10px] text-[var(--kh-text-muted)]">
                            Hold &amp; drag to reorder
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => editMomentAddPhotosInputRef.current?.click()}
                          disabled={isCompressingBatch}
                          className="px-3.5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black font-mono-tech text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isCompressingBatch ? 'Adding...' : 'Add Photos'}</span>
                        </button>

                        <input
                          type="file"
                          ref={editMomentAddPhotosInputRef}
                          multiple
                          accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                          onChange={(e) => handleAppendFilesToEditingMomentModal(e.target.files)}
                          className="hidden"
                        />
                      </div>

                      {editingMomentBatchModal.images.length === 0 ? (
                        <div className="p-8 text-center rounded-xl border border-dashed border-[var(--kh-border-strong)] text-[var(--kh-text-muted)] font-mono-tech text-xs">
                          No photos in this moment. Click &ldquo;Add Photos&rdquo; to upload.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1 pt-1">
                          {editingMomentBatchModal.images.map((img, imgIdx) => {
                            const isBeingDragged = draggedMomentPhotoIndex === imgIdx;

                            return (
                              <div
                                key={img.id || imgIdx}
                                data-edit-moment-photo-idx={imgIdx}
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                                onMouseDown={(e) => {
                                  if (e.button !== 0) return;
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  if (editPhotoHoldTimerRef.current) {
                                    window.clearTimeout(editPhotoHoldTimerRef.current);
                                  }
                                  editPhotoTouchStartPosRef.current = { x: e.clientX, y: e.clientY };
                                  editPhotoHoldTimerRef.current = window.setTimeout(() => {
                                    activeEditPhotoDragIdxRef.current = imgIdx;
                                    setDraggedMomentPhotoIndex(imgIdx);
                                    setDragOverMomentPhotoIndex(imgIdx);
                                  }, 80);
                                }}
                                onMouseEnter={() => {
                                  const currentIdx = activeEditPhotoDragIdxRef.current;
                                  if (currentIdx !== null && currentIdx !== imgIdx) {
                                    editPhotoLastSwapTimeRef.current = Date.now();
                                    activeEditPhotoDragIdxRef.current = imgIdx;
                                    setDraggedMomentPhotoIndex(imgIdx);
                                    setDragOverMomentPhotoIndex(imgIdx);
                                    reorderEditPhotosLatestRef.current(currentIdx, imgIdx);
                                  }
                                }}
                                onTouchStart={(e) => {
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  const touch = e.touches[0];
                                  if (!touch) return;
                                  if (editPhotoHoldTimerRef.current) {
                                    window.clearTimeout(editPhotoHoldTimerRef.current);
                                  }
                                  editPhotoTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                                  editPhotoHoldTimerRef.current = window.setTimeout(() => {
                                    activeEditPhotoDragIdxRef.current = imgIdx;
                                    setDraggedMomentPhotoIndex(imgIdx);
                                    setDragOverMomentPhotoIndex(imgIdx);
                                  }, 120);
                                }}
                                className={`rounded-xl bg-[var(--kh-surface)] border p-2 flex flex-col justify-between gap-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                                  isBeingDragged
                                    ? 'kohot-drag-active-card border-[#d4af37] ring-2 ring-[#d4af37]/60 scale-[1.01] shadow-xl z-20'
                                    : 'border-[var(--kh-border)] hover:border-[var(--kh-border-strong)]'
                                }`}
                              >
                                <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-zinc-900 border border-[var(--kh-border)]">
                                  <img
                                    src={img.url}
                                    alt={img.caption || `Photo ${imgIdx + 1}`}
                                    className="w-full h-full object-cover pointer-events-none"
                                  />
                                  <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between pointer-events-none">
                                    <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/15 text-[10px] font-mono-tech text-white font-bold">
                                      #{imgIdx + 1}
                                    </span>
                                    <span className="p-1 rounded-md bg-black/80 text-zinc-300 border border-white/10">
                                      <GripVertical className="w-3 h-3" />
                                    </span>
                                  </div>
                                </div>

                                <div
                                  className="flex items-center justify-between gap-1 pt-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTriggerReplaceImage(editingMomentBatchModal.id, imgIdx)
                                    }
                                    className="px-2 py-1 rounded-lg bg-[var(--kh-surface-subtle)] hover:bg-[var(--kh-surface-elevated)] text-[var(--kh-text)] text-[10px] font-mono-tech flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Replace</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMomentBatchModal((prev) => {
                                        if (!prev) return null;
                                        return {
                                          ...prev,
                                          images: prev.images.filter((_, i) => i !== imgIdx),
                                        };
                                      });
                                    }}
                                    className="p-1 rounded-lg bg-[var(--kh-surface-subtle)] hover:bg-[var(--kh-danger-bg)] text-[var(--kh-text-muted)] hover:text-[var(--kh-danger)] cursor-pointer"
                                    title="Remove photo"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions: Delete Category on Left, Cancel & Save on Right */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          const idToDelete = editingMomentBatchModal.id;
                          setEditingMomentBatchModal(null);
                          handleDeleteBatch(idToDelete);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Category</span>
                      </button>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setEditingMomentBatchModal(null)}
                          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-6 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black font-mono-tech text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </UniversalModal>

              {/* Hidden Input for Replacing a Single Image in Any Category */}
              <input
                type="file"
                ref={replaceImageInputRef}
                accept="image/*"
                onChange={(e) => handleExecuteImageReplacement(e.target.files)}
                className="hidden"
              />

              {/* Separated Hold & Drag Instruction Line (Consistent with Class Awards & Highlights) */}
              {currentSet.memories.length > 0 && (
                <p className={`px-1 font-mono-tech text-xs ${isLightMode ? 'text-slate-500' : 'text-zinc-500'}`}>
                  Hold &amp; drag to reorder
                </p>
              )}

              {/* PREVIOUS RICH MOMENTS CATEGORY CARDS (2 PREVIEW IMAGES + WHITE +N OVERLAY) */}
              {currentSet.memories.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[#0c0d14] border border-dashed border-white/10 space-y-2">
                  <Camera className="w-6 h-6 text-zinc-500 mx-auto" />
                  <p className="text-xs font-syne font-bold text-white">No Moment Categories Yet</p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Click &ldquo;+ Add Photo Category&rdquo; to upload photos for Sign-out Day, Dinner Party, or Convocation.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSet.memories.map((batch, index) => {
                    const isBeingDragged = draggedBatchIndex === index;
                    const previewImages = (batch.images || []).slice(0, 2);
                    const totalPhotos = batch.images?.length || 0;
                    const extraPhotosCount = Math.max(0, totalPhotos - 2);

                    return (
                      <div
                        key={batch.id}
                        id={`category-row-${batch.id}`}
                        data-moment-batch-idx={index}
                        draggable={false}
                        onContextMenu={(e) => {
                          e.preventDefault();
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          if ((e.target as HTMLElement).closest('button')) return;
                          if (batchHoldTimerRef.current) {
                            window.clearTimeout(batchHoldTimerRef.current);
                          }
                          batchDidDragRef.current = false;
                          batchTouchStartPosRef.current = { x: e.clientX, y: e.clientY };
                          batchHoldTimerRef.current = window.setTimeout(() => {
                            batchDidDragRef.current = true;
                            activeBatchDragIdxRef.current = index;
                            activeBatchTargetIdxRef.current = index;
                            setDraggedBatchIndex(index);
                            setDragOverBatchIndex(index);
                          }, 130);
                        }}
                        onTouchStart={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          const touch = e.touches[0];
                          if (!touch) return;
                          if (batchHoldTimerRef.current) {
                            window.clearTimeout(batchHoldTimerRef.current);
                          }
                          batchDidDragRef.current = false;
                          batchTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                          batchHoldTimerRef.current = window.setTimeout(() => {
                            batchDidDragRef.current = true;
                            activeBatchDragIdxRef.current = index;
                            activeBatchTargetIdxRef.current = index;
                            setDraggedBatchIndex(index);
                            setDragOverBatchIndex(index);
                          }, 150);
                        }}
                        onClick={() => {
                          if (batchDidDragRef.current) return;
                          handleOpenEditMomentBatchModal(batch);
                        }}
                        className={`rounded-2xl bg-[#0c0d14] border p-4 sm:p-5 space-y-3.5 transition-all cursor-grab active:cursor-grabbing select-none ${
                          isBeingDragged
                            ? 'kohot-drag-active-card border-[#d4af37] ring-2 ring-[#d4af37]/60 scale-[1.01] shadow-2xl z-20'
                            : 'border-white/10 hover:border-white/25'
                        }`}
                      >
                        {/* Top Row: Event Title + Date/Caption on Left | Blue Event Tag Pill + Edit on Right */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-syne font-bold text-sm sm:text-base text-white truncate">
                                {batch.title}
                              </h4>
                            </div>
                            <p className="font-body text-xs text-zinc-400 line-clamp-1">
                              {batch.dateStr ? `${batch.dateStr} — ` : ''}
                              {batch.caption || `${totalPhotos} ${totalPhotos === 1 ? 'photo' : 'photos'} in this category`}
                            </p>
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-[11px] font-mono-tech text-blue-400 font-semibold max-w-[140px] sm:max-w-[180px] truncate">
                              {batch.eventTag || batch.title}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleOpenEditMomentBatchModal(batch)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono-tech text-[#d4af37] hover:bg-white/5 font-semibold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: 2 Preview Thumbnails with White "+N" Indicator on Last Preview Image */}
                        {previewImages.length > 0 && (
                          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                            {previewImages.map((img, pIdx) => {
                              const isLastPreview = pIdx === previewImages.length - 1;
                              const showMoreOverlay = isLastPreview && extraPhotosCount > 0;
                              return (
                                <div
                                  key={img.id || pIdx}
                                  className="relative h-28 sm:h-32 rounded-xl overflow-hidden bg-black border border-white/10"
                                >
                                  <img
                                    src={img.url}
                                    alt={img.caption || batch.title}
                                    loading="eager"
                                    decoding="sync"
                                    className={`w-full h-full object-cover pointer-events-none ${
                                      showMoreOverlay ? 'opacity-90 brightness-90' : ''
                                    }`}
                                  />
                                  {showMoreOverlay && (
                                    <div className="kohot-photo-more-overlay absolute inset-0 bg-black/15 flex items-center justify-center pointer-events-none">
                                      <span className="kohot-keep-color font-syne font-extrabold text-xl sm:text-2xl text-white drop-shadow-md">
                                        +{extraPhotosCount}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </div>
        )}

          </>
        )}
      </div>

      {/* Edit Student Modal for Class Rep */}
      <EditStudentModal
        isOpen={!!editingStudent}
        student={editingStudent}
        onClose={() => setEditingStudent(null)}
        onSave={handleSaveEditedStudent}
        onDelete={handleDeleteStudent}
        currentSet={currentSet}
      />

      {/* Department YouTube Video Preview Modal */}
      <DepartmentVideoModal
        isOpen={isPreviewVideoModalOpen}
        video={previewVideo}
        onClose={() => {
          setIsPreviewVideoModalOpen(false);
          setPreviewVideo(null);
        }}
        departmentName={currentSet.departmentName}
      />

      {/* Dedicated Convocation Date & Annual Relive Reminder Modal */}
      <ConvocationReminderModal
        isOpen={isConvocationReminderModalOpen}
        onClose={() => setIsConvocationReminderModalOpen(false)}
        currentConvocationDate={currentSet.convocationDate}
        graduationYear={currentSet.graduationYear}
        graduatesCount={currentSet.students.length}
        departmentName={currentSet.departmentName}
        currentReminderSettings={currentSet.reminderSettings}
        onPublish={handlePublishConvocationReminder}
      />

      {/* Dedicated Invite Next Class (Baton Relay) Modal */}
      <InviteNextClassModal
        isOpen={isInviteNextClassModalOpen}
        onClose={() => setIsInviteNextClassModalOpen(false)}
        currentSet={currentSet}
        currentUser={currentUser}
        onUpdateSet={(updated) => onUpdateSet(updated)}
      />

      {/* Prominent Publish Album Modal (3 Required Steps) */}
      <PublishAlbumModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        currentSet={currentSet}
        currentUser={currentUser}
        onPublishSuccess={(updatedSet) => {
          onUpdateSet(updatedSet);
        }}
        onOpenInviteNextClass={() => setIsInviteNextClassModalOpen(true)}
      />

      {/* Outside Toggle Unpublish Confirmation Pop-up Card */}
      <UniversalModal
        isOpen={isUnpublishConfirmModalOpen}
        onClose={() => setIsUnpublishConfirmModalOpen(false)}
        title="Unpublish album?"
        subtitle={`${currentSet.departmentName} · Class of ${currentSet.graduationYear}`}
        maxWidth="sm"
        footer={
          <div className="w-full flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsUnpublishConfirmModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-mono-tech text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-outside-unpublish-btn"
              type="button"
              onClick={() => {
                const updatedSet: ClassSet = {
                  ...currentSet,
                  isPublished: false,
                  published: false,
                  isUnpublished: true,
                  unpublished: true,
                };
                onUpdateSet(updatedSet);
                setIsUnpublishConfirmModalOpen(false);
                apiClientUnpublishAlbum(currentSet.id).catch(() => {});
                showSuccess('Album unpublished.', 'Your class album is now back in draft mode.');
              }}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono-tech text-xs font-bold transition-colors cursor-pointer"
            >
              Confirm Unpublish
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs font-body text-slate-600 dark:text-zinc-300 leading-relaxed">
          <p>
            Are you sure you want to unpublish{' '}
            <strong className="text-slate-900 dark:text-white">
              {currentSet.departmentName} (Class of {currentSet.graduationYear})
            </strong>
            ?
          </p>
          <p>
            Your album will return to draft mode, will no longer be visible on the department&apos;s Legacy Wall (albums archive), and Save &amp; Share actions on the public album will be paused until you toggle Publish back on.
          </p>
        </div>
      </UniversalModal>

      {/* Invite Classmates to Submit Profiles Modal */}
      <InviteClassmatesModal
        isOpen={isInviteClassmatesModalOpen}
        onClose={() => setIsInviteClassmatesModalOpen(false)}
        currentSet={currentSet}
      />

      {/* Pocket Modal for Award Winner Classmate Selection */}
      <ProfilePocketPickerModal
        isOpen={isAwardPickerOpen}
        onClose={() => setIsAwardPickerOpen(false)}
        title="Select Award Recipient"
        subtitle="Choose from approved classmate profiles to populate name and photo"
        students={approvedStudents}
        selectedId={selectedAwardStudentId}
        mode="award"
        onSelect={(student) => {
          setSelectedAwardStudentId(student.id);
          setAwardWinnerName(student.fullName);
          setAwardWinnerNickname(student.nickname || '');
          if (student.photoUrl) setAwardAvatar(student.photoUrl);
          if (editingAwardModalItem) {
            setEditingAwardModalItem({
              ...editingAwardModalItem,
              winnerName: student.fullName,
              winnerNickname: student.nickname || '',
              winnerAvatar: student.photoUrl || editingAwardModalItem.winnerAvatar,
            });
          }
          setHierarchyToast(`✓ Populated award with ${student.fullName}`);
          setTimeout(() => setHierarchyToast(null), 2500);
        }}
      />

      {/* Global Image Crop Modal */}
      {isCropModalOpen && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropModalImage}
          initialAspectRatio={cropModalAspect}
          isProfileSubmission={cropModalAspect === '4:5'}
          title={cropModalTitle}
          onClose={() => setIsCropModalOpen(false)}
          onApplyCrop={(croppedUrl) => {
            if (cropModalOnConfirm) {
              cropModalOnConfirm(croppedUrl);
            }
            setIsCropModalOpen(false);
          }}
        />
      )}

      {/* Share Published Album Modal with Hero Context Preview */}
      {isShareAlbumModalOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn select-none"
          onClick={() => setIsShareAlbumModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-[#0c0d14] border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-8 select-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-white">Share Published Album</h3>
                  <p className="font-mono-tech text-[11px] text-zinc-400">Carries official album hero image</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareAlbumModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hero Context Image Link Card */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-mono-tech text-zinc-400">
                <span className="uppercase font-semibold tracking-wider flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-3 h-3" />
                  Link Context Preview (Displays Album Hero)
                </span>
                <span>Live Archive</span>
              </div>

              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/60 shadow-lg">
                <div className="h-40 w-full overflow-hidden relative">
                  <img 
                    src={currentSet.bannerImageUrl || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85'} 
                    alt="Album Hero"
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2.5 left-3 right-3 text-white">
                    <span className="text-[10px] font-mono-tech uppercase font-bold text-[#d4af37] block">
                      {currentSet.institutionName || 'University'}
                    </span>
                    <h4 className="font-syne font-bold text-sm truncate">
                      {currentSet.departmentName} (Class of {currentSet.graduationYear})
                    </h4>
                  </div>
                </div>
                <div className="p-3 bg-zinc-950/80 space-y-1">
                  <p className="font-body text-xs text-zinc-300 line-clamp-2">
                    {currentSet.ourStory || 'Explore portraits, memories, awards, and milestones of our graduating set.'}
                  </p>
                  <p className="font-mono-tech text-[10px] text-amber-400 truncate">
                    {getAlbumUrl(currentSet)}
                  </p>
                </div>
              </div>
            </div>

            {/* Share & Copy Actions */}
            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3">
                <span className="font-mono-tech text-xs text-zinc-300 truncate select-all">
                  {getAlbumUrl(currentSet)}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await copyUrlToClipboard(getAlbumUrl(currentSet));
                    setCopiedAlbumShareLink(true);
                    setTimeout(() => setCopiedAlbumShareLink(false), 2500);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedAlbumShareLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAlbumShareLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Explore the official Class of ${currentSet.graduationYear} Album for ${currentSet.departmentName}:\n${getAlbumUrl(currentSet)}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-emerald-300 font-mono-tech text-xs flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    if (typeof navigator !== 'undefined' && 'share' in navigator) {
                      try {
                        await navigator.share({
                          title: `${currentSet.departmentName} Class of ${currentSet.graduationYear} Album`,
                          text: `Explore the official Class of ${currentSet.graduationYear} Album for ${currentSet.departmentName} on KoHot!`,
                          url: getAlbumUrl(currentSet),
                        });
                      } catch (e) {}
                    } else {
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Explore the official Class of ${currentSet.graduationYear} Album for ${currentSet.departmentName} on KoHot:`)}&url=${encodeURIComponent(getAlbumUrl(currentSet))}`, '_blank');
                    }
                  }}
                  className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono-tech text-xs flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Album</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Window: Edit Class Award Modal */}
      {editingAwardModalItem && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0c0d14] border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const modalAwardVisual = getAwardVisualConfig(editingAwardModalItem.trophyType, false);
                  const ModalAwardIcon = modalAwardVisual.icon;
                  return (
                    <div className={`w-9 h-9 flex items-center justify-center ${modalAwardVisual.shapeClass}`}>
                      <ModalAwardIcon
                        className={`w-5 h-5 ${modalAwardVisual.iconColor} ${
                          modalAwardVisual.type === 'crystal' ? '-rotate-45' : ''
                        }`}
                      />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-syne font-bold text-base text-white">Edit Class Award</h3>
                  <p className="font-mono-tech text-[11px] text-zinc-400">View full citation and update award details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAwardModalItem(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAwardModal} className="space-y-4 text-xs font-body">
              {/* Photo Input (Hidden) */}
              <input
                ref={modalAwardPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleModalAwardPhotoSelect}
              />

              {/* Select Classmate or Upload Winner Portrait Photo */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tech text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recipient Profile</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAwardPickerOpen(true)}
                    className="px-3 py-1 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-mono-tech text-[11px] uppercase font-bold cursor-pointer"
                  >
                    Select Classmate →
                  </button>
                </div>

                <div className="flex items-center gap-4 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => modalAwardPhotoInputRef.current?.click()}
                    className="w-16 h-16 rounded-2xl bg-[#08090e] border-2 border-dashed border-white/25 hover:border-[#d4af37] overflow-hidden relative group shrink-0 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Upload recipient portrait photo"
                  >
                    {editingAwardModalItem.winnerAvatar ? (
                      <img
                        src={editingAwardModalItem.winnerAvatar}
                        alt={editingAwardModalItem.winnerName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-zinc-400 group-hover:text-[#d4af37] transition-colors" />
                        <span className="text-[9px] font-mono-tech uppercase text-zinc-400 group-hover:text-white">
                          Photo
                        </span>
                      </>
                    )}
                  </button>
                  <div className="flex-1 space-y-1">
                    <span className="font-syne font-bold text-xs text-white block">Winner Portrait Photo</span>
                    <p className="font-body text-[11px] text-zinc-400">Upload a custom photo or select a classmate above</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => modalAwardPhotoInputRef.current?.click()}
                        className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>{editingAwardModalItem.winnerAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                      </button>
                      {editingAwardModalItem.winnerAvatar && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerCropForImage(
                              editingAwardModalItem.rawAvatar || editingAwardModalItem.winnerAvatar,
                              '1:1',
                              'Resize Award Recipient Photo',
                              (croppedUrl) => {
                                setEditingAwardModalItem({
                                  ...editingAwardModalItem,
                                  winnerAvatar: croppedUrl,
                                  rawAvatar: editingAwardModalItem.rawAvatar || editingAwardModalItem.winnerAvatar,
                                });
                              }
                            );
                          }}
                          className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Resize award portrait"
                        >
                          <Crop className="w-3 h-3 text-amber-400" />
                          <span>Resize</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Award Category */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                  Award Title / Category *
                </label>
                <input
                  required
                  type="text"
                  value={editingAwardModalItem.category}
                  onChange={(e) =>
                    setEditingAwardModalItem({ ...editingAwardModalItem, category: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              {/* Recipient Full Name & Nickname */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                    Winner Full Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={editingAwardModalItem.winnerName}
                    onChange={(e) =>
                      setEditingAwardModalItem({ ...editingAwardModalItem, winnerName: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                    Nickname (Optional)
                  </label>
                  <input
                    type="text"
                    value={editingAwardModalItem.winnerNickname || ''}
                    onChange={(e) =>
                      setEditingAwardModalItem({ ...editingAwardModalItem, winnerNickname: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Trophy Type — Visual Icon & Name List Selector matching New Award Modal */}
              <div>
                <AwardTypeSelector
                  value={editingAwardModalItem.trophyType || 'gold'}
                  onChange={(val) =>
                    setEditingAwardModalItem({
                      ...editingAwardModalItem,
                      trophyType: val as any,
                    })
                  }
                  label="Trophy Finish Style"
                />
              </div>

              {/* Citation */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                  Full Award Citation / Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={editingAwardModalItem.citation || ''}
                  onChange={(e) =>
                    setEditingAwardModalItem({ ...editingAwardModalItem, citation: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = editingAwardModalItem.id;
                    setEditingAwardModalItem(null);
                    handleDeleteAward(idToDelete);
                  }}
                  className="px-3.5 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingAwardModalItem(null)}
                    className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech font-bold text-xs uppercase shadow-md cursor-pointer"
                  >
                    Update Award
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Reading View Popup for Admin Story Preview */}
      {readingStoryAdminTarget && (
        <StoryReadingModal
          isOpen={Boolean(readingStoryAdminTarget)}
          onClose={() => setReadingStoryAdminTarget(null)}
          authorName={readingStoryAdminTarget.student.fullName}
          authorRole={getDisplayRoleLabel(readingStoryAdminTarget.student)}
          authorPhoto={
            readingStoryAdminTarget.student.photoUrl ||
            readingStoryAdminTarget.student.rawPhotoUrl
          }
          storyText={getProfileStoryText(readingStoryAdminTarget.student)}
          sectionLabel={readingStoryAdminTarget.sectionLabel}
          isDark={!isLightMode}
        />
      )}

      {/* Direct 30-Day Recoverable Soft Delete Modal */}
      {isRequestDeletionModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-[#121318] border border-red-500/30 p-6 sm:p-7 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-white">
                    Delete Class Album
                  </h3>
                  <p className="text-[11px] font-mono-tech text-amber-400">
                    Recoverable within 30 days
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestDeletionModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-body text-xs text-zinc-300 leading-relaxed">
              <p>
                Are you sure you want to delete <span className="text-white font-bold">{currentSet.departmentName} (Class of {currentSet.graduationYear})</span>?
              </p>
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-1.5 text-zinc-300">
                <p className="font-mono-tech text-[11px] uppercase text-red-300 font-bold">
                  What happens when you delete:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-300">
                  <li>Album data is immediately wiped and hidden from your dashboard and the public album.</li>
                  <li>You can still sign in within <span className="text-white font-semibold">30 days</span> to recover your album.</li>
                  <li>After 30 days, the album is permanently purged for your account.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsRequestDeletionModalOpen(false)}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-soft-delete-album-btn"
                type="button"
                onClick={handleConfirmSoftDelete}
                className="px-6 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-syne font-bold text-xs uppercase shadow-md cursor-pointer transition-colors"
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
