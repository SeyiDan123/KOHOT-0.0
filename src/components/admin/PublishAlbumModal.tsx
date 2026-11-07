import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  MessageCircle,
  Send,
  Globe,
  Lock,
  AlertTriangle,
  Sparkles,
  EyeOff,
  Calendar,
} from 'lucide-react';
import {
  ClassSet,
  UserAccount,
  TestimonialRecord,
  NextClassRepresentativeRecord,
} from '../../types';
import {
  getStoredTestimonials,
  saveStoredTestimonials,
  getStoredNextClassInvites,
  saveStoredNextClassInvites,
} from '../../data/initialData';
import { getAlbumShareLink, getAlbumUrl, copyUrlToClipboard } from '../../utils/urlHelper';
import { UniversalModal } from '../common/UniversalModal';

interface PublishAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
  currentUser: UserAccount | null;
  onPublishSuccess: (updatedSet: ClassSet) => void;
  onOpenInviteNextClass?: () => void;
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const PublishAlbumModal: React.FC<PublishAlbumModalProps> = ({
  isOpen,
  onClose,
  currentSet,
  currentUser,
  onPublishSuccess,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [confirmPopupMode, setConfirmPopupMode] = useState<'none' | 'publish' | 'unpublish'>('none');
  const convocationDateInputRef = useRef<HTMLInputElement>(null);

  const parseInitialConvocation = () => {
    if (currentSet.reminderSettings?.convocationMonth && currentSet.reminderSettings?.convocationYear) {
      return {
        day: Number(currentSet.reminderSettings.convocationDay || 18),
        month: Number(currentSet.reminderSettings.convocationMonth),
        year: Number(currentSet.reminderSettings.convocationYear),
      };
    }
    const rawSource = (currentSet.convocationDate || currentSet.publishDraft?.convocationDate || '').trim();
    if (rawSource) {
      const isoMatch = rawSource.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        return {
          day: parseInt(isoMatch[3], 10),
          month: parseInt(isoMatch[2], 10),
          year: parseInt(isoMatch[1], 10),
        };
      }
      const slashDmyMatch = rawSource.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (slashDmyMatch) {
        return {
          day: parseInt(slashDmyMatch[1], 10),
          month: parseInt(slashDmyMatch[2], 10),
          year: parseInt(slashDmyMatch[3], 10),
        };
      }
      const dmyMatch = rawSource.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
      if (dmyMatch) {
        const mObj = MONTHS.find((m) => m.label.toLowerCase().startsWith(dmyMatch[2].toLowerCase().slice(0, 3)));
        return {
          day: parseInt(dmyMatch[1], 10),
          month: mObj ? mObj.value : 11,
          year: parseInt(dmyMatch[3], 10),
        };
      }
      const myMatch = rawSource.match(/^([A-Za-z]+)\s+(\d{4})$/);
      if (myMatch) {
        const mObj = MONTHS.find((m) => m.label.toLowerCase().startsWith(myMatch[1].toLowerCase().slice(0, 3)));
        return {
          day: 18,
          month: mObj ? mObj.value : 11,
          year: parseInt(myMatch[2], 10),
        };
      }
    }
    return {
      day: 18,
      month: 11,
      year: currentSet.graduationYear || new Date().getFullYear(),
    };
  };

  const initialConv = parseInitialConvocation();

  // Step 1: Convocation Date
  const [convocationDay, setConvocationDay] = useState<number>(initialConv.day);
  const [convocationMonth, setConvocationMonth] = useState<number>(initialConv.month);
  const [convocationYear, setConvocationYear] = useState<number>(initialConv.year);

  // Step 2: Review & Consent (Optional)
  const [reviewMessage, setReviewMessage] = useState<string>(() => {
    const existingTest = getStoredTestimonials().find((t) => t.setId === currentSet.id);
    return (
      (currentSet as any).testimonialText ||
      currentSet.publishDraft?.testimonialText ||
      existingTest?.testimonialText ||
      ''
    );
  });
  const [visibility, setVisibility] = useState<'public' | 'private'>(() => {
    return (currentSet as any).testimonialPermission === 'private' ? 'private' : 'public';
  });

  // Step 3: Next Set Relay (Compulsory)
  const nextGraduationYear = currentSet.graduationYear + 1;
  const existingContact = currentSet.nextClassContact || currentSet.publishDraft?.nextClassContact || null;

  const [successorName, setSuccessorName] = useState(existingContact?.name || '');
  const [successorEmail, setSuccessorEmail] = useState(existingContact?.email || '');
  const [successorPhone, setSuccessorPhone] = useState(existingContact?.phoneOrWhatsapp || '');
  const [copiedRelayMessage, setCopiedRelayMessage] = useState(false);

  // Final Published Share Screen State
  const [publishedSuccess, setPublishedSuccess] = useState(false);
  const [copiedAlbumLink, setCopiedAlbumLink] = useState(false);
  const [copiedBroadcastText, setCopiedBroadcastText] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPublishedSuccess(false);
      setConfirmPopupMode('none');
      setActiveStep(1);
      const parsed = parseInitialConvocation();
      setConvocationDay(parsed.day);
      setConvocationMonth(parsed.month);
      setConvocationYear(parsed.year);

      const contact = currentSet.nextClassContact || currentSet.publishDraft?.nextClassContact || null;
      if (contact) {
        setSuccessorName(contact.name || '');
        setSuccessorEmail(contact.email || '');
        setSuccessorPhone(contact.phoneOrWhatsapp || '');
      }
      const existingTest = getStoredTestimonials().find((t) => t.setId === currentSet.id);
      const savedReview =
        (currentSet as any).testimonialText ||
        currentSet.publishDraft?.testimonialText ||
        existingTest?.testimonialText ||
        '';
      setReviewMessage(savedReview);
    }
  }, [isOpen, currentSet.id]);

  if (!isOpen) return null;

  const formatConvocationDate = (): string => {
    const monthObj = MONTHS.find((m) => m.value === Number(convocationMonth));
    const monthName = monthObj ? monthObj.label : 'November';
    return `${convocationDay} ${monthName} ${convocationYear}`;
  };

  const isoConvocationValue = `${convocationYear}-${String(convocationMonth).padStart(2, '0')}-${String(convocationDay).padStart(2, '0')}`;
  const nigerianDmyDisplay = `${String(convocationDay).padStart(2, '0')}/${String(convocationMonth).padStart(2, '0')}/${convocationYear}`;
  const formattedConvocationStr = formatConvocationDate();

  // Step 1 and Step 3 are compulsory; Step 2 (Experience) is optional
  const isStep1Complete = Boolean(convocationDay && convocationMonth && convocationYear);
  const isStep2Filled = reviewMessage.trim().length > 0;
  const isStep3Complete = Boolean(successorName.trim() && successorPhone.trim());

  const approvedStudents = (currentSet.students || []).filter(
    (s) => s.approved || s.status === 'approved' || s.submissionStatus === 'approved'
  );
  const unpaidApprovedStudents = approvedStudents.filter((s) => {
    if (s.isAdminProfile || s.isClassRep) return false;
    const isCoveredBySlot = Boolean(s.usedSlot || s.slotConsumed || s.paymentStatus === 'waived');
    const isPaidIndividually = s.paymentStatus === 'paid';
    return !isCoveredBySlot && !isPaidIndividually;
  });
  const fundedProfilesOk = unpaidApprovedStudents.length === 0;

  const canPublish = isStep1Complete && isStep3Complete && fundedProfilesOk;
  const isCurrentlyPublished = Boolean(
    (currentSet.isPublished || currentSet.published) &&
      !currentSet.isUnpublished &&
      !currentSet.unpublished &&
      isStep1Complete &&
      isStep3Complete
  );

  const getDisabledPublishReason = (): string => {
    if (!isStep1Complete) return 'Please select your convocation date in Step 1.';
    if (!isStep3Complete) return 'Please enter the next set representative details in Step 3.';
    if (!fundedProfilesOk) {
      return `${unpaidApprovedStudents.length} approved profile(s) still require a funded slot.`;
    }
    return '';
  };

  const albumShareLink = getAlbumShareLink(currentSet);
  const officialAlbumUrl = getAlbumUrl(currentSet);

  const generateRelayInviteUrl = () => {
    const base = officialAlbumUrl.split('?')[0].replace(/\/+$/, '');
    const params = new URLSearchParams();
    params.set('relay', '1');
    params.set('uni', currentSet.institutionId);
    if (currentSet.departmentId) params.set('deptId', currentSet.departmentId);
    params.set('dept', currentSet.departmentName);
    params.set('year', String(nextGraduationYear));
    if (successorName.trim()) params.set('repName', successorName.trim());
    if (successorEmail.trim()) params.set('repEmail', successorEmail.trim());
    if (successorPhone.trim()) params.set('repPhone', successorPhone.trim());
    return `${base}/?${params.toString()}`;
  };

  const relayInviteUrl = generateRelayInviteUrl();

  const relayShareText = `Congratulations on leading the ${currentSet.departmentName} Class of ${nextGraduationYear}! 🎉\n\nAs the graduating Class of ${currentSet.graduationYear}, we have archived our official Class Album on KoHot and are passing the departmental legacy baton to you.\n\nUse your pre-configured link below to initialize the Class of ${nextGraduationYear} Digital Class Album:\n${relayInviteUrl}`;

  const cleanPhoneForWhatsApp = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.startsWith('0') && digits.length === 11) {
      return `234${digits.slice(1)}`;
    }
    return digits;
  };

  const whatsappDirectRelayUrl = successorPhone.trim()
    ? `https://api.whatsapp.com/send?phone=${cleanPhoneForWhatsApp(successorPhone)}&text=${encodeURIComponent(relayShareText)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(relayShareText)}`;

  const handleCopyRelayText = async () => {
    await copyUrlToClipboard(relayShareText);
    setCopiedRelayMessage(true);
    setTimeout(() => setCopiedRelayMessage(false), 3000);
  };

  const buildUpdatedSetWithCurrentFields = (publishNow: boolean): ClassSet => {
    if (reviewMessage.trim().length > 0) {
      const existingTestimonials = getStoredTestimonials();
      const newTestimonial: TestimonialRecord = {
        id: `test-${Date.now()}`,
        name: currentUser?.fullName || currentSet.classRepName || 'Class Representative',
        authorName: currentUser?.fullName || currentSet.classRepName || 'Class Representative',
        email: currentUser?.email || currentSet.classRepEmail,
        phone: currentUser?.phone || currentSet.classRepPhone,
        role: 'Class Album Admin',
        authorRole: `Class Admin • ${currentSet.classSetName}`,
        university: currentSet.institutionName || 'University',
        universityName: currentSet.institutionName || 'University',
        universityId: currentSet.institutionId,
        faculty: currentSet.faculty,
        department: currentSet.departmentName,
        departmentName: currentSet.departmentName,
        departmentId: currentSet.departmentId,
        classYear: currentSet.graduationYear,
        graduationYear: currentSet.graduationYear,
        classSetName: currentSet.classSetName,
        setId: currentSet.id,
        testimonialText: reviewMessage.trim(),
        quote: reviewMessage.trim(),
        submissionDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString().split('T')[0],
        publicationPermission: visibility,
        reviewStatus: visibility === 'public' ? 'approved' : 'pending',
        isFeatured: visibility === 'public',
        requestStatus: visibility === 'public' ? 'approved' : 'private',
        avatarUrl: currentSet.students.find((s) => s.isClassRep)?.photoUrl,
      };
      saveStoredTestimonials([newTestimonial, ...existingTestimonials.filter((t) => t.setId !== currentSet.id)]);
    }

    const studentEmails = Array.from(
      new Set(
        currentSet.students
          .map((s) => s.email?.trim())
          .filter((email): email is string => Boolean(email && email.includes('@')))
      )
    );

    const nextReminderYear = Math.max(new Date().getFullYear() + 1, Number(convocationYear) + 1);
    const monthObj = MONTHS.find((m) => m.value === Number(convocationMonth));
    const nextReminderDate = `${convocationDay} ${monthObj?.label || 'November'} ${nextReminderYear}`;

    const nextClassContact: NextClassRepresentativeRecord = {
      name: successorName.trim(),
      phoneOrWhatsapp: successorPhone.trim(),
      graduatingYear: nextGraduationYear,
      email: successorEmail.trim() || undefined,
      addedAt: existingContact?.addedAt || new Date().toISOString(),
      source: 'publish_step3',
    };

    let handoffInvite = currentSet.handoffInvite;
    if (successorName.trim() && successorPhone.trim()) {
      handoffInvite = {
        id: currentSet.handoffInvite?.id || `handoff-${currentSet.id}-${nextGraduationYear}`,
        fromSetId: currentSet.id,
        fromAdminName: currentUser?.fullName || currentSet.classRepName,
        fromAdminEmail: currentUser?.email || currentSet.classRepEmail,
        fromClassYear: currentSet.graduationYear,
        targetUniversityId: currentSet.institutionId,
        targetUniversityName: currentSet.institutionName,
        targetDepartmentId: currentSet.departmentId,
        targetDepartmentName: currentSet.departmentName,
        targetClassYear: nextGraduationYear,
        targetContactName: successorName.trim(),
        targetContactPhone: successorPhone.trim(),
        targetContactEmail: successorEmail.trim() || undefined,
        inviteCode:
          currentSet.handoffInvite?.inviteCode ||
          `RELAY-${nextGraduationYear}-${Date.now().toString(36).toUpperCase()}`,
        status: 'invited',
        createdAt: currentSet.handoffInvite?.createdAt || new Date().toISOString(),
      };

      const storedInvites = getStoredNextClassInvites();
      saveStoredNextClassInvites([
        handoffInvite,
        ...storedInvites.filter((inv) => inv.fromSetId !== currentSet.id),
      ]);
    }

    const updatedSet: ClassSet = {
      ...currentSet,
      convocationDate: formattedConvocationStr,
      isPublished: publishNow,
      published: publishNow,
      isUnpublished: !publishNow,
      unpublished: !publishNow,
      lifecycleStatus: publishNow ? 'published' : 'draft',
      publishedAt: publishNow
        ? currentSet.publishedAt || new Date().toISOString().split('T')[0]
        : currentSet.publishedAt,
      nextClassContact,
      handoffInvite,
      publishDraft: {
        setId: currentSet.id,
        convocationDate: formattedConvocationStr,
        testimonialText: reviewMessage.trim(),
        testimonialPermission: visibility,
        nextClassContact,
        savedAt: new Date().toISOString(),
      },
      reminderSettings: {
        automaticRemindersEnabled: true,
        convocationDate: formattedConvocationStr,
        convocationDay: Number(convocationDay),
        convocationMonth: Number(convocationMonth),
        convocationYear: Number(convocationYear),
        isConvocationDayUnknown: false,
        notificationEmails: studentEmails,
        approvedAt: new Date().toISOString().split('T')[0],
        nextReminderDate,
      },
    };
    (updatedSet as any).testimonialText = reviewMessage.trim();
    (updatedSet as any).testimonialPermission = visibility;
    return updatedSet;
  };

  const handleExecutePublishConfirmed = () => {
    if (!canPublish) return;
    const updatedSet = buildUpdatedSetWithCurrentFields(true);
    onPublishSuccess(updatedSet);
    setConfirmPopupMode('none');
    setPublishedSuccess(true);
  };

  const handleExecuteUnpublishConfirmed = () => {
    const updatedSet = buildUpdatedSetWithCurrentFields(false);
    onPublishSuccess(updatedSet);
    setConfirmPopupMode('none');
    onClose();
  };

  const publishedShareBroadcast = `🎓 Our Official ${currentSet.departmentName} (Class of ${currentSet.graduationYear}) Digital Class Album is now LIVE on KoHot!\n\nExplore our portraits, memories, and awards here:\n${albumShareLink}`;

  const handleCopyAlbumLink = async () => {
    await copyUrlToClipboard(albumShareLink);
    setCopiedAlbumLink(true);
    setTimeout(() => setCopiedAlbumLink(false), 3000);
  };

  const handleCopyBroadcast = async () => {
    await copyUrlToClipboard(publishedShareBroadcast);
    setCopiedBroadcastText(true);
    setTimeout(() => setCopiedBroadcastText(false), 3000);
  };

  const stepSegments: Array<{ step: 1 | 2 | 3; label: string; done: boolean }> = [
    { step: 1, label: '1. Convocation', done: isStep1Complete },
    { step: 2, label: '2. Experience', done: isStep2Filled },
    { step: 3, label: '3. Next set', done: isStep3Complete },
  ];

  if (publishedSuccess) {
    return (
      <UniversalModal
        isOpen={isOpen}
        onClose={onClose}
        title="Album published"
        subtitle={`${currentSet.departmentName} · Class of ${currentSet.graduationYear}`}
        maxWidth="lg"
        footer={
          <div className="w-full flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-mono-tech text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopyBroadcast}
              className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-mono-tech text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
            >
              {copiedBroadcastText ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied message</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy broadcast message</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Your class album is now live. Save &amp; Share buttons on your album are now active.</span>
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono-tech text-xs font-semibold text-slate-900 dark:text-white">
              Official album link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={albumShareLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyAlbumLink}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono-tech text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                {copiedAlbumLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAlbumLink ? 'Copied' : 'Copy link'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(publishedShareBroadcast)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono-tech text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              <span>WhatsApp</span>
            </a>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(albumShareLink)}&text=${encodeURIComponent(
                `🎓 Our Official ${currentSet.departmentName} (Class of ${currentSet.graduationYear}) Digital Class Album is now LIVE on KoHot!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono-tech text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4 text-[#0088cc]" />
              <span>Telegram</span>
            </a>
          </div>
        </div>
      </UniversalModal>
    );
  }

  return (
    <>
      <UniversalModal
        isOpen={isOpen}
        onClose={onClose}
        title={isCurrentlyPublished ? 'Published album' : 'Publish album'}
        subtitle={`${currentSet.departmentName} · Class of ${currentSet.graduationYear}`}
        maxWidth="lg"
        footer={
          <div className="w-full flex flex-col gap-2">
            {!canPublish && (
              <p className="text-[11px] font-body text-amber-700 dark:text-amber-300 text-right">
                {getDisabledPublishReason()}
              </p>
            )}
            <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-mono-tech text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center gap-2">
                {activeStep < 3 && (
                  <button
                    type="button"
                    onClick={() => setActiveStep((prev) => (prev === 1 ? 2 : 3))}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-900 dark:text-white font-mono-tech text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Next step
                  </button>
                )}

                {(activeStep === 3 || canPublish) && (
                  <button
                    id="publish-album-submit-btn"
                    type="button"
                    onClick={() => {
                      if (!canPublish) {
                        if (!isStep1Complete) setActiveStep(1);
                        else if (!isStep3Complete) setActiveStep(3);
                        return;
                      }
                      setConfirmPopupMode('publish');
                    }}
                    disabled={!canPublish}
                    className={`px-5 py-2.5 rounded-xl font-mono-tech text-xs font-bold transition-colors ${
                      canPublish
                        ? 'bg-[#d4af37] hover:bg-[#e6c158] text-black cursor-pointer shadow-xs'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-zinc-400 border border-slate-300 dark:border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {isCurrentlyPublished ? 'Update & Publish' : 'Publish album'}
                  </button>
                )}
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Progress: thin 3-segment bar */}
          <div className="grid grid-cols-3 gap-2">
            {stepSegments.map((item) => {
              const isCurrent = activeStep === item.step;
              const isReached = activeStep >= item.step || item.done;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveStep(item.step)}
                  className="text-left space-y-1.5 group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`h-1 w-full rounded-full transition-colors ${
                      isCurrent
                        ? 'bg-[#d4af37]'
                        : item.done
                        ? 'bg-emerald-500'
                        : isReached
                        ? 'bg-[#d4af37]/50'
                        : 'bg-slate-200 dark:bg-white/10'
                    }`}
                  />
                  <span
                    className={`block font-mono-tech text-[11px] sm:text-xs whitespace-nowrap truncate transition-colors ${
                      isCurrent
                        ? 'text-slate-900 dark:text-white font-bold'
                        : item.done
                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'text-slate-600 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* STEP 1: CONVOCATION DATE (Calendar Pop-up) */}
          {activeStep === 1 && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between gap-2">
                <label className="block font-syne font-bold text-sm text-slate-900 dark:text-white">
                  Convocation Date *
                </label>
                {formattedConvocationStr && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 font-mono-tech text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                    {formattedConvocationStr}
                  </span>
                )}
              </div>

              <div
                className="relative w-full cursor-pointer"
                onClick={() => {
                  try {
                    (convocationDateInputRef.current as any)?.showPicker?.();
                    convocationDateInputRef.current?.focus();
                  } catch {
                    convocationDateInputRef.current?.focus();
                  }
                }}
              >
                <div className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs flex items-center justify-between pointer-events-none">
                  <span>{nigerianDmyDisplay}</span>
                  <Calendar className="w-4 h-4 text-slate-400 dark:text-zinc-400 shrink-0" />
                </div>
                <input
                  ref={convocationDateInputRef}
                  id="publish-convocation-date-picker"
                  type="date"
                  value={isoConvocationValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const parts = val.split('-');
                    if (parts.length === 3) {
                      setConvocationYear(parseInt(parts[0], 10));
                      setConvocationMonth(parseInt(parts[1], 10));
                      setConvocationDay(parseInt(parts[2], 10));
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      (e.currentTarget as any).showPicker?.();
                    } catch {
                      // fallback
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* STEP 2: EXPERIENCE (OPTIONAL) */}
          {activeStep === 2 && (
            <div className="space-y-3 animate-fadeIn">
              <div className="space-y-1">
                <label
                  htmlFor="publish-experience-textarea"
                  className="block font-syne font-bold text-sm text-slate-900 dark:text-white"
                >
                  Your experience with KoHot{' '}
                  <span className="font-mono-tech text-xs font-normal text-slate-500 dark:text-zinc-400">
                    (optional)
                  </span>
                </label>
                <p className="font-body text-xs text-slate-600 dark:text-zinc-300">
                  Share a short note on building your class album.
                </p>
              </div>

              <textarea
                id="publish-experience-textarea"
                rows={4}
                value={reviewMessage}
                onChange={(e) => setReviewMessage(e.target.value)}
                placeholder="How was your experience curating your class album on KoHot?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-body text-xs sm:text-sm focus:outline-none focus:border-[#d4af37] resize-none"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                    visibility === 'public'
                      ? 'border-[#d4af37] bg-amber-50/70 dark:bg-[#d4af37]/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <Globe className="w-4 h-4 text-[#d4af37] shrink-0" />
                  <div className="min-w-0">
                    <span className="block font-mono-tech text-xs font-semibold truncate">
                      Feature publicly
                    </span>
                    <span className="block font-body text-[11px] text-slate-600 dark:text-zinc-400 truncate">
                      Homepage &amp; showcase
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                    visibility === 'private'
                      ? 'border-[#d4af37] bg-amber-50/70 dark:bg-[#d4af37]/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <Lock className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="block font-mono-tech text-xs font-semibold truncate">
                      Keep private
                    </span>
                    <span className="block font-body text-[11px] text-slate-600 dark:text-zinc-400 truncate">
                      Internal feedback only
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: NEXT SET */}
          {activeStep === 3 && (
            <div className="space-y-3 animate-fadeIn">
              <div className="space-y-1">
                <label className="block font-syne font-bold text-sm text-slate-900 dark:text-white">
                  Next set representative (Class of {nextGraduationYear}) *
                </label>
                <p className="font-body text-xs text-slate-600 dark:text-zinc-300">
                  Pass the baton to the next graduating class in your department.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Full name *
                  </label>
                  <input
                    type="text"
                    value={successorName}
                    onChange={(e) => setSuccessorName(e.target.value)}
                    placeholder="e.g. Chidinma Okafor"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-body text-xs focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Phone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    value={successorPhone}
                    onChange={(e) => setSuccessorPhone(e.target.value)}
                    placeholder="e.g. +234 803 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono-tech text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Email address (optional)
                </label>
                <input
                  type="email"
                  value={successorEmail}
                  onChange={(e) => setSuccessorEmail(e.target.value)}
                  placeholder="e.g. rep2027@university.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {isStep3Complete && (
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={whatsappDirectRelayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono-tech text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                    <span>Send handover via WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyRelayText}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono-tech text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedRelayMessage ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRelayMessage ? 'Copied' : 'Copy invite'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </UniversalModal>

      {/* Separate Pop-up Card for Publish / Unpublish Confirmation */}
      {confirmPopupMode !== 'none' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10050] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setConfirmPopupMode('none')}
        >
          <div
            id="publish-confirmation-popup-card"
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/15 p-6 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmPopupMode === 'unpublish'
                    ? 'bg-red-500/15 border border-red-500/30 text-red-500'
                    : 'bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]'
                }`}
              >
                {confirmPopupMode === 'unpublish' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-syne font-bold text-base text-slate-900 dark:text-white">
                  {confirmPopupMode === 'unpublish' ? 'Unpublish Album?' : 'Publish Class Album?'}
                </h3>
                <p className="font-mono-tech text-[11px] text-slate-500 dark:text-zinc-400">
                  {currentSet.departmentName} · Class of {currentSet.graduationYear}
                </p>
              </div>
            </div>

            <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              {confirmPopupMode === 'unpublish'
                ? "Your album will return to draft mode, will no longer be visible on the department's Legacy Wall (albums archive), and Save & Share actions will be paused until you publish again."
                : 'Your class album will go live on the department Legacy Wall (albums archive) and Save & Share buttons on the album will become active.'}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPopupMode('none')}
                className="px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-zinc-300 font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {confirmPopupMode === 'unpublish' ? (
                <button
                  id="confirm-unpublish-album-btn"
                  type="button"
                  onClick={handleExecuteUnpublishConfirmed}
                  className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  Confirm Unpublish
                </button>
              ) : (
                <button
                  id="confirm-publish-album-btn"
                  type="button"
                  onClick={handleExecutePublishConfirmed}
                  className="px-5 py-2.5 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  Confirm &amp; Publish
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
