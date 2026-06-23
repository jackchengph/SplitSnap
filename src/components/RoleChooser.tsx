interface RoleChooserProps {
  onChoosePayer: () => void;
  onChooseParticipant: () => void;
}

export function RoleChooser({ onChoosePayer, onChooseParticipant }: RoleChooserProps) {
  return (
    <main className="app-shell">
      <section className="role-shell">
        <p className="eyebrow">SplitSnap</p>
        <h1>How are you joining?</h1>
        <p className="role-copy">
          Choose the view that matches your role in this dinner split.
        </p>
        <div className="role-actions">
          <button type="button" onClick={onChoosePayer}>
            I paid the bill
          </button>
          <button type="button" className="secondary" onClick={onChooseParticipant}>
            I'm settling my share
          </button>
        </div>
      </section>
    </main>
  );
}
