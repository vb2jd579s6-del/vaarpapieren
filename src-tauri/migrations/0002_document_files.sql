-- More than one file per version (e.g. front and back of a passport). The single-file columns of
-- document_version move here; they stay in that table (SQLite) but are no longer used.

CREATE TABLE document_file (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id         INTEGER NOT NULL REFERENCES document_version (id) ON DELETE RESTRICT,
  file_path          TEXT    NOT NULL,
  original_filename  TEXT,
  position           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_document_file_version ON document_file (version_id, position);

INSERT INTO document_file (version_id, file_path, original_filename, position)
SELECT id, file_path, original_filename, 0 FROM document_version WHERE file_path IS NOT NULL;

UPDATE document_version SET file_path = NULL, original_filename = NULL;
