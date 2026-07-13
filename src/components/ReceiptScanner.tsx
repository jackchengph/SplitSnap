import { useEffect, useRef, useState } from "react";
interface ReceiptScannerProps {
  onCapture: (imageDataUrl: string) => void | Promise<void>;
  onHome: () => void;
}

function fallbackReceiptImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" fill="#f9faf7"/><rect x="124" y="96" width="472" height="768" rx="18" fill="#fff" stroke="#1f2933" stroke-width="6"/><text x="360" y="172" text-anchor="middle" font-family="Arial" font-size="38" font-weight="700">Scanned receipt</text><text x="180" y="260" font-family="Arial" font-size="30">Shared platter</text><text x="540" y="260" font-family="Arial" font-size="30" text-anchor="end">1200</text><text x="180" y="324" font-family="Arial" font-size="30">Main dish</text><text x="540" y="324" font-family="Arial" font-size="30" text-anchor="end">620</text><text x="180" y="388" font-family="Arial" font-size="30">Shared side</text><text x="540" y="388" font-family="Arial" font-size="30" text-anchor="end">720</text><text x="180" y="452" font-family="Arial" font-size="30">Drinks</text><text x="540" y="452" font-family="Arial" font-size="30" text-anchor="end">420</text><text x="180" y="516" font-family="Arial" font-size="30">Dessert</text><text x="540" y="516" font-family="Arial" font-size="30" text-anchor="end">1020</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const captureLongestEdge = 1600;
const captureJpegQuality = 0.78;

export function createReceiptCaptureDataUrl(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null
): string {
  if (!video || !canvas || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return fallbackReceiptImage();
  }

  const scale = Math.min(1, captureLongestEdge / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return fallbackReceiptImage();
  }

  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", captureJpegQuality);
}

export function ReceiptScanner({ onCapture, onHome }: ReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState("Starting camera");
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage("Camera is unavailable here. You can still continue with a sample receipt.");
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
        setCameraMessage("Camera permission was denied. Use the capture button when you are ready to continue with a sample receipt.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function captureFrame() {
    if (isCapturing) return;
    setIsCapturing(true);
    setCameraMessage("Preparing image");

    try {
      await onCapture(createReceiptCaptureDataUrl(videoRef.current, canvasRef.current));
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <main className="app-shell narrow-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Receipt camera</p>
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
              Align the whole receipt inside the highlighted frame, then capture. You can review and edit every item before saving.
            </p>
          </div>
          <button type="button" disabled={isCapturing} onClick={() => void captureFrame()}>
            {isCapturing ? "Preparing..." : "Capture receipt"}
          </button>
        </div>
      </section>
    </main>
  );
}
