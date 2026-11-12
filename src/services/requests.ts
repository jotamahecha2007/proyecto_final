import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { classifyByRules, sanitizeAttributes } from '@/lib/classifierRules';
import { db, functions } from '@/lib/firebase';
import { uploadFile } from '@/lib/upload';
import { rankProviders, type MatchResult } from '@/lib/matching';
import type { GeoPoint, Quote, RequestAttributes, RequestMode, ServiceRequest, WhenMode } from '@/lib/types';
import { fetchCandidates } from './providers';

export interface Classification {
  attributes: RequestAttributes;
  source: 'llm' | 'rules';
}

/**
 * Pide a la Cloud Function que el LLM interprete la solicitud. Si falla (sin red,
 * función no desplegada, límite de cuota), se usan las reglas locales: el flujo
 * principal nunca se bloquea por la IA (Impacto 2 en la Tabla B1).
 */
export async function classifyRequest(text: string): Promise<Classification> {
  try {
    const call = httpsCallable<{ text: string }, { attributes: unknown; source: 'llm' | 'rules' }>(
      functions,
      'classifyRequest',
      { timeout: 12_000 },
    );
    const res = await call({ text });
    return { attributes: sanitizeAttributes(res.data.attributes, text), source: res.data.source };
  } catch {
    return { attributes: classifyByRules(text), source: 'rules' };
  }
}

/** Cuántos prestadores reciben la solicitud cuando el cliente pide cotizaciones. */
const QUOTE_FANOUT = 5;

export async function createRequest(input: {
  clientId: string;
  description: string;
  attributes: RequestAttributes;
  classifiedBy: ServiceRequest['classifiedBy'];
  location: GeoPoint;
  desiredStart: number;
  whenMode: WhenMode;
  mode: RequestMode;
  /** Fotos locales del problema; se suben a Storage antes de crear la solicitud. */
  localPhotos?: string[];
}): Promise<string> {
  const { localPhotos = [], ...rest } = input;
  const candidates = await fetchCandidates(input.attributes.category);
  const ranked = rankProviders(rest, candidates, input.mode === 'quote' ? QUOTE_FANOUT : 3);
  const photos = await uploadPhotos(input.clientId, localPhotos);
  const data: Omit<ServiceRequest, 'id'> = {
    ...rest,
    photos,
    attributes: stripUndefined(input.attributes),
    status: input.mode === 'quote' ? 'quoting' : 'open',
    matchedProviderIds: ranked.map((r) => r.provider.uid),
    createdAt: Date.now(),
  };
  const ref = await addDoc(collection(db, 'requests'), data);
  return ref.id;
}

/** Sube solo las fotos nuevas (locales); las que ya están en Storage (http) se conservan. */
async function uploadPhotos(clientId: string, uris: string[]): Promise<string[]> {
  const stamp = Date.now();
  return Promise.all(
    uris
      .slice(0, 3)
      .map((uri, i) => (/^https?:/.test(uri) ? uri : uploadFile(uri, `requests/${clientId}/${stamp}_${i}.jpg`, 'image/jpeg'))),
  );
}

export interface RequestEdit {
  description: string;
  attributes: RequestAttributes;
  classifiedBy: ServiceRequest['classifiedBy'];
  location: GeoPoint;
  desiredStart: number;
  whenMode: WhenMode;
  /** Fotos finales: URLs ya subidas y/o fotos locales nuevas. */
  photos: string[];
}

/**
 * Edita una solicitud mientras nadie ha sido contratado. Se recalculan los prestadores
 * compatibles (pudo cambiar la categoría, el lugar o el día). En modo cotización se
 * conservan los prestadores que ya enviaron precio, para no perder sus cotizaciones.
 */
export async function updateRequest(req: ServiceRequest, edit: RequestEdit): Promise<void> {
  const candidates = await fetchCandidates(edit.attributes.category);
  let matched: string[];
  if (req.mode === 'quote') {
    const quoted = (await getDocs(collection(db, 'requests', req.id, 'quotes'))).docs.map((d) => d.id);
    const ranked = rankProviders({ ...edit }, candidates, QUOTE_FANOUT).map((r) => r.provider.uid);
    matched = [...new Set([...quoted, ...ranked])].slice(0, QUOTE_FANOUT);
  } else {
    matched = rankProviders({ ...edit }, candidates, 3).map((r) => r.provider.uid);
  }
  const photos = await uploadPhotos(req.clientId, edit.photos);
  await updateDoc(doc(db, 'requests', req.id), {
    description: edit.description,
    attributes: stripUndefined(edit.attributes),
    classifiedBy: edit.classifiedBy,
    location: edit.location,
    desiredStart: edit.desiredStart,
    whenMode: edit.whenMode,
    photos,
    matchedProviderIds: matched,
    updatedAt: Date.now(),
  });
}

/**
 * Prestadores para el cliente con sus horarios libres, del que puede llegar antes al que
 * llega después. Se recalcula al abrir la solicitud (la agenda pudo cambiar).
 */
export async function matchesFor(req: ServiceRequest, limit = 6): Promise<MatchResult[]> {
  const candidates = await fetchCandidates(req.attributes.category);
  return rankProviders(req, candidates, limit);
}

export async function getRequest(id: string): Promise<ServiceRequest | null> {
  const s = await getDoc(doc(db, 'requests', id));
  return s.exists() ? ({ id: s.id, ...s.data() } as ServiceRequest) : null;
}

export function subscribeRequest(id: string, cb: (r: ServiceRequest | null) => void) {
  return onSnapshot(doc(db, 'requests', id), (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as ServiceRequest) : null));
}

export function subscribeClientRequests(clientId: string, cb: (r: ServiceRequest[]) => void) {
  return onSnapshot(query(collection(db, 'requests'), where('clientId', '==', clientId)), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest).sort((a, b) => b.createdAt - a.createdAt)),
  );
}

/** Solicitudes anónimas abiertas a cotización para este prestador. */
export function subscribeQuoteInbox(providerId: string, cb: (r: ServiceRequest[]) => void) {
  return onSnapshot(
    query(collection(db, 'requests'), where('matchedProviderIds', 'array-contains', providerId)),
    (s) =>
      cb(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest)
          .filter((r) => r.status === 'quoting')
          .sort((a, b) => a.desiredStart - b.desiredStart || b.createdAt - a.createdAt),
      ),
  );
}

export function cancelRequest(id: string) {
  return updateDoc(doc(db, 'requests', id), { status: 'cancelled' });
}

export function subscribeQuotes(requestId: string, cb: (q: Quote[]) => void) {
  return onSnapshot(collection(db, 'requests', requestId, 'quotes'), (s) =>
    cb(s.docs.map((d) => d.data() as Quote).sort((a, b) => a.price - b.price)),
  );
}

export function sendQuote(requestId: string, quote: Quote) {
  return setDoc(doc(db, 'requests', requestId, 'quotes', quote.providerId), quote);
}

export async function getMyQuote(requestId: string, providerId: string): Promise<Quote | null> {
  const s = await getDoc(doc(db, 'requests', requestId, 'quotes', providerId));
  return s.exists() ? (s.data() as Quote) : null;
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
