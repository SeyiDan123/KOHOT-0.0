import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ClassSet, 
  StudentProfile, 
  MemoryEvent, 
  AwardItem, 
  VoiceItem,
  UniversityDirectoryItem
} from '../../types';
import { getStoredUniversities } from '../../data/initialData';
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
  Moon,
  Bookmark,
  AlertTriangle,
  Pin,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX
} from 'lucide-react';
import { StudentDetailModal } from './StudentDetailModal';
import { FrictionlessSubmitModal } from './FrictionlessSubmitModal';
import { KeepAlbumSheet } from './KeepAlbumSheet';
import { DepartmentVideoModal } from './DepartmentVideoModal';
import { AlbumDisputeModal } from '../admin/AlbumDisputeModal';
import { PublishAlbumModal } from '../admin/PublishAlbumModal';
import { AlbumAdminSwitcher } from '../common/AlbumAdminSwitcher';
import { StoryReadingModal } from '../common/StoryReadingModal';
import {
  getAutomaticLeaderStories,
  getCleanClassSummary,
  getFromRoleHeading,
  getProfileStoryText,
  getStoryCardPreview,
  getDisplayRoleLabel
} from '../../utils/storyFormatting';
import { useFeedback } from '../common/FeedbackSystem';
import { getAlbumUrl, copyUrlToClipboard } from '../../utils/urlHelper';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { GlazedImage } from '../common/GlazedImage';
import { getYouTubeThumbnailUrl, getVideoPlatformLabel, getUniversalVideoEmbedUrl, extractYouTubeId } from '../../utils/youtube';
import { updateSocialMetaTags, updateManifestTag } from '../../utils/metaTags';
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

export const formatCleanClassSetName = (rawName?: string, fallback?: string): string => {
  const base = (rawName || fallback || '')
    .replace(/[\s—–-]*class\s+of\s+\d{4}/gi, '')
    .trim();
  if (!base) return fallback || '';
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length === 1 && !/^the$/i.test(words[0])) {
    return `THE ${words[0].toUpperCase()}`;
  }
  return base.toUpperCase();
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
  universities?: UniversityDirectoryItem[];
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
  universities,
}) => {
  const isAlbumAdmin = Boolean(isAdmin);

  // Reflect authentic university and department logos configured in the directory on owner dashboard
  const directoryRef = useMemo(() => {
    try {
      const list = universities && universities.length > 0 ? universities : getStoredUniversities();
      for (const u of list) {
        const d = u.departments?.find(
          (dept) => dept.id === currentSet.departmentId || dept.name.toLowerCase() === currentSet.departmentName.toLowerCase()
        );
        if (d) return { dept: d, uni: u };
      }
    } catch (e) {
      // fallback
    }
    return null;
  }, [universities, currentSet.departmentId, currentSet.departmentName]);

  const effectiveDeptLogo = currentSet.departmentLogoUrl || directoryRef?.dept.logoUrl;
  const effectiveUniLogo = currentSet.institutionLogoUrl || directoryRef?.uni.logoUrl;

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
  const [activeTab, setActiveTab] = useState<'graduates' | 'memories' | 'awards'>(() => {
    try {
      const previewTab = sessionStorage.getItem('kohot_album_preview_tab');
      if (previewTab && ['graduates', 'memories'].includes(previewTab)) {
        return previewTab as 'graduates' | 'memories';
      }
      const savedAlbumTab = sessionStorage.getItem('kohot_album_active_tab');
      if (savedAlbumTab && ['graduates', 'memories'].includes(savedAlbumTab)) {
        return savedAlbumTab as 'graduates' | 'memories';
      }
    } catch (e) {}
    return 'graduates';
  });

  const initialAlbumTabRef = useRef(activeTab);
  const hasChangedTabOnAlbumRef = useRef(false);

  // Map public album tab to Album Admin Dashboard tab
  const mapAlbumTabToAdminTab = (tab: 'graduates' | 'memories' | 'awards') => {
    const reverseMap: Record<string, string> = {
      graduates: 'students',
      memories: 'memories',
    };
    return reverseMap[tab] || 'students';
  };

  // Fallback to first permitted tab if current activeTab is hidden by plaque privacy
  useEffect(() => {
    if (isPlaqueMode) {
      if (activeTab === 'graduates' && !showGraduates) {
        if (showMemories) setActiveTab('memories');
      }
    }
  }, [isPlaqueMode, showGraduates, showMemories, activeTab]);

  const [cohortFilter, setCohortFilter] = useState<'all' | 'leaders' | 'members'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { showSuccess } = useFeedback();
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [selectedMemoryCategory, setSelectedMemoryCategory] = useState<string>('All');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isKeepSheetOpen, setIsKeepSheetOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<DepartmentVideoItem | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);

  const isThreeStepsCompleted = Boolean(
    (currentSet.convocationDate ||
      currentSet.reminderSettings?.convocationDate ||
      currentSet.reminderSettings?.nextReminderDate ||
      currentSet.publishDraft?.convocationDate) &&
      (currentSet.nextClassContact?.name?.trim() ||
        currentSet.publishDraft?.nextClassContact?.name?.trim()) &&
      (currentSet.nextClassContact?.phoneOrWhatsapp?.trim() ||
        currentSet.nextClassContact?.email?.trim() ||
        currentSet.publishDraft?.nextClassContact?.phoneOrWhatsapp?.trim() ||
        currentSet.publishDraft?.nextClassContact?.email?.trim())
  );

  const isAlbumPublished = Boolean(
    (currentSet.isPublished || currentSet.published) &&
      !currentSet.isUnpublished &&
      !currentSet.unpublished &&
      isThreeStepsCompleted
  );

  // Reset pinned voice expanded state on album switch
  useEffect(() => {
    setIsPinnedExpanded(false);
  }, [currentSet?.id]);

  // Update dynamic web app manifest for this album
  useEffect(() => {
    if (currentSet?.id) {
      updateManifestTag({ album: currentSet.id });
    }
  }, [currentSet?.id]);

  // Ambient Soundtrack Playback across all opened Class Albums
  const ambientMusicUrl = (contentOverride?.albumBackgroundMusicUrl || '').trim();
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAmbientMuted, setIsAmbientMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kohot_album_audio_muted') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const audioEl = ambientAudioRef.current;
    if (!audioEl || !ambientMusicUrl) return;
    audioEl.volume = 0.28;
    audioEl.muted = isAmbientMuted;

    const attemptPlay = () => {
      if (!audioEl.paused) return;
      audioEl.play().catch(() => {
        // Browser autoplay policy: start on first interaction if blocked
      });
    };

    if (!isAmbientMuted) {
      attemptPlay();
    } else {
      audioEl.pause();
    }

    const handleFirstInteraction = () => {
      if (!isAmbientMuted && audioEl.paused) {
        audioEl.play().catch(() => {});
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [ambientMusicUrl, isAmbientMuted, currentSet?.id]);

  const toggleAmbientAudio = () => {
    setIsAmbientMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kohot_album_audio_muted', next ? 'true' : 'false');
      } catch {}
      const audioEl = ambientAudioRef.current;
      if (audioEl) {
        audioEl.muted = next;
        if (next) {
          audioEl.pause();
        } else {
          audioEl.volume = 0.28;
          audioEl.play().catch(() => {});
        }
      }
      return next;
    });
  };

  // Context-Aware Light / Dark Mode State with localStorage Persistence (Default: Light Mode)
  const [isLightMode, setIsLightMode] = useState<boolean>(() => getTheme() === 'light');

  useEffect(() => {
    const handleThemeChanged = (e: any) => {
      if (e.detail?.theme) {
        setIsLightMode(e.detail.theme === 'light');
      } else {
        setIsLightMode(getTheme() === 'light');
      }
    };
    window.addEventListener('kohot_theme_changed', handleThemeChanged);
    return () => window.removeEventListener('kohot_theme_changed', handleThemeChanged);
  }, []);

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
    dateStr?: string;
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

  // Preference of light or dark view strictly inside the moments fullscreen image viewer
  const [momentCardMode, setMomentCardMode] = useState<'light' | 'dark'>('dark');
  const [momentSwipeOffsetPx, setMomentSwipeOffsetPx] = useState<number>(0);
  const [momentSwipeTransition, setMomentSwipeTransition] = useState<boolean>(false);
  const momentSwipeTimerRef = useRef<number | null>(null);
  const momentSingleTapTimerRef = useRef<number | null>(null);
  const activeMomentImgRef = useRef<HTMLImageElement | null>(null);
  const [loadedMomentUrls, setLoadedMomentUrls] = useState<Record<string, boolean>>({});

  // Eagerly preload all moment images into browser cache so swiping has zero blank delay or loading dot
  useEffect(() => {
    const urls = new Set<string>();
    (currentSet.memories || []).forEach((ev) => {
      (ev.images || []).forEach((img) => {
        if (img.url) urls.add(img.url);
      });
    });
    lightboxMomentsList.forEach((item) => {
      if (item.url) urls.add(item.url);
    });
    urls.forEach((url) => {
      const preloader = new Image();
      preloader.decoding = 'sync';
      preloader.onload = () => {
        setLoadedMomentUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      };
      preloader.src = url;
      if (preloader.complete && preloader.naturalWidth > 0) {
        setLoadedMomentUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      }
    });
  }, [currentSet.memories, lightboxMomentsList]);

  useEffect(() => {
    return () => {
      if (momentSwipeTimerRef.current) {
        window.clearTimeout(momentSwipeTimerRef.current);
      }
      if (momentSingleTapTimerRef.current) {
        window.clearTimeout(momentSingleTapTimerRef.current);
      }
    };
  }, []);

  // Lock static background and body scroll when any modal or lightbox is open
  useStaticBackdropScrollLock(
    lightboxMomentIndex !== null ||
    Boolean(selectedStudent) ||
    isVideoModalOpen ||
    isDisputeModalOpen ||
    isKeepSheetOpen ||
    isSubmitModalOpen
  );

  const clampMomentPan = (x: number, y: number, scale: number): { x: number; y: number } => {
    if (scale <= 1.02) return { x: 0, y: 0 };
    const imgEl = activeMomentImgRef.current;
    const baseW = imgEl?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth * 0.88 : 800);
    const baseH = imgEl?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight * 0.78 : 600);
    const maxPanX = Math.max(0, (baseW * (scale - 1)) / 2);
    const maxPanY = Math.max(0, (baseH * (scale - 1)) / 2);
    return {
      x: Math.min(Math.max(x, -maxPanX), maxPanX),
      y: Math.min(Math.max(y, -maxPanY), maxPanY),
    };
  };

  const animateMomentGallerySlide = (direction: 'next' | 'prev') => {
    if (lightboxMomentIndex === null || lightboxMomentsList.length <= 1) return;
    if (momentSwipeTimerRef.current) {
      window.clearTimeout(momentSwipeTimerRef.current);
      momentSwipeTimerRef.current = null;
    }
    if (momentSingleTapTimerRef.current) {
      window.clearTimeout(momentSingleTapTimerRef.current);
      momentSingleTapTimerRef.current = null;
    }
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const gapPx = 6;
    const targetOffset = direction === 'next' ? -(viewportWidth + gapPx) : viewportWidth + gapPx;
    setMomentZoomScale(1);
    setMomentPanPos({ x: 0, y: 0 });
    setMomentSwipeTransition(true);
    setMomentSwipeOffsetPx(targetOffset);

    momentSwipeTimerRef.current = window.setTimeout(() => {
      setMomentSwipeTransition(false);
      setMomentSwipeOffsetPx(0);
      setLightboxMomentIndex((prev) => {
        if (prev === null || lightboxMomentsList.length === 0) return prev;
        return direction === 'next'
          ? (prev + 1) % lightboxMomentsList.length
          : (prev - 1 + lightboxMomentsList.length) % lightboxMomentsList.length;
      });
      momentSwipeTimerRef.current = null;
    }, 320);
  };

  const handleLightboxNext = () => {
    animateMomentGallerySlide('next');
  };

  const handleLightboxPrev = () => {
    animateMomentGallerySlide('prev');
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

  // Sub-tab state for Moments & Highlights (Moments vs Highlights side-by-side) - synced with admin dashboard
  const [memoriesViewSubTab, setMemoriesViewSubTab] = useState<'moments' | 'highlights'>(() => {
    try {
      const previewSub = sessionStorage.getItem('kohot_album_preview_subtab');
      if (previewSub === 'moments' || previewSub === 'highlights') {
        return previewSub;
      }
      const savedSub = sessionStorage.getItem('kohot_admin_dashboard_subtab');
      if (savedSub === 'moments' || savedSub === 'highlights') {
        return savedSub;
      }
    } catch (e) {}
    return 'moments';
  });

  // Sticky filter clip state for Moments categories ('all' or event.id)
  const [selectedMomentCategoryId, setSelectedMomentCategoryId] = useState<string>('all');

  useEffect(() => {
    setSelectedMomentCategoryId('all');
  }, [currentSet.id]);

  // Mutual context awareness: keep admin dashboard tab & subtab synced whenever user switches sections on the album
  useEffect(() => {
    try {
      sessionStorage.setItem('kohot_album_active_tab', activeTab);
      sessionStorage.setItem('kohot_admin_dashboard_tab', mapAlbumTabToAdminTab(activeTab));
    } catch (e) {}
  }, [activeTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem('kohot_admin_dashboard_subtab', memoriesViewSubTab);
    } catch (e) {}
  }, [memoriesViewSubTab]);

  // Unified instant positioning on mount: handles Preview context jump or exact scroll restoration without delay
  useLayoutEffect(() => {
    try {
      const previewTab = sessionStorage.getItem('kohot_album_preview_tab');
      const targetId = sessionStorage.getItem('kohot_album_preview_target_id');
      sessionStorage.removeItem('kohot_album_preview_subtab');

      if (previewTab) {
        sessionStorage.removeItem('kohot_album_preview_tab');
        if (targetId) {
          sessionStorage.removeItem('kohot_album_preview_target_id');
          const scrollToTarget = () => {
            const el =
              document.getElementById(`student-card-${targetId}`) ||
              document.getElementById(`award-card-${targetId}`) ||
              document.getElementById(`voice-card-${targetId}`) ||
              document.getElementById(`pinned-voice-card-${targetId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
              return true;
            }
            return false;
          };
          if (!scrollToTarget()) {
            requestAnimationFrame(scrollToTarget);
          }
          return;
        }

        const scrollToClips = () => {
          const clipsBar = document.getElementById('album-clips-bar');
          if (clipsBar) {
            const rect = clipsBar.getBoundingClientRect();
            const targetY = Math.max(0, window.scrollY + rect.top - 62);
            window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
          }
        };
        scrollToClips();
        requestAnimationFrame(scrollToClips);
        return;
      }

      const savedPos = sessionStorage.getItem('kohot_album_scroll_pos');
      if (savedPos) {
        const pos = parseInt(savedPos, 10);
        if (!isNaN(pos) && pos > 0) {
          window.scrollTo({ top: pos, left: 0, behavior: 'instant' });
          requestAnimationFrame(() => {
            window.scrollTo({ top: pos, left: 0, behavior: 'instant' });
          });
          return;
        }
      }
    } catch (e) {}
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentSet.id]);

  // Ensure switching between album clips (people, memories, awards) begins instantly from clips start & marks mutual context change
  const handleTabChange = (tab: 'graduates' | 'memories' | 'awards') => {
    if (tab !== activeTab) {
      hasChangedTabOnAlbumRef.current = true;
      try {
        sessionStorage.setItem('kohot_admin_dashboard_tab', mapAlbumTabToAdminTab(tab));
        sessionStorage.setItem('kohot_admin_section_changed_from_album', '1');
        sessionStorage.removeItem('kohot_admin_dashboard_scroll_pos');
      } catch (e) {}
    }
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
    return (currentSet.students || []).filter(
      (s) =>
        s.approved !== false &&
        s.submissionStatus !== 'removed' &&
        s.submissionStatus !== 'declined' &&
        s.submissionStatus !== 'pending' &&
        s.submissionStatus !== 'changes_requested'
    );
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

  // Preload secondaryPhotoUrl for students in the background so full profile view displays the mini second image immediately
  useEffect(() => {
    if (!filteredStudents || filteredStudents.length === 0) return;
    filteredStudents.forEach((s) => {
      if (s.secondaryPhotoUrl?.trim()) {
        const img = new Image();
        img.decoding = 'async';
        img.src = s.secondaryPhotoUrl.trim();
      }
    });
  }, [filteredStudents]);

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
    if (!isAlbumPublished) {
      setIsPublishModalOpen(true);
      return;
    }
    const albumUrl = getAlbumUrl(currentSet);
    const shareTitle = `${currentSet.classSetName} — ${currentSet.departmentName} (Class of ${currentSet.graduationYear})`;
    const shareText = `Explore the official Class of ${currentSet.graduationYear} digital legacy album for ${currentSet.departmentName}, ${currentSet.institutionName}.`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: albumUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
      }
    }

    const copied = await copyUrlToClipboard(albumUrl);
    if (copied) {
      setIsCopied(true);
      showSuccess('Album link copied to clipboard.', 'Share it with your classmates and alumni.');
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleCopyShareLink = async () => {
    const albumUrl = getAlbumUrl(currentSet);
    const copied = await copyUrlToClipboard(albumUrl);
    if (copied) {
      setIsCopied(true);
      showSuccess('Album link copied to clipboard.', 'Share it with your classmates and alumni.');
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleAddNewStudent = (newStudent: StudentProfile) => {
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

  const handleManageAlbumWithScroll = () => {
    try {
      sessionStorage.setItem('kohot_album_scroll_pos', String(window.scrollY));
      const mappedAdminTab = mapAlbumTabToAdminTab(activeTab);
      const prevAdminTab = sessionStorage.getItem('kohot_admin_dashboard_tab');
      sessionStorage.setItem('kohot_admin_dashboard_tab', mappedAdminTab);
      sessionStorage.setItem('kohot_admin_dashboard_subtab', memoriesViewSubTab);
      if (hasChangedTabOnAlbumRef.current || activeTab !== initialAlbumTabRef.current || (prevAdminTab && prevAdminTab !== mappedAdminTab)) {
        sessionStorage.setItem('kohot_admin_section_changed_from_album', '1');
        sessionStorage.removeItem('kohot_admin_dashboard_scroll_pos');
      }
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

      {/* Unpublished or Deleted Admin Notice Banner */}
      {(currentSet.deletedAt || currentSet.isUnpublished) && (
        <div 
          id="album-status-banner"
          className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-mono-tech text-amber-300 flex items-center justify-center gap-2 relative z-50"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>
            {currentSet.deletedAt
              ? `Admin Notice: This album was soft-deleted and is hidden from public visitors.`
              : 'Admin Notice: This album is unpublished and currently hidden from public visitors.'}
          </span>
        </div>
      )}

      {/* Centralized Sticky Admin Switcher: Main / Manage / Preview (Permanently Centered for Host Demo Albums & Reps) */}
      {(Boolean(onManageAlbum) || Boolean(showMainButton)) && (
        <AlbumAdminSwitcher
          activeMode="preview"
          showMainButton={Boolean(showMainButton && onMainDashboard)}
          showManageButton={Boolean(onManageAlbum)}
          onMainDashboard={onMainDashboard}
          onManageAlbum={handleManageAlbumWithScroll}
          onPreviewAlbum={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          albumLabel={currentSet.classSetName}
        />
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
          {/* Left: Manage (when in Admin Preview mode) or All Albums (for public visitors) */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            {onManageAlbum ? (
              <button
                id="back-to-manage-btn"
                onClick={handleManageAlbumWithScroll}
                className={`flex items-center gap-2 transition-colors cursor-pointer group shrink-0 ${
                  isLightMode ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-300 hover:text-white'
                }`}
                title="Return to Album Admin Dashboard"
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                  isLightMode 
                    ? 'bg-slate-100 group-hover:bg-slate-200 border-slate-300 text-slate-800' 
                    : 'bg-white/5 group-hover:bg-white/10 border-white/10 text-zinc-300 group-hover:text-white'
                }`}>
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-0.5 transition-transform" />
                </div>
                <span className={`font-syne font-bold text-xs sm:text-sm tracking-wide transition-colors ${
                  isLightMode ? 'text-slate-900 group-hover:text-[#d4af37]' : 'text-white group-hover:text-[#d4af37]'
                }`}>
                  Manage
                </span>
              </button>
            ) : (
              <button
                id="back-to-home-btn"
                onClick={onBackToGrid}
                className={`flex items-center gap-2 transition-colors cursor-pointer group shrink-0 ${
                  isLightMode ? 'text-slate-600 hover:text-slate-900' : 'text-zinc-300 hover:text-white'
                }`}
                title="Return to All Albums (Department Legacy Wall)"
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                  isLightMode 
                    ? 'bg-slate-100 group-hover:bg-slate-200 border-slate-300 text-slate-800' 
                    : 'bg-white/5 group-hover:bg-white/10 border-white/10 text-zinc-300 group-hover:text-white'
                }`}>
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-0.5 transition-transform" />
                </div>
                <span className={`font-syne font-bold text-xs sm:text-sm tracking-wide transition-colors ${
                  isLightMode ? 'text-slate-900 group-hover:text-[#d4af37]' : 'text-white group-hover:text-[#d4af37]'
                }`}>
                  All Albums
                </span>
              </button>
            )}
          </div>

          {/* Right: Ambient Audio Toggle, Light Mode Toggle, Save & Share Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {ambientMusicUrl && (
              <>
                <audio
                  ref={ambientAudioRef}
                  src={ambientMusicUrl}
                  loop
                  preload="auto"
                  className="hidden"
                />
                <button
                  id="album-ambient-audio-toggle-btn"
                  type="button"
                  onClick={toggleAmbientAudio}
                  className={`px-3 py-1.5 sm:py-2 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0 ${
                    isLightMode
                      ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900 font-tech text-xs tracking-wider uppercase font-semibold'
                      : 'bg-white/[0.08] hover:bg-white/[0.15] border-white/20 text-white font-tech text-xs tracking-wider uppercase font-semibold'
                  }`}
                  title={isAmbientMuted ? 'Unmute Album Ambient Soundtrack' : 'Mute Album Ambient Soundtrack'}
                  aria-label={isAmbientMuted ? 'Unmute Album Ambient Soundtrack' : 'Mute Album Ambient Soundtrack'}
                >
                  {isAmbientMuted ? (
                    <VolumeX className={`w-3.5 h-3.5 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#d4af37]" />
                  )}
                  <span className="hidden md:inline">{isAmbientMuted ? 'Sound Off' : 'Sound On'}</span>
                </button>
              </>
            )}
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
              id="album-keep-btn"
              onClick={() => {
                if (!isAlbumPublished) {
                  setIsPublishModalOpen(true);
                  return;
                }
                setIsKeepSheetOpen(true);
              }}
              className={`px-3.5 py-1.5 sm:py-2 rounded-full border font-tech text-xs tracking-wider uppercase font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0 ${
                !isAlbumPublished
                  ? isLightMode
                    ? 'bg-zinc-100/80 border-zinc-300 text-zinc-500 hover:text-zinc-900'
                    : 'bg-white/[0.05] border-white/15 text-zinc-400 hover:text-white'
                  : isLightMode 
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900' 
                    : 'bg-white/[0.08] hover:bg-white/[0.15] border-white/20 text-white'
              }`}
              title={isAlbumPublished ? 'Save this album' : 'Publish album to enable Save'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isLightMode ? 'text-zinc-700' : 'text-[#d4af37]'}`} />
              <span>Save</span>
            </button>

            <button
              id="album-share-btn"
              onClick={handleShareAlbum}
              className={`px-3.5 py-1.5 sm:py-2 rounded-full font-tech text-xs tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0 ${
                !isAlbumPublished
                  ? isLightMode
                    ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700 border border-zinc-300'
                    : 'bg-white/15 hover:bg-white/25 text-zinc-200 border border-white/20'
                  : isLightMode 
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-white' 
                    : 'bg-white hover:bg-zinc-200 text-black'
              }`}
              title={isAlbumPublished ? 'Share this album with classmates and alumni' : 'Publish album to enable Share'}
            >
              <Share2 className={`w-3.5 h-3.5 ${!isAlbumPublished ? 'opacity-80' : isLightMode ? 'text-white' : 'text-black'}`} />
              <span>Share</span>
            </button>
          </div>
        </div>
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
                {/* University Logo (Reflecting Directory on Owner Dashboard) */}
                {effectiveUniLogo && (
                  <div 
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border-2 border-amber-500/40 bg-white p-1 shrink-0 shadow-lg flex items-center justify-center"
                    title={`University: ${currentSet.institutionName}`}
                  >
                    <img
                      src={effectiveUniLogo}
                      alt={currentSet.institutionName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* Department Logo (Reflecting Directory on Owner Dashboard) */}
                <div 
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border-2 border-amber-500/40 bg-white p-1 shrink-0 shadow-lg flex items-center justify-center"
                  title={`Department: ${currentSet.departmentName}`}
                >
                  {effectiveDeptLogo ? (
                    <img
                      src={effectiveDeptLogo}
                      alt={currentSet.departmentName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-amber-500/20 text-[#d4af37] flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-[#d4af37]" />
                    </div>
                  )}
                </div>
              </div>

              {/* University Name Above, Department Name Below (Arranged identically to Legacy Wall) */}
              <div className="text-center space-y-1.5 pt-1">
                <p className="font-syne font-semibold text-xs sm:text-sm text-zinc-400 tracking-wider uppercase text-center">
                  {currentSet.institutionName.toUpperCase()}
                </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-syne font-bold text-white tracking-tight leading-snug uppercase text-center">
                  {currentSet.departmentName.toUpperCase().startsWith('DEPARTMENT OF')
                    ? currentSet.departmentName.toUpperCase()
                    : currentSet.departmentName.toUpperCase().startsWith('DEPARTMENT')
                      ? currentSet.departmentName.toUpperCase()
                      : `DEPARTMENT OF ${currentSet.departmentName.toUpperCase()}`}
                </p>
                <p className="font-mono-tech text-xs sm:text-sm uppercase tracking-[0.22em] text-[#d4af37] font-extrabold mt-0.5">
                  Class of {currentSet.graduationYear}
                </p>
              </div>
            </div>

            {/* Headline Display Font: Clean Class Title / Set Name without '- Class of 202...' */}
            <h1 
              id="department-headline-title"
              className="font-syne font-bold text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-[1.08] max-w-3xl text-center mx-auto animate-slow-reveal animation-delay-200 mt-2"
            >
              {formatCleanClassSetName(currentSet.classSetName, `${currentSet.departmentName} ’${String(currentSet.graduationYear).slice(-2)}`)}
            </h1>

            {/* Class Slogan / Motto Under Class Name */}
            {currentSet.classSlogan && (
              <p className="font-body italic text-sm sm:text-base md:text-lg text-amber-300/90 max-w-xl text-center mx-auto mt-2.5 animate-slow-reveal animation-delay-250">
                “{currentSet.classSlogan.replace(/^["“”']+|["“”']+$/g, '')}”
              </p>
            )}

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
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-4">
          <div className="flex items-center justify-center gap-2 shrink-0 mx-auto">
            {showGraduates && (
              <button
                id="tab-btn-people"
                onClick={(e) => {
                  handleTabChange('graduates');
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
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
                onClick={(e) => {
                  handleTabChange('memories');
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
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
                <span>Memories</span>
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
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {/* Filter Clip 1: ALL */}
                <button
                  id="filter-clip-all"
                  onClick={(e) => {
                    setCohortFilter('all');
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
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
                  onClick={(e) => {
                    setCohortFilter('leaders');
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
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
              const twoLineQuote = (student.quote || student.bio || '').trim();
              const roleTag = student.position && student.position.toLowerCase() !== 'member' ? student.position : '';

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

                  {/* Photo Avatar (Square 1:1, object-cover) */}
                  <div className={`relative w-full aspect-square overflow-hidden ${
                    isLightMode ? 'bg-slate-100' : 'bg-zinc-950'
                  }`}>
                    <GlazedImage
                      src={student.photoUrl}
                      alt={student.fullName}
                      className="w-full h-full object-cover object-center filter contrast-[1.04] group-hover/card:scale-108 transition-transform duration-700 ease-out"
                      containerClassName="w-full h-full"
                    />
                    {!isLightMode && (
                      <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/25 to-transparent opacity-80 group-hover/card:opacity-50 transition-opacity duration-300 pointer-events-none" />
                    )}

                    {/* Role tag pill on photo */}
                    {roleTag && (
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
                          {roleTag}
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

                  {/* Grid Card Body: Name, Nickname, and Two-Line Quote only */}
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
                    </div>

                    {twoLineQuote && (
                      <p className={`font-body italic text-[11px] mt-2.5 line-clamp-2 leading-relaxed transition-colors ${
                        isLightMode ? 'text-slate-600' : 'text-zinc-400 group-hover/card:text-zinc-300'
                      }`}>
                        “{twoLineQuote.replace(/^["“”']+|["“”']+$/g, '')}”
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
          TAB 2: UNIFIED MEMORIES VIEW (KEPT MOUNTED FOR INSTANT ZERO-DELAY DISPLAY)
          ========================================================================= */}
      {showMemories && (() => {
        const highlightVideos = (currentSet.videos || []).filter((v) =>
          Boolean((v.youtubeUrl || v.videoUrl || '').trim())
        );
        const hasVideos = highlightVideos.length > 0;
        const sortedMemories = [...(currentSet.memories || [])].sort(
          (a, b) => (a.order ?? 999) - (b.order ?? 999)
        );
        const hasPhotoCategories = sortedMemories.length > 0;

        return (
          <section
            id="memories-section"
            aria-hidden={activeTab !== 'memories'}
            className={
              activeTab === 'memories'
                ? 'w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12'
                : 'fixed -left-[9999px] top-0 w-[1024px] h-[600px] overflow-hidden opacity-0 pointer-events-none select-none'
            }
          >
            {/* Section Header - Centralized */}
            <div className="text-center space-y-1">
              <h2 className={`font-syne font-bold text-2xl sm:text-3xl tracking-tight ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>
                MEMORIES
              </h2>
              <p className={`font-body text-xs sm:text-sm max-w-lg mx-auto ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                The days, nights and milestones that defined this class.
              </p>
            </div>

            {!hasVideos && !hasPhotoCategories && (
              <div
                className={`text-center py-16 px-6 border border-dashed rounded-3xl space-y-3 ${
                  isLightMode ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#18181b] border-white/10 text-white'
                }`}
              >
                <Camera className="w-8 h-8 text-zinc-500 mx-auto" />
                <p className={`font-syne text-lg ${isLightMode ? 'text-zinc-900' : 'text-white'}`}>No Memories Captured Yet</p>
                <p className={`font-body text-xs max-w-md mx-auto ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Highlight videos and milestone celebrations like Sign-out Day, Cultural Day, and Convocation memories will appear here.
                </p>
              </div>
            )}

            {/* 1. HIGHLIGHTS SECTION (Horizontally Swipeable, No Thumbnail, Autoplays First 10s on Repeat) */}
            {hasVideos && (
              <div id="highlights-view-showcase" className="space-y-4">
                <div className={`flex items-center justify-between gap-3 border-b pb-3 ${isLightMode ? 'border-zinc-200' : 'border-white/10'}`}>
                  <h3
                    className={`font-syne font-bold text-xl sm:text-2xl tracking-tight ${
                      isLightMode ? 'text-zinc-900' : 'text-white'
                    }`}
                  >
                    Highlights
                  </h3>
                </div>

                {/* Horizontally Swipeable Highlights Carousel */}
                <div
                  className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-2 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory"
                >
                  {highlightVideos.map((vid) => {
                    const ytId = extractYouTubeId(vid.youtubeUrl);
                    const embedInfo = getUniversalVideoEmbedUrl(vid.youtubeUrl);
                    const streamSrc = ytId
                      ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${ytId}&start=0&end=10&playsinline=1&modestbranding=1`
                      : embedInfo.embedUrl;

                    return (
                      <div
                        key={vid.id}
                        id={`video-card-${vid.id}`}
                        onClick={() => {
                          setSelectedVideo(vid);
                          setIsVideoModalOpen(true);
                        }}
                        className={`group snap-start shrink-0 w-[260px] sm:w-[310px] rounded-2xl overflow-hidden transition-all flex flex-col shadow-lg border cursor-pointer ${
                          isLightMode
                            ? 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400'
                            : 'bg-[#0e1017] border-white/[0.08] text-white hover:border-white/30'
                        }`}
                      >
                        {/* Strictly Square Video Container */}
                        <div className="relative aspect-square w-full overflow-hidden bg-black">
                          {streamSrc && (
                            <iframe
                              src={streamSrc}
                              title={vid.title}
                              loading="eager"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              className="absolute top-1/2 left-1/2 w-[185%] h-[185%] -translate-x-1/2 -translate-y-1/2 pointer-events-none border-0"
                              tabIndex={-1}
                            />
                          )}

                          <div className="kohot-media-scrim absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                          {/* Date Badge */}
                          {vid.dateStr && (
                            <div className="absolute top-3 left-3 pointer-events-none">
                              <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono-tech text-white uppercase tracking-wider font-semibold">
                                {vid.dateStr}
                              </span>
                            </div>
                          )}

                          {/* Minimal Center Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#ef4444]/95 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />
                            </div>
                          </div>

                          {/* Minimal Bottom Title Overlay */}
                          <div className="absolute inset-x-3.5 bottom-3.5 pointer-events-none">
                            <h4 className="kohot-keep-color font-syne font-bold text-sm text-white leading-snug line-clamp-2 drop-shadow-md">
                              {vid.title}
                            </h4>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. MOMENTS SECTION (Sticky Category Filter Clips + People-Sized Swipable Cards) */}
            {hasPhotoCategories && (() => {
              const totalMomentsPhotoCount = sortedMemories.reduce(
                (acc, cat) => acc + (cat.images?.length || 0),
                0
              );
              const visibleMemories =
                selectedMomentCategoryId === 'all' ||
                !sortedMemories.some((m) => m.id === selectedMomentCategoryId)
                  ? sortedMemories
                  : sortedMemories.filter((m) => m.id === selectedMomentCategoryId);

              return (
              <div id="moments-view-showcase" className="space-y-6">
                <div className={`flex items-baseline justify-between gap-3 border-b pb-3 ${isLightMode ? 'border-zinc-200' : 'border-white/10'}`}>
                  <h3
                    className={`font-syne font-bold text-xl sm:text-2xl tracking-tight ${
                      isLightMode ? 'text-zinc-900' : 'text-white'
                    }`}
                  >
                    Moments
                  </h3>
                  <span className={`font-mono-tech text-[11px] ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Tap any photo for full view
                  </span>
                </div>

                {/* Sticky Filter Clips Bar for Moments (All + Each Category) */}
                <div
                  id="moments-sticky-filter-clips"
                  className={`sticky top-[113px] z-20 -mx-4 px-4 sm:mx-0 sm:px-4 py-2.5 rounded-2xl border backdrop-blur-md transition-colors ${
                    isLightMode
                      ? 'bg-white/95 border-slate-200 shadow-xs'
                      : 'bg-[#121214]/95 border-white/10 shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      id="moments-filter-clip-all"
                      onClick={(e) => {
                        setSelectedMomentCategoryId('all');
                        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        selectedMomentCategoryId === 'all'
                          ? isLightMode
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'bg-white text-black font-bold shadow-md'
                          : isLightMode
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                      }`}
                    >
                      <span>All</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          selectedMomentCategoryId === 'all'
                            ? isLightMode
                              ? 'bg-white/20 text-white'
                              : 'bg-black/15 text-black'
                            : isLightMode
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-white/10 text-zinc-300'
                        }`}
                      >
                        {totalMomentsPhotoCount}
                      </span>
                    </button>

                    {sortedMemories.map((cat) => {
                      const isActiveClip = selectedMomentCategoryId === cat.id;
                      const count = cat.images?.length || 0;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          id={`moments-filter-clip-${cat.id}`}
                          onClick={(e) => {
                            setSelectedMomentCategoryId(cat.id);
                            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                            isActiveClip
                              ? isLightMode
                                ? 'bg-slate-900 text-white font-bold shadow-xs'
                                : 'bg-white text-black font-bold shadow-md'
                              : isLightMode
                                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                          }`}
                        >
                          <span>{cat.title}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              isActiveClip
                                ? isLightMode
                                  ? 'bg-white/20 text-white'
                                  : 'bg-black/15 text-black'
                                : isLightMode
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'bg-white/10 text-zinc-300'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-10">
                  {visibleMemories.map((event) => (
                    <div key={event.id} id={`memory-event-${event.id}`} className="space-y-3">
                      <div
                        className={`border-b pb-3.5 ${
                          isLightMode ? 'border-zinc-200' : 'border-white/10'
                        }`}
                      >
                        <div className="space-y-1 text-left">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h4
                              className={`font-syne font-bold text-lg sm:text-xl tracking-tight leading-tight ${
                                isLightMode ? 'text-zinc-900' : 'text-white'
                              }`}
                            >
                              {event.title}
                            </h4>
                            {event.dateStr && (
                              <span
                                className={`text-xs font-mono-tech px-2.5 py-0.5 rounded-full border ${
                                  isLightMode
                                    ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                    : 'bg-white/5 text-zinc-400 border-white/10'
                                }`}
                              >
                                {event.dateStr}
                              </span>
                            )}
                          </div>
                          {event.caption && (
                            <p
                              className={`font-body text-xs sm:text-sm max-w-2xl leading-relaxed ${
                                isLightMode ? 'text-zinc-600' : 'text-zinc-300'
                              }`}
                            >
                              {event.caption}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Horizontal Touch-Swipeable Carousel */}
                      <div
                        id={`carousel-${event.id}`}
                        className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-2 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory"
                      >
                        {(event.images || []).map((img) => {
                          const displayCaption =
                            img.caption && img.caption.trim().length > 0 ? img.caption.trim() : event.title;
                          return (
                            <div
                              key={img.id}
                              className={`snap-start shrink-0 w-[260px] sm:w-[310px] rounded-2xl overflow-hidden transition-all flex flex-col shadow-lg border ${
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
                                    dateStr?: string;
                                  }> = [];

                                  sortedMemories.forEach((cat, catIdx) => {
                                    (cat.images || []).forEach((im, iIdx) => {
                                      allMoments.push({
                                        id: im.id,
                                        url: im.url,
                                        caption:
                                          im.caption && im.caption.trim().length > 0 ? im.caption.trim() : cat.title,
                                        eventId: cat.id,
                                        title: cat.title,
                                        categoryTitle: cat.title,
                                        categoryIndex: catIdx,
                                        totalCategories: sortedMemories.length,
                                        imageIndexInCategory: iIdx,
                                        totalImagesInCategory: (cat.images || []).length,
                                        dateStr: im.dateTime || cat.dateStr || undefined,
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
                                  priority={true}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  containerClassName="w-full h-full"
                                />
                                <div className="kohot-media-scrim absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none" />
                                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-xs text-[10px] font-mono-tech text-white/85 border border-white/15 flex items-center gap-1 pointer-events-none">
                                  <Eye className="w-2.5 h-2.5 opacity-80" />
                                  <span>Full view</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {event.morePhotosUrl && event.morePhotosUrl.trim().length > 0 && (
                        <div className="pt-1 flex items-center justify-start">
                          <a
                            href={
                              event.morePhotosUrl.trim().startsWith('http://') ||
                              event.morePhotosUrl.trim().startsWith('https://')
                                ? event.morePhotosUrl.trim()
                                : `https://${event.morePhotosUrl.trim()}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-mono-tech text-xs font-semibold transition-colors cursor-pointer ${
                              isLightMode
                                ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
                                : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white'
                            }`}
                          >
                            <span>Explore full photo archive</span>
                            <ExternalLink className="w-3.5 h-3.5 text-[#d4af37]" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}
          </section>
        );
      })()}


      {/* =========================================================================
          FINAL CELEBRATORY BANNER: THIS IS OUR LEGACY.
          Featuring album admin name, class portrait, department & set details, and social links
          ========================================================================= */}
      {(() => {
        const normalizeSocialHref = (raw: string | undefined, kind: 'youtube' | 'instagram' | 'twitter' | 'linkedin' | 'website'): string => {
          const val = (raw || '').trim();
          if (!val) return '';
          if (val.startsWith('http://') || val.startsWith('https://')) return val;
          if (kind === 'youtube') {
            return val.startsWith('youtube.com') || val.startsWith('youtu.be')
              ? `https://${val}`
              : `https://youtube.com/@${val.replace(/^@/, '')}`;
          }
          if (kind === 'instagram') {
            return val.startsWith('instagram.com')
              ? `https://${val}`
              : `https://instagram.com/${val.replace(/^@/, '')}`;
          }
          if (kind === 'twitter') {
            return val.startsWith('x.com') || val.startsWith('twitter.com')
              ? `https://${val}`
              : `https://x.com/${val.replace(/^@/, '')}`;
          }
          if (kind === 'linkedin') {
            return val.startsWith('linkedin.com')
              ? `https://${val}`
              : `https://linkedin.com/company/${val.replace(/^@/, '')}`;
          }
          return `https://${val}`;
        };

        // 1. Department Association Socials (Edited by Album Admin via Album Edit button; never shows unconfigured defaults)
        const rawDeptSocials = currentSet.socials || {};
        const deptYtHref = normalizeSocialHref(rawDeptSocials.youtube, 'youtube');
        const deptIgHref = normalizeSocialHref(rawDeptSocials.instagram, 'instagram');
        const deptTwHref = normalizeSocialHref(rawDeptSocials.twitter, 'twitter');
        const deptLiHref = normalizeSocialHref(rawDeptSocials.linkedin, 'linkedin');
        const deptWebHref = normalizeSocialHref(rawDeptSocials.website, 'website');
        const hasAnyDeptSocial = Boolean(deptYtHref || deptIgHref || deptTwHref || deptLiHref || deptWebHref);
        const assocName = (currentSet.departmentAssociationName || '').trim();

        // 2. KOHOT Platform Footer Socials (Edited ONLY by Host in Album Media section of Host Dashboard)
        const rawKohotSocials = contentOverride?.kohotSocials || {};
        const kohotYtHref = normalizeSocialHref(rawKohotSocials.youtube, 'youtube');
        const kohotIgHref = normalizeSocialHref(rawKohotSocials.instagram, 'instagram');
        const kohotTwHref = normalizeSocialHref(rawKohotSocials.twitter, 'twitter');
        const kohotLiHref = normalizeSocialHref(rawKohotSocials.linkedin, 'linkedin');
        const kohotWebHref = normalizeSocialHref(rawKohotSocials.website, 'website');
        const hasAnyKohotSocial = Boolean(kohotYtHref || kohotIgHref || kohotTwHref || kohotLiHref || kohotWebHref);

        const cleanDisplayClassName = formatCleanClassSetName(
          currentSet.classSetName,
          `${currentSet.departmentName} ’${String(currentSet.graduationYear).slice(-2)}`
        );

        return (
          <>
            <section
              id="album-our-legacy-banner"
              className="relative w-full min-h-[48vh] sm:min-h-[60vh] flex flex-col justify-center items-center overflow-hidden bg-black mt-14 select-none"
            >
              <div className="absolute inset-0 z-0">
                <img
                  src={
                    currentSet.legacyGroupImageUrl ||
                    currentSet.legacyFooterUrl ||
                    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop'
                  }
                  alt="This is our legacy - celebratory class portrait"
                  className="w-full h-full object-cover object-center filter brightness-[0.52] contrast-[1.08]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#060709] via-transparent to-[#060709] pointer-events-none" />
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              </div>

              {/* Content Overlay with Department Association Social Links directly under Album Admin */}
              <div className="relative z-10 w-full max-w-4xl mx-auto px-6 text-center py-12 space-y-3">
                <p className="font-mono-tech text-[10px] sm:text-xs uppercase tracking-[0.22em] text-white/80 font-semibold animate-fadeIn">
                  {currentSet.institutionName} • {currentSet.departmentName} • Class of {currentSet.graduationYear}
                </p>

                <h2
                  id="this-is-our-legacy-heading"
                  className="font-syne font-black text-2xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight drop-shadow-2xl"
                >
                  THIS IS OUR LEGACY.
                </h2>

                <div className="space-y-2 pt-1">
                  <p className="font-syne font-bold text-xs sm:text-sm text-[#d4af37] tracking-wide">
                    {cleanDisplayClassName}
                  </p>

                  {currentSet.classSlogan && (
                    <p className="font-body italic text-[11px] sm:text-xs text-white/75 max-w-xl mx-auto">
                      “{currentSet.classSlogan.replace(/^["“”']+|["“”']+$/g, '')}”
                    </p>
                  )}

                  {/* Album Admin Name */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-mono-tech text-[10px] sm:text-[11px] tracking-wider">
                    <span className="text-[#d4af37] font-semibold">Album Admin:</span>
                    <span className="font-bold">{currentSet.classRepName || 'Class Album Committee Lead'}</span>
                  </div>

                  {/* Department Association Social Icons (Only shown when Album Admin has uploaded at least one social link) */}
                  {hasAnyDeptSocial && (
                    <div className="pt-2">
                      <div id="album-legacy-banner-social-icons" className="flex items-center justify-center gap-2.5 text-zinc-300">
                        <span className="font-mono-tech text-[10px] sm:text-[11px] tracking-wider text-zinc-300 font-medium">
                          Follow {assocName || 'us'} on:
                        </span>
                        {deptYtHref && (
                          <a
                            href={deptYtHref}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/20 border border-white/15 hover:border-red-500/40 flex items-center justify-center text-zinc-200 hover:text-red-400 transition-all"
                            title={`${assocName || 'Department'} YouTube Channel`}
                            aria-label={`${assocName || 'Department'} YouTube Channel`}
                          >
                            <Youtube className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {deptIgHref && (
                          <a
                            href={deptIgHref}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-pink-500/20 border border-white/15 hover:border-pink-500/40 flex items-center justify-center text-zinc-200 hover:text-pink-400 transition-all"
                            title={`${assocName || 'Department'} Instagram`}
                            aria-label={`${assocName || 'Department'} Instagram`}
                          >
                            <Instagram className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {deptTwHref && (
                          <a
                            href={deptTwHref}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 flex items-center justify-center text-zinc-200 hover:text-white transition-all"
                            title={`${assocName || 'Department'} X (Twitter)`}
                            aria-label={`${assocName || 'Department'} X (Twitter)`}
                          >
                            <Twitter className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {deptLiHref && (
                          <a
                            href={deptLiHref}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-blue-500/20 border border-white/15 hover:border-blue-500/40 flex items-center justify-center text-zinc-200 hover:text-blue-400 transition-all"
                            title={`${assocName || 'Department'} LinkedIn`}
                            aria-label={`${assocName || 'Department'} LinkedIn`}
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {deptWebHref && (
                          <a
                            href={deptWebHref}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-emerald-500/20 border border-white/15 hover:border-emerald-500/40 flex items-center justify-center text-zinc-200 hover:text-emerald-400 transition-all"
                            title={`${assocName || 'Department'} Official Website`}
                            aria-label={`${assocName || 'Department'} Official Website`}
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Minimalist KOHOT Footer — Standardized across Album, Legacy Wall & Website */}
            <footer
              id="album-minimalist-footer"
              className="relative z-10 w-full bg-[#060709] border-t border-white/[0.08] py-7 px-6 text-center text-zinc-400"
            >
              <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col items-center sm:items-start gap-1">
                  <span className="font-syne font-extrabold text-sm sm:text-base tracking-widest text-white uppercase">
                    KOHOT
                  </span>
                  <span className="font-body text-[11px] text-zinc-400">
                    Preserve the memories.
                  </span>
                  {hasAnyKohotSocial && (
                    <div id="album-footer-social-icons" className="flex items-center justify-center sm:justify-start gap-2 pt-1.5 text-zinc-300">
                      {kohotYtHref && (
                        <a
                          href={kohotYtHref}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/20 border border-white/15 hover:border-red-500/40 flex items-center justify-center text-zinc-200 hover:text-red-400 transition-all"
                          title="KOHOT YouTube"
                          aria-label="KOHOT YouTube"
                        >
                          <Youtube className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {kohotIgHref && (
                        <a
                          href={kohotIgHref}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-pink-500/20 border border-white/15 hover:border-pink-500/40 flex items-center justify-center text-zinc-200 hover:text-pink-400 transition-all"
                          title="KOHOT Instagram"
                          aria-label="KOHOT Instagram"
                        >
                          <Instagram className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {kohotTwHref && (
                        <a
                          href={kohotTwHref}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 flex items-center justify-center text-zinc-200 hover:text-white transition-all"
                          title="KOHOT X (Twitter)"
                          aria-label="KOHOT X (Twitter)"
                        >
                          <Twitter className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {kohotLiHref && (
                        <a
                          href={kohotLiHref}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-blue-500/20 border border-white/15 hover:border-blue-500/40 flex items-center justify-center text-zinc-200 hover:text-blue-400 transition-all"
                          title="KOHOT LinkedIn"
                          aria-label="KOHOT LinkedIn"
                        >
                          <Linkedin className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {kohotWebHref && (
                        <a
                          href={kohotWebHref}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-emerald-500/20 border border-white/15 hover:border-emerald-500/40 flex items-center justify-center text-zinc-200 hover:text-emerald-400 transition-all"
                          title="KOHOT Website"
                          aria-label="KOHOT Website"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 font-mono-tech text-[10px] text-zinc-400">
                  <span>{currentSet.departmentName} • {cleanDisplayClassName}</span>
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
          </>
        );
      })()}


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
        awards={currentSet.awards}
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

      {/* Keep This Album Sheet */}
      <KeepAlbumSheet
        isOpen={isKeepSheetOpen}
        onClose={() => setIsKeepSheetOpen(false)}
        currentSet={currentSet}
        isLightMode={isLightMode}
      />

      {/* Share This Album Modal (Opens without auto-copying link) */}
      {isShareModalOpen && (() => {
        const albumUrl = getAlbumUrl(currentSet);
        const shareText = `Explore the official ${currentSet.departmentName} (Class of ${currentSet.graduationYear}) Album on KoHot:\n${albumUrl}`;
        const modalEl = (
          <div
            id="public-album-share-modal-backdrop"
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
            onClick={() => setIsShareModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-5 select-auto ${
                isLightMode
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-[#18181b] border-zinc-700 text-white'
              }`}
            >
              <div className={`flex items-center justify-between pb-3 border-b ${isLightMode ? 'border-slate-200' : 'border-zinc-800'}`}>
                <div>
                  <h3 className="font-syne font-bold text-lg">Share album</h3>
                  <p className={`font-mono-tech text-xs ${isLightMode ? 'text-slate-500' : 'text-zinc-400'}`}>
                    {currentSet.departmentName} · Class of {currentSet.graduationYear}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isLightMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                  }`}
                  aria-label="Close share dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className={`block text-xs font-mono-tech uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Album link
                </label>
                <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                  isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-zinc-900 border-zinc-800'
                }`}>
                  <span className={`font-mono-tech text-xs truncate select-all ${isLightMode ? 'text-slate-800' : 'text-zinc-200'}`}>
                    {albumUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <span>{isCopied ? 'Copied!' : 'Copy link'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className={`block text-xs font-mono-tech uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Share via
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-3 rounded-xl border font-mono-tech text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isLightMode
                        ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(albumUrl)}&text=${encodeURIComponent(`Explore the ${currentSet.departmentName} Class of ${currentSet.graduationYear} Album on KoHot`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-3 rounded-xl border font-mono-tech text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isLightMode
                        ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800'
                        : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/30 text-sky-300'
                    }`}
                  >
                    <span>Telegram</span>
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof navigator !== 'undefined' && 'share' in navigator) {
                        try {
                          await navigator.share({
                            title: `${currentSet.departmentName} — Class of ${currentSet.graduationYear}`,
                            text: `Explore the official ${currentSet.departmentName} Class of ${currentSet.graduationYear} Album on KoHot!`,
                            url: albumUrl,
                          });
                        } catch {
                          // user dismissed
                        }
                      } else {
                        window.open(
                          `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Explore the official ${currentSet.departmentName} Class of ${currentSet.graduationYear} Album on KoHot:`)}&url=${encodeURIComponent(albumUrl)}`,
                          '_blank'
                        );
                      }
                    }}
                    className={`p-3 rounded-xl border font-mono-tech text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isLightMode
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                        : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>More</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(modalEl, document.body) : modalEl;
      })()}

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

      {/* Moments Fullscreen View - Single tap on image toggles dark/light mode; double tap on image ONLY toggles zoom; clamped pan; slim 6px gap; no border line */}
      {lightboxMomentIndex !== null && lightboxMomentsList[lightboxMomentIndex] && (() => {
        const totalCount = lightboxMomentsList.length;
        const currentMoment = lightboxMomentsList[lightboxMomentIndex];
        const prevIndex = (lightboxMomentIndex - 1 + totalCount) % totalCount;
        const nextIndex = (lightboxMomentIndex + 1) % totalCount;
        const prevMoment = lightboxMomentsList[prevIndex];
        const nextMoment = lightboxMomentsList[nextIndex];
        const gapPx = 6;

        const handleActiveImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
          e.stopPropagation();
          if (hasMomentDraggedRef.current || Math.abs(momentSwipeOffsetPx) > 2) {
            hasMomentDraggedRef.current = false;
            return;
          }
          const now = Date.now();
          if (now - momentLastTapRef.current < 280) {
            // Double tap on image: cancel single-tap theme toggle and ONLY toggle zoom
            if (momentSingleTapTimerRef.current) {
              window.clearTimeout(momentSingleTapTimerRef.current);
              momentSingleTapTimerRef.current = null;
            }
            momentLastTapRef.current = 0;
            setMomentZoomScale((prev) => {
              const next = prev > 1.2 ? 1 : 2;
              setMomentPanPos({ x: 0, y: 0 });
              return next;
            });
          } else {
            // Single tap on image: wait 260ms to confirm it's not a double tap, then toggle light/dark mode
            momentLastTapRef.current = now;
            if (momentSingleTapTimerRef.current) {
              window.clearTimeout(momentSingleTapTimerRef.current);
            }
            momentSingleTapTimerRef.current = window.setTimeout(() => {
              setMomentCardMode((prev) => (prev === 'light' ? 'dark' : 'light'));
              momentSingleTapTimerRef.current = null;
            }, 260);
          }
        };

        const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
          if (momentSwipeTimerRef.current) return;
          if (e.touches.length === 2) {
            e.stopPropagation();
            if (momentSingleTapTimerRef.current) {
              window.clearTimeout(momentSingleTapTimerRef.current);
              momentSingleTapTimerRef.current = null;
            }
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            momentTouchDistRef.current = dist;
            momentLastScaleRef.current = momentZoomScale;
          } else if (e.touches.length === 1) {
            isDraggingMomentRef.current = true;
            hasMomentDraggedRef.current = false;
            setMomentSwipeTransition(false);
            dragMomentStartRef.current = {
              clientX: e.touches[0].clientX,
              clientY: e.touches[0].clientY,
              startX: momentZoomScale > 1.05 ? momentPanPos.x : momentSwipeOffsetPx,
              startY: momentPanPos.y,
            };
          }
        };

        const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
          if (momentSwipeTimerRef.current) return;
          if (e.touches.length === 2 && momentTouchDistRef.current !== null) {
            e.stopPropagation();
            hasMomentDraggedRef.current = true;
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = dist / momentTouchDistRef.current;
            const nextScale = Math.min(Math.max(momentLastScaleRef.current * ratio, 1), 3.5);
            setMomentZoomScale(nextScale);
            setMomentPanPos((prev) => clampMomentPan(prev.x, prev.y, nextScale));
          } else if (e.touches.length === 1 && isDraggingMomentRef.current) {
            const dx = e.touches[0].clientX - dragMomentStartRef.current.clientX;
            const dy = e.touches[0].clientY - dragMomentStartRef.current.clientY;
            if (momentZoomScale > 1.05) {
              e.stopPropagation();
              if (Math.hypot(dx, dy) > 5) {
                hasMomentDraggedRef.current = true;
              }
              setMomentPanPos(
                clampMomentPan(
                  dragMomentStartRef.current.startX + dx,
                  dragMomentStartRef.current.startY + dy,
                  momentZoomScale
                )
              );
            } else if (totalCount > 1 && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4) {
              hasMomentDraggedRef.current = true;
              setMomentSwipeTransition(false);
              setMomentSwipeOffsetPx(dx);
            }
          }
        };

        const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
          if (isDraggingMomentRef.current && momentZoomScale <= 1.05 && e.changedTouches.length === 1) {
            const dx = e.changedTouches[0].clientX - dragMomentStartRef.current.clientX;
            const dy = e.changedTouches[0].clientY - dragMomentStartRef.current.clientY;
            const threshold = Math.min(72, (typeof window !== 'undefined' ? window.innerWidth : 360) * 0.14);
            if (totalCount > 1 && Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
              hasMomentDraggedRef.current = true;
              if (dx < 0) {
                animateMomentGallerySlide('next');
              } else {
                animateMomentGallerySlide('prev');
              }
            } else if (momentSwipeOffsetPx !== 0) {
              setMomentSwipeTransition(true);
              setMomentSwipeOffsetPx(0);
            }
          }
          isDraggingMomentRef.current = false;
          if (e.touches.length < 2) {
            momentTouchDistRef.current = null;
            momentLastScaleRef.current = momentZoomScale;
            if (momentZoomScale < 1.05) {
              setMomentZoomScale(1);
              setMomentPanPos({ x: 0, y: 0 });
            } else {
              setMomentPanPos((prev) => clampMomentPan(prev.x, prev.y, momentZoomScale));
            }
          }
        };

        const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
          if (momentSwipeTimerRef.current) return;
          isDraggingMomentRef.current = true;
          hasMomentDraggedRef.current = false;
          setMomentSwipeTransition(false);
          dragMomentStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            startX: momentZoomScale > 1.05 ? momentPanPos.x : momentSwipeOffsetPx,
            startY: momentPanPos.y,
          };
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
          if (!isDraggingMomentRef.current || momentSwipeTimerRef.current) return;
          const dx = e.clientX - dragMomentStartRef.current.clientX;
          const dy = e.clientY - dragMomentStartRef.current.clientY;
          if (momentZoomScale > 1.05) {
            if (Math.hypot(dx, dy) > 5) {
              hasMomentDraggedRef.current = true;
            }
            setMomentPanPos(
              clampMomentPan(
                dragMomentStartRef.current.startX + dx,
                dragMomentStartRef.current.startY + dy,
                momentZoomScale
              )
            );
          } else if (totalCount > 1 && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4) {
            hasMomentDraggedRef.current = true;
            setMomentSwipeTransition(false);
            setMomentSwipeOffsetPx(dx);
          }
        };

        const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
          if (isDraggingMomentRef.current && momentZoomScale <= 1.05) {
            const dx = e.clientX - dragMomentStartRef.current.clientX;
            const dy = e.clientY - dragMomentStartRef.current.clientY;
            const threshold = Math.min(72, (typeof window !== 'undefined' ? window.innerWidth : 360) * 0.14);
            if (totalCount > 1 && Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
              hasMomentDraggedRef.current = true;
              if (dx < 0) {
                animateMomentGallerySlide('next');
              } else {
                animateMomentGallerySlide('prev');
              }
            } else if (momentSwipeOffsetPx !== 0) {
              setMomentSwipeTransition(true);
              setMomentSwipeOffsetPx(0);
            }
          }
          isDraggingMomentRef.current = false;
        };

        const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.01;
            setMomentZoomScale((prev) => {
              const next = Math.min(Math.max(prev + delta, 1), 3.5);
              if (next <= 1.05) {
                setMomentPanPos({ x: 0, y: 0 });
              } else {
                setMomentPanPos((pos) => clampMomentPan(pos.x, pos.y, next));
              }
              return next;
            });
          }
        };

        const lightboxElement = (
          <div
            id="moments-fullscreen-lightbox"
            className={`fixed inset-0 z-[9999] w-screen h-screen select-none overflow-hidden transition-colors duration-300 ${
              momentCardMode === 'light'
                ? 'bg-white text-zinc-950'
                : 'bg-[#000000] text-white'
            }`}
          >
            {/* Top Bar Overlay */}
            <div
              className={`absolute top-0 inset-x-0 px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-4 z-50 pointer-events-auto ${
                momentCardMode === 'light'
                  ? 'bg-gradient-to-b from-white/95 via-white/60 to-transparent'
                  : 'bg-gradient-to-b from-black/85 via-black/45 to-transparent'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span
                  className={`px-3.5 py-1.5 rounded-full text-xs font-syne font-bold uppercase tracking-wider border backdrop-blur-md shadow-xs truncate max-w-[180px] sm:max-w-md ${
                    momentCardMode === 'light'
                      ? 'bg-black/5 text-black border-black/15'
                      : 'bg-white/10 text-white border-white/20'
                  }`}
                >
                  {currentMoment.categoryTitle || currentMoment.title}
                </span>
                {currentMoment.dateStr && (
                  <span
                    className={`font-mono-tech text-xs shrink-0 flex items-center gap-1.5 ${
                      momentCardMode === 'light' ? 'text-zinc-600' : 'text-zinc-400'
                    }`}
                  >
                    <span className="opacity-40">•</span>
                    <span>{currentMoment.dateStr}</span>
                  </span>
                )}
                <span
                  className={`font-mono-tech text-xs shrink-0 ${
                    momentCardMode === 'light' ? 'text-zinc-600' : 'text-zinc-400'
                  }`}
                >
                  ({(currentMoment.imageIndexInCategory ?? 0) + 1} /{' '}
                  {currentMoment.totalImagesInCategory ?? lightboxMomentsList.length})
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="close-lightbox-btn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (momentSwipeTimerRef.current) {
                      window.clearTimeout(momentSwipeTimerRef.current);
                      momentSwipeTimerRef.current = null;
                    }
                    if (momentSingleTapTimerRef.current) {
                      window.clearTimeout(momentSingleTapTimerRef.current);
                      momentSingleTapTimerRef.current = null;
                    }
                    setMomentSwipeTransition(false);
                    setMomentSwipeOffsetPx(0);
                    setLightboxMomentIndex(null);
                    setMomentZoomScale(1);
                    setMomentPanPos({ x: 0, y: 0 });
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 border ${
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

            {/* Gallery Track Viewport: Smooth 1:1 touch/drag swiping with slim 6px gap and zero border line */}
            <div
              className="absolute inset-0 w-full h-full overflow-hidden select-none touch-none"
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
                className="h-full flex items-center will-change-transform"
                style={{
                  width: `calc(300vw + ${gapPx * 2}px)`,
                  gap: `${gapPx}px`,
                  transform: `translate3d(calc(-100vw - ${gapPx}px + ${momentSwipeOffsetPx}px), 0, 0)`,
                  transition: momentSwipeTransition
                    ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
                    : 'none',
                  cursor:
                    momentZoomScale > 1.05
                      ? 'grab'
                      : totalCount > 1
                      ? 'grab'
                      : 'default',
                }}
              >
                {/* Previous Image Slide */}
                <div className="w-screen h-full shrink-0 flex items-center justify-center py-12 px-0">
                  {totalCount > 1 && prevMoment && (
                    <div className="max-w-full max-h-full flex items-center justify-center overflow-hidden">
                      <img
                        key={`prev-${prevMoment.id}`}
                        src={prevMoment.url}
                        alt=""
                        loading="eager"
                        decoding="sync"
                        onLoad={() =>
                          setLoadedMomentUrls((prev) =>
                            prev[prevMoment.url] ? prev : { ...prev, [prevMoment.url]: true }
                          )
                        }
                        className={`max-w-full max-h-[84vh] object-contain select-none pointer-events-none transition-opacity duration-150 ${
                          loadedMomentUrls[prevMoment.url] ? 'opacity-100' : 'opacity-0'
                        }`}
                        draggable={false}
                      />
                    </div>
                  )}
                </div>

                {/* Current Active Image Slide — Single tap on image ONLY toggles theme; double tap on image ONLY toggles zoom */}
                <div className="w-screen h-full shrink-0 flex items-center justify-center py-12 px-0">
                  <div
                    className="max-w-full max-h-full flex items-center justify-center overflow-hidden origin-center will-change-transform"
                    style={{
                      transform: `translate3d(${momentPanPos.x}px, ${momentPanPos.y}px, 0) scale(${momentZoomScale})`,
                      transition: isDraggingMomentRef.current ? 'none' : 'transform 160ms ease-out',
                    }}
                  >
                    <img
                      key={`curr-${currentMoment.id}`}
                      ref={activeMomentImgRef}
                      src={currentMoment.url}
                      alt=""
                      loading="eager"
                      decoding="sync"
                      onClick={handleActiveImageClick}
                      onLoad={() =>
                        setLoadedMomentUrls((prev) =>
                          prev[currentMoment.url] ? prev : { ...prev, [currentMoment.url]: true }
                        )
                      }
                      className={`max-w-full max-h-[84vh] object-contain select-none pointer-events-auto cursor-pointer transition-opacity duration-150 ${
                        loadedMomentUrls[currentMoment.url] ? 'opacity-100' : 'opacity-0'
                      }`}
                      draggable={false}
                    />
                  </div>
                </div>

                {/* Next Image Slide */}
                <div className="w-screen h-full shrink-0 flex items-center justify-center py-12 px-0">
                  {totalCount > 1 && nextMoment && (
                    <div className="max-w-full max-h-full flex items-center justify-center overflow-hidden">
                      <img
                        key={`next-${nextMoment.id}`}
                        src={nextMoment.url}
                        alt=""
                        loading="eager"
                        decoding="sync"
                        onLoad={() =>
                          setLoadedMomentUrls((prev) =>
                            prev[nextMoment.url] ? prev : { ...prev, [nextMoment.url]: true }
                          )
                        }
                        className={`max-w-full max-h-[84vh] object-contain select-none pointer-events-none transition-opacity duration-150 ${
                          loadedMomentUrls[nextMoment.url] ? 'opacity-100' : 'opacity-0'
                        }`}
                        draggable={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

        if (typeof document !== 'undefined') {
          return createPortal(lightboxElement, document.body);
        }
        return lightboxElement;
      })()}

      {/* Publish Album Modal (triggered when Save or Share is clicked while album is in Draft) */}
      <PublishAlbumModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        currentSet={currentSet}
        currentUser={null}
        onPublishSuccess={(updatedSet) => {
          onUpdateSet(updatedSet);
          if (updatedSet.isPublished) {
            showSuccess('Album Published!', 'Your class album is now live. Save and Share are now active.');
          }
        }}
      />

      {/* Album Admin Help Support Modal */}
      <AlbumDisputeModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        currentSet={currentSet}
      />
    </div>
  );
};
