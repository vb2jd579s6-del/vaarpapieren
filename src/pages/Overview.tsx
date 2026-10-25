import { t } from "../i18n";

export function Overview() {
  return (
    <>
      <h2>{t.overview.title}</h2>
      <p className="muted">{t.overview.empty}</p>
    </>
  );
}
