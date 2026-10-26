import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export const DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

export interface ImportedFile {
  file_path: string;
  original_filename: string;
}

/** Native file picker for PDF/JPG/PNG, several at once; empty when cancelled. */
export async function pickDocumentFiles(filterName: string): Promise<string[]> {
  const picked = await open({ multiple: true, directory: false, filters: [{ name: filterName, extensions: DOCUMENT_EXTENSIONS }] });
  if (picked === null) return [];
  return Array.isArray(picked) ? picked : [picked];
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

/** Who gets a scan: the most recently opened Add page or Edit dialog, else the app-wide fallback. */
const importHandlers: ((path: string) => void)[] = [];

/** Makes `onFile` receive the scans and photos from the iPhone while it is registered; returns the unregister function. */
export function onIphoneImport(onFile: (path: string) => void): () => void {
  importHandlers.push(onFile);
  return () => {
    const i = importHandlers.lastIndexOf(onFile);
    if (i !== -1) importHandlers.splice(i, 1);
  };
}

/**
 * Listens for scans from the iPhone (event from src-tauri/src/continuity.rs). A scan started from
 * the menu bar can arrive while no Add page is open; `fallback` handles that. Returns a stop function.
 */
export function listenForIphoneImports(fallback: (path: string) => void): () => void {
  const stop = listen<string>("continuity-import", (e) => (importHandlers[importHandlers.length - 1] ?? fallback)(e.payload));
  return () => void stop.then((unlisten) => unlisten());
}

let dataDir: Promise<string> | null = null;

/** URL the webview can show for a stored file (asset protocol, limited to the files folder). */
export async function previewUrl(filePath: string): Promise<string> {
  dataDir ??= appDataDir();
  return convertFileSrc(await join(await dataDir, filePath));
}

export type PreviewKind = "image" | "pdf" | null;

export function previewKind(filePath: string | null): PreviewKind {
  const ext = filePath?.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png") return "image";
  if (ext === "pdf") return "pdf";
  return null;
}
