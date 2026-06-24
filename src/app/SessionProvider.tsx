import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  firebaseAuthAdapter,
  type AuthAdapter,
  type SessionUser
} from "../services/authService";
import { saveUserProfile } from "../services/cloudWorkspace";

type SessionMode = "local" | "cloud";
type SessionStatus = "loading" | "signed-out" | "authenticated";

interface SessionContextValue {
  mode: SessionMode;
  status: SessionStatus;
  user: SessionUser | null;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  enterLocalPreview: () => void;
}

interface SessionProviderProps {
  children: ReactNode;
  cloudConfigured: boolean;
  authAdapter?: AuthAdapter;
}

const localUser: SessionUser = {
  id: "local-user",
  displayName: "Maya",
  email: "",
  photoURL: null
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  cloudConfigured,
  authAdapter = firebaseAuthAdapter
}: SessionProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(
    null
  );
  const [status, setStatus] = useState<SessionStatus>(
    cloudConfigured ? "loading" : "signed-out"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cloudConfigured) {
      return;
    }

    return authAdapter.observeSession((nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "signed-out");
      if (nextUser) {
        void saveUserProfile(nextUser).catch((caught) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "Your cloud profile could not be updated."
          );
        });
      }
    });
  }, [authAdapter, cloudConfigured]);

  const value = useMemo<SessionContextValue>(
    () => ({
      mode: cloudConfigured ? "cloud" : "local",
      status,
      user,
      error,
      signIn: async () => {
        setError("");
        try {
          await authAdapter.signInWithGoogle();
        } catch (caught) {
          setError(
            caught instanceof Error ? caught.message : "Google sign-in failed."
          );
        }
      },
      signOut: async () => {
        setError("");
        if (!cloudConfigured) {
          setUser(null);
          setStatus("signed-out");
          return;
        }
        try {
          await authAdapter.signOutUser();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Sign-out failed.");
        }
      },
      enterLocalPreview: () => {
        if (cloudConfigured) {
          return;
        }
        setUser(localUser);
        setStatus("authenticated");
      }
    }),
    [authAdapter, cloudConfigured, error, status, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used within SessionProvider.");
  }
  return session;
}
