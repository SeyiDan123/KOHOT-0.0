import React, { useState } from 'react';
import { 
  FileText, 
  UserCheck, 
  Send, 
  QrCode, 
  Sparkles, 
  Eye, 
  ExternalLink,
  GraduationCap,
  Building2,
  Calendar,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { ClassSet, UniversityDirectoryItem } from '../../types';

interface MasterFormPreviewsSectionProps {
  sets: ClassSet[];
  universities: UniversityDirectoryItem[];
}

export const MasterFormPreviewsSection: React.FC<MasterFormPreviewsSectionProps> = ({
  sets,
  universities,
}) => {
  const [activePreview, setActivePreview] = useState<'request' | 'student_submit' | 'baton' | 'plaque'>('request');

  const demoSet = sets[0] || {
    id: 'demo-set',
    institutionName: 'University of Lagos (UNILAG)',
    departmentName: 'Computer Science',
    faculty: 'Faculty of Science',
    graduationYear: 2026,
    classRepName: 'Oluwaseun Danladi',
    classRepEmail: 'rep.cs24@unilag.edu.ng',
  };

  return (
    <div id="master-form-previews-section" className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono-tech uppercase font-semibold">
              Interface Audit &amp; Experience Proofing
            </span>
          </div>
          <h2 className="font-syne font-bold text-2xl text-white tracking-tight">
            Form &amp; Template Previews
          </h2>
          <p className="font-body text-xs text-zinc-400">
            Inspect real-time rendering of all intake forms, student submission pages, handoff invites, and plaques.
          </p>
        </div>

        {/* Preview Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-white/5 border border-white/10">
          <button
            onClick={() => setActivePreview('request')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer ${
              activePreview === 'request'
                ? 'bg-white text-black font-semibold shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Album Request
          </button>
          <button
            onClick={() => setActivePreview('student_submit')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer ${
              activePreview === 'student_submit'
                ? 'bg-white text-black font-semibold shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Student Form
          </button>
          <button
            onClick={() => setActivePreview('baton')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer ${
              activePreview === 'baton'
                ? 'bg-white text-black font-semibold shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pass the Baton
          </button>
          <button
            onClick={() => setActivePreview('plaque')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer ${
              activePreview === 'plaque'
                ? 'bg-white text-black font-semibold shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Legacy Plaque
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0c0d14] border border-white/10 min-h-[500px] flex items-center justify-center">
        {activePreview === 'request' && (
          <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-[#10121a] border border-white/15 space-y-6 shadow-2xl">
            <div className="border-b border-white/10 pb-4">
              <span className="text-[10px] font-mono-tech uppercase tracking-widest text-[#d4af37] px-2.5 py-0.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20">
                Preview: Structured Class Album Request
              </span>
              <h3 className="font-syne font-bold text-2xl text-white mt-2">
                Request an Official Class Album
              </h3>
              <p className="text-xs text-zinc-400 font-body mt-1">
                Verified Rep: <span className="text-white font-mono-tech">seun@unilag.edu.ng</span> (Authenticated via KoHot ID)
              </p>
            </div>

            <div className="space-y-4 text-xs font-mono-tech">
              <div>
                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Institution</label>
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-white flex items-center justify-between">
                  <span>University of Lagos (UNILAG)</span>
                  <Building2 className="w-4 h-4 text-zinc-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Faculty / School</label>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-white">
                    Faculty of Science
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Department</label>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-white">
                    Computer Science
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Graduating Class Year</label>
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-white flex items-center justify-between">
                  <span>Class of 2026</span>
                  <Calendar className="w-4 h-4 text-zinc-500" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Uniqueness Rule Verified: No active album registered for Computer Science 2026. Ready for creation.</span>
              </div>

              <div className="pt-2">
                <div className="w-full py-3.5 rounded-full bg-white text-black font-syne font-bold text-center text-xs uppercase tracking-wider shadow">
                  Submit Class Album Request
                </div>
              </div>
            </div>
          </div>
        )}

        {activePreview === 'student_submit' && (
          <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-[#10121a] border border-white/15 space-y-6 shadow-2xl">
            <div className="border-b border-white/10 pb-4">
              <span className="text-[10px] font-mono-tech uppercase tracking-widest text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                Preview: Student Entry Portal
              </span>
              <h3 className="font-syne font-bold text-2xl text-white mt-2">
                Join {demoSet.departmentName} Class of '{String(demoSet.graduationYear).slice(-2)}
              </h3>
              <p className="text-xs text-zinc-400 font-body mt-1">
                Direct link distributed to students for photo and memory submission.
              </p>
            </div>

            <div className="space-y-4 text-xs font-mono-tech">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Full Legal Name</label>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-zinc-400">
                    Oluwaseun Danladi
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-400 uppercase text-[10px] mb-1">Campus Moniker / Nickname</label>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-zinc-400">
                    Seun Algorithm
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Senior Year Portrait</label>
                <div className="p-6 rounded-2xl border border-dashed border-white/20 text-center space-y-2 bg-black/20">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto text-zinc-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <p className="text-zinc-400 text-xs">Drop senior portrait or browse photo</p>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Senior Reflection / Quote</label>
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-zinc-400 italic">
                  "Lines of code become bridges to tomorrow. Never stop building."
                </div>
              </div>
            </div>
          </div>
        )}

        {activePreview === 'baton' && (
          <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#10121a] to-[#0c0d14] border border-[#d4af37]/30 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] text-[10px] font-mono-tech uppercase font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                Pass the Baton Invitation Card
              </div>
              <h3 className="font-syne font-bold text-2xl text-white">
                You've Been Nominated to Carry the KoHot Legacy
              </h3>
              <p className="text-xs text-zinc-300 font-body leading-relaxed">
                <span className="text-white font-semibold">{demoSet.classRepName}</span> (Class of {demoSet.graduationYear}) has officially invited the incoming Class of {Number(demoSet.graduationYear) + 1} to open their own living department album.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 font-mono-tech text-xs space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>Unique Baton Key:</span>
                <span className="text-[#d4af37] font-bold">BATON-CS27-UNILAG-9021</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Institutional Department:</span>
                <span className="text-white">{demoSet.departmentName}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Status:</span>
                <span className="text-emerald-400">Sponsored Initiation</span>
              </div>
            </div>

            <div className="w-full py-3.5 rounded-full bg-[#d4af37] text-black font-syne font-bold text-center text-xs uppercase tracking-wider shadow cursor-pointer">
              Accept Handoff &amp; Open Class Album
            </div>
          </div>
        )}

        {activePreview === 'plaque' && (
          <div className="w-full max-w-xl p-8 rounded-3xl bg-[#12131a] border border-[#d4af37]/40 shadow-2xl relative space-y-6 text-center">
            <div className="space-y-1">
              <span className="text-[10px] font-mono-tech uppercase tracking-widest text-[#d4af37]">
                Architectural Plaque Proof
              </span>
              <h3 className="font-syne font-bold text-xl text-white">
                Physical Department Legacy Plaque
              </h3>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-[#181924] to-[#0c0d12] border-2 border-[#d4af37]/40 shadow-inner space-y-4 max-w-sm mx-auto">
              <div className="font-syne font-black text-sm tracking-wider uppercase text-[#d4af37]">
                KOHOT DEPARTMENT LEGACY PLAQUE
              </div>
              <div className="text-xs font-serif text-zinc-300">
                {demoSet.departmentName}
              </div>
              <div className="text-[10px] font-mono-tech text-zinc-500 uppercase tracking-widest">
                {demoSet.institutionName}
              </div>

              <div className="p-4 bg-white rounded-xl inline-block shadow-lg my-2">
                <QrCode className="w-24 h-24 text-black" />
              </div>

              <div className="text-[10px] font-mono-tech text-zinc-400 uppercase tracking-widest">
                Scan to explore the living archive
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
