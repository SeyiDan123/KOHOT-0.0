import React, { useState, useEffect, useMemo } from 'react';
import { 
  UniversityDirectoryItem, 
  ClassSet, 
  DepartmentAdditionRequest, 
  FoundingClassRequest,
  FinancialTransaction, 
  UserAccount,
  NextClassInviteContext,
  DepartmentItem
} from '../../types';
import { 
  X, 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  Sparkles, 
  Send, 
  Search,
  Check,
  CreditCard,
  Clock,
  Phone,
  HelpCircle,
  Loader2,
  Mail,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { AlbumAdminHelpModal } from '../admin/AlbumAdminHelpModal';
import {
  authenticateWithOAuthPayload,
  requestGoogleSignupToken,
  createFreeAlbumOnD1,
} from '../../utils/apiClient';
import {
  triggerGoogleOAuthPopup,
  triggerAppleOAuthPopup,
  OAuthVerifyPayload,
} from '../../utils/firebaseAuth';
import { VerifiedSignupSession } from '../auth/LoginModal';
import { GoogleAccountChooserModal } from '../auth/GoogleAccountChooserModal';
import { AppleAccountChooserModal } from '../auth/AppleAccountChooserModal';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  foundingRequests?: FoundingClassRequest[];
  currentUser?: UserAccount | null;
  verifiedSignupSession?: VerifiedSignupSession | null;
  inviteContext?: NextClassInviteContext | null;
  onLoginSuccess?: (user: UserAccount) => void;
  onOpenLogin?: () => void;
  initialUniversityId?: string;
  initialDepartmentName?: string;
  initialGraduationYear?: number;
  onRegisterSuccess: (newSet: ClassSet, userAccount: UserAccount, tx: FinancialTransaction) => void;
  onSubmitFoundingRequest: (req: FoundingClassRequest) => void;
  onRequestAddition: (req: DepartmentAdditionRequest) => void;
  logoUrl?: string;
  brandName?: string;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const STEPS_CONFIG = [
  { step: 1, title: 'Sign Up', desc: 'Verified Account' },
  { step: 2, title: 'Class', desc: 'Cohort Details' },
  { step: 3, title: 'Album Admin', desc: 'Applicant Authority' },
  { step: 4, title: 'Backup Contact', desc: 'Recovery Continuity' },
  { step: 5, title: 'Review & Create', desc: 'Instant Draft Access' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  universities = [],
  sets = [],
  foundingRequests = [],
  verifiedSignupSession = null,
  inviteContext = null,
  onLoginSuccess,
  initialUniversityId,
  initialDepartmentName,
  initialGraduationYear,
  onRegisterSuccess,
  onSubmitFoundingRequest,
  onRequestAddition,
  logoUrl,
  brandName = 'KOHOT',
}) => {
  useStaticBackdropScrollLock(isOpen);

  // Step State
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);

  // Step 1: Admin Account Details (Verified via Google or Apple)
  const [adminFullName, setAdminFullName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPhone, setAdminPhone] = useState<string>('');
  const [isGoogleVerified, setIsGoogleVerified] = useState<boolean>(false);
  const [verifiedProvider, setVerifiedProvider] = useState<'google' | 'apple'>('google');
  const [signupToken, setSignupToken] = useState<string>('');
  const [activeOAuthProvider, setActiveOAuthProvider] = useState<'google' | 'apple' | null>(null);
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);
  const [isAppleChooserOpen, setIsAppleChooserOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const [existingAdminAccount, setExistingAdminAccount] = useState<UserAccount | null>(null);

  // Determine if this is a Subsequent Class Relay Handover path
  const isRelayMode = Boolean(inviteContext && inviteContext.inviteCode);

  // Step 2: Class Details - fed strictly from Universities Directory
  const [selectedUniId, setSelectedUniId] = useState<string>(
    inviteContext?.universityId || initialUniversityId || universities[0]?.id || ''
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string>(
    initialDepartmentName || ''
  );

  // Search states for dropdowns
  const [uniSearchQuery, setUniSearchQuery] = useState('');
  const [isUniDropdownOpen, setIsUniDropdownOpen] = useState(false);
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

  const lockedRelayYear = inviteContext ? inviteContext.targetYear : undefined;

  // Sorted institutions: Priority ones first, then regular order
  const sortedInstitutions = useMemo(() => {
    return [...universities].sort((a, b) => {
      const aPriority = a.isPriority ? 1 : 0;
      const bPriority = b.isPriority ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (a.orderNumber || 99) - (b.orderNumber || 99);
    });
  }, [universities]);

  // Current Institution
  const currentUni = useMemo(() => {
    return sortedInstitutions.find((u) => u.id === selectedUniId) || sortedInstitutions[0];
  }, [sortedInstitutions, selectedUniId]);

  // Sync selectedUniId if empty
  useEffect(() => {
    if (!selectedUniId && sortedInstitutions.length > 0) {
      setSelectedUniId(sortedInstitutions[0].id);
    }
  }, [sortedInstitutions, selectedUniId]);

  // Filtered institutions for search dropdown
  const filteredInstitutions = useMemo(() => {
    const q = uniSearchQuery.trim().toLowerCase();
    if (!q) return sortedInstitutions;
    return sortedInstitutions.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.shortCode.toLowerCase().includes(q) ||
        (u.institutionType && u.institutionType.toLowerCase().includes(q))
    );
  }, [sortedInstitutions, uniSearchQuery]);

  // Available departments in current institution (strictly from directory, no hardcoded fallback)
  const availableDepartments: DepartmentItem[] = useMemo(() => {
    if (!currentUni || !currentUni.departments) return [];
    return currentUni.departments;
  }, [currentUni]);

  // Filtered departments for search dropdown
  const filteredDepartments = useMemo(() => {
    const q = deptSearchQuery.trim().toLowerCase();
    if (!q) return availableDepartments;
    return availableDepartments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.faculty && d.faculty.toLowerCase().includes(q))
    );
  }, [availableDepartments, deptSearchQuery]);

  // Auto-select department if not set
  useEffect(() => {
    if (availableDepartments.length > 0) {
      if (!selectedDepartmentId || !availableDepartments.some((d) => d.id === selectedDepartmentId)) {
        const matchByName = initialDepartmentName
          ? availableDepartments.find((d) => d.name.toLowerCase() === initialDepartmentName.toLowerCase())
          : null;
        const target = matchByName || availableDepartments[0];
        setSelectedDepartmentId(target.id);
        setSelectedDepartmentName(target.name);
      }
    } else {
      setSelectedDepartmentId('');
      setSelectedDepartmentName('');
    }
  }, [availableDepartments, selectedDepartmentId, initialDepartmentName]);

  // Selected Department Item
  const currentDeptItem = useMemo(() => {
    return availableDepartments.find((d) => d.id === selectedDepartmentId) || availableDepartments[0] || null;
  }, [availableDepartments, selectedDepartmentId]);

  // Determine previous highest year in this department to prefill next year
  const departmentExistingSets = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId) return [];
    return sets.filter(
      (s) =>
        (s.institutionId === currentUni.id || s.universityId === currentUni.id) &&
        s.departmentId === selectedDepartmentId
    );
  }, [sets, currentUni, selectedDepartmentId]);

  const latestPrevYear = useMemo(() => {
    if (departmentExistingSets.length === 0) return null;
    return Math.max(...departmentExistingSets.map((s) => s.graduationYear));
  }, [departmentExistingSets]);

  const [graduationYear, setGraduationYear] = useState<number>(() => {
    if (lockedRelayYear) return lockedRelayYear;
    if (initialGraduationYear) return initialGraduationYear;
    return 2026;
  });

  useEffect(() => {
    if (lockedRelayYear) {
      setGraduationYear(lockedRelayYear);
    } else if (latestPrevYear) {
      setGraduationYear(latestPrevYear + 1);
    } else if (initialGraduationYear) {
      setGraduationYear(initialGraduationYear);
    }
  }, [selectedDepartmentId, latestPrevYear, lockedRelayYear, initialGraduationYear]);

  const [estimatedGraduates, setEstimatedGraduates] = useState<number>(100);
  const [classSetName, setClassSetName] = useState<string>('');
  const [academicYears, setAcademicYears] = useState<number>(4);
  const [classMotto, setClassMotto] = useState<string>('');

  // Step 3: Album Admin Details
  const [applicantRole, setApplicantRole] = useState<string>('Class Representative');
  const [customRole, setCustomRole] = useState<string>('');
  const [repPhone, setRepPhone] = useState<string>('');

  // Step 4: Backup Contact
  const [backupName, setBackupName] = useState<string>('');
  const [backupPhone, setBackupPhone] = useState<string>('');
  const [backupEmail, setBackupEmail] = useState<string>('');
  const [backupRole, setBackupRole] = useState<string>('Assistant Class Representative');

  // Request Department Addition Modal State
  const [isRequestingNewDept, setIsRequestingNewDept] = useState(false);
  const [reqDeptName, setReqDeptName] = useState('');
  const [reqFacultyName, setReqFacultyName] = useState('');
  const [additionSentToast, setAdditionSentToast] = useState(false);

  // Paystack & Payment State
  const [isPaystackOpen, setIsPaystackOpen] = useState(false);

  // General Status
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [isFoundingSubmitted, setIsFoundingSubmitted] = useState(false);
  const [isAlbumAdminHelpOpen, setIsAlbumAdminHelpOpen] = useState(false);

  // Helper: Format class set nickname
  const formatClassSetName = (nickname: string, year: number): string => {
    const trimmed = nickname.trim();
    if (!trimmed) return '';
    const yr2 = String(year).slice(-2);
    const yr4 = String(year);
    if (trimmed.endsWith(`'${yr2}`) || trimmed.endsWith(`'${yr4}`) || trimmed.endsWith(` ${yr4}`)) {
      return trimmed;
    }
    return `${trimmed} '${yr2}`;
  };

  // =========================================================================
  // ELIGIBILITY AND DUPLICATE RULES (Rule C.2)
  // Strict matching by institution ID + department ID + graduation year
  // =========================================================================

  // Rule C.2.a: Same year blocked for everyone (ignore soft-deleted albums past 30 days if not kept)
  const duplicateOfficialAlbum = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId || !graduationYear) return null;
    return (
      sets.find(
        (s) =>
          (s.institutionId === currentUni.id || s.universityId === currentUni.id) &&
          s.departmentId === selectedDepartmentId &&
          s.graduationYear === Number(graduationYear) &&
          !s.deletedAt
      ) || null
    );
  }, [sets, currentUni, selectedDepartmentId, graduationYear]);

  const isSameYearBlocked = Boolean(duplicateOfficialAlbum);

  // Department cohort counts across all years
  const departmentAlbumsCount = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId) return 0;
    return sets.filter(
      (s) =>
        (s.institutionId === currentUni.id || s.universityId === currentUni.id) &&
        s.departmentId === selectedDepartmentId &&
        !s.deletedAt
    ).length;
  }, [sets, currentUni, selectedDepartmentId]);

  // Rule C.2.b: Founding Class (No active album of any year in this department)
  const isFoundingClass = departmentAlbumsCount === 0;

  // Rule C.2.c: Standard Class (Department already has at least one album and not blocked)
  const isStandardClass = departmentAlbumsCount > 0 && !isSameYearBlocked;

  const isDeptFoundingPendingDifferentYear = false;

  // Reset form on open (never pre-fill seyidan03@gmail.com; only use verifiedSignupSession if handed off)
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setValidationError(null);
      setSubmissionSuccess(false);
      setIsFoundingSubmitted(false);
      setIsAlbumAdminHelpOpen(false);
      setActiveOAuthProvider(null);
      setExistingAdminAccount(null);

      if (verifiedSignupSession && verifiedSignupSession.email) {
        setAdminEmail(verifiedSignupSession.email);
        setAdminFullName('');
        setAdminPhone('');
        setSignupToken(verifiedSignupSession.signupToken || '');
        setVerifiedProvider(verifiedSignupSession.provider || 'google');
        setIsGoogleVerified(true);
      } else {
        setAdminEmail('');
        setAdminFullName('');
        setAdminPhone('');
        setSignupToken('');
        setIsGoogleVerified(false);
        setActiveUser(null);
      }
    }
  }, [isOpen, verifiedSignupSession]);

  // Handle department addition submission
  const handleSubmitAddition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqDeptName.trim() || !currentUni) return;

    onRequestAddition({
      id: `req-dept-${Date.now()}`,
      institutionName: currentUni.name,
      requestedDepartment: reqDeptName.trim(),
      facultyName: reqFacultyName.trim() || 'General Faculty',
      requesterName: adminFullName.trim() || 'Prospective Class Rep',
      requesterEmail: adminEmail.trim(),
      requesterPhone: adminPhone.trim() || '09030000000',
      status: 'Pending',
      timestamp: new Date().toISOString(),
    });

    setIsRequestingNewDept(false);
    setAdditionSentToast(true);
    setTimeout(() => setAdditionSentToast(false), 4000);
  };

  // Process OAuth verification result (from chooser or popup)
  const processOnboardingOAuth = async (oauthResult: {
    provider: 'google' | 'apple';
    idToken?: string;
    accessToken?: string;
    email?: string;
    name?: string;
  }) => {
    setValidationError(null);
    setExistingAdminAccount(null);
    setActiveOAuthProvider(oauthResult.provider);

    try {
      const signupRes = await requestGoogleSignupToken({
        provider: oauthResult.provider,
        idToken: oauthResult.idToken,
        accessToken: oauthResult.accessToken,
        email: oauthResult.email,
        name: oauthResult.name,
        nameHint: oauthResult.name,
      });

      setActiveOAuthProvider(null);

      if (signupRes.success && signupRes.signupToken && signupRes.email) {
        const normalizedEmail = signupRes.email.toLowerCase().trim();

        // Check if this Google email already owns an album; if so, open its dashboard immediately
        const existingAlbum = sets.find(
          (s) => s.classRepEmail && s.classRepEmail.toLowerCase().trim() === normalizedEmail
        );
        if (existingAlbum || normalizedEmail === 'seyidan03@gmail.com') {
          const loginRes = await authenticateWithOAuthPayload({
            provider: oauthResult.provider,
            idToken: oauthResult.idToken,
            accessToken: oauthResult.accessToken,
            email: oauthResult.email,
            name: oauthResult.name,
            nameHint: oauthResult.name,
          });
          if (loginRes.success && loginRes.user && onLoginSuccess) {
            onLoginSuccess(loginRes.user);
            onClose();
            return;
          }
          if (existingAlbum && onLoginSuccess) {
            const userAccount: UserAccount = {
              id: existingAlbum.currentAdminUserId || `usr-rep-${existingAlbum.id}`,
              fullName: existingAlbum.classRepName || oauthResult.name || 'Class Representative',
              email: normalizedEmail,
              phone: existingAlbum.classRepPhone || '',
              role: 'class_rep',
              assignedSetId: existingAlbum.id,
            };
            onLoginSuccess(userAccount);
            onClose();
            return;
          }
        }

        setSignupToken(signupRes.signupToken);
        setAdminEmail(signupRes.email);
        if (oauthResult.name && !adminFullName.trim()) {
          setAdminFullName(oauthResult.name);
        }
        setVerifiedProvider(oauthResult.provider);
        setIsGoogleVerified(true);
      } else {
        setValidationError(
          signupRes.message || 'Authentication failed. Please try again.'
        );
      }
    } catch (err: any) {
      setActiveOAuthProvider(null);
      setValidationError(
        err?.message ||
          `Unable to complete ${oauthResult.provider === 'google' ? 'Google' : 'Apple'} authentication. Please try again.`
      );
    }
  };

  // OAuth Handlers (Sign up with Google & Apple)
  const handleOAuthVerify = (provider: 'google' | 'apple') => {
    setValidationError(null);
    setExistingAdminAccount(null);
    if (provider === 'google') {
      setIsGoogleChooserOpen(true);
    } else {
      setIsAppleChooserOpen(true);
    }
  };

  // Step Navigations
  const goToNextStep = () => {
    setValidationError(null);

    // Step 1 Validation
    if (currentStep === 1) {
      if (!isGoogleVerified || !adminEmail.trim()) {
        setValidationError('Please continue with Google or Apple to verify your administrator account before proceeding.');
        return;
      }
      if (!adminFullName.trim()) {
        setValidationError('Please confirm your full legal name.');
        return;
      }
      if (!adminPhone.trim() || adminPhone.trim().length < 8) {
        setValidationError('Please enter your WhatsApp or mobile phone number.');
        return;
      }

      const verifiedAdmin: UserAccount = {
        id: `usr-rep-${Date.now()}`,
        fullName: adminFullName.trim(),
        email: adminEmail.trim().toLowerCase(),
        phone: adminPhone.trim(),
        role: 'class_rep',
      };
      setActiveUser(verifiedAdmin);
      setRepPhone(adminPhone.trim());
      setCurrentStep(2);
      return;
    }

    // Step 2 Validation
    if (currentStep === 2) {
      if (!selectedDepartmentId) {
        setValidationError('Please select an official Department from the directory.');
        return;
      }
      if (!graduationYear || graduationYear < 1990 || graduationYear > 2035) {
        setValidationError('Please specify a valid Graduating Year.');
        return;
      }
      if (isSameYearBlocked) {
        setValidationError('An official class album already exists for this graduating year.');
        return;
      }
      if (isDeptFoundingPendingDifferentYear) {
        setValidationError('A founding request for this department is awaiting approval. Please try again after it\'s approved.');
        return;
      }
      setCurrentStep(3);
      return;
    }

    // Step 3 Validation
    if (currentStep === 3) {
      if (!repPhone.trim()) {
        setValidationError('Please enter your WhatsApp/Phone Number for administrative verification.');
        return;
      }
      if (applicantRole === 'Other' && !customRole.trim()) {
        setValidationError('Please specify your current class or departmental role.');
        return;
      }
      setCurrentStep(4);
      return;
    }

    // Step 4 Validation
    if (currentStep === 4) {
      if (!backupName.trim()) {
        setValidationError('Please provide the full legal name of your Backup Contact.');
        return;
      }
      if (!backupPhone.trim()) {
        setValidationError('Please provide the WhatsApp/Phone number of your Backup Contact.');
        return;
      }
      setCurrentStep(5);
      return;
    }
  };

  const goToPrevStep = () => {
    setValidationError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as OnboardingStep);
    }
  };

  // Final Action Handler at Step 5 — Free Registration (Draft Status, Instant Dashboard Access)
  const handleInitiateFinalAction = () => {
    setValidationError(null);

    if (isSameYearBlocked) {
      setValidationError('An official class album already exists for this graduating year.');
      setCurrentStep(2);
      return;
    }

    handleFreeAlbumCreate();
  };

  // Free Registration Submit Flow (Creates Draft Album in D1 + Credits KoHot Slot Allocation if matched)
  const handleFreeAlbumCreate = async () => {
    setIsSubmitting(true);
    setValidationError(null);
    const nowIso = new Date().toISOString();
    const newAlbumId = `${currentUni.id}-${selectedDepartmentId.replace(/^dept-/, '')}-${graduationYear}`;
    const effectiveSetName = classSetName.trim()
      ? formatClassSetName(classSetName, graduationYear)
      : `${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`;

    const effectiveAdmin: UserAccount = {
      id: activeUser?.id || `usr-rep-${Date.now()}`,
      fullName: adminFullName.trim() || 'Class Representative',
      email: adminEmail.trim().toLowerCase(),
      phone: (repPhone || adminPhone).trim(),
      role: 'class_rep',
      assignedSetId: newAlbumId,
    };

    const reference = `KOHOT-REG-${Math.floor(10000 + Math.random() * 90000)}`;

    const newAlbumSet: ClassSet = {
      id: newAlbumId,
      institutionId: currentUni.id,
      institutionName: currentUni.name,
      institutionLogoUrl: currentUni.logoUrl,
      departmentId: selectedDepartmentId,
      departmentName: selectedDepartmentName,
      faculty: currentDeptItem?.faculty || 'General Faculty',
      graduationYear: Number(graduationYear),
      classSetName: effectiveSetName,
      classSlogan: classMotto.trim() || undefined,
      academicYears: Number(academicYears) || 4,
      estimatedGraduatesCount: Number(estimatedGraduates) || 100,
      classRepName: effectiveAdmin.fullName,
      classRepEmail: effectiveAdmin.email,
      classRepPhone: (repPhone || adminPhone).trim(),
      currentAdminUserId: effectiveAdmin.id,
      backupContact: {
        fullName: backupName.trim(),
        phoneOrWhatsapp: backupPhone.trim(),
        email: backupEmail.trim() || undefined,
        relationshipOrRole: backupRole.trim() || undefined,
      },
      adminHistory: [
        {
          adminUserId: effectiveAdmin.id,
          adminName: effectiveAdmin.fullName,
          adminEmail: effectiveAdmin.email,
          adminPhone: (repPhone || adminPhone).trim(),
          appointedAt: nowIso,
          reasonForTransition: 'initial_founder',
          notes: `Official Class Album registered for ${selectedDepartmentName} (Class of ${graduationYear}).`,
        },
      ],
      activationStatus: 'inactive',
      isPublished: false,
      published: false,
      isUnpublished: false,
      unpublished: false,
      version: 1,
      profileSlotBalance: 0,
      totalSlotsCredited: 0,
      totalSlotsUsed: 0,
      activationDate: nowIso.split('T')[0],
      activationRef: reference,
      showWelcomeMessage: true,
      bannerImageUrl: currentDeptItem?.heroImageUrl || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
      legacyGroupImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
      ourStory: '',
      students: [],
      memories: [],
      awards: [],
      voices: [],
    };

    try {
      const serverRes = await createFreeAlbumOnD1({
        signupToken,
        album: newAlbumSet,
        institutionId: currentUni.id,
        departmentId: selectedDepartmentId,
        graduationYear: Number(graduationYear),
        adminName: effectiveAdmin.fullName,
      });

      if (serverRes.alreadyExists && serverRes.album) {
        const existingUser: UserAccount = serverRes.user || {
          ...effectiveAdmin,
          id: serverRes.album.currentAdminUserId || effectiveAdmin.id,
          assignedSetId: serverRes.album.id,
        };
        setIsSubmitting(false);
        if (onLoginSuccess) {
          onLoginSuccess(existingUser);
        } else {
          onRegisterSuccess(serverRes.album, existingUser, {
            id: `tx-free-${Date.now()}`,
            reference,
            date: nowIso.replace('T', ' ').slice(0, 16),
            setId: serverRes.album.id,
            setName: serverRes.album.classSetName,
            institution: currentUni.name,
            amount: 0,
            currency: 'NGN',
            status: 'Paid',
            payerName: existingUser.fullName,
            payerEmail: existingUser.email,
          });
        }
        onClose();
        return;
      }

      if (!serverRes.success) {
        if (serverRes.error === 'duplicate_class_album') {
          setValidationError(
            serverRes.message || 'An official class album already exists for this institution, department, and graduating year.'
          );
          setCurrentStep(2);
          setIsSubmitting(false);
          return;
        }
        setValidationError(serverRes.message || 'Unable to create class album. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const persistedAlbum = serverRes.album || newAlbumSet;
      const persistedUser = serverRes.user || effectiveAdmin;

      const freeTx: FinancialTransaction = {
        id: `tx-reg-${Date.now()}`,
        reference,
        date: nowIso.replace('T', ' ').slice(0, 16),
        setId: persistedAlbum.id,
        setName: persistedAlbum.classSetName,
        institution: currentUni.name,
        amount: 0,
        currency: 'NGN',
        status: 'Paid',
        payerName: `${persistedUser.fullName} (Free Registration)`,
        payerEmail: persistedUser.email,
      };

      setIsSubmitting(false);
      onRegisterSuccess(persistedAlbum, persistedUser, freeTx);
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Network error while creating class album.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="onboarding-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Create Class Album"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn touch-none overscroll-none"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-[#121318] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                Create Class Album
              </h2>
              <p className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Official Department Archival Registration • KoHot
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200/60 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        {!submissionSuccess && (
          <div className="px-5 sm:px-8 py-3 bg-slate-100/60 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {STEPS_CONFIG.map((s) => {
                const isPassed = currentStep > s.step;
                const isCurrent = currentStep === s.step;
                return (
                  <div key={s.step} className="flex-1 flex items-center">
                    <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                      <div className="flex items-center gap-1.5 w-full">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono-tech font-bold shrink-0 transition-colors shadow-xs ${
                          isPassed 
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-[#d4af37] text-black font-extrabold ring-2 ring-[#d4af37]/40'
                            : 'bg-white dark:bg-white/10 text-slate-500 dark:text-zinc-400 border border-slate-300 dark:border-white/10'
                        }`}>
                          {isPassed ? '✓' : s.step}
                        </span>
                        <div className={`hidden sm:block h-0.5 flex-1 rounded-full ${
                          isPassed ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                        }`} />
                      </div>
                      <span className={`text-[10px] font-mono-tech mt-1 truncate hidden sm:block ${
                        isCurrent ? 'text-slate-900 dark:text-white font-bold' : isPassed ? 'text-slate-600 dark:text-zinc-400' : 'text-slate-400 dark:text-zinc-500'
                      }`}>
                        {s.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Validation / Error Banner */}
        {validationError && (
          <div className="mx-5 sm:mx-8 mt-4 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-mono-tech flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{validationError}</span>
          </div>
        )}

        {/* Department Addition Success Notice */}
        {additionSentToast && (
          <div className="mx-5 sm:mx-8 mt-4 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-mono-tech flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Department addition request submitted! Our team will review and add it to the directory.</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div data-modal-scrollable="true" className="p-5 sm:p-8 flex-1 overflow-y-auto overscroll-contain">
          {submissionSuccess ? (
            /* Submission Success State */
            <div className="py-8 text-center space-y-4 animate-fadeIn">
              <div className={`w-16 h-16 rounded-3xl border flex items-center justify-center mx-auto shadow-md ${
                isFoundingSubmitted
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
              }`}>
                {isFoundingSubmitted ? <Clock className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="font-syne font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
                  {isFoundingSubmitted
                    ? 'Founding Class Request Submitted!'
                    : 'Class Album Activated!'}
                </h3>
                <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {isFoundingSubmitted ? (
                    <>
                      Your application to establish the founding class album for <strong>{selectedDepartmentName} (Class of {graduationYear})</strong> has been received. Founding classes require Master Host approval before activation.
                    </>
                  ) : (
                    <>
                      Payment verified! Your class album for <strong>{selectedDepartmentName} (Class of {graduationYear})</strong> is now live and ready to populate.
                    </>
                  )}
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* =========================================================================
                  STEP 1: BRANDED KOHOT OAUTH VERIFICATION (GOOGLE & APPLE ONLY)
                  ========================================================================= */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  {!isGoogleVerified || !adminEmail ? (
                    /* UNVERIFIED STATE: "Verify Your Identity" Card with Website KoHot Logo */
                    <div className="relative rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-surface-2)] text-[var(--kh-text)] p-6 sm:p-8 shadow-sm overflow-hidden text-center">
                      {/* Centered Website KoHot Logo Badge */}
                      <div className="flex flex-col items-center justify-center mb-5">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--kh-surface)] border border-[var(--kh-border)] shadow-sm flex flex-col items-center justify-center gap-1.5">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={brandName}
                              className="w-9 h-9 object-contain"
                            />
                          ) : (
                            <>
                              <div className="w-5 h-5 bg-[var(--kh-accent)] rotate-45 transform" />
                              <span className="font-syne font-black text-[9px] tracking-[0.18em] uppercase leading-none mt-0.5 text-[var(--kh-text)]">
                                {brandName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Heading & Description */}
                      <h3 className="font-syne font-extrabold text-xl sm:text-2xl tracking-tight text-[var(--kh-text)]">
                        Sign Up to Create{' '}
                        <span className="font-extrabold text-[var(--kh-accent-text)]">
                          Class Album
                        </span>
                      </h3>
                      <p className="font-body text-xs sm:text-[13px] max-w-md mx-auto mt-2.5 mb-7 leading-relaxed text-[var(--kh-text-muted)]">
                        Sign up with Google to verify your email address. If your email already has an album, we will open its dashboard immediately.
                      </p>

                      {/* Centered "Sign up with Google" & "Sign up with Apple" Buttons */}
                      <div className="space-y-3 max-w-md mx-auto">
                        <button
                          type="button"
                          disabled={activeOAuthProvider !== null}
                          onClick={() => handleOAuthVerify('google')}
                          className="w-full py-3.5 px-5 rounded-xl bg-[var(--kh-surface)] hover:bg-[var(--kh-bg)] active:scale-[0.99] border border-[var(--kh-border)] text-[var(--kh-text)] font-syne font-bold text-sm tracking-tight flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                        >
                          {activeOAuthProvider === 'google' ? (
                            <>
                              <Loader2 className="w-5 h-5 text-[var(--kh-accent-text)] animate-spin shrink-0" />
                              <span>Connecting to Google...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="#EA4335"
                                  d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.04-4.38 3.04-7.46 0-.72-.06-1.41-.19-2.05H12z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M12 22c2.75 0 5.06-.91 6.75-2.47l-3.3-2.56c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.89v2.64C4.57 19.72 8.01 22 12 22z"
                                />
                                <path
                                  fill="#4A90E2"
                                  d="M6.3 13.75A5.98 5.98 0 0 1 5.98 12c0-.61.11-1.2.32-1.75V7.61H2.89A9.98 9.98 0 0 0 2 12c0 1.61.39 3.14 1.09 4.39l3.21-2.64z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M12 5.95c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 2.91 14.75 2 12 2 8.01 2 4.57 4.28 2.89 7.61l3.41 2.64c.8-2.41 3.05-4.3 5.7-4.3z"
                                />
                              </svg>
                              <span>Sign up with Google</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={activeOAuthProvider !== null}
                          onClick={() => handleOAuthVerify('apple')}
                          className="w-full py-3.5 px-5 rounded-xl bg-[var(--kh-surface)] hover:bg-[var(--kh-bg)] active:scale-[0.99] border border-[var(--kh-border)] text-[var(--kh-text)] font-syne font-bold text-sm tracking-tight flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                        >
                          {activeOAuthProvider === 'apple' ? (
                            <>
                              <Loader2 className="w-5 h-5 text-[var(--kh-text)] animate-spin shrink-0" />
                              <span>Connecting to Apple...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
                              </svg>
                              <span>Continue with Apple</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Bottom Security Badge Line */}
                      <div className="mt-6 flex items-center justify-center gap-2 text-center">
                        <ShieldCheck className="w-4 h-4 text-[var(--kh-success)] shrink-0" />
                        <span className="font-body text-xs text-[var(--kh-text-muted)]">
                          Instant verified capture • Passwordless &amp; Secure
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* VERIFIED STATE */
                    <div className="space-y-6 animate-fadeIn">
                      {/* Top Verified via Google / Apple Emerald Banner */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--kh-surface-2)] border border-[var(--kh-success)] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-[var(--kh-surface)] border border-[var(--kh-border)] flex items-center justify-center shrink-0">
                            {verifiedProvider === 'apple' ? (
                              <svg className="w-5 h-5 fill-current text-[var(--kh-text)]" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="#EA4335"
                                  d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.04-4.38 3.04-7.46 0-.72-.06-1.41-.19-2.05H12z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M12 22c2.75 0 5.06-.91 6.75-2.47l-3.3-2.56c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.89v2.64C4.57 19.72 8.01 22 12 22z"
                                />
                                <path
                                  fill="#4A90E2"
                                  d="M6.3 13.75A5.98 5.98 0 0 1 5.98 12c0-.61.11-1.2.32-1.75V7.61H2.89A9.98 9.98 0 0 0 2 12c0 1.61.39 3.14 1.09 4.39l3.21-2.64z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M12 5.95c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 2.91 14.75 2 12 2 8.01 2 4.57 4.28 2.89 7.61l3.41 2.64c.8-2.41 3.05-4.3 5.7-4.3z"
                                />
                              </svg>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="font-syne font-bold text-sm text-[var(--kh-text)]">
                                Verified via {verifiedProvider === 'apple' ? 'Apple' : 'Google'}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-[var(--kh-surface)] border border-[var(--kh-success)] text-[var(--kh-success)] font-mono-tech text-[10px] font-bold uppercase tracking-wider">
                                AUTHENTICATED
                              </span>
                            </div>
                            <p className="font-body text-xs mt-1 leading-snug text-[var(--kh-text-muted)]">
                              Email captured and verified without manual typing
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsGoogleVerified(false);
                            setAdminEmail('');
                            setSignupToken('');
                          }}
                          className="font-body text-xs text-[var(--kh-text-muted)] hover:text-[var(--kh-text)] underline underline-offset-4 transition-colors cursor-pointer shrink-0 text-right leading-tight"
                        >
                          Change
                          <br />
                          Account
                        </button>
                      </div>

                      {/* Section Title & Description */}
                      <div className="space-y-1.5">
                        <h3 className="font-syne font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
                          1. Administrator Account Details
                        </h3>
                        <p className="font-body text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                          Your email was auto-captured from your {verifiedProvider === 'apple' ? 'Apple' : 'Google'} account. Confirm your name and provide your WhatsApp contact number for cohort updates.
                        </p>
                      </div>

                      {/* Form Fields Card */}
                      <div className="p-5 sm:p-6 rounded-3xl bg-slate-50/70 dark:bg-[#16171d] border border-slate-200 dark:border-white/10 space-y-5">
                        {/* 1. Verified Administrator Email (Locked & Auto-Captured) */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                              Verified Administrator Email *
                            </label>
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Auto-Captured</span>
                            </span>
                          </div>
                          <div className="w-full px-4 py-3.5 rounded-2xl bg-emerald-50/80 dark:bg-[#072419]/60 border border-emerald-400/50 dark:border-emerald-500/40 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Mail className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                              <span className="font-body font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                {adminEmail}
                              </span>
                            </div>
                            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          </div>
                        </div>

                        {/* 2. Applicant Legal Name */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                              Applicant Legal Name *
                            </label>
                          </div>
                          <input
                            type="text"
                            required
                            value={adminFullName}
                            onChange={(e) => setAdminFullName(e.target.value)}
                            placeholder="Enter your full legal name"
                            className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-[#1e1f26] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-body text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>

                        {/* 3. WhatsApp / Contact Phone */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                              WhatsApp / Contact Phone *
                            </label>
                            <span className="text-[11px] font-body text-slate-400 dark:text-zinc-500">
                              For class notifications only
                            </span>
                          </div>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="tel"
                              required
                              value={adminPhone}
                              onChange={(e) => setAdminPhone(e.target.value)}
                              placeholder="0903 000 0000"
                              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-[#1e1f26] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-mono-tech text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  STEP 2: CLASS & COHORT DETAILS (SEARCHABLE DIRECTORY LISTS)
                  ========================================================================= */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      2. Graduating Class &amp; Cohort Details
                    </h3>
                    <p className="font-body text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Select your academic institution and department from the Host directory.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 sm:p-6 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10">
                    {/* Searchable Institution Combobox */}
                    <div className="space-y-1.5 sm:col-span-2 relative">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Institution *
                      </label>
                      <div className="relative">
                        <div
                          onClick={() => setIsUniDropdownOpen(!isUniDropdownOpen)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs flex items-center justify-between cursor-pointer shadow-xs hover:border-[#d4af37]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold">{currentUni?.name}</span>
                            <span className="text-[10px] text-zinc-500">({currentUni?.shortCode})</span>
                            {currentUni?.isPriority && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#d4af37] text-black">
                                Current
                              </span>
                            )}
                          </div>
                          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        </div>

                        {/* Searchable dropdown popup */}
                        {isUniDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-[#18181b] border border-slate-300 dark:border-white/20 shadow-2xl p-2 space-y-1">
                            <input
                              type="text"
                              value={uniSearchQuery}
                              onChange={(e) => setUniSearchQuery(e.target.value)}
                              placeholder="Search institution..."
                              className="w-full px-3 py-2 mb-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono-tech text-slate-900 dark:text-white focus:outline-none focus:border-[#d4af37]"
                              autoFocus
                            />
                            {filteredInstitutions.length === 0 ? (
                              <div className="p-3 text-center text-xs text-zinc-500 font-mono-tech">
                                No institution found
                              </div>
                            ) : (
                              filteredInstitutions.map((u) => {
                                const isSelected = u.id === selectedUniId;
                                const typeLabel =
                                  u.institutionType === 'polytechnic'
                                    ? 'Polytechnic'
                                    : u.institutionType === 'college_of_education'
                                    ? 'College of Education'
                                    : 'University';

                                return (
                                  <div
                                    key={u.id}
                                    onClick={() => {
                                      setSelectedUniId(u.id);
                                      setIsUniDropdownOpen(false);
                                      setUniSearchQuery('');
                                    }}
                                    className={`px-3 py-2 rounded-xl text-xs font-mono-tech flex items-center justify-between cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-[#d4af37]/15 text-[#d4af37] font-bold'
                                        : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-zinc-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span>{u.name}</span>
                                      <span className="text-[10px] text-zinc-500">[{typeLabel}]</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {u.isPriority && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#d4af37] text-black">
                                          Current
                                        </span>
                                      )}
                                      {isSelected && <Check className="w-3.5 h-3.5 text-[#d4af37]" />}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Searchable Department Combobox */}
                    <div className="space-y-1.5 sm:col-span-2 relative">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Department *
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsRequestingNewDept(true)}
                          className="text-[11px] font-mono-tech text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Building2 className="w-3 h-3" />
                          <span>Request Missing Department</span>
                        </button>
                      </div>

                      <div className="relative">
                        <div
                          onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs flex items-center justify-between cursor-pointer shadow-xs hover:border-[#d4af37]"
                        >
                          <span className="truncate font-bold">
                            {selectedDepartmentName || 'Select department...'}
                          </span>
                          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        </div>

                        {isDeptDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-[#18181b] border border-slate-300 dark:border-white/20 shadow-2xl p-2 space-y-1">
                            <input
                              type="text"
                              value={deptSearchQuery}
                              onChange={(e) => setDeptSearchQuery(e.target.value)}
                              placeholder="Search department in directory..."
                              className="w-full px-3 py-2 mb-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono-tech text-slate-900 dark:text-white focus:outline-none focus:border-[#d4af37]"
                              autoFocus
                            />
                            {filteredDepartments.length === 0 ? (
                              <div className="p-3 text-center text-xs text-zinc-500 font-mono-tech">
                                No department found. Click "Request Missing Department" above.
                              </div>
                            ) : (
                              filteredDepartments.map((dept) => {
                                const isSelected = dept.id === selectedDepartmentId;
                                return (
                                  <div
                                    key={dept.id}
                                    onClick={() => {
                                      setSelectedDepartmentId(dept.id);
                                      setSelectedDepartmentName(dept.name);
                                      setIsDeptDropdownOpen(false);
                                      setDeptSearchQuery('');
                                    }}
                                    className={`px-3 py-2 rounded-xl text-xs font-mono-tech flex items-center justify-between cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-[#d4af37]/15 text-[#d4af37] font-bold'
                                        : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-zinc-200'
                                    }`}
                                  >
                                    <div className="truncate">
                                      <span>{dept.name}</span>
                                      {dept.faculty && (
                                        <span className="text-[10px] text-zinc-500 ml-1.5 font-normal">
                                          ({dept.faculty})
                                        </span>
                                      )}
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Graduation Year */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Graduating Set Year *
                        </label>
                        {latestPrevYear && (
                          <span className="text-[10px] font-mono-tech text-amber-600 dark:text-amber-400 font-medium">
                            Prev: {latestPrevYear} → Next: {latestPrevYear + 1}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1990"
                        max="2035"
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    {/* Estimated Graduates */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Estimated Students in Class
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="2000"
                        value={estimatedGraduates}
                        onChange={(e) => setEstimatedGraduates(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    {/* Class Name / Nickname */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Class Set Name / Nickname <span className="text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <div className="flex items-center rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 overflow-hidden">
                        <input
                          type="text"
                          value={classSetName}
                          onChange={(e) => setClassSetName(e.target.value)}
                          placeholder="e.g. The Trailblazers"
                          className="w-full px-3.5 py-2.5 bg-transparent text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none"
                        />
                        <span className="px-3.5 py-2.5 text-xs font-mono-tech font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border-l border-slate-200 dark:border-white/10 select-none shrink-0">
                          '{String(graduationYear).slice(-2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DUPLICATE WARNING NOTICE */}
                  {isSameYearBlocked && (
                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 text-xs font-mono-tech space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span>Class Album Already Exists</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-700 dark:text-red-300">
                          Blocked
                        </span>
                      </div>
                      <p className="leading-relaxed text-[11px]">
                        An official class album already exists for{' '}
                        <strong>{selectedDepartmentName} (Class of {graduationYear})</strong>. Each department cohort can have only one official album.
                      </p>
                      {duplicateOfficialAlbum && (
                        <button
                          type="button"
                          onClick={() => setIsAlbumAdminHelpOpen(true)}
                          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold pt-1 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Report a dispute</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  STEP 3: ALBUM ADMIN AUTHORITY
                  ========================================================================= */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      3. Album Admin Authority
                    </h3>
                    <p className="font-body text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Confirm your active class or departmental role for administrative verification.
                    </p>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Class Role / Capacity *
                      </label>
                      <select
                        value={applicantRole}
                        onChange={(e) => setApplicantRole(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37] cursor-pointer"
                      >
                        <option value="Class Representative">Class Representative</option>
                        <option value="Assistant Class Representative">Assistant Class Representative</option>
                        <option value="Departmental President">Departmental President / Exco</option>
                        <option value="Yearbook / Album Committee Chair">Yearbook / Album Committee Chair</option>
                        <option value="Other">Other Classmate Role</option>
                      </select>
                    </div>

                    {applicantRole === 'Other' && (
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Specify Role *
                        </label>
                        <input
                          type="text"
                          required
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          placeholder="e.g. Media Director, Project Lead"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Administrative Contact WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={repPhone}
                        onChange={(e) => setRepPhone(e.target.value)}
                        placeholder="0803 000 0000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  STEP 4: BACKUP CONTINUITY CONTACT
                  ========================================================================= */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      4. Designated Backup Contact
                    </h3>
                    <p className="font-body text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Provide a trusted classmate or course mate as a secondary contact for account continuity.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 sm:p-6 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Backup Contact Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={backupName}
                        onChange={(e) => setBackupName(e.target.value)}
                        placeholder="e.g. Folake Danladi"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-body text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Backup WhatsApp / Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={backupPhone}
                        onChange={(e) => setBackupPhone(e.target.value)}
                        placeholder="0809 000 0000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Backup Email <span className="text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={backupEmail}
                        onChange={(e) => setBackupEmail(e.target.value)}
                        placeholder="backup@department.edu"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  STEP 5: REVIEW & FREE ALBUM CREATION (NO PAYMENT REQUIRED)
                  ========================================================================= */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      5. Review &amp; Create Class Album
                    </h3>
                    <p className="font-body text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Confirm your class details below. Registration is free and opens your dashboard immediately as a private draft.
                    </p>
                  </div>

                  {/* Cohort Summary Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2 text-xs font-mono-tech">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <span className="text-slate-400 text-[10px] block">Institution:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{currentUni?.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Department:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{selectedDepartmentName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Cohort:</span>
                        <span className="font-bold text-[#d4af37]">Class of {graduationYear}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Album Admin:</span>
                        <span className="text-slate-900 dark:text-white">{adminFullName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Verified Email:</span>
                        <span className="text-slate-900 dark:text-white">{adminEmail}</span>
                      </div>
                    </div>
                  </div>

                  {/* Instant Draft Access Summary Card (No Pricing / No Approval Gate) */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-[#18181b] text-white border border-white/20 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono-tech uppercase tracking-wider text-emerald-400 font-bold">
                        Instant Dashboard Access
                      </span>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono-tech font-bold text-[10px] uppercase">
                        Starts as Draft
                      </span>
                    </div>
                    <h4 className="font-syne font-bold text-lg text-white">
                      Ready to set up your Class Album
                    </h4>
                    <p className="text-xs text-zinc-300 font-body leading-relaxed">
                      You can configure your album design, upload class moments, and invite classmates to submit their profiles right away. Profile slots or student profile payments are only needed when approving profiles and publishing live.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Bottom Actions */}
        {!submissionSuccess && (
          <div className="px-5 sm:px-8 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-[#15161c] flex items-center justify-between shrink-0">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goToPrevStep}
                className="px-4 py-2 rounded-full bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300 dark:border-white/10 font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-white dark:bg-white/10 text-slate-600 dark:text-zinc-400 font-mono-tech text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                disabled={Boolean(currentStep === 2 && isSameYearBlocked)}
                onClick={goToNextStep}
                className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-white dark:text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleInitiateFinalAction}
                className="px-7 py-2.5 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              >
                {isSubmitting ? (
                  <span>Creating Album...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    <span>Create Class Album</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Album Admin Help Support Modal for Duplicate Album Inquiries */}
        {isAlbumAdminHelpOpen && duplicateOfficialAlbum && (
          <AlbumAdminHelpModal
            isOpen={isAlbumAdminHelpOpen}
            onClose={() => setIsAlbumAdminHelpOpen(false)}
            currentSet={duplicateOfficialAlbum}
            currentUser={
              activeUser || {
                id: 'applicant-dispute',
                email: adminEmail,
                fullName: adminFullName || 'Applicant',
                role: 'class_rep',
              }
            }
          />
        )}

        {/* Google Account Chooser Modal */}
        <GoogleAccountChooserModal
          isOpen={isGoogleChooserOpen}
          onClose={() => setIsGoogleChooserOpen(false)}
          onSelectAccount={(acc) => {
            setIsGoogleChooserOpen(false);
            processOnboardingOAuth({
              provider: 'google',
              email: acc.email,
              name: acc.name,
            });
          }}
        />

        {/* Apple Account Chooser Modal */}
        <AppleAccountChooserModal
          isOpen={isAppleChooserOpen}
          onClose={() => setIsAppleChooserOpen(false)}
          onSelectAccount={(acc) => {
            setIsAppleChooserOpen(false);
            processOnboardingOAuth({
              provider: 'apple',
              email: acc.email,
              name: acc.name,
            });
          }}
        />
      </div>
    </div>
  );
};
