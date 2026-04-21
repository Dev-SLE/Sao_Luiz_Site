/** Textos de ajuda contextual (linguagem comercial, sem jargao de banco). */

export type HelpBlock = { label: string; text: string };

export const GLOSSARY = {
  faturamentoReal:
    "É o valor que o cliente realmente movimentou no período filtrado. Representa a receita já realizada.",
  potencialEstimado:
    "É uma estimativa do quanto esse cliente pode movimentar com a empresa, considerando comportamento e perfil.",
  gapNaMesa: "É a diferença entre o potencial estimado e o faturamento real. Mostra quanto ainda pode ser capturado.",
  dinheiroEmRisco:
    "É a receita ligada a clientes em queda ou risco de churn. Ajuda a priorizar retenção antes da perda.",
  receitaSegura:
    "É a parcela do faturamento vinda de clientes com contrato ativo. Quanto maior, mais previsível é a receita.",
  crescimentoYoy: "Compara o faturamento atual com o mesmo período do ano anterior.",
  crescimentoMom: "Compara o faturamento atual com o período imediatamente anterior.",
  riscoChurn:
    "São clientes com sinais de enfraquecimento na relação comercial e maior chance de reduzir ou parar compras.",
  clientesEmQueda: "São clientes que já demonstram perda de ritmo em relação ao histórico recente.",
  recencia:
    "Mostra há quantos dias o cliente teve movimentação relevante. Quanto maior o número de dias, maior o risco de esfriamento.",
  ticketMedio: "É o valor médio por operação ou compra do cliente no período analisado.",
  categoriaCliente:
    "Classificação do cliente com base em faturamento, movimentação e potencial comercial.",
  contratoAtivo: "Indica se o cliente possui tabela ou relação contratual válida no momento.",
  mensalista: "Indica se o cliente opera em regime recorrente, com comportamento mais previsível.",
  potencialCif:
    "Indica oportunidade de capturar fretes em operações onde o cliente pode migrar ou ampliar contratação com a empresa.",
  oportunidadeAberta:
    "Valor que ainda pode ser desenvolvido comercialmente, considerando gap e perfil do cliente.",
  proximaAcao:
    "É a recomendação comercial prioritária para aquele cliente: recuperar, reativar, propor contrato, atacar CIF ou acompanhar.",
  scoreOportunidade:
    "Pontuação que ajuda a ordenar os clientes mais relevantes para ação comercial. Quanto maior, maior a prioridade.",
  ativacaoCarteira:
    "Mostra a proporção de clientes detectados que realmente estão ativos no período.",
  b2bVsB2c:
    "Separa clientes corporativos e pessoas físicas para entender o perfil da base e do faturamento.",
  spot: "Receita sem contrato recorrente. Pode ser oportunidade de conversão para relação mais estável.",
  ouro: "Marca clientes de alto valor ou relevância comercial dentro da base analisada.",
  gigantesOcultos:
    "São contas com grande potencial ou movimentação, mas ainda abaixo do que poderiam representar para a empresa.",
  atuacaoTomador: "Indica se o cliente já aparece como responsável pelo frete nas operações.",
  atuacaoRemetente: "Indica se o cliente envia cargas pela rede.",
  atuacaoDestinatario: "Indica se o cliente recebe cargas pela rede.",
  comportamentoLogistico:
    "Mostra como o cliente participa da operação: envio, recebimento ou pagamento do frete.",
  statusAtividade: "Resume o momento da relação: ativo, em queda, risco de churn ou inativo.",
} as const;

export const COCKPIT = {
  tituloTela:
    "Central de priorização comercial. Mostra onde agir agora para recuperar, expandir ou proteger receita.",
  oportunidadeTotal: "Soma do valor que ainda pode ser desenvolvido comercialmente entre os clientes filtrados.",
  dinheiroEmRiscoCard: "Receita atualmente exposta a clientes em queda ou risco de churn.",
  potencialCifCard: "Valor potencial de clientes com sinal de oportunidade em operações CIF.",
  clientesPrioritarios: "Quantidade de contas com maior score de oportunidade para ação imediata.",
  colGap: "Diferença entre o potencial estimado e o faturamento real.",
  colProximaAcao: "Sugestão objetiva do que fazer com o cliente neste momento.",
  colScore: "Prioridade comercial calculada para ordenar a carteira.",
  rankingTitulo: "Lista priorizada por score, com contato rápido e histórico no drill.",
} as const;

export const EXECUTIVA = {
  tituloTela:
    "Visão consolidada da saúde comercial da empresa, com foco em crescimento, previsibilidade e oportunidade.",
  evolucaoMensal: "Mostra como a receita e o potencial evoluem ao longo do tempo.",
  graficoContrato: "Compara a receita contratada com a receita pontual, ajudando a medir estabilidade da base.",
  graficoB2b: "Mostra a composição da receita entre clientes corporativos e clientes pessoa física.",
  graficoCategoria: "Ajuda a entender quais perfis de cliente sustentam mais receita.",
  graficoStatus: "Resume a base entre ativos, em queda, risco de churn e inativos.",
  kpiReceitaContratos:
    "Participação do faturamento que vem de clientes com contrato. Quanto maior, mais previsível é a receita.",
} as const;

export const RISCO = {
  tituloTela:
    "Painel de retenção e deterioração da carteira. Mostra quem está esfriando e onde existe risco de perda.",
  cardEmQueda: "Contagem de clientes que reduziram ritmo recentemente.",
  cardRiscoChurn: "Contagem de clientes com maior chance de abandono ou retração.",
  cardInativos: "Clientes sem movimentação relevante no período analisado.",
  cardTicketRisco: "Valor médio das contas que hoje estão em risco.",
  graficoStatus: "Distribui o dinheiro em risco por status de relacionamento com o cliente.",
  colRecencia: "Dias desde a movimentação mais recente relevante.",
  colDinheiroRisco: "Receita atualmente ameaçada em cada conta.",
} as const;

export const GAP = {
  tituloTela: "Mostra o espaço real de crescimento dentro da carteira existente.",
  cardFaturamento: "Receita já realizada no período filtrado.",
  cardPotencial: "Receita que a base pode alcançar segundo o modelo analítico.",
  cardGap: "Valor ainda não capturado entre o real e o potencial.",
  graficoCategoria: "Compara quanto cada categoria já entrega e quanto ainda pode entregar em termos de GAP.",
  rankingTitulo: "Clientes com maior folga entre potencial e faturamento real.",
} as const;

export const RADAR = {
  tituloTela:
    "Painel de expansão comercial. Mostra onde existe potencial para abrir, ampliar ou converter contas.",
  cardAlvos: "Quantidade de contas elegíveis dentro dos filtros atuais.",
  cardPotencialTotal: "Soma do potencial estimado da base exibida.",
  cardTicketAlvo: "Valor médio esperado das contas-alvo no período.",
  graficoDoc: "Mostra onde está concentrada a base por tipo de documento (quantidade de clientes).",
  exploracao: "Atalhos para contas com melhor combinação de score e oportunidade no recorte atual.",
  tabelaExploratoria: "Visão compacta com documento, categoria e faturamento para priorizar conversas.",
  colPotencialCif: "Indica cliente com espaço para captura de operações CIF.",
  colSemContrato: "Conta que movimenta ou tem potencial, mas ainda não está protegida por contrato.",
} as const;

export const INTERPRET = {
  cockpit: {
    oQueResponde: "Quais clientes merecem ação agora.",
    comoInterpretar: "Score alto com risco ou GAP alto indica prioridade máxima na fila.",
    oQueFazer: "Recuperar queda, reativar inativos, propor contrato ou atacar oportunidade CIF.",
  },
  executiva: {
    oQueResponde: "Se a carteira está crescendo, estável e quanto ainda dá para capturar.",
    comoInterpretar: "Evolução mensal mostra tendência; contrato versus pontual mostra previsibilidade.",
    oQueFazer: "Ajustar política comercial, metas de carteira e foco por categoria ou status.",
  },
  risco: {
    oQueResponde: "Onde a receita pode escapar nos próximos ciclos.",
    comoInterpretar: "Status em queda ou churn concentra dinheiro em risco; recência alta alerta esfriamento.",
    oQueFazer: "Contato preventivo, plano de recuperação e revisão de contratos nos casos críticos.",
  },
  gap: {
    oQueResponde: "Quanto espaço existe entre o que já fatura e o que a base pode render.",
    comoInterpretar: "GAP alto com faturamento baixo aponta folga de crescimento sem precisar buscar cliente novo.",
    oQueFazer: "Cross-sell, upgrade de tabela e conversão de spot para contrato.",
  },
  radar: {
    oQueResponde: "Onde investir esforço de prospecção e expansão com retorno mais claro.",
    comoInterpretar: "CIF e sem contrato com faturamento mostram aberturas rápidas de conversa.",
    oQueFazer: "Agendar abordagem comercial, proposta de vínculo e mapeamento de operação CIF.",
  },
} as const;
