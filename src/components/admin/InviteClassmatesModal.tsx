import { useStaticBackdropScrollLock } from "../../utils/useStaticBackdropScrollLock";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ClassSet } from '../../types';
import { getSubmitUrl, copyUrlToClipboard } from '../../utils/urlHelper';
import { useFeedback } from '../common/FeedbackSystem';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Send, 
  MessageSquare, 
  ExternalLink,
  Sparkles,
  Users
} from 'lucide-react';

interface InviteClassmatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
}

export const InviteClassmatesModal: React.FC<InviteClassmatesModalProps> = ({
  isOpen,
  onClose,
  currentSet,
}) => {
  const { showSuccess, showError } = useFeedback();
  const shareableSubmitUrl = getSubmitUrl(currentSet);
  const defaultMessage = `🎓 Calling all Class of ${currentSet.graduationYear || 2026} (${currentSet.departmentName}, ${currentSet.institutionName}) graduates!\n\nSubmit your official graduate portrait, nickname, and parting quote for our KoHot Digital Class Album here (takes 60 seconds, no registration needed):\n${shareableSubmitUrl}\n\nLet's immortalize our shared university memories!`;

  const [messageText, setMessageText] = useState(defaultMessage);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedFullMessage, setCopiedFullMessage] = useState(false);

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

  const handleCopyLinkOnly = async () => {
    try {
      await copyUrlToClipboard(shareableSubmitUrl);
      setCopiedLink(true);
      showSuccess('Invitation ready to share.', 'The album link is copied and ready.');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showError("We couldn't prepare the invitation.", 'Nothing has been sent.');
    }
  };

  const handleCopyFullMessage = async () => {
    try {
      await copyUrlToClipboard(messageText);
      setCopiedFullMessage(true);
      showSuccess('Invitation ready to share.', 'The message and album link are ready.');
      setTimeout(() => setCopiedFullMessage(false), 2500);
    } catch {
      showError("We couldn't prepare the invitation.", 'Nothing has been sent.');
    }
  };

  const handleShareWhatsApp = () => {
    showSuccess('Invitation ready to share.', 'Opening WhatsApp with the message and album link.');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareTelegram = () => {
    showSuccess('Invitation ready to share.', 'Opening Telegram with the message and album link.');
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareableSubmitUrl)}&text=${encodeURIComponent(messageText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareSms = () => {
    showSuccess('Invitation ready to share.', 'Opening SMS with the message and album link.');
    const smsUrl = `sms:?body=${encodeURIComponent(messageText)}`;
    window.location.href = smsUrl;
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentSet.departmentName} Class of ${currentSet.graduationYear} Album`,
          text: messageText,
          url: shareableSubmitUrl,
        });
        showSuccess('Invitation ready to share.', 'The message and album link are ready.');
      } catch (err) {
        // dismissed or canceled by user
      }
    } else {
      await handleCopyFullMessage();
    }
  };

  const modalElement = (
    <div 
      id="invite-classmates-modal-backdrop"
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        id="invite-classmates-modal-dialog"
        className="relative w-full max-w-xl bg-[#0c0d14] border border-white/15 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-syne font-bold text-lg text-white">
                  Invite Classmates
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] uppercase font-semibold">
                  Profile Submissions
                </span>
              </div>
              <p className="font-body text-xs text-zinc-400">
                {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-5 text-xs font-body">
          {/* Explanation Banner */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
            <p className="text-zinc-300 leading-relaxed text-xs">
              Share this invite on WhatsApp class groups, Telegram, or SMS. Classmates can submit their official portrait, moniker, and parting quote in under 60 seconds with no account registration required.
            </p>
          </div>

          {/* Invitation Message Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">
                Invitation Message Template
              </label>
              <button
                type="button"
                onClick={() => setMessageText(defaultMessage)}
                className="text-[11px] font-mono-tech text-[#d4af37] hover:underline cursor-pointer"
              >
                Reset to Default
              </button>
            </div>

            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-[#08090e] border border-white/15 text-white font-body text-xs leading-relaxed focus:outline-none focus:border-[#d4af37]/60 transition-colors"
            />
          </div>

          {/* Submission URL Box */}
          <div className="p-3 rounded-2xl bg-[#08090e] border border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="block font-mono-tech text-[10px] uppercase text-zinc-500 tracking-wider">
                Direct Submission Link
              </span>
              <span className="block font-mono-tech text-xs text-white truncate">
                {shareableSubmitUrl}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyLinkOnly}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white border border-white/10 font-mono-tech text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>

              <a
                href={shareableSubmitUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white border border-white/10 transition-colors"
                title="Preview Submission Form"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Quick Share Buttons */}
          <div className="space-y-2">
            <span className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
              Share Invitation Immediately
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2.5 px-3 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleShareTelegram}
                className="py-2.5 px-3 rounded-2xl bg-[#0088cc]/15 hover:bg-[#0088cc]/25 border border-[#0088cc]/30 text-[#0088cc] font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </button>

              <button
                type="button"
                onClick={handleShareSms}
                className="py-2.5 px-3 rounded-2xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>SMS</span>
              </button>

              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3 shrink-0 z-10">
          <span className="text-[11px] font-mono-tech text-zinc-500 hidden sm:inline">
            KoHot • Frictionless Graduate Directory
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleCopyFullMessage}
              className="px-5 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow active:scale-95"
            >
              {copiedFullMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedFullMessage ? 'Message Copied!' : 'Copy Invitation'}</span>
            </button>
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
