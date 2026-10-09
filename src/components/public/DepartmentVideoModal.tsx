import React from 'react';
import { DepartmentVideoItem } from '../../types';
import { getUniversalVideoEmbedUrl } from '../../utils/youtube';
import { ExternalLink, Play } from 'lucide-react';
import { UniversalModal } from '../common/UniversalModal';

interface DepartmentVideoModalProps {
  isOpen: boolean;
  video: DepartmentVideoItem | null;
  onClose: () => void;
  departmentName: string;
}

export const DepartmentVideoModal: React.FC<DepartmentVideoModalProps> = ({
  isOpen,
  video,
  onClose,
  departmentName,
}) => {
  if (!isOpen || !video) return null;

  const rawUrl = video.videoUrl || video.youtubeUrl || '';
  const { embedUrl, isDirectVideo, provider } = getUniversalVideoEmbedUrl(rawUrl);

  const displayProvider = provider === 'youtube' ? 'YouTube' : provider === 'vimeo' ? 'Vimeo' : provider === 'loom' ? 'Loom' : provider === 'drive' ? 'Google Drive' : provider === 'direct' ? 'Direct Video' : 'Video Highlight';

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      bodyClassName="!p-0 overflow-hidden"
      title={
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
            <Play className="w-3.5 h-3.5 text-red-400 fill-red-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-syne font-bold text-base text-black truncate">
              {video.title}
            </h3>
            <p className="font-mono-tech text-[11px] text-zinc-600 truncate">
              {departmentName} • {displayProvider} Video Highlight
            </p>
          </div>
          {rawUrl && (
            <a
              href={rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 ml-2 rounded-full bg-white hover:bg-zinc-100 text-zinc-600 hover:text-black border border-zinc-200 transition-colors cursor-pointer shrink-0"
              title={`Open source on ${displayProvider}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      }
    >
      <div className="flex flex-col">
        {/* 16:9 Video Frame */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          {isDirectVideo && embedUrl ? (
            <video
              src={embedUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <p className="text-sm font-mono-tech text-zinc-400">
                Unable to load embedded video preview.
              </p>
              {rawUrl && (
                <a
                  href={rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-mono-tech text-white transition-colors"
                >
                  Open Original Video Link
                </a>
              )}
            </div>
          )}
        </div>

        {/* Video Description Footer */}
        {video.description && (
          <div className="p-5 border-t border-zinc-300 bg-[#f0f2f5] text-xs font-body text-black">
            <p className="font-mono-tech text-[10px] uppercase text-zinc-600 font-bold tracking-wider mb-1">
              About this video
            </p>
            <p className="leading-relaxed whitespace-pre-wrap text-black">{video.description}</p>
          </div>
        )}
      </div>
    </UniversalModal>
  );
};
