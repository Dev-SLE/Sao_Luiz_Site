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

export type PermissionGroup = "MODULO" | "ABA" | "ACAO" | "ESCOPO" | "ADMIN" | "LEGADO";

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  group: PermissionGroup;
  /** Seção na UI de perfis */
  section: PermissionSectionId;
};

/** Ordem das subcamadas no editor de perfis (dentro de cada secção). */
export const PERMISSION_GROUP_ORDER: PermissionGroup[] = [
  "MODULO",
  "ABA",
  "ACAO",
  "ESCOPO",
  "ADMIN",
  "LEGADO",
];

export const PERMISSION_GROUP_LABELS: Record<PermissionGroup, string> = {
  MODULO: "Camadas (portal/módulos/setores)",
  ABA: "Telas e subtelas",
  ACAO: "Funções e ações",
  ESCOPO: "Escopos de dados",
  ADMIN: "Administração e integrações",
  LEGADO: "Legado / compatibilidade",
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: "auth.storage.microsoft_only",
    label: "Autenticação: perfil SharePoint (sem Google Drive)",
    description:
      "O login não abre o fluxo Google; use para quem opera só com anexos corporativos via Microsoft Graph/SharePoint.",
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
    key: "module.crm.manage",
    label: "CRM: gestão técnica (pipelines, templates)",
    description: "Pipelines CRM, templates Sofia ligados ao CRM e outras rotas administrativas que exigem esta chave.",
    group: "ADMIN",
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
    key: "VIEW_COMERCIAL_AUDITORIA",
    label: "Comercial — Metas e auditoria",
    description: "Acessar a tela de metas e auditoria.",
    group: "MODULO",
    section: "comercial",
  },
  {
    key: "VIEW_COMERCIAL_ROBO_SUPREMO",
    label: "Comercial — Robô Supremo",
    description: "Acessar a ferramenta Robô Supremo.",
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
    key: "VIEW_SETTINGS",
    label: "Ver metadados de configuração (leitura)",
    description: "Chave auxiliar; a tela de configuração completa exige MANAGE_SETTINGS.",
    group: "ADMIN",
    section: "sistema",
  },
  {
    key: "MANAGE_SETTINGS",
    label: "Configurações e logs (gestão)",
    description: "Aceder à área de configurações, perfis, utilizadores e logs.",
    group: "ADMIN",
    section: "sistema",
  },
  {
    key: "VIEW_USERS",
    label: "Ver utilizadores",
    description: "Listar utilizadores (sem criar/editar, salvo permissão de gestão).",
    group: "ADMIN",
    section: "sistema",
  },
  {
    key: "MANAGE_USERS",
    label: "Gerir utilizadores",
    description: "Criar, editar e remover utilizadores.",
    group: "ADMIN",
    section: "sistema",
  },
  {
    key: "MANAGE_SOFIA",
    label: "Configurar Sofia (assistente)",
    description: "Ajustes da Sofia e rota /operacional/sofia-config.",
    group: "ADMIN",
    section: "sistema",
  },
  {
    key: "MANAGE_CRM_OPS",
    label: "Operação CRM (consola técnica)",
    description: "Times, WhatsApp, triagem, SLA, automações e rota Operação CRM.",
    group: "ADMIN",
    section: "crm",
  },
  {
    key: "EXPORT_DATA",
    label: "Exportar dados (Excel)",
    description: "Exportar Excel nas tabelas operacionais.",
    group: "ACAO",
    section: "sistema",
  },
  {
    key: "EXPORT_SYSTEM_LOGS",
    label: "Exportar logs do sistema",
    description: "Exportar CSV/Excel na aba Logs.",
    group: "ACAO",
    section: "sistema",
  },
  {
    key: "MANAGE_RASTREIO_OPERACIONAL",
    label: "Atualizar rastreio operacional",
    description: "Registar paragens, autocarros, fotos e estado de descarga.",
    group: "ACAO",
    section: "operacional",
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
  /**
   * Apenas o atalho /app e gates que checam explicitamente `workspace.app.view`.
   * Módulos (operacional, CRM, comercial, etc.) exigem permissões próprias.
   */
  "workspace.app.view": [],
  "module.comercial.view": ["VIEW_RELATORIOS", "VIEW_COMERCIAL_AUDITORIA", "VIEW_COMERCIAL_ROBO_SUPREMO"],
  "VIEW_COMERCIAL_AUDITORIA": ["VIEW_RELATORIOS"],
  /** Entrada no módulo operacional: abas canónicas (e atalho workspace). Chaves VIEW_* antigas ligam-se às abas em runtime. */
  "module.operacional.view": [
    "workspace.app.view",
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
    "tab.crm.dashboard.view",
    "tab.crm.funil.view",
    "tab.crm.chat.view",
  ],
  "module.crm.manage": ["MANAGE_CRM_OPS"],
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

/**
 * Expansão para checagem em runtime: chaves legadas e módulos (`module.operacional.view`, etc.).
 * `workspace.app.view` não concede módulos inteiros — só o shell / rotas que pedem essa chave explicitamente.
 */
export function expandAuthPermissionMatch(needed: string): Set<string> {
  const p = String(needed).trim();
  const equivalent = new Set<string>(p ? [p] : []);
  for (const [canonical, aliases] of Object.entries(LEGACY_ALIAS)) {
    if (p === canonical || aliases.includes(p)) {
      equivalent.add(canonical);
      aliases.forEach((a) => equivalent.add(a));
    }
  }
  return equivalent;
}

/**
 * Equivalência por checkbox na tela de perfis: não puxa o merge reverso a partir dos guarda-chuvas
 * `workspace.app.view` / `module.operacional.view`, senão desmarcar uma aba removia dezenas de permissões.
 */
const PROFILE_EQUIVALENCE_REVERSE_SKIP = new Set<string>([
  'workspace.app.view',
  'module.operacional.view',
  'module.gerencial.view',
]);

export function getProfileCheckboxEquivalence(perm: string): Set<string> {
  const p = String(perm).trim();
  if (!p) return new Set();
  const s = new Set<string>([p]);
  for (const [canonical, aliases] of Object.entries(LEGACY_ALIAS)) {
    if (p === canonical) {
      s.add(canonical);
      aliases.forEach((a) => s.add(a));
    }
  }
  for (const [canonical, aliases] of Object.entries(LEGACY_ALIAS)) {
    if (PROFILE_EQUIVALENCE_REVERSE_SKIP.has(canonical)) continue;
    if (aliases.includes(p)) {
      s.add(canonical);
      aliases.forEach((a) => s.add(a));
    }
  }
  return s;
}

/** @deprecated Use expandAuthPermissionMatch ou getProfileCheckboxEquivalence conforme o contexto. */
export function getPermissionEquivalence(perm: string): Set<string> {
  return expandAuthPermissionMatch(perm);
}

export function hasPermissionWithAliases(userPermissions: string[] | null | undefined, needed: string) {
  const perms = (userPermissions || []).map((p) => String(p).trim()).filter(Boolean);
  if (!needed) return true;
  if (perms.includes("*") || perms.includes("admin.*")) return true;

  const [namespace] = needed.split(".");
  if (namespace && perms.includes(`${namespace}.*`)) return true;

  const equivalent = expandAuthPermissionMatch(needed);
  for (const p of perms) {
    if (equivalent.has(p)) return true;
  }
  return false;
}
