import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Lock,
  Sparkles,
  Truck,
  User,
} from 'lucide-react';
import clsx from 'clsx';

function safeInternalPath(from: string | null): string | null {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return null;
  if (from.startsWith('/login')) return null;
  return from;
}

const Login: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      title: 'Dados protegidos',
      text: 'Conexão cifrada e boas práticas de armazenamento para reduzir riscos em comunicados, documentos, RH e demais áreas do portal.',
    },
    PERMISSOES: {
      title: 'Acesso por perfil',
      text: 'Cada colaborador vê apenas o portal, o workspace e as ferramentas (operacional, CRM, Sofia, etc.) autorizados para a sua função.',
    },
    AUDITORIA: {
      title: 'Trilha e governança',
      text: 'Eventos sensíveis podem ser registrados para rastreabilidade, apoio a investigações e alinhamento às políticas internas.',
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
      const { defaultPath, mustChangePassword } = await login(username, password);
      if (mustChangePassword) {
        router.replace('/app/operacional/mudar-senha');
        return;
      }
      const next = safeInternalPath(searchParams.get('from')) || defaultPath;
      router.replace(next);
    } catch (err) {
      console.error('Erro no login:', err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Credenciais inválidas. Verifique seu usuário e senha.',
      );
    } finally {
      setLoading(false);
    }
  };

  const inputWrap = (focused: boolean) =>
    clsx(
      'flex items-center rounded-xl border bg-white transition-all duration-300',
      focused
        ? 'border-sl-navy shadow-[0_0_0_3px_rgba(196,18,48,0.12)] ring-1 ring-sl-red/25'
        : 'border-slate-200 hover:border-slate-300',
    );

  return (
    <div
      data-theme="portal"
      className="font-body relative min-h-dvh w-full overflow-hidden bg-[var(--sl-gray-50,#f5f7fa)] text-slate-800"
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-80 w-80 rounded-full bg-sl-navy/25 blur-3xl fx-orbit" />
      <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-sl-red/18 blur-3xl fx-orbit-rev" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-sl-navy-light/25 blur-3xl fx-drift-slow" />

      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-12">
        {/* Coluna formulário */}
        <div className="relative z-10 flex min-h-[min(100dvh,960px)] flex-col justify-center overflow-x-hidden overflow-y-auto border-b border-slate-200/80 bg-gradient-to-br from-white via-[#f5f7fa] to-slate-100 px-7 py-10 sm:px-10 md:px-12 lg:col-span-4 lg:min-h-dvh lg:border-b-0 lg:pr-8 xl:px-14 xl:pr-16">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[4] w-[min(42%,220px)] bg-[linear-gradient(90deg,transparent_0%,rgba(10,22,40,0.06)_45%,rgba(26,45,80,0.18)_88%,rgba(10,22,40,0.32)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,rgba(196,18,48,0.08),transparent_55%)]"
            aria-hidden
          />

          <div
            className="pointer-events-none absolute left-[4%] top-[14%] z-[2] h-36 w-36 rounded-3xl border border-sl-navy/20 bg-gradient-to-br from-white/50 to-sl-navy/10 shadow-[0_12px_40px_rgba(10,22,40,0.12)] fx-orbit"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-[18%] left-[8%] z-[2] h-28 w-28 rounded-full border border-sl-red/25 bg-sl-red/8 fx-drift"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-8 bottom-[22%] z-[2] h-40 w-40 rounded-2xl border border-sl-navy/15 bg-white/40 shadow-lg fx-float"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute right-[20%] top-[22%] z-[2] h-24 w-24 rounded-full bg-sl-red/10 blur-2xl fx-drift-slow"
            aria-hidden
          />

          <div className="relative z-10 mx-auto w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-[0_24px_50px_rgba(10,22,40,0.12),0_2px_0_rgba(255,255,255,0.85)_inset] backdrop-blur-md interactive-lift md:p-8">
            <div className="mb-8">
              <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.22em] text-sl-navy">
                São Luiz Express
              </p>
              <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-sl-navy md:text-4xl">
                Portal do colaborador
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Um único login para o <span className="font-semibold text-sl-navy">portal</span> (comunicação, RH e
                serviços), a <span className="font-semibold text-sl-navy">área de trabalho</span> operacional e as
                ferramentas do seu perfil — tudo integrado.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Usuário</label>
                <div className={inputWrap(isFocused === 'user')}>
                  <User size={18} className="ml-3 shrink-0 text-sl-navy" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setIsFocused('user')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full border-0 bg-transparent px-3 py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Digite seu usuário"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Senha</label>
                <div className={inputWrap(isFocused === 'pass')}>
                  <Lock size={18} className="ml-3 shrink-0 text-sl-navy" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsFocused('pass')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full border-0 bg-transparent px-3 py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="mr-3 text-slate-400 transition-colors hover:text-sl-navy"
                    aria-label="Alternar visibilidade da senha"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Link
                  href="/recuperar-senha"
                  className="text-[11px] font-semibold text-sl-navy underline-offset-2 hover:text-sl-red hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>

              {(error || authMessage) && (
                <div className="rounded-xl border border-sl-red/30 bg-sl-red/5 px-3 py-2 text-sm text-sl-red">
                  {error || authMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="pressable-3d w-full rounded-xl bg-gradient-to-r from-sl-navy to-sl-navy-light px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,22,40,0.25)] transition hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Entrar no ecossistema
                      <ArrowRight size={16} />
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Ambiente corporativo: sessão protegida, permissões por perfil e uso conforme as políticas da São Luiz
                Express.
              </p>
            </div>
          </div>
        </div>

        {/* Coluna narrativa / 3D */}
        <div className="relative z-10 hidden min-h-dvh overflow-hidden bg-gradient-to-br from-sl-navy via-sl-navy-light to-sl-navy lg:col-span-8 lg:flex lg:flex-col lg:justify-center">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(10,22,40,0.45)_0%,transparent_30%),radial-gradient(circle_at_82%_18%,rgba(196,18,48,0.28),transparent_45%),radial-gradient(circle_at_12%_78%,rgba(255,255,255,0.12),transparent_42%)]"
            aria-hidden
          />

          <div className="relative flex h-full min-h-0 w-full flex-1 flex-col justify-between gap-6 overflow-hidden px-8 py-10 sm:px-10 sm:py-12 xl:mx-auto xl:max-w-4xl xl:gap-8 xl:px-12 xl:py-14">
            <div className="pointer-events-none absolute right-[4%] top-[8%] z-0 h-52 w-52 rounded-full border border-white/15 bg-white/8 backdrop-blur-sm fx-orbit-rev" />
            <div className="pointer-events-none absolute right-[16%] bottom-[14%] z-0 h-36 w-36 rounded-3xl border border-white/18 bg-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.25)] fx-orbit" />
            <div className="pointer-events-none absolute right-[34%] top-[26%] z-0 h-20 w-20 rounded-full bg-sl-red/25 blur-xl fx-drift" />
            <div className="pointer-events-none absolute right-[10%] top-[44%] z-0 h-24 w-24 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm fx-float" />

            {/* Anel 3D decorativo */}
            <div
              className="pointer-events-none absolute left-1/2 top-[42%] z-[1] hidden -translate-x-1/2 xl:block"
              style={{ perspective: '880px' }}
              aria-hidden
            >
              <div
                className="relative h-44 w-44 [transform-style:preserve-3d] fx-orbit"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="absolute inset-0 rounded-[1.35rem] border-2 border-white/25 bg-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.35)]" />
                <div className="absolute inset-3 rounded-2xl border border-sl-red/35 bg-sl-red/10 shadow-inner" />
                <div className="absolute inset-6 rounded-xl border border-white/20 bg-gradient-to-br from-white/15 to-transparent fx-orbit-rev" />
              </div>
            </div>

            <div className="relative z-10 max-w-3xl xl:max-w-none">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/12 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur">
                <Sparkles size={14} className="text-sl-red-light" />
                Ecossistema integrado · Um acesso, várias experiências
              </div>
              <h2 className="font-heading mt-5 text-4xl font-black leading-tight tracking-tight text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:text-5xl xl:text-[3.05rem]">
                São Luiz Express
              </h2>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                Portal · Workspace · Operação e ferramentas
              </p>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/95">
                Comunicados e documentos, jornada em RH, campanhas internas e suporte — lado a lado com a operação
                logística, indicadores e, quando autorizado, CRM e automações com IA. Tudo pensado para o colaborador
                no centro.
              </p>
            </div>

            <div className="relative z-10 max-w-3xl rounded-2xl border border-white/28 bg-white/14 p-6 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">Confiança e controle</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/95">
                O mesmo login abre o que você precisa no dia a dia, respeitando perfis e políticas — do portal institucional
                às telas operacionais e comerciais.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                {(['CRIPTO', 'PERMISSOES', 'AUDITORIA'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSecurityInfoKey(key)}
                    className={clsx(
                      'pressable-3d rounded-lg border px-2 py-1.5 text-center transition-all duration-200',
                      securityInfoKey === key
                        ? 'border-white/50 bg-white font-semibold text-sl-navy shadow-md'
                        : 'border-white/22 bg-white/12 text-white hover:border-white/40 hover:bg-white/18',
                    )}
                  >
                    {securityInfoMap[key].title}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/28 bg-white/16 px-3 py-2.5 transition-colors">
                <p className="text-[11px] font-semibold text-white">{securityInfoMap[securityInfoKey].title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/90">{securityInfoMap[securityInfoKey].text}</p>
              </div>
              <p className="mt-4 text-[11px] text-white/65">
                © {new Date().getFullYear()} São Luiz Express. Uso interno autorizado.
              </p>
            </div>

            <div className="relative z-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="pressable-3d flex gap-3 rounded-xl border border-white/28 bg-white/14 p-3.5 backdrop-blur sm:flex-col sm:gap-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sl-red/25 text-white shadow-inner">
                  <LayoutGrid size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Portal</p>
                  <p className="mt-1 text-lg font-bold leading-tight text-white">Colaborador</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/75">Início, comunicados, RH e mais.</p>
                </div>
              </div>
              <div className="pressable-3d flex gap-3 rounded-xl border border-white/28 bg-white/14 p-3.5 backdrop-blur sm:flex-col sm:gap-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/18 text-white shadow-inner">
                  <Truck size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Workspace</p>
                  <p className="mt-1 text-lg font-bold leading-tight text-white">Operação</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/75">Pendências, rastreio e visão integrada.</p>
                </div>
              </div>
              <div className="pressable-3d flex gap-3 rounded-xl border border-white/28 bg-white/14 p-3.5 backdrop-blur sm:flex-col sm:gap-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sl-red/30 text-white shadow-inner">
                  <Building2 size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Negócio</p>
                  <p className="mt-1 text-lg font-bold leading-tight text-white">CRM e IA</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/75">Quando o seu perfil permitir.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
