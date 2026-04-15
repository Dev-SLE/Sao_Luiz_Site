'use client';

export default function WorkspaceLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="workspace" className="min-h-dvh bg-background font-body text-foreground antialiased">
      {children}
    </div>
  );
}
