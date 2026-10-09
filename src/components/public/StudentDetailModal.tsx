import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Crown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { StudentProfile } from '../../types';
import { isLeaderProfile } from '../../utils/leadershipHierarchy';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { GlazedImage } from '../common/GlazedImage';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { getTheme } from '../../utils/theme';

interface StudentDetailModalProps {
  student: StudentProfile | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  currentIndex?: number;
  totalStudents?: number;
  isLightMode?: boolean;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  onNext,
  onPrevious,
  currentIndex,
  totalStudents,
  isLightMode: propIsLightMode,
}) => {
  // Lock static body and background scroll on mount
  useStaticBackdropScrollLock(Boolean(student));

  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const lastScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });
  const [effectiveIsLight, setEffectiveIsLight] = useState<boolean>(() => {
    if (propIsLightMode !== undefined) return propIsLightMode;
    return getTheme() === 'light';
  });

  // Track system or storage dark mode
  useEffect(() => {
    if (propIsLightMode !== undefined) {
      setEffectiveIsLight(propIsLightMode);
    } else {
      setEffectiveIsLight(getTheme() === 'light');
    }
  }, [propIsLightMode, student]);

  // Reset zoom & pan on student change
  useEffect(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    touchDistanceRef.current = null;
    lastScaleRef.current = 1;
  }, [student?.id]);

  // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (e.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  // Pinch-to-zoom and drag touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      e.stopPropagation();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
      lastScaleRef.current = zoomScale;
    } else if (e.touches.length === 1) {
      if (zoomScale > 1.05) {
        isDraggingRef.current = true;
        dragStartRef.current = {
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
          startX: panOffset.x,
          startY: panOffset.y,
        };
      }
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double-tap toggle zoom
        setZoomScale((prev) => {
          const next = prev > 1.2 ? 1 : 2;
          if (next === 1) setPanOffset({ x: 0, y: 0 });
          return next;
        });
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      e.stopPropagation();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchDistanceRef.current;
      const nextScale = Math.min(Math.max(lastScaleRef.current * ratio, 1), 3.5);
      setZoomScale(nextScale);
      if (nextScale <= 1.05) {
        setPanOffset({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDraggingRef.current && zoomScale > 1.05) {
      e.stopPropagation();
      const dx = e.touches[0].clientX - dragStartRef.current.clientX;
      const dy = e.touches[0].clientY - dragStartRef.current.clientY;
      setPanOffset({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    if (e.touches.length < 2) {
      touchDistanceRef.current = null;
      lastScaleRef.current = zoomScale;
      if (zoomScale < 1.05) {
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  // Mouse drag handlers on desktop
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomScale > 1.05) {
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startX: panOffset.x,
        startY: panOffset.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current && zoomScale > 1.05) {
      e.preventDefault();
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      setPanOffset({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Trackpad pinch-to-zoom on desktop
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoomScale((prev) => {
        const delta = -e.deltaY * 0.01;
        const next = Math.min(Math.max(prev + delta, 1), 3.5);
        if (next <= 1.05) setPanOffset({ x: 0, y: 0 });
        return next;
      });
    }
  };

  if (!student) return null;

  const modalElement = (
    <div
      id="student-detail-modal-backdrop"
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 select-none overflow-hidden transition-colors duration-200 ${
        effectiveIsLight 
          ? 'bg-black/60 backdrop-blur-md' 
          : 'bg-black/85 backdrop-blur-xl'
      }`}
      onClick={onClose}
    >
      {/* Minimalist Arrow Navigation Left - Disappears on zoom */}
      {onPrevious && zoomScale <= 1.05 && (
        <button
          type="button"
          id="student-detail-prev-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          className={`absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-xl border ${
            effectiveIsLight
              ? 'bg-white hover:bg-zinc-100 text-black border-zinc-300'
              : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600'
          }`}
          aria-label="Previous profile"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Minimalist Arrow Navigation Right - Disappears on zoom */}
      {onNext && zoomScale <= 1.05 && (
        <button
          type="button"
          id="student-detail-next-btn"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className={`absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-xl border ${
            effectiveIsLight
              ? 'bg-white hover:bg-zinc-100 text-black border-zinc-300'
              : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600'
          }`}
          aria-label="Next profile"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Main Card - Pixieset-style full-bleed modal, with proper light and dark mode neutral grey */}
      <div
        key={student.id}
        id="student-detail-card"
        className={`w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[96vw] h-[94vh] max-h-[94vh] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col md:flex-row transition-all duration-150 ease-out border ${
          effectiveIsLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#18181b] border-zinc-700/80 text-zinc-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="close-student-detail-btn"
          onClick={onClose}
          className={`absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer border shadow-sm ${
            effectiveIsLight
              ? 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700'
          }`}
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Column: Portrait - Restored square frame, image not cut off */}
        <div 
          className={`md:w-3/5 lg:w-2/3 h-[50vh] md:h-full relative overflow-hidden flex-shrink-0 flex items-center justify-center p-3 sm:p-6 select-none ${
            effectiveIsLight ? 'bg-slate-50' : 'bg-[#121214]'
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div 
            className={`aspect-square w-full max-w-[480px] md:max-w-[75vh] h-auto max-h-[75vh] relative rounded-2xl overflow-hidden flex items-center justify-center border shadow-md transition-all duration-300 ${
              effectiveIsLight ? 'bg-white border-slate-200' : 'bg-[#161619] border-zinc-800'
            }`}
          >
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out origin-center"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                cursor: zoomScale > 1.05 ? 'grab' : 'default',
              }}
            >
              <img
                src={student.photoUrl}
                alt={student.fullName}
                className="w-full h-full object-contain filter contrast-[1.03] select-none pointer-events-none"
                draggable={false}
              />
            </div>
          </div>

          {/* Counter badge */}
          {currentIndex !== undefined && totalStudents !== undefined && (
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
              <div className={`px-3.5 py-1.5 rounded-full text-[11px] font-mono-tech border shadow-xs font-bold ${
                effectiveIsLight 
                  ? 'bg-white border-slate-200 text-slate-900' 
                  : 'bg-zinc-800 border-zinc-700 text-white'
              }`}>
                {currentIndex + 1} / {totalStudents}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Bio, Quotes, Role & Social Icons - Gold Accents */}
        <div className={`md:w-2/5 lg:w-1/3 p-6 sm:p-8 lg:p-10 flex flex-col justify-between overflow-y-auto h-[47vh] md:h-full border-t md:border-t-0 md:border-l ${
          effectiveIsLight 
            ? 'bg-white text-slate-900 border-slate-200' 
            : 'bg-[#18181b] text-zinc-100 border-zinc-700'
        }`}>
          <div className="space-y-4">
            {/* Position / Role in GOLD */}
            {student.position && (
              <div className="flex items-center gap-2 text-xs font-mono-tech text-[#d4af37] tracking-wider uppercase font-bold">
                {isLeaderProfile(student) && <Crown className="w-3.5 h-3.5 text-[#d4af37]" />}
                <span>{student.position}</span>
              </div>
            )}

            <div>
              <h2 className={`font-syne font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-tight ${
                effectiveIsLight ? 'text-slate-900' : 'text-white'
              }`}>
                {student.fullName}
              </h2>
              {student.nickname && (
                <p className="font-body italic text-base text-[#d4af37] mt-1 font-semibold">
                  “{student.nickname.replace(/^["“”']+|["“”']+$/g, '')}”
                </p>
              )}

              {/* Social icons positioned below nickname */}
              <div className="mt-3">
                <SocialIconsRow
                  socials={student.socials}
                  instagramOrTwitter={student.instagramOrTwitter}
                  email={student.email}
                  isLightMode={effectiveIsLight}
                  size="md"
                />
              </div>
            </div>

            {/* Quote or Memory */}
            {student.quote && (
              <div className={`p-4 rounded-2xl border relative shadow-xs ${
                effectiveIsLight 
                  ? 'bg-slate-50 border-slate-200 text-slate-900' 
                  : 'bg-[#202024] border-zinc-700/80 text-zinc-200'
              }`}>
                <p className={`font-body italic text-sm sm:text-base leading-relaxed ${
                  effectiveIsLight ? 'text-slate-800' : 'text-zinc-200'
                }`}>
                  “{student.quote.replace(/^["“”']+|["“”']+$/g, '')}”
                </p>
              </div>
            )}

            {/* Their Story */}
            {student.bio && (
              <div className="space-y-1 pt-1">
                <span className={`font-mono-tech text-[10px] uppercase tracking-widest block font-bold ${
                  effectiveIsLight ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  Their Story
                </span>
                <p className={`font-body text-xs sm:text-sm leading-relaxed ${
                  effectiveIsLight ? 'text-slate-700' : 'text-zinc-300'
                }`}>
                  {student.bio}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }
  return modalElement;
};
