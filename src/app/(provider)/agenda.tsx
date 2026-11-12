import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { ScheduleEditor } from '@/components/ScheduleEditor';
import { AppText, Button, Card, EmptyState, Loading, Screen, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { minutesToLabel } from '@/lib/schedule';
import { BOOKING_STATUS } from '@/lib/status';
import { formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, type Booking, type ProviderProfile, type WeeklySchedule } from '@/lib/types';
import { subscribeMyBookings } from '@/services/bookings';
import { saveProvider, subscribeProvider } from '@/services/providers';

function hhmm(ms: number) {
  const d = new Date(ms);
  return minutesToLabel(d.getHours() * 60 + d.getMinutes());
}

export default function Agenda() {
  const { user } = useSession();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(
    () =>
      subscribeProvider(user.uid, (p) => {
        setProvider(p);
        setSchedule((s) => s ?? p?.schedule ?? null);
      }),
    [user.uid],
  );
  useEffect(() => subscribeMyBookings(user.uid, 'provider', setBookings), [user.uid]);

  if (!provider || !schedule) return <Loading />;

  const blocked = bookings.filter((b) => (b.status === 'confirmed' || b.status === 'in_progress') && b.end > Date.now());
  const changed = JSON.stringify(schedule) !== JSON.stringify(provider.schedule);

  async function save() {
    setSaving(true);
    const { stats, trustScore, updatedAt, ...rest } = provider!;
    void stats;
    void trustScore;
    void updatedAt;
    await saveProvider({ ...rest, schedule: schedule! }, provider);
    setSaving(false);
    setSaved(true);
  }

  return (
    <Screen>
      <AppText variant="heading">Tiempo reservado</AppText>
      <AppText variant="muted">Cada trabajo bloquea su duración más el tiempo de desplazamiento.</AppText>
      {blocked.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" text="No tienes trabajos confirmados." />
      ) : (
        blocked.map((b) => {
          const st = BOOKING_STATUS[b.status];
          return (
            <Card key={b.id}>
              <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
              <AppText variant="label">{formatDateTime(b.start)}</AppText>
              <AppText>
                {CATEGORY_LABELS[b.category]} con {b.clientName}
              </AppText>
              <AppText variant="muted">
                Bloqueado de {hhmm(b.start - b.travelMinutes * 60_000)} a {hhmm(b.end)} ({b.travelMinutes} min de desplazamiento)
              </AppText>
              <Button label="Ver detalle" variant="secondary" onPress={() => router.push(`/booking/${b.id}`)} />
            </Card>
          );
        })
      )}

      <AppText variant="heading">Horario semanal</AppText>
      <ScheduleEditor
        value={schedule}
        onChange={(s) => {
          setSchedule(s);
          setSaved(false);
        }}
      />
      <Button label="Guardar horario" onPress={save} loading={saving} disabled={!changed} />
      {saved && !changed && (
        <AppText variant="small" accessibilityLiveRegion="polite">
          Horario guardado.
        </AppText>
      )}
    </Screen>
  );
}
