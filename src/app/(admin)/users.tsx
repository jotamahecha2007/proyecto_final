import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { SkeletonList } from '@/components/Skeleton';
import { AppText, Card, Chip, EmptyState, Screen, StatusBadge, styles } from '@/components/ui';
import { normalize } from '@/lib/classifierRules';
import { fonts, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';
import type { ProviderProfile, UserProfile } from '@/lib/types';
import { subscribeAllProviders, subscribeAllUsers } from '@/services/admin';

type Filter = 'all' | 'client' | 'provider' | 'suspended' | 'unverified' | 'admin';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'client', label: 'Clientes' },
  { key: 'provider', label: 'Prestadores' },
  { key: 'unverified', label: 'Sin verificar' },
  { key: 'suspended', label: 'Suspendidos' },
  { key: 'admin', label: 'Administradores' },
];

const ROLE_LABEL = { client: 'Cliente', provider: 'Prestador', admin: 'Administrador' } as const;

export default function AdminUsers() {
  const t = useTheme();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [providers, setProviders] = useState<Record<string, ProviderProfile>>({});
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => subscribeAllUsers(setUsers), []);
  useEffect(() => subscribeAllProviders((ps) => setProviders(Object.fromEntries(ps.map((p) => [p.uid, p])))), []);

  const list = useMemo(() => {
    if (!users) return null;
    const term = normalize(q.trim());
    return users
      .filter((u) => {
        const p = providers[u.uid];
        if (filter === 'client' && u.role !== 'client') return false;
        if (filter === 'provider' && u.role !== 'provider') return false;
        if (filter === 'admin' && u.role !== 'admin') return false;
        if (filter === 'suspended' && !u.suspended) return false;
        if (filter === 'unverified' && (u.role !== 'provider' || p?.identityVerified)) return false;
        return !term || normalize(`${u.name} ${u.email}`).includes(term);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [users, providers, q, filter]);

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: MIN_TOUCH,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          backgroundColor: t.surface,
          borderWidth: 1.5,
          borderColor: t.border,
        }}
      >
        <Ionicons name="search" size={20} color={t.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nombre o correo"
          placeholderTextColor={t.textMuted}
          accessibilityLabel="Buscar usuarios por nombre o correo"
          autoCapitalize="none"
          style={{ flex: 1, color: t.text, fontSize: 16, fontFamily: fonts.regular, paddingVertical: spacing.sm }}
        />
      </View>
      <View style={styles.chipWrap} accessibilityRole="radiogroup" accessibilityLabel="Filtrar usuarios">
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {list === null ? (
        <SkeletonList count={5} lines={1} avatar />
      ) : list.length === 0 ? (
        <EmptyState icon="people-outline" text="No hay usuarios con ese filtro." />
      ) : (
        <>
          <AppText variant="small">
            {list.length} {list.length === 1 ? 'usuario' : 'usuarios'}
          </AppText>
          {list.map((u) => {
            const p = providers[u.uid];
            return (
              <Pressable
                key={u.uid}
                onPress={() => router.push(`/admin/user/${u.uid}`)}
                accessibilityRole="button"
                accessibilityLabel={`${u.name}, ${ROLE_LABEL[u.role]}${u.suspended ? ', suspendido' : ''}${p?.identityVerified ? ', verificado' : ''}. ${u.email}`}
              >
                <Card>
                  <View style={[styles.row, { alignItems: 'center' }]}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <AppText variant="label" style={{ color: t.primary }}>
                        {u.name
                          .split(' ')
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join('')}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" numberOfLines={1}>
                        {u.name}
                      </AppText>
                      <AppText variant="small" numberOfLines={1}>
                        {u.email}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
                  </View>
                  <View style={styles.chipWrap}>
                    <StatusBadge label={ROLE_LABEL[u.role]} tone="neutral" icon={u.role === 'admin' ? 'shield-outline' : u.role === 'provider' ? 'construct-outline' : 'home-outline'} />
                    {u.suspended && <StatusBadge label="Suspendido" tone="danger" icon="ban-outline" />}
                    {p?.identityVerified && <StatusBadge label="Verificado" tone="success" icon="shield-checkmark-outline" />}
                    {p && <StatusBadge label={`Confianza ${p.trustScore}`} tone="info" icon="analytics-outline" />}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </>
      )}
    </Screen>
  );
}
