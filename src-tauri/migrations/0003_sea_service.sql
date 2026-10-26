-- Sea service: one row per period aboard a vessel (a digital discharge book).
CREATE TABLE sea_service (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vessel_name  TEXT NOT NULL,
  vessel_type  TEXT,
  imo_number   TEXT,
  rank         TEXT,
  sign_on      TEXT NOT NULL,
  sign_off     TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (sign_off IS NULL OR sign_off >= sign_on)
);

CREATE INDEX idx_sea_service_sign_on ON sea_service (sign_on);
