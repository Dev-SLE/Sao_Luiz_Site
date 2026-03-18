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
      setError("A nova senha e a confirmação não coincidem.");
      return;
    }

    if (newPass.length < 4) {
      setError("A senha deve ter pelo menos 4 caracteres.");
      return;
    }

    setLoading(true);

    try {
        const resp = await authClient.changePassword({
          username: user?.username || '',
          currentPassword: currentPass,
          newPassword: newPass
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
            setError("Erro ao salvar senha no servidor. Verifique se a senha atual está correta.");
        }
    } catch (err) {
        setError("Erro de conexão. Tente novamente.");
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
    <div className="max-w-md mx-auto mt-10 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Lock className="text-primary-400" /> Alterar Senha
        </h1>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 text-gray-300 hover:bg-white/10"
            title="Fechar"
          >
            <X size={18} />
          </button>
        )}
      </div>
      
      {success && (
        <div className="bg-emerald-900/60 border border-emerald-500/70 text-emerald-100 p-4 rounded-lg mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          Senha alterada com sucesso!
        </div>
      )}

      {error && (
        <div className="bg-red-900/60 border border-red-500/70 text-red-100 p-4 rounded-lg mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      <div className="bg-[#070A20] p-8 rounded-lg shadow-lg border border-[#1E226F]">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Senha Atual</label>
                <input 
                    type="password" 
                    required
                    value={currentPass}
                    onChange={e => setCurrentPass(e.target.value)}
                    className="w-full p-2 border border-[#1A1B62] rounded focus:ring-2 focus:ring-primary-500 outline-none bg-[#080816] text-gray-100 placeholder-gray-500"
                    placeholder="Digite sua senha atual"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Nova Senha</label>
                <input 
                    type="password" 
                    required
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full p-2 border border-[#1A1B62] rounded focus:ring-2 focus:ring-primary-500 outline-none bg-[#080816] text-gray-100 placeholder-gray-500"
                    placeholder="Digite a nova senha"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Confirmar Nova Senha</label>
                <input 
                    type="password" 
                    required
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    className="w-full p-2 border border-[#1A1B62] rounded focus:ring-2 focus:ring-primary-500 outline-none bg-[#080816] text-gray-100 placeholder-gray-500"
                    placeholder="Confirme a nova senha"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary-600 text-white py-2 rounded-lg font-bold hover:bg-primary-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;