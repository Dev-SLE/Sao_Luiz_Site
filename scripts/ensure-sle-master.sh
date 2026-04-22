#!/usr/bin/env bash
# Cria ou atualiza o utilizador reservado `sle_master` (ver lib/adminSuperRoles.ts).
# Não commite senhas: passe por argumento ou pela env PASSWORD.
#
# Uso:
#   export DATABASE_URL='postgresql://...'
#   ./scripts/ensure-sle-master.sh 'SuaSenhaForte'
#   # ou
#   PASSWORD='SuaSenhaForte' ./scripts/ensure-sle-master.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASSWORD="${PASSWORD:-${1:-}}"
if [[ -z "${PASSWORD}" ]]; then
  echo "Erro: defina a senha: PASSWORD='...' $0   ou   $0 '...'" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erro: defina DATABASE_URL (connection string PostgreSQL)." >&2
  exit 1
fi

export PASSWORD
cd "$ROOT"

node --input-type=module <<'NODE'
import pg from "pg";
import bcrypt from "bcryptjs";

const password = process.env.PASSWORD;
if (!password) throw new Error("PASSWORD vazio");

const hash = bcrypt.hashSync(password, 10);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
INSERT INTO pendencias.users (
  username, password_hash, role,
  linked_origin_unit, linked_dest_unit, linked_bi_vendedora,
  must_change_password, session_version, password_changed_at, updated_at
)
VALUES ($1, $2, $3, NULL, NULL, NULL, $4, 1, NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  must_change_password = EXCLUDED.must_change_password,
  session_version = COALESCE(pendencias.users.session_version, 1) + 1,
  password_changed_at = NOW(),
  updated_at = NOW()
RETURNING username, role, must_change_password;
`;

const r = await pool.query(sql, ["sle_master", hash, "master", false]);
console.log("Utilizador sle_master pronto:", r.rows[0]);
await pool.end();
NODE
