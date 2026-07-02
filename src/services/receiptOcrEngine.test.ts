import { describe, expect, it, vi } from "vitest";
import { recognizeReceiptImage, type TesseractAdapter } from "./receiptOcrEngine";

function createAdapter(worker: {
  recognize: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}) {
  return {
    createWorker: vi.fn().mockResolvedValue(worker)
  } satisfies TesseractAdapter;
}

describe("recognizeReceiptImage", () => {
  it("normalizes Tesseract confidence, extracts lines, and terminates its worker", async () => {
    const worker = {
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: "Coffee 120.00\nCake 85.00",
          confidence: 87,
          lines: [
            { text: "Coffee 120.00", confidence: 91 },
            { text: "Cake 85.00", confidence: 76 }
          ]
        }
      }),
      terminate: vi.fn().mockResolvedValue(undefined)
    };
    const adapter = createAdapter(worker);

    await expect(recognizeReceiptImage("data:image/png;base64,abc", adapter)).resolves.toEqual({
      text: "Coffee 120.00\nCake 85.00",
      confidence: 0.87,
      lines: [
        { text: "Coffee 120.00", confidence: 0.91 },
        { text: "Cake 85.00", confidence: 0.76 }
      ]
    });
    expect(adapter.createWorker).toHaveBeenCalledWith("eng");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates the worker when recognition throws", async () => {
    const worker = {
      recognize: vi.fn().mockRejectedValue(new Error("recognition failed")),
      terminate: vi.fn().mockResolvedValue(undefined)
    };

    await expect(recognizeReceiptImage("bad", createAdapter(worker))).rejects.toThrow(/recognition failed/i);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
