import { useCallback, useEffect, useState } from "react";
import { Tabs, type TabItem } from "./components/Tabs";
import { language, t, type Language } from "./i18n";
import { changeLanguage } from "./lib/language";
import { startNotificationService } from "./lib/notifications";
import { Add } from "./pages/Add";
import { Overview } from "./pages/Overview";
import { Settings } from "./pages/Settings";
import { Splash } from "./pages/Splash";
import "./styles/theme.css";
import "./styles/app.css";

type Page = "overview" | "add" | "settings";

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}


export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  /** Mirrors the active language so a switch re-renders everything with the new texts. */
  const [lang, setLang] = useState<Language>(language);
  /** Set when a notification was clicked; the nonce remounts the Overview so it reloads. */
  const [focus, setFocus] = useState<{ versionId: number; nonce: number } | null>(null);
  const endSplash = useCallback(() => setShowSplash(false), []);

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

  if (showSplash) return <Splash onDone={endSplash} />;

  const tabs: TabItem<"overview" | "add">[] = [
    { id: "overview", label: t.tabs.overview },
    { id: "add", label: t.tabs.add },
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <Tabs items={tabs} active={page === "settings" ? null : page} onChange={setPage} />
        <span className="topbar-spacer" />
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
        {page === "add" && <Add onSaved={() => setPage("overview")} />}
        {page === "settings" && <Settings language={lang} onLanguageChange={switchLanguage} />}
      </main>
    </div>
  );
}
