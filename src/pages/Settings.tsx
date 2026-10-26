import { appDataDir } from "@tauri-apps/api/path";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { SegmentedControl } from "../components/SegmentedControl";
import { LANGUAGE_NAMES, LANGUAGES, t, type Language } from "../i18n";
import { TABS_POSITIONS, type TabsPosition } from "../lib/layout";
import { formatDate } from "../lib/domain/dates";
import { InvalidExportError, type ExportManifest } from "../lib/transfer";
import { applyImport, exportToFile, readImportFile } from "../lib/transferApp";
import { appVersion, checkForUpdate, installUpdate } from "../lib/updates";
import type { Update } from "@tauri-apps/plugin-updater";
import { getDb } from "../lib/db/connection";
import { getThresholds, setThresholds } from "../lib/db/settings";
import { DEFAULT_THRESHOLDS, normalizeThresholds } from "../lib/domain/thresholds";
import { runExpiryCheck, sendTestNotification } from "../lib/notifications";

const MAX_DAYS = 3650;

interface Status {
  kind: "error" | "info";
  text: string;
}

interface SettingsProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  tabsPosition: TabsPosition;
  onTabsPositionChange: (position: TabsPosition) => void;
}

export function Settings({ language, onLanguageChange, tabsPosition, onTabsPositionChange }: SettingsProps) {
  const [thresholds, setThresholdState] = useState<number[] | null>(null);
  const [newDays, setNewDays] = useState("");
  const [inputError, setInputError] = useState(false);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [dataDir, setDataDir] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateStatus, setUpdateStatus] = useState<Status | null>(null);
  const [updating, setUpdating] = useState<"checking" | "installing" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [transferStatus, setTransferStatus] = useState<Status | null>(null);
  const [transferring, setTransferring] = useState<"export" | "import" | null>(null);
  const [pendingImport, setPendingImport] = useState<ExportManifest | null>(null);
  const [imported, setImported] = useState<{ documents: number; backup: string } | null>(null);

  const fail = (err: unknown) => setStatus({ kind: "error", text: `${t.settings.error} ${t.common.error(String(err))}` });

  useEffect(() => {
    getDb().then(getThresholds).then(setThresholdState).catch(fail);
    isEnabled().then(setAutostart).catch(fail);
    appDataDir().then(setDataDir).catch(() => {});
    appVersion().then(setVersion).catch(() => {});
  }, []);

  const save = (next: number[]) => {
    const normalized = normalizeThresholds(next);
    setThresholdState(normalized);
    getDb()
      .then((db) => setThresholds(db, normalized))
      .catch(fail);
  };

  const beforeExpiry = thresholds?.filter((d) => d > 0) ?? [];
  const onExpiryDay = thresholds?.includes(0) ?? false;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const days = Number(newDays.trim());
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      setInputError(true);
      return;
    }
    setInputError(false);
    setNewDays("");
    save([...(thresholds ?? []), days]);
  };

  const toggleAutostart = async (on: boolean) => {
    try {
      await (on ? enable() : disable());
      setAutostart(await isEnabled());
    } catch (err) {
      fail(err);
    }
  };

  const searchUpdate = async () => {
    setUpdating("checking");
    setUpdateStatus(null);
    setUpdate(null);
    try {
      const found = await checkForUpdate();
      setUpdate(found);
      setUpdateStatus({ kind: "info", text: found ? t.settings.updateAvailable(found.version) : t.settings.upToDate });
    } catch (err) {
      console.error("Update check failed", err);
      setUpdateStatus({ kind: "error", text: t.settings.updateError });
    } finally {
      setUpdating(null);
    }
  };

  const applyUpdate = async () => {
    if (!update) return;
    setUpdating("installing");
    setProgress(null);
    try {
      await installUpdate(update, setProgress);
    } catch (err) {
      setUpdateStatus({ kind: "error", text: `${t.settings.installError} ${t.common.error(String(err))}` });
      setUpdating(null);
    }
  };

  const transferError = (err: unknown) => {
    const text =
      err instanceof InvalidExportError
        ? /newer/.test(err.message)
          ? t.settings.newerExport
          : t.settings.invalidExport
        : `${t.settings.error} ${t.common.error(String(err))}`;
    setTransferStatus({ kind: "error", text });
  };

  const doExport = async () => {
    setTransferring("export");
    setTransferStatus(null);
    try {
      const dest = await exportToFile(t.settings.exportFilter);
      if (dest) setTransferStatus({ kind: "info", text: t.settings.exportDone(dest) });
    } catch (err) {
      transferError(err);
    } finally {
      setTransferring(null);
    }
  };

  const chooseImport = async () => {
    setTransferStatus(null);
    try {
      const manifest = await readImportFile(t.settings.exportFilter);
      if (manifest) setPendingImport(manifest);
    } catch (err) {
      transferError(err);
    }
  };

  const doImport = async () => {
    if (!pendingImport) return;
    setTransferring("import");
    try {
      const backup = await applyImport(pendingImport);
      setImported({ documents: pendingImport.classes.length, backup });
    } catch (err) {
      transferError(err);
    } finally {
      setPendingImport(null);
      setTransferring(null);
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await action();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <h2>{t.settings.title}</h2>
      {status && <div className={`notice${status.kind === "error" ? " notice-error" : ""}`}>{status.text}</div>}

      <section className="fieldset">
        <h3 className="section-title">{t.settings.languageSection}</h3>
        <select
          className="input language-select"
          aria-label={t.settings.languageSection}
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as Language)}
        >
          {(Object.keys(LANGUAGES) as Language[]).map((id) => (
            <option key={id} value={id} lang={id}>
              {LANGUAGE_NAMES[id]}
            </option>
          ))}
        </select>
        <p className="field-hint">{t.settings.languageHint}</p>
      </section>

      <section className="fieldset">
        <h3 className="section-title">{t.settings.layoutSection}</h3>
        <div className="field">
          <span className="field-label">{t.settings.tabsPosition}</span>
          <SegmentedControl
            label={t.settings.tabsPosition}
            value={tabsPosition}
            onChange={onTabsPositionChange}
            segments={TABS_POSITIONS.map((id) => ({ id, label: t.settings.positions[id] }))}
          />
        </div>
      </section>

      <section className="fieldset">
        <h3 className="section-title">{t.settings.notificationsSection}</h3>
        <p className="field-hint">{t.settings.notificationsHint}</p>

        {thresholds !== null && (
          <>
            <div className="chips">
              {beforeExpiry.length === 0 && !onExpiryDay && <span className="muted">{t.settings.noThresholds}</span>}
              {beforeExpiry.map((d) => (
                <span key={d} className="chip">
                  {t.settings.thresholdChip(d)}
                  <button aria-label={t.settings.removeThreshold(d)} title={t.settings.removeThreshold(d)} onClick={() => save(thresholds.filter((x) => x !== d))}>
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <form className="inline-form" onSubmit={add} noValidate>
              <input
                className={`input${inputError ? " input-error" : ""}`}
                inputMode="numeric"
                placeholder={t.settings.addThresholdPlaceholder}
                aria-label={t.settings.addThreshold}
                value={newDays}
                onChange={(e) => {
                  setNewDays(e.target.value);
                  setInputError(false);
                }}
              />
              <button type="submit" className="btn">
                {t.settings.add}
              </button>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => save(DEFAULT_THRESHOLDS)}>
                {t.settings.resetThresholds}
              </button>
            </form>
            {inputError && <span className="field-error">{t.settings.invalidThreshold}</span>}

            <label className="checkbox">
              <input
                type="checkbox"
                checked={onExpiryDay}
                onChange={(e) => save(e.target.checked ? [...thresholds, 0] : thresholds.filter((x) => x !== 0))}
              />
              {t.settings.onExpiryDay}
            </label>
          </>
        )}

        <div className="actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const ok = await sendTestNotification();
                setStatus(ok ? { kind: "info", text: t.settings.testSent } : { kind: "error", text: t.settings.permissionDenied });
              })
            }
          >
            {t.settings.testNotification}
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const sent = await runExpiryCheck();
                setStatus({ kind: "info", text: t.settings.checkResult(sent) });
              })
            }
          >
            {t.settings.checkNow}
          </button>
        </div>
      </section>

      <section className="fieldset">
        <h3 className="section-title">{t.settings.startupSection}</h3>
        <label className="checkbox">
          <input type="checkbox" checked={autostart ?? false} disabled={autostart === null} onChange={(e) => toggleAutostart(e.target.checked)} />
          {t.settings.autostart}
        </label>
        <p className="field-hint">{t.settings.autostartHint}</p>
        <p className="field-hint">{t.settings.backgroundHint}</p>
      </section>

      <section className="fieldset">
        <h3 className="section-title">{t.settings.aboutSection}</h3>
        {version && (
          <p className="version-line">
            {t.settings.version} <strong>{version}</strong>
          </p>
        )}
        <div className="actions">
          <button className="btn" onClick={searchUpdate} disabled={updating !== null}>
            {updating === "checking" ? t.settings.checkingUpdates : t.settings.checkUpdates}
          </button>
          {update && (
            <button className="btn btn-primary" onClick={applyUpdate} disabled={updating !== null}>
              {updating === "installing"
                ? progress === null
                  ? t.settings.installing
                  : `${t.settings.installing} ${Math.round(progress * 100)}%`
                : t.settings.install}
            </button>
          )}
        </div>
        {updateStatus && <div className={`notice${updateStatus.kind === "error" ? " notice-error" : ""}`}>{updateStatus.text}</div>}
        {update?.body && <p className="field-hint notes">{update.body}</p>}
        <p className="field-hint">{t.settings.updatesHint}</p>
      </section>

      <section className="fieldset">
        <h3 className="section-title">{t.settings.transferSection}</h3>
        <p className="field-hint">{t.settings.transferHint}</p>
        <div className="actions">
          <button className="btn" onClick={doExport} disabled={transferring !== null}>
            {transferring === "export" ? t.settings.exporting : t.settings.exportData}
          </button>
          <button className="btn" onClick={chooseImport} disabled={transferring !== null}>
            {transferring === "import" ? t.settings.importing : t.settings.importData}
          </button>
        </div>
        {transferStatus && (
          <div className={`notice path-notice${transferStatus.kind === "error" ? " notice-error" : ""}`}>{transferStatus.text}</div>
        )}
      </section>

      {pendingImport && (
        <ConfirmDialog
          title={t.settings.importTitle}
          confirmLabel={t.settings.importReplace}
          danger
          busy={transferring === "import"}
          onConfirm={doImport}
          onCancel={() => setPendingImport(null)}
        >
          <p>{t.settings.importConfirm(pendingImport.classes.length, formatDate(pendingImport.exportedAt.slice(0, 10)))}</p>
        </ConfirmDialog>
      )}

      {imported && (
        <Modal
          title={t.settings.importDoneTitle}
          onClose={() => window.location.reload()}
          footer={
            <button className="btn btn-primary" onClick={() => window.location.reload()} autoFocus>
              {t.settings.importReload}
            </button>
          }
        >
          <p className="path-notice">{t.settings.importDone(imported.documents, imported.backup)}</p>
        </Modal>
      )}

      {dataDir && (
        <section className="fieldset">
          <h3 className="section-title">{t.settings.dataSection}</h3>
          <div className="field">
            <span className="field-label">{t.settings.dataFolder}</span>
            <code className="path">{dataDir}</code>
          </div>
        </section>
      )}
    </div>
  );
}
