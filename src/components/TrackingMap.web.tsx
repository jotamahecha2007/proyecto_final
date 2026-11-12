import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { GeoPoint } from '@/lib/types';

/** En web no hay mapa nativo: se muestra un resumen (la app real es para celular). */
export function TrackingMap({ providerName }: { provider: GeoPoint; destination: GeoPoint; providerName: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 140, borderRadius: radius.lg, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
      <Ionicons name="map-outline" size={32} color={t.primary} />
      <AppText variant="muted">El mapa de {providerName} se ve en la app del celular.</AppText>
    </View>
  );
}
