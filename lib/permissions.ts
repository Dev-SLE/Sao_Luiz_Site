import { FASE1_EXTRA_PERMISSIONS } from '@/lib/permissions-fase1-extensions';

/** Agrupamento na tela de perfis (Configurações). */
export type PermissionSectionId =
  | "portal"
  | "operacional"
  | "crm"
  | "comercial"
  | "administracao"
  | "escopos"
  | "telas"
  | "sistema";

export const PERMISSION_SECTION_ORDER: PermissionSectionId[] = [
  "portal",
  "operacional",
  "crm",
  "comercial",
  "administracao",
  "escopos",
  "telas",
  "sistema",
];

export const PERMISSION_SECTION_LABELS: Record<PermissionSectionId, string> = {
  portal: "Portal do colaborador (rotas /inicio, /comunicados…)",
  operacional: "Módulo Operacional",
  crm: "Módulo CRM",
  comercial: "Módulo Comercial",
  administracao: "Módulo Administração",
  escopos: "Escopos de dados (CRM e Operacional)",
  telas: "Telas operacionais e comerciais (chaves legadas)",
  sistema: "Administração do sistema, exportação e integrações",
};

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  group: "MODULO" | "ABA" | "ACAO" | "ESCOPO" | "ADMIN" | "LEGADO";
  /** Seção na UI de perfis */
  section: PermissionSectionId;
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: "auth.google_drive.skip",
    label: "Autenticação: pular vínculo obrigatório do Google Drive",
    description:
      "Quando marcado, o login não exige concluir o fluxo do Google Drive (útil para perfis que usam apenas o portal).",
    group: "ADMIN",
    section: "sistema",
  },
  {
    key: "workspace.app.view",
    label: "Área de trabalho (/app)",
    description: "Exibir atalho e acessar o sistema operacional interno.",
    group: "MODULO",
    section: "sistema",
  },
  {
    key: "portal.home.view",
    label: "Portal: Início",
    description: "Acessar a home / início do portal corporativo.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.comunicados.view",
    label: "Portal: Comunicados",
    description: "Acessar comunicados no portal.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.documentos.view",
    label: "Portal: Documentos",
    description: "Acessar documentos institucionais.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.treinamentos.view",
    label: "Portal: Treinamentos",
    description: "Acessar treinamentos.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.campanhas.view",
    label: "Portal: Campanhas",
    description: "Acessar campanhas internas.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.agenda.view",
    label: "Portal: Agenda",
    description: "Acessar agenda corporativa.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.suporte.view",
    label: "Portal: Suporte",
    description: "Acessar suporte / ouvidoria.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.perfil.view",
    label: "Portal: Meu perfil",
    description: "Acessar dados do colaborador.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.meu_ponto.view",
    label: "Portal: Meu ponto",
    description: "Acessar consulta de ponto (Fase 2: dados reais).",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.minha_escala.view",
    label: "Portal: Minha escala",
    description: "Acessar escala de trabalho (Fase 2: dados reais).",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.holerite.view",
    label: "Portal: Holerite",
    description: "Acessar holerite (Fase 2: dados reais).",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "portal.solicitacoes.view",
    label: "Portal: Solicitações internas",
    description: "Acompanhar e abrir solicitações administrativas no portal.",
    group: "MODULO",
    section: "portal",
  },
  {
    key: "module.operacional.view",
    label: "Módulo Operacional",
    description: "Acessar área operacional (menu e rotas do módulo).",
    group: "MODULO",
    section: "operacional",
  },
  {
    key: "module.crm.view",
    label: "Módulo CRM",
    description: "Acessar área CRM.",
    group: "MODULO",
    section: "crm",
  },
  {
    key: "module.comercial.view",
    label: "Módulo Comercial",
    description: "Acessar área comercial.",
    group: "MODULO",
    section: "comercial",
  },
  {
    key: "module.admin.view",
    label: "Módulo Administração",
    description: "Acessar área de administração (quando aplicável ao produto).",
    group: "MODULO",
    section: "administracao",
  },

  {
    key: "tab.operacional.pendencias.view",
    label: "Aba: Pendências",
    description: "Visualizar aba de pendências.",
    group: "ABA",
    section: "operacional",
  },
  {
    key: "tab.operacional.criticos.view",
    label: "Aba: Críticos",
    description: "Visualizar aba de críticos.",
    group: "ABA",
    section: "operacional",
  },
  {
    key: "tab.operacional.em_busca.view",
    label: "Aba: Em busca",
    description: "Visualizar aba de mercadorias em busca.",
    group: "ABA",
    section: "operacional",
  },
  {
    key: "tab.operacional.ocorrencias.view",
    label: "Aba: Ocorrências",
    description: "Ocorrências formais, indenizações e fluxo (sem dossiê, se não tiver permissão separada).",
    group: "ABA",
    section: "operacional",
  },
  {
    key: "tab.operacional.dossie.view",
    label: "Aba: Dossiê",
    description: "Dossiê sensível, PDF, anexos e finalização.",
    group: "ABA",
    section: "operacional",
  },
  {
    key: "tab.operacional.concluidos.view",
    label: "Aba: Concluídos",
    description: "Visualizar aba de concluídos / resolvidos.",
    group: "ABA",
    section: "operacional",
  },
  {
    key: "tab.crm.funil.view",
    label: "Aba: Funil CRM",
    description: "Visualizar funil CRM.",
    group: "ABA",
    section: "crm",
  },
  {
    key: "tab.crm.chat.view",
    label: "Aba: Chat CRM",
    description: "Visualizar chat CRM.",
    group: "ABA",
    section: "crm",
  },
  {
    key: "tab.crm.dashboard.view",
    label: "Aba: Dashboard CRM",
    description: "Visualizar dashboard CRM.",
    group: "ABA",
    section: "crm",
  },

  {
    key: "crm.leads.view",
    label: "CRM: visualizar leads",
    description: "Visualizar leads.",
    group: "ACAO",
    section: "crm",
  },
  {
    key: "crm.leads.assign",
    label: "CRM: atribuir leads",
    description: "Atribuir leads.",
    group: "ACAO",
    section: "crm",
  },
  {
    key: "crm.leads.edit",
    label: "CRM: editar leads",
    description: "Editar dados de leads.",
    group: "ACAO",
    section: "crm",
  },
  {
    key: "crm.messages.send",
    label: "CRM: enviar mensagens",
    description: "Enviar mensagens no CRM.",
    group: "ACAO",
    section: "crm",
  },
  {
    key: "crm.messages.delete",
    label: "CRM: excluir mensagens",
    description: "Excluir mensagens no CRM.",
    group: "ACAO",
    section: "crm",
  },
  {
    key: "operacional.assignment.assign",
    label: "Atribuir pendência operacional",
    description: "Atribuir pendências por CTE (unidade e responsável).",
    group: "ACAO",
    section: "operacional",
  },
  {
    key: "operacional.assignment.unassign",
    label: "Devolver pendência operacional",
    description: "Devolver atribuição com motivo.",
    group: "ACAO",
    section: "operacional",
  },
  {
    key: "operacional.notes.edit",
    label: "Criar e editar notas operacionais",
    description: "Registrar notas, status (em busca, ocorrência, resolvido).",
    group: "ACAO",
    section: "operacional",
  },
  {
    key: "dossie.financeiro.attach",
    label: "Dossiê: anexos financeiros",
    description: "Anexar comprovantes de pagamento e arquivos do financeiro no dossiê.",
    group: "ACAO",
    section: "operacional",
  },

  {
    key: "scope.crm.self",
    label: "Escopo CRM: somente próprio",
    description: "Acessa só conversas atribuídas ao usuário.",
    group: "ESCOPO",
    section: "escopos",
  },
  {
    key: "scope.crm.team",
    label: "Escopo CRM: equipe",
    description: "Acessa conversas do time e não atribuídas.",
    group: "ESCOPO",
    section: "escopos",
  },
  {
    key: "scope.crm.all",
    label: "Escopo CRM: global",
    description: "Acessa todas as conversas.",
    group: "ESCOPO",
    section: "escopos",
  },
  {
    key: "scope.operacional.unit.self",
    label: "Escopo Operacional: unidade vinculada",
    description: "Acessa dados da unidade vinculada ao usuário.",
    group: "ESCOPO",
    section: "escopos",
  },
  {
    key: "scope.operacional.all",
    label: "Escopo Operacional: global",
    description: "Acessa todas as unidades operacionais.",
    group: "ESCOPO",
    section: "escopos",
  },
  ...(FASE1_EXTRA_PERMISSIONS as unknown as PermissionDefinition[]),
];

const LEGACY_ALIAS: Record<string, string[]> = {
  "workspace.app.view": [
    "module.operacional.view",
    "module.crm.view",
    "module.comercial.view",
    "module.admin.view",
    "module.manifestos.view",
    "module.clientes.view",
    "module.patrimonio.view",
    "module.financeiro.view",
    "module.fiscal.view",
    "module.rh.view",
    "module.compras.view",
    "module.juridico.view",
    "module.gerencial.view",
    "module.auditoria.view",
    "VIEW_DASHBOARD",
    "VIEW_PENDENCIAS",
    "VIEW_CRITICOS",
    "VIEW_EM_BUSCA",
    "VIEW_OCORRENCIAS",
    "VIEW_TAD",
    "VIEW_RASTREIO_OPERACIONAL",
    "VIEW_CONCLUIDOS",
    "VIEW_SETTINGS",
    "VIEW_RELATORIOS",
    "VIEW_CRM_DASHBOARD",
    "VIEW_CRM_FUNIL",
    "VIEW_CRM_CHAT",
    "tab.operacional.visao_geral.view",
    "tab.operacional.pendencias.view",
    "tab.operacional.criticos.view",
    "tab.operacional.em_busca.view",
    "tab.operacional.ocorrencias.view",
    "tab.operacional.concluidos.view",
    "tab.operacional.rastreio.view",
  ],
  /** Quem tem qualquer vista operacional legada ou aba nova deve passar no gate da API `module.operacional.view`. */
  "module.operacional.view": [
    "workspace.app.view",
    "VIEW_DASHBOARD",
    "VIEW_PENDENCIAS",
    "VIEW_CRITICOS",
    "VIEW_EM_BUSCA",
    "VIEW_OCORRENCIAS",
    "VIEW_TAD",
    "VIEW_RASTREIO_OPERACIONAL",
    "VIEW_CONCLUIDOS",
    "VIEW_SETTINGS",
    "VIEW_RELATORIOS",
    "MANAGE_SETTINGS",
    "tab.operacional.visao_geral.view",
    "tab.operacional.pendencias.view",
    "tab.operacional.criticos.view",
    "tab.operacional.em_busca.view",
    "tab.operacional.ocorrencias.view",
    "tab.operacional.concluidos.view",
    "tab.operacional.rastreio.view",
    "tab.operacional.dossie.view",
  ],
  "module.crm.view": [
    "VIEW_CRM_DASHBOARD",
    "VIEW_CRM_FUNIL",
    "VIEW_CRM_CHAT",
    "MANAGE_CRM_OPS",
    "tab.crm.dashboard.view",
    "tab.crm.funil.view",
    "tab.crm.chat.view",
  ],
  "tab.operacional.visao_geral.view": ["VIEW_DASHBOARD"],
  "tab.operacional.rastreio.view": ["VIEW_RASTREIO_OPERACIONAL"],
  "tab.crm.chat.view": ["VIEW_CRM_CHAT"],
  "tab.crm.funil.view": ["VIEW_CRM_FUNIL"],
  "tab.crm.dashboard.view": ["VIEW_CRM_DASHBOARD"],
  "tab.operacional.pendencias.view": ["VIEW_PENDENCIAS"],
  "tab.operacional.criticos.view": ["VIEW_CRITICOS"],
  "tab.operacional.em_busca.view": ["VIEW_EM_BUSCA"],
  "tab.operacional.ocorrencias.view": ["VIEW_OCORRENCIAS", "VIEW_TAD"],
  "tab.operacional.dossie.view": ["VIEW_DOSSIE"],
  "dossie.financeiro.attach": ["DOSSIE_FINANCE_ATTACH"],
  "tab.operacional.concluidos.view": ["VIEW_CONCLUIDOS"],
  "operacional.assignment.assign": ["ASSIGN_OPERATIONAL_PENDING"],
  "operacional.assignment.unassign": ["RETURN_OPERATIONAL_PENDING"],
  "operacional.notes.edit": ["EDIT_NOTES"],
  "scope.crm.self": ["CRM_SCOPE_SELF"],
  "scope.crm.team": ["CRM_SCOPE_TEAM"],
  "scope.crm.all": ["CRM_SCOPE_ALL"],
};

/** Chave canônica / legada e todos os sinônimos (uma permissão lógica = um checkbox). */
export function getPermissionEquivalence(perm: string): Set<string> {
  const p = String(perm).trim();
  const equivalent = new Set<string>(p ? [p] : []);
  for (const [canonical, aliases] of Object.entries(LEGACY_ALIAS)) {
    if (p === canonical || aliases.includes(p)) {
      equivalent.add(canonical);
      aliases.forEach((a) => equivalent.add(a));
    }
  }
  return equivalent;
}

export function hasPermissionWithAliases(userPermissions: string[] | null | undefined, needed: string) {
  const perms = (userPermissions || []).map((p) => String(p).trim()).filter(Boolean);
  if (!needed) return true;
  if (perms.includes("*") || perms.includes("admin.*")) return true;

  /** Perfis sem nenhuma portal.* explícita mantêm acesso ao portal (compatibilidade com dados antigos). */
  if (needed.startsWith("portal.")) {
    const hasAnyPortal = perms.some((p) => String(p).startsWith("portal."));
    if (!hasAnyPortal) return true;
  }

  const [namespace] = needed.split(".");
  if (namespace && perms.includes(`${namespace}.*`)) return true;

  const equivalent = getPermissionEquivalence(needed);
  for (const p of perms) {
    if (equivalent.has(p)) return true;
  }
  return false;
}
