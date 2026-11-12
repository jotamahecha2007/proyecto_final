import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText, Card, StatusBadge, Stars, styles } from '@/components/ui';
import type { ClientReputation } from '@/lib/types';
import { subscribeReputation } from '@/services/reputation';

/**
 * Reputación del cliente para el prestador: el prestador también asume un riesgo
 * al ir a la casa de alguien que no conoce (ver "Problemática" en la propuesta).
 * No muestra el nombre, así que sirve también en cotizaciones anónimas.
 */
export function ClientReputationCard({ clientId, anonymous }: { clientId: string; anonymous?: boolean }) {
  const [rep, setRep] = useState<ClientReputation | null | undefined>();
  useEffect(() => subscribeReputation(clientId, setRep), [clientId]);
  if (rep === undefined) return null;

  const count = rep?.ratingCount ?? 0;
  const avg = count ? rep!.ratingSum / count : 0;
  const completed = rep?.completedAsClient ?? 0;
  const cancelled = rep?.cancelledAsClient ?? 0;
  const isNew = count === 0 && completed === 0;
  const risky = cancelled >= 2 && cancelled > completed / 3;

  return (
    <Card>
      <AppText variant="label">{anonymous ? 'Reputación del cliente (anónimo)' : 'Reputación del cliente'}</AppText>
      {isNew ? (
        <StatusBadge label="Cliente nuevo: todavía sin historial" tone="neutral" icon="person-add-outline" />
      ) : (
        <View style={styles.row}>
          {count > 0 ? (
            <>
              <Stars value={avg} />
              <AppText variant="small">
                {avg.toFixed(1)} de 5 · {count} {count === 1 ? 'calificación' : 'calificaciones'} de prestadores
              </AppText>
            </>
          ) : (
            <AppText variant="small">Sin calificaciones todavía</AppText>
          )}
        </View>
      )}
      <AppText variant="muted">
        {completed} {completed === 1 ? 'servicio terminado' : 'servicios terminados'} · {cancelled}{' '}
        {cancelled === 1 ? 'cancelación' : 'cancelaciones'} después de que el prestador confirmó
      </AppText>
      {risky && <StatusBadge label="Ha cancelado varias veces" tone="warning" icon="alert-circle-outline" />}
    </Card>
  );
}
