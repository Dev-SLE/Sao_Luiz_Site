
export interface CteData {
  CTE: string;
  SERIE: string;
  CODIGO: string;
  DATA_EMISSAO: string;
  DATA_BAIXA?: string;
  PRAZO_BAIXA_DIAS: string;
  DATA_LIMITE_BAIXA: string;
  STATUS: string;
  COLETA: string;
  ENTREGA: string; // UNIDADE DE DESTINO
  VALOR_CTE: string;
  TX_ENTREGA: string;
  VOLUMES: string;
  PESO: string;
  FRETE_PAGO: string;
  DESTINATARIO: string;
  JUSTIFICATIVA: string;
  STATUS_CALCULADO?:
    | 'CALCULANDO...'
    | 'FORA DO PRAZO'
    | 'CRÍTICO'
    | 'PRIORIDADE'
    | 'VENCE AMANHÃ'
    | 'NO PRAZO'
    | 'CONCLUIDO (SEM LIMITE)'
    | 'CONCLUIDO CRÍTICO'
    | 'CONCLUIDO FORA DO PRAZO'
    | 'CONCLUIDO NO PRAZO';
  IS_HISTORICAL?: boolean; // Flag to indicate if data comes from history/logs
  NOTE_COUNT?: number; // opcional (server-side), para badge na tabela sem carregar todas as notas
  ASSIGNMENT_TYPE?: string;
  ASSIGNMENT_AGENCY_UNIT?: string;
  ASSIGNED_USERNAME?: string;
  ASSIGNMENT_UPDATED_AT?: string;
}

export interface NoteData {
  ID: string;
  CTE: string;
  SERIE: string;
  CODIGO: string;
  DATA: string;
  USUARIO: string;
  TEXTO: string;
  LINK_IMAGEM: string;
  STATUS_BUSCA: string;
  pending?: boolean; // Flag visual para indicar carregamento
}

export interface ProcessData {
  ID: string;
  CTE: string;
  SERIE: string;
  DATA: string;
  USER: string;
  DESCRIPTION: string;
  LINK: string;
  STATUS: string;
}

export interface UserData {
  username: string;
  password?: string;
  role: string;
  linkedOriginUnit: string;
  linkedDestUnit: string;
  /** Nome da vendedora no BI; quando preenchido, o usuário só vê dados dessa vendedora nos painéis aplicáveis. */
  linkedBiVendedora?: string;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
}

export interface ProfileData {
  name: string;
  description: string;
  permissions: string[];
}

export interface GlobalData {
  today: string;
  tomorrow: string;
  deadlineDays: number;
}

export enum Page {
  DASHBOARD = 'dashboard',
  PENDENCIAS = 'pendencias',
  CRITICOS = 'criticos',
  EM_BUSCA = 'em_busca',
  OCORRENCIAS = 'ocorrencias',
  RASTREIO_OPERACIONAL = 'rastreio_operacional',
  CONCLUIDOS = 'concluidos',
  CRM_DASHBOARD = 'crm_dashboard',
  CRM_FUNIL = 'crm_funil',
  CRM_CHAT = 'crm_chat',
  CRM_OPS = 'crm_ops',
  CRM_TASKS = 'crm_tasks',
  CRM_REPORTS = 'crm_reports',
  CRM_CONTACT_360 = 'crm_contact_360',
  CRM_PRIVACY = 'crm_privacy',
  CONFIGURACOES = 'configuracoes',
  SOFIA_CONFIG = 'sofia_config',
  COMERCIAL_AUDITORIA = 'comercial_auditoria',
  COMERCIAL_ROBO_SUPREMO = 'comercial_robo_supremo',
  RELATORIOS = 'relatorios',
  MUDAR_SENHA = 'mudar_senha',
  /** Módulos com shell placeholder até migração completa (fase_1). */
  MODULE_MANIFESTOS = 'module_manifestos',
  MODULE_CLIENTES = 'module_clientes',
  MODULE_PATRIMONIO = 'module_patrimonio',
  MODULE_FINANCEIRO = 'module_financeiro',
  MODULE_FISCAL = 'module_fiscal',
  MODULE_RH = 'module_rh',
  MODULE_COMPRAS = 'module_compras',
  MODULE_JURIDICO = 'module_juridico',
  MODULE_GERENCIAL = 'module_gerencial',
  /** BI comissões (schema bi, COMERCIAL_DATABASE_URL). */
  GERENCIAL_COMISSOES_BI = 'gerencial_comissoes_bi',
  /** Holerite de comissões (impressão / detalhe). */
  GERENCIAL_COMISSOES_HOLERITE = 'gerencial_comissoes_holerite',
  MODULE_AUDITORIA_APP = 'module_auditoria_app',
  /** Rotas fora de `/app` — portal colaborador (`/inicio`, `/comunicados`, …). */
  PORTAL_COLABORADOR = 'portal_colaborador',
  /** Rotas `/gestor` e subpáginas. */
  PORTAL_GESTOR = 'portal_gestor',
}

export interface KPIData {
  total: number;
  totalValue: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}
