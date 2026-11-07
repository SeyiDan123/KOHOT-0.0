import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  MessageCircle,
  Send,
  Share2,
  QrCode,
  Download,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { ClassSet } from '../../types';
import { getSubmitUrl, copyUrlToClipboard } from '../../utils/urlHelper';
import { UniversalModal } from '../common/UniversalModal';

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
  const inviteLink = getSubmitUrl(currentSet);

  const defaultMessageTemplate = `Hey everyone! 👋🎓\n\nWe are curating our official ${currentSet.departmentName} (Class of ${currentSet.graduationYear} — ${currentSet.classSetName}) Digital Class Album on KoHot.\n\nPlease take 60 seconds to submit your portrait photo, nickname, parting quote, and social handles using our official submission link below:\n\n${inviteLink}`;

  const [customMessage, setCustomMessage] = useState(defaultMessageTemplate);
  const [isMessageExpanded, setIsMessageExpanded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCustomMessage(defaultMessageTemplate);
      setIsMessageExpanded(false);
      setShowQrCode(false);
    }
  }, [isOpen, currentSet.id, inviteLink]);

  if (!isOpen) return null;

  const getShareReadyMessage = () => {
    const trimmed = customMessage.trim();
    if (trimmed.includes(inviteLink)) {
      return trimmed;
    }
    return `${trimmed}\n\n${inviteLink}`;
  };

  const finalShareText = getShareReadyMessage();

  const handleCopyLink = async () => {
    await copyUrlToClipboard(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyFullMessage = async () => {
    await copyUrlToClipboard(finalShareText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `${currentSet.departmentName} Class of ${currentSet.graduationYear} Album`,
          text: finalShareText,
          url: inviteLink,
        });
        return;
      } catch {}
    }
    await handleCopyFullMessage();
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(finalShareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(
    customMessage.replace(inviteLink, '').trim()
  )}`;
  const smsUrl = `sms:?body=${encodeURIComponent(finalShareText)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(
    inviteLink
  )}`;

  const singleLinePreview = customMessage
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite classmates"
      subtitle={`${currentSet.departmentName} · Class of ${currentSet.graduationYear}`}
      maxWidth="lg"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-mono-tech text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleCopyFullMessage}
            className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-mono-tech text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            {copiedMessage ? (
              <>
                <Check className="w-3.5 h-3.5 text-black" />
                <span>Copied message</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-black" />
                <span>Copy message</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Helper line */}
        <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-zinc-300">
          Classmates add their own profile in about a minute. No account needed.
        </p>

        {/* 1. Invite link block first */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-classmates-link-input"
            className="block font-mono-tech text-xs font-semibold text-slate-900 dark:text-white"
          >
            Invite link
          </label>
          <div className="flex items-center gap-2">
            <input
              id="invite-classmates-link-input"
              type="text"
              readOnly
              value={inviteLink}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono-tech text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#272a36] dark:hover:bg-[#323646] text-white font-mono-tech text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-slate-900 dark:border-white/15"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="kohot-keep-color text-white">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span className="kohot-keep-color text-white">Copy link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowQrCode((prev) => !prev)}
              aria-expanded={showQrCode}
              title="Show QR code"
              className={`px-3 py-2.5 rounded-xl border font-mono-tech text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                showQrCode
                  ? 'bg-amber-500/15 border-[#d4af37] text-slate-900 dark:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2029] dark:hover:bg-[#272a36] border-slate-300 dark:border-white/15 text-slate-900 dark:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-[#b89728] dark:text-[#d4af37]" />
              <span>QR</span>
            </button>
          </div>

          {showQrCode && (
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#0c0d14] border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center gap-4 animate-fadeIn">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 shrink-0">
                <img
                  src={qrImageUrl}
                  alt="Class Album Submission QR Code"
                  className="w-32 h-32 object-contain"
                />
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <h4 className="font-syne font-bold text-sm text-slate-900 dark:text-white">
                  Scan to submit profile
                </h4>
                <p className="font-body text-xs text-slate-600 dark:text-zinc-300">
                  Opens the {currentSet.departmentName} (Class of {currentSet.graduationYear}) profile submission form directly.
                </p>
                <a
                  href={qrImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`KoHot-${currentSet.departmentName}-${currentSet.graduationYear}-QR.png`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white font-mono-tech text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR image</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 2. "Share via" row: four equal 56px buttons in a single row */}
        <div className="space-y-1.5">
          <span className="block font-mono-tech text-xs font-semibold text-slate-900 dark:text-white">
            Share via
          </span>
          <div className="grid grid-cols-4 gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2029] dark:hover:bg-[#272a36] border border-slate-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-[#16a34a] dark:text-[#25D366] shrink-0" />
              <span className="font-mono-tech text-[11px] font-semibold text-slate-900 dark:text-white leading-none">
                WhatsApp
              </span>
            </a>

            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2029] dark:hover:bg-[#272a36] border border-slate-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] shrink-0" />
              <span className="font-mono-tech text-[11px] font-semibold text-slate-900 dark:text-white leading-none">
                Telegram
              </span>
            </a>

            <a
              href={smsUrl}
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2029] dark:hover:bg-[#272a36] border border-slate-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#059669] dark:text-[#34d399] shrink-0" />
              <span className="font-mono-tech text-[11px] font-semibold text-slate-900 dark:text-white leading-none">
                SMS
              </span>
            </a>

            <button
              type="button"
              onClick={handleNativeShare}
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2029] dark:hover:bg-[#272a36] border border-slate-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#b45309] dark:text-[#d4af37] shrink-0" />
              <span className="font-mono-tech text-[11px] font-semibold text-slate-900 dark:text-white leading-none">
                More
              </span>
            </button>
          </div>
        </div>

        {/* 3. Message: collapsed by default as a single-line preview with "Edit"; expanded shows editable textarea (max 6 visible lines) + "Reset to default" */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block font-mono-tech text-xs font-semibold text-slate-900 dark:text-white">
              Message
            </label>
            {isMessageExpanded && (
              <button
                type="button"
                onClick={() => setCustomMessage(defaultMessageTemplate)}
                className="font-mono-tech text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to default</span>
              </button>
            )}
          </div>

          {!isMessageExpanded ? (
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 flex items-center justify-between gap-3">
              <p className="font-body text-xs text-slate-700 dark:text-zinc-300 truncate min-w-0 flex-1">
                {singleLinePreview}
              </p>
              <button
                type="button"
                onClick={() => setIsMessageExpanded(true)}
                className="font-mono-tech text-xs font-semibold text-slate-900 dark:text-white hover:underline shrink-0 cursor-pointer"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 animate-fadeIn">
              <textarea
                rows={6}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c0d14] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-body text-xs leading-relaxed focus:outline-none focus:border-[#d4af37] resize-y max-h-36"
              />
            </div>
          )}
        </div>
      </div>
    </UniversalModal>
  );
};
