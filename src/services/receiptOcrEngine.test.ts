import { describe, expect, it, vi } from "vitest";
import { recognizeReceiptImage, type TesseractAdapter } from "./receiptOcrEngine";

function createAdapter(worker: {
  recognize: ReturnType<typeof vi.fn>;
  setParameters?: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}) {
  return {
    createWorker: vi.fn().mockResolvedValue(worker)
  } satisfies TesseractAdapter;
}

describe("recognizeReceiptImage", () => {
  it("requests structured output, flattens nested v7 lines, and terminates its worker", async () => {
    const worker = {
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: "Coffee 120.00\nCake 85.00",
          confidence: 87,
          blocks: [
            {
              paragraphs: [
                {
                  lines: [
                    {
                      text: "Coffee 120.00",
                      confidence: 91,
                      words: [
                        { text: "Coffee", confidence: 93, bbox: { x0: 10, y0: 20, x1: 80, y1: 40 } },
                        { text: "120.00", confidence: 89, bbox: { x0: 180, y0: 20, x1: 240, y1: 40 } }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              paragraphs: [
                {
                  lines: [
                    {
                      text: "Cake 85.00",
                      confidence: 76,
                      words: [
                        { text: "Cake", confidence: 80, bbox: { x0: 10, y0: 50, x1: 60, y1: 70 } },
                        { text: "85.00", confidence: 72, bbox: { x0: 185, y0: 50, x1: 240, y1: 70 } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      }),
      setParameters: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn().mockResolvedValue(undefined)
    };
    const adapter = createAdapter(worker);

    await expect(recognizeReceiptImage("data:image/png;base64,abc", adapter)).resolves.toEqual({
      text: "Coffee 120.00\nCake 85.00",
      confidence: 0.87,
      lines: [
        { text: "Coffee 120.00", confidence: 0.91 },
        { text: "Cake 85.00", confidence: 0.76 }
      ],
      words: [
        { text: "Coffee", confidence: 0.93, bbox: { x0: 10, y0: 20, x1: 80, y1: 40 }, lineIndex: 0 },
        { text: "120.00", confidence: 0.89, bbox: { x0: 180, y0: 20, x1: 240, y1: 40 }, lineIndex: 0 },
        { text: "Cake", confidence: 0.8, bbox: { x0: 10, y0: 50, x1: 60, y1: 70 }, lineIndex: 1 },
        { text: "85.00", confidence: 0.72, bbox: { x0: 185, y0: 50, x1: 240, y1: 70 }, lineIndex: 1 }
      ]
    });
    expect(adapter.createWorker).toHaveBeenCalledWith("eng");
    expect(worker.setParameters).toHaveBeenCalledWith({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
      user_defined_dpi: "300"
    });
    expect(worker.recognize).toHaveBeenCalledWith("data:image/png;base64,abc", {}, { text: true, blocks: true });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("returns an empty line list when v7 blocks are null", async () => {
    const worker = {
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: "Coffee 120.00",
          confidence: 87,
          blocks: null
        }
      }),
      terminate: vi.fn().mockResolvedValue(undefined)
    };

    await expect(recognizeReceiptImage("data:image/png;base64,abc", createAdapter(worker))).resolves.toEqual({
      text: "Coffee 120.00",
      confidence: 0.87,
      lines: [],
      words: []
    });
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
