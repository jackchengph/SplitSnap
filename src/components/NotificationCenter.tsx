import type { Friend, Notification } from "../domain/types";

interface NotificationCenterProps {
  friends: Friend[];
  notifications: Notification[];
}

export function NotificationCenter({ friends, notifications }: NotificationCenterProps) {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Push preview</p>
        <h2>Simulated push notifications</h2>
      </div>
      <div className="notification-list">
        {notifications.map((notification) => (
          <article className="notification-card" key={notification.id}>
            <p className="muted">To {friendById.get(notification.participantId)?.name}</p>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
