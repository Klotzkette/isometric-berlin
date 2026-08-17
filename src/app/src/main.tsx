import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root") as HTMLElement;
// index.html carries a no-JavaScript startup plate so the first response is
// never a blank screen. React owns the node from this point onward.
root.replaceChildren();
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
