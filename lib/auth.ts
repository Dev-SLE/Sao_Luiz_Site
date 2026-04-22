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
  biVendedora?: string;
  mustChangePassword?: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  success: boolean;
  /** Permissões do perfil retornadas no login (para fluxo pós-login sem round-trip extra). */
  permissions?: string[];
}

export class NeonDataClient {
  private apiKey: string | null = null;
  private cache = new Map<string, { expiresAt: number; data: any }>();

  private getApiBaseUrl() {
    const raw = String(API_BASE_URL || '/api').trim();
    const sanitized = raw.replace(/\/+$/, '');
    if (!sanitized) return '/api';
    // Se já veio com /api no final, não duplica.
    if (sanitized === '/api' || sanitized.endsWith('/api')) return sanitized;
    return `${sanitized}/api`;
  }

  private makeApiUrl(endpoint: string) {
    const base = this.getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${cleanEndpoint}`;
  }

  private async buildHttpError(prefix: string, response: Response) {
    let detail = '';
    try {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await response.json();
        detail = data?.error || data?.message || JSON.stringify(data);
      } else {
        detail = await response.text();
      }
    } catch {
      detail = '';
    }
    const suffix = detail ? ` - ${detail}` : '';
    return new Error(`${prefix}: ${response.status}${suffix}`);
  }

  // Login real via backend Express
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(this.makeApiUrl('/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      let detail = "Credenciais inválidas";
      try {
        const ct = response.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await response.json();
          detail = String(data?.message || data?.error || detail);
        }
      } catch {
        /* mantém mensagem padrão */
      }
      throw new Error(detail);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Credenciais inválidas');
    }
    return data;
  }

  async logout(): Promise<void> {
    this.apiKey = null;
    try {
      await fetch(this.makeApiUrl('/auth/session'), {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Não bloqueia logout local quando API falha.
    }
  }

  async getSession(): Promise<AuthResponse | null> {
    const response = await fetch(this.makeApiUrl('/auth/session'), {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.authenticated || !data?.user) return null;
    return { success: true, user: data.user };
  }


  // Método para buscar dados com paginação
  async fetchData(endpoint: string, params?: { page?: number, limit?: number }): Promise<any> {
    try {
      let url = this.makeApiUrl(endpoint);
      if (params && (params.page || params.limit)) {
        const usp = new URLSearchParams();
        if (params.page) usp.append('page', params.page.toString());
        if (params.limit) usp.append('limit', params.limit.toString());
        url += `?${usp.toString()}`;
      }
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw await this.buildHttpError('Erro na API', response);
      }
      return response.json();
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      return { data: [], total: 0 };
    }
  }

  private getCacheKey(url: string) {
    return `GET:${url}`;
  }

  private getCached(url: string) {
    const key = this.getCacheKey(url);
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return hit.data;
  }

  private setCached(url: string, data: any, ttlMs: number) {
    const key = this.getCacheKey(url);
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  private clearCache(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    const p = String(prefix).toLowerCase();
    for (const key of this.cache.keys()) {
      if (key.toLowerCase().includes(p)) this.cache.delete(key);
    }
  }

  async postJson(endpoint: string, body: any): Promise<any> {
    const url = this.makeApiUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
      throw await this.buildHttpError('Erro na API', response);
    }
    const json = await response.json();
    // Mutações invalidam caches correlatos para reduzir re-fetches inconsistentes.
    if (endpoint.includes('/crm/')) this.clearCache('/crm/');
    if (endpoint.includes('/ctes_') || endpoint.includes('/notes') || endpoint.includes('/process')) {
      this.clearCache('/ctes_');
      this.clearCache('/notes');
      this.clearCache('/process');
    }
    return json;
  }

  async logEvent(payload: {
    level?: 'INFO' | 'WARN' | 'ERROR';
    source?: string;
    event: string;
    username?: string;
    cte?: string;
    serie?: string;
    payload?: any;
  }): Promise<any> {
    return this.postJson('/app_logs', payload);
  }

  // Métodos específicos para cada tabela

  async getCtes(page = 1, limit = 50): Promise<{ data: any[], total: number }> {
    return this.fetchData('/ctes', { page, limit });
  }

  async getCtesView(view: 'pendencias' | 'criticos' | 'em_busca' | 'ocorrencias' | 'concluidos', page = 1, limit = 50): Promise<{ data: any[], total: number }> {
    const endpoint = `/ctes_view?view=${encodeURIComponent(view)}&page=${page}&limit=${limit}`;
    const url = this.makeApiUrl(endpoint);
    const cached = this.getCached(url);
    if (cached) return cached;
    const data = await this.fetchData(endpoint);
    this.setCached(url, data, 15_000);
    return data;
  }

  async getCtesDashboard(page = 1, limit = 10000): Promise<{ data: any[], total: number }> {
    const endpoint = `/ctes_dashboard?page=${page}&limit=${limit}`;
    const url = this.makeApiUrl(endpoint);
    const cached = this.getCached(url);
    if (cached) return cached;
    const data = await this.fetchData(endpoint);
    this.setCached(url, data, 20_000);
    return data;
  }

  async getCtesViewCounts(payload: {
    view: 'pendencias' | 'criticos' | 'em_busca' | 'ocorrencias' | 'concluidos';
    unit?: string;
    statusFilters?: string[];
    paymentFilters?: string[];
    noteFilter?: 'ALL' | 'WITH' | 'WITHOUT';
    filterTxEntrega?: boolean;
    ignoreUnitFilter?: boolean;
    userLinkedDestUnit?: string;
    userLinkedOriginUnit?: string;
    assignmentFilter?: 'ALL' | 'WITH' | 'WITHOUT';
    assignmentAgency?: string;
    assignmentUser?: string;
    assignmentMineOnly?: boolean;
    currentUsername?: string;
  }): Promise<any> {
    return this.postJson('/ctes_view_counts', payload);
  }

  async getCteAssignment(cte: string, serie: string): Promise<any> {
    const endpoint = `/cte_assignments?cte=${encodeURIComponent(cte)}&serie=${encodeURIComponent(serie || '0')}`;
    return this.fetchData(endpoint);
  }

  async upsertCteAssignment(payload: {
    cte: string;
    serie: string;
    agencyUnit: string;
    assignedUsername: string;
    notes?: string;
    actor?: string;
  }): Promise<any> {
    return this.postJson('/cte_assignments', payload);
  }

  async clearCteAssignment(payload: {
    cte: string;
    serie: string;
    actor?: string;
    reason: string;
  }): Promise<any> {
    const endpoint = `/cte_assignments?cte=${encodeURIComponent(payload.cte)}&serie=${encodeURIComponent(payload.serie || '0')}&actor=${encodeURIComponent(payload.actor || '')}&reason=${encodeURIComponent(payload.reason || '')}`;
    const response = await fetch(this.makeApiUrl(endpoint), { method: 'DELETE' });
    if (!response.ok) throw await this.buildHttpError('Erro na API', response);
    return response.json();
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
    const url = this.makeApiUrl('/users');
    const cached = this.getCached(url);
    const resp = cached || (await this.fetchData('/users'));
    if (!cached) this.setCached(url, resp, 30_000);
    return Array.isArray(resp) ? resp : (resp?.data || []);
  }

  async getProfiles(): Promise<any[]> {
    const url = this.makeApiUrl('/profiles');
    const cached = this.getCached(url);
    const resp = cached || (await this.fetchData('/profiles'));
    if (!cached) this.setCached(url, resp, 30_000);
    return Array.isArray(resp) ? resp : (resp?.data || []);
  }

  async getGoogleStatus(username: string): Promise<{ connected: boolean; expiry_date?: any }> {
    return this.fetchData(`/google_status?username=${encodeURIComponent(username || '')}`);
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
      const response = await fetch(this.makeApiUrl(`/${table}`), {
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

  async deleteNote(id: string): Promise<any> {
    return await fetch(`${this.makeApiUrl('/notes')}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.json());
  }

  async saveProcessData(payload: any): Promise<any> {
    return this.postJson('/process_control', payload);
  }

  async markAsInSearch(payload: any): Promise<any> {
    return this.postJson('/markAsInSearch', payload);
  }

  async stopAlarm(payload: any): Promise<any> {
    return this.postJson('/stopAlarm', payload);
  }

  async saveProfile(profile: any): Promise<any> {
    return this.postJson('/profiles', profile);
  }

  async deleteProfile(name: string): Promise<any> {
    const url = `${this.makeApiUrl('/profiles')}?name=${encodeURIComponent(name)}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
    return response.json();
  }

  async saveUser(user: any): Promise<any> {
    return this.postJson('/users', user);
  }

  async deleteUser(username: string): Promise<any> {
    const url = `${this.makeApiUrl('/users')}?username=${encodeURIComponent(username)}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
    return response.json();
  }

  async changePassword(payload: { username: string; currentPassword: string; newPassword: string }): Promise<any> {
    return this.postJson('/changePassword', payload);
  }

  // ----------------------------
  // CRM (Fase 1 - DB + rotas)
  // ----------------------------

  async getCrmBoard(params?: {
    requestUsername?: string | null;
    requestRole?: string | null;
    mineOnly?: boolean;
    teamId?: string | null;
  }): Promise<{
    pipeline: { id: string; name: string } | null;
    stages: Array<{ id: string; name: string; position: number }>;
    leads: Array<{
      id: string;
      title: string;
      phone?: string | null;
      email?: string | null;
      cte?: string | null;
      freteValue?: number;
      source: string;
      priority: string;
      currentLocation?: string | null;
      ownerUsername?: string | null;
      topic?: string | null;
      assignedTeamId?: string | null;
      assignedUsername?: string | null;
      assignmentMode?: string | null;
      protocolNumber?: string | null;
      mdfeDate?: string | null;
      routeOrigin?: string | null;
      routeDestination?: string | null;
      requestedAt?: string | null;
      serviceType?: string | null;
      cargoStatus?: string | null;
      customerStatus?: string | null;
      agencyId?: string | null;
      agencyRequestedAt?: string | null;
      agencySlaMinutes?: number | null;
      agencyName?: string | null;
      stageId: string;
      logs?: string[];
    }>;
    agencies?: Array<{
      id: string;
      name: string;
      city?: string | null;
      state?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      contactName?: string | null;
      serviceRegion?: string | null;
      avgResponseMinutes?: number | null;
      internalRating?: number | null;
      notes?: string | null;
    }>;
  }> {
    const usp = new URLSearchParams();
    if (params?.requestUsername) usp.set("requestUsername", params.requestUsername);
    if (params?.requestRole) usp.set("requestRole", params.requestRole);
    if (params?.mineOnly) usp.set("mineOnly", "true");
    if (params?.teamId) usp.set("teamId", params.teamId);
    const qs = usp.toString();
    const url = `${this.makeApiUrl('/crm/board')}${qs ? `?${qs}` : ""}`;
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar CRM board', resp);
    const data = await resp.json();
    this.setCached(url, data, 12_000);
    return data;
  }

  async createCrmLead(payload: any): Promise<any> {
    return this.postJson("/crm/leads", payload);
  }

  async updateCrmLead(payload: any): Promise<any> {
    const url = this.makeApiUrl('/crm/leads');
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    if (!response.ok) throw await this.buildHttpError('Erro na API', response);
    return response.json();
  }

  async deleteCrmLead(payload: { leadId: string; deletedByUsername?: string | null }): Promise<any> {
    const response = await fetch(`${this.makeApiUrl('/crm/leads')}?leadId=${encodeURIComponent(payload.leadId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deletedByUsername: payload.deletedByUsername ?? null,
      }),
    });
    if (!response.ok) throw await this.buildHttpError('Erro na API', response);
    return response.json();
  }

  async createCrmPipeline(payload: any): Promise<any> {
    return this.postJson("/crm/pipelines", payload);
  }

  async moveCrmLead(payload: {
    leadId: string;
    stageId?: string;
    ownerUsername?: string | null;
    action?: "REQUEST_AGENCY_RETURN" | string;
    agencyId?: string | null;
    slaMinutes?: number | null;
  }): Promise<any> {
    const url = this.makeApiUrl('/crm/leads/move');
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    if (!response.ok) throw await this.buildHttpError('Erro na API', response);
    return response.json();
  }

  async getCrmConversations(params?: {
    leadId?: string | null;
    requestUsername?: string | null;
    requestRole?: string | null;
    mineOnly?: boolean;
    teamId?: string | null;
  }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.leadId) usp.set("leadId", params.leadId);
    if (params?.requestUsername) usp.set("requestUsername", params.requestUsername);
    if (params?.requestRole) usp.set("requestRole", params.requestRole);
    if (params?.mineOnly) usp.set("mineOnly", "true");
    if (params?.teamId) usp.set("teamId", params.teamId);
    const qs = usp.toString();
    const url = `${this.makeApiUrl('/crm/conversations')}${qs ? `?${qs}` : ""}`;
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar conversas', resp);
    const data = await resp.json();
    this.setCached(url, data, 5_000);
    return data;
  }

  async createCrmConversation(payload: { leadId: string; channel?: string }): Promise<any> {
    return this.postJson("/crm/conversations", payload);
  }

  async updateCrmConversation(payload: {
    conversationId: string;
    status?: string;
    assignedUsername?: string | null;
    assignedTeamId?: string | null;
    assignmentMode?: string;
    lockAction?: "LOCK" | "UNLOCK" | "CLAIM";
    lockBy?: string | null;
    lockMinutes?: number;
    topic?: string;
  }): Promise<any> {
    const url = this.makeApiUrl('/crm/conversations');
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    if (!response.ok) throw await this.buildHttpError('Erro na API', response);
    this.clearCache("/crm/conversations");
    return response.json();
  }

  async getCrmMessages(conversationId: string): Promise<any> {
    const url = `${this.makeApiUrl('/crm/messages')}?conversationId=${encodeURIComponent(conversationId)}`;
    // Sem cache: mensagens precisam refletir o banco na hora (WhatsApp + Sofia).
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar mensagens', resp);
    return resp.json();
  }

  async sendCrmMessage(payload: {
    conversationId?: string | null;
    leadId?: string | null;
    channel?: string;
    senderType: string; // AGENTE/CLIENTE/IA
    body: string;
    senderUsername?: string | null;
    attachments?: Array<{ type?: string; filename?: string; url?: string }>;
    replyTo?: { messageId?: string; sender?: string; text?: string } | null;
  }): Promise<any> {
    return this.postJson("/crm/messages", payload);
  }

  async deleteCrmMessage(payload: {
    conversationId: string;
    messageId: string;
    /** true (padrão): tenta revogar também no WhatsApp Evolution quando elegível */
    deleteInWhatsapp?: boolean;
  }): Promise<any> {
    const deleteInWhatsapp = payload.deleteInWhatsapp !== false;
    const url = `${this.makeApiUrl('/crm/messages')}?conversationId=${encodeURIComponent(payload.conversationId)}&messageId=${encodeURIComponent(payload.messageId)}&deleteInWhatsapp=${deleteInWhatsapp ? "true" : "false"}`;
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) throw await this.buildHttpError('Erro na API', response);
    return response.json();
  }

  async getCrmAgents(): Promise<any> {
    const url = this.makeApiUrl('/crm/agents');
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar agentes CRM', resp);
    const data = await resp.json();
    this.setCached(url, data, 15_000);
    return data;
  }

  async getCrmTeams(): Promise<any> {
    const url = this.makeApiUrl('/crm/teams');
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar times CRM', resp);
    const data = await resp.json();
    this.setCached(url, data, 10_000);
    return data;
  }

  async getCrmWhatsappInboxes(params?: { provider?: string }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.provider) usp.set('provider', params.provider);
    const qs = usp.toString();
    const url = this.makeApiUrl(`/crm/whatsapp-inboxes${qs ? `?${qs}` : ''}`);
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar caixas WhatsApp', resp);
    return resp.json();
  }

  async saveCrmWhatsappInbox(payload: any): Promise<any> {
    return this.postJson('/crm/whatsapp-inboxes', payload);
  }

  async getCrmEvolutionIntakeSettings(): Promise<any> {
    const url = this.makeApiUrl('/crm/evolution-intake-settings');
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar triagem Evolution', resp);
    return resp.json();
  }

  async saveCrmEvolutionIntakeSettings(payload: {
    leadFilterMode: "OFF" | "BUSINESS_ONLY" | "AGENCY_ONLY";
    aiEnabled: boolean;
    minMessagesBeforeCreate: number;
    metaLeadFilterMode?: "OFF" | "BUSINESS_ONLY" | "AGENCY_ONLY";
    metaAiEnabled?: boolean;
    metaMinMessagesBeforeCreate?: number;
    allowlistLast10?: string;
    denylistLast10?: string;
  }): Promise<any> {
    return this.postJson('/crm/evolution-intake-settings', payload);
  }

  async getCrmEvolutionIntakeBuffer(params?: { limit?: number }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.limit) usp.set("limit", String(params.limit));
    const qs = usp.toString();
    const url = this.makeApiUrl(`/crm/evolution-intake-buffer${qs ? `?${qs}` : ""}`);
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar triagem pendente', resp);
    return resp.json();
  }

  async decideCrmEvolutionIntakeBuffer(payload: {
    action: "APPROVE" | "REJECT";
    bufferId: string;
    actor?: string | null;
  }): Promise<any> {
    return this.postJson('/crm/evolution-intake-buffer', payload);
  }

  async getOperationalNotifications(params?: { limit?: number }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.limit) usp.set("limit", String(params.limit));
    const qs = usp.toString();
    const url = this.makeApiUrl(`/operational-notifications${qs ? `?${qs}` : ""}`);
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError("Erro ao buscar notificações operacionais", resp);
    return resp.json();
  }

  async ackOperationalNotifications(lastLogId: number): Promise<any> {
    return this.postJson("/operational-notifications", { lastLogId });
  }

  async getOccurrences(params?: { cte?: string; serie?: string; leadId?: string }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.cte) usp.set("cte", params.cte);
    if (params?.serie) usp.set("serie", params.serie);
    if (params?.leadId) usp.set("leadId", params.leadId);
    const qs = usp.toString();
    return this.fetchData(`/occurrences${qs ? `?${qs}` : ""}`);
  }

  async createOccurrence(payload: {
    cte: string;
    serie?: string;
    occurrenceType: string;
    description: string;
    source?: string;
    leadId?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    createdBy?: string | null;
  }): Promise<any> {
    return this.postJson("/occurrences", payload);
  }

  async patchOccurrenceTrack(payload: { id: string; track: "INDENIZACAO" | "DOSSIE_DIRETO" }): Promise<any> {
    const response = await fetch(this.makeApiUrl("/occurrences"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao atualizar trilha da ocorrência", response);
    return response.json();
  }

  async getIndemnifications(occurrenceId?: string): Promise<{ items: any[] }> {
    const qs = occurrenceId ? `?occurrenceId=${encodeURIComponent(occurrenceId)}` : "";
    const response = await fetch(this.makeApiUrl(`/indemnifications${qs}`), { credentials: "include" });
    if (!response.ok) throw await this.buildHttpError("Erro ao buscar indenizações", response);
    return response.json();
  }

  async getIndemnificationById(id: string): Promise<{ item: any | null }> {
    const response = await fetch(this.makeApiUrl(`/indemnifications?id=${encodeURIComponent(id)}`), {
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao buscar indenização", response);
    return response.json();
  }

  async getIndemnificationWorkflow(indemnificationId: string): Promise<any> {
    const response = await fetch(
      this.makeApiUrl(`/indemnifications/workflow?indemnificationId=${encodeURIComponent(indemnificationId)}`),
      { credentials: "include" }
    );
    if (!response.ok) throw await this.buildHttpError("Erro ao carregar workflow", response);
    return response.json();
  }

  async postIndemnificationWorkflow(body: Record<string, unknown>): Promise<any> {
    const response = await fetch(this.makeApiUrl("/indemnifications/workflow"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro no workflow", response);
    return response.json();
  }

  async getCrmAgenciesList(): Promise<{ items: any[] }> {
    const response = await fetch(this.makeApiUrl("/crm/agencies-list"), { credentials: "include" });
    if (!response.ok) throw await this.buildHttpError("Erro ao listar agências", response);
    return response.json();
  }

  async getIndemnificationFollowups(indemnificationId: string): Promise<{ items: any[] }> {
    const response = await fetch(
      this.makeApiUrl(`/indemnifications/followups?indemnificationId=${encodeURIComponent(indemnificationId)}`),
      { credentials: "include" }
    );
    if (!response.ok) throw await this.buildHttpError("Erro ao carregar follow-ups", response);
    return response.json();
  }

  async postIndemnificationFollowup(payload: { indemnificationId: string; agencyId: string; expectedBy?: string }): Promise<any> {
    const response = await fetch(this.makeApiUrl("/indemnifications/followups"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao registrar agência", response);
    return response.json();
  }

  async patchIndemnificationFollowup(payload: { id: string; action: string; noteId?: number }): Promise<any> {
    const response = await fetch(this.makeApiUrl("/indemnifications/followups"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao atualizar follow-up", response);
    return response.json();
  }

  async getOcorrenciasNotifications(params?: { limit?: number }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.limit) usp.set("limit", String(params.limit));
    const qs = usp.toString();
    const response = await fetch(this.makeApiUrl(`/ocorrencias-notifications${qs ? `?${qs}` : ""}`), {
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao buscar notificações", response);
    return response.json();
  }

  async ackOcorrenciasNotifications(lastLogId: number): Promise<any> {
    const response = await fetch(this.makeApiUrl("/ocorrencias-notifications"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastLogId }),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao confirmar notificações", response);
    return response.json();
  }

  async finalizeDossier(payload: {
    cte: string;
    serie?: string;
    finalizationStatus: string;
    /** Envia o PDF finalizado para a pasta do processo no SharePoint. */
    syncPdf?: boolean;
    /** @deprecated use syncPdf */
    syncPdfToDrive?: boolean;
  }): Promise<any> {
    const { syncPdfToDrive, syncPdf, ...rest } = payload;
    const body = { ...rest, syncPdf: syncPdf ?? syncPdfToDrive };
    const response = await fetch(this.makeApiUrl("/dossie/finalize"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao finalizar dossiê", response);
    return response.json();
  }

  async uploadDossierAttachment(formData: FormData): Promise<any> {
    const response = await fetch(this.makeApiUrl("/dossie/attachments"), {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao enviar anexo", response);
    return response.json();
  }

  async sendDossieEmail(payload: { cte: string; serie?: string; to: string; subject?: string; text?: string }): Promise<any> {
    const response = await fetch(this.makeApiUrl("/dossie/send-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao enviar e-mail", response);
    return response.json();
  }

  async createIndemnification(payload: any): Promise<any> {
    return this.postJson("/indemnifications", payload);
  }

  async patchIndemnification(payload: {
    id: string;
    status?: string;
    notes?: string;
    amount?: number | null;
    facts?: string;
    responsibilities?: string;
    indemnification_body?: string;
    others?: string;
  }): Promise<any> {
    const response = await fetch(this.makeApiUrl("/indemnifications"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!response.ok) throw await this.buildHttpError("Erro ao atualizar indenização", response);
    return response.json();
  }

  async getDossier(cte: string, serie = "0"): Promise<any> {
    return this.fetchData(`/dossie?cte=${encodeURIComponent(cte)}&serie=${encodeURIComponent(serie)}`);
  }

  async listDossiers(): Promise<{ items: any[] }> {
    const response = await fetch(this.makeApiUrl("/dossie?list=1"), { credentials: "include" });
    if (!response.ok) throw await this.buildHttpError("Erro ao listar dossiês", response);
    return response.json();
  }

  async createDossier(payload: { cte: string; serie?: string; title?: string; generatedBy?: string }): Promise<any> {
    return this.postJson("/dossie", payload);
  }

  async saveCrmTeam(payload: any): Promise<any> {
    return this.postJson("/crm/teams", { ...payload, action: "UPSERT_TEAM" });
  }

  async deleteCrmTeam(id: string): Promise<any> {
    return this.postJson("/crm/teams", { action: "DELETE_TEAM", id });
  }

  async saveCrmTeamMember(payload: any): Promise<any> {
    return this.postJson("/crm/teams", { ...payload, action: "UPSERT_MEMBER" });
  }

  async deleteCrmTeamMember(id: string): Promise<any> {
    return this.postJson("/crm/teams", { action: "DELETE_MEMBER", id });
  }

  async removeCrmMemberFromTeam(payload: { username: string; teamId?: string | null }): Promise<any> {
    return this.postJson("/crm/teams", { action: "REMOVE_MEMBER_FROM_TEAM", ...payload });
  }

  async getCrmRoutingRules(): Promise<any> {
    const url = this.makeApiUrl('/crm/routing');
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar regras de roteamento', resp);
    const data = await resp.json();
    this.setCached(url, data, 15_000);
    return data;
  }

  async suggestCrmRouting(payload: {
    conversationId?: string;
    leadId?: string | null;
    text?: string | null;
    title?: string | null;
    cte?: string | null;
  }): Promise<any> {
    return this.postJson("/crm/routing", { ...payload, action: "SUGGEST" });
  }

  async saveCrmRoutingRule(payload: any): Promise<any> {
    return this.postJson("/crm/routing", { ...payload, action: "UPSERT_RULE" });
  }

  async getCrmSlaRules(): Promise<any> {
    const url = this.makeApiUrl('/crm/sla');
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar SLA CRM', resp);
    const data = await resp.json();
    this.setCached(url, data, 10_000);
    return data;
  }

  async saveCrmSlaRule(payload: any): Promise<any> {
    return this.postJson("/crm/sla", { ...payload, action: "UPSERT" });
  }

  async deleteCrmSlaRule(id: string): Promise<any> {
    return this.postJson("/crm/sla", { action: "DELETE", id });
  }

  async getCrmProductivity(params?: {
    from?: string | null;
    to?: string | null;
    channel?: string | null;
    teamId?: string | null;
  }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.from) usp.set("from", params.from);
    if (params?.to) usp.set("to", params.to);
    if (params?.channel) usp.set("channel", params.channel);
    if (params?.teamId) usp.set("teamId", params.teamId);
    const qs = usp.toString();
    const url = `${this.makeApiUrl("/crm/productivity")}${qs ? `?${qs}` : ""}`;
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar produtividade CRM', resp);
    const data = await resp.json();
    this.setCached(url, data, 8_000);
    return data;
  }

  async getCrmExecutiveKpis(params?: {
    from?: string | null;
    to?: string | null;
    channel?: string | null;
    teamId?: string | null;
  }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.from) usp.set("from", params.from);
    if (params?.to) usp.set("to", params.to);
    if (params?.channel) usp.set("channel", params.channel);
    if (params?.teamId) usp.set("teamId", params.teamId);
    const qs = usp.toString();
    const url = `${this.makeApiUrl("/crm/executive-kpis")}${qs ? `?${qs}` : ""}`;
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar KPIs executivos CRM', resp);
    const data = await resp.json();
    this.setCached(url, data, 12_000);
    return data;
  }

  async getCrmAutomation(): Promise<any> {
    const url = this.makeApiUrl('/crm/automation');
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar automações CRM', resp);
    const data = await resp.json();
    this.setCached(url, data, 10_000);
    return data;
  }

  async saveCrmAutomation(payload: any): Promise<any> {
    const r = await this.postJson('/crm/automation', payload);
    this.clearCache('/crm/automation');
    return r;
  }

  async getCrmTasks(params?: { status?: string; all?: boolean }): Promise<{ items: any[] }> {
    const usp = new URLSearchParams();
    if (params?.status) usp.set("status", params.status);
    if (params?.all) usp.set("all", "1");
    const qs = usp.toString();
    const url = `${this.makeApiUrl("/crm/tasks")}${qs ? `?${qs}` : ""}`;
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar tarefas CRM', resp);
    return resp.json();
  }

  async saveCrmTask(payload: any): Promise<any> {
    const r = await this.postJson('/crm/tasks', payload);
    this.clearCache('/crm/tasks');
    return r;
  }

  async getCrmContact360(params: { phone?: string; email?: string; leadId?: string }): Promise<any> {
    const usp = new URLSearchParams();
    if (params.phone) usp.set("phone", params.phone);
    if (params.email) usp.set("email", params.email);
    if (params.leadId) usp.set("leadId", params.leadId);
    const qs = usp.toString();
    if (!qs) throw new Error("Parâmetros vazios");
    const url = `${this.makeApiUrl("/crm/contact-360")}?${qs}`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) throw await this.buildHttpError("Erro ao buscar contato 360", resp);
    return resp.json();
  }

  async getCrmConsentAdmin(params?: { limit?: number }): Promise<{ prefs: any[]; events: any[] }> {
    const usp = new URLSearchParams();
    if (params?.limit) usp.set("limit", String(params.limit));
    const qs = usp.toString();
    const url = `${this.makeApiUrl("/crm/consent")}${qs ? `?${qs}` : ""}`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) throw await this.buildHttpError("Erro ao buscar consentimentos", resp);
    return resp.json();
  }

  async postCrmConsent(payload: any): Promise<any> {
    return this.postJson("/crm/consent", payload);
  }

  async downloadCrmReportCsv(type: string, opts?: { from?: string | null; to?: string | null }): Promise<void> {
    const usp = new URLSearchParams();
    usp.set("type", type);
    usp.set("format", "csv");
    if (opts?.from) usp.set("from", opts.from);
    if (opts?.to) usp.set("to", opts.to);
    const url = `${this.makeApiUrl("/crm/reports/export")}?${usp.toString()}`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) throw await this.buildHttpError("Erro ao exportar relatório", resp);
    const blob = await resp.blob();
    const cd = resp.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="?([^";]+)"?/);
    const filename = m?.[1] || `crm_export_${type}.csv`;
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(u);
  }

  async getSofiaSettings(): Promise<any> {
    const url = this.makeApiUrl('/crm/sofia');
    const cached = this.getCached(url);
    if (cached) return cached;
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError('Erro ao buscar Sofia settings', resp);
    const data = await resp.json();
    // Config muda pouco; cache reduz espera ao abrir tela / CRM (invalida em save via postJson).
    this.setCached(url, data, 120_000);
    return data;
  }

  async saveSofiaSettings(payload: any): Promise<any> {
    return this.postJson("/crm/sofia", payload);
  }

  async getSofiaReplySuggestion(payload: { conversationId: string; text: string; mode?: "REPLY" | "SUMMARY" }): Promise<any> {
    return this.postJson("/crm/sofia/respond", payload);
  }

  async getComercialAuditorias(params?: { status?: string; limit?: number }): Promise<any> {
    const usp = new URLSearchParams();
    if (params?.status) usp.set("status", params.status);
    if (params?.limit) usp.set("limit", String(params.limit));
    const qs = usp.toString();
    const endpoint = `/comercial/auditoria${qs ? `?${qs}` : ""}`;
    const url = this.makeApiUrl(endpoint);
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError("Erro ao buscar auditorias comerciais", resp);
    return resp.json();
  }

  async saveComercialAuditoria(payload: {
    id: number;
    statusAuditoria: string;
    motivoQueda: string;
    resumoResposta: string;
    planoAcao: string;
    prioridade?: string;
    responsavel?: string;
    dataRetornoPrevista?: string;
    retornoResponsavel?: string;
    conclusao?: string;
    resultadoEvolucao?: string;
    concluido?: boolean;
    actor?: string;
  }): Promise<any> {
    return this.postJson("/comercial/auditoria", payload);
  }

  async suggestComercialPlano(payload: {
    agencia: string;
    percProjetado: number;
    motivoQueda: string;
    resumoResposta: string;
  }): Promise<any> {
    return this.postJson("/comercial/auditoria/ai", payload);
  }

  async getComercialAuditoriaHistory(auditoriaId: number): Promise<any> {
    const endpoint = `/comercial/auditoria/history?auditoriaId=${encodeURIComponent(String(auditoriaId))}`;
    const url = this.makeApiUrl(endpoint);
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError("Erro ao buscar histórico da auditoria comercial", resp);
    return resp.json();
  }

  async addComercialAuditoriaHistory(payload: {
    auditoriaId: number;
    acao: string;
    actor?: string;
    note: string;
  }): Promise<any> {
    return this.postJson("/comercial/auditoria/history", payload);
  }

  async getRoboSupremoStatus(): Promise<any> {
    const endpoint = `/comercial/robo-supremo/status`;
    const url = this.makeApiUrl(endpoint);
    const resp = await fetch(url);
    if (!resp.ok) throw await this.buildHttpError("Erro ao buscar status do Robô Supremo", resp);
    return resp.json();
  }

  async runRoboSupremo(payload?: { mode?: string; createdBy?: string }): Promise<any> {
    return this.postJson("/comercial/robo-supremo/run", payload || {});
  }

  async applySofiaTemplate(): Promise<any> {
    return this.postJson("/crm/sofia/template", {});
  }
}

export const authClient = new NeonDataClient();
