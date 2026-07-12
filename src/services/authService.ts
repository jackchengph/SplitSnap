import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User
} from "firebase/auth";
import { firebaseRuntime } from "../platform/firebase";

export interface SessionUser {
  id: string;
  displayName: string;
  firstName: string;
  email: string;
  photoURL: string | null;
}

export interface AuthAdapter {
  observeSession: (listener: (user: SessionUser | null) => void) => () => void;
  getIdToken: () => Promise<string>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createEmailAccount: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

function requireAuth(): Auth {
  if (!firebaseRuntime.auth) {
    throw new Error("Firebase Authentication is not configured.");
  }
  return firebaseRuntime.auth;
}

function mapFirebaseUser(user: User): SessionUser {
  const displayName = user.displayName || user.email?.split("@")[0] || "SplitSnap user";
  return {
    id: user.uid,
    displayName,
    firstName: displayName.trim().split(/\s+/)[0] || "there",
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

export async function signInWithEmail(
  email: string,
  password: string
): Promise<void> {
  await signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function createEmailAccount(
  email: string,
  password: string
): Promise<void> {
  await createUserWithEmailAndPassword(requireAuth(), email, password);
}

export async function signOutUser(): Promise<void> {
  await signOut(requireAuth());
}

export async function getIdToken(): Promise<string> {
  const currentUser = requireAuth().currentUser;
  if (!currentUser) {
    throw new Error("Sign in before continuing.");
  }
  return currentUser.getIdToken();
}

export const firebaseAuthAdapter: AuthAdapter = {
  observeSession,
  getIdToken,
  signInWithGoogle,
  signInWithEmail,
  createEmailAccount,
  signOutUser
};
