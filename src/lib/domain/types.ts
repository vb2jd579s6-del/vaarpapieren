export const CATEGORIES = ["STCW", "Medical", "Competency", "Identity", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface DocumentClass {
  id: number;
  name: string;
  category: Category;
  created_at: string;
}

export interface DocumentVersion {
  id: number;
  class_id: number;
  issuing_authority: string | null;
  document_number: string | null;
  /** ISO date (YYYY-MM-DD) */
  issue_date: string;
  /** ISO date (YYYY-MM-DD); null when the document does not expire */
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Scans, photos or PDFs of this version, in order; may be empty. */
  files: DocumentFile[];
}

export interface DocumentFile {
  id: number;
  version_id: number;
  /** Relative to the app data directory, with forward slashes */
  file_path: string;
  original_filename: string | null;
  position: number;
  created_at: string;
}
