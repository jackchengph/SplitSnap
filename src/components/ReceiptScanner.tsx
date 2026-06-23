import { useEffect, useRef, useState } from "react";
import type { ParseStatus } from "../domain/types";

interface ReceiptScannerProps {
  parseStatus: ParseStatus;
  parseWarnings: string[];
  onCapture: (imageDataUrl: string) => void;
  onBack: () => void;
}

function fallbackReceiptImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" fill="#f9faf7"/><rect x="124" y="96" width="472" height="768" rx="18" fill="#fff" stroke="#1f2933" stroke-width="6"/><text x="360" y="172" text-anchor="middle" font-family="Arial" font-size="38" font-weight="700">Sora Sushi Bar</text><text x="180" y="260" font-family="Arial" font-size="30">Sushi platter</text><text x="540" y="260" font-family="Arial" font-size="30" text-anchor="end">1200</text><text x="180" y="324" font-family="Arial" font-size="30">Tonkotsu ramen</text><text x="540" y="324" font-family="Arial" font-size="30" text-anchor="end">620</text><text x="180" y="388" font-family="Arial" font-size="30">Tempura basket</text><text x="540" y="388" font-family="Arial" font-size="30" text-anchor="end">720</text><text x="180" y="452" font-family="Arial" font-size="30">Iced tea pitcher</text><text x="540" y="452" font-family="Arial" font-size="30" text-anchor="end">420</text><text x="180" y="516" font-family="Arial" font-size="30">Matcha cheesecake</text><text x="540" y="516" font-family="Arial" font-size="30" text-anchor="end">1020</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function ReceiptScanner({ parseStatus, parseWarnings, onCapture, onBack }: ReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState("Starting camera");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage("Camera is unavailable here. You can still use the capture button to test the parsing flow.");
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
        setCameraMessage("Camera permission was denied. Use the capture button when you are ready to continue with a sample scan.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        onCapture(canvas.toDataURL("image/png"));
        return;
      }
    }

    onCapture(fallbackReceiptImage());
  }

  return (
    <main className="app-shell narrow-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Camera + OCR</p>
          <h1>Scan receipt</h1>
        </div>
        <button type="button" className="secondary nav-button" onClick={onBack}>
          Back to group
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
              Align the whole receipt inside the highlighted frame, then capture. OCR runs first, unclear regions get YOLO-style fallback, and unresolved rows stay editable.
            </p>
          </div>
          <button type="button" onClick={captureFrame}>
            Capture receipt
          </button>
        </div>
        <div className="parse-steps" aria-label="Receipt parse status">
          {["Scanning receipt", "OCR reading items", "Checking unclear areas", "Needs manual review", "Ready to split"].map(
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
