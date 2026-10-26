import { invoke } from "@tauri-apps/api/core";
import { getDb } from "./db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "./db/settings";

/** Touch ID lock is macOS only (LocalAuthentication); see src-tauri/src/lock.rs. */
const isMac = /Mac/.test(navigator.userAgent);

/** Relock after the window has been in the background (or hidden in the tray) this long. */
export const RELOCK_AFTER_MS = 5 * 60 * 1000;

export async function canUseLock(): Promise<boolean> {
  return isMac && (await invoke<boolean>("can_lock").catch(() => false));
}

/** The system prompt; `reason` completes "Vaarpapieren is trying to …". */
export function authenticate(reason: string): Promise<boolean> {
  return invoke<boolean>("authenticate", { reason });
}

export async function loadLockEnabled(): Promise<boolean> {
  return isMac && (await getSetting(await getDb(), SETTING_KEYS.lockEnabled)) === "1";
}

export async function saveLockEnabled(on: boolean): Promise<void> {
  await setSetting(await getDb(), SETTING_KEYS.lockEnabled, on ? "1" : "0");
}
