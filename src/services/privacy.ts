import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

import { addBusinessDays } from '@/lib/businessDays';
import { db, functions } from '@/lib/firebase';
import { CONSENT_VERSION } from '@/lib/legal';
import { DATA_REQUEST_TYPES, type DataRequest, type DataRequestType, type UserProfile } from '@/lib/types';

/** Volver a aceptar la política cuando cambia de versión. */
export function acceptCurrentPolicy(uid: string) {
  return updateDoc(doc(db, 'users', uid), { consentAt: Date.now(), consentVersion: CONSENT_VERSION });
}

/** Derecho de actualización: el titular corrige su nombre y teléfono. */
export async function updateMyData(profile: UserProfile, data: { name: string; phone: string }) {
  const name = data.name.trim();
  const phone = data.phone.replace(/[^\d+ ]/g, '').trim();
  await updateDoc(doc(db, 'users', profile.uid), { name, phone });
  // Si es prestador, el nombre también se ve en su perfil profesional.
  if (profile.role === 'provider') await updateDoc(doc(db, 'providers', profile.uid), { name }).catch(() => {});
}

export function createDataRequest(profile: UserProfile, type: DataRequestType, message: string) {
  const now = Date.now();
  const data: Omit<DataRequest, 'id'> = {
    userId: profile.uid,
    userName: profile.name,
    userEmail: profile.email,
    type,
    message: message.trim(),
    status: 'open',
    // El servidor recalcula este plazo al recibir la solicitud.
    dueAt: addBusinessDays(now, DATA_REQUEST_TYPES[type].days),
    createdAt: now,
  };
  return addDoc(collection(db, 'dataRequests'), data);
}

export function subscribeMyDataRequests(uid: string, cb: (r: DataRequest[]) => void) {
  return onSnapshot(
    query(collection(db, 'dataRequests'), where('userId', '==', uid)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as DataRequest).sort((a, b) => b.createdAt - a.createdAt)),
    () => cb([]),
  );
}

export interface DataExport {
  generatedAt: string;
  summary: Record<string, number>;
  [section: string]: unknown;
}

/**
 * Derecho a conocer: pide al servidor una copia de todos los datos de la persona
 * y la guarda como archivo JSON para compartir o guardar.
 */
export async function exportMyData(): Promise<{ data: DataExport; shared: boolean }> {
  const res = await httpsCallable<object, DataExport>(functions, 'exportMyData', { timeout: 60_000 })({});
  const data = res.data;
  if (Platform.OS === 'web') return { data, shared: false };
  const file = new File(Paths.cache, `mis-datos-teayudo-${new Date().toISOString().slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(data, null, 2));
  if (!(await Sharing.isAvailableAsync())) return { data, shared: false };
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Mis datos de TeAyudo', UTI: 'public.json' });
  return { data, shared: true };
}
