/**
 * Universal Video Utility functions to extract video IDs, generate embed URLs,
 * and fetch high-resolution fallback thumbnails for embedded department videos
 * from YouTube, Vimeo, TikTok, Google Drive, Loom, or direct MP4/WebM files.
 */

export function extractYouTubeVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // If it's already a clean 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle youtu.be/xxx
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1];
  }

  // Handle youtube.com/watch?v=xxx
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1];
  }

  // Handle youtube.com/embed/xxx
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1];
  }

  // Handle youtube.com/shorts/xxx
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) {
    return shortsMatch[1];
  }

  return null;
}

export function detectVideoProvider(rawUrl: string): 'youtube' | 'vimeo' | 'tiktok' | 'drive' | 'loom' | 'direct' | 'other' {
  if (!rawUrl) return 'other';
  const url = rawUrl.toLowerCase().trim();
  if (url.includes('youtube.com') || url.includes('youtu.be') || extractYouTubeVideoId(rawUrl)) {
    return 'youtube';
  }
  if (url.includes('vimeo.com')) {
    return 'vimeo';
  }
  if (url.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (url.includes('drive.google.com')) {
    return 'drive';
  }
  if (url.includes('loom.com')) {
    return 'loom';
  }
  if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov') || url.startsWith('blob:') || url.startsWith('data:video/')) {
    return 'direct';
  }
  return 'other';
}

export function getUniversalVideoEmbedUrl(urlOrId: string): { embedUrl: string | null; isDirectVideo: boolean; provider: string } {
  if (!urlOrId) return { embedUrl: null, isDirectVideo: false, provider: 'none' };
  const trimmed = urlOrId.trim();
  const provider = detectVideoProvider(trimmed);

  if (provider === 'youtube') {
    const id = extractYouTubeVideoId(trimmed);
    return {
      embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1` : trimmed,
      isDirectVideo: false,
      provider: 'youtube',
    };
  }

  if (provider === 'vimeo') {
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    const id = vimeoMatch ? vimeoMatch[1] : null;
    return {
      embedUrl: id ? `https://player.vimeo.com/video/${id}?autoplay=1` : trimmed,
      isDirectVideo: false,
      provider: 'vimeo',
    };
  }

  if (provider === 'loom') {
    const loomMatch = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    const id = loomMatch ? loomMatch[1] : null;
    return {
      embedUrl: id ? `https://www.loom.com/embed/${id}` : trimmed,
      isDirectVideo: false,
      provider: 'loom',
    };
  }

  if (provider === 'drive') {
    const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    const id = driveMatch ? driveMatch[1] : null;
    return {
      embedUrl: id ? `https://drive.google.com/file/d/${id}/preview` : trimmed,
      isDirectVideo: false,
      provider: 'drive',
    };
  }

  if (provider === 'direct') {
    return {
      embedUrl: trimmed,
      isDirectVideo: true,
      provider: 'direct',
    };
  }

  // Fallback
  return {
    embedUrl: trimmed,
    isDirectVideo: false,
    provider: 'other',
  };
}

export function getYouTubeEmbedUrl(urlOrId: string): string | null {
  return getUniversalVideoEmbedUrl(urlOrId).embedUrl;
}

export function getYouTubeThumbnailUrl(urlOrId: string): string {
  const ytId = extractYouTubeVideoId(urlOrId);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }
  // Fallback high quality aesthetic gradient/stage image
  return 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80';
}

