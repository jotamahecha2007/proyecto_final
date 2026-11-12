import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, Chip, Loading, Screen, StatusBadge, styles } from '@/components/ui';
import { formatCOP } from '@/lib/theme';
import type { Booking } from '@/lib/types';
import { paySimulated, subscribeBooking } from '@/services/bookings';

const METHODS = ['Nequi', 'PSE', 'Tarjeta', 'Efectivo'];

// Pagos = "Simulación" en la Tabla B1: no se pide ni se guarda ningún dato financiero.
export default function PaySimulated() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [b, setB] = useState<Booking | null>();
  const [method, setMethod] = useState(METHODS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeBooking(bookingId, setB), [bookingId]);
  if (!b) return <Loading />;
  if (b.priceProposal) {
    return (
      <Screen>
        <StatusBadge label="Hay una propuesta de precio pendiente" tone="warning" icon="hourglass-outline" />
        <AppText>Antes de pagar, acepta o rechaza el precio que propuso {b.providerName.split(' ')[0]}.</AppText>
        <Button label="Volver" onPress={() => router.back()} />
      </Screen>
    );
  }

  async function pay() {
    setBusy(true);
    await paySimulated(b!, method);
    router.back();
  }

  return (
    <Screen>
      <StatusBadge label="Modo simulación: no se cobra dinero real" tone="warning" icon="flask-outline" />
      <Card>
        <AppText variant="muted">Total a pagar a {b.providerName}</AppText>
        <AppText variant="title">{formatCOP(b.price)}</AppText>
      </Card>
      <AppText variant="label">Método de pago</AppText>
      <View style={styles.chipWrap} accessibilityRole="radiogroup">
        {METHODS.map((m) => (
          <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
        ))}
      </View>
      <AppText variant="small">
        En la versión final, este paso abrirá la pasarela de pagos. En el MVP solo registra el método elegido.
      </AppText>
      <Button label={`Simular pago con ${method}`} icon="checkmark-circle-outline" onPress={pay} loading={busy} />
    </Screen>
  );
}
