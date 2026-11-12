import { addDoc, collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/lib/firebase';
import type { AdminLogEntry, AdminStats, Booking, DataRequest, ProviderProfile, Report, ReportReason, Role, UserProfile } from '@/lib/types';

// ---------- Reportes (los crea cualquier usuario) ----------
export function createReport(r: {
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  targetRole: Role;
  bookingId?: string;
  reason: ReportReason;
  details: string;
}) {
  const { bookingId, ...rest } = r;
  const data: Omit<Report, 'id'> = {
    ...rest,
    ...(bookingId ? { bookingId } : {}),
    details: r.details.trim(),
    status: 'open',
    createdAt: Date.now(),
  };
  return addDoc(collection(db, 'reports'), data);
}

// ---------- Lecturas del panel (las reglas solo las permiten a administradores) ----------
const sub = <T,>(q: ReturnType<typeof query>, cb: (rows: T[]) => void) =>
  onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)),
    () => cb([]),
  );

export const subscribeAllUsers = (cb: (u: UserProfile[]) => void) => sub<UserProfile>(query(collection(db, 'users')), cb);
export const subscribeAllProviders = (cb: (p: ProviderProfile[]) => void) => sub<ProviderProfile>(query(collection(db, 'providers')), cb);
export const subscribeReports = (cb: (r: Report[]) => void) => sub<Report>(query(collection(db, 'reports'), orderBy('createdAt', 'desc')), cb);
export const subscribeReportsAbout = (uid: string, cb: (r: Report[]) => void) =>
  sub<Report>(query(collection(db, 'reports'), where('targetId', '==', uid)), cb);
export const subscribeAllBookings = (cb: (b: Booking[]) => void) =>
  sub<Booking>(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(200)), cb);
export const subscribeBookingsOf = (uid: string, field: 'clientId' | 'providerId', cb: (b: Booking[]) => void) =>
  sub<Booking>(query(collection(db, 'bookings'), where(field, '==', uid)), cb);
export const subscribeAdminLog = (cb: (l: AdminLogEntry[]) => void, max = 30) =>
  sub<AdminLogEntry>(query(collection(db, 'adminLog'), orderBy('createdAt', 'desc'), limit(max)), cb);

// ---------- Acciones (Cloud Functions; cada una queda en la bitácora) ----------
const call = <T = { ok: boolean }>(name: string) => (data: object) =>
  httpsCallable<object, T>(functions, name, { timeout: 120_000 })(data).then((r) => r.data);

export const adminStats = () => call<AdminStats>('adminStats')({});
export const adminSetSuspended = (uid: string, suspended: boolean, reason: string) => call('adminSetSuspended')({ uid, suspended, reason });
export const adminSetVerified = (uid: string, verified: boolean, note = '') => call('adminSetVerified')({ uid, verified, note });
export const adminNotify = (to: string, title: string, body: string) => call<{ ok: boolean; sent: number }>('adminNotify')({ to, title, body });
export const adminDeleteUser = (uid: string, reason: string) => call('adminDeleteUser')({ uid, reason });
export const adminRemoveReview = (reviewId: string, reason: string) => call('adminRemoveReview')({ reviewId, reason });
export const adminCancelBooking = (bookingId: string, reason: string) => call('adminCancelBooking')({ bookingId, reason });
export const adminResolveReport = (reportId: string, action: 'dismiss' | 'warn' | 'suspend', note: string) =>
  call('adminResolveReport')({ reportId, action, note });

/** Mensaje claro a partir del error de una función. */
export function adminErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err.code?.includes('permission-denied')) return 'Tu cuenta no tiene permisos de administrador. Cierra sesión y vuelve a entrar.';
  if (err.code?.includes('invalid-argument') || err.code?.includes('failed-precondition') || err.code?.includes('not-found')) {
    return err.message ?? 'Revisa los datos e intenta de nuevo.';
  }
  return 'No se pudo completar. Revisa tu conexión e intenta de nuevo.';
}

// ---------- Habeas data ----------
export const subscribeDataRequests = (cb: (r: DataRequest[]) => void) =>
  sub<DataRequest>(query(collection(db, 'dataRequests'), orderBy('createdAt', 'desc')), cb);
export const adminAnswerDataRequest = (id: string, text: string) => call('adminAnswerDataRequest')({ id, text });
