import React from 'react';
import { ThemeMode } from '../../utils/theme';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
  currentTheme?: ThemeMode;
  onToggleTheme?: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = () => {
  // Light mode removed permanently - return null to avoid unnecessary toggle UI
  return null;
};


