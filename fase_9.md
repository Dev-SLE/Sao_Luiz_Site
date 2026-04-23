Criar a segunda tela de BI financeiro do sistema, focada em Tesouraria e Fluxo de Caixa, seguindo exatamente o mesmo padrão arquitetural, visual e técnico já usado nas demais telas de BI do projeto.

Objetivo:
Construir uma tela executiva e analítica para mostrar o fluxo real de tesouraria, transferências entre contas, circulação de valores, suprimentos de caixa e agrupamentos operacionais do dinheiro.

Stack e padrão:

* Usar exatamente a mesma stack, arquitetura, padrão de pastas, padrão de rotas, padrão de hooks, padrão de services, padrão de cards, padrão de filtros, padrão de gráficos e padrão de tabela usados nas outras telas do BI.
* Reaproveitar os componentes já existentes do projeto.
* Não criar uma arquitetura paralela.
* Não trocar bibliotecas nem padrão visual.

Nome da tela:
Tesouraria e Fluxo de Caixa

Local da tela:

* Criar dentro da área de BI, no mesmo grupo das demais telas.
* Registrar a rota no mesmo padrão do projeto.
* Inserir no menu da área Financeiro / BI.

Fontes de dados:
A tela deve consumir estas views do Postgres:

* bi.vw_tesouraria_resumo_geral
* bi.vw_tesouraria_por_origem
* bi.vw_tesouraria_por_destino
* bi.vw_tesouraria_historicos
* bi.vw_tesouraria_transferencias

Backend / API:

* Seguir exatamente o mesmo padrão das outras telas.
* Criar endpoints/backend no padrão do projeto, sem acesso improvisado.
* Respeitar o fluxo já existente:
  frontend -> hook/service -> endpoint backend -> query/view

Filtros globais:
Criar filtros no topo com o mesmo padrão das outras telas:

* período
* grupo de fluxo
* conta origem
* conta destino
* busca textual por histórico ou documento

Regras dos filtros:

* período padrão: últimos 12 meses
* todos os cards, gráficos e tabela devem responder aos filtros
* busca textual deve filtrar pelo menos:

  * historico
  * historico_limpo
  * numero_documento

Cards principais:
Criar cards com:

1. Total Transferido
2. Total Tesouraria
3. Total Suprimento de Caixa
4. Total Conciliado
5. Quantidade de Transferências

Origem:

* bi.vw_tesouraria_resumo_geral

Gráficos:

1. Evolução Mensal das Transferências

* fonte: bi.vw_tesouraria_resumo_geral
* eixo X: mes_referencia
* séries:

  * total_transferido
  * total_tesouraria
  * total_suprimento
  * total_conciliado

2. Top Contas de Origem

* fonte: bi.vw_tesouraria_por_origem
* eixo principal: conta_origem
* métrica: valor_total

3. Top Contas de Destino

* fonte: bi.vw_tesouraria_por_destino
* eixo principal: conta_destino
* métrica: valor_total

4. Distribuição por Grupo de Fluxo

* fonte: bi.vw_tesouraria_historicos
* eixo principal: grupo_fluxo
* métrica: valor_total

Tabela analítica:
Criar uma tabela detalhada usando:

* bi.vw_tesouraria_transferencias

Colunas da tabela:

* id_transferencia
* data
* data_conciliacao
* vencimento
* banco_origem
* conta_origem
* banco_destino
* conta_destino
* valor_transferencia
* numero_documento
* historico
* grupo_fluxo
* foi_conciliado
* id_convenio_orig
* id_convenio_dest
* tipo
* tipo_transferencia
* tipo_lcto

Regras visuais da tabela:

* valores monetários em real brasileiro
* datas no formato brasileiro
* conciliado com badge visual
* não conciliado com badge visual
* ordenação padrão do mais recente para o mais antigo
* permitir busca e paginação no mesmo padrão das outras telas

Comportamento esperado:

* todos os blocos respondem aos filtros
* loading skeleton no padrão do sistema
* empty state amigável
* tratamento de erro amigável
* código componentizado
* mesma identidade visual da Tela 1

Objetivo final:
Entregar uma tela de Tesouraria e Fluxo de Caixa pronta para uso real, consistente com o sistema e pronta para evolução futura com pagamentos bancários e conciliação mais avançada.
