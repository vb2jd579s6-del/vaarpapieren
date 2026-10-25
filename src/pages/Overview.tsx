import { useEffect, useMemo, useState } from "react";
import { DocumentCard } from "../components/DocumentCard";
import { DocumentTable } from "../components/DocumentTable";
import { SegmentedControl } from "../components/SegmentedControl";
import { t } from "../i18n";
import { listClasses } from "../lib/db/classes";
import { getDb } from "../lib/db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "../lib/db/settings";
import { listVersions } from "../lib/db/versions";
import { todayIso } from "../lib/domain/dates";
import { buildOverview, filterOverview, type OverviewItem } from "../lib/domain/overview";
import { CATEGORIES, type Category } from "../lib/domain/types";

type View = "grid" | "list";

export function Overview({ onAdd }: { onAdd: () => void }) {
  const [items, setItems] = useState<OverviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("grid");
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const [classes, versions, savedView] = await Promise.all([
          listClasses(db),
          listVersions(db),
          getSetting(db, SETTING_KEYS.overviewView),
        ]);
        if (cancelled) return;
        if (savedView === "grid" || savedView === "list") setView(savedView);
        setItems(buildOverview(classes, versions, todayIso()));
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => (items ? filterOverview(items, { category, query }) : []), [items, category, query]);

  const changeView = (next: View) => {
    setView(next);
    getDb()
      .then((db) => setSetting(db, SETTING_KEYS.overviewView, next))
      .catch((err) => console.error("Could not save view setting", err));
  };

  if (error) {
    return (
      <div className="notice notice-error">
        <strong>{t.overview.loadError}</strong>
        <div className="small">{t.common.error(error)}</div>
      </div>
    );
  }
  if (items === null) return null;

  if (items.length === 0) {
    return (
      <div className="empty">
        <p className="muted">{t.overview.empty}</p>
        <button className="btn btn-primary" onClick={onAdd}>
          {t.overview.addFirst}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          className="input search"
          placeholder={t.overview.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input"
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value === "" ? null : (e.target.value as Category))}
        >
          <option value="">{t.overview.allCategories}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <SegmentedControl
          label={t.overview.viewLabel}
          value={view}
          onChange={changeView}
          segments={[
            { id: "grid", label: t.overview.viewGrid },
            { id: "list", label: t.overview.viewList },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <p className="muted">{t.overview.noResults}</p>
      ) : view === "grid" ? (
        <div className="card-grid">
          {visible.map((item) => (
            <DocumentCard key={item.documentClass.id} item={item} />
          ))}
        </div>
      ) : (
        <DocumentTable items={visible} />
      )}
    </>
  );
}
