import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';

export interface UniversalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
  hasUnsavedChanges?: boolean;
  ariaLabel?: string;
  zIndex?: number;
}

const MAX_WIDTH_MAP: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[96vw]',
};

export const UniversalModal: React.FC<UniversalModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '2xl',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  bodyClassName = '',
  hasUnsavedChanges = false,
  ariaLabel,
  zIndex = 60,
}) => {
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Background page scroll and touch lock using universal lock manager
  useStaticBackdropScrollLock(isOpen);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCloseAttempt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, hasUnsavedChanges]);

  // Clean up discard confirm when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDiscardConfirm(false);
    }
  }, [isOpen]);

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === backdropRef.current) {
      handleCloseAttempt();
    }
  };

  if (!isOpen) return null;

  const maxWidthClass = MAX_WIDTH_MAP[maxWidth] || 'max-w-2xl';

  const modalContent = (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      onTouchMove={(e) => {
        if (e.target === backdropRef.current) {
          e.preventDefault();
        }
      }}
      style={{ zIndex }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col justify-center items-center p-3 sm:p-5 overflow-hidden animate-fadeIn touch-none overscroll-none select-none"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : ariaLabel || 'Dialog'}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className={`relative w-full ${maxWidthClass} max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/15 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-900 dark:text-white font-body overflow-hidden touch-auto overscroll-contain select-auto ${className}`}
      >
        {/* STICKY ACCESSIBLE HEADER - Never scrolls away */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 py-4 sm:px-7 sm:py-5 border-b border-slate-200 dark:border-white/10 bg-slate-50/95 dark:bg-[#18181b]/95 backdrop-blur-sm shrink-0 z-10">
            <div className="space-y-1 pr-4 min-w-0 flex-1">
              {title && (
                <div className="font-syne font-bold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight truncate">
                  {title}
                </div>
              )}
              {subtitle && (
                <p className="font-body text-xs text-slate-600 dark:text-slate-400 truncate">
                  {subtitle}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={handleCloseAttempt}
                aria-label="Close dialog"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* INTERNALLY SCROLLABLE BODY */}
        <div className={`overflow-y-auto flex-1 min-h-0 px-5 py-4 sm:px-7 sm:py-6 overscroll-contain text-slate-900 dark:text-slate-100 ${bodyClassName}`}>
          {children}
        </div>

        {/* STICKY ACCESSIBLE FOOTER */}
        {footer && (
          <div className="px-5 py-3.5 sm:px-7 sm:py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/95 dark:bg-[#18181b]/95 backdrop-blur-sm shrink-0 flex items-center justify-end gap-3 z-10 text-slate-900 dark:text-white">
            {footer}
          </div>
        )}

        {/* UNSAVED CHANGES DISCARD CONFIRMATION OVERLAY */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
            <div className="max-w-sm w-full bg-white border border-amber-300 rounded-2xl p-6 text-center space-y-4 shadow-2xl text-slate-900">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-syne font-bold text-lg text-slate-900">Discard your changes?</h4>
                <p className="font-body text-xs text-slate-600 leading-relaxed">
                  You have unsaved edits. Are you sure you want to exit without saving?
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-900 font-mono-tech text-xs cursor-pointer transition-colors shadow-xs"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-mono-tech text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render into document.body portal so ancestor overflow/transforms never clip the modal
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
