// Cliente para API (mesmo domínio no Next.js, ou override via env)
const API_BASE_URL =
  (typeof process !== 'undefined' && (process.env as any)?.NEXT_PUBLIC_API_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  '/api';

// Por enquanto, vamos usar uma abordagem simplificada sem autenticação JWT
// TODO: Configurar Neon Auth corretamente no painel
export interface AuthUser {
  id?: string;
  email?: string;
  username: string;
  role: string;
  origin?: string;
  dest?: string;
}

export interface AuthResponse {
  user: AuthUser;
  success: boolean;
}

export class NeonDataClient {
  private apiKey: string | null = null;

  // Login real via backend Express
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw new Error('Credenciais inválidas');
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Credenciais inválidas');
    }
    return data;
  }

  async logout(): Promise<void> {
    this.apiKey = null;
  }


  // Método para buscar dados com paginação
  async fetchData(endpoint: string, params?: { page?: number, limit?: number }): Promise<any> {
    try {
      let url = `${API_BASE_URL}${endpoint}`;
      if (params && (params.page || params.limit)) {
        const usp = new URLSearchParams();
        if (params.page) usp.append('page', params.page.toString());
        if (params.limit) usp.append('limit', params.limit.toString());
        url += `?${usp.toString()}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      return { data: [], total: 0 };
    }
  }

  async postJson(endpoint: string, body: any): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }
    return response.json();
  }

  // Métodos específicos para cada tabela

  async getCtes(page = 1, limit = 50): Promise<{ data: any[], total: number }> {
    return this.fetchData('/ctes', { page, limit });
  }

  async getCtesView(view: 'pendencias' | 'criticos' | 'em_busca' | 'tad', page = 1, limit = 50): Promise<{ data: any[], total: number }> {
    const endpoint = `/ctes_view?view=${encodeURIComponent(view)}&page=${page}&limit=${limit}`;
    return this.fetchData(endpoint);
  }

  async getCtesViewCounts(payload: {
    view: 'pendencias' | 'criticos' | 'em_busca' | 'tad';
    unit?: string;
    statusFilters?: string[];
    paymentFilters?: string[];
    noteFilter?: 'ALL' | 'WITH' | 'WITHOUT';
    filterTxEntrega?: boolean;
    ignoreUnitFilter?: boolean;
    userLinkedDestUnit?: string;
  }): Promise<any> {
    return this.postJson('/ctes_view_counts', payload);
  }

  async getNotesForCte(cte: string): Promise<any[]> {
    return this.fetchData(`/notes/${encodeURIComponent(cte)}`);
  }

  async getProcessForCteSerie(cte: string, serie: string): Promise<any[]> {
    const endpoint = `/process_control_by_cte?cte=${encodeURIComponent(cte)}&serie=${encodeURIComponent(serie)}`;
    return this.fetchData(endpoint);
  }

  async getNotes(page = 1, limit = 50): Promise<{ data: any[], total: number }> {
    return this.fetchData('/notes', { page, limit });
  }

  async getUsers(): Promise<any[]> {
    return this.fetchData('/users');
  }

  async getProfiles(): Promise<any[]> {
    return this.fetchData('/profiles');
  }


  async getProcessControl(page = 1, limit = 50): Promise<{ data: any[], total: number }> {
    return this.fetchData('/process_control', { page, limit });
  }

  async getGlobalSettings(): Promise<any[]> {
    return this.fetchData('/global_settings');
  }

  // Método para inserir dados
  async insertData(table: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/${table}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Erro ao inserir: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Erro ao inserir dados:', error);
      throw error;
    }
  }

  async addNote(note: any): Promise<any> {
    return this.insertData('notes', note);
  }

  async updateCte(cteId: string, updates: any): Promise<any> {
    // TODO: Implementar update via servidor local
    console.log('Update CTE não implementado ainda:', cteId, updates);
    return Promise.resolve();
  }
}

export const authClient = new NeonDataClient();
