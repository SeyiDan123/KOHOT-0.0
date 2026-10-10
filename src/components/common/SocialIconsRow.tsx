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
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  isLightMode?: boolean;
  interactive?: boolean;
}

export const SocialIconsRow: React.FC<SocialIconsRowProps> = ({
  socials,
  instagramOrTwitter,
  whatsappNumber,
  email,
  size = 'md',
  className = '',
  isLightMode = false,
  interactive = true,
}) => {
  const { linkedinUrl, instagramUrl, twitterUrl, tiktokUrl, facebookUrl, whatsappUrl } = getSocialUrls(
    socials,
    instagramOrTwitter,
    whatsappNumber
  );

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-4.5 h-4.5',
  };

  const buttonPaddings = {
    xs: 'p-1',
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const hasAnySocial = Boolean(
    linkedinUrl || instagramUrl || twitterUrl || tiktokUrl || facebookUrl || whatsappUrl || email
  );

  if (!hasAnySocial) return null;

  const baseBtnClass = isLightMode
    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
    : 'bg-white/5 text-zinc-300 border-white/10 hover:border-white/20';

  const renderIconItem = (
    key: string,
    href: string,
    title: string,
    iconNode: React.ReactNode,
    hoverClass: string
  ) => {
    if (!interactive) {
      return (
        <span
          key={key}
          className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} border flex items-center justify-center opacity-80 pointer-events-none`}
        >
          {iconNode}
        </span>
      );
    }

    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`${buttonPaddings[size]} rounded-full ${baseBtnClass} ${hoverClass} border transition-all cursor-pointer flex items-center justify-center`}
        title={title}
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {iconNode}
      </a>
    );
  };

  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 flex-wrap ${className}`}>
      {/* LinkedIn */}
      {linkedinUrl &&
        renderIconItem(
          'linkedin',
          linkedinUrl,
          'LinkedIn Profile',
          <Linkedin className={iconSizes[size]} />,
          'hover:bg-[#0077b5]/15 hover:text-[#0077b5] hover:border-[#0077b5]/40'
        )}

      {/* Instagram */}
      {instagramUrl &&
        renderIconItem(
          'instagram',
          instagramUrl,
          'Instagram Profile',
          <Instagram className={iconSizes[size]} />,
          'hover:bg-[#E1306C]/15 hover:text-[#E1306C] hover:border-[#E1306C]/40'
        )}

      {/* X / Twitter */}
      {twitterUrl &&
        renderIconItem(
          'twitter',
          twitterUrl,
          'X Profile',
          <svg viewBox="0 0 24 24" aria-hidden="true" className={`${iconSizes[size]} fill-current`}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>,
          'hover:bg-black/10 dark:hover:bg-white/20 hover:text-black dark:hover:text-white hover:border-black/30 dark:hover:border-white/30'
        )}

      {/* TikTok */}
      {tiktokUrl &&
        renderIconItem(
          'tiktok',
          tiktokUrl,
          'TikTok Profile',
          <svg viewBox="0 0 24 24" aria-hidden="true" className={`${iconSizes[size]} fill-current`}>
            <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 2.373-4.538c.328 0 .644.055.938.156V9.43a6.33 6.33 0 0 0-.938-.07 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.756a8.196 8.196 0 0 0 4.771 1.517V6.828c-.352 0-.691-.049-1-.142z"/>
          </svg>,
          'hover:bg-black/10 dark:hover:bg-white/20 hover:text-black dark:hover:text-white hover:border-black/30 dark:hover:border-white/30'
        )}

      {/* Facebook */}
      {facebookUrl &&
        renderIconItem(
          'facebook',
          facebookUrl,
          'Facebook Profile',
          <Facebook className={iconSizes[size]} />,
          'hover:bg-[#1877F2]/15 hover:text-[#1877F2] hover:border-[#1877F2]/40'
        )}

      {/* WhatsApp */}
      {whatsappUrl &&
        renderIconItem(
          'whatsapp',
          whatsappUrl,
          'Chat on WhatsApp',
          <MessageCircle className={iconSizes[size]} />,
          'hover:bg-[#25D366]/15 hover:text-[#25D366] hover:border-[#25D366]/40'
        )}

      {/* Email */}
      {email &&
        renderIconItem(
          'email',
          `mailto:${email}`,
          `Email: ${email}`,
          <Mail className={iconSizes[size]} />,
          'hover:bg-amber-400/20 hover:text-amber-500 hover:border-amber-400/40'
        )}
    </div>
  );
};
