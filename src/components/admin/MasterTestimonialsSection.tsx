import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Check,
  X,
  Trash2,
  Quote,
  Filter,
  Search,
  Building2,
  Eye,
  EyeOff,
  Clock,
  XCircle,
  Plus,
  Edit3,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Sparkles,
  Upload,
  Camera,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import { ClassSet, TestimonialRecord, UniversityDirectoryItem } from '../../types';
import {
  getStoredTestimonials,
  saveStoredTestimonials,
  getStoredSets,
  getStoredUniversities,
} from '../../data/initialData';
import {
  fetchTestimonialsFromD1,
  submitTestimonialToD1,
  updateTestimonialInD1,
  deleteTestimonialInD1,
  uploadMediaToR2,
} from '../../utils/apiClient';
import { compressImageToWebP } from '../../utils/imageCompressor';
import { GlazedImage } from '../common/GlazedImage';

interface MasterTestimonialsSectionProps {
  onShowToast?: (msg: string) => void;
  contentOverride?: any;
  onUpdateContentOverride?: (partial: any) => void;
  sets?: ClassSet[];
  universities?: UniversityDirectoryItem[];
}

interface AlbumAdminProfileOption {
  setId: string;
  adminName: string;
  adminEmail: string;
  role: string;
  universityId: string;
  universityName: string;
  departmentId: string;
  departmentName: string;
  graduationYear: number;
  classSetName: string;
  photoUrl: string;
  existingQuote: string;
}

export const MasterTestimonialsSection: React.FC<MasterTestimonialsSectionProps> = ({
  onShowToast,
  sets,
  universities,
}) => {
  const availableSets = useMemo(() => (sets && sets.length > 0 ? sets : getStoredSets()), [sets]);
  const availableUniversities = useMemo(
    () => (universities && universities.length > 0 ? universities : getStoredUniversities()),
    [universities]
  );

  // Build Album Admin directory from existing Class Albums so details are automatically captured
  const albumAdminOptions = useMemo<AlbumAdminProfileOption[]>(() => {
    return availableSets.map((set) => {
      const uni = availableUniversities.find((u) => u.id === set.universityId);
      const dept = uni?.departments.find((d) => d.id === set.departmentId);
      const adminName = (set.classRepName || 'Class Album Admin').trim();
      const repLower = adminName.toLowerCase();

      // Match the Album Admin's student profile photo from the album roster
      const matchingStudent =
        set.students?.find(
          (st) =>
            st.fullName?.trim().toLowerCase() === repLower ||
            (set.classRepEmail &&
              st.email?.trim().toLowerCase() === set.classRepEmail.trim().toLowerCase()) ||
            st.position?.toLowerCase().includes('representative') ||
            st.position?.toLowerCase().includes('president')
        ) || set.students?.[0];

      const setAny = set as any;
      return {
        setId: set.id,
        adminName,
        adminEmail: set.classRepEmail || matchingStudent?.email || '',
        role: 'Class Album Admin',
        universityId: set.universityId,
        universityName: uni?.name || set.institutionName || 'University',
        departmentId: set.departmentId,
        departmentName: dept?.name || set.departmentName || 'Department',
        graduationYear: Number(set.graduationYear) || new Date().getFullYear(),
        classSetName: set.classSetName || `Class of ${set.graduationYear}`,
        photoUrl: matchingStudent?.photoUrl || set.bannerImageUrl || '',
        existingQuote: String(setAny.testimonialText || setAny.publishDraft?.testimonialText || '').trim(),
      };
    });
  }, [availableSets, availableUniversities]);

  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit modal state (Album Admin details auto-captured & editable, actual file upload for portrait)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestimonialRecord | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [formAuthorName, setFormAuthorName] = useState('');
  const [formRole, setFormRole] = useState('Class Album Admin');
  const [formDepartment, setFormDepartment] = useState('');
  const [formInstitution, setFormInstitution] = useState('');
  const [formGraduationYear, setFormGraduationYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [formQuote, setFormQuote] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Delete confirmation modal state
  const [deletingItem, setDeletingItem] = useState<TestimonialRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortTestimonials = (items: TestimonialRecord[]): TestimonialRecord[] => {
    return [...items].sort((a, b) => {
      const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999;
      const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime();
    });
  };

  // Enrich testimonials with Album Admin details if setId or authorName matches an album admin
  const enrichWithAlbumAdminDetails = (items: TestimonialRecord[]): TestimonialRecord[] => {
    const synced = [...items];

    // 1. Enrich existing items with missing portraits or university details from matching Album Admin
    const enriched = synced.map((item) => {
      const matchedAdmin = albumAdminOptions.find(
        (opt) =>
          (item.setId && opt.setId === item.setId) ||
          (item.authorName || item.fullName || '').trim().toLowerCase() ===
            opt.adminName.toLowerCase()
      );
      if (!matchedAdmin) return item;
      return {
        ...item,
        photoUrl: item.photoUrl || item.avatarUrl || matchedAdmin.photoUrl,
        avatarUrl: item.avatarUrl || item.photoUrl || matchedAdmin.photoUrl,
        universityName:
          item.universityName && item.universityName !== 'Sample University'
            ? item.universityName
            : matchedAdmin.universityName,
        institutionName:
          item.institutionName && item.institutionName !== 'Sample University'
            ? item.institutionName
            : matchedAdmin.universityName,
        departmentName: item.departmentName || matchedAdmin.departmentName,
        graduationYear: item.graduationYear || matchedAdmin.graduationYear,
        role: item.role || item.authorRole || 'Class Album Admin',
        authorRole: item.authorRole || item.role || 'Class Album Admin',
      };
    });

    // 2. Auto-capture any published album testimonials from sets that aren't in the list yet
    for (const opt of albumAdminOptions) {
      if (!opt.existingQuote) continue;
      const alreadyExists = enriched.some(
        (t) =>
          t.setId === opt.setId ||
          (t.authorName || t.fullName || '').trim().toLowerCase() === opt.adminName.toLowerCase()
      );
      if (!alreadyExists) {
        enriched.push({
          id: `album-admin-test-${opt.setId}`,
          setId: opt.setId,
          name: opt.adminName,
          fullName: opt.adminName,
          authorName: opt.adminName,
          email: opt.adminEmail,
          role: 'Class Album Admin',
          authorRole: 'Class Album Admin',
          universityId: opt.universityId,
          university: opt.universityName,
          universityName: opt.universityName,
          institutionName: opt.universityName,
          departmentId: opt.departmentId,
          department: opt.departmentName,
          departmentName: opt.departmentName,
          classYear: opt.graduationYear,
          graduationYear: opt.graduationYear,
          classSetName: opt.classSetName,
          photoUrl: opt.photoUrl,
          avatarUrl: opt.photoUrl,
          testimonialText: opt.existingQuote,
          shortQuote: opt.existingQuote,
          quote: opt.existingQuote,
          publicationPermission: 'public',
          permissionGranted: true,
          status: 'Approved',
          reviewStatus: 'approved',
          isVisible: true,
          isDemo: false,
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          displayOrder: enriched.length + 1,
        });
      }
    }

    return sortTestimonials(enriched);
  };

  useEffect(() => {
    const localItems = enrichWithAlbumAdminDetails(getStoredTestimonials());
    setTestimonials(localItems);

    fetchTestimonialsFromD1()
      .then((res) => {
        if (res && res.success && Array.isArray(res.testimonials) && res.testimonials.length > 0) {
          const enriched = enrichWithAlbumAdminDetails(res.testimonials);
          setTestimonials(enriched);
          saveStoredTestimonials(enriched);
        }
      })
      .catch(() => {});
  }, [albumAdminOptions]);

  const persistTestimonials = (updated: TestimonialRecord[]) => {
    const sorted = sortTestimonials(updated);
    setTestimonials(sorted);
    saveStoredTestimonials(sorted);
  };

  const handleStatusChange = async (id: string, newStatus: 'Pending' | 'Approved' | 'Rejected') => {
    const reviewStatus = newStatus.toLowerCase() as 'pending' | 'approved' | 'rejected';
    const updated = testimonials.map((t) => {
      if (t.id === id) {
        return {
          ...t,
          status: newStatus,
          reviewStatus,
        };
      }
      return t;
    });
    persistTestimonials(updated);
    await updateTestimonialInD1(id, { status: newStatus, reviewStatus });
    onShowToast?.(`Testimonial ${newStatus.toLowerCase()}.`);
  };

  const handleToggleVisible = async (item: TestimonialRecord) => {
    const nextVisible = item.isVisible === false ? true : false;
    const updated = testimonials.map((t) =>
      t.id === item.id ? { ...t, isVisible: nextVisible } : t
    );
    persistTestimonials(updated);
    await updateTestimonialInD1(item.id, { isVisible: nextVisible });
    onShowToast?.(
      nextVisible ? 'Testimonial shown on website.' : 'Testimonial hidden from website.'
    );
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const list = [...filteredTestimonials];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const currentItem = list[index];
    const swapItem = list[targetIndex];

    const newOrderCurrent = targetIndex + 1;
    const newOrderSwap = index + 1;

    const updated = testimonials.map((t) => {
      if (t.id === currentItem.id) return { ...t, displayOrder: newOrderCurrent };
      if (t.id === swapItem.id) return { ...t, displayOrder: newOrderSwap };
      return t;
    });

    persistTestimonials(updated);
    await Promise.all([
      updateTestimonialInD1(currentItem.id, { displayOrder: newOrderCurrent }),
      updateTestimonialInD1(swapItem.id, { displayOrder: newOrderSwap }),
    ]);
  };

  const applyAlbumAdminProfile = (setId: string) => {
    setSelectedAlbumId(setId);
    const adminOpt = albumAdminOptions.find((o) => o.setId === setId);
    if (!adminOpt) return;
    setFormAuthorName(adminOpt.adminName);
    setFormRole(adminOpt.role || 'Class Album Admin');
    setFormDepartment(adminOpt.departmentName);
    setFormInstitution(adminOpt.universityName);
    setFormGraduationYear(String(adminOpt.graduationYear));
    if (adminOpt.photoUrl) {
      setFormPhotoUrl(adminOpt.photoUrl);
    }
    if (!formQuote.trim() && adminOpt.existingQuote) {
      setFormQuote(adminOpt.existingQuote);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    const defaultAdmin = albumAdminOptions[0];
    if (defaultAdmin) {
      setSelectedAlbumId(defaultAdmin.setId);
      setFormAuthorName(defaultAdmin.adminName);
      setFormRole('Class Album Admin');
      setFormDepartment(defaultAdmin.departmentName);
      setFormInstitution(defaultAdmin.universityName);
      setFormGraduationYear(String(defaultAdmin.graduationYear));
      setFormPhotoUrl(defaultAdmin.photoUrl || '');
      setFormQuote('');
    } else {
      setSelectedAlbumId('');
      setFormAuthorName('');
      setFormRole('Class Album Admin');
      setFormDepartment('');
      setFormInstitution('');
      setFormGraduationYear(new Date().getFullYear().toString());
      setFormPhotoUrl('');
      setFormQuote('');
    }
    setIsEditorOpen(true);
  };

  const openEditModal = (item: TestimonialRecord) => {
    setEditingItem(item);
    setSelectedAlbumId(item.setId || '');
    setFormAuthorName(item.authorName || item.fullName || item.name || '');
    setFormRole(item.role || item.authorRole || 'Class Album Admin');
    setFormDepartment(item.departmentName || item.department || '');
    setFormInstitution(item.universityName || item.institutionName || item.university || '');
    setFormGraduationYear(
      String(item.graduationYear || item.classYear || new Date().getFullYear())
    );
    setFormQuote(item.testimonialText || item.shortQuote || item.quote || '');
    setFormPhotoUrl(item.photoUrl || item.avatarUrl || '');
    setIsEditorOpen(true);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImageToWebP(file, 600, 0.86);
      let finalUrl = compressed.dataUrl;
      try {
        const uploadedRes = await uploadMediaToR2(compressed.dataUrl, { category: 'testimonials' });
        if (uploadedRes?.success && uploadedRes.url) {
          finalUrl = uploadedRes.url;
        }
      } catch {
        // Keep compressed dataUrl if offline or local
      }
      setFormPhotoUrl(finalUrl);
      onShowToast?.('Portrait uploaded.');
    } catch {
      onShowToast?.('Could not process image file.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAuthorName.trim() || !formQuote.trim()) return;
    setIsSaving(true);
    try {
      const gradYearNum = parseInt(formGraduationYear, 10) || new Date().getFullYear();
      const cleanPhoto = formPhotoUrl.trim() || undefined;

      if (editingItem) {
        const patch: Partial<TestimonialRecord> = {
          setId: selectedAlbumId || editingItem.setId,
          name: formAuthorName.trim(),
          authorName: formAuthorName.trim(),
          fullName: formAuthorName.trim(),
          role: formRole.trim() || 'Class Album Admin',
          authorRole: formRole.trim() || 'Class Album Admin',
          department: formDepartment.trim() || 'Department',
          departmentName: formDepartment.trim() || 'Department',
          university: formInstitution.trim() || editingItem.universityName || '',
          universityName: formInstitution.trim() || editingItem.universityName || '',
          institutionName: formInstitution.trim() || editingItem.institutionName || '',
          graduationYear: gradYearNum,
          classYear: gradYearNum,
          testimonialText: formQuote.trim(),
          shortQuote: formQuote.trim(),
          quote: formQuote.trim(),
          photoUrl: cleanPhoto,
          avatarUrl: cleanPhoto,
        };
        const updated = testimonials.map((t) =>
          t.id === editingItem.id ? { ...t, ...patch } : t
        );
        persistTestimonials(updated);
        await updateTestimonialInD1(editingItem.id, patch);
        onShowToast?.('Album Admin testimonial updated.');
      } else {
        const nextOrder = testimonials.length + 1;
        const newRecord: TestimonialRecord = {
          id: `test-${Date.now()}`,
          setId: selectedAlbumId || undefined,
          name: formAuthorName.trim(),
          fullName: formAuthorName.trim(),
          authorName: formAuthorName.trim(),
          role: formRole.trim() || 'Class Album Admin',
          authorRole: formRole.trim() || 'Class Album Admin',
          university: formInstitution.trim() || '',
          universityName: formInstitution.trim() || '',
          institutionName: formInstitution.trim() || '',
          department: formDepartment.trim() || 'Department',
          departmentName: formDepartment.trim() || 'Department',
          graduationYear: gradYearNum,
          classYear: gradYearNum,
          classSetName: `Class of ${gradYearNum}`,
          rating: 5,
          shortQuote: formQuote.trim(),
          testimonialText: formQuote.trim(),
          quote: formQuote.trim(),
          photoUrl: cleanPhoto,
          avatarUrl: cleanPhoto,
          permissionGranted: true,
          publicationPermission: 'public',
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          status: 'Approved',
          reviewStatus: 'approved',
          isVisible: true,
          isDemo: false,
          displayOrder: nextOrder,
        };
        const updated = [...testimonials, newRecord];
        persistTestimonials(updated);
        await submitTestimonialToD1(newRecord);
        onShowToast?.('Album Admin testimonial added.');
      }
      setIsEditorOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const updated = testimonials.filter((t) => t.id !== deletingItem.id);
      persistTestimonials(updated);
      await deleteTestimonialInD1(deletingItem.id);
      onShowToast?.('Testimonial deleted.');
      setDeletingItem(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTestimonials = testimonials.filter((t) => {
    const statusLabel =
      t.status ||
      (t.reviewStatus
        ? t.reviewStatus.charAt(0).toUpperCase() + t.reviewStatus.slice(1)
        : 'Approved');
    const matchesStatus =
      filterStatus === 'All' || statusLabel.toLowerCase() === filterStatus.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (t.fullName || t.authorName || t.name || '').toLowerCase().includes(q) ||
      (t.universityName || t.institutionName || t.university || '').toLowerCase().includes(q) ||
      (t.departmentName || t.department || '').toLowerCase().includes(q) ||
      (t.role || t.authorRole || '').toLowerCase().includes(q) ||
      (t.shortQuote || t.testimonialText || t.quote || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: testimonials.length,
    visible: testimonials.filter(
      (t) =>
        t.isVisible !== false &&
        (t.status === 'Approved' || t.reviewStatus === 'approved' || !t.status)
    ).length,
    pending: testimonials.filter(
      (t) => t.status === 'Pending' || t.reviewStatus === 'pending'
    ).length,
    capturedAdmins: albumAdminOptions.length,
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Card matching Host Dashboard UI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#18181b] border border-white/12 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0 mt-0.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-syne font-bold text-base sm:text-lg text-white">
                Album Admin Testimonials
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#e6c158] font-mono-tech text-[10px] uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> Auto-Captured from Album Admins
              </span>
            </div>
            <p className="font-body text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              Testimonials are captured from Class Album Admins along with their profile photo, university, department, and class year. You can edit any detail or upload a new portrait photo.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-slate-950 font-mono-tech text-xs uppercase tracking-wider font-bold transition-all cursor-pointer shrink-0 shadow-md"
        >
          <Plus className="w-4 h-4" />
          Add Testimonial
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#18181b] border border-white/10 rounded-2xl p-4">
          <div className="text-zinc-400 font-mono-tech text-[10px] uppercase tracking-wider mb-1">
            Total Testimonials
          </div>
          <div className="text-2xl font-syne font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-[#18181b] border border-emerald-500/25 rounded-2xl p-4">
          <div className="text-emerald-400/90 font-mono-tech text-[10px] uppercase tracking-wider mb-1">
            Live on Website
          </div>
          <div className="text-2xl font-syne font-bold text-emerald-400">{stats.visible}</div>
        </div>
        <div className="bg-[#18181b] border border-amber-500/25 rounded-2xl p-4">
          <div className="text-amber-400/90 font-mono-tech text-[10px] uppercase tracking-wider mb-1">
            Pending Review
          </div>
          <div className="text-2xl font-syne font-bold text-amber-400">{stats.pending}</div>
        </div>
        <div className="bg-[#18181b] border border-[#d4af37]/25 rounded-2xl p-4">
          <div className="text-[#e6c158] font-mono-tech text-[10px] uppercase tracking-wider mb-1">
            Connected Album Admins
          </div>
          <div className="text-2xl font-syne font-bold text-[#f3d87d]">{stats.capturedAdmins}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-[#18181b] border border-white/10 p-3.5 rounded-2xl">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Album Admin, university, department, or quote..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101014] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#d4af37]/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-zinc-500 mr-1 shrink-0" />
          {(['All', 'Approved', 'Pending', 'Rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 rounded-full font-mono-tech text-[11px] uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                filterStatus === status
                  ? 'bg-[#d4af37] text-slate-950 font-bold'
                  : 'bg-[#101014] text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Testimonials Cards Grid matching Website Luxury Card Design */}
      {filteredTestimonials.length === 0 ? (
        <div className="bg-[#18181b] border border-white/10 rounded-2xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-zinc-600 mx-auto mb-3 opacity-60" />
          <h3 className="font-syne font-bold text-base text-white mb-1">No testimonials found</h3>
          <p className="text-zinc-400 text-xs max-w-md mx-auto">
            {searchQuery || filterStatus !== 'All'
              ? 'No testimonials match your current filters.'
              : 'No testimonials available yet. Click "Add Testimonial" to capture one from an Album Admin.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredTestimonials.map((t, index) => {
            const isVisible = t.isVisible !== false;
            const author = t.authorName || t.fullName || t.name || 'Class Album Admin';
            const role = t.role || t.authorRole || 'Class Album Admin';
            const department = t.departmentName || t.department || '';
            const institution =
              t.universityName || t.institutionName || t.university || '';
            const gradYear = t.graduationYear || t.classYear || '';
            const quote = t.testimonialText || t.shortQuote || t.quote || '';
            const avatar = t.photoUrl || t.avatarUrl || '';
            const statusLabel =
              t.status ||
              (t.reviewStatus
                ? t.reviewStatus.charAt(0).toUpperCase() + t.reviewStatus.slice(1)
                : 'Approved');

            return (
              <div
                key={t.id}
                className={`group relative rounded-2xl p-5 sm:p-6 bg-[#18181b] border transition-all duration-300 flex flex-col justify-between ${
                  !isVisible
                    ? 'border-white/[0.05] opacity-60'
                    : statusLabel === 'Pending'
                    ? 'border-amber-500/40 shadow-[0_12px_32px_-12px_rgba(245,158,11,0.18)]'
                    : 'border-white/12 hover:border-[#d4af37]/40 shadow-[0_16px_40px_-15px_rgba(0,0,0,0.65)]'
                }`}
              >
                <div>
                  {/* Top Row: Quote Badge, Role Pill & Status */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/25 flex items-center justify-center text-[#d4af37]">
                        <Quote className="w-4 h-4" />
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono-tech uppercase tracking-wider border bg-[#d4af37]/10 border-[#d4af37]/25 text-[#e6c158]">
                        {role}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {statusLabel === 'Pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono-tech text-[10px] uppercase tracking-wider">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {statusLabel === 'Rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-mono-tech text-[10px] uppercase tracking-wider">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                      <span className="font-mono-tech text-[10px] text-zinc-500">
                        #{index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Quote Content */}
                  <p className="font-body text-sm sm:text-[15px] leading-relaxed text-zinc-200 mb-5">
                    &ldquo;{quote}&rdquo;
                  </p>
                </div>

                <div>
                  {/* Album Admin Identity Footer */}
                  <div className="pt-4 border-t border-white/10 flex items-center gap-3.5 mb-4">
                    <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-[#d4af37]/40 bg-zinc-900 flex items-center justify-center">
                      {avatar ? (
                        <GlazedImage
                          src={avatar}
                          alt={author}
                          className="w-full h-full object-cover"
                          containerClassName="w-full h-full"
                        />
                      ) : (
                        <span className="font-syne font-bold text-xs text-[#e6c158]">
                          {author
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-syne font-bold text-sm text-white truncate">
                        {author}
                      </h4>
                      <p className="font-body text-xs text-zinc-400 truncate mt-0.5">
                        {[
                          department,
                          institution && institution !== 'Sample University' ? institution : '',
                          gradYear ? `Class of ${gradYear}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>

                  {/* Action Controls Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                      {/* Show / Hide Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleVisible(t)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono-tech text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
                          isVisible
                            ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-white/[0.04] text-zinc-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {isVisible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        {isVisible ? 'Live on Site' : 'Hidden'}
                      </button>

                      {/* Reorder Up/Down */}
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-[#101014] overflow-hidden">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveOrder(index, 'up')}
                          className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                          title="Move earlier"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === filteredTestimonials.length - 1}
                          onClick={() => handleMoveOrder(index, 'down')}
                          className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-l border-white/10"
                          title="Move later"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {statusLabel === 'Pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(t.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-mono-tech text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(t.id, 'Rejected')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-mono-tech text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border border-white/10 font-mono-tech text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingItem(t)}
                        className="inline-flex items-center gap-1 p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
                        title="Delete testimonial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal with Automatic Album Admin Capture & Direct Image Upload */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#18181b] border border-white/15 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div>
                <h4 className="font-syne font-bold text-base sm:text-lg text-white">
                  {editingItem ? 'Edit Album Admin Testimonial' : 'Add Album Admin Testimonial'}
                </h4>
                <p className="font-body text-xs text-zinc-400 mt-0.5">
                  Details are automatically captured from the Album Admin profile and remain editable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditor} className="space-y-4">
              {/* Auto-Capture Selector from Registered Class Album Admins */}
              {albumAdminOptions.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#101014] border border-[#d4af37]/30 space-y-2">
                  <label className="flex items-center gap-1.5 font-mono-tech text-[10px] uppercase tracking-wider text-[#e6c158]">
                    <UserCheck className="w-3.5 h-3.5" />
                    Auto-Capture Details from Class Album Admin
                  </label>
                  <select
                    value={selectedAlbumId}
                    onChange={(e) => applyAlbumAdminProfile(e.target.value)}
                    className="w-full bg-[#18181b] border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="">— Select an Album Admin to auto-fill details —</option>
                    {albumAdminOptions.map((opt) => (
                      <option key={opt.setId} value={opt.setId}>
                        {opt.adminName} · {opt.universityName} ({opt.departmentName}, Class of{' '}
                        {opt.graduationYear})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Portrait Image Upload (Actual File Upload, never a URL text box) */}
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#101014] border border-white/10">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#d4af37]/40 bg-zinc-900 shrink-0 flex items-center justify-center">
                  {formPhotoUrl ? (
                    <GlazedImage
                      src={formPhotoUrl}
                      alt={formAuthorName || 'Album Admin'}
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full"
                    />
                  ) : (
                    <Camera className="w-6 h-6 text-zinc-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Album Admin Portrait
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#d4af37]/15 hover:bg-[#d4af37]/25 text-[#f3d87d] border border-[#d4af37]/35 font-mono-tech text-[10px] uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isUploadingPhoto
                        ? 'Uploading...'
                        : formPhotoUrl
                        ? 'Change Portrait Photo'
                        : 'Upload Portrait Photo'}
                    </button>
                    {formPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormPhotoUrl('')}
                        className="px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Automatically captured from the Album Admin’s profile or upload a portrait directly from device.
                  </p>
                </div>
              </div>

              {/* Editable Captured Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Album Admin Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAuthorName}
                    onChange={(e) => setFormAuthorName(e.target.value)}
                    placeholder="e.g. Chiemeka Anthony Eze"
                    className="w-full bg-[#101014] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Role / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="Class Album Admin"
                    className="w-full bg-[#101014] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Institution / University *
                  </label>
                  <input
                    type="text"
                    required
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    placeholder="e.g. Obafemi Awolowo University (OAU)"
                    className="w-full bg-[#101014] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Department of Public Law"
                    className="w-full bg-[#101014] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Class Year
                  </label>
                  <input
                    type="number"
                    min={1980}
                    max={2035}
                    value={formGraduationYear}
                    onChange={(e) => setFormGraduationYear(e.target.value)}
                    placeholder="2026"
                    className="w-full bg-[#101014] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  Testimonial Quote *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formQuote}
                  onChange={(e) => setFormQuote(e.target.value)}
                  placeholder="Share the Album Admin's experience curating their graduating class album..."
                  className="w-full bg-[#101014] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingPhoto}
                  className="px-5 py-2 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-slate-950 font-mono-tech text-xs uppercase tracking-wider font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save Testimonial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-syne font-bold text-base text-white">
                  Delete this testimonial?
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  This will remove the testimonial from the website and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#101014] border border-white/10 text-xs text-zinc-300 italic">
              &ldquo;{deletingItem.testimonialText || deletingItem.shortQuote}&rdquo; —{' '}
              {deletingItem.authorName || deletingItem.fullName}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white font-mono-tech text-xs uppercase tracking-wider font-bold cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
