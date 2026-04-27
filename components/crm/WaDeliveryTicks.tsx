import React from 'react';
import clsx from 'clsx';

export type WaDeliveryUiStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received' | string;

const LABELS: Record<string, string> = {
  pending: 'Enviando',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou',
  received: 'Recebida',
};

/** Duplo check estilo WhatsApp (cinza = entregue, azul = lida). */
export const WaDeliveryTicks: React.FC<{
  status: WaDeliveryUiStatus;
  /** Texto claro em fundos escuros (bolha atendente). */
  variant?: 'default' | 'onDark';
  className?: string;
}> = ({ status, variant = 'default', className }) => {
  const s = String(status || '').toLowerCase();
  if (!s) return null;

  /** Mensagem do cliente: um check indica “recebida no CRM / WhatsApp”. */
  if (s === 'received') {
    const stroke = variant === 'onDark' ? 'stroke-white/70' : 'stroke-slate-400';
    return (
      <span className={clsx('inline-flex items-center', className)} title={LABELS.received} aria-label={LABELS.received}>
        <svg width="14" height="11" viewBox="0 0 14 11" className={clsx('shrink-0', stroke)} fill="none" aria-hidden>
          <path d="M1 5.5L4.2 8.7L12.5 1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (s === 'failed') {
    return (
      <span
        className={clsx('inline-flex text-[10px] font-bold text-rose-500', className)}
        title={LABELS.failed}
        aria-label={LABELS.failed}
      >
        !
      </span>
    );
  }

  const read = s === 'read';
  const double = s === 'delivered' || read || s === 'sent';
  const stroke = read
    ? variant === 'onDark'
      ? 'stroke-sky-300'
      : 'stroke-sky-500'
    : variant === 'onDark'
      ? 'stroke-white/75'
      : 'stroke-slate-400';

  const title = LABELS[s] || s;

  const tick = (key: string) => (
    <svg
      key={key}
      width="14"
      height="11"
      viewBox="0 0 14 11"
      className={clsx('shrink-0', stroke)}
      fill="none"
      aria-hidden
    >
      <path
        d="M1 5.5L4.2 8.7L12.5 1"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <span
      className={clsx('inline-flex items-center', double ? '-space-x-[7px]' : '', className)}
      title={title}
      aria-label={title}
    >
      {tick('a')}
      {double ? tick('b') : null}
    </span>
  );
};
