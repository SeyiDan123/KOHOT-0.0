import { useEffect } from 'react';

let lockCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalBodyPaddingRight = '';

function cleanupDomScroll() {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = (originalBodyOverflow && originalBodyOverflow !== 'hidden') ? originalBodyOverflow : '';
  document.documentElement.style.overflow = (originalHtmlOverflow && originalHtmlOverflow !== 'hidden') ? originalHtmlOverflow : '';
  document.body.style.paddingRight = originalBodyPaddingRight || '';
  document.body.style.overscrollBehavior = '';
  document.documentElement.style.overscrollBehavior = '';
  document.body.classList.remove('modal-backdrop-locked');
  document.documentElement.classList.remove('modal-backdrop-locked');
}

/**
 * Universal static background scroll lock hook.
 * Locks both <body> and <html> elements cleanly while a modal/dialog is actively open.
 * Guaranteed to clean up and restore normal page scrolling upon closing, eliminating freeze glitches.
 */
export function useStaticBackdropScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    if (lockCount === 0) {
      // Capture previous overflow, filtering out any existing 'hidden' to prevent lock-in
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      originalBodyOverflow = prevBodyOverflow === 'hidden' ? '' : prevBodyOverflow;
      originalHtmlOverflow = prevHtmlOverflow === 'hidden' ? '' : prevHtmlOverflow;
      originalBodyPaddingRight = document.body.style.paddingRight;

      // Prevent content shift from scrollbar disappearing
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('modal-backdrop-locked');
      document.documentElement.classList.add('modal-backdrop-locked');
    }

    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        cleanupDomScroll();
      }
    };
  }, [isOpen]);
}

/**
 * Emergency scroll unlock utility to guarantee smooth scrolling on page transitions
 */
export function forceUnlockAllScroll(): void {
  lockCount = 0;
  originalBodyOverflow = '';
  originalHtmlOverflow = '';
  if (typeof document !== 'undefined') {
    cleanupDomScroll();
  }
}
