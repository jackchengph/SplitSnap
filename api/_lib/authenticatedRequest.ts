import { adminAuth } from "./firebaseAdmin.js";

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(value: unknown): void;
}

function readBearerToken(request: ApiRequest): string {
  const authorization = request.headers.authorization;
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new Error("Authentication required.");
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new Error("Authentication required.");
  }
  return token;
}

export async function requireUserId(request: ApiRequest): Promise<string> {
  try {
    const token = readBearerToken(request);
    const decodedToken = await adminAuth().verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    throw new Error("Authentication required.");
  }
}
