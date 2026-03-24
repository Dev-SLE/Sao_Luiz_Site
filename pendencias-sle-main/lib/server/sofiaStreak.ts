/**
 * Conta mensagens consecutivas do CLIENTE no topo do histórico (mais recentes primeiro).
 * Útil para governança: "após X mensagens do cliente" = sequência atual sem resposta da IA/humano.
 */
export function countTrailingClientStreak(rows: { sender_type?: string }[] | null | undefined): number {
  if (!rows?.length) return 0;
  let streak = 0;
  for (const m of rows) {
    if (String(m.sender_type || "").toUpperCase() === "CLIENT") streak += 1;
    else break;
  }
  return streak;
}
