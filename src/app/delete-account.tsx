import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, ErrorText, Screen, StatusBadge, TextField, styles } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { auth, functions } from '@/lib/firebase';
import { useTheme } from '@/lib/theme';
import { logout } from '@/services/users';

const CONFIRM_WORD = 'ELIMINAR';

/**
 * Eliminar la cuenta desde la app: lo exige Google Play y es el derecho de supresión
 * de la Ley 1581. Pide la contraseña otra vez para que nadie la borre con un celular ajeno.
 */
export default function DeleteAccount() {
  const t = useTheme();
  const { user, profile } = useSession();
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ready = word.trim().toUpperCase() === CONFIRM_WORD && password.length >= 6;

  const willDelete = [
    'Tu perfil, tu correo y tu acceso a TeAyudo.',
    profile.role === 'provider' ? 'Tu perfil profesional, tu horario y las reseñas que recibiste.' : 'Tu reputación como cliente.',
    'Los mensajes, fotos, notas de voz y videos que enviaste por el chat.',
    'Las fotos de tus solicitudes y tus notificaciones.',
  ];
  const willKeep = [
    'Los servicios activos se cancelan y la otra persona recibe un aviso.',
    'En el historial de la otra persona aparecerás como «Usuario eliminado».',
    'Las reseñas que escribiste se conservan sin tu nombre.',
  ];

  async function remove() {
    setBusy(true);
    setError(undefined);
    try {
      const current = auth.currentUser;
      if (!current?.email) throw new Error('sin sesión');
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
      await httpsCallable(functions, 'deleteMyAccount', { timeout: 120_000 })({});
      await logout().catch(() => {});
      router.replace('/login');
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code.includes('wrong-password') || code.includes('invalid-credential')
          ? 'La contraseña no es correcta.'
          : 'No se pudo eliminar la cuenta. Revisa tu conexión e intenta de nuevo.',
      );
      setBusy(false);
    }
  }

  const list = (items: string[], icon: 'trash-outline' | 'information-circle-outline', color: string) =>
    items.map((text) => (
      <View key={text} style={[styles.row, { alignItems: 'flex-start' }]}>
        <Ionicons name={icon} size={18} color={color} style={{ marginTop: 2 }} />
        <AppText style={{ flex: 1 }}>{text}</AppText>
      </View>
    ));

  return (
    <Screen>
      <StatusBadge label="Esta acción no se puede deshacer" tone="danger" icon="warning-outline" />
      <AppText variant="title">¿Eliminar tu cuenta?</AppText>
      <AppText variant="muted">{user.email}</AppText>

      <Card>
        <AppText variant="label">Se elimina</AppText>
        {list(willDelete, 'trash-outline', t.danger)}
      </Card>
      <Card>
        <AppText variant="label">Qué pasa con lo demás</AppText>
        {list(willKeep, 'information-circle-outline', t.info)}
      </Card>

      <TextField label="Tu contraseña" secureTextEntry value={password} onChangeText={setPassword} autoComplete="password" />
      <TextField
        label={`Escribe ${CONFIRM_WORD} para confirmar`}
        value={word}
        onChangeText={setWord}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Eliminar mi cuenta para siempre" variant="danger" icon="trash-outline" onPress={remove} loading={busy} disabled={!ready} />
      <Button label="No, volver" variant="secondary" onPress={() => router.back()} disabled={busy} />
    </Screen>
  );
}
