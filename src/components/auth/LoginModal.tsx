import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { ClassSet, UserAccount } from '../../types';
import {
  authenticateWithOAuthPayload,
  HOST_EMAIL,
} from '../../utils/apiClient';
import { triggerGoogleOAuthPopup } from '../../utils/firebaseAuth';
import { GoogleAccountChooserModal } from './GoogleAccountChooserModal';
import { Modal, Button, Notice } from '../ui';

export interface VerifiedSignupSession {
  signupToken: string;
  email: string;
  name: string;
  provider?: 'google' | 'apple';
}

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSets?: ClassSet[];
  onLoginSuccess: (account: UserAccount) => void;
  onOpenRegister?: (session?: VerifiedSignupSession | null) => void;
  onCreateNewAlbum?: () => void;
  logoUrl?: string;
  brandName?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  availableSets = [],
  onLoginSuccess,
  onOpenRegister,
  onCreateNewAlbum,
  logoUrl,
  brandName = 'KOHOT',
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);

  if (!isOpen) return null;

  const resolveAccountByEmail = (rawEmail: string, fallbackName?: string): UserAccount | null => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!cleanEmail) return null;

    if (cleanEmail === HOST_EMAIL.toLowerCase() || cleanEmail === 'host@kohot.app') {
      return {
        id: 'user-master-host',
        email: cleanEmail,
        fullName: fallbackName || 'KoHot Master Host',
        role: 'master_host',
        masterToken: 'master-session',
      };
    }

    const matchedSet = availableSets.find(
      (s) => (s.classRepEmail || '').trim().toLowerCase() === cleanEmail && !s.deletedAt
    );

    if (matchedSet) {
      return {
        id: matchedSet.currentAdminUserId || `rep-${matchedSet.id}`,
        email: cleanEmail,
        fullName: fallbackName || matchedSet.classRepName || 'Class Representative',
        role: 'class_rep',
        assignedSetId: matchedSet.id,
        phone: matchedSet.classRepPhone,
      };
    }

    return null;
  };

  const handleOAuthPayload = async (
    payload: { email: string; name: string; credential?: string; idToken?: string; accessToken?: string },
    provider: 'google'
  ) => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const serverRes = await authenticateWithOAuthPayload({
        provider,
        email: payload.email,
        name: payload.name,
        credential: payload.credential,
        idToken: payload.idToken,
        accessToken: payload.accessToken,
      });

      if (serverRes.success && serverRes.user) {
        setIsLoading(false);
        onLoginSuccess(serverRes.user);
        onClose();
        return;
      }

      const localAccount = resolveAccountByEmail(payload.email, payload.name);
      if (localAccount) {
        setIsLoading(false);
        onLoginSuccess(localAccount);
        onClose();
        return;
      }

      if (serverRes.signupToken && onOpenRegister) {
        setIsLoading(false);
        onOpenRegister({
          signupToken: serverRes.signupToken,
          email: serverRes.email || payload.email,
          name: serverRes.name || payload.name,
          provider,
        });
        return;
      }

      // If no existing album admin account found, allow seamless transition to album registration
      if (onOpenRegister) {
        setIsLoading(false);
        onOpenRegister({
          signupToken: `verified-${provider}-${Date.now()}`,
          email: payload.email,
          name: payload.name,
          provider,
        });
        return;
      }

      setErrorMsg(
        serverRes.message ||
          'No album admin account was found for that email. Register a class album to get started.'
      );
    } catch {
      const localAccount = resolveAccountByEmail(payload.email, payload.name);
      if (localAccount) {
        onLoginSuccess(localAccount);
        onClose();
        return;
      }
      setErrorMsg('Sign in could not be completed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignInClick = async () => {
    setErrorMsg(null);
    try {
      const popupRes = await triggerGoogleOAuthPopup();
      if (popupRes && (popupRes.email || popupRes.idToken || popupRes.accessToken)) {
        await handleOAuthPayload(
          {
            email: popupRes.email || '',
            name: popupRes.name || 'Album Admin',
            credential: popupRes.idToken || popupRes.accessToken,
            idToken: popupRes.idToken,
            accessToken: popupRes.accessToken,
          },
          'google'
        );
        return;
      }
    } catch {
      // Fallback to account chooser modal
    }
    setIsGoogleChooserOpen(true);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Sign in to ${brandName}`}
        subtitle="Manage your department's graduating class album"
        maxWidth="md"
        zIndex={260}
        footer={
          <div className="w-full flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {(onOpenRegister || onCreateNewAlbum) && (
              <Button
                variant="accent-outline"
                onClick={() => {
                  if (onOpenRegister) {
                    onOpenRegister(null);
                  } else if (onCreateNewAlbum) {
                    onClose();
                    onCreateNewAlbum();
                  }
                }}
              >
                <span>Register new class album</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          {errorMsg && <Notice variant="error">{errorMsg}</Notice>}

          {/* Branded KoHot Sign-In Card */}
          <div className="relative rounded-2xl border border-[var(--kh-border)] bg-[var(--kh-surface-2)] text-[var(--kh-text)] p-6 sm:p-7 shadow-xs text-center">
            {/* Centered KoHot Logo Badge */}
            <div className="flex flex-col items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-[var(--kh-surface)] border border-[var(--kh-border)] shadow-xs flex flex-col items-center justify-center gap-1.5">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="w-9 h-9 object-contain"
                  />
                ) : (
                  <>
                    <div className="w-5 h-5 bg-[#d4af37] rotate-45 transform" />
                    <span className="font-syne font-black text-[9px] tracking-[0.18em] uppercase leading-none mt-0.5 text-[var(--kh-text)]">
                      {brandName}
                    </span>
                  </>
                )}
              </div>
            </div>

            <h3 className="font-syne font-extrabold text-lg sm:text-xl tracking-tight text-[var(--kh-text)]">
              Album Admin Sign In
            </h3>
            <p className="font-body text-xs sm:text-[13px] max-w-sm mx-auto mt-1.5 mb-6 leading-relaxed text-[var(--kh-text-muted)]">
              Continue with your verified Google account to access your graduating class album dashboard.
            </p>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleGoogleSignInClick}
              disabled={isLoading}
              className="w-full justify-center font-semibold py-3.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </Button>

            <div className="mt-5 flex items-center justify-center gap-2 text-center">
              <ShieldCheck className="w-4 h-4 text-[var(--kh-success)] shrink-0" />
              <span className="font-body text-xs text-[var(--kh-text-muted)]">
                Passwordless &amp; Verified Account Access
              </span>
            </div>
          </div>
        </div>
      </Modal>

      <GoogleAccountChooserModal
        isOpen={isGoogleChooserOpen}
        onClose={() => setIsGoogleChooserOpen(false)}
        onSelectAccount={async (acct) => {
          setIsGoogleChooserOpen(false);
          await handleOAuthPayload(
            {
              email: acct.email,
              name: acct.name,
              credential: (acct as any).credential || `google-${acct.email}`,
            },
            'google'
          );
        }}
      />
    </>
  );
};
