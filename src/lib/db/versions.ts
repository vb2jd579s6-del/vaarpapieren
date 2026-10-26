import type { DocumentFile, DocumentVersion } from "../domain/types";
import { listFiles } from "./documentFiles";
import type { Db } from "./types";

export type NewVersion = Omit<DocumentVersion, "id" | "created_at" | "updated_at" | "files">;

type VersionRow = Omit<DocumentVersion, "files">;

/** All versions, each with its files (in order). */
export async function listVersions(db: Db): Promise<DocumentVersion[]> {
  const [rows, files] = await Promise.all([
    db.select<VersionRow[]>(
      `SELECT id, class_id, issuing_authority, document_number, issue_date, expiry_date, notes, created_at, updated_at
       FROM document_version`,
    ),
    listFiles(db),
  ]);
  const byVersion = new Map<number, DocumentFile[]>();
  for (const f of files) byVersion.set(f.version_id, [...(byVersion.get(f.version_id) ?? []), f]);
  return rows.map((row) => ({ ...row, files: byVersion.get(row.id) ?? [] }));
}

export async function createVersion(db: Db, v: NewVersion): Promise<number> {
  const result = await db.execute(
    `INSERT INTO document_version (class_id, issuing_authority, document_number, issue_date, expiry_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [v.class_id, v.issuing_authority, v.document_number, v.issue_date, v.expiry_date, v.notes],
  );
  if (result.lastInsertId === undefined) throw new Error("No id returned for new document version");
  return result.lastInsertId;
}

export type VersionUpdate = Omit<NewVersion, "class_id">;

export async function updateVersion(db: Db, id: number, v: VersionUpdate): Promise<void> {
  await db.execute(
    `UPDATE document_version
     SET issuing_authority = $1, document_number = $2, issue_date = $3, expiry_date = $4, notes = $5,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE id = $6`,
    [v.issuing_authority, v.document_number, v.issue_date, v.expiry_date, v.notes, id],
  );
}

/** Removes one version with its file records and notification history. Only after the user confirmed. */
export async function deleteVersion(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM notification_log WHERE version_id = $1", [id]);
  await db.execute("DELETE FROM document_file WHERE version_id = $1", [id]);
  await db.execute("DELETE FROM document_version WHERE id = $1", [id]);
}
