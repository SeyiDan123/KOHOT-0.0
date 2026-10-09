import React from 'react';

interface GraduationPatternProps {
  opacity?: number;
  className?: string;
}

/**
 * Graduation Background Icon Pattern
 * Displays scattered line-art graduation motifs: mortarboard caps with tassels,
 * diploma scrolls tied with ribbons, academic stars, and laurel branches.
 * In dark mode, motifs are styled in crisp mid grey (#a1a1aa) with distinct mid-grey shape fills
 * so each element's shape distinctly and clearly shows.
 */
export const GraduationPattern: React.FC<GraduationPatternProps> = ({
  opacity,
  className = '',
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none z-0 overflow-hidden text-zinc-500 dark:text-zinc-400 ${
        opacity === undefined ? 'opacity-[0.09] dark:opacity-[0.21]' : ''
      } ${className}`}
      style={opacity !== undefined ? { opacity: opacity * 0.5 } : undefined}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <style>
            {`
              .grad-shape {
                stroke: #71717a;
                fill: rgba(113, 113, 122, 0.045);
              }
              .grad-line {
                stroke: #71717a;
                fill: none;
              }
              html.dark .grad-shape,
              .dark .grad-shape {
                stroke: #a1a1aa;
                fill: rgba(161, 161, 170, 0.11);
              }
              html.dark .grad-line,
              .dark .grad-line {
                stroke: #a1a1aa;
                fill: none;
              }
              .grad-gold-fill {
                fill: #d4af37;
              }
              .grad-gold-stroke {
                stroke: #d4af37;
              }
              html.dark .grad-gold-fill,
              .dark .grad-gold-fill {
                fill: #e6c158;
              }
              html.dark .grad-gold-stroke,
              .dark .grad-gold-stroke {
                stroke: #e6c158;
              }
            `}
          </style>
          <pattern
            id="grad-pattern-grid"
            width="220"
            height="220"
            patternUnits="userSpaceOnUse"
          >
            {/* 1. Large Mortarboard Graduation Cap (Top Left) */}
            <g transform="translate(30, 25) rotate(-8)">
              {/* Cap Diamond Top */}
              <polygon
                points="30,5 58,18 30,31 2,18"
                className="grad-shape"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Cap Skull Under-band */}
              <path
                d="M12,23 C12,33 48,33 48,23"
                className="grad-shape"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Tassel Button & String */}
              <circle cx="30" cy="18" r="2.5" className="grad-gold-fill" />
              <path
                d="M30,18 C38,19 44,25 45,34"
                className="grad-gold-stroke"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
              {/* Hanging Tassel */}
              <polygon points="43,34 47,34 46,44 44,44" className="grad-gold-fill" />
            </g>

            {/* 2. Diploma Scroll Tied with Ribbon (Top Right) */}
            <g transform="translate(145, 30) rotate(22)">
              <rect
                x="0"
                y="0"
                width="42"
                height="13"
                rx="4"
                className="grad-shape"
                strokeWidth="2"
              />
              {/* Ribbon Wrap */}
              <rect x="18" y="-1" width="6" height="15" className="grad-gold-fill" rx="1" />
              <path
                d="M21,14 L17,23 M21,14 L25,22"
                className="grad-gold-stroke"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* 3. Academic Four-Point Star Sparkle (Center) */}
            <g transform="translate(105, 95)">
              <path
                d="M10,0 L12,7 L19,10 L12,13 L10,20 L8,13 L1,10 L8,7 Z"
                className="grad-gold-fill"
              />
            </g>

            {/* 4. Mini Graduation Cap (Center Right) */}
            <g transform="translate(160, 135) rotate(-15) scale(0.75)">
              <polygon
                points="25,5 48,16 25,27 2,16"
                className="grad-shape"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path
                d="M10,20 C10,29 40,29 40,20"
                className="grad-shape"
                strokeWidth="1.8"
              />
              <path
                d="M25,16 C32,17 38,22 39,30"
                className="grad-gold-stroke"
                strokeWidth="1.6"
                fill="none"
              />
            </g>

            {/* 5. Second Rolled Diploma (Bottom Left) */}
            <g transform="translate(25, 140) rotate(-28)">
              <rect
                x="0"
                y="0"
                width="38"
                height="12"
                rx="3.5"
                className="grad-shape"
                strokeWidth="1.8"
              />
              <rect x="16" y="-1" width="5" height="14" className="grad-gold-fill" rx="1" />
              <path
                d="M18.5,13 L15,20 M18.5,13 L22,19"
                className="grad-gold-stroke"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* 6. Laurel Branch Wreath Leaf Accents (Bottom Center) */}
            <g transform="translate(95, 165)">
              <path
                d="M5,15 Q15,5 25,15"
                className="grad-line"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <ellipse cx="10" cy="9" rx="3" ry="1.5" transform="rotate(-30 10 9)" className="grad-gold-fill" />
              <ellipse cx="20" cy="9" rx="3" ry="1.5" transform="rotate(30 20 9)" className="grad-gold-fill" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad-pattern-grid)" />
      </svg>
    </div>
  );
};
