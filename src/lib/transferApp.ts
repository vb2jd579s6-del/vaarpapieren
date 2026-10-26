import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getDb } from "./db/connection";
import { appVersion } from "./updates";
import { buildExport, EXPORT_EXTENSION, exportFileName, parseExport, replaceWithImport, type ExportManifest } from "./transfer";

/** Asks where to save, then writes the export (see src-tauri/src/transfer.rs). Null when cancelled. */
export async function exportToFile(filterName: string): Promise<string | null> {
  const dest = await save({ defaultPath: exportFileName(), filters: [{ name: filterName, extensions: [EXPORT_EXTENSION] }] });
  if (!dest) return null;
  const manifest = await buildExport(await getDb(), await appVersion());
  await invoke("export_data", { dest, manifest: JSON.stringify(manifest) });
  return dest;
}

/** Asks for an export file and reads and checks it, without changing anything. Null when cancelled. */
export async function readImportFile(filterName: string): Promise<ExportManifest | null> {
  const picked = await open({ multiple: false, directory: false, filters: [{ name: filterName, extensions: [EXPORT_EXTENSION] }] });
  const source = typeof picked === "string" ? picked : null;
  if (!source) return null;
  return parseExport(await invoke<string>("read_import", { source }));
}

/**
 * Replaces all data with a checked import. The current data is first saved as a backup export
 * in the app's backups folder; returns its path.
 */
export async function applyImport(manifest: ExportManifest): Promise<string> {
  const db = await getDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = await invoke<string>("backup_data", {
    name: `voor-import-${stamp}.${EXPORT_EXTENSION}`,
    manifest: JSON.stringify(await buildExport(db, await appVersion())),
  });
  await replaceWithImport(db, manifest);
  await invoke("finish_import", { keep: manifest.files.map((f) => f.file_path) });
  return backup;
}
