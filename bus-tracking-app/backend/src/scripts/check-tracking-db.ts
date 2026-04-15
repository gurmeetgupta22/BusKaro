import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function checkLink() {
    const buses = await prisma.bus.findMany({ include: { driver: true } });
    let out = '--- BUSES ---\n';
    buses.forEach(b => {
        out += `B[${b.busNumber}] ID: ${b.id.substring(0, 8)}, Dr: ${b.driver?.fullName || 'NONE'}, Lat: ${b.currentLat}, Lng: ${b.currentLng}, Stat: ${b.status}\n`;
    });

    const drivers = await prisma.driver.findMany({ include: { assignedBus: true } });
    out += '\n--- DRIVERS ---\n';
    drivers.forEach(d => {
        out += `D[${d.fullName}] ID: ${d.id.substring(0, 8)}, BusID: ${d.assignedBusId?.substring(0, 8) || 'NONE'}\n`;
    });

    fs.writeFileSync('db_status.txt', out);
    console.log('Wrote to db_status.txt');
    process.exit(0);
}

checkLink();
