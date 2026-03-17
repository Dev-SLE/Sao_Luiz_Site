
export interface CteData {
  CTE: string;
  SERIE: string;
  CODIGO: string;
  DATA_EMISSAO: string;
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
  STATUS_CALCULADO?: 'FORA DO PRAZO' | 'CRÍTICO' | 'PRIORIDADE' | 'VENCE AMANHÃ' | 'NO PRAZO';
  IS_HISTORICAL?: boolean; // Flag to indicate if data comes from history/logs
  NOTE_COUNT?: number; // opcional (server-side), para badge na tabela sem carregar todas as notas
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
  TAD = 'tad',
  CONFIGURACOES = 'configuracoes',
  MUDAR_SENHA = 'mudar_senha',
}

export interface KPIData {
  total: number;
  totalValue: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}
