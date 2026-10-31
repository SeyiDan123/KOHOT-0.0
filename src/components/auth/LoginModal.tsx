import React, { useState, useEffect } from 'react';
import { UserAccount, ClassSet } from '../../types';
import {
  AlertCircle,
  X,
  Clock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { authenticateWithOAuthPayload } from '../../utils/apiClient';
import {
  triggerGoogleOAuthPopup,
  triggerAppleOAuthPopup,
  OAuthVerifyPayload,
} from '../../utils/firebaseAuth';

export interface VerifiedSignupSession {
  email: string;
  fullName: string;
  name?: string;
  signupToken: string;
  provider: 'google' | 'apple';
  avatarUrl?: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSets: ClassSet[];
  onLoginSuccess: (user: UserAccount) => void;
  onOpenRegister?: (verifiedSession?: VerifiedSignupSession) => void;
  logoUrl?: string;
  brandName?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenRegister,
  logoUrl,
  brandName = 'KOHOT',
}) => {
  useStaticBackdropScrollLock(isOpen);

  const [activeProvider, setActiveProvider] = useState<'google' | 'apple' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [multipleAlbums, setMultipleAlbums] = useState<Array<any> | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<UserAccount | null>(null);
  const [newUserSession, setNewUserSession] = useState<VerifiedSignupSession | null>(null);

  const resetState = () => {
    setActiveProvider(null);
    setErrorMessage(null);
    setPendingMessage(null);
    setSuccessMessage(null);
    setMultipleAlbums(null);
    setVerifiedUser(null);
    setNewUserSession(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processOAuthVerification = async (oauthPayload: OAuthVerifyPayload) => {
    setErrorMessage(null);
    setPendingMessage(null);
    setSuccessMessage(null);
    setNewUserSession(null);

    try {
      const authRes = await authenticateWithOAuthPayload({
        provider: oauthPayload.provider,
        idToken: oauthPayload.idToken,
        accessToken: oauthPayload.accessToken,
        nameHint: oauthPayload.name,
      });

      if (authRes.success && authRes.user) {
        // Existing user with multiple albums
        if (authRes.albums && authRes.albums.length > 1) {
          setVerifiedUser(authRes.user);
          setMultipleAlbums(authRes.albums);
          setActiveProvider(null);
          return;
        }

        setSuccessMessage(`Welcome back, ${authRes.user.fullName}!`);
        setTimeout(() => {
          onLoginSuccess(authRes.user!);
          onClose();
        }, 450);
      } else {
        if (authRes.error === 'registration_pending') {
          setPendingMessage('Your founding class registration is awaiting Master Host approval.');
        } else if (authRes.error === 'no_registration') {
          if (authRes.email && authRes.signupToken) {
            setNewUserSession({
              email: authRes.email,
              fullName: authRes.name || '',
              name: authRes.name || '',
              signupToken: authRes.signupToken,
              provider: oauthPayload.provider,
              avatarUrl: oauthPayload.avatarUrl,
            });
          }
          setErrorMessage(
            `No class album is registered with ${authRes.email || 'this email'} yet. Click "Create Class Album" below to register your graduating class.`
          );
        } else if (
          authRes.error === 'missing_google_client_id' ||
          authRes.error === 'missing_session_secret' ||
          authRes.error === 'missing_host_email'
        ) {
          setErrorMessage("Sign-in isn't set up yet. Contact the administrator.");
        } else {
          setErrorMessage(authRes.message || 'Authentication failed. Please try again.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sign in failed. Please try again.');
    } finally {
      setActiveProvider(null);
    }
  };

  const handleContinueWithGoogle = async () => {
    setActiveProvider('google');
    setErrorMessage(null);
    setPendingMessage(null);
    try {
      const payload = await triggerGoogleOAuthPopup();
      await processOAuthVerification(payload);
    } catch (err: any) {
      setActiveProvider(null);
      const msg = String(err?.message || '');
      if (msg.includes('popup_closed') || msg.includes('popup-closed-by-user') || msg.includes('closed')) {
        return;
      }
      setErrorMessage(msg || 'Google sign-in could not be completed. Please try again.');
    }
  };

  const handleContinueWithApple = async () => {
    setActiveProvider('apple');
    setErrorMessage(null);
    setPendingMessage(null);
    try {
      const payload = await triggerAppleOAuthPopup();
      await processOAuthVerification(payload);
    } catch (err: any) {
      setActiveProvider(null);
      const code = String(err?.code || '');
      const msg = String(err?.message || '');
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.includes('closed')
      ) {
        return;
      }
      if (code === 'auth/operation-not-allowed') {
        setErrorMessage('Apple Sign-In is being configured for this domain. Please use Continue with Google.');
        return;
      }
      setErrorMessage('Apple sign-in could not be completed. Please try again.');
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
      id="login-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sign In to KoHot"
      className="kohot-dark-branded-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn touch-none overscroll-none select-none"
      onClick={onClose}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      {/* Reference-Matched Dark Sign In Card */}
      <div
        id="kohot-branded-signin-card"
        className="relative w-full max-w-[400px] rounded-[28px] p-7 sm:p-8 shadow-[0_28px_70px_rgba(0,0,0,0.92)] overflow-hidden border border-white/10 kohot-keep-border select-auto"
        style={{
          backgroundColor: '#16171b',
          color: '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Circular Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 kohot-keep-border text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Centered Website KoHot Logo inside the Card */}
        <div className="flex flex-col items-center justify-center pt-1 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#111216] border border-white/15 kohot-keep-border shadow-[0_12px_28px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center gap-1.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={brandName}
                className="w-9 h-9 object-contain"
              />
            ) : (
              <>
                <div className="w-5 h-5 bg-[#d4af37] rotate-45 transform shadow-[0_0_12px_rgba(212,175,55,0.45)]" />
                <span
                  className="kohot-keep-color font-syne font-black text-[9px] tracking-[0.18em] uppercase leading-none mt-0.5"
                  style={{ color: '#ffffff' }}
                >
                  {brandName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Welcome Back Heading & Subtitle */}
        <div className="text-center space-y-2 mb-7">
          <h2
            className="kohot-keep-color font-syne font-extrabold text-2xl sm:text-[28px] tracking-tight leading-tight"
            style={{ color: '#ffffff' }}
          >
            Welcome{' '}
            <span
              className="kohot-keep-color font-extrabold"
              style={{ color: '#e5b842' }}
            >
              Back
            </span>
          </h2>
          <p
            className="kohot-keep-color font-body text-xs sm:text-[13px] leading-relaxed"
            style={{ color: '#9ca3af' }}
          >
            Sign in to continue your departmental legacy
          </p>
        </div>

        {/* Multiple Albums Selector (if admin manages multiple cohorts) */}
        {multipleAlbums && verifiedUser && (
          <div className="mb-6 space-y-3 animate-fadeIn">
            <div className="p-3.5 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-xs">
              <div
                className="kohot-keep-color flex items-center gap-2 font-syne font-bold mb-1"
                style={{ color: '#ffffff' }}
              >
                <Layers className="w-4 h-4 text-[#d4af37]" />
                <span>Select Class Album</span>
              </div>
              <p
                className="kohot-keep-color text-[11px]"
                style={{ color: '#d4d4d8' }}
              >
                Choose which class album dashboard you want to open:
              </p>
            </div>

            <div
              data-modal-scrollable="true"
              className="space-y-2 max-h-56 overflow-y-auto no-scrollbar"
            >
              {multipleAlbums.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelectAlbumChoice(a)}
                  className="w-full text-left p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-[#d4af37]/40 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <div
                      className="kohot-keep-color font-syne font-bold text-xs group-hover:text-[#e5b842] transition-colors"
                      style={{ color: '#ffffff' }}
                    >
                      {a.classSetName || `${a.departmentId} (${a.graduationYear})`}
                    </div>
                    <div
                      className="kohot-keep-color font-mono-tech text-[10px]"
                      style={{ color: '#9ca3af' }}
                    >
                      Class of {a.graduationYear}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#e5b842] group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status & Security Notices */}
        {!multipleAlbums && (pendingMessage || errorMessage || successMessage) && (
          <div className="space-y-3 mb-5">
            {pendingMessage && (
              <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs font-mono-tech space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Registration Pending Approval</span>
                </div>
                <p
                  className="kohot-keep-color leading-relaxed text-[11px]"
                  style={{ color: '#fde68a' }}
                >
                  {pendingMessage}
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs font-mono-tech flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs font-mono-tech flex items-center gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Centered "Continue with Google" and "Continue with Apple" Buttons */}
        {!multipleAlbums && (
          <>
            <div className="space-y-3.5">
              {/* Continue with Google */}
              <button
                id="signin-continue-with-google-btn"
                type="button"
                disabled={activeProvider !== null}
                onClick={handleContinueWithGoogle}
                className="w-full py-4 px-5 rounded-2xl bg-[#1f2026] hover:bg-[#272830] active:scale-[0.99] border border-white/10 hover:border-white/20 kohot-keep-border transition-all flex items-center justify-center gap-3.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
              >
                {activeProvider === 'google' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#e5b842] shrink-0" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.6C4.6 19.8 8 22 12 22z"
                    />
                    <path
                      fill="#4A90E2"
                      d="M6.2 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H2.9C2.3 8.9 2 10.4 2 12s.3 3.1.9 4.4l3.3-2.6z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8 2 4.6 4.2 2.9 7.6l3.3 2.6c.8-2.5 3.1-4.3 5.8-4.3z"
                    />
                  </svg>
                )}
                <span
                  className="kohot-keep-color font-syne font-bold text-sm tracking-tight"
                  style={{ color: '#ffffff' }}
                >
                  {activeProvider === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
                </span>
              </button>

              {/* Continue with Apple */}
              <button
                id="signin-continue-with-apple-btn"
                type="button"
                disabled={activeProvider !== null}
                onClick={handleContinueWithApple}
                className="w-full py-4 px-5 rounded-2xl bg-[#1f2026] hover:bg-[#272830] active:scale-[0.99] border border-white/10 hover:border-white/20 kohot-keep-border transition-all flex items-center justify-center gap-3.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
              >
                {activeProvider === 'apple' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
                ) : (
                  <svg
                    className="w-5 h-5 text-white fill-current shrink-0"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                )}
                <span
                  className="kohot-keep-color font-syne font-bold text-sm tracking-tight"
                  style={{ color: '#ffffff' }}
                >
                  {activeProvider === 'apple' ? 'Connecting to Apple...' : 'Continue with Apple'}
                </span>
              </button>
            </div>

            {/* Security Line */}
            <div className="mt-6 flex items-center justify-center gap-2 text-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span
                className="kohot-keep-color font-body text-xs"
                style={{ color: '#9ca3af' }}
              >
                Instant single sign-on • Passwordless &amp; Encrypted
              </span>
            </div>
          </>
        )}

        {/* Bottom Divider & Create Class Album Link */}
        {!multipleAlbums && onOpenRegister && (
          <div className="mt-6 pt-5 border-t border-white/10 kohot-keep-border text-center">
            <span
              className="kohot-keep-color font-body text-xs"
              style={{ color: '#9ca3af' }}
            >
              Don&apos;t have an account?{' '}
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRegister(newUserSession || undefined);
              }}
              className="kohot-keep-color font-syne font-bold text-xs underline underline-offset-4 hover:opacity-80 cursor-pointer transition-opacity"
              style={{ color: '#ffffff' }}
            >
              Create Class Album
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
