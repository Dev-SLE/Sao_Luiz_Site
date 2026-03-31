import React from 'react';
import clsx from 'clsx';

interface Props {
  status: string;
  onClick?: () => void;
}

const StatusBadge: React.FC<Props> = ({ status, onClick }) => {
  const getColors = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'FORA DO PRAZO':
      case 'CRÍTICO':
        return 'border-red-300 bg-red-100 text-red-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]';
      case 'CONCLUIDO CRÍTICO':
        return 'border-red-300 bg-red-100 font-bold text-red-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'CONCLUIDO FORA DO PRAZO':
        return 'border-orange-300 bg-orange-100 font-bold text-orange-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'PRIORIDADE':
        return 'border-amber-300 bg-amber-100 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'VENCE AMANHÃ':
        return 'border-yellow-300 bg-yellow-100 text-yellow-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'NO PRAZO':
        return 'border-sky-300 bg-sky-100 text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'CONCLUIDO NO PRAZO':
      case 'CONCLUIDO (SEM LIMITE)':
        return 'border-emerald-300 bg-emerald-100 font-bold text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'CALCULANDO...':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'CIF':
        return 'border-emerald-300 bg-emerald-100 text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'FOB':
        return 'border-rose-300 bg-rose-100 text-rose-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'FATURAR_REMETENTE':
        return 'border-orange-300 bg-orange-100 text-orange-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'FATURAR_DEST':
        return 'border-violet-300 bg-violet-100 text-violet-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      case 'RESOLVIDO':
      case 'LOCALIZADA':
        return 'border-emerald-300 bg-emerald-100 font-bold text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]';
      default:
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    }
  };

  return (
    <span
      onClick={onClick}
      className={clsx(
        'status-badge cursor-pointer whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold transition-all',
        getColors(status),
      )}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
