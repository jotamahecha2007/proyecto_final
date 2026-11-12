// Paleta de colores (sin dependencias de React Native, para poder probarla en Node).

/**
 * ÚNICA fuente de colores de la app. Las pantallas nunca escriben un color fijo: piden
 * `useTheme()` y usan estos nombres, que describen la FUNCIÓN del color, no cómo se ve.
 * Así una pantalla nueva funciona en claro, oscuro y alto contraste sin hacer nada extra,
 * y cambiar la paleta toca solo este archivo. (Una prueba automática falla si aparece un
 * color fijo en otro archivo: tests/theme.test.ts; los hooks están en theme.ts).
 *
 * Paleta inspirada en la identidad de la universidad: azul marino, azul claro y blanco.
 * Contraste mínimo 4,5:1 (WCAG AA) en todos los textos; 7:1 (AAA) en alto contraste.
 */
export interface Theme {
  /** Nombre interno del tema (para pruebas y depuración). */
  name: 'light' | 'dark' | 'light-contrast' | 'dark-contrast';
  dark: boolean;
  /** Fondo de la pantalla. */
  bg: string;
  /** Tarjetas, encabezado y barra de pestañas. */
  surface: string;
  /** Superficie destacada (chips, cajas de ayuda). */
  surfaceAlt: string;
  /** Texto principal. */
  text: string;
  /** Texto secundario (ayudas, fechas). */
  textMuted: string;
  border: string;
  /** Botones principales, enlaces, selección. */
  primary: string;
  /** Texto e íconos sobre `primary`. */
  primaryText: string;
  /** Estrellas y acentos. */
  accent: string;
  danger: string;
  /** Texto sobre un fondo `danger` (p. ej. el contador de notificaciones). */
  onDanger: string;
  success: string;
  warning: string;
  info: string;
  /** Color de las sombras. En oscuro casi no se ven, por eso se refuerza el borde. */
  shadow: string;
  shadowOpacity: number;
  /** Fondo detrás de fotos y videos mientras cargan. */
  media: string;
  /** Letras de la barra de estado del celular (hora, batería). */
  statusBar: 'light' | 'dark';
}

const light: Theme = {
  name: 'light',
  dark: false,
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#E6EEF9', // azul claro, como el botón «MENÚ»
  text: '#1A2456', // azul marino para textos
  textMuted: '#4E5878',
  border: '#D3DBE8',
  primary: '#1C3D8F',
  primaryText: '#FFFFFF',
  accent: '#995A0B', // estrellas
  danger: '#B42318',
  onDanger: '#FFFFFF',
  success: '#1B6E44',
  warning: '#7F5300',
  info: '#1F55C2',
  shadow: '#1A2456',
  shadowOpacity: 0.08,
  media: '#0B1020',
  statusBar: 'dark',
};

// Azul noche en vez de negro puro: cansa menos la vista y mantiene la identidad.
const dark: Theme = {
  name: 'dark',
  dark: true,
  bg: '#0F1733',
  surface: '#18234A',
  surfaceAlt: '#22305E',
  text: '#F1F4FB',
  textMuted: '#B6BFDA',
  border: '#34437A',
  primary: '#9DBBFF',
  primaryText: '#0F1733',
  accent: '#F2B65A',
  danger: '#FF9A90',
  onDanger: '#0F1733',
  success: '#6FD8A8',
  warning: '#F2C14E',
  info: '#9DBBFF',
  shadow: '#000000',
  shadowOpacity: 0.35,
  media: '#000000',
  statusBar: 'light',
};

/** Alto contraste: para baja visión. Textos casi negros/blancos y bordes marcados. */
const lightContrast: Theme = {
  ...light,
  name: 'light-contrast',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3FC',
  text: '#000A2E',
  textMuted: '#1F2747',
  border: '#1A2456',
  primary: '#0F2466',
  danger: '#8A1209',
  success: '#0E4F2E',
  warning: '#5C3B00',
  info: '#123C8F',
  accent: '#6E3F00',
};

const darkContrast: Theme = {
  ...dark,
  name: 'dark-contrast',
  bg: '#000000',
  surface: '#0A0F24',
  surfaceAlt: '#141C3D',
  text: '#FFFFFF',
  textMuted: '#E2E7F5',
  border: '#C9D6FF',
  primary: '#C9D9FF',
  primaryText: '#000000',
  danger: '#FFC2BC',
  onDanger: '#000000',
  success: '#A6F0CB',
  warning: '#FFE08A',
  info: '#C9D9FF',
  accent: '#FFD28A',
};

export const THEMES = { light, dark, lightContrast, darkContrast } as const;

/**
 * Estilo oscuro para el mapa de Google (Android). En iOS basta con `userInterfaceStyle`.
 * Vive aquí porque también son colores.
 */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1B2550' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#C7CFE6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F1733' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2C3A6E' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#18234A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1029' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#22305E' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1C3A3A' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#22305E' }] },
];

export type ThemePreference = 'light' | 'dark' | 'system';



/** Resuelve qué tema usar (función pura, se prueba sin React). */
export function resolveTheme(preference: ThemePreference, systemScheme: 'light' | 'dark' | null | undefined, highContrast: boolean): Theme {
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  if (highContrast) return isDark ? darkContrast : lightContrast;
  return isDark ? dark : light;
}
