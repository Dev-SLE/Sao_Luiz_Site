'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, RefreshCw, Truck, Wrench, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { patrimonioJson } from '@/modules/patrimonio/patrimonioClient';

type Ativo = Record<string, unknown>;

const STATUS_CLASS: Record<string, string> = {
  ATIVO: 'bg-emerald-100 text-emerald-900',
  EM_MANUTENCAO: 'bg-amber-100 text-amber-900',
  TRANSFERIDO: 'bg-sky-100 text-sky-900',
  BAIXADO: 'bg-slate-200 text-slate-700',
  EXTRAVIADO: 'bg-red-100 text-red-900',
  INATIVO: 'bg-slate-100 text-slate-600',
};

function Badge({ status }: { status: string }) {
  const c = STATUS_CLASS[status] || 'bg-slate-100 text-slate-700';
  return <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', c)}>{status}</span>;
}

export function PatrimonioAtivosPage() {
  const [rows, setRows] = useState<Ativo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [agencia, setAgencia] = useState('');
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [lookups, setLookups] = useState<{
    agencias: string[];
    categorias: { nome: string }[];
  }>({ agencias: [], categorias: [] });

  const [modal, setModal] = useState<'novo' | 'editar' | 'mov' | 'manut' | 'baixa' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Ativo | null>(null);
  const [tabDet, setTabDet] = useState<'geral' | 'mov' | 'manut' | 'baixas'>('geral');
  const [detMov, setDetMov] = useState<unknown[]>([]);
  const [detMan, setDetMan] = useState<unknown[]>([]);
  const [detBaixas, setDetBaixas] = useState<unknown[]>([]);

  const [form, setForm] = useState<Record<string, string>>({});

  const loadLookups = useCallback(async () => {
    try {
      const d = await patrimonioJson<{
        agencias: string[];
        categorias: { nome: string; id?: string }[];
      }>('/api/patrimonio/lookups?kind=all');
      setLookups({
        agencias: d.agencias || [],
        categorias: (d.categorias || []).map((c) => ({ nome: String(c.nome || '') })),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const u = new URLSearchParams();
      if (q.trim()) u.set('q', q.trim());
      if (agencia.trim()) u.set('agencia', agencia.trim());
      if (categoria.trim()) u.set('categoria', categoria.trim());
      if (status.trim()) u.set('status', status.trim());
      if (responsavel.trim()) u.set('responsavel', responsavel.trim());
      const d = await patrimonioJson<{ rows: Ativo[]; total: number }>(`/api/patrimonio/ativos?${u.toString()}`);
      setRows(d.rows || []);
      setTotal(d.total ?? 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao listar');
    } finally {
      setLoading(false);
    }
  }, [agencia, categoria, q, responsavel, status]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNovo = () => {
    setForm({ status: 'ATIVO' });
    setEditId(null);
    setModal('novo');
  };

  const openEditar = (a: Ativo) => {
    setEditId(String(a.id));
    setForm({
      numero_patrimonio: String(a.numero_patrimonio ?? ''),
      descricao: String(a.descricao ?? ''),
      categoria: String(a.categoria ?? ''),
      subcategoria: String(a.subcategoria ?? ''),
      marca: String(a.marca ?? ''),
      modelo: String(a.modelo ?? ''),
      numero_serie: String(a.numero_serie ?? ''),
      estado_conservacao: String(a.estado_conservacao ?? ''),
      status: String(a.status ?? 'ATIVO'),
      agencia_atual: String(a.agencia_atual ?? ''),
      centro_custo: String(a.centro_custo ?? ''),
      responsavel_atual: String(a.responsavel_atual ?? ''),
      data_aquisicao: a.data_aquisicao ? String(a.data_aquisicao).slice(0, 10) : '',
      valor_aquisicao: a.valor_aquisicao != null ? String(a.valor_aquisicao) : '',
      fornecedor: String(a.fornecedor ?? ''),
      numero_nf: String(a.numero_nf ?? ''),
      observacoes: String(a.observacoes ?? ''),
    });
    setModal('editar');
  };

  const salvarAtivo = async () => {
    const body = { ...form, valor_aquisicao: form.valor_aquisicao || null };
    if (modal === 'novo') {
      await patrimonioJson('/api/patrimonio/ativos', { method: 'POST', body: JSON.stringify(body) });
    } else if (editId) {
      await patrimonioJson(`/api/patrimonio/ativos/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
    }
    setModal(null);
    await load();
  };

  const abrirDetalhe = async (a: Ativo) => {
    setDetail(a);
    setTabDet('geral');
    const id = String(a.id);
    try {
      const [m, man, b] = await Promise.all([
        patrimonioJson<{ rows: unknown[] }>(`/api/patrimonio/movimentacoes?ativoId=${encodeURIComponent(id)}&limit=80`),
        patrimonioJson<{ rows: unknown[] }>(`/api/patrimonio/manutencoes?ativoId=${encodeURIComponent(id)}&limit=80`),
        patrimonioJson<{ rows: unknown[] }>(`/api/patrimonio/baixas?limit=200`),
      ]);
      setDetMov(m.rows || []);
      setDetMan(man.rows || []);
      setDetBaixas(
        (b.rows || []).filter((x) => String((x as Record<string, unknown>).ativo_id ?? '') === id),
      );
    } catch {
      setDetMov([]);
      setDetMan([]);
      setDetBaixas([]);
    }
  };

  const categoriasOpts = useMemo(() => {
    const fromDb = lookups.categorias.map((c) => c.nome).filter(Boolean);
    const preset = ['TI', 'MÓVEIS', 'EQUIPAMENTOS', 'VEÍCULOS', 'OPERACIONAL', 'FERRAMENTAS', 'OUTROS'];
    return [...new Set([...preset, ...fromDb])];
  }, [lookups.categorias]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Ativos</h2>
            <p className="text-xs text-slate-600">Cadastro, filtros e ações rápidas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
            >
              <RefreshCw className={clsx('size-4', loading && 'animate-spin')} /> Atualizar
            </button>
            <button
              type="button"
              onClick={openNovo}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sl-navy to-sl-navy-light px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="size-4" /> Novo ativo
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            placeholder="Busca (placa, descrição, série)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <select value={agencia} onChange={(e) => setAgencia(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="">Agência (todas)</option>
            {lookups.agencias.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="">Categoria</option>
            {categoriasOpts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="">Status</option>
            {['ATIVO', 'EM_MANUTENCAO', 'TRANSFERIDO', 'BAIXADO', 'EXTRAVIADO', 'INATIVO'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            placeholder="Responsável"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="min-w-[140px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button type="button" onClick={() => void load()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
            Aplicar
          </button>
        </div>
      </div>

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div> : null}

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Placa</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Agência</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto size-6 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    Nenhum ativo encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={String(a.id)} className="odd:bg-white even:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{String(a.numero_patrimonio)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-800">{String(a.descricao)}</td>
                    <td className="px-3 py-2">{String(a.categoria)}</td>
                    <td className="px-3 py-2">
                      <Badge status={String(a.status)} />
                    </td>
                    <td className="px-3 py-2">{String(a.agencia_atual || '—')}</td>
                    <td className="max-w-[140px] truncate px-3 py-2">{String(a.responsavel_atual || '—')}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold" onClick={() => void abrirDetalhe(a)}>
                          Ver
                        </button>
                        <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold" onClick={() => openEditar(a)}>
                          <Pencil className="inline size-3" /> Editar
                        </button>
                        {String(a.status) !== 'BAIXADO' ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-900"
                              onClick={() => {
                                setEditId(String(a.id));
                                setForm({
                                  tipo_movimentacao: 'TRANSFERENCIA',
                                  agencia_destino: '',
                                  centro_custo_destino: '',
                                  responsavel_destino: '',
                                  motivo: '',
                                });
                                setModal('mov');
                              }}
                            >
                              <Truck className="inline size-3" /> Mover
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900"
                              onClick={() => {
                                setEditId(String(a.id));
                                setForm({ descricao_problema: '', tipo_manutencao: '' });
                                setModal('manut');
                              }}
                            >
                              <Wrench className="inline size-3" /> Manut.
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-900"
                              onClick={() => {
                                setEditId(String(a.id));
                                setForm({ motivo_baixa: 'OBSOLETO', observacoes: '' });
                                setModal('baixa');
                              }}
                            >
                              <XCircle className="inline size-3" /> Baixa
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Total: {total}</div>
      </div>

      {modal && ['novo', 'editar'].includes(modal) ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-black text-slate-900">{modal === 'novo' ? 'Novo ativo' : 'Editar ativo'}</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {(
                [
                  ['numero_patrimonio', 'Nº patrimonial', true],
                  ['descricao', 'Descrição', true],
                  ['categoria', 'Categoria', true],
                  ['subcategoria', 'Subcategoria', false],
                  ['marca', 'Marca', false],
                  ['modelo', 'Modelo', false],
                  ['numero_serie', 'Nº série', false],
                  ['estado_conservacao', 'Estado conservação', false],
                  ['agencia_atual', 'Agência', false],
                  ['centro_custo', 'Centro de custo', false],
                  ['responsavel_atual', 'Responsável', false],
                  ['data_aquisicao', 'Data aquisição', false],
                  ['valor_aquisicao', 'Valor aquisição', false],
                  ['fornecedor', 'Fornecedor', false],
                  ['numero_nf', 'NF', false],
                  ['observacoes', 'Observações', false],
                ] as const
              ).map(([key, lab, req]) => (
                <label key={key} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {lab}
                    {req ? ' *' : ''}
                  </span>
                  {key === 'categoria' ? (
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1.5"
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    >
                      <option value="">Selecione</option>
                      {categoriasOpts.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="rounded-lg border border-slate-200 px-2 py-1.5"
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Status</span>
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1.5"
                  value={form.status || 'ATIVO'}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {['ATIVO', 'EM_MANUTENCAO', 'TRANSFERIDO', 'BAIXADO', 'EXTRAVIADO', 'INATIVO'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button type="button" className="rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white" onClick={() => void salvarAtivo()}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'mov' && editId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-black">Movimentação</h3>
            <div className="mt-3 grid gap-2 text-sm">
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Tipo *</span>
                <select
                  className="rounded-lg border px-2 py-1.5"
                  value={form.tipo_movimentacao || 'TRANSFERENCIA'}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_movimentacao: e.target.value }))}
                >
                  {['ENTRADA', 'TRANSFERENCIA', 'TROCA_RESPONSAVEL', 'AJUSTE_CADASTRAL'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Agência destino</span>
                <select
                  className="rounded-lg border px-2 py-1.5"
                  value={form.agencia_destino || ''}
                  onChange={(e) => setForm((f) => ({ ...f, agencia_destino: e.target.value }))}
                >
                  <option value="">(manter)</option>
                  {lookups.agencias.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Centro custo destino</span>
                <input className="rounded-lg border px-2 py-1.5" value={form.centro_custo_destino || ''} onChange={(e) => setForm((f) => ({ ...f, centro_custo_destino: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Responsável destino</span>
                <input className="rounded-lg border px-2 py-1.5" value={form.responsavel_destino || ''} onChange={(e) => setForm((f) => ({ ...f, responsavel_destino: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Motivo</span>
                <input className="rounded-lg border px-2 py-1.5" value={form.motivo || ''} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-xs font-bold" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-sl-navy px-4 py-2 text-xs font-bold text-white"
                onClick={async () => {
                  await patrimonioJson('/api/patrimonio/movimentacoes', {
                    method: 'POST',
                    body: JSON.stringify({
                      ativo_id: editId,
                      tipo_movimentacao: form.tipo_movimentacao,
                      agencia_destino: form.agencia_destino || null,
                      centro_custo_destino: form.centro_custo_destino || null,
                      responsavel_destino: form.responsavel_destino || null,
                      motivo: form.motivo || null,
                    }),
                  });
                  setModal(null);
                  await load();
                }}
              >
                Registar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'manut' && editId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-black">Abrir manutenção</h3>
            <label className="mt-3 flex flex-col text-sm">
              <span className="text-[10px] font-bold uppercase text-slate-500">Problema *</span>
              <textarea
                className="mt-1 rounded-lg border px-2 py-1.5"
                rows={3}
                value={form.descricao_problema || ''}
                onChange={(e) => setForm((f) => ({ ...f, descricao_problema: e.target.value }))}
              />
            </label>
            <label className="mt-2 flex flex-col text-sm">
              <span className="text-[10px] font-bold uppercase text-slate-500">Tipo manutenção</span>
              <input className="rounded-lg border px-2 py-1.5" value={form.tipo_manutencao || ''} onChange={(e) => setForm((f) => ({ ...f, tipo_manutencao: e.target.value }))} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-xs font-bold" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white"
                onClick={async () => {
                  await patrimonioJson('/api/patrimonio/manutencoes', {
                    method: 'POST',
                    body: JSON.stringify({ ativo_id: editId, descricao_problema: form.descricao_problema, tipo_manutencao: form.tipo_manutencao || null }),
                  });
                  setModal(null);
                  await load();
                }}
              >
                Abrir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'baixa' && editId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-black text-red-800">Baixa de ativo</h3>
            <p className="mt-1 text-xs text-slate-600">Esta ação define o ativo como BAIXADO e não poderá ser movimentado.</p>
            <label className="mt-3 flex flex-col text-sm">
              <span className="text-[10px] font-bold uppercase text-slate-500">Motivo *</span>
              <select
                className="mt-1 rounded-lg border px-2 py-1.5"
                value={form.motivo_baixa || 'OBSOLETO'}
                onChange={(e) => setForm((f) => ({ ...f, motivo_baixa: e.target.value }))}
              >
                {['VENDA', 'SUCATA', 'PERDA', 'ROUBO', 'OBSOLETO', 'DOACAO', 'OUTROS'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 flex flex-col text-sm">
              <span className="text-[10px] font-bold uppercase text-slate-500">Observações</span>
              <textarea className="mt-1 rounded-lg border px-2 py-1.5" rows={2} value={form.observacoes || ''} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-xs font-bold" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white"
                onClick={async () => {
                  await patrimonioJson('/api/patrimonio/baixas', {
                    method: 'POST',
                    body: JSON.stringify({ ativo_id: editId, motivo_baixa: form.motivo_baixa, observacoes: form.observacoes || null }),
                  });
                  setModal(null);
                  await load();
                }}
              >
                Confirmar baixa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" role="dialog">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Detalhe</p>
                <p className="font-mono text-lg font-black text-slate-900">{String(detail.numero_patrimonio)}</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold" onClick={() => setDetail(null)}>
                Fechar
              </button>
            </div>
            <div className="flex gap-1 border-b border-slate-100 px-2 pt-2">
              {(
                [
                  ['geral', 'Geral'],
                  ['mov', 'Movimentações'],
                  ['manut', 'Manutenções'],
                  ['baixas', 'Baixas'],
                ] as const
              ).map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  className={clsx(
                    'rounded-t-lg px-3 py-2 text-xs font-bold',
                    tabDet === k ? 'bg-slate-100 text-sl-navy' : 'text-slate-500',
                  )}
                  onClick={() => setTabDet(k)}
                >
                  {lab}
                </button>
              ))}
            </div>
            <div className="p-4 text-sm">
              {tabDet === 'geral' ? (
                <dl className="grid gap-2">
                  <dt className="text-[10px] font-bold uppercase text-slate-500">Descrição</dt>
                  <dd>{String(detail.descricao)}</dd>
                  <dt className="text-[10px] font-bold uppercase text-slate-500">Categoria</dt>
                  <dd>{String(detail.categoria)}</dd>
                  <dt className="text-[10px] font-bold uppercase text-slate-500">Status</dt>
                  <dd>
                    <Badge status={String(detail.status)} />
                  </dd>
                  <dt className="text-[10px] font-bold uppercase text-slate-500">Agência / CC / Resp.</dt>
                  <dd>
                    {String(detail.agencia_atual || '—')} · {String(detail.centro_custo || '—')} · {String(detail.responsavel_atual || '—')}
                  </dd>
                </dl>
              ) : null}
              {tabDet === 'mov' ? (
                <ul className="space-y-2 text-xs">
                  {detMov.map((m: unknown) => {
                    const r = m as Record<string, unknown>;
                    return (
                      <li key={String(r.id)} className="rounded-lg border border-slate-100 p-2">
                        <span className="font-bold">{String(r.tipo_movimentacao)}</span> · {String(r.created_at || '').slice(0, 10)}
                        <p className="text-slate-600">{String(r.motivo || '—')}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {tabDet === 'manut' ? (
                <ul className="space-y-2 text-xs">
                  {detMan.map((m: unknown) => {
                    const r = m as Record<string, unknown>;
                    return (
                      <li key={String(r.id)} className="rounded-lg border border-slate-100 p-2">
                        <span className="font-bold">{String(r.status)}</span> — {String(r.descricao_problema || '').slice(0, 120)}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {tabDet === 'baixas' ? (
                <ul className="text-xs">
                  {detBaixas.length === 0 ? <li>Sem baixa.</li> : null}
                  {detBaixas.map((b: unknown) => {
                    const r = b as Record<string, unknown>;
                    return (
                      <li key={String(r.id)} className="rounded-lg border border-red-100 bg-red-50/50 p-2">
                        {String(r.motivo_baixa)} · {String(r.data_baixa || '').slice(0, 10)}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
