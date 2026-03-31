import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Page, UserData, ProfileData } from '../types';
import { Trash2, UserPlus, Save, Copy, Shield, Users, CheckSquare, Square, X, Activity, Search, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { authClient } from '../lib/auth';
import CrmOpsAdmin from './CrmOpsAdmin';
import { AppConfirmModal, AppMessageModal, type AppMessageVariant } from './AppOverlays';
import * as XLSX from 'xlsx';
import { PERMISSION_CATALOG } from '../lib/permissions';

const excludedViewPages = new Set<Page>([
  Page.CONFIGURACOES,
  Page.SOFIA_CONFIG,
  Page.MUDAR_SENHA,
]);

const viewLabelOverrides: Partial<Record<Page, string>> = {
  [Page.DASHBOARD]: 'Dashboard Operacional',
  [Page.PENDENCIAS]: 'Tela: Pendências',
  [Page.CRITICOS]: 'Tela: Críticos',
  [Page.EM_BUSCA]: 'Tela: Em Busca',
  [Page.TAD]: 'Tela: Processos TAD',
  [Page.CONCLUIDOS]: 'Tela: Concluídos/Resolvidos',
  [Page.CRM_DASHBOARD]: 'Tela: Dashboard CRM',
  [Page.CRM_FUNIL]: 'Tela: Funil de Rastreio',
  [Page.CRM_CHAT]: 'Tela: Chat IA',
  [Page.RELATORIOS]: 'Tela: Relatórios',
};

const humanizePage = (p: Page) => {
  if (viewLabelOverrides[p]) return viewLabelOverrides[p];
  const words = String(p).split('_').filter(Boolean);
  return words
    .map(w => {
      if (w.toLowerCase() === 'crm') return 'CRM';
      if (w.toLowerCase() === 'tad') return 'TAD';
      const lower = w.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
};

const autoViewPermissions = Array.from(
  new Set(
    Object.values(Page)
      .filter((p): p is Page => typeof p === 'string')
      .filter(p => !excludedViewPages.has(p))
      .map(p => ({ key: `VIEW_${String(p).toUpperCase()}`, label: humanizePage(p), description: `Acessar ${humanizePage(p).toLowerCase()}.` }))
  )
);

const PERMISSIONS: Array<{ key: string; label: string; description: string }> = [
  ...autoViewPermissions,
  // Ações (funções)
  { key: 'EDIT_NOTES', label: 'Ação: Criar/editar anotações', description: 'Permite registrar notas e marcar status (Em Busca/TAD/Resolvido).' },
  { key: 'ASSIGN_OPERATIONAL_PENDING', label: 'Ação: Atribuir pendência operacional', description: 'Permite atribuir/remover pendência da agência por CTE (unidade + responsável).' },
  { key: 'RETURN_OPERATIONAL_PENDING', label: 'Ação: Devolver pendência operacional', description: 'Permite devolver atribuição com motivo obrigatório.' },
  { key: 'EXPORT_DATA', label: 'Ação: Exportar dados', description: 'Permite exportar Excel nas tabelas.' },
  { key: 'EXPORT_SYSTEM_LOGS', label: 'Ação: Exportar logs', description: 'Permite exportar logs do sistema (CSV/Excel).' },
  { key: 'MANAGE_RASTREIO_OPERACIONAL', label: 'Ação: Atualizar rastreio operacional', description: 'Permite registrar atualizações manuais do rastreio (paradas, ônibus, fotos e status de descarga).' },
  // Administração
  { key: 'MANAGE_SETTINGS', label: 'Admin: Configurações', description: 'Acessar a área de configurações.' },
  { key: 'MANAGE_USERS', label: 'Admin: Usuários', description: 'Criar/remover usuários.' },
  { key: 'MANAGE_SOFIA', label: 'Admin: Sofia', description: 'Acessar configurações da Sofia.' },
  { key: 'MANAGE_CRM_OPS', label: 'Admin: Operação CRM', description: 'Gerenciar times, membros, regras e roteamento do CRM.' },
  { key: 'CRM_SCOPE_SELF', label: 'CRM Escopo: Somente próprio', description: 'Atendente vê apenas conversas atribuídas a ele.' },
  { key: 'CRM_SCOPE_TEAM', label: 'CRM Escopo: Equipe', description: 'Supervisor vê conversas da equipe e não atribuídas.' },
  { key: 'CRM_SCOPE_ALL', label: 'CRM Escopo: Global', description: 'Gestor vê todas as conversas.' },
  ...PERMISSION_CATALOG.map((p) => ({ key: p.key, label: p.label, description: p.description })),
];

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { users, profiles, baseData, addUser, deleteUser, saveProfile, deleteProfile, hasPermission } = useData();
  const [activeTab, setActiveTab] = useState<'USERS' | 'PROFILES' | 'LOGS' | 'CRM_OPS'>('USERS');

  // --- Logs Tab State ---
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string>('');
  const [logFilterCte, setLogFilterCte] = useState('');
  const [logFilterSerie, setLogFilterSerie] = useState('');
  const [logFilterEvent, setLogFilterEvent] = useState('');
  const [logLimit, setLogLimit] = useState(200);
  const canExportLogs = hasPermission('EXPORT_SYSTEM_LOGS') || hasPermission('MANAGE_SETTINGS');

  const exportLogsCsv = () => {
    if (!canExportLogs || logs.length === 0) return;
    void authClient.logEvent({ event: 'LOGS_EXPORT_CSV', username: user?.username || 'system', payload: { count: logs.length } });
    const headers = ['DATA', 'NIVEL', 'EVENTO', 'USUARIO', 'CTE', 'SERIE', 'DETALHES'];
    const lines: string[] = [headers.join(';')];
    for (const l of logs) {
      const row = [
        String(l.created_at || ''),
        String(l.level || ''),
        String(l.event || ''),
        String(l.username || ''),
        String(l.cte || ''),
        String(l.serie || ''),
        JSON.stringify(l.payload || {}),
      ].map((v) => (/[;"\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v));
      lines.push(row.join(';'));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOGS_SLE_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLogsXlsx = () => {
    if (!canExportLogs || logs.length === 0) return;
    void authClient.logEvent({ event: 'LOGS_EXPORT_XLSX', username: user?.username || 'system', payload: { count: logs.length } });
    const data = logs.map((l) => ({
      DATA: l.created_at || '',
      NIVEL: l.level || '',
      EVENTO: l.event || '',
      USUARIO: l.username || '',
      CTE: l.cte || '',
      SERIE: l.serie || '',
      DETALHES: l.payload ? JSON.stringify(l.payload) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Logs');
    XLSX.writeFile(wb, `LOGS_SLE_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // --- Users Tab State ---
  const [newUser, setNewUser] = useState<UserData>({
      username: '',
      password: '',
      role: '',
      linkedOriginUnit: '',
      linkedDestUnit: ''
  });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<{
    title: string;
    message: string;
    variant: AppMessageVariant;
  } | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<string | null>(null);
  const formatLastLogin = (value?: string) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR');
  };

  // --- Profiles Tab State ---
  const [editingProfile, setEditingProfile] = useState<ProfileData | null>(null);

  // --- Helpers ---
  // Extract unique units for dropdowns
  const uniqueUnits = useMemo(() => {
      const set = new Set<string>();
      baseData.forEach(d => {
          if (d.COLETA) set.add(d.COLETA);
          if (d.ENTREGA) set.add(d.ENTREGA);
      });
      return Array.from(set).sort();
  }, [baseData]);

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      const isEditing = !!editingUsername;
      if (!newUser.username || !newUser.role) {
          setSettingsNotice({
            title: 'Campos obrigatórios',
            message: 'Preencha usuário e perfil antes de salvar.',
            variant: 'warning',
          });
          return;
      }
      if (!isEditing && !newUser.password) {
          setSettingsNotice({
            title: 'Senha obrigatória',
            message: 'Ao criar um novo usuário, é necessário definir uma senha inicial.',
            variant: 'warning',
          });
          return;
      }
      await addUser(newUser);
      setNewUser({ username: '', password: '', role: '', linkedOriginUnit: '', linkedDestUnit: '' });
      setIsAddingUser(false);
      setEditingUsername(null);
  };

  const startEditUser = (u: UserData) => {
      setNewUser({
        username: u.username,
        password: '',
        role: u.role,
        linkedOriginUnit: u.linkedOriginUnit || '',
        linkedDestUnit: u.linkedDestUnit || '',
      });
      setEditingUsername(u.username);
      setIsAddingUser(true);
  };

  const cancelUserForm = () => {
      setNewUser({ username: '', password: '', role: '', linkedOriginUnit: '', linkedDestUnit: '' });
      setEditingUsername(null);
      setIsAddingUser(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProfile?.name) return;
      await saveProfile(editingProfile);
      setEditingProfile(null);
  };

  const togglePermission = (perm: string) => {
      if (!editingProfile) return;
      const current = editingProfile.permissions || [];
      const newPerms = current.includes(perm) 
          ? current.filter(p => p !== perm) 
          : [...current, perm];
      setEditingProfile({ ...editingProfile, permissions: newPerms });
  };

  useEffect(() => {
    if (activeTab !== 'LOGS') return;
    if (!hasPermission('MANAGE_SETTINGS')) return;
    let cancelled = false;
    setLogsLoading(true);
    setLogsError('');
    (async () => {
      try {
        const usp = new URLSearchParams();
        if (logFilterCte.trim()) usp.set('cte', logFilterCte.trim());
        if (logFilterSerie.trim()) usp.set('serie', logFilterSerie.trim());
        if (logFilterEvent.trim()) usp.set('event', logFilterEvent.trim());
        usp.set('limit', String(logLimit));
        const resp = await fetch(`/api/app_logs?${usp.toString()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!cancelled) setLogs(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setLogsError(e?.message || 'Falha ao carregar logs.');
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, hasPermission, logFilterCte, logFilterSerie, logFilterEvent, logLimit]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-slate-900">
      
      {/* Tabs */}
      <div className="surface-card-strong flex flex-wrap gap-1 border-b border-slate-300/70 p-2">
          <button 
             onClick={() => setActiveTab('USERS')}
             className={clsx(
                 "pressable-3d rounded-xl py-2.5 px-4 font-bold text-sm border border-transparent transition-all flex items-center gap-2",
                 activeTab === 'USERS'
                   ? "border-[#2c348c]/35 bg-gradient-to-b from-[#eef3ff] to-white text-[#1f2f86]"
                   : "text-slate-600 hover:text-slate-900 hover:bg-white"
             )}
          >
              <Users size={18} /> Gestão de Usuários
          </button>
          <button 
             onClick={() => setActiveTab('PROFILES')}
             className={clsx(
                 "pressable-3d rounded-xl py-2.5 px-4 font-bold text-sm border border-transparent transition-all flex items-center gap-2",
                 activeTab === 'PROFILES'
                   ? "border-[#2c348c] text-[#2c348c]"
                   : "border-transparent text-slate-500 hover:text-slate-800"
             )}
          >
              <Shield size={18} /> Perfis e Permissões
          </button>
          <button
            onClick={() => setActiveTab('LOGS')}
            className={clsx(
                 "pressable-3d rounded-xl py-2.5 px-4 font-bold text-sm border border-transparent transition-all flex items-center gap-2",
              activeTab === 'LOGS'
                ? "border-[#2c348c] text-[#2c348c]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Activity size={18} /> Logs do Sistema
          </button>
          <button
            onClick={() => setActiveTab('CRM_OPS')}
            className={clsx(
              "pressable-3d rounded-xl py-2.5 px-4 font-bold text-sm border border-transparent transition-all flex items-center gap-2",
              activeTab === 'CRM_OPS'
                ? "border-[#2c348c] text-[#2c348c]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Shield size={18} /> Operação CRM
          </button>
      </div>

      {/* --- USERS TAB --- */}
      {activeTab === 'USERS' && (
          <div className="space-y-6">
              {!hasPermission('MANAGE_USERS') && (
                <div className="surface-card p-6">
                  <h3 className="text-lg font-bold text-slate-900">Sem permissão</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Seu perfil não possui acesso à gestão de usuários.
                  </p>
                </div>
              )}

              {/* Add User Button/Form */}
              {hasPermission('MANAGE_USERS') && !isAddingUser ? (
                  <button 
                    onClick={() => setIsAddingUser(true)}
                    className="pressable-3d flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2c348c] to-[#1f2f86] px-4 py-2 font-bold text-white transition hover:brightness-105"
                  >
                      <UserPlus size={18} /> Adicionar Usuário
                  </button>
              ) : hasPermission('MANAGE_USERS') ? (
                  <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4">
                    <div className="surface-card-strong w-full max-w-5xl p-6 animate-in slide-in-from-top-2 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold text-slate-900">Novo Usuário</h3>
                          <button onClick={cancelUserForm} className="text-slate-500 hover:text-red-500"><X size={20}/></button>
                      </div>
                      <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600 uppercase">Usuário</label>
                              <input 
                                required
                                className="w-full p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-[#2c348c]/30 outline-none" 
                                value={newUser.username} 
                                onChange={e => setNewUser({...newUser, username: e.target.value})} 
                                disabled={!!editingUsername}
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600 uppercase">
                                {editingUsername ? 'Nova Senha (Opcional)' : 'Senha'}
                              </label>
                              <input 
                                required={!editingUsername}
                                className="w-full p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-[#2c348c]/30 outline-none" 
                                value={newUser.password} 
                                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                                placeholder={editingUsername ? 'Deixe vazio para manter a senha atual' : ''}
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600 uppercase">Perfil</label>
                              <select 
                                required
                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-[#2c348c]/30 outline-none bg-slate-50 text-slate-800"
                                value={newUser.role}
                                onChange={e => setNewUser({...newUser, role: e.target.value})}
                              >
                                  <option value="">Selecione...</option>
                                  {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600 uppercase">Unidade Origem (Opcional)</label>
                              <select 
                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-[#2c348c]/30 outline-none bg-slate-50 text-slate-800"
                                value={newUser.linkedOriginUnit}
                                onChange={e => setNewUser({...newUser, linkedOriginUnit: e.target.value})}
                              >
                                  <option value="">Nenhuma</option>
                                  {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600 uppercase">Unidade Destino (Opcional)</label>
                              <select 
                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-[#2c348c]/30 outline-none bg-slate-50 text-slate-800"
                                value={newUser.linkedDestUnit}
                                onChange={e => setNewUser({...newUser, linkedDestUnit: e.target.value})}
                              >
                                  <option value="">Nenhuma</option>
                                  {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                          <div className="md:col-span-2 lg:col-span-1 flex items-end">
                              <button type="submit" className="pressable-3d w-full rounded bg-gradient-to-r from-emerald-600 to-emerald-700 p-2 font-bold text-white transition hover:brightness-105">
                                  {editingUsername ? 'Salvar Edição' : 'Salvar'}
                              </button>
                          </div>
                      </form>
                    </div>
                  </div>
              ) : null}

              {/* Users Table */}
              {hasPermission('MANAGE_USERS') && (
                <div className="table-shell">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs">
                          <tr>
                              <th className="px-4 py-3">Usuário</th>
                              <th className="px-4 py-3">Perfil</th>
                              <th className="px-4 py-3">Origem</th>
                              <th className="px-4 py-3">Destino</th>
                              <th className="px-4 py-3">Último login</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                          {users.map(u => (
                              <tr key={u.username} className="odd:bg-white even:bg-slate-50/45 hover:bg-slate-100/70">
                                  <td className="px-4 py-3 font-medium text-slate-900">{u.username}</td>
                                  <td className="px-4 py-3">
                                      <span className="rounded-full border border-indigo-300 bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-800">
                                        {u.role}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{u.linkedOriginUnit || '-'}</td>
                                  <td className="px-4 py-3 text-slate-600">{u.linkedDestUnit || '-'}</td>
                                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatLastLogin(u.lastLoginAt)}</td>
                                  <td className="px-4 py-3 text-right">
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          onClick={() => startEditUser(u)}
                                          className="text-slate-500 hover:text-[#2c348c] p-1"
                                          title="Editar usuário"
                                        >
                                          <Pencil size={16} />
                                        </button>
                                        {u.username.toLowerCase() !== 'admin' && (
                                            <button 
                                              onClick={() => setConfirmDeleteUser(u.username)}
                                              className="text-slate-500 hover:text-red-500 p-1"
                                              title="Excluir usuário"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                </div>
              )}
          </div>
      )}

      {/* --- PROFILES TAB --- */}
      {activeTab === 'PROFILES' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profiles List */}
              <div className="md:col-span-1 space-y-3">
                  <button 
                      onClick={() => setEditingProfile({ name: '', description: '', permissions: [] })}
                      className="pressable-3d mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300/80 bg-gradient-to-b from-white to-slate-50 py-2 font-bold text-slate-800 transition hover:border-[#2c348c]/30"
                  >
                      <UserPlus size={16} /> Novo Perfil
                  </button>
                  
                  {profiles.map(p => (
                      <div 
                        key={p.name} 
                        className={clsx(
                            "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                            editingProfile?.name === p.name
                              ? "bg-slate-50 border-[#2c348c]/40 ring-1 ring-[#2c348c]/25"
                              : "bg-white border-slate-200"
                        )}
                        onClick={() => setEditingProfile(p)}
                      >
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="font-bold text-slate-900">{p.name}</h4>
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                              </div>
                              <div className="flex gap-1">
                                  <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProfile({ ...p, name: `${p.name}_COPY` });
                                    }}
                                    className="p-1 text-slate-500 hover:text-blue-400" title="Copiar"
                                  >
                                      <Copy size={14} />
                                  </button>
                                  {p.name?.toUpperCase() !== 'ADMIN' && (
                                      <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteProfile(p.name);
                                        }}
                                        className="p-1 text-slate-500 hover:text-red-500" title="Excluir"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Profile Editor */}
              <div className="md:col-span-2">
                  {editingProfile ? (
                      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4">
                        <div className="surface-card-strong w-full max-w-6xl p-6 animate-in fade-in max-h-[92vh] overflow-y-auto">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="text-xl font-bold text-slate-900">
                                  {editingProfile.name ? `Editando: ${editingProfile.name}` : 'Criar Novo Perfil'}
                              </h3>
                              <button onClick={() => setEditingProfile(null)} className="text-slate-500 hover:text-slate-700"><X size={24}/></button>
                          </div>
                          
                          <form onSubmit={handleSaveProfile} className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-slate-600 uppercase">Nome do Perfil</label>
                                      <input 
                                        required
                                        className="w-full p-2.5 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-[#2c348c]/30 outline-none"
                                        value={editingProfile.name}
                                        onChange={e => setEditingProfile({...editingProfile, name: e.target.value})}
                                        disabled={profiles.some(p => p.name === editingProfile.name && p.name?.toUpperCase() === 'ADMIN')} // Admin name locked
                                      />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-slate-600 uppercase">Descrição</label>
                                      <input 
                                        className="w-full p-2.5 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-[#2c348c]/30 outline-none"
                                        value={editingProfile.description}
                                        onChange={e => setEditingProfile({...editingProfile, description: e.target.value})}
                                      />
                                  </div>
                              </div>

                              <div>
                                  <label className="text-xs font-bold text-slate-600 uppercase mb-3 block">Permissões de Acesso</label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {PERMISSIONS.map(({ key, label, description }) => {
                                          const isChecked = editingProfile.permissions?.includes(key);
                                          return (
                                              <div 
                                                key={key} 
                                                onClick={() => togglePermission(key)}
                                                className={clsx(
                                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none",
                                                    isChecked
                                                      ? "border-[#2c348c]/40 bg-slate-50 text-slate-900"
                                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                                )}
                                              >
                                                  {isChecked ? <CheckSquare size={20} className="text-[#2c348c]" /> : <Square size={20} />}
                                                  <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-slate-800">{label}</span>
                                                    <span className="text-[11px] text-slate-500">{description}</span>
                                                    <span className="mt-1 font-mono text-[10px] text-[#2c348c]/80">{key}</span>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>

                              <div className="flex justify-end pt-4 border-t border-slate-200">
                                  <button type="submit" className="pressable-3d flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2c348c] to-[#1f2f86] px-6 py-2.5 font-bold text-white transition hover:brightness-105">
                                      <Save size={18} /> Salvar Alterações
                                  </button>
                              </div>
                          </form>
                        </div>
                      </div>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl p-8 bg-white">
                          <Shield size={48} className="mb-4 opacity-20" />
                          <p className="text-center font-medium">Selecione um perfil ao lado para editar<br/>ou crie um novo.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- LOGS TAB --- */}
      {activeTab === 'LOGS' && (
        <div className="space-y-4">
          {!hasPermission('MANAGE_SETTINGS') ? (
            <div className="surface-card p-6">
              <h3 className="text-lg font-bold text-slate-900">Sem permissão</h3>
              <p className="text-sm text-slate-500 mt-1">
                Seu perfil não possui acesso aos logs do sistema.
              </p>
            </div>
          ) : (
            <>
              <div className="surface-card-strong p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Search size={16} className="text-[#2c348c]" /> Filtros
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={logLimit}
                      onChange={(e) => setLogLimit(parseInt(e.target.value, 10) || 200)}
                      className="px-2 py-1 rounded border border-slate-200 bg-slate-50 text-xs text-slate-800"
                    >
                      <option value={50}>50</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                    <button
                      onClick={async () => {
                        try {
                          await authClient.logEvent({
                            event: 'LOGS_VIEW_REFRESH',
                            username: 'system',
                            payload: { cte: logFilterCte, serie: logFilterSerie, event: logFilterEvent },
                          });
                        } catch {}
                        // trigger reload via state change
                        setLogLimit((v) => v);
                      }}
                      className="pressable-3d px-3 py-1 rounded bg-gradient-to-b from-white to-slate-50 border border-slate-300/80 text-xs font-bold text-slate-700 hover:border-[#2c348c]/30"
                      type="button"
                    >
                      Recarregar
                    </button>
                    <button
                      type="button"
                      onClick={exportLogsCsv}
                      disabled={!canExportLogs || logsLoading || logs.length === 0}
                      className="pressable-3d px-3 py-1 rounded bg-gradient-to-b from-white to-slate-50 border border-slate-300/80 text-xs font-bold text-slate-700 disabled:opacity-50 hover:border-[#2c348c]/30"
                    >
                      Exportar CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportLogsXlsx}
                      disabled={!canExportLogs || logsLoading || logs.length === 0}
                      className="pressable-3d px-3 py-1 rounded bg-gradient-to-b from-white to-slate-50 border border-slate-300/80 text-xs font-bold text-slate-700 disabled:opacity-50 hover:border-[#2c348c]/30"
                    >
                      Exportar Excel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">CTE</label>
                    <input
                      value={logFilterCte}
                      onChange={(e) => setLogFilterCte(e.target.value)}
                      placeholder="Ex.: 123456"
                      className="w-full p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Série</label>
                    <input
                      value={logFilterSerie}
                      onChange={(e) => setLogFilterSerie(e.target.value)}
                      placeholder="Ex.: 001"
                      className="w-full p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Evento</label>
                    <input
                      value={logFilterEvent}
                      onChange={(e) => setLogFilterEvent(e.target.value)}
                      placeholder="Ex.: CTE_RESOLVE"
                      className="w-full p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>

              {logsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                  {logsError}
                </div>
              )}

              <div className="table-shell">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800">Últimos logs</div>
                  <div className="text-[11px] text-slate-500">
                    {logsLoading ? 'Carregando…' : `${logs.length} registro(s)`}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Nível</th>
                        <th className="px-4 py-3">Evento</th>
                        <th className="px-4 py-3">Usuário</th>
                        <th className="px-4 py-3">CTE/Série</th>
                        <th className="px-4 py-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {logs.map((l) => {
                        const level = String(l.level || 'INFO').toUpperCase();
                        const isError = level === 'ERROR';
                        return (
                          <tr key={l.id} className={clsx("odd:bg-white even:bg-slate-50/45 hover:bg-slate-100/70", isError && "bg-red-50")}>
                            <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap">{l.created_at}</td>
                            <td className="px-4 py-3">
                              <span
                                className={clsx(
                                  "px-2 py-0.5 rounded-full text-[10px] font-black border",
                                  level === 'ERROR'
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : level === 'WARN'
                                      ? "bg-orange-100 text-orange-800 border-orange-300"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                )}
                              >
                                {level}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-indigo-700">{l.event}</td>
                            <td className="px-4 py-3 text-slate-700">{l.username || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {l.cte ? `${l.cte}` : '-'}
                              {l.serie ? <span className="text-slate-500"> / {l.serie}</span> : ''}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <pre className="max-h-28 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[10px] whitespace-pre-wrap break-words text-slate-700">
                                {l.payload ? JSON.stringify(l.payload, null, 2) : ''}
                              </pre>
                            </td>
                          </tr>
                        );
                      })}
                      {!logsLoading && logs.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                            Nenhum log encontrado para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'CRM_OPS' && (
        <div className="space-y-4">
          {!hasPermission('MANAGE_CRM_OPS') && !hasPermission('MANAGE_SETTINGS') ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Sem permissão</h3>
              <p className="text-sm text-slate-500 mt-1">
                Seu perfil não possui acesso à operação avançada do CRM.
              </p>
            </div>
          ) : (
            <CrmOpsAdmin />
          )}
        </div>
      )}

      <AppMessageModal
        open={!!settingsNotice}
        title={settingsNotice?.title || ''}
        message={settingsNotice?.message || ''}
        variant={settingsNotice?.variant || 'info'}
        onClose={() => setSettingsNotice(null)}
      />

      <AppConfirmModal
        open={!!confirmDeleteUser}
        title="Remover usuário"
        message={
          confirmDeleteUser
            ? `Remover o usuário "${confirmDeleteUser}"? Ele perderá acesso imediato ao sistema.`
            : ''
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setConfirmDeleteUser(null)}
        onConfirm={() => {
          if (confirmDeleteUser) {
            void deleteUser(confirmDeleteUser);
            setConfirmDeleteUser(null);
          }
        }}
      />

      <AppConfirmModal
        open={!!confirmDeleteProfile}
        title="Excluir perfil"
        message={
          confirmDeleteProfile
            ? `Excluir o perfil "${confirmDeleteProfile}"? Usuários que usem esse perfil precisarão ser reatribuídos.`
            : ''
        }
        confirmLabel="Excluir perfil"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setConfirmDeleteProfile(null)}
        onConfirm={() => {
          if (confirmDeleteProfile) {
            void deleteProfile(confirmDeleteProfile);
            setConfirmDeleteProfile(null);
          }
        }}
      />
    </div>
  );
};

export default Settings;