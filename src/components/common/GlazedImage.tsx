import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ImageOff } from 'lucide-react';

interface GlazedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string; // e.g. "aspect-[4/5]", "aspect-video", "aspect-square"
  priority?: boolean;
  showMonogram?: boolean;
}

const getInitialsMonogram = (text: string): string => {
  const cleaned = (text || '').trim();
  if (!cleaned) return '••';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
};

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
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Synchronously check if already cached in browser so cached images appear immediately
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
      className={`relative overflow-hidden bg-zinc-900 select-none ${
        aspectRatio ? aspectRatio : ''
      } ${containerClassName}`}
    >
      {/* Slow AI-Style Moving Black Wave Loader while image is loading */}
      {!hasError && Boolean(src) && !isLoaded && (
        <div
          aria-hidden="true"
          className="kohot-ai-wave-loader absolute inset-0 z-10 pointer-events-none"
        />
      )}

      {/* Restored Previous Error / Missing Image Fallback (Monogram or Subtle Placeholder, NOT KoHot Logo) */}
      {hasError || !src ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-3 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-zinc-400">
          {showMonogram && alt ? (
            <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="font-syne font-bold text-sm text-zinc-300 tracking-wider">
                {getInitialsMonogram(alt)}
              </span>
            </div>
          ) : (
            <ImageOff className="w-5 h-5 text-zinc-500 opacity-60" />
          )}
        </div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : props.loading || 'lazy'}
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

