export type PaymentStatus = "unpaid" | "reminded" | "paid";
export type ReceiptParseSource = "ocr" | "yolo" | "manual";
export type PayerStep = "home" | "friends" | "group" | "scanner" | "parsing" | "review";
export type ParseStatus =
  | "Idle"
  | "Scanning receipt"
  | "OCR reading items"
  | "Checking unclear areas"
  | "Needs manual review"
  | "Ready to split";

export type ReliabilityTag =
  | "Pays on time"
  | "Needs reminder"
  | "Often late"
  | "Quick to settle";

export interface PaymentHistoryEntry {
  expenseId: string;
  paidAtDaysFromDue: number;
  remindersSent: number;
}

export interface Friend {
  id: string;
  name: string;
  avatarLabel: string;
  avatarHue: number;
  reliabilityScore: number;
  tags: ReliabilityTag[];
  paymentHistory: PaymentHistoryEntry[];
  currentUnpaidBalance: number;
}

export interface DinnerGroup {
  id: string;
  name: string;
  payerId: string;
  participantIds: string[];
}

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  assignedParticipantIds: string[];
  confidence: number;
  parseSource?: ReceiptParseSource;
  needsReview?: boolean;
}

export interface Receipt {
  id: string;
  merchantName: string;
  date: string;
  imageUrl: string;
  ocrConfidence: number;
  parserMode: "sample" | "simulated-upload" | "camera-ocr-yolo";
  parseStatus?: ParseStatus;
  parseWarnings?: string[];
  items: ReceiptItem[];
  tax: number;
  serviceCharge: number;
  total: number;
}

export interface ItemShare {
  itemId: string;
  itemName: string;
  share: number;
}

export interface SplitResult {
  participantId: string;
  itemShares: ItemShare[];
  subtotal: number;
  taxShare: number;
  serviceShare: number;
  totalOwed: number;
  status: PaymentStatus;
}

export interface SplitWarning {
  type: "unassigned-items" | "total-mismatch" | "no-participants";
  message: string;
}

export interface SplitSummary {
  results: SplitResult[];
  warnings: SplitWarning[];
  assignedSubtotal: number;
  calculatedTotal: number;
}

export interface Notification {
  id: string;
  participantId: string;
  expenseId: string;
  type: "expense-created" | "payment-reminder" | "due-date-follow-up";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface ExtractedPaymentDetails {
  amount: number;
  transactionDate: string;
  transactionNumber: string;
  senderName: string;
  recipientName: string;
}

export interface PaymentProofValidation {
  valid: boolean;
  reasons: string[];
}

export interface PaymentProof {
  id: string;
  participantId: string;
  fileName: string;
  uploadedAt: string;
  extracted: ExtractedPaymentDetails;
  validation: PaymentProofValidation;
}
