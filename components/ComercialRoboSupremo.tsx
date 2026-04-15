import React, { useEffect, useState } from 'react';
import { authClient } from '../lib/auth';
import { Play, RefreshCw, Bot, AlertCircle, CheckCircle2 } from 'lucide-react';

const ComercialRoboSupremo: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [pythonBin, setPythonBin] = useState('');
  const [scriptPath, setScriptPath] = useState('');
  const [runs, setRuns] = useState<any[]>([]);
  const [mode, setMode] = useState('AUTO');
  const [feedback, setFeedback] = useState<string>('');
  const [isError, setIsError] = useState(false);

  const load = async () => {
    setLoading(true);
    setFeedback('');
    try {
      const resp = await authClient.getRoboSupremoStatus();
      setRunning(!!resp?.running);
      setRuntimeReady(!!resp?.runtime?.ready);
      setPythonBin(String(resp?.runtime?.pythonBin || 'python'));
      setScriptPath(String(resp?.runtime?.scriptPath || ''));
      setRuns(Array.isArray(resp?.runs) ? resp.runs : []);
    } catch (e) {
      setIsError(true);
      setFeedback(e instanceof Error ? e.message : 'Erro ao carregar status do robô.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runNow = async () => {
    setFeedback('');
    setIsError(false);
    try {
      const resp = await authClient.runRoboSupremo({ mode, createdBy: 'UI' });
      setFeedback(`Execução iniciada. Run #${resp?.runId || '-'}`);
      await load();
    } catch (e) {
      setIsError(true);
      setFeedback(e instanceof Error ? e.message : 'Erro ao iniciar execução');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-slate-900">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black">Comercial - Robô Supremo</h1>
          <p className="text-xs text-slate-500">Controle de execução e monitoramento do robô pelo site.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white hover:bg-sl-red transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar status
        </button>
      </div>

      {feedback && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Status atual</p>
          <p className="text-lg font-black">{running ? 'Executando' : 'Parado'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Runtime</p>
          <p className="break-all text-xs text-slate-700">{pythonBin}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Script</p>
          <p className="break-all text-xs text-slate-700">{scriptPath || 'Não configurado'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900">Executar agora</p>
            <p className="text-xs text-slate-500">A execução inicia em background e fica registrada no histórico.</p>
          </div>
          {!runtimeReady ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900">
              <AlertCircle size={12} />
              Configure `ROBO_SUPREMO_PATH`
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-900">
              <CheckCircle2 size={12} />
              Pronto
            </span>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none"
          >
            <option value="AUTO">AUTO</option>
            <option value="ACOMPANHAMENTO">ACOMPANHAMENTO</option>
            <option value="AUDITORIA">AUDITORIA</option>
          </select>
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={!runtimeReady || running}
            className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white hover:bg-sl-red transition-colors disabled:opacity-60"
          >
            <Play size={14} />
            {running ? 'Robô em execução' : 'Iniciar Robô'}
          </button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
          <p className="mb-1 inline-flex items-center gap-1 font-bold text-slate-800">
            <Bot size={12} />
            Observação importante
          </p>
          <p>Para produção na Vercel, o ideal é executar o robô em worker externo. Este painel já funciona para disparo/monitoramento em ambiente local ou servidor dedicado.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-black text-slate-900">Histórico de execuções</h2>
        <div className="max-h-[420px] overflow-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Run</th>
                <th className="px-3 py-2 text-left">Modo</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Início</th>
                <th className="px-3 py-2 text-left">Fim</th>
                <th className="px-3 py-2 text-left">PID</th>
                <th className="px-3 py-2 text-left">Exit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">#{r.id}</td>
                  <td className="px-3 py-2">{r.mode || '-'}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.startedAt ? new Date(r.startedAt).toLocaleString('pt-BR') : '-'}</td>
                  <td className="px-3 py-2">{r.finishedAt ? new Date(r.finishedAt).toLocaleString('pt-BR') : '-'}</td>
                  <td className="px-3 py-2">{r.pid ?? '-'}</td>
                  <td className="px-3 py-2">{r.exitCode ?? '-'}</td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">Sem execuções registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComercialRoboSupremo;

