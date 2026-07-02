import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-splitsnap";
const now = Timestamp.fromDate(new Date("2026-07-01T10:00:00.000Z"));
const later = Timestamp.fromDate(new Date("2026-07-01T10:05:00.000Z"));

let testEnvironment: RulesTestEnvironment;

async function seedProfiles(): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();

    await setDoc(doc(database, "users/maya"), {
      id: "maya",
      displayName: "Maya",
      photoURL: null,
      handle: "mayaeats",
      friendCode: "MAYA8F2Q",
      discoverableByHandle: true,
      timezone: "Asia/Manila",
      createdAt: now,
      updatedAt: now
    });
    await setDoc(doc(database, "users/nico"), {
      id: "nico",
      displayName: "Nico",
      photoURL: null,
      handle: "nicoeats",
      friendCode: "NICO8F2Q",
      discoverableByHandle: true,
      timezone: "Asia/Manila",
      createdAt: now,
      updatedAt: now
    });
    await setDoc(doc(database, "publicProfiles/maya"), {
      id: "maya",
      displayName: "Maya",
      photoURL: null,
      handle: "mayaeats"
    });
    await setDoc(doc(database, "publicProfiles/nico"), {
      id: "nico",
      displayName: "Nico",
      photoURL: null,
      handle: "nicoeats"
    });
    await setDoc(doc(database, "friendCodes/NICO8F2Q"), {
      userId: "nico"
    });
    await setDoc(doc(database, "handles/nicoeats"), {
      userId: "nico"
    });
  });
}

function friendshipData(
  status: "pending" | "connected" | "declined" | "removed" | "blocked",
  overrides: Record<string, unknown> = {}
) {
  return {
    memberKey: "maya__nico",
    memberIds: ["maya", "nico"],
    requestedBy: "maya",
    status,
    blockedBy: status === "blocked" ? "maya" : null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

async function seedFriendship(
  status: "pending" | "connected" | "declined" | "removed" | "blocked",
  overrides: Record<string, unknown> = {}
): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "friendships/maya__nico"),
      friendshipData(status, overrides)
    );
  });
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8")
    }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await seedProfiles();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("profile authorization", () => {
  it("allows users to read only their own private profile", async () => {
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertSucceeds(getDoc(doc(mayaDb, "users/maya")));
    await assertFails(getDoc(doc(mayaDb, "users/nico")));
    await assertFails(
      updateDoc(doc(mayaDb, "users/nico"), { timezone: "UTC" })
    );
  });

  it("allows direct public profile discovery without collection listing", async () => {
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertSucceeds(getDoc(doc(mayaDb, "publicProfiles/nico")));
    await assertFails(getDocs(collection(mayaDb, "publicProfiles")));
  });

  it("returns missing exact discovery documents without granting malformed reads", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      await setDoc(doc(database, "handles/malformed"), {
        userId: "nico",
        privateNote: "do not expose"
      });
      await setDoc(doc(database, "friendCodes/MALFORMED"), {
        userId: 42
      });
    });
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertSucceeds(getDoc(doc(mayaDb, "publicProfiles/missing")));
    await assertSucceeds(getDoc(doc(mayaDb, "handles/missing")));
    await assertSucceeds(getDoc(doc(mayaDb, "friendCodes/MISSING1")));
    await assertFails(getDoc(doc(mayaDb, "handles/malformed")));
    await assertFails(getDoc(doc(mayaDb, "friendCodes/MALFORMED")));
  });

  it("denies malformed public profiles that contain private fields", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "publicProfiles/leaky"), {
        id: "leaky",
        displayName: "Leaky",
        photoURL: null,
        handle: "leaky",
        reliabilityScore: 10,
        paymentHistory: ["late"]
      });
    });
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertFails(getDoc(doc(mayaDb, "publicProfiles/leaky")));
  });

  it("allows known friend-code lookup without listing or client writes", async () => {
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertSucceeds(getDoc(doc(mayaDb, "friendCodes/NICO8F2Q")));
    await assertFails(getDocs(collection(mayaDb, "friendCodes")));
    await assertFails(
      setDoc(doc(mayaDb, "friendCodes/MAYA0001"), { userId: "maya" })
    );
  });

  it("allows exact handle lookup without listing or client writes", async () => {
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertSucceeds(getDoc(doc(mayaDb, "handles/nicoeats")));
    await assertFails(getDocs(collection(mayaDb, "handles")));
    await assertFails(
      setDoc(doc(mayaDb, "handles/mayaeats"), { userId: "maya" })
    );
  });

  it("denies unauthenticated profile and discovery access", async () => {
    const anonymousDb = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(anonymousDb, "users/maya")));
    await assertFails(getDoc(doc(anonymousDb, "publicProfiles/nico")));
    await assertFails(getDoc(doc(anonymousDb, "friendCodes/NICO8F2Q")));
    await assertFails(getDoc(doc(anonymousDb, "handles/nicoeats")));
  });
});

describe("friendship authorization", () => {
  it("requires friendship creation to use the Admin request endpoint", async () => {
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertFails(
      setDoc(
        doc(mayaDb, "friendships/maya__nico"),
        friendshipData("pending")
      )
    );
  });

  it("rejects non-canonical or malformed friendship creation", async () => {
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertFails(
      setDoc(doc(mayaDb, "friendships/not-canonical"), friendshipData("pending"))
    );
    await assertFails(
      setDoc(
        doc(mayaDb, "friendships/maya__nico"),
        friendshipData("pending", { requestedBy: "nico" })
      )
    );
    await assertFails(
      setDoc(
        doc(mayaDb, "friendships/maya__nico"),
        friendshipData("connected")
      )
    );
  });

  it("allows only the recipient to accept or decline a pending request", async () => {
    await seedFriendship("pending");
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();
    const nicoDb = testEnvironment.authenticatedContext("nico").firestore();

    await assertFails(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "connected",
        updatedAt: later
      })
    );
    await assertSucceeds(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        status: "connected",
        updatedAt: later
      })
    );

    await testEnvironment.clearFirestore();
    await seedProfiles();
    await seedFriendship("pending");
    await assertSucceeds(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        status: "declined",
        updatedAt: later
      })
    );
  });

  it("keeps immutable membership and request fields unchanged", async () => {
    await seedFriendship("pending");
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();
    const nicoDb = testEnvironment.authenticatedContext("nico").firestore();

    await assertFails(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        memberIds: ["maya", "enzo"]
      })
    );
    await assertFails(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        requestedBy: "nico",
        status: "connected",
        updatedAt: later
      })
    );
    await assertFails(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        memberKey: "nico__maya",
        status: "connected",
        updatedAt: later
      })
    );
    await assertFails(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        createdAt: later,
        status: "connected",
        updatedAt: later
      })
    );
  });

  it("allows either connected member to remove the relationship", async () => {
    await seedFriendship("connected");
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();
    const nicoDb = testEnvironment.authenticatedContext("nico").firestore();

    await assertSucceeds(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "removed",
        updatedAt: later
      })
    );

    await testEnvironment.clearFirestore();
    await seedProfiles();
    await seedFriendship("connected");
    await assertSucceeds(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        status: "removed",
        updatedAt: later
      })
    );
  });

  it("allows only the original requester to renew a removed relationship", async () => {
    await seedFriendship("removed");
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();
    const nicoDb = testEnvironment.authenticatedContext("nico").firestore();

    await assertFails(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        status: "pending",
        updatedAt: later
      })
    );
    await assertSucceeds(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "pending",
        updatedAt: later
      })
    );
  });

  it("enforces block ownership and blocker-only unblocking", async () => {
    await seedFriendship("connected");
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();
    const nicoDb = testEnvironment.authenticatedContext("nico").firestore();

    await assertFails(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "blocked",
        blockedBy: "nico",
        updatedAt: later
      })
    );
    await assertSucceeds(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "blocked",
        blockedBy: "maya",
        updatedAt: later
      })
    );

    await assertFails(
      updateDoc(doc(nicoDb, "friendships/maya__nico"), {
        status: "removed",
        blockedBy: null,
        updatedAt: Timestamp.fromDate(new Date("2026-07-01T10:10:00.000Z"))
      })
    );
    await assertSucceeds(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "removed",
        blockedBy: null,
        updatedAt: Timestamp.fromDate(new Date("2026-07-01T10:10:00.000Z"))
      })
    );
  });

  it("denies unrelated users access to a friendship", async () => {
    await seedFriendship("connected");
    const enzoDb = testEnvironment.authenticatedContext("enzo").firestore();

    await assertFails(getDoc(doc(enzoDb, "friendships/maya__nico")));
    await assertFails(
      updateDoc(doc(enzoDb, "friendships/maya__nico"), {
        status: "removed",
        updatedAt: later
      })
    );
  });

  it("does not let a blocked relationship become pending or connected", async () => {
    await seedFriendship("blocked");
    const mayaDb = testEnvironment.authenticatedContext("maya").firestore();

    await assertFails(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "pending",
        blockedBy: null,
        updatedAt: later
      })
    );
    await assertFails(
      updateDoc(doc(mayaDb, "friendships/maya__nico"), {
        status: "connected",
        blockedBy: null,
        updatedAt: later
      })
    );
  });
});
