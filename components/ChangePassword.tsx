import React, { useState } from 'react';
import { Lock, Save, CheckCircle, Loader2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../lib/auth';

interface Props {
  onClose?: () => void;
}

const ChangePassword: React.FC<Props> = ({ onClose }) => {
  const { user } = useAuth();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPass !== confirmPass) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (newPass.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres.');
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
        setSuccess(true);
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        try {
          await authClient.logEvent({
            event: 'CHANGE_PASSWORD_SUCCESS',
            username: user?.username || '',
          });
        } catch {}
      } else {
        setError('Erro ao salvar senha no servidor. Verifique se a senha atual está correta.');
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            title="Fechar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {success && (
        <div className="mb-6 flex animate-in items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          Senha alterada com sucesso!
        </div>
      )}

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
