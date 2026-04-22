'use client';

import React, { useState } from 'react';
import { KeyRound, Loader2, Lock, X } from 'lucide-react';
import { authClient } from '@/lib/auth';
import { validateStrongPassword } from '@/lib/server/passwordPolicy';

type Props = {
  username: string;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
};

/**
 * Troca de senha obrigatória no próprio login (modal), sem redirecionar para o operacional.
 */
export function LoginPasswordGateModal({ username, onCancel, onSuccess }: Props) {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPass !== confirmPass) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }
    const policy = validateStrongPassword(newPass, username);
    if (!policy.ok) {
      setError(policy.errors.join(' '));
      return;
    }
    setLoading(true);
    try {
      await authClient.changePassword({
        username,
        currentPassword: currentPass,
        newPassword: newPass,
      });
      try {
        await authClient.logEvent({
          event: 'CHANGE_PASSWORD_SUCCESS',
          username,
        });
      } catch {
        /* opcional */
      }
      await onSuccess();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(raw.replace(/^Erro na API: \d+ - /i, '').replace(/^Erro na API: /i, '') || 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="login-pwd-gate-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Sair e voltar ao login"
        >
          <X className="size-5" />
        </button>
        <div className="mb-5 flex items-center gap-2 text-sl-navy">
          <KeyRound className="size-7 shrink-0" />
          <div>
            <h2 id="login-pwd-gate-title" className="font-heading text-lg font-bold tracking-tight">
              Definir nova senha
            </h2>
            <p className="text-xs text-slate-600">
              Conta <span className="font-semibold">{username}</span> — política de segurança exige uma senha forte antes de continuar.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Senha atual</label>
            <input
              type="password"
              required
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Nova senha</label>
            <input
              type="password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Mínimo 12 caracteres, maiúscula, minúscula, número e símbolo.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Confirmar nova senha</label>
            <input
              type="password"
              required
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sl-navy to-sl-navy-light py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {loading ? 'A guardar…' : 'Confirmar e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
