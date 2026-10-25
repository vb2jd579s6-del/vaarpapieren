import { appDataDir } from "@tauri-apps/api/path";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useState, type FormEvent } from "react";
import { SegmentedControl } from "../components/SegmentedControl";
import { LANGUAGE_NAMES, LANGUAGES, t, type Language } from "../i18n";
import { getDb } from "../lib/db/connection";
import { getThresholds, setThresholds } from "../lib/db/settings";
import { DEFAULT_THRESHOLDS, normalizeThresholds } from "../lib/domain/thresholds";
import { runExpiryCheck, sendTestNotification } from "../lib/notifications";

const MAX_DAYS = 3650;

interface Status {
  kind: "error" | "info";
  text: string;
}

export function Settings({ language, onLanguageChange }: { language: Language; onLanguageChange: (lang: Language) => void }) {
  const [thresholds, setThresholdState] = useState<number[] | null>(null);
  const [newDays, setNewDays] = useState("");
  const [inputError, setInputError] = useState(false);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [dataDir, setDataDir] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown) => setStatus({ kind: "error", text: `${t.settings.error} ${t.common.error(String(err))}` });

  useEffect(() => {
    getDb().then(getThresholds).then(setThresholdState).catch(fail);
    isEnabled().then(setAutostart).catch(fail);
    appDataDir().then(setDataDir).catch(() => {});
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
        <SegmentedControl
          label={t.settings.languageSection}
          value={language}
          onChange={onLanguageChange}
          segments={(Object.keys(LANGUAGES) as Language[]).map((id) => ({ id, label: LANGUAGE_NAMES[id] }))}
        />
        <p className="field-hint">{t.settings.languageHint}</p>
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
