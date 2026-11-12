import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { RoleTabs } from '@/components/TabsLayout';
import { Loading } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { subscribeProvider } from '@/services/providers';

export default function ProviderLayout() {
  const { user } = useAuth();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeProvider(user.uid, (p) => setHasProfile(!!p));
  }, [user]);

  // Un prestador sin perfil profesional no aparece en el matching: primero lo completa.
  if (user && hasProfile === null) return <Loading />;
  if (user && hasProfile === false) return <Redirect href="/provider-setup" />;

  return (
    <RoleTabs
      role="provider"
      tabs={[
        { name: 'index', title: 'Trabajos', icon: 'briefcase-outline' },
        { name: 'agenda', title: 'Agenda', icon: 'calendar-outline' },
        { name: 'chats', title: 'Mensajes', icon: 'chatbubbles-outline' },
        { name: 'profile', title: 'Perfil', icon: 'person-circle-outline' },
      ]}
    />
  );
}
