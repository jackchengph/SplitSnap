import { describe, expect, it } from "vitest";
import { prepareReceiptImages, type ImageBrowser } from "./receiptImagePreprocessor";

interface FakeImageBitmap {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

interface DrawOperation {
  width: number;
  height: number;
  backgroundColor?: string;
}

interface FakeCanvasRecord {
  width: number;
  height: number;
  draws: DrawOperation[];
  snapshots: Array<{ stage: string; pixels: number[] }>;
}

function createUnavailableBrowser(): ImageBrowser {
  return {
    async loadImage() {
      throw new Error("Canvas support unavailable.");
    },
    createCanvas() {
      throw new Error("Canvas support unavailable.");
    }
  };
}

function createCanvasBrowser(image: FakeImageBitmap, records: FakeCanvasRecord[]): ImageBrowser {
  return {
    async loadImage() {
      return image;
    },
    createCanvas(width, height) {
      const record: FakeCanvasRecord = {
        width,
        height,
        draws: [],
        snapshots: []
      };
      records.push(record);
      return createFakeCanvas(record, image);
    }
  };
}

function createDimensionOnlyBrowser(
  dimensions: { width: number; height: number },
  records: FakeCanvasRecord[]
): ImageBrowser {
  return {
    async loadImage() {
      return {
        width: dimensions.width,
        height: dimensions.height
      };
    },
    createCanvas(width, height) {
      const record: FakeCanvasRecord = {
        width,
        height,
        draws: [],
        snapshots: []
      };
      records.push(record);
      return {
        width,
        height,
        getContext(kind: string) {
          if (kind !== "2d") {
            return null;
          }

          return {
            fillStyle: "#ffffff",
            fillRect() {},
            drawImage() {},
            getImageData() {
              return {
                data: Uint8ClampedArray.from([0, 0, 0, 255]),
                width,
                height
              };
            },
            putImageData() {}
          };
        },
        toDataURL() {
          return `mock://canvas/${width}x${height}`;
        }
      };
    }
  };
}

function createFakeCanvas(record: FakeCanvasRecord, sourceImage: FakeImageBitmap) {
  const pixels = new Uint8ClampedArray(record.width * record.height * 4);
  const context = {
    fillStyle: "#000000",
    drawImage(_image: FakeImageBitmap, ...coordinates: number[]) {
      const width = coordinates.length >= 8 ? coordinates[6] : coordinates[2];
      const height = coordinates.length >= 8 ? coordinates[7] : coordinates[3];
      record.draws.push({ width, height, backgroundColor: this.fillStyle });
      const resized = resizePixels(sourceImage, width, height);
      pixels.set(resized);
      record.snapshots.push({ stage: "drawImage", pixels: Array.from(pixels) });
    },
    fillRect() {
      fillAllPixels(pixels, this.fillStyle);
      record.snapshots.push({ stage: "fillRect", pixels: Array.from(pixels) });
    },
    getImageData() {
      return {
        data: new Uint8ClampedArray(pixels),
        width: record.width,
        height: record.height
      };
    },
    putImageData(imageData: { data: Uint8ClampedArray }) {
      pixels.set(imageData.data);
      record.snapshots.push({ stage: "putImageData", pixels: Array.from(pixels) });
    }
  };

  return {
    width: record.width,
    height: record.height,
    getContext(kind: string) {
      return kind === "2d" ? context : null;
    },
    toDataURL() {
      if (pixels.length > 4_096) {
        return `mock://canvas/${record.width}x${record.height}`;
      }

      return JSON.stringify({
        width: record.width,
        height: record.height,
        pixels: Array.from(pixels)
      });
    }
  };
}

function fillAllPixels(pixels: Uint8ClampedArray, color: string): void {
  const rgba =
    color === "#ffffff" || color === "white" ? [255, 255, 255, 255] : [0, 0, 0, 255];

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = rgba[0];
    pixels[index + 1] = rgba[1];
    pixels[index + 2] = rgba[2];
    pixels[index + 3] = rgba[3];
  }
}

function resizePixels(image: FakeImageBitmap, width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x / width) * image.width));
      const sourceY = Math.min(image.height - 1, Math.floor((y / height) * image.height));
      const sourceOffset = (sourceY * image.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;

      pixels[targetOffset] = image.pixels[sourceOffset];
      pixels[targetOffset + 1] = image.pixels[sourceOffset + 1];
      pixels[targetOffset + 2] = image.pixels[sourceOffset + 2];
      pixels[targetOffset + 3] = image.pixels[sourceOffset + 3];
    }
  }

  return pixels;
}

function parseVariantPixels(imageDataUrl: string): number[] {
  return (JSON.parse(imageDataUrl) as { pixels: number[] }).pixels;
}

describe("prepareReceiptImages", () => {
  it("always preserves the original image when browser preprocessing is unavailable", async () => {
    await expect(prepareReceiptImages("data:image/png;base64,abc", createUnavailableBrowser())).resolves.toEqual([
      { name: "original", imageDataUrl: "data:image/png;base64,abc" }
    ]);
  });

  it("returns grayscale and high-contrast variants when canvas preprocessing is available", async () => {
    const records: FakeCanvasRecord[] = [];
    const browser = createCanvasBrowser(
      {
        width: 2,
        height: 1,
        pixels: Uint8ClampedArray.from([
          10,
          20,
          30,
          255,
          0,
          0,
          0,
          0
        ])
      },
      records
    );

    const variants = await prepareReceiptImages("data:image/png;base64,abc", browser);

    expect(variants.map((variant) => variant.name)).toEqual(["original", "grayscale", "high-contrast"]);
    expect(records).toHaveLength(3);
    expect(records[0].width).toBe(4);
    expect(records[0].height).toBe(2);
    expect(records[1].width).toBe(4);
    expect(records[1].height).toBe(2);

    const grayscalePixels = parseVariantPixels(variants[1].imageDataUrl);
    const thresholdPixels = parseVariantPixels(variants[2].imageDataUrl);

    expect(grayscalePixels.slice(0, 8)).toEqual([18, 18, 18, 255, 18, 18, 18, 255]);
    expect(grayscalePixels.slice(8, 16)).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
    expect(thresholdPixels.slice(0, 8)).toEqual([0, 0, 0, 255, 0, 0, 0, 255]);
    expect(thresholdPixels.slice(8, 16)).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it("caps the longest edge at 3200 pixels while preserving aspect ratio", async () => {
    const records: FakeCanvasRecord[] = [];
    const browser = createDimensionOnlyBrowser({ width: 3000, height: 1500 }, records);

    await prepareReceiptImages("data:image/png;base64,abc", browser);

    expect(records[0].width).toBe(3200);
    expect(records[0].height).toBe(1600);
    expect(records[1].width).toBe(3200);
    expect(records[1].height).toBe(1600);
  });

  it("adds a cropped receipt candidate when light paper is surrounded by a dark background", async () => {
    const pixels = new Uint8ClampedArray(10 * 10 * 4);
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        const offset = (y * 10 + x) * 4;
        const isPaper = x >= 2 && x <= 7 && y >= 1 && y <= 8;
        pixels[offset] = isPaper ? 230 : 15;
        pixels[offset + 1] = isPaper ? 230 : 15;
        pixels[offset + 2] = isPaper ? 230 : 15;
        pixels[offset + 3] = 255;
      }
    }
    const records: FakeCanvasRecord[] = [];

    const variants = await prepareReceiptImages(
      "data:image/jpeg;base64,receipt",
      createCanvasBrowser({ width: 10, height: 10, pixels }, records)
    );

    expect(variants.map((variant) => variant.name)).toEqual([
      "original",
      "grayscale",
      "high-contrast",
      "receipt-crop",
      "receipt-items"
    ]);
  });
});
