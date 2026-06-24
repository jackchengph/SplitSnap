import { describe, expect, it } from "vitest";
import { getSystemDiagnostics } from "./systemDiagnostics";

describe("getSystemDiagnostics", () => {
  it("reports missing Firebase and VAPID configuration honestly", () => {
    expect(getSystemDiagnostics({})).toMatchObject({
      firebaseConfigured: false,
      vapidConfigured: false
    });
  });

  it("requires every Firebase client value", () => {
    expect(
      getSystemDiagnostics({
        VITE_FIREBASE_API_KEY: "key",
        VITE_FIREBASE_AUTH_DOMAIN: "app.firebaseapp.com",
        VITE_FIREBASE_PROJECT_ID: "app",
        VITE_FIREBASE_STORAGE_BUCKET: "app.appspot.com",
        VITE_FIREBASE_MESSAGING_SENDER_ID: "1",
        VITE_FIREBASE_APP_ID: "app-id",
        VITE_FIREBASE_VAPID_KEY: "vapid"
      })
    ).toMatchObject({
      firebaseConfigured: true,
      vapidConfigured: true
    });
  });
});
