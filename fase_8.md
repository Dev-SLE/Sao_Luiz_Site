Criar a nova versão da tela **Planejamento Estratégico das Agências** como um simulador executivo de metas da rede, mais rico e completo, usando a base analítica pronta do banco.

# BASE OFICIAL

Usar:

* bi.vw_planejamento_agencias_ready
* bi.vw_planejamento_agencias_anual
* bi.vw_planejamento_agencias_filters

Não recalcular lógica estrutural fora dessas views.

---

# OBJETIVO

Transformar a tela em uma ferramenta de definição e distribuição de metas por agência, permitindo:

* simular crescimento
* comparar ano base, ano atual e meta futura
* entender sazonalidade por agência
* distribuir desafio de forma inteligente
* enxergar esforço financeiro por agência

---

# FILTROS

* período
* agência

---

# SIMULADOR

Manter slider de crescimento, mas elevar a experiência:

* slider principal
* valor percentual em destaque
* presets:

  * 0% Conservador
  * 5% Base
  * 10% Acelerado
  * 15% Agressivo
  * 20% Expansão

---

# LÓGICA DA META

Usar a base `bi.vw_planejamento_agencias_ready`.

Para cada agência e mês:

* meta_mes = media_diaria_ano_base * dias_uteis_ano_meta * (1 + crescimento)

Depois:

* somar por agência
* somar total geral

---

# KPIs PRINCIPAIS

Exibir:

1. Realizado Ano Base
2. Meta Simulada
3. Realizado Atual
4. Gap Financeiro Simulado
5. Crescimento Aplicado
6. Meta Diária da Rede
7. Ticket Médio da Rede
8. Agências com Desafio Alto

---

# TOOLTIPS DOS KPIs

Realizado Ano Base:
"Faturamento efetivamente realizado no ano usado como referência da projeção."

Meta Simulada:
"Meta futura calculada com base no histórico da agência, dias úteis do ano projetado e crescimento aplicado."

Realizado Atual:
"Faturamento já realizado no ano corrente dentro do período filtrado."

Gap Financeiro Simulado:
"Diferença entre a meta simulada e o realizado de referência. Mostra o tamanho do desafio."

Crescimento Aplicado:
"Percentual usado no simulador para projetar a nova meta."

Meta Diária da Rede:
"Valor médio que a rede precisa entregar por dia útil para sustentar a meta simulada."

Ticket Médio da Rede:
"Valor médio por operação das agências no período base."

Agências com Desafio Alto:
"Quantidade de agências cuja meta projetada exige esforço mais agressivo."

---

# BLOCO 1 — CURVA PRINCIPAL

Gráfico:

* Realizado Ano Base
* Realizado Atual
* Meta Simulada

Por mês.

Tooltip:
"Compara histórico, andamento atual e nova meta projetada da rede."

---

# BLOCO 2 — TABELA RESUMO POR AGÊNCIA

Colunas:

* Agência
* Realizado Ano Base
* Média Trimestral
* Meta Simulada
* Ajuste Simulado (%)
* Gap Financeiro
* Realizado Atual
* Qtd CTEs
* Ticket Médio
* Meta Diária
* Sazonalidade
* Nível de Desafio

---

# BLOCO 3 — RANKING DE GAP

Criar gráfico com:

* agências ordenadas por gap financeiro simulado

Tooltip:
"Mostra quais agências absorvem maior esforço adicional na nova meta."

---

# BLOCO 4 — DISTRIBUIÇÃO DA META

Criar gráfico com:

* participação de cada agência na meta total simulada

Tooltip:
"Ajuda a entender o peso de cada agência dentro da meta da rede."

---

# BLOCO 5 — MATRIZ DE DESAFIO

Criar visão visual por agência com:

* histórico
* meta
* crescimento
* gap
* intensidade do desafio

Pode ser:

* heatmap
  ou
* tabela com badges fortes

---

# BLOCO 6 — TABELA MENSAL DETALHADA

Exibir:

* Mês
* Agência
* Qtd CTEs
* Realizado Ano Base
* Meta Simulada
* Gap
* % Crescimento
* Dias úteis ano base
* Dias úteis ano meta
* Meta diária mensal
* Peso sazonal

---

# SAZONALIDADE

Usar `peso_sazonal_agencia`.

Gerar leitura curta como:

* “pico em março e outubro”
* “concentrada no 2º semestre”
* “mais equilibrada ao longo do ano”

Tooltip:
"Sazonalidade mostra em quais meses a agência historicamente concentra mais resultado."

---

# NÍVEL DE DESAFIO

Classificar:

* Leve
* Moderado
* Forte
* Agressivo

Base:

* percentual de crescimento
* gap
* meta diária

Tooltip:
"Mostra o grau de esforço necessário para a agência atingir a meta simulada."

---

# INSIGHTS AUTOMÁTICOS

Gerar bloco com frases como:

* "A agência X concentra maior parte do incremento."
* "A agência Y apresenta sazonalidade forte no segundo semestre."
* "O cenário atual eleva a meta diária da rede para R$ X."
* "As agências A, B e C concentram maior desafio financeiro."

---

# DESIGN

* visual premium
* sem modo gráfico/tabela alternando
* tudo junto na tela
* cards fortes
* gráfico elegante
* tabela premium
* leitura executiva
* coerente com o padrão das telas já evoluídas

---

# NOMES DA INTERFACE

Usar:

* Realizado Ano Base
* Meta Simulada
* Gap Financeiro Simulado
* Crescimento Aplicado
* Curva de Tendência da Rede
* Detalhamento Estratégico por Agência

---

# RESULTADO FINAL

A tela deve deixar de ser apenas um simulador simples e virar uma ferramenta de planejamento estratégico da rede, permitindo:

* distribuir metas por agência
* respeitar sazonalidade
* entender esforço
* medir gap
* apoiar decisões de diretoria e operação
