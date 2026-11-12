import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppText } from '@/components/ui';
import { fonts, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';

const DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Cuántos días hacia adelante se pueden reservar. */
export const BOOKING_WINDOW_DAYS = 21;

function dateFor(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/**
 * Tira horizontal con los próximos días. Cada día es un botón grande (sin gestos
 * de precisión) que el lector de pantalla anuncia con la fecha completa.
 */
export function DayPicker({ value, onChange }: { value: number; onChange: (offset: number) => void }) {
  const t = useTheme();
  const selected = dateFor(value);

  return (
    <View style={{ gap: spacing.xs }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Día del servicio"
      >
        {Array.from({ length: BOOKING_WINDOW_DAYS }, (_, offset) => {
          const d = dateFor(offset);
          const isSel = offset === value;
          const top = offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : DAYS_SHORT[d.getDay()];
          const fg = isSel ? t.primaryText : t.text;
          return (
            <Pressable
              key={offset}
              onPress={() => onChange(offset)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSel, checked: isSel }}
              accessibilityLabel={`${offset === 0 ? 'Hoy, ' : offset === 1 ? 'Mañana, ' : ''}${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`}
              style={{
                minWidth: 64,
                minHeight: MIN_TOUCH + 20,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: isSel ? t.primary : t.border,
                backgroundColor: isSel ? t.primary : t.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: fg, fontSize: 13, fontFamily: fonts.semibold }}>{top}</Text>
              <Text style={{ color: fg, fontSize: 20, fontFamily: fonts.bold }}>{d.getDate()}</Text>
              <Text style={{ color: fg, fontSize: 12, fontFamily: fonts.regular }}>{MONTHS[d.getMonth()]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <AppText variant="small">
        Desliza para ver más días (hasta {BOOKING_WINDOW_DAYS} días). Elegido: {DAYS_LONG[selected.getDay()]} {selected.getDate()} de{' '}
        {MONTHS_LONG[selected.getMonth()]}.
      </AppText>
    </View>
  );
}
