import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Check,
  X,
  Trash2,
  Star,
  Filter,
  Search,
  Building2,
  User,
  Calendar,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Edit3,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from 'lucide-react';
import { TestimonialRecord } from '../../types';
import {
  getStoredTestimonials,
  saveStoredTestimonials
} from '../../data/initialData';
import {
  fetchTestimonialsFromD1,
  submitTestimonialToD1,
  updateTestimonialInD1,
  deleteTestimonialInD1
} from '../../utils/apiClient';

interface MasterTestimonialsSectionProps {
  onShowToast?: (msg: string) => void;
  contentOverride?: any;
  onUpdateContentOverride?: (partial: any) => void;
}

export const MasterTestimonialsSection: React.FC<MasterTestimonialsSectionProps> = ({ onShowToast }) => {
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestimonialRecord | null>(null);
  const [formAuthorName, setFormAuthorName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formInstitution, setFormInstitution] = useState('');
  const [formQuote, setFormQuote] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation modal state
  const [deletingItem, setDeletingItem] = useState<TestimonialRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortTestimonials = (items: TestimonialRecord[]): TestimonialRecord[] => {
    return [...items].sort((a, b) => {
      const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999;
      const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
    });
  };

  useEffect(() => {
    const localItems = getStoredTestimonials();
    setTestimonials(sortTestimonials(localItems));

    fetchTestimonialsFromD1().then((res) => {
      if (res && res.success && Array.isArray(res.testimonials) && res.testimonials.length > 0) {
        const sorted = sortTestimonials(res.testimonials);
        setTestimonials(sorted);
        saveStoredTestimonials(sorted);
      }
    }).catch(() => {});
  }, []);

  const persistTestimonials = (updated: TestimonialRecord[]) => {
    const sorted = sortTestimonials(updated);
    setTestimonials(sorted);
    saveStoredTestimonials(sorted);
  };

  const handleStatusChange = async (id: string, newStatus: 'Pending' | 'Approved' | 'Rejected') => {
    const reviewStatus = newStatus.toLowerCase() as 'pending' | 'approved' | 'rejected';
    const updated = testimonials.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: newStatus,
          reviewStatus
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
    const updated = testimonials.map(t =>
      t.id === item.id ? { ...t, isVisible: nextVisible } : t
    );
    persistTestimonials(updated);
    await updateTestimonialInD1(item.id, { isVisible: nextVisible });
    onShowToast?.(nextVisible ? 'Testimonial shown on website.' : 'Testimonial hidden from website.');
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
      updateTestimonialInD1(swapItem.id, { displayOrder: newOrderSwap })
    ]);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormAuthorName('');
    setFormRole('');
    setFormDepartment('');
    setFormInstitution('');
    setFormQuote('');
    setFormPhotoUrl('');
    setIsEditorOpen(true);
  };

  const openEditModal = (item: TestimonialRecord) => {
    setEditingItem(item);
    setFormAuthorName(item.authorName || item.fullName || '');
    setFormRole(item.role || item.authorRole || '');
    setFormDepartment(item.departmentName || '');
    setFormInstitution(item.universityName || item.institutionName || '');
    setFormQuote(item.testimonialText || item.shortQuote || '');
    setFormPhotoUrl(item.photoUrl || '');
    setIsEditorOpen(true);
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAuthorName.trim() || !formQuote.trim()) return;
    setIsSaving(true);
    try {
      if (editingItem) {
        const patch: Partial<TestimonialRecord> = {
          authorName: formAuthorName.trim(),
          fullName: formAuthorName.trim(),
          role: formRole.trim() || 'Graduate',
          authorRole: formRole.trim() || 'Graduate',
          departmentName: formDepartment.trim() || 'Department',
          universityName: formInstitution.trim() || editingItem.universityName || '',
          institutionName: formInstitution.trim() || editingItem.institutionName || '',
          testimonialText: formQuote.trim(),
          shortQuote: formQuote.trim(),
          photoUrl: formPhotoUrl.trim() || undefined
        };
        const updated = testimonials.map(t => (t.id === editingItem.id ? { ...t, ...patch } : t));
        persistTestimonials(updated);
        await updateTestimonialInD1(editingItem.id, patch);
        onShowToast?.('Testimonial updated.');
      } else {
        const nextOrder = testimonials.length + 1;
        const newRecord: TestimonialRecord = {
          id: `test-${Date.now()}`,
          fullName: formAuthorName.trim(),
          authorName: formAuthorName.trim(),
          role: formRole.trim() || 'Graduate',
          authorRole: formRole.trim() || 'Graduate',
          universityName: formInstitution.trim() || '',
          institutionName: formInstitution.trim() || '',
          departmentName: formDepartment.trim() || 'Department',
          graduationYear: new Date().getFullYear().toString(),
          rating: 5,
          shortQuote: formQuote.trim(),
          testimonialText: formQuote.trim(),
          photoUrl: formPhotoUrl.trim() || undefined,
          permissionGranted: true,
          publicationPermission: 'public',
          submittedAt: new Date().toISOString(),
          status: 'Approved',
          reviewStatus: 'approved',
          isVisible: true,
          isDemo: false,
          displayOrder: nextOrder
        };
        const updated = [...testimonials, newRecord];
        persistTestimonials(updated);
        await submitTestimonialToD1(newRecord);
        onShowToast?.('Testimonial added.');
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
      const updated = testimonials.filter(t => t.id !== deletingItem.id);
      persistTestimonials(updated);
      await deleteTestimonialInD1(deletingItem.id);
      onShowToast?.('Testimonial deleted.');
      setDeletingItem(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTestimonials = testimonials.filter(t => {
    const statusLabel = t.status || (t.reviewStatus ? (t.reviewStatus.charAt(0).toUpperCase() + t.reviewStatus.slice(1)) : 'Approved');
    const matchesStatus = filterStatus === 'All' || statusLabel.toLowerCase() === filterStatus.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (t.fullName || t.authorName || '').toLowerCase().includes(q) ||
      (t.universityName || t.institutionName || '').toLowerCase().includes(q) ||
      (t.departmentName || '').toLowerCase().includes(q) ||
      (t.role || t.authorRole || '').toLowerCase().includes(q) ||
      (t.shortQuote || '').toLowerCase().includes(q) ||
      (t.testimonialText || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: testimonials.length,
    visible: testimonials.filter(t => t.isVisible !== false && (t.status === 'Approved' || t.reviewStatus === 'approved')).length,
    pending: testimonials.filter(t => t.status === 'Pending' || t.reviewStatus === 'pending').length,
    samples: testimonials.filter(t => t.isDemo).length
  };

  return (
    <div className="space-y-6">
      {/* Header & Manual Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d121f] border border-white/[0.06] rounded-xl p-5">
        <div>
          <h3 className="text-base font-medium text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#d9b648]" />
            Website Testimonials
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Manage sample and submitted testimonials shown on the public website. If all testimonials are hidden or deleted, the public section hides automatically.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#d9b648] hover:bg-[#eab308] text-slate-950 font-mono-tech text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Testimonial
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0d121f] border border-white/[0.06] rounded-xl p-4">
          <div className="text-slate-400 font-mono-tech text-[10px] uppercase tracking-wider mb-1">Total Items</div>
          <div className="text-xl font-display text-white">{stats.total}</div>
        </div>
        <div className="bg-[#0d121f] border border-emerald-500/20 rounded-xl p-4">
          <div className="text-emerald-400/80 font-mono-tech text-[10px] uppercase tracking-wider mb-1">Live on Website</div>
          <div className="text-xl font-display text-emerald-400">{stats.visible}</div>
        </div>
        <div className="bg-[#0d121f] border border-amber-500/20 rounded-xl p-4">
          <div className="text-amber-400/80 font-mono-tech text-[10px] uppercase tracking-wider mb-1">Pending Review</div>
          <div className="text-xl font-display text-amber-400">{stats.pending}</div>
        </div>
        <div className="bg-[#0d121f] border border-white/[0.06] rounded-xl p-4">
          <div className="text-slate-400 font-mono-tech text-[10px] uppercase tracking-wider mb-1">Sample Items</div>
          <div className="text-xl font-display text-slate-200">{stats.samples}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-[#0d121f] border border-white/[0.06] p-3.5 rounded-xl">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by author, role, department, or quote..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#070a12] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#d9b648]/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 shrink-0" />
          {(['All', 'Approved', 'Pending', 'Rejected'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg font-mono-tech text-[11px] uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                filterStatus === status
                  ? 'bg-[#d9b648] text-slate-950 font-semibold'
                  : 'bg-[#070a12] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Testimonials List */}
      {filteredTestimonials.length === 0 ? (
        <div className="bg-[#0d121f] border border-white/[0.06] rounded-xl p-10 text-center">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-medium text-white mb-1">No testimonials found</h3>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            {searchQuery || filterStatus !== 'All'
              ? 'No testimonials match your current filters.'
              : 'There are currently no testimonials. Click "Add Testimonial" to create one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTestimonials.map((t, index) => {
            const isVisible = t.isVisible !== false;
            const author = t.authorName || t.fullName || 'Anonymous';
            const role = t.role || t.authorRole || 'Graduate';
            const department = t.departmentName || '';
            const quote = t.testimonialText || t.shortQuote || '';
            const statusLabel = t.status || (t.reviewStatus ? (t.reviewStatus.charAt(0).toUpperCase() + t.reviewStatus.slice(1)) : 'Approved');

            return (
              <div
                key={t.id}
                className={`bg-[#0d121f] border rounded-xl p-4 sm:p-5 transition-all ${
                  !isVisible
                    ? 'border-white/[0.04] opacity-65'
                    : statusLabel === 'Pending'
                    ? 'border-amber-500/30'
                    : 'border-white/[0.08]'
                }`}
              >
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                  {/* Left: Author & Quote */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">{author}</span>
                      <span className="text-xs text-slate-400">· {role}</span>
                      {department && (
                        <span className="text-xs text-slate-400">({department})</span>
                      )}

                      {t.isDemo && (
                        <span className="px-2 py-0.5 rounded bg-[#d9b648]/15 text-[#d9b648] border border-[#d9b648]/30 font-mono-tech text-[10px] uppercase tracking-wider">
                          Sample
                        </span>
                      )}

                      {statusLabel === 'Pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono-tech text-[10px] uppercase tracking-wider">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      )}
                      {statusLabel === 'Rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono-tech text-[10px] uppercase tracking-wider">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </div>

                    <p className="text-slate-200 text-sm leading-relaxed">
                      "{quote}"
                    </p>
                  </div>

                  {/* Right: Show/Hide switch, Edit, Reorder, Approve/Reject, Delete */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-white/[0.06]">
                    {/* Show / Hide Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisible(t)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-tech text-[11px] uppercase tracking-wider border transition-colors cursor-pointer ${
                        isVisible
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                          : 'bg-white/[0.03] text-slate-400 border-white/10 hover:text-white'
                      }`}
                      title={isVisible ? 'Visible on website (click to hide)' : 'Hidden from website (click to show)'}
                    >
                      {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {isVisible ? 'Shown' : 'Hidden'}
                    </button>

                    {/* Reorder Up/Down */}
                    <div className="inline-flex items-center rounded-lg border border-white/10 bg-[#070a12] overflow-hidden">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveOrder(index, 'up')}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === filteredTestimonials.length - 1}
                        onClick={() => handleMoveOrder(index, 'down')}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-l border-white/10"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 font-mono-tech text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>

                    {/* Pending approval actions */}
                    {statusLabel === 'Pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(t.id, 'Approved')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-mono-tech text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(t.id, 'Rejected')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-mono-tech text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setDeletingItem(t)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-mono-tech text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                      title="Delete testimonial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Add / Edit Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0d121f] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-base font-medium text-white">
                {editingItem ? 'Edit Testimonial' : 'Add Testimonial'}
              </h4>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditor} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAuthorName}
                    onChange={(e) => setFormAuthorName(e.target.value)}
                    placeholder="e.g. Chiamaka O."
                    className="w-full bg-[#070a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d9b648]/50"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Role *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. Class Representative"
                    className="w-full bg-[#070a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d9b648]/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Department of Law"
                    className="w-full bg-[#070a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d9b648]/50"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Photo URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formPhotoUrl}
                    onChange={(e) => setFormPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#070a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d9b648]/50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  Quote *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formQuote}
                  onChange={(e) => setFormQuote(e.target.value)}
                  placeholder="Write the testimonial quote..."
                  className="w-full bg-[#070a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d9b648]/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-mono-tech text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-[#d9b648] hover:bg-[#eab308] text-slate-950 font-mono-tech text-xs uppercase tracking-wider font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Testimonial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0d121f] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-medium text-white">Delete this testimonial?</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Delete this testimonial? This can't be undone.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#070a12] border border-white/5 text-xs text-slate-300 italic">
              "{deletingItem.testimonialText || deletingItem.shortQuote}" — {deletingItem.authorName || deletingItem.fullName}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-mono-tech text-xs uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-mono-tech text-xs uppercase tracking-wider font-semibold cursor-pointer disabled:opacity-50"
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
