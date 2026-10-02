export type ThemeMode = 'light' | 'dark' | 'system';

export const theme = {
  light: {
    bg: '#ffffff',
    surface: '#f8fafc',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    primary: '#2563eb',
    border: '#e2e8f0',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  dark: {
    bg: '#0f172a',
    surface: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#cbd5e1',
    primary: '#60a5fa',
    border: '#334155',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
  },
} as const;

export function getTheme(mode: ThemeMode = 'system'): (typeof theme)[keyof typeof theme] {
  if (mode === 'dark') return theme.dark;
  if (mode === 'light') return theme.light;
  return theme.dark;
}