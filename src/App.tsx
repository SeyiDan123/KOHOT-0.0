import React, { useState, useEffect } from 'react';
import { 
  ClassSet, 
  UniversityDirectoryItem, 
  DepartmentItem,
  FinancialTransaction, 
  DepartmentAdditionRequest, 
  FoundingClassRequest,
  WebsiteContentOverride, 
  UserAccount, 
  UserRole,
  NextClassInviteContext 
} from './types';
import { 
  getStoredUniversities, 
  saveStoredUniversities, 
  getStoredSets, 
  saveStoredSets, 
  getStoredTransactions, 
  saveStoredTransactions, 
  getStoredAdditionRequests, 
  saveStoredAdditionRequests, 
  getStoredFoundingClassRequests,
  saveStoredFoundingClassRequests,
  getStoredContentOverride, 
  saveStoredContentOverride,
  saveStoredTestimonials,
  purgeLegacyDataLocalStorage,
  isCrownfieldDemoAlbum
} from './data/initialData';
import { CROWNFIELD_PUBLIC_LAW_SETS } from './data/crownfieldLawDemos';
import { 
  alertHostFoundingRegistration, 
  HOST_EMAIL,
  checkAuthSession, 
  logoutSession,
  fetchAlbumsFromD1,
  saveAlbumToD1,
  fetchInstitutionsFromD1,
  saveInstitutionsToD1,
  fetchTransactionsFromD1,
  saveTransactionToD1,
  fetchTestimonialsFromD1,
  fetchSiteContentFromD1,
  saveSiteContentToD1
} from './utils/apiClient';
import { DepartmentAlbumView } from './components/public/DepartmentAlbumView';
import { AlbumsGrid } from './components/public/AlbumsGrid';
import { LandingPage } from './components/public/LandingPage';
import { LoginModal, VerifiedSignupSession } from './components/auth/LoginModal';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { Layer0MasterHostDashboard } from './components/admin/Layer0MasterHostDashboard';
import { Layer1ClassRepDashboard } from './components/admin/Layer1ClassRepDashboard';
import { StudentSubmissionPage } from './components/public/StudentSubmissionPage';
import { KoHotTransitionScreen } from './components/common/KoHotTransitionScreen';
import { BackToTopButton } from './components/common/BackToTopButton';
import { FeedbackProvider } from './components/common/FeedbackSystem';
import { resolveOrSynthesizeSet } from './utils/urlHelper';
import { getTheme, applyTheme } from './utils/theme';
import { forceUnlockAllScroll } from './utils/useStaticBackdropScrollLock';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { PublicDirectoryView } from './components/public/PublicDirectoryView';

interface ResolvedRoute {
  view: 'landing' | 'albums_grid' | 'department_album' | 'layer1_rep' | 'layer0_master' | 'student_submit' | 'public_directory';
  setId: string;
  uniId: string | null;
  deptId: string | null;
  isExternalEntry: boolean;
  label: string;
  synthesizedSet?: ClassSet | null;
}

function resolveCurrentRoute(currentSets: ClassSet[], currentUnis: UniversityDirectoryItem[]): ResolvedRoute {
  if (typeof window === 'undefined') {
    return {
      view: 'landing',
      setId: 'unilag-cs-2026',
      uniId: null,
      deptId: null,
      isExternalEntry: false,
      label: 'PERMANENT ARCHIVE',
    };
  }

  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const pathname = window.location.pathname || '';

  // 0a. Public Directory route: #directory, ?directory=1, /directory
  if (
    hash === '#directory' ||
    hash.startsWith('#directory/') ||
    search.includes('directory=1') ||
    pathname === '/directory'
  ) {
    return {
      view: 'public_directory',
      setId: currentSets[0]?.id || 'unilag-cs-2026',
      uniId: null,
      deptId: null,
      isExternalEntry: true,
      label: 'PUBLIC DIRECTORY',
    };
  }

  // 0. Explicit Demo Legacy Wall / All Albums Directory: #demo-albums, #albums, #legacy-wall
  if (
    hash === '#demo-albums' ||
    hash === '#albums' ||
    hash === '#legacy-wall' ||
    hash.startsWith('#demo')
  ) {
    const defaultDept = currentSets[0]?.departmentId || 'dept-unilag-cs';
    const defaultUni = currentSets[0]?.institutionId || 'unilag';
    return {
      view: 'albums_grid',
      setId: currentSets[0]?.id || 'unilag-cs-2026',
      uniId: defaultUni,
      deptId: defaultDept,
      isExternalEntry: false,
      label: 'DEMO LEGACY WALL',
    };
  }

  // 1. Explicit Homepage / Landing: #home, #landing
  if (hash === '#home' || hash === '#landing') {
    return {
      view: 'landing',
      setId: currentSets[0]?.id || 'unilag-cs-2026',
      uniId: null,
      deptId: null,
      isExternalEntry: false,
      label: 'KOHOT HOME',
    };
  }

  // 2. Next Class Invite Relay Link (?next_class_invite=...)
  if (search.includes('next_class_invite')) {
    const params = new URLSearchParams(search);
    const deptParam = params.get('dept') || 'dept-unilag-cs';
    const uniParam = params.get('uni') || 'unilag';
    const targetSet = currentSets.find((s) => s.departmentId === deptParam);
    return {
      view: 'albums_grid',
      setId: targetSet ? targetSet.id : currentSets[0]?.id || 'unilag-cs-2026',
      uniId: uniParam,
      deptId: deptParam,
      isExternalEntry: true,
      label: 'DEPARTMENT LEGACY WALL — INCOMING CLASS HANDOFF',
    };
  }

  // 3. Contributor/Invite Link: #submit-[setId] or ?submit=[setId] or /submit/[setId]
  const isExplicitDemoOrWallHash =
    hash.includes('demo') ||
    hash.includes('legacy') ||
    hash.includes('directory') ||
    hash === '#albums' ||
    hash === '#home' ||
    hash === '#landing';

  if (
    !isExplicitDemoOrWallHash &&
    (hash.includes('submit') || (search.includes('submit') && !hash.includes('album')) || (pathname.includes('/submit') && !hash.includes('album')))
  ) {
    let matchedSetId: string | null = null;
    const hashMatch = hash.match(/submit-([a-zA-Z0-9_-]+)/);
    const pathMatch = pathname.match(/\/submit\/([a-zA-Z0-9_-]+)/);
    if (hashMatch && hashMatch[1]) {
      matchedSetId = hashMatch[1];
    } else if (pathMatch && pathMatch[1]) {
      matchedSetId = pathMatch[1];
    } else {
      const params = new URLSearchParams(search);
      matchedSetId = params.get('submit') || params.get('set');
    }

    const params = new URLSearchParams(search);
    const { set: targetSet, isSynthesized } = resolveOrSynthesizeSet(matchedSetId, currentSets, currentUnis, params);

    return {
      view: 'student_submit',
      setId: targetSet.id,
      uniId: targetSet.institutionId || null,
      deptId: targetSet.departmentId || null,
      isExternalEntry: true,
      label: `${targetSet.departmentName} SUBMISSION`,
      synthesizedSet: isSynthesized ? targetSet : null,
    };
  }

  // 2. Direct Class Album Link: #album-[setId] or ?album=[setId] or /album/[setId]
  if (hash.includes('album') || search.includes('album') || pathname.includes('/album')) {
    let matchedSetId: string | null = null;
    const albumMatch = hash.match(/album-([a-zA-Z0-9_-]+)/);
    const pathMatch = pathname.match(/\/album\/([a-zA-Z0-9_-]+)/);
    if (albumMatch && albumMatch[1]) {
      matchedSetId = albumMatch[1];
    } else if (pathMatch && pathMatch[1]) {
      matchedSetId = pathMatch[1];
    } else {
      const params = new URLSearchParams(search);
      matchedSetId = params.get('album');
    }

    const params = new URLSearchParams(search);
    const { set: targetSet, isSynthesized } = resolveOrSynthesizeSet(matchedSetId, currentSets, currentUnis, params);

    return {
      view: 'department_album',
      setId: targetSet.id,
      uniId: targetSet.institutionId || null,
      deptId: targetSet.departmentId || null,
      isExternalEntry: true,
      label: targetSet.classSetName || `${targetSet.departmentName} ’${String(targetSet.graduationYear).slice(-2)}`,
      synthesizedSet: isSynthesized ? targetSet : null,
    };
  }

  // 3. Department Legacy Plaque QR Scan or Link: #dept-[deptId], #department/[deptId], ?dept=..., /dept/..., ?plaque=..., ?scan=...
  if (hash.includes('dept') || hash.includes('department') || search.includes('dept') || search.includes('department') || pathname.includes('/dept') || search.includes('plaque') || search.includes('scan')) {
    let deptId: string | null = null;
    const hashMatch = hash.match(/#(?:dept-|department\/)([a-zA-Z0-9_-]+)/);
    const pathMatch = pathname.match(/\/(?:dept|department)\/([a-zA-Z0-9_-]+)/);
    if (hashMatch && hashMatch[1]) {
      deptId = hashMatch[1];
    } else if (pathMatch && pathMatch[1]) {
      deptId = pathMatch[1];
    } else {
      const params = new URLSearchParams(search);
      deptId = params.get('dept') || params.get('department') || params.get('plaque') || params.get('scan');
    }

    if (deptId) {
      const parentUni = currentUnis.find((u) =>
        u.departments?.some((d) => d.id === deptId || d.code.toLowerCase() === deptId?.toLowerCase())
      );
      const targetSet = currentSets.find((s) => s.departmentId === deptId || s.departmentName?.toLowerCase().trim() === deptId?.toLowerCase().trim());
      // If arriving via Next Class Relay Baton Invitation, directly showcase the Department Legacy Wall
      if (search.includes('next_class_invite')) {
        return {
          view: 'albums_grid',
          setId: targetSet ? targetSet.id : currentSets[0]?.id || 'unilag-cs-2026',
          uniId: parentUni ? parentUni.id : targetSet?.institutionId || null,
          deptId: deptId,
          isExternalEntry: true,
          label: targetSet?.departmentName ? `DEPARTMENT OF ${targetSet.departmentName.toUpperCase()}` : 'DEPARTMENT OF COMPUTER SCIENCE',
        };
      }

      return {
        view: 'albums_grid',
        setId: targetSet ? targetSet.id : currentSets[0]?.id || 'unilag-cs-2026',
        uniId: parentUni ? parentUni.id : targetSet?.institutionId || null,
        deptId: deptId,
        isExternalEntry: true,
        label: targetSet?.departmentName ? `DEPARTMENT OF ${targetSet.departmentName.toUpperCase()}` : 'DEPARTMENT LEGACY WALL',
      };
    }
  }

  // 4. University Link: #uni-[uniId]
  if (hash.includes('uni-')) {
    const uniMatch = hash.match(/uni-([a-zA-Z0-9_-]+)/);
    if (uniMatch && uniMatch[1]) {
      return {
        view: 'albums_grid',
        setId: currentSets[0]?.id || 'unilag-cs-2026',
        uniId: uniMatch[1],
        deptId: null,
        isExternalEntry: true,
        label: 'FACULTY ARCHIVES',
      };
    }
  }

  // Default: Direct entry to homepage
  return {
    view: 'landing',
    setId: currentSets[0]?.id || 'unilag-cs-2026',
    uniId: null,
    deptId: null,
    isExternalEntry: false,
    label: 'PERMANENT ARCHIVE',
  };
}

export type { NextClassInviteContext };

function parseInviteContextFromUrl(): NextClassInviteContext | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('next_class_invite');
  if (!inviteCode) return null;
  const yearParam = params.get('year');
  const fromYearParam = params.get('from_year');
  const deptParam = params.get('dept') || 'dept-unilag-cs';
  const uniParam = params.get('uni') || 'unilag';
  return {
    inviteCode,
    departmentId: deptParam,
    universityId: uniParam,
    targetYear: yearParam ? parseInt(yearParam, 10) : 2027,
    fromYear: fromYearParam ? parseInt(fromYearParam, 10) : 2026,
  };
}

export default function App() {
  // Synchronous route resolution on startup to prevent any brief flash of wrong screen
  const initialRoute = React.useMemo(() => {
    return resolveCurrentRoute(getStoredSets(), getStoredUniversities());
  }, []);

  // App state backed by D1 Worker API routes (Crownfield demo albums stay as static code)
  const [universities, setUniversities] = useState<UniversityDirectoryItem[]>(getStoredUniversities);
  const [sets, setSets] = useState<ClassSet[]>(() => {
    const stored = getStoredSets().filter((s) => !isCrownfieldDemoAlbum(s));
    return [...CROWNFIELD_PUBLIC_LAW_SETS, ...stored];
  });
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [additionRequests, setAdditionRequests] = useState<DepartmentAdditionRequest[]>([]);
  const [foundingRequests, setFoundingRequests] = useState<FoundingClassRequest[]>([]);
  const [contentOverride, setContentOverride] = useState<WebsiteContentOverride>(getStoredContentOverride);
  const [d1Loading, setD1Loading] = useState<boolean>(true);
  const [d1Error, setD1Error] = useState<string | null>(null);
  const [versionConflictMessage, setVersionConflictMessage] = useState<string | null>(null);

  // Invitation context for Next Class baton handover
  const [inviteContext, setInviteContext] = useState<NextClassInviteContext | null>(parseInviteContextFromUrl);
  const [onboardingPrefill, setOnboardingPrefill] = useState<{
    universityId?: string;
    departmentId?: string;
    departmentName?: string;
    graduationYear?: number;
    lockDepartmentContext?: boolean;
  }>({});

  // Authentication & Role-Based Routing (Persisted so going away or network hiccups never drop the admin back to the website)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const raw = localStorage.getItem('kohot_current_user');
      if (raw) {
        const parsed = JSON.parse(raw) as UserAccount;
        if (
          parsed &&
          (parsed.role === 'master_host' || (parsed.role === 'class_rep' && Boolean(parsed.assignedSetId)))
        ) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [activeView, setActiveView] = useState<'landing' | 'albums_grid' | 'department_album' | 'layer1_rep' | 'layer0_master' | 'student_submit' | 'public_directory'>(() => {
    if (initialRoute.view === 'public_directory') {
      return 'public_directory';
    }
    if (initialRoute.isExternalEntry && initialRoute.view !== 'landing') {
      return initialRoute.view;
    }
    try {
      const rawUser = localStorage.getItem('kohot_current_user');
      const rawState = localStorage.getItem('kohot_active_dashboard_state');
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser) as UserAccount;
        if (parsedUser?.role === 'master_host' || (parsedUser?.role === 'class_rep' && parsedUser.assignedSetId)) {
          if (rawState) {
            const parsedState = JSON.parse(rawState);
            if (
              parsedState?.activeView &&
              ['layer0_master', 'layer1_rep', 'department_album', 'albums_grid'].includes(parsedState.activeView)
            ) {
              return parsedState.activeView;
            }
          }
          return parsedUser.role === 'master_host' ? 'layer0_master' : 'layer1_rep';
        }
      }
    } catch {}
    return initialRoute.view;
  });

  const [albumOriginView, setAlbumOriginView] = useState<'landing' | 'albums_grid' | 'layer0_master' | 'layer1_rep'>(() => {
    try {
      const rawUser = localStorage.getItem('kohot_current_user');
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser) as UserAccount;
        if (parsedUser?.role === 'master_host') return 'layer0_master';
        if (parsedUser?.role === 'class_rep') return 'layer1_rep';
      }
    } catch {}
    return 'landing';
  });

  const [selectedSetId, setSelectedSetId] = useState<string>(() => {
    if (initialRoute.isExternalEntry && initialRoute.setId) {
      return initialRoute.setId;
    }
    try {
      const rawUser = localStorage.getItem('kohot_current_user');
      const rawState = localStorage.getItem('kohot_active_dashboard_state');
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser) as UserAccount;
        if (rawState) {
          const parsedState = JSON.parse(rawState);
          if (parsedState?.selectedSetId) return parsedState.selectedSetId;
        }
        if (parsedUser?.role === 'class_rep' && parsedUser.assignedSetId) {
          return parsedUser.assignedSetId;
        }
      }
    } catch {}
    return initialRoute.setId;
  });

  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(() => {
    try {
      const rawState = localStorage.getItem('kohot_active_dashboard_state');
      if (rawState) {
        const parsedState = JSON.parse(rawState);
        if (parsedState?.selectedUniversityId) return parsedState.selectedUniversityId;
      }
    } catch {}
    return initialRoute.uniId;
  });

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(() => {
    try {
      const rawState = localStorage.getItem('kohot_active_dashboard_state');
      if (rawState) {
        const parsedState = JSON.parse(rawState);
        if (parsedState?.selectedDepartmentId) return parsedState.selectedDepartmentId;
      }
    } catch {}
    return initialRoute.deptId;
  });

  // The KoHot logo splash screen triggers on external links / initial deep links
  const [isTransitioning, setIsTransitioning] = useState<boolean>(initialRoute.isExternalEntry);
  const [transitionLabel, setTransitionLabel] = useState<string>(initialRoute.label || 'Department of Computer Science');
  const [transitionInstitution, setTransitionInstitution] = useState<string>('University Of Ilorin');

  const hasMountedRef = React.useRef(false);

  // Persist currentUser and active dashboard view state so going away or network hiccups keep the admin in their workspace
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('kohot_current_user', JSON.stringify(currentUser));
        if (activeView !== 'landing') {
          localStorage.setItem(
            'kohot_active_dashboard_state',
            JSON.stringify({
              activeView,
              selectedSetId,
              selectedUniversityId,
              selectedDepartmentId,
            })
          );
        }
      }
    } catch {}
  }, [currentUser, activeView, selectedSetId, selectedUniversityId, selectedDepartmentId]);

  const loadAllD1Data = React.useCallback(async () => {
    setD1Loading(true);
    setD1Error(null);
    try {
      const [albumsRes, instRes, siteRes, testRes, txRes] = await Promise.all([
        fetchAlbumsFromD1(),
        fetchInstitutionsFromD1(),
        fetchSiteContentFromD1(),
        fetchTestimonialsFromD1(),
        fetchTransactionsFromD1(),
      ]);

      if (!albumsRes.success && albumsRes.error) {
        setD1Error(albumsRes.error);
      } else {
        const d1NonDemo = (albumsRes.albums || []).filter((a: ClassSet) => !isCrownfieldDemoAlbum(a));
        setSets((prev) => {
          const prevNonDemo = prev.filter((p) => !isCrownfieldDemoAlbum(p));
          const mergedMap = new Map<string, ClassSet>();
          for (const p of prevNonDemo) {
            mergedMap.set(p.id, p);
          }
          for (const d1Set of d1NonDemo) {
            const existing = mergedMap.get(d1Set.id);
            // If D1 returned a lightweight public stub for an album we already have full admin data for locally, keep full admin data
            if (existing && existing.classRepEmail && !d1Set.classRepEmail) {
              mergedMap.set(d1Set.id, { ...d1Set, ...existing });
            } else {
              mergedMap.set(d1Set.id, existing ? { ...existing, ...d1Set } : d1Set);
            }
          }
          const nextSets = [...CROWNFIELD_PUBLIC_LAW_SETS, ...Array.from(mergedMap.values())];
          saveStoredSets(nextSets);
          return nextSets;
        });
      }

      if (instRes.success && instRes.institutions.length > 0) {
        const baseUnis = getStoredUniversities();
        const d1Map = new Map(instRes.institutions.map((u) => [u.id, u]));
        const mergedUnis: UniversityDirectoryItem[] = baseUnis.map((baseUni) => {
          const d1Uni = d1Map.get(baseUni.id);
          if (!d1Uni) return baseUni;
          d1Map.delete(baseUni.id);
          const baseDeptMap = new Map(baseUni.departments.map((d) => [d.id, d]));
          const d1Depts = Array.isArray(d1Uni.departments) ? d1Uni.departments : [];
          // Merge D1 department state (connected albums, plaque status, custom uploaded logos) without re-adding old cloned departments
          for (const dept of d1Depts) {
            const existing = baseDeptMap.get(dept.id);
            const hasCustomLogo =
              dept.logoUrl &&
              !String(dept.logoUrl).includes('images.unsplash.com') &&
              !String(dept.logoUrl).startsWith('data:image/svg+xml');
            if (existing) {
              baseDeptMap.set(dept.id, {
                ...existing,
                ...dept,
                name: existing.name || dept.name,
                faculty: existing.faculty || dept.faculty,
                heroImageUrl: existing.heroImageUrl || dept.heroImageUrl,
                logoUrl: hasCustomLogo ? dept.logoUrl : existing.logoUrl,
              });
            } else if (Array.isArray(dept.connectedClassAlbumIds) && dept.connectedClassAlbumIds.length > 0) {
              baseDeptMap.set(dept.id, {
                ...dept,
                logoUrl: hasCustomLogo ? dept.logoUrl : baseUni.logoUrl,
              });
            }
          }
          const cleanUniLogo =
            d1Uni.logoUrl && !String(d1Uni.logoUrl).includes('images.unsplash.com')
              ? d1Uni.logoUrl
              : undefined;
          return {
            ...baseUni,
            ...d1Uni,
            logoUrl: baseUni.logoUrl || cleanUniLogo,
            departments: Array.from(baseDeptMap.values()),
            faculties: baseUni.faculties && baseUni.faculties.length > 0 ? baseUni.faculties : d1Uni.faculties,
          };
        });
        for (const extraUni of d1Map.values()) {
          mergedUnis.push(extraUni);
        }
        setUniversities(mergedUnis);
      }

      if (siteRes.success && siteRes.content) {
        setContentOverride((prev) => ({ ...prev, ...siteRes.content }));
      }

      if (testRes.success && Array.isArray(testRes.testimonials) && testRes.testimonials.length > 0) {
        saveStoredTestimonials(testRes.testimonials);
      }

      if (txRes.success) {
        setTransactions(txRes.transactions);
      }
    } catch (err: any) {
      setD1Error(err?.message || 'Unable to sync with D1 database.');
    } finally {
      setD1Loading(false);
    }
  }, []);

  useEffect(() => {
    hasMountedRef.current = true;
    purgeLegacyDataLocalStorage();
    // Apply user theme on startup (default is light mode)
    applyTheme(getTheme());

    // Verify authenticated session cookie from server without dropping local dashboard session on network hiccups
    const initSession = async () => {
      try {
        const session = await checkAuthSession();
        if (session.authenticated && session.user) {
          if (
            session.user.role === 'master_host' ||
            (session.user.role === 'class_rep' && Boolean(session.user.assignedSetId))
          ) {
            setCurrentUser(session.user);
            try {
              localStorage.setItem('kohot_current_user', JSON.stringify(session.user));
            } catch {}
            setActiveView((prev) => {
              if (prev === 'landing') {
                return session.user!.role === 'master_host' ? 'layer0_master' : 'layer1_rep';
              }
              return prev;
            });
            if (session.user.role === 'class_rep' && session.user.assignedSetId) {
              setSelectedSetId((prev) => prev || session.user!.assignedSetId!);
            }
          }
        }
      } catch {
        // Network error or offline: preserve existing local session so the user stays on their dashboard
      } finally {
        await loadAllD1Data();
      }
    };
    initSession();
  }, [loadAllD1Data]);

  // Ensure scroll is NEVER stuck/frozen on view or route changes
  useEffect(() => {
    forceUnlockAllScroll();
  }, [activeView, selectedSetId]);

  // Listen for user profile updates from settings (e.g. name changes) and update currentUser immediately
  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.fullName) {
        setCurrentUser((prev) => prev ? {
          ...prev,
          fullName: e.detail.fullName,
          email: e.detail.email || prev.email,
          phone: e.detail.phone || prev.phone,
          avatarUrl: e.detail.avatarUrl || prev.avatarUrl,
        } : prev);
      }
    };
    window.addEventListener('kohot_user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('kohot_user_profile_updated', handleProfileUpdated);
  }, []);

  // Robust global scroll unlock safety - prevents any frozen page glitches
  useEffect(() => {
    const handleSafetyUnlock = () => {
      const hasActiveModal = document.querySelector(
        '[role="dialog"], [aria-modal="true"], #login-modal-backdrop, #onboarding-modal-backdrop, #paystack-modal-backdrop, #student-detail-modal-backdrop, #moments-fullscreen-lightbox'
      );
      if (!hasActiveModal) {
        forceUnlockAllScroll();
      }
    };

    window.addEventListener('hashchange', handleSafetyUnlock);
    window.addEventListener('popstate', handleSafetyUnlock);
    const interval = setInterval(handleSafetyUnlock, 1500);

    return () => {
      window.removeEventListener('hashchange', handleSafetyUnlock);
      window.removeEventListener('popstate', handleSafetyUnlock);
      clearInterval(interval);
    };
  }, []);

  // If initial route synthesized a set (e.g. invite opened on fresh device), register it immediately
  useEffect(() => {
    if (initialRoute.synthesizedSet) {
      const syn = initialRoute.synthesizedSet;
      setSets((prev) => {
        if (prev.some((s) => s.id === syn.id)) return prev;
        const updated = [syn, ...prev];
        saveStoredSets(updated);
        return updated;
      });
    }
  }, [initialRoute.synthesizedSet]);

  // Global prevention of default browser drop behavior
  useEffect(() => {
    const preventDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDrop, false);
    window.addEventListener('drop', preventDrop, false);
    return () => {
      window.removeEventListener('dragover', preventDrop);
      window.removeEventListener('drop', preventDrop);
    };
  }, []);

  // Browser back/forward navigation support
  useEffect(() => {
    const handleUrlRouting = () => {
      // Only handle if this was triggered after initial mount
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }

      const parsedInvite = parseInviteContextFromUrl();
      if (parsedInvite) {
        setInviteContext(parsedInvite);
      } else if (window.location.hash === '#home' || window.location.hash === '#landing') {
        setInviteContext(null);
      }

      const route = resolveCurrentRoute(sets, universities);
      if (route.synthesizedSet) {
        const syn = route.synthesizedSet;
        setSets((prev) => {
          if (prev.some((s) => s.id === syn.id)) return prev;
          const updated = [syn, ...prev];
          saveStoredSets(updated);
          return updated;
        });
      }
      setIsOnboardingOpen(false);
      setIsLoginOpen(false);
      // Prevent logged-in Album Admin or Host from hopping out to the public landing website without logging out
      if (
        route.view === 'landing' &&
        (currentUser?.role === 'class_rep' || currentUser?.role === 'master_host')
      ) {
        return;
      }
      setActiveView(route.view);
      setSelectedSetId(route.setId);
      if (route.uniId) setSelectedUniversityId(route.uniId);
      if (route.deptId) setSelectedDepartmentId(route.deptId);
    };

    window.addEventListener('hashchange', handleUrlRouting);
    window.addEventListener('popstate', handleUrlRouting);
    return () => {
      window.removeEventListener('hashchange', handleUrlRouting);
      window.removeEventListener('popstate', handleUrlRouting);
    };
  }, [sets, universities, currentUser]);

  const handleOpenOnboardingWithInvite = (invite: {
    inviteCode: string;
    departmentId: string;
    universityId?: string;
    targetYear: number;
    fromYear: number;
  }) => {
    const foundDept = universities
      .flatMap((u) => u.departments || [])
      .find((d) => d.id === invite.departmentId || d.code?.toLowerCase() === invite.departmentId.toLowerCase());
    setOnboardingPrefill({
      universityId: invite.universityId || 'unilag',
      departmentName: foundDept ? foundDept.name : 'Computer Science',
      graduationYear: invite.targetYear,
    });
    setIsOnboardingOpen(true);
  };

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [verifiedSignupSession, setVerifiedSignupSession] = useState<VerifiedSignupSession | null>(null);

  // Save changes to D1 (Crownfield demo albums stay as static code and are never stored in D1)
  const handleUpdateUniversities = (newUnis: UniversityDirectoryItem[]) => {
    setUniversities(newUnis);
    saveInstitutionsToD1(newUnis);
  };

  const handleUpdateSets = (newSets: ClassSet[]) => {
    setSets(newSets);
  };

  const handleUpdateSingleSet = (updatedSet: ClassSet) => {
    const exists = sets.some((s) => s.id === updatedSet.id);
    const updated = exists ? sets.map((s) => (s.id === updatedSet.id ? updatedSet : s)) : [updatedSet, ...sets];
    setSets(updated);

    // Never store static Crownfield demo albums in D1
    if (!isCrownfieldDemoAlbum(updatedSet)) {
      const isHostOnlyRetention = currentUser?.role === 'master_host' && currentUser?.email?.toLowerCase() !== updatedSet.classRepEmail?.toLowerCase();
      saveAlbumToD1(updatedSet.id, updatedSet, {
        version: updatedSet.version ?? 1,
        hostOnlyRetentionUpdate: isHostOnlyRetention,
      }).then((res) => {
        if (res.conflict) {
          setVersionConflictMessage(res.message || 'Conflict: This album was modified in another session. Please reload.');
        } else if (res.success && res.version) {
          setSets((prev) =>
            prev.map((s) => (s.id === updatedSet.id ? { ...s, version: res.version } : s))
          );
        }
      });
    }

    // Sync departmentLogoUrl (even in draft mode) and published/active status to the department in universities directory
    const isPublishedOrActive =
      (updatedSet.isPublished || updatedSet.published || updatedSet.activationStatus === 'active') &&
      !updatedSet.isUnpublished &&
      !updatedSet.unpublished &&
      !updatedSet.deletedAt;

    if (isPublishedOrActive || Boolean(updatedSet.departmentLogoUrl)) {
      let uniChanged = false;
      const updatedUnis = universities.map((u) => {
        if (u.id !== updatedSet.institutionId && u.id !== updatedSet.universityId) return u;
        const depts = u.departments || [];
        const hasDept = depts.some(
          (d) =>
            d.id === updatedSet.departmentId ||
            d.name.toLowerCase().trim() === (updatedSet.departmentName || '').toLowerCase().trim()
        );
        if (hasDept) {
          return {
            ...u,
            departments: depts.map((d) => {
              if (
                d.id === updatedSet.departmentId ||
                d.name.toLowerCase().trim() === (updatedSet.departmentName || '').toLowerCase().trim()
              ) {
                const connected = d.connectedClassAlbumIds || [];
                const needsConnect = isPublishedOrActive && !connected.includes(updatedSet.id);
                const needsLogoUpdate =
                  Boolean(updatedSet.departmentLogoUrl) && d.logoUrl !== updatedSet.departmentLogoUrl;
                if (needsConnect || needsLogoUpdate) {
                  uniChanged = true;
                  return {
                    ...d,
                    logoUrl: updatedSet.departmentLogoUrl || d.logoUrl,
                    legacy_status: isPublishedOrActive ? ('established' as const) : d.legacy_status,
                    connectedClassAlbumIds: needsConnect ? [...connected, updatedSet.id] : connected,
                  };
                }
              }
              return d;
            }),
          };
        } else if (isPublishedOrActive && updatedSet.departmentId && updatedSet.departmentName) {
          uniChanged = true;
          const newDept: DepartmentItem = {
            id: updatedSet.departmentId,
            universityId: u.id,
            name: updatedSet.departmentName,
            code: updatedSet.departmentName.slice(0, 3).toUpperCase(),
            faculty: updatedSet.faculty || 'Faculty',
            heroImageUrl: updatedSet.bannerImageUrl || '',
            caption: updatedSet.classSlogan || `Official Department Legacy Wall for ${updatedSet.departmentName}`,
            legacy_status: 'established',
            logoUrl: updatedSet.departmentLogoUrl || u.logoUrl,
            connectedClassAlbumIds: [updatedSet.id],
          };
          return {
            ...u,
            departments: [...depts, newDept],
          };
        }
        return u;
      });
      if (uniChanged) {
        handleUpdateUniversities(updatedUnis);
      }
    }
  };

  const handleUpdateTransactions = (newTxs: FinancialTransaction[]) => {
    setTransactions(newTxs);
    if (newTxs.length > 0) {
      saveTransactionToD1(newTxs[0]);
    }
  };

  const handleUpdateAdditionRequests = (newReqs: DepartmentAdditionRequest[]) => {
    setAdditionRequests(newReqs);
    saveStoredAdditionRequests(newReqs);
  };

  const handleUpdateFoundingRequests = (newReqs: FoundingClassRequest[]) => {
    setFoundingRequests(newReqs);
    saveStoredFoundingClassRequests(newReqs);
  };

  // Submit a new Founding Class application from Onboarding
  const handleSubmitFoundingRequest = (req: FoundingClassRequest) => {
    const updatedReqs = [req, ...foundingRequests];
    handleUpdateFoundingRequests(updatedReqs);

    // Alert Host via email: "New registration awaiting approval" with department and institution
    alertHostFoundingRegistration({
      universityId: req.universityId,
      universityName: req.universityName,
      departmentId: req.departmentId,
      departmentName: req.departmentName,
      classYear: req.classYear,
      classSetName: req.classSetName,
      applicantName: req.applicantName,
      applicantEmail: req.applicantEmail,
      applicantPhone: req.applicantPhone,
    });

    // Update university department legacy status to 'pending_verification' to hold competing claims
    const updatedUnis = universities.map((u) => {
      if (u.id !== req.universityId) return u;
      return {
        ...u,
        departments: (u.departments || []).map((d) => {
          if (d.id === req.departmentId || d.name.toLowerCase() === req.departmentName.toLowerCase()) {
            return {
              ...d,
              legacy_status: 'pending_verification' as const,
              pendingFoundingRequestId: req.id,
            };
          }
          return d;
        }),
      };
    });
    handleUpdateUniversities(updatedUnis);
  };

  // Approve a Founding Class application from Layer 0 Master Host Dashboard
  const handleApproveFoundingRequest = (requestId: string, reviewNotes?: string) => {
    const req = foundingRequests.find((r) => r.id === requestId);
    if (!req) return;

    // 1. Update request status to Approved
    const updatedReqs = foundingRequests.map((r) =>
      r.id === requestId
        ? { ...r, status: 'Approved' as const, reviewNotes: reviewNotes || r.reviewNotes }
        : r
    );
    handleUpdateFoundingRequests(updatedReqs);

    // 2. Find parent uni and department
    const uni = universities.find((u) => u.id === req.universityId);
    const dept = uni?.departments?.find((d) => d.id === req.departmentId || d.name.toLowerCase() === req.departmentName.toLowerCase());

    // 3. Create or activate the Founding Class Album
    const setId = `${req.universityId}-${req.departmentId.replace(/^dept-/, '')}-${req.classYear}`;
    const existingSet = sets.find((s) => s.id === setId);
    let updatedSets: ClassSet[];

    if (existingSet) {
      updatedSets = sets.map((s) =>
        s.id === setId
          ? {
              ...s,
              isFoundingClass: true,
              activationStatus: 'active' as const,
              classRepName: req.applicantName,
              classRepEmail: req.applicantEmail,
              classRepPhone: req.applicantPhone,
            }
          : s
      );
    } else {
      const newFoundingSet: ClassSet = {
        id: setId,
        institutionId: req.universityId,
        institutionName: req.universityName,
        institutionLogoUrl: uni?.logoUrl,
        departmentId: req.departmentId,
        departmentName: req.departmentName,
        faculty: req.facultyName,
        graduationYear: req.classYear,
        classSetName: req.classSetName || `${req.departmentName} Founding Class '${String(req.classYear).slice(-2)}`,
        isFoundingClass: true,
        estimatedGraduatesCount: req.estimatedGraduatesCount || 100,
        classRepName: req.applicantName,
        classRepEmail: req.applicantEmail,
        classRepPhone: req.applicantPhone,
        activationStatus: 'active',
        activationDate: new Date().toISOString().split('T')[0],
        activationRef: `KOHOT-FND-${Math.floor(10000 + Math.random() * 90000)}`,
        bannerImageUrl: dept?.heroImageUrl || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
        legacyGroupImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
        ourStory: '',
        students: [
          {
            id: `rep-std-${Date.now()}`,
            setId,
            fullName: req.applicantName,
            nickname: 'Founding Class Rep',
            position: 'Class Representative',
            photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=720&auto=format&fit=crop&q=85',
            quote: 'We laid the permanent foundation for every cohort that walks these halls after us.',
            approved: true,
            submittedAt: new Date().toISOString().split('T')[0],
          }
        ],
        memories: [],
        awards: [],
        voices: [],
      };
      updatedSets = [newFoundingSet, ...sets];
    }
    handleUpdateSets(updatedSets);

    // 4. Record sponsored financial transaction
    const newTx: FinancialTransaction = {
      id: `tx-fnd-${Date.now()}`,
      reference: `KOHOT-FND-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      setId,
      setName: req.classSetName || `${req.departmentName} Founding Class '${String(req.classYear).slice(-2)}`,
      institution: req.universityName,
      amount: 0,
      currency: 'NGN',
      status: 'Paid',
      payerName: `${req.applicantName} (Pioneer Sponsored)`,
      payerEmail: req.applicantEmail,
    };
    handleUpdateTransactions([newTx, ...transactions]);

    // 5. Update Department in university directory to 'established'
    const updatedUnis = universities.map((u) => {
      if (u.id !== req.universityId) return u;
      return {
        ...u,
        departments: (u.departments || []).map((d) => {
          if (d.id === req.departmentId || d.name.toLowerCase() === req.departmentName.toLowerCase()) {
            const existingAlbums = d.connectedClassAlbumIds || [];
            return {
              ...d,
              legacy_status: 'established' as const,
              founding_class_id: setId,
              founding_class_year: req.classYear,
              legacyPlaqueInstalled: true,
              legacyPlaqueInstallationDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
              connectedClassAlbumIds: existingAlbums.includes(setId) ? existingAlbums : [...existingAlbums, setId],
              pendingFoundingRequestId: undefined,
            };
          }
          return d;
        }),
      };
    });
    handleUpdateUniversities(updatedUnis);
  };

  // Reject a Founding Class application from Layer 0 Master Host Dashboard
  const handleRejectFoundingRequest = (requestId: string, reason?: string) => {
    const req = foundingRequests.find((r) => r.id === requestId);
    if (!req) return;

    // 1. Update request status to Rejected
    const updatedReqs = foundingRequests.map((r) =>
      r.id === requestId
        ? { ...r, status: 'Rejected' as const, reviewNotes: reason || 'Application could not be verified by institutional desk.' }
        : r
    );
    handleUpdateFoundingRequests(updatedReqs);

    // 2. Revert department's legacy_status to available
    const updatedUnis = universities.map((u) => {
      if (u.id !== req.universityId) return u;
      return {
        ...u,
        departments: (u.departments || []).map((d) => {
          if (d.id === req.departmentId || d.name.toLowerCase() === req.departmentName.toLowerCase()) {
            return {
              ...d,
              legacy_status: 'available' as const,
              pendingFoundingRequestId: undefined,
            };
          }
          return d;
        }),
      };
    });
    handleUpdateUniversities(updatedUnis);
  };

  const handleUpdateContentOverride = (newContent: WebsiteContentOverride) => {
    setContentOverride(newContent);
    saveSiteContentToD1(newContent);
  };

  // Role-Based Routing Execution upon Login
  const handleLoginSuccess = (user: UserAccount) => {
    try {
      localStorage.setItem('kohot_current_user', JSON.stringify(user));
    } catch {}

    const incomingAlbums: ClassSet[] = Array.isArray((user as any).albumObjects)
      ? (user as any).albumObjects
      : [];

    if (incomingAlbums.length > 0) {
      setSets((prev) => {
        const map = new Map<string, ClassSet>();
        for (const s of prev) map.set(s.id, s);
        for (const inc of incomingAlbums) {
          if (inc && inc.id) {
            const prevMatch = map.get(inc.id);
            map.set(inc.id, prevMatch ? { ...prevMatch, ...inc } : inc);
          }
        }
        const updated = Array.from(map.values());
        saveStoredSets(updated);
        return updated;
      });
    }

    if (user.role === 'master_host') {
      setCurrentUser(user);
      setAlbumOriginView('layer0_master');
      setActiveView('layer0_master');
      try {
        localStorage.setItem(
          'kohot_active_dashboard_state',
          JSON.stringify({ activeView: 'layer0_master', selectedSetId })
        );
      } catch {}
    } else if (user.role === 'class_rep' && user.assignedSetId) {
      const repSet =
        incomingAlbums.find((s) => s.id === user.assignedSetId) ||
        sets.find(
          (s) =>
            s.id === user.assignedSetId ||
            (user.email && s.classRepEmail?.toLowerCase().trim() === user.email.toLowerCase().trim())
        );
      if (repSet) {
        if (repSet.institutionId || repSet.universityId) {
          setSelectedUniversityId(repSet.institutionId || repSet.universityId!);
        }
        if (repSet.departmentId) {
          setSelectedDepartmentId(repSet.departmentId);
        }
      }
      setCurrentUser(user);
      setAlbumOriginView('layer1_rep');
      setSelectedSetId(user.assignedSetId);
      setActiveView('layer1_rep');
      try {
        localStorage.setItem(
          'kohot_active_dashboard_state',
          JSON.stringify({ activeView: 'layer1_rep', selectedSetId: user.assignedSetId })
        );
      } catch {}
    }

    // Immediately reload D1 data with the newly stored session token so owned draft albums & slot balances are hydrated
    loadAllD1Data();
  };

  const handleLogout = async (explicitSet?: ClassSet) => {
    const wasClassRep = currentUser?.role === 'class_rep' || Boolean(explicitSet);
    const repSet =
      explicitSet ||
      (currentUser?.assignedSetId && sets.find((s) => s.id === currentUser.assignedSetId)) ||
      (currentUser?.email &&
        sets.find((s) => s.classRepEmail?.toLowerCase().trim() === currentUser.email.toLowerCase().trim())) ||
      (selectedSetId && sets.find((s) => s.id === selectedSetId)) ||
      null;
    const targetDeptId = repSet?.departmentId || selectedDepartmentId;
    const targetUniId = repSet?.institutionId || repSet?.universityId || selectedUniversityId;

    try {
      localStorage.removeItem('kohot_current_user');
      localStorage.removeItem('kohot_active_dashboard_state');
    } catch {}

    setCurrentUser(null);

    if (wasClassRep) {
      if (targetUniId) setSelectedUniversityId(targetUniId);
      if (targetDeptId) setSelectedDepartmentId(targetDeptId);
      setAlbumOriginView('albums_grid');
      setActiveView('albums_grid');
      window.history.pushState(
        null,
        '',
        targetDeptId ? `#department/${targetDeptId}` : '#legacy-wall'
      );
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } else {
      setAlbumOriginView('landing');
      setActiveView('landing');
      window.history.pushState(null, '', '#home');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    try {
      await logoutSession();
    } catch {}
  };

  // Registration of new set via strictly unalterable directory
  const handleRegisterSuccess = (newSet: ClassSet, userAccount: UserAccount, newTx: FinancialTransaction) => {
    // 1. Prevent duplicate IDs by checking if set already exists
    const existingIndex = sets.findIndex((s) => s.id === newSet.id);
    let updatedSets: ClassSet[];
    if (existingIndex >= 0) {
      updatedSets = sets.map((s, idx) => (idx === existingIndex ? { ...s, ...newSet, activationStatus: 'active' } : s));
    } else {
      updatedSets = [newSet, ...sets];
    }
    const updatedTxs = [newTx, ...transactions];

    handleUpdateSets(updatedSets);
    handleUpdateTransactions(updatedTxs);

    // 2. Connect new album to the department in universities directory so it appears in the department's albums
    const updatedUnis = universities.map((u) => {
      if (u.id !== newSet.institutionId) return u;
      return {
        ...u,
        departments: (u.departments || []).map((d) => {
          if (
            d.id === newSet.departmentId ||
            d.name.toLowerCase() === newSet.departmentName.toLowerCase() ||
            d.id.includes(newSet.departmentName.toLowerCase().replace(/[^a-z0-9]/g, '-'))
          ) {
            const currentConnected = d.connectedClassAlbumIds || [];
            return {
              ...d,
              legacy_status: 'established' as const,
              connectedClassAlbumIds: currentConnected.includes(newSet.id)
                ? currentConnected
                : [...currentConnected, newSet.id],
            };
          }
          return d;
        }),
      };
    });
    handleUpdateUniversities(updatedUnis);

    // 3. Authenticate as the new class rep and navigate to their dashboard
    setCurrentUser(userAccount);
    setAlbumOriginView('layer1_rep');
    setSelectedSetId(newSet.id);
    setSelectedUniversityId(newSet.institutionId);
    setSelectedDepartmentId(newSet.departmentId);
    setActiveView('layer1_rep');
  };

  // Request an Addition submission
  const handleRequestAddition = (req: DepartmentAdditionRequest) => {
    const updated = [req, ...additionRequests];
    handleUpdateAdditionRequests(updated);
  };

  const currentSet =
    sets.find((s) => s.id === selectedSetId) ||
    (initialRoute.synthesizedSet?.id === selectedSetId ? initialRoute.synthesizedSet : undefined) ||
    sets[0];

  return (
    <FeedbackProvider>
      <div id="kohot-root" className="min-h-screen bg-white dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 selection:bg-[#d4af37]/30 selection:text-black">
      {/* D1 Loading / Error / Version Conflict Status Banner */}
      {versionConflictMessage && (
        <div className="sticky top-0 z-[9999] bg-red-950/95 border-b border-red-500/40 px-4 py-2.5 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono-tech">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{versionConflictMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setVersionConflictMessage(null);
                loadAllD1Data();
              }}
              className="px-3 py-1 rounded-full bg-white text-black font-mono-tech text-[11px] font-bold uppercase flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Reload Latest
            </button>
            <button type="button" onClick={() => setVersionConflictMessage(null)} className="p-1 text-zinc-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {d1Error && (
        <div className="bg-amber-950/90 border-b border-amber-500/30 px-4 py-2 text-amber-200 flex items-center justify-between gap-3 text-xs font-mono-tech">
          <span>Server sync notice: {d1Error}</span>
          <button
            type="button"
            onClick={() => loadAllD1Data()}
            className="px-2.5 py-0.5 rounded bg-amber-400 text-black font-bold uppercase text-[10px] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      {/* Main View Router */}
      <main>
        {activeView === 'landing' && (
          <LandingPage
            sets={sets}
            contentOverride={contentOverride}
            currentUser={currentUser}
            onSelectSet={(id) => {
              const target = sets.find((s) => s.id === id) || CROWNFIELD_PUBLIC_LAW_SETS.find((s) => s.id === id);
              const isCrownfield = id.toLowerCase().includes('crownfield') || target?.institutionId === 'crownfield';
              const label = target?.departmentName 
                ? (target.departmentName.toLowerCase().startsWith('department of') ? target.departmentName : `Department of ${target.departmentName}`)
                : (isCrownfield ? 'Department of Public Law' : (target?.classSetName || 'Department of Computer Science'));
              const inst = target?.institutionName || (isCrownfield ? 'Crownfield University (CU)' : 'University of Lagos');
              setTransitionLabel(label);
              setTransitionInstitution(inst);
              setIsTransitioning(true);
              requestAnimationFrame(() => {
                setSelectedSetId(id);
                setAlbumOriginView('landing');
                setActiveView('department_album');
                window.history.pushState(null, '', `#album-${id}`);
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              });
            }}
            onExploreDemos={() => {
              setIsOnboardingOpen(false);
              setIsLoginOpen(false);
              setSelectedDepartmentId('dept-crownfield-public-law');
              setSelectedUniversityId('crownfield');
              setTransitionLabel('Department of Public Law');
              setTransitionInstitution('Crownfield University (CU)');
              setIsTransitioning(true);
              requestAnimationFrame(() => {
                setActiveView('albums_grid');
                window.history.pushState(null, '', '#demo-albums');
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              });
            }}
            onOpenLogin={() => setIsLoginOpen(true)}
            onOpenOnboarding={() => {
              setVerifiedSignupSession(null);
              setIsOnboardingOpen(true);
            }}
            onOpenDashboard={() => {
              if (currentUser?.role === 'master_host') {
                setActiveView('layer0_master');
              } else if (currentUser?.role === 'class_rep') {
                setActiveView('layer1_rep');
              }
            }}
            onLogout={handleLogout}
          />
        )}

        {activeView === 'student_submit' && currentSet && (
          <StudentSubmissionPage
            currentSet={currentSet}
            onSubmitStudent={(newStudent) => {
              const preparedStudent = {
                ...newStudent,
                approved: false, // Awaiting admin verification in Owner Dashboard
                status: 'pending' as const,
                submissionStatus: 'pending' as const,
              };
              const exists = currentSet.students.some((s) => s.id === preparedStudent.id);
              const updated = {
                ...currentSet,
                students: exists
                  ? currentSet.students.map((s) => (s.id === preparedStudent.id ? preparedStudent : s))
                  : [preparedStudent, ...currentSet.students],
              };
              handleUpdateSingleSet(updated);
            }}
            onViewAlbum={() => {
              setIsOnboardingOpen(false);
              setIsLoginOpen(false);
              setAlbumOriginView('landing');
              setActiveView('department_album');
              window.history.pushState({ view: 'department_album' }, '', `/#album-${currentSet.id}`);
            }}
            onViewDemoAlbums={() => {
              setIsOnboardingOpen(false);
              setIsLoginOpen(false);
              setOnboardingPrefill({});
              if (currentSet?.departmentId) {
                setSelectedDepartmentId(currentSet.departmentId);
              } else {
                setSelectedDepartmentId('dept-unilag-cs');
              }
              if (currentSet?.institutionId) {
                setSelectedUniversityId(currentSet.institutionId);
              } else {
                setSelectedUniversityId('unilag');
              }
              setAlbumOriginView('albums_grid');
              setActiveView('albums_grid');
              window.history.pushState({ fromSubmit: true, view: 'albums_grid' }, '', '/#demo-albums');
            }}
            onBackToHome={() => {
              setIsOnboardingOpen(false);
              setIsLoginOpen(false);
              setActiveView('landing');
              window.history.pushState({ view: 'landing' }, '', '/#home');
            }}
          />
        )}

        {activeView === 'department_album' && currentSet && (
          (() => {
            const effectiveUser = currentUser;

            const isMasterHost = effectiveUser?.role === 'master_host';
            const isClassRep = effectiveUser?.role === 'class_rep';
            const isCurrentAlbumOwner = Boolean(
              effectiveUser && (
                isMasterHost ||
                (isClassRep && (
                  (effectiveUser.assignedSetId && effectiveUser.assignedSetId === currentSet.id) ||
                  (effectiveUser.email && currentSet.classRepEmail && effectiveUser.email.toLowerCase().trim() === currentSet.classRepEmail.toLowerCase().trim())
                ))
              )
            );
            const isViewingOtherAlbum = Boolean(isClassRep && !isCurrentAlbumOwner);
            const isAdminLoggedIn = Boolean(isMasterHost || isClassRep);

            // If the album is soft-deleted or kept by Host only, hide it from public visitors AND the class admin on the public album view (only Master Host can view it)
            if ((currentSet.deletedAt || currentSet.keptByHostOnly) && !isMasterHost) {
              const daysPassed = currentSet.deletedAt
                ? Math.floor((Date.now() - new Date(currentSet.deletedAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              const daysRemaining = Math.max(0, 30 - daysPassed);

              return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-[#08090d] text-white p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <h1 className="font-syne font-bold text-2xl sm:text-3xl mb-3">This album is no longer available</h1>
                  <p className="font-body text-sm text-zinc-400 max-w-md mb-8">
                    {isCurrentAlbumOwner && daysRemaining > 0 && !currentSet.keptByHostOnly
                      ? `This class album has been deleted and hidden from public view. You have ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining to recover it from your Admin Dashboard.`
                      : 'This digital class album has been removed by the department administrator.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {isCurrentAlbumOwner && daysRemaining > 0 && !currentSet.keptByHostOnly && (
                      <button
                        onClick={() => {
                          setSelectedSetId(currentSet.id);
                          setActiveView('layer1_rep');
                        }}
                        className="px-8 py-3.5 rounded-full bg-emerald-500 text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg active:scale-95"
                      >
                        Go to Dashboard to Recover
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setInviteContext(null);
                        setActiveView('landing');
                        window.history.pushState(null, '', '#home');
                        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                      }}
                      className="px-8 py-3.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer shadow-lg active:scale-95"
                    >
                      Return to Home
                    </button>
                  </div>
                </div>
              );
            }

            // Public rule: GET album returns only published albums and public fields; drafts, unpublished and deleted return "not available"
            const isDraftAlbum =
              !isCrownfieldDemoAlbum(currentSet) &&
              (currentSet.lifecycleStatus === 'draft' || (!currentSet.isPublished && !currentSet.published));
            if ((currentSet.isUnpublished || currentSet.unpublished || isDraftAlbum) && !isCurrentAlbumOwner && !isMasterHost) {
              return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-[#08090d] text-white p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <h1 className="font-syne font-bold text-2xl sm:text-3xl mb-3">not available</h1>
                  <p className="font-body text-sm text-zinc-400 max-w-md mb-8">
                    This class album is currently a draft or unpublished and is not available for public viewing.
                  </p>
                  <button
                    onClick={() => {
                      setInviteContext(null);
                      setActiveView('landing');
                      window.history.pushState(null, '', '#home');
                      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    }}
                    className="px-8 py-3.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer shadow-lg active:scale-95"
                  >
                    Return to Home
                  </button>
                </div>
              );
            }

            return (
              <>
                {isMasterHost && currentSet.deletedAt && (() => {
                  const daysPassed = Math.floor((Date.now() - new Date(currentSet.deletedAt).getTime()) / (1000 * 60 * 60 * 24));
                  const daysRemaining = Math.max(0, 30 - daysPassed);
                  return (
                    <div className="sticky top-0 z-[9995] bg-red-950/95 border-b border-red-500/40 px-4 sm:px-6 py-2.5 text-white flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white font-mono-tech text-[10px] uppercase font-bold">
                          Deleted Album (Host View Only)
                        </span>
                        <span className="font-mono-tech text-xs text-red-200">
                          {currentSet.keptByHostOnly
                            ? 'Kept by Host — Permanently retained and visible only to Host'
                            : `Completely purges after 30 days (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextKept = !currentSet.keptByHostOnly;
                          handleUpdateSingleSet({
                            ...currentSet,
                            keptByHostOnly: nextKept,
                            keptByHostAt: nextKept ? new Date().toISOString() : undefined,
                          });
                        }}
                        className={`px-3.5 py-1 rounded-full font-mono-tech text-[11px] uppercase font-bold transition-colors cursor-pointer border ${
                          currentSet.keptByHostOnly
                            ? 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300'
                            : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                        }`}
                      >
                        {currentSet.keptByHostOnly ? '✓ Kept (Host Only)' : 'Keep Album (Host Only)'}
                      </button>
                    </div>
                  );
                })()}
                <DepartmentAlbumView
                  currentSet={currentSet}
                  originView={albumOriginView}
                  inviteContext={inviteContext}
                  onBackToGrid={() => {
                    setInviteContext(null);
                    if (currentSet.departmentId) setSelectedDepartmentId(currentSet.departmentId);
                    const effectiveUniId = currentSet.institutionId || (currentSet as any).universityId;
                    if (effectiveUniId) setSelectedUniversityId(effectiveUniId);
                    setActiveView('albums_grid');
                    window.history.pushState(null, '', currentSet.departmentId ? `#department/${currentSet.departmentId}` : '#legacy-wall');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  onBackToLanding={() => {
                    if (isAdminLoggedIn) return;
                    setInviteContext(null);
                    setActiveView('landing');
                    window.history.pushState(null, '', '#home');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  onUpdateSet={(updated) => {
                    handleUpdateSingleSet(updated);
                  }}
                  onManageAlbum={
                    isAdminLoggedIn
                      ? () => {
                          if (isViewingOtherAlbum && effectiveUser?.assignedSetId) {
                            setSelectedSetId(effectiveUser.assignedSetId);
                          } else {
                            setSelectedSetId(currentSet.id);
                          }
                          setActiveView('layer1_rep');
                        }
                      : undefined
                  }
                  onMainDashboard={() => {
                    if (isMasterHost) {
                      setActiveView('layer0_master');
                    }
                  }}
                  showMainButton={Boolean(isMasterHost)}
                  universities={universities}
                  onReturnToMyAlbum={() => {
                    if (currentUser?.assignedSetId) {
                      setSelectedSetId(currentUser.assignedSetId);
                    }
                  }}
                  isAdmin={isAdminLoggedIn}
                  isCurrentAlbumOwner={isCurrentAlbumOwner}
                  isViewingOtherAlbum={isViewingOtherAlbum}
                />
              </>
            );
          })()
        )}

        {activeView === 'albums_grid' && (
          <AlbumsGrid
            universities={universities}
            sets={sets}
            contentOverride={contentOverride}
            currentUser={currentUser}
            selectedUniversityId={selectedUniversityId}
            selectedDepartmentId={selectedDepartmentId}
            onSelectUniversity={setSelectedUniversityId}
            onSelectDepartment={setSelectedDepartmentId}
            inviteContext={inviteContext}
            onOpenOnboardingWithInvite={handleOpenOnboardingWithInvite}
            onUpdateSet={handleUpdateSingleSet}
            onSelectSet={(id) => {
              const selected = sets.find((s) => s.id === id);
              if (selected) {
                if (selected.institutionId) setSelectedUniversityId(selected.institutionId);
                if (selected.departmentId) setSelectedDepartmentId(selected.departmentId);
              }
              // Direct instant entry into album from legacy wall without logo load animation
              setSelectedSetId(id);
              setAlbumOriginView(
                currentUser?.role === 'master_host'
                  ? 'layer0_master'
                  : currentUser?.role === 'class_rep'
                  ? 'layer1_rep'
                  : 'albums_grid'
              );
              setActiveView('department_album');
              if (inviteContext) {
                window.history.pushState(null, '', `?next_class_invite=${inviteContext.inviteCode}&dept=${inviteContext.departmentId}&year=${inviteContext.targetYear}&from_year=${inviteContext.fromYear}#album-${id}`);
              } else {
                window.history.pushState(null, '', `#album-${id}`);
              }
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            onOpenOnboarding={(ctx) => {
              setVerifiedSignupSession(null);
              if (ctx && (ctx.universityId || ctx.departmentId || ctx.departmentName)) {
                setOnboardingPrefill({
                  universityId: ctx.universityId || selectedUniversityId || undefined,
                  departmentId: ctx.departmentId || selectedDepartmentId || undefined,
                  departmentName: ctx.departmentName,
                  graduationYear: ctx.graduationYear,
                  lockDepartmentContext: true,
                });
              } else if (selectedUniversityId || selectedDepartmentId) {
                const matchedDept = universities
                  .flatMap((u) => u.departments || [])
                  .find((d) => d.id === selectedDepartmentId);
                setOnboardingPrefill({
                  universityId: selectedUniversityId || matchedDept?.universityId || undefined,
                  departmentId: selectedDepartmentId || undefined,
                  departmentName: matchedDept?.name || undefined,
                  lockDepartmentContext: Boolean(selectedDepartmentId),
                });
              }
              setIsOnboardingOpen(true);
            }}
            onOpenLogin={() => setIsLoginOpen(true)}
            onOpenDashboard={() => {
              if (currentUser?.role === 'master_host') {
                setActiveView('layer0_master');
              } else if (currentUser?.role === 'class_rep') {
                setActiveView('layer1_rep');
              }
            }}
            onLogout={handleLogout}
            onBackToLanding={() => {
              setInviteContext(null);
              setActiveView('landing');
              window.history.pushState(null, '', '#home');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            showMainButton={Boolean(currentUser?.role === 'master_host')}
            onMainDashboard={() => setActiveView('layer0_master')}
            onOpenPublicDirectory={() => {
              setActiveView('public_directory');
              window.history.pushState(null, '', '#directory');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
          />
        )}

        {activeView === 'public_directory' && (
          <PublicDirectoryView
            sets={sets}
            universities={universities}
            contentOverride={contentOverride}
            onSelectAlbum={(albumId) => {
              const selected = sets.find((s) => s.id === albumId);
              if (selected) {
                if (selected.institutionId) setSelectedUniversityId(selected.institutionId);
                if (selected.departmentId) setSelectedDepartmentId(selected.departmentId);
              }
              setSelectedSetId(albumId);
              setAlbumOriginView('albums_grid');
              setActiveView('department_album');
              window.history.pushState(null, '', `#album-${albumId}`);
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            onBack={() => {
              setActiveView('albums_grid');
              window.history.pushState(null, '', '#legacy-wall');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
          />
        )}

        {activeView === 'layer1_rep' && (
          currentUser ? (
            (() => {
              let activeSetForRep: ClassSet = currentSet;
              if (currentUser.role === 'class_rep') {
                const matchedSet = sets.find(
                  (s) =>
                    !isCrownfieldDemoAlbum(s) &&
                    ((currentUser.assignedSetId && s.id === currentUser.assignedSetId) ||
                      (currentUser.email &&
                        s.classRepEmail?.toLowerCase().trim() === currentUser.email.toLowerCase().trim()))
                );
                if (matchedSet) {
                  activeSetForRep = matchedSet;
                } else {
                  // Never fall back a real Class Admin to a Crownfield Demo Album while D1 is loading
                  const assignedId = currentUser.assignedSetId || 'draft-album';
                  const matchedUni =
                    universities.find((u) => assignedId.startsWith(`${u.id}-`)) ||
                    universities.find((u) => u.id === selectedUniversityId) ||
                    universities[0];
                  const matchedDept =
                    matchedUni?.departments?.find((d) =>
                      assignedId.includes(d.id.replace(/^dept-/, ''))
                    ) ||
                    matchedUni?.departments?.find((d) => d.id === selectedDepartmentId) ||
                    matchedUni?.departments?.[0];
                  const yearMatch = assignedId.match(/(20\d{2})$/);
                  const resolvedYear = yearMatch ? Number(yearMatch[1]) : 2026;
                  activeSetForRep = {
                    id: assignedId,
                    institutionId: matchedUni?.id || 'unilorin',
                    institutionName: matchedUni?.name || 'University of Ilorin',
                    institutionLogoUrl: matchedUni?.logoUrl || '',
                    departmentId: matchedDept?.id || 'dept-unilorin-pubadmin',
                    departmentName: matchedDept?.name || 'Public Administration',
                    departmentLogoUrl: matchedDept?.logoUrl || matchedUni?.logoUrl || '',
                    faculty: matchedDept?.faculty || 'Faculty of Management Sciences',
                    graduationYear: resolvedYear,
                    classSetName: `${matchedDept?.name || 'Department'} Class of '${String(resolvedYear).slice(-2)}`,
                    academicYears: 4,
                    classRepName: currentUser.fullName || 'Class Representative',
                    classRepEmail: currentUser.email,
                    classRepPhone: currentUser.phone || '',
                    currentAdminUserId: currentUser.id,
                    activationStatus: 'inactive',
                    activationDate: '',
                    activationRef: '',
                    isPublished: false,
                    published: false,
                    isUnpublished: false,
                    unpublished: false,
                    bannerImageUrl:
                      matchedDept?.heroImageUrl ||
                      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
                    legacyGroupImageUrl:
                      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
                    ourStory: '',
                    students: [],
                    memories: [],
                    awards: [],
                    voices: [],
                  };
                }
              }

              return (
                <Layer1ClassRepDashboard
                  currentUser={currentUser}
                  currentSet={activeSetForRep}
                  contentOverride={contentOverride}
                  onUpdateSet={handleUpdateSingleSet}
                  onViewAlbum={() => {
                    setSelectedSetId(activeSetForRep.id);
                    setAlbumOriginView(currentUser.role === 'master_host' ? 'layer0_master' : 'layer1_rep');
                    setActiveView('department_album');
                  }}
                  onSwitchRole={() => handleLogout(activeSetForRep)}
                  onBackToLanding={() => {
                    if (currentUser.role === 'master_host') {
                      setActiveView('layer0_master');
                    }
                  }}
                  onMainDashboard={() => {
                    if (currentUser.role === 'master_host') {
                      setActiveView('layer0_master');
                    }
                  }}
                  showMainButton={Boolean(currentUser.role === 'master_host')}
                />
              );
            })()
          ) : (
            <LandingPage
              onSelectSet={(setId) => {
                setSelectedSetId(setId);
                setAlbumOriginView('landing');
                setActiveView('department_album');
              }}
              onOpenOnboarding={() => setIsOnboardingOpen(true)}
              onOpenLogin={() => setIsLoginOpen(true)}
              onOpenDashboard={() => {}}
              onLogout={handleLogout}
              contentOverride={contentOverride}
              currentUser={null}
              sets={sets}
            />
          )
        )}

        {activeView === 'layer0_master' && (
          currentUser && currentUser.role === 'master_host' ? (
            <Layer0MasterHostDashboard
              currentUser={currentUser}
              universities={universities}
              sets={sets}
              transactions={transactions}
              additionRequests={additionRequests}
              foundingRequests={foundingRequests}
              contentOverride={contentOverride}
              onUpdateUniversities={handleUpdateUniversities}
              onUpdateContentOverride={handleUpdateContentOverride}
              onUpdateAdditionRequests={handleUpdateAdditionRequests}
              onApproveFoundingRequest={handleApproveFoundingRequest}
              onRejectFoundingRequest={handleRejectFoundingRequest}
              onViewDepartmentAlbum={(id) => {
                const selected = sets.find((s) => s.id === id);
                if (selected) {
                  if (selected.institutionId) setSelectedUniversityId(selected.institutionId);
                  if (selected.departmentId) setSelectedDepartmentId(selected.departmentId);
                }
                setSelectedSetId(id);
                setAlbumOriginView('layer0_master');
                setActiveView('department_album');
              }}
              onEditDemoAlbum={(id) => {
                setSelectedSetId(id);
                setAlbumOriginView('layer0_master');
                setActiveView('layer1_rep');
              }}
              onUpdateSingleSet={handleUpdateSingleSet}
              onViewDepartmentLegacyWall={(deptId, uniId) => {
                setSelectedDepartmentId(deptId);
                if (uniId) setSelectedUniversityId(uniId);
                setAlbumOriginView('layer0_master');
                setActiveView('albums_grid');
              }}
              onSwitchRole={() => handleLogout()}
            />
          ) : (
            <LandingPage
              onSelectSet={(setId) => {
                setSelectedSetId(setId);
                setAlbumOriginView('landing');
                setActiveView('department_album');
              }}
              onOpenOnboarding={() => setIsOnboardingOpen(true)}
              onOpenLogin={() => setIsLoginOpen(true)}
              onOpenDashboard={() => {}}
              onLogout={handleLogout}
              contentOverride={contentOverride}
              currentUser={null}
              sets={sets}
            />
          )
        )}
      </main>

      {/* Cinematic KoHot Slow-Motion Transition Screen for QR Codes, Links, and Navigation */}
      <KoHotTransitionScreen
        isVisible={isTransitioning}
        destinationLabel={transitionLabel}
        institutionLabel={transitionInstitution}
        onTransitionEnd={() => setIsTransitioning(false)}
      />

      {/* Role-Based Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        availableSets={sets}
        onLoginSuccess={handleLoginSuccess}
        onOpenRegister={(session) => {
          setIsLoginOpen(false);
          setVerifiedSignupSession(session || null);
          setIsOnboardingOpen(true);
        }}
        logoUrl={contentOverride?.websiteLogoUrl}
        brandName={contentOverride?.brandName || 'KOHOT'}
      />

      {/* Class Rep Onboarding Modal (Unalterable Directory + Request Addition) */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => {
          setIsOnboardingOpen(false);
          setVerifiedSignupSession(null);
          setOnboardingPrefill({});
        }}
        universities={universities}
        sets={sets}
        foundingRequests={foundingRequests}
        currentUser={currentUser}
        verifiedSignupSession={verifiedSignupSession}
        inviteContext={inviteContext}
        onLoginSuccess={handleLoginSuccess}
        onOpenLogin={() => {
          setIsOnboardingOpen(false);
          setIsLoginOpen(true);
        }}
        initialUniversityId={onboardingPrefill.universityId || selectedUniversityId || undefined}
        initialDepartmentId={(onboardingPrefill as any).departmentId || selectedDepartmentId || undefined}
        initialDepartmentName={
          onboardingPrefill.departmentName ||
          universities
            .flatMap((u) => u.departments || [])
            .find((d) => d.id === ((onboardingPrefill as any).departmentId || selectedDepartmentId))?.name || undefined
        }
        initialGraduationYear={onboardingPrefill.graduationYear}
        lockDepartmentContext={Boolean((onboardingPrefill as any).lockDepartmentContext)}
        onRegisterSuccess={handleRegisterSuccess}
        onRequestAddition={handleRequestAddition}
        onSubmitFoundingRequest={handleSubmitFoundingRequest}
        logoUrl={contentOverride?.websiteLogoUrl}
        brandName={contentOverride?.brandName || 'KOHOT'}
      />

        {/* Persistent Back to Top Arrow Button */}
        <BackToTopButton />
      </div>
    </FeedbackProvider>
  );
}
