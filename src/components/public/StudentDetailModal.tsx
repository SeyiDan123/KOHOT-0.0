import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Crown,
  ChevronLeft,
  ChevronRight,
  Mail,
  BookOpen,
  PenLine,
} from 'lucide-react';
import { StudentProfile, AwardItem } from '../../types';
import { isLeaderProfile } from '../../utils/leadershipHierarchy';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { GlazedImage } from '../common/GlazedImage';
import { StoryReadingModal } from '../common/StoryReadingModal';
import {
  getProfileStoryText,
  getStoryCardPreview,
  getDisplayRoleLabel,
} from '../../utils/storyFormatting';
import {
  getAwardVisualConfig,
  getDistinctAwardVisualsForList,
  getStudentCombinedAwards,
} from '../../utils/awardVisuals';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { getTheme } from '../../utils/theme';

interface StudentDetailModalProps {
  student: StudentProfile | null;
  awards?: AwardItem[];
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  currentIndex?: number;
  totalStudents?: number;
  isLightMode?: boolean;
  onEditProfile?: (student: StudentProfile) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  awards = [],
  onClose,
  onNext,
  onPrevious,
  currentIndex,
  totalStudents,
  isLightMode: propIsLightMode,
  onEditProfile,
}) => {
  useStaticBackdropScrollLock(Boolean(student));

  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const lastScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const photoContainerRef = useRef<HTMLDivElement | null>(null);
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });

  const clampPanOffset = (rawX: number, rawY: number, scale: number): { x: number; y: number } => {
    if (scale <= 1.01) return { x: 0, y: 0 };
    const el = photoContainerRef.current;
    const width = el ? el.clientWidth : window.innerWidth;
    const height = el ? el.clientHeight : window.innerHeight * 0.5;
    const maxPanX = Math.max(0, ((scale - 1) * width) / 2);
    const maxPanY = Math.max(0, ((scale - 1) * height) / 2);
    return {
      x: Math.min(Math.max(rawX, -maxPanX), maxPanX),
      y: Math.min(Math.max(rawY, -maxPanY), maxPanY),
    };
  };

  const [effectiveIsLight, setEffectiveIsLight] = useState<boolean>(() => {
    if (propIsLightMode !== undefined) return propIsLightMode;
    return getTheme() === 'light';
  });

  useEffect(() => {
    if (propIsLightMode !== undefined) {
      setEffectiveIsLight(propIsLightMode);
    } else {
      setEffectiveIsLight(getTheme() === 'light');
    }
  }, [propIsLightMode, student]);

  const [isReadingStoryOpen, setIsReadingStoryOpen] = useState(false);
  const [showAwardDetails, setShowAwardDetails] = useState(false);
  const [isSecondaryPhotoActive, setIsSecondaryPhotoActive] = useState(false);

  // Eagerly preload both primary and secondary portrait URLs for instant display
  useEffect(() => {
    if (!student) return;
    const urls = [student.photoUrl, student.rawPhotoUrl, student.secondaryPhotoUrl].filter(
      (u): u is string => Boolean(u && u.trim())
    );
    urls.forEach((url) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    });
  }, [student?.id, student?.photoUrl, student?.rawPhotoUrl, student?.secondaryPhotoUrl]);

  // Reset zoom, pan & scroll position on student change
  useEffect(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsReadingStoryOpen(false);
    setShowAwardDetails(false);
    setIsSecondaryPhotoActive(false);
    touchDistanceRef.current = null;
    lastScaleRef.current = 1;
    if (detailsScrollRef.current) {
      detailsScrollRef.current.scrollTop = 0;
    }
  }, [student?.id]);

  // Combine profile-level awards + matching set awards, with guaranteed distinct icons
  const studentAwards = useMemo(
    () => getStudentCombinedAwards(student, awards),
    [student, awards]
  );

  const distinctAwardVisuals = useMemo(
    () => getDistinctAwardVisualsForList(studentAwards, effectiveIsLight),
    [studentAwards, effectiveIsLight]
  );

  // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isReadingStoryOpen) {
          setIsReadingStoryOpen(false);
        } else {
          onClose();
        }
      } else if (!isReadingStoryOpen && e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (!isReadingStoryOpen && e.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious, isReadingStoryOpen]);

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
        setZoomScale((prev) => {
          const next = prev > 1.2 ? 1 : 2;
          setPanOffset((currPan) => clampPanOffset(currPan.x, currPan.y, next));
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
      setPanOffset((currPan) => clampPanOffset(currPan.x, currPan.y, nextScale));
    } else if (e.touches.length === 1 && isDraggingRef.current && zoomScale > 1.05) {
      e.stopPropagation();
      const dx = e.touches[0].clientX - dragStartRef.current.clientX;
      const dy = e.touches[0].clientY - dragStartRef.current.clientY;
      setPanOffset(
        clampPanOffset(
          dragStartRef.current.startX + dx,
          dragStartRef.current.startY + dy,
          zoomScale
        )
      );
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
      } else {
        setPanOffset((currPan) => clampPanOffset(currPan.x, currPan.y, zoomScale));
      }
    }
  };

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
      setPanOffset(
        clampPanOffset(
          dragStartRef.current.startX + dx,
          dragStartRef.current.startY + dy,
          zoomScale
        )
      );
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoomScale((prev) => {
        const delta = -e.deltaY * 0.01;
        const next = Math.min(Math.max(prev + delta, 1), 3.5);
        setPanOffset((currPan) => clampPanOffset(currPan.x, currPan.y, next));
        return next;
      });
    }
  };

  if (!student) return null;

  const fullMyStory = getProfileStoryText(student);
  const rawQuote = (student.quote || '').trim();
  const oneLineQuote = rawQuote || (!student.myStory ? (student.bio || '').trim() : '');
  const myStoryPreview = fullMyStory ? getStoryCardPreview(fullMyStory) : null;
  const roleLabel = getDisplayRoleLabel(student);
  const displayRole =
    student.position && student.position.trim().toLowerCase() !== 'member'
      ? student.position.trim()
      : '';

  const hasMoreAboutMe = Boolean(
    student.favouriteCampusMemory?.trim() ||
      student.funFact?.trim() ||
      student.whatsNext?.trim()
  );

  const hasFinalWords = Boolean(
    student.messageToClassmates?.trim() ||
      student.messageToFutureSet?.trim()
  );

  const modalElement = (
    <div
      id="student-detail-modal-backdrop"
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-[100] w-screen h-screen p-0 rounded-none flex items-stretch justify-center select-none overflow-hidden transition-colors duration-200 ${
        effectiveIsLight ? 'bg-white' : 'bg-[#0c0c0e]'
      }`}
      onClick={onClose}
    >
      {/* Minimalist Arrow Navigation Left */}
      {onPrevious && zoomScale <= 1.05 && (
        <button
          type="button"
          id="student-detail-prev-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          className={`fixed left-3 sm:left-5 top-1/2 -translate-y-1/2 z-[120] w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-xl border ${
            effectiveIsLight
              ? 'bg-white/90 hover:bg-zinc-100 text-black border-zinc-300'
              : 'bg-zinc-900/85 hover:bg-zinc-800 text-white border-zinc-700'
          }`}
          aria-label="Previous profile"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Minimalist Arrow Navigation Right */}
      {onNext && zoomScale <= 1.05 && (
        <button
          type="button"
          id="student-detail-next-btn"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className={`fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-[120] w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-xl border ${
            effectiveIsLight
              ? 'bg-white/90 hover:bg-zinc-100 text-black border-zinc-300'
              : 'bg-zinc-900/85 hover:bg-zinc-800 text-white border-zinc-700'
          }`}
          aria-label="Next profile"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Main Full-Page Immersive Card (Zero curved corners, edge-to-edge) */}
      <div
        key={student.id}
        id="student-detail-card"
        className={`w-screen h-screen max-w-none max-h-none rounded-none overflow-y-auto md:overflow-hidden relative flex flex-col md:flex-row transition-all duration-150 ease-out border-0 ${
          effectiveIsLight
            ? 'bg-white text-slate-900'
            : 'bg-[#121215] text-zinc-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Close Button */}
        <div className="fixed top-4 right-4 z-[130] flex items-center gap-2">
          <button
            id="close-student-detail-btn"
            onClick={onClose}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer border shadow-lg backdrop-blur-md ${
              effectiveIsLight
                ? 'bg-white/90 border-slate-200 text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                : 'bg-black/75 border-white/15 text-zinc-200 hover:text-white hover:bg-zinc-800'
            }`}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Photo (Full Upper Square Segment End-to-End on Mobile / Full Left Column on Desktop) */}
        <div
          ref={photoContainerRef}
          className={`w-full aspect-square max-h-[54vh] sm:max-h-[58vh] md:max-h-none md:aspect-auto md:w-1/2 lg:w-[54%] md:h-full relative overflow-hidden shrink-0 p-0 rounded-none select-none ${
            effectiveIsLight ? 'bg-slate-100' : 'bg-black'
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
            className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out origin-center rounded-none overflow-hidden"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              cursor: zoomScale > 1.05 ? 'grab' : 'default',
            }}
          >
            <GlazedImage
              src={
                isSecondaryPhotoActive && student.secondaryPhotoUrl
                  ? student.secondaryPhotoUrl
                  : student.photoUrl || student.rawPhotoUrl || ''
              }
              alt={student.fullName}
              priority
              containerClassName="w-full h-full rounded-none"
              className="w-full h-full object-cover object-center filter contrast-[1.03] select-none pointer-events-none rounded-none"
              draggable={false}
            />
          </div>

          {/* Smaller Square Second Image at Lower-Right of Primary Image (Moved away from right arrow button & visually balanced) */}
          {student.secondaryPhotoUrl?.trim() && (
            <button
              id="student-secondary-photo-thumb"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale(1);
                setPanOffset({ x: 0, y: 0 });
                setIsSecondaryPhotoActive((prev) => !prev);
              }}
              className="absolute bottom-4 right-14 sm:bottom-5 sm:right-16 md:bottom-6 md:right-8 z-20 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 aspect-square rounded-2xl border-2 border-white dark:border-zinc-800 shadow-[0_12px_32px_rgba(0,0,0,0.65)] ring-1 ring-black/20 overflow-hidden bg-zinc-900 cursor-pointer transition-transform hover:scale-105 active:scale-95 group"
              title="Tap to switch between first and second photo"
            >
              <GlazedImage
                src={
                  isSecondaryPhotoActive
                    ? student.photoUrl || student.rawPhotoUrl || ''
                    : student.secondaryPhotoUrl
                }
                alt={`${student.fullName} second portrait`}
                priority
                showMonogram={false}
                containerClassName="w-full h-full"
                className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          )}

          {currentIndex !== undefined && totalStudents !== undefined && (
            <div className="absolute top-4 left-4 z-20 flex items-center">
              <div
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono-tech border tracking-wider shadow-xs backdrop-blur-md ${
                  effectiveIsLight
                    ? 'bg-white/90 border-slate-200 text-slate-700'
                    : 'bg-black/75 border-white/15 text-zinc-300'
                }`}
              >
                {currentIndex + 1} / {totalStudents}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Scrollable Profile Details in Exact Order:
            2. Name
            3. Nickname
            4. Social icons & Email icon (immediately after Nickname)
            5. Role and award badge (icons + tap to view one-line card)
            6. One-line quote
            7. "My story" (preview and Read full story)
            8. "More about me" & "Final words" (each only if filled) */}
        <div
          ref={detailsScrollRef}
          id="student-detail-scroll-body"
          data-modal-scrollable="true"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className={`w-full md:w-1/2 lg:w-[46%] flex-1 min-h-0 md:h-full overflow-y-auto overscroll-contain touch-pan-y select-text p-5 sm:p-8 lg:p-10 border-t md:border-t-0 md:border-l ${
            effectiveIsLight
              ? 'bg-white text-slate-900 border-slate-200'
              : 'bg-[#121215] text-zinc-100 border-zinc-800'
          }`}
        >
          <div className="space-y-4 pb-8 max-w-2xl mx-auto">
            {/* 2. Name, 3. Nickname & Social + Email Icons Right After Nickname */}
            <div>
              <h2
                className={`font-syne font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-tight pr-16 ${
                  effectiveIsLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {student.fullName}
              </h2>
              {student.nickname?.trim() && (
                <p className="font-body italic text-lg sm:text-xl text-[#d4af37] mt-1 font-semibold">
                  “{student.nickname.trim().replace(/^["“”']+|["“”']+$/g, '')}”
                </p>
              )}

              {/* Social Icons & Email Icon Immediately After Nickname */}
              {(() => {
                const hasAnySocial = Boolean(
                  student.socials?.instagram?.trim() ||
                    student.socials?.twitter?.trim() ||
                    student.socials?.tiktok?.trim() ||
                    student.socials?.linkedin?.trim() ||
                    student.socials?.facebook?.trim() ||
                    student.socials?.github?.trim() ||
                    student.instagramOrTwitter?.trim()
                );
                const hasEmail = Boolean(student.email?.trim());
                if (!hasAnySocial && !hasEmail) return null;

                return (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <SocialIconsRow
                      socials={student.socials}
                      instagramOrTwitter={student.instagramOrTwitter}
                      isLightMode={effectiveIsLight}
                      size="md"
                    />
                    {hasEmail && (
                      <a
                        href={`mailto:${student.email!.trim()}`}
                        onClick={(e) => e.stopPropagation()}
                        title={`Email ${student.fullName} (${student.email!.trim()})`}
                        aria-label={`Email ${student.fullName}`}
                        className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center shrink-0 hover:scale-110 active:scale-95 ${
                          effectiveIsLight
                            ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700 shadow-xs'
                            : 'bg-white/5 border-white/15 text-zinc-200 hover:bg-[#d4af37]/20 hover:border-[#d4af37]/60 hover:text-[#d4af37]'
                        }`}
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 4. Role and Award Badge (with distinct icon badges + tap instruction + one-line card underneath) */}
            {(displayRole || studentAwards.length > 0) && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {displayRole && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-mono-tech uppercase tracking-wider font-bold border ${
                        effectiveIsLight
                          ? 'bg-amber-50 border-amber-300/80 text-amber-900'
                          : 'bg-[#d4af37]/10 border-[#d4af37]/30 text-[#d4af37]'
                      }`}
                    >
                      {isLeaderProfile(student) && (
                        <Crown className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                      )}
                      <span>{displayRole}</span>
                    </div>
                  )}

                  {studentAwards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAwardDetails((prev) => !prev)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                        effectiveIsLight
                          ? 'bg-amber-50/90 hover:bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border-[#d4af37]/40 text-[#d4af37]'
                      }`}
                      title="Tap to view class award details"
                    >
                      <div className="flex items-center -space-x-1">
                        {studentAwards.map((award, idx) => {
                          const visual =
                            distinctAwardVisuals[idx] ||
                            getAwardVisualConfig(award.trophyType, effectiveIsLight);
                          const AwardIcon = visual.icon;
                          return (
                            <span
                              key={award.id}
                              className={`w-5 h-5 flex items-center justify-center ${visual.shapeClass}`}
                            >
                              <AwardIcon
                                className={`w-3 h-3 ${visual.iconColor} ${
                                  visual.type === 'crystal' ? '-rotate-45' : ''
                                }`}
                              />
                            </span>
                          );
                        })}
                      </div>
                      <span className="font-mono-tech text-[11px] sm:text-xs uppercase tracking-wider font-bold">
                        {showAwardDetails
                          ? 'Hide award'
                          : studentAwards.length === 1
                          ? 'Tap to view award won'
                          : `Tap to view ${studentAwards.length} awards won`}
                      </span>
                    </button>
                  )}
                </div>

                {/* One-line card(s) under the Role & Award icon row */}
                {studentAwards.length > 0 && showAwardDetails && (
                  <div className="space-y-1.5 animate-fadeIn">
                    {studentAwards.map((award, idx) => {
                      const visual =
                        distinctAwardVisuals[idx] ||
                        getAwardVisualConfig(award.trophyType, effectiveIsLight);
                      const AwardIcon = visual.icon;
                      return (
                        <div
                          key={award.id}
                          className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs sm:text-sm ${
                            effectiveIsLight
                              ? 'bg-amber-50/70 border-amber-200 text-slate-900'
                              : 'bg-[#d4af37]/10 border-[#d4af37]/30 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-5 h-5 flex items-center justify-center shrink-0 ${visual.shapeClass}`}
                            >
                              <AwardIcon
                                className={`w-3 h-3 ${visual.iconColor} ${
                                  visual.type === 'crystal' ? '-rotate-45' : ''
                                }`}
                              />
                            </span>
                            <span className="font-syne font-bold truncate">{award.category}</span>
                          </div>
                          <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#d4af37] shrink-0">
                            Class Award
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 5. Parting Quote */}
            {oneLineQuote && (
              <p
                className={`font-body italic text-base sm:text-lg leading-relaxed ${
                  effectiveIsLight ? 'text-slate-700' : 'text-zinc-200'
                }`}
              >
                “{oneLineQuote.replace(/^["“”']+|["“”']+$/g, '')}”
              </p>
            )}

            {/* 6. "My story / parting words" (preview and Read full story) */}
            {fullMyStory && myStoryPreview && (
              <div
                className={`p-4 sm:p-5 rounded-2xl border relative shadow-xs space-y-3 ${
                  effectiveIsLight
                    ? 'bg-amber-50/40 border-amber-200/80 text-slate-900'
                    : 'bg-[#1c1c20] border-[#d4af37]/25 text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-widest block font-bold ${
                      effectiveIsLight ? 'text-[#b89728]' : 'text-[#d4af37]'
                    }`}
                  >
                    My story
                  </span>
                </div>

                <div className="space-y-2.5">
                  {myStoryPreview.previewBlocks.map((block, idx) => {
                    if (block.type === 'heading') {
                      return (
                        <h4
                          key={idx}
                          className={`font-syne font-bold text-sm sm:text-base ${
                            effectiveIsLight ? 'text-slate-900' : 'text-amber-300'
                          }`}
                        >
                          {block.content}
                        </h4>
                      );
                    }
                    if (block.type === 'boldClosing') {
                      return (
                        <p
                          key={idx}
                          className={`font-body font-semibold text-sm sm:text-base leading-relaxed ${
                            effectiveIsLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          {block.content}
                        </p>
                      );
                    }
                    return (
                      <p
                        key={idx}
                        className={`font-body text-sm sm:text-base leading-relaxed ${
                          effectiveIsLight ? 'text-slate-700' : 'text-zinc-200'
                        }`}
                      >
                        {block.content}
                      </p>
                    );
                  })}
                </div>

                {myStoryPreview.isTruncated && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsReadingStoryOpen(true);
                    }}
                    className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold pt-1 transition-colors cursor-pointer ${
                      effectiveIsLight
                        ? 'text-amber-800 hover:text-amber-950'
                        : 'text-[#d4af37] hover:text-amber-300'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="underline underline-offset-4">Read full story</span>
                  </button>
                )}
              </div>
            )}

            {/* 7. "More about me" (Favourite Campus Memory, Fun Fact, What’s Next) */}
            {hasMoreAboutMe && (
              <div
                className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 ${
                  effectiveIsLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-[#202024] border-zinc-700/80 text-zinc-200'
                }`}
              >
                <span
                  className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-widest block font-bold ${
                    effectiveIsLight ? 'text-[#b89728]' : 'text-[#d4af37]'
                  }`}
                >
                  More about me
                </span>

                {student.favouriteCampusMemory?.trim() && (
                  <div className="space-y-1">
                    <span
                      className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-wider block font-bold ${
                        effectiveIsLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      Favourite Campus Memory
                    </span>
                    <p
                      className={`font-body text-sm sm:text-base leading-relaxed ${
                        effectiveIsLight ? 'text-slate-700' : 'text-zinc-200'
                      }`}
                    >
                      {student.favouriteCampusMemory}
                    </p>
                  </div>
                )}

                {student.funFact?.trim() && (
                  <div className="space-y-1">
                    <span
                      className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-wider block font-bold ${
                        effectiveIsLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      Fun Fact
                    </span>
                    <p
                      className={`font-body text-sm sm:text-base leading-relaxed ${
                        effectiveIsLight ? 'text-slate-700' : 'text-zinc-200'
                      }`}
                    >
                      {student.funFact}
                    </p>
                  </div>
                )}

                {student.whatsNext?.trim() && (
                  <div className="space-y-1">
                    <span
                      className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-wider block font-bold ${
                        effectiveIsLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      What&apos;s Next
                    </span>
                    <p
                      className={`font-body text-sm sm:text-base leading-relaxed ${
                        effectiveIsLight ? 'text-slate-700' : 'text-zinc-200'
                      }`}
                    >
                      {student.whatsNext}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 8. "Final words" (A Message to My Classmates, A Message to Future Set) */}
            {hasFinalWords && (
              <div
                className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 ${
                  effectiveIsLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-[#202024] border-zinc-700/80 text-zinc-200'
                }`}
              >
                <span
                  className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-widest block font-bold ${
                    effectiveIsLight ? 'text-[#b89728]' : 'text-[#d4af37]'
                  }`}
                >
                  Final words
                </span>

                {student.messageToClassmates?.trim() && (
                  <div className="space-y-1">
                    <span
                      className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-wider block font-bold ${
                        effectiveIsLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      A Message to My Classmates
                    </span>
                    <p
                      className={`font-body text-sm sm:text-base leading-relaxed ${
                        effectiveIsLight ? 'text-slate-700' : 'text-zinc-200'
                      }`}
                    >
                      {student.messageToClassmates}
                    </p>
                  </div>
                )}

                {student.messageToFutureSet?.trim() && (
                  <div className="space-y-1">
                    <span
                      className={`font-mono-tech text-[11px] sm:text-xs uppercase tracking-wider block font-bold ${
                        effectiveIsLight ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      A Message to Future Set
                    </span>
                    <p
                      className={`font-body text-sm sm:text-base leading-relaxed ${
                        effectiveIsLight ? 'text-slate-700' : 'text-zinc-200'
                      }`}
                    >
                      {student.messageToFutureSet}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Centered Reading View Popup for Full Story */}
      {fullMyStory && (
        <StoryReadingModal
          isOpen={isReadingStoryOpen}
          onClose={() => setIsReadingStoryOpen(false)}
          authorName={student.fullName}
          authorRole={roleLabel}
          authorPhoto={student.photoUrl || student.rawPhotoUrl}
          storyText={fullMyStory}
          sectionLabel="My story"
          isDark={!effectiveIsLight}
        />
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }
  return modalElement;
};
