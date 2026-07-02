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

interface TesseractRecognitionParagraph {
  lines?: TesseractRecognitionLine[] | null;
}

interface TesseractRecognitionBlock {
  paragraphs?: TesseractRecognitionParagraph[] | null;
}

interface TesseractRecognitionData {
  text?: string | null;
  confidence?: number | null;
  blocks?: TesseractRecognitionBlock[] | null;
}

interface TesseractRecognitionResult {
  data: TesseractRecognitionData;
}

interface TesseractWorker {
  recognize(
    imageDataUrl: string,
    options?: Record<string, never>,
    output?: { text?: boolean; blocks?: boolean }
  ): Promise<TesseractRecognitionResult>;
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
    const result = await worker.recognize(imageDataUrl, {}, { text: true, blocks: true });
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
    lines: flattenLines(data.blocks).map((line) => ({
      text: line.text ?? "",
      confidence: normalizeConfidence(line.confidence)
    }))
  };
}

function flattenLines(blocks: TesseractRecognitionBlock[] | null | undefined): TesseractRecognitionLine[] {
  return (blocks ?? []).flatMap((block) =>
    (block.paragraphs ?? []).flatMap((paragraph) => paragraph.lines ?? [])
  );
}

function normalizeConfidence(confidence: number | null | undefined): number {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return 0;
  }

  return Math.max(0, Math.min(1, confidence / 100));
}
