import React, { useState, useEffect } from 'react';
import { 
  ClassSet, 
  UniversityDirectoryItem, 
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
  saveStoredContentOverride 
} from './data/initialData';
import { DepartmentAlbumView } from './components/public/DepartmentAlbumView';
import { AlbumsGrid } from './components/public/AlbumsGrid';
import { LandingPage } from './components/public/LandingPage';
import { LoginModal } from './components/auth/LoginModal';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { Layer0MasterHostDashboard } from './components/admin/Layer0MasterHostDashboard';
import { Layer1ClassRepDashboard } from './components/admin/Layer1ClassRepDashboard';
import { RoleSwitchDock } from './components/common/RoleSwitchDock';
import { StudentSubmissionPage } from './components/public/StudentSubmissionPage';
import { KoHotTransitionScreen } from './components/common/KoHotTransitionScreen';
import { BackToTopButton } from './components/common/BackToTopButton';
import { FeedbackProvider } from './components/common/FeedbackSystem';
import { resolveOrSynthesizeSet } from './utils/urlHelper';
import { getTheme, applyTheme } from './utils/theme';
import { forceUnlockAllScroll } from './utils/useStaticBackdropScrollLock';
import { AlertTriangle, X } from 'lucide-react';

interface ResolvedRoute {
  view: 'landing' | 'albums_grid' | 'department_album' | 'layer1_rep' | 'layer0_master' | 'student_submit';
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

  // 0. Explicit Demo Legacy Wall / All Albums Directory: #demo-albums, #albums, #legacy-wall, #directory
  if (
    hash === '#demo-albums' ||
    hash === '#albums' ||
    hash === '#legacy-wall' ||
    hash === '#directory' ||
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

  // 3. Department Legacy Plaque QR Scan or Link: #dept-[deptId] or ?dept=... or /dept/... or ?plaque=... or ?scan=...
  if (hash.includes('dept-') || search.includes('dept') || pathname.includes('/dept') || search.includes('plaque') || search.includes('scan')) {
    let deptId: string | null = null;
    const pathMatch = pathname.match(/\/dept\/([a-zA-Z0-9_-]+)/);
    if (hash.includes('dept-')) {
      deptId = hash.replace(/^#/, '').replace(/^dept-/, '');
    } else if (pathMatch && pathMatch[1]) {
      deptId = pathMatch[1];
    } else {
      const params = new URLSearchParams(search);
      deptId = params.get('dept') || params.get('plaque') || params.get('scan');
    }

    if (deptId) {
      const parentUni = currentUnis.find((u) =>
        u.departments?.some((d) => d.id === deptId || d.code.toLowerCase() === deptId?.toLowerCase())
      );
      const targetSet = currentSets.find((s) => s.departmentId === deptId);
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

      if (targetSet) {
        return {
          view: 'department_album',
          setId: targetSet.id,
          uniId: parentUni ? parentUni.id : targetSet.institutionId || null,
          deptId: deptId,
          isExternalEntry: true,
          label: targetSet.classSetName || `${targetSet.departmentName} ’${String(targetSet.graduationYear).slice(-2)}`,
        };
      }
      return {
        view: 'albums_grid',
        setId: currentSets[0]?.id || 'unilag-cs-2026',
        uniId: parentUni ? parentUni.id : null,
        deptId: deptId,
        isExternalEntry: true,
        label: parentUni ? `DEPARTMENT OF ${deptId.toUpperCase()}` : 'DEPARTMENT OF COMPUTER SCIENCE',
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

  // App persistent state
  const [universities, setUniversities] = useState<UniversityDirectoryItem[]>(getStoredUniversities);
  const [sets, setSets] = useState<ClassSet[]>(() => {
    const stored = getStoredSets();
    if (initialRoute.synthesizedSet && !stored.some((s) => s.id === initialRoute.synthesizedSet!.id)) {
      return [initialRoute.synthesizedSet, ...stored];
    }
    return stored;
  });
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(getStoredTransactions);
  const [additionRequests, setAdditionRequests] = useState<DepartmentAdditionRequest[]>(getStoredAdditionRequests);
  const [foundingRequests, setFoundingRequests] = useState<FoundingClassRequest[]>(getStoredFoundingClassRequests);
  const [contentOverride, setContentOverride] = useState<WebsiteContentOverride>(getStoredContentOverride);

  // Invitation context for Next Class baton handover
  const [inviteContext, setInviteContext] = useState<NextClassInviteContext | null>(parseInviteContextFromUrl);
  const [onboardingPrefill, setOnboardingPrefill] = useState<{
    universityId?: string;
    departmentName?: string;
    graduationYear?: number;
  }>({});

  // Authentication & Role-Based Routing
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeView, setActiveView] = useState<'landing' | 'albums_grid' | 'department_album' | 'layer1_rep' | 'layer0_master' | 'student_submit'>(
    initialRoute.view
  );
  const [albumOriginView, setAlbumOriginView] = useState<'landing' | 'albums_grid' | 'layer0_master' | 'layer1_rep'>('landing');
  const [selectedSetId, setSelectedSetId] = useState<string>(initialRoute.setId);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(initialRoute.uniId);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(initialRoute.deptId);

  // The KoHot logo splash screen triggers on external links / initial deep links
  const [isTransitioning, setIsTransitioning] = useState<boolean>(initialRoute.isExternalEntry);
  const [transitionLabel, setTransitionLabel] = useState<string>(initialRoute.label || 'Department of Computer Science');
  const [transitionInstitution, setTransitionInstitution] = useState<string>('University Of Ilorin');

  const hasMountedRef = React.useRef(false);

  useEffect(() => {
    hasMountedRef.current = true;
    // Apply user theme on startup (default is light mode)
    applyTheme(getTheme());
  }, []);

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
      const hasActiveModal = document.querySelector('[role="dialog"], [aria-modal="true"], #student-detail-modal-backdrop, #moments-fullscreen-lightbox');
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
  }, [sets, universities]);

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

  // Save changes to storage
  const handleUpdateUniversities = (newUnis: UniversityDirectoryItem[]) => {
    setUniversities(newUnis);
    saveStoredUniversities(newUnis);
  };

  const handleUpdateSets = (newSets: ClassSet[]) => {
    setSets(newSets);
    saveStoredSets(newSets);
  };

  const handleUpdateSingleSet = (updatedSet: ClassSet) => {
    const updated = sets.map((s) => (s.id === updatedSet.id ? updatedSet : s));
    setSets(updated);
    saveStoredSets(updated);
  };

  const handleUpdateTransactions = (newTxs: FinancialTransaction[]) => {
    setTransactions(newTxs);
    saveStoredTransactions(newTxs);
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
        ourStory: `As the verified Founding Class of ${req.departmentName}, we established the permanent KoHot Legacy and campus plaque for generations to follow.`,
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
    saveStoredContentOverride(newContent);
  };

  // Role-Based Routing Execution upon Login
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);

    if (user.role === 'master_host') {
      // Seamlessly redirect token-verified administrators to hidden Layer 0 Master Host Dashboard
      setActiveView('layer0_master');
    } else if (user.role === 'class_rep') {
      // Redirect standard Class Representatives to their Layer 1 Admin Dashboard to manage their specific set
      if (user.assignedSetId) {
        setSelectedSetId(user.assignedSetId);
      }
      setActiveView('layer1_rep');
    } else {
      setActiveView('albums_grid');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('landing');
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

  // Quick Role Switching simulation
  const handleSelectRole = (role: UserRole) => {
    if (role === 'master_host') {
      const masterUser: UserAccount = {
        id: 'usr-master',
        email: 'host@kohot.app',
        fullName: 'Master Host Administrator',
        role: 'master_host',
        masterToken: 'KOHOT-ROOT-2025',
      };
      setCurrentUser(masterUser);
      setActiveView('layer0_master');
    } else if (role === 'class_rep') {
      const defaultRepSet = sets[0];
      const repUser: UserAccount = {
        id: `rep-${defaultRepSet.id}`,
        email: defaultRepSet.classRepEmail,
        fullName: defaultRepSet.classRepName,
        role: 'class_rep',
        assignedSetId: defaultRepSet.id,
      };
      setCurrentUser(repUser);
      setSelectedSetId(defaultRepSet.id);
      setActiveView('layer1_rep');
    } else {
      setCurrentUser(null);
      setActiveView('landing');
    }
  };

  const currentSet =
    sets.find((s) => s.id === selectedSetId) ||
    (initialRoute.synthesizedSet?.id === selectedSetId ? initialRoute.synthesizedSet : undefined) ||
    sets[0];

  return (
    <FeedbackProvider>
      <div id="kohot-root" className="min-h-screen bg-white dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 selection:bg-[#d4af37]/30 selection:text-black">
      {/* Main View Router */}
      <main>
        {activeView === 'landing' && (
          <LandingPage
            sets={sets}
            contentOverride={contentOverride}
            currentUser={currentUser}
            onSelectSet={(id) => {
              const target = sets.find((s) => s.id === id);
              const label = target?.departmentName 
                ? (target.departmentName.toLowerCase().startsWith('department of') ? target.departmentName : `Department of ${target.departmentName}`)
                : (target?.classSetName || 'Department of Computer Science');
              const inst = target?.institutionName || 'University Of Ilorin';
              setTransitionLabel(label);
              setTransitionInstitution(inst);
              setIsTransitioning(true);
              setTimeout(() => {
                setSelectedSetId(id);
                setAlbumOriginView('landing');
                setActiveView('department_album');
                window.history.pushState(null, '', `#album-${id}`);
              }, 3000);
            }}
            onExploreDemos={() => {
              setIsOnboardingOpen(false);
              setIsLoginOpen(false);
              setSelectedDepartmentId('dept-unilag-cs');
              setSelectedUniversityId('unilag');
              const csSet = sets.find((s) => s.departmentId === 'dept-unilag-cs');
              const deptName = csSet?.departmentName || 'Computer Science';
              setTransitionLabel(deptName.toLowerCase().startsWith('department of') ? deptName : `Department of ${deptName}`);
              setTransitionInstitution(csSet?.institutionName || 'University Of Ilorin');
              setIsTransitioning(true);
              setTimeout(() => {
                setActiveView('albums_grid');
                window.history.pushState(null, '', '#demo-albums');
              }, 3000);
            }}
            onOpenLogin={() => setIsLoginOpen(true)}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
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
              };
              const updated = {
                ...currentSet,
                students: [preparedStudent, ...currentSet.students],
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
            const isMasterHost = currentUser?.role === 'master_host';
            const isClassRep = currentUser?.role === 'class_rep';
            const isCurrentAlbumOwner = Boolean(
              currentUser && (
                isMasterHost ||
                (isClassRep && (
                  (currentUser.assignedSetId && currentUser.assignedSetId === currentSet.id) ||
                  (currentUser.email && currentSet.classRepEmail && currentUser.email.toLowerCase().trim() === currentSet.classRepEmail.toLowerCase().trim())
                ))
              )
            );
            const isViewingOtherAlbum = Boolean(isClassRep && !isCurrentAlbumOwner);
            const isAdminLoggedIn = Boolean(isMasterHost || isClassRep);

            return (
              <DepartmentAlbumView
                currentSet={currentSet}
                originView={albumOriginView}
                inviteContext={inviteContext}
                onBackToGrid={() => {
                  setInviteContext(null);
                  if (currentSet.departmentId) setSelectedDepartmentId(currentSet.departmentId);
                  if (currentSet.universityId) setSelectedUniversityId(currentSet.universityId);
                  setActiveView('albums_grid');
                  window.history.pushState(null, '', currentSet.departmentId ? `#department/${currentSet.departmentId}` : '#legacy-wall');
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                }}
                onBackToLanding={() => {
                  setInviteContext(null);
                  setActiveView('landing');
                  window.history.pushState(null, '', '#home');
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                }}
                onUpdateSet={(updated) => {
                  if (isCurrentAlbumOwner) {
                    handleUpdateSingleSet(updated);
                  }
                }}
                onManageAlbum={() => {
                  if (isViewingOtherAlbum && currentUser?.assignedSetId) {
                    setSelectedSetId(currentUser.assignedSetId);
                  }
                  // Return directly to the album management/editing dashboard
                  setActiveView('layer1_rep');
                }}
                onMainDashboard={() => {
                  setActiveView('layer0_master');
                }}
                showMainButton={Boolean(isMasterHost && albumOriginView === 'layer0_master')}
                onReturnToMyAlbum={() => {
                  if (currentUser?.assignedSetId) {
                    setSelectedSetId(currentUser.assignedSetId);
                  }
                }}
                isAdmin={isAdminLoggedIn}
                isCurrentAlbumOwner={isCurrentAlbumOwner}
                isViewingOtherAlbum={isViewingOtherAlbum}
              />
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
            onSelectSet={(id) => {
              const selected = sets.find((s) => s.id === id);
              if (selected) {
                if (selected.institutionId) setSelectedUniversityId(selected.institutionId);
                if (selected.departmentId) setSelectedDepartmentId(selected.departmentId);
              }
              // Direct instant entry into album from legacy wall without logo load animation
              setSelectedSetId(id);
              setAlbumOriginView('albums_grid');
              setActiveView('department_album');
              if (inviteContext) {
                window.history.pushState(null, '', `?next_class_invite=${inviteContext.inviteCode}&dept=${inviteContext.departmentId}&year=${inviteContext.targetYear}&from_year=${inviteContext.fromYear}#album-${id}`);
              } else {
                window.history.pushState(null, '', `#album-${id}`);
              }
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
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
          />
        )}

        {activeView === 'layer1_rep' && (
          (() => {
            const activeSetForRep = (currentUser?.role === 'class_rep' && currentUser.assignedSetId)
              ? (sets.find((s) => s.id === currentUser.assignedSetId) || currentSet)
              : currentSet;

            return (
              <Layer1ClassRepDashboard
                currentUser={currentUser || {
                  id: 'rep-fallback',
                  email: activeSetForRep.classRepEmail,
                  fullName: activeSetForRep.classRepName,
                  role: 'class_rep',
                  assignedSetId: activeSetForRep.id,
                }}
                currentSet={activeSetForRep}
                contentOverride={contentOverride}
                onUpdateSet={handleUpdateSingleSet}
                onViewAlbum={() => {
                  setSelectedSetId(activeSetForRep.id);
                  setAlbumOriginView(albumOriginView === 'layer0_master' ? 'layer0_master' : 'layer1_rep');
                  setActiveView('department_album');
                }}
                onSwitchRole={(role) => handleSelectRole(role)}
                onBackToLanding={() => {
                  if (albumOriginView === 'layer0_master' || currentUser?.role === 'master_host') {
                    setActiveView('layer0_master');
                  } else {
                    setActiveView('landing');
                  }
                }}
                onMainDashboard={() => {
                  setActiveView('layer0_master');
                }}
                showMainButton={Boolean(albumOriginView === 'layer0_master' || currentUser?.role === 'master_host')}
              />
            );
          })()
        )}

        {activeView === 'layer0_master' && (
          <Layer0MasterHostDashboard
            currentUser={currentUser || {
              id: 'usr-master',
              email: 'host@kohot.app',
              fullName: 'Master Host Overseer',
              role: 'master_host',
              masterToken: 'KOHOT-ROOT-2025',
            }}
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
              const targetSet = sets.find((s) => s.departmentId === deptId);
              const deptName = targetSet?.departmentName || 'Computer Science';
              setTransitionLabel(deptName.toLowerCase().startsWith('department of') ? deptName : `Department of ${deptName}`);
              setTransitionInstitution(targetSet?.institutionName || 'University Of Ilorin');
              setIsTransitioning(true);
              setTimeout(() => {
                setActiveView('albums_grid');
              }, 3000);
            }}
            onSwitchRole={(role) => handleSelectRole(role)}
          />
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
      />

      {/* Class Rep Onboarding Modal (Unalterable Directory + Request Addition) */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => {
          setIsOnboardingOpen(false);
          setOnboardingPrefill({});
        }}
        universities={universities}
        sets={sets}
        foundingRequests={foundingRequests}
        currentUser={currentUser}
        inviteContext={inviteContext}
        onLoginSuccess={handleLoginSuccess}
        onOpenLogin={() => {
          setIsOnboardingOpen(false);
          setIsLoginOpen(true);
        }}
        initialUniversityId={onboardingPrefill.universityId || selectedUniversityId || undefined}
        initialDepartmentName={
          onboardingPrefill.departmentName ||
          universities
            .flatMap((u) => u.departments || [])
            .find((d) => d.id === selectedDepartmentId)?.name || undefined
        }
        initialGraduationYear={onboardingPrefill.graduationYear}
        onRegisterSuccess={handleRegisterSuccess}
        onRequestAddition={handleRequestAddition}
        onSubmitFoundingRequest={handleSubmitFoundingRequest}
      />

        {/* Persistent Back to Top Arrow Button */}
        <BackToTopButton />
      </div>
    </FeedbackProvider>
  );
}
