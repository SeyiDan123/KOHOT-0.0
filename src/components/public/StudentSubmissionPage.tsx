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
  Moon,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
  Trophy,
  Mail,
  Search,
  Edit3,
  Plus,
  X
} from 'lucide-react';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from '../../utils/leadershipHierarchy';
import {
  cleanWhatsAppStoryText,
  parseStoryBlocks,
  countStoryWords,
  getStoryCardPreview
} from '../../utils/storyFormatting';
import {
  getAwardVisualConfig,
  getDistinctAwardVisualsForList,
  getStudentCombinedAwards,
} from '../../utils/awardVisuals';
import { updateSocialMetaTags } from '../../utils/metaTags';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { GlazedImage } from '../common/GlazedImage';
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
  ResolvedCohortPricing,
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
  const [entryMode, setEntryMode] = useState<'submit' | 'edit'>('submit');
  const [selectedEditStudent, setSelectedEditStudent] = useState<StudentProfile | null>(null);
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState('');
  const [quote, setQuote] = useState('');
  const [bio] = useState('');
  const [myStory, setMyStory] = useState('');
  const [isStoryExpanded, setIsStoryExpanded] = useState(false);
  const [isReviewStoryExpanded, setIsReviewStoryExpanded] = useState(false);
  const [isMoreAboutMeExpanded, setIsMoreAboutMeExpanded] = useState(false);
  const [isFinalWordsExpanded, setIsFinalWordsExpanded] = useState(false);
  const [isAwardsRevealed, setIsAwardsRevealed] = useState(false);
  const [studentAwards, setStudentAwards] = useState<
    Array<{ id: string; category: string; citation?: string; trophyType?: string }>
  >([]);
  const [newAwardTitle, setNewAwardTitle] = useState('');
  const [favouriteCampusMemory, setFavouriteCampusMemory] = useState('');
  const [funFact, setFunFact] = useState('');
  const [whatsNext, setWhatsNext] = useState('');
  const [messageToClassmates, setMessageToClassmates] = useState('');
  const [messageToFutureSet, setMessageToFutureSet] = useState('');
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
  const [secondaryPhotoDataUrl, setSecondaryPhotoDataUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [studentFeeNgn, setStudentFeeNgn] = useState<number>(500);
  const [standardFeeNgn, setStandardFeeNgn] = useState<number>(500);
  const [resolvedPricing, setResolvedPricing] = useState<ResolvedCohortPricing | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isCompressingSecondary, setIsCompressingSecondary] = useState(false);
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
  const [cropTarget, setCropTarget] = useState<'primary' | 'secondary'>('primary');
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState('');
  const [rawPhotoUrl, setRawPhotoUrl] = useState('');
  const [rawSecondaryPhotoUrl, setRawSecondaryPhotoUrl] = useState('');
  const [cropSettings, setCropSettings] = useState<CropSettings | undefined>(undefined);
  const [secondaryCropSettings, setSecondaryCropSettings] = useState<CropSettings | undefined>(undefined);
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
  const secondaryFileInputRef = useRef<HTMLInputElement>(null);

  const editableClassmates = React.useMemo(() => {
    const list = (currentSet.students || []).filter(
      (s) => s.submissionStatus !== 'removed' && s.submissionStatus !== 'declined'
    );
    const sorted = [...list].sort((a, b) =>
      (a.fullName || '').localeCompare(b.fullName || '')
    );
    const q = editSearchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.nickname || '').toLowerCase().includes(q) ||
        (s.position || '').toLowerCase().includes(q)
    );
  }, [currentSet.students, editSearchQuery]);

  const handleSelectExistingStudentForEdit = (student: StudentProfile) => {
    setSelectedEditStudent(student);
    setActiveSubmissionId(student.id);
    setFullName(student.fullName || '');
    setNickname(student.nickname || '');
    setPosition(student.position && student.position !== 'Member' ? student.position : '');
    setQuote(student.quote || '');
    setMyStory(student.myStory || '');
    setIsStoryExpanded(Boolean(student.myStory));
    setFavouriteCampusMemory(student.favouriteCampusMemory || '');
    setFunFact(student.funFact || '');
    setWhatsNext(student.whatsNext || '');
    setIsMoreAboutMeExpanded(
      Boolean(student.favouriteCampusMemory || student.funFact || student.whatsNext)
    );
    setMessageToClassmates(student.messageToClassmates || '');
    setMessageToFutureSet(student.messageToFutureSet || '');
    setIsFinalWordsExpanded(
      Boolean(student.messageToClassmates || student.messageToFutureSet)
    );
    const existingEmail = student.email || '';
    setEmail(existingEmail);
    setConfirmEmail(existingEmail);
    setInstagramHandle(student.socials?.instagram || student.instagramOrTwitter || '');
    setTwitterHandle(student.socials?.twitter || '');
    setTiktokHandle(student.socials?.tiktok || '');
    setLinkedinHandle(student.socials?.linkedin || '');
    setFacebookHandle(student.socials?.facebook || '');
    setPhotoDataUrl(student.photoUrl || '');
    setRawPhotoUrl(student.rawPhotoUrl || student.photoUrl || '');
    setCropSettings(student.cropSettings);
    setSecondaryPhotoDataUrl(student.secondaryPhotoUrl || '');
    setRawSecondaryPhotoUrl(student.rawSecondaryPhotoUrl || student.secondaryPhotoUrl || '');
    setSecondaryCropSettings(student.secondaryCropSettings);
    const combinedAwards = getStudentCombinedAwards(student, currentSet.awards).map((a) => ({
      id: a.id,
      category: a.category,
      citation: a.citation,
      trophyType: a.trophyType,
    }));
    setStudentAwards(combinedAwards);
    setNewAwardTitle('');
    setUploadError(null);
    setEmailError('');
  };

  const handleResetToNewSubmission = () => {
    setSelectedEditStudent(null);
    setActiveSubmissionId('');
    setFullName('');
    setNickname('');
    setPosition('');
    setQuote('');
    setMyStory('');
    setIsStoryExpanded(false);
    setFavouriteCampusMemory('');
    setFunFact('');
    setWhatsNext('');
    setIsMoreAboutMeExpanded(false);
    setMessageToClassmates('');
    setMessageToFutureSet('');
    setIsFinalWordsExpanded(false);
    setStudentAwards([]);
    setNewAwardTitle('');
    setEmail('');
    setConfirmEmail('');
    setInstagramHandle('');
    setTwitterHandle('');
    setTiktokHandle('');
    setLinkedinHandle('');
    setFacebookHandle('');
    setPhotoDataUrl('');
    setRawPhotoUrl('');
    setCropSettings(undefined);
    setSecondaryPhotoDataUrl('');
    setRawSecondaryPhotoUrl('');
    setSecondaryCropSettings(undefined);
    setUploadError(null);
    setEmailError('');
    setCurrentStep(1);
  };

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

    // Ensure invite pages carry noindex
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const prevRobots = robotsMeta?.getAttribute('content') || null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow');

    fetchInviteUploadTokenFromServer(currentSet.id).then((t) => {
      if (t) setInviteToken(t);
    });
    fetchPublicPaymentConfig({
      albumId: currentSet.id,
      institutionId: currentSet.institutionId || currentSet.universityId,
      departmentId: currentSet.departmentId,
      graduationYear: currentSet.graduationYear,
    }).then((cfg) => {
      if (cfg.studentFeeKobo > 0) {
        const stdNgn = Math.round(cfg.studentFeeKobo / 100);
        setStandardFeeNgn(stdNgn);
        setStudentFeeNgn(stdNgn);
      }
      if (cfg.resolvedPricing) {
        setResolvedPricing(cfg.resolvedPricing);
        setStandardFeeNgn(Math.round((cfg.resolvedPricing.standardPriceKobo || cfg.resolvedPricing.listPriceKobo || cfg.studentFeeKobo || 50000) / 100));
        setStudentFeeNgn(Math.round((cfg.resolvedPricing.effectivePriceKobo ?? cfg.studentFeeKobo ?? 50000) / 100));
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

  const processSelectedFile = async (file: File, target: 'primary' | 'secondary' = 'primary') => {
    setUploadError(null);
    setCropTarget(target);
    try {
      const result = await compressImageToWebP(file, 1200, 0.90);
      if (target === 'secondary') {
        setRawSecondaryPhotoUrl(result.dataUrl);
        setSecondaryCropSettings(undefined);
      } else {
        setRawPhotoUrl(result.dataUrl);
        setCropSettings(undefined);
      }
      setRawPhotoToCrop(result.dataUrl);
      setIsCropModalOpen(true);
    } catch (err) {
      console.error('Error reading gallery file:', err);
      const fallbackUrl = await fileToUniversalDataUrl(file);
      if (fallbackUrl) {
        if (target === 'secondary') {
          setRawSecondaryPhotoUrl(fallbackUrl);
          setSecondaryCropSettings(undefined);
        } else {
          setRawPhotoUrl(fallbackUrl);
          setCropSettings(undefined);
        }
        setRawPhotoToCrop(fallbackUrl);
        setIsCropModalOpen(true);
      }
    }
  };

  const handleApplyCrop = async (croppedDataUrl: string, newSettings?: CropSettings) => {
    if (cropTarget === 'secondary') {
      setIsCompressingSecondary(true);
      try {
        const fetchRes = await fetch(croppedDataUrl);
        const blob = await fetchRes.blob();
        const file = new File([blob], 'student-secondary-portrait.webp', { type: 'image/webp' });
        const result = await compressImageToWebP(file, 800, 0.88);
        let tokenToUse = inviteToken;
        if (!tokenToUse) {
          tokenToUse = await fetchInviteUploadTokenFromServer(currentSet.id);
          if (tokenToUse) setInviteToken(tokenToUse);
        }
        const uploadRes = await uploadMediaToR2(result.dataUrl, {
          setId: currentSet.id,
          category: 'portrait',
          fileName: `${fullName ? fullName.replace(/\s+/g, '-').toLowerCase() : 'student'}-secondary-portrait.webp`,
          inviteToken: tokenToUse,
        });
        if (uploadRes.success && uploadRes.url) {
          setSecondaryPhotoDataUrl(uploadRes.url);
        } else {
          setSecondaryPhotoDataUrl(result.dataUrl);
        }
        if (newSettings) setSecondaryCropSettings(newSettings);
      } catch (err) {
        console.error('Secondary portrait upload error:', err);
        setSecondaryPhotoDataUrl(croppedDataUrl);
      } finally {
        setIsCompressingSecondary(false);
        setIsCropModalOpen(false);
      }
      return;
    }

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

      if (uploadRes.success && uploadRes.url) {
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
    if (file) processSelectedFile(file, 'primary');
  };

  const handleSecondaryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file, 'secondary');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file, 'primary');
  };

  const validateStep1 = () => {
    if (!photoDataUrl) {
      setUploadError('Please upload your official face portrait.');
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
    if (!fullName.trim() || !photoDataUrl) return;

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

    const isEditingExisting = entryMode === 'edit' && Boolean(selectedEditStudent);

    const newStudent: StudentProfile = {
      ...(selectedEditStudent || {}),
      id: isEditingExisting && selectedEditStudent ? selectedEditStudent.id : activeSubmissionId || `std-${Date.now()}`,
      setId: currentSet.id,
      fullName: fullName.trim(),
      nickname: nickname.trim() || undefined,
      position: trimmedPos || 'Member',
      photoUrl: photoDataUrl,
      rawPhotoUrl: rawPhotoUrl || photoDataUrl,
      cropSettings: cropSettings,
      secondaryPhotoUrl: secondaryPhotoDataUrl || undefined,
      rawSecondaryPhotoUrl: rawSecondaryPhotoUrl || secondaryPhotoDataUrl || undefined,
      secondaryCropSettings: secondaryCropSettings,
      originalSizeKb: compressionInfo?.originalSizeKb ?? selectedEditStudent?.originalSizeKb,
      compressedSizeKb: compressionInfo?.compressedSizeKb ?? selectedEditStudent?.compressedSizeKb,
      quote: quote.trim() ? quote.trim().slice(0, 140) : undefined,
      bio: bio.trim() || selectedEditStudent?.bio || undefined,
      myStory: myStory.trim() ? myStory.trim().slice(0, 10000) : undefined,
      storyUpdatedAt: myStory.trim() ? new Date().toISOString() : selectedEditStudent?.storyUpdatedAt,
      storyEditLog: myStory.trim()
        ? [
            {
              id: `stlog-${Date.now()}`,
              timestamp: new Date().toISOString(),
              actorName: fullName.trim() || 'Student',
              actorRole: 'student' as const,
              summary: `${isEditingExisting ? 'Updated' : 'Submitted'} story (${countStoryWords(myStory)} words)`,
            },
            ...(selectedEditStudent?.storyEditLog || []),
          ].slice(0, 25)
        : selectedEditStudent?.storyEditLog,
      favouriteCampusMemory: favouriteCampusMemory.trim() ? favouriteCampusMemory.trim().slice(0, 140) : undefined,
      funFact: funFact.trim() ? funFact.trim().slice(0, 140) : undefined,
      whatsNext: whatsNext.trim() ? whatsNext.trim().slice(0, 140) : undefined,
      messageToClassmates: messageToClassmates.trim() || undefined,
      messageToFutureSet: messageToFutureSet.trim() || undefined,
      studentAwards: studentAwards.length > 0 ? studentAwards : undefined,
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
      status: 'pending',
      submissionStatus: 'pending',
      isProfileUpdate: isEditingExisting ? true : undefined,
      previousApproved: isEditingExisting ? true : undefined,
      usedSlot: isEditingExisting ? true : selectedEditStudent?.usedSlot,
      slotConsumed: isEditingExisting ? true : selectedEditStudent?.slotConsumed,
      paymentStatus: isEditingExisting
        ? selectedEditStudent?.paymentStatus || 'waived'
        : undefined,
      submittedAt: selectedEditStudent?.submittedAt || new Date().toISOString().split('T')[0],
      leaderOrder: hasLeaderTitle
        ? selectedEditStudent?.leaderOrder ?? calculateIntuitiveHierarchyRank(trimmedPos)
        : undefined,
    };

    try {
      const serverRes = await submitStudentProfileOnServer(currentSet.id, newStudent, {
        source: 'student',
        consent: hasConsent,
      });

      const subId = isEditingExisting && selectedEditStudent
        ? selectedEditStudent.id
        : serverRes.submissionId || newStudent.id;
      setActiveSubmissionId(subId);
      if (serverRes.statusToken) {
        setActiveStatusToken(serverRes.statusToken);
      }
      if (isEditingExisting) {
        setSubmissionPaymentStatus('paid');
      } else if (serverRes.paymentStatus) {
        setSubmissionPaymentStatus(serverRes.paymentStatus);
      }
      if (serverRes.status) {
        setSubmissionApprovalStatus(serverRes.status);
      }

      const finalStudent = { ...newStudent, id: subId };
      onSubmitStudent(finalStudent);
      setSubmittedStudent(finalStudent);
      setIsSubmittingServer(false);

      if (openCheckoutAfterSubmit && !isEditingExisting) {
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
                {entryMode === 'edit' && selectedEditStudent ? 'Profile Update Submitted!' : 'Profile Submitted!'}
              </h2>
              <p className="font-body text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {entryMode === 'edit' && selectedEditStudent
                  ? `Your updated profile has been sent to ${currentSet.classRepName} and is awaiting approval under Pending.`
                  : `Your profile card has been submitted to ${currentSet.classRepName} for inclusion in the official class album.`}
              </p>
              <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono-tech uppercase font-bold bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300">
                  Review: {submissionApprovalStatus}
                </span>
                {!(entryMode === 'edit' && selectedEditStudent) && (
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-mono-tech uppercase font-bold border ${
                      submissionPaymentStatus === 'paid' ||
                      (resolvedPricing?.kind === 'funding' && resolvedPricing.isCovered)
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {resolvedPricing?.kind === 'funding' && resolvedPricing.isCovered
                      ? `Free, sponsored by ${resolvedPricing.sponsorName || 'KoHot'}`
                      : submissionPaymentStatus === 'paid'
                      ? 'Payment: Paid'
                      : `Payment: Unpaid (₦${studentFeeNgn.toLocaleString()})`}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
              {!(entryMode === 'edit' && selectedEditStudent) &&
                submissionPaymentStatus !== 'paid' &&
                !(resolvedPricing?.kind === 'funding' && resolvedPricing.isCovered) &&
                activeSubmissionId && (
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
                TOP MODE SWITCHER: SUBMIT NEW PROFILE vs EDIT EXISTING PROFILE
                ========================================================================= */}
            {currentStep === 1 && (
              <div className="max-w-2xl mx-auto mb-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-neutral-900 border border-slate-300/80 dark:border-neutral-800">
                  <button
                    id="invite-mode-submit-btn"
                    type="button"
                    onClick={() => {
                      setEntryMode('submit');
                      if (selectedEditStudent) {
                        handleResetToNewSubmission();
                      }
                    }}
                    className={`py-2.5 px-4 rounded-xl font-mono-tech text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      entryMode === 'submit'
                        ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Submit Profile</span>
                  </button>

                  <button
                    id="invite-mode-edit-btn"
                    type="button"
                    onClick={() => {
                      setEntryMode('edit');
                    }}
                    className={`py-2.5 px-4 rounded-xl font-mono-tech text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      entryMode === 'edit'
                        ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                </div>

                {/* When Edit Profile mode is active: Search & Pick Classmate Profile */}
                {entryMode === 'edit' && !selectedEditStudent && (
                  <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-4 shadow-sm animate-fadeIn">
                    <div className="space-y-1">
                      <h2 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                        Find Your Profile to Edit
                      </h2>
                      <p className="font-body text-xs text-slate-500 dark:text-zinc-400">
                        Search and select your profile from the Class of {currentSet.graduationYear} list below. Once you submit your changes, your updated profile will wait under Pending for Class Admin approval.
                      </p>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="invite-edit-profile-search-input"
                        type="text"
                        value={editSearchQuery}
                        onChange={(e) => setEditSearchQuery(e.target.value)}
                        placeholder="Search your name or nickname..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none text-xs"
                      />
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-neutral-800 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/50">
                      {editableClassmates.length === 0 ? (
                        <div className="p-6 text-center text-xs font-mono-tech text-slate-500 dark:text-zinc-400">
                          No matching profile found. Try another name or switch to &ldquo;Submit Profile&rdquo; if you haven&apos;t submitted yet.
                        </div>
                      ) : (
                        editableClassmates.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleSelectExistingStudentForEdit(student)}
                            className="w-full p-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {student.photoUrl ? (
                                <img
                                  src={student.photoUrl}
                                  alt={student.fullName}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-neutral-700 shrink-0 bg-neutral-900"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-neutral-800 flex items-center justify-center text-slate-500 shrink-0">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-syne font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                  {student.fullName}
                                </p>
                                <p className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                  {student.nickname ? `"${student.nickname}"` : student.position || 'Classmate'}
                                </p>
                              </div>
                            </div>
                            <span className="px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono-tech text-[10px] uppercase tracking-wider font-bold shrink-0">
                              Select &amp; Edit
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Selected Classmate Banner when editing */}
                {entryMode === 'edit' && selectedEditStudent && (
                  <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {selectedEditStudent.photoUrl ? (
                        <img
                          src={selectedEditStudent.photoUrl}
                          alt={selectedEditStudent.fullName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover border border-sky-500/30 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-sky-700 dark:text-sky-300 font-bold">
                          Editing Existing Profile
                        </span>
                        <p className="font-syne font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {selectedEditStudent.fullName}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetToNewSubmission()}
                      className="px-3 py-1.5 rounded-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-zinc-200 font-mono-tech text-[10px] uppercase tracking-wider font-semibold hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer shrink-0"
                    >
                      Change Profile
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* =========================================================================
                STEP 1: PROFILE FORM
                ========================================================================= */}
            {currentStep === 1 && (entryMode === 'submit' || Boolean(selectedEditStudent)) && (
              <form onSubmit={handleProceedToPreview} className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-6 shadow-sm">
                  {/* Photo Upload Section with Portrait Resize */}
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
                                      setCropTarget('primary');
                                      setRawPhotoToCrop(rawPhotoUrl || photoDataUrl);
                                      setIsCropModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-800 dark:text-slate-200 font-mono-tech text-[10px] flex items-center gap-1 cursor-pointer transition-colors border border-slate-300 dark:border-neutral-700"
                                  >
                                    <Crop className="w-3 h-3 text-amber-500" />
                                    <span>Resize</span>
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

                      {/* Optional Second Photo (Visible Only in Full Profile View) */}
                      <div className="space-y-2">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                          Second Photo <span className="text-slate-500 lowercase font-normal">(optional · shown in full profile view)</span>
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Appears as a smaller square photo at the lower-right of your portrait when someone opens your full profile.
                        </p>

                        <input
                          type="file"
                          ref={secondaryFileInputRef}
                          accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                          onChange={handleSecondaryFileChange}
                          className="hidden"
                        />

                        <div
                          onClick={() => secondaryFileInputRef.current?.click()}
                          className={`relative p-4 rounded-2xl border border-dashed transition-all cursor-pointer ${
                            secondaryPhotoDataUrl
                              ? 'border-emerald-500/50 bg-emerald-500/[0.04]'
                              : 'border-slate-300 dark:border-neutral-700 hover:border-slate-400 dark:hover:border-neutral-600 bg-slate-50 dark:bg-neutral-950/60'
                          }`}
                        >
                          {secondaryPhotoDataUrl ? (
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={secondaryPhotoDataUrl}
                                  alt="Second Photo Preview"
                                  className="w-14 h-14 aspect-square rounded-xl object-cover border border-slate-300 dark:border-neutral-700 shadow-sm bg-white"
                                />
                                <div className="text-left">
                                  <p className="font-syne font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Second photo added
                                  </p>
                                  <p className="text-[10px] font-mono-tech text-slate-500 dark:text-slate-400">
                                    Displayed in full profile view
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    secondaryFileInputRef.current?.click();
                                  }}
                                  className="px-2.5 py-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono-tech text-[10px] font-semibold cursor-pointer"
                                >
                                  Replace
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCropTarget('secondary');
                                    setRawPhotoToCrop(rawSecondaryPhotoUrl || secondaryPhotoDataUrl);
                                    setIsCropModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 font-mono-tech text-[10px] flex items-center gap-1 cursor-pointer border border-slate-300 dark:border-neutral-700"
                                >
                                  <Crop className="w-3 h-3 text-amber-500" />
                                  <span>Resize</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSecondaryPhotoDataUrl('');
                                    setRawSecondaryPhotoUrl('');
                                    setSecondaryCropSettings(undefined);
                                  }}
                                  className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-mono-tech text-[10px] cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2.5 py-1">
                              <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                              <span className="font-mono-tech text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {isCompressingSecondary ? 'Uploading second photo...' : 'Upload Second Photo (Optional)'}
                              </span>
                            </div>
                          )}
                        </div>
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

                  {/* Role / Leadership Position with Quick-Select */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                        Class Role / Title <span className="text-slate-500 lowercase font-normal">(optional)</span>
                      </label>
                      <span className="text-[10px] font-mono-tech text-amber-600 dark:text-amber-400">
                        Select below or type custom
                      </span>
                    </div>
                    <input
                      type="text"
                      list="student-roles-pocket-list"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. President, Class Governor, Class Rep, Social Director..."
                      className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none shadow-xs text-xs"
                    />
                    <datalist id="student-roles-pocket-list">
                      <option value="President" />
                      <option value="Class Governor" />
                      <option value="Class Representative" />
                      <option value="Vice President" />
                      <option value="General Secretary" />
                      <option value="Assistant Class Rep" />
                      <option value="Financial Secretary" />
                      <option value="Treasurer" />
                      <option value="Welfare Director" />
                      <option value="Social Director" />
                      <option value="Public Relations Officer" />
                      <option value="Sports Director" />
                      <option value="Academic Director" />
                    </datalist>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[
                        'President',
                        'Class Governor',
                        'Class Representative',
                        'Vice President',
                        'General Secretary',
                        'Welfare Director',
                        'Social Director',
                        'Public Relations Officer',
                      ].map((roleOption) => {
                        const isSelected = position.trim().toLowerCase() === roleOption.toLowerCase();
                        return (
                          <button
                            key={roleOption}
                            type="button"
                            onClick={() => setPosition(isSelected ? '' : roleOption)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono-tech transition-colors cursor-pointer border ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold'
                                : 'bg-slate-100 dark:bg-neutral-800/80 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-neutral-700'
                            }`}
                          >
                            {roleOption}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Class Awards & Honours Input (with distinct award icons — never uses the same icon twice) */}
                  <div className="space-y-2.5 p-3.5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/60">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          <span>Class Awards &amp; Honours <span className="text-slate-500 lowercase font-normal">(optional)</span></span>
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Add any class awards, superlatives, or honours you received. Each award gets a unique badge icon on your profile.
                        </p>
                      </div>
                      {studentAwards.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-mono-tech text-[10px] font-bold shrink-0">
                          {studentAwards.length} {studentAwards.length === 1 ? 'award' : 'awards'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="invite-award-input"
                        type="text"
                        value={newAwardTitle}
                        onChange={(e) => setNewAwardTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = newAwardTitle.trim();
                            if (!trimmed) return;
                            if (
                              !studentAwards.some(
                                (a) => a.category.trim().toLowerCase() === trimmed.toLowerCase()
                              )
                            ) {
                              setStudentAwards((prev) => [
                                ...prev,
                                { id: `st-awd-${Date.now()}-${prev.length}`, category: trimmed },
                              ]);
                            }
                            setNewAwardTitle('');
                          }
                        }}
                        placeholder="e.g. Best Dressed, Most Influential, Academic Excellence..."
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none text-xs"
                      />
                      <button
                        id="invite-add-award-btn"
                        type="button"
                        onClick={() => {
                          const trimmed = newAwardTitle.trim();
                          if (!trimmed) return;
                          if (
                            !studentAwards.some(
                              (a) => a.category.trim().toLowerCase() === trimmed.toLowerCase()
                            )
                          ) {
                            setStudentAwards((prev) => [
                              ...prev,
                              { id: `st-awd-${Date.now()}-${prev.length}`, category: trimmed },
                            ]);
                          }
                          setNewAwardTitle('');
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono-tech text-[11px] uppercase tracking-wider font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Award</span>
                      </button>
                    </div>

                    {/* Displayed Added Awards with Distinct Non-Repeating Icons */}
                    {studentAwards.length > 0 && (() => {
                      const distinctVisuals = getDistinctAwardVisualsForList(studentAwards, isLightMode);
                      return (
                        <div className="space-y-1.5 pt-1">
                          {studentAwards.map((award, idx) => {
                            const visual =
                              distinctVisuals[idx] ||
                              getAwardVisualConfig(award.trophyType, isLightMode);
                            const AwardIcon = visual.icon;
                            return (
                              <div
                                key={award.id}
                                className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-amber-300/70 dark:border-amber-500/30 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={`w-6 h-6 flex items-center justify-center shrink-0 ${visual.shapeClass}`}
                                    title={visual.label}
                                  >
                                    <AwardIcon
                                      className={`w-3.5 h-3.5 ${visual.iconColor} ${
                                        visual.type === 'crystal' ? '-rotate-45' : ''
                                      }`}
                                    />
                                  </span>
                                  <span className="font-syne font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {award.category}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStudentAwards((prev) => prev.filter((a) => a.id !== award.id))
                                  }
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                                  title="Remove award"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Parting Quote (max 140 characters) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                        Parting Quote <span className="text-slate-500 lowercase font-normal">(optional · max 140 chars)</span>
                      </label>
                      <span className="text-[10px] font-mono-tech text-slate-400">
                        {quote.length}/140
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={140}
                      value={quote}
                      onChange={(e) => setQuote(e.target.value.slice(0, 140))}
                      placeholder="e.g. Came as strangers, leaving as family."
                      className="w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none shadow-xs text-xs"
                    />
                  </div>

                  {/* Optional Collapsed Field: Add your story (optional) -> My story / parting words */}
                  <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsStoryExpanded((prev) => !prev)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-neutral-900/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 font-bold">
                            Add your story (optional)
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            My story / parting words — share a longer reflection or farewell message for your profile
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-400 shrink-0">
                        {myStory.trim() ? `${countStoryWords(myStory)} words` : isStoryExpanded ? 'Collapse' : 'Expand'}
                        {isStoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {isStoryExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 dark:border-neutral-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">
                              My Story / Parting Words <span className="text-slate-500 lowercase font-normal">(optional · up to 10,000 characters)</span>
                            </label>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                              Celebrate what the class achieved. Keep it respectful.
                            </p>
                          </div>
                          <span className="text-[10px] font-mono-tech text-slate-500 dark:text-slate-400">
                            {countStoryWords(myStory)} words · {myStory.length.toLocaleString()}/10,000
                          </span>
                        </div>

                        <textarea
                          rows={5}
                          maxLength={10000}
                          value={myStory}
                          onChange={(e) => setMyStory(e.target.value.slice(0, 10000))}
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData('text');
                            if (!pasted) return;
                            e.preventDefault();
                            const target = e.currentTarget;
                            const start = target.selectionStart ?? myStory.length;
                            const end = target.selectionEnd ?? myStory.length;
                            const combined = myStory.slice(0, start) + pasted + myStory.slice(end);
                            setMyStory(cleanWhatsAppStoryText(combined));
                          }}
                          placeholder="Write or paste your story or parting words here. Lines wrapped in *Heading* become headings, and a closing paragraph in **bold** stays bold."
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none text-xs leading-relaxed"
                        />

                        {myStory.trim() && (
                          <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-mono-tech uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                                <Sparkles className="w-3 h-3" />
                                Live Preview
                              </span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {parseStoryBlocks(myStory).map((block, idx) => {
                                if (block.type === 'heading') {
                                  return (
                                    <h5 key={idx} className="font-syne font-bold text-xs text-slate-900 dark:text-amber-300 pt-1">
                                      {block.content}
                                    </h5>
                                  );
                                }
                                if (block.type === 'boldClosing') {
                                  return (
                                    <p key={idx} className="font-body font-semibold text-xs text-slate-900 dark:text-white leading-relaxed">
                                      {block.content}
                                    </p>
                                  );
                                }
                                return (
                                  <p key={idx} className="font-body text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {block.content}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Class Award (icons only if won + instruction to view one-line card underneath) */}
                  {(() => {
                    const normalizedName = fullName.trim().toLowerCase();
                    const matchedAwards = normalizedName
                      ? (currentSet.awards || []).filter(
                          (aw) => aw.winnerName.trim().toLowerCase() === normalizedName
                        )
                      : [];
                    if (matchedAwards.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                          Class Award
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAwardsRevealed((prev) => !prev)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1">
                            {matchedAwards.map((aw) => {
                              const visual = getAwardVisualConfig(aw.category);
                              const IconComp = visual.icon || Trophy;
                              return <IconComp key={aw.id} className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
                            })}
                          </span>
                          <span className="font-mono-tech text-[10px] font-semibold">
                            Tap to view {matchedAwards.length === 1 ? 'award' : `${matchedAwards.length} awards`} won
                          </span>
                        </button>
                        {isAwardsRevealed && (
                          <div className="space-y-1.5 pt-0.5">
                            {matchedAwards.map((aw) => {
                              const visual = getAwardVisualConfig(aw.category);
                              const IconComp = visual.icon || Trophy;
                              return (
                                <div
                                  key={aw.id}
                                  className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-xs text-slate-900 dark:text-amber-100 truncate"
                                >
                                  <IconComp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span className="font-syne font-bold truncate">{aw.category}</span>
                                  {aw.citation && (
                                    <span className="text-slate-500 dark:text-amber-200/70 truncate text-[11px]">
                                      — {aw.citation}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

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
                        Social Links <span className="text-slate-500 lowercase font-normal">(optional)</span>
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

                  {/* Collapsed "More about me (optional)" */}
                  <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsMoreAboutMeExpanded((prev) => !prev)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-neutral-900/80 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 font-bold">
                          More about me <span className="text-slate-500 lowercase font-normal">(optional)</span>
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Favourite campus memory, fun fact, and what’s next
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-400 shrink-0">
                        {isMoreAboutMeExpanded ? 'Collapse' : 'Expand'}
                        {isMoreAboutMeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {isMoreAboutMeExpanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200/80 dark:border-neutral-800 space-y-4">
                        {/* Favourite Campus Memory (140 chars) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                              Favourite Campus Memory <span className="text-slate-500 lowercase font-normal">(optional · max 140 chars)</span>
                            </label>
                            <span className="text-[10px] font-mono-tech text-slate-400">
                              {favouriteCampusMemory.length}/140
                            </span>
                          </div>
                          <input
                            type="text"
                            maxLength={140}
                            value={favouriteCampusMemory}
                            onChange={(e) => setFavouriteCampusMemory(e.target.value.slice(0, 140))}
                            placeholder="e.g. Winning the inter-faculty moot competition in final year"
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>

                        {/* Fun Fact (140 chars) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                              Fun Fact <span className="text-slate-500 lowercase font-normal">(optional · max 140 chars)</span>
                            </label>
                            <span className="text-[10px] font-mono-tech text-slate-400">
                              {funFact.length}/140
                            </span>
                          </div>
                          <input
                            type="text"
                            maxLength={140}
                            value={funFact}
                            onChange={(e) => setFunFact(e.target.value.slice(0, 140))}
                            placeholder="e.g. Never missed an 8 AM lecture in 5 years"
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>

                        {/* What's Next (140 chars) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                              What’s Next <span className="text-slate-500 lowercase font-normal">(optional · max 140 chars)</span>
                            </label>
                            <span className="text-[10px] font-mono-tech text-slate-400">
                              {whatsNext.length}/140
                            </span>
                          </div>
                          <input
                            type="text"
                            maxLength={140}
                            value={whatsNext}
                            onChange={(e) => setWhatsNext(e.target.value.slice(0, 140))}
                            placeholder="e.g. Nigerian Law School & Corporate Law Practice"
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Collapsed "Final words (optional)" */}
                  <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsFinalWordsExpanded((prev) => !prev)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-neutral-900/80 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 font-bold">
                          Final words <span className="text-slate-500 lowercase font-normal">(optional)</span>
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          A message to my classmates &amp; a message to future set
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-400 shrink-0">
                        {isFinalWordsExpanded ? 'Collapse' : 'Expand'}
                        {isFinalWordsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {isFinalWordsExpanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200/80 dark:border-neutral-800 space-y-4">
                        {/* A Message to My Classmates */}
                        <div>
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 font-bold">
                            A Message to My Classmates <span className="text-slate-500 lowercase font-normal">(optional)</span>
                          </label>
                          <textarea
                            rows={2}
                            value={messageToClassmates}
                            onChange={(e) => setMessageToClassmates(e.target.value)}
                            placeholder="A parting word to your graduating set..."
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none resize-none text-xs"
                          />
                        </div>

                        {/* A Message to Future Set */}
                        <div>
                          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 font-bold">
                            A Message to Future Set <span className="text-slate-500 lowercase font-normal">(optional)</span>
                          </label>
                          <textarea
                            rows={2}
                            value={messageToFutureSet}
                            onChange={(e) => setMessageToFutureSet(e.target.value)}
                            placeholder="Advice for upcoming sets in the department..."
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none resize-none text-xs"
                          />
                        </div>
                      </div>
                    )}
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

                {/* Preview Card matching DepartmentAlbumView grid card (photo, name, role tag, nickname, two-line quote) + Full Profile View details */}
                <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 overflow-hidden shadow-xl text-slate-900 dark:text-white">
                  {/* Photo with exact 1:1 aspect ratio */}
                  <div className="relative w-full aspect-square bg-slate-100 dark:bg-neutral-950 overflow-hidden">
                    {photoDataUrl ? (
                      <GlazedImage
                        src={photoDataUrl}
                        alt={fullName}
                        priority
                        showMonogram={false}
                        containerClassName="w-full h-full"
                        className="w-full h-full object-cover filter contrast-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <User className="w-16 h-16" />
                      </div>
                    )}

                    {position && (
                      <div className="absolute bottom-3 left-3 z-10">
                        <span className="inline-block px-2.5 py-1 max-w-full truncate text-[10px] font-mono-tech uppercase tracking-wider backdrop-blur-md rounded-full bg-black/80 text-white border border-white/20 font-semibold shadow">
                          {position}
                        </span>
                      </div>
                    )}

                    {/* Smaller Square Second Image at Lower Right of First Image (Full View Preview) */}
                    {secondaryPhotoDataUrl && (
                      <div className="absolute bottom-3 right-3 z-20 w-20 h-20 rounded-xl overflow-hidden border-2 border-white/90 shadow-2xl bg-zinc-900">
                        <GlazedImage
                          src={secondaryPhotoDataUrl}
                          alt={`${fullName} second portrait`}
                          priority
                          showMonogram={false}
                          containerClassName="w-full h-full"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Details in exact Public Profile View order */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="font-syne font-bold text-lg text-slate-900 dark:text-white">
                        {fullName || 'Your Full Name'}
                      </h3>
                      {nickname && (
                        <p className="font-mono-tech text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                          “{nickname}”
                        </p>
                      )}
                      {/* Social Icons & Email Icon right after Nickname */}
                      {(instagramHandle || twitterHandle || tiktokHandle || linkedinHandle || facebookHandle || email.trim()) && (
                        <div className="flex items-center flex-wrap gap-2 pt-2">
                          <SocialIconsRow
                            socials={{
                              instagram: instagramHandle,
                              twitter: twitterHandle,
                              tiktok: tiktokHandle,
                              linkedin: linkedinHandle,
                              facebook: facebookHandle,
                            }}
                            size="sm"
                            isLightMode={isLightMode}
                          />
                          {email.trim() && (
                            <span
                              title={`Email (${email.trim()})`}
                              className="w-7 h-7 rounded-full border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 flex items-center justify-center"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      )}
                      {(position || studentAwards.length > 0) && (() => {
                        const distinctPreviewVisuals = getDistinctAwardVisualsForList(
                          studentAwards,
                          isLightMode
                        );
                        return (
                          <div className="mt-2.5 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {position && (
                                <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 font-mono-tech text-[10px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                                  {position}
                                </span>
                              )}

                              {studentAwards.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setIsAwardsRevealed((prev) => !prev)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 transition-all cursor-pointer"
                                >
                                  <div className="flex items-center -space-x-1">
                                    {studentAwards.map((award, idx) => {
                                      const visual =
                                        distinctPreviewVisuals[idx] ||
                                        getAwardVisualConfig(award.trophyType, isLightMode);
                                      const AwardIcon = visual.icon;
                                      return (
                                        <span
                                          key={award.id}
                                          className={`w-4 h-4 flex items-center justify-center ${visual.shapeClass}`}
                                        >
                                          <AwardIcon
                                            className={`w-2.5 h-2.5 ${visual.iconColor} ${
                                              visual.type === 'crystal' ? '-rotate-45' : ''
                                            }`}
                                          />
                                        </span>
                                      );
                                    })}
                                  </div>
                                  <span className="font-mono-tech text-[10px] uppercase tracking-wider font-bold">
                                    {isAwardsRevealed
                                      ? 'Hide award'
                                      : studentAwards.length === 1
                                      ? 'Tap to view award won'
                                      : `Tap to view ${studentAwards.length} awards won`}
                                  </span>
                                </button>
                              )}
                            </div>

                            {studentAwards.length > 0 && isAwardsRevealed && (
                              <div className="space-y-1.5 animate-fadeIn">
                                {studentAwards.map((award, idx) => {
                                  const visual =
                                    distinctPreviewVisuals[idx] ||
                                    getAwardVisualConfig(award.trophyType, isLightMode);
                                  const AwardIcon = visual.icon;
                                  return (
                                    <div
                                      key={award.id}
                                      className="px-3 py-2 rounded-xl border bg-amber-50/70 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 flex items-center justify-between gap-2 text-xs"
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
                                        <span className="font-syne font-bold truncate text-slate-900 dark:text-white">
                                          {award.category}
                                        </span>
                                      </div>
                                      <span className="font-mono-tech text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 shrink-0">
                                        Class Award
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {quote.trim() && (
                      <div className="pt-2 border-t border-slate-100 dark:border-neutral-800">
                        <p className="font-body text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2 leading-relaxed">
                          “{quote.trim().replace(/^["“”']+|["“”']+$/g, '')}”
                        </p>
                      </div>
                    )}

                    {myStory.trim() && (() => {
                      const storyPreview = getStoryCardPreview(myStory);
                      const fullBlocks = parseStoryBlocks(myStory);
                      return (
                        <div className="pt-2.5 border-t border-slate-100 dark:border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 font-mono-tech text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">
                              <BookOpen className="w-3 h-3" />
                              My story
                            </span>
                            <span className="font-mono-tech text-[10px] text-slate-400 dark:text-zinc-500">
                              {storyPreview.wordCount} {storyPreview.wordCount === 1 ? 'word' : 'words'}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-neutral-950/70 border border-slate-200/70 dark:border-neutral-800 space-y-1.5">
                            {isReviewStoryExpanded ? (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {fullBlocks.map((block, idx) => {
                                  if (block.type === 'heading') {
                                    return (
                                      <h5
                                        key={idx}
                                        className="font-syne font-bold text-xs text-slate-900 dark:text-amber-300 pt-1"
                                      >
                                        {block.content}
                                      </h5>
                                    );
                                  }
                                  if (block.type === 'boldClosing') {
                                    return (
                                      <p
                                        key={idx}
                                        className="font-body font-semibold text-xs text-slate-900 dark:text-white leading-relaxed"
                                      >
                                        {block.content}
                                      </p>
                                    );
                                  }
                                  return (
                                    <p
                                      key={idx}
                                      className="font-body text-xs text-slate-700 dark:text-slate-300 leading-relaxed"
                                    >
                                      {block.content}
                                    </p>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="font-body text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                                {storyPreview.previewPlainText}
                              </p>
                            )}

                            {(storyPreview.isTruncated || fullBlocks.length > 1) && (
                              <button
                                type="button"
                                onClick={() => setIsReviewStoryExpanded((prev) => !prev)}
                                className="inline-flex items-center gap-1 pt-0.5 font-mono-tech text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 hover:underline font-bold cursor-pointer"
                              >
                                <span>{isReviewStoryExpanded ? 'Show brief preview' : 'Read full story'}</span>
                                {isReviewStoryExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {(favouriteCampusMemory.trim() || funFact.trim() || whatsNext.trim()) && (
                      <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 space-y-2">
                        <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-bold">
                          More about me
                        </span>
                        {favouriteCampusMemory.trim() && (
                          <div>
                            <span className="block font-mono-tech text-[10px] text-slate-400 dark:text-zinc-500">Favourite Campus Memory</span>
                            <p className="font-body text-xs text-slate-700 dark:text-zinc-300">{favouriteCampusMemory.trim()}</p>
                          </div>
                        )}
                        {funFact.trim() && (
                          <div>
                            <span className="block font-mono-tech text-[10px] text-slate-400 dark:text-zinc-500">Fun Fact</span>
                            <p className="font-body text-xs text-slate-700 dark:text-zinc-300">{funFact.trim()}</p>
                          </div>
                        )}
                        {whatsNext.trim() && (
                          <div>
                            <span className="block font-mono-tech text-[10px] text-slate-400 dark:text-zinc-500">What’s Next</span>
                            <p className="font-body text-xs text-slate-700 dark:text-zinc-300">{whatsNext.trim()}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {(messageToClassmates.trim() || messageToFutureSet.trim()) && (
                      <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 space-y-2">
                        <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-bold">
                          Final words
                        </span>
                        {messageToClassmates.trim() && (
                          <div>
                            <span className="block font-mono-tech text-[10px] text-slate-400 dark:text-zinc-500">A Message to My Classmates</span>
                            <p className="font-body text-xs text-slate-700 dark:text-zinc-300">{messageToClassmates.trim()}</p>
                          </div>
                        )}
                        {messageToFutureSet.trim() && (
                          <div>
                            <span className="block font-mono-tech text-[10px] text-slate-400 dark:text-zinc-500">A Message to Future Set</span>
                            <p className="font-body text-xs text-slate-700 dark:text-zinc-300">{messageToFutureSet.trim()}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {entryMode === 'edit' && selectedEditStudent ? (
                  <div className="space-y-3 pt-2">
                    <button
                      id="step2-submit-profile-update-btn"
                      type="button"
                      disabled={isSubmittingServer}
                      onClick={() => handleSubmit(false)}
                      className="w-full py-4 px-6 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-syne font-bold text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 active:scale-98"
                    >
                      <span>{isSubmittingServer ? 'Submitting Update...' : 'Submit Profile Update for Approval'}</span>
                      <Send className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="w-full py-2.5 rounded-full bg-transparent hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
                    >
                      &larr; Back to Edit
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Student Fee Notice (Server-resolved price) */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono-tech text-slate-600 dark:text-slate-400">
                        Student Profile Publishing Fee
                      </span>
                      {resolvedPricing?.kind === 'funding' && resolvedPricing.isCovered ? (
                        <div className="flex items-center gap-2">
                          <span className="line-through font-mono-tech text-xs text-slate-400">
                            ₦{standardFeeNgn.toLocaleString()}
                          </span>
                          <span className="font-syne font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            Free, sponsored by {resolvedPricing.sponsorName || 'KoHot'}
                          </span>
                        </div>
                      ) : resolvedPricing?.kind === 'discount' ? (
                        <div className="flex items-center gap-2">
                          <span className="line-through font-mono-tech text-xs text-slate-400">
                            ₦{standardFeeNgn.toLocaleString()}
                          </span>
                          <span className="font-syne font-bold text-sm text-amber-600 dark:text-amber-400">
                            ₦{studentFeeNgn.toLocaleString()} ({resolvedPricing.discountPercent}% off)
                          </span>
                        </div>
                      ) : (
                        <span className="font-syne font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          ₦{studentFeeNgn.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Step 2 Actions */}
                    <div className="space-y-3 pt-2">
                      {resolvedPricing?.kind === 'funding' && resolvedPricing.isCovered ? (
                        <button
                          id="step2-submit-funded-btn"
                          type="button"
                          disabled={isSubmittingServer}
                          onClick={() => handleSubmit(false)}
                          className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-syne font-bold text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98"
                        >
                          <span>
                            {isSubmittingServer
                              ? 'Submitting...'
                              : `Submit Profile (Free, sponsored by ${resolvedPricing.sponsorName || 'KoHot'})`}
                          </span>
                          <Send className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button
                            id="step2-pay-now-btn"
                            type="button"
                            disabled={isSubmittingServer}
                            onClick={() => handleSubmit(true)}
                            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-syne font-bold text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98"
                          >
                            {resolvedPricing?.kind === 'discount' && (
                              <span className="line-through font-mono-tech text-xs text-emerald-200/80">
                                ₦{standardFeeNgn.toLocaleString()}
                              </span>
                            )}
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
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="w-full py-2.5 rounded-full bg-transparent hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
                      >
                        &larr; Back to Edit
                      </button>
                    </div>
                  </>
                )}
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
          title={cropTarget === 'secondary' ? 'Resize & Position Second Photo' : 'Resize & Position Portrait'}
          helperText="Move the square portrait frame across your photo to capture your face."
        />
      )}
    </div>
  );
};
