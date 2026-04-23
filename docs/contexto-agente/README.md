# Contexto para o agente (Cursor / IA)

Coloque aqui **ficheiros temporários** que queira que a IA leia numa tarefa: exports CSV, logs sanitizados, notas de incidente, etc.

## Importante

- **Nada nesta pasta é versionado** (exceto este `README` e o `.gitignore`), para não subir dados sensíveis nem lixo ao Git.
- Não coloque `.env`, palavras-passe, tokens ou chaves privadas. Use sempre variáveis de ambiente no servidor e `.env` local (já está no `.gitignore` na raiz).

## Como usar

1. Arraste ou grave ficheiros dentro de `docs/contexto-agente/`.
2. No chat, referencie o caminho, por exemplo: `docs/contexto-agente/meu-export.csv`.

Para limpar, apague os ficheiros manualmente quando já não precisar deles.
