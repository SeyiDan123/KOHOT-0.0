import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CalendarClock, 
  Sparkles, 
  Check, 
  X, 
  Bell, 
  AlertCircle, 
  Info, 
  Camera, 
  Clock, 
  CheckCircle2, 
  Mail,
  Users
} from 'lucide-react';
import { 
  ExtractedDateResult, 
  MONTH_NAMES, 
  formatDateComponents, 
  calculateNextAnniversaryDate 
} from '../../utils/imageDateExtractor';
import { UniversalModal } from '../common/UniversalModal';

export interface MomentsDateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedDate: ExtractedDateResult;
  batchTitle: string;
  batchCategory: string;
  graduatesCount?: number;
  isConvocationHint?: boolean;
  onApprove: (approved: {
    formattedDate: string;
    day?: number;
    month: number;
    year: number;
    isDayUnknown: boolean;
    isConvocationDate: boolean;
    enableAutomaticReminder: boolean;
  }) => void;
}

export const MomentsDateReviewModal: React.FC<MomentsDateReviewModalProps> = ({
  isOpen,
  onClose,
  extractedDate,
  batchTitle,
  batchCategory,
  graduatesCount = 0,
  isConvocationHint = false,
  onApprove,
}) => {
  // Local state for interactive editing
  const [day, setDay] = useState<number | ''>(extractedDate.day ?? '');
  const [isDayUnknown, setIsDayUnknown] = useState<boolean>(!extractedDate.day);
  const [month, setMonth] = useState<number>(extractedDate.month || 10);
  const [year, setYear] = useState<number>(extractedDate.year || 2024);

  // Convocation & Automatic Reminder toggle
  const isConvocationDefault = 
    isConvocationHint || 
    batchCategory.toLowerCase().includes('convocation') || 
    batchTitle.toLowerCase().includes('convocation');

  const [isConvocationDate, setIsConvocationDate] = useState<boolean>(isConvocationDefault);
  const [enableAutomaticReminder, setEnableAutomaticReminder] = useState<boolean>(isConvocationDefault);

  // Update local state whenever new extractedDate is passed in
  useEffect(() => {
    setDay(extractedDate.day ?? '');
    setIsDayUnknown(!extractedDate.day);
    setMonth(extractedDate.month || 10);
    setYear(extractedDate.year || 2024);
    const isConv = 
      isConvocationHint || 
      batchCategory.toLowerCase().includes('convocation') || 
      batchTitle.toLowerCase().includes('convocation');
    setIsConvocationDate(isConv);
    setEnableAutomaticReminder(isConv);
  }, [extractedDate, batchCategory, batchTitle, isConvocationHint]);

  if (!isOpen) return null;

  const currentDayValue = isDayUnknown ? undefined : (typeof day === 'number' ? day : undefined);
  const formattedPreview = formatDateComponents(currentDayValue, month, year);
  const reminderCalculation = calculateNextAnniversaryDate(month, currentDayValue);

  const handleApprove = () => {
    onApprove({
      formattedDate: formattedPreview,
      day: currentDayValue,
      month,
      year,
      isDayUnknown,
      isConvocationDate,
      enableAutomaticReminder: isConvocationDate && enableAutomaticReminder,
    });
    onClose();
  };

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-syne font-bold text-base sm:text-lg text-white">
                Event Date Verification
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Auto-Extracted
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Uploaded photos often postdate the actual event. We scanned the image metadata for you.
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="text-[11px] font-mono-tech text-zinc-400 text-center sm:text-left">
            <span>Selected Date: </span>
            <strong className="text-white">{formattedPreview}</strong>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="approve-event-date-btn"
              onClick={handleApprove}
              className="flex-1 sm:flex-none py-2.5 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isConvocationDate ? 'Approve Date & Schedule Reminder' : 'Approve Event Date'}
              </span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs font-body">
          {/* Metadata Detection Pill */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
            <Camera className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono-tech text-[11px] text-white font-semibold">
                  Source:
                </span>
                <span className="text-[11px] font-mono-tech text-zinc-300 truncate">
                  {extractedDate.sourceDescription}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono-tech">
                Initial metadata detected: <strong className="text-emerald-400">{extractedDate.formattedDisplay}</strong>
              </p>
            </div>
          </div>

          {/* Interactive Date Editor (Day, Month, Year) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Event Date (Day • Month • Year)</span>
              </label>
              <span className="text-[10px] font-mono-tech text-zinc-500">
                Month and Year accepted if day is unknown
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Day Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono-tech uppercase text-zinc-400">
                  Day (1 - 31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  disabled={isDayUnknown}
                  value={isDayUnknown ? '' : day}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                    setDay(val);
                  }}
                  placeholder={isDayUnknown ? 'Day unknown' : 'e.g. 18'}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono-tech text-white focus:outline-none transition-all ${
                    isDayUnknown
                      ? 'bg-black/30 border-white/5 text-zinc-600 cursor-not-allowed'
                      : 'bg-[#06070a] border-white/15 focus:border-emerald-500/50'
                  }`}
                />
                <label className="flex items-center gap-1.5 text-[10px] font-mono-tech text-zinc-400 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={isDayUnknown}
                    onChange={(e) => {
                      setIsDayUnknown(e.target.checked);
                      if (e.target.checked) setDay('');
                    }}
                    className="rounded bg-black/40 border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Day unknown (Month &amp; Year only)</span>
                </label>
              </div>

              {/* Month Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono-tech uppercase text-zinc-400">
                  Month *
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#06070a] border border-white/15 text-sm font-mono-tech text-white focus:border-emerald-500/50 focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {mName} ({String(idx + 1).padStart(2, '0')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono-tech uppercase text-zinc-400">
                  Year *
                </label>
                <input
                  type="number"
                  min={1990}
                  max={2035}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || 2024)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#06070a] border border-white/15 text-sm font-mono-tech text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Approved Date Live Preview */}
            <div className="p-3 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                Display In Album:
              </span>
              <span className="font-syne font-bold text-sm text-emerald-400">
                {formattedPreview}
              </span>
            </div>
          </div>

          {/* Automatic Convocation Reminder Trigger Section */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            isConvocationDate 
              ? 'bg-emerald-500/[0.04] border-emerald-500/40' 
              : 'bg-white/[0.02] border-white/10'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isConvocationDate 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                    : 'bg-white/5 border-white/10 text-zinc-400'
                }`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-syne font-bold text-sm text-white">
                      Official Convocation &amp; Annual Relive Reminder
                    </span>
                    {isConvocationDate && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-tech bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                        Active Setting
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Setting this approved date as your official convocation anniversary automatically schedules an annual relive email reminder to all alumni every year on <strong className="text-white">{formattedPreview}</strong>.
                  </p>
                </div>
              </div>

              {/* Toggle Convocation */}
              <input
                type="checkbox"
                id="toggle-convocation-reminder"
                checked={isConvocationDate}
                onChange={(e) => {
                  setIsConvocationDate(e.target.checked);
                  if (e.target.checked) setEnableAutomaticReminder(true);
                }}
                className="w-4 h-4 mt-1 rounded bg-black/40 border-white/20 text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
              />
            </div>

            {/* Revealed Automated Reminder Details */}
            {isConvocationDate && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="block text-[9px] font-mono-tech text-zinc-400 uppercase">
                        Next Automated Dispatch
                      </span>
                      <span className="font-mono-tech text-xs text-white font-bold">
                        {reminderCalculation.nextDateFormatted} ({reminderCalculation.daysRemaining} days)
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 flex items-center gap-2.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="block text-[9px] font-mono-tech text-zinc-400 uppercase">
                        Target Alumni Coverage
                      </span>
                      <span className="font-mono-tech text-xs text-white font-bold">
                        {graduatesCount} Classmates in Cohort
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono-tech text-emerald-400/90 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Annual reminder will automatically notify classmates to relive shared memories on this date.
                  </span>
                </div>
              </div>
            )}
          </div>
      </div>
    </UniversalModal>
  );
};
