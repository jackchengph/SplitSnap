interface SignInScreenProps {
  error: string;
  localPreview: boolean;
  onSignIn: () => void;
  onLocalPreview: () => void;
}

export function SignInScreen({
  error,
  localPreview,
  onSignIn,
  onLocalPreview
}: SignInScreenProps) {
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
        {error ? <p className="notice warning">{error}</p> : null}
        {localPreview ? (
          <button type="button" className="google-sign-in" onClick={onLocalPreview}>
            Continue in local preview
          </button>
        ) : (
          <button type="button" className="google-sign-in" onClick={onSignIn}>
            Continue with Google
          </button>
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
