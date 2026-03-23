import streamlit as st
import pandas as pd
import psycopg2
import google.generativeai as genai

# --- CONFIGURAÇÃO DA PÁGINA ---
st.set_page_config(page_title="Torre de Controle - Auditoria", page_icon="🛡️", layout="wide")

NEON_URI = "postgresql://neondb_owner:npg_QFKrfHiVY5e2@ep-withered-dawn-acbx706k.sa-east-1.aws.neon.tech/neondb?sslmode=require"

# ==========================================
# 🔥 IA GENERATIVA - CONFIGURAÇÃO DA CHAVE
# ==========================================
CHAVE_GEMINI = "AIzaSyAWjHFAG2BDgOKNgM8JhES1dxGuvd0PdZQ" 
genai.configure(api_key=CHAVE_GEMINI)

def sugerir_plano_com_ia(agencia, perc, motivo, resumo):
    if not resumo or resumo.strip() == "":
        return "⚠️ Escreva um pequeno resumo do áudio primeiro para a IA poder analisar!"
    
    # Configuração do Cérebro (Busca automática do modelo)
    modelo_ideal = 'gemini-1.5-flash'
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            if 'flash' in m.name:
                modelo_ideal = m.name
                break
                
    model = genai.GenerativeModel(modelo_ideal)
    
    # O Prompt (Com bronca de formatação)
    prompt = f"""
    Você é um Diretor de Logística e Transportes sênior.
    A agência {agencia} está projetando atingir apenas {perc}% da meta de vendas neste mês.
    A causa raiz identificada foi: {motivo}.
    O resumo do que o gerente da ponta nos relatou foi: "{resumo}".
    
    Crie um Plano de Ação prático, em no máximo 4 tópicos curtos e diretos para o Supervisor executar hoje. 
    Seja agressivo na cobrança de resultados, focado em frete e negociação. Não use introduções longas.
    
    REGRAS DE FORMATAÇÃO:
    NÃO use formatação Markdown com asteriscos duplos (**).
    Como o texto será lido no WhatsApp, se quiser destacar algo em negrito, use OBRIGATORIAMENTE apenas UM asterisco de cada lado (*palavra*).
    """
    
    try:
        response = model.generate_content(prompt)
        # 🧹 Limpeza de segurança: Se a IA for teimosa e mandar **, a gente troca por *
        texto_limpo = response.text.replace("**", "*")
        
        # Tira espaços duplos extras que podem ficar ruins na tela
        texto_limpo = texto_limpo.strip() 
        
        return texto_limpo
    except Exception as e:
        return f"❌ Erro ao conectar com a IA: {e}"

# --- FUNÇÕES DE BANCO DE DADOS ---
@st.cache_data(ttl=10)
def puxar_auditorias():
    conn = psycopg2.connect(NEON_URI)
    query = "SELECT * FROM tb_auditoria_metas ORDER BY data_atualizacao DESC"
    df = pd.read_sql(query, conn)
    conn.close()
    return df

def atualizar_auditoria(id_auditoria, status, motivo, resumo, plano):
    conn = psycopg2.connect(NEON_URI)
    cur = conn.cursor()
    query = """
        UPDATE tb_auditoria_metas 
        SET status_auditoria = %s, motivo_queda = %s, resumo_resposta = %s, plano_acao = %s, data_atualizacao = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    cur.execute(query, (status, motivo, resumo, plano, id_auditoria))
    conn.commit()
    cur.close()
    conn.close()

# --- INTERFACE DO SISTEMA ---
st.title("🛡️ Sistema de Auditoria de Conformidade (Metas)")
st.markdown("Bem-vindo à Torre de Controle. Trate os retornos das agências e gere planos de ação com IA.")

df_auditoria = puxar_auditorias()

if df_auditoria.empty:
    st.warning("O banco de dados está vazio. Aguardando o Robô rodar na sexta-feira...")
    st.stop()

# --- VARIÁVEIS DE SESSÃO (Para a IA não apagar ao atualizar a tela) ---
if "plano_ia" not in st.session_state:
    st.session_state.plano_ia = ""

col1, col2 = st.columns([1, 1.2])

with col1:
    st.subheader("📋 Agências Aguardando Tratativa")
    df_pendentes = df_auditoria[df_auditoria['status_auditoria'] == 'Aguardando Retorno']
    
    if df_pendentes.empty:
        st.success("Tudo limpo! Nenhuma agência pendente de auditoria.")
    else:
        st.dataframe(df_pendentes[['id', 'agencia', 'perc_projetado', 'status_auditoria']], hide_index=True, use_container_width=True)
        
    st.markdown("---")
    st.subheader("🗄️ Histórico Completo")
    st.dataframe(df_auditoria[['id', 'agencia', 'status_auditoria', 'data_atualizacao']], hide_index=True, use_container_width=True)

with col2:
    st.subheader("⚙️ Painel de Ação")
    
    lista_ids = df_auditoria['id'].tolist()
    auditoria_selecionada = st.selectbox("Selecione o ID da Auditoria para Tratar:", lista_ids)
    
    if auditoria_selecionada:
        linha = df_auditoria[df_auditoria['id'] == auditoria_selecionada].iloc[0]
        st.info(f"**Tratando:** {linha['agencia']} (Projetado: {linha['perc_projetado']}%)")
        
        # Interface Dinâmica (Sem o form duro)
        status_novo = st.selectbox("Status da Auditoria", ["Aguardando Retorno", "Plano Definido", "Pendente Supervisor", "Resolvido"], index=0 if linha['status_auditoria'] == 'Aguardando Retorno' else 1)
        motivo_novo = st.selectbox("Causa Raiz da Queda", ["Concorrência / Preço", "Cliente Faliu / Parou", "Problema Operacional / Atrasos", "Falta de Veículo", "Mercado Fraco", "Nenhum / Agência Voando"])
        resumo_novo = st.text_area("Resumo do Áudio (O que a agência falou?)", value=linha['resumo_resposta'] if pd.notna(linha['resumo_resposta']) else "")
        
        # 🔥 O BOTÃO MÁGICO DA IA 🔥
        if st.button("✨ Sugerir Plano de Ação com IA"):
            with st.spinner("🧠 O Diretor de IA está analisando o caso..."):
                resposta_ia = sugerir_plano_com_ia(linha['agencia'], linha['perc_projetado'], motivo_novo, resumo_novo)
                st.session_state.plano_ia = resposta_ia
                
        st.markdown("🔥 **Definição da Conformidade**")
        
        # O campo de texto usa o que a IA gerou (ou o que já estava no banco)
        valor_plano_padrao = st.session_state.plano_ia if st.session_state.plano_ia != "" else (linha['plano_acao'] if pd.notna(linha['plano_acao']) else "")
        plano_novo = st.text_area("Plano de Ação (O que o Supervisor DEVE fazer?)", value=valor_plano_padrao, height=200)
        
        st.markdown("---")
        # Botão de Salvar no Banco
        if st.button("💾 Gravar no Banco de Dados (Neon)", type="primary"):
            atualizar_auditoria(auditoria_selecionada, status_novo, motivo_novo, resumo_novo, plano_novo)
            st.session_state.plano_ia = "" # Limpa a memória da IA pra próxima
            st.success("Auditoria salva com sucesso! O Power BI já pode ler os dados.")
            st.rerun()