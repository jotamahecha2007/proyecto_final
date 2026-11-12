import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, Chip, ErrorText, TextField, styles } from '@/components/ui';
import { fonts, formatDateTime, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';
import type { AdminLogEntry } from '@/lib/types';
import { adminErrorMessage, adminNotify } from '@/services/admin';

type Icon = ComponentProps<typeof Ionicons>['name'];

/** Cifra grande con su etiqueta. */
export function StatTile({ label, value, icon, hint, width }: { label: string; value: string | number; icon: Icon; hint?: string; width: number }) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}
      style={{ width, backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, padding: spacing.md, gap: 4 }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <AppText variant="small">{label}</AppText>
        <Ionicons name={icon} size={18} color={t.primary} />
      </View>
      <AppText style={{ fontSize: 26, lineHeight: 32, fontFamily: fonts.bold, color: t.text }}>{value}</AppText>
      {hint && <AppText variant="small">{hint}</AppText>}
    </View>
  );
}

/**
 * Barras horizontales con la cifra escrita al lado (la barra es apoyo visual; el número
 * es el dato, así que se entiende sin ver el color ni el largo).
 */
export function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const t = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r) => (
        <View key={r.label} accessible accessibilityLabel={`${r.label}: ${r.value}`} style={{ gap: 4 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <AppText variant="small" style={{ color: t.text }}>
              {r.label}
            </AppText>
            <AppText variant="small" style={{ color: t.text, fontFamily: fonts.semibold }}>
              {r.value}
            </AppText>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surfaceAlt }}>
            <View style={{ height: 8, borderRadius: 4, width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, backgroundColor: t.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Formulario para enviar un aviso a una persona (to = uid) o a un grupo. */
export function NotifyForm({ to, toName }: { to?: string; toName?: string }) {
  const [group, setGroup] = useState<'all' | 'clients' | 'providers'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<string>();

  async function send() {
    if (title.trim().length < 3 || body.trim().length < 3) return setError('Escribe un título y un mensaje.');
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const r = await adminNotify(to ?? group, title.trim(), body.trim());
      setResult(`Aviso enviado a ${r.sent} ${r.sent === 1 ? 'persona' : 'personas'}.`);
      setTitle('');
      setBody('');
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <AppText variant="label">{to ? `Enviar un aviso a ${toName?.split(' ')[0] ?? 'este usuario'}` : 'Enviar un aviso'}</AppText>
      {!to && (
        <View style={styles.chipWrap} accessibilityRole="radiogroup" accessibilityLabel="Destinatarios">
          <Chip label="Todos" selected={group === 'all'} onPress={() => setGroup('all')} />
          <Chip label="Clientes" selected={group === 'clients'} onPress={() => setGroup('clients')} />
          <Chip label="Prestadores" selected={group === 'providers'} onPress={() => setGroup('providers')} />
        </View>
      )}
      <TextField label="Título" value={title} onChangeText={setTitle} maxLength={80} />
      <TextField label="Mensaje" multiline value={body} onChangeText={setBody} maxLength={400} />
      {error && <ErrorText>{error}</ErrorText>}
      {result && (
        <AppText variant="small" accessibilityLiveRegion="polite">
          {result}
        </AppText>
      )}
      <Button label="Enviar aviso" icon="megaphone-outline" onPress={send} loading={busy} />
    </Card>
  );
}

/** Lista de la bitácora: quién hizo qué y cuándo. */
export function AdminLogList({ entries }: { entries: AdminLogEntry[] }) {
  const t = useTheme();
  if (!entries.length) return <AppText variant="muted">Todavía no hay acciones registradas.</AppText>;
  return (
    <View style={{ gap: spacing.sm }}>
      {entries.map((e) => (
        <Pressable
          key={e.id}
          disabled={!e.targetId}
          onPress={() => e.targetId && e.targetName && router.push(`/admin/user/${e.targetId}`)}
          accessibilityRole={e.targetName ? 'button' : undefined}
          accessibilityLabel={`${e.adminName} ${e.action.toLowerCase()}${e.targetName ? ` a ${e.targetName}` : ''}. ${e.details}. ${formatDateTime(e.createdAt)}`}
          style={{ flexDirection: 'row', gap: spacing.sm, minHeight: MIN_TOUCH, alignItems: 'flex-start' }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary, marginTop: 7 }} />
          <View style={{ flex: 1 }}>
            <AppText variant="label">
              {e.action}
              {e.targetName ? ` · ${e.targetName}` : ''}
            </AppText>
            <AppText variant="small" numberOfLines={2}>
              {e.details}
            </AppText>
            <AppText variant="small">
              {e.adminName} · {formatDateTime(e.createdAt)}
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
