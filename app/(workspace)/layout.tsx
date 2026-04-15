import WorkspaceLayoutClient from '@/components/workspace/WorkspaceLayoutClient';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayoutClient>{children}</WorkspaceLayoutClient>;
}
