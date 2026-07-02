export interface OcrRecognition {
  text: string;
  confidence: number;
  lines: Array<{
    text: string;
    confidence: number;
  }>;
}

interface TesseractRecognitionLine {
  text?: string | null;
  confidence?: number | null;
}

interface TesseractRecognitionData {
  text?: string | null;
  confidence?: number | null;
  lines?: TesseractRecognitionLine[] | null;
}

interface TesseractRecognitionResult {
  data: TesseractRecognitionData;
}

interface TesseractWorker {
  recognize(imageDataUrl: string): Promise<TesseractRecognitionResult>;
  terminate(): Promise<unknown>;
}

export interface TesseractAdapter {
  createWorker(language: string): Promise<TesseractWorker>;
}

const defaultTesseractAdapter: TesseractAdapter = {
  async createWorker(language) {
    const { createWorker } = await import("tesseract.js");
    return (await createWorker(language)) as unknown as TesseractWorker;
  }
};

export async function recognizeReceiptImage(
  imageDataUrl: string,
  adapter: TesseractAdapter = defaultTesseractAdapter
): Promise<OcrRecognition> {
  let worker: TesseractWorker | undefined;

  try {
    worker = await adapter.createWorker("eng");
    const result = await worker.recognize(imageDataUrl);
    return normalizeRecognition(result.data);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

function normalizeRecognition(data: TesseractRecognitionData): OcrRecognition {
  return {
    text: data.text ?? "",
    confidence: normalizeConfidence(data.confidence),
    lines: (data.lines ?? []).map((line) => ({
      text: line.text ?? "",
      confidence: normalizeConfidence(line.confidence)
    }))
  };
}

function normalizeConfidence(confidence: number | null | undefined): number {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return 0;
  }

  return Math.max(0, Math.min(1, confidence / 100));
}
