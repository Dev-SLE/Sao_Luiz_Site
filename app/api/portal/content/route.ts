import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { can, getSessionContext } from '@/lib/server/authorization';
import { ensureFase1InfrastructureTables } from '@/lib/server/ensureFase1Infrastructure';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (!can(session, 'portal.home.view')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const kind = String(searchParams.get('kind') || '').trim().toLowerCase();
    const pool = getPool();
    await ensureFase1InfrastructureTables();

    const params: unknown[] = [];
    let where = '1=1';
    if (kind && ['comunicado', 'documento', 'treinamento', 'campanha', 'agenda'].includes(kind)) {
      where = 'kind = $1';
      params.push(kind);
    }
    const r = await pool.query(
      `
        SELECT id::text AS id, kind, title, body, href, published_at
        FROM pendencias.portal_content
        WHERE ${where}
        ORDER BY published_at DESC
        LIMIT 80
      `,
      params,
    );
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error('portal/content GET', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
