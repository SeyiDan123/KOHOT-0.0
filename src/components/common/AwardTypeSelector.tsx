import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getAwardVisualConfig, AwardVisualConfig } from '../../utils/awardVisuals';

export const ALL_AWARD_TROPHY_TYPES = ['gold', 'crystal', 'silver', 'bronze', 'star', 'crown'] as const;
export type AwardTrophyType = typeof ALL_AWARD_TROPHY_TYPES[number];

interface AwardTypeSelectorProps {
  value: string;
  onChange: (value: AwardTrophyType) => void;
  label?: string;
  className?: string;
}

export const AwardTypeSelector: React.FC<AwardTypeSelectorProps> = ({
  value,
  onChange,
  label = 'Trophy Honor Grade',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedVisual = getAwardVisualConfig(value);
  const SelectedIcon = selectedVisual.icon;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`space-y-1.5 relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] border border-white/15 hover:border-white/30 text-white font-mono-tech text-xs flex items-center justify-between transition-all cursor-pointer shadow-sm group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedVisual.shapeClass} ${selectedVisual.glowClass}`}>
            <SelectedIcon className={`w-3.5 h-3.5 ${selectedVisual.iconColor} ${selectedVisual.type === 'crystal' ? '-rotate-45' : ''}`} />
          </div>
          <span className="font-semibold text-white truncate">{selectedVisual.label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Pocket List Dropdown Menu with Icons beside each award */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-[#18181b] border border-white/20 shadow-2xl p-2 animate-fadeIn space-y-1 max-h-72 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-mono-tech uppercase tracking-wider text-zinc-400 border-b border-white/10 mb-1 flex items-center justify-between">
            <span>Select Award Style &amp; Icon</span>
            <span className="text-amber-400 font-semibold">{ALL_AWARD_TROPHY_TYPES.length} Styles</span>
          </div>

          {ALL_AWARD_TROPHY_TYPES.map((typeKey) => {
            const visual: AwardVisualConfig = getAwardVisualConfig(typeKey);
            const IconComponent = visual.icon;
            const isSelected = (value || 'gold').toLowerCase().trim() === typeKey;

            return (
              <button
                type="button"
                key={typeKey}
                onClick={() => {
                  onChange(typeKey);
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/15 border border-white/30 text-white shadow-md'
                    : 'hover:bg-white/5 border border-transparent text-zinc-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Icon showing beside award type */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${visual.shapeClass} ${visual.glowClass}`}>
                    <IconComponent className={`w-4 h-4 ${visual.iconColor} ${visual.type === 'crystal' ? '-rotate-45' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-syne font-bold text-xs text-white">
                        {visual.label}
                      </span>
                    </div>
                    <p className="font-mono-tech text-[10px] text-zinc-400 truncate mt-0.5">
                      {visual.description}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
