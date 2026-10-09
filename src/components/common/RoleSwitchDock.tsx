import React, { useState } from 'react';
import { UserAccount, UserRole } from '../../types';
import { UserCheck, Eye, Sparkles, KeyRound, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface RoleSwitchDockProps {
  currentUser: UserAccount | null;
  currentView: 'landing' | 'albums_grid' | 'department_album' | 'layer1_rep' | 'layer0_master' | 'student_submit';
  onSelectRole: (role: UserRole) => void;
  onOpenOnboarding: () => void;
  onOpenAlbum: () => void;
  onOpenLanding: () => void;
  onOpenDirectory: () => void;
}

export const RoleSwitchDock: React.FC<RoleSwitchDockProps> = ({
  currentUser,
  currentView,
  onSelectRole,
  onOpenOnboarding,
  onOpenAlbum,
  onOpenLanding,
  onOpenDirectory,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Floating Toggle Button */}
      <div className="fixed top-2 right-2 z-50 lg:hidden">
        <button
          type="button"
          id="mobile-role-dock-toggle"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="px-3 py-1.5 rounded-full bg-[#18181b]/95 backdrop-blur-xl border border-white/20 text-white font-mono-tech text-[11px] shadow-2xl flex items-center gap-1.5 cursor-pointer active:scale-95"
          aria-label="Toggle role switch dock"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold">
            {currentView === 'layer1_rep' ? 'L1 Admin' : currentView === 'layer0_master' ? 'L0 Master' : 'Views'}
          </span>
          {isMobileOpen ? <ChevronUp className="w-3 h-3 text-zinc-400" /> : <ChevronDown className="w-3 h-3 text-zinc-400" />}
        </button>

        {/* Mobile Dropdown Menu */}
        {isMobileOpen && (
          <div 
            className="absolute top-10 right-0 w-56 rounded-2xl bg-[#18181b]/98 backdrop-blur-2xl border border-white/20 shadow-2xl p-2 space-y-1 font-mono-tech text-xs animate-fadeIn"
            onClick={() => setIsMobileOpen(false)}
          >
            <div className="px-2.5 py-1 text-[10px] text-zinc-400 uppercase tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
              <span>Switch View &amp; Role</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>

            <button
              onClick={onOpenLanding}
              className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 transition-colors ${
                currentView === 'landing' ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <span>Home Landing</span>
            </button>

            <button
              onClick={onOpenAlbum}
              className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 transition-colors ${
                currentView === 'department_album' ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-zinc-400" />
              <span>Class Album View</span>
            </button>

            <button
              onClick={onOpenDirectory}
              className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 transition-colors ${
                currentView === 'albums_grid' ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <span>All Albums Directory</span>
            </button>

            <div className="border-t border-white/10 my-1 pt-1">
              <button
                id="mobile-dock-class-rep-btn"
                onClick={() => onSelectRole('class_rep')}
                className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 transition-colors ${
                  currentView === 'layer1_rep' ? 'bg-emerald-500 text-black font-bold' : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>L1 Class Album Admin</span>
              </button>

              <button
                id="mobile-dock-master-host-btn"
                onClick={() => onSelectRole('master_host')}
                className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 transition-colors ${
                  currentView === 'layer0_master' ? 'bg-amber-400 text-black font-bold' : 'text-amber-400 hover:bg-amber-400/10'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>L0 Master Host</span>
              </button>
            </div>

            <button
              onClick={onOpenOnboarding}
              className="w-full px-3 py-2 rounded-xl text-left text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-colors mt-1"
            >
              <span>+ Register New Set</span>
            </button>
          </div>
        )}
      </div>

      {/* Desktop Full Horizontal Bar */}
      <aside 
        aria-label="Role and view simulation dock"
        id="role-switch-dock"
        className="fixed top-2 right-2 z-50 bg-[#18181b]/95 backdrop-blur-xl border border-white/15 rounded-full shadow-2xl p-1.5 hidden lg:flex items-center gap-1.5 text-xs font-mono-tech"
      >
        <span className="text-[10px] text-white/50 px-2 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-white" />
          <span>View:</span>
        </span>

        {/* Website Home / Landing */}
        <button
          id="dock-view-home-btn"
          onClick={onOpenLanding}
          className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
            currentView === 'landing'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>Home</span>
        </button>

        {/* Public Album View */}
        <button
          id="dock-view-album-btn"
          onClick={onOpenAlbum}
          className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
            currentView === 'department_album'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Eye className="w-3 h-3" />
          <span>Demo Album</span>
        </button>

        {/* Directory View */}
        <button
          id="dock-view-directory-btn"
          onClick={onOpenDirectory}
          className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
            currentView === 'albums_grid'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>All Albums</span>
        </button>

        {/* Class Album Admin Layer 1 */}
        <button
          id="dock-class-rep-btn"
          onClick={() => onSelectRole('class_rep')}
          className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
            currentView === 'layer1_rep'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <UserCheck className="w-3 h-3 text-emerald-400" />
          <span>L1 Class Album Admin</span>
        </button>

        {/* Master Host Layer 0 */}
        <button
          id="dock-master-host-btn"
          onClick={() => onSelectRole('master_host')}
          className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
            currentView === 'layer0_master'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <KeyRound className="w-3 h-3 text-amber-400" />
          <span>L0 Master Host</span>
        </button>

        {/* Register Onboarding Form */}
        <button
          id="dock-onboard-btn"
          onClick={onOpenOnboarding}
          className="px-3 py-1 rounded-full text-white hover:bg-white/10 transition-colors border border-white/20 cursor-pointer text-xs"
        >
          <span>+ Register Set</span>
        </button>
      </aside>
    </>
  );
};
