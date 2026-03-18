import XLSX from 'xlsx';
import pkg from 'pg';
const { Client } = pkg;

// Caminho para a planilha
const EXCEL_FILE = '../Controle de Pendências - São Luiz Express.xlsx';

// Conexão com o banco
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_ISWe8kUsR6Pm@ep-quiet-mud-adz8wndn-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Função para ler uma aba da planilha
function readSheet(sheetName) {
  try {
    const workbook = XLSX.readFile(EXCEL_FILE);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log(`Aba "${sheetName}" não encontrada`);
      return [];
    }
    return XLSX.utils.sheet_to_json(sheet);
  } catch (error) {
    console.error(`Erro ao ler aba ${sheetName}:`, error);
    return [];
  }
}

// Função para converter data serial do Excel para formato ISO (YYYY-MM-DDTHH:MM:SS.sssZ)
function excelDateToISOString(serial) {
  if (typeof serial === 'string' && serial.trim() === '') return null;
  const numSerial = Number(serial);
  if (isNaN(numSerial)) return null;

  // Excel serial date starts from 1900-01-01 (day 1)
  // Ajuste para 1900-01-01 como dia 1 no Excel
  const excelEpoch = new Date(1899, 11, 30); 
  const jsDate = new Date(excelEpoch.getTime() + numSerial * 24 * 60 * 60 * 1000);

  return jsDate.toISOString();
}

// Migração dos CTes
async function migrateCtes() {
  console.log('🔄 Migrando CTes...');
  const rawData = readSheet('BASE');
  if (rawData.length === 0) return;

  const ctes = rawData.map(row => ({
    cte: (row['CTE'] || '').toString(),
    serie: (row['SERIE'] || '1').toString(),
    codigo: (row['CODIGO'] || '').toString(),
    data_emissao: excelDateToISOString(row['DATA EMISSAO']) ? excelDateToISOString(row['DATA EMISSAO']).split('T')[0] : null,
    prazo_baixa_dias: parseInt(row['PRAZO PARA BAIXA (DIAS)']) || null,
    data_limite_baixa: excelDateToISOString(row['DATA LIMITE DE BAIXA']) ? excelDateToISOString(row['DATA LIMITE DE BAIXA']).split('T')[0] : null,
    status: row['STATUS'] || '',
    coleta: row['COLETA'] || '',
    entrega: row['ENTREGA'] || '',
    valor_cte: parseFloat(row['VALOR DO CTE']) || null,
    tx_entrega: row['TX_ENTREGA'] || '',
    volumes: (row['VOLUMES'] || '').toString(),
    peso: (row['PESO'] || '').toString(),
    frete_pago: row['FRETE_PAGO'] || '',
    destinatario: row['DESTINATARIO'] || '',
    justificativa: row['JUSTIFICATIVA'] || ''
  })).filter(cte => cte.cte && cte.cte !== 'CTE'); // Remove header

  console.log(`Encontrados ${ctes.length} CTes`);

  // Limpar tabela
  await client.query('TRUNCATE TABLE pendencias.ctes RESTART IDENTITY');

  // Inserir dados
  for (const cte of ctes) {
    try {
      await client.query(`
        INSERT INTO pendencias.ctes (
          cte, serie, codigo, data_emissao, prazo_baixa_dias, data_limite_baixa,
          status, coleta, entrega, valor_cte, tx_entrega, volumes, peso,
          frete_pago, destinatario, justificativa
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        cte.cte, cte.serie, cte.codigo, cte.data_emissao, cte.prazo_baixa_dias,
        cte.data_limite_baixa, cte.status, cte.coleta, cte.entrega, cte.valor_cte,
        cte.tx_entrega, cte.volumes, cte.peso, cte.frete_pago, cte.destinatario,
        cte.justificativa
      ]);
    } catch (error) {
      console.error(`Erro ao inserir CTE ${cte.cte}:`, error);
    }
  }

  console.log('✅ CTes migrados com sucesso');
}

// Migração das Notas
async function migrateNotes() {
  console.log('🔄 Migrando Notas...');
  const rawData = readSheet('NOTES'); // Aba correta
  if (rawData.length === 0) return;

  const notes = rawData.map(row => ({
    cte: (row['CTE'] || row['cte'] || '').toString(),
    serie: (row['SERIE'] || row['serie'] || '1').toString(),
    codigo: (row['CODIGO'] || row['codigo'] || '').toString(),
    data: excelDateToISOString(row['DATA']) ? excelDateToISOString(row['DATA']) : new Date().toISOString(),
    usuario: row['USUARIO'] || 'Sistema',
    texto: row['TEXTO'] || '',
    link_imagem: row['LINK_IMAGEM'] || '',
    status_busca: '' // Não tem na aba NOTES
  })).filter(note => note.cte && note.cte !== 'CTE' && note.cte !== 'cte'); // Remove header

  console.log(`Encontradas ${notes.length} notas`);

  // Limpar tabela
  await client.query('TRUNCATE TABLE pendencias.notes RESTART IDENTITY');

  // Inserir dados
  for (const note of notes) {
    try {
      await client.query(`
        INSERT INTO pendencias.notes (cte, serie, codigo, data, usuario, texto, link_imagem, status_busca)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [note.cte, note.serie, note.codigo, note.data, note.usuario, note.texto, note.link_imagem, note.status_busca]);
    } catch (error) {
      console.error(`Erro ao inserir nota para CTE ${note.cte}:`, error);
    }
  }

  console.log('✅ Notas migradas com sucesso');
}

// Migração dos Usuários
async function migrateUsers() {
  console.log('🔄 Migrando Usuários...');
  const rawData = readSheet('USERS');
  if (rawData.length === 0) return;

  const users = rawData.map(row => ({
    username: (row['username'] || '').toString(),
    password_hash: row['password'] || '', // Manter plain text como na planilha
    role: row['role'] || 'user',
    linked_origin_unit: row['linkedOriginUnit'] || '',
    linked_dest_unit: row['linkedDestUnit'] || ''
  })).filter(user => user.username && user.username !== 'username'); // Remove header

  console.log(`Encontrados ${users.length} usuários`);

  // Limpar tabela (exceto admin)
  await client.query('DELETE FROM pendencias.users WHERE username != \'admin\'');

  // Inserir dados
  for (const user of users) {
    try {
      await client.query(`
        INSERT INTO pendencias.users (username, password_hash, role, linked_origin_unit, linked_dest_unit)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          linked_origin_unit = EXCLUDED.linked_origin_unit,
          linked_dest_unit = EXCLUDED.linked_dest_unit
      `, [user.username, user.password_hash, user.role, user.linked_origin_unit, user.linked_dest_unit]);
    } catch (error) {
      console.error(`Erro ao inserir usuário ${user.username}:`, error);
    }
  }

  console.log('✅ Usuários migrados com sucesso');
}

// Migração dos Perfis
async function migrateProfiles() {
  console.log('🔄 Migrando Perfis...');
  const rawData = readSheet('PROFILES');
  if (rawData.length === 0) return;

  const profiles = rawData.map(row => ({
    name: (row['NAME'] || '').toString(),
    description: row['DESCRIPTION'] || '',
    permissions: row['PERMISSIONS'] || ''
  })).filter(profile => profile.name && profile.name !== 'NAME'); // Remove header

  console.log(`Encontrados ${profiles.length} perfis`);

  // Limpar tabela
  await client.query('TRUNCATE TABLE pendencias.profiles RESTART IDENTITY');

  // Inserir dados
  for (const profile of profiles) {
    try {
      // Permissions como array
      let permsArray = [];
      if (profile.permissions) {
        permsArray = profile.permissions.split(',').map(p => p.trim());
      }
      await client.query(`
        INSERT INTO pendencias.profiles (name, description, permissions)
        VALUES ($1, $2, $3)
      `, [profile.name, profile.description, permsArray]);
    } catch (error) {
      console.error(`Erro ao inserir perfil ${profile.name}:`, error);
    }
  }

  console.log('✅ Perfis migrados com sucesso');
}

// Migração do Controle de Processo
async function migrateProcessControl() {
  console.log('🔄 Migrando Controle de Processo...');
  const rawData = readSheet('PROCESS_CONTROL');
  if (rawData.length === 0) return;

  const processes = rawData.map(row => ({
    cte: (row['CTE'] || '').toString(),
    serie: (row['SERIE'] || '1').toString(),
    data: excelDateToISOString(row['DATA']) ? excelDateToISOString(row['DATA']) : new Date().toISOString(),
    user_name: (row['USER'] ? String(row['USER']) : 'Sistema').trim(),
    description: row['DESCRIPTION'] || '',
    link: row['LINK_IMAGEM'] || '',
    status: row['STATUS'] || ''
  })).filter(proc => proc.cte && proc.cte !== 'CTE'); // Remove header

  console.log(`Encontrados ${processes.length} registros de processo`);

  // Limpar tabela
  await client.query('TRUNCATE TABLE pendencias.process_control RESTART IDENTITY');

  // Inserir dados
  for (const proc of processes) {
    try {
      await client.query(`
        INSERT INTO pendencias.process_control (cte, serie, data, user_name, description, link, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [proc.cte, proc.serie, proc.data, proc.user_name, proc.description, proc.link, proc.status]);
    } catch (error) {
      console.error(`Erro ao inserir processo para CTE ${proc.cte}:`, error);
    }
  }

  console.log('✅ Controle de Processo migrado com sucesso');
}

// Migração dos Logs
async function migrateLogs() {
  console.log('🔄 Migrando Logs...');
  const rawData = readSheet('_LOGS');
  if (rawData.length === 0) return;

  const logs = rawData.map(row => ({
    action: row['MENSAGEM'] || '',
    table_name: '', // Não tem na planilha
    record_id: null, // Não tem
    user_name: row['DADOS'] || 'Sistema', // Última coluna
    old_values: {}, // Não tem
    new_values: {}, // Não tem
    created_at: excelDateToISOString(row['DATA']) ? excelDateToISOString(row['DATA']) : new Date().toISOString()
  })).filter(log => log.action); // Remove vazios

  console.log(`Encontrados ${logs.length} logs`);

  // Limpar tabela
  await client.query('TRUNCATE TABLE pendencias.logs RESTART IDENTITY');

  // Inserir dados
  for (const log of logs) {
    try {
      await client.query(`
        INSERT INTO pendencias.logs (action, table_name, record_id, user_name, old_values, new_values, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [log.action, log.table_name, log.record_id, log.user_name, log.old_values, log.new_values, log.created_at]);
    } catch (error) {
      console.error(`Erro ao inserir log:`, error);
    }
  }

  console.log('✅ Logs migrados com sucesso');
}

// Função principal
async function migrateAllData() {
  try {
    await client.connect();
    console.log('🚀 Iniciando migração completa dos dados...');

    await migrateCtes();
    await migrateNotes();
    await migrateUsers();
    await migrateProfiles();
    await migrateProcessControl();
    await migrateGlobalSettings();
    await migrateLogs();

    console.log('🎉 Migração completa realizada com sucesso!');

    // Verificar totais
    const ctesCount = await client.query('SELECT COUNT(*) as total FROM pendencias.ctes');
    const notesCount = await client.query('SELECT COUNT(*) as total FROM pendencias.notes');
    const usersCount = await client.query('SELECT COUNT(*) as total FROM pendencias.users');
    const profilesCount = await client.query('SELECT COUNT(*) as total FROM pendencias.profiles');
    const processCount = await client.query('SELECT COUNT(*) as total FROM pendencias.process_control');
    const settingsCount = await client.query('SELECT COUNT(*) as total FROM pendencias.global_settings');
    const logsCount = await client.query('SELECT COUNT(*) as total FROM pendencias.logs');

    console.log('\n📊 Totais migrados:');
    console.log(`CTEs: ${ctesCount.rows[0].total}`);
    console.log(`Notas: ${notesCount.rows[0].total}`);
    console.log(`Usuários: ${usersCount.rows[0].total}`);
    console.log(`Perfis: ${profilesCount.rows[0].total}`);
    console.log(`Process Control: ${processCount.rows[0].total}`);
    console.log(`Global Settings: ${settingsCount.rows[0].total}`);
    console.log(`Logs: ${logsCount.rows[0].total}`);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await client.end();
  }
}

// Executar migração
migrateAllData();