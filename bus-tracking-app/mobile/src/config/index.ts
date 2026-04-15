/**
 * PERMANENT IP-FREE SERVER CONFIGURATION
 *
 * In development (Expo Go / dev build):
 *   - Automatically reads the IP from the Expo dev server (Constants.expoConfig.hostUri)
 *   - Works on ANY network, ANY machine, WITHOUT changing any code
 *   - Just run `npx expo start` and it self-configures
 *
 * In production:
 *   - Set EXPO_PUBLIC_API_URL environment variable to your server URL
 *   - e.g., EXPO_PUBLIC_API_URL=https://api.yourdomain.com
 */

import Constants from 'expo-constants';

// ─── The only thing you may ever need to change ───────────────────────────────
// Backend port — must match PORT in backend/.env
const SERVER_PORT = 5000;
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Auto-detect the dev machine's IP from Expo's dev server host.
 * This works for both Expo Go and development builds.
 *
 * Expo sets `hostUri` to something like "192.168.29.161:8081"
 * We strip the port and use just the IP.
 */
const getDevServerIP = (): string => {
    try {
        // expo-constants v14+ (SDK 49+)
        const hostUri =
            (Constants.expoConfig as any)?.hostUri ||
            (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
            (Constants as any).manifest?.debuggerHost ||
            '';

        if (hostUri) {
            // hostUri looks like "192.168.X.X:8081" — take only the IP part
            const ip = hostUri.split(':')[0].trim();
            if (ip && ip !== '') {
                console.log(`[Config] Auto-detected server IP: ${ip}`);
                return ip;
            }
        }
    } catch (e) {
        console.warn('[Config] Could not auto-detect IP from Expo host:', e);
    }

    // Last-resort fallback (only reached if not in Expo Go and no env var set)
    console.warn('[Config] Could not auto-detect IP. Falling back to localhost.');
    return '127.0.0.1';
};

// In production, use EXPO_PUBLIC_API_URL env var (e.g. https://api.yourdomain.com)
// In development, auto-detect IP from Expo dev server
const isProduction = !__DEV__;

const resolveBaseUrl = (): string => {
    // Production env var takes priority
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    if (isProduction) {
        // Production without env var — you MUST set EXPO_PUBLIC_API_URL in production
        console.error('[Config] EXPO_PUBLIC_API_URL is not set for production!');
        return 'http://localhost:5000';
    }

    // Development: auto-detect
    const ip = getDevServerIP();
    return `http://${ip}:${SERVER_PORT}`;
};

const BASE_URL = resolveBaseUrl();

export const API_URL = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;

// How long (ms) to keep showing a bus after the driver goes offline
export const BUS_OFFLINE_VISIBLE_MS = 2 * 60 * 1000; // 2 minutes

// Threshold (ms) below which a bus is shown as "live" (green dot)
export const BUS_LIVE_THRESHOLD_MS = 30 * 1000; // 30 seconds

console.log(`[Config] API_URL: ${API_URL}`);
console.log(`[Config] SOCKET_URL: ${SOCKET_URL}`);
