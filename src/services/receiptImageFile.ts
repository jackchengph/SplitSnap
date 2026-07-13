const maxReceiptBytes = 20 * 1024 * 1024;
const heifBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

interface ReceiptFileOptions {
  convertHeic?: (file: Blob) => Promise<Blob>;
}

export interface PreparedReceiptFile {
  dataUrl: string;
  wasConverted: boolean;
}

function readBlob(blob: Blob, method: "data-url" | "array-buffer"): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string | ArrayBuffer);
    reader.onerror = () => reject(new Error("Receipt image could not be read."));
    if (method === "data-url") reader.readAsDataURL(blob);
    else reader.readAsArrayBuffer(blob);
  });
}

async function isHeif(file: Blob): Promise<boolean> {
  const buffer = await readBlob(file.slice(0, 64), "array-buffer");
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return false;

  for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
    if (heifBrands.has(String.fromCharCode(...bytes.slice(offset, offset + 4)))) return true;
  }
  return false;
}

async function convertHeicToJpeg(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
  return Array.isArray(converted) ? converted[0] : converted;
}

export async function prepareReceiptFile(
  file: File,
  options: ReceiptFileOptions = {}
): Promise<PreparedReceiptFile> {
  if (file.size > maxReceiptBytes) throw new Error("Receipt images must be 20 MB or smaller.");
  const heif = await isHeif(file);
  if (!heif && !file.type.startsWith("image/")) throw new Error("Choose a receipt image file.");

  let image: Blob = file;
  let wasConverted = false;
  if (heif) {
    try {
      image = await (options.convertHeic ?? convertHeicToJpeg)(file);
      wasConverted = true;
    } catch {
      image = file;
    }
  }

  return {
    dataUrl: (await readBlob(image, "data-url")) as string,
    wasConverted
  };
}
