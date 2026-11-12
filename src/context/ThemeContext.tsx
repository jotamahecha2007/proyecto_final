import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ReactNode } from 'react';

import { ThemePreferenceContext, type ThemePreference } from '@/lib/theme';

const KEY = 'teayudo.themePreference';
const KEY_CONTRAST = 'teayudo.highContrast';

/** Guarda en el celular la apariencia elegida en Ajustes. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>('system');
  const [highContrast, setHC] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([KEY, KEY_CONTRAST])
      .then(([[, v], [, hc]]) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
        setHC(hc === '1');
      })
      .catch(() => {});
  }, []);

  function setPreference(p: ThemePreference) {
    setPref(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  }

  function setHighContrast(v: boolean) {
    setHC(v);
    AsyncStorage.setItem(KEY_CONTRAST, v ? '1' : '0').catch(() => {});
  }

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference, highContrast, setHighContrast }}>{children}</ThemePreferenceContext.Provider>
  );
}
