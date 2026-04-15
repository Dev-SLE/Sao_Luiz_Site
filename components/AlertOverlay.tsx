import React, { useEffect, useState } from 'react';
import { AlertCircle, Tag, BellRing } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { CteData } from '../types';

interface Props {
    onOpenCte: (cte: CteData) => void;
}

const AlertOverlay: React.FC<Props> = ({ onOpenCte }) => {
  const { baseData, isCteEmBusca, isCteOcorrencia } = useData();
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [targetCte, setTargetCte] = useState<CteData | null>(null);
  const [alertType, setAlertType] = useState<'BUSCA' | 'OCORRENCIA'>('BUSCA');
  const [ackedByUser, setAckedByUser] = useState<Set<string>>(new Set());

  const normalizeSerie = (serie: string) => String(serie || '').replace(/^0+/, '') || '0';
  const makeKey = (cte: string, serie: string) => `${String(cte)}|${normalizeSerie(serie)}`;

  useEffect(() => {
    let cancelled = false;
    if (!user?.username) {
      setAckedByUser(new Set());
      return;
    }
    const loadAcks = async () => {
      try {
        const resp = await fetch(`/api/alerts/user-note-acks?username=${encodeURIComponent(user.username)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const rows = await resp.json();
        const next = new Set<string>(
          (Array.isArray(rows) ? rows : []).map((r: any) => makeKey(String(r?.cte || ''), String(r?.serie || '0')))
        );
        if (!cancelled) setAckedByUser(next);
      } catch {
        if (!cancelled) setAckedByUser(new Set());
      }
    };
    void loadAcks();
    const timer = window.setInterval(() => {
      void loadAcks();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.username]);

  useEffect(() => {
    // REGRA 1: Usuários sem unidade vinculada (ex: admin global sem unidade) não recebem alertas intrusivos
    if (!user || !user.linkedDestUnit) {
      setActive(false);
      setTargetCte(null);
      return;
    }

    // REGRA 2: Verificação de Ocorrência (Prioridade de Alerta Específico)
    // "Só será notificiada a unidade de destino da pendência"
    const ocorrItem = baseData.find(item => {
        const statusIsOcorrencia = isCteOcorrencia(item.CTE, item.SERIE);
        if (!statusIsOcorrencia) return false;
        
        // 2. Verifica se a unidade do usuário é EXATAMENTE a unidade de entrega (destino)
        const userUnit = user.linkedDestUnit.trim().toUpperCase();
        const itemDest = (item.ENTREGA || '').trim().toUpperCase();
        if (itemDest !== userUnit) return false;

        // 3. Verifica se o usuário já interagiu (anotou) para dispensar o alerta
        const userHasNote = ackedByUser.has(makeKey(item.CTE, item.SERIE));
        return !userHasNote;
    });

    if (ocorrItem) {
        if (targetCte?.CTE === ocorrItem.CTE && active && alertType === 'OCORRENCIA') return;
        setTargetCte(ocorrItem);
        setAlertType('OCORRENCIA');
        setActive(true);
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
        const userHasNote = ackedByUser.has(makeKey(item.CTE, item.SERIE));
        return !userHasNote;
    });

    if (pendingItem) {
        if (targetCte?.CTE === pendingItem.CTE && active && alertType === 'BUSCA') return;
        setTargetCte(pendingItem);
        setAlertType('BUSCA');
        setActive(true);
        return;
    }

    // Se nada encontrado
    setActive(false);
    setTargetCte(null);

  }, [baseData, user, ackedByUser, isCteEmBusca, isCteOcorrencia]);

  if (!active || !targetCte) return null;

  const isOcorrencia = alertType === 'OCORRENCIA';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
    >
      <div className={`w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl ${isOcorrencia ? 'border-violet-200 bg-white' : 'border-red-200 bg-white'}`}>
        <div className={`px-6 py-4 ${isOcorrencia ? 'bg-gradient-to-r from-violet-700 to-violet-600' : 'bg-gradient-to-r from-sl-red to-[#9e0f26]'}`}>
          <div className="flex items-center gap-3 text-white">
            <span className="rounded-xl bg-white/20 p-2">
              <BellRing size={20} />
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Notificação operacional</div>
              <h2 className="text-xl font-black">{isOcorrencia ? 'Ocorrência Operacional' : 'Mercadoria em Busca'}</h2>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-6 text-slate-800">
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${isOcorrencia ? 'border-violet-200 bg-violet-50' : 'border-red-200 bg-red-50'}`}>
            {isOcorrencia ? (
              <Tag size={28} className="text-violet-700" />
            ) : (
              <AlertCircle size={28} className="text-red-700" />
            )}
            <div className="text-sm">
              Documento <span className={`font-black ${isOcorrencia ? 'text-violet-700' : 'text-red-700'}`}>{targetCte.CTE}</span>
              {' '}série <span className="font-black">{targetCte.SERIE || '0'}</span> com status{' '}
              <span className="font-black">{isOcorrencia ? 'OCORRÊNCIA' : 'EM BUSCA'}</span>.
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {isOcorrencia
              ? `Sua unidade (${user?.linkedDestUnit || '-'}) é o destino desta pendência.`
              : 'Atenção necessária para sua agência. Abra o CTE e registre uma anotação para encerrar esta notificação para você.'}
          </p>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Esta notificação é silenciosa (sem som).
          </p>
        </div>
        <div className="flex gap-3 border-t border-slate-200 p-4">
          <button
            onClick={() => setActive(false)}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Fechar
          </button>
          <button
            onClick={() => { setActive(false); onOpenCte(targetCte); }}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-black text-white transition-all active:scale-[0.99] ${isOcorrencia ? 'bg-violet-600 hover:bg-violet-700' : 'bg-sl-red hover:bg-[#9e0f26]'}`}
          >
            Verificar e Anotar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertOverlay;