export interface PreparedReceiptImage {
  name: "original" | "grayscale" | "high-contrast";
  imageDataUrl: string;
}

export interface BrowserImage {
  width: number;
  height: number;
}

interface BrowserImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface BrowserCanvasContext {
  fillStyle: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: BrowserImage, x: number, y: number, width: number, height: number): void;
  getImageData(x: number, y: number, width: number, height: number): BrowserImageData;
  putImageData(imageData: BrowserImageData, x: number, y: number): void;
}

interface BrowserCanvas {
  width: number;
  height: number;
  getContext(kind: "2d"): BrowserCanvasContext | null;
  toDataURL(type?: string): string;
}

export interface ImageBrowser {
  loadImage(imageDataUrl: string): Promise<BrowserImage>;
  createCanvas(width: number, height: number): BrowserCanvas;
}

const maxLongestEdge = 2400;
const maxUpscaleFactor = 2;
const highContrastThreshold = 160;

const defaultImageBrowser: ImageBrowser = {
  async loadImage(imageDataUrl) {
    if (typeof Image === "undefined") {
      throw new Error("Image loading is unavailable.");
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Receipt image could not be loaded."));
      element.src = imageDataUrl;
    });

    return image as BrowserImage;
  },
  createCanvas(width, height) {
    if (typeof document === "undefined") {
      throw new Error("Canvas creation is unavailable.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as BrowserCanvas;
  }
};

export async function prepareReceiptImages(
  imageDataUrl: string,
  browser: ImageBrowser = defaultImageBrowser
): Promise<PreparedReceiptImage[]> {
  const original: PreparedReceiptImage = {
    name: "original",
    imageDataUrl
  };

  try {
    const image = await browser.loadImage(imageDataUrl);
    const dimensions = scaleDimensions(image.width, image.height);

    return [
      original,
      {
        name: "grayscale",
        imageDataUrl: createVariantImageDataUrl(browser, image, dimensions, grayscalePixel)
      },
      {
        name: "high-contrast",
        imageDataUrl: createVariantImageDataUrl(browser, image, dimensions, highContrastPixel)
      }
    ];
  } catch {
    return [original];
  }
}

function scaleDimensions(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new Error("Receipt image dimensions must be positive.");
  }

  const longestEdge = Math.max(width, height);
  const scaleFactor = Math.min(maxLongestEdge / longestEdge, maxUpscaleFactor);

  return {
    width: Math.max(1, Math.round(width * scaleFactor)),
    height: Math.max(1, Math.round(height * scaleFactor))
  };
}

function createVariantImageDataUrl(
  browser: ImageBrowser,
  image: BrowserImage,
  dimensions: { width: number; height: number },
  transformPixel: (grayscaleValue: number) => number
): string {
  const canvas = browser.createCanvas(dimensions.width, dimensions.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2d canvas context is unavailable.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const grayscaleValue = toGrayscaleValue(pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]);
    const nextValue = transformPixel(grayscaleValue);
    pixels[index] = nextValue;
    pixels[index + 1] = nextValue;
    pixels[index + 2] = nextValue;
    pixels[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function toGrayscaleValue(red: number, green: number, blue: number, alpha: number): number {
  const opacity = alpha / 255;
  const flattenedRed = red * opacity + 255 * (1 - opacity);
  const flattenedGreen = green * opacity + 255 * (1 - opacity);
  const flattenedBlue = blue * opacity + 255 * (1 - opacity);

  return Math.round(flattenedRed * 0.299 + flattenedGreen * 0.587 + flattenedBlue * 0.114);
}

function grayscalePixel(grayscaleValue: number): number {
  return grayscaleValue;
}

function highContrastPixel(grayscaleValue: number): number {
  return grayscaleValue >= highContrastThreshold ? 255 : 0;
}
