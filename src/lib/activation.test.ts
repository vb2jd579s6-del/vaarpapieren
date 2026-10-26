import { describe, expect, it } from "vitest";
import { ACTIVATION_HASH, activationHash, isActivationCode } from "./activation";

// A made-up code and salt: the real code must never appear in the source.
const SALT = "test-salt:";
const CODE = "correct horse battery staple";

describe("activation", () => {
  it("hashes with SHA-256 over salt + code", async () => {
    // printf '%s' 'test-salt:correct horse battery staple' | shasum -a 256
    expect(await activationHash(CODE, SALT)).toBe("48d2648739770bc813b80ce060dc50bfa7000191b9175dad2014d9d79959c7df");
  });
  it("accepts the code with surrounding spaces, nothing else", async () => {
    const expected = await activationHash(CODE, SALT);
    expect(await isActivationCode(`  ${CODE} `, expected, SALT)).toBe(true);
    expect(await isActivationCode(CODE.toUpperCase(), expected, SALT)).toBe(false);
    expect(await isActivationCode("", expected, SALT)).toBe(false);
  });
  it("rejects guesses against the real hash", async () => {
    expect(ACTIVATION_HASH).toMatch(/^[0-9a-f]{64}$/);
    for (const guess of ["", "vaarpapieren", "Vaarpapieren", "1234", "tharsis"]) {
      expect(await isActivationCode(guess)).toBe(false);
    }
  });
});
