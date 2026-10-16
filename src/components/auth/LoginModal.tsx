import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, ClassSet } from '../../types';
import { 
  LogIn, 
  AlertCircle, 
  X,
  Clock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { authenticateWithGoogleCredential, fetchAuthConfig } from '../../utils/apiClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSets: ClassSet[];
  onLoginSuccess: (user: UserAccount) => void;
  onOpenRegister?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenRegister,
}) => {
  useStaticBackdropScrollLock(isOpen);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [notRegisteredMessage, setNotRegisteredMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [multipleAlbums, setMultipleAlbums] = useState<Array<any> | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<UserAccount | null>(null);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Form Reset
  const resetState = () => {
    setIsSigningIn(false);
    setErrorMessage(null);
    setPendingMessage(null);
    setNotRegisteredMessage(null);
    setSuccessMessage(null);
    setMultipleAlbums(null);
    setVerifiedUser(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  // Real Google Identity Services (GSI) Button Integration
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    let timer: any;

    const initGsi = async () => {
      // 1. Fetch Google Client ID from Worker env (never rely on build-time env vars)
      const { googleClientId } = await fetchAuthConfig();
      if (isCancelled) return;

      if (!googleClientId) {
        setErrorMessage("Sign-in isn't set up yet.");
        return;
      }

      const setupGoogleBtn = () => {
        if (isCancelled) return;
        if (typeof window !== 'undefined' && (window as any).google?.accounts?.id && googleBtnContainerRef.current) {
          try {
            (window as any).google.accounts.id.initialize({
              client_id: googleClientId,
              callback: (response: any) => {
                if (response?.credential) {
                  handleProcessGoogleAuth(response.credential);
                } else {
                  console.error('[GoogleAuth error] No credential returned from Google Identity Services');
                  setErrorMessage('Sign in failed. Please try again.');
                }
              },
            });

            // Render official Google Sign-in button
            googleBtnContainerRef.current.innerHTML = '';
            (window as any).google.accounts.id.renderButton(googleBtnContainerRef.current, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'signin_with',
              width: 280,
            });
          } catch (e: any) {
            console.error('[GoogleAuth error] Failed to initialize Google button:', e);
          }
        } else {
          timer = setTimeout(setupGoogleBtn, 300);
        }
      };

      setupGoogleBtn();
    };

    initGsi();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcessGoogleAuth = async (credential: string) => {
    setIsSigningIn(true);
    setErrorMessage(null);
    setPendingMessage(null);
    setNotRegisteredMessage(null);
    setSuccessMessage(null);

    try {
      const authRes = await authenticateWithGoogleCredential(credential);

      if (authRes.success && authRes.user) {
        if (authRes.albums && authRes.albums.length > 1) {
          // Multiple albums associated with this email
          setVerifiedUser(authRes.user);
          setMultipleAlbums(authRes.albums);
          setIsSigningIn(false);
          return;
        }

        setSuccessMessage(`Welcome back, ${authRes.user.fullName}!`);
        setTimeout(() => {
          onLoginSuccess(authRes.user!);
          onClose();
        }, 500);
      } else {
        // Log the real error and status in the browser console
        console.error('[GoogleAuth error]', {
          status: authRes.status,
          error: authRes.error,
          message: authRes.message,
        });

        // Friendly user message based on error code
        if (authRes.error === 'registration_pending') {
          setPendingMessage('Your registration is awaiting approval.');
        } else if (authRes.error === 'not_registered') {
          setNotRegisteredMessage(
            'No class album is registered with this email. Please register through Create Class Album.'
          );
        } else if (
          authRes.error === 'missing_google_client_id' ||
          authRes.error === 'missing_session_secret' ||
          authRes.error === 'missing_host_email' ||
          authRes.error === 'database_not_set_up'
        ) {
          setErrorMessage("Sign-in isn't set up yet. Contact the administrator.");
        } else {
          setErrorMessage('Sign in failed. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('[GoogleAuth error] Unhandled exception:', err);
      setErrorMessage('Sign in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSelectAlbumChoice = (album: any) => {
    if (!verifiedUser) return;
    const userWithSelectedAlbum: UserAccount = {
      ...verifiedUser,
      assignedSetId: album.id,
    };
    onLoginSuccess(userWithSelectedAlbum);
    onClose();
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
          <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center mx-auto mb-3 shadow-inner">
            <LogIn className="w-6 h-6" />
          </div>
          <h2 className="font-syne font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
            Sign In
          </h2>
          <p className="font-body text-xs text-slate-600 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Access your administrative dashboard with your verified Google Account.
          </p>
        </div>

        {/* Multiple Albums Selector */}
        {multipleAlbums && verifiedUser && (
          <div className="mb-6 space-y-3 animate-fadeIn">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-[#d4af37]/40 text-xs">
              <div className="flex items-center gap-2 font-syne font-bold text-slate-900 dark:text-white mb-1">
                <Layers className="w-4 h-4 text-[#d4af37]" />
                <span>Multiple Albums Registered</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300">
                Select which class album dashboard you would like to manage:
              </p>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {multipleAlbums.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelectAlbumChoice(a)}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <div className="font-syne font-bold text-xs text-slate-900 dark:text-white group-hover:text-[#d4af37] transition-colors">
                      {a.classSetName || `${a.departmentId} (${a.graduationYear})`}
                    </div>
                    <div className="font-mono-tech text-[10px] text-slate-500 dark:text-zinc-400">
                      Class of {a.graduationYear}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#d4af37] group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {!multipleAlbums && (
          <div className="space-y-3 mb-6">
            {/* Signing you in... waiting indicator */}
            {isSigningIn && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs font-mono-tech flex items-center justify-center gap-2.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
                <span>Signing you in...</span>
              </div>
            )}

            {/* Pending registration notice */}
            {pendingMessage && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs font-mono-tech space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <Clock className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Registration Pending Approval</span>
                </div>
                <p className="leading-relaxed text-[11px] text-amber-900 dark:text-amber-200/90">
                  {pendingMessage}
                </p>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono-tech pt-1 border-t border-amber-200 dark:border-amber-800/40">
                  The Master Host reviews all founding class requests. Access will activate once approved.
                </div>
              </div>
            )}

            {/* Not registered notice */}
            {notRegisteredMessage && (
              <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-mono-tech space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>No Registration Found</span>
                </div>
                <p className="leading-relaxed text-[11px] text-zinc-600 dark:text-zinc-300">
                  {notRegisteredMessage}
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

            {/* Configuration or generic sign-in error */}
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-mono-tech flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success message */}
            {successMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-mono-tech flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Official Google Identity Services Sign In Button Container */}
        {!multipleAlbums && (
          <div className="flex flex-col items-center justify-center py-2">
            <div ref={googleBtnContainerRef} id="official-google-signin-btn-container" className="flex justify-center" />
          </div>
        )}
      </div>
    </div>
  );
};
