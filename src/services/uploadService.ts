import {
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage
} from "firebase/storage";
import { firebaseRuntime } from "../platform/firebase";

function requireStorage(): FirebaseStorage {
  if (!firebaseRuntime.storage) {
    throw new Error("Firebase Storage is not configured.");
  }
  return firebaseRuntime.storage;
}

async function uploadFile(path: string, file: Blob): Promise<string> {
  const target = ref(requireStorage(), path);
  await uploadBytes(target, file, {
    contentType: file.type || "application/octet-stream"
  });
  return getDownloadURL(target);
}

export function uploadReceiptImage(
  userId: string,
  expenseId: string,
  file: Blob
): Promise<string> {
  return uploadFile(`users/${userId}/expenses/${expenseId}/receipt`, file);
}

export function uploadPaymentProof(
  userId: string,
  expenseId: string,
  file: Blob
): Promise<string> {
  return uploadFile(
    `users/${userId}/expenses/${expenseId}/proofs/${Date.now()}`,
    file
  );
}
