import { MONTH_NAMES, MONTH_SHORT_MAP, formatDateComponents, extractDateFromFile } from './imageDateExtractor';

export { MONTH_NAMES, MONTH_SHORT_MAP, formatDateComponents };

export function parseDateToComponents(dateStr?: string): {
  day: number | '';
  month: number | '';
  year: number | '';
} {
  if (!dateStr || !dateStr.trim()) {
    return { day: '', month: '', year: '' };
  }
  const s = dateStr.trim();

  // Check ISO YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  // Check "18 October 2024" or "October 18, 2024" or "October 2024"
  const yearMatch = s.match(/\b(19\d\d|20\d\d)\b/);
  const year: number | '' = yearMatch ? parseInt(yearMatch[1], 10) : '';

  let month: number | '' = '';
  const lower = s.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const mFull = MONTH_NAMES[i].toLowerCase();
    const mShort = mFull.slice(0, 3);
    if (lower.includes(mFull) || new RegExp(`\\b${mShort}\\b`).test(lower)) {
      month = i + 1;
      break;
    }
  }

  // Extract day (1-31) that is not the year
  let day: number | '' = '';
  const tokens = s.replace(/,/g, ' ').split(/\s+/);
  for (const tok of tokens) {
    const num = parseInt(tok, 10);
    if (!isNaN(num) && num >= 1 && num <= 31 && String(num) === tok) {
      day = num;
      break;
    }
  }

  return { day, month, year };
}

export async function extractExifCaptureDate(
  file: File
): Promise<{ day: number; month: number; year: number } | null> {
  const res = await extractDateFromFile(file);
  if (res && res.month && res.year) {
    return {
      day: res.day || 1,
      month: res.month,
      year: res.year,
    };
  }
  return null;
}
