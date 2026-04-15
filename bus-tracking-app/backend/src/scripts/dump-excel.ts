import * as XLSX from 'xlsx';
import path from 'path';

const filePath = path.join(__dirname, '..', '..', 'data', 'students.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['Students'];
const data = XLSX.utils.sheet_to_json<any>(sheet);

console.log('--- Students in students.xlsx ---');
data.forEach(row => {
    console.log(`Name: ${row.name}, Email: ${row.email}, Password: ${row.password}`);
});
process.exit(0);
