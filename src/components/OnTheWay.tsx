import type * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { TrackingMap } from '@/components/TrackingMap';
import { AppText, Button, Card, ErrorText, StatusBadge, styles } from '@/components/ui';
import { distanceKm, formatKm } from '@/lib/geo';
import type { Booking, Tracking } from '@/lib/types';
import { etaMinutes, startTrip, subscribeTracking, watchTrip } from '@/services/tracking';

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'hace unos segundos';
  const m = Math.round(s / 60);
  return `hace ${m} min`;
}

/**
 * Seguimiento "en camino", como en las apps de domicilios:
 * - el prestador toca "Voy en camino" y comparte su ubicación mientras tiene la pantalla abierta;
 * - el cliente ve un mapa, la distancia y la hora estimada de llegada en tiempo real.
 * Se detiene cuando el prestador marca el inicio del trabajo.
 */
export function OnTheWay({ booking: b, isClient }: { booking: Booking; isClient: boolean }) {
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [, tick] = useState(0);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const active = b.status === 'confirmed' && !!b.onTheWayAt;

  useEffect(() => {
    if (!active) return;
    return subscribeTracking(b.id, setTracking);
  }, [active, b.id]);

  // Refresca el "hace X min" cada 20 s.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, [active]);

  // El prestador sigue compartiendo su ubicación mientras esta pantalla esté abierta.
  useEffect(() => {
    if (isClient || !active) return;
    let cancelled = false;
    watchTrip(b).then((s) => {
      if (cancelled) s?.remove();
      else sub.current = s;
    });
    return () => {
      cancelled = true;
      sub.current?.remove();
      sub.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, active, b.id]);

  if (b.status !== 'confirmed') return null;

  async function go() {
    setBusy(true);
    setError(undefined);
    try {
      await startTrip(b);
      AccessibilityInfo.announceForAccessibility('El cliente ya puede ver que vas en camino');
    } catch (e) {
      setError(
        (e as Error).message === 'permiso'
          ? 'Necesitamos tu ubicación para mostrarle al cliente que vas en camino.'
          : 'No se pudo iniciar el seguimiento. Revisa el GPS y tu conexión.',
      );
    } finally {
      setBusy(false);
    }
  }

  // Prestador que todavía no ha salido.
  if (!isClient && !b.onTheWayAt) {
    return (
      <Card>
        <AppText variant="label">¿Ya saliste hacia donde el cliente?</AppText>
        <AppText variant="muted">Al tocar el botón, el cliente recibe un aviso y ve tu ubicación en un mapa hasta que llegues.</AppText>
        <Button label="Voy en camino" icon="car-outline" onPress={go} loading={busy} />
        {error && <ErrorText>{error}</ErrorText>}
      </Card>
    );
  }

  // Cliente cuyo prestador todavía no sale.
  if (isClient && !b.onTheWayAt) return null;

  const km = tracking ? distanceKm(tracking, b.location) : undefined;
  const eta = tracking ? etaMinutes(tracking, b.location) : undefined;
  const stale = tracking ? Date.now() - tracking.updatedAt > 3 * 60_000 : false;
  const who = b.providerName.split(' ')[0];

  return (
    <Card>
      <StatusBadge label={isClient ? `${who} va en camino` : 'Compartiendo tu ubicación'} tone="info" icon="car-outline" />
      {tracking && km !== undefined && eta !== undefined ? (
        <>
          <View style={[styles.row, { justifyContent: 'space-between' }]} accessible accessibilityLabel={`Llega en unos ${eta} minutos. Está a ${formatKm(km)}.`} accessibilityLiveRegion="polite">
            <View>
              <AppText variant="small">Llega en</AppText>
              <AppText variant="title" style={{ fontSize: 26, lineHeight: 32 }}>
                ~{eta} min
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="small">Distancia</AppText>
              <AppText variant="heading">{formatKm(km)}</AppText>
            </View>
          </View>
          <TrackingMap provider={tracking} destination={b.location} providerName={b.providerName} />
          <AppText variant="small">
            Ubicación actualizada {ago(tracking.updatedAt)}
            {stale ? (isClient ? '. Puede que haya perdido la señal: escríbele por el chat.' : '. Mantén esta pantalla abierta para seguir compartiendo.') : '.'}
          </AppText>
        </>
      ) : (
        <AppText variant="muted">Esperando la primera ubicación…</AppText>
      )}
      {!isClient && (
        <AppText variant="small">Cuando llegues, toca «Marcar inicio del trabajo». Ahí se deja de compartir tu ubicación.</AppText>
      )}
    </Card>
  );
}
