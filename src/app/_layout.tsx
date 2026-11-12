import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { PlayfairDisplay_600SemiBold_Italic } from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HeaderBack, useSafeHardwareBack } from '@/components/HeaderBack';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { fonts, resolveTheme, useTheme } from '@/lib/theme';

function AppStack() {
  const t = useTheme();
  useSafeHardwareBack();
  const modal = { presentation: 'modal' as const, headerLeft: () => <HeaderBack modal /> };
  return (
    <>
      {/* Letras de la barra del celular (hora, batería) claras u oscuras según el tema. */}
      <StatusBar style={t.statusBar} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          // Encabezado único: toda pantalla interna tiene «volver», también si se abrió desde
          // una notificación (sin pantalla anterior va al inicio). Las pantallas nuevas lo heredan.
          headerLeft: () => <HeaderBack />,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="new-request" options={{ title: 'Pedir un servicio' }} />
        <Stack.Screen name="legal" options={{ title: 'Términos y privacidad' }} />
        <Stack.Screen name="policy-update" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
        <Stack.Screen name="privacy" options={{ title: 'Mis datos y privacidad' }} />
        <Stack.Screen name="admin/data-requests" options={{ title: 'Solicitudes de datos' }} />
        <Stack.Screen name="delete-account" options={{ title: 'Eliminar cuenta' }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(client)" options={{ headerShown: false }} />
        <Stack.Screen name="(provider)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="admin/user/[id]" options={{ title: 'Usuario' }} />
        <Stack.Screen name="report" options={{ title: 'Reportar', ...modal }} />
        <Stack.Screen name="provider-setup" options={{ title: 'Perfil profesional' }} />
        <Stack.Screen name="request/[id]" options={{ title: 'Tu solicitud' }} />
        <Stack.Screen name="provider/[id]" options={{ title: 'Perfil del prestador' }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Contratación' }} />
        <Stack.Screen name="review/[bookingId]" options={{ title: 'Calificar', ...modal }} />
        <Stack.Screen name="pay/[bookingId]" options={{ title: 'Pago (simulado)', ...modal }} />
        <Stack.Screen name="quote/[requestId]" options={{ title: 'Enviar cotización' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notificaciones' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded, error] = useFonts({
    PlayfairDisplay_600SemiBold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  // Si las fuentes fallan, la app sigue con las del sistema en vez de quedarse cargando.
  // Pantalla de carga antes de leer los Ajustes: sigue el modo del celular.
  const boot = resolveTheme('system', scheme, false);
  if (!loaded && !error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: boot.bg }}>
        <ActivityIndicator size="large" color={boot.primary} accessibilityLabel="Cargando" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <AppStack />
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
