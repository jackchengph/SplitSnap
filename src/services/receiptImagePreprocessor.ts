export interface PreparedReceiptImage {
  name: "original" | "grayscale" | "high-contrast" | "receipt-crop" | "receipt-items";
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
  drawImage(image: BrowserImage, ...coordinates: number[]): void;
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

const maxLongestEdge = 3200;
const maxUpscaleFactor = 2;
const highContrastThreshold = 160;
const paperBrightnessThreshold = 120;
const paperColorSpreadThreshold = 32;

interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

    const variants: PreparedReceiptImage[] = [
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
    const cropBounds = detectReceiptBounds(browser, image, dimensions);
    if (cropBounds) {
      const cropDimensions = scaleDimensions(cropBounds.width, cropBounds.height);
      variants.push({
        name: "receipt-crop",
        imageDataUrl: createVariantImageDataUrl(
          browser,
          image,
          cropDimensions,
          grayscalePixel,
          cropBounds
        )
      });
      if (cropBounds.height > cropBounds.width * 1.25) {
        const itemBounds = {
          x: cropBounds.x,
          y: Math.round(cropBounds.y + cropBounds.height * 0.34),
          width: cropBounds.width,
          height: Math.round(cropBounds.height * 0.3)
        };
        const itemDimensions = scaleDimensions(itemBounds.width, itemBounds.height);
        variants.push({
          name: "receipt-items",
          imageDataUrl: createVariantImageDataUrl(
            browser,
            image,
            itemDimensions,
            grayscalePixel,
            itemBounds
          )
        });
      }
    }
    return variants;
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
  transformPixel: (grayscaleValue: number) => number,
  cropBounds?: CropBounds
): string {
  const canvas = browser.createCanvas(dimensions.width, dimensions.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2d canvas context is unavailable.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (cropBounds) {
    context.drawImage(
      image,
      cropBounds.x,
      cropBounds.y,
      cropBounds.width,
      cropBounds.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
  } else {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

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

function detectReceiptBounds(
  browser: ImageBrowser,
  image: BrowserImage,
  dimensions: { width: number; height: number }
): CropBounds | undefined {
  const canvas = browser.createCanvas(dimensions.width, dimensions.height);
  const context = canvas.getContext("2d");
  if (!context) return undefined;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rowCounts = new Uint32Array(canvas.height);
  const columnCounts = new Uint32Array(canvas.width);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (pixels[offset + 3] < 200) continue;
      const brightness = toGrayscaleValue(
        pixels[offset],
        pixels[offset + 1],
        pixels[offset + 2],
        pixels[offset + 3]
      );
      const colorSpread = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) -
        Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      if (brightness >= paperBrightnessThreshold && colorSpread <= paperColorSpreadThreshold) {
        rowCounts[y] += 1;
        columnCounts[x] += 1;
      }
    }
  }

  const minX = firstIndexAtLeast(columnCounts, canvas.height * 0.12);
  const maxX = lastIndexAtLeast(columnCounts, canvas.height * 0.12);
  const minY = firstIndexAtLeast(rowCounts, canvas.width * 0.12);
  const maxY = lastIndexAtLeast(rowCounts, canvas.width * 0.12);
  if (minX < 0 || maxX <= minX || minY < 0 || maxY <= minY) return undefined;

  const marginX = Math.round(canvas.width * 0.015);
  const marginY = Math.round(canvas.height * 0.015);
  const x = Math.max(0, minX - marginX);
  const y = Math.max(0, minY - marginY);
  const width = Math.min(canvas.width, maxX + marginX + 1) - x;
  const height = Math.min(canvas.height, maxY + marginY + 1) - y;
  const areaRatio = (width * height) / (canvas.width * canvas.height);
  if (areaRatio < 0.2 || areaRatio > 0.94) return undefined;

  const scaleX = image.width / dimensions.width;
  const scaleY = image.height / dimensions.height;
  return {
    x: Math.round(x * scaleX),
    y: Math.round(y * scaleY),
    width: Math.max(1, Math.round(width * scaleX)),
    height: Math.max(1, Math.round(height * scaleY))
  };
}

function firstIndexAtLeast(values: Uint32Array, threshold: number): number {
  return values.findIndex((value) => value >= threshold);
}

function lastIndexAtLeast(values: Uint32Array, threshold: number): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] >= threshold) return index;
  }
  return -1;
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
