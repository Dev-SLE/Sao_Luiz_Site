import React, { useState } from 'react';
import { Lock, Save, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { postToSheet } from '../services/api';

const ChangePassword: React.FC = () => {
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
        const result = await postToSheet('changePassword', {
            username: user?.username,
            currentPassword: currentPass,
            newPassword: newPass
        });

        if (result) {
            setSuccess(true);
            setCurrentPass('');
            setNewPass('');
            setConfirmPass('');
        } else {
            setError("Erro ao salvar senha no servidor. Verifique se a senha atual está correta.");
        }
    } catch (err) {
        setError("Erro de conexão. Tente novamente.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold text-primary-900 mb-6 flex items-center gap-2">
        <Lock className="text-primary-600" /> Alterar Senha
      </h1>
      
      {success && (
        <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-lg mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle size={20} />
            Senha alterada com sucesso!
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle size={20} />
            {error}
        </div>
      )}

      <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
                <input 
                    type="password" 
                    required
                    value={currentPass}
                    onChange={e => setCurrentPass(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white text-gray-900"
                    placeholder="Digite sua senha atual"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                <input 
                    type="password" 
                    required
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white text-gray-900"
                    placeholder="Digite a nova senha"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                <input 
                    type="password" 
                    required
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white text-gray-900"
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