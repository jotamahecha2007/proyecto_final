import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen, styles } from '@/components/ui';
import { openNotification, useNotifications } from '@/context/NotificationsContext';
import { fonts, formatDateTime, MIN_TOUCH, useTheme } from '@/lib/theme';
import type { NotificationType } from '@/lib/types';
import { markAllRead } from '@/services/notifications';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  booking_new: 'briefcase-outline',
  booking_status: 'calendar-outline',
  on_the_way: 'car-outline',
  booking_cancelled: 'close-circle-outline',
  price_proposal: 'pricetag-outline',
  price_answer: 'pricetag-outline',
  quote_request: 'document-text-outline',
  quote_new: 'pricetags-outline',
  message: 'chatbubble-outline',
  review: 'star-outline',
  admin_message: 'megaphone-outline',
  report_new: 'flag-outline',
  report_update: 'flag-outline',
  data_request_new: 'document-lock-outline',
  data_request_answered: 'document-lock-outline',
};

export default function NotificationsScreen() {
  const t = useTheme();
  const { items, unread } = useNotifications();

  return (
    <Screen>
      {unread > 0 && <Button label={`Marcar todas como leídas (${unread})`} variant="secondary" icon="checkmark-done" onPress={() => markAllRead(items)} />}
      {items.length === 0 && <EmptyState icon="notifications-outline" text="No tienes notificaciones todavía." />}
      {items.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => openNotification(n)}
          accessibilityRole="button"
          accessibilityLabel={`${n.read ? '' : 'No leída. '}${n.title}. ${n.body}. ${formatDateTime(n.createdAt)}`}
          style={{ minHeight: MIN_TOUCH }}
        >
          <Card style={{ borderColor: n.read ? t.border : t.primary, borderWidth: n.read ? 1 : 2 }}>
            <View style={[styles.row, { alignItems: 'flex-start' }]}>
              <Ionicons name={ICONS[n.type] ?? 'notifications-outline'} size={22} color={n.read ? t.textMuted : t.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <AppText variant="label" style={{ flex: 1 }}>
                    {n.title}
                  </AppText>
                  {!n.read && (
                    <AppText variant="small" style={{ color: t.primary, fontFamily: fonts.bold }}>
                      Nueva
                    </AppText>
                  )}
                </View>
                <AppText variant="muted">{n.body}</AppText>
                <AppText variant="small">{formatDateTime(n.createdAt)}</AppText>
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
