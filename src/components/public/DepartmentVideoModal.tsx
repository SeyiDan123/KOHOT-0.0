import React from 'react';
import { X, Play, Calendar, ExternalLink } from 'lucide-react';
import {
  getUniversalVideoEmbedUrl,
  getVideoPlatformLabel,
  normalizeStreamingVideoUrl,
} from '../../utils/youtube';
import { DepartmentVideoItem } from '../../types';

interface DepartmentVideoModalProps {
  isOpen: boolean;
  video: DepartmentVideoItem | null;
  onClose: () => void;
  departmentName?: string;
}

export const DepartmentVideoModal: React.FC<DepartmentVideoModalProps> = ({
  isOpen,
  video,
  onClose,
  departmentName,
}) => {
  const rawUrl = normalizeStreamingVideoUrl(video ? video.videoUrl || video.youtubeUrl || '' : '');
  const { embedUrl, provider, isVertical } = getUniversalVideoEmbedUrl(rawUrl);
  const platformLabel = getVideoPlatformLabel(rawUrl);

  if (!isOpen || !video) return null;

  const externalHref = rawUrl.startsWith('http')
    ? rawUrl
    : provider === 'youtube'
    ? `https://www.youtube.com/watch?v=${rawUrl}`
    : rawUrl;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn"
    >
      <div
        className={`relative w-full ${
          isVertical ? 'max-w-md' : 'max-w-4xl'
        } bg-[#0c0d14] border border-white/15 rounded-3xl overflow-hidden shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-[#08090e]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <Play className="w-4 h-4 fill-red-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-syne font-bold text-white text-sm sm:text-base truncate">
                {video.title}
              </h3>
              {departmentName && (
                <p className="font-mono-tech text-[10px] text-zinc-400 uppercase tracking-wider truncate">
                  {departmentName} • {platformLabel}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close video player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Stream Player Container */}
        <div
          className={`relative w-full bg-black flex items-center justify-center ${
            isVertical ? 'aspect-[9/16] max-h-[72vh]' : 'aspect-video'
          }`}
        >
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={video.title}
              className="w-full h-full border-0 bg-black"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <p className="text-zinc-300 font-body text-sm max-w-sm">
                Unable to load embedded stream for this {platformLabel} link.
              </p>
            </div>
          )}
        </div>

        {/* Video Metadata Footer */}
        {(video.dateStr || video.description) && (
          <div className="p-5 sm:p-6 bg-[#0c0d14] space-y-1.5">
            {video.dateStr && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-tech text-[#d4af37] uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                <span>{video.dateStr}</span>
              </div>
            )}
            {video.description && (
              <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
                {video.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
