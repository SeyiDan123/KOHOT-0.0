import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { fetchAuthConfig } from './apiClient';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

declare global {
  interface Window {
    google?: any;
  }
}

export interface OAuthVerifyPayload {
  provider: 'google' | 'apple';
  idToken?: string;
  accessToken?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

const DEFAULT_GOOGLE_CLIENT_ID =
  firebaseConfig.oAuthClientId ||
  '688826683374-i08rgemf0ghvdabmelefmplju2q0rauh.apps.googleusercontent.com';

let cachedGoogleClientId = DEFAULT_GOOGLE_CLIENT_ID;

if (typeof window !== 'undefined') {
  fetchAuthConfig()
    .then((cfg) => {
      if (cfg.googleClientId) {
        cachedGoogleClientId = cfg.googleClientId;
      }
    })
    .catch(() => {});
}

function loadGoogleGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is not available'));
      return;
    }
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(timer);
          resolve();
        } else if (attempts > 50) {
          clearInterval(timer);
          reject(new Error('Google Sign-In script timed out'));
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In script'));
    document.head.appendChild(script);
  });
}

/**
 * Opens the real Google Account Chooser popup ("Choose an account").
 * Invokes Google Identity Services tokenClient synchronously inside the click gesture
 * when loaded, with fallback to Firebase GoogleAuthProvider signInWithPopup.
 */
export async function triggerGoogleOAuthPopup(): Promise<OAuthVerifyPayload> {
  if (typeof window !== 'undefined' && !window.google?.accounts?.oauth2) {
    try {
      await loadGoogleGsiScript();
    } catch {}
  }

  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    return new Promise<OAuthVerifyPayload>((resolve, reject) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: cachedGoogleClientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
              return;
            }
            const accessToken = tokenResponse?.access_token;
            if (!accessToken) {
              reject(new Error('No access token returned from Google.'));
              return;
            }
            try {
              const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              const userInfo = userRes.ok ? await userRes.json() : {};
              resolve({
                provider: 'google',
                accessToken,
                email: userInfo.email || undefined,
                name: userInfo.name || userInfo.given_name || undefined,
                avatarUrl: userInfo.picture || undefined,
              });
            } catch {
              resolve({
                provider: 'google',
                accessToken,
              });
            }
          },
          error_callback: (err: any) => {
            reject(new Error(err?.message || err?.type || 'popup_closed'));
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        reject(err);
      }
    });
  }

  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const firebaseIdToken = await result.user.getIdToken();

  return {
    provider: 'google',
    idToken: firebaseIdToken || credential?.idToken,
    accessToken: credential?.accessToken,
    email: result.user.email || undefined,
    name: result.user.displayName || undefined,
    avatarUrl: result.user.photoURL || undefined,
  };
}

/**
 * Opens the real Apple Sign-In OAuth popup via Firebase OAuthProvider('apple.com')
 */
export async function triggerAppleOAuthPopup(): Promise<OAuthVerifyPayload> {
  const appleProvider = new OAuthProvider('apple.com');
  appleProvider.addScope('email');
  appleProvider.addScope('name');
  appleProvider.setCustomParameters({ locale: 'en' });

  const result = await signInWithPopup(auth, appleProvider);
  const credential = OAuthProvider.credentialFromResult(result);
  const firebaseIdToken = await result.user.getIdToken();

  return {
    provider: 'apple',
    idToken: firebaseIdToken || credential?.idToken,
    accessToken: credential?.accessToken,
    email: result.user.email || undefined,
    name: result.user.displayName || undefined,
    avatarUrl: result.user.photoURL || undefined,
  };
}
