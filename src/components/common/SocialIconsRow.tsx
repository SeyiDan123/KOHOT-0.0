import React from 'react';
import { 
  Linkedin, 
  Instagram, 
  Facebook, 
  MessageCircle, 
  Mail 
} from 'lucide-react';
import { getSocialUrls } from '../../utils/socialHelpers';

interface SocialIconsRowProps {
  socials?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    tiktok?: string;
    facebook?: string;
  };
  instagramOrTwitter?: string;
  whatsappNumber?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isLightMode?: boolean;
}

export const SocialIconsRow: React.FC<SocialIconsRowProps> = ({
  socials,
  instagramOrTwitter,
  whatsappNumber,
  email,
  size = 'md',
  className = '',
  isLightMode = false,
}) => {
  const { linkedinUrl, instagramUrl, twitterUrl, facebookUrl, whatsappUrl } = getSocialUrls(
    socials,
    instagramOrTwitter,
    whatsappNumber
  );

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4.5 h-4.5',
  };

  const buttonPaddings = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const hasAnySocial = Boolean(
    linkedinUrl || instagramUrl || twitterUrl || facebookUrl || whatsappUrl || email
  );

  if (!hasAnySocial) return null;

  const baseBtnClass = isLightMode
    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
    : 'bg-white/5 text-zinc-300 border-white/10 hover:border-white/20';

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {/* LinkedIn */}
      {linkedinUrl && (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} hover:bg-[#0077b5]/15 hover:text-[#0077b5] border hover:border-[#0077b5]/40 transition-all cursor-pointer`}
          title="LinkedIn Profile"
          aria-label="LinkedIn Profile"
          onClick={(e) => e.stopPropagation()}
        >
          <Linkedin className={iconSizes[size]} />
        </a>
      )}

      {/* Instagram */}
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} hover:bg-[#E1306C]/15 hover:text-[#E1306C] border hover:border-[#E1306C]/40 transition-all cursor-pointer`}
          title="Instagram Profile"
          aria-label="Instagram Profile"
          onClick={(e) => e.stopPropagation()}
        >
          <Instagram className={iconSizes[size]} />
        </a>
      )}

      {/* X */}
      {twitterUrl && (
        <a
          href={twitterUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} hover:bg-black/10 dark:hover:bg-white/20 hover:text-black dark:hover:text-white border hover:border-black/30 dark:hover:border-white/30 transition-all cursor-pointer flex items-center justify-center`}
          title="X Profile"
          aria-label="X Profile"
          onClick={(e) => e.stopPropagation()}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`${iconSizes[size]} fill-current`}
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      )}

      {/* Facebook */}
      {facebookUrl && (
        <a
          href={facebookUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} hover:bg-[#1877F2]/15 hover:text-[#1877F2] border hover:border-[#1877F2]/40 transition-all cursor-pointer`}
          title="Facebook Profile"
          aria-label="Facebook Profile"
          onClick={(e) => e.stopPropagation()}
        >
          <Facebook className={iconSizes[size]} />
        </a>
      )}

      {/* WhatsApp */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} hover:bg-[#25D366]/15 hover:text-[#25D366] border hover:border-[#25D366]/40 transition-all cursor-pointer`}
          title="Chat on WhatsApp"
          aria-label="Chat on WhatsApp"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle className={iconSizes[size]} />
        </a>
      )}

      {/* Email */}
      {email && (
        <a
          href={`mailto:${email}`}
          className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} hover:bg-amber-400/20 hover:text-amber-500 border hover:border-amber-400/40 transition-all cursor-pointer`}
          title={`Email: ${email}`}
          aria-label={`Email ${email}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Mail className={iconSizes[size]} />
        </a>
      )}
    </div>
  );
};
