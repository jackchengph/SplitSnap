import { Camera, ChevronRight, ListPlus, Utensils } from "lucide-react";

interface CreateSplitFlowProps {
  onReceipt: () => void;
  onRestaurant: () => void;
  onManual: () => void;
}

export function CreateSplitFlow({
  onReceipt,
  onRestaurant,
  onManual
}: CreateSplitFlowProps) {
  const options = [
    {
      title: "Scan a receipt",
      description: "Use the camera and OCR fallback.",
      icon: Camera,
      action: onReceipt
    },
    {
      title: "Choose from a menu",
      description: "Find the restaurant and check what was ordered.",
      icon: Utensils,
      action: onRestaurant
    },
    {
      title: "Add items manually",
      description: "Start with a blank editable item.",
      icon: ListPlus,
      action: onManual
    }
  ];

  return (
    <main className="flow-page source-page page-enter">
      <div>
        <p className="eyebrow">Add the bill</p>
        <h1>How do you want to start?</h1>
        <p className="muted">You can correct every item before anyone is notified.</p>
      </div>
      <div className="source-options">
        {options.map(({ title, description, icon: Icon, action }) => (
          <button type="button" key={title} onClick={action}>
            <span className="source-icon">
              <Icon aria-hidden="true" size={22} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        ))}
      </div>
    </main>
  );
}
