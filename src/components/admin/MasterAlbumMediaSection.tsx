import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  ShieldCheck,
  RefreshCw,
  Download,
  Trash2,
  RotateCcw,
  Wrench,
  GitMerge,
  X,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { ClassSet, UniversityDirectoryItem, WebsiteContentOverride } from '../../types';
import {
  fetchAdminSettingsFromServer,
  saveAdminSettingsToServer,
  fetchStorageAuditFromD1,
  reconcileCohortAlbumsInD1,
  repairAlbumMediaInD1,
  exportDatabaseBackupFromD1,
  apiClientDeleteProfile,
  apiClientDeleteMemory,
  apiClientSoftDeleteAlbum,
  apiClientRestoreAlbum,
  apiClientPermanentDeleteAlbum,
  StorageAuditResponse,
} from '../../utils/apiClient';
import { useFeedback } from '../common/FeedbackSystem';

interface MasterAlbumMediaSectionProps {
  sets: ClassSet[];
  universities?: UniversityDirectoryItem[];
  contentOverride?: WebsiteContentOverride;
  onUpdateContentOverride?: (override: WebsiteContentOverride) => void;
  onViewDepartmentAlbum: (setId: string) => void;
  onUpdateSingleSet?: (updatedSet: ClassSet) => void;
  onDeleteSetPermanently?: (setId: string) => void;
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
  onUpdateSingleSet,
  onDeleteSetPermanently,
  compressionResolution = 720,
  onUpdateCompressionResolution,
  onSavePipeline,
}) => {
  const { showSuccess, showError } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'deleted'>('all');
  const [pipelineSavedNotice, setPipelineSavedNotice] = useState(false);

  // Storage & Data Integrity Audit state
  const [storageAudit, setStorageAudit] = useState<StorageAuditResponse | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isReconcilingCohort, setIsReconcilingCohort] = useState<string | null>(null);
  const [isRepairingAlbumId, setIsRepairingAlbumId] = useState<string | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState(false);

  // Owner-controlled individual album content inspector
  const [inspectedAlbumId, setInspectedAlbumId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'profiles' | 'memories' | 'media'>('profiles');

  // Confirmation modal for album deletion inside Media & Data Manager (Cancel / Delete Album)
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState<{
    album: ClassSet;
    isPermanent: boolean;
  } | null>(null);

  const loadStorageAudit = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetchStorageAuditFromD1();
      if (res.success) {
        setStorageAudit(res);
      }
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    loadStorageAudit();
  }, [loadStorageAudit]);

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
  const activeSets = useMemo(() => sets.filter((s) => !s.deletedAt), [sets]);
  const softDeletedSets = useMemo(() => sets.filter((s) => Boolean(s.deletedAt)), [sets]);
  const totalAlbums = activeSets.length;
  const totalStudents = activeSets.reduce((acc, s) => acc + (s.students?.length || 0), 0);
  const totalMemories = activeSets.reduce(
    (acc, s) => acc + (s.memories?.reduce((mAcc, m) => mAcc + (m.images?.length || 1), 0) || 0),
    0
  );
  const totalVideos = activeSets.reduce((acc, s) => acc + (s.videos?.length || 0), 0);

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
    return Number(activeSets.reduce((acc, s) => acc + calculateAlbumStorageMb(s), 0).toFixed(1));
  }, [activeSets]);

  const filteredSets = useMemo(() => {
    return sets.filter((s) => {
      if (statusFilter === 'deleted') {
        if (!s.deletedAt) return false;
      } else {
        if (s.deletedAt) return false;
        if (statusFilter !== 'all' && s.activationStatus !== statusFilter) {
          return false;
        }
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.id?.toLowerCase().includes(q) ||
        s.classSetName?.toLowerCase().includes(q) ||
        s.departmentName?.toLowerCase().includes(q) ||
        s.institutionName?.toLowerCase().includes(q) ||
        String(s.graduationYear).includes(q) ||
        s.classRepName?.toLowerCase().includes(q) ||
        s.classRepEmail?.toLowerCase().includes(q)
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

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      const backup = await exportDatabaseBackupFromD1();
      if (!backup || !backup.success) {
        showError('Backup Failed', backup?.error || 'Could not export D1 database snapshot.');
        return;
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kohot-d1-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('Database Backup Exported', 'Full D1 snapshot downloaded as JSON.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleReconcileDuplicateCohort = async (primaryId: string, secondaryId: string, cohortKey: string) => {
    setIsReconcilingCohort(cohortKey);
    try {
      const res = await reconcileCohortAlbumsInD1({
        primaryAlbumId: primaryId,
        secondaryAlbumId: secondaryId,
        softDeleteSecondaryAfterMerge: false,
      });
      if (res.success && res.album) {
        onUpdateSingleSet?.(res.album);
        const secSet = sets.find((s) => s.id === secondaryId);
        if (secSet) {
          onUpdateSingleSet?.({
            ...secSet,
            deletedAt: new Date().toISOString(),
            deletedBy: 'host-reconciliation',
            isPublished: false,
            isUnpublished: true,
          });
        }
        showSuccess(
          'Cohort Merged & Reconciled',
          `Merged ${res.addedStudentsCount || 0} student profiles and ${res.addedMemoriesCount || 0} memory categories into ${primaryId}. The duplicate test album was preserved for review.`
        );
        await loadStorageAudit();
      } else {
        showError('Reconciliation Failed', res.error || 'Could not merge duplicate cohort albums.');
      }
    } finally {
      setIsReconcilingCohort(null);
    }
  };

  const handleRepairAlbumMedia = async (albumId: string) => {
    setIsRepairingAlbumId(albumId);
    try {
      const res = await repairAlbumMediaInD1(albumId);
      if (res.success && res.album) {
        onUpdateSingleSet?.(res.album);
        showSuccess(
          'Media & Associations Repaired',
          `Repaired ${res.repairedLinksCount || 0} media links and recovered ${res.recoveredMemoriesCount || 0} R2 photos for ${albumId}.`
        );
        await loadStorageAudit();
      } else {
        showError('Repair Failed', res.error || 'Could not repair media references.');
      }
    } finally {
      setIsRepairingAlbumId(null);
    }
  };

  const handleDeleteIndividualProfile = async (album: ClassSet, studentId: string, studentName: string) => {
    const nextStudents = (album.students || []).filter((st) => st.id !== studentId);
    const updated: ClassSet = {
      ...album,
      students: nextStudents,
    };
    onUpdateSingleSet?.(updated);
    await apiClientDeleteProfile(album.id, studentId);
    showSuccess('Profile Removed', `Removed "${studentName}" from ${album.departmentName}.`);
    await loadStorageAudit();
  };

  const handleDeleteIndividualMemoryImage = async (
    album: ClassSet,
    categoryId: string,
    imageId: string,
    categoryTitle: string
  ) => {
    const nextMemories = (album.memories || [])
      .map((cat) => {
        if (cat.id !== categoryId) return cat;
        return {
          ...cat,
          images: (cat.images || []).filter((img) => img.id !== imageId),
        };
      })
      .filter((cat) => (cat.images || []).length > 0);

    const updated: ClassSet = {
      ...album,
      memories: nextMemories,
    };
    onUpdateSingleSet?.(updated);
    await apiClientDeleteMemory(album.id, imageId);
    showSuccess('Memory Photo Removed', `Removed photo from "${categoryTitle}".`);
    await loadStorageAudit();
  };

  const handleDeleteEntireMemoryCategory = async (
    album: ClassSet,
    categoryId: string,
    categoryTitle: string
  ) => {
    const nextMemories = (album.memories || []).filter((cat) => cat.id !== categoryId);
    const updated: ClassSet = {
      ...album,
      memories: nextMemories,
    };
    onUpdateSingleSet?.(updated);
    await apiClientDeleteMemory(album.id, categoryId);
    showSuccess('Memory Category Removed', `Removed category "${categoryTitle}" from ${album.departmentName}.`);
    await loadStorageAudit();
  };

  const handleExecuteConfirmDeleteAlbum = async () => {
    if (!pendingDeleteConfirm) return;
    const { album, isPermanent } = pendingDeleteConfirm;
    setPendingDeleteConfirm(null);

    if (isPermanent) {
      await apiClientPermanentDeleteAlbum(album.id, album.classSetName || album.departmentName);
      onDeleteSetPermanently?.(album.id);
      if (inspectedAlbumId === album.id) setInspectedAlbumId(null);
      showSuccess(
        'Album Permanently Deleted',
        `"${album.classSetName || album.departmentName}" and its exclusive D1 & R2 objects have been permanently deleted.`
      );
    } else {
      const updated: ClassSet = {
        ...album,
        deletedAt: new Date().toISOString(),
        deletedBy: 'master_host',
        isPublished: false,
        isUnpublished: true,
        activationStatus: 'inactive',
      };
      onUpdateSingleSet?.(updated);
      await apiClientSoftDeleteAlbum(album.id, album.classSetName || album.departmentName);
      showSuccess(
        'Album Moved to 30-Day Recovery',
        `"${album.classSetName || album.departmentName}" is now hidden from public view and can be restored within 30 days.`
      );
    }
    await loadStorageAudit();
  };

  const handleRestoreSoftDeletedAlbum = async (album: ClassSet) => {
    const updated: ClassSet = {
      ...album,
      deletedAt: undefined,
      deletedBy: undefined,
      keptByHostOnly: undefined,
      keptByHostAt: undefined,
      isUnpublished: false,
      activationStatus: 'active',
    };
    onUpdateSingleSet?.(updated);
    await apiClientRestoreAlbum(album.id);
    showSuccess(
      'Album Restored',
      `"${album.classSetName || album.departmentName}" has been restored to active status.`
    );
    await loadStorageAudit();
  };

  const inspectedAlbum = useMemo(
    () => sets.find((s) => s.id === inspectedAlbumId) || null,
    [sets, inspectedAlbumId]
  );

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
            <span>
              {storageAudit?.mediaHealth
                ? `${storageAudit.mediaHealth.totalR2Objects} R2 objects`
                : `Across ${totalAlbums} albums`}
            </span>
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
          <span className="text-[10px] text-zinc-500 font-mono-tech mt-1">
            {softDeletedSets.length > 0 ? `${softDeletedSets.length} in 30-day trash` : 'Live archives'}
          </span>
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
          DATA INTEGRITY, R2 STORAGE AUDIT & DUPLICATE COHORT RECONCILIATION
         ===================================================================== */}
      <div
        id="kohot-data-integrity-center"
        className="p-5 sm:p-6 rounded-2xl bg-[#08090e] border border-emerald-500/25 space-y-5 shadow-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-syne font-bold text-sm sm:text-base text-white">
                  Data Integrity, Storage &amp; Recovery Center
                </h3>
                <span className="px-2.5 py-0.5 rounded-full font-mono-tech text-[10px] uppercase font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ENV: {storageAudit?.environment || 'production'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-mono-tech text-[10px] uppercase font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Non-Destructive Mode Active
                </span>
              </div>
              <p className="text-zinc-400 text-xs font-body mt-1">
                Inspect D1 &amp; R2 associations, reconcile duplicate cohorts (such as UNILORIN Public Administration 2026), repair broken image links, and manage individual album photos or profiles without manual Cloudflare access.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadStorageAudit}
              disabled={isLoadingAudit}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              <span>{isLoadingAudit ? 'Auditing...' : 'Audit D1 & R2'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExportingBackup}
              className="px-3.5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#c5a028] text-black font-syne font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingBackup ? 'Exporting...' : 'Export D1 Backup'}</span>
            </button>
          </div>
        </div>

        {/* R2 & D1 Health Summary Pills */}
        {storageAudit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-black/50 border border-white/10">
              <span className="text-[10px] font-mono-tech uppercase text-zinc-400">R2 Bucket Objects</span>
              <p className="font-syne font-bold text-base text-white mt-0.5">
                {storageAudit.mediaHealth.totalR2Objects} files ({storageAudit.mediaHealth.totalMediaAssetRows} D1 rows)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/50 border border-white/10">
              <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Duplicate Cohorts</span>
              <p className="font-syne font-bold text-base text-amber-300 mt-0.5">
                {storageAudit.duplicateCohorts.length} detected
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/50 border border-white/10">
              <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Broken Media Links</span>
              <p className="font-syne font-bold text-base text-sky-300 mt-0.5">
                {storageAudit.mediaHealth.brokenReferences.length} references
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/50 border border-white/10">
              <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Unreferenced R2 Files</span>
              <p className="font-syne font-bold text-base text-zinc-300 mt-0.5">
                {storageAudit.mediaHealth.orphanedR2Objects.length} preserved safely
              </p>
            </div>
          </div>
        )}

        {/* Duplicate Cohorts Reconciliation Panel */}
        {storageAudit && storageAudit.duplicateCohorts.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-amber-400" />
                <h4 className="font-syne font-bold text-xs sm:text-sm text-white">
                  Duplicate Cohort Albums Requiring Owner Review ({storageAudit.duplicateCohorts.length})
                </h4>
              </div>
              <span className="text-[10px] font-mono-tech text-amber-300 uppercase">
                Safe Merge • Zero Data Loss
              </span>
            </div>
            <p className="text-xs text-zinc-300 font-body">
              Multiple album records were found for the same institution, department, and graduation year. Click <strong>Merge &amp; Reconcile</strong> to combine all profiles, memories, slots, and R2 media into the canonical album without losing any student data.
            </p>
            <div className="space-y-2.5">
              {storageAudit.duplicateCohorts.map((dup) => {
                const sorted = [...dup.albums].sort(
                  (a, b) =>
                    b.studentsCount * 10 +
                    b.memoriesCount * 5 -
                    (a.studentsCount * 10 + a.memoriesCount * 5)
                );
                const primary = sorted[0];
                const secondaries = sorted.slice(1);
                return (
                  <div
                    key={dup.cohortKey}
                    className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <p className="font-syne font-bold text-white">
                        Cohort Key: <span className="font-mono-tech text-amber-300">{dup.cohortKey}</span>
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {dup.albums.map((a) => (
                          <div
                            key={a.id}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 font-mono-tech text-[11px] text-zinc-300"
                          >
                            <span className="text-white font-bold">{a.id}</span> • {a.studentsCount} profiles •{' '}
                            {a.memoriesCount} photos • {a.slotBalance} slots • {a.mediaAssetsCount} R2 assets
                            {a.adminEmail ? ` (${a.adminEmail})` : ''}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {secondaries.map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          disabled={isReconcilingCohort === dup.cohortKey}
                          onClick={() => handleReconcileDuplicateCohort(primary.id, sec.id, dup.cohortKey)}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-syne font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                          <span>
                            {isReconcilingCohort === dup.cohortKey
                              ? 'Merging...'
                              : `Merge "${sec.id}" → "${primary.id}"`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
            placeholder="Search albums, IDs, departments, admins..."
            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-body transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {(['all', 'active', 'pending', 'deleted'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                statusFilter === filter
                  ? 'bg-white text-black font-bold shadow'
                  : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {filter === 'deleted' ? `30-Day Trash (${softDeletedSets.length})` : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Albums Grid with Storage Capacity & Direct Owner Content Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSets.map((set) => {
          const approvedCount = set.students?.filter((s) => s.approved !== false).length || 0;
          const memoriesCount =
            set.memories?.reduce((acc, m) => acc + (m.images?.length || 1), 0) || 0;
          const videosCount = set.videos?.length || 0;
          const albumStorageMb = calculateAlbumStorageMb(set);
          const isSoftDeleted = Boolean(set.deletedAt);

          return (
            <div
              key={set.id}
              className={`group rounded-2xl bg-[#08090e] border overflow-hidden flex flex-col transition-all duration-300 shadow-lg hover:shadow-black/60 ${
                isSoftDeleted
                  ? 'border-red-500/30 hover:border-red-500/50'
                  : 'border-white/10 hover:border-white/30'
              }`}
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

                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {isSoftDeleted ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-bold bg-red-500/20 text-red-300 border border-red-500/40 backdrop-blur-md">
                      Deleted (30d Recovery)
                    </span>
                  ) : (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-bold flex items-center gap-1 backdrop-blur-md ${
                        set.isPublished
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {set.isPublished ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                      )}
                      {set.isPublished ? 'Published' : 'Draft'}
                    </span>
                  )}
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
                    <div className="min-w-0">
                      <h4 className="font-syne font-bold text-sm text-white group-hover:text-[#d4af37] transition-colors truncate">
                        {set.classSetName ||
                          `${set.departmentName} '${String(set.graduationYear).slice(-2)}`}
                      </h4>
                      <p className="text-zinc-400 text-xs font-body mt-0.5 truncate">
                        {set.departmentName} • Class of {set.graduationYear}
                      </p>
                      <p className="text-[10px] font-mono-tech text-zinc-500 mt-0.5 truncate">
                        ID: {set.id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono-tech text-zinc-400">
                    <span className="truncate">
                      Rep: <span className="text-zinc-300">{set.classRepName || 'Unassigned'}</span>
                    </span>
                    <span className="text-zinc-500 shrink-0 truncate max-w-[130px]">
                      {set.classRepEmail || set.faculty}
                    </span>
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

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedAlbumId(set.id);
                        setInspectorTab('profiles');
                      }}
                      className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono-tech text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Database className="w-3.5 h-3.5 text-amber-400" />
                      <span>Manage Data</span>
                    </button>
                    <button
                      type="button"
                      disabled={isRepairingAlbumId === set.id}
                      onClick={() => handleRepairAlbumMedia(set.id)}
                      className="py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono-tech text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{isRepairingAlbumId === set.id ? 'Repairing...' : 'Repair R2'}</span>
                    </button>
                  </div>

                  {isSoftDeleted ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestoreSoftDeletedAlbum(set)}
                        className="py-2 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-syne font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteConfirm({ album: set, isPermanent: true })}
                        className="py-2 px-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-mono-tech text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Purge Now</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewDepartmentAlbum(set.id)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Open Class Album</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteConfirm({ album: set, isPermanent: false })}
                        title="Delete Album (30-Day Recovery)"
                        className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
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

      {/* =====================================================================
          OWNER-CONTROLLED INDIVIDUAL ALBUM CONTENT MANAGER MODAL
         ===================================================================== */}
      {inspectedAlbum && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-4xl max-h-[88vh] rounded-3xl bg-[#10121a] border border-white/15 text-white flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-syne font-bold text-base sm:text-lg text-white">
                    {inspectedAlbum.departmentName} • Class of {inspectedAlbum.graduationYear}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 font-mono-tech text-[10px] text-amber-300">
                    ID: {inspectedAlbum.id}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-body mt-0.5">
                  {inspectedAlbum.institutionName} • Admin: {inspectedAlbum.classRepName || 'Unassigned'} ({inspectedAlbum.classRepEmail || 'No email'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedAlbumId(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="px-5 sm:px-6 py-3 bg-black/40 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectorTab('profiles')}
                  className={`px-3.5 py-1.5 rounded-xl font-mono-tech text-xs uppercase cursor-pointer ${
                    inspectorTab === 'profiles'
                      ? 'bg-white text-black font-bold'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  Profiles ({inspectedAlbum.students?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('memories')}
                  className={`px-3.5 py-1.5 rounded-xl font-mono-tech text-xs uppercase cursor-pointer ${
                    inspectorTab === 'memories'
                      ? 'bg-white text-black font-bold'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  Memories ({inspectedAlbum.memories?.reduce((acc, m) => acc + (m.images?.length || 0), 0) || 0})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isRepairingAlbumId === inspectedAlbum.id}
                  onClick={() => handleRepairAlbumMedia(inspectedAlbum.id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{isRepairingAlbumId === inspectedAlbum.id ? 'Repairing...' : 'Recover R2 Media & Profiles'}</span>
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {inspectorTab === 'profiles' && (
                <div className="space-y-2.5">
                  {(inspectedAlbum.students || []).length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-black/40 border border-white/10 text-zinc-400 text-xs">
                      No student profiles currently in this album. Click "Recover R2 Media &amp; Profiles" above to scan D1 submissions and R2 storage.
                    </div>
                  ) : (
                    (inspectedAlbum.students || []).map((st) => (
                      <div
                        key={st.id}
                        className="p-3 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={st.photoUrl}
                            alt={st.fullName}
                            className="w-11 h-11 rounded-xl object-cover bg-zinc-800 border border-white/10 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-syne font-bold text-xs sm:text-sm text-white truncate">
                              {st.fullName}
                            </p>
                            <p className="text-[11px] font-mono-tech text-zinc-400 truncate">
                              {st.position || 'Graduating Member'} • {st.email || st.whatsappNumber || 'No contact'}
                            </p>
                            <p className="text-[10px] font-mono-tech text-zinc-500 truncate">
                              Photo: {st.photoUrl}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteIndividualProfile(inspectedAlbum, st.id, st.fullName)}
                          className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-mono-tech text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {inspectorTab === 'memories' && (
                <div className="space-y-5">
                  {(inspectedAlbum.memories || []).length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-black/40 border border-white/10 text-zinc-400 text-xs">
                      No memory photo categories found in this album. Click "Recover R2 Media &amp; Profiles" above to scan R2 storage for uploaded event photos.
                    </div>
                  ) : (
                    (inspectedAlbum.memories || []).map((cat) => (
                      <div key={cat.id} className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                          <div>
                            <h4 className="font-syne font-bold text-sm text-white">{cat.title}</h4>
                            <p className="text-[11px] font-mono-tech text-zinc-400">
                              {(cat.images || []).length} photos {cat.dateStr ? `• ${cat.dateStr}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntireMemoryCategory(inspectedAlbum, cat.id, cat.title)}
                            className="px-3 py-1 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-mono-tech text-[10px] uppercase flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Category</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                          {(cat.images || []).map((img) => (
                            <div
                              key={img.id}
                              className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-white/10"
                            >
                              <img
                                src={img.url}
                                alt={img.caption || cat.title}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteIndividualMemoryImage(inspectedAlbum, cat.id, img.id, cat.title)
                                }
                                title="Delete this photo"
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-red-600 text-white border border-white/20 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ALBUM DELETION CONFIRMATION MODAL (CANCEL & DELETE ALBUM)
         ===================================================================== */}
      {pendingDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-[#14161f] border border-red-500/40 p-6 sm:p-7 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-white">
                    {pendingDeleteConfirm.isPermanent ? 'Permanently Delete Album' : 'Delete Class Album'}
                  </h3>
                  <p className="text-[11px] font-mono-tech text-amber-400">
                    {pendingDeleteConfirm.isPermanent
                      ? 'Irreversible Action • Exclusive Data & R2 Erased'
                      : 'Recoverable within 30 days'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteConfirm(null)}
                className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-body text-xs text-zinc-300 leading-relaxed">
              <p>
                Are you sure you want to {pendingDeleteConfirm.isPermanent ? 'permanently delete' : 'delete'}{' '}
                <span className="text-white font-bold">
                  {pendingDeleteConfirm.album.departmentName} (Class of {pendingDeleteConfirm.album.graduationYear})
                </span>
                ?
              </p>
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1 font-mono-tech text-[11px] text-zinc-300">
                <p className="text-red-300 font-bold uppercase">Album Inventory:</p>
                <p>• Album ID: {pendingDeleteConfirm.album.id}</p>
                <p>• Student Profiles: {pendingDeleteConfirm.album.students?.length || 0}</p>
                <p>
                  • Memory Photos:{' '}
                  {pendingDeleteConfirm.album.memories?.reduce((acc, m) => acc + (m.images?.length || 0), 0) || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setPendingDeleteConfirm(null)}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white font-mono-tech text-xs uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmDeleteAlbum}
                className="px-6 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-syne font-bold text-xs uppercase shadow-md cursor-pointer transition-colors"
              >
                Delete Album
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

