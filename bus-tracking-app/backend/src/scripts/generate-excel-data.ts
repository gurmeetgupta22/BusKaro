/**
 * generate-excel-data.ts
 *
 * Run ONCE to create the two sample Excel files:
 *   data/students.xlsx
 *   data/drivers.xlsx
 *
 * Usage:
 *   npx ts-node src/scripts/generate-excel-data.ts
 */

import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Students ────────────────────────────────────────────────────────────────
const students = [
    {
        name: 'Aarav Sharma',
        roll_no: 'CS2021001',
        semester: 5,
        department: 'Computer Science',
        bus_no: '1',
        fee_payment: 'PAID',
        email: 'aarav.sharma@college.edu',
        password: 'password',
    },
    {
        name: 'Priya Kapoor',
        roll_no: 'CS2021002',
        semester: 5,
        department: 'Computer Science',
        bus_no: '2',
        fee_payment: 'DUE',
        email: 'priya.kapoor@college.edu',
        password: 'password',
    },
    {
        name: 'Rohit Mehra',
        roll_no: 'ME2021003',
        semester: 3,
        department: 'Mechanical Engineering',
        bus_no: '1',
        fee_payment: 'PAID',
        email: 'rohit.mehra@college.edu',
        password: 'password',
    },
    {
        name: 'Sneha Gupta',
        roll_no: 'EC2022004',
        semester: 2,
        department: 'Electronics',
        bus_no: '3',
        fee_payment: 'OVERDUE',
        email: 'sneha.gupta@college.edu',
        password: 'password',
    },
    {
        name: 'Arjun Singh',
        roll_no: 'CE2022005',
        semester: 4,
        department: 'Civil Engineering',
        bus_no: '2',
        fee_payment: 'PAID',
        email: 'arjun.singh@college.edu',
        password: 'password',
    },
    {
        name: 'Divya Nair',
        roll_no: 'IT2021006',
        semester: 6,
        department: 'Information Technology',
        bus_no: '1',
        fee_payment: 'PAID',
        email: 'divya.nair@college.edu',
        password: 'password',
    },
    {
        name: 'Karan Verma',
        roll_no: 'CS2022007',
        semester: 3,
        department: 'Computer Science',
        bus_no: '3',
        fee_payment: 'DUE',
        email: 'karan.verma@college.edu',
        password: 'password',
    },
    {
        name: 'Ananya Reddy',
        roll_no: 'ME2022008',
        semester: 2,
        department: 'Mechanical Engineering',
        bus_no: '2',
        fee_payment: 'PAID',
        email: 'ananya.reddy@college.edu',
        password: 'password',
    },
];

// ─── Drivers ─────────────────────────────────────────────────────────────────
const drivers = [
    {
        name: 'Ramesh Kumar',
        bus_no: '1',
        email: 'ramesh.kumar@college.edu',
        password: 'password',
        license_number: 'JK-01-2010-0001234',
        phone: '9876543210',
    },
    {
        name: 'Suresh Lal',
        bus_no: '2',
        email: 'suresh.lal@college.edu',
        password: 'password',
        license_number: 'JK-01-2012-0005678',
        phone: '9876543211',
    },
    {
        name: 'Mohan Das',
        bus_no: '3',
        email: 'mohan.das@college.edu',
        password: 'password',
        license_number: 'JK-01-2015-0009012',
        phone: '9876543212',
    },
];

// ─── Write students.xlsx ──────────────────────────────────────────────────────
const studentsWs = XLSX.utils.json_to_sheet(students);
const studentsWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(studentsWb, studentsWs, 'Students');
const studentsPath = path.join(DATA_DIR, 'students.xlsx');
XLSX.writeFile(studentsWb, studentsPath);
console.log(`✓ Created ${studentsPath}`);

// ─── Write drivers.xlsx ───────────────────────────────────────────────────────
const driversWs = XLSX.utils.json_to_sheet(drivers);
const driversWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(driversWb, driversWs, 'Drivers');
const driversPath = path.join(DATA_DIR, 'drivers.xlsx');
XLSX.writeFile(driversWb, driversPath);
console.log(`✓ Created ${driversPath}`);

console.log('\n✅ Excel data files generated successfully in /data folder.');
console.log('   Now run: npx ts-node src/scripts/seed-from-excel.ts');
