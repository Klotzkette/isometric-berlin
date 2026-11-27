import { Suspense, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { initialLanguage, UI_COPY, type Language } from "./localization";
import { directStartupMode } from "./modeLinks";
import { StartupModeSelection } from "./StartupModeSelection";
import { StartupPresentation } from "./StartupPresentation";
import { createStartupWorldRequests } from "./startupWorldRequests";
import { ThreeViewerErrorBoundary } from "./ThreeViewerErrorBoundary";
import { assetPath, resolveCssAssetUrl } from "./viewerAssetPath";
import { saveViewerVisit, type ViewerVisit } from "./viewerSessionRecovery";
import type { VisualMode } from "./visualMode";

export type ViewerAppProps = {
  initialMode: VisualMode;
  initialViewerLanguage: Language;
  recoveredVisit: ViewerVisit | null;
  sceneUrl: string;
  startupSources: ReturnType<typeof createStartupWorldRequests>;
};

export function ViewerLaunch({ Viewer, recoveredVisit }: {
  Viewer: ComponentType<ViewerAppProps>;
  recoveredVisit: ViewerVisit | null;
}) {
  const [mode, setMode] = useState<VisualMode | null>(() =>
    typeof window === "undefined" ? null : recoveredVisit?.mode ?? directStartupMode(window.location.search),
  );
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [requests] = useState(createStartupWorldRequests);
  const sceneUrl = assetPath("mesh/regierungsviertel/scene.json");
  const backdrop = resolveCssAssetUrl(assetPath("dzi/regierungsviertel/startup-map.jpg"));
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    if (mode === null) return;
    requests.prime(new URL(sceneUrl, window.location.href), mode);
    return requests.discard;
  }, [mode, requests, sceneUrl]);

  if (mode === null) {
    return (
      <StartupModeSelection
        initialMode="day" language={language} onLanguageChange={setLanguage} backdropUrl={backdrop}
        onStart={selected => {
          saveViewerVisit(window, { mode: selected, navigation: null, selected: null });
          setMode(selected);
        }}
      />
    );
  }

  const copy = UI_COPY[language];
  return (
    <ThreeViewerErrorBoundary detail={copy.threeLoadErrorDetail} message={copy.threeLoadError}
      reloadLabel={copy.reloadPage} onReload={() => window.location.reload()} onError={requests.discard}>
      <Suspense fallback={
        <main className={`app-shell app-shell--${mode}`} style={{
          "--viewer-static-backdrop-image": `url(${JSON.stringify(backdrop)})`,
        } as CSSProperties}>
          <StartupPresentation label={copy.loadingCity} percentage={0} indeterminate showBackdrop />
        </main>
      }>
        <Viewer initialMode={mode} initialViewerLanguage={language} recoveredVisit={recoveredVisit}
          sceneUrl={sceneUrl} startupSources={requests} />
      </Suspense>
    </ThreeViewerErrorBoundary>
  );
}
