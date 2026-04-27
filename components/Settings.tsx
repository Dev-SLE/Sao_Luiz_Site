import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { UserData, ProfileData } from '../types';
import {
  Trash2,
  UserPlus,
  Save,
  Copy,
  Shield,
  Users,
  CheckSquare,
  Square,
  X,
  Activity,
  Search,
  Pencil,
  KeyRound,
  Loader2,
  Download,
  Upload,
} from 'lucide-react';
import clsx from 'clsx';
import { authClient } from '../lib/auth';
import { AppConfirmModal, AppMessageModal, type AppMessageVariant } from './AppOverlays';
import * as XLSX from 'xlsx';
import { BI_COMISSOES_CONFIG } from '@/modules/bi/comissoes/config';
import { validateStrongPassword } from '@/lib/server/passwordPolicy';
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUP_LABELS,
  PERMISSION_GROUP_ORDER,
  PERMISSION_SECTION_LABELS,
  PERMISSION_SECTION_ORDER,
  getProfileCheckboxEquivalence,
  type PermissionGroup,
  type PermissionSectionId,
} from '../lib/permissions';
import { OPERACIONAL_MODULE_KEY, stripOperacionalPermissionsWithoutModule } from '@/lib/workspacePermissionNormalize';
import { isImmutableMasterUsername } from '@/lib/adminSuperRoles';

type ProfilePermissionRow = {
  key: string;
  label: string;
  description: string;
  section: PermissionSectionId;
  /** Subcamada dentro da secção (MODULO, ABA, …). */
  group: PermissionGroup;
};

/** Linhas do editor de perfis = catálogo canónico (sem duplicar chaves legadas na UI). */
const PROFILE_PERMISSION_ROWS: ProfilePermissionRow[] = PERMISSION_CATALOG.map((p) => ({
  key: p.key,
  label: p.label,
  description: p.description,
  section: p.section,
  group: p.group,
}));

function groupProfilePermissions(rows: ProfilePermissionRow[]): Record<PermissionSectionId, ProfilePermissionRow[]> {
  const out = {} as Record<PermissionSectionId, ProfilePermissionRow[]>;
  for (const id of PERMISSION_SECTION_ORDER) {
    out[id] = [];
  }
  for (const r of rows) {
    out[r.section].push(r);
  }
  const rank = (g: PermissionGroup) => {
    const i = PERMISSION_GROUP_ORDER.indexOf(g);
    return i === -1 ? 999 : i;
  };
  for (const id of PERMISSION_SECTION_ORDER) {
    out[id].sort((a, b) => {
      const d = rank(a.group) - rank(b.group);
      if (d !== 0) return d;
      return a.label.localeCompare(b.label, 'pt');
    });
  }
  return out;
}

/** Modelos de permissão (chaves canónicas) — aplicar substitui a lista atual. */
const PROFILE_PRESETS: { id: string; label: string; permissions: string[] }[] = [
  {
    id: 'op-leitura-unidade',
    label: 'Operacional: leitura na unidade',
    permissions: [
      'module.operacional.view',
      'scope.operacional.unit.self',
      'tab.operacional.visao_geral.view',
      'tab.operacional.pendencias.view',
      'tab.operacional.criticos.view',
      'tab.operacional.em_busca.view',
      'tab.operacional.ocorrencias.view',
      'tab.operacional.concluidos.view',
      'tab.operacional.rastreio.view',
    ],
  },
  {
    id: 'crm-atendente',
    label: 'CRM: atendimento (funil + chat)',
    permissions: [
      'module.crm.view',
      'scope.crm.self',
      'tab.crm.funil.view',
      'tab.crm.chat.view',
      'tab.crm.dashboard.view',
      'crm.leads.view',
      'crm.messages.send',
    ],
  },
];

const Settings: React.FC = () => {
  const { user } = useAuth();
  const {
    users,
    profiles,
    baseData,
    addUser,
    deleteUser,
    saveProfile,
    deleteProfile,
    hasPermission,
    refreshData,
  } = useData();
  const [activeTab, setActiveTab] = useState<'USERS' | 'PROFILES' | 'LOGS'>('PROFILES');

  // --- Logs Tab State ---
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string>('');
  const [logFilterCte, setLogFilterCte] = useState('');
  const [logFilterSerie, setLogFilterSerie] = useState('');
  const [logFilterEvent, setLogFilterEvent] = useState('');
  const [logLimit, setLogLimit] = useState(200);
  const [profilePermSearch, setProfilePermSearch] = useState('');
  const canExportLogs = hasPermission('EXPORT_SYSTEM_LOGS') || hasPermission('MANAGE_SETTINGS');
  const showUsersTab = hasPermission('MANAGE_USERS');
  const showProfilesTab = hasPermission('MANAGE_SETTINGS');
  const showLogsTab = hasPermission('MANAGE_SETTINGS');

  useEffect(() => {
    if (activeTab === 'USERS' && !showUsersTab) setActiveTab('PROFILES');
    if (activeTab === 'LOGS' && !showLogsTab) setActiveTab('PROFILES');
  }, [activeTab, showUsersTab, showLogsTab]);

  const profilePermissionRowsFiltered = useMemo(() => {
    const q = profilePermSearch.trim().toLowerCase();
    if (!q) return PROFILE_PERMISSION_ROWS;
    return PROFILE_PERMISSION_ROWS.filter(
      (r) =>
        r.key.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [profilePermSearch]);

  const profilePermissionsBySection = useMemo(
    () => groupProfilePermissions(profilePermissionRowsFiltered),
    [profilePermissionRowsFiltered],
  );

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
      linkedDestUnit: '',
      linkedBiVendedora: '',
  });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<{
    title: string;
    message: string;
    variant: AppMessageVariant;
  } | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<UserData | null>(null);
  const [resetPwdNew, setResetPwdNew] = useState('');
  const [resetPwdConfirm, setResetPwdConfirm] = useState('');
  const [resetPwdForceChange, setResetPwdForceChange] = useState(true);
  const [resetPwdLoading, setResetPwdLoading] = useState(false);
  const [resetPwdError, setResetPwdError] = useState('');
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkImportBusy, setBulkImportBusy] = useState(false);
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<string | null>(null);
  const formatLastLogin = (value?: string) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR');
  };

  const canManageUserRow = (target: UserData) => {
    const targetUsername = String(target.username || '').trim();
    if (!targetUsername) return false;
    const isSelf = targetUsername.toLowerCase() === String(user?.username || '').trim().toLowerCase();
    if (isSelf) return false;
    if (isImmutableMasterUsername(targetUsername)) return false;
    return true;
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

  const biVendedoraOptions = useMemo(() => [...BI_COMISSOES_CONFIG.vendedorFinalAllowlist].sort(), []);

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
      if (newUser.password) {
        const policy = validateStrongPassword(newUser.password, newUser.username);
        if (!policy.ok) {
          setSettingsNotice({
            title: 'Senha não atende à política de segurança',
            message: policy.errors.join(' '),
            variant: 'warning',
          });
          return;
        }
      }
      try {
        await addUser(newUser);
        setNewUser({ username: '', password: '', role: '', linkedOriginUnit: '', linkedDestUnit: '', linkedBiVendedora: '' });
        setIsAddingUser(false);
        setEditingUsername(null);
        setSettingsNotice({
          title: 'Utilizador gravado',
          message: isEditing ? 'Alterações guardadas com sucesso.' : 'Novo utilizador criado. Se marcou troca no primeiro acesso, o utilizador será encaminhado para definir senha ao entrar.',
          variant: 'success',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Não foi possível gravar o utilizador.';
        setSettingsNotice({
          title: 'Erro ao salvar utilizador',
          message: msg.replace(/^Erro na API: \d+ - /, ''),
          variant: 'error',
        });
      }
  };

  const handleDownloadBulkTemplate = async () => {
    try {
      const { blob, filename } = await authClient.downloadUsersBulkTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSettingsNotice({
        title: 'Modelo descarregado',
        message:
          'A folha inclui listas suspensas para perfil, unidades e vendedora BI, e senhas aleatórias por linha. Preencha a coluna utilizador e envie o ficheiro de volta.',
        variant: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível obter o modelo.';
      setSettingsNotice({
        title: 'Erro ao obter modelo',
        message: msg.replace(/^Erro na API: \d+ - /, ''),
        variant: 'error',
      });
    }
  };

  const handleBulkImport = async () => {
    const input = bulkFileInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setSettingsNotice({
        title: 'Ficheiro em falta',
        message: 'Escolha um ficheiro .xlsx gerado pelo modelo antes de importar.',
        variant: 'warning',
      });
      return;
    }
    setBulkImportBusy(true);
    try {
      const data = await authClient.importUsersBulk(file);
      if (input) input.value = '';
      await refreshData();
      const errs = (data.results || []).filter((r: { status?: string }) => r.status === 'error') as Array<{
        sheetRow: number;
        username: string;
        message?: string;
      }>;
      const errPreview = errs
        .slice(0, 12)
        .map((e) => `Linha ${e.sheetRow} (${e.username}): ${e.message || 'Erro'}`)
        .join('\n');
      const more = errs.length > 12 ? `\n… e mais ${errs.length - 12} erro(s).` : '';
      setSettingsNotice({
        title: `Importação concluída — ${data.imported} gravado(s), ${data.failed} falha(s)`,
        message:
          data.failed > 0
            ? `${errPreview || 'Verifique o ficheiro.'}${more}`
            : 'Todos os utilizadores da planilha foram processados com sucesso.',
        variant: data.failed > 0 ? 'warning' : 'success',
      });
      try {
        await authClient.logEvent({
          event: 'USER_BULK_IMPORT',
          username: user?.username || 'Sistema',
          payload: { imported: data.imported, failed: data.failed },
        });
      } catch {
        /* não bloqueia */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na importação.';
      setSettingsNotice({
        title: 'Erro na importação',
        message: msg.replace(/^Erro na API: \d+ - /, ''),
        variant: 'error',
      });
    } finally {
      setBulkImportBusy(false);
    }
  };

  const startEditUser = (u: UserData) => {
      if (!canManageUserRow(u)) {
        setSettingsNotice({
          title: 'Ação bloqueada',
          message: 'O utilizador master reservado (conta modo deus) não pode ser editado por esta tela.',
          variant: 'warning',
        });
        return;
      }
      setNewUser({
        username: u.username,
        password: '',
        role: u.role,
        linkedOriginUnit: u.linkedOriginUnit || '',
        linkedDestUnit: u.linkedDestUnit || '',
        linkedBiVendedora: u.linkedBiVendedora || '',
      });
      setEditingUsername(u.username);
      setIsAddingUser(true);
  };

  const cancelUserForm = () => {
      setNewUser({ username: '', password: '', role: '', linkedOriginUnit: '', linkedDestUnit: '', linkedBiVendedora: '' });
      setEditingUsername(null);
      setIsAddingUser(false);
  };

  const openResetPasswordModal = (u: UserData) => {
    if (!canManageUserRow(u)) {
      setSettingsNotice({
        title: 'Ação bloqueada',
          message: 'O utilizador master reservado (conta modo deus) não pode ser alterado por esta tela.',
        variant: 'warning',
      });
      return;
    }
    setPasswordResetUser(u);
    setResetPwdNew('');
    setResetPwdConfirm('');
    setResetPwdForceChange(true);
    setResetPwdError('');
  };

  const closeResetPasswordModal = () => {
    setPasswordResetUser(null);
    setResetPwdNew('');
    setResetPwdConfirm('');
    setResetPwdForceChange(true);
    setResetPwdError('');
    setResetPwdLoading(false);
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser) return;
    setResetPwdError('');
    if (resetPwdNew !== resetPwdConfirm) {
      setResetPwdError('A nova senha e a confirmação não coincidem.');
      return;
    }
    const policy = validateStrongPassword(resetPwdNew, passwordResetUser.username);
    if (!policy.ok) {
      setResetPwdError(policy.errors.join(' '));
      return;
    }
    const targetLabel = passwordResetUser.username;
    const forceNext = resetPwdForceChange;
    setResetPwdLoading(true);
    try {
      await authClient.resetUserPassword({
        targetUsername: passwordResetUser.username,
        newPassword: resetPwdNew,
        forceChangeNextLogin: forceNext,
      });
      await refreshData();
      closeResetPasswordModal();
      setSettingsNotice({
        title: 'Palavra-passe atualizada',
        message: forceNext
          ? `Palavra-passe de "${targetLabel}" guardada. No próximo login será pedida troca obrigatória para uma nova senha.`
          : `Palavra-passe de "${targetLabel}" guardada. Comunique ao utilizador por um canal seguro.`,
        variant: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível redefinir a palavra-passe.';
      setResetPwdError(msg.replace(/^Erro na API: \d+ - /i, '').replace(/^Erro na API: /i, ''));
    } finally {
      setResetPwdLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProfile?.name) return;
      await saveProfile(editingProfile);
      setEditingProfile(null);
  };

  /** Uma chave = um checkbox; equivalências (legado ↔ novo) aplicam-se só em runtime ao verificar acesso. */
  const togglePermission = (perm: string) => {
    if (!editingProfile) return;
    const current = editingProfile.permissions || [];
    const has = current.includes(perm);
    const eq = getProfileCheckboxEquivalence(perm);
    let newPerms = has ? current.filter((p) => !eq.has(p)) : [...current, perm];
    if (has && perm === OPERACIONAL_MODULE_KEY) {
      newPerms = stripOperacionalPermissionsWithoutModule(newPerms);
    }
    setEditingProfile({ ...editingProfile, permissions: newPerms });
  };

  const isPermissionChecked = (key: string) => {
    if (!editingProfile) return false;
    return (editingProfile.permissions || []).includes(key);
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
          {showUsersTab ? (
            <button
              type="button"
              onClick={() => setActiveTab('USERS')}
              className={clsx(
                'pressable-3d flex items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-bold transition-all',
                activeTab === 'USERS'
                  ? 'border-sl-navy/35 bg-gradient-to-b from-slate-50 to-white text-sl-navy'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900',
              )}
            >
              <Users size={18} /> Gestão de Usuários
            </button>
          ) : null}
          {showProfilesTab ? (
            <button
              type="button"
              onClick={() => setActiveTab('PROFILES')}
              className={clsx(
                'pressable-3d flex items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-bold transition-all',
                activeTab === 'PROFILES'
                  ? 'border-sl-navy text-sl-navy'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <Shield size={18} /> Perfis e Permissões
            </button>
          ) : null}
          {showLogsTab ? (
            <button
              type="button"
              onClick={() => setActiveTab('LOGS')}
              className={clsx(
                'pressable-3d flex items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-bold transition-all',
                activeTab === 'LOGS'
                  ? 'border-sl-navy text-sl-navy'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <Activity size={18} /> Logs do Sistema
            </button>
          ) : null}
      </div>

      {/* --- USERS TAB --- */}
      {activeTab === 'USERS' && showUsersTab && (
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
                    className="pressable-3d flex items-center gap-2 rounded-lg bg-gradient-to-r from-sl-navy to-sl-navy-light px-4 py-2 font-bold text-white transition hover:brightness-105"
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
                                className="w-full p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-sl-navy/30 outline-none" 
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
                                type="password"
                                autoComplete="new-password"
                                className="w-full p-2 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-sl-navy/30 outline-none" 
                                value={newUser.password} 
                                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                                placeholder={editingUsername ? 'Deixe vazio para manter a senha atual' : ''}
                              />
                              {!editingUsername ? (
                                <p className="text-[11px] leading-snug text-slate-600">
                                  Mínimo 8 caracteres, maiúscula, minúscula, número e símbolo. Evite sequências óbvias ou o nome de utilizador dentro da senha.
                                </p>
                              ) : null}
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600 uppercase">Perfil</label>
                              <select 
                                required
                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-sl-navy/30 outline-none bg-slate-50 text-slate-800"
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
                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-sl-navy/30 outline-none bg-slate-50 text-slate-800"
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
                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-sl-navy/30 outline-none bg-slate-50 text-slate-800"
                                value={newUser.linkedDestUnit}
                                onChange={e => setNewUser({...newUser, linkedDestUnit: e.target.value})}
                              >
                                  <option value="">Nenhuma</option>
                                  {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-600 uppercase">Vendedora (BI, opcional)</label>
                              <select
                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-sl-navy/30 outline-none bg-slate-50 text-slate-800"
                                value={newUser.linkedBiVendedora || ''}
                                onChange={(e) => setNewUser({ ...newUser, linkedBiVendedora: e.target.value })}
                              >
                                <option value="">Nenhuma — vê todas (respeitando unidade)</option>
                                {biVendedoraOptions.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              <p className="text-[11px] text-slate-500">
                                Se definida, o usuário só enxerga dados dessa vendedora nos painéis de comissões, funil e campanhas & incentivos.
                              </p>
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

              {hasPermission('MANAGE_USERS') && !isAddingUser ? (
                <div className="surface-card p-5 space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Importação em massa</h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      Descarregue o modelo Excel: cada linha já traz uma senha inicial aleatória conforme a política do
                      sistema. Utilize as listas suspensas para perfil, unidades e vendedora BI e preencha apenas a
                      coluna de utilizador (e ajuste o restante se precisar). Linhas sem utilizador são ignoradas.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadBulkTemplate}
                      className="pressable-3d inline-flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:border-sl-navy/35"
                    >
                      <Download size={16} /> Descarregar modelo
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                      <Upload size={16} />
                      <span>Ficheiro .xlsx</span>
                      <input
                        ref={bulkFileInputRef}
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={bulkImportBusy}
                      onClick={handleBulkImport}
                      className="pressable-3d inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {bulkImportBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                      Importar planilha
                    </button>
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
                              <th className="px-4 py-3">Vendedora BI</th>
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
                                  <td className="px-4 py-3 text-slate-600">{u.linkedBiVendedora || '-'}</td>
                                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatLastLogin(u.lastLoginAt)}</td>
                                  <td className="px-4 py-3 text-right">
                                      <div className="inline-flex items-center gap-1">
                                        {canManageUserRow(u) && (
                                          <button
                                            onClick={() => startEditUser(u)}
                                            className="text-slate-500 hover:text-sl-navy p-1"
                                            title="Editar usuário"
                                          >
                                            <Pencil size={16} />
                                          </button>
                                        )}
                                        {canManageUserRow(u) && (
                                          <button
                                            type="button"
                                            onClick={() => openResetPasswordModal(u)}
                                            className="text-slate-500 hover:text-amber-600 p-1"
                                            title="Redefinir palavra-passe"
                                          >
                                            <KeyRound size={16} />
                                          </button>
                                        )}
                                        {canManageUserRow(u) && (
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
      {activeTab === 'PROFILES' && showProfilesTab && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profiles List */}
              <div className="md:col-span-1 space-y-3">
                  <button 
                      onClick={() => setEditingProfile({ name: '', description: '', permissions: [] })}
                      className="pressable-3d mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300/80 bg-gradient-to-b from-white to-slate-50 py-2 font-bold text-slate-800 transition hover:border-sl-navy/30"
                  >
                      <UserPlus size={16} /> Novo Perfil
                  </button>
                  
                  {profiles.map(p => (
                      <div 
                        key={p.name} 
                        className={clsx(
                            "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                            editingProfile?.name === p.name
                              ? "bg-slate-50 border-sl-navy/40 ring-1 ring-sl-navy/25"
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
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        let base = `${p.name} (cópia)`;
                                        let next = base;
                                        let i = 2;
                                        while (profiles.some((x) => (x.name || '').toLowerCase() === next.toLowerCase())) {
                                          next = `${base} ${i++}`;
                                        }
                                        setEditingProfile({
                                          ...p,
                                          name: next.slice(0, 120),
                                          description: p.description || '',
                                        });
                                    }}
                                    className="p-1 text-slate-500 hover:text-blue-400" title="Duplicar perfil"
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
                              <button
                                type="button"
                                onClick={() => {
                                  setProfilePermSearch('');
                                  setEditingProfile(null);
                                }}
                                className="text-slate-500 hover:text-slate-700"
                              >
                                <X size={24} />
                              </button>
                          </div>
                          
                          <form onSubmit={handleSaveProfile} className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-slate-600 uppercase">Nome do Perfil</label>
                                      <input 
                                        required
                                        className="w-full p-2.5 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-sl-navy/30 outline-none"
                                        value={editingProfile.name}
                                        onChange={e => setEditingProfile({...editingProfile, name: e.target.value})}
                                        disabled={profiles.some(p => p.name === editingProfile.name && p.name?.toUpperCase() === 'ADMIN')} // Admin name locked
                                      />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-slate-600 uppercase">Descrição</label>
                                      <input 
                                        className="w-full p-2.5 rounded border border-slate-200 bg-slate-50 text-slate-800 placeholder-gray-500 focus:ring-2 focus:ring-sl-navy/30 outline-none"
                                        value={editingProfile.description}
                                        onChange={e => setEditingProfile({...editingProfile, description: e.target.value})}
                                      />
                                  </div>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Modelos rápidos</p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Aplicar substitui todas as permissões do perfil em edição pela lista do modelo (pode ajustar depois).
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {PROFILE_PRESETS.map((pr) => (
                                    <button
                                      key={pr.id}
                                      type="button"
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-[11px] font-bold text-sl-navy shadow-sm hover:border-sl-navy/40"
                                      onClick={() =>
                                        setEditingProfile((cur) =>
                                          cur ? { ...cur, permissions: [...pr.permissions] } : cur,
                                        )
                                      }
                                    >
                                      {pr.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                  <label className="text-xs font-bold text-slate-600 uppercase mb-3 block">
                                    Permissões de acesso
                                  </label>
                                  <p className="text-[11px] text-slate-500 mb-3">
                                    Cada caixa altera <strong>uma chave</strong> no perfil. Chaves antigas (VIEW_*, etc.) ainda
                                    funcionam em <strong>runtime</strong> se estiverem gravadas na base, mas deixaram de aparecer
                                    aqui — use as entradas <code className="text-[10px]">tab.*</code> e módulos do catálogo.
                                  </p>
                                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:max-w-md sm:flex-1">
                                      <Search size={16} className="shrink-0 text-slate-400" />
                                      <input
                                        type="search"
                                        value={profilePermSearch}
                                        onChange={(e) => setProfilePermSearch(e.target.value)}
                                        placeholder="Pesquisar por nome, chave ou descrição…"
                                        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                                      />
                                    </div>
                                    {profilePermSearch.trim() ? (
                                      <button
                                        type="button"
                                        className="text-xs font-bold text-sl-navy hover:underline"
                                        onClick={() => setProfilePermSearch('')}
                                      >
                                        Limpar pesquisa
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="space-y-8">
                                    {PERMISSION_SECTION_ORDER.map((sectionId) => {
                                      const sectionRows = profilePermissionsBySection[sectionId];
                                      if (!sectionRows.length) return null;
                                      return (
                                        <div key={sectionId} className="space-y-4">
                                          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-sl-navy" />
                                            {PERMISSION_SECTION_LABELS[sectionId]}
                                          </h4>
                                          <div className="space-y-6">
                                            {PERMISSION_GROUP_ORDER.map((groupId) => {
                                              const rows = sectionRows.filter((r) => r.group === groupId);
                                              if (!rows.length) return null;
                                              return (
                                                <div key={`${sectionId}-${groupId}`} className="space-y-2">
                                                  <h5 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                                    {PERMISSION_GROUP_LABELS[groupId]}
                                                  </h5>
                                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    {rows.map(({ key, label, description }) => {
                                                      const isChecked = isPermissionChecked(key);
                                                      return (
                                                        <div
                                                          key={key}
                                                          onClick={() => togglePermission(key)}
                                                          className={clsx(
                                                            'flex cursor-pointer select-none items-center gap-3 rounded-lg border p-3 transition-all',
                                                            isChecked
                                                              ? 'border-sl-navy/40 bg-slate-50 text-slate-900'
                                                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
                                                          )}
                                                        >
                                                          {isChecked ? (
                                                            <CheckSquare size={20} className="shrink-0 text-sl-navy" />
                                                          ) : (
                                                            <Square size={20} className="shrink-0" />
                                                          )}
                                                          <div className="min-w-0 flex flex-col">
                                                            <span className="text-sm font-bold text-slate-800">{label}</span>
                                                            <span className="text-[11px] text-slate-500">{description}</span>
                                                            <span className="mt-1 break-all font-mono text-[10px] text-sl-navy/80">
                                                              {key}
                                                            </span>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                              </div>

                              <div className="flex justify-end pt-4 border-t border-slate-200">
                                  <button type="submit" className="pressable-3d flex items-center gap-2 rounded-lg bg-gradient-to-r from-sl-navy to-sl-navy-light px-6 py-2.5 font-bold text-white transition hover:brightness-105">
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
      {activeTab === 'LOGS' && showLogsTab && (
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
                    <Search size={16} className="text-sl-navy" /> Filtros
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
                      className="pressable-3d px-3 py-1 rounded bg-gradient-to-b from-white to-slate-50 border border-slate-300/80 text-xs font-bold text-slate-700 hover:border-sl-navy/30"
                      type="button"
                    >
                      Recarregar
                    </button>
                    <button
                      type="button"
                      onClick={exportLogsCsv}
                      disabled={!canExportLogs || logsLoading || logs.length === 0}
                      className="pressable-3d px-3 py-1 rounded bg-gradient-to-b from-white to-slate-50 border border-slate-300/80 text-xs font-bold text-slate-700 disabled:opacity-50 hover:border-sl-navy/30"
                    >
                      Exportar CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportLogsXlsx}
                      disabled={!canExportLogs || logsLoading || logs.length === 0}
                      className="pressable-3d px-3 py-1 rounded bg-gradient-to-b from-white to-slate-50 border border-slate-300/80 text-xs font-bold text-slate-700 disabled:opacity-50 hover:border-sl-navy/30"
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

      {passwordResetUser ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-labelledby="reset-pwd-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={closeResetPasswordModal}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>
            <div className="mb-4 flex items-center gap-2 text-sl-navy">
              <KeyRound className="size-7 shrink-0" />
              <h2 id="reset-pwd-title" className="font-heading text-lg font-bold tracking-tight">
                Redefinir palavra-passe
              </h2>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Utilizador: <span className="font-semibold text-slate-900">{passwordResetUser.username}</span>
            </p>
            {resetPwdError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {resetPwdError}
              </div>
            ) : null}
            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nova palavra-passe</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPwdNew}
                  onChange={(e) => setResetPwdNew(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 outline-none focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Mínimo 8 caracteres, maiúscula, minúscula, número e símbolo (sem sequências óbvias).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Confirmar</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPwdConfirm}
                  onChange={(e) => setResetPwdConfirm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 outline-none focus:border-sl-navy focus:ring-2 focus:ring-sl-navy/20"
                  required
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-slate-300"
                  checked={resetPwdForceChange}
                  onChange={(e) => setResetPwdForceChange(e.target.checked)}
                />
                <span>Obrigar troca de palavra-passe no próximo login (recomendado após esquecimento).</span>
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeResetPasswordModal}
                  disabled={resetPwdLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetPwdLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sl-navy to-sl-navy-light px-4 py-2 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
                >
                  {resetPwdLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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