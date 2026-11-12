import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { resolveTheme, type Theme, type ThemePreference } from './palette';

export { DARK_MAP_STYLE, resolveTheme, THEMES, type Theme, type ThemePreference } from './palette';

/** Tipografías: serif itálica para títulos (como los titulares de la universidad) y DM Sans para el resto. */
export const fonts = {
  title: 'PlayfairDisplay_600SemiBold_Italic',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
} as const;

export interface ThemeSettings {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
}

export const ThemePreferenceContext = createContext<ThemeSettings>({
  preference: 'system',
  setPreference: () => {},
  highContrast: false,
  setHighContrast: () => {},
});

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}

/** El tema actual según Ajustes y la configuración del celular. Úsalo en vez de colores fijos. */
export function useTheme(): Theme {
  const { preference, highContrast } = useContext(ThemePreferenceContext);
  const system = useColorScheme();
  return resolveTheme(preference, system === 'dark' ? 'dark' : 'light', highContrast);
}

export function useIsDark(): boolean {
  return useTheme().dark;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
/** Área mínima de toque (WCAG 2.5.8 recomienda ≥ 24 px; Android e iOS piden 44–48). */
export const MIN_TOUCH = 48;
export const radius = { sm: 8, md: 10, lg: 16 };

export function formatCOP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}, ${hh}:${mm}`;
}
