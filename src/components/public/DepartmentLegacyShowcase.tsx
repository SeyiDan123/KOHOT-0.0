import React from 'react';
import { 
  ArrowRight, 
  ExternalLink, 
  Sparkles, 
  Award, 
  QrCode, 
  ChevronRight,
  Smartphone,
  Clock
} from 'lucide-react';

interface DepartmentLegacyShowcaseProps {
  onExploreDemoAlbum: (setId?: string) => void;
  onOpenOnboarding: () => void;
}

export const DepartmentLegacyShowcase: React.FC<DepartmentLegacyShowcaseProps> = ({
  onExploreDemoAlbum,
  onOpenOnboarding,
}) => {
  return (
    <section 
      id="department-legacy-showcase" 
      className="py-24 sm:py-32 px-6 sm:px-10 border-t border-white/10 bg-[#121214] relative overflow-hidden text-white"
    >


      <div className="max-w-7xl mx-auto space-y-28 relative z-10">

        {/* =====================================================================
            PART 1: THE DIGITAL EXPERIENCE
            ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left: Device & Interactive Experience Preview */}
          <div className="lg:col-span-6 relative flex justify-center order-2 lg:order-1">
            <div className="relative w-full max-w-md rounded-[36px] bg-[#18181b] border border-white/10 p-5 sm:p-7 shadow-2xl overflow-hidden group">
              {/* Device Header Rim */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs font-mono-tech text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37]" />
                  <span className="text-white font-semibold">University of Lagos</span>
                </div>
                <span>Class of 2026</span>
              </div>

              {/* Album Visual Preview Grid */}
              <div className="mt-5 space-y-4">
                {/* Featured Student Card */}
                <div className="p-4 rounded-2xl bg-[#202024] border border-white/10 flex items-center gap-4">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80"
                    alt="Graduate portrait"
                    className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-mono-tech text-[10px] text-[#d4af37] uppercase tracking-wider block font-semibold">
                      Lead Software Engineer
                    </span>
                    <h4 className="font-syne font-bold text-base text-white truncate">
                      Olumide Fashola
                    </h4>
                    <p className="font-body text-xs text-zinc-400 italic line-clamp-2 mt-0.5">
                      "Lumi_JS" • Built algorithms by day, created three successful apps while completing his degree.
                    </p>
                  </div>
                </div>

                {/* Secondary Mini Profiles */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-[#202024] border border-white/5 flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80"
                      alt="Graduate portrait"
                      className="w-11 h-11 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <h5 className="font-syne font-bold text-sm text-white truncate">Amina Bello</h5>
                      <span className="font-mono-tech text-[10px] text-zinc-400 block truncate">Algorithm Queen</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#202024] border border-white/5 flex items-center gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80"
                      alt="Graduate portrait"
                      className="w-11 h-11 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <h5 className="font-syne font-bold text-sm text-white truncate">Chiemeka Eze</h5>
                      <span className="font-mono-tech text-[10px] text-zinc-400 block truncate">Tony Stark</span>
                    </div>
                  </div>
                </div>

                {/* Audio & Flipbook Strip */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-syne font-bold text-white block text-[11px]">Class Anthem &amp; Voice Memories</span>
                      <span className="font-mono-tech text-[10px] text-zinc-400">Audio moments preserved</span>
                    </div>
                  </div>
                  <span className="font-mono-tech text-[10px] text-[#d4af37] font-medium">Live</span>
                </div>
              </div>

              {/* Bottom Interactive Bar */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="font-mono-tech text-xs text-zinc-400">
                  Zero app install • Timeless keepsake
                </span>
                <button
                  onClick={() => onExploreDemoAlbum('unilag-cs-2026')}
                  className="px-4 py-2 rounded-full bg-[#d4af37] text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-[#e6c158] transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <span>Open Demo</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Emotional Problem / Solution Text */}
          <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
            <div className="flex items-center gap-2 text-[#d4af37] font-mono-tech text-xs uppercase tracking-widest font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>THE DIGITAL EXPERIENCE</span>
            </div>

            <h2 className="font-syne font-bold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
              A Beautiful Home for Your Class
            </h2>

            <p className="font-body text-base sm:text-lg text-white leading-relaxed">
              Graduation is not the end of your story. It is the moment everyone begins to go their separate ways.
            </p>

            <p className="font-body text-base text-zinc-300 leading-relaxed">
              Photos stay on old phones. Class groups grow quiet. People move to different cities and different lives.
            </p>

            <p className="font-body text-base text-zinc-200 leading-relaxed">
              KoHot brings your people, photographs, words and memories together in one beautiful place you can return to years from now.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-[#d4af37]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-syne font-bold text-base text-white">Simple to Join</h4>
                  <p className="font-body text-sm text-zinc-400 mt-0.5">
                    Everyone can add their details from their phone. No app download required.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-[#d4af37]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-syne font-bold text-base text-white">Made to Last</h4>
                  <p className="font-body text-sm text-zinc-400 mt-0.5">
                    Your album stays online, so your class can return whenever the memories call.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                onClick={() => onExploreDemoAlbum('unilag-cs-2026')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xl border border-zinc-600"
              >
                <span>Explore Demo Class Album</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* =====================================================================
            PART 2: ONE DEPARTMENT. MANY GENERATIONS.
            ===================================================================== */}
        <div className="pt-16 border-t border-white/10">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <div className="flex items-center justify-center gap-2 text-[#d4af37] font-mono-tech text-xs uppercase tracking-widest font-semibold">
              <Award className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>ONE DEPARTMENT. MANY GENERATIONS.</span>
            </div>
            <h3 className="font-syne font-bold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
              One Legacy. Every Class.
            </h3>
            <p className="font-body text-base text-white max-w-2xl mx-auto leading-relaxed">
              Your class is one chapter in a much bigger story.
            </p>
            <p className="font-body text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
              The Legacy Plaque gives your department one lasting place where generations of graduating classes can be remembered.
            </p>
          </div>

          {/* Department Architecture Diagram Card */}
          <div className="bg-[#18181b] border border-white/10 rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-2xl relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Plaque Graphic (Physical Anchor on Campus Wall) */}
              <div className="lg:col-span-5 flex flex-col items-center text-center">
                <div className="w-full max-w-xs rounded-2xl bg-[#121214] border-2 border-[#d4af37]/40 p-6 shadow-2xl relative group">
                  {/* Brass Corner Standoffs */}
                  <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />
                  <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />
                  <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />
                  <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-[#d4af37] border border-white/40 shadow" />

                  {/* University & Department Header */}
                  <div className="space-y-1 mt-2">
                    <span className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-[#d4af37] block font-semibold">
                      DEPARTMENT OF COMPUTER SCIENCE
                    </span>
                    <h5 className="font-syne font-bold text-base text-white uppercase">
                      University of Lagos
                    </h5>
                  </div>

                  {/* QR Code Gateway */}
                  <div className="my-5 p-3 rounded-xl bg-white/5 border border-white/10 inline-flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-white" />
                  </div>

                  {/* Caption */}
                  <div className="font-mono-tech text-xs text-zinc-400 space-y-1">
                    <div className="text-white font-semibold">Legacy Plaque</div>
                    <div>10 × 12 in.</div>
                    <div className="text-zinc-500 text-[10px]">Mounted in the department corridor</div>
                  </div>
                </div>
              </div>

              {/* Connected classes */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-mono-tech text-xs uppercase tracking-wider text-zinc-400">
                    Department of Computer Science
                  </span>
                  <span className="font-mono-tech text-xs text-[#d4af37]">
                    Connected Classes
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Class of '27 (Most Recent / Next Set) */}
                  <div className="p-4 rounded-2xl border border-white/5 bg-[#202024]/50 flex items-center justify-between opacity-80 hover:opacity-100 transition-all">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/10 text-[#d4af37] font-syne text-xs font-bold flex items-center justify-center">
                        ’27
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-syne font-bold text-sm text-white">Class of ’27</h5>
                          <span className="text-[#d4af37] font-mono-tech text-[10px] font-semibold uppercase">
                            • Incoming Class
                          </span>
                        </div>
                        <span className="font-mono-tech text-xs text-zinc-400">Next in Line • Reserved Archive</span>
                      </div>
                    </div>
                    <span className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-mono-tech text-xs">
                      Incoming
                    </span>
                  </div>

                  {/* Class of '26 */}
                  <div className="p-4 rounded-2xl border border-[#d4af37]/40 bg-[#202024] shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#d4af37]/20 text-[#d4af37] font-syne text-xs font-bold flex items-center justify-center">
                        ’26
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-syne font-bold text-sm text-white">Class of ’26</h5>
                          <span className="text-[#d4af37] font-mono-tech text-[10px] font-semibold uppercase">
                            • Active Class
                          </span>
                        </div>
                        <span className="font-mono-tech text-xs text-zinc-400">115 Graduates</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onExploreDemoAlbum('unilag-cs-2026')}
                      className="px-3.5 py-1.5 rounded-full bg-[#d4af37] text-black font-syne font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-md hover:bg-[#e6c158]"
                    >
                      <span>View Album</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Class of '25 */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-[#202024] hover:border-white/20 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/10 text-white font-syne text-xs font-bold flex items-center justify-center">
                        ’25
                      </div>
                      <div>
                        <h5 className="font-syne font-bold text-sm text-white">Class of ’25</h5>
                        <span className="font-mono-tech text-xs text-zinc-400">138 Graduates</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onExploreDemoAlbum('unilag-cs-2025')}
                      className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono-tech font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View Album</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Class of '24 */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-[#202024] hover:border-white/20 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#d4af37] text-black font-syne text-xs font-bold flex items-center justify-center">
                        ’24
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-syne font-bold text-sm text-white">Class of ’24</h5>
                          <span className="text-[#d4af37] font-mono-tech text-[10px] font-semibold uppercase">
                            • Founding Class
                          </span>
                        </div>
                        <span className="font-mono-tech text-xs text-zinc-400">124 Graduates</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onExploreDemoAlbum('unilag-cs-2024')}
                      className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono-tech font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View Album</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="pt-4 text-xs font-mono-tech text-[#d4af37] text-center sm:text-left font-medium">
                  One department. One lasting gateway. Many generations of memories.
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
