import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { can, getSessionContext } from '@/lib/server/authorization';
import type { UnifiedNotification } from '@/lib/notifications-types';
import { ensureFase1InfrastructureTables } from '@/lib/server/ensureFase1Infrastructure';

export const runtime = 'nodejs';

async function ensureAckTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pendencias.operational_notification_acks (
      username text PRIMARY KEY,
      last_log_id bigint NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(40, Number(searchParams.get('limit') || 25)));

    const notifications: UnifiedNotification[] = [];

    if (can(session, 'module.operacional.view')) {
      await ensureAckTable();
      const pool = getPool();
      const destUnit = String(session.dest || '').trim();
      if (destUnit) {
        try {
          const buscaRes = await pool.query(
            `
              SELECT c.cte::text AS cte, c.serie::text AS serie, c.updated_at
              FROM pendencias.ctes c
              INNER JOIN pendencias.cte_view_index i
                ON i.cte = c.cte
                AND (i.serie = c.serie OR ltrim(i.serie::text, '0') = ltrim(c.serie::text, '0'))
              WHERE i.view = 'em_busca'
                AND NOT EXISTS (
                  SELECT 1 FROM pendencias.notes n
                  WHERE n.cte = c.cte
                    AND (n.serie = c.serie OR ltrim(n.serie::text, '0') = ltrim(c.serie::text, '0'))
                    AND lower(n.usuario) = lower($1)
                )
              ORDER BY c.updated_at DESC NULLS LAST
              LIMIT 12
            `,
            [session.username]
          );
          for (const row of buscaRes.rows || []) {
            const cte = String((row as { cte: string }).cte || '');
            const serie = String((row as { serie: string }).serie || '0');
            const q = new URLSearchParams({ cte, serie });
            notifications.push({
              id: `embusca-${cte}-${serie}`,
              kind: 'operational',
              title: 'Mercadoria em busca',
              subtitle: `CTE ${cte} · série ${serie}`,
              createdAt: (row as { updated_at?: Date }).updated_at
                ? new Date((row as { updated_at: Date }).updated_at).toISOString()
                : null,
              href: `/app/operacional/em-busca?${q.toString()}`,
              read: false,
              meta: { type: 'em_busca', cte, serie },
            });
          }
        } catch {
          /* opcional */
        }
      }

      const ackRes = await pool.query(
        `SELECT last_log_id FROM pendencias.operational_notification_acks WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [session.username]
      );
      const lastLogId = Number(ackRes.rows?.[0]?.last_log_id || 0);
      const logsRes = await pool.query(
        `
          SELECT id, created_at, event, cte, serie, payload
          FROM pendencias.app_logs
          WHERE source = 'operacional'
            AND event IN ('CTE_ASSIGNMENT_UPSERT', 'CTE_ASSIGNMENT_CLEAR')
            AND id > $1
          ORDER BY id DESC
          LIMIT $2
        `,
        [lastLogId, limit]
      );
      for (const r of logsRes.rows || []) {
        const id = Number(r.id);
        const ev = String(r.event || '');
        const cte = encodeURIComponent(String(r.cte || ''));
        const serie = encodeURIComponent(String(r.serie || '0'));
        notifications.push({
          id: `op-${id}`,
          kind: 'operational',
          title:
            ev === 'CTE_ASSIGNMENT_UPSERT' ? 'Atribuição criada/atualizada' : 'Atribuição devolvida',
          subtitle: `CTE ${r.cte || '-'} / Série ${r.serie || '-'}`,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
          href: `/app/operacional/pendencias?cte=${cte}&serie=${serie}`,
          read: false,
          meta: { sourceLogId: id, event: ev, type: 'pendencia_operacional' },
        });
      }
    }

    if (can(session, 'portal.home.view')) {
      try {
        await ensureFase1InfrastructureTables();
        const pool = getPool();
        const pc = await pool.query(
          `
            SELECT id::text AS id, kind, title, href, published_at
            FROM pendencias.portal_content
            WHERE kind = 'comunicado'
            ORDER BY published_at DESC
            LIMIT 6
          `,
        );
        for (const row of pc.rows || []) {
          notifications.push({
            id: `portal-${(row as { id: string }).id}`,
            kind: 'comunicado',
            title: String((row as { title: string }).title || 'Comunicado'),
            subtitle: 'Portal corporativo',
            createdAt: (row as { published_at: Date }).published_at
              ? new Date((row as { published_at: Date }).published_at).toISOString()
              : null,
            href: String((row as { href: string | null }).href || '/comunicados'),
            read: false,
            meta: { type: 'comunicado_novo' },
          });
        }
      } catch {
        /* opcional */
      }
    }

    /** Stub: avisos corporativos passarão a vir de tabela dedicada na Fase 2. */
    notifications.push({
      id: 'corp-welcome',
      kind: 'corporate',
      title: 'Bem-vindo ao centro de notificações unificado',
      subtitle: 'Pendências operacionais e demais avisos aparecem aqui.',
      createdAt: new Date().toISOString(),
      read: true,
      meta: { type: 'aviso_corporativo' },
    });

    notifications.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      notifications: notifications.slice(0, limit),
      unreadCount,
    });
  } catch (e) {
    console.error('notifications GET', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
