import React, { useState, useRef } from 'react';
import { ClassSet, StudentProfile } from '../../types';
import { compressImageToWebP, CompressionResult, fileToUniversalDataUrl } from '../../utils/imageCompressor';
import { X, Upload, CheckCircle2, Sparkles, Image as ImageIcon, ArrowRight, Crown, Sliders } from 'lucide-react';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from '../../utils/leadershipHierarchy';
import { ImageCropModal } from '../common/ImageCropModal';
import { UniversalModal } from '../common/UniversalModal';

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
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      originalSizeKb: compressionInfo?.originalSizeKb,
      compressedSizeKb: compressionInfo?.compressedSizeKb,
      quote: quote.trim() || undefined,
      bio: bio.trim() || undefined,
      email: email.trim() || undefined,
      instagramOrTwitter: socialHandle.trim() || undefined,
      socials: {
        instagram: socialHandle.trim() || undefined,
        linkedin: linkedinHandle.trim() || undefined,
        twitter: socialHandle.trim() || undefined,
      },
      approved: true, // Appears immediately live on the album
      approvedAt: Date.now(),
      submittedAt: new Date().toISOString().split('T')[0],
      leaderOrder: hasLeaderTitle ? calculateIntuitiveHierarchyRank(trimmedPos) : undefined,
    };

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
            <button
              id="finish-submit-btn"
              onClick={() => {
                setIsSuccess(false);
                onClose();
              }}
              className="bg-slate-900 text-white font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-8 rounded-full hover:bg-black transition-colors cursor-pointer shadow-md"
            >
              View on Album
            </button>
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

              {/* Role / Position */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                  Department Role / Office <span className="text-slate-500 dark:text-zinc-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  id="submit-position-input"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Class Album Admin, President, Social Sec, Tech Lead"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                />
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono-tech mt-1">
                  Official titles intuitively position you in the Leaders album hierarchy.
                </p>
              </div>

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

              {/* Social Handles (Instagram & LinkedIn) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                    Instagram or X Handle
                  </label>
                  <input
                    id="submit-social-input"
                    type="text"
                    value={socialHandle}
                    onChange={(e) => setSocialHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech shadow-xs"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                    LinkedIn Handle or URL
                  </label>
                  <input
                    id="submit-linkedin-input"
                    type="text"
                    value={linkedinHandle}
                    onChange={(e) => setLinkedinHandle(e.target.value)}
                    placeholder="e.g. linkedin.com/in/username"
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono-tech shadow-xs"
                  />
                </div>
              </div>

              {/* Parting Quote */}
              <div>
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold mb-1">
                  Parting Quote (Max 140 chars)
                </label>
                <input
                  id="submit-quote-input"
                  type="text"
                  maxLength={140}
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="e.g. The late-night labs were tough, but our code will shape the nation."
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 focus:outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body shadow-xs"
                />
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
        initialAspectRatio="4:5"
        title="Frame Your Graduate Portrait"
        helperText="Center your face, adjust zoom and crop for a crisp class album portrait."
      />
    </>
  );
};
