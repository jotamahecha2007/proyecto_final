import { router } from 'expo-router';
import { View } from 'react-native';

import { ReasonAction } from '@/components/admin/ReasonAction';
import { PhotoStrip } from '@/components/PhotoPicker';
import { AppText, Button, Card, Screen, StatusBadge, styles } from '@/components/ui';
import { BOOKING_STATUS } from '@/lib/status';
import { formatCOP, formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, type Booking } from '@/lib/types';
import { adminCancelBooking } from '@/services/admin';

/** Vista de una contratación para el administrador: solo lectura + cancelar por decisión de TeAyudo. */
export function AdminBookingView({ booking: b }: { booking: Booking }) {
  const st = BOOKING_STATUS[b.status];
  const active = b.status === 'pending' || b.status === 'confirmed' || b.status === 'in_progress';
  const cancelledLabel =
    b.status === 'cancelled'
      ? b.cancelledBy === 'admin'
        ? `Cancelado por TeAyudo (${(b.cancelReason ?? '').replace(/^admin:\s*/, '')})`
        : b.cancelReason === 'account_deleted'
          ? 'Cancelado porque una cuenta fue eliminada'
          : `Cancelado por el ${b.cancelledBy === 'client' ? 'cliente' : 'prestador'}`
      : null;

  return (
    <Screen>
      <StatusBadge label="Vista de administrador" tone="info" icon="shield-outline" />
      <Card>
        <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
        <AppText variant="heading">{CATEGORY_LABELS[b.category]}</AppText>
        <AppText>{b.description}</AppText>
        <PhotoStrip photos={b.photos} />
        <AppText variant="muted">
          {formatDateTime(b.start)} · {b.location.label ?? 'Ubicación del cliente'}
        </AppText>
        <AppText variant="label">
          {formatCOP(b.price)} · {b.priceAgreed ? 'precio acordado' : 'precio estimado'}
          {b.priceProposal ? ` · propuesta pendiente de ${formatCOP(b.priceProposal.amount)}` : ''}
        </AppText>
        <AppText variant="small">Pago: {b.payment.status === 'paid_simulated' ? `pagado (simulado, ${b.payment.method})` : 'pendiente'}</AppText>
        {cancelledLabel && <AppText variant="small">{cancelledLabel}</AppText>}
        <AppText variant="small">
          Calificaciones: cliente {b.reviewedByClient ? '✓' : '—'} · prestador {b.reviewedByProvider ? '✓' : '—'}
        </AppText>
      </Card>

      <Card>
        <AppText variant="label">Partes</AppText>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <AppText style={{ flex: 1 }}>Cliente: {b.clientName}</AppText>
          <Button label="Ver" variant="ghost" onPress={() => router.push(`/admin/user/${b.clientId}`)} />
        </View>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <AppText style={{ flex: 1 }}>Prestador: {b.providerName}</AppText>
          <Button label="Ver" variant="ghost" onPress={() => router.push(`/admin/user/${b.providerId}`)} />
        </View>
      </Card>

      {active && (
        <ReasonAction
          label="Cancelar este servicio"
          icon="close-circle-outline"
          variant="danger"
          confirmLabel="Cancelar el servicio"
          help="Ambas partes recibirán este motivo. No afecta la reputación de nadie."
          placeholder="Ej.: disputa en revisión por reporte de seguridad"
          onConfirm={(reason) => adminCancelBooking(b.id, reason)}
          done="Servicio cancelado"
        />
      )}
      <AppText variant="small">Por privacidad, el administrador no puede leer el chat entre cliente y prestador.</AppText>
    </Screen>
  );
}
