import { router } from 'expo-router';
import { useState } from 'react';

import { BrandHeader } from '@/components/BrandHeader';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { authErrorMessage, login } from '@/services/users';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(undefined);
    if (!email || !password) return setError('Escribe tu correo y tu contraseña.');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={{ paddingTop: 56 }}>
      <BrandHeader subtitle="Conectamos a quien necesita un servicio con prestadores de confianza de su zona." />
      <AppText variant="heading">Inicia sesión</AppText>
      <TextField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        error={error}
      />
      <Button label="Iniciar sesión" onPress={onSubmit} loading={loading} />
      <Button label="Crear una cuenta" variant="ghost" onPress={() => router.push('/register')} />
    </Screen>
  );
}
