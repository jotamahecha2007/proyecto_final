import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { SkeletonList, SkeletonScreen } from '@/components/Skeleton';
import { PhotoStrip } from '@/components/PhotoPicker';
import { ProviderCard } from '@/components/ProviderCard';
import { SlotPicker } from '@/components/SlotPicker';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  NextSteps,
  Screen,
  StatusBadge,
  styles,
} from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { explainMatch, type MatchResult } from '@/lib/matching';
import { REQUEST_STATUS, URGENCY_LABEL } from '@/lib/status';
import { requestWhenLabel, slotLabel } from '@/lib/schedule';
import { formatCOP, formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, type Booking, type ProviderProfile, type Quote, type ServiceRequest } from '@/lib/types';
import { createBooking, ScheduleConflictError, subscribeMyBookings } from '@/services/bookings';
import { getProvider } from '@/services/providers';
import { cancelRequest, matchesFor, subscribeQuotes, subscribeRequest } from '@/services/requests';

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useSession();
  const [req, setReq] = useState<ServiceRequest | null | undefined>();
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string>();
  const [hiring, setHiring] = useState<string | null>(null);
  /** Hora elegida para cada prestador (por defecto, la más cercana). */
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => subscribeRequest(id, setReq), [id]);
  useEffect(() => subscribeQuotes(id, setQuotes), [id]);
  useEffect(
    () => subscribeMyBookings(user.uid, 'client', (all) => setBooking(all.find((b) => b.requestId === id) ?? null)),
    [user.uid, id],
  );

  function loadMatches(r: ServiceRequest) {
    setMatches(null);
    matchesFor(r)
      .then((ms) => {
        setMatches(ms);
        setPicked(Object.fromEntries(ms.map((m) => [m.provider.uid, m.slots[0] ?? m.nextSlots[0]]).filter(([, v]) => v)));
      })
      .catch(() => setError('No pudimos cargar los prestadores. Revisa tu conexión.'));
  }

  useEffect(() => {
    if (req?.mode !== 'direct' || req.status !== 'open') return;
    loadMatches(req);
    // Se recalcula al abrir la solicitud y cuando la editas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.id, req?.status, req?.updatedAt]);

  if (req === undefined) return <SkeletonScreen count={3} />;
  if (req === null) return <Screen><EmptyState icon="alert-circle-outline" text="Esta solicitud ya no existe." /></Screen>;

  function hire(provider: ProviderProfile, price: number, hours: number, start: number, fromQuote = false) {
    if (!req) return;
    Alert.alert(
      `¿Contratar a ${provider.name}?`,
      `Llega ${slotLabel(start)} · ${formatCOP(price)} ${fromQuote ? 'cotizado' : 'estimado'}.\n\n${provider.name} debe confirmar. Puedes cancelar mientras tanto.`,
      [
        { text: 'No, volver', style: 'cancel' },
        {
          text: 'Sí, contratar',
          onPress: async () => {
            setHiring(provider.uid);
            setError(undefined);
            try {
              const bookingId = await createBooking({
                request: req,
                clientName: profile.name,
                provider,
                price,
                estimatedHours: hours,
                fromQuote,
                start,
              });
              router.replace(`/booking/${bookingId}`);
            } catch (e) {
              if (e instanceof ScheduleConflictError) {
                setError('Esa hora se acaba de ocupar. Actualizamos los horarios: elige otra.');
                if (req.mode === 'direct') loadMatches(req);
              } else {
                setError('No se pudo completar la contratación. Intenta de nuevo.');
              }
            } finally {
              setHiring(null);
            }
          },
        },
      ],
    );
  }

  async function acceptQuote(q: Quote) {
    const provider = await getProvider(q.providerId);
    if (!provider) return setError('Ese prestador ya no está disponible.');
    hire(provider, q.price, q.estimatedHours, q.start ?? req!.desiredStart, true);
  }

  function cancel() {
    Alert.alert('¿Cancelar la solicitud?', 'Los prestadores dejarán de verla.', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelRequest(req!.id) },
    ]);
  }

  const st = REQUEST_STATUS[req.status];
  const editable = req.status === 'open' || req.status === 'quoting';
  const when = requestWhenLabel(req);
  const visible = matches ? (showAll ? matches : matches.slice(0, 3)) : [];
  return (
    <Screen>
      <Card>
        <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
        <AppText variant="heading">{CATEGORY_LABELS[req.attributes.category]}</AppText>
        <AppText>{req.description}</AppText>
        <PhotoStrip photos={req.photos} />
        <AppText variant="muted">
          {when} · {URGENCY_LABEL[req.attributes.urgency]} · ~{req.attributes.estimatedHours} h
          {req.attributes.budgetMax ? ` · hasta ${formatCOP(req.attributes.budgetMax)}` : ''}
        </AppText>
        {req.updatedAt && <AppText variant="small">Editada {formatDateTime(req.updatedAt)}</AppText>}
        {editable && (
          <Button
            label="Editar solicitud"
            variant="secondary"
            icon="create-outline"
            onPress={() => router.push({ pathname: '/new-request', params: { edit: req.id } })}
          />
        )}
      </Card>

      {error && <ErrorText>{error}</ErrorText>}

      {booking && (
        <Button label="Ver la contratación" icon="arrow-forward" onPress={() => router.push(`/booking/${booking.id}`)} />
      )}

      {req.status === 'open' && req.mode === 'direct' && (
        <>
          <AppText variant="heading">Elige prestador y hora</AppText>
          <AppText variant="muted">
            Primero los que pueden llegar antes; con la misma hora, el de más confianza, cercanía y mejor precio. Toca un nombre para ver su
            perfil y reseñas.
          </AppText>
          {matches === null ? (
            <SkeletonList count={3} lines={4} avatar />
          ) : matches.length === 0 ? (
            <EmptyState
              icon="people-outline"
              text="Por ahora no hay prestadores de esta categoría en tu zona. Prueba editando la solicitud (otro día u otra categoría)."
            />
          ) : (
            visible.map((m, i) => (
              <ProviderCard
                key={m.provider.uid}
                provider={m.provider}
                rank={i + 1}
                distanceKm={m.distanceKm}
                travelMinutes={m.travelMinutes}
                available={m.available}
                reasons={explainMatch(m, req.attributes)}
                footer={
                  <View style={{ gap: 8 }}>
                    {m.slots.length + m.nextSlots.length > 0 ? (
                      <SlotPicker
                        slots={m.slots.length ? m.slots : m.nextSlots}
                        label={m.slots.length ? 'Elige la hora de llegada' : 'Ese día no puede. Sus próximos horarios:'}
                        value={picked[m.provider.uid]}
                        onChange={(ms) => setPicked((p) => ({ ...p, [m.provider.uid]: ms }))}
                      />
                    ) : (
                      <AppText variant="small">No tiene horarios libres en los próximos días. Puedes ver su perfil o elegir a otro.</AppText>
                    )}
                    <AppText variant="label">Precio estimado: {formatCOP(m.estimatedPrice)}</AppText>
                    <AppText variant="small">
                      {formatCOP(m.provider.hourlyRate)}/hora × {req.attributes.estimatedHours} h. El valor final lo acuerdan por chat.
                    </AppText>
                    {picked[m.provider.uid] && (
                      <Button
                        label={`Contratar a ${m.provider.name.split(' ')[0]} · ${slotLabel(picked[m.provider.uid])}`}
                        onPress={() => hire(m.provider, m.estimatedPrice, req.attributes.estimatedHours, picked[m.provider.uid])}
                        loading={hiring === m.provider.uid}
                        disabled={!!hiring}
                      />
                    )}
                  </View>
                }
              />
            ))
          )}
          {matches && matches.length > 3 && (
            <Button
              label={showAll ? 'Ver menos prestadores' : `Ver ${matches.length - 3} prestadores más`}
              variant="ghost"
              onPress={() => setShowAll((v) => !v)}
            />
          )}
        </>
      )}

      {req.status === 'quoting' && (
        <>
          <NextSteps
            steps={[
              { text: `Enviamos tu solicitud, sin tu nombre, a ${req.matchedProviderIds.length} prestadores compatibles.`, done: true },
              { text: 'Las cotizaciones aparecen aquí apenas lleguen.', done: quotes.length > 0 },
              { text: 'Aceptas la que prefieras y el prestador confirma.' },
            ]}
          />
          <AppText variant="heading">Cotizaciones ({quotes.length})</AppText>
          {quotes.length === 0 ? (
            <EmptyState icon="hourglass-outline" text="Aún no llegan cotizaciones. Te avisamos aquí mismo." />
          ) : (
            quotes.map((q) => (
              <Card key={q.providerId}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <AppText variant="heading">{q.providerName}</AppText>
                  <AppText variant="heading">{formatCOP(q.price)}</AppText>
                </View>
                <AppText variant="muted">
                  {q.start ? `Puede llegar ${slotLabel(q.start)} · ` : ''}~{q.estimatedHours} h de trabajo
                </AppText>
                {!!q.message && <AppText>«{q.message}»</AppText>}
                <Button label="Ver perfil" variant="secondary" onPress={() => router.push(`/provider/${q.providerId}`)} />
                <Button
                  label={q.start ? `Aceptar · llega ${slotLabel(q.start)}` : "Aceptar esta cotización"}
                  onPress={() => acceptQuote(q)}
                  loading={hiring === q.providerId}
                  disabled={!!hiring}
                />
              </Card>
            ))
          )}
        </>
      )}

      {editable && (
        <Button label="Cancelar solicitud" variant="danger" icon="close" onPress={cancel} />
      )}
    </Screen>
  );
}
