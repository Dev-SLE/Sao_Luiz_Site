import { NextResponse } from 'next/server';
import { can, getSessionContext } from '@/lib/server/authorization';

export const runtime = 'nodejs';

/** Stub de saúde do módulo RH — expandir com rotas reais na Fase 5. */
export async function GET(req: Request) {
  const session = await getSessionContext(req);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!can(session, 'module.rh.view') && !can(session, 'MANAGE_SETTINGS')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  return NextResponse.json({ module: 'rh', ok: true });
}
