export interface InstitutionCurrencyMap {
  [institutionId: string]: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
};

const STORAGE_KEY = 'kohot_institution_currencies_v1';

export function getInstitutionCurrency(
  institutionId?: string | null,
  overrideCurrency?: string | null
): string {
  if (overrideCurrency && overrideCurrency.trim()) {
    return overrideCurrency.trim().toUpperCase();
  }
  if (!institutionId) return 'NGN';
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as InstitutionCurrencyMap;
        if (parsed[institutionId]) {
          return parsed[institutionId].toUpperCase();
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return 'NGN';
}

export function setInstitutionCurrency(institutionId: string, currency: string): void {
  if (!institutionId) return;
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: InstitutionCurrencyMap = raw ? JSON.parse(raw) : {};
      parsed[institutionId] = (currency || 'NGN').trim().toUpperCase();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // ignore storage errors
  }
}

export function getCurrencySymbol(currencyCode = 'NGN'): string {
  const code = (currencyCode || 'NGN').trim().toUpperCase();
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

/**
 * Formats an amount stored in minor units (e.g., kobo / cents) into a clean display string.
 * Every monetary figure across the platform passes through this single helper.
 */
export function formatMoneyFromKobo(
  amountKobo: number | null | undefined,
  options?: {
    currency?: string;
    institutionId?: string | null;
    showDecimals?: boolean;
  }
): string {
  const safeKobo = typeof amountKobo === 'number' && Number.isFinite(amountKobo) ? amountKobo : 0;
  const majorAmount = safeKobo / 100;
  return formatMoneyMajor(majorAmount, options);
}

/**
 * Formats an amount in major units (e.g., Naira / Dollars) into a clean display string.
 */
export function formatMoneyMajor(
  amountMajor: number | null | undefined,
  options?: {
    currency?: string;
    institutionId?: string | null;
    showDecimals?: boolean;
  }
): string {
  const safeMajor = typeof amountMajor === 'number' && Number.isFinite(amountMajor) ? amountMajor : 0;
  const currencyCode = getInstitutionCurrency(options?.institutionId, options?.currency);
  const symbol = getCurrencySymbol(currencyCode);
  const hasFraction = Math.abs(safeMajor % 1) > 0.001;
  const decimals = options?.showDecimals ? 2 : hasFraction ? 2 : 0;

  const formatted = Math.abs(safeMajor).toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return safeMajor < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Sanitizes a cell value for CSV export.
 * Prefixes any cell starting with =, +, -, or @ with an apostrophe (') to prevent formula injection.
 */
export function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const trimmedLeading = raw.replace(/^[\s\uFEFF\xA0]+/, '');
  const safeValue =
    trimmedLeading.length > 0 && ['=', '+', '-', '@'].includes(trimmedLeading[0])
      ? `'${raw}`
      : raw;
  const escaped = safeValue.replace(/"/g, '""');
  return `"${escaped}"`;
}
