import { createHash } from "node:crypto";
import type { UserProfile } from "../../src/domain/accountTypes";
import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest";
import { adminAuth, adminFirestore } from "../_lib/firebaseAdmin";

interface BootstrapBody {
  timezone?: unknown;
}

interface HandleClaim {
  userId: string;
}

interface FriendCodeClaim {
  userId: string;
}

const supportedTimezones = new Set(Intl.supportedValuesOf("timeZone"));

function sanitizeBaseHandle(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const trimmed = normalized.slice(0, 24).replace(/^_+|_+$/g, "");
  return trimmed.length >= 3 ? trimmed : "user";
}

function handleCandidates(baseHandle: string): string[] {
  const candidates = [baseHandle];
  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const suffixText = String(suffix);
    candidates.push(
      `${baseHandle.slice(0, Math.max(3, 24 - suffixText.length))}${suffixText}`
    );
  }
  return candidates;
}

function profileCodeSalt(): string {
  const salt = process.env.PROFILE_CODE_SALT;
  if (!salt) {
    throw new Error("PROFILE_CODE_SALT must be configured.");
  }
  return salt;
}

function friendCodeCandidate(uid: string, suffix = 0): string {
  const digest = createHash("sha256")
    .update(`${uid}:${profileCodeSalt()}:${suffix}`)
    .digest("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  const code = digest.slice(0, 8);
  if (code.length === 8) {
    return code;
  }
  return `${code}PROFILE`.slice(0, 8);
}

function readTimezone(body: unknown): string {
  const timezone = (body as BootstrapBody | null)?.timezone;
  if (typeof timezone !== "string" || !supportedTimezones.has(timezone)) {
    throw new Error("A valid timezone is required.");
  }
  return timezone;
}

function createProfile(input: {
  uid: string;
  displayName: string;
  photoURL: string | null;
  handle: string;
  friendCode: string;
  timezone: string;
  now: string;
}): UserProfile {
  return {
    id: input.uid,
    displayName: input.displayName,
    photoURL: input.photoURL,
    handle: input.handle,
    friendCode: input.friendCode,
    discoverableByHandle: true,
    timezone: input.timezone,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const timezone = readTimezone(request.body);
    const uid = await requireUserId(request);
    const firestore = adminFirestore();
    const existingProfileSnapshot = await firestore.doc(`users/${uid}`).get();
    if (existingProfileSnapshot.exists) {
      response.status(200).json(existingProfileSnapshot.data());
      return;
    }

    const authUser = await adminAuth().getUser(uid);
    const displayName =
      authUser.displayName || authUser.email?.split("@")[0] || "SplitSnap user";
    const baseHandle = sanitizeBaseHandle(displayName || authUser.email || uid);
    const now = new Date().toISOString();

    const createdProfile = await firestore.runTransaction<UserProfile>(
      async (transaction) => {
        const userRef = firestore.doc(`users/${uid}`);
        const existingUser = await transaction.get(userRef);
        if (existingUser.exists) {
          return existingUser.data() as UserProfile;
        }

        let claimedHandle = "";
        for (const candidate of handleCandidates(baseHandle)) {
          const handleRef = firestore.doc(`handles/${candidate}`);
          const snapshot = await transaction.get(handleRef);
          const ownerId = (snapshot.data() as HandleClaim | undefined)?.userId;
          if (!snapshot.exists || ownerId === uid) {
            claimedHandle = candidate;
            transaction.set(handleRef, { userId: uid });
            break;
          }
        }
        if (!claimedHandle) {
          throw new Error("No handle is currently available.");
        }

        let claimedFriendCode = "";
        for (let suffix = 0; suffix < 100; suffix += 1) {
          const candidate = friendCodeCandidate(uid, suffix);
          const friendCodeRef = firestore.doc(`friendCodes/${candidate}`);
          const snapshot = await transaction.get(friendCodeRef);
          const ownerId = (snapshot.data() as FriendCodeClaim | undefined)?.userId;
          if (!snapshot.exists || ownerId === uid) {
            claimedFriendCode = candidate;
            transaction.set(friendCodeRef, { userId: uid });
            break;
          }
        }
        if (!claimedFriendCode) {
          throw new Error("No friend code is currently available.");
        }

        const profile = createProfile({
          uid,
          displayName,
          photoURL: authUser.photoURL || null,
          handle: claimedHandle,
          friendCode: claimedFriendCode,
          timezone,
          now
        });
        transaction.set(userRef, profile);
        transaction.set(firestore.doc(`publicProfiles/${uid}`), {
          id: profile.id,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          handle: profile.handle
        });
        return profile;
      }
    );

    response.status(200).json(createdProfile);
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required.") {
      response.status(401).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message === "A valid timezone is required.") {
      response.status(400).json({ error: error.message });
      return;
    }

    response.status(500).json({
      error:
        error instanceof Error ? error.message : "Profile could not be created."
    });
  }
}
