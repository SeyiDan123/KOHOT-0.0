import React, { useState } from 'react';
import { DepartmentMemoryItem } from '../../types';
import { Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import {
  MONTH_NAMES,
  parseDateToComponents,
  formatDateComponents,
  extractExifCaptureDate,
} from '../../utils/dateFormat';
import { Modal, Field, Select, Button, Notice, Card } from '../ui';

interface MomentsDateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: DepartmentMemoryItem[];
  defaultGraduationYear: number;
  onSaveDates: (updatedMemories: DepartmentMemoryItem[]) => void;
}

interface DraftDateEntry {
  day: number | '';
  month: number | '';
  year: number | '';
  dayUnknown: boolean;
  exifDetected?: boolean;
}

export const MomentsDateReviewModal: React.FC<MomentsDateReviewModalProps> = ({
  isOpen,
  onClose,
  memories,
  defaultGraduationYear,
  onSaveDates,
}) => {
  const [drafts, setDrafts] = useState<Record<string, DraftDateEntry>>(() => {
    const init: Record<string, DraftDateEntry> = {};
    memories.forEach((m) => {
      const parsed = parseDateToComponents(m.date);
      init[m.id] = {
        day: parsed.day,
        month: parsed.month || 11,
        year: parsed.year || defaultGraduationYear,
        dayUnknown: parsed.day === '',
        exifDetected: false,
      };
    });
    return init;
  });

  const [bulkMonth, setBulkMonth] = useState<number>(11);
  const [bulkYear, setBulkYear] = useState<number>(defaultGraduationYear);
  const [scanningId, setScanningId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 45 }, (_, i) => currentYear + 5 - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleUpdateDraft = (id: string, patch: Partial<DraftDateEntry>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          day: '',
          month: 11,
          year: defaultGraduationYear,
          dayUnknown: true,
        }),
        ...patch,
      },
    }));
  };

  const handleApplyBulkToMissing = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      memories.forEach((m) => {
        const cur = next[m.id];
        if (!cur || !cur.month || !cur.year) {
          next[m.id] = {
            day: '',
            month: bulkMonth,
            year: bulkYear,
            dayUnknown: true,
          };
        }
      });
      return next;
    });
  };

  const handleAutoDetectFromPhoto = async (m: DepartmentMemoryItem) => {
    setScanningId(m.id);
    try {
      const targetUrl = m.images?.[0]?.url || m.imageUrl;
      if (!targetUrl) return;
      const resp = await fetch(targetUrl);
      const blob = await resp.blob();
      const file = new File([blob], 'moment.jpg', { type: blob.type || 'image/jpeg' });
      const exif = await extractExifCaptureDate(file);
      if (exif) {
        handleUpdateDraft(m.id, {
          day: exif.day,
          month: exif.month,
          year: exif.year,
          dayUnknown: false,
          exifDetected: true,
        });
      } else {
        handleUpdateDraft(m.id, {
          month: bulkMonth || 11,
          year: bulkYear || defaultGraduationYear,
          dayUnknown: true,
        });
      }
    } catch {
      handleUpdateDraft(m.id, {
        month: bulkMonth || 11,
        year: bulkYear || defaultGraduationYear,
        dayUnknown: true,
      });
    } finally {
      setScanningId(null);
    }
  };

  const handleSaveAll = () => {
    const updated = memories.map((m) => {
      const d = drafts[m.id];
      if (!d) return m;
      const formatted = formatDateComponents(
        d.dayUnknown ? '' : d.day,
        d.month,
        d.year
      );
      if (!formatted) return m;
      return {
        ...m,
        date: formatted,
        images: m.images?.map((img) => ({
          ...img,
          date: formatted,
        })),
      };
    });
    onSaveDates(updated);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Moments date review"
      subtitle={`Verify or update capture dates across ${memories.length} moment categories`}
      maxWidth="3xl"
      zIndex={260}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveAll}>
            <CheckCircle2 className="w-4 h-4" />
            <span>Save all dates</span>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Bulk Quick-Assign Bar */}
        <Notice variant="warning" title="Quick-fill missing dates">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span>
              Apply a default month and year to any category that doesn&apos;t have a date yet.
            </span>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Select
                value={bulkMonth}
                onChange={(e) => setBulkMonth(Number(e.target.value))}
                className="w-32 py-1.5 text-xs"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select
                value={bulkYear}
                onChange={(e) => setBulkYear(Number(e.target.value))}
                className="w-24 py-1.5 text-xs"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" size="sm" onClick={handleApplyBulkToMissing}>
                Apply to missing
              </Button>
            </div>
          </div>
        </Notice>

        {/* Individual Moment Rows */}
        <div className="space-y-3">
          {memories.map((mem) => {
            const d = drafts[mem.id] || {
              day: '',
              month: 11,
              year: defaultGraduationYear,
              dayUnknown: true,
            };
            const previewStr = formatDateComponents(
              d.dayUnknown ? '' : d.day,
              d.month,
              d.year
            );
            const thumb = mem.images?.[0]?.url || mem.imageUrl;

            return (
              <Card key={mem.id} variant="muted" className="p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={mem.title}
                        className="w-12 h-12 rounded-xl object-cover border border-[var(--kh-border)] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[var(--kh-surface)] border border-[var(--kh-border)] flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-[var(--kh-text-muted)]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-[var(--kh-surface)] border border-[var(--kh-border)] text-[10px] font-mono-tech uppercase text-[var(--kh-accent-text)] font-semibold">
                          {mem.category || 'Moment'}
                        </span>
                        <h4 className="font-semibold text-sm text-[var(--kh-text)] truncate">
                          {mem.title}
                        </h4>
                      </div>
                      <p className="text-xs text-[var(--kh-text-muted)] mt-0.5">
                        Formatted:{' '}
                        <span className="text-[var(--kh-success)] font-medium">
                          {previewStr || 'Not set'}
                        </span>
                        {d.exifDetected && (
                          <span className="ml-2 text-[var(--kh-accent-text)]">
                            • EXIF detected
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAutoDetectFromPhoto(mem)}
                      disabled={scanningId === mem.id}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--kh-accent-text)]" />
                      <span>{scanningId === mem.id ? 'Reading...' : 'Read EXIF'}</span>
                    </Button>

                    <label className="inline-flex items-center gap-1.5 text-xs text-[var(--kh-text-muted)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={d.dayUnknown}
                        onChange={(e) =>
                          handleUpdateDraft(mem.id, {
                            dayUnknown: e.target.checked,
                            day: e.target.checked ? '' : d.day || 1,
                          })
                        }
                        className="w-4 h-4 rounded border-[var(--kh-border)] accent-[var(--kh-accent)]"
                      />
                      <span>Month &amp; Year only</span>
                    </label>
                  </div>
                </div>

                {/* Day / Month / Year Selectors */}
                <div className="grid grid-cols-3 gap-2.5">
                  <Field label="Day">
                    <Select
                      disabled={d.dayUnknown}
                      value={d.dayUnknown ? '' : d.day}
                      onChange={(e) =>
                        handleUpdateDraft(mem.id, {
                          day: e.target.value ? Number(e.target.value) : '',
                          dayUnknown: false,
                        })
                      }
                      className="py-1.5 text-xs"
                    >
                      <option value="">{d.dayUnknown ? 'Day omitted' : 'Day'}</option>
                      {days.map((dayNum) => (
                        <option key={dayNum} value={dayNum}>
                          {dayNum}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Month">
                    <Select
                      value={d.month}
                      onChange={(e) =>
                        handleUpdateDraft(mem.id, {
                          month: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      className="py-1.5 text-xs"
                    >
                      <option value="">Month</option>
                      {MONTH_NAMES.map((mName, idx) => (
                        <option key={mName} value={idx + 1}>
                          {mName}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Year">
                    <Select
                      value={d.year}
                      onChange={(e) =>
                        handleUpdateDraft(mem.id, {
                          year: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      className="py-1.5 text-xs"
                    >
                      <option value="">Year</option>
                      {years.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
