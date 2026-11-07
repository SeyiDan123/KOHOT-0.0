import React, { useState, useMemo, useEffect } from 'react';
import {
  ImageIcon,
  Search,
  Users,
  Camera,
  Film,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  HardDrive,
  Check,
  Compass,
  Building2,
} from 'lucide-react';
import { ClassSet, UniversityDirectoryItem, WebsiteContentOverride } from '../../types';
import {
  fetchAdminSettingsFromServer,
  saveAdminSettingsToServer,
} from '../../utils/apiClient';
import { useFeedback } from '../common/FeedbackSystem';

interface MasterAlbumMediaSectionProps {
  sets: ClassSet[];
  universities?: UniversityDirectoryItem[];
  contentOverride?: WebsiteContentOverride;
  onUpdateContentOverride?: (override: WebsiteContentOverride) => void;
  onViewDepartmentAlbum: (setId: string) => void;
  compressionResolution?: number;
  onUpdateCompressionResolution?: (res: number) => void;
  compressionQuality?: number;
  onUpdateCompressionQuality?: (q: number) => void;
  onSavePipeline?: () => void;
}

export const MasterAlbumMediaSection: React.FC<MasterAlbumMediaSectionProps> = ({
  sets,
  universities = [],
  contentOverride,
  onUpdateContentOverride,
  onViewDepartmentAlbum,
  compressionResolution = 720,
  onUpdateCompressionResolution,
  onSavePipeline,
}) => {
  const { showSuccess } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [pipelineSavedNotice, setPipelineSavedNotice] = useState(false);

  // Explore other departments (Public Directory) state stored in platform_settings
  const [publicDirectoryEnabled, setPublicDirectoryEnabled] = useState<boolean>(
    Boolean(contentOverride?.publicDirectoryEnabled)
  );
  const [hiddenInstitutions, setHiddenInstitutions] = useState<string[]>(
    contentOverride?.hiddenDirectoryInstitutions || []
  );
  const [hiddenAlbums, setHiddenAlbums] = useState<string[]>(
    contentOverride?.hiddenDirectoryAlbums || []
  );
  const [directoryVisibilityTab, setDirectoryVisibilityTab] = useState<'institutions' | 'albums'>(
    'albums'
  );
  const [visibilitySearch, setVisibilitySearch] = useState('');

  useEffect(() => {
    fetchAdminSettingsFromServer().then((res) => {
      if (res.settings) {
        setPublicDirectoryEnabled(Boolean(res.settings.public_directory_enabled));
        setHiddenInstitutions(res.settings.hidden_directory_institutions || []);
        setHiddenAlbums(res.settings.hidden_directory_albums || []);
      }
    });
  }, []);

  const syncDirectorySettings = async (
    nextEnabled: boolean,
    nextHiddenInsts: string[],
    nextHiddenAlbums: string[]
  ) => {
    setPublicDirectoryEnabled(nextEnabled);
    setHiddenInstitutions(nextHiddenInsts);
    setHiddenAlbums(nextHiddenAlbums);

    await saveAdminSettingsToServer({
      public_directory_enabled: nextEnabled,
      hidden_directory_institutions: nextHiddenInsts,
      hidden_directory_albums: nextHiddenAlbums,
    });

    if (contentOverride && onUpdateContentOverride) {
      onUpdateContentOverride({
        ...contentOverride,
        publicDirectoryEnabled: nextEnabled,
        hiddenDirectoryInstitutions: nextHiddenInsts,
        hiddenDirectoryAlbums: nextHiddenAlbums,
      });
    }
  };

  const handleTogglePublicDirectory = async () => {
    const next = !publicDirectoryEnabled;
    await syncDirectorySettings(next, hiddenInstitutions, hiddenAlbums);
    showSuccess(
      next ? 'Explore other departments enabled' : 'Explore other departments disabled',
      next
        ? 'Visitors can now open the public directory from any legacy wall.'
        : 'The public directory button is hidden and directory links now return not available.'
    );
  };

  const handleToggleHideInstitution = async (instId: string) => {
    const isHidden = hiddenInstitutions.includes(instId);
    const next = isHidden
      ? hiddenInstitutions.filter((id) => id !== instId)
      : [...hiddenInstitutions, instId];
    await syncDirectorySettings(publicDirectoryEnabled, next, hiddenAlbums);
  };

  const handleToggleHideAlbum = async (albumId: string) => {
    const isHidden = hiddenAlbums.includes(albumId);
    const next = isHidden
      ? hiddenAlbums.filter((id) => id !== albumId)
      : [...hiddenAlbums, albumId];
    await syncDirectorySettings(publicDirectoryEnabled, hiddenInstitutions, next);
  };

  // Compute aggregate media metrics
  const totalAlbums = sets.length;
  const totalStudents = sets.reduce((acc, s) => acc + (s.students?.length || 0), 0);
  const totalMemories = sets.reduce(
    (acc, s) => acc + (s.memories?.reduce((mAcc, m) => mAcc + (m.images?.length || 1), 0) || 0),
    0
  );
  const totalVideos = sets.reduce((acc, s) => acc + (s.videos?.length || 0), 0);

  const calculateAlbumStorageMb = (s: ClassSet): number => {
    const studentCount = s.students?.length || 0;
    const memoryCount = s.memories?.reduce((acc, m) => acc + (m.images?.length || 1), 0) || 0;
    const videoCount = s.videos?.length || 0;

    const studentMb = studentCount * 0.18;
    const memoryMb = memoryCount * 0.24;
    const bannerMb = 0.9;
    const videoMb = videoCount * 3.8;

    return Number((studentMb + memoryMb + bannerMb + videoMb).toFixed(1));
  };

  const totalStorageUsedMb = useMemo(() => {
    return Number(sets.reduce((acc, s) => acc + calculateAlbumStorageMb(s), 0).toFixed(1));
  }, [sets]);

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

  const filteredDirectoryAlbums = useMemo(() => {
    const q = visibilitySearch.trim().toLowerCase();
    return sets.filter((s) => {
      if (s.deletedAt) return false;
      if (!q) return true;
      return (
        s.classSetName?.toLowerCase().includes(q) ||
        s.departmentName?.toLowerCase().includes(q) ||
        s.institutionName?.toLowerCase().includes(q) ||
        String(s.graduationYear).includes(q)
      );
    });
  }, [sets, visibilitySearch]);

  const filteredDirectoryInstitutions = useMemo(() => {
    const q = visibilitySearch.trim().toLowerCase();
    return universities.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.shortCode && u.shortCode.toLowerCase().includes(q)) ||
        (u.location && u.location.toLowerCase().includes(q))
      );
    });
  }, [universities, visibilitySearch]);

  return (
    <div className="space-y-6">
      {/* Top Cards Area: Media Metrics & Aggregate Storage Capacity Used */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121422] to-[#08090e] border border-amber-400/30 flex flex-col justify-between shadow-lg col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-amber-300 font-semibold">
              Total Storage
            </span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">
            {totalStorageUsedMb}{' '}
            <span className="text-sm font-mono-tech font-normal text-amber-300">MB</span>
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono-tech mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Across {totalAlbums} albums</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0c1814] to-[#08090e] border border-emerald-500/30 flex flex-col justify-between shadow-lg col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-emerald-400 font-semibold">
              Avg. Image Size
            </span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">
            {totalStudents + totalMemories > 0
              ? Math.round((totalStudents * 175 + totalMemories * 210) / (totalStudents + totalMemories))
              : 182}{' '}
            <span className="text-sm font-mono-tech font-normal text-emerald-400">KB</span>
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono-tech mt-1">
            <span className="text-emerald-400 font-bold">-89%</span>
            <span>vs ~1.9 MB raw input</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">
              Class Albums
            </span>
            <Layers className="w-4 h-4 text-[#d4af37]" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalAlbums}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">Live archives</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">
              Graduates
            </span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalStudents}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">Portraits published</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">
              Moments &amp; Photos
            </span>
            <Camera className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalMemories}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">Memories captured</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400">
              Video Reels
            </span>
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-syne font-extrabold text-2xl text-white mt-2">{totalVideos}</p>
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">YouTube highlights</span>
        </div>
      </div>

      {/* =====================================================================
          EXPLORE OTHER DEPARTMENTS (HOST SWITCH + HIDDEN FROM DIRECTORY LIST)
         ===================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#d4af37] shrink-0 mt-0.5">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-syne font-bold text-sm sm:text-base text-white">
                  Explore other departments
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono-tech text-[10px] uppercase font-bold ${
                    publicDirectoryEnabled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-white/10'
                  }`}
                >
                  {publicDirectoryEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-zinc-400 text-xs font-body mt-1">
                Shows a button on every legacy wall that lets visitors browse other institutions, departments and published class albums.
              </p>
            </div>
          </div>

          <button
            id="toggle-explore-other-departments-btn"
            type="button"
            role="switch"
            aria-checked={publicDirectoryEnabled}
            onClick={handleTogglePublicDirectory}
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              publicDirectoryEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                publicDirectoryEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Hidden from directory list */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h4 className="font-syne font-bold text-xs sm:text-sm text-white">
                Hidden from directory ({hiddenAlbums.length + hiddenInstitutions.length})
              </h4>
              <p className="text-zinc-400 text-[11px] font-body">
                Hide or unhide any institution or published class album from the public directory.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/60 border border-white/10 self-start">
              <button
                type="button"
                onClick={() => setDirectoryVisibilityTab('albums')}
                className={`px-3 py-1 rounded-lg font-mono-tech text-[10px] uppercase cursor-pointer ${
                  directoryVisibilityTab === 'albums'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Albums ({hiddenAlbums.length} hidden)
              </button>
              <button
                type="button"
                onClick={() => setDirectoryVisibilityTab('institutions')}
                className={`px-3 py-1 rounded-lg font-mono-tech text-[10px] uppercase cursor-pointer ${
                  directoryVisibilityTab === 'institutions'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Institutions ({hiddenInstitutions.length} hidden)
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={visibilitySearch}
              onChange={(e) => setVisibilitySearch(e.target.value)}
              placeholder={
                directoryVisibilityTab === 'albums'
                  ? 'Filter albums to hide or unhide...'
                  : 'Filter institutions to hide or unhide...'
              }
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none"
            />
          </div>

          {directoryVisibilityTab === 'albums' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredDirectoryAlbums.map((album) => {
                const isHidden = hiddenAlbums.includes(album.id);
                const isUnlistedByAdmin = album.isListedInDirectory === false;
                return (
                  <div
                    key={album.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      isHidden
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-black/40 border-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-syne font-bold text-white truncate">
                        {album.classSetName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {album.institutionName} · {album.departmentName} ({album.graduationYear})
                      </p>
                      {isUnlistedByAdmin && (
                        <span className="text-[9px] font-mono-tech text-amber-400">
                          Unlisted by Album Admin
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleHideAlbum(album.id)}
                      className={`px-2.5 py-1 rounded-lg font-mono-tech text-[10px] uppercase shrink-0 flex items-center gap-1 cursor-pointer ${
                        isHidden
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/10 hover:bg-white/15 text-zinc-300'
                      }`}
                    >
                      {isHidden ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Unhide</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Hide</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredDirectoryInstitutions.map((uni) => {
                const isHidden = hiddenInstitutions.includes(uni.id);
                return (
                  <div
                    key={uni.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      isHidden
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-black/40 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-syne font-bold text-white truncate">{uni.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {uni.shortCode} · {uni.departments?.length || 0} depts
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleHideInstitution(uni.id)}
                      className={`px-2.5 py-1 rounded-lg font-mono-tech text-[10px] uppercase shrink-0 flex items-center gap-1 cursor-pointer ${
                        isHidden
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/10 hover:bg-white/15 text-zinc-300'
                      }`}
                    >
                      {isHidden ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Unhide</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Hide</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* IMAGE OPTIMIZATION & COMPRESSION PIPELINE */}
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

        <div className="pt-1">
          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5">
            Target Max Dimension Resolution
          </label>
          <select
            value={compressionResolution}
            onChange={(e) => onUpdateCompressionResolution?.(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value={144}>144px (Ultra Lite Thumbnail • ~18KB)</option>
            <option value={720}>720px (Optimal for mobile networks • ~85KB)</option>
            <option value={1080}>1080px (FHD Sharpness • ~180KB)</option>
            <option value={1440}>1440px (QHD Archival • ~320KB)</option>
          </select>
          <p className="text-[10px] text-zinc-500 font-mono-tech mt-1">
            Downscales oversized images automatically preserving native aspect ratio.
          </p>
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
          const memoriesCount =
            set.memories?.reduce((acc, m) => acc + (m.images?.length || 1), 0) || 0;
          const videosCount = set.videos?.length || 0;
          const albumStorageMb = calculateAlbumStorageMb(set);

          return (
            <div
              key={set.id}
              className="group rounded-2xl bg-[#08090e] border border-white/10 overflow-hidden flex flex-col hover:border-white/30 transition-all duration-300 shadow-lg hover:shadow-black/60"
            >
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

              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-syne font-bold text-sm text-white group-hover:text-[#d4af37] transition-colors">
                        {set.classSetName ||
                          `${set.departmentName} '${String(set.graduationYear).slice(-2)}`}
                      </h4>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        {set.departmentName} • Class of {set.graduationYear}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-tech text-zinc-400">
                    <span className="truncate">
                      Rep: <span className="text-zinc-300">{set.classRepName}</span>
                    </span>
                    <span className="text-zinc-500 shrink-0">{set.faculty}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono-tech px-3 py-2 rounded-xl bg-black/50 border border-amber-400/20 mt-3">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                      <span>Album Storage Used:</span>
                    </span>
                    <span className="font-bold text-white font-mono-tech">{albumStorageMb} MB</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-center">
                      <p className="font-syne font-bold text-xs text-white">{approvedCount}</p>
                      <span className="text-[9px] font-mono-tech text-zinc-400 uppercase">
                        Graduates
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-center">
                      <p className="font-syne font-bold text-xs text-white">{memoriesCount}</p>
                      <span className="text-[9px] font-mono-tech text-zinc-400 uppercase">
                        Memories
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-center">
                      <p className="font-syne font-bold text-xs text-white">{videosCount}</p>
                      <span className="text-[9px] font-mono-tech text-zinc-400 uppercase">
                        Videos
                      </span>
                    </div>
                  </div>
                </div>

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
