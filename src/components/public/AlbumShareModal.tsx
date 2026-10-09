import React, { useState } from 'react';
import { ClassSet } from '../../types';
import { getAlbumUrl } from '../../utils/urlHelper';
import { 
  X, 
  Check, 
  Cloud, 
  Apple, 
  Download
} from 'lucide-react';

import { useStaticBackdropScrollLock } from '../../utils/useStaticBackdropScrollLock';

interface AlbumShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
}

export const AlbumShareModal: React.FC<AlbumShareModalProps> = ({
  isOpen,
  onClose,
  currentSet,
}) => {
  useStaticBackdropScrollLock(isOpen);
  const [savedCloud, setSavedCloud] = useState<string | null>(null);

  if (!isOpen || !currentSet) return null;

  const albumUrl = getAlbumUrl(currentSet);
  const albumTitle = `${currentSet.departmentName || 'Class'} (Class of ${currentSet.graduationYear || 'Graduates'})`;



  const downloadShortcut = (filename: string) => {
    const content = `[InternetShortcut]\nURL=${albumUrl}\n`;
    const blob = new Blob([content], { type: 'text/uri-list' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. Dropbox Handler
  const handleSaveToDropbox = () => {
    // Generate and download a dedicated Dropbox web shortcut file (.url)
    downloadShortcut(`${albumTitle} - Dropbox.url`);
    setSavedCloud('dropbox');
    setTimeout(() => setSavedCloud(null), 4000);
  };

  // 3. Apple Cloud (iCloud) Handler
  const handleSaveToAppleCloud = () => {
    // Native Apple .webloc XML format directly opened by macOS and iOS iCloud Drive
    const weblocContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>${albumUrl}</string>
</dict>
</plist>`;
    const blob = new Blob([weblocContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${albumTitle} - iCloud.webloc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSavedCloud('apple');
    setTimeout(() => setSavedCloud(null), 4000);
  };

  return (
    <div
      id="album-share-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none"
      onClick={onClose}
    >
      <div
        id="album-share-modal-dialog"
        className="w-full max-w-md bg-[#f0f2f5] border border-zinc-300 rounded-3xl overflow-hidden shadow-2xl relative text-black p-6 sm:p-7 space-y-6 select-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="close-album-share-modal-btn"
          onClick={onClose}
          className="absolute top-5 right-5 z-20 w-8 h-8 rounded-full bg-white border border-zinc-300 text-zinc-500 hover:text-black hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1.5">
          <span className="px-3 py-1 rounded-full bg-white border border-zinc-300 text-[10px] font-mono-tech uppercase tracking-widest text-black inline-flex items-center gap-1.5 font-bold shadow-xs">
            <Cloud className="w-3 h-3 text-[#b89728]" />
            Cloud Storage
          </span>
          <h3 className="font-syne font-extrabold text-xl sm:text-2xl text-black">
            Save Album Directly
          </h3>
          <p className="font-body text-xs text-zinc-600">
            Save this digital graduation album directly to your preferred cloud drive for permanent access.
          </p>
        </div>

        {/* Cloud Options: Dropbox, Apple Cloud */}
        <div className="space-y-3">

          {/* Option 2: Dropbox */}
          <div className="rounded-2xl border border-zinc-300 bg-white p-4 flex items-center justify-between gap-4 hover:border-zinc-400 transition-all shadow-xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              </div>
              <div className="min-w-0">
                <h4 className="font-syne font-bold text-sm text-black truncate">Dropbox</h4>
                <p className="font-body text-[11px] text-zinc-500">Save shortcut directly to Dropbox</p>
              </div>
            </div>

            <button
              id="save-to-dropbox-btn"
              onClick={handleSaveToDropbox}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-tech text-xs uppercase font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer shrink-0"
            >
              {savedCloud === 'dropbox' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>

          {/* Option 3: Apple Cloud (iCloud) */}
          <div className="rounded-2xl border border-zinc-300 bg-white p-4 flex items-center justify-between gap-4 hover:border-zinc-400 transition-all shadow-xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                <Apple className="w-5 h-5 text-black" />
              </div>
              <div className="min-w-0">
                <h4 className="font-syne font-bold text-sm text-black truncate">Apple Cloud (iCloud)</h4>
                <p className="font-body text-[11px] text-zinc-500">Save to your iCloud Drive / Apple devices</p>
              </div>
            </div>

            <button
              id="save-to-apple-cloud-btn"
              onClick={handleSaveToAppleCloud}
              className="px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white font-tech text-xs uppercase font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer shrink-0"
            >
              {savedCloud === 'apple' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center font-mono-tech text-[11px] text-zinc-500">
          Saved shortcuts sync instantly across your mobile devices and computers.
        </p>
      </div>
    </div>
  );
};
