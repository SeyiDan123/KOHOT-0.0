import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  Sparkles, 
  Award, 
  Bell, 
  Smartphone, 
  ExternalLink,
  QrCode,
  Calendar,
  Layers
} from 'lucide-react';

import { WebsiteContentOverride } from '../../types';
import { ScrollReveal } from '../common/ScrollReveal';
import { GraduationPattern } from '../common/GraduationPattern';

interface PillarsCarouselProps {
  onExploreDemoAlbum: (setId?: string) => void;
  onOpenOnboarding: () => void;
  onScrollToHowItWorks?: () => void;
  contentOverride?: WebsiteContentOverride;
}

interface PillarItem {
  id: string;
  tag: string;
  title: string;
  oneLiner: string;
  ctaText?: string;
  ctaAction?: 'demo' | 'claim' | 'legacy';
  images: { url: string; alt: string }[];
}

interface PillarCardItemProps {
  pillar: PillarItem;
  idx: number;
  videoUrl?: string;
  onCardCta: (action: PillarItem['ctaAction']) => void;
}

const PillarCardItem: React.FC<PillarCardItemProps> = ({ pillar: p, idx, videoUrl, onCardCta }) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [showPhotosInstead, setShowPhotosInstead] = useState(false);

  const hasVideo = Boolean(videoUrl && videoUrl.trim().length > 0);
  const isDisplayingVideo = hasVideo && !showPhotosInstead;

  // Slow-motion crossfade rotation across pillar images when no video is uploaded or user opts to view photos
  useEffect(() => {
    if (isDisplayingVideo || !p.images || p.images.length <= 1) return;
    const intervalTime = 4800 + (idx * 400); // gently staggered timing across cards
    const timer = setInterval(() => {
      setCurrentImgIndex((prev) => (prev + 1) % p.images.length);
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isDisplayingVideo, p.images, idx]);

  return (
    <div
      className="w-[86vw] sm:w-[420px] md:w-[440px] lg:w-auto h-[490px] sm:h-[510px] shrink-0 snap-start bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-[32px] sm:rounded-[36px] overflow-hidden flex flex-col justify-between transition-all duration-500 shadow-sm hover:shadow-xl group relative"
    >
      {/* Top Visual Container: Video permanently if uploaded, or slow motion image transitions if default */}
      <div className="relative h-[320px] sm:h-[340px] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 shrink-0">
        {isDisplayingVideo ? (
          <div className="absolute inset-0 z-10 bg-black">
            <video
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPhotosInstead(true)}
              className="absolute bottom-3 right-3 z-20 px-3 py-1 rounded-full bg-black/80 hover:bg-black backdrop-blur-md border border-white/20 text-white font-mono-tech text-[10px] cursor-pointer"
            >
              Show Photos
            </button>
          </div>
        ) : (
          p.images.map((img, imgIdx) => (
            <div
              key={img.url}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                imgIdx === currentImgIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <img
                src={img.url}
                alt={img.alt}
                loading="eager"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center filter contrast-[1.04] group-hover:scale-105 transition-all duration-1000 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
            </div>
          ))
        )}

        {/* If video exists and user switched to photos, allow switching back */}
        {hasVideo && showPhotosInstead && (
          <button
            type="button"
            onClick={() => setShowPhotosInstead(false)}
            className="absolute bottom-3 right-3 z-20 px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black backdrop-blur border border-white/30 text-white font-mono-tech text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <span>Play Video</span>
          </button>
        )}

        {/* Subtle slide progression indicator bars when viewing photos */}
        {!isDisplayingVideo && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 pointer-events-none">
            {p.images.map((_, dotIdx) => (
              <div
                key={dotIdx}
                className={`h-1 rounded-full transition-all duration-700 ${
                  dotIdx === currentImgIndex
                    ? 'w-6 bg-[#d4af37] shadow-sm'
                    : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lower Content - Pure White Card */}
      <div className="p-6 sm:p-7 flex flex-col justify-between flex-1 bg-white dark:bg-[#18181b]">
        <div className="space-y-1.5">
          <h3 className="font-syne font-bold text-2xl sm:text-3xl text-zinc-900 dark:text-white tracking-tight group-hover:text-[#d4af37] transition-colors leading-snug">
            {p.title}
          </h3>
          <p className="font-body text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed font-normal">
            {p.oneLiner}
          </p>
        </div>

        {/* CTA or indicator */}
        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          {p.ctaText ? (
            <button
              onClick={() => onCardCta(p.ctaAction)}
              className="px-5 py-2.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95 border border-zinc-600"
            >
              <span>{p.ctaText}</span>
              <ArrowRight className="w-3 h-3 text-[#d4af37]" />
            </button>
          ) : (
            <span className="text-xs font-mono-tech text-slate-500 font-medium">
              Annual remembrance
            </span>
          )}

          <span className="font-mono-tech text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Element 0{idx + 1}
          </span>
        </div>
      </div>
    </div>
  );
};

const PILLARS: PillarItem[] = [
  {
    id: 'class-album',
    tag: 'THE CLASS ALBUM',
    title: 'Class Album',
    oneLiner: 'Your people. Your memories. Your story.',
    ctaText: 'Explore Demo Album',
    ctaAction: 'demo',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&auto=format&fit=crop&q=80',
        alt: 'University classmates celebrating together in gowns',
      },
      {
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop&q=80',
        alt: 'Graduate portrait with academic sash',
      },
      {
        url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&auto=format&fit=crop&q=80',
        alt: 'Graduation dinner celebration and friendship',
      },
      {
        url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=900&auto=format&fit=crop&q=80',
        alt: 'Classmates gathered in lecture auditorium celebration',
      },
    ],
  },
  {
    id: 'legacy-plaque',
    tag: 'THE LEGACY PLAQUE',
    title: 'Legacy Plaque',
    oneLiner: 'A lasting place for your class on campus.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=900&auto=format&fit=crop&q=80',
        alt: 'Architectural plaque on university corridor wall',
      },
      {
        url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=900&auto=format&fit=crop&q=80',
        alt: 'Student scanning physical plaque with smartphone',
      },
      {
        url: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=900&auto=format&fit=crop&q=80',
        alt: 'University faculty hallway corridor with corridor installation',
      },
      {
        url: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=900&auto=format&fit=crop&q=80',
        alt: 'Laser-engraved alumni crest and permanent class plaque',
      },
    ],
  },
  {
    id: 'annual-reminder',
    tag: 'THE ANNUAL REMINDER',
    title: 'Annual Reminder',
    oneLiner: 'Some memories are worth coming back to',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&auto=format&fit=crop&q=80',
        alt: 'Graduation caps celebration and annual remembrance',
      },
      {
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&auto=format&fit=crop&q=80',
        alt: 'Alumnus smiling viewing anniversary alert on phone',
      },
      {
        url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&auto=format&fit=crop&q=80',
        alt: 'Annual class reunion toast and shared laughter',
      },
      {
        url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=900&auto=format&fit=crop&q=80',
        alt: 'Classmates gathering together years after graduation',
      },
    ],
  },
];

export const PillarsCarousel: React.FC<PillarsCarouselProps> = ({
  onExploreDemoAlbum,
  onOpenOnboarding,
  onScrollToHowItWorks,
  contentOverride,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Dynamically update transition dots on horizontal swipe/scroll
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      const scrollLeft = track.scrollLeft;
      const firstCard = track.firstElementChild as HTMLElement | null;
      if (!firstCard) return;
      const cardWidth = (firstCard.offsetWidth || 340) + 24; // width + gap
      const newIndex = Math.min(
        PILLARS.length - 1,
        Math.max(0, Math.round(scrollLeft / cardWidth))
      );
      if (!isNaN(newIndex)) {
        setActiveIndex(newIndex);
      }
    };

    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => track.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNext = () => {
    const next = (activeIndex + 1) % PILLARS.length;
    scrollToIndex(next);
  };

  const handlePrev = () => {
    const prev = (activeIndex - 1 + PILLARS.length) % PILLARS.length;
    scrollToIndex(prev);
  };

  const scrollToIndex = (idx: number) => {
    setActiveIndex(idx);
    if (trackRef.current && trackRef.current.children && trackRef.current.children[idx]) {
      const card = trackRef.current.children[idx] as HTMLElement;
      if (card) {
        trackRef.current.scrollTo({
          left: card.offsetLeft - trackRef.current.offsetLeft,
          behavior: 'smooth',
        });
      }
    }
  };

  const handleCardCta = (action: PillarItem['ctaAction']) => {
    if (action === 'demo') {
      onExploreDemoAlbum('unilag-cs-2026');
    } else if (action === 'legacy') {
      const el = document.getElementById('department-legacy-showcase');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (action === 'claim') {
      onOpenOnboarding();
    }
  };

  return (
    <section 
      id="core-pillars" 
      className="py-24 sm:py-32 px-6 sm:px-10 bg-zinc-100 dark:bg-[#121214] border-t border-b border-zinc-200 dark:border-zinc-800 relative overflow-hidden text-zinc-900 dark:text-white transition-colors duration-300"
    >
      {/* Background Graduation Pattern Watermark Texture */}
      <GraduationPattern className="opacity-15 dark:opacity-40" />



      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* =====================================================================
            PART 1: PROBLEM + SOLUTION NARRATIVE
            SLOW-MOTION: Titles reveal first (1250ms), then Captions follow (1350ms)
            ===================================================================== */}
        <div className="max-w-3xl mb-20 space-y-6">
          <ScrollReveal delayMs={0} durationMs={1250}>
            <div className="flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest font-extrabold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="text-[#d4af37]">WHY KOHOT EXISTS</span>
            </div>

            <h2 className="font-syne font-extrabold text-3xl sm:text-5xl lg:text-6xl text-zinc-900 dark:text-white tracking-tight leading-tight">
              The years you shared will move on. Your memories don’t have to.
            </h2>
          </ScrollReveal>

          <ScrollReveal delayMs={480} durationMs={1350}>
            {/* Rich medium slate body text in light mode, calm white in dark mode for contrast */}
            <div className="space-y-4 font-body text-base sm:text-lg text-slate-600 dark:text-zinc-200 leading-relaxed">
              <p>
                Graduation changes everything: people move away, busy lives begin, and class groups quiet down. Photos become scattered across old phones, disappearing stories, and forgotten group chats.
              </p>
              <p className="text-slate-600 dark:text-zinc-200 font-normal">
                Physical paper albums get damaged, lost, or left behind in family basements. But the bonds you built over years of late-night studio sessions, lab defenses, and dinner galas deserve more than fading away.
              </p>
              <p className="text-slate-900 dark:text-white font-bold">
                KoHot gives your class somewhere to remain.
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* =====================================================================
            PART 2: THREE PILLARS
            SLOW-MOTION: Title first, then Caption
            ===================================================================== */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 pt-10 border-t border-slate-200 dark:border-zinc-800">
          <div className="max-w-2xl space-y-3">
            <ScrollReveal delayMs={0} durationMs={1250}>
              <div className="flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest font-extrabold mb-2">
                <Layers className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="text-[#d4af37]">{contentOverride?.pillarsEyebrow || 'THE THREE ELEMENTS'}</span>
              </div>
              <h3 className="font-syne font-extrabold text-2xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight leading-tight">
                {contentOverride?.pillarsHeading || 'Everything your class needs to leave a legacy'}
              </h3>
            </ScrollReveal>

            <ScrollReveal delayMs={480} durationMs={1350}>
              {/* Rich medium slate subheading in light mode, calm white in dark mode */}
              <p className="font-body text-sm sm:text-base text-slate-600 dark:text-zinc-200 font-normal">
                {contentOverride?.pillarsSubtitle || 'Three essential elements to preserve your people, your memories, and your story.'}
              </p>
            </ScrollReveal>
          </div>

          {/* Nav Controls */}
          <div className="flex items-center gap-3 self-start md:self-end">
            <button
              onClick={handlePrev}
              className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              aria-label="Previous pillar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              aria-label="Next pillar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Track */}
        <div
          ref={trackRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 scrollbar-none no-scrollbar -mx-6 px-6 sm:-mx-10 sm:px-10 lg:grid lg:grid-cols-3 lg:overflow-visible lg:p-0"
          style={{ scrollBehavior: 'smooth' }}
        >
          {PILLARS.map((p, idx) => {
            const videoUrl =
              p.id === 'class-album'
                ? contentOverride?.classAlbumTourUrl || contentOverride?.classAlbumCardVideoUrl
                : p.id === 'legacy-plaque'
                ? contentOverride?.legacyPlaqueTourUrl || contentOverride?.legacyPlaqueCardVideoUrl
                : contentOverride?.annualReminderTourUrl || contentOverride?.annualReminderCardVideoUrl;

            return (
              <PillarCardItem
                key={p.id}
                pillar={p}
                idx={idx}
                videoUrl={videoUrl}
                onCardCta={handleCardCta}
              />
            );
          })}
        </div>

        {/* Indicator dots for mobile/tablet */}
        <div className="flex lg:hidden items-center justify-center gap-2 mt-8">
          {PILLARS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${
                activeIndex === idx
                  ? 'w-8 bg-zinc-900'
                  : 'w-2 bg-zinc-300 hover:bg-zinc-400'
              }`}
              aria-label={`Go to pillar ${idx + 1}`}
            />
          ))}
        </div>

      </div>
    </section>
  );
};
