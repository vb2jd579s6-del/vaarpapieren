import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { listClasses } from "../lib/db/classes";
import { getDb } from "../lib/db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "../lib/db/settings";
import { listVersions } from "../lib/db/versions";
import { todayIso } from "../lib/domain/dates";
import { buildOverview, type OverviewItem } from "../lib/domain/overview";
import { checkRole, isRoleId, ROLE_IDS, type Requirement, type RoleId } from "../lib/domain/requirements";

/** Localized name for the requirements that have one; STCW courses keep their international name. */
function requirementName(r: Requirement): string {
  return (t.requirements.items as Record<string, string>)[r.id] ?? r.name;
}

/** Checklist of the certificates a chosen role needs, against the user's documents. */
export function Requirements({ onAdd }: { onAdd: (name: string) => void }) {
  const [items, setItems] = useState<OverviewItem[] | null>(null);
  const [role, setRole] = useState<RoleId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const [classes, versions, saved] = await Promise.all([listClasses(db), listVersions(db), getSetting(db, SETTING_KEYS.careerRole)]);
        setItems(buildOverview(classes, versions, todayIso()));
        if (isRoleId(saved)) setRole(saved);
      } catch (err) {
        setError(String(err));
      }
    })();
  }, []);

  const choose = (next: RoleId | null) => {
    setRole(next);
    getDb()
      .then((db) => setSetting(db, SETTING_KEYS.careerRole, next ?? ""))
      .catch((err) => console.error("Could not save the role", err));
  };

  const checks = useMemo(() => (role && items ? checkRole(role, items) : []), [role, items]);
  const ok = checks.filter((c) => c.state === "valid").length;

  if (error) return <div className="notice notice-error">{t.common.error(error)}</div>;
  if (!items) return null;

  return (
    <div className="requirements">
      <p className="muted">{t.requirements.intro}</p>
      <label className="field">
        <span className="field-label">{t.requirements.role}</span>
        <select className="input language-select" value={role ?? ""} onChange={(e) => choose(isRoleId(e.target.value) ? e.target.value : null)}>
          <option value="">{t.requirements.chooseRole}</option>
          {ROLE_IDS.map((id) => (
            <option key={id} value={id}>
              {t.requirements.roles[id]}
            </option>
          ))}
        </select>
      </label>

      {role && (
        <>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={ok}>
            <span style={{ width: `${(ok / checks.length) * 100}%` }} className={ok === checks.length ? "done" : undefined} />
          </div>
          <strong>{t.requirements.summary(ok, checks.length)}</strong>
          <ul className="checklist">
            {checks.map(({ requirement, state, item }) => (
              <li key={requirement.id} className={`check-${state}`}>
                <span className="check-mark" aria-hidden="true">
                  {state === "valid" ? "✓" : state === "missing" ? "✕" : "!"}
                </span>
                <span className="check-text">
                  <strong>{requirementName(requirement)}</strong>
                  {item && <span className="muted small">{t.requirements.matched(item.documentClass.name)}</span>}
                </span>
                <span className={`badge badge-${state === "valid" ? "valid" : state === "soon" ? "warning" : state === "expired" ? "expired" : "critical"}`}>
                  {t.requirements.state[state]}
                </span>
                {state === "missing" && (
                  <button className="btn btn-small" onClick={() => onAdd(requirementName(requirement))}>
                    {t.requirements.add}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="field-hint">{t.requirements.disclaimer}</p>
    </div>
  );
}
