import React, { useState, useRef, useEffect } from 'react';
import { ClassSet, StudentProfile, CropSettings } from '../../types';
import { compressImageToWebP, CompressionResult, fileToUniversalDataUrl } from '../../utils/imageCompressor';
import { 
  Upload, 
  CheckCircle2, 
  Check,
  Crown, 
  ArrowLeft, 
  ArrowRight,
  Eye, 
  User, 
  Send,
  Sliders,
  Crop,
  Instagram,
  Linkedin,
  Facebook,
  Calendar,
  ExternalLink,
  Sun,
  Moon
} from 'lucide-react';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from '../../utils/leadershipHierarchy';
import { updateSocialMetaTags } from '../../utils/metaTags';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { ImageCropModal } from '../common/ImageCropModal';
import { isValidEmail, checkEmailTypoSuggestion } from '../../utils/emailValidator';
import { SocialUrlInputField } from '../common/SocialUrlInputField';
import { generateGoogleCalendarUrl, downloadIcsCalendarFile } from '../../utils/calendarHelper';
import { getAlbumUrl } from '../../utils/urlHelper';
import { getTheme, applyTheme, toggleTheme, ThemeMode } from '../../utils/theme';
import {
  uploadMediaToR2,
  submitStudentProfileOnServer,
  fetchInviteUploadTokenFromServer,
  fetchPublicPaymentConfig,
} from '../../utils/apiClient';
import { PaystackModal } from '../common/PaystackModal';

interface StudentSubmissionPageProps {
  currentSet: ClassSet;
  onSubmitStudent: (student: StudentProfile) => void;
  onViewAlbum: () => void;
  onBackToHome?: () => void;
  onViewDemoAlbums?: () => void;
}

export const StudentSubmissionPage: React.FC<StudentSubmissionPageProps> = ({
  currentSet,
  onSubmitStudent,
  onViewAlbum,
  onBackToHome,
  onViewDemoAlbums,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState('');
  const [quote, setQuote] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailTypoSuggestion, setEmailTypoSuggestion] = useState<string | null>(null);
  const [hasConsent, setHasConsent] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [facebookHandle, setFacebookHandle] = useState('');
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [studentFeeNgn, setStudentFeeNgn] = useState<number>(500);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showRemindOptions, setShowRemindOptions] = useState(false);
  const [submittedStudent, setSubmittedStudent] = useState<StudentProfile | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string>('');
  const [activeStatusToken, setActiveStatusToken] = useState<string>('');
  const [submissionPaymentStatus, setSubmissionPaymentStatus] = useState<string>('unpaid');
  const [submissionApprovalStatus, setSubmissionApprovalStatus] = useState<string>('pending');
  const [isPaystackOpen, setIsPaystackOpen] = useState(false);
  const [isSubmittingServer, setIsSubmittingServer] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState('');
  const [rawPhotoUrl, setRawPhotoUrl] = useState('');
  const [cropSettings, setCropSettings] = useState<CropSettings | undefined>(undefined);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());
  const isLightMode = currentTheme === 'light';

  useEffect(() => {
    const saved = getTheme();
    setCurrentTheme(saved);
    applyTheme(saved);
  }, []);

  useEffect(() => {
    const handleThemeChanged = (e: any) => {
      if (e.detail?.theme) {
        setCurrentTheme(e.detail.theme);
      } else {
        setCurrentTheme(getTheme());
      }
    };
    window.addEventListener('kohot_theme_changed', handleThemeChanged);
    return () => window.removeEventListener('kohot_theme_changed', handleThemeChanged);
  }, []);

  const handleToggleInviteTheme = () => {
    const next = toggleTheme(currentTheme);
    setCurrentTheme(next);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSubmissionStatusFromServer = async (tokenToFetch?: string) => {
    const token = tokenToFetch || activeStatusToken;
    if (!token) return;
    try {
      const res = await fetch(`/api/submissions/status?token=${encodeURIComponent(token)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.submission) {
          setActiveSubmissionId(data.submission.id || activeSubmissionId);
          setSubmissionPaymentStatus(data.submission.paymentStatus || 'unpaid');
          setSubmissionApprovalStatus(data.submission.status || 'pending');
        }
      }
    } catch {}
  };

  // Scroll to top on mount, fetch invite token & student fee from server, and check status_token
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateSocialMetaTags({
      title: `Submit Your Profile | ${currentSet.departmentName} (Class of ${currentSet.graduationYear})`,
      description: `Join your classmates in the official digital class album for ${currentSet.departmentName}, ${currentSet.institutionName}. Submit your portrait, nickname, and parting quote!`,
      imageUrl: currentSet.bannerImageUrl,
      url: window.location.href,
    });

    fetchInviteUploadTokenFromServer(currentSet.id).then((t) => {
      if (t) setInviteToken(t);
    });
    fetchPublicPaymentConfig().then((cfg) => {
      if (cfg.studentFeeKobo > 0) {
        setStudentFeeNgn(Math.round(cfg.studentFeeKobo / 100));
      }
    });

    const params = new URLSearchParams(window.location.search);
    const statusTokenParam = params.get('status_token');
    if (statusTokenParam) {
      setActiveStatusToken(statusTokenParam);
      setIsSuccess(true);
      refreshSubmissionStatusFromServer(statusTokenParam);
    }
  }, [currentSet.id, currentSet.departmentName, currentSet.graduationYear, currentSet.institutionName, currentSet.bannerImageUrl]);

  const processSelectedFile = async (file: File) => {
    setUploadError(null);
    try {
      const result = await compressImageToWebP(file, 1200, 0.90);
      setRawPhotoUrl(result.dataUrl);
      setRawPhotoToCrop(result.dataUrl);
      setCropSettings(undefined);
      setIsCropModalOpen(true);
    } catch (err) {
      console.error('Error reading gallery file:', err);
      const fallbackUrl = await fileToUniversalDataUrl(file);
      if (fallbackUrl) {
        setRawPhotoUrl(fallbackUrl);
        setRawPhotoToCrop(fallbackUrl);
        setCropSettings(undefined);
        setIsCropModalOpen(true);
      }
    }
  };

  const handleApplyCrop = async (croppedDataUrl: string, newSettings?: CropSettings) => {
    setIsCompressing(true);
    setUploadError(null);
    try {
      const fetchRes = await fetch(croppedDataUrl);
      const blob = await fetchRes.blob();
      const file = new File([blob], 'student-portrait.webp', { type: 'image/webp' });

      const result = await compressImageToWebP(file, 800, 0.88);
      setCompressionInfo(result);

      let tokenToUse = inviteToken;
      if (!tokenToUse) {
        tokenToUse = await fetchInviteUploadTokenFromServer(currentSet.id);
        if (tokenToUse) setInviteToken(tokenToUse);
      }

      // Upload to Cloudflare R2 object storage (never save base64 dataUrl)
      const uploadRes = await uploadMediaToR2(result.dataUrl, {
        setId: currentSet.id,
        category: 'portrait',
        fileName: `${fullName ? fullName.replace(/\s+/g, '-').toLowerCase() : 'student'}-portrait.webp`,
        inviteToken: tokenToUse,
      });

      if (uploadRes.success && uploadRes.url && !uploadRes.url.startsWith('data:')) {
        setPhotoDataUrl(uploadRes.url);
      } else {
        setUploadError(uploadRes.error || 'Upload to cloud storage failed. Please click to retry.');
      }

      if (newSettings) setCropSettings(newSettings);
    } catch (err: any) {
      console.error('Compression/upload error:', err);
      setUploadError(err?.message || 'Image upload failed. Please try again.');
    } finally {
      setIsCompressing(false);
      setIsCropModalOpen(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file);
  };

  const validateStep1 = () => {
    if (!photoDataUrl || photoDataUrl.startsWith('data:')) {
      setUploadError('Please upload your official face portrait to cloud storage.');
      return false;
    }
    if (!fullName.trim()) {
      setEmailError('Please enter your full official name.');
      return false;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address (e.g. name@domain.com).');
      return false;
    }
    if (confirmEmail.trim() && confirmEmail.trim().toLowerCase() !== trimmedEmail) {
      setEmailError('Email confirmation does not match.');
      return false;
    }
    if (!hasConsent) {
      setEmailError('Please agree to the profile & annual convocation reminder consent.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (openCheckoutAfterSubmit: boolean = false) => {
    if (!fullName.trim() || !photoDataUrl || photoDataUrl.startsWith('data:')) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address to complete submission.');
      setCurrentStep(1);
      return;
    }
    setEmailError('');
    setIsSubmittingServer(true);

    const trimmedPos = position.trim();
    const hasLeaderTitle = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

    const newStudent: StudentProfile = {
      id: activeSubmissionId || `std-${Date.now()}`,
      setId: currentSet.id,
      fullName: fullName.trim(),
      nickname: nickname.trim() || undefined,
      position: trimmedPos || 'Member',
      photoUrl: photoDataUrl,
      rawPhotoUrl: photoDataUrl,
      cropSettings: cropSettings,
      originalSizeKb: compressionInfo?.originalSizeKb,
      compressedSizeKb: compressionInfo?.compressedSizeKb,
      quote: quote.trim() || undefined,
      bio: bio.trim() || undefined,
      email: trimmedEmail,
      instagramOrTwitter: (instagramHandle.trim() || twitterHandle.trim()) || undefined,
      socials: {
        instagram: instagramHandle.trim() || undefined,
        linkedin: linkedinHandle.trim() || undefined,
        twitter: twitterHandle.trim() || undefined,
        tiktok: tiktokHandle.trim() || undefined,
        facebook: facebookHandle.trim() || undefined,
      },
      approved: false,
      submittedAt: new Date().toISOString().split('T')[0],
      leaderOrder: hasLeaderTitle ? calculateIntuitiveHierarchyRank(trimmedPos) : undefined,
    };

    try {
      const serverRes = await submitStudentProfileOnServer(currentSet.id, newStudent, {
        source: 'student',
        consent: hasConsent,
      });

      const subId = serverRes.submissionId || newStudent.id;
      setActiveSubmissionId(subId);
      if (serverRes.statusToken) {
        setActiveStatusToken(serverRes.statusToken);
      }
      if (serverRes.paymentStatus) {
        setSubmissionPaymentStatus(serverRes.paymentStatus);
      }
      if (serverRes.status) {
        setSubmissionApprovalStatus(serverRes.status);
      }

      const finalStudent = { ...newStudent, id: subId };
      onSubmitStudent(finalStudent);
      setSubmittedStudent(finalStudent);
      setIsSubmittingServer(false);

      if (openCheckoutAfterSubmit) {
        setIsPaystackOpen(true);
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      setIsSubmittingServer(false);
      onSubmitStudent(newStudent);
      setSubmittedStudent(newStudent);
      setIsSuccess(true);
    }
  };

  return (
    <div id="student-submission-page" className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 font-body">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-neutral-800 px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBackToHome && (
              <button
                id="back-to-home-btn"
                onClick={onBackToHome}
                className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                title="Return to KoHot"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onBackToHome}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              title="Return to KoHot Website"
            >
              <span className="font-syne font-extrabold text-base tracking-tight text-slate-900 dark:text-white">KoHot</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[10px] font-mono-tech uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-bold">
                Graduate Entry
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono-tech text-slate-600 dark:text-slate-400 font-semibold">
              Class of {currentSet.graduationYear}
            </span>
            <button
              id="invite-form-theme-toggle-btn"
              type="button"
              onClick={handleToggleInviteTheme}
              role="switch"
              aria-checked={!isLightMode}
              aria-label={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-amber-400 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {isLightMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider font-bold text-slate-700">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider font-bold text-amber-300">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Compressed Compact Header (Ultra Clean) */}
      <section className="border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-4 sm:py-5 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-700 bg-white p-1 shadow-xs shrink-0">
              <img
                src={currentSet.institutionLogoUrl}
                alt={currentSet.institutionName}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-syne font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  {currentSet.departmentName}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-zinc-300 font-mono-tech text-[10px] font-bold">
                  Class of {currentSet.graduationYear}
                </span>
              </div>
              <p className="font-mono-tech text-[11px] text-slate-500 dark:text-slate-400">
                {currentSet.institutionName} {currentSet.classSetName ? `• ${currentSet.classSetName}` : ''}
              </p>
            </div>
          </div>

          <div className="hidden sm:block text-right text-[11px] font-mono-tech text-slate-500 dark:text-slate-400">
            Album Admin: <strong className="text-slate-900 dark:text-white">{currentSet.classRepName}</strong>
          </div>
        </div>
      </section>

      {/* 2-Step Progress Indicator at the Top */}
      {!isSuccess && (
        <section className="border-b border-slate-200 dark:border-neutral-800 bg-slate-100/60 dark:bg-neutral-900/40 py-3 px-4 sm:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-3 sm:gap-4 max-w-md mx-auto">
              {/* Step 1 Node */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="relative z-10 flex items-center gap-2 shrink-0 cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-tech text-xs font-bold transition-all shadow-xs ${
                  currentStep === 1
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 ring-4 ring-slate-900/10 dark:ring-white/10'
                    : 'bg-emerald-600 text-white'
                }`}>
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <span className={`text-xs font-mono-tech uppercase tracking-wider font-bold ${
                  currentStep === 1 ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400'
                }`}>
                  Profile Form
                </span>
              </button>

              {/* Connecting Progress Track Line (strictly between Step 1 and Step 2) */}
              <div className="flex-1 h-0.5 bg-slate-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900 dark:bg-white transition-all duration-300"
                  style={{ width: currentStep === 1 ? '0%' : '100%' }}
                />
              </div>

              {/* Step 2 Node */}
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setCurrentStep(2);
                }}
                className="relative z-10 flex items-center gap-2 shrink-0 cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-tech text-xs font-bold transition-all shadow-xs ${
                  currentStep === 2
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 ring-4 ring-slate-900/10 dark:ring-white/10'
                    : 'bg-slate-200 dark:bg-neutral-800 text-slate-500 dark:text-zinc-400'
                }`}>
                  2
                </div>
                <span className={`text-xs font-mono-tech uppercase tracking-wider font-bold ${
                  currentStep === 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'
                }`}>
                  Live Card Preview
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
        {isSuccess ? (
          /* =========================================================================
             SUCCESS STATE: Minimal Premium Confirmation Screen
             ========================================================================= */
          <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 text-center max-w-md mx-auto space-y-6 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Check className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="font-syne font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
                Profile Submitted!
              </h2>
              <p className="font-body text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Your profile card has been submitted to {currentSet.classRepName} for inclusion in the official class album.
              </p>
              <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono-tech uppercase font-bold bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300">
                  Review: {submissionApprovalStatus}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-mono-tech uppercase font-bold border ${
                    submissionPaymentStatus === 'paid'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  Payment: {submissionPaymentStatus === 'paid' ? 'Paid' : `Unpaid (₦${studentFeeNgn.toLocaleString()})`}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
              {submissionPaymentStatus !== 'paid' && activeSubmissionId && (
                <button
                  type="button"
                  onClick={() => setIsPaystackOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-mono-tech uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 py-3.5 px-6 rounded-full transition-all cursor-pointer shadow-md active:scale-95 font-bold"
                >
                  <span>Pay to publish (₦{studentFeeNgn.toLocaleString()})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onViewDemoAlbums) {
                    onViewDemoAlbums();
                  } else if (onViewAlbum) {
                    onViewAlbum();
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 text-xs font-mono-tech uppercase tracking-widest text-white bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 py-3.5 px-6 rounded-full transition-all cursor-pointer shadow-md active:scale-95 font-bold"
              >
                <span>View Class Album &rarr;</span>
              </button>

              {/* Remind me yearly button */}
              <button
                type="button"
                onClick={() => setShowRemindOptions(!showRemindOptions)}
                className="w-full inline-flex items-center justify-center gap-2 text-xs font-mono-tech uppercase tracking-wider text-amber-950 bg-amber-400 hover:bg-amber-300 py-3 px-6 rounded-full transition-all cursor-pointer shadow-sm active:scale-95 font-bold"
              >
                <Calendar className="w-4 h-4 text-amber-950" />
                <span>Remind Me Yearly</span>
              </button>

              {showRemindOptions && (
                <div className="w-full p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-2 text-left animate-fadeIn shadow-lg">
                  <div className="text-[10px] font-mono-tech text-slate-500 uppercase tracking-wider px-1">
                    Add yearly relive reminder:
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const url = generateGoogleCalendarUrl({
                        departmentName: currentSet.departmentName,
                        graduationYear: currentSet.graduationYear,
                        convocationDate: currentSet.convocationDate || currentSet.reminderSettings?.convocationDate,
                        albumUrl: getAlbumUrl(currentSet.id),
                      });
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-xs font-mono-tech flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                  >
                    <span>Google Calendar</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadIcsCalendarFile({
                        departmentName: currentSet.departmentName,
                        graduationYear: currentSet.graduationYear,
                        convocationDate: currentSet.convocationDate || currentSet.reminderSettings?.convocationDate,
                        albumUrl: getAlbumUrl(currentSet.id),
                      });
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-xs font-mono-tech flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                  >
                    <span>Apple / other (.ics)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Download</span>
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs font-mono-tech text-slate-400 tracking-wider">
              You can close this tab anytime
            </p>
          </div>
        ) : (
          <>
            {/* =========================================================================
                STEP 1: PROFILE FORM
                ========================================================================= */}
            {currentStep === 1 && (
              <form onSubmit={handleProceedToPreview} className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-6 shadow-sm">
                  {/* Photo Upload Section with Portrait Crop */}
                  <div className="space-y-2">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                      Official Face Portrait *
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Upload your portrait. You can frame and position your face before proceeding.
                    </p>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                        photoDataUrl
                          ? 'border-emerald-500/50 bg-emerald-500/[0.04]'
                          : 'border-slate-300 dark:border-neutral-700 hover:border-slate-400 dark:hover:border-neutral-600 bg-slate-50 dark:bg-neutral-950/60'
                      }`}
                    >
                      {photoDataUrl ? (
                        <div className="flex items-center justify-center gap-4">
                          <img
                            src={photoDataUrl}
                            alt="Portrait Preview"
                            className="w-20 h-20 aspect-square rounded-xl object-cover border border-slate-300 dark:border-neutral-700 shadow-md bg-white"
                          />
                          <div className="text-left space-y-1.5">
                            <p className="font-syne font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              Portrait photo added
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileInputRef.current?.click();
                                }}
                                className="px-3 py-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono-tech text-[11px] font-semibold hover:bg-black dark:hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRawPhotoToCrop(rawPhotoUrl || photoDataUrl);
                                  setIsCropModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-800 dark:text-slate-200 font-mono-tech text-[10px] flex items-center gap-1 cursor-pointer transition-colors border border-slate-300 dark:border-neutral-700"
                              >
                                <Crop className="w-3 h-3 text-amber-500" />
                                <span>Adjust Crop</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-4">
                          <div className="w-12 h-12 rounded-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto shadow-xs">
                            <Upload className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div>
                            <p className="font-syne font-bold text-sm text-slate-900 dark:text-white">
                              {isCompressing ? 'Uploading photo to cloud...' : 'Click to Upload Portrait or Drag & Drop'}
                            </p>
                            <p className="font-mono-tech text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              JPG, PNG, WEBP supported (Max 2 MB)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    {uploadError && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-mono-tech mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {uploadError}
                      </p>
                    )}
                  </div>

                  {/* Name and Nickname */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                        Full Official Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Adebayo Ogunlesi"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none shadow-xs text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                        Nickname / Moniker <span className="text-slate-500 lowercase font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="e.g. Bayo, Boss"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none shadow-xs text-xs"
                      />
                    </div>
                  </div>

                  {/* Role / Leadership Position with Pocket List */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                        Class Role / Title <span className="text-slate-500 lowercase font-normal">(optional)</span>
                      </label>
                      <span className="text-[10px] font-mono-tech text-amber-600 dark:text-amber-400">
                        Select or type custom
                      </span>
                    </div>
                    <input
                      type="text"
                      list="student-roles-pocket-list"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. Social Director or Class Rep"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none shadow-xs text-xs"
                    />
                  </div>

                  {/* Parting Quote */}
                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                      Parting Quote <span className="text-slate-500 lowercase font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      placeholder="e.g. We came, we learned, we conquered."
                      className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none shadow-xs text-xs"
                    />
                  </div>

                  {/* The Story */}
                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                      The Story <span className="text-slate-500 lowercase font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="e.g. Building sustainable tech solutions across Africa."
                      className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none resize-none shadow-xs text-xs"
                    />
                  </div>

                  {/* Email Address & Confirmation */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                            Email Address *
                          </label>
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmail(val);
                            setEmailTypoSuggestion(checkEmailTypoSuggestion(val));
                            if (emailError) setEmailError('');
                          }}
                          placeholder="e.g. adebayo@alumni.edu"
                          className={`w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none text-xs transition-colors shadow-xs ${
                            emailError ? 'border-red-500 focus:border-red-500' : 'border-slate-300 dark:border-neutral-700 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900'
                          }`}
                        />
                        {emailTypoSuggestion && (
                          <button
                            type="button"
                            onClick={() => {
                              setEmail(emailTypoSuggestion);
                              setConfirmEmail(emailTypoSuggestion);
                              setEmailTypoSuggestion(null);
                            }}
                            className="text-[11px] text-amber-600 dark:text-amber-400 font-mono-tech mt-1 underline cursor-pointer"
                          >
                            Did you mean {emailTypoSuggestion}?
                          </button>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                            Confirm Email *
                          </label>
                        </div>
                        <input
                          type="email"
                          required
                          value={confirmEmail}
                          onChange={(e) => {
                            setConfirmEmail(e.target.value);
                            if (emailError) setEmailError('');
                          }}
                          placeholder="Re-enter email address"
                          className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none text-xs transition-colors shadow-xs"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={hasConsent}
                        onChange={(e) => setHasConsent(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-amber-500"
                      />
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        I agree my profile appears in the class album and I receive annual convocation reminders
                      </span>
                    </label>

                    {emailError && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-mono-tech mt-1.5 flex items-center gap-1 animate-fadeIn">
                        <span>⚠</span> {emailError}
                      </p>
                    )}
                  </div>

                  {/* Social Profiles Matching Admin Edit Card */}
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-neutral-800">
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                        Social Profiles <span className="text-slate-500 lowercase font-normal">(optional)</span>
                      </label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-tech mt-0.5">
                        These will be displayed as interactive link icons on your card.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SocialUrlInputField
                        label="Instagram"
                        prefix="instagram.com/"
                        value={instagramHandle}
                        onChange={setInstagramHandle}
                        placeholder="username"
                        icon={<Instagram className="w-3 h-3 text-[#E1306C]" />}
                        isLightMode={isLightMode}
                      />

                      <SocialUrlInputField
                        label="TikTok"
                        prefix="tiktok.com/@"
                        value={tiktokHandle}
                        onChange={setTiktokHandle}
                        placeholder="username"
                        icon={
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3 h-3 fill-current text-slate-900 dark:text-white">
                            <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 2.373-4.538c.328 0 .644.055.938.156V9.43a6.33 6.33 0 0 0-.938-.07 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.756a8.196 8.196 0 0 0 4.771 1.517V6.828c-.352 0-.691-.049-1-.142z"/>
                          </svg>
                        }
                        isLightMode={isLightMode}
                      />

                      <SocialUrlInputField
                        label="X (Twitter)"
                        prefix="x.com/"
                        value={twitterHandle}
                        onChange={setTwitterHandle}
                        placeholder="handle"
                        icon={
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3 h-3 fill-current text-slate-900 dark:text-white">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        }
                        isLightMode={isLightMode}
                      />

                      <SocialUrlInputField
                        label="LinkedIn"
                        prefix="linkedin.com/in/"
                        value={linkedinHandle}
                        onChange={setLinkedinHandle}
                        placeholder="username"
                        icon={<Linkedin className="w-3 h-3 text-[#0077b5]" />}
                        isLightMode={isLightMode}
                      />

                      <div className="sm:col-span-2">
                        <SocialUrlInputField
                          label="Facebook"
                          prefix="facebook.com/"
                          value={facebookHandle}
                          onChange={setFacebookHandle}
                          placeholder="username"
                          icon={<Facebook className="w-3 h-3 text-[#1877F2]" />}
                          isLightMode={isLightMode}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Proceed to Preview Button */}
                  <div className="pt-4 border-t border-slate-200 dark:border-neutral-800">
                    <button
                      type="submit"
                      disabled={!fullName.trim() || !photoDataUrl || isCompressing}
                      className="w-full py-3.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 disabled:opacity-40 text-white dark:text-slate-900 font-syne font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-95"
                    >
                      <span>Continue to Live Card Preview</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* =========================================================================
                STEP 2: LIVE CARD PREVIEW & FINAL SUBMIT
                ========================================================================= */}
            {currentStep === 2 && (
              <div className="max-w-md mx-auto space-y-6 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h2 className="font-syne font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
                    Live Graduate Card Preview
                  </h2>
                  <p className="font-mono-tech text-xs text-slate-600 dark:text-zinc-400">
                    Here is how your permanent profile will appear to classmates and alumni in the album.
                  </p>
                </div>

                {/* Preview Card matching DepartmentAlbumView 4:5 grid format */}
                <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 overflow-hidden shadow-xl text-slate-900 dark:text-white">
                  {/* Photo with exact 1:1 aspect ratio */}
                  <div className="relative w-full aspect-square bg-slate-100 dark:bg-neutral-950 overflow-hidden">
                    {photoDataUrl ? (
                      <img
                        src={photoDataUrl}
                        alt={fullName}
                        className="w-full h-full object-cover filter contrast-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <User className="w-16 h-16" />
                      </div>
                    )}

                    {position && (
                      <div className="absolute bottom-3 left-3 right-3 z-10">
                        <span className="inline-block px-2.5 py-1 max-w-full truncate text-[10px] font-mono-tech uppercase tracking-wider backdrop-blur-md rounded-full bg-black/80 text-white border border-white/20 font-semibold shadow">
                          {position}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Details */}
                  <div className="p-5 space-y-3">
                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="font-syne font-bold text-lg text-slate-900 dark:text-white">
                          {fullName || 'Your Full Name'}
                        </h3>
                        {nickname && (
                          <span className="font-mono-tech text-xs text-slate-500 dark:text-zinc-400 font-semibold">
                            "{nickname}"
                          </span>
                        )}
                      </div>
                      <p className="font-mono-tech text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-semibold">
                        {currentSet.departmentName} • Class of {currentSet.graduationYear}
                      </p>
                    </div>

                    {quote && (
                      <div className="pt-2 border-t border-slate-100 dark:border-neutral-800">
                        <p className="font-body text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                          "{quote}"
                        </p>
                      </div>
                    )}

                    {bio && (
                      <div className="pt-2 border-t border-slate-100 dark:border-neutral-800">
                        <p className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                          {bio}
                        </p>
                      </div>
                    )}

                    {/* Social Row */}
                    {(instagramHandle || twitterHandle || tiktokHandle || linkedinHandle || facebookHandle) && (
                      <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] uppercase text-slate-500 tracking-wider">
                          Socials
                        </span>
                        <SocialIconsRow
                          socials={{
                            instagram: instagramHandle,
                            twitter: twitterHandle,
                            tiktok: tiktokHandle,
                            linkedin: linkedinHandle,
                            facebook: facebookHandle,
                          }}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Fee Notice (Price from settings, never slot counts) */}
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <span className="font-mono-tech text-slate-600 dark:text-slate-400">
                    Student Profile Publishing Fee
                  </span>
                  <span className="font-syne font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    ₦{studentFeeNgn.toLocaleString()}
                  </span>
                </div>

                {/* Step 2 Actions: Pay now at the top, Submit Anyway + short subtext underneath */}
                <div className="space-y-3 pt-2">
                  <button
                    id="step2-pay-now-btn"
                    type="button"
                    disabled={isSubmittingServer}
                    onClick={() => handleSubmit(true)}
                    className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-syne font-bold text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98"
                  >
                    <span>Pay now (₦{studentFeeNgn.toLocaleString()})</span>
                  </button>

                  <button
                    id="step2-submit-anyway-btn"
                    type="button"
                    disabled={isSubmittingServer}
                    onClick={() => handleSubmit(false)}
                    className="w-full py-3 px-5 rounded-2xl bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white transition-all cursor-pointer shadow-xs flex flex-col items-center justify-center gap-1 active:scale-98"
                  >
                    <span className="font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>{isSubmittingServer ? 'Submitting...' : 'Submit Anyway'}</span>
                      <Send className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-mono-tech text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-snug text-center">
                      Only if paid to admin or sponsored — else rejected by admin.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-full py-2.5 rounded-full bg-transparent hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
                  >
                    &larr; Back to Edit
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Real Paystack Checkout Modal for Student "Pay now" and "Pay to publish" */}
      {isPaystackOpen && (
        <PaystackModal
          isOpen={isPaystackOpen}
          onClose={() => {
            setIsPaystackOpen(false);
            setIsSuccess(true);
          }}
          amountNgn={studentFeeNgn}
          customerEmail={email.trim()}
          customerName={fullName.trim()}
          paymentType="student"
          albumId={currentSet.id}
          submissionId={activeSubmissionId}
          metadata={{
            universityName: currentSet.institutionName,
            departmentName: currentSet.departmentName,
            graduationYear: currentSet.graduationYear,
            classSetName: currentSet.classSetName,
          }}
          onSuccess={async () => {
            setSubmissionPaymentStatus('paid');
            await refreshSubmissionStatusFromServer();
            setTimeout(() => {
              setIsPaystackOpen(false);
              setIsSuccess(true);
            }, 900);
          }}
        />
      )}

      {/* Profile Photo Crop Modal (Square Frame) */}
      {isCropModalOpen && rawPhotoToCrop && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={rawPhotoToCrop}
          initialCropSettings={cropSettings}
          onClose={() => setIsCropModalOpen(false)}
          onApplyCrop={handleApplyCrop}
          initialAspectRatio="1:1"
          isProfileSubmission={true}
          title="Position Your Portrait"
          helperText="Move the square portrait frame across your photo to capture your face."
        />
      )}
    </div>
  );
};
