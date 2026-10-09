import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  MessageCircle, 
  Send, 
  Copy, 
  Globe, 
  ExternalLink, 
  QrCode, 
  CalendarClock, 
  CheckCircle2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Clock,
  Mail,
  Sparkles
} from 'lucide-react';
import { ClassSet, CohortReminderSettings } from '../../types';
import { 
  calculateNextAnniversaryDate, 
  MONTH_NAMES, 
  formatDateComponents 
} from '../../utils/imageDateExtractor';
import { UniversalModal } from '../common/UniversalModal';

interface BroadcastAndConvocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
  shareableSubmitUrl: string;
  onSaveConvocation: (convocationData: {
    formattedDate: string;
    day?: number;
    month: number;
    year: number;
    isDayUnknown: boolean;
    enableAutomaticReminder: boolean;
  }) => void;
}

export const BroadcastAndConvocationModal: React.FC<BroadcastAndConvocationModalProps> = ({
  isOpen,
  onClose,
  currentSet,
  shareableSubmitUrl,
  onSaveConvocation,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showOtherPlatforms, setShowOtherPlatforms] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Convocation date form states
  const initialDateStr = currentSet.convocationDate || '';
  const initialSettings = currentSet.reminderSettings;

  const [convocationMonth, setConvocationMonth] = useState<number>(
    initialSettings?.convocationMonth || 10
  );
  const [convocationDay, setConvocationDay] = useState<string | number>(
    initialSettings?.convocationDay !== undefined ? initialSettings.convocationDay : 18
  );
  const [isDayUnknown, setIsDayUnknown] = useState<boolean>(
    Boolean(initialDateStr && !initialDateStr.match(/\d+,\s*\d{4}/) && initialSettings?.convocationDay === undefined)
  );
  const [convocationYear, setConvocationYear] = useState<number>(
    initialSettings?.convocationYear || currentSet.graduationYear || 2024
  );
  const [enableReminder, setEnableReminder] = useState<boolean>(
    initialSettings?.automaticRemindersEnabled ?? true
  );
  const [isSavedToast, setIsSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableSubmitUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const shareText = `🎓 Official Class Album Entry for ${currentSet.departmentName} (Class of ${currentSet.graduationYear}). Submit your photo, memoir, and quotes here: ${shareableSubmitUrl}`;
  const whatsAppShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareableSubmitUrl)}&text=${encodeURIComponent(shareText)}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableSubmitUrl)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(`Class Album Entry - ${currentSet.departmentName}`)}&body=${encodeURIComponent(shareText)}`;

  const handleNativeDeviceShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentSet.departmentName} Class Album Entry`,
          text: `Submit your profile to our permanent class album on KoHot:`,
          url: shareableSubmitUrl,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const parsedDay = isDayUnknown ? undefined : (typeof convocationDay === 'number' ? convocationDay : parseInt(String(convocationDay), 10) || undefined);
  const formattedDateResult = formatDateComponents(parsedDay, convocationMonth, convocationYear);
  const nextReliveBlast = calculateNextAnniversaryDate(convocationMonth, parsedDay);

  const handleSaveDateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConvocation({
      formattedDate: formattedDateResult,
      day: parsedDay,
      month: convocationMonth,
      year: convocationYear,
      isDayUnknown,
      enableAutomaticReminder: enableReminder,
    });
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  return (
    <div 
      id="broadcast-and-dates-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        id="broadcast-step-5"
        className="w-full max-w-3xl bg-[#0c0d14] border border-white/15 rounded-3xl overflow-hidden shadow-2xl relative text-[#e2e4e9] max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 sm:p-7 border-b border-white/10 flex items-center justify-between gap-4 sticky top-0 bg-[#0c0d14]/95 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-syne font-bold text-lg sm:text-xl text-white">
                Broadcast Dates
              </h3>
              <p className="font-body text-xs text-zinc-400">
                {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Containing Both Features */}
        <div className="p-6 sm:p-7 space-y-8 overflow-y-auto max-h-[calc(90vh-140px)]">

          {/* =========================================================================
              FEATURE 1: SMART BROADCAST & MULTI-PLATFORM SHARING
              ========================================================================= */}
          <div className="space-y-4 p-5 sm:p-6 rounded-2xl bg-[#08090e] border border-white/10">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider inline-block mb-1">
                  Feature 1
                </span>
                <h4 className="font-syne font-bold text-base sm:text-lg text-white">
                  Broadcast Invite to Classmates
                </h4>
                <p className="font-body text-xs text-zinc-400 mt-0.5 max-w-xl">
                  Share this friction-free invite link to your class WhatsApp, Telegram, or group chat. Classmates submit portraits and memories in under 60 seconds with zero app installs.
                </p>
              </div>

              <button
                onClick={() => setShowQrModal(!showQrModal)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="View QR Code for projector or flyer"
              >
                <QrCode className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code expansion if requested */}
            {showQrModal && (
              <div className="p-4 rounded-xl bg-black/60 border border-white/10 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left animate-fadeIn">
                <div className="w-24 h-24 bg-white rounded-lg p-1.5 flex items-center justify-center shrink-0">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareableSubmitUrl)}`}
                    alt="Submission QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="space-y-1 text-xs font-mono-tech">
                  <span className="text-white font-bold block">Instant Classmate Scan QR</span>
                  <p className="text-zinc-400 text-[11px]">
                    Display on class lecture projector, WhatsApp status, or print for graduation hall entrance.
                  </p>
                </div>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <a
                href={whatsAppShareUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-tech text-xs tracking-wider uppercase font-bold py-2.5 px-4 rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Share WhatsApp</span>
              </a>

              <a
                href={telegramShareUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#229ED9] hover:bg-[#1f8ec4] text-white font-tech text-xs tracking-wider uppercase font-bold py-2.5 px-4 rounded-full transition-all flex items-center gap-2 cursor-pointer shadow active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Telegram</span>
              </a>

              <button
                onClick={handleCopyLink}
                className="py-2.5 px-4 rounded-full bg-white/10 hover:bg-white/20 text-xs font-mono-tech text-white transition-colors cursor-pointer flex items-center gap-2"
              >
                <Copy className="w-4 h-4 text-zinc-400" />
                <span>{copiedLink ? '✓ Copied to Clipboard!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={() => setShowOtherPlatforms(!showOtherPlatforms)}
                className="py-2.5 px-3.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>More</span>
                {showOtherPlatforms ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Collapsible Other Platforms */}
            {showOtherPlatforms && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 animate-fadeIn">
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-white transition-colors text-xs font-mono-tech"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current text-white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>X</span>
                </a>

                <a
                  href={facebookShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-white transition-colors text-xs font-mono-tech"
                >
                  <Share2 className="w-4 h-4 text-blue-400" />
                  <span>Facebook Group</span>
                </a>

                <a
                  href={emailShareUrl}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-white transition-colors text-xs font-mono-tech"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Email Notice</span>
                </a>

                <button
                  onClick={handleNativeDeviceShare}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-white transition-colors text-xs font-mono-tech text-left"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>Device Share</span>
                </button>
              </div>
            )}

            {/* Direct URL Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] font-mono-tech text-zinc-400 shrink-0">Direct URL:</span>
                <input
                  type="text"
                  readOnly
                  value={shareableSubmitUrl}
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300 font-mono-tech focus:outline-none select-all truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono-tech text-white transition-colors shrink-0 cursor-pointer"
                >
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>

              <a
                href={`#submit-${currentSet.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono-tech text-emerald-400 hover:text-emerald-300 flex items-center gap-1 shrink-0"
              >
                <span>Preview Student Form</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* =========================================================================
              FEATURE 2: OFFICIAL CONVOCATION & ANNUAL RELIVE REMINDER
              ========================================================================= */}
          <div className="space-y-5 p-5 sm:p-6 rounded-2xl bg-[#08090e] border border-white/10">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech bg-amber-400/10 text-amber-300 border border-amber-400/20 font-bold uppercase tracking-wider inline-block mb-1">
                Feature 2
              </span>
              <h4 className="font-syne font-bold text-base sm:text-lg text-white">
                Official Convocation &amp; Annual Relive Reminder
              </h4>
              <p className="font-body text-xs text-zinc-400 mt-0.5">
                Set the official convocation anniversary date for the Class of {currentSet.graduationYear}. KoHot will automatically dispatch an anniversary relive email to all registered graduates on this date every year.
              </p>
            </div>

            {/* Date Pickers Form */}
            <form onSubmit={handleSaveDateSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Month */}
                <div>
                  <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400 mb-1.5">
                    Month
                  </label>
                  <select
                    value={convocationMonth}
                    onChange={(e) => setConvocationMonth(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs font-mono-tech text-white focus:outline-none focus:border-white/30"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx} className="bg-[#0c0d14] text-white">
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Day */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">
                      Day
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-mono-tech text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDayUnknown}
                        onChange={(e) => setIsDayUnknown(e.target.checked)}
                        className="rounded border-white/20 bg-black/40 text-emerald-500"
                      />
                      <span>Day unknown</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    disabled={isDayUnknown}
                    value={isDayUnknown ? '' : convocationDay}
                    onChange={(e) => setConvocationDay(e.target.value)}
                    placeholder={isDayUnknown ? 'Whole month' : 'e.g. 18'}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs font-mono-tech text-white disabled:opacity-40 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Graduation Year */}
                <div>
                  <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400 mb-1.5">
                    Year
                  </label>
                  <input
                    type="number"
                    min="1960"
                    max="2035"
                    value={convocationYear}
                    onChange={(e) => setConvocationYear(parseInt(e.target.value, 10) || currentSet.graduationYear)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs font-mono-tech text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* Automatic reminder toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/10">
                <div className="space-y-0.5">
                  <span className="font-syne font-bold text-xs text-white block">
                    Automatic Annual Relive Dispatch
                  </span>
                  <span className="font-body text-[11px] text-zinc-400 block">
                    Automatically blast anniversary email to all registered classmates with album recap
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableReminder(!enableReminder)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    enableReminder ? 'bg-emerald-500' : 'bg-white/20'
                  }`}
                  role="switch"
                  aria-checked={enableReminder}
                >
                  <div 
                    className={`w-5 h-5 rounded-full bg-black absolute top-0.5 transition-transform ${
                      enableReminder ? 'right-0.5' : 'left-0.5'
                    }`} 
                  />
                </button>
              </div>

              {/* Calculated Relive Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono-tech pt-1">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Formatted Convocation Date</span>
                  <span className="text-emerald-400 font-bold block">{formattedDateResult}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Next Annual Relive Blast</span>
                  <span className="text-white font-bold block">
                    {nextReliveBlast.nextDateFormatted} ({nextReliveBlast.daysRemaining} days remaining)
                  </span>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between pt-2">
                {isSavedToast ? (
                  <span className="text-xs font-mono-tech text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                    <Check className="w-4 h-4" /> Convocation date &amp; annual relive saved!
                  </span>
                ) : (
                  <span className="text-[11px] font-mono-tech text-zinc-500">
                    Saves to live class set and cloud reminders queue
                  </span>
                )}

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  Save Date &amp; Reminder
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0c0d14] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
