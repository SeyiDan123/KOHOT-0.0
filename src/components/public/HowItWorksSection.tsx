import React, { useState } from 'react';
import { 
  Building2, 
  Share2, 
  Camera, 
  Sparkles, 
  QrCode, 
  ArrowRight, 
  Check, 
  MessageSquare, 
  ShieldCheck, 
  Smartphone, 
  Award,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface HowItWorksSectionProps {
  onOpenOnboarding: () => void;
  onExploreDemo: () => void;
  onOpenSubmitModal?: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({
  onOpenOnboarding,
  onExploreDemo,
  onOpenSubmitModal,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      step: 1,
      num: '01',
      tag: 'ONBOARD & CLAIM',
      title: 'Set Up Cohort & Claim Wall Plaque',
      summary: 'Pick your university from the accredited registry and claim your free physical Department Plaque.',
      description: 'The Class Representative registers the graduating set by selecting their verified university, faculty, and department. The first pioneer set from every department is automatically gifted the physical Department Legacy Plaque at zero cost.',
      icon: Building2,
      badge: 'Pioneer Plaque Free ($0)',
    },
    {
      step: 2,
      num: '02',
      tag: 'FRICTIONLESS INVITE',
      title: 'Share 1 WhatsApp Link with Class',
      summary: 'No passwords, no app stores. One tap broadcast into your class WhatsApp group.',
      description: 'Your dashboard automatically generates a single smart WhatsApp invitation broadcast. Copy or share it directly into your class group chat. Every classmate gets instant access without having to create an account or install anything.',
      icon: MessageSquare,
      badge: 'Zero Apps to Download',
    },
    {
      step: 3,
      num: '03',
      tag: 'STUDENT SUBMISSION',
      title: '60-Second Snap & Quote',
      summary: 'Each student uploads their portrait, adds a nickname, and writes their parting quote.',
      description: 'Students open the link on their phone, pick their best portrait, enter their nickname, and type their memorable parting quote. Our browser engine instantly optimizes photos for crystal-clear, lightning-fast loading.',
      icon: Camera,
      badge: 'Instant Photo Optimization',
    },
    {
      step: 4,
      num: '04',
      tag: 'PERPETUAL ARCHIVE',
      title: 'Living Album & Wall Plaque QR Gateway',
      summary: 'Review profiles in 1 tap. The physical plaque and digital album live forever.',
      description: 'The Class Rep reviews incoming submissions in the Layer 1 dashboard and clicks approve. The digital album goes live with interactive graduate cards, timeline memories, and awards. Meanwhile, the Department Plaque is mounted on your campus hall wall with a permanent QR code leading directly to your album!',
      icon: QrCode,
      badge: 'Perpetual Campus Heritage',
    },
  ];

  const currentStepData = steps.find((s) => s.step === activeStep) || steps[0];

  return (
    <section className="py-24 px-6 bg-[#08090e] border-y border-white/[0.08]" id="how-it-works">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="font-mono-tech text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold">
                HOW IT WORKS
              </span>
              <span className="w-1 h-1 rounded-full bg-white/40"></span>
              <span className="font-mono-tech text-xs uppercase tracking-wider text-white/80">
                SIMPLE &amp; INTUITIVE
              </span>
            </div>
            <h2 className="font-syne font-bold text-3xl sm:text-5xl text-white tracking-tight leading-tight">
              FROM CLASS CHAT TO<br />
              <span className="font-light italic text-white/90">CAMPUS WALL</span> IN 4 STEPS
            </h2>
          </div>
          <p className="font-body text-sm sm:text-base text-zinc-400 max-w-md leading-relaxed">
            Preserving your graduating set is so straightforward that anyone can complete it in minutes. No complex software, no paper headaches.
          </p>
        </div>

        {/* 4 Interactive Step Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {steps.map((item) => {
            const Icon = item.icon;
            const isSelected = activeStep === item.step;
            return (
              <button
                key={item.step}
                onClick={() => setActiveStep(item.step)}
                className={`text-left p-6 rounded-2xl transition-all duration-300 border cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-[#10121a] border-white/40 shadow-xl shadow-white/5 ring-1 ring-white/20'
                    : 'bg-[#0c0d14] border-white/10 hover:border-white/25 hover:bg-[#0e0f17]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono-tech text-xs font-bold text-white/50 group-hover:text-white transition-colors">
                      {item.num}
                    </span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-white text-black' : 'bg-white/5 text-white group-hover:bg-white/10'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider text-white/60 block mb-1">
                    {item.tag}
                  </span>
                  <h3 className="font-syne font-bold text-base text-white mb-2 leading-snug">
                    {item.title}
                  </h3>
                </div>
                <div className="pt-3 border-t border-white/[0.06] mt-4 flex items-center justify-between">
                  <span className="font-mono-tech text-[10px] text-zinc-400">
                    {isSelected ? 'Active View' : 'Click to inspect'}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-white translate-x-1' : 'text-zinc-600'}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Interactive Stage Deep-Dive Visual Board */}
        <div className="rounded-3xl bg-[#0c0d14] border border-white/15 p-6 sm:p-10 lg:p-12 overflow-hidden shadow-2xl relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Detailed Step Explanation & Action */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 font-mono-tech text-xs uppercase tracking-wider text-white">
                  Step {currentStepData.num} of 04
                </span>
                <span className="font-mono-tech text-xs text-white/70">
                  {currentStepData.badge}
                </span>
              </div>

              <h3 className="font-syne font-bold text-2xl sm:text-4xl text-white tracking-tight leading-tight">
                {currentStepData.title}
              </h3>

              <p className="font-body text-base text-zinc-300 leading-relaxed">
                {currentStepData.description}
              </p>

              {/* Step Key Highlights Checklist */}
              <div className="space-y-3 pt-2">
                {activeStep === 1 && (
                  <>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Select university &amp; department from pre-accredited directory</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Pioneer cohort gets physical metal Department Plaque gifted free</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Sets up your permanent cloud album address with custom moniker</span>
                    </div>
                  </>
                )}

                {activeStep === 2 && (
                  <>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Pre-formatted WhatsApp broadcast ready with 1 click in Rep dashboard</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Classmates do NOT need to download any app or remember passwords</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Works directly in Chrome, Safari, or in-app WhatsApp browser</span>
                    </div>
                  </>
                )}

                {activeStep === 3 && (
                  <>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Classmates choose their favorite sign-out or graduation portrait</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Client-side photo optimizer ensures portraits load instantly with crystal-clear fidelity</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Add moniker, campus role, and parting life quote in under 60 seconds</span>
                    </div>
                  </>
                )}

                {activeStep === 4 && (
                  <>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Class Rep approves student submissions with a single tap in Layer 1 Admin</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Digital album displays all profiles, sign-out photos, awards &amp; faculty notes</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-300 font-body">
                      <div className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>Department Plaque is permanently mounted on campus with etched QR gateway</span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons for this Step */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                {activeStep === 1 && (
                  <button
                    onClick={onOpenOnboarding}
                    className="bg-white text-black font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-6 rounded-full hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>Start Cohort Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {activeStep === 2 && (
                  <button
                    onClick={onOpenOnboarding}
                    className="bg-white text-black font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-6 rounded-full hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>Get Your WhatsApp Invite Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {activeStep === 3 && (
                  <button
                    onClick={onOpenSubmitModal || onExploreDemo}
                    className="bg-white text-black font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-6 rounded-full hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>Try 60-Second Submission Demo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {activeStep === 4 && (
                  <button
                    onClick={onExploreDemo}
                    className="bg-white text-black font-tech text-xs tracking-wider uppercase font-bold py-3.5 px-6 rounded-full hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>Experience Full Demo Album</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => setActiveStep((prev) => (prev < 4 ? prev + 1 : 1))}
                  className="bg-transparent hover:bg-white/10 text-white font-tech text-xs tracking-wider uppercase font-semibold py-3.5 px-6 rounded-full border border-white/20 transition-colors cursor-pointer"
                >
                  {activeStep < 4 ? 'Next Step →' : 'Back to Step 1 ↺'}
                </button>
              </div>
            </div>

            {/* Right Column: Visual Stage Interactive Mockup Card */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-md rounded-2xl bg-[#08090e] border border-white/15 p-6 shadow-2xl relative overflow-hidden">
                
                {/* STEP 1 VISUAL: DIRECTORY REGISTRY & PLAQUE */}
                {activeStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <span className="font-mono-tech text-xs uppercase tracking-wider text-white/70">
                        Institutional Registry Selection
                      </span>
                      <span className="text-[10px] font-mono-tech text-white bg-white/10 px-2 py-0.5 rounded-full">
                        Step 1 Preview
                      </span>
                    </div>

                    <div className="space-y-3 font-mono-tech text-xs">
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <label className="text-[10px] text-zinc-400 uppercase block mb-1">1. Accredited University</label>
                        <div className="text-white font-semibold flex items-center justify-between">
                          <span>University of Lagos (UNILAG)</span>
                          <span className="text-[10px] text-emerald-400">✓ Verified</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <label className="text-[10px] text-zinc-400 uppercase block mb-1">2. Faculty / College</label>
                        <div className="text-white font-semibold">Faculty of Science</div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <label className="text-[10px] text-zinc-400 uppercase block mb-1">3. Approved Department</label>
                        <div className="text-white font-semibold">Computer Science (Class of 2024)</div>
                      </div>
                    </div>

                    {/* Plaque Gift Mockup Banner */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-white/[0.08] to-white/[0.02] border border-white/20 mt-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="font-syne font-bold text-sm text-white block">
                          Pioneer Gift Included
                        </span>
                        <span className="font-body text-xs text-zinc-400">
                          12" x 16" Physical Aluminum &amp; Acrylic Wall Plaque delivered to campus.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2 VISUAL: WHATSAPP SMART INVITE BUBBLE */}
                {activeStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="font-mono-tech text-xs uppercase tracking-wider text-white">
                          Class WhatsApp Broadcast
                        </span>
                      </div>
                      <span className="text-[10px] font-mono-tech text-white/60">Tap to Copy</span>
                    </div>

                    {/* Realistic WhatsApp Chat Bubble Container */}
                    <div className="p-5 rounded-2xl bg-[#0b141a] border border-[#202c33] space-y-3 font-body">
                      <div className="flex items-center gap-2 text-[11px] text-[#25d366] font-mono-tech font-semibold">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Class Rep Broadcast Message</span>
                      </div>

                      <p className="text-xs text-zinc-200 leading-relaxed">
                        🎓 <strong>Calling all Computer Science Class of '24!</strong>
                        <br /><br />
                        Our KoHot Digital Class Album is officially open. Please submit your photo, nickname, and quote so our set is forever immortalized:
                      </p>

                      <div className="p-3 rounded-xl bg-[#1f2c34] border border-[#2a3942] text-xs space-y-1">
                        <p className="text-[#25d366] font-mono-tech font-semibold">
                          🔗 kohot.app/#submit-unilag-cs-2024
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          Takes 60 seconds • No app or account needed
                        </p>
                      </div>

                      <div className="flex justify-end text-[10px] text-zinc-500 font-mono-tech">
                        10:24 AM • Sent to 84 Classmates ✓✓
                      </div>
                    </div>

                    <div className="text-center pt-2">
                      <span className="font-mono-tech text-[11px] text-zinc-400">
                        1 link covers your entire class. Real-time submission counter.
                      </span>
                    </div>
                  </div>
                )}

                {/* STEP 3 VISUAL: STUDENT SMARTPHONE SUBMISSION */}
                {activeStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <span className="font-mono-tech text-xs uppercase tracking-wider text-white">
                        Student Mobile View
                      </span>
                      <span className="text-[10px] font-mono-tech text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Optimized &amp; Ready
                      </span>
                    </div>

                    {/* Mini student preview profile */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/10">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=85"
                        alt="Photo Preview"
                        className="w-16 h-20 rounded-lg object-cover border border-white/20 filter grayscale-[20%]"
                      />
                      <div className="space-y-1 text-xs">
                        <span className="font-syne font-bold text-white text-sm block">
                          Tomiwa Adeleke
                        </span>
                        <span className="text-[11px] font-mono-tech text-zinc-400 block">
                          "The Code Alchemist"
                        </span>
                        <p className="text-[11px] text-zinc-300 italic line-clamp-2">
                          "Built scalable systems and lifelong brotherhood. Next stop: Silicon Valley."
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center font-mono-tech text-[10px]">
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                        <span className="text-zinc-500 block">Visual Quality</span>
                        <span className="text-zinc-300 font-bold">Ultra High-Definition</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                        <span className="text-zinc-500 block">Loading Speed</span>
                        <span className="text-emerald-400 font-bold">Instant Render</span>
                      </div>
                    </div>

                    <button
                      onClick={onOpenSubmitModal || onExploreDemo}
                      className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs tracking-wider uppercase transition-colors"
                    >
                      Instant Photo Submission Preview
                    </button>
                  </div>
                )}

                {/* STEP 4 VISUAL: PHYSICAL CAMPUS PLAQUE & DIGITAL ALBUM */}
                {activeStep === 4 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <span className="font-mono-tech text-xs uppercase tracking-wider text-white">
                        Department Plaque &amp; Album
                      </span>
                      <span className="text-[10px] font-mono-tech text-white bg-white/10 px-2 py-0.5 rounded-full">
                        Permanent
                      </span>
                    </div>

                    {/* Plaque rendering graphic */}
                    <div className="p-6 rounded-2xl bg-gradient-to-b from-[#181920] to-[#0c0d12] border-2 border-white/20 shadow-inner relative text-center">
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-mono-tech text-[9px] uppercase tracking-[0.25em] text-white/50 block mb-1">
                        FACULTY OF SCIENCE WALL INSTALLATION
                      </span>
                      <h4 className="font-syne font-bold text-base text-white tracking-wide mb-1">
                        DEPARTMENT OF COMPUTER SCIENCE
                      </h4>
                      <p className="font-mono-tech text-[10px] text-zinc-400 mb-4">
                        Pioneer Set '24 • Permanent Heritage Gateway
                      </p>

                      <div className="w-24 h-24 bg-white p-2 rounded-xl mx-auto shadow-md flex items-center justify-center">
                        <QrCode className="w-20 h-20 text-black" />
                      </div>
                      <span className="font-mono-tech text-[9px] uppercase text-zinc-400 tracking-wider block mt-2">
                        Scan with any phone camera
                      </span>
                    </div>

                    <div className="text-center pt-1">
                      <span className="font-mono-tech text-[11px] text-zinc-400">
                        Installed once outside lecture halls. Connects all cohorts forever.
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
