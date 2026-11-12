import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { Category } from './types';

type Icon = ComponentProps<typeof Ionicons>['name'];

/** Ícono y ejemplo corto de cada categoría, para la pantalla de inicio. */
export const CATEGORY_META: Record<Category, { icon: Icon; example: string; short?: string }> = {
  plomeria: { icon: 'water-outline', example: 'Fugas, destapes, grifos' },
  electricidad: { icon: 'flash-outline', example: 'Tomas, breakers, luces' },
  cerrajeria: { icon: 'key-outline', example: 'Chapas, aperturas' },
  limpieza: { icon: 'sparkles-outline', example: 'Hogar, muebles, vidrios' },
  pintura: { icon: 'color-palette-outline', example: 'Paredes, humedad' },
  carpinteria: { icon: 'hammer-outline', example: 'Muebles, puertas' },
  electrodomesticos: { icon: 'tv-outline', example: 'Lavadora, nevera', short: 'Electrodomésticos' },
  jardineria: { icon: 'leaf-outline', example: 'Poda, plantas' },
  mudanza: { icon: 'cube-outline', example: 'Trasteos, acarreos', short: 'Mudanzas' },
  otros: { icon: 'construct-outline', example: 'Arreglos varios' },
};
