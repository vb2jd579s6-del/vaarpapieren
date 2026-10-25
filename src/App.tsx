import { useCallback, useState } from "react";
import { Tabs, type TabItem } from "./components/Tabs";
import { t } from "./i18n";
import { Add } from "./pages/Add";
import { Overview } from "./pages/Overview";
import { Settings } from "./pages/Settings";
import { Splash } from "./pages/Splash";
import "./styles/theme.css";
import "./styles/app.css";

type Page = "overview" | "add" | "settings";

const TABS: TabItem<"overview" | "add">[] = [
  { id: "overview", label: t.tabs.overview },
  { id: "add", label: t.tabs.add },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  const endSplash = useCallback(() => setShowSplash(false), []);

  if (showSplash) return <Splash onDone={endSplash} />;

  return (
    <div className="shell">
      <header className="topbar">
        <Tabs items={TABS} active={page === "settings" ? null : page} onChange={setPage} />
        <button
          className="icon-btn"
          title={t.tabs.settings}
          aria-label={t.tabs.settings}
          aria-pressed={page === "settings"}
          onClick={() => setPage("settings")}
        >
          ⚙
        </button>
      </header>
      <main className="content">
        {page === "overview" && <Overview />}
        {page === "add" && <Add />}
        {page === "settings" && <Settings />}
      </main>
    </div>
  );
}
