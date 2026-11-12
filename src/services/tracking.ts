import * as Location from 'expo-location';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { distanceKm } from '@/lib/geo';
import type { Booking, GeoPoint, Tracking } from '@/lib/types';

/**
 * Minutos estimados desde la posición del prestador hasta el cliente.
 * Misma estimación que la agenda (ruta ≈ línea recta × 1,4 a 18 km/h), sin los
 * 10 minutos de margen, porque aquí ya está en movimiento.
 */
export function etaMinutes(from: GeoPoint, to: GeoPoint): number {
  const km = distanceKm(from, to) * 1.4;
  return Math.max(1, Math.ceil((km / 18) * 60));
}

export function subscribeTracking(bookingId: string, cb: (t: Tracking | null) => void) {
  return onSnapshot(
    doc(db, 'tracking', bookingId),
    (s) => cb(s.exists() ? (s.data() as Tracking) : null),
    () => cb(null),
  );
}

/** El prestador marca "Voy en camino": avisa al cliente y empieza a compartir su ubicación. */
export async function startTrip(b: Booking): Promise<Location.LocationSubscription | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('permiso');
  const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  await writePosition(b, first.coords.latitude, first.coords.longitude);
  await updateDoc(doc(db, 'bookings', b.id), { onTheWayAt: Date.now() });
  return watchTrip(b);
}

/** Sigue enviando la ubicación (cada ~10 s o 40 m) mientras la pantalla esté abierta. */
export async function watchTrip(b: Booking): Promise<Location.LocationSubscription | null> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 40 },
    (pos) => {
      writePosition(b, pos.coords.latitude, pos.coords.longitude).catch(() => {});
    },
  );
}

function writePosition(b: Booking, lat: number, lng: number) {
  const data: Tracking = { bookingId: b.id, providerId: b.providerId, clientId: b.clientId, lat, lng, updatedAt: Date.now() };
  return setDoc(doc(db, 'tracking', b.id), data);
}
