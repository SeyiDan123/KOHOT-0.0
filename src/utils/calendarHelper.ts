/**
 * Calendar Helper for KoHot
 * Generates Google Calendar prefilled URLs and .ics files for yearly album relive anniversaries.
 * No sign-in, no email collection, no data stored.
 */

export interface AlbumCalendarEventParams {
  departmentName: string;
  graduationYear: number;
  convocationDate?: string; // e.g. "18 October 2024" or "October 2024"
  albumUrl: string;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

export function parseConvocationDate(dateStr?: string, defaultYear: number = 2024): { year: number; month: number; day: number } {
  const safeYear = Number.isFinite(defaultYear) && defaultYear > 1900 ? defaultYear : 2024;
  if (!dateStr || !dateStr.trim()) {
    try {
      const today = new Date();
      return { year: safeYear, month: today.getMonth() + 1, day: today.getDate() };
    } catch {
      return { year: safeYear, month: 1, day: 1 };
    }
  }

  const clean = dateStr.trim();
  const yearMatch = clean.match(/\b(20\d\d|19\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : defaultYear;

  let month = 11;
  const lower = clean.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (lower.includes(MONTH_NAMES[i])) {
      month = i + 1;
      break;
    }
  }

  // Look for day: 1-31
  const dayMatch = clean.match(/\b([1-9]|[12]\d|3[01])\b/);
  let day = 1;
  if (dayMatch) {
    const parsedDay = parseInt(dayMatch[1], 10);
    // Ensure it's not the year
    if (parsedDay !== year && parsedDay <= 31) {
      day = parsedDay;
    }
  }

  return { year, month, day };
}

function pad(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * Creates Google Calendar prefilled event URL
 * All-day event on convocation date, repeating every year (RRULE:FREQ=YEARLY)
 */
export function generateGoogleCalendarUrl(params: AlbumCalendarEventParams): string {
  const { year, month, day } = parseConvocationDate(params.convocationDate, params.graduationYear);
  const title = `Revisit your ${params.departmentName} Class of ${params.graduationYear} album`;
  const description = `A warm invitation to revisit your university class memories, relive student milestones, and reconnect with classmates.\n\nOpen your album:\n${params.albumUrl}`;

  // Next occurrence from current or convocation date
  const now = new Date();
  let eventYear = now.getFullYear();
  const eventDateThisYear = new Date(eventYear, month - 1, day);
  if (eventDateThisYear < now) {
    eventYear += 1;
  }

  const startDateStr = `${eventYear}${pad(month)}${pad(day)}`;
  // End date for all-day event is +1 day
  const nextDay = new Date(eventYear, month - 1, day + 1);
  const endDateStr = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;

  const datesParam = `${startDateStr}/${endDateStr}`;

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', datesParam);
  url.searchParams.set('recur', 'RRULE:FREQ=YEARLY');
  url.searchParams.set('details', description);
  url.searchParams.set('location', params.albumUrl);

  return url.toString();
}

/**
 * Generates and downloads an iCalendar (.ics) file for Apple Calendar and other calendar clients.
 * All-day event repeating yearly with a 9:00 AM alarm.
 */
export function downloadIcsCalendarFile(params: AlbumCalendarEventParams): void {
  const { month, day } = parseConvocationDate(params.convocationDate, params.graduationYear);
  const title = `Revisit your ${params.departmentName} Class of ${params.graduationYear} album`;
  const description = `A warm invitation to revisit your university class memories, relive student milestones, and reconnect with classmates.\\n\\nOpen your album:\\n${params.albumUrl}`;

  const now = new Date();
  let eventYear = now.getFullYear();
  const eventDateThisYear = new Date(eventYear, month - 1, day);
  if (eventDateThisYear < now) {
    eventYear += 1;
  }

  const startDateStr = `${eventYear}${pad(month)}${pad(day)}`;
  const nextDay = new Date(eventYear, month - 1, day + 1);
  const endDateStr = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;

  const uid = `kohot-album-${params.graduationYear}-${Date.now()}@kohot.app`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KoHot//Class Album//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${startDateStr}`,
    `DTEND;VALUE=DATE:${endDateStr}`,
    'RRULE:FREQ=YEARLY',
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `URL:${params.albumUrl}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Revisit your KoHot Class Album',
    'TRIGGER;RELATED=START:PT9H', // 9:00 AM morning alarm on the day of the event
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);

  const cleanDept = params.departmentName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `${cleanDept}-Class-of-${params.graduationYear}-Revisit.ics`;

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
