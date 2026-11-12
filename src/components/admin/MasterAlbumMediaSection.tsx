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
  Music,
  Volume2,
  Upload,
  Share2,
  Globe,
} from 'lucide-react';
import { ClassSet, DepartmentSocials, UniversityDirectoryItem, WebsiteContentOverride } from '../../types';
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
  R2MediaInventoryItem,
  R2MediaInventoryResponse,
  fetchR2MediaInventoryFromServer,
  recoverR2MediaItemsOnServer,
  deleteR2MediaItemsOnServer,
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
  albumBgMusicUrl?: string;
  onUpdateAlbumBgMusicUrl?: (url: string) => void;
  onUploadAlbumBgMusicFile?: (file: File) => void;
  platformTitle?: string;
  onUpdatePlatformTitle?: (title: string) => void;
  supportEmail?: string;
  onUpdateSupportEmail?: (email: string) => void;
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
  compressionResolution = 1440,
  onUpdateCompressionResolution,
  albumBgMusicUrl = '',
  onUpdateAlbumBgMusicUrl,
  onUploadAlbumBgMusicFile,
  platformTitle = 'KOHOT',
  onUpdatePlatformTitle,
  supportEmail = 'support@kohot.ng',
  onUpdateSupportEmail,
  onSavePipeline,
}) => {
  const { showSuccess, showError } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'deleted'>('all');
  const [pipelineSavedNotice, setPipelineSavedNotice] = useState(false);

  // Normalize compression resolution to one of the 3 canonical options (1280, 1440 default, 1920)
  const effectiveCompressionResolution = useMemo(() => {
    if (compressionResolution === 1280 || compressionResolution === 1440 || compressionResolution === 1920) {
      return compressionResolution;
    }
    return 1440;
  }, [compressionResolution]);

  // Storage & Data Integrity Audit state
  const [storageAudit, setStorageAudit] = useState<StorageAuditResponse | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isReconcilingCohort, setIsReconcilingCohort] = useState<string | null>(null);
  const [isRepairingAlbumId, setIsRepairingAlbumId] = useState<string | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState(false);

  // Cloudflare R2 Media Management & Recovery Center state
  const [r2Inventory, setR2Inventory] = useState<R2MediaInventoryResponse | null>(null);
  const [isLoadingR2Inventory, setIsLoadingR2Inventory] = useState(false);
  const [r2StatusFilter, setR2StatusFilter] = useState<
    'all' | 'orphaned' | 'recoverable' | 'linked' | 'missing-reference' | 'unrecognised'
  >('all');
  const [r2SearchQuery, setR2SearchQuery] = useState('');
  const [r2AlbumFilter, setR2AlbumFilter] = useState<string>('all');
  const [selectedR2Keys, setSelectedR2Keys] = useState<string[]>([]);
  const [showR2LogsPanel, setShowR2LogsPanel] = useState(false);
  const [isRecoveringR2Batch, setIsRecoveringR2Batch] = useState(false);
  const [isDeletingR2Batch, setIsDeletingR2Batch] = useState(false);
  const [r2InspectItem, setR2InspectItem] = useState<R2MediaInventoryItem | null>(null);
  const [r2ManualAssignItems, setR2ManualAssignItems] = useState<R2MediaInventoryItem[] | null>(null);
  const [manualTargetAlbumId, setManualTargetAlbumId] = useState<string>('');
  const [manualTargetRecordType, setManualTargetRecordType] = useState<
    'moment' | 'profile' | 'banner' | 'footer' | 'logo'
  >('moment');
  const [manualTargetCategoryTitle, setManualTargetCategoryTitle] = useState<string>(
    'Recovered R2 Archive Photos'
  );
  const [manualTargetRecordId, setManualTargetRecordId] = useState<string>('');
  const [r2DeleteConfirmItems, setR2DeleteConfirmItems] = useState<R2MediaInventoryItem[] | null>(
    null
  );

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

  const loadR2Inventory = useCallback(async () => {
    setIsLoadingR2Inventory(true);
    try {
      const res = await fetchR2MediaInventoryFromServer();
      if (res.success) {
        setR2Inventory(res);
      }
    } finally {
      setIsLoadingR2Inventory(false);
    }
  }, []);

  useEffect(() => {
    loadStorageAudit();
    loadR2Inventory();
  }, [loadStorageAudit, loadR2Inventory]);

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

  // Host-only KOHOT Footer Social Links (displayed under KOHOT + Preserve the memories. on all footers when configured)
  const [kohotSocials, setKohotSocials] = useState<DepartmentSocials>({
    youtube: contentOverride?.kohotSocials?.youtube || '',
    instagram: contentOverride?.kohotSocials?.instagram || '',
    twitter: contentOverride?.kohotSocials?.twitter || '',
    linkedin: contentOverride?.kohotSocials?.linkedin || '',
    website: contentOverride?.kohotSocials?.website || '',
  });
  const [kohotSocialsSaved, setKohotSocialsSaved] = useState(false);

  useEffect(() => {
    setKohotSocials({
      youtube: contentOverride?.kohotSocials?.youtube || '',
      instagram: contentOverride?.kohotSocials?.instagram || '',
      twitter: contentOverride?.kohotSocials?.twitter || '',
      linkedin: contentOverride?.kohotSocials?.linkedin || '',
      website: contentOverride?.kohotSocials?.website || '',
    });
  }, [contentOverride?.kohotSocials]);

  const handleSaveKohotSocials = () => {
    const cleaned: DepartmentSocials = {
      youtube: kohotSocials.youtube?.trim() || undefined,
      instagram: kohotSocials.instagram?.trim() || undefined,
      twitter: kohotSocials.twitter?.trim() || undefined,
      linkedin: kohotSocials.linkedin?.trim() || undefined,
      website: kohotSocials.website?.trim() || undefined,
    };
    if (contentOverride && onUpdateContentOverride) {
      onUpdateContentOverride({
        ...contentOverride,
        kohotSocials: cleaned,
      });
    }
    setKohotSocialsSaved(true);
    showSuccess(
      'KOHOT Footer Socials Saved',
      'Your KOHOT social links have been updated across all Class Albums, Legacy Walls, and the Website footer.'
    );
    setTimeout(() => setKohotSocialsSaved(false), 3000);
  };

  useEffect(() => {
    fetchAdminSettingsFromServer().then((res) => {
      if (res.settings) {
        setPublicDirectoryEnabled(Boolean(res.settings.public_directory_enabled));
        setHiddenInstitutions(res.settings.hidden_directory_institutions || []);
        setHiddenAlbums(res.settings.hidden_directory_albums || []);
        const serverRes = Number(res.settings.compression_resolution_px);
        if ((serverRes === 1280 || serverRes === 1440 || serverRes === 1920) && onUpdateCompressionResolution) {
          onUpdateCompressionResolution(serverRes);
          try {
            localStorage.setItem('kohot_compression_resolution_px', String(serverRes));
          } catch {
            // ignore storage errors
          }
        }
      }
    });
  }, [onUpdateCompressionResolution]);

  const handleCompressionChange = async (nextRes: number) => {
    const validRes = nextRes === 1280 || nextRes === 1440 || nextRes === 1920 ? nextRes : 1440;
    onUpdateCompressionResolution?.(validRes);
    try {
      localStorage.setItem('kohot_compression_resolution_px', String(validRes));
    } catch {
      // ignore
    }
    await saveAdminSettingsToServer({
      compression_resolution_px: validRes,
    });
    if (contentOverride && onUpdateContentOverride) {
      onUpdateContentOverride({
        ...contentOverride,
        defaultCompressionResolution: validRes,
      });
    }
    setPipelineSavedNotice(true);
    setTimeout(() => setPipelineSavedNotice(false), 3000);
  };

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
    if (r2Inventory?.summary?.totalBytes && r2Inventory.summary.totalBytes > 0) {
      return Number((r2Inventory.summary.totalBytes / (1024 * 1024)).toFixed(1));
    }
    return Number(activeSets.reduce((acc, s) => acc + calculateAlbumStorageMb(s), 0).toFixed(1));
  }, [activeSets, r2Inventory]);

  const filteredR2Items = useMemo(() => {
    const items = r2Inventory?.items || [];
    return items.filter((item) => {
      if (r2StatusFilter !== 'all' && item.status !== r2StatusFilter) {
        return false;
      }
      if (r2AlbumFilter !== 'all') {
        const matchedAlbum = item.associatedAlbumId || item.suggestedRecovery?.targetAlbumId || '';
        if (matchedAlbum !== r2AlbumFilter) return false;
      }
      if (!r2SearchQuery.trim()) return true;
      const q = r2SearchQuery.toLowerCase().trim();
      return (
        item.key.toLowerCase().includes(q) ||
        item.filename.toLowerCase().includes(q) ||
        (item.associatedAlbumName || '').toLowerCase().includes(q) ||
        (item.associatedRecordLabel || '').toLowerCase().includes(q) ||
        (item.suggestedRecovery?.targetAlbumName || '').toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
      );
    });
  }, [r2Inventory, r2StatusFilter, r2AlbumFilter, r2SearchQuery]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleToggleSelectR2Key = (key: string) => {
    setSelectedR2Keys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllFilteredR2 = () => {
    const allFilteredKeys = filteredR2Items.map((i) => i.key);
    const allSelected =
      allFilteredKeys.length > 0 && allFilteredKeys.every((k) => selectedR2Keys.includes(k));
    if (allSelected) {
      setSelectedR2Keys((prev) => prev.filter((k) => !allFilteredKeys.includes(k)));
    } else {
      setSelectedR2Keys((prev) => Array.from(new Set([...prev, ...allFilteredKeys])));
    }
  };

  const handleSmartRecoverItems = async (itemsToRecover: R2MediaInventoryItem[]) => {
    const actionable = itemsToRecover.filter(
      (item) => item.suggestedRecovery?.targetAlbumId || item.associatedAlbumId
    );
    if (actionable.length === 0) {
      const defaultAlbum = sets[0]?.id || '';
      setManualTargetAlbumId(defaultAlbum);
      setManualTargetRecordType('moment');
      setManualTargetCategoryTitle('Recovered R2 Archive Photos');
      setManualTargetRecordId('');
      setR2ManualAssignItems(itemsToRecover);
      return;
    }

    setIsRecoveringR2Batch(true);
    try {
      const payload = actionable.map((item) => ({
        key: item.key,
        targetAlbumId: (item.suggestedRecovery?.targetAlbumId || item.associatedAlbumId) as string,
        targetRecordType: item.suggestedRecovery?.targetRecordType || 'moment',
        targetRecordId: item.suggestedRecovery?.targetRecordId,
        targetCategoryTitle:
          item.suggestedRecovery?.targetCategoryTitle || 'Recovered R2 Archive Photos',
      }));
      const res = await recoverR2MediaItemsOnServer(payload);
      if (res.success) {
        if (Array.isArray(res.updatedAlbums)) {
          res.updatedAlbums.forEach((alb) => onUpdateSingleSet?.(alb));
        }
        setSelectedR2Keys((prev) => prev.filter((k) => !actionable.some((a) => a.key === k)));
        showSuccess(
          'R2 Media Relinked & Recovered',
          `Recovered ${res.recoveredCount || actionable.length} media file(s) without creating duplicates.`
        );
        await Promise.all([loadR2Inventory(), loadStorageAudit()]);
      } else {
        showError('Recovery Failed', res.error || 'Could not relink selected R2 media.');
      }
    } finally {
      setIsRecoveringR2Batch(false);
    }
  };

  const handleOpenManualAssignModal = (items: R2MediaInventoryItem[]) => {
    if (items.length === 0) return;
    const firstSuggestion =
      items[0].suggestedRecovery?.targetAlbumId || items[0].associatedAlbumId || sets[0]?.id || '';
    setManualTargetAlbumId(firstSuggestion);
    setManualTargetRecordType(items[0].suggestedRecovery?.targetRecordType || 'moment');
    setManualTargetCategoryTitle(
      items[0].suggestedRecovery?.targetCategoryTitle || 'Recovered R2 Archive Photos'
    );
    setManualTargetRecordId(items[0].suggestedRecovery?.targetRecordId || '');
    setR2ManualAssignItems(items);
  };

  const handleConfirmManualAssign = async () => {
    if (!r2ManualAssignItems || r2ManualAssignItems.length === 0 || !manualTargetAlbumId) return;
    setIsRecoveringR2Batch(true);
    try {
      const payload = r2ManualAssignItems.map((item) => ({
        key: item.key,
        targetAlbumId: manualTargetAlbumId,
        targetRecordType: manualTargetRecordType,
        targetRecordId: manualTargetRecordId.trim() || undefined,
        targetCategoryTitle: manualTargetCategoryTitle.trim() || 'Recovered R2 Archive Photos',
      }));
      const res = await recoverR2MediaItemsOnServer(payload);
      if (res.success) {
        if (Array.isArray(res.updatedAlbums)) {
          res.updatedAlbums.forEach((alb) => onUpdateSingleSet?.(alb));
        }
        const assignedKeys = r2ManualAssignItems.map((i) => i.key);
        setSelectedR2Keys((prev) => prev.filter((k) => !assignedKeys.includes(k)));
        setR2ManualAssignItems(null);
        showSuccess(
          'Media Assigned to Album',
          `Assigned ${res.recoveredCount || payload.length} file(s) to ${manualTargetAlbumId} without creating duplicate files.`
        );
        await Promise.all([loadR2Inventory(), loadStorageAudit()]);
      } else {
        showError('Manual Assignment Failed', res.error || 'Could not assign R2 media.');
      }
    } finally {
      setIsRecoveringR2Batch(false);
    }
  };

  const handleConfirmPermanentDeleteR2 = async () => {
    if (!r2DeleteConfirmItems || r2DeleteConfirmItems.length === 0) return;
    const keys = r2DeleteConfirmItems.map((i) => i.key);
    setIsDeletingR2Batch(true);
    try {
      const res = await deleteR2MediaItemsOnServer(keys);
      if (res.success) {
        setSelectedR2Keys((prev) => prev.filter((k) => !keys.includes(k)));
        setR2DeleteConfirmItems(null);
        const blockedMsg =
          res.blocked && res.blocked.length > 0
            ? ` (${res.blocked.length} active/30-day protected file(s) were safely preserved.)`
            : '';
        showSuccess(
          'Unwanted R2 Files Deleted',
          `Permanently deleted ${res.deletedCount || 0} file(s) from Cloudflare R2.${blockedMsg}`
        );
        await Promise.all([loadR2Inventory(), loadStorageAudit()]);
      } else {
        showError('R2 Deletion Blocked', res.error || 'Could not delete selected R2 objects.');
      }
    } finally {
      setIsDeletingR2Batch(false);
    }
  };

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

  const handleSavePipelineClick = async () => {
    await saveAdminSettingsToServer({
      compression_resolution_px: effectiveCompressionResolution,
    });
    try {
      localStorage.setItem('kohot_compression_resolution_px', String(effectiveCompressionResolution));
    } catch {
      // ignore
    }
    if (onSavePipeline) {
      onSavePipeline();
    }
    setPipelineSavedNotice(true);
    setTimeout(() => setPipelineSavedNotice(false), 3000);
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
      showSuccess(
        'D1 Database + R2 Manifest Exported',
        'Downloaded D1 snapshot + R2 metadata manifest. (Binary R2 media objects remain in Cloudflare R2 and require bucket replication.)'
      );
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
        await Promise.all([loadStorageAudit(), loadR2Inventory()]);
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
        await Promise.all([loadStorageAudit(), loadR2Inventory()]);
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
    await Promise.all([loadStorageAudit(), loadR2Inventory()]);
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
    await Promise.all([loadStorageAudit(), loadR2Inventory()]);
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
    await Promise.all([loadStorageAudit(), loadR2Inventory()]);
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
    await Promise.all([loadStorageAudit(), loadR2Inventory()]);
  };

  const handleRestoreSoftDeletedAlbum = async (album: ClassSet) => {
    const res = await apiClientRestoreAlbum(album.id);
    if (!res.success) {
      if (res.expired) {
        onDeleteSetPermanently?.(album.id);
      }
      showError(
        res.expired ? '30-Day Recovery Window Expired' : 'Restore Failed',
        res.error || 'This album could not be restored.'
      );
      await Promise.all([loadStorageAudit(), loadR2Inventory()]);
      return;
    }

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
    showSuccess(
      'Album Restored',
      `"${album.classSetName || album.departmentName}" has been restored to active status.`
    );
    await Promise.all([loadStorageAudit(), loadR2Inventory()]);
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
      {/* Top Cards Area: Media Metrics & Aggregate Storage Capacity Used (Matches KoHot Finances KPI Card UI) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
              Total Storage
            </span>
            <HardDrive className="w-4 h-4 text-[#d4af37]" />
          </div>
          <p className="font-syne font-extrabold text-xl sm:text-2xl text-white">
            {totalStorageUsedMb}{' '}
            <span className="text-xs font-mono-tech font-semibold text-[#d4af37]">MB</span>
          </p>
          <span className="font-body text-[11px] text-zinc-500 block">
            {r2Inventory?.summary
              ? `${r2Inventory.summary.totalR2Objects} R2 objects`
              : storageAudit?.mediaHealth
              ? `${storageAudit.mediaHealth.totalR2Objects} R2 objects`
              : `Across ${totalAlbums} albums`}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
              Avg. Image Size
            </span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-syne font-extrabold text-xl sm:text-2xl text-white">
            {totalStudents + totalMemories > 0
              ? Math.round((totalStudents * 175 + totalMemories * 210) / (totalStudents + totalMemories))
              : 182}{' '}
            <span className="text-xs font-mono-tech font-semibold text-emerald-400">KB</span>
          </p>
          <span className="font-body text-[11px] text-zinc-500 block">
            <strong className="text-emerald-400 font-mono-tech">-89%</strong> vs ~1.9 MB raw input
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
              Class Albums
            </span>
            <Layers className="w-4 h-4 text-[#d4af37]" />
          </div>
          <p className="font-syne font-extrabold text-xl sm:text-2xl text-white">{totalAlbums}</p>
          <span className="font-body text-[11px] text-zinc-500 block">
            {softDeletedSets.length > 0 ? `${softDeletedSets.length} in 30-day trash` : 'Live archives'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
              Graduates
            </span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <p className="font-syne font-extrabold text-xl sm:text-2xl text-white">{totalStudents}</p>
          <span className="font-body text-[11px] text-zinc-500 block">Portraits published</span>
        </div>

        <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
              Moments &amp; Photos
            </span>
            <Camera className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-syne font-extrabold text-xl sm:text-2xl text-white">{totalMemories}</p>
          <span className="font-body text-[11px] text-zinc-500 block">Memories captured</span>
        </div>

        <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
              Video Reels
            </span>
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-syne font-extrabold text-xl sm:text-2xl text-white">{totalVideos}</p>
          <span className="font-body text-[11px] text-zinc-500 block">YouTube highlights</span>
        </div>
      </div>

      {/* =====================================================================
          COMPLETE CLOUDFLARE R2 MEDIA MANAGEMENT & RECOVERY CENTER
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
                  Cloudflare R2 Media Management &amp; Recovery Center
                </h3>
                <span className="px-2.5 py-0.5 rounded-full font-mono-tech text-[10px] uppercase font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ENV: {storageAudit?.environment || 'production'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-mono-tech text-[10px] uppercase font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  30-Day Safe Guard Active
                </span>
              </div>
              <p className="text-zinc-400 text-xs font-body mt-1">
                Scan and browse actual Cloudflare R2 bucket contents, inspect orphaned or missing-reference files, relink media to albums/profiles/Moments without creating duplicates, and safely purge confirmed unwanted files.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                loadR2Inventory();
                loadStorageAudit();
              }}
              disabled={isLoadingR2Inventory || isLoadingAudit}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingR2Inventory || isLoadingAudit ? 'animate-spin' : ''}`}
              />
              <span>{isLoadingR2Inventory ? 'Scanning R2...' : 'Scan R2 Bucket'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowR2LogsPanel((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{showR2LogsPanel ? 'Hide Scan & Action Logs' : 'Scan & Action Logs'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExportingBackup}
              title="Exports full D1 database snapshot + R2 object metadata manifest (binary R2 media files remain in Cloudflare R2)"
              className="px-3.5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#c5a028] text-black font-syne font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingBackup ? 'Exporting...' : 'Export D1 + R2 Manifest'}</span>
            </button>
          </div>
        </div>

        {/* R2 & D1 Health Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-black/50 border border-white/10">
            <span className="text-[10px] font-mono-tech uppercase text-zinc-400">R2 Bucket Objects</span>
            <p className="font-syne font-bold text-sm sm:text-base text-white mt-0.5">
              {r2Inventory?.summary?.totalR2Objects ?? storageAudit?.mediaHealth.totalR2Objects ?? 0} files
            </p>
            <span className="text-[10px] font-mono-tech text-zinc-500">
              {formatFileSize(r2Inventory?.summary?.totalBytes || 0)} total
            </span>
          </div>
          <div className="p-3 rounded-xl bg-black/50 border border-white/10">
            <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Linked Active</span>
            <p className="font-syne font-bold text-sm sm:text-base text-emerald-400 mt-0.5">
              {r2Inventory?.summary?.linkedCount ?? 0} linked
            </p>
            <span className="text-[10px] font-mono-tech text-zinc-500">Protected from deletion</span>
          </div>
          <div className="p-3 rounded-xl bg-black/50 border border-white/10">
            <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Orphaned in R2</span>
            <p className="font-syne font-bold text-sm sm:text-base text-amber-300 mt-0.5">
              {r2Inventory?.summary?.orphanedCount ??
                storageAudit?.mediaHealth.orphanedR2Objects.length ??
                0}{' '}
              files
            </p>
            <span className="text-[10px] font-mono-tech text-zinc-500">Ready to relink or purge</span>
          </div>
          <div className="p-3 rounded-xl bg-black/50 border border-white/10">
            <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Recoverable</span>
            <p className="font-syne font-bold text-sm sm:text-base text-sky-300 mt-0.5">
              {r2Inventory?.summary?.recoverableCount ?? 0} files
            </p>
            <span className="text-[10px] font-mono-tech text-zinc-500">From deleted/damaged records</span>
          </div>
          <div className="p-3 rounded-xl bg-black/50 border border-white/10">
            <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Missing Reference</span>
            <p className="font-syne font-bold text-sm sm:text-base text-rose-300 mt-0.5">
              {r2Inventory?.summary?.missingReferenceCount ??
                storageAudit?.mediaHealth.brokenReferences.length ??
                0}{' '}
              links
            </p>
            <span className="text-[10px] font-mono-tech text-zinc-500">Record points to missing R2</span>
          </div>
          <div className="p-3 rounded-xl bg-black/50 border border-white/10">
            <span className="text-[10px] font-mono-tech uppercase text-zinc-400">Unrecognised</span>
            <p className="font-syne font-bold text-sm sm:text-base text-zinc-300 mt-0.5">
              {r2Inventory?.summary?.unrecognisedCount ?? 0} files
            </p>
            <span className="text-[10px] font-mono-tech text-zinc-500">Manual assignment available</span>
          </div>
        </div>

        {/* Scan History & Action Logs Drawer */}
        {showR2LogsPanel && r2Inventory && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-2xl bg-black/60 border border-white/10">
            <div className="space-y-2">
              <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-[#d4af37]">
                Recent R2 Bucket Scan History ({r2Inventory.scanHistory?.length || 0})
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(r2Inventory.scanHistory || []).length === 0 ? (
                  <p className="text-xs text-zinc-500 font-mono-tech">No scan logs recorded yet.</p>
                ) : (
                  (r2Inventory.scanHistory || []).map((scan) => (
                    <div
                      key={scan.id}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono-tech flex items-center justify-between gap-2"
                    >
                      <span className="text-zinc-300 truncate">{scan.summary}</span>
                      <span className="text-zinc-500 shrink-0">
                        {new Date(scan.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-syne font-bold text-xs uppercase tracking-wider text-emerald-400">
                Media Recovery &amp; Purge Action Logs ({r2Inventory.actionLogs?.length || 0})
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(r2Inventory.actionLogs || []).length === 0 ? (
                  <p className="text-xs text-zinc-500 font-mono-tech">No recovery or deletion actions logged yet.</p>
                ) : (
                  (r2Inventory.actionLogs || []).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono-tech flex items-center justify-between gap-2"
                    >
                      <span className="text-zinc-300 truncate">
                        <strong className="text-white uppercase">{log.action}:</strong> {log.summary}
                      </span>
                      <span className="text-zinc-500 shrink-0">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* R2 Media Inventory Filter Clips, Search & Batch Action Toolbar */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Gold Highlight Sub-Clip Pod for R2 Inventory Filters */}
            <div
              role="tablist"
              aria-label="R2 Media Inventory Status Filters"
              className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-full bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 shadow-xs self-start"
            >
              {(
                [
                  { id: 'all', label: `All (${r2Inventory?.items?.length || 0})` },
                  { id: 'orphaned', label: `Orphaned (${r2Inventory?.summary?.orphanedCount || 0})` },
                  { id: 'recoverable', label: `Recoverable (${r2Inventory?.summary?.recoverableCount || 0})` },
                  { id: 'linked', label: `Linked (${r2Inventory?.summary?.linkedCount || 0})` },
                  {
                    id: 'missing-reference',
                    label: `Missing-Ref (${r2Inventory?.summary?.missingReferenceCount || 0})`,
                  },
                  {
                    id: 'unrecognised',
                    label: `Unrecognised (${r2Inventory?.summary?.unrecognisedCount || 0})`,
                  },
                ] as const
              ).map((tab) => {
                const isActive = r2StatusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setR2StatusFilter(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full font-mono-tech text-[11px] uppercase tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? 'active-clip bg-[#d4af37] text-black font-bold shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={r2SearchQuery}
                  onChange={(e) => setR2SearchQuery(e.target.value)}
                  placeholder="Search filename, storage key, album..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <select
                value={r2AlbumFilter}
                onChange={(e) => setR2AlbumFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white font-mono-tech focus:outline-none cursor-pointer"
              >
                <option value="all">All Albums</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.departmentName} '{String(s.graduationYear).slice(-2)} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Batch Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllFilteredR2}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono-tech text-[11px] cursor-pointer"
              >
                {filteredR2Items.length > 0 &&
                filteredR2Items.every((i) => selectedR2Keys.includes(i.key))
                  ? 'Deselect Visible'
                  : `Select Visible (${filteredR2Items.length})`}
              </button>
              <span className="text-xs font-mono-tech text-zinc-400">
                {selectedR2Keys.length} file(s) selected
              </span>
            </div>

            {selectedR2Keys.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isRecoveringR2Batch}
                  onClick={() => {
                    const selectedItems = (r2Inventory?.items || []).filter((i) =>
                      selectedR2Keys.includes(i.key)
                    );
                    handleSmartRecoverItems(selectedItems);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-syne font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {isRecoveringR2Batch
                      ? 'Recovering...'
                      : `Restore / Relink Selected (${selectedR2Keys.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const selectedItems = (r2Inventory?.items || []).filter((i) =>
                      selectedR2Keys.includes(i.key)
                    );
                    handleOpenManualAssignModal(selectedItems);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black font-syne font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Assign to Album / Record</span>
                </button>
                <button
                  type="button"
                  disabled={isDeletingR2Batch}
                  onClick={() => {
                    const selectedItems = (r2Inventory?.items || []).filter((i) =>
                      selectedR2Keys.includes(i.key)
                    );
                    setR2DeleteConfirmItems(selectedItems);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Delete Selected</span>
                </button>
              </div>
            )}
          </div>

          {/* Browsable R2 Media Inventory Grid */}
          {isLoadingR2Inventory && !r2Inventory ? (
            <div className="p-8 text-center rounded-2xl bg-black/40 border border-white/10 text-zinc-400 text-xs font-mono-tech">
              Scanning Cloudflare R2 bucket and cross-referencing D1 records...
            </div>
          ) : filteredR2Items.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-black/40 border border-white/10 text-zinc-400 text-xs font-mono-tech">
              No R2 media objects match the current filter ({r2StatusFilter}).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[540px] overflow-y-auto pr-1">
              {filteredR2Items.map((item) => {
                const isSelected = selectedR2Keys.includes(item.key);
                const isImage = item.mimeType.startsWith('image/');
                const isAudio = item.mimeType.startsWith('audio/');
                const isVideo = item.mimeType.startsWith('video/');

                const statusBadgeClass =
                  item.status === 'linked'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : item.status === 'orphaned'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : item.status === 'recoverable'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : item.status === 'missing-reference'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-zinc-700/60 text-zinc-300 border-white/15';

                return (
                  <div
                    key={item.key}
                    className={`rounded-2xl bg-black/60 border p-3 flex flex-col justify-between gap-2.5 transition-all ${
                      isSelected
                        ? 'border-[#d4af37] ring-1 ring-[#d4af37]/50'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Preview Box */}
                      <div className="relative h-32 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
                        {isImage && item.inR2 ? (
                          <img
                            src={item.url}
                            alt={item.filename}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : isAudio && item.inR2 ? (
                          <div className="flex flex-col items-center gap-2 p-2 w-full">
                            <Music className="w-7 h-7 text-[#d4af37]" />
                            <audio src={item.url} controls className="w-full h-7" />
                          </div>
                        ) : isVideo && item.inR2 ? (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-zinc-500 text-[11px] font-mono-tech">
                            <AlertCircle className="w-6 h-6 text-rose-400" />
                            <span>{item.inR2 ? item.mimeType : 'Missing in R2 Bucket'}</span>
                          </div>
                        )}

                        <label className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/75 border border-white/20 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectR2Key(item.key)}
                            className="accent-[#d4af37] cursor-pointer"
                          />
                          <span className="text-[10px] font-mono-tech text-white">Select</span>
                        </label>

                        <span
                          className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-mono-tech uppercase font-bold border backdrop-blur-md ${statusBadgeClass}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      {/* Metadata */}
                      <div className="space-y-1">
                        <p
                          className="font-syne font-bold text-xs text-white truncate"
                          title={item.filename}
                        >
                          {item.filename}
                        </p>
                        <p
                          className="font-mono-tech text-[10px] text-zinc-400 truncate"
                          title={item.key}
                        >
                          Key: {item.key}
                        </p>
                        <div className="flex items-center justify-between text-[10px] font-mono-tech text-zinc-500">
                          <span>{formatFileSize(item.sizeBytes)}</span>
                          <span>
                            {item.uploadedAt
                              ? new Date(item.uploadedAt).toLocaleDateString()
                              : 'Unknown date'}
                          </span>
                        </div>

                        {item.associatedAlbumName && (
                          <p className="text-[10px] font-mono-tech text-emerald-300 truncate">
                            Album: {item.associatedAlbumName}
                            {item.associatedRecordLabel ? ` • ${item.associatedRecordLabel}` : ''}
                          </p>
                        )}

                        {item.suggestedRecovery && item.status !== 'linked' && (
                          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono-tech text-amber-200">
                            <span className="font-bold uppercase">Suggested:</span>{' '}
                            {item.suggestedRecovery.targetAlbumName} ({item.suggestedRecovery.confidence})
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Item Actions */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10">
                      {item.status !== 'linked' && item.inR2 ? (
                        <button
                          type="button"
                          onClick={() => handleSmartRecoverItems([item])}
                          className="px-2 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                          title="Restore or relink to suggested/manual destination"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Relink</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenManualAssignModal([item])}
                          className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 font-mono-tech text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                          title="Reassign or link to another record"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Assign</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setR2InspectItem(item)}
                        className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono-tech text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                        title="Inspect or download file"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>

                      <button
                        type="button"
                        disabled={!item.canDeletePermanently}
                        onClick={() => setR2DeleteConfirmItems([item])}
                        title={
                          item.canDeletePermanently
                            ? 'Permanently delete from R2'
                            : item.deleteBlockedReason || 'Protected active/30-day recovery file'
                        }
                        className={`px-2 py-1.5 rounded-lg font-mono-tech text-[10px] flex items-center justify-center gap-1 ${
                          item.canDeletePermanently
                            ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 cursor-pointer'
                            : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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

            <div
              role="tablist"
              className="inline-flex items-center gap-1 p-1.5 rounded-full bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 shadow-xs self-start"
            >
              <button
                role="tab"
                aria-selected={directoryVisibilityTab === 'albums'}
                type="button"
                onClick={() => setDirectoryVisibilityTab('albums')}
                className={`px-3.5 py-1 rounded-full font-mono-tech text-[10px] uppercase cursor-pointer transition-all ${
                  directoryVisibilityTab === 'albums'
                    ? 'active-clip bg-[#d4af37] text-black font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                Albums ({hiddenAlbums.length} hidden)
              </button>
              <button
                role="tab"
                aria-selected={directoryVisibilityTab === 'institutions'}
                type="button"
                onClick={() => setDirectoryVisibilityTab('institutions')}
                className={`px-3.5 py-1 rounded-full font-mono-tech text-[10px] uppercase cursor-pointer transition-all ${
                  directoryVisibilityTab === 'institutions'
                    ? 'active-clip bg-[#d4af37] text-black font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
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
                        {album.departmentName} '{String(album.graduationYear).slice(-2)}
                      </p>
                      <p className="text-[10px] font-mono-tech text-zinc-400 truncate">
                        {album.institutionName}
                        {isUnlistedByAdmin ? ' • Unlisted by Class Admin' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleHideAlbum(album.id)}
                      className={`px-2.5 py-1 rounded-lg font-mono-tech text-[10px] uppercase font-bold flex items-center gap-1 shrink-0 cursor-pointer ${
                        isHidden
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/10 text-zinc-300 hover:bg-white/15'
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
              {filteredDirectoryInstitutions.map((inst) => {
                const isHidden = hiddenInstitutions.includes(inst.id);
                return (
                  <div
                    key={inst.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      isHidden
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-black/40 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-syne font-bold text-white truncate">{inst.name}</p>
                        <p className="text-[10px] font-mono-tech text-zinc-400 truncate">
                          {inst.shortCode || inst.institutionType || 'Institution'} • {inst.location || 'Nigeria'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleHideInstitution(inst.id)}
                      className={`px-2.5 py-1 rounded-lg font-mono-tech text-[10px] uppercase font-bold flex items-center gap-1 shrink-0 cursor-pointer ${
                        isHidden
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/10 text-zinc-300 hover:bg-white/15'
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
              className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow"
            >
              Apply Pipeline Settings
            </button>
          </div>
        </div>

        <div className="pt-1 space-y-3">
          <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
            Album Media Compression Size (Default: Standard 1,440 px)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                px: 1280,
                tier: 'Economy',
                label: '1,280 px',
                desc: '720p-class range • Fast mobile loading',
              },
              {
                px: 1440,
                tier: 'Standard (Default)',
                label: '1,440 px',
                desc: 'Your chosen middle size • Optimal clarity & storage',
              },
              {
                px: 1920,
                tier: 'Premium',
                label: '1,920 px',
                desc: 'Full HD archival • High-detail studio portraits',
              },
            ].map((opt) => {
              const isSelected = effectiveCompressionResolution === opt.px;
              return (
                <button
                  key={opt.px}
                  type="button"
                  onClick={() => handleCompressionChange(opt.px)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#d4af37]/15 border-[#d4af37] ring-1 ring-[#d4af37]/40'
                      : 'bg-black/50 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-syne font-bold text-xs sm:text-sm text-white">
                      {opt.tier}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono-tech text-[10px] font-bold ${
                        isSelected
                          ? 'bg-[#d4af37] text-black'
                          : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono-tech text-zinc-400 mt-1">{opt.desc}</p>
                </button>
              );
            })}
          </div>
          <select
            value={effectiveCompressionResolution}
            onChange={(e) => handleCompressionChange(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value={1280}>Economy — 1,280 px (720p-class range)</option>
            <option value={1440}>Standard — 1,440 px (Your chosen middle size • Default)</option>
            <option value={1920}>Premium — 1,920 px</option>
          </select>
          <p className="text-[10px] text-zinc-500 font-mono-tech">
            Downscales oversized images automatically preserving native aspect ratio. Persisted across sessions.
          </p>
        </div>
      </div>

      {/* AMBIENT SOUNDTRACK & PLATFORM DEFAULTS (PLAYS WHENEVER ANY ALBUM IS OPENED) */}
      <div className="p-6 rounded-2xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-[#d4af37]" />
            <div>
              <h3 className="font-syne font-bold text-sm text-white">
                Ambient Soundtrack &amp; Platform Defaults
              </h3>
              <p className="text-zinc-400 text-xs font-body mt-0.5">
                Plays gently across all Class Albums whenever an album is opened. Stored in Cloudflare R2 and automatically cleaned up when replaced or removed.
              </p>
            </div>
          </div>
          {onSavePipeline && (
            <button
              type="button"
              onClick={handleSavePipelineClick}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow shrink-0"
            >
              Save Audio &amp; Defaults
            </button>
          )}
        </div>

        {/* Audio Track */}
        <div className="p-4 rounded-xl bg-black/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          {albumBgMusicUrl ? (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center shrink-0">
                  <Volume2 className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <p className="font-syne font-semibold text-white text-xs truncate">
                    Active Album Background Track
                  </p>
                  <p className="text-[10px] font-mono-tech text-emerald-400">
                    Loaded &amp; Ready for Playback across all Class Albums
                  </p>
                </div>
              </div>

              <audio
                src={albumBgMusicUrl}
                controls
                className="h-9 w-full sm:w-72 accent-[#d4af37]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-zinc-500 font-mono-tech text-xs">
              <Music className="w-5 h-5" />
              <span>No background music active. Class Albums will play silently.</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-black font-tech text-xs uppercase font-bold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Track</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadAlbumBgMusicFile?.(file);
                e.target.value = '';
              }}
            />
          </label>
          {albumBgMusicUrl && (
            <button
              type="button"
              onClick={() => onUpdateAlbumBgMusicUrl?.('')}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Audio</span>
            </button>
          )}
        </div>

        {/* Platform Identity & Support */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/10">
          <div>
            <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
              Platform Brand Title
            </label>
            <input
              type="text"
              value={platformTitle}
              onChange={(e) => onUpdatePlatformTitle?.(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
              Support Email
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => onUpdateSupportEmail?.(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
              Archival Cloud Guarantee
            </label>
            <div className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs flex items-center justify-between">
              <span>Perpetual Storage</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Verified
              </span>
            </div>
          </div>
        </div>

        {/* Host-Only KOHOT Footer Social Links (Albums, Legacy Wall & Website Footers) */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#d4af37]" />
              <div>
                <h4 className="font-syne font-bold text-xs sm:text-sm text-white">
                  KOHOT Footer Social Links (Host Only)
                </h4>
                <p className="text-zinc-400 text-[11px] font-body">
                  Displayed under <strong className="text-white">KOHOT • Preserve the memories.</strong> in all Album, Legacy Wall, and Website footers. When left blank, no social icons are shown.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {kohotSocialsSaved && (
                <span className="text-[11px] font-mono-tech text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </span>
              )}
              <button
                id="save-kohot-footer-socials-btn"
                type="button"
                onClick={handleSaveKohotSocials}
                className="px-3.5 py-1.5 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-black font-syne font-bold text-xs cursor-pointer transition-colors"
              >
                Save KOHOT Socials
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                Instagram URL / @Handle
              </label>
              <input
                type="text"
                value={kohotSocials.instagram || ''}
                onChange={(e) => setKohotSocials({ ...kohotSocials, instagram: e.target.value })}
                placeholder="@kohot or https://..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                X (Twitter) URL / @Handle
              </label>
              <input
                type="text"
                value={kohotSocials.twitter || ''}
                onChange={(e) => setKohotSocials({ ...kohotSocials, twitter: e.target.value })}
                placeholder="@kohot or https://..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                YouTube Channel URL
              </label>
              <input
                type="text"
                value={kohotSocials.youtube || ''}
                onChange={(e) => setKohotSocials({ ...kohotSocials, youtube: e.target.value })}
                placeholder="https://youtube.com/@..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                LinkedIn URL
              </label>
              <input
                type="text"
                value={kohotSocials.linkedin || ''}
                onChange={(e) => setKohotSocials({ ...kohotSocials, linkedin: e.target.value })}
                placeholder="https://linkedin.com/company/..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div>
              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                Website URL
              </label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={kohotSocials.website || ''}
                  onChange={(e) => setKohotSocials({ ...kohotSocials, website: e.target.value })}
                  placeholder="https://kohot.app"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs focus:outline-none focus:border-[#d4af37]"
                />
              </div>
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
            placeholder="Search albums, IDs, departments, admins..."
            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-body transition-colors"
          />
        </div>

        <div
          role="tablist"
          className="inline-flex items-center gap-1 p-1.5 rounded-full bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 shadow-xs w-full sm:w-auto overflow-x-auto no-scrollbar"
        >
          {(['all', 'active', 'pending', 'deleted'] as const).map((filter) => (
            <button
              key={filter}
              role="tab"
              aria-selected={statusFilter === filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                statusFilter === filter
                  ? 'active-clip bg-[#d4af37] text-black font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
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
                    loading="lazy"
                    decoding="async"
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
                      loading="lazy"
                      decoding="async"
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
          R2 FILE INSPECT / DOWNLOAD MODAL
         ===================================================================== */}
      {r2InspectItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-2xl rounded-3xl bg-[#10121a] border border-white/15 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-syne font-bold text-base text-white truncate">
                  {r2InspectItem.filename}
                </h3>
                <p className="text-[11px] font-mono-tech text-zinc-400">{r2InspectItem.key}</p>
              </div>
              <button
                type="button"
                onClick={() => setR2InspectItem(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-black/60 border border-white/10 p-4 flex items-center justify-center max-h-80 overflow-hidden">
              {r2InspectItem.mimeType.startsWith('image/') && r2InspectItem.inR2 ? (
                <img
                  src={r2InspectItem.url}
                  alt={r2InspectItem.filename}
                  loading="lazy"
                  decoding="async"
                  className="max-h-72 object-contain rounded-xl"
                />
              ) : r2InspectItem.mimeType.startsWith('audio/') && r2InspectItem.inR2 ? (
                <audio src={r2InspectItem.url} controls className="w-full" />
              ) : r2InspectItem.mimeType.startsWith('video/') && r2InspectItem.inR2 ? (
                <video src={r2InspectItem.url} controls className="max-h-72 rounded-xl" />
              ) : (
                <p className="text-xs font-mono-tech text-zinc-400">
                  Preview unavailable ({r2InspectItem.mimeType})
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech bg-black/40 p-3.5 rounded-2xl border border-white/10">
              <p className="text-zinc-400">
                Status: <strong className="text-white uppercase">{r2InspectItem.status}</strong>
              </p>
              <p className="text-zinc-400">
                Size: <strong className="text-white">{formatFileSize(r2InspectItem.sizeBytes)}</strong>
              </p>
              <p className="text-zinc-400">
                MIME Type: <strong className="text-white">{r2InspectItem.mimeType}</strong>
              </p>
              <p className="text-zinc-400">
                Uploaded:{' '}
                <strong className="text-white">
                  {r2InspectItem.uploadedAt
                    ? new Date(r2InspectItem.uploadedAt).toLocaleString()
                    : 'Unknown'}
                </strong>
              </p>
              <p className="text-zinc-400 col-span-2">
                Associated Album:{' '}
                <strong className="text-emerald-300">
                  {r2InspectItem.associatedAlbumName || 'None (Orphaned / Unlinked)'}
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
              {r2InspectItem.inR2 && (
                <a
                  href={r2InspectItem.url}
                  download={r2InspectItem.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-full bg-[#d4af37] hover:bg-[#e3be42] text-black font-syne font-bold text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Original</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  const item = r2InspectItem;
                  setR2InspectItem(null);
                  handleOpenManualAssignModal([item]);
                }}
                className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-syne font-bold text-xs cursor-pointer"
              >
                Relink / Assign to Album
              </button>
              <button
                type="button"
                onClick={() => setR2InspectItem(null)}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-zinc-300 font-mono-tech text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MANUAL R2 MEDIA ASSIGNMENT / RELINK MODAL
         ===================================================================== */}
      {r2ManualAssignItems && r2ManualAssignItems.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-lg rounded-3xl bg-[#10121a] border border-white/15 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-syne font-bold text-base text-white">
                  Assign / Relink R2 Media ({r2ManualAssignItems.length} file
                  {r2ManualAssignItems.length > 1 ? 's' : ''})
                </h3>
                <p className="text-[11px] font-mono-tech text-zinc-400">
                  Links existing R2 storage keys directly without duplicating binary files.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setR2ManualAssignItems(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Target Class Album
                </label>
                <select
                  value={manualTargetAlbumId}
                  onChange={(e) => setManualTargetAlbumId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs"
                >
                  <option value="">Select destination album...</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.institutionName} • {s.departmentName} '{String(s.graduationYear).slice(-2)} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Destination Record Type
                </label>
                <select
                  value={manualTargetRecordType}
                  onChange={(e) =>
                    setManualTargetRecordType(
                      e.target.value as 'moment' | 'profile' | 'banner' | 'footer' | 'logo'
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs"
                >
                  <option value="moment">Moments Photo Category</option>
                  <option value="profile">Graduate Profile Portrait</option>
                  <option value="banner">Album Hero Banner</option>
                  <option value="footer">Album Footer Banner</option>
                  <option value="logo">Institution Emblem / Logo</option>
                </select>
              </div>

              {manualTargetRecordType === 'moment' && (
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                    Moments Category Title
                  </label>
                  <input
                    type="text"
                    value={manualTargetCategoryTitle}
                    onChange={(e) => setManualTargetCategoryTitle(e.target.value)}
                    placeholder="e.g. Recovered R2 Archive Photos"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs"
                  />
                </div>
              )}

              {manualTargetRecordType === 'profile' && (
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                    Graduate Profile (Optional — leave blank to create recovered profile)
                  </label>
                  <select
                    value={manualTargetRecordId}
                    onChange={(e) => setManualTargetRecordId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono-tech text-xs"
                  >
                    <option value="">Auto-match or create recovered profile</option>
                    {(sets.find((s) => s.id === manualTargetAlbumId)?.students || []).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setR2ManualAssignItems(null)}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-zinc-300 font-mono-tech text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!manualTargetAlbumId || isRecoveringR2Batch}
                onClick={handleConfirmManualAssign}
                className="px-5 py-2 rounded-full bg-[#d4af37] hover:bg-[#e3be42] text-black font-syne font-bold text-xs cursor-pointer"
              >
                {isRecoveringR2Batch ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PERMANENT R2 FILE DELETION CONFIRMATION MODAL
         ===================================================================== */}
      {r2DeleteConfirmItems && r2DeleteConfirmItems.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-[#14161f] border border-red-500/40 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-base text-white">
                    Permanently Delete R2 Media
                  </h3>
                  <p className="text-[11px] font-mono-tech text-amber-400">
                    Active &amp; 30-Day Recovery files are automatically protected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setR2DeleteConfirmItems(null)}
                className="p-1 rounded-full hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300 font-body">
              <p>
                You are requesting permanent Cloudflare R2 deletion for{' '}
                <strong className="text-white">{r2DeleteConfirmItems.length} file(s)</strong>.
              </p>
              <div className="max-h-36 overflow-y-auto p-3 rounded-xl bg-black/50 border border-white/10 space-y-1 font-mono-tech text-[10px]">
                {r2DeleteConfirmItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <span className="truncate text-zinc-300">{item.key}</span>
                    <span
                      className={
                        item.canDeletePermanently ? 'text-red-300 shrink-0' : 'text-emerald-300 shrink-0'
                      }
                    >
                      {item.canDeletePermanently ? 'Will Delete' : 'Protected'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setR2DeleteConfirmItems(null)}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-zinc-300 font-mono-tech text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingR2Batch}
                onClick={handleConfirmPermanentDeleteR2}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-syne font-bold text-xs cursor-pointer"
              >
                {isDeletingR2Batch ? 'Deleting...' : 'Confirm Permanent Delete'}
              </button>
            </div>
          </div>
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
                      ? 'bg-[#d4af37] text-black font-bold'
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
                      ? 'bg-[#d4af37] text-black font-bold'
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
                            loading="lazy"
                            decoding="async"
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
                                loading="lazy"
                                decoding="async"
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
