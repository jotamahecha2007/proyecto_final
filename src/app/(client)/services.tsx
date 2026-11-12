import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { SkeletonList } from '@/components/Skeleton';
import { AppText, Button, Card, EmptyState, Screen, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { BOOKING_STATUS, REQUEST_STATUS } from '@/lib/status';
import { formatCOP, formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, type Booking, type ServiceRequest } from '@/lib/types';
import { subscribeMyBookings } from '@/services/bookings';
import { subscribeClientRequests } from '@/services/requests';

export default function ClientServices() {
  const { user } = useSession();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => subscribeMyBookings(user.uid, 'client', setBookings), [user.uid]);
  useEffect(() => subscribeClientRequests(user.uid, setRequests), [user.uid]);

  if (bookings === null) {
    return (
      <Screen>
        <SkeletonList count={3} />
      </Screen>
    );
  }

  const active = bookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled');
  const past = bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled').reverse();
  const openRequests = requests.filter((r) => r.status === 'open' || r.status === 'quoting');

  const bookingCard = (b: Booking) => {
    const st = BOOKING_STATUS[b.status];
    const needsReview = b.status === 'completed' && !b.reviewedByClient;
    return (
      <Card key={b.id}>
        <StatusBadge label={needsReview ? 'Falta tu calificación' : st.label} tone={needsReview ? 'warning' : st.tone} icon={needsReview ? 'star-outline' : st.icon} />
        <AppText variant="label">
          {CATEGORY_LABELS[b.category]} · {b.providerName}
        </AppText>
        <AppText variant="muted">
          {formatDateTime(b.start)} · {formatCOP(b.price)}
        </AppText>
        <Button label="Ver detalle" variant="secondary" onPress={() => router.push(`/booking/${b.id}`)} />
      </Card>
    );
  };

  return (
    <Screen>
      {openRequests.length > 0 && (
        <>
          <AppText variant="heading">Solicitudes abiertas</AppText>
          {openRequests.map((r) => {
            const st = REQUEST_STATUS[r.status];
            return (
              <Card key={r.id}>
                <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
                <AppText variant="label">{CATEGORY_LABELS[r.attributes.category]}</AppText>
                <AppText variant="muted" numberOfLines={2}>
                  {r.description}
                </AppText>
                <Button label="Ver solicitud" variant="secondary" onPress={() => router.push(`/request/${r.id}`)} />
              </Card>
            );
          })}
        </>
      )}

      <AppText variant="heading">Próximos servicios</AppText>
      {active.length === 0 ? <EmptyState icon="calendar-outline" text="No tienes servicios programados." /> : active.map(bookingCard)}

      {past.length > 0 && (
        <>
          <AppText variant="heading">Historial</AppText>
          {past.map(bookingCard)}
        </>
      )}
    </Screen>
  );
}
