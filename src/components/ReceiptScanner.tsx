import { useEffect, useRef, useState } from "react";
import type { ParseStatus } from "../domain/types";
import { prepareReceiptFile } from "../services/receiptImageFile";

interface ReceiptScannerProps {
  parseStatus: ParseStatus;
  parseWarnings: string[];
  onCapture: (imageDataUrl: string) => void | Promise<void>;
  onHome: () => void;
}

export function ReceiptScanner({ parseStatus, parseWarnings, onCapture, onHome }: ReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState("Starting camera");
  const [uploadError, setUploadError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage("Camera is unavailable here. Upload a receipt photo instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraMessage("Camera ready");
      } catch {
        setCameraMessage("Camera permission was denied. Upload a receipt photo instead.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function submitImage(imageDataUrl: string) {
    setUploadError("");
    setIsProcessing(true);
    try {
      await onCapture(imageDataUrl);
    } catch {
      setUploadError("The scan could not finish. Try again with a clear, well-lit receipt photo.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/") && !/\.hei[cf]$/i.test(file.name)) {
      setUploadError("Choose a receipt image file.");
      return;
    }
    try {
      const prepared = await prepareReceiptFile(file);
      await submitImage(prepared.dataUrl);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Receipt image could not be read.");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        void submitImage(canvas.toDataURL("image/png"));
        return;
      }
    }

    setUploadError("Camera is not ready. Upload a receipt photo instead.");
  }

  return (
    <main className="app-shell narrow-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Receipt scanner</p>
          <h1>Scan receipt</h1>
        </div>
        <button type="button" className="secondary nav-button" onClick={onHome}>
          Home
        </button>
      </header>

      <section className="panel scanner-panel">
        <div className="scanner-stage" aria-label="Camera receipt scan frame">
          <video ref={videoRef} autoPlay muted playsInline />
          <div className="scan-frame">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <canvas ref={canvasRef} hidden />
        <div className="scanner-controls">
          <div>
            <strong>{cameraMessage}</strong>
            <p className="muted">
              Align the whole receipt inside the highlighted frame, then capture. Uncertain rows stay editable.
            </p>
          </div>
          <button type="button" onClick={captureFrame} disabled={isProcessing}>
            {isProcessing ? "Reading receipt..." : "Capture receipt"}
          </button>
        </div>
        <label className="upload-control">
          Upload receipt photo
          <input
            type="file"
            accept="image/*,.heic,.heif"
            disabled={isProcessing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </label>
        {uploadError ? <div className="notice warning" role="alert">{uploadError}</div> : null}
        <div className="parse-steps" aria-label="Receipt parse status">
          {["Scanning receipt", "Reading receipt", "Scan failed", "Needs manual review", "Ready to split"].map(
            (status) => (
              <span className={parseStatus === status ? "tag active" : "tag"} key={status}>
                {status}
              </span>
            )
          )}
        </div>
        {parseWarnings.map((warning) => (
          <div className="notice warning" key={warning}>
            {warning}
          </div>
        ))}
      </section>
    </main>
  );
}
