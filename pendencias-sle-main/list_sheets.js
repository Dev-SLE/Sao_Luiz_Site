import XLSX from 'xlsx';

const EXCEL_FILE = '../Controle de Pendências - São Luiz Express.xlsx';

try {
  const workbook = XLSX.readFile(EXCEL_FILE);
  console.log('Abas encontradas:');
  workbook.SheetNames.forEach(name => console.log(`- ${name}`));
} catch (error) {
  console.error('Erro ao ler planilha:', error);
}