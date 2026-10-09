/**
 * Google Drive Shortcut Service for KoHot Digital Class Albums.
 * Saves live Class Album bookmarks directly to Google Drive as clickable shortcuts.
 *
 * Scopes used: https://www.googleapis.com/auth/drive.file (least privilege)
 *
 * File structure in Google Drive:
 * Creates an official shortcut pointing to the live KoHot album URL.
 * Google Drive native shortcut MIME: application/vnd.google-apps.shortcut (target: URL via internetShortcut)
 * For web-link bookmarks, Google Drive supports web link shortcuts:
 * MIME: application/vnd.google-apps.shortcut (or internetShortcut / url description)
 * We also supply the standard web bookmark payload with exact URL and clean title.
 */

import { ClassSet } from '../types';
import { getAlbumUrl } from './urlHelper';
import firebaseConfig from '../../firebase-applet-config.json';

const GOOGLE_CLIENT_ID = firebaseConfig.oAuthClientId || '688826683374-i08rgemf0ghvdabmelefmplju2q0rauh.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export interface DriveSaveResult {
  success: boolean;
  fileId?: string;
  folderId?: string;
  folderName?: string;
  driveViewUrl?: string;
  folderViewUrl?: string;
  error?: string;
  cancelled?: boolean;
}

let cachedAccessToken: string | null = null;
let tokenExpiryTime: number = 0;

/**
 * Ensures Google Identity Services (GSI) script is loaded in document head
 */
export async function loadGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.google?.accounts?.oauth2) return true;

  const existingScript = document.getElementById('google-gsi-client');
  if (existingScript) {
    return new Promise((resolve) => {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Requests OAuth access token via Google Identity Services Token Client
 */
export async function getDriveAccessToken(): Promise<string> {
  // Check if active cached token exists
  if (cachedAccessToken && Date.now() < tokenExpiryTime - 60000) {
    return cachedAccessToken;
  }

  const scriptLoaded = await loadGsiScript();
  if (!scriptLoaded || !window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services client is not available in your browser.');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (resp) => {
          if (resp.error) {
            if (resp.error === 'access_denied' || resp.error.includes('denied') || resp.error.includes('cancel')) {
              const cancelErr = new Error('PERMISSION_CANCELLED');
              (cancelErr as any).cancelled = true;
              reject(cancelErr);
            } else {
              reject(new Error(resp.error));
            }
            return;
          }
          if (!resp.access_token) {
            reject(new Error('No access token received from Google.'));
            return;
          }
          cachedAccessToken = resp.access_token;
          // Standard Google OAuth token lasts 3600 seconds
          tokenExpiryTime = Date.now() + 3500 * 1000;
          resolve(resp.access_token);
        },
        error_callback: (err: any) => {
          const isCancel = err?.type === 'popup_closed' || err?.error === 'popup_closed_by_user';
          const cancelErr = new Error(isCancel ? 'PERMISSION_CANCELLED' : 'Google Authentication was cancelled or blocked.');
          (cancelErr as any).cancelled = isCancel;
          reject(cancelErr);
        },
      });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Saves a live Class Album as an instant clickable web shortcut inside Google Drive.
 * Clicking this item in Google Drive opens the exact live KoHot album instantly.
 */
export async function saveAlbumShortcutToDrive(currentSet: ClassSet): Promise<DriveSaveResult> {
  try {
    const liveAlbumUrl = getAlbumUrl(currentSet);
    const token = await getDriveAccessToken();

    const shortcutTitle = `${currentSet.departmentName} (Class of ${currentSet.graduationYear}) — KoHot Class Album.html`;
    const shortcutDescription = `Official permanent live Class Album on KoHot: ${liveAlbumUrl}`;

    // Create an instant HTML bookmark with immediate redirect and graceful fallback button
    // When opened or tapped in Google Drive, it immediately takes the user to their live KoHot album.
    const fileContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${currentSet.departmentName} — KoHot Class Album</title>
  <meta http-equiv="refresh" content="0; url=${liveAlbumUrl}">
  <script>
    try { window.location.replace("${liveAlbumUrl}"); } catch (e) { window.location.href = "${liveAlbumUrl}"; }
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #050608;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: #111318;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .logo {
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .diamond {
      width: 20px;
      height: 20px;
      background: #ffffff;
      transform: rotate(45deg);
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 13px;
      color: #9ca3af;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background: #ffffff;
      color: #050608;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 14px 28px;
      border-radius: 9999px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><div class="diamond"></div></div>
    <h1>${currentSet.departmentName}</h1>
    <p>Opening your permanent Class Album on KoHot...</p>
    <a href="${liveAlbumUrl}" class="btn" target="_top">Open Class Album</a>
  </div>
</body>
</html>`;

    // 1. Create or ensure pretitled folder in user's Google Drive
    const folderName = `KoHot Archives — ${currentSet.departmentName} (Class of ${currentSet.graduationYear})`;
    let targetFolderId: string | undefined = undefined;
    let targetFolderViewUrl: string | undefined = undefined;

    try {
      const folderRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            description: `Official KoHot Permanent Digital Archive for ${currentSet.departmentName}`,
          }),
        }
      );
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        targetFolderId = folderData.id;
        targetFolderViewUrl = folderData.webViewLink || `https://drive.google.com/drive/folders/${folderData.id}`;
      }
    } catch {
      // If folder creation fails, save to root as graceful fallback
    }

    const metadata: Record<string, any> = {
      name: shortcutTitle,
      description: shortcutDescription,
      mimeType: 'text/html',
      properties: {
        kohotAlbumId: currentSet.id,
        targetUrl: liveAlbumUrl,
        classSetName: currentSet.classSetName,
        departmentName: currentSet.departmentName,
      },
      ...(targetFolderId ? { parents: [targetFolderId] } : {}),
    };

    // Multipart upload to Google Drive v3 files endpoint
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Google Drive API responded with status ${response.status}`);
    }

    const file = await response.json();

    return {
      success: true,
      fileId: file.id,
      folderId: targetFolderId,
      folderName: targetFolderId ? folderName : undefined,
      driveViewUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      folderViewUrl: targetFolderViewUrl,
    };
  } catch (error: any) {
    if (error?.cancelled || error?.message === 'PERMISSION_CANCELLED') {
      return {
        success: false,
        cancelled: true,
        error: 'Google Drive permission was cancelled. You can try again whenever you wish.',
      };
    }

    console.error('Failed to save to Google Drive:', error);
    return {
      success: false,
      cancelled: false,
      error: error?.message || 'Unable to connect to Google Drive. Please check your connection and try again.',
    };
  }
}
