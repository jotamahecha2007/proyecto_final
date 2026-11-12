/**
 * Convierte una cuenta existente en administrador (o le quita el rol).
 *   npm run make-admin -- correo@ejemplo.com          → dar rol de administrador
 *   npm run make-admin -- correo@ejemplo.com --quitar → volver a cliente
 *
 * Con los emuladores corriendo (npm run dev) funciona sin configurar nada.
 * Contra un proyecto real: define GOOGLE_APPLICATION_CREDENTIALS y GCLOUD_PROJECT.
 * La persona debe cerrar sesión y volver a entrar para que el cambio aplique.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const email = process.argv[2];
const remove = process.argv.includes('--quitar');
if (!email || !email.includes('@')) {
  console.error('Uso: npm run make-admin -- correo@ejemplo.com [--quitar]');
  process.exit(1);
}

// Sin credenciales de un proyecto real, se usan los emuladores locales de npm run dev.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8085';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-teayudo' });

(async () => {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, remove ? {} : { admin: true });
  await getFirestore().doc(`users/${user.uid}`).set({ role: remove ? 'client' : 'admin' }, { merge: true });
  await getAuth().revokeRefreshTokens(user.uid);
  console.log(remove ? `✓ ${email} ya no es administrador.` : `✓ ${email} ahora es administrador. Debe cerrar sesión y volver a entrar.`);
  process.exit(0);
})().catch((e) => {
  console.error('No se pudo:', (e as Error).message);
  process.exit(1);
});
