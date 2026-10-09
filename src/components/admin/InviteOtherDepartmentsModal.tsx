import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Share2, 
  MessageCircle, 
  Send, 
  Copy, 
  Check, 
  Building2, 
  Users, 
  Sparkles, 
  Smartphone, 
  ExternalLink,
  Info,
  CheckCircle2,
  Phone
} from 'lucide-react';
import { ClassSet, UserAccount } from '../../types';
import { logManualCommunication } from '../../utils/kohotCommunications';
import { copyUrlToClipboard } from '../../utils/urlHelper';
import { useFeedback } from '../common/FeedbackSystem';
import { getWhatsAppDigits, formatNigerianPhoneNumber } from '../../utils/phoneFormatter';

import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { pickContactPhoneNumber } from '../../utils/contactPickerHelper';

export interface OtherDepartmentInviteRecord {
  id: string;
  fromSetId: string;
  fromAdminName: string;
  fromDepartmentName: string;
  fromClassYear: number;
  targetRepresentativeName: string;
  targetDepartmentName: string;
  targetPhoneOrWhatsapp: string;
  targetEmail?: string;
  customMessage: string;
  inviteUrl: string;
  lastSentAt: string;
  channel: 'whatsapp' | 'telegram' | 'sms' | 'copy' | 'native_share';
}

interface InviteOtherDepartmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
  currentUser: UserAccount;
}

export const InviteOtherDepartmentsModal: React.FC<InviteOtherDepartmentsModalProps> = ({
  isOpen,
  onClose,
  currentSet,
  currentUser,
}) => {
  const { showSuccess, showError } = useFeedback();

  // Background scroll locking
  useStaticBackdropScrollLock(isOpen);

  const [targetName, setTargetName] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [targetEmail, setTargetEmail] = useState('');

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [lastDispatchedChannel, setLastDispatchedChannel] = useState<string | null>(null);

  const cleanDeptParam = encodeURIComponent(targetDepartment.trim() || 'dept');
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?invite_department=${cleanDeptParam}&from_rep=${encodeURIComponent(currentSet.classRepName || currentUser.fullName)}&from_dept=${encodeURIComponent(currentSet.departmentName)}&from_year=${currentSet.graduationYear}&uni=${encodeURIComponent(currentSet.institutionName || 'University')}`
    : '';

  const [customMessage, setCustomMessage] = useState<string>('');

  useEffect(() => {
    const greeting = targetName.trim() ? `Hello ${targetName.trim()}` : 'Hello';
    const deptPhrase = targetDepartment.trim() ? `Department of ${targetDepartment.trim()}` : 'your department';
    const repName = currentSet.classRepName || currentUser.fullName;
    const uniName = currentSet.institutionName || currentSet.universityName || 'our university';

    const msg = `${greeting}! I'm ${repName}, the Class Representative for ${currentSet.departmentName} (Class of ${currentSet.graduationYear}) at ${uniName}. We recently preserved our graduating class memories and officially launched our class album on KoHot.\n\nYour graduating class in ${deptPhrase} deserves to have its students, portraits, and milestones permanently preserved too! You can start and build your official department class album here:\n${inviteUrl}\n\nLet's preserve our graduating classes together!`;
    setCustomMessage(msg);
  }, [targetName, targetDepartment, currentSet.classRepName, currentUser.fullName, currentSet.departmentName, currentSet.graduationYear, currentSet.institutionName, currentSet.universityName, inviteUrl]);

  if (!isOpen) return null;

  const cleanPhoneNumber = targetPhone.replace(/[^0-9+]/g, '');

  const recordDispatch = (channel: 'whatsapp' | 'telegram' | 'sms' | 'copy' | 'native_share') => {
    const nowIso = new Date().toISOString();
    const record: OtherDepartmentInviteRecord = {
      id: `dept-invite-${Date.now()}`,
      fromSetId: currentSet.id,
      fromAdminName: currentSet.classRepName || currentUser.fullName,
      fromDepartmentName: currentSet.departmentName,
      fromClassYear: currentSet.graduationYear,
      targetRepresentativeName: targetName.trim() || 'Class Representative',
      targetDepartmentName: targetDepartment.trim() || 'Graduating Class',
      targetPhoneOrWhatsapp: targetPhone.trim(),
      targetEmail: targetEmail.trim() || undefined,
      customMessage,
      inviteUrl,
      lastSentAt: nowIso,
      channel,
    };

    try {
      const stored = localStorage.getItem('kohot_other_dept_invites');
      const list: OtherDepartmentInviteRecord[] = stored ? JSON.parse(stored) : [];
      list.unshift(record);
      localStorage.setItem('kohot_other_dept_invites', JSON.stringify(list));

      const commChannel: 'whatsapp' | 'sms' | 'telegram' | 'native_share' =
        channel === 'whatsapp' ? 'whatsapp' :
        channel === 'sms' ? 'sms' :
        channel === 'telegram' ? 'telegram' : 'native_share';

      logManualCommunication({
        channel: commChannel,
        recipientName: targetName.trim() || `${targetDepartment || 'Other'} Class Rep`,
        recipientContact: targetPhone.trim() || targetEmail.trim() || 'External Contact',
        event: 'admin_invite_other_departments',
        subjectOrSummary: `Invited ${targetDepartment || 'Other'} Class Rep to create class album`,
        bodySnippet: customMessage.slice(0, 160),
        metadata: {
          setId: currentSet.id,
          departmentName: targetDepartment || currentSet.departmentName,
          graduationYear: currentSet.graduationYear,
          targetPhone: targetPhone.trim() || undefined,
          initiatedBy: currentSet.classRepName || currentUser.fullName,
        },
      });
    } catch (e) {
      console.error('Error saving invite record:', e);
    }

    setLastDispatchedChannel(channel);
  };

  const handleSendWhatsApp = () => {
    recordDispatch('whatsapp');
    const encoded = encodeURIComponent(customMessage);
    const waDigits = getWhatsAppDigits(targetPhone);
    const url = waDigits
      ? `https://wa.me/${waDigits}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showSuccess('WhatsApp opened', 'Invite message prepared for dispatch.');
  };

  const handleSendTelegram = () => {
    recordDispatch('telegram');
    const encodedText = encodeURIComponent(customMessage);
    const encodedUrl = encodeURIComponent(inviteUrl);
    const url = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showSuccess('Telegram opened', 'Invite link shared to Telegram.');
  };

  const handleSendSms = () => {
    recordDispatch('sms');
    const encoded = encodeURIComponent(customMessage);
    const formattedPhone = formatNigerianPhoneNumber(targetPhone);
    const url = formattedPhone ? `sms:${formattedPhone}?body=${encoded}` : `sms:?body=${encoded}`;
    window.location.href = url;
  };

  const handleCopyMessage = async () => {
    const success = await copyUrlToClipboard(customMessage);
    if (success) {
      recordDispatch('copy');
      setCopiedMessage(true);
      showSuccess('Message copied', 'Invitation template copied to clipboard.');
      setTimeout(() => setCopiedMessage(false), 3000);
    } else {
      showError('Failed to copy', 'Could not copy message automatically.');
    }
  };

  const handleCopyLinkOnly = async () => {
    const success = await copyUrlToClipboard(inviteUrl);
    if (success) {
      recordDispatch('copy');
      setCopiedLink(true);
      showSuccess('Link copied', 'Invitation URL copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 3000);
    } else {
      showError('Failed to copy', 'Could not copy link automatically.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Create Your Class Album on KoHot`,
          text: customMessage,
          url: inviteUrl,
        });
        recordDispatch('native_share');
        showSuccess('Shared successfully', 'Invitation shared via device dialog.');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyMessage();
        }
      }
    } else {
      handleCopyMessage();
    }
  };

  const handleSubmitSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    recordDispatch('copy');
    showSuccess('Details Saved', `Saved contact details for ${targetDepartment || 'the other department'}.`);
  };

  return createPortal(
    <div 
      id="invite-other-departments-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#0c0d14] border border-slate-200 dark:border-white/20 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh] text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#10121a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Invite Other Classes / Departments
              </h2>
              <p className="font-body text-xs text-slate-600 dark:text-zinc-400">
                Send invitation to graduating class representatives of other departments to create their albums
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs font-body">
          {/* Context Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-mono-tech text-[11px] uppercase tracking-wider font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Multi-Department Outreach</span>
            </div>
            <p className="text-slate-700 dark:text-zinc-300 leading-relaxed text-[11px]">
              When other faculties and departments join KoHot, your university's digital heritage becomes richer and more interconnected. Send this invitation to friendly class representatives or executive presidents in other departments.
            </p>
          </div>

          {/* Form: Contact Details */}
          <form onSubmit={handleSubmitSaveDetails} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-700 dark:text-zinc-400 mb-1 font-semibold">
                  Representative Name
                </label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. David Adeleke"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/50 text-xs font-body"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-700 dark:text-zinc-400 mb-1 font-semibold">
                  Their Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  placeholder="e.g. Mechanical Engineering, Law, Pharmacy"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/50 text-xs font-body"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-700 dark:text-zinc-400 font-semibold">
                    WhatsApp / Phone Number
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      const picked = await pickContactPhoneNumber();
                      if (picked) setTargetPhone(picked);
                    }}
                    className="text-[10px] font-mono-tech text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Select from Contacts</span>
                  </button>
                </div>
                <input
                  type="tel"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="e.g. +234 812 345 6789"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/50 text-xs font-mono-tech"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-700 dark:text-zinc-400 mb-1 font-semibold">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="e.g. rep@department.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/50 text-xs font-mono-tech"
                />
              </div>
            </div>
          </form>

          {/* Customizable Template Message Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-semibold">
                Invitation Message Template (Editable)
              </label>
              <span className="font-mono-tech text-[10px] text-slate-500 dark:text-zinc-500">
                Auto-personalizes as you type details
              </span>
            </div>

            <textarea
              rows={6}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-black/80 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-body leading-relaxed focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/50 resize-none"
            />
          </div>

          {/* Social Dispatch Buttons */}
          <div className="space-y-3">
            <span className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Send via Socials or Share:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono-tech text-xs">
              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="p-3 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 hover:bg-emerald-500/25 dark:hover:bg-emerald-500/30 border border-emerald-500/30 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-semibold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>WhatsApp</span>
              </button>

              {/* Telegram */}
              <button
                type="button"
                onClick={handleSendTelegram}
                className="p-3 rounded-2xl bg-sky-500/15 dark:bg-sky-500/20 hover:bg-sky-500/25 dark:hover:bg-sky-500/30 border border-sky-500/30 dark:border-sky-500/40 text-sky-800 dark:text-sky-300 font-semibold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
              >
                <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Telegram</span>
              </button>

              {/* SMS */}
              <button
                type="button"
                onClick={handleSendSms}
                className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-zinc-200 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
              >
                <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>SMS</span>
              </button>

              {/* Native Device Share */}
              <button
                type="button"
                onClick={handleNativeShare}
                className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-zinc-200 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
              >
                <Share2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Share App</span>
              </button>
            </div>

            {/* Quick Action Links: Copy Message & Copy Link */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white font-mono-tech text-xs flex items-center gap-2 transition-colors cursor-pointer border border-slate-300 dark:border-white/10"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMessage ? 'Message Copied!' : 'Copy Full Message'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLinkOnly}
                className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white font-mono-tech text-xs flex items-center gap-2 transition-colors cursor-pointer border border-slate-300 dark:border-white/10"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#10121a] shrink-0">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 font-mono-tech text-[11px]">
            {lastDispatchedChannel && (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Last sent via {lastDispatchedChannel}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-syne font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
