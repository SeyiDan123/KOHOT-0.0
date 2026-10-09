import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ClassSet, 
  StudentProfile, 
  MemoryEvent, 
  AwardItem, 
  VoiceItem 
} from '../../types';
import { 
  Users, 
  Camera, 
  Trophy, 
  Quote, 
  BookOpen, 
  ArrowLeft, 
  ArrowRight,
  Search, 
  Share2, 
  ExternalLink, 
  Sparkles, 
  Check, 
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Plus,
  ShieldCheck,
  Crown,
  X,
  ArrowDownAZ,
  Youtube,
  Instagram,
  Twitter,
  Linkedin,
  Globe,
  Play,
  Sliders,
  Eye,
  Film,
  ArrowUp,
  HardDrive,
  Cloud,
  Loader2,
  GraduationCap,
  Edit2,
  Trash2,
  Upload,
  QrCode,
  Sun,
  Moon
} from 'lucide-react';
import { StudentDetailModal } from './StudentDetailModal';
import { FrictionlessSubmitModal } from './FrictionlessSubmitModal';
import { SaveAlbumToCloudModal } from './SaveAlbumToCloudModal';
import { DepartmentVideoModal } from './DepartmentVideoModal';
import { AlbumAdminSwitcher } from '../common/AlbumAdminSwitcher';
import { AlbumDisputeModal } from '../admin/AlbumDisputeModal';
import { useFeedback } from '../common/FeedbackSystem';
import { getAlbumUrl, copyUrlToClipboard } from '../../utils/urlHelper';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { GlazedImage } from '../common/GlazedImage';
import { getYouTubeThumbnailUrl } from '../../utils/youtube';
import { updateSocialMetaTags } from '../../utils/metaTags';
import { saveAlbumShortcutToDrive } from '../../utils/googleDriveHelper';
import { getAwardVisualConfig } from '../../utils/awardVisuals';
import { getLuxuryThemeById, DarkLuxuryTheme, LUXURY_PAPER_TEXTURE_SVG } from '../../utils/luxuryThemes';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { getTheme, applyTheme } from '../../utils/theme';
import { 
  isLeaderProfile, 
  sortLeadersByHierarchy, 
  sortProfilesAlphabetically, 
  calculateIntuitiveHierarchyRank,
  getLeaderRank
} from '../../utils/leadershipHierarchy';
import { DepartmentVideoItem, WebsiteContentOverride } from '../../types';

// 4-Second Count-Up Animation Hook for Album Hero Statistics
const useCountUp = (target: number, durationMs = 4000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, durationMs]);

  return count;
};

interface DepartmentAlbumViewProps {
  currentSet: ClassSet;
  contentOverride?: WebsiteContentOverride;
  onBackToGrid: () => void;
  onUpdateSet: (updatedSet: ClassSet) => void;
  onBackToLanding?: () => void;
  onManageAlbum?: () => void;
  onReturnToMyAlbum?: () => void;
  isAdmin?: boolean;
  isCurrentAlbumOwner?: boolean;
  isViewingOtherAlbum?: boolean;
  originView?: 'landing' | 'albums_grid' | 'layer0_master' | 'layer1_rep';
  inviteContext?: {
    inviteCode: string;
    departmentId: string;
    universityId?: string;
    targetYear: number;
    fromYear: number;
  } | null;
  onOpenOnboardingWithInvite?: (invite: {
    inviteCode: string;
    departmentId: string;
    universityId?: string;
    targetYear: number;
    fromYear: number;
  }) => void;
  onMainDashboard?: () => void;
  showMainButton?: boolean;
}

export const DepartmentAlbumView: React.FC<DepartmentAlbumViewProps> = ({
  currentSet,
  contentOverride,
  onBackToGrid,
  onUpdateSet,
  onBackToLanding,
  onManageAlbum,
  onReturnToMyAlbum,
  isAdmin,
  isCurrentAlbumOwner = true,
  isViewingOtherAlbum = false,
  originView,
  inviteContext,
  onOpenOnboardingWithInvite,
  onMainDashboard,
  showMainButton,
}) => {
  const isAlbumAdmin = Boolean(isAdmin);

  // Detect if entry is from physical Legacy Plaque QR code
  const isPlaqueMode = useMemo(() => {
    try {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      return params.get('entry') === 'plaque' || params.get('source') === 'plaque';
    } catch (e) {
      return false;
    }
  }, []);

  const privacy = currentSet.plaquePrivacy || {};
  const showGraduates = !isPlaqueMode || !privacy.hideStudents;
  const showMemories = !isPlaqueMode || !privacy.hideMemories;
  const showAwards = !isPlaqueMode || !privacy.hideAwards;
  const showVoices = !isPlaqueMode || !privacy.hideVoices;
  const showStory = !isPlaqueMode || !privacy.hideStory;
  const showVideos = !isPlaqueMode || !privacy.hideVideos;

  // Real-time synced dark luxury themes from Owner Dashboard
  const [liveThemeOverride, setLiveThemeOverride] = useState<DarkLuxuryTheme[] | null>(null);

  useEffect(() => {
    const handleThemesSync = (e: any) => {
      if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setLiveThemeOverride(e.detail);
      }
    };
    window.addEventListener('kohot_luxury_themes_updated', handleThemesSync);
    return () => window.removeEventListener('kohot_luxury_themes_updated', handleThemesSync);
  }, []);

  // Active Dark Luxury Background Theme
  const currentTheme = useMemo(() => {
    const list = liveThemeOverride || (contentOverride?.darkLuxuryBackgrounds as any);
    return getLuxuryThemeById(currentSet.backgroundThemeId, list);
  }, [currentSet.backgroundThemeId, contentOverride?.darkLuxuryBackgrounds, liveThemeOverride]);

  // Navigation & Filter States - Respects album admin preview context spot
  const [activeTab, setActiveTab] = useState<'graduates' | 'memories' | 'awards' | 'voices' | 'story' | 'videos'>(() => {
    try {
      const previewTab = sessionStorage.getItem('kohot_album_preview_tab');
      if (previewTab && ['graduates', 'memories', 'awards', 'voices', 'story', 'videos'].includes(previewTab)) {
        return previewTab as any;
      }
    } catch (e) {}
    return 'graduates';
  });

  // Handle in-context preview positioning when navigating from admin dashboard
  useEffect(() => {
    try {
      const previewTab = sessionStorage.getItem('kohot_album_preview_tab');
      const targetId = sessionStorage.getItem('kohot_album_preview_target_id');
      if (previewTab) {
        sessionStorage.removeItem('kohot_album_preview_tab');
        if (targetId) {
          sessionStorage.removeItem('kohot_album_preview_target_id');
          setTimeout(() => {
            const el = document.getElementById(`student-card-${targetId}`) || document.getElementById(`award-card-${targetId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return;
            }
          }, 350);
        } else {
          setTimeout(() => {
            const clipsBar = document.getElementById('album-clips-bar');
            if (clipsBar) {
              clipsBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 350);
        }
      }
    } catch (e) {}
  }, []);

  // Fallback to first permitted tab if current activeTab is hidden by plaque privacy
  useEffect(() => {
    if (isPlaqueMode) {
      if (activeTab === 'graduates' && !showGraduates) {
        if (showMemories) setActiveTab('memories');
        else if (showAwards) setActiveTab('awards');
        else if (showVoices) setActiveTab('voices');
        else if (showStory) setActiveTab('story');
      }
    }
  }, [isPlaqueMode, showGraduates, showMemories, showAwards, showVoices, showStory, activeTab]);

  const [cohortFilter, setCohortFilter] = useState<'all' | 'leaders' | 'members'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { showSuccess } = useFeedback();
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [selectedMemoryCategory, setSelectedMemoryCategory] = useState<string>('All');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaveToCloudOpen, setIsSaveToCloudOpen] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveNotification, setDriveNotification] = useState<{ message: string; success: boolean; url?: string } | null>(null);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<DepartmentVideoItem | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // 4-Image Cross-Fade Banner before footer (Editable via Owner Dashboard under KoHot Media)
  const legacyBannerImages = useMemo(() => {
    if (contentOverride?.legacyBannerImages && contentOverride.legacyBannerImages.length === 4) {
      return contentOverride.legacyBannerImages;
    }
    return [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1627556704302-624286467c65?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?q=80&w=1600&auto=format&fit=crop',
    ];
  }, [contentOverride?.legacyBannerImages]);

  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % legacyBannerImages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [legacyBannerImages.length]);

  // Context-Aware Light / Dark Mode State with localStorage Persistence (Default: Light Mode)
  const [isLightMode, setIsLightMode] = useState<boolean>(() => getTheme() === 'light');

  // Synchronize HTML & Body backgrounds with current light/dark mode - completely eliminates zoom glitch
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isLightMode) {
      document.documentElement.classList.add('light-mode');
      document.documentElement.style.backgroundColor = '#f8fafc';
      document.body.style.backgroundColor = '#f8fafc';
      document.body.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
      document.documentElement.style.backgroundColor = '#08090d';
      document.body.style.backgroundColor = '#08090d';
      document.body.classList.remove('light-mode');
    }
    return () => {
      document.documentElement.classList.remove('light-mode');
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      document.body.classList.remove('light-mode');
    };
  }, [isLightMode]);

  const toggleLightMode = () => {
    setIsLightMode((prev) => {
      const next = !prev;
      applyTheme(next ? 'light' : 'dark');
      try {
        localStorage.setItem('kohot_album_theme', next ? 'light' : 'dark');
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Continual Flow Moments Fullscreen Lightbox state
  const [lightboxMomentsList, setLightboxMomentsList] = useState<Array<{
    id: string;
    url: string;
    caption?: string;
    eventId: string;
    title: string;
    categoryTitle?: string;
    categoryIndex?: number;
    totalCategories?: number;
    imageIndexInCategory?: number;
    totalImagesInCategory?: number;
  }>>([]);
  const [lightboxMomentIndex, setLightboxMomentIndex] = useState<number | null>(null);
  const [momentZoomScale, setMomentZoomScale] = useState<number>(1);
  const [momentPanPos, setMomentPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const momentTouchDistRef = useRef<number | null>(null);
  const momentLastScaleRef = useRef<number>(1);
  const momentLastTapRef = useRef<number>(0);
  const isDraggingMomentRef = useRef(false);
  const dragMomentStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });
  const hasMomentDraggedRef = useRef(false);

  // Preference of light or dark view of the moments full view card on the album
  const [momentCardMode, setMomentCardMode] = useState<'light' | 'dark'>(isLightMode ? 'light' : 'dark');

  // Keep card mode in sync with theme switches
  useEffect(() => {
    setMomentCardMode(isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  // Lock static background and body scroll when any modal or lightbox is open
  useStaticBackdropScrollLock(
    lightboxMomentIndex !== null ||
    Boolean(selectedStudent) ||
    isVideoModalOpen ||
    isDisputeModalOpen
  );

  const handleLightboxNext = () => {
    if (lightboxMomentIndex === null || lightboxMomentsList.length === 0) return;
    setMomentZoomScale(1);
    setMomentPanPos({ x: 0, y: 0 });
    setLightboxMomentIndex((lightboxMomentIndex + 1) % lightboxMomentsList.length);
  };

  const handleLightboxPrev = () => {
    if (lightboxMomentIndex === null || lightboxMomentsList.length === 0) return;
    setMomentZoomScale(1);
    setMomentPanPos({ x: 0, y: 0 });
    setLightboxMomentIndex((lightboxMomentIndex - 1 + lightboxMomentsList.length) % lightboxMomentsList.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxMomentIndex === null) return;
      if (e.key === 'Escape') setLightboxMomentIndex(null);
      if (e.key === 'ArrowRight') handleLightboxNext();
      if (e.key === 'ArrowLeft') handleLightboxPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxMomentIndex, lightboxMomentsList]);

  const handleHeaderSaveToDrive = async () => {
    setIsSavingToDrive(true);
    setDriveNotification(null);
    try {
      const res = await saveAlbumShortcutToDrive(currentSet);
      if (res.success) {
        setDriveNotification({
          success: true,
          message: 'Saved to your Google Drive! Clicking the shortcut in Drive opens this live album directly.',
          url: res.driveViewUrl,
        });
      } else if (res.cancelled) {
        setDriveNotification({
          success: false,
          message: 'Google permission request was cancelled.',
        });
      } else {
        setDriveNotification({
          success: false,
          message: res.error || 'Failed to save to Google Drive.',
        });
      }
    } catch (err: any) {
      setDriveNotification({
        success: false,
        message: err?.message || 'Could not connect to Google Drive.',
      });
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Sub-tab state for Moments & Highlights (Moments vs Highlights side-by-side)
  const [memoriesViewSubTab, setMemoriesViewSubTab] = useState<'moments' | 'highlights'>('moments');

  // If activeTab is 'videos' but no videos are present, fallback gracefully to 'graduates'
  useEffect(() => {
    if (activeTab === 'videos' && (!currentSet.videos || currentSet.videos.length === 0)) {
      setActiveTab('graduates');
    }
  }, [activeTab, currentSet.videos]);

  // Ensure viewing the album as a whole always starts from the hero section at the top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentSet.id]);

  // Ensure switching between album clips (people, moments, etc.) begins instantly from clips start
  const handleTabChange = (tab: 'graduates' | 'memories' | 'awards' | 'voices' | 'story' | 'videos') => {
    setActiveTab(tab);
    // Instant transition - scroll to clips content so the clicked section appears immediately in view
    const clipsBar = document.getElementById('album-clips-bar');
    if (clipsBar) {
      const rect = clipsBar.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - 62;
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
    }
  };

  // Update Social OpenGraph Meta Tags to use album hero image as thumbnail
  useEffect(() => {
    updateSocialMetaTags({
      title: `${currentSet.departmentName} - Class of ${currentSet.graduationYear} | KoHot Album`,
      description: `Official digital class album for ${currentSet.departmentName}, ${currentSet.institutionName}. Preserved permanently on KoHot.`,
      imageUrl: currentSet.bannerImageUrl,
      url: window.location.href,
    });
  }, [currentSet.departmentName, currentSet.graduationYear, currentSet.institutionName, currentSet.bannerImageUrl]);

  // Only display verified & approved students in the public album
  const approvedStudents = useMemo(() => {
    return (currentSet.students || []).filter((s) => s.approved !== false);
  }, [currentSet.students]);

  // Total count of leaders among approved profiles
  const totalLeadersCount = useMemo(() => {
    return approvedStudents.filter(isLeaderProfile).length;
  }, [approvedStudents]);

  // Animated 4-second count-up stats for album hero
  const animatedGraduates = useCountUp(approvedStudents.length, 4000);
  const totalAcademicYears = currentSet.academicYears || 4;
  const animatedYears = useCountUp(totalAcademicYears, 4000);

  // Filter and sort students:
  // - "all": sorted strictly alphabetically by full name
  // - "leaders": only profiles with leadership title, sorted by executive hierarchy
  // - search bar filters by name/nickname/role in real time
  const filteredStudents = useMemo(() => {
    let list: StudentProfile[];

    if (cohortFilter === 'leaders') {
      const leaders = approvedStudents.filter(isLeaderProfile);
      list = sortLeadersByHierarchy(leaders);
    } else {
      list = sortProfilesAlphabetically(approvedStudents);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q))
      );
    }

    return list;
  }, [approvedStudents, cohortFilter, searchQuery]);

  // Current student index in the filtered list (for lightbox Next/Prev)
  const currentStudentIndex = useMemo(() => {
    if (!selectedStudent) return -1;
    return filteredStudents.findIndex((s) => s.id === selectedStudent.id);
  }, [selectedStudent, filteredStudents]);

  const handleNextStudent = () => {
    if (currentStudentIndex >= 0 && currentStudentIndex < filteredStudents.length - 1) {
      setSelectedStudent(filteredStudents[currentStudentIndex + 1]);
    } else if (filteredStudents.length > 0) {
      setSelectedStudent(filteredStudents[0]);
    }
  };

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudent(filteredStudents[currentStudentIndex - 1]);
    } else if (filteredStudents.length > 0) {
      setSelectedStudent(filteredStudents[filteredStudents.length - 1]);
    }
  };

  // Filter memories by tag
  const uniqueEventTags = useMemo(() => {
    const set = new Set<string>();
    (currentSet.memories || []).forEach((m) => {
      if (m.eventTag) set.add(m.eventTag);
    });
    return Array.from(set);
  }, [currentSet.memories]);

  const filteredMemories = useMemo(() => {
    let list = currentSet.memories || [];
    if (selectedMemoryCategory !== 'All') {
      list = list.filter((m) => m.eventTag === selectedMemoryCategory);
    }
    // Sort memories by admin-defined hierarchical batch order (1, 2, 3...)
    return [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [currentSet.memories, selectedMemoryCategory]);

  const handleShareAlbum = async () => {
    const albumUrl = getAlbumUrl(currentSet);
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `${currentSet.departmentName} - Class of ${currentSet.graduationYear} Album`,
          text: `Explore the permanent Class Album for ${currentSet.departmentName} (${currentSet.institutionName}) on KoHot!`,
          url: albumUrl,
        });
      } catch (err) {
        // Native share was dismissed or cancelled by user, ignore
      }
    } else {
      await copyUrlToClipboard(albumUrl);
      setIsCopied(true);
      showSuccess('Album link copied to clipboard.', 'Share it with your classmates and alumni.');
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleAddNewStudent = (newStudent: StudentProfile) => {
    if (isViewingOtherAlbum || !isCurrentAlbumOwner) return;
    const hasTitle = isLeaderProfile(newStudent);
    const preparedStudent: StudentProfile = {
      ...newStudent,
      leaderOrder: hasTitle && !newStudent.leaderOrder
        ? calculateIntuitiveHierarchyRank(newStudent.position)
        : newStudent.leaderOrder,
    };
    const updated = {
      ...currentSet,
      students: [preparedStudent, ...currentSet.students],
    };
    onUpdateSet(updated);
  };

  // Restore scroll position when returning from Manage Album
  useEffect(() => {
    try {
      const savedPos = sessionStorage.getItem('kohot_album_scroll_pos');
      if (savedPos) {
        const pos = parseInt(savedPos, 10);
        if (!isNaN(pos) && pos > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: pos, behavior: 'instant' });
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleManageAlbumWithScroll = () => {
    try {
      sessionStorage.setItem('kohot_album_scroll_pos', String(window.scrollY));
    } catch (e) {
      // ignore
    }
    if (onManageAlbum) onManageAlbum();
  };

  return (
    <div 
      id="department-album-container"
      style={{
        background: isLightMode 
          ? '#f8fafc'
          : currentTheme.cssGradient,
      }}
      className={`min-h-screen font-body selection:bg-zinc-300 dark:selection:bg-zinc-700 selection:text-black dark:selection:text-white pb-0 relative animate-entrance ${
        isLightMode ? 'text-slate-900 bg-slate-50' : 'text-[#e2e4e9]'
      }`}
    >
      {/* Authentic Dark Luxury Texture Sheen */}
      {!isLightMode && currentTheme.textureUrl && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay z-0"
          style={{
            backgroundImage: `url(${currentTheme.textureUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      {/* Authentic Luxury Fine-Art Paper Texture on Light Grey Background */}
      {isLightMode && (
        <div 
          id="album-luxury-paper-texture"
          className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply z-0"
          style={{
            backgroundImage: `url(${LUXURY_PAPER_TEXTURE_SVG})`,
            backgroundRepeat: 'repeat',
            backgroundSize: '320px 320px',
          }}
        />
      )}

      {/* Legacy Plaque Mode Notice */}
      {isPlaqueMode && (
        <div 
          id="plaque-entry-banner"
          className="bg-amber-400/10 border-b border-amber-400/25 px-4 py-2 text-center text-xs font-mono-tech text-amber-300 flex items-center justify-center gap-2 relative z-50"
        >
          <QrCode className="w-4 h-4 text-amber-400" />
          <span>Legacy Plaque Archival View • Class of {currentSet.graduationYear}</span>
        </div>
      )}

      {/* =========================================================================
          TOP NAVIGATION BAR (Pixieset Simplicity + NeoVision Aesthetics)
          ========================================================================= */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors px-4 sm:px-8 py-3 sm:py-3.5 ${
        isLightMode 
          ? 'bg-white/95 border-slate-200 text-slate-900 shadow-sm' 
          : 'bg-[#060709]/85 border-white/[0.08] text-white'
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 relative">
          {/* Left: All Albums navigation button with arrow */}
          <button
            id="back-to-home-btn"
            onClick={onBackToGrid}
            className={`flex items-center gap-2.5 transition-colors cursor-pointer group shrink-0 ${
              isLightMode ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-300 hover:text-white'
            }`}
            title={
              originView === 'layer0_master'
                ? 'Return to Master Host Dashboard'
                : 'Return to All Albums'
            }
          >
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all shrink-0 ${
              isLightMode 
                ? 'bg-slate-100 group-hover:bg-slate-200 border-slate-300 text-slate-800' 
                : 'bg-white/5 group-hover:bg-white/10 border-white/10 text-zinc-300 group-hover:text-white'
            }`}>
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            <span className={`font-syne font-bold text-sm sm:text-base tracking-wide transition-colors ${
              isLightMode ? 'text-slate-900 group-hover:text-[#d4af37]' : 'text-white group-hover:text-[#d4af37]'
            }`}>
              All Albums
            </span>
          </button>

          {/* Center: The sticky transition buttons permanently centralized (Admin Only) */}
          {isAlbumAdmin && onManageAlbum && (
            <AlbumAdminSwitcher
              activeMode="preview"
              showMainButton={Boolean(showMainButton)}
              onMainDashboard={onMainDashboard}
              onManageAlbum={handleManageAlbumWithScroll}
              onPreviewAlbum={() => {
                if (isViewingOtherAlbum && onReturnToMyAlbum) {
                  onReturnToMyAlbum();
                }
              }}
              isViewingOtherAlbum={isViewingOtherAlbum}
            />
          )}

          {/* Right: Light Mode Toggle, Save & Share Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Context-Aware Light/Dark Mode Switcher beside Save icon */}
            <button
              id="album-theme-toggle-btn"
              type="button"
              onClick={toggleLightMode}
              className={`px-3 py-1.5 sm:py-2 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0 ${
                isLightMode 
                  ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900 font-tech text-xs tracking-wider uppercase font-semibold' 
                  : 'bg-white/[0.08] hover:bg-white/[0.15] border-white/20 text-white font-tech text-xs tracking-wider uppercase font-semibold'
              }`}
              title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Context-Aware Light Mode'}
              aria-label={isLightMode ? 'Switch to Dark Mode' : 'Switch to Context-Aware Light Mode'}
            >
              {isLightMode ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-zinc-800" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            <button
              id="album-save-drive-btn"
              onClick={() => setIsSaveToCloudOpen(true)}
              className={`px-3.5 py-1.5 sm:py-2 rounded-full border font-tech text-xs tracking-wider uppercase font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0 ${
                isLightMode 
                  ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900' 
                  : 'bg-white/[0.08] hover:bg-white/[0.15] border-white/20 text-white'
              }`}
              title="Save this live Class Album link to your cloud storage"
            >
              <Cloud className={`w-3.5 h-3.5 ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`} />
              <span>Save</span>
            </button>

            <button
              id="album-share-btn"
              onClick={handleShareAlbum}
              className={`px-3.5 py-1.5 sm:py-2 rounded-full font-tech text-xs tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0 ${
                isLightMode 
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-white' 
                  : 'bg-white hover:bg-zinc-200 text-black'
              }`}
              title="Share this album with classmates and alumni"
            >
              <Share2 className={`w-3.5 h-3.5 ${isLightMode ? 'text-white' : 'text-black'}`} />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Global Toast Notification for Drive Save */}
        {driveNotification && (
          <div 
            id="drive-notification-toast"
            className={`w-full max-w-5xl mx-auto mt-2 px-4 py-2.5 rounded-2xl text-xs font-mono-tech flex items-center justify-between gap-3 animate-pop-in ${
              driveNotification.success
                ? 'bg-emerald-950/90 border border-emerald-500/30 text-emerald-200'
                : 'bg-amber-950/90 border border-amber-500/30 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <HardDrive className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{driveNotification.message}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {driveNotification.url && (
                <a
                  href={driveNotification.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-white flex items-center gap-1"
                >
                  <span>Open Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={() => setDriveNotification(null)}
                className="text-white/60 hover:text-white cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>
 
      {/* Read-Only Notice Banner when an Admin is viewing another cohort's album */}
      {isViewingOtherAlbum && (
        <div 
          id="readonly-album-banner"
          className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs font-mono-tech text-amber-300 flex flex-wrap items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span>You are viewing {currentSet.classSetName} in Read-Only Mode.</span>
          {onReturnToMyAlbum && (
            <button
              onClick={onReturnToMyAlbum}
              className="underline hover:text-white cursor-pointer ml-1 font-semibold text-white"
            >
              Return to your class album
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          HERO BANNER SECTION: Full Bleed Image, Zero Background Behind It
          ========================================================================= */}
      <section 
        id="album-hero-banner"
        className="relative w-full min-h-[55vh] sm:min-h-[65vh] flex flex-col justify-end overflow-hidden"
      >
          {/* Full-width banner image without artificial gradient shadows */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <GlazedImage
              src={currentSet.bannerImageUrl}
              alt={`${currentSet.departmentName} Banner`}
              priority={true}
              className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.04] animate-album-hero-zoom transition-transform duration-1000 ease-out"
              containerClassName="w-full h-full"
            />
          </div>

          {/* Hero Content Overlay: ONLY Centralize Hero Section Texts */}
          <div className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-8 pb-10 sm:pb-14 pt-20 text-center flex flex-col items-center justify-center">
            {/* University & Department Logos Side by Side at the Top of the Names */}
            <div className="flex flex-col items-center justify-center gap-2.5 mb-3 animate-slow-reveal text-center">
              <div className="flex items-center justify-center gap-3">
                {/* University Logo */}
                {currentSet.institutionLogoUrl && (
                  <div 
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-white/25 bg-black/60 shrink-0 p-0.5 shadow-lg"
                    title={`University: ${currentSet.institutionName}`}
                  >
                    <img
                      src={currentSet.institutionLogoUrl}
                      alt={currentSet.institutionName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                )}

                {/* Department Logo */}
                <div 
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-amber-400/40 bg-black/60 shrink-0 p-0.5 shadow-lg flex items-center justify-center"
                  title={`Department: ${currentSet.departmentName}`}
                >
                  {currentSet.departmentLogoUrl ? (
                    <img
                      src={currentSet.departmentLogoUrl}
                      alt={currentSet.departmentName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-500/25 to-amber-950/60 border border-amber-400/30 flex items-center justify-center text-amber-300">
                      <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
                    </div>
                  )}
                </div>
              </div>

              {/* Institution and Department Names Below Logos */}
              <div className="text-center">
                <p className="font-syne font-bold text-sm sm:text-base text-white tracking-wide">
                  {currentSet.institutionName}
                </p>
                <p className="font-mono-tech text-xs text-zinc-300 mt-0.5">
                  {currentSet.departmentName} • Class of {currentSet.graduationYear}
                </p>
              </div>
            </div>

            {/* Headline Display Font: Class Title / Set Name - Centralized */}
            <h1 
              id="department-headline-title"
              className="font-syne font-bold text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-[1.08] max-w-3xl text-center mx-auto animate-slow-reveal animation-delay-200 mt-2"
            >
              {currentSet.classSetName || `${currentSet.departmentName} ’${String(currentSet.graduationYear).slice(-2)}`}
            </h1>

            {/* Hero Statistics: Centralized with Infinite Memories Flash */}
            <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-center gap-8 sm:gap-14 animate-slow-reveal animation-delay-350">
              {/* Stat 1: Approved Graduates Count */}
              <div className="flex flex-col items-center text-center">
                <span className="font-syne font-extrabold text-2xl sm:text-3xl md:text-4xl text-white tracking-tight leading-none">
                  {animatedGraduates}
                </span>
                <span className="font-mono-tech text-[11px] sm:text-xs text-zinc-300 uppercase tracking-wider mt-1.5 font-semibold">
                  Graduates
                </span>
              </div>

              {/* Stat 2: Infinite Memories with Passing Flash of Light Slowly and Continuously */}
              <div className="flex flex-col items-center text-center">
                <div className="relative inline-flex items-center justify-center overflow-hidden px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10">
                  <span className="font-syne font-extrabold text-2xl sm:text-3xl md:text-4xl text-white tracking-tight leading-none select-none relative z-10 px-1">
                    ∞
                  </span>
                  {/* Passing light flash over it slowly and continuously */}
                  <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                    <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/85 to-transparent animate-infinite-flash pointer-events-none" />
                  </div>
                </div>
                <span className="font-mono-tech text-[11px] sm:text-xs text-zinc-300 uppercase tracking-wider mt-1.5 font-semibold">
                  Memories
                </span>
              </div>

              {/* Stat 3: Academic Years Together */}
              <div className="flex flex-col items-center text-center">
                <span className="font-syne font-extrabold text-2xl sm:text-3xl md:text-4xl text-white tracking-tight leading-none">
                  {animatedYears}
                </span>
                <span className="font-mono-tech text-[11px] sm:text-xs text-zinc-300 uppercase tracking-wider mt-1.5 font-semibold">
                  Years Together
                </span>
              </div>
            </div>
          </div>

        <div className="relative z-10 w-full h-[1px] bg-white/[0.08]" />
      </section>

      {/* =========================================================================
          PIXIESET-STYLE SECTION SWITCHER TABS
          ========================================================================= */}
      <section 
        id="album-clips-bar"
        className={`sticky top-[61px] z-30 backdrop-blur-md border-b px-4 sm:px-8 py-3 overflow-x-auto no-scrollbar transition-colors ${
          isLightMode 
            ? 'bg-white/95 border-zinc-200 text-zinc-900 shadow-sm' 
            : 'bg-[#060709]/95 border-white/[0.08] text-white'
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            {showGraduates && (
              <button
                id="tab-btn-people"
                onClick={() => handleTabChange('graduates')}
                className={`px-4 py-2 rounded-full font-tech text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'graduates'
                    ? isLightMode
                      ? 'bg-zinc-950 text-white font-bold shadow-md active-clip ring-1 ring-black'
                      : 'bg-white text-black font-bold shadow-md active-clip'
                    : isLightMode
                      ? 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>People</span>
              </button>
            )}

            {showMemories && (
              <button
                id="tab-btn-moments"
                onClick={() => handleTabChange('memories')}
                className={`px-4 py-2 rounded-full font-tech text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'memories'
                    ? isLightMode
                      ? 'bg-zinc-950 text-white font-bold shadow-md active-clip ring-1 ring-black'
                      : 'bg-white text-black font-bold shadow-md active-clip'
                    : isLightMode
                      ? 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Moments</span>
              </button>
            )}

            {showAwards && (
              <button
                id="tab-btn-awards"
                onClick={() => handleTabChange('awards')}
                className={`px-4 py-2 rounded-full font-tech text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'awards'
                    ? isLightMode
                      ? 'bg-zinc-950 text-white font-bold shadow-md active-clip ring-1 ring-black'
                      : 'bg-white text-black font-bold shadow-md active-clip'
                    : isLightMode
                      ? 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Awards</span>
              </button>
            )}

            {showVoices && (
              <button
                id="tab-btn-voices"
                onClick={() => handleTabChange('voices')}
                className={`px-4 py-2 rounded-full font-tech text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'voices'
                    ? isLightMode
                      ? 'bg-zinc-950 text-white font-bold shadow-md active-clip ring-1 ring-black'
                      : 'bg-white text-black font-bold shadow-md active-clip'
                    : isLightMode
                      ? 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Quote className="w-3.5 h-3.5" />
                <span>Final Thoughts</span>
              </button>
            )}

            {showStory && (
              <button
                id="tab-btn-story"
                onClick={() => handleTabChange('story')}
                className={`px-4 py-2 rounded-full font-tech text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'story'
                    ? isLightMode
                      ? 'bg-zinc-950 text-white font-bold shadow-md active-clip ring-1 ring-black'
                      : 'bg-white text-black font-bold shadow-md active-clip'
                    : isLightMode
                      ? 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Our Story</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          TAB 1: THE GRADUATES GRID (Pixieset Style)
          ========================================================================= */}
      {activeTab === 'graduates' && (
        <section 
          id="profile-cards-grid-section"
          className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 animate-slide-up-fade"
        >
          {/* Section Header: Centralized Title & Caption under Section Clips */}
          <div className="flex flex-col items-center justify-center text-center gap-1.5 mb-8">
            <h2 className={`font-syne font-bold text-2xl sm:text-3xl tracking-tight ${
              isLightMode ? 'text-slate-900' : 'text-white'
            }`}>
              MEET THE CLASS
            </h2>
            <p className={`font-body text-xs sm:text-sm font-medium ${
              isLightMode ? 'text-slate-600' : 'text-zinc-400'
            }`}>
              Tap a portrait to meet them.
            </p>
          </div>

          {/* =========================================================================
              FILTER CLIPS (ALL, DEPARTMENT EXECUTIVES, CLASS MEMBERS) ABOVE SEARCH
              ========================================================================= */}
          <div 
            id="album-filter-and-search-toolbar"
            className={`p-4 sm:p-5 rounded-3xl border mb-8 space-y-4 transition-colors ${
              isLightMode 
                ? 'bg-white border-slate-200 text-slate-900 shadow-sm' 
                : 'bg-gradient-to-b from-[#18181b] to-[#121214] border-white/10 shadow-xl'
            }`}
          >
            {/* Top Row: Category Filter Clips */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Filter Clip 1: ALL */}
                <button
                  id="filter-clip-all"
                  onClick={() => setCohortFilter('all')}
                  className={`px-4 py-2 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                    cohortFilter === 'all'
                      ? isLightMode
                        ? 'bg-slate-900 text-white font-bold shadow-sm'
                        : 'bg-white text-black font-bold shadow-md ring-2 ring-white/30'
                      : isLightMode
                        ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>All</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    cohortFilter === 'all' 
                      ? isLightMode ? 'bg-white/20 text-white' : 'bg-black/15 text-black' 
                      : isLightMode ? 'bg-slate-200 text-slate-800' : 'bg-white/10 text-zinc-300'
                  }`}>
                    {approvedStudents.length}
                  </span>
                </button>

                {/* Filter Clip 2: LEADERS */}
                <button
                  id="filter-clip-leaders"
                  onClick={() => setCohortFilter('leaders')}
                  className={`px-4 py-2 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                    cohortFilter === 'leaders'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm ring-2 ring-amber-500/40'
                      : isLightMode
                        ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  <Crown className={`w-3.5 h-3.5 ${cohortFilter === 'leaders' ? 'text-slate-950' : 'text-amber-500'}`} />
                  <span>Leaders</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    cohortFilter === 'leaders' ? 'bg-black/20 text-slate-950' : 'bg-amber-400/20 text-amber-500'
                  }`}>
                    {totalLeadersCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Search Bar for Name */}
            <div className="relative w-full">
              <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                isLightMode ? 'text-slate-400' : 'text-zinc-400'
              }`} />
              <input
                id="search-by-name-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  cohortFilter === 'leaders'
                    ? 'Search leaders by name...'
                    : 'Search graduates alphabetically by name...'
                }
                className={`w-full border rounded-2xl pl-10 pr-10 py-2.5 text-xs font-body focus:outline-none transition-all ${
                  isLightMode 
                    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs' 
                    : 'bg-[#10121a] border-white/10 focus:border-white/30 text-white placeholder:text-zinc-500 shadow-inner'
                }`}
              />
              {searchQuery && (
                <button
                  id="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors cursor-pointer ${
                    isLightMode ? 'text-slate-400 hover:text-slate-900' : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Responsive 2 to 4-column Grid */}
          <div 
            id="student-cards-grid"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5"
          >
            {filteredStudents.map((student, index) => {
              const isLeader = isLeaderProfile(student);
              const rankNumber = cohortFilter === 'leaders' 
                ? index + 1 
                : (typeof student.leaderOrder === 'number' ? student.leaderOrder : undefined);

              return (
                <div
                  key={student.id}
                  id={`student-card-${student.id}`}
                  onClick={() => setSelectedStudent(student)}
                  style={{ animationDelay: `${Math.min(index * 35, 450)}ms` }}
                  className={`group/card animate-card-entry cursor-pointer rounded-2xl overflow-hidden transition-all duration-350 ease-out hover:-translate-y-2.5 flex flex-col relative ${
                    cohortFilter === 'leaders'
                      ? isLightMode
                        ? 'bg-white border border-amber-300/80 hover:border-amber-500 shadow-sm'
                        : 'bg-[#18181b] border border-amber-400/20 hover:border-amber-400/70 hover:shadow-[0_24px_50px_-12px_rgba(251,191,36,0.22),0_0_20px_0_rgba(251,191,36,0.12)] shadow-amber-950/20'
                      : isLightMode
                        ? 'bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-slate-300'
                        : 'bg-[#18181b] border border-white/[0.08] hover:border-white/40 hover:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.92),0_0_24px_-4px_rgba(255,255,255,0.08)]'
                  }`}
                >
                  {/* Diagonal light shimmer passing across on hover */}
                  <div className="absolute -inset-full w-[250%] h-[250%] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent rotate-45 -translate-x-full group-hover/card:translate-x-full transition-transform duration-1000 ease-out pointer-events-none z-30" />

                  {/* Ambient sheen overlay on card hover */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

                  {/* Photo Avatar */}
                  <div className={`relative w-full aspect-[4/5] overflow-hidden ${
                    isLightMode ? 'bg-slate-100' : 'bg-zinc-950'
                  }`}>
                    <GlazedImage
                      src={student.photoUrl}
                      alt={student.fullName}
                      className="w-full h-full object-cover object-top filter contrast-[1.04] group-hover/card:scale-108 transition-transform duration-700 ease-out"
                      containerClassName="w-full h-full"
                    />
                    {!isLightMode && (
                      <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/25 to-transparent opacity-80 group-hover/card:opacity-50 transition-opacity duration-300 pointer-events-none" />
                    )}

                    {/* Position pill on photo */}
                    {student.position && (
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20">
                        <span className={`inline-block px-2.5 py-0.5 max-w-full truncate text-[10px] font-mono-tech uppercase tracking-wider backdrop-blur-sm rounded-full transition-all duration-300 ${
                          cohortFilter === 'leaders' || isLeader
                            ? isLightMode
                              ? 'text-amber-900 bg-amber-100 border border-amber-300 shadow-sm'
                              : 'text-amber-200 bg-black/85 border border-amber-400/30 group-hover/card:border-amber-400/60'
                            : isLightMode
                              ? 'text-slate-800 bg-white/90 border border-slate-300 shadow-sm'
                              : 'text-white bg-black/80 border border-white/15 group-hover/card:border-white/30'
                        }`}>
                          {student.position}
                        </span>
                      </div>
                    )}

                    {/* Subtle "Meet" indicator pill on hover */}
                    <div className="absolute top-2.5 right-2.5 opacity-0 group-hover/card:opacity-100 -translate-y-1.5 group-hover/card:translate-y-0 transition-all duration-300 z-20 pointer-events-none">
                      <span className={`px-2.5 py-0.5 rounded-full backdrop-blur-md text-[9px] font-mono-tech tracking-wider uppercase border flex items-center gap-1 shadow-md ${
                        isLightMode 
                          ? 'bg-white/90 text-slate-800 border-slate-300' 
                          : 'bg-black/85 text-white border-white/25'
                      }`}>
                        <span>Meet</span>
                        <ChevronRight className={`w-2.5 h-2.5 transition-colors ${
                          isLightMode ? 'text-slate-600 group-hover/card:text-slate-900' : 'text-zinc-400 group-hover/card:text-white'
                        }`} />
                      </span>
                    </div>
                  </div>

                  {/* Student Details: Full Name, Nickname */}
                  <div className={`p-3 sm:p-4 flex-1 flex flex-col justify-between relative z-20 ${
                    isLightMode ? 'bg-white' : 'bg-[#18181b]'
                  }`}>
                    <div>
                      <h3 className={`font-syne font-bold text-sm sm:text-base tracking-wide leading-snug transition-colors line-clamp-1 ${
                        isLightMode ? 'text-slate-900' : 'text-white'
                      }`}>
                        {student.fullName}
                      </h3>
                      {student.nickname && (
                        <p className={`font-mono-tech text-[11px] mt-0.5 truncate transition-colors ${
                          isLightMode ? 'text-[#b89728] font-semibold' : 'text-zinc-400 group-hover/card:text-[#d4af37]'
                        }`}>
                          “{student.nickname}”
                        </p>
                      )}

                      {/* Social icons visible after name and nickname */}
                      {student.socials && Object.values(student.socials).some(Boolean) && (
                        <div 
                          className="mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SocialIconsRow socials={student.socials} isLightMode={isLightMode} size="sm" />
                        </div>
                      )}
                    </div>

                    {student.quote && (
                      <p className={`font-body italic text-[11px] mt-2.5 line-clamp-2 leading-relaxed transition-colors ${
                        isLightMode ? 'text-slate-600' : 'text-zinc-400 group-hover/card:text-zinc-300'
                      }`}>
                        "{student.quote}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty States */}
          {filteredStudents.length === 0 && (
            <div className={`text-center py-16 px-6 border border-dashed rounded-3xl space-y-3 ${
              isLightMode ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#0a0b10] border-white/10 text-white'
            }`}>
              {searchQuery ? (
                <>
                  <p className="font-syne text-lg text-white">No profiles found matching "{searchQuery}"</p>
                  <p className="font-body text-xs text-zinc-400">
                    Try searching for a different name or clear your current search query.
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-mono-tech text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Search</span>
                  </button>
                </>
              ) : cohortFilter === 'leaders' ? (
                <>
                  <Crown className="w-8 h-8 text-amber-400/50 mx-auto" />
                  <p className="font-syne text-lg text-white">No Executive Leaders Registered Yet</p>
                  <p className="font-body text-xs text-zinc-400 max-w-md mx-auto">
                    Every verified profile submitted with an executive office or title will automatically appear in this tab in intuitive hierarchical order.
                  </p>
                </>
              ) : (
                <>
                  <Users className="w-8 h-8 text-zinc-500 mx-auto" />
                  <p className="font-syne text-lg text-white">No Approved Profiles in this Class Yet</p>
                  <p className="font-body text-xs text-zinc-400 max-w-md mx-auto">
                    New student submissions are verified by Class Representative <span className="text-white">{currentSet.classRepName}</span> before appearing in this official album.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 2: HORIZONTAL TOUCH-SWIPEABLE MEMORIES & HIGHLIGHTS SECTION
          ========================================================================= */}
      {activeTab === 'memories' && (
        <section 
          id="memories-section"
          className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8 animate-slide-up-fade"
        >
          {/* Section Header - Centralized */}
          <div className="text-center space-y-1">
            <h2 className={`font-syne font-bold text-2xl sm:text-3xl tracking-tight ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>
              MOMENTS &amp; HIGHLIGHTS
            </h2>
            <p className={`font-body text-xs sm:text-sm max-w-lg mx-auto ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
              The days, nights and milestones that defined this class.
            </p>
          </div>

          {/* Side-by-side buttons for Moments vs Highlights - Centralized */}
          <div className={`flex items-center justify-center gap-3 border-b pb-6 ${isLightMode ? 'border-zinc-200' : 'border-white/10'}`}>
            <button
              type="button"
              id="album-subtab-moments-btn"
              onClick={() => setMemoriesViewSubTab('moments')}
              className={`px-5 py-2.5 rounded-full font-tech text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                memoriesViewSubTab === 'moments'
                  ? isLightMode
                    ? 'bg-zinc-900 text-white font-bold shadow-lg scale-105'
                    : 'bg-white text-black font-bold shadow-lg scale-105'
                  : isLightMode
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 border border-zinc-200'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Moments</span>
            </button>

            <button
              type="button"
              id="album-subtab-highlights-btn"
              onClick={() => setMemoriesViewSubTab('highlights')}
              className={`px-5 py-2.5 rounded-full font-tech text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                memoriesViewSubTab === 'highlights'
                  ? isLightMode
                    ? 'bg-zinc-900 text-white font-bold shadow-lg scale-105'
                    : 'bg-white text-black font-bold shadow-lg scale-105'
                  : isLightMode
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 border border-zinc-200'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Highlights</span>
            </button>
          </div>

          {/* =========================================================================
              HIGHLIGHTS (VIDEO HIGHLIGHTS SUB-VIEW)
              ========================================================================= */}
          {memoriesViewSubTab === 'highlights' && (
            <div id="highlights-view-showcase" className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <span className={`font-mono-tech text-[10px] uppercase tracking-[0.2em] font-semibold flex items-center gap-1.5 ${
                    isLightMode ? 'text-red-600 font-bold' : 'text-red-400 font-semibold'
                  }`}>
                    <Play className="w-3 h-3 fill-red-500" />
                    <span>CINEMATIC HIGHLIGHTS</span>
                  </span>
                  <h2 className={`font-syne font-bold text-2xl sm:text-3xl tracking-tight mt-1 ${
                    isLightMode ? 'text-zinc-900' : 'text-white'
                  }`}>
                    Highlights
                  </h2>
                  <p className={`font-body text-xs sm:text-sm font-medium mt-1 ${
                    isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                  }`}>
                    Documentary clips, convocation speeches, and video retrospectives.
                  </p>
                </div>
                <span className={`text-xs font-mono-tech ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {currentSet.videos?.length || 0} {(currentSet.videos?.length || 0) === 1 ? 'Feature Highlight' : 'Feature Highlights'}
                </span>
              </div>

              {(!currentSet.videos || currentSet.videos.length === 0) ? (
                <div className={`text-center py-16 px-4 rounded-3xl border space-y-3 ${
                  isLightMode ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm' : 'bg-[#18181b] border-white/10 text-white'
                }`}>
                  <div className={`w-12 h-12 rounded-full border flex items-center justify-center mx-auto ${
                    isLightMode ? 'bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-white/5 border-white/10 text-zinc-400'
                  }`}>
                    <Play className="w-5 h-5" />
                  </div>
                  <h4 className={`font-syne font-bold text-lg ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>No Video Highlights Yet</h4>
                  <p className={`font-body text-xs max-w-md mx-auto ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    The Class Representative has not embedded any video highlights for this set yet. Check back soon for documentary footage and speeches!
                  </p>
                </div>
              ) : (
                <div className={`grid gap-8 ${currentSet.videos.length === 1 ? 'grid-cols-1 max-w-4xl mx-auto' : 'grid-cols-1 lg:grid-cols-2'}`}>
                  {currentSet.videos.map((vid) => {
                    const thumb = vid.thumbnailUrl || getYouTubeThumbnailUrl(vid.youtubeUrl);
                    return (
                      <div
                        key={vid.id}
                        id={`video-card-${vid.id}`}
                        className={`group border rounded-3xl overflow-hidden shadow-2xl transition-all flex flex-col w-full ${
                          isLightMode 
                            ? 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400 shadow-md' 
                            : 'bg-[#18181b] border-white/15 text-white hover:border-white/35 shadow-2xl'
                        }`}
                      >
                        {/* Generous 16:9 Clickable Thumbnail */}
                        <div
                          onClick={() => {
                            setSelectedVideo(vid);
                            setIsVideoModalOpen(true);
                          }}
                          className="relative aspect-video w-full bg-black overflow-hidden cursor-pointer"
                        >
                          <GlazedImage
                            src={thumb}
                            alt={vid.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter contrast-[1.05] animate-ken-burns"
                            containerClassName="w-full h-full"
                          />
                          <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 transition-colors pointer-events-none" />

                          {/* Center Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform group-hover:bg-red-500">
                              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1" />
                            </div>
                          </div>

                          {/* Video Date / Tag Badge */}
                          {vid.dateStr && (
                            <div className="absolute top-4 left-4">
                              <span className="px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-xs font-mono-tech text-white uppercase tracking-wider font-semibold">
                                {vid.dateStr}
                              </span>
                            </div>
                          )}

                          <div className="absolute bottom-4 right-4">
                            <span className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-xs font-mono-tech text-zinc-200 flex items-center gap-1.5">
                              <Youtube className="w-4 h-4 text-red-500" />
                              <span>Watch Highlight</span>
                            </span>
                          </div>
                        </div>

                        {/* Card Content & Details */}
                        <div className={`p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4 ${
                          isLightMode ? 'bg-white' : 'bg-[#18181b]'
                        }`}>
                          <div className="space-y-2">
                            <h3
                              onClick={() => {
                                setSelectedVideo(vid);
                                setIsVideoModalOpen(true);
                              }}
                              className={`font-syne font-bold text-xl sm:text-2xl transition-colors cursor-pointer leading-tight ${
                                isLightMode ? 'text-zinc-900 hover:text-red-600' : 'text-white group-hover:text-red-400'
                              }`}
                            >
                              {vid.title}
                            </h3>
                            {vid.description && (
                              <p className={`font-body text-xs sm:text-sm leading-relaxed line-clamp-3 ${
                                isLightMode ? 'text-zinc-700' : 'text-zinc-400'
                              }`}>
                                {vid.description}
                              </p>
                            )}
                          </div>

                          <div className={`pt-4 flex items-center justify-between border-t text-xs font-mono-tech ${
                            isLightMode ? 'border-zinc-200' : 'border-white/10'
                          }`}>
                            <button
                              onClick={() => {
                                setSelectedVideo(vid);
                                setIsVideoModalOpen(true);
                              }}
                              className={`px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 ${
                                isLightMode 
                                  ? 'bg-zinc-900 text-white hover:bg-zinc-800' 
                                  : 'bg-white text-black hover:bg-zinc-200'
                              }`}
                            >
                              <Play className={`w-3.5 h-3.5 ${isLightMode ? 'fill-white' : 'fill-black'}`} />
                              <span>Play Highlight</span>
                            </button>

                            <a
                              href={vid.youtubeUrl.startsWith('http') ? vid.youtubeUrl : `https://www.youtube.com/watch?v=${vid.youtubeUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-1.5 transition-colors ${
                                isLightMode ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <span>Open in YouTube</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              MOMENTS (EVENT CATEGORIES / CHAPTERS SUB-VIEW)
              ========================================================================= */}
          {memoriesViewSubTab === 'moments' && (
            <div id="moments-view-showcase" className="space-y-8 animate-fadeIn">
            {/* Event Chapters without top filter clips */}
            {(!currentSet.memories || currentSet.memories.length === 0) ? (
              <div className={`text-center py-16 px-6 border border-dashed rounded-3xl space-y-3 ${
                isLightMode ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#18181b] border-white/10 text-white'
              }`}>
                <Camera className="w-8 h-8 text-zinc-500 mx-auto" />
                <p className={`font-syne text-lg ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>No Moments Captured Yet</p>
                <p className={`font-body text-xs max-w-md mx-auto ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Milestone celebrations like Sign-out Day, Cultural Day, and Convocation memories will be highlighted here.
                </p>
              </div>
            ) : (
              <div className="space-y-12">
              {currentSet.memories.map((event) => (
                <div key={event.id} id={`memory-event-${event.id}`} className="space-y-3">
                  <div className={`border-b pb-3.5 ${
                    isLightMode ? 'border-zinc-200' : 'border-white/10'
                  }`}>
                    <div className="space-y-1 text-left">
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <h3 className={`font-syne font-bold text-xl sm:text-2xl tracking-tight leading-tight ${
                          isLightMode ? 'text-zinc-900' : 'text-white'
                        }`}>
                          {event.title}
                        </h3>
                      </div>
                      {event.caption && (
                        <p className={`font-body text-xs sm:text-sm max-w-2xl leading-relaxed ${
                          isLightMode ? 'text-zinc-600' : 'text-zinc-300'
                        }`}>
                          {event.caption}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Touch-Swipeable Carousel */}
                  <div 
                    id={`carousel-${event.id}`}
                    className="flex items-start gap-4 overflow-x-auto no-scrollbar py-2 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory"
                  >
                    {(event.images || []).map((img, imgIdx) => {
                      const displayCaption = (img.caption && img.caption.trim().length > 0) ? img.caption.trim() : event.title;
                      return (
                        <div
                          key={img.id}
                          className={`snap-start shrink-0 w-[260px] sm:w-[300px] rounded-2xl overflow-hidden transition-all flex flex-col shadow-lg border ${
                            isLightMode 
                              ? 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400' 
                              : 'bg-[#0e1017] border-white/[0.08] text-white hover:border-white/30'
                          }`}
                        >
                          {/* Strictly Square Photo Container */}
                          <div 
                            onClick={() => {
                              const allMoments: Array<{
                                id: string;
                                url: string;
                                caption?: string;
                                eventId: string;
                                title: string;
                                categoryTitle: string;
                                categoryIndex: number;
                                totalCategories: number;
                                imageIndexInCategory: number;
                                totalImagesInCategory: number;
                              }> = [];

                              (currentSet.memories || []).forEach((cat, catIdx) => {
                                (cat.images || []).forEach((im, iIdx) => {
                                  allMoments.push({
                                    id: im.id,
                                    url: im.url,
                                    caption: (im.caption && im.caption.trim().length > 0) ? im.caption.trim() : cat.title,
                                    eventId: cat.id,
                                    title: cat.title,
                                    categoryTitle: cat.title,
                                    categoryIndex: catIdx,
                                    totalCategories: (currentSet.memories || []).length,
                                    imageIndexInCategory: iIdx,
                                    totalImagesInCategory: (cat.images || []).length,
                                  });
                                });
                              });

                              const targetIdx = allMoments.findIndex((m) => m.id === img.id);
                              setLightboxMomentsList(allMoments);
                              setLightboxMomentIndex(targetIdx >= 0 ? targetIdx : 0);
                            }}
                            className="relative aspect-square w-full overflow-hidden bg-black cursor-pointer group"
                          >
                            <GlazedImage
                              src={img.url}
                              alt={displayCaption}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              containerClassName="w-full h-full"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity pointer-events-none" />
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono-tech text-white/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to expand
                            </div>
                          </div>

                          {/* Individual photo date and time - very minimal, no backdrop, simple text */}
                          <div className="py-2.5 px-3.5 flex items-center justify-between text-[11px] font-mono-tech select-none">
                            <span className={isLightMode ? 'text-zinc-500 font-medium' : 'text-zinc-400'}>
                              {img.dateTime || `${event.dateStr || `Oct ${20 + (imgIdx % 10)}, ${currentSet.graduationYear}`} • ${2 + (imgIdx % 6)}:${10 + ((imgIdx * 7) % 50)} PM`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        )}
        </section>
      )}

      {/* =========================================================================
          TAB 3: AWARDS & RECOGNITION (DYNAMIC SHAPES & COLORS ACCORDING TO TROPHY TYPE)
          ========================================================================= */}
      {activeTab === 'awards' && (
        <section 
          id="awards-recognition-section"
          className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 animate-slide-up-fade"
        >
          <div className="mb-8 text-center max-w-xl mx-auto flex flex-col items-center">
            <h2 className={`font-syne font-bold text-2xl sm:text-3xl tracking-tight ${
              isLightMode ? 'text-zinc-900' : 'text-white'
            }`}>
              AWARDS &amp; DISTINCTIONS
            </h2>
            <p className={`font-body text-xs sm:text-sm mt-1 ${
              isLightMode ? 'text-zinc-600' : 'text-zinc-400'
            }`}>
              Celebrating the people who made this class unforgettable.
            </p>
          </div>

          {(!currentSet.awards || currentSet.awards.length === 0) ? (
            <div className={`text-center py-16 px-6 border border-dashed rounded-3xl space-y-3 ${
              isLightMode ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm' : 'border-white/10 bg-[#18181b] text-white'
            }`}>
              <Trophy className="w-8 h-8 text-amber-400/50 mx-auto" />
              <p className={`font-syne text-lg ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>No Awards or Distinctions Published Yet</p>
              <p className={`font-body text-xs max-w-md mx-auto ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                Senior superlatives, academic recognitions, and cohort accolades will appear here once finalized by the class committee.
              </p>
            </div>
          ) : (
            <div 
              id="awards-swiper"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
            >
              {currentSet.awards.map((award) => {
                const visual = getAwardVisualConfig(award.trophyType, isLightMode);
                const AwardIcon = visual.icon;
                return (
                  <div
                    key={award.id}
                    id={`award-card-${award.id}`}
                    className={`rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all border ${
                      isLightMode 
                        ? 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400 shadow-md' 
                        : 'bg-[#18181b] border-white/[0.08] hover:border-white/30 text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        {/* Dynamic Shape & Color Based on Type */}
                        <div className={`w-11 h-11 ${visual.shapeClass} flex items-center justify-center shrink-0 ${visual.glowClass}`}>
                          <AwardIcon className={`w-5 h-5 ${visual.iconColor} ${visual.type === 'crystal' ? '-rotate-45' : ''}`} />
                        </div>
                      </div>

                      <h3 className={`font-syne font-bold text-lg leading-snug ${
                        isLightMode ? 'text-zinc-900' : 'text-white'
                      }`}>
                        {award.category}
                      </h3>

                      {/* Winner Profile Snippet - Bold Image Preview styled to award type */}
                      <div className={`flex items-center gap-3.5 mt-4 pt-3.5 border-t ${
                        isLightMode ? 'border-zinc-200' : 'border-white/[0.08]'
                      }`}>
                        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 ${visual.borderClass} ${visual.glowClass} bg-zinc-900`}>
                          <GlazedImage
                            src={award.winnerAvatar}
                            alt={award.winnerName}
                            showMonogram={false}
                            className="w-full h-full object-cover"
                            containerClassName="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className={`font-syne font-bold text-base sm:text-lg truncate ${
                            isLightMode ? 'text-zinc-900' : 'text-white'
                          }`}>
                            {award.winnerName}
                          </h4>
                          {award.winnerNickname && (
                            <p className={`font-mono-tech text-xs font-semibold truncate mt-0.5 ${
                              isLightMode ? 'text-[#b89728]' : 'text-[#d4af37]'
                            }`}>
                              “{award.winnerNickname}”
                            </p>
                          )}
                          <span className={`inline-block mt-1 font-mono-tech text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isLightMode 
                              ? 'text-zinc-700 bg-zinc-100 border-zinc-300 font-semibold' 
                              : 'text-zinc-400 bg-white/5 border-white/10'
                          }`}>
                            Award Laureate
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className={`font-body text-xs italic mt-4 pt-3 border-t leading-relaxed ${
                      isLightMode ? 'text-zinc-700 border-zinc-200' : 'text-zinc-300 border-white/5'
                    }`}>
                      “{award.citation}”
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 4: VOICES & MESSAGES
          ========================================================================= */}
      {activeTab === 'voices' && (
        <section 
          id="voices-swiper-section"
          className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 animate-slide-up-fade"
        >
          <div className="mb-8 text-center max-w-xl mx-auto flex flex-col items-center">
            <h2 className={`font-syne font-bold text-2xl sm:text-3xl tracking-tight ${
              isLightMode ? 'text-zinc-900' : 'text-white'
            }`}>
              Final Thoughts
            </h2>
            <p className={`font-body text-xs sm:text-sm mt-1 ${
              isLightMode ? 'text-zinc-600' : 'text-zinc-400'
            }`}>
              Parting wisdom, farewell remarks, and words of encouragement from lecturers and student leaders.
            </p>
          </div>

          {(!currentSet.voices || currentSet.voices.length === 0) ? (
            <div className={`text-center py-16 px-6 border border-dashed rounded-3xl space-y-3 ${
              isLightMode ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm' : 'border-white/10 bg-[#18181b] text-white'
            }`}>
              <Quote className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className={`font-syne text-lg ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>No Final Thoughts Published Yet</p>
              <p className={`font-body text-xs max-w-md mx-auto ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                Parting reflections and words of guidance from faculty advisers, lecturers, and class leaders will appear here.
              </p>
            </div>
          ) : (
            <div 
              id="voices-grid"
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"
            >
              {currentSet.voices.map((voice) => (
                <div
                  key={voice.id}
                  id={`voice-card-${voice.id}`}
                  className={`rounded-2xl p-6 flex flex-col justify-between shadow-lg border ${
                    isLightMode 
                      ? 'bg-white border-zinc-200 text-zinc-900 shadow-md hover:border-zinc-400' 
                      : 'bg-[#18181b] border-white/[0.08] text-white hover:border-white/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl ring-4 ring-white/10 shrink-0 bg-zinc-900">
                        <GlazedImage
                          src={voice.headshotUrl}
                          alt={voice.lecturerName}
                          showMonogram={false}
                          className="w-full h-full object-cover"
                          containerClassName="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className={`font-syne font-bold text-base sm:text-lg leading-tight truncate ${
                          isLightMode ? 'text-zinc-900' : 'text-white'
                        }`}>
                          {voice.lecturerName}
                        </h3>
                        <p className={`font-mono-tech text-xs font-semibold mt-1 leading-snug ${
                          isLightMode ? 'text-[#b89728]' : 'text-[#d4af37]'
                        }`}>
                          {voice.title}
                        </p>
                        <span className={`inline-block mt-1 font-mono-tech text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isLightMode 
                            ? 'text-zinc-700 bg-zinc-100 border-zinc-300 font-semibold' 
                            : 'text-zinc-400 bg-white/5 border-white/10'
                        }`}>
                          Faculty Reflection
                        </span>
                      </div>
                    </div>

                    <div className="relative pt-2">
                      <p className={`font-body text-sm sm:text-base italic leading-relaxed ${
                        isLightMode ? 'text-zinc-800' : 'text-zinc-300'
                      }`}>
                        “{voice.partingQuote}”
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 5: OUR STORY
          ========================================================================= */}
      {activeTab === 'story' && (
        <section 
          id="our-story-section"
          className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 animate-slide-up-fade"
        >
          <div className="mb-8 text-center max-w-xl mx-auto flex flex-col items-center">
            <h2 className={`font-syne font-bold text-2xl sm:text-3xl tracking-tight ${
              isLightMode ? 'text-zinc-900' : 'text-white'
            }`}>
              OUR STORY
            </h2>
            <p className={`font-body text-xs sm:text-sm mt-1 ${
              isLightMode ? 'text-zinc-600' : 'text-zinc-400'
            }`}>
              The shared journey, struggles, and triumphs that defined this cohort.
            </p>
          </div>

          <div className={`p-8 sm:p-12 rounded-3xl border shadow-xl ${
            isLightMode 
              ? 'bg-white border-zinc-200 text-zinc-900 shadow-md' 
              : 'bg-[#18181b] border-white/10 text-white'
          }`}>
            <div className={`space-y-6 font-body text-base sm:text-lg leading-relaxed text-left sm:text-justify max-w-3xl mx-auto ${
              isLightMode ? 'text-zinc-800 font-normal' : 'text-zinc-300'
            }`}>
              {(currentSet.ourStory || '').split('\n\n').map((paragraph, idx) => (
                <p key={idx}>
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-12 flex items-center justify-center gap-3">
              <div className={`w-12 h-[1px] ${isLightMode ? 'bg-zinc-300' : 'bg-white/10'}`} />
              <span className={`font-mono-tech text-xs uppercase tracking-widest ${
                isLightMode ? 'text-zinc-600 font-semibold' : 'text-zinc-400'
              }`}>
                {currentSet.classSetName} • {currentSet.graduationYear}
              </span>
              <div className={`w-12 h-[1px] ${isLightMode ? 'bg-zinc-300' : 'bg-white/10'}`} />
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          FINAL CELEBRATORY BANNER: THIS IS OUR LEGACY.
          Featuring album admin name, class portrait, department & set details
          ========================================================================= */}
      <section 
        id="album-our-legacy-banner"
        className="relative w-full min-h-[55vh] sm:min-h-[70vh] flex flex-col justify-center items-center overflow-hidden bg-black mt-16 select-none"
      >
        <div className="absolute inset-0 z-0">
          <img
            src={currentSet.legacyFooterUrl || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop'}
            alt="This is our legacy - celebratory class portrait"
            className="w-full h-full object-cover object-center filter brightness-[0.52] contrast-[1.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#060709] via-transparent to-[#060709] pointer-events-none" />
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 text-center py-16 space-y-4">
          <p className="font-mono-tech text-xs sm:text-sm uppercase tracking-[0.25em] text-white/80 font-semibold animate-fadeIn">
            {currentSet.institutionName} • {currentSet.departmentName} • Class of {currentSet.graduationYear}
          </p>

          <h2 
            id="this-is-our-legacy-heading"
            className="font-syne font-black text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight drop-shadow-2xl"
          >
            THIS IS OUR LEGACY.
          </h2>

          <div className="space-y-2 pt-2">
            <p className="font-syne font-bold text-base sm:text-lg text-[#d4af37] tracking-wide">
              {currentSet.classSetName}
            </p>

            {/* Prominent Album Admin Name */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-mono-tech text-xs tracking-wider">
              <span className="text-[#d4af37] font-semibold">Album Admin:</span>
              <span className="font-bold">{currentSet.classRepName || 'Class Album Committee Lead'}</span>
            </div>
          </div>
        </div>
      </section>

        {/* Minimalist footer */}
        <footer 
          id="album-minimalist-footer"
          className="relative z-10 w-full bg-[#060709] border-t border-white/[0.08] py-8 px-6 text-center text-zinc-400"
        >
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-mono-tech text-xs tracking-widest text-zinc-300 lowercase">
              kohot.app
            </span>

            {/* Department Social Links */}
            {currentSet.socials && (
              <div className="flex items-center gap-3 text-zinc-400">
                {currentSet.socials.youtube && (
                  <a
                    href={currentSet.socials.youtube.startsWith('http') ? currentSet.socials.youtube : `https://${currentSet.socials.youtube}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-red-400 transition-colors"
                    title="Department YouTube"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
                {currentSet.socials.instagram && (
                  <a
                    href={currentSet.socials.instagram.startsWith('http') ? currentSet.socials.instagram : `https://instagram.com/${currentSet.socials.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-pink-400 transition-colors"
                    title="Department Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {currentSet.socials.twitter && (
                  <a
                    href={currentSet.socials.twitter.startsWith('http') ? currentSet.socials.twitter : `https://x.com/${currentSet.socials.twitter.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-zinc-200 transition-colors"
                    title="Department Twitter / X"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {currentSet.socials.linkedin && (
                  <a
                    href={currentSet.socials.linkedin.startsWith('http') ? currentSet.socials.linkedin : `https://${currentSet.socials.linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-zinc-200 transition-colors"
                    title="Department LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
                {currentSet.socials.website && (
                  <a
                    href={currentSet.socials.website.startsWith('http') ? currentSet.socials.website : `https://${currentSet.socials.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    title="Department Official Website"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 font-mono-tech text-[11px] text-zinc-400">
              <span>{currentSet.classSetName}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setIsDisputeModalOpen(true)}
                className="text-zinc-400 hover:text-white hover:underline transition-colors cursor-pointer"
                title="Album Admin Help"
              >
                Album Admin Help
              </button>
              <span>•</span>
              <button
                id="footer-back-to-albums-btn"
                onClick={onBackToGrid}
                className="text-white hover:underline transition-colors cursor-pointer"
              >
                ← Back to All Albums
              </button>
            </div>
          </div>
        </footer>


      {/* PERSISTENT CONTEXTUAL CTA: INCOMING CLASS REPRESENTATIVE INVITATION */}
      {inviteContext && onOpenOnboardingWithInvite && (
        <div
          id="album-contextual-invite-bar"
          className="fixed bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto bg-[#18181b]/95 border border-amber-400/40 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 sm:gap-4 text-white animate-fadeIn"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="truncate">
              <span className="text-[10px] font-mono-tech uppercase tracking-wider text-amber-300 block leading-tight">
                Incoming Class Representative
              </span>
              <span className="font-syne font-bold text-xs sm:text-sm text-white truncate block">
                Your Class — {inviteContext.targetYear}
              </span>
            </div>
          </div>
          <button
            id="contextual-create-album-btn"
            onClick={() => onOpenOnboardingWithInvite(inviteContext)}
            className="px-3.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <span>Create Your Class Album</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Student Portrait Detail Modal with Pixieset Lightbox Next/Prev */}
      <StudentDetailModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onNext={handleNextStudent}
        onPrevious={handlePrevStudent}
        currentIndex={currentStudentIndex}
        totalStudents={filteredStudents.length}
        isLightMode={isLightMode}
      />

      {/* Frictionless Student Submission Modal */}
      <FrictionlessSubmitModal
        currentSet={currentSet}
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmitStudent={handleAddNewStudent}
      />

      {/* Save Album to Major Cloud Storage Platforms Modal */}
      <SaveAlbumToCloudModal
        isOpen={isSaveToCloudOpen}
        onClose={() => setIsSaveToCloudOpen(false)}
        currentSet={currentSet}
        isLightMode={isLightMode}
      />

      {/* Embedded Department Video Player Modal */}
      <DepartmentVideoModal
        isOpen={isVideoModalOpen}
        video={selectedVideo}
        onClose={() => {
          setIsVideoModalOpen(false);
          setSelectedVideo(null);
        }}
        departmentName={currentSet.departmentName}
      />

      {/* Moments Fullscreen View - Covers the entire screen, with dark grey background outside the image, zoomable, no dark view text */}
      {lightboxMomentIndex !== null && lightboxMomentsList[lightboxMomentIndex] && (() => {
        const currentMoment = lightboxMomentsList[lightboxMomentIndex];

        const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
          if (e.touches.length === 2) {
            e.stopPropagation();
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            momentTouchDistRef.current = dist;
            momentLastScaleRef.current = momentZoomScale;
          } else if (e.touches.length === 1) {
            if (momentZoomScale > 1.05) {
              isDraggingMomentRef.current = true;
              hasMomentDraggedRef.current = false;
              dragMomentStartRef.current = {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
                startX: momentPanPos.x,
                startY: momentPanPos.y,
              };
            }
            const now = Date.now();
            if (now - momentLastTapRef.current < 300) {
              setMomentZoomScale((prev) => {
                const next = prev > 1.2 ? 1 : 2;
                if (next === 1) setMomentPanPos({ x: 0, y: 0 });
                return next;
              });
              momentLastTapRef.current = 0;
            } else {
              momentLastTapRef.current = now;
            }
          }
        };

        const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
          if (e.touches.length === 2 && momentTouchDistRef.current !== null) {
            e.stopPropagation();
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = dist / momentTouchDistRef.current;
            const nextScale = Math.min(Math.max(momentLastScaleRef.current * ratio, 1), 3.5);
            setMomentZoomScale(nextScale);
            if (nextScale <= 1.05) {
              setMomentPanPos({ x: 0, y: 0 });
            }
          } else if (e.touches.length === 1 && isDraggingMomentRef.current && momentZoomScale > 1.05) {
            e.stopPropagation();
            const dx = e.touches[0].clientX - dragMomentStartRef.current.clientX;
            const dy = e.touches[0].clientY - dragMomentStartRef.current.clientY;
            if (Math.hypot(dx, dy) > 5) {
              hasMomentDraggedRef.current = true;
            }
            setMomentPanPos({
              x: dragMomentStartRef.current.startX + dx,
              y: dragMomentStartRef.current.startY + dy,
            });
          }
        };

        const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
          isDraggingMomentRef.current = false;
          if (e.touches.length < 2) {
            momentTouchDistRef.current = null;
            momentLastScaleRef.current = momentZoomScale;
            if (momentZoomScale < 1.05) {
              setMomentZoomScale(1);
              setMomentPanPos({ x: 0, y: 0 });
            }
          }
        };

        const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
          if (momentZoomScale > 1.05) {
            e.preventDefault();
            isDraggingMomentRef.current = true;
            hasMomentDraggedRef.current = false;
            dragMomentStartRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              startX: momentPanPos.x,
              startY: momentPanPos.y,
            };
          }
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
          if (isDraggingMomentRef.current && momentZoomScale > 1.05) {
            e.preventDefault();
            const dx = e.clientX - dragMomentStartRef.current.clientX;
            const dy = e.clientY - dragMomentStartRef.current.clientY;
            if (Math.hypot(dx, dy) > 5) {
              hasMomentDraggedRef.current = true;
            }
            setMomentPanPos({
              x: dragMomentStartRef.current.startX + dx,
              y: dragMomentStartRef.current.startY + dy,
            });
          }
        };

        const handleMouseUp = () => {
          isDraggingMomentRef.current = false;
        };

        const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.01;
            setMomentZoomScale((prev) => {
              const next = Math.min(Math.max(prev + delta, 1), 3.5);
              if (next <= 1.05) setMomentPanPos({ x: 0, y: 0 });
              return next;
            });
          }
        };

        const lightboxElement = (
          <div 
            id="moments-fullscreen-lightbox"
            className={`fixed inset-0 z-[9999] w-screen h-screen select-none flex flex-col justify-between overflow-hidden transition-colors duration-200 cursor-pointer ${
              momentCardMode === 'light'
                ? 'bg-white text-zinc-950'
                : 'bg-[#000000] text-white'
            }`}
            onClick={() => {
              if (hasMomentDraggedRef.current) {
                hasMomentDraggedRef.current = false;
                return;
              }
              // Clicking toggles between light card and pure black (not grey)
              setMomentCardMode((prev) => (prev === 'light' ? 'dark' : 'light'));
            }}
          >
            {/* Minimalist Arrow Navigation Left - Disappears on zoom */}
            {lightboxMomentsList.length > 1 && momentZoomScale <= 1.05 && (
              <button
                type="button"
                id="lightbox-prev-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMomentZoomScale(1);
                  setMomentPanPos({ x: 0, y: 0 });
                  handleLightboxPrev();
                }}
                className={`absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-[10000] w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-2xl border ${
                  momentCardMode === 'light'
                    ? 'bg-white/90 hover:bg-white text-zinc-900 border-zinc-300 shadow-zinc-300/40'
                    : 'bg-black/60 hover:bg-black/80 text-white border-white/20'
                }`}
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Minimalist Arrow Navigation Right - Disappears on zoom */}
            {lightboxMomentsList.length > 1 && momentZoomScale <= 1.05 && (
              <button
                type="button"
                id="lightbox-next-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMomentZoomScale(1);
                  setMomentPanPos({ x: 0, y: 0 });
                  handleLightboxNext();
                }}
                className={`absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-[10000] w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-2xl border ${
                  momentCardMode === 'light'
                    ? 'bg-white/90 hover:bg-white text-zinc-900 border-zinc-300 shadow-zinc-300/40'
                    : 'bg-black/60 hover:bg-black/80 text-white border-white/20'
                }`}
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Top Bar - Category Title at top left, X close icon at top right */}
            <div className={`w-full px-5 sm:px-8 py-4 flex items-center justify-between gap-4 z-50 shrink-0 ${
              momentCardMode === 'light'
                ? 'bg-gradient-to-b from-white/95 via-white/60 to-transparent'
                : 'bg-gradient-to-b from-black/85 via-black/45 to-transparent'
            }`}>
              {/* Category Title at Top Left */}
              <div className="flex items-center gap-3">
                <span className={`px-4 py-1.5 rounded-full text-xs font-syne font-bold uppercase tracking-wider border backdrop-blur-md shadow-xs ${
                  momentCardMode === 'light'
                    ? 'bg-black/5 text-black border-black/15'
                    : 'bg-white/10 text-white border-white/20'
                }`}>
                  {currentMoment.categoryTitle || currentMoment.title}
                </span>
                <span className={`font-mono-tech text-xs hidden sm:inline ${
                  momentCardMode === 'light' ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  Photo {((currentMoment.imageIndexInCategory ?? 0) + 1)} of {(currentMoment.totalImagesInCategory ?? lightboxMomentsList.length)}
                </span>
              </div>

              {/* Close Button Only on Top Right - Icon only, no text cancel/close */}
              <div className="flex items-center gap-2">
                <button
                  id="close-lightbox-btn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxMomentIndex(null);
                    setMomentZoomScale(1);
                    setMomentPanPos({ x: 0, y: 0 });
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 border ${
                    momentCardMode === 'light'
                      ? 'bg-black/10 hover:bg-black/20 text-zinc-900 border-black/15'
                      : 'bg-white/15 hover:bg-white/25 text-white border-white/25'
                  }`}
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Fullscreen Photo Display Area - End-to-end sharp corners, pictures only, drag support */}
            <div 
              className="flex-1 w-full h-full flex items-center justify-center p-0 overflow-hidden relative select-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasMomentDraggedRef.current) {
                    hasMomentDraggedRef.current = false;
                    return;
                  }
                  // Clicking on image toggles background mode
                  setMomentCardMode((prev) => (prev === 'light' ? 'dark' : 'light'));
                }}
                className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out origin-center cursor-default"
                style={{
                  transform: `translate(${momentPanPos.x}px, ${momentPanPos.y}px) scale(${momentZoomScale})`,
                  cursor: momentZoomScale > 1.05 ? 'grab' : 'pointer',
                }}
              >
                <img
                  src={currentMoment.url}
                  alt={currentMoment.title}
                  className="w-full h-full object-contain rounded-none select-none drop-shadow-2xl pointer-events-none"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        );

        if (typeof document !== 'undefined') {
          return createPortal(lightboxElement, document.body);
        }
        return lightboxElement;
      })()}

      {/* Album Admin Help Support Modal */}
      <AlbumDisputeModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        currentSet={currentSet}
      />
    </div>
  );
};
