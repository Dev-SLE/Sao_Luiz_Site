import React, { useState } from 'react';
import { Home, ClipboardList, AlertTriangle, Search, Settings, Key, LogOut, Menu, X, Tag, Cloud, Archive } from 'lucide-react';
import { Page } from '../types';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

interface Props {
  currentPage: Page;
  setPage: (p: Page) => void;
  logout: () => void;
}

const Sidebar: React.FC<Props> = ({ currentPage, setPage, logout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { counts, hasPermission } = useData();

  const menuItems = [
    { id: Page.DASHBOARD, label: 'Visão Geral', icon: Home, count: 0 },
    { id: Page.PENDENCIAS, label: 'Pendências', icon: ClipboardList, count: counts.pendencias },
    { id: Page.CRITICOS, label: 'Críticos', icon: AlertTriangle, count: counts.criticos },
    { id: Page.EM_BUSCA, label: 'Em Busca', icon: Search, count: counts.emBusca },
    { id: Page.TAD, label: 'TAD', icon: Tag, count: counts.tad },
    { id: Page.CONCLUIDOS, label: 'Concluídos', icon: Archive, count: counts.concluidos },
  ];

  // Configurações: por permissão do perfil (admin sempre vê)
  if (hasPermission('MANAGE_SETTINGS')) {
    menuItems.push({ id: Page.CONFIGURACOES, label: 'Configurações', icon: Settings, count: 0 });
  }

  const content = (
    <div className="flex flex-col h-full bg-primary-900 text-white transition-all duration-300">
      <div className="p-4 flex items-center justify-between border-b border-primary-800">
        {!collapsed && <span className="font-bold text-lg tracking-wider">SÃO LUIZ</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden md:block p-1 hover:bg-primary-800 rounded">
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
         <button onClick={() => setMobileOpen(false)} className="md:hidden p-1">
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setPage(item.id);
              setMobileOpen(false);
            }}
            className={clsx(
              "w-full flex items-center px-4 py-3 hover:bg-primary-800 transition-colors relative",
              currentPage === item.id && "bg-primary-700 border-l-4 border-primary-400",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            <div className="flex items-center space-x-3">
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
            </div>
            
            {/* Count Badge */}
            {!collapsed && item.count > 0 && (
                <span className={clsx(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    item.id === Page.CRITICOS || item.id === Page.EM_BUSCA ? "bg-red-500 text-white" : 
                    item.id === Page.TAD ? "bg-violet-500 text-white" : "bg-primary-600 text-primary-200"
                )}>
                    {item.count}
                </span>
            )}
            
            {/* Dot for collapsed mode */}
            {collapsed && item.count > 0 && (
                <div className={clsx(
                    "absolute top-2 right-2 w-2 h-2 rounded-full",
                    item.id === Page.CRITICOS || item.id === Page.EM_BUSCA ? "bg-red-500" : 
                    item.id === Page.TAD ? "bg-violet-500" : "bg-primary-400"
                )} />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-800 space-y-2">
         <button 
            onClick={() => { 
              window.open(`/api/auth/google?username=${encodeURIComponent(user?.username || '')}`, '_blank', 'width=600,height=400');
              setMobileOpen(false); 
            }}
            className={clsx(
              "w-full flex items-center text-blue-300 hover:text-blue-100 transition-colors py-2", 
              collapsed ? "justify-center" : "space-x-3 px-4"
            )}
         >
            <Cloud size={18} />
            {!collapsed && <span>Conectar Google Drive</span>}
         </button>
         <button 
            onClick={() => { setPage(Page.MUDAR_SENHA); setMobileOpen(false); }}
            className={clsx(
              "w-full flex items-center text-primary-200 hover:text-white transition-colors py-2", 
              collapsed ? "justify-center" : "space-x-3 px-4",
              currentPage === Page.MUDAR_SENHA && "text-white font-bold"
            )}
         >
            <Key size={18} />
            {!collapsed && <span>Mudar Senha</span>}
         </button>
         <button onClick={logout} className={clsx("w-full flex items-center text-red-300 hover:text-red-100 transition-colors py-2", collapsed ? "justify-center" : "space-x-3 px-4")}>
            <LogOut size={18} />
            {!collapsed && <span>Sair</span>}
         </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-0 left-0 p-4 z-50">
        <button onClick={() => setMobileOpen(true)} className="bg-primary-900 text-white p-2 rounded shadow-lg">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 h-full shadow-2xl">
            {content}
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className={clsx(
        "hidden md:block h-screen transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}>
        {content}
      </div>
    </>
  );
};

export default Sidebar;