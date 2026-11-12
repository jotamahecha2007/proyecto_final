import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { ClientReputation } from '@/lib/types';

export function subscribeReputation(uid: string, cb: (r: ClientReputation | null) => void) {
  return onSnapshot(
    doc(db, 'reputation', uid),
    (s) => cb(s.exists() ? (s.data() as ClientReputation) : null),
    () => cb(null),
  );
}
