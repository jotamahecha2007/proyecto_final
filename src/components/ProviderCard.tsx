import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, StatusBadge, Stars, styles } from '@/components/ui';
import { formatKm } from '@/lib/geo';
import { fonts, spacing, useTheme } from '@/lib/theme';
import { trustLabel } from '@/lib/trustScore';
import type { MatchReason } from '@/lib/matching';
import type { ProviderProfile } from '@/lib/types';

export function TrustBadge({ score }: { score: number }) {
  const label = trustLabel(score);
  const tone = label === 'Alta' ? 'success' : label === 'Media' ? 'info' : 'neutral';
  return <StatusBadge label={`Confianza ${label.toLowerCase()} · ${score}/100`} tone={tone} icon="shield-checkmark-outline" />;
}

export function ProviderCard({
  provider,
  rank,
  distanceKm,
  travelMinutes,
  available,
  reasons,
  footer,
}: {
  provider: ProviderProfile;
  rank?: number;
  distanceKm?: number;
  travelMinutes?: number;
  available?: boolean;
  reasons?: MatchReason[];
  footer?: ReactNode;
}) {
  const t = useTheme();
  const avg = provider.stats.ratingCount ? provider.stats.ratingSum / provider.stats.ratingCount : 0;
  return (
    <Card>
      <Pressable
        onPress={() => router.push(`/provider/${provider.uid}`)}
        accessibilityRole="link"
        accessibilityLabel={`Ver perfil de ${provider.name}`}
        style={{ gap: spacing.sm }}
      >
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <AppText variant="heading" style={{ flex: 1 }}>
            {rank ? `${rank}. ` : ''}
            {provider.name}
          </AppText>
          <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
        </View>
        <TrustBadge score={provider.trustScore} />
        <View style={styles.row}>
          {provider.stats.ratingCount > 0 ? (
            <>
              <Stars value={avg} />
              <AppText variant="small">
                {avg.toFixed(1)} ({provider.stats.ratingCount} reseñas)
              </AppText>
            </>
          ) : (
            <AppText variant="small">Sin reseñas todavía</AppText>
          )}
          <AppText variant="small">· {provider.stats.completedJobs} trabajos</AppText>
        </View>
        {distanceKm !== undefined && !reasons && (
          <AppText variant="muted">
            A {formatKm(distanceKm)}
            {travelMinutes ? ` · llega en ~${travelMinutes} min` : ''}
          </AppText>
        )}
        {available === false && (
          <StatusBadge label="Sin horario libre ese día" tone="warning" icon="time-outline" />
        )}
      </Pressable>
      {reasons && reasons.length > 0 && <WhyRecommended reasons={reasons} />}
      {footer}
    </Card>
  );
}

/** "¿Por qué te lo recomendamos?": muestra el puntaje del matching en palabras. */
function WhyRecommended({ reasons }: { reasons: MatchReason[] }) {
  const t = useTheme();
  return (
    <View
      style={{ gap: 6, padding: spacing.md, borderRadius: 12, backgroundColor: t.surfaceAlt }}
      accessible
      accessibilityLabel={`Por qué te lo recomendamos: ${reasons.map((r) => (r.main ? `${r.text}, lo que más pesó` : r.text)).join('. ')}`}
    >
      <AppText variant="label">¿Por qué te lo recomendamos?</AppText>
      {reasons.map((r) => (
        <View key={r.text} style={[styles.row, { alignItems: 'flex-start' }]}>
          <Ionicons name={r.icon} size={18} color={r.main ? t.primary : t.textMuted} style={{ marginTop: 2 }} />
          <AppText variant={r.main ? 'body' : 'muted'} style={{ flex: 1, fontFamily: r.main ? fonts.semibold : fonts.regular }}>
            {r.text}
            {r.main ? ' · lo que más pesó' : ''}
          </AppText>
        </View>
      ))}
    </View>
  );
}
