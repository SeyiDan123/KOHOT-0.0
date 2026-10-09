import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, 
  Bell, 
  LogOut, 
  Settings, 
  ShieldCheck, 
  Check, 
  HelpCircle, 
  Smartphone, 
  ChevronRight, 
  ArrowRight,
  ExternalLink,
  Share2,
  Crop,
  Upload,
  History,
  ArrowRightLeft,
  Building2,
  X
} from 'lucide-react';
import { UserAccount, ClassSet } from '../../types';
import { ClassAdminModal } from '../admin/ClassAdminModal';
import { InviteOtherDepartmentsModal } from '../admin/InviteOtherDepartmentsModal';
import { HelpModal } from '../public/HelpModal';
import { UniversalModal } from './UniversalModal';
import { ImageCropModal } from './ImageCropModal';

export interface ProfileMenuProps {
  currentUser: UserAccount;
  currentSet?: ClassSet;
  roleTitle?: string;
  onLogout: () => void;
  onUpdateSet?: (updatedSet: ClassSet) => void;
  onAdminTransferred?: (newAdminUser: UserAccount) => void;
  onOpenMyProfile?: () => void;
  triggerCropForImage?: (
    imgUrl: string,
    aspect: 'free' | '1:1' | '4:5' | '16:9',
    title: string,
    onComplete: (cropped: string) => void
  ) => void;
  notifications?: {
    id: string;
    title: string;
    description: string;
    time: string;
    unread?: boolean;
  }[];
  showNotifications?: boolean;
  className?: string;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  currentUser,
  currentSet,
  roleTitle = 'Class Album Admin',
  onLogout,
  onUpdateSet,
  onAdminTransferred,
  onOpenMyProfile,
  triggerCropForImage,
  notifications = [
    {
      id: 'notif-1',
      title: 'Class Portal Active',
      description: 'Your class album submission portal is accepting portrait submissions.',
      time: 'Just now',
      unread: true,
    },
    {
      id: 'notif-2',
      title: 'Plaque Verification Ready',
      description: 'Department architectural plaque dimensions confirmed for corridor installation.',
      time: '2h ago',
      unread: false,
    },
    {
      id: 'notif-3',
      title: 'Annual Relive Queue',
      description: 'Anniversary email notifications configured for convocation season.',
      time: '1d ago',
      unread: false,
    }
  ],
  showNotifications = true,
  className = '',
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Position state for portal dropdown
  const [menuCoords, setMenuCoords] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const [notifCoords, setNotifCoords] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});

  // Sub-modals state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isClassAdminOpen, setIsClassAdminOpen] = useState(false);
  const [classAdminInitialTab, setClassAdminInitialTab] = useState<'admin_history' | 'transfer_admin'>('transfer_admin');
  const [isInviteDepartmentsOpen, setIsInviteDepartmentsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isMyProfileModalOpen, setIsMyProfileModalOpen] = useState(false);

  // Settings form
  const [fullNameInput, setFullNameInput] = useState(currentUser.fullName || '');
  const [emailInput, setEmailInput] = useState(currentUser.email || '');
  const [phoneInput, setPhoneInput] = useState(currentUser.phone || '');
  const [avatarInput, setAvatarInput] = useState(currentUser.avatarUrl || '');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const settingsPhotoInputRef = useRef<HTMLInputElement>(null);

  // Internal Crop Modal fallback for Owner Dashboard or standalone use
  const [internalCropOpen, setInternalCropOpen] = useState(false);
  const [internalCropImage, setInternalCropImage] = useState('');

  // Listen for real-time profile updates from student directory or other editors
  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      if (e.detail?.avatarUrl) {
        setAvatarInput(e.detail.avatarUrl);
      }
      if (e.detail?.fullName) {
        setFullNameInput(e.detail.fullName);
      }
      if (e.detail?.email) {
        setEmailInput(e.detail.email);
      }
      if (e.detail?.phone) {
        setPhoneInput(e.detail.phone);
      }
    };
    window.addEventListener('kohot_user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('kohot_user_profile_updated', handleProfileUpdated);
  }, []);

  // Synchronize effective avatar from account or admin student profile
  const effectiveAvatar = React.useMemo(() => {
    if (avatarInput) return avatarInput;
    if (currentUser.avatarUrl) return currentUser.avatarUrl;
    if (currentSet?.students) {
      const adminEmail = (currentUser?.email || currentSet.classRepEmail || '').toLowerCase().trim();
      const adminName = (currentUser?.fullName || currentSet.classRepName || '').toLowerCase().trim();
      const match = currentSet.students.find((s) => {
        if (s.email && adminEmail && s.email.toLowerCase().trim() === adminEmail) return true;
        if (s.fullName && adminName && s.fullName.toLowerCase().trim() === adminName) return true;
        if ((s as any).isClassRep === true) return true;
        if (s.position && (s.position.toLowerCase().includes('class rep') || s.position.toLowerCase().includes('admin'))) return true;
        return false;
      });
      if (match?.photoUrl) return match.photoUrl;
    }
    return '';
  }, [avatarInput, currentUser.avatarUrl, currentUser?.email, currentUser?.fullName, currentSet?.students, currentSet?.classRepEmail, currentSet?.classRepName]);

  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const [notifList, setNotifList] = useState(notifications);

  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const notifTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Check if current user has administrative authorization
  const isAdmin = currentUser.role === 'class_rep' || currentUser.role === 'master_host';

  // PWA installation detection
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    try {
      if (
        (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && (window.navigator as any).standalone)
      ) {
        setIsInstalled(true);
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Update positioning when opening profile menu - sleek width proportionate to items and aligned to right without cutoff
  const updateMenuPosition = () => {
    if (!profileTriggerRef.current) return;
    const rect = profileTriggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const menuWidth = Math.min(210, viewportWidth - 24);
    const menuEstimatedHeight = 380;

    // Horizontal placement: align right edge with trigger right, clamped so left edge >= 12px
    let right = viewportWidth - rect.right;
    const maxRight = Math.max(12, viewportWidth - menuWidth - 12);
    if (right > maxRight) right = maxRight;
    if (right < 12) right = 12;

    // Vertical placement: place below if space allows, otherwise above
    const spaceBelow = viewportHeight - rect.bottom;
    if (spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight) {
      setMenuCoords({
        bottom: viewportHeight - rect.top + 8,
        right,
      });
    } else {
      setMenuCoords({
        top: rect.bottom + 8,
        right,
      });
    }
  };

  // Update positioning when opening notification popover - clamped so left edge >= 12px (never cut off)
  const updateNotifPosition = () => {
    if (!notifTriggerRef.current) return;
    const rect = notifTriggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    const notifWidth = Math.min(260, viewportWidth - 24);
    let right = viewportWidth - rect.right;
    const maxRight = Math.max(12, viewportWidth - notifWidth - 12);
    if (right > maxRight) right = maxRight;
    if (right < 12) right = 12;

    setNotifCoords({
      top: rect.bottom + 8,
      right,
    });
  };

  // Outside click handler and Escape key handler
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isProfileOpen &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        profileTriggerRef.current &&
        !profileTriggerRef.current.contains(target)
      ) {
        setIsProfileOpen(false);
      }

      if (
        isNotifOpen &&
        notifRef.current &&
        !notifRef.current.contains(target) &&
        notifTriggerRef.current &&
        !notifTriggerRef.current.contains(target)
      ) {
        setIsNotifOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isProfileOpen) {
          setIsProfileOpen(false);
          profileTriggerRef.current?.focus();
        }
        if (isNotifOpen) {
          setIsNotifOpen(false);
          notifTriggerRef.current?.focus();
        }
      }
    };

    const handleRouteChange = () => {
      setIsProfileOpen(false);
      setIsNotifOpen(false);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, [isProfileOpen, isNotifOpen]);

  const toggleProfileMenu = () => {
    if (!isProfileOpen) {
      updateMenuPosition();
      setIsProfileOpen(true);
      setIsNotifOpen(false);
    } else {
      setIsProfileOpen(false);
    }
  };

  const toggleNotifMenu = () => {
    if (!isNotifOpen) {
      updateNotifPosition();
      setIsNotifOpen(true);
      setIsProfileOpen(false);
    } else {
      setIsNotifOpen(false);
    }
  };

  const unreadCount = notifList.filter(n => n.unread).length;

  const markAllRead = () => {
    setNotifList(notifList.map(n => ({ ...n, unread: false })));
  };

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    currentUser.fullName = fullNameInput.trim();
    currentUser.email = emailInput.trim();
    currentUser.phone = phoneInput.trim();
    if (avatarInput) {
      currentUser.avatarUrl = avatarInput;
    }
    try {
      localStorage.setItem('kohot_current_user', JSON.stringify(currentUser));
    } catch {
      // ignore
    }
    if (currentSet && onUpdateSet) {
      onUpdateSet({
        ...currentSet,
        classRepName: fullNameInput.trim(),
        classRepEmail: emailInput.trim(),
        classRepPhone: phoneInput.trim(),
      });
    }
    // Instantly notify whole application of updated user name/profile
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('kohot_user_profile_updated', {
          detail: {
            fullName: fullNameInput.trim(),
            email: emailInput.trim(),
            phone: phoneInput.trim(),
            avatarUrl: avatarInput,
          },
        })
      );
    }
    setSettingsSaved(true);
    setTimeout(() => {
      setSettingsSaved(false);
      setIsSettingsModalOpen(false);
    }, 1200);
  };

  // Find admin's student profile in currentSet
  const currentAdminStudent = currentSet?.students.find(
    (s) => s.email?.toLowerCase() === currentUser.email?.toLowerCase() ||
           s.fullName?.toLowerCase() === currentUser.fullName?.toLowerCase()
  );

  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 shrink-0 relative ${className}`}>
      {/* 1. NOTIFICATION BELL (WHEN ENABLED) */}
      {showNotifications && (
        <div className="relative">
          <button
            ref={notifTriggerRef}
            id="profile-notifications-btn"
            type="button"
            onClick={toggleNotifMenu}
            aria-expanded={isNotifOpen}
            aria-haspopup="true"
            aria-label="View notifications"
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 flex items-center justify-center transition-colors relative cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            title="KoHot Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#18181b] animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* 2. PROFILE AVATAR TRIGGER BUTTON */}
      <button
        ref={profileTriggerRef}
        id="profile-menu-btn"
        type="button"
        onClick={toggleProfileMenu}
        aria-expanded={isProfileOpen}
        aria-haspopup="true"
        aria-label="Account profile menu"
        className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-white transition-all cursor-pointer group active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center font-mono-tech text-xs font-bold text-white shadow-inner shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
          {effectiveAvatar ? (
            <img src={effectiveAvatar} alt={currentUser.fullName} className="w-full h-full object-cover" />
          ) : (
            <span>{currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}</span>
          )}
        </div>
        <span className="hidden sm:inline font-mono-tech text-xs text-zinc-200 group-hover:text-white max-w-[100px] truncate">
          {currentUser.fullName ? currentUser.fullName.split(' ')[0] : 'User'}
        </span>
      </button>

      {/* 3. CENTERED NOTIFICATIONS POP-UP WINDOW */}
      {isNotifOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-modal-title"
          className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn select-none"
          onClick={() => setIsNotifOpen(false)}
        >
          <div
            ref={notifRef}
            className="relative w-full max-w-md rounded-3xl bg-[#18181b] border border-white/15 p-6 shadow-2xl flex flex-col space-y-4 text-[#e2e4e9] max-h-[85vh] select-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pop-up Window Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#d4af37] flex items-center justify-center shrink-0 shadow-xs">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="notifications-modal-title" className="font-syne font-bold text-base sm:text-lg text-white">
                    Notifications &amp; Alerts
                  </h3>
                  <p className="font-mono-tech text-[11px] text-zinc-400">
                    {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-xs font-mono-tech transition-colors cursor-pointer border border-white/10"
                  >
                    Mark read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
                  aria-label="Close notifications pop-up"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Cards List */}
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 max-h-[50vh]">
              {notifList.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 font-mono-tech text-xs">
                  No notifications at this time.
                </div>
              ) : (
                notifList.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      n.unread
                        ? 'bg-white/[0.06] border-amber-500/30 text-white shadow-sm'
                        : 'bg-white/[0.02] border-white/5 text-zinc-300 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-syne font-semibold text-xs text-white">
                        {n.title}
                      </span>
                      <span className="text-[10px] font-mono-tech text-zinc-400 shrink-0">
                        {n.time}
                      </span>
                    </div>
                    <p className="font-body text-xs text-zinc-300 mt-1 leading-relaxed">
                      {n.description}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono-tech text-zinc-500 shrink-0">
              <span>KoHot System Alerts</span>
              <span>Class Album Engine</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 4. PORTAL-MOUNTED PROFILE DROPDOWN MENU - Sleek & Fully Displayed */}
      {isProfileOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuCoords.top,
            bottom: menuCoords.bottom,
            right: menuCoords.right,
            zIndex: 50,
          }}
          className="w-[calc(100vw-24px)] sm:w-[205px] rounded-2xl bg-gradient-to-b from-[#18181b] to-[#121214] border border-white/15 shadow-2xl p-1.5 animate-fadeIn text-[#e2e4e9] flex flex-col"
        >
          {/* User Header - Compact */}
          <div className="px-2 py-1.5 border-b border-white/10 mb-1 shrink-0">
            <div className="font-syne font-bold text-xs text-white truncate">
              {currentUser.fullName}
            </div>
            <div className="font-mono-tech text-[10px] text-zinc-400 truncate">
              {currentUser.email}
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-mono-tech uppercase bg-white/10 text-white border border-white/15 font-semibold">
              <ShieldCheck className="w-2.5 h-2.5 text-[#d4af37]" />
              <span className="truncate">{roleTitle}</span>
            </div>
          </div>

          {/* Menu Items - All Displayed Directly */}
          <div className="space-y-0.5 pr-0.5">
            {/* Admin Management: Only Transfer Admin (Admin History is inside Transfer Admin modal) */}
            {isAdmin && currentSet && (
              <div className="p-0.5 mb-0.5 rounded-lg bg-white/[0.04] border border-white/10 space-y-0.5">
                {/* Transfer Admin */}
                <button
                  id="profile-menu-transfer-admin"
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setClassAdminInitialTab('transfer_admin');
                    setIsClassAdminOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md hover:bg-white/10 text-[11px] font-mono-tech text-amber-300 hover:text-amber-200 flex items-center gap-2 transition-colors text-left cursor-pointer active:bg-white/15"
                  title="Transfer administration to classmate or via link"
                >
                  <ArrowRightLeft className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Transfer Admin</span>
                </button>

                {/* Invite Other Departments */}
                <button
                  id="profile-menu-invite-departments"
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsInviteDepartmentsOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md hover:bg-white/10 text-[11px] font-mono-tech text-emerald-300 hover:text-emerald-200 flex items-center gap-2 transition-colors text-left cursor-pointer active:bg-white/15"
                  title="Invite graduating class representatives of other departments to create their albums"
                >
                  <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">Invite Classes</span>
                </button>
              </div>
            )}

            {/* My Profile */}
            <button
              id="profile-menu-my-profile"
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                setIsMyProfileModalOpen(true);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white flex items-center gap-2.5 transition-colors text-left cursor-pointer active:bg-white/15"
            >
              <User className="w-4 h-4 text-zinc-400" />
              <span>My Profile</span>
            </button>

            {/* Account Settings */}
            <button
              id="profile-menu-account-settings"
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                setIsSettingsModalOpen(true);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white flex items-center gap-2.5 transition-colors text-left cursor-pointer active:bg-white/15"
            >
              <Settings className="w-4 h-4 text-zinc-400" />
              <span>Account Settings</span>
            </button>

            {/* 4. Add to Home Screen */}
            <button
              id="profile-menu-add-to-home-screen"
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                handleTriggerInstall();
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white flex items-center justify-between transition-colors text-left cursor-pointer active:bg-white/15"
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-zinc-400" />
                <span>Add to Home Screen</span>
              </div>
              {isInstalled && (
                <span className="text-[10px] text-emerald-400 font-mono-tech uppercase font-semibold">
                  ✓ Added
                </span>
              )}
            </button>

            {/* 5. Help */}
            <button
              id="profile-menu-help"
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                setIsHelpOpen(true);
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs font-mono-tech text-zinc-300 hover:text-white flex items-center gap-2.5 transition-colors text-left cursor-pointer active:bg-white/15"
            >
              <HelpCircle className="w-4 h-4 text-zinc-400" />
              <span>Help &amp; FAQ</span>
            </button>

            <div className="my-1 border-t border-white/10" />

            {/* 6. Sign Out */}
            <button
              id="profile-menu-sign-out"
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                onLogout();
              }}
              className="w-full px-3 py-2 rounded-xl hover:bg-red-500/15 text-xs font-mono-tech text-red-400 hover:text-red-300 flex items-center gap-2.5 transition-colors text-left cursor-pointer active:bg-red-500/20"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ACCOUNT SETTINGS MODAL */}
      <UniversalModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Account Settings"
        subtitle="Manage your profile information and credentials"
        maxWidth="md"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-mono-tech">
          {/* Portrait Photo Upload */}
          <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-[#d4af37]/40 flex items-center justify-center font-bold text-lg text-white overflow-hidden shadow-md shrink-0">
              {avatarInput || effectiveAvatar ? (
                <img src={avatarInput || effectiveAvatar} alt="Portrait" className="w-full h-full object-cover" />
              ) : (
                <span>{fullNameInput ? fullNameInput.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <span className="font-syne font-bold text-xs text-white block">Account Portrait</span>
              <p className="font-mono-tech text-[10px] text-zinc-400">Upload and crop portrait photo for your account profile</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => settingsPhotoInputRef.current?.click()}
                  className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
                >
                  <Upload className="w-3 h-3 text-[#d4af37]" />
                  <span>{avatarInput || effectiveAvatar ? 'Change Portrait' : 'Upload Portrait'}</span>
                </button>
                {(avatarInput || effectiveAvatar) && (
                  <button
                    type="button"
                    onClick={() => {
                      const imgToCrop = avatarInput || effectiveAvatar;
                      if (triggerCropForImage) {
                        triggerCropForImage(imgToCrop, '1:1', 'Crop Account Portrait', (cropped) => {
                          setAvatarInput(cropped);
                        });
                      } else {
                        setInternalCropImage(imgToCrop);
                        setInternalCropOpen(true);
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 font-mono-tech text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Crop className="w-3 h-3 text-amber-400" />
                    <span>Crop</span>
                  </button>
                )}
              </div>
            </div>
            <input
              ref={settingsPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    if (triggerCropForImage) {
                      triggerCropForImage(dataUrl, '1:1', 'Crop Account Portrait', (cropped) => {
                        setAvatarInput(cropped);
                      });
                    } else {
                      setInternalCropImage(dataUrl);
                      setInternalCropOpen(true);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
              Full Legal Name
            </label>
            <input
              type="text"
              value={fullNameInput}
              onChange={(e) => setFullNameInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white focus:border-white/30 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white focus:border-white/30 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
              WhatsApp / Mobile Phone
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white focus:border-white/30 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div className="text-zinc-500 text-[11px]">
              {settingsSaved ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved successfully
                </span>
              ) : (
                'Syncs across all class devices'
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-white text-black font-syne font-bold hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </UniversalModal>

      {/* ADD TO HOME SCREEN MANUAL INSTRUCTIONS MODAL */}
      <UniversalModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        title="Add KoHot to Home Screen"
        subtitle="Instant offline access with zero app store download"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="font-body text-xs text-zinc-300 leading-relaxed">
            Install KoHot on your phone or tablet for fast, full-screen access to your class album, directory, and legacy wall.
          </p>

          <div className="space-y-3 font-mono-tech text-xs">
            <div className="p-3.5 rounded-2xl bg-[#08090e] border border-white/10 space-y-1.5">
              <span className="font-bold uppercase text-[11px] block text-[#d4af37]">
                iPhone &amp; iPad (Safari)
              </span>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px]">
                <li>Tap the <strong>Share</strong> icon (square with arrow) at the bottom of Safari.</li>
                <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> in the top-right corner to finish.</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#08090e] border border-white/10 space-y-1.5">
              <span className="font-bold uppercase text-[11px] block text-[#d4af37]">
                Android (Chrome)
              </span>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px]">
                <li>Tap the <strong>three dots (⋮)</strong> menu in Chrome.</li>
                <li>Select <strong>Add to Home screen</strong> or <strong>Install App</strong>.</li>
                <li>Confirm to install KoHot directly on your device.</li>
              </ol>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsInstallModalOpen(false)}
              className="px-6 py-2.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      </UniversalModal>

      {/* CLASS ADMIN MODAL (AUTHORITY FUNCTIONS ONLY: My Class Profile, Transfer Admin, Admin History) */}
      {isAdmin && currentSet && (
        <>
          <ClassAdminModal
            isOpen={isClassAdminOpen}
            onClose={() => setIsClassAdminOpen(false)}
            currentUser={currentUser}
            currentSet={currentSet}
            initialTab={classAdminInitialTab}
            onUpdateSet={onUpdateSet || (() => {})}
            onAdminTransferred={onAdminTransferred}
            triggerCropForImage={triggerCropForImage}
          />

          <InviteOtherDepartmentsModal
            isOpen={isInviteDepartmentsOpen}
            onClose={() => setIsInviteDepartmentsOpen(false)}
            currentSet={currentSet}
            currentUser={currentUser}
          />
        </>
      )}

      {/* HELP MODAL */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* MY PROFILE MODAL: ONLY DISPLAYS PHOTO, NAME, ROLE, EMAIL, AND WHATSAPP/MOBILE PHONE */}
      {isMyProfileModalOpen && (
        <UniversalModal
          isOpen={isMyProfileModalOpen}
          onClose={() => setIsMyProfileModalOpen(false)}
          title="My Profile"
          subtitle="Account Profile Details"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs font-mono-tech">
            <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-white/[0.03] border border-white/10 gap-3">
              <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-[#d4af37]/40 flex items-center justify-center font-bold text-2xl text-white overflow-hidden shadow-lg shrink-0">
                {effectiveAvatar ? (
                  <img src={effectiveAvatar} alt={currentUser.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-syne font-bold text-lg text-white">
                  {currentUser.fullName || currentSet?.classRepName || 'User'}
                </div>
                <div className="text-zinc-400 text-xs mt-0.5">
                  {currentUser.email || currentSet?.classRepEmail || 'Not configured'}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono-tech uppercase bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 font-semibold mt-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>{roleTitle}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 space-y-2.5">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-zinc-400">Role</span>
                <span className="text-white font-medium">{roleTitle}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-zinc-400">Email</span>
                <span className="text-white select-all">{currentUser.email || currentSet?.classRepEmail || 'Not configured'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400">WhatsApp / Mobile Phone</span>
                <span className="text-white select-all">{currentUser.phone || currentSet?.classRepPhone || 'Not configured'}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMyProfileModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-white text-black font-syne font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shadow"
              >
                Close
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {/* Internal Portrait Crop Modal */}
      {internalCropOpen && (
        <ImageCropModal
          isOpen={internalCropOpen}
          onClose={() => setInternalCropOpen(false)}
          imageSrc={internalCropImage}
          initialAspectRatio="1:1"
          title="Crop Account Portrait"
          onApplyCrop={(cropped) => {
            setAvatarInput(cropped);
            setInternalCropOpen(false);
          }}
        />
      )}
    </div>
  );
};
