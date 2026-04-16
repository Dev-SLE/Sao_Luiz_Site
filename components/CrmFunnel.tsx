import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, MapPin, Phone, Plus, Columns3, ArrowRightCircle, X } from 'lucide-react';
import clsx from 'clsx';
import { authClient } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { AppConfirmModal } from './AppOverlays';

type Priority = 'ALTA' | 'MEDIA' | 'BAIXA';
type Source = 'WHATSAPP' | 'IA' | 'MANUAL';

interface LeadCard {
  id: string;
  title: string;
  protocolNumber?: string;
  phone?: string;
  cte?: string;
  mdfeDate?: string;
  routeOrigin?: string;
  routeDestination?: string;
  requestedAt?: string;
  serviceType?: string;
  cargoStatus?: string;
  customerStatus?: string;
  agencyId?: string;
  agencyRequestedAt?: string;
  agencySlaMinutes?: number | null;
  agencyName?: string;
  email?: string;
  freteValue?: number;
  source: Source;
  priority: Priority;
  currentLocation?: string;
  trackingActive?: boolean;
  ownerUsername?: string;
  assignedUsername?: string;
  topic?: string;
  stageId: string;
  logs?: string[];
}

interface Stage {
  id: string;
  name: string;
}

interface AgencyCard {
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
}

const KANBAN_COLUMNS = [
  'Aguardando atendimento',
  'Em busca de mercadorias',
  'Agências',
  'Aguardando retorno de agência',
  'Ocorrências',
  'Atendimento finalizado',
] as const;

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  ALTA: {
    label: 'Alta',
    className: 'bg-red-50 text-red-700 border-red-300',
  },
  MEDIA: {
    label: 'Média',
    className: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  BAIXA: {
    label: 'Baixa',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
};

const sourceConfig: Record<Source, { label: string; className: string }> = {
  WHATSAPP: {
    label: 'WhatsApp',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  IA: {
    label: 'IA',
    className: 'bg-sky-50 text-sky-700 border-sky-300',
  },
  MANUAL: {
    label: 'Manual',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

function getPriorityUi(priorityRaw: unknown): { label: string; className: string } {
  const key = String(priorityRaw || "").toUpperCase() as Priority;
  return priorityConfig[key] || priorityConfig.MEDIA;
}

function getSourceUi(sourceRaw: unknown): { label: string; className: string } {
  const key = String(sourceRaw || "").toUpperCase() as Source;
  return sourceConfig[key] || sourceConfig.MANUAL;
}

interface Props {
  onGoToChat?: (leadId: string) => void;
  onOpenTracking?: (cte: string, serie?: string) => void;
}

let crmFunnelCache: {
  stages: Stage[];
  leads: LeadCard[];
  agencies: AgencyCard[];
  users: Array<{ username: string; role?: string }>;
  savedAt: number;
} | null = null;

const CrmFunnel: React.FC<Props> = ({ onGoToChat, onOpenTracking }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [isSavingLeadEdit, setIsSavingLeadEdit] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [deleteLeadConfirmOpen, setDeleteLeadConfirmOpen] = useState(false);
  const [isSavingPipeline, setIsSavingPipeline] = useState(false);
  const saveLeadLock = useRef(false);
  const savePipelineLock = useRef(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<LeadCard[]>([]);
  const [agencies, setAgencies] = useState<AgencyCard[]>([]);
  const [users, setUsers] = useState<Array<{ username: string; role?: string }>>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [editLeadOpen, setEditLeadOpen] = useState(false);

  const [leadForm, setLeadForm] = useState({
    title: '',
    protocolNumber: '',
    phone: '',
    cte: '',
    mdfeDate: '',
    routeOrigin: '',
    routeDestination: '',
    requestedAt: '',
    serviceType: 'ATENDIMENTO_GERAL',
    cargoStatus: 'SEM_STATUS',
    customerStatus: 'PENDENTE',
    agencyId: '',
    email: '',
    freteValue: '',
    source: 'WHATSAPP' as Source,
    priority: 'MEDIA' as Priority,
    currentLocation: '',
    ownerUsername: '' as string,
  });

  const [editLeadForm, setEditLeadForm] = useState({
    id: '',
    title: '',
    protocolNumber: '',
    phone: '',
    cte: '',
    mdfeDate: '',
    routeOrigin: '',
    routeDestination: '',
    requestedAt: '',
    serviceType: 'ATENDIMENTO_GERAL',
    cargoStatus: 'SEM_STATUS',
    customerStatus: 'PENDENTE',
    agencyId: '',
    email: '',
    freteValue: '',
    source: 'WHATSAPP' as Source,
    priority: 'MEDIA' as Priority,
    currentLocation: '',
    ownerUsername: '' as string,
    stageId: '',
  });
  const [agencyAutomationLoading, setAgencyAutomationLoading] = useState(false);
  const lastAgencySelectionRef = useRef<{ leadId: string; agencyId: string } | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [pipelineForm, setPipelineForm] = useState({
    name: 'Funil Padrão',
    description: 'Funil criado via CRM',
    stages: ['Novos', 'Qualificando', 'Negociando', 'Fechado'],
    makeDefault: true,
    moveLeadsFromOldDefault: true,
    template: 'CUSTOM',
  });

  // --- Filtros/Busca do board ---
  const [boardSearch, setBoardSearch] = useState('');
  const [boardPriority, setBoardPriority] = useState<Priority | 'ALL'>('ALL');
  const [boardSource, setBoardSource] = useState<Source | 'ALL'>('ALL');
  const [onlyMine, setOnlyMine] = useState(false);

  const COLUMN_WIDTH = 260;
  const COLUMN_GAP_PX = 16; // gap-4 no Tailwind

  const refreshBoard = async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;
    if (!silent) setLoading(true);
    setBoardError(null);
    try {
      const board = await authClient.getCrmBoard({
        requestUsername: user?.username || null,
        requestRole: user?.role || null,
      });
      setStages((board.stages || []).map((s: any) => ({ id: String(s.id), name: String(s.name) })));
      setLeads((board.leads || []).map((l: any) => ({
        id: String(l.id),
        title: String(l.title),
        protocolNumber: l.protocolNumber ? String(l.protocolNumber) : undefined,
        phone: l.phone ? String(l.phone) : undefined,
        cte: l.cte ? String(l.cte) : undefined,
        mdfeDate: l.mdfeDate ? String(l.mdfeDate) : undefined,
        routeOrigin: l.routeOrigin ? String(l.routeOrigin) : undefined,
        routeDestination: l.routeDestination ? String(l.routeDestination) : undefined,
        requestedAt: l.requestedAt ? String(l.requestedAt) : undefined,
        serviceType: l.serviceType ? String(l.serviceType) : undefined,
        cargoStatus: l.cargoStatus ? String(l.cargoStatus) : undefined,
        customerStatus: l.customerStatus ? String(l.customerStatus) : undefined,
        agencyId: l.agencyId ? String(l.agencyId) : undefined,
        agencyRequestedAt: l.agencyRequestedAt ? String(l.agencyRequestedAt) : undefined,
        agencySlaMinutes: l.agencySlaMinutes != null ? Number(l.agencySlaMinutes) : null,
        agencyName: l.agencyName ? String(l.agencyName) : undefined,
        email: l.email ? String(l.email) : undefined,
        freteValue: typeof l.freteValue === 'number' ? l.freteValue : undefined,
        source: (String(l.source || 'MANUAL') as Source) || 'MANUAL',
        priority: (String(l.priority || 'MEDIA') as Priority) || 'MEDIA',
        currentLocation: l.currentLocation ? String(l.currentLocation) : undefined,
        ownerUsername: l.ownerUsername ? String(l.ownerUsername) : undefined,
        assignedUsername: l.assignedUsername ? String(l.assignedUsername) : undefined,
        topic: l.topic ? String(l.topic) : undefined,
        stageId: String(l.stageId),
        logs: Array.isArray(l.logs) ? l.logs.map((x: any) => String(x)) : [],
      })));
      crmFunnelCache = {
        stages: (board.stages || []).map((s: any) => ({ id: String(s.id), name: String(s.name) })),
        leads: (board.leads || []).map((l: any) => ({
          id: String(l.id),
          title: String(l.title),
          protocolNumber: l.protocolNumber ? String(l.protocolNumber) : undefined,
          phone: l.phone ? String(l.phone) : undefined,
          cte: l.cte ? String(l.cte) : undefined,
          mdfeDate: l.mdfeDate ? String(l.mdfeDate) : undefined,
          routeOrigin: l.routeOrigin ? String(l.routeOrigin) : undefined,
          routeDestination: l.routeDestination ? String(l.routeDestination) : undefined,
          requestedAt: l.requestedAt ? String(l.requestedAt) : undefined,
          serviceType: l.serviceType ? String(l.serviceType) : undefined,
          cargoStatus: l.cargoStatus ? String(l.cargoStatus) : undefined,
          customerStatus: l.customerStatus ? String(l.customerStatus) : undefined,
          agencyId: l.agencyId ? String(l.agencyId) : undefined,
          agencyRequestedAt: l.agencyRequestedAt ? String(l.agencyRequestedAt) : undefined,
          agencySlaMinutes: l.agencySlaMinutes != null ? Number(l.agencySlaMinutes) : null,
          agencyName: l.agencyName ? String(l.agencyName) : undefined,
          email: l.email ? String(l.email) : undefined,
          freteValue: typeof l.freteValue === 'number' ? l.freteValue : undefined,
          source: (String(l.source || 'MANUAL') as Source) || 'MANUAL',
          priority: (String(l.priority || 'MEDIA') as Priority) || 'MEDIA',
          currentLocation: l.currentLocation ? String(l.currentLocation) : undefined,
          ownerUsername: l.ownerUsername ? String(l.ownerUsername) : undefined,
          assignedUsername: l.assignedUsername ? String(l.assignedUsername) : undefined,
          topic: l.topic ? String(l.topic) : undefined,
          stageId: String(l.stageId),
          logs: Array.isArray(l.logs) ? l.logs.map((x: any) => String(x)) : [],
        })),
        agencies: (board.agencies || []).map((a: any) => ({
          id: String(a.id),
          name: String(a.name || ''),
          city: a.city ? String(a.city) : null,
          state: a.state ? String(a.state) : null,
          phone: a.phone ? String(a.phone) : null,
          whatsapp: a.whatsapp ? String(a.whatsapp) : null,
          contactName: a.contactName ? String(a.contactName) : null,
          serviceRegion: a.serviceRegion ? String(a.serviceRegion) : null,
          avgResponseMinutes: a.avgResponseMinutes != null ? Number(a.avgResponseMinutes) : null,
          internalRating: a.internalRating != null ? Number(a.internalRating) : null,
          notes: a.notes ? String(a.notes) : null,
        })),
        users,
        savedAt: Date.now(),
      };
      setAgencies((board.agencies || []).map((a: any) => ({
        id: String(a.id),
        name: String(a.name || ''),
        city: a.city ? String(a.city) : null,
        state: a.state ? String(a.state) : null,
        phone: a.phone ? String(a.phone) : null,
        whatsapp: a.whatsapp ? String(a.whatsapp) : null,
        contactName: a.contactName ? String(a.contactName) : null,
        serviceRegion: a.serviceRegion ? String(a.serviceRegion) : null,
        avgResponseMinutes: a.avgResponseMinutes != null ? Number(a.avgResponseMinutes) : null,
        internalRating: a.internalRating != null ? Number(a.internalRating) : null,
        notes: a.notes ? String(a.notes) : null,
      })));
    } catch (err) {
      console.error('Erro ao carregar CRM board:', err);
      setBoardError(err instanceof Error ? err.message : 'Falha ao carregar funil.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const cacheAgeMs = crmFunnelCache ? Date.now() - crmFunnelCache.savedAt : Number.POSITIVE_INFINITY;
    const hasFreshCache = !!crmFunnelCache && cacheAgeMs < 180_000;
    if (hasFreshCache && crmFunnelCache) {
      setStages(crmFunnelCache.stages);
      setLeads(crmFunnelCache.leads);
      setAgencies(crmFunnelCache.agencies || []);
      setUsers(crmFunnelCache.users);
    }
    if (hasFreshCache) {
      refreshBoard({ silent: true });
    } else {
      refreshBoard();
    }
    authClient
      .getUsers()
      .then((rows: any) => {
        if (!Array.isArray(rows)) return;
        const nextUsers =
          rows
            .map((r: any) => ({
              username: String(r.username || ''),
              role: r.role ? String(r.role) : undefined,
            }))
            .filter((u: any) => u.username);
        setUsers(nextUsers);
        if (crmFunnelCache) crmFunnelCache.users = nextUsers;
      })
      .catch(() => setUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const filteredLeads = useMemo(() => {
    const term = boardSearch.trim().toLowerCase();
    const mine = onlyMine && user?.username ? String(user.username).toLowerCase() : null;

    return leads.filter((lead) => {
      if (boardPriority !== 'ALL' && lead.priority !== boardPriority) return false;
      if (boardSource !== 'ALL' && lead.source !== boardSource) return false;
      const assigned = (lead.assignedUsername || '').toLowerCase();
      const owner = (lead.ownerUsername || '').toLowerCase();
      if (mine && assigned !== mine && owner !== mine) return false;
      if (!term) return true;

      const haystack = [
        lead.title,
        lead.phone,
        lead.email,
        lead.cte,
        lead.currentLocation,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase())
        .join(' | ');

      return haystack.includes(term);
    });
  }, [leads, boardSearch, boardPriority, boardSource, onlyMine, user?.username]);

  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadCard[]> = {};
    stages.forEach((s) => (map[s.id] = []));
    filteredLeads.forEach((lead) => {
      if (!map[lead.stageId]) map[lead.stageId] = [];
      map[lead.stageId].push(lead);
    });
    return map;
  }, [filteredLeads, stages]);

  const stageIdByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of stages) map[s.name] = s.id;
    return map;
  }, [stages]);

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDropOnStage = (stageId: string) => {
    if (!draggingId) return;
    const draggedLead = leads.find((l) => l.id === draggingId);
    if (!draggedLead) return;
    if (draggedLead.stageId === stageId) {
      setDraggingId(null);
      return;
    }
    const previousLeads = leads;
    // Otimista: move na UI imediatamente, sincroniza no backend.
    setLeads((prev) =>
      prev.map((l) => (l.id === draggingId ? { ...l, stageId } : l))
    );

    authClient
      .moveCrmLead({
        leadId: draggingId,
        stageId,
        ownerUsername: user?.username ?? null,
      })
      .then(() => {
        // Evita "efeito elástico" por refetch imediato; confirma em segundo plano.
        window.setTimeout(() => {
          refreshBoard({ silent: true });
        }, 1200);
      })
      .catch((err) => {
        console.error('Erro ao mover lead:', err);
        setBoardError(err instanceof Error ? err.message : 'Falha ao mover lead.');
        // rollback imediato evita "efeito elástico" por refetch tardio.
        setLeads(previousLeads);
      })
      .finally(() => setDraggingId(null));
  };

  const handleCreateLead = () => {
    setLeadForm({
      title: '',
      protocolNumber: '',
      phone: '',
      cte: '',
      mdfeDate: '',
      routeOrigin: '',
      routeDestination: '',
      requestedAt: '',
      serviceType: 'ATENDIMENTO_GERAL',
      cargoStatus: 'SEM_STATUS',
      customerStatus: 'PENDENTE',
      agencyId: '',
      email: '',
      freteValue: '',
      source: 'WHATSAPP',
      priority: 'MEDIA',
      currentLocation: '',
      ownerUsername: user?.username ?? '',
    });
    setNewLeadOpen(true);
  };

  const handleSaveLead = () => {
    if (!leadForm.title.trim()) return;
    if (saveLeadLock.current) return;
    saveLeadLock.current = true;
    setIsSavingLead(true);
    let saved = false;
    const value = parseFloat(String(leadForm.freteValue).replace(',', '.')) || undefined;
    authClient
      .createCrmLead({
        title: leadForm.title.trim(),
        protocolNumber: leadForm.protocolNumber.trim() || null,
        phone: leadForm.phone.trim() || null,
        cte: leadForm.cte.trim() || null,
        mdfeDate: leadForm.mdfeDate || null,
        routeOrigin: leadForm.routeOrigin.trim() || null,
        routeDestination: leadForm.routeDestination.trim() || null,
        requestedAt: leadForm.requestedAt || null,
        serviceType: leadForm.serviceType || null,
        cargoStatus: leadForm.cargoStatus || null,
        customerStatus: leadForm.customerStatus || null,
        agencyId: leadForm.agencyId || null,
        email: leadForm.email.trim() || null,
        freteValue: value,
        source: leadForm.source,
        priority: leadForm.priority,
        currentLocation: leadForm.currentLocation.trim() || null,
        ownerUsername: (leadForm.ownerUsername.trim() || user?.username || null) as any,
      })
      .then(() => {
        saved = true;
        return refreshBoard();
      })
      .catch((err) => {
        console.error('Erro ao salvar lead:', err);
        setBoardError(err instanceof Error ? err.message : 'Falha ao salvar lead.');
      })
      .finally(() => {
        saveLeadLock.current = false;
        setIsSavingLead(false);
        if (saved) setNewLeadOpen(false);
      });
  };

  const handleOpenPipelineModal = () => {
    setNewPipelineOpen(true);
  };

  const handleSavePipeline = () => {
    const cols = pipelineForm.stages.map((c) => String(c).trim()).filter(Boolean);
    if (cols.length < 2) return;
    if (savePipelineLock.current) return;
    savePipelineLock.current = true;
    setIsSavingPipeline(true);
    let saved = false;
    authClient
      .createCrmPipeline({
        name: pipelineForm.name,
        columns: cols,
        description: pipelineForm.description,
        makeDefault: pipelineForm.makeDefault,
        moveLeadsFromOldDefault: pipelineForm.moveLeadsFromOldDefault,
        createdBy: user?.username ?? 'system',
      })
      .then(() => {
        saved = true;
        return refreshBoard();
      })
      .catch((err) => {
        console.error('Erro ao criar pipeline:', err);
        setBoardError(err instanceof Error ? err.message : 'Falha ao criar funil.');
      })
      .finally(() => {
        savePipelineLock.current = false;
        setIsSavingPipeline(false);
        if (saved) setNewPipelineOpen(false);
      });
  };

  const selectedLead = useMemo(
    () => (drawerLeadId ? leads.find((l) => l.id === drawerLeadId) || null : null),
    [drawerLeadId, leads]
  );

  const handleOpenEditLead = () => {
    if (!selectedLead) return;
    setEditLeadForm({
      id: selectedLead.id,
      title: selectedLead.title || '',
      protocolNumber: selectedLead.protocolNumber || '',
      phone: selectedLead.phone || '',
      cte: selectedLead.cte || '',
      mdfeDate: selectedLead.mdfeDate || '',
      routeOrigin: selectedLead.routeOrigin || '',
      routeDestination: selectedLead.routeDestination || '',
      requestedAt: selectedLead.requestedAt || '',
      serviceType: selectedLead.serviceType || 'ATENDIMENTO_GERAL',
      cargoStatus: selectedLead.cargoStatus || 'SEM_STATUS',
      customerStatus: selectedLead.customerStatus || 'PENDENTE',
      agencyId: selectedLead.agencyId || '',
      email: selectedLead.email || '',
      freteValue:
        typeof selectedLead.freteValue === 'number'
          ? String(selectedLead.freteValue).replace('.', ',')
          : '',
      source: selectedLead.source,
      priority: selectedLead.priority,
      currentLocation: selectedLead.currentLocation || '',
      ownerUsername: selectedLead.ownerUsername || user?.username || '',
      stageId: selectedLead.stageId,
    });
    setEditLeadOpen(true);
  };

  const handleSaveEditLead = async () => {
    if (!selectedLead) return;
    if (!editLeadForm.title.trim()) return;
    if (isSavingLeadEdit) return;
    setIsSavingLeadEdit(true);
    try {
      const value = parseFloat(String(editLeadForm.freteValue).replace(',', '.')) || undefined;

      await authClient.updateCrmLead({
        leadId: editLeadForm.id,
        title: editLeadForm.title.trim(),
        protocolNumber: editLeadForm.protocolNumber.trim() || null,
        phone: editLeadForm.phone.trim() || null,
        email: editLeadForm.email.trim() || null,
        cte: editLeadForm.cte.trim() || null,
        mdfeDate: editLeadForm.mdfeDate || null,
        routeOrigin: editLeadForm.routeOrigin.trim() || null,
        routeDestination: editLeadForm.routeDestination.trim() || null,
        requestedAt: editLeadForm.requestedAt || null,
        serviceType: editLeadForm.serviceType || null,
        cargoStatus: editLeadForm.cargoStatus || null,
        customerStatus: editLeadForm.customerStatus || null,
        agencyId: editLeadForm.agencyId || null,
        freteValue: value,
        source: editLeadForm.source,
        priority: editLeadForm.priority,
        currentLocation: editLeadForm.currentLocation.trim() || null,
        ownerUsername: editLeadForm.ownerUsername.trim() || user?.username || null,
        stageId: editLeadForm.stageId,
        updatedByUsername: user?.username ?? null,
      });

      setEditLeadOpen(false);
      setDrawerLeadId(editLeadForm.id);
      await refreshBoard({ silent: true });
    } catch (err) {
      console.error('Erro ao editar lead:', err);
      setBoardError(err instanceof Error ? err.message : 'Falha ao editar lead.');
    } finally {
      setIsSavingLeadEdit(false);
    }
  };

  const waitingAgencyStageId = stageIdByName['Aguardando retorno de agência'];

  const handleAgencySelectionForLead = async (leadId: string, agencyId: string) => {
    if (!agencyId) return;
    if (!waitingAgencyStageId) {
      setBoardError("Etapa 'Aguardando retorno de agência' não encontrada.");
      return;
    }
    setAgencyAutomationLoading(true);
    try {
      await authClient.moveCrmLead({
        leadId,
        ownerUsername: user?.username ?? null,
        action: 'REQUEST_AGENCY_RETURN',
        agencyId,
      });
      await refreshBoard({ silent: true });
    } catch (err) {
      console.error('Erro ao automatizar fluxo da agência:', err);
      setBoardError(err instanceof Error ? err.message : 'Falha ao automatizar fluxo da agência.');
    } finally {
      setAgencyAutomationLoading(false);
    }
  };

  useEffect(() => {
    if (!editLeadOpen || !selectedLead) return;
    const newAgencyId = (editLeadForm.agencyId || '').trim();
    const currentAgencyId = (selectedLead.agencyId || '').trim();
    if (!newAgencyId || newAgencyId === currentAgencyId) return;
    const key = { leadId: selectedLead.id, agencyId: newAgencyId };
    if (
      lastAgencySelectionRef.current &&
      lastAgencySelectionRef.current.leadId === key.leadId &&
      lastAgencySelectionRef.current.agencyId === key.agencyId
    ) {
      return;
    }
    lastAgencySelectionRef.current = key;
    handleAgencySelectionForLead(selectedLead.id, newAgencyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLeadForm.agencyId, editLeadOpen, selectedLead?.id]);

  const performDeleteLead = async () => {
    if (!selectedLead) return;
    if (isDeletingLead) return;
    setIsDeletingLead(true);
    try {
      await authClient.deleteCrmLead({ leadId: selectedLead.id, deletedByUsername: user?.username ?? null });
      setDrawerLeadId(null);
      setEditLeadOpen(false);
      setDeleteLeadConfirmOpen(false);
      await refreshBoard({ silent: true });
    } catch (err) {
      console.error('Erro ao excluir lead:', err);
      setBoardError(err instanceof Error ? err.message : 'Falha ao excluir lead.');
    } finally {
      setIsDeletingLead(false);
    }
  };

  const handleRequestAgencyReturn = async () => {
    if (!selectedLead) return;
    try {
      await authClient.moveCrmLead({
        leadId: selectedLead.id,
        ownerUsername: user?.username ?? null,
        action: "REQUEST_AGENCY_RETURN",
      });
      await refreshBoard({ silent: true });
    } catch (err) {
      console.error('Erro ao acionar agência:', err);
      setBoardError(err instanceof Error ? err.message : 'Falha ao acionar agência.');
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatOpenDuration = (iso?: string) => {
    if (!iso) return '—';
    const start = new Date(iso).getTime();
    if (!Number.isFinite(start)) return '—';
    const diffMs = Math.max(0, Date.now() - start);
    const mins = Math.floor(diffMs / 60000);
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    const remMins = mins % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${remMins}m`;
    return `${remMins}m`;
  };

  const getAgencySlaState = (lead: LeadCard) => {
    if (!lead.agencyRequestedAt) return null;
    const startedAt = new Date(lead.agencyRequestedAt).getTime();
    if (!Number.isFinite(startedAt)) return null;
    const elapsedMs = Math.max(0, nowTick - startedAt);
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const slaMinutes = lead.agencySlaMinutes && lead.agencySlaMinutes > 0 ? lead.agencySlaMinutes : 60;
    return {
      elapsedLabel: formatOpenDuration(lead.agencyRequestedAt),
      slaMinutes,
      breached: elapsedMinutes > slaMinutes,
    };
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-sl-red border border-slate-200 shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <Columns3 size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
              Funil de Atendimento CRM
            </h1>
            <p className="text-xs text-slate-600">
              Organize leads por estágio e prioridade, com foco em rastreio. Este funil é{' '}
              <strong>operacional</strong> (não inclui pipeline comercial de vendas com valor e forecast).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateLead}
            className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(26,27,98,0.7)] hover:bg-sl-red hover:shadow-[0_0_22px_rgba(236,27,35,0.8)] transition-all"
          >
            <Plus size={16} />
            Novo Lead
          </button>
          <button
            type="button"
            onClick={handleOpenPipelineModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 border border-slate-200 hover:border-sl-navy/40 transition-colors"
          >
            <Columns3 size={16} />
            Criar Novo Funil
          </button>
        </div>
      </div>

      {/* Filtros do board */}
      <div className="rounded-2xl border border-sl-navy/15 bg-gradient-to-b from-white to-slate-50 p-3 shadow-[0_12px_26px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
              placeholder="Pesquisar (título, telefone, email, CTE, rastreio)..."
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-sl-navy/20 focus:border-sl-navy/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={boardPriority}
              onChange={(e) => setBoardPriority(e.target.value as any)}
              className="appearance-none rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-sl-navy/20 focus:border-sl-navy/40"
            >
              <option value="ALL">Todas prioridades</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Média</option>
              <option value="BAIXA">Baixa</option>
            </select>

            <select
              value={boardSource}
              onChange={(e) => setBoardSource(e.target.value as any)}
              className="appearance-none rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-sl-navy/20 focus:border-sl-navy/40"
            >
              <option value="ALL">Todas origens</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="IA">IA</option>
              <option value="MANUAL">Manual</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="accent-sl-navy"
              />
              Somente meus leads
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pb-4">
        {boardError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-red-800">
                Erro no CRM Funil: {boardError}
              </p>
              <button
                type="button"
                onClick={() => navigator?.clipboard?.writeText(boardError)}
                className="text-[11px] rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-100"
              >
                Copiar erro
              </button>
            </div>
          </div>
        )}
        <div
          className="flex gap-4 flex-nowrap items-start"
          style={{ minWidth: KANBAN_COLUMNS.length * (COLUMN_WIDTH + COLUMN_GAP_PX) }}
        >
          {KANBAN_COLUMNS.map((columnName) => {
            if (columnName === 'Agências') {
              return (
                <div
                  key="agencias-fixed"
                  className="flex-none w-[260px] min-w-[260px] shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col self-stretch"
                >
                  <div className="px-3 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Agências
                      </h2>
                      <p className="text-[10px] text-gray-500">
                        {agencies.length} agências fixas
                      </p>
                    </div>
                  </div>
                  <div className="p-2 space-y-2">
                    {agencies.map((agency) => (
                      <div
                        key={agency.id}
                        className="rounded-xl bg-slate-50 border border-slate-200 p-3 shadow-sm flex flex-col gap-1"
                      >
                        <div className="font-bold text-xs text-slate-900 truncate">{agency.name}</div>
                        <div className="text-[10px] text-slate-600">
                          {(agency.city || agency.state) ? `${agency.city || '—'}/${agency.state || '—'}` : 'Local não informado'}
                        </div>
                        {agency.contactName && <div className="text-[10px] text-slate-600">Contato: {agency.contactName}</div>}
                        {(agency.whatsapp || agency.phone) && (
                          <div className="text-[10px] text-slate-600">Fone: {agency.whatsapp || agency.phone}</div>
                        )}
                        {agency.avgResponseMinutes != null && (
                          <div className="text-[10px] text-emerald-700">T.M.R: {agency.avgResponseMinutes} min</div>
                        )}
                      </div>
                    ))}
                    {agencies.length === 0 && (
                      <div className="text-[11px] text-gray-500 py-3 px-2 border border-dashed border-slate-200 rounded-lg text-center">
                        Sem agências cadastradas
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const stageId = stageIdByName[columnName];
            const stageLeads = stageId ? (leadsByStage[stageId] || []) : [];
            return (
            <div
              key={columnName}
              className="flex-none w-[260px] min-w-[260px] shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (stageId) handleDropOnStage(stageId);
              }}
            >
              <div className="px-3 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {columnName}
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    {stageLeads.length} leads
                  </p>
                </div>
                <div className="text-[10px] text-slate-600 text-right">
                  {(() => {
                    const total = stageLeads
                      .map((l) => l.freteValue || 0)
                      .reduce((acc, v) => acc + v, 0);
                    return total > 0 ? formatCurrency(total) : 'R$ 0,00';
                  })()}
                </div>
              </div>
              <div className="p-2 space-y-2">
                {stageLeads.map((lead) => {
                  const priority = getPriorityUi(lead.priority);
                  const source = getSourceUi(lead.source);
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      onClick={() => setDrawerLeadId(lead.id)}
                      className={clsx(
                        'rounded-xl border-l-4 border-l-sl-navy bg-gradient-to-b from-white to-slate-50 border border-slate-200 p-3 shadow-sm flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-[1px] hover:border-sl-navy/35 hover:shadow-[0_12px_24px_rgba(10,22,40,0.14)]',
                        draggingId === lead.id && 'opacity-70 scale-[0.98]'
                      )}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="mb-1 inline-flex rounded-full border border-sl-navy/20 bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-sl-navy">
                            Lead
                          </div>
                          <div className="font-bold text-xs md:text-sm text-slate-900 leading-tight break-words">
                            {lead.title}
                          </div>
                          {lead.protocolNumber && (
                            <div className="text-[10px] text-indigo-600 mt-0.5">
                              Protocolo: {lead.protocolNumber}
                            </div>
                          )}
                          {typeof lead.freteValue === 'number' && (
                            <div className="text-[11px] font-mono text-emerald-700 mt-0.5">
                              R$ {lead.freteValue.toFixed(2)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-[9px] font-bold border',
                              priority.className
                            )}
                          >
                            {priority.label}
                          </span>
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-[9px] font-bold border',
                              source.className
                            )}
                          >
                            {source.label}
                          </span>
                        </div>
                      </div>
                      {lead.currentLocation && (
                        <div className="text-[11px] text-slate-600 mt-1 line-clamp-3 flex items-start gap-1.5">
                          <MapPin size={11} className="text-sl-red mt-0.5 shrink-0" />
                          <span>{lead.currentLocation}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        {(lead.routeOrigin || lead.routeDestination) && (
                          <div>
                            Rota: {lead.routeOrigin || '—'} {"->"} {lead.routeDestination || '—'}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {lead.cte ? (
                            <span className="px-1.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-[9px] text-indigo-700">
                              Rota interna
                            </span>
                          ) : null}
                          {lead.trackingActive ? (
                            <span className="px-1.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700">
                              Rastreio ativo
                            </span>
                          ) : null}
                          {lead.mdfeDate ? (
                            <span className="px-1.5 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-[9px] text-sky-700">
                              MDF-e
                            </span>
                          ) : null}
                        </div>
                        {lead.cte && <div>CTE: {lead.cte}</div>}
                        {lead.serviceType && <div>Tipo: {lead.serviceType}</div>}
                        {lead.cargoStatus && <div>Carga: {lead.cargoStatus}</div>}
                        {lead.customerStatus && <div>Cliente: {lead.customerStatus}</div>}
                        <div>Tempo em aberto: {formatOpenDuration(lead.requestedAt)}</div>
                        {lead.requestedAt && <div>Solicitação: {new Date(lead.requestedAt).toLocaleString('pt-BR')}</div>}
                        {lead.mdfeDate && <div>MDF-e: {new Date(lead.mdfeDate).toLocaleString('pt-BR')}</div>}
                        {lead.agencyName && <div>Agência: {lead.agencyName}</div>}
                        {(() => {
                          const sla = getAgencySlaState(lead);
                          if (!sla) return null;
                          return (
                            <div className={sla.breached ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold'}>
                              SLA agência: {sla.elapsedLabel} / {sla.slaMinutes} min {sla.breached ? '(estourado)' : ''}
                            </div>
                          );
                        })()}
                      </div>
                      {(lead.assignedUsername || lead.ownerUsername || lead.topic) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(lead.assignedUsername || lead.ownerUsername) && (
                            <span className="px-1.5 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-[9px] text-slate-800">
                              Resp: {lead.assignedUsername || lead.ownerUsername}
                            </span>
                          )}
                          {lead.topic && (
                            <span className="px-1.5 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-[9px] text-slate-800">
                              {lead.topic}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1">
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onGoToChat?.(lead.id)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-sl-navy/40 hover:text-sl-navy text-[11px]"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (lead.cte) {
                                onOpenTracking?.(lead.cte);
                              }
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-sl-navy/40 hover:text-sl-navy text-[11px]"
                          >
                            <MapPin size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (lead.phone) {
                                window.open(`tel:${lead.phone.replace(/\s/g, '')}`);
                              }
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-sl-navy/40 hover:text-sl-navy text-[11px]"
                          >
                            <Phone size={14} />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-600 uppercase tracking-wide font-medium">
                          Arraste para outro estágio
                        </span>
                      </div>
                    </div>
                  );
                })}
                {stageLeads.length === 0 && (
                  <div className="text-[11px] text-slate-600 py-3 px-2 border border-dashed border-slate-300 rounded-lg text-center">
                    Arraste um lead para cá
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>
      </div>
      {loading && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-[0_0_18px_rgba(0,0,0,0.8)]">
          Carregando funis e leads...
        </div>
      )}
      {newLeadOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-[0_18px_42px_rgba(15,23,42,0.22)] p-6 relative">
            <button
              type="button"
              onClick={() => setNewLeadOpen(false)}
              className="absolute top-3 right-3 rounded-full border border-slate-200 p-1 text-slate-600 hover:text-sl-navy hover:border-sl-navy/40"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Novo Lead</h2>
            <p className="text-xs text-slate-500 mb-4">
              Preencha os dados iniciais para cadastrar um novo atendimento.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Nome
                </label>
                <input
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                  value={leadForm.title}
                  onChange={(e) => setLeadForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Razão social ou contato"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Protocolo (opcional)
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.protocolNumber}
                    onChange={(e) => setLeadForm((f) => ({ ...f, protocolNumber: e.target.value }))}
                    placeholder="Se vazio, gera automático"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Telefone
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(11) 99999-0000"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    CTE (opcional)
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.cte}
                    onChange={(e) => setLeadForm((f) => ({ ...f, cte: e.target.value }))}
                    placeholder="12345"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Origem
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.routeOrigin}
                    onChange={(e) => setLeadForm((f) => ({ ...f, routeOrigin: e.target.value }))}
                    placeholder="Cidade/UF origem"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Destino
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.routeDestination}
                    onChange={(e) => setLeadForm((f) => ({ ...f, routeDestination: e.target.value }))}
                    placeholder="Cidade/UF destino"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Solicitação
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.requestedAt}
                    onChange={(e) => setLeadForm((f) => ({ ...f, requestedAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    MDF-e
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.mdfeDate}
                    onChange={(e) => setLeadForm((f) => ({ ...f, mdfeDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Atendimento
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.serviceType}
                    onChange={(e) => setLeadForm((f) => ({ ...f, serviceType: e.target.value }))}
                    placeholder="Ex: RASTREIO"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@dominio.com"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Localização / Rastreio
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.currentLocation}
                    onChange={(e) => setLeadForm((f) => ({ ...f, currentLocation: e.target.value }))}
                    placeholder="Ex: CTE / Terminal / Status"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Valor
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.freteValue}
                    onChange={(e) =>
                      setLeadForm((f) => ({ ...f, freteValue: e.target.value }))
                    }
                    placeholder="5300,00"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Origem
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.source}
                    onChange={(e) =>
                      setLeadForm((f) => ({ ...f, source: e.target.value as Source }))
                    }
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="IA">IA</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Prioridade
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.priority}
                    onChange={(e) =>
                      setLeadForm((f) => ({ ...f, priority: e.target.value as Priority }))
                    }
                  >
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Média</option>
                    <option value="BAIXA">Baixa</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Status da carga
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.cargoStatus}
                    onChange={(e) => setLeadForm((f) => ({ ...f, cargoStatus: e.target.value }))}
                    placeholder="Ex: EM_TRANSFERENCIA"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Status do cliente
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={leadForm.customerStatus}
                    onChange={(e) => setLeadForm((f) => ({ ...f, customerStatus: e.target.value }))}
                    placeholder="Ex: PENDENTE"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Agência envolvida
                </label>
                <select
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                  value={leadForm.agencyId}
                  onChange={(e) => setLeadForm((f) => ({ ...f, agencyId: e.target.value }))}
                >
                  <option value="">Sem agência</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Responsável
                </label>
                <select
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                  value={leadForm.ownerUsername}
                  onChange={(e) => setLeadForm((f) => ({ ...f, ownerUsername: e.target.value }))}
                >
                  {(users.length ? users : [{ username: user?.username || '' }]).map((u: any) => (
                    <option key={u.username} value={u.username}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewLeadOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-sl-navy-light"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveLead}
                disabled={isSavingLead}
                className="px-4 py-2 text-xs rounded-lg bg-sl-navy text-white font-semibold shadow-[0_0_18px_rgba(26,27,98,0.8)] hover:bg-sl-red disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSavingLead ? "Salvando..." : "Salvar Lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editLeadOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-[0_18px_42px_rgba(15,23,42,0.22)] p-6 relative">
            <button
              type="button"
              onClick={() => setEditLeadOpen(false)}
              className="absolute top-3 right-3 rounded-full border border-slate-200 p-1 text-slate-600 hover:text-sl-navy hover:border-sl-navy/40"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Editar Lead</h2>
            <p className="text-xs text-slate-500 mb-4">
              Atualize os dados do lead e (opcionalmente) a etapa.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Nome
                </label>
                <input
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                  value={editLeadForm.title}
                  onChange={(e) => setEditLeadForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Razão social ou contato"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Protocolo
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.protocolNumber}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, protocolNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Telefone
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.phone}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(11) 99999-0000"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.email}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@dominio.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Origem
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.routeOrigin}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, routeOrigin: e.target.value }))}
                    placeholder="Cidade/UF origem"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Destino
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.routeDestination}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, routeDestination: e.target.value }))}
                    placeholder="Cidade/UF destino"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Solicitação
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.requestedAt}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, requestedAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    MDF-e
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.mdfeDate}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, mdfeDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Atendimento
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.serviceType}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, serviceType: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Status da carga
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.cargoStatus}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, cargoStatus: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Status do cliente
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.customerStatus}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, customerStatus: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    CTE (opcional)
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.cte}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, cte: e.target.value }))}
                    placeholder="12345"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Valor
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.freteValue}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, freteValue: e.target.value }))}
                    placeholder="5300,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Origem
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.source}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, source: e.target.value as Source }))}
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="IA">IA</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Prioridade
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.priority}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                  >
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Média</option>
                    <option value="BAIXA">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Etapa
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.stageId}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, stageId: e.target.value }))}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Rastreio / Localização
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.currentLocation}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, currentLocation: e.target.value }))}
                    placeholder="Ex: CTE / Terminal / Status"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Responsável
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                    value={editLeadForm.ownerUsername}
                    onChange={(e) => setEditLeadForm((f) => ({ ...f, ownerUsername: e.target.value }))}
                  >
                    {(users.length ? users : [{ username: user?.username || '' }]).map((u: any) => (
                      <option key={u.username} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Agência envolvida
                </label>
                <select
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                  value={editLeadForm.agencyId}
                  onChange={(e) =>
                    setEditLeadForm((f) => ({
                      ...f,
                      agencyId: e.target.value,
                      stageId: e.target.value && waitingAgencyStageId ? waitingAgencyStageId : f.stageId,
                      customerStatus: e.target.value ? 'AGUARDANDO_RETORNO_AGENCIA' : f.customerStatus,
                    }))
                  }
                >
                  <option value="">Sem agência</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditLeadOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-sl-navy-light"
                disabled={isSavingLeadEdit}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditLead}
                disabled={isSavingLeadEdit || agencyAutomationLoading}
                className="px-4 py-2 text-xs rounded-lg bg-sl-navy text-white font-semibold shadow-[0_0_18px_rgba(26,27,98,0.8)] hover:bg-sl-red disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSavingLeadEdit ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
            {agencyAutomationLoading && (
              <p className="mt-2 text-[11px] text-amber-700">
                Automação ativa: vinculando agência, movendo para retorno e iniciando SLA...
              </p>
            )}
          </div>
        </div>
      )}

      {newPipelineOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-[0_18px_42px_rgba(15,23,42,0.22)] p-6 relative">
            <button
              type="button"
              onClick={() => setNewPipelineOpen(false)}
              className="absolute top-3 right-3 rounded-full border border-slate-200 p-1 text-slate-600 hover:text-sl-navy hover:border-sl-navy/40"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Novo Funil</h2>
            <p className="text-xs text-slate-500 mb-4">
              Crie um funil com etapas e opções de padrão. O funil novo pode virar o padrão da tela.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Nome do Funil
                </label>
                <input
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                  value={pipelineForm.name}
                  onChange={(e) =>
                    setPipelineForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex: Funil Comercial"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Descrição (opcional)
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25 min-h-[70px] resize-none"
                  value={pipelineForm.description}
                  onChange={(e) => setPipelineForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Funil para atendimento comercial"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Template de etapas
                </label>
                <select
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                  value={pipelineForm.template}
                  onChange={(e) => {
                    const v = e.target.value;
                    const nextStages =
                      v === 'PADRAO'
                        ? ['Novos', 'Qualificando', 'Negociando', 'Fechado']
                        : v === 'SIMPLES'
                          ? ['Novos', 'Negociação', 'Fechado']
                          : v === 'CURTO'
                            ? ['Novos', 'Fechado']
                            : pipelineForm.stages;
                    setPipelineForm((f) => ({ ...f, template: v, stages: nextStages as string[] }));
                  }}
                >
                  <option value="CUSTOM">Custom</option>
                  <option value="PADRAO">Padrão</option>
                  <option value="SIMPLES">Simples</option>
                  <option value="CURTO">Curto</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Etapas do funil
                </label>
                <div className="mt-2 space-y-2">
                  {pipelineForm.stages.map((s, idx) => (
                    <div key={`${idx}-${s}`} className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-sl-navy/25"
                        value={s}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPipelineForm((f) => {
                            const next = [...f.stages];
                            next[idx] = v;
                            return { ...f, stages: next, template: 'CUSTOM' };
                          });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPipelineForm((f) => {
                            if (idx === 0) return f;
                            const next = [...f.stages];
                            const tmp = next[idx - 1];
                            next[idx - 1] = next[idx];
                            next[idx] = tmp;
                            return { ...f, stages: next, template: 'CUSTOM' };
                          });
                        }}
                        className="px-2 py-2 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-sl-navy-light disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={idx === 0}
                        aria-label="Mover para cima"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPipelineForm((f) => {
                            if (idx === f.stages.length - 1) return f;
                            const next = [...f.stages];
                            const tmp = next[idx + 1];
                            next[idx + 1] = next[idx];
                            next[idx] = tmp;
                            return { ...f, stages: next, template: 'CUSTOM' };
                          });
                        }}
                        className="px-2 py-2 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-sl-navy-light disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={idx === pipelineForm.stages.length - 1}
                        aria-label="Mover para baixo"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPipelineForm((f) => {
                            const next = f.stages.filter((_, i) => i !== idx);
                            return { ...f, stages: next.length ? next : ['Etapa 1', 'Etapa 2'], template: 'CUSTOM' };
                          });
                        }}
                        className="px-2 py-2 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        aria-label="Remover etapa"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setPipelineForm((f) => ({ ...f, stages: [...f.stages, `Etapa ${f.stages.length + 1}`], template: 'CUSTOM' }));
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-sl-navy-light"
                  >
                    + Adicionar etapa
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={pipelineForm.makeDefault}
                    onChange={(e) => setPipelineForm((f) => ({ ...f, makeDefault: e.target.checked }))}
                    className="accent-sl-navy"
                  />
                  Tornar padrão
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={pipelineForm.moveLeadsFromOldDefault}
                    onChange={(e) => setPipelineForm((f) => ({ ...f, moveLeadsFromOldDefault: e.target.checked }))}
                    className="accent-sl-navy"
                    disabled={!pipelineForm.makeDefault}
                  />
                  Mover leads do padrão atual para o novo
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewPipelineOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-sl-navy-light"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePipeline}
                disabled={isSavingPipeline}
                className="px-4 py-2 text-xs rounded-lg bg-sl-navy text-white font-semibold shadow-[0_0_18px_rgba(26,27,98,0.8)] hover:bg-sl-red disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSavingPipeline ? "Aplicando..." : "Aplicar Funil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-y-0 right-0 z-30 w-full sm:w-[380px] md:w-[420px] bg-white border-l border-slate-200 shadow-[-12px_0_30px_rgba(15,23,42,0.18)] flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{selectedLead.title}</h2>
              <p className="text-[11px] text-slate-500">
                Detalhes do lead e histórico de movimento
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerLeadId(null)}
              className="text-slate-500 hover:text-sl-navy text-xs"
            >
              Fechar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOpenEditLead}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-sl-navy text-white font-semibold hover:bg-sl-navy-light border border-slate-300"
                disabled={isSavingLeadEdit}
              >
                {isSavingLeadEdit ? "Carregando..." : "Editar"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteLeadConfirmOpen(true)}
                disabled={isDeletingLead}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-red-50 text-red-700 font-semibold hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingLead ? "Excluindo..." : "Excluir"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleRequestAgencyReturn}
              className="w-full px-3 py-2 text-xs rounded-lg bg-amber-50 text-amber-700 font-semibold hover:bg-amber-100 border border-amber-200"
            >
              Acionar agência e mover para retorno
            </button>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!selectedLead.cte) return;
                  await authClient.createOccurrence({
                    cte: selectedLead.cte,
                    serie: "0",
                    occurrenceType: "OUTROS",
                    description: `Ocorrência aberta pelo CRM (Lead: ${selectedLead.title})`,
                    source: "CRM",
                    leadId: selectedLead.id,
                    contactPhone: selectedLead.phone || null,
                    createdBy: user?.username || null,
                  });
                }}
                className="w-full px-3 py-2 text-xs rounded-lg bg-violet-50 text-violet-700 font-semibold hover:bg-violet-100 border border-violet-200"
              >
                Abrir ocorrência neste LEAD
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedLead.cte) return;
                  const occ = await authClient.getOccurrences({ cte: selectedLead.cte, leadId: selectedLead.id });
                  const count = Array.isArray(occ?.items) ? occ.items.length : 0;
                  window.alert(`Este lead possui ${count} ocorrência(s) vinculada(s).`);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 text-slate-700 font-semibold hover:bg-slate-100 border border-slate-200"
              >
                Ver histórico de ocorrências
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedLead.cte) return;
                  await authClient.createDossier({
                    cte: selectedLead.cte,
                    serie: "0",
                    generatedBy: user?.username || undefined,
                  });
                  const url = `/api/dossie/pdf?cte=${encodeURIComponent(selectedLead.cte)}&serie=0`;
                  window.open(url, "_blank");
                }}
                className="w-full px-3 py-2 text-xs rounded-lg bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 border border-indigo-200"
              >
                Gerar/baixar dossiê PDF
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">Contato</p>
              <p className="text-xs text-slate-700">
                Telefone: {selectedLead.phone || '—'}
              </p>
              {(selectedLead.ownerUsername || selectedLead.assignedUsername) && (
                <p className="text-xs text-slate-800 font-semibold">
                  Responsável: {selectedLead.assignedUsername || selectedLead.ownerUsername}
                </p>
              )}
              <p className="text-xs text-slate-700">
                CTE vinculado: {selectedLead.cte || '—'}
              </p>
              <p className="text-xs text-slate-700">
                Valor do frete:{' '}
                {typeof selectedLead.freteValue === 'number'
                  ? formatCurrency(selectedLead.freteValue)
                  : '—'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                Localização atual
              </p>
              <p className="text-xs text-slate-700">
                {selectedLead.currentLocation || 'Sem informação de rastreio vinculada.'}
              </p>
            </div>
            {onGoToChat && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                    Ações rápidas
                  </p>
                  <p className="text-xs text-slate-600">
                    Ir direto para o chat deste lead no CRM.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onGoToChat(selectedLead.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-sl-navy px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sl-red shadow-[0_0_18px_rgba(26,27,98,0.8)]"
                >
                  <ArrowRightCircle size={14} />
                  Ir para Chat
                </button>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                Histórico de ações
              </p>
              {(selectedLead.logs || []).length === 0 ? (
                <p className="text-[11px] text-gray-500">
                  Nenhum log registrado ainda para este lead.
                </p>
              ) : (
                <ul className="space-y-1">
                  {selectedLead.logs?.map((log, idx) => (
                    <li key={idx} className="text-[11px] text-slate-700">
                      • {log}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <AppConfirmModal
        open={deleteLeadConfirmOpen && !!selectedLead}
        title="Excluir lead"
        message={
          selectedLead
            ? `Excluir permanentemente o lead "${selectedLead.title}"? Esta ação não pode ser desfeita pelo painel.`
            : ''
        }
        confirmLabel="Excluir lead"
        cancelLabel="Cancelar"
        danger
        busy={isDeletingLead}
        onCancel={() => !isDeletingLead && setDeleteLeadConfirmOpen(false)}
        onConfirm={() => void performDeleteLead()}
      />
    </div>
  );
};

export default CrmFunnel;

