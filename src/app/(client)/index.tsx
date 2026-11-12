import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';

import { TrustBadge } from '@/components/ProviderCard';
import { SkeletonBlock } from '@/components/Skeleton';
import { AppText, Card, Screen, Stars, StatusBadge, styles } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { CATEGORY_META } from '@/lib/categories';
import { classifyByRules, normalize } from '@/lib/classifierRules';
import { distanceKm, formatKm } from '@/lib/geo';
import { BOOKING_STATUS } from '@/lib/status';
import { fonts, formatDateTime, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';
import { CATEGORIES, CATEGORY_LABELS, type Booking, type Category, type ProviderProfile } from '@/lib/types';
import { subscribeMyBookings } from '@/services/bookings';
import { fetchTopProviders } from '@/services/providers';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function goNewRequest(params: { category?: Category; text?: string } = {}) {
  router.push({ pathname: '/new-request', params });
}

/** Pantalla de inicio del cliente: buscador, categorías, servicio en curso y prestadores destacados. */
export default function ClientHome() {
  const t = useTheme();
  const { profile } = useSession();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [providers, setProviders] = useState<ProviderProfile[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    fetchTopProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);
  useEffect(() => subscribeMyBookings(profile.uid, 'client', setBookings), [profile.uid]);

  const active = bookings.find((b) => b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'pending');

  // Buscador: categorías por nombre, prestadores por nombre o servicio, y una sugerencia
  // de categoría a partir del texto (con el mismo clasificador por reglas de la app).
  const q = normalize(query.trim());
  const results = useMemo(() => {
    if (q.length < 2) return null;
    const cats = CATEGORIES.filter((c) => normalize(`${CATEGORY_LABELS[c]} ${CATEGORY_META[c].example}`).includes(q));
    const guess = classifyByRules(query).category;
    if (guess !== 'otros' && !cats.includes(guess)) cats.unshift(guess);
    const provs = (providers ?? []).filter((p) =>
      normalize(`${p.name} ${p.categories.map((c) => CATEGORY_LABELS[c]).join(' ')} ${p.bio}`).includes(q),
    );
    return { cats: cats.slice(0, 4), provs: provs.slice(0, 5) };
  }, [q, query, providers]);

  const nearby = useMemo(() => {
    if (!providers) return null;
    const here = profile.location;
    return [...providers]
      .map((p) => ({ p, km: here ? distanceKm(here, p.location) : undefined }))
      .filter((x) => x.km === undefined || x.km <= x.p.serviceRadiusKm)
      .sort((a, b) => b.p.trustScore - a.p.trustScore)
      .slice(0, 8);
  }, [providers, profile.location]);

  // Dos columnas: caben los nombres largos («Electrodomésticos») y las 10 categorías quedan parejas.
  const tile = (width - spacing.lg * 2 - spacing.sm) / 2;

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <AppText variant="muted">{greeting()},</AppText>
        <AppText variant="title" style={{ color: t.primary }}>
          {profile.name.split(' ')[0]}
        </AppText>
      </View>

      {/* Buscador */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: MIN_TOUCH + 4,
          paddingHorizontal: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: t.surface,
          borderWidth: 1.5,
          borderColor: t.border,
        }}
      >
        <Ionicons name="search" size={20} color={t.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="¿Qué necesitas? Ej.: «se dañó la luz»"
          placeholderTextColor={t.textMuted}
          accessibilityLabel="Buscar un servicio o un prestador"
          returnKeyType="search"
          onSubmitEditing={() => query.trim().length >= 3 && goNewRequest({ text: query.trim() })}
          style={{ flex: 1, color: t.text, fontSize: 16, fontFamily: fonts.regular, paddingVertical: spacing.sm }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={12}>
            <Ionicons name="close-circle" size={20} color={t.textMuted} />
          </Pressable>
        )}
      </View>

      {results ? (
        <View style={{ gap: spacing.md }}>
          {results.cats.length > 0 && (
            <Card>
              <AppText variant="label">Servicios</AppText>
              {results.cats.map((c) => (
                <ResultRow
                  key={c}
                  icon={CATEGORY_META[c].icon}
                  title={CATEGORY_LABELS[c]}
                  subtitle={CATEGORY_META[c].example}
                  onPress={() => goNewRequest({ category: c, text: query.trim().length >= 15 ? query.trim() : undefined })}
                />
              ))}
            </Card>
          )}
          {results.provs.length > 0 && (
            <Card>
              <AppText variant="label">Prestadores</AppText>
              {results.provs.map((p) => (
                <ResultRow
                  key={p.uid}
                  icon="person-circle-outline"
                  title={p.name}
                  subtitle={`${p.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')} · confianza ${p.trustScore}/100`}
                  onPress={() => router.push(`/provider/${p.uid}`)}
                />
              ))}
            </Card>
          )}
          <ResultRow
            icon="create-outline"
            title="Describir mi problema"
            subtitle={`Usar «${query.trim()}» como punto de partida`}
            onPress={() => goNewRequest({ text: query.trim() })}
            highlight
          />
        </View>
      ) : (
        <>
          {active && (
            <Pressable
              onPress={() => router.push(`/booking/${active.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Servicio en curso: ${CATEGORY_LABELS[active.category]} con ${active.providerName}. ${
                active.onTheWayAt && active.status === 'confirmed' ? 'Va en camino.' : BOOKING_STATUS[active.status].label
              }. Toca para ver.`}
            >
              <Card style={{ borderColor: t.primary, borderWidth: 2 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <AppText variant="label">Tu servicio en curso</AppText>
                  <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
                </View>
                <AppText variant="heading">
                  {CATEGORY_LABELS[active.category]} con {active.providerName.split(' ')[0]}
                </AppText>
                <AppText variant="muted">{formatDateTime(active.start)}</AppText>
                {active.onTheWayAt && active.status === 'confirmed' ? (
                  <StatusBadge label="Va en camino · toca para ver el mapa" tone="info" icon="car-outline" />
                ) : (
                  <StatusBadge label={BOOKING_STATUS[active.status].label} tone={BOOKING_STATUS[active.status].tone} icon={BOOKING_STATUS[active.status].icon} />
                )}
              </Card>
            </Pressable>
          )}

          {/* Llamado principal */}
          <Pressable
            onPress={() => goNewRequest()}
            accessibilityRole="button"
            accessibilityLabel="Describe tu problema con tus palabras y te mostramos los 3 prestadores más compatibles"
            style={({ pressed }) => ({
              backgroundColor: t.primary,
              borderRadius: radius.lg,
              padding: spacing.xl,
              gap: spacing.sm,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <AppText variant="title" style={{ color: t.primaryText, fontSize: 24, lineHeight: 30 }}>
                Cuéntanos qué pasó
              </AppText>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.primaryText, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-forward" size={22} color={t.primary} />
              </View>
            </View>
            <AppText style={{ color: t.primaryText, opacity: 0.9 }}>
              Escríbelo con tus palabras y te mostramos los 3 prestadores más compatibles.
            </AppText>
          </Pressable>

          {/* Categorías */}
          <AppText variant="heading">¿Qué necesitas hoy?</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => goNewRequest({ category: c })}
                accessibilityRole="button"
                accessibilityLabel={`${CATEGORY_LABELS[c]}: ${CATEGORY_META[c].example}`}
                style={({ pressed }) => ({
                  width: tile,
                  minHeight: 76,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: t.surface,
                  borderWidth: 1,
                  borderColor: t.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={CATEGORY_META[c].icon} size={22} color={t.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="label" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    {CATEGORY_META[c].short ?? CATEGORY_LABELS[c]}
                  </AppText>
                  <AppText variant="small" style={{ fontSize: 12, lineHeight: 15 }} numberOfLines={2}>
                    {CATEGORY_META[c].example}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Destacados (se ocultan si todavía no hay prestadores en la zona) */}
          {nearby?.length !== 0 && <AppText variant="heading">Mejor calificados cerca de ti</AppText>}
          {nearby?.length !== 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
            {nearby === null
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={{ width: 200, gap: 8, padding: spacing.md, borderRadius: radius.lg, backgroundColor: t.surface }}>
                    <SkeletonBlock width={48} height={48} style={{ borderRadius: 24 }} />
                    <SkeletonBlock width="80%" height={16} />
                    <SkeletonBlock width="60%" />
                  </View>
                ))
              : nearby.map(({ p, km }) => {
                  const avg = p.stats.ratingCount ? p.stats.ratingSum / p.stats.ratingCount : 0;
                  return (
                    <Pressable
                      key={p.uid}
                      onPress={() => router.push(`/provider/${p.uid}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${p.categories.map((c) => CATEGORY_LABELS[c]).join(' y ')}, confianza ${p.trustScore} de 100${
                        km !== undefined ? `, a ${formatKm(km)}` : ''
                      }`}
                    >
                      <Card style={{ width: 210 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                          <AppText variant="heading" style={{ color: t.primary }}>
                            {p.name
                              .split(' ')
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join('')}
                          </AppText>
                        </View>
                        <AppText variant="label" numberOfLines={1}>
                          {p.name}
                        </AppText>
                        <AppText variant="small" numberOfLines={1}>
                          {p.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')}
                        </AppText>
                        <TrustBadge score={p.trustScore} />
                        <View style={styles.row}>
                          {avg > 0 && <Stars value={avg} size={13} />}
                          {km !== undefined && <AppText variant="small">{formatKm(km)}</AppText>}
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
          </ScrollView>
          )}
        </>
      )}
    </Screen>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  onPress,
  highlight,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: MIN_TOUCH + 8,
        paddingHorizontal: highlight ? spacing.md : 0,
        borderRadius: radius.md,
        backgroundColor: highlight ? t.surfaceAlt : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: highlight ? t.surface : t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={t.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="small" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
    </Pressable>
  );
}
