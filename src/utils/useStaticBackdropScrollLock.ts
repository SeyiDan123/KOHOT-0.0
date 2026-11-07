import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalBodyPaddingRight = '';
let originalBodyPosition = '';
let originalBodyTop = '';
let originalBodyLeft = '';
let originalBodyRight = '';
let originalBodyWidth = '';

function preventBackgroundScroll(e: Event) {
  const target = e.target as HTMLElement | null;
  if (!target) {
    e.preventDefault();
    return;
  }

  // Allow scrolling inside explicitly marked scrollable modal containers or dialog bodies
  const scrollableParent = target.closest(
    '[data-modal-scrollable="true"], [role="dialog"] .overflow-y-auto, [aria-modal="true"] .overflow-y-auto'
  ) as HTMLElement | null;

  if (scrollableParent) {
    const canScrollVertically = scrollableParent.scrollHeight > scrollableParent.clientHeight;
    if (canScrollVertically) {
      return;
    }
  }

  e.preventDefault();
}

function attachGlobalScrollBlockers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('wheel', preventBackgroundScroll, { passive: false });
  window.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
}

function detachGlobalScrollBlockers() {
  if (typeof window === 'undefined') return;
  window.removeEventListener('wheel', preventBackgroundScroll);
  window.removeEventListener('touchmove', preventBackgroundScroll);
}

function cleanupDomScroll() {
  if (typeof document === 'undefined') return;
  detachGlobalScrollBlockers();

  document.body.style.overflow =
    originalBodyOverflow && originalBodyOverflow !== 'hidden' ? originalBodyOverflow : '';
  document.documentElement.style.overflow =
    originalHtmlOverflow && originalHtmlOverflow !== 'hidden' ? originalHtmlOverflow : '';
  document.body.style.paddingRight = originalBodyPaddingRight || '';
  document.body.style.overscrollBehavior = '';
  document.documentElement.style.overscrollBehavior = '';
  document.body.classList.remove('modal-backdrop-locked');
  document.documentElement.classList.remove('modal-backdrop-locked');
}

/**
 * Universal static background scroll lock hook.
 * Locks both <body> and <html> elements cleanly while a modal/dialog is actively open,
 * keeping the blurred background and bottom bar completely static without layout jumps.
 */
export function useStaticBackdropScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    if (lockCount === 0) {
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
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.classList.add('modal-backdrop-locked');
      document.documentElement.classList.add('modal-backdrop-locked');

      attachGlobalScrollBlockers();
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
  if (lockCount > 0) {
    lockCount = 0;
    cleanupDomScroll();
  }
}
