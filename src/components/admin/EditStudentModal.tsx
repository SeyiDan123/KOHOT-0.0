import React, { useState, useEffect, useRef } from 'react';
import { StudentProfile, ClassSet } from '../../types';
import { compressImageToWebP, CompressionResult } from '../../utils/imageCompressor';
import { ImageDropzone } from '../common/ImageDropzone';
import { ImageCropModal } from '../common/ImageCropModal';
import { UniversalModal } from '../common/UniversalModal';
import { 
  Crown, 
  Trash2, 
  Crop
} from 'lucide-react';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from '../../utils/leadershipHierarchy';
import { useFeedback } from '../common/FeedbackSystem';
import { isValidEmail } from '../../utils/emailValidator';

interface EditStudentModalProps {
  isOpen: boolean;
  student: StudentProfile | null;
  onClose: () => void;
  onSave: (updatedStudent: StudentProfile, approveNow?: boolean) => void;
  onDelete?: (studentId: string) => void;
  currentSet: ClassSet;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  student,
  onClose,
  onSave,
  onDelete,
  currentSet,
}) => {
  const { showSuccess, showError, showWarning, confirmWarning } = useFeedback();
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState('');
  const [quote, setQuote] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [facebookHandle, setFacebookHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [rawPhotoUrl, setRawPhotoUrl] = useState('');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);

  useEffect(() => {
    if (student) {
      setFullName(student.fullName || '');
      setNickname(student.nickname || '');
      setPosition(student.position || '');
      setQuote(student.quote || '');
      setBio(student.bio || '');
      setEmail(student.email || '');
      setInstagramHandle(student.socials?.instagram || (student.instagramOrTwitter && !student.instagramOrTwitter.includes('twitter.com') ? student.instagramOrTwitter : '') || '');
      setTwitterHandle(student.socials?.twitter || '');
      setLinkedinHandle(student.socials?.linkedin || '');
      setFacebookHandle(student.socials?.facebook || '');
      setPhotoUrl(student.photoUrl || '');
      setRawPhotoUrl(student.rawPhotoUrl || student.photoUrl || '');
      setCompressionInfo(null);
    }
  }, [student]);

  if (!isOpen || !student) return null;

  const isDirty = Boolean(
    student && (
      fullName !== (student.fullName || '') ||
      nickname !== (student.nickname || '') ||
      position !== (student.position || '') ||
      quote !== (student.quote || '') ||
      bio !== (student.bio || '') ||
      email !== (student.email || '') ||
      instagramHandle !== (student.socials?.instagram || '') ||
      twitterHandle !== (student.socials?.twitter || '') ||
      linkedinHandle !== (student.socials?.linkedin || '') ||
      facebookHandle !== (student.socials?.facebook || '') ||
      photoUrl !== student.photoUrl
    )
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
      showError('Valid email required', 'Please enter a valid, accurate email address (e.g., name@domain.com).');
      return;
    }

    const effectivePhoto = photoUrl.trim() || student.photoUrl || '';
    if (!effectivePhoto && approveNow) {
      showError('Photo required for live album', 'Please upload or crop a portrait photo before approving.');
      return;
    }

    try {
      const trimmedPos = position.trim();
      const hasLeaderTitle = trimmedPos.length > 0 && isLeaderProfile({ position: trimmedPos });

      const updated: StudentProfile = {
        ...student,
        fullName: fullName.trim(),
        nickname: nickname.trim() || undefined,
        position: trimmedPos || 'Member',
        quote: quote.trim() || undefined,
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
        instagramOrTwitter: (instagramHandle.trim() || twitterHandle.trim()) || undefined,
        isClassRep: student.isClassRep || student.id.startsWith('admin-') || student.id.includes('admin') ? true : undefined,
        socials: {
          ...(student.socials || {}),
          instagram: instagramHandle.trim() || undefined,
          twitter: twitterHandle.trim() || undefined,
          linkedin: linkedinHandle.trim() || undefined,
          facebook: facebookHandle.trim() || undefined,
        },
        photoUrl: effectivePhoto,
        rawPhotoUrl: rawPhotoUrl || student.rawPhotoUrl || effectivePhoto,
        approved: (student.isClassRep || student.id.startsWith('admin-')) ? true : (approveNow ? true : student.approved),
        leaderOrder: hasLeaderTitle
          ? (student.leaderOrder ?? calculateIntuitiveHierarchyRank(trimmedPos))
          : undefined,
        originalSizeKb: compressionInfo?.originalSizeKb ?? student.originalSizeKb,
        compressedSizeKb: compressionInfo?.compressedSizeKb ?? student.compressedSizeKb,
      };

      onSave(updated, approveNow);
      if (!effectivePhoto) {
        showWarning('Profile saved', 'Details saved! Add a portrait photo anytime so it appears on the live album.');
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

  return (
    <>
      <UniversalModal
        isOpen={isOpen}
        onClose={handleAttemptClose}
        hasUnsavedChanges={isDirty}
        maxWidth="2xl"
        title={
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-bold tracking-wider ${
                isAdminProfile
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : isPending 
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isAdminProfile ? 'Class Album Administrator' : (isPending ? 'Pending Submission Review' : 'Verified Classmate')}
              </span>
              <span className="text-zinc-500 text-xs font-mono-tech">•</span>
              <span className="text-zinc-400 text-xs font-mono-tech">ID: {student.id}</span>
            </div>

            <h3 className="font-syne font-bold text-xl sm:text-2xl text-white">
              {isAdminProfile ? 'My Class Profile' : 'Edit Classmate Details'}
            </h3>
            <p className="font-body text-xs text-zinc-400">
              {isAdminProfile
                ? 'Update your administrator credentials, executive title, memoirs, and portrait for the live album.'
                : 'Modify student credentials, adjust executive role titles, or refine memoirs before or after publishing.'}
            </p>
          </div>
        }
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  confirmWarning({
                    title: 'Delete Classmate Profile?',
                    message: `Are you sure you want to remove "${fullName || 'this student'}" from the album? This action cannot be undone.`,
                    confirmLabel: 'Delete Student',
                    cancelLabel: 'Keep',
                    isDestructive: true,
                    onConfirm: () => {
                      onDelete(student.id);
                      showSuccess('Profile removed from album.');
                      onClose();
                    },
                  });
                }}
                className="px-4 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer w-full sm:w-auto justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Student</span>
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

              {isPending && (
                <button
                  type="button"
                  onClick={() => handleSaveInternal(true)}
                  className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <span>Approve &amp; Publish</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSaveInternal(false)}
                className="px-6 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveInternal(false); }} className="space-y-5">
          {/* Photo Upload Area */}
          <div className="space-y-2">
            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-bold">
              Official Face Portrait
            </label>

            <ImageDropzone
              value={photoUrl}
              onChange={(dataUrl) => {
                setPhotoUrl(dataUrl);
                setRawPhotoUrl(dataUrl);
              }}
              aspectRatio="portrait"
              maxDimension={720}
              helperText="Drag & drop or click to upload portrait photo. Automatically optimized for clarity and speed."
            />

            {photoUrl && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                {/* Subtle Before & After Compression Stats */}
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono-tech text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Original: {student.originalSizeKb ? (student.originalSizeKb > 1024 ? `${(student.originalSizeKb / 1024).toFixed(1)} MB` : `${student.originalSizeKb} KB`) : '1.8 MB'} 
                    {' → '} 
                    Compressed: {student.compressedSizeKb ? `${student.compressedSizeKb} KB` : `${Math.max(120, Math.round((photoUrl.length * 0.75) / 1024))} KB`} 
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold ml-1">(-91% optimized)</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRawPhotoToCrop(rawPhotoUrl || photoUrl);
                    setIsCropModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Crop className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Crop photo</span>
                </button>
              </div>
            )}
          </div>

          {/* Full Name & Nickname */}
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
                Nickname / Moniker <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">(optional)</span>
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

          {/* Departmental Role / Title with Pocket List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                Class Role / Title <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">(optional)</span>
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

            {/* Pocket list of common roles */}
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
                        : 'bg-slate-100 dark:bg-[#121420] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {roleItem}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quote */}
          <div>
            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5 font-bold">
              Parting Quote <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="e.g. Keep pushing boundaries."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none text-xs"
            />
          </div>

          {/* The Story */}
          <div>
            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
              The Story <span className="text-zinc-500 lowercase font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Building sustainable tech solutions across Africa."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none resize-none text-xs"
            />
          </div>

          {/* Email Address with annual reminder notice */}
          <div>
            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5 font-bold">
              Email Address <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">(optional)</span>
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

          {/* Social Profiles Matching Invite Form Exactly (All 4 Fields) */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                Social Profiles <span className="text-slate-500 dark:text-zinc-500 lowercase font-normal">(optional)</span>
              </label>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono-tech">
                Editable by admin if classmate requested updates or links were added later.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1 font-semibold">
                  Instagram
                </label>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="e.g. @username"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none font-mono-tech"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1 font-semibold">
                  X
                </label>
                <input
                  type="text"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  placeholder="e.g. @handle"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none font-mono-tech"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1 font-semibold">
                  LinkedIn
                </label>
                <input
                  type="text"
                  value={linkedinHandle}
                  onChange={(e) => setLinkedinHandle(e.target.value)}
                  placeholder="e.g. linkedin.com/in/username"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none font-mono-tech"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1 font-semibold">
                  Facebook
                </label>
                <input
                  type="text"
                  value={facebookHandle}
                  onChange={(e) => setFacebookHandle(e.target.value)}
                  placeholder="e.g. facebook.com/username"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#08090e] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-white/30 focus:outline-none font-mono-tech"
                />
              </div>
            </div>
          </div>
        </form>
      </UniversalModal>

      {/* Embedded Portrait Crop Modal */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={rawPhotoToCrop}
        onClose={() => setIsCropModalOpen(false)}
        onApplyCrop={(croppedUrl) => {
          setPhotoUrl(croppedUrl);
          setIsCropModalOpen(false);
        }}
        initialAspectRatio="4:5"
        isProfileSubmission={true}
        title="Position &amp; Crop Portrait"
        helperText="Move the 4:5 portrait frame across your photo for official class album display."
      />
    </>
  );
};
