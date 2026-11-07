/**
 * Universal Video & Social Media Streaming Embed Helper Utilities
 * Supports YouTube (watch, youtu.be, shorts, live, embed), Vimeo, TikTok, Instagram (Reels/Posts/TV),
 * Facebook Videos/Reels, X (Twitter) Video Posts, Google Drive, and Loom.
 */

export type VideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'drive'
  | 'loom'
  | 'other';

const LEGACY_SAMPLE_VIDEO_FALLBACKS: Record<string, string> = {
  'forbiggerblazes.mp4': 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
  'forbiggerescapes.mp4': 'https://www.youtube.com/watch?v=wHGqp8lz36c',
  'forbiggerfun.mp4': 'https://www.youtube.com/watch?v=pxBQLFLei70',
  'forbiggerjoy.mp4': 'https://www.youtube.com/watch?v=ji5_MqicxSo',
  'forbiggermeltdowns.mp4': 'https://www.youtube.com/watch?v=8S0FDjFBj8o',
};

/**
 * Automatically upgrades any legacy preloaded sample URLs to real YouTube streaming URLs
 */
export function normalizeStreamingVideoUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  for (const [sampleKey, ytUrl] of Object.entries(LEGACY_SAMPLE_VIDEO_FALLBACKS)) {
    if (lower.includes(sampleKey)) {
      return ytUrl;
    }
  }
  if (lower.includes('gtv-videos-bucket')) {
    return 'https://www.youtube.com/watch?v=UF8uR6Z6KLc';
  }
  return trimmed;
}

export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = normalizeStreamingVideoUrl(urlOrId);

  // Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Detect the streaming video platform (YouTube or social media platforms)
 */
export function detectVideoProvider(rawUrl: string): VideoProvider {
  if (!rawUrl) return 'other';
  const trimmed = normalizeStreamingVideoUrl(rawUrl);
  const lower = trimmed.toLowerCase();

  let host = '';
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // Fallback to string checks
  }

  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtu.be' ||
    host === 'youtube-nocookie.com' ||
    extractYouTubeId(trimmed) !== null
  ) {
    return 'youtube';
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com' || lower.includes('vimeo.com/')) {
    return 'vimeo';
  }

  if (
    host === 'tiktok.com' ||
    host === 'm.tiktok.com' ||
    host === 'vm.tiktok.com' ||
    host === 'vt.tiktok.com' ||
    lower.includes('tiktok.com/')
  ) {
    return 'tiktok';
  }

  if (host === 'instagram.com' || host === 'instagr.am' || lower.includes('instagram.com/')) {
    return 'instagram';
  }

  if (
    host === 'facebook.com' ||
    host === 'm.facebook.com' ||
    host === 'web.facebook.com' ||
    host === 'fb.watch' ||
    host === 'fb.com' ||
    lower.includes('facebook.com/') ||
    lower.includes('fb.watch/')
  ) {
    return 'facebook';
  }

  if (
    host === 'twitter.com' ||
    host === 'x.com' ||
    host === 'mobile.twitter.com' ||
    lower.includes('twitter.com/') ||
    lower.includes('x.com/')
  ) {
    return 'twitter';
  }

  if (host === 'drive.google.com' || lower.includes('drive.google.com/')) {
    return 'drive';
  }

  if (host === 'loom.com' || lower.includes('loom.com/')) {
    return 'loom';
  }

  return 'other';
}

/**
 * Check whether a URL is a valid https:// video link from YouTube or supported social media platforms
 */
export function isSupportedVideoHighlightUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const trimmed = normalizeStreamingVideoUrl(rawUrl);
  if (!trimmed.toLowerCase().startsWith('https://')) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const provider = detectVideoProvider(trimmed);
    return provider !== 'other';
  } catch {
    return false;
  }
}

/**
 * Get human-readable platform host label for badges & cards
 */
export function getVideoPlatformLabel(rawUrl: string): string {
  const normalized = normalizeStreamingVideoUrl(rawUrl);
  const provider = detectVideoProvider(normalized);
  switch (provider) {
    case 'youtube':
      return 'YouTube';
    case 'vimeo':
      return 'Vimeo';
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'facebook':
      return 'Facebook';
    case 'twitter':
      return 'X (Twitter)';
    case 'drive':
      return 'Google Drive';
    case 'loom':
      return 'Loom';
    default: {
      try {
        const parsed = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
        return parsed.hostname.replace(/^www\./, '') || 'Social Stream';
      } catch {
        return 'YouTube';
      }
    }
  }
}

/**
 * Returns an embeddable player URL for YouTube or supported social media platforms
 */
export function getUniversalVideoEmbedUrl(urlOrId: string): {
  embedUrl: string | null;
  isDirectVideo: boolean;
  provider: VideoProvider;
  isVertical?: boolean;
} {
  if (!urlOrId) return { embedUrl: null, isDirectVideo: false, provider: 'other' };
  const trimmed = normalizeStreamingVideoUrl(urlOrId);
  const provider = detectVideoProvider(trimmed);

  if (provider === 'youtube') {
    const id = extractYouTubeId(trimmed);
    if (!id) return { embedUrl: null, isDirectVideo: false, provider: 'youtube' };
    const isShorts = trimmed.toLowerCase().includes('/shorts/');
    return {
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      isDirectVideo: false,
      provider: 'youtube',
      isVertical: isShorts,
    };
  }

  if (provider === 'vimeo') {
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?([0-9]+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return {
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&byline=0&portrait=0`,
        isDirectVideo: false,
        provider: 'vimeo',
      };
    }
  }

  if (provider === 'tiktok') {
    const tiktokMatch =
      trimmed.match(/(?:\/video\/|\/v\/|embed\/v2\/|embed\/)([0-9]{15,22})/i) ||
      trimmed.match(/([0-9]{18,20})/);
    if (tiktokMatch && tiktokMatch[1]) {
      return {
        embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`,
        isDirectVideo: false,
        provider: 'tiktok',
        isVertical: true,
      };
    }
    return {
      embedUrl: null,
      isDirectVideo: false,
      provider: 'tiktok',
      isVertical: true,
    };
  }

  if (provider === 'instagram') {
    const igMatch = trimmed.match(/(?:\/(?:reel|reels|p|tv)\/)([a-zA-Z0-9_-]+)/i);
    if (igMatch && igMatch[1]) {
      return {
        embedUrl: `https://www.instagram.com/p/${igMatch[1]}/embed/`,
        isDirectVideo: false,
        provider: 'instagram',
        isVertical: true,
      };
    }
    return {
      embedUrl: null,
      isDirectVideo: false,
      provider: 'instagram',
      isVertical: true,
    };
  }

  if (provider === 'facebook') {
    const isReel = trimmed.toLowerCase().includes('/reel/') || trimmed.toLowerCase().includes('/share/r/');
    return {
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false&autoplay=true`,
      isDirectVideo: false,
      provider: 'facebook',
      isVertical: isReel,
    };
  }

  if (provider === 'twitter') {
    const statusMatch = trimmed.match(/status\/([0-9]+)/i);
    if (statusMatch && statusMatch[1]) {
      return {
        embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${statusMatch[1]}&theme=dark`,
        isDirectVideo: false,
        provider: 'twitter',
      };
    }
    return {
      embedUrl: null,
      isDirectVideo: false,
      provider: 'twitter',
    };
  }

  if (provider === 'drive') {
    const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return {
        embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
        isDirectVideo: false,
        provider: 'drive',
      };
    }
  }

  if (provider === 'loom') {
    const loomMatch = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    if (loomMatch && loomMatch[1]) {
      return {
        embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
        isDirectVideo: false,
        provider: 'loom',
      };
    }
  }

  return {
    embedUrl: trimmed.startsWith('http') ? trimmed : null,
    isDirectVideo: false,
    provider: 'other',
  };
}

export function getYouTubeEmbedUrl(urlOrId: string): string | null {
  return getUniversalVideoEmbedUrl(urlOrId).embedUrl;
}

export function getYouTubeThumbnailUrl(urlOrId: string): string {
  const id = extractYouTubeId(urlOrId);
  if (!id) {
    return 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80';
  }
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
