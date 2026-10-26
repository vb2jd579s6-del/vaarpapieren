import { useCallback, useEffect, useRef, useState } from "react";
import shield from "../assets/shield.svg";
import { t } from "../i18n";
import { authenticate } from "../lib/lock";

/** Covers the app until Touch ID (or the Mac's password) succeeds; asks right away. */
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const asked = useRef(false);

  const unlock = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (await authenticate(t.lock.reason)) {
        onUnlocked();
        return;
      }
      setFailed(true);
    } catch (err) {
      console.error("Authentication failed", err);
      setFailed(true);
    }
    setBusy(false);
  }, [onUnlocked]);

  useEffect(() => {
    if (!asked.current) {
      asked.current = true;
      void unlock();
    }
  }, [unlock]);

  return (
    <div className="activation">
      <div className="activation-card">
        <img src={shield} alt="" />
        <h1>{t.lock.title}</h1>
        <p className="muted">{t.lock.hint}</p>
        {failed && <span className="field-error">{t.lock.failed}</span>}
        <button className="btn btn-primary" onClick={unlock} disabled={busy} autoFocus>
          {t.lock.unlock}
        </button>
      </div>
    </div>
  );
}
