import { useState } from "react";
import type { Receipt } from "../domain/types";
import { prepareReceiptFile } from "../services/receiptImageFile";

interface ReceiptCaptureProps {
  receipt: Receipt;
  onUpload: (imageDataUrl: string) => Promise<void> | void;
}

export function ReceiptCapture({ receipt, onUpload }: ReceiptCaptureProps) {
  const [uploadError, setUploadError] = useState("");
  const lowConfidence =
    receipt.ocrConfidence < 0.85 || receipt.items.some((item) => item.needsReview);

  async function handleUpload(file: File): Promise<void> {
    if (!file.type.startsWith("image/") && !/\.hei[cf]$/i.test(file.name)) {
      setUploadError("Choose an image file for receipt OCR.");
      return;
    }

    setUploadError("");
    try {
      const prepared = await prepareReceiptFile(file);
      await onUpload(prepared.dataUrl);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Receipt image could not be uploaded."
      );
    }
  }

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
          accept="image/*,.heic,.heif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUpload(file);
            }
          }}
        />
      </label>
      {uploadError ? (
        <div className="notice warning" role="alert">
          {uploadError}
        </div>
      ) : null}
      <div className={lowConfidence ? "notice warning" : "notice"}>
        OCR confidence: {Math.round(receipt.ocrConfidence * 100)}%.
        {lowConfidence
          ? " SplitSnap checked alternate image treatments and receipt layouts. Confirm the highlighted rows before splitting."
          : " OCR and receipt totals look usable, and you can still correct every item."}
      </div>
      {receipt.parseWarnings?.map((warning) => (
        <div className="notice warning" key={warning}>
          {warning}
        </div>
      ))}
    </section>
  );
}
