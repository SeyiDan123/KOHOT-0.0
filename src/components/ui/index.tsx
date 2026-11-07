import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  zIndex?: number;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  bodyClassName?: string;
  panelClassName?: string;
}

const MAX_WIDTH_CLASSES: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  zIndex = 200,
  closeOnBackdrop = true,
  showCloseButton = true,
  bodyClassName = '',
  panelClassName = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md transition-opacity"
      style={{ zIndex, backgroundColor: 'var(--kh-overlay)' }}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`kh-modal-panel relative w-full ${MAX_WIDTH_CLASSES[maxWidth]} max-h-[90dvh] flex flex-col rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-surface)] text-[var(--kh-text)] shadow-2xl overflow-hidden ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle || showCloseButton) && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--kh-border)] bg-[var(--kh-surface)] shrink-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-base sm:text-lg font-semibold text-[var(--kh-text)] truncate leading-snug">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs sm:text-sm text-[var(--kh-text-muted)] truncate">
                  {subtitle}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--kh-text-muted)] hover:text-[var(--kh-text)] hover:bg-[var(--kh-surface-2)] border border-transparent hover:border-[var(--kh-border)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className={`flex-1 min-h-0 overflow-y-auto px-5 py-4 custom-scrollbar bg-[var(--kh-surface)] ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <div className="sticky bottom-0 z-10 px-5 py-3.5 border-t border-[var(--kh-border)] bg-[var(--kh-surface)] shrink-0 flex items-center justify-between gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export interface FieldProps {
  label?: React.ReactNode;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  rightLabel?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  helper,
  error,
  required,
  rightLabel,
  htmlFor,
  children,
  className = '',
}) => (
  <div className={`space-y-1.5 ${className}`}>
    {(label || rightLabel) && (
      <div className="flex items-center justify-between gap-2">
        {label && (
          <label htmlFor={htmlFor} className="block text-xs sm:text-sm font-medium text-[var(--kh-text)]">
            {label}
            {required && <span className="text-[var(--kh-danger)] ml-0.5">*</span>}
          </label>
        )}
        {rightLabel && <div className="text-xs text-[var(--kh-text-muted)]">{rightLabel}</div>}
      </div>
    )}
    {helper && <p className="text-xs text-[var(--kh-text-muted)] leading-relaxed">{helper}</p>}
    {children}
    {error && <p className="text-xs font-medium text-[var(--kh-danger)]">{error}</p>}
  </div>
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`kh-input w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-input-bg)] px-3.5 py-2.5 text-sm text-[var(--kh-text)] placeholder:text-[var(--kh-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--kh-accent)] focus:border-[var(--kh-accent)] disabled:opacity-60 disabled:bg-[var(--kh-surface-2)] disabled:text-[var(--kh-text-muted)] disabled:cursor-not-allowed transition-colors ${className}`}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`kh-select w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-input-bg)] px-3.5 py-2.5 text-sm text-[var(--kh-text)] focus:outline-none focus:ring-2 focus:ring-[var(--kh-accent)] focus:border-[var(--kh-accent)] disabled:opacity-60 disabled:bg-[var(--kh-surface-2)] disabled:text-[var(--kh-text-muted)] disabled:cursor-not-allowed transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`kh-textarea w-full rounded-xl border border-[var(--kh-border)] bg-[var(--kh-input-bg)] px-3.5 py-2.5 text-sm text-[var(--kh-text)] placeholder:text-[var(--kh-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--kh-accent)] focus:border-[var(--kh-accent)] disabled:opacity-60 disabled:bg-[var(--kh-surface-2)] disabled:text-[var(--kh-text-muted)] disabled:cursor-not-allowed transition-colors ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', type = 'button', children, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-10 px-4 text-sm rounded-xl gap-2',
      lg: 'h-11 px-5 text-sm rounded-xl gap-2',
    }[size];

    const variantClasses = {
      primary:
        'kh-btn-primary bg-[var(--kh-accent)] text-[var(--kh-on-accent)] font-semibold border border-transparent hover:brightness-105 active:brightness-95',
      secondary:
        'kh-btn-secondary bg-[var(--kh-surface)] text-[var(--kh-text)] font-medium border border-[var(--kh-border)] hover:bg-[var(--kh-surface-2)]',
      'accent-outline':
        'kh-btn-accent-outline bg-[var(--kh-surface)] text-[var(--kh-accent-text)] font-semibold border border-[var(--kh-accent)] hover:bg-[var(--kh-surface-2)]',
      ghost:
        'kh-btn-ghost bg-transparent text-[var(--kh-text-muted)] hover:text-[var(--kh-text)] hover:bg-[var(--kh-surface-2)] font-medium border border-transparent',
      danger:
        'kh-btn-danger bg-[var(--kh-danger)] text-white font-semibold border border-transparent hover:brightness-105',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kh-accent)] disabled:bg-[var(--kh-surface-2)] disabled:text-[var(--kh-text-muted)] disabled:border-[var(--kh-border)] disabled:opacity-80 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
  badge?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  active = false,
  count,
  badge,
  className = '',
  children,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`kh-chip inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors shrink-0 cursor-pointer select-none ${
      active
        ? 'bg-[var(--kh-accent)] text-[var(--kh-on-accent)] border-[var(--kh-accent)] font-semibold'
        : 'bg-[var(--kh-surface)] text-[var(--kh-text-muted)] border-[var(--kh-border)] hover:text-[var(--kh-text)] hover:bg-[var(--kh-surface-2)]'
    } ${className}`}
    {...props}
  >
    <span>{children}</span>
    {typeof count === 'number' && (
      <span
        className={`px-1.5 py-0.2 rounded text-[11px] font-semibold ${
          active
            ? 'bg-black/15 text-[var(--kh-on-accent)]'
            : 'bg-[var(--kh-surface-2)] text-[var(--kh-text)]'
        }`}
      >
        {count}
      </span>
    )}
    {badge}
  </button>
);

export interface NoticeProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

export const Notice: React.FC<NoticeProps> = ({
  variant = 'info',
  title,
  children,
  className = '',
  onDismiss,
}) => {
  const styles = {
    info: {
      wrapper: 'bg-[var(--kh-surface-2)] border-[var(--kh-border)] text-[var(--kh-text)]',
      icon: <Info className="w-4 h-4 text-[var(--kh-text-muted)] shrink-0 mt-0.5" />,
    },
    warning: {
      wrapper: 'bg-[var(--kh-warn-bg)] border-[var(--kh-warn-border)] text-[var(--kh-warn-text)]',
      icon: <AlertTriangle className="w-4 h-4 text-[var(--kh-warn-text)] shrink-0 mt-0.5" />,
    },
    error: {
      wrapper: 'bg-[var(--kh-surface-2)] border-[var(--kh-danger)] text-[var(--kh-danger)]',
      icon: <AlertCircle className="w-4 h-4 text-[var(--kh-danger)] shrink-0 mt-0.5" />,
    },
    success: {
      wrapper: 'bg-[var(--kh-surface-2)] border-[var(--kh-success)] text-[var(--kh-success)]',
      icon: <CheckCircle2 className="w-4 h-4 text-[var(--kh-success)] shrink-0 mt-0.5" />,
    },
  }[variant];

  return (
    <div className={`kh-notice flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm ${styles.wrapper} ${className}`}>
      {styles.icon}
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1 rounded hover:bg-black/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'muted' | 'subtle';
}

export const Card: React.FC<CardProps> = ({
  variant = 'surface',
  className = '',
  children,
  ...props
}) => (
  <div
    className={`kh-card rounded-2xl border border-[var(--kh-border)] ${
      variant === 'surface' ? 'bg-[var(--kh-surface)]' : 'bg-[var(--kh-surface-2)]'
    } text-[var(--kh-text)] ${className}`}
    {...props}
  >
    {children}
  </div>
);
