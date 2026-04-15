/**
 * Mapa canônico: submódulos do `fase_1.md` (Camada 1) → rota `/app/...` e `Page` em `types.ts`.
 * Use como checklist de migração a partir de `App.tsx` / `components/`.
 */
export const FASE3_ROUTE_MAP = {
  operacional: {
    basePath: '/app/operacional',
    subs: [
      { slug: 'visao-geral', page: 'dashboard' },
      { slug: 'pendencias', page: 'pendencias' },
      { slug: 'criticos', page: 'criticos' },
      { slug: 'em-busca', page: 'em_busca' },
      { slug: 'ocorrencias', page: 'ocorrencias' },
      { slug: 'rastreio-operacional', page: 'rastreio_operacional' },
      { slug: 'concluidos', page: 'concluidos' },
    ],
  },
  manifestos: {
    basePath: '/app/manifestos',
    subs: [
      'Painel Geral',
      'CTEs',
      'MDF-e / Manifestos',
      'Emissão',
      'Cancelamento',
      'Encerramento',
      'Rejeições',
      'Eventos SEFAZ',
      'Monitor fiscal',
      'Histórico',
      'Configurações fiscais',
    ],
  },
  crm: { basePath: '/app/crm', note: 'Funil, Chat, Dashboard já roteados em workspace-routes.ts' },
  comercial: { basePath: '/app/comercial', note: 'Metas / Robô Supremo mapeados' },
  clientes: { basePath: '/app/clientes', subs: ['Cadastro', 'Grupos', 'Contratos', 'Tabelas', 'Regras', 'Simulação', 'Vigência', 'Reajustes', 'Aprovação'] },
  patrimonio: { basePath: '/app/patrimonio', subs: ['Cadastro', 'Etiquetas', 'Movimentações', 'Responsáveis', 'Localização', 'Transferências', 'Inventário', 'Manutenção', 'Baixa', 'Auditoria'] },
} as const;
