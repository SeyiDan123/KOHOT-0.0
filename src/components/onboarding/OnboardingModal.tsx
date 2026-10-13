import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  Mail, 
  Sparkles, 
  ChevronRight, 
  Send, 
  LogIn,
  Search,
  Check,
  CreditCard,
  Clock,
  Phone,
  HelpCircle
} from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { AlbumAdminHelpModal } from '../admin/AlbumAdminHelpModal';
import { PaystackModal } from '../common/PaystackModal';
import { verifyPaystackPaymentOnServer, STANDARD_PRICE, HOST_EMAIL } from '../../utils/apiClient';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  foundingRequests?: FoundingClassRequest[];
  currentUser?: UserAccount | null;
  inviteContext?: NextClassInviteContext | null;
  onLoginSuccess?: (user: UserAccount) => void;
  onOpenLogin?: () => void;
  initialUniversityId?: string;
  initialDepartmentName?: string;
  initialGraduationYear?: number;
  onRegisterSuccess: (newSet: ClassSet, userAccount: UserAccount, tx: FinancialTransaction) => void;
  onSubmitFoundingRequest: (req: FoundingClassRequest) => void;
  onRequestAddition: (req: DepartmentAdditionRequest) => void;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const STEPS_CONFIG = [
  { step: 1, title: 'Account', desc: 'Google Verification' },
  { step: 2, title: 'Class', desc: 'Cohort Details' },
  { step: 3, title: 'Album Admin', desc: 'Applicant Authority' },
  { step: 4, title: 'Backup Contact', desc: 'Recovery Continuity' },
  { step: 5, title: 'Pricing & Submit', desc: 'Final Verification' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  universities = [],
  sets = [],
  foundingRequests = [],
  currentUser = null,
  inviteContext = null,
  onLoginSuccess,
  onOpenLogin,
  initialUniversityId,
  initialDepartmentName,
  initialGraduationYear,
  onRegisterSuccess,
  onSubmitFoundingRequest,
  onRequestAddition,
}) => {
  useStaticBackdropScrollLock(isOpen);

  // Step State
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);

  // Step 1: Admin Account Details (Verified with Google)
  const [adminFullName, setAdminFullName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPhone, setAdminPhone] = useState<string>('');
  const [isGoogleVerified, setIsGoogleVerified] = useState<boolean>(false);
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);

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

  // Rule C.2.a: Same year blocked for everyone
  const duplicateOfficialAlbum = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId || !graduationYear) return null;
    return (
      sets.find(
        (s) =>
          (s.institutionId === currentUni.id || s.universityId === currentUni.id) &&
          s.departmentId === selectedDepartmentId &&
          s.graduationYear === Number(graduationYear)
      ) || null
    );
  }, [sets, currentUni, selectedDepartmentId, graduationYear]);

  const duplicatePendingFounding = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId || !graduationYear) return null;
    return (
      foundingRequests.find(
        (r) =>
          r.universityId === currentUni.id &&
          r.departmentId === selectedDepartmentId &&
          r.classYear === Number(graduationYear) &&
          r.status === 'Pending'
      ) || null
    );
  }, [foundingRequests, currentUni, selectedDepartmentId, graduationYear]);

  const isSameYearBlocked = Boolean(duplicateOfficialAlbum || duplicatePendingFounding);

  // Department cohort counts across all years
  const departmentAlbumsCount = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId) return 0;
    return sets.filter(
      (s) =>
        (s.institutionId === currentUni.id || s.universityId === currentUni.id) &&
        s.departmentId === selectedDepartmentId
    ).length;
  }, [sets, currentUni, selectedDepartmentId]);

  const departmentPendingFoundingCount = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId) return 0;
    return foundingRequests.filter(
      (r) =>
        r.universityId === currentUni.id &&
        r.departmentId === selectedDepartmentId &&
        r.status === 'Pending'
    ).length;
  }, [foundingRequests, currentUni, selectedDepartmentId]);

  // Rule C.2.b: Founding Class (No album of any year & no pending founding request)
  const isFoundingClass = departmentAlbumsCount === 0 && departmentPendingFoundingCount === 0;

  // Rule C.2.c: Standard Class (Department already has at least one album and not blocked)
  const isStandardClass = departmentAlbumsCount > 0 && !isSameYearBlocked;

  // Rule C.2.d: Department has a pending founding request awaiting approval and a different year tries to register
  const isDeptFoundingPendingDifferentYear = useMemo(() => {
    if (!currentUni?.id || !selectedDepartmentId) return false;
    return foundingRequests.some(
      (r) =>
        r.universityId === currentUni.id &&
        r.departmentId === selectedDepartmentId &&
        r.status === 'Pending' &&
        r.classYear !== Number(graduationYear)
    );
  }, [foundingRequests, currentUni, selectedDepartmentId, graduationYear]);

  // Pricing calculation
  const perGraduateEstimate = useMemo(() => {
    if (!estimatedGraduates || estimatedGraduates <= 0) return 0;
    return Math.round((STANDARD_PRICE / estimatedGraduates) / 10) * 10;
  }, [estimatedGraduates]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setValidationError(null);
      setSubmissionSuccess(false);
      setIsFoundingSubmitted(false);
      setIsAlbumAdminHelpOpen(false);
      setIsPaystackOpen(false);

      if (currentUser && currentUser.email) {
        setAdminEmail(currentUser.email);
        setAdminFullName(currentUser.fullName);
        setAdminPhone(currentUser.phone || '');
        setIsGoogleVerified(true);
      }
    }
  }, [isOpen, currentUser]);

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
      requesterEmail: adminEmail.trim() || 'applicant@gmail.com',
      requesterPhone: adminPhone.trim() || '09030000000',
      status: 'Pending',
      timestamp: new Date().toISOString(),
    });

    setIsRequestingNewDept(false);
    setAdditionSentToast(true);
    setTimeout(() => setAdditionSentToast(false), 4000);
  };

  // Google Sign-In Simulation / Direct Auth at Step 1
  const handleVerifyGoogle = (email: string, name?: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setValidationError('Please enter a valid Google email address.');
      return;
    }
    setAdminEmail(trimmed);
    setAdminFullName(name || adminFullName || trimmed.split('@')[0].replace(/[._]/g, ' ').toUpperCase());
    setIsGoogleVerified(true);
    setValidationError(null);
  };

  // Step Navigations
  const goToNextStep = () => {
    setValidationError(null);

    // Step 1 Validation
    if (currentStep === 1) {
      if (!isGoogleVerified || !adminEmail.trim()) {
        setValidationError('Please sign in with your verified Google Account before proceeding.');
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

  // Final Action Handler at Step 5
  const handleInitiateFinalAction = () => {
    setValidationError(null);

    // Re-check duplicate rules immediately before payment or submission
    if (isSameYearBlocked) {
      setValidationError('An official class album already exists for this graduating year.');
      setCurrentStep(2);
      return;
    }
    if (isDeptFoundingPendingDifferentYear) {
      setValidationError('A founding request for this department is awaiting approval. Please try again after it\'s approved.');
      setCurrentStep(2);
      return;
    }

    if (isFoundingClass) {
      // Founding Path: Free, requires Host approval
      handleFoundingSubmit();
    } else {
      // Standard Path: Paid ₦50,000 via Paystack
      setIsPaystackOpen(true);
    }
  };

  // Founding Class Submit Flow (Free, Needs Approval)
  const handleFoundingSubmit = () => {
    setIsSubmitting(true);
    const nowIso = new Date().toISOString();
    const effectiveAdmin = activeUser || {
      id: `usr-rep-${Date.now()}`,
      fullName: adminFullName.trim() || 'Class Representative',
      email: adminEmail.trim().toLowerCase(),
      phone: (repPhone || adminPhone).trim(),
      role: 'class_rep',
    };

    const effectiveRole = applicantRole === 'Other' && customRole.trim() ? customRole.trim() : applicantRole;
    const effectiveSetName = classSetName.trim()
      ? formatClassSetName(classSetName, graduationYear)
      : `${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`;

    const foundingReq: FoundingClassRequest = {
      id: `founding-req-${Date.now()}`,
      universityId: currentUni.id,
      universityName: currentUni.name,
      facultyName: currentDeptItem?.faculty || 'General Faculty',
      departmentId: selectedDepartmentId,
      departmentName: selectedDepartmentName,
      classYear: Number(graduationYear),
      classSetName: effectiveSetName,
      classSlogan: classMotto.trim() || undefined,
      yearsTogether: Number(academicYears) || 4,
      applicantRole: effectiveRole,
      applicantName: effectiveAdmin.fullName,
      applicantEmail: effectiveAdmin.email,
      applicantPhone: (repPhone || adminPhone).trim(),
      backupContact: {
        fullName: backupName.trim(),
        phoneOrWhatsapp: backupPhone.trim(),
        email: backupEmail.trim() || undefined,
        relationshipOrRole: backupRole.trim() || undefined,
      },
      estimatedGraduatesCount: Number(estimatedGraduates) || 100,
      status: 'Pending',
      submissionDate: nowIso.split('T')[0],
    };

    setTimeout(() => {
      onSubmitFoundingRequest(foundingReq);
      setIsSubmitting(false);
      setIsFoundingSubmitted(true);
      setSubmissionSuccess(true);
    }, 600);
  };

  // Paystack Success Handler for Standard Path
  const handlePaystackSuccess = async (reference: string) => {
    setIsPaystackOpen(false);
    setIsSubmitting(true);

    try {
      // 1. Verify transaction with server endpoint
      const verifyRes = await verifyPaystackPaymentOnServer({
        reference,
        institutionId: currentUni.id,
        departmentId: selectedDepartmentId,
        graduationYear: Number(graduationYear),
        applicantEmail: adminEmail.trim().toLowerCase(),
        applicantName: adminFullName.trim(),
        applicantPhone: (repPhone || adminPhone).trim(),
        classSetName: classSetName.trim() || `${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`,
        estimatedGraduates: Number(estimatedGraduates) || 100,
      });

      if (!verifyRes.success) {
        setValidationError(verifyRes.message || 'Payment verification failed. Please contact support.');
        setIsSubmitting(false);
        return;
      }

      // 2. Re-check duplicate rule after payment succeeded (Prompt C.2.e safeguard)
      const duplicateAfterPay = sets.find(
        (s) =>
          (s.institutionId === currentUni.id || s.universityId === currentUni.id) &&
          s.departmentId === selectedDepartmentId &&
          s.graduationYear === Number(graduationYear)
      );

      if (duplicateAfterPay) {
        // Record refund needed transaction for Host finance view
        const refundTx: FinancialTransaction = {
          id: `tx-refund-${Date.now()}`,
          reference,
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          setId: duplicateAfterPay.id,
          setName: duplicateAfterPay.classSetName,
          institution: currentUni.name,
          amount: STANDARD_PRICE,
          currency: 'NGN',
          status: 'paid, duplicate class, needs refund' as any,
          payerName: adminFullName.trim(),
          payerEmail: adminEmail.trim(),
        };
        // Hand off refund transaction without creating duplicate album
        setValidationError(
          'Payment received, but another user completed registration for this same graduation year moments ago. Your payment has been recorded for an immediate refund by the Master Host.'
        );
        setIsSubmitting(false);
        return;
      }

      // 3. Create album set (Blank album: students: [], memories: [], etc.)
      const nowIso = new Date().toISOString();
      const newAlbumId = `${currentUni.id}-${selectedDepartmentId.replace(/^dept-/, '')}-${graduationYear}`;
      const effectiveSetName = classSetName.trim()
        ? formatClassSetName(classSetName, graduationYear)
        : `${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`;
      const effectiveRole = applicantRole === 'Other' && customRole.trim() ? customRole.trim() : applicantRole;

      const effectiveAdmin: UserAccount = {
        id: `usr-rep-${Date.now()}`,
        fullName: adminFullName.trim(),
        email: adminEmail.trim().toLowerCase(),
        phone: (repPhone || adminPhone).trim(),
        role: 'class_rep',
        assignedSetId: newAlbumId,
      };

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
            notes: `Official Class Album registered and paid for ${selectedDepartmentName} (Class of ${graduationYear}).`,
          },
        ],
        activationStatus: 'active',
        activationDate: nowIso.split('T')[0],
        activationRef: reference,
        bannerImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
        legacyGroupImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
        ourStory: `Preserving the heritage of ${selectedDepartmentName}, our graduating class registered this official digital archive.`,
        students: [], // Completely blank album per Prompt D.6
        memories: [],
        awards: [],
        voices: [],
      };

      const paidTx: FinancialTransaction = {
        id: `tx-paid-${Date.now()}`,
        reference,
        date: nowIso.replace('T', ' ').slice(0, 16),
        setId: newAlbumId,
        setName: effectiveSetName,
        institution: currentUni.name,
        amount: STANDARD_PRICE,
        currency: 'NGN',
        status: 'Paid',
        payerName: effectiveAdmin.fullName,
        payerEmail: effectiveAdmin.email,
      };

      onRegisterSuccess(newAlbumSet, effectiveAdmin, paidTx);
      setIsSubmitting(false);
      setIsFoundingSubmitted(false);
      setSubmissionSuccess(true);
    } catch (err: any) {
      setValidationError(err.message || 'Error completing registration after payment.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-[#121318] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                Create Class Album
              </h2>
              <p className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400">
                Official Department Archival Registration • KoHot
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
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
        <div className="p-5 sm:p-8 flex-1 overflow-y-auto">
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
                  STEP 1: GOOGLE ACCOUNT VERIFICATION
                  ========================================================================= */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Top Switch to Sign In for Existing Admins */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-syne font-bold text-xs text-slate-900 dark:text-white">
                        Already registered as an Album Admin?
                      </div>
                      <div className="font-body text-[11px] text-slate-500 dark:text-zinc-400">
                        Sign in to access your existing departmental dashboard.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenLogin) onOpenLogin();
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0"
                    >
                      Sign In Instead
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      1. Administrator Account
                    </h3>
                    <p className="font-body text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Sign in with Google. Your verified Google email becomes your permanent administrator email.
                    </p>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-4">
                    {/* Google Verification Status */}
                    {isGoogleVerified && adminEmail ? (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-syne font-bold text-xs text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Verified Google Account</span>
                          </div>
                          <span className="text-[10px] font-mono-tech uppercase bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 font-semibold">
                            Authenticated
                          </span>
                        </div>
                        <div className="font-mono-tech text-xs font-bold text-slate-900 dark:text-white">
                          {adminEmail}
                        </div>
                        <p className="text-[10px] font-mono-tech text-emerald-700 dark:text-emerald-400">
                          This verified Google email will be used to log into your Album Admin dashboard.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => {
                            const sampleEmail = 'admin.classrep@gmail.com';
                            handleVerifyGoogle(sampleEmail, 'Class Representative');
                          }}
                          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 dark:bg-[#1a1b22] dark:hover:bg-[#22232c] border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                          </svg>
                          <span>Sign in with Google</span>
                        </button>

                        <div className="pt-2 text-center">
                          <span className="text-[10px] font-mono-tech text-slate-400 dark:text-zinc-500 uppercase">
                            or enter your Google email
                          </span>
                          <div className="flex gap-2 mt-1.5">
                            <input
                              type="email"
                              value={adminEmail}
                              onChange={(e) => setAdminEmail(e.target.value)}
                              placeholder="e.g. rep.name@gmail.com"
                              className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs font-mono-tech text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#d4af37]"
                            />
                            <button
                              type="button"
                              onClick={() => handleVerifyGoogle(adminEmail)}
                              className="px-4 py-2 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer"
                            >
                              Verify
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Applicant Legal Name */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Applicant Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        placeholder="e.g. Oluwaseun Adeleke"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-body text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    {/* WhatsApp Contact Phone */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          WhatsApp / Contact Phone *
                        </label>
                        <span className="text-[10px] font-mono-tech text-slate-400 dark:text-zinc-500">
                          Contact detail only
                        </span>
                      </div>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          required
                          value={adminPhone}
                          onChange={(e) => setAdminPhone(e.target.value)}
                          placeholder="0903 000 0000"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>
                    </div>
                  </div>
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

                  {/* DUPLICATE WARNING OR ELIGIBILITY NOTICES */}
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
                        An official class album or pending registration already exists for{' '}
                        <strong>{selectedDepartmentName} (Class of {graduationYear})</strong>. Each department cohort can have only one official album.
                      </p>
                      {duplicateOfficialAlbum && (
                        <button
                          type="button"
                          onClick={() => setIsAlbumAdminHelpOpen(true)}
                          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold pt-1"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Claim or Dispute Administration Rights</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Rule C.2.d: Pending Founding Request in Department */}
                  {isDeptFoundingPendingDifferentYear && (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-mono-tech space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>Founding Request Awaiting Approval</span>
                      </div>
                      <p className="leading-relaxed text-[11px]">
                        A founding request for this department is awaiting approval. Please try again after it's approved.
                      </p>
                    </div>
                  )}

                  {/* Founding Class Eligibility Tag */}
                  {isFoundingClass && !isSameYearBlocked && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-mono-tech flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#d4af37]" />
                        <span>Department Founding Class Eligible (Free ₦0 • Host Approval Required)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#d4af37] text-black font-bold text-[10px]">
                        Founding
                      </span>
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
                        placeholder="backup@gmail.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  STEP 5: PRICING CARD & FINAL SUBMIT
                  ========================================================================= */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      5. Review &amp; Registration Pricing
                    </h3>
                    <p className="font-body text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Confirm cohort summary and complete registration.
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

                  {/* PRICING CARD (Prompt C.3 & C.4) */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-[#18181b] text-white border border-white/20 shadow-xl space-y-4">
                    {isFoundingClass ? (
                      /* Founding Path: Struck-through ₦50,000, ₦0, and Founding Class badge */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono-tech uppercase tracking-wider text-amber-400 font-bold">
                            Official Department Launch
                          </span>
                          <span className="px-3 py-1 rounded-full bg-[#d4af37] text-black font-syne font-extrabold text-xs uppercase shadow-sm">
                            Founding Class
                          </span>
                        </div>

                        <div className="flex items-baseline gap-3">
                          <span className="text-2xl text-zinc-500 line-through font-mono-tech font-bold">
                            ₦50,000
                          </span>
                          <span className="text-4xl sm:text-5xl font-syne font-black text-[#d4af37]">
                            ₦0
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 font-body leading-relaxed">
                          Your department has no prior albums preserved on KoHot. As the inaugural cohort, your class album registration is 100% free, pending review and verification by the Master Host.
                        </p>
                      </div>
                    ) : (
                      /* Standard Path: Flat ₦50,000 with per graduate note */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono-tech uppercase tracking-wider text-zinc-400 font-bold">
                            Official Class Album Registration
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-mono-tech text-[10px]">
                            Standard Registration
                          </span>
                        </div>

                        <div className="flex items-baseline gap-3 flex-wrap">
                          <span className="text-4xl sm:text-5xl font-syne font-black text-white">
                            ₦50,000
                          </span>
                          {perGraduateEstimate > 0 && (
                            <span className="text-xs font-mono-tech text-amber-400">
                              (about ₦{perGraduateEstimate.toLocaleString()} per graduate)
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-300 font-body leading-relaxed">
                          Includes lifetime archival preservation, official Department Legacy Wall placement, batch memories, peer voting, and graduation video showcase.
                        </p>
                      </div>
                    )}
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
                disabled={Boolean(currentStep === 2 && (isSameYearBlocked || isDeptFoundingPendingDifferentYear))}
                onClick={goToNextStep}
                className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-white dark:text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : isFoundingClass ? (
              /* Founding Button: "Submit" (Prompt A.6) */
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleInitiateFinalAction}
                className="px-7 py-2.5 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              >
                {isSubmitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-black" />
                    <span>Submit</span>
                  </>
                )}
              </button>
            ) : (
              /* Standard Button: "Pay ₦50,000 and Create Album" (Prompt C.4) */
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleInitiateFinalAction}
                className="px-7 py-2.5 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              >
                {isSubmitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5 text-black" />
                    <span>Pay ₦50,000 and Create Class Album</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Paystack Inline Checkout Modal */}
        {isPaystackOpen && (
          <PaystackModal
            isOpen={isPaystackOpen}
            onClose={() => setIsPaystackOpen(false)}
            amountNgn={STANDARD_PRICE}
            customerEmail={adminEmail}
            customerName={adminFullName}
            metadata={{
              universityName: currentUni?.name || '',
              departmentName: selectedDepartmentName,
              graduationYear: Number(graduationYear),
              classSetName: classSetName.trim() || `${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`,
            }}
            onSuccess={handlePaystackSuccess}
          />
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
      </div>
    </div>
  );
};
