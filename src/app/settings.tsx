import { Ionicons } from '@expo/vector-icons';
import { Pressable, useColorScheme, View } from 'react-native';

import { AppText, Card, Checkbox, Screen, StatusBadge, styles } from '@/components/ui';
import { fonts, MIN_TOUCH, radius, resolveTheme, spacing, useTheme, useThemePreference, type ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; help: string; icon: 'sunny-outline' | 'moon-outline' | 'phone-portrait-outline' }[] = [
  { value: 'system', label: 'Automático', help: 'Igual que tu celular', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', help: 'Siempre claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', help: 'Menos brillo', icon: 'moon-outline' },
];

/**
 * Ajustes de la app. Pensada para crecer: cada grupo es una tarjeta (apariencia,
 * accesibilidad y, más adelante, notificaciones o idioma).
 */
export default function Settings() {
  const t = useTheme();
  const system = useColorScheme();
  const { preference, setPreference, highContrast, setHighContrast } = useThemePreference();

  return (
    <Screen>
      <Card>
        <AppText variant="heading">Apariencia</AppText>
        <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="Apariencia de la app">
          {OPTIONS.map((o) => {
            const sel = preference === o.value;
            // Vista previa: los colores reales de ese tema.
            const preview = resolveTheme(o.value, system === 'dark' ? 'dark' : 'light', highContrast);
            return (
              <Pressable
                key={o.value}
                onPress={() => setPreference(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel, checked: sel }}
                accessibilityLabel={`${o.label}. ${o.help}`}
                style={{
                  minHeight: MIN_TOUCH + 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: sel ? 2 : 1,
                  borderColor: sel ? t.primary : t.border,
                  backgroundColor: sel ? t.surfaceAlt : t.surface,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.sm,
                    backgroundColor: preview.bg,
                    borderWidth: 1,
                    borderColor: preview.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={o.icon} size={22} color={preview.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: fonts.bold }}>{o.label}</AppText>
                  <AppText variant="small">{o.help}</AppText>
                </View>
                <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={24} color={sel ? t.primary : t.textMuted} />
              </Pressable>
            );
          })}
        </View>
        {preference === 'system' && (
          <AppText variant="small">Ahora tu celular está en modo {system === 'dark' ? 'oscuro' : 'claro'}.</AppText>
        )}
      </Card>

      <Card>
        <AppText variant="heading">Accesibilidad</AppText>
        <Checkbox checked={highContrast} onChange={setHighContrast}>
          <AppText>Alto contraste</AppText>
          <AppText variant="small">Textos más oscuros (o más claros en modo oscuro) y bordes marcados, para baja visión.</AppText>
        </Checkbox>
        <View style={styles.row}>
          <StatusBadge label={highContrast ? 'Contraste AAA (7:1)' : 'Contraste AA (4,5:1)'} tone="success" icon="contrast-outline" />
        </View>
        <AppText variant="small">
          El tamaño de la letra y «reducir movimiento» siguen la configuración de accesibilidad de tu celular.
        </AppText>
      </Card>
    </Screen>
  );
}
