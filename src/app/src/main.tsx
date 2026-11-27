import React, { lazy } from "react";
import ReactDOM from "react-dom/client";

import { ViewerLaunch } from "./ViewerLaunch";
import { installPreloadErrorRecovery, withInitialViewerPreloadRecovery } from "./preloadRecovery";
import { preloadThreeViewer } from "./viewerEngineLoader";
import { readViewerVisit } from "./viewerSessionRecovery";
import { PROJECT_VERSION } from "./projectMetadata";
import "./styles.css";

// Register before React can request a lazy viewer chunk. A tab kept open over
// a deployment can otherwise retain an HTML manifest whose hashed 3D asset no
// longer exists on the server.
installPreloadErrorRecovery({ version: PROJECT_VERSION });

const recoveredVisit = readViewerVisit(window);
const LazyViewerApp = lazy(async () => {
  // The controller and the renderer travel in parallel once a mode is selected.
  const controller = withInitialViewerPreloadRecovery(() => import("./App"));
  void preloadThreeViewer().catch(() => undefined);
  const module = await controller;
  // The permanent landmarks still open if the optional city catalogue fails.
  await module.prepareInitialPlaceView(recoveredVisit)?.catch(() => undefined);
  return { default: module.ViewerApp };
});

const root = document.getElementById("root") as HTMLElement;
// index.html carries a no-JavaScript startup plate so the first response is
// never a blank screen. React owns the node from this point onward.
root.replaceChildren();
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ViewerLaunch Viewer={LazyViewerApp} recoveredVisit={recoveredVisit} />
  </React.StrictMode>,
);
