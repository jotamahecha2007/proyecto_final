// Modelo de datos de TeAyudo. Las fechas se guardan como milisegundos (epoch).

/** Las dos partes de un servicio. */
export type Role = 'client' | 'provider';
/** Tipo de cuenta. El administrador no se puede elegir al registrarse: lo asigna el servidor. */
export type AccountRole = Role | 'admin';

export const CATEGORIES = [
  'plomeria',
  'electricidad',
  'cerrajeria',
  'limpieza',
  'pintura',
  'carpinteria',
  'electrodomesticos',
  'jardineria',
  'mudanza',
  'otros',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  plomeria: 'Plomería',
  electricidad: 'Electricidad',
  cerrajeria: 'Cerrajería',
  limpieza: 'Limpieza',
  pintura: 'Pintura',
  carpinteria: 'Carpintería',
  electrodomesticos: 'Electrodomésticos',
  jardineria: 'Jardinería',
  mudanza: 'Mudanza y acarreos',
  otros: 'Otros arreglos',
};

export type Urgency = 'baja' | 'media' | 'alta';

export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string;
}

/** Franja de trabajo de un día, en minutos desde medianoche. null = no trabaja. */
export interface DaySchedule {
  start: number;
  end: number;
}
/** Índice 0 = domingo ... 6 = sábado (igual que Date.getDay()). */
export type WeeklySchedule = (DaySchedule | null)[];

export interface TimeSlot {
  start: number;
  end: number;
}

export interface UserProfile {
  uid: string;
  role: AccountRole;
  /** Cuenta suspendida por un administrador (no puede iniciar sesión). */
  suspended?: boolean;
  name: string;
  email: string;
  phone?: string;
  location?: GeoPoint;
  /** Reputación del cliente, calificada por los prestadores. */
  ratingSum: number;
  ratingCount: number;
  createdAt: number;
  /** Cuándo aceptó la política de tratamiento de datos (Ley 1581 de 2012) y qué versión. */
  consentAt?: number;
  consentVersion?: string;
  /** Confirmó ser mayor de 18 años al registrarse. */
  adultConfirmed?: boolean;
  /** Tokens de Expo Push (solo con build de desarrollo; Expo Go en Android no recibe push). */
  pushTokens?: string[];
}

/**
 * Reputación pública de un cliente. La escribe solo el servidor y no incluye el
 * nombre, para que el prestador pueda verla incluso en una cotización anónima.
 */
export interface ClientReputation {
  uid: string;
  ratingSum: number;
  ratingCount: number;
  completedAsClient: number;
  cancelledAsClient: number;
}

export interface ProviderStats {
  ratingSum: number;
  ratingCount: number;
  completedJobs: number;
  cancelledJobs: number;
}

export interface ProviderProfile {
  uid: string;
  name: string;
  bio: string;
  photoURL?: string;
  categories: Category[];
  hourlyRate: number; // COP por hora
  serviceRadiusKm: number;
  location: GeoPoint;
  schedule: WeeklySchedule;
  identityDeclared: boolean;
  /** Identidad revisada por un administrador de TeAyudo. */
  identityVerified?: boolean;
  /** Suspendido por un administrador: no aparece en el matching. */
  suspended?: boolean;
  stats: ProviderStats;
  trustScore: number; // 0–100, lo calcula la Cloud Function
  updatedAt: number;
}

export interface RequestAttributes {
  category: Category;
  urgency: Urgency;
  budgetMax?: number;
  estimatedHours: number;
  keywords: string[];
}

export type RequestMode = 'direct' | 'quote';
/** Cuándo: lo antes posible (próximos 7 días) o un día específico. */
export type WhenMode = 'asap' | 'day';
export type RequestStatus = 'open' | 'quoting' | 'booked' | 'cancelled';

export interface ServiceRequest {
  id: string;
  clientId: string;
  description: string;
  attributes: RequestAttributes;
  classifiedBy: 'llm' | 'rules' | 'manual';
  location: GeoPoint;
  /** Inicio de la ventana: «lo antes posible» = momento de la solicitud; un día = ese día a las 00:00. */
  desiredStart: number;
  whenMode?: WhenMode;
  mode: RequestMode;
  updatedAt?: number;
  /** Fotos del problema (hasta 3). */
  photos?: string[];
  status: RequestStatus;
  matchedProviderIds: string[];
  createdAt: number;
}

export interface Quote {
  providerId: string;
  providerName: string;
  price: number;
  /** Hora de llegada que propone el prestador según su agenda. */
  start?: number;
  estimatedHours: number;
  message: string;
  createdAt: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  requestId: string;
  clientId: string;
  clientName: string;
  providerId: string;
  providerName: string;
  category: Category;
  description: string;
  photos?: string[];
  location: GeoPoint;
  start: number;
  end: number;
  travelMinutes: number;
  price: number;
  /** true cuando el precio salió de una cotización o el cliente aceptó una propuesta. */
  priceAgreed: boolean;
  /** Propuesta de precio final del prestador, pendiente de que el cliente la acepte. */
  priceProposal?: { amount: number; note: string; proposedAt: number };
  status: BookingStatus;
  /** El prestador marcó "Voy en camino" (se comparte su ubicación hasta que llega). */
  onTheWayAt?: number;
  cancelledBy?: Role | 'admin';
  /** 'account_deleted' si se canceló porque una de las partes eliminó su cuenta. */
  cancelReason?: string;
  payment: { status: 'unpaid' | 'paid_simulated'; method?: string; paidAt?: number };
  reviewedByClient: boolean;
  reviewedByProvider: boolean;
  createdAt: number;
}

export interface Review {
  id: string;
  bookingId: string;
  authorId: string;
  authorName: string;
  targetId: string;
  targetRole: Role;
  rating: number; // 1–5
  comment: string;
  createdAt: number;
}

export interface Chat {
  id: string;
  participants: string[];
  names: Record<string, string>;
  lastMessage: string;
  updatedAt: number;
}

export type TranscriptStatus = 'pending' | 'done' | 'unavailable' | 'error';

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  /** Ruta en Storage del audio o video, para que la función de transcripción lo descargue. */
  mediaPath?: string;
  durationSec?: number;
  transcript?: string;
  transcriptStatus?: TranscriptStatus;
  createdAt: number;
}

/** Última ubicación del prestador mientras va en camino. */
export interface Tracking {
  bookingId: string;
  providerId: string;
  clientId: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

export type NotificationType =
  | 'booking_new'
  | 'booking_status'
  | 'on_the_way'
  | 'booking_cancelled'
  | 'price_proposal'
  | 'price_answer'
  | 'quote_request'
  | 'quote_new'
  | 'message'
  | 'review'
  | 'admin_message'
  | 'report_new'
  | 'report_update'
  | 'data_request_new'
  | 'data_request_answered';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Ruta de la app a la que lleva, p. ej. "/booking/abc". */
  link: string;
  read: boolean;
  createdAt: number;
}

export const REPORT_REASONS = {
  no_show: 'No llegó o no se presentó',
  bad_treatment: 'Mal trato o falta de respeto',
  overcharge: 'Cobro indebido o distinto al acordado',
  bad_work: 'Trabajo mal hecho o daños',
  inappropriate: 'Mensajes o contenido inapropiado',
  fraud: 'Posible fraude o suplantación',
  safety: 'Me sentí en peligro',
  other: 'Otro motivo',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

/** Reporte de un usuario sobre otro. Lo revisa un administrador. */
export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  targetRole: Role;
  bookingId?: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolution?: { action: 'dismiss' | 'warn' | 'suspend'; note: string; adminId: string; at: number };
  createdAt: number;
}

/** Bitácora de acciones de administración (quién hizo qué y cuándo). */
export interface AdminLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetId?: string;
  targetName?: string;
  details: string;
  createdAt: number;
}

export interface AdminStats {
  users: { clients: number; providers: number; admins: number; newLast7Days: number; suspended: number };
  providers: { verified: number; avgTrust: number; avgRating: number; withoutReviews: number };
  requests: { total: number; byCategory: Record<string, number>; quoting: number };
  bookings: { total: number; byStatus: Record<string, number>; completionRate: number; cancellationRate: number; paidTotal: number };
  reports: { open: number; total: number };
  dataRequests: { open: number; overdue: number };
  generatedAt: number;
}

// ---------- Habeas data (Ley 1581 de 2012) ----------
export const DATA_REQUEST_TYPES = {
  consulta: { label: 'Consulta', help: 'Saber qué datos tenemos, para qué los usamos o pedir prueba de tu autorización.', days: 10 },
  actualizacion: { label: 'Actualizar o corregir', help: 'Corregir datos que estén mal o desactualizados y que no puedas cambiar tú.', days: 15 },
  supresion: { label: 'Supresión', help: 'Pedir que borremos datos específicos (para borrar todo, usa «Eliminar mi cuenta»).', days: 15 },
  revocatoria: { label: 'Revocar autorización', help: 'Retirar tu autorización para un uso específico de tus datos.', days: 15 },
  reclamo: { label: 'Reclamo', help: 'Si crees que tratamos tus datos sin cumplir la ley o esta política.', days: 15 },
} as const;
export type DataRequestType = keyof typeof DATA_REQUEST_TYPES;

/** Solicitud de un titular sobre sus datos. Plazo: 10 días hábiles (consulta) o 15 (reclamos). */
export interface DataRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: DataRequestType;
  message: string;
  status: 'open' | 'answered';
  dueAt: number;
  response?: { text: string; adminId: string; adminName: string; at: number };
  createdAt: number;
}
