'use client';

import { Search } from 'lucide-react';

type Props = {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
};

export function FilterBar({ placeholder = 'Buscar…', value, onChange, onSubmit }: Props) {
  return (
    <form
      className="flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <Search className="h-4 w-4 shrink-0 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
    </form>
  );
}
