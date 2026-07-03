import { describe, expect, it, vi } from "vitest";
import { prepareReceiptFile } from "./receiptImageFile";

function heicBytes(): Uint8Array {
  return new Uint8Array([
    0, 0, 0, 36,
    ...Array.from("ftypheic").map((character) => character.charCodeAt(0)),
    0, 0, 0, 0,
    ...Array.from("mif1").map((character) => character.charCodeAt(0))
  ]);
}

describe("prepareReceiptFile", () => {
  it("converts HEIC bytes even when the filename and MIME type say JPEG", async () => {
    const convertHeic = vi.fn(async () => new Blob(["jpeg"], { type: "image/jpeg" }));
    const file = new File([Uint8Array.from(heicBytes()).buffer], "IMG_1234.jpg", { type: "image/jpeg" });

    const result = await prepareReceiptFile(file, { convertHeic });

    expect(convertHeic).toHaveBeenCalledOnce();
    expect(result.wasConverted).toBe(true);
    expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("does not convert a genuine JPEG", async () => {
    const convertHeic = vi.fn();
    const file = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]).buffer], "receipt.jpg", {
      type: "image/jpeg"
    });

    const result = await prepareReceiptFile(file, { convertHeic });

    expect(convertHeic).not.toHaveBeenCalled();
    expect(result.wasConverted).toBe(false);
  });
});
