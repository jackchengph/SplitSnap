import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User
} from "firebase/auth";
import { firebaseRuntime } from "../platform/firebase";

export interface SessionUser {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
}

export interface AuthAdapter {
  observeSession: (listener: (user: SessionUser | null) => void) => () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

function requireAuth(): Auth {
  if (!firebaseRuntime.auth) {
    throw new Error("Firebase Authentication is not configured.");
  }
  return firebaseRuntime.auth;
}

function mapFirebaseUser(user: User): SessionUser {
  return {
    id: user.uid,
    displayName: user.displayName || user.email?.split("@")[0] || "SplitSnap user",
    email: user.email || "",
    photoURL: user.photoURL
  };
}

export function observeSession(
  listener: (user: SessionUser | null) => void
): () => void {
  return onAuthStateChanged(requireAuth(), (user) => {
    listener(user ? mapFirebaseUser(user) : null);
  });
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(requireAuth(), provider);
}

export async function signOutUser(): Promise<void> {
  await signOut(requireAuth());
}

export const firebaseAuthAdapter: AuthAdapter = {
  observeSession,
  signInWithGoogle,
  signOutUser
};
