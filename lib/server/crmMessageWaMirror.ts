/**
 * Espelha edições/apagados do WhatsApp (Evolution ou Meta) em `pendencias.crm_messages`.
 */

export async function applyCrmMessageEditByWaMessageId(
  pool: any,
  waMessageId: string,
  newText: string
): Promise<number> {
  if (!waMessageId || !String(newText || "").trim()) return 0;
  const patch = {
    wa_edited: true,
    edited_at: new Date().toISOString(),
  };
  const res = await pool.query(
    `
      UPDATE pendencias.crm_messages
      SET body = $1,
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE metadata->>'message_id' = $3
         OR metadata#>>'{outbound_whatsapp,message_id}' = $3
         OR provider_message_id = $3
      RETURNING id
    `,
    [newText, JSON.stringify(patch), waMessageId]
  );
  return res.rows?.length || 0;
}

export async function applyCrmMessageDeleteByWaMessageId(pool: any, waMessageId: string): Promise<number> {
  if (!waMessageId) return 0;
  const patch = {
    deleted_at: new Date().toISOString(),
    wa_deleted: true,
  };
  const res = await pool.query(
    `
      UPDATE pendencias.crm_messages
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
      WHERE metadata->>'message_id' = $2
         OR metadata#>>'{outbound_whatsapp,message_id}' = $2
         OR provider_message_id = $2
      RETURNING id
    `,
    [JSON.stringify(patch), waMessageId]
  );
  return res.rows?.length || 0;
}
