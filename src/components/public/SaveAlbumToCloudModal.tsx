import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { 
  X, 
  Cloud, 
  HardDrive, 
  ExternalLink, 
  Download, 
  Check, 
  Copy, 
  Bell, 
  ShieldCheck, 
  Loader2, 
  FolderDown, 
  Folder, 
  QrCode, 
  Link as LinkIcon, 
  CheckCircle2 
} from 'lucide-react';
import { ClassSet } from '../../types';
import { getAlbumUrl, copyUrlToClipboard } from '../../utils/urlHelper';
import { saveAlbumShortcutToDrive, DriveSaveResult } from '../../utils/googleDriveHelper';
import { useFeedback } from '../common/FeedbackSystem';
import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';
import { getTheme } from '../../utils/theme';

interface SaveAlbumToCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
  isLightMode?: boolean;
}

export const SaveAlbumToCloudModal: React.FC<SaveAlbumToCloudModalProps> = ({
  isOpen,
  onClose,
  currentSet,
  isLightMode: propIsLightMode,
}) => {
  useStaticBackdropScrollLock(isOpen);
  const { showSuccess, showError } = useFeedback();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isSavingGoogleDrive, setIsSavingGoogleDrive] = useState(false);
  const [googleDriveResult, setGoogleDriveResult] = useState<DriveSaveResult | null>(null);

  const effectiveIsLight = propIsLightMode !== undefined ? propIsLightMode : (getTheme() === 'light');

  const albumUrl = getAlbumUrl(currentSet);
  const pretitledFolderName = `KoHot Archives / ${currentSet.departmentName} — Class of ${currentSet.graduationYear}`;
  const albumTitle = `${currentSet.departmentName} (Class of ${currentSet.graduationYear}) — KoHot Class Album`;

  // Generate QR code data URL whenever albumUrl changes
  useEffect(() => {
    if (!albumUrl) return;
    let isMounted = true;
    QRCode.toDataURL(albumUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [albumUrl]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 1. Copy direct text link
  const handleCopyLink = async () => {
    try {
      await copyUrlToClipboard(albumUrl);
      setCopiedLink(true);
      showSuccess('Album Link Copied!', 'Live class album link copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showError('Failed to copy link', 'Please copy link manually.');
    }
  };

  // 2. Download clickable bookmark file (.url)
  const handleDownloadLinkFile = () => {
    try {
      const urlFileContent = `[InternetShortcut]\r\nURL=${albumUrl}\r\nIconIndex=0\r\n`;
      const blob = new Blob([urlFileContent], { type: 'text/plain;charset=utf-8' });
      const dlLink = document.createElement('a');
      dlLink.href = URL.createObjectURL(blob);
      dlLink.download = `${albumTitle}.url`;
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);
      URL.revokeObjectURL(dlLink.href);

      showSuccess('Web Bookmark Downloaded', `Saved as "${albumTitle}.url"`);
    } catch {
      showError('Download error', 'Could not create bookmark file.');
    }
  };

  // 3. Download QR code high-res PNG image
  const handleDownloadQrCode = () => {
    if (!qrCodeDataUrl) return;
    try {
      const dlLink = document.createElement('a');
      dlLink.href = qrCodeDataUrl;
      dlLink.download = `${currentSet.departmentName}_Class_of_${currentSet.graduationYear}_KoHot_QR.png`;
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);

      showSuccess('QR Code Downloaded', 'High-res QR image downloaded for printing or sharing.');
    } catch {
      showError('Download error', 'Could not download QR code image.');
    }
  };

  // 4. Copy QR Image to clipboard
  const handleCopyQrImage = async () => {
    if (!qrCodeDataUrl) return;
    try {
      const res = await fetch(qrCodeDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopiedQr(true);
      showSuccess('QR Code Copied', 'QR code image copied to clipboard.');
      setTimeout(() => setCopiedQr(false), 2500);
    } catch {
      await copyUrlToClipboard(albumUrl);
      showSuccess('Link Copied', 'Direct album link copied to clipboard.');
    }
  };

  // 5. Google Drive direct cloud save
  const handleSaveToGoogleDrive = async () => {
    setIsSavingGoogleDrive(true);
    try {
      const result = await saveAlbumShortcutToDrive(currentSet);
      setGoogleDriveResult(result);
      if (result.success) {
        showSuccess(
          'Saved to Google Drive!',
          `Created "${result.folderName}" with live album bookmark and high-res QR code.`
        );
      } else {
        showError('Drive Save Failed', result.error || 'Please download the folder kit instead.');
      }
    } catch (err: any) {
      showError('Google Drive Error', err?.message || 'Could not connect to Google Drive.');
    } finally {
      setIsSavingGoogleDrive(false);
    }
  };

  // 6. Microsoft OneDrive helper
  const handleSaveToOneDrive = () => {
    handleDownloadLinkFile();
    showSuccess(
      'Ready for OneDrive',
      `Move the downloaded "${albumTitle}.url" file into your OneDrive folder.`
    );
  };

  // 7. Dropbox helper
  const handleSaveToDropbox = () => {
    handleDownloadLinkFile();
    showSuccess(
      'Ready for Dropbox',
      `Move the downloaded "${albumTitle}.url" into your Dropbox folder.`
    );
  };

  // 8. Apple iCloud helper
  const handleSaveToICloud = () => {
    handleDownloadLinkFile();
    showSuccess(
      'Ready for iCloud Drive',
      `Move the downloaded "${albumTitle}.url" into your iCloud Drive folder.`
    );
  };

  // 9. Download full folder kit as a collection
  const handleDownloadFullFolderKit = () => {
    handleDownloadLinkFile();
    setTimeout(() => {
      handleDownloadQrCode();
    }, 400);
    showSuccess('Album Folder Kit Ready', 'Downloaded both official link shortcut and high-res QR code.');
  };

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-cloud-modal-title"
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5 overflow-hidden animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] select-auto border transition-colors ${
          effectiveIsLight
            ? 'bg-[#f0f2f5] border-zinc-300 text-black'
            : 'bg-[#18181b] border-zinc-700/80 text-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 transition-colors ${
          effectiveIsLight
            ? 'bg-[#eef0f4]/95 border-zinc-200'
            : 'bg-[#121214] border-zinc-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-xs shrink-0 ${
              effectiveIsLight
                ? 'bg-white border-zinc-300 text-zinc-800'
                : 'bg-zinc-800 border-zinc-700 text-[#d4af37]'
            }`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="save-cloud-modal-title" className={`font-syne font-extrabold text-base sm:text-lg truncate ${
                effectiveIsLight ? 'text-black' : 'text-white'
              }`}>
                Save Album Link &amp; QR to Cloud
              </h3>
              <p className={`font-mono-tech text-[11px] truncate ${
                effectiveIsLight ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-xs ${
              effectiveIsLight
                ? 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-500 hover:text-black'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
            aria-label="Close save dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-4">
          
          {/* Pre-titled Destination Folder Display */}
          <div className={`p-3 sm:p-3.5 rounded-2xl border flex items-center gap-3 shadow-xs ${
            effectiveIsLight
              ? 'bg-white border-zinc-300'
              : 'bg-[#202024] border-zinc-800'
          }`}>
            <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] flex items-center justify-center shrink-0">
              <Folder className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-mono-tech uppercase tracking-wider font-bold ${
                  effectiveIsLight ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  Pre-titled Destination Folder
                </span>
                <span className="text-[10px] font-mono-tech text-[#d4af37] bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                  Ready to Save
                </span>
              </div>
              <p className={`text-xs font-mono-tech font-semibold truncate mt-0.5 ${
                effectiveIsLight ? 'text-black' : 'text-white'
              }`} title={pretitledFolderName}>
                {pretitledFolderName}
              </p>
            </div>
          </div>

          {/* Concise explanation & Annual anniversary hint */}
          <div className={`p-3.5 rounded-2xl border space-y-2 ${
            effectiveIsLight
              ? 'bg-amber-50/80 border-amber-200 text-zinc-800'
              : 'bg-amber-950/20 border-amber-500/25 text-amber-100'
          }`}>
            <div className={`flex items-center gap-2 font-mono-tech text-xs uppercase font-bold ${
              effectiveIsLight ? 'text-amber-900' : 'text-amber-300'
            }`}>
              <Bell className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
              <span>Permanent Cloud Storage &amp; Annual Reminder</span>
            </div>
            <p className={`font-body text-xs leading-relaxed ${
              effectiveIsLight ? 'text-zinc-700' : 'text-zinc-300'
            }`}>
              We save your official <strong>album link and QR code</strong> to your personal cloud so you can revisit these memories anytime from any device. While KoHot sends your class an <strong>annual convocation anniversary reminder</strong> to relive moments together, saving the link in your cloud gives you direct, easy, and secured access for life.
            </p>
          </div>

          {/* Text Link & QR Code Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Box 1: Text Link */}
            <div className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-3 shadow-xs ${
              effectiveIsLight
                ? 'bg-white border-zinc-300'
                : 'bg-[#202024] border-zinc-800'
            }`}>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono-tech uppercase tracking-wider font-bold flex items-center gap-1.5 ${
                    effectiveIsLight ? 'text-black' : 'text-white'
                  }`}>
                    <LinkIcon className="w-3 h-3 text-[#d4af37]" />
                    <span>Official Album Link</span>
                  </span>
                  <span className="text-[10px] font-mono-tech text-zinc-500 font-bold">Live URL</span>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  effectiveIsLight ? 'bg-zinc-50 border-zinc-200' : 'bg-black/40 border-zinc-800'
                }`}>
                  <p className={`font-mono-tech text-[11px] truncate select-all ${
                    effectiveIsLight ? 'text-zinc-800' : 'text-zinc-200'
                  }`}>
                    {albumUrl}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex-1 py-2 px-3 rounded-xl font-mono-tech text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95 ${
                    effectiveIsLight
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                      : 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLinkFile}
                  className={`py-2 px-3 rounded-xl font-mono-tech text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer border shadow-xs ${
                    effectiveIsLight
                      ? 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  }`}
                  title="Download .url file"
                >
                  <Download className="w-3 h-3" />
                  <span>.URL</span>
                </button>
              </div>
            </div>

            {/* Box 2: QR Code Image */}
            <div className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-3 shadow-xs ${
              effectiveIsLight
                ? 'bg-white border-zinc-300'
                : 'bg-[#202024] border-zinc-800'
            }`}>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono-tech uppercase tracking-wider font-bold flex items-center gap-1.5 ${
                    effectiveIsLight ? 'text-black' : 'text-white'
                  }`}>
                    <QrCode className="w-3 h-3 text-[#d4af37]" />
                    <span>Album QR Code</span>
                  </span>
                  <span className="text-[10px] font-mono-tech text-[#d4af37] font-bold">Scan to Open</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-white border border-zinc-300 p-1 shrink-0 shadow flex items-center justify-center">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="Album QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    )}
                  </div>
                  <p className={`text-[11px] font-body leading-snug ${
                    effectiveIsLight ? 'text-zinc-600' : 'text-zinc-300'
                  }`}>
                    Scan with any phone camera to launch this live album immediately.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadQrCode}
                  className={`flex-1 py-2 px-3 rounded-xl font-mono-tech text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95 ${
                    effectiveIsLight
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                      : 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download QR</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyQrImage}
                  className={`py-2 px-3 rounded-xl font-mono-tech text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer border shadow-xs ${
                    effectiveIsLight
                      ? 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  }`}
                  title="Copy QR image"
                >
                  {copiedQr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedQr ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* Major Cloud Storage Platforms (All neutral grey / no blue hue) */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className={`block text-xs font-mono-tech uppercase tracking-wider font-bold ${
                effectiveIsLight ? 'text-black' : 'text-white'
              }`}>
                Save to Cloud Storage
              </label>
              <span className="text-[10px] font-mono-tech text-zinc-500">
                Saves to pre-titled KoHot folder
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Google Drive */}
              <div className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 shadow-xs ${
                effectiveIsLight
                  ? 'bg-white border-zinc-300 hover:border-zinc-400'
                  : 'bg-[#202024] border-zinc-800 hover:border-zinc-700'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      effectiveIsLight
                        ? 'bg-zinc-100 text-zinc-800 border-zinc-300'
                        : 'bg-zinc-800 text-[#d4af37] border-zinc-700'
                    }`}>
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className={`font-syne font-bold text-xs ${
                        effectiveIsLight ? 'text-black' : 'text-white'
                      }`}>Google Drive</h4>
                      <p className="text-[10px] font-mono-tech text-zinc-500">
                        Direct 1-click cloud sync
                      </p>
                    </div>
                  </div>
                  {googleDriveResult?.success && (
                    <span className="text-emerald-500 text-[10px] font-mono-tech flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Saved
                    </span>
                  )}
                </div>

                {googleDriveResult?.success ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={googleDriveResult.folderViewUrl || googleDriveResult.driveViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-mono-tech text-xs flex items-center justify-center gap-1.5 transition-colors border border-zinc-600"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open in Drive</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleSaveToGoogleDrive}
                      className="py-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono-tech border border-zinc-700"
                      title="Save again"
                    >
                      Resave
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveToGoogleDrive}
                    disabled={isSavingGoogleDrive}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-mono-tech text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 border border-zinc-600"
                  >
                    {isSavingGoogleDrive ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving to Drive...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Save to Google Drive</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Microsoft OneDrive */}
              <div className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 shadow-xs ${
                effectiveIsLight
                  ? 'bg-white border-zinc-300 hover:border-zinc-400'
                  : 'bg-[#202024] border-zinc-800 hover:border-zinc-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    effectiveIsLight
                      ? 'bg-zinc-100 text-zinc-800 border-zinc-300'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}>
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`font-syne font-bold text-xs ${
                      effectiveIsLight ? 'text-black' : 'text-white'
                    }`}>OneDrive</h4>
                    <p className="text-[10px] font-mono-tech text-zinc-500">
                      Microsoft cloud storage
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToOneDrive}
                  className={`w-full py-2 px-3 rounded-xl font-mono-tech text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border ${
                    effectiveIsLight
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-black border-zinc-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                  }`}
                >
                  <FolderDown className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Save to OneDrive</span>
                </button>
              </div>

              {/* Dropbox */}
              <div className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 shadow-xs ${
                effectiveIsLight
                  ? 'bg-white border-zinc-300 hover:border-zinc-400'
                  : 'bg-[#202024] border-zinc-800 hover:border-zinc-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    effectiveIsLight
                      ? 'bg-zinc-100 text-zinc-800 border-zinc-300'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}>
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`font-syne font-bold text-xs ${
                      effectiveIsLight ? 'text-black' : 'text-white'
                    }`}>Dropbox</h4>
                    <p className="text-[10px] font-mono-tech text-zinc-500">
                      Personal Dropbox folder
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToDropbox}
                  className={`w-full py-2 px-3 rounded-xl font-mono-tech text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border ${
                    effectiveIsLight
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-black border-zinc-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                  }`}
                >
                  <FolderDown className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Save to Dropbox</span>
                </button>
              </div>

              {/* Apple iCloud */}
              <div className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 shadow-xs ${
                effectiveIsLight
                  ? 'bg-white border-zinc-300 hover:border-zinc-400'
                  : 'bg-[#202024] border-zinc-800 hover:border-zinc-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    effectiveIsLight
                      ? 'bg-zinc-100 text-zinc-800 border-zinc-300'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}>
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`font-syne font-bold text-xs ${
                      effectiveIsLight ? 'text-black' : 'text-white'
                    }`}>iCloud Drive</h4>
                    <p className="text-[10px] font-mono-tech text-zinc-500">
                      Apple files &amp; iOS devices
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToICloud}
                  className={`w-full py-2 px-3 rounded-xl font-mono-tech text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border ${
                    effectiveIsLight
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-black border-zinc-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                  }`}
                >
                  <FolderDown className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Save to iCloud</span>
                </button>
              </div>

            </div>
          </div>

          {/* Reassurance badge */}
          <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs shadow-xs ${
            effectiveIsLight
              ? 'bg-white border-zinc-300 text-zinc-700'
              : 'bg-[#202024] border-zinc-800 text-zinc-300'
          }`}>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="leading-snug">
              Links and QR codes connect directly to the permanent KoHot archive network, preserved without expiration.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 sm:p-5 border-t shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 ${
          effectiveIsLight
            ? 'bg-[#eef0f4]/95 border-zinc-200'
            : 'bg-[#121214] border-zinc-800'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto px-5 py-2 rounded-full font-syne text-xs uppercase tracking-wider transition-colors cursor-pointer border shadow-xs ${
              effectiveIsLight
                ? 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border-zinc-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border-zinc-700'
            }`}
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleDownloadFullFolderKit}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-zinc-600"
          >
            <FolderDown className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Download Complete Folder Kit</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }
  return modalElement;
};
