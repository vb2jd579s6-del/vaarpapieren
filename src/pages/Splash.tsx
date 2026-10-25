import { useEffect } from "react";
import logo from "../assets/tharsis-logo.png";
import { t } from "../i18n";

const SPLASH_MS = 2000;

export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="splash" onClick={onDone} role="button" aria-label={t.app.splashHint}>
      <img src={logo} alt="Tharsis Ship Management" />
      <h1>{t.app.name}</h1>
      <span className="hint">{t.app.splashHint}</span>
    </div>
  );
}
