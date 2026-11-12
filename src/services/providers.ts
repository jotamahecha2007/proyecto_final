import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { computeTrust } from '@/lib/trustScore';
import type { MatchCandidate } from '@/lib/matching';
import type { Category, ProviderProfile, Review, TimeSlot } from '@/lib/types';

export async function getProvider(uid: string): Promise<ProviderProfile | null> {
  const snap = await getDoc(doc(db, 'providers', uid));
  return snap.exists() ? (snap.data() as ProviderProfile) : null;
}

export function subscribeProvider(uid: string, cb: (p: ProviderProfile | null) => void) {
  return onSnapshot(doc(db, 'providers', uid), (s) => cb(s.exists() ? (s.data() as ProviderProfile) : null));
}

/**
 * Guarda el perfil profesional. stats y trustScore solo los escribe la Cloud Function;
 * las reglas de Firestore rechazan cualquier cambio a esos campos desde la app.
 */
export async function saveProvider(
  p: Omit<ProviderProfile, 'stats' | 'trustScore' | 'updatedAt'>,
  existing: ProviderProfile | null,
) {
  if (existing) {
    // Al editar no se tocan stats ni trustScore: la función onProviderWritten recalcula el puntaje.
    await updateDoc(doc(db, 'providers', p.uid), { ...p, updatedAt: Date.now() });
    return;
  }
  const data: ProviderProfile = {
    ...p,
    stats: { ratingSum: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0 },
    trustScore: initialTrust(p),
    updatedAt: Date.now(),
  };
  await setDoc(doc(db, 'providers', p.uid), data);
}

function initialTrust(p: Omit<ProviderProfile, 'stats' | 'trustScore' | 'updatedAt'>): number {
  return computeTrust({
    ratingSum: 0,
    ratingCount: 0,
    completedJobs: 0,
    cancelledJobs: 0,
    profile: {
      hasBio: p.bio.trim().length >= 30,
      hasPhoto: !!p.photoURL,
      hasSchedule: p.schedule.some(Boolean),
      hasCategories: p.categories.length > 0,
      identityDeclared: p.identityDeclared,
    },
  }).score;
}

/** Trae los prestadores de una categoría con sus franjas ocupadas, para el matching. */
export async function fetchCandidates(category: Category): Promise<MatchCandidate[]> {
  const snap = await getDocs(query(collection(db, 'providers'), where('categories', 'array-contains', category)));
  const now = Date.now();
  const all = await Promise.all(
    snap.docs.map(async (d) => {
      const provider = d.data() as ProviderProfile;
      if (provider.suspended) return null;
      const busySnap = await getDocs(query(collection(db, 'providers', provider.uid, 'busy'), where('end', '>', now)));
      const busy = busySnap.docs.map((b) => b.data() as TimeSlot);
      return { provider, busy };
    }),
  );
  return all.filter((x): x is MatchCandidate => x !== null);
}

export function subscribeReviewsFor(targetId: string, cb: (r: Review[]) => void) {
  return onSnapshot(query(collection(db, 'reviews'), where('targetId', '==', targetId)), (s) =>
    cb(s.docs.map((d) => d.data() as Review).sort((a, b) => b.createdAt - a.createdAt)),
  );
}

/** Prestadores mejor calificados (para la pantalla de inicio y el buscador). */
export async function fetchTopProviders(max = 40): Promise<ProviderProfile[]> {
  const snap = await getDocs(query(collection(db, 'providers'), orderBy('trustScore', 'desc'), limit(max)));
  return snap.docs.map((d) => d.data() as ProviderProfile).filter((p) => !p.suspended);
}

/** Trabajos confirmados que aún no terminan (para calcular los horarios libres). */
export async function fetchBusy(uid: string): Promise<TimeSlot[]> {
  const snap = await getDocs(query(collection(db, 'providers', uid, 'busy'), where('end', '>', Date.now())));
  return snap.docs.map((d) => d.data() as TimeSlot);
}
