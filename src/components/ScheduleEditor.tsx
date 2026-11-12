import { Switch, View } from 'react-native';

import { AppText, Card, Stepper, styles } from '@/components/ui';
import { DAY_NAMES, minutesToLabel } from '@/lib/schedule';
import { spacing, useTheme } from '@/lib/theme';
import type { WeeklySchedule } from '@/lib/types';

// Lunes primero, que es como se piensa la semana laboral en Colombia.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleEditor({ value, onChange }: { value: WeeklySchedule; onChange: (s: WeeklySchedule) => void }) {
  const t = useTheme();
  const set = (day: number, v: WeeklySchedule[number]) => onChange(value.map((d, i) => (i === day ? v : d)));

  return (
    <View style={{ gap: spacing.md }}>
      {ORDER.map((day) => {
        const d = value[day];
        return (
          <Card key={day}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <AppText variant="label">{DAY_NAMES[day]}</AppText>
              <View style={styles.row}>
                <AppText variant="small">{d ? 'Trabaja' : 'Descansa'}</AppText>
                <Switch
                  value={!!d}
                  onValueChange={(on) => set(day, on ? { start: 8 * 60, end: 17 * 60 } : null)}
                  accessibilityLabel={`${DAY_NAMES[day]}: ${d ? 'trabaja' : 'descansa'}`}
                  trackColor={{ true: t.primary, false: t.border }}
                />
              </View>
            </View>
            {d && (
              <>
                <Stepper
                  label="Desde"
                  value={d.start}
                  display={minutesToLabel(d.start)}
                  step={30}
                  min={5 * 60}
                  max={d.end - 60}
                  onChange={(v) => set(day, { ...d, start: v })}
                />
                <Stepper
                  label="Hasta"
                  value={d.end}
                  display={minutesToLabel(d.end)}
                  step={30}
                  min={d.start + 60}
                  max={22 * 60}
                  onChange={(v) => set(day, { ...d, end: v })}
                />
              </>
            )}
          </Card>
        );
      })}
    </View>
  );
}
