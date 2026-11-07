export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'kohot_theme_mode';
export const THEME_CHANGE_EVENT = 'kohot-theme-change';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored =
      localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('kohot_theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return 'dark';
}

export const getTheme = getStoredTheme;

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('disable-transitions');
  if (transitionTimer) {
    clearTimeout(transitionTimer);
  }
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem('kohot_theme', theme);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
    window.dispatchEvent(new CustomEvent('kohot_theme_changed', { detail: { theme } }));
  }
  // Force synchronous reflow and keep disable-transitions through React's re-render paint
  void root.offsetHeight;
  transitionTimer = setTimeout(() => {
    root.classList.remove('disable-transitions');
    transitionTimer = null;
  }, 80);
}

export function toggleTheme(current?: ThemeMode): ThemeMode {
  const base = current || getStoredTheme();
  const next: ThemeMode = base === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function initializeTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
