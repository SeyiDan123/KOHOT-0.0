import React, { useState, useRef } from 'react';
import { ClassSet, StudentProfile } from '../../types';
import { compressImageToWebP, CompressionResult, fileToUniversalDataUrl } from '../../utils/imageCompressor';
import { X, Upload, CheckCircle2, Sparkles, Image as ImageIcon, ArrowRight, Crown, Sliders, Calendar, ExternalLink, ChevronDown, ChevronUp, BookOpen, Trophy } from 'lucide-react';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from '../../utils/leadershipHierarchy';
import { cleanWhatsAppStoryText, parseStoryBlocks, countStoryWords } from '../../utils/storyFormatting';
import { getAwardVisualConfig } from '../../utils/awardVisuals';
import { ImageCropModal } from '../common/ImageCropModal';
import { UniversalModal } from '../common/UniversalModal';
import { SocialUrlInputField } from '../common/SocialUrlInputField';
import { generateGoogleCalendarUrl, downloadIcsCalendarFile } from '../../utils/calendarHelper';
import { getAlbumUrl } from '../../utils/urlHelper';
import { uploadMediaToR2, submitStudentProfileOnServer, fetchInviteUploadTokenFromServer } from '../../utils/apiClient';

interface FrictionlessSubmitModalProps {
  currentSet: ClassSet;
  isOpen: boolean;
  onClose: () => void;
  onSubmitStudent: (student: StudentProfile) => void;
}

export const FrictionlessSubmitModal: React.FC<FrictionlessSubmitModalProps> = ({
  currentSet,
  isOpen,
  onClose,
  onSubmitStudent,
}) => {
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState('');
  const [quote, setQuote] = useState('');
  const [bio] = useState('');
  const [myStory, setMyStory] = useState('');
  const [isStoryExpanded, setIsStoryExpanded] = useState(false);
  const [isMoreAboutMeExpanded, setIsMoreAboutMeExpanded] = useState(false);
  const [isFinalWordsExpanded, setIsFinalWordsExpanded] = useState(false);
  const [isAwardsRevealed, setIsAwardsRevealed] = useState(false);
  const [favouriteCampusMemory, setFavouriteCampusMemory] = useState('');
  const [funFact, setFunFact] = useState('');
  const [whatsNext, setWhatsNext] = useState('');
  const [messageToClassmates, setMessageToClassmates] = useState('');
  const [messageToFutureSet, setMessageToFutureSet] = useState('');
  const [email, setEmail] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [facebookHandle, setFacebookHandle] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [secondaryPhotoDataUrl, setSecondaryPhotoDataUrl] = useState('');
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isCompressingSecondary, setIsCompressingSecondary] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showRemindOptions, setShowRemindOptions] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<'primary' | 'secondary'>('primary');
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const secondaryFileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen && currentSet.id) {
      fetchInviteUploadTokenFromServer(currentSet.id).then((t) => {
        if (t) setInviteToken(t);
      });
    }
  }, [isOpen, currentSet.id]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropTarget('primary');
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

  const handleSecondaryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropTarget('secondary');
    try {
      const dataUrl = await fileToUniversalDataUrl(file);
      if (dataUrl) {
        setRawPhotoToCrop(dataUrl);
        setIsCropModalOpen(true);
      }
    } catch (err) {
      console.error('Error reading secondary gallery file:', err);
    }
  };

  const handleApplyCrop = async (croppedDataUrl: string) => {
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
      } catch (err) {
        setSecondaryPhotoDataUrl(croppedDataUrl);
      } finally {
        setIsCompressingSecondary(false);
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

      // Upload to Cloudflare R2 object storage
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
    } catch (err: any) {
      console.error('Compression/upload error:', err);
      setUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !photoDataUrl) return;

    const trimmedPos = position.trim();
    const hasLeaderTitle = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

    const newStudent: StudentProfile = {
      id: `std-${Date.now()}`,
      setId: currentSet.id,
      fullName: fullName.trim(),
      nickname: nickname.trim() || undefined,
      position: trimmedPos || 'Member',
      photoUrl: photoDataUrl,
      secondaryPhotoUrl: secondaryPhotoDataUrl || undefined,
      rawSecondaryPhotoUrl: secondaryPhotoDataUrl || undefined,
      originalSizeKb: compressionInfo?.originalSizeKb,
      compressedSizeKb: compressionInfo?.compressedSizeKb,
      quote: quote.trim() ? quote.trim().slice(0, 140) : undefined,
      bio: bio.trim() || undefined,
      myStory: myStory.trim() ? myStory.trim().slice(0, 10000) : undefined,
      storyUpdatedAt: myStory.trim() ? new Date().toISOString() : undefined,
      storyEditLog: myStory.trim()
        ? [
            {
              id: `stlog-${Date.now()}`,
              timestamp: new Date().toISOString(),
              actorName: fullName.trim() || 'Student',
              actorRole: 'student',
              summary: `Submitted story (${countStoryWords(myStory)} words)`,
            },
          ]
        : undefined,
      favouriteCampusMemory: favouriteCampusMemory.trim() ? favouriteCampusMemory.trim().slice(0, 140) : undefined,
      funFact: funFact.trim() ? funFact.trim().slice(0, 140) : undefined,
      whatsNext: whatsNext.trim() ? whatsNext.trim().slice(0, 140) : undefined,
      messageToClassmates: messageToClassmates.trim() || undefined,
      messageToFutureSet: messageToFutureSet.trim() || undefined,
      email: email.trim() || undefined,
      instagramOrTwitter: (instagramHandle.trim() || twitterHandle.trim()) || undefined,
      socials: {
        instagram: instagramHandle.trim() || undefined,
        tiktok: tiktokHandle.trim() || undefined,
        twitter: twitterHandle.trim() || undefined,
        linkedin: linkedinHandle.trim() || undefined,
        facebook: facebookHandle.trim() || undefined,
      },
      approved: true, // Appears immediately live on the album
      approvedAt: Date.now(),
      submittedAt: new Date().toISOString().split('T')[0],
      leaderOrder: hasLeaderTitle ? calculateIntuitiveHierarchyRank(trimmedPos) : undefined,
    };

    submitStudentProfileOnServer(currentSet.id, newStudent).catch((err) => {
      console.warn('Server sync error for student submission:', err);
    });

    onSubmitStudent(newStudent);
    setIsSuccess(true);
  };

  return (
    <>
      <UniversalModal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="lg"
      >

        {isSuccess ? (
          <div className="text-center py-10 space-y-5 text-slate-900">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-syne font-bold text-2xl text-slate-900">Profile Added to Album!</h3>
            <p className="font-body text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Your graduate card, portrait, and parting quote are now live on <span className="text-slate-900 font-semibold">{currentSet.departmentName}</span>'s permanent album record.
            </p>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-mono-tech text-emerald-800 max-w-xs mx-auto">
              Status: <span className="font-semibold text-emerald-700">Live on Album</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Your classmate card is now visible to everyone.</p>
            </div>
            <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
              <button
                id="finish-submit-btn"
                onClick={() => {
                  setIsSuccess(false);
                  onClose();
                }}
                className="w-full bg-slate-900 text-white font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-6 rounded-full hover:bg-black transition-colors cursor-pointer shadow-md"
              >
                View on Album
              </button>

              <button
                type="button"
                onClick={() => setShowRemindOptions(!showRemindOptions)}
                className="w-full inline-flex items-center justify-center gap-2 text-xs font-mono-tech uppercase tracking-wider text-amber-950 bg-amber-400 hover:bg-amber-300 py-3 px-6 rounded-full transition-all cursor-pointer shadow-sm active:scale-95 font-bold"
              >
                <Calendar className="w-4 h-4 text-amber-950" />
                <span>Remind Me Yearly</span>
              </button>

              {showRemindOptions && (
                <div className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-left animate-fadeIn shadow-sm">
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
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-mono-tech flex items-center justify-between text-slate-800 cursor-pointer transition-colors"
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
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-mono-tech flex items-center justify-between text-slate-800 cursor-pointer transition-colors"
                  >
                    <span>Apple / other (.ics)</span>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Download</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-slate-900">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-900 text-[10px] font-mono-tech uppercase tracking-widest flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Preserve Your Place
                </span>
              </div>
              <h2 className="font-syne font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Submit Your Card
              </h2>
              <p className="font-body text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Add your official portrait to <span className="text-slate-900 font-semibold">{currentSet.departmentName}</span>'s permanent class record.
              </p>
            </div>


            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Upload & Automatic Portrait Optimization */}
              <div>
                <label className="block font-mono-tech text-xs uppercase tracking-wider text-slate-700 font-bold mb-2">
                  Face Photo <span className="text-red-500">*</span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {photoDataUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white p-3 flex items-center gap-4 shadow-xs">
                    <img
                      src={photoDataUrl}
                      alt="Compressed Preview"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-slate-900 font-mono-tech text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Portrait added</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1 rounded-full bg-slate-900 text-white font-mono-tech text-[10px] font-semibold hover:bg-black transition-colors cursor-pointer"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoDataUrl('');
                            setCompressionInfo(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 font-mono-tech text-[10px] transition-colors cursor-pointer border border-slate-200"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRawPhotoToCrop(photoDataUrl);
                            setIsCropModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 font-mono-tech text-[10px] flex items-center gap-1 cursor-pointer transition-colors border border-amber-500/30"
                        >
                          <Sliders className="w-3 h-3 text-amber-600" />
                          <span>Adjust Framing</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 text-center bg-white hover:bg-slate-50 transition-all shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-2 text-slate-900">
                      {isCompressing ? (
                        <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-slate-900" />
                      )}
                    </div>
                    <p className="font-tech text-xs uppercase tracking-wider text-slate-900 font-bold">
                      {isCompressing ? 'Optimizing Studio Portrait...' : 'Choose Photo from Device'}
                    </p>
                    <p className="font-mono-tech text-[11px] text-slate-500 mt-1">
                      High-fidelity mobile portrait optimization in under 1 second
                    </p>
                  </div>
                )}
                {uploadError && (
                  <p className="text-xs text-red-600 font-mono-tech mt-2">
                    ⚠ {uploadError}
                  </p>
                )}
              </div>

              {/* Optional Second Photo (Shown in Full Profile View) */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1.5">
                  Second Photo <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional · shown in full view)</span>
                </label>
                <input
                  type="file"
                  ref={secondaryFileInputRef}
                  accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                  onChange={handleSecondaryFileChange}
                  className="hidden"
                />
                {secondaryPhotoDataUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <img
                        src={secondaryPhotoDataUrl}
                        alt="Second Photo Preview"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <span className="text-xs font-mono-tech font-bold text-slate-900 dark:text-white">
                        Second photo added
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => secondaryFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-mono-tech text-[10px] font-semibold cursor-pointer"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSecondaryPhotoDataUrl('');
                          if (secondaryFileInputRef.current) secondaryFileInputRef.current.value = '';
                        }}
                        className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono-tech text-[10px] cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => secondaryFileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-amber-500 text-xs font-mono-tech text-slate-600 dark:text-zinc-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isCompressingSecondary ? 'Uploading second photo...' : 'Upload Second Photo (Optional)'}</span>
                  </button>
                )}
              </div>

              {/* Name & Nickname */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                    Full Official Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="submit-fullname-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Oluwatosin Balogun"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                    Campus Nickname / Alias
                  </label>
                  <input
                    id="submit-nickname-input"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. 'T-Flow'"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                  />
                </div>
              </div>

              {/* Role / Position with Quick-Select */}
              <div className="space-y-1.5">
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                  Department Role / Office <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  id="submit-position-input"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. President, Class Governor, Class Rep, Social Sec"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    'President',
                    'Class Governor',
                    'Class Representative',
                    'Vice President',
                    'General Secretary',
                    'Welfare Director',
                    'Social Director',
                  ].map((roleOption) => {
                    const isSelected = position.trim().toLowerCase() === roleOption.toLowerCase();
                    return (
                      <button
                        key={roleOption}
                        type="button"
                        onClick={() => setPosition(isSelected ? '' : roleOption)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-tech transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold'
                            : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        {roleOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Parting Quote (max 140 characters) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                    Parting Quote <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional · max 140 chars)</span>
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
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                />
              </div>

              {/* Optional Collapsed Field: Add your story (optional) -> My story / parting words */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsStoryExpanded((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-zinc-200 font-bold">
                        Add your story (optional)
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        My story / parting words (up to 10,000 characters)
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-400 shrink-0">
                    {myStory.trim() ? `${countStoryWords(myStory)} words` : isStoryExpanded ? 'Collapse' : 'Expand'}
                    {isStoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                {isStoryExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 dark:border-zinc-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">
                          My Story / Parting Words <span className="text-slate-500 lowercase font-normal">(optional)</span>
                        </label>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                          Celebrate what the class achieved. Keep it respectful.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-400">
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
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#d4af37] focus:outline-none text-xs leading-relaxed"
                    />

                    {myStory.trim() && (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono-tech uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                            <Sparkles className="w-3 h-3" />
                            Live Preview
                          </span>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
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
                              <p key={idx} className="font-body text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
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
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                      Class Award
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAwardsRevealed((prev) => !prev)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 transition-colors cursor-pointer"
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

              {/* Email Input with annual reminder notice */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                  Email Address <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  id="submit-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                />
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono-tech mt-1">
                  Meant for annual reminder about this album to relive the experience
                </p>
              </div>

              {/* Social Links */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                    Social Links
                  </span>
                  <span className="font-mono-tech text-[10px] text-slate-500 dark:text-zinc-400">
                    Type username only
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SocialUrlInputField
                    label="Instagram"
                    prefix="instagram.com/"
                    value={instagramHandle}
                    onChange={setInstagramHandle}
                    placeholder="username"
                  />
                  <SocialUrlInputField
                    label="TikTok"
                    prefix="tiktok.com/@"
                    value={tiktokHandle}
                    onChange={setTiktokHandle}
                    placeholder="username"
                  />
                  <SocialUrlInputField
                    label="X (Twitter)"
                    prefix="x.com/"
                    value={twitterHandle}
                    onChange={setTwitterHandle}
                    placeholder="username"
                  />
                  <SocialUrlInputField
                    label="LinkedIn"
                    prefix="linkedin.com/in/"
                    value={linkedinHandle}
                    onChange={setLinkedinHandle}
                    placeholder="username"
                  />
                  <SocialUrlInputField
                    label="Facebook"
                    prefix="facebook.com/"
                    value={facebookHandle}
                    onChange={setFacebookHandle}
                    placeholder="username"
                  />
                </div>
              </div>

              {/* Collapsed "More about me (optional)" */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsMoreAboutMeExpanded((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-zinc-200 font-bold">
                      More about me <span className="text-slate-500 lowercase font-normal">(optional)</span>
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      Favourite campus memory, fun fact, and what’s next
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-400 shrink-0">
                    {isMoreAboutMeExpanded ? 'Collapse' : 'Expand'}
                    {isMoreAboutMeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                {isMoreAboutMeExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-slate-200/80 dark:border-zinc-800 space-y-4">
                    {/* Favourite Campus Memory (max 140 chars) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Favourite Campus Memory <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional · max 140 chars)</span>
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
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:outline-none text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Fun Fact (max 140 chars) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          Fun Fact <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional · max 140 chars)</span>
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
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:outline-none text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* What's Next (max 140 chars) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                          What’s Next <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional · max 140 chars)</span>
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
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:outline-none text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsed "Final words (optional)" */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsFinalWordsExpanded((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-zinc-200 font-bold">
                      Final words <span className="text-slate-500 lowercase font-normal">(optional)</span>
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      A message to my classmates &amp; a message to future set
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-400 shrink-0">
                    {isFinalWordsExpanded ? 'Collapse' : 'Expand'}
                    {isFinalWordsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                {isFinalWordsExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-slate-200/80 dark:border-zinc-800 space-y-4">
                    {/* A Message to My Classmates (optional) */}
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                        A Message to My Classmates <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={messageToClassmates}
                        onChange={(e) => setMessageToClassmates(e.target.value)}
                        placeholder="A parting word to your graduating set..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:outline-none text-xs text-slate-900 dark:text-white resize-none"
                      />
                    </div>

                    {/* A Message to Future Set (optional) */}
                    <div>
                      <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                        A Message to Future Set <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={messageToFutureSet}
                        onChange={(e) => setMessageToFutureSet(e.target.value)}
                        placeholder="Advice for upcoming sets in the department..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:outline-none text-xs text-slate-900 dark:text-white resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  id="submit-card-btn"
                  type="submit"
                  disabled={!fullName || !photoDataUrl || isCompressing}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-6 rounded-full hover:bg-black dark:hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-slate-900 dark:disabled:hover:bg-white transition-all cursor-pointer shadow-md active:scale-95"
                >
                  Submit Card to Department Album
                </button>
              </div>
            </form>
          </div>
        )}
      </UniversalModal>

      {/* Embedded Crop & Positioning Modal */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={rawPhotoToCrop}
        onClose={() => setIsCropModalOpen(false)}
        onApplyCrop={handleApplyCrop}
        initialAspectRatio="1:1"
        isProfileSubmission={true}
        title="Resize & Position Portrait"
        helperText="Move the square portrait frame across your photo to capture your face."
      />
    </>
  );
};
