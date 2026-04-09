interface ImportMetaEnv {
    /** Optional: R2 public origin for voice assets (e.g. https://hear.wordsofthebuddha.org). Omit for local /audio/… */
    readonly PUBLIC_AUDIO_BASE_URL?: string;
    readonly FIREBASE_PRIVATE_KEY_ID: string;
    readonly FIREBASE_PRIVATE_KEY: string;
    readonly FIREBASE_PROJECT_ID: string;
    readonly FIREBASE_CLIENT_EMAIL: string;
    readonly FIREBASE_CLIENT_ID: string;
    readonly FIREBASE_AUTH_URI: string;
    readonly FIREBASE_TOKEN_URI: string;
    readonly FIREBASE_AUTH_CERT_URL: string;
    readonly FIREBASE_CLIENT_CERT_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
