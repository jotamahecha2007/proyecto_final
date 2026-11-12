import type { GeoPoint } from './types';

/**
 * Barrios y sectores de Bogotá con coordenadas aproximadas (centro del sector).
 * Sirve como alternativa cuando el usuario no quiere compartir el GPS o la
 * búsqueda por dirección no encuentra resultados.
 */
export const BARRIOS_BOGOTA: (GeoPoint & { label: string; localidad: string })[] = [
  { label: 'Usaquén', localidad: 'Usaquén', lat: 4.6951, lng: -74.0307 },
  { label: 'Cedritos', localidad: 'Usaquén', lat: 4.7224, lng: -74.0424 },
  { label: 'Santa Bárbara', localidad: 'Usaquén', lat: 4.6948, lng: -74.0436 },
  { label: 'Chicó', localidad: 'Chapinero', lat: 4.6736, lng: -74.0522 },
  { label: 'Rosales', localidad: 'Chapinero', lat: 4.6537, lng: -74.0489 },
  { label: 'Chapinero', localidad: 'Chapinero', lat: 4.6486, lng: -74.0628 },
  { label: 'Chapinero Alto', localidad: 'Chapinero', lat: 4.6534, lng: -74.0573 },
  { label: 'Zona G / Quinta Camacho', localidad: 'Chapinero', lat: 4.6578, lng: -74.0582 },
  { label: 'Teusaquillo', localidad: 'Teusaquillo', lat: 4.6297, lng: -74.0752 },
  { label: 'Galerías', localidad: 'Teusaquillo', lat: 4.6431, lng: -74.0770 },
  { label: 'Salitre', localidad: 'Fontibón', lat: 4.6600, lng: -74.0950 },
  { label: 'Modelia', localidad: 'Fontibón', lat: 4.6697, lng: -74.1193 },
  { label: 'La Macarena', localidad: 'Santa Fe', lat: 4.6143, lng: -74.0659 },
  { label: 'Centro / La Candelaria', localidad: 'La Candelaria', lat: 4.5981, lng: -74.0760 },
  { label: 'Suba centro', localidad: 'Suba', lat: 4.7411, lng: -74.0838 },
  { label: 'Niza', localidad: 'Suba', lat: 4.7130, lng: -74.0700 },
  { label: 'Colina Campestre', localidad: 'Suba', lat: 4.7317, lng: -74.0640 },
  { label: 'Engativá', localidad: 'Engativá', lat: 4.7069, lng: -74.1101 },
  { label: 'Kennedy', localidad: 'Kennedy', lat: 4.6280, lng: -74.1475 },
  { label: 'Puente Aranda', localidad: 'Puente Aranda', lat: 4.6162, lng: -74.1100 },
  { label: 'Restrepo', localidad: 'Antonio Nariño', lat: 4.5880, lng: -74.1030 },
  { label: 'Bosa', localidad: 'Bosa', lat: 4.6180, lng: -74.1890 },
  { label: 'Ciudad Bolívar', localidad: 'Ciudad Bolívar', lat: 4.5420, lng: -74.1530 },
  { label: 'Usme', localidad: 'Usme', lat: 4.4770, lng: -74.1260 },
];
