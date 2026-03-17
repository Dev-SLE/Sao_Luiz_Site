import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { UserData, ProfileData } from '../types';
import { Trash2, UserPlus, Save, Copy, Shield, Users, CheckSquare, Square, X } from 'lucide-react';
import clsx from 'clsx';

// Static list of system permissions based on requirements
const SYSTEM_PERMISSIONS = [
    'VIEW_DASHBOARD',
    'VIEW_PENDENCIES',
    'VIEW_FINANCIAL',
    'EDIT_NOTES',
    'EXPORT_DATA',
    'MANAGE_SETTINGS',
    'MANAGE_USERS'
];

const Settings: React.FC = () => {
  const { users, profiles, baseData, addUser, deleteUser, saveProfile, deleteProfile } = useData();
  const [activeTab, setActiveTab] = useState<'USERS' | 'PROFILES'>('USERS');

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
          <button 
             onClick={() => setActiveTab('USERS')}
             className={clsx(
                 "py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2",
                 activeTab === 'USERS' ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"
             )}
          >
              <Users size={18} /> Gestão de Usuários
          </button>
          <button 
             onClick={() => setActiveTab('PROFILES')}
             className={clsx(
                 "py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2",
                 activeTab === 'PROFILES' ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"
             )}
          >
              <Shield size={18} /> Perfis e Permissões
          </button>
      </div>

      {/* --- USERS TAB --- */}
      {activeTab === 'USERS' && (
          <div className="space-y-6">
              {/* Add User Button/Form */}
              {!isAddingUser ? (
                  <button 
                    onClick={() => setIsAddingUser(true)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-700 transition flex items-center gap-2 shadow-sm"
                  >
                      <UserPlus size={18} /> Adicionar Usuário
                  </button>
              ) : (
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg text-gray-800">Novo Usuário</h3>
                          <button onClick={() => setIsAddingUser(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                      </div>
                      <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 uppercase">Usuário</label>
                              <input 
                                required
                                className="w-full p-2 rounded border focus:ring-2 focus:ring-primary-500 outline-none" 
                                value={newUser.username} 
                                onChange={e => setNewUser({...newUser, username: e.target.value})} 
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 uppercase">Senha</label>
                              <input 
                                required
                                className="w-full p-2 rounded border focus:ring-2 focus:ring-primary-500 outline-none" 
                                value={newUser.password} 
                                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 uppercase">Perfil</label>
                              <select 
                                required
                                className="w-full p-2 rounded border focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                                value={newUser.role}
                                onChange={e => setNewUser({...newUser, role: e.target.value})}
                              >
                                  <option value="">Selecione...</option>
                                  {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 uppercase">Unidade Origem (Opcional)</label>
                              <select 
                                className="w-full p-2 rounded border focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                                value={newUser.linkedOriginUnit}
                                onChange={e => setNewUser({...newUser, linkedOriginUnit: e.target.value})}
                              >
                                  <option value="">Nenhuma</option>
                                  {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 uppercase">Unidade Destino (Opcional)</label>
                              <select 
                                className="w-full p-2 rounded border focus:ring-2 focus:ring-primary-500 outline-none bg-white"
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
              )}

              {/* Users Table */}
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-100 text-gray-600 uppercase font-bold text-xs">
                          <tr>
                              <th className="px-4 py-3">Usuário</th>
                              <th className="px-4 py-3">Perfil</th>
                              <th className="px-4 py-3">Origem</th>
                              <th className="px-4 py-3">Destino</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {users.map(u => (
                              <tr key={u.username} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                                  <td className="px-4 py-3">
                                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">{u.role}</span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-500">{u.linkedOriginUnit || '-'}</td>
                                  <td className="px-4 py-3 text-gray-500">{u.linkedDestUnit || '-'}</td>
                                  <td className="px-4 py-3 text-right">
                                      {u.username.toLowerCase() !== 'admin' && (
                                          <button 
                                            onClick={() => { if(confirm(`Remover ${u.username}?`)) deleteUser(u.username) }}
                                            className="text-gray-400 hover:text-red-600 p-1"
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
          </div>
      )}

      {/* --- PROFILES TAB --- */}
      {activeTab === 'PROFILES' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profiles List */}
              <div className="md:col-span-1 space-y-3">
                  <button 
                      onClick={() => setEditingProfile({ name: '', description: '', permissions: [] })}
                      className="w-full py-2 bg-primary-50 text-primary-700 font-bold rounded-lg border border-primary-100 hover:bg-primary-100 transition flex justify-center items-center gap-2 mb-4"
                  >
                      <UserPlus size={16} /> Novo Perfil
                  </button>
                  
                  {profiles.map(p => (
                      <div 
                        key={p.name} 
                        className={clsx(
                            "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                            editingProfile?.name === p.name ? "bg-primary-50 border-primary-300 ring-1 ring-primary-200" : "bg-white border-gray-200"
                        )}
                        onClick={() => setEditingProfile(p)}
                      >
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="font-bold text-gray-800">{p.name}</h4>
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                              </div>
                              <div className="flex gap-1">
                                  <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProfile({ ...p, name: `${p.name}_COPY` });
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600" title="Copiar"
                                  >
                                      <Copy size={14} />
                                  </button>
                                  {p.name?.toUpperCase() !== 'ADMIN' && (
                                      <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(confirm(`Excluir perfil ${p.name}?`)) deleteProfile(p.name);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-600" title="Excluir"
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
                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="text-xl font-bold text-gray-800">
                                  {editingProfile.name ? `Editando: ${editingProfile.name}` : 'Criar Novo Perfil'}
                              </h3>
                              <button onClick={() => setEditingProfile(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                          </div>
                          
                          <form onSubmit={handleSaveProfile} className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-gray-500 uppercase">Nome do Perfil</label>
                                      <input 
                                        required
                                        className="w-full p-2.5 rounded border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={editingProfile.name}
                                        onChange={e => setEditingProfile({...editingProfile, name: e.target.value})}
                                        disabled={profiles.some(p => p.name === editingProfile.name && p.name?.toUpperCase() === 'ADMIN')} // Admin name locked
                                      />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                                      <input 
                                        className="w-full p-2.5 rounded border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={editingProfile.description}
                                        onChange={e => setEditingProfile({...editingProfile, description: e.target.value})}
                                      />
                                  </div>
                              </div>

                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase mb-3 block">Permissões de Acesso</label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {SYSTEM_PERMISSIONS.map(perm => {
                                          const isChecked = editingProfile.permissions?.includes(perm);
                                          return (
                                              <div 
                                                key={perm} 
                                                onClick={() => togglePermission(perm)}
                                                className={clsx(
                                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none",
                                                    isChecked ? "bg-primary-50 border-primary-200 text-primary-900" : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                                                )}
                                              >
                                                  {isChecked ? <CheckSquare size={20} className="text-primary-600" /> : <Square size={20} />}
                                                  <span className="font-medium text-sm">{perm.replace(/_/g, ' ')}</span>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>

                              <div className="flex justify-end pt-4 border-t border-gray-100">
                                  <button type="submit" className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary-700 transition flex items-center gap-2 shadow-lg shadow-primary-500/20">
                                      <Save size={18} /> Salvar Alterações
                                  </button>
                              </div>
                          </form>
                      </div>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-8 bg-gray-50">
                          <Shield size={48} className="mb-4 opacity-20" />
                          <p className="text-center font-medium">Selecione um perfil ao lado para editar<br/>ou crie um novo.</p>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;