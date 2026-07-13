import { createSign } from "node:crypto";
import { createSupabaseServiceClient } from "./supabaseServer.js";

async function getSupabaseDeviceTokens(userId: string): Promise<string[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return [];
  }

  const result = await supabase
    .from("user_devices")
    .select("fcm_token")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? [])
    .map((device) => device.fcm_token)
    .filter((token): token is string => typeof token === "string" && token.length > 0);
}

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function serviceAccount(): FirebaseServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw.trim()) {
    throw new Error("Firebase service account is not configured.");
  }

  return JSON.parse(raw) as FirebaseServiceAccount;
}

async function getAccessToken(account: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(account.private_key));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error || "Firebase access token could not be created.");
  }
  return result.access_token;
}

async function sendFcmMessage(input: {
  token: string;
  title: string;
  body: string;
  expenseId?: string;
  link?: string;
}): Promise<boolean> {
  const account = serviceAccount();
  const projectId = account.project_id || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  const accessToken = await getAccessToken(account);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token: input.token,
        notification: {
          title: input.title,
          body: input.body
        },
        webpush: {
          fcm_options: { link: input.link ?? "/?page=activity" }
        },
        data: {
          expenseId: input.expenseId ?? "",
          title: input.title,
          body: input.body,
          link: input.link ?? "/?page=activity"
        }
      }
    })
  });

  return response.ok;
}

export async function sendPushToUser(input: {
  userId: string;
  title: string;
  body: string;
  expenseId?: string;
  link?: string;
}): Promise<{ sent: number; failed: number }> {
  const tokens = [...new Set(await getSupabaseDeviceTokens(input.userId))];

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.all(
    tokens.map((token) =>
      sendFcmMessage({
        token,
        title: input.title,
        body: input.body,
        expenseId: input.expenseId,
        link: input.link
      })
    )
  );
  const sent = results.filter(Boolean).length;
  return { sent, failed: tokens.length - sent };
}

export async function sendPushToUsers(input: {
  userIds: string[];
  title: string;
  body: string;
  expenseId?: string;
  link?: string;
}): Promise<{ sent: number; failed: number }> {
  const results = await Promise.all(
    input.userIds.map((userId) =>
      sendPushToUser({
        userId,
        title: input.title,
        body: input.body,
        expenseId: input.expenseId,
        link: input.link
      })
    )
  );

  return results.reduce(
    (total, result) => ({
      sent: total.sent + result.sent,
      failed: total.failed + result.failed
    }),
    { sent: 0, failed: 0 }
  );
}
