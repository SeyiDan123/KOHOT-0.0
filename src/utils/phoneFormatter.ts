/**
 * Nigerian Phone Number Auto-Formatter
 * Pre-processor utility for WhatsApp, SMS sharing, and phone lookups.
 * Automatically strips any leading zero ('0') from local numbers (e.g., 0705... or 0903...)
 * and safely prepends the Nigerian country code (+234) before routing to external APIs.
 */

export const formatNigerianPhoneNumber = (raw: string | undefined | null): string => {
  if (!raw) return '';
  // Clean all characters except digits and plus
  const trimmed = raw.trim();
  let cleaned = trimmed.replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  // Case 1: Starts with +234
  if (cleaned.startsWith('+234')) {
    let rest = cleaned.slice(4);
    rest = rest.replace(/^0+/, '');
    return `+234${rest}`;
  }

  // Case 2: Starts with 234 without plus
  if (cleaned.startsWith('234')) {
    let rest = cleaned.slice(3);
    rest = rest.replace(/^0+/, '');
    return `+234${rest}`;
  }

  // Case 3: Local Nigerian number with leading 0 e.g. 080..., 090..., 070...
  if (cleaned.startsWith('0')) {
    const rest = cleaned.replace(/^0+/, '');
    return `+234${rest}`;
  }

  // Case 4: 10-digit number without leading 0 e.g. 803..., 903...
  if (cleaned.length === 10 && (cleaned.startsWith('7') || cleaned.startsWith('8') || cleaned.startsWith('9'))) {
    return `+234${cleaned}`;
  }

  // Fallback: If it already has international plus, keep it; otherwise prepend plus
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

/**
 * Returns digits-only with 234 prefix for direct wa.me links
 * e.g., wa.me/2348031234567
 */
export const getWhatsAppDigits = (raw: string | undefined | null): string => {
  const formatted = formatNigerianPhoneNumber(raw);
  return formatted.replace(/\D/g, '');
};

/**
 * Returns formatted readable string for display e.g. +234 803 123 4567
 */
export const formatPhoneForDisplay = (raw: string | undefined | null): string => {
  const digits = getWhatsAppDigits(raw);
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return formatNigerianPhoneNumber(raw);
};
