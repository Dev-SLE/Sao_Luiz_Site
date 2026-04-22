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
	"qtd_cobrada_coleta" integer DEFAULT 0,
	"qtd_cobrada_entrega" integer DEFAULT 0,
	"qtd_cobrada_outros" integer DEFAULT 0,
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
CREATE INDEX "idx_fluxo_agencia_mes" ON "tb_analytics_performance_agencias" ("agencia","mes_referencia");
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
CREATE VIEW "bi"."vw_360_base" TABLESPACE bi AS (SELECT match_key, data_referencia, cnpj_unico, razao_social, nome_fantasia, telefone, email, cidade_uf, filtro_mensalista, filtro_tem_contrato, filtro_eh_ouro, cnpj_original, COALESCE(faturamento_total, 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(potencial_estimado, 0::double precision)::numeric(15,2) AS potencial_estimado, COALESCE(qtd_ctes_pagos, 0) AS qtd_ctes_pagos, COALESCE(ticket_medio_pagante, 0::numeric)::numeric(15,2) AS ticket_medio_pagante, COALESCE(volumes_enviados, 0) AS volumes_enviados, COALESCE(qtd_ctes_como_remetente, 0) AS qtd_ctes_como_remetente, COALESCE(volumes_recebidos, 0) AS volumes_recebidos, COALESCE(qtd_ctes_como_destinatario, 0) AS qtd_ctes_como_destinatario, COALESCE(total_movimentos_geral, 0) AS total_movimentos_geral, TRIM(BOTH FROM categoria_cliente) AS categoria_cliente, TRIM(BOTH FROM flag_potencial_cif) AS flag_potencial_cif, TRIM(BOTH FROM status_atividade) AS status_atividade, COALESCE(recencia_dias, 0) AS recencia_dias, TRIM(BOTH FROM filtro_atuou_tomador) AS filtro_atuou_tomador, TRIM(BOTH FROM filtro_atuou_remetente) AS filtro_atuou_remetente, TRIM(BOTH FROM filtro_atuou_destinatario) AS filtro_atuou_destinatario, TRIM(BOTH FROM tipo_documento_detectado) AS tipo_documento_detectado, COALESCE(faturamento_total, 0::numeric)::numeric(15,2) AS faturamento_real, (COALESCE(potencial_estimado, 0::double precision) - COALESCE(faturamento_total, 0::numeric)::double precision)::numeric(15,2) AS gap_estimado, CASE WHEN status_atividade = '[EM QUEDA]'::text THEN 1 WHEN status_atividade = '[RISCO CHURN]'::text THEN 2 WHEN status_atividade = '[INATIVO]'::text THEN 3 WHEN status_atividade = '[ATIVO]'::text THEN 4 ELSE 99 END AS prioridade_status, CASE WHEN COALESCE(potencial_estimado, 0::double precision) > COALESCE(faturamento_total, 0::numeric)::double precision THEN (COALESCE(potencial_estimado, 0::double precision) - COALESCE(faturamento_total, 0::numeric)::double precision)::numeric(15,2) ELSE 0::numeric(15,2) END AS oportunidade_aberta, CASE WHEN status_atividade = ANY (ARRAY['[EM QUEDA]'::text, '[RISCO CHURN]'::text]) THEN COALESCE(faturamento_total, 0::numeric)::numeric(15,2) ELSE 0::numeric(15,2) END AS dinheiro_em_risco, CASE WHEN flag_potencial_cif = 'SIM'::text THEN COALESCE(potencial_estimado, 0::double precision)::numeric(15,2) ELSE 0::numeric(15,2) END AS potencial_cif_valor FROM view_analise_360_bi v);
CREATE VIEW "bi"."vw_360_categoria_resumo" TABLESPACE bi AS (SELECT categoria_cliente, count(DISTINCT match_key) AS qtd_clientes, COALESCE(sum(faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real, COALESCE(sum(potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado, COALESCE(sum(gap_estimado), 0::numeric)::numeric(15,2) AS gap_estimado, COALESCE(sum(total_movimentos_geral), 0::bigint) AS total_movimentos_geral, COALESCE(avg(ticket_medio_pagante), 0::numeric)::numeric(15,2) AS ticket_medio_alvo FROM bi.vw_360_base GROUP BY categoria_cliente);
CREATE VIEW "bi"."vw_360_contrato_resumo" TABLESPACE bi AS (SELECT filtro_tem_contrato, count(DISTINCT match_key) AS qtd_clientes, COALESCE(sum(faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real, COALESCE(sum(potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado FROM bi.vw_360_base GROUP BY filtro_tem_contrato);
CREATE VIEW "bi"."vw_360_documento_resumo" TABLESPACE bi AS (SELECT tipo_documento_detectado, count(DISTINCT match_key) AS qtd_clientes, COALESCE(sum(faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real, COALESCE(sum(potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado, COALESCE(avg(ticket_medio_pagante), 0::numeric)::numeric(15,2) AS ticket_medio_alvo FROM bi.vw_360_base GROUP BY tipo_documento_detectado);
CREATE VIEW "bi"."vw_360_drill_cliente" TABLESPACE bi AS (SELECT match_key, data_referencia, razao_social, nome_fantasia, telefone, email, cidade_uf, filtro_mensalista, filtro_tem_contrato, filtro_eh_ouro, cnpj_unico, tipo_documento_detectado, status_atividade, categoria_cliente, flag_potencial_cif, recencia_dias, faturamento_real, potencial_estimado, gap_estimado, dinheiro_em_risco, ticket_medio_pagante, qtd_ctes_pagos, volumes_enviados, qtd_ctes_como_remetente, volumes_recebidos, qtd_ctes_como_destinatario, total_movimentos_geral, filtro_atuou_tomador, filtro_atuou_remetente, filtro_atuou_destinatario FROM bi.vw_360_base);
CREATE VIEW "bi"."vw_360_evolucao_mensal" TABLESPACE bi AS (SELECT data_referencia, EXTRACT(year FROM data_referencia)::integer AS ano, EXTRACT(month FROM data_referencia)::integer AS mes_num, to_char(data_referencia::timestamp with time zone, 'TMMonth'::text) AS mes_nome, COALESCE(sum(faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real, COALESCE(sum(potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado, COALESCE(sum(gap_estimado), 0::numeric)::numeric(15,2) AS gap_estimado, count(DISTINCT match_key) AS qtd_clientes FROM bi.vw_360_base GROUP BY data_referencia ORDER BY data_referencia);
CREATE VIEW "bi"."vw_360_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, filtro_mensalista, filtro_tem_contrato, cidade_uf, status_atividade, filtro_atuou_tomador, filtro_atuou_remetente, filtro_atuou_destinatario, tipo_documento_detectado, categoria_cliente FROM bi.vw_360_base);
CREATE VIEW "bi"."vw_360_kpis" TABLESPACE bi AS (SELECT COALESCE(sum(faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real, COALESCE(sum(potencial_estimado), 0::numeric)::numeric(15,2) AS potencial_estimado, COALESCE(sum(gap_estimado), 0::numeric)::numeric(15,2) AS gap_na_mesa, count(DISTINCT match_key) AS alvos_na_tela, count(DISTINCT match_key) FILTER (WHERE status_atividade = '[EM QUEDA]'::text) AS clientes_em_queda, count(DISTINCT match_key) FILTER (WHERE status_atividade = '[RISCO CHURN]'::text) AS risco_churn, COALESCE(sum(dinheiro_em_risco), 0::numeric)::numeric(15,2) AS dinheiro_em_risco, COALESCE(avg(ticket_medio_pagante), 0::numeric)::numeric(15,2) AS ticket_medio_alvo, CASE WHEN COALESCE(sum(faturamento_real), 0::numeric) = 0::numeric THEN 0::numeric ELSE sum(faturamento_real) FILTER (WHERE filtro_tem_contrato = 'SIM'::text) / sum(faturamento_real) END AS receita_em_contratos_percentual FROM bi.vw_360_base);
CREATE VIEW "bi"."vw_360_oportunidades" TABLESPACE bi AS (SELECT match_key, data_referencia, razao_social, nome_fantasia, telefone, email, cidade_uf, categoria_cliente, status_atividade, filtro_tem_contrato, filtro_mensalista, filtro_eh_ouro, flag_potencial_cif, tipo_documento_detectado, recencia_dias, faturamento_real, potencial_estimado, gap_estimado, dinheiro_em_risco, ticket_medio_pagante, total_movimentos_geral, oportunidade_aberta, CASE WHEN status_atividade = '[EM QUEDA]'::text THEN 'Recuperar agora'::text WHEN status_atividade = '[RISCO CHURN]'::text THEN 'Contato preventivo'::text WHEN flag_potencial_cif = 'SIM'::text THEN 'Atacar CIF'::text WHEN filtro_tem_contrato = 'NAO'::text AND faturamento_real > 0::numeric THEN 'Propor contrato'::text WHEN status_atividade = '[INATIVO]'::text AND potencial_estimado > 0::numeric THEN 'Reativar cliente'::text ELSE 'Acompanhar'::text END AS proxima_acao, ( CASE WHEN status_atividade = '[EM QUEDA]'::text THEN 100 WHEN status_atividade = '[RISCO CHURN]'::text THEN 90 WHEN flag_potencial_cif = 'SIM'::text THEN 80 WHEN filtro_tem_contrato = 'NAO'::text AND faturamento_real > 0::numeric THEN 70 WHEN status_atividade = '[INATIVO]'::text THEN 60 ELSE 20 END::numeric + LEAST(COALESCE(gap_estimado, 0::numeric) / 10000::numeric, 40::numeric) + LEAST(COALESCE(faturamento_real, 0::numeric) / 10000::numeric, 30::numeric))::numeric(10,2) AS score_oportunidade FROM bi.vw_360_base);
CREATE VIEW "bi"."vw_360_status_resumo" TABLESPACE bi AS (SELECT status_atividade, count(DISTINCT match_key) AS qtd_clientes, COALESCE(sum(faturamento_real), 0::numeric)::numeric(15,2) AS faturamento_real, COALESCE(sum(dinheiro_em_risco), 0::numeric)::numeric(15,2) AS dinheiro_em_risco, COALESCE(sum(gap_estimado), 0::numeric)::numeric(15,2) AS gap_estimado FROM bi.vw_360_base GROUP BY status_atividade);
CREATE VIEW "bi"."vw_360_tabela" TABLESPACE bi AS (SELECT prioridade_status, razao_social, nome_fantasia, cidade_uf, status_atividade, categoria_cliente, filtro_tem_contrato, filtro_mensalista, tipo_documento_detectado, faturamento_real, potencial_estimado, gap_estimado, dinheiro_em_risco, ticket_medio_pagante, total_movimentos_geral, recencia_dias FROM bi.vw_360_base);
CREATE VIEW "bi"."vw_calendario_semana_mes_robusta" TABLESPACE bi AS (WITH base AS ( SELECT c.data, c.ano, c.mes_num, c.mes_nome, c.mes_ano, c.dia, c.eh_dia_util, c.inicio_semana, c.inicio_mes, c.fim_mes FROM bi.dim_calendario c ), semanas AS ( SELECT b.data, b.ano, b.mes_num, b.mes_nome, b.mes_ano, b.dia, b.eh_dia_util, b.inicio_semana, b.inicio_mes, b.fim_mes, dense_rank() OVER (PARTITION BY b.ano, b.mes_num ORDER BY b.inicio_semana) AS semana_mes_ordem FROM base b ) SELECT data, ano, mes_num, mes_nome, mes_ano, dia, eh_dia_util, inicio_semana, inicio_mes, fim_mes, date_trunc('month'::text, data::timestamp with time zone)::date AS mes_referencia, semana_mes_ordem, 'Semana '::text || semana_mes_ordem AS semana_mes_label, min(data) OVER (PARTITION BY ano, mes_num, inicio_semana) AS inicio_semana_no_mes, max(data) OVER (PARTITION BY ano, mes_num, inicio_semana) AS fim_semana_no_mes, count(*) FILTER (WHERE eh_dia_util) OVER (PARTITION BY ano, mes_num) AS dias_uteis_mes, count(*) FILTER (WHERE eh_dia_util) OVER (PARTITION BY ano, mes_num, inicio_semana) AS dias_uteis_semana, max(semana_mes_ordem) OVER (PARTITION BY ano, mes_num) AS qtd_semanas_mes FROM semanas s);
CREATE VIEW "bi"."vw_comissoes_base" TABLESPACE bi AS (SELECT c.id_registro, c.id_unico_nf, c.numero_nf, c.serie, c.data_emissao::date AS data_referencia, c.data_emissao, c.tomador_cnpj, c.dono_carteira, c.obs, c.tabela_nome, c.valor_faturado, c.porcentagem_comissao, c.valor_comissao, c.vendedor_final, c.tipo_comissao, c.origem_vendedor, c.motivo_calculo, c.status_auditoria, c.trava_operacional, c.updated_at, c.valor_base_calculo, c.delta_auditoria, dc.ano, dc.mes_num, dc.mes_nome, dc.mes_ano, dc.dia, dc.eh_dia_util, dc.semana_ano, dc.inicio_semana, dc.semana_mes, dc.trimestre, dc.semestre, dc.inicio_mes, dc.fim_mes FROM tb_comissoes c LEFT JOIN bi.dim_calendario dc ON dc.data = c.data_emissao::date);
CREATE VIEW "bi"."vw_comissoes_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, ano, mes_num, mes_nome, mes_ano, semana_ano, semana_mes, vendedor_final, tipo_comissao, dono_carteira, tabela_nome FROM bi.vw_comissoes_base);
CREATE VIEW "bi"."vw_comissoes_kpis" TABLESPACE bi AS (WITH nf AS ( SELECT COALESCE(sum(vw_comissoes_nf_unica.valor_faturado_unico), 0::numeric) AS faturado_nota, COALESCE(sum(vw_comissoes_nf_unica.valor_base_calculo_unico), 0::double precision) AS venda_auditada FROM bi.vw_comissoes_nf_unica ), comissoes AS ( SELECT COALESCE(sum(tb_comissoes.valor_comissao), 0::numeric) AS total_comissoes, count(DISTINCT tb_comissoes.vendedor_final) AS qtd_vendedores_pagos FROM tb_comissoes WHERE tb_comissoes.vendedor_final IS NOT NULL AND TRIM(BOTH FROM tb_comissoes.vendedor_final) <> ''::text ) SELECT c.total_comissoes AS total_a_pagar, nf.faturado_nota AS vendas_totais_base, CASE WHEN nf.faturado_nota = 0::numeric THEN 0::numeric ELSE c.total_comissoes / nf.faturado_nota END AS custo_efetivo, c.qtd_vendedores_pagos, nf.venda_auditada FROM comissoes c CROSS JOIN nf);
CREATE VIEW "bi"."vw_comissoes_nf_unica" TABLESPACE bi AS (SELECT id_unico_nf, max(valor_faturado) AS valor_faturado_unico, max(valor_base_calculo) AS valor_base_calculo_unico FROM tb_comissoes WHERE id_unico_nf IS NOT NULL AND TRIM(BOTH FROM id_unico_nf) <> ''::text GROUP BY id_unico_nf);
CREATE VIEW "bi"."vw_comissoes_ranking" TABLESPACE bi AS (SELECT vendedor_final, tipo_comissao, COALESCE(sum(valor_comissao), 0::numeric) AS valor_comissao, COALESCE(sum(valor_base_calculo), 0::double precision) AS venda_realizada FROM tb_comissoes WHERE vendedor_final IS NOT NULL AND TRIM(BOTH FROM vendedor_final) <> ''::text AND tipo_comissao IS NOT NULL AND TRIM(BOTH FROM tipo_comissao) <> ''::text GROUP BY vendedor_final, tipo_comissao);
CREATE VIEW "bi"."vw_comissoes_tabela" TABLESPACE bi AS (SELECT vendedor_final AS vendedor, COALESCE(sum( CASE WHEN tipo_comissao = 'NEGOCIADOR'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS negociador, COALESCE(sum( CASE WHEN tipo_comissao = 'REDESPACHO'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS redespacho, COALESCE(sum( CASE WHEN tipo_comissao = 'SUPERVISAO'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS supervisao, COALESCE(sum( CASE WHEN tipo_comissao = 'TABELA INTEGRAL'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS tabela_integral, COALESCE(sum( CASE WHEN tipo_comissao = 'TABELA RATEIO'::text THEN valor_comissao ELSE 0::numeric END), 0::numeric) AS tabela_rateio, COALESCE(sum(valor_comissao), 0::numeric) AS total FROM tb_comissoes WHERE vendedor_final IS NOT NULL AND TRIM(BOTH FROM vendedor_final) <> ''::text GROUP BY vendedor_final);
CREATE VIEW "bi"."vw_comissoes_vendedor_tipo" TABLESPACE bi AS (SELECT vendedor_final, tipo_comissao, count(*) AS qtd_registros, count(DISTINCT id_unico_nf) AS qtd_notas, COALESCE(sum(valor_comissao), 0::numeric) AS valor_comissao, COALESCE(sum(valor_base_calculo), 0::double precision) AS valor_base_calculo, COALESCE(sum(valor_faturado), 0::numeric) AS valor_faturado FROM tb_comissoes WHERE vendedor_final IS NOT NULL AND TRIM(BOTH FROM vendedor_final) <> ''::text AND tipo_comissao IS NOT NULL AND TRIM(BOTH FROM tipo_comissao) <> ''::text GROUP BY vendedor_final, tipo_comissao);
CREATE VIEW "bi"."vw_desempenho_agencias_base" TABLESPACE bi AS (SELECT id_unico AS id_cte, data_emissao::date AS data_referencia, date_trunc('month'::text, data_emissao)::date AS mes_referencia, EXTRACT(year FROM data_emissao)::integer AS ano, EXTRACT(month FROM data_emissao)::integer AS mes_num, TRIM(BOTH FROM to_char(data_emissao, 'TMMonth'::text)) AS mes_nome, TRIM(BOTH FROM coleta) AS agencia_origem, upper(TRIM(BOTH FROM coleta)) AS agencia_origem_normalizada, TRIM(BOTH FROM entrega) AS agencia_destino, upper(TRIM(BOTH FROM entrega)) AS agencia_destino_normalizada, TRIM(BOTH FROM origem) AS cidade_origem, TRIM(BOTH FROM destino) AS cidade_destino, TRIM(BOTH FROM rota) AS rota, COALESCE(valor_total, 0::numeric)::numeric(15,2) AS valor_total, COALESCE(frete_peso, 0::numeric)::numeric(15,2) AS frete_peso, COALESCE(frete_valor, 0::numeric)::numeric(15,2) AS frete_valor, COALESCE(valor_redespacho, 0::numeric)::numeric(15,2) AS valor_redespacho, COALESCE(desconto, 0::numeric)::numeric(15,2) AS desconto, COALESCE(peso, 0::numeric)::numeric(15,2) AS peso_total, COALESCE(volumes, 0) AS qtd_volumes, COALESCE(tx_coleta, 0::numeric)::numeric(15,2) AS taxa_coleta, COALESCE(tx_entrega, 0::numeric)::numeric(15,2) AS taxa_entrega, COALESCE(taxa_outros, 0::numeric)::numeric(15,2) AS taxa_outros, COALESCE(valor_seccat, 0::numeric)::numeric(15,2) AS valor_seccat, COALESCE(valor_pedagio, 0::numeric)::numeric(15,2) AS valor_pedagio, numero_mfde, TRIM(BOTH FROM tipo_frete) AS tipo_frete, TRIM(BOTH FROM status_sistema) AS status_sistema, CASE WHEN COALESCE(tx_coleta, 0::numeric) > 0::numeric THEN 1 ELSE 0 END AS flag_coleta, CASE WHEN COALESCE(tx_entrega, 0::numeric) > 0::numeric THEN 1 ELSE 0 END AS flag_entrega, CASE WHEN COALESCE(numero_mfde, 0::bigint) > 0 THEN 1 ELSE 0 END AS flag_manifesto FROM tb_nf_saidas_consolidada n WHERE status_sistema = 'AUTORIZADA'::text AND data_emissao IS NOT NULL AND TRIM(BOTH FROM COALESCE(coleta, ''::text)) <> ''::text);
CREATE VIEW "bi"."vw_desempenho_agencias_destino" TABLESPACE bi AS (SELECT agencia_destino AS agencia, mes_referencia, count(DISTINCT id_cte) AS total_ctes_recebidos, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_recebidos, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_recebido, COALESCE(sum(valor_total), 0::numeric)::numeric(15,2) AS faturamento_recebido FROM bi.vw_desempenho_agencias_base GROUP BY agencia_destino, mes_referencia);
CREATE VIEW "bi"."vw_desempenho_agencias_drill" TABLESPACE bi AS (SELECT agencia, mes_referencia, total_ctes_origem, total_ctes_destino, total_volumes_origem, total_volumes_destino, peso_total_origem, peso_total_destino, faturamento_origem, faturamento_destino, qtd_coletas, qtd_entregas, qtd_manifestos, saldo_ctes, saldo_volumes, volumes_por_cte, peso_por_cte, ticket_por_cte FROM bi.vw_desempenho_agencias_matriz);
CREATE VIEW "bi"."vw_desempenho_agencias_evolucao_mensal" TABLESPACE bi AS (SELECT mes_referencia, ano, mes_num, mes_nome, count(DISTINCT id_cte) AS total_ctes, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total, COALESCE(sum(valor_total), 0::numeric)::numeric(15,2) AS faturamento_total, count(DISTINCT id_cte) FILTER (WHERE flag_coleta = 1) AS qtd_coletas, count(DISTINCT id_cte) FILTER (WHERE flag_entrega = 1) AS qtd_entregas FROM bi.vw_desempenho_agencias_base GROUP BY mes_referencia, ano, mes_num, mes_nome ORDER BY mes_referencia);
CREATE VIEW "bi"."vw_desempenho_agencias_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, agencia_origem, agencia_destino, rota, tipo_frete FROM bi.vw_desempenho_agencias_base);
CREATE VIEW "bi"."vw_desempenho_agencias_kpis" TABLESPACE bi AS (SELECT count(DISTINCT id_cte) AS total_ctes, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes, count(DISTINCT id_cte) FILTER (WHERE flag_coleta = 1) AS qtd_coletas, count(DISTINCT id_cte) FILTER (WHERE flag_entrega = 1) AS qtd_entregas, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_transportado, COALESCE(sum(valor_total), 0::numeric)::numeric(15,2) AS faturamento_total, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(qtd_volumes)::numeric / count(DISTINCT id_cte)::numeric END AS volumes_por_cte, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(peso_total) / count(DISTINCT id_cte)::numeric END AS peso_por_cte, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(valor_total) / count(DISTINCT id_cte)::numeric END AS ticket_por_cte, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE count(DISTINCT id_cte) FILTER (WHERE flag_coleta = 1)::numeric / count(DISTINCT id_cte)::numeric END AS perc_ctes_com_coleta, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE count(DISTINCT id_cte) FILTER (WHERE flag_entrega = 1)::numeric / count(DISTINCT id_cte)::numeric END AS perc_ctes_com_entrega, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE count(DISTINCT id_cte) FILTER (WHERE flag_manifesto = 1)::numeric / count(DISTINCT id_cte)::numeric END AS perc_ctes_com_manifesto FROM bi.vw_desempenho_agencias_base);
CREATE VIEW "bi"."vw_desempenho_agencias_matriz" TABLESPACE bi AS (WITH origem AS ( SELECT vw_desempenho_agencias_base.agencia_origem AS agencia, vw_desempenho_agencias_base.mes_referencia, count(DISTINCT vw_desempenho_agencias_base.id_cte) AS total_ctes_origem, COALESCE(sum(vw_desempenho_agencias_base.qtd_volumes), 0::bigint) AS total_volumes_origem, COALESCE(sum(vw_desempenho_agencias_base.peso_total), 0::numeric)::numeric(15,2) AS peso_total_origem, COALESCE(sum(vw_desempenho_agencias_base.valor_total), 0::numeric)::numeric(15,2) AS faturamento_origem, count(DISTINCT vw_desempenho_agencias_base.id_cte) FILTER (WHERE vw_desempenho_agencias_base.flag_coleta = 1) AS qtd_coletas, count(DISTINCT vw_desempenho_agencias_base.id_cte) FILTER (WHERE vw_desempenho_agencias_base.flag_manifesto = 1) AS qtd_manifestos FROM bi.vw_desempenho_agencias_base GROUP BY vw_desempenho_agencias_base.agencia_origem, vw_desempenho_agencias_base.mes_referencia ), destino AS ( SELECT vw_desempenho_agencias_base.agencia_destino AS agencia, vw_desempenho_agencias_base.mes_referencia, count(DISTINCT vw_desempenho_agencias_base.id_cte) AS total_ctes_destino, COALESCE(sum(vw_desempenho_agencias_base.qtd_volumes), 0::bigint) AS total_volumes_destino, COALESCE(sum(vw_desempenho_agencias_base.peso_total), 0::numeric)::numeric(15,2) AS peso_total_destino, COALESCE(sum(vw_desempenho_agencias_base.valor_total), 0::numeric)::numeric(15,2) AS faturamento_destino, count(DISTINCT vw_desempenho_agencias_base.id_cte) FILTER (WHERE vw_desempenho_agencias_base.flag_entrega = 1) AS qtd_entregas FROM bi.vw_desempenho_agencias_base GROUP BY vw_desempenho_agencias_base.agencia_destino, vw_desempenho_agencias_base.mes_referencia ) SELECT COALESCE(o.agencia, d.agencia) AS agencia, COALESCE(o.mes_referencia, d.mes_referencia) AS mes_referencia, COALESCE(o.total_ctes_origem, 0::bigint) AS total_ctes_origem, COALESCE(d.total_ctes_destino, 0::bigint) AS total_ctes_destino, COALESCE(o.total_volumes_origem, 0::bigint) AS total_volumes_origem, COALESCE(d.total_volumes_destino, 0::bigint) AS total_volumes_destino, COALESCE(o.peso_total_origem, 0::numeric)::numeric(15,2) AS peso_total_origem, COALESCE(d.peso_total_destino, 0::numeric)::numeric(15,2) AS peso_total_destino, COALESCE(o.faturamento_origem, 0::numeric)::numeric(15,2) AS faturamento_origem, COALESCE(d.faturamento_destino, 0::numeric)::numeric(15,2) AS faturamento_destino, COALESCE(o.qtd_coletas, 0::bigint) AS qtd_coletas, COALESCE(d.qtd_entregas, 0::bigint) AS qtd_entregas, COALESCE(o.qtd_manifestos, 0::bigint) AS qtd_manifestos, COALESCE(o.total_ctes_origem, 0::bigint) - COALESCE(d.total_ctes_destino, 0::bigint) AS saldo_ctes, COALESCE(o.total_volumes_origem, 0::bigint) - COALESCE(d.total_volumes_destino, 0::bigint) AS saldo_volumes, CASE WHEN COALESCE(o.total_ctes_origem, 0::bigint) = 0 THEN 0::numeric ELSE COALESCE(o.total_volumes_origem, 0::bigint)::numeric / o.total_ctes_origem::numeric END AS volumes_por_cte, CASE WHEN COALESCE(o.total_ctes_origem, 0::bigint) = 0 THEN 0::numeric ELSE COALESCE(o.peso_total_origem, 0::numeric) / o.total_ctes_origem::numeric END AS peso_por_cte, CASE WHEN COALESCE(o.total_ctes_origem, 0::bigint) = 0 THEN 0::numeric ELSE COALESCE(o.faturamento_origem, 0::numeric) / o.total_ctes_origem::numeric END AS ticket_por_cte FROM origem o FULL JOIN destino d ON o.agencia = d.agencia AND o.mes_referencia = d.mes_referencia);
CREATE VIEW "bi"."vw_desempenho_agencias_origem" TABLESPACE bi AS (SELECT agencia_origem AS agencia, mes_referencia, count(DISTINCT id_cte) AS total_ctes, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total, COALESCE(sum(valor_total), 0::numeric)::numeric(15,2) AS faturamento_total, count(DISTINCT id_cte) FILTER (WHERE flag_coleta = 1) AS qtd_coletas, count(DISTINCT id_cte) FILTER (WHERE flag_entrega = 1) AS qtd_entregas, count(DISTINCT id_cte) FILTER (WHERE flag_manifesto = 1) AS qtd_manifestos, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(qtd_volumes)::numeric / count(DISTINCT id_cte)::numeric END AS volumes_por_cte, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(peso_total) / count(DISTINCT id_cte)::numeric END AS peso_por_cte, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(valor_total) / count(DISTINCT id_cte)::numeric END AS ticket_por_cte FROM bi.vw_desempenho_agencias_base GROUP BY agencia_origem, mes_referencia);
CREATE VIEW "bi"."vw_desempenho_agencias_ranking" TABLESPACE bi AS (SELECT agencia, mes_referencia, total_ctes_origem, total_ctes_destino, total_volumes_origem, total_volumes_destino, peso_total_origem, peso_total_destino, faturamento_origem, faturamento_destino, qtd_coletas, qtd_entregas, qtd_manifestos, saldo_ctes, saldo_volumes, volumes_por_cte, peso_por_cte, ticket_por_cte FROM bi.vw_desempenho_agencias_matriz);
CREATE VIEW "bi"."vw_fluxo_agencia_resumo" TABLESPACE bi AS (SELECT agencia, mes_referencia, qtd_emissoes, qtd_recebimentos, volume_total, ticket_medio, razao_fluxo, status_fluxo, cluster_perfil, score_hub, valor_total_emitido, valor_total_recebido, qtd_recebimentos - qtd_emissoes AS saldo_fluxo_qtd, (valor_total_recebido - valor_total_emitido)::numeric(15,2) AS saldo_fluxo_valor FROM bi.vw_fluxo_base);
CREATE VIEW "bi"."vw_fluxo_base" TABLESPACE bi AS (SELECT id, TRIM(BOTH FROM agencia) AS agencia, upper(TRIM(BOTH FROM agencia)) AS agencia_normalizada, mes_referencia, COALESCE(qtd_emissoes, 0) AS qtd_emissoes, COALESCE(qtd_recebimentos, 0) AS qtd_recebimentos, COALESCE(valor_total_emitido, 0::numeric)::numeric(15,2) AS valor_total_emitido, COALESCE(valor_total_recebido, 0::numeric)::numeric(15,2) AS valor_total_recebido, COALESCE(razao_fluxo, 0::numeric)::numeric(10,4) AS razao_fluxo, TRIM(BOTH FROM status_fluxo) AS status_fluxo, COALESCE(ticket_medio, 0::numeric)::numeric(15,2) AS ticket_medio, TRIM(BOTH FROM cluster_perfil) AS cluster_perfil, COALESCE(score_hub, 0::numeric)::numeric(10,2) AS score_hub, COALESCE(volume_total, 0) AS volume_total FROM tb_analytics_performance_agencias a);
CREATE VIEW "bi"."vw_fluxo_cluster_resumo" TABLESPACE bi AS (SELECT cluster_perfil, count(*) AS qtd_agencias, COALESCE(sum(volume_total), 0::bigint) AS volume_total, COALESCE(avg(ticket_medio), 0::numeric)::numeric(15,2) AS ticket_medio_medio, COALESCE(avg(score_hub), 0::numeric)::numeric(10,2) AS score_hub_medio FROM bi.vw_fluxo_base GROUP BY cluster_perfil);
CREATE VIEW "bi"."vw_fluxo_drill_agencia" TABLESPACE bi AS (SELECT agencia, mes_referencia, qtd_emissoes, qtd_recebimentos, volume_total, valor_total_emitido, valor_total_recebido, saldo_fluxo_qtd, saldo_fluxo_valor, ticket_medio, razao_fluxo, status_fluxo, cluster_perfil, score_hub FROM bi.vw_fluxo_agencia_resumo);
CREATE VIEW "bi"."vw_fluxo_evolucao_mensal" TABLESPACE bi AS (SELECT mes_referencia, COALESCE(sum(volume_total), 0::bigint) AS volume_total, COALESCE(sum(qtd_emissoes), 0::bigint) AS qtd_emissoes, COALESCE(sum(qtd_recebimentos), 0::bigint) AS qtd_recebimentos, COALESCE(avg(ticket_medio), 0::numeric)::numeric(15,2) AS ticket_medio_global, COALESCE(avg(score_hub), 0::numeric)::numeric(10,2) AS score_hub_medio FROM bi.vw_fluxo_base GROUP BY mes_referencia ORDER BY mes_referencia);
CREATE VIEW "bi"."vw_fluxo_filters" TABLESPACE bi AS (SELECT DISTINCT mes_referencia, agencia, status_fluxo AS tipo_fluxo, cluster_perfil AS perfil FROM bi.vw_fluxo_base);
CREATE VIEW "bi"."vw_fluxo_kpis" TABLESPACE bi AS (SELECT COALESCE(sum(qtd_emissoes), 0::bigint) AS qtd_emissoes, COALESCE(sum(volume_total), 0::bigint) AS volume_total, COALESCE(avg(ticket_medio), 0::numeric)::numeric(15,2) AS ticket_medio_global, COALESCE(avg(score_hub), 0::numeric)::numeric(10,2) AS score_hub_medio, CASE WHEN count(*) = 0 THEN 0::numeric ELSE count(*) FILTER (WHERE status_fluxo = 'EQUILIBRADA'::text)::numeric / count(*)::numeric END AS percentual_rede_equilibrada, CASE WHEN count(*) = 0 THEN 0::numeric ELSE count(*) FILTER (WHERE status_fluxo = 'RECEPTORA'::text)::numeric / count(*)::numeric END AS percentual_rede_receptora FROM bi.vw_fluxo_base);
CREATE VIEW "bi"."vw_fluxo_status_resumo" TABLESPACE bi AS (SELECT status_fluxo, count(*) AS qtd_agencias, COALESCE(sum(volume_total), 0::bigint) AS volume_total, COALESCE(sum(qtd_emissoes), 0::bigint) AS qtd_emissoes, COALESCE(sum(qtd_recebimentos), 0::bigint) AS qtd_recebimentos, COALESCE(avg(ticket_medio), 0::numeric)::numeric(15,2) AS ticket_medio_medio FROM bi.vw_fluxo_base GROUP BY status_fluxo);
CREATE VIEW "bi"."vw_fluxo_top_desequilibrio" TABLESPACE bi AS (SELECT agencia, mes_referencia, qtd_emissoes, qtd_recebimentos, volume_total, ticket_medio, razao_fluxo, status_fluxo, cluster_perfil, score_hub, abs(qtd_recebimentos - qtd_emissoes) AS desequilibrio_absoluto FROM bi.vw_fluxo_base);
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
CREATE VIEW "bi"."vw_planejamento_agencias_anual" TABLESPACE bi AS (SELECT agencia, ano, sum(qtd_ctes) AS qtd_ctes, sum(faturamento_realizado)::numeric(15,2) AS faturamento_realizado, CASE WHEN sum(qtd_ctes) = 0::numeric THEN 0::numeric ELSE (sum(faturamento_realizado) / sum(qtd_ctes))::numeric(15,2) END AS ticket_medio FROM bi.vw_planejamento_agencias_mensal GROUP BY agencia, ano);
CREATE VIEW "bi"."vw_planejamento_agencias_base" TABLESPACE bi AS (SELECT TRIM(BOTH FROM coleta) AS agencia, upper(TRIM(BOTH FROM coleta)) AS agencia_normalizada, data_emissao::date AS data_referencia, date_trunc('month'::text, data_emissao)::date AS mes_referencia, EXTRACT(year FROM data_emissao)::integer AS ano, EXTRACT(month FROM data_emissao)::integer AS mes_num, TRIM(BOTH FROM to_char(data_emissao, 'TMMonth'::text)) AS mes_nome, COALESCE(valor_total, 0::numeric)::numeric(15,2) AS faturamento FROM tb_nf_saidas_consolidada n WHERE status_sistema = 'AUTORIZADA'::text AND data_emissao IS NOT NULL AND TRIM(BOTH FROM COALESCE(coleta, ''::text)) <> ''::text);
CREATE VIEW "bi"."vw_planejamento_agencias_dias_uteis" TABLESPACE bi AS (SELECT ano, mes_num, mes_nome, count(*) FILTER (WHERE eh_dia_util = true) AS dias_uteis FROM bi.dim_calendario GROUP BY ano, mes_num, mes_nome);
CREATE VIEW "bi"."vw_planejamento_agencias_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, agencia FROM bi.vw_planejamento_agencias_base);
CREATE VIEW "bi"."vw_planejamento_agencias_mensal" TABLESPACE bi AS (SELECT agencia, agencia_normalizada, ano, mes_referencia, mes_num, mes_nome, count(*) AS qtd_ctes, sum(faturamento)::numeric(15,2) AS faturamento_realizado FROM bi.vw_planejamento_agencias_base GROUP BY agencia, agencia_normalizada, ano, mes_referencia, mes_num, mes_nome);
CREATE VIEW "bi"."vw_planejamento_agencias_ready" TABLESPACE bi AS (SELECT m.agencia, m.agencia_normalizada, m.ano, m.mes_referencia, m.mes_num, m.mes_nome, m.qtd_ctes, m.faturamento_realizado, d25.dias_uteis AS dias_uteis_ano_base, d26.dias_uteis AS dias_uteis_ano_meta, CASE WHEN d25.dias_uteis = 0 THEN 0::numeric ELSE (m.faturamento_realizado / d25.dias_uteis::numeric)::numeric(15,4) END AS media_diaria_ano_base, CASE WHEN sum(m.faturamento_realizado) OVER (PARTITION BY m.agencia) = 0::numeric THEN 0::numeric ELSE (m.faturamento_realizado / sum(m.faturamento_realizado) OVER (PARTITION BY m.agencia))::numeric(10,6) END AS peso_sazonal_agencia FROM bi.vw_planejamento_agencias_mensal m LEFT JOIN bi.vw_planejamento_agencias_dias_uteis d25 ON d25.ano = 2025 AND d25.mes_num = m.mes_num LEFT JOIN bi.vw_planejamento_agencias_dias_uteis d26 ON d26.ano = 2026 AND d26.mes_num = m.mes_num WHERE m.ano = 2025);
CREATE VIEW "bi"."vw_rotas_operacionais_agencia" TABLESPACE bi AS (SELECT agencia_origem, mes_referencia, COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_rotas, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_rotas, count(DISTINCT id_cte) AS total_ctes_rotas, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(faturamento_total) / count(DISTINCT id_cte)::numeric END AS ticket_medio FROM bi.vw_rotas_operacionais_base GROUP BY agencia_origem, mes_referencia);
CREATE VIEW "bi"."vw_rotas_operacionais_base" TABLESPACE bi AS (SELECT id_unico AS id_cte, data_emissao::date AS data_referencia, date_trunc('month'::text, data_emissao)::date AS mes_referencia, EXTRACT(year FROM data_emissao)::integer AS ano, EXTRACT(month FROM data_emissao)::integer AS mes_num, TRIM(BOTH FROM to_char(data_emissao, 'TMMonth'::text)) AS mes_nome, TRIM(BOTH FROM coleta) AS agencia_origem, upper(TRIM(BOTH FROM coleta)) AS agencia_origem_normalizada, TRIM(BOTH FROM destino) AS cidade_destino, upper(TRIM(BOTH FROM destino)) AS cidade_destino_normalizada, TRIM(BOTH FROM rota) AS rota, TRIM(BOTH FROM origem) AS cidade_origem, COALESCE(peso, 0::numeric)::numeric(15,2) AS peso_total, COALESCE(volumes, 0) AS qtd_volumes, COALESCE(valor_total, 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(frete_peso, 0::numeric)::numeric(15,2) AS frete_peso, COALESCE(frete_valor, 0::numeric)::numeric(15,2) AS frete_valor, COALESCE(valor_redespacho, 0::numeric)::numeric(15,2) AS valor_redespacho, COALESCE(valor_pedagio, 0::numeric)::numeric(15,2) AS valor_pedagio, COALESCE(valor_seccat, 0::numeric)::numeric(15,2) AS valor_seccat, COALESCE(tx_coleta, 0::numeric)::numeric(15,2) AS taxa_coleta, COALESCE(tx_entrega, 0::numeric)::numeric(15,2) AS taxa_entrega, CASE WHEN COALESCE(peso, 0::numeric) <= 10::numeric THEN '1. Até 10 kg'::text WHEN COALESCE(peso, 0::numeric) <= 30::numeric THEN '2. 11 a 30 kg'::text WHEN COALESCE(peso, 0::numeric) <= 50::numeric THEN '3. 31 a 50 kg'::text WHEN COALESCE(peso, 0::numeric) <= 100::numeric THEN '4. 51 a 100 kg'::text ELSE '5. Acima de 100 kg'::text END AS faixa_peso FROM tb_nf_saidas_consolidada n WHERE status_sistema = 'AUTORIZADA'::text AND data_emissao IS NOT NULL AND TRIM(BOTH FROM COALESCE(coleta, ''::text)) <> ''::text AND TRIM(BOTH FROM COALESCE(destino, ''::text)) <> ''::text);
CREATE VIEW "bi"."vw_rotas_operacionais_destino" TABLESPACE bi AS (SELECT cidade_destino, mes_referencia, COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_rotas, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_rotas, count(DISTINCT id_cte) AS total_ctes_rotas, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(faturamento_total) / count(DISTINCT id_cte)::numeric END AS ticket_medio FROM bi.vw_rotas_operacionais_base GROUP BY cidade_destino, mes_referencia);
CREATE VIEW "bi"."vw_rotas_operacionais_drill" TABLESPACE bi AS (SELECT agencia_origem, cidade_destino, rota, faixa_peso, mes_referencia, faturamento_total, peso_total_rotas, total_volumes_rotas, total_ctes_rotas, ticket_medio, faturamento_por_kg FROM bi.vw_rotas_operacionais_rota);
CREATE VIEW "bi"."vw_rotas_operacionais_evolucao_mensal" TABLESPACE bi AS (SELECT mes_referencia, ano, mes_num, mes_nome, COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total, count(DISTINCT id_cte) AS total_ctes_rotas, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_rotas, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_rotas, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(faturamento_total) / count(DISTINCT id_cte)::numeric END AS ticket_medio FROM bi.vw_rotas_operacionais_base GROUP BY mes_referencia, ano, mes_num, mes_nome ORDER BY mes_referencia);
CREATE VIEW "bi"."vw_rotas_operacionais_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, agencia_origem, cidade_destino, faixa_peso, rota FROM bi.vw_rotas_operacionais_base);
CREATE VIEW "bi"."vw_rotas_operacionais_hierarquia" TABLESPACE bi AS (SELECT agencia_origem, cidade_destino, rota, faixa_peso, mes_referencia, COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_rotas, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(faturamento_total) / count(DISTINCT id_cte)::numeric END AS ticket_medio, count(DISTINCT id_cte) AS total_ctes_rotas, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_rotas FROM bi.vw_rotas_operacionais_base GROUP BY agencia_origem, cidade_destino, rota, faixa_peso, mes_referencia);
CREATE VIEW "bi"."vw_rotas_operacionais_kpis" TABLESPACE bi AS (SELECT COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(faturamento_total) / count(DISTINCT id_cte)::numeric END AS ticket_medio, count(DISTINCT id_cte) AS total_ctes_rotas, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_rotas, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_rotas, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(peso_total) / count(DISTINCT id_cte)::numeric END AS peso_medio_por_cte, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(qtd_volumes)::numeric / count(DISTINCT id_cte)::numeric END AS volumes_por_cte, CASE WHEN sum(peso_total) = 0::numeric THEN 0::numeric ELSE sum(faturamento_total) / sum(peso_total) END AS faturamento_por_kg FROM bi.vw_rotas_operacionais_base);
CREATE VIEW "bi"."vw_rotas_operacionais_mapa" TABLESPACE bi AS (SELECT cidade_destino, mes_referencia, COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_rotas, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_rotas, count(DISTINCT id_cte) AS total_ctes_rotas, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(faturamento_total) / count(DISTINCT id_cte)::numeric END AS ticket_medio FROM bi.vw_rotas_operacionais_base GROUP BY cidade_destino, mes_referencia);
CREATE VIEW "bi"."vw_rotas_operacionais_rota" TABLESPACE bi AS (SELECT agencia_origem, cidade_destino, rota, faixa_peso, mes_referencia, COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(sum(peso_total), 0::numeric)::numeric(15,2) AS peso_total_rotas, COALESCE(sum(qtd_volumes), 0::bigint) AS total_volumes_rotas, count(DISTINCT id_cte) AS total_ctes_rotas, CASE WHEN count(DISTINCT id_cte) = 0 THEN 0::numeric ELSE sum(faturamento_total) / count(DISTINCT id_cte)::numeric END AS ticket_medio, CASE WHEN sum(peso_total) = 0::numeric THEN 0::numeric ELSE sum(faturamento_total) / sum(peso_total) END AS faturamento_por_kg FROM bi.vw_rotas_operacionais_base GROUP BY agencia_origem, cidade_destino, rota, faixa_peso, mes_referencia);
CREATE VIEW "bi"."vw_simulador_vendedoras_anual" TABLESPACE bi AS (SELECT vendedor, ano, sum(qtd_ctes_real) AS qtd_ctes_real, sum(venda_realizada)::numeric(15,2) AS venda_realizada, CASE WHEN sum(qtd_ctes_real) = 0::numeric THEN 0::numeric ELSE sum(venda_realizada) / sum(qtd_ctes_real) END AS ticket_medio FROM bi.vw_simulador_vendedoras_mensal GROUP BY vendedor, ano);
CREATE VIEW "bi"."vw_simulador_vendedoras_base" TABLESPACE bi AS (WITH nf_unica AS ( SELECT c.vendedor_final, c.id_unico_nf, max(c.data_emissao)::date AS data_referencia, date_trunc('month'::text, max(c.data_emissao))::date AS mes_referencia, EXTRACT(year FROM max(c.data_emissao))::integer AS ano, TRIM(BOTH FROM to_char(max(c.data_emissao), 'TMMonth'::text)) AS mes_nome, max(c.valor_base_calculo)::numeric(15,2) AS venda_auditada FROM tb_comissoes c WHERE c.id_unico_nf IS NOT NULL AND c.vendedor_final IS NOT NULL AND TRIM(BOTH FROM c.vendedor_final) <> ''::text GROUP BY c.vendedor_final, c.id_unico_nf ) SELECT vendedor_final AS vendedor, id_unico_nf, data_referencia, mes_referencia, ano, mes_nome, venda_auditada FROM nf_unica n);
CREATE VIEW "bi"."vw_simulador_vendedoras_dias_uteis" TABLESPACE bi AS (SELECT ano, mes_num, mes_nome, count(*) FILTER (WHERE eh_dia_util = true) AS dias_uteis FROM bi.dim_calendario GROUP BY ano, mes_num, mes_nome);
CREATE VIEW "bi"."vw_simulador_vendedoras_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, vendedor FROM bi.vw_simulador_vendedoras_base);
CREATE VIEW "bi"."vw_simulador_vendedoras_mensal" TABLESPACE bi AS (SELECT vendedor, ano, mes_referencia, EXTRACT(month FROM mes_referencia)::integer AS mes_num, TRIM(BOTH FROM to_char(mes_referencia::timestamp with time zone, 'TMMonth'::text)) AS mes_nome, count(DISTINCT id_unico_nf) AS qtd_ctes_real, sum(venda_auditada)::numeric(15,2) AS venda_realizada, avg(venda_auditada)::numeric(15,2) AS ticket_medio FROM bi.vw_simulador_vendedoras_base b GROUP BY vendedor, ano, mes_referencia);
CREATE VIEW "bi"."vw_simulador_vendedoras_ready" TABLESPACE bi AS (SELECT m.vendedor, m.ano, m.mes_referencia, m.mes_num, m.mes_nome, m.qtd_ctes_real, m.venda_realizada, m.ticket_medio, d25.dias_uteis AS dias_uteis_2025, d26.dias_uteis AS dias_uteis_2026, CASE WHEN d25.dias_uteis = 0 THEN 0::numeric ELSE m.venda_realizada / d25.dias_uteis::numeric END AS media_diaria_2025 FROM bi.vw_simulador_vendedoras_mensal m LEFT JOIN bi.vw_simulador_vendedoras_dias_uteis d25 ON m.mes_num = d25.mes_num AND d25.ano = 2025 LEFT JOIN bi.vw_simulador_vendedoras_dias_uteis d26 ON m.mes_num = d26.mes_num AND d26.ano = 2026 WHERE m.ano = 2025);
CREATE VIEW "bi"."vw_sprint_vendas_base" TABLESPACE bi AS (SELECT v.vendedor, v.id_unico_nf, v.data_referencia, v.mes_referencia, v.valor_venda_auditada, cal.ano, cal.mes_num, cal.mes_nome, cal.mes_ano, cal.semana_mes_ordem, cal.semana_mes_label, cal.inicio_semana_no_mes, cal.fim_semana_no_mes, cal.dias_uteis_mes, cal.dias_uteis_semana, cal.qtd_semanas_mes, m.meta_mensal, m.premio_total FROM bi.vw_sprint_vendas_nf_vendedor v JOIN bi.meta_campanha_vendedor m ON m.vendedor = v.vendedor AND m.data_referencia = v.mes_referencia LEFT JOIN bi.vw_calendario_semana_mes_robusta cal ON cal.data = v.data_referencia);
CREATE VIEW "bi"."vw_sprint_vendas_filters" TABLESPACE bi AS (SELECT DISTINCT mes_referencia, vendedor FROM bi.vw_sprint_vendas_mensal);
CREATE VIEW "bi"."vw_sprint_vendas_grade_semanal" TABLESPACE bi AS (SELECT DISTINCT m.data_referencia AS mes_referencia, m.vendedor, m.meta_mensal, m.premio_total, c.semana_mes_ordem, c.semana_mes_label, c.inicio_semana_no_mes, c.fim_semana_no_mes, c.dias_uteis_mes, c.dias_uteis_semana, c.qtd_semanas_mes FROM bi.meta_campanha_vendedor m JOIN bi.vw_calendario_semana_mes_robusta c ON c.mes_referencia = m.data_referencia);
CREATE VIEW "bi"."vw_sprint_vendas_mensal" TABLESPACE bi AS (WITH vendas_mes AS ( SELECT vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor, count(DISTINCT vw_sprint_vendas_base.id_unico_nf) AS qtd_notas_mes, COALESCE(sum(vw_sprint_vendas_base.valor_venda_auditada), 0::numeric)::numeric(15,2) AS venda_auditada_mes FROM bi.vw_sprint_vendas_base GROUP BY vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor ), premios AS ( SELECT vw_sprint_vendas_semanal.mes_referencia, vw_sprint_vendas_semanal.vendedor, COALESCE(sum(vw_sprint_vendas_semanal.premio_garantido_semana), 0::numeric)::numeric(15,2) AS premios_ja_garantidos FROM bi.vw_sprint_vendas_semanal GROUP BY vw_sprint_vendas_semanal.mes_referencia, vw_sprint_vendas_semanal.vendedor ), grade_mes AS ( SELECT DISTINCT vw_sprint_vendas_grade_semanal.mes_referencia, vw_sprint_vendas_grade_semanal.vendedor, vw_sprint_vendas_grade_semanal.meta_mensal, vw_sprint_vendas_grade_semanal.premio_total, vw_sprint_vendas_grade_semanal.dias_uteis_mes, vw_sprint_vendas_grade_semanal.qtd_semanas_mes FROM bi.vw_sprint_vendas_grade_semanal ) SELECT g.mes_referencia, g.vendedor, g.meta_mensal, g.premio_total, g.dias_uteis_mes, g.qtd_semanas_mes, COALESCE(v.qtd_notas_mes, 0::bigint) AS qtd_notas_mes, COALESCE(v.venda_auditada_mes, 0::numeric)::numeric(15,2) AS venda_auditada_mes, (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric)::numeric(15,2) AS meta_diaria_base, CASE WHEN g.meta_mensal = 0::numeric THEN 0::numeric ELSE COALESCE(v.venda_auditada_mes, 0::numeric) / g.meta_mensal END AS percentual_atingimento, COALESCE(p.premios_ja_garantidos, 0::numeric)::numeric(15,2) AS premios_ja_garantidos FROM grade_mes g LEFT JOIN vendas_mes v ON v.mes_referencia = g.mes_referencia AND v.vendedor = g.vendedor LEFT JOIN premios p ON p.mes_referencia = g.mes_referencia AND p.vendedor = g.vendedor);
CREATE VIEW "bi"."vw_sprint_vendas_nf_vendedor" TABLESPACE bi AS (SELECT TRIM(BOTH FROM vendedor_final) AS vendedor, id_unico_nf, max(data_emissao)::date AS data_referencia, date_trunc('month'::text, max(data_emissao))::date AS mes_referencia, COALESCE(max(valor_base_calculo), 0::double precision)::numeric(15,2) AS valor_venda_auditada FROM tb_comissoes c WHERE TRIM(BOTH FROM COALESCE(vendedor_final, ''::text)) <> ''::text AND TRIM(BOTH FROM COALESCE(id_unico_nf, ''::text)) <> ''::text GROUP BY (TRIM(BOTH FROM vendedor_final)), id_unico_nf);
CREATE VIEW "bi"."vw_sprint_vendas_ranking" TABLESPACE bi AS (SELECT mes_referencia, vendedor, meta_mensal, venda_auditada_mes, percentual_atingimento FROM bi.vw_sprint_vendas_mensal);
CREATE VIEW "bi"."vw_sprint_vendas_semanal" TABLESPACE bi AS (WITH vendas_semana AS ( SELECT vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor, vw_sprint_vendas_base.semana_mes_ordem, count(DISTINCT vw_sprint_vendas_base.id_unico_nf) AS qtd_notas, COALESCE(sum(vw_sprint_vendas_base.valor_venda_auditada), 0::numeric)::numeric(15,2) AS venda_auditada_semana FROM bi.vw_sprint_vendas_base GROUP BY vw_sprint_vendas_base.mes_referencia, vw_sprint_vendas_base.vendedor, vw_sprint_vendas_base.semana_mes_ordem ), base AS ( SELECT g.mes_referencia, g.vendedor, g.meta_mensal, g.premio_total, g.semana_mes_ordem, g.semana_mes_label, g.inicio_semana_no_mes, g.fim_semana_no_mes, g.dias_uteis_mes, g.dias_uteis_semana, g.qtd_semanas_mes, COALESCE(v.qtd_notas, 0::bigint) AS qtd_notas, COALESCE(v.venda_auditada_semana, 0::numeric)::numeric(15,2) AS venda_auditada_semana, (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric)::numeric(15,8) AS meta_diaria_base_bruta, (g.meta_mensal / NULLIF(g.dias_uteis_mes, 0)::numeric * g.dias_uteis_semana::numeric)::numeric(15,8) AS meta_semanal_bruta, (g.premio_total / NULLIF(g.qtd_semanas_mes, 0)::numeric)::numeric(15,8) AS premio_por_semana_bruto FROM bi.vw_sprint_vendas_grade_semanal g LEFT JOIN vendas_semana v ON v.mes_referencia = g.mes_referencia AND v.vendedor = g.vendedor AND v.semana_mes_ordem = g.semana_mes_ordem ), arred AS ( SELECT b.mes_referencia, b.vendedor, b.meta_mensal, b.premio_total, b.semana_mes_ordem, b.semana_mes_label, b.inicio_semana_no_mes, b.fim_semana_no_mes, b.dias_uteis_mes, b.dias_uteis_semana, b.qtd_semanas_mes, b.qtd_notas, b.venda_auditada_semana, b.meta_diaria_base_bruta, b.meta_semanal_bruta, b.premio_por_semana_bruto, round(b.meta_diaria_base_bruta, 2)::numeric(15,2) AS meta_diaria_base, round(b.meta_semanal_bruta, 2)::numeric(15,2) AS meta_semanal_est_pre, round(b.premio_por_semana_bruto, 2)::numeric(15,2) AS premio_por_semana FROM base b ), ajuste AS ( SELECT a.mes_referencia, a.vendedor, a.meta_mensal, a.premio_total, a.semana_mes_ordem, a.semana_mes_label, a.inicio_semana_no_mes, a.fim_semana_no_mes, a.dias_uteis_mes, a.dias_uteis_semana, a.qtd_semanas_mes, a.qtd_notas, a.venda_auditada_semana, a.meta_diaria_base_bruta, a.meta_semanal_bruta, a.premio_por_semana_bruto, a.meta_diaria_base, a.meta_semanal_est_pre, a.premio_por_semana, sum(a.meta_semanal_est_pre) OVER (PARTITION BY a.mes_referencia, a.vendedor)::numeric(15,2) AS soma_meta_semanal_pre, max(a.semana_mes_ordem) OVER (PARTITION BY a.mes_referencia, a.vendedor) AS ultima_semana FROM arred a ) SELECT mes_referencia, vendedor, meta_mensal, premio_total, semana_mes_ordem, semana_mes_label, inicio_semana_no_mes, fim_semana_no_mes, dias_uteis_mes, dias_uteis_semana, qtd_semanas_mes, qtd_notas, venda_auditada_semana, meta_diaria_base, CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END AS meta_semanal_est, premio_por_semana, CASE WHEN venda_auditada_semana >= CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END AND CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END > 0::numeric THEN premio_por_semana ELSE 0::numeric(15,2) END AS premio_garantido_semana, CASE WHEN CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END <= 0::numeric THEN NULL::text WHEN fim_semana_no_mes > CURRENT_DATE AND venda_auditada_semana = 0::numeric THEN NULL::text WHEN venda_auditada_semana >= CASE WHEN semana_mes_ordem = ultima_semana THEN round(meta_semanal_est_pre + (meta_mensal - soma_meta_semanal_pre), 2)::numeric(15,2) ELSE meta_semanal_est_pre END THEN '🏆'::text ELSE '❌'::text END AS status_semana FROM ajuste j);
CREATE VIEW "bi"."vw_sprint_vendas_tabela" TABLESPACE bi AS (SELECT mes_referencia, vendedor, semana_mes_ordem, semana_mes_label, meta_semanal_est, venda_auditada_semana, CASE WHEN meta_semanal_est = 0::numeric THEN 0::numeric ELSE venda_auditada_semana / meta_semanal_est END AS percentual_meta_semana, status_semana FROM bi.vw_sprint_vendas_semanal);
CREATE VIEW "bi"."vw_tabelas_combinadas_base" TABLESPACE bi AS (SELECT id_controle, id_tabela, cnpj_cliente, TRIM(BOTH FROM razao_social_cliente) AS cliente, upper(TRIM(BOTH FROM razao_social_cliente)) AS cliente_normalizado, TRIM(BOTH FROM nome_tabela) AS tabela_nome, validade AS data_referencia, date_trunc('month'::text, validade::timestamp with time zone)::date AS mes_referencia, validade, ultima_compra, TRIM(BOTH FROM dono_atual) AS vendedor, upper(TRIM(BOTH FROM dono_atual)) AS vendedor_normalizado, COALESCE(total_comprado, 0::numeric)::numeric(15,2) AS total_comprado, COALESCE(qtd_ctes, 0) AS qtd_ctes, COALESCE(total_volumes, 0) AS total_volumes, COALESCE(media_ticket, 0::numeric)::numeric(15,2) AS media_ticket, COALESCE(dias_vencimento, 0) AS dias_vencimento, TRIM(BOTH FROM status_estrategico) AS status_atual, CASE WHEN status_estrategico ~~* '%CRITICO%'::text THEN 'CRÍTICO'::text WHEN status_estrategico ~~* '%RECUPERAR - OURO%'::text THEN 'RECUPERAR - OURO'::text WHEN status_estrategico ~~* '%ALERTA%'::text THEN 'ALERTA'::text WHEN status_estrategico ~~* '%RISCO CHURN%'::text THEN 'RISCO CHURN'::text WHEN status_estrategico ~~* '%BAIXO POTENCIAL%'::text THEN 'BAIXO POTENCIAL'::text WHEN status_estrategico ~~* '%VIGENTE - ATIVO%'::text THEN 'VIGENTE - ATIVO'::text WHEN status_estrategico ~~* '%VITALICIO - RISCO PARADO%'::text THEN 'VITALÍCIO - RISCO PARADO'::text WHEN status_estrategico ~~* '%VITALICIO%'::text THEN 'VITALÍCIO'::text WHEN status_estrategico ~~* '%VENCIDO - RENOVAR%'::text THEN 'VENCIDO - RENOVAR'::text WHEN status_estrategico ~~* '%VENCIDO - BAIXO POTENCIAL%'::text THEN 'VENCIDO - BAIXO POTENCIAL'::text WHEN status_estrategico ~~* '%VERIFICAR DATA%'::text THEN 'VERIFICAR DATA'::text ELSE 'OUTROS'::text END AS status_grupo, CASE WHEN status_estrategico ~~* '%CRITICO%'::text THEN 1 WHEN status_estrategico ~~* '%RECUPERAR - OURO%'::text THEN 2 WHEN status_estrategico ~~* '%ALERTA%'::text THEN 3 WHEN status_estrategico ~~* '%RISCO CHURN%'::text THEN 4 WHEN status_estrategico ~~* '%VENCIDO - RENOVAR%'::text THEN 5 WHEN status_estrategico ~~* '%VENCIDO - BAIXO POTENCIAL%'::text THEN 6 WHEN status_estrategico ~~* '%VIGENTE - ATIVO%'::text THEN 7 WHEN status_estrategico ~~* '%VITALICIO - RISCO PARADO%'::text THEN 8 WHEN status_estrategico ~~* '%VITALICIO%'::text THEN 9 ELSE 99 END AS prioridade_status, CASE WHEN dias_vencimento < 0 THEN '1. Já venceu'::text WHEN dias_vencimento <= 30 THEN '2. Vence em 30 dias'::text WHEN dias_vencimento <= 60 THEN '3. Vence em 60 dias'::text ELSE '4. Seguro'::text END AS pipeline_fase, CASE WHEN dias_vencimento < 0 THEN 1 WHEN dias_vencimento <= 30 THEN 2 WHEN dias_vencimento <= 60 THEN 3 ELSE 4 END AS pipeline_ordem, CASE WHEN status_estrategico ~~* '%CRITICO%'::text OR status_estrategico ~~* '%RECUPERAR - OURO%'::text OR status_estrategico ~~* '%ALERTA%'::text THEN COALESCE(total_comprado, 0::numeric)::numeric(15,2) ELSE 0::numeric(15,2) END AS risco_financeiro_valor, CASE WHEN status_estrategico ~~* '%RISCO CHURN%'::text OR status_estrategico ~~* '%BAIXO POTENCIAL%'::text OR status_estrategico ~~* '%VITALICIO - RISCO PARADO%'::text THEN COALESCE(total_comprado, 0::numeric)::numeric(15,2) ELSE 0::numeric(15,2) END AS risco_silencioso_valor, CASE WHEN status_estrategico ~~* '%OURO%'::text THEN COALESCE(total_comprado, 0::numeric)::numeric(15,2) ELSE 0::numeric(15,2) END AS oportunidade_recuperacao_valor, CASE WHEN status_estrategico ~~* '%VIGENTE - ATIVO%'::text THEN 1 ELSE 0 END AS carteira_saudavel_flag, CASE WHEN status_estrategico ~~* '%CRITICO%'::text THEN 1 ELSE 0 END AS contrato_critico_flag, CASE WHEN status_estrategico ~~* '%RECUPERAR - OURO%'::text THEN 1 ELSE 0 END AS contrato_recuperar_flag, CASE WHEN TRIM(BOTH FROM COALESCE(dono_atual, ''::text)) = ''::text OR upper(TRIM(BOTH FROM COALESCE(dono_atual, ''::text))) = 'SEM DONO'::text THEN 1 ELSE 0 END AS sem_dono_flag, CASE WHEN ultima_compra IS NULL THEN NULL::integer ELSE CURRENT_DATE - ultima_compra END AS dias_sem_compra, CASE WHEN status_estrategico ~~* '%CRITICO%'::text THEN 'Renovar agora'::text WHEN status_estrategico ~~* '%RECUPERAR - OURO%'::text THEN 'Win-back imediato'::text WHEN status_estrategico ~~* '%ALERTA%'::text THEN 'Preparar proposta'::text WHEN status_estrategico ~~* '%RISCO CHURN%'::text THEN 'Contato preventivo'::text WHEN status_estrategico ~~* '%VENCIDO - RENOVAR%'::text THEN 'Reativar contrato'::text WHEN status_estrategico ~~* '%VITALICIO - RISCO PARADO%'::text THEN 'Reaquecer carteira'::text WHEN status_estrategico ~~* '%VIGENTE - ATIVO%'::text THEN 'Manter acompanhamento'::text ELSE 'Analisar'::text END AS proxima_acao, ( CASE WHEN status_estrategico ~~* '%CRITICO%'::text THEN 100 WHEN status_estrategico ~~* '%RECUPERAR - OURO%'::text THEN 90 WHEN status_estrategico ~~* '%ALERTA%'::text THEN 75 WHEN status_estrategico ~~* '%RISCO CHURN%'::text THEN 60 WHEN status_estrategico ~~* '%VENCIDO - RENOVAR%'::text THEN 55 WHEN status_estrategico ~~* '%VITALICIO - RISCO PARADO%'::text THEN 45 WHEN status_estrategico ~~* '%VIGENTE - ATIVO%'::text THEN 20 ELSE 10 END::numeric + LEAST(COALESCE(total_comprado, 0::numeric) / 10000::numeric, 30::numeric) + CASE WHEN dias_vencimento < 0 THEN 15 WHEN dias_vencimento <= 7 THEN 12 WHEN dias_vencimento <= 15 THEN 8 WHEN dias_vencimento <= 30 THEN 5 ELSE 0 END::numeric)::numeric(10,2) AS score_prioridade FROM tb_controle_vencimentos t);
CREATE VIEW "bi"."vw_tabelas_combinadas_cliente_resumo" TABLESPACE bi AS (SELECT data_referencia, mes_referencia, vendedor, cliente, cliente_normalizado, count(*) AS qtd_contratos, COALESCE(sum(total_comprado), 0::numeric)::numeric(15,2) AS total_comprado, COALESCE(sum(qtd_ctes), 0::bigint) AS qtd_ctes, COALESCE(sum(total_volumes), 0::bigint) AS total_volumes, COALESCE(avg(media_ticket), 0::numeric)::numeric(15,2) AS media_ticket, max(ultima_compra) AS ultima_compra, min(dias_vencimento) AS menor_dias_vencimento, COALESCE(sum(risco_financeiro_valor), 0::numeric)::numeric(15,2) AS risco_financeiro_valor, COALESCE(sum(risco_silencioso_valor), 0::numeric)::numeric(15,2) AS risco_silencioso_valor, COALESCE(sum(oportunidade_recuperacao_valor), 0::numeric)::numeric(15,2) AS oportunidade_recuperacao_valor, min(prioridade_status) AS melhor_prioridade, COALESCE(avg(score_prioridade), 0::numeric)::numeric(10,2) AS score_prioridade_medio, max(proxima_acao) AS proxima_acao FROM bi.vw_tabelas_combinadas_base GROUP BY data_referencia, mes_referencia, vendedor, cliente, cliente_normalizado);
CREATE VIEW "bi"."vw_tabelas_combinadas_drill_cliente" TABLESPACE bi AS (SELECT cliente, vendedor, status_atual, status_grupo, proxima_acao, score_prioridade, tabela_nome AS tabela, validade, ultima_compra, dias_vencimento, total_comprado AS ltv_valor, qtd_ctes, total_volumes, media_ticket, risco_financeiro_valor, risco_silencioso_valor, oportunidade_recuperacao_valor, pipeline_fase, dias_sem_compra FROM bi.vw_tabelas_combinadas_base);
CREATE VIEW "bi"."vw_tabelas_combinadas_filters" TABLESPACE bi AS (SELECT DISTINCT data_referencia, vendedor, status_atual, cliente FROM bi.vw_tabelas_combinadas_base);
CREATE VIEW "bi"."vw_tabelas_combinadas_kpis" TABLESPACE bi AS (SELECT count(*) AS contratos_monitorados, sum(contrato_critico_flag) AS contratos_criticos, sum(contrato_recuperar_flag) AS contratos_recuperar, COALESCE(sum(oportunidade_recuperacao_valor), 0::numeric)::numeric(15,2) AS mina_de_ouro_winback, CASE WHEN count(*) = 0 THEN 0::numeric ELSE sum(carteira_saudavel_flag)::numeric / count(*)::numeric END AS carteira_saudavel_percentual, COALESCE(sum(risco_silencioso_valor), 0::numeric)::numeric(15,2) AS risco_silencioso_valor, sum(sem_dono_flag) AS contratos_sem_dono, COALESCE(avg(media_ticket), 0::numeric)::numeric(15,2) AS ticket_medio_carteira FROM bi.vw_tabelas_combinadas_base);
CREATE VIEW "bi"."vw_tabelas_combinadas_pipeline_resumo" TABLESPACE bi AS (SELECT data_referencia, mes_referencia, pipeline_ordem, pipeline_fase, count(*) AS qtd_contratos, COALESCE(sum(total_comprado), 0::numeric)::numeric(15,2) AS total_comprado FROM bi.vw_tabelas_combinadas_base GROUP BY data_referencia, mes_referencia, pipeline_ordem, pipeline_fase);
CREATE VIEW "bi"."vw_tabelas_combinadas_status_resumo" TABLESPACE bi AS (SELECT data_referencia, mes_referencia, status_grupo, prioridade_status, count(*) AS qtd_contratos, COALESCE(sum(total_comprado), 0::numeric)::numeric(15,2) AS total_comprado, COALESCE(sum(qtd_ctes), 0::bigint) AS qtd_ctes, COALESCE(sum(total_volumes), 0::bigint) AS total_volumes FROM bi.vw_tabelas_combinadas_base GROUP BY data_referencia, mes_referencia, status_grupo, prioridade_status);
CREATE VIEW "bi"."vw_tabelas_combinadas_tabela" TABLESPACE bi AS (SELECT prioridade_status, score_prioridade, status_atual, proxima_acao, dias_vencimento AS dias_p_vencer, cliente, tabela_nome AS tabela, ultima_compra, total_comprado AS ltv_valor, qtd_ctes, total_volumes, media_ticket, vendedor FROM bi.vw_tabelas_combinadas_base);
CREATE VIEW "bi"."vw_tabelas_combinadas_vendedor_resumo" TABLESPACE bi AS (WITH base AS ( SELECT vw_tabelas_combinadas_base.id_controle, vw_tabelas_combinadas_base.id_tabela, vw_tabelas_combinadas_base.cnpj_cliente, vw_tabelas_combinadas_base.cliente, vw_tabelas_combinadas_base.cliente_normalizado, vw_tabelas_combinadas_base.tabela_nome, vw_tabelas_combinadas_base.data_referencia, vw_tabelas_combinadas_base.mes_referencia, vw_tabelas_combinadas_base.validade, vw_tabelas_combinadas_base.ultima_compra, vw_tabelas_combinadas_base.vendedor, vw_tabelas_combinadas_base.vendedor_normalizado, vw_tabelas_combinadas_base.total_comprado, vw_tabelas_combinadas_base.qtd_ctes, vw_tabelas_combinadas_base.total_volumes, vw_tabelas_combinadas_base.media_ticket, vw_tabelas_combinadas_base.dias_vencimento, vw_tabelas_combinadas_base.status_atual, vw_tabelas_combinadas_base.status_grupo, vw_tabelas_combinadas_base.prioridade_status, vw_tabelas_combinadas_base.pipeline_fase, vw_tabelas_combinadas_base.pipeline_ordem, vw_tabelas_combinadas_base.risco_financeiro_valor, vw_tabelas_combinadas_base.risco_silencioso_valor, vw_tabelas_combinadas_base.oportunidade_recuperacao_valor, vw_tabelas_combinadas_base.carteira_saudavel_flag, vw_tabelas_combinadas_base.contrato_critico_flag, vw_tabelas_combinadas_base.contrato_recuperar_flag, vw_tabelas_combinadas_base.sem_dono_flag, vw_tabelas_combinadas_base.dias_sem_compra, vw_tabelas_combinadas_base.proxima_acao, vw_tabelas_combinadas_base.score_prioridade FROM bi.vw_tabelas_combinadas_base ), acao_rank AS ( SELECT base.vendedor, base.proxima_acao, count(*) AS qtd, row_number() OVER (PARTITION BY base.vendedor ORDER BY (count(*)) DESC, base.proxima_acao) AS rn FROM base GROUP BY base.vendedor, base.proxima_acao ) SELECT b.data_referencia, b.mes_referencia, b.vendedor, count(*) AS qtd_contratos, sum(b.contrato_critico_flag) AS contratos_criticos, sum(b.contrato_recuperar_flag) AS contratos_recuperar, sum(b.carteira_saudavel_flag) AS contratos_saudaveis, sum(b.sem_dono_flag) AS sem_dono, COALESCE(sum(b.risco_financeiro_valor), 0::numeric)::numeric(15,2) AS risco_financeiro_valor, COALESCE(sum(b.risco_silencioso_valor), 0::numeric)::numeric(15,2) AS risco_silencioso_valor, COALESCE(sum(b.oportunidade_recuperacao_valor), 0::numeric)::numeric(15,2) AS oportunidade_recuperacao_valor, COALESCE(sum(b.total_comprado), 0::numeric)::numeric(15,2) AS total_comprado, COALESCE(sum(b.qtd_ctes), 0::bigint) AS qtd_ctes, COALESCE(sum(b.total_volumes), 0::bigint) AS total_volumes, COALESCE(avg(b.score_prioridade), 0::numeric)::numeric(10,2) AS score_prioridade_medio, max(a.proxima_acao) FILTER (WHERE a.rn = 1) AS proxima_acao_dominante FROM base b LEFT JOIN acao_rank a ON a.vendedor = b.vendedor GROUP BY b.data_referencia, b.mes_referencia, b.vendedor);
CREATE VIEW "bi"."vw_taxas_agencia_resumo" TABLESPACE bi AS (SELECT agencia, mes_referencia, faturamento_total, receita_extras_total, pct_representatividade_extras, receita_coleta, pct_penetracao_coleta, tm_coleta, receita_entrega, pct_penetracao_entrega, tm_entrega, receita_outros, tm_outros, receita_pedagio, receita_seccat, perfil_cobranca, qtd_emissoes, qtd_recebimentos, qtd_cobrada_coleta, qtd_cobrada_entrega, qtd_cobrada_outros, CASE WHEN tm_entrega < (avg(tm_entrega) OVER () * 0.8) THEN '🔻 Cobra Muito Baixo'::text WHEN tm_entrega > (avg(tm_entrega) OVER () * 1.2) THEN '💎 Cobra Bem'::text ELSE '🆗 Na Média'::text END AS status_cobranca_entrega, CASE WHEN tm_coleta < (avg(tm_coleta) OVER () * 0.8) THEN '🔻 Cobra Muito Baixo'::text WHEN tm_coleta > (avg(tm_coleta) OVER () * 1.2) THEN '💎 Cobra Bem'::text ELSE '🆗 Na Média'::text END AS status_cobranca_coleta, (COALESCE(receita_coleta, 0::numeric) + COALESCE(receita_entrega, 0::numeric) + COALESCE(receita_outros, 0::numeric))::numeric(15,2) AS receita_servicos_cobraveis FROM bi.vw_taxas_base);
CREATE VIEW "bi"."vw_taxas_base" TABLESPACE bi AS (SELECT TRIM(BOTH FROM agencia) AS agencia, upper(TRIM(BOTH FROM agencia)) AS agencia_normalizada, mes_referencia::date AS mes_referencia, COALESCE(qtd_emissoes, 0) AS qtd_emissoes, COALESCE(qtd_recebimentos, 0) AS qtd_recebimentos, COALESCE(faturamento_total, 0::numeric)::numeric(15,2) AS faturamento_total, COALESCE(receita_frete_peso, 0::numeric)::numeric(15,2) AS receita_frete_peso, COALESCE(receita_extras_total, 0::numeric)::numeric(15,2) AS receita_extras_total, COALESCE(pct_representatividade_extras, 0::numeric)::numeric(10,4) AS pct_representatividade_extras, COALESCE(receita_coleta, 0::numeric)::numeric(15,2) AS receita_coleta, COALESCE(pct_penetracao_coleta, 0::numeric)::numeric(10,4) AS pct_penetracao_coleta, COALESCE(tm_coleta, 0::numeric)::numeric(15,2) AS tm_coleta, COALESCE(receita_entrega, 0::numeric)::numeric(15,2) AS receita_entrega, COALESCE(pct_penetracao_entrega, 0::numeric)::numeric(10,4) AS pct_penetracao_entrega, COALESCE(tm_entrega, 0::numeric)::numeric(15,2) AS tm_entrega, COALESCE(receita_outros, 0::numeric)::numeric(15,2) AS receita_outros, COALESCE(tm_outros, 0::numeric)::numeric(15,2) AS tm_outros, COALESCE(receita_pedagio, 0::numeric)::numeric(15,2) AS receita_pedagio, COALESCE(receita_seccat, 0::numeric)::numeric(15,2) AS receita_seccat, TRIM(BOTH FROM perfil_cobranca) AS perfil_cobranca, COALESCE(qtd_cobrada_coleta, 0) AS qtd_cobrada_coleta, COALESCE(qtd_cobrada_entrega, 0) AS qtd_cobrada_entrega, COALESCE(qtd_cobrada_outros, 0) AS qtd_cobrada_outros FROM tb_analytics_receitas_extras a);
CREATE VIEW "bi"."vw_taxas_composicao" TABLESPACE bi AS (SELECT 'Coleta'::text AS servico, COALESCE(sum(vw_taxas_base.receita_coleta), 0::numeric)::numeric(15,2) AS receita FROM bi.vw_taxas_base UNION ALL SELECT 'Entrega'::text AS servico, COALESCE(sum(vw_taxas_base.receita_entrega), 0::numeric)::numeric(15,2) AS receita FROM bi.vw_taxas_base UNION ALL SELECT 'Outros'::text AS servico, COALESCE(sum(vw_taxas_base.receita_outros), 0::numeric)::numeric(15,2) AS receita FROM bi.vw_taxas_base UNION ALL SELECT 'Pedágio'::text AS servico, COALESCE(sum(vw_taxas_base.receita_pedagio), 0::numeric)::numeric(15,2) AS receita FROM bi.vw_taxas_base UNION ALL SELECT 'SECCAT'::text AS servico, COALESCE(sum(vw_taxas_base.receita_seccat), 0::numeric)::numeric(15,2) AS receita FROM bi.vw_taxas_base);
CREATE VIEW "bi"."vw_taxas_drill_agencia" TABLESPACE bi AS (SELECT agencia, mes_referencia, faturamento_total, receita_extras_total, pct_representatividade_extras, receita_coleta, qtd_cobrada_coleta, pct_penetracao_coleta, tm_coleta, status_cobranca_coleta, receita_entrega, qtd_cobrada_entrega, pct_penetracao_entrega, tm_entrega, status_cobranca_entrega, receita_outros, qtd_cobrada_outros, tm_outros, receita_pedagio, receita_seccat, perfil_cobranca, qtd_emissoes, qtd_recebimentos FROM bi.vw_taxas_agencia_resumo);
CREATE VIEW "bi"."vw_taxas_evolucao_mensal" TABLESPACE bi AS (SELECT mes_referencia, COALESCE(sum(receita_extras_total), 0::numeric)::numeric(15,2) AS receita_extras_total, CASE WHEN COALESCE(sum(faturamento_total), 0::numeric) = 0::numeric THEN 0::numeric ELSE sum(receita_extras_total) / sum(faturamento_total) END AS pct_representatividade_extras, CASE WHEN COALESCE(sum(qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric ELSE sum(qtd_cobrada_entrega)::numeric / sum(qtd_recebimentos)::numeric END AS pct_penetracao_entrega_global, CASE WHEN COALESCE(sum(qtd_emissoes), 0::bigint) = 0 THEN 0::numeric ELSE sum(qtd_cobrada_coleta)::numeric / sum(qtd_emissoes)::numeric END AS pct_penetracao_coleta_global FROM bi.vw_taxas_base GROUP BY mes_referencia ORDER BY mes_referencia);
CREATE VIEW "bi"."vw_taxas_filters" TABLESPACE bi AS (SELECT DISTINCT mes_referencia, agencia, perfil_cobranca, CASE WHEN receita_coleta > 0::numeric THEN 'Coleta'::text WHEN receita_entrega > 0::numeric THEN 'Entrega'::text WHEN receita_outros > 0::numeric THEN 'Outros'::text WHEN receita_pedagio > 0::numeric THEN 'Pedágio'::text WHEN receita_seccat > 0::numeric THEN 'SECCAT'::text ELSE 'Sem taxas'::text END AS selecao_taxas FROM bi.vw_taxas_base);
CREATE VIEW "bi"."vw_taxas_kpis" TABLESPACE bi AS (SELECT COALESCE(sum(receita_extras_total), 0::numeric)::numeric(15,2) AS receita_servicos_extras, COALESCE(sum(faturamento_total), 0::numeric)::numeric(15,2) AS faturamento_total_analisado, CASE WHEN COALESCE(sum(faturamento_total), 0::numeric) = 0::numeric THEN 0::numeric ELSE sum(receita_extras_total) / sum(faturamento_total) END AS impacto_faturamento_percentual, CASE WHEN COALESCE(sum(qtd_emissoes + qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric ELSE sum(receita_extras_total) / sum(qtd_emissoes + qtd_recebimentos)::numeric END AS ticket_medio_extras, CASE WHEN COALESCE(sum(qtd_emissoes), 0::bigint) = 0 THEN 0::numeric ELSE sum(qtd_cobrada_coleta)::numeric / sum(qtd_emissoes)::numeric END AS penetracao_coleta_global, CASE WHEN COALESCE(sum(qtd_recebimentos), 0::bigint) = 0 THEN 0::numeric ELSE sum(qtd_cobrada_entrega)::numeric / sum(qtd_recebimentos)::numeric END AS penetracao_entrega_global FROM bi.vw_taxas_base);
CREATE VIEW "bi"."vw_taxas_tm_servico" TABLESPACE bi AS (SELECT 'TM Coleta'::text AS servico, CASE WHEN sum(vw_taxas_base.qtd_cobrada_coleta) = 0 THEN 0::numeric ELSE sum(vw_taxas_base.receita_coleta) / sum(vw_taxas_base.qtd_cobrada_coleta)::numeric END AS ticket_medio FROM bi.vw_taxas_base UNION ALL SELECT 'TM Entrega'::text AS servico, CASE WHEN sum(vw_taxas_base.qtd_cobrada_entrega) = 0 THEN 0::numeric ELSE sum(vw_taxas_base.receita_entrega) / sum(vw_taxas_base.qtd_cobrada_entrega)::numeric END AS ticket_medio FROM bi.vw_taxas_base UNION ALL SELECT 'TM Outros'::text AS servico, CASE WHEN sum(vw_taxas_base.qtd_cobrada_outros) = 0 THEN 0::numeric ELSE sum(vw_taxas_base.receita_outros) / sum(vw_taxas_base.qtd_cobrada_outros)::numeric END AS ticket_medio FROM bi.vw_taxas_base UNION ALL SELECT 'TM Pedágio'::text AS servico, CASE WHEN sum(vw_taxas_base.qtd_recebimentos) = 0 THEN 0::numeric ELSE sum(vw_taxas_base.receita_pedagio) / sum(vw_taxas_base.qtd_recebimentos)::numeric END AS ticket_medio FROM bi.vw_taxas_base UNION ALL SELECT 'TM SECCAT'::text AS servico, CASE WHEN sum(vw_taxas_base.qtd_recebimentos) = 0 THEN 0::numeric ELSE sum(vw_taxas_base.receita_seccat) / sum(vw_taxas_base.qtd_recebimentos)::numeric END AS ticket_medio FROM bi.vw_taxas_base);

---

## Rotas operacionais — app (produção)

- **Rota UI:** `/app/gerencial/operacao/rotas-operacionais` (hub Gerencial → Operação).
- **APIs:** `/api/bi/rotas-operacionais/facet-options`, `dataset`, `drill` — mesma permissão que desempenho agências (`operacionalBiAuth`), base `COMERCIAL_DATABASE_URL`.
- **Implementação:** leitura direta em `tb_nf_saidas_consolidada` (`status_sistema = 'AUTORIZADA'`, `data_emissao`, `coleta` = agência origem, `destino` = cidade destino, `rota`, `peso`, `volumes`, `valor_total`) e faixa de peso idêntica à coluna `faixa_peso` das views `bi.vw_rotas_operacionais_*` acima.
- **Motivo:** garantir painel funcional mesmo se o servidor ainda tiver DDL de views `bi` com nomes antigos (`qtd_volumes`, `count(DISTINCT id_cte)`, etc.). O contrato lógico do BI continua sendo o bloco `CREATE VIEW "bi"."vw_rotas_operacionais_…` neste ficheiro; ver também `scripts/sql/bi_rotas_operacionais_views.sql`.