import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  BookOpen, 
  Camera, 
  Building2, 
  Sparkles, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  TrendingUp,
  Award
} from 'lucide-react';
import { ClassSet, UniversityDirectoryItem, WebsiteContentOverride } from '../../types';

// Animated Count-Up Hook
const useCountUp = (target: number, durationMs = 2000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, durationMs]);

  return count;
};

interface MasterWebsiteStatsSectionProps {
  sets: ClassSet[];
  universities: UniversityDirectoryItem[];
  contentOverride: WebsiteContentOverride;
  onUpdateContentOverride: (content: WebsiteContentOverride) => void;
}

export const MasterWebsiteStatsSection: React.FC<MasterWebsiteStatsSectionProps> = ({
  sets,
  universities,
  contentOverride,
  onUpdateContentOverride,
}) => {
  // Aggregate real system metrics
  const totalGraduatesRaw = sets.reduce((acc, s) => acc + (s.students?.length || 0), 0);
  const totalAlbumsRaw = sets.length;
  const totalMemoriesRaw = sets.reduce(
    (acc, s) => acc + (s.memories || []).reduce((mAcc, m) => mAcc + (m.images?.length || 0), 0),
    0
  );
  const totalDepartmentsRaw = universities.reduce((acc, u) => acc + (u.departments?.length || 0), 0);

  // Animated counters
  const animatedGraduates = useCountUp(totalGraduatesRaw, 2500);
  const animatedAlbums = useCountUp(totalAlbumsRaw, 2000);
  const animatedMemories = useCountUp(totalMemoriesRaw, 3000);
  const animatedDepartments = useCountUp(totalDepartmentsRaw, 2000);

  const isStatsVisible = contentOverride.showWebsiteStats ?? false;

  const handleTogglePublicStats = () => {
    const updated = {
      ...contentOverride,
      showWebsiteStats: !isStatsVisible,
    };
    onUpdateContentOverride(updated);
  };

  return (
    <div id="master-website-stats-section" className="space-y-8 animate-fadeIn">
      {/* Header and Public Visibility Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-tech uppercase font-semibold">
              Live Architecture Metrics
            </span>
          </div>
          <h2 className="font-syne font-bold text-2xl text-white tracking-tight">
            Website Statistics &amp; Growth
          </h2>
          <p className="font-body text-xs text-zinc-400">
            Real-time counts across all universities, faculties, and department living archives.
          </p>
        </div>

        {/* Public Homepage Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTogglePublicStats}
            className={`px-4 py-2.5 rounded-full border text-xs font-mono-tech uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              isStatsVisible
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {isStatsVisible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Homepage Counter: {isStatsVisible ? 'Visible' : 'Hidden'}</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Metric Counter Cards with Animation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Verified Graduates */}
        <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
              Verified Graduates
            </span>
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="font-syne font-bold text-4xl sm:text-5xl text-white tracking-tight">
              {animatedGraduates.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono-tech mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>100% verified by class reps</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Living Class Albums */}
        <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
              Living Class Albums
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="font-syne font-bold text-4xl sm:text-5xl text-white tracking-tight">
              {animatedAlbums.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#d4af37] font-mono-tech mt-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Permanent institutional archives</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Preserved Moments */}
        <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
              Preserved Memories
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="font-syne font-bold text-4xl sm:text-5xl text-white tracking-tight">
              {animatedMemories.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-mono-tech mt-2">
              <span>Optimized WebP compression</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Academic Departments */}
        <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400">
              Active Departments
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="font-syne font-bold text-4xl sm:text-5xl text-white tracking-tight">
              {animatedDepartments.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-purple-400 font-mono-tech mt-2">
              <span>Across {universities.length} Universities</span>
            </div>
          </div>
        </div>
      </div>

      {/* University Directory Breakdown Table */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-4">
        <h3 className="font-syne font-bold text-lg text-white">
          Department Living Archive Distribution
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-tech text-zinc-300">
            <thead>
              <tr className="border-b border-white/10 text-zinc-500 uppercase text-[10px]">
                <th className="pb-3 font-semibold">University</th>
                <th className="pb-3 font-semibold">Location</th>
                <th className="pb-3 font-semibold">Departments</th>
                <th className="pb-3 font-semibold">Active Albums</th>
                <th className="pb-3 font-semibold">Graduates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {universities.map((uni) => {
                const uniSets = sets.filter((s) => s.institutionId === uni.id);
                const uniGraduates = uniSets.reduce((acc, s) => acc + (s.students?.length || 0), 0);
                return (
                  <tr key={uni.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 font-medium text-white flex items-center gap-2.5">
                      {uni.logoUrl && (
                        <img src={uni.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                      )}
                      <span>{uni.name}</span>
                    </td>
                    <td className="py-3.5 text-zinc-400">{uni.location}</td>
                    <td className="py-3.5">{uni.departments?.length || 0}</td>
                    <td className="py-3.5 text-emerald-400">{uniSets.length}</td>
                    <td className="py-3.5 text-white">{uniGraduates}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
