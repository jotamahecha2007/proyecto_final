import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Loading } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { CONSENT_VERSION } from '@/lib/legal';
import { useNotifications } from '@/context/NotificationsContext';
import { fonts, MIN_TOUCH, useTheme } from '@/lib/theme';
import type { AccountRole } from '@/lib/types';

type Icon = ComponentProps<typeof Ionicons>['name'];

/** Campana con el número de no leídas (número visible, no solo un punto de color). */
function Bell() {
  const t = useTheme();
  const { unread } = useNotifications();
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
    >
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={24} color={t.text} />
      {unread > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 4,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 4,
            borderRadius: 10,
            backgroundColor: t.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: t.onDanger, fontSize: 12, fontFamily: fonts.bold }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function RoleTabs({ role, tabs }: { role: AccountRole; tabs: { name: string; title: string; icon: Icon }[] }) {
  const t = useTheme();
  const { user, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user || !profile) return <Redirect href="/login" />;
  if (profile.role !== role) return <Redirect href="/" />;
  // Si la política de datos cambió, primero hay que aceptarla de nuevo.
  if (profile.consentVersion !== CONSENT_VERSION) return <Redirect href="/policy-update" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.text,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, minHeight: 60 },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.medium },
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: t.bg },
        headerRight: () => <Bell />,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color as string} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
