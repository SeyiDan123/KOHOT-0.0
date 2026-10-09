import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delayMs?: number;
  durationMs?: number;
  className?: string;
  threshold?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  delayMs = 0,
  durationMs = 1200, // Slow-motion reveal duration as requested
  className = '',
  threshold = 0.08,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (elementRef.current) {
              observer.unobserve(elementRef.current);
            }
          }
        });
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const el = elementRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [threshold]);

  return (
    <div
      ref={elementRef}
      className={`transition-all ease-[cubic-bezier(0.18,0.9,0.28,1)] will-change-transform ${
        isVisible ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{
        transitionDuration: `${durationMs}ms`,
        transitionDelay: `${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
};

interface SlowMotionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  caption?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center';
}

/**
 * Orchestrated Slow-Motion Header Reveal
 * Reveals the Title first in graceful slow-motion, then reveals the Captions right after.
 */
export const SlowMotionHeader: React.FC<SlowMotionHeaderProps> = ({
  eyebrow,
  title,
  caption,
  className = '',
  align = 'left',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (containerRef.current) {
              observer.unobserve(containerRef.current);
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const alignmentClass = align === 'center' ? 'text-center items-center mx-auto' : 'text-left items-start';

  return (
    <div ref={containerRef} className={`flex flex-col space-y-3 ${alignmentClass} ${className}`}>
      {/* 1. Eyebrow badge (Reveals first at 0ms, duration 1100ms) */}
      {eyebrow && (
        <div
          className={`transition-all duration-[1100ms] ease-[cubic-bezier(0.18,0.9,0.28,1)] will-change-transform ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '0ms' }}
        >
          {eyebrow}
        </div>
      )}

      {/* 2. Main Title (Reveals in slow motion at 100ms, duration 1300ms) */}
      <div
        className={`transition-all duration-[1300ms] ease-[cubic-bezier(0.18,0.9,0.28,1)] will-change-transform ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-7'
        }`}
        style={{ transitionDelay: '100ms' }}
      >
        {title}
      </div>

      {/* 3. Captions / Subtitles (Follows after Title at 450ms, duration 1350ms slow motion) */}
      {caption && (
        <div
          className={`transition-all duration-[1350ms] ease-[cubic-bezier(0.18,0.9,0.28,1)] will-change-transform ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '480ms' }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};
