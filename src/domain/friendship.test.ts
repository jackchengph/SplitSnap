import { describe, expect, it } from "vitest";
import {
  canTransitionFriendship,
  friendshipIdFor,
  toPublicUserProfile
} from "./friendship";
import type { UserProfile } from "./accountTypes";

const profile: UserProfile = {
  id: "maya",
  displayName: "Maya",
  photoURL: null,
  handle: "mayaeats",
  friendCode: "MAYA8F2Q",
  discoverableByHandle: true,
  timezone: "Asia/Manila",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z"
};

describe("friendship domain", () => {
  it("rejects empty friendship member ids", () => {
    expect(() => friendshipIdFor("", "nico")).toThrow(
      "A friendship requires two different users."
    );
    expect(() => friendshipIdFor("maya", "")).toThrow(
      "A friendship requires two different users."
    );
  });

  it("rejects same friendship member ids", () => {
    expect(() => friendshipIdFor("maya", "maya")).toThrow(
      "A friendship requires two different users."
    );
  });

  it("creates one stable ID regardless of member order", () => {
    expect(friendshipIdFor("maya", "nico")).toBe("maya__nico");
    expect(friendshipIdFor("nico", "maya")).toBe("maya__nico");
  });

  it("allows only valid friendship transitions", () => {
    expect(canTransitionFriendship("pending", "connected", "recipient")).toBe(true);
    expect(canTransitionFriendship("pending", "declined", "recipient")).toBe(true);
    expect(canTransitionFriendship("connected", "removed", "member")).toBe(true);
    expect(canTransitionFriendship("blocked", "removed", "member")).toBe(true);
    expect(canTransitionFriendship("blocked", "connected", "member")).toBe(false);
  });

  it("removes private profile fields from public discovery", () => {
    expect(toPublicUserProfile(profile)).toEqual({
      id: "maya",
      displayName: "Maya",
      photoURL: null,
      handle: "mayaeats"
    });
  });
});
