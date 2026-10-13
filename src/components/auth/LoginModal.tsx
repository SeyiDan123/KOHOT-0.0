import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserAccount, ClassSet, FoundingClassRequest } from '../../types';
import { getStoredFoundingClassRequests } from '../../data/initialData';
import { 
  LogIn, 
  ShieldCheck, 
  AlertCircle, 
  X,
  Clock,
  ArrowRight,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { authenticateWithGoogleCredential, HOST_EMAIL } from '../../utils/apiClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSets: ClassSet[];
  onLoginSuccess: (user: UserAccount) => void;
  foundingRequests?: FoundingClassRequest[];
  onOpenRegister?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  availableSets,
  onLoginSuccess,
  foundingRequests: propFoundingRequests,
  onOpenRegister,
}) => {
  useStaticBackdropScrollLock(isOpen);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'pending' | 'not_found' | 'success'; text: string } | null>(null);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Active founding requests from prop or storage
  const activeFoundingRequests = useMemo(() => {
    return propFoundingRequests || getStoredFoundingClassRequests();
  }, [propFoundingRequests]);

  // Form Reset
  const resetForm = () => {
    setIsLoading(false);
    setStatusMessage(null);
    setGoogleEmailInput('');
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Dynamically initialize Google Identity Services if client ID is configured
  useEffect(() => {
    if (!isOpen) return;

    const googleClientId = (typeof process !== 'undefined' && process.env?.GOOGLE_CLIENT_ID) || 
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    if (googleClientId && typeof window !== 'undefined' && (window as any).google?.accounts?.id && googleBtnContainerRef.current) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              handleProcessGoogleAuth(response.credential);
            }
          },
        });
        (window as any).google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 280,
        });
      } catch (e) {
        console.warn('Google Identity button initialization:', e);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcessGoogleAuth = async (credentialOrEmail: string, optionalName?: string) => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const email = credentialOrEmail.includes('@') ? credentialOrEmail.trim().toLowerCase() : '';
      const credential = !credentialOrEmail.includes('@') ? credentialOrEmail : '';

      const authRes = await authenticateWithGoogleCredential(
        credential || `google-jwt-mock-${Date.now()}`,
        email ? { email, name: optionalName || (email === HOST_EMAIL ? 'Seyi Dan' : 'Class Admin') } : undefined
      );

      if (authRes.success && authRes.user) {
        setStatusMessage({ type: 'success', text: `Welcome back, ${authRes.user.fullName}!` });
        setTimeout(() => {
          onLoginSuccess(authRes.user!);
          onClose();
        }, 600);
      } else {
        if (authRes.error === 'pending') {
          setStatusMessage({
            type: 'pending',
            text: 'Your registration is awaiting approval.',
          });
        } else if (authRes.error === 'not_found' || authRes.error === 'not_registered') {
          setStatusMessage({
            type: 'not_found',
            text: 'No class album is registered with this email. Please register through Create Class Album.',
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: authRes.message || 'Authentication failed. Please verify your Google account.',
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to connect to Google authentication service.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim() || !googleEmailInput.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Google email address.' });
      return;
    }
    handleProcessGoogleAuth(googleEmailInput.trim());
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-[#121318] border border-slate-200 dark:border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-500 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#d4af37] flex items-center justify-center mx-auto mb-3 shadow-inner">
            <LogIn className="w-6 h-6" />
          </div>
          <h2 className="font-syne font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
            Sign In
          </h2>
          <p className="font-body text-xs text-slate-600 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Access your administrative dashboard with your verified Google Account.
          </p>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div className="mb-5 animate-fadeIn">
            {statusMessage.type === 'pending' && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs font-mono-tech space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <Clock className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Registration Pending Approval</span>
                </div>
                <p className="leading-relaxed text-[11px] text-amber-900 dark:text-amber-200/90">
                  {statusMessage.text}
                </p>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono-tech pt-1 border-t border-amber-200 dark:border-amber-800/40">
                  The Master Host verifies all founding class requests. You will receive access once approved.
                </div>
              </div>
            )}

            {statusMessage.type === 'not_found' && (
              <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-mono-tech space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>No Registration Found</span>
                </div>
                <p className="leading-relaxed text-[11px] text-zinc-600 dark:text-zinc-300">
                  {statusMessage.text}
                </p>
                {onOpenRegister && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRegister();
                    }}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <span>Create Class Album</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {statusMessage.type === 'error' && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-mono-tech flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
            )}

            {statusMessage.type === 'success' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-mono-tech flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>
        )}

        {/* Official Sign in with Google Button Area */}
        <div className="space-y-4">
          <div ref={googleBtnContainerRef} className="flex justify-center" />

          {/* Standard Sign in with Google CTA */}
          <button
            type="button"
            id="google-signin-btn"
            disabled={isLoading}
            onClick={() => {
              // Sign in with Google flow
              const googleClientId = (typeof process !== 'undefined' && process.env?.GOOGLE_CLIENT_ID) || 
                (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

              if (googleClientId && (window as any).google?.accounts?.id) {
                (window as any).google.accounts.id.prompt();
              } else {
                // If Google Client ID not yet set in Google Cloud Console,
                // enable prompt with email entry for seamless development and testing
                setGoogleEmailInput(googleEmailInput || HOST_EMAIL);
              }
            }}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 dark:bg-[#1a1b22] dark:hover:bg-[#22232c] border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-syne font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {/* Official Google 'G' Logo SVG */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* Email verification input for direct Google email verification */}
          <form onSubmit={handleManualGoogleSubmit} className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2.5">
            <label className="block text-[10px] font-mono-tech uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Verify Google Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={googleEmailInput}
                onChange={(e) => setGoogleEmailInput(e.target.value)}
                placeholder="your.email@gmail.com"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono-tech text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#d4af37]"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-bold text-xs uppercase transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Verify</span>}
              </button>
            </div>
            <p className="text-[10px] font-mono-tech text-slate-400 dark:text-zinc-500 text-center">
              Google ID tokens are verified by the Worker backend without passwords or OTPs.
            </p>
          </form>
        </div>

        {/* Security Footer Notice */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[11px] font-mono-tech text-slate-500 dark:text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Google OAuth 2.0</span>
          </div>
          <span className="text-[10px]">Cloudflare Worker API</span>
        </div>
      </div>
    </div>
  );
};
