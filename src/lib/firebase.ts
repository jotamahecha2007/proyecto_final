import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { connectAuthEmulator, getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-teayudo',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
const EMULATOR_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? 'localhost';
export const FUNCTIONS_REGION = 'us-central1';

const isFirstInit = getApps().length === 0;
const app = isFirstInit
  ? initializeApp(
      !firebaseConfig.apiKey
        ? { ...firebaseConfig, apiKey: 'demo-key', storageBucket: `${firebaseConfig.projectId}.appspot.com` }
        : firebaseConfig,
    )
  : getApp();

function createAuth(): Auth {
  if (Platform.OS === 'web' || !isFirstInit) return getAuth(app);
  // getReactNativePersistence solo existe en el build de React Native de firebase/auth,
  // por eso no aparece en los tipos que lee TypeScript.
  const getReactNativePersistence = (FirebaseAuth as unknown as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
  }).getReactNativePersistence;
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = createAuth();
// ignoreUndefinedProperties: los campos opcionales vacíos no rompen las escrituras.
export const db = isFirstInit ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);

if (USE_EMULATORS && isFirstInit) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8085);
  connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
}
