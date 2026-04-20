CREATE SCHEMA "public";
CREATE SCHEMA "bi";
CREATE TABLE "bd_autorizacao_frete" (
	"id_autorizacao" bigint PRIMARY KEY,
	"data_autorizacao" timestamp,
	"id_remetente" bigint,
	"id_destinatario" bigint,
	"id_consignatario" bigint,
	"id_redespacho" bigint,
	"saida_garagem" timestamp,
	"id_operador" bigint,
	"id_rota" bigint,
	"pagador" integer,
	"id_nf_saidas" bigint,
	"situacao" integer,
	"id_local" bigint,
	"valor_total" numeric,
	"id_coleta" bigint,
	"entrega_carga" timestamp,
	"valor_redespacho" numeric,
	"pedagio" numeric,
	"outros" numeric,
	"desconto" numeric,
	"volumes" numeric,
	"id_tabela_frete" bigint,
	"id_estabelecimento" bigint,
	"tx_coleta" numeric,
	"tx_entrega" numeric,
	"frete_peso" numeric,
	"valor_seccat" numeric,
	"brinde_bonificacao" integer,
	"total_bruto" numeric,
	"frete_peso_fixo" numeric,
	"frete_valor_fixo" numeric,
	"numero_pedido" text
);
CREATE TABLE "bd_cidades" (
	"id_cidade" bigint PRIMARY KEY,
	"nome" text,
	"uf" text
);
CREATE TABLE "bd_clientes" (
	"id_cliente" bigint PRIMARY KEY,
	"nome" text,
	"razao_social" text,
	"endereco" text,
	"id_estabelecimento" bigint,
	"bairro" text,
	"cidade" text,
	"uf" text,
	"cep" text,
	"telefone1" text,
	"cgc" text,
	"inscricao_estadual" text,
	"contato" text,
	"obs" text,
	"id_ramo" bigint,
	"endereco_cob" text,
	"bairro_cob" text,
	"cidade_cob" text,
	"uf_cob" text,
	"cep_cob" text,
	"nome_reduzido" text,
	"end_corr" text,
	"telefone2" text,
	"codigo_contabil" text,
	"endereco_web" text,
	"e_mail" text,
	"situacao" text,
	"data_cadastro" timestamp,
	"registro_sci" text,
	"id_vendedor" bigint,
	"id_tabela_frete" bigint,
	"mensalista" text,
	"id_cidade" bigint,
	"numero" text,
	"complemento" text,
	"tx_coleta" numeric(10, 2),
	"tx_entrega" numeric(10, 2),
	"cli_fretam" text,
	"cli_ctrc" text,
	"cli_fidelidade" text,
	"end_ctrc" text,
	"numero_cob" text,
	"id_cidade_cob" bigint,
	"telefone_cob" text,
	"e_mail_cob" text,
	"contato_cob" text,
	"numero_n" text,
	"codigo_red" text,
	"emite_cteent" text,
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "bd_clientes_tabela_preco" (
	"id_registro" bigint,
	"id_cliente" bigint,
	"id_tabela" bigint,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bd_clientes_tabela_preco_pkey" PRIMARY KEY("id_cliente","id_tabela")
);
CREATE TABLE "bd_estabelecimentos" (
	"id_estabelecimento" bigint PRIMARY KEY,
	"razao_social" text,
	"nome_fantasia" text,
	"cnpj" text,
	"endereco" text,
	"bairro" text,
	"cidade" text,
	"estado" text,
	"cep" text,
	"telefone" text,
	"fax" text,
	"contato" text,
	"obs" text,
	"inscricao_estadual" text,
	"inscricao_municipal" text,
	"codigo_externo" text,
	"comissao" numeric(10, 2),
	"id_empresa" bigint,
	"tipo_diaria" text,
	"diaria" numeric(15, 2),
	"desconto_maximo" numeric(10, 2),
	"aliquota_icms" numeric(10, 2),
	"aliquota_iss" numeric(10, 2),
	"nome_reduzido" text,
	"tipo_estabelecimento" text,
	"permissoes" text,
	"oscustom" text,
	"id_tabela_frete" bigint,
	"os40colunas" text,
	"digita_loc_mco" text,
	"gerarosareadif" text,
	"cnae" text,
	"fech_provisorio" text,
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "bd_tabelas_frete" (
	"id_tabela_frete" bigint PRIMARY KEY,
	"descricao" text,
	"validade" timestamp,
	"fim_validade" timestamp,
	"situacao" text,
	"tipo" text,
	"observacao" text,
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "bd_vendedores" (
	"id_vendedor" bigint PRIMARY KEY,
	"nome" text,
	"cpf" text,
	"identidade" text,
	"comissao" numeric(10, 2),
	"situacao" text,
	"desconto_max" numeric(10, 2),
	"id_operador" bigint,
	"email" text,
	"telefone" text,
	"assinatura" text,
	"caminho_ass" text,
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "tb_analise_360" (
	"match_key" text,
	"cnpj_original" text,
	"faturamento_total" numeric(15, 2),
	"qtd_ctes_pagos" integer,
	"ticket_medio_pagante" numeric(15, 2),
	"volumes_enviados" integer,
	"qtd_ctes_como_remetente" integer,
	"volumes_recebidos" integer,
	"qtd_ctes_como_destinatario" integer,
	"total_movimentos_geral" integer,
	"categoria_cliente" text,
	"flag_potencial_cif" text,
	"status_atividade" text,
	"recencia_dias" integer,
	"filtro_atuou_tomador" text,
	"filtro_atuou_remetente" text,
	"filtro_atuou_destinatario" text,
	"tipo_documento_detectado" text,
	"updated_at" timestamp DEFAULT now(),
	"potencial_estimado" double precision DEFAULT 0,
	"data_referencia" date,
	CONSTRAINT "tb_analise_360_pkey" PRIMARY KEY("match_key","data_referencia")
);
CREATE TABLE "tb_analytics_performance_agencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"agencia" text NOT NULL UNIQUE,
	"mes_referencia" date NOT NULL UNIQUE,
	"qtd_emissoes" integer DEFAULT 0,
	"qtd_recebimentos" integer DEFAULT 0,
	"valor_total_emitido" numeric(15, 2) DEFAULT '0',
	"valor_total_recebido" numeric(15, 2) DEFAULT '0',
	"razao_fluxo" numeric(5, 2),
	"status_fluxo" text,
	"ticket_medio" numeric(15, 2),
	"cluster_perfil" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"score_hub" numeric(5, 2),
	"volume_total" integer,
	CONSTRAINT "unique_agencia_mes" UNIQUE("agencia","mes_referencia")
);
CREATE TABLE "tb_analytics_receitas_extras" (
	"agencia" text,
	"mes_referencia" timestamp,
	"qtd_emissoes" integer,
	"qtd_recebimentos" integer,
	"faturamento_total" numeric,
	"receita_frete_peso" numeric,
	"receita_extras_total" numeric,
	"pct_representatividade_extras" numeric,
	"receita_coleta" numeric,
	"pct_penetracao_coleta" numeric,
	"tm_coleta" numeric,
	"receita_entrega" numeric,
	"pct_penetracao_entrega" numeric,
	"tm_entrega" numeric,
	"receita_outros" numeric,
	"tm_outros" numeric,
	"receita_pedagio" numeric,
	"receita_seccat" numeric,
	"perfil_cobranca" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tb_analytics_receitas_extras_pkey" PRIMARY KEY("agencia","mes_referencia")
);
CREATE TABLE "tb_auditoria_metas" (
	"id" serial PRIMARY KEY,
	"data_cobranca" date NOT NULL,
	"agencia" varchar(100) NOT NULL,
	"perc_projetado" numeric(5, 2),
	"status_auditoria" varchar(50) DEFAULT 'Aguardando Retorno',
	"motivo_queda" varchar(100),
	"resumo_resposta" text,
	"plano_acao" text,
	"data_atualizacao" timestamp DEFAULT CURRENT_TIMESTAMP,
	"prioridade" text DEFAULT 'MEDIA' NOT NULL,
	"responsavel" text,
	"data_retorno_prevista" date,
	"retorno_responsavel" text,
	"conclusao" text,
	"resultado_evolucao" text DEFAULT 'NAO_AVALIADO' NOT NULL,
	"concluido" boolean DEFAULT false NOT NULL,
	"concluido_em" timestamp with time zone
);
CREATE TABLE "tb_auditoria_metas_historico" (
	"id" bigserial PRIMARY KEY,
	"auditoria_id" bigint NOT NULL,
	"acao" text NOT NULL,
	"actor" text,
	"note" text,
	"previous_status" text,
	"next_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "tb_comissoes" (
	"id_registro" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "tb_comissoes_id_registro_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id_unico_nf" text,
	"numero_nf" bigint,
	"serie" bigint,
	"data_emissao" timestamp,
	"tomador_cnpj" text,
	"dono_carteira" text,
	"obs" text,
	"tabela_nome" text,
	"valor_faturado" numeric(15, 2),
	"porcentagem_comissao" numeric(10, 4),
	"valor_comissao" numeric(15, 2),
	"vendedor_final" text,
	"tipo_comissao" text,
	"origem_vendedor" text,
	"motivo_calculo" text,
	"status_auditoria" text,
	"trava_operacional" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	"valor_base_calculo" double precision,
	"delta_auditoria" numeric(15, 2) DEFAULT '0'
);
CREATE TABLE "tb_controle_vencimentos" (
	"id_controle" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "tb_controle_vencimentos_id_controle_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id_tabela" bigint,
	"cnpj_cliente" text,
	"razao_social_cliente" text,
	"nome_tabela" text,
	"validade" date,
	"dono_atual" text,
	"total_comprado" numeric(15, 2),
	"ultima_compra" date,
	"qtd_ctes" integer,
	"total_volumes" integer,
	"media_ticket" numeric(15, 2),
	"dias_vencimento" integer,
	"status_estrategico" text,
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "tb_correcao_vinculo" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "tb_correcao_vinculo_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cot_numero" bigint NOT NULL CONSTRAINT "uq_vinculo_cotacao" UNIQUE,
	"cte_numero" bigint NOT NULL,
	"cte_serie" bigint DEFAULT 1,
	"observacao" text,
	"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE "tb_funil_vendas" (
	"vendedora" text,
	"cot_numero_interno" bigint,
	"cot_id_pesquisa_sistema" bigint,
	"cot_data_criacao" timestamp,
	"cot_valor_sistema" numeric(15, 2),
	"cot_valor_bruto_real" numeric(15, 2),
	"cot_valor_desconto" numeric(15, 2),
	"cot_id_tabela" bigint,
	"status_calibragem" text,
	"cte_numero" bigint,
	"cte_serie" bigint,
	"cte_data_hora_venda" timestamp,
	"cte_valor_faturado" numeric(15, 2),
	"cte_status_sistema" text,
	"tempo_fechamento" text,
	"diferenca_valor" numeric(15, 2),
	"status_funil" text,
	"status_auditoria_valor" text,
	"cliente_remetente" text,
	"cliente_destinatario" text,
	"cliente_consignatario" text,
	"nome_rota" text,
	"quem_paga_frete" text,
	"observacao" text,
	"updated_at" timestamp DEFAULT now(),
	"metodo_vinculo" text,
	"id_unico" text PRIMARY KEY
);
CREATE TABLE "tb_manifestos_operacao" (
	"id_manifesto" bigint PRIMARY KEY,
	"numero_manifesto" varchar(100),
	"data_emissao" timestamp,
	"data_encerramento" timestamp,
	"status_sistema" varchar(50),
	"agencia_origem" varchar(150),
	"agencia_destino" varchar(150),
	"prefixo_veiculo" varchar(50),
	"placa_veiculo" varchar(50),
	"peso_total" numeric(15, 2),
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "tb_metas_agencia" (
	"id" serial PRIMARY KEY,
	"mes_referencia" date UNIQUE,
	"agencia" text UNIQUE,
	"total_vendido_3meses" numeric(15, 2),
	"share_participacao" numeric(5, 4),
	"meta_sugerida" numeric(15, 2),
	"meta_final" numeric(15, 2),
	"updated_at" timestamp DEFAULT now(),
	"total_vendido_ly" numeric(15, 2) DEFAULT '0',
	"venda_mes_1" numeric(15, 2) DEFAULT '0',
	"venda_mes_2" numeric(15, 2) DEFAULT '0',
	"venda_mes_3" numeric(15, 2) DEFAULT '0',
	CONSTRAINT "tb_metas_agencia_mes_referencia_agencia_key" UNIQUE("mes_referencia","agencia")
);
CREATE TABLE "tb_metas_config" (
	"mes_referencia" date PRIMARY KEY,
	"meta_global_alvo" numeric(15, 2),
	"dias_uteis_considerados" integer,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "tb_metas_manuais" (
	"agencia" text PRIMARY KEY,
	"valor_manual" numeric(15, 2) NOT NULL,
	"observacao" text,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "tb_nf_saidas_consolidada" (
	"id_unico" text PRIMARY KEY,
	"emissor" text,
	"numero_nf" bigint,
	"serie" bigint,
	"data_emissao" timestamp,
	"data_baixa" timestamp,
	"origem" text,
	"destino" text,
	"coleta" text,
	"entrega" text,
	"rota" text,
	"id_rota" bigint,
	"prazo_dias_cif" integer,
	"prazo_dias_fob" integer,
	"valor_total" numeric(15, 2),
	"frete_peso" numeric(15, 2),
	"frete_valor" numeric(15, 2),
	"total_icms" numeric(15, 2),
	"valor_redespacho" numeric(15, 2),
	"desconto" numeric(15, 2),
	"peso" numeric(15, 2),
	"volumes" integer,
	"id_estabelecimento" bigint,
	"obs" text,
	"tabela_nome" text,
	"remetente_cnpj" text,
	"destinatario_cnpj" text,
	"tomador_cnpj" text,
	"tipo_frete" text,
	"status_sistema" text,
	"updated_at" timestamp DEFAULT now(),
	"id_cliente" bigint,
	"numero_mfde" bigint,
	"tx_coleta" numeric(15, 2) DEFAULT '0',
	"tx_entrega" numeric(15, 2) DEFAULT '0',
	"taxa_outros" numeric(15, 2) DEFAULT '0',
	"entrega_carga" timestamp,
	"frete_valor_fixo" numeric(15, 2) DEFAULT '0',
	"valor_seccat" numeric(15, 2) DEFAULT '0',
	"valor_pedagio" numeric(15, 2) DEFAULT '0',
	"id_comissaor" bigint,
	"id_comissaod" bigint
);
CREATE TABLE "tb_robo_supremo_runs" (
	"id" bigserial PRIMARY KEY,
	"mode" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"trigger_source" text DEFAULT 'SITE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"exit_code" integer,
	"pid" integer,
	"stdout_log" text,
	"stderr_log" text,
	"created_by" text
);
CREATE TABLE "tb_sla_performance" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "tb_sla_performance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cte" text,
	"serie" text,
	"data_emissao" date,
	"data_baixa" date,
	"dias_fob" integer,
	"prazo_limite" date,
	"status_prazo" text,
	"dias_atraso" integer,
	"valor_frete" numeric,
	"origem" text,
	"destino" text,
	"rota" text,
	"status_foto" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE "bi"."dim_agencias" (
	"agencia_id" bigserial PRIMARY KEY,
	"agencia_nome" text NOT NULL,
	"agencia_nome_normalizada" text NOT NULL CONSTRAINT "dim_agencias_agencia_nome_normalizada_key" UNIQUE,
	"ativa" boolean DEFAULT true NOT NULL,
	"origem" text
);
CREATE TABLE "bi"."dim_calendario" (
	"data" date PRIMARY KEY,
	"ano" integer NOT NULL,
	"mes_num" integer NOT NULL,
	"mes_nome" text NOT NULL,
	"mes_ano" text NOT NULL,
	"dia" integer NOT NULL,
	"dia_semana_num" integer NOT NULL,
	"dia_semana_nome" text NOT NULL,
	"eh_fim_semana" boolean NOT NULL,
	"eh_feriado" boolean DEFAULT false NOT NULL,
	"eh_dia_util" boolean NOT NULL,
	"inicio_semana" date NOT NULL,
	"semana_ano" integer NOT NULL,
	"semana_mes" text NOT NULL,
	"trimestre" integer NOT NULL,
	"semestre" integer NOT NULL,
	"inicio_mes" date NOT NULL,
	"fim_mes" date NOT NULL
);
CREATE TABLE "bi"."dim_feriados" (
	"data" date PRIMARY KEY,
	"descricao" text
);
CREATE TABLE "bi"."meta_campanha_vendedor" (
	"id" bigserial PRIMARY KEY,
	"vendedor" text NOT NULL,
	"meta_mensal" numeric(15, 2) NOT NULL,
	"premio_total" numeric(15, 2) NOT NULL,
	"data_referencia" date NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX "bd_autorizacao_frete_pkey" ON "bd_autorizacao_frete" ("id_autorizacao");
CREATE UNIQUE INDEX "bd_cidades_pkey" ON "bd_cidades" ("id_cidade");
CREATE UNIQUE INDEX "bd_clientes_pkey" ON "bd_clientes" ("id_cliente");
CREATE INDEX "idx_cliente_cgc" ON "bd_clientes" ("cgc");
CREATE UNIQUE INDEX "bd_clientes_tabela_preco_pkey" ON "bd_clientes_tabela_preco" ("id_cliente","id_tabela");
CREATE UNIQUE INDEX "bd_estabelecimentos_pkey" ON "bd_estabelecimentos" ("id_estabelecimento");
CREATE INDEX "idx_estab_cnpj" ON "bd_estabelecimentos" ("cnpj");
CREATE UNIQUE INDEX "bd_tabelas_frete_pkey" ON "bd_tabelas_frete" ("id_tabela_frete");
CREATE UNIQUE INDEX "bd_vendedores_pkey" ON "bd_vendedores" ("id_vendedor");
CREATE UNIQUE INDEX "tb_analise_360_pkey" ON "tb_analise_360" ("match_key","data_referencia");
CREATE INDEX "idx_analytics_agencia_mes" ON "tb_analytics_performance_agencias" ("agencia","mes_referencia");
CREATE UNIQUE INDEX "tb_analytics_performance_agencias_pkey" ON "tb_analytics_performance_agencias" ("id");
CREATE UNIQUE INDEX "unique_agencia_mes" ON "tb_analytics_performance_agencias" ("agencia","mes_referencia");
CREATE UNIQUE INDEX "tb_analytics_receitas_extras_pkey" ON "tb_analytics_receitas_extras" ("agencia","mes_referencia");
CREATE INDEX "idx_tb_auditoria_metas_data" ON "tb_auditoria_metas" ("data_atualizacao");
CREATE INDEX "idx_tb_auditoria_metas_responsavel" ON "tb_auditoria_metas" ("responsavel");
CREATE INDEX "idx_tb_auditoria_metas_status" ON "tb_auditoria_metas" ("status_auditoria");
CREATE UNIQUE INDEX "tb_auditoria_metas_pkey" ON "tb_auditoria_metas" ("id");
CREATE INDEX "idx_tb_auditoria_hist_auditoria" ON "tb_auditoria_metas_historico" ("auditoria_id","created_at");
CREATE UNIQUE INDEX "tb_auditoria_metas_historico_pkey" ON "tb_auditoria_metas_historico" ("id");
CREATE INDEX "idx_comissao_data" ON "tb_comissoes" ("data_emissao");
CREATE INDEX "idx_comissao_vendedor" ON "tb_comissoes" ("vendedor_final");
CREATE UNIQUE INDEX "tb_comissoes_pkey" ON "tb_comissoes" ("id_registro");
CREATE UNIQUE INDEX "tb_controle_vencimentos_pkey" ON "tb_controle_vencimentos" ("id_controle");
CREATE INDEX "idx_correcao_cotacao" ON "tb_correcao_vinculo" ("cot_numero");
CREATE UNIQUE INDEX "tb_correcao_vinculo_pkey" ON "tb_correcao_vinculo" ("id");
CREATE UNIQUE INDEX "uq_vinculo_cotacao" ON "tb_correcao_vinculo" ("cot_numero");
CREATE INDEX "idx_funil_calibragem" ON "tb_funil_vendas" ("status_calibragem");
CREATE INDEX "idx_funil_status" ON "tb_funil_vendas" ("status_funil");
CREATE INDEX "idx_funil_vendedora" ON "tb_funil_vendas" ("vendedora");
CREATE UNIQUE INDEX "tb_funil_vendas_pkey" ON "tb_funil_vendas" ("id_unico");
CREATE UNIQUE INDEX "tb_manifestos_operacao_pkey" ON "tb_manifestos_operacao" ("id_manifesto");
CREATE UNIQUE INDEX "tb_metas_agencia_mes_referencia_agencia_key" ON "tb_metas_agencia" ("mes_referencia","agencia");
CREATE UNIQUE INDEX "tb_metas_agencia_pkey" ON "tb_metas_agencia" ("id");
CREATE UNIQUE INDEX "tb_metas_config_pkey" ON "tb_metas_config" ("mes_referencia");
CREATE UNIQUE INDEX "tb_metas_manuais_pkey" ON "tb_metas_manuais" ("agencia");
CREATE INDEX "idx_data_nf" ON "tb_nf_saidas_consolidada" ("data_emissao");
CREATE UNIQUE INDEX "tb_nf_saidas_consolidada_pkey" ON "tb_nf_saidas_consolidada" ("id_unico");
CREATE INDEX "idx_tb_robo_supremo_runs_started" ON "tb_robo_supremo_runs" ("started_at");
CREATE UNIQUE INDEX "tb_robo_supremo_runs_pkey" ON "tb_robo_supremo_runs" ("id");
CREATE UNIQUE INDEX "tb_sla_performance_pkey" ON "tb_sla_performance" ("id");
CREATE UNIQUE INDEX "dim_agencias_agencia_nome_normalizada_key" ON "bi"."dim_agencias" ("agencia_nome_normalizada");
CREATE UNIQUE INDEX "dim_agencias_pkey" ON "bi"."dim_agencias" ("agencia_id");
CREATE UNIQUE INDEX "dim_calendario_pkey" ON "bi"."dim_calendario" ("data");
CREATE UNIQUE INDEX "dim_feriados_pkey" ON "bi"."dim_feriados" ("data");
CREATE UNIQUE INDEX "meta_campanha_vendedor_pkey" ON "bi"."meta_campanha_vendedor" ("id");
CREATE UNIQUE INDEX "ux_meta_campanha_vendedor_mes" ON "bi"."meta_campanha_vendedor" ("vendedor","data_referencia");
ALTER TABLE "tb_auditoria_metas_historico" ADD CONSTRAINT "tb_auditoria_metas_historico_auditoria_id_fkey" FOREIGN KEY ("auditoria_id") REFERENCES "tb_auditoria_metas"("id") ON DELETE CASCADE;
CREATE VIEW "view_analise_360_bi" TABLESPACE public AS (WITH carteira_unica AS ( SELECT DISTINCT ON ((limpar_cnpj_match(view_carteira_geral.cnpj_cliente))) limpar_cnpj_match(view_carteira_geral.cnpj_cliente) AS match_key, view_carteira_geral.id_tabela, view_carteira_geral.validade FROM view_carteira_geral WHERE view_carteira_geral.cnpj_cliente IS NOT NULL ORDER BY (limpar_cnpj_match(view_carteira_geral.cnpj_cliente)), view_carteira_geral.validade DESC ), clientes_unicos AS ( SELECT DISTINCT ON ((limpar_cnpj_match(bd_clientes.cgc))) limpar_cnpj_match(bd_clientes.cgc) AS match_key, bd_clientes.cgc, bd_clientes.razao_social, bd_clientes.nome AS nome_fantasia, bd_clientes.telefone1, bd_clientes.e_mail, bd_clientes.cidade, bd_clientes.uf, bd_clientes.mensalista FROM bd_clientes ORDER BY (limpar_cnpj_match(bd_clientes.cgc)), bd_clientes.id_cliente DESC ) SELECT COALESCE(c.cgc, t.cnpj_original) AS cnpj_unico, COALESCE(c.razao_social, 'DESCONHECIDO'::text) AS razao_social, COALESCE(c.nome_fantasia, ''::text) AS nome_fantasia, COALESCE(c.telefone1, ''::text) AS telefone, COALESCE(c.e_mail, ''::text) AS email, COALESCE(c.cidade, ''::text) AS cidade_uf, CASE WHEN c.mensalista ~~ '1%'::text THEN 'SIM'::text ELSE 'NAO'::text END AS filtro_mensalista, CASE WHEN vcg.id_tabela IS NOT NULL AND vcg.validade >= CURRENT_DATE THEN 'SIM'::text ELSE 'NAO'::text END AS filtro_tem_contrato, t.match_key, t.data_referencia, t.cnpj_original, t.faturamento_total, t.potencial_estimado, t.qtd_ctes_pagos, t.ticket_medio_pagante, t.volumes_enviados, t.qtd_ctes_como_remetente, t.volumes_recebidos, t.qtd_ctes_como_destinatario, t.total_movimentos_geral, t.categoria_cliente, t.flag_potencial_cif, t.status_atividade, t.recencia_dias, t.filtro_atuou_tomador, t.filtro_atuou_remetente, t.filtro_atuou_destinatario, t.tipo_documento_detectado, t.updated_at, CASE WHEN t.categoria_cliente ~~ '%OURO%'::text THEN 'SIM'::text ELSE 'NAO'::text END AS filtro_eh_ouro FROM tb_analise_360 t LEFT JOIN clientes_unicos c ON t.match_key = c.match_key LEFT JOIN carteira_unica vcg ON t.match_key = vcg.match_key);
CREATE VIEW "view_base_calculo" TABLESPACE public AS (SELECT DISTINCT ON (n.id_unico) n.id_unico, n.numero_nf, n.serie, n.data_emissao, COALESCE(n.valor_total, 0::numeric) AS valor_total, n.obs, n.tabela_nome, n.tomador_cnpj, CASE WHEN n.tabela_nome IS NOT NULL AND n.tabela_nome <> ''::text AND cg_rem.id_cliente IS NOT NULL THEN cg_rem.id_cliente ELSE cg_tom.id_cliente END AS id_cliente, CASE WHEN n.tabela_nome IS NOT NULL AND n.tabela_nome <> ''::text AND cg_rem.razao_social_cliente IS NOT NULL THEN cg_rem.razao_social_cliente ELSE cg_tom.razao_social_cliente END AS razao_social_cliente, CASE WHEN n.tabela_nome IS NOT NULL AND n.tabela_nome <> ''::text AND cg_rem.responsavel_conta IS NOT NULL THEN cg_rem.responsavel_conta ELSE cg_tom.responsavel_conta END AS dono_carteira, n.remetente_cnpj, CASE WHEN n.tabela_nome IS NOT NULL AND n.tabela_nome <> ''::text AND cg_rem.responsavel_conta IS NOT NULL THEN cg_rem.validade ELSE cg_tom.validade END AS data_validade_tabela FROM tb_nf_saidas_consolidada n LEFT JOIN view_carteira_geral cg_tom ON n.id_cliente = cg_tom.id_cliente LEFT JOIN view_carteira_geral cg_rem ON n.remetente_cnpj = cg_rem.cnpj_cliente WHERE n.status_sistema = 'AUTORIZADA'::text AND n.tipo_frete <> 'ANULACAO'::text ORDER BY n.id_unico, cg_tom.validade DESC);
CREATE VIEW "view_bi_tela1_desempenho" TABLESPACE public AS (SELECT id_unico AS id_cte, data_emissao, coleta AS agencia_origem, entrega AS agencia_destino, COALESCE(peso, 0::numeric) AS peso_total, COALESCE(volumes, 0) AS qtd_volumes, COALESCE(tx_coleta, 0::numeric) AS taxa_coleta, COALESCE(tx_entrega, 0::numeric) AS taxa_entrega FROM tb_nf_saidas_consolidada WHERE status_sistema = 'AUTORIZADA'::text);
CREATE VIEW "view_bi_tela2_rotas" TABLESPACE public AS (SELECT id_unico AS id_cte, data_emissao, coleta AS agencia_origem, destino AS cidade_destino, rota, COALESCE(peso, 0::numeric) AS peso_total, CASE WHEN COALESCE(peso, 0::numeric) <= 10::numeric THEN '1. Até 10 kg'::text WHEN COALESCE(peso, 0::numeric) <= 30::numeric THEN '2. 11 a 30 kg'::text WHEN COALESCE(peso, 0::numeric) <= 50::numeric THEN '3. 31 a 50 kg'::text WHEN COALESCE(peso, 0::numeric) <= 100::numeric THEN '4. 51 a 100 kg'::text ELSE '5. Acima de 100 kg'::text END AS faixa_peso, COALESCE(volumes, 0) AS qtd_volumes, COALESCE(valor_total, 0::numeric) AS faturamento_rentabilidade FROM tb_nf_saidas_consolidada WHERE status_sistema = 'AUTORIZADA'::text);
CREATE VIEW "view_bi_tela3_sla" TABLESPACE public AS (SELECT cte, serie, data_emissao, data_baixa, destino AS agencia_destino, rota, status_prazo, dias_atraso, status_foto FROM tb_sla_performance);
CREATE VIEW "view_bi_tela4_manifestos" TABLESPACE public AS (SELECT id_unico AS id_cte, data_emissao::date AS data_emissao, coleta AS agencia_origem, entrega AS agencia_destino, status_sistema, CASE WHEN COALESCE(numero_mfde, 0::bigint) > 0 THEN '1. COM MANIFESTO (OK)'::text ELSE '3. SEM MANIFESTO (FALHA GRAVE)'::text END AS status_manifesto FROM tb_nf_saidas_consolidada WHERE status_sistema = 'AUTORIZADA'::text);
CREATE VIEW "view_bi_tela5_ctes" TABLESPACE public AS (SELECT id_unico AS id_cte, data_emissao::date AS data_operacao, coleta AS agencia_origem, entrega AS agencia_destino, emissor AS nome_colaborador, COALESCE(volumes, 0) AS qtd_volumes FROM tb_nf_saidas_consolidada WHERE status_sistema = 'AUTORIZADA'::text);
CREATE VIEW "view_bi_tela5_manifestos" TABLESPACE public AS (SELECT id_manifesto, data_emissao::date AS data_operacao, agencia_origem, agencia_destino FROM tb_manifestos_operacao);
CREATE VIEW "view_carteira_geral" TABLESPACE public AS (SELECT DISTINCT ON (l.id_cliente) concat('C', l.id_cliente, '_T', l.id_tabela) AS id_unico, l.id_cliente, l.id_tabela, c.cgc AS cnpj_cliente, c.razao_social AS razao_social_cliente, t.descricao AS nome_tabela, t.observacao AS responsavel_conta, t.fim_validade AS validade, jsonb_build_object('cliente', to_jsonb(c.*), 'tabela', to_jsonb(t.*), 'ligacao', to_jsonb(l.*)) AS dados_completos FROM bd_clientes_tabela_preco l LEFT JOIN bd_clientes c ON l.id_cliente = c.id_cliente LEFT JOIN bd_tabelas_frete t ON l.id_tabela = t.id_tabela_frete WHERE t.observacao IS NOT NULL AND (t.fim_validade IS NULL OR t.fim_validade >= (CURRENT_DATE - '2 mons'::interval)) ORDER BY l.id_cliente, t.fim_validade DESC, l.id_tabela DESC);
CREATE VIEW "view_carteira_historica" TABLESPACE public AS (SELECT concat('C', l.id_cliente, '_T', l.id_tabela) AS id_unico, l.id_cliente, l.id_tabela, c.cgc AS cnpj_cliente, c.razao_social AS razao_social_cliente, t.descricao AS nome_tabela, t.observacao AS responsavel_conta, t.fim_validade AS validade FROM bd_clientes_tabela_preco l LEFT JOIN bd_clientes c ON l.id_cliente = c.id_cliente LEFT JOIN bd_tabelas_frete t ON l.id_tabela = t.id_tabela_frete WHERE t.observacao IS NOT NULL);
CREATE VIEW "vw_monitor_campanhas" TABLESPACE public AS (SELECT f.id_unico, f.cot_data_criacao, f.vendedora, f.nome_rota, f.cot_valor_bruto_real AS valor_cotado, f.cte_valor_faturado AS valor_vendido, f.status_funil, t.descricao AS nome_tabela_cotacao, CASE WHEN f.cot_id_tabela = 1148 THEN 'Campanha Promocional (30% OFF)'::text WHEN f.cot_id_tabela = 1068 THEN 'Tabela Padrão'::text ELSE 'Outros'::text END AS tipo_estrategia FROM tb_funil_vendas f LEFT JOIN bd_tabelas_frete t ON f.cot_id_tabela = t.id_tabela_frete WHERE f.cot_data_criacao >= '2026-01-01 00:00:00'::timestamp without time zone AND (f.cot_id_tabela = ANY (ARRAY[1068::bigint, 1148::bigint])));
CREATE VIEW "bi"."vw_calendario_semana_mes_robusta" TABLESPACE bi AS (WITH base AS ( SELECT c.data, c.ano, c.mes_num, c.mes_nome, c.mes_ano, c.dia, c.eh_dia_util, c.inicio_semana, c.inicio_mes, c.fim_mes FROM bi.dim_calendario c ), semanas AS ( SELECT b.data, b.ano, b.mes_num, b.mes_nome, b.mes_ano, b.dia, b.eh_dia_util, b.inicio_semana, b.inicio_mes, b.fim_mes, dense_rank() OVER (PARTITION BY b.ano, b.mes_num ORDER BY b.inicio_semana) AS semana_mes_ordem FROM base b ) SELECT data, ano, mes_num, mes_nome, mes_ano, dia, eh_dia_util, inicio_semana, inicio_mes, fim_mes, date_trunc('month'::text, data::timestamp with time zone)::date AS mes_referencia, semana_mes_ordem, 'Semana '::text || semana_mes_ordem AS semana_mes_label, min(data) OVER (PARTITION BY ano, mes_num, inicio_semana) AS inicio_semana_no_mes, max(data) OVER (PARTITION BY ano, mes_num, inicio_semana) AS fim_semana_no_mes, count(*) FILTER (WHERE eh_dia_util) OVER (PARTITION BY ano, mes_num) AS dias_uteis_mes, count(*) FILTER (WHERE eh_dia_util) OVER (PARTITION BY ano, mes_num, inicio_semana) AS dias_uteis_semana, max(semana_mes_ordem) OVER (PARTITION BY ano, mes_num) AS qtd_semanas_mes FROM semanas s);
CREATE VIEW "bi"."vw_comissoes_base" TABLESPACE bi AS (SELECT c.id_registro, c.id_unico_nf, c.numero_nf, c.serie, c.data_emissao::date AS data_referencia, c.data_emissao, c.tomador_cnpj, c.dono_carteira, c.obs, c.tabela_nome, c.valor_faturado, c.porcentagem_comissao, c.valor_comissao, c.vendedor_final, c.tipo_comissao, c.origem_vendedor, c.motivo_calculo, c.status_auditoria, c.trava_operacional, c.updated_at, c.valor_base_calculo, c.delta_auditoria, dc.ano, dc.mes_num, dc.mes_nome, dc.mes_ano, dc.dia, dc.eh_dia_util, dc.semana_ano, dc.inicio_semana, dc.semana_mes, dc.trimestre, dc.semestre, dc.inicio_mes, dc.fim_mes FROM tb_comissoes c LEFT JOIN bi.dim_calendario dc ON dc.data = c.data_emissao::date);
CREATE VIEW "bi"."vw_comissoes_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, ano, mes_num, mes_nome, mes_ano, semana_ano, semana_mes, vendedor_final, tipo_comissao, dono_carteira, tabela_nome FROM bi.vw_comissoes_base);
CREATE VIEW "bi"."vw_comissoes_kpis" TABLESPACE bi AS (WITH nf AS ( SELECT COALESCE(sum(vw_comissoes_nf_unica.valor_faturado_unico), 0::numeric) AS faturado_nota, COALESCE(sum(vw_comissoes_nf_unica.valor_base_calculo_unico), 0::double precision) AS venda_auditada FROM bi.vw_comissoes_nf_unica ), comissoes AS ( SELECT COALESCE(sum(tb_comissoes.valor_comissao), 0::numeric) AS total_comissoes, count(DISTINCT tb_comissoes.vendedor_final) AS qtd_vendedores_pagos FROM tb_comissoes WHERE tb_comissoes.vendedor_final IS NOT NULL AND TRIM(BOTH FROM tb_comissoes.vendedor_final) <> ''::text ) SELECT c.total_comissoes AS total_a_pagar, nf.faturado_nota AS vendas_totais_base, CASE WHEN nf.faturado_nota = 0::numeric THEN 0::numeric ELSE c.total_comissoes / nf.faturado_nota END AS custo_efetivo, c.qtd_vendedores_pagos, nf.venda_auditada FROM comissoes c CROSS JOIN nf);
CREATE VIEW "bi"."vw_comissoes_nf_unica" TABLESPACE bi AS (SELECT id_unico_nf, max(valor_faturado) AS valor_faturado_unico, max(valor_base_calculo) AS valor_base_calculo_unico FROM tb_comissoes WHERE id_unico_nf IS NOT NULL AND TRIM(BOTH FROM id_unico_nf) <> ''::text GROUP BY id_unico_nf);
CREATE VIEW "bi"."vw_comissoes_ranking" TABLESPACE bi AS (SELECT vendedor_final, tipo_comissao, COALESCE(sum(valor_comissao), 0::numeric) AS valor_comissao, COALESCE(sum(valor_base_calculo), 0::double precision) AS venda_realizada FROM tb_comissoes WHERE vendedor_final IS NOT NULL AND TRIM(BOTH FROM vendedor_final) <> ''::text AND tipo_comissao IS NOT NULL AND TRIM(BOTH FROM tipo_comissao) <> ''::text GROUP BY vendedor_final, tipo_comissao);
CREATE VIEW "bi"."vw_comissoes_tabela" TABLESPACE bi AS (SELECT vendedor_final AS vendedor, COALESCE(sum( CASE WHEN tipo_comissao = 'NEGOCIADOR'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS negociador, COALESCE(sum( CASE WHEN tipo_comissao = 'REDESPACHO'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS redespacho, COALESCE(sum( CASE WHEN tipo_comissao = 'SUPERVISAO'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS supervisao, COALESCE(sum( CASE WHEN tipo_comissao = 'TABELA INTEGRAL'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS tabela_integral, COALESCE(sum( CASE WHEN tipo_comissao = 'TABELA RATEIO'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS tabela_rateio, COALESCE(sum(valor_comissao), 0::numeric) AS total FROM tb_comissoes WHERE vendedor_final IS NOT NULL AND TRIM(BOTH FROM vendedor_final) <> ''::text GROUP BY vendedor_final);
CREATE VIEW "bi"."vw_comissoes_vendedor_tipo" TABLESPACE bi AS (SELECT vendedor_final, tipo_comissao, count(*) AS qtd_registros, count(DISTINCT id_unico_nf) AS qtd_notas, COALESCE(sum(valor_comissao), 0::numeric) AS valor_comissao, COALESCE(sum(valor_base_calculo), 0::double precision) AS valor_base_calculo, COALESCE(sum(valor_faturado), 0::numeric) AS valor_faturado FROM tb_comissoes WHERE vendedor_final IS NOT NULL AND TRIM(BOTH FROM vendedor_final) <> ''::text AND tipo_comissao IS NOT NULL AND TRIM(BOTH FROM tipo_comissao) <> ''::text GROUP BY vendedor_final, tipo_comissao);
CREATE VIEW "bi"."vw_funil_vendas_base" TABLESPACE bi AS (SELECT f.id_unico, f.cot_numero_interno, f.cot_id_pesquisa_sistema, f.cot_data_criacao, f.cot_data_criacao::date AS data_referencia, f.cot_valor_sistema, f.cot_valor_bruto_real, f.cot_valor_desconto, f.cot_id_tabela, f.status_calibragem, f.cte_numero, f.cte_serie, f.cte_data_hora_venda, f.cte_valor_faturado, f.tempo_fechamento, f.diferenca_valor, f.status_funil, f.status_auditoria_valor, f.cliente_remetente, f.cliente_destinatario, f.cliente_consignatario, f.nome_rota, f.quem_paga_frete, f.observacao, f.metodo_vinculo, TRIM(BOTH FROM f.vendedora) AS vendedor, dc.ano, dc.mes_num, dc.mes_nome, dc.mes_ano, dc.dia, dc.eh_dia_util, dc.semana_ano, dc.inicio_semana, dc.semana_mes, dc.trimestre, dc.semestre, dc.inicio_mes, dc.fim_mes, CASE WHEN TRIM(BOTH FROM COALESCE(f.status_funil, ''::text)) = 'EM NEGOCIACAO'::text THEN 'EM NEGOCIACAO'::text WHEN TRIM(BOTH FROM COALESCE(f.status_funil, ''::text)) = 'VENDA FECHADA'::text THEN 'VENDA FECHADA'::text WHEN TRIM(BOTH FROM COALESCE(f.status_funil, ''::text)) = 'PERDIDO (EXPIRADO)'::text THEN 'PERDIDO (EXPIRADO)'::text WHEN TRIM(BOTH FROM COALESCE(f.status_funil, ''::text)) = 'VENDA CANCELADA'::text THEN 'VENDA CANCELADA'::text ELSE 'OUTROS'::text END AS status_funil_padronizado FROM tb_funil_vendas f LEFT JOIN bi.dim_calendario dc ON dc.data = f.cot_data_criacao::date WHERE f.cot_data_criacao IS NOT NULL);
CREATE VIEW "bi"."vw_funil_vendas_conversao_vendedor" TABLESPACE bi AS (SELECT vendedor, count(*) AS qtd_total, count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text) AS qtd_fechadas, CASE WHEN count(*) = 0 THEN 0::numeric ELSE count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text)::numeric / count(*)::numeric END AS conversao FROM bi.vw_funil_vendas_base WHERE vendedor IS NOT NULL AND TRIM(BOTH FROM vendedor) <> ''::text GROUP BY vendedor);
CREATE VIEW "bi"."vw_funil_vendas_drill_vendedor" TABLESPACE bi AS (SELECT vendedor, status_funil_padronizado AS status_funil, count(*) AS qtd_registros, COALESCE(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado, COALESCE(sum(cte_valor_faturado), 0::numeric) AS valor_fechado, min(cot_data_criacao)::date AS primeira_cotacao, max(cot_data_criacao)::date AS ultima_cotacao FROM bi.vw_funil_vendas_base WHERE vendedor IS NOT NULL AND TRIM(BOTH FROM vendedor) <> ''::text GROUP BY vendedor, status_funil_padronizado);
CREATE VIEW "bi"."vw_funil_vendas_evolucao_mensal" TABLESPACE bi AS (SELECT ano, mes_num, mes_nome, mes_ano, count(*) AS qtd_cotacoes, count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text) AS qtd_fechadas, count(*) FILTER (WHERE status_funil_padronizado = 'EM NEGOCIACAO'::text) AS qtd_negociacao, COALESCE(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado, COALESCE(sum(cte_valor_faturado) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text), 0::numeric) AS valor_fechado FROM bi.vw_funil_vendas_base GROUP BY ano, mes_num, mes_nome, mes_ano);
CREATE VIEW "bi"."vw_funil_vendas_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, ano, mes_num, mes_nome, mes_ano, semana_ano, semana_mes, vendedor, status_funil_padronizado AS status_funil, cot_id_tabela FROM bi.vw_funil_vendas_base);
CREATE VIEW "bi"."vw_funil_vendas_funil_status" TABLESPACE bi AS (SELECT CASE status_funil_padronizado WHEN 'EM NEGOCIACAO'::text THEN 1 WHEN 'VENDA FECHADA'::text THEN 2 WHEN 'PERDIDO (EXPIRADO)'::text THEN 3 WHEN 'VENDA CANCELADA'::text THEN 4 ELSE 99 END AS ordem_etapa, status_funil_padronizado AS etapa, count(*) AS qtd_registros, COALESCE(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado, COALESCE(sum(cte_valor_faturado), 0::numeric) AS valor_fechado, CASE WHEN count(*) = 0 THEN 0::numeric ELSE COALESCE(sum(cte_valor_faturado), 0::numeric) / count(*)::numeric END AS ticket_medio_fechado FROM bi.vw_funil_vendas_base GROUP BY status_funil_padronizado);
CREATE VIEW "bi"."vw_funil_vendas_kpis" TABLESPACE bi AS (SELECT count(*) AS qtd_cotacoes_totais, count(*) FILTER (WHERE status_funil_padronizado = 'EM NEGOCIACAO'::text) AS em_negociacao, count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text) AS qtd_vendas_fechadas, count(*) FILTER (WHERE status_funil_padronizado = 'PERDIDO (EXPIRADO)'::text) AS qtd_perdidas, count(*) FILTER (WHERE status_funil_padronizado = 'VENDA CANCELADA'::text) AS qtd_canceladas, CASE WHEN count(*) = 0 THEN 0::numeric ELSE count(*) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text)::numeric / count(*)::numeric END AS conversao_global, COALESCE(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado_total, COALESCE(sum(cte_valor_faturado) FILTER (WHERE status_funil_padronizado = 'VENDA FECHADA'::text), 0::numeric) AS valor_fechado_total FROM bi.vw_funil_vendas_base);
CREATE VIEW "bi"."vw_funil_vendas_quantidade_fechada_vendedor" TABLESPACE bi AS (SELECT vendedor, count(*) AS qtd_fechada FROM bi.vw_funil_vendas_base WHERE status_funil_padronizado = 'VENDA FECHADA'::text AND vendedor IS NOT NULL AND TRIM(BOTH FROM vendedor) <> ''::text GROUP BY vendedor);
CREATE VIEW "bi"."vw_funil_vendas_tabela" TABLESPACE bi AS (SELECT cot_numero_interno AS orcamento, cte_numero AS numero_cte, cot_data_criacao AS data_cotacao, cliente_remetente AS cliente, vendedor, cot_valor_bruto_real AS valor_cotacao, status_funil_padronizado AS status FROM bi.vw_funil_vendas_base);
CREATE VIEW "bi"."vw_funil_vendas_valor_fechado_vendedor" TABLESPACE bi AS (SELECT vendedor, COALESCE(sum(cte_valor_faturado), 0::numeric) AS valor_fechado FROM bi.vw_funil_vendas_base WHERE status_funil_padronizado = 'VENDA FECHADA'::text AND vendedor IS NOT NULL AND TRIM(BOTH FROM vendedor) <> ''::text GROUP BY vendedor);
CREATE VIEW "bi"."vw_funil_vendas_vendedor_status" TABLESPACE bi AS (SELECT vendedor, status_funil_padronizado AS status_funil, count(*) AS qtd_registros, COALESCE(sum(cot_valor_bruto_real), 0::numeric) AS valor_cotado, COALESCE(sum(cte_valor_faturado), 0::numeric) AS valor_fechado FROM bi.vw_funil_vendas_base WHERE vendedor IS NOT NULL AND TRIM(BOTH FROM vendedor) <> ''::text GROUP BY vendedor, status_funil_padronizado);
CREATE VIEW "bi"."vw_metas_performance_agencia_mes" TABLESPACE bi AS (SELECT mes_referencia, TRIM(BOTH FROM agencia) AS agencia, upper(TRIM(BOTH FROM agencia)) AS agencia_normalizada, COALESCE(meta_final, 0::numeric)::numeric(15,2) AS meta_final, COALESCE(meta_sugerida, 0::numeric)::numeric(15,2) AS meta_sugerida, COALESCE(total_vendido_ly, 0::numeric)::numeric(15,2) AS total_vendido_ly, COALESCE(venda_mes_1, 0::numeric)::numeric(15,2) AS venda_mes_1, COALESCE(venda_mes_2, 0::numeric)::numeric(15,2) AS venda_mes_2, COALESCE(venda_mes_3, 0::numeric)::numeric(15,2) AS venda_mes_3 FROM tb_metas_agencia m);
CREATE VIEW "bi"."vw_metas_performance_base" TABLESPACE bi AS (SELECT id_unico, data_emissao, data_emissao::date AS data_referencia, date_trunc('month'::text, data_emissao)::date AS mes_referencia, TRIM(BOTH FROM coleta) AS agencia, upper(TRIM(BOTH FROM coleta)) AS agencia_normalizada, COALESCE(valor_total, 0::numeric)::numeric(15,2) AS valor_total, status_sistema FROM tb_nf_saidas_consolidada n WHERE status_sistema = 'AUTORIZADA'::text AND data_emissao IS NOT NULL AND TRIM(BOTH FROM COALESCE(coleta, ''::text)) <> ''::text);
CREATE VIEW "bi"."vw_metas_performance_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, mes_referencia, agencia, agencia_normalizada FROM bi.vw_metas_performance_base);
CREATE VIEW "bi"."vw_metas_performance_meta_oficial" TABLESPACE bi AS (SELECT mes_referencia, COALESCE(meta_global_alvo, 0::numeric)::numeric(15,2) AS meta_global_alvo FROM tb_metas_config);
CREATE VIEW "bi"."vw_metas_performance_realizado_ly" TABLESPACE bi AS (SELECT agencia_normalizada, COALESCE(sum(valor_total), 0::numeric)::numeric(15,2) AS realizado_ly FROM bi.vw_metas_performance_base GROUP BY agencia_normalizada);
CREATE VIEW "bi"."vw_metas_performance_realizado_periodo" TABLESPACE bi AS (SELECT agencia_normalizada, COALESCE(sum(valor_total), 0::numeric)::numeric(15,2) AS realizado_periodo FROM bi.vw_metas_performance_base GROUP BY agencia_normalizada);
CREATE VIEW "bi"."vw_metas_performance_tabela_base" TABLESPACE bi AS (SELECT mes_referencia, agencia, agencia_normalizada, meta_final, meta_sugerida, total_vendido_ly, venda_mes_1, venda_mes_2, venda_mes_3 FROM bi.vw_metas_performance_agencia_mes a);
CREATE VIEW "bi"."vw_sprint_vendas_base" TABLESPACE bi AS (SELECT v.vendedor, v.id_unico_nf, v.data_referencia, v.mes_referencia, v.valor_venda_auditada, cal.ano, cal.mes_num, cal.mes_nome, cal.mes_ano, cal.semana_mes_ordem, cal.semana_mes_label, cal.inicio_semana_no_mes, cal.fim_semana_no_mes, cal.dias_uteis_mes, cal.dias_uteis_semana, cal.qtd_semanas_mes, m.meta_mensal, m.premio_total FROM bi.vw_sprint_vendas_nf_vendedor v JOIN bi.meta_campanha_vendedor m ON m.vendedor = v.vendedor AND m.data_referencia = v.mes_referencia LEFT JOIN bi.vw_calendario_semana_mes_robusta cal ON cal.data = v.data_referencia);
CREATE VIEW "bi"."vw_sprint_vendas_filters" TABLESPACE bi AS (SELECT DISTINCT mes_referencia, vendedor FROM bi.vw_sprint_vendas_mensal);
CREATE VIEW "bi"."vw_sprint_vendas_grade_semanal" TABLESPACE bi AS (SELECT DISTINCT m.data_referencia AS mes_referencia, m.vendedor, m.meta_mensal, m.premio_total, c.semana_mes_ordem, c.semana_mes_label, c.inicio_semana_no_mes, c.fim_semana_no_mes, c.dias_uteis_mes, c.dias_uteis_semana, c.qtd_semanas_mes FROM bi.meta_campanha_vendedor m JOIN bi.vw_calendario_semana_mes_robusta c ON c.mes_referencia = m.data_referencia);
CREATE VIEW "bi"."vw_sprint_vendas_mensal" TABLESPACE bi AS (WITH vendas_mes AS ( SELECT vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor, count(DISTINCT vw_sprint_vendas_base.id_unico_nf) AS qtd_notas_mes, COALESCE(sum(vw_sprint_vendas_base.valor_venda_auditada), 0::numeric)::numeric(15,2) AS venda_auditada_mes FROM bi.vw_sprint_vendas_base GROUP BY vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor ), premios AS ( SELECT vw_sprint_vendas_semanal.mes_referencia, vw_sprint_vendas_semanal.vendedor, COALESCE(sum(vw_sprint_vendas_semanal.premio_garantido_semana), 0::numeric)::numeric(15,2) AS premios_ja_garantidos FROM bi.vw_sprint_vendas_semanal GROUP BY vw_sprint_vendas_semanal.mes_referencia, vw_sprint_vendas_semanal.vendedor ), grade_mes AS ( SELECT DISTINCT vw_sprint_vendas_grade_semanal.mes_referencia, vw_sprint_vendas_grade_semanal.vendedor, vw_sprint_vendas_grade_semanal.meta_mensal, vw_sprint_vendas_grade_semanal.premio_total, vw_sprint_vendas_grade_semanal.dias_uteis_mes, vw_sprint_vendas_grade_semanal.qtd_semanas_mes FROM bi.vw_sprint_vendas_grade_semanal ) SELECT g.mes_referencia, g.vendedor, g.meta_mensal, g.premio_total, g.dias_uteis_mes, g.qtd_semanas_mes, COALESCE(v.qtd_notas_mes, 0::bigint) AS qtd_notas_mes, COALESCE(v.venda_auditada_mes, 0::numeric)::numeric(15,2) AS venda_auditada_mes, (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric)::numeric(15,2) AS meta_diaria_base, CASE WHEN g.meta_mensal = 0::numeric THEN 0::numeric ELSE COALESCE(v.venda_auditada_mes, 0::numeric) / g.meta_mensal END AS percentual_atingimento, COALESCE(p.premios_ja_garantidos, 0::numeric)::numeric(15,2) AS premios_ja_garantidos FROM grade_mes g LEFT JOIN vendas_mes v ON v.mes_referencia = g.mes_referencia AND v.vendedor = g.vendedor LEFT JOIN premios p ON p.mes_referencia = g.mes_referencia AND p.vendedor = g.vendedor);
CREATE VIEW "bi"."vw_sprint_vendas_nf_vendedor" TABLESPACE bi AS (SELECT TRIM(BOTH FROM vendedor_final) AS vendedor, id_unico_nf, max(data_emissao)::date AS data_referencia, date_trunc('month'::text, max(data_emissao))::date AS mes_referencia, COALESCE(max(valor_base_calculo), 0::double precision)::numeric(15,2) AS valor_venda_auditada FROM tb_comissoes c WHERE TRIM(BOTH FROM COALESCE(vendedor_final, ''::text)) <> ''::text AND TRIM(BOTH FROM COALESCE(id_unico_nf, ''::text)) <> ''::text GROUP BY (TRIM(BOTH FROM vendedor_final)), id_unico_nf);
CREATE VIEW "bi"."vw_sprint_vendas_ranking" TABLESPACE bi AS (SELECT mes_referencia, vendedor, meta_mensal, venda_auditada_mes, percentual_atingimento FROM bi.vw_sprint_vendas_mensal);
CREATE VIEW "bi"."vw_sprint_vendas_semanal" TABLESPACE bi AS (WITH vendas_semana AS ( SELECT vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor, vw_sprint_vendas_base.semana_mes_ordem, count(DISTINCT vw_sprint_vendas_base.id_unico_nf) AS qtd_notas, COALESCE(sum(vw_sprint_vendas_base.valor_venda_auditada), 0::numeric)::numeric(15,2) AS venda_auditada_semana FROM bi.vw_sprint_vendas_base GROUP BY vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor, vw_sprint_vendas_base.semana_mes_ordem ), base AS ( SELECT g.mes_referencia, g.vendedor, g.meta_mensal, g.premio_total, g.semana_mes_ordem, g.semana_mes_label, g.inicio_semana_no_mes, g.fim_semana_no_mes, g.dias_uteis_mes, g.dias_uteis_semana, g.qtd_semanas_mes, COALESCE(v.qtd_notas, 0::bigint) AS qtd_notas, COALESCE(v.venda_auditada_semana, 0::numeric)::numeric(15,2) AS venda_auditada_semana, (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric)::numeric(15,8) AS meta_diaria_base_bruta, (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric * g.dias_uteis_semana::numeric)::numeric(15,8) AS meta_semanal_bruta, (g.premio_total / NULLIF(g.qtd_semanas_mes, 0)::numeric)::numeric(15,8) AS premio_por_semana_bruto FROM bi.vw_sprint_vendas_grade_semanal g LEFT JOIN vendas_semana v ON v.mes_referencia = g.mes_referencia AND v.vendedor = g.vendedor AND v.semana_mes_ordem = g.semana_mes_ordem ), arred AS ( SELECT b.mes_referencia, b.vendedor, b.meta_mensal, b.premio_total, b.semana_mes_ordem, b.semana_mes_label, b.inicio_semana_no_mes, b.fim_semana_no_mes, b.dias_uteis_mes, b.dias_uteis_semana, b.qtd_semanas_mes, b.qtd_notas, b.venda_auditada_semana, b.meta_diaria_base_bruta, b.meta_semanal_bruta, b.premio_por_semana_bruto, round(b.meta_diaria_base_bruta, 2)::numeric(15,2) AS meta_diaria_base, round(b.meta_semanal_bruta, 2)::numeric(15,2) AS meta_semanal_est_pre, round(b.premio_por_semana_bruto, 2)::numeric(15,2) AS premio_por_semana FROM base b ), ajuste AS ( SELECT a.mes_referencia, a.vendedor, a.meta_mensal, a.premio_total, a.semana_mes_ordem, a.semana_mes_label, a.inicio_semana_no_mes, a.fim_semana_no_mes, a.dias_uteis_mes, a.dias_uteis_semana, a.qtd_semanas_mes, a.qtd_notas, a.venda_auditada_semana, a.meta_diaria_base_bruta, a.meta_semanal_bruta, a.premio_por_semana_bruto, a.meta_diaria_base, a.meta_semanal_est_pre, a.premio_por_semana, sum(a.meta_semanal_est_pre) OVER (PARTITION BY a.mes_referencia, a.vendedor)::numeric(15,2) AS soma_meta_semanal_pre, max(a.semana_mes_ordem) OVER (PARTITION BY a.mes_referencia, a.vendedor) AS ultima_semana FROM arred a ) SELECT mes_referencia, vendedor, meta_mensal, premio_total, semana_mes_ordem, semana_mes_label, inicio_semana_no_mes, fim_semana_no_mes, dias_uteis_mes, dias_uteis_semana, qtd_semanas_mes, qtd_notas, venda_auditada_semana, meta_diaria_base, CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END AS meta_semanal_est, premio_por_semana, CASE WHEN venda_auditada_semana >= CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END AND CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END > 0::numeric THEN premio_por_semana ELSE 0::numeric(15,2) END AS premio_garantido_semana, CASE WHEN CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END <= 0::numeric THEN NULL::text WHEN fim_semana_no_mes > CURRENT_DATE AND venda_auditada_semana = 0::numeric THEN NULL::text WHEN venda_auditada_semana >= CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END THEN '🏆'::text ELSE '❌'::text END AS status_semana FROM ajuste j);
CREATE VIEW "bi"."vw_sprint_vendas_tabela" TABLESPACE bi AS (SELECT mes_referencia, vendedor, semana_mes_ordem, semana_mes_label, meta_semanal_est, venda_auditada_semana, CASE WHEN meta_semanal_est = 0::numeric THEN 0::numeric ELSE venda_auditada_semana / meta_semanal_est END AS percentual_meta_semana, status_semana FROM bi.vw_sprint_vendas_semanal);