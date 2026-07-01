import {
  Compass,
  FlipHorizontal2,
  FlipVertical2,
  Home,
  Info,
  Keyboard,
  Link2,
  LocateFixed,
  Map as MapIcon,
  MapPinned,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import OpenSeadragon from "openseadragon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import bundledLandmarkPayload from "./data/regierungsviertel-landmarks.json";

type Landmark = {
  name: string;
  role: string;
  tourOrder: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
};

type LandmarkPayload = {
  image: { width: number; height: number };
  landmarks: Landmark[];
};

type ViewerTileSource = NonNullable<OpenSeadragon.Options["tileSources"]>;

const ATTRIBUTION =
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia";

const ROLE_LABELS: Record<string, string> = {
  hero_tile: "Hauptmotiv",
  must_be_visible: "Pflicht-Landmarke",
  owner_added: "ergänzter Ort",
};

const LANDMARK_SHORT_LABELS: Record<string, string> = {
  "Berlin Hauptbahnhof": "Hauptbahnhof",
  Humboldthafen: "Humboldthafen",
  "Hugo-Preuß-Brücke": "Hugo-Preuß-Brücke",
  "Rahel-Hirsch-Straße": "Rahel-Hirsch-Straße",
  Moltkebrücke: "Moltkebrücke",
  "Bundeskanzleramt": "Kanzleramt",
  "Marie-Elisabeth-Lüders-Haus": "M.-E.-Lüders-Haus",
  "Paul-Löbe-Haus": "Paul-Löbe-Haus",
  "Reichstagsgebäude": "Reichstag",
  "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas":
    "Sinti/Roma-Denkmal",
  "Sowjetisches Ehrenmal Tiergarten": "Sowjetisches Ehrenmal",
  "Brandenburger Tor": "Brandenburger Tor",
  "Pariser Platz": "Pariser Platz",
  "Botschaft der Vereinigten Staaten von Amerika": "US-Botschaft",
  "Max-Liebermann-Haus": "Max-Liebermann-Haus",
  "Denkmal für die ermordeten Juden Europas": "Holocaust-Mahnmal",
  "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen":
    "Denkmal Homosexuelle",
  "Haus der Kulturen der Welt (Schwangere Auster)": "HKW",
  "Großer Tiergarten": "Großer Tiergarten",
  "Beethoven-Haydn-Mozart-Denkmal": "B/H/M-Denkmal",
  "Goethe-Denkmal": "Goethe-Denkmal",
  "Kemperplatz / Tiergartentunnel": "Kemperplatz",
  "Zollpackhof": "Zollpackhof",
  "Gustav-Heinemann-Brücke": "Gustav-Heinemann-Brücke",
  Spreebogen: "Spreebogen",
  "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)":
    "Tiergartentunnel",
};

const NORTH_UP_ROTATION = 296.565051177078;
const DZI_WIDTH = 2157;
const DZI_HEIGHT = 1529;
const DZI_TILE_SIZE = 256;
const DZI_OVERLAP = 0;
const DZI_FORMAT = "jpg";

const ORIENTATIONS = [
  { degrees: NORTH_UP_ROTATION, short: "N", label: "Nord oben" },
  { degrees: NORTH_UP_ROTATION + 90, short: "O", label: "Ost oben" },
  { degrees: NORTH_UP_ROTATION + 180, short: "S", label: "Süd oben" },
  { degrees: NORTH_UP_ROTATION + 270, short: "W", label: "West oben" },
] as const;

type ViewHashState = {
  flipped: boolean | null;
  landmarkSlug: string | null;
  rotationDegrees: number | null;
};

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

const DZI_PREFIX = "dzi/regierungsviertel/";

function assetPath(path: string): string {
  const dziBase = import.meta.env.VITE_DZI_BASE_URL;
  if (dziBase && path.startsWith(DZI_PREFIX)) {
    const rest = path.slice(DZI_PREFIX.length);
    return `${dziBase.replace(/\/+$/, "")}/${rest}`;
  }
  const base = import.meta.env.BASE_URL || "./";
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

function regierungsviertelTileSource(): ViewerTileSource {
  return {
    Image: {
      xmlns: "http://schemas.microsoft.com/deepzoom/2008",
      Url: assetPath("dzi/regierungsviertel/regierungsviertel_files/"),
      Format: DZI_FORMAT,
      Overlap: String(DZI_OVERLAP),
      TileSize: String(DZI_TILE_SIZE),
      Size: {
        Width: String(DZI_WIDTH),
        Height: String(DZI_HEIGHT),
      },
    },
  };
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

function landmarkShortLabel(name: string): string {
  return LANDMARK_SHORT_LABELS[name] ?? name;
}

function landmarkSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findLandmarkBySlug(
  landmarks: Landmark[],
  slug: string | null,
): Landmark | null {
  if (!slug) {
    return null;
  }
  return landmarks.find((landmark) => landmarkSlug(landmark.name) === slug) ?? null;
}

function sortLandmarksForTour(landmarks: Landmark[]): Landmark[] {
  return [...landmarks].sort((left, right) => {
    const leftOrder = left.tourOrder ?? 1_000;
    const rightOrder = right.tourOrder ?? 1_000;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name, "de");
  });
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

function rotationFromHashValue(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.toUpperCase();
  const orientation = ORIENTATIONS.find(
    (candidate) => candidate.short === normalized,
  );
  if (orientation) {
    return orientation.degrees;
  }
  const numeric = Number.parseFloat(normalized.replace(/DEG$/, ""));
  return Number.isFinite(numeric) ? normalizeRotation(numeric) : null;
}

function readViewHash(): ViewHashState {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash) {
    return { flipped: null, landmarkSlug: null, rotationDegrees: null };
  }
  const params = new URLSearchParams(
    rawHash.includes("=") ? rawHash : `landmark=${rawHash}`,
  );
  const flipValue = params.get("flip");
  return {
    flipped: flipValue === null ? null : flipValue === "1",
    landmarkSlug: params.get("landmark"),
    rotationDegrees: rotationFromHashValue(params.get("view")),
  };
}

function viewUrlFor(
  landmark: Landmark,
  rotation: number,
  isFlipped: boolean,
): string {
  const params = new URLSearchParams();
  const orientation = ORIENTATIONS.find((candidate) =>
    isRotationActive(candidate.degrees, rotation),
  );
  params.set("landmark", landmarkSlug(landmark.name));
  params.set("view", orientation?.short ?? `${Math.round(rotation)}deg`);
  if (isFlipped) {
    params.set("flip", "1");
  }
  const url = new URL(window.location.href);
  url.hash = "";
  return `${url.toString()}#${params}`;
}

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeReferenceButtonRef = useRef<HTMLButtonElement | null>(null);
  const referenceReturnFocusRef = useRef<HTMLElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const initialFocusDoneRef = useRef(false);
  const rotationRef = useRef(NORTH_UP_ROTATION);
  const flipRef = useRef(false);
  const landmarkButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const markersRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selectedRef = useRef("Reichstagsgebäude");
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selected, setSelected] = useState<string>("Reichstagsgebäude");
  const [status, setStatus] = useState("Lade DZI");
  const [isReady, setIsReady] = useState(false);
  const [rotation, setRotation] = useState(NORTH_UP_ROTATION);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTouring, setIsTouring] = useState(false);

  const tileSource = useMemo(() => regierungsviertelTileSource(), []);
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
  const selectedIndex = useMemo(
    () => landmarks.findIndex((landmark) => landmark.name === selected),
    [landmarks, selected],
  );
  const orientation = useMemo(
    () =>
      ORIENTATIONS.find((candidate) =>
        isRotationActive(candidate.degrees, rotation),
      ) ?? null,
    [rotation],
  );
  const canNavigateLandmarks = isReady && landmarks.length > 0;
  const selectionProgress =
    landmarks.length > 0 && selectedIndex >= 0
      ? ((selectedIndex + 1) / landmarks.length) * 100
      : 0;

  const focusLandmark = useCallback((landmark: Landmark, immediate = false) => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.viewport) {
      return;
    }
    const point = viewer.viewport.imageToViewportCoordinates(landmark.x, landmark.y);
    setSelected(landmark.name);
    setStatus(`Fokus: ${landmarkShortLabel(landmark.name)}`);
    viewer.viewport.panTo(point, immediate);
    viewer.viewport.zoomTo(3.1, point, immediate);
  }, []);

  const focusLandmarkByOffset = useCallback(
    (offset: number, immediate = false) => {
      if (landmarks.length === 0) {
        return;
      }
      const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex =
        (baseIndex + offset + landmarks.length) % landmarks.length;
      focusLandmark(landmarks[nextIndex], immediate);
    },
    [focusLandmark, landmarks, selectedIndex],
  );

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

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

  const copyViewLink = useCallback(async () => {
    if (!selectedLandmark) {
      return;
    }
    const url = viewUrlFor(selectedLandmark, rotation, isFlipped);
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Ansicht-Link kopiert");
    } catch {
      setStatus("Ansicht-Link in Adresszeile");
    }
  }, [isFlipped, rotation, selectedLandmark]);

  const toggleTour = useCallback(() => {
    if (!canNavigateLandmarks) {
      return;
    }
    setIsTouring((current) => {
      const next = !current;
      setStatus(next ? "Tour läuft" : "Bereit");
      if (next && selectedIndex < 0) {
        focusLandmark(landmarks[0], true);
      }
      return next;
    });
  }, [canNavigateLandmarks, focusLandmark, landmarks, selectedIndex]);

  const openReferenceMap = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      referenceReturnFocusRef.current = document.activeElement;
    }
    setIsTouring(false);
    setStatus("Referenzkarte");
    setIsReferenceOpen(true);
  }, []);

  const closeReferenceMap = useCallback(() => {
    setIsReferenceOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const payload = bundledLandmarkPayload as LandmarkPayload;
    if (!cancelled) {
      const orderedLandmarks = sortLandmarksForTour(payload.landmarks);
      const viewHash = readViewHash();
      const hashLandmark = findLandmarkBySlug(
        orderedLandmarks,
        viewHash.landmarkSlug,
      );
      if (hashLandmark) {
        setSelected(hashLandmark.name);
      }
      if (viewHash.rotationDegrees !== null) {
        rotationRef.current = viewHash.rotationDegrees;
        setRotation(viewHash.rotationDegrees);
        viewerRef.current?.viewport.setRotation(viewHash.rotationDegrees);
      }
      if (viewHash.flipped !== null) {
        flipRef.current = viewHash.flipped;
        setIsFlipped(viewHash.flipped);
        viewerRef.current?.viewport.setFlip(viewHash.flipped);
      }
      setLandmarks(orderedLandmarks);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReferenceMap();
        setIsHelpOpen(false);
        setIsTouring(false);
        return;
      }
      if (event.target instanceof HTMLElement) {
        const tagName = event.target.tagName.toLowerCase();
        if (tagName === "button" || tagName === "input" || tagName === "textarea") {
          return;
        }
      }
      if (event.key === "?") {
        event.preventDefault();
        setIsHelpOpen((open) => !open);
        return;
      }
      if (isReferenceOpen || isHelpOpen || !isReady) {
        return;
      }
      if (event.key === "Home" || event.key === "0") {
        viewerRef.current?.viewport.goHome();
        setStatus("Gesamtansicht");
      } else if (event.key === "ArrowRight") {
        setIsTouring(false);
        focusLandmarkByOffset(1);
      } else if (event.key === "ArrowLeft") {
        setIsTouring(false);
        focusLandmarkByOffset(-1);
      } else if (event.key === " ") {
        event.preventDefault();
        toggleTour();
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        void copyViewLink();
      } else if (event.key === "+" || event.key === "=") {
        viewerRef.current?.viewport.zoomBy(1.24);
      } else if (event.key === "-") {
        viewerRef.current?.viewport.zoomBy(0.81);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeReferenceMap,
    copyViewLink,
    focusLandmarkByOffset,
    isHelpOpen,
    isReady,
    isReferenceOpen,
    toggleTour,
  ]);

  useEffect(() => {
    if (!isReferenceOpen) {
      const target = referenceReturnFocusRef.current;
      if (target?.isConnected) {
        target.focus();
      }
      referenceReturnFocusRef.current = null;
      return;
    }
    const timer = window.setTimeout(() => closeReferenceButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isReferenceOpen]);

  useEffect(() => {
    const button = landmarkButtonsRef.current.get(selected);
    button?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => {
    if (!isTouring || !isReady || landmarks.length === 0) {
      return;
    }
    const timer = window.setInterval(() => focusLandmarkByOffset(1), 4200);
    return () => window.clearInterval(timer);
  }, [focusLandmarkByOffset, isReady, isTouring, landmarks.length]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return;
    }

    installOpenSeadragonConsoleFilter();
    const viewer = OpenSeadragon({
      id: "openseadragon-viewer",
      element: containerRef.current,
      tileSources: tileSource,
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
  }, [tileSource]);

  // Build the markers once per landmark set; rebuilding on every selection
  // would leak the per-button click listeners (clearOverlays only detaches
  // OSD's wrappers). Selection highlighting is handled separately below.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isReady || landmarks.length === 0) {
      return;
    }
    viewer.clearOverlays();
    const markers = new Map<string, HTMLButtonElement>();
    const detach: Array<() => void> = [];
    for (const landmark of landmarks) {
      const marker = document.createElement("button");
      marker.className =
        landmark.name === selectedRef.current
          ? "map-marker map-marker--selected"
          : "map-marker";
      marker.type = "button";
      marker.title = landmark.name;
      marker.dataset.label = landmarkShortLabel(landmark.name);
      marker.dataset.role = landmark.role;
      marker.setAttribute("aria-label", landmark.name);
      const onClick = () => {
        setIsTouring(false);
        focusLandmark(landmark);
      };
      marker.addEventListener("click", onClick);
      detach.push(() => marker.removeEventListener("click", onClick));
      markers.set(landmark.name, marker);
      viewer.addOverlay({
        element: marker,
        location: viewer.viewport.imageToViewportCoordinates(landmark.x, landmark.y),
        placement: OpenSeadragon.Placement.CENTER,
        checkResize: false,
      });
    }
    markersRef.current = markers;
    return () => {
      for (const cleanup of detach) {
        cleanup();
      }
      markersRef.current = new Map();
      viewerRef.current?.clearOverlays();
    };
  }, [focusLandmark, isReady, landmarks]);

  // Toggle the selected marker class without rebuilding overlays.
  useEffect(() => {
    for (const [name, marker] of markersRef.current) {
      marker.classList.toggle("map-marker--selected", name === selected);
    }
  }, [selected]);

  useEffect(() => {
    if (!isReady || landmarks.length === 0 || initialFocusDoneRef.current) {
      return;
    }
    initialFocusDoneRef.current = true;
    focusLandmark(selectedLandmark ?? landmarks[0], true);
  }, [focusLandmark, isReady, landmarks, selectedLandmark]);

  return (
    <main className={isTouring ? "app-shell app-shell--touring" : "app-shell"}>
      <section className="map-stage" aria-label="Isometrische Berlin-Karte">
        <div id="openseadragon-viewer" ref={containerRef} className="viewer" />
      </section>

      <header className="topbar">
        <div className="brand">
          <MapIcon aria-hidden="true" size={22} />
          <div>
            <h1>Isometric Berlin</h1>
            <span>Regierungsviertel</span>
          </div>
        </div>
        <div className="toolbar" aria-label="Kartensteuerung">
          <button
            type="button"
            aria-label="Gesamtansicht"
            disabled={!isReady}
            title="Gesamtansicht"
            onClick={() => viewerRef.current?.viewport.goHome()}
          >
            <Home size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Vergrößern"
            disabled={!isReady}
            title="Vergrößern"
            onClick={() => viewerRef.current?.viewport.zoomBy(1.35)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Verkleinern"
            disabled={!isReady}
            title="Verkleinern"
            onClick={() => viewerRef.current?.viewport.zoomBy(0.74)}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Vorige Landmarke"
            disabled={!canNavigateLandmarks}
            title="Vorige Landmarke"
            onClick={() => {
              setIsTouring(false);
              focusLandmarkByOffset(-1);
            }}
          >
            <SkipBack size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={isTouring ? "Tour pausieren" : "Landmarken-Tour starten"}
            aria-pressed={isTouring}
            disabled={!canNavigateLandmarks}
            title={isTouring ? "Tour pausieren" : "Landmarken-Tour starten"}
            onClick={toggleTour}
          >
            {isTouring ? (
              <Pause size={18} aria-hidden="true" />
            ) : (
              <Play size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Nächste Landmarke"
            disabled={!canNavigateLandmarks}
            title="Nächste Landmarke"
            onClick={() => {
              setIsTouring(false);
              focusLandmarkByOffset(1);
            }}
          >
            <SkipForward size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Tastenkürzel und Hilfe"
            aria-pressed={isHelpOpen}
            title="Tastenkürzel und Hilfe (?)"
            onClick={() => setIsHelpOpen((open) => !open)}
          >
            <Keyboard size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Ansicht-Link kopieren"
            disabled={!selectedLandmark}
            title="Ansicht-Link kopieren (L)"
            onClick={() => void copyViewLink()}
          >
            <Link2 size={18} aria-hidden="true" />
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
              disabled={!isReady}
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
            disabled={!isReady}
            title="Nach links drehen"
            onClick={() => rotateBy(-90)}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Nach rechts drehen"
            disabled={!isReady}
            title="Nach rechts drehen"
            onClick={() => rotateBy(90)}
          >
            <RotateCw size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Horizontal spiegeln"
            aria-pressed={isFlipped}
            disabled={!isReady}
            title="Horizontal spiegeln"
            onClick={toggleHorizontalFlip}
          >
            <FlipHorizontal2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Vertikal klappen"
            disabled={!isReady}
            title="Vertikal klappen"
            onClick={flipVertical}
          >
            <FlipVertical2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Ausrichtung zurücksetzen"
            disabled={!isReady}
            title="Ausrichtung zurücksetzen"
            onClick={resetOrientation}
          >
            <Compass size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Top-down Referenzkarte"
            aria-pressed={isReferenceOpen}
            disabled={!isReady}
            title="Top-down Referenzkarte"
            onClick={openReferenceMap}
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
          {landmarks.map((landmark, index) => (
            <button
              key={landmark.name}
              ref={(element) => {
                if (element) {
                  landmarkButtonsRef.current.set(landmark.name, element);
                } else {
                  landmarkButtonsRef.current.delete(landmark.name);
                }
              }}
              type="button"
              aria-label={`Landmarke ${landmark.name}`}
              className={landmark.name === selected ? "is-selected" : ""}
              disabled={!isReady}
              onClick={() => {
                setIsTouring(false);
                focusLandmark(landmark);
              }}
            >
              <span className="landmark-row">
                <span className="landmark-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="landmark-name">{landmark.name}</span>
              </span>
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
          <span>
            {selectedIndex >= 0 ? selectedIndex + 1 : 1} / {landmarks.length}
          </span>
          <div className="selection-progress" aria-hidden="true">
            <span style={{ width: `${selectionProgress}%` }} />
          </div>
        </aside>
      ) : null}

      {isReferenceOpen ? (
        <div
          className="reference-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Top-down Referenzkarte"
          onClick={closeReferenceMap}
        >
          <div className="reference-panel" onClick={(event) => event.stopPropagation()}>
            <header className="reference-header">
              <div className="reference-title">
                <MapPinned aria-hidden="true" size={18} />
                <strong>Top-down Referenzkarte</strong>
              </div>
              <button
                ref={closeReferenceButtonRef}
                type="button"
                aria-label="Referenzkarte schließen"
                title="Referenzkarte schließen"
                onClick={closeReferenceMap}
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

      {isHelpOpen ? (
        <div
          className="reference-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Tastenkürzel und Bedienhilfe"
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="help-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="reference-header">
              <div className="reference-title">
                <Keyboard aria-hidden="true" size={18} />
                <strong>Tastenkürzel &amp; Bedienung</strong>
              </div>
              <button
                type="button"
                aria-label="Hilfe schließen"
                title="Hilfe schließen"
                onClick={() => setIsHelpOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <dl className="help-list">
              <div>
                <dt>
                  <kbd>←</kbd> <kbd>→</kbd>
                </dt>
                <dd>Vorige / nächste Landmarke</dd>
              </div>
              <div>
                <dt>
                  <kbd>Leertaste</kbd>
                </dt>
                <dd>Landmarken-Tour starten / pausieren</dd>
              </div>
              <div>
                <dt>
                  <kbd>+</kbd> <kbd>=</kbd> <kbd>−</kbd>
                </dt>
                <dd>Vergrößern / verkleinern</dd>
              </div>
              <div>
                <dt>
                  <kbd>Home</kbd> <kbd>0</kbd>
                </dt>
                <dd>Gesamtansicht zeigen</dd>
              </div>
              <div>
                <dt>
                  <kbd>L</kbd>
                </dt>
                <dd>Ansicht-Link kopieren</dd>
              </div>
              <div>
                <dt>
                  <kbd>?</kbd>
                </dt>
                <dd>Diese Hilfe ein- / ausblenden</dd>
              </div>
              <div>
                <dt>
                  <kbd>Esc</kbd>
                </dt>
                <dd>Hilfe / Referenzkarte schließen, Tour stoppen</dd>
              </div>
            </dl>
            <p className="help-hint">
              Maus: ziehen zum Verschieben, scrollen zum Zoomen, Doppelklick
              zum Heranzoomen. Die Werkzeugleisten links steuern Drehung,
              Spiegelung und die Top-down-Referenzkarte.
            </p>
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
