import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { AppText } from '@/components/ui';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';

type Icon = ComponentProps<typeof Ionicons>['name'];

function Tag({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: t.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
      <Text style={{ color: t.primary, fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

/**
 * Encabezado de bienvenida: panel azul claro con etiquetas en píldora, título en serif
 * itálica y una fila de beneficios con íconos (estilo inspirado en la referencia).
 */
export function BrandHeader({ subtitle = 'Lo que necesites, a un click.' }: { subtitle?: string }) {
  const t = useTheme();
  const perks: { icon: Icon; text: string }[] = [
    { icon: 'shield-checkmark-outline', text: 'Confianza' },
    { icon: 'location-outline', text: 'Cerca de ti' },
    { icon: 'pricetag-outline', text: 'Precio claro' },
  ];
  return (
    <View style={{ backgroundColor: t.surfaceAlt, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Tag label="SERVICIOS PARA EL HOGAR" />
        <Tag label="BOGOTÁ" />
      </View>
      <AppText variant="title" style={{ fontSize: 40, lineHeight: 48, color: t.primary }}>
        TeAyudo
      </AppText>
      <AppText style={{ color: t.text, fontSize: 17, lineHeight: 24 }}>{subtitle}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs }}>
        {perks.map((p) => (
          <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={p.icon} size={18} color={t.primary} />
            <AppText variant="label" style={{ color: t.primary }}>
              {p.text}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
