import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { AdminBookingView } from '@/components/admin/AdminBookingView';
import { SkeletonScreen } from '@/components/Skeleton';
import { ClientReputationCard } from '@/components/ClientReputationCard';
import { OnTheWay } from '@/components/OnTheWay';
import { PhotoStrip } from '@/components/PhotoPicker';
import { PriceAgreement } from '@/components/PriceAgreement';
import { AppText, Button, Card, EmptyState, ErrorText, Loading, NextSteps, Screen, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { minutesToLabel } from '@/lib/schedule';
import { BOOKING_STATUS } from '@/lib/status';
import { formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, type Booking } from '@/lib/types';
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  ScheduleConflictError,
  startBooking,
  subscribeBooking,
} from '@/services/bookings';
import { ensureChat } from '@/services/chat';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useSession();
  const [b, setB] = useState<Booking | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => subscribeBooking(id, setB), [id]);

  if (b === undefined) return <SkeletonScreen count={2} />;
  if (b === null) return <Screen><EmptyState icon="alert-circle-outline" text="Esta contratación no existe." /></Screen>;
  if (profile.role === 'admin') return <AdminBookingView booking={b} />;

  const isClient = user.uid === b.clientId;
  const other = isClient ? b.providerName : b.clientName;
  const st = BOOKING_STATUS[b.status];

  async function run(action: () => Promise<unknown>, announce: string) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      AccessibilityInfo.announceForAccessibility(announce);
    } catch (e) {
      setError(e instanceof ScheduleConflictError ? e.message : 'No se pudo completar la acción. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function askCancel() {
    Alert.alert(
      '¿Cancelar la contratación?',
      isClient
        ? 'El prestador recibirá la cancelación y su horario quedará libre.'
        : 'Las cancelaciones del prestador bajan su puntaje de confianza.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => run(() => cancelBooking(b!, isClient ? 'client' : 'provider'), 'Contratación cancelada'),
        },
      ],
    );
  }

  async function openChat() {
    const chatId = await ensureChat(b!.clientId, b!.clientName, b!.providerId, b!.providerName);
    router.push(`/chat/${chatId}`);
  }

  const reviewed = isClient ? b.reviewedByClient : b.reviewedByProvider;
  const blockedFrom = new Date(b.start - b.travelMinutes * 60_000);

  return (
    <Screen>
      <Card>
        <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
        <AppText variant="heading">
          {CATEGORY_LABELS[b.category]} con {other}
        </AppText>
        <AppText>{b.description}</AppText>
        <PhotoStrip photos={b.photos} />
        <AppText variant="muted">
          {formatDateTime(b.start)} – {minutesToLabel(new Date(b.end).getHours() * 60 + new Date(b.end).getMinutes())}
        </AppText>
        <AppText variant="muted">
          {b.location.label ?? 'Ubicación del cliente'} · desplazamiento ~{b.travelMinutes} min
        </AppText>
        <StatusBadge
          label={b.payment.status === 'paid_simulated' ? `Pagado (simulado, ${b.payment.method})` : 'Pago pendiente'}
          tone={b.payment.status === 'paid_simulated' ? 'success' : 'neutral'}
          icon={b.payment.status === 'paid_simulated' ? 'card' : 'card-outline'}
        />
      </Card>

      <OnTheWay booking={b} isClient={isClient} />

      {b.status !== 'cancelled' && <PriceAgreement booking={b} isClient={isClient} />}

      {!isClient && <ClientReputationCard clientId={b.clientId} />}

      {b.status !== 'cancelled' && (
        <NextSteps
          steps={[
            { text: `${b.providerName} confirma el trabajo.`, done: b.status !== 'pending' },
            {
              text: `Su agenda queda bloqueada desde las ${minutesToLabel(blockedFrom.getHours() * 60 + blockedFrom.getMinutes())} (incluye el desplazamiento).`,
              done: b.status !== 'pending',
            },
            { text: 'El prestador marca el inicio y el fin del trabajo.', done: b.status === 'completed' },
            { text: 'Ambos se califican. Eso alimenta el puntaje de confianza.', done: reviewed },
          ]}
        />
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <Button label={`Escribir a ${other.split(' ')[0]}`} icon="chatbubble-ellipses-outline" variant="secondary" onPress={openChat} />
      <Button
        label={`Reportar un problema con ${other.split(' ')[0]}`}
        icon="flag-outline"
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: '/report',
            params: { targetId: isClient ? b.providerId : b.clientId, targetName: other, targetRole: isClient ? 'provider' : 'client', bookingId: b.id },
          })
        }
      />

      {!isClient && b.status === 'pending' && (
        <Button label="Confirmar trabajo" icon="checkmark" loading={busy} onPress={() => run(() => confirmBooking(b), 'Trabajo confirmado')} />
      )}
      {!isClient && b.status === 'confirmed' && (
        <Button label={b.onTheWayAt ? 'Llegué: marcar inicio del trabajo' : 'Marcar inicio del trabajo'} icon="play" loading={busy} onPress={() => run(() => startBooking(b), 'Trabajo iniciado')} />
      )}
      {!isClient && b.status === 'in_progress' && (
        <Button label="Marcar trabajo terminado" icon="flag" loading={busy} onPress={() => run(() => completeBooking(b), 'Trabajo terminado')} />
      )}

      {isClient && b.status !== 'cancelled' && b.payment.status === 'unpaid' && b.status !== 'pending' && (
        <Button
          label="Pagar (simulación)"
          icon="card-outline"
          disabled={!!b.priceProposal}
          hint={b.priceProposal ? 'Primero responde la propuesta de precio' : undefined}
          onPress={() => router.push(`/pay/${b.id}`)}
        />
      )}
      {isClient && b.priceProposal && b.payment.status === 'unpaid' && (
        <AppText variant="small">Para pagar, primero acepta o rechaza la propuesta de precio.</AppText>
      )}

      {b.status === 'completed' && !reviewed && (
        <Button
          label={`Calificar a ${other.split(' ')[0]}`}
          icon="star-outline"
          onPress={() => router.push(`/review/${b.id}`)}
        />
      )}

      {(b.status === 'pending' || b.status === 'confirmed') && (
        <Button label="Cancelar contratación" variant="danger" icon="close" onPress={askCancel} disabled={busy} />
      )}

      {profile.role === 'client' && b.status === 'completed' && (
        <AppText variant="small">¿Te gustó el trabajo? Puedes volver a escribirle por el chat para un próximo servicio.</AppText>
      )}
    </Screen>
  );
}
