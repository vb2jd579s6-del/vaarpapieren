import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadLanguage } from "./lib/language";

// The language comes from the database, so load it before the first render to avoid a flash of the default.
loadLanguage()
  .catch((err) => console.error("Could not load the language setting", err))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
