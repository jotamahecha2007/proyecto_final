import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from './firebase';

/**
 * Lee un archivo local como Blob. En React Native, fetch(uri).blob() puede devolver
 * un blob vacío en Android; XMLHttpRequest con responseType "blob" funciona en ambos.
 */
export function readAsBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('No se pudo leer el archivo'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/** Sube un archivo local a Storage y devuelve su URL de descarga. */
export async function uploadFile(localUri: string, path: string, contentType: string): Promise<string> {
  const blob = await readAsBlob(localUri);
  if (!blob.size) throw new Error('El archivo está vacío');
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType });
  (blob as Blob & { close?: () => void }).close?.();
  return getDownloadURL(r);
}
