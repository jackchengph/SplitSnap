import {
  Bell,
  Home,
  ReceiptText,
  UserRound,
  UsersRound
} from "lucide-react";
import type { ReactNode } from "react";

export type AppPage = "home" | "friends" | "activity" | "profile";

interface AppShellProps {
  children: ReactNode;
  currentPage: AppPage;
  userName: string;
  sessionMode: "local" | "cloud";
  onNavigate: (page: AppPage) => void;
}

const navigation = [
  { page: "home" as const, label: "Home", icon: Home },
  { page: "friends" as const, label: "Friends", icon: UsersRound },
  { page: "activity" as const, label: "Meals", icon: ReceiptText },
  { page: "profile" as const, label: "Profile", icon: UserRound }
];

export function AppShell({
  children,
  currentPage,
  userName,
  sessionMode,
  onNavigate
}: AppShellProps) {
  return (
    <div className="product-shell">
      <aside className="side-rail" aria-label="Primary navigation">
        <button
          type="button"
          className="brand-button"
          aria-label="SplitSnap home"
          onClick={() => onNavigate("home")}
        >
          S
        </button>
        <nav aria-label="Desktop navigation">
          {navigation.map(({ page, label, icon: Icon }) => (
            <button
              type="button"
              key={page}
              aria-label={label}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={() => onNavigate(page)}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="product-main">
        <header className="top-bar">
          <div className="top-brand">
            <span className="mobile-brand">S</span>
            <strong>SplitSnap</strong>
            {sessionMode === "local" ? <span className="preview-badge">Preview</span> : null}
          </div>
          <div className="top-account">
            <button
              type="button"
              className="icon-button"
              aria-label="Open meals and reminders"
              onClick={() => onNavigate("activity")}
            >
              <Bell aria-hidden="true" size={19} />
            </button>
            <span className="account-avatar">{userName.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <div className="page-stage">{children}</div>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.map(({ page, label, icon: Icon }) => (
          <button
            type="button"
            key={page}
            aria-label={label}
            aria-current={page === currentPage ? "page" : undefined}
            onClick={() => onNavigate(page)}
          >
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
