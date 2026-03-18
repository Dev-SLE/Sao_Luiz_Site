const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_ISWe8kUsR6Pm@ep-quiet-mud-adz8wndn-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function insertNotes() {
  try {
    await client.connect();
    console.log('Conectado ao banco Neon');

    // Inserir notas
    const notesQuery = `
      INSERT INTO pendencias.notes (cte, serie, codigo, data, usuario, texto, link_imagem, status_busca) VALUES
      ('CTE001', '001', 'COD001', '2024-03-16T10:00:00Z', 'admin', 'Mercadoria coletada e em trânsito', '', 'EM BUSCA'),
      ('CTE002', '001', 'COD002', '2024-03-16T14:30:00Z', 'operador1', 'Entrega programada para amanhã', '', ''),
      ('CTE003', '001', 'COD003', '2024-03-15T16:45:00Z', 'operador2', 'Aguardando documentação fiscal', '', 'CRITICO');
    `;

    await client.query(notesQuery);
    console.log('Notas inseridas com sucesso');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
    console.log('Conexão fechada');
  }
}

insertNotes();