// Clasificador por reglas. Es el respaldo cuando el LLM no responde, y también
// valida/normaliza lo que devuelve el LLM.
// Este archivo se copia a functions/src/shared con `npm run sync-shared`.

import { CATEGORIES, type Category, type RequestAttributes, type Urgency } from './types';

const KEYWORDS: Record<Exclude<Category, 'otros'>, string[]> = {
  plomeria: ['tuberia', 'tubo', 'fuga', 'gotea', 'goteo', 'lavaplatos', 'sanitario', 'inodoro', 'taza', 'llave', 'grifo', 'ducha', 'desague', 'destapar', 'tapado', 'calentador', 'plomero', 'agua'],
  electricidad: ['luz', 'luces', 'enchufe', 'toma', 'tomacorriente', 'breaker', 'taco', 'corto', 'cortocircuito', 'cable', 'electricista', 'bombillo', 'lampara', 'interruptor', 'electric'],
  cerrajeria: ['cerradura', 'chapa', 'llaves', 'cerrajero', 'encerrado', 'candado', 'puerta trabada'],
  limpieza: ['limpieza', 'limpiar', 'aseo', 'trapear', 'desinfectar', 'lavar', 'sofa', 'alfombra', 'vidrios'],
  pintura: ['pintar', 'pintura', 'pintor', 'pared', 'humedad', 'estuco', 'resanar'],
  carpinteria: ['madera', 'mueble', 'closet', 'carpintero', 'puerta', 'cajon', 'repisa', 'armario', 'ensamblar'],
  electrodomesticos: ['lavadora', 'nevera', 'nevecon', 'estufa', 'horno', 'microondas', 'secadora', 'televisor', 'licuadora'],
  jardineria: ['jardin', 'pasto', 'cesped', 'poda', 'podar', 'plantas', 'arbol', 'matas'],
  mudanza: ['mudanza', 'trasteo', 'acarreo', 'cargar', 'trasladar', 'mudar'],
};

const URGENT_WORDS = ['urgente', 'urgencia', 'emergencia', 'ya mismo', 'ahora', 'inundando', 'inunda', 'chispas', 'humo', 'encerrado', 'no tengo agua', 'no tengo luz', 'hoy'];
const RELAXED_WORDS = ['cuando pueda', 'sin afan', 'proxima semana', 'este mes', 'no es urgente'];

/** Horas típicas por categoría, usadas si el texto no dice otra cosa. */
export const DEFAULT_HOURS: Record<Category, number> = {
  plomeria: 2,
  electricidad: 2,
  cerrajeria: 1,
  limpieza: 4,
  pintura: 6,
  carpinteria: 3,
  electrodomesticos: 2,
  jardineria: 3,
  mudanza: 5,
  otros: 2,
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Encuentra un presupuesto: "$150.000", "150 mil", "200k", "hasta 80000". */
export function extractBudget(text: string): number | undefined {
  const t = normalize(text);
  const mil = t.match(/(\d+(?:[.,]\d+)?)\s*(mil|k)\b/);
  if (mil) return Math.round(parseFloat(mil[1].replace(',', '.')) * 1000);
  const plain = t.match(/\$\s*(\d{1,3}(?:\.\d{3})+|\d{4,})/) ?? t.match(/\b(\d{1,3}(?:\.\d{3})+)\b/) ?? t.match(/(?:presupuesto|hasta|maximo|pagar)\D{0,12}(\d{4,})/);
  if (plain) {
    const n = parseInt(plain[1].replace(/\./g, ''), 10);
    if (n >= 10000) return n;
  }
  return undefined;
}

function extractHours(text: string): number | undefined {
  const m = normalize(text).match(/(\d+(?:[.,]\d)?)\s*(horas|hora|h)\b/);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(',', '.'));
  return n > 0 && n <= 12 ? n : undefined;
}

export function classifyByRules(text: string): RequestAttributes {
  const t = normalize(text);
  let best: Category = 'otros';
  let bestHits = 0;
  const keywords: string[] = [];

  for (const [cat, words] of Object.entries(KEYWORDS) as [Category, string[]][]) {
    const hits = words.filter((w) => t.includes(w));
    if (hits.length > bestHits) {
      best = cat;
      bestHits = hits.length;
    }
    keywords.push(...hits);
  }

  let urgency: Urgency = 'media';
  if (URGENT_WORDS.some((w) => t.includes(w))) urgency = 'alta';
  else if (RELAXED_WORDS.some((w) => t.includes(w))) urgency = 'baja';

  return {
    category: best,
    urgency,
    budgetMax: extractBudget(text),
    estimatedHours: extractHours(text) ?? DEFAULT_HOURS[best],
    keywords: Array.from(new Set(keywords)).slice(0, 6),
  };
}

/**
 * Valida un objeto que viene del LLM. Si algún campo no es válido se reemplaza
 * por el valor de las reglas, para que un error del modelo nunca rompa el flujo.
 */
export function sanitizeAttributes(raw: unknown, text: string): RequestAttributes {
  const fallback = classifyByRules(text);
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const category = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : fallback.category;
  const urgency = ['baja', 'media', 'alta'].includes(r.urgency as string) ? (r.urgency as Urgency) : fallback.urgency;
  const budget = typeof r.budgetMax === 'number' && r.budgetMax > 0 ? Math.round(r.budgetMax) : fallback.budgetMax;
  const hours = typeof r.estimatedHours === 'number' && r.estimatedHours > 0 && r.estimatedHours <= 12 ? r.estimatedHours : DEFAULT_HOURS[category];
  const keywords = Array.isArray(r.keywords) ? r.keywords.filter((k): k is string => typeof k === 'string').slice(0, 6) : fallback.keywords;
  return { category, urgency, budgetMax: budget, estimatedHours: hours, keywords };
}
