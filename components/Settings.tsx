import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { UserData, ProfileData } from '../types';
import { Trash2, UserPlus, Save, Copy, Shield, Users, CheckSquare, Square, X, Activity, Search } from 'lucide-react';
import clsx from 'clsx';
import { authClient } from '../lib/auth';

const PERMISSIONS: Array<{ key: string; label: string; description: string }> = [
  // Operacional (telas)
  { key: 'VIEW_DASHBOARD', label: 'Dashboard Operacional', description: 'Acessar a visão geral e indicadores.' },
  { key: 'VIEW_PENDENCIAS', label: 'Tela: Pendências', description: 'Acessar a lista de pendências.' },
  { key: 'VIEW_CRITICOS', label: 'Tela: Críticos', description: 'Acessar a lista de pendências críticas.' },
  { key: 'VIEW_EM_BUSCA', label: 'Tela: Em Busca', description: 'Acessar a lista de mercadorias em busca.' },
  { key: 'VIEW_TAD', label: 'Tela: Processos TAD', description: 'Acessar a lista de processos de TAD.' },
  { key: 'VIEW_CONCLUIDOS', label: 'Tela: Concluídos/Resolvidos', description: 'Acessar a lista de concluídos e resolvidos.' },
  // CRM (telas)
  { key: 'VIEW_CRM_DASHBOARD', label: 'Tela: Dashboard CRM', description: 'Acessar o dashboard do CRM.' },
  { key: 'VIEW_CRM_FUNIL', label: 'Tela: Funil de Rastreio', description: 'Acessar o funil de rastreio.' },
  { key: 'VIEW_CRM_CHAT', label: 'Tela: Chat IA', description: 'Acessar o chat CRM.' },
  // Ações (funções)
  { key: 'EDIT_NOTES', label: 'Ação: Criar/editar anotações', description: 'Permite registrar notas e marcar status (Em Busca/TAD/Resolvido).' },
  { key: 'EXPORT_DATA', label: 'Ação: Exportar dados', description: 'Permite exportar Excel nas tabelas.' },
  // Administração
  { key: 'MANAGE_SETTINGS', label: 'Admin: Configurações', description: 'Acessar a área de configurações.' },
  { key: 'MANAGE_USERS', label: 'Admin: Usuários', description: 'Criar/remover usuários.' },
  { key: 'MANAGE_SOFIA', label: 'Admin: Sofia', description: 'Acessar configurações da Sofia.' },
];

const Settings: React.FC = () => {
  const { users, profiles, baseData, addUser, deleteUser, saveProfile, deleteProfile, hasPermission } = useData();
  const [activeTab, setActiveTab] = useState<'USERS' | 'PROFILES' | 'LOGS'>('USERS');

  // --- Logs Tab State ---
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string>('');
  const [logFilterCte, setLogFilterCte] = useState('');
  const [logFilterSerie, setLogFilterSerie] = useState('');
  const [logFilterEvent, setLogFilterEvent] = useState('');
  const [logLimit, setLogLimit] = useState(200);

  // --- Users Tab State ---
  const [newUser, setNewUser] = useState<UserData>({
      username: '',
      password: '',
      role: '',
      linkedOriginUnit: '',
      linkedDestUnit: ''
  });
  const [isAddingUser, setIsAddingUser] = useState(false);

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
      if (!newUser.username || !newUser.password || !newUser.role) {
          alert("Preencha os campos obrigatórios");
          return;
      }
      await addUser(newUser);
      setNewUser({ username: '', password: '', role: '', linkedOriginUnit: '', linkedDestUnit: '' });
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
    <div className="space-y-6 animate-in fade-in duration-500 text-white">
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-[#1A1B62]">
          <button 
             onClick={() => setActiveTab('USERS')}
             className={clsx(
                 "py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2",
                 activeTab === 'USERS'
                   ? "border-primary-500 text-primary-300"
                   : "border-transparent text-gray-400 hover:text-gray-200"
             )}
          >
              <Users size={18} /> Gestão de Usuários
          </button>
          <button 
             onClick={() => setActiveTab('PROFILES')}
             className={clsx(
                 "py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2",
                 activeTab === 'PROFILES'
                   ? "border-primary-500 text-primary-300"
                   : "border-transparent text-gray-400 hover:text-gray-200"
             )}
          >
              <Shield size={18} /> Perfis e Permissões
          </button>
          <button
            onClick={() => setActiveTab('LOGS')}
            className={clsx(
              "py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'LOGS'
                ? "border-primary-500 text-primary-300"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            <Activity size={18} /> Logs do Sistema
          </button>
      </div>

      {/* --- USERS TAB --- */}
      {activeTab === 'USERS' && (
          <div className="space-y-6">
              {!hasPermission('MANAGE_USERS') && (
                <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-white">Sem permissão</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Seu perfil não possui acesso à gestão de usuários.
                  </p>
                </div>
              )}

              {/* Add User Button/Form */}
              {hasPermission('MANAGE_USERS') && !isAddingUser ? (
                  <button 
                    onClick={() => setIsAddingUser(true)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-700 transition flex items-center gap-2 shadow-sm"
                  >
                      <UserPlus size={18} /> Adicionar Usuário
                  </button>
              ) : hasPermission('MANAGE_USERS') ? (
                  <div className="bg-[#070A20] p-6 rounded-xl border border-[#1E226F] shadow-sm animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg text-white">Novo Usuário</h3>
                          <button onClick={() => setIsAddingUser(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                      </div>
                      <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-300 uppercase">Usuário</label>
                              <input 
                                required
                                className="w-full p-2 rounded border border-[#1A1B62] bg-[#080816] text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 outline-none" 
                                value={newUser.username} 
                                onChange={e => setNewUser({...newUser, username: e.target.value})} 
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-300 uppercase">Senha</label>
                              <input 
                                required
                                className="w-full p-2 rounded border border-[#1A1B62] bg-[#080816] text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 outline-none" 
                                value={newUser.password} 
                                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-300 uppercase">Perfil</label>
                              <select 
                                required
                                className="w-full p-2 rounded border border-[#1A1B62] focus:ring-2 focus:ring-primary-500 outline-none bg-[#080816] text-gray-100"
                                value={newUser.role}
                                onChange={e => setNewUser({...newUser, role: e.target.value})}
                              >
                                  <option value="">Selecione...</option>
                                  {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-300 uppercase">Unidade Origem (Opcional)</label>
                              <select 
                                className="w-full p-2 rounded border border-[#1A1B62] focus:ring-2 focus:ring-primary-500 outline-none bg-[#080816] text-gray-100"
                                value={newUser.linkedOriginUnit}
                                onChange={e => setNewUser({...newUser, linkedOriginUnit: e.target.value})}
                              >
                                  <option value="">Nenhuma</option>
                                  {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-300 uppercase">Unidade Destino (Opcional)</label>
                              <select 
                                className="w-full p-2 rounded border border-[#1A1B62] focus:ring-2 focus:ring-primary-500 outline-none bg-[#080816] text-gray-100"
                                value={newUser.linkedDestUnit}
                                onChange={e => setNewUser({...newUser, linkedDestUnit: e.target.value})}
                              >
                                  <option value="">Nenhuma</option>
                                  {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                          <div className="md:col-span-2 lg:col-span-1 flex items-end">
                              <button type="submit" className="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700 transition">
                                  Salvar
                              </button>
                          </div>
                      </form>
                  </div>
              ) : null}

              {/* Users Table */}
              {hasPermission('MANAGE_USERS') && (
                <div className="bg-[#070A20] rounded-lg shadow border border-[#1E226F] overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-[#080816] text-gray-200 uppercase font-bold text-xs">
                          <tr>
                              <th className="px-4 py-3">Usuário</th>
                              <th className="px-4 py-3">Perfil</th>
                              <th className="px-4 py-3">Origem</th>
                              <th className="px-4 py-3">Destino</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1B62]">
                          {users.map(u => (
                              <tr key={u.username} className="hover:bg-[#080816]">
                                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                                  <td className="px-4 py-3">
                                      <span className="px-2 py-1 bg-blue-900/40 text-blue-200 rounded-full text-xs font-bold">
                                        {u.role}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-300">{u.linkedOriginUnit || '-'}</td>
                                  <td className="px-4 py-3 text-gray-300">{u.linkedDestUnit || '-'}</td>
                                  <td className="px-4 py-3 text-right">
                                      {u.username.toLowerCase() !== 'admin' && (
                                          <button 
                                            onClick={() => { if(confirm(`Remover ${u.username}?`)) deleteUser(u.username) }}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                          >
                                              <Trash2 size={16} />
                                          </button>
                                      )}
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
                      className="w-full py-2 bg-[#070A20] text-primary-200 font-bold rounded-lg border border-[#1E226F] hover:bg-[#0F1440] transition flex justify-center items-center gap-2 mb-4"
                  >
                      <UserPlus size={16} /> Novo Perfil
                  </button>
                  
                  {profiles.map(p => (
                      <div 
                        key={p.name} 
                        className={clsx(
                            "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                            editingProfile?.name === p.name
                              ? "bg-[#080816] border-[#6E71DA] ring-1 ring-[#6E71DA]/60"
                              : "bg-[#070A20] border-[#1E226F]"
                        )}
                        onClick={() => setEditingProfile(p)}
                      >
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="font-bold text-white">{p.name}</h4>
                                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>
                              </div>
                              <div className="flex gap-1">
                                  <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProfile({ ...p, name: `${p.name}_COPY` });
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-400" title="Copiar"
                                  >
                                      <Copy size={14} />
                                  </button>
                                  {p.name?.toUpperCase() !== 'ADMIN' && (
                                      <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(confirm(`Excluir perfil ${p.name}?`)) deleteProfile(p.name);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500" title="Excluir"
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
                      <div className="bg-[#070A20] p-6 rounded-xl border border-[#1E226F] shadow-sm animate-in fade-in">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="text-xl font-bold text-white">
                                  {editingProfile.name ? `Editando: ${editingProfile.name}` : 'Criar Novo Perfil'}
                              </h3>
                              <button onClick={() => setEditingProfile(null)} className="text-gray-400 hover:text-gray-200"><X size={24}/></button>
                          </div>
                          
                          <form onSubmit={handleSaveProfile} className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-gray-300 uppercase">Nome do Perfil</label>
                                      <input 
                                        required
                                        className="w-full p-2.5 rounded border border-[#1A1B62] bg-[#080816] text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={editingProfile.name}
                                        onChange={e => setEditingProfile({...editingProfile, name: e.target.value})}
                                        disabled={profiles.some(p => p.name === editingProfile.name && p.name?.toUpperCase() === 'ADMIN')} // Admin name locked
                                      />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-gray-300 uppercase">Descrição</label>
                                      <input 
                                        className="w-full p-2.5 rounded border border-[#1A1B62] bg-[#080816] text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={editingProfile.description}
                                        onChange={e => setEditingProfile({...editingProfile, description: e.target.value})}
                                      />
                                  </div>
                              </div>

                              <div>
                                  <label className="text-xs font-bold text-gray-300 uppercase mb-3 block">Permissões de Acesso</label>
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
                                                      ? "bg-[#080816] border-[#6E71DA] text-primary-100"
                                                      : "bg-[#070A20] border-[#1E226F] text-gray-300 hover:bg-[#0F1440]"
                                                )}
                                              >
                                                  {isChecked ? <CheckSquare size={20} className="text-primary-400" /> : <Square size={20} />}
                                                  <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-gray-100">{label}</span>
                                                    <span className="text-[11px] text-gray-400">{description}</span>
                                                    <span className="text-[10px] font-mono text-[#6E71DA] mt-1">{key}</span>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>

                              <div className="flex justify-end pt-4 border-t border-[#1A1B62]">
                                  <button type="submit" className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary-700 transition flex items-center gap-2 shadow-lg shadow-primary-500/20">
                                      <Save size={18} /> Salvar Alterações
                                  </button>
                              </div>
                          </form>
                      </div>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-[#1E226F] rounded-xl p-8 bg-[#070A20]">
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
            <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white">Sem permissão</h3>
              <p className="text-sm text-gray-400 mt-1">
                Seu perfil não possui acesso aos logs do sistema.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-[#070A20] border border-[#1E226F] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-100">
                    <Search size={16} className="text-[#6E71DA]" /> Filtros
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={logLimit}
                      onChange={(e) => setLogLimit(parseInt(e.target.value, 10) || 200)}
                      className="px-2 py-1 rounded border border-[#1A1B62] bg-[#080816] text-xs text-gray-100"
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
                      className="px-3 py-1 rounded bg-[#080816] border border-[#1A1B62] text-xs font-bold text-gray-200 hover:bg-[#0F1440]"
                      type="button"
                    >
                      Recarregar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-300 uppercase">CTE</label>
                    <input
                      value={logFilterCte}
                      onChange={(e) => setLogFilterCte(e.target.value)}
                      placeholder="Ex.: 123456"
                      className="w-full p-2 rounded border border-[#1A1B62] bg-[#080816] text-gray-100 placeholder-gray-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-300 uppercase">Série</label>
                    <input
                      value={logFilterSerie}
                      onChange={(e) => setLogFilterSerie(e.target.value)}
                      placeholder="Ex.: 001"
                      className="w-full p-2 rounded border border-[#1A1B62] bg-[#080816] text-gray-100 placeholder-gray-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-300 uppercase">Evento</label>
                    <input
                      value={logFilterEvent}
                      onChange={(e) => setLogFilterEvent(e.target.value)}
                      placeholder="Ex.: CTE_RESOLVE"
                      className="w-full p-2 rounded border border-[#1A1B62] bg-[#080816] text-gray-100 placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>

              {logsError && (
                <div className="bg-red-900/60 border border-red-500/70 text-red-100 p-4 rounded-lg">
                  {logsError}
                </div>
              )}

              <div className="bg-[#070A20] rounded-lg shadow border border-[#1E226F] overflow-hidden">
                <div className="px-4 py-3 bg-[#080816] border-b border-[#1A1B62] flex items-center justify-between">
                  <div className="text-sm font-bold text-gray-100">Últimos logs</div>
                  <div className="text-[11px] text-gray-400">
                    {logsLoading ? 'Carregando…' : `${logs.length} registro(s)`}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#080816] text-gray-200 uppercase font-bold text-xs">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Nível</th>
                        <th className="px-4 py-3">Evento</th>
                        <th className="px-4 py-3">Usuário</th>
                        <th className="px-4 py-3">CTE/Série</th>
                        <th className="px-4 py-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A1B62]">
                      {logs.map((l) => {
                        const level = String(l.level || 'INFO').toUpperCase();
                        const isError = level === 'ERROR';
                        return (
                          <tr key={l.id} className={clsx("hover:bg-[#080816]", isError && "bg-red-900/25")}>
                            <td className="px-4 py-3 text-[12px] text-gray-300 whitespace-nowrap">{l.created_at}</td>
                            <td className="px-4 py-3">
                              <span
                                className={clsx(
                                  "px-2 py-0.5 rounded-full text-[10px] font-black border",
                                  level === 'ERROR'
                                    ? "bg-red-900/60 text-red-100 border-red-500/70"
                                    : level === 'WARN'
                                      ? "bg-orange-900/60 text-orange-100 border-orange-500/70"
                                      : "bg-emerald-900/40 text-emerald-100 border-emerald-500/50"
                                )}
                              >
                                {level}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-[#C7CBFF]">{l.event}</td>
                            <td className="px-4 py-3 text-gray-200">{l.username || '-'}</td>
                            <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                              {l.cte ? `${l.cte}` : '-'}
                              {l.serie ? <span className="text-gray-500"> / {l.serie}</span> : ''}
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              <pre className="text-[10px] whitespace-pre-wrap break-words bg-[#050511] border border-[#151745] rounded p-2 max-h-28 overflow-auto">
                                {l.payload ? JSON.stringify(l.payload, null, 2) : ''}
                              </pre>
                            </td>
                          </tr>
                        );
                      })}
                      {!logsLoading && logs.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
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
    </div>
  );
};

export default Settings;