import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { logger } from './logger';

export const startExcelWatcher = () => {
    const dataDir = path.join(__dirname, '../../data');
    const studentsPath = path.join(dataDir, 'students.xlsx');
    const driversPath = path.join(dataDir, 'drivers.xlsx');

    if (!fs.existsSync(dataDir)) {
        logger.warn(`Data directory not found for watching: ${dataDir}`);
        return;
    }

    let isSeeding = false;
    let pendingSeed = false;

    const runSeed = () => {
        if (isSeeding) {
            pendingSeed = true;
            return;
        }

        isSeeding = true;
        logger.info('Auto-sync triggered. Updating database from Excel files...');

        // Running seed script
        exec('npm run seed:excel', { cwd: path.join(__dirname, '../../') }, (error, stdout, stderr) => {
            isSeeding = false;

            if (error) {
                logger.error('Error auto-syncing from Excel:', error);
            } else {
                logger.info('✅ Database sync complete!');
                // We don't log stdout to keep the console clean, but we could if needed
            }

            if (pendingSeed) {
                pendingSeed = false;
                runSeed();
            }
        });
    };

    // Keep track of modification times for polling
    let lastMtime: Record<string, number> = {};

    const checkFiles = () => {
        [studentsPath, driversPath].forEach(filePath => {
            try {
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    const mtime = stats.mtime.getTime();

                    if (lastMtime[filePath] && mtime > lastMtime[filePath]) {
                        logger.info(`Polling detected change in: ${path.basename(filePath)}`);
                        runSeed();
                    }
                    lastMtime[filePath] = mtime;
                }
            } catch (e) {
                // Ignore stat errors
            }
        });
    };

    // Watch using fs.watch as primary
    fs.watch(dataDir, (eventType, filename) => {
        if (filename && filename.endsWith('.xlsx')) {
            logger.info(`Event [${eventType}] detected on: ${filename}`);
            runSeed();
        }
    });

    // Fallback polling every 5 seconds (useful for OneDrive/Network drives)
    setInterval(checkFiles, 5000);

    // Initial check to populate mtimes
    [studentsPath, driversPath].forEach(p => {
        if (fs.existsSync(p)) lastMtime[p] = fs.statSync(p).mtime.getTime();
    });

    logger.info(`👀 Monitoring Excel files in: ${dataDir} (Watch + Polling enabled)`);
};
