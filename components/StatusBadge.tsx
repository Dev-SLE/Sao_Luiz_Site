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
        return 'bg-red-950/70 text-red-200 border-red-500/60';
      case 'PRIORIDADE':
        return 'bg-amber-900/60 text-amber-200 border-amber-500/60';
      case 'VENCE AMANHÃ':
        return 'bg-yellow-900/55 text-yellow-200 border-yellow-500/55';
      case 'NO PRAZO':
        return 'bg-sky-900/55 text-sky-200 border-sky-500/55';
      // New Payment Colors
      case 'CIF':
        return 'bg-emerald-900/55 text-emerald-200 border-emerald-500/55';
      case 'FOB':
        return 'bg-rose-900/60 text-rose-200 border-rose-500/60';
      case 'FATURAR_REMETENTE':
        return 'bg-orange-900/55 text-orange-200 border-orange-500/55';
      case 'FATURAR_DEST':
        return 'bg-fuchsia-900/50 text-fuchsia-200 border-fuchsia-500/55';
      // Resolved Status
      case 'RESOLVIDO':
      case 'LOCALIZADA':
        return 'bg-emerald-900/65 text-emerald-100 border-emerald-400/60 font-bold';
      default:
        return 'bg-slate-800 text-slate-200 border-slate-500/50';
    }
  };

  return (
    <span
      onClick={onClick}
      className={clsx(
        "px-2 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-all whitespace-nowrap",
        getColors(status)
      )}
    >
      {status}
    </span>
  );
};

export default StatusBadge;