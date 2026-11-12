import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { DayPicker } from '@/components/DayPicker';
import { PhotoPicker } from '@/components/PhotoPicker';
import { LocationPicker } from '@/components/LocationPicker';
import { AppText, Button, Card, Chip, ErrorText, Loading, NextSteps, Screen, Stepper, TextField, styles } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { BOGOTA_CENTER } from '@/lib/geo';
import { URGENCY_LABEL } from '@/lib/status';
import { formatCOP } from '@/lib/theme';
import { CATEGORIES, CATEGORY_LABELS, type Category, type GeoPoint, type RequestAttributes, type RequestMode, type ServiceRequest, type Urgency, type WhenMode } from '@/lib/types';
import { classifyRequest, createRequest, getRequest, updateRequest } from '@/services/requests';
import { updateUserLocation } from '@/services/users';

/** Medianoche del día elegido (la búsqueda de horarios cubre ese día completo). */
function dayStart(dayOffset: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.getTime();
}

function offsetOf(ms: number): number {
  return Math.max(0, Math.round((ms - dayStart(0)) / 86_400_000));
}

export default function NewRequest() {
  const { user, profile } = useSession();
  // Viene desde el inicio: una categoría tocada o el texto del buscador.
  // Con ?edit=<id> la misma pantalla sirve para editar una solicitud existente.
  const params = useLocalSearchParams<{ category?: string; text?: string; edit?: string }>();
  const editId = params.edit;
  const [original, setOriginal] = useState<ServiceRequest | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const presetCategory = CATEGORIES.includes(params.category as Category) ? (params.category as Category) : undefined;
  const [step, setStep] = useState<'describe' | 'confirm'>('describe');

  const [description, setDescription] = useState(params.text ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  // El cliente no elige la hora: dice "lo antes posible" o un día, y la app le muestra
  // a qué horas puede llegar cada prestador.
  const [whenMode, setWhenMode] = useState<WhenMode>('asap');
  const [dayOffset, setDayOffset] = useState(0);
  const [mode, setMode] = useState<RequestMode>('direct');
  const [location, setLocation] = useState<GeoPoint>(profile.location ?? BOGOTA_CENTER);

  const [attrs, setAttrs] = useState<RequestAttributes | null>(null);
  const [source, setSource] = useState<'llm' | 'rules' | 'manual'>('rules');
  const [budgetText, setBudgetText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile.location && !editId) setLocation(profile.location);
  }, [profile.location, editId]);

  useEffect(() => {
    if (!editId) return;
    getRequest(editId).then((r) => {
      if (r && r.clientId === user.uid) {
        setOriginal(r);
        setDescription(r.description);
        setPhotos(r.photos ?? []);
        setLocation(r.location);
        setMode(r.mode);
        const wm = r.whenMode ?? 'day';
        // Un día que ya pasó vuelve a "lo antes posible".
        setWhenMode(wm === 'day' && r.desiredStart < dayStart(0) ? 'asap' : wm);
        setDayOffset(wm === 'day' ? offsetOf(r.desiredStart) : 0);
        setAttrs(r.attributes);
        setSource(r.classifiedBy);
        setBudgetText(r.attributes.budgetMax ? String(r.attributes.budgetMax) : '');
      }
      setLoadingEdit(false);
    });
  }, [editId, user.uid]);

  async function analyze() {
    setError(undefined);
    if (description.trim().length < 15) return setError('Cuéntanos un poco más (mínimo 15 caracteres).');
    // Al editar sin cambiar la descripción, se conserva lo que ya estaba confirmado.
    if (original && attrs && description.trim() === original.description) {
      setStep('confirm');
      return;
    }
    setBusy(true);
    const res = await classifyRequest(description);
    // Si la persona eligió la categoría en el inicio, esa manda sobre la interpretación.
    const attributes = presetCategory ? { ...res.attributes, category: presetCategory } : res.attributes;
    setAttrs(attributes);
    setSource(presetCategory && presetCategory !== res.attributes.category ? 'manual' : res.source);
    setBudgetText(res.attributes.budgetMax ? String(res.attributes.budgetMax) : '');
    setBusy(false);
    setStep('confirm');
    AccessibilityInfo.announceForAccessibility(`Entendimos: ${CATEGORY_LABELS[attributes.category]}. Revisa y confirma.`);
  }

  function edit<K extends keyof RequestAttributes>(key: K, value: RequestAttributes[K]) {
    setAttrs((a) => (a ? { ...a, [key]: value } : a));
    setSource('manual');
  }

  async function submit() {
    if (!attrs) return;
    setBusy(true);
    setError(undefined);
    try {
      const budget = parseInt(budgetText.replace(/\D/g, ''), 10);
      const attributes = { ...attrs, budgetMax: Number.isFinite(budget) && budget > 0 ? budget : undefined };
      if (location !== profile.location && location !== BOGOTA_CENTER) await updateUserLocation(user.uid, location);
      const desiredStart = whenMode === 'asap' ? Date.now() : dayStart(dayOffset);
      if (original) {
        await updateRequest(original, { description: description.trim(), attributes, classifiedBy: source, location, desiredStart, whenMode, photos });
        router.back();
        return;
      }
      const id = await createRequest({
        clientId: user.uid,
        description: description.trim(),
        attributes,
        classifiedBy: source,
        location,
        desiredStart,
        whenMode,
        mode,
        localPhotos: photos,
      });
      router.replace(`/request/${id}`);
    } catch {
      setError(original ? 'No pudimos guardar los cambios. Revisa tu conexión e intenta de nuevo.' : 'No pudimos publicar la solicitud. Revisa tu conexión e intenta de nuevo (si adjuntaste fotos, prueba con menos).');
    } finally {
      setBusy(false);
    }
  }

  const title = <Stack.Screen options={{ title: original ? 'Editar solicitud' : 'Pedir un servicio' }} />;

  if (loadingEdit) return <Loading />;
  if (editId && !original) {
    return (
      <Screen>
        <ErrorText>No encontramos esa solicitud.</ErrorText>
      </Screen>
    );
  }
  if (original && !['open', 'quoting'].includes(original.status)) {
    return (
      <Screen>
        {title}
        <AppText>Esta solicitud ya no se puede editar porque {original.status === 'booked' ? 'ya contrataste a alguien' : 'fue cancelada'}.</AppText>
        <Button label="Volver" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (step === 'confirm' && attrs) {
    return (
      <Screen>
        {title}
        <AppText variant="title">¿Entendimos bien?</AppText>
        <AppText variant="muted">
          {source === 'llm'
            ? 'La IA interpretó tu solicitud. Corrige lo que no esté bien.'
            : source === 'rules'
              ? 'Interpretamos tu solicitud automáticamente. Corrige lo que no esté bien.'
              : 'Ajustaste los datos a mano.'}
        </AppText>

        <Card>
          <AppText variant="label">Tipo de servicio</AppText>
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {CATEGORIES.map((c) => (
              <Chip key={c} label={CATEGORY_LABELS[c]} selected={attrs.category === c} onPress={() => edit('category', c)} />
            ))}
          </View>
        </Card>

        <Card>
          <AppText variant="label">Urgencia</AppText>
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {(['baja', 'media', 'alta'] as Urgency[]).map((u) => (
              <Chip key={u} label={URGENCY_LABEL[u]} selected={attrs.urgency === u} onPress={() => edit('urgency', u)} />
            ))}
          </View>
          <AppText variant="small">
            {attrs.urgency === 'alta'
              ? 'Urgente: te mostramos horarios desde dentro de 30 minutos y pesa más la cercanía.'
              : attrs.urgency === 'media'
                ? 'Normal: horarios desde dentro de 1 hora.'
                : 'Sin afán: horarios desde dentro de 2 horas, para que el prestador se organice.'}
          </AppText>
          <Stepper
            label="Duración estimada"
            value={attrs.estimatedHours}
            display={`${attrs.estimatedHours} h`}
            step={0.5}
            min={0.5}
            max={12}
            onChange={(v) => edit('estimatedHours', v)}
          />
          <TextField
            label="Presupuesto máximo (opcional)"
            help="En pesos. Si lo dejas vacío, el precio no afecta el orden."
            keyboardType="number-pad"
            value={budgetText ? formatCOP(parseInt(budgetText.replace(/\D/g, ''), 10) || 0) : ''}
            onChangeText={(v) => setBudgetText(v.replace(/\D/g, ''))}
          />
        </Card>

        <NextSteps
          steps={[
            {
              text:
                mode === 'direct'
                  ? 'Te mostramos los prestadores compatibles con sus horarios libres: primero los que pueden llegar antes.'
                  : 'Enviamos tu solicitud sin tu nombre a los prestadores compatibles. Cada uno te propone precio y hora según su agenda.',
            },
            { text: 'Tú eliges el prestador y la hora. Nadie queda contratado hasta que confirmes.' },
            { text: 'El prestador confirma y el horario queda reservado. Puedes cancelar antes.' },
          ]}
        />
        {error && <ErrorText>{error}</ErrorText>}
        {original && original.mode === 'quote' && (
          <AppText variant="small">Las cotizaciones que ya recibiste se conservan; los prestadores verán la solicitud actualizada.</AppText>
        )}
        <Button
          label={original ? 'Guardar cambios' : mode === 'direct' ? 'Ver prestadores y horarios' : 'Pedir cotizaciones'}
          icon={original ? 'checkmark' : 'search'}
          onPress={submit}
          loading={busy}
        />
        <Button label="Volver y editar la descripción" variant="ghost" onPress={() => setStep('describe')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {title}
      {original ? (
        <AppText variant="title">Editar solicitud</AppText>
      ) : presetCategory ? (
        <View style={styles.row}>
          <AppText variant="muted">Servicio:</AppText>
          <Chip label={CATEGORY_LABELS[presetCategory]} selected onPress={() => router.back()} />
        </View>
      ) : (
        <AppText variant="title">¿Qué necesitas, {profile.name.split(' ')[0]}?</AppText>
      )}
      <TextField
        label="Describe el problema con tus palabras"
        help="Ej.: «Se me tapó el lavaplatos y el agua no baja, necesito a alguien hoy. Tengo hasta 120 mil»."
        multiline
        value={description}
        onChangeText={setDescription}
        maxLength={600}
        autoFocus={!params.text && !editId}
      />

      <Card>
        <PhotoPicker value={photos} onChange={setPhotos} />
      </Card>

      <Card>
        <AppText variant="label">¿Cuándo?</AppText>
        <View style={styles.chipWrap} accessibilityRole="radiogroup">
          <Chip label="Lo antes posible" selected={whenMode === 'asap'} onPress={() => setWhenMode('asap')} />
          <Chip label="Un día específico" selected={whenMode === 'day'} onPress={() => setWhenMode('day')} />
        </View>
        {whenMode === 'day' && <DayPicker value={dayOffset} onChange={setDayOffset} />}
        <AppText variant="small">
          {whenMode === 'asap'
            ? 'No tienes que adivinar la hora: te mostramos cuándo puede llegar cada prestador, empezando por el más pronto.'
            : 'Te mostramos las horas libres de cada prestador ese día y tú eliges la que te sirva.'}
        </AppText>
      </Card>

      <LocationPicker value={location} onChange={setLocation} />

      {!original && (
        <Card>
          <AppText variant="label">¿Cómo quieres contratar?</AppText>
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            <Chip label="Elegir y contratar" selected={mode === 'direct'} onPress={() => setMode('direct')} />
            <Chip label="Recibir cotizaciones" selected={mode === 'quote'} onPress={() => setMode('quote')} />
          </View>
          <AppText variant="small">
            {mode === 'direct'
              ? 'Ves los perfiles compatibles con su precio estimado y sus horarios libres, y contratas al que prefieras.'
              : 'Los prestadores compatibles ven tu solicitud sin tu nombre y te envían su precio y hora.'}
          </AppText>
        </Card>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Continuar" icon="arrow-forward" onPress={analyze} loading={busy} />
    </Screen>
  );
}
