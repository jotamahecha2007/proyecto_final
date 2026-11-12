import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { SkeletonList } from '@/components/Skeleton';
import { AppText, Button, Card, EmptyState, Screen, Stars, styles } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { USE_EMULATORS } from '@/lib/firebase';
import { formatDateTime, MIN_TOUCH, useTheme } from '@/lib/theme';
import type { Chat } from '@/lib/types';
import { subscribeChats } from '@/services/chat';
import { logout } from '@/services/users';

export function ChatsList() {
  const { user } = useSession();
  const t = useTheme();
  const [chats, setChats] = useState<Chat[] | null>(null);
  useEffect(() => subscribeChats(user.uid, setChats), [user.uid]);

  return (
    <Screen>
      {chats === null && <SkeletonList count={3} lines={1} avatar />}
      {chats && chats.length === 0 && (
        <EmptyState icon="chatbubbles-outline" text="Aquí aparecerán tus conversaciones cuando contrates o te contraten." />
      )}
      {chats?.map((c) => {
        const otherId = c.participants.find((p) => p !== user.uid) ?? '';
        const name = c.names[otherId] ?? 'Usuario';
        return (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/chat/${c.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Conversación con ${name}. Último mensaje: ${c.lastMessage || 'ninguno'}`}
            style={{ minHeight: MIN_TOUCH }}
          >
            <Card>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <AppText variant="label">{name}</AppText>
                <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
              </View>
              <AppText variant="muted" numberOfLines={1}>
                {c.lastMessage || 'Sin mensajes todavía'}
              </AppText>
              {c.updatedAt > 0 && <AppText variant="small">{formatDateTime(c.updatedAt)}</AppText>}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

export function AccountCard() {
  const { profile } = useSession();
  const avg = profile.ratingCount ? profile.ratingSum / profile.ratingCount : 0;
  return (
    <Card>
      <AppText variant="heading">{profile.name}</AppText>
      <AppText variant="muted">{profile.email}</AppText>
      <AppText variant="muted">Cuenta de {profile.role === 'client' ? 'cliente' : profile.role === 'provider' ? 'prestador' : 'administrador'}</AppText>
      {profile.role === 'client' && (
        <View style={styles.row}>
          {profile.ratingCount > 0 ? (
            <>
              <Stars value={avg} />
              <AppText variant="small">
                Tu reputación como cliente ({profile.ratingCount} {profile.ratingCount === 1 ? 'calificación' : 'calificaciones'})
              </AppText>
            </>
          ) : (
            <AppText variant="small">Los prestadores aún no te han calificado.</AppText>
          )}
        </View>
      )}
    </Card>
  );
}

export function LogoutButton() {
  const { profile } = useSession();
  return (
    <>
      <Button
        label="Cerrar sesión"
        variant="danger"
        icon="log-out-outline"
        onPress={() =>
          Alert.alert('¿Cerrar sesión?', '', [
            { text: 'No', style: 'cancel' },
            { text: 'Sí, salir', style: 'destructive', onPress: () => logout() },
          ])
        }
      />
      <Button label="Mis datos y privacidad" variant="secondary" icon="lock-closed-outline" onPress={() => router.push('/privacy')} />
      <Button label="Términos y tratamiento de datos" variant="ghost" icon="document-text-outline" onPress={() => router.push('/legal')} />
      {profile.role !== 'admin' && (
        <Button label="Eliminar mi cuenta" variant="ghost" icon="trash-outline" onPress={() => router.push('/delete-account')} />
      )}
      {USE_EMULATORS && <AppText variant="small">Conectado a los emuladores locales de Firebase.</AppText>}
    </>
  );
}

/** Acceso a Ajustes (apariencia y accesibilidad) desde el perfil de cada rol. */
export function SettingsButton() {
  return <Button label="Ajustes: apariencia y accesibilidad" variant="secondary" icon="settings-outline" onPress={() => router.push('/settings')} />;
}
