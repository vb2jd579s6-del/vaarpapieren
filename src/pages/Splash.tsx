import { useEffect } from "react";
import shield from "../assets/shield.svg";
import { t } from "../i18n";

const SPLASH_MS = 2000;

/** Start screen: only the Tharsis shield, then on to the app after 2 s or a click. */
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="splash" onClick={onDone} role="button" aria-label={t.app.splashHint}>
      <img src={shield} alt={t.app.name} />
    </div>
  );
}
