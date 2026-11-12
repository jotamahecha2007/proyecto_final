import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, FlatList, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { fonts, spacing, useTheme } from '@/lib/theme';

import { ONBOARDING_KEY } from '@/lib/storageKeys';

type Icon = ComponentProps<typeof Ionicons>['name'];

const SLIDES: { icon: Icon; badge: Icon; title: string; text: string }[] = [
  {
    icon: 'chatbubble-ellipses-outline',
    badge: 'sparkles',
    title: 'Cuéntalo con tus palabras',
    text: 'Escribe qué pasó, como se lo dirías a un amigo. La app entiende qué servicio necesitas, qué tan urgente es y cuánto quieres gastar.',
  },
  {
    icon: 'people-outline',
    badge: 'shield-checkmark',
    title: 'Los 3 más confiables, cerca de ti',
    text: 'Te mostramos los tres prestadores más compatibles y te explicamos por qué: su reputación, la distancia y tu presupuesto.',
  },
  {
    icon: 'car-outline',
    badge: 'location',
    title: 'Síguelo hasta tu puerta',
    text: 'Chatea, acuerda el precio y mira en el mapa cuando el prestador va en camino. Al final, ambos se califican.',
  },
];

/** Tres pantallas de bienvenida. Solo aparecen la primera vez que se abre la app. */
export default function Onboarding() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const i = viewableItems[0]?.index;
    if (typeof i === 'number') setIndex(i);
  }).current;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
    router.replace('/login');
  }

  // Se puede avanzar con botones (no solo deslizando): sirve para lector de pantalla y switch access.
  function next() {
    if (last) return finish();
    const i = index + 1;
    list.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
    AccessibilityInfo.announceForAccessibility(`Paso ${i + 1} de ${SLIDES.length}: ${SLIDES[i].title}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.lg, minHeight: 48 }}>
        {!last && <Button label="Saltar" variant="ghost" onPress={finish} />}
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        keyExtractor={(s) => s.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <View style={{ width, paddingHorizontal: spacing.xl, justifyContent: 'center', gap: spacing.xl }}>
            {/* Ilustración: círculos concéntricos en azul claro con un ícono grande. */}
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 260 }} importantForAccessibility="no-hide-descendants">
              <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: t.surfaceAlt, opacity: 0.6 }} />
              <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: t.surfaceAlt }} />
              <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={56} color={t.primaryText} />
              </View>
              <View
                style={{
                  position: 'absolute',
                  top: 48,
                  right: width / 2 - 110,
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: t.surface,
                  borderWidth: 2,
                  borderColor: t.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.badge} size={24} color={t.accent} />
              </View>
            </View>
            <View style={{ gap: spacing.md }} accessible accessibilityLabel={`Paso ${i + 1} de ${SLIDES.length}. ${item.title}. ${item.text}`}>
              <AppText variant="title" style={{ textAlign: 'center', color: t.primary }}>
                {item.title}
              </AppText>
              <AppText style={{ textAlign: 'center', fontSize: 17, lineHeight: 25 }}>{item.text}</AppText>
            </View>
          </View>
        )}
      />

      <View style={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessible accessibilityLabel={`Paso ${index + 1} de ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={{ height: 8, width: i === index ? 28 : 8, borderRadius: 4, backgroundColor: i === index ? t.primary : t.border }}
            />
          ))}
        </View>
        <Button label={last ? 'Empezar' : 'Siguiente'} icon={last ? 'checkmark' : 'arrow-forward'} onPress={next} />
        <Text style={{ textAlign: 'center', color: t.textMuted, fontFamily: fonts.regular, fontSize: 13 }}>
          {index + 1} de {SLIDES.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}
