import React from 'react';
import { Sliders, Eye, LayoutDashboard } from 'lucide-react';

interface AlbumAdminSwitcherProps {
  activeMode: 'main' | 'manage' | 'preview';
  onMainDashboard?: () => void;
  onManageAlbum: () => void;
  onPreviewAlbum: () => void;
  albumLabel?: string;
  isViewingOtherAlbum?: boolean;
  showMainButton?: boolean;
}

export const AlbumAdminSwitcher: React.FC<AlbumAdminSwitcherProps> = ({
  activeMode,
  onMainDashboard,
  onManageAlbum,
  onPreviewAlbum,
  albumLabel,
  isViewingOtherAlbum = false,
  showMainButton = false,
}) => {
  const hasMain = Boolean(showMainButton);

  return (
    <aside
      id="album-admin-sticky-toggle-container"
      className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center select-none"
      aria-label="Admin View Toggle"
    >
      <div
        id="album-admin-toggle-track"
        className="relative flex items-center p-1 rounded-full bg-[#18181b]/95 backdrop-blur-2xl border border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.85)] ring-1 ring-white/10 gap-0.5"
      >
        {/* Toggle Option: Main (Shown in Owner Demo Edit / Preview mode) */}
        {hasMain && (
          <button
            id="toggle-btn-main-dashboard"
            type="button"
            onClick={() => {
              if (onMainDashboard) {
                onMainDashboard();
              }
            }}
            className={`relative z-10 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-mono-tech tracking-wider uppercase flex items-center gap-1.5 sm:gap-2 transition-all duration-200 cursor-pointer ${
              activeMode === 'main'
                ? 'bg-white text-zinc-950 font-bold shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-white/10 font-medium'
            }`}
            title="Return to Owner Main Dashboard"
          >
            <LayoutDashboard className={`w-3.5 h-3.5 ${activeMode === 'main' ? 'text-zinc-950' : 'text-zinc-400'}`} />
            <span>Main</span>
          </button>
        )}

        {/* Toggle Option: Manage */}
        <button
          id="toggle-btn-manage-album"
          type="button"
          onClick={() => {
            if (activeMode !== 'manage') {
              onManageAlbum();
            }
          }}
          className={`relative z-10 px-3.5 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-mono-tech tracking-wider uppercase flex items-center gap-1.5 sm:gap-2 transition-all duration-200 cursor-pointer ${
            activeMode === 'manage'
              ? 'bg-white text-zinc-950 font-bold shadow-md'
              : 'text-zinc-300 hover:text-white hover:bg-white/10 font-medium'
          }`}
          title="Switch to Manage Album dashboard"
        >
          <Sliders className={`w-3.5 h-3.5 ${activeMode === 'manage' ? 'text-zinc-950' : 'text-zinc-400'}`} />
          <span>Manage</span>
        </button>

        {/* Toggle Option: Preview */}
        <button
          id="toggle-btn-preview-album"
          type="button"
          onClick={() => {
            // If already on preview but viewing another album, clicking Preview returns to your own album
            onPreviewAlbum();
          }}
          className={`relative z-10 px-3.5 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-mono-tech tracking-wider uppercase flex items-center gap-1.5 sm:gap-2 transition-all duration-200 cursor-pointer ${
            activeMode === 'preview'
              ? 'bg-white text-zinc-950 font-bold shadow-md'
              : 'text-zinc-300 hover:text-white hover:bg-white/10 font-medium'
          }`}
          title={
            isViewingOtherAlbum
              ? 'Return to Previewing Your Own Class Album'
              : 'Switch to Preview Class Album'
          }
        >
          <Eye className={`w-3.5 h-3.5 ${activeMode === 'preview' ? 'text-zinc-950' : 'text-zinc-400'}`} />
          <span>Preview</span>
        </button>
      </div>

      {/* Optional contextual hint if viewing another class's album */}
      {isViewingOtherAlbum && activeMode === 'preview' && (
        <div className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-200 text-[10px] font-mono-tech tracking-wide backdrop-blur-md animate-fade-in shadow-sm">
          Read-Only Mode • Click Preview to return to your album
        </div>
      )}
    </aside>
  );
};
