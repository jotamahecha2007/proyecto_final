import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { TrustBadge } from '@/components/ProviderCard';
import { AccountCard, SettingsButton, LogoutButton } from '@/components/sharedScreens';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { formatCOP } from '@/lib/theme';
import { CATEGORY_LABELS, type ProviderProfile } from '@/lib/types';
import { subscribeProvider } from '@/services/providers';

export default function ProviderOwnProfile() {
  const { user } = useSession();
  const [p, setP] = useState<ProviderProfile | null>(null);
  useEffect(() => subscribeProvider(user.uid, setP), [user.uid]);

  return (
    <Screen>
      <AccountCard />
      {p && (
        <Card>
          <TrustBadge score={p.trustScore} />
          <AppText>{p.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')}</AppText>
          <AppText variant="muted">
            {formatCOP(p.hourlyRate)}/hora · hasta {p.serviceRadiusKm} km · {p.stats.completedJobs} trabajos
          </AppText>
          <Button label="Ver mi perfil como lo ven los clientes" variant="secondary" onPress={() => router.push(`/provider/${user.uid}`)} />
          <Button label="Editar perfil profesional" icon="create-outline" onPress={() => router.push('/provider-setup')} />
        </Card>
      )}
      <SettingsButton />
      <LogoutButton />
    </Screen>
  );
}
