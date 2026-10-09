import React from 'react';
import { 
  Trophy, 
  Medal, 
  Award, 
  Gem, 
  Star,
  Crown
} from 'lucide-react';

export interface AwardVisualConfig {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  shapeClass: string;
  badgeClass: string;
  borderClass: string;
  glowClass: string;
  description: string;
}

export function getAwardVisualConfig(trophyType?: string, isLightMode = false): AwardVisualConfig {
  const norm = (trophyType || 'gold').toLowerCase().trim();

  switch (norm) {
    case 'crystal':
      return {
        type: 'crystal',
        label: 'Crystal Plaque',
        icon: Gem,
        iconColor: isLightMode ? 'text-cyan-700' : 'text-cyan-300',
        shapeClass: isLightMode 
          ? 'rounded-2xl rotate-45 scale-90 border-2 border-cyan-500/60 bg-cyan-100/70' 
          : 'rounded-2xl rotate-45 scale-90 border-2 border-cyan-400/60 bg-gradient-to-br from-cyan-500/25 to-blue-600/15',
        badgeClass: isLightMode 
          ? 'text-cyan-800 border-cyan-400 bg-cyan-50 font-bold' 
          : 'text-cyan-300 border-cyan-400/35 bg-cyan-400/15',
        borderClass: 'border-cyan-400 ring-4 ring-cyan-400/20',
        glowClass: isLightMode ? 'shadow-md' : 'shadow-[0_0_20px_rgba(34,211,238,0.3)]',
        description: 'Diamond facet prism honoring visionary intellect & clarity',
      };
    case 'silver':
      return {
        type: 'silver',
        label: 'Silver Distinction',
        icon: Medal,
        iconColor: isLightMode ? 'text-slate-800' : 'text-slate-100',
        shapeClass: isLightMode 
          ? 'rounded-xl border-2 border-slate-500/70 bg-slate-200/90' 
          : 'rounded-xl border-2 border-slate-300/70 bg-gradient-to-br from-slate-200/25 to-zinc-400/15',
        badgeClass: isLightMode 
          ? 'text-slate-900 border-slate-400 bg-slate-100 font-bold' 
          : 'text-slate-200 border-slate-300/35 bg-slate-200/15',
        borderClass: isLightMode ? 'border-slate-500 ring-4 ring-slate-400/30' : 'border-slate-300 ring-4 ring-slate-300/20',
        glowClass: isLightMode ? 'shadow-md' : 'shadow-[0_0_20px_rgba(226,232,240,0.25)]',
        description: 'Sleek platinum shield for outstanding academic achievement',
      };
    case 'bronze':
      return {
        type: 'bronze',
        label: 'Bronze Laureate',
        icon: Award,
        iconColor: isLightMode ? 'text-amber-800' : 'text-amber-500',
        shapeClass: isLightMode 
          ? 'rounded-full border-2 border-amber-600/70 bg-amber-100/80' 
          : 'rounded-full border-2 border-amber-600/70 bg-gradient-to-br from-amber-700/30 to-amber-950/20',
        badgeClass: isLightMode 
          ? 'text-amber-900 border-amber-500 bg-amber-50 font-bold' 
          : 'text-amber-400 border-amber-600/35 bg-amber-600/15',
        borderClass: 'border-amber-600 ring-4 ring-amber-600/20',
        glowClass: isLightMode ? 'shadow-md' : 'shadow-[0_0_20px_rgba(217,119,6,0.25)]',
        description: 'Circular medallion celebrating relentless grit & perseverance',
      };
    case 'star':
      return {
        type: 'star',
        label: 'Starlight Superlative',
        icon: Star,
        iconColor: isLightMode ? 'text-amber-700' : 'text-yellow-300',
        shapeClass: isLightMode 
          ? 'rounded-lg border-2 border-amber-500/70 bg-amber-100/80' 
          : 'rounded-lg border-2 border-yellow-400/70 bg-gradient-to-br from-yellow-500/25 to-amber-500/15',
        badgeClass: isLightMode 
          ? 'text-amber-900 border-amber-400 bg-amber-50 font-bold' 
          : 'text-yellow-300 border-yellow-400/35 bg-yellow-400/15',
        borderClass: 'border-yellow-400 ring-4 ring-yellow-400/20',
        glowClass: isLightMode ? 'shadow-md' : 'shadow-[0_0_20px_rgba(250,204,21,0.3)]',
        description: 'Radiant starburst for the brightest class personalities',
      };
    case 'crown':
      return {
        type: 'crown',
        label: 'Imperial Crown',
        icon: Crown,
        iconColor: isLightMode ? 'text-emerald-800' : 'text-emerald-300',
        shapeClass: isLightMode 
          ? 'rounded-2xl border-2 border-emerald-600/70 bg-emerald-100/80' 
          : 'rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-500/25 to-teal-600/15',
        badgeClass: isLightMode 
          ? 'text-emerald-900 border-emerald-500 bg-emerald-50 font-bold' 
          : 'text-emerald-300 border-emerald-400/35 bg-emerald-400/15',
        borderClass: 'border-emerald-400 ring-4 ring-emerald-400/20',
        glowClass: isLightMode ? 'shadow-md' : 'shadow-[0_0_20px_rgba(52,211,153,0.3)]',
        description: 'Regal crown for executive department leadership & influence',
      };
    case 'gold':
    default:
      return {
        type: 'gold',
        label: 'Gold Trophy',
        icon: Trophy,
        iconColor: isLightMode ? 'text-amber-700' : 'text-[#d4af37]',
        shapeClass: isLightMode 
          ? 'rounded-2xl border-2 border-amber-600/80 bg-amber-100/80' 
          : 'rounded-2xl border-2 border-[#d4af37]/80 bg-gradient-to-br from-[#d4af37]/30 to-amber-700/15',
        badgeClass: isLightMode 
          ? 'text-amber-900 border-amber-500 bg-amber-50 font-bold' 
          : 'text-[#d4af37] border-[#d4af37]/40 bg-[#d4af37]/15',
        borderClass: 'border-[#d4af37] ring-4 ring-[#d4af37]/25',
        glowClass: isLightMode ? 'shadow-md' : 'shadow-[0_0_20px_rgba(212,175,55,0.35)]',
        description: 'Classic gold cup for premier superlative winners',
      };
  }
}
