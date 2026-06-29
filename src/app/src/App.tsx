import {
  Compass,
  FlipHorizontal2,
  FlipVertical2,
  Home,
  Info,
  LocateFixed,
  Map,
  MapPinned,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
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
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia";

const ROLE_LABELS: Record<string, string> = {
  hero_tile: "Hauptmotiv",
  must_be_visible: "Pflicht-Landmarke",
  owner_added: "ergänzter Ort",
};

const LANDMARK_SHORT_LABELS: Record<string, string> = {
  "Berlin Hauptbahnhof": "Hauptbahnhof",
  "Bundeskanzleramt": "Kanzleramt",
  "Marie-Elisabeth-Lüders-Haus": "M.-E.-Lüders-Haus",
  "Paul-Löbe-Haus": "Paul-Löbe-Haus",
  "Reichstagsgebäude": "Reichstag",
  "Brandenburger Tor": "Brandenburger Tor",
  "Botschaft der Vereinigten Staaten von Amerika": "US-Botschaft",
  "Max-Liebermann-Haus": "Max-Liebermann-Haus",
  "Haus der Kulturen der Welt (Schwangere Auster)": "HKW",
  "Zollpackhof": "Zollpackhof",
  "Gustav-Heinemann-Brücke": "Gustav-Heinemann-Brücke",
  Spreebogen: "Spreebogen",
  "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)":
    "Tiergartentunnel",
};

const NORTH_UP_ROTATION = 296.565051177078;

const ORIENTATIONS = [
  { degrees: NORTH_UP_ROTATION, short: "N", label: "Nord oben" },
  { degrees: NORTH_UP_ROTATION + 90, short: "O", label: "Ost oben" },
  { degrees: NORTH_UP_ROTATION + 180, short: "S", label: "Süd oben" },
  { degrees: NORTH_UP_ROTATION + 270, short: "W", label: "West oben" },
] as const;

let openSeadragonConsoleFilterInstalled = false;

function installOpenSeadragonConsoleFilter(): void {
  if (openSeadragonConsoleFilterInstalled) {
    return;
  }
  const osd = OpenSeadragon as typeof OpenSeadragon & {
    console?: Pick<Console, "debug" | "error">;
  };
  const osdConsole = osd.console;
  if (!osdConsole?.error) {
    return;
  }
  const originalError = osdConsole.error.bind(osdConsole);
  osdConsole.error = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    if (
      message.includes("Tile %s failed to load") &&
      message.includes("Image load aborted")
    ) {
      osdConsole.debug?.(...args);
      return;
    }
    originalError(...args);
  };
  openSeadragonConsoleFilterInstalled = true;
}

function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

function landmarkShortLabel(name: string): string {
  return LANDMARK_SHORT_LABELS[name] ?? name;
}

function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function rotationDistance(left: number, right: number): number {
  const diff = Math.abs(normalizeRotation(left - right));
  return Math.min(diff, 360 - diff);
}

function isRotationActive(left: number, right: number): boolean {
  return rotationDistance(left, right) < 0.01;
}

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const initialFocusDoneRef = useRef(false);
  const rotationRef = useRef(NORTH_UP_ROTATION);
  const flipRef = useRef(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selected, setSelected] = useState<string>("Reichstagsgebäude");
  const [status, setStatus] = useState("Lade DZI");
  const [isReady, setIsReady] = useState(false);
  const [rotation, setRotation] = useState(NORTH_UP_ROTATION);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);

  const dziUrl = useMemo(
    () => assetPath("dzi/regierungsviertel/regierungsviertel.dzi"),
    [],
  );
  const referenceMapUrl = useMemo(
    () => assetPath("dzi/regierungsviertel/reference_map.png"),
    [],
  );
  const selectedLandmark = useMemo(
    () =>
      landmarks.find((landmark) => landmark.name === selected) ??
      landmarks[0] ??
      null,
    [landmarks, selected],
  );
  const orientation = useMemo(
    () =>
      ORIENTATIONS.find((candidate) =>
        isRotationActive(candidate.degrees, rotation),
      ) ?? null,
    [rotation],
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
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    flipRef.current = isFlipped;
  }, [isFlipped]);

  const applyRotation = useCallback((degrees: number) => {
    const next = normalizeRotation(degrees);
    viewerRef.current?.viewport.setRotation(next);
    setRotation(next);
  }, []);

  const rotateBy = useCallback((delta: number) => {
    setRotation((current) => {
      const next = normalizeRotation(current + delta);
      viewerRef.current?.viewport.setRotation(next);
      return next;
    });
  }, []);

  const toggleHorizontalFlip = useCallback(() => {
    setIsFlipped((current) => {
      const next = !current;
      viewerRef.current?.viewport.setFlip(next);
      return next;
    });
  }, []);

  const flipVertical = useCallback(() => {
    setRotation((current) => {
      const nextRotation = normalizeRotation(current + 180);
      viewerRef.current?.viewport.setRotation(nextRotation);
      return nextRotation;
    });
    setIsFlipped((current) => {
      const next = !current;
      viewerRef.current?.viewport.setFlip(next);
      return next;
    });
  }, []);

  const resetOrientation = useCallback(() => {
    viewerRef.current?.viewport.setRotation(NORTH_UP_ROTATION);
    viewerRef.current?.viewport.setFlip(false);
    setRotation(NORTH_UP_ROTATION);
    setIsFlipped(false);
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
    if (!isReferenceOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsReferenceOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isReferenceOpen]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return;
    }

    installOpenSeadragonConsoleFilter();
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
      minZoomImageRatio: 0.56,
      maxZoomPixelRatio: 6,
      visibilityRatio: 0.74,
      homeFillsViewer: false,
      springStiffness: 7,
    });
    viewerRef.current = viewer;
    viewer.addHandler("open", () => {
      viewer.viewport.setRotation(rotationRef.current);
      viewer.viewport.setFlip(flipRef.current);
      viewer.viewport.goHome(true);
      viewer.viewport.zoomBy(0.76, undefined, true);
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
      marker.dataset.label = landmarkShortLabel(landmark.name);
      marker.dataset.role = landmark.role;
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
    if (!isReady || landmarks.length === 0 || initialFocusDoneRef.current) {
      return;
    }
    initialFocusDoneRef.current = true;
  }, [isReady, landmarks]);

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

      <aside className="orientation-pill" aria-label="Kartenorientierung">
        <Compass aria-hidden="true" size={16} />
        <span>{orientation?.short ?? `${Math.round(rotation)}°`}</span>
        <small>
          {isFlipped
            ? `${orientation?.label ?? "frei gedreht"} · gespiegelt`
            : (orientation?.label ?? "frei gedreht")}
        </small>
      </aside>

      <aside className="view-controls" aria-label="Ansicht drehen und spiegeln">
        <div className="control-row" role="group" aria-label="Kardinalrichtung oben">
          {ORIENTATIONS.map((candidate) => (
            <button
              key={candidate.short}
              type="button"
              aria-label={candidate.label}
              aria-pressed={isRotationActive(rotation, candidate.degrees)}
              title={candidate.label}
              onClick={() => applyRotation(candidate.degrees)}
            >
              <span>{candidate.short}</span>
            </button>
          ))}
        </div>
        <div className="control-row" role="group" aria-label="Ansicht umklappen">
          <button
            type="button"
            aria-label="Nach links drehen"
            title="Nach links drehen"
            onClick={() => rotateBy(-90)}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Nach rechts drehen"
            title="Nach rechts drehen"
            onClick={() => rotateBy(90)}
          >
            <RotateCw size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Horizontal spiegeln"
            aria-pressed={isFlipped}
            title="Horizontal spiegeln"
            onClick={toggleHorizontalFlip}
          >
            <FlipHorizontal2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Vertikal klappen"
            title="Vertikal klappen"
            onClick={flipVertical}
          >
            <FlipVertical2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Ausrichtung zurücksetzen"
            title="Ausrichtung zurücksetzen"
            onClick={resetOrientation}
          >
            <Compass size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Top-down Referenzkarte"
            aria-pressed={isReferenceOpen}
            title="Top-down Referenzkarte"
            onClick={() => setIsReferenceOpen(true)}
          >
            <MapPinned size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <aside className="landmark-rail" aria-label="Landmarken">
        <div className="rail-heading">
          <LocateFixed aria-hidden="true" size={17} />
          <span>Landmarken</span>
          <small>{landmarks.length}</small>
        </div>
        <div className="landmark-list">
          {landmarks.map((landmark) => (
            <button
              key={landmark.name}
              type="button"
              aria-label={`Landmarke ${landmark.name}`}
              className={landmark.name === selected ? "is-selected" : ""}
              onClick={() => focusLandmark(landmark)}
            >
              <span>{landmark.name}</span>
              <small>{roleLabel(landmark.role)}</small>
            </button>
          ))}
        </div>
      </aside>

      {selectedLandmark ? (
        <aside className="selection-card" aria-live="polite">
          <div>
            <Info aria-hidden="true" size={16} />
            <span>Fokus</span>
          </div>
          <strong>{selectedLandmark.name}</strong>
          <small>{roleLabel(selectedLandmark.role)}</small>
        </aside>
      ) : null}

      {isReferenceOpen ? (
        <div
          className="reference-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Top-down Referenzkarte"
          onClick={() => setIsReferenceOpen(false)}
        >
          <div className="reference-panel" onClick={(event) => event.stopPropagation()}>
            <header className="reference-header">
              <div className="reference-title">
                <MapPinned aria-hidden="true" size={18} />
                <strong>Top-down Referenzkarte</strong>
              </div>
              <button
                type="button"
                aria-label="Referenzkarte schließen"
                title="Referenzkarte schließen"
                onClick={() => setIsReferenceOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <img
              src={referenceMapUrl}
              alt="Top-down reference map with OSM, LoD2, and numbered landmarks"
            />
          </div>
        </div>
      ) : null}

      <footer className="attribution">
        <span>{ATTRIBUTION}</span>
        <span>{status}</span>
      </footer>
    </main>
  );
}
