import React, { useState } from 'react';
import { X, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { HOST_EMAIL } from '../../utils/apiClient';

export const AppleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.03.62-2.67 1.37-.56.65-.98 1.71-.85 2.74 1.05.08 2.06-.54 2.6-1.24z" />
  </svg>
);

interface AppleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: { email: string; name: string }) => void;
  appName?: string;
  excludeHostEmail?: boolean;
}

export const AppleAccountChooserModal: React.FC<AppleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  appName = 'KoHot',
  excludeHostEmail = false,
}) => {
  useStaticBackdropScrollLock(isOpen);

  const [selectedEmail, setSelectedEmail] = useState<string>(
    excludeHostEmail ? 'adeleye.oluwaseyi@icloud.com' : HOST_EMAIL
  );
  const [selectedName, setSelectedName] = useState<string>(
    excludeHostEmail ? 'Oluwaseyi Adeleke' : 'Seyi Dan'
  );
  const [hideMyEmail, setHideMyEmail] = useState<boolean>(false);
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');

  if (!isOpen) return null;

  const appleAccounts = [
    ...(!excludeHostEmail
      ? [
          {
            name: 'Seyi Dan',
            email: HOST_EMAIL,
            appleId: 'seyidan03@icloud.com',
            isHost: true,
          },
        ]
      : []),
    {
      name: 'Oluwaseyi Adeleke',
      email: 'dancreations03@gmail.com',
      appleId: 'adeleye.oluwaseyi@icloud.com',
    },
    {
      name: 'Victor Ejiga',
      email: 'ekpevictor0814@gmail.com',
      appleId: 'victor.ejiga@icloud.com',
    },
  ];

  const handleContinue = () => {
    if (showCustomInput) {
      const cleanEmail = customEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) return;
      const cleanName = customName.trim() || 'Apple User';
      onSelectAccount({ email: cleanEmail, name: cleanName });
    } else {
      const effectiveEmail = hideMyEmail ? `privaterelay-${Date.now()}@privaterelay.appleid.com` : selectedEmail;
      onSelectAccount({ email: effectiveEmail, name: selectedName });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md bg-[#1C1C1E] border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl text-white overflow-hidden max-h-[92vh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Apple ID Header */}
        <div className="pt-6 pb-4 px-6 text-center shrink-0">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-black border border-white/15 flex items-center justify-center shadow-lg">
            <AppleIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-syne font-bold text-xl sm:text-2xl text-white tracking-tight">
            Sign in with Apple
          </h3>
          <p className="font-body text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Use your Apple ID to sign in to <span className="text-white font-semibold">{appName}</span>.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 pt-2 space-y-4 flex-1 overflow-y-auto">
          {!showCustomInput ? (
            <>
              {/* Account selection buttons */}
              <div className="space-y-2">
                {appleAccounts.map((acc) => {
                  const isSelected = selectedEmail === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        setSelectedEmail(acc.email);
                        setSelectedName(acc.name);
                      }}
                      className={`w-full p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-white/10 border-white/30 text-white'
                          : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-xs">
                          {acc.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-syne font-semibold text-xs text-white flex items-center gap-1.5">
                            <span>{acc.name}</span>
                            {acc.isHost && (
                              <span className="text-[9px] font-mono-tech uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full font-bold">
                                Host
                              </span>
                            )}
                          </div>
                          <div className="font-mono-tech text-[11px] text-zinc-400">
                            {acc.appleId || acc.email}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full py-2.5 text-center text-xs font-mono-tech text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  + Use a different Apple ID
                </button>
              </div>

              {/* Hide My Email Option */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-syne font-semibold text-xs text-white">Hide My Email</div>
                  <div className="font-body text-[11px] text-zinc-400">
                    Forward communications to your private inbox
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hideMyEmail}
                  onChange={(e) => setHideMyEmail(e.target.checked)}
                  className="w-4 h-4 accent-white rounded cursor-pointer"
                />
              </div>
            </>
          ) : (
            /* Custom Apple ID Form */
            <div className="space-y-3 animate-fadeIn">
              <input
                type="email"
                placeholder="Apple ID (e.g. name@icloud.com)"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white font-mono-tech text-xs focus:outline-none focus:border-white"
                autoFocus
              />
              <input
                type="text"
                placeholder="Full Name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white font-body text-xs focus:outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={() => setShowCustomInput(false)}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                &larr; Back to saved accounts
              </button>
            </div>
          )}

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-3.5 rounded-2xl bg-white text-black font-syne font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-lg active:scale-98"
          >
            Continue with Apple
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 text-[10px] text-zinc-500 text-center border-t border-white/10 shrink-0">
          KoHot uses Apple's secure credential verification. Passwords are never shared.
        </div>
      </div>
    </div>
  );
};
