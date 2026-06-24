import { describe, expect, it } from "vitest";
import { getFirebaseClientConfig } from "./runtimeConfig";

const completeEnvironment = {
  VITE_FIREBASE_API_KEY: "api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "splitsnap.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "splitsnap",
  VITE_FIREBASE_STORAGE_BUCKET: "splitsnap.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
  VITE_FIREBASE_APP_ID: "1:123:web:abc"
};

describe("getFirebaseClientConfig", () => {
  it("returns a Firebase config when every required value exists", () => {
    expect(getFirebaseClientConfig(completeEnvironment)).toEqual({
      apiKey: "api-key",
      authDomain: "splitsnap.firebaseapp.com",
      projectId: "splitsnap",
      storageBucket: "splitsnap.appspot.com",
      messagingSenderId: "123",
      appId: "1:123:web:abc"
    });
  });

  it("returns null when a required value is missing or blank", () => {
    expect(
      getFirebaseClientConfig({
        ...completeEnvironment,
        VITE_FIREBASE_PROJECT_ID: " "
      })
    ).toBeNull();
  });
});
