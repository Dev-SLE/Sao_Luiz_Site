import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Truck, Loader2, User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Zap, PackageCheck, Lightbulb, CalendarCheck2 } from 'lucide-react';
import { DEFAULT_CREDS } from '../constants';
import clsx from 'clsx';

const Login: React.FC = () => {
  const { login, authMessage, clearAuthMessage } = useAuth();
  const { users, baseData } = useData();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState<string | null>(null);

  // Efeito para limpar erro ao digitar
  useEffect(() => {
    if (error) setError('');
    if (authMessage) clearAuthMessage();
  }, [username, password]);

  // Lógica para obter a data de atualização
  const latestEmissaoDate = useMemo(() => {
    if (!baseData || baseData.length === 0) return '--/--/----';
    let maxVal = 0;
    let maxStr = '';
    
    const parseDateToComparable = (dateStr: string) => {
        if (!dateStr || typeof dateStr !== 'string') return 0;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return parseInt(parts[2] + parts[1].padStart(2, '0') + parts[0].padStart(2, '0'));
        }
        return 0;
    };

    baseData.forEach(d => {
       const currentVal = parseDateToComparable(d.DATA_EMISSAO);
       if (currentVal > maxVal) {
           maxVal = currentVal;
           maxStr = d.DATA_EMISSAO;
       }
    });
    return maxStr || '--/--/----';
  }, [baseData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (error) {
      console.error('Erro no login:', error);
      setError('Credenciais inválidas. Verifique seu usuário e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050511] font-sans overflow-x-hidden">
      <style>{`
        @keyframes highway-flow {
          0% { transform: translateY(120vh) scaleY(0.5); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-120vh) scaleY(1.5); opacity: 0; }
        }
        .light-stream {
          position: absolute;
          width: 4px;
          height: 300px;
          background: linear-gradient(to top, transparent, #EC1B23, transparent);
          opacity: 0;
          animation: highway-flow 2.5s infinite linear;
          border-radius: 4px;
          filter: blur(2px);
          box-shadow: 0 0 20px rgba(236, 27, 35, 0.4);
        }
        .light-stream.white {
            background: linear-gradient(to top, transparent, rgba(255,255,255,0.8), transparent);
            width: 2px;
            height: 150px;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
            filter: blur(1px);
        }
        .light-stream.thick {
            width: 6px;
            height: 400px;
            background: linear-gradient(to top, transparent, #FF4D4D, transparent);
            filter: blur(4px);
        }
        /* Randomized positions/delays for natural traffic look */
        .light-stream:nth-child(1) { left: 15%; animation-duration: 3s; animation-delay: 0s; }
        .light-stream:nth-child(2) { left: 35%; animation-duration: 4s; animation-delay: 1.2s; }
        .light-stream:nth-child(3) { left: 55%; animation-duration: 2.5s; animation-delay: 0.5s; }
        .light-stream:nth-child(4) { left: 75%; animation-duration: 3.5s; animation-delay: 2s; }
        .light-stream:nth-child(5) { left: 85%; animation-duration: 5s; animation-delay: 1s; }
        .light-stream:nth-child(6) { left: 25%; animation-duration: 2.8s; animation-delay: 1.5s; }
        .light-stream:nth-child(7) { left: 65%; animation-duration: 3.2s; animation-delay: 0.2s; }
      `}</style>

      {/* Main Container - Full Screen Grid */}
      <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-12 relative">
        
        {/* LADO ESQUERDO: FORMULÁRIO (Foco no Usuário/Ação Principal) */}
        <div className="lg:col-span-5 relative flex flex-col justify-center items-center p-6 md:p-12 z-20 bg-[#080816] shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
            
            {/* Efeito de brilho sutil no topo do form */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#EC1B23] to-transparent opacity-50"></div>

            <div className="w-full max-w-sm mx-auto flex flex-col h-full lg:h-auto justify-center">
                
                {/* Mobile Header */}
                <div className="lg:hidden mb-8 flex flex-col items-center text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-[#EC1B23]/10 rounded-xl mb-4 border border-[#EC1B23]/20">
                        <Truck className="text-[#EC1B23]" size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-white">São Luiz Express</h2>
                </div>

                <div className="mb-8 lg:mb-10 text-center lg:text-left">
                    <h2 className="text-3xl lg:text-4xl font-black text-white mb-3 tracking-tight">Bem-vindo</h2>
                    <p className="text-gray-400 text-sm lg:text-base font-medium leading-relaxed">
                        Faça login para acessar o painel de controle e gerenciar suas pendências.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Username Input */}
                    <div className="space-y-2 group">
                        <label className="text-xs font-bold text-[#6E71DA] uppercase tracking-wide ml-1">Usuário</label>
                        <div className={clsx(
                            "relative flex items-center bg-[#0F103A]/50 border-2 rounded-xl transition-all duration-300 overflow-hidden",
                            isFocused === 'user' ? "border-[#EC1B23] shadow-[0_0_15px_rgba(236,27,35,0.15)] bg-[#0F103A]" : "border-[#1A1B62] hover:border-[#4649CF]"
                        )}>
                            <div className="pl-4 text-[#6E71DA] group-focus-within:text-[#EC1B23] transition-colors">
                                <User size={20} />
                            </div>
                            <input 
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onFocus={() => setIsFocused('user')}
                                onBlur={() => setIsFocused(null)}
                                className="w-full py-4 px-3 outline-none text-white font-bold bg-transparent placeholder-gray-600 text-base"
                                placeholder="Digite seu usuário"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2 group">
                        <label className="text-xs font-bold text-[#6E71DA] uppercase tracking-wide ml-1">Senha</label>
                        <div className={clsx(
                            "relative flex items-center bg-[#0F103A]/50 border-2 rounded-xl transition-all duration-300 overflow-hidden",
                            isFocused === 'pass' ? "border-[#EC1B23] shadow-[0_0_15px_rgba(236,27,35,0.15)] bg-[#0F103A]" : "border-[#1A1B62] hover:border-[#4649CF]"
                        )}>
                            <div className="pl-4 text-[#6E71DA] group-focus-within:text-[#EC1B23] transition-colors">
                                <Lock size={20} />
                            </div>
                            <input 
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => setIsFocused('pass')}
                                onBlur={() => setIsFocused(null)}
                                className="w-full py-4 px-3 outline-none text-white font-bold bg-transparent placeholder-gray-600 text-base"
                                placeholder="Digite sua senha"
                                required
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="pr-4 text-gray-500 hover:text-white transition-colors focus:outline-none"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <div className="flex justify-end">
                            <a href="#" className="text-xs font-bold text-gray-500 hover:text-[#EC1B23] transition-colors">Esqueceu a senha?</a>
                        </div>
                    </div>

                    {/* Error Message */}
                    {(error || authMessage) && (
                        <div className="p-4 bg-[#EC1B23]/10 border border-[#EC1B23]/20 rounded-xl text-[#FF4D4D] text-sm font-bold flex items-center gap-3 animate-in slide-in-from-left-2">
                            <div className="p-1 bg-[#EC1B23] rounded-full text-white">
                                <ArrowRight size={10} className="rotate-180" />
                            </div>
                            {error || authMessage}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full group relative bg-[#1A1B62] hover:bg-[#EC1B23] text-white font-bold py-4 rounded-xl shadow-lg transition-all duration-500 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden mt-2"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                        <div className="relative flex items-center justify-center gap-3">
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>Autenticando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Entrar no Sistema</span>
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </div>
                    </button>
                </form>

                <div className="mt-auto lg:mt-12 text-center lg:text-left border-t border-white/5 pt-6">
                    <p className="text-gray-500 text-xs font-medium">
                        © 2026 São Luiz Express. <br className="lg:hidden"/> Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </div>

        {/* LADO DIREITO: VISUAL & MARCA (Informativo e Impactante) */}
        <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-16 overflow-hidden bg-[#050511]">
            
            {/* BACKGROUND ANIMATION (TRAFFIC LIGHTS) */}
            <div className="absolute inset-0 z-0">
                {/* Grid Floor Effect */}
                <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'linear-gradient(#1A1B62 1px, transparent 1px), linear-gradient(90deg, #1A1B62 1px, transparent 1px)', 
                    backgroundSize: '40px 40px',
                    transform: 'perspective(500px) rotateX(60deg) scale(2) translateY(-100px)'
                }}></div>
                
                {/* Moving Lights Container - Angled */}
                <div className="absolute inset-0 transform -skew-x-12 scale-125 origin-bottom-right opacity-80">
                    <div className="light-stream thick"></div>
                    <div className="light-stream white"></div>
                    <div className="light-stream"></div>
                    <div className="light-stream thick" style={{ left: '90%' }}></div>
                    <div className="light-stream white" style={{ left: '40%' }}></div>
                    <div className="light-stream" style={{ left: '10%' }}></div>
                </div>
                
                {/* Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050511] via-transparent to-[#050511]"></div>
                <div className="absolute inset-0 bg-gradient-to-l from-[#050511] via-transparent to-transparent"></div>
            </div>

            {/* CONTENT LAYER */}
            <div className="relative z-10 h-full flex flex-col justify-between">
                
                {/* Top Bar removida (Status do Sistema) */}

                {/* Center: Brand */}
                <div className="pl-8 border-l-4 border-[#EC1B23]">
                    <h1 className="text-7xl xl:text-8xl font-black text-white leading-[0.9] tracking-tighter mb-6">
                        SÃO LUIZ <br/>
                        {/* Fix: Added pr-4 and pb-2 to prevent clipping of the gradient text */}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#EC1B23] to-[#FF4D4D] pr-4 inline-block pb-2">EXPRESS</span>
                    </h1>
                    <p className="text-xl text-gray-300 font-light max-w-xl border-t border-white/10 pt-6 mt-6">
                        Logística conectada e gestão inteligente de pendências para resultados de alta performance.
                    </p>
                </div>

                {/* Bottom: Pillars */}
                <div className="grid grid-cols-4 gap-6">
                    {[
                        { label: 'RAPIDEZ', icon: Zap, desc: 'Entregas ágeis' },
                        { label: 'QUALIDADE', icon: PackageCheck, desc: 'Excelência total' },
                        { label: 'SEGURANÇA', icon: ShieldCheck, desc: 'Rastreio 24h' },
                        { label: 'SOLUÇÃO', icon: Lightbulb, desc: 'Foco no cliente' }
                    ].map((item) => (
                        <div key={item.label} className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/5 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1">
                            <item.icon className="text-[#EC1B23] mb-3 group-hover:scale-110 transition-transform" size={28} />
                            <h3 className="text-sm font-black text-white tracking-wider mb-1">{item.label}</h3>
                            <p className="text-[10px] text-gray-400 font-medium uppercase">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;