import { Home, LocateFixed, Map, Minus, Plus } from "lucide-react";
import OpenSeadragon from "openseadragon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Landmark = {
  name: string;
  role: string;
  x: number;
  y: number;
  nx: number;
  ny: number;
};

type LandmarkPayload = {
  image: { width: number; height: number };
  landmarks: Landmark[];
};

const ATTRIBUTION =
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)";

function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selected, setSelected] = useState<string>("Reichstagsgebäude");
  const [status, setStatus] = useState("Lade DZI");
  const [isReady, setIsReady] = useState(false);

  const dziUrl = useMemo(
    () => assetPath("dzi/regierungsviertel/regierungsviertel.dzi"),
    [],
  );

  const focusLandmark = useCallback((landmark: Landmark, immediate = false) => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.viewport) {
      return;
    }
    const point = viewer.viewport.imageToViewportCoordinates(landmark.x, landmark.y);
    setSelected(landmark.name);
    viewer.viewport.panTo(point, immediate);
    viewer.viewport.zoomTo(3.1, point, immediate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(assetPath("dzi/regierungsviertel/landmarks.json"))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<LandmarkPayload>;
      })
      .then((payload) => {
        if (!cancelled) {
          setLandmarks(payload.landmarks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("Landmarken nicht geladen");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return;
    }

    const viewer = OpenSeadragon({
      id: "openseadragon-viewer",
      element: containerRef.current,
      tileSources: dziUrl,
      showNavigationControl: false,
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT",
      navigatorHeight: "128px",
      navigatorWidth: "214px",
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: true,
        dragToPan: true,
        scrollToZoom: true,
      },
      animationTime: 0.75,
      blendTime: 0.1,
      constrainDuringPan: true,
      minZoomImageRatio: 0.82,
      maxZoomPixelRatio: 6,
      visibilityRatio: 0.9,
      homeFillsViewer: false,
      springStiffness: 7,
    });
    viewerRef.current = viewer;
    viewer.addHandler("open", () => {
      setIsReady(true);
      setStatus("Bereit");
    });
    viewer.addHandler("open-failed", () => {
      setStatus("DZI nicht gefunden");
    });

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [dziUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isReady || landmarks.length === 0) {
      return;
    }
    viewer.clearOverlays();
    for (const landmark of landmarks) {
      const marker = document.createElement("button");
      marker.className =
        landmark.name === selected
          ? "map-marker map-marker--selected"
          : "map-marker";
      marker.type = "button";
      marker.title = landmark.name;
      marker.setAttribute("aria-label", landmark.name);
      marker.addEventListener("click", () => focusLandmark(landmark));
      viewer.addOverlay({
        element: marker,
        location: viewer.viewport.imageToViewportCoordinates(landmark.x, landmark.y),
        placement: OpenSeadragon.Placement.CENTER,
        checkResize: false,
      });
    }
  }, [focusLandmark, isReady, landmarks, selected]);

  useEffect(() => {
    if (!isReady || landmarks.length === 0) {
      return;
    }
    const initial =
      landmarks.find((landmark) => landmark.name === selected) ?? landmarks[0];
    focusLandmark(initial, true);
  }, [focusLandmark, isReady, landmarks, selected]);

  return (
    <main className="app-shell">
      <section className="map-stage" aria-label="Isometrische Berlin-Karte">
        <div id="openseadragon-viewer" ref={containerRef} className="viewer" />
      </section>

      <header className="topbar">
        <div className="brand">
          <Map aria-hidden="true" size={22} />
          <div>
            <h1>Isometric Berlin</h1>
            <span>Regierungsviertel</span>
          </div>
        </div>
        <div className="toolbar" aria-label="Kartensteuerung">
          <button
            type="button"
            aria-label="Gesamtansicht"
            title="Gesamtansicht"
            onClick={() => viewerRef.current?.viewport.goHome()}
          >
            <Home size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Vergrößern"
            title="Vergrößern"
            onClick={() => viewerRef.current?.viewport.zoomBy(1.35)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Verkleinern"
            title="Verkleinern"
            onClick={() => viewerRef.current?.viewport.zoomBy(0.74)}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <aside className="landmark-rail" aria-label="Landmarken">
        <div className="rail-heading">
          <LocateFixed aria-hidden="true" size={17} />
          <span>Landmarken</span>
        </div>
        <div className="landmark-list">
          {landmarks.map((landmark) => (
            <button
              key={landmark.name}
              type="button"
              className={landmark.name === selected ? "is-selected" : ""}
              onClick={() => focusLandmark(landmark)}
            >
              <span>{landmark.name}</span>
              <small>{landmark.role.replaceAll("_", " ")}</small>
            </button>
          ))}
        </div>
      </aside>

      <footer className="attribution">
        <span>{ATTRIBUTION}</span>
        <span>{status}</span>
      </footer>
    </main>
  );
}
