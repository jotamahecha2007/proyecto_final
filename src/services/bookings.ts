import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { travelMinutes } from '@/lib/geo';
import { blockedSlot, overlaps } from '@/lib/schedule';
import type { Booking, ProviderProfile, Role, ServiceRequest, TimeSlot } from '@/lib/types';

const HOUR = 3_600_000;

export class ScheduleConflictError extends Error {}

/** ¿La hora sigue libre en la agenda del prestador? (otro cliente pudo tomarla hace un momento) */
async function slotStillFree(providerId: string, slot: TimeSlot): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'providers', providerId, 'busy'), where('end', '>', Date.now())));
  return !snap.docs.some((d) => overlaps(d.data() as TimeSlot, slot));
}

/**
 * Crea la contratación a partir de una solicitud (contratación directa o cotización
 * aceptada). Queda en "pending" hasta que el prestador la confirme.
 */
export async function createBooking(input: {
  request: ServiceRequest;
  clientName: string;
  provider: ProviderProfile;
  price: number;
  estimatedHours: number;
  /** true si el precio viene de una cotización (ya lo propuso el prestador). */
  fromQuote: boolean;
  /** Hora de llegada que el cliente eligió entre los horarios libres del prestador. */
  start: number;
}): Promise<string> {
  const { request, provider, start } = input;
  const travel = travelMinutes(provider.location, request.location);
  if (!(await slotStillFree(provider.uid, blockedSlot(start, input.estimatedHours, travel)))) {
    throw new ScheduleConflictError('Ese horario se acaba de ocupar.');
  }
  const ref = doc(collection(db, 'bookings'));
  const booking: Omit<Booking, 'id'> = {
    requestId: request.id,
    clientId: request.clientId,
    clientName: input.clientName,
    providerId: provider.uid,
    providerName: provider.name,
    category: request.attributes.category,
    description: request.description,
    photos: request.photos ?? [],
    location: request.location,
    start,
    end: start + Math.round(input.estimatedHours * HOUR),
    travelMinutes: travel,
    price: input.price,
    priceAgreed: input.fromQuote,
    status: 'pending',
    payment: { status: 'unpaid' },
    reviewedByClient: false,
    reviewedByProvider: false,
    createdAt: Date.now(),
  };
  const batch = writeBatch(db);
  batch.set(ref, booking);
  batch.update(doc(db, 'requests', request.id), { status: 'booked' });
  await batch.commit();
  return ref.id;
}

export function subscribeBooking(id: string, cb: (b: Booking | null) => void) {
  return onSnapshot(doc(db, 'bookings', id), (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Booking) : null));
}

export function subscribeMyBookings(uid: string, role: Role, cb: (b: Booking[]) => void) {
  const field = role === 'client' ? 'clientId' : 'providerId';
  return onSnapshot(query(collection(db, 'bookings'), where(field, '==', uid)), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking).sort((a, b) => a.start - b.start)),
  );
}

/**
 * El prestador confirma: se bloquea en su agenda el desplazamiento + la duración.
 * Si el bloque se cruza con otro trabajo confirmado, se rechaza.
 */
export async function confirmBooking(b: Booking) {
  const hours = (b.end - b.start) / HOUR;
  const slot = blockedSlot(b.start, hours, b.travelMinutes);
  const busySnap = await getDocs(query(collection(db, 'providers', b.providerId, 'busy'), where('end', '>', slot.start)));
  const conflict = busySnap.docs.some((d) => d.id !== b.id && overlaps(d.data() as TimeSlot, slot));
  if (conflict) throw new ScheduleConflictError('Ya tienes otro trabajo en ese horario.');

  const batch = writeBatch(db);
  batch.update(doc(db, 'bookings', b.id), { status: 'confirmed' });
  batch.set(doc(db, 'providers', b.providerId, 'busy', b.id), { ...slot, bookingId: b.id });
  await batch.commit();
}

export function startBooking(b: Booking) {
  return updateDoc(doc(db, 'bookings', b.id), { status: 'in_progress' });
}

export function completeBooking(b: Booking) {
  return updateDoc(doc(db, 'bookings', b.id), { status: 'completed' });
}

/** Cancelar libera el bloque de agenda del prestador. */
export async function cancelBooking(b: Booking, by: Role) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'bookings', b.id), { status: 'cancelled', cancelledBy: by });
  batch.delete(doc(db, 'providers', b.providerId, 'busy', b.id));
  await batch.commit();
}

/** Pago simulado: no se captura ningún dato financiero (Pagos = Simulación en la Tabla B1). */
export async function paySimulated(b: Booking, method: string) {
  await updateDoc(doc(db, 'bookings', b.id), {
    payment: { status: 'paid_simulated', method, paidAt: Date.now() },
  });
}

/** El prestador propone el precio final (p. ej. el trabajo resultó más grande). */
export function proposePrice(b: Booking, amount: number, note: string) {
  return updateDoc(doc(db, 'bookings', b.id), {
    priceProposal: { amount: Math.round(amount), note: note.trim(), proposedAt: Date.now() },
  });
}

/** El cliente acepta: el precio de la contratación pasa a ser el propuesto. */
export function acceptPriceProposal(b: Booking) {
  if (!b.priceProposal) return Promise.resolve();
  return updateDoc(doc(db, 'bookings', b.id), {
    price: b.priceProposal.amount,
    priceAgreed: true,
    priceProposal: deleteField(),
  });
}

/** El cliente rechaza: se mantiene el precio anterior y lo hablan por chat. */
export function rejectPriceProposal(b: Booking) {
  return updateDoc(doc(db, 'bookings', b.id), { priceProposal: deleteField() });
}
