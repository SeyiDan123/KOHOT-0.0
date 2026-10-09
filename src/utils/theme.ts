export type ThemeMode = 'light' | 'dark';

/**
 * UNIFIED CLASS-BASED DARK MODE TOGGLE
 * Default state on hard refresh: LIGHT MODE.
 * Controls document.documentElement.classList.toggle('dark').
 * Persists state via localStorage.setItem('kohot_theme', 'dark' | 'light').
 */

export const getTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('kohot_theme');
    if (saved === 'dark') return 'dark';
    return 'light'; // Default is always LIGHT MODE
  } catch {
    return 'light';
  }
};

export const applyTheme = (theme: ThemeMode): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('kohot_theme', theme);
    const root = document.documentElement;
    root.classList.add('disable-transitions');
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    // Force layout reflow
    void root.offsetHeight;
    requestAnimationFrame(() => {
      root.classList.remove('disable-transitions');
    });
    window.dispatchEvent(new CustomEvent('kohot_theme_changed', { detail: { theme } }));
  } catch (e) {
    console.error('Failed to set theme in localStorage', e);
  }
};

export const toggleTheme = (current?: ThemeMode): ThemeMode => {
  const active = current || getTheme();
  const next: ThemeMode = active === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
};

// Aliases for seamless backwards compatibility
export const getAlbumTheme = getTheme;
export const setAlbumTheme = applyTheme;
export const toggleAlbumTheme = toggleTheme;

export const getDashboardTheme = getTheme;
export const setDashboardTheme = applyTheme;
export const toggleDashboardTheme = toggleTheme;

export const getInitialTheme = getTheme;
