export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
}

type Environment = Record<string, string | boolean | undefined>;

const firebaseEnvironmentKeys = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID"
} as const;

export function getFirebaseClientConfig(
  environment: Environment
): FirebaseClientConfig | null {
  const entries = Object.entries(firebaseEnvironmentKeys).map(([field, key]) => [
    field,
    typeof environment[key] === "string" ? environment[key].trim() : ""
  ]);

  if (entries.some(([, value]) => !value)) {
    return null;
  }

  return Object.fromEntries(entries) as unknown as FirebaseClientConfig;
}

export function getSupabaseClientConfig(
  environment: Environment
): SupabaseClientConfig | null {
  const url =
    typeof environment.VITE_SUPABASE_URL === "string"
      ? environment.VITE_SUPABASE_URL.trim()
      : "";
  const anonKey =
    typeof environment.VITE_SUPABASE_ANON_KEY === "string"
      ? environment.VITE_SUPABASE_ANON_KEY.trim()
      : "";

  return url && anonKey ? { url, anonKey } : null;
}
