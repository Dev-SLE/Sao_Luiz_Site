'use client';

import { GestorGate } from '@/components/portal/GestorGate';
import { PortalCmsEditorBody } from '@/components/portal/PortalCmsEditorBody';

export default function GestorConteudoPage() {
  return (
    <GestorGate>
      <div className="min-h-screen bg-background px-6 pb-20 pt-28">
        <PortalCmsEditorBody />
      </div>
    </GestorGate>
  );
}
