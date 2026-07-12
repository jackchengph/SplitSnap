import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { sendPushToUser } from "../_lib/push.js";

interface ReminderBody {
  expenseId?: unknown;
  participantId?: unknown;
  title?: unknown;
  body?: unknown;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const callerId = await requireUserId(request);
    const { expenseId, participantId, title, body } = (request.body || {}) as ReminderBody;
    if (!expenseId || !participantId || !title || !body) {
      response.status(400).json({ error: "Missing reminder fields." });
      return;
    }

    if (participantId === callerId) {
      response.status(403).json({ error: "Not allowed to send this reminder." });
      return;
    }

    const result = await sendPushToUser({
      userId: String(participantId),
      expenseId: String(expenseId),
      title: String(title),
      body: String(body),
      link: "/?page=activity"
    });
    if (result.sent === 0) {
      response.status(409).json({ error: "This friend has no push-enabled device." });
      return;
    }

    response.status(200).json({
      sent: result.sent,
      failed: result.failed
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Push service failed."
    });
  }
}
