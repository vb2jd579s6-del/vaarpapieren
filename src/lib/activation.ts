import { getDb } from "./db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "./db/settings";

/**
 * SHA-256 of `ACTIVATION_SALT + code` for the code handed out by the owner. Only this hash is in
 * the source, never the code. To change the code: put the new hash here (see README).
 */
export const ACTIVATION_HASH = "e242deadae342a6aa5b53d7290d01c1b9850423dbb5ed1f2febbd8c674166d79";
const ACTIVATION_SALT = "vaarpapieren-activation-v1:";

export async function activationHash(code: string, salt = ACTIVATION_SALT): Promise<string> {
  const bytes = new TextEncoder().encode(salt + code.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isActivationCode(code: string, expected = ACTIVATION_HASH, salt = ACTIVATION_SALT): Promise<boolean> {
  return (await activationHash(code, salt)) === expected;
}

/** Activation is stored in the database, so it survives updates. */
export async function loadActivated(): Promise<boolean> {
  return (await getSetting(await getDb(), SETTING_KEYS.activated)) === "1";
}

export async function saveActivated(): Promise<void> {
  await setSetting(await getDb(), SETTING_KEYS.activated, "1");
}
