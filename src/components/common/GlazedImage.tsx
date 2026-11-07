import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

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
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Synchronously check if already cached in browser so cached images appear in 0ms
  useLayoutEffect(() => {
    setHasError(false);
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [src]);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  return (
    <div
      className={`relative overflow-hidden bg-[#08090d] select-none ${
        aspectRatio ? aspectRatio : ''
      } ${containerClassName}`}
    >
      {/* AI-Style Moving Black Wave Loader while image is loading */}
      {!hasError && Boolean(src) && !isLoaded && (
        <div
          aria-hidden="true"
          className="kohot-ai-wave-loader absolute inset-0 z-10 pointer-events-none"
        />
      )}

      {/* Default Error / Missing Image Fallback: Official KoHot Logo */}
      {hasError || !src ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-3 bg-gradient-to-br from-[#0e1017] via-[#090a0f] to-[#141722] text-zinc-300 border border-white/5">
          <div className="w-11 h-11 rounded-2xl bg-[#141620] border border-[#d4af37]/45 shadow-[0_0_20px_rgba(212,175,55,0.15)] flex items-center justify-center mb-1.5">
            <span className="font-syne font-extrabold text-base text-[#d4af37] tracking-tight">
              K
            </span>
          </div>
          <span className="font-syne font-extrabold text-[11px] tracking-wider text-white/90">
            KoHot
          </span>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : props.loading || 'eager'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : undefined}
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            setIsLoaded(true);
            props.onLoad?.(e);
          }}
          onError={(e) => {
            setHasError(true);
            props.onError?.(e);
          }}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
};
