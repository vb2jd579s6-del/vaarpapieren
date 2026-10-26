import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export { getVersion as appVersion };

/**
 * Asks GitHub for the latest release (endpoint in src-tauri/tauri.conf.json). Only on request:
 * the app never checks by itself. Null means this is the newest version.
 */
export function checkForUpdate(): Promise<Update | null> {
  return check();
}

/** Downloads and installs the update (its signature is verified first), then restarts the app. */
export async function installUpdate(update: Update, onProgress: (fraction: number | null) => void): Promise<void> {
  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? 0;
    if (event.event === "Progress") {
      received += event.data.chunkLength;
      onProgress(total > 0 ? Math.min(received / total, 1) : null);
    }
  });
  await relaunch();
}

export type UpdateErrorKind = "offline" | "noPlatform" | "noRelease" | "other";

/** What went wrong, from the updater's error text, so the app can say why instead of guessing. */
export function updateErrorKind(error: unknown): UpdateErrorKind {
  const text = String(error).toLowerCase();
  if (/platform .* (was )?not found|not found on the response/.test(text)) return "noPlatform";
  if (/error sending request|dns|connect|timed out|timeout|network|offline|unreachable|no route/.test(text)) return "offline";
  if (/valid release json|404|not found|deserializ|parse|invalid/.test(text)) return "noRelease";
  return "other";
}
