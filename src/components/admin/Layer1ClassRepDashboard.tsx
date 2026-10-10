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
import { getYouTubeThumbnailUrl } from '../../utils/youtube';
import { getAwardVisualConfig } from '../../utils/awardVisuals';
import { getTheme, applyTheme } from '../../utils/theme';
import { 
  User,
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
  Moon
} from 'lucide-react';
import { ConvocationReminderModal } from './ConvocationReminderModal';
import { InviteNextClassModal } from './InviteNextClassModal';
import { PublishAlbumModal } from './PublishAlbumModal';
import { InviteClassmatesModal } from './InviteClassmatesModal';
import { SaveAlbumToCloudModal } from '../public/SaveAlbumToCloudModal';
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
  const { showSuccess, showError, showWarning } = useFeedback();
  const [activeTab, setActiveTab] = useState<
    'students' | 'memories' | 'awards' | 'voices' | 'story' | 'imagery' | 'videos'
  >(() => {
    try {
      const saved = sessionStorage.getItem('kohot_admin_dashboard_tab');
      if (saved && ['students', 'imagery', 'memories', 'awards', 'voices', 'story', 'videos'].includes(saved)) {
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
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isInviteClassmatesModalOpen, setIsInviteClassmatesModalOpen] = useState(false);
  const [shareAlbumToast, setShareAlbumToast] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Technical constraints from master config (KoHot owner dashboard)
  const maxImagesPerAlbum = contentOverride?.maxImagesPerAlbum || 400;
  const compressionResolution = contentOverride?.defaultCompressionResolution || 720;

  // Student Directory & Hierarchy Management State
  const [studentDirectoryTab, setStudentDirectoryTab] = useState<'all' | 'leaders' | 'pending'>('all');
  const [studentSortMode, setStudentSortMode] = useState<'recent' | 'alpha'>('recent');
  const [adminStudentSearch, setAdminStudentSearch] = useState('');
  const [hierarchyToast, setHierarchyToast] = useState<string | null>(null);

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
      if (savedTab && ['students', 'imagery', 'memories', 'awards', 'voices', 'story', 'videos'].includes(savedTab)) {
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

  // Dashboards permanently remain dark with grey shades
  const isLightMode = false;
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
    const updated: ClassSet = { ...currentSet, activationStatus: nextStatus };
    onUpdateSet(updated);
    if (nextStatus === 'active') {
      showSuccess('Your Class Album is now live.', 'Your classmates can return to it whenever they want.');
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
              setHeroBannerUrl(res.dataUrl);
            } catch (err) {
              setHeroBannerUrl(croppedUrl);
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
              setLegacyFooterUrl(res.dataUrl);
            } catch (err) {
              setLegacyFooterUrl(croppedUrl);
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

  // Separate Pending Submissions vs Approved Directory
  const pendingStudents = useMemo(() => {
    return currentSet.students.filter((s) => s.approved === false);
  }, [currentSet.students]);

  const approvedStudents = useMemo(() => {
    return currentSet.students.filter((s) => s.approved !== false);
  }, [currentSet.students]);

  // Filtered leaders in current set (arranged by executive hierarchy from approved list)
  const adminLeaders = useMemo(() => {
    const leaders = approvedStudents.filter(isLeaderProfile);
    return sortLeadersByHierarchy(leaders);
  }, [approvedStudents]);

  // Filtered all approved students for directory view (recent vs alphabetical)
  const adminAllStudents = useMemo(() => {
    let list = [...approvedStudents];

    if (studentSortMode === 'recent') {
      // Sort recently approved or uploaded profiles to the top
      list.sort((a, b) => {
        const timeA = typeof a.approvedAt === 'number' ? a.approvedAt : (a.approvedAt ? new Date(a.approvedAt).getTime() : (a.submittedAt ? new Date(a.submittedAt).getTime() : 0));
        const timeB = typeof b.approvedAt === 'number' ? b.approvedAt : (b.approvedAt ? new Date(b.approvedAt).getTime() : (b.submittedAt ? new Date(b.submittedAt).getTime() : 0));
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

  // Approval Handlers: Admin approves student -> reflects immediately on dashboard at the top with NO empty form
  const handleApproveStudent = (studentId: string) => {
    const student = currentSet.students.find((s) => s.id === studentId);
    if (!student) return;

    const trimmedPos = student.position?.trim() || '';
    const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

    const approvedStudent: StudentProfile = {
      ...student,
      approved: true,
      approvedAt: Date.now(),
      leaderOrder: isLeader && !student.leaderOrder ? calculateIntuitiveHierarchyRank(trimmedPos) : student.leaderOrder,
    };

    // Put newly approved profile at the top of the list
    const remainingStudents = currentSet.students.filter((s) => s.id !== studentId);
    const updatedStudents = [approvedStudent, ...remainingStudents];

    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });

    // Ensure no empty form is displayed and navigate straight to the Graduates section
    setIsAddingStudent(false);
    setEditingStudent(null);
    setStudentDirectoryTab('all');
    setStudentSortMode('recent');

    showSuccess('Classmate approved.', `${student.fullName} is now visible in the live album.`);
  };

  const handleRejectStudent = (studentId: string) => {
    const student = currentSet.students.find((s) => s.id === studentId);
    const updatedStudents = currentSet.students.filter((s) => s.id !== studentId);
    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });
    showWarning('Submission declined.', `Declined submission from ${student?.fullName || 'student'}.`);
  };

  const handleApproveAllPending = () => {
    if (pendingStudents.length === 0) return;
    const count = pendingStudents.length;
    const now = Date.now();

    const newlyApprovedList: StudentProfile[] = [];
    const unchangedStudents: StudentProfile[] = [];

    currentSet.students.forEach((s) => {
      if (s.approved === false) {
        const trimmedPos = s.position?.trim() || '';
        const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });
        newlyApprovedList.push({
          ...s,
          approved: true,
          approvedAt: now,
          leaderOrder: isLeader && !s.leaderOrder ? calculateIntuitiveHierarchyRank(trimmedPos) : s.leaderOrder,
        });
      } else {
        unchangedStudents.push(s);
      }
    });

    // Newly approved list placed right at the top
    const updatedStudents = [...newlyApprovedList, ...unchangedStudents];

    onUpdateSet({
      ...currentSet,
      students: updatedStudents,
    });

    setIsAddingStudent(false);
    setEditingStudent(null);
    setStudentDirectoryTab('all');
    setStudentSortMode('recent');

    showSuccess('Submissions approved.', `All ${count} student submissions are now visible in the album.`);
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
  const [selectedVoiceStudentId, setSelectedVoiceStudentId] = useState<string>('');
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const voicePhotoInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Edit Modals for Awards and Final Thoughts to eliminate scrolling
  const [editingAwardModalItem, setEditingAwardModalItem] = useState<AwardItem | null>(null);
  const [editingVoiceModalItem, setEditingVoiceModalItem] = useState<VoiceItem | null>(null);
  const [isSaveToCloudOpen, setIsSaveToCloudOpen] = useState(false);
  const [isShareAlbumModalOpen, setIsShareAlbumModalOpen] = useState(false);
  const [copiedAlbumShareLink, setCopiedAlbumShareLink] = useState(false);
  const modalAwardPhotoInputRef = useRef<HTMLInputElement>(null);
  const modalVoicePhotoInputRef = useRef<HTMLInputElement>(null);

  // Identify Admin's own profile within the class roster or seed with registration form details
  const myProfile = useMemo(() => {
    const adminEmail = (currentUser?.email || currentSet.classRepEmail || '').toLowerCase().trim();
    const adminName = (currentUser?.fullName || currentSet.classRepName || '').toLowerCase().trim();
    const existing = currentSet.students.find((s) => {
      if (s.id === `admin-${currentSet.id}`) return true;
      if (s.email && adminEmail && s.email.toLowerCase().trim() === adminEmail) return true;
      if (s.fullName && adminName && s.fullName.toLowerCase().trim() === adminName) return true;
      if ((s as any).isClassRep === true) return true;
      if (s.position && (s.position.toLowerCase().includes('class rep') || s.position.toLowerCase().includes('admin'))) return true;
      return false;
    });

    if (existing) return existing;

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
    setEditingVoiceModalItem({ ...voice });
  };

  const handleSaveVoiceModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoiceModalItem) return;
    const updated = currentSet.voices.map((v) =>
      v.id === editingVoiceModalItem.id ? editingVoiceModalItem : v
    );
    onUpdateSet({
      ...currentSet,
      voices: updated,
    });
    setHierarchyToast('✓ Final thought updated successfully!');
    setTimeout(() => setHierarchyToast(null), 3000);
    showSuccess('Final thought updated.');
    setEditingVoiceModalItem(null);
  };

  const handleModalAwardPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const rawUrl = uploadEvent.target?.result as string;
        if (rawUrl) {
          triggerCropForImage(rawUrl, '1:1', 'Crop Award Recipient Photo', (cropped) => {
            if (editingAwardModalItem) {
              setEditingAwardModalItem({ 
                ...editingAwardModalItem, 
                winnerAvatar: cropped, 
                rawAvatar: rawUrl 
              });
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
          triggerCropForImage(rawUrl, '1:1', 'Crop Contributor Photo', (cropped) => {
            if (editingVoiceModalItem) {
              setEditingVoiceModalItem({ 
                ...editingVoiceModalItem, 
                headshotUrl: cropped, 
                rawHeadshotUrl: rawUrl 
              });
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

  // Image Upload with Universal Gallery Compatibility & Safe Framing
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      // 1. Immediately extract universal displayable data URL from any gallery format (HEIC/JPG/PNG)
      const rawUrl = await fileToUniversalDataUrl(file);
      if (rawUrl) {
        setNewStudentPhotoUrl(rawUrl);
      }

      // 2. Perform background WebP optimization
      try {
        const result = await compressImageToWebP(file, compressionResolution, 0.85);
        setNewStudentCompression(result);
        setNewStudentPhotoUrl(result.dataUrl);
      } catch (err) {
        console.warn('Silent compression fallback applied:', err);
      }
    } catch (err) {
      console.error('Error reading gallery image:', err);
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
    const updated = {
      ...currentSet,
      students: currentSet.students.filter((s) => s.id !== id),
    };
    onUpdateSet(updated);
    showWarning('Profile deleted.', `${student?.fullName || 'Student'} was removed from the roster.`);
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
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: res.dataUrl,
          caption: '',
        });
      }
      setBatchImages((prev) => [...prev, ...newItems]);

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
    const updatedMemories = currentSet.memories
      .filter((m) => m.id !== batchId)
      .map((m, idx) => ({ ...m, order: idx + 1 }));

    onUpdateSet({
      ...currentSet,
      memories: updatedMemories,
    });

    setHierarchyToast(`Deleted batch "${target?.title || 'Moments'}".`);
    setTimeout(() => setHierarchyToast(null), 3000);
  };

  // Delete a specific image from an existing batch
  const handleDeleteImageFromBatch = (batchId: string, imageId: string) => {
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
  };

  // Append new images to an existing batch
  const handleAppendFilesToExistingBatch = async (files: FileList | null, batchId: string) => {
    if (!files || files.length === 0) return;

    try {
      const newItems: Array<{ id: string; url: string; caption: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await compressImageToWebP(file, compressionResolution, 0.85);
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: res.dataUrl,
          caption: '',
        });
      }

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
      const updatedMemories = currentSet.memories.map((m) => {
        if (m.id === replacingTarget.categoryId) {
          const updatedImages = [...m.images];
          if (updatedImages[replacingTarget.imageIndex]) {
            updatedImages[replacingTarget.imageIndex] = {
              ...updatedImages[replacingTarget.imageIndex],
              url: res.dataUrl,
            };
          }
          return { ...m, images: updatedImages };
        }
        return m;
      });
      onUpdateSet({ ...currentSet, memories: updatedMemories });
      setHierarchyToast('✓ Image replaced successfully!');
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
    const updated = currentSet.awards.filter((a) => a.id !== awardId);
    onUpdateSet({
      ...currentSet,
      awards: updated,
    });
    setHierarchyToast('✓ Award removed from album.');
    setTimeout(() => setHierarchyToast(null), 3000);
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
        (croppedUrl) => {
          setVoiceHeadshotUrl(croppedUrl);
          setHierarchyToast('✓ Headshot photo cropped successfully!');
          setTimeout(() => setHierarchyToast(null), 3000);
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
        (croppedUrl) => {
          setAwardAvatar(croppedUrl);
          setHierarchyToast('✓ Winner photo cropped successfully!');
          setTimeout(() => setHierarchyToast(null), 3000);
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
    };

    onUpdateSet({
      ...currentSet,
      voices: [newVoice, ...currentSet.voices],
    });

    setVoiceLecturerName('');
    setVoiceTitle('');
    setVoiceHeadshotUrl('');
    setVoicePartingQuote('');
    setSelectedVoiceStudentId('');
    setIsAddingVoice(false);
    setHierarchyToast('✓ Student leader voice saved to album.');
    setTimeout(() => setHierarchyToast(null), 3000);
  };

  const handleDeleteVoice = (voiceId: string) => {
    const updated = currentSet.voices.filter((v) => v.id !== voiceId);
    onUpdateSet({
      ...currentSet,
      voices: updated,
    });
    setHierarchyToast('✓ Student leader voice removed from album.');
    setTimeout(() => setHierarchyToast(null), 3000);
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
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-3 relative transition-colors ${
        isLightMode 
          ? 'bg-white/95 border-zinc-300 text-black shadow-sm' 
          : 'bg-[#18181b]/90 border-zinc-800 text-white'
      }`}>
        {/* Left: KoHot Brand Logo & Album Admin Title and Name */}
        <div className="flex items-center gap-3.5 min-w-0">
          <BrandLogo
            logoUrl={contentOverride?.websiteLogoUrl}
            brandName={contentOverride?.brandName || 'KOHOT'}
            textSize="text-xs sm:text-sm"
            textColor={isLightMode ? 'text-black' : 'text-white'}
          />
          <span className={isLightMode ? 'text-zinc-400 font-mono-tech text-xs' : 'text-zinc-600 font-mono-tech text-xs'}>|</span>
          <div className="min-w-0 leading-tight">
            <div className="font-mono-tech text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">
              Album Admin
            </div>
            <div className="font-syne font-bold text-xs sm:text-sm truncate text-white">
              {displayedAdminName}
            </div>
          </div>
        </div>

        {/* Center: Centralized Sticky Manage Album & Preview Album Switcher (Permanently Centered) */}
        <AlbumAdminSwitcher
          activeMode="manage"
          showMainButton={false}
          onMainDashboard={onMainDashboard}
          onManageAlbum={() => {
            // Already on manage album dashboard, keep user here
          }}
          onPreviewAlbum={handlePreviewAlbum}
        />

        {/* Right: Integrated Profile Menu (Theme switch removed) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <DashboardProfileMenu
            currentUser={currentUser}
            roleTitle="Class Album Admin"
            onLogout={() => onSwitchRole('visitor')}
            onGoToWebsite={onBackToLanding}
            currentSet={currentSet}
            onUpdateSet={onUpdateSet}
            onAdminTransferred={() => onSwitchRole('visitor')}
            triggerCropForImage={triggerCropForImage}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 pt-10 space-y-8">

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
        
        {/* Set Activation Status Banner */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                title={`Registration Reference: ${currentSet.activationRef}`}
                className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-tech uppercase tracking-wider flex items-center gap-1.5 font-semibold cursor-default"
              >
                <CheckCircle2 className="w-3 h-3" />
                Verified Class Album
              </span>
            </div>
            <h2 className="font-syne font-bold text-2xl sm:text-3xl text-white tracking-tight">
              {currentSet.departmentName} • Class of {currentSet.graduationYear}
            </h2>
            <p className="font-body text-xs sm:text-sm text-zinc-400">
              Class Album Admin: <span className="text-white font-medium">{displayedAdminName}</span> ({currentSet.classRepEmail})
            </p>
          </div>

          {/* Main Album Dashboard Actions Card */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="p-3 sm:p-3.5 rounded-3xl bg-[#0c0d14] border border-white/10 shadow-2xl flex flex-col gap-2 min-w-[280px] sm:min-w-[340px]">
              {/* Row 1: Invite Next Class Button (Above) */}
              <button
                id="open-invite-next-class-btn"
                onClick={() => setIsInviteNextClassModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-syne text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/10 active:scale-98"
              >
                <Share2 className="w-3.5 h-3.5 text-black" />
                <span>Invite Next Class ({(currentSet.graduationYear || 2026) + 1})</span>
              </button>

              {/* Row 2: Publish Album, Share Album, and Save Album */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  id="open-publish-modal-btn"
                  onClick={() => setIsPublishModalOpen(true)}
                  className={`py-2 px-2.5 rounded-2xl font-syne font-bold text-[11px] sm:text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 text-center ${
                    isAlbumPublished
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20'
                      : 'bg-white hover:bg-zinc-200 text-black shadow-md'
                  }`}
                  title={isAlbumPublished ? 'Album is Published (Live)' : 'Complete 3 steps or toggle public to publish'}
                >
                  {isAlbumPublished ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-black" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{isAlbumPublished ? 'Published' : 'Publish Album'}</span>
                </button>

                <button
                  id="album-admin-share-album-btn"
                  disabled={!isAlbumPublished}
                  onClick={handleSharePublishedAlbum}
                  title={
                    isAlbumPublished
                      ? 'Share live class album link with classmates & socials'
                      : 'Share album activates automatically once the album is published or toggled live'
                  }
                  className={`py-2 px-2.5 rounded-2xl font-syne font-bold text-[11px] sm:text-xs tracking-wider uppercase flex items-center justify-center gap-1 transition-all text-center ${
                    isAlbumPublished
                      ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-md cursor-pointer active:scale-98'
                      : 'bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed opacity-40'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{shareAlbumToast ? 'Copied Link!' : 'Share'}</span>
                </button>

                <button
                  id="album-admin-save-album-btn"
                  disabled={!isAlbumPublished}
                  onClick={() => setIsSaveToCloudOpen(true)}
                  title={
                    isAlbumPublished
                      ? 'Save and backup album link and QR code to Google Drive / Cloud'
                      : 'Save album activates automatically once the album is published or toggled live'
                  }
                  className={`py-2 px-2.5 rounded-2xl font-syne font-bold text-[11px] sm:text-xs tracking-wider uppercase flex items-center justify-center gap-1 transition-all text-center ${
                    isAlbumPublished
                      ? 'bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] border border-[#d4af37]/40 shadow-md cursor-pointer active:scale-98'
                      : 'bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed opacity-40'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Save</span>
                </button>
              </div>
            </div>

            {/* Public Live Status Switch */}
            <div
              id="public-live-switch"
              onClick={handleToggleAlbumLive}
              className={`px-3.5 py-2.5 rounded-2xl border transition-all flex items-center gap-2.5 cursor-pointer select-none self-start sm:self-center ${
                currentSet.activationStatus === 'active'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
              title={currentSet.activationStatus === 'active' ? 'Album is Live to Public (click to toggle draft)' : 'Album is in Draft Mode (click to toggle live)'}
            >
              <span className="text-[11px] font-mono-tech uppercase tracking-wider font-semibold">
                Public
              </span>
              <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                currentSet.activationStatus === 'active' ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}>
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out flex items-center justify-center ${
                  currentSet.activationStatus === 'active' ? 'translate-x-3.5' : 'translate-x-0'
                }`}>
                  {currentSet.activationStatus === 'active' && (
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-0.5">
                <span className={`w-2 h-2 rounded-full ${
                  currentSet.activationStatus === 'active'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                    : 'bg-zinc-600'
                }`} />
                <span className="text-[10px] font-mono-tech uppercase tracking-wide">
                  {currentSet.activationStatus === 'active' ? 'Live' : 'Draft'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Section Navigation Tabs (Matching Public Album Layout) */}
        <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar border-b pb-4 ${
          isLightMode ? 'border-zinc-200' : 'border-white/[0.08]'
        }`}>
          <button
            id="tab-btn-students"
            onClick={() => setActiveTab('students')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'students'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>People ({approvedStudents.length})</span>
            {pendingStudents.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-bold text-[10px] animate-pulse">
                {pendingStudents.length} pending
              </span>
            )}
          </button>

          <button
            id="tab-btn-imagery"
            onClick={() => setActiveTab('imagery')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'imagery'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Album Design &amp; Privacy</span>
          </button>

          <button
            id="tab-btn-memories"
            onClick={() => setActiveTab('memories')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'memories'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Moments &amp; Highlights</span>
          </button>

          <button
            id="tab-btn-awards"
            onClick={() => setActiveTab('awards')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'awards'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Awards ({currentSet.awards.length})</span>
          </button>

          <button
            id="tab-btn-voices"
            onClick={() => setActiveTab('voices')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'voices'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <Quote className="w-3.5 h-3.5" />
            <span>Final Thoughts ({currentSet.voices.length})</span>
          </button>

          <button
            id="tab-btn-story"
            onClick={() => setActiveTab('story')}
            className={`px-5 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'story'
                ? isLightMode ? 'bg-zinc-950 text-white font-semibold shadow-md' : 'bg-white text-black font-semibold shadow'
                : isLightMode ? 'bg-white hover:bg-zinc-100 text-black font-semibold border border-zinc-300 shadow-xs' : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Our Story</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: STUDENTS MANAGEMENT (WITH LEADERS HIERARCHY ARRANGE TOOL)
            ========================================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {/* Unified Compact Administrative Toolbar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-3.5 shadow-md">
              {/* Row 1: Section Title & Classmate Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-syne font-bold text-lg text-white tracking-tight">
                    Student Profiles
                  </h3>
                  <p className="font-body text-xs text-zinc-400">
                    Manage class member profiles, portraits, quotes, and directory entries for the album.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    id="invite-classmates-btn"
                    onClick={() => setIsInviteClassmatesModalOpen(true)}
                    className="bg-[#d4af37]/15 hover:bg-[#d4af37]/25 text-[#d4af37] border border-[#d4af37]/35 font-tech text-xs tracking-wider uppercase font-bold py-2 px-3.5 sm:px-4 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                    title="Share invitation link with classmates via WhatsApp, Telegram, or SMS"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Invite Classmates</span>
                  </button>

                  {/* Add My Profile / My Profile button */}
                  {myProfile ? (
                    <button
                      id="view-my-profile-btn"
                      onClick={() => setEditingStudent(myProfile)}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-tech text-xs tracking-wider uppercase font-bold py-2 px-3.5 sm:px-4 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                      title="View or edit your own class representative profile"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>My Profile</span>
                    </button>
                  ) : (
                    <button
                      id="add-my-profile-btn"
                      onClick={handleOpenAddMyProfile}
                      className="bg-amber-400 hover:bg-amber-300 text-black font-tech text-xs tracking-wider uppercase font-bold py-2 px-3.5 sm:px-4 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                      title="Add your own profile as class representative to this album"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add My Profile</span>
                    </button>
                  )}

                  <button
                    id="add-student-btn"
                    onClick={() => setIsAddingStudent(true)}
                    className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-2 px-3.5 sm:px-4 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Classmate</span>
                  </button>
                </div>
              </div>

              {/* Isolated "My Profile" Featured Card (Becomes isolated but part of the profiles) */}
              {myProfile && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#0c0d14] to-transparent border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 animate-fadeIn">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {myProfile.photoUrl ? (
                      <img
                        src={myProfile.photoUrl}
                        alt={myProfile.fullName}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-400/50 shadow-md shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center text-emerald-300 font-syne font-bold text-lg shrink-0">
                        {myProfile.fullName ? myProfile.fullName.charAt(0).toUpperCase() : 'A'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-syne font-bold text-sm text-white truncate">
                          {myProfile.fullName}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono-tech uppercase font-bold">
                          My Profile • Admin
                        </span>
                      </div>
                      <p className="font-mono-tech text-xs text-amber-300 truncate">
                        {myProfile.position || 'Class Representative'}
                      </p>
                      {myProfile.quote && (
                        <p className="font-body text-xs text-zinc-400 italic line-clamp-1 mt-0.5">
                          "{myProfile.quote}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setEditingStudent(myProfile)}
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Edit My Profile</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Hierarchy Update Feedback Toast */}
              {hierarchyToast && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono-tech flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{hierarchyToast}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 uppercase">Album Live Sync</span>
                </div>
              )}

              {/* Pending Submissions Alert Banner */}
              {pendingStudents.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-syne font-bold text-xs text-amber-300">
                        {pendingStudents.length} Submission{pendingStudents.length > 1 ? 's' : ''} Awaiting Review &amp; Approval
                      </h4>
                      <p className="font-body text-[11px] text-zinc-300">
                        Submitted via broadcast link. Classmates will only appear on the live album after approval.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="switch-to-pending-btn"
                      onClick={() => setStudentDirectoryTab('pending')}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-tech text-xs uppercase font-bold transition-colors cursor-pointer"
                    >
                      Review ({pendingStudents.length})
                    </button>
                    <button
                      id="approve-all-pending-banner-btn"
                      onClick={handleApproveAllPending}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer"
                    >
                      Approve All
                    </button>
                  </div>
                </div>
              )}

              {/* Row 2: Sub-tabs, Sort & Search in one compact horizontal bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2 border-t border-white/[0.06]">
                {/* Segmented Sub-tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    id="admin-subtab-all"
                    onClick={() => setStudentDirectoryTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      studentDirectoryTab === 'all'
                        ? 'bg-white text-black font-bold shadow'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>All Profiles ({approvedStudents.length})</span>
                  </button>

                  <button
                    id="admin-subtab-leaders"
                    onClick={() => setStudentDirectoryTab('leaders')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      studentDirectoryTab === 'leaders'
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold shadow ring-1 ring-amber-400'
                        : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-400/10 border border-white/5'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Leaders Hierarchy ({adminLeaders.length})</span>
                  </button>

                  <button
                    id="admin-subtab-pending"
                    onClick={() => setStudentDirectoryTab('pending')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      studentDirectoryTab === 'pending'
                        ? 'bg-amber-400 text-black font-bold shadow ring-1 ring-amber-400'
                        : pendingStudents.length > 0
                          ? 'text-amber-300 bg-amber-400/10 border border-amber-400/25 font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pending Approvals</span>
                    {pendingStudents.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-mono-tech font-bold text-[10px]">
                        {pendingStudents.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Filters, Sorters & Quick Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {studentDirectoryTab === 'leaders' ? (
                    <button
                      id="reset-intuitive-hierarchy-btn"
                      onClick={handleResetToIntuitiveHierarchy}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono-tech text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Auto-sort leaders by standard academic executive offices (President, Class Rep, etc.)"
                    >
                      <RefreshCw className="w-3 h-3 text-amber-400" />
                      <span>Auto-Rank Intuitively</span>
                    </button>
                  ) : studentDirectoryTab === 'all' ? (
                    <>
                      {/* Sort Mode Toggle (Recent vs Alphabetical) */}
                      <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono-tech">
                        <button
                          type="button"
                          onClick={() => setStudentSortMode('recent')}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            studentSortMode === 'recent'
                              ? 'bg-white text-black font-bold shadow'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Sort recently uploaded or approved profiles to the top"
                        >
                          Recent First
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentSortMode('alpha')}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            studentSortMode === 'alpha'
                              ? 'bg-white text-black font-bold shadow'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Sort alphabetically A-Z"
                        >
                          A–Z
                        </button>
                      </div>

                      {/* Filter Search Input */}
                      <div className="relative min-w-[180px] sm:min-w-[210px]">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={adminStudentSearch}
                          onChange={(e) => setAdminStudentSearch(e.target.value)}
                          placeholder="Filter by name or role..."
                          className="w-full bg-[#10121a] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-body"
                        />
                      </div>
                    </>
                  ) : (
                    pendingStudents.length > 0 && (
                      <button
                        onClick={handleApproveAllPending}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono-tech text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Approve All ({pendingStudents.length})</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Add Classmate Pop-up Window Modal */}
            <UniversalModal
              isOpen={isAddingStudent}
              onClose={() => setIsAddingStudent(false)}
              title="Add Classmate Profile"
              subtitle="Submit classmate details, leadership position, parting quote, and photo"
              maxWidth="3xl"
            >
              <form onSubmit={handleSaveStudent} className="space-y-5 text-xs font-body p-1">
                <div className="flex items-center gap-2 text-white font-mono-tech uppercase text-[11px] tracking-wider pb-3 border-b border-white/10">
                  <User className="w-4 h-4 text-[#d4af37]" />
                  <span>Classmate Profile &amp; Portrait Setup</span>
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
                    <p className="text-[10px] text-zinc-500 font-mono-tech mt-1">
                      Official titles automatically qualify for the Leaders hierarchy.
                    </p>
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
                      <span>{isCompressing ? 'Processing Photo...' : newStudentPhotoUrl ? 'Change Portrait' : 'Upload Student Photo'}</span>
                    </button>
                  </div>

                  {newStudentPhotoUrl && (
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={newStudentPhotoUrl}
                          alt="Preview"
                          className="w-14 h-18 rounded-lg object-cover border border-white/20 filter grayscale-[20%]"
                        />
                        <span className="text-xs text-zinc-400 font-mono-tech">Photo preview ready</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerCropForImage(
                            newStudentPhotoUrl,
                            '4:5',
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

            {/* VIEW 1: LEADERS HIERARCHY ARRANGE MODE */}
            {studentDirectoryTab === 'leaders' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-400/[0.04] border border-amber-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-syne font-bold text-amber-300">
                        Leaders Hierarchy Sequencing
                      </h4>
                      <p className="text-xs text-zinc-400 font-body">
                        Use the arrow controls to move leaders up or down. Your sequence dictates how they appear on the public album.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono-tech text-amber-400 font-semibold px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
                    {adminLeaders.length} Leaders Active
                  </span>
                </div>

                {adminLeaders.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[#0c0d14] border border-white/10 space-y-2">
                    <Crown className="w-8 h-8 text-amber-400/40 mx-auto" />
                    <p className="text-sm font-syne text-white">No leadership titles registered yet</p>
                    <p className="text-xs text-zinc-400">
                      When students submit their profile with an executive role and you approve them, they will automatically appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {adminLeaders.map((leader, index) => {
                      const isFirst = index === 0;
                      const isLast = index === adminLeaders.length - 1;

                      return (
                        <div
                          key={leader.id}
                          id={`admin-leader-row-${leader.id}`}
                          className="p-3 sm:p-4 rounded-2xl bg-[#0c0d14] border border-white/10 hover:border-amber-400/30 transition-all flex items-center justify-between gap-3"
                        >
                          {/* Rank Badge & Profile Info */}
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-black font-mono-tech font-bold text-xs flex items-center justify-center shrink-0 shadow">
                              #{index + 1}
                            </span>

                            <img
                              src={leader.photoUrl}
                              alt={leader.fullName}
                              className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
                            />

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-syne font-bold text-sm text-white truncate">
                                  {leader.fullName}
                                </h4>
                                {leader.nickname && (
                                  <span className="font-mono-tech text-xs text-zinc-400 hidden sm:inline">
                                    "{leader.nickname}"
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 font-mono-tech text-[10px] uppercase text-amber-300 font-semibold truncate">
                                  <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                  {leader.position}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Reordering & Action Buttons */}
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <button
                              id={`move-up-${leader.id}`}
                              disabled={isFirst}
                              onClick={() => handleMoveLeader(leader.id, 'up')}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 disabled:opacity-20 text-white transition-colors cursor-pointer"
                              title="Move up in hierarchy"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>

                            <button
                              id={`move-down-${leader.id}`}
                              disabled={isLast}
                              onClick={() => handleMoveLeader(leader.id, 'down')}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 disabled:opacity-20 text-white transition-colors cursor-pointer"
                              title="Move down in hierarchy"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setEditingStudent(leader)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer ml-0.5"
                              title="Edit leader profile"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteStudent(leader.id)}
                              className="p-2 rounded-xl hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer ml-0.5"
                              title="Delete leader"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: ALL APPROVED CLASSMATES DIRECTORY (ARRANGED ALPHABETICALLY) */}
            {studentDirectoryTab === 'all' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono-tech text-zinc-400 px-1">
                  <span>Showing {adminAllStudents.length} approved classmates (Alphabetical)</span>
                  {pendingStudents.length > 0 && (
                    <button
                      onClick={() => setStudentDirectoryTab('pending')}
                      className="text-amber-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer"
                    >
                      {pendingStudents.length} pending submissions awaiting review &rarr;
                    </button>
                  )}
                </div>

                {adminAllStudents.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[#0c0d14] border border-white/10 space-y-2">
                    <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-sm font-syne text-white">No approved profiles found</p>
                    <p className="text-xs text-zinc-400">
                      Add profiles manually or share the broadcast link with classmates to populate this roster.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {adminAllStudents.map((student) => (
                      <div
                        key={student.id}
                        className="rounded-2xl bg-[#0c0d14] border border-white/10 overflow-hidden p-3.5 flex flex-col justify-between group hover:border-white/25 transition-all"
                      >
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-black">
                          <img
                            src={student.photoUrl}
                            alt={student.fullName}
                            className="w-full h-full object-cover filter contrast-[1.05] grayscale-[20%] group-hover:scale-105 transition-transform duration-500"
                          />
                          {student.position && (
                            <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase tracking-wider backdrop-blur-md ${
                              isLeaderProfile(student)
                                ? 'bg-amber-400/20 border border-amber-400/40 text-amber-300'
                                : 'bg-black/80 text-white/90'
                            }`}>
                              {student.position}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-syne font-bold text-sm text-white truncate">
                            {student.fullName}
                          </h4>
                          {student.nickname && (
                            <p className="font-mono-tech text-xs text-zinc-400 truncate">
                              "{student.nickname}"
                            </p>
                          )}
                          {student.quote && (
                            <p className="font-body text-xs text-zinc-400 italic line-clamp-2 mt-2 leading-relaxed">
                              "{student.quote}"
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-white/[0.06] mt-3 flex items-center justify-between">
                          <span className="text-[10px] font-mono-tech text-emerald-400/90 font-medium">
                            Approved
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingStudent(student)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1 border border-white/10"
                              title="Edit profile"
                            >
                              <Edit3 className="w-3 h-3 text-[#d4af37]" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="text-zinc-500 hover:text-red-400 text-xs font-mono-tech p-1 transition-colors cursor-pointer"
                              title="Delete profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: PENDING APPROVALS QUEUE */}
            {studentDirectoryTab === 'pending' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-400/[0.04] border border-amber-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-syne font-bold text-amber-300">
                        Pending Student Profile Approvals
                      </h4>
                      <p className="text-xs text-zinc-400 font-body">
                        Review submissions sent by students via frictionless broadcast links before they go live on the album.
                      </p>
                    </div>
                  </div>

                  {pendingStudents.length > 0 && (
                    <button
                      id="approve-all-pending-btn"
                      onClick={handleApproveAllPending}
                      className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-tech text-xs tracking-wider uppercase font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve All ({pendingStudents.length})</span>
                    </button>
                  )}
                </div>

                {pendingStudents.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[#0c0d14] border border-white/10 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-syne font-bold text-white">No Pending Submissions</h4>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      All student submissions have been reviewed and published to the live album. Share the broadcast link above to invite more classmates!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingStudents.map((student) => {
                      const trimmedPos = student.position?.trim() || '';
                      const isLeader = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

                      return (
                        <div
                          key={student.id}
                          id={`pending-student-card-${student.id}`}
                          className="rounded-2xl bg-[#0c0d14] border border-amber-400/30 overflow-hidden p-4 flex flex-col justify-between space-y-4 hover:border-amber-400/50 transition-all shadow-lg"
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={student.photoUrl}
                              alt={student.fullName}
                              className="w-20 h-24 rounded-xl object-cover border border-white/15 shrink-0 bg-black"
                            />

                            <div className="min-w-0 flex-1 space-y-1">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono-tech uppercase font-bold">
                                Pending Review
                              </span>
                              <h4 className="font-syne font-bold text-sm text-white truncate">
                                {student.fullName}
                              </h4>
                              {student.nickname && (
                                <p className="font-mono-tech text-xs text-zinc-400 truncate">
                                  "{student.nickname}"
                                </p>
                              )}
                              {student.position && (
                                <div className="pt-0.5">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono-tech uppercase ${
                                    isLeader
                                      ? 'bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30'
                                      : 'bg-white/10 text-zinc-300'
                                  }`}>
                                    {isLeader && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                                    {student.position}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {student.quote && (
                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                              <p className="font-body text-xs text-zinc-300 italic line-clamp-3">
                                "{student.quote}"
                              </p>
                            </div>
                          )}

                          {isLeader && (
                            <p className="text-[10px] font-mono-tech text-amber-400/90 flex items-center gap-1">
                              <Crown className="w-3 h-3 shrink-0" />
                              <span>Recognized executive role — will be added to Leaders Hierarchy on approval.</span>
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono-tech text-zinc-500">
                              {student.submittedAt ? `Submitted: ${student.submittedAt}` : 'Recent submission'}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                id={`edit-pending-btn-${student.id}`}
                                onClick={() => setEditingStudent(student)}
                                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1"
                                title="Edit details before approving"
                              >
                                <Edit3 className="w-3 h-3 text-[#d4af37]" />
                                <span>Edit</span>
                              </button>

                              <button
                                id={`reject-btn-${student.id}`}
                                onClick={() => handleRejectStudent(student.id)}
                                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1"
                                title="Decline and remove"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Decline</span>
                              </button>

                              <button
                                id={`approve-btn-${student.id}`}
                                onClick={() => handleApproveStudent(student.id)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-tech text-xs uppercase font-bold transition-colors cursor-pointer flex items-center gap-1 shadow"
                                title="Approve and publish to live album"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
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
          </div>
        )}

        {/* =========================================================================
            TAB: ALBUM DESIGN & PRIVACY (SPLIT INTO DESIGNS AND PRIVACY SUB-SECTIONS)
            ========================================================================= */}
        {activeTab === 'imagery' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Sub-Section Navigation: Designs vs Privacy */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/10 w-fit">
                <button
                  type="button"
                  id="subtab-designs-btn"
                  onClick={() => setDesignPrivacySubTab('designs')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                    designPrivacySubTab === 'designs'
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Designs</span>
                </button>
                <button
                  type="button"
                  id="subtab-privacy-btn"
                  onClick={() => setDesignPrivacySubTab('privacy')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                    designPrivacySubTab === 'privacy'
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Privacy (Plaque QR Access)</span>
                </button>
              </div>

              {designPrivacySubTab === 'designs' && (
                <button
                  id="save-album-imagery-btn"
                  onClick={handleSaveImagery}
                  className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow-lg flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Check className="w-4 h-4 text-black" />
                  <span>Save Designs</span>
                </button>
              )}
            </div>

            {imagerySaveToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono-tech text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{imagerySaveToast}</span>
              </div>
            )}

            {/* SUB-SECTION 1: DESIGNS */}
            {designPrivacySubTab === 'designs' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* SECTION 1: ALBUM HERO BANNER IMAGE */}
                  <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-syne font-bold text-lg text-white">Album Hero Banner</h4>
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

                  {/* Simulated Album Overlay */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="font-mono-tech text-[10px] uppercase text-amber-400 font-bold">
                      {currentSet.classSetName} • Class of {currentSet.graduationYear}
                    </span>
                    <h5 className="font-syne font-bold text-base sm:text-lg text-white truncate drop-shadow">
                      {currentSet.departmentName}
                    </h5>
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-3 pt-2">
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

                    <button
                      type="button"
                      onClick={() => setHeroBannerUrl('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop')}
                      className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: FINAL FOOTER IMAGE ("THIS IS OUR LEGACY.") */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-syne font-bold text-lg text-white">Final Footer Banner</h4>
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

                  {/* Simulated Legacy Text Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <p className="font-syne font-bold text-lg sm:text-2xl text-white tracking-widest uppercase drop-shadow">
                      THIS IS OUR LEGACY.
                    </p>
                    <p className="font-mono-tech text-[11px] text-zinc-300 mt-1">
                      {currentSet.departmentName} • Class of {currentSet.graduationYear}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-3 pt-2">
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

                    <button
                      type="button"
                      onClick={() => setLegacyFooterUrl('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop')}
                      className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: DEPARTMENT SOCIAL MEDIA CHANNELS */}
            <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-syne font-bold text-lg text-white flex items-center gap-2">
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
                {/* YouTube */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                    <Youtube className="w-3.5 h-3.5 text-red-500" />
                    <span>YouTube Channel</span>
                  </label>
                  <input
                    type="text"
                    value={socials.youtube || ''}
                    onChange={(e) => setSocials({ ...socials, youtube: e.target.value })}
                    placeholder="https://youtube.com/@department"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono-tech placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Instagram */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                    <Instagram className="w-3.5 h-3.5 text-pink-500" />
                    <span>Instagram Handle</span>
                  </label>
                  <input
                    type="text"
                    value={socials.instagram || ''}
                    onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
                    placeholder="@department_alumni or https://instagram.com/..."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono-tech placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* X */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current text-white">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span>X</span>
                  </label>
                  <input
                    type="text"
                    value={socials.twitter || ''}
                    onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                    placeholder="@dept_set or https://x.com/..."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono-tech placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* LinkedIn */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                    <Linkedin className="w-3.5 h-3.5 text-blue-400" />
                    <span>LinkedIn Alumni Page</span>
                  </label>
                  <input
                    type="text"
                    value={socials.linkedin || ''}
                    onChange={(e) => setSocials({ ...socials, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/company/..."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono-tech placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Official Website */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Official Department Website / Portal</span>
                  </label>
                  <input
                    type="text"
                    value={socials.website || ''}
                    onChange={(e) => setSocials({ ...socials, website: e.target.value })}
                    placeholder="https://dept.university.edu"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono-tech placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

          {/* SUB-SECTION 2: PRIVACY (PLAQUE QR CODE ACCESS CONTROL) */}
          {designPrivacySubTab === 'privacy' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Context Banner */}
              <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-syne font-bold text-base sm:text-lg text-white flex items-center gap-2">
                        <span>Legacy Plaque QR Code Access Privacy</span>
                        <span className="text-[10px] font-mono-tech uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active Policy
                        </span>
                      </h3>
                      <p className="font-body text-xs text-zinc-400 mt-0.5 leading-relaxed">
                        Control exactly what public visitors see when scanning the physical acrylic or wooden Legacy Plaque QR code mounted in your department or hall of fame.
                      </p>
                    </div>
                  </div>

                  {/* Preset Quick Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleSetAllPlaquePrivacy(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-mono-tech text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllPlaquePrivacy(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-300 hover:text-white font-mono-tech text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Curated Privacy</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3 text-xs font-mono-tech text-zinc-400 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-zinc-200">Important Distinction:</strong> These privacy toggles apply <em>only</em> to visitors entering via the physical Legacy Plaque QR code scan (<span className="text-amber-300 font-mono">?entry=plaque</span>). Direct web links shared via WhatsApp, email, or saved to Google Drive retain full album visibility.
                  </p>
                </div>
              </div>

              {/* 6 Section Toggle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    key: 'hideStudents' as keyof PlaquePrivacySettings,
                    title: 'Class Directory & Student Profiles',
                    description: 'Graduating classmate portraits, nicknames, quotes, department positions, and social handles.',
                    icon: Users,
                    color: 'text-sky-400',
                    bg: 'bg-sky-500/10 border-sky-500/20',
                  },
                  {
                    key: 'hideMemories' as keyof PlaquePrivacySettings,
                    title: 'Moments & Campus Memories',
                    description: 'Curated photo archive collections, matriculation galleries, and dinner party highlights.',
                    icon: Camera,
                    color: 'text-amber-400',
                    bg: 'bg-amber-500/10 border-amber-500/20',
                  },
                  {
                    key: 'hideAwards' as keyof PlaquePrivacySettings,
                    title: 'Class Awards & Superlatives',
                    description: 'Superlative trophies, peer recognitions, honorary plaques, and official citations.',
                    icon: Trophy,
                    color: 'text-[#d4af37]',
                    bg: 'bg-[#d4af37]/10 border-[#d4af37]/20',
                  },
                  {
                    key: 'hideVoices' as keyof PlaquePrivacySettings,
                    title: 'Final Thoughts & Lecturer Wisdom',
                    description: 'Parting words, faculty advice, and student leader farewell messages.',
                    icon: Quote,
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-500/10 border-emerald-500/20',
                  },
                  {
                    key: 'hideStory' as keyof PlaquePrivacySettings,
                    title: 'Our Set Story Narrative',
                    description: 'The collective historical chronicle of your class journey through matriculation to final year.',
                    icon: BookOpen,
                    color: 'text-purple-400',
                    bg: 'bg-purple-500/10 border-purple-500/20',
                  },
                  {
                    key: 'hideVideos' as keyof PlaquePrivacySettings,
                    title: 'Department Videos & Convocation Reel',
                    description: 'Embedded YouTube video clips, convocation streams, and department memories.',
                    icon: Film,
                    color: 'text-rose-400',
                    bg: 'bg-rose-500/10 border-rose-500/20',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isHidden = Boolean((currentSet.plaquePrivacy || {})[item.key]);
                  const isVisible = !isHidden;

                  return (
                    <div
                      key={item.key}
                      onClick={() => handleTogglePlaquePrivacy(item.key)}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-4 select-none ${
                        isVisible
                          ? 'bg-[#0c0d14] border-white/15 hover:border-emerald-500/40 shadow-lg'
                          : 'bg-[#08090e] border-white/5 opacity-80 hover:opacity-100 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${item.bg} ${item.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-syne font-bold text-sm text-white truncate">
                              {item.title}
                            </h4>
                            <p className="font-body text-xs text-zinc-400 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Animated Toggle Switch */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePlaquePrivacy(item.key);
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isVisible ? 'bg-emerald-500' : 'bg-zinc-700'
                            }`}
                            aria-label={`Toggle ${item.title}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                isVisible ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`font-mono-tech text-[10px] uppercase tracking-wider font-semibold ${
                              isVisible ? 'text-emerald-400' : 'text-zinc-500'
                            }`}
                          >
                            {isVisible ? 'Visible' : 'Hidden'}
                          </span>
                        </div>
                      </div>

                      {/* Status indicator bar */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-tech">
                        <span className="text-zinc-500">Plaque Visitors:</span>
                        {isVisible ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Can View on Plaque Scan
                          </span>
                        ) : (
                          <span className="text-amber-400/90 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Hidden from Plaque Scan
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

        {/* =========================================================================
            TAB 2: MOMENTS & HIGHLIGHTS MANAGEMENT (SPLIT INTO 2 SUB-TABS)
            ========================================================================= */}
        {activeTab === 'memories' && (
          <div id="moments-edit-section" className="space-y-6">
            {/* The 2 Sub-Section Buttons: Upload Moments vs Highlights */}
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
                <span>Upload Moments ({currentSet.memories.length} Categories)</span>
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
                <span>Highlights ({videos.length} Videos)</span>
              </button>
            </div>

            {/* SUB-TAB A: VIDEO HIGHLIGHTS */}
            {memoriesAdminSubTab === 'highlights' && (
              <div id="video-highlights-manager-section" className="space-y-6 animate-fadeIn">
                <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-6 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-syne font-bold text-lg text-white flex items-center gap-2">
                        <Film className="w-4 h-4 text-red-500" />
                        <span>Video Highlights ({videos.length})</span>
                      </h4>
                      <p className="text-xs text-zinc-400 font-mono-tech mt-0.5">
                        Embed convocation speeches, valedictory addresses, award banquets, and class project reels.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAddVideo}
                      className="px-4 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5 text-black" />
                      <span>Add YouTube Video</span>
                    </button>
                  </div>

                  {/* Video Add / Edit Form */}
                  {isAddingVideo && (
                    <form
                      onSubmit={handleSaveVideoItem}
                      className="p-5 sm:p-6 rounded-2xl bg-black/60 border border-white/20 space-y-4 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="font-syne font-bold text-sm text-white">
                          {editingVideo ? 'Edit YouTube Video' : 'Add New YouTube Video to Album'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddingVideo(false)}
                          className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

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
                            className="w-full px-3.5 py-2 rounded-xl bg-[#0a0c12] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                          />
                        </div>

                        {/* YouTube URL */}
                        <div className="space-y-1.5">
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                            YouTube URL or Video ID *
                          </label>
                          <input
                            required
                            type="text"
                            value={videoYoutubeUrl}
                            onChange={(e) => setVideoYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ or youtu.be/..."
                            className="w-full px-3.5 py-2 rounded-xl bg-[#0a0c12] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                          />
                        </div>

                        {/* Custom Thumbnail URL */}
                        <div className="space-y-1.5">
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                            Optional Custom Thumbnail Image URL
                          </label>
                          <input
                            type="text"
                            value={videoThumbnailUrl}
                            onChange={(e) => setVideoThumbnailUrl(e.target.value)}
                            placeholder="Leave blank to auto-use YouTube's HQ thumbnail"
                            className="w-full px-3.5 py-2 rounded-xl bg-[#0a0c12] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                          />
                        </div>

                        {/* Event Tag / Date */}
                        <div className="space-y-1.5">
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                            Event Tag / Occasion Date
                          </label>
                          <input
                            type="text"
                            value={videoDateStr}
                            onChange={(e) => setVideoDateStr(e.target.value)}
                            placeholder="e.g. Convocation Day • Oct 2026"
                            className="w-full px-3.5 py-2 rounded-xl bg-[#0a0c12] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                          />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                            Video Description / Highlights
                          </label>
                          <textarea
                            rows={2}
                            value={videoDescription}
                            onChange={(e) => setVideoDescription(e.target.value)}
                            placeholder="Brief summary of speeches, special awards, or memorable moments in this video..."
                            className="w-full px-3.5 py-2 rounded-xl bg-[#0a0c12] border border-white/15 text-white text-xs font-body focus:outline-none focus:border-white/30"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingVideo(false)}
                          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-mono-tech transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-syne font-bold uppercase tracking-wider transition-colors cursor-pointer shadow"
                        >
                          {editingVideo ? 'Update Video' : 'Save Video to Album'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Videos List */}
                  {videos.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-black/30 border border-dashed border-white/15 text-center space-y-3">
                      <Film className="w-8 h-8 text-zinc-600 mx-auto" />
                      <div className="space-y-1">
                        <p className="font-syne font-bold text-sm text-white">No Department Videos Added Yet</p>
                        <p className="font-body text-xs text-zinc-400 max-w-md mx-auto">
                          Bring your class album to life with memorable graduation video footage, award banquets, project pitches, or farewell speeches.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const sample: DepartmentVideoItem = {
                            id: `vid-${Date.now()}`,
                            title: `${currentSet.departmentName} Convocation Highlights & Valedictory`,
                            youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                            description: `Official celebratory highlights and memorable milestones for the Class of ${currentSet.graduationYear}.`,
                            dateStr: `Convocation • ${currentSet.graduationYear}`,
                          };
                          const updated = [...videos, sample];
                          setVideos(updated);
                          onUpdateSet({ ...currentSet, videos: updated });
                        }}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Demo Video Clip</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {videos.map((vid) => {
                        const thumb = vid.thumbnailUrl || getYouTubeThumbnailUrl(vid.youtubeUrl);
                        return (
                          <div
                            key={vid.id}
                            className="rounded-2xl bg-black/50 border border-white/10 overflow-hidden group hover:border-white/25 transition-all flex flex-col justify-between"
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
                                    onClick={() => {
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
                            <div className="p-3 border-t border-white/5 flex items-center justify-between gap-2">
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

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditVideo(vid)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                  title="Edit video details"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
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
              </div>
            )}

            {/* SUB-TAB B: MOMENTS CATEGORIES */}
            {memoriesAdminSubTab === 'moments' && (
              <div id="moments-batches-manager-section" className="space-y-6 animate-fadeIn">
                {/* Header & Capacity Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-syne font-bold text-xl text-white">
                      Moments &amp; Milestone Categories ({currentSet.memories.length} Categories)
                    </h3>
                    <p className="font-body text-xs text-zinc-400 mt-1">
                      Upload photos in themed categories (e.g., Convocation, Dinner &amp; Awards, Defenses). Rearrange category hierarchy and individual photo sequences for the album.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id="create-batch-btn"
                      onClick={() => setIsAddingBatch(!isAddingBatch)}
                      className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-2.5 px-5 rounded-full flex items-center gap-2 transition-colors cursor-pointer shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingBatch ? 'Cancel' : 'Create New Category'}</span>
                    </button>
                  </div>
                </div>



            {/* Album Image Limit & Capacity Card */}
            <div className="p-5 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span className="font-syne font-bold text-sm text-white">
                    Moments Gallery Capacity
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono-tech">
                  <span className="text-zinc-400">
                    <strong className="text-white font-bold">{totalMomentImages}</strong> / {maxImagesPerAlbum} images max
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                    totalMomentImages >= maxImagesPerAlbum
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : totalMomentImages >= maxImagesPerAlbum * 0.8
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {Math.max(0, maxImagesPerAlbum - totalMomentImages)} slots remaining
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    totalMomentImages >= maxImagesPerAlbum
                      ? 'bg-rose-500'
                      : totalMomentImages >= maxImagesPerAlbum * 0.8
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((totalMomentImages / maxImagesPerAlbum) * 100))}%` }}
                />
              </div>

              <p className="text-[11px] font-mono-tech text-zinc-500">
                All uploaded images undergo automated optimization for instant, high-resolution viewing across mobile and desktop.
              </p>
            </div>

            {/* CREATE NEW BATCH FORM */}
            {isAddingBatch && (
              <form onSubmit={handleSaveBatch} className="p-6 rounded-3xl bg-[#0c0d14] border border-white/20 space-y-5 text-xs font-body animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-white font-mono-tech uppercase text-xs tracking-wider">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Create New Event Category</span>
                  </div>
                  <span className="text-[11px] font-mono-tech text-zinc-400">
                    Step 1: Set Details &rarr; Step 2: Add Images &amp; Extract Date
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                      Event Category *
                    </label>
                    <span className="text-[11px] font-mono-tech text-zinc-500">
                      Select preset or type custom category
                    </span>
                  </div>
                  <input
                    required
                    type="text"
                    list="moments-category-presets"
                    value={batchCategory}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBatchCategory(val);
                      setBatchTitle(val);
                      if (val.toLowerCase().includes('convocation')) {
                        setIsConvocationBatchToggle(true);
                      }
                    }}
                    placeholder="e.g. Sign-out Day, Dinner & Awards, Convocation..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none font-mono-tech text-xs"
                  />
                  <datalist id="moments-category-presets">
                    <option value="Convocation" />
                    <option value="Sign-out Day" />
                    <option value="Dinner & Awards" />
                    <option value="Project Defense" />
                    <option value="Lecture Hall Life" />
                    <option value="Sports & Picnics" />
                    <option value="Matriculation" />
                    <option value="Campus Culture" />
                  </datalist>

                  {/* Preset Pocket List Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-mono-tech uppercase text-zinc-500 mr-1">Quick Select:</span>
                    {[
                      'Convocation',
                      'Sign-out Day',
                      'Dinner & Awards',
                      'Project Defense',
                      'Lecture Hall Life',
                      'Sports & Picnics',
                      'Matriculation',
                      'Campus Culture'
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

                {/* Structured Event Date Section */}
                <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Event Date (Day • Month • Year)</span>
                      {extractedDateResult && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono-tech">
                          Auto-Extracted from Photos
                        </span>
                      )}
                    </label>
                  </div>

                  <p className="text-[11px] font-mono-tech text-zinc-400">
                    Since uploads usually happen days, weeks, or months after the event, the system extracts the date from your photos automatically. If you can't remember the exact day, saving the Month &amp; Year is accepted.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Day Input */}
                    <div>
                      <label className="block text-[10px] font-mono-tech uppercase text-zinc-400 mb-1">
                        Day (1-31)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        disabled={isBatchDayUnknown}
                        value={isBatchDayUnknown ? '' : batchDay}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                          setBatchDay(val);
                          setBatchDate(formatDateComponents(val === '' ? undefined : val, batchMonth, batchYear));
                        }}
                        placeholder={isBatchDayUnknown ? 'Day unknown' : 'e.g. 18'}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-mono-tech text-white focus:outline-none transition-all ${
                          isBatchDayUnknown 
                            ? 'bg-black/30 border-white/5 text-zinc-600 cursor-not-allowed'
                            : 'bg-black/50 border-white/15 focus:border-emerald-500/50'
                        }`}
                      />
                      <label className="flex items-center gap-1.5 text-[10px] font-mono-tech text-zinc-400 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={isBatchDayUnknown}
                          onChange={(e) => {
                            setIsBatchDayUnknown(e.target.checked);
                            if (e.target.checked) {
                              setBatchDay('');
                              setBatchDate(formatDateComponents(undefined, batchMonth, batchYear));
                            } else {
                              setBatchDate(formatDateComponents(typeof batchDay === 'number' ? batchDay : undefined, batchMonth, batchYear));
                            }
                          }}
                          className="rounded bg-black/40 border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <span>Day unknown (Month &amp; Year only)</span>
                      </label>
                    </div>

                    {/* Month Select */}
                    <div>
                      <label className="block text-[10px] font-mono-tech uppercase text-zinc-400 mb-1">
                        Month *
                      </label>
                      <select
                        value={batchMonth}
                        onChange={(e) => {
                          const m = parseInt(e.target.value, 10);
                          setBatchMonth(m);
                          setBatchDate(formatDateComponents(isBatchDayUnknown ? undefined : (typeof batchDay === 'number' ? batchDay : undefined), m, batchYear));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs font-mono-tech text-white focus:outline-none cursor-pointer"
                      >
                        {MONTH_NAMES.map((mName, idx) => (
                          <option key={mName} value={idx + 1}>
                            {mName} ({String(idx + 1).padStart(2, '0')})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Year Input */}
                    <div>
                      <label className="block text-[10px] font-mono-tech uppercase text-zinc-400 mb-1">
                        Year *
                      </label>
                      <input
                        type="number"
                        min={1990}
                        max={2035}
                        value={batchYear}
                        onChange={(e) => {
                          const y = parseInt(e.target.value, 10) || currentSet.graduationYear || 2026;
                          setBatchYear(y);
                          setBatchDate(formatDateComponents(isBatchDayUnknown ? undefined : (typeof batchDay === 'number' ? batchDay : undefined), batchMonth, y));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs font-mono-tech text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                    Event Category Narrative / Caption
                  </label>
                  <textarea
                    rows={2}
                    value={batchCaption}
                    onChange={(e) => setBatchCaption(e.target.value)}
                    placeholder="e.g. Unforgettable memories as we wore our convocation gowns and celebrated our collective perseverance."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none"
                  />
                </div>

                {/* Upload Images Under Event Category */}
                <div className="p-5 rounded-2xl bg-[#08090e] border border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 block">
                        Upload Photos for this Category ({batchImages.length} ready)
                      </label>
                      <span className="text-[10px] font-mono-tech text-zinc-500">
                        Multi-file selection supported with automatic image optimization.
                      </span>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={batchFileInputRef}
                    multiple
                    accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                    onChange={(e) => handleBatchFilesUpload(e.target.files)}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => batchFileInputRef.current?.click()}
                      disabled={isCompressingBatch}
                      className="py-2.5 px-5 rounded-full bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-colors flex items-center gap-2 cursor-pointer shadow"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isCompressingBatch ? 'Processing Category Photos...' : 'Select Multiple Photos'}</span>
                    </button>
                  </div>

                  {/* Category Images Queue */}
                  {batchImages.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <span className="text-[11px] font-mono-tech text-zinc-400">
                        Draft Category Photos ({batchImages.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {batchImages.map((img, index) => (
                          <div
                            key={index}
                            className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-3"
                          >
                            <img
                              src={img.url}
                              alt={`Draft photo ${index + 1}`}
                              className="w-16 h-16 rounded-lg object-cover border border-white/15 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-mono-tech text-zinc-400">
                                <span className="font-semibold text-white">Photo #{index + 1}</span>
                                <div className="flex items-center gap-2">
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
                                    className="text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1"
                                    title="Crop photo"
                                  >
                                    <Crop className="w-2.5 h-2.5" />
                                    <span>Crop</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBatchImages(batchImages.filter((_, i) => i !== index));
                                    }}
                                    className="text-red-400 hover:text-red-300 cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={!batchCategory.trim() || batchImages.length === 0}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-tech text-xs tracking-wider uppercase font-bold py-3 px-6 rounded-full transition-colors cursor-pointer shadow"
                  >
                    Save Moments Category ({batchImages.length} Photos)
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddingBatch(false)}
                    className="py-3 px-5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Hidden Input for Replacing a Single Image in Any Category */}
            <input
              type="file"
              ref={replaceImageInputRef}
              accept="image/*"
              onChange={(e) => handleExecuteImageReplacement(e.target.files)}
              className="hidden"
            />

            {/* CATEGORIES LIST & HIERARCHICAL REORDERING */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono-tech text-zinc-400 px-1">
                <span>
                  Showing {currentSet.memories.length} Categories (Ordered Hierarchically)
                </span>
                <span className="text-[11px] text-zinc-500">
                  Use the Up &amp; Down arrows to rearrange category display order.
                </span>
              </div>

              {currentSet.memories.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#0c0d14] border border-white/10 space-y-3">
                  <Camera className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-sm font-syne text-white">No Moments Categories Created Yet</p>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Click "Create New Category" to upload a series of photos under a single milestone event like Sign-out Day or Project Defenses.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentSet.memories.map((batch, index) => {
                    const isFirst = index === 0;
                    const isLast = index === currentSet.memories.length - 1;
                    const isAppending = activeAppendBatchId === batch.id;
                    const isCollapsed = collapsedCategories[batch.id] === true;

                    return (
                      <div
                        key={batch.id}
                        id={`category-row-${batch.id}`}
                        className="p-5 rounded-3xl bg-[#0c0d14] border border-white/10 hover:border-white/20 transition-all space-y-4 shadow-lg"
                      >
                        {/* Category Header Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-white/10 text-white font-mono-tech font-bold text-xs flex items-center justify-center shrink-0 border border-white/15">
                              #{index + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-syne font-bold text-base text-white">
                                  {batch.title}
                                </h4>
                                <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono-tech uppercase text-zinc-300">
                                  {batch.eventTag}
                                </span>
                                {(batch.isConvocationBatch || batch.eventTag === 'Convocation') && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono-tech text-emerald-300 font-bold flex items-center gap-1">
                                    <Bell className="w-3 h-3" />
                                    Annual Reminder Trigger
                                  </span>
                                )}
                                {batch.dateStr && (
                                  <span className="text-xs font-mono-tech text-zinc-400">
                                    • {batch.dateStr}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono-tech text-zinc-400 mt-0.5">
                                {batch.images.length} photo{batch.images.length > 1 ? 's' : ''} in this category
                              </p>
                            </div>
                          </div>

                          {/* Reordering Controls, Collapse Toggle & Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                            <button
                              id={`move-batch-up-${batch.id}`}
                              disabled={isFirst}
                              onClick={() => handleMoveBatch(batch.id, 'up')}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 disabled:opacity-20 text-white transition-colors cursor-pointer"
                              title="Move category up in album hierarchy"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>

                            <button
                              id={`move-batch-down-${batch.id}`}
                              disabled={isLast}
                              onClick={() => handleMoveBatch(batch.id, 'down')}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 disabled:opacity-20 text-white transition-colors cursor-pointer"
                              title="Move category down in album hierarchy"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>

                            <button
                              id={`append-to-batch-btn-${batch.id}`}
                              onClick={() => {
                                if (isCollapsed) toggleCategoryCollapse(batch.id);
                                setActiveAppendBatchId(isAppending ? null : batch.id);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer flex items-center gap-1"
                              title="Add more photos to this category"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isAppending ? 'Close' : 'Add Photos'}</span>
                            </button>

                            <button
                              onClick={() => handleDeleteBatch(batch.id)}
                              className="p-2 rounded-xl hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            {/* Arrow navigation for swipable image track */}
                            {batch.images.length > 1 && (
                              <div className="flex items-center gap-1 bg-white/5 rounded-xl p-0.5 border border-white/10">
                                <button
                                  type="button"
                                  onClick={() => scrollBatchTrack(batch.id, 'left')}
                                  className="p-1.5 rounded-lg hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                  title="Scroll images left"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => scrollBatchTrack(batch.id, 'right')}
                                  className="p-1.5 rounded-lg hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                  title="Scroll images right"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Collapse/Expand Toggle Button */}
                            <button
                              type="button"
                              onClick={() => toggleCategoryCollapse(batch.id)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer ml-0.5"
                              title={isCollapsed ? 'Expand category gallery' : 'Collapse category gallery'}
                            >
                              {isCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ChevronUp className="w-4 h-4 text-zinc-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Collapsed Compact Preview Bar */}
                        {isCollapsed ? (
                          <div
                            onClick={() => toggleCategoryCollapse(batch.id)}
                            className="py-3 px-4 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/5 flex items-center justify-between text-xs font-mono-tech text-zinc-400 cursor-pointer transition-colors"
                          >
                            <span>{batch.images.length} photo{batch.images.length > 1 ? 's' : ''} saved in this category</span>
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                              <span>Expand to view &amp; manage photos</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* Category Narrative / Caption */}
                            {(batch.caption || batch.images[0]?.caption) && (
                              <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1">
                                <div className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                                  Category Narrative
                                </div>
                                <p className="font-body text-xs sm:text-sm text-zinc-200 italic">
                                  "{batch.caption || batch.images[0]?.caption}"
                                </p>
                              </div>
                            )}

                            {/* Inline Append Form if Active */}
                            {isAppending && (
                              <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-3 animate-fadeIn">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-mono-tech uppercase tracking-wider text-emerald-400 font-bold">
                                    Append Photos to "{batch.title}"
                                  </span>
                                  <button
                                    onClick={() => setActiveAppendBatchId(null)}
                                    className="text-zinc-500 hover:text-white"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                <input
                                  type="file"
                                  ref={appendFileInputRef}
                                  multiple
                                  accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                                  onChange={(e) => handleAppendFilesToExistingBatch(e.target.files, batch.id)}
                                  className="hidden"
                                />

                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => appendFileInputRef.current?.click()}
                                    disabled={isCompressingBatch}
                                    className="py-2 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-tech text-xs tracking-wider uppercase font-bold transition-colors flex items-center gap-2 cursor-pointer shadow"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>{isCompressingBatch ? 'Processing Photos...' : 'Select Photos to Append'}</span>
                                  </button>
                                  <span className="text-zinc-500 font-mono-tech text-xs">
                                    Selected photos will instantly be optimized and added to this category.
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Swipable Image Cards (University Directory Style) with In-Place Caption Editing, Image Replace & Remove */}
                            <div
                              id={`batch-scroll-${batch.id}`}
                              className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory focus:outline-none"
                              style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
                            >
                              {batch.images.map((img, imgIdx) => (
                                <div
                                  key={img.id || imgIdx}
                                  className="w-[230px] sm:w-[260px] shrink-0 snap-start rounded-2xl bg-black/60 border border-white/10 hover:border-white/25 p-3 flex flex-col justify-between space-y-3 shadow-lg relative group transition-all"
                                >
                                  {/* Square aspect ratio photo */}
                                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border border-white/10 group-hover:border-white/20">
                                    <img
                                      src={img.url}
                                      alt={img.caption || `Photo ${imgIdx + 1}`}
                                      className="w-full h-full object-cover filter contrast-[1.05] group-hover:scale-105 transition-transform duration-300"
                                    />

                                    {/* Top bar: Order Tag & Move Left/Right Controls */}
                                    <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-none z-10">
                                      <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-mono-tech text-white font-bold pointer-events-auto">
                                        #{imgIdx + 1}
                                      </span>
                                      <div className="flex items-center gap-1 pointer-events-auto">
                                        <button
                                          type="button"
                                          disabled={imgIdx === 0}
                                          onClick={() => handleMoveImageInCategory(batch.id, imgIdx, 'left')}
                                          className="p-1 rounded-md bg-black/80 hover:bg-white/20 text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed border border-white/10 transition-colors"
                                          title="Move photo left"
                                        >
                                          <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={imgIdx === batch.images.length - 1}
                                          onClick={() => handleMoveImageInCategory(batch.id, imgIdx, 'right')}
                                          className="p-1 rounded-md bg-black/80 hover:bg-white/20 text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed border border-white/10 transition-colors"
                                          title="Move photo right"
                                        >
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Direct Controls Below Each Photo: Frame/Crop, Replace Image, Remove */}
                                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">

                                      <button
                                        type="button"
                                        onClick={() => {
                                          triggerCropForImage(
                                            img.url,
                                            'free',
                                            'Crop Moment Photo',
                                            (croppedUrl) => {
                                              const updatedMemories = currentSet.memories.map((m) => {
                                                if (m.id === batch.id) {
                                                  const updatedImages = [...m.images];
                                                  if (updatedImages[imgIdx]) {
                                                    updatedImages[imgIdx] = {
                                                      ...updatedImages[imgIdx],
                                                      url: croppedUrl,
                                                    };
                                                  }
                                                  return { ...m, images: updatedImages };
                                                }
                                                return m;
                                              });
                                              onUpdateSet({ ...currentSet, memories: updatedMemories });
                                              setHierarchyToast('✓ Image cropped and saved!');
                                              setTimeout(() => setHierarchyToast(null), 3000);
                                            }
                                          );
                                        }}
                                        className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[10px] font-mono-tech flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Crop photo"
                                      >
                                        <Crop className="w-3 h-3 text-amber-400" />
                                        <span>Crop</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleTriggerReplaceImage(batch.id, imgIdx)}
                                        className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[10px] font-mono-tech flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Replace photo"
                                      >
                                        <RefreshCw className="w-3 h-3 text-sky-400" />
                                        <span>Replace</span>
                                      </button>

                                      {batch.images.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteImageFromBatch(batch.id, img.id)}
                                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-[10px] font-mono-tech transition-colors cursor-pointer ml-auto"
                                          title="Remove photo from category"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )}

        {/* =========================================================================
            TAB 3: AWARDS MANAGEMENT
            ========================================================================= */}
        {activeTab === 'awards' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-syne font-bold text-xl text-white">
                  Class Awards & Superlatives ({currentSet.awards.length})
                </h3>
                <p className="font-body text-xs text-zinc-400 mt-1">
                  Celebrate classmates with superlative trophies, cropped portraits, and citations. All edits immediately update on the general album view.
                </p>
              </div>

              <button
                onClick={() => {
                  if (isAddingAward) {
                    setIsAddingAward(false);
                    setEditingAwardId(null);
                    setAwardCategory('');
                    setAwardWinnerName('');
                    setAwardWinnerNickname('');
                    setAwardAvatar('');
                    setAwardCitation('');
                  } else {
                    setEditingAwardId(null);
                    setIsAddingAward(true);
                  }
                }}
                className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-2.5 px-5 rounded-full flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingAward ? 'Cancel' : 'Add Award'}</span>
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
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-syne font-bold text-sm text-white">
                    {editingAwardId ? 'Edit Class Award' : 'Add New Class Award'}
                  </span>
                  {editingAwardId && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono-tech text-[10px] uppercase tracking-wider font-semibold">
                      Editing Mode
                    </span>
                  )}
                </div>

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

                  <p className="font-mono-tech text-[11px] text-zinc-400">
                    Selecting an approved profile automatically populates both the recipient's name and portrait photo.
                  </p>

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
                        Open Classmate Window →
                      </span>
                    </button>
                  )}
                </div>

                {/* Recipient Photo / Avatar Upload & Crop */}
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="w-16 h-16 rounded-2xl bg-black border border-white/20 overflow-hidden relative group shrink-0 flex items-center justify-center">
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
                  <div className="space-y-1.5 flex-1">
                    <span className="font-mono-tech text-xs text-white font-semibold block">
                      Recipient Portrait Photo
                    </span>
                    <p className="font-mono-tech text-[10px] text-zinc-400">
                      Upload and crop a clean portrait or square avatar for this award winner.
                    </p>
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
                                setHierarchyToast('✓ Winner photo cropped successfully!');
                                setTimeout(() => setHierarchyToast(null), 3000);
                              }
                            );
                          }}
                          className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 font-mono-tech text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Crop className="w-3 h-3 text-amber-400" />
                          <span>Re-crop</span>
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
                      placeholder="e.g. Pioneer of the Year"
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
                      placeholder="e.g. Amina Bello"
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
                      placeholder="e.g. Bayo"
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
                  <input
                    type="text"
                    value={awardCitation}
                    onChange={(e) => setAwardCitation(e.target.value)}
                    placeholder="e.g. For unwavering commitment to mentoring junior students throughout 4 years."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-3 px-6 rounded-full transition-colors cursor-pointer"
                  >
                    {editingAwardId ? 'Update Award on Album' : 'Save Class Award'}
                  </button>
                  {editingAwardId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAwardId(null);
                        setAwardCategory('');
                        setAwardWinnerName('');
                        setAwardWinnerNickname('');
                        setAwardAvatar('');
                        setAwardCitation('');
                        setIsAddingAward(false);
                      }}
                      className="px-4 py-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </UniversalModal>
          )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentSet.awards.map((award) => {
                const visual = getAwardVisualConfig(award.trophyType);
                const AwardIcon = visual.icon;
                return (
                  <div key={award.id} className="p-5 rounded-2xl bg-[#0c0d14] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4 shadow-md">
                    <div>
                      {/* Top Row: Award Trophy Visual Icon without text label */}
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-11 h-11 ${visual.shapeClass} flex items-center justify-center shrink-0 ${visual.glowClass}`}>
                          <AwardIcon className={`w-5 h-5 ${visual.iconColor} ${visual.type === 'crystal' ? '-rotate-45' : ''}`} />
                        </div>
                      </div>

                      <h3 className="font-syne font-bold text-lg text-white leading-snug">
                        {award.category}
                      </h3>

                      {/* Winner Profile Snippet - Size matches album view side (w-16 h-16 sm:w-20 sm:h-20) */}
                      <div className="flex items-center gap-3.5 mt-4 pt-3.5 border-t border-white/[0.08]">
                        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 ${visual.borderClass} ${visual.glowClass} bg-zinc-900`}>
                          {award.winnerAvatar ? (
                            <img
                              src={award.winnerAvatar}
                              alt={award.winnerName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Trophy className="w-6 h-6 text-[#d4af37]" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-syne font-bold text-base sm:text-lg text-white truncate">
                            {award.winnerName}
                          </h4>
                          {award.winnerNickname && (
                            <p className="font-mono-tech text-xs text-[#d4af37] font-semibold truncate mt-0.5">
                              “{award.winnerNickname}”
                            </p>
                          )}
                          <span className="inline-block mt-1 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                            Award Laureate
                          </span>
                        </div>
                      </div>

                      <p className="font-body text-xs text-zinc-300 italic mt-4 pt-3 border-t border-white/5 leading-relaxed">
                        “{award.citation}”
                      </p>
                    </div>

                  {/* Actions: Edit, Delete */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenEditAwardModal(award)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[11px] font-mono-tech flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit award details"
                    >
                      <Edit3 className="w-3 h-3 text-emerald-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteAward(award.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete award"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: FINAL THOUGHTS (LECTURERS & STUDENT LEADERS)
            ========================================================================= */}
        {activeTab === 'voices' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-syne font-bold text-xl text-white">
                  Final Thoughts ({currentSet.voices.length})
                </h3>
                <p className="font-body text-xs text-zinc-400 mt-1">
                  Parting wisdom, farewell messages, and words of encouragement from lecturers and student leaders.
                </p>
              </div>

              <button
                onClick={() => {
                  if (isAddingVoice) {
                    setIsAddingVoice(false);
                    setVoiceLecturerName('');
                    setVoiceTitle('');
                    setVoicePartingQuote('');
                    setVoiceHeadshotUrl('');
                    setSelectedVoiceStudentId(null);
                  } else {
                    setIsAddingVoice(true);
                  }
                }}
                className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-2.5 px-5 rounded-full flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingVoice ? 'Cancel' : 'Add Final Thought'}</span>
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
                  setSelectedVoiceStudentId(null);
                }}
                title="Add Final Thought & Parting Words"
                subtitle="Parting wisdom, farewell messages, and words of encouragement from lecturers or student leaders"
                maxWidth="lg"
              >
                <form onSubmit={handleSaveVoice} className="space-y-4 text-xs font-body">

                {/* Profile Selector from Approved Student Leaders with Pocket Modal */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span>Autofill from Approved Student Leader (Optional)</span>
                    </label>
                    <span className="text-[10px] font-mono-tech text-amber-400/80 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      {approvedStudentLeaders.length} Student Leaders Available
                    </span>
                  </div>

                  <p className="font-mono-tech text-[11px] text-zinc-400">
                    Selecting an approved student leader automatically populates both their name, leadership role, and headshot image.
                  </p>

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
                            {voiceTitle || 'Student Leader'} • Auto-populated from profile
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
                        <span>Choose Student Leader ({approvedStudentLeaders.length})</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 text-[10px] uppercase font-bold">
                        Open Leader Window →
                      </span>
                    </button>
                  )}
                </div>

                {/* Speaker Photo / Headshot Upload & Crop */}
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="w-16 h-16 rounded-2xl bg-black border border-white/20 overflow-hidden relative group shrink-0 flex items-center justify-center">
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
                  <div className="space-y-1.5 flex-1">
                    <span className="font-mono-tech text-xs text-white font-semibold block">
                      Leader or Lecturer Portrait / Headshot
                    </span>
                    <p className="font-mono-tech text-[10px] text-zinc-400">
                      Upload a clean portrait or headshot for this contributor.
                    </p>
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
                              'Crop Leader Headshot',
                              (croppedUrl) => {
                                setVoiceHeadshotUrl(croppedUrl);
                                setHierarchyToast('✓ Headshot cropped successfully!');
                                setTimeout(() => setHierarchyToast(null), 3000);
                              }
                            );
                          }}
                          className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 font-mono-tech text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Crop className="w-3 h-3 text-amber-400" />
                          <span>Re-crop</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                      Lecturer or Student Leader Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={voiceLecturerName}
                      onChange={(e) => setVoiceLecturerName(e.target.value)}
                      placeholder="e.g. Prof. O. Balogun or Oluwaseun Adeleke"
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
                      placeholder="e.g. HOD, Level Adviser, Department President, Tech Lead"
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
                    rows={2}
                    value={voicePartingQuote}
                    onChange={(e) => setVoicePartingQuote(e.target.value)}
                    placeholder="Carry the discipline and brotherhood we forged in these lecture halls into every sphere of your life."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none font-body"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-3 px-6 rounded-full transition-colors cursor-pointer"
                  >
                    Save Final Thought
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingVoice(false);
                      setVoiceLecturerName('');
                      setVoiceTitle('');
                      setVoicePartingQuote('');
                      setVoiceHeadshotUrl('');
                      setSelectedVoiceStudentId(null);
                    }}
                    className="px-4 py-2.5 rounded-full border border-white/20 text-zinc-300 hover:text-white hover:bg-white/10 font-mono-tech text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </UniversalModal>
          )}

            <div className="space-y-3">
              {currentSet.voices.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                  <p className="font-syne font-semibold text-xs text-zinc-300">
                    No final thoughts added yet
                  </p>
                  <p className="font-mono-tech text-[11px] text-zinc-500">
                    Add parting words, farewell messages, and advice from departmental lecturers and student leaders.
                  </p>
                </div>
              ) : (
                currentSet.voices.map((voice) => (
                  <div key={voice.id} className="p-5 rounded-2xl bg-[#0c0d14] border border-white/10 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <img
                        src={voice.headshotUrl}
                        alt={voice.lecturerName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-white/20 filter grayscale shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-syne font-bold text-sm text-white truncate">{voice.lecturerName}</h4>
                        <p className="font-mono-tech text-xs text-amber-300">{voice.title}</p>
                        <p className="font-body text-xs text-zinc-300 italic mt-1.5 leading-relaxed">"{voice.partingQuote}"</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditVoiceModal(voice)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[11px] font-mono-tech flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Edit final thought details"
                      >
                        <Edit3 className="w-3 h-3 text-emerald-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteVoice(voice.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete thought"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: OUR STORY EDITOR
            ========================================================================= */}
        {activeTab === 'story' && (
          <div className="p-8 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-5 text-xs font-body">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-syne font-bold text-lg text-white">
                  Our Set Story Narrative
                </h3>
                <p className="font-body text-xs text-zinc-400 mt-0.5">
                  Chronicle the collective journey, matriculation memories, and final year triumphs of your class.
                </p>
              </div>

              {storySaved && (
                <span className="text-emerald-400 font-mono-tech text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>

            <textarea
              rows={8}
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl bg-[#08090e] border border-white/10 text-white font-body text-sm leading-relaxed focus:border-white/30 focus:outline-none"
            />

            <button
              onClick={handleSaveStory}
              className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-3 px-6 rounded-full transition-colors cursor-pointer"
            >
              Update Our Story
            </button>
          </div>
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
        title="Select Student Leader"
        subtitle="Only approved executive and student leaders appear in this list"
        students={approvedStudentLeaders}
        selectedId={selectedVoiceStudentId}
        mode="leader"
        onSelect={(student) => {
          setSelectedVoiceStudentId(student.id);
          setVoiceLecturerName(student.fullName);
          setVoiceTitle(student.position || 'Student Leader');
          if (student.photoUrl) setVoiceHeadshotUrl(student.photoUrl);
          if (student.quote) setVoicePartingQuote(student.quote);
          setHierarchyToast(`✓ Populated student leader voice with ${student.fullName}`);
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

      {/* Save Album to Cloud Modal for Dashboard */}
      {isSaveToCloudOpen && (
        <SaveAlbumToCloudModal
          isOpen={isSaveToCloudOpen}
          onClose={() => setIsSaveToCloudOpen(false)}
          currentSet={currentSet}
        />
      )}

      {/* Share Published Album Modal with Hero Context Preview */}
      {isShareAlbumModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn select-none"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0c0d14] border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-white">Edit Class Award</h3>
                  <p className="font-mono-tech text-[11px] text-zinc-400">Update award recipient, trophy, or citation</p>
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
                  Award Citation / Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={editingAwardModalItem.citation || ''}
                  onChange={(e) =>
                    setEditingAwardModalItem({ ...editingAwardModalItem, citation: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingAwardModalItem(null)}
                  className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase shadow-md cursor-pointer"
                >
                  Update Award
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Window: Edit Final Thought Modal */}
      {editingVoiceModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0c0d14] border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Quote className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-white">Edit Final Thought</h3>
                  <p className="font-mono-tech text-[11px] text-zinc-400">Update contributor message, role, or photo</p>
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
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/30 filter grayscale shadow-md shrink-0"
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
                  Lecturer or Leader Name *
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
                  Parting Words &amp; Wisdom *
                </label>
                <textarea
                  required
                  rows={3}
                  value={editingVoiceModalItem.partingQuote}
                  onChange={(e) =>
                    setEditingVoiceModalItem({ ...editingVoiceModalItem, partingQuote: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/10 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none resize-none font-body"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingVoiceModalItem(null)}
                  className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase shadow-md cursor-pointer"
                >
                  Update Final Thought
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
