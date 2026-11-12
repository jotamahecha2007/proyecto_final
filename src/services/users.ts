import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { CONSENT_VERSION } from '@/lib/legal';
import type { GeoPoint, Role, UserProfile } from '@/lib/types';

export async function register(name: string, email: string, password: string, role: Role): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });
  const profile: UserProfile = {
    uid: cred.user.uid,
    role,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    ratingSum: 0,
    ratingCount: 0,
    createdAt: Date.now(),
    // Prueba de la autorización de datos (Ley 1581 de 2012): cuándo y qué versión aceptó.
    consentAt: Date.now(),
    consentVersion: CONSENT_VERSION,
    adultConfirmed: true,
  };
  await setDoc(doc(db, 'users', profile.uid), profile);
  return profile;
}

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function logout() {
  return signOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export function updateUserLocation(uid: string, location: GeoPoint) {
  return updateDoc(doc(db, 'users', uid), { location });
}

export function updateUserBasics(uid: string, data: { name?: string; phone?: string }) {
  return updateDoc(doc(db, 'users', uid), data);
}

/** Traduce los códigos de error de Firebase Auth a mensajes claros. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'El correo no tiene un formato válido.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/network-request-failed': 'No hay conexión. Revisa tu internet e intenta de nuevo.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/user-disabled': 'Tu cuenta está suspendida. Si crees que es un error, escribe a soporte de TeAyudo.',
  };
  return map[code] ?? 'Ocurrió un error. Intenta de nuevo.';
}
