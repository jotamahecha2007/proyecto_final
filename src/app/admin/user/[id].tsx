import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ReasonAction } from '@/components/admin/ReasonAction';
import { NotifyForm } from '@/components/admin/AdminWidgets';
import { SkeletonScreen } from '@/components/Skeleton';
import { AppText, Button, Card, EmptyState, ErrorText, Screen, Stars, StatusBadge, styles } from '@/components/ui';
import { db } from '@/lib/firebase';
import { BOOKING_STATUS } from '@/lib/status';
import { formatCOP, formatDateTime } from '@/lib/theme';
import { CATEGORY_LABELS, REPORT_REASONS, type Booking, type ClientReputation, type ProviderProfile, type Report, type Review, type UserProfile } from '@/lib/types';
import {
  adminDeleteUser,
  adminErrorMessage,
  adminRemoveReview,
  adminSetSuspended,
  adminSetVerified,
  subscribeBookingsOf,
  subscribeReportsAbout,
} from '@/services/admin';
import { subscribeReviewsFor } from '@/services/providers';
import { subscribeReputation } from '@/services/reputation';

const ROLE_LABEL = { client: 'Cliente', provider: 'Prestador', admin: 'Administrador' } as const;

/** Ficha de un usuario para el administrador, con todas las acciones de moderación. */
export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<UserProfile | null | undefined>();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [rep, setRep] = useState<ClientReputation | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => onSnapshot(doc(db, 'users', id), (s) => setUser(s.exists() ? (s.data() as UserProfile) : null), () => setUser(null)), [id]);
  useEffect(() => onSnapshot(doc(db, 'providers', id), (s) => setProvider(s.exists() ? (s.data() as ProviderProfile) : null), () => {}), [id]);
  useEffect(() => subscribeReputation(id, setRep), [id]);
  useEffect(() => subscribeReviewsFor(id, setReviews), [id]);
  useEffect(() => subscribeReportsAbout(id, setReports), [id]);
  useEffect(() => {
    if (!user || user.role === 'admin') return;
    return subscribeBookingsOf(id, user.role === 'client' ? 'clientId' : 'providerId', (b) => setBookings(b.sort((x, y) => y.createdAt - x.createdAt)));
  }, [id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user === undefined) return <SkeletonScreen count={3} />;
  if (user === null) return <Screen><EmptyState icon="person-outline" text="Este usuario ya no existe (puede que haya eliminado su cuenta)." /></Screen>;

  const isAdmin = user.role === 'admin';
  const first = user.name.split(' ')[0];
  const avg = provider?.stats.ratingCount ? provider.stats.ratingSum / provider.stats.ratingCount : rep?.ratingCount ? rep.ratingSum / rep.ratingCount : 0;
  const ratingCount = provider?.stats.ratingCount ?? rep?.ratingCount ?? 0;
  const done = bookings.filter((b) => b.status === 'completed').length;
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
  const openReports = reports.filter((r) => r.status === 'open').length;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function toggleVerified() {
    const verify = !provider?.identityVerified;
    Alert.alert(
      verify ? `¿Verificar la identidad de ${first}?` : `¿Quitar la verificación de ${first}?`,
      verify ? 'Hazlo solo después de revisar su documento. Su perfil mostrará «Identidad verificada por TeAyudo».' : 'Su perfil dejará de mostrar la insignia de verificación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: verify ? 'Verificar' : 'Quitar', onPress: () => run(() => adminSetVerified(id, verify)) },
      ],
    );
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <AppText variant="title">{user.name}</AppText>
        <AppText variant="muted">{user.email}</AppText>
        <View style={styles.chipWrap}>
          <StatusBadge label={ROLE_LABEL[user.role]} tone="neutral" icon="person-outline" />
          {user.suspended && <StatusBadge label="Suspendido" tone="danger" icon="ban-outline" />}
          {provider?.identityVerified && <StatusBadge label="Identidad verificada" tone="success" icon="shield-checkmark-outline" />}
          {openReports > 0 && <StatusBadge label={`${openReports} reportes abiertos`} tone="warning" icon="flag-outline" />}
        </View>
      </View>

      <Card>
        <AppText variant="label">Resumen</AppText>
        <AppText variant="small">Registrado: {formatDateTime(user.createdAt)}</AppText>
        {user.consentAt && <AppText variant="small">Autorizó el tratamiento de datos: {formatDateTime(user.consentAt)} (versión {user.consentVersion})</AppText>}
        <AppText variant="small">Mayor de edad confirmado: {user.adultConfirmed ? 'sí' : 'no registrado (cuenta anterior a esta verificación)'}</AppText>
        {provider && (
          <AppText variant="small">
            Confianza {provider.trustScore}/100 · {provider.stats.completedJobs} trabajos · {provider.stats.cancelledJobs} cancelados · {formatCOP(provider.hourlyRate)}/hora
          </AppText>
        )}
        {rep && user.role === 'client' && (
          <AppText variant="small">
            {rep.completedAsClient} servicios terminados · {rep.cancelledAsClient} cancelaciones tardías
          </AppText>
        )}
        {ratingCount > 0 && (
          <View style={styles.row}>
            <Stars value={avg} />
            <AppText variant="small">
              {avg.toFixed(1)} de 5 ({ratingCount})
            </AppText>
          </View>
        )}
        {!isAdmin && (
          <AppText variant="small">
            En la app: {bookings.length} contrataciones · {done} terminadas · {cancelled} canceladas
          </AppText>
        )}
        {provider && <Button label="Ver perfil público" variant="ghost" icon="open-outline" onPress={() => router.push(`/provider/${id}`)} />}
      </Card>

      {isAdmin ? (
        <AppText variant="muted">Las cuentas de administrador no se pueden modificar desde la app (se gestionan con npm run make-admin).</AppText>
      ) : (
        <>
          <AppText variant="heading">Acciones</AppText>
          {error && <ErrorText>{error}</ErrorText>}
          {user.role === 'provider' && (
            <Button
              label={provider?.identityVerified ? 'Quitar verificación de identidad' : 'Verificar identidad'}
              icon="shield-checkmark-outline"
              variant={provider?.identityVerified ? 'secondary' : 'primary'}
              onPress={toggleVerified}
              loading={busy}
            />
          )}
          {user.suspended ? (
            <Button label="Reactivar la cuenta" icon="refresh-outline" onPress={() => run(() => adminSetSuspended(id, false, ''))} loading={busy} />
          ) : (
            <ReasonAction
              label="Suspender la cuenta"
              icon="ban-outline"
              variant="danger"
              confirmLabel={`Suspender a ${first}`}
              help="No podrá iniciar sesión, desaparece del matching y sus servicios pendientes se cancelan. Se puede reactivar."
              onConfirm={(reason) => adminSetSuspended(id, true, reason)}
              done="Cuenta suspendida"
            />
          )}
          <NotifyForm to={id} toName={user.name} />
          <ReasonAction
            label="Eliminar la cuenta"
            icon="trash-outline"
            variant="danger"
            confirmLabel="Eliminar para siempre"
            help="Borra su perfil, sus mensajes y sus archivos; cancela sus servicios activos. No se puede deshacer."
            placeholder="Ej.: fraude comprobado (reporte del 12 de nov.)"
            onConfirm={async (reason) => {
              await adminDeleteUser(id, reason);
              router.back();
            }}
          />
        </>
      )}

      {reports.length > 0 && (
        <>
          <AppText variant="heading">Reportes sobre {first}</AppText>
          {reports.map((r) => (
            <Card key={r.id}>
              <StatusBadge label={r.status === 'open' ? 'Por revisar' : 'Resuelto'} tone={r.status === 'open' ? 'warning' : 'neutral'} icon="flag-outline" />
              <AppText variant="label">{REPORT_REASONS[r.reason]}</AppText>
              <AppText>«{r.details}»</AppText>
              <AppText variant="small">
                {r.reporterName} · {formatDateTime(r.createdAt)}
              </AppText>
              {r.status === 'open' && <Button label="Ir a reportes para decidir" variant="ghost" onPress={() => router.push('/reports')} />}
            </Card>
          ))}
        </>
      )}

      {reviews.length > 0 && (
        <>
          <AppText variant="heading">Reseñas recibidas ({reviews.length})</AppText>
          {reviews.map((r) => (
            <Card key={r.id}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <AppText variant="label">{r.authorName}</AppText>
                <Stars value={r.rating} />
              </View>
              {!!r.comment && <AppText>{r.comment}</AppText>}
              <ReasonAction
                label="Quitar esta reseña"
                icon="eye-off-outline"
                confirmLabel="Quitar y descontar de la reputación"
                help="Úsalo para reseñas falsas, ofensivas o de un servicio que no ocurrió."
                onConfirm={(reason) => adminRemoveReview(r.id, reason)}
                done="Reseña quitada"
              />
            </Card>
          ))}
        </>
      )}

      {bookings.length > 0 && (
        <>
          <AppText variant="heading">Contrataciones</AppText>
          {bookings.slice(0, 20).map((b) => {
            const st = BOOKING_STATUS[b.status];
            return (
              <Pressable key={b.id} onPress={() => router.push(`/booking/${b.id}`)} accessibilityRole="button" accessibilityLabel={`${CATEGORY_LABELS[b.category]}, ${st.label}, ${formatDateTime(b.start)}`}>
                <Card>
                  <StatusBadge label={st.label} tone={st.tone} icon={st.icon} />
                  <AppText variant="label">
                    {CATEGORY_LABELS[b.category]} · {formatCOP(b.price)}
                  </AppText>
                  <AppText variant="small">
                    {b.clientName} → {b.providerName} · {formatDateTime(b.start)}
                  </AppText>
                </Card>
              </Pressable>
            );
          })}
        </>
      )}
    </Screen>
  );
}
