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
        return 'bg-red-100 text-red-800 border-red-200';
      case 'PRIORIDADE':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'VENCE AMANHÃ':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'NO PRAZO':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      // New Payment Colors
      case 'CIF':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100'; // Green
      case 'FOB':
        return 'bg-red-50 text-red-600 border-red-100'; // Red
      case 'FATURAR_REMETENTE':
        return 'bg-yellow-50 text-yellow-700 border-yellow-100'; // Yellow
      case 'FATURAR_DEST':
        return 'bg-orange-50 text-orange-700 border-orange-100'; // Orange
      // Resolved Status
      case 'RESOLVIDO':
      case 'LOCALIZADA':
        return 'bg-green-100 text-green-800 border-green-200 font-bold';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span 
      onClick={onClick}
      className={clsx(
        "px-2 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all hover:opacity-80 whitespace-nowrap",
        getColors(status)
      )}
    >
      {status}
    </span>
  );
};

export default StatusBadge;