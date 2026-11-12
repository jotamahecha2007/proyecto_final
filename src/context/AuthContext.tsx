import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });

/**
 * Errores que significan "esta sesión guardada ya no sirve": la cuenta se borró, se
 * suspendió, o se reiniciaron los emuladores y el token quedó huérfano.
 */
const DEAD_SESSION = ['auth/invalid-refresh-token', 'auth/user-token-expired', 'auth/user-not-found', 'auth/user-disabled', 'auth/invalid-user-token'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile?.();
      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      setState((s) => ({ ...s, user, loading: true }));
      // Antes de usar la sesión guardada en el celular, confirma que siga siendo válida.
      // Si no, se cierra sola y la persona ve la pantalla de inicio de sesión (en vez de
      // quedarse cargando con el error «Could not reach Cloud Firestore backend»).
      user.getIdToken(true).catch((e: { code?: string }) => {
        if (e?.code && DEAD_SESSION.includes(e.code)) {
          unsubProfile?.();
          signOut(auth).catch(() => {});
        }
      });
      // El perfil puede tardar un instante en existir justo después del registro.
      let refreshed = false;
      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        async (snap) => {
          const profile = snap.exists() ? (snap.data() as UserProfile) : null;
          // Si la cuenta acaba de pasar a administrador, renueva el token para que traiga el permiso.
          if (profile?.role === 'admin' && !refreshed) {
            refreshed = true;
            await user.getIdToken(true).catch(() => {});
          }
          setState({ user, profile, loading: !snap.exists() });
        },
        // Sin permiso para leer el propio perfil = sesión inválida: se cierra.
        () => signOut(auth).catch(() => {}),
      );
    });
    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Para pantallas que solo se muestran con sesión iniciada. */
export function useSession() {
  const { user, profile } = useAuth();
  if (!user || !profile) throw new Error('useSession requiere sesión iniciada');
  return { user, profile };
}
