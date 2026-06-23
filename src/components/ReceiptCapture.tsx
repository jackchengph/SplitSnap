import type { Receipt } from "../domain/types";

interface ReceiptCaptureProps {
  receipt: Receipt;
  onUpload: (fileName: string) => void;
}

export function ReceiptCapture({ receipt, onUpload }: ReceiptCaptureProps) {
  const lowConfidence =
    receipt.ocrConfidence < 0.85 || receipt.items.some((item) => item.needsReview);

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
        <p>
          {receipt.items.length} parsed items
          {receipt.parseStatus ? ` · ${receipt.parseStatus}` : ""}
        </p>
      </div>
      <label className="upload-control">
        Upload receipt image
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onUpload(file.name);
            }
          }}
        />
      </label>
      <div className={lowConfidence ? "notice warning" : "notice"}>
        OCR confidence: {Math.round(receipt.ocrConfidence * 100)}%.
        {lowConfidence
          ? " SplitSnap would retry with layout detection and a YOLO-style fallback before asking you to correct items."
          : " Simulated OCR looks usable, and you can still correct every item."}
      </div>
      {receipt.parseWarnings?.map((warning) => (
        <div className="notice warning" key={warning}>
          {warning}
        </div>
      ))}
    </section>
  );
}
