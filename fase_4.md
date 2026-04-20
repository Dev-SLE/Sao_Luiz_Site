Criar a tela de Monitoramento de Metas & Performance com base na fundação analítica do Neon e respeitando exatamente a lógica já consolidada no Power BI.

Objetivo:
Entregar um dashboard gerencial de metas e performance por agência, com:

* meta oficial do mês
* realizado no período
* previsão de fechamento
* falta vender
* progresso global
* ranking de atingimento por agência
* tabela detalhada por agência

Base oficial:

* bi.vw_metas_performance_base
* bi.vw_metas_performance_filters
* bi.vw_metas_performance_agencia_mes
* bi.vw_metas_performance_meta_oficial
* bi.vw_metas_performance_tabela_base
* bi.dim_calendario

Regras obrigatórias:

1. Agência oficial da tela

* usar `coleta` como agência oficial
* o join com metas deve ocorrer por nome normalizado de agência

2. Período

* filtros da tela: período e agência
* a meta sempre é do mês cheio correspondente ao período filtrado
* mesmo se o usuário filtrar parte do mês, a meta oficial continua sendo a meta do mês inteiro

3. Realizado

* realizado = soma de `valor_total` autorizado no intervalo filtrado

4. LY

* comparar com o mesmo intervalo do ano anterior
* não comparar mês cheio se o filtro atual estiver parcial

5. Projeção Smart
   Implementar no backend exatamente a lógica:

* usar `ontem = today - 1`
* se date_to > ontem, usar ontem como data de corte
* senão usar date_to
* dias úteis passados = do início do filtro até data de corte
* dias úteis totais = mês inteiro
* ritmo diário real = realizado / dias úteis passados
* meta diária ideal = meta oficial / dias úteis totais
* se ritmo diário real > meta diária ideal * 1.5,
  usar meta diária ideal * 1.2 como ritmo futuro realista
* senão usar o próprio ritmo diário real
* projeção = realizado + (ritmo futuro realista * dias restantes)

6. KPIs principais

* Meta Oficial
* Já Vendido (Faturamento)
* Previsão de Fechamento
* Falta Vender

7. KPI derivado

* % Atingimento Meta = Projetado Smart / Meta Oficial

8. Gráfico 1
   Progresso da Meta Global

* comparar realizado vs gap para meta
* visual tipo donut ou progresso premium

9. Gráfico 2
   Ranking de Atingimento (Real vs Meta)

* ranking por agência
* comparar realizado/projetado com meta oficial da agência
* leitura visual clara

10. Tabela
    Exibir por agência:

* Agência
* Meta Mês (R$)
* Realizado (R$)
* % Projetado
* Projeção de Fechamento
* Faturamento (Ano Passado)
* % Crescimento
* Meta Diária

11. Design
    A tela deve ser executiva e forte:

* cards premium
* contraste bom
* tabela com ótima leitura
* nada de labels técnicos
* nada de nomes de view/schema
* nada de botão "Atualizar" se a tela já for reativa
* visual alinhado ao padrão elegante já alcançado nas telas anteriores

12. Importante

* não usar `.env` para configuração estrutural
* não recalcular lógica no frontend
* não inventar colunas fora do que existe
* toda lógica crítica deve ficar no backend usando as views/base oficial

Resultado esperado:
uma tela madura de metas e performance por agência, com cálculo consistente, projeção smart confiável e visual pronto para uso gerencial.
