import React, { useState, useRef, useEffect } from 'react';
import { ClassSet, StudentProfile } from '../../types';
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
  Crop
} from 'lucide-react';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from '../../utils/leadershipHierarchy';
import { updateSocialMetaTags } from '../../utils/metaTags';
import { SocialIconsRow } from '../common/SocialIconsRow';
import { ImageCropModal } from '../common/ImageCropModal';
import { isValidEmail } from '../../utils/emailValidator';

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
  const [emailError, setEmailError] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [facebookHandle, setFacebookHandle] = useState('');
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedStudent, setSubmittedStudent] = useState<StudentProfile | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to top on mount and set social meta tags with album hero thumbnail
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateSocialMetaTags({
      title: `Submit Your Profile | ${currentSet.departmentName} (Class of ${currentSet.graduationYear})`,
      description: `Join your classmates in the official digital class album for ${currentSet.departmentName}, ${currentSet.institutionName}. Submit your portrait, nickname, and parting quote!`,
      imageUrl: currentSet.bannerImageUrl,
      url: window.location.href,
    });
  }, [currentSet.departmentName, currentSet.graduationYear, currentSet.institutionName, currentSet.bannerImageUrl]);

  const processSelectedFile = async (file: File) => {
    try {
      const dataUrl = await fileToUniversalDataUrl(file);
      if (dataUrl) {
        setRawPhotoToCrop(dataUrl);
        setIsCropModalOpen(true);
      }
    } catch (err) {
      console.error('Error reading gallery file:', err);
    }
  };

  const handleApplyCrop = async (croppedDataUrl: string) => {
    setIsCompressing(true);
    try {
      const fetchRes = await fetch(croppedDataUrl);
      const blob = await fetchRes.blob();
      const file = new File([blob], 'student-portrait.webp', { type: 'image/webp' });

      const result = await compressImageToWebP(file, 800, 0.88);
      setCompressionInfo(result);
      setPhotoDataUrl(result.dataUrl);
    } catch (err) {
      console.error('Compression error:', err);
      setPhotoDataUrl(croppedDataUrl);
    } finally {
      setIsCompressing(false);
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
    if (!photoDataUrl) {
      alert('Please upload your official face portrait.');
      return false;
    }
    if (!fullName.trim()) {
      alert('Please enter your full official name.');
      return false;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address (e.g. name@domain.com).');
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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullName.trim() || !photoDataUrl) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address to complete submission.');
      setCurrentStep(1);
      return;
    }
    setEmailError('');

    const trimmedPos = position.trim();
    const hasLeaderTitle = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

    const newStudent: StudentProfile = {
      id: `std-${Date.now()}`,
      setId: currentSet.id,
      fullName: fullName.trim(),
      nickname: nickname.trim() || undefined,
      position: trimmedPos || 'Member',
      photoUrl: photoDataUrl,
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
        facebook: facebookHandle.trim() || undefined,
      },
      approved: false, // Awaiting verification from class album admin
      submittedAt: new Date().toISOString().split('T')[0],
      leaderOrder: hasLeaderTitle ? calculateIntuitiveHierarchyRank(trimmedPos) : undefined,
    };

    onSubmitStudent(newStudent);
    setSubmittedStudent(newStudent);
    setIsSuccess(true);
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
            <div className="flex items-center gap-2">
              <span className="font-syne font-extrabold text-base tracking-tight text-slate-900 dark:text-white">KoHot</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[10px] font-mono-tech uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-bold">
                Graduate Entry
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono-tech text-slate-600 dark:text-slate-400 font-semibold">
              Class of {currentSet.graduationYear}
            </span>
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
            <div className="flex items-center justify-between relative max-w-md mx-auto">
              {/* Connecting Progress Track Line */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0.5 bg-slate-200 dark:bg-neutral-800 z-0" />
              <div 
                className="absolute top-1/2 left-0 -translate-y-1/2 h-0.5 bg-slate-900 dark:bg-white z-0 transition-all duration-300" 
                style={{ width: currentStep === 1 ? '0%' : '100%' }}
              />

              {/* Step 1 Node */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="relative z-10 flex items-center gap-2 cursor-pointer group"
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

              {/* Step 2 Node */}
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setCurrentStep(2);
                }}
                className="relative z-10 flex items-center gap-2 cursor-pointer group"
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
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onViewDemoAlbums) {
                    onViewDemoAlbums();
                  } else if (onViewAlbum) {
                    onViewAlbum();
                  }
                }}
                className="inline-flex items-center gap-2 text-xs font-mono-tech uppercase tracking-widest text-white bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 py-3.5 px-8 rounded-full transition-all cursor-pointer shadow-md active:scale-95 font-bold"
              >
                <span>View Class Album &rarr;</span>
              </button>
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
                            className="w-20 h-25 aspect-[4/5] rounded-xl object-cover border border-slate-300 dark:border-neutral-700 shadow-md bg-white"
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
                                  setRawPhotoToCrop(photoDataUrl);
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
                              {isCompressing ? 'Processing photo...' : 'Click to Upload Portrait or Drag & Drop'}
                            </p>
                            <p className="font-mono-tech text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              JPG, PNG, HEIC, WEBP supported
                            </p>
                          </div>
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

                    {/* Pocket list of popular roles */}
                    <div className="pt-1">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px] font-mono-tech">
                        <span className="text-slate-500 dark:text-zinc-500 shrink-0 font-semibold">Pocket list:</span>
                        {[
                          'Class President',
                          'Vice President',
                          'General Secretary',
                          'Financial Secretary',
                          'Public Relations Officer (P.R.O)',
                          'Director of Socials',
                          'Director of Sports',
                          'Academic Secretary',
                          'Welfare Secretary',
                          'Valedictorian',
                          'Graduate',
                        ].map((roleItem) => (
                          <button
                            key={roleItem}
                            type="button"
                            onClick={() => setPosition(roleItem)}
                            className={`px-2 py-0.5 rounded-md border shrink-0 transition-colors cursor-pointer ${
                              position === roleItem
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold'
                                : 'bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-neutral-800'
                            }`}
                          >
                            {roleItem}
                          </button>
                        ))}
                      </div>
                    </div>
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

                  {/* Email Address */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                        Email Address *
                      </label>
                      <span className="text-[10px] font-mono-tech text-slate-500">
                        For annual anniversary relive emails
                      </span>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                      placeholder="e.g. adebayo@alumni.edu"
                      className={`w-full px-4 py-2.5 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none text-xs transition-colors shadow-xs ${
                        emailError ? 'border-red-500 focus:border-red-500' : 'border-slate-300 dark:border-neutral-700 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900'
                      }`}
                    />
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
                      <div>
                        <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                          Instagram
                        </label>
                        <input
                          type="text"
                          value={instagramHandle}
                          onChange={(e) => setInstagramHandle(e.target.value)}
                          placeholder="e.g. @username"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none font-mono-tech shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                          X
                        </label>
                        <input
                          type="text"
                          value={twitterHandle}
                          onChange={(e) => setTwitterHandle(e.target.value)}
                          placeholder="e.g. @handle"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none font-mono-tech shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                          LinkedIn
                        </label>
                        <input
                          type="text"
                          value={linkedinHandle}
                          onChange={(e) => setLinkedinHandle(e.target.value)}
                          placeholder="e.g. linkedin.com/in/username"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none font-mono-tech shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                          Facebook
                        </label>
                        <input
                          type="text"
                          value={facebookHandle}
                          onChange={(e) => setFacebookHandle(e.target.value)}
                          placeholder="e.g. facebook.com/username"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#f8f9fa] dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none font-mono-tech shadow-xs"
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

                {/* Simulated Card matching DepartmentAlbumView 4:5 grid format */}
                <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 overflow-hidden shadow-xl text-slate-900 dark:text-white">
                  {/* Photo with exact 4:5 aspect ratio */}
                  <div className="relative w-full aspect-[4/5] bg-slate-100 dark:bg-neutral-950 overflow-hidden">
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
                    {(instagramHandle || twitterHandle || linkedinHandle || facebookHandle) && (
                      <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between">
                        <span className="font-mono-tech text-[10px] uppercase text-slate-500 tracking-wider">
                          Socials
                        </span>
                        <SocialIconsRow
                          socials={{
                            instagram: instagramHandle,
                            twitter: twitterHandle,
                            linkedin: linkedinHandle,
                            facebook: facebookHandle,
                          }}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2 Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 py-3 rounded-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
                  >
                    &larr; Back to Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="flex-1 py-3.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Confirm &amp; Submit</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Profile Photo Crop Modal (Matches Display 4:5 Aspect Ratio) */}
      {isCropModalOpen && rawPhotoToCrop && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={rawPhotoToCrop}
          onClose={() => setIsCropModalOpen(false)}
          onApplyCrop={handleApplyCrop}
          initialAspectRatio="4:5"
          isProfileSubmission={true}
          title="Position Your Portrait"
          helperText="Move the 4:5 portrait frame across your photo to capture your face."
        />
      )}
    </div>
  );
};
