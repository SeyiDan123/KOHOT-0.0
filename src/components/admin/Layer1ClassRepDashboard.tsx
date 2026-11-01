import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { getYouTubeThumbnailUrl } from '../../utils/youtube';
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
    'students' | 'memories' | 'awards' | 'voices' | 'story' | 'videos'
  >(() => {
    try {
      const saved = sessionStorage.getItem('kohot_admin_dashboard_tab');
      if (saved && ['students', 'memories', 'awards', 'voices', 'story', 'videos'].includes(saved)) {
        return saved as any;
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

  const [slotBalance, setSlotBalance] = useState<number>(initialAvailableSlots);
  const [totalSlotsCredited, setTotalSlotsCredited] = useState<number>(initialCreditedSlots);
  const [totalSlotsUsed, setTotalSlotsUsed] = useState<number>(initialUsedSlots);
  const [slotPriceNaira, setSlotPriceNaira] = useState<number>(500);
  const [slotPurchasesList, setSlotPurchasesList] = useState<any[]>(currentSet.sponsors || []);
  const [slotLedgerList, setSlotLedgerList] = useState<any[]>((currentSet as any).slotLedger || []);
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
  const [legacyFooterUrl, setLegacyFooterUrl] = useState(currentSet.legacyGroupImageUrl);
  const [isCompressingHero, setIsCompressingHero] = useState(false);
  const [isCompressingFooter, setIsCompressingFooter] = useState(false);
  const [imagerySaveToast, setImagerySaveToast] = useState<string | null>(null);

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

  // Restore scroll position when returning from Preview Album
  useEffect(() => {
    try {
      const savedTab = sessionStorage.getItem('kohot_admin_dashboard_tab');
      if (savedTab && ['students', 'memories', 'awards', 'voices', 'story', 'videos'].includes(savedTab)) {
        setActiveTab(savedTab as any);
      }
      const savedSubtab = sessionStorage.getItem('kohot_admin_dashboard_subtab');
      if (savedSubtab && (savedSubtab === 'moments' || savedSubtab === 'highlights')) {
        setMemoriesAdminSubTab(savedSubtab as any);
      }

      const savedPos = sessionStorage.getItem('kohot_admin_dashboard_scroll_pos');
      if (savedPos) {
        const pos = parseInt(savedPos, 10);
        if (!isNaN(pos) && pos > 0) {
          window.scrollTo({ top: pos, behavior: 'instant' });
          requestAnimationFrame(() => {
            window.scrollTo({ top: pos, behavior: 'instant' });
          });
          setTimeout(() => {
            window.scrollTo({ top: pos, behavior: 'instant' });
          }, 80);
          setTimeout(() => {
            window.scrollTo({ top: pos, behavior: 'instant' });
          }, 200);
        }
      } else if (savedTab === 'memories') {
        setTimeout(() => {
          const el = document.getElementById('moments-edit-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
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
      
      const tabMap: Record<string, string> = {
        students: 'graduates',
        imagery: 'graduates',
        memories: 'memories',
        awards: 'awards',
        voices: 'voices',
        story: 'story',
        videos: 'videos',
      };
      sessionStorage.setItem('kohot_album_preview_tab', tabMap[activeTab] || 'graduates');
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
  const [videos, setVideos] = useState<DepartmentVideoItem[]>(currentSet.videos || []);
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

  // Check if 3 steps under the publish modal are completed
  const isThreeStepsCompleted = useMemo(() => {
    const hasStep1 = Boolean(currentSet.convocationDate && currentSet.convocationDate.trim().length > 0);
    const hasStep2 = Boolean(
      (currentSet as any).testimonialText ||
      (currentSet as any).publishStepsCompleted ||
      (currentSet as any).testimonialPermission
    );
    const hasStep3 = Boolean(
      currentSet.nextClassContact &&
      currentSet.nextClassContact.name &&
      (currentSet.nextClassContact.phoneOrWhatsapp || currentSet.nextClassContact.email)
    );
    return hasStep1 && hasStep2 && hasStep3;
  }, [currentSet]);

  const isAlbumPublished = currentSet.activationStatus === 'active' || isThreeStepsCompleted || (currentSet as any).isPublished === true;

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

  // Cropping Modal State for all Dashboard Uploads & Framings
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalImage, setCropModalImage] = useState<string>('');
  const [cropModalAspect, setCropModalAspect] = useState<CropAspectRatio>('free');
  const [cropModalTitle, setCropModalTitle] = useState<string>('Adjust Framing & Crop');
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

  // Sync imagery, socials, and videos state when currentSet changes
  useEffect(() => {
    setHeroBannerUrl(currentSet.bannerImageUrl);
    setLegacyFooterUrl(currentSet.legacyGroupImageUrl);
    if (currentSet.socials) setSocials(currentSet.socials);
    if (currentSet.videos) setVideos(currentSet.videos);
  }, [currentSet.bannerImageUrl, currentSet.legacyGroupImageUrl, currentSet.socials, currentSet.videos]);

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
              if (!uploadRes.success || !uploadRes.url || uploadRes.url.startsWith('data:')) {
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
              if (!uploadRes.success || !uploadRes.url || uploadRes.url.startsWith('data:')) {
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
    onUpdateSet({
      ...currentSet,
      bannerImageUrl: heroBannerUrl,
      legacyGroupImageUrl: legacyFooterUrl,
      socials: socials,
      videos: videos,
    });
    setImagerySaveToast('✓ Album cover imagery, department social handles, and video embeds saved!');
    showSuccess('Album Design Saved', 'Your hero banner, footer portrait, and department social icons are now active on the album.');
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
    setVideoYoutubeUrl(v.youtubeUrl);
    setVideoThumbnailUrl(v.thumbnailUrl || '');
    setVideoDescription(v.description || '');
    setVideoDateStr(v.dateStr || '');
    setIsAddingVideo(true);
  };

  const handleSaveVideoItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle.trim() || !videoYoutubeUrl.trim()) return;

    let updatedVideos: DepartmentVideoItem[];
    if (editingVideo) {
      updatedVideos = videos.map((v) =>
        v.id === editingVideo.id
          ? {
              ...v,
              title: videoTitle.trim(),
              youtubeUrl: videoYoutubeUrl.trim(),
              thumbnailUrl: videoThumbnailUrl.trim() || undefined,
              description: videoDescription.trim() || undefined,
              dateStr: videoDateStr.trim() || undefined,
            }
          : v
      );
    } else {
      const newVid: DepartmentVideoItem = {
        id: `vid-${Date.now()}`,
        title: videoTitle.trim(),
        youtubeUrl: videoYoutubeUrl.trim(),
        thumbnailUrl: videoThumbnailUrl.trim() || undefined,
        description: videoDescription.trim() || undefined,
        dateStr: videoDateStr.trim() || undefined,
      };
      updatedVideos = [...videos, newVid];
    }

    setVideos(updatedVideos);
    onUpdateSet({
      ...currentSet,
      videos: updatedVideos,
    });
    setIsAddingVideo(false);
    setEditingVideo(null);
    setImagerySaveToast(editingVideo ? '✓ Video details updated!' : '✓ Video added to album!');
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

    if (approveNow) {
      const trimmedPos = updatedStudent.position?.trim() || '';
      const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

      const approvedStudent: StudentProfile = {
        ...updatedStudent,
        approved: true,
        approvedAt: Date.now(),
        leaderOrder: isLeader && !updatedStudent.leaderOrder ? calculateIntuitiveHierarchyRank(trimmedPos) : updatedStudent.leaderOrder,
      };

      // Move recently approved student to the very top of the list
      const remainingStudents = currentSet.students.filter((s) => s.id !== updatedStudent.id);
      updatedStudents = [approvedStudent, ...remainingStudents];

      // Cleanly transition to directory view without showing any empty form
      setIsAddingStudent(false);
      setEditingStudent(null);
      setStudentDirectoryTab('all');
      setStudentSortMode('recent');
    } else {
      if (exists) {
        updatedStudents = currentSet.students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s));
      } else {
        // Newly added admin profile: place at the beginning of the class roster
        updatedStudents = [updatedStudent, ...currentSet.students];
      }
      setEditingStudent(null);
    }

    // Determine if this profile is the Admin's own profile
    const adminEmail = (currentUser?.email || currentSet.classRepEmail || '').toLowerCase().trim();
    const adminName = (currentUser?.fullName || currentSet.classRepName || '').toLowerCase().trim();
    const isThisAdmin =
      updatedStudent.id.startsWith('admin-') ||
      (updatedStudent.email && updatedStudent.email.toLowerCase().trim() === adminEmail) ||
      (updatedStudent.fullName && updatedStudent.fullName.toLowerCase().trim() === adminName) ||
      (updatedStudent as any).isClassRep === true;

    const updatedSet: ClassSet = {
      ...currentSet,
      students: updatedStudents,
      classRepName: isThisAdmin ? updatedStudent.fullName : currentSet.classRepName,
      classRepEmail: isThisAdmin ? (updatedStudent.email || currentSet.classRepEmail) : currentSet.classRepEmail,
      classRepPhone: isThisAdmin ? (updatedStudent.whatsappNumber || currentSet.classRepPhone) : currentSet.classRepPhone,
    };

    onUpdateSet(updatedSet);

    // If it's the admin profile, reflect newly input photo, name, email on the top right profile icon and currentUser storage
    if (isThisAdmin) {
      try {
        if (currentUser) {
          if (updatedStudent.photoUrl) currentUser.avatarUrl = updatedStudent.photoUrl;
          if (updatedStudent.fullName) currentUser.fullName = updatedStudent.fullName;
          if (updatedStudent.email) currentUser.email = updatedStudent.email;
          if (updatedStudent.whatsappNumber) currentUser.phone = updatedStudent.whatsappNumber;
          localStorage.setItem('kohot_current_user', JSON.stringify(currentUser));
        }
        window.dispatchEvent(new CustomEvent('kohot_user_profile_updated', {
          detail: {
            avatarUrl: updatedStudent.photoUrl || currentUser?.avatarUrl,
            fullName: updatedStudent.fullName,
            email: updatedStudent.email,
            phone: updatedStudent.whatsappNumber
          }
        }));
      } catch (e) {
        console.error('Failed to sync admin user profile:', e);
      }
    }

    setHierarchyToast(
      approveNow
        ? `✓ Approved ${updatedStudent.fullName} — now visible at the top of the Graduates section!`
        : `✓ Updated profile details for ${updatedStudent.fullName}!`
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
          setSlotBalance(bal);
          setTotalSlotsCredited(credited);
          setTotalSlotsUsed(used);
          if (Array.isArray(res.purchases)) setSlotPurchasesList(res.purchases);
          if (Array.isArray(res.ledger)) setSlotLedgerList(res.ledger);
        }
      })
      .catch(() => {});

    fetch('/api/config', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const feeKobo = Number(data?.slotFeeKobo || data?.studentFeeKobo || data?.settings?.student_fee_kobo || 0);
        if (feeKobo > 0) {
          setSlotPriceNaira(Math.round(feeKobo / 100));
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
    return (
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
    let list = currentSet.students.filter((s) => getStudentEffectiveStatus(s) === 'declined');
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

  // Single or Batch Approval Handler wired to Slot Ledger
  const handleApproveStudent = async (studentId: string) => {
    const student = currentSet.students.find((s) => s.id === studentId);
    if (!student) return;

    const needsSlot = !isStudentSlotFree(student);
    if (needsSlot && slotBalance <= 0) {
      setIsBuySlotsModalOpen(true);
      return;
    }

    setIsProcessingSubmissionAction(true);
    try {
      const serverRes = await approveAlbumSubmissionsOnServer(currentSet.id, [studentId]);
      const nextBalance =
        typeof serverRes.balanceLeft === 'number'
          ? serverRes.balanceLeft
          : Math.max(0, slotBalance - (needsSlot ? 1 : 0));
      const nextUsed = needsSlot ? totalSlotsUsed + 1 : totalSlotsUsed;
      const nextCredited = Math.max(totalSlotsCredited, nextBalance + nextUsed);
      setSlotBalance(nextBalance);
      setTotalSlotsUsed(nextUsed);
      setTotalSlotsCredited(nextCredited);

      const trimmedPos = student.position?.trim() || '';
      const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

      const approvedStudent: StudentProfile = {
        ...student,
        approved: true,
        status: 'approved',
        submissionStatus: 'approved',
        approvedAt: Date.now(),
        usedSlot: needsSlot,
        slotConsumed: needsSlot,
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

      const slotMsg =
        serverRes.message ||
        (needsSlot ? `1 slot used, ${nextBalance} left` : `Approved · 0 slots used, ${nextBalance} left`);
      setHierarchyToast(`✓ ${student.fullName} approved — ${slotMsg}`);
      setTimeout(() => setHierarchyToast(null), 4000);
      showSuccess('Classmate approved.', slotMsg);
    } finally {
      setIsProcessingSubmissionAction(false);
    }
  };

  // Batch Approve Selected Pending Profiles (Approves up to available slot balance)
  const handleApproveSelectedPending = async () => {
    const targetIds = selectedPendingIds.length > 0 ? selectedPendingIds : pendingStudents.map((s) => s.id);
    if (targetIds.length === 0) return;

    setIsProcessingSubmissionAction(true);
    try {
      const serverRes = await approveAlbumSubmissionsOnServer(currentSet.id, targetIds);
      let runningBalance = slotBalance;
      let slotsConsumedCount = 0;
      const now = Date.now();
      const approvedIdSet = new Set<string>(serverRes.approvedIds || []);

      // If server didn't return specific IDs (e.g. local fallback), compute up to available balance
      if (approvedIdSet.size === 0) {
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
      } else {
        runningBalance = typeof serverRes.balanceLeft === 'number' ? serverRes.balanceLeft : runningBalance;
        slotsConsumedCount = typeof serverRes.slotsUsedCount === 'number' ? serverRes.slotsUsedCount : 0;
      }

      if (approvedIdSet.size === 0) {
        setIsProcessingSubmissionAction(false);
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
            approvedAt: now,
            usedSlot: needsSlot,
            slotConsumed: needsSlot,
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
        serverRes.message ||
        (slotsConsumedCount === 1
          ? `1 slot used, ${runningBalance} left`
          : `Approved ${approvedIdSet.size} of ${targetIds.length} selected (${slotsConsumedCount} slots used, ${runningBalance} left)`);
      setHierarchyToast(`✓ ${summaryMsg}`);
      setTimeout(() => setHierarchyToast(null), 4500);
      showSuccess(`Approved ${approvedIdSet.size} profile${approvedIdSet.size === 1 ? '' : 's'}`, summaryMsg);
    } finally {
      setIsProcessingSubmissionAction(false);
    }
  };

  // Decline submission with required reason (returns +1 slot if previously approved with a slot)
  const handleDeclineSubmissionWithReason = async (student: StudentProfile, reason: string) => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      showError('Reason Required', 'Please enter a reason for declining this profile.');
      return;
    }
    setIsProcessingSubmissionAction(true);
    try {
      const wasApprovedWithSlot =
        getStudentEffectiveStatus(student) === 'approved' && Boolean(student.slotConsumed || student.usedSlot);
      const serverRes = await declineAlbumSubmissionOnServer(currentSet.id, student.id, trimmedReason);
      const nextBalance =
        typeof serverRes.slotSummary?.balance === 'number'
          ? serverRes.slotSummary.balance
          : wasApprovedWithSlot
          ? slotBalance + 1
          : slotBalance;
      setSlotBalance(nextBalance);

      const nowIso = new Date().toISOString();
      const reinstateUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const updatedStudent: StudentProfile = {
        ...student,
        approved: false,
        status: 'declined',
        submissionStatus: 'declined',
        declineReason: trimmedReason,
        declinedAt: nowIso,
        reinstateUntil,
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
      setInspectedProfileRow(updatedStudent);
      setBottomSheetActionMode('none');
      setBottomSheetReasonInput('');
      showWarning(
        'Profile Declined',
        wasApprovedWithSlot
          ? `Declined ${student.fullName}. 1 slot was returned to your balance (${nextBalance} left).`
          : `Declined ${student.fullName}. Can be reinstated within 7 days.`
      );
    } finally {
      setIsProcessingSubmissionAction(false);
    }
  };

  // Request changes with note (student edits via status link)
  const handleRequestChangesOnSubmission = async (student: StudentProfile, note: string) => {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      showError('Note Required', 'Please specify what changes the student should make.');
      return;
    }
    setIsProcessingSubmissionAction(true);
    try {
      await requestChangesAlbumSubmissionOnServer(currentSet.id, student.id, trimmedNote);
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
    } finally {
      setIsProcessingSubmissionAction(false);
    }
  };

  // Reinstate a declined profile within the 7-day window
  const handleReinstateSubmission = async (student: StudentProfile) => {
    if (student.reinstateUntil && new Date(student.reinstateUntil).getTime() < Date.now()) {
      showError('Reinstate Window Expired', 'The 7-day reinstatement window has passed.');
      return;
    }
    setIsProcessingSubmissionAction(true);
    try {
      await reinstateAlbumSubmissionOnServer(currentSet.id, student.id);
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
      showSuccess('Profile Reinstated', `${student.fullName} has been moved back to Pending.`);
    } finally {
      setIsProcessingSubmissionAction(false);
    }
  };

  // Remove a profile (does NOT return any used slot)
  const handleRemoveSubmissionNoSlotReturn = async (student: StudentProfile) => {
    setIsProcessingSubmissionAction(true);
    try {
      await removeAlbumSubmissionOnServer(currentSet.id, student.id);
      const updatedStudents = currentSet.students.filter((s) => s.id !== student.id);
      onUpdateSet({
        ...currentSet,
        students: updatedStudents,
      });
      setInspectedProfileRow(null);
      showWarning('Profile Removed', `${student.fullName} was removed. Used slots are not returned on removal.`);
    } finally {
      setIsProcessingSubmissionAction(false);
    }
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
    const res = await updateAlbumSponsorOnServer(currentSet.id, {
      id: editingSponsorItem.id,
      sponsorName: editSponsorNameText.trim(),
    });
    if (!res.success) {
      showError('Sponsor Update Blocked', res.message || 'Unable to update sponsor display.');
      return;
    }
    setSlotPurchasesList((prev) =>
      prev.map((p) =>
        p.id === editingSponsorItem.id
          ? {
              ...p,
              sponsor_name: editSponsorNameText.trim(),
              sponsorName: editSponsorNameText.trim(),
              show_sponsor_on_album: editSponsorVisibleToggle ? 1 : 0,
              showSponsorOnAlbum: editSponsorVisibleToggle,
            }
          : p
      )
    );
    setEditingSponsorItem(null);
    showSuccess('Sponsor Updated', 'Sponsor display updated and logged (quantities and balances remain untouched).');
  };

  // Move Leader Up or Down in Hierarchy
  const handleMoveLeader = (studentId: string, direction: 'up' | 'down') => {
    const currentIndex = adminLeaders.findIndex((s) => s.id === studentId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= adminLeaders.length) return;

    const reordered = reorderLeadersHierarchy(adminLeaders, currentIndex, targetIndex);
    
    // Merge updated leaderOrder back into currentSet.students
    const leaderOrderMap = new Map<string, number>();
    reordered.forEach((l) => {
      if (typeof l.leaderOrder === 'number') {
        leaderOrderMap.set(l.id, l.leaderOrder);
      }
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

    const targetLeader = adminLeaders[currentIndex];
    setHierarchyToast(`Hierarchy updated: ${targetLeader.fullName} moved ${direction} to Rank #${targetIndex + 1}.`);
    setTimeout(() => setHierarchyToast(null), 3000);
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
  const [newStudentPhotoUrl, setNewStudentPhotoUrl] = useState('');
  const [newStudentCompression, setNewStudentCompression] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [draggedMomentPhotoIndex, setDraggedMomentPhotoIndex] = useState<number | null>(null);
  const [dragOverMomentPhotoIndex, setDragOverMomentPhotoIndex] = useState<number | null>(null);
  const [draggedDraftPhotoIndex, setDraggedDraftPhotoIndex] = useState<number | null>(null);
  const [dragOverDraftPhotoIndex, setDragOverDraftPhotoIndex] = useState<number | null>(null);
  const [draggedBatchIndex, setDraggedBatchIndex] = useState<number | null>(null);
  const [dragOverBatchIndex, setDragOverBatchIndex] = useState<number | null>(null);
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
          triggerCropForImage(rawUrl, '1:1', 'Crop Award Recipient Photo', async (cropped) => {
            try {
              const comp = await compressImageToWebP(cropped, 720, 0.88);
              const upRes = await uploadMediaToR2(comp.dataUrl, {
                setId: currentSet.id,
                category: 'award',
                fileName: 'award-avatar.webp',
              });
              if (upRes.success && upRes.url && !upRes.url.startsWith('data:')) {
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
          triggerCropForImage(rawUrl, '1:1', 'Crop Contributor Photo', async (cropped) => {
            try {
              const comp = await compressImageToWebP(cropped, 720, 0.88);
              const upRes = await uploadMediaToR2(comp.dataUrl, {
                setId: currentSet.id,
                category: 'voice',
                fileName: 'voice-headshot.webp',
              });
              if (upRes.success && upRes.url && !upRes.url.startsWith('data:')) {
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
  const [storyText, setStoryText] = useState(currentSet.ourStory);
  const [storySaved, setStorySaved] = useState(false);

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
      if (upRes.success && upRes.url && !upRes.url.startsWith('data:')) {
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
    setNewStudentPhotoUrl('');
    setNewStudentCompression(null);
    setIsAddingStudent(false);
  };

  const handleDeleteStudent = (id: string) => {
    const student = currentSet.students.find((s) => s.id === id);
    confirmWarning({
      title: 'Delete Classmate Profile?',
      message: `Are you sure you want to delete "${student?.fullName || 'this student'}" from the album? This action cannot be undone.`,
      confirmLabel: 'Delete Profile',
      cancelLabel: 'Keep',
      isDestructive: true,
      onConfirm: () => {
        const updated = {
          ...currentSet,
          students: currentSet.students.filter((s) => s.id !== id),
        };
        onUpdateSet(updated);
        apiClientDeleteProfile(currentSet.id, id);
        showWarning('Profile deleted.', `${student?.fullName || 'Student'} was removed from the roster.`);
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
        if (!upRes.success || !upRes.url || upRes.url.startsWith('data:')) {
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
      order: currentSet.memories.length + 1,
      images: batchImages,
      eventDay: currentDayVal,
      eventMonth: batchMonth,
      eventYear: batchYear,
      isDayUnknown: isBatchDayUnknown,
      dateExtractedAutomatically: Boolean(extractedDateResult),
      dateExtractionSource: extractedDateResult?.sourceDescription,
      isConvocationBatch: isConv,
    };

    let updatedSet: ClassSet = {
      ...currentSet,
      memories: [...currentSet.memories, newBatch],
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
        if (!upRes.success || !upRes.url || upRes.url.startsWith('data:')) {
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

      const updatedMemories = currentSet.memories.map((m) => {
        if (m.id === batchId) {
          return {
            ...m,
            images: [...m.images, ...newItems],
          };
        }
        return m;
      });

      onUpdateSet({
        ...currentSet,
        memories: updatedMemories,
      });

      setActiveAppendBatchId(null);
      setHierarchyToast(`✓ Added ${newItems.length} photos to category!`);
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
      isConvocationBatch: isConv,
    };

    const updatedMemories = currentSet.memories.map((m) =>
      m.id === updatedBatch.id ? updatedBatch : m
    );

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
    setHierarchyToast(`✓ Moment "${updatedBatch.title}" updated!`);
    setTimeout(() => setHierarchyToast(null), 3000);
    showSuccess('Moment updated.', `"${updatedBatch.title}" has been saved.`);
  };

  // Canva-style Hold & Drag-and-Drop reorder for photos inside Edit Moment Modal
  const handleReorderEditMomentPhotos = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !editingMomentBatchModal) return;
    const updatedImages = [...editingMomentBatchModal.images];
    if (fromIndex < 0 || fromIndex >= updatedImages.length || toIndex < 0 || toIndex >= updatedImages.length) return;
    const [moved] = updatedImages.splice(fromIndex, 1);
    updatedImages.splice(toIndex, 0, moved);
    setEditingMomentBatchModal({
      ...editingMomentBatchModal,
      images: updatedImages,
    });
  };

  // Canva-style Hold & Drag-and-Drop reorder for photos inside Create New Category Modal
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

  // Canva-style Hold & Drag-and-Drop reorder for Moment Category cards
  const handleReorderMomentBatches = (fromIndex: number, toIndex: number) => {
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
    setHierarchyToast(`✓ Rearranged "${moved.title}" to position #${toIndex + 1}.`);
    setTimeout(() => setHierarchyToast(null), 2500);
  };

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
        if (!upRes.success || !upRes.url || upRes.url.startsWith('data:')) {
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
      if (!upRes.success || !upRes.url || upRes.url.startsWith('data:')) {
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
        'Crop Speaker / Mentor Headshot',
        async (croppedUrl) => {
          const comp = await compressImageToWebP(croppedUrl, 720, 0.88);
          const upRes = await uploadMediaToR2(comp.dataUrl, {
            setId: currentSet.id,
            category: 'voice',
            fileName: 'voice-headshot.webp',
          });
          if (upRes.success && upRes.url && !upRes.url.startsWith('data:')) {
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
        'Crop Award Winner Portrait',
        async (croppedUrl) => {
          const comp = await compressImageToWebP(croppedUrl, 720, 0.88);
          const upRes = await uploadMediaToR2(comp.dataUrl, {
            setId: currentSet.id,
            category: 'award',
            fileName: 'award-avatar.webp',
          });
          if (upRes.success && upRes.url && !upRes.url.startsWith('data:')) {
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
      ourStory: storyText,
    });
    setStorySaved(true);
    setTimeout(() => setStorySaved(false), 2500);
  };

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
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 relative transition-colors ${
        isLightMode 
          ? 'bg-white/95 border-zinc-300 text-black shadow-sm' 
          : 'bg-[#18181b]/90 border-zinc-800 text-white'
      }`}>
        {/* Left: Album Admin Title and Name (No links back to public site) */}
        <div className="flex items-center gap-3.5 min-w-0">
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
          className="p-2.5 sm:p-3.5 rounded-2xl bg-[#0c0d14] border border-white/15 shadow-lg space-y-2"
        >
          {/* Row 1: Album title on one line (truncated) + small status line under it */}
          <div className="min-w-0">
            <h2 className="font-syne font-bold text-sm sm:text-lg text-white tracking-tight truncate">
              {currentSet.departmentName} • Class of {currentSet.graduationYear}
            </h2>
            <p className="font-mono-tech text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isAlbumPublished || currentSet.activationStatus === 'active'
                    ? 'bg-emerald-400'
                    : 'bg-zinc-500'
                }`}
              />
              <span>
                {isAlbumPublished || currentSet.activationStatus === 'active'
                  ? 'Published · Live'
                  : 'Draft'}
              </span>
            </p>
          </div>

          {/* Row 2: Two buttons side by side, at least 42px high: wider gold ALBUM DESIGN + existing Publish button */}
          <div className="flex items-center gap-2">
            <button
              id="open-album-design-btn"
              type="button"
              onClick={() => setIsAlbumDesignModalOpen(true)}
              className="flex-[1.35] min-h-[42px] px-3 rounded-xl bg-[#d4af37] hover:bg-[#e5c14d] text-black font-syne text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#d4af37]/15 active:scale-98"
            >
              <Palette className="w-3.5 h-3.5 text-black shrink-0" />
              <span className="truncate">ALBUM DESIGN</span>
            </button>

            <button
              id="open-publish-modal-btn"
              type="button"
              onClick={() => setIsPublishModalOpen(true)}
              className={`flex-1 min-h-[42px] px-3 rounded-xl font-syne font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 text-center ${
                isAlbumPublished
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-white hover:bg-zinc-200 text-black shadow-md'
              }`}
              title={
                isAlbumPublished
                  ? 'Album is Published (Live)'
                  : 'Complete 3 steps or toggle public to publish'
              }
            >
              {isAlbumPublished ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-black" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{isAlbumPublished ? 'Published' : 'Publish Album'}</span>
            </button>
          </div>
        </div>

        {/* Dashboard Section Navigation Tabs (40px high) */}
        <div
          className={`flex items-center gap-2 overflow-x-auto no-scrollbar border-b pb-2.5 ${
            isLightMode ? 'border-zinc-200' : 'border-white/[0.08]'
          }`}
        >
          <button
            id="tab-btn-students"
            onClick={() => setActiveTab('students')}
            className={`h-10 px-4 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'students'
                ? 'bg-[#2563eb] text-white font-semibold shadow-lg shadow-blue-600/25'
                : isLightMode
                ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs'
                : 'bg-[#0e1117] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Classmates ({approvedStudents.length})</span>
            {pendingStudents.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-black font-bold text-[10px]">
                {pendingStudents.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-memories"
            onClick={() => setActiveTab('memories')}
            className={`h-10 px-4 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'memories'
                ? 'bg-[#2563eb] text-white font-semibold shadow-lg shadow-blue-600/25'
                : isLightMode
                ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs'
                : 'bg-[#0e1117] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Moments ({currentSet.memories.length})</span>
          </button>

          <button
            id="tab-btn-awards"
            onClick={() => setActiveTab('awards')}
            className={`h-10 px-4 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'awards'
                ? 'bg-[#2563eb] text-white font-semibold shadow-lg shadow-blue-600/25'
                : isLightMode
                ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs'
                : 'bg-[#0e1117] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Awards ({currentSet.awards.length})</span>
          </button>

          <button
            id="tab-btn-voices"
            onClick={() => setActiveTab('voices')}
            className={`h-10 px-4 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'voices'
                ? 'bg-[#2563eb] text-white font-semibold shadow-lg shadow-blue-600/25'
                : isLightMode
                ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs'
                : 'bg-[#0e1117] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10'
            }`}
          >
            <Quote className="w-3.5 h-3.5" />
            <span>Voices ({currentSet.voices.length})</span>
          </button>

          <button
            id="tab-btn-story"
            onClick={() => setActiveTab('story')}
            className={`h-10 px-4 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'story'
                ? 'bg-[#2563eb] text-white font-semibold shadow-lg shadow-blue-600/25'
                : isLightMode
                ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs'
                : 'bg-[#0e1117] hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Our Story</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: PEOPLE MANAGEMENT (SLIM STICKY SLOTS BAR + COMPACT 44PX PROFILE ROWS)
            ========================================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-2">
            {/* STICKY SLOTS BAR (Replaces large Profile Slots Ledger) */}
            {(() => {
              const activeProfiles = currentSet.students.filter(
                (s) =>
                  getStudentEffectiveStatus(s) !== 'removed' &&
                  getStudentEffectiveStatus(s) !== 'declined'
              );
              const totalProfilesCount = activeProfiles.length;
              const alreadyFundedCount = activeProfiles.filter(
                (s) =>
                  getStudentEffectiveStatus(s) === 'approved' || isStudentSlotFree(s)
              ).length;
              const unfundedPendingCount = Math.max(0, totalProfilesCount - alreadyFundedCount);
              const fundedToPublishCount =
                alreadyFundedCount + Math.min(unfundedPendingCount, slotBalance);

              return (
                <div
                  id="people-slots-card"
                  className="sticky top-[49px] z-20 px-3 py-2 rounded-2xl bg-[#0c0d14]/95 backdrop-blur-md border border-white/10 shadow-md space-y-1"
                >
                  {/* Row 1: Left: bold available number with "slots left" and "₦{price} per slot" under it; Right: gold "Buy slots" button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-syne font-extrabold text-lg sm:text-xl text-white leading-none">
                          {slotBalance}
                        </span>
                        <span className="font-syne font-bold text-xs sm:text-sm text-white">
                          slots left
                        </span>
                      </div>
                      <p className="font-mono-tech text-[10px] text-zinc-400 leading-tight mt-0.5">
                        ₦{slotPriceNaira.toLocaleString()} per slot
                      </p>
                    </div>

                    <button
                      id="buy-profile-slots-btn"
                      type="button"
                      onClick={() => setIsBuySlotsModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#d4af37] hover:bg-[#e5c14d] text-black font-syne font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow shrink-0"
                    >
                      Buy slots
                    </button>
                  </div>

                  {/* Row 2: "N of M funded to publish" and "Details ›" */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06] font-mono-tech text-[11px]">
                    <span className="text-zinc-300">
                      {fundedToPublishCount} of {totalProfilesCount} funded to publish
                    </span>
                    <button
                      id="open-slot-details-sheet-btn"
                      type="button"
                      onClick={() => setIsSlotDetailsSheetOpen(true)}
                      className="text-[#d4af37] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Details ›</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Classmates Section Header + Invite Classmates & Add Classmate Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <h3 className="font-serif text-lg sm:text-xl text-white leading-tight">
                  Classmate Profiles ({approvedStudents.length})
                </h3>
                <p className="font-body text-xs text-zinc-400 mt-0.5 leading-snug">
                  Manage approved profiles, leadership roles, and pending class submissions.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="invite-classmates-btn"
                  type="button"
                  onClick={() => setIsInviteClassmatesModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-2xl bg-[#d4af37] hover:bg-[#e5c14d] text-black font-mono-tech text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-[#d4af37]/15"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span className="leading-tight text-center">INVITE<br className="sm:hidden" /> CLASSMATES</span>
                </button>

                <button
                  id="add-student-btn"
                  type="button"
                  onClick={() => setIsAddingStudent(true)}
                  className="px-4 py-2.5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-blue-600/20"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="leading-tight text-center">ADD<br className="sm:hidden" /> CLASSMATE</span>
                </button>
              </div>
            </div>

            {/* ONE-TIME DISMISSIBLE TIP */}
            {!isPreviewTipDismissed && (
              <div
                id="one-time-row-preview-tip"
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2 text-[11px] font-body text-zinc-300"
              >
                <span>Tap any row to preview the profile as it appears on the public album.</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewTipDismissed(true);
                    try {
                      localStorage.setItem('kohot_dismiss_row_preview_tip', '1');
                    } catch {}
                  }}
                  className="p-0.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                  aria-label="Dismiss tip"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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

            {/* HORIZONTALLY SCROLLABLE FILTER CHIP ROW + ALWAYS-VISIBLE SEARCH BAR */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  id="admin-subtab-pending"
                  type="button"
                  onClick={() => setStudentDirectoryTab('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    studentDirectoryTab === 'pending'
                      ? 'bg-amber-400 text-black font-bold shadow'
                      : pendingStudents.length > 0
                      ? 'text-amber-300 bg-amber-400/15 border border-amber-400/35 font-semibold'
                      : 'text-zinc-300 hover:text-white bg-[#0c0d14] hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>Pending ({pendingStudents.length})</span>
                </button>

                <button
                  id="admin-subtab-all"
                  type="button"
                  onClick={() => setStudentDirectoryTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    studentDirectoryTab === 'all'
                      ? 'bg-white text-black font-bold shadow'
                      : 'text-zinc-300 hover:text-white bg-[#0c0d14] hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>All ({approvedStudents.length})</span>
                </button>

                <button
                  id="admin-subtab-leaders"
                  type="button"
                  onClick={() => setStudentDirectoryTab('leaders')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    studentDirectoryTab === 'leaders'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold shadow'
                      : 'text-amber-300 hover:text-amber-200 bg-amber-400/[0.06] hover:bg-amber-400/15 border border-amber-400/20'
                  }`}
                >
                  <span>Leaders ({adminLeaders.length})</span>
                </button>

                {changesRequestedStudents.length > 0 && (
                  <button
                    id="admin-subtab-changes-requested"
                    type="button"
                    onClick={() => setStudentDirectoryTab('changes_requested')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      studentDirectoryTab === 'changes_requested'
                        ? 'bg-sky-400 text-black font-bold shadow'
                        : 'text-zinc-300 hover:text-white bg-[#0c0d14] hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <span>Changes requested ({changesRequestedStudents.length})</span>
                  </button>
                )}

                {declinedStudents.length > 0 && (
                  <button
                    id="admin-subtab-declined"
                    type="button"
                    onClick={() => setStudentDirectoryTab('declined')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      studentDirectoryTab === 'declined'
                        ? 'bg-red-500 text-white font-bold shadow'
                        : 'text-zinc-300 hover:text-white bg-[#0c0d14] hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <span>Declined ({declinedStudents.length})</span>
                  </button>
                )}
              </div>

              {/* Revealed Search Bar + Sort Menu (Recent first, A-Z) */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-student-search-input"
                    type="text"
                    value={adminStudentSearch}
                    onChange={(e) => setAdminStudentSearch(e.target.value)}
                    placeholder="Search classmates by name, nickname, or role..."
                    className="w-full bg-[#0c0d14] border border-white/15 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/30 font-body"
                  />
                  {adminStudentSearch && (
                    <button
                      type="button"
                      onClick={() => setAdminStudentSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center p-0.5 rounded-xl bg-[#0c0d14] border border-white/15 text-[11px] font-mono-tech shrink-0">
                  <button
                    type="button"
                    onClick={() => setStudentSortMode('recent')}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      studentSortMode === 'recent'
                        ? 'bg-white text-black font-bold shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Recent first
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentSortMode('alpha')}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      studentSortMode === 'alpha'
                        ? 'bg-white text-black font-bold shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    A-Z
                  </button>
                </div>

                {studentDirectoryTab === 'leaders' && (
                  <button
                    id="reset-intuitive-hierarchy-btn"
                    type="button"
                    onClick={handleResetToIntuitiveHierarchy}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-mono-tech text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-400" />
                    <span>Auto-Rank</span>
                  </button>
                )}
              </div>
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

            {/* Add Classmate Pop-up Window Modal */}
            <UniversalModal
              isOpen={isAddingStudent}
              onClose={() => setIsAddingStudent(false)}
              title="Add Classmate Profile"
              subtitle="Only add people who asked you to."
              maxWidth="3xl"
            >
              <form onSubmit={handleSaveStudent} className="space-y-5 text-xs font-body p-1">
                <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center gap-2 text-amber-200 font-mono-tech text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Only add people who asked you to.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="e.g. Oluwaseun Adeleke"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                      Nickname / Moniker
                    </label>
                    <input
                      type="text"
                      value={newStudentNickname}
                      onChange={(e) => setNewStudentNickname(e.target.value)}
                      placeholder="e.g. Code Maestro"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                      Set Role / Leadership Title
                    </label>
                    <input
                      type="text"
                      value={newStudentPosition}
                      onChange={(e) => setNewStudentPosition(e.target.value)}
                      placeholder="e.g. Department President or Class Rep"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                    Memorable Parting Quote
                  </label>
                  <textarea
                    rows={2}
                    value={newStudentQuote}
                    onChange={(e) => setNewStudentQuote(e.target.value)}
                    placeholder="e.g. Through the hardest semesters, we stayed united and forged our future."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none"
                  />
                </div>

                {/* Portrait Photo Upload */}
                <div className="p-5 rounded-2xl bg-[#08090e] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                      Portrait Photograph *
                    </label>
                    <span className="text-[10px] font-mono-tech text-white/60">
                      Gallery &amp; Camera Upload
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressing}
                      className="py-2.5 px-5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs tracking-wider uppercase transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {isCompressing
                          ? 'Processing Photo...'
                          : newStudentPhotoUrl
                          ? 'Change Portrait'
                          : 'Upload Student Photo'}
                      </span>
                    </button>
                  </div>

                  {newStudentPhotoUrl && (
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={newStudentPhotoUrl}
                          alt="Preview"
                          className="w-11 h-11 rounded-lg object-cover border border-white/20"
                        />
                        <span className="text-xs text-zinc-400 font-mono-tech">Photo preview ready</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerCropForImage(
                            newStudentPhotoUrl,
                            '1:1',
                            `Crop Portrait: ${newStudentName || 'New Classmate'}`,
                            (croppedUrl) => {
                              setNewStudentPhotoUrl(croppedUrl);
                            }
                          );
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#d4af37] border border-white/15 text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Crop className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Crop Portrait</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAddingStudent(false)}
                    className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newStudentName || !newStudentPhotoUrl}
                    className="bg-[#d4af37] hover:bg-[#c49f27] disabled:opacity-40 text-black font-tech text-xs tracking-wider uppercase font-bold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow-lg"
                  >
                    Save Classmate Profile
                  </button>
                </div>
              </form>
            </UniversalModal>

            {/* =====================================================================
                VIEW 1: ALL VIEW (RESIZED PROFILE CARDS MATCHING SCREENSHOT 1 + DETAILS)
               ===================================================================== */}
            {studentDirectoryTab === 'all' && (
              <div className="space-y-2.5">
                <div className="space-y-2.5">
                  {/* First Card: Admin's own profile tagged "You · Admin" with Edit link */}
                  {myProfile && (
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
                          {myProfile.quote && (
                            <p className="font-serif italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                              "{myProfile.quote}"
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
                  )}

                  {/* Approved Classmate Profile Cards (20 at a time) */}
                  {adminAllStudents
                    .filter((s) => s.id !== myProfile?.id)
                    .slice(0, visiblePeopleCount)
                    .map((student) => {
                      const roleLabel = (student.position?.trim() || 'Member').toUpperCase();
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
                              {student.quote && (
                                <p className="font-serif italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                  "{student.quote}"
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
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete profile"
                            >
                              <Trash2 className="w-4 h-4" />
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
                    {adminLeaders.slice(0, visiblePeopleCount).map((leader, index) => {
                      const isFirst = index === 0;
                      const isLast = index === adminLeaders.length - 1;
                      const isAdminRow = myProfile && leader.id === myProfile.id;
                      return (
                        <div
                          key={leader.id}
                          id={`admin-leader-row-${leader.id}`}
                          onClick={() => {
                            setInspectedProfileRow(leader);
                            setBottomSheetActionMode('none');
                          }}
                          className="p-4 rounded-2xl bg-[#0e1117] border border-white/[0.08] hover:border-white/20 transition-all flex items-start justify-between gap-3.5 cursor-pointer shadow-sm"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <img
                              src={leader.photoUrl}
                              alt={leader.fullName}
                              className="w-16 h-20 rounded-xl object-cover border border-[#d4af37]/30 shrink-0 bg-black"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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
                              {leader.quote && (
                                <p className="font-serif italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                  "{leader.quote}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <button
                                id={`move-up-${leader.id}`}
                                type="button"
                                disabled={isFirst}
                                onClick={() => handleMoveLeader(leader.id, 'up')}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-20 text-zinc-300 hover:text-white cursor-pointer"
                                title="Move up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                id={`move-down-${leader.id}`}
                                type="button"
                                disabled={isLast}
                                onClick={() => handleMoveLeader(leader.id, 'down')}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-20 text-zinc-300 hover:text-white cursor-pointer"
                                title="Move down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingStudent(leader)}
                              className="text-xs font-mono-tech text-[#d4af37] hover:underline font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            {!isAdminRow && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(leader.id)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete profile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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
                VIEW 3: PENDING VIEW (RESIZED PROFILE CARDS + CHECKBOX + SLOT TAGS)
               ===================================================================== */}
            {studentDirectoryTab === 'pending' && (
              <div className="space-y-2">
                {/* Compact Pending Header: "N awaiting approval" and "Select all" */}
                {pendingStudents.length > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-400/[0.06] border border-amber-400/25 flex items-center justify-between gap-2">
                    <span className="font-mono-tech text-xs text-white font-semibold">
                      {pendingStudents.length} awaiting approval
                    </span>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 font-mono-tech text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={
                            pendingStudents.length > 0 &&
                            selectedPendingIds.length === pendingStudents.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPendingIds(pendingStudents.map((s) => s.id));
                            } else {
                              setSelectedPendingIds([]);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-zinc-600 text-[#d4af37] focus:ring-[#d4af37] cursor-pointer"
                        />
                        <span>Select all</span>
                      </label>

                      {selectedPendingIds.length > 0 && (
                        <button
                          id="approve-selected-pending-btn"
                          type="button"
                          disabled={isProcessingSubmissionAction}
                          onClick={handleApproveSelectedPending}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-syne font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                        >
                          Approve ({selectedPendingIds.length})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {pendingStudents.length === 0 ? (
                  currentSet.students.length < 5 ? null : (
                    <div className="p-6 text-center rounded-2xl bg-[#0e1117] border border-white/10 space-y-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                      <p className="text-sm font-syne font-bold text-white">No Pending Submissions</p>
                      <p className="text-xs text-zinc-400">
                        Share the invitation link to receive classmate profile submissions.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-2.5">
                    {pendingStudents.slice(0, visiblePeopleCount).map((student) => {
                      const isPaid = isStudentSlotFree(student);
                      const claimsCovered = Boolean(student.claimsToBeCovered);
                      const isChecked = selectedPendingIds.includes(student.id);
                      const canApprove = isPaid || slotBalance > 0;

                      return (
                        <div
                          key={student.id}
                          id={`pending-student-row-${student.id}`}
                          onClick={() => {
                            setInspectedProfileRow(student);
                            setBottomSheetActionMode('none');
                          }}
                          className="p-4 rounded-2xl bg-[#0e1117] border border-white/[0.08] hover:border-white/20 transition-all flex items-start justify-between gap-3 cursor-pointer shadow-sm"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div onClick={(e) => e.stopPropagation()} className="flex items-center pt-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPendingIds((prev) => [...prev, student.id]);
                                  } else {
                                    setSelectedPendingIds((prev) =>
                                      prev.filter((id) => id !== student.id)
                                    );
                                  }
                                }}
                                className="w-4 h-4 rounded border-zinc-600 text-[#d4af37] focus:ring-[#d4af37] cursor-pointer"
                              />
                            </div>

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
                                <span
                                  className={`px-2 py-0.5 rounded-md font-mono-tech text-[10px] font-semibold ${
                                    isPaid
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {isPaid ? 'Paid · uses no slot' : 'Not paid · uses 1 slot'}
                                </span>
                                {claimsCovered && (
                                  <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono-tech text-[10px] font-semibold">
                                    Claims to be covered
                                  </span>
                                )}
                              </div>
                              <p className="font-syne font-bold text-sm sm:text-base text-white truncate mt-0.5">
                                {student.fullName}
                              </p>
                              {student.nickname && (
                                <p className="font-mono-tech text-xs text-zinc-400 truncate mt-0.5">
                                  "{student.nickname}"
                                </p>
                              )}
                              {student.quote && (
                                <p className="font-serif italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                  "{student.quote}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canApprove ? (
                              <button
                                id={`approve-btn-${student.id}`}
                                type="button"
                                disabled={isProcessingSubmissionAction}
                                onClick={() => handleApproveStudent(student.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer"
                              >
                                Approve
                              </button>
                            ) : (
                              <button
                                id={`buy-slots-to-approve-btn-${student.id}`}
                                type="button"
                                onClick={() => setIsBuySlotsModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e5c14d] text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap"
                              >
                                Buy slots to approve
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
                VIEW 4: CHANGES REQUESTED VIEW (RESIZED PROFILE CARDS)
               ===================================================================== */}
            {studentDirectoryTab === 'changes_requested' && (
              <div className="space-y-2.5">
                {changesRequestedStudents.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[#0e1117] border border-white/10 space-y-1.5">
                    <p className="text-sm font-syne text-white">No profiles awaiting changes</p>
                    <p className="text-xs text-zinc-400">
                      When you request changes on a submission, it appears under this filter chip.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {changesRequestedStudents.slice(0, visiblePeopleCount).map((student) => (
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
                              <span className="text-[10px] font-mono-tech text-sky-400">
                                • Changes Requested
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
                            {student.quote && (
                              <p className="font-serif italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                "{student.quote}"
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
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {changesRequestedStudents.length > visiblePeopleCount && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setVisiblePeopleCount((prev) => prev + 20)}
                      className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
                    >
                      Show more ({changesRequestedStudents.length - visiblePeopleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* =====================================================================
                VIEW 5: DECLINED VIEW (RESIZED PROFILE CARDS)
               ===================================================================== */}
            {studentDirectoryTab === 'declined' && (
              <div className="space-y-2.5">
                {declinedStudents.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[#0e1117] border border-white/10 space-y-1.5">
                    <p className="text-sm font-syne text-white">No declined profiles</p>
                    <p className="text-xs text-zinc-400">
                      Declined submissions appear here and can be reinstated within 7 days.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {declinedStudents.slice(0, visiblePeopleCount).map((student) => (
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
                              <span className="text-[10px] font-mono-tech text-red-400">
                                • Declined
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
                            {student.quote && (
                              <p className="font-serif italic text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                "{student.quote}"
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
                            onClick={() => handleReinstateSubmission(student)}
                            className="text-xs font-mono-tech text-emerald-400 hover:underline font-semibold cursor-pointer"
                          >
                            Reinstate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
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
                className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-fadeIn"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#121318] border border-white/15 shadow-2xl p-5 sm:p-6 pb-20 sm:pb-6 text-white space-y-5"
                >
                  {/* Sheet Handle & Close */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                        Public Album Card Preview
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono-tech uppercase text-[#d4af37]">
                        {getStudentEffectiveStatus(inspectedProfileRow).replace('_', ' ')}
                      </span>
                    </div>
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

                  {/* Exact Public Album Profile Representation */}
                  <div className="rounded-2xl bg-[#08090e] border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                    <img
                      src={inspectedProfileRow.photoUrl}
                      alt={inspectedProfileRow.fullName}
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-white/15 shrink-0 bg-black"
                    />
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
                      <p
                        className={`font-mono-tech text-xs uppercase font-bold ${
                          isLeaderProfile(inspectedProfileRow) ? 'text-[#d4af37]' : 'text-zinc-400'
                        }`}
                      >
                        {inspectedProfileRow.position || 'Member'}
                      </p>
                      {inspectedProfileRow.quote && (
                        <p className="font-body text-xs text-zinc-300 italic leading-relaxed pt-1">
                          "{inspectedProfileRow.quote}"
                        </p>
                      )}
                      {inspectedProfileRow.declineReason && (
                        <p className="font-mono-tech text-[11px] text-red-400 pt-1">
                          Decline reason: {inspectedProfileRow.declineReason}
                        </p>
                      )}
                      {inspectedProfileRow.changesRequestedNote && (
                        <p className="font-mono-tech text-[11px] text-sky-400 pt-1">
                          Requested changes: {inspectedProfileRow.changesRequestedNote}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Inline Reason / Note Prompt for Decline or Request Changes */}
                  {bottomSheetActionMode !== 'none' && (
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 space-y-3">
                      <label className="block font-mono-tech text-xs text-white font-semibold">
                        {bottomSheetActionMode === 'decline'
                          ? 'Reason for declining this profile (required):'
                          : 'Note explaining requested changes (required):'}
                      </label>
                      <textarea
                        rows={2}
                        value={bottomSheetReasonInput}
                        onChange={(e) => setBottomSheetReasonInput(e.target.value)}
                        placeholder={
                          bottomSheetActionMode === 'decline'
                            ? 'e.g. Portrait is blurry or duplicate entry'
                            : 'e.g. Please upload a clearer portrait and use your full legal name'
                        }
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
                          disabled={isProcessingSubmissionAction}
                          onClick={() => {
                            if (bottomSheetActionMode === 'decline') {
                              handleDeclineSubmissionWithReason(
                                inspectedProfileRow,
                                bottomSheetReasonInput
                              );
                            } else {
                              handleRequestChangesOnSubmission(
                                inspectedProfileRow,
                                bottomSheetReasonInput
                              );
                            }
                          }}
                          className="px-4 py-1.5 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer"
                        >
                          {bottomSheetActionMode === 'decline'
                            ? 'Confirm Decline'
                            : 'Send Change Request'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bottom Sheet Action Buttons: Edit, Request changes, Decline (with reason), Reinstate (within window), Remove */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const target = inspectedProfileRow;
                          setInspectedProfileRow(null);
                          setEditingStudent(target);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBottomSheetActionMode('request_changes');
                          setBottomSheetReasonInput(inspectedProfileRow.changesRequestedNote || '');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-mono-tech text-xs cursor-pointer"
                      >
                        Request changes
                      </button>

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

                      {getStudentEffectiveStatus(inspectedProfileRow) === 'declined' && (
                        <button
                          type="button"
                          onClick={() => handleReinstateSubmission(inspectedProfileRow)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono-tech text-xs cursor-pointer"
                        >
                          Reinstate
                        </button>
                      )}
                    </div>

                    {(!myProfile || inspectedProfileRow.id !== myProfile.id) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubmissionNoSlotReturn(inspectedProfileRow)}
                        className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-mono-tech text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
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
            >
              {editingSponsorItem && (
                <form onSubmit={handleSaveSponsorEdit} className="space-y-4 p-1 text-xs font-body">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono-tech text-[11px] text-zinc-400 space-y-1">
                    <div>
                      Reference:{' '}
                      <span className="text-white">
                        {editingSponsorItem.payment_reference || editingSponsorItem.paymentReference}
                      </span>{' '}
                      (Locked)
                    </div>
                    <div>
                      Quantity:{' '}
                      <span className="text-[#d4af37] font-bold">
                        {editingSponsorItem.slots_purchased ?? editingSponsorItem.slotsPurchased} slots
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

            {/* SLOTS DETAILS BOTTOM SHEET (Opened by "Details ›" in the sticky Slots Bar) */}
            {isSlotDetailsSheetOpen && (
              <div
                id="slot-details-bottom-sheet-backdrop"
                role="dialog"
                aria-modal="true"
                onClick={() => setIsSlotDetailsSheetOpen(false)}
                className="fixed inset-0 z-[9992] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
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
                          const qty = sp.slots_purchased ?? sp.slotsPurchased ?? 0;
                          const visible =
                            sp.show_sponsor_on_album !== undefined
                              ? Boolean(sp.show_sponsor_on_album)
                              : sp.showSponsorOnAlbum !== false;
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
                className="fixed inset-0 z-[9992] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
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
          title="Album Design & Social Handles"
          subtitle="Customize your album hero banner, final footer portrait, and official department social handles"
          maxWidth="4xl"
        >
          <div className="space-y-6 p-1">
            {imagerySaveToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono-tech text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{imagerySaveToast}</span>
              </div>
            )}

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
                <span>Save Designs</span>
              </button>
            </div>
          </div>
        </UniversalModal>

        {/* =========================================================================
            TAB 2: MOMENTS & HIGHLIGHTS MANAGEMENT (SPLIT INTO 2 SUB-TABS)
            ========================================================================= */}
        {activeTab === 'memories' && (
          <div id="moments-edit-section" className="space-y-6">
            {/* The 2 Sub-Section Buttons: Moments vs Highlights */}
            <div className={`flex items-center gap-3 border-b pb-4 ${
              isLightMode ? 'border-zinc-200' : 'border-white/10'
            }`}>
              <button
                type="button"
                id="admin-subtab-moments-btn"
                onClick={() => setMemoriesAdminSubTab('moments')}
                className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  memoriesAdminSubTab === 'moments'
                    ? isLightMode
                      ? 'bg-zinc-950 text-white font-bold shadow-md ring-1 ring-black'
                      : 'bg-white text-black font-bold shadow-md'
                    : isLightMode
                      ? 'bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 border border-zinc-200 shadow-xs'
                      : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Moments ({currentSet.memories.length})</span>
              </button>

              <button
                type="button"
                id="admin-subtab-highlights-btn"
                onClick={() => setMemoriesAdminSubTab('highlights')}
                className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  memoriesAdminSubTab === 'highlights'
                    ? isLightMode
                      ? 'bg-zinc-950 text-white font-bold shadow-md ring-1 ring-black'
                      : 'bg-white text-black font-bold shadow-md'
                    : isLightMode
                      ? 'bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 border border-zinc-200 shadow-xs'
                      : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Highlights ({videos.length})</span>
              </button>
            </div>

            {/* SUB-TAB A: VIDEO HIGHLIGHTS (URL-ONLY, POSITIONED LIKE OTHER SECTIONS) */}
            {memoriesAdminSubTab === 'highlights' && (
              <div id="video-highlights-manager-section" className="space-y-4 animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl sm:text-2xl text-white leading-tight">
                      Video Highlights ({videos.length})
                    </h3>
                    <p className="font-body text-xs text-zinc-400 mt-1 leading-snug">
                      Share video URLs from convocation speeches, dinner night, and class events.
                    </p>
                  </div>

                  <button
                    id="add-video-highlight-btn"
                    type="button"
                    onClick={handleOpenAddVideo}
                    className="px-4 py-2.5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-[11px] tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="leading-tight text-center">ADD<br className="sm:hidden" /> VIDEO</span>
                  </button>
                </div>

                {/* Video Add / Edit Modal (URL Only — No Direct Video File Upload) */}
                <UniversalModal
                  isOpen={isAddingVideo}
                  onClose={() => {
                    setIsAddingVideo(false);
                    setEditingVideo(null);
                  }}
                  title={editingVideo ? 'Edit Video Highlight' : 'Add Video Highlight'}
                  subtitle="Paste a video URL (YouTube link) to embed in your class album."
                  maxWidth="lg"
                >
                  <form
                    onSubmit={handleSaveVideoItem}
                    className="space-y-4 text-xs font-body p-1"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Video Title */}
                      <div className="space-y-1.5">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                          Video Title *
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
                          Video URL *
                        </label>
                        <input
                          required
                          type="url"
                          value={videoYoutubeUrl}
                          onChange={(e) => setVideoYoutubeUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                        />
                      </div>

                      {/* Custom Thumbnail URL */}
                      <div className="space-y-1.5">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                          Custom Thumbnail URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={videoThumbnailUrl}
                          onChange={(e) => setVideoThumbnailUrl(e.target.value)}
                          placeholder="Leave blank to auto-use video thumbnail"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                        />
                      </div>

                      {/* Event Tag / Date */}
                      <div className="space-y-1.5">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                          Occasion / Event Tag
                        </label>
                        <input
                          type="text"
                          value={videoDateStr}
                          onChange={(e) => setVideoDateStr(e.target.value)}
                          placeholder="e.g. Convocation Day • Oct 2026"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                        />
                      </div>

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

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingVideo(false);
                          setEditingVideo(null);
                        }}
                        className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-mono-tech uppercase transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-mono-tech font-bold uppercase tracking-wider transition-colors cursor-pointer shadow"
                      >
                        {editingVideo ? 'Update Video' : 'Save Video'}
                      </button>
                    </div>
                  </form>
                </UniversalModal>

                {/* Videos List */}
                {videos.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-[#0e1117] border border-white/10 text-center space-y-3">
                    <Film className="w-8 h-8 text-zinc-600 mx-auto" />
                    <div className="space-y-1">
                      <p className="font-syne font-bold text-sm text-white">No Video Highlights Added Yet</p>
                      <p className="font-body text-xs text-zinc-400 max-w-md mx-auto">
                        Click "+ ADD VIDEO" to paste a video link from convocation, dinner night, or class events.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos.map((vid) => {
                      const thumb = vid.thumbnailUrl || getYouTubeThumbnailUrl(vid.youtubeUrl);
                      return (
                        <div
                          key={vid.id}
                          onClick={() => handleOpenEditVideo(vid)}
                          className="rounded-2xl bg-[#0e1117] border border-white/[0.08] overflow-hidden group hover:border-white/25 transition-all flex flex-col justify-between cursor-pointer shadow-sm"
                        >
                          <div>
                            {/* Thumbnail with Play Button */}
                            <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                              <img
                                src={thumb}
                                alt={vid.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewVideo(vid);
                                    setIsPreviewVideoModalOpen(true);
                                  }}
                                  className="w-11 h-11 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
                                  title="Play video preview"
                                >
                                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                                </button>
                              </div>

                              {vid.dateStr && (
                                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-mono-tech text-zinc-300">
                                  {vid.dateStr}
                                </span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="p-3.5 space-y-1">
                              <h5 className="font-syne font-bold text-xs text-white line-clamp-1">
                                {vid.title}
                              </h5>
                              {vid.description && (
                                <p className="font-body text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                  {vid.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Video Actions */}
                          <div
                            className="p-3 border-t border-white/5 flex items-center justify-between gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewVideo(vid);
                                setIsPreviewVideoModalOpen(true);
                              }}
                              className="text-[11px] font-mono-tech text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3 text-red-500" />
                              <span>Preview</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditVideo(vid)}
                                className="text-xs font-mono-tech text-[#d4af37] hover:underline font-semibold cursor-pointer px-1.5 py-1"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVideo(vid.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                                title="Remove video"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB B: MOMENTS CATEGORIES (MATCHING SCREENSHOT 5 + POP-UP EDITOR + CANVA DRAG & DROP) */}
            {memoriesAdminSubTab === 'moments' && (
              <div id="moments-batches-manager-section" className="space-y-4 animate-fadeIn">
                {/* Class Moments Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl sm:text-2xl text-white leading-tight">
                      Class Moments ({currentSet.memories.length})
                    </h3>
                    <p className="font-body text-xs text-zinc-400 mt-1 leading-snug">
                      Photo collections from Sign-out Day, Dinner Party, Convocation, and class milestones.
                    </p>
                  </div>

                  <button
                    id="create-batch-btn"
                    type="button"
                    onClick={() => setIsAddingBatch(true)}
                    className="px-4 py-2.5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-[11px] tracking-wider uppercase font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="leading-tight text-center">ADD<br className="sm:hidden" /> MOMENT</span>
                  </button>
                </div>

                {/* CREATE NEW CATEGORY POP-UP MODAL */}
                <UniversalModal
                  isOpen={isAddingBatch}
                  onClose={() => setIsAddingBatch(false)}
                  title="Create New Category"
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

                    {/* Event Date (Calendar Picker like Publish Album Date Choosing) */}
                    <div className="space-y-2">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                        Event Date
                      </label>
                      <input
                        type="date"
                        value={
                          typeof batchDay === 'number' && batchMonth && batchYear
                            ? `${String(batchYear).padStart(4, '0')}-${String(batchMonth).padStart(2, '0')}-${String(batchDay).padStart(2, '0')}`
                            : ''
                        }
                        onClick={(e) => {
                          try {
                            (e.currentTarget as any).showPicker?.();
                          } catch {}
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setBatchDate('');
                            setBatchDay('');
                            return;
                          }
                          const [yStr, mStr, dStr] = val.split('-');
                          const y = parseInt(yStr, 10);
                          const m = parseInt(mStr, 10);
                          const d = parseInt(dStr, 10);
                          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                            setBatchYear(y);
                            setBatchMonth(m);
                            setBatchDay(d);
                            setIsBatchDayUnknown(false);
                            setBatchDate(formatDateComponents(d, m, y));
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
                      />
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

                    {/* Upload Photos + Hold & Drag-and-Drop Rearrange */}
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold block">
                            Photos ({batchImages.length})
                          </span>
                          {batchImages.length > 1 && (
                            <span className="font-mono-tech text-[10px] text-zinc-500">
                              Hold &amp; drag any photo to rearrange order
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => batchFileInputRef.current?.click()}
                          disabled={isCompressingBatch}
                          className="py-2 px-4 rounded-full bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow"
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
                            const isDragTarget = dragOverDraftPhotoIndex === index && draggedDraftPhotoIndex !== index;
                            return (
                              <div
                                key={img.id || index}
                                data-draft-moment-photo-idx={index}
                                draggable
                                onDragStart={() => {
                                  setDraggedDraftPhotoIndex(index);
                                  setDragOverDraftPhotoIndex(index);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (dragOverDraftPhotoIndex !== index) {
                                    setDragOverDraftPhotoIndex(index);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedDraftPhotoIndex !== null && draggedDraftPhotoIndex !== index) {
                                    handleReorderDraftPhotos(draggedDraftPhotoIndex, index);
                                  }
                                  setDraggedDraftPhotoIndex(null);
                                  setDragOverDraftPhotoIndex(null);
                                }}
                                onDragEnd={() => {
                                  setDraggedDraftPhotoIndex(null);
                                  setDragOverDraftPhotoIndex(null);
                                }}
                                onTouchStart={() => {
                                  setDraggedDraftPhotoIndex(index);
                                  setDragOverDraftPhotoIndex(index);
                                }}
                                onTouchMove={(e) => {
                                  if (draggedDraftPhotoIndex === null) return;
                                  const touch = e.touches[0];
                                  if (!touch) return;
                                  const targetEl = document
                                    .elementFromPoint(touch.clientX, touch.clientY)
                                    ?.closest('[data-draft-moment-photo-idx]');
                                  if (targetEl) {
                                    const targetIdx = parseInt(
                                      targetEl.getAttribute('data-draft-moment-photo-idx') || '-1',
                                      10
                                    );
                                    if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx !== draggedDraftPhotoIndex) {
                                      handleReorderDraftPhotos(draggedDraftPhotoIndex, targetIdx);
                                      setDraggedDraftPhotoIndex(targetIdx);
                                      setDragOverDraftPhotoIndex(targetIdx);
                                    }
                                  }
                                }}
                                onTouchEnd={() => {
                                  setDraggedDraftPhotoIndex(null);
                                  setDragOverDraftPhotoIndex(null);
                                }}
                                className={`p-2 rounded-xl bg-black/60 border transition-all flex items-center gap-2 cursor-grab active:cursor-grabbing select-none ${
                                  isBeingDragged
                                    ? 'opacity-60 scale-95 border-[#2563eb] ring-2 ring-[#2563eb]/40'
                                    : isDragTarget
                                    ? 'border-amber-400 bg-amber-400/10'
                                    : 'border-white/10 hover:border-white/25'
                                }`}
                              >
                                <div className="relative shrink-0">
                                  <img
                                    src={img.url}
                                    alt={`Photo ${index + 1}`}
                                    className="w-12 h-12 rounded-lg object-cover border border-white/15 pointer-events-none"
                                  />
                                  <span className="absolute -top-1 -left-1 px-1.5 py-0.2 rounded bg-black/85 border border-white/20 text-[9px] font-mono-tech text-white font-bold">
                                    {index + 1}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 flex flex-col gap-1 text-[11px] font-mono-tech">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerCropForImage(
                                        img.url,
                                        'free',
                                        `Crop Photo #${index + 1}`,
                                        (croppedUrl) => {
                                          const updated = [...batchImages];
                                          updated[index].url = croppedUrl;
                                          setBatchImages(updated);
                                        }
                                      );
                                    }}
                                    className="text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 text-left"
                                  >
                                    <Crop className="w-2.5 h-2.5 shrink-0" />
                                    <span>Crop</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBatchImages(batchImages.filter((_, i) => i !== index));
                                    }}
                                    className="text-red-400 hover:text-red-300 cursor-pointer text-left"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <GripVertical className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
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
                        className="py-2.5 px-5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!batchCategory.trim() || batchImages.length === 0}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white font-mono-tech text-xs tracking-wider uppercase font-bold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow"
                      >
                        Save Category ({batchImages.length})
                      </button>
                    </div>
                  </form>
                </UniversalModal>

                {/* POP-UP WINDOW: EDIT MOMENT CATEGORY MODAL (FULL SUB-CAPTION, RENAME, CALENDAR DATE, CANVA DRAG & DROP PHOTOS) */}
                <UniversalModal
                  isOpen={!!editingMomentBatchModal}
                  onClose={() => setEditingMomentBatchModal(null)}
                  title="Edit Moment Category"
                  subtitle="Tap or hold and drag photos to rearrange sequence like Canva pages."
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
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-syne font-bold text-xs focus:border-[#2563eb] focus:outline-none"
                          />
                        </div>

                        {/* Short Badge Tag (Top-Right Blue Badge on Card) */}
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
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-[#58a6ff] font-mono-tech text-xs focus:border-[#2563eb] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Event Date Picker (Calendar input just like public date choosing) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                            Event Date
                          </label>
                          {editingMomentBatchModal.dateStr && (
                            <span className="font-mono-tech text-[11px] text-amber-300">
                              Current: {editingMomentBatchModal.dateStr}
                            </span>
                          )}
                        </div>
                        <input
                          type="date"
                          value={
                            editingMomentBatchModal.eventDay &&
                            editingMomentBatchModal.eventMonth &&
                            editingMomentBatchModal.eventYear
                              ? `${String(editingMomentBatchModal.eventYear).padStart(4, '0')}-${String(
                                  editingMomentBatchModal.eventMonth
                                ).padStart(2, '0')}-${String(editingMomentBatchModal.eventDay).padStart(2, '0')}`
                              : ''
                          }
                          onClick={(e) => {
                            try {
                              (e.currentTarget as any).showPicker?.();
                            } catch {}
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setEditingMomentBatchModal({
                                ...editingMomentBatchModal,
                                dateStr: '',
                                eventDay: undefined,
                              });
                              return;
                            }
                            const [yStr, mStr, dStr] = val.split('-');
                            const y = parseInt(yStr, 10);
                            const m = parseInt(mStr, 10);
                            const d = parseInt(dStr, 10);
                            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                              setEditingMomentBatchModal({
                                ...editingMomentBatchModal,
                                eventYear: y,
                                eventMonth: m,
                                eventDay: d,
                                isDayUnknown: false,
                                dateStr: formatDateComponents(d, m, y),
                              });
                            }
                          }}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-[#2563eb] transition-colors cursor-pointer"
                        />
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
                          className="w-full px-4 py-3 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-[#2563eb] focus:outline-none resize-none font-body text-xs sm:text-sm leading-relaxed"
                        />
                      </div>

                      {/* Canva-Style Hold & Drag-and-Drop Photo Grid */}
                      <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-syne font-bold text-xs sm:text-sm text-white block">
                              Event Photos ({editingMomentBatchModal.images.length})
                            </span>
                            <span className="font-mono-tech text-[10px] text-zinc-400">
                              Hold and drag any photo card to rearrange its position
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => editMomentAddPhotosInputRef.current?.click()}
                            disabled={isCompressingBatch}
                            className="px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5 cursor-pointer shadow"
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
                          <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-zinc-500 font-mono-tech text-xs">
                            No photos in this moment. Click "Add Photos" to upload.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1 pt-1">
                            {editingMomentBatchModal.images.map((img, imgIdx) => {
                              const isBeingDragged = draggedMomentPhotoIndex === imgIdx;
                              const isDragTarget =
                                dragOverMomentPhotoIndex === imgIdx && draggedMomentPhotoIndex !== imgIdx;

                              return (
                                <div
                                  key={img.id || imgIdx}
                                  data-edit-moment-photo-idx={imgIdx}
                                  draggable
                                  onDragStart={() => {
                                    setDraggedMomentPhotoIndex(imgIdx);
                                    setDragOverMomentPhotoIndex(imgIdx);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (dragOverMomentPhotoIndex !== imgIdx) {
                                      setDragOverMomentPhotoIndex(imgIdx);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (
                                      draggedMomentPhotoIndex !== null &&
                                      draggedMomentPhotoIndex !== imgIdx
                                    ) {
                                      handleReorderEditMomentPhotos(draggedMomentPhotoIndex, imgIdx);
                                    }
                                    setDraggedMomentPhotoIndex(null);
                                    setDragOverMomentPhotoIndex(null);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedMomentPhotoIndex(null);
                                    setDragOverMomentPhotoIndex(null);
                                  }}
                                  onTouchStart={() => {
                                    setDraggedMomentPhotoIndex(imgIdx);
                                    setDragOverMomentPhotoIndex(imgIdx);
                                  }}
                                  onTouchMove={(e) => {
                                    if (draggedMomentPhotoIndex === null) return;
                                    const touch = e.touches[0];
                                    if (!touch) return;
                                    const targetEl = document
                                      .elementFromPoint(touch.clientX, touch.clientY)
                                      ?.closest('[data-edit-moment-photo-idx]');
                                    if (targetEl) {
                                      const targetIdx = parseInt(
                                        targetEl.getAttribute('data-edit-moment-photo-idx') || '-1',
                                        10
                                      );
                                      if (
                                        !isNaN(targetIdx) &&
                                        targetIdx >= 0 &&
                                        targetIdx !== draggedMomentPhotoIndex
                                      ) {
                                        handleReorderEditMomentPhotos(draggedMomentPhotoIndex, targetIdx);
                                        setDraggedMomentPhotoIndex(targetIdx);
                                        setDragOverMomentPhotoIndex(targetIdx);
                                      }
                                    }
                                  }}
                                  onTouchEnd={() => {
                                    setDraggedMomentPhotoIndex(null);
                                    setDragOverMomentPhotoIndex(null);
                                  }}
                                  className={`rounded-xl bg-[#0e1117] border p-2 flex flex-col justify-between gap-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                                    isBeingDragged
                                      ? 'opacity-60 scale-95 border-[#2563eb] ring-2 ring-[#2563eb]/40 shadow-xl'
                                      : isDragTarget
                                      ? 'border-amber-400 bg-amber-400/10'
                                      : 'border-white/10 hover:border-white/25'
                                  }`}
                                >
                                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-black border border-white/10">
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
                                      onClick={() => {
                                        triggerCropForImage(
                                          img.url,
                                          'free',
                                          `Crop Photo #${imgIdx + 1}`,
                                          (croppedUrl) => {
                                            setEditingMomentBatchModal((prev) => {
                                              if (!prev) return null;
                                              const nextImgs = [...prev.images];
                                              if (nextImgs[imgIdx]) {
                                                nextImgs[imgIdx] = { ...nextImgs[imgIdx], url: croppedUrl };
                                              }
                                              return { ...prev, images: nextImgs };
                                            });
                                          }
                                        );
                                      }}
                                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-amber-300 text-[10px] font-mono-tech flex items-center gap-1 cursor-pointer"
                                    >
                                      <Crop className="w-2.5 h-2.5" />
                                      <span>Crop</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleTriggerReplaceImage(editingMomentBatchModal.id, imgIdx)
                                      }
                                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-sky-300 text-[10px] font-mono-tech flex items-center gap-1 cursor-pointer"
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
                                      className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 cursor-pointer"
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
                          className="px-3.5 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Category</span>
                        </button>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setEditingMomentBatchModal(null)}
                            className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs uppercase cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2.5 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-xs uppercase tracking-wider font-bold shadow-lg cursor-pointer"
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

                {/* COMPACT BATCHED EVENT CAROUSEL CARDS (MATCHES SCREENSHOT 5 — CLICK TO OPEN POPUP) */}
                {currentSet.memories.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[#0e1117] border border-white/10 space-y-3">
                    <Camera className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-sm font-syne text-white">No Moments Categories Created Yet</p>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      Click "+ ADD EVENT PHOTO" to upload a series of photos under a milestone event like Sign-out Day or Dinner Party.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {currentSet.memories.map((batch, index) => {
                      const isBeingDragged = draggedBatchIndex === index;
                      const isDragTarget = dragOverBatchIndex === index && draggedBatchIndex !== index;

                      return (
                        <div
                          key={batch.id}
                          id={`category-row-${batch.id}`}
                          data-moment-batch-idx={index}
                          draggable
                          onDragStart={() => {
                            setDraggedBatchIndex(index);
                            setDragOverBatchIndex(index);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragOverBatchIndex !== index) {
                              setDragOverBatchIndex(index);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedBatchIndex !== null && draggedBatchIndex !== index) {
                              handleReorderMomentBatches(draggedBatchIndex, index);
                            }
                            setDraggedBatchIndex(null);
                            setDragOverBatchIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggedBatchIndex(null);
                            setDragOverBatchIndex(null);
                          }}
                          onClick={() => handleOpenEditMomentBatchModal(batch)}
                          className={`p-4 rounded-2xl bg-[#0e1117] border transition-all space-y-3 cursor-pointer shadow-md ${
                            isBeingDragged
                              ? 'opacity-60 scale-[0.99] border-[#2563eb] ring-2 ring-[#2563eb]/30'
                              : isDragTarget
                              ? 'border-amber-400 bg-amber-400/5'
                              : 'border-white/[0.08] hover:border-white/20'
                          }`}
                        >
                          {/* Top Row: Event Title on Left, Blue Event Tag Pill on Right (Matches Screenshot 5) */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-syne font-bold text-sm sm:text-base text-white leading-snug truncate">
                                {batch.title}
                              </h4>
                              {(batch.dateStr || batch.caption) && (
                                <p className="font-body text-[11px] text-zinc-400 truncate mt-0.5">
                                  {batch.dateStr ? `${batch.dateStr}` : ''}
                                  {batch.dateStr && batch.caption ? ' • ' : ''}
                                  {batch.caption ? batch.caption : ''}
                                </p>
                              )}
                            </div>

                            <span className="px-2.5 py-1 rounded-lg bg-[#112236] border border-[#1f3a5c] text-[#58a6ff] text-[11px] font-mono-tech shrink-0">
                              {batch.eventTag || batch.title}
                            </span>
                          </div>

                          {/* Bottom Row: Horizontal Strip of Compact Thumbnails (Matches Screenshot 5) */}
                          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pt-0.5">
                            {batch.images.map((img, imgIdx) => (
                              <img
                                key={img.id || imgIdx}
                                src={img.url}
                                alt={img.caption || `${batch.title} ${imgIdx + 1}`}
                                className="w-36 h-24 sm:w-44 sm:h-28 rounded-xl object-cover shrink-0 border border-white/10 bg-black"
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: AWARDS MANAGEMENT (MATCHING SCREENSHOT 4 + CLICK TO EDIT POPUP)
            ========================================================================= */}
        {activeTab === 'awards' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-serif text-xl sm:text-2xl text-white leading-tight">
                  Class Awards ({currentSet.awards.length})
                </h3>
                <p className="font-body text-xs text-zinc-400 mt-1 leading-snug">
                  Celebrate standout classmates with superlative awards and citations.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingAwardId(null);
                  setAwardCategory('');
                  setAwardWinnerName('');
                  setAwardWinnerNickname('');
                  setAwardAvatar('');
                  setAwardCitation('');
                  setIsAddingAward(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-[11px] tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-tight text-center">ADD<br className="sm:hidden" /> AWARD</span>
              </button>
            </div>

            {/* Hidden file input for Award Winner photo */}
            <input
              ref={awardPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAwardPhotoSelect}
            />

            {isAddingAward && (
              <UniversalModal
                isOpen={isAddingAward}
                onClose={() => {
                  setIsAddingAward(false);
                  setEditingAwardId(null);
                  setAwardCategory('');
                  setAwardWinnerName('');
                  setAwardWinnerNickname('');
                  setAwardAvatar('');
                  setAwardCitation('');
                }}
                title={editingAwardId ? 'Edit Class Award' : 'Add Class Award'}
                subtitle="Celebrate a classmate with superlative honors, cropped portraits, and citations"
                maxWidth="lg"
              >
                <form onSubmit={handleSaveAward} className="space-y-4 text-xs font-body">
                  {/* Profile Selector from Approved Classmates with Pocket Modal */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Autofill from Approved Classmate (Optional)</span>
                      </label>
                      <span className="text-[10px] font-mono-tech text-zinc-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                        {approvedStudents.length} Profiles Available
                      </span>
                    </div>

                    {selectedAwardStudentId && approvedStudents.find((s) => s.id === selectedAwardStudentId) ? (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-amber-500/30 overflow-hidden shrink-0 flex items-center justify-center">
                            {awardAvatar ? (
                              <img src={awardAvatar} alt="Winner" className="w-full h-full object-cover" />
                            ) : (
                              <UserCheck className="w-5 h-5 text-amber-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-syne font-bold text-xs sm:text-sm text-white truncate">
                              {awardWinnerName} {awardWinnerNickname ? `("${awardWinnerNickname}")` : ''}
                            </p>
                            <p className="font-mono-tech text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Name &amp; photo automatically populated</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsAwardPickerOpen(true)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-[11px] uppercase transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAwardStudentId('');
                              setAwardWinnerName('');
                              setAwardWinnerNickname('');
                              setAwardAvatar('');
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Clear selection"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAwardPickerOpen(true)}
                        className="w-full py-3 px-4 rounded-xl bg-[#08090e] hover:bg-white/[0.06] border border-white/15 hover:border-amber-400/50 text-white font-mono-tech text-xs flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <UserCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                          <span>Choose from Approved Profiles ({approvedStudents.length})</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 text-[10px] uppercase font-bold">
                          Select →
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Recipient Photo / Avatar Upload & Crop */}
                  <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="w-14 h-14 rounded-2xl bg-black border border-white/20 overflow-hidden relative group shrink-0 flex items-center justify-center">
                      {awardAvatar ? (
                        <img
                          src={awardAvatar}
                          alt="Award Winner"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Trophy className="w-6 h-6 text-amber-400" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <span className="font-mono-tech text-xs text-white font-semibold block">
                        Recipient Portrait Photo
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => awardPhotoInputRef.current?.click()}
                          className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3 h-3 text-[#d4af37]" />
                          <span>{awardAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                        </button>
                        {awardAvatar && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerCropForImage(
                                awardAvatar,
                                '1:1',
                                'Crop Award Winner Portrait',
                                (croppedUrl) => {
                                  setAwardAvatar(croppedUrl);
                                }
                              );
                            }}
                            className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 font-mono-tech text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Crop className="w-3 h-3 text-amber-400" />
                            <span>Crop</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                        Award Category *
                      </label>
                      <input
                        required
                        type="text"
                        value={awardCategory}
                        onChange={(e) => setAwardCategory(e.target.value)}
                        placeholder="e.g. Most Likely to Build a Unicorn"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                        Recipient Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={awardWinnerName}
                        onChange={(e) => setAwardWinnerName(e.target.value)}
                        placeholder="e.g. Olumide Fashola"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                        Nickname (Optional)
                      </label>
                      <input
                        type="text"
                        value={awardWinnerNickname}
                        onChange={(e) => setAwardWinnerNickname(e.target.value)}
                        placeholder="e.g. Lumi_JS"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                      />
                    </div>

                    <div>
                      <AwardTypeSelector
                        value={awardTrophyType}
                        onChange={(val) => setAwardTrophyType(val)}
                        label="Trophy Finish Style"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                      Citation / Reason
                    </label>
                    <textarea
                      rows={2}
                      value={awardCitation}
                      onChange={(e) => setAwardCitation(e.target.value)}
                      placeholder="e.g. For creating three revenue-generating production apps while completing his degree."
                      className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsAddingAward(false)}
                      className="px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-xs tracking-wider uppercase font-bold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow"
                    >
                      Save Class Award
                    </button>
                  </div>
                </form>
              </UniversalModal>
            )}

            {/* COMPACT AWARD CARDS LIST (MATCHES SCREENSHOT 4 — CLICK CARD TO OPEN POPUP) */}
            <div className="space-y-3">
              {currentSet.awards.map((award) => (
                <div
                  key={award.id}
                  onClick={() => handleOpenEditAwardModal(award)}
                  className="p-4 rounded-2xl bg-[#0e1117] border border-white/[0.08] hover:border-white/20 transition-all flex items-start justify-between gap-3.5 cursor-pointer shadow-sm"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-[#2a2415] border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0">
                      <Trophy className="w-5 h-5 text-[#d4af37]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-syne font-bold text-sm sm:text-base text-white leading-snug">
                        {award.category}
                      </h4>
                      <p className="font-body text-xs text-zinc-300 mt-0.5">
                        Winner: {award.winnerName}
                        {award.winnerNickname ? ` ("${award.winnerNickname}")` : ''}
                      </p>
                      {award.citation && (
                        <p className="font-serif italic text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          "{award.citation}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: VOICES SWIPER (MATCHES SCREENSHOT 2 — NO MENTION OF LECTURERS)
            ========================================================================= */}
        {activeTab === 'voices' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-serif text-xl sm:text-2xl text-white leading-tight">
                  Parting Voices ({currentSet.voices.length})
                </h3>
                <p className="font-body text-xs text-zinc-400 mt-1 leading-snug">
                  Farewell messages, reflections, and parting words from class leaders.
                </p>
              </div>

              <button
                onClick={() => {
                  setVoiceLecturerName('');
                  setVoiceTitle('');
                  setVoicePartingQuote('');
                  setVoiceHeadshotUrl('');
                  setSelectedVoiceStudentId('');
                  setIsAddingVoice(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-[11px] tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-tight text-center">ADD<br className="sm:hidden" /> VOICE</span>
              </button>
            </div>

            {/* Hidden file input for Voice Headshot photo */}
            <input
              ref={voicePhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleVoicePhotoSelect}
            />

            {isAddingVoice && (
              <UniversalModal
                isOpen={isAddingVoice}
                onClose={() => {
                  setIsAddingVoice(false);
                  setVoiceLecturerName('');
                  setVoiceTitle('');
                  setVoicePartingQuote('');
                  setVoiceHeadshotUrl('');
                  setSelectedVoiceStudentId('');
                }}
                title="Add Voice & Parting Words"
                subtitle="Parting wisdom, farewell messages, and words of encouragement from class leaders"
                maxWidth="lg"
              >
                <form onSubmit={handleSaveVoice} className="space-y-4 text-xs font-body">
                  {/* Profile Selector from Approved Student Leaders with Pocket Modal */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span>Autofill from Approved Class Leader (Optional)</span>
                      </label>
                      <span className="text-[10px] font-mono-tech text-amber-400/80 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {approvedStudentLeaders.length} Leaders Available
                      </span>
                    </div>

                    {selectedVoiceStudentId && approvedStudentLeaders.find((s) => s.id === selectedVoiceStudentId) ? (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-amber-500/30 overflow-hidden shrink-0 flex items-center justify-center">
                            {voiceHeadshotUrl ? (
                              <img src={voiceHeadshotUrl} alt="Leader" className="w-full h-full object-cover" />
                            ) : (
                              <Crown className="w-5 h-5 text-amber-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-syne font-bold text-xs sm:text-sm text-white truncate">
                              {voiceLecturerName}
                            </p>
                            <p className="font-mono-tech text-[10px] text-amber-300 truncate mt-0.5">
                              {voiceTitle || 'Class Leader'} • Auto-populated from profile
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsVoicePickerOpen(true)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-[11px] uppercase transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVoiceStudentId('');
                              setVoiceLecturerName('');
                              setVoiceTitle('');
                              setVoiceHeadshotUrl('');
                              setVoicePartingQuote('');
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Clear selection"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsVoicePickerOpen(true)}
                        className="w-full py-3 px-4 rounded-xl bg-[#08090e] hover:bg-white/[0.06] border border-white/15 hover:border-amber-400/50 text-white font-mono-tech text-xs flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <Crown className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                          <span>Choose Class Leader ({approvedStudentLeaders.length})</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 text-[10px] uppercase font-bold">
                          Select →
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Speaker Photo / Headshot Upload & Crop */}
                  <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="w-14 h-14 rounded-full bg-black border border-white/20 overflow-hidden relative group shrink-0 flex items-center justify-center">
                      {voiceHeadshotUrl ? (
                        <img
                          src={voiceHeadshotUrl}
                          alt="Speaker Headshot"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Crown className="w-6 h-6 text-zinc-500" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <span className="font-mono-tech text-xs text-white font-semibold block">
                        Contributor Portrait / Headshot
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => voicePhotoInputRef.current?.click()}
                          className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3 h-3 text-[#d4af37]" />
                          <span>{voiceHeadshotUrl ? 'Change Photo' : 'Upload Photo'}</span>
                        </button>
                        {voiceHeadshotUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerCropForImage(
                                voiceHeadshotUrl,
                                '1:1',
                                'Crop Headshot',
                                (croppedUrl) => {
                                  setVoiceHeadshotUrl(croppedUrl);
                                }
                              );
                            }}
                            className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 font-mono-tech text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Crop className="w-3 h-3 text-amber-400" />
                            <span>Crop</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                        Contributor Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={voiceLecturerName}
                        onChange={(e) => setVoiceLecturerName(e.target.value)}
                        placeholder="e.g. Chiemeka Anthony Eze"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                        Role / Position *
                      </label>
                      <input
                        required
                        type="text"
                        value={voiceTitle}
                        onChange={(e) => setVoiceTitle(e.target.value)}
                        placeholder="e.g. Department President, Class Rep, Tech Lead"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                      Parting Words &amp; Wisdom *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={voicePartingQuote}
                      onChange={(e) => setVoicePartingQuote(e.target.value)}
                      placeholder="Carry the discipline and brotherhood we forged here into every sphere of your life."
                      className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none font-body"
                    />
                  </div>

                  {/* Pin as Featured Message (e.g. From the President) */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={voiceIsPinned}
                        onChange={(e) => setVoiceIsPinned(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-400"
                      />
                      <div className="flex items-center gap-1.5 font-mono-tech text-xs text-white font-semibold">
                        <Pin className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pin this message to the top</span>
                      </div>
                    </label>

                    {voiceIsPinned && (
                      <div className="pt-2 border-t border-white/10 space-y-1.5 animate-fadeIn">
                        <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-amber-300">
                          Pinned Message Title
                        </label>
                        <input
                          type="text"
                          value={voicePinnedTitle}
                          onChange={(e) => setVoicePinnedTitle(e.target.value)}
                          placeholder="e.g. From the President"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none text-xs font-mono-tech"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingVoice(false);
                        setVoiceLecturerName('');
                        setVoiceTitle('');
                        setVoicePartingQuote('');
                        setVoiceHeadshotUrl('');
                        setSelectedVoiceStudentId('');
                      }}
                      className="px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-xs tracking-wider uppercase font-bold py-2.5 px-6 rounded-full transition-colors cursor-pointer shadow"
                    >
                      Save Voice
                    </button>
                  </div>
                </form>
              </UniversalModal>
            )}

            {/* COMPACT VOICES CARDS LIST (MATCHES SCREENSHOT 2 — CLICK CARD TO VIEW FULL MESSAGE & EDIT) */}
            <div className="space-y-3">
              {currentSet.voices.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[#0e1117] border border-white/[0.08] space-y-1">
                  <p className="font-syne font-semibold text-xs text-zinc-300">
                    No voices added yet
                  </p>
                  <p className="font-mono-tech text-[11px] text-zinc-500">
                    Add parting words, farewell messages, and advice from class leaders.
                  </p>
                </div>
              ) : (
                currentSet.voices.map((voice) => (
                  <div
                    key={voice.id}
                    onClick={() => handleOpenEditVoiceModal(voice)}
                    className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all cursor-pointer shadow-sm ${
                      voice.isPinned
                        ? 'bg-gradient-to-r from-amber-500/10 via-[#0e1117] to-[#0e1117] border-amber-500/40'
                        : 'bg-[#0e1117] border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <img
                      src={voice.headshotUrl}
                      alt={voice.lecturerName}
                      referrerPolicy="no-referrer"
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border shrink-0 bg-black ${
                        voice.isPinned ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-white/15'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-syne font-bold text-sm sm:text-base text-white leading-snug">
                          {voice.lecturerName}
                        </h4>
                        {voice.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-mono-tech font-bold uppercase tracking-wider">
                            <Pin className="w-2.5 h-2.5 text-amber-400" />
                            <span>{voice.pinnedTitle || 'Pinned'}</span>
                          </span>
                        )}
                      </div>
                      <p className="font-mono-tech text-xs text-zinc-400 mt-0.5 leading-snug">
                        {voice.title}
                      </p>
                      <p className="font-serif italic text-xs sm:text-sm text-zinc-300 mt-2 line-clamp-3 leading-relaxed">
                        "{voice.partingQuote}"
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: OUR STORY EDITOR (MATCHES SCREENSHOT 3)
            ========================================================================= */}
        {activeTab === 'story' && (
          <div className="p-5 sm:p-6 rounded-3xl bg-[#0e1117] border border-white/[0.08] space-y-4 text-xs font-body shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg sm:text-xl text-white">
                  Our Class Story
                </h3>
                <p className="font-body text-xs text-zinc-400 mt-1">
                  Share the story, milestones, and unforgettable journey of your graduating class.
                </p>
              </div>

              {storySaved && (
                <span className="text-emerald-400 font-mono-tech text-xs flex items-center gap-1.5 shrink-0">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>

            <textarea
              rows={8}
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              className="w-full px-4 py-4 rounded-2xl bg-[#08090e] border border-white/10 text-white font-serif text-sm sm:text-base leading-relaxed focus:border-white/30 focus:outline-none"
            />

            <button
              onClick={handleSaveStory}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech text-xs tracking-wider uppercase font-semibold py-3 px-6 rounded-2xl transition-colors cursor-pointer shadow-md shadow-blue-600/20"
            >
              UPDATE OUR STORY
            </button>
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
          setHierarchyToast(`✓ Populated award with ${student.fullName}`);
          setTimeout(() => setHierarchyToast(null), 2500);
        }}
      />

      {/* Pocket Modal for Student Leader Selection */}
      <ProfilePocketPickerModal
        isOpen={isVoicePickerOpen}
        onClose={() => setIsVoicePickerOpen(false)}
        title="Select Class Leader"
        subtitle="Only approved executive and class leaders appear in this list"
        students={approvedStudentLeaders}
        selectedId={selectedVoiceStudentId}
        mode="leader"
        onSelect={(student) => {
          setSelectedVoiceStudentId(student.id);
          setVoiceLecturerName(student.fullName);
          setVoiceTitle(student.position || 'Class Leader');
          if (student.photoUrl) setVoiceHeadshotUrl(student.photoUrl);
          if (student.quote) setVoicePartingQuote(student.quote);
          setHierarchyToast(`✓ Populated leader voice with ${student.fullName}`);
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
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Trophy className="w-5 h-5" />
                </div>
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

              {/* Winner Avatar Row */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                {editingAwardModalItem.winnerAvatar ? (
                  <img
                    src={editingAwardModalItem.winnerAvatar}
                    alt={editingAwardModalItem.winnerName}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400/50 shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Trophy className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <span className="font-syne font-bold text-xs text-white block">Recipient Photo</span>
                  <p className="font-mono-tech text-[10px] text-zinc-400">Upload or change recipient portrait photo</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => modalAwardPhotoInputRef.current?.click()}
                      className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
                    >
                      <Upload className="w-3 h-3 text-[#d4af37]" />
                      <span>{editingAwardModalItem.winnerAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {editingAwardModalItem.winnerAvatar && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerCropForImage(
                            editingAwardModalItem.rawAvatar || editingAwardModalItem.winnerAvatar,
                            '1:1',
                            'Crop Award Recipient Photo',
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
                        title="Crop award portrait"
                      >
                        <Crop className="w-3 h-3 text-amber-400" />
                        <span>Crop</span>
                      </button>
                    )}
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

              {/* Trophy Type */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                  Trophy Honor Grade
                </label>
                <select
                  value={editingAwardModalItem.trophyType || 'gold'}
                  onChange={(e) =>
                    setEditingAwardModalItem({
                      ...editingAwardModalItem,
                      trophyType: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white focus:border-white/30 focus:outline-none cursor-pointer"
                >
                  <option value="gold">Gold Trophy</option>
                  <option value="crystal">Crystal Plaque</option>
                  <option value="silver">Silver Distinction</option>
                  <option value="bronze">Bronze Laureate</option>
                  <option value="star">Starlight Superlative</option>
                  <option value="crown">Imperial Crown</option>
                </select>
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

      {/* Pop-up Window: Edit Voice Modal */}
      {editingVoiceModalItem && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0c0d14] border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Quote className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-white">Edit Voice</h3>
                  <p className="font-mono-tech text-[11px] text-zinc-400">View full message and update contributor details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingVoiceModalItem(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVoiceModal} className="space-y-4 text-xs font-body">
              {/* Photo Input (Hidden) */}
              <input
                ref={modalVoicePhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleModalVoicePhotoSelect}
              />

              {/* Contributor Photo Row */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                {editingVoiceModalItem.headshotUrl ? (
                  <img
                    src={editingVoiceModalItem.headshotUrl}
                    alt={editingVoiceModalItem.lecturerName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/30 shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-zinc-400 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <span className="font-syne font-bold text-xs text-white block">Contributor Portrait</span>
                  <p className="font-mono-tech text-[10px] text-zinc-400">Upload or change headshot photo</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => modalVoicePhotoInputRef.current?.click()}
                      className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
                    >
                      <Upload className="w-3 h-3 text-[#d4af37]" />
                      <span>{editingVoiceModalItem.headshotUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {editingVoiceModalItem.headshotUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerCropForImage(
                            editingVoiceModalItem.rawHeadshotUrl || editingVoiceModalItem.headshotUrl,
                            '1:1',
                            'Crop Contributor Portrait',
                            (croppedUrl) => {
                              setEditingVoiceModalItem({
                                ...editingVoiceModalItem,
                                headshotUrl: croppedUrl,
                                rawHeadshotUrl: editingVoiceModalItem.rawHeadshotUrl || editingVoiceModalItem.headshotUrl,
                              });
                            }
                          );
                        }}
                        className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Crop contributor portrait"
                      >
                        <Crop className="w-3 h-3 text-amber-400" />
                        <span>Crop</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                  Contributor Name *
                </label>
                <input
                  required
                  type="text"
                  value={editingVoiceModalItem.lecturerName}
                  onChange={(e) =>
                    setEditingVoiceModalItem({ ...editingVoiceModalItem, lecturerName: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              {/* Role / Position */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                  Role / Position *
                </label>
                <input
                  required
                  type="text"
                  value={editingVoiceModalItem.title}
                  onChange={(e) =>
                    setEditingVoiceModalItem({ ...editingVoiceModalItem, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              {/* Parting Quote */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                  Full Parting Message &amp; Wisdom *
                </label>
                <textarea
                  required
                  rows={4}
                  value={editingVoiceModalItem.partingQuote}
                  onChange={(e) =>
                    setEditingVoiceModalItem({ ...editingVoiceModalItem, partingQuote: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none font-body leading-relaxed"
                />
              </div>

              {/* Pin as Featured Message (e.g. From the President) */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingVoiceModalItem.isPinned)}
                    onChange={(e) =>
                      setEditingVoiceModalItem({
                        ...editingVoiceModalItem,
                        isPinned: e.target.checked,
                        pinnedTitle: e.target.checked
                          ? (editingVoiceModalItem.pinnedTitle?.trim() || 'From the President')
                          : editingVoiceModalItem.pinnedTitle,
                      })
                    }
                    className="w-4 h-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-400"
                  />
                  <div className="flex items-center gap-1.5 font-mono-tech text-xs text-white font-semibold">
                    <Pin className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pin this message to the top</span>
                  </div>
                </label>

                {editingVoiceModalItem.isPinned && (
                  <div className="pt-2 border-t border-white/10 space-y-1.5 animate-fadeIn">
                    <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-amber-300">
                      Pinned Message Title
                    </label>
                    <input
                      type="text"
                      value={editingVoiceModalItem.pinnedTitle || ''}
                      onChange={(e) =>
                        setEditingVoiceModalItem({
                          ...editingVoiceModalItem,
                          pinnedTitle: e.target.value,
                        })
                      }
                      placeholder="e.g. From the President"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none text-xs font-mono-tech"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = editingVoiceModalItem.id;
                    setEditingVoiceModalItem(null);
                    handleDeleteVoice(idToDelete);
                  }}
                  className="px-3.5 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingVoiceModalItem(null)}
                    className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-mono-tech font-bold text-xs uppercase shadow-md cursor-pointer"
                  >
                    Update Voice
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
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
