import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { SkeletonList } from '@/components/Skeleton';
import { AppText, Button, Card, EmptyState, Screen, StatusBadge } from '@/components/ui';
import { requestWhenLabel } from '@/lib/schedule';
import { useSession } from '@/context/AuthContext';
import { BOOKING_STATUS, URGENCY_LABEL } from '@/lib/status';
import { formatCOP, formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, type Booking, type ServiceRequest } from '@/lib/types';
import { subscribeMyBookings } from '@/services/bookings';
import { subscribeQuoteInbox } from '@/services/requests';

export default function ProviderJobs() {
  const { user } = useSession();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [inbox, setInbox] = useState<ServiceRequest[]>([]);

  useEffect(() => subscribeMyBookings(user.uid, 'provider', setBookings), [user.uid]);
  useEffect(() => subscribeQuoteInbox(user.uid, setInbox), [user.uid]);

  if (bookings === null) {
    return (
      <Screen>
        <SkeletonList count={3} />
      </Screen>
    );
  }

  const pending = bookings.filter((b) => b.status === 'pending');
  const upcoming = bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress');
  const toReview = bookings.filter((b) => b.status === 'completed' && !b.reviewedByProvider);

  const bookingCard = (b: Booking, cta: string) => {
    const st = BOOKING_STATUS[b.status];
    return (
      <Card key={b.id}>
        <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
        <AppText variant="label">
          {CATEGORY_LABELS[b.category]} · {b.clientName}
        </AppText>
        <AppText variant="muted" numberOfLines={2}>
          {b.description}
        </AppText>
        <AppText variant="muted">
          {formatDateTime(b.start)} · {formatCOP(b.price)} · salir ~{b.travelMinutes} min antes
        </AppText>
        <Button label={cta} variant={b.status === 'pending' ? 'primary' : 'secondary'} onPress={() => router.push(`/booking/${b.id}`)} />
      </Card>
    );
  };

  const empty = pending.length + upcoming.length + inbox.length + toReview.length === 0;

  return (
    <Screen>
      {empty && (
        <EmptyState
          icon="briefcase-outline"
          text="Todavía no tienes trabajos. Cuando un cliente compatible te contrate o pida cotización, aparecerá aquí."
        />
      )}

      {pending.length > 0 && (
        <>
          <AppText variant="heading">Por confirmar ({pending.length})</AppText>
          {pending.map((b) => bookingCard(b, 'Revisar y confirmar'))}
        </>
      )}

      {inbox.length > 0 && (
        <>
          <AppText variant="heading">Piden cotización ({inbox.length})</AppText>
          <AppText variant="muted">El cliente es anónimo hasta que acepte tu cotización.</AppText>
          {inbox.map((r) => (
            <Card key={r.id}>
              <StatusBadge label={URGENCY_LABEL[r.attributes.urgency]} tone={r.attributes.urgency === 'alta' ? 'warning' : 'neutral'} icon="flash-outline" />
              <AppText variant="label">{CATEGORY_LABELS[r.attributes.category]}</AppText>
              <AppText numberOfLines={3}>{r.description}</AppText>
              <AppText variant="muted">{requestWhenLabel(r)} · ~{r.attributes.estimatedHours} h</AppText>
              <Button label="Cotizar" onPress={() => router.push(`/quote/${r.id}`)} />
            </Card>
          ))}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <AppText variant="heading">Próximos</AppText>
          {upcoming.map((b) => bookingCard(b, 'Ver detalle'))}
        </>
      )}

      {toReview.length > 0 && (
        <>
          <AppText variant="heading">Califica a tus clientes</AppText>
          {toReview.map((b) => bookingCard(b, 'Calificar'))}
        </>
      )}
    </Screen>
  );
}
