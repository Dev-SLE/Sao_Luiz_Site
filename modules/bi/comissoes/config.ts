/**
 * Configuração versionada do BI de Comissões (schema `bi`).
 * Nomes de views, colunas de filtro e correlação com a base analítica — não usar `.env` para isso.
 */

export const BI_COMISSOES_CONFIG = {
  dateColumn: "data_referencia",
  filters: {
    vendedor: "vendedor_final",
    tipoComissao: "tipo_comissao",
    tabelaNome: "tabela_nome",
  },
  /**
   * Lista fechada de `vendedor_final` no BI (case-insensitive). Afeta facet, KPIs, ranking, tabela, drill e holerite.
   * Use `[]` para não restringir. Nomes devem bater com o banco (ex.: CATINAI).
   */
  vendedorFinalAllowlist: ["BEATRIZ", "BRENDA", "CATINAI", "VALERIANA"] as const,
  views: {
    base: "bi.vw_comissoes_base",
    kpis: "bi.vw_comissoes_kpis",
    ranking: "bi.vw_comissoes_ranking",
    tabela: "bi.vw_comissoes_tabela",
    drill: "bi.vw_comissoes_vendedor_tipo",
    filters: "bi.vw_comissoes_filters",
  },
  grouping: {
    chartCategory: "vendedor_final",
    chartSeries: "tipo_comissao",
    drillKeys: ["vendedor_final", "tipo_comissao"] as const,
    /** Coluna de vendedor na view de tabela (alias da view agregada). */
    tableGroup: "vendedor",
  },
  /**
   * Como aplicar o período e filtros dimensionais a partir de `bi.vw_comissoes_base`.
   * - `kpis`: view agregada — apenas `EXISTS` na base (sem correlacionar linha a linha com `t`).
   * - `ranking` / `drill`: correlacionar `b` com `t` pelas chaves de negócio.
   * - `tabela`: agregada por vendedor — correlacionar só vendedor (primeira coluna em `viewCandidates` que existir na view).
   */
  baseExists: {
    kpis: { mode: "uncorrelated" as const },
    ranking: {
      mode: "correlate" as const,
      pairs: [
        {
          baseCol: "vendedor_final",
          viewCandidates: ["vendedor_final", "nome_vendedor", "nm_vendedor", "vendedor"] as const,
        },
        { baseCol: "tipo_comissao", viewCandidates: ["tipo_comissao", "tipo"] as const },
      ],
    },
    tabela: {
      mode: "correlate" as const,
      pairs: [{ baseCol: "vendedor_final", viewCandidates: ["vendedor", "vendedor_final"] as const }],
    },
    drill: {
      mode: "correlate" as const,
      pairs: [
        {
          baseCol: "vendedor_final",
          viewCandidates: ["vendedor_final", "nome_vendedor", "nm_vendedor", "vendedor"] as const,
        },
        { baseCol: "tipo_comissao", viewCandidates: ["tipo_comissao", "tipo"] as const },
      ],
    },
  },
  /** Colunas numéricas candidatas para o eixo de valor do gráfico empilhado. */
  chartValueCandidates: ["valor_comissao", "vl_comissao", "valor", "vlr_comissao"] as const,
  /**
   * Colunas fixas do holerite (linha a linha), na ordem pedida.
   * Chaves são candidatos na resposta de `bi.vw_comissoes_base`.
   */
  holeriteLineColumns: [
    {
      id: "data_emissao",
      label: "Data emissão",
      keys: ["data_emissao", "dt_emissao", "data_emissao_nf", "dt_emissao_nf"] as const,
      format: "dateFull" as const,
    },
    {
      id: "tabela",
      label: "Tabela",
      keys: ["tabela_nome", "tabela", "origem_tabela"] as const,
      format: "text" as const,
    },
    {
      id: "nf_serie",
      label: "NF / série",
      nfKeys: ["numero_nf", "nf", "num_nf", "nr_nf"] as const,
      serieKeys: ["serie", "serie_nf", "ser_nf"] as const,
      format: "nfSerie" as const,
    },
    {
      id: "valor_comissao",
      label: "Valor comissão",
      keys: ["valor_comissao", "vl_comissao", "valor", "vlr_comissao"] as const,
      format: "brl" as const,
    },
    {
      id: "porcentagem_comissao",
      label: "% comissão",
      keys: ["porcentagem_comissao", "perc_comissao", "pct_comissao"] as const,
      format: "percent" as const,
    },
    {
      id: "tipo_comissao",
      label: "Tipo comissão",
      keys: ["tipo_comissao", "tipo"] as const,
      format: "text" as const,
    },
  ] as const,
  /** Rótulos sugeridos no holerite (ordem de exibição quando a coluna existir). */
  holeritePreferredColumns: [
    { keys: ["data_emissao", "dt_emissao", "data_emissao_nf", "dt_emissao_nf"], label: "Data emissão" },
    { keys: ["vendedor_final", "nome_vendedor", "nm_vendedor", "vendedor"], label: "Vendedor" },
    { keys: ["tabela_nome", "tabela", "origem_tabela"], label: "Tabela / origem" },
    { keys: ["numero_nf", "nf", "num_nf", "nr_nf"], label: "NF" },
    { keys: ["serie_nf", "serie", "ser_nf"], label: "Série" },
    { keys: ["chave_cte", "chave_acesso_cte", "chave_nfe", "chave"], label: "Chave (CT-e / NF-e)" },
    { keys: ["numero_cte", "nro_cte", "cte"], label: "CT-e" },
    { keys: ["serie_cte", "ser_cte"], label: "Série CT-e" },
    { keys: ["valor_comissao", "vl_comissao", "valor", "vlr_comissao"], label: "Valor comissão" },
    { keys: ["data_referencia"], label: "Data referência" },
  ] as const,
} as const;

export const KPI_SLOTS = [
  { key: "total_a_pagar", label: "Total a pagar", format: "currency" as const },
  { key: "vendas_totais_base", label: "Vendas totais", format: "currency" as const },
  { key: "custo_efetivo", label: "% custo da comissão", format: "percent" as const },
  { key: "qtd_vendedores_pagos", label: "Vendedores pagos", format: "integer" as const },
] as const;

/** Permissão dedicada ao holerite de comissões (impressão / detalhe por linha). Quem só tiver esta chave verá só o que a API filtrar no futuro. */
export const BI_COMISSOES_HOLERITE_PERMISSION = "module.gerencial.comissoes_holerite" as const;

export type KpiSlotDef = (typeof KPI_SLOTS)[number];

/** Colunas da base usadas em `EXISTS` / filtros (valores = nomes SQL na view base). */
export const BI_COMISSOES_BASE_FILTER_COLUMNS = new Set<string>(
  Object.values(BI_COMISSOES_CONFIG.filters),
);

/** `null` = allowlist desligada (`vendedorFinalAllowlist` vazia ou só nomes em branco). */
export function getBiComissoesVendedorAllowlistUpper(): string[] | null {
  const raw = BI_COMISSOES_CONFIG.vendedorFinalAllowlist as readonly string[];
  const up = [...new Set([...raw].map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  return up.length ? up : null;
}
