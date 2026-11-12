import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SkeletonList } from '@/components/Skeleton';
import { AppText, Button, Card, Chip, EmptyState, ErrorText, Screen, StatusBadge, TextField, styles } from '@/components/ui';
import { businessDaysLeft } from '@/lib/businessDays';
import { formatDateTime, radius, spacing, useTheme } from '@/lib/theme';
import { DATA_REQUEST_TYPES, type DataRequest } from '@/lib/types';
import { adminAnswerDataRequest, adminErrorMessage, subscribeDataRequests } from '@/services/admin';

function Answer({ request }: { request: DataRequest }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    if (text.trim().length < 10) return setError('Escribe una respuesta completa (mínimo 10 caracteres).');
    setBusy(true);
    setError(undefined);
    try {
      await adminAnswerDataRequest(request.id, text.trim());
    } catch (e) {
      setError(adminErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label="Respuesta al titular"
        help="La recibe por notificación y queda en su pantalla «Mis datos y privacidad»."
        multiline
        value={text}
        onChangeText={setText}
        maxLength={2000}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Enviar respuesta" icon="send-outline" onPress={send} loading={busy} />
    </View>
  );
}

/** Solicitudes de habeas data con el semáforo de plazos legales. */
export default function AdminDataRequests() {
  const t = useTheme();
  const [items, setItems] = useState<DataRequest[] | null>(null);
  const [tab, setTab] = useState<'open' | 'answered'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => subscribeDataRequests(setItems), []);

  const now = Date.now();
  const list = items?.filter((r) => r.status === tab).sort((a, b) => (tab === 'open' ? a.dueAt - b.dueAt : b.createdAt - a.createdAt));
  const openCount = items?.filter((r) => r.status === 'open').length ?? 0;
  const overdue = items?.filter((r) => r.status === 'open' && r.dueAt < now).length ?? 0;

  return (
    <Screen>
      <AppText variant="muted">
        Plazos de la Ley 1581: consultas 10 días hábiles, reclamos y demás solicitudes 15 días hábiles (sin contar fines de semana ni festivos de Colombia).
      </AppText>
      {overdue > 0 && (
        <StatusBadge label={`${overdue} ${overdue === 1 ? 'solicitud vencida' : 'solicitudes vencidas'}`} tone="danger" icon="alert-circle-outline" />
      )}
      <View style={styles.chipWrap} accessibilityRole="radiogroup">
        <Chip label={`Por responder (${openCount})`} selected={tab === 'open'} onPress={() => setTab('open')} />
        <Chip label="Respondidas" selected={tab === 'answered'} onPress={() => setTab('answered')} />
      </View>

      {!list ? (
        <SkeletonList count={2} />
      ) : list.length === 0 ? (
        <EmptyState icon="document-lock-outline" text={tab === 'open' ? 'No hay solicitudes pendientes.' : 'Todavía no hay solicitudes respondidas.'} />
      ) : (
        list.map((r) => {
          const left = businessDaysLeft(now, r.dueAt);
          const tone = r.status === 'answered' ? 'success' : left < 0 ? 'danger' : left <= 2 ? 'warning' : 'info';
          const label =
            r.status === 'answered'
              ? r.response && r.response.at > r.dueAt
                ? 'Respondida fuera de plazo'
                : 'Respondida a tiempo'
              : left < 0
                ? `Vencida hace ${-left} ${left === -1 ? 'día hábil' : 'días hábiles'}`
                : left === 0
                  ? 'Vence hoy'
                  : `Quedan ${left} ${left === 1 ? 'día hábil' : 'días hábiles'}`;
          return (
            <Card key={r.id}>
              <View style={styles.chipWrap}>
                <StatusBadge label={DATA_REQUEST_TYPES[r.type].label} tone="neutral" icon="document-text-outline" />
                <StatusBadge label={label} tone={tone} icon={r.status === 'answered' ? 'checkmark-done-outline' : 'time-outline'} />
              </View>
              <AppText variant="heading">{r.userName}</AppText>
              <AppText variant="small">
                {r.userEmail} · recibida {formatDateTime(r.createdAt)} · límite {formatDateTime(r.dueAt)}
              </AppText>
              <AppText>«{r.message}»</AppText>
              {r.response && (
                <View style={{ gap: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: t.surfaceAlt }}>
                  <AppText variant="label">Respuesta de {r.response.adminName}</AppText>
                  <AppText>{r.response.text}</AppText>
                  <AppText variant="small">{formatDateTime(r.response.at)}</AppText>
                </View>
              )}
              <Button label={`Ver ficha de ${r.userName.split(' ')[0]}`} variant="secondary" onPress={() => router.push(`/admin/user/${r.userId}`)} />
              {r.status === 'open' &&
                (openId === r.id ? <Answer request={r} /> : <Button label="Responder" icon="create-outline" onPress={() => setOpenId(r.id)} />)}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
