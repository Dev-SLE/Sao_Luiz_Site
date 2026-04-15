# SÃO LUIZ EXPRESS — AJUSTES FINAIS DO WORKSPACE (SIDEBAR + MAPA DE MÓDULOS + NAVEGAÇÃO)

## CONTEXTO

A base do workspace modular já foi encontrada e aprovada:

* sidebar global por módulos
* grupos por camada
* submenus internos por módulo
* layouts por módulo
* CRM com tratamento de largura mais denso
* estrutura geral validada

Agora o foco NÃO é mais reinventar a arquitetura.

Agora o foco é:

1. acabamento visual
2. usabilidade
3. distribuição correta dos itens
4. aderência total ao mapa de módulos da Fase 1
5. remoção de itens errados, vazios ou fora do lugar

---

# OBJETIVO FINAL

Fechar a navegação do workspace para que ela pareça:

* produto premium
* clara
* confortável
* organizada por domínio
* sem aparência improvisada

A sidebar deve parecer:

* moderna
* compacta
* forte
* com hierarquia clara
* sem apertar texto, badges ou setas

---

# PROBLEMAS ATUAIS A CORRIGIR

## 1. SETA / EXPANSÃO

* o botão/seta de expandir submenu está mal posicionado
* ele parece um bloco separado e estranho
* compete visualmente com o item principal
* não parece parte natural da navegação

## 2. LARGURA DA SIDEBAR

* a sidebar ainda está estreita demais
* labels ficam espremidos
* badges apertam o layout
* alguns módulos ficam com aparência comprimida

## 3. CONTRASTE / ESTADOS

* em alguns estados, texto branco sobre fundo claro fica ruim
* subitens ativos/inativos precisam de contraste melhor
* hover, active e expanded precisam ser mais legíveis

## 4. HIERARQUIA ERRADA

* há itens aparecendo no módulo errado
* há subitens em local incorreto
* há itens que deveriam estar em outro grupo/camada

## 5. ITENS INCOMPLETOS OU VAZIOS

* alguns módulos aparecem mas ainda não têm conteúdo real
* alguns submenus estão vazios ou fora do escopo atual
* isso polui a navegação e passa sensação de sistema incompleto

## 6. FASE 1 NÃO REFLETIDA 100%

* o menu ainda não segue exatamente o mapa que definimos nas camadas
* é preciso alinhar a navegação ao modelo de módulos acordado

---

# DIRETRIZ PRINCIPAL

## A SIDEBAR DEVE SER REFINADA, NÃO REINVENTADA

Não destruir a estrutura atual.
Não voltar para o menu antigo.
Não transformar novamente em menu de páginas soltas.

A base correta já foi encontrada.

Agora é:

* polir
* reorganizar
* alinhar com o mapa correto

---

# AJUSTES VISUAIS OBRIGATÓRIOS

## 1. LARGURA DA SIDEBAR DESKTOP

Aumentar a largura da sidebar expandida.

### alvo recomendado:

* colapsada: 84px a 92px
* expandida: 250px a 280px

Objetivo:

* labels respirarem melhor
* badges não esmagarem o texto
* ícones + texto + contador coexistirem bem

---

## 2. BOTÃO DE EXPANSÃO DO GRUPO

Redesenhar o comportamento da seta de submenu.

### Regras:

* a seta não deve parecer um botão separado “solto”
* ela deve fazer parte do item do módulo
* pode ficar:

  * embutida à direita do item principal
  * ou como ícone discreto dentro da própria linha

### Não fazer:

* bloco isolado ao lado esquerdo
* botão separado parecendo gambiarra

### Fazer:

* linha inteira do módulo clicável
* área da seta menor e elegante
* animação suave de rotação

---

## 3. ESTILO DOS ITENS DE MÓDULO

Cada item principal de módulo deve ter aparência premium.

### Visual desejado:

* fundo escuro consistente
* borda sutil
* cantos arredondados
* destaque ativo elegante
* badge de contagem bem encaixado

### Regras:

* reduzir sensação de “botão pesado”
* menos cara de card
* mais cara de navegação de produto

---

## 4. SUBITENS

Os subitens devem ter:

* recuo claro
* altura menor
* tipografia mais leve
* badge menor
* hover discreto
* active state forte mas limpo

### Não usar:

* subitem com aparência igual ao item principal
* branco estourado
* contraste ruim

### Ideal:

* subitem ativo com fundo translúcido ou highlight interno
* linha lateral opcional
* boa leitura em dark/navy background

---

## 5. CONTRASTE E CORES

Padronizar estados:

### Item principal ativo:

* fundo azul mais vivo
* outline/borda discreta
* badge vermelha consistente

### Item principal inativo:

* azul escuro homogêneo
* hover mais claro

### Subitem ativo:

* fundo azul translúcido
* texto branco forte
* badge vermelha menor ou branco/azul de apoio

### Subitem inativo:

* texto branco com opacidade controlada
* hover sem estourar

### Corrigir:

* qualquer texto branco sobre fundo quase branco
* qualquer estado “lavado”

---

# REORGANIZAÇÃO FINAL DO MENU

## O menu deve seguir EXATAMENTE este mapa:

---

## CAMADA 1 — NÚCLEO TRANSACIONAL

Módulos:

* Operacional
* Manifestos e CTEs
* CRM
* Comercial
* Clientes e Tabelas de Preço
* Patrimônio

### Operacional — subitens:

* Visão geral
* Pendências
* Críticos
* Em busca
* Ocorrências
* Rastreio
* Concluídos

### Manifestos e CTEs — subitens:

* Painel geral
* CTEs
* MDF-e / Manifestos
* Emissão
* Cancelamentos
* Encerramentos
* Rejeições
* Eventos SEFAZ
* Histórico

### CRM — subitens:

* Dashboard
* Funil
* Chat IA
* Minhas pendências
* Contato 360
* Relatórios
* Operação CRM
* Privacidade

### Comercial — subitens:

* Dashboard comercial
* Metas e performance
* Comissões
* Auditoria de comissões
* Simulador de metas
* Campanhas comerciais
* Ranking
* Parcerias / novos negócios

### Clientes e Tabelas de Preço — subitens:

* Clientes
* Grupos econômicos
* Contratos
* Tabelas de preço
* Regras tarifárias
* Simulações
* Reajustes
* Aprovação de tabela

### Patrimônio — subitens:

* Dashboard patrimonial
* Cadastro patrimonial
* Etiquetas / QR
* Movimentações
* Responsáveis
* Inventário
* Transferências
* Manutenção
* Baixas
* Auditoria patrimonial

---

## CAMADA 2 — ADMINISTRAÇÃO E PESSOAS

Módulos:

* Financeiro
* Fiscal
* DP / RH
* Compras e Suprimentos
* Jurídico / Compliance

### Financeiro — subitens:

* Dashboard financeiro
* Contas a pagar
* Contas a receber
* Fluxo de caixa
* Conciliação bancária
* Tesouraria
* Centros de custo
* Inadimplência
* Aprovações
* Fechamento
* Relatórios

### Fiscal — subitens:

* Painel fiscal
* Documentos fiscais
* Tributos
* Apuração
* Conferências
* Obrigações
* Inconsistências
* Logs fiscais

### DP / RH — subitens:

* Colaboradores
* Admissão / onboarding
* Cargos e salários
* Benefícios
* Férias
* Avaliações
* Treinamentos internos
* Ponto
* Escalas
* Banco de horas
* Holerites
* Folha
* Afastamentos
* Rescisões

### Compras e Suprimentos — subitens:

* Solicitações
* Cotações
* Aprovações
* Pedidos
* Fornecedores
* Recebimentos
* Contratos

### Jurídico / Compliance — subitens:

* Contratos
* Procurações
* Dossiês
* Indenizações
* Prazos
* Auditoria interna
* Compliance documental

---

## CAMADA 3 — GESTÃO E INTELIGÊNCIA

Módulos:

* Gerencial
* Auditoria e Controle

### Gerencial — subitens:

* Visão executiva
* Comercial BI
* Operacional BI
* Financeiro BI
* RH BI
* Fiscal BI
* Patrimônio BI
* Indicadores por unidade
* Alertas
* Tendências
* Projeções

### Auditoria e Controle — subitens:

* Logs do sistema
* Trilha por usuário
* Auditoria financeira
* Auditoria fiscal
* Auditoria patrimonial
* Auditoria de comissões
* Inconsistências

---

## CAMADA 4 — PORTAL CORPORATIVO

Módulos:

* Portal do Colaborador
* Portal do Gestor

### Portal do Colaborador — subitens:

* Início
* Comunicados
* Documentos
* Treinamentos
* Campanhas
* Agenda
* Suporte
* Meu perfil
* Meu ponto
* Minha escala
* Holerite
* Ouvidoria
* Solicitações

### Portal do Gestor — subitens:

* Minha equipe
* Escalas da equipe
* Aprovações
* Pendências do setor
* Comunicados do setor
* Indicadores rápidos
* Solicitações do time

---

# REGRAS DE VISIBILIDADE

## Importante

Nem todo item precisa aparecer imediatamente se ainda não estiver implementado.

### Criar dois estados:

1. IMPLEMENTADO
2. PLANEJADO

### Regra:

* itens implementados aparecem normalmente
* itens planejados podem:

  * ficar ocultos por padrão
  * ou aparecer com estado visual “em breve”, se isso for estratégico

### Não fazer:

* mostrar submenu vazio
* mostrar item quebrado
* deixar usuário entrar em rota sem conteúdo

---

# COMPORTAMENTO DE EXPANSÃO

## Regra por módulo

* apenas 1 grupo expandido por vez dentro de cada camada, se isso deixar a navegação mais limpa
* ao entrar numa rota filha, o módulo pai abre automaticamente
* ao trocar de módulo, o submenu correto expande
* módulos sem subitens implementados não devem abrir submenu vazio

---

# AJUSTES DE ESPAÇAMENTO

## Sidebar expandida

* mais respiro lateral
* menos compressão vertical
* melhorar distância entre:

  * ícone
  * label
  * badge
  * seta

## Subitens

* reduzir espaço excessivo
* mas manter leitura boa
* não deixar muito colado

---

# AJUSTES ESPECÍFICOS PARA O CRM

O módulo CRM é mais denso e o menu não pode atrapalhar.

### Regras:

* ao entrar no CRM, sidebar pode:

  * continuar presente, mas mais compacta
  * ou usar comportamento colapsado automático opcional
* preservar mais largura útil para o chat e o funil
* evitar que a navegação coma a área central

---

# ESTRUTURA TÉCNICA

## Ajustar o manifesto de navegação

Revisar a fonte principal da sidebar, hoje montada com:

* buildWorkspaceNavSections
* navigation-manifest
* children por módulo
* counts dinâmicos

Ajustar esses manifests para refletirem exatamente o mapa acima.

## Sidebar.tsx

Refatorar:

* renderNavItemRow
* renderSection
* regras de expandedGroups
* widths
* classes visuais
* integração da seta dentro do item principal
* tratamento de estado ativo/inativo/expanded

## WorkspaceApp

Manter a base atual.
Não desmontar o que já foi feito.
Ajustar apenas integração com:

* largura útil por módulo
* CRM com maior prioridade de espaço
* comportamento global refinado

---

# ENTREGA ESPERADA

## O resultado final deve ser:

* sidebar mais larga e confortável
* seta elegante e integrada
* contadores bem encaixados
* contraste corrigido
* módulos no lugar certo
* subitens no lugar certo
* sem itens vazios ou quebrados
* alinhado com a Fase 1
* pronto para crescer sem virar bagunça

---

# ORDEM DE EXECUÇÃO

## Etapa 1

* corrigir largura da sidebar
* corrigir contraste
* redesenhar seta/expand
* melhorar badges

## Etapa 2

* corrigir manifesto de navegação
* distribuir módulos/subitens corretamente
* remover itens errados
* marcar itens planejados

## Etapa 3

* ajustar comportamento do CRM
* melhorar densidade visual
* validar desktop e mobile

## Etapa 4

* revisar acabamento final
* hover
* active
* expanded
* responsividade
* estados vazios

---

## Estado de implementação (workspace)

| Área | Subitem / rota | Estado |
|------|----------------|--------|
| Operacional | `/app/operacional` (painel) | Implementado |
| Operacional | `/app/operacional/ocorrencias` | Implementado |
| Operacional | `/app/operacional/rotas` | Implementado |
| Operacional | `/app/operacional/veiculos` | Implementado |
| Operacional | `/app/operacional/motoristas` | Implementado |
| Operacional | `/app/operacional/escalas` | Implementado |
| Operacional | `/app/operacional/entregas` | Implementado |
| Operacional | `/app/operacional/auditoria` | Implementado |
| Manifestos e CTEs | `/app/manifestos` | Implementado |
| Manifestos e CTEs | Demais subitens do doc | Planejado (sem rota dedicada) |
| CRM | `/app/crm` (funil, chat, pendências) | Implementado |
| Comercial | `/app/comercial` (metas) | Implementado |
| Comercial | `/app/comercial/auditoria` | Implementado |
| Comercial | Demais subitens do doc | Planejado (sem rota dedicada) |
| Clientes e tabelas | `/app/clientes` | Implementado |
| Clientes e tabelas | Demais subitens do doc | Planejado (sem rota dedicada) |
| Patrimônio | `/app/patrimonio` | Implementado |
| Patrimônio | Demais subitens do doc | Planejado (sem rota dedicada) |
| Financeiro / Fiscal / DP / Compras / Jurídico / Gerencial / Auditoria | `/app/<módulo>` | Implementado (stub por módulo) |
| Portal colaborador | Rotas `/inicio`, `/comunicados`, etc. | Implementado (fora do `/app`) |
| Portal gestor | Rotas `/gestor/...` | Implementado (fora do `/app`) |

O menu lateral do workspace lista apenas entradas com `href` válido; itens **planejados** sem rota não aparecem por defeito (`NEXT_PUBLIC_SHOW_PLANNED_NAV=1` para exibir com estilo “Em breve”).

---

# REGRA FINAL

Não voltar para o menu antigo.
Não simplificar demais.
Não quebrar a estrutura modular.

A missão agora é:
refinar, organizar e fechar o workspace definitivamente.
