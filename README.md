# São Luiz Express - Sistema de Pendências

Sistema completo de gestão de pendências migrado do Google Sheets para PostgreSQL (Neon).

## 🚀 Como Rodar Localmente

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
# Editar .env com suas configurações do banco
```

### 3. Iniciar aplicação
```bash
npm run dev
```
Aplicação roda em: http://localhost:3000

## 🌐 Deploy em Produção

### Opção 1: Vercel + Backend Separado (Recomendado)

#### Backend (Railway, Render ou similar):
1. Faça deploy do `server.js` em um serviço como Railway ou Render
2. Configure a variável `DATABASE_URL` com sua string de conexão do Neon
3. Anote a URL do backend (ex: `https://meu-backend.herokuapp.com`)

#### Frontend (Vercel):
1. No painel do Vercel, configure a variável de ambiente:
   ```
   VITE_API_URL=https://meu-backend.herokuapp.com/api
   ```
2. Faça deploy normal do projeto Vite

### Opção 2: Tudo no Vercel (Avançado)
Converter o backend para serverless functions do Vercel.

## 🔧 Arquitetura

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL (Neon)
- **Banco**: Neon PostgreSQL (7 tabelas no schema `pendencias`)

## 📊 Dados Migrados

- **1.146 CTes**
- **1.943 Notas**
- **44 Usuários**
- **3 Perfis**
- **71 Registros de Processo**

## 📝 Funcionalidades

- ✅ Dashboard com métricas
- ✅ Gestão completa de CTes
- ✅ Sistema de notas e anexos
- ✅ Controle de usuários e perfis
- ✅ Gestão de processos e alarmes
- ✅ Interface responsiva

## 🛠️ Scripts Disponíveis

- `npm run dev` - Desenvolvimento frontend
- `npm run build` - Build de produção
- ✅ Lista de CTes com filtros
- ✅ Sistema de notas
- ✅ Controle de usuários
- ✅ Dados em tempo real do Neon

## 🛠 Desenvolvimento

### Adicionar Novos Endpoints
Edite `server.js` para adicionar novas rotas da API.

### Modificar Frontend
Os componentes estão em `components/`, lógica em `context/`.

### Banco de Dados
Use o painel do Neon para gerenciar o banco: https://console.neon.tech
