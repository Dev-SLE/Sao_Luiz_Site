import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';
import clsx from 'clsx';

const Login: React.FC = () => {
  const { login, authMessage, clearAuthMessage } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [securityInfoKey, setSecurityInfoKey] = useState<'CRIPTO' | 'PERMISSOES' | 'AUDITORIA'>('CRIPTO');

  const securityInfoMap: Record<'CRIPTO' | 'PERMISSOES' | 'AUDITORIA', { title: string; text: string }> = {
    CRIPTO: {
      title: 'Criptografia',
      text: 'Os dados sensíveis trafegam por conexão segura e são protegidos com padrões atuais de criptografia para reduzir riscos de interceptação.',
    },
    PERMISSOES: {
      title: 'Permissões',
      text: 'Cada usuário acessa apenas o que o seu perfil permite, com controle de escopo por função, equipe e nível operacional.',
    },
    AUDITORIA: {
      title: 'Auditoria',
      text: 'Ações críticas ficam registradas para rastreabilidade, investigação de incidentes e governança contínua da operação.',
    },
  };

  useEffect(() => {
    if (error) setError('');
    if (authMessage) clearAuthMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      console.error('Erro no login:', err);
      setError('Credenciais inválidas. Verifique seu usuário e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050511] text-white">
      <style>{`
        @keyframes drift {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50% { transform: translate3d(0, -18px, 0) rotate(180deg); }
          100% { transform: translate3d(0, 0, 0) rotate(360deg); }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { opacity: 0.25; }
          50% { opacity: 0.75; }
          100% { opacity: 0.25; }
        }
        @keyframes sofia-float {
          0% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-8px, -10px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        @keyframes sofia-presence {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -8px, 0) scale(1.015); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
      `}</style>
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 border-r border-[#1A1B62] bg-[#080816] px-6 py-8 md:px-12 flex items-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute right-[-6%] bottom-[-1%] w-[82%] h-[108%] opacity-[0.24]"
              style={{ animation: 'sofia-presence 11s ease-in-out infinite' }}
            >
              <img
                src="/api/assets/sofia-mascot"
                alt="Sofia mascote"
                className="w-full h-full object-contain select-none"
                draggable={false}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#080816] via-[#080816]/90 to-[#080816]/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080816]/72 via-transparent to-[#080816]/45" />
          </div>
          <div className="w-full max-w-md mx-auto relative z-10">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
                Acessar Plataforma
              </h1>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                Login unificado para CRM, atendimento com IA Sofia e operação logística.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wide text-gray-300 font-semibold">Usuário</label>
                <div
                  className={clsx(
                    'flex items-center rounded-xl border bg-[#0F103A] transition-all',
                    isFocused === 'user' ? 'border-[#EC1B23] shadow-[0_0_18px_rgba(236,27,35,0.2)]' : 'border-[#1A1B62]'
                  )}
                >
                  <User size={18} className="ml-3 text-[#6E71DA]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setIsFocused('user')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-gray-500 font-medium"
                    placeholder="Digite seu usuário"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wide text-gray-300 font-semibold">Senha</label>
                <div
                  className={clsx(
                    'flex items-center rounded-xl border bg-[#0F103A] transition-all',
                    isFocused === 'pass' ? 'border-[#EC1B23] shadow-[0_0_18px_rgba(236,27,35,0.2)]' : 'border-[#1A1B62]'
                  )}
                >
                  <Lock size={18} className="ml-3 text-[#6E71DA]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsFocused('pass')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-gray-500 font-medium"
                    placeholder="Digite sua senha"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="mr-3 text-gray-400 hover:text-white"
                    aria-label="Alternar visibilidade da senha"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {(error || authMessage) && (
                <div className="rounded-xl border border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  {error || authMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-[#1A1B62] to-[#2A2EA2] px-4 py-3 text-sm font-semibold transition hover:from-[#EC1B23] hover:to-[#C5161D] disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(46,58,180,0.35)]"
              >
                <span className="inline-flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight size={16} />
                    </>
                  )}
                </span>
              </button>
            </form>
            <div className="mt-6 pt-4 border-t border-[#15194D]">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Ao continuar, você acessa um ambiente corporativo protegido por políticas de segurança,
                controle de permissões e trilha de auditoria operacional.
              </p>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex lg:col-span-7 p-10 xl:p-14 bg-[#050511] relative overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-30 bg-[radial-gradient(circle_at_top_right,#EC1B23_0%,transparent_42%),radial-gradient(circle_at_bottom_left,#4649CF_0%,transparent_48%)]" />
          <div className="absolute inset-0 z-0 [perspective:1200px] pointer-events-none">
            <div
              className="absolute -top-10 right-20 w-[340px] h-[340px] rounded-[36%] border border-[#6E71DA]/40 bg-gradient-to-br from-[#6E71DA]/15 via-transparent to-[#0EA5E9]/20 blur-[1px]"
              style={{ transform: 'rotateX(62deg) rotateZ(28deg)', animation: 'drift 12s ease-in-out infinite' }}
            />
            <div
              className="absolute top-28 right-36 w-[240px] h-[240px] rounded-[28%] border border-[#EC1B23]/35 bg-gradient-to-br from-[#EC1B23]/20 via-transparent to-[#FF7A7A]/10"
              style={{ transform: 'rotateX(68deg) rotateZ(-22deg)', animation: 'spin-slow 24s linear infinite' }}
            />
            <div
              className="absolute bottom-6 left-20 w-[400px] h-[180px] rounded-[40px] border border-[#2B2F8F]/40 bg-[#0B0E2B]/35 backdrop-blur-[2px]"
              style={{ transform: 'rotateX(72deg) rotateZ(8deg)', animation: 'shimmer 6s ease-in-out infinite' }}
            />
          </div>
          <div className="relative z-10 w-full flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2B2F8F] bg-[#0F103A]/70 px-3 py-1 text-xs text-gray-200">
                <ShieldCheck size={14} className="text-emerald-300" />
                Acesso seguro e governança ativa
              </div>
              <h2 className="mt-6 text-5xl font-black leading-tight tracking-tight">
                SAO LUIZ EXPRESS
              </h2>
              <p className="text-sm text-[#9AA0FF] font-semibold tracking-[0.18em] uppercase mt-2">
                CRM • IA Sofia • Integração Omnichannel
              </p>
              <p className="mt-4 max-w-2xl text-gray-300">
                Plataforma de nova geração para atendimento logístico: automações com IA, controle de SLA em tempo real e rastreio operacional com governança.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-[#1A1B62] bg-[#070A20]/78 p-5 max-w-3xl backdrop-blur-sm">
              <p className="text-xs font-semibold text-gray-200 uppercase tracking-[0.16em]">
                Conexão protegida e confiável
              </p>
              <p className="text-sm text-gray-300 mt-3 leading-relaxed">
                A plataforma aplica controle de permissão por perfil, trilha de auditoria para ações críticas
                e proteção de sessão para garantir integridade operacional no CRM e no atendimento com IA.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-gray-300">
                <button
                  type="button"
                  onClick={() => setSecurityInfoKey('CRIPTO')}
                  className={clsx(
                    'rounded-lg border px-2 py-1.5 text-center transition-all',
                    securityInfoKey === 'CRIPTO'
                      ? 'border-[#4E63FF] bg-[#15206A]/85 text-white shadow-[0_0_16px_rgba(78,99,255,0.35)]'
                      : 'border-[#24308D] bg-[#0D1236]/70 hover:border-[#4E63FF]'
                  )}
                >
                  Criptografia
                </button>
                <button
                  type="button"
                  onClick={() => setSecurityInfoKey('PERMISSOES')}
                  className={clsx(
                    'rounded-lg border px-2 py-1.5 text-center transition-all',
                    securityInfoKey === 'PERMISSOES'
                      ? 'border-[#4E63FF] bg-[#15206A]/85 text-white shadow-[0_0_16px_rgba(78,99,255,0.35)]'
                      : 'border-[#24308D] bg-[#0D1236]/70 hover:border-[#4E63FF]'
                  )}
                >
                  Permissões
                </button>
                <button
                  type="button"
                  onClick={() => setSecurityInfoKey('AUDITORIA')}
                  className={clsx(
                    'rounded-lg border px-2 py-1.5 text-center transition-all',
                    securityInfoKey === 'AUDITORIA'
                      ? 'border-[#4E63FF] bg-[#15206A]/85 text-white shadow-[0_0_16px_rgba(78,99,255,0.35)]'
                      : 'border-[#24308D] bg-[#0D1236]/70 hover:border-[#4E63FF]'
                  )}
                >
                  Auditoria
                </button>
              </div>
              <div className="mt-3 rounded-xl border border-[#2B2F8F] bg-[#0E143F]/85 px-3 py-2 animate-in fade-in duration-300">
                <p className="text-[11px] font-semibold text-[#A9B2FF]">
                  {securityInfoMap[securityInfoKey].title}
                </p>
                <p className="text-xs text-gray-200 mt-1 leading-relaxed">
                  {securityInfoMap[securityInfoKey].text}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-4">
                © 2026 São Luiz Express. Todos os direitos reservados. Ambiente protegido para uso corporativo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;