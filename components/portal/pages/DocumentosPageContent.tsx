'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, FileText, Download, FolderOpen, ChevronRight, FileSpreadsheet, FileImage } from 'lucide-react';

type DocRow = {
  id: string | number;
  name: string;
  type: string;
  size: string;
  folder: string;
  date: string;
  href: string | null;
};

const folderPalette = [
  'bg-blue-500/10 text-blue-600',
  'bg-emerald-500/10 text-emerald-600',
  'bg-purple-500/10 text-purple-600',
  'bg-amber-500/10 text-amber-600',
  'bg-cyan-500/10 text-cyan-600',
  'bg-rose-500/10 text-rose-600',
];

function mimeLabel(m: string | null | undefined): string {
  if (!m) return 'Arquivo';
  if (m.includes('pdf')) return 'PDF';
  if (m.includes('spreadsheet') || m.includes('excel') || m.endsWith('sheet')) return 'XLSX';
  if (m.includes('word')) return 'DOCX';
  if (m.startsWith('image/')) return 'Imagem';
  return 'Arquivo';
}

export function DocumentosPageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [fromApi, setFromApi] = useState<DocRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/content?type=document', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const data = await res.json();
        const items = (data?.items || []) as {
          id: string;
          title: string;
          category?: string | null;
          main_download_url?: string | null;
          main_mime?: string | null;
          publish_start?: string | null;
          created_at?: string | null;
        }[];
        if (cancelled) return;
        setFromApi(
          items.map((it) => {
            const raw = it.publish_start || it.created_at;
            const date = raw
              ? new Date(raw).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '';
            return {
              id: `doc-${it.id}`,
              name: it.title,
              type: mimeLabel(it.main_mime),
              size: '—',
              folder: it.category?.trim() || 'Documentos corporativos',
              date,
              href: it.main_download_url || null,
            };
          }),
        );
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const docList = useMemo(() => fromApi, [fromApi]);

  const folderNames = useMemo(() => {
    const s = new Set<string>();
    docList.forEach((d) => s.add(d.folder));
    return Array.from(s).slice(0, 6);
  }, [docList]);

  const filteredDocs = docList.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.folder.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sl-navy px-6 pb-16 pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red-light">Documentos</p>
          <h1 className="mb-4 font-heading text-4xl font-bold text-white md:text-5xl">Biblioteca de documentos</h1>
          <p className="mx-auto mb-4 max-w-lg text-lg text-white/60">
            Arquivos publicados no SharePoint em <span className="font-mono text-white/90">PortalMidia/documentos</span> aparecem aqui
            automaticamente após cadastro no gestor.
          </p>

          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar documentos, políticas, formulários..."
              className="h-14 w-full rounded-2xl border border-transparent bg-card py-4 pl-14 pr-6 text-base text-foreground shadow-xl placeholder:text-muted-foreground transition-all focus:border-sl-red/30 focus:outline-none focus:ring-2 focus:ring-sl-red/30"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {!loaded && <p className="mb-8 text-sm text-muted-foreground">Carregando documentos…</p>}

        {loaded && docList.length === 0 && (
          <div className="mb-16 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
            <p className="text-muted-foreground">Nenhum documento publicado no catálogo.</p>
            <a href="/portal-edicao" className="mt-4 inline-block text-sm font-medium text-sl-red hover:text-sl-red-light">
              Cadastrar em /portal-edicao
            </a>
          </div>
        )}

        {folderNames.length > 0 && (
          <>
            <h2 className="mb-6 font-heading text-xl font-bold text-foreground">Categorias</h2>
            <div className="mb-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {folderNames.map((name, i) => {
                const color = folderPalette[i % folderPalette.length];
                return (
                  <div
                    key={name}
                    className="group flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition-all duration-300 hover:translate-y-[-2px] hover:border-sl-navy/20 hover:shadow-lg"
                  >
                    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <span className="font-heading text-xs font-semibold leading-tight text-foreground">{name}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 className="mb-6 font-heading text-xl font-bold text-foreground">Documentos publicados</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {filteredDocs.map((doc, index) => (
            <div
              key={doc.id}
              className={`group flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 ${
                index !== filteredDocs.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sl-red/10">
                {doc.type === 'XLSX' ? (
                  <FileSpreadsheet className="h-5 w-5 text-sl-red" />
                ) : doc.type === 'Imagem' ? (
                  <FileImage className="h-5 w-5 text-sl-red" />
                ) : (
                  <FileText className="h-5 w-5 text-sl-red" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-sl-navy-light">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.folder} · {doc.type} · {doc.size}
                </p>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">{doc.date}</span>
              {doc.href ? (
                <a
                  href={doc.href}
                  className="p-2 text-muted-foreground transition-colors hover:text-sl-red"
                  title="Baixar"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : (
                <span className="p-2 text-muted-foreground/40">
                  <Download className="h-4 w-4" />
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-sl-red" />
            </div>
          ))}

          {filteredDocs.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">Nenhum documento encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
