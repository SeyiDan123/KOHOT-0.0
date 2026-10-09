export interface DarkLuxuryTheme {
  id: string;
  name: string;
  description: string;
  accentHex: string;
  previewBg: string;
  textureUrl: string;
  cssGradient: string;
  overlayClass: string;
}

// Embedded authentic luxury texture patterns (high-precision micro-textures without photograph separation)
const VELVET_TEXTURE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.7'/%3E%3C/svg%3E`;
const LEATHER_GRAIN_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='leatherFilter'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.6' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.15 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23leatherFilter)' opacity='0.65'/%3E%3C/svg%3E`;
const SILK_WEAVE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='silkFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85 0.35' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23silkFilter)' opacity='0.6'/%3E%3C/svg%3E`;
const SLATE_MINERAL_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='slateFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.14 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23slateFilter)' opacity='0.7'/%3E%3C/svg%3E`;

// Authentic luxury fine-art paper texture with archival cotton micro-fibers and gentle tooth
export const LUXURY_PAPER_TEXTURE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 320 320' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='luxuryPaperGrain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04 0.85' numOctaves='4' result='fiber'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.18   0 0 0 0 0.16   0 0 0 0 0.12  0 0 0 0.12 0' result='coloredFiber'/%3E%3CfeTurbulence type='turbulence' baseFrequency='0.7' numOctaves='3' result='grain'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.14   0 0 0 0 0.12   0 0 0 0 0.08  0 0 0 0.10 0' result='coloredGrain'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredFiber'/%3E%3CfeMergeNode in='coloredGrain'/%3E%3C/feMerge%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23luxuryPaperGrain)'/%3E%3C/svg%3E`;

export const DEFAULT_LUXURY_THEMES: DarkLuxuryTheme[] = [
  {
    id: 'dark-grey',
    name: 'Dark Grey Slate',
    description: 'Deep sophisticated neutral dark grey slate with ultra-fine mineral texture.',
    accentHex: '#94a3b8',
    previewBg: '#15171c',
    textureUrl: SLATE_MINERAL_SVG,
    cssGradient: 'linear-gradient(180deg, #181a20 0%, #111317 50%, #0c0d10 100%)',
    overlayClass: 'bg-[#14161a]',
  },
  {
    id: 'teal',
    name: 'Midnight Teal',
    description: 'Deep peacock ocean teal with fine raw silk weave and jewel-toned mineral luster.',
    accentHex: '#0d898e',
    previewBg: '#071618',
    textureUrl: SILK_WEAVE_SVG,
    cssGradient: 'linear-gradient(180deg, #091a1d 0%, #061316 50%, #030a0c 100%)',
    overlayClass: 'bg-[#061416]',
  },
  {
    id: 'forest',
    name: 'Dark Forest',
    description: 'Deep evergreen pine canopy with dark emerald morocco leather archival grain.',
    accentHex: '#18795c',
    previewBg: '#071610',
    textureUrl: LEATHER_GRAIN_SVG,
    cssGradient: 'linear-gradient(180deg, #0a1b14 0%, #06140e 50%, #030b08 100%)',
    overlayClass: 'bg-[#06150f]',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Gold',
    description: 'Dark charcoal obsidian slate infused with micro-mineral 24k gold fleck granite.',
    accentHex: '#d4af37',
    previewBg: '#121319',
    textureUrl: SLATE_MINERAL_SVG,
    cssGradient: 'linear-gradient(180deg, #151720 0%, #0f1017 50%, #090a0e 100%)',
    overlayClass: 'bg-[#111218]',
  },
  {
    id: 'amethyst',
    name: 'Royal Amethyst',
    description: 'Imperial violet & dark plum silk moiré reflecting academic dignity and prestige.',
    accentHex: '#8e3898',
    previewBg: '#16081a',
    textureUrl: VELVET_TEXTURE_SVG,
    cssGradient: 'linear-gradient(180deg, #1d0a22 0%, #140618 50%, #0c030f 100%)',
    overlayClass: 'bg-[#150719]',
  },
  {
    id: 'carbon',
    name: 'Slate Carbon',
    description: 'High-precision dark charcoal titanium with subtle architectural geometric micro-weave.',
    accentHex: '#64748b',
    previewBg: '#111319',
    textureUrl: SLATE_MINERAL_SVG,
    cssGradient: 'linear-gradient(180deg, #141720 0%, #0e1017 50%, #08090d 100%)',
    overlayClass: 'bg-[#101218]',
  },
  {
    id: 'navy',
    name: 'Imperial Navy',
    description: 'Deep cosmic starlight sapphire navy with archival library buckram book cloth.',
    accentHex: '#2563eb',
    previewBg: '#081020',
    textureUrl: SILK_WEAVE_SVG,
    cssGradient: 'linear-gradient(180deg, #0a1428 0%, #060e1d 50%, #03070f 100%)',
    overlayClass: 'bg-[#070f20]',
  },
  {
    id: 'espresso',
    name: 'Espresso Bronze',
    description: 'Rich dark mocha chocolate velvet with burnished antique bronze saffiano grain.',
    accentHex: '#a1551c',
    previewBg: '#180f08',
    textureUrl: LEATHER_GRAIN_SVG,
    cssGradient: 'linear-gradient(180deg, #1d120a 0%, #150c06 50%, #0c0703 100%)',
    overlayClass: 'bg-[#170e08]',
  },
];

// Helper to retrieve live synced luxury themes from localStorage
export function getStoredLuxuryThemes(): DarkLuxuryTheme[] {
  try {
    const raw = localStorage.getItem('kohot_dark_luxury_themes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => (t.id === 'burgundy' ? DEFAULT_LUXURY_THEMES[0] : t));
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_LUXURY_THEMES;
}

// Broadcasts changes across owner dashboard, album admin dashboard, and live album
export function saveStoredLuxuryThemes(themes: DarkLuxuryTheme[]): void {
  try {
    localStorage.setItem('kohot_dark_luxury_themes', JSON.stringify(themes));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kohot_luxury_themes_updated', { detail: themes }));
    }
  } catch {
    // ignore
  }
}

export function getLuxuryThemeById(themeId?: string, customList?: DarkLuxuryTheme[]): DarkLuxuryTheme {
  const list = (customList && customList.length > 0) ? customList : getStoredLuxuryThemes();
  if (!themeId || themeId.toLowerCase() === 'burgundy') return list[0];
  const found = list.find((t) => t.id.toLowerCase() === themeId.toLowerCase());
  return found || list[0];
}
