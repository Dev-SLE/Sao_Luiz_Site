/** Agrupamento na tela de perfis (Configurações). */
export type PermissionSectionId =
  | "operacional"
  | "crm"
  | "comercial"
  | "administracao"
  | "escopos"
  | "telas"
  | "sistema";

export const PERMISSION_SECTION_ORDER: PermissionSectionId[] = [
  "operacional",
  "crm",
  "comercial",
  "administracao",
  "escopos",
  "telas",
  "sistema",
];

export const PERMISSION_SECTION_LABELS: Record<PermissionSectionId, string> = {
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
];

const LEGACY_ALIAS: Record<string, string[]> = {
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
  const [namespace] = needed.split(".");
  if (namespace && perms.includes(`${namespace}.*`)) return true;

  const equivalent = getPermissionEquivalence(needed);
  for (const p of perms) {
    if (equivalent.has(p)) return true;
  }
  return false;
}
