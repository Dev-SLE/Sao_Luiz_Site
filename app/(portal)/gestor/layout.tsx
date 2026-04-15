import { GestorGate } from '@/components/portal/GestorGate';

export default function GestorLayout({ children }: { children: React.ReactNode }) {
  return <GestorGate>{children}</GestorGate>;
}
