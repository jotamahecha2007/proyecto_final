import type { GeoPoint } from './types';

const EARTH_RADIUS_KM = 6371;

/** Distancia en línea recta (fórmula de haversine), en kilómetros. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Tiempo estimado de desplazamiento en minutos. Supone una velocidad media de
 * 18 km/h en Bogotá, un factor de 1,4 entre la línea recta y la ruta real, y
 * 10 minutos fijos para parquear y llegar a la puerta. Se redondea a 5 minutos.
 */
export function travelMinutes(from: GeoPoint, to: GeoPoint): number {
  const routeKm = distanceKm(from, to) * 1.4;
  const minutes = (routeKm / 18) * 60 + 10;
  return Math.ceil(minutes / 5) * 5;
}

/** Centro de Bogotá, usado cuando el usuario no comparte su ubicación. */
export const BOGOTA_CENTER: GeoPoint = { lat: 4.6533, lng: -74.0836, label: 'Bogotá' };

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}
