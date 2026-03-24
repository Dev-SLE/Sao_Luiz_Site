import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Sparkles, User } from 'lucide-react';
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

  const inputWrap = (focused: boolean) =>
    clsx(
      'flex items-center rounded-xl border bg-white transition-all',
      focused ? 'border-[#2c348c] shadow-[0_0_0_3px_rgba(44,52,140,0.12)]' : 'border-slate-200',
    );

  return (
    <div className="app-typography relative min-h-screen w-full overflow-hidden bg-[#cfd9e8] text-slate-800">
      <div className="pointer-events-none absolute -left-24 -top-20 h-80 w-80 rounded-full bg-[#2c348c]/30 blur-3xl fx-orbit" />
      <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[#e42424]/20 blur-3xl fx-orbit-rev" />
      <div className="pointer-events-none absolute left-1/3 bottom-[-120px] h-72 w-72 rounded-full bg-[#06183e]/20 blur-3xl fx-drift-slow" />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12">
        <div className="relative z-10 flex min-h-[min(100dvh,960px)] flex-col justify-center overflow-x-hidden overflow-y-auto border-b border-slate-300/40 bg-gradient-to-br from-white via-[#f8faff] to-[#edf2f9] px-7 py-10 sm:px-10 md:px-12 lg:col-span-4 lg:min-h-screen lg:border-b-0 lg:pr-8 xl:px-14 xl:pr-16">
          {/* Ponte suave → painel azul (sem corte seco) */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[4] w-[min(42%,220px)] bg-[linear-gradient(90deg,transparent_0%,rgba(11,30,72,0.07)_45%,rgba(24,47,107,0.22)_88%,rgba(11,30,72,0.38)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,rgba(44,52,140,0.14),transparent_52%)]"
            aria-hidden
          />
          {/* Camadas 3D / movimento (mais visíveis no login) */}
          <div
            className="pointer-events-none absolute left-[4%] top-[14%] z-[2] h-36 w-36 rounded-3xl border border-[#2c348c]/25 bg-gradient-to-br from-white/40 to-[#2c348c]/10 shadow-[0_12px_40px_rgba(44,52,140,0.15)] fx-orbit"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-[18%] left-[8%] z-[2] h-28 w-28 rounded-full border border-[#e42424]/20 bg-[#e42424]/5 blur-[1px] fx-drift"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-8 bottom-[22%] z-[2] h-40 w-40 rounded-2xl border border-[#2c348c]/18 bg-white/30 shadow-lg fx-float"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute right-[20%] top-[22%] z-[2] h-24 w-24 rounded-full bg-[#2c348c]/15 blur-2xl fx-drift-slow"
            aria-hidden
          />
          {/* Fundo limpo no painel de login para evitar recorte visível da Sofia */}
          <div className="relative z-10 mx-auto w-full max-w-lg rounded-3xl border border-slate-300/70 bg-white/96 p-6 shadow-[0_24px_50px_rgba(15,23,42,0.14),0_2px_0_rgba(255,255,255,0.9)_inset] backdrop-blur-md interactive-lift md:p-8">
            <div className="mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2c348c]">São Luiz Express</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Acessar plataforma</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Login unificado para CRM, atendimento com IA Sofia e operação logística.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Usuário</label>
                <div className={inputWrap(isFocused === 'user')}>
                  <User size={18} className="ml-3 text-[#2c348c]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setIsFocused('user')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full border-0 bg-transparent px-3 py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Digite seu usuário"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Senha</label>
                <div className={inputWrap(isFocused === 'pass')}>
                  <Lock size={18} className="ml-3 text-[#2c348c]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsFocused('pass')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full border-0 bg-transparent px-3 py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Digite sua senha"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="mr-3 text-slate-400 hover:text-[#2c348c]"
                    aria-label="Alternar visibilidade da senha"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {(error || authMessage) && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error || authMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="pressable-3d w-full rounded-xl bg-gradient-to-r from-[#2c348c] to-[#06183e] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
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
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Ao continuar, você acessa um ambiente corporativo protegido por políticas de segurança, controle de
                permissões e trilha de auditoria operacional.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#0b1e48] via-[#182f6b] to-[#101f47] lg:col-span-8 lg:flex lg:flex-col lg:justify-center">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,30,72,0.35)_0%,transparent_28%),radial-gradient(circle_at_82%_18%,rgba(228,36,36,0.22),transparent_42%),radial-gradient(circle_at_18%_80%,rgba(121,141,255,0.18),transparent_48%)]"
            aria-hidden
          />

          <div className="relative flex h-full min-h-0 w-full flex-1 flex-col justify-between gap-5 overflow-hidden px-8 py-10 sm:px-10 sm:py-12 xl:mx-auto xl:max-w-4xl xl:gap-6 xl:px-12 xl:py-14">
            <div className="pointer-events-none absolute right-[4%] top-[8%] z-0 h-52 w-52 rounded-full border border-white/15 bg-white/8 backdrop-blur-sm fx-orbit-rev" />
            <div className="pointer-events-none absolute right-[16%] bottom-[14%] z-0 h-36 w-36 rounded-3xl border border-white/20 bg-white/10 shadow-[0_16px_36px_rgba(15,23,42,0.35)] fx-orbit" />
            <div className="pointer-events-none absolute right-[34%] top-[26%] z-0 h-20 w-20 rounded-full bg-[#e42424]/18 blur-xl fx-drift" />
            <div className="pointer-events-none absolute right-[10%] top-[44%] z-0 h-24 w-24 rounded-full border border-[#9fb4ff]/35 bg-[#9fb4ff]/10 backdrop-blur-sm fx-float" />
            <div className="relative z-10 max-w-3xl xl:max-w-none">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/12 px-3 py-1.5 text-xs text-white shadow-sm backdrop-blur">
                <Sparkles size={14} className="text-[#ff9ea1]" />
                Plataforma inteligente e segura
              </div>
              <h2 className="mt-5 text-4xl font-black leading-tight tracking-tight text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)] sm:text-5xl xl:text-[3.1rem]">
                São Luiz Express
              </h2>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#dbe7ff]">
                CRM · IA SOFIA · OPERAÇÃO INTEGRADA
              </p>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-100/95">
                Plataforma para atendimento logístico: automações com IA, controle de SLA e rastreio operacional com
                governança.
              </p>
            </div>

            <div className="relative z-10 max-w-3xl rounded-2xl border border-white/30 bg-white/16 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/85">Conexão protegida</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/95">
                Controle de permissão por perfil, trilha de auditoria para ações críticas e proteção de sessão para
                integridade no CRM e no atendimento com IA.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                {(['CRIPTO', 'PERMISSOES', 'AUDITORIA'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSecurityInfoKey(key)}
                    className={clsx(
                      'pressable-3d rounded-lg border px-2 py-1.5 text-center transition-all',
                      securityInfoKey === key
                        ? 'border-white/45 bg-white font-semibold text-[#06183e]'
                        : 'border-white/20 bg-white/14 text-white hover:border-white/40',
                    )}
                  >
                    {securityInfoMap[key].title}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/30 bg-white/18 px-3 py-2">
                <p className="text-[11px] font-semibold text-white">{securityInfoMap[securityInfoKey].title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/90">{securityInfoMap[securityInfoKey].text}</p>
              </div>
              <p className="mt-4 text-[11px] text-white/65">
                © {new Date().getFullYear()} São Luiz Express. Ambiente corporativo interno.
              </p>
            </div>

            <div className="relative z-10 grid max-w-3xl grid-cols-3 gap-3">
              <div className="pressable-3d rounded-xl border border-white/30 bg-white/14 p-3 backdrop-blur sm:p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">SLA</p>
                <p className="mt-1 text-lg font-bold text-white">Tempo real</p>
              </div>
              <div className="pressable-3d rounded-xl border border-white/30 bg-white/14 p-3 backdrop-blur sm:p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">CRM</p>
                <p className="mt-1 text-lg font-bold text-white">Funil ativo</p>
              </div>
              <div className="pressable-3d rounded-xl border border-white/30 bg-white/14 p-3 backdrop-blur sm:p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">IA Sofia</p>
                <p className="mt-1 text-lg font-bold text-[#ffd0d2]">Assistindo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
