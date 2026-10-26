import type { DocumentFile } from "../domain/types";
import type { Db } from "./types";

export function listFiles(db: Db): Promise<DocumentFile[]> {
  return db.select<DocumentFile[]>("SELECT * FROM document_file ORDER BY version_id, position, id");
}

export async function addFile(
  db: Db,
  versionId: number,
  file: { file_path: string; original_filename: string | null },
  position: number,
): Promise<number> {
  const result = await db.execute(
    "INSERT INTO document_file (version_id, file_path, original_filename, position) VALUES ($1, $2, $3, $4)",
    [versionId, file.file_path, file.original_filename, position],
  );
  if (result.lastInsertId === undefined) throw new Error("No id returned for new document file");
  return result.lastInsertId;
}

export async function deleteFileRecord(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM document_file WHERE id = $1", [id]);
}
