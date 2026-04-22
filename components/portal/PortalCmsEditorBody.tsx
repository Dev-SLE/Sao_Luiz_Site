'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { canEditPortalContent } from '@/lib/portalEditorAccess';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';

type ContentItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  slug?: string | null;
  category?: string | null;
  subtitle?: string | null;
  description?: string | null;
  cover_view_url?: string | null;
  main_view_url?: string | null;
  main_download_url?: string | null;
  main_mime?: string | null;
  metadata_json?: Record<string, unknown> | null;
  display_order?: number;
  is_featured?: boolean;
};

type RowEdit = {
  title: string;
  subtitle: string;
  description: string;
  slug: string;
  category: string;
  duration: string;
  modules: string;
  featured: boolean;
};

function slugify(raw: string) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'conteudo';
}

function portalEntity(t: string): string {
  if (
    t === 'banner' ||
    t === 'campaign' ||
    t === 'news' ||
    t === 'training' ||
    t === 'document' ||
    t === 'mural' ||
    t === 'recognition' ||
    t === 'faq'
  )
    return t;
  return 'banner';
}

export function PortalCmsEditorBody() {
  const { user } = useAuth();
  const { hasPermission } = useData();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [type, setType] = useState('banner');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingUpload, setPendingUpload] = useState<{ id: string; role: 'cover' | 'main' } | null>(null);

  const allowed = canEditPortalContent(hasPermission, { role: user?.role, username: user?.username });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content?manage=1', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao listar');
      const list = (data.items || []) as ContentItem[];
      setItems(list);
      setEdits((prev) => {
        const next = { ...prev };
        for (const it of list) {
          if (!next[it.id]) {
            const m = it.metadata_json && typeof it.metadata_json === 'object' ? it.metadata_json : {};
            next[it.id] = {
              title: it.title,
              subtitle: String(it.subtitle || ''),
              description: String(it.description || ''),
              slug: String(it.slug || ''),
              category: String(it.category || ''),
              duration: String((m as { duration?: unknown }).duration ?? ''),
              modules: String((m as { modules?: unknown }).modules ?? '1'),
              featured: !!it.is_featured,
            };
          }
        }
        return next;
      });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  async function createDraft() {
    setMsg('');
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim() || 'Novo item',
          status: 'draft',
          subtitle: newSubtitle.trim() || null,
          description: newDescription.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao criar');
      setTitle('');
      setNewSubtitle('');
      setNewDescription('');
      await load();
      setMsg('Rascunho criado. Ajuste título, envie mídia e publique.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function unpublish(id: string) {
    setMsg('');
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft', publish_start: null, publish_end: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao despublicar');
      await load();
      setMsg('Conteúdo despublicado (rascunho).');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function publish(id: string) {
    setMsg('');
    try {
      const res = await fetch(`/api/content/${id}/publish`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao publicar');
      await load();
      setMsg('Publicado.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function saveMeta(id: string) {
    setMsg('');
    const e = edits[id];
    if (!e) return;
    try {
      const modules = Math.max(1, Math.floor(Number(e.modules) || 1));
      const res = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: e.title.trim() || 'Sem título',
          subtitle: e.subtitle.trim() || null,
          description: e.description.trim() || null,
          slug: e.slug.trim() || null,
          category: e.category.trim() || null,
          is_featured: e.featured,
          metadata_json: { duration: e.duration.trim() || undefined, modules },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar');
      await load();
      setMsg('Alterações salvas.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function removeItem(id: string) {
    if (!globalThis.confirm('Excluir este item do portal? A mídia permanece no SharePoint; só some do catálogo.')) return;
    setMsg('');
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao excluir');
      await load();
      setMsg('Item removido.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Erro');
    }
  }

  function startUpload(id: string, role: 'cover' | 'main') {
    setPendingUpload({ id, role });
    fileRef.current?.click();
  }

  async function onFilePicked(file: File | null) {
    if (!file || !pendingUpload) return;
    const { id, role } = pendingUpload;
    setPendingUpload(null);
    const it = items.find((x) => x.id === id);
    const e = edits[id] || {
      title: '',
      subtitle: '',
      description: '',
      slug: '',
      category: '',
      duration: '',
      modules: '1',
      featured: false,
    };
    const fd = new FormData();
    fd.append('file', file);
    fd.append('module', 'portal');
    fd.append('entity', portalEntity(it?.type || 'banner'));
    fd.append('entity_id', id);
    fd.append('category_slug', slugify(e.category || 'geral'));
    fd.append('content_slug', slugify(e.slug || e.title || it?.title || id));
    setMsg('Enviando…');
    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha no upload');
      const fileId = data?.file?.id as string | undefined;
      if (!fileId) throw new Error('Resposta sem id do arquivo');
      const patchBody = role === 'cover' ? { cover_file_id: fileId } : { main_file_id: fileId };
      const p = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const pd = await p.json().catch(() => ({}));
      if (!p.ok) throw new Error(pd?.error || 'Falha ao vincular arquivo');
      await load();
      setMsg(role === 'cover' ? 'Capa atualizada.' : 'Arquivo principal vinculado.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Erro no upload');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Sem permissão. Peça ao administrador a chave <code className="rounded bg-muted px-1 text-xs">portal.colaborador.editor</code> ou{' '}
        <code className="rounded bg-muted px-1 text-xs">portal.gestor.content.manage</code>.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,application/pdf"
        onChange={(ev) => void onFilePicked(ev.target.files?.[0] || null)}
      />

      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-sl-red">Conteúdo dinâmico</p>
        <h2 className="mt-2 font-heading text-2xl font-bold text-foreground">Banners, mural, campanhas, reconhecimento e mais</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Uploads vão para o SharePoint nas pastas <span className="font-mono text-xs">PortalMidia/…</span> automaticamente. Não é preciso criar pasta
          manualmente antes.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">Novo rascunho</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[10px] text-muted-foreground">Tipo</label>
            <select
              className="block mt-1 rounded-lg border border-border bg-background px-2 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="banner">banner (home)</option>
              <option value="campaign">campaign (campanhas)</option>
              <option value="news">news (comunicados)</option>
              <option value="training">training (treinamentos + vídeo)</option>
              <option value="document">document (PDF / docs)</option>
              <option value="mural">mural (posts na home)</option>
              <option value="recognition">recognition (mural de reconhecimento)</option>
              <option value="faq">faq (perguntas da ouvidoria / suporte)</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] text-muted-foreground">Título</label>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do conteúdo"
            />
          </div>
          <button
            type="button"
            onClick={() => void createDraft()}
            className="rounded-lg bg-sl-red px-4 py-2 text-sm font-semibold text-white hover:bg-sl-red-light"
          >
            Criar
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Subtítulo (resumo / chamada)</label>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground">Texto completo (descrição)</label>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Opcional — aparece em comunicados, treinos, etc."
            />
          </div>
        </div>
      </div>

      {msg ? <p className="text-sm text-sl-navy">{msg}</p> : null}

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="bg-muted px-4 py-2 text-xs font-bold uppercase">Itens ({items.length})</div>
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const e = edits[it.id] ?? {
                title: it.title,
                subtitle: String(it.subtitle || ''),
                description: String(it.description || ''),
                slug: String(it.slug || ''),
                category: String(it.category || ''),
                duration: '',
                modules: '1',
                featured: !!it.is_featured,
              };
              return (
                <li key={it.id} className="px-4 py-4 text-sm space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">{it.type}</span>
                    <span className="text-xs text-muted-foreground">{it.status}</span>
                    <div className="flex-1" />
                    {it.status !== 'published' ? (
                      <button type="button" className="text-xs font-semibold text-sl-navy underline" onClick={() => void publish(it.id)}>
                        Publicar
                      </button>
                    ) : (
                      <button type="button" className="text-xs font-semibold text-amber-700 underline" onClick={() => void unpublish(it.id)}>
                        Despublicar
                      </button>
                    )}
                    <button type="button" className="text-xs font-semibold text-red-600 underline" onClick={() => void removeItem(it.id)}>
                      Excluir
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Título</label>
                    <input
                      className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-medium"
                      value={e.title}
                      onChange={(ev) => setEdits((s) => ({ ...s, [it.id]: { ...e, title: ev.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Subtítulo</label>
                    <input
                      className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={e.subtitle}
                      placeholder="Resumo para listagens"
                      onChange={(ev) => setEdits((s) => ({ ...s, [it.id]: { ...e, subtitle: ev.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Texto completo</label>
                    <textarea
                      className="mt-0.5 min-h-[88px] w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={e.description}
                      placeholder="Descrição longa"
                      onChange={(ev) => setEdits((s) => ({ ...s, [it.id]: { ...e, description: ev.target.value } }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`feat-${it.id}`}
                      checked={e.featured}
                      onChange={(ev) =>
                        setEdits((s) => ({ ...s, [it.id]: { ...e, featured: ev.target.checked } }))
                      }
                      className="rounded border-border"
                    />
                    <label htmlFor={`feat-${it.id}`} className="text-xs text-foreground">
                      Destaque (prioriza na home: campanhas, treinos, comunicados em seções que usam featured)
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Slug</label>
                      <input
                        className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                        value={e.slug}
                        onChange={(ev) => setEdits((s) => ({ ...s, [it.id]: { ...e, slug: ev.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Categoria</label>
                      <input
                        className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                        value={e.category}
                        onChange={(ev) => setEdits((s) => ({ ...s, [it.id]: { ...e, category: ev.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Duração (treino)</label>
                      <input
                        className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                        value={e.duration}
                        placeholder="ex: 2h"
                        onChange={(ev) => setEdits((s) => ({ ...s, [it.id]: { ...e, duration: ev.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Módulos</label>
                      <input
                        className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                        value={e.modules}
                        onChange={(ev) => setEdits((s) => ({ ...s, [it.id]: { ...e, modules: ev.target.value } }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      onClick={() => void saveMeta(it.id)}
                    >
                      Salvar textos / slug / categoria
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      onClick={() => startUpload(it.id, 'cover')}
                    >
                      Capa (imagem)
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      onClick={() => startUpload(it.id, 'main')}
                    >
                      Vídeo ou PDF
                    </button>
                    {it.cover_view_url ? (
                      <a href={it.cover_view_url} target="_blank" rel="noreferrer" className="text-xs text-sl-red underline">
                        ver capa
                      </a>
                    ) : null}
                    {it.main_view_url ? (
                      <a href={it.main_view_url} target="_blank" rel="noreferrer" className="text-xs text-sl-red underline">
                        ver mídia
                      </a>
                    ) : null}
                    {it.main_download_url ? (
                      <a href={it.main_download_url} target="_blank" rel="noreferrer" className="text-xs text-sl-navy underline">
                        baixar
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
