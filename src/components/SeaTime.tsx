import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { getDb } from "../lib/db/connection";
import { addSeaService, deleteSeaService, listSeaService, updateSeaService, type SeaServiceInput } from "../lib/db/seaService";
import { formatDate, parseDisplayDate, todayIso } from "../lib/domain/dates";
import { REVALIDATION_DAYS, serviceDays, sortServices, summarizeSeaTime, VESSEL_TYPES, type SeaService, type VesselType } from "../lib/domain/seaTime";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field } from "./FormFields";
import { Modal } from "./Modal";

interface ServiceForm {
  vessel: string;
  type: VesselType | "";
  imo: string;
  rank: string;
  signOn: string;
  signOff: string;
  aboard: boolean;
  notes: string;
}

const EMPTY: ServiceForm = { vessel: "", type: "", imo: "", rank: "", signOn: "", signOff: "", aboard: false, notes: "" };

const formFrom = (s: SeaService): ServiceForm => ({
  vessel: s.vessel_name,
  type: s.vessel_type ?? "",
  imo: s.imo_number ?? "",
  rank: s.rank ?? "",
  signOn: formatDate(s.sign_on),
  signOff: formatDate(s.sign_off),
  aboard: s.sign_off === null,
  notes: s.notes ?? "",
});

type Errors = Partial<Record<"vessel" | "signOn" | "signOff", string>>;

function validate(f: ServiceForm): { errors: Errors; input: SeaServiceInput | null } {
  const errors: Errors = {};
  if (!f.vessel.trim()) errors.vessel = t.seaTime.vesselRequired;
  const on = parseDisplayDate(f.signOn);
  if (!f.signOn.trim()) errors.signOn = t.seaTime.signOnRequired;
  else if (!on) errors.signOn = t.add.errors.invalidDate;
  const off = f.aboard ? null : parseDisplayDate(f.signOff);
  if (!f.aboard) {
    if (!f.signOff.trim()) errors.signOff = t.seaTime.signOffRequired;
    else if (!off) errors.signOff = t.add.errors.invalidDate;
    else if (on && off < on) errors.signOff = t.seaTime.signOffBeforeOn;
  }
  if (Object.keys(errors).length > 0 || !on) return { errors, input: null };
  const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    errors,
    input: { vessel_name: f.vessel, vessel_type: f.type || null, imo_number: orNull(f.imo), rank: orNull(f.rank), sign_on: on, sign_off: off, notes: orNull(f.notes) },
  };
}

/** Periods aboard, the totals that count for revalidating a CoC, and the form to add or edit. */
export function SeaTime() {
  const [services, setServices] = useState<SeaService[] | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; form: ServiceForm } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [deleting, setDeleting] = useState<SeaService | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setServices(sortServices(await listSeaService(await getDb())));
    } catch (err) {
      setError(String(err));
    }
  }, []);
  useEffect(() => void reload(), [reload]);

  const today = todayIso();
  const summary = useMemo(() => summarizeSeaTime(services ?? [], today), [services, today]);

  const save = async () => {
    if (!editing) return;
    const { errors, input } = validate(editing.form);
    setErrors(errors);
    if (!input) return;
    try {
      const db = await getDb();
      if (editing.id === null) await addSeaService(db, input);
      else await updateSeaService(db, editing.id, input);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(String(err));
    }
  };

  const set = (patch: Partial<ServiceForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const progress = Math.min(1, summary.lastFiveYears / REVALIDATION_DAYS);

  if (services === null) return error ? <div className="notice notice-error">{t.common.error(error)}</div> : null;

  return (
    <div className="sea-time">
      {error && <div className="notice notice-error">{t.common.error(error)}</div>}
      <p className="muted">{t.seaTime.intro}</p>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">{t.seaTime.total}</span>
          <strong>{t.seaTime.days(summary.totalDays)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">{t.seaTime.lastFiveYears}</span>
          <strong>{t.seaTime.days(summary.lastFiveYears)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">{t.seaTime.lastSixMonths}</span>
          <strong>{t.seaTime.days(summary.lastSixMonths)}</strong>
        </div>
      </div>

      <div className="fieldset revalidation">
        <span className="field-label">{t.seaTime.revalidation}</span>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={REVALIDATION_DAYS} aria-valuenow={summary.lastFiveYears}>
          <span style={{ width: `${progress * 100}%` }} className={progress >= 1 ? "done" : undefined} />
        </div>
        <span className={summary.missingForRevalidation === 0 ? "expiry-valid" : "muted"}>
          {summary.missingForRevalidation === 0 ? t.seaTime.enough : t.seaTime.missing(summary.missingForRevalidation)}
        </span>
        {summary.aboard && <span className="badge badge-valid aboard-badge">{t.seaTime.aboardNow(summary.aboard.vessel_name)}</span>}
      </div>

      <div className="toolbar">
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => (setErrors({}), setEditing({ id: null, form: EMPTY }))}>
          {t.seaTime.add}
        </button>
      </div>

      {services.length === 0 ? (
        <p className="muted">{t.seaTime.empty}</p>
      ) : (
        <table className="doc-table">
          <thead>
            <tr>
              <th>{t.seaTime.vessel}</th>
              <th>{t.seaTime.rank}</th>
              <th>{t.seaTime.signOn}</th>
              <th>{t.seaTime.signOff}</th>
              <th>{t.seaTime.total}</th>
              <th aria-label={t.overview.columns.actions} />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.vessel_name}</strong>
                  <div className="muted small">{[s.vessel_type && t.seaTime.types[s.vessel_type], s.imo_number && `IMO ${s.imo_number}`].filter(Boolean).join(" · ")}</div>
                </td>
                <td>{s.rank ?? "—"}</td>
                <td>{formatDate(s.sign_on)}</td>
                <td>{s.sign_off ? formatDate(s.sign_off) : <span className="badge badge-valid">{t.seaTime.today}</span>}</td>
                <td>{t.seaTime.days(serviceDays(s, today))}</td>
                <td>
                  <div className="doc-actions">
                    <button className="btn btn-small" onClick={() => (setErrors({}), setEditing({ id: s.id, form: formFrom(s) }))}>
                      {t.actions.edit}
                    </button>
                    <button className="btn btn-small btn-danger-quiet" onClick={() => setDeleting(s)}>
                      {t.actions.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(summary.byRank.length > 1 || summary.byVesselType.length > 1) && (
        <div className="breakdown">
          {summary.byRank.length > 1 && (
            <div className="fieldset">
              <span className="field-label">{t.seaTime.byRank}</span>
              <dl className="facts">
                {summary.byRank.map(([rank, days]) => (
                  <div key={rank} style={{ display: "contents" }}>
                    <dt>{rank}</dt>
                    <dd>{t.seaTime.days(days)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {summary.byVesselType.length > 1 && (
            <div className="fieldset">
              <span className="field-label">{t.seaTime.byType}</span>
              <dl className="facts">
                {summary.byVesselType.map(([type, days]) => (
                  <div key={type ?? "none"} style={{ display: "contents" }}>
                    <dt>{type ? t.seaTime.types[type] : "—"}</dt>
                    <dd>{t.seaTime.days(days)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}

      <p className="field-hint">{t.seaTime.indicative}</p>

      {editing && (
        <Modal
          title={editing.id === null ? t.seaTime.add : t.seaTime.edit}
          wide
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                {t.actions.cancel}
              </button>
              <button className="btn btn-primary" onClick={save}>
                {t.actions.save}
              </button>
            </>
          }
        >
          <div className="row">
            <Field label={t.seaTime.vessel} error={errors.vessel}>
              <input className="input" placeholder={t.seaTime.vesselPlaceholder} value={editing.form.vessel} onChange={(e) => set({ vessel: e.target.value })} autoFocus />
            </Field>
            <Field label={t.seaTime.vesselType} optional>
              <select className="input" value={editing.form.type} onChange={(e) => set({ type: e.target.value as VesselType | "" })}>
                <option value="">{t.seaTime.chooseType}</option>
                {VESSEL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t.seaTime.types[type]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <Field label={t.seaTime.rank} optional>
              <input className="input" placeholder={t.seaTime.rankPlaceholder} value={editing.form.rank} onChange={(e) => set({ rank: e.target.value })} />
            </Field>
            <Field label={t.seaTime.imo} optional>
              <input className="input" inputMode="numeric" value={editing.form.imo} onChange={(e) => set({ imo: e.target.value })} />
            </Field>
          </div>
          <div className="row">
            <Field label={t.seaTime.signOn} error={errors.signOn}>
              <input className="input" placeholder={t.add.datePlaceholder} value={editing.form.signOn} onChange={(e) => set({ signOn: e.target.value })} />
            </Field>
            <Field label={t.seaTime.signOff} error={errors.signOff}>
              <input
                className="input"
                placeholder={t.add.datePlaceholder}
                value={editing.form.aboard ? "" : editing.form.signOff}
                disabled={editing.form.aboard}
                onChange={(e) => set({ signOff: e.target.value })}
              />
              <span className="checkbox">
                <input type="checkbox" checked={editing.form.aboard} onChange={(e) => set({ aboard: e.target.checked })} />
                {t.seaTime.stillAboard}
              </span>
            </Field>
          </div>
          <Field label={t.add.notes} optional>
            <textarea className="input" rows={2} value={editing.form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t.seaTime.deleteTitle}
          confirmLabel={t.remove.confirm}
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await deleteSeaService(await getDb(), deleting.id);
              setDeleting(null);
              await reload();
            } catch (err) {
              setError(String(err));
            }
          }}
        >
          <p>{t.seaTime.deleteMessage(deleting.vessel_name, formatDate(deleting.sign_on))}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
