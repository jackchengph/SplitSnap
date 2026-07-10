import { createHash } from "node:crypto";
import type { UserProfile } from "../../src/domain/accountTypes.js";
import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { adminAuth, adminFirestore } from "../_lib/firebaseAdmin.js";
import { upsertSupabaseProfile } from "../_lib/supabaseProfiles.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

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
const handlePattern = /^[a-z0-9_]{3,24}$/;

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

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readPhotoURL(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readExistingTimezone(value: unknown): string | null {
  return typeof value === "string" && supportedTimezones.has(value) ? value : null;
}

function isClaimAvailable(
  claim: HandleClaim | FriendCodeClaim | undefined,
  exists: boolean,
  uid: string
): boolean {
  return !exists || claim?.userId === uid;
}

function isCompleteProfile(profile: unknown): profile is UserProfile {
  if (!profile || typeof profile !== "object") {
    return false;
  }

  const record = profile as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.displayName === "string" &&
    (typeof record.photoURL === "string" || record.photoURL === null) &&
    typeof record.handle === "string" &&
    handlePattern.test(record.handle) &&
    typeof record.friendCode === "string" &&
    record.friendCode.length === 8 &&
    typeof record.discoverableByHandle === "boolean" &&
    typeof record.timezone === "string" &&
    supportedTimezones.has(record.timezone) &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function createPublicProfile(profile: UserProfile) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    handle: profile.handle
  };
}

function matchesPublicProfile(profile: UserProfile, publicProfile: unknown): boolean {
  if (!publicProfile || typeof publicProfile !== "object") {
    return false;
  }

  const record = publicProfile as Record<string, unknown>;
  return (
    record.id === profile.id &&
    record.displayName === profile.displayName &&
    record.photoURL === profile.photoURL &&
    record.handle === profile.handle
  );
}

function createProfile(input: {
  uid: string;
  displayName: string;
  photoURL: string | null;
  handle: string;
  friendCode: string;
  timezone: string;
  discoverableByHandle: boolean;
  createdAt: string;
  updatedAt: string;
}): UserProfile {
  return {
    id: input.uid,
    displayName: input.displayName,
    photoURL: input.photoURL,
    handle: input.handle,
    friendCode: input.friendCode,
    discoverableByHandle: input.discoverableByHandle,
    timezone: input.timezone,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
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
    const userRef = firestore.doc(`users/${uid}`);
    const publicProfileRef = firestore.doc(`publicProfiles/${uid}`);

    const createdProfile = await firestore.runTransaction<UserProfile>(
      async (transaction) => {
        const existingUser = await transaction.get(userRef);
        const existingData = existingUser.data() as Record<string, unknown> | undefined;

        if (isCompleteProfile(existingData)) {
          const handleSnapshot = await transaction.get(
            firestore.doc(`handles/${existingData.handle}`)
          );
          const friendCodeSnapshot = await transaction.get(
            firestore.doc(`friendCodes/${existingData.friendCode}`)
          );
          const publicProfileSnapshot = await transaction.get(publicProfileRef);

          if (
            isClaimAvailable(
              handleSnapshot.data() as HandleClaim | undefined,
              handleSnapshot.exists,
              uid
            ) &&
            isClaimAvailable(
              friendCodeSnapshot.data() as FriendCodeClaim | undefined,
              friendCodeSnapshot.exists,
              uid
            ) &&
            matchesPublicProfile(existingData, publicProfileSnapshot.data())
          ) {
            return existingData;
          }
        }

        const authUser = await adminAuth().getUser(uid);
        const displayName =
          readString(existingData?.displayName) ||
          authUser.displayName ||
          authUser.email?.split("@")[0] ||
          "SplitSnap user";
        const photoURL = readPhotoURL(existingData?.photoURL) ?? authUser.photoURL ?? null;
        const baseHandle = sanitizeBaseHandle(displayName || authUser.email || uid);

        const handleOptions = [
          readString(existingData?.handle),
          ...handleCandidates(baseHandle)
        ].filter((candidate, index, candidates): candidate is string => {
          return (
            typeof candidate === "string" &&
            handlePattern.test(candidate) &&
            candidates.indexOf(candidate) === index
          );
        });

        let claimedHandle = "";
        for (const candidate of handleOptions) {
          const handleRef = firestore.doc(`handles/${candidate}`);
          const snapshot = await transaction.get(handleRef);
          const claim = snapshot.data() as HandleClaim | undefined;
          if (isClaimAvailable(claim, snapshot.exists, uid)) {
            claimedHandle = candidate;
            transaction.set(handleRef, { userId: uid });
            break;
          }
        }
        if (!claimedHandle) {
          throw new Error("No handle is currently available.");
        }

        const friendCodeOptions = [
          readString(existingData?.friendCode),
          ...Array.from({ length: 100 }, (_, suffix) => friendCodeCandidate(uid, suffix))
        ].filter((candidate, index, candidates): candidate is string => {
          return (
            typeof candidate === "string" &&
            candidate.length === 8 &&
            candidates.indexOf(candidate) === index
          );
        });

        let claimedFriendCode = "";
        for (const candidate of friendCodeOptions) {
          const friendCodeRef = firestore.doc(`friendCodes/${candidate}`);
          const snapshot = await transaction.get(friendCodeRef);
          const claim = snapshot.data() as FriendCodeClaim | undefined;
          if (isClaimAvailable(claim, snapshot.exists, uid)) {
            claimedFriendCode = candidate;
            transaction.set(friendCodeRef, { userId: uid });
            break;
          }
        }
        if (!claimedFriendCode) {
          throw new Error("No friend code is currently available.");
        }

        const now = new Date().toISOString();
        const profile = createProfile({
          uid,
          displayName,
          photoURL,
          handle: claimedHandle,
          friendCode: claimedFriendCode,
          timezone: readExistingTimezone(existingData?.timezone) ?? timezone,
          discoverableByHandle:
            typeof existingData?.discoverableByHandle === "boolean"
              ? existingData.discoverableByHandle
              : true,
          createdAt: readString(existingData?.createdAt) ?? now,
          updatedAt: now
        });
        transaction.set(userRef, profile);
        transaction.set(publicProfileRef, createPublicProfile(profile));
        return profile;
      }
    );

    const supabase = createSupabaseServiceClient();
    if (supabase) {
      await upsertSupabaseProfile(supabase as never, createdProfile);
    }

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
