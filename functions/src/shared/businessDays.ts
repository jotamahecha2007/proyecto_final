// Plazos legales en días hábiles (Ley 1581 de 2012: consultas 10 días, reclamos 15 días).
// Cuenta de lunes a viernes y descuenta los festivos de Colombia, incluidos los que se
// trasladan al lunes (Ley 51 de 1983, "Ley Emiliani") y los que dependen de la Semana Santa.
// Este archivo se copia a functions/src/shared con `npm run sync-shared`.

const DAY = 86_400_000;

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher para el calendario gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function nextMonday(d: Date): Date {
  const dow = d.getUTCDay();
  const add = dow === 1 ? 0 : (8 - dow) % 7;
  return new Date(d.getTime() + add * DAY);
}

const key = (d: Date) => d.toISOString().slice(0, 10);

const cache = new Map<number, Set<string>>();

/** Festivos de Colombia de un año, como fechas "AAAA-MM-DD". */
export function colombianHolidays(year: number): Set<string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const utc = (m: number, d: number) => new Date(Date.UTC(year, m - 1, d));
  const easter = easterSunday(year);
  const fromEaster = (days: number) => new Date(easter.getTime() + days * DAY);

  const fixed = [utc(1, 1), utc(5, 1), utc(7, 20), utc(8, 7), utc(12, 8), utc(12, 25)];
  const moved = [utc(1, 6), utc(3, 19), utc(6, 29), utc(8, 15), utc(10, 12), utc(11, 1), utc(11, 11)].map(nextMonday);
  const religious = [
    fromEaster(-3), // Jueves Santo
    fromEaster(-2), // Viernes Santo
    nextMonday(fromEaster(39)), // Ascensión del Señor
    nextMonday(fromEaster(60)), // Corpus Christi
    nextMonday(fromEaster(68)), // Sagrado Corazón
  ];
  const set = new Set([...fixed, ...moved, ...religious].map(key));
  cache.set(year, set);
  return set;
}

/** ¿Es día hábil en Colombia? (usa la fecha de Bogotá, UTC−5). */
export function isBusinessDay(ms: number): boolean {
  const bogota = new Date(ms - 5 * 3_600_000);
  const dow = bogota.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !colombianHolidays(bogota.getUTCFullYear()).has(key(bogota));
}

/**
 * Fecha límite: suma N días hábiles contados desde el día siguiente a la solicitud.
 * Devuelve el final de ese día (23:59 hora de Bogotá).
 */
export function addBusinessDays(fromMs: number, days: number): number {
  let cursor = fromMs;
  let counted = 0;
  while (counted < days) {
    cursor += DAY;
    if (isBusinessDay(cursor)) counted++;
  }
  const bogota = new Date(cursor - 5 * 3_600_000);
  return Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate(), 23, 59) + 5 * 3_600_000;
}

/** Días hábiles que faltan hasta la fecha límite (negativo si ya venció). */
export function businessDaysLeft(nowMs: number, dueMs: number): number {
  if (nowMs > dueMs) {
    let late = 0;
    for (let t = dueMs + DAY; t <= nowMs + DAY / 2; t += DAY) if (isBusinessDay(t)) late++;
    return -Math.max(1, late);
  }
  let left = 0;
  for (let t = nowMs + DAY; t <= dueMs; t += DAY) if (isBusinessDay(t)) left++;
  return left;
}
