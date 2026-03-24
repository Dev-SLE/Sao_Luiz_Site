import { NextResponse } from "next/server";
import { getCommercialPool } from "../../../../lib/server/db";
import { ensureCommercialTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureCommercialTables();
    const { searchParams } = new URL(req.url);
    const status = String(searchParams.get("status") || "").trim();
    const limitRaw = Number(searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.floor(limitRaw))) : 200;
    const pool = getCommercialPool();

    const result = await pool.query(
      `
        SELECT
          id, data_cobranca, agencia, perc_projetado, status_auditoria,
          motivo_queda, resumo_resposta, plano_acao, data_atualizacao,
          prioridade, responsavel, data_retorno_prevista, retorno_responsavel,
          conclusao, resultado_evolucao, concluido, concluido_em
        FROM public.tb_auditoria_metas
        WHERE ($1::text = '' OR UPPER(COALESCE(status_auditoria, '')) = UPPER($1::text))
        ORDER BY data_atualizacao DESC
        LIMIT $2
      `,
      [status, limit]
    );

    return NextResponse.json({
      rows: (result.rows || []).map((r: any) => ({
        id: Number(r.id),
        dataCobranca: r.data_cobranca ? String(r.data_cobranca) : null,
        agencia: String(r.agencia || ""),
        percProjetado: Number(r.perc_projetado || 0),
        statusAuditoria: String(r.status_auditoria || ""),
        motivoQueda: r.motivo_queda ? String(r.motivo_queda) : "",
        resumoResposta: r.resumo_resposta ? String(r.resumo_resposta) : "",
        planoAcao: r.plano_acao ? String(r.plano_acao) : "",
        prioridade: String(r.prioridade || "MEDIA"),
        responsavel: r.responsavel ? String(r.responsavel) : "",
        dataRetornoPrevista: r.data_retorno_prevista ? String(r.data_retorno_prevista) : "",
        retornoResponsavel: r.retorno_responsavel ? String(r.retorno_responsavel) : "",
        conclusao: r.conclusao ? String(r.conclusao) : "",
        resultadoEvolucao: String(r.resultado_evolucao || "NAO_AVALIADO"),
        concluido: !!r.concluido,
        concluidoEm: r.concluido_em ? String(r.concluido_em) : null,
        dataAtualizacao: r.data_atualizacao ? String(r.data_atualizacao) : null,
      })),
    });
  } catch (error) {
    console.error("Comercial auditoria GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar auditorias comerciais" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureCommercialTables();
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const statusAuditoria = String(body?.statusAuditoria || "Aguardando Retorno").trim();
    const motivoQueda = body?.motivoQueda != null ? String(body.motivoQueda) : "";
    const resumoResposta = body?.resumoResposta != null ? String(body.resumoResposta) : "";
    const planoAcao = body?.planoAcao != null ? String(body.planoAcao) : "";
    const prioridade = body?.prioridade != null ? String(body.prioridade).toUpperCase() : "MEDIA";
    const responsavel = body?.responsavel != null ? String(body.responsavel) : "";
    const dataRetornoPrevista = body?.dataRetornoPrevista != null ? String(body.dataRetornoPrevista) : "";
    const retornoResponsavel = body?.retornoResponsavel != null ? String(body.retornoResponsavel) : "";
    const conclusao = body?.conclusao != null ? String(body.conclusao) : "";
    const resultadoEvolucao = body?.resultadoEvolucao != null ? String(body.resultadoEvolucao).toUpperCase() : "NAO_AVALIADO";
    const concluido = !!body?.concluido;
    const actor = body?.actor != null ? String(body.actor) : "";

    const pool = getCommercialPool();
    const prevRes = await pool.query(
      `SELECT status_auditoria, prioridade, responsavel, concluido FROM public.tb_auditoria_metas WHERE id = $1 LIMIT 1`,
      [id]
    );
    const prev = prevRes.rows?.[0];
    await pool.query(
      `
        UPDATE public.tb_auditoria_metas
        SET
          status_auditoria = $2,
          motivo_queda = $3,
          resumo_resposta = $4,
          plano_acao = $5,
          prioridade = $6,
          responsavel = $7,
          data_retorno_prevista = NULLIF($8::text, '')::date,
          retorno_responsavel = $9,
          conclusao = $10,
          resultado_evolucao = $11,
          concluido = $12,
          concluido_em = CASE WHEN $12 THEN COALESCE(concluido_em, NOW()) ELSE NULL END,
          data_atualizacao = NOW()
        WHERE id = $1
      `,
      [
        id,
        statusAuditoria,
        motivoQueda,
        resumoResposta,
        planoAcao,
        prioridade,
        responsavel,
        dataRetornoPrevista,
        retornoResponsavel,
        conclusao,
        resultadoEvolucao,
        concluido,
      ]
    );
    await pool.query(
      `
        INSERT INTO public.tb_auditoria_metas_historico
        (auditoria_id, acao, actor, note, previous_status, next_status, created_at)
        VALUES ($1, $2, NULLIF($3,''), $4, $5, $6, NOW())
      `,
      [
        id,
        "UPDATE_TRATATIVA",
        actor,
        `Prioridade: ${prioridade}; Responsável: ${responsavel || "N/D"}; Evolução: ${resultadoEvolucao}`,
        prev?.status_auditoria ? String(prev.status_auditoria) : null,
        statusAuditoria,
      ]
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Comercial auditoria POST error:", error);
    return NextResponse.json({ error: "Erro ao salvar auditoria comercial" }, { status: 500 });
  }
}

