import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
    const users = await prisma.user.findMany({
        include: { student: true }
    });
    console.log('--- Current Users in DB ---');
    users.forEach(u => {
        console.log(`Email: ${u.email}, Role: ${u.role}, Name: ${u.student?.fullName || 'N/A'}`);
    });
    process.exit(0);
}

checkUser();
