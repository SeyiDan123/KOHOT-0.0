import { useStaticBackdropScrollLock } from "../../utils/useStaticBackdropScrollLock";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Share2, 
  MessageCircle, 
  Send, 
  Copy, 
  Check, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  ArrowRight, 
  Smartphone, 
  ExternalLink,
  Info,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { 
  ClassSet, 
  UserAccount, 
  NextClassHandoffInvite, 
  NextClassRepresentativeRecord 
} from '../../types';
import { getWhatsAppDigits, formatNigerianPhoneNumber } from '../../utils/phoneFormatter';
import { 
  getStoredNextClassInvites, 
  saveStoredNextClassInvites,
  getStoredSets,
  saveStoredSets 
} from '../../data/initialData';
import { logManualCommunication } from '../../utils/kohotCommunications';
import { copyUrlToClipboard } from '../../utils/urlHelper';
import { useFeedback } from '../common/FeedbackSystem';
import { pickContactPhoneNumber } from '../../utils/contactPickerHelper';

interface InviteNextClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
  currentUser: UserAccount;
  onUpdateSet?: (updatedSet: ClassSet) => void;
}

export const InviteNextClassModal: React.FC<InviteNextClassModalProps> = ({
  isOpen,
  onClose,
  currentSet,
  currentUser,
  onUpdateSet,
}) => {
  const { showSuccess, showError } = useFeedback();

  // Background scroll locking
  useStaticBackdropScrollLock(isOpen);

  // Strictly sequential next graduation year: 2026 -> 2027
  const nextGraduationYear = (currentSet.graduationYear || 2026) + 1;

  // Stored or existing contact info
  const initialContact = currentSet.nextClassContact;
  const [targetName, setTargetName] = useState(initialContact?.name || '');
  const [targetPhone, setTargetPhone] = useState(initialContact?.phoneOrWhatsapp || '');
  const [targetEmail, setTargetEmail] = useState(initialContact?.email || '');

  // Existing invite if one was created
  const [existingInvite, setExistingInvite] = useState<NextClassHandoffInvite | null>(() => {
    return currentSet.handoffInvite || null;
  });

  // Invite code and link
  const [inviteCode] = useState(() => {
    if (currentSet.handoffInvite?.inviteCode) {
      return currentSet.handoffInvite.inviteCode;
    }
    const cleanDept = (currentSet.departmentCode || currentSet.departmentName || 'DEPT')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4);
    return `BATON-${cleanDept}-${nextGraduationYear}-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?next_class_invite=${inviteCode}&dept=${currentSet.departmentId}&uni=${currentSet.institutionId || currentSet.universityId || 'uni'}&year=${nextGraduationYear}&from_year=${currentSet.graduationYear}`
    : '';

  // Prepared editable message
  const [customMessage, setCustomMessage] = useState<string>('');

  useEffect(() => {
    const greetingName = targetName.trim() ? `Hello ${targetName.trim()}` : 'Hello';
    const msg = `${greetingName}! The graduating class of ${currentSet.graduationYear} (${currentSet.departmentName}) has preserved our legacy on KoHot and officially passed the department baton to your set (Class of ${nextGraduationYear}). Explore our legacy and start your class album here:\n${inviteUrl}`;
    setCustomMessage(msg);
  }, [targetName, currentSet.graduationYear, currentSet.departmentName, nextGraduationYear, inviteUrl]);

  // UI status feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [lastDispatchedChannel, setLastDispatchedChannel] = useState<string | null>(null);

  // Record an outbound manual handoff attempt
  const recordHandoffDispatch = (channel: 'whatsapp' | 'sms' | 'telegram' | 'native_share') => {
    const nowIso = new Date().toISOString();

    // 1. Updated or newly generated invite
    const inviteRecord: NextClassHandoffInvite = {
      id: existingInvite?.id || `invite-${currentSet.id}-${nextGraduationYear}`,
      fromSetId: currentSet.id,
      fromAdminName: currentSet.classRepName || currentUser.fullName,
      fromAdminEmail: currentSet.classRepEmail || currentUser.email,
      fromClassYear: currentSet.graduationYear,
      targetUniversityId: currentSet.institutionId || currentSet.universityId || 'uni',
      targetUniversityName: currentSet.institutionName || currentSet.universityName || 'University',
      targetDepartmentId: currentSet.departmentId,
      targetDepartmentName: currentSet.departmentName,
      targetClassYear: nextGraduationYear,
      targetContactName: targetName.trim() || 'Next Class Representative',
      targetContactPhone: targetPhone.trim() || '',
      targetContactEmail: targetEmail.trim() || undefined,
      inviteCode,
      status: 'invited',
      channel,
      lastSentAt: nowIso,
      createdAt: existingInvite?.createdAt || nowIso,
      expiresAt: `${nextGraduationYear}-12-31`,
      history: [
        ...(existingInvite?.history || []),
        {
          action: `Personal invitation shared via ${channel.toUpperCase()}`,
          timestamp: nowIso,
          actor: currentSet.classRepName || currentUser.fullName,
          channel,
        },
      ],
    };

    // 2. Updated contact record
    const contactRecord: NextClassRepresentativeRecord = {
      name: targetName.trim() || (initialContact?.name ?? 'Next Class Representative'),
      phoneOrWhatsapp: targetPhone.trim() || (initialContact?.phoneOrWhatsapp ?? ''),
      graduatingYear: nextGraduationYear,
      email: targetEmail.trim() || initialContact?.email,
      addedAt: initialContact?.addedAt || nowIso,
      source: 'invite_modal',
    };

    // 3. Update storage
    const allInvites = getStoredNextClassInvites();
    const filteredInvites = allInvites.filter((i) => i.id !== inviteRecord.id);
    saveStoredNextClassInvites([inviteRecord, ...filteredInvites]);

    // 4. Update Set
    const updatedSet: ClassSet = {
      ...currentSet,
      handoffInvite: inviteRecord,
      nextClassContact: contactRecord,
    };

    const allSets = getStoredSets();
    saveStoredSets(allSets.map((s) => (s.id === updatedSet.id ? updatedSet : s)));

    // 5. Log manual communication for Owner audit
    logManualCommunication({
      channel,
      recipientContact: targetPhone.trim() || 'Class Rep Handover',
      recipientName: targetName.trim() || `Class of ${nextGraduationYear} Representative`,
      event: 'admin_next_class_invitation',
      subjectOrSummary: `Baton Handoff to Class of ${nextGraduationYear} (${currentSet.departmentName})`,
      bodySnippet: customMessage,
      metadata: {
        setId: currentSet.id,
        departmentName: currentSet.departmentName,
        graduationYear: currentSet.graduationYear,
        nextClassYear: nextGraduationYear,
        initiatedBy: currentSet.classRepName || currentUser.fullName,
      },
    });

    setExistingInvite(inviteRecord);
    setLastDispatchedChannel(channel);
    if (onUpdateSet) onUpdateSet(updatedSet);
  };

  // Channel Actions
  const handleOpenWhatsApp = () => {
    recordHandoffDispatch('whatsapp');
    showSuccess('Invitation ready to share.', `The Class of ${nextGraduationYear} can use this link to begin their album.`);
    const cleanDigits = getWhatsAppDigits(targetPhone);
    const encoded = encodeURIComponent(customMessage);
    const waUrl = cleanDigits
      ? `https://wa.me/${cleanDigits}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenSMS = () => {
    recordHandoffDispatch('sms');
    showSuccess('Invitation ready to share.', `The Class of ${nextGraduationYear} can use this link to begin their album.`);
    const cleanDigits = formatNigerianPhoneNumber(targetPhone);
    const encoded = encodeURIComponent(customMessage);
    const smsUrl = cleanDigits
      ? `sms:${cleanDigits}?body=${encoded}`
      : `sms:?body=${encoded}`;
    window.location.href = smsUrl;
  };

  const handleOpenTelegram = () => {
    recordHandoffDispatch('telegram');
    showSuccess('Invitation ready to share.', `The Class of ${nextGraduationYear} can use this link to begin their album.`);
    const encodedUrl = encodeURIComponent(inviteUrl);
    const encodedText = encodeURIComponent(customMessage);
    const tgUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    window.open(tgUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `KoHot Class of ${nextGraduationYear} Baton Handoff`,
          text: customMessage,
          url: inviteUrl,
        });
        recordHandoffDispatch('native_share');
        showSuccess('Invitation ready to share.', `The Class of ${nextGraduationYear} can use this link to begin their album.`);
      } catch (err) {
        console.log('Share dismissed:', err);
      }
    } else {
      handleCopyFullMessage();
    }
  };

  const handleCopyLinkOnly = async () => {
    try {
      await copyUrlToClipboard(inviteUrl);
      setCopiedLink(true);
      recordHandoffDispatch('native_share');
      showSuccess('Invitation ready to share.', `The Class of ${nextGraduationYear} can use this link to begin their album.`);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showError("We couldn't prepare the invitation.", 'Nothing has been sent.');
    }
  };

  const handleCopyFullMessage = async () => {
    try {
      await copyUrlToClipboard(customMessage);
      setCopiedMessage(true);
      recordHandoffDispatch('native_share');
      showSuccess('Invitation ready to share.', `The Class of ${nextGraduationYear} can use this link to begin their album.`);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      showError("We couldn't prepare the invitation.", 'Nothing has been sent.');
    }
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
      <div className="relative w-full max-w-2xl bg-[#0c0d14] border border-white/20 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]" onClick={(e) => e.stopPropagation()}>
        
        {/* =========================================================================
            HEADER BAR
            ========================================================================= */}
        <div className="p-5 sm:p-7 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40 z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-syne font-bold text-xl sm:text-2xl text-white">
                  Invite Next Class
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] uppercase font-bold">
                  Baton Handoff
                </span>
              </div>
              <p className="font-mono-tech text-xs text-zinc-400 mt-0.5">
                Sequential Relay: {currentSet.graduationYear} → {nextGraduationYear}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close invite modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            SCROLLABLE CONTENT
            ========================================================================= */}
        <div className="p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-6">

          {/* Sequential Relay Rule Callout */}
          <div className="p-4 rounded-2xl bg-amber-400/5 border border-amber-400/20 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs font-body text-amber-200/90 leading-relaxed">
              <span className="font-semibold text-white block mb-0.5">
                Sequential Relay Principle
              </span>
              KoHot only permits passing the baton to the immediately succeeding class ({currentSet.graduationYear} → {nextGraduationYear}). You cannot skip cohorts (e.g. inviting {currentSet.graduationYear + 2} directly is prohibited).
            </div>
          </div>

          {/* Next Class Contact Card */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-syne font-bold text-sm text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Target Representative — Class of {nextGraduationYear}
              </span>
              <span className="text-[10px] font-mono-tech text-zinc-500 uppercase">
                {currentSet.departmentName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block text-[11px] font-mono-tech uppercase text-zinc-400 mb-1">
                  Representative Name
                </label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. Chidinma Okafor"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white font-body text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-mono-tech uppercase text-zinc-400">
                    Phone / WhatsApp Number
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      const picked = await pickContactPhoneNumber();
                      if (picked) setTargetPhone(picked);
                    }}
                    className="text-[10px] font-mono-tech text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Select from Phone Contacts</span>
                  </button>
                </div>
                <input
                  type="tel"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="e.g. +234 809 333 4455"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white font-mono-tech text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Context Link Preview Card with Image of Graduates */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono-tech text-zinc-400">
              <span className="uppercase font-semibold tracking-wider flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="w-3 h-3" />
                Link Context Preview (Carries Graduates Photo)
              </span>
              <span>Department Legacy Wall</span>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/60 border border-white/10 overflow-hidden shadow-xs">
              <img 
                src={currentSet.legacyGroupImageUrl || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80'} 
                alt="Graduates" 
                className="w-16 h-16 rounded-lg object-cover shrink-0 border border-white/10 shadow-xs" 
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-syne font-bold text-xs text-white truncate">
                  Baton Relay Handoff • Class of {nextGraduationYear}
                </p>
                <p className="font-body text-[11px] text-zinc-400 line-clamp-1">
                  Passed forward by {currentSet.departmentName} (Class of {currentSet.graduationYear}) • {currentSet.institutionName || 'University'}
                </p>
                <p className="font-mono-tech text-[10px] text-amber-400 truncate">
                  {inviteUrl}
                </p>
              </div>
            </div>
          </div>

          {/* Secure Invitation Link Box */}
          <div className="space-y-2">
            <label className="block text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
              Secure Legacy Wall Invitation Link
            </label>
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/20 flex items-center justify-between gap-3">
              <div className="font-mono-tech text-xs text-amber-300 truncate select-all">
                {inviteUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLinkOnly}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-[11px] flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
            <p className="text-[11px] font-body text-zinc-400">
              This link takes the recipient into your <strong>Department Legacy Wall</strong> with the banner <em>“Your Class — {nextGraduationYear} / Create Your Class Album”</em> pre-configured.
            </p>
          </div>

          {/* Editable Prepared Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
                Personalized Message (Editable)
              </label>
              <button
                type="button"
                onClick={handleCopyFullMessage}
                className="text-[11px] font-mono-tech text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedMessage ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedMessage ? 'Message Copied!' : 'Copy Text'}</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-4 rounded-2xl bg-black/60 border border-white/20 text-white font-body text-xs leading-relaxed focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          {/* Explicit Personal Dispatch Channels */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
                Personally Send via Channel
              </label>
              <span className="text-[10px] font-mono-tech text-emerald-400">
                KoHot never silently sends WhatsApp/SMS
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="p-3.5 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-white flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              >
                <MessageCircle className="w-5 h-5 text-[#25D366] group-hover:scale-110 transition-transform" />
                <span className="font-syne font-bold text-xs">WhatsApp</span>
              </button>

              {/* SMS */}
              <button
                type="button"
                onClick={handleOpenSMS}
                className="p-3.5 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-white flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              >
                <Smartphone className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
                <span className="font-syne font-bold text-xs">SMS Text</span>
              </button>

              {/* Telegram */}
              <button
                type="button"
                onClick={handleOpenTelegram}
                className="p-3.5 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-white flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              >
                <Send className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="font-syne font-bold text-xs">Telegram</span>
              </button>

              {/* Native Share */}
              <button
                type="button"
                onClick={handleNativeShare}
                className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              >
                <Share2 className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="font-syne font-bold text-xs">Share Sheet</span>
              </button>
            </div>
          </div>

          {/* Privacy & Governance Safeguard */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5 text-xs font-body text-zinc-300 leading-relaxed">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold font-mono-tech text-[11px] uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Handoff Verification &amp; Authorization Policy</span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              This invitation preserves the relay context so the incoming cohort can view your class album and learn the traditions of {currentSet.departmentName}. It <strong>does not automatically grant admin privileges</strong>; the recipient must still submit their Class Album request and undergo Owner verification.
            </p>
          </div>

          {/* Status & Audit Tracker Pill */}
          {existingInvite && (
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs font-mono-tech">
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Handoff Status:</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-bold text-[10px]">
                  {existingInvite.status}
                </span>
              </div>
              {existingInvite.lastSentAt && (
                <span className="text-zinc-500 text-[11px]">
                  Last sent: {new Date(existingInvite.lastSentAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

        </div>

        {/* =========================================================================
            STICKY FOOTER
            ========================================================================= */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-black/60 shrink-0 flex items-center justify-between z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-syne text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {lastDispatchedChannel && (
              <span className="text-emerald-400 font-mono-tech text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sent via {lastDispatchedChannel.toUpperCase()}</span>
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }
  return modalElement;
};
