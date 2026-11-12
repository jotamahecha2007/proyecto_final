import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, ErrorText, Screen, StatusBadge, TextField, styles } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { businessDaysLeft } from '@/lib/businessDays';
import { CONSENT_VERSION, DATA_CONTROLLER } from '@/lib/legal';
import { formatDateTime, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';
import { DATA_REQUEST_TYPES, type DataRequest, type DataRequestType } from '@/lib/types';
import { createDataRequest, exportMyData, subscribeMyDataRequests, updateMyData, type DataExport } from '@/services/privacy';

const SUMMARY_LABELS: Record<string, string> = {
  solicitudes: 'Solicitudes de servicio',
  contrataciones: 'Contrataciones',
  resenasEscritas: 'Reseñas que escribiste',
  resenasRecibidas: 'Reseñas que recibiste',
  mensajes: 'Mensajes que enviaste',
  notificaciones: 'Notificaciones',
  reportesHechos: 'Reportes que hiciste',
  solicitudesDeDatos: 'Solicitudes de datos',
};

/** Centro de habeas data: ver, corregir y descargar tus datos, y hacer solicitudes con plazos. */
export default function Privacy() {
  const t = useTheme();
  const { profile } = useSession();

  // Actualizar datos
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [savingData, setSavingData] = useState(false);
  const [dataMsg, setDataMsg] = useState<string>();
  const [dataError, setDataError] = useState<string>();

  // Descargar datos
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<DataExport | null>(null);
  const [exportError, setExportError] = useState<string>();

  // Solicitudes
  const [type, setType] = useState<DataRequestType | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [reqError, setReqError] = useState<string>();
  const [requests, setRequests] = useState<DataRequest[]>([]);

  useEffect(() => subscribeMyDataRequests(profile.uid, setRequests), [profile.uid]);

  async function saveData() {
    setDataMsg(undefined);
    setDataError(undefined);
    if (name.trim().length < 3) return setDataError('Escribe tu nombre completo.');
    if (phone && phone.replace(/\D/g, '').length < 7) return setDataError('El teléfono no parece válido.');
    setSavingData(true);
    try {
      await updateMyData(profile, { name, phone });
      setDataMsg('Datos actualizados.');
    } catch {
      setDataError('No se pudieron guardar los cambios.');
    } finally {
      setSavingData(false);
    }
  }

  async function download() {
    setExporting(true);
    setExportError(undefined);
    try {
      const { data } = await exportMyData();
      setExported(data);
    } catch {
      setExportError('No se pudo generar la copia de tus datos. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  }

  async function sendRequest() {
    if (!type) return setReqError('Elige el tipo de solicitud.');
    if (message.trim().length < 10) return setReqError('Cuéntanos qué necesitas (mínimo 10 caracteres).');
    setSending(true);
    setReqError(undefined);
    try {
      await createDataRequest(profile, type, message);
      setType(null);
      setMessage('');
    } catch {
      setReqError('No se pudo enviar la solicitud.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">Mis datos y privacidad</AppText>
      <AppText variant="muted">
        Aquí ejerces tus derechos como titular de datos personales (Ley 1581 de 2012): conocer, actualizar, corregir y suprimir tus datos, y
        revocar tu autorización.
      </AppText>

      <Card>
        <AppText variant="label">Tu autorización</AppText>
        <AppText variant="small">
          Aceptaste la política versión {profile.consentVersion ?? '—'}
          {profile.consentAt ? ` el ${formatDateTime(profile.consentAt)}` : ''}.
          {profile.consentVersion === CONSENT_VERSION ? ' Es la versión vigente.' : ''}
        </AppText>
        <AppText variant="small">
          Responsable: {DATA_CONTROLLER.name}. Contacto: {DATA_CONTROLLER.email} (correo de prueba del proyecto académico).
        </AppText>
        <Button label="Leer la política de datos" variant="ghost" icon="document-text-outline" onPress={() => router.push('/legal')} />
      </Card>

      {/* Conocer */}
      <Card>
        <AppText variant="heading">Descargar mis datos</AppText>
        <AppText variant="muted">Recibe un archivo con todo lo que TeAyudo guarda sobre ti: perfil, servicios, mensajes, reseñas y más.</AppText>
        <Button label="Generar copia de mis datos" icon="download-outline" onPress={download} loading={exporting} />
        {exportError && <ErrorText>{exportError}</ErrorText>}
        {exported && (
          <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
            <StatusBadge label="Copia generada" tone="success" icon="checkmark-circle-outline" />
            {Object.entries(exported.summary).map(([k, v]) => (
              <View key={k} style={[styles.row, { justifyContent: 'space-between' }]}>
                <AppText variant="small" style={{ color: t.text }}>
                  {SUMMARY_LABELS[k] ?? k}
                </AppText>
                <AppText variant="small" style={{ color: t.text }}>
                  {v}
                </AppText>
              </View>
            ))}
            <AppText variant="small">El archivo (formato JSON) se abrió para que lo guardes o lo compartas.</AppText>
          </View>
        )}
      </Card>

      {/* Actualizar */}
      <Card>
        <AppText variant="heading">Actualizar mis datos</AppText>
        <TextField label="Nombre completo" value={name} onChangeText={setName} autoComplete="name" />
        <TextField label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <AppText variant="small">Correo: {profile.email}. Para cambiarlo, haz una solicitud de actualización.</AppText>
        {dataError && <ErrorText>{dataError}</ErrorText>}
        {dataMsg && (
          <AppText variant="small" accessibilityLiveRegion="polite">
            {dataMsg}
          </AppText>
        )}
        <Button label="Guardar cambios" variant="secondary" onPress={saveData} loading={savingData} />
      </Card>

      {/* Solicitudes */}
      <Card>
        <AppText variant="heading">Hacer una solicitud</AppText>
        <AppText variant="muted">Respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.</AppText>
        <View style={{ gap: spacing.xs }} accessibilityRole="radiogroup" accessibilityLabel="Tipo de solicitud">
          {(Object.keys(DATA_REQUEST_TYPES) as DataRequestType[]).map((k) => {
            const selected = type === k;
            const info = DATA_REQUEST_TYPES[k];
            return (
              <Pressable
                key={k}
                onPress={() => setType(k)}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={`${info.label}. ${info.help} Plazo: ${info.days} días hábiles.`}
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                  minHeight: MIN_TOUCH,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selected ? t.primary : t.border,
                  backgroundColor: selected ? t.surfaceAlt : t.surface,
                }}
              >
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? t.primary : t.textMuted} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">
                    {info.label} · {info.days} días hábiles
                  </AppText>
                  <AppText variant="small">{info.help}</AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
        <TextField label="Tu solicitud" multiline value={message} onChangeText={setMessage} maxLength={1000} />
        {reqError && <ErrorText>{reqError}</ErrorText>}
        <Button label="Enviar solicitud" icon="send-outline" onPress={sendRequest} loading={sending} />
      </Card>

      {requests.length > 0 && (
        <>
          <AppText variant="heading">Mis solicitudes</AppText>
          {requests.map((r) => {
            const left = businessDaysLeft(Date.now(), r.dueAt);
            return (
              <Card key={r.id}>
                <View style={styles.chipWrap}>
                  <StatusBadge
                    label={r.status === 'answered' ? 'Respondida' : left < 0 ? 'Plazo vencido' : `En trámite · ${left} días hábiles`}
                    tone={r.status === 'answered' ? 'success' : left < 0 ? 'danger' : 'warning'}
                    icon={r.status === 'answered' ? 'checkmark-done-outline' : 'time-outline'}
                  />
                </View>
                <AppText variant="label">{DATA_REQUEST_TYPES[r.type].label}</AppText>
                <AppText>«{r.message}»</AppText>
                <AppText variant="small">
                  Enviada {formatDateTime(r.createdAt)} · respuesta a más tardar {formatDateTime(r.dueAt)}
                </AppText>
                {r.response && (
                  <View style={{ gap: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: t.surfaceAlt }}>
                    <AppText variant="label">Respuesta de TeAyudo</AppText>
                    <AppText>{r.response.text}</AppText>
                    <AppText variant="small">{formatDateTime(r.response.at)}</AppText>
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}

      {/* Suprimir */}
      {profile.role !== 'admin' && (
        <Card>
          <AppText variant="heading">Eliminar mi cuenta</AppText>
          <AppText variant="muted">Revoca tu autorización y borra tus datos de TeAyudo. No se puede deshacer.</AppText>
          <Button label="Eliminar mi cuenta" variant="danger" icon="trash-outline" onPress={() => router.push('/delete-account')} />
        </Card>
      )}
      <AppText variant="small">
        Si no quedas conforme con la respuesta a un reclamo, puedes acudir a la Superintendencia de Industria y Comercio (SIC).
      </AppText>
    </Screen>
  );
}
