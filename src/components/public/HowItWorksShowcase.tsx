import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Bell, 
  Check, 
  Share2, 
  QrCode, 
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Camera,
  Heart
} from 'lucide-react';
import { ScrollReveal } from '../common/ScrollReveal';

interface HowItWorksShowcaseProps {
  onOpenOnboarding: () => void;
  onExploreDemos: () => void;
}

interface StepItem {
  id: number;
  stepNum: string;
  tagline: string;
  title: string;
  description: string;
  type: 'phone' | 'plaque';
  category: string;
}

export const HowItWorksShowcase: React.FC<HowItWorksShowcaseProps> = ({
  onOpenOnboarding,
  onExploreDemos,
}) => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const steps: StepItem[] = [
    {
      id: 0,
      stepNum: '01',
      tagline: 'CLAIM YOUR CLASS',
      title: 'Claim Your Class',
      description: 'Choose your university, faculty, department and graduating year. Start your class album in just a few minutes.',
      type: 'phone',
      category: 'Start',
    },
    {
      id: 1,
      stepNum: '02',
      tagline: 'INVITE YOUR CLASSMATES',
      title: 'Invite Your Classmates',
      description: 'Share one link with your class WhatsApp group. No app to download. No complicated sign-up.',
      type: 'phone',
      category: 'Connect',
    },
    {
      id: 2,
      stepNum: '03',
      tagline: 'EVERYONE ADDS THEIR STORY',
      title: 'Everyone Adds Their Story',
      description: 'Each graduate adds a portrait, nickname, parting words and contact details. It takes less than a minute.',
      type: 'phone',
      category: 'Portraits',
    },
    {
      id: 3,
      stepNum: '04',
      tagline: 'BRING THE MEMORIES TOGETHER',
      title: 'Bring the Memories Together',
      description: 'Choose the moments your class wants to remember. Add photographs, celebrations, awards, videos and other special memories.',
      type: 'phone',
      category: 'Highlights',
    },
    {
      id: 4,
      stepNum: '05',
      tagline: 'YOUR ALBUM COMES TO LIFE',
      title: 'Your Album Comes to Life',
      description: 'When everything is ready, your Class Album goes live. Your classmates can return to it whenever they want.',
      type: 'phone',
      category: 'Keepsake',
    },
    {
      id: 5,
      stepNum: '06',
      tagline: 'LEAVE SOMETHING BEHIND',
      title: 'Leave Something Behind',
      description: 'Your class becomes part of your department’s story. The Legacy Plaque gives your class a lasting place on campus.',
      type: 'plaque',
      category: 'Legacy',
    },
    {
      id: 6,
      stepNum: '07',
      tagline: 'COME BACK EVERY YEAR',
      title: 'Come Back Every Year',
      description: 'Each year, KoHot sends a gentle reminder to return to your album, remember the moments and reconnect with your classmates.',
      type: 'phone',
      category: 'Remembrance',
    },
  ];

  // Dynamic onScroll listener so dots transit seamlessly as the user swipes
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      const scrollLeft = track.scrollLeft;
      const firstCard = track.firstElementChild as HTMLElement | null;
      if (!firstCard) return;
      const cardWidth = (firstCard.offsetWidth || 340) + 24; // width + gap
      const newIndex = Math.min(
        steps.length - 1,
        Math.max(0, Math.round(scrollLeft / cardWidth))
      );
      if (!isNaN(newIndex)) {
        setActiveStep(newIndex);
      }
    };

    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => track.removeEventListener('scroll', handleScroll);
  }, [steps.length]);

  const scrollToIndex = (idx: number) => {
    setActiveStep(idx);
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

  const handleNext = () => {
    const next = (activeStep + 1) % steps.length;
    scrollToIndex(next);
  };

  const handlePrev = () => {
    const prev = (activeStep - 1 + steps.length) % steps.length;
    scrollToIndex(prev);
  };

  const handleShareInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <section 
      id="how-it-works" 
      className="py-24 sm:py-32 px-6 sm:px-10 bg-slate-50 dark:bg-[#121214] border-t border-slate-200 dark:border-zinc-800 relative overflow-hidden text-slate-900 dark:text-white transition-colors duration-300"
    >


      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header - SLOW-MOTION: Titles first (1250ms), then Captions (1350ms) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl space-y-3">
            <ScrollReveal delayMs={0} durationMs={1250}>
              <div className="flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest font-extrabold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="text-[#d4af37]">HOW IT WORKS</span>
              </div>
              <h2 className="font-syne font-extrabold text-3xl sm:text-5xl lg:text-6xl text-slate-900 dark:text-white tracking-tight leading-tight">
                From Your Class to a Legacy That Lasts
              </h2>
            </ScrollReveal>

            <ScrollReveal delayMs={480} durationMs={1350}>
              {/* Rich medium slate subheading in light mode, calm white in dark mode */}
              <p className="font-body text-sm sm:text-base text-slate-600 dark:text-zinc-200 font-normal">
                Bring everyone together, gather the memories, and let KoHot preserve the rest.
              </p>
            </ScrollReveal>
          </div>

          {/* Nav Controls */}
          <div className="flex items-center gap-3 self-start md:self-end">
            <button
              onClick={handlePrev}
              className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              aria-label="Previous step"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
              aria-label="Next step"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7-Card Horizontal Swipeable Carousel Track */}
        <div
          ref={trackRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 pt-2 scrollbar-none no-scrollbar -mx-6 px-6 sm:-mx-10 sm:px-10"
          style={{ scrollBehavior: 'smooth' }}
        >
          {steps.map((s, idx) => (
            <div
              key={s.id}
              className="w-[86vw] sm:w-[380px] md:w-[410px] h-[520px] sm:h-[540px] shrink-0 snap-start bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 hover:border-slate-300 rounded-[32px] sm:rounded-[36px] overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-xl group relative"
            >
              {/* TOP VISUAL CONTAINER: Human, emotional UI preview */}
              <div className="relative h-[310px] sm:h-[330px] w-full overflow-hidden bg-slate-100/90 dark:bg-zinc-900 p-4 sm:p-5 flex items-center justify-center shrink-0">
                
                {/* STEP 06: ARCHITECTURAL WALL PLAQUE MOCKUP */}
                {s.type === 'plaque' ? (
                  <div className="w-full max-w-[280px] rounded-2xl bg-zinc-950 border-2 border-[#d4af37]/60 p-5 flex flex-col justify-between shadow-2xl relative h-[280px]">
                    {/* 4 Corner Accents */}
                    <div className="absolute top-2.5 left-2.5 w-2 h-2 rounded-full bg-[#d4af37] border border-black shadow" />
                    <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#d4af37] border border-black shadow" />
                    <div className="absolute bottom-2.5 left-2.5 w-2 h-2 rounded-full bg-[#d4af37] border border-black shadow" />
                    <div className="absolute bottom-2.5 right-2.5 w-2 h-2 rounded-full bg-[#d4af37] border border-black shadow" />

                    <div className="text-center space-y-1 pt-1">
                      <div className="w-6 h-6 rounded-full mx-auto border border-[#d4af37]/50 bg-black/70 flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#d4af37] rotate-45" />
                      </div>
                      <div className="font-mono-tech text-[8px] uppercase tracking-wider text-[#d4af37]">
                        UNIVERSITY OF LAGOS
                      </div>
                      <div className="font-syne font-bold text-sm text-white">
                        Department of Computer Science
                      </div>
                    </div>

                    <div className="my-auto flex flex-col items-center justify-center">
                      <div className="p-2.5 rounded-xl bg-white text-black shadow-lg">
                        <QrCode className="w-16 h-16 text-black" strokeWidth={2.4} />
                      </div>
                      <span className="mt-2 font-mono-tech text-[8px] uppercase tracking-wider text-[#d4af37] font-semibold">
                        Scan to View Class Album
                      </span>
                    </div>

                    <div className="text-center border-t border-[#d4af37]/20 pt-2">
                      <span className="font-mono-tech text-[8px] text-zinc-400 uppercase">
                        MOUNTED IN DEPARTMENT CORRIDOR
                      </span>
                    </div>
                  </div>
                ) : (
                  /* STEPS 01, 02, 03, 04, 05, 07: SMARTPHONE DISPLAY MOCKUP */
                  <div className="w-full max-w-[270px] sm:max-w-[290px] h-[290px] rounded-[32px] bg-white p-2 border-2 border-zinc-200/90 shadow-xl relative flex flex-col overflow-hidden">
                    <div className="w-full h-full rounded-[24px] bg-[#fafafa] border border-zinc-200/70 p-3.5 flex flex-col justify-between overflow-hidden relative text-left">
                      
                      {/* Top bar */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 select-none">
                        <span className="font-mono-tech text-[9px] text-zinc-500">Class Album</span>
                        <div className="w-12 h-2 bg-zinc-300 rounded-full" />
                        <span className="font-mono-tech text-[8px] text-[#b89728] font-bold">KOHOT</span>
                      </div>

                      {/* Step 01: Claim Your Class */}
                      {idx === 0 && (
                        <div className="my-auto space-y-2.5 text-left">
                          <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-xs">
                            <span className="font-mono-tech text-[8px] text-[#b89728] uppercase tracking-wider font-bold">Start Your Album</span>
                            <div className="font-syne font-bold text-sm text-zinc-900">University of Lagos</div>
                            <div className="font-body text-[10px] text-zinc-500">Department of Computer Science</div>
                            <div className="font-mono-tech text-[9px] text-[#b89728] font-medium">Class of 2026</div>
                          </div>
                          <div className="p-2 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/30 text-center">
                            <span className="font-mono-tech text-[9px] text-[#b89728] font-bold">Ready in 3 minutes</span>
                          </div>
                        </div>
                      )}

                      {/* Step 02: Invite Classmates */}
                      {idx === 1 && (
                        <div className="my-auto space-y-2.5 text-center">
                          <div className="w-10 h-10 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#b89728] flex items-center justify-center mx-auto">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="font-syne font-bold text-sm text-zinc-900">Share with WhatsApp Group</div>
                            <p className="font-body text-[10px] text-zinc-600 leading-snug">
                              "Hey classmates! Here is our class album link to add your picture and parting words."
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-zinc-100 border border-zinc-200 font-mono-tech text-[9px] text-zinc-600">
                            No app download • Works on any phone
                          </div>
                        </div>
                      )}

                      {/* Step 03: Everyone Adds Their Story */}
                      {idx === 2 && (
                        <div className="my-auto space-y-2 text-left">
                          <div className="flex items-center gap-2.5">
                            <img
                              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80"
                              alt="Graduate"
                              className="w-11 h-11 rounded-xl object-cover border border-[#d4af37]/60 shadow-sm"
                            />
                            <div>
                              <div className="font-syne font-bold text-sm text-zinc-900">Amina Bello</div>
                              <div className="font-mono-tech text-[9px] text-[#b89728] font-bold">"Algorithm Queen"</div>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-200 space-y-1 text-[9px] font-body text-zinc-700">
                            <div className="italic">"Grateful for the friendships that shaped these unforgettable years."</div>
                          </div>
                          <div className="text-center font-mono-tech text-[8px] text-zinc-400">
                            Takes less than a minute to contribute
                          </div>
                        </div>
                      )}

                      {/* Step 04: Bring Memories Together */}
                      {idx === 3 && (
                        <div className="my-auto space-y-2 text-left">
                          <div className="flex items-center justify-between">
                            <span className="font-mono-tech text-[8px] text-zinc-500 uppercase font-bold">Class Highlights</span>
                            <span className="px-2 py-0.5 rounded-full bg-[#d4af37]/20 text-[#b89728] font-mono-tech text-[8px] font-bold">
                              Shared Moments
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <div className="relative aspect-square rounded-lg bg-zinc-200 overflow-hidden shadow-xs">
                              <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=200&auto=format&fit=crop&q=80" className="w-full h-full object-cover" alt="Dinner" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[7px] text-white font-mono-tech font-bold">Dinner</div>
                            </div>
                            <div className="relative aspect-square rounded-lg bg-zinc-200 overflow-hidden shadow-xs">
                              <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&auto=format&fit=crop&q=80" className="w-full h-full object-cover" alt="Awards" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[7px] text-white font-mono-tech font-bold">Awards</div>
                            </div>
                            <div className="relative aspect-square rounded-lg bg-zinc-200 overflow-hidden shadow-xs">
                              <img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=200&auto=format&fit=crop&q=80" className="w-full h-full object-cover" alt="Defence" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[7px] text-white font-mono-tech font-bold">Defence</div>
                            </div>
                          </div>
                          <div className="text-center font-mono-tech text-[8px] text-zinc-400">
                            Photographs, celebrations and awards
                          </div>
                        </div>
                      )}

                      {/* Step 05: Your Album Comes to Life */}
                      {idx === 4 && (
                        <div className="my-auto space-y-2 text-center">
                          <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-zinc-200 shadow-md">
                            <img
                              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&auto=format&fit=crop&q=80"
                              alt="Album live"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-2.5 text-left">
                              <span className="font-mono-tech text-[8px] text-[#d4af37] font-bold">CLASS OF 2026</span>
                              <div className="font-syne font-bold text-sm text-white">Official Class Album</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono-tech text-[#b89728] font-bold">
                            <Check className="w-3 h-3" />
                            <span>Your Class Album is Live</span>
                          </div>
                        </div>
                      )}

                      {/* Step 07: Come Back Every Year */}
                      {idx === 6 && (
                        <div className="my-auto space-y-2 text-left">
                          <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1.5 shadow-xs">
                            <div className="flex items-center gap-1.5 text-[#b89728]">
                              <Bell className="w-3.5 h-3.5" />
                              <span className="font-mono-tech text-[9px] font-bold uppercase">Annual Reminder</span>
                            </div>
                            <div className="font-syne font-bold text-sm text-zinc-900 leading-tight">
                              Convocation Anniversary
                            </div>
                            <div className="font-body text-[9px] text-zinc-600 leading-snug">
                              It has been one year! Return to your class album, revisit the moments and reconnect with classmates.
                            </div>
                          </div>
                          <div className="text-center font-mono-tech text-[8px] text-zinc-400">
                            A gentle tradition every year
                          </div>
                        </div>
                      )}

                      {/* Phone Bottom Bar */}
                      <div className="w-16 h-1 bg-zinc-300 rounded-full mx-auto" />
                    </div>
                  </div>
                )}
              </div>

              {/* LOWER CONTENT CONTAINER - Pure Clean White */}
              <div className="p-6 sm:p-7 flex flex-col justify-between flex-1 bg-white dark:bg-[#18181b]">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#d4af37] font-mono-tech text-[11px] font-bold uppercase tracking-wider">
                      STEP {s.stepNum}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono-tech text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      {s.tagline}
                    </span>
                  </div>

                  <h3 className="font-syne font-bold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight leading-snug group-hover:text-[#d4af37] transition-colors">
                    {s.title}
                  </h3>

                  <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-400 line-clamp-3 leading-relaxed font-normal">
                    {s.description}
                  </p>
                </div>

                {/* Bottom Action Prompt */}
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  {s.id === 0 ? (
                    <button
                      onClick={onOpenOnboarding}
                      className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-black text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                    >
                      <span>Start Class</span>
                      <ArrowRight className="w-3 h-3 text-[#d4af37]" />
                    </button>
                  ) : s.id === 1 ? (
                    <button
                      onClick={handleShareInvite}
                      className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white dark:border-zinc-700 font-mono-tech font-bold text-xs uppercase tracking-wider border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
                      <span>{copiedLink ? 'Link Ready' : 'Share Link'}</span>
                    </button>
                  ) : s.id === 4 ? (
                    <button
                      onClick={onExploreDemos}
                      className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white dark:border-zinc-700 font-mono-tech font-bold text-xs uppercase tracking-wider border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <span>Explore Demos</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="font-mono-tech text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      {s.category}
                    </span>
                  )}

                  <span className="font-mono-tech text-[11px] text-slate-400 font-medium">
                    {idx + 1} of 07
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Single clear primary action at the end of the 7 steps */}
        <div className="mt-12 text-center">
          <button
            onClick={onOpenOnboarding}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-slate-950 font-syne font-bold text-sm uppercase tracking-wider transition-all cursor-pointer shadow-xl shadow-black/20 active:scale-95"
          >
            <span>Create Class Album</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* =====================================================================
            PART 2: ONE DEPARTMENT. MANY GENERATIONS. (DEPARTMENT LEGACY SECTION)
            SLOW-MOTION: Title first (1250ms), then Captions (1350ms)
            ===================================================================== */}
        <div id="department-legacy" className="mt-28 pt-20 -mx-6 sm:-mx-10 px-6 sm:px-10 py-24 bg-slate-100/80 dark:bg-[#121214] border-t border-b border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white transition-colors duration-300 relative overflow-hidden">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 relative z-10">
            <ScrollReveal delayMs={0} durationMs={1250}>
              <div className="flex items-center justify-center gap-2 font-mono-tech text-xs uppercase tracking-widest font-extrabold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="text-[#d4af37]">ONE DEPARTMENT. MANY GENERATIONS.</span>
              </div>
              <h3 className="font-syne font-extrabold text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight leading-tight">
                One Legacy. Every Class.
              </h3>
            </ScrollReveal>

            <ScrollReveal delayMs={480} durationMs={1350}>
              {/* Calm white in dark mode, slate grey in light mode */}
              <p className="font-body text-base text-slate-600 dark:text-zinc-200 font-medium max-w-2xl mx-auto leading-relaxed">
                A graduating class is not an isolated event, but one chapter in a department’s continuing story.
              </p>
              <p className="font-body text-sm sm:text-base text-slate-600 dark:text-zinc-200 font-normal max-w-2xl mx-auto leading-relaxed mt-2">
                Mounted permanently in your faculty corridor, the architectural metal Department Legacy Plaque links generations of classes together. Anyone scanning or tapping the physical plaque instantly accesses the living archive of graduating classes across decades.
              </p>
            </ScrollReveal>
          </div>

          {/* Department Architecture Diagram Card - Pure Clean White with Subtle Slate Borders in light, dark/mid grey #18181b in dark */}
          <ScrollReveal delayMs={450} durationMs={950}>
            <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-sm hover:shadow-md relative overflow-hidden text-slate-900 dark:text-white max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Plaque Graphic (Physical Anchor on Campus Wall) */}
              <div className="lg:col-span-5 flex flex-col items-center text-center">
                <div className="w-full max-w-xs rounded-2xl bg-zinc-950 border-2 border-[#d4af37]/60 p-6 shadow-2xl relative group">
                  {/* Brass Corner Standoffs */}
                  <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />
                  <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />
                  <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />
                  <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />

                  {/* University & Department Header */}
                  <div className="space-y-1 mt-2">
                    <span className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-[#d4af37] block font-semibold">
                      DEPARTMENT OF COMPUTER SCIENCE
                    </span>
                    <h5 className="font-syne font-bold text-base text-white uppercase">
                      University of Lagos
                    </h5>
                  </div>

                  {/* QR Code Gateway */}
                  <div className="my-5 p-3 rounded-xl bg-white text-black inline-flex items-center justify-center shadow-lg">
                    <QrCode className="w-16 h-16 text-black" strokeWidth={2.2} />
                  </div>

                  <p className="font-mono-tech text-[10px] text-zinc-400 uppercase tracking-widest">
                    Scan or Tap to Open Living Class Albums
                  </p>
                </div>

                <span className="font-mono-tech text-xs text-slate-500 dark:text-zinc-400 mt-4 font-medium">
                  Physical Installation in Faculty Corridor
                </span>
              </div>

              {/* Connected Classes Tree */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="font-syne font-bold text-xl text-slate-900 dark:text-white mb-2">
                  Connected Class Albums Across Years
                </h4>
                
                <div className="space-y-2.5">
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90 flex items-center justify-between opacity-90 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-zinc-500" />
                      <div>
                        <div className="font-syne font-bold text-sm text-slate-900 dark:text-white">Class of 2027 &amp; Future Generations</div>
                        <div className="font-mono-tech text-xs text-slate-500 dark:text-zinc-400">Reserved in Department Living Archive • Next in Line</div>
                      </div>
                    </div>
                    <span className="font-mono-tech text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Next in Line</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#d4af37]/10 border-2 border-[#d4af37]/40 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-pulse" />
                      <div>
                        <div className="font-syne font-bold text-sm text-slate-950 dark:text-white">Class of 2026 (Current Active Class)</div>
                        <div className="font-mono-tech text-xs text-slate-700 dark:text-zinc-300">Portraits &amp; Moments Currently Being Curated</div>
                      </div>
                    </div>
                    <span className="font-mono-tech text-[10px] text-[#d4af37] font-bold uppercase">Active</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#d4af37]" />
                      <div>
                        <div className="font-syne font-bold text-sm text-slate-900 dark:text-white">Class of 2025 (The Innovators)</div>
                        <div className="font-mono-tech text-xs text-slate-600 dark:text-zinc-400">142 Graduates Preserved • Linked to Department Gateway</div>
                      </div>
                    </div>
                    <span className="font-mono-tech text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Preserved</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#d4af37]" />
                      <div>
                        <div className="font-syne font-bold text-sm text-slate-900 dark:text-white">Class of 2024 (Pioneers)</div>
                        <div className="font-mono-tech text-xs text-slate-600 dark:text-zinc-400">128 Graduates Preserved • Permanent Plaque Established</div>
                      </div>
                    </div>
                    <span className="font-mono-tech text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Preserved</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
          </ScrollReveal>

          {/* =====================================================================
              PART 3: REASSURING PRIVACY & PRESERVATION (PURE WHITE CARD IN LIGHT, DARK GREY IN DARK)
              ===================================================================== */}
          <ScrollReveal delayMs={300} durationMs={950}>
            <div className="mt-16 p-8 sm:p-10 rounded-[32px] bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-center max-w-4xl mx-auto space-y-4 shadow-sm text-slate-900 dark:text-white">
              <span className="font-mono-tech text-xs uppercase tracking-widest text-[#d4af37] font-bold">
                PRIVACY &amp; PRESERVATION
              </span>
              <h4 className="font-syne font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
                Not public. Not forgotten. Preserved within your department’s story.
              </h4>
              <p className="font-body text-sm sm:text-base text-slate-600 dark:text-zinc-200 max-w-2xl mx-auto leading-relaxed">
                A Class Album is not an unsearchable lost page and not a public social media feed. It is safely preserved as part of your department’s KoHot Legacy, reached through your department’s physical Legacy Plaque, and shared by the members of your graduating class.
              </p>
            </div>
          </ScrollReveal>

        </div>

      </div>
    </section>
  );
};
