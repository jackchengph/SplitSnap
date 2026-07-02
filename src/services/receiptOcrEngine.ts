export interface OcrRecognition {
  text: string;
  confidence: number;
  lines: Array<{
    text: string;
    confidence: number;
  }>;
  words: OcrWord[];
}

export interface OcrBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
  lineIndex: number;
}

interface TesseractRecognitionWord {
  text?: string | null;
  confidence?: number | null;
  bbox?: Partial<OcrBoundingBox> | null;
}

interface TesseractRecognitionLine {
  text?: string | null;
  confidence?: number | null;
  words?: TesseractRecognitionWord[] | null;
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
  setParameters?(parameters: { preserve_interword_spaces: string }): Promise<unknown>;
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
    await worker.setParameters?.({ preserve_interword_spaces: "1" });
    const result = await worker.recognize(imageDataUrl, {}, { text: true, blocks: true });
    return normalizeRecognition(result.data);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

function normalizeRecognition(data: TesseractRecognitionData): OcrRecognition {
  const lines = flattenLines(data.blocks);
  return {
    text: data.text ?? "",
    confidence: normalizeConfidence(data.confidence),
    lines: lines.map((line) => ({
      text: line.text ?? "",
      confidence: normalizeConfidence(line.confidence)
    })),
    words: lines.flatMap((line, lineIndex) =>
      (line.words ?? []).map((word) => ({
        text: word.text ?? "",
        confidence: normalizeConfidence(word.confidence),
        bbox: normalizeBoundingBox(word.bbox),
        lineIndex
      }))
    )
  };
}

function normalizeBoundingBox(bbox: Partial<OcrBoundingBox> | null | undefined): OcrBoundingBox {
  return {
    x0: finiteCoordinate(bbox?.x0),
    y0: finiteCoordinate(bbox?.y0),
    x1: finiteCoordinate(bbox?.x1),
    y1: finiteCoordinate(bbox?.y1)
  };
}

function finiteCoordinate(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
