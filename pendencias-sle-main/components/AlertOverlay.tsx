import React, { useEffect, useState } from 'react';
import { AlertCircle, X, Tag } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { CteData } from '../types';

interface Props {
    onOpenCte: (cte: CteData) => void;
}

const AlertOverlay: React.FC<Props> = ({ onOpenCte }) => {
  const { baseData, notes, isCteEmBusca, isCteTad } = useData();
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [targetCte, setTargetCte] = useState<CteData | null>(null);
  const [alertType, setAlertType] = useState<'BUSCA' | 'TAD'>('BUSCA');

  useEffect(() => {
    // REGRA 1: Usuários sem unidade vinculada (ex: admin global sem unidade) não recebem alertas intrusivos
    if (!user || !user.linkedDestUnit) {
      setActive(false);
      setTargetCte(null);
      return;
    }

    // REGRA 2: Verificação de TAD (Prioridade de Alerta Específico)
    // "Só será notificiada a unidade de destino da pendência"
    const tadItem = baseData.find(item => {
        // 1. Verifica se é TAD (baseado estritamente no PROCESS_CONTROL)
        const statusIsTad = isCteTad(item.CTE, item.SERIE);
        if (!statusIsTad) return false;
        
        // 2. Verifica se a unidade do usuário é EXATAMENTE a unidade de entrega (destino)
        const userUnit = user.linkedDestUnit.trim().toUpperCase();
        const itemDest = (item.ENTREGA || '').trim().toUpperCase();
        if (itemDest !== userUnit) return false;

        // 3. Verifica se o usuário já interagiu (anotou) para dispensar o alerta
        const userHasNote = notes.some(n => 
            n.CTE === item.CTE && 
            n.USUARIO.toLowerCase() === user.username.toLowerCase()
        );
        return !userHasNote;
    });

    if (tadItem) {
        if (targetCte?.CTE === tadItem.CTE && active && alertType === 'TAD') return;
        setTargetCte(tadItem);
        setAlertType('TAD');
        setActive(true);
        playAudio();
        return;
    }

    // REGRA 3: Verificação de EM BUSCA (Prioridade Global)
    // "TODAS as agências de destino são notificadas" (Broadcast para quem tem unidade)
    const pendingItem = baseData.find(item => {
        // 1. Verifica se está Em Busca (baseado no PROCESS_CONTROL)
        const statusIsEmBusca = isCteEmBusca(item.CTE, item.SERIE, item.STATUS);
        if (!statusIsEmBusca) return false;
        
        // 2. O alerta é GLOBAL para qualquer usuário que tenha unidade (verificado no início do useEffect)
        
        // 3. Verifica se o usuário já interagiu para dispensar o alerta
        const userHasNote = notes.some(n => 
          n.CTE === item.CTE && 
          n.USUARIO.toLowerCase() === user.username.toLowerCase()
        );
        return !userHasNote;
    });

    if (pendingItem) {
        if (targetCte?.CTE === pendingItem.CTE && active && alertType === 'BUSCA') return;
        setTargetCte(pendingItem);
        setAlertType('BUSCA');
        setActive(true);
        playAudio();
        return;
    }

    // Se nada encontrado
    setActive(false);
    setTargetCte(null);

  }, [baseData, user, notes, isCteEmBusca, isCteTad]);

  const playAudio = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    audio.loop = true;
    audio.volume = 0.5;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => console.log("Auto-play de áudio bloqueado."));
    }
    return () => { audio.pause(); audio.currentTime = 0; };
  };

  if (!active || !targetCte) return null;

  const isTad = alertType === 'TAD';

  return (
    <div className={
        `fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm animate-pulse 
        ${isTad ? 'bg-violet-900/90' : 'bg-red-900/90'}`
    }>
      <div className={`bg-white p-8 rounded-lg shadow-2xl max-w-md text-center border-4 ${isTad ? 'border-violet-500' : 'border-red-500'}`}>
        <div className="relative">
             {isTad ? (
                 <Tag size={64} className="text-violet-600 mx-auto mb-4" />
             ) : (
                 <AlertCircle size={64} className="text-red-600 mx-auto mb-4" />
             )}
        </div>
        <h2 className={`text-3xl font-bold mb-2 uppercase tracking-tighter italic ${isTad ? 'text-violet-900' : 'text-red-900'}`}>
            {isTad ? 'Processo TAD' : 'Mercadoria em Busca'}
        </h2>
        <div className={`p-4 rounded-lg mb-6 border ${isTad ? 'bg-violet-50 border-violet-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-gray-700 font-medium">
              Atenção! O documento <span className={`font-black text-xl ${isTad ? 'text-violet-600' : 'text-red-600'}`}>{targetCte.CTE}</span> está marcado como <span className="font-bold">{isTad ? 'TAD' : 'EM BUSCA'}</span>.
          </p>
          <p className={`text-sm mt-2 font-bold uppercase underline ${isTad ? 'text-violet-800' : 'text-red-800'}`}>
              {isTad ? 
                  `Sua unidade (${user?.linkedDestUnit}) é o destino.` : 
                  'Verifique em sua unidade imediatamente.'}
          </p>
        </div>
        <button 
          onClick={() => { setActive(false); onOpenCte(targetCte); }}
          className={`px-6 py-4 rounded-xl font-black text-lg text-white transition-all shadow-xl active:scale-95 w-full uppercase 
          ${isTad ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/40' : 'bg-red-600 hover:bg-red-700 shadow-red-500/40'}`}
        >
          Verificar e Anotar
        </button>
      </div>
    </div>
  );
};

export default AlertOverlay;