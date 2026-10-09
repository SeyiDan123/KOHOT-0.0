import React, { useState, useEffect } from 'react';
import { UniversityDirectoryItem } from '../../types';
import { ImageDropzone } from '../common/ImageDropzone';
import { UniversalModal } from '../common/UniversalModal';
import { X, Save, Building2, Globe, MapPin, Award, Image as ImageIcon } from 'lucide-react';

interface EditUniversityModalProps {
  isOpen: boolean;
  onClose: () => void;
  university: UniversityDirectoryItem;
  onSaveUniversity: (updatedUni: UniversityDirectoryItem) => void;
}

export const EditUniversityModal: React.FC<EditUniversityModalProps> = ({
  isOpen,
  onClose,
  university,
  onSaveUniversity,
}) => {
  const [name, setName] = useState(university.name);
  const [shortCode, setShortCode] = useState(university.shortCode);
  const [orderNumber, setOrderNumber] = useState<number>(university.orderNumber || 1);
  const [location, setLocation] = useState(university.location);
  const [logoUrl, setLogoUrl] = useState(university.logoUrl);
  const [motto, setMotto] = useState(university.motto || '');
  const [officialWebsite, setOfficialWebsite] = useState(university.officialWebsite);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setName(university.name);
    setShortCode(university.shortCode);
    setOrderNumber(university.orderNumber || 1);
    setLocation(university.location);
    setLogoUrl(university.logoUrl);
    setMotto(university.motto || '');
    setOfficialWebsite(university.officialWebsite);
    setSavedSuccess(false);
  }, [university, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updated: UniversityDirectoryItem = {
      ...university,
      name: name.trim(),
      shortCode: shortCode.trim().toUpperCase(),
      orderNumber: Number(orderNumber) || 1,
      location: location.trim(),
      logoUrl: logoUrl.trim(),
      motto: motto.trim(),
      officialWebsite: officialWebsite.trim(),
    };

    onSaveUniversity(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
            <Building2 className="w-5 h-5 text-[#d4af37]" />
          </div>
          <div>
            <span className="text-[10px] font-mono-tech uppercase tracking-widest text-[#d4af37] block">
              Master Host • Layer 1 Governance
            </span>
            <h3 className="font-syne font-bold text-lg text-white">
              Edit Institutional Directory (Batch #{String(orderNumber).padStart(2, '0')})
            </h3>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          {savedSuccess ? (
            <span className="text-emerald-400 font-mono-tech text-xs">
              ✓ University directory successfully updated!
            </span>
          ) : (
            <span className="text-zinc-500 font-mono-tech text-[11px] truncate mr-2">
              Governs official crest, batch ordering, and university metadata.
            </span>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-mono-tech text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const form = document.getElementById('edit-university-form') as HTMLFormElement;
                if (form) form.requestSubmit();
              }}
              className="px-5 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e6c158] text-black font-semibold font-mono-tech text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      }
    >
      <form id="edit-university-form" onSubmit={handleSubmit} className="space-y-4 text-xs font-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                University Full Name *
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. University of Lagos (UNILAG)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                Short Code *
              </label>
              <input
                required
                type="text"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                placeholder="e.g. UNILAG"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none font-mono-tech uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                Batch Order Number
              </label>
              <input
                type="number"
                min={1}
                value={orderNumber}
                onChange={(e) => setOrderNumber(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white focus:border-white/40 focus:outline-none font-mono-tech"
              />
            </div>

            <div>
              <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                Campus Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Akoka, Yaba, Lagos State"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <ImageDropzone
              value={logoUrl}
              onChange={setLogoUrl}
              label="Official Institutional Crest / Logo"
              aspectRatio="1:1"
              maxDimension={400}
              required
              helperText="Accredited university crest or institutional emblem"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                Institutional Motto
              </label>
              <input
                type="text"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="e.g. In Deed and in Truth"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                Official Website Portal
              </label>
              <input
                type="url"
                value={officialWebsite}
                onChange={(e) => setOfficialWebsite(e.target.value)}
                placeholder="https://unilag.edu.ng"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 font-mono-tech focus:border-white/40 focus:outline-none text-xs"
              />
            </div>
          </div>
        </form>
    </UniversalModal>
  );
};
