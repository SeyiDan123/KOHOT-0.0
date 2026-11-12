import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WebsiteContentOverride, UserAccount, ClassSet } from '../../types';
import { HowItWorksShowcase } from './HowItWorksShowcase';
import { PillarsCarousel } from './PillarsCarousel';
import { TestimonialsCarousel } from './TestimonialsCarousel';
import { HelpModal } from './HelpModal';
import { AlbumDisputeModal } from '../admin/AlbumDisputeModal';
import { ContactSupportModal } from '../common/ContactSupportModal';
import { 
  ArrowRight, 
  Lock, 
  Play, 
  Pause,
  Volume2, 
  VolumeX, 
  Sparkles,
  HelpCircle,
  ExternalLink,
  Award,
  Calendar,
  Smartphone,
  Sun,
  Moon,
  Plus,
  Check,
  ShieldCheck,
  QrCode,
  Gift,
  Youtube,
  Instagram,
  Twitter,
  Linkedin,
  Globe,
} from 'lucide-react';
import { getTheme, toggleTheme, ThemeMode } from '../../utils/theme';
import { fetchPublicPaymentConfig } from '../../utils/apiClient';

import { BrandLogo } from '../common/BrandLogo';
import { ScrollReveal } from '../common/ScrollReveal';
import { GraduationPattern } from '../common/GraduationPattern';

interface LandingPageProps {
  sets: ClassSet[];
  contentOverride: WebsiteContentOverride;
  currentUser: UserAccount | null;
  onSelectSet: (setId: string) => void;
  onOpenLogin: () => void;
  onOpenOnboarding: () => void;
  onOpenDashboard: () => void;
  onLogout: () => void;
  onExploreDemos?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  sets,
  contentOverride,
  currentUser,
  onSelectSet,
  onOpenLogin,
  onOpenOnboarding,
  onOpenDashboard,
  onLogout,
  onExploreDemos,
}) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-what-is-kohot');

  // Dynamic Host Finance Pricing & Founding Class Discount state
  const [standardPriceNaira, setStandardPriceNaira] = useState<number>(1000);
  const [foundingDiscountPercent, setFoundingDiscountPercent] = useState<number>(20);
  const [foundingDiscountName, setFoundingDiscountName] = useState<string>(
    contentOverride?.foundingDiscountName || 'Founding Class Departmental Discount'
  );
  const [foundingDiscountDescription, setFoundingDiscountDescription] = useState<string>(
    contentOverride?.foundingDiscountDescription ||
      'Special rate for the founding graduating class of a department.'
  );
  const [discountedPriceNaira, setDiscountedPriceNaira] = useState<number>(800);

  useEffect(() => {
    let isMounted = true;
    const syncPricingFromServer = async () => {
      try {
        const cfg = await fetchPublicPaymentConfig();
        if (!isMounted || !cfg) return;
        const stdNaira = Math.max(0, Math.round((Number(cfg.studentFeeKobo) || 100000) / 100));
        const discPct =
          typeof cfg.foundingDiscountPercent === 'number' &&
          cfg.foundingDiscountPercent >= 0 &&
          cfg.foundingDiscountPercent <= 100
            ? cfg.foundingDiscountPercent
            : 20;
        const discNaira =
          typeof cfg.discountedFeeKobo === 'number' && cfg.discountedFeeKobo >= 0
            ? Math.round(cfg.discountedFeeKobo / 100)
            : Math.max(0, Math.round(stdNaira * (1 - discPct / 100)));
        setStandardPriceNaira(stdNaira);
        setFoundingDiscountPercent(discPct);
        if (cfg.foundingDiscountName) {
          setFoundingDiscountName(cfg.foundingDiscountName);
        }
        if (cfg.foundingDiscountDescription) {
          setFoundingDiscountDescription(cfg.foundingDiscountDescription);
        }
        setDiscountedPriceNaira(discNaira);
      } catch {
        // keep defaults
      }
    };

    syncPricingFromServer();
    const handlePricingUpdated = () => {
      syncPricingFromServer();
    };
    window.addEventListener('kohot_pricing_updated', handlePricingUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('kohot_pricing_updated', handlePricingUpdated);
    };
  }, []);

  const LANDING_FAQS = useMemo(
    () => [
      {
        id: 'faq-what-is-kohot',
        question: 'How do we create and claim our Department Class Album?',
        answer:
          'Tap "Create Class Album", select your university and department, choose your graduating year, and verify with your Google account. Your class album workspace is created immediately at zero upfront cost so you can start inviting classmates and organizing moments right away.',
      },
      {
        id: 'faq-pricing',
        question: `How does pricing work and what is the Founding Class Discount?`,
        answer: `Creating your class album workspace, uploading class moments, and sharing your invite link are completely free. Our standard archival contribution is a one-time ₦${standardPriceNaira.toLocaleString()} per graduate profile—or ₦${discountedPriceNaira.toLocaleString()} per profile (${foundingDiscountPercent}% off) for departments claiming their Founding Class Discount. Albums can also be 100% covered via Full Sponsorship by an alumnus, patron, or KOHOT.`,
      },
      {
        id: 'faq-invite-classmates',
        question: 'How do classmates submit their portraits, quotes, and stories?',
        answer:
          'Inside your Album Admin dashboard, tap "Invite Classmates" to share your dedicated class link on WhatsApp or Telegram. Classmates open the link on their phone, upload their portrait and secondary photo, add their parting quote, story, and social links, and submit in under a minute with no app download required.',
      },
      {
        id: 'faq-legacy-plaque',
        question: 'How does the physical Department Legacy Plaque connect to our album?',
        answer:
          'Your department’s physical corridor Legacy Plaque features a permanent laser-etched QR gateway that opens your department’s Legacy Wall. Every graduating cohort—past, present, and future—lives side by side under your department’s official archive.',
      },
      {
        id: 'faq-privacy',
        question: 'Are our class photos and graduate profiles private and student-controlled?',
        answer:
          'Yes. Every profile submission passes through your Class Album Admin approval queue before appearing in the roster. Unlisted and draft albums are restricted to verified invite links, and graduate data is never sold or indexed as public ad inventory.',
      },
      {
        id: 'faq-next-class',
        question: 'What happens after convocation and how does the next class continue the tradition?',
        answer:
          'Once published, your Class Album is permanently locked into your department’s archive, and automated annual convocation anniversary reminders reconnect your classmates every year. Using "Invite Next Class", you hand the baton to the incoming graduating set so your department’s history remains unbroken.',
      },
    ],
    []
  );

  useEffect(() => {
    setCurrentTheme(getTheme());
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

  const handleToggleTheme = () => {
    const next = toggleTheme(currentTheme);
    setCurrentTheme(next);
  };

  // Cinematic Hero Video State
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  // Cinematic Hero Slow-Motion Image Transitions (never static)
  const HERO_MONTAGE_IMAGES = [
    {
      url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=80',
      alt: 'Classmates gathered in academic regalia celebrating graduation',
    },
    {
      url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&auto=format&fit=crop&q=80',
      alt: 'Department historical corridor with architectural legacy wall plaque',
    },
    {
      url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=80',
      alt: 'Graduates cheering and tossing caps into the sky',
    },
    {
      url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=80',
      alt: 'Annual class alumni celebrating togetherness years later',
    },
  ];
  const [heroImgIndex, setHeroImgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroImgIndex((prev) => (prev + 1) % HERO_MONTAGE_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [HERO_MONTAGE_IMAGES.length]);

  // 4 Crossfading Legacy Banner Images before Footer (Editable via Owner Dashboard under Website Media)
  const legacyBannerImages = useMemo(() => {
    if (contentOverride?.legacyBannerImages && contentOverride.legacyBannerImages.length === 4) {
      return contentOverride.legacyBannerImages;
    }
    return [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1600&auto=format&fit=crop',
    ];
  }, [contentOverride?.legacyBannerImages]);

  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % legacyBannerImages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [legacyBannerImages.length]);

  const toggleVideoPlay = () => {
    if (heroVideoRef.current) {
      if (isVideoPlaying) {
        heroVideoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        heroVideoRef.current.play();
        setIsVideoPlaying(true);
      }
    }
  };

  const toggleVideoMute = () => {
    if (heroVideoRef.current) {
      heroVideoRef.current.muted = !isVideoMuted;
      setIsVideoMuted(!isVideoMuted);
    }
  };

  const handleExplore = () => {
    if (onExploreDemos) {
      onExploreDemos();
    } else if (sets.length > 0) {
      onSelectSet(sets[0].id);
    }
  };

  const rawHeroVideo = (contentOverride?.heroVideoUrl || '').trim();
  const isDeletedOrSample = 
    !rawHeroVideo ||
    rawHeroVideo.includes('ForBiggerBlazes') ||
    rawHeroVideo === 'hero.mp4' ||
    rawHeroVideo === '/hero.mp4' ||
    rawHeroVideo.includes('hero-video') ||
    rawHeroVideo.includes('kohot_storage') ||
    rawHeroVideo.includes('hero-poster');

  const hasUploadedHeroVideo = !isDeletedOrSample;
  const heroVideoUrl = hasUploadedHeroVideo ? rawHeroVideo : '';

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);

  useEffect(() => {
    setIsVideoLoaded(false);
    setVideoLoadError(false);
  }, [heroVideoUrl]);

  const isVideoActive = hasUploadedHeroVideo && isVideoLoaded && !videoLoadError;

  return (
    <div 
      id="landing-page-root" 
      className="min-h-screen bg-zinc-50 dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 antialiased selection:bg-[#d4af37]/30 selection:text-black transition-colors duration-300"
    >
      {/* =========================================================================
          TOP NAVIGATION BAR (MINIMALIST & CONFIDENT - CRISP WHITE / LUXURY DARK)
          ========================================================================= */}
      <header
        id="main-header"
        className="sticky top-0 w-full z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-xl transition-all duration-300 text-zinc-900 dark:text-white shadow-sm"
      >
        <div className="flex justify-between items-center px-6 sm:px-10 py-4 max-w-7xl mx-auto">
          {/* Brand Monogram */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="group cursor-pointer flex items-center"
            >
              <BrandLogo
                logoUrl={contentOverride?.websiteLogoUrl}
                brandName={contentOverride?.brandName || 'KOHOT'}
                textSize="text-base sm:text-lg"
              />
            </button>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-7 text-xs font-mono-tech tracking-wider uppercase text-zinc-600 dark:text-zinc-400 font-semibold">
              <a href="#core-pillars" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Pillars</a>
              <a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-white transition-colors">How It Works</a>
              <a href="#department-legacy" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Department Legacy</a>
              {contentOverride?.showTestimonialsSection !== false && (
                <a href="#testimonials" className="hover:text-zinc-900 dark:hover:text-white transition-colors">In Their Words</a>
              )}
            </nav>
          </div>

          {/* Right CTAs */}
          <div className="flex items-center gap-3">
            {/* Public Theme Toggle */}
            <button
              id="public-theme-toggle-btn"
              type="button"
              onClick={handleToggleTheme}
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

            <button
              id="nav-help-btn"
              onClick={() => setIsHelpOpen(true)}
              className="hidden sm:flex items-center gap-1.5 font-mono-tech text-xs tracking-wider uppercase text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3.5 py-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Help</span>
            </button>

            <button
              id="nav-signin-btn"
              onClick={onOpenLogin}
              className="font-mono-tech text-xs tracking-wider uppercase font-semibold text-zinc-900 hover:text-black bg-white hover:bg-zinc-50 border border-zinc-300 hover:border-zinc-400 px-4 py-2 rounded-full transition-all cursor-pointer shadow-xs"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1: HERO (CRISP LIGHT GREY / PURE WHITE WITH GOLD & CHARCOAL ACCENTS)
          "Your people. Your memories. Your story."
          ========================================================================= */}
      <section 
        id="hero" 
        className="relative pt-16 pb-20 sm:pt-24 sm:pb-32 overflow-hidden bg-white dark:bg-[#121214] border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-900 dark:text-white transition-colors duration-300"
      >
        {/* Background Graduation Pattern Texture */}
        <GraduationPattern className="opacity-[0.06] dark:opacity-[0.20]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 relative z-10 space-y-12 flex flex-col items-center justify-center">
          
          {/* Header Narrative */}
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6 sm:space-y-8">
            {/* Main Headline - Increased font size */}
            <h1 
              id="hero-main-title"
              className="font-syne font-bold text-4xl sm:text-6xl md:text-7xl lg:text-7xl text-zinc-900 dark:text-white tracking-tight leading-[1.08] max-w-4xl animate-slow-reveal"
            >
              <span className="block">{contentOverride?.heroHeadlineLine1 || 'Beautiful'}</span>
              <span className="block text-zinc-900 dark:text-white italic font-medium">{contentOverride?.heroHeadlineLine2 || 'graduate memories'}</span>
              <span className="block text-zinc-900 dark:text-white">{contentOverride?.heroHeadlineLine3 || 'live here'}</span>
            </h1>

            {/* Supporting Statement - Rich medium zinc in light mode, calm white in dark mode */}
            <p className="font-body text-base sm:text-lg md:text-xl text-zinc-600 dark:text-zinc-100 max-w-2xl mx-auto leading-relaxed text-balance animate-slow-reveal animation-delay-200 font-normal">
              {contentOverride?.heroSubtitle || 'From your classmates and portraits to the moments, words and stories you shared, KoHot gives your graduating class a beautiful place to remember it all.'}
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto animate-slow-reveal animation-delay-500">
              <button
                id="hero-create-album-btn"
                onClick={onOpenOnboarding}
                className="w-full sm:w-auto bg-[#d4af37] text-zinc-950 font-syne font-bold text-xs sm:text-sm tracking-wider uppercase py-4 px-10 rounded-full hover:bg-[#e6c158] active:scale-[0.98] transition-all duration-300 shadow-xl shadow-black/20 cursor-pointer flex items-center justify-center gap-2.5"
              >
                <span>{contentOverride?.heroCtaButtonText || 'Create Class Album'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="hero-explore-demos-link"
                onClick={handleExplore}
                className="w-full sm:w-auto font-mono-tech font-semibold text-xs sm:text-sm tracking-wider uppercase text-white bg-zinc-700 hover:bg-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 py-4 px-8 rounded-full border border-zinc-600 hover:border-zinc-500 transition-all cursor-pointer flex items-center justify-center shadow-lg active:scale-[0.98]"
              >
                {contentOverride?.heroExploreButtonText || 'Explore Demo Albums'}
              </button>
            </div>
          </div>

          {/* PROMINENT CINEMATIC KOHOT VIDEO SHOWCASE (Centralized, Slow-motion transitions, expanded hero scale) */}
          <div className="w-full max-w-5xl lg:max-w-6xl mx-auto pt-6 px-1 sm:px-3 flex flex-col items-center justify-center">
            <div className="w-full relative aspect-[16/10] sm:aspect-[16/9] md:aspect-[2.2/1] min-h-[340px] sm:min-h-[440px] md:min-h-[480px] rounded-[36px] sm:rounded-[44px] md:rounded-[52px] overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-zinc-900 shadow-2xl group mx-auto">
              {/* Slow-motion background crossfade photos (never static) */}
              <div className="absolute inset-0 z-0">
                {HERO_MONTAGE_IMAGES.map((item, idx) => (
                  <div
                    key={item.url}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      idx === heroImgIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.alt}
                      className="w-full h-full object-cover object-center filter contrast-[1.08] brightness-[0.9] animate-ken-burns transition-all duration-1000 ease-out"
                    />
                  </div>
                ))}
              </div>

              {/* Video layer over photos ONLY when uploaded and loaded without error */}
              {hasUploadedHeroVideo && heroVideoUrl && !videoLoadError && (
                <video
                  ref={heroVideoRef}
                  src={heroVideoUrl}
                  autoPlay
                  loop
                  muted={isVideoMuted}
                  playsInline
                  onLoadedData={() => {
                    setIsVideoLoaded(true);
                    setVideoLoadError(false);
                  }}
                  onError={() => {
                    setVideoLoadError(true);
                    setIsVideoLoaded(false);
                  }}
                  className={`relative z-10 w-full h-full object-cover object-center filter contrast-[1.08] brightness-[0.95] group-hover:scale-[1.01] transition-all duration-1000 ease-out ${
                    isVideoPlaying && isVideoLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                />
              )}

              {/* Gradient Vignette */}
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />

              {/* Bottom Video Controls & Caption (NO text caption at top of card) */}
              <div className="absolute bottom-5 inset-x-5 z-20 flex items-center justify-between">
                <div className="hidden sm:block">
                  <span className="font-syne font-semibold text-sm text-white block">
                    {contentOverride?.heroVideoCaptionTitle || 'The Physical to Digital Gateway'}
                  </span>
                  <span className="font-mono-tech text-xs text-zinc-400">
                    {contentOverride?.heroVideoCaptionSubtext || 'Scan the corridor plaque • Open your preserved class album'}
                  </span>
                </div>

                {/* Play and mute buttons ONLY show if a video is uploaded and active */}
                {isVideoActive && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={toggleVideoPlay}
                      className="w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white hover:text-[#d4af37] flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                      aria-label={isVideoPlaying ? 'Pause video' : 'Play video'}
                    >
                      {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 pl-0.5" />}
                    </button>
                    <button
                      onClick={toggleVideoMute}
                      className="w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white hover:text-[#d4af37] flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                      aria-label={isVideoMuted ? 'Unmute video' : 'Mute video'}
                    >
                      {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 2: PROBLEM + SOLUTION / THREE PILLARS (DARKER LIGHT GREY)
          "The years you shared will move on. Your memories don't have to."
          "EVERYTHING YOUR CLASS NEEDS TO LEAVE A LEGACY"
          ========================================================================= */}
      <PillarsCarousel 
        onExploreDemoAlbum={(setId) => onSelectSet(setId || 'crownfield-law-2026')}
        onOpenOnboarding={onOpenOnboarding}
        contentOverride={contentOverride}
      />

      {/* =========================================================================
          SECTION 3: HOW IT WORKS + DEPARTMENT LEGACY AND PRIVACY (WHITE & GREY)
          7 Emotional Steps • "ONE DEPARTMENT. MANY GENERATIONS." • Reassuring Privacy
          ========================================================================= */}
      <HowItWorksShowcase 
        onOpenOnboarding={onOpenOnboarding} 
        onExploreDemos={handleExplore}
        contentOverride={contentOverride}
      />

      {/* =========================================================================
          SECTION 4: THE LEGACY, IN THEIR WORDS (TESTIMONIALS - ONLY SHOWN IF ENABLED)
          ========================================================================= */}
      {contentOverride?.showTestimonialsSection !== false && (
        <TestimonialsCarousel contentOverride={contentOverride} />
      )}

      {/* =========================================================================
          SECTION 4B: TRANSPARENT ARCHIVAL PRICING (₦1,000 PER GRADUATE PROFILE)
          ========================================================================= */}
      <section
        id="pricing-section"
        className="py-20 sm:py-28 px-4 sm:px-8 border-t border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-[#0d0e12] text-slate-900 dark:text-zinc-100 transition-colors duration-200"
      >
        <div className="max-w-6xl mx-auto space-y-12">
          <ScrollReveal className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-block font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#b89728] dark:text-[#d4af37] font-bold">
              TRANSPARENT ARCHIVAL PRICING
            </span>
            <h2 className="font-syne font-extrabold text-2xl sm:text-4xl md:text-[42px] tracking-tight text-slate-900 dark:text-white leading-tight">
              One Simple Price. Preserved for Generations.
            </h2>
            <p className="font-body text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
              Less than the cost of a printed booklet that fades or gets lost—your identity, portrait, and story remain permanently anchored in your department&apos;s official history.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
            {/* Primary Graduate Profile Pricing Card — Light on Light Mode, Dark on Dark Mode */}
            <div
              id="website-primary-pricing-card"
              className="lg:col-span-7 rounded-3xl p-7 sm:p-10 bg-white dark:bg-[#14151b] text-slate-900 dark:text-white border border-slate-200/90 dark:border-[#d4af37]/35 shadow-xl flex flex-col justify-between relative overflow-hidden transition-colors duration-200"
            >
              <div className="space-y-6 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="px-3.5 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#9a7b1c] dark:text-[#e6c158] font-mono-tech text-[10px] uppercase tracking-widest font-bold">
                    Official Departmental Archive
                  </span>
                  <span className="font-mono-tech text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    Pay Once • Keep Forever
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-syne font-extrabold text-4xl sm:text-6xl text-slate-900 dark:text-white tracking-tight">
                      ₦{standardPriceNaira.toLocaleString()}
                    </span>
                    <span className="font-mono-tech text-xs sm:text-sm text-slate-500 dark:text-zinc-300 uppercase tracking-wider">
                      / standard price per graduate profile
                    </span>
                  </div>

                  {/* Founding Class Departmental Discount & 3 Finance Programs Callout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-[#d4af37]/10 dark:bg-[#d4af37]/12 border border-[#d4af37]/35 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tech text-[10px] uppercase tracking-wider font-bold text-[#9a7b1c] dark:text-[#e6c158]">
                          {foundingDiscountName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#d4af37] text-black font-mono-tech text-[10px] font-bold">
                          {foundingDiscountPercent}% OFF
                        </span>
                      </div>
                      <p className="font-syne font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                        ₦{discountedPriceNaira.toLocaleString()}{' '}
                        <span className="text-xs font-mono-tech font-normal text-slate-600 dark:text-zinc-300">
                          / graduate profile
                        </span>
                      </p>
                      <p className="font-body text-[11px] text-slate-600 dark:text-zinc-300 leading-snug flex items-start gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-[#9a7b1c] dark:text-[#d4af37] shrink-0 mt-0.5" />
                        <span>{foundingDiscountDescription}</span>
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tech text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
                          Full Sponsorship Program
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono-tech text-[10px] font-bold">
                          100% Covered
                        </span>
                      </div>
                      <p className="font-syne font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                        Individual Patron or KOHOT Grant
                      </p>
                      <p className="font-body text-[11px] text-slate-600 dark:text-zinc-300 leading-snug">
                        Class committees, alumni sponsors, or KOHOT can pre-fund all class slots so graduates publish free.
                      </p>
                    </div>
                  </div>

                  <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed max-w-xl pt-1">
                    Start your class album workspace for{' '}
                    <strong className="text-slate-900 dark:text-white">₦0 upfront</strong>. Graduates can fund their own profile individually during submission, apply their department&apos;s Founding Class Discount, or use pre-funded sponsor slots.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 border-t border-slate-200 dark:border-white/10">
                  {[
                    'Dual high-resolution graduate portraits & personal story',
                    'Unlimited class moments, sign-out & dinner photo batches',
                    'Connected to your department’s physical QR Legacy Plaque',
                    'Automated annual convocation anniversary reminders',
                    'Leadership hierarchy, class awards & parting quotes',
                    'Zero recurring subscriptions or hidden hosting renewals',
                  ].map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#9a7b1c] dark:text-[#e6c158]" />
                      </div>
                      <span className="font-body text-xs sm:text-[13px] text-slate-700 dark:text-zinc-200 leading-snug">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 mt-8 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative z-10">
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="px-7 py-3.5 rounded-full bg-[#d4af37] hover:bg-[#e3be42] text-black font-syne font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:scale-[1.02] active:scale-95"
                >
                  <span>Start Class Album Free</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
                <span className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400 text-center sm:text-right">
                  Instant workspace setup • Pay only when approving profiles
                </span>
              </div>
            </div>

            {/* Why ₦1,000 is Extraordinary Value Card */}
            <div className="lg:col-span-5 rounded-3xl p-7 sm:p-9 bg-[#f4f5f8] dark:bg-[#14151b] border border-slate-200/90 dark:border-zinc-800 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400 font-bold block">
                  WHY GRADUATING CLASSES CHOOSE KOHOT
                </span>
                <h3 className="font-syne font-bold text-xl sm:text-2xl text-slate-900 dark:text-white leading-snug">
                  Built to outlast WhatsApp groups and paper yearbooks.
                </h3>

                <div className="space-y-4 pt-1">
                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 space-y-1">
                    <div className="flex items-center gap-2 font-syne font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      <ShieldCheck className="w-4 h-4 text-[#b89728] dark:text-[#d4af37] shrink-0" />
                      <span>Permanent Departmental Identity</span>
                    </div>
                    <p className="font-body text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      Every graduate is permanently recorded in their department&apos;s official digital lineage—searchable by name, role, and class year decades after graduation.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 space-y-1">
                    <div className="flex items-center gap-2 font-syne font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      <QrCode className="w-4 h-4 text-[#b89728] dark:text-[#d4af37] shrink-0" />
                      <span>Flexible Individual or Class Sponsorship</span>
                    </div>
                    <p className="font-body text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      Class Reps never have to chase cash manually. Classmates can pay ₦1,000 directly on their invite form, or executives/patrons can sponsor slots for the whole set.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-syne font-bold text-xs text-slate-900 dark:text-white">
                    Need custom institutional or faculty sponsorship?
                  </p>
                  <p className="font-mono-tech text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                    Talk to our preservation team for department-wide rollouts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupportOpen(true)}
                  className="px-3.5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-mono-tech text-[10px] uppercase tracking-wider font-bold shrink-0 cursor-pointer"
                >
                  Inquire
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4C: FREQUENTLY ASKED QUESTIONS (PLUS-BUTTON ACCORDION BEFORE FOOTER)
          ========================================================================= */}
      <section
        id="frequently-asked-questions"
        className="py-20 sm:py-24 px-4 sm:px-8 border-t border-slate-200 dark:border-zinc-800/80 bg-[#f4f5f8] dark:bg-[#111216] text-slate-900 dark:text-zinc-100 transition-colors duration-200"
      >
        <div className="max-w-4xl mx-auto space-y-10">
          <ScrollReveal className="text-center space-y-3">
            <span className="inline-block font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#b89728] dark:text-[#d4af37] font-bold">
              EVERYTHING YOU NEED TO KNOW
            </span>
            <h2 className="font-syne font-extrabold text-2xl sm:text-4xl tracking-tight text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Clear answers for Class Representatives, Album Admins, and graduating cohorts.
            </p>
          </ScrollReveal>

          <div className="space-y-3">
            {LANDING_FAQS.map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'bg-white dark:bg-[#181920] border-[#b89728]/50 dark:border-[#d4af37]/50 shadow-md'
                      : 'bg-white/90 dark:bg-[#15161c] border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                    className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <span className="font-syne font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                      {item.question}
                    </span>
                    <span
                      className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isOpen
                          ? 'bg-[#d4af37] border-[#d4af37] text-black rotate-45'
                          : 'bg-slate-100 dark:bg-zinc-800/90 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <Plus className="w-4 h-4 transition-transform duration-200" />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 pt-0 border-t border-slate-100 dark:border-white/5 animate-fadeIn">
                      <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed pt-3.5">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:border-[#d4af37] font-mono-tech text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer shadow-xs"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#b89728] dark:text-[#d4af37]" />
              <span>Explore Full Support Centre</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: CLASS ALBUM LEGACY PRESERVATION BANNER (FADE IN / FADE OUT 4 PHOTOS)
          Placed directly before the footer area with "Preserve your Legacy"
          followed by "Create Class Album" CTA.
          ========================================================================= */}
      <section 
        id="legacy-preservation-banner"
        className="relative w-full overflow-hidden border-t border-zinc-800 text-white min-h-[440px] sm:min-h-[480px] flex items-center select-none"
      >
        {/* 4 Fade-in / Fade-out Background Pictures - Reduced darkness so pictures clearly show */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {legacyBannerImages.map((imgUrl, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
                activeBannerIdx === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{
                backgroundImage: `url(${imgUrl})`,
              }}
            />
          ))}
          {/* Soft light gradient overlay so transitioning background photos clearly shine through */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-black/15 z-10" />
        </div>

        {/* Foreground Content - Aligned to the Left */}
        <div className="relative z-20 max-w-7xl w-full mx-auto px-6 sm:px-10 py-16 sm:py-20 text-left space-y-6 animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-[#d4af37] shadow-lg">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-mono-tech text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-white">
              Permanent Class Preservation
            </span>
          </div>

          <h2 className="font-syne font-bold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight max-w-3xl drop-shadow-md">
            Preserve your Legacy
          </h2>

          <p className="font-body text-sm sm:text-base md:text-lg text-zinc-100 max-w-2xl leading-relaxed font-normal drop-shadow">
            The people you shared these formative years with. The moments, laughter, triumphs, and stories you built together. Give your graduating class a permanent home to remember it all.
          </p>

          <div className="flex flex-col sm:flex-row items-start justify-start gap-4 pt-2">
            <button
              id="banner-create-class-album-btn"
              type="button"
              onClick={onOpenOnboarding}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-2xl hover:scale-105 active:scale-95"
            >
              <span>Create Class Album</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>

            {onExploreDemos && (
              <button
                type="button"
                onClick={handleExplore}
                className="w-full sm:w-auto px-7 py-4 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white font-syne font-semibold text-xs sm:text-sm uppercase tracking-wider border border-white/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
              >
                <span>Explore Demo Albums</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SIMPLE FOOTER: STANDARDIZED KOHOT BRAND, MOTTO, AND HOST SOCIALS
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

        const rawKohotSocials = contentOverride?.kohotSocials || {};
        const kohotYtHref = normalizeSocialHref(rawKohotSocials.youtube, 'youtube');
        const kohotIgHref = normalizeSocialHref(rawKohotSocials.instagram, 'instagram');
        const kohotTwHref = normalizeSocialHref(rawKohotSocials.twitter, 'twitter');
        const kohotLiHref = normalizeSocialHref(rawKohotSocials.linkedin, 'linkedin');
        const kohotWebHref = normalizeSocialHref(rawKohotSocials.website, 'website');
        const hasAnyKohotSocial = Boolean(kohotYtHref || kohotIgHref || kohotTwHref || kohotLiHref || kohotWebHref);

        return (
          <footer className="py-14 px-6 sm:px-10 border-t border-zinc-800 bg-black text-zinc-400 font-mono-tech text-xs">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Brand: KOHOT + Motto + Host Socials (Only shown if Host configured them) */}
              <div className="flex flex-col items-center md:items-start gap-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#d4af37] rotate-45" />
                  </div>
                  <span className="font-syne font-extrabold text-base tracking-widest text-white uppercase">
                    KOHOT
                  </span>
                </div>
                <span className="font-body text-xs text-zinc-400">
                  Preserve the memories.
                </span>
                {hasAnyKohotSocial && (
                  <div className="flex items-center gap-2 pt-1.5 text-zinc-300">
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

              {/* Links */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
                <button
                  onClick={onOpenOnboarding}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Create Class Album
                </button>
                <button
                  onClick={handleExplore}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Explore Demos
                </button>
                <button
                  type="button"
                  onClick={() => setIsSupportOpen(true)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Contact Support
                </button>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="hover:text-[#d4af37] transition-colors cursor-pointer flex items-center gap-1 text-[#d4af37] font-semibold"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Help &amp; FAQ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(true)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Album Admin Help
                </button>
                <button
                  onClick={onOpenLogin}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Portal Sign In
                </button>
              </div>

              {/* Copyright */}
              <div className="text-xs text-zinc-500 text-center md:text-right">
                &copy; 2026 KOHOT. All rights reserved.
              </div>
            </div>
          </footer>
        );
      })()}

      {/* =========================================================================
          DEDICATED PRACTICAL HELP & FAQ MODAL
          ========================================================================= */}
      <HelpModal 
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onOpenOnboarding={() => {
          setIsHelpOpen(false);
          onOpenOnboarding();
        }}
      />

      {/* Album Admin Help Support Modal */}
      <AlbumDisputeModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Public Contact Support Modal */}
      <ContactSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
};
