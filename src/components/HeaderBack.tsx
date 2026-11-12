import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler, Platform, Pressable } from 'react-native';

import { MIN_TOUCH, useTheme } from '@/lib/theme';

/**
 * Volver de forma segura:
 * - si hay una pantalla anterior, vuelve a ella;
 * - si no (se llegó desde una notificación, un enlace o tras reemplazar la pantalla),
 *   lleva al inicio, que redirige a la pestaña principal del rol (cliente, prestador o admin).
 */
export function goBackSafe() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Hace que el botón físico «atrás» de Android se comporte igual que la flecha del encabezado:
 * en una pantalla interna sin pantalla anterior, lleva al inicio en vez de cerrar la app.
 * En las pestañas principales y en inicio de sesión mantiene el comportamiento normal.
 * Se monta una sola vez en el layout raíz.
 */
export function useSafeHardwareBack() {
  const segments = useSegments();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      const first = segments[0] as string | undefined;
      const isRoot = !first || first === 'index' || first.startsWith('(') || first === 'onboarding';
      if (isRoot) return false;
      router.replace('/');
      return true;
    });
    return () => sub.remove();
  }, [segments]);
}

/**
 * Bloquea el botón físico «atrás» (p. ej. en «acepta la nueva política»: no se puede
 * saltar el paso volviendo atrás).
 */
export function useBlockHardwareBack() {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );
}

/**
 * Botón del encabezado. Lo pone automáticamente el Stack raíz en todas las pantallas
 * internas, así que una pantalla nueva lo tiene sin escribir nada. En modales es una «X».
 */
export function HeaderBack({ modal = false }: { modal?: boolean }) {
  const t = useTheme();
  const canGoBack = router.canGoBack();
  const icon = modal ? 'close' : Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back';
  const label = modal ? 'Cerrar' : canGoBack ? 'Volver' : 'Volver al inicio';
  return (
    <Pressable
      onPress={goBackSafe}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        marginLeft: Platform.OS === 'web' ? 8 : -8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: MIN_TOUCH / 2,
        backgroundColor: pressed ? t.surfaceAlt : 'transparent',
      })}
    >
      <Ionicons name={icon} size={modal ? 26 : 24} color={t.text} />
    </Pressable>
  );
}
