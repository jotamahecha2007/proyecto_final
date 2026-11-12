import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SkeletonScreen } from '@/components/Skeleton';
import { TrustBadge } from '@/components/ProviderCard';
import { AppText, Button, Card, EmptyState, Loading, Screen, Stars, StatusBadge, styles } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { DAY_NAMES, minutesToLabel } from '@/lib/schedule';
import { formatCOP, useTheme } from '@/lib/theme';
import { computeTrust, TRUST_WEIGHTS } from '@/lib/trustScore';
import { CATEGORY_LABELS, type ProviderProfile, type Review } from '@/lib/types';
import { subscribeProvider, subscribeReviewsFor } from '@/services/providers';

function Bar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const t = useTheme();
  const pct = Math.round(value * 100);
  return (
    <View style={{ gap: 4 }} accessible accessibilityLabel={`${label}: ${pct} de 100, pesa ${weight * 100} por ciento`}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <AppText variant="small">
          {label} (pesa {weight * 100}%)
        </AppText>
        <AppText variant="small">{pct}/100</AppText>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surfaceAlt }}>
        <View style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: t.primary }} />
      </View>
    </View>
  );
}

export default function ProviderPublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: viewer } = useSession();
  const [p, setP] = useState<ProviderProfile | null | undefined>();
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => subscribeProvider(id, setP), [id]);
  useEffect(() => subscribeReviewsFor(id, setReviews), [id]);

  if (p === undefined) return <SkeletonScreen count={3} />;
  if (p === null) return <Screen><EmptyState icon="person-outline" text="Este perfil no existe." /></Screen>;

  // Desglose del Trust Score para que el cliente entienda de dónde sale el número.
  const breakdown = computeTrust({
    ...p.stats,
    profile: {
      hasBio: p.bio.trim().length >= 30,
      hasPhoto: !!p.photoURL,
      hasSchedule: p.schedule.some(Boolean),
      hasCategories: p.categories.length > 0,
      identityDeclared: p.identityDeclared || !!p.identityVerified,
    },
  });
  const avg = p.stats.ratingCount ? p.stats.ratingSum / p.stats.ratingCount : 0;

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <AppText variant="title">{p.name}</AppText>
        <TrustBadge score={p.trustScore} />
        {p.identityVerified ? (
          <StatusBadge label="Identidad verificada por TeAyudo" tone="success" icon="shield-checkmark" />
        ) : p.identityDeclared ? (
          <StatusBadge label="Datos de identidad declarados (sin verificar)" tone="neutral" icon="id-card-outline" />
        ) : null}
      </View>
      <AppText>{p.bio || 'Sin descripción.'}</AppText>
      <Card>
        <AppText variant="label">Servicios</AppText>
        <AppText>{p.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')}</AppText>
        <AppText variant="muted">
          {formatCOP(p.hourlyRate)} por hora · atiende hasta {p.serviceRadiusKm} km
        </AppText>
      </Card>

      <Card>
        <AppText variant="label">¿Por qué este nivel de confianza?</AppText>
        <Bar label="Calificaciones" value={breakdown.rating} weight={TRUST_WEIGHTS.rating} />
        <Bar label="Cumplimiento (no cancela)" value={breakdown.reliability} weight={TRUST_WEIGHTS.reliability} />
        <Bar label="Experiencia en TeAyudo" value={breakdown.experience} weight={TRUST_WEIGHTS.experience} />
        <Bar label="Perfil completo" value={breakdown.profile} weight={TRUST_WEIGHTS.profile} />
        <AppText variant="small">
          {p.stats.completedJobs} trabajos terminados · {p.stats.cancelledJobs} cancelados por el prestador
        </AppText>
      </Card>

      <Card>
        <AppText variant="label">Horario</AppText>
        {p.schedule.map((d, i) => (
          <View key={i} style={[styles.row, { justifyContent: 'space-between' }]}>
            <AppText>{DAY_NAMES[i]}</AppText>
            <AppText variant="muted">{d ? `${minutesToLabel(d.start)} – ${minutesToLabel(d.end)}` : 'No trabaja'}</AppText>
          </View>
        ))}
      </Card>

      <AppText variant="heading">
        Reseñas {p.stats.ratingCount > 0 ? `(${avg.toFixed(1)} de 5)` : ''}
      </AppText>
      {reviews.length === 0 ? (
        <EmptyState icon="chatbox-outline" text="Todavía no tiene reseñas." />
      ) : (
        reviews.map((r) => (
          <Card key={r.id}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <AppText variant="label">{r.authorName}</AppText>
              <Stars value={r.rating} />
            </View>
            {!!r.comment && <AppText>{r.comment}</AppText>}
          </Card>
        ))
      )}
      {viewer.uid !== p.uid && viewer.role === 'admin' && (
        <Button label="Administrar este usuario" icon="shield-outline" onPress={() => router.push(`/admin/user/${p.uid}`)} />
      )}
      {viewer.uid !== p.uid && viewer.role !== 'admin' && (
        <Button
          label={`Reportar a ${p.name.split(' ')[0]}`}
          icon="flag-outline"
          variant="ghost"
          onPress={() => router.push({ pathname: '/report', params: { targetId: p.uid, targetName: p.name, targetRole: 'provider' } })}
        />
      )}
    </Screen>
  );
}
