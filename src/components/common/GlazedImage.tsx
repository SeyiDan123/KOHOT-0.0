import React, { useState, useRef, useEffect } from 'react';

interface GlazedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string; // e.g. "aspect-[4/5]", "aspect-video", "aspect-square"
  priority?: boolean;
  showMonogram?: boolean;
}

export const GlazedImage: React.FC<GlazedImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  aspectRatio,
  priority = false,
  showMonogram = true,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initials = alt
    ? alt
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('')
    : '';

  return (
    <div
      className={`relative overflow-hidden bg-[#0c0d13] select-none ${
        aspectRatio ? aspectRatio : ''
      } ${containerClassName}`}
    >
      {/* Fallback Display if image missing or fails */}
      {hasError || !src ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-3 bg-gradient-to-br from-[#12141f] via-[#0c0d14] to-[#181a26] text-zinc-400 border border-white/5">
          {showMonogram && initials ? (
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-1 shadow-inner">
              <span className="font-syne font-bold text-base text-white tracking-wider">
                {initials}
              </span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
              <div className="w-2.5 h-2.5 bg-white/40 rotate-45 transform" />
            </div>
          )}
          <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 text-center line-clamp-1 max-w-[90%]">
            {alt || 'Photo'}
          </span>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${className}`}
          {...props}
        />
      )}
    </div>
  );
};

