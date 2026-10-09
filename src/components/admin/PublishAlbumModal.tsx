import { useStaticBackdropScrollLock } from "../../utils/useStaticBackdropScrollLock";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  MessageSquare, 
  Users, 
  Phone, 
  Mail, 
  User, 
  Lock, 
  Globe, 
  HelpCircle, 
  ArrowRight, 
  Share2, 
  ExternalLink, 
  AlertCircle, 
  Check,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import { 
  ClassSet, 
  UserAccount, 
  TestimonialRecord, 
  NextClassRepresentativeRecord, 
  PublishAlbumDraft 
} from '../../types';
import { 
  getStoredTestimonials, 
  saveStoredTestimonials,
  getStoredSets,
  saveStoredSets 
} from '../../data/initialData';
import { triggerClassAlbumIsLiveCommunication } from '../../utils/kohotCommunications';
import { useFeedback } from '../common/FeedbackSystem';

interface PublishAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
  currentUser: UserAccount;
  onPublishSuccess: (updatedSet: ClassSet) => void;
  onOpenInviteNextClass?: () => void;
}

export const PublishAlbumModal: React.FC<PublishAlbumModalProps> = ({
  isOpen,
  onClose,
  currentSet,
  currentUser,
  onPublishSuccess,
  onOpenInviteNextClass,
}) => {
  const { showSuccess } = useFeedback();
  // Step navigation: tab / section state
  const [activeStepTab, setActiveStepTab] = useState<1 | 2 | 3>(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedSuccessSet, setPublishedSuccessSet] = useState<ClassSet | null>(null);
  const [showLearnMoreModal, setShowLearnMoreModal] = useState(false);

  // Automatically determine next graduation year
  const nextGraduationYear = (currentSet.graduationYear || 2026) + 1;

  // STEP 1 STATE: Convocation Date
  const [convocationDate, setConvocationDate] = useState<string>(() => {
    return currentSet.convocationDate || '';
  });

  // STEP 2 STATE: Experience Testimonial & Permission
  const [experienceText, setExperienceText] = useState<string>('');
  const [permissionChoice, setPermissionChoice] = useState<'public' | 'private' | null>(null);

  // STEP 3 STATE: Pass the Legacy Forward (Next Class Rep Contact)
  const [nextRepName, setNextRepName] = useState<string>('');
  const [nextRepPhone, setNextRepPhone] = useState<string>('');
  const [nextRepEmail, setNextRepEmail] = useState<string>('');
  const [contactPickerSupported, setContactPickerSupported] = useState(false);

  // Storage key for persisting draft if admin exits
  const draftStorageKey = `kohot_publish_album_draft_${currentSet.id}`;

  // Check contact picker support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setContactPickerSupported(true);
    }
  }, []);

  // Load draft on mount / open
  useEffect(() => {
    if (!isOpen) return;

    try {
      const rawDraft = localStorage.getItem(draftStorageKey);
      if (rawDraft) {
        const draft: PublishAlbumDraft = JSON.parse(rawDraft);
        if (draft.convocationDate) setConvocationDate(draft.convocationDate);
        if (draft.testimonialText) setExperienceText(draft.testimonialText);
        if (draft.testimonialPermission) setPermissionChoice(draft.testimonialPermission);
        if (draft.nextClassContact) {
          setNextRepName(draft.nextClassContact.name || '');
          setNextRepPhone(draft.nextClassContact.phoneOrWhatsapp || '');
          setNextRepEmail(draft.nextClassContact.email || '');
        }
      } else {
        // Fallback to existing set records if draft absent
        if (currentSet.convocationDate) setConvocationDate(currentSet.convocationDate);
        if (currentSet.nextClassContact) {
          setNextRepName(currentSet.nextClassContact.name || '');
          setNextRepPhone(currentSet.nextClassContact.phoneOrWhatsapp || '');
          setNextRepEmail(currentSet.nextClassContact.email || '');
        }
      }
    } catch (err) {
      console.error('Failed restoring publish draft:', err);
    }
  }, [isOpen, currentSet.id, draftStorageKey]);

  // Persist draft on changes
  useEffect(() => {
    if (!isOpen || publishedSuccessSet) return;

    const draft: PublishAlbumDraft = {
      setId: currentSet.id,
      convocationDate,
      testimonialText: experienceText,
      testimonialPermission: permissionChoice,
      nextClassContact: nextRepName.trim()
        ? {
            name: nextRepName.trim(),
            phoneOrWhatsapp: nextRepPhone.trim(),
            graduatingYear: nextGraduationYear,
            email: nextRepEmail.trim() || undefined,
            source: 'publish_step3',
            addedAt: new Date().toISOString(),
          }
        : null,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch (e) {
      // ignore storage quota errors
    }
  }, [
    isOpen,
    publishedSuccessSet,
    convocationDate,
    experienceText,
    permissionChoice,
    nextRepName,
    nextRepPhone,
    nextRepEmail,
    currentSet.id,
    nextGraduationYear,
    draftStorageKey,
  ]);

  // Step completion validation
  const isStep1Complete = Boolean(convocationDate && convocationDate.trim().length >= 4);
  const isStep2Complete = Boolean(
    experienceText.trim().length >= 10 && permissionChoice !== null
  );
  const isStep3Complete = Boolean(
    nextRepName.trim().length >= 2 && nextRepPhone.trim().length >= 6
  );

  const canPublish = isStep1Complete && isStep2Complete && isStep3Complete;

  // Native Mobile Contact Picker integration
  const handlePickNativeContact = async () => {
    try {
      if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
        const props = ['name', 'tel', 'email'];
        const contacts = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts && contacts.length > 0) {
          const picked = contacts[0];
          if (picked.name && picked.name[0]) {
            setNextRepName(picked.name[0]);
          }
          if (picked.tel && picked.tel[0]) {
            setNextRepPhone(picked.tel[0]);
          }
          if (picked.email && picked.email[0]) {
            setNextRepEmail(picked.email[0]);
          }
        }
      }
    } catch (err) {
      console.log('Contact picker dismissed or not accessible:', err);
    }
  };

  // Execution of Publication
  const handleFinalPublish = () => {
    if (!canPublish) return;

    setIsPublishing(true);

    setTimeout(() => {
      const nowIso = new Date().toISOString();

      // 1. Next Class Representative contact record
      const nextContactRecord: NextClassRepresentativeRecord = {
        name: nextRepName.trim(),
        phoneOrWhatsapp: nextRepPhone.trim(),
        graduatingYear: nextGraduationYear,
        email: nextRepEmail.trim() || undefined,
        addedAt: nowIso,
        source: 'publish_step3',
      };

      // 2. Updated Set Object
      const updatedSet: ClassSet = {
        ...currentSet,
        activationStatus: 'active',
        publishedAt: nowIso,
        convocationDate: convocationDate.trim(),
        nextClassContact: nextContactRecord,
      };

      // 3. Save Testimonial Record if provided
      if (experienceText.trim()) {
        const authorName = currentSet.classRepName || currentUser.fullName || 'Class Administrator';
        const newTestimonial: TestimonialRecord = {
          id: `testim-${Date.now()}`,
          authorName,
          name: authorName,
          authorRole: 'Class Album Admin',
          role: 'Class Album Admin',
          universityName: currentSet.institutionName || currentSet.universityName || 'University',
          departmentName: currentSet.departmentName,
          graduationYear: currentSet.graduationYear,
          quote: experienceText.trim(),
          testimonialText: experienceText.trim(),
          avatarUrl: currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          status: 'Approved',
          isFeatured: permissionChoice === 'public',
          publicationPermission: permissionChoice || 'private',
          createdAt: nowIso.split('T')[0],
        };

        const existingTestimonials = getStoredTestimonials();
        saveStoredTestimonials([newTestimonial, ...existingTestimonials]);
      }

      // 4. Save updated Class Set to storage
      const allSets = getStoredSets();
      const updatedAll = allSets.map((s) => (s.id === updatedSet.id ? updatedSet : s));
      saveStoredSets(updatedAll);

      // 5. Trigger "Class Album Is Live" automated product email to verified class members
      triggerClassAlbumIsLiveCommunication(updatedSet);

      // 6. Clear draft from localStorage
      try {
        localStorage.removeItem(draftStorageKey);
      } catch (e) {}

      // 7. Notify Parent Component
      onPublishSuccess(updatedSet);
      setPublishedSuccessSet(updatedSet);
      setIsPublishing(false);
      showSuccess('Your Class Album is now live.', 'Your classmates can return to it whenever they want.');
    }, 700);
  };

  useStaticBackdropScrollLock(isOpen);

  // Escape key listener
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

  if (!isOpen) return null;

  const modalElement = (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-hidden animate-fadeIn" onClick={onClose}>
      <div className="relative w-full max-w-3xl bg-[#0c0d14] border border-white/20 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]" onClick={(e) => e.stopPropagation()}>
        
        {/* =========================================================================
            HEADER BAR
            ========================================================================= */}
        <div className="p-5 sm:p-7 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40 z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-syne font-bold text-xl sm:text-2xl text-white">
                  Publish Class Album
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-mono-tech text-[10px] uppercase font-bold">
                  3 Required Steps
                </span>
              </div>
              <p className="font-mono-tech text-xs text-zinc-400 mt-0.5">
                {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close publish modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            SUCCESS SCREEN ONCE PUBLISHED
            ========================================================================= */}
        {publishedSuccessSet ? (
          <div className="p-8 sm:p-10 space-y-7 overflow-y-auto text-center animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
              <Check className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h4 className="font-syne font-bold text-2xl sm:text-3xl text-white">
                Your Class Album is now live.
              </h4>
              <p className="font-body text-sm text-zinc-300 leading-relaxed">
                Your classmates can return to it whenever they want. The Class of {currentSet.graduationYear} ({currentSet.departmentName}) is permanently preserved.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 max-w-md mx-auto text-left space-y-3 font-mono-tech text-xs">
              <div className="flex justify-between items-center text-zinc-400 pb-2 border-b border-white/10">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live &amp; Preserved
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400 pb-2 border-b border-white/10">
                <span>Convocation Date:</span>
                <span className="text-white">{publishedSuccessSet.convocationDate}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Next Class Handover:</span>
                <span className="text-amber-400 font-semibold">
                  Class of {nextGraduationYear} ({nextRepName})
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <a
                href={`/#album-${publishedSuccessSet.id}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <span>View Live Album</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {onOpenInviteNextClass && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInviteNextClass();
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-400/20"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Invite Next Class ({nextGraduationYear})</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-syne text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* =====================================================================
                STEP INDICATOR STRIP
                ===================================================================== */}
            <div className="grid grid-cols-3 border-b border-white/10 bg-black/30 shrink-0">
              {/* Step 1 Tab */}
              <button
                type="button"
                onClick={() => setActiveStepTab(1)}
                className={`p-4 flex items-center justify-center gap-2.5 text-xs font-mono-tech transition-all border-b-2 cursor-pointer ${
                  activeStepTab === 1
                    ? 'border-amber-400 text-amber-300 bg-white/[0.04]'
                    : isStep1Complete
                    ? 'border-emerald-500/50 text-emerald-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isStep1Complete 
                    ? 'bg-emerald-500 text-black' 
                    : activeStepTab === 1 
                    ? 'bg-amber-400 text-black' 
                    : 'bg-white/10 text-zinc-400'
                }`}>
                  {isStep1Complete ? <Check className="w-3 h-3" /> : '1'}
                </div>
                <span className="font-semibold hidden sm:inline">1. Convocation</span>
                <span className="font-semibold sm:hidden">Convocation</span>
              </button>

              {/* Step 2 Tab */}
              <button
                type="button"
                onClick={() => setActiveStepTab(2)}
                className={`p-4 flex items-center justify-center gap-2.5 text-xs font-mono-tech transition-all border-b-2 cursor-pointer ${
                  activeStepTab === 2
                    ? 'border-amber-400 text-amber-300 bg-white/[0.04]'
                    : isStep2Complete
                    ? 'border-emerald-500/50 text-emerald-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isStep2Complete 
                    ? 'bg-emerald-500 text-black' 
                    : activeStepTab === 2 
                    ? 'bg-amber-400 text-black' 
                    : 'bg-white/10 text-zinc-400'
                }`}>
                  {isStep2Complete ? <Check className="w-3 h-3" /> : '2'}
                </div>
                <span className="font-semibold hidden sm:inline">2. Experience</span>
                <span className="font-semibold sm:hidden">Experience</span>
              </button>

              {/* Step 3 Tab */}
              <button
                type="button"
                onClick={() => setActiveStepTab(3)}
                className={`p-4 flex items-center justify-center gap-2.5 text-xs font-mono-tech transition-all border-b-2 cursor-pointer ${
                  activeStepTab === 3
                    ? 'border-amber-400 text-amber-300 bg-white/[0.04]'
                    : isStep3Complete
                    ? 'border-emerald-500/50 text-emerald-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isStep3Complete 
                    ? 'bg-emerald-500 text-black' 
                    : activeStepTab === 3 
                    ? 'bg-amber-400 text-black' 
                    : 'bg-white/10 text-zinc-400'
                }`}>
                  {isStep3Complete ? <Check className="w-3 h-3" /> : '3'}
                </div>
                <span className="font-semibold hidden sm:inline">3. Pass Legacy</span>
                <span className="font-semibold sm:hidden">Pass Legacy</span>
              </button>
            </div>

            {/* =====================================================================
                SCROLLABLE BODY CONTENT FOR EACH STEP
                ===================================================================== */}
            <div className="p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-6">

              {/* -----------------------------------------------------------------
                  STEP 1: CONVOCATION DATE (REQUIRED)
                  ----------------------------------------------------------------- */}
              {activeStepTab === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-mono-tech text-xs uppercase font-semibold">
                      <Calendar className="w-4 h-4" />
                      <span>Step 1: Required Convocation Milestone</span>
                    </div>
                    <h4 className="font-syne font-bold text-xl sm:text-2xl text-white">
                      When is your Department's Convocation?
                    </h4>
                    <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      The Convocation Date permanently anchors your class milestone in the University Legacy Wall and sets your annual cohort reconnection anniversary.
                    </p>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                    <label className="block text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
                      Convocation Date <span className="text-red-400">*</span>
                    </label>

                    <div className="relative max-w-md">
                      <input
                        type="date"
                        value={convocationDate}
                        onChange={(e) => setConvocationDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/20 text-white font-mono-tech text-sm focus:outline-none focus:border-amber-400 transition-colors"
                        required
                      />
                    </div>

                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-400/5 border border-amber-400/20 text-xs font-body text-amber-200/90 leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Convocation date is required before publishing. If the exact day has not yet been announced by senate, select the estimated or ceremonial month for Class of {currentSet.graduationYear}.
                      </span>
                    </div>

                    {isStep1Complete ? (
                      <div className="flex items-center gap-2 text-emerald-400 font-mono-tech text-xs pt-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Convocation Date recorded: {convocationDate}</span>
                      </div>
                    ) : (
                      <div className="text-zinc-500 font-mono-tech text-xs pt-1">
                        Please provide your convocation date to complete Step 1.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStepTab(2)}
                      disabled={!isStep1Complete}
                      className={`px-6 py-2.5 rounded-full font-syne text-xs uppercase tracking-wider font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        isStep1Complete
                          ? 'bg-white hover:bg-zinc-200 text-black shadow'
                          : 'bg-white/10 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <span>Continue to Step 2</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* -----------------------------------------------------------------
                  STEP 2: SHARE YOUR EXPERIENCE (REQUIRED)
                  ----------------------------------------------------------------- */}
              {activeStepTab === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-mono-tech text-xs uppercase font-semibold">
                      <MessageSquare className="w-4 h-4" />
                      <span>Step 2: Share Your Experience</span>
                    </div>
                    <h4 className="font-syne font-bold text-xl sm:text-2xl text-white">
                      What was your experience creating your Class Album with KoHot?
                    </h4>
                    <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Tell us in your own words what organizing and preserving your classmates’ memories felt like.
                    </p>
                  </div>

                  {/* Textarea */}
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={experienceText}
                      onChange={(e) => setExperienceText(e.target.value)}
                      placeholder="Share your honest reflections on the journey, collecting classmate portraits, organizing leadership memories, and establishing your permanent department record..."
                      className="w-full p-4 rounded-2xl bg-black/60 border border-white/20 text-white font-body text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 transition-colors leading-relaxed"
                      required
                    />
                    <div className="flex justify-between items-center text-[11px] font-mono-tech text-zinc-500 px-1">
                      <span>{experienceText.trim().length} characters</span>
                      <span>{experienceText.trim().length < 10 ? 'Minimum 10 characters required' : '✓ Reflection recorded'}</span>
                    </div>
                  </div>

                  {/* Explicit Choice: Public vs Private */}
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono-tech uppercase tracking-wider text-white font-semibold">
                        Feature Permission Choice <span className="text-red-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowLearnMoreModal(true)}
                        className="text-[11px] font-mono-tech text-amber-400 hover:text-amber-300 underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3" />
                        <span>About Public Testimonials</span>
                      </button>
                    </div>

                    <div className="space-y-3 pt-1">
                      {/* Option 1: Public */}
                      <label
                        className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer ${
                          permissionChoice === 'public'
                            ? 'bg-amber-400/10 border-amber-400/50 text-white'
                            : 'bg-black/40 border-white/10 text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="testimonial_permission"
                          checked={permissionChoice === 'public'}
                          onChange={() => setPermissionChoice('public')}
                          className="mt-1 accent-amber-400 cursor-pointer"
                        />
                        <div className="space-y-0.5 text-xs font-body">
                          <p className="font-semibold text-white">
                            “Yes, you may feature my experience on the KoHot website.”
                          </p>
                          <p className="text-zinc-400 text-[11px] leading-relaxed">
                            KoHot may feature your quote using your name, photo, class and university.
                          </p>
                        </div>
                      </label>

                      {/* Option 2: Private */}
                      <label
                        className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer ${
                          permissionChoice === 'private'
                            ? 'bg-white/10 border-white/40 text-white'
                            : 'bg-black/40 border-white/10 text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="testimonial_permission"
                          checked={permissionChoice === 'private'}
                          onChange={() => setPermissionChoice('private')}
                          className="mt-1 accent-amber-400 cursor-pointer"
                        />
                        <div className="space-y-0.5 text-xs font-body">
                          <p className="font-semibold text-white">
                            “No, please keep my response private.”
                          </p>
                          <p className="text-zinc-400 text-[11px] leading-relaxed">
                            Your feedback is saved strictly for internal product refinement and will never be published publicly.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStepTab(1)}
                      className="px-4 py-2 rounded-full font-syne text-xs uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      ← Back to Step 1
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveStepTab(3)}
                      disabled={!isStep2Complete}
                      className={`px-6 py-2.5 rounded-full font-syne text-xs uppercase tracking-wider font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        isStep2Complete
                          ? 'bg-white hover:bg-zinc-200 text-black shadow'
                          : 'bg-white/10 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <span>Continue to Step 3</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* -----------------------------------------------------------------
                  STEP 3: PASS THE LEGACY FORWARD (REQUIRED)
                  ----------------------------------------------------------------- */}
              {activeStepTab === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-mono-tech text-xs uppercase font-semibold">
                      <Users className="w-4 h-4" />
                      <span>Step 3: Pass the Legacy Forward</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-syne font-bold text-xl sm:text-2xl text-white">
                        Next Class Representative — {nextGraduationYear}
                      </h4>

                      {/* Native Contact Picker Button if supported */}
                      {contactPickerSupported && (
                        <button
                          type="button"
                          onClick={handlePickNativeContact}
                          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                          <span>+ Add from Contacts</span>
                        </button>
                      )}
                    </div>

                    <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Capture the immediate next-class representative as a backup and handover record for {currentSet.departmentName}.
                    </p>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name (Required) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
                          Representative Full Name <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            value={nextRepName}
                            onChange={(e) => setNextRepName(e.target.value)}
                            placeholder="e.g. Chidinma Okafor"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white font-body text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                      </div>

                      {/* Phone / WhatsApp (Required) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
                          Phone / WhatsApp Number <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="tel"
                            value={nextRepPhone}
                            onChange={(e) => setNextRepPhone(e.target.value)}
                            placeholder="e.g. +234 809 333 4455"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white font-mono-tech text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {/* Automatically determined Graduating Year (Locked) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
                          Graduating Year (Next Cohort)
                        </label>
                        <div className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-amber-400 font-mono-tech text-sm flex items-center justify-between">
                          <span>Class of {nextGraduationYear}</span>
                          <span className="text-[10px] text-zinc-500 uppercase">Auto-Determined</span>
                        </div>
                      </div>

                      {/* Optional Email */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono-tech uppercase tracking-wider text-zinc-400">
                          Email Address <span className="text-zinc-500 font-normal">(Optional)</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="email"
                            value={nextRepEmail}
                            onChange={(e) => setNextRepEmail(e.target.value)}
                            placeholder="rep@university.edu (optional)"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white font-body text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Explanatory Policy Callout */}
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-xs font-body text-zinc-300 leading-relaxed">
                      <div className="flex items-center gap-2 text-zinc-200 font-semibold font-mono-tech text-[11px] uppercase">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Legacy Record &amp; Privacy Safeguard</span>
                      </div>
                      <p className="text-zinc-400 text-[11px]">
                        This contact is stored with the album so the next class can be identified as the next link in the department's legacy. This contact is <strong>not automatically granted admin rights</strong> and is <strong>not automatically emailed</strong>.
                      </p>
                    </div>

                    {isStep3Complete ? (
                      <div className="flex items-center gap-2 text-emerald-400 font-mono-tech text-xs pt-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Next class representative recorded: {nextRepName} ({nextRepPhone})</span>
                      </div>
                    ) : (
                      <div className="text-zinc-500 font-mono-tech text-xs pt-1">
                        Please provide representative name and phone number to complete Step 3.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStepTab(2)}
                      className="px-4 py-2 rounded-full font-syne text-xs uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      ← Back to Step 2
                    </button>

                    <div className="text-right">
                      <span className="font-mono-tech text-[11px] text-zinc-400">
                        {canPublish ? '✓ All 3 steps complete' : 'Complete required fields above to publish'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* =====================================================================
                STICKY FOOTER WITH CANCEL & PUBLISH ALBUM
                ===================================================================== */}
            <div className="p-5 sm:p-6 border-t border-white/10 bg-black/60 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-syne text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <span className="text-[11px] font-mono-tech text-zinc-500 hidden sm:inline">
                  Draft saved automatically
                </span>
              </div>

              {/* Progress Summary & Publish Button */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="hidden md:flex items-center gap-2 font-mono-tech text-[11px]">
                  <span className={isStep1Complete ? 'text-emerald-400' : 'text-zinc-500'}>
                    1. Convocation {isStep1Complete ? '✓' : '•'}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span className={isStep2Complete ? 'text-emerald-400' : 'text-zinc-500'}>
                    2. Experience {isStep2Complete ? '✓' : '•'}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span className={isStep3Complete ? 'text-emerald-400' : 'text-zinc-500'}>
                    3. Legacy {isStep3Complete ? '✓' : '•'}
                  </span>
                </div>

                <button
                  id="final-publish-album-btn"
                  type="button"
                  onClick={handleFinalPublish}
                  disabled={!canPublish || isPublishing}
                  className={`w-full sm:w-auto px-7 py-3 rounded-full font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                    canPublish && !isPublishing
                      ? 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-110 text-black shadow-amber-400/25 active:scale-95'
                      : 'bg-white/10 text-zinc-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isPublishing ? 'Publishing…' : 'Publish Album'}</span>
                </button>
              </div>
            </div>
          </>
        )}

      </div>

      {/* =========================================================================
          LEARN MORE MODAL: ABOUT PUBLIC TESTIMONIALS
          ========================================================================= */}
      {showLearnMoreModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-[#0c0d14] border border-white/20 p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h4 className="font-syne font-bold text-base text-white">
                  About Public Testimonials
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowLearnMoreModal(false)}
                className="text-zinc-500 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 font-body text-xs text-zinc-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-amber-400/5 border border-amber-400/20 space-y-2">
                <h5 className="font-syne font-bold text-sm text-amber-300 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  If Public Permission is Granted
                </h5>
                <p>
                  KoHot may feature your testimonial on our website and official communications using your name, profile photo, class year, and university.
                </p>
                <p className="text-zinc-400">
                  We may lightly format your text for layout and typography without altering its substantive meaning.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <h5 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  If Permission is Denied
                </h5>
                <p>
                  Your feedback is kept completely private. It will be used solely for internal product improvement and never displayed on public pages or shared externally.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 font-mono-tech text-[11px] text-zinc-400">
                Notice: KoHot does not dispatch automated testimonial follow-up emails. Your choice here is definitive and honored immediately.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLearnMoreModal(false)}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-syne text-xs uppercase tracking-wider font-bold transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }
  return modalElement;
};
