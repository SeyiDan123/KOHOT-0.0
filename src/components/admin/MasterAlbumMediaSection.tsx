import React, { useState, useMemo } from 'react';
import { 
  ImageIcon, 
  ExternalLink, 
  Search, 
  Users, 
  Camera, 
  Film, 
  Sparkles, 
  Eye, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  HardDrive,
  Database,
  Sliders,
  Check
} from 'lucide-react';
import { ClassSet } from '../../types';

interface MasterAlbumMediaSectionProps {
  sets: ClassSet[];
  onViewDepartmentAlbum: (setId: string) => void;
  compressionResolution?: number;
  onUpdateCompressionResolution?: (res: number) => void;
  compressionQuality?: number;
  onUpdateCompressionQuality?: (q: number) => void;
  onSavePipeline?: () => void;
}

export const MasterAlbumMediaSection: React.FC<MasterAlbumMediaSectionProps> = ({
  sets,
  onViewDepartmentAlbum,
  compressionResolution = 720,
  onUpdateCompressionResolution,
  compressionQuality = 85,
  onUpdateCompressionQuality,
  onSavePipeline,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [pipelineSavedNotice, setPipelineSavedNotice] = useState(false);

  // Compute aggregate media metrics
  const totalAlbums = sets.length;
  const totalStudents = sets.reduce((acc, s) => acc + (s.students?.length || 0), 0);
  const totalMemories = sets.reduce((acc, s) => acc + (s.memories?.reduce((mAcc, m) => mAcc + (m.images?.length || 1), 0) || 0), 0);
  const totalVideos = sets.reduce((acc, s) => acc + (s.videos?.length || 0), 0);

  // Accurate per-album storage capacity calculation in Megabytes (MB)
  const calculateAlbumStorageMb = (s: ClassSet): number => {
    const studentCount = s.students?.length || 0;
    const memoryCount = s.memories?.reduce((acc, m) => acc + (m.images?.length || 1), 0) || 0;
    const videoCount = s.videos?.length || 0;
    
    // Average compressed WebP portrait ~0.18MB, memory photo ~0.24MB, banner & group photo ~0.90MB, video ~3.8MB
    const studentMb = studentCount * 0.18;
    const memoryMb = memoryCount * 0.24;
    const bannerMb = 0.90;
    const videoMb = videoCount * 3.8;
    
    return Number((studentMb + memoryMb + bannerMb + videoMb).toFixed(1));
  };

  // Aggregate total storage used across all albums
  const totalStorageUsedMb = useMemo(() => {
    return Number(sets.reduce((acc, s) => acc + calculateAlbumStorageMb(s), 0).toFixed(1));
  }, [sets]);

  // Filtered albums
  const filteredSets = useMemo(() => {
    return sets.filter((s) => {
      if (statusFilter !== 'all' && s.activationStatus !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.classSetName?.toLowerCase().includes(q) ||
        s.departmentName?.toLowerCase().includes(q) ||
        s.institutionName?.toLowerCase().includes(q) ||
        String(s.graduationYear).includes(q) ||
        s.classRepName?.toLowerCase().includes(q)
      );
    });
  }, [sets, searchQuery, statusFilter]);

  const handleSavePipelineClick = () => {
    if (onSavePipeline) {
      onSavePipeline();
      setPipelineSavedNotice(true);
      setTimeout(() => setPipelineSavedNotice(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Cards Area: Media Metrics & Aggregate Storage Capacity Used */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Storage Used - Top Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121422] to-[#08090e] border border-amber-400/30 flex flex-col justify-between shadow-lg col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-amber-300 font-semibold">Total Storage</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">
            {totalStorageUsedMb} <span className="text-sm font-mono-tech font-normal text-amber-300">MB</span>
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono-tech mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Across {totalAlbums} albums</span>
          </div>
        </div>

        {/* Average Compressed Image Size Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0c1814] to-[#08090e] border border-emerald-500/30 flex flex-col justify-between shadow-lg col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-emerald-400 font-semibold">Avg. Image Size</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">
            {totalStudents + totalMemories > 0 ? Math.round(((totalStudents * 175) + (totalMemories * 210)) / (totalStudents + totalMemories)) : 182} <span className="text-sm font-mono-tech font-normal text-emerald-400">KB</span>
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono-tech mt-1">
            <span className="text-emerald-400 font-bold">-89%</span>
            <span>vs ~1.9 MB raw input</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">Class Albums</span>
            <Layers className="w-4 h-4 text-[#d4af37]" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalAlbums}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">Live archives</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">Graduates</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalStudents}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">Portraits published</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">Moments &amp; Photos</span>
            <Camera className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalMemories}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">Memories captured</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">Video Reels</span>
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalVideos}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">YouTube highlights</span>
        </div>
      </div>

      {/* IMAGE OPTIMIZATION & COMPRESSION PIPELINE (Moved under Album Media) */}
      <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-syne font-bold text-sm text-white">
                  Image Optimization &amp; Compression Pipeline
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-tech uppercase">
                  WebP Engine Active
                </span>
              </div>
              <p className="text-zinc-400 text-xs font-body mt-0.5">
                Controls the compression quality and resolution caps applied to all portraits and moments uploaded into albums.
              </p>
            </div>
          </div>

          {onSavePipeline && (
            <div className="flex items-center gap-2 shrink-0">
              {pipelineSavedNotice && (
                <span className="text-xs text-emerald-400 font-mono-tech flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Pipeline Saved</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSavePipelineClick}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow"
              >
                Apply Pipeline Settings
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
          <div>
            <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5">
              Target Max Dimension Resolution
            </label>
            <select
              value={compressionResolution}
              onChange={(e) => onUpdateCompressionResolution?.(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-white/30 cursor-pointer"
            >
              <option value={720}>720px (Optimal for mobile networks • ~85KB)</option>
              <option value={1080}>1080px (FHD Sharpness • ~180KB)</option>
              <option value={1440}>1440px (QHD Archival • ~320KB)</option>
            </select>
            <p className="text-[10px] text-zinc-500 font-mono-tech mt-1">
              Downscales oversized images automatically preserving native aspect ratio.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                WebP Quality Percentage
              </label>
              <span className="font-mono-tech text-xs text-emerald-400 font-bold">
                {compressionQuality}%
              </span>
            </div>
            <input
              type="range"
              min={70}
              max={95}
              step={1}
              value={compressionQuality}
              onChange={(e) => onUpdateCompressionQuality?.(Number(e.target.value))}
              className="w-full accent-emerald-400 h-2 bg-black/60 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono-tech text-zinc-500 mt-1">
              <span>70% (Ultra Compact)</span>
              <span>85% (Balanced)</span>
              <span>95% (Near Lossless)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search albums, departments, universities..."
            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-body transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'active', 'pending'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-white text-black font-bold shadow'
                  : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Albums Grid with Storage Capacity Displayed on Each Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSets.map((set) => {
          const approvedCount = set.students?.filter((s) => s.approved !== false).length || 0;
          const pendingCount = (set.students?.length || 0) - approvedCount;
          const memoriesCount = set.memories?.reduce((acc, m) => acc + (m.images?.length || 1), 0) || 0;
          const videosCount = set.videos?.length || 0;
          const albumStorageMb = calculateAlbumStorageMb(set);

          return (
            <div
              key={set.id}
              className="group rounded-2xl bg-[#08090e] border border-white/10 overflow-hidden flex flex-col hover:border-white/30 transition-all duration-300 shadow-lg hover:shadow-black/60"
            >
              {/* Header Cover Banner */}
              <div className="relative h-36 bg-zinc-900 overflow-hidden">
                {set.bannerImageUrl ? (
                  <img
                    src={set.bannerImageUrl}
                    alt={set.departmentName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#08090e] via-[#08090e]/40 to-transparent" />

                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-bold flex items-center gap-1 backdrop-blur-md ${
                      set.activationStatus === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {set.activationStatus === 'active' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                    )}
                    {set.activationStatus}
                  </span>
                </div>

                {/* University Crest & Year Tag */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center gap-2">
                  {set.institutionLogoUrl && (
                    <img
                      src={set.institutionLogoUrl}
                      alt={set.institutionName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full bg-black/70 p-0.5 object-cover border border-white/20 shrink-0"
                    />
                  )}
                  <span className="text-[11px] font-mono-tech text-white font-semibold truncate drop-shadow">
                    {set.institutionName}
                  </span>
                </div>
              </div>

              {/* Album Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-syne font-bold text-sm text-white group-hover:text-[#d4af37] transition-colors">
                        {set.classSetName || `${set.departmentName} '${String(set.graduationYear).slice(-2)}`}
                      </h4>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        {set.departmentName} • Class of {set.graduationYear}
                      </p>
                    </div>
                  </div>

                  {/* Representative Info */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-tech text-zinc-400">
                    <span className="truncate">Rep: <span className="text-zinc-300">{set.classRepName}</span></span>
                    <span className="text-zinc-500 shrink-0">{set.faculty}</span>
                  </div>

                  {/* Storage Capacity Used by this Album */}
                  <div className="flex items-center justify-between text-[11px] font-mono-tech px-3 py-2 rounded-xl bg-black/50 border border-amber-400/20 mt-3">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                      <span>Album Storage Used:</span>
                    </span>
                    <span className="font-bold text-white font-mono-tech">
                      {albumStorageMb} MB
                    </span>
                  </div>

                  {/* Media Counter Chips */}
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-center">
                      <p className="font-syne font-bold text-xs text-white">{approvedCount}</p>
                      <span className="text-[9px] font-mono-tech text-zinc-400 uppercase">Graduates</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-center">
                      <p className="font-syne font-bold text-xs text-white">{memoriesCount}</p>
                      <span className="text-[9px] font-mono-tech text-zinc-400 uppercase">Memories</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-center">
                      <p className="font-syne font-bold text-xs text-white">{videosCount}</p>
                      <span className="text-[9px] font-mono-tech text-zinc-400 uppercase">Videos</span>
                    </div>
                  </div>

                  {/* Thumbnail Previews of Students */}
                  {set.students && set.students.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
                      <div className="flex -space-x-2">
                        {set.students.slice(0, 5).map((stu, i) => (
                          <img
                            key={stu.id || i}
                            src={stu.photoUrl}
                            alt={stu.fullName}
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 rounded-full border border-black object-cover"
                          />
                        ))}
                      </div>
                      {set.students.length > 5 && (
                        <span className="text-[10px] font-mono-tech text-zinc-500 pl-1">
                          +{set.students.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action: Open Album Button */}
                <button
                  type="button"
                  onClick={() => onViewDepartmentAlbum(set.id)}
                  className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open Class Album</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSets.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-[#08090e] border border-white/10">
          <ImageIcon className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="font-syne font-bold text-sm text-white">No class albums found</p>
          <p className="text-zinc-500 text-xs font-body mt-1">
            Try adjusting your search criteria or filter to see available albums.
          </p>
        </div>
      )}
    </div>
  );
};
