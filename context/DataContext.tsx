import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { authClient } from '../lib/auth';
import { hasPermissionWithAliases } from '../lib/permissions';
import { CteData, NoteData, UserData, GlobalData, ProfileData, ProcessData } from '../types';
import { useAuth } from './AuthContext';

interface KPICounts {
  pendencias: number;
  criticos: number;
  emBusca: number;
  ocorrencias: number;
  concluidos: number;
}

interface Attachment {
  name: string;
  type: string;
  base64: string;
  file?: File; // arquivo bruto para upload direto
}

interface DataContextType {
  baseData: CteData[]; // mantém compatibilidade (aba atual pode usar)
  processedData: CteData[]; // mantém compatibilidade
  fullData: CteData[]; // mantém compatibilidade
  notes: NoteData[]; // notas globais não são mais carregadas em massa
  processControlData: ProcessData[]; // histórico global não é mais carregado em massa
  users: UserData[];
  profiles: ProfileData[];
  loading: boolean;
  refreshData: () => Promise<void>;
  filterStatus: string | null;
  setFilterStatus: (s: string | null) => void;
  filterDirection: 'all' | 'inbound' | 'outbound';
  setFilterDirection: (d: 'all' | 'inbound' | 'outbound') => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  addNote: (note: Omit<NoteData, 'ID'> & { attachments?: Attachment[]; occurrenceType?: string }) => Promise<any>;
  deleteNote: (id: string) => Promise<void>;
  resolveIssue: (cte: string, serie?: string, customText?: string) => Promise<void>;
  addUser: (user: UserData) => Promise<void>;
  deleteUser: (username: string) => Promise<void>;
  saveProfile: (profile: ProfileData) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
  globalData: GlobalData;
  isCteEmBusca: (cte: string, serie: string, originalStatus: string) => boolean;
  isCteOcorrencia: (cte: string, serie: string) => boolean;
  counts: KPICounts;
  getLatestNote: (cte: string) => NoteData | null;
  // Pagination setters
  setCtesPage: (page: number) => void;
  setCtesLimit: (limit: number) => void;
  setNotesPage: (page: number) => void;
  setNotesLimit: (limit: number) => void;
  setProcessPage: (page: number) => void;
  setProcessLimit: (limit: number) => void;
  // Pagination info
  ctesPage: number;
  ctesLimit: number;
  ctesTotal: number;
  notesPage: number;
  notesLimit: number;
  notesTotal: number;
  processPage: number;
  processLimit: number;
  processTotal: number;

  // Novos: dados paginados por aba
  pendencias: { data: CteData[]; page: number; limit: number; total: number };
  criticos: { data: CteData[]; page: number; limit: number; total: number };
  emBusca: { data: CteData[]; page: number; limit: number; total: number };
  ocorrencias: { data: CteData[]; page: number; limit: number; total: number };
  concluidos: { data: CteData[]; page: number; limit: number; total: number };

  setPendenciasPage: (page: number) => void;
  setPendenciasLimit: (limit: number) => void;
  setCriticosPage: (page: number) => void;
  setCriticosLimit: (limit: number) => void;
  setEmBuscaPage: (page: number) => void;
  setEmBuscaLimit: (limit: number) => void;
  setOcorrenciasPage: (page: number) => void;
  setOcorrenciasLimit: (limit: number) => void;
  setConcluidosPage: (page: number) => void;
  setConcluidosLimit: (limit: number) => void;

  // Permissões do perfil (role -> profiles.permissions)
  hasPermission: (perm: string) => boolean;
}

const isValid = (d: any): boolean => d instanceof Date && !isNaN(d.getTime());
const startOfDay = (d: Date): Date => {
  const newDate = new Date(d);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};
const addDays = (d: Date, amount: number): Date => {
  const newDate = new Date(d);
  newDate.setDate(newDate.getDate() + amount);
  return newDate;
};
const isAfter = (d1: Date, d2: Date): boolean => d1.getTime() > d2.getTime();
const isEqual = (d1: Date, d2: Date): boolean => d1.getTime() === d2.getTime();

const parseCustom = (dateStr: string, formatStr: string): Date | null => {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  let day, month, year;
  if (formatStr.startsWith('d')) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      let yStr = parts[2];
      if (yStr.length === 2) yStr = "20" + yStr;
      year = parseInt(yStr, 10);
  } else if (formatStr.startsWith('y')) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
  } else return null;
  const d = new Date(year, month, day);
  return (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) ? d : null;
};

const parseISOLocal = (s: string): Date => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(s);
};

const DataContext = createContext<DataContextType | undefined>(undefined);


export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // Estados para paginação
  const [ctesPage, setCtesPage] = useState(1);
  const [ctesLimit, setCtesLimit] = useState(50);
  const [ctesTotal, setCtesTotal] = useState(0);
  const [notesPage, setNotesPage] = useState(1);
  const [notesLimit, setNotesLimit] = useState(50);
  const [notesTotal, setNotesTotal] = useState(0);
  const [processPage, setProcessPage] = useState(1);
  const [processLimit, setProcessLimit] = useState(50);
  const [processTotal, setProcessTotal] = useState(0);

  const [baseData, setBaseData] = useState<CteData[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [processControlData, setProcessControlData] = useState<ProcessData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [globalData, setGlobalData] = useState<GlobalData>({ today: '', tomorrow: '', deadlineDays: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDirection, setFilterDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [processedData, setProcessedData] = useState<CteData[]>([]);
  const [fullData, setFullData] = useState<CteData[]>([]);
  const [counts, setCounts] = useState<KPICounts>({ pendencias: 0, criticos: 0, emBusca: 0, ocorrencias: 0, concluidos: 0 });

  const [pendenciasState, setPendenciasState] = useState<{ data: CteData[]; page: number; limit: number; total: number }>({ data: [], page: 1, limit: 50, total: 0 });
  const [criticosState, setCriticosState] = useState<{ data: CteData[]; page: number; limit: number; total: number }>({ data: [], page: 1, limit: 50, total: 0 });
  const [emBuscaState, setEmBuscaState] = useState<{ data: CteData[]; page: number; limit: number; total: number }>({ data: [], page: 1, limit: 50, total: 0 });
  const [ocorrenciasState, setOcorrenciasState] = useState<{ data: CteData[]; page: number; limit: number; total: number }>({ data: [], page: 1, limit: 50, total: 0 });
  const [concluidosState, setConcluidosState] = useState<{ data: CteData[]; page: number; limit: number; total: number }>({ data: [], page: 1, limit: 50, total: 0 });

  const setPendenciasPage = (page: number) => setPendenciasState(s => ({ ...s, page }));
  const setPendenciasLimit = (limit: number) => setPendenciasState(s => ({ ...s, limit, page: 1 }));
  const setCriticosPage = (page: number) => setCriticosState(s => ({ ...s, page }));
  const setCriticosLimit = (limit: number) => setCriticosState(s => ({ ...s, limit, page: 1 }));
  const setEmBuscaPage = (page: number) => setEmBuscaState(s => ({ ...s, page }));
  const setEmBuscaLimit = (limit: number) => setEmBuscaState(s => ({ ...s, limit, page: 1 }));
  const setOcorrenciasPage = (page: number) => setOcorrenciasState(s => ({ ...s, page }));
  const setOcorrenciasLimit = (limit: number) => setOcorrenciasState(s => ({ ...s, limit, page: 1 }));
  const setConcluidosPage = (page: number) => setConcluidosState(s => ({ ...s, page }));
  const setConcluidosLimit = (limit: number) => setConcluidosState(s => ({ ...s, limit, page: 1 }));

  const currentProfile = useMemo(() => {
    const roleName = (user?.role || '').trim();
    if (!roleName) return null;
    return profiles.find(p => (p.name || '').toLowerCase() === roleName.toLowerCase()) || null;
  }, [profiles, user?.role]);

  const hasPermission = (perm: string) => {
    const roleName = (user?.role || '').trim().toLowerCase();
    if (roleName === 'admin') return true;
    if (!perm) return true;
    return hasPermissionWithAliases(currentProfile?.permissions || [], perm) || !!currentProfile?.permissions?.includes(perm);
  };

  const normalizeCtes = (rows: any[]): CteData[] =>
    (rows || []).map((row: any) => ({
      CTE: row.cte || '',
      SERIE: row.serie || '',
      CODIGO: row.codigo || '',
      DATA_EMISSAO: row.data_emissao || '',
      DATA_BAIXA: row.data_baixa || '',
      PRAZO_BAIXA_DIAS: row.prazo_baixa_dias?.toString() || '',
      DATA_LIMITE_BAIXA: row.data_limite_baixa || '',
      STATUS: row.status || '',
      STATUS_CALCULADO: (row.status_calculado || undefined) as any,
      COLETA: row.coleta || '',
      ENTREGA: row.entrega || '',
      VALOR_CTE: row.valor_cte?.toString() || '',
      TX_ENTREGA: row.tx_entrega || '',
      VOLUMES: row.volumes || '',
      PESO: row.peso || '',
      FRETE_PAGO: row.frete_pago || '',
      DESTINATARIO: row.destinatario || '',
      JUSTIFICATIVA: row.justificativa || '',
      NOTE_COUNT: typeof row.note_count === 'number' ? row.note_count : parseInt(row.note_count || '0') || 0,
      ASSIGNMENT_TYPE: row.assignment_type || '',
      ASSIGNMENT_AGENCY_UNIT: row.agency_unit || '',
      ASSIGNED_USERNAME: row.assigned_username || '',
      ASSIGNMENT_UPDATED_AT: row.assignment_updated_at || '',
    }));


  // Função para atualizar dados paginados
  const refreshData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        dashboardResp,
        pendResp,
        critResp,
        buscaResp,
        ocorrResp,
        conclResp,
        usersData,
      ] = await Promise.all([
        authClient.getCtesDashboard(1, 10000),
        authClient.getCtesView('pendencias', pendenciasState.page, pendenciasState.limit),
        authClient.getCtesView('criticos', criticosState.page, criticosState.limit),
        authClient.getCtesView('em_busca', emBuscaState.page, emBuscaState.limit),
        authClient.getCtesView('ocorrencias', ocorrenciasState.page, ocorrenciasState.limit),
        authClient.getCtesView('concluidos', concluidosState.page, concluidosState.limit),
        authClient.getUsers(),
      ]);

      const dashboardData = normalizeCtes(dashboardResp.data || []);

      const pendenciasData = normalizeCtes(pendResp.data || []);
      const criticosData = normalizeCtes(critResp.data || []);
      const emBuscaData = normalizeCtes(buscaResp.data || []);
      const ocorrenciasData = normalizeCtes(ocorrResp.data || []);
      const concluidosData = normalizeCtes(conclResp.data || []);

      const normalizedUsers = usersData.map((row: any) => ({
        username: row.username || '',
        password: row.password_hash || '',
        role: row.role || '',
        linkedOriginUnit: row.linked_origin_unit || '',
        linkedDestUnit: row.linked_dest_unit || '',
        lastLoginAt: row.last_login_at || '',
      }));

      // Compatibilidade: baseData/fullData/processedData = pendências COMPLETAS (para dashboards)
      setBaseData(dashboardData);
      setFullData(dashboardData);
      setProcessedData(dashboardData);

      // Não carregar notas/processo globais (pesado). Usaremos endpoints específicos quando abrir o modal.
      setNotes([]);
      setProcessControlData([]);
      setUsers(normalizedUsers);

      const profilesRaw = await authClient.getProfiles();
      const normalizedProfiles: ProfileData[] = (profilesRaw || []).map((row: any) => ({
        name: row.name || '',
        description: row.description || '',
        permissions: Array.isArray(row.permissions) ? row.permissions : (typeof row.permissions === 'string' ? row.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : []),
      })).filter((p: ProfileData) => p.name);
      setProfiles(normalizedProfiles);
      setGlobalData({ today: '', tomorrow: '', deadlineDays: 2 }); // Implementar depois

      setPendenciasState(s => ({ ...s, data: pendenciasData, total: pendResp.total || 0 }));
      setCriticosState(s => ({ ...s, data: criticosData, total: critResp.total || 0 }));
      setEmBuscaState(s => ({ ...s, data: emBuscaData, total: buscaResp.total || 0 }));
      setOcorrenciasState(s => ({ ...s, data: ocorrenciasData, total: ocorrResp.total || 0 }));
      setConcluidosState(s => ({ ...s, data: concluidosData, total: conclResp.total || 0 }));

      setCounts({
        pendencias: pendResp.total || 0,
        criticos: critResp.total || 0,
        emBusca: buscaResp.total || 0,
        ocorrencias: ocorrResp.total || 0,
        concluidos: conclResp.total || 0,
      });

      // Mantém os campos antigos (não usados com server-side)
      setCtesTotal(pendResp.total || 0);
      setNotesTotal(0);
      setProcessTotal(0);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshViewPage = async (
    view: 'pendencias' | 'criticos' | 'em_busca' | 'ocorrencias' | 'concluidos',
    page: number,
    limit: number,
    setState: React.Dispatch<React.SetStateAction<{ data: CteData[]; page: number; limit: number; total: number }>>,
    countKey: keyof KPICounts
  ) => {
    if (!user) return;
    try {
      const resp = await authClient.getCtesView(view, page, limit);
      const pageData = normalizeCtes(resp.data || []);
      setState(s => ({ ...s, data: pageData, total: resp.total || 0 }));
      setCounts(prev => ({ ...prev, [countKey]: resp.total || 0 }));
    } catch (error) {
      console.error(`Erro ao carregar paginação (${view}):`, error);
    }
  };


  useEffect(() => {
    if (user) refreshData();
  }, [
    user
  ]);

  // Recarrega SOMENTE a aba que mudou (melhor performance na paginação).
  useEffect(() => {
    if (user) refreshViewPage('pendencias', pendenciasState.page, pendenciasState.limit, setPendenciasState, 'pendencias');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendenciasState.page, pendenciasState.limit]);

  useEffect(() => {
    if (user) refreshViewPage('criticos', criticosState.page, criticosState.limit, setCriticosState, 'criticos');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, criticosState.page, criticosState.limit]);

  useEffect(() => {
    if (user) refreshViewPage('em_busca', emBuscaState.page, emBuscaState.limit, setEmBuscaState, 'emBusca');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, emBuscaState.page, emBuscaState.limit]);

  useEffect(() => {
    if (user) refreshViewPage('ocorrencias', ocorrenciasState.page, ocorrenciasState.limit, setOcorrenciasState, 'ocorrencias');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ocorrenciasState.page, ocorrenciasState.limit]);

  useEffect(() => {
    if (user) refreshViewPage('concluidos', concluidosState.page, concluidosState.limit, setConcluidosState, 'concluidos');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, concluidosState.page, concluidosState.limit]);

  const getLatestNote = (_cte: string) => null;

  const isCteOcorrencia = (cte: string, serie: string) => {
    const normalize = (v: string) => String(v || '').replace(/^0+/, '') || '0';
    const row = baseData.find((c) => c.CTE === cte && normalize(c.SERIE || '0') === normalize(serie || '0'));
    const status = String(row?.STATUS || '').toUpperCase();
    return status.includes('OCORR');
  };

  const isCteEmBusca = (_cte: string, _serie: string, originalStatus: string) => originalStatus === 'EM BUSCA';

  // Com paginação server-side, `baseData/fullData/processedData` já chegam prontos (por aba)
  // e os counts vêm do backend. Mantemos os estados antigos por compatibilidade.
  useEffect(() => {
    setProcessedData(baseData);
    setFullData(baseData);
  }, [baseData]);

  const addNote = async (notePayload: Omit<NoteData, 'ID'> & { attachments?: Attachment[]; occurrenceType?: string }) => {
    const now = new Date();
    const formattedDate = now.toISOString();
    try {
      let links: string[] = [];
      // Upload de arquivos para o backend
      if (notePayload.attachments && notePayload.attachments.length > 0) {
        for (const file of notePayload.attachments) {
          const formData = new FormData();
          // Se tivermos o arquivo bruto, usamos diretamente (mais seguro)
          if (file.file instanceof File) {
            formData.append('file', file.file, file.name);
          } else {
            // Fallback: converter base64 dataURL para Blob, se estiver bem formatado
            const parts = file.base64?.split(',');
            if (!parts || parts.length < 2) {
              console.warn('Base64 inválido para upload, ignorando arquivo:', file.name);
              continue;
            }
            const base64Data = parts[1];
            const mime = file.type || 'application/octet-stream';
            try {
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mime });
              formData.append('file', blob, file.name);
            } catch (e) {
              console.error('Falha ao decodificar base64, ignorando arquivo:', file.name, e);
              continue;
            }
          }
          formData.append('username', user?.username || ''); // Passar username
          // Enviar para o backend
          const resp = await fetch('/api/uploadImage', {
            method: 'POST',
            body: formData
          });
          const data = await resp.json();
          if (data && data.url) links.push(data.url);
        }
      }
      // Criar nota no Neon
      const noteData = {
        cte: notePayload.CTE,
        serie: notePayload.SERIE || '',
        codigo: notePayload.CODIGO || '',
        usuario: notePayload.USUARIO,
        texto: notePayload.TEXTO || '',
        link_imagem: links.join(' , '),
        status_busca: notePayload.STATUS_BUSCA || '',
        data: formattedDate
      };
      const created = await authClient.addNote(noteData);
      try {
        await authClient.logEvent({
          event: 'CTE_NOTE_CREATED',
          username: notePayload.USUARIO,
          cte: notePayload.CTE,
          serie: notePayload.SERIE || '0',
          payload: { statusBusca: notePayload.STATUS_BUSCA || '', hasAttachments: links.length > 0 },
        });
      } catch {}

      // Se a nota estiver marcando EM BUSCA ou OCORRÊNCIA, também gravamos no process_control
      // para que o CTE mude de aba (cte_view_index) imediatamente.
      const statusBusca = (notePayload.STATUS_BUSCA || '').trim().toUpperCase();
      if (statusBusca === 'EM BUSCA') {
        await authClient.markAsInSearch({
          cte: notePayload.CTE,
          serie: notePayload.SERIE || '0',
          user: notePayload.USUARIO,
          description: notePayload.TEXTO || 'Marcado como EM BUSCA',
          link: links.join(' , '),
        });
        await authClient.logEvent({
          event: 'CTE_MARK_EM_BUSCA',
          username: notePayload.USUARIO,
          cte: notePayload.CTE,
          serie: notePayload.SERIE || '0',
          payload: { text: notePayload.TEXTO || '', links },
        });
      } else if (statusBusca === 'OCORRENCIA' || statusBusca === 'TAD') {
        await authClient.saveProcessData({
          cte: notePayload.CTE,
          serie: notePayload.SERIE || '0',
          user: notePayload.USUARIO,
          status: 'OCORRENCIA',
          description: notePayload.TEXTO || 'Ocorrência operacional',
          link: links.join(' , '),
        });
        await authClient.logEvent({
          event: 'CTE_MARK_OCORRENCIA',
          username: notePayload.USUARIO,
          cte: notePayload.CTE,
          serie: notePayload.SERIE || '0',
          payload: { text: notePayload.TEXTO || '', links },
        });
        try {
          const existing = await authClient.getOccurrences({
            cte: notePayload.CTE,
            serie: notePayload.SERIE || '0',
          });
          const hasAberta = (existing.items || []).some((row: { status?: string }) =>
            String(row.status || '').toUpperCase() === 'ABERTA'
          );
          if (!hasAberta) {
            const occType = String(notePayload.occurrenceType || 'OUTROS').toUpperCase();
            const desc = String(notePayload.TEXTO || 'Ocorrência operacional').trim();
            await authClient.createOccurrence({
              cte: notePayload.CTE,
              serie: notePayload.SERIE || '0',
              occurrenceType: occType,
              description: desc,
              createdBy: notePayload.USUARIO,
            });
          }
        } catch (e) {
          console.warn('createOccurrence paralelo:', e);
        }
      }

      await refreshData();
      return created;
    } catch (error) {
      console.error('Erro ao adicionar nota:', error);
      try {
        await authClient.logEvent({
          level: 'ERROR',
          event: 'ADD_NOTE_ERROR',
          username: notePayload?.USUARIO,
          cte: notePayload?.CTE,
          serie: notePayload?.SERIE,
          payload: { message: (error as any)?.message || String(error) },
        });
      } catch {}
      throw error;
    }
  };

  const deleteNote = async (id: string) => {
      await authClient.deleteNote(String(id));
  };

  const resolveIssue = async (cte: string, serie?: string, customText?: string) => {
      const targetSerie = serie || baseData.find(c => c.CTE === cte)?.SERIE || "0";
      const username = user?.username || "Sistema";
      const textMsg = customText || "RESOLVIDO: Mercadoria marcada como LOCALIZADA.";

      await authClient.stopAlarm({ cte, serie: targetSerie, user: username, description: textMsg });
      await authClient.addNote({
        cte,
        serie: targetSerie,
        codigo: "0",
        usuario: username,
        texto: textMsg,
        link_imagem: "",
        status_busca: "RESOLVIDO",
      });
      await authClient.logEvent({
        event: 'CTE_RESOLVE',
        username,
        cte,
        serie: targetSerie,
        payload: { text: textMsg },
      });
      await refreshData();
  };

  const addUser = async (u: UserData) => {
      await authClient.saveUser(u);
      try {
        await authClient.logEvent({
          event: 'USER_CREATE',
          username: user?.username || 'Sistema',
          payload: {
            targetUsername: u.username,
            role: u.role,
            linkedOriginUnit: u.linkedOriginUnit,
            linkedDestUnit: u.linkedDestUnit,
          },
        });
      } catch {}
      await refreshData();
  };
  const deleteUser = async (username: string) => {
      await authClient.deleteUser(username);
      try {
        await authClient.logEvent({
          event: 'USER_DELETE',
          username: user?.username || 'Sistema',
          payload: { targetUsername: username },
        });
      } catch {}
      await refreshData();
  };
  const saveProfile = async (p: ProfileData) => {
      await authClient.saveProfile(p);
      try {
        await authClient.logEvent({
          event: 'PROFILE_SAVE',
          username: user?.username || 'Sistema',
          payload: { name: p.name, description: p.description, permissions: p.permissions || [] },
        });
      } catch {}
      await refreshData();
  };
  const deleteProfile = async (name: string) => {
      await authClient.deleteProfile(name);
      try {
        await authClient.logEvent({
          event: 'PROFILE_DELETE',
          username: user?.username || 'Sistema',
          payload: { name },
        });
      } catch {}
      await refreshData();
  };

  return (
    <DataContext.Provider value={{ 
      baseData, 
      processedData, 
      fullData, 
      notes, 
      users, 
      profiles, 
      processControlData, 
      loading, 
      refreshData, 
      filterStatus, 
      setFilterStatus, 
      filterDirection, 
      setFilterDirection, 
      searchTerm, 
      setSearchTerm, 
      addNote, 
      deleteNote, 
      resolveIssue, 
      addUser, 
      deleteUser, 
      saveProfile, 
      deleteProfile, 
      globalData, 
      isCteEmBusca, 
      isCteOcorrencia, 
      counts, 
      getLatestNote,
      // Pagination setters
      setCtesPage,
      setCtesLimit,
      setNotesPage,
      setNotesLimit,
      setProcessPage,
      setProcessLimit,
      // Pagination info
      ctesPage,
      ctesLimit,
      ctesTotal,
      notesPage,
      notesLimit,
      notesTotal,
      processPage,
      processLimit,
      processTotal
      ,
      pendencias: pendenciasState,
      criticos: criticosState,
      emBusca: emBuscaState,
      ocorrencias: ocorrenciasState,
      concluidos: concluidosState
      ,
      setPendenciasPage,
      setPendenciasLimit,
      setCriticosPage,
      setCriticosLimit,
      setEmBuscaPage,
      setEmBuscaLimit,
      setOcorrenciasPage,
      setOcorrenciasLimit,
      setConcluidosPage,
      setConcluidosLimit
      ,
      hasPermission
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
};