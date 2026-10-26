import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import shieldPng from "../assets/shield-pdf.png";
import { t } from "../i18n";
import { buildCertificateList } from "../lib/certificateList";
import { getDb } from "../lib/db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "../lib/db/settings";
import type { OverviewItem } from "../lib/domain/overview";
import { Field } from "./FormFields";
import { Modal } from "./Modal";

interface CertificateListDialogProps {
  items: OverviewItem[];
  onClose: () => void;
  onSaved: (path: string) => void;
}

/** Asks for the name on top and whether to include expired documents, then saves the PDF. */
export function CertificateListDialog({ items, onClose, onSaved }: CertificateListDialogProps) {
  const [holderName, setHolderName] = useState("");
  const [includeExpired, setIncludeExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then((db) => getSetting(db, SETTING_KEYS.holderName))
      .then((name) => name && setHolderName(name))
      .catch(() => {});
  }, []);

  const saveList = async () => {
    setError(null);
    const date = new Date().toISOString().slice(0, 10);
    const dest = await save({ defaultPath: `${t.pdf.title} ${date}.pdf`, filters: [{ name: t.pdf.filter, extensions: ["pdf"] }] }).catch(
      (err) => (setError(String(err)), null),
    );
    if (!dest) return;
    setBusy(true);
    try {
      const logoPng = new Uint8Array(await (await fetch(shieldPng)).arrayBuffer());
      const bytes = await buildCertificateList(items, t, { holderName, includeExpired, logoPng });
      await invoke("save_file", { dest, bytes: Array.from(bytes) });
      await setSetting(await getDb(), SETTING_KEYS.holderName, holderName.trim());
      onSaved(dest);
    } catch (err) {
      setError(t.common.error(String(err)));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t.pdf.dialogTitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            {t.actions.cancel}
          </button>
          <button className="btn btn-primary" onClick={saveList} disabled={busy}>
            {busy ? t.pdf.saving : t.pdf.save}
          </button>
        </>
      }
    >
      {error && <div className="notice notice-error">{error}</div>}
      <Field label={t.pdf.holderName} optional>
        <input className="input" placeholder={t.pdf.holderPlaceholder} value={holderName} onChange={(e) => setHolderName(e.target.value)} />
      </Field>
      <label className="checkbox">
        <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
        {t.pdf.includeExpired}
      </label>
    </Modal>
  );
}
