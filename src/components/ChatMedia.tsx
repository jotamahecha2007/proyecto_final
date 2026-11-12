import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { fonts, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';
import type { Message } from '@/lib/types';
import { MAX_AUDIO_SECONDS } from '@/services/chat';

function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Transcripción debajo de cada nota de voz o video (ver "Audición" en la propuesta). */
export function Transcript({ message, color }: { message: Message; color: string }) {
  const status = message.transcriptStatus;
  if (!status) return null;
  const text =
    status === 'done' && message.transcript
      ? message.transcript
      : status === 'pending'
        ? 'Transcribiendo…'
        : status === 'error'
          ? 'No se pudo transcribir este mensaje.'
          : 'Transcripción no disponible.';
  return (
    <View style={{ gap: 2 }} accessibilityLabel={`Transcripción: ${text}`} accessible>
      <AppText variant="small" style={{ color, fontFamily: fonts.bold }}>
        Transcripción
      </AppText>
      <AppText variant="small" style={{ color, fontStyle: status === 'done' ? 'normal' : 'italic' }}>
        {status === 'done' ? `«${text}»` : text}
      </AppText>
    </View>
  );
}

/**
 * Descarga la nota de voz al celular antes de reproducirla. Reproducir directo desde
 * la URL falla con el emulador de Storage (y con conexiones lentas), porque los .m4a
 * grabados en Android guardan su índice al final del archivo y el reproductor
 * necesita leerlo antes de empezar.
 */
async function cachedAudioUri(message: Message): Promise<string> {
  if (Platform.OS === 'web' || !message.audioUrl) return message.audioUrl ?? '';
  const file = new File(Paths.cache, `nota_${message.id}.m4a`);
  if (file.exists && (file.size ?? 0) > 0) return file.uri;
  const downloaded = await File.downloadFileAsync(message.audioUrl, file, { idempotent: true });
  return downloaded.uri;
}

/** Alturas de la onda: fijas por mensaje para que cada nota tenga su propia forma. */
function waveHeights(seed: string, count: number): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const base = 0.3 + ((h >>> 16) % 70) / 100; // 0,30 – 0,99
    const envelope = Math.sin((Math.PI * (i + 1)) / (count + 1)); // más alto en el centro
    return Math.max(0.2, base * (0.55 + 0.45 * envelope));
  });
}

const BARS = 28;
const BAR_MAX = 28;

/**
 * Onda de la nota de voz. Mientras suena:
 * - las barras ya escuchadas se pintan del color completo (progreso);
 * - las barras se mueven, para que se vea que el audio sí se está reproduciendo.
 * Si la persona activó "reducir movimiento", solo se muestra el progreso.
 */
function Waveform({ seed, progress, playing, color }: { seed: string; progress: number; playing: boolean; color: string }) {
  const heights = useMemo(() => waveHeights(seed, BARS), [seed]);
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!playing || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [playing, reduceMotion, pulse]);

  const played = Math.round(progress * BARS);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: BAR_MAX, gap: 2 }} importantForAccessibility="no-hide-descendants">
      {heights.map((h, i) => {
        // Cada barra oscila con un desfase distinto: parece una onda que avanza.
        const phase = (i % 7) / 7;
        const scale = pulse.interpolate({
          inputRange: [0, phase, Math.min(1, phase + 0.25), Math.min(1, phase + 0.5), 1],
          outputRange: [1, 1, 1.35, 0.7, 1],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={{
              width: 3,
              height: h * BAR_MAX,
              borderRadius: 2,
              backgroundColor: color,
              opacity: i < played ? 1 : 0.35,
              transform: [{ scaleY: playing && !reduceMotion ? scale : 1 }],
            }}
          />
        );
      })}
    </View>
  );
}

/** Reproductor de nota de voz: botón grande de reproducir/pausar, onda animada y tiempo. */
export function AudioBubble({ message, color }: { message: Message; color: string }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const wantsPlay = useRef(false);
  const duration = status.duration || message.durationSec || 0;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;

  // Al terminar, vuelve al inicio para poder escucharla otra vez.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  // Cuando el archivo termina de cargar, arranca si la persona ya había tocado play.
  useEffect(() => {
    if (status.isLoaded && wantsPlay.current) {
      wantsPlay.current = false;
      player.play();
    }
  }, [status.isLoaded, player]);

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (phase === 'ready' && status.isLoaded) {
      player.play();
      return;
    }
    if (phase === 'downloading') return;
    setPhase('downloading');
    try {
      const uri = await cachedAudioUri(message);
      wantsPlay.current = true;
      player.replace({ uri });
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }

  const label =
    phase === 'error'
      ? 'No se pudo cargar el audio. Toca para reintentar.'
      : phase === 'downloading' || (phase === 'ready' && !status.isLoaded)
        ? 'Cargando…'
        : status.playing
          ? `Reproduciendo ${mmss(status.currentTime)} de ${mmss(duration)}`
          : status.currentTime > 0
            ? `En pausa en ${mmss(status.currentTime)} de ${mmss(duration)}`
            : `Nota de voz de ${mmss(duration)}`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 220 }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? `Pausar. ${label}` : `Reproducir. ${label}`}
        accessibilityState={{ busy: phase === 'downloading' }}
        style={{
          width: MIN_TOUCH,
          height: MIN_TOUCH,
          borderRadius: MIN_TOUCH / 2,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: status.playing ? color + '22' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {phase === 'downloading' || (phase === 'ready' && !status.isLoaded) ? (
          <ActivityIndicator color={color} />
        ) : (
          <Ionicons name={phase === 'error' ? 'refresh' : status.playing ? 'pause' : 'play'} size={22} color={color} />
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Waveform seed={message.id} progress={progress} playing={status.playing} color={color} />
        <AppText variant="small" style={{ color }} accessibilityLiveRegion="polite">
          {phase === 'error'
            ? 'No se pudo cargar. Toca para reintentar.'
            : status.playing || status.currentTime > 0
              ? `${status.playing ? '🔊 ' : ''}${mmss(status.currentTime)} / ${mmss(duration)}`
              : `🎤 ${mmss(duration)}`}
        </AppText>
      </View>
    </View>
  );
}

export function VideoBubble({ message }: { message: Message }) {
  const t = useTheme();
  const player = useVideoPlayer(message.videoUrl ? { uri: message.videoUrl } : null, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      accessibilityLabel={`Video de ${mmss(message.durationSec ?? 0)}. La transcripción está debajo.`}
      style={{ width: 240, height: 180, borderRadius: radius.md, backgroundColor: t.media }}
    />
  );
}

// Mono y 64 kbps: suficiente para voz y liviano para subir con datos móviles.
const VOICE_PRESET: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };

/**
 * Grabador de notas de voz. Se toca una vez para empezar y otra para enviar:
 * no hay que mantener presionado (apto para temblores o switch access).
 */
export function VoiceRecorder({
  onSend,
  onCancel,
}: {
  onSend: (uri: string, durationSec: number) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTheme();
  const recorder = useAudioRecorder(VOICE_PRESET);
  const state = useAudioRecorderState(recorder, 250);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const seconds = state.durationMillis / 1000;

  useEffect(() => {
    (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Necesitamos permiso del micrófono para grabar notas de voz.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    })().catch(() => setError('No se pudo iniciar la grabación.'));
    return () => {
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopAndSend() {
    setSending(true);
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('sin archivo');
      if (seconds < 1) {
        setError('La nota es muy corta.');
        setSending(false);
        return;
      }
      await onSend(recorder.uri, seconds);
    } catch {
      setError('No se pudo enviar la nota de voz.');
      setSending(false);
    }
  }

  async function cancel() {
    if (state.isRecording) await recorder.stop().catch(() => {});
    onCancel();
  }

  // Corta sola al llegar al máximo.
  useEffect(() => {
    if (state.isRecording && seconds >= MAX_AUDIO_SECONDS && !sending) stopAndSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  return (
    <View style={{ gap: spacing.sm, padding: spacing.sm }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name={state.isRecording ? 'radio-button-on' : 'mic-outline'} size={22} color={t.danger} />
        <AppText variant="label" style={{ flex: 1 }}>
          {error ?? (state.isRecording ? `Grabando… ${mmss(seconds)} (máx. ${mmss(MAX_AUDIO_SECONDS)})` : 'Preparando el micrófono…')}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancelar" variant="secondary" icon="trash-outline" onPress={cancel} disabled={sending} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Enviar" icon="send" onPress={stopAndSend} loading={sending} disabled={!state.isRecording || !!error} />
        </View>
      </View>
    </View>
  );
}
