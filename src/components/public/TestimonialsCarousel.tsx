import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Quote, 
  ShieldCheck, 
  Sparkles,
  MessageSquarePlus
} from 'lucide-react';
import { TestimonialRecord } from '../../types';
import { getStoredTestimonials } from '../../data/initialData';
import { TestimonialSubmissionModal } from './TestimonialSubmissionModal';
import { ScrollReveal } from '../common/ScrollReveal';

export const TestimonialsCarousel: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const loadApprovedTestimonials = () => {
    const all = getStoredTestimonials();
    // STRICT SECURITY & CONSENT ENFORCEMENT:
    // Only items with publicationPermission === 'public' AND reviewStatus === 'approved' appear on public website
    const publicApproved = all.filter(
      (t) => t.publicationPermission === 'public' && t.reviewStatus === 'approved'
    );
    setTestimonials(publicApproved);
  };

  useEffect(() => {
    loadApprovedTestimonials();
  }, []);

  const handleNext = () => {
    if (testimonials.length === 0) return;
    const next = (activeIndex + 1) % testimonials.length;
    scrollToIndex(next);
  };

  const handlePrev = () => {
    if (testimonials.length === 0) return;
    const prev = (activeIndex - 1 + testimonials.length) % testimonials.length;
    scrollToIndex(prev);
  };

  const scrollToIndex = (idx: number) => {
    setActiveIndex(idx);
    if (trackRef.current) {
      const card = trackRef.current.children[idx] as HTMLElement;
      if (card) {
        trackRef.current.scrollTo({
          left: card.offsetLeft - trackRef.current.offsetLeft,
          behavior: 'smooth',
        });
      }
    }
  };

  return (
    <section 
      id="testimonials" 
      className="py-24 sm:py-32 px-6 sm:px-10 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#121214] relative overflow-hidden text-slate-900 dark:text-white transition-colors duration-300"
    >


      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header - SLOW-MOTION: Titles first (1250ms), then Captions (1350ms) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div className="max-w-2xl space-y-3">
            <ScrollReveal delayMs={0} durationMs={1250}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white mb-2 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] font-extrabold text-amber-600">
                  THE LEGACY, IN THEIR WORDS
                </span>
              </div>
              <h2 className="font-syne font-extrabold text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight leading-tight">
                The Legacy, In Their Words
              </h2>
            </ScrollReveal>

            <ScrollReveal delayMs={480} durationMs={1350}>
              {/* Rich medium slate subheading */}
              <p className="font-body text-sm sm:text-base text-slate-600 dark:text-zinc-200 font-normal">
                Hear from the people who brought their classes together.
              </p>
            </ScrollReveal>
          </div>

          {/* Controls & Submission CTA */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-end">
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-slate-900 hover:bg-black border border-slate-800 text-white font-syne font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Share Your Experience</span>
            </button>

            {testimonials.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Swipeable Testimonials Track */}
        {testimonials.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-body text-sm shadow-sm">
            No public testimonials published yet. Be the first Class Album Admin to share your experience.
          </div>
        ) : (
          <div
            ref={trackRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 scrollbar-none no-scrollbar -mx-6 px-6 sm:-mx-10 sm:px-10"
            style={{ scrollBehavior: 'smooth' }}
          >
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="w-[85vw] sm:w-[440px] md:w-[480px] shrink-0 snap-start bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 rounded-[32px] p-7 sm:p-9 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-xl relative group"
              >
                {/* Top Accent Rim */}
                <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent" />

                {/* Quote Mark & Content */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 flex items-center justify-center text-amber-600">
                      <Quote className="w-4 h-4" />
                    </div>
                    {/* Role Badge */}
                    <div className="inline-flex items-center gap-1.5 font-mono-tech text-[10px] text-slate-700 dark:text-zinc-300 px-3 py-1 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      <span>Class Album Admin</span>
                    </div>
                  </div>

                  <p className="font-body text-sm sm:text-base text-slate-700 dark:text-zinc-200 leading-relaxed font-normal">
                    "{t.testimonialText}"
                  </p>
                </div>

                {/* Author Info with Circular Avatar & Department details */}
                <div className="pt-7 mt-6 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={t.avatarUrl || 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=320&auto=format&fit=crop&q=80'}
                      alt={t.name}
                      className="w-13 h-13 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-slate-200 shadow-sm group-hover:border-[#d4af37] transition-colors"
                    />
                    <div 
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#d4af37] text-black flex items-center justify-center shadow-md"
                      title="Verified Class Album Admin"
                    >
                      <ShieldCheck className="w-3 h-3 text-black" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-syne font-bold text-base text-slate-900 dark:text-white truncate">
                        {t.name}
                      </h4>
                    </div>
                    <p className="font-mono-tech text-xs text-amber-600 truncate mt-0.5 font-semibold">
                      Class Album Admin • Class of '{String(t.classYear).slice(-2)}
                    </p>
                    <p className="font-body text-xs text-slate-600 dark:text-zinc-300 truncate mt-0.5">
                      {t.department}{t.faculty ? `, ${t.faculty}` : ''}
                    </p>
                    <p className="font-body text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {t.university}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Indicator dots */}
        {testimonials.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => scrollToIndex(idx)}
                className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${
                  activeIndex === idx
                    ? 'w-8 bg-zinc-900'
                    : 'w-2 bg-zinc-300 hover:bg-zinc-400'
                }`}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Submission Modal */}
      <TestimonialSubmissionModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => {
          loadApprovedTestimonials();
        }}
      />
    </section>
  );
};
