import { redirect } from 'next/navigation';

/** Entrada `/app`: envia para visão operacional canônica (fase_1). */
export default function AppWorkspaceIndexPage() {
  redirect('/app/gerencial/operacao/visao-geral-operacional');
}
