import type { ServiceAccount } from "firebase-admin";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const logger = {
    debug: (...args: any[]) => console.debug('[Vercel]', ...args),
    info: (...args: any[]) => console.log('[Vercel]', ...args),
    error: (...args: any[]) => console.error('[Vercel]', ...args)
};

logger.info('[Firebase-Server] Starting initialization');

// Helper to get env vars with fallback to import.meta.env
const getEnvVar = (key: string): string | undefined => {
    return process.env[key] || import.meta.env[key];
};

logger.debug('[Firebase-Server] Config:', {
    projectId: getEnvVar('FIREBASE_PROJECT_ID'),
    hasClientEmail: !!getEnvVar('FIREBASE_CLIENT_EMAIL'),
    hasPrivateKey: !!getEnvVar('FIREBASE_PRIVATE_KEY')
});

// Parse private key - handle both quoted and unquoted formats
const parsePrivateKey = (key: string | undefined) => {
    if (!key) return undefined;
    // Remove wrapping quotes if they exist and unescape \n
    return key.replace(/\\n/g, '\n')
        .replace(/^"(.*)"$/, '$1');
};

const activeApps = getApps();
const serviceAccount = {
    type: "service_account",
    project_id: getEnvVar('FIREBASE_PROJECT_ID'),
    private_key_id: getEnvVar('FIREBASE_PRIVATE_KEY_ID'),
    private_key: parsePrivateKey(getEnvVar('FIREBASE_PRIVATE_KEY')),
    client_email: getEnvVar('FIREBASE_CLIENT_EMAIL'),
    client_id: getEnvVar('FIREBASE_CLIENT_ID'),
    auth_uri: getEnvVar('FIREBASE_AUTH_URI'),
    token_uri: getEnvVar('FIREBASE_TOKEN_URI'),
    auth_provider_x509_cert_url: getEnvVar('FIREBASE_AUTH_CERT_URL'),
    client_x509_cert_url: getEnvVar('FIREBASE_CLIENT_CERT_URL'),
};

const initApp = () => {
    if (process.env.NODE_ENV === 'production') {
        logger.info('PROD env detected. Using service account from env.');
        return initializeApp({
            credential: cert(serviceAccount as ServiceAccount)
        });
    }
    logger.info('DEV env detected. Loading service account from local env.');
    return initializeApp({
        credential: cert(serviceAccount as ServiceAccount)
    });
};

// Add error handling for initialization
export const app = activeApps.length === 0 ? initApp() : activeApps[0];
export const db = getFirestore(app);