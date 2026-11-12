import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { user, profile } = useAuth();
  if (user && profile) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
