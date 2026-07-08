import { formatCurrency } from "../domain/format";
import type { DinnerGroup, Friend, Receipt } from "../domain/types";

interface ItemAssignmentProps {
  receipt: Receipt;
  friends: Friend[];
  group: DinnerGroup;
  onToggleParticipant: (itemId: string, participantId: string) => void;
  onSetParticipants: (itemId: string, participantIds: string[]) => void;
  onUpdatePrice: (itemId: string, price: number) => void;
  onUpdateName: (itemId: string, name: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

export function ItemAssignment({
  receipt,
  friends,
  group,
  onToggleParticipant,
  onSetParticipants,
  onUpdatePrice,
  onUpdateName,
  onUpdateQuantity
}: ItemAssignmentProps) {
  const participants = friends.filter((friend) => group.participantIds.includes(friend.id));
  const participantById = new Map(participants.map((friend) => [friend.id, friend]));

  return (
    <section className="panel item-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Assign items</p>
          <h2>Who shared what?</h2>
        </div>
        <span className="quiet-count">{receipt.items.length} items</span>
      </div>
      <div className="item-list">
        {receipt.items.map((item) => {
          const assignedFriends = item.assignedParticipantIds
            .map((participantId) => participantById.get(participantId))
            .filter((friend): friend is Friend => Boolean(friend));
          const assignedCount = assignedFriends.length;
          const eachShare = assignedCount > 0 ? item.price / assignedCount : 0;

          return (
            <article className="item-card" key={item.id}>
              <div className="item-topline">
                <div>
                  <label className="item-name-input">
                    Item
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) => onUpdateName(item.id, event.target.value)}
                    />
                  </label>
                  <div className="tag-row item-meta-row">
                    <span className="tag">Confidence {Math.round(item.confidence * 100)}%</span>
                    {item.parseSource ? (
                      <span className={item.needsReview ? "tag warning-tag" : "tag"}>
                        {item.parseSource === "yolo"
                          ? "Layout recovery"
                          : item.parseSource === "manual"
                            ? "Manual review"
                            : item.parseSource === "gemini"
                              ? "Scanned"
                              : "OCR"}
                      </span>
                    ) : null}
                    {item.needsReview ? <span className="tag warning-tag">Check price/name</span> : null}
                  </div>
                </div>
                <div className="item-number-fields">
                  <label className="price-input">
                    Quantity
                    <input
                      type="number"
                      value={item.quantity}
                      min="1"
                      step="1"
                      onChange={(event) => onUpdateQuantity(item.id, Number(event.target.value))}
                    />
                  </label>
                  <label className="price-input">
                    Price
                    <input
                      type="number"
                      value={item.price}
                      min="0"
                      step="0.01"
                      onChange={(event) => onUpdatePrice(item.id, Number(event.target.value))}
                    />
                  </label>
                </div>
              </div>

              <div className="assignment-summary">
                <div>
                  <span>Split between</span>
                  <strong>
                    {assignedCount === 0
                      ? "No one yet"
                      : assignedFriends.map((friend) => friend.name).join(", ")}
                  </strong>
                </div>
                <div>
                  <span>Each pays</span>
                  <strong>{assignedCount === 0 ? "Unassigned" : formatCurrency(eachShare)}</strong>
                </div>
              </div>

              <div className="assignment-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    onSetParticipants(
                      item.id,
                      participants.map((participant) => participant.id)
                    )
                  }
                >
                  Split with everyone
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onSetParticipants(item.id, [])}
                >
                  Clear
                </button>
              </div>

              <div className="participant-picker" aria-label={`${item.name} participants`}>
                {participants.map((friend) => {
                  const selected = item.assignedParticipantIds.includes(friend.id);
                  return (
                    <button
                      className={selected ? "participant-chip selected" : "participant-chip"}
                      key={friend.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onToggleParticipant(item.id, friend.id)}
                    >
                      <span
                        className="avatar mini-avatar"
                        style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}
                      >
                        {friend.avatarLabel}
                      </span>
                      <span>
                        <strong>{friend.name}</strong>
                        <small>{selected ? "Included" : "Tap to include"}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className={assignedCount === 0 ? "notice warning" : "muted"}>
                {assignedCount === 0
                  ? "Assign this item before settling, otherwise it will not be charged to anyone."
                  : `${formatCurrency(item.price)} split ${assignedCount} way${assignedCount === 1 ? "" : "s"} before tax/service.`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
