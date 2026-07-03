export interface NormalizedReceiptItem {
  name: string;
  quantity: number;
  amount: number;
  confidence: number;
  needsReview: boolean;
}

export interface NormalizedReceiptExtraction {
  merchantName: string;
  receiptDate: string;
  currency: string;
  items: NormalizedReceiptItem[];
  tax: number;
  serviceCharge: number;
  total: number;
  confidence: number;
  warnings: string[];
}
