import { invoke } from "@tauri-apps/api/core";
import { extractScanInfo, type ScanInfo } from "./domain/scanInfo";

/** Text recognition is macOS only (Vision); see src-tauri/src/ocr.rs. */
export const canReadScans = /Mac/.test(navigator.userAgent);

/** Reads the dates and document number from a file on disk (a scan, photo or PDF). */
export async function readScanInfo(path: string): Promise<ScanInfo> {
  const lines = await invoke<string[]>("recognize_document_text", { path });
  return extractScanInfo(lines);
}
