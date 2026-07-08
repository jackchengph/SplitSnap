import { useState } from "react";

interface SignInScreenProps {
  error: string;
  mode: "local" | "cloud" | "unconfigured";
  onSignIn: () => void;
  onLocalPreview: () => void;
  onRetryProfile?: () => void;
}

export function SignInScreen({
  error,
  mode,
  onSignIn,
  onLocalPreview,
  onRetryProfile
}: SignInScreenProps) {
  const retryingProfile = typeof onRetryProfile === "function";
  const [email, setEmail] = useState("maya@splitsnap.test");

  function handlePreviewSignIn() {
    if (mode === "cloud") {
      onSignIn();
      return;
    }
    onLocalPreview();
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-panel-grid">
        <div className="auth-copy">
          <div className="auth-brand">S</div>
          <p className="eyebrow">SplitSnap</p>
          <h1>Split every dinner. Skip the awkward follow-up.</h1>
          <p>
            Scan the receipt or choose from the restaurant menu, assign what everyone
            ordered, and let SplitSnap handle the breakdown.
          </p>
        </div>

        <form
          className="preview-login-card"
          onSubmit={(event) => {
            event.preventDefault();
            handlePreviewSignIn();
          }}
        >
          <p className="eyebrow">Temporary sign-in</p>
          <h2>Preview as the payer</h2>
          <p className="muted">
            Use the sample account to review the app flow before Firebase sign-in is connected.
          </p>
          <label className="preview-login-field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            className="google-sign-in"
            disabled={mode === "unconfigured" || retryingProfile}
          >
            {mode === "cloud"
              ? "Continue with Google"
              : mode === "unconfigured"
                ? "Sign-in unavailable"
                : "Sign in to preview"}
          </button>
          {mode === "local" ? (
            <button type="button" className="text-command preview-link" onClick={onLocalPreview}>
              Continue in local preview
            </button>
          ) : null}
        </form>

        {mode === "unconfigured" ? (
          <p className="notice warning">
            Add Firebase settings to enable Google sign-in and cloud sync.
          </p>
        ) : null}
        {error ? <p className="notice warning">{error}</p> : null}
        {retryingProfile ? (
          <button type="button" className="google-sign-in" onClick={onRetryProfile}>
            Retry profile setup
          </button>
        ) : null}
        <p className="auth-note">
          {retryingProfile
            ? "We kept your Google session. Retry to finish creating your SplitSnap profile."
            : mode === "local"
            ? "Preview data stays on this device until Firebase is configured."
            : mode === "cloud"
              ? "Your dinners stay private to the people included in each split."
              : "Local preview is disabled here until Firebase has been configured."}
        </p>
      </section>
    </main>
  );
}
