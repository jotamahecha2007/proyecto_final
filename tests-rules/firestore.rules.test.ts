/// <reference types="node" />
/**
 * Pruebas de las reglas de seguridad de Firestore.
 * Necesitan el emulador de Firestore. Se corren con:
 *   npm run test:rules
 * (que ejecuta: firebase emulators:exec --only firestore --project demo-teayudo "tsx --test tests-rules/*.test.ts")
 */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8085').split(':');
let env: RulesTestEnvironment;

const CLIENT = 'cliente1';
const PROVIDER = 'prestador1';
const STRANGER = 'extrano';

const baseBooking = {
  requestId: 'req1',
  clientId: CLIENT,
  clientName: 'Valentina',
  providerId: PROVIDER,
  providerName: 'Carlos',
  category: 'plomeria',
  description: 'Destapar lavaplatos',
  location: { lat: 4.65, lng: -74.06 },
  start: Date.now() + 86_400_000,
  end: Date.now() + 86_400_000 + 7_200_000,
  travelMinutes: 20,
  price: 80000,
  priceAgreed: false,
  status: 'confirmed',
  payment: { status: 'unpaid' },
  reviewedByClient: false,
  reviewedByProvider: false,
  createdAt: Date.now(),
};

const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

/** Escribe datos de partida saltándose las reglas (como lo haría el servidor). */
async function seed(path: string, data: object) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-teayudo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed(`users/${CLIENT}`, { uid: CLIENT, role: 'client', name: 'Valentina', email: 'c@t.co', ratingSum: 0, ratingCount: 0, createdAt: 1 });
  await seed(`users/${PROVIDER}`, { uid: PROVIDER, role: 'provider', name: 'Carlos', email: 'p@t.co', ratingSum: 0, ratingCount: 0, createdAt: 1 });
  await seed('requests/req1', { clientId: CLIENT, status: 'booked', matchedProviderIds: [PROVIDER], description: 'x' });
  await seed('bookings/b1', baseBooking);
});

describe('Trust Score y reputación', () => {
  test('un prestador no puede subirse su propio trustScore', async () => {
    await seed(`providers/${PROVIDER}`, { uid: PROVIDER, trustScore: 60, stats: { ratingSum: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0 }, serviceRadiusKm: 10 });
    await assertFails(updateDoc(doc(db(PROVIDER), `providers/${PROVIDER}`), { trustScore: 99 }));
    await assertSucceeds(updateDoc(doc(db(PROVIDER), `providers/${PROVIDER}`), { bio: 'Plomero con 15 años de experiencia en Bogotá' }));
  });

  test('nadie puede escribir la reputación de un cliente desde la app', async () => {
    await assertFails(setDoc(doc(db(CLIENT), `reputation/${CLIENT}`), { uid: CLIENT, ratingSum: 50, ratingCount: 10 }));
  });

  test('cualquier usuario con sesión puede leer la reputación (no incluye el nombre)', async () => {
    await seed(`reputation/${CLIENT}`, { uid: CLIENT, ratingSum: 9, ratingCount: 2, completedAsClient: 3, cancelledAsClient: 0 });
    await assertSucceeds(getDoc(doc(db(PROVIDER), `reputation/${CLIENT}`)));
    await assertFails(getDoc(doc(db(), `reputation/${CLIENT}`)));
  });
});

describe('Contrataciones', () => {
  test('un extraño no puede leer ni confirmar una contratación ajena', async () => {
    await assertFails(getDoc(doc(db(STRANGER), 'bookings/b1')));
    await seed('bookings/b1', { ...baseBooking, status: 'pending' });
    await assertFails(updateDoc(doc(db(STRANGER), 'bookings/b1'), { status: 'confirmed' }));
  });

  test('el cliente no puede marcar el trabajo como terminado', async () => {
    await assertFails(updateDoc(doc(db(CLIENT), 'bookings/b1'), { status: 'in_progress' }));
  });

  test('no se puede pagar una contratación cancelada', async () => {
    await seed('bookings/b1', { ...baseBooking, status: 'cancelled' });
    await assertFails(updateDoc(doc(db(CLIENT), 'bookings/b1'), { payment: { status: 'paid_simulated', method: 'Nequi', paidAt: 1 } }));
  });
});

describe('Precio final acordado', () => {
  const proposal = { amount: 105000, note: 'Había que cambiar el sifón', proposedAt: 1 };

  test('el prestador propone y el cliente no puede proponer', async () => {
    await assertSucceeds(updateDoc(doc(db(PROVIDER), 'bookings/b1'), { priceProposal: proposal }));
    await assertFails(updateDoc(doc(db(CLIENT), 'bookings/b1'), { priceProposal: { ...proposal, amount: 10000 } }));
  });

  test('el cliente solo puede aceptar exactamente el monto propuesto', async () => {
    await seed('bookings/b1', { ...baseBooking, priceProposal: proposal });
    await assertFails(updateDoc(doc(db(CLIENT), 'bookings/b1'), { price: 50000, priceAgreed: true, priceProposal: deleteField() }));
    await assertSucceeds(updateDoc(doc(db(CLIENT), 'bookings/b1'), { price: 105000, priceAgreed: true, priceProposal: deleteField() }));
  });

  test('el prestador no puede cambiar el precio directamente', async () => {
    await assertFails(updateDoc(doc(db(PROVIDER), 'bookings/b1'), { price: 500000 }));
  });

  test('no se puede pagar con una propuesta pendiente', async () => {
    await seed('bookings/b1', { ...baseBooking, priceProposal: proposal });
    await assertFails(updateDoc(doc(db(CLIENT), 'bookings/b1'), { payment: { status: 'paid_simulated', method: 'PSE', paidAt: 1 } }));
  });
});

describe('Reseñas', () => {
  const review = (over: object = {}) => ({
    id: `b1_${CLIENT}`,
    bookingId: 'b1',
    authorId: CLIENT,
    authorName: 'Valentina',
    targetId: PROVIDER,
    targetRole: 'provider',
    rating: 5,
    comment: 'Excelente',
    createdAt: 1,
    ...over,
  });

  test('no se puede calificar un trabajo que no ha terminado', async () => {
    await assertFails(setDoc(doc(db(CLIENT), `reviews/b1_${CLIENT}`), review()));
  });

  test('se califica una sola vez y solo a la otra parte', async () => {
    await seed('bookings/b1', { ...baseBooking, status: 'completed' });
    await assertFails(setDoc(doc(db(CLIENT), `reviews/b1_${CLIENT}`), review({ targetId: STRANGER })));
    await assertSucceeds(setDoc(doc(db(CLIENT), `reviews/b1_${CLIENT}`), review()));
    await assertFails(setDoc(doc(db(CLIENT), `reviews/b1_${CLIENT}`), review({ rating: 1 })));
  });
});

describe('Notificaciones y chat', () => {
  test('cada quien solo lee y marca como leídas sus notificaciones', async () => {
    await seed('notifications/n1', { userId: CLIENT, type: 'message', title: 't', body: 'b', link: '/', read: false, createdAt: 1 });
    await assertSucceeds(getDoc(doc(db(CLIENT), 'notifications/n1')));
    await assertFails(getDoc(doc(db(PROVIDER), 'notifications/n1')));
    await assertFails(updateDoc(doc(db(CLIENT), 'notifications/n1'), { title: 'cambiado' }));
    await assertSucceeds(updateDoc(doc(db(CLIENT), 'notifications/n1'), { read: true }));
    await assertFails(setDoc(doc(db(CLIENT), 'notifications/n2'), { userId: CLIENT, read: false }));
  });

  test('solo los participantes escriben en el chat y nadie inventa una transcripción', async () => {
    const chatId = `${CLIENT}_${PROVIDER}`;
    await seed(`chats/${chatId}`, { participants: [CLIENT, PROVIDER], names: {} });
    await assertFails(setDoc(doc(db(STRANGER), `chats/${chatId}/messages/m1`), { senderId: STRANGER, text: 'hola', createdAt: 1 }));
    await assertSucceeds(setDoc(doc(db(CLIENT), `chats/${chatId}/messages/m2`), { senderId: CLIENT, text: 'hola', createdAt: 1 }));
    await assertFails(
      setDoc(doc(db(CLIENT), `chats/${chatId}/messages/m3`), {
        senderId: CLIENT,
        audioUrl: 'https://x',
        mediaPath: `chats/${chatId}/${CLIENT}_1.m4a`,
        transcript: 'texto inventado',
        transcriptStatus: 'done',
        createdAt: 1,
      }),
    );
  });
});

describe('Autorización de datos y seguimiento', () => {
  test('no se crea un usuario sin aceptar el tratamiento de datos', async () => {
    const nuevo = 'nuevo1';
    const base = { uid: nuevo, role: 'client', name: 'Ana', email: 'a@t.co', ratingSum: 0, ratingCount: 0, createdAt: 1 };
    await assertFails(setDoc(doc(db(nuevo), `users/${nuevo}`), base));
    await assertSucceeds(setDoc(doc(db(nuevo), `users/${nuevo}`), { ...base, consentAt: 1, consentVersion: '2026-11-b', adultConfirmed: true }));
  });

  test('solo el prestador del servicio confirmado comparte su ubicación, y solo las partes la ven', async () => {
    const pos = { bookingId: 'b1', providerId: PROVIDER, clientId: CLIENT, lat: 4.65, lng: -74.06, updatedAt: 1 };
    await assertFails(setDoc(doc(db(CLIENT), 'tracking/b1'), { ...pos, providerId: CLIENT }));
    await assertSucceeds(setDoc(doc(db(PROVIDER), 'tracking/b1'), pos));
    await assertSucceeds(getDoc(doc(db(CLIENT), 'tracking/b1')));
    await assertFails(getDoc(doc(db(STRANGER), 'tracking/b1')));
    await seed('bookings/b1', { ...baseBooking, status: 'completed' });
    await assertFails(setDoc(doc(db(PROVIDER), 'tracking/b1'), { ...pos, updatedAt: 2 }));
  });
});

describe('Administrador y reportes', () => {
  const ADMIN = 'admin1';
  const adminDb = () => env.authenticatedContext(ADMIN, { admin: true }).firestore();

  test('nadie puede registrarse como administrador', async () => {
    const nuevo = 'colado';
    await assertFails(
      setDoc(doc(db(nuevo), `users/${nuevo}`), { uid: nuevo, role: 'admin', name: 'X', email: 'x@t.co', ratingSum: 0, ratingCount: 0, createdAt: 1, consentAt: 1 }),
    );
  });

  test('un usuario no puede quitarse la suspensión ni verificarse solo', async () => {
    await seed(`users/${CLIENT}`, { uid: CLIENT, role: 'client', name: 'Valentina', email: 'c@t.co', ratingSum: 0, ratingCount: 0, createdAt: 1, suspended: true });
    await assertFails(updateDoc(doc(db(CLIENT), `users/${CLIENT}`), { suspended: false }));
    await seed(`providers/${PROVIDER}`, { uid: PROVIDER, trustScore: 60, stats: { ratingSum: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0 }, serviceRadiusKm: 10 });
    await assertFails(updateDoc(doc(db(PROVIDER), `providers/${PROVIDER}`), { identityVerified: true }));
  });

  test('el administrador lee usuarios, servicios y reportes; los demás no', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), `users/${CLIENT}`)));
    await assertSucceeds(getDoc(doc(adminDb(), 'bookings/b1')));
    await assertFails(getDoc(doc(db(STRANGER), `users/${CLIENT}`)));
    await seed('reports/r1', { reporterId: CLIENT, targetId: PROVIDER, status: 'open', reason: 'no_show', details: 'x' });
    await assertSucceeds(getDoc(doc(adminDb(), 'reports/r1')));
    await assertSucceeds(getDoc(doc(db(CLIENT), 'reports/r1')));
    await assertFails(getDoc(doc(db(PROVIDER), 'reports/r1')));
  });

  test('el administrador no cambia datos directamente (todo pasa por funciones con bitácora)', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'bookings/b1'), { status: 'cancelled' }));
    await assertFails(setDoc(doc(adminDb(), 'adminLog/x'), { action: 'algo' }));
    await seed('reports/r1', { reporterId: CLIENT, targetId: PROVIDER, status: 'open', reason: 'no_show', details: 'x' });
    await assertFails(updateDoc(doc(adminDb(), 'reports/r1'), { status: 'resolved' }));
  });

  test('se puede reportar a otra persona, pero no a uno mismo ni marcarlo resuelto', async () => {
    const r = { reporterId: CLIENT, reporterName: 'V', targetId: PROVIDER, targetName: 'C', targetRole: 'provider', reason: 'no_show', details: 'No llegó', status: 'open', createdAt: 1 };
    await assertSucceeds(setDoc(doc(db(CLIENT), 'reports/n1'), r));
    await assertFails(setDoc(doc(db(CLIENT), 'reports/n2'), { ...r, targetId: CLIENT }));
    await assertFails(setDoc(doc(db(CLIENT), 'reports/n3'), { ...r, status: 'resolved' }));
  });
});

describe('Habeas data', () => {
  const req = { userId: CLIENT, userName: 'V', userEmail: 'c@t.co', type: 'consulta', message: '¿Qué datos tienen de mí?', status: 'open', dueAt: 1, createdAt: 1 };

  test('el titular crea y ve sus solicitudes; otros no las ven y nadie las responde desde la app', async () => {
    await assertSucceeds(setDoc(doc(db(CLIENT), 'dataRequests/d1'), req));
    await assertSucceeds(getDoc(doc(db(CLIENT), 'dataRequests/d1')));
    await assertFails(getDoc(doc(db(PROVIDER), 'dataRequests/d1')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('adm', { admin: true }).firestore(), 'dataRequests/d1')));
    await assertFails(updateDoc(doc(db(CLIENT), 'dataRequests/d1'), { status: 'answered' }));
    await assertFails(setDoc(doc(db(CLIENT), 'dataRequests/d2'), { ...req, userId: PROVIDER }));
  });

  test('sin confirmar mayoría de edad no se crea la cuenta', async () => {
    const u = 'menor1';
    await assertFails(setDoc(doc(db(u), `users/${u}`), { uid: u, role: 'client', name: 'Ana', email: 'a@t.co', ratingSum: 0, ratingCount: 0, createdAt: 1, consentAt: 1 }));
  });

  test('el titular actualiza su nombre y vuelve a aceptar la política, pero no cambia su rol', async () => {
    await seed(`users/${CLIENT}`, { uid: CLIENT, role: 'client', name: 'Valentina', email: 'c@t.co', ratingSum: 0, ratingCount: 0, createdAt: 1, consentAt: 5, consentVersion: 'v1' });
    await assertSucceeds(updateDoc(doc(db(CLIENT), `users/${CLIENT}`), { name: 'Valentina Gómez', phone: '3001234567' }));
    await assertSucceeds(updateDoc(doc(db(CLIENT), `users/${CLIENT}`), { consentAt: 10, consentVersion: 'v2' }));
    await assertFails(updateDoc(doc(db(CLIENT), `users/${CLIENT}`), { role: 'admin' }));
  });
});

describe('Editar solicitudes y cotizar con hora', () => {
  const base = { clientId: CLIENT, status: 'quoting', mode: 'quote', matchedProviderIds: [PROVIDER], description: 'Se tapó el lavaplatos', desiredStart: 1, whenMode: 'asap' };

  test('el dueño edita mientras nadie esté contratado; otros no; no puede cambiar el estado ni el dueño', async () => {
    await seed('requests/e1', base);
    await assertSucceeds(updateDoc(doc(db(CLIENT), 'requests/e1'), { description: 'Se tapó el lavaplatos y la ducha', whenMode: 'day', desiredStart: 2, updatedAt: 3 }));
    await assertFails(updateDoc(doc(db(PROVIDER), 'requests/e1'), { description: 'hack', updatedAt: 4 }));
    await assertFails(updateDoc(doc(db(CLIENT), 'requests/e1'), { clientId: PROVIDER, updatedAt: 4 }));
    await assertFails(updateDoc(doc(db(CLIENT), 'requests/e1'), { status: 'open', updatedAt: 4 }));
    await assertFails(updateDoc(doc(db(CLIENT), 'requests/e1'), { matchedProviderIds: ['a', 'b', 'c', 'd', 'e', 'f'], updatedAt: 4 }));
    await seed('requests/e2', { ...base, status: 'booked' });
    await assertFails(updateDoc(doc(db(CLIENT), 'requests/e2'), { description: 'Ya no', updatedAt: 4 }));
  });

  test('la cotización puede traer la hora propuesta (número entero)', async () => {
    await seed('requests/e3', base);
    const q = { providerId: PROVIDER, providerName: 'P', price: 80000, estimatedHours: 2, message: '', createdAt: 1 };
    await assertSucceeds(setDoc(doc(db(PROVIDER), 'requests/e3/quotes/' + PROVIDER), { ...q, start: 1_800_000_000_000 }));
    await assertFails(setDoc(doc(db(PROVIDER), 'requests/e3/quotes/' + PROVIDER), { ...q, start: 'mañana' }));
  });
});
