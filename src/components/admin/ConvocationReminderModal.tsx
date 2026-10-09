import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  X,
  Bell,
  Mail,
  Users,
  Sparkles,
  Info
} from 'lucide-react';
import { CohortReminderSettings } from '../../types';
import { 
  MONTH_NAMES, 
  formatDateComponents, 
  calculateNextAnniversaryDate 
} from '../../utils/imageDateExtractor';

export interface ConvocationReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConvocationDate?: string;
  currentReminderSettings?: CohortReminderSettings;
  graduationYear: number;
  graduatesCount: number;
  departmentName: string;
  onPublish: (convocationData: {
    formattedDate: string;
    day?: number;
    month: number;
    year: number;
    isDayUnknown: boolean;
    enableAutomaticReminder: boolean;
  }) => void;
}

export const ConvocationReminderModal: React.FC<ConvocationReminderModalProps> = ({
  isOpen,
  onClose,
  currentConvocationDate,
  currentReminderSettings,
  graduationYear,
  graduatesCount,
  departmentName,
  onPublish,
}) => {
  // Parse initial values from reminderSettings or currentConvocationDate
  const [day, setDay] = useState<number | ''>(
    currentReminderSettings?.convocationDay ?? 
    (currentConvocationDate ? parseInt(currentConvocationDate.match(/\b([0-3]?\d)\b/)?.[1] || '', 10) || '' : 18)
  );
  const [isDayUnknown, setIsDayUnknown] = useState<boolean>(
    currentReminderSettings?.convocationDay === undefined && !!currentConvocationDate && !/\b([0-3]?\d)\b/.test(currentConvocationDate)
  );
  const [month, setMonth] = useState<number>(
    currentReminderSettings?.convocationMonth ?? 10
  );
  const [year, setYear] = useState<number>(
    currentReminderSettings?.convocationYear ?? graduationYear ?? 2024
  );
  const [enableAutomaticReminder, setEnableAutomaticReminder] = useState<boolean>(
    currentReminderSettings?.automaticRemindersEnabled ?? true
  );

  useEffect(() => {
    if (isOpen) {
      if (currentReminderSettings?.convocationMonth) {
        setMonth(currentReminderSettings.convocationMonth);
        setYear(currentReminderSettings.convocationYear || graduationYear);
        if (currentReminderSettings.convocationDay) {
          setDay(currentReminderSettings.convocationDay);
          setIsDayUnknown(false);
        } else {
          setDay('');
          setIsDayUnknown(true);
        }
        setEnableAutomaticReminder(currentReminderSettings.automaticRemindersEnabled ?? true);
      } else if (currentConvocationDate) {
        const foundDay = currentConvocationDate.match(/\b([0-3]?\d)\b/)?.[1];
        if (foundDay) {
          setDay(parseInt(foundDay, 10));
          setIsDayUnknown(false);
        } else {
          setDay('');
          setIsDayUnknown(true);
        }
        const foundYear = currentConvocationDate.match(/\b(20\d\d)\b/)?.[1];
        if (foundYear) setYear(parseInt(foundYear, 10));
      }
    }
  }, [isOpen, currentConvocationDate, currentReminderSettings, graduationYear]);

  if (!isOpen) return null;

  const validDay = isDayUnknown ? undefined : (typeof day === 'number' ? day : undefined);
  const formattedPreviewDate = formatDateComponents(validDay, month, year);
  const nextScheduledDate = calculateNextAnniversaryDate(validDay, month);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    onPublish({
      formattedDate: formattedPreviewDate,
      day: validDay,
      month,
      year,
      isDayUnknown,
      enableAutomaticReminder,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        id="convocation-reminder-modal-window"
        className="relative w-full max-w-xl rounded-3xl bg-[#0c0d14] border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-950/20 via-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-syne font-bold text-lg sm:text-xl text-white">
                Convocation Date &amp; Annual Reminder
              </h3>
              <p className="font-body text-xs text-zinc-400 mt-0.5">
                {departmentName} • Class of {graduationYear}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handlePublish} className="p-5 sm:p-6 space-y-6 overflow-y-auto font-body">
          {/* Descriptive Intro */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
            <Bell className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-300 leading-relaxed">
              Setting your cohort's official convocation anniversary enables KoHot's annual relive broadcast. Every year on this milestone date, an anniversary email invites your classmates to revisit this album.
            </p>
          </div>

          {/* Date Entry Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-white" />
                <span>Convocation Anniversary Date</span>
              </label>

              {/* Day Unknown Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="modal-day-unknown-checkbox"
                  checked={isDayUnknown}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsDayUnknown(checked);
                    if (checked) setDay('');
                    else if (!day) setDay(18);
                  }}
                  className="rounded bg-black/50 border-white/20 text-emerald-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                />
                <span className="text-[11px] font-mono-tech text-zinc-400 hover:text-zinc-200">
                  Day unknown (Month &amp; Year only)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-12 gap-3">
              {/* Day Input */}
              <div className={isDayUnknown ? 'col-span-12 sm:col-span-3 opacity-40' : 'col-span-12 sm:col-span-3'}>
                <label className="block text-[10px] font-mono-tech uppercase tracking-wider text-zinc-400 mb-1">
                  Day
                </label>
                <input
                  type="number"
                  id="convocation-day-input"
                  min={1}
                  max={31}
                  disabled={isDayUnknown}
                  value={isDayUnknown ? '' : day}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDay(val === '' ? '' : parseInt(val, 10));
                  }}
                  placeholder={isDayUnknown ? 'N/A' : '18'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white font-mono-tech text-sm text-center focus:outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>

              {/* Month Select */}
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-[10px] font-mono-tech uppercase tracking-wider text-zinc-400 mb-1">
                  Month *
                </label>
                <select
                  id="convocation-month-select"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white font-mono-tech text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1} className="bg-[#0c0d14] text-white">
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Input */}
              <div className="col-span-12 sm:col-span-4">
                <label className="block text-[10px] font-mono-tech uppercase tracking-wider text-zinc-400 mb-1">
                  Graduation Year *
                </label>
                <input
                  type="number"
                  id="convocation-year-input"
                  min={1960}
                  max={2099}
                  required
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || graduationYear)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white font-mono-tech text-sm text-center focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Formatted Date Banner */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-[11px] font-mono-tech text-emerald-300">
                Official Milestone Date:
              </span>
              <span className="text-xs font-mono-tech font-bold text-white tracking-wide">
                {formattedPreviewDate}
              </span>
            </div>
          </div>

          {/* Automatic Reminder Schedule Box */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-syne font-bold text-white">
                  Annual Relive Notification
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="enable-annual-reminder-toggle"
                  checked={enableAutomaticReminder}
                  onChange={(e) => setEnableAutomaticReminder(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              When active, KoHot automatically dispatches an anniversary email blast with your album's permanent link.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5 text-[11px] font-mono-tech">
              <div className="flex items-center gap-2 text-zinc-300">
                <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                <span>Next Relive Blast: <strong className="text-white">{nextScheduledDate.nextDateFormatted}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>Target Classmates: <strong className="text-white">{graduatesCount} Graduates</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="publish-convocation-reminder-btn"
              className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish Convocation Date &amp; Reminder</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
