import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp } from 'lucide-react';

export const BackToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = scrollHeight > 0 ? Math.min(Math.max(scrollTop / scrollHeight, 0), 1) : 0;

      setScrollProgress(progress);
      // Show only when user has scrolled down past threshold (300px)
      setIsVisible(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - scrollProgress);

  const buttonElement = (
    <button
      id="back-to-top-btn"
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#10111a]/95 hover:bg-white text-white hover:text-black border border-white/20 hover:border-white shadow-2xl backdrop-blur-xl hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer group flex items-center justify-center ${
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      style={{
        position: 'fixed',
        right: '1.5rem',
        bottom: '1.5rem',
      }}
    >
      {/* Circular scroll-progress ring */}
      <svg
        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        {/* Subtle background track */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="2"
        />
        {/* Dynamic progress ring in KoHot gold */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#d4af37"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="motion-safe:transition-[stroke-dashoffset] duration-150 ease-out"
        />
      </svg>

      <ArrowUp className="w-5 h-5 transition-transform group-hover:-translate-y-1 relative z-10" />
    </button>
  );

  if (typeof document !== 'undefined') {
    return createPortal(buttonElement, document.body);
  }
  return buttonElement;
};
