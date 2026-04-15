import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { logger } from './logger';

const DATA_DIR = path.join(__dirname, '../../data');

/**
 * Updates the password for a user in the respective Excel file
 */
export const updatePasswordInExcel = async (email: string, newPassword: string, role: 'STUDENT' | 'DRIVER' | 'ADMIN') => {
    try {
        const filename = role === 'STUDENT' ? 'students.xlsx' : 'drivers.xlsx';
        const sheetName = role === 'STUDENT' ? 'Students' : 'Drivers';
        const filePath = path.join(DATA_DIR, filename);

        if (!fs.existsSync(filePath)) {
            logger.warn(`Excel file not found for password update: ${filePath}`);
            return;
        }

        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            logger.warn(`Sheet ${sheetName} not found in ${filename}`);
            return;
        }

        const data = XLSX.utils.sheet_to_json<any>(sheet);

        // Find user by email (case-insensitive)
        let found = false;

        const aliases = {
            email: ['email', 'emaill', 'e-mail', 'mail', 'user email', 'email id'],
            password: ['password', 'pass', 'pwd', 'passphrase']
        };

        const updatedData = data.map(row => {
            // Find email column key
            let emailKey = null;
            let passwordKey = null;

            for (const key of Object.keys(row)) {
                const cleanKey = key.trim().toLowerCase();
                if (aliases.email.includes(cleanKey)) emailKey = key;
                if (aliases.password.includes(cleanKey)) passwordKey = key;
            }

            if (emailKey && row[emailKey]?.toString().trim().toLowerCase() === email.toLowerCase()) {
                found = true;
                if (passwordKey) {
                    row[passwordKey] = newPassword;
                } else {
                    // If password column doesn't exist, we might need to add it, 
                    // but usually it exists. If not, we handle it as per user requirement (empty/existing behavior).
                    row['password'] = newPassword;
                }
            }
            return row;
        });

        if (!found) {
            logger.warn(`User ${email} not found in ${filename} for password update`);
            return;
        }

        const newSheet = XLSX.utils.json_to_sheet(updatedData);
        workbook.Sheets[sheetName] = newSheet;

        // Write back to file
        XLSX.writeFile(workbook, filePath);
        logger.info(`✅ Updated password for ${email} in ${filename}`);

    } catch (error) {
        logger.error(`Failed to update password in Excel for ${email}:`, error);
    }
};
