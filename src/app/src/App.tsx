import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box as BoxIcon,
  ChevronDown,
  ChevronUp,
  Compass,
  FlipHorizontal2,
  FlipVertical2,
  Home,
  Info,
  Keyboard,
  Link2,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPinned,
  Minus,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Rotate3D,
  SkipBack,
  SkipForward,
  Sun,
  X,
} from "lucide-react";
import OpenSeadragon from "openseadragon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ThreeViewer,
  type ThreeViewerHandle,
} from "./ThreeViewer";
import bundledLandmarkPayload from "./data/regierungsviertel-landmarks.json";
import { type VisualMode, isVisualMode, VISUAL_MODE_STORAGE_KEY } from "./visualMode";
import { MinecraftCubeIcon } from "./visual-modes/minecraft/MinecraftCubeIcon";
import { MinecraftDziPostProcessor } from "./visual-modes/minecraft/MinecraftDziPostProcessor";
import { MinecraftLifeOverlay } from "./visual-modes/minecraft/MinecraftLifeOverlay";
import {
  PEN_GESTURE_SETTINGS,
  TOUCH_GESTURE_SETTINGS,
  normalizeRotation,
  rotationDistance,
  rotationDeltaFromMouseDrag,
  snapRotationToCardinals,
} from "./viewerGestures";

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

type ViewerMode = "map" | "three";
type MobileSheet = "compass" | "overflow" | null;

const LEGACY_APPEARANCE_STORAGE_KEY = "isometric-berlin-lighting";
const CHROME_STORAGE_KEY = "isometric-berlin.chromeHidden";
const COACH_STORAGE_KEY = "isometric-berlin.seenCoachMark";
const VERSION = "v0.3.0";
const MOBILE_MEDIA_QUERY =
  "(max-width: 768px), (max-width: 900px) and (max-height: 500px) and (orientation: landscape)";

const ATTRIBUTION =
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia";
const MESH_ATTRIBUTION =
  "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH";

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
  "Schweizerische Botschaft": "Schweizer Botschaft",
  "Fahne der Einheit": "Fahne der Einheit",
  "Quadriga mit Victoria": "Quadriga",
  "Starbucks Pariser Platz": "Starbucks Pariser Platz",
};

const NORTH_UP_ROTATION = 296.565051177078;
const THREE_NORTH_AZIMUTH = 40;
const DEFAULT_FOCUS_LANDMARK = "Bundeskanzleramt";
const PRIORITY_LANDMARKS = new Set([
  "Bundeskanzleramt",
  "Reichstagsgebäude",
  "Berlin Hauptbahnhof",
]);

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

function regierungsviertelTileSource(): string {
  return assetPath("dzi/regierungsviertel/regierungsviertel.dzi");
}

function initialViewerMode(): ViewerMode {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") || canvas.getContext("webgl")
      ? "three"
      : "map";
  } catch {
    return "map";
  }
}

function initialLightingMode(): VisualMode {
  try {
    const requested = new URLSearchParams(window.location.search).get("theme");
    if (isVisualMode(requested)) {
      return requested;
    }
    const stored = window.localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
    if (isVisualMode(stored)) {
      return stored;
    }
    return window.localStorage.getItem(LEGACY_APPEARANCE_STORAGE_KEY) === "night"
      ? "night"
      : "day";
  } catch {
    return "day";
  }
}

function initialChromeHidden(): boolean {
  try {
    return window.localStorage.getItem(CHROME_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function hasSeenCoachMark(): boolean {
  try {
    return window.localStorage.getItem(COACH_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

function landmarkShortLabel(name: string): string {
  return LANDMARK_SHORT_LABELS[name] ?? name;
}

function isPriorityLandmark(name: string): boolean {
  return PRIORITY_LANDMARKS.has(name);
}

function focusZoomForLandmark(name: string): number {
  return name === "Bundeskanzleramt" ? 4.35 : 3.1;
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

function isRotationActive(left: number, right: number): boolean {
  return rotationDistance(left, right) < 0.01;
}

function threeAzimuthForMapRotation(degrees: number): number {
  return THREE_NORTH_AZIMUTH + (degrees - NORTH_UP_ROTATION);
}

function mapRotationForThreeAzimuth(degrees: number): number {
  return normalizeRotation(NORTH_UP_ROTATION + degrees - THREE_NORTH_AZIMUTH);
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
  const threeViewerRef = useRef<ThreeViewerHandle | null>(null);
  const closeReferenceButtonRef = useRef<HTMLButtonElement | null>(null);
  const referenceReturnFocusRef = useRef<HTMLElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const initialFocusModeRef = useRef<ViewerMode | null>(null);
  const rotationRef = useRef(NORTH_UP_ROTATION);
  const flipRef = useRef(false);
  const hashSyncFrameRef = useRef<number | null>(null);
  const landmarkButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const brandRevealTimerRef = useRef<number | null>(null);
  const minecraftSparkTimerRef = useRef<number | null>(null);
  const selectedRef = useRef(DEFAULT_FOCUS_LANDMARK);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selected, setSelected] = useState<string>(DEFAULT_FOCUS_LANDMARK);
  const [status, setStatus] = useState("Lade amtliches 3D-Mesh");
  const [viewerMode, setViewerMode] = useState<ViewerMode>(initialViewerMode);
  const [lightingMode, setLightingMode] =
    useState<VisualMode>(initialLightingMode);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isThreeReady, setIsThreeReady] = useState(false);
  const [isThreeUnderside, setIsThreeUnderside] = useState(false);
  const [threePolarDegrees, setThreePolarDegrees] = useState(58);
  const [rotation, setRotation] = useState(NORTH_UP_ROTATION);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const [isChromeHidden, setIsChromeHidden] = useState(initialChromeHidden);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [showCoachMark, setShowCoachMark] = useState(() => !hasSeenCoachMark());
  const [showBrandTitle, setShowBrandTitle] = useState(false);
  const [spawnResetToken, setSpawnResetToken] = useState(0);
  const [zoomBucket, setZoomBucket] = useState(2);
  const [minecraftSpark, setMinecraftSpark] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [isAttributionOpen, setIsAttributionOpen] = useState(() => {
    try {
      const seen = window.sessionStorage.getItem("isometric-berlin.attributionSeen");
      window.sessionStorage.setItem("isometric-berlin.attributionSeen", "true");
      return seen !== "true";
    } catch {
      return true;
    }
  });
  const [isLandmarkRailOpen, setIsLandmarkRailOpen] = useState(
    () => !window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  );
  const [keepThreeWarm] = useState(
    () => !window.matchMedia("(pointer: coarse)").matches,
  );

  const tileSource = useMemo(() => regierungsviertelTileSource(), []);
  const sceneUrl = useMemo(
    () => assetPath("mesh/regierungsviertel/scene.json"),
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
  const isReady = viewerMode === "three" ? isThreeReady : isMapReady;
  const canNavigateLandmarks = isReady && landmarks.length > 0;
  const selectionProgress =
    landmarks.length > 0 && selectedIndex >= 0
      ? ((selectedIndex + 1) / landmarks.length) * 100
      : 0;

  const focusLandmark = useCallback(
    (landmark: Landmark, immediate = false) => {
      const shouldMoveImmediately = immediate || prefersReducedMotion();
      setSelected(landmark.name);
      setStatus(`Fokus: ${landmarkShortLabel(landmark.name)}`);
      if (viewerMode === "three") {
        threeViewerRef.current?.focusLandmark(
          landmark.name,
          shouldMoveImmediately,
        );
        return;
      }
      const viewer = viewerRef.current;
      if (!viewer || !viewer.viewport) {
        return;
      }
      const point = viewer.viewport.imageToViewportCoordinates(
        landmark.x,
        landmark.y,
      );
      const mobileOffset = window.matchMedia(MOBILE_MEDIA_QUERY).matches
        ? viewer.viewport.deltaPointsFromPixels(new OpenSeadragon.Point(0, 32))
        : new OpenSeadragon.Point(0, 0);
      viewer.viewport.zoomTo(
        focusZoomForLandmark(landmark.name),
        undefined,
        shouldMoveImmediately,
      );
      viewer.viewport.panTo(
        point.plus(mobileOffset),
        shouldMoveImmediately,
      );
    },
    [viewerMode],
  );

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

  useEffect(() => {
    try {
      window.localStorage.setItem(VISUAL_MODE_STORAGE_KEY, lightingMode);
    } catch {
      // The viewer remains usable when storage is blocked.
    }
  }, [lightingMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHROME_STORAGE_KEY, String(isChromeHidden));
    } catch {
      // The viewer remains usable when storage is blocked.
    }
  }, [isChromeHidden]);

  const applyRotation = useCallback((degrees: number) => {
    const next = normalizeRotation(degrees);
    if (viewerMode === "three") {
      threeViewerRef.current?.setAzimuth(threeAzimuthForMapRotation(next));
      setRotation(next);
      return;
    }
    viewerRef.current?.viewport.setRotation(next);
    setRotation(next);
  }, [viewerMode]);

  const rotateBy = useCallback((delta: number) => {
    if (viewerMode === "three") {
      threeViewerRef.current?.rotateBy(delta);
      setRotation((current) => normalizeRotation(current + delta));
      return;
    }
    setRotation((current) => {
      const next = normalizeRotation(current + delta);
      viewerRef.current?.viewport.setRotation(next);
      return next;
    });
  }, [viewerMode]);

  const toggleHorizontalFlip = useCallback(() => {
    if (viewerMode === "three") {
      threeViewerRef.current?.rotateBy(180);
      setRotation((current) => normalizeRotation(current + 180));
      setStatus("3D-Gegenansicht");
      return;
    }
    setIsFlipped((current) => {
      const next = !current;
      viewerRef.current?.viewport.setFlip(next);
      return next;
    });
  }, [viewerMode]);

  const flipVertical = useCallback(() => {
    if (viewerMode === "three") {
      const next = !isThreeUnderside;
      if (next) {
        const tunnelLandmark = landmarks.find(
          (landmark) => landmark.name === "Kemperplatz / Tiergartentunnel",
        );
        if (tunnelLandmark) {
          focusLandmark(tunnelLandmark, true);
        }
      }
      setIsThreeUnderside(next);
      threeViewerRef.current?.setUnderside(next);
      setStatus(next ? "Echte Untersicht · Tunnel sichtbar" : "3D-Oberansicht");
      return;
    }
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
  }, [focusLandmark, isThreeUnderside, landmarks, viewerMode]);

  const resetOrientation = useCallback(() => {
    if (viewerMode === "three") {
      threeViewerRef.current?.reset();
      setRotation(NORTH_UP_ROTATION);
      setIsThreeUnderside(false);
      setThreePolarDegrees(58);
      setStatus("3D-Gesamtansicht");
      return;
    }
    viewerRef.current?.viewport.setRotation(NORTH_UP_ROTATION);
    viewerRef.current?.viewport.setFlip(false);
    setRotation(NORTH_UP_ROTATION);
    setIsFlipped(false);
  }, [viewerMode]);

  const panByViewport = useCallback((dx: number, dy: number) => {
    const viewport = viewerRef.current?.viewport;
    if (!viewport) {
      return;
    }
    const bounds = viewport.getBounds();
    viewport.panBy(new OpenSeadragon.Point(bounds.width * dx, bounds.height * dy));
    viewport.applyConstraints();
  }, []);

  const flyBy = useCallback((horizontal: number, vertical: number) => {
    setIsTouring(false);
    threeViewerRef.current?.flyBy(horizontal, vertical);
    setStatus(
      horizontal < 0
        ? "3D-Flug: links"
        : horizontal > 0
          ? "3D-Flug: rechts"
          : vertical > 0
            ? "3D-Flug: aufwärts"
            : "3D-Flug: abwärts",
    );
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      if (viewerMode === "three") {
        threeViewerRef.current?.zoomBy(factor);
        return;
      }
      viewerRef.current?.viewport.zoomBy(factor);
    },
    [viewerMode],
  );

  const goHome = useCallback(() => {
    if (viewerMode === "three") {
      threeViewerRef.current?.reset();
      setRotation(NORTH_UP_ROTATION);
      setIsThreeUnderside(false);
      return;
    }
    viewerRef.current?.viewport.goHome();
  }, [viewerMode]);

  const tiltBy = useCallback((degrees: number) => {
    threeViewerRef.current?.tiltBy(degrees);
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

  const toggleLightingMode = useCallback(() => {
    const next = lightingMode === "day" ? "night" : "day";
    setLightingMode(next);
    setStatus(next === "night" ? "Nachtmodus" : "Tagmodus");
  }, [lightingMode]);

  const cycleVisualMode = useCallback(() => {
    const next: VisualMode =
      lightingMode === "day"
        ? "night"
        : lightingMode === "night"
          ? "minecraft"
          : "day";
    setLightingMode(next);
    setStatus(
      next === "minecraft"
        ? "Minecraft · Premium-Voxelmodus"
        : next === "night"
          ? "Nachtmodus"
          : "Tagmodus",
    );
  }, [lightingMode]);

  const toggleMinecraftMode = useCallback(() => {
    const next: VisualMode = lightingMode === "minecraft" ? "day" : "minecraft";
    setLightingMode(next);
    setStatus(
      next === "minecraft" ? "Minecraft · Premium-Voxelmodus" : "Tagmodus",
    );
  }, [lightingMode]);

  const toggleViewerMode = useCallback(() => {
    const next = viewerMode === "three" ? "map" : "three";
    if (next === "map" && !keepThreeWarm) {
      setIsThreeReady(false);
    }
    setViewerMode(next);
    setStatus(
      next === "three"
        ? "Lade amtliches 3D-Mesh"
        : "Lade hochauflösende Detailkarte",
    );
  }, [keepThreeWarm, viewerMode]);

  const toggleChrome = useCallback(() => {
    setMobileSheet(null);
    setIsChromeHidden((hidden) => !hidden);
  }, []);

  const dismissCoachMark = useCallback(() => {
    setShowCoachMark(false);
    try {
      window.localStorage.setItem(COACH_STORAGE_KEY, "true");
    } catch {
      // The viewer remains usable when storage is blocked.
    }
  }, []);

  const revealBrandTitle = useCallback(() => {
    setShowBrandTitle(true);
    if (brandRevealTimerRef.current !== null) {
      window.clearTimeout(brandRevealTimerRef.current);
    }
    brandRevealTimerRef.current = window.setTimeout(() => {
      setShowBrandTitle(false);
      brandRevealTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(
    () => () => {
      if (brandRevealTimerRef.current !== null) {
        window.clearTimeout(brandRevealTimerRef.current);
      }
      if (minecraftSparkTimerRef.current !== null) {
        window.clearTimeout(minecraftSparkTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const points = new Map<
      number,
      { currentX: number; currentY: number; startX: number; startY: number }
    >();
    let triggered = false;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        return;
      }
      points.set(event.pointerId, {
        currentX: event.clientX,
        currentY: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
      });
    };
    const onPointerMove = (event: PointerEvent) => {
      const point = points.get(event.pointerId);
      if (!point || triggered) {
        return;
      }
      point.currentX = event.clientX;
      point.currentY = event.clientY;
      if (points.size < 3) {
        return;
      }
      const active = [...points.values()];
      const averageX =
        active.reduce((sum, item) => sum + item.currentX - item.startX, 0) /
        active.length;
      const averageY =
        active.reduce((sum, item) => sum + item.currentY - item.startY, 0) /
        active.length;
      if (averageY > 72 && Math.abs(averageX) < 64) {
        triggered = true;
        toggleChrome();
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      points.delete(event.pointerId);
      if (points.size === 0) {
        triggered = false;
      }
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointermove", onPointerMove, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerup", onPointerUp, { capture: true });
    window.addEventListener("pointercancel", onPointerUp, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
    };
  }, [toggleChrome]);

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
        setMobileSheet(null);
        setIsTouring(false);
        return;
      }
      if (event.target instanceof HTMLElement) {
        const tagName = event.target.tagName.toLowerCase();
        const isTextEntry =
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select" ||
          event.target.isContentEditable;
        if (isTextEntry) {
          return;
        }
        if (
          tagName === "button" &&
          (event.key === " " || event.key === "Enter")
        ) {
          return;
        }
      }
      if (event.key === "?") {
        event.preventDefault();
        setIsHelpOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        toggleLightingMode();
        return;
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMinecraftMode();
        return;
      }
      if (isReferenceOpen || isHelpOpen || !isReady) {
        return;
      }
      if (event.key === "Home" || event.key === "0") {
        event.preventDefault();
        goHome();
        setStatus("Gesamtansicht");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && !event.shiftKey) {
          flyBy(1, 0);
        } else if (event.shiftKey) {
          rotateBy(8);
          setStatus("Drehung: rechts");
        } else {
          panByViewport(0.12, 0);
          setStatus("Verschoben: Osten");
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && !event.shiftKey) {
          flyBy(-1, 0);
        } else if (event.shiftKey) {
          rotateBy(-8);
          setStatus("Drehung: links");
        } else {
          panByViewport(-0.12, 0);
          setStatus("Verschoben: Westen");
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && !event.shiftKey) {
          flyBy(0, 1);
        } else if (viewerMode === "three") {
          tiltBy(-6);
          setStatus("3D-Neigung: höher");
        } else if (event.shiftKey) {
          zoomBy(1.16);
          setStatus("Swivel/Zoom: näher");
        } else {
          panByViewport(0, -0.12);
          setStatus("Verschoben: Norden");
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && !event.shiftKey) {
          flyBy(0, -1);
        } else if (viewerMode === "three") {
          tiltBy(6);
          setStatus("3D-Neigung: tiefer");
        } else if (event.shiftKey) {
          zoomBy(0.86);
          setStatus("Swivel/Zoom: weiter");
        } else {
          panByViewport(0, 0.12);
          setStatus("Verschoben: Süden");
        }
      } else if (event.key === "PageDown") {
        event.preventDefault();
        setIsTouring(false);
        focusLandmarkByOffset(1);
      } else if (event.key === "PageUp") {
        event.preventDefault();
        setIsTouring(false);
        focusLandmarkByOffset(-1);
      } else if (event.key === " ") {
        event.preventDefault();
        toggleTour();
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        void copyViewLink();
      } else if (event.key === "+" || event.key === "=") {
        zoomBy(1.24);
      } else if (event.key === "-") {
        zoomBy(0.81);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeReferenceMap,
    copyViewLink,
    flyBy,
    focusLandmarkByOffset,
    goHome,
    isHelpOpen,
    isReady,
    isReferenceOpen,
    panByViewport,
    rotateBy,
    tiltBy,
    toggleTour,
    toggleLightingMode,
    toggleMinecraftMode,
    viewerMode,
    zoomBy,
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
    if (viewerMode !== "map" || !containerRef.current || viewerRef.current) {
      return;
    }

    setIsMapReady(false);
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
      gestureSettingsTouch: TOUCH_GESTURE_SETTINGS,
      gestureSettingsPen: PEN_GESTURE_SETTINGS,
      animationTime: prefersReducedMotion() ? 0.05 : 0.6,
      blendTime: 0.1,
      constrainDuringPan: true,
      immediateRender: false,
      minPixelRatio: 0.5,
      minZoomImageRatio: 0.56,
      maxZoomPixelRatio: 6,
      zoomPerClick: 1.6,
      showRotationControl: true,
      visibilityRatio: 1,
      homeFillsViewer: false,
      springStiffness: 8,
    });
    viewerRef.current = viewer;
    if (import.meta.env.DEV) {
      let previousFrame = performance.now();
      const frameTimes: number[] = [];
      viewer.addHandler("animation", () => {
        const now = performance.now();
        frameTimes.push(now - previousFrame);
        previousFrame = now;
        if (frameTimes.length < 60) {
          return;
        }
        const average =
          frameTimes.reduce((sum, frameTime) => sum + frameTime, 0) /
          frameTimes.length;
        console.debug(
          `[viewer] touch momentum ${average.toFixed(1)} ms/frame`,
        );
        frameTimes.length = 0;
      });
    }
    viewer.addHandler("open", () => {
      viewer.viewport.setRotation(rotationRef.current);
      viewer.viewport.setFlip(flipRef.current);
      viewer.viewport.goHome(true);
      viewer.viewport.zoomBy(0.76, undefined, true);
      setIsMapReady(true);
      setStatus("Bereit");
    });
    viewer.addHandler("open-failed", () => {
      setIsMapReady(false);
      setStatus("DZI nicht gefunden");
    });
    viewer.addHandler("rotate", (event) => {
      const next = normalizeRotation(event.degrees);
      rotationRef.current = next;
      setRotation(next);
      if (hashSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(hashSyncFrameRef.current);
      }
      hashSyncFrameRef.current = window.requestAnimationFrame(() => {
        const params = new URLSearchParams();
        params.set("landmark", landmarkSlug(selectedRef.current));
        const activeOrientation = ORIENTATIONS.find((candidate) =>
          isRotationActive(candidate.degrees, rotationRef.current),
        );
        params.set(
          "view",
          activeOrientation?.short ?? `${Math.round(rotationRef.current)}deg`,
        );
        if (flipRef.current) {
          params.set("flip", "1");
        }
        window.history.replaceState(null, "", `#${params}`);
        hashSyncFrameRef.current = null;
      });
    });
    viewer.addHandler("zoom", (event) => {
      setZoomBucket(Math.max(0, Math.round(event.zoom * 2)));
    });
    viewer.addHandler("canvas-drag", (event) => {
      if (event.pointerType !== "mouse" || !event.shift) {
        return;
      }
      event.preventDefaultAction = true;
      const next = normalizeRotation(
        rotationRef.current + rotationDeltaFromMouseDrag(event.delta.x),
      );
      rotationRef.current = next;
      viewer.viewport.setRotation(next);
      setRotation(next);
    });
    viewer.addHandler("canvas-release", () => {
      const snapped = snapRotationToCardinals(
        rotationRef.current,
        ORIENTATIONS.map((candidate) => candidate.degrees),
      );
      if (rotationDistance(snapped, rotationRef.current) < 0.01) {
        return;
      }
      rotationRef.current = snapped;
      viewer.viewport.setRotation(snapped);
      setRotation(snapped);
    });

    return () => {
      if (hashSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(hashSyncFrameRef.current);
        hashSyncFrameRef.current = null;
      }
      viewer.destroy();
      viewerRef.current = null;
      setIsMapReady(false);
    };
  }, [tileSource, viewerMode]);

  useEffect(() => {
    const host = containerRef.current;
    if (
      lightingMode !== "minecraft" ||
      viewerMode !== "map" ||
      !isMapReady ||
      !host
    ) {
      return;
    }
    const processor = MinecraftDziPostProcessor.attach(host);
    return () => {
      processor?.dispose();
      host.classList.remove("minecraft-dzi-fallback");
    };
  }, [isMapReady, lightingMode, viewerMode]);

  // Keep the cartography clean: only the actively selected landmark receives
  // an overlay. Navigation belongs to the landmark rail, not 39 map dots.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (
      viewerMode !== "map" ||
      !viewer ||
      !isMapReady ||
      !selectedLandmark
    ) {
      return;
    }
    viewer.clearOverlays();
    const marker = document.createElement("div");
    marker.className = "map-marker map-marker--selected";
    marker.dataset.label = landmarkShortLabel(selectedLandmark.name);
    marker.setAttribute("aria-hidden", "true");
    viewer.addOverlay({
      element: marker,
      location: viewer.viewport.imageToViewportCoordinates(
        selectedLandmark.x,
        selectedLandmark.y,
      ),
      placement: OpenSeadragon.Placement.CENTER,
      rotationMode: OpenSeadragon.OverlayRotationMode.NO_ROTATION,
      checkResize: false,
    });
    return () => {
      viewerRef.current?.clearOverlays();
    };
  }, [isMapReady, selectedLandmark, viewerMode]);

  useEffect(() => {
    if (
      !isReady ||
      landmarks.length === 0 ||
      initialFocusModeRef.current === viewerMode
    ) {
      return;
    }
    initialFocusModeRef.current = viewerMode;
    focusLandmark(selectedLandmark ?? landmarks[0], true);
  }, [focusLandmark, isReady, landmarks, selectedLandmark, viewerMode]);

  return (
    <main
      className={[
        "app-shell",
        isTouring ? "app-shell--touring" : "",
        `app-shell--${lightingMode}`,
        isChromeHidden ? "app-shell--chrome-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerUp={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("button:not(:disabled)") &&
          typeof navigator.vibrate === "function"
        ) {
          navigator.vibrate(8);
        }
      }}
      onPointerDown={(event) => {
        if (lightingMode !== "minecraft") {
          return;
        }
        setMinecraftSpark({ id: Date.now(), x: event.clientX, y: event.clientY });
        if (minecraftSparkTimerRef.current !== null) {
          window.clearTimeout(minecraftSparkTimerRef.current);
        }
        minecraftSparkTimerRef.current = window.setTimeout(() => {
          setMinecraftSpark(null);
          minecraftSparkTimerRef.current = null;
        }, 420);
      }}
    >
      <section
        className="map-stage"
        data-viewer-mode={viewerMode}
        aria-label="Isometrische Berlin-Karte"
      >
        <div
          id="openseadragon-viewer"
          ref={containerRef}
          className={viewerMode === "map" ? "viewer is-active" : "viewer"}
        />
        {viewerMode === "three" || (isThreeReady && keepThreeWarm) ? (
          <ThreeViewer
            ref={threeViewerRef}
            active={viewerMode === "three"}
            lightingMode={lightingMode}
            sceneUrl={sceneUrl}
            selectedLandmark={selected}
            onReady={() => {
              setIsThreeReady(true);
              setStatus("Amtliches 3D-Mesh bereit");
            }}
            onError={(message) => {
              setIsThreeReady(false);
              setStatus(`3D nicht verfügbar: ${message}`);
              setViewerMode("map");
            }}
            onWarning={(message) => {
              setStatus(`3D-Hinweis: ${message}`);
            }}
            onViewChange={({ azimuthDegrees, polarDegrees, underside }) => {
              setRotation(mapRotationForThreeAzimuth(azimuthDegrees));
              setThreePolarDegrees(polarDegrees);
              setIsThreeUnderside(underside);
            }}
          />
        ) : null}
        <MinecraftLifeOverlay
          active={lightingMode === "minecraft"}
          resetToken={spawnResetToken}
          zoomBucket={zoomBucket}
        />
      </section>
      {minecraftSpark ? (
        <span
          key={minecraftSpark.id}
          className="minecraft-tap-spark"
          style={{ left: minecraftSpark.x, top: minecraftSpark.y }}
          aria-hidden="true"
        />
      ) : null}

      <header className="topbar">
        <button
          type="button"
          className="brand"
          aria-label="Projektname und aktuelle Landmarke"
          title={`Isometric Berlin · Regierungsviertel · ${VERSION}`}
          onClick={revealBrandTitle}
          onPointerEnter={revealBrandTitle}
        >
          <MapIcon aria-hidden="true" size={22} />
          <span className="brand-desktop">
            <strong>Isometric Berlin</strong>
            <small>Regierungsviertel</small>
          </span>
          <span className="brand-mobile">
            <strong>
              {showBrandTitle
                ? `Isometric Berlin · Regierungsviertel · ${VERSION}`
                : landmarkShortLabel(selectedLandmark?.name ?? status)}
            </strong>
            <small>
              {selectedIndex >= 0 ? selectedIndex + 1 : 1}/{landmarks.length || 1}
              {` · ${viewerMode === "three" ? "3D" : "2D"}`}
              {lightingMode === "minecraft" ? " · Voxel" : ""}
            </small>
          </span>
        </button>
        <div className="toolbar" aria-label="Kartensteuerung">
          <button
            type="button"
            className="mobile-overflow"
            aria-label="Weitere Aktionen"
            aria-expanded={mobileSheet === "overflow"}
            title="Weitere Aktionen"
            onClick={() =>
              setMobileSheet((current) =>
                current === "overflow" ? null : "overflow",
              )
            }
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Gesamtansicht"
            disabled={!isReady}
            title="Gesamtansicht"
            onClick={goHome}
          >
            <Home size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={
              viewerMode === "three"
                ? "Zur hochauflösenden Kartenansicht wechseln"
                : "Zur freien amtlichen 3D-Ansicht wechseln"
            }
            aria-pressed={viewerMode === "three"}
            title={viewerMode === "three" ? "2D-Detailkarte" : "Echte 3D-Ansicht"}
            onClick={toggleViewerMode}
          >
            {viewerMode === "three" ? (
              <MapIcon size={18} aria-hidden="true" />
            ) : (
              <BoxIcon size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Visuellen Modus wechseln: Tag, Nacht oder Minecraft"
            aria-pressed={lightingMode !== "day"}
            title="Tag / Nacht / Minecraft wechseln (D / M)"
            onClick={cycleVisualMode}
          >
            {lightingMode === "minecraft" ? (
              <MinecraftCubeIcon size={19} />
            ) : lightingMode === "night" ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Landmarkenliste ein- oder ausblenden"
            aria-pressed={isLandmarkRailOpen}
            title="Landmarkenliste"
            onClick={() => setIsLandmarkRailOpen((open) => !open)}
          >
            <List size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="zoom-action"
            aria-label="Vergrößern"
            disabled={!isReady}
            title="Vergrößern"
            onClick={() => zoomBy(1.6)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="zoom-action"
            aria-label="Verkleinern"
            disabled={!isReady}
            title="Verkleinern"
            onClick={() => zoomBy(0.625)}
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

      <div className="mobile-floating-controls">
        <button
          type="button"
          className="chrome-toggle"
          aria-label={
            isChromeHidden
              ? "Bedienelemente wieder einblenden"
              : "Bedienelemente ausblenden"
          }
          aria-pressed={isChromeHidden}
          title={
            isChromeHidden
              ? "Bedienelemente einblenden"
              : "Bedienelemente ausblenden"
          }
          onClick={toggleChrome}
        >
          {isChromeHidden ? (
            <ChevronUp size={19} aria-hidden="true" />
          ) : (
            <ChevronDown size={19} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="mobile-compass-fab"
          aria-label="Richtungs- und 3D-Steuerung öffnen"
          aria-expanded={mobileSheet === "compass"}
          disabled={!isReady}
          title="Richtungs- und 3D-Steuerung"
          onClick={() =>
            setMobileSheet((current) =>
              current === "compass" ? null : "compass",
            )
          }
        >
          <Compass size={22} aria-hidden="true" />
        </button>
        {showCoachMark && !isChromeHidden ? (
          <button
            type="button"
            className="mobile-coach-mark"
            onClick={dismissCoachMark}
          >
            Kompass öffnet die Steuerung · Pfeil blendet sie aus
          </button>
        ) : null}
      </div>

      <aside className="orientation-pill" aria-label="Kartenorientierung">
        <Compass aria-hidden="true" size={16} />
        <span>
          {viewerMode === "three"
            ? `${Math.round(threePolarDegrees)}°`
            : (orientation?.short ?? `${Math.round(rotation)}°`)}
        </span>
        <small>
          {viewerMode === "three"
            ? `${orientation?.label ?? "frei gedreht"} · ${
                isThreeUnderside ? "Untersicht" : "3D"
              }`
            : isFlipped
              ? `${orientation?.label ?? "frei gedreht"} · gespiegelt`
              : (orientation?.label ?? "frei gedreht")}
        </small>
      </aside>

      <aside className="view-controls" aria-label="3D-Ansicht bewegen und ausrichten">
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
        {viewerMode === "three" ? (
          <div
            className="control-row movement-controls"
            role="group"
            aria-label="Steuerkreuz zum Fliegen durch die 3D-Ansicht"
          >
            <button
              type="button"
              aria-label="Im Bild nach oben fliegen"
              disabled={!isReady}
              title="Im Bild nach oben fliegen (Pfeil hoch)"
              onClick={() => flyBy(0, 1)}
            >
              <ArrowUp size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Im Bild nach links fliegen"
              disabled={!isReady}
              title="Im Bild nach links fliegen (Pfeil links)"
              onClick={() => flyBy(-1, 0)}
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Im Bild nach unten fliegen"
              disabled={!isReady}
              title="Im Bild nach unten fliegen (Pfeil runter)"
              onClick={() => flyBy(0, -1)}
            >
              <ArrowDown size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Im Bild nach rechts fliegen"
              disabled={!isReady}
              title="Im Bild nach rechts fliegen (Pfeil rechts)"
              onClick={() => flyBy(1, 0)}
            >
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="control-row" role="group" aria-label="Ansicht umklappen">
          {viewerMode === "three" ? (
            <>
              <button
                type="button"
                aria-label="Kamera höher neigen"
                disabled={!isReady}
                title="Kamera höher neigen (Shift + Pfeil hoch)"
                onClick={() => tiltBy(-10)}
              >
                <ArrowUp size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Kamera tiefer bis zur Untersicht neigen"
                disabled={!isReady}
                title="Kamera tiefer neigen (Shift + Pfeil runter)"
                onClick={() => tiltBy(10)}
              >
                <ArrowDown size={17} aria-hidden="true" />
              </button>
            </>
          ) : null}
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
            aria-label={
              viewerMode === "three" ? "3D-Gegenansicht" : "Horizontal spiegeln"
            }
            aria-pressed={viewerMode === "map" && isFlipped}
            disabled={!isReady}
            title={viewerMode === "three" ? "3D-Gegenansicht" : "Horizontal spiegeln"}
            onClick={toggleHorizontalFlip}
          >
            <FlipHorizontal2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={
              viewerMode === "three"
                ? "Echte Untersicht mit Tiergartentunnel"
                : "Vertikal klappen"
            }
            aria-pressed={viewerMode === "three" && isThreeUnderside}
            disabled={!isReady}
            title={
              viewerMode === "three"
                ? "Untersicht und Tiergartentunnel"
                : "Vertikal klappen"
            }
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

      {mobileSheet ? (
        <div
          className="mobile-sheet-backdrop"
          aria-hidden="true"
          onClick={() => setMobileSheet(null)}
        />
      ) : null}

      {mobileSheet === "compass" ? (
        <aside
          className="mobile-sheet mobile-compass-sheet"
          role="dialog"
          aria-label="Kompakte Richtungs- und 3D-Steuerung"
          onClick={(event) => event.stopPropagation()}
          onTouchStart={(event) => {
            event.currentTarget.dataset.startY = String(
              event.touches[0]?.clientY ?? 0,
            );
          }}
          onTouchEnd={(event) => {
            const start = Number(event.currentTarget.dataset.startY ?? 0);
            const end = event.changedTouches[0]?.clientY ?? start;
            if (end - start > 48) {
              setMobileSheet(null);
            }
          }}
        >
          <div className="mobile-sheet-handle" aria-hidden="true" />
          <div className="mobile-sheet-title">
            <Compass size={17} aria-hidden="true" />
            <strong>Ausrichten &amp; bewegen</strong>
            <button
              type="button"
              aria-label="Steuerung schließen"
              onClick={() => setMobileSheet(null)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="mobile-compass-grid">
            {ORIENTATIONS.map((candidate) => (
              <button
                key={candidate.short}
                type="button"
                aria-label={candidate.label}
                aria-pressed={isRotationActive(rotation, candidate.degrees)}
                disabled={!isReady}
                onClick={() => applyRotation(candidate.degrees)}
              >
                <strong>{candidate.short}</strong>
              </button>
            ))}
            <button
              type="button"
              aria-label="Im Bild nach oben bewegen"
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? flyBy(0, 1) : panByViewport(0, -0.12)
              }
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Im Bild nach links bewegen"
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? flyBy(-1, 0) : panByViewport(-0.12, 0)
              }
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Im Bild nach unten bewegen"
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? flyBy(0, -1) : panByViewport(0, 0.12)
              }
            >
              <ArrowDown size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Im Bild nach rechts bewegen"
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? flyBy(1, 0) : panByViewport(0.12, 0)
              }
            >
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Nach links drehen"
              disabled={!isReady}
              onClick={() => rotateBy(-15)}
            >
              <RotateCcw size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Nach rechts drehen"
              disabled={!isReady}
              onClick={() => rotateBy(15)}
            >
              <RotateCw size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={viewerMode === "three" ? "Kamera höher neigen" : "Näher"}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? tiltBy(-8) : zoomBy(1.24)
              }
            >
              <ChevronUp size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={viewerMode === "three" ? "Kamera tiefer neigen" : "Weiter"}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? tiltBy(8) : zoomBy(0.81)
              }
            >
              <ChevronDown size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="mobile-sheet-footer" role="group" aria-label="Ansicht">
            <button
              type="button"
              aria-label="Gegenansicht"
              disabled={!isReady}
              onClick={toggleHorizontalFlip}
            >
              <FlipHorizontal2 size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Untersicht"
              aria-pressed={viewerMode === "three" && isThreeUnderside}
              disabled={!isReady}
              onClick={flipVertical}
            >
              <FlipVertical2 size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Ausrichtung zurücksetzen"
              disabled={!isReady}
              onClick={resetOrientation}
            >
              <Rotate3D size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Top-down Referenzkarte"
              disabled={!isReady}
              onClick={() => {
                setMobileSheet(null);
                openReferenceMap();
              }}
            >
              <MapPinned size={19} aria-hidden="true" />
            </button>
            {lightingMode === "minecraft" ? (
              <button
                type="button"
                className="minecraft-reset"
                aria-label="Minecraft-Leben zurücksetzen"
                onClick={() => setSpawnResetToken((token) => token + 1)}
              >
                <MinecraftCubeIcon size={19} />
                <span>Reset</span>
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}

      {mobileSheet === "overflow" ? (
        <aside
          className="mobile-sheet mobile-overflow-sheet"
          role="dialog"
          aria-label="Weitere Kartenaktionen"
          onTouchStart={(event) => {
            event.currentTarget.dataset.startY = String(
              event.touches[0]?.clientY ?? 0,
            );
          }}
          onTouchEnd={(event) => {
            const start = Number(event.currentTarget.dataset.startY ?? 0);
            const end = event.changedTouches[0]?.clientY ?? start;
            if (end - start > 48) {
              setMobileSheet(null);
            }
          }}
        >
          <div className="mobile-sheet-handle" aria-hidden="true" />
          <div className="mobile-sheet-title">
            <MoreHorizontal size={18} aria-hidden="true" />
            <strong>Aktionen</strong>
            <button
              type="button"
              aria-label="Aktionsmenü schließen"
              onClick={() => setMobileSheet(null)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="mobile-overflow-grid">
            <button
              type="button"
              disabled={!isReady}
              onClick={() => {
                goHome();
                setMobileSheet(null);
              }}
            >
              <Home size={20} aria-hidden="true" />
              <span>Gesamt</span>
            </button>
            <button
              type="button"
              onClick={() => {
                toggleViewerMode();
                setMobileSheet(null);
              }}
            >
              {viewerMode === "three" ? (
                <MapIcon size={20} aria-hidden="true" />
              ) : (
                <BoxIcon size={20} aria-hidden="true" />
              )}
              <span>{viewerMode === "three" ? "2D" : "3D"}</span>
            </button>
            <button type="button" onClick={cycleVisualMode}>
              {lightingMode === "minecraft" ? (
                <MinecraftCubeIcon size={20} />
              ) : lightingMode === "night" ? (
                <Sun size={20} aria-hidden="true" />
              ) : (
                <Moon size={20} aria-hidden="true" />
              )}
              <span>Modus</span>
            </button>
            <button
              type="button"
              aria-pressed={isLandmarkRailOpen}
              onClick={() => {
                setIsLandmarkRailOpen((open) => !open);
                setMobileSheet(null);
              }}
            >
              <List size={20} aria-hidden="true" />
              <span>Orte</span>
            </button>
            <button
              type="button"
              disabled={!canNavigateLandmarks}
              onClick={() => {
                focusLandmarkByOffset(-1);
                setMobileSheet(null);
              }}
            >
              <SkipBack size={20} aria-hidden="true" />
              <span>Zurück</span>
            </button>
            <button
              type="button"
              aria-pressed={isTouring}
              disabled={!canNavigateLandmarks}
              onClick={() => {
                toggleTour();
                setMobileSheet(null);
              }}
            >
              {isTouring ? (
                <Pause size={20} aria-hidden="true" />
              ) : (
                <Play size={20} aria-hidden="true" />
              )}
              <span>Tour</span>
            </button>
            <button
              type="button"
              disabled={!canNavigateLandmarks}
              onClick={() => {
                focusLandmarkByOffset(1);
                setMobileSheet(null);
              }}
            >
              <SkipForward size={20} aria-hidden="true" />
              <span>Weiter</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSheet(null);
                setIsHelpOpen(true);
              }}
            >
              <Keyboard size={20} aria-hidden="true" />
              <span>Hilfe</span>
            </button>
            <button
              type="button"
              disabled={!selectedLandmark}
              onClick={() => {
                void copyViewLink();
                setMobileSheet(null);
              }}
            >
              <Link2 size={20} aria-hidden="true" />
              <span>Link</span>
            </button>
          </div>
        </aside>
      ) : null}

      {isLandmarkRailOpen ? (
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
                className={[
                  landmark.name === selected ? "is-selected" : "",
                  isPriorityLandmark(landmark.name) ? "is-priority" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!isReady}
                onClick={() => {
                  setIsTouring(false);
                  focusLandmark(landmark);
                  if (window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
                    setIsLandmarkRailOpen(false);
                  }
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
      ) : null}

      {selectedLandmark ? (
        <aside
          className={
            isPriorityLandmark(selectedLandmark.name)
              ? "selection-card selection-card--priority"
              : "selection-card"
          }
          aria-live="polite"
        >
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
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>
                  {viewerMode === "three"
                    ? "Bildschirmbezogen durch die 3D-Isometrie fliegen"
                    : "Karte in Meterlage verschieben"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd>
                </dt>
                <dd>
                  {viewerMode === "three"
                    ? "3D-Kamera links / rechts um das Ziel drehen"
                    : "Ansicht links / rechts drehen"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>Shift</kbd> + <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>
                  {viewerMode === "three"
                    ? "Kamera neigen und stufenlos in die Untersicht wechseln"
                    : "Swivel/Zoom näher oder weiter"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>PageUp</kbd> <kbd>PageDown</kbd>
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
                  <kbd>D</kbd>
                </dt>
                <dd>Tag- / Nachtbeleuchtung umschalten</dd>
              </div>
              <div>
                <dt>
                  <kbd>M</kbd>
                </dt>
                <dd>Premium-Minecraft-Modus ein- / ausschalten</dd>
              </div>
              <div>
                <dt>
                  <kbd>Esc</kbd>
                </dt>
                <dd>Hilfe / Referenzkarte schließen, Tour stoppen</dd>
              </div>
            </dl>
            <p className="help-hint">
              {viewerMode === "three"
                ? "3D: Mit gedrückter linker Maustaste frei drehen, mit dem Mausrad zoomen und mit der rechten Taste verschieben. Ein Finger dreht; zwei Finger zoomen und drehen; drei Finger steuern Drehung und Neigung bis unter das Gelände."
                : "Detailkarte: ziehen zum Verschieben, Shift + ziehen zum freien Drehen und scrollen zum Zoomen. Zwei Finger zoomen, verschieben und drehen gleichzeitig."}
            </p>
          </div>
        </div>
      ) : null}

      <footer
        className={
          isAttributionOpen ? "attribution is-expanded" : "attribution"
        }
      >
        <button
          type="button"
          className="attribution-toggle"
          aria-label={
            isAttributionOpen
              ? "Datenquellen schließen"
              : "Datenquellen und Status anzeigen"
          }
          aria-expanded={isAttributionOpen}
          onClick={() => setIsAttributionOpen((open) => !open)}
        >
          <Info size={18} aria-hidden="true" />
        </button>
        <span className="attribution-copy">
          <span>
            {ATTRIBUTION}
            {viewerMode === "three" ? ` · ${MESH_ATTRIBUTION}` : ""}
          </span>
          <span>{status}</span>
        </span>
      </footer>
    </main>
  );
}
