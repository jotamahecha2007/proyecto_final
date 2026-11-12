// Trust Score (versión simple del MVP).
// Este archivo se copia a functions/src/shared con `npm run sync-shared`:
// la app lo usa para explicar el puntaje y la Cloud Function para calcularlo.

export interface TrustInput {
  ratingSum: number;
  ratingCount: number;
  completedJobs: number;
  cancelledJobs: number;
  profile: {
    hasBio: boolean;
    hasPhoto: boolean;
    hasSchedule: boolean;
    hasCategories: boolean;
    identityDeclared: boolean;
  };
}

export interface TrustBreakdown {
  score: number; // 0–100
  rating: number; // 0–1
  reliability: number; // 0–1
  experience: number; // 0–1
  profile: number; // 0–1
}

export const TRUST_WEIGHTS = {
  rating: 0.4,
  reliability: 0.25,
  experience: 0.2,
  profile: 0.15,
} as const;

// Calificación previa: un prestador nuevo arranca como si tuviera 3 reseñas de 4 estrellas.
// Así una sola reseña de 5 (o de 1) no dispara ni hunde el puntaje.
const PRIOR_RATING = 4;
const PRIOR_WEIGHT = 3;
// Confiabilidad previa: como si hubiera completado 4 de 4 trabajos.
const PRIOR_RELIABLE_JOBS = 4;
const EXPERIENCE_CAP = 20;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function computeTrust(input: TrustInput): TrustBreakdown {
  const avgRating =
    (input.ratingSum + PRIOR_RATING * PRIOR_WEIGHT) / (input.ratingCount + PRIOR_WEIGHT);
  const rating = clamp01((avgRating - 1) / 4);

  const reliability = clamp01(
    (input.completedJobs + PRIOR_RELIABLE_JOBS) /
      (input.completedJobs + input.cancelledJobs + PRIOR_RELIABLE_JOBS),
  );

  const experience = clamp01(input.completedJobs / EXPERIENCE_CAP);

  const p = input.profile;
  const profileItems = [p.hasBio, p.hasPhoto, p.hasSchedule, p.hasCategories, p.identityDeclared];
  const profile = profileItems.filter(Boolean).length / profileItems.length;

  const score =
    100 *
    (TRUST_WEIGHTS.rating * rating +
      TRUST_WEIGHTS.reliability * reliability +
      TRUST_WEIGHTS.experience * experience +
      TRUST_WEIGHTS.profile * profile);

  return { score: Math.round(score), rating, reliability, experience, profile };
}

export function trustLabel(score: number): 'Alta' | 'Media' | 'En construcción' {
  if (score >= 75) return 'Alta';
  if (score >= 55) return 'Media';
  return 'En construcción';
}
