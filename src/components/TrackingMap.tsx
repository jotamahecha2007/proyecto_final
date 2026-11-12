import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { DARK_MAP_STYLE, radius, useTheme } from '@/lib/theme';
import type { GeoPoint } from '@/lib/types';

/** Mapa con el prestador (en movimiento) y el destino. La versión web está en TrackingMap.web.tsx. */
export function TrackingMap({ provider, destination, providerName }: { provider: GeoPoint; destination: GeoPoint; providerName: string }) {
  const t = useTheme();
  const map = useRef<MapView>(null);

  // Encuadra a los dos puntos cada vez que el prestador se mueve.
  useEffect(() => {
    map.current?.fitToCoordinates(
      [
        { latitude: provider.lat, longitude: provider.lng },
        { latitude: destination.lat, longitude: destination.lng },
      ],
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
  }, [provider.lat, provider.lng, destination.lat, destination.lng]);

  return (
    <View
      style={{ height: 260, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border }}
      accessible
      accessibilityLabel={`Mapa con la ubicación de ${providerName} y la dirección del servicio`}
    >
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: (provider.lat + destination.lat) / 2,
          longitude: (provider.lng + destination.lng) / 2,
          latitudeDelta: Math.max(0.02, Math.abs(provider.lat - destination.lat) * 2.2),
          longitudeDelta: Math.max(0.02, Math.abs(provider.lng - destination.lng) * 2.2),
        }}
        toolbarEnabled={false}
        // Mapa oscuro cuando la app está en oscuro: Google (Android) usa el estilo; Apple (iOS) su modo nativo.
        customMapStyle={t.dark ? DARK_MAP_STYLE : []}
        userInterfaceStyle={t.dark ? 'dark' : 'light'}
      >
        <Polyline
          coordinates={[
            { latitude: provider.lat, longitude: provider.lng },
            { latitude: destination.lat, longitude: destination.lng },
          ]}
          strokeColor={t.primary}
          strokeWidth={3}
          lineDashPattern={[8, 6]}
        />
        <Marker coordinate={{ latitude: provider.lat, longitude: provider.lng }} title={providerName} description="Va en camino" pinColor={t.primary} />
        <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title="Lugar del servicio" description={destination.label} pinColor={t.danger} />
      </MapView>
    </View>
  );
}
