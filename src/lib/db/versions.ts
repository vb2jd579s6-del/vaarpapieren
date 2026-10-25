import type { DocumentVersion } from "../domain/types";
import type { Db } from "./types";

export type NewVersion = Omit<DocumentVersion, "id" | "created_at" | "updated_at">;

export function listVersions(db: Db): Promise<DocumentVersion[]> {
  return db.select<DocumentVersion[]>("SELECT * FROM document_version");
}

export async function createVersion(db: Db, v: NewVersion): Promise<number> {
  const result = await db.execute(
    `INSERT INTO document_version
       (class_id, issuing_authority, document_number, issue_date, expiry_date, file_path, original_filename, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [v.class_id, v.issuing_authority, v.document_number, v.issue_date, v.expiry_date, v.file_path, v.original_filename, v.notes],
  );
  if (result.lastInsertId === undefined) throw new Error("No id returned for new document version");
  return result.lastInsertId;
}

export type VersionUpdate = Omit<NewVersion, "class_id">;

export async function updateVersion(db: Db, id: number, v: VersionUpdate): Promise<void> {
  await db.execute(
    `UPDATE document_version
     SET issuing_authority = $1, document_number = $2, issue_date = $3, expiry_date = $4,
         file_path = $5, original_filename = $6, notes = $7,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE id = $8`,
    [v.issuing_authority, v.document_number, v.issue_date, v.expiry_date, v.file_path, v.original_filename, v.notes, id],
  );
}

/** Removes one version and its notification history. Only called after the user confirmed. */
export async function deleteVersion(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM notification_log WHERE version_id = $1", [id]);
  await db.execute("DELETE FROM document_version WHERE id = $1", [id]);
}
