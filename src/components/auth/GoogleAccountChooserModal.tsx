import React, { useState } from 'react';
import { UserPlus, ArrowRight, X, Shield, Sparkles } from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { HOST_EMAIL } from '../../utils/apiClient';

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
  onSelectAccount: (account: { email: string; name: string }) => void;
  appName?: string;
  excludeHostEmail?: boolean;
  title?: string;
}

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

export const GoogleAccountChooserModal: React.FC<GoogleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  appName = 'KoHot',
  excludeHostEmail = false,
  title = 'Choose an account'
}) => {
  useStaticBackdropScrollLock(isOpen);

  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Authentic Google Account list matching Screenshot_20261024-213724_dfbb1fab.png
  const allAccounts: SocialAccountItem[] = [
    {
      name: 'Adeleye Seyi',
      email: HOST_EMAIL,
      avatarBg: 'bg-[#EA580C]',
      initial: 'A',
      badge: 'Host',
      isHost: true,
    },
    {
      name: '9ja puffs',
      email: '9japuffs@gmail.com',
      avatarBg: 'bg-[#2563EB]',
      initial: '9',
    },
    {
      name: 'Adeleye Oluwaseyi',
      email: 'dancreations03@gmail.com',
      avatarBg: 'bg-[#059669]',
      initial: 'A',
    },
    {
      name: 'Ekpe Victor Ejiga',
      email: 'ekpevictor0814@gmail.com',
      avatarBg: 'bg-[#0891B2]',
      initial: 'E',
    },
    {
      name: 'LUMNI',
      email: 'lumni026@gmail.com',
      avatarBg: 'bg-[#18181B] text-[10px] font-bold border border-white/20',
      initial: 'L',
    },
    {
      name: 'Grace Adeleye',
      email: 'graceadeleye2002@gmail.com',
      avatarBg: 'bg-[#78350F]',
      initial: 'G',
    },
    {
      name: 'KOHOT',
      email: 'kohot2026@gmail.com',
      avatarBg: 'bg-zinc-800 border border-amber-400/40 text-[10px] font-bold',
      initial: 'KH',
    },
  ];

  // Filter out host email if requested (e.g., during Create Class Album registration)
  const displayAccounts = excludeHostEmail
    ? allAccounts.filter((acc) => acc.email.toLowerCase() !== HOST_EMAIL.toLowerCase())
    : allAccounts;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setCustomError('Please enter a valid Google email address.');
      return;
    }
    const cleanName = customName.trim() || cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    onSelectAccount({ email: cleanEmail, name: cleanName });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md bg-[#242426] border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl text-white overflow-hidden max-h-[92vh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header - Brand Emblem and Title */}
        <div className="pt-6 pb-3 px-6 text-center shrink-0">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#323236] border border-white/15 flex items-center justify-center shadow-md relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 rounded-2xl blur-xs" />
            <span className="relative font-syne font-black text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-amber-300">
              KH
            </span>
          </div>

          <h3 className="font-syne font-bold text-xl sm:text-2xl text-white tracking-tight">
            {title}
          </h3>
          <p className="font-body text-xs text-zinc-400 mt-1">
            to continue to <span className="font-semibold text-zinc-200">{appName}</span>
          </p>
        </div>

        {/* Accounts List (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-white/5 no-scrollbar">
          {!showAddCustom ? (
            <>
              {displayAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    onSelectAccount({ email: account.email, name: account.name });
                    onClose();
                  }}
                  className="w-full py-3 px-3.5 flex items-center justify-between text-left hover:bg-white/[0.06] rounded-2xl transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full ${account.avatarBg || 'bg-zinc-700'} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-inner`}
                    >
                      {account.initial || account.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-syne font-semibold text-sm text-white group-hover:text-amber-200 flex items-center gap-2 truncate">
                        <span>{account.name}</span>
                        {account.badge && (
                          <span className="text-[10px] font-mono-tech uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">
                            {account.badge}
                          </span>
                        )}
                      </div>
                      <div className="font-mono-tech text-xs text-zinc-400 truncate mt-0.5">
                        {account.email}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {/* Add Another Account Option */}
              <button
                type="button"
                onClick={() => setShowAddCustom(true)}
                className="w-full py-3.5 px-3.5 flex items-center gap-3.5 text-left hover:bg-white/[0.06] rounded-2xl transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 text-zinc-300 group-hover:text-white group-hover:bg-white/15 flex items-center justify-center shrink-0 transition-colors">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-syne font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors">
                    Add another account
                  </span>
                  <p className="font-mono-tech text-[11px] text-zinc-500">
                    Sign in with any custom Google account
                  </p>
                </div>
              </button>
            </>
          ) : (
            /* Custom Account Entry Form */
            <form onSubmit={handleCustomSubmit} className="p-2 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-syne font-bold text-xs text-zinc-300">
                  Enter Google Account
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustom(false);
                    setCustomError(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Back to list
                </button>
              </div>

              {customError && (
                <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-mono-tech">
                  {customError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono-tech text-zinc-400 block">
                  Google Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="your.name@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white font-mono-tech text-xs focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono-tech text-zinc-400 block">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Oluwaseyi Adeleke"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white font-body text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-syne font-semibold hover:bg-white/15 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-[#d4af37] text-black text-xs font-syne font-bold hover:brightness-110 shadow-md cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Google Privacy Policy / Permissions Disclosure Footer */}
        <div className="p-4 sm:p-5 text-[11px] font-body text-zinc-400 leading-relaxed border-t border-white/10 bg-[#1d1d1f] shrink-0">
          To continue, Google will share your name, email address, and profile picture with {appName}. Before using {appName}, review its{' '}
          <span className="text-zinc-300 underline cursor-pointer">privacy policy</span> and{' '}
          <span className="text-zinc-300 underline cursor-pointer">terms of service</span>.
        </div>
      </div>
    </div>
  );
};
