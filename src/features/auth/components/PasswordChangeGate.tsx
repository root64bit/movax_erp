import React, { useState, type FormEvent } from 'react';
import { AuthService } from '../services/auth.service';

interface PasswordChangeGateProps {
  onComplete: () => Promise<void>;
  onSignOut: () => Promise<unknown>;
}

export const PasswordChangeGate: React.FC<PasswordChangeGateProps> = ({ onComplete, onSignOut }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const strong =
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!strong || password !== confirm) {
      setError('Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo; as palavras-passe devem coincidir.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await AuthService.updatePassword(password);
      setPassword('');
      setConfirm('');
      await onComplete();
    } catch (err: any) {
      setError(err.message || 'Não foi possível alterar a palavra-passe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Definir nova palavra-passe</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">Por segurança, altere a palavra-passe temporária antes de continuar.</p>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Nova palavra-passe
          <input
            autoFocus
            type="password"
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Confirmar palavra-passe
          <input
            type="password"
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <p className="text-[11px] text-slate-500">Mínimo 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-xs font-bold">{error}</p>}
        <button
          disabled={saving || !strong || password !== confirm}
          className="w-full rounded-xl bg-primary hover:bg-primary-container px-4 py-3.5 font-black text-white text-xs sm:text-sm shadow-md transition-all disabled:opacity-50"
        >
          {saving ? 'A guardar…' : 'Guardar e Continuar'}
        </button>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="w-full text-xs font-bold text-slate-500 hover:text-primary underline text-center block pt-2"
        >
          Terminar sessão
        </button>
      </form>
    </main>
  );
};
