import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Save, Loader2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../lib/auth';
import { getDefaultPostLoginPath } from '@/lib/post-login-path';
import { validateStrongPassword } from '@/lib/server/passwordPolicy';

const ChangePassword: React.FC = () => {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  const navigateToDefaultPortal = async () => {
    await refreshSession();
    const s = await authClient.getSession();
    const next = getDefaultPostLoginPath(s?.permissions ?? [], s?.user?.role ?? '', s?.user?.username ?? '');
    router.replace(next || '/inicio');
  };

  const handleClose = async () => {
    if (user?.mustChangePassword) return;
    setError('');
    setClosing(true);
    try {
      await navigateToDefaultPortal();
    } catch {
      setError('Não foi possível atualizar a sessão. Tente novamente.');
    } finally {
      setClosing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPass !== confirmPass) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    const policy = validateStrongPassword(newPass, user?.username || '');
    if (!policy.ok) {
      setError(policy.errors.join(' '));
      return;
    }

    setLoading(true);

    try {
      const resp = await authClient.changePassword({
        username: user?.username || '',
        currentPassword: currentPass,
        newPassword: newPass,
      });

      if (resp?.success) {
        await refreshSession();
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        try {
          await authClient.logEvent({
            event: 'CHANGE_PASSWORD_SUCCESS',
            username: user?.username || '',
          });
        } catch {}
        await navigateToDefaultPortal();
        return;
      } else {
        const msg =
          typeof (resp as any)?.error === 'string'
            ? String((resp as any).error)
            : 'Erro ao salvar senha no servidor. Verifique se a senha atual está correta.';
        setError(msg);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const cleaned = raw.replace(/^Erro na API: \d+ - /i, '').replace(/^Erro na API: /i, '');
      setError(cleaned || 'Erro de conexão. Tente novamente.');
      try {
        await authClient.logEvent({
          level: 'ERROR',
          event: 'CHANGE_PASSWORD_ERROR',
          username: user?.username || '',
          payload: { message: (err as any)?.message || String(err) },
        });
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Lock className="text-sl-navy" size={28} strokeWidth={2} /> Alterar senha
        </h1>
        {!user?.mustChangePassword && (
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={loading || closing}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
            title="Fechar e voltar ao portal"
          >
            {closing ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 flex animate-in items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 fade-in slide-in-from-top-2">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Senha atual</label>
            <input
              type="password"
              required
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
              placeholder="Digite sua senha atual"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nova senha</label>
            <input
              type="password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
              placeholder="Digite a nova senha"
            />
            <p className="mt-1 text-xs text-slate-500">
              Mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirmar nova senha</label>
            <input
              type="password"
              required
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
              placeholder="Confirme a nova senha"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sl-navy to-sl-navy-light py-2.5 font-bold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
