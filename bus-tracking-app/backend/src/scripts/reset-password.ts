import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword() {
    const email = '2025r6r028@mietjammu.in';

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
        const passwordHash = await bcrypt.hash('password', 12);
        await prisma.user.update({
            where: { email },
            data: { passwordHash }
        });
        console.log(`Password forcefully reset to 'password' for ${email}`);
    } else {
        console.log(`User ${email} does not exist in DB.`);
    }
}

resetPassword().catch(console.error).finally(() => prisma.$disconnect());
