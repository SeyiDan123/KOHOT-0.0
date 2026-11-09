import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Quote,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import { TestimonialRecord, WebsiteContentOverride } from '../../types';
import { getStoredTestimonials } from '../../data/initialData';
import { fetchTestimonialsFromD1 } from '../../utils/apiClient';
import { ScrollReveal } from '../common/ScrollReveal';
import { GraduationPattern } from '../common/GraduationPattern';
import { GlazedImage } from '../common/GlazedImage';

interface TestimonialsCarouselProps {
  onShowToast?: (message: string) => void;
  contentOverride?: WebsiteContentOverride;
}

export const TestimonialsCarousel: React.FC<TestimonialsCarouselProps> = ({
  contentOverride,
}) => {
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const filterVisibleApproved = (items: TestimonialRecord[]) => {
    return items
      .filter(
        (t) =>
          t.isVisible !== false &&
          (t.status === 'Approved' ||
            t.reviewStatus === 'approved' ||
            (!t.status && !t.reviewStatus)) &&
          t.publicationPermission !== 'private'
      )
      .sort((a, b) => {
        const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999;
        const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999;
        if (orderA !== orderB) return orderA - orderB;
        return (
          new Date(b.submittedAt || b.createdAt || 0).getTime() -
          new Date(a.submittedAt || a.createdAt || 0).getTime()
        );
      });
  };

  const loadTestimonials = async () => {
    const localApproved = filterVisibleApproved(getStoredTestimonials());
    setTestimonials(localApproved);

    try {
      const d1Res = await fetchTestimonialsFromD1();
      if (
        d1Res &&
        d1Res.success &&
        Array.isArray(d1Res.testimonials) &&
        d1Res.testimonials.length > 0
      ) {
        const d1Approved = filterVisibleApproved(d1Res.testimonials);
        if (d1Approved.length > 0) {
          setTestimonials(d1Approved);
        }
      }
    } catch {
      // fallback to localApproved
    }
  };

  useEffect(() => {
    loadTestimonials();

    const handleStorageChange = () => {
      loadTestimonials();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('kohot_testimonials_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('kohot_testimonials_updated', handleStorageChange);
    };
  }, []);

  // Sync activeIndex with horizontal scroll
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      const scrollLeft = track.scrollLeft;
      const firstCard = track.firstElementChild as HTMLElement | null;
      if (!firstCard) return;
      const cardWidth = (firstCard.offsetWidth || 360) + 24;
      const newIndex = Math.min(
        Math.max(0, testimonials.length - 1),
        Math.max(0, Math.round(scrollLeft / cardWidth))
      );
      if (!isNaN(newIndex)) {
        setActiveIndex(newIndex);
      }
    };

    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => track.removeEventListener('scroll', handleScroll);
  }, [testimonials.length]);

  const scrollToIndex = (idx: number) => {
    if (testimonials.length === 0) return;
    const bounded = (idx + testimonials.length) % testimonials.length;
    setActiveIndex(bounded);
    if (trackRef.current && trackRef.current.children && trackRef.current.children[bounded]) {
      const card = trackRef.current.children[bounded] as HTMLElement;
      if (card) {
        trackRef.current.scrollTo({
          left: card.offsetLeft - trackRef.current.offsetLeft,
          behavior: 'smooth',
        });
      }
    }
  };

  // Gentle auto-advance when not hovered
  useEffect(() => {
    if (testimonials.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      scrollToIndex(activeIndex + 1);
    }, 6500);
    return () => clearInterval(timer);
  }, [testimonials.length, isHovered, activeIndex]);

  const handlePrev = () => {
    scrollToIndex(activeIndex - 1);
  };

  const handleNext = () => {
    scrollToIndex(activeIndex + 1);
  };

  if (testimonials.length === 0) {
    return null;
  }

  const eyebrow =
    contentOverride?.testimonialsEyebrow || 'THE LEGACY, IN THEIR WORDS';
  const heading =
    contentOverride?.testimonialsHeading ||
    contentOverride?.testimonialsTitle ||
    'What Graduating Classes Say';
  const subtitle =
    contentOverride?.testimonialsSubtitle ||
    'Real experiences from class representatives and album admins who preserved their graduating class on KoHot.';

  return (
    <section
      id="testimonials-showcase-section"
      className="py-24 sm:py-32 px-6 sm:px-10 bg-zinc-100 dark:bg-[#18181b] border-t border-zinc-200 dark:border-zinc-800 relative overflow-hidden text-zinc-900 dark:text-white transition-colors duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Graduation Pattern Watermark Texture */}
      <GraduationPattern className="opacity-15 dark:opacity-35" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        {/* Section Header Matching Overall Website UI */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            <ScrollReveal delayMs={0} durationMs={1150}>
              <div className="flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest font-extrabold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="text-[#d4af37]">{eyebrow}</span>
              </div>

              <h2 className="font-syne font-bold text-3xl sm:text-4xl lg:text-5xl text-zinc-900 dark:text-white tracking-tight leading-tight text-left">
                {heading}
              </h2>
            </ScrollReveal>

            <ScrollReveal delayMs={250} durationMs={1200}>
              <p className="font-body text-base sm:text-lg text-slate-600 dark:text-zinc-300 leading-relaxed text-left">
                {subtitle}
              </p>
            </ScrollReveal>
          </div>

          {/* Carousel Controls */}
          {testimonials.length > 1 && (
            <div className="flex items-center gap-2.5 self-start md:self-end shrink-0">
              <button
                type="button"
                onClick={handlePrev}
                className="w-11 h-11 rounded-full bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:border-[#d4af37] hover:text-[#d4af37] transition-all cursor-pointer shadow-xs active:scale-95"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-11 h-11 rounded-full bg-white dark:bg-[#121215] border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:border-[#d4af37] hover:text-[#d4af37] transition-all cursor-pointer shadow-xs active:scale-95"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Horizontal Snap Carousel of Luxury Testimonial Cards */}
        <div
          ref={trackRef}
          className="flex lg:grid lg:grid-cols-3 gap-6 overflow-x-auto lg:overflow-visible no-scrollbar snap-x snap-mandatory pb-4"
        >
          {testimonials.map((t, idx) => {
            const author =
              t.name || t.authorName || t.fullName || 'Class Representative';
            const role =
              t.role || t.authorRole || 'Class Album Admin';
            const department =
              t.department || t.departmentName || 'Department';
            const university =
              t.university || t.universityName || t.institutionName || '';
            const classYear =
              t.classYear || t.graduationYear || '';
            const quoteText =
              t.testimonialText || t.quote || t.shortQuote || '';
            const portrait = t.avatarUrl || t.photoUrl || '';

            const isDesktopVisible =
              testimonials.length <= 3 ||
              idx === activeIndex % testimonials.length ||
              idx === (activeIndex + 1) % testimonials.length ||
              idx === (activeIndex + 2) % testimonials.length;

            return (
              <div
                key={t.id}
                className={`w-[86vw] sm:w-[390px] lg:w-auto shrink-0 snap-start rounded-[28px] sm:rounded-[32px] bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col justify-between transition-all duration-500 shadow-sm hover:shadow-xl hover:border-[#d4af37]/50 relative group ${
                  isDesktopVisible ? 'lg:flex' : 'lg:hidden'
                }`}
              >
                {/* Decorative Quote Watermark */}
                <Quote className="w-10 h-10 text-zinc-900/[0.04] dark:text-white/[0.04] absolute top-6 right-6 pointer-events-none" />

                <div className="space-y-5">
                  {/* Top Badge: Verified Class Album Admin & Class Year */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-[#d4af37]/10 border border-amber-300/70 dark:border-[#d4af37]/30 text-amber-900 dark:text-[#d4af37]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                      <span className="font-mono-tech text-[10px] uppercase tracking-wider font-bold">
                        {role}
                      </span>
                    </div>

                    {classYear && (
                      <span className="inline-flex items-center gap-1 font-mono-tech text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                        <GraduationCap className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span>Class of {classYear}</span>
                      </span>
                    )}
                  </div>

                  {/* Testimonial Quote */}
                  <p className="font-body text-sm sm:text-base text-slate-700 dark:text-zinc-200 leading-relaxed">
                    “{quoteText.replace(/^["“”']+|["“”']+$/g, '')}”
                  </p>
                </div>

                {/* Bottom Album Admin Identity Row (Captured from Album Admin Profile) */}
                <div className="flex items-center gap-3.5 pt-5 mt-6 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-amber-400/40 bg-zinc-900 shrink-0 shadow-xs">
                    <GlazedImage
                      src={portrait}
                      alt={author}
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-syne font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {author}
                    </h4>
                    <p className="font-mono-tech text-[11px] text-[#b89728] dark:text-[#d4af37] font-semibold truncate">
                      {department}
                    </p>
                    {university && (
                      <p className="font-body text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {university}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Dots */}
        {testimonials.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {testimonials.map((t, idx) => (
              <button
                key={t.id}
                type="button"
                onClick={() => scrollToIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  activeIndex === idx
                    ? 'w-7 bg-[#d4af37]'
                    : 'w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-500'
                }`}
                aria-label={`View testimonial ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
