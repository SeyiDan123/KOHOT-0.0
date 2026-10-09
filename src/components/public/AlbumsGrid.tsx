import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClassSet, 
  WebsiteContentOverride, 
  UserAccount, 
  UniversityDirectoryItem,
  DepartmentItem 
} from '../../types';
import { INITIAL_UNIVERSITIES } from '../../data/initialData';
import { CROWNFIELD_UNIVERSITY, CROWNFIELD_PUBLIC_LAW_SETS } from '../../data/crownfieldLawDemos';
import { AlbumAdminSwitcher } from '../common/AlbumAdminSwitcher';
import { AlbumAdminHelpModal, AlbumDisputeModal } from '../admin/AlbumAdminHelpModal';
import { HelpModal } from './HelpModal';
import { 
  Building, 
  GraduationCap, 
  Users, 
  ArrowRight, 
  Sparkles, 
  Lock, 
  PlusCircle, 
  ShieldCheck, 
  ExternalLink, 
  Calendar, 
  ArrowLeft, 
  Globe,
  Layers,
  Filter,
  Sun,
  Moon
} from 'lucide-react';
import { getTheme, applyTheme } from '../../utils/theme';

interface AlbumsGridProps {
  universities?: UniversityDirectoryItem[];
  sets: ClassSet[];
  contentOverride: WebsiteContentOverride;
  currentUser: UserAccount | null;
  selectedUniversityId?: string | null;
  selectedDepartmentId?: string | null;
  onSelectUniversity?: (uniId: string | null) => void;
  onSelectDepartment?: (deptId: string | null) => void;
  onSelectSet: (setId: string) => void;
  onOpenOnboarding: () => void;
  onOpenLogin: () => void;
  onOpenDashboard: () => void;
  onLogout: () => void;
  onBackToLanding?: () => void;
  inviteContext?: {
    inviteCode: string;
    departmentId: string;
    universityId?: string;
    targetYear: number;
    fromYear: number;
  } | null;
  onOpenOnboardingWithInvite?: (invite: {
    inviteCode: string;
    departmentId: string;
    universityId?: string;
    targetYear: number;
    fromYear: number;
  }) => void;
}

/**
 * Public Department Directory Page (Legacy Wall)
 * Displays the department hero section with image & caption,
 * followed by the years set albums of ONLY that department (not mixed).
 */
export const AlbumsGrid: React.FC<AlbumsGridProps> = ({
  universities = INITIAL_UNIVERSITIES,
  sets,
  contentOverride,
  currentUser,
  selectedUniversityId: controlledUniId,
  selectedDepartmentId: controlledDeptId,
  onSelectUniversity,
  onSelectDepartment,
  onSelectSet,
  onOpenOnboarding,
  onOpenLogin,
  onOpenDashboard,
  onLogout,
  onBackToLanding,
  inviteContext: propInviteContext,
  onOpenOnboardingWithInvite,
}) => {
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Theme mode state (context aware, defaults to light)
  const [isLightMode, setIsLightMode] = useState<boolean>(() => getTheme() === 'light');

  const toggleLightMode = () => {
    setIsLightMode((prev) => {
      const next = !prev;
      applyTheme(next ? 'light' : 'dark');
      return next;
    });
  };

  // Active filters state - defaults to OAU Computer Science & Engineering department legacy wall
  const defaultUni = universities.find((u) => u.id === 'oau' || u.shortCode.toLowerCase() === 'oau') || universities[0] || INITIAL_UNIVERSITIES[0];
  const [activeUniId, setActiveUniId] = useState<string>(controlledUniId || defaultUni?.id || 'oau');
  const [activeDeptId, setActiveDeptId] = useState<string | null>(controlledDeptId || 'dept-oau-cse');

  // Keep synced with controlled props
  React.useEffect(() => {
    if (controlledUniId && controlledUniId !== activeUniId) {
      setActiveUniId(controlledUniId);
    }
  }, [controlledUniId]);

  React.useEffect(() => {
    if (controlledDeptId !== undefined && controlledDeptId !== activeDeptId) {
      setActiveDeptId(controlledDeptId);
    }
  }, [controlledDeptId]);

  // Flatten all departments across all universities
  const allDepartmentsWithUni = useMemo(() => {
    const list: { dept: DepartmentItem; uni: UniversityDirectoryItem }[] = [];
    universities.forEach((u) => {
      (u.departments || []).forEach((d) => {
        list.push({ dept: d, uni: u });
      });
    });
    return list;
  }, [universities]);

  // Only the 4 demo albums from the owner dashboard show on the legacy wall
  const currentUniversity = CROWNFIELD_UNIVERSITY;
  const currentDepartment = CROWNFIELD_UNIVERSITY.departments[0];
  const universityDisplayName = 'Crownfield University (CU)';
  const universityDepartments = currentUniversity.departments;

  const handleSelectUni = (uniId: string) => {
    setActiveUniId(uniId);
  };

  const handleSelectDept = (deptId: string | null) => {
    setActiveDeptId(deptId);
  };

  // Filtered sets based exclusively on the 4 demo albums from the owner dashboard
  const displayedSets = useMemo(() => {
    const demoIds = ['crownfield-law-2026', 'crownfield-law-2025', 'crownfield-law-2024', 'crownfield-law-2023'];
    const matched = sets.filter((s) => demoIds.includes(s.id));
    if (matched.length === 4) {
      return [...matched].sort((a, b) => b.graduationYear - a.graduationYear);
    }
    const merged = demoIds.map((id) => sets.find((s) => s.id === id) || CROWNFIELD_PUBLIC_LAW_SETS.find((s) => s.id === id)!);
    return merged.filter(Boolean).sort((a, b) => b.graduationYear - a.graduationYear);
  }, [sets]);

  // Total student portraits archived in this selection
  const totalPortraits = useMemo(() => {
    return displayedSets.reduce((acc, s) => acc + (s.students?.length || 0), 0);
  }, [displayedSets]);

  // Concise caption helper: ensure caption words are punchy and not overly long
  const shortCaption = useMemo(() => {
    if (!currentDepartment.caption) return '';
    const words = currentDepartment.caption.split(' ');
    if (words.length <= 12) return currentDepartment.caption;
    return words.slice(0, 12).join(' ') + '...';
  }, [currentDepartment.caption]);

  // Contextual baton invitation parameters from props or query
  const inviteContext = useMemo(() => {
    if (propInviteContext) {
      return {
        isInvited: true,
        inviteCode: propInviteContext.inviteCode,
        targetNextYear: propInviteContext.targetYear,
        fromClassYear: propInviteContext.fromYear,
      };
    }
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('next_class_invite');
    if (!inviteCode) return null;

    const fromYearParam = params.get('from_year');
    const yearParam = params.get('year');

    const latestYearInDept = displayedSets.reduce((max, s) => Math.max(max, s.graduationYear), 2026);
    const expectedNextYear = yearParam ? parseInt(yearParam, 10) : latestYearInDept + 1;
    const expectedFromYear = fromYearParam ? parseInt(fromYearParam, 10) : latestYearInDept;

    return {
      isInvited: true,
      inviteCode,
      targetNextYear: expectedNextYear,
      fromClassYear: expectedFromYear,
    };
  }, [propInviteContext, displayedSets]);

  const departmentSets = displayedSets;
  const isAlbumAdmin = currentUser?.role === 'class_rep' || currentUser?.role === 'master_host';

  // Chronologically sorted with latest cohort at the top (e.g. 2026 down to 2023)
  const timelineSets = useMemo(() => {
    return [...departmentSets].sort((a, b) => b.graduationYear - a.graduationYear);
  }, [departmentSets]);

  // Next continuation year for the department legacy train
  const nextContinuationYear = useMemo(() => {
    if (timelineSets.length === 0) return 2027;
    const maxYear = Math.max(...timelineSets.map((s) => s.graduationYear));
    return maxYear + 1;
  }, [timelineSets]);

  const [activeCohortId, setActiveCohortId] = useState<string | null>(null);

  // Scroll-driven interactive timeline sidebar: continuous smooth optical focus (no jumping)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const cards = document.querySelectorAll<HTMLElement>('[data-set-id]');
          if (!cards.length) {
            ticking = false;
            return;
          }

          let closestId: string | null = null;
          let minDistance = Infinity;
          const targetY = window.innerHeight * 0.38;

          cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            const cardCenter = rect.top + rect.height / 2;
            const distance = Math.abs(cardCenter - targetY);
            if (distance < minDistance) {
              minDistance = distance;
              closestId = card.getAttribute('data-set-id');
            }
          });

          if (closestId && closestId !== activeCohortId) {
            setActiveCohortId(closestId);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [timelineSets, activeCohortId]);

  const maxTimelineYear = timelineSets.length > 0 ? timelineSets[0].graduationYear : 2026;
  const minTimelineYear = timelineSets.length > 0 ? timelineSets[timelineSets.length - 1].graduationYear : 2023;
  const timelineSpan = `${maxTimelineYear} — ${minTimelineYear}`;

  return (
    <div id="department-directory-page" className={`min-h-screen ${isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#121214] text-white'} selection:bg-[#d4af37]/30 flex flex-col relative animate-entrance`}>
      {/* Top Navigation Bar with KoHot Text Logo */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b px-4 sm:px-8 py-3.5 transition-colors ${
        isLightMode 
          ? 'bg-white/95 border-slate-200 text-slate-900 shadow-sm' 
          : 'bg-[#121214]/95 border-zinc-800 text-white'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 relative z-10">
          <button
            id="legacy-wall-top-kohot-btn"
            type="button"
            onClick={() => {
              if (currentUser?.role === 'class_rep') {
                return; // Return to website is only possible via log out under profile icon
              }
              if (onBackToLanding) {
                onBackToLanding();
              } else {
                window.location.hash = '#home';
              }
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            className={`flex items-center gap-2.5 transition-colors cursor-pointer group select-none ${
              isLightMode ? 'text-slate-900 hover:text-[#d4af37]' : 'text-white hover:text-[#d4af37]'
            }`}
            title="Return to KoHot Website"
          >
            <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shadow-xs ${
              isLightMode ? 'bg-slate-100 border-slate-200 group-hover:border-[#d4af37]' : 'bg-white/10 border-white/20 group-hover:border-[#d4af37]'
            }`}>
              <div className={`w-2.5 h-2.5 rotate-45 transition-colors ${
                isLightMode ? 'bg-slate-900 group-hover:bg-[#d4af37]' : 'bg-white group-hover:bg-[#d4af37]'
              }`} />
            </div>
            <span className={`font-syne font-extrabold text-lg sm:text-xl tracking-tight uppercase transition-colors ${
              isLightMode ? 'text-slate-900 group-hover:text-[#d4af37]' : 'text-white group-hover:text-[#d4af37]'
            }`}>
              KoHot
            </span>
          </button>

          <div className="flex items-center gap-3">
            {/* Context-aware Light/Dark Mode Switcher */}
            <button
              id="legacy-wall-theme-toggle-btn"
              type="button"
              onClick={toggleLightMode}
              className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:scale-105 active:scale-95 shrink-0 ${
                isLightMode
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 font-mono-tech text-xs uppercase font-semibold'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white font-mono-tech text-xs uppercase font-semibold'
              }`}
              title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {isLightMode ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-800" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            {isAlbumAdmin && (
              <AlbumAdminSwitcher
                activeMode="preview"
                onManageAlbum={onOpenDashboard}
                onPreviewAlbum={() => {
                  if (departmentSets.length > 0) {
                    onSelectSet(departmentSets[0].id);
                  } else if (sets.length > 0) {
                    onSelectSet(sets[0].id);
                  }
                }}
              />
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          DEPARTMENT HEADER SECTION: RESTORED BLACK BACKGROUND, SAME SIZE SQUARE LOGOS
          ========================================================================= */}
      <section 
        id="department-header-section"
        className="w-full bg-black border-b border-zinc-800 relative overflow-hidden py-6 sm:py-8 text-white shadow-xl animate-hero-reveal"
      >


        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center justify-center relative z-10">
          <div className="space-y-3 max-w-2xl flex flex-col items-center">
            
            {/* Department and University Logos Together (Equal size & same square frame) */}
            <div className="flex items-center justify-center gap-3 animate-slide-up-fade">
              {/* Department Logo (Square frame) */}
              {currentDepartment.logoUrl ? (
                <img
                  src={currentDepartment.logoUrl}
                  alt={currentDepartment.name}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-contain bg-white p-1 border-2 border-amber-500/40 shadow-md shrink-0"
                />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 border-2 border-amber-500/40 text-white font-syne font-black text-sm flex items-center justify-center shadow-md shrink-0">
                  {currentDepartment.code || 'DEP'}
                </div>
              )}

              {/* University Logo (Same size and same square frame as department logo) */}
              {currentUniversity.logoUrl ? (
                <img
                  src={currentUniversity.logoUrl}
                  alt={currentUniversity.name}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-contain bg-white p-1 border-2 border-amber-500/40 shadow-md shrink-0"
                />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 border-2 border-amber-500/40 text-white font-syne font-black text-sm flex items-center justify-center shadow-md shrink-0">
                  {currentUniversity.shortCode}
                </div>
              )}
            </div>

            {/* Department and University Names */}
            <div className="space-y-1 pt-1 animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-syne font-extrabold text-white tracking-tight leading-snug uppercase text-center">
                {currentDepartment.name.toUpperCase().startsWith('DEPARTMENT OF')
                  ? currentDepartment.name.toUpperCase()
                  : currentDepartment.name.toUpperCase().startsWith('DEPARTMENT')
                    ? currentDepartment.name.toUpperCase()
                    : `DEPARTMENT OF ${currentDepartment.name.toUpperCase()}`}
              </h1>
              <p className="font-syne font-semibold text-xs sm:text-sm text-zinc-400 tracking-wider uppercase text-center">
                {universityDisplayName.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Department Legacy Wall with Album Cards */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8 relative z-10">
        <section id="department-legacy-wall" className="space-y-6">

          {/* Contextual Relay Invitation Banner - Pure Clean White with Amber Border */}
          {inviteContext && (
            <div className="p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative overflow-hidden transition-all shadow-sm hover:shadow-md text-slate-900 dark:text-zinc-100 animate-slide-up-fade">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 font-mono-tech text-[10px] uppercase font-bold">
                      {inviteContext.isInvited ? 'Official Department Relay Link' : 'Incoming Class Milestone'}
                    </span>
                    <span className="text-slate-400 text-xs">•</span>
                    <span className="text-slate-900 text-xs font-mono-tech font-bold">
                      Class of {inviteContext.fromClassYear} → Class of {inviteContext.targetNextYear}
                    </span>
                  </div>

                  <h3 className="font-syne font-bold text-xl sm:text-2xl text-slate-900">
                    Your Class — {inviteContext.targetNextYear} / Create Your Class Album
                  </h3>

                  <p className="font-body text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl font-normal">
                    The graduating Class of {inviteContext.fromClassYear} has preserved their memories and passed the department baton forward. Explore the preceding class albums below to understand your department's traditions, then establish your set's permanent digital home.
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <button
                    id="legacy-wall-invite-create-btn"
                    type="button"
                    onClick={() => {
                      if (onOpenOnboardingWithInvite) {
                        onOpenOnboardingWithInvite({
                          inviteCode: inviteContext.inviteCode || 'BATON',
                          departmentId: currentDepartment.id,
                          universityId: currentUniversity.id,
                          targetYear: inviteContext.targetNextYear,
                          fromYear: inviteContext.fromClassYear,
                        });
                      } else {
                        onOpenOnboarding();
                      }
                    }}
                    className="px-6 py-3 rounded-full bg-slate-900 text-white hover:bg-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-[#d4af37]" />
                    <span>Create Your Class Album ({inviteContext.targetNextYear})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grid of Yearly Set Albums */}
          {departmentSets.length === 0 ? (
            <div className="text-center py-20 space-y-4 bg-zinc-50 border border-zinc-200 rounded-3xl p-8 text-black">
              <GraduationCap className="w-12 h-12 text-[#b89728] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-sans font-bold text-black">No Class Set Albums Registered Yet</h3>
                <p className="text-xs text-black max-w-md mx-auto">
                  Graduating classes for {currentDepartment.name} are currently onboarding their class albums.
                </p>
              </div>
              <button
                onClick={onOpenOnboarding}
                className="px-5 py-2.5 rounded-full bg-black text-white font-tech font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-colors cursor-pointer inline-flex items-center gap-2 shadow-sm"
              >
                <PlusCircle className="w-4 h-4 text-[#d4af37]" />
                <span>Register This Department Set</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Timeline Train Rails Layout */}
              <div className="relative pl-7 sm:pl-12 md:pl-14 pt-2">
                {/* Understated subtle architectural sidebar line on the legacy wall */}
                <div className="absolute left-3 sm:left-5 md:left-6 top-6 bottom-6 w-px bg-zinc-300 dark:bg-zinc-800 rounded-full pointer-events-none" />

                {/* Train Carriages Grid / List */}
                <div className="space-y-6 sm:space-y-8">
                  {/* Next Year Continuation Album Card on Timeline */}
                  <div className="relative group animate-slide-up-fade">
                    {/* Side Timeline Bar Year Station Node */}
                    <div className="absolute -left-7 sm:-left-12 md:-left-14 top-6 -translate-x-1/2 z-20 flex items-center justify-center pointer-events-none">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono-tech font-bold border-2 border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-md">
                        <span>{nextContinuationYear}</span>
                      </div>
                    </div>

                    {/* Connector Link between Timeline Bar and Card */}
                    <div className="absolute -left-3.5 sm:-left-6 md:-left-7 top-9 w-3.5 sm:w-6 md:w-7 h-px bg-amber-400 pointer-events-none" />

                    {/* Continuation Card Styled Like Album Card */}
                    <div
                      id="next-class-continuation-card"
                      onClick={() => {
                        if (inviteContext && onOpenOnboardingWithInvite) {
                          onOpenOnboardingWithInvite({
                            inviteCode: inviteContext.inviteCode || 'CONTINUATION',
                            departmentId: currentDepartment.id,
                            universityId: currentUniversity.id,
                            targetYear: nextContinuationYear,
                            fromYear: nextContinuationYear - 1,
                          });
                        } else {
                          onOpenOnboarding();
                        }
                      }}
                      className={`group/card relative rounded-2xl border-2 border-dashed border-amber-500/50 overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none max-w-4xl ${
                        isLightMode
                          ? 'bg-amber-50/40 hover:bg-amber-50/70 text-zinc-900 shadow-sm'
                          : 'bg-[#18181b]/80 hover:bg-[#18181b] text-white shadow-md'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row items-stretch">
                        <div className="relative h-44 sm:h-48 md:h-auto md:w-72 lg:w-80 shrink-0 overflow-hidden bg-amber-500/10 flex flex-col items-center justify-center p-6 text-center">
                          <span className="font-mono-tech text-[10px] uppercase tracking-widest text-[#d4af37] font-bold">
                            Incoming Relay Station
                          </span>
                          <h4 className="font-syne font-extrabold text-2xl text-slate-900 dark:text-white mt-1">
                            Class of {nextContinuationYear}
                          </h4>
                          <span className="text-[11px] font-mono-tech text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                            Upcoming Cohort Album
                          </span>
                        </div>

                        <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-bold uppercase tracking-wider bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 inline-block">
                              {nextContinuationYear} Continuation
                            </span>
                            <h3 className="font-syne font-bold text-lg sm:text-xl text-slate-900 dark:text-white group-hover/card:text-[#d4af37] transition-colors">
                              {currentDepartment.name} — Class of {nextContinuationYear}
                            </h3>
                            <p className={`font-body text-xs leading-relaxed max-w-2xl ${isLightMode ? 'text-slate-600' : 'text-zinc-300'}`}>
                              The continuous legacy train moves forward! Start your cohort album to join the continuous legacy train and preserve your class milestone.
                            </p>
                          </div>

                          <div className={`pt-4 mt-3 border-t flex items-center justify-between text-xs ${isLightMode ? 'border-amber-200/60' : 'border-amber-500/20'}`}>
                            <span className="text-[11px] font-mono-tech text-[#d4af37] font-semibold">
                              Open for Class Album Admin
                            </span>
                            <button
                              type="button"
                              className="px-4 py-2 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                              <span>Create Class Album</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {timelineSets.map((set, setIndex) => {
                    const studentCount = set.students?.length || 0;
                    const isLatest = setIndex === 0;
                    const isCurrent = isLatest;
                    const isActive = activeCohortId === set.id || (activeCohortId === null && isLatest);

                    return (
                      <div 
                        key={set.id} 
                        className="relative group animate-slide-up-fade"
                        style={{ animationDelay: `${setIndex * 120}ms` }}
                        onMouseEnter={() => setActiveCohortId(set.id)}
                      >
                        {/* Side Timeline Bar Year Station Node */}
                        <div className="absolute -left-7 sm:-left-12 md:-left-14 top-6 -translate-x-1/2 z-20 flex items-center justify-center pointer-events-none">
                          <div 
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono-tech font-bold transition-all duration-300 ease-out ${
                              isActive
                                ? 'bg-[#d4af37] border-2 border-white dark:border-zinc-900 text-black font-black shadow-md'
                                : isLightMode 
                                  ? 'bg-white border border-zinc-300 text-zinc-700 shadow-xs'
                                  : 'bg-[#18181b] border border-zinc-700 text-zinc-300 shadow-xs'
                            }`}
                            title={`Graduation Year: ${set.graduationYear}`}
                          >
                            <span>{set.graduationYear}</span>
                          </div>
                        </div>

                        {/* Connector Link between Timeline Bar and Card */}
                        <div className={`absolute -left-3.5 sm:-left-6 md:-left-7 top-9 w-3.5 sm:w-6 md:w-7 h-px transition-colors duration-300 ease-out pointer-events-none ${
                          isActive ? 'bg-[#d4af37]' : isLightMode ? 'bg-zinc-300' : 'bg-zinc-800'
                        }`} />

                        {/* Class Album Card */}
                        <div
                          id={`set-card-${set.id}`}
                          data-set-id={set.id}
                          onClick={() => onSelectSet(set.id)}
                          className={`group/card relative rounded-2xl border overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none max-w-4xl ${
                            isLightMode
                              ? 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300 shadow-sm'
                              : 'bg-[#18181b] text-white border-zinc-800 hover:border-zinc-700 shadow-md'
                          } ${
                            isActive ? 'border-2 !border-[#d4af37] shadow-md ring-2 ring-[#d4af37]/20' : ''
                          }`}
                        >
                          <div className="flex flex-col md:flex-row items-stretch">
                            {/* Thumbnail Banner */}
                            <div className="relative h-44 sm:h-48 md:h-auto md:w-72 lg:w-80 shrink-0 overflow-hidden bg-slate-100">
                              <img
                                src={set.bannerImageUrl || set.legacyGroupImageUrl}
                                alt={set.classSetName}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=85';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/20" />

                              {/* Year Badge inside thumbnail */}
                              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono-tech font-bold uppercase tracking-wider shadow ${
                                  isCurrent
                                    ? 'bg-[#d4af37] text-slate-950 font-extrabold'
                                    : 'bg-black/80 backdrop-blur-md text-white border border-white/20'
                                }`}>
                                  Class of {set.graduationYear}
                                </span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-tech font-black tracking-widest bg-black text-white uppercase shadow">
                                    CURRENT
                                  </span>
                                )}
                              </div>

                              {/* Student Count Badge */}
                              <div className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-[10px] font-mono-tech text-slate-900 font-bold flex items-center gap-1 shadow-xs">
                                <Users className="w-3 h-3 text-[#d4af37]" />
                                <span>{studentCount} Profiles</span>
                              </div>
                            </div>

                            {/* Card Body - Deep Charcoal Titles, Rich Medium Slate Subtext, Signature Gold Department & Nicknames */}
                            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  {/* Department Name on Cards: Gold */}
                                  <span className="text-[10px] font-mono-tech uppercase tracking-widest text-[#d4af37] font-bold">
                                    {set.departmentName} • {set.graduationYear} Set
                                  </span>
                                  <span className={`text-[10px] font-mono-tech font-bold ${isLightMode ? 'text-slate-900' : 'text-zinc-300'}`}>
                                    Station #{setIndex + 1}
                                  </span>
                                </div>

                                {/* Album Nickname on Cards: Gold */}
                                <h3 className="font-syne text-lg sm:text-xl font-bold text-[#d4af37] group-hover/card:text-[#e6c158] transition-colors line-clamp-1">
                                  {set.classSetName}
                                </h3>

                                <p className={`text-xs font-sans line-clamp-2 leading-relaxed font-normal ${isLightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
                                  {set.ourStory ? set.ourStory.slice(0, 140) + '...' : 'Permanent digital class album capturing the achievements and profiles of this graduating class.'}
                                </p>

                                {/* Classmate Face Preview Circles */}
                                {(set.students || []).length > 0 && (
                                  <div className="flex items-center justify-between pt-1">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                      {(set.students || []).slice(0, 5).map((s, sIdx) => (
                                        <img
                                          key={s.id || sIdx}
                                          src={s.photoUrl}
                                          alt={s.fullName}
                                          className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src =
                                              'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&auto=format&fit=crop&q=80';
                                          }}
                                        />
                                      ))}
                                    </div>
                                    {(set.students?.length || 0) > 5 && (
                                      <span className={`text-[10px] font-mono-tech font-semibold ${isLightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
                                        +{(set.students?.length || 0) - 5} classmates
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Footer Action */}
                              <div className={`pt-3 border-t flex items-center justify-between text-xs ${isLightMode ? 'border-slate-100' : 'border-white/10'}`}>
                                {(() => {
                                  const presidentStudent = (set.students || []).find((s) => {
                                    if (!s.position) return false;
                                    const p = s.position.toLowerCase();
                                    return (p.includes('president') || p.includes('department president')) && !p.includes('vice');
                                  });
                                  const leaderLabel = presidentStudent ? 'President' : 'Rep';
                                  const leaderName = presidentStudent ? presidentStudent.fullName : (set.classRepName || 'Department Representative');
                                  return (
                                    <span className={`text-[11px] font-mono-tech font-semibold truncate max-w-[200px] ${isLightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
                                      {leaderLabel}: {leaderName}
                                    </span>
                                  );
                                })()}

                                <div className="flex items-center gap-1.5 font-mono-tech font-bold text-[#d4af37] group-hover/card:translate-x-1 transition-transform group-hover/card:text-[#e6c158]">
                                  <span>Explore Album</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer Area with KoHot Logo & Sign In - Permanently Black as requested */}
      <footer className="mt-auto py-10 border-t border-zinc-800 bg-black text-xs font-mono-tech text-zinc-400 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-zinc-800">
            {/* KoHot Logo */}
            <button
              id="legacy-wall-footer-kohot-btn"
              type="button"
              onClick={() => {
                if (currentUser?.role === 'class_rep') {
                  return; // Return to website is only possible via log out under profile icon
                }
                if (onBackToLanding) {
                  onBackToLanding();
                } else {
                  window.location.hash = '#home';
                }
              }}
              className="flex items-center gap-2 text-white hover:text-[#d4af37] transition-colors cursor-pointer group"
              title="Visit KoHot Main Website"
            >
              <div className="w-5 h-5 rounded-md bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center group-hover:border-[#d4af37] transition-colors">
                <div className="w-2 h-2 bg-[#d4af37] rotate-45" />
              </div>
              <span className="font-syne font-bold text-xs tracking-wider uppercase text-white group-hover:text-[#d4af37] transition-colors">
                KoHot
              </span>
            </button>

            {/* Sign In / Dashboard Button */}
            <div className="flex items-center gap-2">
              <button
                id="legacy-wall-footer-signin-btn"
                type="button"
                onClick={currentUser ? onOpenDashboard : onOpenLogin}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono-tech text-white border border-zinc-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm font-semibold"
                title={currentUser ? `Signed in as ${currentUser.fullName || 'User'} - Click to manage` : 'Sign In to your account'}
              >
                <Lock className="w-3 h-3 text-[#d4af37]" />
                <span className="font-semibold">{currentUser ? 'Dashboard' : 'Sign In'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
            <div className="flex items-center gap-3 text-zinc-300">
              <span>
                {currentDepartment.name.toLowerCase().startsWith('department of') || currentDepartment.name.toLowerCase().startsWith('department ')
                  ? currentDepartment.name
                  : `Department of ${currentDepartment.name}`}
              </span>
              <span>•</span>
              <span>{universityDisplayName}</span>
            </div>

            <div className="flex items-center gap-4 text-zinc-400">
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Help &amp; Support
              </button>
              <span className="text-zinc-600">•</span>
              <button
                type="button"
                onClick={() => setIsDisputeModalOpen(true)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Album Admin Help"
              >
                Album Admin Help
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 text-center sm:text-right">
              © {new Date().getFullYear()} KoHot. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Album Admin Help Support Modal */}
      <AlbumAdminHelpModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        currentSet={sets.find((s) => s.departmentId === currentDepartment.id) || sets[0] || null}
        currentUser={currentUser}
      />

      {/* Dedicated Help & FAQ Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onOpenOnboarding={onOpenOnboarding}
      />

      {/* PERSISTENT CONTEXTUAL CTA: INCOMING CLASS REPRESENTATIVE INVITATION */}
      {inviteContext && onOpenOnboardingWithInvite && (
        <div
          id="legacy-wall-contextual-invite-bar"
          className="fixed bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto bg-[#18181b]/95 border border-amber-400/40 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 sm:gap-4 text-white animate-fadeIn"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono-tech uppercase tracking-wider text-amber-300 block leading-tight">
                Incoming Class Representative
              </span>
              <span className="font-syne font-bold text-xs sm:text-sm text-white truncate block">
                Your Class — {inviteContext.targetNextYear}
              </span>
            </div>
          </div>
          <button
            id="legacy-wall-contextual-create-btn"
            onClick={() =>
              onOpenOnboardingWithInvite({
                inviteCode: inviteContext.inviteCode || 'BATON',
                departmentId: currentDepartment.id,
                universityId: currentUniversity.id,
                targetYear: inviteContext.targetNextYear,
                fromYear: inviteContext.fromClassYear,
              })
            }
            className="px-3.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <span>Create Your Class Album</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Create Class Album CTA Button - Lower Left, aligned with Arrow Up button on the right */}
      <button
        id="floating-create-album-btn"
        type="button"
        onClick={() => {
          if (inviteContext && onOpenOnboardingWithInvite) {
            onOpenOnboardingWithInvite({
              inviteCode: inviteContext.inviteCode || 'BATON',
              departmentId: currentDepartment.id,
              universityId: currentUniversity.id,
              targetYear: nextContinuationYear,
              fromYear: nextContinuationYear - 1,
            });
          } else {
            onOpenOnboarding();
          }
        }}
        className="fixed bottom-6 left-6 z-50 px-4 sm:px-5 py-3 rounded-full bg-slate-900 hover:bg-black dark:bg-[#18181b] dark:hover:bg-zinc-800 text-white font-syne font-bold text-xs uppercase tracking-wider shadow-2xl backdrop-blur-xl border border-white/20 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center gap-2 group"
        style={{
          position: 'fixed',
          left: '1.5rem',
          bottom: '1.5rem',
        }}
        title="Create Class Album"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-pulse" />
        <span>Create Class Album</span>
      </button>
    </div>
  );
};
