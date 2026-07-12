import { useState } from "react";

interface SignInScreenProps {
  error: string;
  localPreview: boolean;
  onSignIn: () => void;
  onEmailSignIn: (email: string, password: string) => void;
  onEmailCreate: (email: string, password: string) => void;
  onLocalPreview: () => void;
}

export function SignInScreen({
  error,
  localPreview,
  onSignIn,
  onEmailSignIn,
  onEmailCreate,
  onLocalPreview
}: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submitEmail(action: "sign-in" | "create") {
    if (!email.trim() || !password) {
      return;
    }
    if (action === "create") {
      onEmailCreate(email.trim(), password);
      return;
    }
    onEmailSignIn(email.trim(), password);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">S</div>
        <p className="eyebrow">SplitSnap</p>
        <h1>Split every dinner. Skip the awkward follow-up.</h1>
        <p>
          Scan the receipt or add the items manually, assign what everyone ordered,
          and let SplitSnap handle the breakdown.
        </p>
        {error ? <p className="notice warning">{error}</p> : null}
        {localPreview ? (
          <button type="button" className="google-sign-in" onClick={onLocalPreview}>
            Continue in local preview
          </button>
        ) : (
          <>
            <button type="button" className="google-sign-in" onClick={onSignIn}>
              Continue with Google
            </button>
            <form
              className="email-auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitEmail("sign-in");
              }}
            >
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <div className="button-row">
                <button type="submit" className="secondary">
                  Sign in
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => submitEmail("create")}
                >
                  Create account
                </button>
              </div>
            </form>
          </>
        )}
        <p className="auth-note">
          {localPreview
            ? "Preview data stays on this device until Firebase is configured."
            : "Your dinners stay private to the people included in each split."}
        </p>
      </section>
    </main>
  );
}
