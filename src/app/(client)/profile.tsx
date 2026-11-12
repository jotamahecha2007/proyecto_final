import { useState } from 'react';

import { getCurrentLocation } from '@/components/LocationPicker';
import { AccountCard, SettingsButton, LogoutButton } from '@/components/sharedScreens';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { updateUserLocation } from '@/services/users';

export default function ClientProfile() {
  const { user, profile } = useSession();
  const [busy, setBusy] = useState(false);

  async function refreshLocation() {
    setBusy(true);
    const p = await getCurrentLocation().catch(() => null);
    if (p) await updateUserLocation(user.uid, p);
    setBusy(false);
  }

  return (
    <Screen>
      <AccountCard />
      <Card>
        <AppText variant="label">Ubicación guardada</AppText>
        <AppText variant="muted">{profile.location?.label ?? (profile.location ? 'Ubicación guardada' : 'Ninguna todavía')}</AppText>
        <Button label="Actualizar con mi ubicación actual" variant="secondary" icon="locate-outline" onPress={refreshLocation} loading={busy} />
      </Card>
      <SettingsButton />
      <LogoutButton />
    </Screen>
  );
}
