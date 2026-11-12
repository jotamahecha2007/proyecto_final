import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppText } from '@/components/ui';
import { dayLabel, timeLabel } from '@/lib/schedule';
import { fonts, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';

const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "hoy, jueves 12 de noviembre, a las 14:30" para el lector de pantalla. */
export function slotA11yLabel(ms: number): string {
  const d = new Date(ms);
  const rel = dayLabel(ms);
  const prefix = rel === 'hoy' || rel === 'mañana' ? `${rel}, ` : '';
  return `${prefix}${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}, a las ${timeLabel(ms)}`;
}

/**
 * Horarios libres de un prestador agrupados por día. Cada hora es un botón grande;
 * al principio se muestran pocas para no saturar y se puede pedir ver más.
 */
export function SlotPicker({
  slots,
  value,
  onChange,
  initial = 6,
  label = 'Elige la hora de llegada',
}: {
  slots: number[];
  value?: number;
  onChange: (ms: number) => void;
  initial?: number;
  label?: string;
}) {
  const t = useTheme();
  const [all, setAll] = useState(false);
  const shown = all ? slots : slots.slice(0, initial);

  const groups: { day: string; items: number[] }[] = [];
  for (const s of shown) {
    const day = dayLabel(s);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(s);
    else groups.push({ day, items: [s] });
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      {groups.map((g) => (
        <View key={g.day} style={{ gap: spacing.xs }}>
          <AppText variant="small">{g.day.charAt(0).toUpperCase() + g.day.slice(1)}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="radiogroup">
            {g.items.map((s) => {
              const sel = s === value;
              return (
                <Pressable
                  key={s}
                  onPress={() => onChange(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel, checked: sel }}
                  accessibilityLabel={slotA11yLabel(s)}
                  style={{
                    minHeight: MIN_TOUCH,
                    minWidth: 76,
                    paddingHorizontal: spacing.md,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: sel ? t.primary : t.border,
                    backgroundColor: sel ? t.primary : t.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: sel ? t.primaryText : t.text, fontFamily: fonts.bold, fontSize: 16 }}>{timeLabel(s)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {slots.length > initial && (
        <Pressable onPress={() => setAll((v) => !v)} accessibilityRole="button" style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
          <Text style={{ color: t.primary, fontFamily: fonts.bold, fontSize: 15 }}>
            {all ? 'Ver menos horarios' : `Ver más horarios (${slots.length - initial})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
