import React, { useState, useEffect } from 'react';
import { Mail, X, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { HOST_EMAIL } from '../../utils/apiClient';
import { triggerGoogleOAuthPopup } from '../../utils/firebaseAuth';

export interface SocialAccountItem {
  name: string;
  email: string;
  avatarBg?: string;
  initial?: string;
  badge?: string;
  isHost?: boolean;
}

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: {
    email: string;
    name: string;
    credential?: string;
    idToken?: string;
    accessToken?: string;
  }) => void;
  appName?: string;
  logoUrl?: string;
  excludeHostEmail?: boolean;
  title?: string;
}

const DEVICE_ACCOUNTS_STORAGE_KEY = 'kohot_device_google_accounts_v2';

// Google Official 4-Color Icon
export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

function loadRememberedDeviceAccounts(): SocialAccountItem[] {
  try {
    const raw = localStorage.getItem(DEVICE_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a) => a && typeof a.email === 'string' && a.email.includes('@'));
  } catch {
    return [];
  }
}

function saveRememberedDeviceAccount(account: { email: string; name: string }) {
  try {
    const cleanEmail = account.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return;
    const existing = loadRememberedDeviceAccounts().filter(
      (a) => a.email.toLowerCase() !== cleanEmail
    );
    const next: SocialAccountItem[] = [
      {
        name: account.name.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        avatarBg: 'bg-[#2563EB]',
        initial: (account.name.trim() || cleanEmail).charAt(0).toUpperCase(),
      },
      ...existing,
    ].slice(0, 3);
    localStorage.setItem(DEVICE_ACCOUNTS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export const GoogleAccountChooserModal: React.FC<GoogleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  appName = 'KoHot',
  logoUrl,
  excludeHostEmail = false,
  title = 'Continue with Email',
}) => {
  useStaticBackdropScrollLock(isOpen);

  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isLaunchingPopup, setIsLaunchingPopup] = useState(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<SocialAccountItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      const saved = loadRememberedDeviceAccounts();
      const filtered = excludeHostEmail
        ? saved.filter((acc) => acc.email.toLowerCase() !== HOST_EMAIL.toLowerCase())
        : saved;
      setRememberedAccounts(filtered);
      setCustomError(null);
    }
  }, [isOpen, excludeHostEmail]);

  if (!isOpen) return null;

  const handleChooseAccount = (account: {
    email: string;
    name: string;
    credential?: string;
    idToken?: string;
    accessToken?: string;
  }) => {
    saveRememberedDeviceAccount({ email: account.email, name: account.name });
    onSelectAccount(account);
    onClose();
  };

  const handleLaunchDeviceGooglePopup = async () => {
    setCustomError(null);
    setIsLaunchingPopup(true);
    try {
      const popupRes = await triggerGoogleOAuthPopup();
      if (popupRes && (popupRes.email || popupRes.idToken || popupRes.accessToken)) {
        handleChooseAccount({
          email: (popupRes.email || '').trim().toLowerCase(),
          name: popupRes.name || 'Album Admin',
          credential: popupRes.idToken || popupRes.accessToken,
          idToken: popupRes.idToken,
          accessToken: popupRes.accessToken,
        });
        return;
      }
    } catch {
      // Fallback to direct email input below
    } finally {
      setIsLaunchingPopup(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setCustomError('Please enter a valid email address.');
      return;
    }
    if (excludeHostEmail && cleanEmail === HOST_EMAIL.toLowerCase()) {
      setCustomError('Please use a graduating Class Representative email address.');
      return;
    }
    const cleanName =
      customName.trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    handleChooseAccount({ email: cleanEmail, name: cleanName });
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-[#242426] border border-slate-200 dark:border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl text-slate-900 dark:text-white overflow-hidden max-h-[92vh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-slate-300 dark:bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-6 text-center shrink-0 border-b border-slate-100 dark:border-white/5">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-50 dark:bg-[#1a1b20] border border-slate-200 dark:border-white/15 flex flex-col items-center justify-center gap-1.5 shadow-sm relative">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={appName}
                className="w-9 h-9 object-contain"
              />
            ) : (
              <>
                <div className="w-5 h-5 bg-[#d4af37] rotate-45 transform" />
                <span className="kohot-keep-color font-syne font-black text-[9px] tracking-[0.18em] uppercase leading-none mt-0.5 text-slate-900 dark:text-white">
                  KOHOT
                </span>
              </>
            )}
          </div>

          <h3 className="kohot-keep-color font-syne font-bold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="kohot-keep-color font-body text-xs text-slate-600 dark:text-zinc-300 mt-1">
            Enter your email address to continue to{' '}
            <span className="kohot-keep-color font-semibold text-slate-900 dark:text-white">
              {appName}
            </span>
          </p>
        </div>

        {/* Direct Email Capture Form */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 no-scrollbar">
          <form onSubmit={handleCustomSubmit} className="space-y-4">
            {customError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-200 text-xs font-mono-tech">
                {customError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="kohot-keep-color text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 block">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="your.email@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-mono-tech text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="kohot-keep-color text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-zinc-300 block">
                Full Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Oluwaseyi Adeleke"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-body text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black text-xs sm:text-sm font-syne font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Optional Device Google Popup */}
          <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2.5">
            <button
              type="button"
              onClick={handleLaunchDeviceGooglePopup}
              disabled={isLaunchingPopup}
              className="w-full py-2.5 px-3.5 flex items-center justify-center gap-2.5 text-center bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 rounded-xl transition-all cursor-pointer"
            >
              {isLaunchingPopup ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
              ) : (
                <GoogleIcon className="w-4 h-4" />
              )}
              <span className="kohot-keep-color font-syne font-semibold text-xs text-slate-800 dark:text-zinc-200">
                Verify via Google Popup
              </span>
            </button>

            {rememberedAccounts.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <div className="text-[10px] font-mono-tech uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1">
                  Recently used on this device
                </div>
                {rememberedAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() =>
                      handleChooseAccount({ email: account.email, name: account.name })
                    }
                    className="w-full py-2 px-3 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono-tech text-xs text-slate-700 dark:text-zinc-300 truncate">
                          {account.email}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 text-[11px] font-body text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1d1d1f] shrink-0 text-center">
          Passwordless verification • Your email is used to manage and recover your class album.
        </div>
      </div>
    </div>
  );
};
