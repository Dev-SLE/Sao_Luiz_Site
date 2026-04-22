import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { can, getSessionContext } from '@/lib/server/authorization';
import { isAdminSuperRole } from '@/lib/adminSuperRoles';
import { ensureCrmSchemaTables, ensureOccurrencesSchemaTables } from '@/lib/server/ensureSchema';
import { ensureFase1InfrastructureTables } from '@/lib/server/ensureFase1Infrastructure';
import type { GlobalSearchGroup } from '@/lib/global-search-types';
import { bumpApiRoute } from '@/lib/server/apiHitMeter';
import { readThroughCache } from '@/lib/server/readThroughCache';
import { operationalCteUnitScopeAndClause } from '@/lib/server/operationalCteUnitScope';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await getSessionContext(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ query: q, groups: [] as GlobalSearchGroup[] });
    }

    bumpApiRoute('GET /api/global-search');
    const cacheKey = `global-search:${session.username}:${q.toLowerCase()}`;
    const body = await readThroughCache(cacheKey, 3500, async () => {
    const pool = getPool();
    const like = `%${q.replace(/%/g, '').replace(/_/g, '')}%`;
    const groups: GlobalSearchGroup[] = [];

    if (can(session, 'module.operacional.view')) {
      const hasOperationalGlobal = can(session, 'scope.operacional.all') || isAdminSuperRole(session.role, session.username);
      const linkedDestUnit = String(session.dest || '').trim();
      const linkedOriginUnit = String(session.origin || '').trim();
      const scopeNeeded =
        !hasOperationalGlobal && (linkedDestUnit || linkedOriginUnit);
      const scopeSql = scopeNeeded ? operationalCteUnitScopeAndClause(2, 3) : '';
      const params: unknown[] = [like];
      if (scopeSql) params.push(linkedDestUnit || null, linkedOriginUnit || null);

      const r = await pool.query(
        `
          SELECT c.cte::text AS cte, c.serie::text AS serie, COALESCE(c.status, '') AS status
          FROM pendencias.ctes c
          WHERE (CAST(c.cte AS TEXT) ILIKE $1 OR COALESCE(c.serie::text, '') ILIKE $1)
          ${scopeSql}
          ORDER BY c.updated_at DESC NULLS LAST
          LIMIT 12
        `,
        params
      );
      const items = (r.rows || []).map((row: { cte: string; serie: string; status: string }) => ({
        id: `cte-${row.cte}-${row.serie}`,
        title: `CTE ${row.cte}`,
        subtitle: `Série ${row.serie || '-'} · ${row.status || ''}`.trim(),
        href: '/app/operacional/pendencias',
      }));
      if (items.length) {
        groups.push({ type: 'cte', label: 'CTEs', items });
      }
    }

    if (can(session, 'module.crm.view')) {
      try {
        await ensureCrmSchemaTables();
        const r = await pool.query(
          `
            SELECT id::text AS id, COALESCE(title, '') AS title, COALESCE(phone, '') AS phone
            FROM pendencias.crm_leads
            WHERE title ILIKE $1 OR COALESCE(phone, '') ILIKE $1 OR COALESCE(protocol_number, '') ILIKE $1
            ORDER BY requested_at DESC NULLS LAST
            LIMIT 10
          `,
          [like]
        );
        const items = (r.rows || []).map((row: { id: string; title: string; phone: string }) => ({
          id: `lead-${row.id}`,
          title: row.title || 'Lead',
          subtitle: row.phone || undefined,
          href: '/app/crm/funil',
        }));
        if (items.length) {
          groups.push({ type: 'crm_lead', label: 'Leads CRM', items });
        }
      } catch {
        /* schema opcional */
      }
    }

    if (can(session, 'MANAGE_USERS') || can(session, 'VIEW_USERS') || can(session, 'VIEW_SETTINGS')) {
      const r = await pool.query(
        `SELECT username::text AS username, role::text AS role FROM pendencias.users WHERE username ILIKE $1 LIMIT 8`,
        [like]
      );
      const items = (r.rows || []).map((row: { username: string; role: string }) => ({
        id: `user-${row.username}`,
        title: row.username,
        subtitle: row.role || undefined,
        href: '/app/operacional/configuracoes',
      }));
      if (items.length) {
        groups.push({ type: 'user', label: 'Usuários', items });
      }
    }

    try {
      await ensureFase1InfrastructureTables();
      const man = await pool.query(
        `
          SELECT CAST(cte AS TEXT) AS cte, serie::text AS serie
          FROM pendencias.ctes
          WHERE (CAST(cte AS TEXT) ILIKE $1 OR COALESCE(serie::text, '') ILIKE $1)
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 8
        `,
        [like],
      );
      const manItems = (man.rows || []).map((row: { cte: string; serie: string }) => ({
        id: `mf-${row.cte}-${row.serie}`,
        title: `Manifesto fiscal · CTE ${row.cte}`,
        subtitle: `Série ${row.serie || '-'}`,
        href: '/app/manifestos',
      }));
      if (manItems.length) groups.push({ type: 'manifesto', label: 'Manifestos / MDF-e', items: manItems });
    } catch {
      /* opcional */
    }

    if (can(session, 'tab.operacional.ocorrencias.view')) {
      try {
        await ensureOccurrencesSchemaTables();
        const occ = await pool.query(
          `
            SELECT id::text AS id, COALESCE(description, '') AS description, COALESCE(cte::text, '') AS cte
            FROM pendencias.occurrences
            WHERE description ILIKE $1 OR COALESCE(cte::text, '') ILIKE $1
            ORDER BY created_at DESC NULLS LAST
            LIMIT 8
          `,
          [like],
        );
        const occItems = (occ.rows || []).map((row: { id: string; description: string; cte: string }) => ({
          id: `occ-${row.id}`,
          title: (row.description || `Ocorrência ${row.id}`).slice(0, 80),
          subtitle: row.cte ? `CTE ${row.cte}` : undefined,
          href: '/app/operacional/ocorrencias',
        }));
        if (occItems.length) groups.push({ type: 'ocorrencia', label: 'Ocorrências', items: occItems });
      } catch {
        /* opcional */
      }
    }

    try {
      await ensureFase1InfrastructureTables();
      const portal = await pool.query(
        `
          SELECT id::text AS id, kind, title, href
          FROM pendencias.portal_content
          WHERE title ILIKE $1 OR COALESCE(body, '') ILIKE $1
          ORDER BY published_at DESC
          LIMIT 10
        `,
        [like],
      );
      const byKind = new Map<string, GlobalSearchGroup['items']>();
      for (const row of portal.rows || []) {
        const kind = String((row as { kind: string }).kind || 'documento');
        const label =
          kind === 'comunicado'
            ? 'Comunicados'
            : kind === 'treinamento'
              ? 'Treinamentos'
              : 'Documentos institucionais';
        const type = kind === 'comunicado' ? 'comunicado' : kind === 'treinamento' ? 'treinamento' : 'documento';
        const href =
          (row as { href: string | null }).href ||
          (kind === 'comunicado' ? '/comunicados' : kind === 'treinamento' ? '/treinamentos' : '/documentos');
        const arr = byKind.get(type) || [];
        arr.push({
          id: `portal-${(row as { id: string }).id}`,
          title: String((row as { title: string }).title || ''),
          subtitle: kind,
          href,
        });
        byKind.set(type, arr);
      }
      for (const [type, items] of byKind.entries()) {
        if (items.length)
          groups.push({
            type,
            label: type === 'comunicado' ? 'Comunicados' : type === 'treinamento' ? 'Treinamentos' : 'Documentos',
            items,
          });
      }
    } catch {
      /* opcional */
    }

    return { query: q, groups: groups.filter((g) => g.items.length > 0) };
    });

    return NextResponse.json(body);
  } catch (e) {
    console.error('global-search GET', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
