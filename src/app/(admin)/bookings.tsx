import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SkeletonList } from '@/components/Skeleton';
import { AppText, Card, Chip, EmptyState, Screen, StatusBadge, styles } from '@/components/ui';
import { BOOKING_STATUS } from '@/lib/status';
import { formatCOP, formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, type Booking } from '@/lib/types';
import { subscribeAllBookings } from '@/services/admin';

type Filter = 'active' | 'completed' | 'cancelled' | 'all';
const FILTERS: { key: Filter; label: string; match: (b: Booking) => boolean }[] = [
  { key: 'active', label: 'Activos', match: (b) => ['pending', 'confirmed', 'in_progress'].includes(b.status) },
  { key: 'completed', label: 'Terminados', match: (b) => b.status === 'completed' },
  { key: 'cancelled', label: 'Cancelados', match: (b) => b.status === 'cancelled' },
  { key: 'all', label: 'Todos', match: () => true },
];

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  useEffect(() => subscribeAllBookings(setBookings), []);

  const f = FILTERS.find((x) => x.key === filter)!;
  const list = bookings?.filter(f.match);

  return (
    <Screen>
      <View style={styles.chipWrap} accessibilityRole="radiogroup" accessibilityLabel="Filtrar servicios">
        {FILTERS.map((x) => (
          <Chip key={x.key} label={`${x.label}${bookings ? ` (${bookings.filter(x.match).length})` : ''}`} selected={filter === x.key} onPress={() => setFilter(x.key)} />
        ))}
      </View>
      {!list ? (
        <SkeletonList count={4} />
      ) : list.length === 0 ? (
        <EmptyState icon="briefcase-outline" text="No hay servicios con ese filtro." />
      ) : (
        list.map((b) => {
          const st = BOOKING_STATUS[b.status];
          return (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/booking/${b.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${CATEGORY_LABELS[b.category]}, ${b.clientName} con ${b.providerName}, ${st.label}, ${formatDateTime(b.start)}`}
            >
              <Card>
                <View style={styles.chipWrap}>
                  <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
                  {b.onTheWayAt && b.status === 'confirmed' && <StatusBadge label="En camino" tone="info" icon="car-outline" />}
                  {b.priceProposal && <StatusBadge label="Precio en discusión" tone="warning" icon="pricetag-outline" />}
                  {b.cancelledBy === 'admin' && <StatusBadge label="Cancelado por TeAyudo" tone="neutral" icon="shield-outline" />}
                </View>
                <AppText variant="label">
                  {CATEGORY_LABELS[b.category]} · {formatCOP(b.price)}
                </AppText>
                <AppText variant="muted">
                  {b.clientName} → {b.providerName}
                </AppText>
                <AppText variant="small">{formatDateTime(b.start)}</AppText>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
