import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { AdminLogList, BarList, NotifyForm, StatTile } from '@/components/admin/AdminWidgets';
import { SkeletonList } from '@/components/Skeleton';
import { AppText, Button, Card, ErrorText, Screen, StatusBadge, styles } from '@/components/ui';
import { BOOKING_STATUS } from '@/lib/status';
import { formatCOP, formatDateTime, spacing, useTheme } from '@/lib/theme';
import { CATEGORIES, CATEGORY_LABELS, type AdminLogEntry, type AdminStats, type BookingStatus } from '@/lib/types';
import { adminErrorMessage, adminStats, subscribeAdminLog } from '@/services/admin';

/** Tablero del administrador: cómo va el piloto, qué hay por revisar y qué se ha hecho. */
export default function AdminDashboard() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<AdminLogEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setStats(await adminStats());
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribeAdminLog((l) => setLog(l.slice(0, 8))), []);

  const tile = (width - spacing.lg * 2 - spacing.sm) / 2;

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <AppText variant="title">Panel de administración</AppText>
        <AppText variant="muted">{stats ? `Actualizado ${formatDateTime(stats.generatedAt)}` : 'Cargando cifras…'}</AppText>
      </View>
      <Button label="Actualizar cifras" icon="refresh" variant="secondary" onPress={load} loading={loading} />
      {error && <ErrorText>{error}</ErrorText>}

      {!stats && !error && <SkeletonList count={3} lines={2} />}

      {stats && (
        <>
          {stats.reports.open > 0 && (
            <Pressable onPress={() => router.push('/reports')} accessibilityRole="button" accessibilityLabel={`${stats.reports.open} reportes por revisar. Toca para verlos.`}>
              <Card style={{ borderColor: t.warning, borderWidth: 2 }}>
                <StatusBadge label="Requiere atención" tone="warning" icon="flag-outline" />
                <AppText variant="heading">
                  {stats.reports.open} {stats.reports.open === 1 ? 'reporte por revisar' : 'reportes por revisar'}
                </AppText>
                <AppText variant="muted">Toca para revisarlos y decidir.</AppText>
              </Card>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push('/admin/data-requests')}
            accessibilityRole="button"
            accessibilityLabel={`Solicitudes de habeas data: ${stats.dataRequests.open} por responder${stats.dataRequests.overdue ? `, ${stats.dataRequests.overdue} vencidas` : ''}. Toca para verlas.`}
          >
            <Card style={stats.dataRequests.overdue ? { borderColor: t.danger, borderWidth: 2 } : undefined}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <AppText variant="label">Solicitudes de habeas data</AppText>
                <AppText variant="small">Ley 1581</AppText>
              </View>
              <AppText variant="heading">
                {stats.dataRequests.open} por responder
              </AppText>
              {stats.dataRequests.overdue > 0 ? (
                <StatusBadge label={`${stats.dataRequests.overdue} con el plazo vencido`} tone="danger" icon="alert-circle-outline" />
              ) : (
                <AppText variant="muted">Toca para ver y responder dentro del plazo legal.</AppText>
              )}
            </Card>
          </Pressable>

          <AppText variant="heading">Usuarios</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatTile width={tile} label="Clientes" value={stats.users.clients} icon="home-outline" />
            <StatTile width={tile} label="Prestadores" value={stats.users.providers} icon="construct-outline" hint={`${stats.providers.verified} verificados`} />
            <StatTile width={tile} label="Nuevos (7 días)" value={stats.users.newLast7Days} icon="person-add-outline" />
            <StatTile width={tile} label="Suspendidos" value={stats.users.suspended} icon="ban-outline" />
          </View>

          <AppText variant="heading">Servicios</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatTile width={tile} label="Contrataciones" value={stats.bookings.total} icon="briefcase-outline" hint={`${stats.requests.total} solicitudes`} />
            <StatTile width={tile} label="Terminados" value={`${stats.bookings.completionRate}%`} icon="checkmark-done-outline" hint="de los que ya cerraron" />
            <StatTile width={tile} label="Cancelados" value={`${stats.bookings.cancellationRate}%`} icon="close-circle-outline" hint="de los que ya cerraron" />
            <StatTile width={tile} label="Pagos (simulados)" value={formatCOP(stats.bookings.paidTotal)} icon="card-outline" />
          </View>

          <AppText variant="heading">Calidad</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatTile width={tile} label="Confianza promedio" value={`${stats.providers.avgTrust}/100`} icon="shield-checkmark-outline" />
            <StatTile width={tile} label="Calificación promedio" value={stats.providers.avgRating ? `${stats.providers.avgRating} ★` : '—'} icon="star-outline" hint={`${stats.providers.withoutReviews} sin reseñas`} />
          </View>

          <Card>
            <AppText variant="label">Contrataciones por estado</AppText>
            <BarList
              rows={(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as BookingStatus[]).map((s) => ({
                label: BOOKING_STATUS[s].label,
                value: stats.bookings.byStatus[s] ?? 0,
              }))}
            />
          </Card>

          <Card>
            <AppText variant="label">Solicitudes por categoría</AppText>
            <BarList
              rows={CATEGORIES.map((c) => ({ label: CATEGORY_LABELS[c], value: stats.requests.byCategory[c] ?? 0 }))
                .filter((r) => r.value > 0)
                .sort((a, b) => b.value - a.value)}
            />
            {Object.values(stats.requests.byCategory).every((v) => !v) && <AppText variant="muted">Todavía no hay solicitudes.</AppText>}
          </Card>
        </>
      )}

      <NotifyForm />

      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <AppText variant="label">Actividad reciente</AppText>
          <Button label="Ver todo" variant="ghost" onPress={() => router.push('/account')} />
        </View>
        <AdminLogList entries={log} />
      </Card>
    </Screen>
  );
}
