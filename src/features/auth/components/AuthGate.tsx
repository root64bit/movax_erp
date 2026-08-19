import React, { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthService } from '../services/auth.service';
import { PasswordChangeGate } from './PasswordChangeGate';
import type { UserContext } from '@/shared/types/domain.types';
import { PLATFORM_PRODUCT_NAME, PLATFORM_TAGLINE } from '@/shared/lib/branding';

interface AuthGateProps {
  session: Session | null;
  checking: boolean;
  userContext: UserContext | null;
  loadError: string;
  onRetry: () => Promise<void>;
  onPasswordChanged: () => Promise<void>;
  children: ReactNode;
}

const friendlyAuthError = (message: string) => {
  const value = message.toLowerCase();
  if (value.includes('invalid login') || value.includes('invalid credentials')) return 'Email ou palavra-passe incorretos.';
  if (value.includes('email not confirmed')) return 'Confirme o email antes de entrar.';
  if (value.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (value.includes('user_inactive')) return 'Esta conta está desativada. Contacte o administrador.';
  return 'Não foi possível iniciar sessão. Tente novamente.';
};

export function AuthGate({
  session,
  checking,
  userContext,
  loadError,
  onRetry,
  onPasswordChanged,
  children,
}: AuthGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checking) return;
    if (!session) {
      if (window.location.pathname === '/login') {
        window.setTimeout(() => emailRef.current?.focus(), 0);
      }
    }
  }, [checking, session]);

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
        <p aria-live="polite" className="font-bold text-xs text-slate-700 dark:text-slate-300">
          A verificar sessão…
        </p>
      </main>
    );
  }

  if (session && !userContext && loadError) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
        <section role="alert" className="w-full max-w-lg rounded-3xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 p-6 shadow-xl sm:p-8 space-y-4">
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Não foi possível carregar a sessão</h1>
          <p className="text-xs text-red-700 dark:text-red-400">{loadError}</p>
          <div className="pt-2 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="flex-1 rounded-xl bg-primary hover:bg-primary-container px-4 py-3 font-black text-white text-xs shadow-sm transition-all"
              onClick={() => void onRetry()}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50 transition-all"
              onClick={() => void AuthService.signOut()}
            >
              Terminar sessão
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (session && !userContext) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
        <p aria-live="polite" className="font-bold text-xs text-slate-700 dark:text-slate-300">
          A carregar perfil e permissões…
        </p>
      </main>
    );
  }

  if (session && userContext?.forcePasswordChange) {
    return (
      <PasswordChangeGate
        onComplete={onPasswordChanged}
        onSignOut={() => AuthService.signOut()}
      />
    );
  }

  if (session) return <>{children}</>;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await AuthService.signIn(email, password);
      window.history.replaceState({}, '', '/');
    } catch (cause) {
      setError(friendlyAuthError(cause instanceof Error ? cause.message : ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Introduza primeiro o seu email.');
      emailRef.current?.focus();
      return;
    }
    setResetting(true);
    setError('');
    try {
      await AuthService.resetPassword(email.trim());
      setNotice('Se a conta existir, receberá instruções de recuperação por email.');
    } catch {
      setNotice('Solicitação enviada. O Administrador pode redefinir a sua palavra-passe na aba Administração do sistema.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{PLATFORM_PRODUCT_NAME}</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">Iniciar Sessão</h1>
        <p className="mt-1 text-xs text-slate-500">{PLATFORM_TAGLINE}</p>

        {!AuthService.isConfigured() ? (
          <div role="alert" className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900">
            A autenticação não está configurada neste ambiente.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                ref={emailRef}
                autoFocus
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Palavra-passe
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 pr-16 text-xs sm:text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-controls="login-password"
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary hover:underline cursor-pointer"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-xs font-bold">{error}</p>}
            {notice && <p role="status" className="rounded-xl bg-green-50 text-green-800 p-3 text-xs font-bold">{notice}</p>}

            <button
              className="w-full rounded-xl bg-primary hover:bg-primary-container px-4 py-3 font-black text-white text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'A entrar…' : 'Entrar no ERP'}
            </button>

            <button
              type="button"
              disabled={resetting}
              onClick={handleReset}
              className="w-full text-xs font-bold text-slate-500 hover:text-primary text-center block pt-1"
            >
              {resetting ? 'A enviar instruções…' : 'Esqueci-me da palavra-passe'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
