import React, { useState, useMemo } from 'react';
import { Search, UserCheck, X, Check, Trophy, Crown, Sparkles } from 'lucide-react';
import { StudentProfile } from '../../types';
import { UniversalModal } from './UniversalModal';

interface ProfilePocketPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  students: StudentProfile[];
  selectedId?: string;
  onSelect: (student: StudentProfile) => void;
  mode?: 'award' | 'leader';
}

export const ProfilePocketPickerModal: React.FC<ProfilePocketPickerModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  students,
  selectedId,
  onSelect,
  mode = 'award',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter((s) => {
      const name = (s.fullName || '').toLowerCase();
      const nick = (s.nickname || '').toLowerCase();
      const pos = (s.position || '').toLowerCase();
      const quote = (s.quote || '').toLowerCase();
      return name.includes(q) || nick.includes(q) || pos.includes(q) || quote.includes(q);
    });
  }, [students, searchQuery]);

  if (!isOpen) return null;

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
            mode === 'leader' 
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          }`}>
            {mode === 'leader' ? (
              <Crown className="w-5 h-5" />
            ) : (
              <Trophy className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-syne font-bold text-base sm:text-lg text-white">
              {title}
            </h3>
            <p className="font-mono-tech text-[11px] text-zinc-400">
              {subtitle}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search input with count */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, nickname, or role..."
              className="w-full bg-[#12131d] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#d4af37]/60 font-body"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="font-mono-tech text-[11px] text-zinc-400 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
            {filteredStudents.length} {filteredStudents.length === 1 ? 'Profile' : 'Profiles'}
          </span>
        </div>

        {/* Pocket Scrollable List */}
        <div 
          id="pocket-scrollable-profile-list"
          className="max-h-[380px] overflow-y-auto space-y-2 pr-1 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10"
        >
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <UserCheck className="w-6 h-6 text-zinc-500 mx-auto" />
              <p className="font-syne font-bold text-sm text-white">
                No matching profiles found
              </p>
              <p className="font-body text-xs text-zinc-400">
                Try a different search term or check approved profiles list.
              </p>
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isSelected = selectedId === student.id;
              const initials = (student.fullName || 'ST')
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')
                .toUpperCase();

              return (
                <div
                  key={student.id}
                  onClick={() => {
                    onSelect(student);
                    onClose();
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isSelected
                      ? 'bg-[#d4af37]/10 border-[#d4af37]/40'
                      : 'bg-[#18181b] hover:bg-white/[0.04] border-white/10 hover:border-[#d4af37]/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Headshot / Avatar with fallback initials */}
                    <div className="w-12 h-12 rounded-xl bg-[#18181b] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.fullName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="font-mono-tech text-xs font-bold text-zinc-400">
                          {initials}
                        </span>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#d4af37]/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-[#d4af37]" />
                        </div>
                      )}
                    </div>

                    {/* Profile Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-syne font-bold text-xs sm:text-sm text-white group-hover:text-amber-300 transition-colors truncate">
                          {student.fullName}
                        </span>
                        {student.nickname && (
                          <span className="text-[11px] font-mono-tech text-zinc-400">
                            "{student.nickname}"
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {student.position ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-tech uppercase font-semibold ${
                            mode === 'leader'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-white/10 text-zinc-300 border border-white/10'
                          }`}>
                            {student.position}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono-tech text-zinc-500">
                            Class Member / Graduate
                          </span>
                        )}

                        {student.quote && (
                          <span className="text-[10px] font-body italic text-zinc-400 truncate max-w-[200px] hidden sm:inline">
                            "{student.quote}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Select Action Button */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-xl font-mono-tech text-[11px] uppercase tracking-wider font-semibold transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-black shadow-md'
                          : 'bg-white/10 group-hover:bg-white text-zinc-300 group-hover:text-black'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info note */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono-tech text-zinc-500">
          <span>Click any card to populate name and photo</span>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};
