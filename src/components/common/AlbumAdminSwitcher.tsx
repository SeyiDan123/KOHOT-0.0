import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AlbumAdminSwitcherProps {
  activeMode: 'main' | 'manage' | 'preview';
  onMainDashboard?: () => void;
  onManageAlbum?: () => void;
  onPreviewAlbum: () => void;
  albumLabel?: string;
  isViewingOtherAlbum?: boolean;
  showMainButton?: boolean;
  showManageButton?: boolean;
}

export const AlbumAdminSwitcher: React.FC<AlbumAdminSwitcherProps> = ({
  activeMode,
  onMainDashboard,
  onManageAlbum,
  onPreviewAlbum,
  isViewingOtherAlbum = false,
  showMainButton = false,
  showManageButton = true,
}) => {
  const hasMain = Boolean(showMainButton && onMainDashboard);

  // Reserve exact height at the bottom of the document so footers and page content end flush at the top of this base bar
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('has-solid-bottom-switcher');

    return () => {
      document.body.classList.remove('has-solid-bottom-switcher');
    };
  }, []);

  const switcherElement = (
    <aside
      id="album-admin-sticky-toggle-container"
      className="fixed inset-x-0 bottom-0 z-30 select-none flex flex-col items-center opacity-100 pointer-events-auto visible"
      aria-label="Admin View Toggle"
    >
      {/* Optional contextual hint if viewing another class's album (floats just above the solid base) */}
      {isViewingOtherAlbum && activeMode === 'preview' && (
        <div className="mb-2 px-3 py-1 rounded-full bg-[#16171a]/95 border border-amber-500/40 text-amber-200 text-[10px] font-mono-tech tracking-wide backdrop-blur-md shadow-lg">
          Read-Only Mode • Tap Preview to return to your album
        </div>
      )}

      {/* Solid, Filled Full-Width Base Bar matching Google AI Studio bottom dock */}
      <div
        id="album-admin-solid-base"
        className="relative w-full bg-[#16171a] border-t border-white/[0.08] shadow-[0_-8px_28px_rgba(0,0,0,0.55)] flex items-center justify-center px-4 h-[68px]"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Recessed Dark Pill Track (Manage | Preview only) */}
        <div
          id="album-admin-toggle-track"
          className="relative flex items-center justify-center p-1 rounded-full bg-[#0d0e11] border border-white/[0.05] shadow-inner gap-1"
        >
          {/* Toggle Option: Manage */}
          {showManageButton && (
            <button
              id="toggle-btn-manage-album"
              type="button"
              onClick={() => {
                if (activeMode !== 'manage' && onManageAlbum) {
                  onManageAlbum();
                }
              }}
              className={`relative z-10 px-6 sm:px-7 py-2.5 rounded-full text-[14px] sm:text-[15px] font-body leading-none tracking-normal flex items-center justify-center transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeMode === 'manage'
                  ? 'bg-[#2c2d31] text-[#f1f3f4] font-medium shadow-[0_2px_6px_rgba(0,0,0,0.45)]'
                  : 'bg-transparent text-[#9aa0a6] hover:text-[#e8eaed] font-normal'
              }`}
              title="Switch to Manage Album dashboard"
            >
              <span>Manage</span>
            </button>
          )}

          {/* Toggle Option: Preview */}
          <button
            id="toggle-btn-preview-album"
            type="button"
            onClick={() => {
              onPreviewAlbum();
            }}
            className={`relative z-10 px-6 sm:px-7 py-2.5 rounded-full text-[14px] sm:text-[15px] font-body leading-none tracking-normal flex items-center justify-center transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeMode === 'preview'
                ? 'bg-[#2c2d31] text-[#f1f3f4] font-medium shadow-[0_2px_6px_rgba(0,0,0,0.45)]'
                : 'bg-transparent text-[#9aa0a6] hover:text-[#e8eaed] font-normal'
            }`}
            title={
              isViewingOtherAlbum
                ? 'Return to Previewing Your Own Class Album'
                : 'Switch to Preview Class Album'
            }
          >
            <span>Preview</span>
          </button>
        </div>
      </div>
    </aside>
  );

  if (typeof document !== 'undefined') {
    return createPortal(switcherElement, document.body);
  }

  return switcherElement;
};




