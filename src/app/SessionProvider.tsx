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
import type { UserProfile } from "../domain/accountTypes";
import { bootstrapProfile } from "../services/profileService";

type SessionMode = "local" | "cloud" | "unconfigured";
type SessionStatus = "loading" | "signed-out" | "authenticated";
type ProfileStatus = "idle" | "loading" | "ready" | "error";

interface SessionContextValue {
  mode: SessionMode;
  status: SessionStatus;
  user: SessionUser | null;
  profile: UserProfile | null;
  profileStatus: ProfileStatus;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  retryProfile: () => Promise<void>;
  enterLocalPreview: () => void;
}

interface SessionProviderProps {
  children: ReactNode;
  cloudConfigured: boolean;
  allowLocalPreview: boolean;
  authAdapter?: AuthAdapter;
}

const localUser: SessionUser = {
  id: "local-user",
  displayName: "Maya",
  email: "",
  photoURL: null
};

const localProfile: UserProfile = {
  id: "local-user",
  displayName: "Maya",
  photoURL: null,
  handle: "maya_preview",
  friendCode: "PREVIEW1",
  discoverableByHandle: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z"
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  cloudConfigured,
  allowLocalPreview,
  authAdapter = firebaseAuthAdapter
}: SessionProviderProps) {
  const mode: SessionMode = cloudConfigured
    ? "cloud"
    : allowLocalPreview
      ? "local"
      : "unconfigured";
  const [user, setUser] = useState<SessionUser | null>(
    null
  );
  const [status, setStatus] = useState<SessionStatus>(
    cloudConfigured ? "loading" : "signed-out"
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cloudConfigured) {
      return;
    }

    let active = true;
    let requestVersion = 0;

    async function loadProfile(nextUser: SessionUser) {
      const attempt = requestVersion + 1;
      requestVersion = attempt;
      setProfileStatus("loading");
      setError("");

      try {
        const idToken = await authAdapter.getIdToken();
        const nextProfile = await bootstrapProfile(
          idToken,
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        );
        if (!active || requestVersion !== attempt) {
          return;
        }
        setProfile(nextProfile);
        setProfileStatus("ready");
      } catch (caught) {
        if (!active || requestVersion !== attempt) {
          return;
        }
        setProfile(null);
        setProfileStatus("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "Profile could not be created."
        );
      }
    }

    const unsubscribe = authAdapter.observeSession((nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "signed-out");
      if (!nextUser) {
        requestVersion += 1;
        setProfile(null);
        setProfileStatus("idle");
        setError("");
        return;
      }

      void loadProfile(nextUser);
    });

    return () => {
      active = false;
      requestVersion += 1;
      unsubscribe();
    };
  }, [authAdapter, cloudConfigured]);

  const value = useMemo<SessionContextValue>(
    () => ({
      mode,
      status,
      user,
      profile,
      profileStatus,
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
          setProfile(null);
          setProfileStatus("idle");
          return;
        }
        try {
          await authAdapter.signOutUser();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Sign-out failed.");
        }
      },
      retryProfile: async () => {
        if (!cloudConfigured || !user) {
          return;
        }

        setProfileStatus("loading");
        setError("");
        try {
          const idToken = await authAdapter.getIdToken();
          const nextProfile = await bootstrapProfile(
            idToken,
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
          );
          setProfile(nextProfile);
          setProfileStatus("ready");
        } catch (caught) {
          setProfile(null);
          setProfileStatus("error");
          setError(
            caught instanceof Error
              ? caught.message
              : "Profile could not be created."
          );
        }
      },
      enterLocalPreview: () => {
        if (cloudConfigured || !allowLocalPreview) {
          return;
        }
        setError("");
        setUser(localUser);
        setStatus("authenticated");
        setProfile(localProfile);
        setProfileStatus("ready");
      }
    }),
    [
      allowLocalPreview,
      authAdapter,
      cloudConfigured,
      error,
      mode,
      profile,
      profileStatus,
      status,
      user
    ]
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
