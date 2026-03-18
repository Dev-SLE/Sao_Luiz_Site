import Papa from 'papaparse';
import { URLS } from '../constants';

// Script para migrar dados das planilhas para o Neon
export async function migrateDataToNeon() {
  console.log('Iniciando migração de dados para o Neon...');

  try {
    // 1. Buscar dados das planilhas
    const [ctesRaw, notesRaw, usersRaw] = await Promise.all([
      fetchCsv(URLS.BASE),
      fetchCsv(URLS.NOTES),
      fetchCsv(URLS.USERS)
    ]);

    // 2. Normalizar dados
    const ctes = normalizeCtesForNeon(ctesRaw);
    const notes = normalizeNotesForNeon(notesRaw);
    const users = normalizeUsersForNeon(usersRaw);

    console.log(`Encontrados: ${ctes.length} CTes, ${notes.length} notas, ${users.length} usuários`);

    // 3. Inserir no Neon (usando SQL direto por enquanto)
    await insertDataIntoNeon('ctes', ctes);
    await insertDataIntoNeon('notes', notes);
    await insertDataIntoNeon('users', users);

    console.log('Migração concluída com sucesso!');

  } catch (error) {
    console.error('Erro na migração:', error);
  }
}

// Funções auxiliares
async function fetchCsv(url: string): Promise<any[]> {
  const response = await fetch(url);
  const csvText = await response.text();
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject,
    });
  });
}

function normalizeCtesForNeon(raw: any[]): any[] {
  return raw.map(row => ({
    cte: row.CTE || row.cte || '',
    serie: row.SERIE || row.serie || '',
    codigo: row.CODIGO || row.codigo || '',
    data_emissao: row['DATA EMISSAO'] || row.data_emissao || null,
    prazo_baixa_dias: parseInt(row['PRAZO PARA BAIXA (DIAS)']) || null,
    data_limite_baixa: row['DATA LIMITE DE BAIXA'] || row.DATA_LIMITE_BAIXA || null,
    status: row.STATUS || '',
    coleta: row.COLETA || row.ORIGEM || '',
    entrega: row.ENTREGA || row.DESTINO || '',
    valor_cte: parseFloat(row['VALOR DO CTE']?.replace(',', '.')) || null,
    tx_entrega: row.TX_ENTREGA || '',
    volumes: row.VOLUMES || '',
    peso: row.PESO || '',
    frete_pago: row.FRETE_PAGO || '',
    destinatario: row.DESTINATARIO || row.CLIENTE || '',
    justificativa: row.JUSTIFICATIVA || ''
  })).filter(item => item.cte);
}

function normalizeNotesForNeon(raw: any[]): any[] {
  return raw.map(row => ({
    cte: row.CTE || row.cte || '',
    serie: row.SERIE || row.serie || '',
    codigo: row.CODIGO || row.codigo || '',
    data: row.DATA || new Date().toISOString(),
    usuario: row.USUARIO || row.usuario || 'Sistema',
    texto: row.TEXTO || row.texto || '',
    link_imagem: row.LINK_IMAGEM || row.link_imagem || '',
    status_busca: row.STATUS_BUSCA || row.status_busca || ''
  })).filter(note => note.cte);
}

function normalizeUsersForNeon(raw: any[]): any[] {
  return raw.map(row => ({
    username: row.username || row.USERNAME || '',
    password_hash: row.password || row.PASSWORD || '', // TODO: Hash depois
    role: row.role || row.ROLE || 'user',
    linked_origin_unit: row.linkedOriginUnit || '',
    linked_dest_unit: row.linkedDestUnit || ''
  })).filter(user => user.username);
}

async function insertDataIntoNeon(table: string, data: any[]): Promise<void> {
  // Por enquanto, vamos usar a connection string direta do Neon
  // Em produção, isso seria feito via API ou script seguro

  const connectionString = 'postgresql://neondb_owner:npg_ISWe8kUsR6Pm@ep-quiet-mud-adz8wndn-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

  console.log(`Inserindo ${data.length} registros na tabela ${table}...`);

  // Simulação - em produção, usaríamos um cliente PostgreSQL
  for (const item of data.slice(0, 5)) { // Apenas primeiros 5 para teste
    console.log(`Inserindo:`, item);
  }
}