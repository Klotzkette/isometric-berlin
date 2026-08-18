import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { installPreloadErrorRecovery } from "./preloadRecovery";
import { PROJECT_VERSION } from "./projectMetadata";
import "./styles.css";

// Register before React can request a lazy viewer chunk. A tab kept open over
// a deployment can otherwise retain an HTML manifest whose hashed 3D asset no
// longer exists on the server.
installPreloadErrorRecovery({ version: PROJECT_VERSION });

const root = document.getElementById("root") as HTMLElement;
// index.html carries a no-JavaScript startup plate so the first response is
// never a blank screen. React owns the node from this point onward.
root.replaceChildren();
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
