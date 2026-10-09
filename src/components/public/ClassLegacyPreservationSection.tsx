import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Users, 
  Building2, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

interface ClassLegacyPreservationSectionProps {
  onOpenOnboarding: () => void;
  onExploreDemos: () => void;
}

export const ClassLegacyPreservationSection: React.FC<ClassLegacyPreservationSectionProps> = ({
  onOpenOnboarding,
  onExploreDemos,
}) => {
  return (
    <section 
      id="preservation" 
      className="py-24 sm:py-32 px-6 sm:px-10 border-t border-white/[0.08] bg-[#07080c] relative overflow-hidden text-[#e2e4e9]"
    >


      <div className="max-w-6xl mx-auto relative z-10 space-y-16">
        
        {/* =====================================================================
            SECTION 8: PRESERVE YOUR CLASS LEGACY (CONCISE REPLACEMENT)
            ===================================================================== */}
        <div className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[#d4af37]">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-300">
              PRESERVE YOUR CLASS LEGACY
            </span>
          </div>

          <h2 className="font-syne font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight text-balance">
            The people. The moments. The story.
          </h2>

          <p className="font-body text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            The years you shared will become memories. Give those memories somewhere to remain.
          </p>

          <p className="font-body text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            KoHot brings your class together in one beautiful Class Album, connects it to your department’s Legacy, and reminds you to come back every year.
          </p>
        </div>

        {/* Three Concise Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
          {/* Block 1: Class Album */}
          <div className="p-7 sm:p-8 rounded-[32px] bg-[#0c0d16] border border-white/15 space-y-3 flex flex-col justify-between hover:border-white/30 transition-all shadow-xl">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#d4af37]">
                <Users className="w-5 h-5" />
              </div>
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 block">
                CLASS ALBUM
              </span>
              <h3 className="font-syne font-bold text-lg text-white">
                Your class, all in one place.
              </h3>
              <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Portraits, memories, voices, achievements and parting words — beautifully brought together.
              </p>
            </div>
          </div>

          {/* Block 2: Department Legacy */}
          <div className="p-7 sm:p-8 rounded-[32px] bg-[#0c0d16] border border-white/15 space-y-3 flex flex-col justify-between hover:border-white/30 transition-all shadow-xl">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#d4af37]">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 block">
                DEPARTMENT LEGACY
              </span>
              <h3 className="font-syne font-bold text-lg text-white">
                A lasting place for every class.
              </h3>
              <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Your class becomes part of the story of your department.
              </p>
            </div>
          </div>

          {/* Block 3: Annual Reminder */}
          <div className="p-7 sm:p-8 rounded-[32px] bg-[#0c0d16] border border-white/15 space-y-3 flex flex-col justify-between hover:border-white/30 transition-all shadow-xl">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#d4af37]">
                <Clock className="w-5 h-5" />
              </div>
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 block">
                ANNUAL REMINDER
              </span>
              <h3 className="font-syne font-bold text-lg text-white">
                Some memories are worth coming back to.
              </h3>
              <p className="font-body text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Every year, KoHot gently reminds your class to return.
              </p>
            </div>
          </div>

        </div>

        {/* =====================================================================
            SECTION 9: FINAL CTA — STRONGEST EMOTIONAL CLOSE
            ===================================================================== */}
        <div className="p-8 sm:p-12 lg:p-14 rounded-[36px] bg-gradient-to-b from-[#121422] to-[#0b0c13] border border-white/20 text-center max-w-4xl mx-auto space-y-7 shadow-2xl relative">
          <div className="space-y-3">
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] font-semibold text-[#d4af37] block">
              READY TO PRESERVE YOUR CLASS?
            </span>
            <h3 className="font-syne font-extrabold text-2xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
              Give Your Class a Place to Remember.
            </h3>
            <p className="font-body text-sm sm:text-base text-zinc-300 max-w-xl mx-auto leading-relaxed">
              The people you shared these years with. The moments you almost forgot. The story you built together. Preserve it while you can.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={onOpenOnboarding}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xl active:scale-[0.99]"
            >
              <span>Create a Class Album</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreDemos}
              className="w-full sm:w-auto px-7 py-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-syne font-semibold text-xs sm:text-sm uppercase tracking-wider border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore Live Albums</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>

          <div className="pt-2">
            <p className="font-mono-tech text-xs text-zinc-400">
              Preserving departmental heritage, graduating sets, and lifelong academic bonds.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
