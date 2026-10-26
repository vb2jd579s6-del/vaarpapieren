import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export const DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

export interface ImportedFile {
  file_path: string;
  original_filename: string;
}

/** Native file picker for PDF/JPG/PNG; null when cancelled. */
export async function pickDocumentFile(filterName: string): Promise<string | null> {
  const picked = await open({ multiple: false, directory: false, filters: [{ name: filterName, extensions: DOCUMENT_EXTENSIONS }] });
  return typeof picked === "string" ? picked : null;
}

/** Copies the file into the app data directory (see src-tauri/src/files.rs). */
export function importDocumentFile(source: string): Promise<ImportedFile> {
  return invoke<ImportedFile>("import_document_file", { source });
}

export function removeDocumentFile(filePath: string): Promise<void> {
  return invoke("remove_document_file", { filePath });
}

/** File name from a full path, for both / and \ separators. */
export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Matches FILE_NOT_FOUND in src-tauri/src/files.rs. */
export const FILE_NOT_FOUND = "file-not-found";

/** Opens the stored copy in the system's default viewer. */
export function openDocumentFile(filePath: string): Promise<void> {
  return invoke("open_document_file", { filePath });
}

/** Continuity Camera ("Import from iPhone") exists on macOS only; see src-tauri/src/continuity.rs. */
export const canImportFromIphone = /Mac/.test(navigator.userAgent);

/** Opens the native "Import from iPhone" menu (Take Photo, Scan Documents, …) below `button`. */
export function showIphoneImportMenu(button: HTMLElement, title: string): Promise<void> {
  const rect = button.getBoundingClientRect();
  return invoke("show_iphone_import_menu", { x: rect.left, y: rect.bottom + 4, title });
}

/** Calls `onFile` with the path of each scan or photo received from the iPhone; returns a stop function. */
export function onIphoneImport(onFile: (path: string) => void): () => void {
  const stop = listen<string>("continuity-import", (e) => onFile(e.payload));
  return () => void stop.then((unlisten) => unlisten());
}
