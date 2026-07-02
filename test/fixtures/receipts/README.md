# Receipt OCR Verification Fixtures

Local OCR checks use receipt images from the [CORD v2 dataset](https://huggingface.co/datasets/naver-clova-ix/cord-v2), derived from Clova AI's CORD dataset and published under CC BY 4.0.

The images are downloaded to `/tmp/splitsnap-receipts` for local verification and are not committed to this repository.

| CORD test row | Expected menu rows | Expected total |
| --- | --- | ---: |
| 0 | `-TICKET CP`, quantity `2`, amount `60.000` | `60.000` |
| 1 | `J.STB PROMO` `17500`; `Y.B.BAT` `46000`; `Y.BASO PROM` `27500` | `91000` |
| 2 | `JASMINE MT (L)` `24,000`; `COCONUT JELLY (L)` `4,000` | `28,000` |

These samples intentionally include dark backgrounds, perspective distortion, shadows, blurred private fields, and thermal-print text. They are harder than the clear, tightly framed receipts expected from the scanner guide.

Observed baseline on 2026-07-02:

- Plain full-image Tesseract: 45-61% page confidence; one sample lost all menu rows.
- Crop and upscale before Tesseract on row 1: 70% page confidence; all three expected menu rows and prices were recovered.

The local pipeline therefore includes a light-paper crop candidate in addition to original, grayscale, and high-contrast candidates. Manual review remains required when totals do not reconcile.
