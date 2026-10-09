import React, { useState, useEffect } from 'react';
import { DepartmentItem, UniversityDirectoryItem } from '../../types';
import { ImageDropzone } from '../common/ImageDropzone';
import { UniversalModal } from '../common/UniversalModal';
import { 
  X, 
  Save, 
  Building2, 
  Image as ImageIcon, 
  FileText, 
  Sparkles, 
  Link as LinkIcon, 
  UserCheck 
} from 'lucide-react';

interface EditDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: DepartmentItem;
  university: UniversityDirectoryItem;
  onSaveDepartment: (updatedDept: DepartmentItem) => void;
}

export const EditDepartmentModal: React.FC<EditDepartmentModalProps> = ({
  isOpen,
  onClose,
  department,
  university,
  onSaveDepartment,
}) => {
  const [name, setName] = useState(department.name);
  const [code, setCode] = useState(department.code || '');
  const [faculty, setFaculty] = useState(department.faculty);
  const [logoUrl, setLogoUrl] = useState(department.logoUrl || '');
  const [heroImageUrl, setHeroImageUrl] = useState(department.heroImageUrl);
  const [caption, setCaption] = useState(department.caption);
  const [officialPortal, setOfficialPortal] = useState(department.officialPortal || '');
  const [hodName, setHodName] = useState(department.hodName || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setName(department.name);
    setCode(department.code || '');
    setFaculty(department.faculty);
    setLogoUrl(department.logoUrl || '');
    setHeroImageUrl(department.heroImageUrl);
    setCaption(department.caption);
    setOfficialPortal(department.officialPortal || '');
    setHodName(department.hodName || '');
    setSavedSuccess(false);
  }, [department, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !heroImageUrl.trim()) return;

    const updated: DepartmentItem = {
      ...department,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      faculty: faculty.trim(),
      logoUrl: logoUrl.trim(),
      heroImageUrl: heroImageUrl.trim(),
      caption: caption.trim(),
      officialPortal: officialPortal.trim(),
      hodName: hodName.trim(),
    };

    onSaveDepartment(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-syne font-bold text-white text-base flex items-center gap-2">
              <span>Configure Department Directory Compartment</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase tracking-wider bg-white/10 text-zinc-300 border border-white/20">
                Master Host Only
              </span>
            </h3>
            <p className="font-body text-xs text-zinc-400">
              {university.name} • Hero banner &amp; narrative caption display on the public department directory.
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-tech tracking-wider uppercase transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const form = document.getElementById('edit-department-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-tech font-bold tracking-wider uppercase flex items-center gap-2 transition-colors cursor-pointer shadow-lg"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedSuccess ? 'Saved!' : 'Save Compartment'}</span>
          </button>
        </div>
      }
    >
      <form id="edit-department-form" onSubmit={handleSubmit} className="space-y-5 text-xs font-body">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                Department Name *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Computer Science"
                className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                Short Code (e.g. CSC, EEE, LAW)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CSC"
                className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                Faculty / School *
              </label>
              <input
                required
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. Faculty of Science"
                className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                Head of Department (HOD)
              </label>
              <input
                type="text"
                value={hodName}
                onChange={(e) => setHodName(e.target.value)}
                placeholder="e.g. Prof. O. Balogun"
                className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Hero Banner Image Upload (Strictly Drag & Drop / File Upload) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono-tech text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                Strictly Master Owner Control
              </span>
            </div>
            <ImageDropzone
              value={heroImageUrl}
              onChange={setHeroImageUrl}
              label="Department Directory Hero Banner Image"
              aspectRatio="banner"
              maxDimension={1600}
              required
              helperText="High-resolution hero cover banner displayed at the top of this department's legacy wall"
            />
          </div>

          {/* Department Caption / Narrative (Protected master field) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono-tech text-[11px] uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-300" />
                <span>Department Caption / Institutional Narrative *</span>
              </label>
              <span className="text-[10px] font-mono-tech text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                Strictly Master Owner
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Pioneering algorithmic excellence, software leadership, and digital transformation across Africa..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="space-y-4">
            <ImageDropzone
              value={logoUrl}
              onChange={setLogoUrl}
              label="Department Badge / Crest Logo"
              aspectRatio="1:1"
              maxDimension={400}
              helperText="Official department crest or faculty insignia"
            />

            <div>
              <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                Official Department Portal URL
              </label>
              <input
                type="url"
                value={officialPortal}
                onChange={(e) => setOfficialPortal(e.target.value)}
                placeholder="https://csc.unilag.edu.ng"
                className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
              />
            </div>
          </div>
        </form>
    </UniversalModal>
  );
};
