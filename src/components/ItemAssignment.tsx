import { formatCurrency } from "../domain/format";
import type { DinnerGroup, Friend, Receipt } from "../domain/types";

interface ItemAssignmentProps {
  receipt: Receipt;
  friends: Friend[];
  group: DinnerGroup;
  onToggleParticipant: (itemId: string, participantId: string) => void;
  onUpdatePrice: (itemId: string, price: number) => void;
  onUpdateName: (itemId: string, name: string) => void;
}

export function ItemAssignment({
  receipt,
  friends,
  group,
  onToggleParticipant,
  onUpdatePrice,
  onUpdateName
}: ItemAssignmentProps) {
  const participants = friends.filter((friend) => group.participantIds.includes(friend.id));

  return (
    <section className="panel item-panel">
      <div className="section-heading">
        <p className="eyebrow">Assign items</p>
        <h2>Who shared what?</h2>
      </div>
      <div className="item-list">
        {receipt.items.map((item) => (
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
                <p>
                  Qty {item.quantity} · confidence {Math.round(item.confidence * 100)}%
                </p>
                <div className="tag-row">
                  {item.parseSource ? (
                    <span className={item.needsReview ? "tag warning-tag" : "tag"}>
                      {item.parseSource === "yolo"
                        ? "YOLO fallback"
                        : item.parseSource === "manual"
                          ? "Manual review"
                          : "OCR"}
                    </span>
                  ) : null}
                  {item.needsReview ? <span className="tag warning-tag">Check price/name</span> : null}
                </div>
              </div>
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
            <div className="chip-row" aria-label={`${item.name} participants`}>
              {participants.map((friend) => {
                const selected = item.assignedParticipantIds.includes(friend.id);
                return (
                  <button
                    className={selected ? "chip selected" : "chip"}
                    key={friend.id}
                    type="button"
                    onClick={() => onToggleParticipant(item.id, friend.id)}
                  >
                    {friend.name}
                  </button>
                );
              })}
            </div>
            <p className="muted">
              {item.assignedParticipantIds.length === 0
                ? "Unassigned"
                : `${formatCurrency(item.price / item.assignedParticipantIds.length)} each before tax/service`}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
