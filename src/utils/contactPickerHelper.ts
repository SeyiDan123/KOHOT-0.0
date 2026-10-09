/**
 * Contact Picker Helper for Native Phone Contacts Integration
 * Uses the Web Contacts Picker API (navigator.contacts.select) on supporting mobile browsers
 * with a friendly fallback for desktop or unsupported environments.
 */

export async function pickContactPhoneNumber(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Check if native Web Contacts API is supported (standard in modern mobile Chrome/Android)
  const nav = navigator as any;
  if ('contacts' in nav && 'ContactsManager' in window) {
    try {
      const contacts = await nav.contacts.select(['tel', 'name'], { multiple: false });
      if (contacts && contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
        const rawPhone = contacts[0].tel[0];
        return String(rawPhone).trim();
      }
    } catch (err: any) {
      // User dismissed or aborted contact selector
      if (err?.name !== 'AbortError') {
        console.warn('Native contact selection:', err);
      }
    }
  }

  // If running in desktop browser or unsupported browser, dispatch notification event or return null so input remains directly editable
  try {
    window.dispatchEvent(
      new CustomEvent('kohot_toast_notification', {
        detail: {
          message: 'Direct device contacts access is available on mobile browsers. Please type or paste the number directly into the field.',
          type: 'info',
        },
      })
    );
  } catch {}

  return null;
}

