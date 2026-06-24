import {
  applicationDefault,
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: {
    expenseId?: string;
    participantId?: string;
    title?: string;
    body?: string;
  };
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
}

function ensureAdminApp() {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  initializeApp({
    credential: serviceAccount
      ? cert(JSON.parse(serviceAccount))
      : applicationDefault()
  });
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    ensureAdminApp();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const idToken = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!idToken) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const caller = await getAuth().verifyIdToken(idToken);
    const { expenseId, participantId, title, body } = request.body || {};
    if (!expenseId || !participantId || !title || !body) {
      response.status(400).json({ error: "Missing reminder fields." });
      return;
    }

    const firestore = getFirestore();
    const expense = await firestore.collection("expenses").doc(expenseId).get();
    const data = expense.data();
    if (
      !data ||
      data.payerId !== caller.uid ||
      !Array.isArray(data.participantIds) ||
      !data.participantIds.includes(participantId) ||
      participantId === caller.uid
    ) {
      response.status(403).json({ error: "Not allowed to send this reminder." });
      return;
    }

    const devices = await firestore
      .collection("users")
      .doc(participantId)
      .collection("devices")
      .where("enabled", "==", true)
      .get();
    const tokens = devices.docs
      .map((device) => device.data().token)
      .filter((token): token is string => typeof token === "string");
    if (tokens.length === 0) {
      response.status(409).json({ error: "This friend has no push-enabled device." });
      return;
    }

    const result = await getMessaging().sendEachForMulticast({
      tokens,
      webpush: { fcmOptions: { link: "/" } },
      data: { expenseId, title, body }
    });
    response.status(200).json({
      sent: result.successCount,
      failed: result.failureCount
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Push service failed."
    });
  }
}
