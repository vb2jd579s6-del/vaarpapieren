import { invoke } from "@tauri-apps/api/core";
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
