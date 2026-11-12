import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { Tone } from '@/components/ui';
import type { BookingStatus, RequestStatus } from './types';

type Icon = ComponentProps<typeof Ionicons>['name'];
interface StatusInfo {
  label: string;
  tone: Tone;
  icon: Icon;
}

export const BOOKING_STATUS: Record<BookingStatus, StatusInfo> = {
  pending: { label: 'Esperando confirmación', tone: 'warning', icon: 'time-outline' },
  confirmed: { label: 'Confirmado', tone: 'info', icon: 'calendar-outline' },
  in_progress: { label: 'En curso', tone: 'info', icon: 'construct-outline' },
  completed: { label: 'Terminado', tone: 'success', icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Cancelado', tone: 'danger', icon: 'close-circle-outline' },
};

export const REQUEST_STATUS: Record<RequestStatus, StatusInfo> = {
  open: { label: 'Abierta', tone: 'info', icon: 'search-outline' },
  quoting: { label: 'Recibiendo cotizaciones', tone: 'warning', icon: 'pricetags-outline' },
  booked: { label: 'Contratada', tone: 'success', icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Cancelada', tone: 'danger', icon: 'close-circle-outline' },
};

export const URGENCY_LABEL = { baja: 'Sin afán', media: 'Normal', alta: 'Urgente' } as const;
