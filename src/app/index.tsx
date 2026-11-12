import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { Loading } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ONBOARDING_KEY } from '@/lib/storageKeys';

export default function Index() {
  const { user, profile, loading } = useAuth();
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setSeenOnboarding(v === '1'))
      .catch(() => setSeenOnboarding(true));
  }, []);

  if (loading || seenOnboarding === null) return <Loading />;
  if (!user || !profile) return <Redirect href={seenOnboarding ? '/login' : '/onboarding'} />;
  if (profile.role === 'admin') return <Redirect href="/(admin)" />;
  return <Redirect href={profile.role === 'client' ? '/(client)' : '/(provider)'} />;
}
