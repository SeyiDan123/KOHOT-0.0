import React, { useEffect, useState, useRef } from 'react';

interface KoHotTransitionScreenProps {
  isVisible: boolean;
  destinationLabel?: string;
  institutionLabel?: string;
  onTransitionEnd?: () => void;
  durationMs?: number;
}

/**
 * Branded interstitial loading screen before viewing legacy wall and album.
 * - Element line moves smoothly from one end to the other (0% to 100%) to signify completion.
 * - Under KoHot: Department in black text, University under in grey color text.
 */
export const KoHotTransitionScreen: React.FC<KoHotTransitionScreenProps> = ({
  isVisible,
  destinationLabel = 'Department of Computer Science',
  institutionLabel = 'University Of Ilorin',
  onTransitionEnd,
  durationMs = 3000,
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const onEndRef = useRef(onTransitionEnd);
  onEndRef.current = onTransitionEnd;

  // Clean label to strictly show name of department without repeating department or including legacy wall
  const normalizedDepartment = React.useMemo(() => {
    let clean = (destinationLabel || 'Department of Computer Science').replace(/legacy wall/gi, '').trim();
    if (!clean.toLowerCase().includes('department')) {
      clean = `Department of ${clean}`;
    }
    return clean;
  }, [destinationLabel]);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    let fadeOutId: NodeJS.Timeout;

    if (isVisible) {
      setShouldRender(true);
      setIsFadingOut(false);

      // Loading duration followed by smooth fade-out
      timerId = setTimeout(() => {
        setIsFadingOut(true);
        fadeOutId = setTimeout(() => {
          setShouldRender(false);
          if (onEndRef.current) onEndRef.current();
        }, 400);
      }, durationMs);
    } else {
      setIsFadingOut(true);
      setShouldRender(false);
    }

    return () => {
      clearTimeout(timerId);
      clearTimeout(fadeOutId);
    };
  }, [isVisible, durationMs]);

  if (!shouldRender || !isVisible) return null;

  return (
    <div
      id="kohot-branded-loading-splash"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#18181b] select-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'
      }`}
    >
      {/* Subtle warm ambient lighting aura with gentle pulse */}
      <div className="absolute w-[640px] h-[420px] bg-gradient-to-b from-[#d4af37]/[0.12] via-zinc-800/[0.4] to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse" />

      {/* Pure, clean KoHot logo-only visual lockup */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6 px-6 max-w-md animate-hero-reveal">
        {/* Geometric Monogram Emblem (Clean lockup with no circling dot) */}
        <div className="relative flex items-center justify-center">
          {/* Center Emblem Container */}
          <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shadow-2xl relative overflow-hidden group">
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full animate-marquee pointer-events-none" style={{ animationDuration: '2.5s' }} />
            
            {/* Rotating inner diamond with smooth pulse */}
            <div className="w-8 h-8 bg-white rotate-45 transform shadow-md transition-transform duration-700 animate-pulse" />
          </div>

          {/* Subtle gold perimeter glow */}
          <div className="absolute -inset-1.5 rounded-3xl border border-[#d4af37]/40 blur-xs pointer-events-none" />
        </div>

        {/* Brand Typography & Requested Text Under KoHot */}
        <div className="space-y-2 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
          {/* Brand Name */}
          <h1 className="font-syne font-extrabold text-4xl sm:text-5xl text-white tracking-tight uppercase">
            KOHOT
          </h1>

          {/* The text under KoHot - Constant White / Calm Grey */}
          <div className="space-y-1 pt-1">
            <h2 className="font-syne font-bold text-base sm:text-lg text-white tracking-tight leading-snug max-w-sm mx-auto">
              {normalizedDepartment}
            </h2>
            <p className="font-syne font-medium text-xs sm:text-sm text-zinc-400 tracking-wide">
              {institutionLabel}
            </p>
          </div>
        </div>

        {/* Loading track: element line moves from one end to the other to signify completion - Pure White loading line */}
        <div className="w-56 sm:w-64 pt-3 animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden relative shadow-inner p-[1px] border border-zinc-700/80">
            <div
              className="h-full bg-white rounded-full transition-all shadow-[0_0_10px_rgba(255,255,255,0.7)]"
              style={{
                width: '100%',
                transformOrigin: 'left',
                animation: `completionLineMove ${durationMs}ms cubic-bezier(0.2, 0.8, 0.25, 1) forwards`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
