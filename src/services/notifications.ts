import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { arrayUnion, collection, doc, onSnapshot, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from '@/lib/firebase';
import type { AppNotification } from '@/lib/types';

// Con la app abierta se muestra el aviso propio de TeAyudo (banner visual + vibración),
// así que el sistema no muestra un segundo aviso encima.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export function subscribeNotifications(uid: string, cb: (n: AppNotification[]) => void) {
  return onSnapshot(
    query(collection(db, 'notifications'), where('userId', '==', uid)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification).sort((a, b) => b.createdAt - a.createdAt)),
    () => cb([]),
  );
}

export function markRead(id: string) {
  return updateDoc(doc(db, 'notifications', id), { read: true });
}

export async function markAllRead(items: AppNotification[]) {
  const unread = items.filter((n) => !n.read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
  await batch.commit();
}

/** Permiso para mostrar notificaciones del sistema (Android 13+ e iOS lo piden). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'TeAyudo',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      enableVibrate: true,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Aviso del sistema generado en el propio celular. Funciona en Expo Go y sirve
 * cuando la app está en segundo plano pero sigue viva.
 */
export function showLocalNotification(n: AppNotification) {
  return Notifications.scheduleNotificationAsync({
    content: { title: n.title, body: n.body, data: { link: n.link, id: n.id } },
    trigger: null,
  });
}

/**
 * Push remoto (llega aunque la app esté cerrada). Expo Go en Android no lo soporta
 * desde SDK 53, así que solo se registra en un build de desarrollo con projectId de EAS.
 */
export async function registerPushToken(uid: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return; // Expo Go
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await updateDoc(doc(db, 'users', uid), { pushTokens: arrayUnion(data) });
  } catch {
    // Sin push remoto la app sigue funcionando con la bandeja y los avisos locales.
  }
}
