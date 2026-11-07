import React, { useState, useEffect } from 'react';
import { StudentProfile, ClassSet } from '../../types';
import { compressImageToWebP, CompressionResult } from '../../utils/imageCompressor';
import { uploadMediaToR2 } from '../../utils/apiClient';
import { ImageDropzone } from '../common/ImageDropzone';
import { ImageCropModal } from '../common/ImageCropModal';
import { UniversalModal } from '../common/UniversalModal';
import {
  Crown,
  Trash2,
  Crop,
  Instagram,
  Linkedin,
  Facebook,
  BookOpen,
  Eye,
  EyeOff,
  Sparkles,
  History,
  ChevronDown,
  ChevronUp,
  Trophy,
  Plus,
  X,
} from 'lucide-react';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from '../../utils/leadershipHierarchy';
import {
  cleanWhatsAppStoryText,
  parseStoryBlocks,
  countStoryWords,
  getDisplayRoleLabel,
} from '../../utils/storyFormatting';
import {
  getAwardVisualConfig,
  getDistinctAwardVisualsForList,
  getStudentCombinedAwards,
} from '../../utils/awardVisuals';
import { useFeedback } from '../common/FeedbackSystem';
import { isValidEmail } from '../../utils/emailValidator';
import { SocialUrlInputField } from '../common/SocialUrlInputField';

interface EditStudentModalProps {
  isOpen: boolean;
  student: StudentProfile | null;
  onClose: () => void;
  onSave: (updatedStudent: StudentProfile, approveNow?: boolean) => void;
  onDelete?: (studentId: string) => void;
  currentSet: ClassSet;
  isStudentSelfEdit?: boolean;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  student,
  onClose,
  onSave,
  onDelete,
  currentSet,
  isStudentSelfEdit = false,
}) => {
  const { showSuccess, showError, showWarning, confirmWarning } = useFeedback();
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState('');
  const [quote, setQuote] = useState('');
  const [myStory, setMyStory] = useState('');
  const [hideMyStory, setHideMyStory] = useState(false);
  const [showLiveStoryPreview, setShowLiveStoryPreview] = useState(false);
  const [showAwardCard, setShowAwardCard] = useState(false);
  const [isMoreAboutMeOpen, setIsMoreAboutMeOpen] = useState(false);
  const [isFinalWordsOpen, setIsFinalWordsOpen] = useState(false);
  const [favouriteCampusMemory, setFavouriteCampusMemory] = useState('');
  const [funFact, setFunFact] = useState('');
  const [whatsNext, setWhatsNext] = useState('');
  const [messageToClassmates, setMessageToClassmates] = useState('');
  const [messageToFutureSet, setMessageToFutureSet] = useState('');
  const [email, setEmail] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [facebookHandle, setFacebookHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [rawPhotoUrl, setRawPhotoUrl] = useState('');
  const [cropSettings, setCropSettings] = useState<any>(undefined);
  const [secondaryPhotoUrl, setSecondaryPhotoUrl] = useState('');
  const [rawSecondaryPhotoUrl, setRawSecondaryPhotoUrl] = useState('');
  const [secondaryCropSettings, setSecondaryCropSettings] = useState<any>(undefined);
  const [cropTarget, setCropTarget] = useState<'primary' | 'secondary'>('primary');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [editableAwards, setEditableAwards] = useState<
    Array<{ id: string; category: string; citation?: string; trophyType?: string }>
  >([]);
  const [newAwardTitle, setNewAwardTitle] = useState('');

  const getInitialInstagramHandle = (s: StudentProfile | null) => {
    if (!s) return '';
    return (
      s.socials?.instagram ||
      (s.instagramOrTwitter && !s.instagramOrTwitter.includes('twitter.com')
        ? s.instagramOrTwitter
        : '') ||
      ''
    );
  };

  useEffect(() => {
    if (student) {
      setFullName(student.fullName || '');
      setNickname(student.nickname || '');
      setPosition(student.position || '');
      setQuote((student.quote || student.bio || '').slice(0, 140));
      setMyStory(student.myStory || '');
      setHideMyStory(Boolean(student.hideMyStory));
      setShowLiveStoryPreview(Boolean(student.myStory?.trim()));
      setShowAwardCard(false);
      setIsMoreAboutMeOpen(false);
      setIsFinalWordsOpen(false);
      setFavouriteCampusMemory((student.favouriteCampusMemory || '').slice(0, 140));
      setFunFact((student.funFact || '').slice(0, 140));
      setWhatsNext((student.whatsNext || '').slice(0, 140));
      setMessageToClassmates(student.messageToClassmates || '');
      setMessageToFutureSet(student.messageToFutureSet || '');
      setEmail(student.email || '');
      setInstagramHandle(getInitialInstagramHandle(student));
      setTwitterHandle(student.socials?.twitter || '');
      setTiktokHandle(student.socials?.tiktok || '');
      setLinkedinHandle(student.socials?.linkedin || '');
      setFacebookHandle(student.socials?.facebook || '');
      setPhotoUrl(student.photoUrl || '');
      setRawPhotoUrl(student.rawPhotoUrl || student.photoUrl || '');
      setCropSettings(student.cropSettings);
      setSecondaryPhotoUrl(student.secondaryPhotoUrl || '');
      setRawSecondaryPhotoUrl(student.rawSecondaryPhotoUrl || student.secondaryPhotoUrl || '');
      setSecondaryCropSettings(student.secondaryCropSettings);
      setCompressionInfo(null);
      const combined = getStudentCombinedAwards(student, currentSet?.awards).map((a) => ({
        id: a.id,
        category: a.category,
        citation: a.citation,
        trophyType: a.trophyType,
      }));
      setEditableAwards(combined);
      setNewAwardTitle('');
    }
  }, [student]);

  if (!isOpen || !student) return null;

  const initialInstagram = getInitialInstagramHandle(student);
  const initialQuote = (student.quote || student.bio || '').slice(0, 140);

  const isDirty = Boolean(
    student &&
      (fullName !== (student.fullName || '') ||
        nickname !== (student.nickname || '') ||
        position !== (student.position || '') ||
        quote !== initialQuote ||
        myStory !== (student.myStory || '') ||
        hideMyStory !== Boolean(student.hideMyStory) ||
        favouriteCampusMemory !== (student.favouriteCampusMemory || '').slice(0, 140) ||
        funFact !== (student.funFact || '').slice(0, 140) ||
        whatsNext !== (student.whatsNext || '').slice(0, 140) ||
        messageToClassmates !== (student.messageToClassmates || '') ||
        messageToFutureSet !== (student.messageToFutureSet || '') ||
        email !== (student.email || '') ||
        instagramHandle !== initialInstagram ||
        twitterHandle !== (student.socials?.twitter || '') ||
        tiktokHandle !== (student.socials?.tiktok || '') ||
        linkedinHandle !== (student.socials?.linkedin || '') ||
        facebookHandle !== (student.socials?.facebook || '') ||
        photoUrl !== (student.photoUrl || '') ||
        secondaryPhotoUrl !== (student.secondaryPhotoUrl || ''))
  );

  const handleAttemptClose = () => {
    if (isDirty) {
      confirmWarning({
        title: 'Discard your changes?',
        message: 'Your changes will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep Editing',
        isDestructive: true,
        onConfirm: onClose,
      });
    } else {
      onClose();
    }
  };

  const handleSaveInternal = (approveNow: boolean = false) => {
    if (!fullName.trim()) {
      showError('Name required', 'Please enter the official full name.');
      return;
    }

    if (email.trim() && !isValidEmail(email.trim())) {
      showError(
        'Valid email required',
        'Please enter a valid, accurate email address (e.g., name@domain.com).'
      );
      return;
    }

    const effectivePhoto = photoUrl.trim() || student.photoUrl || '';
    if (!effectivePhoto && approveNow) {
      showError(
        'Photo required for live album',
        'Please upload or resize a portrait photo before approving.'
      );
      return;
    }

    try {
      const trimmedPos = position.trim();
      const hasLeaderTitle = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });
      const cleanedStory = myStory.trim() ? myStory.trim().slice(0, 10000) : undefined;
      const previousStory = (student.myStory || '').trim();
      const storyChanged = (cleanedStory || '') !== previousStory;
      const hideChanged = hideMyStory !== Boolean(student.hideMyStory);

      const nextEditLog = [...(student.storyEditLog || [])];
      if (storyChanged || hideChanged) {
        const summaryParts: string[] = [];
        if (storyChanged) {
          summaryParts.push(
            !previousStory && cleanedStory
              ? `Added story (${countStoryWords(cleanedStory)} words)`
              : !cleanedStory && previousStory
              ? 'Cleared story text'
              : `Edited story (${countStoryWords(cleanedStory)} words)`
          );
        }
        if (hideChanged) {
          summaryParts.push(hideMyStory ? 'Hidden from album' : 'Restored to album');
        }
        nextEditLog.unshift({
          id: `stlog-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorName: currentSet?.classRepName || 'Album Admin',
          actorRole: 'admin',
          summary: summaryParts.join(' · '),
        });
      }

      const updated: StudentProfile = {
        ...student,
        fullName: fullName.trim(),
        nickname: nickname.trim() || undefined,
        position: trimmedPos || 'Member',
        quote: quote.trim().slice(0, 140) || undefined,
        bio: student.bio, // Preserve existing bio record without deleting data
        myStory: cleanedStory,
        hideMyStory,
        storyUpdatedAt: storyChanged ? new Date().toISOString() : student.storyUpdatedAt,
        storyEditLog: nextEditLog.slice(0, 25),
        favouriteCampusMemory: favouriteCampusMemory.trim().slice(0, 140) || undefined,
        funFact: funFact.trim().slice(0, 140) || undefined,
        whatsNext: whatsNext.trim().slice(0, 140) || undefined,
        messageToClassmates: messageToClassmates.trim() || undefined,
        messageToFutureSet: messageToFutureSet.trim() || undefined,
        studentAwards: editableAwards,
        email: email.trim() || undefined,
        instagramOrTwitter: (instagramHandle.trim() || twitterHandle.trim()) || undefined,
        isClassRep:
          student.isClassRep || student.id.startsWith('admin-') || student.id.includes('admin')
            ? true
            : undefined,
        socials: {
          ...(student.socials || {}),
          instagram: instagramHandle.trim() || undefined,
          twitter: twitterHandle.trim() || undefined,
          tiktok: tiktokHandle.trim() || undefined,
          linkedin: linkedinHandle.trim() || undefined,
          facebook: facebookHandle.trim() || undefined,
        },
        photoUrl: effectivePhoto,
        rawPhotoUrl: rawPhotoUrl || student.rawPhotoUrl || effectivePhoto,
        cropSettings: cropSettings || student.cropSettings,
        secondaryPhotoUrl: secondaryPhotoUrl.trim() || undefined,
        rawSecondaryPhotoUrl: secondaryPhotoUrl.trim()
          ? rawSecondaryPhotoUrl || student.rawSecondaryPhotoUrl || secondaryPhotoUrl.trim()
          : undefined,
        secondaryCropSettings: secondaryPhotoUrl.trim()
          ? secondaryCropSettings || student.secondaryCropSettings
          : undefined,
        approved: isStudentSelfEdit
          ? false
          : student.isClassRep || student.id.startsWith('admin-')
          ? true
          : approveNow
          ? true
          : student.approved,
        status: isStudentSelfEdit ? 'pending' : approveNow ? 'approved' : student.status,
        submissionStatus: isStudentSelfEdit ? 'pending' : approveNow ? 'approved' : student.submissionStatus,
        isProfileUpdate: isStudentSelfEdit ? true : approveNow ? false : student.isProfileUpdate,
        previousApproved: isStudentSelfEdit ? true : student.previousApproved,
        paymentStatus: isStudentSelfEdit ? student.paymentStatus || 'waived' : student.paymentStatus,
        usedSlot: isStudentSelfEdit ? true : student.usedSlot,
        slotConsumed: isStudentSelfEdit ? true : student.slotConsumed,
        leaderOrder: hasLeaderTitle
          ? student.leaderOrder ?? calculateIntuitiveHierarchyRank(trimmedPos)
          : undefined,
        originalSizeKb: compressionInfo?.originalSizeKb ?? student.originalSizeKb,
        compressedSizeKb: compressionInfo?.compressedSizeKb ?? student.compressedSizeKb,
      };

      onSave(updated, approveNow);
      if (isStudentSelfEdit) {
        showSuccess(
          'Profile update submitted!',
          'Your updated profile is now awaiting approval in the Class Admin dashboard.'
        );
      } else if (!effectivePhoto) {
        showWarning(
          'Profile saved',
          'Details saved! Add a portrait photo anytime so it appears on the live album.'
        );
      } else {
        showSuccess(approveNow ? 'Classmate added.' : 'Profile updated successfully.');
      }
      onClose();
    } catch (err) {
      console.error('Error saving student profile:', err);
      showError("We couldn't save your changes.", 'Please try again.');
    }
  };

  const isPending = student.approved === false;
  const isLeader = position.trim().length > 0 && isLeaderProfile({ position });
  const isAdminProfile = Boolean(student.isClassRep || student.id.startsWith('admin-'));
  const isDemoAlbum = Boolean(
    currentSet?.id?.startsWith('crownfield-') || currentSet?.institutionId === 'crownfield'
  );

  // Match awards belonging to this student
  const normName = (fullName || student.fullName || '').trim().toLowerCase();
  const normNick = (nickname || student.nickname || '').trim().toLowerCase();
  const studentAwards = (currentSet?.awards || []).filter((a) => {
    const wName = (a.winnerName || '').trim().toLowerCase();
    const wNick = (a.winnerNickname || '').trim().toLowerCase();
    if (normName && wName === normName) return true;
    if (normNick && wNick && wNick === normNick) return true;
    if (photoUrl && a.winnerAvatar && a.winnerAvatar === photoUrl) return true;
    return false;
  });

  const moreAboutCount = [
    favouriteCampusMemory.trim(),
    funFact.trim(),
    whatsNext.trim(),
  ].filter(Boolean).length;

  const finalWordsCount = [
    messageToClassmates.trim(),
    messageToFutureSet.trim(),
  ].filter(Boolean).length;

  return (
    <>
      <UniversalModal
        isOpen={isOpen}
        onClose={handleAttemptClose}
        hasUnsavedChanges={false}
        maxWidth="2xl"
        title={
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-bold tracking-wider ${
                  isStudentSelfEdit
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : isAdminProfile
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : isPending
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isStudentSelfEdit
                  ? 'Classmate Profile Update'
                  : isAdminProfile
                  ? 'Class Album Administrator'
                  : isPending
                  ? 'Pending Submission Review'
                  : 'Verified Classmate'}
              </span>
              {!isStudentSelfEdit && (
                <>
                  <span className="text-zinc-500 text-xs font-mono-tech">•</span>
                  <span className="text-zinc-400 text-xs font-mono-tech">ID: {student.id}</span>
                </>
              )}
            </div>

            <h3 className="font-syne font-bold text-xl sm:text-2xl text-white">
              {isStudentSelfEdit
                ? 'Update Your Profile'
                : isAdminProfile
                ? 'My Class Profile'
                : 'Edit Classmate Details'}
            </h3>
            <p className="font-body text-xs text-zinc-400">
              {isStudentSelfEdit
                ? 'Update your portrait, second photo, quote, or story. Your update will be sent to the Class Admin for approval.'
                : isAdminProfile
                ? 'Update your administrator credentials, executive title, parting quote, and story for the live album.'
                : 'Modify student credentials, adjust executive role titles, or refine parting words before or after publishing.'}
            </p>
          </div>
        }
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            {onDelete && !isStudentSelfEdit && (
              <button
                type="button"
                onClick={() => {
                  onDelete(student.id);
                }}
                className="text-xs font-mono-tech text-red-500 hover:text-red-400 underline decoration-red-500/30 hover:decoration-red-400 p-2 cursor-pointer transition-colors flex items-center gap-1.5 w-full sm:w-auto justify-start"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Delete Profile</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end ml-auto">
              <button
                type="button"
                onClick={handleAttemptClose}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveInternal(false)}
                className="px-6 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
              >
                {isStudentSelfEdit ? 'Submit Update for Approval' : 'Save Changes'}
              </button>
            </div>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveInternal(false);
          }}
          className="space-y-5"
        >
          {/* 1. Primary & Optional Second Photo Upload Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-bold">
                Official Face Portrait *
              </label>

              <ImageDropzone
                value={photoUrl}
                setId={currentSet.id}
                category="portrait"
                onChange={(url) => {
                  setPhotoUrl(url);
                  setRawPhotoUrl(url);
                }}
                aspectRatio="1:1"
                maxDimension={720}
                helperText="Main square portrait shown on album card & full view."
              />

              {photoUrl && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCropTarget('primary');
                      setRawPhotoToCrop(rawPhotoUrl || photoUrl);
                      setIsCropModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Resize photo</span>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-bold">
                Second Photo{' '}
                <span className="text-zinc-500 lowercase font-normal">
                  (optional · full view only)
                </span>
              </label>

              <ImageDropzone
                value={secondaryPhotoUrl}
                setId={currentSet.id}
                category="portrait"
                onChange={(url) => {
                  setSecondaryPhotoUrl(url);
                  setRawSecondaryPhotoUrl(url);
                }}
                aspectRatio="1:1"
                maxDimension={720}
                helperText="Displayed as a smaller square photo in full profile view."
              />

              {secondaryPhotoUrl && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSecondaryPhotoUrl('');
                      setRawSecondaryPhotoUrl('');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-mono-tech text-xs transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCropTarget('secondary');
                      setRawPhotoToCrop(rawSecondaryPhotoUrl || secondaryPhotoUrl);
                      setIsCropModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Resize 2nd photo</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. Full Name & 3. Nickname */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5 font-bold">
                Full Official Name *
              </label>
              <input
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Adebayo Ogunlesi"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5 font-bold">
                Nickname / Moniker{' '}
                <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Bayo, Boss"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* 4. Role */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                Class Role / Title{' '}
                <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                  (optional)
                </span>
              </label>
              {isLeader ? (
                <span className="text-[10px] font-mono-tech text-amber-500 dark:text-amber-400 flex items-center gap-1 font-semibold">
                  <Crown className="w-3 h-3" />
                  Recognized Leadership Office
                </span>
              ) : (
                <span className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-500">
                  Select or type custom
                </span>
              )}
            </div>

            <input
              type="text"
              list="edit-student-roles-list"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Social Director or Class Rep"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
            />
          </div>

          {/* 4b. Class Awards & Honours (each award gets a unique badge icon — never repeats) */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-zinc-200 font-bold flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    Class Awards &amp; Honours{' '}
                    <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                      (optional)
                    </span>
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Add or update class awards for this profile. Each award displays a distinct icon badge.
                </p>
              </div>
              {editableAwards.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono-tech text-[10px] font-bold shrink-0">
                  {editableAwards.length} {editableAwards.length === 1 ? 'award' : 'awards'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newAwardTitle}
                onChange={(e) => setNewAwardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = newAwardTitle.trim();
                    if (!trimmed) return;
                    if (
                      !editableAwards.some(
                        (a) => a.category.trim().toLowerCase() === trimmed.toLowerCase()
                      )
                    ) {
                      setEditableAwards((prev) => [
                        ...prev,
                        { id: `st-awd-${Date.now()}-${prev.length}`, category: trimmed },
                      ]);
                    }
                    setNewAwardTitle('');
                  }
                }}
                placeholder="e.g. Best Dressed, Most Influential..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = newAwardTitle.trim();
                  if (!trimmed) return;
                  if (
                    !editableAwards.some(
                      (a) => a.category.trim().toLowerCase() === trimmed.toLowerCase()
                    )
                  ) {
                    setEditableAwards((prev) => [
                      ...prev,
                      { id: `st-awd-${Date.now()}-${prev.length}`, category: trimmed },
                    ]);
                  }
                  setNewAwardTitle('');
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono-tech text-[11px] uppercase tracking-wider font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {editableAwards.length > 0 && (() => {
              const distinctModalVisuals = getDistinctAwardVisualsForList(editableAwards, false);
              return (
                <div className="space-y-1.5 pt-1">
                  {editableAwards.map((award, idx) => {
                    const visual =
                      distinctModalVisuals[idx] ||
                      getAwardVisualConfig(award.trophyType, false);
                    const AwardIcon = visual.icon;
                    return (
                      <div
                        key={award.id}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-[#08090e] border border-amber-300/60 dark:border-amber-500/30 flex items-center justify-between gap-2"
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
                            setEditableAwards((prev) => prev.filter((a) => a.id !== award.id))
                          }
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
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

          {/* 5. Parting Quote (140 characters) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                Parting Quote{' '}
                <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                  (optional · max 140 chars)
                </span>
              </label>
              <span className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-500">
                {quote.length}/140
              </span>
            </div>
            <input
              type="text"
              maxLength={140}
              value={quote}
              onChange={(e) => setQuote(e.target.value.slice(0, 140))}
              placeholder="e.g. Earn every victory through relentless preparation."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
            />
          </div>

          {/* 6. My Story */}
          {(() => {
            const storyWordCount = countStoryWords(myStory);

            return (
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-amber-300 font-bold">
                      My Story{' '}
                      <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                        (optional · up to 10,000 chars)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                      Celebrate what the class achieved. Keep it respectful.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-400">
                    {storyWordCount} {storyWordCount === 1 ? 'word' : 'words'} ·{' '}
                    {myStory.length.toLocaleString()}/10,000
                  </span>
                </div>

                <textarea
                  rows={5}
                  maxLength={10000}
                  value={myStory}
                  onChange={(e) => {
                    setMyStory(e.target.value.slice(0, 10000));
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (!pasted) return;
                    e.preventDefault();
                    const target = e.currentTarget;
                    const start = target.selectionStart ?? myStory.length;
                    const end = target.selectionEnd ?? myStory.length;
                    const combined = myStory.slice(0, start) + pasted + myStory.slice(end);
                    const cleaned = cleanWhatsAppStoryText(combined);
                    setMyStory(cleaned);
                  }}
                  placeholder="Write or paste parting words, reflections, or a full story. Lines wrapped in *Heading* become headings, and a closing paragraph in **bold** stays bold."
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs leading-relaxed"
                />
              </div>
            );
          })()}

          {/* 7. Class Award (Icons only + instruction to view + one-line card underneath) */}
          {studentAwards.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-[#d4af37] font-bold">
                  Class Award{studentAwards.length > 1 ? 's' : ''}
                </label>
                <button
                  type="button"
                  onClick={() => setShowAwardCard((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-[#d4af37] transition-all cursor-pointer"
                >
                  <div className="flex items-center -space-x-1">
                    {studentAwards.map((award) => {
                      const visual = getAwardVisualConfig(award.trophyType, false);
                      const AwardIcon = visual.icon;
                      return (
                        <span
                          key={award.id}
                          className={`w-5 h-5 flex items-center justify-center ${visual.shapeClass}`}
                        >
                          <AwardIcon
                            className={`w-3 h-3 ${visual.iconColor} ${
                              visual.type === 'crystal' ? '-rotate-45' : ''
                            }`}
                          />
                        </span>
                      );
                    })}
                  </div>
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider font-bold">
                    {showAwardCard
                      ? 'Hide award won'
                      : studentAwards.length === 1
                      ? 'Tap icon to view award won'
                      : `Tap icons to view ${studentAwards.length} awards won`}
                  </span>
                </button>
              </div>

              {showAwardCard && (
                <div className="space-y-1.5 animate-fadeIn">
                  {studentAwards.map((award) => {
                    const visual = getAwardVisualConfig(award.trophyType, false);
                    const AwardIcon = visual.icon;
                    return (
                      <div
                        key={award.id}
                        className="px-3.5 py-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-between gap-2 text-xs text-white"
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
                          <span className="font-syne font-bold truncate">{award.category}</span>
                        </div>
                        <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#d4af37] shrink-0">
                          {visual.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 8. Email Address */}
          <div>
            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5 font-bold">
              Email Address{' '}
              <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                (optional)
              </span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. adebayo.ogunlesi@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none font-body text-xs"
            />
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono-tech mt-1">
              Meant for annual reminder about this album to relive the experience
            </p>
          </div>

          {/* 9. Social Links */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                Social Links{' '}
                <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                  (optional)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SocialUrlInputField
                label="Instagram"
                prefix="instagram.com/"
                value={instagramHandle}
                onChange={setInstagramHandle}
                placeholder="username"
                icon={<Instagram className="w-3 h-3 text-[#E1306C]" />}
              />

              <SocialUrlInputField
                label="TikTok"
                prefix="tiktok.com/@"
                value={tiktokHandle}
                onChange={setTiktokHandle}
                placeholder="username"
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="w-3 h-3 fill-current text-slate-900 dark:text-white"
                  >
                    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 2.373-4.538c.328 0 .644.055.938.156V9.43a6.33 6.33 0 0 0-.938-.07 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.756a8.196 8.196 0 0 0 4.771 1.517V6.828c-.352 0-.691-.049-1-.142z" />
                  </svg>
                }
              />

              <SocialUrlInputField
                label="X (Twitter)"
                prefix="x.com/"
                value={twitterHandle}
                onChange={setTwitterHandle}
                placeholder="handle"
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="w-3 h-3 fill-current text-slate-900 dark:text-white"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                }
              />

              <SocialUrlInputField
                label="LinkedIn"
                prefix="linkedin.com/in/"
                value={linkedinHandle}
                onChange={setLinkedinHandle}
                placeholder="username"
                icon={<Linkedin className="w-3 h-3 text-[#0077b5]" />}
              />

              <div className="sm:col-span-2">
                <SocialUrlInputField
                  label="Facebook"
                  prefix="facebook.com/"
                  value={facebookHandle}
                  onChange={setFacebookHandle}
                  placeholder="username"
                  icon={<Facebook className="w-3 h-3 text-[#1877F2]" />}
                />
              </div>
            </div>
          </div>

          {/* 10. Collapsed "More about me (optional)" (Favourite Campus Memory, Fun Fact, What's Next) */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsMoreAboutMeOpen((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div>
                <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-zinc-200 font-bold">
                  More about me (optional)
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400">
                  Favourite campus memory, fun fact, and what&apos;s next
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-[#d4af37] shrink-0">
                {moreAboutCount > 0 ? `${moreAboutCount} filled` : isMoreAboutMeOpen ? 'Collapse' : 'Expand'}
                {isMoreAboutMeOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </button>

            {isMoreAboutMeOpen && (
              <div className="px-4 pb-4 pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                      Favourite Campus Memory{' '}
                      <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                        (optional · max 140 chars)
                      </span>
                    </label>
                    <span className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-500">
                      {favouriteCampusMemory.length}/140
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={140}
                    value={favouriteCampusMemory}
                    onChange={(e) => setFavouriteCampusMemory(e.target.value.slice(0, 140))}
                    placeholder="e.g. Winning the inter-faculty moot competition in final year..."
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                      Fun Fact{' '}
                      <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                        (optional · max 140 chars)
                      </span>
                    </label>
                    <span className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-500">
                      {funFact.length}/140
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={140}
                    value={funFact}
                    onChange={(e) => setFunFact(e.target.value.slice(0, 140))}
                    placeholder="e.g. Never missed an 8 AM lecture in 5 years"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                      What&apos;s Next{' '}
                      <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                        (optional · max 140 chars)
                      </span>
                    </label>
                    <span className="text-[10px] font-mono-tech text-slate-500 dark:text-zinc-500">
                      {whatsNext.length}/140
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={140}
                    value={whatsNext}
                    onChange={(e) => setWhatsNext(e.target.value.slice(0, 140))}
                    placeholder="e.g. Nigerian Law School & Corporate Litigation Practice"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 11. Collapsed "Final words (optional)" (A Message to My Classmates & A Message to Future Set) */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsFinalWordsOpen((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div>
                <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-800 dark:text-zinc-200 font-bold">
                  Final words (optional)
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400">
                  A message to my classmates and a message to future set
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-[#d4af37] shrink-0">
                {finalWordsCount > 0 ? `${finalWordsCount} filled` : isFinalWordsOpen ? 'Collapse' : 'Expand'}
                {isFinalWordsOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </button>

            {isFinalWordsOpen && (
              <div className="px-4 pb-4 pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-4">
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1 font-bold">
                    A Message to My Classmates{' '}
                    <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={messageToClassmates}
                    onChange={(e) => setMessageToClassmates(e.target.value)}
                    placeholder="A parting word to your graduating set..."
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none resize-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1 font-bold">
                    A Message to Future Set{' '}
                    <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={messageToFutureSet}
                    onChange={(e) => setMessageToFutureSet(e.target.value)}
                    placeholder="Advice for upcoming sets in the department..."
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none resize-none text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      </UniversalModal>

      {/* Embedded Portrait Crop Modal */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={rawPhotoToCrop}
        initialCropSettings={cropTarget === 'secondary' ? secondaryCropSettings : cropSettings}
        onClose={() => setIsCropModalOpen(false)}
        onApplyCrop={async (croppedUrl, newSettings) => {
          setIsCropModalOpen(false);
          setIsCompressing(true);
          try {
            const compRes = await compressImageToWebP(croppedUrl, 720, 0.88);
            const uploadRes = await uploadMediaToR2(compRes.dataUrl, {
              setId: currentSet.id,
              category: 'portrait',
              fileName: `${
                fullName ? fullName.replace(/\s+/g, '-').toLowerCase() : 'student'
              }-${cropTarget === 'secondary' ? 'second-portrait' : 'portrait'}.webp`,
            });
            if (uploadRes.success && uploadRes.url) {
              if (cropTarget === 'secondary') {
                setSecondaryPhotoUrl(uploadRes.url);
                setRawSecondaryPhotoUrl(uploadRes.url);
                if (newSettings) setSecondaryCropSettings(newSettings);
              } else {
                setPhotoUrl(uploadRes.url);
                setRawPhotoUrl(uploadRes.url);
                if (newSettings) setCropSettings(newSettings);
              }
            } else {
              showError(
                'Upload failed',
                uploadRes.error || 'Could not upload portrait to cloud storage. Please retry.'
              );
            }
          } catch (err: any) {
            showError('Upload failed', err?.message || 'Could not upload portrait. Please retry.');
          } finally {
            setIsCompressing(false);
          }
        }}
        initialAspectRatio="1:1"
        isProfileSubmission={true}
        title={cropTarget === 'secondary' ? 'Resize & Position Second Photo' : 'Resize & Position Portrait'}
        helperText="Move the square portrait frame across your photo for official class album display."
      />
    </>
  );
};
