import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { can, getSessionContext } from '@/lib/server/authorization';
import { ensureFase1InfrastructureTables } from '@/lib/server/ensureFase1Infrastructure';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (!can(session, 'MANAGE_SETTINGS') && !can(session, 'VIEW_SETTINGS')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));
    const pool = getPool();
    await ensureFase1InfrastructureTables();
    const r = await pool.query(
      `
        SELECT id, created_at, actor_username, action, resource_type, resource_id, payload
        FROM pendencias.audit_log
        ORDER BY id DESC
        LIMIT $1
      `,
      [limit],
    );
    return NextResponse.json({ items: r.rows || [] });
  } catch (e) {
    console.error('audit-log GET', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
