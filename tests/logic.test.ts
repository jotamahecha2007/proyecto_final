/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyByRules, extractBudget, sanitizeAttributes } from '../src/lib/classifierRules';
import { distanceKm, travelMinutes } from '../src/lib/geo';
import { rankProviders, type MatchCandidate } from '../src/lib/matching';
import { availableSlots, blockedSlot, isAvailable, overlaps, DEFAULT_SCHEDULE } from '../src/lib/schedule';
import { computeTrust } from '../src/lib/trustScore';
import type { ProviderProfile } from '../src/lib/types';

const CHAPINERO = { lat: 4.6486, lng: -74.0628 };
const USAQUEN = { lat: 4.6951, lng: -74.0307 };
const SUBA = { lat: 4.7411, lng: -74.0838 };

// Un martes a las 10:00 hora local.
/** "Ahora" fijo para las pruebas: lunes 9 nov 2026, 20:00. */
const NOW = new Date(2026, 10, 9, 20, 0, 0, 0).getTime();
const TUESDAY = new Date(2026, 10, 10, 0, 0, 0, 0).getTime();

function nextTuesdayAt(hour: number): number {
  const d = new Date(2026, 10, 10, hour, 0, 0, 0); // 10 nov 2026 es martes
  return d.getTime();
}

function provider(over: Partial<ProviderProfile>): ProviderProfile {
  return {
    uid: 'p',
    name: 'Prestador',
    bio: 'bio',
    categories: ['plomeria'],
    hourlyRate: 40000,
    serviceRadiusKm: 12,
    location: CHAPINERO,
    schedule: DEFAULT_SCHEDULE,
    identityDeclared: true,
    stats: { ratingSum: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0 },
    trustScore: 60,
    updatedAt: 0,
    ...over,
  };
}

test('clasificador por reglas detecta categoría, urgencia y presupuesto', () => {
  const r = classifyByRules('Urgente! se me está inundando el baño, la tubería del lavamanos tiene una fuga. Tengo hasta 150 mil');
  assert.equal(r.category, 'plomeria');
  assert.equal(r.urgency, 'alta');
  assert.equal(r.budgetMax, 150000);

  const e = classifyByRules('Necesito instalar dos tomacorrientes y revisar el breaker, sin afán');
  assert.equal(e.category, 'electricidad');
  assert.equal(e.urgency, 'baja');
});

test('extracción de presupuesto en distintos formatos', () => {
  assert.equal(extractBudget('pago $120.000'), 120000);
  assert.equal(extractBudget('unos 200k'), 200000);
  assert.equal(extractBudget('presupuesto 90000 pesos'), 90000);
  assert.equal(extractBudget('dos horas de trabajo'), undefined);
});

test('sanitizeAttributes repara respuestas inválidas del LLM', () => {
  const s = sanitizeAttributes({ category: 'astronauta', urgency: 'altísima', estimatedHours: 99 }, 'arreglar la lavadora');
  assert.equal(s.category, 'electrodomesticos');
  assert.equal(s.urgency, 'media');
  assert.equal(s.estimatedHours, 2);
});

test('distancia y tiempo de desplazamiento son razonables', () => {
  const d = distanceKm(CHAPINERO, USAQUEN);
  assert.ok(d > 5 && d < 7, `distancia ${d}`);
  const t = travelMinutes(CHAPINERO, USAQUEN);
  assert.equal(t % 5, 0);
  assert.ok(t >= 30 && t <= 45, `tiempo ${t}`);
});

test('agenda: bloquea trabajo + desplazamiento y detecta cruces', () => {
  const start = nextTuesdayAt(10);
  const slot = blockedSlot(start, 2, 30);
  assert.equal(slot.start, start - 30 * 60_000);
  assert.equal(slot.end, start + 120 * 60_000);
  assert.ok(isAvailable(DEFAULT_SCHEDULE, [], slot));
  assert.ok(!isAvailable(DEFAULT_SCHEDULE, [{ start: start + 60 * 60_000, end: start + 3 * 3600_000 }], slot));
  // Fuera de horario: martes 16:00 + 2 h termina después de las 17:00.
  assert.ok(!isAvailable(DEFAULT_SCHEDULE, [], blockedSlot(nextTuesdayAt(16), 2, 15)));
  assert.ok(overlaps({ start: 0, end: 10 }, { start: 5, end: 15 }));
  assert.ok(!overlaps({ start: 0, end: 10 }, { start: 10, end: 15 }));
});

test('Trust Score: un prestador nuevo queda en zona media y sube con buen historial', () => {
  const profile = { hasBio: true, hasPhoto: false, hasSchedule: true, hasCategories: true, identityDeclared: true };
  const nuevo = computeTrust({ ratingSum: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0, profile });
  const bueno = computeTrust({ ratingSum: 98, ratingCount: 20, completedJobs: 20, cancelledJobs: 0, profile });
  const malo = computeTrust({ ratingSum: 30, ratingCount: 15, completedJobs: 10, cancelledJobs: 8, profile });
  assert.ok(nuevo.score >= 55 && nuevo.score <= 70, `nuevo ${nuevo.score}`);
  assert.ok(bueno.score >= 85, `bueno ${bueno.score}`);
  assert.ok(malo.score < nuevo.score, `malo ${malo.score}`);
  // Una sola reseña de 1 estrella no hunde a un prestador nuevo.
  const unaMala = computeTrust({ ratingSum: 1, ratingCount: 1, completedJobs: 1, cancelledJobs: 0, profile });
  assert.ok(unaMala.score > 45, `una mala ${unaMala.score}`);
});

test('matching: filtra por categoría y radio, prioriza confianza y devuelve máximo 3', () => {
  const candidates: MatchCandidate[] = [
    { provider: provider({ uid: 'cerca-confiable', location: CHAPINERO, trustScore: 90 }), busy: [] },
    { provider: provider({ uid: 'cerca-nuevo', location: CHAPINERO, trustScore: 55 }), busy: [] },
    { provider: provider({ uid: 'lejos', location: SUBA, trustScore: 95, serviceRadiusKm: 5 }), busy: [] },
    { provider: provider({ uid: 'electricista', categories: ['electricidad'], trustScore: 99 }), busy: [] },
    { provider: provider({ uid: 'medio', location: USAQUEN, trustScore: 80 }), busy: [] },
    { provider: provider({ uid: 'otro', location: USAQUEN, trustScore: 70 }), busy: [] },
  ];
  const res = rankProviders(
    {
      attributes: { category: 'plomeria', urgency: 'media', estimatedHours: 2, keywords: [] },
      location: CHAPINERO,
      desiredStart: TUESDAY,
      whenMode: 'day',
      now: NOW,
    },
    candidates,
  );
  assert.equal(res.length, 3);
  const ids = res.map((r) => r.provider.uid);
  assert.ok(!ids.includes('lejos'), 'respeta el radio de servicio');
  assert.ok(!ids.includes('electricista'), 'respeta la categoría');
  assert.equal(ids[0], 'cerca-confiable');
  assert.ok(res.every((r) => r.available));
});

test('horarios libres: respetan horario laboral, desplazamiento y otros trabajos', () => {
  const busy = [{ start: nextTuesdayAt(10), end: nextTuesdayAt(12) }];
  const slots = availableSlots({ schedule: DEFAULT_SCHEDULE, busy, travelMin: 30, durationHours: 2, from: TUESDAY, days: 1, now: NOW, max: 50 });
  const hours = slots.map((t) => new Date(t).getHours() + new Date(t).getMinutes() / 60);
  // La primera llegada posible (8:30) terminaría a las 10:30 y chocaría con el trabajo de 10 a 12,
  // así que el primer horario es 12:30 (sale a las 12:00). El último termina a las 17:00.
  assert.deepEqual(hours, [12.5, 13, 13.5, 14, 14.5, 15]);
  // Sin otros trabajos, sí puede llegar a las 8:30.
  const free = availableSlots({ schedule: DEFAULT_SCHEDULE, busy: [], travelMin: 30, durationHours: 2, from: TUESDAY, days: 1, now: NOW, max: 1 });
  assert.equal(new Date(free[0]).getHours() + new Date(free[0]).getMinutes() / 60, 8.5);
  // Lo antes posible desde el domingo: salta el domingo (no trabaja) y ofrece el lunes.
  const sunday = new Date(2026, 10, 8, 9).getTime();
  const asap = availableSlots({ schedule: DEFAULT_SCHEDULE, busy: [], travelMin: 15, durationHours: 1, from: sunday, days: 7, now: sunday, max: 1 });
  assert.equal(new Date(asap[0]).getDay(), 1);
});

test('matching: primero el que puede llegar antes; sin horario van al final', () => {
  const res = rankProviders(
    {
      attributes: { category: 'plomeria', urgency: 'alta', estimatedHours: 2, keywords: [] },
      location: CHAPINERO,
      desiredStart: TUESDAY,
      whenMode: 'day',
      now: NOW,
    },
    [
      // Muy confiable, pero ocupado toda la mañana: su primer horario es a las 13:30.
      { provider: provider({ uid: 'tarde', trustScore: 95 }), busy: [{ start: nextTuesdayAt(8), end: nextTuesdayAt(13) }] },
      // Ocupado todo el día: no tiene horario el martes.
      { provider: provider({ uid: 'lleno', trustScore: 99 }), busy: [{ start: nextTuesdayAt(6), end: nextTuesdayAt(18) }] },
      { provider: provider({ uid: 'temprano', trustScore: 60 }), busy: [] },
    ],
  );
  assert.deepEqual(res.map((r) => [r.provider.uid, r.available]), [['temprano', true], ['tarde', true], ['lleno', false]]);
  assert.ok(res[0].slots[0] < res[1].slots[0]);
  assert.ok(res[2].nextSlots.length > 0, 'ofrece el siguiente día libre');
});

test('explainMatch: explica el puntaje con frases y marca el factor principal', async () => {
  const { explainMatch } = await import('../src/lib/matching');
  const attrs = { category: 'plomeria' as const, urgency: 'media' as const, estimatedHours: 2, budgetMax: 60000, keywords: [] };
  const [m] = rankProviders(
    { attributes: attrs, location: CHAPINERO, desiredStart: TUESDAY, whenMode: 'day', now: NOW },
    [{ provider: provider({ uid: 'x', trustScore: 90, hourlyRate: 40000 }), busy: [] }],
  );
  const reasons = explainMatch(m, attrs);
  assert.ok(reasons.some((r) => r.text.startsWith('Confianza alta (90/100)')));
  assert.ok(reasons[0].text.startsWith('Puede llegar desde mar 10 nov'), reasons[0].text);
  assert.ok(reasons.some((r) => r.text.startsWith('Supera tu presupuesto por $20.000')));
  assert.equal(reasons.filter((r) => r.main).length, 1);
  assert.ok(reasons.find((r) => r.main)!.text.startsWith('Confianza'), 'con 90/100 la confianza es lo que más pesa');
});

test('plazos de habeas data en días hábiles con festivos de Colombia', async () => {
  const { addBusinessDays, colombianHolidays, easterSunday, isBusinessDay } = await import('../src/lib/businessDays');
  assert.equal(easterSunday(2026).toISOString().slice(0, 10), '2026-04-05');
  const h2026 = colombianHolidays(2026);
  for (const d of ['2026-01-12', '2026-04-02', '2026-04-03', '2026-05-18', '2026-06-08', '2026-06-15', '2026-11-02', '2026-11-16', '2026-12-08']) {
    assert.ok(h2026.has(d), `debería ser festivo: ${d}`);
  }
  assert.ok(!h2026.has('2026-01-06'), 'Reyes se traslada al lunes 12');
  // Jueves 12 nov 2026, 10:00 Bogotá. 10 días hábiles (saltando el festivo del lunes 16) → viernes 27.
  const from = Date.UTC(2026, 10, 12, 15, 0);
  const due = new Date(addBusinessDays(from, 10) - 5 * 3_600_000);
  assert.equal(due.toISOString().slice(0, 10), '2026-11-27');
  assert.ok(!isBusinessDay(Date.UTC(2026, 10, 16, 15)), 'lunes festivo');
});
