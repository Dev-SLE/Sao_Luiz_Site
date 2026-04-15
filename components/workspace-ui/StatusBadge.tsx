import clsx from 'clsx';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'muted';

const styles: Record<Variant, string> = {
  default: 'border-slate-200 bg-white text-slate-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-900',
  muted: 'border-slate-100 bg-slate-50 text-slate-600',
};

export function StatusBadge({ children, variant = 'default' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none',
        styles[variant],
      )}
    >
      {children}
    </span>
  );
}
