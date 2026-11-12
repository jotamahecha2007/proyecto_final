import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BrandHeader } from '@/components/BrandHeader';
import { AppText, Button, Card, Checkbox, Chip, Screen, TextField, styles } from '@/components/ui';
import type { Role } from '@/lib/types';
import { authErrorMessage, register } from '@/services/users';

// Un solo objetivo por pantalla: primero el tipo de cuenta, luego los datos.
export default function Register() {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(undefined);
    if (!role) return;
    if (name.trim().length < 3) return setError('Escribe tu nombre completo.');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (!adult) return setError('TeAyudo es solo para mayores de 18 años.');
    if (!consent) return setError('Para crear la cuenta debes aceptar los términos y el tratamiento de tus datos.');
    setLoading(true);
    try {
      // Al crear el perfil, el layout de (auth) redirige solo a la pantalla correcta.
      await register(name, email, password, role);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (!role) {
    return (
      <Screen style={{ paddingTop: 56 }}>
        <BrandHeader subtitle="Crea tu cuenta en menos de un minuto." />
        <AppText variant="heading">¿Cómo vas a usar TeAyudo?</AppText>
        <Card>
          <AppText variant="heading">Necesito un servicio</AppText>
          <AppText variant="muted">Describe lo que necesitas y te mostramos los 3 prestadores más compatibles.</AppText>
          <Button label="Soy cliente" icon="home-outline" onPress={() => setRole('client')} />
        </Card>
        <Card>
          <AppText variant="heading">Ofrezco mis servicios</AppText>
          <AppText variant="muted">Recibe trabajos de clientes de tu zona y maneja tu agenda.</AppText>
          <Button label="Soy prestador" icon="construct-outline" onPress={() => setRole('provider')} />
        </Card>
        <Button label="Ya tengo cuenta" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: 56 }}>
      <AppText variant="title">Crea tu cuenta</AppText>
      <View style={styles.row}>
        <AppText variant="muted">Tipo de cuenta:</AppText>
        <Chip label={role === 'client' ? 'Cliente' : 'Prestador'} selected onPress={() => setRole(null)} />
      </View>
      <TextField label="Nombre completo" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <TextField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Contraseña"
        help="Mínimo 6 caracteres."
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={error}
      />
      <Checkbox checked={adult} onChange={setAdult}>
        <AppText>Confirmo que soy mayor de 18 años.</AppText>
      </Checkbox>
      <Checkbox checked={consent} onChange={setConsent}>
        <AppText>
          Acepto los términos del servicio y autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012, incluida su
          transferencia a proveedores tecnológicos fuera de Colombia (Google, Anthropic y OpenAI) para las finalidades de la política.
        </AppText>
      </Checkbox>
      <Button label="Leer términos y política de datos" variant="ghost" icon="document-text-outline" onPress={() => router.push('/legal')} />
      <Button label="Crear cuenta" onPress={onSubmit} loading={loading} />
      <Button label="Cambiar tipo de cuenta" variant="ghost" onPress={() => setRole(null)} />
    </Screen>
  );
}
