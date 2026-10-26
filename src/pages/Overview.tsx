import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeleteDialog } from "../components/DeleteDialog";
import type { VersionHandlers } from "../components/DocumentActions";
import { DocumentCard } from "../components/DocumentCard";
import { EditDialog } from "../components/EditDialog";
import { ExpandedDocument } from "../components/ExpandedDocument";
import { DocumentTable } from "../components/DocumentTable";
import { SegmentedControl } from "../components/SegmentedControl";
import { t } from "../i18n";
import { listClasses } from "../lib/db/classes";
import { getDb } from "../lib/db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "../lib/db/settings";
import { listVersions } from "../lib/db/versions";
import { todayIso } from "../lib/domain/dates";
import { buildOverview, countByGroup, filterOverview, type OverviewItem, type StatusGroup } from "../lib/domain/overview";
import { CATEGORIES, type Category, type DocumentClass, type DocumentVersion } from "../lib/domain/types";
import { FILE_NOT_FOUND, openDocumentFile } from "../lib/files";
import { refreshMenus } from "../lib/menus";
import { sendTestNotification } from "../lib/notifications";
import { EXPAND_TRANSITION, withViewTransition } from "../lib/viewTransition";

type View = "grid" | "list";

interface DialogState {
  kind: "edit" | "delete";
  item: OverviewItem;
  version: DocumentVersion;
  isCurrent: boolean;
}

interface Message {
  kind: "error" | "info";
  text: string;
  detail?: string;
}

export function Overview({ onAdd, focusVersionId }: { onAdd: () => void; focusVersionId?: number }) {
  const [items, setItems] = useState<OverviewItem[] | null>(null);
  const [classes, setClasses] = useState<DocumentClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [view, setView] = useState<View>("grid");
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<StatusGroup | null>(null);
  /** The enlarged card, by class (so it follows reloads) and the version it showed. */
  const [expanded, setExpanded] = useState<{ classId: number; versionId: number } | null>(null);
  const expandedFrom = useRef<HTMLElement | null>(null);

  const reload = useCallback(async () => {
    const db = await getDb();
    const [cls, versions] = await Promise.all([listClasses(db), listVersions(db)]);
    setClasses(cls);
    setItems(buildOverview(cls, versions, todayIso()));
    void refreshMenus(); // the Dock badge and tray menu follow every load and change
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const [savedView, introDone] = await Promise.all([
          getSetting(db, SETTING_KEYS.overviewView),
          getSetting(db, SETTING_KEYS.notificationsIntroDone),
        ]);
        if (cancelled) return;
        if (savedView === "grid" || savedView === "list") setView(savedView);
        setShowIntro(introDone === undefined);
        await reload();
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const handlers: VersionHandlers = useMemo(() => {
    const find = (version: DocumentVersion) => items?.find((i) => i.documentClass.id === version.class_id);
    return {
      onOpen: (version) => {
        if (!version.file_path) return;
        openDocumentFile(version.file_path).catch((err) =>
          setMessage(
            String(err) === FILE_NOT_FOUND
              ? { kind: "error", text: t.actions.fileNotFound }
              : { kind: "error", text: t.actions.openError, detail: String(err) },
          ),
        );
      },
      onEdit: (version, isCurrent) => {
        const item = find(version);
        if (item) setDialog({ kind: "edit", item, version, isCurrent });
      },
      onDelete: (version, isCurrent) => {
        const item = find(version);
        if (item) setDialog({ kind: "delete", item, version, isCurrent });
      },
      onExpand: (item, versionId, from) => {
        // The card carries the shared name in the "before" picture, the panel in the "after" one.
        expandedFrom.current = from;
        from.style.viewTransitionName = EXPAND_TRANSITION;
        void withViewTransition(() => {
          from.style.viewTransitionName = "";
          setExpanded({ classId: item.documentClass.id, versionId });
        });
      },
    };
  }, [items]);

  const closeExpanded = useCallback(() => {
    const card = expandedFrom.current;
    void withViewTransition(() => {
      setExpanded(null);
      if (card?.isConnected) card.style.viewTransitionName = EXPAND_TRANSITION;
    }).then(() => {
      if (card) card.style.viewTransitionName = "";
    });
  }, []);

  const expandedItem = expanded ? items?.find((i) => i.documentClass.id === expanded.classId) : undefined;

  const afterChange = (warning?: string) => {
    setDialog(null);
    setMessage(warning ? { kind: "error", text: warning } : null);
    reload().catch((err) => setError(String(err)));
  };

  const visible = useMemo(() => (items ? filterOverview(items, { category, query, group }) : []), [items, category, query, group]);
  const counts = useMemo(() => countByGroup(items ?? []), [items]);

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

  const dialogs = dialog && (
    <>
      {dialog.kind === "edit" && (
        <EditDialog
          documentClass={dialog.item.documentClass}
          version={dialog.version}
          isCurrent={dialog.isCurrent}
          versionCount={dialog.item.versions.length}
          otherClassNames={classes.filter((c) => c.id !== dialog.item.documentClass.id).map((c) => c.name)}
          onClose={() => setDialog(null)}
          onSaved={afterChange}
        />
      )}
      {dialog.kind === "delete" && (
        <DeleteDialog
          documentClass={dialog.item.documentClass}
          version={dialog.version}
          isCurrent={dialog.isCurrent}
          versionCount={dialog.item.versions.length}
          onClose={() => setDialog(null)}
          onDeleted={afterChange}
        />
      )}
    </>
  );

  const dismissIntro = () => {
    setShowIntro(false);
    getDb()
      .then((db) => setSetting(db, SETTING_KEYS.notificationsIntroDone, "1"))
      .catch((err) => console.error("Could not save intro setting", err));
  };

  const intro = showIntro && (
    <div className="notice">
      <strong>{t.notifications.introTitle}</strong>
      <p className="small">{t.notifications.intro}</p>
      <div className="actions">
        <button
          className="btn btn-small btn-primary"
          onClick={() =>
            sendTestNotification().then(
              (ok) => !ok && setMessage({ kind: "error", text: t.settings.permissionDenied }),
              (err) => setMessage({ kind: "error", text: t.settings.error, detail: String(err) }),
            )
          }
        >
          {t.notifications.introTest}
        </button>
        <button className="btn btn-small" onClick={dismissIntro}>
          {t.notifications.introDone}
        </button>
      </div>
    </div>
  );

  const banner = message && (
    <div className={`notice${message.kind === "error" ? " notice-error" : ""}`} role="status">
      <div className="notice-row">
        <strong>{message.text}</strong>
        <button className="icon-btn small" onClick={() => setMessage(null)} aria-label={t.actions.cancel}>
          ✕
        </button>
      </div>
      {message.detail && <div className="small">{t.common.error(message.detail)}</div>}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="empty">
        {banner}
        {intro}
        <p className="muted">{t.overview.empty}</p>
        <button className="btn btn-primary" onClick={onAdd}>
          {t.overview.addFirst}
        </button>
      </div>
    );
  }

  return (
    <>
      {banner}
      {intro}
      <div className="summary" role="group" aria-label={t.overview.title}>
        {(["expired", "soon", "valid"] as const).map((g) => (
          <button
            key={g}
            className={`summary-chip summary-${g}`}
            aria-pressed={group === g}
            disabled={counts[g] === 0}
            onClick={() => setGroup(group === g ? null : g)}
          >
            <span className="summary-dot" />
            {t.overview.summary[g](counts[g])}
          </button>
        ))}
        {group && (
          <button className="summary-clear" onClick={() => setGroup(null)}>
            {t.overview.summary.showAll}
          </button>
        )}
      </div>
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
            <DocumentCard key={item.documentClass.id} item={item} handlers={handlers} focusVersionId={focusVersionId} />
          ))}
        </div>
      ) : (
        <DocumentTable items={visible} handlers={handlers} focusVersionId={focusVersionId} />
      )}
      {expanded && expandedItem && (
        <ExpandedDocument item={expandedItem} versionId={expanded.versionId} handlers={handlers} onClose={closeExpanded} />
      )}
      {dialogs}
    </>
  );
}
