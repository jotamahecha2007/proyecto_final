import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { ClientReputationCard } from '@/components/ClientReputationCard';
import { SlotPicker } from '@/components/SlotPicker';
import { PhotoStrip } from '@/components/PhotoPicker';
import { AppText, Button, Card, ErrorText, Loading, Screen, Stepper, TextField } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { distanceKm, formatKm, travelMinutes } from '@/lib/geo';
import { leadMinutesFor, searchWindow } from '@/lib/matching';
import { availableSlots, requestWhenLabel, slotLabel } from '@/lib/schedule';
import { URGENCY_LABEL } from '@/lib/status';
import { formatCOP } from '@/lib/theme';
import { CATEGORY_LABELS, type ProviderProfile, type ServiceRequest, type TimeSlot } from '@/lib/types';
import { fetchBusy, getProvider } from '@/services/providers';
import { getMyQuote, getRequest, sendQuote } from '@/services/requests';

// La solicitud llega anónima: el prestador ve el problema, la zona y la fecha, no el nombre del cliente.
export default function QuoteScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user } = useSession();
  const [req, setReq] = useState<ServiceRequest | null>();
  const [me, setMe] = useState<ProviderProfile | null>(null);
  const [hours, setHours] = useState(2);
  const [priceText, setPriceText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [busySlots, setBusySlots] = useState<TimeSlot[]>([]);
  const [start, setStart] = useState<number>();

  useEffect(() => {
    (async () => {
      const [r, p, q, b] = await Promise.all([
        getRequest(requestId),
        getProvider(user.uid),
        getMyQuote(requestId, user.uid),
        fetchBusy(user.uid).catch(() => []),
      ]);
      setReq(r);
      setMe(p);
      setBusySlots(b);
      if (q) {
        setAlreadySent(true);
        setStart(q.start);
        setHours(q.estimatedHours);
        setPriceText(String(q.price));
        setMessage(q.message);
      } else if (r && p) {
        setHours(r.attributes.estimatedHours);
        setPriceText(String(Math.round((p.hourlyRate * r.attributes.estimatedHours) / 1000) * 1000));
      }
    })();
  }, [requestId, user.uid]);

  // Horas en que este prestador puede llegar, según su horario, sus otros trabajos y el
  // desplazamiento. Él propone una y el cliente la ve junto al precio.
  const slots = useMemo(() => {
    if (!req || !me) return [];
    const now = Date.now();
    const win = searchWindow(req, now);
    const base = {
      schedule: me.schedule,
      busy: busySlots,
      travelMin: travelMinutes(me.location, req.location),
      durationHours: hours,
      now,
      leadMin: leadMinutesFor(req.attributes.urgency),
      max: 24,
    };
    const inWindow = availableSlots({ ...base, from: win.from, days: win.days });
    return inWindow.length ? inWindow : availableSlots({ ...base, from: win.from + win.days * 86_400_000, days: 14, max: 8 });
  }, [req, me, busySlots, hours]);
  const outsideWindow = useMemo(() => {
    if (!req || !slots.length) return false;
    const win = searchWindow(req);
    return slots[0] >= win.from + win.days * 86_400_000;
  }, [req, slots]);

  useEffect(() => {
    // Si la hora elegida ya no sirve (cambió la duración), se pasa a la más cercana.
    if (slots.length && (start === undefined || !slots.includes(start))) setStart(slots[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  if (req === undefined || !me) return <Loading />;
  if (!req) return <Screen><AppText>Esta solicitud ya no existe.</AppText></Screen>;

  async function send() {
    const price = parseInt(priceText.replace(/\D/g, ''), 10);
    if (!price || price < 10000) return setError('Escribe un precio válido (mínimo $10.000).');
    if (!start) return setError('Elige a qué hora puedes llegar.');
    setBusy(true);
    try {
      await sendQuote(req!.id, {
        providerId: user.uid,
        providerName: me!.name,
        price,
        start,
        estimatedHours: hours,
        message: message.trim(),
        createdAt: Date.now(),
      });
      router.back();
    } catch {
      setError('No se pudo enviar. Puede que el cliente ya haya contratado a alguien.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <AppText variant="heading">{CATEGORY_LABELS[req.attributes.category]}</AppText>
        <AppText>{req.description}</AppText>
        <PhotoStrip photos={req.photos} />
        <AppText variant="muted">
          {requestWhenLabel(req)} · {URGENCY_LABEL[req.attributes.urgency]} · a {formatKm(distanceKm(me.location, req.location))} de ti
        </AppText>
        {req.attributes.budgetMax ? (
          <AppText variant="muted">El cliente indicó hasta {formatCOP(req.attributes.budgetMax)}</AppText>
        ) : null}
      </Card>
      <ClientReputationCard clientId={req.clientId} anonymous />
      <Stepper label="Horas de trabajo" value={hours} display={`${hours} h`} step={0.5} min={0.5} max={12} onChange={setHours} />
      <Card>
        {slots.length ? (
          <SlotPicker
            slots={slots}
            value={start}
            onChange={setStart}
            label={outsideWindow ? 'No tienes horario en lo que pidió el cliente. Propón otro:' : '¿A qué hora puedes llegar?'}
          />
        ) : (
          <AppText>No tienes horarios libres en los próximos días. Revisa tu horario de trabajo en «Mi perfil».</AppText>
        )}
        <AppText variant="small">Calculado con tu horario, tus otros trabajos y ~{travelMinutes(me.location, req.location)} min de desplazamiento.</AppText>
      </Card>
      <TextField
        label="Precio total"
        help="Incluye mano de obra. Materiales aparte, si aplica, explícalo en el mensaje."
        keyboardType="number-pad"
        value={priceText ? formatCOP(parseInt(priceText.replace(/\D/g, ''), 10) || 0) : ''}
        onChangeText={(v) => setPriceText(v.replace(/\D/g, ''))}
      />
      <TextField label="Mensaje para el cliente (opcional)" multiline value={message} onChangeText={setMessage} maxLength={300} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button
        label={`${alreadySent ? 'Actualizar' : 'Enviar'} cotización${start ? ` · ${slotLabel(start)}` : ''}`}
        onPress={send}
        loading={busy}
        disabled={!start}
      />
    </Screen>
  );
}
