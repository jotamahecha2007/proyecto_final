// Componentes base. Todos cumplen los criterios de la sección de accesibilidad:
// etiquetas para lector de pantalla, área de toque ≥ 48 px, estados con texto + ícono
// (nunca solo color) y texto que respeta el tamaño de fuente del sistema.

import { Ionicons } from '@expo/vector-icons';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Altura del encabezado de la pantalla actual (0 si no tiene). */
export function useHeaderOffset() {
  return useContext(HeaderHeightContext) ?? 0;
}

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  const headerHeight = useHeaderOffset();
  const content = <View style={[{ padding: spacing.lg, gap: spacing.lg }, style]}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Con edge-to-edge (Android 15+) el sistema ya no achica la pantalla al abrir el teclado:
          hay que hacerlo con padding en ambas plataformas. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label';

export function AppText({ variant = 'body', style, children, ...rest }: TextProps & { variant?: Variant }) {
  const t = useTheme();
  const base = {
    title: { fontSize: 28, lineHeight: 36, fontFamily: fonts.title, color: t.text },
    heading: { fontSize: 19, lineHeight: 25, fontFamily: fonts.bold, color: t.text },
    body: { fontSize: 16, lineHeight: 23, fontFamily: fonts.regular, color: t.text },
    muted: { fontSize: 15, lineHeight: 21, fontFamily: fonts.regular, color: t.textMuted },
    small: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular, color: t.textMuted },
    label: { fontSize: 15, lineHeight: 21, fontFamily: fonts.semibold, color: t.text },
  }[variant];
  const isHeader = variant === 'title' || variant === 'heading';
  return (
    <Text accessibilityRole={isHeader ? 'header' : undefined} style={[base, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const t = useTheme();
  const palette = {
    primary: { bg: t.primary, fg: t.primaryText, border: t.primary },
    // Azul claro con texto azul, como el botón «MENÚ» de la referencia.
    secondary: { bg: t.surfaceAlt, fg: t.primary, border: t.surfaceAlt },
    danger: { bg: t.surface, fg: t.danger, border: t.danger },
    ghost: { bg: 'transparent', fg: t.primary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={palette.fg} />}
          <Text style={{ color: palette.fg, fontSize: 16, fontFamily: fonts.semibold }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  help,
  ...props
}: TextInputProps & { label: string; error?: string; help?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      {help && <AppText variant="small">{help}</AppText>}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={help}
        placeholderTextColor={t.textMuted}
        style={[
          styles.input,
          {
            color: t.text,
            backgroundColor: t.surface,
            borderColor: error ? t.danger : t.border,
            minHeight: props.multiline ? 120 : MIN_TOUCH,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
        ]}
        {...props}
      />
      {error && (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={t.danger} />
          <AppText variant="small" style={{ color: t.danger }}>
            {error}
          </AppText>
        </View>
      )}
    </View>
  );
}

export function Chip({ label, selected, onPress, multi }: { label: string; selected: boolean; onPress: () => void; multi?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        { backgroundColor: selected ? t.primary : t.surface, borderColor: selected ? t.primary : t.border },
      ]}
    >
      {selected && <Ionicons name="checkmark" size={16} color={t.primaryText} />}
      <Text style={{ color: selected ? t.primaryText : t.text, fontSize: 15, fontFamily: fonts.medium }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, shadowColor: t.shadow, shadowOpacity: t.shadowOpacity }, style]}>{children}</View>
  );
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Estado con ícono + texto. El color refuerza, pero nunca es la única señal. */
export function StatusBadge({ label, tone, icon }: { label: string; tone: Tone; icon: IconName }) {
  const t = useTheme();
  const color = { success: t.success, warning: t.warning, danger: t.danger, info: t.info, neutral: t.textMuted }[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]} accessible accessibilityLabel={`Estado: ${label}`}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 12, fontFamily: fonts.semibold, letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}

/** Selector numérico con botones − / + (sin arrastrar, apto para temblores o switch access). */
export function Stepper({
  label,
  value,
  display,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
}: {
  label: string;
  value: number;
  display?: string;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const t = useTheme();
  const shown = display ?? String(value);
  const btn = (icon: IconName, delta: number, a11y: string) => {
    const next = value + delta;
    const disabled = next < min || next > max;
    return (
      <Pressable
        onPress={() => !disabled && onChange(next)}
        accessibilityRole="button"
        accessibilityLabel={`${a11y} ${label}`}
        accessibilityState={{ disabled }}
        style={[styles.stepBtn, { borderColor: t.border, opacity: disabled ? 0.4 : 1 }]}
      >
        <Ionicons name={icon} size={22} color={t.text} />
      </Pressable>
    );
  };
  return (
    <View
      style={[styles.row, { justifyContent: 'space-between' }]}
      accessible={false}
    >
      <AppText variant="label" style={{ flex: 1 }}>
        {label}
      </AppText>
      <View style={styles.row}>
        {btn('remove', -step, 'Disminuir')}
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${label}: ${shown}`}
          style={{ minWidth: 72, textAlign: 'center', color: t.text, fontSize: 16, fontFamily: fonts.semibold }}
        >
          {shown}
        </Text>
        {btn('add', step, 'Aumentar')}
      </View>
    </View>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const t = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${value.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={t.accent}
        />
      ))}
    </View>
  );
}

export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const labels = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Calificación">
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === i, checked: value === i }}
            accessibilityLabel={`${i} ${i === 1 ? 'estrella' : 'estrellas'}, ${labels[i - 1]}`}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={value >= i ? 'star' : 'star-outline'} size={32} color={t.accent} />
          </Pressable>
        ))}
      </View>
      {value > 0 && <AppText variant="muted">{labels[value - 1]}</AppText>}
    </View>
  );
}

/** Explica qué pasa en cada paso, para reducir la incertidumbre (ver Cognición). */
export function NextSteps({ title = '¿Qué pasa ahora?', steps }: { title?: string; steps: { text: string; done?: boolean }[] }) {
  const t = useTheme();
  return (
    <Card style={{ backgroundColor: t.surfaceAlt }}>
      <AppText variant="label">{title}</AppText>
      {steps.map((s, i) => (
        <View key={i} style={[styles.row, { alignItems: 'flex-start' }]}>
          <Ionicons
            name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={s.done ? t.success : t.textMuted}
            accessibilityLabel={s.done ? 'Hecho' : 'Pendiente'}
          />
          <AppText style={{ flex: 1 }}>{s.text}</AppText>
        </View>
      ))}
    </Card>
  );
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
      <Ionicons name={icon} size={40} color={t.textMuted} />
      <AppText variant="muted" style={{ textAlign: 'center' }}>
        {text}
      </AppText>
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator size="large" color={t.primary} accessibilityLabel="Cargando" />
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, fontFamily: fonts.regular },
  chip: {
    minHeight: MIN_TOUCH - 8,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    // Sombra suave para separar las tarjetas del fondo sin bordes duros.
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  stepBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

export function ErrorText({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.row} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={t.danger} />
      <AppText style={{ color: t.danger, flex: 1 }}>{children}</AppText>
    </View>
  );
}

/** Casilla de verificación accesible (área de toque completa, rol "checkbox"). */
export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: MIN_TOUCH, paddingVertical: spacing.xs }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? t.primary : t.textMuted,
          backgroundColor: checked ? t.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked && <Ionicons name="checkmark" size={18} color={t.primaryText} />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}
