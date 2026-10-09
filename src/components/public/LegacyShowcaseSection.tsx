import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle, 
  ShieldCheck, 
  ExternalLink,
  Award,
  QrCode
} from 'lucide-react';
import { WebsiteContentOverride } from '../../types';

interface LegacyShowcaseSectionProps {
  onExploreDemoAlbum: (setId?: string) => void;
  onOpenOnboarding: () => void;
  contentOverride?: WebsiteContentOverride;
}

export const LegacyShowcaseSection: React.FC<LegacyShowcaseSectionProps> = ({
  onExploreDemoAlbum,
  onOpenOnboarding,
  contentOverride,
}) => {
  // --------------------------------------------------------------------------
  // STATE 1: Class Album Visual Slideshow (Pure visual crossfade, no text overlay)
  // --------------------------------------------------------------------------
  const [albumSlide, setAlbumSlide] = useState(0);

  const albumImages = [
    {
      id: 'portraits',
      alt: 'Graduate Portrait and Studio Bio',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=85',
    },
    {
      id: 'milestones',
      alt: 'Milestone Timeline Ceremony',
      image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1000&auto=format&fit=crop&q=85',
    },
    {
      id: 'awards',
      alt: 'Department Accolades and Honors',
      image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1000&auto=format&fit=crop&q=85',
    },
    {
      id: 'faculty',
      alt: 'Faculty and Professor Tributes',
      image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1000&auto=format&fit=crop&q=85',
    },
  ];

  // Auto-advance visual images every 5 seconds (only when not showing uploaded video tour)
  useEffect(() => {
    if (contentOverride?.classAlbumTourUrl) return;
    const interval = setInterval(() => {
      setAlbumSlide((prev) => (prev + 1) % albumImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [contentOverride?.classAlbumTourUrl, albumImages.length]);

  // --------------------------------------------------------------------------
  // STATE 2: Legacy Plaque Visual Slideshow (Pure visual crossfade, no text overlay)
  // --------------------------------------------------------------------------
  const [plaqueSlide, setPlaqueSlide] = useState(0);

  const plaqueImages = [
    {
      id: 'campus_wall',
      alt: 'Physical Wall Installation on Campus',
      image: 'https://images.unsplash.com/photo-1562774053-701939374585?w=1000&auto=format&fit=crop&q=85',
    },
    {
      id: 'scanning_action',
      alt: 'Student Scanning Plaque with Phone',
      image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1000&auto=format&fit=crop&q=85',
    },
    {
      id: 'phone_reveal',
      alt: 'Digital Album Gateway Revealed on Screen',
      image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=1000&auto=format&fit=crop&q=85',
    },
  ];

  useEffect(() => {
    if (contentOverride?.legacyPlaqueTourUrl) return;
    const interval = setInterval(() => {
      setPlaqueSlide((prev) => (prev + 1) % plaqueImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [contentOverride?.legacyPlaqueTourUrl, plaqueImages.length]);

  return (
    <div id="class-legacy" className="py-24 px-6 bg-[#060709] border-t border-white/[0.08]">
      <div className="max-w-7xl mx-auto space-y-28">
        
        {/* =========================================================================
            SECTION HEADER (CONCISE, IMPACTFUL)
            ========================================================================= */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.25em] text-white/80 font-semibold">
              THE PRESERVATION SYSTEM
            </span>
          </div>

          <h2 className="font-syne font-bold text-4xl sm:text-5xl text-white tracking-tight leading-[1.1] text-balance">
            All you need to preserve your class legacy
          </h2>

          <p className="font-body text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
            A permanent digital class album paired with a physical, laser-engraved department plaque installed in your faculty corridor.
          </p>
        </div>

        {/* =========================================================================
            PILLAR 1: THE DIGITAL CLASS ALBUM
            ========================================================================= */}
        <div id="class-album" className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Card 1: Very Visual Showcase (No Text Clutter, No Swipe, Video or Photos) */}
          <div className="lg:col-span-6 relative flex justify-center order-1 lg:order-1">
            <div className="relative w-full max-w-lg aspect-[4/5] sm:aspect-[1/1] md:aspect-[4/5] rounded-3xl overflow-hidden border border-white/15 bg-[#0a0b10] shadow-2xl group">
              
              {/* If Video Tour is provided via Owner Overwrite Dashboard */}
              {contentOverride?.classAlbumTourUrl ? (
                <div className="absolute inset-0 z-10 bg-black">
                  <video
                    key={contentOverride.classAlbumTourUrl}
                    src={contentOverride.classAlbumTourUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060709] via-transparent to-black/25 pointer-events-none"></div>
                </div>
              ) : (
                /* Pure Visual Crossfade Gallery (Zero Text Overlays) */
                albumImages.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      idx === albumSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={item.image}
                      alt={item.alt}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center filter contrast-[1.1] grayscale-[20%] group-hover:grayscale-0 animate-ken-burns transition-all duration-1000 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#060709] via-transparent to-black/30"></div>
                  </div>
                ))
              )}

              {/* Bottom Floating Stat Badge (Sleek, matching lower CTA card size) */}
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 z-20 p-3 sm:p-3.5 rounded-xl bg-[#0c0d12]/95 backdrop-blur-md border border-white/15 flex items-center justify-between shadow-2xl">
                <div className="min-w-0 pr-3">
                  <span className="font-syne font-extrabold text-sm sm:text-base text-white block truncate">
                    Digital Class Album
                  </span>
                  <span className="font-mono-tech text-[10px] sm:text-[11px] text-zinc-400 uppercase tracking-wider block truncate">
                    Mobile-First • Permanent Cloud
                  </span>
                </div>
                <button
                  onClick={() => onExploreDemoAlbum('unilag-cs-2026')}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center gap-1.5 font-syne font-bold text-[11px] sm:text-xs transition-colors cursor-pointer shrink-0"
                >
                  <span>EXPLORE</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Text Narrative & Explanation (Concise, Powerful, Easy to Grasp) */}
          <div className="lg:col-span-6 flex flex-col justify-center order-2 lg:order-2 space-y-6">
            <div className="flex items-center gap-2">
              <span className="font-mono-tech text-xs font-semibold text-white/50 tracking-[0.2em]">01</span>
              <span className="w-1 h-1 rounded-full bg-white/40"></span>
              <span className="font-mono-tech text-xs uppercase tracking-[0.2em] font-medium text-white/80">
                CLASS ALBUM
              </span>
            </div>

            <h3 className="font-syne font-bold text-3xl sm:text-4xl text-white tracking-tight leading-tight">
              The Digital Class Album
            </h3>

            <p className="font-body text-base text-zinc-300 leading-relaxed">
              A studio-grade digital class album for your graduating class. High-definition portraits, memoirs, awards, and milestone memories preserved forever.
            </p>

            {/* Core Value Points */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 text-white">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-syne font-semibold text-sm text-white">60-Second Submissions</h5>
                  <p className="font-body text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Classmates upload portraits and parting quotes via a simple WhatsApp link with instant photo optimization.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 text-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-syne font-semibold text-sm text-white">Permanent Zero-App Access</h5>
                  <p className="font-body text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Instant browser access on any phone or laptop. No downloads, no physical book degradation.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-3 flex flex-wrap items-center gap-4">
              <button
                id="explore-demo-album-btn"
                onClick={() => onExploreDemoAlbum('unilag-cs-2026')}
                className="bg-zinc-700 hover:bg-zinc-600 text-white font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-7 rounded-full flex items-center gap-2.5 transition-all shadow-lg border border-zinc-600 active:scale-[0.98] cursor-pointer"
              >
                <span>Explore Demo Albums</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <span className="font-mono-tech text-xs text-zinc-500">
                Live UNILAG CompSci '26 Demo
              </span>
            </div>
          </div>

        </div>

        {/* =========================================================================
            PILLAR 2: THE DEPARTMENT LEGACY PLAQUE
            ========================================================================= */}
        <div id="legacy-plaque" className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center pt-8 border-t border-white/[0.08]">
          
          {/* Text Narrative & Explanation (Left on Desktop, Concise, Powerful) */}
          <div className="lg:col-span-6 flex flex-col justify-center order-2 lg:order-1 space-y-6">
            <div className="flex items-center gap-2">
              <span className="font-mono-tech text-xs font-semibold text-white/50 tracking-[0.2em]">02</span>
              <span className="w-1 h-1 rounded-full bg-white/40"></span>
              <span className="font-mono-tech text-xs uppercase tracking-[0.2em] font-medium text-white/80">
                PHYSICAL CAMPUS ARTIFACT
              </span>
            </div>

            <h3 className="font-syne font-bold text-3xl sm:text-4xl text-white tracking-tight leading-tight">
              The Department Legacy Plaque
            </h3>

            <p className="font-body text-base text-zinc-300 leading-relaxed">
              An architectural metal and acrylic plaque mounted in your faculty corridor. Anyone who taps or scans it instantly accesses every graduating class's living memories.
            </p>

            {/* Core Value Points */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 text-white">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-syne font-semibold text-sm text-white">100% Free For Pioneer Sets</h5>
                  <p className="font-body text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Gifted at zero cost to the first graduating class to establish their department album on KoHot.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 text-white">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-syne font-semibold text-sm text-white">Continuous Campus Gateway</h5>
                  <p className="font-body text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Each graduating class connects to this same physical plaque, preserving decades of department history.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-3 flex flex-wrap items-center gap-4">
              <button
                id="claim-plaque-btn"
                onClick={onOpenOnboarding}
                className="bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-7 rounded-full flex items-center gap-2.5 transition-all shadow-lg shadow-white/5 active:scale-[0.98] cursor-pointer"
              >
                <span>Claim Department Plaque</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <span className="font-mono-tech text-xs text-emerald-400 font-semibold">
                $0 Pioneer Set Gift
              </span>
            </div>
          </div>

          {/* Card 2: Very Visual Showcase (No Text Clutter, No Swipe, Video or Photos) */}
          <div className="lg:col-span-6 relative flex justify-center order-1 lg:order-2">
            <div className="relative w-full max-w-lg aspect-[4/5] sm:aspect-[1/1] md:aspect-[4/5] rounded-3xl overflow-hidden border border-white/15 bg-[#0a0b10] shadow-2xl group">
              
              {/* If Video Tour is provided via Owner Overwrite Dashboard */}
              {contentOverride?.legacyPlaqueTourUrl ? (
                <div className="absolute inset-0 z-10 bg-black">
                  <video
                    key={contentOverride.legacyPlaqueTourUrl}
                    src={contentOverride.legacyPlaqueTourUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060709] via-transparent to-black/25 pointer-events-none"></div>
                </div>
              ) : (
                /* Pure Visual Crossfade Gallery (Zero Text Overlays) */
                plaqueImages.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      idx === plaqueSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={item.image}
                      alt={item.alt}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center filter contrast-[1.1] grayscale-[20%] group-hover:grayscale-0 animate-ken-burns transition-all duration-1000 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#060709] via-transparent to-black/30"></div>
                  </div>
                ))
              )}

              {/* Bottom Floating Stat Badge (Sleek, compact CTA card) */}
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 z-20 p-3 sm:p-3.5 rounded-xl bg-[#0c0d12]/95 backdrop-blur-md border border-white/15 flex items-center justify-between shadow-2xl">
                <div className="min-w-0 pr-3">
                  <span className="font-syne font-extrabold text-sm sm:text-base text-white block truncate">
                    Pioneer Gift
                  </span>
                  <span className="font-mono-tech text-[10px] sm:text-[11px] text-emerald-400 uppercase tracking-wider font-semibold block truncate">
                    100% Free Physical Plaque
                  </span>
                </div>
                <button
                  onClick={onOpenOnboarding}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center gap-1.5 font-syne font-bold text-[11px] sm:text-xs transition-colors cursor-pointer shrink-0"
                >
                  <span>CLAIM</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
