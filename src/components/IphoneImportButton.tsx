import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { canImportFromIphone, onIphoneImport, showIphoneImportMenu } from "../lib/files";

/** "Import from iPhone…": scan a document or take a photo with a nearby iPhone (macOS only). */
export function IphoneImportButton({ onFile, onError }: { onFile: (path: string) => void; onError: (err: unknown) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const latest = useRef(onFile);
  latest.current = onFile;

  useEffect(() => onIphoneImport((path) => latest.current(path)), []);

  if (!canImportFromIphone) return null;
  return (
    <button
      ref={ref}
      type="button"
      className="btn"
      onClick={() => ref.current && showIphoneImportMenu(ref.current, t.add.importFromIphone).catch(onError)}
    >
      <PhoneIcon />
      {t.add.importFromIphone}
    </button>
  );
}

function PhoneIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}
