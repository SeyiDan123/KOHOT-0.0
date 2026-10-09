import React, { useState } from 'react';
import { 
  Heart, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Star, 
  Plus, 
  Trash2, 
  Edit3, 
  X,
  User,
  Quote,
  Eye,
  EyeOff
} from 'lucide-react';
import { TestimonialRecord, WebsiteContentOverride } from '../../types';
import { 
  getStoredTestimonials, 
  saveStoredTestimonials,
  getStoredContentOverride,
  saveStoredContentOverride
} from '../../data/initialData';

interface MasterTestimonialsSectionProps {
  contentOverride?: WebsiteContentOverride;
  onUpdateContentOverride?: (updated: Partial<WebsiteContentOverride>) => void;
}

export const MasterTestimonialsSection: React.FC<MasterTestimonialsSectionProps> = ({
  contentOverride,
  onUpdateContentOverride,
}) => {
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>(getStoredTestimonials);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Master toggle: show or hide the entire testimonials section from public website
  const [showSectionOnWebsite, setShowSectionOnWebsite] = useState<boolean>(() => {
    if (contentOverride && typeof contentOverride.showTestimonialsSection === 'boolean') {
      return contentOverride.showTestimonialsSection;
    }
    const stored = getStoredContentOverride();
    return typeof stored.showTestimonialsSection === 'boolean' ? stored.showTestimonialsSection : true;
  });

  const handleToggleWebsiteSection = () => {
    const next = !showSectionOnWebsite;
    setShowSectionOnWebsite(next);
    if (onUpdateContentOverride) {
      onUpdateContentOverride({ showTestimonialsSection: next });
    }
    const current = getStoredContentOverride();
    saveStoredContentOverride({ ...current, showTestimonialsSection: next });
  };
  
  // Add modal state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Class Representative');
  const [newUni, setNewUni] = useState('University of Lagos');
  const [newDept, setNewDept] = useState('Computer Science');
  const [newYear, setNewYear] = useState<number>(2026);
  const [newQuote, setNewQuote] = useState('');
  const [newAvatar, setNewAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');

  const handleToggleFeatured = (id: string) => {
    const updated = testimonials.map((t) =>
      t.id === id ? { ...t, isFeatured: !t.isFeatured } : t
    );
    setTestimonials(updated);
    saveStoredTestimonials(updated);
  };

  const handleUpdateStatus = (id: string, status: 'Approved' | 'Pending' | 'Rejected') => {
    const updated = testimonials.map((t) =>
      t.id === id ? { ...t, status } : t
    );
    setTestimonials(updated);
    saveStoredTestimonials(updated);
  };

  const handleDelete = (id: string) => {
    const updated = testimonials.filter((t) => t.id !== id);
    setTestimonials(updated);
    saveStoredTestimonials(updated);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newQuote.trim()) return;

    const newRecord: TestimonialRecord = {
      id: `testim-${Date.now()}`,
      authorName: newName.trim(),
      authorRole: newRole.trim(),
      universityName: newUni.trim(),
      departmentName: newDept.trim(),
      graduationYear: newYear,
      quote: newQuote.trim(),
      avatarUrl: newAvatar.trim(),
      status: 'Approved',
      isFeatured: true,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updated = [newRecord, ...testimonials];
    setTestimonials(updated);
    saveStoredTestimonials(updated);

    // Reset Form
    setNewName('');
    setNewQuote('');
    setIsAddModalOpen(false);
  };

  return (
    <div id="master-testimonials-section" className="space-y-6 animate-fadeIn">
      {/* 1. Master Toggle Banner for Public Website Visibility */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-syne font-bold text-base text-slate-900 dark:text-white">
              Website Testimonials Section Visibility
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-bold uppercase tracking-wider ${
              showSectionOnWebsite 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' 
                : 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
            }`}>
              {showSectionOnWebsite ? 'Active on Website' : 'Hidden from Website'}
            </span>
          </div>
          <p className="font-body text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Turn the entire &ldquo;In Their Words&rdquo; testimonials section off from showing on the website until real testimonials arrive. While off, visitors see only the core pillars, how it works, and albums.
          </p>
        </div>

        <button
          type="button"
          id="toggle-website-testimonials-btn"
          onClick={handleToggleWebsiteSection}
          className={`px-5 py-2.5 rounded-2xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 flex items-center gap-2 ${
            showSectionOnWebsite
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {showSectionOnWebsite ? (
            <>
              <EyeOff className="w-4 h-4" />
              <span>Turn OFF on Website</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              <span>Turn ON on Website</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Management Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-mono-tech uppercase font-semibold">
              Public Narrative Module
            </span>
          </div>
          <h2 className="font-syne font-bold text-2xl text-slate-900 dark:text-white tracking-tight">
            Class Rep &amp; Student Testimonials
          </h2>
          <p className="font-body text-xs text-slate-600 dark:text-slate-400">
            Review quotes submitted during album publication and feature them on the KoHot public homepage.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Testimonial</span>
        </button>
      </div>

      {/* 3. Testimonials List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between space-y-4 shadow-xs"
          >
            <div className="space-y-3">
              {/* Top Row: Author & Badges */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={t.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                    alt={t.authorName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-neutral-700"
                  />
                  <div>
                    <h4 className="font-syne font-bold text-sm text-slate-900 dark:text-white">{t.authorName}</h4>
                    <p className="font-mono-tech text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                      {t.authorRole} • {t.departmentName} '{String(t.graduationYear).slice(-2)}
                    </p>
                    <p className="font-mono-tech text-[10px] text-slate-500 dark:text-slate-400">{t.universityName}</p>
                  </div>
                </div>

                {/* Status Badge & Star */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleFeatured(t.id)}
                    title={t.isFeatured ? 'Featured on Homepage (Click to unfeature)' : 'Click to feature on Homepage'}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      t.isFeatured ? 'bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/40' : 'bg-slate-100 dark:bg-neutral-800 text-slate-400 border border-slate-200 dark:border-neutral-700'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${t.isFeatured ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-semibold ${
                    t.status === 'Approved' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                      : t.status === 'Rejected'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {t.status}
                  </span>
                </div>
              </div>

              {/* Quote Body */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-800 font-body text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                "{t.quote}"
              </div>
            </div>

            {/* Bottom Row: Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                {t.status !== 'Approved' && (
                  <button
                    onClick={() => handleUpdateStatus(t.id, 'Approved')}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-mono-tech font-bold uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                )}
                {t.status !== 'Rejected' && (
                  <button
                    onClick={() => handleUpdateStatus(t.id, 'Rejected')}
                    className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-mono-tech uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => handleDelete(t.id)}
                className="text-slate-400 hover:text-rose-600 text-xs transition-colors p-1 cursor-pointer"
                title="Delete Testimonial"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-4">
              <h3 className="font-syne font-bold text-lg text-slate-900 dark:text-white">Add Curated Testimonial</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold mb-1">Author Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Oluwaseun Danladi"
                    className="w-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold mb-1">Role</label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold mb-1">Grad Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold mb-1">Department</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold mb-1">Quote *</label>
                <textarea
                  required
                  rows={3}
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  placeholder="Share the testimonial words..."
                  className="w-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm active:scale-95"
                >
                  Save Testimonial
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase font-mono-tech cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
