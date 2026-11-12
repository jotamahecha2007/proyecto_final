import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { AppText, Button, Card, Chip, ErrorText, TextField, styles } from '@/components/ui';
import { BARRIOS_BOGOTA } from '@/lib/barrios';
import { BOGOTA_CENTER, distanceKm } from '@/lib/geo';
import { MIN_TOUCH, spacing, useTheme } from '@/lib/theme';
import type { GeoPoint } from '@/lib/types';

function describe(place: Location.LocationGeocodedAddress | undefined): string | undefined {
  if (!place) return undefined;
  return [place.street && place.streetNumber ? `${place.street} ${place.streetNumber}` : place.street ?? place.name, place.district ?? place.subregion, place.city]
    .filter(Boolean)
    .join(', ');
}

export async function getCurrentLocation(): Promise<GeoPoint | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const point: GeoPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: point.lat, longitude: point.lng });
    point.label = describe(place);
  } catch {
    // La dirección es solo informativa.
  }
  return point;
}

/**
 * Convierte una dirección escrita en coordenadas usando el geocodificador del celular.
 * Se agrega "Bogotá, Colombia" para que "Calle 72 # 10-34" no termine en otra ciudad.
 */
async function searchAddress(text: string): Promise<GeoPoint | null> {
  if (Platform.OS === 'web') return null; // el geocodificador nativo no existe en web
  // En Android el geocodificador exige el permiso de ubicación.
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (Platform.OS === 'android' && status !== 'granted') return null;
  const query = /bogot/i.test(text) ? text : `${text}, Bogotá, Colombia`;
  const results = await Location.geocodeAsync(query);
  // Solo se aceptan resultados dentro de Bogotá y alrededores (≈ 40 km del centro).
  const hit = results.find((r) => distanceKm({ lat: r.latitude, lng: r.longitude }, BOGOTA_CENTER) < 40);
  if (!hit) return null;
  return { lat: hit.latitude, lng: hit.longitude, label: text.trim() };
}

type Mode = 'gps' | 'address' | 'barrio';

export function LocationPicker({
  value,
  onChange,
  title = '¿Dónde es el servicio?',
}: {
  value: GeoPoint;
  onChange: (p: GeoPoint) => void;
  title?: string;
}) {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>('address');
  const [address, setAddress] = useState('');
  const [details, setDetails] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const isDefault = value.lat === BOGOTA_CENTER.lat && value.lng === BOGOTA_CENTER.lng;

  const barrios = useMemo(() => {
    const f = filter.trim().toLowerCase();
    // Sin búsqueda se muestran solo los primeros, para no alargar la pantalla.
    return f ? BARRIOS_BOGOTA.filter((b) => `${b.label} ${b.localidad}`.toLowerCase().includes(f)) : BARRIOS_BOGOTA.slice(0, 6);
  }, [filter]);

  function withDetails(p: GeoPoint): GeoPoint {
    const extra = details.trim();
    return extra ? { ...p, label: `${p.label ?? 'Ubicación'} (${extra})` } : p;
  }

  async function useMine() {
    setLoading(true);
    setError(undefined);
    try {
      const p = await getCurrentLocation();
      if (p) onChange(withDetails(p));
      else setError('No diste permiso de ubicación. Puedes escribir la dirección o elegir el barrio.');
    } catch {
      setError('No pudimos obtener tu ubicación. Revisa que el GPS esté activo o escribe la dirección.');
    } finally {
      setLoading(false);
    }
  }

  async function findAddress() {
    if (address.trim().length < 5) return setError('Escribe la dirección completa, por ejemplo «Calle 72 # 10-34».');
    setLoading(true);
    setError(undefined);
    try {
      const p = await searchAddress(address);
      if (p) onChange(withDetails(p));
      else setError('No encontramos esa dirección en Bogotá. Revisa cómo la escribiste o elige el barrio.');
    } catch {
      setError('No pudimos buscar la dirección ahora. Elige el barrio de la lista.');
    } finally {
      setLoading(false);
    }
  }

  function pickBarrio(b: (typeof BARRIOS_BOGOTA)[number]) {
    setError(undefined);
    onChange(withDetails({ lat: b.lat, lng: b.lng, label: `${b.label}, Bogotá` }));
  }

  return (
    <Card>
      <AppText variant="label">{title}</AppText>

      <View
        style={[styles.row, { alignItems: 'flex-start' }]}
        accessible
        accessibilityLabel={`Ubicación elegida: ${isDefault ? 'ninguna todavía' : value.label ?? 'punto en el mapa'}`}
      >
        <Ionicons name={isDefault ? 'location-outline' : 'location'} size={20} color={isDefault ? t.textMuted : t.primary} />
        <AppText variant={isDefault ? 'muted' : 'body'} style={{ flex: 1 }}>
          {isDefault ? 'Aún no has elegido la ubicación (se usa el centro de Bogotá).' : value.label ?? 'Ubicación elegida'}
        </AppText>
      </View>

      <View style={styles.chipWrap} accessibilityRole="radiogroup" accessibilityLabel="Cómo elegir la ubicación">
        <Chip label="Escribir dirección" selected={mode === 'address'} onPress={() => setMode('address')} />
        <Chip label="Elegir barrio" selected={mode === 'barrio'} onPress={() => setMode('barrio')} />
        <Chip label="Mi ubicación actual" selected={mode === 'gps'} onPress={() => setMode('gps')} />
      </View>

      {mode === 'address' && (
        <View style={{ gap: spacing.sm }}>
          <TextField
            label="Dirección"
            help="Ej.: Calle 72 # 10-34. No hace falta escribir «Bogotá»."
            value={address}
            onChangeText={setAddress}
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            returnKeyType="search"
            onSubmitEditing={findAddress}
          />
          <Button label="Buscar dirección" icon="search" variant="secondary" onPress={findAddress} loading={loading} />
        </View>
      )}

      {mode === 'barrio' && (
        <View style={{ gap: spacing.sm }}>
          <TextField label="Buscar barrio o localidad" value={filter} onChangeText={setFilter} placeholder="Ej.: Chapinero, Suba…" />
          <View style={{ gap: spacing.xs }}>
            {barrios.length === 0 && <AppText variant="muted">No hay barrios con ese nombre.</AppText>}
            {!filter.trim() && <AppText variant="small">Escribe arriba para ver los {BARRIOS_BOGOTA.length} barrios disponibles.</AppText>}
            {barrios.map((b) => {
              const selected = value.lat === b.lat && value.lng === b.lng;
              return (
                <Pressable
                  key={b.label}
                  onPress={() => pickBarrio(b)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={`${b.label}, localidad ${b.localidad}`}
                  style={[
                    styles.row,
                    {
                      minHeight: MIN_TOUCH,
                      paddingHorizontal: spacing.md,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: selected ? t.primary : t.border,
                      backgroundColor: selected ? t.surfaceAlt : t.surface,
                    },
                  ]}
                >
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? t.primary : t.textMuted} />
                  <View style={{ flex: 1 }}>
                    <AppText>{b.label}</AppText>
                    <AppText variant="small">{b.localidad}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {mode === 'gps' && (
        <Button label="Usar mi ubicación actual" icon="locate-outline" variant="secondary" onPress={useMine} loading={loading} />
      )}

      <TextField
        label="Detalles para llegar (opcional)"
        help="Apartamento, torre, conjunto o una referencia."
        value={details}
        onChangeText={setDetails}
        onEndEditing={() => !isDefault && onChange(withDetails({ ...value, label: value.label?.replace(/ \(.*\)$/, '') }))}
        maxLength={80}
      />

      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}
