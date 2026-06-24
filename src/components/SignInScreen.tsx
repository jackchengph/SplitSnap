interface SignInScreenProps {
  error: string;
  onSignIn: () => void;
}

export function SignInScreen({ error, onSignIn }: SignInScreenProps) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Split bills without the awkward follow-up</p>
        <h1>SplitSnap</h1>
        <p>
          Sign in to connect with friends, scan receipts, and keep shared balances
          synchronized across devices.
        </p>
        {error ? <p className="notice warning">{error}</p> : null}
        <button type="button" className="google-sign-in" onClick={onSignIn}>
          Continue with Google
        </button>
      </section>
    </main>
  );
}
