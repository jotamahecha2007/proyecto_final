import { addDoc, collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/upload';
import type { Chat, Message } from '@/lib/types';

/** Un chat por pareja cliente–prestador, para poder volver a contratar a la misma persona. */
export function chatIdFor(clientId: string, providerId: string) {
  return `${clientId}_${providerId}`;
}

export async function ensureChat(clientId: string, clientName: string, providerId: string, providerName: string) {
  const id = chatIdFor(clientId, providerId);
  await setDoc(
    doc(db, 'chats', id),
    { participants: [clientId, providerId], names: { [clientId]: clientName, [providerId]: providerName } },
    { merge: true },
  );
  return id;
}

export function subscribeChats(uid: string, cb: (c: Chat[]) => void) {
  return onSnapshot(query(collection(db, 'chats'), where('participants', 'array-contains', uid)), (s) =>
    cb(
      s.docs
        .map((d) => ({ id: d.id, lastMessage: '', updatedAt: 0, ...d.data() }) as Chat)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    ),
  );
}

export function subscribeChat(id: string, cb: (c: Chat | null) => void) {
  return onSnapshot(doc(db, 'chats', id), (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Chat) : null));
}

export function subscribeMessages(chatId: string, cb: (m: Message[]) => void) {
  return onSnapshot(collection(db, 'chats', chatId, 'messages'), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Message).sort((a, b) => a.createdAt - b.createdAt)),
  );
}

export async function sendText(chatId: string, senderId: string, text: string) {
  const clean = text.trim();
  if (!clean) return;
  const createdAt = Date.now();
  await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId, text: clean, createdAt });
  await updateDoc(doc(db, 'chats', chatId), { lastMessage: clean.slice(0, 80), updatedAt: createdAt });
}

const upload = uploadFile;

export async function sendImage(chatId: string, senderId: string, localUri: string) {
  const createdAt = Date.now();
  const imageUrl = await upload(localUri, `chats/${chatId}/${senderId}_${createdAt}.jpg`, 'image/jpeg');
  await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId, imageUrl, createdAt });
  await updateDoc(doc(db, 'chats', chatId), { lastMessage: '📷 Foto', updatedAt: createdAt });
}

/** Límites para no llenar el Storage del piloto. */
export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 120;

/**
 * Nota de voz o video. Se guarda con transcriptStatus "pending" y la Cloud Function
 * onMessageCreated la transcribe (accesibilidad: personas sordas o con hipoacusia).
 */
export async function sendMedia(
  chatId: string,
  senderId: string,
  kind: 'audio' | 'video',
  localUri: string,
  durationSec: number,
) {
  const createdAt = Date.now();
  const ext = kind === 'audio' ? 'm4a' : 'mp4';
  const path = `chats/${chatId}/${senderId}_${createdAt}.${ext}`;
  const url = await upload(localUri, path, kind === 'audio' ? 'audio/mp4' : 'video/mp4');
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId,
    [kind === 'audio' ? 'audioUrl' : 'videoUrl']: url,
    mediaPath: path,
    durationSec: Math.round(durationSec),
    transcriptStatus: 'pending',
    createdAt,
  });
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: kind === 'audio' ? '🎤 Nota de voz' : '🎬 Video',
    updatedAt: createdAt,
  });
}
