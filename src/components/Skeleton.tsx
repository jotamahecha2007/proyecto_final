import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type DimensionValue, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/lib/theme';

/**
 * Bloque gris que "respira" mientras carga el contenido. Se ve más rápido y ordenado
 * que una ruedita, porque anticipa la forma de lo que va a aparecer.
 * Con "reducir movimiento" activo, el bloque queda quieto.
 */
export function SkeletonBlock({ width = '100%', height = 14, style }: { width?: DimensionValue; height?: number; style?: ViewStyle }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.55)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius.sm, backgroundColor: t.surfaceAlt, opacity: reduceMotion ? 0.8 : pulse }, style]}
    />
  );
}

/** Tarjeta de esqueleto con la forma de una tarjeta de prestador o servicio. */
export function SkeletonCard({ lines = 3, avatar = false }: { lines?: number; avatar?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {avatar && <SkeletonBlock width={44} height={44} style={{ borderRadius: 22 }} />}
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock width="60%" height={18} />
          <SkeletonBlock width="35%" height={12} />
        </View>
      </View>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} width={i === lines - 1 ? '70%' : '100%'} />
      ))}
    </View>
  );
}

/** Lista de esqueletos, anunciada como "Cargando" para lectores de pantalla. */
export function SkeletonList({ count = 3, lines, avatar }: { count?: number; lines?: number; avatar?: boolean }) {
  return (
    <View style={{ gap: spacing.md }} accessible accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={lines} avatar={avatar} />
      ))}
    </View>
  );
}

/** Pantalla completa de carga con esqueletos (para pantallas de detalle). */
export function SkeletonScreen({ count = 2 }: { count?: number }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: spacing.lg, gap: spacing.lg }}>
      <SkeletonBlock width="55%" height={28} />
      <SkeletonList count={count} lines={3} />
    </View>
  );
}
