import { useState } from "react";
import type { Receipt } from "../domain/types";
import { prepareReceiptFile } from "../services/receiptImageFile";

interface ReceiptCaptureProps {
  receipt: Receipt;
  isReadingReceipt?: boolean;
  onUpload: (fileName: string, imageDataUrl: string) => void;
  onReadReceipt: () => void;
}

export function ReceiptCapture({
  receipt,
  isReadingReceipt = false,
  onUpload,
  onReadReceipt
}: ReceiptCaptureProps) {
  const [isPreparingReceipt, setIsPreparingReceipt] = useState(false);
  const canReadReceipt = Boolean(receipt.imageUrl) && !isReadingReceipt && !isPreparingReceipt;

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Receipt</p>
        <h2>{receipt.merchantName}</h2>
      </div>
      <div className="receipt-preview" aria-label="Receipt preview">
        {receipt.imageUrl ? (
          <img src={receipt.imageUrl} alt="Captured receipt" />
        ) : null}
        <div>
          <strong>{receipt.merchantName}</strong>
          <span>{receipt.date}</span>
        </div>
        <p>{receipt.items.length} items ready to review</p>
      </div>
      <label className="upload-control">
        Upload receipt image
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              setIsPreparingReceipt(true);
              void prepareReceiptFile(file)
                .then(({ dataUrl }) => {
                  onUpload(file.name, dataUrl);
                })
                .catch(() => undefined)
                .finally(() => setIsPreparingReceipt(false));
            }
          }}
        />
      </label>
      <button
        type="button"
        className="secondary add-item-button"
        disabled={!canReadReceipt}
        onClick={onReadReceipt}
      >
        {isPreparingReceipt ? "Preparing receipt..." : isReadingReceipt ? "Reading receipt..." : "Read receipt"}
      </button>
    </section>
  );
}
