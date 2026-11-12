import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { LocationPicker } from '@/components/LocationPicker';
import { ScheduleEditor } from '@/components/ScheduleEditor';
import { AppText, Button, Card, Chip, ErrorText, Loading, Screen, Stepper, TextField, styles } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { BOGOTA_CENTER } from '@/lib/geo';
import { DEFAULT_SCHEDULE } from '@/lib/schedule';
import { formatCOP, useTheme } from '@/lib/theme';
import { CATEGORIES, CATEGORY_LABELS, type Category, type GeoPoint, type ProviderProfile, type WeeklySchedule } from '@/lib/types';
import { getProvider, saveProvider } from '@/services/providers';

export default function ProviderSetup() {
  const { user, profile } = useSession();
  const t = useTheme();
  const [existing, setExisting] = useState<ProviderProfile | null | undefined>();
  const [bio, setBio] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [hourlyRate, setHourlyRate] = useState(35000);
  const [radiusKm, setRadiusKm] = useState(8);
  const [location, setLocation] = useState<GeoPoint>(BOGOTA_CENTER);
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE);
  const [identityDeclared, setIdentityDeclared] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProvider(user.uid).then((p) => {
      setExisting(p);
      if (!p) return;
      setBio(p.bio);
      setCategories(p.categories);
      setHourlyRate(p.hourlyRate);
      setRadiusKm(p.serviceRadiusKm);
      setLocation(p.location);
      setSchedule(p.schedule);
      setIdentityDeclared(p.identityDeclared);
    });
  }, [user.uid]);

  if (existing === undefined) return <Loading />;

  const toggle = (c: Category) =>
    setCategories((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  async function save() {
    setError(undefined);
    if (categories.length === 0) return setError('Elige al menos un servicio.');
    if (bio.trim().length < 30) return setError('Cuéntale a los clientes tu experiencia (mínimo 30 caracteres).');
    if (!schedule.some(Boolean)) return setError('Activa al menos un día de trabajo.');
    setBusy(true);
    try {
      await saveProvider(
        {
          uid: user.uid,
          name: profile.name,
          bio: bio.trim(),
          categories,
          hourlyRate,
          serviceRadiusKm: radiusKm,
          location,
          schedule,
          identityDeclared,
        },
        existing ?? null,
      );
      router.replace('/(provider)');
    } catch {
      setError('No se pudo guardar. Revisa tu conexión.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">{existing ? 'Edita tu perfil' : 'Arma tu perfil profesional'}</AppText>
      <AppText variant="muted">Con esto te mostramos a los clientes correctos. Un perfil completo sube tu puntaje de confianza.</AppText>

      <Card>
        <AppText variant="label">¿Qué servicios ofreces?</AppText>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((c) => (
            <Chip key={c} multi label={CATEGORY_LABELS[c]} selected={categories.includes(c)} onPress={() => toggle(c)} />
          ))}
        </View>
      </Card>

      <TextField
        label="Tu experiencia"
        help="Años de experiencia, en qué te especializas, si llevas herramientas propias…"
        multiline
        value={bio}
        onChangeText={setBio}
        maxLength={500}
      />

      <Card>
        <Stepper label="Tarifa por hora" value={hourlyRate} display={formatCOP(hourlyRate)} step={5000} min={15000} max={300000} onChange={setHourlyRate} />
        <Stepper label="Distancia máxima" value={radiusKm} display={`${radiusKm} km`} step={1} min={2} max={30} onChange={setRadiusKm} />
      </Card>

      <LocationPicker title="¿Desde dónde sales a trabajar?" value={location} onChange={setLocation} />

      <AppText variant="heading">Horario de trabajo</AppText>
      <ScheduleEditor value={schedule} onChange={setSchedule} />

      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <AppText variant="label" style={{ flex: 1 }}>
            Declaro que mis datos son reales
          </AppText>
          <Switch
            value={identityDeclared}
            onValueChange={setIdentityDeclared}
            accessibilityLabel="Declaro que mis datos son reales"
            trackColor={{ true: t.primary, false: t.border }}
          />
        </View>
        <AppText variant="small">
          En el MVP es una declaración; la verificación de identidad con documento llegará en una fase posterior.
        </AppText>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar perfil" onPress={save} loading={busy} />
    </Screen>
  );
}
