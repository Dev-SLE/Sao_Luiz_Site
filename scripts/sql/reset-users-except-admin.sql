-- Apaga todos os utilizadores excepto "admin" (case-insensitive).
-- Faça backup da base antes de executar. Ajuste o literal se o admin tiver outro username.

DELETE FROM pendencias.users
WHERE LOWER(TRIM(username)) <> LOWER(TRIM('admin'));
