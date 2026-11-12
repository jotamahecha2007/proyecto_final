import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

import { classifyByRules, sanitizeAttributes } from './shared/classifierRules';
import { computeTrust } from './shared/trustScore';
import { addBusinessDays } from './shared/businessDays';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type AppNotification,
  type Booking,
  type Message,
  type ProviderProfile,
  type Quote,
  DATA_REQUEST_TYPES,
  type DataRequest,
  REPORT_REASONS,
  type Report,
  type Review,
  type ServiceRequest,
  type UserProfile,
} from './shared/types';

initializeApp();
const db = getFirestore();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const MODEL = 'claude-haiku-5-5';

// ---------------------------------------------------------------------------
// 1. IA para clasificar solicitudes (lenguaje natural → atributos estructurados)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres el clasificador de solicitudes de TeAyudo, una app de servicios para el hogar en Bogotá.
Recibes la descripción que escribe un cliente y devuelves SOLO un objeto JSON, sin texto adicional, con esta forma:
{"category": string, "urgency": "baja"|"media"|"alta", "budgetMax": number|null, "estimatedHours": number, "keywords": string[]}

Reglas:
- category debe ser exactamente una de: ${CATEGORIES.join(', ')}. Usa "otros" si ninguna aplica.
- urgency "alta" si hay riesgo (agua inundando, chispas, persona encerrada) o el cliente lo necesita hoy; "baja" si dice que no tiene afán.
- budgetMax en pesos colombianos (COP) solo si el cliente menciona un monto; "150 mil" = 150000. Si no lo menciona, null.
- estimatedHours: horas de trabajo realistas para un profesional, entre 0.5 y 12, en pasos de 0.5.
- keywords: hasta 6 palabras clave cortas en español, en minúscula.`;

/** Lee un secreto; si no está configurado (o es un marcador como "none"), devuelve ''. */
function secretOrEmpty(secret: ReturnType<typeof defineSecret>): string {
  let v = '';
  try {
    v = secret.value();
  } catch {
    v = process.env[secret.name] ?? '';
  }
  return v && v.length > 10 ? v : '';
}

async function classifyWithLLM(text: string, apiKey: string): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const out = data.content.find((c) => c.type === 'text')?.text ?? '';
  const json = out.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('La respuesta del modelo no trae JSON');
  return JSON.parse(json);
}

export const classifyRequest = onCall({ secrets: [ANTHROPIC_API_KEY], maxInstances: 10 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión primero.');
  const text = String((req.data as { text?: unknown })?.text ?? '').slice(0, 1000);
  if (text.trim().length < 5) throw new HttpsError('invalid-argument', 'La descripción es muy corta.');

  const apiKey = secretOrEmpty(ANTHROPIC_API_KEY);

  if (apiKey) {
    try {
      const raw = await classifyWithLLM(text, apiKey);
      // El LLM nunca tiene la última palabra: todo pasa por la misma validación de la app.
      return { attributes: sanitizeAttributes(raw, text), source: 'llm' as const };
    } catch (e) {
      logger.warn('LLM falló, se usan reglas', e);
    }
  }
  return { attributes: classifyByRules(text), source: 'rules' as const };
});

// ---------------------------------------------------------------------------
// 2. Trust Score: solo el servidor escribe stats y trustScore.
// ---------------------------------------------------------------------------

function trustFor(p: ProviderProfile): number {
  return computeTrust({
    ...p.stats,
    profile: {
      hasBio: (p.bio ?? '').trim().length >= 30,
      hasPhoto: !!p.photoURL,
      hasSchedule: (p.schedule ?? []).some(Boolean),
      hasCategories: (p.categories ?? []).length > 0,
      identityDeclared: !!p.identityDeclared || !!p.identityVerified,
    },
  }).score;
}

async function bumpProviderStats(ref: DocumentReference, delta: Partial<ProviderProfile['stats']>) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const p = snap.data() as ProviderProfile;
    const stats = { ...p.stats };
    for (const [k, v] of Object.entries(delta) as [keyof typeof stats, number][]) stats[k] = (stats[k] ?? 0) + v;
    const next = { ...p, stats };
    tx.update(ref, { stats, trustScore: trustFor(next), updatedAt: Date.now() });
  });
}

// ---------------------------------------------------------------------------
// 3. Reputación del cliente (la ve el prestador; no incluye el nombre).
// ---------------------------------------------------------------------------

async function bumpReputation(uid: string, delta: Record<string, number>) {
  const inc = Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, FieldValue.increment(v)]));
  await db.doc(`reputation/${uid}`).set({ uid, ...inc }, { merge: true });
}

export const onUserCreated = onDocumentCreated('users/{uid}', async (event) => {
  const u = event.data?.data() as UserProfile | undefined;
  if (!u) return;
  try {
    await db.doc(`reputation/${u.uid}`).create({
      uid: u.uid,
      ratingSum: 0,
      ratingCount: 0,
      completedAsClient: 0,
      cancelledAsClient: 0,
    });
  } catch {
    // Ya existía (p. ej. la creó el script de datos de prueba).
  }
});

// ---------------------------------------------------------------------------
// 4. Notificaciones: bandeja en Firestore + push de Expo si hay token.
// ---------------------------------------------------------------------------

async function notify(userId: string, n: Pick<AppNotification, 'type' | 'title' | 'body' | 'link'>) {
  await db.collection('notifications').add({ userId, ...n, read: false, createdAt: Date.now() });
  // Push remoto: solo llega a builds de desarrollo (Expo Go en Android no lo soporta).
  try {
    const user = (await db.doc(`users/${userId}`).get()).data() as UserProfile | undefined;
    const tokens = user?.pushTokens ?? [];
    if (!tokens.length) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(tokens.map((to) => ({ to, title: n.title, body: n.body, data: { link: n.link }, sound: 'default' }))),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    logger.warn('No se pudo enviar push', e);
  }
}

const first = (name: string) => name.split(' ')[0];
const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

export const onBookingCreated = onDocumentCreated('bookings/{bookingId}', async (event) => {
  const b = event.data?.data() as Booking | undefined;
  if (!b) return;
  await notify(b.providerId, {
    type: 'booking_new',
    title: 'Nuevo trabajo por confirmar',
    body: `${first(b.clientName)} quiere contratarte: ${CATEGORY_LABELS[b.category]}, ${cop(b.price)}.`,
    link: `/booking/${event.params.bookingId}`,
  });
});

export const onRequestCreated = onDocumentCreated('requests/{requestId}', async (event) => {
  const r = event.data?.data() as ServiceRequest | undefined;
  if (!r || r.status !== 'quoting') return;
  await Promise.all(
    r.matchedProviderIds.map((pid) =>
      notify(pid, {
        type: 'quote_request',
        title: 'Te piden una cotización',
        body: `${CATEGORY_LABELS[r.attributes.category]}: «${r.description.slice(0, 70)}${r.description.length > 70 ? '…' : ''}»`,
        link: `/quote/${event.params.requestId}`,
      }),
    ),
  );
});

export const onQuoteCreated = onDocumentCreated('requests/{requestId}/quotes/{providerId}', async (event) => {
  const q = event.data?.data() as Quote | undefined;
  if (!q) return;
  const req = (await db.doc(`requests/${event.params.requestId}`).get()).data() as ServiceRequest | undefined;
  if (!req) return;
  await notify(req.clientId, {
    type: 'quote_new',
    title: 'Nueva cotización',
    body: `${first(q.providerName)} cotizó ${cop(q.price)}${q.start ? ` y propone llegar ${whenText(q.start)}` : ''}.`,
    link: `/request/${event.params.requestId}`,
  });
});

/** Fecha corta en hora de Colombia para las notificaciones (el servidor corre en UTC). */
function whenText(ms: number): string {
  return new Date(ms).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * El cliente editó una solicitud en cotización: se avisa a los prestadores nuevos (piden
 * cotización) y a los que ya cotizaron (para que revisen su precio y hora).
 */
export const onRequestEdited = onDocumentUpdated('requests/{requestId}', async (event) => {
  const before = event.data?.before.data() as ServiceRequest | undefined;
  const after = event.data?.after.data() as ServiceRequest | undefined;
  if (!before || !after || after.status !== 'quoting' || before.updatedAt === after.updatedAt) return;
  const requestId = event.params.requestId;
  const quoted = new Set((await db.collection(`requests/${requestId}/quotes`).get()).docs.map((d) => d.id));
  const added = after.matchedProviderIds.filter((pid) => !before.matchedProviderIds.includes(pid));
  const label = CATEGORY_LABELS[after.attributes.category];
  await Promise.all([
    ...added.map((pid) =>
      notify(pid, {
        type: 'quote_request',
        title: 'Te piden una cotización',
        body: `${label}: «${after.description.slice(0, 70)}${after.description.length > 70 ? '…' : ''}»`,
        link: `/quote/${requestId}`,
      }),
    ),
    ...[...quoted].filter((pid) => after.matchedProviderIds.includes(pid)).map((pid) =>
      notify(pid, {
        type: 'quote_request',
        title: 'Una solicitud que cotizaste cambió',
        body: `El cliente editó la solicitud de ${label.toLowerCase()}. Revisa si tu precio y hora siguen sirviendo.`,
        link: `/quote/${requestId}`,
      }),
    ),
  ]);
});

const STATUS_TEXT: Partial<Record<Booking['status'], (b: Booking) => { title: string; body: string }>> = {
  confirmed: (b) => ({ title: 'Trabajo confirmado', body: `${first(b.providerName)} confirmó el servicio. Su agenda quedó reservada.` }),
  in_progress: (b) => ({ title: 'El trabajo empezó', body: `${first(b.providerName)} marcó el inicio del servicio.` }),
  completed: (b) => ({ title: 'Trabajo terminado', body: `${first(b.providerName)} terminó. Califícalo para ayudar a otros clientes.` }),
};

/** Cambios de una contratación → estadísticas, reputación y notificaciones. */
export const onBookingUpdated = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data?.before.data() as Booking | undefined;
  const after = event.data?.after.data() as Booking | undefined;
  if (!before || !after) return;
  const id = event.params.bookingId;
  const link = `/booking/${id}`;
  const providerRef = db.doc(`providers/${after.providerId}`);

  // Propuesta de precio y respuesta del cliente.
  if (!before.priceProposal && after.priceProposal) {
    await notify(after.clientId, {
      type: 'price_proposal',
      title: 'Propuesta de precio',
      body: `${first(after.providerName)} propone ${cop(after.priceProposal.amount)}: «${after.priceProposal.note}»`,
      link,
    });
  }
  if (before.priceProposal && !after.priceProposal) {
    const accepted = after.price === before.priceProposal.amount && after.priceAgreed;
    await notify(after.providerId, {
      type: 'price_answer',
      title: accepted ? 'Precio aceptado' : 'Precio rechazado',
      body: accepted
        ? `${first(after.clientName)} aceptó ${cop(after.price)}.`
        : `${first(after.clientName)} no aceptó ${cop(before.priceProposal.amount)}. Hablen por el chat.`,
      link,
    });
  }

  if (!before.onTheWayAt && after.onTheWayAt && after.status === 'confirmed') {
    await notify(after.clientId, {
      type: 'on_the_way',
      title: `${first(after.providerName)} va en camino`,
      body: 'Toca para ver en el mapa cuánto le falta para llegar.',
      link,
    });
  }

  if (before.status === after.status) return;

  if (after.status === 'in_progress') {
    // Llegó: se deja de guardar su ubicación.
    await db.doc(`tracking/${id}`).delete().catch(() => {});
  }
  if (after.status === 'completed') {
    await bumpProviderStats(providerRef, { completedJobs: 1 });
    await bumpReputation(after.clientId, { completedAsClient: 1 });
  }
  if (after.status === 'cancelled') {
    const deletedAccount = after.cancelReason === 'account_deleted';
    const byAdmin = after.cancelledBy === 'admin';
    // Solo cuenta como cancelación si la otra parte ya había confirmado.
    if (!deletedAccount && !byAdmin && after.cancelledBy === 'provider' && before.status !== 'pending') {
      await bumpProviderStats(providerRef, { cancelledJobs: 1 });
    }
    if (!deletedAccount && !byAdmin && after.cancelledBy === 'client' && before.status !== 'pending') {
      await bumpReputation(after.clientId, { cancelledAsClient: 1 });
    }
    await providerRef.collection('busy').doc(id).delete();
    await db.doc(`tracking/${id}`).delete().catch(() => {});
    if (byAdmin) {
      const reason = (after.cancelReason ?? '').replace(/^admin:\s*/, '');
      for (const to of [after.clientId, after.providerId]) {
        await notify(to, {
          type: 'booking_cancelled',
          title: 'TeAyudo canceló un servicio',
          body: `El servicio de ${CATEGORY_LABELS[after.category].toLowerCase()} fue cancelado por el equipo de TeAyudo. Motivo: ${reason || 'revisión de seguridad'}.`,
          link,
        });
      }
      return;
    }
    const to = after.cancelledBy === 'client' ? after.providerId : after.clientId;
    const who = after.cancelledBy === 'client' ? first(after.clientName) : first(after.providerName);
    await notify(to, {
      type: 'booking_cancelled',
      title: 'Contratación cancelada',
      body: deletedAccount
        ? `El servicio de ${CATEGORY_LABELS[after.category].toLowerCase()} se canceló porque la otra persona eliminó su cuenta.`
        : `${who} canceló el servicio de ${CATEGORY_LABELS[after.category].toLowerCase()}.`,
      link,
    });
    return;
  }
  const text = STATUS_TEXT[after.status]?.(after);
  if (text) await notify(after.clientId, { type: 'booking_status', ...text, link });
});

/** Si el prestador edita su perfil, se recalcula la parte de "perfil completo". */
export const onProviderWritten = onDocumentWritten('providers/{uid}', async (event) => {
  const after = event.data?.after.data() as ProviderProfile | undefined;
  if (!after) return;
  const score = trustFor(after);
  // Solo escribe si cambió, para no entrar en un ciclo infinito de escrituras.
  if (score !== after.trustScore) await event.data!.after.ref.update({ trustScore: score });
});

// ---------------------------------------------------------------------------
// 5. Chat: aviso al otro participante y transcripción de notas de voz y videos.
// ---------------------------------------------------------------------------

const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL ?? 'gpt-4o-mini-transcribe';

async function transcribe(path: string, apiKey: string): Promise<string> {
  const [buf] = await getStorage().bucket().file(path).download();
  const name = path.split('/').pop() ?? 'audio.m4a';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: name.endsWith('.mp4') ? 'video/mp4' : 'audio/mp4' }), name);
  form.append('model', TRANSCRIBE_MODEL);
  form.append('language', 'es');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Transcripción ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

export const onMessageCreated = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', secrets: [OPENAI_API_KEY], timeoutSeconds: 120 },
  async (event) => {
    const m = event.data?.data() as Message | undefined;
    if (!m) return;
    const chat = (await db.doc(`chats/${event.params.chatId}`).get()).data() as
      | { participants: string[]; names: Record<string, string> }
      | undefined;
    const to = chat?.participants.find((p) => p !== m.senderId);
    if (chat && to) {
      const what = m.text
        ? `«${m.text.slice(0, 80)}»`
        : m.imageUrl
          ? 'Te envió una foto.'
          : m.audioUrl
            ? 'Te envió una nota de voz.'
            : 'Te envió un video.';
      await notify(to, {
        type: 'message',
        title: `Mensaje de ${first(chat.names[m.senderId] ?? 'TeAyudo')}`,
        body: what,
        link: `/chat/${event.params.chatId}`,
      });
    }

    if (!m.mediaPath || m.transcriptStatus !== 'pending') return;
    const apiKey = secretOrEmpty(OPENAI_API_KEY);
    if (!apiKey) {
      await event.data!.ref.update({ transcriptStatus: 'unavailable' });
      return;
    }
    try {
      const text = await transcribe(m.mediaPath, apiKey);
      await event.data!.ref.update(text ? { transcript: text, transcriptStatus: 'done' } : { transcriptStatus: 'error' });
    } catch (e) {
      logger.warn('Falló la transcripción', e);
      await event.data!.ref.update({ transcriptStatus: 'error' });
    }
  },
);

/** Reseña nueva → reputación de quien fue calificado + aviso. */
export const onReviewCreated = onDocumentCreated('reviews/{reviewId}', async (event) => {
  const r = event.data?.data() as (Review & { seed?: boolean }) | undefined;
  // Las reseñas del script de datos de prueba ya vienen sumadas en stats.
  if (!r || r.seed || r.rating < 1 || r.rating > 5) return;
  if (r.targetRole === 'provider') {
    await bumpProviderStats(db.doc(`providers/${r.targetId}`), { ratingSum: r.rating, ratingCount: 1 });
  } else {
    await db.doc(`users/${r.targetId}`).update({
      ratingSum: FieldValue.increment(r.rating),
      ratingCount: FieldValue.increment(1),
    });
    await bumpReputation(r.targetId, { ratingSum: r.rating, ratingCount: 1 });
  }
  await notify(r.targetId, {
    type: 'review',
    title: 'Te calificaron',
    body: `${first(r.authorName)} te dio ${r.rating} ${r.rating === 1 ? 'estrella' : 'estrellas'}.`,
    link: r.targetRole === 'provider' ? `/provider/${r.targetId}` : `/booking/${r.bookingId}`,
  });
});

// ---------------------------------------------------------------------------
// 6. Eliminar cuenta (requisito de Google Play y derecho de supresión de la Ley 1581).
// ---------------------------------------------------------------------------

const DELETED_NAME = 'Usuario eliminado';

/** Borra y anonimiza todos los datos de una cuenta. La usan el propio usuario y el administrador. */
async function deleteAccountData(uid: string) {
  const writer = db.bulkWriter();
  const bucket = getStorage().bucket();

  // 1. Cancela los servicios activos (sin penalizar a nadie) y anonimiza el historial
  //    que conserva la otra parte.
  for (const field of ['clientId', 'providerId'] as const) {
    const snap = await db.collection('bookings').where(field, '==', uid).get();
    for (const d of snap.docs) {
      const b = d.data() as Booking;
      const update: Record<string, unknown> = field === 'clientId' ? { clientName: DELETED_NAME, photos: [] } : { providerName: DELETED_NAME };
      if (b.status === 'pending' || b.status === 'confirmed' || b.status === 'in_progress') {
        update.status = 'cancelled';
        update.cancelledBy = field === 'clientId' ? 'client' : 'provider';
        update.cancelReason = 'account_deleted';
      }
      writer.update(d.ref, update);
    }
  }

  // 2. Solicitudes del cliente: se cancelan las abiertas y se borran sus fotos.
  const requests = await db.collection('requests').where('clientId', '==', uid).get();
  for (const d of requests.docs) {
    const r = d.data() as ServiceRequest;
    writer.update(d.ref, { description: '(eliminada)', photos: [], ...(r.status === 'open' || r.status === 'quoting' ? { status: 'cancelled' } : {}) });
  }
  await bucket.deleteFiles({ prefix: `requests/${uid}/` }).catch(() => {});

  // 3. Chat: se borran sus mensajes y archivos; la otra persona ve "Usuario eliminado".
  const chats = await db.collection('chats').where('participants', 'array-contains', uid).get();
  for (const c of chats.docs) {
    writer.update(c.ref, { [`names.${uid}`]: DELETED_NAME });
    const mine = await c.ref.collection('messages').where('senderId', '==', uid).get();
    mine.docs.forEach((m) => writer.delete(m.ref));
    await bucket.deleteFiles({ prefix: `chats/${c.id}/${uid}_` }).catch(() => {});
  }

  // 4. Reseñas: las que escribió quedan anónimas; las que recibió se borran.
  const written = await db.collection('reviews').where('authorId', '==', uid).get();
  written.docs.forEach((r) => writer.update(r.ref, { authorName: DELETED_NAME, authorId: 'deleted' }));
  const received = await db.collection('reviews').where('targetId', '==', uid).get();
  received.docs.forEach((r) => writer.delete(r.ref));

  // 5. Perfil, reputación, notificaciones y seguimiento.
  const busy = await db.collection(`providers/${uid}/busy`).get();
  busy.docs.forEach((d) => writer.delete(d.ref));
  writer.delete(db.doc(`providers/${uid}`));
  writer.delete(db.doc(`reputation/${uid}`));
  const notifs = await db.collection('notifications').where('userId', '==', uid).get();
  notifs.docs.forEach((n) => writer.delete(n.ref));
  const dataReqs = await db.collection('dataRequests').where('userId', '==', uid).get();
  dataReqs.docs.forEach((d) => writer.delete(d.ref));
  const tracks = await db.collection('tracking').where('providerId', '==', uid).get();
  tracks.docs.forEach((t) => writer.delete(t.ref));
  writer.delete(db.doc(`users/${uid}`));

  await writer.close();
  // 6. Por último, la cuenta de acceso.
  await getAuth().deleteUser(uid);
  logger.info(`Cuenta eliminada: ${uid}`);
}

export const deleteMyAccount = onCall({ timeoutSeconds: 120 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión primero.');
  await deleteAccountData(req.auth.uid);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// 7. Administración. Todas las acciones exigen el claim "admin" y quedan en la bitácora.
// ---------------------------------------------------------------------------

async function requireAdmin(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Inicia sesión primero.');
  if (auth.token.admin !== true) throw new HttpsError('permission-denied', 'Solo un administrador puede hacer esto.');
  const me = (await db.doc(`users/${auth.uid}`).get()).data() as UserProfile | undefined;
  return { uid: auth.uid, name: me?.name ?? 'Administrador' };
}

async function adminLog(admin: { uid: string; name: string }, action: string, details: string, target?: { id: string; name?: string }) {
  await db.collection('adminLog').add({
    adminId: admin.uid,
    adminName: admin.name,
    action,
    targetId: target?.id ?? null,
    targetName: target?.name ?? null,
    details,
    createdAt: Date.now(),
  });
}

async function userOrFail(uid: string): Promise<UserProfile> {
  const u = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!u) throw new HttpsError('not-found', 'Ese usuario no existe.');
  return u;
}

function str(v: unknown, max = 500): string {
  return String(v ?? '').trim().slice(0, max);
}

/** Números del piloto para el tablero del administrador. */
export const adminStats = onCall(async (req) => {
  await requireAdmin(req.auth);
  const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;
  const users = db.collection('users');
  const bookings = db.collection('bookings');
  const requests = db.collection('requests');
  const weekAgo = Date.now() - 7 * 86_400_000;

  const [clients, providersN, admins, newLast7Days, suspended] = await Promise.all([
    count(users.where('role', '==', 'client')),
    count(users.where('role', '==', 'provider')),
    count(users.where('role', '==', 'admin')),
    count(users.where('createdAt', '>=', weekAgo)),
    count(users.where('suspended', '==', true)),
  ]);

  const provSnap = await db.collection('providers').get();
  const provs = provSnap.docs.map((d) => d.data() as ProviderProfile);
  const rated = provs.filter((p) => p.stats?.ratingCount > 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const statuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  const byStatusArr = await Promise.all(statuses.map((st) => count(bookings.where('status', '==', st))));
  const byStatus = Object.fromEntries(statuses.map((st, i) => [st, byStatusArr[i]]));
  const totalBookings = byStatusArr.reduce((a, b) => a + b, 0);
  const finished = byStatus.completed + byStatus.cancelled;

  const byCatArr = await Promise.all(CATEGORIES.map((cat) => count(requests.where('attributes.category', '==', cat))));
  const byCategory = Object.fromEntries(CATEGORIES.map((cat, i) => [cat, byCatArr[i]]));

  const paid = await bookings.where('payment.status', '==', 'paid_simulated').get();
  const paidTotal = paid.docs.reduce((sum, d) => sum + ((d.data() as Booking).price ?? 0), 0);

  const now = Date.now();
  const [openData, overdueData] = await Promise.all([
    count(db.collection('dataRequests').where('status', '==', 'open')),
    count(db.collection('dataRequests').where('status', '==', 'open').where('dueAt', '<', now)),
  ]);
  const [openReports, totalReports, totalRequests, quoting] = await Promise.all([
    count(db.collection('reports').where('status', '==', 'open')),
    count(db.collection('reports')),
    count(requests),
    count(requests.where('status', '==', 'quoting')),
  ]);

  return {
    users: { clients, providers: providersN, admins, newLast7Days, suspended },
    providers: {
      verified: provs.filter((p) => p.identityVerified).length,
      avgTrust: Math.round(avg(provs.map((p) => p.trustScore ?? 0))),
      avgRating: Math.round(avg(rated.map((p) => p.stats.ratingSum / p.stats.ratingCount)) * 10) / 10,
      withoutReviews: provs.length - rated.length,
    },
    requests: { total: totalRequests, byCategory, quoting },
    bookings: {
      total: totalBookings,
      byStatus,
      completionRate: finished ? Math.round((byStatus.completed / finished) * 100) : 0,
      cancellationRate: finished ? Math.round((byStatus.cancelled / finished) * 100) : 0,
      paidTotal,
    },
    reports: { open: openReports, total: totalReports },
    dataRequests: { open: openData, overdue: overdueData },
    generatedAt: Date.now(),
  };
});

/** Suspender o reactivar una cuenta. Suspendida: no puede entrar y no aparece en el matching. */
export const adminSetSuspended = onCall(async (req) => {
  const admin = await requireAdmin(req.auth);
  const uid = str(req.data?.uid, 128);
  const suspended = req.data?.suspended === true;
  const reason = str(req.data?.reason);
  const u = await userOrFail(uid);
  if (u.role === 'admin') throw new HttpsError('failed-precondition', 'No se puede suspender a un administrador desde la app.');
  if (suspended && reason.length < 5) throw new HttpsError('invalid-argument', 'Escribe el motivo de la suspensión.');

  await getAuth().updateUser(uid, { disabled: suspended });
  if (suspended) await getAuth().revokeRefreshTokens(uid);
  await db.doc(`users/${uid}`).update({ suspended });
  if (u.role === 'provider') await db.doc(`providers/${uid}`).set({ suspended }, { merge: true });

  if (suspended) {
    // Cancela sus servicios activos para no dejar a nadie esperando.
    const field = u.role === 'client' ? 'clientId' : 'providerId';
    const active = await db.collection('bookings').where(field, '==', uid).where('status', 'in', ['pending', 'confirmed']).get();
    await Promise.all(
      active.docs.map((d) => d.ref.update({ status: 'cancelled', cancelledBy: 'admin', cancelReason: 'admin: cuenta suspendida' })),
    );
  } else {
    await notify(uid, { type: 'admin_message', title: 'Tu cuenta fue reactivada', body: 'Ya puedes volver a usar TeAyudo.', link: '/' });
  }
  await adminLog(admin, suspended ? 'Suspendió una cuenta' : 'Reactivó una cuenta', reason || '—', { id: uid, name: u.name });
  return { ok: true };
});

/** Marcar la identidad de un prestador como verificada (o quitar la verificación). */
export const adminSetVerified = onCall(async (req) => {
  const admin = await requireAdmin(req.auth);
  const uid = str(req.data?.uid, 128);
  const verified = req.data?.verified === true;
  const u = await userOrFail(uid);
  if (u.role !== 'provider') throw new HttpsError('failed-precondition', 'Solo se verifica la identidad de prestadores.');
  await db.doc(`providers/${uid}`).update({ identityVerified: verified });
  if (verified) {
    await notify(uid, {
      type: 'admin_message',
      title: 'Tu identidad fue verificada',
      body: 'Ahora tu perfil muestra la insignia «Identidad verificada por TeAyudo».',
      link: `/provider/${uid}`,
    });
  }
  await adminLog(admin, verified ? 'Verificó la identidad de un prestador' : 'Quitó la verificación de identidad', str(req.data?.note) || '—', { id: uid, name: u.name });
  return { ok: true };
});

/** Enviar un aviso a una persona o a un grupo (todos, clientes o prestadores). */
export const adminNotify = onCall({ timeoutSeconds: 120 }, async (req) => {
  const admin = await requireAdmin(req.auth);
  const title = str(req.data?.title, 80);
  const body = str(req.data?.body, 400);
  const to = str(req.data?.to, 128); // uid | 'all' | 'clients' | 'providers'
  if (title.length < 3 || body.length < 3) throw new HttpsError('invalid-argument', 'Escribe un título y un mensaje.');

  let uids: string[];
  if (to === 'all' || to === 'clients' || to === 'providers') {
    let q: FirebaseFirestore.Query = db.collection('users');
    if (to !== 'all') q = q.where('role', '==', to === 'clients' ? 'client' : 'provider');
    uids = (await q.get()).docs.map((d) => d.id).filter((id) => id !== admin.uid);
  } else {
    await userOrFail(to);
    uids = [to];
  }
  for (const uid of uids) await notify(uid, { type: 'admin_message', title, body, link: '/notifications' });
  const label = to === 'all' ? 'todos' : to === 'clients' ? 'clientes' : to === 'providers' ? 'prestadores' : undefined;
  await adminLog(admin, `Envió un aviso${label ? ` a ${label}` : ''}`, `${title}: ${body}`, label ? undefined : { id: to });
  return { ok: true, sent: uids.length };
});

/** Eliminar la cuenta de un usuario (p. ej. por fraude). Mismo proceso que «Eliminar mi cuenta». */
export const adminDeleteUser = onCall({ timeoutSeconds: 120 }, async (req) => {
  const admin = await requireAdmin(req.auth);
  const uid = str(req.data?.uid, 128);
  const reason = str(req.data?.reason);
  const u = await userOrFail(uid);
  if (u.role === 'admin') throw new HttpsError('failed-precondition', 'No se puede eliminar a un administrador desde la app.');
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'Escribe el motivo.');
  await deleteAccountData(uid);
  await adminLog(admin, 'Eliminó una cuenta', reason, { id: uid, name: u.name });
  return { ok: true };
});

/** Quitar una reseña abusiva o falsa y descontarla de la reputación. */
export const adminRemoveReview = onCall(async (req) => {
  const admin = await requireAdmin(req.auth);
  const reviewId = str(req.data?.reviewId, 256);
  const reason = str(req.data?.reason);
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'Escribe el motivo.');
  const ref = db.doc(`reviews/${reviewId}`);
  const r = (await ref.get()).data() as Review | undefined;
  if (!r) throw new HttpsError('not-found', 'Esa reseña ya no existe.');

  if (r.targetRole === 'provider') {
    await bumpProviderStats(db.doc(`providers/${r.targetId}`), { ratingSum: -r.rating, ratingCount: -1 });
  } else {
    await db.doc(`users/${r.targetId}`).update({ ratingSum: FieldValue.increment(-r.rating), ratingCount: FieldValue.increment(-1) });
    await bumpReputation(r.targetId, { ratingSum: -r.rating, ratingCount: -1 });
  }
  await ref.delete();
  await adminLog(admin, 'Quitó una reseña', `${r.rating}★ de ${r.authorName}: «${r.comment}». Motivo: ${reason}`, { id: r.targetId });
  return { ok: true };
});

/** Cancelar un servicio por decisión de TeAyudo (disputas, seguridad). No penaliza a nadie. */
export const adminCancelBooking = onCall(async (req) => {
  const admin = await requireAdmin(req.auth);
  const bookingId = str(req.data?.bookingId, 128);
  const reason = str(req.data?.reason, 200);
  if (reason.length < 5) throw new HttpsError('invalid-argument', 'Escribe el motivo.');
  const ref = db.doc(`bookings/${bookingId}`);
  const b = (await ref.get()).data() as Booking | undefined;
  if (!b) throw new HttpsError('not-found', 'Ese servicio no existe.');
  if (!['pending', 'confirmed', 'in_progress'].includes(b.status)) throw new HttpsError('failed-precondition', 'Ese servicio ya terminó o ya estaba cancelado.');
  await ref.update({ status: 'cancelled', cancelledBy: 'admin', cancelReason: `admin: ${reason}` });
  await adminLog(admin, 'Canceló un servicio', `${CATEGORY_LABELS[b.category]} · ${b.clientName} con ${b.providerName}. Motivo: ${reason}`, { id: bookingId });
  return { ok: true };
});

/** Resolver un reporte: descartarlo, advertir a la persona reportada o suspenderla. */
export const adminResolveReport = onCall(async (req) => {
  const admin = await requireAdmin(req.auth);
  const reportId = str(req.data?.reportId, 128);
  const action = str(req.data?.action, 20) as 'dismiss' | 'warn' | 'suspend';
  const note = str(req.data?.note);
  if (!['dismiss', 'warn', 'suspend'].includes(action)) throw new HttpsError('invalid-argument', 'Acción no válida.');
  if (note.length < 5) throw new HttpsError('invalid-argument', 'Escribe una nota con la decisión.');
  const ref = db.doc(`reports/${reportId}`);
  const r = (await ref.get()).data() as Report | undefined;
  if (!r) throw new HttpsError('not-found', 'Ese reporte no existe.');
  if (r.status !== 'open') throw new HttpsError('failed-precondition', 'Ese reporte ya fue resuelto.');

  if (action === 'warn') {
    await notify(r.targetId, {
      type: 'admin_message',
      title: 'Advertencia del equipo de TeAyudo',
      body: `Recibimos un reporte sobre ti (${REPORT_REASONS[r.reason].toLowerCase()}). ${note}`,
      link: '/notifications',
    });
  }
  if (action === 'suspend') {
    const target = await userOrFail(r.targetId);
    if (target.role === 'admin') throw new HttpsError('failed-precondition', 'No se puede suspender a un administrador.');
    await getAuth().updateUser(r.targetId, { disabled: true });
    await getAuth().revokeRefreshTokens(r.targetId);
    await db.doc(`users/${r.targetId}`).update({ suspended: true });
    if (target.role === 'provider') await db.doc(`providers/${r.targetId}`).set({ suspended: true }, { merge: true });
  }

  await ref.update({
    status: action === 'dismiss' ? 'dismissed' : 'resolved',
    resolution: { action, note, adminId: admin.uid, at: Date.now() },
  });
  await notify(r.reporterId, {
    type: 'report_update',
    title: 'Revisamos tu reporte',
    body: action === 'dismiss' ? `Gracias por avisarnos. ${note}` : `Tomamos medidas sobre ${first(r.targetName)}. Gracias por ayudarnos a mantener TeAyudo seguro.`,
    link: '/notifications',
  });
  const verb = action === 'dismiss' ? 'Descartó' : action === 'warn' ? 'Resolvió con advertencia' : 'Resolvió suspendiendo';
  await adminLog(admin, `${verb} un reporte`, `${REPORT_REASONS[r.reason]} · ${note}`, { id: r.targetId, name: r.targetName });
  return { ok: true };
});

/** Reporte nuevo → aviso a todos los administradores. */
export const onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
  const r = event.data?.data() as Report | undefined;
  if (!r) return;
  const admins = await db.collection('users').where('role', '==', 'admin').get();
  await Promise.all(
    admins.docs.map((a) =>
      notify(a.id, {
        type: 'report_new',
        title: r.reason === 'safety' ? 'Reporte urgente de seguridad' : 'Nuevo reporte',
        body: `${first(r.reporterName)} reportó a ${first(r.targetName)}: ${REPORT_REASONS[r.reason].toLowerCase()}.`,
        link: '/reports',
      }),
    ),
  );
});

// ---------------------------------------------------------------------------
// 8. Habeas data (Ley 1581 de 2012): conocer los datos y atender solicitudes con plazos.
// ---------------------------------------------------------------------------

/** Derecho a conocer: devuelve una copia de todos los datos de la persona que hace la petición. */
export const exportMyData = onCall({ timeoutSeconds: 60 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión primero.');
  const uid = req.auth.uid;
  const rows = async (q: FirebaseFirestore.Query) => (await q.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const one = async (path: string) => {
    const s = await db.doc(path).get();
    return s.exists ? s.data() : null;
  };

  const [perfil, perfilProfesional, reputacion] = await Promise.all([one(`users/${uid}`), one(`providers/${uid}`), one(`reputation/${uid}`)]);
  if (perfil) delete (perfil as Record<string, unknown>).pushTokens; // datos técnicos del dispositivo
  const [solicitudes, comoCliente, comoPrestador, resenasEscritas, resenasRecibidas, notificaciones, reportesHechos, solicitudesDeDatos] =
    await Promise.all([
      rows(db.collection('requests').where('clientId', '==', uid)),
      rows(db.collection('bookings').where('clientId', '==', uid)),
      rows(db.collection('bookings').where('providerId', '==', uid)),
      rows(db.collection('reviews').where('authorId', '==', uid)),
      rows(db.collection('reviews').where('targetId', '==', uid)),
      rows(db.collection('notifications').where('userId', '==', uid)),
      rows(db.collection('reports').where('reporterId', '==', uid)),
      rows(db.collection('dataRequests').where('userId', '==', uid)),
    ]);

  // Mensajes que la persona envió (no los de la otra parte: son datos de un tercero).
  const chats = await db.collection('chats').where('participants', 'array-contains', uid).get();
  const mensajes: unknown[] = [];
  for (const c of chats.docs) {
    const mine = await c.ref.collection('messages').where('senderId', '==', uid).get();
    mine.docs.forEach((m) => mensajes.push({ conversacion: c.id, id: m.id, ...m.data() }));
  }

  const contrataciones = [...comoCliente, ...comoPrestador];
  return {
    descripcion:
      'Copia de los datos personales que TeAyudo (proyecto académico) guarda sobre ti, según el derecho a conocer de la Ley 1581 de 2012. Las fechas están en milisegundos desde 1970 (formato epoch).',
    generatedAt: new Date().toISOString(),
    summary: {
      solicitudes: solicitudes.length,
      contrataciones: contrataciones.length,
      resenasEscritas: resenasEscritas.length,
      resenasRecibidas: resenasRecibidas.length,
      mensajes: mensajes.length,
      notificaciones: notificaciones.length,
      reportesHechos: reportesHechos.length,
      solicitudesDeDatos: solicitudesDeDatos.length,
    },
    perfil,
    perfilProfesional,
    reputacionComoCliente: reputacion,
    solicitudes,
    contrataciones,
    resenasEscritas,
    resenasRecibidas,
    mensajesEnviados: mensajes,
    notificaciones,
    reportesHechos,
    solicitudesDeDatos,
  };
});

/** Solicitud nueva → plazo legal calculado en el servidor + aviso a los administradores. */
export const onDataRequestCreated = onDocumentCreated('dataRequests/{id}', async (event) => {
  const r = event.data?.data() as DataRequest | undefined;
  if (!r) return;
  const days = DATA_REQUEST_TYPES[r.type]?.days ?? 15;
  const dueAt = addBusinessDays(r.createdAt ?? Date.now(), days);
  if (dueAt !== r.dueAt) await event.data!.ref.update({ dueAt });
  const admins = await db.collection('users').where('role', '==', 'admin').get();
  await Promise.all(
    admins.docs.map((a) =>
      notify(a.id, {
        type: 'data_request_new',
        title: `Solicitud de datos: ${DATA_REQUEST_TYPES[r.type]?.label ?? r.type}`,
        body: `${first(r.userName)} hizo una solicitud. Plazo: ${days} días hábiles.`,
        link: '/admin/data-requests',
      }),
    ),
  );
});

/** El administrador responde una solicitud de habeas data. */
export const adminAnswerDataRequest = onCall(async (req) => {
  const admin = await requireAdmin(req.auth);
  const id = str(req.data?.id, 128);
  const text = str(req.data?.text, 2000);
  if (text.length < 10) throw new HttpsError('invalid-argument', 'Escribe una respuesta completa (mínimo 10 caracteres).');
  const ref = db.doc(`dataRequests/${id}`);
  const r = (await ref.get()).data() as DataRequest | undefined;
  if (!r) throw new HttpsError('not-found', 'Esa solicitud no existe.');
  if (r.status === 'answered') throw new HttpsError('failed-precondition', 'Esa solicitud ya fue respondida.');
  const at = Date.now();
  await ref.update({ status: 'answered', response: { text, adminId: admin.uid, adminName: admin.name, at } });
  await notify(r.userId, {
    type: 'data_request_answered',
    title: 'Respondimos tu solicitud de datos',
    body: text.slice(0, 120),
    link: '/privacy',
  });
  const late = at > r.dueAt ? ' (fuera de plazo)' : '';
  await adminLog(admin, `Respondió una solicitud de datos${late}`, `${DATA_REQUEST_TYPES[r.type]?.label}: ${text.slice(0, 200)}`, { id: r.userId, name: r.userName });
  return { ok: true };
});
