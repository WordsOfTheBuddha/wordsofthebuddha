import type { ServiceAccount } from "firebase-admin";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const logger = {
    debug: (...args: any[]) => console.debug('[Vercel]', ...args),
    info: (...args: any[]) => console.log('[Vercel]', ...args),
    error: (...args: any[]) => console.error('[Vercel]', ...args)
};

logger.info('[Firebase-Server] Starting initialization');
logger.debug('[Firebase-Server] Config:', {
    projectId: process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
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
    project_id: import.meta.env.FIREBASE_PROJECT_ID,
    private_key_id: import.meta.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: parsePrivateKey(import.meta.env.FIREBASE_PRIVATE_KEY),
    client_email: import.meta.env.FIREBASE_CLIENT_EMAIL,
    client_id: import.meta.env.FIREBASE_CLIENT_ID,
    auth_uri: import.meta.env.FIREBASE_AUTH_URI,
    token_uri: import.meta.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: import.meta.env.FIREBASE_AUTH_CERT_URL,
    client_x509_cert_url: import.meta.env.FIREBASE_CLIENT_CERT_URL,
};

const initApp = () => {
    if (import.meta.env.PROD) {
        logger.info('PROD env detected. Using default service account.');
        return initializeApp();
    }
    logger.info('Loading service account from env.');
    return initializeApp({
        credential: cert(serviceAccount as ServiceAccount)
    });
}

export const app = activeApps.length === 0 ? initApp() : activeApps[0];
export const db = getFirestore(app);