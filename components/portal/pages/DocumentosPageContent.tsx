'use client';

import { useState } from 'react';
import { Search, FileText, Download, FolderOpen, ChevronRight, File, FileSpreadsheet, FileImage } from 'lucide-react';

const folders = [
  { id: 1, name: 'Políticas e Normas', icon: FolderOpen, count: 12, color: 'bg-blue-500/10 text-blue-600' },
  { id: 2, name: 'Procedimentos Operacionais', icon: FolderOpen, count: 8, color: 'bg-emerald-500/10 text-emerald-600' },
  { id: 3, name: 'Formulários', icon: FileSpreadsheet, count: 15, color: 'bg-purple-500/10 text-purple-600' },
  { id: 4, name: 'Manuais e Guias', icon: FileText, count: 6, color: 'bg-amber-500/10 text-amber-600' },
  { id: 5, name: 'Comunicados Oficiais', icon: File, count: 24, color: 'bg-cyan-500/10 text-cyan-600' },
  { id: 6, name: 'Material de Treinamento', icon: FileImage, count: 10, color: 'bg-rose-500/10 text-rose-600' },
];

const recentDocs = [
  { id: 1, name: 'Política de Segurança Viária — 2026', type: 'PDF', size: '2.4 MB', folder: 'Políticas e Normas', date: '10 Abr 2026' },
  { id: 2, name: 'Manual do Colaborador — Edição Atualizada', type: 'PDF', size: '5.1 MB', folder: 'Manuais e Guias', date: '08 Abr 2026' },
  { id: 3, name: 'Formulário de Solicitação de Férias', type: 'XLSX', size: '156 KB', folder: 'Formulários', date: '07 Abr 2026' },
  { id: 4, name: 'Procedimento — Checklist Pré-Viagem', type: 'PDF', size: '890 KB', folder: 'Procedimentos Operacionais', date: '05 Abr 2026' },
  { id: 5, name: 'Código de Ética e Conduta', type: 'PDF', size: '1.8 MB', folder: 'Políticas e Normas', date: '03 Abr 2026' },
  { id: 6, name: 'Formulário de Reembolso de Despesas', type: 'XLSX', size: '98 KB', folder: 'Formulários', date: '01 Abr 2026' },
  { id: 7, name: 'Guia de Boas Práticas — Direção Defensiva', type: 'PDF', size: '3.2 MB', folder: 'Manuais e Guias', date: '28 Mar 2026' },
  { id: 8, name: 'Regulamento Interno — Unidades Operacionais', type: 'PDF', size: '1.5 MB', folder: 'Políticas e Normas', date: '25 Mar 2026' },
];

export function DocumentosPageContent() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = recentDocs.filter(
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
          <p className="mx-auto mb-10 max-w-lg text-lg text-white/60">
            Encontre políticas, formulários, manuais e tudo que você precisa.
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
        <h2 className="mb-6 font-heading text-xl font-bold text-foreground">Categorias</h2>
        <div className="mb-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {folders.map((folder) => {
            const Icon = folder.icon;
            return (
              <button
                key={folder.id}
                type="button"
                className="group flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition-all duration-300 hover:translate-y-[-2px] hover:border-sl-navy/20 hover:shadow-lg"
              >
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${folder.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-heading text-xs font-semibold leading-tight text-foreground">{folder.name}</span>
                <span className="mt-1 text-xs text-muted-foreground">{folder.count} arquivos</span>
              </button>
            );
          })}
        </div>

        <h2 className="mb-6 font-heading text-xl font-bold text-foreground">Documentos recentes</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {filteredDocs.map((doc, index) => (
            <div
              key={doc.id}
              className={`group flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 ${
                index !== filteredDocs.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sl-red/10">
                <FileText className="h-5 w-5 text-sl-red" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-sl-navy-light">
                  {doc.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doc.folder} · {doc.type} · {doc.size}
                </p>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">{doc.date}</span>
              <button type="button" className="p-2 text-muted-foreground transition-colors hover:text-sl-red">
                <Download className="h-4 w-4" />
              </button>
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
