import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WebsiteContentOverride, UserAccount, ClassSet } from '../../types';
import { HowItWorksShowcase } from './HowItWorksShowcase';
import { PillarsCarousel } from './PillarsCarousel';
import { TestimonialsCarousel } from './TestimonialsCarousel';
import { HelpModal } from './HelpModal';
import { AlbumDisputeModal } from '../admin/AlbumDisputeModal';
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
  Moon
} from 'lucide-react';
import { getTheme, toggleTheme, ThemeMode } from '../../utils/theme';

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
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());

  useEffect(() => {
    setCurrentTheme(getTheme());
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

  const hasUploadedHeroVideo = Boolean(contentOverride?.heroVideoUrl && contentOverride.heroVideoUrl.trim().length > 0);
  const heroVideoUrl = contentOverride?.heroVideoUrl || '';

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

            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  id="nav-auth-dashboard-btn"
                  onClick={onOpenDashboard}
                  className="font-mono-tech text-xs tracking-wider uppercase font-semibold text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-300 px-4 py-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>{currentUser.role === 'master_host' ? 'Master Host' : 'Class Album Admin'}</span>
                </button>
                <button
                  id="nav-logout-btn"
                  onClick={onLogout}
                  className="font-mono-tech text-xs text-zinc-500 hover:text-zinc-900 transition-colors px-2 py-1 cursor-pointer"
                >
                  Exit
                </button>
              </div>
            ) : (
              <button
                id="nav-signin-btn"
                onClick={onOpenLogin}
                className="font-mono-tech text-xs tracking-wider uppercase font-semibold text-zinc-900 hover:text-black bg-white hover:bg-zinc-50 border border-zinc-300 hover:border-zinc-400 px-4 py-2 rounded-full transition-all cursor-pointer shadow-xs"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1: HERO (CRISP LIGHT GREY / PURE WHITE WITH GOLD & CHARCOAL ACCENTS)
          "Your people. Your memories. Your story."
          ========================================================================= */}
      <section 
        id="hero" 
        className="relative pt-16 pb-20 sm:pt-24 sm:pb-32 overflow-hidden bg-gradient-to-b from-white via-zinc-100/60 to-zinc-200/50 dark:from-[#121214] dark:via-[#18181b] dark:to-[#121214] border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-900 dark:text-white transition-colors duration-300"
      >
        {/* Background Graduation Pattern Texture */}
        <GraduationPattern className="opacity-[0.07] dark:opacity-[0.20]" />



        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 relative z-10 space-y-12 flex flex-col items-center justify-center">
          
          {/* Header Narrative */}
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6 sm:space-y-8">
            {/* Main Headline - Heading remains deep charcoal/black in light mode, white in dark mode */}
            <h1 
              id="hero-main-title"
              className="font-syne font-extrabold text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] text-zinc-900 dark:text-white tracking-tight leading-[1.08] max-w-4xl animate-slow-reveal"
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

              {/* Video layer over photos permanently when uploaded, or default photo montage transitions when unset */}
              {hasUploadedHeroVideo && heroVideoUrl && (
                <video
                  ref={heroVideoRef}
                  src={heroVideoUrl}
                  autoPlay
                  loop
                  muted={isVideoMuted}
                  playsInline
                  className={`relative z-10 w-full h-full object-cover object-center filter contrast-[1.08] brightness-[0.95] group-hover:scale-[1.01] transition-all duration-1000 ease-out ${
                    isVideoPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
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

                {hasUploadedHeroVideo && (
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
        onExploreDemoAlbum={(setId) => onSelectSet(setId || sets[0]?.id || 'unilag-cs-2026')}
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
      />

      {/* =========================================================================
          SECTION 4: THE LEGACY, IN THEIR WORDS (TESTIMONIALS - ONLY SHOWN IF ENABLED)
          ========================================================================= */}
      {contentOverride?.showTestimonialsSection !== false && (
        <TestimonialsCarousel />
      )}

      {/* =========================================================================
          SECTION 5: CLASS ALBUM LEGACY PRESERVATION BANNER (FADE IN / FADE OUT 4 PHOTOS)
          Placed directly before the footer area with "Preserve your Legacy"
          followed by "Create Class Album" CTA.
          ========================================================================= */}
      <section 
        id="legacy-preservation-banner"
        className="relative w-full overflow-hidden border-t border-zinc-800 text-white min-h-[440px] sm:min-h-[480px] flex items-center justify-center select-none"
      >
        {/* 4 Fade-in / Fade-out Background Pictures */}
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
          {/* Multi-layer Luxury Dark Vignette & Gradient for High Contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60 z-10" />
          <div className="absolute inset-0 bg-black/40 z-10" />
        </div>

        {/* Foreground Content */}
        <div className="relative z-20 max-w-4xl mx-auto px-6 py-20 sm:py-24 text-center space-y-7 animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[#d4af37] shadow-lg">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-mono-tech text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-white">
              Permanent Class Preservation
            </span>
          </div>

          <h2 className="font-syne font-black text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
            Preserve your Legacy
          </h2>

          <p className="font-body text-sm sm:text-base md:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed font-normal">
            The people you shared these formative years with. The moments, laughter, triumphs, and stories you built together. Give your graduating class a permanent home to remember it all.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
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
                className="w-full sm:w-auto px-7 py-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-syne font-semibold text-xs sm:text-sm uppercase tracking-wider border border-white/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
              >
                <span>Explore Demo Albums</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
              </button>
            )}
          </div>

          {/* 4 Image Slide Indicators */}
          <div className="flex items-center justify-center gap-2 pt-3">
            {legacyBannerImages.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => setActiveBannerIdx(dotIdx)}
                className={`transition-all duration-300 cursor-pointer rounded-full ${
                  activeBannerIdx === dotIdx
                    ? 'w-7 h-2 bg-[#d4af37]'
                    : 'w-2 h-2 bg-white/30 hover:bg-white/60'
                }`}
                aria-label={`Slide ${dotIdx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SIMPLE FOOTER: CLEAN, CONCISE, WITH DISCREET HELP & ESSENTIAL LINKS
          ========================================================================= */}
      <footer className="py-14 px-6 sm:px-10 border-t border-zinc-800 bg-black text-zinc-400 font-mono-tech text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center">
              <div className="w-2 h-2 bg-[#d4af37] rotate-45" />
            </div>
            <span className="font-syne font-bold text-base tracking-wider text-white">KOHOT</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Preserve the memories.</span>
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
            &copy; 2026 KoHot. All rights reserved.
          </div>
        </div>
      </footer>

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
    </div>
  );
};
