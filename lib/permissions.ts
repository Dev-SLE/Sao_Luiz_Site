export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  group: "MODULO" | "ABA" | "ACAO" | "ESCOPO" | "ADMIN" | "LEGADO";
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: "module.operacional.view", label: "Módulo Operacional", description: "Acessar área operacional.", group: "MODULO" },
  { key: "module.crm.view", label: "Módulo CRM", description: "Acessar área CRM.", group: "MODULO" },
  { key: "module.comercial.view", label: "Módulo Comercial", description: "Acessar área comercial.", group: "MODULO" },
  { key: "module.admin.view", label: "Módulo Administração", description: "Acessar área de administração.", group: "MODULO" },

  { key: "tab.operacional.pendencias.view", label: "Aba Operacional: Pendências", description: "Visualizar aba de pendências.", group: "ABA" },
  { key: "tab.operacional.criticos.view", label: "Aba Operacional: Críticos", description: "Visualizar aba de críticos.", group: "ABA" },
  { key: "tab.operacional.em_busca.view", label: "Aba Operacional: Em Busca", description: "Visualizar aba de em busca.", group: "ABA" },
  { key: "tab.operacional.ocorrencias.view", label: "Aba Operacional: Ocorrências", description: "Visualizar aba de ocorrências.", group: "ABA" },
  { key: "tab.operacional.concluidos.view", label: "Aba Operacional: Concluídos", description: "Visualizar aba de concluídos.", group: "ABA" },
  { key: "tab.crm.funil.view", label: "Aba CRM: Funil", description: "Visualizar funil CRM.", group: "ABA" },
  { key: "tab.crm.chat.view", label: "Aba CRM: Chat", description: "Visualizar chat CRM.", group: "ABA" },
  { key: "tab.crm.dashboard.view", label: "Aba CRM: Dashboard", description: "Visualizar dashboard CRM.", group: "ABA" },

  { key: "crm.leads.view", label: "CRM Leads: visualizar", description: "Visualizar leads.", group: "ACAO" },
  { key: "crm.leads.assign", label: "CRM Leads: atribuir", description: "Atribuir leads.", group: "ACAO" },
  { key: "crm.leads.edit", label: "CRM Leads: editar", description: "Editar dados de leads.", group: "ACAO" },
  { key: "crm.messages.send", label: "CRM Mensagens: enviar", description: "Enviar mensagens no CRM.", group: "ACAO" },
  { key: "crm.messages.delete", label: "CRM Mensagens: excluir", description: "Excluir mensagens no CRM.", group: "ACAO" },
  { key: "operacional.assignment.assign", label: "Operacional: atribuir pendência", description: "Atribuir pendências operacionais.", group: "ACAO" },
  { key: "operacional.assignment.unassign", label: "Operacional: devolver pendência", description: "Devolver pendências operacionais.", group: "ACAO" },
  { key: "operacional.notes.edit", label: "Operacional: editar notas", description: "Criar e editar notas operacionais.", group: "ACAO" },

  { key: "scope.crm.self", label: "Escopo CRM: próprio", description: "Acessa só suas conversas.", group: "ESCOPO" },
  { key: "scope.crm.team", label: "Escopo CRM: time", description: "Acessa conversas do próprio time.", group: "ESCOPO" },
  { key: "scope.crm.all", label: "Escopo CRM: global", description: "Acessa todas as conversas.", group: "ESCOPO" },
  { key: "scope.operacional.unit.self", label: "Escopo Operacional: unidade vinculada", description: "Acessa dados da unidade vinculada.", group: "ESCOPO" },
  { key: "scope.operacional.all", label: "Escopo Operacional: global", description: "Acessa todas as unidades operacionais.", group: "ESCOPO" },
];

const LEGACY_ALIAS: Record<string, string[]> = {
  "tab.crm.chat.view": ["VIEW_CRM_CHAT"],
  "tab.crm.funil.view": ["VIEW_CRM_FUNIL"],
  "tab.crm.dashboard.view": ["VIEW_CRM_DASHBOARD"],
  "tab.operacional.pendencias.view": ["VIEW_PENDENCIAS"],
  "tab.operacional.criticos.view": ["VIEW_CRITICOS"],
  "tab.operacional.em_busca.view": ["VIEW_EM_BUSCA"],
  "tab.operacional.ocorrencias.view": ["VIEW_OCORRENCIAS", "VIEW_TAD"],
  "tab.operacional.concluidos.view": ["VIEW_CONCLUIDOS"],
  "operacional.assignment.assign": ["ASSIGN_OPERATIONAL_PENDING"],
  "operacional.assignment.unassign": ["RETURN_OPERATIONAL_PENDING"],
  "operacional.notes.edit": ["EDIT_NOTES"],
  "scope.crm.self": ["CRM_SCOPE_SELF"],
  "scope.crm.team": ["CRM_SCOPE_TEAM"],
  "scope.crm.all": ["CRM_SCOPE_ALL"],
};

export function hasPermissionWithAliases(userPermissions: string[] | null | undefined, needed: string) {
  const perms = (userPermissions || []).map((p) => String(p).trim()).filter(Boolean);
  if (!needed) return true;
  if (perms.includes(needed)) return true;
  if (perms.includes("*") || perms.includes("admin.*")) return true;
  const [namespace] = needed.split(".");
  if (namespace && perms.includes(`${namespace}.*`)) return true;
  const aliases = LEGACY_ALIAS[needed] || [];
  if (aliases.some((a) => perms.includes(a))) return true;
  return false;
}
