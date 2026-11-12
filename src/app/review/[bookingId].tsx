import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppText, Button, ErrorText, Loading, RatingInput, Screen, TextField } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import type { Booking } from '@/lib/types';
import { subscribeBooking } from '@/services/bookings';
import { submitReview } from '@/services/reviews';

export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user, profile } = useSession();
  const [b, setB] = useState<Booking | null>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeBooking(bookingId, setB), [bookingId]);
  if (!b) return <Loading />;

  const isClient = user.uid === b.clientId;
  const other = isClient ? b.providerName : b.clientName;

  async function send() {
    if (!rating) return setError('Elige de 1 a 5 estrellas.');
    setBusy(true);
    try {
      await submitReview(b!, isClient ? 'client' : 'provider', profile.name, rating, comment);
      router.back();
    } catch {
      setError('No se pudo enviar la calificación. Puede que ya hayas calificado este trabajo.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">¿Cómo te fue con {other.split(' ')[0]}?</AppText>
      <AppText variant="muted">
        {isClient
          ? 'Piensa en la calidad del trabajo, la puntualidad y el trato.'
          : 'Piensa en si el cliente fue claro, puntual con el pago y respetuoso.'}
      </AppText>
      <RatingInput value={rating} onChange={setRating} />
      <TextField label="Comentario (opcional)" multiline value={comment} onChangeText={setComment} maxLength={400} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Enviar calificación" onPress={send} loading={busy} />
    </Screen>
  );
}
