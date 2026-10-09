import { getWhatsAppDigits } from './phoneFormatter';

export interface FormattedSocials {
  linkedinUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  whatsappUrl?: string;
}

export const getSocialUrls = (
  socials?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    tiktok?: string;
    facebook?: string;
  },
  instagramOrTwitter?: string,
  whatsappNumber?: string
): FormattedSocials => {
  const result: FormattedSocials = {};

  // LinkedIn
  const rawLinkedin = socials?.linkedin?.trim();
  if (rawLinkedin) {
    if (rawLinkedin.startsWith('http://') || rawLinkedin.startsWith('https://')) {
      result.linkedinUrl = rawLinkedin;
    } else if (rawLinkedin.startsWith('linkedin.com')) {
      result.linkedinUrl = `https://${rawLinkedin}`;
    } else {
      result.linkedinUrl = `https://linkedin.com/in/${rawLinkedin.replace('@', '')}`;
    }
  }

  // Instagram
  const rawInstagram = (socials?.instagram || (instagramOrTwitter && !instagramOrTwitter.includes('twitter') && !instagramOrTwitter.includes('linkedin') ? instagramOrTwitter : ''))?.trim();
  if (rawInstagram) {
    if (rawInstagram.startsWith('http://') || rawInstagram.startsWith('https://')) {
      result.instagramUrl = rawInstagram;
    } else if (rawInstagram.startsWith('instagram.com')) {
      result.instagramUrl = `https://${rawInstagram}`;
    } else {
      result.instagramUrl = `https://instagram.com/${rawInstagram.replace('@', '')}`;
    }
  }

  // X / Twitter
  const rawTwitter = (socials?.twitter || (instagramOrTwitter && instagramOrTwitter.includes('twitter') ? instagramOrTwitter : ''))?.trim();
  if (rawTwitter) {
    if (rawTwitter.startsWith('http://') || rawTwitter.startsWith('https://')) {
      result.twitterUrl = rawTwitter;
    } else if (rawTwitter.startsWith('x.com') || rawTwitter.startsWith('twitter.com')) {
      result.twitterUrl = `https://${rawTwitter}`;
    } else {
      result.twitterUrl = `https://x.com/${rawTwitter.replace('@', '')}`;
    }
  }

  // Facebook
  const rawFacebook = socials?.facebook?.trim();
  if (rawFacebook) {
    if (rawFacebook.startsWith('http://') || rawFacebook.startsWith('https://')) {
      result.facebookUrl = rawFacebook;
    } else if (rawFacebook.startsWith('facebook.com')) {
      result.facebookUrl = `https://${rawFacebook}`;
    } else {
      result.facebookUrl = `https://facebook.com/${rawFacebook.replace('@', '')}`;
    }
  }

  // WhatsApp with Nigerian country-code auto-formatter
  const rawWa = whatsappNumber?.trim();
  if (rawWa) {
    const cleanNumber = getWhatsAppDigits(rawWa);
    if (cleanNumber) {
      result.whatsappUrl = `https://wa.me/${cleanNumber}`;
    }
  }

  return result;
};
