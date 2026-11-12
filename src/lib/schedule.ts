import type { DaySchedule, TimeSlot, WeeklySchedule } from './types';

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const DEFAULT_SCHEDULE: WeeklySchedule = [
  null,
  { start: 8 * 60, end: 17 * 60 },
  { start: 8 * 60, end: 17 * 60 },
  { start: 8 * 60, end: 17 * 60 },
  { start: 8 * 60, end: 17 * 60 },
  { start: 8 * 60, end: 17 * 60 },
  { start: 8 * 60, end: 13 * 60 },
];

const MINUTE = 60_000;

export function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Tiempo que el prestador queda bloqueado al ser contratado:
 * desplazamiento de ida + duración estimada del trabajo.
 */
export function blockedSlot(start: number, durationHours: number, travelMin: number): TimeSlot {
  return {
    start: start - travelMin * MINUTE,
    end: start + Math.round(durationHours * 60) * MINUTE,
  };
}

export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return a.start < b.end && b.start < a.end;
}

/** ¿El bloque cabe dentro del horario laboral del día? Usa la hora local del dispositivo. */
export function withinWorkingHours(schedule: WeeklySchedule, slot: TimeSlot): boolean {
  const s = new Date(slot.start);
  const e = new Date(slot.end);
  if (s.toDateString() !== e.toDateString()) return false;
  const day: DaySchedule | null = schedule[s.getDay()] ?? null;
  if (!day) return false;
  const startMin = s.getHours() * 60 + s.getMinutes();
  const endMin = e.getHours() * 60 + e.getMinutes();
  return startMin >= day.start && endMin <= day.end;
}

/** Disponible = dentro del horario laboral y sin cruces con otros trabajos confirmados. */
export function isAvailable(schedule: WeeklySchedule, busy: TimeSlot[], slot: TimeSlot): boolean {
  return withinWorkingHours(schedule, slot) && !busy.some((b) => overlaps(b, slot));
}

// ---------------------------------------------------------------------------
// Horarios disponibles: en vez de que el cliente adivine una hora, la app le muestra
// las horas en que cada prestador sí puede llegar.
// ---------------------------------------------------------------------------

export interface SlotOptions {
  schedule: WeeklySchedule;
  busy: TimeSlot[];
  travelMin: number;
  durationHours: number;
  /** Desde cuándo buscar (ms). */
  from: number;
  /** Cuántos días buscar a partir de `from`. */
  days: number;
  /** "Ahora", para no ofrecer horas que ya pasaron. */
  now: number;
  /** Anticipación mínima antes de salir hacia el cliente (minutos). */
  leadMin?: number;
  /** Cada cuántos minutos se ofrece una hora de llegada. */
  stepMin?: number;
  /** Máximo de horas a devolver. */
  max?: number;
}

/**
 * Horas de llegada posibles. Una hora sirve si el desplazamiento + el trabajo caben en el
 * horario laboral de ese día, no se cruzan con otro trabajo confirmado y dejan tiempo
 * suficiente para que el prestador alcance a salir.
 */
export function availableSlots(o: SlotOptions): number[] {
  const step = o.stepMin ?? 30;
  const lead = o.leadMin ?? 60;
  const max = o.max ?? 12;
  const durationMin = Math.round(o.durationHours * 60);
  const earliestArrival = o.now + (lead + o.travelMin) * MINUTE;
  const out: number[] = [];

  const day0 = new Date(o.from);
  day0.setHours(0, 0, 0, 0);
  for (let i = 0; i < o.days && out.length < max; i++) {
    const day = new Date(day0);
    day.setDate(day0.getDate() + i);
    const hours = o.schedule[day.getDay()];
    if (!hours) continue;
    // La primera llegada posible deja tiempo para el desplazamiento dentro del horario.
    const firstMin = Math.ceil((hours.start + o.travelMin) / step) * step;
    for (let m = firstMin; m + durationMin <= hours.end && out.length < max; m += step) {
      const start = new Date(day);
      start.setMinutes(m);
      const t = start.getTime();
      if (t < earliestArrival || t < o.from) continue;
      const slot = blockedSlot(t, o.durationHours, o.travelMin);
      if (!o.busy.some((b) => overlaps(b, slot))) out.push(t);
    }
  }
  return out;
}

const DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "hoy", "mañana" o "vie 14 nov". */
export function dayLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function timeLabel(ms: number): string {
  const d = new Date(ms);
  return minutesToLabel(d.getHours() * 60 + d.getMinutes());
}

/** "hoy 14:30", "mañana 9:00", "vie 14 nov 9:00". */
export function slotLabel(ms: number, now = Date.now()): string {
  return `${dayLabel(ms, now)} ${timeLabel(ms)}`;
}

/** Cómo se muestra el "cuándo" de una solicitud: «Lo antes posible», «Para mañana», «Para el vie 14 nov». */
export function requestWhenLabel(r: { whenMode?: 'asap' | 'day'; desiredStart: number }, now = Date.now()): string {
  if (r.whenMode === 'asap') return 'Lo antes posible';
  const day = dayLabel(r.desiredStart, now);
  if (r.whenMode === 'day') return day === 'hoy' || day === 'mañana' ? `Para ${day}` : `Para el ${day}`;
  return slotLabel(r.desiredStart, now); // solicitudes antiguas con hora fija
}
