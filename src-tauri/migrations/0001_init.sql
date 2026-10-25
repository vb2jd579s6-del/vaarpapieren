-- Nothing cascades: a version or file only disappears through a confirmed, manual delete.

CREATE TABLE document_class (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  category    TEXT    NOT NULL CHECK (category IN ('STCW', 'Medical', 'Competency', 'Identity', 'Other')),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE document_version (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id           INTEGER NOT NULL REFERENCES document_class (id) ON DELETE RESTRICT,
  issuing_authority  TEXT,
  document_number    TEXT,
  issue_date         TEXT    NOT NULL,
  expiry_date        TEXT,
  file_path          TEXT,
  original_filename  TEXT,
  notes              TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (expiry_date IS NULL OR expiry_date >= issue_date)
);

CREATE INDEX idx_document_version_class ON document_version (class_id, issue_date);

CREATE TABLE notification_log (
  version_id      INTEGER NOT NULL REFERENCES document_version (id) ON DELETE RESTRICT,
  threshold_days  INTEGER NOT NULL,
  sent_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (version_id, threshold_days)
);

CREATE TABLE setting (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
