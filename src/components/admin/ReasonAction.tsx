import type { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { AppText, Button, Card, ErrorText, TextField } from '@/components/ui';
import { spacing, useTheme } from '@/lib/theme';
import { adminErrorMessage } from '@/services/admin';

/**
 * Botón de acción de administrador que, antes de ejecutarse, pide escribir el motivo.
 * El motivo queda en la bitácora y, cuando aplica, se le muestra al usuario afectado.
 * (Funciona igual en Android e iOS: no usa Alert.prompt, que solo existe en iOS.)
 */
export function ReasonAction({
  label,
  icon,
  variant = 'secondary',
  confirmLabel,
  help,
  placeholder,
  minLength = 5,
  onConfirm,
  done,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'secondary' | 'danger';
  confirmLabel?: string;
  help: string;
  placeholder?: string;
  minLength?: number;
  onConfirm: (reason: string) => Promise<unknown>;
  done?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    if (reason.trim().length < minLength) return setError(`Escribe el motivo (mínimo ${minLength} caracteres).`);
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(reason.trim());
      setOpen(false);
      setReason('');
      if (done) AccessibilityInfo.announceForAccessibility(done);
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button label={label} icon={icon} variant={variant} onPress={() => setOpen(true)} />;

  return (
    <Card style={{ borderColor: variant === 'danger' ? t.danger : t.primary, borderWidth: 2 }}>
      <AppText variant="label">{label}</AppText>
      <TextField label="Motivo" help={help} placeholder={placeholder} multiline value={reason} onChangeText={setReason} maxLength={400} />
      {error && <ErrorText>{error}</ErrorText>}
      <View style={{ gap: spacing.sm }}>
        <Button label={confirmLabel ?? label} icon={icon} variant={variant === 'danger' ? 'danger' : 'primary'} onPress={confirm} loading={busy} />
        <Button label="Cancelar" variant="ghost" onPress={() => setOpen(false)} disabled={busy} />
      </View>
    </Card>
  );
}
