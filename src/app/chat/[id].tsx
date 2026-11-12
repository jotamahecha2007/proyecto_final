import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AudioBubble, Transcript, VideoBubble, VoiceRecorder } from '@/components/ChatMedia';
import { AppText, ErrorText, useHeaderOffset } from '@/components/ui';
import { useSession } from '@/context/AuthContext';
import { fonts, MIN_TOUCH, radius, spacing, useTheme } from '@/lib/theme';
import type { Chat, Message } from '@/lib/types';
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  sendImage,
  sendMedia,
  sendText,
  subscribeChat,
  subscribeMessages,
} from '@/services/chat';

function describeMessage(m: Message): string {
  if (m.text) return m.text;
  if (m.imageUrl) return 'foto';
  const kind = m.audioUrl ? 'nota de voz' : 'video';
  return m.transcript ? `${kind}. Transcripción: ${m.transcript}` : kind;
}

/** Foto del chat con mensaje visible si no carga (en vez de un cuadro vacío). */
function ChatImage({ uri, color }: { uri: string; color: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <AppText variant="small" style={{ color, fontStyle: 'italic' }}>
        No se pudo cargar la foto.
      </AppText>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width: 220, height: 220, borderRadius: radius.md }}
      accessibilityLabel="Foto enviada en el chat"
    />
  );
}

function timeLabel(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const t = useTheme();
  const headerHeight = useHeaderOffset();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [recording, setRecording] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  useEffect(() => subscribeChat(id, setChat), [id]);
  // Reproducir por el altavoz y aunque el iPhone esté en modo silencio.
  useEffect(() => {
    if (Platform.OS !== 'web') setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  }, []);
  useEffect(() => subscribeMessages(id, setMessages), [id]);

  const otherId = chat?.participants.find((p) => p !== user.uid);
  const otherName = (otherId && chat?.names[otherId]) || 'Chat';

  async function onSend() {
    if (!text.trim()) return;
    setSending(true);
    setError(undefined);
    try {
      await sendText(id, user.uid, text);
      setText('');
    } catch {
      setError('No se envió el mensaje. Revisa tu conexión.');
    } finally {
      setSending(false);
    }
  }

  async function onPickMedia() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.6,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    setError(undefined);
    const isVideo = asset.type === 'video';
    const seconds = (asset.duration ?? 0) / 1000;
    if (isVideo && seconds > MAX_VIDEO_SECONDS) return setError(`El video puede durar máximo ${MAX_VIDEO_SECONDS} segundos.`);
    if (isVideo && asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) return setError('El video pesa más de 25 MB. Graba uno más corto.');
    setSending(true);
    try {
      if (isVideo) await sendMedia(id, user.uid, 'video', asset.uri, seconds);
      else await sendImage(id, user.uid, asset.uri);
    } catch {
      setError(isVideo ? 'No se pudo enviar el video.' : 'No se pudo enviar la foto.');
    } finally {
      setSending(false);
    }
  }

  async function onSendVoice(uri: string, seconds: number) {
    await sendMedia(id, user.uid, 'audio', uri, seconds);
    setRecording(false);
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: otherName,
          headerRight: () =>
            otherId ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/report',
                    params: { targetId: otherId, targetName: otherName, targetRole: otherId === chat?.participants[1] ? 'provider' : 'client' },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Reportar a ${otherName}`}
                style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="flag-outline" size={22} color={t.text} />
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <AppText variant="muted" style={{ textAlign: 'center', marginTop: spacing.xxl }}>
              Escribe para resolver dudas o acordar el precio. También puedes enviar fotos, videos o notas de voz (se transcriben).
            </AppText>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === user.uid;
            const fg = mine ? t.primaryText : t.text;
            // Los mensajes con reproductor no se agrupan, para que el botón de play sea alcanzable.
            const hasControls = !!(item.audioUrl || item.videoUrl);
            return (
              <View
                accessible={!hasControls}
                accessibilityLabel={hasControls ? undefined : `${mine ? 'Tú' : otherName}, ${timeLabel(item.createdAt)}: ${describeMessage(item)}`}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  backgroundColor: mine ? t.primary : t.surface,
                  borderColor: t.border,
                  borderWidth: mine ? 0 : 1,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  gap: 4,
                }}
              >
                {item.imageUrl && <ChatImage uri={item.imageUrl} color={fg} />}
                {item.audioUrl && <AudioBubble message={item} color={fg} />}
                {item.videoUrl && <VideoBubble message={item} />}
                {hasControls && <Transcript message={item} color={fg} />}
                {item.text && <AppText style={{ color: fg }}>{item.text}</AppText>}
                <AppText variant="small" style={{ color: mine ? t.primaryText : t.textMuted, alignSelf: 'flex-end' }}>
                  {timeLabel(item.createdAt)}
                </AppText>
              </View>
            );
          }}
        />
        {error && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ErrorText>{error}</ErrorText>
          </View>
        )}
        {recording ? (
          <View style={{ borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.surface }}>
            <VoiceRecorder onSend={onSendVoice} onCancel={() => setRecording(false)} />
          </View>
        ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: spacing.sm,
            padding: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: t.border,
            backgroundColor: t.surface,
          }}
        >
          <Pressable
            onPress={onPickMedia}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Enviar una foto o un video"
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="images-outline" size={26} color={t.text} />
          </Pressable>
          {Platform.OS !== 'web' && (
            <Pressable
              onPress={() => setRecording(true)}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Grabar una nota de voz"
              accessibilityHint="Toca una vez para empezar. Luego toca Enviar o Cancelar."
              style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="mic-outline" size={26} color={t.text} />
            </Pressable>
          )}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Mensaje"
            multiline
            style={{
              flex: 1,
              minHeight: MIN_TOUCH,
              maxHeight: 120,
              color: t.text,
              backgroundColor: t.bg,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: 16,
              fontFamily: fonts.regular,
            }}
          />
          <Pressable
            onPress={onSend}
            disabled={sending || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: sending || !text.trim(), busy: sending }}
            style={{
              width: MIN_TOUCH,
              height: MIN_TOUCH,
              borderRadius: MIN_TOUCH / 2,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sending || !text.trim() ? 0.5 : 1,
            }}
          >
            <Ionicons name="send" size={20} color={t.primaryText} />
          </Pressable>
        </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
