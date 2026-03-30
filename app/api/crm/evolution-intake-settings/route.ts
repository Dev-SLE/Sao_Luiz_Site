import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureCrmSchemaTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const settingsRes = await pool.query(
      `
        SELECT lead_filter_mode, ai_enabled, min_messages_before_create, allowlist_last10, denylist_last10, updated_at
        FROM pendencias.crm_evolution_intake_settings
        WHERE id = 1
        LIMIT 1
      `
    );
    const s = settingsRes.rows?.[0] || {};
    const bufferRes = await pool.query(
      `
        SELECT COUNT(*)::int AS pending_count
        FROM pendencias.crm_evolution_intake_buffer
        WHERE created_lead_id IS NULL
      `
    );
    return NextResponse.json({
      settings: {
        leadFilterMode: String(s.lead_filter_mode || "BUSINESS_ONLY"),
        aiEnabled: s.ai_enabled !== false,
        minMessagesBeforeCreate: Number(s.min_messages_before_create || 2),
        allowlistLast10: String(s.allowlist_last10 || ""),
        denylistLast10: String(s.denylist_last10 || ""),
        updatedAt: s.updated_at || null,
      },
      pendingBufferCount: Number(bufferRes.rows?.[0]?.pending_count || 0),
    });
  } catch (error) {
    console.error("evolution-intake-settings GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCrmSchemaTables();
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const leadFilterMode = String(body?.leadFilterMode || "BUSINESS_ONLY").toUpperCase();
    const aiEnabled = body?.aiEnabled !== false;
    const minMessagesBeforeCreate = Math.max(1, Math.min(10, Number(body?.minMessagesBeforeCreate || 2)));
    const allowlistLast10 = String(body?.allowlistLast10 || "");
    const denylistLast10 = String(body?.denylistLast10 || "");

    if (!["OFF", "BUSINESS_ONLY", "AGENCY_ONLY"].includes(leadFilterMode)) {
      return NextResponse.json({ error: "leadFilterMode inválido" }, { status: 400 });
    }

    await pool.query(
      `
        UPDATE pendencias.crm_evolution_intake_settings
        SET
          lead_filter_mode = $1,
          ai_enabled = $2,
          min_messages_before_create = $3,
          allowlist_last10 = $4,
          denylist_last10 = $5,
          updated_at = NOW()
        WHERE id = 1
      `,
      [leadFilterMode, aiEnabled, minMessagesBeforeCreate, allowlistLast10, denylistLast10]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("evolution-intake-settings POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

