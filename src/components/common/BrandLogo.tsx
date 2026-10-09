import React from 'react';

interface BrandLogoProps {
  logoUrl?: string;
  brandName?: string;
  className?: string;
  showText?: boolean;
  textSize?: string;
  textColor?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoUrl,
  brandName = 'KOHOT',
  className = '',
  showText = true,
  textSize = 'text-sm sm:text-base',
  textColor,
}) => {
  const computedTextColor = textColor || 'text-slate-900 dark:text-white';

  return (
    <div className={`flex items-center gap-2 shrink-0 select-none ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName}
          className="w-5 h-5 sm:w-5.5 sm:h-5.5 object-contain shrink-0"
        />
      ) : (
        <div className="w-4 h-4 rounded bg-zinc-950 dark:bg-zinc-900 flex items-center justify-center shrink-0 shadow-xs border border-zinc-300 dark:border-zinc-700">
          <div className="w-2 h-2 bg-[#d4af37] rotate-45 transform" />
        </div>
      )}
      {showText && (
        <span className={`font-syne font-black tracking-wider uppercase transition-colors ${computedTextColor} ${textSize}`}>
          {brandName}
        </span>
      )}
    </div>
  );
};
