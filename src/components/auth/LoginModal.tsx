import React, { useState } from 'react';
import { Mail, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { ClassSet, UserAccount } from '../../types';
import {
  authenticateWithOAuthPayload,
  HOST_EMAIL,
} from '../../utils/apiClient';
import {
  triggerGoogleOAuthPopup,
  triggerAppleOAuthPopup,
} from '../../utils/firebaseAuth';
import { GoogleAccountChooserModal } from './GoogleAccountChooserModal';
import { AppleAccountChooserModal } from './AppleAccountChooserModal';
import { Modal, Field, Input, Button, Notice, Card } from '../ui';

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
  brandName = 'KOHOT',
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);
  const [isAppleChooserOpen, setIsAppleChooserOpen] = useState(false);

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
    provider: 'google' | 'apple'
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

  const handleAppleSignInClick = async () => {
    setErrorMsg(null);
    try {
      const popupRes = await triggerAppleOAuthPopup();
      if (popupRes && (popupRes.email || popupRes.idToken || popupRes.accessToken)) {
        await handleOAuthPayload(
          {
            email: popupRes.email || '',
            name: popupRes.name || 'Album Admin',
            credential: popupRes.idToken || popupRes.accessToken,
            idToken: popupRes.idToken,
            accessToken: popupRes.accessToken,
          },
          'apple'
        );
        return;
      }
    } catch {
      // Fallback to account chooser modal
    }
    setIsAppleChooserOpen(true);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your registered album admin email address.');
      return;
    }
    await handleOAuthPayload(
      {
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        credential: `email-session-${cleanEmail}`,
      },
      'google'
    );
  };

  const demoAdminSet =
    availableSets.find((s) => s.id.includes('2026') && !s.deletedAt) ||
    availableSets.find((s) => !s.deletedAt);

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
        <div className="space-y-4">
          {errorMsg && <Notice variant="error">{errorMsg}</Notice>}

          {/* OAuth Sign-In Buttons */}
          <div className="space-y-2.5">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleGoogleSignInClick}
              disabled={isLoading}
              className="w-full justify-center font-semibold"
            >
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
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleAppleSignInClick}
              disabled={isLoading}
              className="w-full justify-center font-semibold"
            >
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              <span>Continue with Apple</span>
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--kh-border)]" />
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-[var(--kh-text-muted)]">
              or sign in with email
            </span>
            <div className="h-px flex-1 bg-[var(--kh-border)]" />
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <Field label="Album Admin Email" required>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--kh-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@university.edu.ng"
                  className="pl-10"
                />
              </div>
            </Field>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading || !emailInput.trim()}
              className="w-full"
            >
              <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Instant Demo Access */}
          {demoAdminSet && (
            <Card variant="subtle" className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--kh-text)]">
                  Quick Preview Sign-In
                </span>
                <span className="text-[11px] font-mono-tech text-[var(--kh-text-muted)]">
                  Instant Access
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onLoginSuccess({
                      id: demoAdminSet.currentAdminUserId || `rep-${demoAdminSet.id}`,
                      email: demoAdminSet.classRepEmail || 'rep@crownfield.edu.ng',
                      fullName: demoAdminSet.classRepName || 'Class Representative',
                      role: 'class_rep',
                      assignedSetId: demoAdminSet.id,
                      phone: demoAdminSet.classRepPhone,
                    });
                    onClose();
                  }}
                  className="justify-start"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--kh-accent-text)] shrink-0" />
                  <span className="truncate">Album Admin ({demoAdminSet.graduationYear})</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onLoginSuccess({
                      id: 'user-master-host',
                      email: HOST_EMAIL,
                      fullName: 'KoHot Master Host',
                      role: 'master_host',
                      masterToken: 'master-session',
                    });
                    onClose();
                  }}
                  className="justify-start"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--kh-success)] shrink-0" />
                  <span className="truncate">Master Host</span>
                </Button>
              </div>
            </Card>
          )}
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

      <AppleAccountChooserModal
        isOpen={isAppleChooserOpen}
        onClose={() => setIsAppleChooserOpen(false)}
        onSelectAccount={async (acct) => {
          setIsAppleChooserOpen(false);
          await handleOAuthPayload(
            {
              email: acct.email,
              name: acct.name,
              credential: (acct as any).credential || `apple-${acct.email}`,
            },
            'apple'
          );
        }}
      />
    </>
  );
};
