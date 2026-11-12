import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, Button, Card, ErrorText, Screen, StatusBadge, TextField } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';
import { REPORT_REASONS, type ReportReason, type Role } from '@/lib/types';
import { createReport } from '@/services/admin';

/** Reportar a otro usuario. Lo revisa el equipo de TeAyudo (administradores). */
export default function ReportScreen() {
  const t = useTheme();
  const { user, profile } = useSession();
  const p = useLocalSearchParams<{ targetId: string; targetName: string; targetRole: Role; bookingId?: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  async function send() {
    if (!reason) return setError('Elige el motivo del reporte.');
    if (details.trim().length < 10) return setError('Cuéntanos qué pasó (mínimo 10 caracteres).');
    setBusy(true);
    setError(undefined);
    try {
      await createReport({
        reporterId: user.uid,
        reporterName: profile.name,
        targetId: p.targetId,
        targetName: p.targetName ?? 'Usuario',
        targetRole: p.targetRole === 'client' ? 'client' : 'provider',
        bookingId: p.bookingId,
        reason,
        details,
      });
      setSent(true);
    } catch {
      setError('No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <StatusBadge label="Reporte enviado" tone="success" icon="checkmark-circle-outline" />
        <AppText variant="title">Gracias por avisarnos</AppText>
        <AppText>El equipo de TeAyudo revisará el caso y te avisará por notificación qué decidimos. {p.targetName?.split(' ')[0]} no sabrá quién lo reportó.</AppText>
        {reason === 'safety' && (
          <Card>
            <AppText variant="label">Si estás en peligro ahora</AppText>
            <AppText>Llama a la Línea 123 (Policía y emergencias en Bogotá).</AppText>
          </Card>
        )}
        <Button label="Volver" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Reportar a {p.targetName?.split(' ')[0] ?? 'este usuario'}</AppText>
      <AppText variant="muted">Tu reporte es confidencial: la otra persona no sabrá quién lo envió.</AppText>
      <Card>
        <AppText variant="label">¿Qué pasó?</AppText>
        <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup">
          {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => {
            const selected = reason === r;
            return (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={REPORT_REASONS[r]}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  minHeight: MIN_TOUCH,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selected ? t.primary : t.border,
                  backgroundColor: selected ? t.surfaceAlt : t.surface,
                }}
              >
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? t.primary : t.textMuted} />
                <AppText style={{ flex: 1 }}>{REPORT_REASONS[r]}</AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {reason === 'safety' && (
        <Card style={{ borderColor: t.danger, borderWidth: 2 }}>
          <AppText variant="label">Si estás en peligro ahora, llama a la Línea 123.</AppText>
          <AppText variant="muted">Este reporte llega al equipo de TeAyudo, pero no reemplaza a la Policía.</AppText>
        </Card>
      )}
      <TextField label="Cuéntanos los detalles" help="Fecha, qué pasó y cualquier dato que nos ayude a revisarlo." multiline value={details} onChangeText={setDetails} maxLength={1000} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Enviar reporte" icon="flag-outline" onPress={send} loading={busy} />
    </Screen>
  );
}
