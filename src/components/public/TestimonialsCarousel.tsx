import React, { useState, useEffect, useRef } from 'react';
import { MessageSquarePlus, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { TestimonialRecord, WebsiteContentOverride } from '../../types';
import { getStoredTestimonials } from '../../data/initialData';
import { TestimonialSubmissionModal } from './TestimonialSubmissionModal';
import { fetchTestimonialsFromD1 } from '../../utils/apiClient';

interface TestimonialsCarouselProps {
  onShowToast?: (message: string) => void;
  contentOverride?: WebsiteContentOverride;
}

export const TestimonialsCarousel: React.FC<TestimonialsCarouselProps> = ({ onShowToast, contentOverride }) => {
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const filterVisibleApproved = (items: TestimonialRecord[]) => {
    return items
      .filter(
        t =>
          t.isVisible !== false &&
          (t.status === 'Approved' || t.reviewStatus === 'approved') &&
          t.publicationPermission !== 'private'
      )
      .sort((a, b) => {
        const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999;
        const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
      });
  };

  const loadTestimonials = async () => {
    const localApproved = filterVisibleApproved(getStoredTestimonials());
    setTestimonials(localApproved);

    const d1Res = await fetchTestimonialsFromD1();
    if (d1Res && d1Res.success && Array.isArray(d1Res.testimonials) && d1Res.testimonials.length > 0) {
      setTestimonials(filterVisibleApproved(d1Res.testimonials));
    }
  };

  useEffect(() => {
    loadTestimonials();

    const handleStorageChange = () => {
      loadTestimonials();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const itemsPerPageDesktop = 3;
  const maxIndex = Math.max(0, testimonials.length - 1);

  useEffect(() => {
    if (testimonials.length <= 1 || isHovered) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [testimonials.length, isHovered, maxIndex]);

  const handlePrev = () => {
    setCurrentIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // If no testimonials are visible, hide the entire testimonials section
  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section
      className="py-12 md:py-16 bg-slate-950/60 border-t border-white/[0.05] relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d9b648]"></div>
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#d9b648]">
                {contentOverride?.testimonialsEyebrow || 'COMMUNITY VOICES'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-medium text-white tracking-tight">
              {contentOverride?.testimonialsTitle || 'What Graduating Sets Are Saying'}
            </h2>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {testimonials.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrev}
                  className="w-7 h-7 rounded-lg bg-[#0d121f] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNext}
                  className="w-7 h-7 rounded-lg bg-[#0d121f] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-slate-300 font-mono-tech text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquarePlus className="w-3 h-3 text-[#d9b648]" />
              Share Experience
            </button>
          </div>
        </div>

        {/* Carousel Track */}
        <div className="relative">
          {/* Desktop Grid View */}
          <div className="hidden lg:grid grid-cols-3 gap-5">
            {Array.from({ length: Math.min(3, testimonials.length) }).map((_, idx) => {
              const itemIndex = (currentIndex + idx) % testimonials.length;
              const t = testimonials[itemIndex];
              const author = t.authorName || t.fullName || 'Graduate';
              const role = t.role || t.authorRole || 'Graduate';
              const department = t.departmentName || '';
              return (
                <div
                  key={`${t.id}-${idx}`}
                  className="bg-[#0d121f]/80 border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between transition-all duration-500 hover:border-white/10 group relative"
                >
                  <Quote className="w-6 h-6 text-white/[0.03] absolute top-4 right-4 pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#d9b648]/90">
                        {role}
                      </span>
                      {t.isDemo && (
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400 border border-white/10 font-mono-tech text-[9px] uppercase tracking-wider">
                          Sample
                        </span>
                      )}
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed mb-5 line-clamp-3">
                      "{t.testimonialText || t.shortQuote}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-white/[0.04]">
                    {t.photoUrl ? (
                      <img
                        src={t.photoUrl}
                        alt={author}
                        className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[#d9b648] font-mono-tech text-[10px] font-bold shrink-0">
                        {getInitials(author)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white text-xs truncate">{author}</div>
                      <div className="text-slate-400 text-[10px] truncate">
                        {department}
                        {t.universityName ? ` · ${t.universityName}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile / Tablet Single Card View */}
          <div className="lg:hidden">
            {(() => {
              const t = testimonials[currentIndex % testimonials.length];
              const author = t.authorName || t.fullName || 'Graduate';
              const role = t.role || t.authorRole || 'Graduate';
              const department = t.departmentName || '';
              return (
                <div className="bg-[#0d121f]/80 border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between relative">
                  <Quote className="w-6 h-6 text-white/[0.03] absolute top-4 right-4 pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#d9b648]/90">
                        {role}
                      </span>
                      {t.isDemo && (
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400 border border-white/10 font-mono-tech text-[9px] uppercase tracking-wider">
                          Sample
                        </span>
                      )}
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed mb-5">
                      "{t.testimonialText || t.shortQuote}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-white/[0.04]">
                    {t.photoUrl ? (
                      <img
                        src={t.photoUrl}
                        alt={author}
                        className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[#d9b648] font-mono-tech text-[10px] font-bold shrink-0">
                        {getInitials(author)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white text-xs truncate">{author}</div>
                      <div className="text-slate-400 text-[10px] truncate">
                        {department}
                        {t.universityName ? ` · ${t.universityName}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Pagination Dots */}
          {testimonials.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-5">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1 rounded-full transition-all cursor-pointer ${
                    currentIndex === idx
                      ? 'w-4 bg-[#d9b648]'
                      : 'w-1 bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TestimonialSubmissionModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => {
          loadTestimonials();
          if (onShowToast) {
            onShowToast('Thank you! Your testimonial has been submitted for review.');
          }
        }}
      />
    </section>
  );
};
