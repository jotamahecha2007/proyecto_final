import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui';
import { MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';

export const MAX_REQUEST_PHOTOS = 3;

/**
 * Hasta 3 fotos del problema. Se pueden tomar con la cámara o elegir de la galería.
 * Ayudan a que el prestador entienda el trabajo y cotice mejor sin preguntar por chat.
 */
export function PhotoPicker({ value, onChange }: { value: string[]; onChange: (uris: string[]) => void }) {
  const t = useTheme();
  const full = value.length >= MAX_REQUEST_PHOTOS;

  async function add(source: 'camera' | 'library') {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: MAX_REQUEST_PHOTOS - value.length });
    if (res.canceled) return;
    onChange([...value, ...res.assets.map((a) => a.uri)].slice(0, MAX_REQUEST_PHOTOS));
  }

  const addButton = (icon: 'camera-outline' | 'images-outline', label: string, source: 'camera' | 'library') => (
    <Pressable
      onPress={() => add(source)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 96,
        height: 96,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: t.primary,
        backgroundColor: t.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      <Ionicons name={icon} size={26} color={t.primary} />
      <AppText variant="small" style={{ color: t.primary }}>
        {source === 'camera' ? 'Tomar' : 'Galería'}
      </AppText>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">Fotos del problema (opcional)</AppText>
      <AppText variant="small">
        Hasta {MAX_REQUEST_PHOTOS} fotos. Ayudan al prestador a entender el trabajo. {value.length}/{MAX_REQUEST_PHOTOS}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {value.map((uri, i) => (
          <View key={uri}>
            <Image source={{ uri }} style={{ width: 96, height: 96, borderRadius: radius.md, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border }} accessibilityLabel={`Foto ${i + 1} del problema`} />
            <Pressable
              onPress={() => onChange(value.filter((u) => u !== uri))}
              accessibilityRole="button"
              accessibilityLabel={`Quitar la foto ${i + 1}`}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={t.danger} />
            </Pressable>
          </View>
        ))}
        {!full && addButton('camera-outline', 'Tomar una foto del problema', 'camera')}
        {!full && addButton('images-outline', 'Elegir fotos de la galería', 'library')}
      </ScrollView>
    </View>
  );
}

/** Fotos ya subidas (en la solicitud, la cotización o la contratación). */
export function PhotoStrip({ photos }: { photos?: string[] }) {
  const t = useTheme();
  if (!photos?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {photos.map((uri, i) => (
        <Image
          key={uri}
          source={{ uri }}
          // Fondo y borde del tema: se ve un recuadro mientras carga y la foto no «brilla» sobre el fondo oscuro.
          style={{ width: 120, height: 120, borderRadius: radius.md, minWidth: MIN_TOUCH, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border }}
          accessibilityLabel={`Foto ${i + 1} de ${photos.length} del problema`}
        />
      ))}
    </ScrollView>
  );
}
