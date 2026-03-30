import Papa from 'papaparse';
import { URLS } from '../constants';
import { CteData, NoteData, UserData, ProfileData, GlobalData, ProcessData } from '../types';

// Helper to fetch and parse CSV with aggressive cache busting
const fetchCsv = async <T>(url: string, config: { header: boolean } = { header: true }): Promise<T[]> => {
  try {
    // Cache Busting: Adiciona timestamp único para evitar cache do navegador/CDN
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}_t=${Date.now()}`;

    // REMOVED: Custom headers (Cache-Control, Pragma, Expires) cause CORS errors with Google Sheets.
    // The timestamp query parameter is sufficient to bypass the cache.
    const response = await fetch(finalUrl, {
      method: 'GET'
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const csvText = await response.text();

    // Validação: Google Sheets retorna HTML se a planilha não for pública ou houver erro
    if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('<html')) {
        console.error(`Erro: Recebido HTML em vez de CSV da URL ${url}. Verifique se a planilha está publicada na web.`);
        return [];
    }

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: config.header,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data as T[]),
        error: (error: Error) => {
             console.error(`Erro parsing CSV ${url}:`, error);
             reject(error);
        },
      });
    });
  } catch (error) {
    console.error(`Error fetching CSV from ${url}:`, error);
    // Retorna array vazio para não quebrar o Promise.all
    return [];
  }
};

const normalizeCteData = (raw: any[]): CteData[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(row => ({
    CTE: row.CTE || row.cte || row['NUMERO_CTE'] || '',
    SERIE: row.SERIE || row.serie || '',
    CODIGO: row.CODIGO || row.codigo || '',
    DATA_EMISSAO: row['DATA EMISSAO'] || row.data_emissao || row.DATA_EMISSAO || '',
    PRAZO_BAIXA_DIAS: row['PRAZO PARA BAIXA (DIAS)'] || row.PRAZO_BAIXA_DIAS || '',
    DATA_LIMITE_BAIXA: row['DATA LIMITE DE BAIXA'] || row.DATA_LIMITE_BAIXA || row.DATA_LIMITE || row.VENCIMENTO || '',
    STATUS: row.STATUS || '',
    COLETA: row.COLETA || row.ORIGEM || '',
    ENTREGA: row.ENTREGA || row.DESTINO || '',
    VALOR_CTE: row['VALOR DO CTE'] || row.VALOR_CTE || row.VALOR || row['VALOR (R$)'] || row.Valor || '0', 
    TX_ENTREGA: row.TX_ENTREGA || '',
    VOLUMES: row.VOLUMES || '',
    PESO: row.PESO || '',
    FRETE_PAGO: row.FRETE_PAGO || '',
    DESTINATARIO: row.DESTINATARIO || row.CLIENTE || '',
    JUSTIFICATIVA: row.JUSTIFICATIVA || ''
  })).filter(item => item.CTE); // Filtra linhas vazias sem CTE
};

const normalizeNotes = (raw: any[]): NoteData[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(row => {
    const rawId = row.ID || row.id || row.Id || '';
    return {
      ID: String(rawId), 
      CTE: row.CTE || row.cte || '',
      SERIE: row.SERIE || row.serie || '',
      CODIGO: row.CODIGO || row.codigo || '',
      DATA: row.DATA || row.data || '',
      USUARIO: row.USUARIO || row.usuario || 'Sistema',
      TEXTO: row.TEXTO || row.texto || '',
      LINK_IMAGEM: row.LINK_IMAGEM || row.link_imagem || '',
      STATUS_BUSCA: row.STATUS_BUSCA || row.status_busca || row.STATUS || row.status || '',
      pending: false
    };
  }).filter(n => n.ID !== '' && n.CTE);
};

const normalizeUsers = (raw: any[]): UserData[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(row => ({
    username: row.username || row.USERNAME || '',
    password: row.password || row.PASSWORD || '',
    role: row.role || row.ROLE || '',
    linkedOriginUnit: row.linkedOriginUnit || '',
    linkedDestUnit: row.linkedDestUnit || ''
  })).filter(u => u.username);
};

const normalizeProfiles = (raw: any[]): ProfileData[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(row => {
    let perms: string[] = [];
    const rawPerms = row.permissions || row.PERMISSIONS;
    if (typeof rawPerms === 'string') {
      perms = rawPerms.split(',').map((p: string) => p.trim()).filter(Boolean);
    }

    return {
      name: row.name || row.NAME || '',
      description: row.description || row.DESCRIPTION || '',
      permissions: perms
    };
  }).filter(p => p.name);
};

const normalizeProcess = (raw: any[]): ProcessData[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(row => ({
    ID: row.ID || row.id || '',
    CTE: row.CTE || row.cte || '',
    SERIE: row.SERIE || row.serie || '',
    DATA: row.DATA || row.data || '',
    USER: row.USER || row.user || row.USUARIO || '',
    DESCRIPTION: row.DESCRIPTION || row.description || '',
    LINK: row.LINK || row.link || row.LINK_IMAGEM || '',
    STATUS: row.STATUS || row.status || ''
  })).filter(p => p.ID);
};

export const fetchSheetData = async () => {
  try {
      const [baseRaw, notesRaw, usersRaw, profilesRaw, globalRaw, processRaw] = await Promise.all([
        fetchCsv<any>(URLS.BASE),
        fetchCsv<any>(URLS.NOTES),
        fetchCsv<any>(URLS.USERS),
        fetchCsv<any>(URLS.PROFILES),
        fetchCsv<any>(URLS.DATA, { header: false }),
        fetchCsv<any>(URLS.PROCESS_CONTROL),
      ]);

      const base = normalizeCteData(baseRaw);
      const notes = normalizeNotes(notesRaw);
      const users = normalizeUsers(usersRaw);
      const profiles = normalizeProfiles(profilesRaw);
      const process = normalizeProcess(processRaw);

      const data: GlobalData = { today: '', tomorrow: '', deadlineDays: 2 };
      
      if (globalRaw && Array.isArray(globalRaw) && globalRaw.length >= 3) {
          const rows = globalRaw as unknown as string[][];
          data.today = rows[0]?.[1] || '';
          data.tomorrow = rows[1]?.[1] || '';
          const days = parseInt(rows[2]?.[1]);
          data.deadlineDays = isNaN(days) ? 2 : days;
      }

      return { base, notes, users, profiles, data, process };
  } catch (err) {
      console.error("Falha crítica ao carregar dados:", err);
      // Retorna estrutura vazia em caso de falha total para não quebrar a UI
      return { base: [], notes: [], users: [], profiles: [], data: { today: '', tomorrow: '', deadlineDays: 0 }, process: [] };
  }
};

export const postToSheet = async (action: string, payload: any) => {
  // Envia como string JSON para corresponder ao e.postData.contents no Apps Script
  const body = JSON.stringify({
    action: action,
    payload: payload
  });

  try {
    const response = await fetch(URLS.APP_SCRIPT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: body,
      redirect: 'follow'
    });
    
    // Lê primeiro como texto para evitar crash em erros HTML
    const responseText = await response.text();
    
    try {
        const json = JSON.parse(responseText);
        return json.success !== false;
    } catch (parseError) {
        console.warn("Resposta não-JSON do servidor:", responseText);
        if (responseText.includes('Success') || responseText.includes('true')) {
            return true;
        }
        throw new Error("Formato de resposta inválido do servidor: " + responseText.substring(0, 100));
    }
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};