/**
 * Datos de prueba para el piloto en Bogotá: 14 prestadores y 1 cliente.
 *
 * Contra los emuladores (recomendado):
 *   FIRESTORE_EMULATOR_HOST=localhost:8085 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   GCLOUD_PROJECT=demo-teayudo npm run seed
 *
 * Contra un proyecto real: exporta GOOGLE_APPLICATION_CREDENTIALS con una cuenta de servicio.
 * Todas las cuentas usan la contraseña "teayudo123".
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { addBusinessDays } from '../src/shared/businessDays';
import { computeTrust } from '../src/shared/trustScore';
import type { Category, ProviderProfile, UserProfile, WeeklySchedule } from '../src/shared/types';

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-teayudo' });
const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'teayudo123';
const H = 60;
const WEEKDAYS: WeeklySchedule = [null, { start: 8 * H, end: 17 * H }, { start: 8 * H, end: 17 * H }, { start: 8 * H, end: 17 * H }, { start: 8 * H, end: 17 * H }, { start: 8 * H, end: 17 * H }, { start: 8 * H, end: 13 * H }];
const EXTENDED: WeeklySchedule = [{ start: 9 * H, end: 14 * H }, { start: 7 * H, end: 19 * H }, { start: 7 * H, end: 19 * H }, { start: 7 * H, end: 19 * H }, { start: 7 * H, end: 19 * H }, { start: 7 * H, end: 19 * H }, { start: 8 * H, end: 16 * H }];

interface Seed {
  name: string;
  email: string;
  categories: Category[];
  rate: number;
  radius: number;
  lat: number;
  lng: number;
  barrio: string;
  bio: string;
  ratings: number[];
  completed: number;
  cancelled: number;
  extended?: boolean;
}

const PROVIDERS: Seed[] = [
  { name: 'Carlos Rodríguez', email: 'carlos@teayudo.test', categories: ['plomeria'], rate: 40000, radius: 10, lat: 4.6486, lng: -74.0628, barrio: 'Chapinero', bio: 'Plomero con 15 años de experiencia. Destapes, fugas, calentadores y cambio de griferías. Llevo mis herramientas.', ratings: [5, 5, 4, 5, 5, 5, 4, 5], completed: 18, cancelled: 0, extended: true },
  { name: 'Luz Marina Gómez', email: 'luz@teayudo.test', categories: ['limpieza'], rate: 25000, radius: 12, lat: 4.6951, lng: -74.0307, barrio: 'Usaquén', bio: 'Limpieza profunda de apartamentos y casas, lavado de muebles y alfombras. Trabajo con productos propios.', ratings: [5, 5, 5, 4, 5], completed: 25, cancelled: 1 },
  { name: 'Jhon Fredy Castro', email: 'jhon@teayudo.test', categories: ['electricidad'], rate: 45000, radius: 15, lat: 4.6097, lng: -74.0817, barrio: 'Teusaquillo', bio: 'Técnico electricista certificado. Instalaciones, tomacorrientes, breakers, iluminación LED y revisión de cortos.', ratings: [5, 4, 5, 5], completed: 9, cancelled: 0, extended: true },
  { name: 'Andrea Patiño', email: 'andrea@teayudo.test', categories: ['pintura', 'carpinteria'], rate: 35000, radius: 10, lat: 4.6736, lng: -74.0522, barrio: 'Chicó', bio: 'Pintura de interiores, estuco y resanes. También arreglo de closets y muebles de madera.', ratings: [4, 5, 4], completed: 6, cancelled: 1 },
  { name: 'Miguel Ángel Rojas', email: 'miguel@teayudo.test', categories: ['plomeria', 'electrodomesticos'], rate: 38000, radius: 8, lat: 4.7110, lng: -74.0721, barrio: 'Suba', bio: 'Reparación de lavadoras, neveras y calentadores. También plomería básica. 8 años en el oficio.', ratings: [5, 4, 4, 5, 3], completed: 11, cancelled: 2 },
  { name: 'Diana Carolina Ruiz', email: 'diana@teayudo.test', categories: ['limpieza', 'jardineria'], rate: 22000, radius: 10, lat: 4.6280, lng: -74.0640, barrio: 'La Macarena', bio: 'Aseo de hogar y oficinas pequeñas, cuidado de plantas y jardines de balcón.', ratings: [], completed: 0, cancelled: 0 },
  { name: 'Óscar Hernández', email: 'oscar@teayudo.test', categories: ['cerrajeria'], rate: 50000, radius: 20, lat: 4.6400, lng: -74.0900, barrio: 'Galerías', bio: 'Cerrajero 24 horas. Apertura de puertas, cambio de guardas y chapas de seguridad.', ratings: [5, 5, 5, 4, 5, 5], completed: 30, cancelled: 0, extended: true },
  { name: 'Natalia Vargas', email: 'natalia@teayudo.test', categories: ['electricidad', 'electrodomesticos'], rate: 42000, radius: 12, lat: 4.6870, lng: -74.0560, barrio: 'Santa Bárbara', bio: 'Ingeniera electricista. Instalación de electrodomésticos, estufas de inducción y tableros eléctricos.', ratings: [5, 5], completed: 3, cancelled: 0 },
  { name: 'Wilson Mora', email: 'wilson@teayudo.test', categories: ['mudanza'], rate: 60000, radius: 25, lat: 4.5981, lng: -74.0760, barrio: 'Centro', bio: 'Trasteos y acarreos con camión pequeño y dos ayudantes. Embalaje incluido.', ratings: [4, 3, 4, 4], completed: 14, cancelled: 3 },
  { name: 'Sandra Milena López', email: 'sandra@teayudo.test', categories: ['plomeria'], rate: 35000, radius: 9, lat: 4.6600, lng: -74.0950, barrio: 'Salitre', bio: 'Plomería residencial: fugas, sanitarios, lavaplatos y duchas. Puntual y ordenada.', ratings: [5, 5, 4], completed: 5, cancelled: 0 },
  { name: 'Felipe Moreno', email: 'felipe@teayudo.test', categories: ['carpinteria', 'otros'], rate: 33000, radius: 10, lat: 4.7020, lng: -74.0420, barrio: 'Cedritos', bio: 'Maestro de obra: arreglos varios, instalación de repisas, cortinas, puertas y armado de muebles.', ratings: [4, 4, 5], completed: 7, cancelled: 1 },
  { name: 'Paola Andrea Suárez', email: 'paola@teayudo.test', categories: ['pintura'], rate: 30000, radius: 14, lat: 4.6190, lng: -74.1350, barrio: 'Kennedy', bio: 'Pintora de interiores y fachadas. Tratamiento de humedad y acabados.', ratings: [], completed: 0, cancelled: 0 },
  { name: 'Hernán Díaz', email: 'hernan@teayudo.test', categories: ['electricidad'], rate: 38000, radius: 10, lat: 4.7300, lng: -74.0650, barrio: 'Niza', bio: 'Electricista residencial con 20 años de experiencia. Cambio de cableado y tomas.', ratings: [3, 4, 2, 4], completed: 8, cancelled: 4 },
  { name: 'Camila Torres', email: 'camila@teayudo.test', categories: ['jardineria'], rate: 28000, radius: 15, lat: 4.6820, lng: -74.0350, barrio: 'Rosales', bio: 'Paisajista. Poda, siembra, mantenimiento de jardines y terrazas verdes.', ratings: [5, 5, 5], completed: 4, cancelled: 0 },
];

const CLIENT_COMMENTS = ['Muy puntual y dejó todo limpio.', 'Explicó bien qué tenía el problema.', 'Buen trabajo, lo recomiendo.', 'Llegó un poco tarde pero resolvió.', ''];

async function upsertUser(email: string, name: string): Promise<string> {
  try {
    const u = await auth.getUserByEmail(email);
    return u.uid;
  } catch {
    const u = await auth.createUser({ email, password: PASSWORD, displayName: name });
    return u.uid;
  }
}

async function main() {
  const clientUid = await upsertUser('cliente@teayudo.test', 'Valentina Cliente');
  const client: UserProfile = {
    uid: clientUid,
    role: 'client',
    name: 'Valentina Cliente',
    email: 'cliente@teayudo.test',
    location: { lat: 4.6534, lng: -74.0573, label: 'Chapinero Alto, Bogotá' },
    ratingSum: 9,
    ratingCount: 2,
    createdAt: Date.now(),
    consentAt: Date.now(),
    consentVersion: '2026-11-b', adultConfirmed: true,
  };
  await db.doc(`users/${clientUid}`).set(client);
  await db.doc(`reputation/${clientUid}`).set({ uid: clientUid, ratingSum: 9, ratingCount: 2, completedAsClient: 3, cancelledAsClient: 0 });

  const uidsByEmail: Record<string, string> = {};
  for (const s of PROVIDERS) {
    const uid = await upsertUser(s.email, s.name);
    uidsByEmail[s.email] = uid;
    const stats = {
      ratingSum: s.ratings.reduce((a, b) => a + b, 0),
      ratingCount: s.ratings.length,
      completedJobs: s.completed,
      cancelledJobs: s.cancelled,
    };
    const schedule = s.extended ? EXTENDED : WEEKDAYS;
    const trustScore = computeTrust({
      ...stats,
      profile: { hasBio: true, hasPhoto: false, hasSchedule: true, hasCategories: true, identityDeclared: true },
    }).score;

    const user: UserProfile = { uid, role: 'provider', name: s.name, email: s.email, ratingSum: 0, ratingCount: 0, createdAt: Date.now(), consentAt: Date.now(), consentVersion: '2026-11-b', adultConfirmed: true };
    const provider: ProviderProfile = {
      uid,
      name: s.name,
      bio: s.bio,
      categories: s.categories,
      hourlyRate: s.rate,
      serviceRadiusKm: s.radius,
      location: { lat: s.lat, lng: s.lng, label: `${s.barrio}, Bogotá` },
      schedule,
      identityDeclared: true,
      stats,
      trustScore,
      updatedAt: Date.now(),
    };
    await db.doc(`users/${uid}`).set(user);
    await db.doc(`providers/${uid}`).set(provider);

    const batch = db.batch();
    s.ratings.forEach((rating, i) => {
      const id = `seed_${uid}_${i}`;
      batch.set(db.doc(`reviews/${id}`), {
        id,
        bookingId: `seed_${i}`,
        authorId: `seed_client_${i}`,
        authorName: ['Ana M.', 'Jorge P.', 'Lucía R.', 'Andrés G.', 'Marcela T.', 'Pedro S.', 'Juliana C.', 'Tomás V.'][i % 8],
        targetId: uid,
        targetRole: 'provider',
        rating,
        comment: CLIENT_COMMENTS[i % CLIENT_COMMENTS.length],
        createdAt: Date.now() - (i + 1) * 86_400_000 * 3,
        seed: true,
      });
    });
    await batch.commit();
    console.log(`✓ ${s.name.padEnd(22)} ${s.categories.join(', ').padEnd(28)} confianza ${trustScore}`);
  }

  // Administrador: el rol se marca con un "custom claim" que la app no puede asignarse sola.
  const adminUid = await upsertUser('admin@teayudo.test', 'Equipo TeAyudo');
  await auth.setCustomUserClaims(adminUid, { admin: true });
  const adminProfile: UserProfile = {
    uid: adminUid,
    role: 'admin',
    name: 'Equipo TeAyudo',
    email: 'admin@teayudo.test',
    ratingSum: 0,
    ratingCount: 0,
    createdAt: Date.now(),
    consentAt: Date.now(),
    consentVersion: '2026-11-b', adultConfirmed: true,
  };
  await db.doc(`users/${adminUid}`).set(adminProfile);
  console.log('✓ Administrador           admin@teayudo.test');

  // Dos reportes abiertos para que el panel de administración tenga algo que revisar.
  const reports = [
    { target: 'hernan@teayudo.test', targetName: 'Hernán Díaz', reason: 'no_show', details: 'Confirmó el servicio para las 9 a. m. y nunca llegó. No contestó los mensajes.' },
    { target: 'wilson@teayudo.test', targetName: 'Wilson Mora', reason: 'overcharge', details: 'Acordamos $180.000 por el trasteo y al final me cobró $260.000 diciendo que el edificio no tenía ascensor.' },
  ];
  for (const [i, r] of reports.entries()) {
    await db.doc(`reports/seed_${i}`).set({
      reporterId: clientUid,
      reporterName: 'Valentina Cliente',
      targetId: uidsByEmail[r.target],
      targetName: r.targetName,
      targetRole: 'provider',
      reason: r.reason,
      details: r.details,
      status: 'open',
      createdAt: Date.now() - (i + 1) * 3_600_000,
    });
  }

  // Una solicitud de habeas data abierta, para probar el flujo del administrador.
  const created = Date.now() - 2 * 86_400_000;
  await db.doc('dataRequests/seed_0').set({
    userId: clientUid,
    userName: 'Valentina Cliente',
    userEmail: 'cliente@teayudo.test',
    type: 'consulta',
    message: '¿Con qué empresas comparten mis datos y por cuánto tiempo guardan mis notas de voz?',
    status: 'open',
    dueAt: addBusinessDays(created, 10),
    createdAt: created,
  });

  console.log(`\nCliente de prueba: cliente@teayudo.test / ${PASSWORD}`);
  console.log(`Administrador:      admin@teayudo.test / ${PASSWORD}`);
  console.log(`Prestadores: <nombre>@teayudo.test / ${PASSWORD} (ej. carlos@teayudo.test)`);
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
