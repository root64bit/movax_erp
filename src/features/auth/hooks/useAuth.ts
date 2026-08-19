import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthService } from '../services/auth.service';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    void AuthService.getSession().then((initialSession) => {
      if (isMounted) {
        setSession(initialSession);
        setChecking(false);
      }
    });

    const { unsubscribe } = AuthService.onAuthStateChange((newSession) => {
      if (isMounted) {
        setSession(newSession);
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, pass: string) => {
    const newSession = await AuthService.signIn(email, pass);
    setSession(newSession);
    return newSession;
  }, []);

  const signOut = useCallback(async () => {
    await AuthService.signOut();
    setSession(null);
  }, []);

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    checking,
    signIn,
    signOut,
  };
}
