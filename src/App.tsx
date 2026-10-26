import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { Tabs, type TabItem } from "./components/Tabs";
import { language, t, type Language } from "./i18n";
import { changeLanguage } from "./lib/language";
import { saveTabsPosition, type TabsPosition } from "./lib/layout";
import { listenForIphoneImports } from "./lib/files";
import { startNotificationService } from "./lib/notifications";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { RELOCK_AFTER_MS, saveLockEnabled } from "./lib/lock";
import { Activation } from "./pages/Activation";
import { LockScreen } from "./pages/LockScreen";
import { Add } from "./pages/Add";
import { Career } from "./pages/Career";
import { Overview } from "./pages/Overview";
import { Settings } from "./pages/Settings";
import { Splash } from "./pages/Splash";
import "./styles/theme.css";
import "./styles/app.css";

type Page = "overview" | "add" | "career" | "settings";

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}


interface AppProps {
  initialTabsPosition: TabsPosition;
  initiallyActivated: boolean;
  initialLockEnabled: boolean;
}

export default function App({ initialTabsPosition, initiallyActivated, initialLockEnabled }: AppProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  /** Mirrors the active language so a switch re-renders everything with the new texts. */
  const [lang, setLang] = useState<Language>(language);
  const [tabsPosition, setTabsPosition] = useState(initialTabsPosition);
  const [activated, setActivated] = useState(initiallyActivated);
  const [lockEnabled, setLockEnabled] = useState(initialLockEnabled);
  const [locked, setLocked] = useState(initialLockEnabled);

  // Relock when the window comes back after a while in the background (or hidden in the tray).
  useEffect(() => {
    if (!lockEnabled) return;
    let leftAt: number | null = null;
    const stop = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (!focused) leftAt = Date.now();
      else if (leftAt !== null && Date.now() - leftAt > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => void stop.then((unlisten) => unlisten());
  }, [lockEnabled]);
  /** A scan that arrived while no Add page was open; the nonce remounts Add so it takes it over. */
  const [pendingScan, setPendingScan] = useState<{ path: string; nonce: number } | null>(null);
  /** A document type to add, chosen from a missing requirement; prefills the Add form. */
  const [pendingName, setPendingName] = useState<{ name: string; nonce: number } | null>(null);
  /** Set when a notification was clicked; the nonce remounts the Overview so it reloads. */
  const [focus, setFocus] = useState<{ versionId: number; nonce: number } | null>(null);
  const endSplash = useCallback(() => setShowSplash(false), []);

  // A scan from the menu bar's Import from iPhone, with no Add page open: open one with it.
  useEffect(
    () =>
      listenForIphoneImports((path) => {
        setShowSplash(false);
        setPendingScan({ path, nonce: Date.now() });
        setPage("add");
      }),
    [],
  );

  // App menu → Settings (⌘,); the event name matches EVENT_OPEN_SETTINGS in lib.rs.
  useEffect(() => {
    const stop = listen("open-settings", () => {
      setShowSplash(false);
      setPage("settings");
    });
    return () => void stop.then((unlisten) => unlisten());
  }, []);

  useEffect(
    () =>
      startNotificationService((versionId) => {
        setShowSplash(false);
        setPage("overview");
        setFocus({ versionId, nonce: Date.now() });
      }),
    [],
  );

  const switchLanguage = (next: Language) => {
    changeLanguage(next).catch((err) => console.error("Could not save the language", err));
    setLang(next);
  };

  const moveTabs = (next: TabsPosition) => {
    setTabsPosition(next);
    saveTabsPosition(next).catch((err) => console.error("Could not save the tabs position", err));
  };

  if (showSplash) return <Splash onDone={endSplash} />;
  if (!activated) return <Activation onActivated={() => setActivated(true)} />;
  if (locked) return <LockScreen onUnlocked={() => setLocked(false)} />;

  const tabs: TabItem<"overview" | "add" | "career">[] = [
    { id: "overview", label: t.tabs.overview },
    { id: "add", label: t.tabs.add },
    { id: "career", label: t.tabs.career },
  ];

  return (
    <div className="shell">
      <header className={`topbar tabs-${tabsPosition}`}>
        <Tabs items={tabs} active={page === "settings" ? null : page} onChange={setPage} />
        <button
          className="icon-btn settings-btn"
          title={t.tabs.settings}
          aria-label={t.tabs.settings}
          aria-pressed={page === "settings"}
          onClick={() => setPage("settings")}
        >
          <GearIcon />
        </button>
      </header>
      <main className="content">
        {page === "overview" && <Overview key={focus?.nonce} focusVersionId={focus?.versionId} onAdd={() => setPage("add")} />}
        {page === "add" && (
          <Add
            key={`${pendingScan?.nonce}-${pendingName?.nonce}`}
            initialFile={pendingScan?.path ?? null}
            initialClassName={pendingName?.name ?? ""}
            onSaved={() => setPage("overview")}
          />
        )}
        {page === "career" && <Career onAddDocument={(name) => (setPendingName({ name, nonce: Date.now() }), setPage("add"))} />}
        {page === "settings" && (
          <Settings
            language={lang}
            onLanguageChange={switchLanguage}
            tabsPosition={tabsPosition}
            onTabsPositionChange={moveTabs}
            lockEnabled={lockEnabled}
            onLockEnabledChange={(on) => {
              setLockEnabled(on);
              saveLockEnabled(on).catch((err) => console.error("Could not save the lock setting", err));
            }}
          />
        )}
      </main>
    </div>
  );
}
