import { doc, writeBatch } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Booking, Review, Role } from '@/lib/types';

/**
 * Reseña en ambas direcciones: el cliente califica al prestador y el prestador al cliente.
 * El id es fijo (reserva + autor), así nadie puede calificar dos veces el mismo trabajo.
 * Las estadísticas y el Trust Score los actualiza la Cloud Function onReviewCreated.
 */
export async function submitReview(b: Booking, authorRole: Role, authorName: string, rating: number, comment: string) {
  const authorId = authorRole === 'client' ? b.clientId : b.providerId;
  const targetId = authorRole === 'client' ? b.providerId : b.clientId;
  const id = `${b.id}_${authorId}`;
  const review: Review = {
    id,
    bookingId: b.id,
    authorId,
    authorName,
    targetId,
    targetRole: authorRole === 'client' ? 'provider' : 'client',
    rating,
    comment: comment.trim(),
    createdAt: Date.now(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'reviews', id), review);
  batch.update(doc(db, 'bookings', b.id), authorRole === 'client' ? { reviewedByClient: true } : { reviewedByProvider: true });
  await batch.commit();
}
