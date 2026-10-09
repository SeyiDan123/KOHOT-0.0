import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: FeedbackType;
  title: string;
  message?: string;
  duration?: number;
  action?: ToastAction;
  secondaryAction?: ToastAction;
  createdAt: number;
}

export interface WarningModalConfig {
  isOpen?: boolean;
  title: string;
  message: string;
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface FeedbackContextValue {
  showToast: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => string;
  dismissToast: (id: string) => void;
  showSuccess: (title: string, message?: string, action?: ToastAction) => string;
  showError: (title: string, message?: string, action?: ToastAction) => string;
  showWarning: (title: string, message?: string, action?: ToastAction) => string;
  showInfo: (title: string, message?: string, action?: ToastAction) => string;
  confirmWarning: (config: WarningModalConfig) => void;
  closeWarningModal: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const useFeedback = (): FeedbackContextValue => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};

interface FeedbackProviderProps {
  children: ReactNode;
}

export const FeedbackProvider: React.FC<FeedbackProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [warningModal, setWarningModal] = useState<WarningModalConfig | null>(null);
  const [announcement, setAnnouncement] = useState<{ text: string; isAssertive: boolean } | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4500, action, secondaryAction }: Omit<ToastItem, 'id' | 'createdAt'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = {
        id,
        type,
        title,
        message,
        duration,
        action,
        secondaryAction,
        createdAt: Date.now(),
      };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep up to 4 concurrent toasts

      // Accessible screen reader announcement
      setAnnouncement({
        text: `${type.toUpperCase()}: ${title}. ${message || ''}`,
        isAssertive: type === 'error',
      });

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const showSuccess = useCallback(
    (title: string, message?: string, action?: ToastAction) => {
      return showToast({ type: 'success', title, message, action });
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message?: string, action?: ToastAction) => {
      // Errors remain visible slightly longer (7s) or until dismissed
      return showToast({ type: 'error', title, message, action, duration: action ? 8000 : 6000 });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string, action?: ToastAction) => {
      return showToast({ type: 'warning', title, message, action, duration: 6000 });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string, action?: ToastAction) => {
      return showToast({ type: 'info', title, message, action });
    },
    [showToast]
  );

  const confirmWarning = useCallback((config: WarningModalConfig) => {
    setWarningModal({ ...config, isOpen: true });
    setAnnouncement({
      text: `Warning: ${config.title}. ${config.message}`,
      isAssertive: true,
    });
  }, []);

  const closeWarningModal = useCallback(() => {
    setWarningModal(null);
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      confirmWarning,
      closeWarningModal,
    }),
    [showToast, dismissToast, showSuccess, showError, showWarning, showInfo, confirmWarning, closeWarningModal]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Accessible Live Regions for Screen Readers */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement && !announcement.isAssertive ? announcement.text : ''}
      </div>
      <div className="sr-only" aria-live="assertive" role="alert">
        {announcement && announcement.isAssertive ? announcement.text : ''}
      </div>

      {/* Floating Toast Notification Container (Bottom Right / Mobile Bottom offset to avoid bars) */}
      <aside 
        aria-label="Notifications" 
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[9999] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] sm:w-auto px-1 sm:px-0 flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-2xl p-4 shadow-xl border backdrop-blur-xl transition-all duration-300 transform translate-y-0 opacity-100 flex items-start gap-3.5 bg-white dark:bg-neutral-900 ${
              toast.type === 'success'
                ? 'border-emerald-500/40 text-slate-900 dark:text-white shadow-emerald-500/10'
                : toast.type === 'error'
                ? 'border-rose-500/40 text-slate-900 dark:text-white shadow-rose-500/10'
                : toast.type === 'warning'
                ? 'border-amber-500/40 text-slate-900 dark:text-white shadow-amber-500/10'
                : 'border-sky-500/40 text-slate-900 dark:text-white shadow-sky-500/10'
            }`}
          >
            {/* Visual Icon */}
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
            </div>

            {/* Content Text */}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="font-syne font-bold text-xs tracking-wide text-slate-900 dark:text-white leading-snug">
                {toast.title}
              </h4>
              {toast.message && (
                <p className="font-body text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {toast.message}
                </p>
              )}

              {/* Action Buttons if provided (e.g. Try Again, Cancel) */}
              {(toast.action || toast.secondaryAction) && (
                <div className="flex items-center gap-2 mt-2.5">
                  {toast.action && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.action?.onClick();
                        dismissToast(toast.id);
                      }}
                      className="px-3 py-1 rounded-full bg-slate-900 text-white font-mono-tech text-[11px] font-bold tracking-wider uppercase hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      {toast.action.label}
                    </button>
                  )}
                  {toast.secondaryAction && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.secondaryAction?.onClick();
                        dismissToast(toast.id);
                      }}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-white font-mono-tech text-[11px] tracking-wider uppercase transition-colors cursor-pointer"
                    >
                      {toast.secondaryAction.label}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 w-6 h-6 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </aside>

      {/* Warning / Decision Confirmation Modal */}
      {warningModal?.isOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="warning-modal-title"
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="w-full max-w-md bg-[#18181b] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-left">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                warningModal.isDestructive 
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' 
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="warning-modal-title" className="font-syne font-bold text-base text-white">
                  {warningModal.title}
                </h3>
                <p className="font-mono-tech text-[11px] text-zinc-400">
                  Confirmation required
                </p>
              </div>
            </div>

            <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {warningModal.message}
            </p>

            {warningModal.consequence && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-zinc-400 font-mono-tech">
                {warningModal.consequence}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  warningModal.onCancel?.();
                  closeWarningModal();
                }}
                className="px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs tracking-wider uppercase transition-colors cursor-pointer"
              >
                {warningModal.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  warningModal.onConfirm();
                  closeWarningModal();
                }}
                className={`px-5 py-2.5 rounded-full font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 ${
                  warningModal.isDestructive
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-white hover:bg-zinc-200 text-black'
                }`}
              >
                {warningModal.confirmLabel || 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

/**
 * Accessible Inline Validation Error Message
 * Shows next to input fields when validation fails.
 */
export const InlineValidationError: React.FC<{
  error?: string | null;
  id?: string;
}> = ({ error, id }) => {
  if (!error) return null;
  return (
    <div 
      id={id}
      role="alert" 
      className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-400 font-mono-tech animate-fadeIn"
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{error}</span>
    </div>
  );
};

/**
 * Accessible Loading / Progress Button
 * Changes label, renders spinning loader, and disables double-clicking during in-flight operations.
 */
interface ProgressButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

export const ProgressButton: React.FC<ProgressButtonProps> = ({
  loading = false,
  loadingText = 'Processing...',
  icon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`relative inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

/**
 * Section / Modal-Level Feedback Banner
 * Displays non-toast failure, recovery, or warning blocks with clear next actions.
 */
interface FeedbackBannerProps {
  type: FeedbackType;
  title: string;
  message: string;
  action?: ToastAction;
  onDismiss?: () => void;
  className?: string;
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({
  type,
  title,
  message,
  action,
  onDismiss,
  className = '',
}) => {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
        type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
          : type === 'error'
          ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
          : type === 'warning'
          ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
          : 'bg-sky-500/10 border-sky-500/25 text-sky-200'
      } ${className}`}
    >
      <div className="shrink-0 mt-0.5">
        {type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
        {type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
        {type === 'info' && <Info className="w-4 h-4 text-sky-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <strong className="block font-syne font-bold text-white mb-0.5">
          {title}
        </strong>
        <p className="text-zinc-300 font-body">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2.5 px-3 py-1 rounded-full bg-white text-black font-mono-tech text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{action.label}</span>
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-zinc-400 hover:text-white transition-colors cursor-pointer p-0.5"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
