import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { AppNotification } from '@/lib/types';
import {
  ensureNotificationPermission,
  markRead,
  registerPushToken,
  showLocalNotification,
  subscribeNotifications,
} from '@/services/notifications';

interface NotificationsState {
  items: AppNotification[];
  unread: number;
}

const Ctx = createContext<NotificationsState>({ items: [], unread: 0 });

export function useNotifications() {
  return useContext(Ctx);
}

export function openNotification(n: AppNotification) {
  if (!n.read) markRead(n.id).catch(() => {});
  router.push(n.link as Href);
}

/**
 * Escucha las notificaciones del usuario (las escriben las Cloud Functions) y avisa
 * de tres formas a la vez, para no depender de un solo sentido (ver "Audición"):
 * banner visible en pantalla, vibración y anuncio para lector de pantalla.
 * Si la app está en segundo plano, además lanza un aviso del sistema.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [banner, setBanner] = useState<AppNotification | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!user) {
      setItems([]);
      seen.current = null;
      return;
    }
    ensureNotificationPermission().catch(() => {});
    registerPushToken(user.uid);
    return subscribeNotifications(user.uid, (list) => {
      // La primera carga son notificaciones viejas: no se anuncian.
      if (seen.current === null) {
        seen.current = new Set(list.map((n) => n.id));
      } else {
        const fresh = list.filter((n) => !seen.current!.has(n.id) && !n.read);
        list.forEach((n) => seen.current!.add(n.id));
        const newest = fresh[0];
        if (newest) announce(newest);
      }
      setItems(list);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Tocar un aviso del sistema abre la pantalla correspondiente.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const link = r.notification.request.content.data?.link;
      const id = r.notification.request.content.data?.id;
      if (typeof id === 'string') markRead(id).catch(() => {});
      if (typeof link === 'string') router.push(link as Href);
    });
    return () => sub.remove();
  }, []);

  function announce(n: AppNotification) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (AppState.currentState !== 'active') {
      showLocalNotification(n).catch(() => {});
      return;
    }
    AccessibilityInfo.announceForAccessibility(`${n.title}. ${n.body}`);
    setBanner(n);
    clearTimeout(hideTimer.current);
    // 8 segundos: tiempo suficiente para leerlo (WCAG 2.2.1 pide poder leer sin prisa).
    hideTimer.current = setTimeout(() => setBanner(null), 8000);
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <Ctx.Provider value={{ items, unread }}>
      {children}
      {banner && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: spacing.md, right: spacing.md }}
        >
          <Pressable
            onPress={() => {
              setBanner(null);
              openNotification(banner);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Notificación: ${banner.title}. ${banner.body}. Toca para abrir.`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: t.surface,
              borderWidth: 2,
              borderColor: t.primary,
              shadowColor: t.shadow,
              shadowOpacity: Math.min(0.4, t.shadowOpacity * 3),
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Ionicons name="notifications" size={24} color={t.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">{banner.title}</AppText>
              <AppText variant="muted" numberOfLines={2}>
                {banner.body}
              </AppText>
            </View>
            <Pressable
              onPress={() => setBanner(null)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar notificación"
              hitSlop={12}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={22} color={t.textMuted} />
            </Pressable>
          </Pressable>
        </View>
      )}
    </Ctx.Provider>
  );
}
