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
