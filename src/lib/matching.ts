// Matching básico del MVP: filtrado + puntaje ponderado basado en reglas.
// No usa aprendizaje automático (ver Apéndice B: IA para matching queda fuera del MVP).

import { distanceKm, travelMinutes } from './geo';
import { availableSlots, slotLabel } from './schedule';
import type { GeoPoint, ProviderProfile, RequestAttributes, TimeSlot, Urgency, WhenMode } from './types';

export interface MatchCandidate {
  provider: ProviderProfile;
  busy: TimeSlot[];
}

export interface MatchQuery {
  attributes: RequestAttributes;
  location: GeoPoint;
  /** Desde cuándo buscar horarios: "lo antes posible" = ahora; un día = ese día. */
  desiredStart: number;
  whenMode?: WhenMode;
  /** "Ahora" (se puede fijar en las pruebas). */
  now?: number;
}

/** Ventana de búsqueda: lo antes posible = próximos 7 días; un día = solo ese día. */
export function searchWindow(q: Pick<MatchQuery, 'desiredStart' | 'whenMode'>, now = Date.now()) {
  if (q.whenMode === 'day') return { from: Math.max(q.desiredStart, now), days: 1 };
  return { from: now, days: 7 };
}

/** Con urgencia, se aceptan llegadas con menos anticipación. */
export function leadMinutesFor(urgency: Urgency): number {
  return urgency === 'alta' ? 30 : urgency === 'media' ? 60 : 120;
}

export interface MatchResult {
  provider: ProviderProfile;
  score: number; // 0–100
  distanceKm: number;
  travelMinutes: number;
  estimatedPrice: number;
  /** Tiene al menos un horario libre en la ventana pedida. */
  available: boolean;
  /** Horas de llegada posibles dentro de la ventana pedida, de la más cercana a la más lejana. */
  slots: number[];
  /** Si no tiene horarios en la ventana: sus próximos horarios libres (para ofrecer otro día). */
  nextSlots: number[];
  parts: { trust: number; proximity: number; price: number };
}

export interface Weights {
  trust: number;
  proximity: number;
  price: number;
}

/** La confianza pesa más que todo lo demás; si es urgente, la cercanía sube. */
export function weightsFor(urgency: Urgency): Weights {
  if (urgency === 'alta') return { trust: 0.4, proximity: 0.45, price: 0.15 };
  return { trust: 0.5, proximity: 0.3, price: 0.2 };
}

export function estimatePrice(hourlyRate: number, hours: number): number {
  // Se cobra mínimo una hora y se redondea a miles de pesos.
  return Math.round((hourlyRate * Math.max(1, hours)) / 1000) * 1000;
}

function priceFit(estimated: number, budget?: number): number {
  if (!budget || budget <= 0) return 0.5; // sin presupuesto, el precio no diferencia
  if (estimated <= budget) return 1;
  return Math.max(0, 1 - (estimated - budget) / budget);
}

export function rankProviders(
  query: MatchQuery,
  candidates: MatchCandidate[],
  limit = 3,
): MatchResult[] {
  const w = weightsFor(query.attributes.urgency);
  const results: MatchResult[] = [];

  for (const { provider, busy } of candidates) {
    // 1. Filtro duro: categoría y radio de servicio.
    if (!provider.categories.includes(query.attributes.category)) continue;
    const dist = distanceKm(provider.location, query.location);
    if (dist > provider.serviceRadiusKm) continue;

    // 2. Horarios libres: trabajo + desplazamiento deben caber en su agenda.
    const travel = travelMinutes(provider.location, query.location);
    const now = query.now ?? Date.now();
    const win = searchWindow(query, now);
    const base = {
      schedule: provider.schedule,
      busy,
      travelMin: travel,
      durationHours: query.attributes.estimatedHours,
      now,
      leadMin: leadMinutesFor(query.attributes.urgency),
    };
    const slots = availableSlots({ ...base, from: win.from, days: win.days, max: 12 });
    const nextSlots = slots.length ? [] : availableSlots({ ...base, from: win.from + win.days * 86_400_000, days: 14, max: 4 });
    const available = slots.length > 0;

    // 3. Puntaje ponderado.
    const trust = provider.trustScore / 100;
    const proximity = 1 - dist / provider.serviceRadiusKm;
    const estimatedPrice = estimatePrice(provider.hourlyRate, query.attributes.estimatedHours);
    const price = priceFit(estimatedPrice, query.attributes.budgetMax);
    const score = 100 * (w.trust * trust + w.proximity * proximity + w.price * price);

    results.push({
      provider,
      score: Math.round(score),
      distanceKm: dist,
      travelMinutes: travel,
      estimatedPrice,
      available,
      slots,
      nextSlots,
      parts: { trust, proximity, price },
    });
  }

  // Orden: primero quien puede llegar antes. Con la misma hora, gana el de mejor puntaje
  // (confianza, cercanía y precio). Al final, los que no tienen horario en la ventana pedida.
  const firstOf = (r: MatchResult) => r.slots[0] ?? r.nextSlots[0] ?? Number.MAX_SAFE_INTEGER;
  results.sort((a, b) => Number(b.available) - Number(a.available) || firstOf(a) - firstOf(b) || b.score - a.score);
  return results.slice(0, limit);
}

export interface MatchReason {
  icon: 'shield-checkmark-outline' | 'navigate-outline' | 'wallet-outline' | 'time-outline' | 'star-outline';
  text: string;
  /** El factor que más aportó al puntaje de este prestador. */
  main?: boolean;
}

const COP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

/**
 * Traduce el puntaje a frases que el cliente entiende ("¿por qué me lo recomiendan?").
 * Así el matching deja de ser una caja negra.
 */
export function explainMatch(m: MatchResult, attributes: RequestAttributes): MatchReason[] {
  const w = weightsFor(attributes.urgency);
  const contributions = {
    trust: w.trust * m.parts.trust,
    proximity: w.proximity * m.parts.proximity,
    price: w.price * m.parts.price,
  };
  // La lista ya va ordenada por disponibilidad; aquí se marca el factor que más aportó al puntaje.
  const main = (Object.entries(contributions) as [keyof typeof contributions, number][]).sort((a, b) => b[1] - a[1])[0][0];

  const reasons: MatchReason[] = [];
  const t = m.provider.trustScore;
  reasons.push({
    icon: 'shield-checkmark-outline',
    text: t >= 75 ? `Confianza alta (${t}/100)` : t >= 55 ? `Confianza media (${t}/100)` : `Confianza en construcción (${t}/100)`,
    main: main === 'trust',
  });

  const km = m.distanceKm < 1 ? `${Math.round(m.distanceKm * 1000)} m` : `${m.distanceKm.toFixed(1).replace('.', ',')} km`;
  reasons.push({
    icon: 'navigate-outline',
    text: `${m.parts.proximity >= 0.6 ? 'Muy cerca' : m.parts.proximity >= 0.3 ? 'Cerca' : 'Algo lejos'}: a ${km}, llega en ~${m.travelMinutes} min`,
    main: main === 'proximity',
  });

  const budget = attributes.budgetMax;
  if (budget) {
    reasons.push({
      icon: 'wallet-outline',
      text:
        m.estimatedPrice <= budget
          ? `Dentro de tu presupuesto (${COP(m.estimatedPrice)} de ${COP(budget)})`
          : `Supera tu presupuesto por ${COP(m.estimatedPrice - budget)}`,
      main: main === 'price',
    });
  }

  const count = m.provider.stats.ratingCount;
  if (count > 0) {
    const avg = m.provider.stats.ratingSum / count;
    reasons.push({ icon: 'star-outline', text: `${avg.toFixed(1).replace('.', ',')} de 5 en ${count} ${count === 1 ? 'reseña' : 'reseñas'}` });
  }

  reasons.unshift({
    icon: 'time-outline',
    text: m.available
      ? `Puede llegar desde ${slotLabel(m.slots[0])}${m.slots.length === 1 ? ' (único horario libre)' : ''}`
      : m.nextSlots.length
        ? `No tiene horario ese día; el próximo es ${slotLabel(m.nextSlots[0])}`
        : 'No tiene horarios libres en los próximos días',
  });
  return reasons;
}
