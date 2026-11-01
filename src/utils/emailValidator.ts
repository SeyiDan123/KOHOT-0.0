/**
 * Email validation utility
 * Enforces accurate, valid email format across all platform forms.
 */

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;

  // RFC 5322 compliant regex for standard emails
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return false;

  // Domain & TLD checks
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();
  
  // Must have a dot in domain
  if (!domain.includes('.')) return false;

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  // TLD must be at least 2 characters (e.g., .com, .ng, .edu, .org, .uk)
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) return false;

  // Disallow invalid consecutive dots or empty parts
  if (domainParts.some(p => p.length === 0)) return false;

  return true;
}

export function validateEmailField(email: string | null | undefined, isRequired: boolean = true): { isValid: boolean; error?: string } {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    if (isRequired) {
      return { isValid: false, error: 'Email address is required.' };
    }
    return { isValid: true };
  }

  if (!isValidEmail(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid and accurate email address (e.g., name@university.edu or name@domain.com).'
    };
  }

  return { isValid: true };
}

export function checkEmailTypoSuggestion(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return null;
  const [localPart, domain] = parts;
  const commonTypos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.con': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outllok.com': 'outlook.com',
    'icoud.com': 'icloud.com',
  };
  if (commonTypos[domain]) {
    return `${localPart}@${commonTypos[domain]}`;
  }
  return null;
}

