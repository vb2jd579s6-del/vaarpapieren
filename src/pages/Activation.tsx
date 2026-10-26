import { useEffect, useState, type FormEvent } from "react";
import shield from "../assets/shield.svg";
import { t } from "../i18n";
import { isActivationCode, loadActivated, saveActivated } from "../lib/activation";

/** One-time activation with the code from the owner; shown until it has been entered once. */
export function Activation({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Check the database once more first: if the app is activated after all, skip this screen. */
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    loadActivated()
      .then((activated) => (activated ? onActivated() : setChecking(false)))
      .catch(() => setChecking(false));
  }, [onActivated]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (await isActivationCode(code)) {
        await saveActivated();
        onActivated();
        return;
      }
      setError(t.activation.wrong);
    } catch (err) {
      setError(`${t.activation.error} ${t.common.error(String(err))}`);
    }
    setBusy(false);
  };

  if (checking) return <div className="activation" />;

  return (
    <div className="activation">
      <form className="activation-card" onSubmit={submit}>
        <img src={shield} alt="" />
        <h1>{t.activation.title}</h1>
        <p className="muted">{t.activation.intro}</p>
        <label className={`field${error ? " has-error" : ""}`}>
          <span className="field-label">{t.activation.codeLabel}</span>
          <input
            className="input"
            type="password"
            autoFocus
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || code.trim() === ""}>
          {busy ? t.activation.checking : t.activation.submit}
        </button>
      </form>
    </div>
  );
}
