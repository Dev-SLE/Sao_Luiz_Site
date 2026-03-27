import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const s = String(key);
  if (s.length <= 4) return "****";
  return `…${s.slice(-4)}`;
}

export async function GET(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    let query = `
      SELECT
        id,
        name,
        provider,
        phone_number_id,
        evolution_instance_name,
        evolution_server_url,
        evolution_api_key,
        team_id,
        is_active,
        created_at
      FROM pendencias.crm_whatsapp_inboxes
      WHERE 1=1
    `;
    const params: any[] = [];
    if (provider) {
      params.push(provider.toUpperCase());
      query += ` AND provider = $${params.length}`;
    }
    query += ` ORDER BY provider ASC, name ASC`;

    const res = await pool.query(query, params);
    const inboxes = (res.rows || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      provider: String(r.provider || "META"),
      phoneNumberId: r.phone_number_id ? String(r.phone_number_id) : null,
      evolutionInstanceName: r.evolution_instance_name ? String(r.evolution_instance_name) : null,
      evolutionServerUrl: r.evolution_server_url ? String(r.evolution_server_url) : null,
      hasEvolutionApiKey: Boolean(r.evolution_api_key && String(r.evolution_api_key).length > 0),
      evolutionApiKeyLast4: maskKey(r.evolution_api_key),
      teamId: r.team_id ? String(r.team_id) : null,
      isActive: !!r.is_active,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ inboxes });
  } catch (e) {
    console.error("whatsapp-inboxes GET:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "UPSERT_EVOLUTION").toUpperCase();

    if (action === "DELETE") {
      const id = body?.id ? String(body.id) : null;
      if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      await pool.query(
        `UPDATE pendencias.crm_whatsapp_inboxes SET is_active = false, updated_at = NOW() WHERE id = $1::uuid`,
        [id]
      );
      return NextResponse.json({ success: true });
    }

    if (action !== "UPSERT_EVOLUTION") {
      return NextResponse.json({ error: "action inválida" }, { status: 400 });
    }

    const id = body?.id ? String(body.id) : null;
    const name = String(body?.name || "").trim();
    const evolutionInstanceName = String(body?.evolutionInstanceName || "").trim();
    const evolutionServerUrl = String(body?.evolutionServerUrl || "")
      .trim()
      .replace(/\/+$/, "");
    const evolutionApiKey = body?.evolutionApiKey != null ? String(body.evolutionApiKey).trim() : "";
    const teamId =
      body?.teamId != null && String(body.teamId).trim() ? String(body.teamId).trim() : null;

    if (!name || !evolutionInstanceName || !evolutionServerUrl) {
      return NextResponse.json({ error: "name, evolutionInstanceName e evolutionServerUrl obrigatórios" }, { status: 400 });
    }

    if (id) {
      if (evolutionApiKey) {
        await pool.query(
          `
          UPDATE pendencias.crm_whatsapp_inboxes
          SET
            name = $2,
            evolution_instance_name = $3,
            evolution_server_url = $4,
            evolution_api_key = $5,
            team_id = $6::uuid,
            is_active = true,
            updated_at = NOW()
          WHERE id = $1::uuid AND provider = 'EVOLUTION'
        `,
          [id, name, evolutionInstanceName, evolutionServerUrl, evolutionApiKey, teamId]
        );
      } else {
        await pool.query(
          `
          UPDATE pendencias.crm_whatsapp_inboxes
          SET
            name = $2,
            evolution_instance_name = $3,
            evolution_server_url = $4,
            team_id = $5::uuid,
            is_active = true,
            updated_at = NOW()
          WHERE id = $1::uuid AND provider = 'EVOLUTION'
        `,
          [id, name, evolutionInstanceName, evolutionServerUrl, teamId]
        );
      }
      return NextResponse.json({ success: true, id });
    }

    if (!evolutionApiKey) {
      return NextResponse.json({ error: "evolutionApiKey obrigatório ao criar inbox" }, { status: 400 });
    }

    const ins = await pool.query(
      `
      INSERT INTO pendencias.crm_whatsapp_inboxes (
        name,
        provider,
        phone_number_id,
        evolution_instance_name,
        evolution_server_url,
        evolution_api_key,
        team_id,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, 'EVOLUTION', NULL, $2, $3, $4, $5::uuid, true, NOW(), NOW())
      RETURNING id
    `,
      [name, evolutionInstanceName, evolutionServerUrl, evolutionApiKey, teamId]
    );
    return NextResponse.json({ success: true, id: ins.rows?.[0]?.id });
  } catch (e: any) {
    console.error("whatsapp-inboxes POST:", e);
    const msg = e?.code === "23505" ? "Nome de instância Evolution já cadastrado" : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
