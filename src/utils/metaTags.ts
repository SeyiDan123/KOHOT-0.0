/**
 * Dynamic OpenGraph and Social Media Meta Tag Updater for KoHot
 * Ensures that when links are shared or inspected, the album hero image is injected as the thumbnail.
 */
export function updateSocialMetaTags(data: {
  title: string;
  description: string;
  imageUrl: string;
  url?: string;
}) {
  if (typeof document === 'undefined') return;

  // Title
  document.title = data.title;

  const setMeta = (attr: 'property' | 'name', key: string, content: string) => {
    let element = document.querySelector(`meta[${attr}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attr, key);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  // Standard OpenGraph
  setMeta('property', 'og:title', data.title);
  setMeta('property', 'og:description', data.description);
  setMeta('property', 'og:image', data.imageUrl);
  if (data.url) {
    setMeta('property', 'og:url', data.url);
  }

  // Twitter
  setMeta('name', 'twitter:title', data.title);
  setMeta('name', 'twitter:description', data.description);
  setMeta('name', 'twitter:image', data.imageUrl);
}
