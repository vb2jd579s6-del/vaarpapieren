import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));

const { updateErrorKind } = await import("./updates");

describe("updateErrorKind", () => {
  it("recognises a release without this platform (the half-published release case)", () => {
    expect(updateErrorKind("the platform `darwin-aarch64` was not found on the response `platforms` object")).toBe("noPlatform");
  });
  it("recognises network problems", () => {
    expect(updateErrorKind("error sending request for url (https://github.com/...)")).toBe("offline");
    expect(updateErrorKind(new Error("dns error: failed to lookup address information"))).toBe("offline");
  });
  it("recognises a missing or unreadable latest.json", () => {
    expect(updateErrorKind("Could not fetch a valid release JSON from the remote")).toBe("noRelease");
  });
  it("leaves anything else as other", () => {
    expect(updateErrorKind("signature verification failed")).toBe("other");
  });
});
