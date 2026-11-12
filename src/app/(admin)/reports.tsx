import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SkeletonList } from '@/components/Skeleton';
import { AppText, Button, Card, Chip, EmptyState, ErrorText, Screen, StatusBadge, TextField, styles } from '@/components/ui';
import { formatDateTime, spacing } from '@/lib/theme';
import { REPORT_REASONS, type Report } from '@/lib/types';
import { adminErrorMessage, adminResolveReport, subscribeReports } from '@/services/admin';

const ACTION_LABEL = { dismiss: 'Descartado', warn: 'Advertencia enviada', suspend: 'Cuenta suspendida' } as const;

/** Formulario para decidir sobre un reporte. */
function Resolver({ report }: { report: Report }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function resolve(action: 'dismiss' | 'warn' | 'suspend') {
    if (note.trim().length < 5) return setError('Escribe una nota con tu decisión (la recibe quien reportó y, si adviertes, la persona reportada).');
    setBusy(action);
    setError(undefined);
    try {
      await adminResolveReport(report.id, action, note.trim());
    } catch (e) {
      setError(adminErrorMessage(e));
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField label="Nota de la decisión" multiline value={note} onChangeText={setNote} maxLength={400} placeholder="Ej.: Hablamos con ambas partes; se reembolsó la diferencia." />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Advertir a la persona reportada" icon="warning-outline" onPress={() => resolve('warn')} loading={busy === 'warn'} disabled={!!busy} />
      <Button label="Suspender su cuenta" icon="ban-outline" variant="danger" onPress={() => resolve('suspend')} loading={busy === 'suspend'} disabled={!!busy} />
      <Button label="Descartar el reporte" variant="ghost" onPress={() => resolve('dismiss')} loading={busy === 'dismiss'} disabled={!!busy} />
    </View>
  );
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => subscribeReports(setReports), []);

  const list = reports?.filter((r) => (tab === 'open' ? r.status === 'open' : r.status !== 'open'));
  // Los de seguridad primero.
  list?.sort((a, b) => Number(b.reason === 'safety') - Number(a.reason === 'safety') || b.createdAt - a.createdAt);
  const openCount = reports?.filter((r) => r.status === 'open').length ?? 0;

  return (
    <Screen>
      <View style={styles.chipWrap} accessibilityRole="radiogroup">
        <Chip label={`Por revisar (${openCount})`} selected={tab === 'open'} onPress={() => setTab('open')} />
        <Chip label="Resueltos" selected={tab === 'closed'} onPress={() => setTab('closed')} />
      </View>

      {!list ? (
        <SkeletonList count={3} />
      ) : list.length === 0 ? (
        <EmptyState icon="flag-outline" text={tab === 'open' ? 'No hay reportes por revisar. ¡Todo en orden!' : 'Todavía no hay reportes resueltos.'} />
      ) : (
        list.map((r) => (
          <Card key={r.id}>
            <View style={styles.chipWrap}>
              <StatusBadge
                label={REPORT_REASONS[r.reason]}
                tone={r.reason === 'safety' || r.reason === 'fraud' ? 'danger' : 'warning'}
                icon={r.reason === 'safety' ? 'alert-circle-outline' : 'flag-outline'}
              />
              {r.resolution && <StatusBadge label={ACTION_LABEL[r.resolution.action]} tone={r.resolution.action === 'dismiss' ? 'neutral' : 'success'} icon="checkmark-done-outline" />}
            </View>
            <AppText variant="heading">
              {r.reporterName} reportó a {r.targetName}
            </AppText>
            <AppText variant="small">
              {r.targetRole === 'provider' ? 'Prestador' : 'Cliente'} · {formatDateTime(r.createdAt)}
            </AppText>
            <AppText>«{r.details}»</AppText>
            {r.resolution && <AppText variant="muted">Decisión: {r.resolution.note}</AppText>}
            <View style={styles.chipWrap}>
              <Button label={`Ver a ${r.targetName.split(' ')[0]}`} variant="secondary" onPress={() => router.push(`/admin/user/${r.targetId}`)} />
              {r.bookingId && <Button label="Ver el servicio" variant="secondary" onPress={() => router.push(`/booking/${r.bookingId}`)} />}
            </View>
            {r.status === 'open' &&
              (openId === r.id ? (
                <Resolver report={r} />
              ) : (
                <Button label="Decidir" icon="hammer-outline" onPress={() => setOpenId(r.id)} />
              ))}
          </Card>
        ))
      )}
    </Screen>
  );
}
