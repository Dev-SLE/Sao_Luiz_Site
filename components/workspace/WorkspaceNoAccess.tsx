import React from 'react';

export function WorkspaceNoAccess({ title = 'Sem permissão', message }: { title?: string; message: string }) {
  return (
    <div className="surface-card p-6">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
    </div>
  );
}
