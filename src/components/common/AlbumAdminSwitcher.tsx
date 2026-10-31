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
  const hasMain = Boolean(showMainButton);

  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Reserve exact height at the bottom of the document so footers and page content end flush at the top of this base bar,
  // and detect whenever any modal or pop-up card is open so the bottom bar never blocks any pop-up card or window.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('has-solid-bottom-switcher');

    const checkModals = () => {
      const hasLockedBody =
        document.body.classList.contains('modal-backdrop-locked') ||
        document.documentElement.classList.contains('modal-backdrop-locked');
      const hasDialog = Boolean(
        document.querySelector(
          '[role="dialog"], [aria-modal="true"], [id$="-modal-backdrop"], [id$="-modal-dialog"], div.fixed.inset-0[class*="bg-black"]'
        )
      );
      setIsModalOpen(hasLockedBody || hasDialog);
    };

    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.body.classList.remove('has-solid-bottom-switcher');
    };
  }, []);

  const switcherElement = (
    <aside
      id="album-admin-sticky-toggle-container"
      className={`fixed inset-x-0 bottom-0 z-30 select-none flex flex-col items-center transition-opacity duration-150 ${
        isModalOpen ? 'opacity-0 pointer-events-none invisible' : ' opacity-100 pointer-events-auto visible'
      }`}
      aria-label="Admin View Toggle"
      aria-hidden={isModalOpen}
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
        className="w-full bg-[#16171a] border-t border-white/[0.08] shadow-[0_-8px_28px_rgba(0,0,0,0.55)] flex items-center justify-center px-4 h-[68px]"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Recessed Dark Pill Track */}
        <div
          id="album-admin-toggle-track"
          className="relative flex items-center justify-center p-1 rounded-full bg-[#0d0e11] border border-white/[0.05] shadow-inner gap-1"
        >
          {/* Toggle Option: Main (Shown only in Host Demo Edit / Preview mode) */}
          {hasMain && (
            <button
              id="toggle-btn-main-dashboard"
              type="button"
              onClick={() => {
                if (onMainDashboard) {
                  onMainDashboard();
                }
              }}
              className={`relative z-10 px-6 sm:px-7 py-2.5 rounded-full text-[14px] sm:text-[15px] font-body leading-none tracking-normal flex items-center justify-center transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeMode === 'main'
                  ? 'bg-[#2c2d31] text-[#f1f3f4] font-medium shadow-[0_2px_6px_rgba(0,0,0,0.45)]'
                  : 'bg-transparent text-[#9aa0a6] hover:text-[#e8eaed] font-normal'
              }`}
              title="Return to Host Main Dashboard"
            >
              <span>Main</span>
            </button>
          )}

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



