import React, { useState, useEffect } from 'react';
import { Palette, Upload, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { DarkLuxuryTheme, DEFAULT_LUXURY_THEMES, saveStoredLuxuryThemes, getStoredLuxuryThemes } from '../../utils/luxuryThemes';
import { fileToUniversalDataUrl } from '../../utils/imageCompressor';

interface MasterAlbumVisualsSectionProps {
  themes: DarkLuxuryTheme[];
  onSaveThemes: (updatedThemes: DarkLuxuryTheme[]) => void;
}

export const MasterAlbumVisualsSection: React.FC<MasterAlbumVisualsSectionProps> = ({
  themes,
  onSaveThemes,
}) => {
  const [currentThemes, setCurrentThemes] = useState<DarkLuxuryTheme[]>(() => {
    return themes && themes.length > 0 ? themes : getStoredLuxuryThemes();
  });
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [saveToast, setSaveToast] = useState(false);

  useEffect(() => {
    if (themes && themes.length > 0) {
      setCurrentThemes(themes);
    }
  }, [themes]);

  const handleUpdateTheme = (index: number, updates: Partial<DarkLuxuryTheme>) => {
    const updated = [...currentThemes];
    updated[index] = { ...updated[index], ...updates };
    setCurrentThemes(updated);
    // Live automatic sync to Album Admin dashboard and storage
    saveStoredLuxuryThemes(updated);
    onSaveThemes(updated);
  };

  const handleFileUpload = async (index: number, file: File) => {
    if (!file) return;
    try {
      const dataUrl = await fileToUniversalDataUrl(file);
      if (dataUrl) {
        handleUpdateTheme(index, { textureUrl: dataUrl });
      }
    } catch (err) {
      console.error('Error uploading theme texture:', err);
    }
  };

  const handleResetToDefaults = () => {
    setCurrentThemes(DEFAULT_LUXURY_THEMES);
    saveStoredLuxuryThemes(DEFAULT_LUXURY_THEMES);
    onSaveThemes(DEFAULT_LUXURY_THEMES);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleSave = () => {
    saveStoredLuxuryThemes(currentThemes);
    onSaveThemes(currentThemes);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const activeTheme = currentThemes[activePreviewIndex] || currentThemes[0];

  return (
    <div className="space-y-8 animate-fadeIn text-[#e2e4e9]">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#141620] to-[#0c0e15] border border-amber-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono-tech uppercase font-bold">
            <Palette className="w-4 h-4" />
            <span>Dark Luxury Background Styles (8 Curated Visual Archetypes)</span>
          </div>
          <h3 className="font-syne font-bold text-lg text-white">
            Album Visuals Studio &amp; Texture Customizer
          </h3>
          <p className="font-body text-xs text-zinc-300 max-w-2xl leading-relaxed">
            Configure the 8 dark luxury background styles. Any updates made here reflect automatically on the Album Admin dashboard under Album Design and on live class albums.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-black" />
            <span>Save &amp; Sync</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>✓ Dark Luxury Visual Themes saved and synchronized live to Album Admin dashboard!</span>
        </div>
      )}

      {/* Live Interactive Demo Preview Banner - Authentic Colored Luxury Texture Without Gradient Shadows */}
      <div 
        className="relative rounded-3xl p-7 sm:p-10 border border-white/20 overflow-hidden shadow-2xl transition-all duration-500"
        style={{
          background: activeTheme.cssGradient,
        }}
      >
        {activeTheme.textureUrl && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay z-0"
            style={{
              backgroundImage: `url(${activeTheme.textureUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono-tech uppercase font-bold tracking-wider bg-white/10 text-white border border-white/20 backdrop-blur-md">
              Live Album Visual Demo • {activeTheme.name}
            </span>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeTheme.accentHex }} />
          </div>

          <h2 className="font-syne font-bold text-2xl sm:text-4xl text-white tracking-tight leading-tight">
            Department of Computer Science
          </h2>
          <p className="font-mono-tech text-xs sm:text-sm text-zinc-300">
            University of Lagos • Class of 2026 Permanent Heritage Album
          </p>

          <p className="font-body text-xs sm:text-sm text-zinc-200/90 leading-relaxed italic max-w-xl">
            "{activeTheme.description}"
          </p>

          <div className="flex items-center gap-3 pt-2">
            <span className="px-3 py-1.5 rounded-full bg-white text-black font-syne font-bold text-xs">
              Explore Album
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white font-mono-tech text-xs">
              {activeTheme.accentHex} Accent
            </span>
          </div>
        </div>
      </div>

      {/* 8 Dark Luxury Background Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {currentThemes.map((theme, index) => {
          const isSelectedForDemo = activePreviewIndex === index;

          return (
            <div
              key={theme.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                isSelectedForDemo
                  ? 'bg-gradient-to-b from-[#161826] to-[#0e1018] border-amber-400/60 shadow-xl ring-1 ring-amber-400/30'
                  : 'bg-gradient-to-b from-[#12141d] to-[#0a0c12] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="space-y-3">
                {/* Visual Swatch & Demo Selector - Authentic Colored Texture Without Harsh Shadows */}
                <div 
                  onClick={() => setActivePreviewIndex(index)}
                  className="relative h-28 rounded-xl overflow-hidden cursor-pointer group border border-white/15 shadow-inner"
                  style={{ background: theme.cssGradient }}
                >
                  {theme.textureUrl && (
                    <div
                      className="absolute inset-0 w-full h-full opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-300"
                      style={{
                        backgroundImage: `url(${theme.textureUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 flex items-end justify-between bg-black/40 backdrop-blur-xs">
                    <span className="font-syne font-bold text-xs text-white">
                      {theme.name}
                    </span>
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-white/40 shadow"
                      style={{ backgroundColor: theme.accentHex }}
                    />
                  </div>
                </div>

                {/* Editable Style Name */}
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Theme Name
                  </label>
                  <input
                    type="text"
                    value={theme.name}
                    onChange={(e) => handleUpdateTheme(index, { name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-syne font-bold focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                {/* Editable Description */}
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Sensory Description
                  </label>
                  <input
                    type="text"
                    value={theme.description}
                    onChange={(e) => handleUpdateTheme(index, { description: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-body focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                {/* Background Image / Texture URL */}
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Texture Pattern / Image URL
                  </label>
                  <input
                    type="url"
                    value={theme.textureUrl.startsWith('data:') ? 'Embedded Luxury Texture' : theme.textureUrl}
                    onChange={(e) => handleUpdateTheme(index, { textureUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-[11px] focus:outline-none focus:border-amber-400/50 truncate"
                  />
                </div>

                {/* Accent Color Hex */}
                <div className="flex items-center gap-2">
                  <div 
                    className="w-7 h-7 rounded-lg border border-white/20 shrink-0 shadow" 
                    style={{ backgroundColor: theme.accentHex }} 
                  />
                  <input
                    type="text"
                    value={theme.accentHex}
                    onChange={(e) => handleUpdateTheme(index, { accentHex: e.target.value })}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono-tech text-[11px] focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Upload or Demo Actions */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <label className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3 h-3 text-amber-400" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif,.avif,.webp,.png,.jpg,.jpeg,.jfif,.bmp,.gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(index, file);
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setActivePreviewIndex(index)}
                  className={`px-3 py-1 rounded-lg font-mono-tech text-[11px] uppercase transition-colors cursor-pointer ${
                    isSelectedForDemo
                      ? 'bg-amber-400 text-black font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isSelectedForDemo ? 'Active Demo' : 'Preview'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
