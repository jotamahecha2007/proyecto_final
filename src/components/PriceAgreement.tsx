import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { AppText, Button, Card, ErrorText, StatusBadge, TextField } from '@/components/ui';
import { formatCOP } from '@/lib/theme';
import type { Booking } from '@/lib/types';
import { acceptPriceProposal, proposePrice, rejectPriceProposal } from '@/services/bookings';

/**
 * Precio final acordado. Flujo:
 * 1. Se contrata con el precio estimado (o el de la cotización).
 * 2. Si el trabajo cambia, el prestador propone un precio final con su motivo.
 * 3. El cliente lo acepta o lo rechaza. No se puede pagar con una propuesta pendiente.
 */
export function PriceAgreement({ booking: b, isClient }: { booking: Booking; isClient: boolean }) {
  const [editing, setEditing] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const canPropose =
    !isClient &&
    b.payment.status === 'unpaid' &&
    (b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'completed');
  const pending = b.priceProposal;
  const amount = parseInt(amountText.replace(/\D/g, ''), 10) || 0;

  async function run(action: () => Promise<unknown>, announce: string) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      AccessibilityInfo.announceForAccessibility(announce);
      setEditing(false);
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function send() {
    if (amount < 10000) return setError('Escribe un precio válido (mínimo $10.000).');
    if (note.trim().length < 5) return setError('Explica brevemente por qué cambia el precio.');
    run(() => proposePrice(b, amount, note), 'Propuesta enviada al cliente');
  }

  return (
    <Card>
      <AppText variant="label">Precio</AppText>
      <AppText variant="heading">{formatCOP(b.price)}</AppText>
      <StatusBadge
        label={b.priceAgreed ? 'Precio acordado por ambos' : 'Precio estimado (tarifa × horas)'}
        tone={b.priceAgreed ? 'success' : 'neutral'}
        icon={b.priceAgreed ? 'checkmark-done-outline' : 'calculator-outline'}
      />

      {pending && (
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          <StatusBadge label="Propuesta de precio pendiente" tone="warning" icon="hourglass-outline" />
          <AppText>
            {isClient ? `${b.providerName.split(' ')[0]} propone` : 'Propusiste'} <AppText variant="label">{formatCOP(pending.amount)}</AppText>{' '}
            ({pending.amount >= b.price ? '+' : '−'}
            {formatCOP(Math.abs(pending.amount - b.price))} frente al precio actual).
          </AppText>
          <AppText variant="muted">Motivo: «{pending.note}»</AppText>
          {isClient ? (
            <>
              <Button label={`Aceptar ${formatCOP(pending.amount)}`} icon="checkmark" loading={busy} onPress={() => run(() => acceptPriceProposal(b), 'Precio aceptado')} />
              <Button label="Rechazar y hablarlo por chat" variant="secondary" disabled={busy} onPress={() => run(() => rejectPriceProposal(b), 'Propuesta rechazada')} />
            </>
          ) : (
            <AppText variant="small">Esperando respuesta del cliente. Puedes cambiar la propuesta enviando otra.</AppText>
          )}
        </View>
      )}

      {canPropose && !editing && (
        <Button
          label={pending ? 'Cambiar propuesta' : 'Proponer precio final'}
          icon="create-outline"
          variant="secondary"
          onPress={() => {
            setAmountText(String(pending?.amount ?? b.price));
            setNote(pending?.note ?? '');
            setEditing(true);
          }}
        />
      )}

      {editing && (
        <View style={{ gap: 8 }}>
          <TextField
            label="Precio final"
            keyboardType="number-pad"
            value={amount ? formatCOP(amount) : ''}
            onChangeText={(v) => setAmountText(v.replace(/\D/g, ''))}
          />
          <TextField
            label="¿Por qué cambia?"
            help="Ej.: «había que cambiar el sifón completo, los materiales cuestan $25.000»."
            multiline
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
          <Button label="Enviar propuesta al cliente" loading={busy} onPress={send} />
          <Button label="Cancelar" variant="ghost" onPress={() => setEditing(false)} />
        </View>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}
