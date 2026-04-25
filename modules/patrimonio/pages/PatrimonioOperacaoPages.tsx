'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { patrimonioJson } from '@/modules/patrimonio/patrimonioClient';

export function PatrimonioMovimentacoesPage() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ativoId, setAtivoId] = useState('');
  const [tipo, setTipo] = useState('TRANSFERENCIA');
  const [agDest, setAgDest] = useState('');
  const [motivo, setMotivo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const u = ativoId.trim() ? `?ativoId=${encodeURIComponent(ativoId.trim())}&limit=150` : '?limit=150';
      const d = await patrimonioJson<{ rows: unknown[] }>(`/api/patrimonio/movimentacoes${u}`);
      setRows(d.rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [ativoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="surface-card p-4">
        <h2 className="text-base font-black text-slate-900">Registar movimentação</h2>
        <p className="text-xs text-slate-600">Atualiza o cadastro do ativo conforme o tipo (transferência, troca de responsável, etc.).</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="flex flex-col text-sm">
            <span className="text-[10px] font-bold uppercase text-slate-500">ID do ativo (UUID) *</span>
            <input className="rounded-lg border px-2 py-1.5 font-mono text-xs" value={ativoId} onChange={(e) => setAtivoId(e.target.value)} placeholder="Cole o UUID do ativo" />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-[10px] font-bold uppercase text-slate-500">Tipo *</span>
            <select className="rounded-lg border px-2 py-1.5" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {['ENTRADA', 'TRANSFERENCIA', 'TROCA_RESPONSAVEL', 'AJUSTE_CADASTRAL'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-[10px] font-bold uppercase text-slate-500">Agência destino</span>
            <input className="rounded-lg border px-2 py-1.5" value={agDest} onChange={(e) => setAgDest(e.target.value)} />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-[10px] font-bold uppercase text-slate-500">Motivo</span>
            <input className="rounded-lg border px-2 py-1.5" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white"
          onClick={async () => {
            if (!ativoId.trim()) {
              setErr('Informe o ID do ativo.');
              return;
            }
            setErr(null);
            try {
              await patrimonioJson('/api/patrimonio/movimentacoes', {
                method: 'POST',
                body: JSON.stringify({
                  ativo_id: ativoId.trim(),
                  tipo_movimentacao: tipo,
                  agencia_destino: agDest || null,
                  motivo: motivo || null,
                }),
              });
              setMotivo('');
              await load();
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Erro');
            }
          }}
        >
          Registar movimentação
        </button>
      </div>
      <div className="surface-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Últimas movimentações</h3>
          <button type="button" onClick={() => void load()} className="text-xs font-bold text-slate-600">
            <RefreshCw className={loading ? 'inline size-4 animate-spin' : 'inline size-4'} /> Atualizar
          </button>
        </div>
        {err ? <p className="mt-2 text-sm text-red-700">{err}</p> : null}
        {loading ? (
          <Loader2 className="mx-auto mt-6 size-6 animate-spin text-slate-400" />
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {(rows as Record<string, unknown>[]).map((r) => (
              <li key={String(r.id)} className="rounded-lg border border-slate-100 p-2">
                <span className="font-bold">{String(r.tipo_movimentacao)}</span> · {String(r.numero_patrimonio)} — {String(r.created_at || '').slice(0, 19)}
                <p className="text-slate-600">{String(r.motivo || '—')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PatrimonioManutencoesPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await patrimonioJson<{ rows: Record<string, unknown>[] }>('/api/patrimonio/manutencoes?limit=200');
      setRows(d.rows || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="surface-card p-4">
        <h2 className="text-base font-black">Manutenções</h2>
        <p className="text-xs text-slate-600">Concluir manutenção repõe o ativo em ATIVO quando não houver outras abertas.</p>
        {loading ? <Loader2 className="mt-4 size-6 animate-spin" /> : null}
        <ul className="mt-3 space-y-2 text-xs">
          {rows.map((r) => (
            <li key={String(r.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
              <div>
                <span className="font-bold">{String(r.status)}</span> · {String(r.numero_patrimonio)} — {String(r.descricao_problema || '').slice(0, 80)}
              </div>
              {String(r.status) === 'ABERTA' || String(r.status) === 'EM_ANDAMENTO' ? (
                <button
                  type="button"
                  className="rounded-lg bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white"
                  onClick={async () => {
                    await patrimonioJson(`/api/patrimonio/manutencoes/${String(r.id)}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status: 'CONCLUIDA' }),
                    });
                    await load();
                  }}
                >
                  Concluir
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PatrimonioBaixasPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await patrimonioJson<{ rows: Record<string, unknown>[] }>('/api/patrimonio/baixas?limit=200');
      setRows(d.rows || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="surface-card p-4">
        <h2 className="text-base font-black">Baixas</h2>
        <p className="text-xs text-slate-600">Registos definitivos. Use a tela Ativos para nova baixa.</p>
        {loading ? <Loader2 className="mt-4 size-6 animate-spin" /> : null}
        <ul className="mt-3 space-y-2 text-xs">
          {rows.map((r) => (
            <li key={String(r.id)} className="rounded-lg border border-slate-100 p-2">
              <span className="font-mono font-bold">{String(r.numero_patrimonio)}</span> — {String(r.motivo_baixa)} · {String(r.data_baixa || '').slice(0, 10)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PatrimonioConferenciasPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [agencia, setAgencia] = useState('');
  const [resp, setResp] = useState('');
  const [agencias, setAgencias] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [det, setDet] = useState<{ conferencia: Record<string, unknown>; itens: Record<string, unknown>[] } | null>(null);

  const loadList = useCallback(async () => {
    const d = await patrimonioJson<{ rows: Record<string, unknown>[] }>('/api/patrimonio/conferencias?limit=100');
    setRows(d.rows || []);
  }, []);

  const loadAg = useCallback(async () => {
    try {
      const d = await patrimonioJson<{ agencias: string[] }>('/api/patrimonio/lookups?kind=agencias');
      setAgencias(d.agencias || []);
    } catch {
      setAgencias([]);
    }
  }, []);

  useEffect(() => {
    void loadAg();
    void loadList();
  }, [loadAg, loadList]);

  const openDet = async (id: string) => {
    setSel(id);
    const d = await patrimonioJson<{ conferencia: Record<string, unknown>; itens: Record<string, unknown>[] }>(`/api/patrimonio/conferencias/${id}`);
    setDet(d);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="surface-card p-4">
        <h2 className="text-base font-black">Nova conferência</h2>
        <p className="text-xs text-slate-600">Lista ativos da agência (não baixados) e permite marcar itens encontrados.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="rounded-lg border px-2 py-1.5 text-sm" value={agencia} onChange={(e) => setAgencia(e.target.value)}>
            <option value="">Agência *</option>
            {agencias.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="Responsável conferência" value={resp} onChange={(e) => setResp(e.target.value)} />
          <button
            type="button"
            className="rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white"
            onClick={async () => {
              if (!agencia) return;
              await patrimonioJson('/api/patrimonio/conferencias', {
                method: 'POST',
                body: JSON.stringify({ agencia, responsavel_conferencia: resp || null }),
              });
              setResp('');
              await loadList();
            }}
          >
            Iniciar
          </button>
        </div>
      </div>
      <div className="surface-card p-4">
        <h3 className="text-sm font-bold">Conferências</h3>
        <ul className="mt-2 space-y-1 text-xs">
          {rows.map((r) => (
            <li key={String(r.id)}>
              <button type="button" className="text-left font-bold text-sky-800 underline" onClick={() => void openDet(String(r.id))}>
                {String(r.agencia)} · {String(r.status)} · {String(r.data_inicio || '').slice(0, 10)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {det ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex justify-between">
              <h3 className="font-bold">Conferência {String(det.conferencia.agencia)}</h3>
              <button type="button" className="text-xs font-bold" onClick={() => { setDet(null); setSel(null); }}>
                Fechar
              </button>
            </div>
            <button
              type="button"
              className="mt-2 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white"
              onClick={async () => {
                await patrimonioJson(`/api/patrimonio/conferencias/${sel}`, { method: 'PATCH', body: JSON.stringify({ action: 'finalizar' }) });
                setDet(null);
                await loadList();
              }}
            >
              Finalizar conferência
            </button>
            <table className="mt-3 w-full text-left text-[11px]">
              <thead>
                <tr className="border-b">
                  <th className="py-1">Placa</th>
                  <th className="py-1">Encontrado</th>
                  <th className="py-1">Ação</th>
                </tr>
              </thead>
              <tbody>
                {det.itens.map((it) => (
                  <tr key={String(it.id)} className="border-b border-slate-50">
                    <td className="py-1 font-mono">{String(it.numero_patrimonio)}</td>
                    <td className="py-1">{it.encontrado ? 'Sim' : 'Não'}</td>
                    <td className="py-1">
                      {!it.encontrado ? (
                        <button
                          type="button"
                          className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white"
                          onClick={async () => {
                            await patrimonioJson(`/api/patrimonio/conferencias/itens/${String(it.id)}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ encontrado: true }),
                            });
                            if (sel) await openDet(sel);
                          }}
                        >
                          Marcar encontrado
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PatrimonioConfigPage() {
  const [centros, setCentros] = useState<Record<string, unknown>[]>([]);
  const [resps, setResps] = useState<Record<string, unknown>[]>([]);
  const [nomeC, setNomeC] = useState('');
  const [agC, setAgC] = useState('');
  const [nomeR, setNomeR] = useState('');
  const [emailR, setEmailR] = useState('');

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([
      patrimonioJson<{ rows: Record<string, unknown>[] }>('/api/patrimonio/config/centros'),
      patrimonioJson<{ rows: Record<string, unknown>[] }>('/api/patrimonio/config/responsaveis'),
    ]);
    setCentros(c.rows || []);
    setResps(r.rows || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4 md:grid-cols-2">
      <div className="surface-card p-4">
        <h3 className="text-sm font-black">Centros de custo</h3>
        <div className="mt-2 flex gap-2">
          <input className="flex-1 rounded border px-2 py-1 text-sm" placeholder="Nome" value={nomeC} onChange={(e) => setNomeC(e.target.value)} />
          <input className="w-28 rounded border px-2 py-1 text-sm" placeholder="Agência" value={agC} onChange={(e) => setAgC(e.target.value)} />
          <button
            type="button"
            className="rounded-lg bg-sl-navy px-3 py-1 text-xs font-bold text-white"
            onClick={async () => {
              await patrimonioJson('/api/patrimonio/config/centros', { method: 'POST', body: JSON.stringify({ nome: nomeC, agencia: agC || null }) });
              setNomeC('');
              setAgC('');
              await load();
            }}
          >
            Adicionar
          </button>
        </div>
        <ul className="mt-3 text-xs">
          {centros.map((x) => (
            <li key={String(x.id)} className="border-b border-slate-50 py-1">
              {String(x.nome)} {x.agencia ? `· ${String(x.agencia)}` : ''}
            </li>
          ))}
        </ul>
      </div>
      <div className="surface-card p-4">
        <h3 className="text-sm font-black">Responsáveis</h3>
        <div className="mt-2 flex flex-col gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Nome" value={nomeR} onChange={(e) => setNomeR(e.target.value)} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Email" value={emailR} onChange={(e) => setEmailR(e.target.value)} />
          <button
            type="button"
            className="rounded-lg bg-sl-navy px-3 py-1 text-xs font-bold text-white"
            onClick={async () => {
              await patrimonioJson('/api/patrimonio/config/responsaveis', { method: 'POST', body: JSON.stringify({ nome: nomeR, email: emailR || null }) });
              setNomeR('');
              setEmailR('');
              await load();
            }}
          >
            Adicionar
          </button>
        </div>
        <ul className="mt-3 text-xs">
          {resps.map((x) => (
            <li key={String(x.id)} className="border-b border-slate-50 py-1">
              {String(x.nome)} {x.email ? `· ${String(x.email)}` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
