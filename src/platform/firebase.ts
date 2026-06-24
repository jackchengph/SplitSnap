import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseClientConfig } from "./runtimeConfig";

export interface FirebaseRuntime {
  configured: boolean;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
  getMessaging: () => Promise<Messaging | null>;
}

function createFirebaseRuntime(): FirebaseRuntime {
  const config = getFirebaseClientConfig(import.meta.env);
  if (!config) {
    return {
      configured: false,
      app: null,
      auth: null,
      firestore: null,
      storage: null,
      getMessaging: async () => null
    };
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return {
    configured: true,
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
    getMessaging: async () => ((await isSupported()) ? getMessaging(app) : null)
  };
}

export const firebaseRuntime = createFirebaseRuntime();
