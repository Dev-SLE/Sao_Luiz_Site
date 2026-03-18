import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'sofiaSettings';

interface SofiaSettingsState {
  name: string;
  welcome: string;
  knowledgeBase: string;
  days: Record<string, boolean>;
}

const defaultState: SofiaSettingsState = {
  name: 'Sofia',
  welcome: 'Olá! Sou a Sofia, assistente virtual da São Luiz Express. Como posso te ajudar hoje?',
  knowledgeBase: '',
  days: {
    segunda: true,
    terca: true,
    quarta: true,
    quinta: true,
    sexta: true,
    sabado: false,
    domingo: false,
  },
};

const SofiaSettings: React.FC = () => {
  const [state, setState] = useState<SofiaSettingsState>(defaultState);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ ...defaultState, ...parsed, days: { ...defaultState.days, ...(parsed.days || {}) } });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // ignore
    }
  }, [state]);

  const toggleDay = (day: string) => {
    setState((prev) => ({
      ...prev,
      days: { ...prev.days, [day]: !prev.days[day] },
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-white">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#0F103A] p-2 text-[#EC1B23] border border-[#1A1B62] shadow-[0_0_18px_rgba(236,27,35,0.4)]">
          <span className="text-sm font-black">IA</span>
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black leading-tight">Configurações da Sofia</h1>
          <p className="text-xs text-gray-400">
            Defina identidade, conhecimento e horários em que a IA atende sozinha.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 space-y-3 shadow-[0_0_24px_rgba(0,0,0,0.85)]">
          <h2 className="text-sm font-bold text-white mb-1">Identidade</h2>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Nome da Assistente</label>
              <input
                className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-300 uppercase tracking-wide">Mensagem de Boas-vindas</label>
              <textarea
                className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none min-h-[80px] resize-none focus:ring-1 focus:ring-[#EC1B23]"
                value={state.welcome}
                onChange={(e) => setState((s) => ({ ...s, welcome: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 space-y-3 shadow-[0_0_24px_rgba(0,0,0,0.85)]">
          <h2 className="text-sm font-bold text-white mb-1">Horários de Atendimento</h2>
          <p className="text-[11px] text-gray-400 mb-2">
            Selecione os dias em que a Sofia pode responder sozinha (sem intervenção humana).
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ['segunda', 'Segunda-feira'],
              ['terca', 'Terça-feira'],
              ['quarta', 'Quarta-feira'],
              ['quinta', 'Quinta-feira'],
              ['sexta', 'Sexta-feira'],
              ['sabado', 'Sábado'],
              ['domingo', 'Domingo'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                className={
                  state.days[key]
                    ? 'px-3 py-2 rounded-lg bg-emerald-700 text-white border border-emerald-500 font-semibold'
                    : 'px-3 py-2 rounded-lg bg-[#080816] text-gray-300 border border-[#1A1B62] hover:border-[#6E71DA]'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 space-y-2 shadow-[0_0_24px_rgba(0,0,0,0.85)]">
        <h2 className="text-sm font-bold text-white mb-1">Base de Conhecimento</h2>
        <p className="text-[11px] text-gray-400 mb-2">
          Cole aqui as regras de negócio, políticas de prazo, tipos de carga aceitos, instruções de
          atendimento e qualquer contexto que a Sofia deve seguir.
        </p>
        <textarea
          className="w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none min-h-[180px] resize-y focus:ring-1 focus:ring-[#EC1B23]"
          value={state.knowledgeBase}
          onChange={(e) => setState((s) => ({ ...s, knowledgeBase: e.target.value }))}
          placeholder="Exemplo:&#10;- Prazos de entrega por UF...&#10;- Tipos de carga proibidos...&#10;- Como responder sobre TAD, EM BUSCA, CRÍTICO..."
        />
      </div>

      <p className="text-[11px] text-gray-500">
        As configurações são salvas localmente neste navegador. Em uma próxima etapa podemos persistir
        isso no Neon para uso pela IA de forma centralizada.
      </p>
    </div>
  );
};

export default SofiaSettings;

