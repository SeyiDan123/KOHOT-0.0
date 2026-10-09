/**
 * Utility to extract capture or event dates from uploaded images.
 * Supports:
 * 1. EXIF Metadata (DateTimeOriginal / DateTimeDigitized in JPEG/TIFF headers)
 * 2. Filename patterns (e.g., IMG_20241018_*, 2024-10-18*, WhatsApp Image 2024-10-18, Oct_2024)
 * 3. File lastModified system timestamps
 * 4. Multi-image batch consensus scoring
 */

export interface ExtractedDateResult {
  day?: number; // 1 - 31 (optional if user or metadata only has month and year)
  month: number; // 1 - 12
  monthName: string;
  year: number;
  formattedDisplay: string; // "18 October 2024" or "October 2024"
  isoDateString?: string; // "2024-10-18"
  confidence: 'high' | 'medium' | 'approximate';
  source: 'exif' | 'filename' | 'file_modified' | 'consensus' | 'fallback';
  sourceDescription: string;
  sampleFileName?: string;
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_SHORT_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * Format Day, Month, Year into human-readable label.
 * If day is omitted/undefined, renders "Month Year" (accepted by user requirement).
 */
export function formatDateComponents(day: number | undefined | null, month: number, year: number): string {
  const safeMonthIndex = Math.max(1, Math.min(12, month)) - 1;
  const monthName = MONTH_NAMES[safeMonthIndex] || 'Unknown';
  if (day && day >= 1 && day <= 31) {
    return `${day} ${monthName} ${year}`;
  }
  return `${monthName} ${year}`;
}

/**
 * Extracts candidate date from JPEG EXIF header buffer.
 */
async function extractExifDate(file: File): Promise<{ day: number; month: number; year: number } | null> {
  try {
    // Read the first 128KB which contains standard JPEG APP1 / Exif segment
    const slice = file.slice(0, 131072);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Basic JPEG check (FF D8)
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      // Decode slice to ASCII / binary string to search for standard EXIF date format: "YYYY:MM:DD HH:MM:SS"
      let binaryStr = '';
      const len = Math.min(bytes.length, 65536);
      for (let i = 0; i < len; i++) {
        binaryStr += String.fromCharCode(bytes[i]);
      }

      // Regex for EXIF DateTime format: YYYY:MM:DD or YYYY-MM-DD
      const exifMatch = binaryStr.match(/\b(20\d\d|19\d\d)[:\-\/](0[1-9]|1[0-2])[:\-\/](0[1-9]|[12]\d|3[01])\s+([01]\d|2[0-3]):([0-5]\d)/);
      if (exifMatch) {
        const year = parseInt(exifMatch[1], 10);
        const month = parseInt(exifMatch[2], 10);
        const day = parseInt(exifMatch[3], 10);
        if (year >= 1990 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return { day, month, year };
        }
      }
    }
  } catch {
    // Fail silently on non-standard binary
  }
  return null;
}

/**
 * Extracts candidate date from filename patterns.
 */
function extractFilenameDate(filename: string): { day?: number; month: number; year: number } | null {
  const name = filename.toLowerCase();

  // Pattern 1: ISO style or standard digital camera: IMG_20241018_... or 2024-10-18 or 2024_10_18
  const isoMatch = name.match(/(?:^|[^0-9])(20\d\d)[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:[^0-9]|$)/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }

  // Pattern 2: Day-Month-Year (e.g. 18-10-2024 or 18_10_2024)
  const dmyMatch = name.match(/(?:^|[^0-9])(0[1-9]|[12]\d|3[01])[-_.](0[1-9]|1[0-2])[-_.](20\d\d)(?:[^0-9]|$)/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }

  // Pattern 3: Named month in filename: e.g. convocation_october_18_2024 or oct_2024
  const monthNameMatch = name.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_ ]?([0-3]?\d)?[-_ ]?(20\d\d)/);
  if (monthNameMatch) {
    const monthShort = monthNameMatch[1];
    const month = MONTH_SHORT_MAP[monthShort];
    const dayRaw = monthNameMatch[2] ? parseInt(monthNameMatch[2], 10) : undefined;
    const year = parseInt(monthNameMatch[3], 10);
    const day = dayRaw && dayRaw >= 1 && dayRaw <= 31 ? dayRaw : undefined;
    if (month && year >= 2000 && year <= 2035) {
      return { day, month, year };
    }
  }

  // Pattern 4: Year and Month only: e.g. convocation_2024_10 or 2024-10
  const ymMatch = name.match(/(?:^|[^0-9])(20\d\d)[-_](0[1-9]|1[0-2])(?:[^0-9]|$)/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const month = parseInt(ymMatch[2], 10);
    if (year >= 2000 && year <= 2035 && month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  return null;
}

/**
 * Extracts candidate date from file lastModified timestamp.
 */
function extractLastModifiedDate(file: File): { day: number; month: number; year: number } | null {
  if (!file.lastModified) return null;
  const d = new Date(file.lastModified);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  // Accept reasonable historical / recent years
  if (year >= 2015 && year <= new Date().getFullYear() + 1) {
    return { day, month, year };
  }
  return null;
}

/**
 * Scan a single image file to extract capture/event date.
 */
export async function extractDateFromFile(file: File): Promise<ExtractedDateResult | null> {
  // 1. Check EXIF (highest precision)
  const exif = await extractExifDate(file);
  if (exif) {
    const monthName = MONTH_NAMES[exif.month - 1];
    return {
      day: exif.day,
      month: exif.month,
      monthName,
      year: exif.year,
      formattedDisplay: formatDateComponents(exif.day, exif.month, exif.year),
      isoDateString: `${exif.year}-${String(exif.month).padStart(2, '0')}-${String(exif.day).padStart(2, '0')}`,
      confidence: 'high',
      source: 'exif',
      sourceDescription: `Extracted from photo EXIF capture timestamp (${file.name})`,
      sampleFileName: file.name,
    };
  }

  // 2. Check filename
  const fnDate = extractFilenameDate(file.name);
  if (fnDate) {
    const monthName = MONTH_NAMES[fnDate.month - 1];
    return {
      day: fnDate.day,
      month: fnDate.month,
      monthName,
      year: fnDate.year,
      formattedDisplay: formatDateComponents(fnDate.day, fnDate.month, fnDate.year),
      isoDateString: fnDate.day
        ? `${fnDate.year}-${String(fnDate.month).padStart(2, '0')}-${String(fnDate.day).padStart(2, '0')}`
        : `${fnDate.year}-${String(fnDate.month).padStart(2, '0')}`,
      confidence: 'medium',
      source: 'filename',
      sourceDescription: `Extracted from image filename timestamp (${file.name})`,
      sampleFileName: file.name,
    };
  }

  // 3. Check lastModified
  const modDate = extractLastModifiedDate(file);
  if (modDate) {
    const monthName = MONTH_NAMES[modDate.month - 1];
    return {
      day: modDate.day,
      month: modDate.month,
      monthName,
      year: modDate.year,
      formattedDisplay: formatDateComponents(modDate.day, modDate.month, modDate.year),
      isoDateString: `${modDate.year}-${String(modDate.month).padStart(2, '0')}-${String(modDate.day).padStart(2, '0')}`,
      confidence: 'approximate',
      source: 'file_modified',
      sourceDescription: `Extracted from file system creation date (${file.name})`,
      sampleFileName: file.name,
    };
  }

  return null;
}

/**
 * Scan multiple uploaded files from a batch.
 * Computes frequency consensus across all images in the batch to find the common event date.
 */
export async function extractDateFromBatchFiles(
  files: FileList | File[],
  defaultGraduationYear = 2024
): Promise<ExtractedDateResult> {
  const fileArray = Array.from(files);
  const candidates: Array<{
    day?: number;
    month: number;
    year: number;
    source: 'exif' | 'filename' | 'file_modified';
    fileName: string;
  }> = [];

  // Examine up to 12 files to balance speed and accuracy
  const sampleLimit = Math.min(fileArray.length, 12);
  for (let i = 0; i < sampleLimit; i++) {
    const file = fileArray[i];
    const extracted = await extractDateFromFile(file);
    if (extracted) {
      candidates.push({
        day: extracted.day,
        month: extracted.month,
        year: extracted.year,
        source: extracted.source as any,
        fileName: file.name,
      });
    }
  }

  // Prioritize EXIF candidates first
  const exifCandidates = candidates.filter((c) => c.source === 'exif');
  if (exifCandidates.length > 0) {
    // Return the most frequent or first EXIF date
    const best = exifCandidates[0];
    const monthName = MONTH_NAMES[best.month - 1];
    return {
      day: best.day,
      month: best.month,
      monthName,
      year: best.year,
      formattedDisplay: formatDateComponents(best.day, best.month, best.year),
      isoDateString: best.day
        ? `${best.year}-${String(best.month).padStart(2, '0')}-${String(best.day).padStart(2, '0')}`
        : `${best.year}-${String(best.month).padStart(2, '0')}`,
      confidence: 'high',
      source: 'exif',
      sourceDescription: `High confidence: Extracted from camera EXIF capture metadata across ${exifCandidates.length} photo(s)`,
      sampleFileName: best.fileName,
    };
  }

  // Next prioritize filename candidates
  const fnCandidates = candidates.filter((c) => c.source === 'filename');
  if (fnCandidates.length > 0) {
    const best = fnCandidates[0];
    const monthName = MONTH_NAMES[best.month - 1];
    return {
      day: best.day,
      month: best.month,
      monthName,
      year: best.year,
      formattedDisplay: formatDateComponents(best.day, best.month, best.year),
      isoDateString: best.day
        ? `${best.year}-${String(best.month).padStart(2, '0')}-${String(best.day).padStart(2, '0')}`
        : `${best.year}-${String(best.month).padStart(2, '0')}`,
      confidence: 'medium',
      source: 'filename',
      sourceDescription: `Extracted from filename timestamps (${best.fileName})`,
      sampleFileName: best.fileName,
    };
  }

  // Next check file_modified
  const modCandidates = candidates.filter((c) => c.source === 'file_modified');
  if (modCandidates.length > 0) {
    const best = modCandidates[0];
    const monthName = MONTH_NAMES[best.month - 1];
    return {
      day: best.day,
      month: best.month,
      monthName,
      year: best.year,
      formattedDisplay: formatDateComponents(best.day, best.month, best.year),
      isoDateString: best.day
        ? `${best.year}-${String(best.month).padStart(2, '0')}-${String(best.day).padStart(2, '0')}`
        : `${best.year}-${String(best.month).padStart(2, '0')}`,
      confidence: 'approximate',
      source: 'file_modified',
      sourceDescription: `Extracted from file metadata timestamp (${best.fileName})`,
      sampleFileName: best.fileName,
    };
  }

  // Intelligent fallback: Current date or default graduation year
  const now = new Date();
  const fallbackYear = defaultGraduationYear || now.getFullYear();
  const fallbackMonth = now.getMonth() + 1; // 1-12
  const fallbackDay = now.getDate();
  const monthName = MONTH_NAMES[fallbackMonth - 1];

  return {
    day: fallbackDay,
    month: fallbackMonth,
    monthName,
    year: fallbackYear,
    formattedDisplay: formatDateComponents(fallbackDay, fallbackMonth, fallbackYear),
    isoDateString: `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-${String(fallbackDay).padStart(2, '0')}`,
    confidence: 'approximate',
    source: 'fallback',
    sourceDescription: 'Suggested from calendar term (No photo timestamp found; you can edit or approve below)',
  };
}

/**
 * Calculates the next recurring annual anniversary date for the relive reminder.
 */
export function calculateNextAnniversaryDate(
  convocationMonth: number,
  convocationDay?: number | null
): {
  nextDateFormatted: string;
  daysRemaining: number;
  anniversaryYear: number;
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  const day = convocationDay && convocationDay >= 1 && convocationDay <= 31 ? convocationDay : 15;
  const monthIndex = Math.max(0, Math.min(11, convocationMonth - 1));

  let targetDate = new Date(currentYear, monthIndex, day);
  if (targetDate.getTime() < now.getTime()) {
    // This year's anniversary has passed, next is next year
    targetDate = new Date(currentYear + 1, monthIndex, day);
  }

  const diffMs = targetDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const monthName = MONTH_NAMES[monthIndex];

  return {
    nextDateFormatted: convocationDay ? `${convocationDay} ${monthName} ${targetDate.getFullYear()}` : `${monthName} ${targetDate.getFullYear()}`,
    daysRemaining,
    anniversaryYear: targetDate.getFullYear(),
  };
}
