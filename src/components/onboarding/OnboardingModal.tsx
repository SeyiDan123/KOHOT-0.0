import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  UniversityDirectoryItem, 
  ClassSet, 
  DepartmentAdditionRequest, 
  FoundingClassRequest,
  FinancialTransaction, 
  UserAccount,
  NextClassInviteContext
} from '../../types';
import { 
  X, 
  Building2, 
  GraduationCap, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  UserCheck, 
  Users, 
  Phone, 
  Mail, 
  ShieldAlert, 
  HelpCircle,
  Lock,
  Sparkles,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Send,
  LogIn
} from 'lucide-react';
import { saveStoredAuditLogs, getStoredAuditLogs } from '../../data/initialData';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { AlbumAdminHelpModal } from '../admin/AlbumAdminHelpModal';
import { pickContactPhoneNumber } from '../../utils/contactPickerHelper';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  foundingRequests: FoundingClassRequest[];
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
  { step: 1, title: 'Account', desc: 'Admin Registration' },
  { step: 2, title: 'Class', desc: 'Cohort Details' },
  { step: 3, title: 'Album Admin', desc: 'Applicant Authority' },
  { step: 4, title: 'Backup Contact', desc: 'Recovery Continuity' },
  { step: 5, title: 'Review & Submit', desc: 'Final Verification' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  universities = [],
  sets = [],
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

  // Authenticated KoHot account (fresh fields for new album registration - no pre-fill)
  const [adminFullName, setAdminFullName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPhone, setAdminPhone] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);

  // Determine if this is a Subsequent Class Relay Handover path
  const isRelayMode = Boolean(inviteContext && inviteContext.inviteCode);

  // Step 2: Class Details
  const [selectedUniId, setSelectedUniId] = useState<string>(
    inviteContext?.universityId || initialUniversityId || universities[0]?.id || 'unilag'
  );
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string>(
    initialDepartmentName || ''
  );
  const lockedRelayYear = inviteContext ? inviteContext.targetYear : undefined;
  const [graduationYear, setGraduationYear] = useState<number>(
    lockedRelayYear || initialGraduationYear || 2026
  );
  const [estimatedGraduates, setEstimatedGraduates] = useState<number>(100);
  const [classSetName, setClassSetName] = useState<string>('');
  const [academicYears, setAcademicYears] = useState<number>(4);
  const [classMotto, setClassMotto] = useState<string>('');

  // Step 3: Album Admin Details (Current/Existing Role only, WhatsApp)
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

  // General Status
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [showHelpNotice, setShowHelpNotice] = useState(false);
  const [isAlbumAdminHelpOpen, setIsAlbumAdminHelpOpen] = useState(false);

  // Reset state on modal open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setValidationError(null);
      setSubmissionSuccess(false);
      setShowHelpNotice(false);
      setIsAlbumAdminHelpOpen(false);
      setAdminFullName('');
      setAdminEmail('');
      setAdminPhone('');
      setAdminPassword('');
      setActiveUser(null);
      setRepPhone('');
      setBackupName('');
      setBackupPhone('');
      setBackupEmail('');
      setClassSetName('');
      setClassMotto('');
    }
  }, [isOpen]);

  // Resolve University & Faculties
  const currentUni = useMemo(() => {
    return universities.find((u) => u.id === selectedUniId) || universities[0];
  }, [universities, selectedUniId]);

  const facultiesList = useMemo(() => {
    if (!currentUni || !currentUni.faculties || currentUni.faculties.length === 0) {
      return [{
        facultyName: 'Faculty of Science',
        departments: ['Computer Science', 'Mathematics', 'Physics', 'Microbiology']
      }];
    }
    return currentUni.faculties;
  }, [currentUni]);

  // Default faculty and department selection on university change
  useEffect(() => {
    if (facultiesList && facultiesList.length > 0) {
      if (!selectedFaculty || !facultiesList.some((f) => f.facultyName === selectedFaculty)) {
        setSelectedFaculty(facultiesList[0].facultyName);
      }
    }
  }, [facultiesList, selectedFaculty]);

  const departmentsList = useMemo(() => {
    const fObj = facultiesList.find((f) => f.facultyName === selectedFaculty);
    if (fObj && fObj.departments) {
      return fObj.departments;
    }
    return facultiesList[0]?.departments || ['Computer Science'];
  }, [facultiesList, selectedFaculty]);

  useEffect(() => {
    if (departmentsList && departmentsList.length > 0) {
      if (!selectedDepartmentName || !departmentsList.includes(selectedDepartmentName)) {
        if (!initialDepartmentName || !departmentsList.includes(initialDepartmentName)) {
          setSelectedDepartmentName(departmentsList[0]);
        }
      }
    }
  }, [departmentsList, selectedDepartmentName, initialDepartmentName]);

  // DUPLICATE OFFICIAL ALBUM DETECTION
  const duplicateOfficialAlbum = useMemo(() => {
    if (!selectedDepartmentName || !graduationYear) return null;
    return sets.find(
      (s) =>
        s.institutionId === selectedUniId &&
        s.departmentName.toLowerCase() === selectedDepartmentName.toLowerCase() &&
        s.graduationYear === Number(graduationYear)
    );
  }, [sets, selectedUniId, selectedDepartmentName, graduationYear]);

  // Handle department addition submission
  const handleSubmitAddition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqDeptName.trim()) return;

    onRequestAddition({
      id: `req-dept-${Date.now()}`,
      institutionName: currentUni.name,
      requestedDepartment: reqDeptName.trim(),
      facultyName: reqFacultyName.trim() || 'Faculty of Science',
      requesterName: adminFullName.trim() || 'Prospective Class Rep',
      requesterEmail: adminEmail.trim() || 'applicant@kohot.app',
      requesterPhone: adminPhone.trim() || '09030000000',
      status: 'Pending',
      timestamp: new Date().toISOString()
    });

    setIsRequestingNewDept(false);
    setAdditionSentToast(true);
    setTimeout(() => setAdditionSentToast(false), 4000);
  };

  // Universal safe scroll lock
  useStaticBackdropScrollLock(isOpen);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [isPrefilled, setIsPrefilled] = useState(false);

  // Testing Prefill Helper for quick evaluation
  const handlePrefillTestData = () => {
    setAdminFullName('Oluwaseun Adeleke');
    setAdminEmail('seun.adeleke@gmail.com');
    setAdminPhone('08035678901');
    setAdminPassword('KoHotTest2025!');
    setSelectedUniId('oau');
    setSelectedFaculty('Faculty of Technology');
    setSelectedDepartmentName('Computer Science & Engineering');
    setGraduationYear(2026);
    setClassSetName('The Class of Trailblazers');
    setEstimatedGraduates(85);
    setClassMotto('Excellence in Digital Innovation');
    setApplicantRole('Class Representative');
    setRepPhone('08035678901');
    setBackupName('Folake Danladi');
    setBackupPhone('08091234567');
    setBackupEmail('folake.danladi@gmail.com');
    setBackupRole('Assistant Class Representative');
    setValidationError(null);
    setIsPrefilled(true);
    setTimeout(() => setIsPrefilled(false), 4500);
  };

  // Step Navigations
  const goToNextStep = () => {
    setValidationError(null);

    // Step 1 Validation: New Admin Registration (No prefill, fresh inputs)
    if (currentStep === 1) {
      if (!adminFullName.trim()) {
        setValidationError('Please enter your full legal name.');
        return;
      }
      if (!adminEmail.trim() || !adminEmail.includes('@')) {
        setValidationError('Please enter a valid official or personal email address.');
        return;
      }
      if (!adminPhone.trim() || adminPhone.trim().length < 8) {
        setValidationError('Please enter your active WhatsApp or mobile phone number.');
        return;
      }

      // Establish authenticated applicant credentials for new registration
      const newAdmin: UserAccount = {
        id: `usr-rep-${Date.now()}`,
        fullName: adminFullName.trim(),
        email: adminEmail.trim().toLowerCase(),
        phone: adminPhone.trim(),
        role: 'class_rep',
      };
      setActiveUser(newAdmin);
      setRepPhone(adminPhone.trim());
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!selectedDepartmentName) {
        setValidationError('Please select an official Department.');
        return;
      }
      if (!graduationYear || graduationYear < 1990 || graduationYear > 2035) {
        setValidationError('Please specify a valid Graduating Year.');
        return;
      }
      if (duplicateOfficialAlbum) {
        setValidationError('An official class album already exists for this graduating year.');
        return;
      }
      setCurrentStep(3);
      return;
    }

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

  // Final Submission Handler
  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const effectiveAdmin = activeUser || {
      id: `usr-rep-${Date.now()}`,
      fullName: adminFullName.trim() || 'Class Representative',
      email: adminEmail.trim().toLowerCase() || 'rep@kohot.edu.ng',
      phone: (adminPhone || repPhone).trim(),
      role: 'class_rep',
    };

    if (duplicateOfficialAlbum) {
      setValidationError('An official Class Album already exists for this graduating year.');
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);

    const effectiveRole = applicantRole === 'Other' && customRole.trim() ? customRole.trim() : applicantRole;
    const effectiveSetName = classSetName.trim() || `${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`;
    const effectiveDeptId = `dept-${currentUni.id}-${selectedDepartmentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Establish official album set
    const newAlbumId = `${currentUni.id}-${effectiveDeptId.replace(/^dept-/, '')}-${graduationYear}`;
    const nowIso = new Date().toISOString();

    const newAlbumSet: ClassSet = {
      id: newAlbumId,
      institutionId: currentUni.id,
      institutionName: currentUni.name,
      institutionLogoUrl: currentUni.logoUrl,
      departmentId: effectiveDeptId,
      departmentName: selectedDepartmentName,
      faculty: selectedFaculty || 'Faculty of Science',
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
          notes: `Official Class Album founded for ${selectedDepartmentName} (Class of ${graduationYear}).`,
        }
      ],
      activationStatus: 'active',
      activationDate: nowIso.split('T')[0],
      activationRef: `KOHOT-REG-${Math.floor(10000 + Math.random() * 90000)}`,
      bannerImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85',
      legacyGroupImageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=85',
      ourStory: `Continuing the legacy of ${selectedDepartmentName}, our graduating class registered this digital archive to preserve memories and achievements.`,
      students: [
        {
          id: `rep-std-${Date.now()}`,
          setId: newAlbumId,
          fullName: effectiveAdmin.fullName,
          nickname: 'Class Admin',
          position: effectiveRole || 'Class Representative',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=720&auto=format&fit=crop&q=85',
          quote: 'We preserve our departmental heritage and shared journey.',
          approved: true,
          submittedAt: nowIso.split('T')[0],
        }
      ],
      memories: [],
      awards: [],
      voices: [],
    };

    const userAccountForAdmin: UserAccount = {
      ...effectiveAdmin,
      role: 'class_rep',
      assignedSetId: newAlbumId,
      phone: (repPhone || adminPhone).trim(),
    };

    const emptyTx: FinancialTransaction = {
      id: `tx-reg-${Date.now()}`,
      reference: `KOHOT-REG-${Math.floor(10000 + Math.random() * 90000)}`,
      date: nowIso.replace('T', ' ').slice(0, 16),
      setId: newAlbumId,
      setName: effectiveSetName,
      institution: currentUni.name,
      amount: 0,
      currency: 'NGN',
      status: 'Paid',
      payerName: effectiveAdmin.fullName,
      payerEmail: effectiveAdmin.email,
    };

    setTimeout(() => {
      onRegisterSuccess(newAlbumSet, userAccountForAdmin, emptyTx);
      setIsSubmitting(false);
      setSubmissionSuccess(true);
    }, 700);
  };

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <div 
      id="onboarding-modal-backdrop"
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-5 md:p-6 animate-fadeIn text-slate-900 dark:text-zinc-100 select-none"
      onClick={onClose}
    >
      {/* High-Contrast Dialog Card: Clean Slate in Light, Charcoal & Mid-Grey in Dark */}
      <div 
        id="onboarding-modal-dialog"
        className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto text-slate-900 dark:text-zinc-100 select-auto transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-5 sm:px-8 py-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/95 dark:bg-[#1f1f23]/95 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-syne font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                Start Your Class Album
              </h2>
              <p className="font-mono-tech text-[11px] text-slate-600 dark:text-zinc-400">
                Official Department Archival Registration • KoHot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!submissionSuccess && (
              <button
                type="button"
                id="header-prefill-test-data-btn"
                onClick={handlePrefillTestData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 dark:text-amber-300 font-syne font-bold text-xs transition-colors cursor-pointer shadow-2xs active:scale-95"
                title="Prefill sample values to test the flow quickly"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden xs:inline">Prefill Demo Data</span>
                <span className="xs:hidden">Prefill</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Test Prefill Success Banner */}
        {isPrefilled && (
          <div className="mx-5 sm:mx-8 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-mono-tech flex items-center gap-2 animate-fadeIn shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Demo test data loaded!</strong> Form prefilled with sample admin details (OAU Computer Science &amp; Engineering, Class of 2026). Click through Next Step to test the full flow.
            </span>
          </div>
        )}

        {/* 5-Step Compact Progress Indicator */}
        {!submissionSuccess && (
          <div className="px-5 sm:px-8 py-3 bg-slate-100/70 dark:bg-zinc-900/70 border-b border-slate-200 dark:border-zinc-800 shrink-0 z-10">
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
                        ? 'bg-amber-500 text-slate-950 font-extrabold ring-2 ring-amber-500/40'
                        : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                    }`}>
                      {isPassed ? '✓' : s.step}
                    </span>
                    <div className={`hidden sm:block h-0.5 flex-1 rounded-full ${
                      isPassed ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-800'
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

        {/* Feedback / Validation Banner */}
        {validationError && (
          <div className="mx-5 sm:mx-8 mt-4 p-3 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-mono-tech flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Department Addition Success Toast */}
        {additionSentToast && (
          <div className="mx-5 sm:mx-8 mt-4 p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-mono-tech flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Department addition request submitted! Our team will review and add it shortly.</span>
          </div>
        )}

        {/* Step Body */}
        <div className="p-5 sm:p-8 flex-1 overflow-y-auto text-slate-900 dark:text-zinc-100">
          {submissionSuccess ? (
            /* Celebration Success State */
            <div className="py-8 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="font-syne font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
                  Class Album Registration Submitted!
                </h3>
                <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Your registration for <strong>{selectedDepartmentName} (Class of {graduationYear})</strong> has been received and initialized on KoHot.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 text-left max-w-md mx-auto space-y-2 text-xs font-mono-tech text-slate-900 dark:text-zinc-100 shadow-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Applicant:</span>
                  <span className="text-slate-900 dark:text-white font-bold">{adminFullName || activeUser?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Email:</span>
                  <span className="text-slate-900 dark:text-white">{adminEmail || activeUser?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Backup Contact:</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{backupName} ({backupPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Status:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase">Ready &amp; Active</span>
                </div>
              </div>

              <p className="text-[11px] font-mono-tech text-slate-600 dark:text-zinc-400 max-w-md mx-auto">
                You now have full Class Album Admin access to invite classmates, approve submissions, and build your digital heritage.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-syne font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg active:scale-95"
                >
                  Done &amp; Open Album
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* =========================================================================
                  STEP 1: NEW ALBUM REGISTRATION (NO PRE-FILL / SIGN IN CTA FOR REGISTERED ADMINS)
                  ========================================================================= */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Top Sign-in Switch CTA for already registered admins */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-zinc-700">
                        <LogIn className="w-4 h-4 text-slate-900 dark:text-white" />
                      </div>
                      <div>
                        <div className="font-syne font-bold text-xs text-slate-900 dark:text-white">
                          Already registered as an Album Admin?
                        </div>
                        <div className="font-body text-[11px] text-slate-600 dark:text-zinc-400">
                          Log in directly to manage your existing class album.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenLogin) onOpenLogin();
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs shrink-0 active:scale-95 text-center"
                    >
                      Sign In Instead
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                        1. New Class Album Registration
                      </h3>
                      <p className="font-body text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        Register your cohort album and create your primary administrator credentials.
                      </p>
                    </div>
                    <button
                      type="button"
                      id="prefill-test-data-btn"
                      onClick={handlePrefillTestData}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 dark:text-amber-300 font-syne font-bold text-xs transition-colors cursor-pointer shadow-2xs active:scale-95 shrink-0"
                      title="Prefill sample values to test the flow quickly"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Prefill Demo Data for Testing</span>
                    </button>
                  </div>

                  {/* Clean Registration Form Card */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 space-y-4 shadow-sm text-slate-900 dark:text-zinc-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Applicant Legal Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={adminFullName}
                          onChange={(e) => setAdminFullName(e.target.value)}
                          placeholder="e.g. Oluwaseun Adeleke"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                        />
                      </div>

                      {/* Email Address */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Active Email Address *
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="email"
                            required
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            placeholder="admin@unilag.edu.ng"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                          />
                        </div>
                      </div>

                      {/* WhatsApp / Mobile Number */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          WhatsApp / Mobile Number *
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="tel"
                            required
                            value={adminPhone}
                            onChange={(e) => {
                              setAdminPhone(e.target.value);
                              setRepPhone(e.target.value);
                            }}
                            placeholder="+234 812 345 6789"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                          />
                        </div>
                      </div>

                      {/* Admin Passcode / Password */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Create Admin Password / PIN *
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="password"
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                          />
                        </div>
                        <p className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-400">
                          Used to secure your administrative dashboard and album publishing privileges.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 text-[11px] font-mono-tech text-slate-600 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-800">
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>This form creates a new album registration for your graduating class.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  STEP 2: CLASS & COHORT DETAILS
                  ========================================================================= */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      2. Graduating Class &amp; Cohort Details
                    </h3>
                    <p className="font-body text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      Select your academic institution, faculty, department, and graduating set year.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 shadow-sm text-slate-900 dark:text-zinc-100">
                    {/* University */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        University / Higher Institution *
                      </label>
                      <select
                        value={selectedUniId}
                        onChange={(e) => {
                          setSelectedUniId(e.target.value);
                          const targetUni = universities.find((u) => u.id === e.target.value);
                          if (targetUni) {
                            const uFaculties = targetUni.faculties && targetUni.faculties.length > 0
                              ? targetUni.faculties
                              : [{ facultyName: 'Faculty of Science', departments: ['Computer Science'] }];
                            setSelectedFaculty(uFaculties[0]?.facultyName || '');
                            setSelectedDepartmentName(uFaculties[0]?.departments[0] || '');
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                      >
                        {universities.map((u) => (
                          <option key={u.id} value={u.id} className="text-slate-900 dark:text-white bg-white dark:bg-zinc-900">
                            {u.name} ({u.shortCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Faculty */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Faculty / College *
                      </label>
                      <select
                        value={selectedFaculty}
                        onChange={(e) => {
                          setSelectedFaculty(e.target.value);
                          const fObj = facultiesList.find((f) => f.facultyName === e.target.value);
                          if (fObj && fObj.departments.length > 0) {
                            setSelectedDepartmentName(fObj.departments[0]);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                      >
                        {facultiesList.map((f) => (
                          <option key={f.facultyName} value={f.facultyName} className="text-slate-900 dark:text-white bg-white dark:bg-zinc-900">
                            {f.facultyName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Department with request addition option */}
                    <div className="space-y-1.5">
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
                          <span>Add Missing Department</span>
                        </button>
                      </div>

                      <select
                        value={selectedDepartmentName}
                        onChange={(e) => setSelectedDepartmentName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                      >
                        {departmentsList.map((dept) => (
                          <option key={dept} value={dept} className="text-slate-900 dark:text-white bg-white dark:bg-zinc-900">
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Graduation Year */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Graduating Set Year *
                      </label>
                      <input
                        type="number"
                        min="1990"
                        max="2035"
                        disabled={Boolean(lockedRelayYear)}
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60 shadow-xs"
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>

                    {/* Class Name / Nickname */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Class Set Name / Nickname <span className="text-slate-500 dark:text-zinc-400 lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={classSetName}
                        onChange={(e) => setClassSetName(e.target.value)}
                        placeholder={`e.g. The Vanguard Set or ${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>

                    {/* Program Duration */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Program Duration (Years)
                      </label>
                      <select
                        value={academicYears}
                        onChange={(e) => setAcademicYears(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                      >
                        <option value={4} className="bg-white dark:bg-zinc-900">4 Years (Standard BSc / BA)</option>
                        <option value={5} className="bg-white dark:bg-zinc-900">5 Years (Engineering / Law / Pharmacy)</option>
                        <option value={6} className="bg-white dark:bg-zinc-900">6 Years (Medicine &amp; Surgery)</option>
                        <option value={2} className="bg-white dark:bg-zinc-900">2 Years (Postgraduate / Masters)</option>
                      </select>
                    </div>

                    {/* Optional Class Motto */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Class Motto / Slogan <span className="text-slate-500 dark:text-zinc-400 lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={classMotto}
                        onChange={(e) => setClassMotto(e.target.value)}
                        placeholder="e.g. United in Excellence, Inspiring the Future"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* DUPLICATE OFFICIAL ALBUM DETECTION CARD */}
                  {duplicateOfficialAlbum && (
                    <div 
                      id="class-album-already-exists-card"
                      className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 space-y-3 animate-fadeIn shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-200 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-syne font-bold text-sm text-slate-900 dark:text-white">
                            Class Album Already Exists
                          </h4>
                          <p className="font-body text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                            An official class album is already registered on KoHot for <strong>{duplicateOfficialAlbum.departmentName} (Class of {duplicateOfficialAlbum.graduationYear})</strong>.
                          </p>
                          <p className="font-body text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                            KoHot maintains exactly one official album per graduating set to protect archival integrity and avoid competing duplicates.
                          </p>
                        </div>
                      </div>

                      {/* Clean Simplified Admin Access Card & Single CTA */}
                      <div className="p-4 rounded-xl bg-white dark:bg-[#18181b] border border-amber-200 dark:border-amber-800/60 space-y-3">
                        <div className="space-y-1 text-xs font-mono-tech text-slate-700 dark:text-zinc-300">
                          <p>
                            Current verified administrator: <strong className="text-slate-950 dark:text-white">{duplicateOfficialAlbum.classRepName || 'Department Representative'}</strong>.
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                            If you are the official class representative and need administrator access, please email <strong>support@kohot.edu.ng</strong> or open our dedicated Album Admin Help desk.
                          </p>
                        </div>

                        <button
                          type="button"
                          id="btn-open-album-admin-help"
                          onClick={() => setIsAlbumAdminHelpOpen(true)}
                          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow flex items-center gap-2 active:scale-95"
                        >
                          <ShieldCheck className="w-4 h-4 text-slate-950" />
                          <span>Open Album Admin Help &rarr;</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  STEP 3: ALBUM ADMIN (Applicant Authority & Existing Role)
                  ========================================================================= */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      3. Applicant Authority &amp; Contact
                    </h3>
                    <p className="font-body text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      Confirm your current role in this graduating cohort. Your account will be designated as <strong>Class Album Admin</strong>.
                    </p>
                  </div>

                  <div className="space-y-4 p-5 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 shadow-sm text-slate-900 dark:text-zinc-100">
                    {/* Applicant Info Badge */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono-tech uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
                          Applicant Name
                        </span>
                        <div className="font-syne font-bold text-sm text-slate-900 dark:text-white">
                          {adminFullName || activeUser?.fullName}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono-tech uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
                          Official Email
                        </span>
                        <div className="font-mono-tech text-xs text-slate-900 dark:text-white font-semibold">
                          {adminEmail || activeUser?.email}
                        </div>
                      </div>
                    </div>

                    {/* Current/Existing Role */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Current / Existing Cohort Role *
                      </label>
                      <select
                        value={applicantRole}
                        onChange={(e) => setApplicantRole(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-xs"
                      >
                        <option value="Class Representative" className="bg-white dark:bg-zinc-900">Class Representative (Class Rep)</option>
                        <option value="Department President" className="bg-white dark:bg-zinc-900">Department President / Association President</option>
                        <option value="Vice President" className="bg-white dark:bg-zinc-900">Vice President</option>
                        <option value="General Secretary" className="bg-white dark:bg-zinc-900">General Secretary</option>
                        <option value="Public Relations Officer" className="bg-white dark:bg-zinc-900">Public Relations Officer (PRO)</option>
                        <option value="Class Album Committee Lead" className="bg-white dark:bg-zinc-900">Class Album Committee Lead</option>
                        <option value="Other" className="bg-white dark:bg-zinc-900">Other (Specify Below)</option>
                      </select>
                    </div>

                    {applicantRole === 'Other' && (
                      <div className="space-y-1.5 animate-fadeIn">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Specify Your Current Role *
                        </label>
                        <input
                          type="text"
                          required
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          placeholder="e.g. Social Director or Class Senator"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                        />
                      </div>
                    )}

                    {/* WhatsApp / Phone Number */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Active WhatsApp / Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          required
                          value={repPhone}
                          onChange={(e) => setRepPhone(e.target.value)}
                          placeholder="+234 812 345 6789"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                        />
                      </div>
                      <p className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-400">
                        Used for administrative verification, annual reconnect alerts, and urgent security checks.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-mono-tech text-slate-700 dark:text-zinc-300 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Note: Your KoHot account will formally hold the <strong>Class Album Admin</strong> role with full management authority.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  STEP 4: BACKUP CONTACT (Continuity & Recovery Record)
                  ========================================================================= */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      4. Designate Backup Contact
                    </h3>
                    <p className="font-body text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      Designate a trusted second person from your graduating cohort as a continuity and recovery contact.
                    </p>
                  </div>

                  {/* Clarification Box */}
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-1.5 text-xs text-slate-900 dark:text-zinc-100">
                    <div className="flex items-center gap-2 font-mono-tech uppercase text-amber-900 dark:text-amber-300 font-bold text-[11px]">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Continuity &amp; Recovery Contact</span>
                    </div>
                    <p className="text-slate-700 dark:text-zinc-300 font-body leading-relaxed">
                      This person serves as an emergency point of contact if the primary administrator becomes unreachable. <strong>This person is NOT a second administrator</strong> and cannot make changes unless administrative control is formally transferred.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 shadow-sm text-slate-900 dark:text-zinc-100">
                    {/* Backup Full Name */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Backup Contact Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={backupName}
                        onChange={(e) => setBackupName(e.target.value)}
                        placeholder="e.g. Chinedu Eze"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>

                    {/* Backup Phone / WhatsApp */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Backup WhatsApp / Phone *
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            const picked = await pickContactPhoneNumber();
                            if (picked) setBackupPhone(picked);
                          }}
                          className="text-[11px] font-mono-tech text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Select from Phone Contacts</span>
                        </button>
                      </div>
                      <input
                        type="tel"
                        required
                        value={backupPhone}
                        onChange={(e) => setBackupPhone(e.target.value)}
                        placeholder="+234 803 123 4567"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>

                    {/* Backup Email */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Backup Email <span className="text-slate-500 dark:text-zinc-400 lowercase">(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={backupEmail}
                        onChange={(e) => setBackupEmail(e.target.value)}
                        placeholder="backup@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>

                    {/* Relationship or Role */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                        Relationship / Current Class Role <span className="text-slate-500 dark:text-zinc-400 lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={backupRole}
                        onChange={(e) => setBackupRole(e.target.value)}
                        placeholder="e.g. Assistant Class Rep, Class Executive, or Trusted Course Mate"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  STEP 5: REVIEW & SUBMIT
                  ========================================================================= */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h3 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      5. Review &amp; Submit Registration
                    </h3>
                    <p className="font-body text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      Please confirm your submitted cohort information before final registration.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Section 1: Account & Applicant Authority */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 space-y-2 shadow-xs text-slate-900 dark:text-zinc-100">
                      <div className="text-[10px] font-mono-tech uppercase text-amber-600 dark:text-amber-400 font-bold tracking-wider">
                        Applicant Authority
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech">
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Name:</span>
                          <span className="text-slate-900 dark:text-white font-bold">{adminFullName || activeUser?.fullName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Email:</span>
                          <span className="text-slate-900 dark:text-white">{adminEmail || activeUser?.email}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Current Role:</span>
                          <span className="text-slate-900 dark:text-white">{applicantRole === 'Other' && customRole ? customRole : applicantRole}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">WhatsApp:</span>
                          <span className="text-slate-900 dark:text-white">{repPhone || adminPhone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Class Details */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 space-y-2 shadow-xs text-slate-900 dark:text-zinc-100">
                      <div className="text-[10px] font-mono-tech uppercase text-amber-600 dark:text-amber-400 font-bold tracking-wider">
                        Graduating Cohort
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech">
                        <div className="col-span-2">
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">University:</span>
                          <span className="text-slate-900 dark:text-white font-bold">{currentUni?.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Department:</span>
                          <span className="text-slate-900 dark:text-white">{selectedDepartmentName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Graduating Set:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold">Class of {graduationYear}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Class Name:</span>
                          <span className="text-slate-900 dark:text-white">{classSetName || `${selectedDepartmentName} Class of '${String(graduationYear).slice(-2)}`}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Est. Graduates:</span>
                          <span className="text-slate-700 dark:text-zinc-300">~{estimatedGraduates} students ({academicYears} yrs)</span>
                        </div>
                        {classMotto && (
                          <div className="col-span-2">
                            <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Motto:</span>
                            <span className="text-slate-700 dark:text-zinc-300 italic">"{classMotto}"</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 3: Backup Contact */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 space-y-2 shadow-xs text-slate-900 dark:text-zinc-100">
                      <div className="text-[10px] font-mono-tech uppercase text-slate-600 dark:text-zinc-400 font-bold tracking-wider">
                        Designated Recovery Contact
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech">
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Name:</span>
                          <span className="text-slate-900 dark:text-white font-bold">{backupName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Phone/WhatsApp:</span>
                          <span className="text-slate-900 dark:text-white">{backupPhone}</span>
                        </div>
                        {backupRole && (
                          <div className="col-span-2">
                            <span className="text-slate-500 dark:text-zinc-400 block text-[10px]">Relationship / Role:</span>
                            <span className="text-slate-700 dark:text-zinc-300">{backupRole}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submission Notice */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#202024] border border-slate-200 dark:border-zinc-700/80 text-[11px] font-mono-tech text-slate-600 dark:text-zinc-400 shadow-xs">
                    <p>
                      Submitting registers your class album on KoHot with full Album Admin authority to curate your cohort legacy.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Bottom Actions */}
        {!submissionSuccess && (
          <div className="px-5 sm:px-8 py-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/95 dark:bg-[#1f1f23]/95 flex items-center justify-between shrink-0 z-10">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goToPrevStep}
                className="px-4 py-2 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700 font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-zinc-700 font-mono-tech text-xs transition-colors cursor-pointer shadow-xs"
              >
                Cancel
              </button>
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                disabled={Boolean(currentStep === 2 && duplicateOfficialAlbum)}
                onClick={goToNextStep}
                className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-white dark:text-zinc-950 font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="px-7 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-syne font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              >
                {isSubmitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-slate-950" />
                    <span>Submit Class Album Registration</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Album Admin Help Support Modal for Duplicate Album / Access Inquiries */}
        {isAlbumAdminHelpOpen && duplicateOfficialAlbum && (
          <AlbumAdminHelpModal
            isOpen={isAlbumAdminHelpOpen}
            onClose={() => setIsAlbumAdminHelpOpen(false)}
            currentSet={duplicateOfficialAlbum}
            currentUser={activeUser || (adminEmail ? {
              id: 'temp-applicant',
              email: adminEmail,
              fullName: adminFullName || 'Class Rep Applicant',
              phone: adminPhone,
              role: 'class_rep',
            } : null)}
          />
        )}
      </div>

      {/* Centralized Add Missing Department Modal Card rendered via root portal */}
      {isRequestingNewDept && (
        <div 
          id="add-missing-department-backdrop"
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] p-4 flex items-center justify-center animate-fadeIn select-none"
          onClick={() => setIsRequestingNewDept(false)}
        >
          <form 
            onSubmit={handleSubmitAddition} 
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full space-y-4 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-900 dark:text-zinc-100 select-auto transition-colors duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-slate-900 dark:text-white">Add Missing Department</h3>
                  <p className="font-mono-tech text-[10px] text-slate-500 dark:text-zinc-400">Official catalog request</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestingNewDept(false)}
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer shadow-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono-tech uppercase text-slate-700 dark:text-zinc-300 font-bold">
                Department Name *
              </label>
              <input
                type="text"
                required
                value={reqDeptName}
                onChange={(e) => setReqDeptName(e.target.value)}
                placeholder="e.g. Department of Biomedical Engineering"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono-tech uppercase text-slate-700 dark:text-zinc-300 font-bold">
                Faculty Name
              </label>
              <input
                type="text"
                value={reqFacultyName}
                onChange={(e) => setReqFacultyName(e.target.value)}
                placeholder="e.g. Faculty of Technology"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech text-xs focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRequestingNewDept(false)}
                className="px-4 py-2 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white text-xs font-mono-tech cursor-pointer shadow-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-syne font-bold text-xs uppercase cursor-pointer shadow-sm transition-colors"
              >
                Submit Department
              </button>
            </div>
          </form>
        </div>
      )}
    </div>,
    document.body
  ) : null;
};
