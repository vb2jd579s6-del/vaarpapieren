import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadLanguage } from "./lib/language";
import { loadActivated } from "./lib/activation";
import { DEFAULT_TABS_POSITION, loadTabsPosition } from "./lib/layout";

const report = (what: string) => (err: unknown) => console.error(`Could not load the ${what} setting`, err);

// These come from the database, so load them before the first render to avoid a flash of the defaults.
Promise.all([
  loadLanguage().catch(report("language")),
  loadTabsPosition().catch((err) => (report("tabs position")(err), DEFAULT_TABS_POSITION)),
  loadActivated().catch((err) => (report("activation")(err), false)),
]).then(([, tabsPosition, activated]) => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App initialTabsPosition={tabsPosition} initiallyActivated={activated} />
    </React.StrictMode>,
  );
});
