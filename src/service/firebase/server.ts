import type { ServiceAccount } from "firebase-admin";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const logger = {
	debug: (...args: any[]) => console.debug("[Vercel]", ...args),
	info: (...args: any[]) => console.log("[Vercel]", ...args),
	error: (...args: any[]) => console.error("[Vercel]", ...args),
};

logger.info("[Firebase-Server] Starting initialization");

// Helper to get env vars with fallback to import.meta.env
const getEnvVar = (key: string): string | undefined => {
	return process.env[key] || import.meta.env[key];
};

const projectId = getEnvVar("FIREBASE_PROJECT_ID");
const clientEmail = getEnvVar("FIREBASE_CLIENT_EMAIL");
const privateKey = getEnvVar("FIREBASE_PRIVATE_KEY");

export const isFirebaseInitialized = !!(projectId && clientEmail && privateKey);

logger.info(`[Firebase-Server] Initialized: ${isFirebaseInitialized}`);

// Parse private key - handle both quoted and unquoted formats
const parsePrivateKey = (key: string | undefined) => {
	if (!key) return undefined;
	// Remove wrapping quotes if they exist and unescape \n
	return key.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1");
};

let app: import("firebase-admin/app").App | null = null;
let db: import("firebase-admin/firestore").Firestore | null = null;

if (isFirebaseInitialized) {
	const activeApps = getApps();
	const serviceAccount = {
		type: "service_account",
		project_id: projectId,
		private_key_id: getEnvVar("FIREBASE_PRIVATE_KEY_ID"),
		private_key: parsePrivateKey(privateKey),
		client_email: clientEmail,
		client_id: getEnvVar("FIREBASE_CLIENT_ID"),
		auth_uri: getEnvVar("FIREBASE_AUTH_URI"),
		token_uri: getEnvVar("FIREBASE_TOKEN_URI"),
		auth_provider_x509_cert_url: getEnvVar("FIREBASE_AUTH_CERT_URL"),
		client_x509_cert_url: getEnvVar("FIREBASE_CLIENT_CERT_URL"),
	};

	const initApp = () => {
		if (process.env.NODE_ENV === "production") {
			logger.info("PROD env detected. Using service account from env.");
			return initializeApp({
				credential: cert(serviceAccount as ServiceAccount),
			});
		}
		logger.info("DEV env detected. Loading service account from local env.");
		return initializeApp({
			credential: cert(serviceAccount as ServiceAccount),
		});
	};

	// Add error handling for initialization
	app = activeApps.length === 0 ? initApp() : activeApps[0];
	db = getFirestore(app);
}

export { app, db };
