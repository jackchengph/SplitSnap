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

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">S</div>
        <p className="eyebrow">SplitSnap</p>
        <h1>Split every dinner. Skip the awkward follow-up.</h1>
        <p>
          Scan the receipt or choose from the restaurant menu, assign what everyone
          ordered, and let SplitSnap handle the breakdown.
        </p>
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
        ) : mode === "local" ? (
          <button type="button" className="google-sign-in" onClick={onLocalPreview}>
            Continue in local preview
          </button>
        ) : mode === "cloud" ? (
          <button type="button" className="google-sign-in" onClick={onSignIn}>
            Continue with Google
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
