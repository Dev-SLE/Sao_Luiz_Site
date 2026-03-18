const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_ISWe8kUsR6Pm@ep-quiet-mud-adz8wndn-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function insertTestData() {
  try {
    await client.connect();
    console.log('Conectado ao banco Neon');

    // Inserir CTes
    const ctesQuery = `
      INSERT INTO pendencias.ctes (cte, serie, codigo, data_emissao, prazo_baixa_dias, data_limite_baixa, status, coleta, entrega, valor_cte, tx_entrega, volumes, peso, frete_pago, destinatario, justificativa) VALUES
      ('CTE001', '001', 'COD001', '2024-03-15', 5, '2024-03-20', 'PENDENTE', 'São Paulo', 'Rio de Janeiro', 1500.00, 'Entrega normal', '2', '50kg', 'Pago', 'Cliente A', ''),
      ('CTE002', '001', 'COD002', '2024-03-16', 3, '2024-03-19', 'EM TRANSITO', 'São Paulo', 'Belo Horizonte', 2200.00, 'Entrega expressa', '3', '75kg', 'Pago', 'Cliente B', ''),
      ('CTE003', '001', 'COD003', '2024-03-14', 7, '2024-03-21', 'CRITICO', 'São Paulo', 'Salvador', 3200.00, 'Entrega normal', '5', '120kg', 'Pendente', 'Cliente C', 'Aguardando liberação fiscal');
    `;

    await client.query(ctesQuery);
    console.log('CTes inseridos com sucesso');

    // Inserir usuários
    const usersQuery = `
      INSERT INTO pendencias.users (username, password_hash, role, linked_origin_unit, linked_dest_unit) VALUES
      ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '', ''),
      ('operador1', '$2b$10$hashed_password_here', 'operator', 'São Paulo', 'Rio de Janeiro'),
      ('operador2', '$2b$10$hashed_password_here', 'operator', 'São Paulo', 'Belo Horizonte');
    `;

    await client.query(usersQuery);
    console.log('Usuários inseridos com sucesso');

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

insertTestData();