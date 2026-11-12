import { router } from 'expo-router';
import { useState } from 'react';

import { useBlockHardwareBack } from '@/components/HeaderBack';
import { AppText, Button, Card, Checkbox, ErrorText, Screen, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { CONSENT_VERSION } from '@/lib/legal';
import { acceptCurrentPolicy } from '@/services/privacy';
import { logout } from '@/services/users';

/** Cuando cambia la política, la persona debe aceptarla de nuevo antes de seguir. */
export default function PolicyUpdate() {
  useBlockHardwareBack(); // no se puede saltar este paso con el botón «atrás»
  const { user } = useSession();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function accept() {
    if (!checked) return setError('Para seguir debes aceptar la política actualizada.');
    setBusy(true);
    try {
      await acceptCurrentPolicy(user.uid);
      router.replace('/');
    } catch {
      setError('No se pudo guardar. Revisa tu conexión.');
      setBusy(false);
    }
  }

  return (
    <Screen style={{ paddingTop: 56 }}>
      <StatusBadge label={`Política actualizada · versión ${CONSENT_VERSION}`} tone="info" icon="document-text-outline" />
      <AppText variant="title">Actualizamos cómo tratamos tus datos</AppText>
      <Card>
        <AppText variant="label">Qué cambió</AppText>
        <AppText>• Quién es el responsable de tus datos y cómo contactarlo.</AppText>
        <AppText>• Que tus datos se procesan en servicios fuera de Colombia (Google, Anthropic y OpenAI).</AppText>
        <AppText>• Cuánto tiempo guardamos cada dato.</AppText>
        <AppText>• Cómo ejercer tus derechos desde la app y en qué plazos respondemos.</AppText>
        <AppText>• Que TeAyudo es solo para mayores de 18 años.</AppText>
      </Card>
      <Button label="Leer la política completa" variant="secondary" icon="document-text-outline" onPress={() => router.push('/legal')} />
      <Checkbox checked={checked} onChange={setChecked}>
        <AppText>Leí y acepto la política de tratamiento de datos actualizada, incluida la transferencia internacional.</AppText>
      </Checkbox>
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Aceptar y continuar" onPress={accept} loading={busy} />
      <AppText variant="small">Si no la aceptas, puedes cerrar sesión o eliminar tu cuenta.</AppText>
      <Button label="No acepto: eliminar mi cuenta" variant="ghost" onPress={() => router.push('/delete-account')} />
      <Button label="Cerrar sesión" variant="ghost" onPress={() => logout()} />
    </Screen>
  );
}
