# Matriz de Autorização BI (Servidor)

Esta matriz define o contrato obrigatório `endpoint -> permissão -> escopo`.

## Regras Globais

- Todo endpoint BI exige sessão válida.
- Sem fallback de `module.gerencial.view` para leitura de dados BI.
- Escopo de agência/vendedora é aplicado no servidor antes da query.

## Comercial 360

- Prefixo: `/api/bi/comercial-360/*`
- Permissão mínima:
  - setor: `tab.gerencial.setor.comercial.view`
  - subtela (obrigatória via `tab=`): `tab.gerencial.360.{cockpit|executiva|risco|gap|radar}.view`
- Escopo: período + filtros; sem bypass por troca manual de `tab`.

## BI Comercial (Comissões/Funil/Sprint/Metas/Carteira)

- Prefixos:
  - `/api/bi/comissoes/*`
  - `/api/bi/funil-vendas/*`
  - `/api/bi/sprint-vendas/*`
  - `/api/bi/metas-performance/*`
  - `/api/bi/planejamento-agencias/*`
  - `/api/bi/simulador-metas/*`
  - `/api/bi/tabelas-combinadas/*`
- Permissão mínima:
  - setor: `tab.gerencial.setor.comercial.view`
  - aba específica (`tab.gerencial.*.view`)
- Escopo:
  - `linked_bi_vendedora` quando preenchido
  - agência por `origin/dest` quando aplicável (metas)

## BI Operação (Fluxo/Taxas/Desempenho/Rotas)

- Prefixos:
  - `/api/bi/fluxo/*`
  - `/api/bi/taxas/*`
  - `/api/bi/desempenho-agencias/*`
  - `/api/bi/rotas-operacionais/*`
- Permissão mínima:
  - setor: `tab.gerencial.setor.operacao.view`
  - aba: `tab.gerencial.fluxo.view` ou `tab.gerencial.taxas.view`
- Escopo obrigatório:
  - agência vinculada (`origin/dest`) aplicada no servidor em dataset/facet/drill/export.

## Holerite de Comissões

- Endpoint:
  - `/api/bi/comissoes/holerite`
  - `/api/bi/comissoes/holerite/export-xlsx`
- Permissão mínima:
  - `module.gerencial.comissoes_holerite` **ou**
  - `tab.gerencial.setor.comercial.view` + `tab.gerencial.comissoes.view`
- Escopo:
  - mesmo escopo de comissões aplicado no servidor.

