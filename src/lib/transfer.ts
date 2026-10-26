import { listClasses } from "./db/classes";
import { listFiles } from "./db/documentFiles";
import { listNotificationLog, type NotificationLogRow } from "./db/notificationLog";
import { listSeaService } from "./db/seaService";
import { SETTING_KEYS } from "./db/settings";
import type { Db } from "./db/types";
import { VESSEL_TYPES, type SeaService } from "./domain/seaTime";
import { CATEGORIES, type DocumentClass, type DocumentFile } from "./domain/types";

/**
 * Everything needed to move the documents and settings to another computer, Mac or Windows:
 * paths use "/", dates are ISO text, and the files themselves travel next to this manifest in
 * the export file (see src-tauri/src/transfer.rs). Activation is not included on purpose.
 */
export interface ExportManifest {
  format: typeof FORMAT;
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  classes: DocumentClass[];
  versions: ExportedVersion[];
  files: DocumentFile[];
  notificationLog: NotificationLogRow[];
  /** Since format version 2; missing (empty) in version 1 exports. */
  seaService: SeaService[];
  settings: Record<string, string>;
}

export interface ExportedVersion {
  id: number;
  class_id: number;
  issuing_authority: string | null;
  document_number: string | null;
  issue_date: string;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const FORMAT = "vaarpapieren-export";
/** 2: adds seaService. Version 1 files stay importable. */
export const FORMAT_VERSION = 2;
export const EXPORT_EXTENSION = "vaarpapieren";

/** Settings that move along; activation stays with the computer. */
const TRANSFERRED_SETTINGS: string[] = [
  SETTING_KEYS.overviewView,
  SETTING_KEYS.language,
  SETTING_KEYS.tabsPosition,
  SETTING_KEYS.thresholds,
  SETTING_KEYS.notificationsIntroDone,
  SETTING_KEYS.holderName,
  SETTING_KEYS.careerRole,
];

export async function buildExport(db: Db, appVersion: string, now = new Date()): Promise<ExportManifest> {
  const [classes, versions, files, notificationLog, settingRows, seaService] = await Promise.all([
    listClasses(db),
    db.select<ExportedVersion[]>(
      `SELECT id, class_id, issuing_authority, document_number, issue_date, expiry_date, notes, created_at, updated_at
       FROM document_version ORDER BY id`,
    ),
    listFiles(db),
    listNotificationLog(db),
    db.select<{ key: string; value: string }[]>("SELECT key, value FROM setting"),
    listSeaService(db),
  ]);
  const settings = Object.fromEntries(settingRows.filter((r) => TRANSFERRED_SETTINGS.includes(r.key)).map((r) => [r.key, r.value]));
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    classes,
    versions,
    files,
    notificationLog,
    seaService,
    settings,
  };
}

export class InvalidExportError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrOrNull = (v: unknown) => v === null || isStr(v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STORED_PATH = /^files\/[^/\\]+$/;

/**
 * Checks an export completely before anything is replaced: shape, ids, references between
 * classes, versions and files, and file paths. Throws InvalidExportError with the reason.
 */
export function parseExport(text: string): ExportManifest {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidExportError("not JSON");
  }
  const fail = (why: string): never => {
    throw new InvalidExportError(why);
  };
  if (!isObject(data) || data.format !== FORMAT) fail("not a Vaarpapieren export");
  const d = data as Record<string, unknown>;
  if (!isInt(d.formatVersion) || d.formatVersion > FORMAT_VERSION) fail("made by a newer version of the app");
  for (const key of ["classes", "versions", "files", "notificationLog"]) if (!Array.isArray(d[key])) fail(`missing ${key}`);
  if (!isObject(d.settings)) fail("missing settings");

  const classes = d.classes as unknown[];
  const classIds = new Set<number>();
  for (const c of classes) {
    if (!isObject(c) || !isInt(c.id) || !isStr(c.name) || !CATEGORIES.includes(c.category as never) || !isStr(c.created_at)) fail("invalid document type");
    classIds.add((c as { id: number }).id);
  }
  const versionIds = new Set<number>();
  for (const v of d.versions as unknown[]) {
    const ok =
      isObject(v) &&
      isInt(v.id) &&
      isInt(v.class_id) &&
      classIds.has(v.class_id as number) &&
      isStr(v.issue_date) &&
      ISO_DATE.test(v.issue_date as string) &&
      (v.expiry_date === null || (isStr(v.expiry_date) && ISO_DATE.test(v.expiry_date as string))) &&
      isStrOrNull(v.issuing_authority) &&
      isStrOrNull(v.document_number) &&
      isStrOrNull(v.notes);
    if (!ok) fail("invalid document version");
    versionIds.add((v as { id: number }).id);
  }
  for (const f of d.files as unknown[]) {
    const ok =
      isObject(f) &&
      isInt(f.id) &&
      isInt(f.version_id) &&
      versionIds.has(f.version_id as number) &&
      isStr(f.file_path) &&
      STORED_PATH.test(f.file_path as string) &&
      isStrOrNull(f.original_filename) &&
      isInt(f.position);
    if (!ok) fail("invalid file entry");
  }
  for (const n of d.notificationLog as unknown[]) {
    if (!isObject(n) || !isInt(n.version_id) || !versionIds.has(n.version_id as number) || !isInt(n.threshold_days)) fail("invalid notification entry");
  }
  for (const value of Object.values(d.settings as object)) if (!isStr(value)) fail("invalid setting");
  if (d.seaService === undefined) d.seaService = [];
  if (!Array.isArray(d.seaService)) fail("invalid sea service");
  for (const s of d.seaService as unknown[]) {
    const ok =
      isObject(s) &&
      isInt(s.id) &&
      isStr(s.vessel_name) &&
      (s.vessel_type === null || VESSEL_TYPES.includes(s.vessel_type as never)) &&
      isStrOrNull(s.imo_number) &&
      isStrOrNull(s.rank) &&
      isStr(s.sign_on) &&
      ISO_DATE.test(s.sign_on as string) &&
      (s.sign_off === null || (isStr(s.sign_off) && ISO_DATE.test(s.sign_off as string))) &&
      isStrOrNull(s.notes);
    if (!ok) fail("invalid sea service");
  }
  return data as ExportManifest;
}

/**
 * Replaces all documents, files records, notification history and the transferred settings with
 * those of `manifest` (already checked with parseExport). The activation is kept.
 */
export async function replaceWithImport(db: Db, m: ExportManifest): Promise<void> {
  await db.execute("DELETE FROM notification_log");
  await db.execute("DELETE FROM sea_service");
  await db.execute("DELETE FROM document_file");
  await db.execute("DELETE FROM document_version");
  await db.execute("DELETE FROM document_class");
  for (const key of TRANSFERRED_SETTINGS) await db.execute("DELETE FROM setting WHERE key = $1", [key]);

  for (const c of m.classes) {
    await db.execute("INSERT INTO document_class (id, name, category, created_at) VALUES ($1, $2, $3, $4)", [c.id, c.name, c.category, c.created_at]);
  }
  for (const v of m.versions) {
    await db.execute(
      `INSERT INTO document_version (id, class_id, issuing_authority, document_number, issue_date, expiry_date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [v.id, v.class_id, v.issuing_authority, v.document_number, v.issue_date, v.expiry_date, v.notes, v.created_at, v.updated_at],
    );
  }
  for (const f of m.files) {
    await db.execute(
      "INSERT INTO document_file (id, version_id, file_path, original_filename, position, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [f.id, f.version_id, f.file_path, f.original_filename, f.position, f.created_at],
    );
  }
  for (const n of m.notificationLog) {
    await db.execute("INSERT INTO notification_log (version_id, threshold_days, sent_at) VALUES ($1, $2, $3)", [n.version_id, n.threshold_days, n.sent_at]);
  }
  for (const s of m.seaService) {
    await db.execute(
      `INSERT INTO sea_service (id, vessel_name, vessel_type, imo_number, rank, sign_on, sign_off, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [s.id, s.vessel_name, s.vessel_type, s.imo_number, s.rank, s.sign_on, s.sign_off, s.notes, s.created_at, s.updated_at],
    );
  }
  for (const [key, value] of Object.entries(m.settings)) {
    if (TRANSFERRED_SETTINGS.includes(key)) await db.execute("INSERT INTO setting (key, value) VALUES ($1, $2)", [key, value]);
  }
}

/** Default file name of an export, e.g. Vaarpapieren-2026-10-26.vaarpapieren. */
export function exportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Vaarpapieren-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${EXPORT_EXTENSION}`;
}
