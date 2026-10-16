import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bookmark, 
  Calendar, 
  Smartphone, 
  Share, 
  PlusSquare, 
  ExternalLink, 
  Check, 
  Copy, 
  X,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { ClassSet } from '../../types';
import { getAlbumUrl } from '../../utils/urlHelper';
import { 
  generateGoogleCalendarUrl, 
  downloadIcsCalendarFile 
} from '../../utils/calendarHelper';

class SheetErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.error('KeepAlbumSheet error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-sm font-mono-tech text-zinc-400">
          Something went wrong. Please try again.
        </div>
      );
    }
    return this.props.children;
  }
}

interface KeepAlbumSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet: ClassSet;
  isLightMode?: boolean;
}

export const KeepAlbumSheet: React.FC<KeepAlbumSheetProps> = ({
  isOpen,
  onClose,
  currentSet,
  isLightMode = false,
}) => {
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
  const [showInAppBrowserSheet, setShowInAppBrowserSheet] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // PWA install state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running standalone
    const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const navStandalone = (navigator as any).standalone === true;
    const standaloneActive = standaloneMedia || navStandalone;
    setIsStandalone(standaloneActive);

    // Detect browser / platform
    const ua = navigator.userAgent || '';
    const inApp = /FBAN|FBAV|Instagram|WhatsApp|TikTok|MicroMessenger/i.test(ua);
    setIsInAppBrowser(inApp);

    const isIos = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    setIsIosSafari(isIos && isSafari && !inApp);
    setIsAndroidDevice(/android/i.test(ua));

    // Capture beforeinstallprompt for Android Chrome / Edge / Samsung Internet
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const safeSetId = currentSet?.id || '';
  const albumUrl = safeSetId ? getAlbumUrl(safeSetId) : (typeof window !== 'undefined' ? window.location.href : '');
  const calendarParams = {
    departmentName: currentSet?.departmentName || 'Class',
    graduationYear: currentSet?.graduationYear || new Date().getFullYear(),
    convocationDate: currentSet?.convocationDate || currentSet?.reminderSettings?.convocationDate,
    albumUrl,
  };

  const handleGoogleCalendar = () => {
    try {
      const url = generateGoogleCalendarUrl(calendarParams);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Google Calendar error:', e);
    }
    setShowCalendarOptions(false);
    onClose();
  };

  const handleIcsCalendar = () => {
    try {
      downloadIcsCalendarFile(calendarParams);
    } catch (e) {
      console.warn('ICS Calendar error:', e);
    }
    setShowCalendarOptions(false);
    onClose();
  };

  const handleAddToHomeScreen = async () => {
    if (isInAppBrowser) {
      setShowInAppBrowserSheet(true);
      return;
    }

    if (isIosSafari) {
      setShowIosInstructions(true);
      return;
    }

    if (installPrompt) {
      try {
        installPrompt.prompt();
        const choiceResult = await installPrompt.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          setIsStandalone(true);
        }
        setInstallPrompt(null);
        onClose();
      } catch {
        if (isAndroidDevice) {
          setShowAndroidInstructions(true);
        } else {
          setShowIosInstructions(true);
        }
      }
    } else {
      // Fallback manual instructions based on device
      if (isAndroidDevice) {
        setShowAndroidInstructions(true);
      } else {
        setShowIosInstructions(true);
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(albumUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const sheetElement = (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Bottom Sheet Container */}
      <div 
        className={`relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 z-10 min-h-[280px] ${
          isLightMode 
            ? 'bg-white border-zinc-200 text-slate-900' 
            : 'bg-[#121318] border-white/15 text-white'
        }`}
      >
        <SheetErrorBoundary>
        {/* Mobile Drag Indicator Bar */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-500/40" />
        </div>

        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isLightMode ? 'border-zinc-100 bg-zinc-50/50' : 'border-white/10 bg-white/[0.02]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center shrink-0">
              <Bookmark className="w-4 h-4 text-[#d4af37]" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-base sm:text-lg tracking-tight">
                Keep this album
              </h2>
              <p className="text-[11px] font-mono-tech text-zinc-400">
                {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rows Body */}
        <div className="p-4 sm:p-6 space-y-3">
          {/* Row 1: Remind me yearly */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCalendarOptions(!showCalendarOptions)}
              className={`w-full min-h-[52px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between gap-3.5 transition-all cursor-pointer ${
                isLightMode 
                  ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 active:scale-[0.99]' 
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 active:scale-[0.99]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="font-syne font-bold text-sm tracking-wide">
                    Remind me yearly
                  </div>
                  <div className="text-xs text-zinc-400 font-mono-tech mt-0.5">
                    A calendar event with the album link
                  </div>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${showCalendarOptions ? 'rotate-90' : ''}`} />
            </button>

            {/* Calendar Options sub-menu */}
            {showCalendarOptions && (
              <div className={`p-3 rounded-2xl border space-y-2 animate-fadeIn ${
                isLightMode ? 'bg-zinc-100/70 border-zinc-200' : 'bg-black/40 border-white/10'
              }`}>
                <div className="text-[11px] font-mono-tech text-zinc-400 px-2 pt-1 uppercase tracking-wider">
                  Choose your calendar:
                </div>

                {/* Google Calendar Option */}
                <button
                  type="button"
                  onClick={handleGoogleCalendar}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs font-mono-tech font-semibold transition-all cursor-pointer ${
                    isLightMode
                      ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-900 shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Google Calendar
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {/* Apple / Other Calendar (.ics) Option */}
                <button
                  type="button"
                  onClick={handleIcsCalendar}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs font-mono-tech font-semibold transition-all cursor-pointer ${
                    isLightMode
                      ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-900 shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    Apple / other calendar (.ics)
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">
                    Download
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Row 2: Add to home screen (hidden when already standalone) */}
          {!isStandalone && (
            <button
              type="button"
              onClick={handleAddToHomeScreen}
              className={`w-full min-h-[52px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between gap-3.5 transition-all cursor-pointer ${
                isLightMode 
                  ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 active:scale-[0.99]' 
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 active:scale-[0.99]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/25 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <div className="font-syne font-bold text-sm tracking-wide">
                    Add to home screen
                  </div>
                  <div className="text-xs text-zinc-400 font-mono-tech mt-0.5">
                    Open it like an app
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Footer Note */}
        <div className={`px-6 py-3 border-t text-center text-[11px] font-mono-tech text-zinc-500 ${
          isLightMode ? 'border-zinc-100 bg-zinc-50/50' : 'border-white/5 bg-black/20'
        }`}>
          No sign-in required • No personal data stored
        </div>
        </SheetErrorBoundary>
      </div>

      {/* Android Chrome Helper Modal Sheet */}
      {showAndroidInstructions && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#121318] border border-white/20 p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="font-syne font-bold text-base">Add to Home Screen</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidInstructions(false)}
                className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Illustration */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                  <MoreVertical className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono-tech">
                  <span className="text-white font-bold">1.</span> Tap the browser menu (<span className="text-blue-400 font-semibold">⋮</span>) in the top-right corner
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono-tech">
                  <span className="text-white font-bold">2.</span> Tap <span className="text-amber-300 font-semibold">Add to Home screen</span> or <span className="text-amber-300 font-semibold">Install app</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAndroidInstructions(false);
                onClose();
              }}
              className="w-full py-2.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* iPhone Safari Helper Modal Sheet */}
      {showIosInstructions && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#121318] border border-white/20 p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="font-syne font-bold text-base">Add to Home Screen</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosInstructions(false)}
                className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Illustration */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                  <Share className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono-tech">
                  <span className="text-white font-bold">1.</span> Tap the <span className="text-blue-400 font-semibold">Share</span> icon in Safari's toolbar below
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono-tech">
                  <span className="text-white font-bold">2.</span> Scroll down and tap <span className="text-amber-300 font-semibold">Add to Home Screen</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIosInstructions(false);
                onClose();
              }}
              className="w-full py-2.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* In-App Browser Helper Sheet */}
      {showInAppBrowserSheet && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#121318] border border-white/20 p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-amber-400" />
                <h3 className="font-syne font-bold text-base">Open in Safari or Chrome</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInAppBrowserSheet(false)}
                className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 font-mono-tech leading-relaxed">
              In-app browsers don't support adding to home screen. Open this link in your standard browser (Safari or Chrome) to add it as an app.
            </p>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 rounded-full bg-amber-400 text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-amber-300 transition-colors flex items-center justify-center gap-2"
            >
              {copiedLink ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Album Link'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(sheetElement, document.body);
  }
  return sheetElement;
};
