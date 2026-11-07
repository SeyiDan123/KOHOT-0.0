import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Building2,
  BookOpen,
  ArrowLeft,
  ArrowUpRight,
  Compass,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import {
  ClassSet,
  UniversityDirectoryItem,
  PublicDirectoryAlbumCard,
  WebsiteContentOverride,
} from '../../types';
import {
  fetchPublicDirectoryFromServer,
  getLocalPlatformSettingsFallback,
} from '../../utils/apiClient';

interface PublicDirectoryViewProps {
  sets: ClassSet[];
  universities: UniversityDirectoryItem[];
  contentOverride?: WebsiteContentOverride;
  onSelectAlbum: (albumId: string) => void;
  onBack: () => void;
}

export const PublicDirectoryView: React.FC<PublicDirectoryViewProps> = ({
  sets,
  universities,
  contentOverride,
  onSelectAlbum,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null);
  const [serverAlbums, setServerAlbums] = useState<PublicDirectoryAlbumCard[] | null>(null);

  // Set <meta name="robots" content="noindex, nofollow" /> while on the directory page
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const prevContent = meta?.getAttribute('content') || null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';

    return () => {
      if (meta) {
        if (prevContent !== null) {
          meta.content = prevContent;
        } else {
          meta.remove();
        }
      }
    };
  }, []);

  useEffect(() => {
    fetchPublicDirectoryFromServer().then((res) => {
      setServerEnabled(res.enabled);
      if (res.albums && res.albums.length > 0) {
        setServerAlbums(res.albums);
      }
    });
  }, []);

  const localSettings = useMemo(() => getLocalPlatformSettingsFallback(), [contentOverride]);

  const isDirectoryEnabled = useMemo(() => {
    if (contentOverride?.publicDirectoryEnabled !== undefined) {
      return Boolean(contentOverride.publicDirectoryEnabled);
    }
    if (serverEnabled !== null) {
      return serverEnabled;
    }
    return Boolean(localSettings.public_directory_enabled);
  }, [contentOverride, serverEnabled, localSettings]);

  const hiddenInstSet = useMemo(() => {
    const list =
      contentOverride?.hiddenDirectoryInstitutions ||
      localSettings.hidden_directory_institutions ||
      [];
    return new Set(list.map((id) => String(id).toLowerCase()));
  }, [contentOverride, localSettings]);

  const hiddenAlbumSet = useMemo(() => {
    const list =
      contentOverride?.hiddenDirectoryAlbums || localSettings.hidden_directory_albums || [];
    return new Set(list.map((id) => String(id)));
  }, [contentOverride, localSettings]);

  // Build strictly sanitized public directory album cards (cover, album name, department, and year ONLY)
  const directoryAlbums: PublicDirectoryAlbumCard[] = useMemo(() => {
    const map = new Map<string, PublicDirectoryAlbumCard>();

    for (const a of serverAlbums || []) {
      if (!a || !a.id) continue;
      if (hiddenInstSet.has(String(a.institutionId).toLowerCase()) || hiddenAlbumSet.has(a.id)) {
        continue;
      }
      map.set(a.id, {
        id: a.id,
        coverUrl: a.coverUrl,
        albumName: a.albumName,
        departmentId: a.departmentId,
        departmentName: a.departmentName,
        institutionId: a.institutionId,
        institutionName: a.institutionName,
        graduationYear: Number(a.graduationYear),
        isDemo: Boolean(a.isDemo),
      });
    }

    for (const s of sets) {
      if (!s || !s.id || map.has(s.id)) continue;
      const isPublished =
        (s.isPublished === true ||
          s.published === true ||
          s.lifecycleStatus === 'published' ||
          s.lifecycleStatus === 'published_live' ||
          s.id.startsWith('crownfield-')) &&
        !s.isUnpublished &&
        !s.unpublished &&
        !s.deletedAt;
      const isListed = s.isListedInDirectory !== false && !s.isHiddenFromDirectory;
      if (!isPublished || !isListed) continue;
      if (
        hiddenInstSet.has(String(s.institutionId).toLowerCase()) ||
        hiddenAlbumSet.has(s.id)
      ) {
        continue;
      }

      const isDemo =
        String(s.institutionId).toLowerCase() === 'crownfield' || s.id.startsWith('crownfield-');

      map.set(s.id, {
        id: s.id,
        coverUrl: s.legacyGroupImageUrl || s.bannerImageUrl || '',
        albumName:
          s.classSetName || `${s.departmentName} '${String(s.graduationYear).slice(-2)}`,
        departmentId: s.departmentId,
        departmentName: s.departmentName,
        institutionId: s.institutionId,
        institutionName: s.institutionName,
        graduationYear: Number(s.graduationYear),
        isDemo,
      });
    }

    const allCards = Array.from(map.values());
    // Rule 4: The Crownfield demo appears labelled "Demo" until 3 real albums are listed, then leaves the directory
    const realCount = allCards.filter((c) => !c.isDemo).length;
    const visibleCards = realCount >= 3 ? allCards.filter((c) => !c.isDemo) : allCards;

    return visibleCards.sort((a, b) => b.graduationYear - a.graduationYear);
  }, [serverAlbums, sets, hiddenInstSet, hiddenAlbumSet]);

  // Build hierarchical Institutions -> Departments -> Albums structure
  const directoryTree = useMemo(() => {
    const instMap = new Map<
      string,
      {
        id: string;
        name: string;
        shortCode: string;
        location: string;
        logoUrl: string;
        isDemo?: boolean;
        departments: Map<
          string,
          {
            id: string;
            name: string;
            albums: PublicDirectoryAlbumCard[];
          }
        >;
      }
    >();

    for (const card of directoryAlbums) {
      const instKey = card.institutionId.toLowerCase();
      const matchedUni = universities.find((u) => u.id.toLowerCase() === instKey);
      if (!instMap.has(instKey)) {
        instMap.set(instKey, {
          id: card.institutionId,
          name: matchedUni?.name || card.institutionName,
          shortCode: matchedUni?.shortCode || (card.isDemo ? 'DEMO' : ''),
          location: matchedUni?.location || '',
          logoUrl: matchedUni?.logoUrl || '',
          isDemo: card.isDemo,
          departments: new Map(),
        });
      }
      const instEntry = instMap.get(instKey)!;
      const deptKey = card.departmentId.toLowerCase();
      if (!instEntry.departments.has(deptKey)) {
        instEntry.departments.set(deptKey, {
          id: card.departmentId,
          name: card.departmentName,
          albums: [],
        });
      }
      instEntry.departments.get(deptKey)!.albums.push(card);
    }

    return Array.from(instMap.values()).map((inst) => ({
      ...inst,
      departments: Array.from(inst.departments.values()).map((d) => ({
        ...d,
        albums: d.albums.sort((a, b) => b.graduationYear - a.graduationYear),
      })),
    }));
  }, [directoryAlbums, universities]);

  const filteredInstitutions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return directoryTree;
    return directoryTree.filter(
      (inst) =>
        inst.name.toLowerCase().includes(q) ||
        inst.shortCode.toLowerCase().includes(q) ||
        inst.departments.some(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.albums.some(
              (a) =>
                a.albumName.toLowerCase().includes(q) ||
                String(a.graduationYear).includes(q)
            )
        )
    );
  }, [directoryTree, searchQuery]);

  const activeInstitution = useMemo(
    () =>
      selectedInstitutionId
        ? directoryTree.find(
            (i) => i.id.toLowerCase() === selectedInstitutionId.toLowerCase()
          ) || null
        : null,
    [directoryTree, selectedInstitutionId]
  );

  const activeDepartment = useMemo(
    () =>
      activeInstitution && selectedDepartmentId
        ? activeInstitution.departments.find(
            (d) => d.id.toLowerCase() === selectedDepartmentId.toLowerCase()
          ) || null
        : null,
    [activeInstitution, selectedDepartmentId]
  );

  // Rule 2: When OFF, direct links to directory pages show "not available"
  if (!isDirectoryEnabled) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#121318] border border-white/10 space-y-4">
          <p className="font-mono-tech text-xs uppercase tracking-widest text-zinc-400">
            not available
          </p>
          <p className="font-body text-xs text-zinc-400">
            This page is not available.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header & Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (selectedDepartmentId) {
                  setSelectedDepartmentId(null);
                } else if (selectedInstitutionId) {
                  setSelectedInstitutionId(null);
                } else {
                  onBack();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>
                {selectedDepartmentId
                  ? activeInstitution?.name || 'Departments'
                  : selectedInstitutionId
                  ? 'All Institutions'
                  : 'Back to Legacy Wall'}
              </span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 font-mono-tech text-[10px] uppercase tracking-wider text-[#d4af37]">
              <Compass className="w-3 h-3" />
              <span>Explore Other Departments</span>
            </span>
          </div>

          <h1 className="font-syne font-extrabold text-2xl sm:text-3xl text-white">
            {activeDepartment
              ? `${activeDepartment.name} — Classes by Year`
              : activeInstitution
              ? `${activeInstitution.name} — Departments`
              : 'Explore Institutions & Departments'}
          </h1>
          <p className="font-body text-xs sm:text-sm text-zinc-400">
            {activeDepartment
              ? `Published class albums in ${activeDepartment.name} at ${activeInstitution?.name}.`
              : activeInstitution
              ? `Select a department in ${activeInstitution.name} to browse published class albums by year.`
              : 'Search institutions, open a department, and browse published class albums by graduation year.'}
          </p>
        </div>

        {!activeInstitution && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search institutions or departments..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#121318] border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        )}
      </div>

      {/* LEVEL 1: INSTITUTIONS LIST */}
      {!activeInstitution && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInstitutions.map((inst) => {
            const totalPublished = inst.departments.reduce(
              (sum, d) => sum + d.albums.length,
              0
            );
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => {
                  setSelectedInstitutionId(inst.id);
                  setSelectedDepartmentId(null);
                }}
                className="p-5 rounded-2xl bg-[#121318] hover:bg-[#171922] border border-white/10 hover:border-[#d4af37]/40 text-left transition-all flex flex-col justify-between gap-4 group cursor-pointer shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-black/60 border border-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                      {inst.logoUrl ? (
                        <img
                          src={inst.logoUrl}
                          alt={inst.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-[#d4af37]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-syne font-bold text-sm sm:text-base text-white group-hover:text-[#d4af37] transition-colors truncate">
                          {inst.name}
                        </h3>
                        {inst.isDemo && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 font-mono-tech text-[10px] uppercase text-amber-300 font-bold">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="font-mono-tech text-[11px] text-zinc-400 mt-0.5">
                        {inst.departments.length} department
                        {inst.departments.length === 1 ? '' : 's'} · {totalPublished} published album
                        {totalPublished === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-[#d4af37] shrink-0" />
                </div>
              </button>
            );
          })}

          {filteredInstitutions.length === 0 && (
            <div className="col-span-full p-12 rounded-2xl bg-[#121318] border border-white/10 text-center space-y-2">
              <Building2 className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="font-syne font-bold text-sm text-white">No matching institutions</p>
              <p className="font-body text-xs text-zinc-400">
                Try another search term to browse published departments and class albums.
              </p>
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2: DEPARTMENTS WITHIN SELECTED INSTITUTION */}
      {activeInstitution && !activeDepartment && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeInstitution.departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => setSelectedDepartmentId(dept.id)}
              className="p-5 rounded-2xl bg-[#121318] hover:bg-[#171922] border border-white/10 hover:border-[#d4af37]/40 text-left transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-syne font-bold text-sm sm:text-base text-white group-hover:text-[#d4af37] transition-colors truncate">
                      {dept.name}
                    </h3>
                    {activeInstitution.isDemo && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 font-mono-tech text-[9px] uppercase text-amber-300 font-bold">
                        Demo
                      </span>
                    )}
                  </div>
                  <p className="font-mono-tech text-[11px] text-zinc-400 mt-0.5">
                    {dept.albums.length} published class album{dept.albums.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-[#d4af37] shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* LEVEL 3: CLASSES BY YEAR (Cover, Album Name, Department, and Year ONLY — Never Student Names or Faces) */}
      {activeInstitution && activeDepartment && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeDepartment.albums.map((album) => (
            <div
              key={album.id}
              onClick={() => onSelectAlbum(album.id)}
              className="group rounded-2xl bg-[#121318] border border-white/10 hover:border-[#d4af37]/50 overflow-hidden flex flex-col justify-between transition-all cursor-pointer shadow-xl"
            >
              {/* Cover Image ONLY */}
              <div className="relative h-44 bg-zinc-900 overflow-hidden">
                {album.coverUrl ? (
                  <img
                    src={album.coverUrl}
                    alt={album.albumName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <ImageIcon className="w-8 h-8 text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121318] via-black/30 to-transparent" />

                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 font-mono-tech text-[11px] font-bold text-[#d4af37]">
                    Class of {album.graduationYear}
                  </span>
                  {album.isDemo && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/40 font-mono-tech text-[10px] uppercase font-bold text-amber-300">
                      Demo
                    </span>
                  )}
                </div>
              </div>

              {/* Strictly Album Name, Department, and Year ONLY */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-syne font-bold text-base text-white group-hover:text-[#d4af37] transition-colors truncate">
                    {album.albumName}
                  </h4>
                  <p className="font-body text-xs text-zinc-400 truncate mt-0.5">
                    {album.departmentName} · {album.graduationYear}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-[#d4af37] group-hover:text-black text-zinc-300 flex items-center justify-center transition-colors shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
