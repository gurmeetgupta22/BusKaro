import path from 'path';
import * as XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SALT_ROUNDS = 12;

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────────*/
function readSheet<T>(filename: string, sheetName: string): any[] {
    const filePath = path.join(DATA_DIR, filename);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found in ${filename}`);
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    // Common column aliases to handle user typos
    const aliases: Record<string, string[]> = {
        name: ['name', 'full name', 'student name', 'driver name', 'fullname'],
        email: ['email', 'emaill', 'e-mail', 'mail', 'user email', 'email id'],
        password: ['password', 'pass', 'pwd', 'passphrase'],
        roll_no: ['roll_no', 'roll number', 'roll no', 'rollno', 'student id'],
        bus_no: ['bus_no', 'bus number', 'bus no', 'busno', 'assigned bus'],
        department: ['department', 'dept', 'branch', 'course'],
        semester: ['semester', 'sem', 'year'],
        fee_payment: ['fee_payment', 'fee', 'payment', 'fee status', 'fee_paymentstatus', 'fee payment'],
        license_number: ['license_number', 'license', 'license no', 'licence'],
        phone: ['phone', 'mobile', 'contact', 'phone number', 'phone_number']
    };

    return rows.map(r => {
        const normalized: any = {};
        for (const rawKey of Object.keys(r)) {
            const cleanKey = rawKey.trim().toLowerCase();

            // Look for alias match
            let matchedKey = cleanKey;
            for (const [canonical, variants] of Object.entries(aliases)) {
                if (variants.includes(cleanKey)) {
                    matchedKey = canonical;
                    break;
                }
            }
            normalized[matchedKey] = r[rawKey];
        }
        return normalized;
    });
}

type FeeStatus = 'PAID' | 'DUE' | 'OVERDUE';

function mapFeeStatus(raw: any): FeeStatus {
    const val = (raw?.toString() || 'DUE').trim().toUpperCase();
    if (val === 'PAID') return 'PAID';
    if (val === 'OVERDUE') return 'OVERDUE';
    return 'DUE';
}

/* ──────────────────────────────────────────────────────────────────────────
   Sync Students
   ─────────────────────────────────────────────────────────────────────────*/
interface StudentRow {
    name: string;
    roll_no: string;
    semester: number;
    department: string;
    bus_no: string;
    fee_payment: string;
    email: string;
    password: string;
}

async function seedStudents() {
    console.log('\n📚 Syncing students from students.xlsx …');
    const rows = readSheet<StudentRow>('students.xlsx', 'Students');

    // Valid emails in the excel (case-insensitive search)
    const excelEmails = rows.map(r => r.email?.toString().trim().toLowerCase()).filter(Boolean);

    // Find users to delete (exist in DB as STUDENT but not in Excel)
    const dbStudents = await prisma.user.findMany({
        where: { role: 'STUDENT' },
    });

    let deleted = 0;
    for (const dbUser of dbStudents) {
        if (!excelEmails.includes(dbUser.email.toLowerCase())) {
            await prisma.user.delete({ where: { id: dbUser.id } });
            deleted++;
            console.log(`  🗑 Deleted removed student: ${dbUser.email}`);
        }
    }

    // Also sync buses
    const busNumbers = [...new Set(rows.map((r) => r.bus_no?.toString().trim()).filter(Boolean))];
    for (const busNumber of busNumbers) {
        const existing = await prisma.bus.findUnique({ where: { busNumber } });
        if (!existing) {
            await prisma.bus.create({
                data: {
                    busNumber,
                    routeName: `Route ${busNumber}`,
                    capacity: 50,
                },
            });
            console.log(`  🚌 Bus created: Bus ${busNumber}`);
        }
    }

    let created = 0;
    let updated = 0;

    for (const row of rows) {
        const email = row.email?.toString().trim();
        if (!email) continue;

        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            // Update student record
            const s = await prisma.student.findUnique({ where: { userId: existingUser.id } });
            if (s) {
                await prisma.student.update({
                    where: { id: s.id },
                    data: {
                        fullName: row.name?.toString().trim() || 'Student',
                        rollNumber: row.roll_no?.toString().trim() || s.rollNumber,
                        semester: Number(row.semester) || 1,
                        department: row.department?.toString().trim() || 'General',
                        feeStatus: mapFeeStatus(row.fee_payment?.toString())
                    }
                });
            }
            updated++;
            console.log(`  ↻ Updated student: ${row.name} (${email})`);
        } else {
            // Create user
            const passwordHash = await bcrypt.hash(row.password && row.password.toString().trim() !== '' ? row.password.toString() : 'password', SALT_ROUNDS);
            await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email,
                        passwordHash,
                        role: 'STUDENT',
                    },
                });

                await tx.student.create({
                    data: {
                        userId: user.id,
                        fullName: row.name?.toString().trim() || 'Student',
                        rollNumber: row.roll_no?.toString().trim() || `ROLL-${Date.now()}`,
                        semester: Number(row.semester) || 1,
                        department: row.department?.toString().trim() || 'General',
                        feeStatus: mapFeeStatus(row.fee_payment?.toString()),
                        feeDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                });
            });
            created++;
            console.log(`  ✓ Created student: ${row.name} (${email})`);
        }
    }

    console.log(`  → ${created} created, ${updated} updated, ${deleted} deleted.`);
}

/* ──────────────────────────────────────────────────────────────────────────
   Sync Drivers
   ─────────────────────────────────────────────────────────────────────────*/
interface DriverRow {
    name: string;
    bus_no: string;
    email: string;
    password: string;
    license_number: string;
    phone: string;
}

async function seedDrivers() {
    console.log('\n🚗 Syncing drivers from drivers.xlsx …');
    const rows = readSheet<DriverRow>('drivers.xlsx', 'Drivers');

    // Valid emails in the excel (case-insensitive)
    const excelEmails = rows.map(r => r.email?.toString().trim().toLowerCase()).filter(Boolean);

    // Find users to delete
    const dbDrivers = await prisma.user.findMany({
        where: { role: 'DRIVER' },
    });

    let deleted = 0;
    for (const dbUser of dbDrivers) {
        if (!excelEmails.includes(dbUser.email.toLowerCase())) {
            await prisma.user.delete({ where: { id: dbUser.id } });
            deleted++;
            console.log(`  🗑 Deleted removed driver: ${dbUser.email}`);
        }
    }

    let created = 0;
    let updated = 0;

    for (const row of rows) {
        const email = row.email?.toString().trim();
        if (!email) continue;

        const existingUser = await prisma.user.findUnique({ where: { email } });

        let busId = null;
        if (row.bus_no) {
            const busNumber = row.bus_no?.toString().trim();
            let bus = await prisma.bus.findUnique({ where: { busNumber } });
            if (!bus) {
                bus = await prisma.bus.create({
                    data: { busNumber, routeName: `Route ${busNumber}`, capacity: 50 },
                });
            }
            busId = bus.id;
        }

        if (existingUser) {
            const d = await prisma.driver.findUnique({ where: { userId: existingUser.id } });
            if (d) {
                await prisma.driver.update({
                    where: { id: d.id },
                    data: {
                        fullName: row.name?.toString().trim() || 'Driver',
                        licenseNumber: row.license_number?.toString().trim() || d.licenseNumber,
                        phoneNumber: row.phone?.toString().trim() || '0000000000',
                        assignedBusId: busId
                    }
                });
            }
            updated++;
            console.log(`  ↻ Updated driver: ${row.name} (${email})`);
        } else {
            const passwordHash = await bcrypt.hash(row.password && row.password.toString().trim() !== '' ? row.password.toString() : 'password', SALT_ROUNDS);
            await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: { email, passwordHash, role: 'DRIVER' },
                });
                await tx.driver.create({
                    data: {
                        userId: user.id,
                        fullName: row.name?.toString().trim() || 'Driver',
                        licenseNumber: row.license_number?.toString().trim() || `LIC-${Date.now()}`,
                        phoneNumber: row.phone?.toString().trim() || '0000000000',
                        assignedBusId: busId,
                    },
                });
            });
            created++;
            console.log(`  ✓ Created driver: ${row.name} (${email})`);
        }
    }

    console.log(`  → ${created} created, ${updated} updated, ${deleted} deleted.`);
}

/* ──────────────────────────────────────────────────────────────────────────
   Main
   ─────────────────────────────────────────────────────────────────────────*/
async function main() {
    console.log('══════════════════════════════════════════════');
    console.log(' 🌱  Excel ↔ PostgreSQL Two-Way Sync');
    console.log('══════════════════════════════════════════════');

    try {
        await seedStudents();
        await seedDrivers();
        console.log('\n✅ Sync complete!\n');
    } catch (error) {
        console.error('\n❌ Sync failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
