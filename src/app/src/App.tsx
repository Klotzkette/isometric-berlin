import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box as BoxIcon,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FlipHorizontal2,
  FlipVertical2,
  Github,
  Home,
  Info,
  Keyboard,
  Languages,
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
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import OpenSeadragon from "openseadragon";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ThreeViewer,
  type ThreeViewerHandle,
} from "./ThreeViewer";
import {
  AmbientSoundscape,
  isAmbientAudioSupported,
} from "./AmbientSoundscape";
import bundledLandmarkPayload from "./data/regierungsviertel-landmarks.json";
import { discoveryNoteFor } from "./discoveryNotes";
import {
  LANGUAGE_STORAGE_KEY,
  UI_COPY,
  type Language,
  initialLanguage,
} from "./localization";
import { type VisualMode, resolveInitialVisualMode } from "./visualMode";
import { MinecraftCubeIcon } from "./visual-modes/minecraft/MinecraftCubeIcon";
import { MinecraftDziPostProcessor } from "./visual-modes/minecraft/MinecraftDziPostProcessor";
import {
  DOWNLOAD_URL,
  PROJECT_VERSION,
  REPOSITORY_URL,
} from "./projectMetadata";
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

const CHROME_STORAGE_KEY = "isometric-berlin.chromeHidden";
const COACH_STORAGE_KEY = "isometric-berlin.seenCoachMark";
const MUSIC_MUTED_STORAGE_KEY = "isometric-berlin.musicMuted";
const MOBILE_MEDIA_QUERY =
  "(max-width: 768px), (max-width: 1024px) and (pointer: coarse), (max-width: 900px) and (max-height: 500px) and (orientation: landscape)";

const ATTRIBUTION =
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia";
const MESH_ATTRIBUTION =
  "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH";

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

// Day mode is the active visual mode on every (re)load. An explicit
// `?theme=` query parameter is still honoured as a deliberate request, but
// the previously-selected mode is never restored from localStorage — a
// reload always starts in Day. (Music-mute persistence is unaffected.)
function initialLightingMode(): VisualMode {
  try {
    const requested = new URLSearchParams(window.location.search).get("theme");
    return resolveInitialVisualMode(requested);
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

function isMusicMutedByUser(): boolean {
  try {
    return window.localStorage.getItem(MUSIC_MUTED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberMusicMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, String(muted));
  } catch {
    // The viewer stays usable when storage is blocked.
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function roleLabel(role: string, language: Language): string {
  const copy = UI_COPY[language];
  const labels: Record<string, string> = {
    hero_tile: copy.roleHero,
    must_be_visible: copy.roleRequired,
    owner_added: copy.roleAdded,
  };
  return labels[role] ?? role.replaceAll("_", " ");
}

function orientationLabel(short: string, language: Language): string {
  const copy = UI_COPY[language];
  return {
    N: copy.northUp,
    O: copy.eastUp,
    S: copy.southUp,
    W: copy.westUp,
  }[short] ?? short;
}

function orientationShort(short: string, language: Language): string {
  return language === "en" && short === "O" ? "E" : short;
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

const JOYSTICK_RADIUS_PX = 44;

function FlightJoystick({
  disabled,
  label,
  onInput,
}: {
  disabled: boolean;
  label: string;
  onInput: (strafe: number, forward: number, vertical: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const applyFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const base = baseRef.current;
      if (!base) {
        return;
      }
      const rect = base.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy);
      const scale = length > JOYSTICK_RADIUS_PX ? JOYSTICK_RADIUS_PX / length : 1;
      const x = dx * scale;
      const y = dy * scale;
      setKnob({ x, y });
      onInput(x / JOYSTICK_RADIUS_PX, -y / JOYSTICK_RADIUS_PX, 0);
    },
    [onInput],
  );

  const release = useCallback(() => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onInput(0, 0, 0);
  }, [onInput]);

  return (
    <div
      ref={baseRef}
      className="flight-joystick"
      role="application"
      aria-label={label}
      data-disabled={disabled ? "true" : undefined}
      onPointerDown={(event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyFromEvent(event);
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) {
          return;
        }
        applyFromEvent(event);
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current === event.pointerId) {
          release();
        }
      }}
      onPointerCancel={(event) => {
        if (pointerIdRef.current === event.pointerId) {
          release();
        }
      }}
      onLostPointerCapture={release}
    >
      <span
        className="flight-joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        aria-hidden="true"
      />
    </div>
  );
}

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ambientSoundscapeRef = useRef<AmbientSoundscape | null>(null);
  const threeViewerRef = useRef<ThreeViewerHandle | null>(null);
  const closeReferenceButtonRef = useRef<HTMLButtonElement | null>(null);
  const referenceReturnFocusRef = useRef<HTMLElement | null>(null);
  const closeRepositoryButtonRef = useRef<HTMLButtonElement | null>(null);
  const repositoryReturnFocusRef = useRef<HTMLElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  // Held-key state for continuous 3D flight (Space + arrows).
  const heldFlightKeysRef = useRef(new Set<string>());
  const spaceHeldRef = useRef(false);
  const spaceUsedForFlightRef = useRef(false);
  const initialFocusModeRef = useRef<ViewerMode | null>(null);
  const rotationRef = useRef(NORTH_UP_ROTATION);
  const flipRef = useRef(false);
  const hashSyncFrameRef = useRef<number | null>(null);
  const landmarkButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const brandRevealTimerRef = useRef<number | null>(null);
  const discoveryTimerRef = useRef<number | null>(null);
  const discoveredLandmarksRef = useRef<Set<string>>(new Set());
  const minecraftSparkTimerRef = useRef<number | null>(null);
  const selectedRef = useRef(DEFAULT_FOCUS_LANDMARK);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [selected, setSelected] = useState<string>(DEFAULT_FOCUS_LANDMARK);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const copy = UI_COPY[language];
  const [status, setStatus] = useState(copy.loadingMesh);
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
  const [isRepositoryOpen, setIsRepositoryOpen] = useState(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const [isChromeHidden, setIsChromeHidden] = useState(initialChromeHidden);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [showCoachMark, setShowCoachMark] = useState(() => !hasSeenCoachMark());
  const [showBrandTitle, setShowBrandTitle] = useState(false);
  const [minecraftSpark, setMinecraftSpark] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [discoveryLandmark, setDiscoveryLandmark] = useState<string | null>(null);
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
      setStatus(`${copy.focus}: ${landmarkShortLabel(landmark.name)}`);
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
    [copy.focus, viewerMode],
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

  // Minecraft decorations are strictly scoped to Minecraft mode: any pending
  // tap spark (DOM node and its timer) is discarded the moment the visual
  // mode changes, so nothing Minecraft-flavoured survives into Day/Night.
  useEffect(() => {
    if (lightingMode === "minecraft") {
      return;
    }
    if (minecraftSparkTimerRef.current !== null) {
      window.clearTimeout(minecraftSparkTimerRef.current);
      minecraftSparkTimerRef.current = null;
    }
    setMinecraftSpark(null);
  }, [lightingMode]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The viewer remains usable when storage is blocked.
    }
  }, [language]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (isMusicEnabled) {
        void ambientSoundscapeRef.current?.setSuspended(document.hidden);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isMusicEnabled]);

  useEffect(
    () => () => {
      ambientSoundscapeRef.current?.stop();
      ambientSoundscapeRef.current = null;
    },
    [],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === "de" ? "en" : "de"));
  }, []);

  const startMusic = useCallback(
    async (options: { rememberMute?: boolean; silent?: boolean } = {}) => {
      const { rememberMute = true, silent = false } = options;
      const unsupportedMessage =
        language === "de"
          ? "Audio wird von diesem Browser nicht unterstützt"
          : "Audio is not supported by this browser";
      if (!isAmbientAudioSupported()) {
        if (!silent) {
          setStatus(unsupportedMessage);
        }
        return false;
      }
      if (!silent) {
        setStatus(copy.musicStarting);
      }
      const soundscape =
        ambientSoundscapeRef.current ?? new AmbientSoundscape();
      ambientSoundscapeRef.current = soundscape;
      let started = false;
      try {
        started = await soundscape.start();
      } catch {
        soundscape.stop();
      }
      if (!started) {
        soundscape.stop();
        ambientSoundscapeRef.current = null;
      }
      setIsMusicEnabled(started);
      if (rememberMute && started) {
        rememberMusicMuted(false);
      }
      if (started && !silent) {
        setStatus(copy.musicOn);
      } else if (!started && !silent) {
        setStatus(unsupportedMessage);
      }
      return started;
    },
    [copy.musicOn, copy.musicStarting, language],
  );

  const toggleMusic = useCallback(async () => {
    if (isMusicEnabled) {
      ambientSoundscapeRef.current?.stop();
      setIsMusicEnabled(false);
      // Remember explicit mute so the auto-start effect stays quiet on the
      // next visit / interaction.
      rememberMusicMuted(true);
      setStatus(copy.musicOff);
      return;
    }
    await startMusic();
  }, [copy.musicOff, isMusicEnabled, startMusic]);

  // v0.5.2: iOS/Android Safari + Chrome refuse to create an AudioContext
  // until the user has interacted with the page, so we auto-start the
  // ambient soundscape the very first time the user touches / taps /
  // presses a key — unless the user has explicitly muted it before.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isMusicMutedByUser()) {
      return;
    }
    if (!isAmbientAudioSupported()) {
      return;
    }
    let cancelled = false;
    const attempt = () => {
      if (cancelled) {
        return;
      }
      void startMusic({ rememberMute: false, silent: true });
      teardown();
    };
    const teardown = () => {
      window.removeEventListener("pointerdown", attempt);
      window.removeEventListener("touchstart", attempt);
      window.removeEventListener("keydown", attempt);
    };
    window.addEventListener("pointerdown", attempt, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", attempt, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", attempt, { once: true });
    return () => {
      cancelled = true;
      teardown();
    };
  }, [startMusic]);

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
      setStatus(language === "de" ? "3D-Gegenansicht" : "Opposite 3D view");
      return;
    }
    setIsFlipped((current) => {
      const next = !current;
      viewerRef.current?.viewport.setFlip(next);
      return next;
    });
  }, [language, viewerMode]);

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
      setStatus(
        next
          ? language === "de"
            ? "Echte Untersicht · Tunnel sichtbar"
            : "True underside · tunnel visible"
          : language === "de"
            ? "3D-Oberansicht"
            : "3D surface view",
      );
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
  }, [focusLandmark, isThreeUnderside, landmarks, language, viewerMode]);

  const resetOrientation = useCallback(() => {
    if (viewerMode === "three") {
      threeViewerRef.current?.reset();
      setRotation(NORTH_UP_ROTATION);
      setIsThreeUnderside(false);
      setThreePolarDegrees(58);
      setStatus(language === "de" ? "3D-Gesamtansicht" : "3D overview");
      return;
    }
    viewerRef.current?.viewport.setRotation(NORTH_UP_ROTATION);
    viewerRef.current?.viewport.setFlip(false);
    setRotation(NORTH_UP_ROTATION);
    setIsFlipped(false);
  }, [language, viewerMode]);

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
      language === "de"
        ? horizontal < 0
          ? "3D-Flug: links"
          : horizontal > 0
            ? "3D-Flug: rechts"
            : vertical > 0
              ? "3D-Flug: aufwärts"
              : "3D-Flug: abwärts"
        : horizontal < 0
          ? "3D flight: left"
          : horizontal > 0
            ? "3D flight: right"
            : vertical > 0
              ? "3D flight: up"
              : "3D flight: down",
    );
  }, [language]);

  const flyForwardBy = useCallback((strafe: number, forward: number) => {
    setIsTouring(false);
    threeViewerRef.current?.flyForwardBy(strafe, forward);
    setStatus(
      strafe < 0
        ? copy.flyLeft
        : strafe > 0
          ? copy.flyRight
          : forward > 0
            ? copy.flyForward
            : copy.flyBack,
    );
  }, [copy.flyBack, copy.flyForward, copy.flyLeft, copy.flyRight]);

  const setFlightInput = useCallback(
    (strafe: number, forward: number, vertical: number) => {
      if (strafe !== 0 || forward !== 0 || vertical !== 0) {
        setIsTouring(false);
      }
      threeViewerRef.current?.setFlightInput(strafe, forward, vertical);
    },
    [],
  );

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
      setStatus(language === "de" ? "Ansicht-Link kopiert" : "View link copied");
    } catch {
      setStatus(
        language === "de" ? "Ansicht-Link in Adresszeile" : "View link in address bar",
      );
    }
  }, [isFlipped, language, rotation, selectedLandmark]);

  const toggleTour = useCallback(() => {
    if (!canNavigateLandmarks) {
      return;
    }
    setIsTouring((current) => {
      const next = !current;
      setStatus(next ? (language === "de" ? "Tour läuft" : "Tour running") : copy.ready);
      if (next && selectedIndex < 0) {
        focusLandmark(landmarks[0], true);
      }
      return next;
    });
  }, [canNavigateLandmarks, copy.ready, focusLandmark, landmarks, language, selectedIndex]);

  const selectVisualMode = useCallback((next: VisualMode) => {
    setLightingMode(next);
    setStatus(
      next === "minecraft"
        ? `${copy.minecraft} · Premium Voxel`
        : next === "night"
          ? copy.night
          : copy.day,
    );
  }, [copy]);

  const toggleLightingMode = useCallback(() => {
    selectVisualMode(lightingMode === "day" ? "night" : "day");
  }, [lightingMode, selectVisualMode]);

  const toggleMinecraftMode = useCallback(() => {
    const next: VisualMode = lightingMode === "minecraft" ? "day" : "minecraft";
    selectVisualMode(next);
  }, [lightingMode, selectVisualMode]);

  const toggleViewerMode = useCallback(() => {
    const next = viewerMode === "three" ? "map" : "three";
    if (next === "map" && !keepThreeWarm) {
      setIsThreeReady(false);
    }
    setViewerMode(next);
    setStatus(
      next === "three"
        ? copy.loadingMesh
        : copy.loadingMap,
    );
  }, [copy.loadingMap, copy.loadingMesh, keepThreeWarm, viewerMode]);

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
      if (discoveryTimerRef.current !== null) {
        window.clearTimeout(discoveryTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !isReady ||
      !discoveryNoteFor(selected, language) ||
      discoveredLandmarksRef.current.has(selected)
    ) {
      return;
    }
    discoveredLandmarksRef.current.add(selected);
    setDiscoveryLandmark(selected);
    if (discoveryTimerRef.current !== null) {
      window.clearTimeout(discoveryTimerRef.current);
    }
    discoveryTimerRef.current = window.setTimeout(() => {
      setDiscoveryLandmark(null);
      discoveryTimerRef.current = null;
    }, 3600);
  }, [isReady, language, selected]);

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
    setStatus(copy.reference);
    setIsReferenceOpen(true);
  }, [copy.reference]);

  const closeReferenceMap = useCallback(() => {
    setIsReferenceOpen(false);
  }, []);

  const openRepository = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      repositoryReturnFocusRef.current = document.activeElement;
    }
    setIsTouring(false);
    setMobileSheet(null);
    setIsHelpOpen(false);
    setIsReferenceOpen(false);
    setStatus("Öffentliches Repository · Public repository");
    setIsRepositoryOpen(true);
  }, []);

  const closeRepository = useCallback(() => {
    setIsRepositoryOpen(false);
  }, []);

  const copyRepositoryLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(REPOSITORY_URL);
      setStatus("Repo-Link kopiert · Repository link copied");
    } catch {
      setStatus("Repo-Link sichtbar · Repository link shown");
    }
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
    const FLIGHT_KEYS = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Shift",
    ];
    const updateHeldFlight = () => {
      const keys = heldFlightKeysRef.current;
      const shift = keys.has("Shift");
      const strafe =
        (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
      const forward =
        (keys.has("ArrowUp") && !shift ? 1 : 0) -
        (keys.has("ArrowDown") && !shift ? 1 : 0);
      const vertical =
        (keys.has("ArrowUp") && shift ? 1 : 0) -
        (keys.has("ArrowDown") && shift ? 1 : 0);
      setFlightInput(strafe, forward, vertical);
    };
    const stopHeldFlight = () => {
      if (spaceHeldRef.current || heldFlightKeysRef.current.size > 0) {
        spaceHeldRef.current = false;
        heldFlightKeysRef.current.clear();
        setFlightInput(0, 0, 0);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopHeldFlight();
        closeReferenceMap();
        setIsHelpOpen(false);
        setIsRepositoryOpen(false);
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
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        void toggleMusic();
        return;
      }
      if (isReferenceOpen || isHelpOpen || isRepositoryOpen || !isReady) {
        return;
      }
      if (
        viewerMode === "three" &&
        spaceHeldRef.current &&
        FLIGHT_KEYS.includes(event.key)
      ) {
        event.preventDefault();
        heldFlightKeysRef.current.add(event.key);
        if (!spaceUsedForFlightRef.current) {
          spaceUsedForFlightRef.current = true;
          setStatus(
            language === "de"
              ? "Flugmodus: Space halten + Pfeiltasten (Shift: Höhe)"
              : "Flight mode: hold Space + arrow keys (Shift: altitude)",
          );
        }
        updateHeldFlight();
        return;
      }
      if (event.key === "Home" || event.key === "0") {
        event.preventDefault();
        goHome();
        setStatus(copy.home);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && event.altKey) {
          rotateBy(8);
          setStatus(language === "de" ? "Drehung: rechts" : "Orbit: right");
        } else if (viewerMode === "three" && event.shiftKey) {
          flyForwardBy(1, 0);
        } else if (viewerMode === "three") {
          flyBy(1, 0);
        } else if (event.shiftKey) {
          rotateBy(8);
          setStatus(language === "de" ? "Drehung: rechts" : "Rotation: right");
        } else {
          panByViewport(0.12, 0);
          setStatus(language === "de" ? "Verschoben: Osten" : "Moved: east");
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && event.altKey) {
          rotateBy(-8);
          setStatus(language === "de" ? "Drehung: links" : "Orbit: left");
        } else if (viewerMode === "three" && event.shiftKey) {
          flyForwardBy(-1, 0);
        } else if (viewerMode === "three") {
          flyBy(-1, 0);
        } else if (event.shiftKey) {
          rotateBy(-8);
          setStatus(language === "de" ? "Drehung: links" : "Rotation: left");
        } else {
          panByViewport(-0.12, 0);
          setStatus(language === "de" ? "Verschoben: Westen" : "Moved: west");
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && event.altKey) {
          tiltBy(-6);
          setStatus(language === "de" ? "3D-Neigung: höher" : "3D tilt: higher");
        } else if (viewerMode === "three" && event.shiftKey) {
          flyForwardBy(0, 1);
        } else if (viewerMode === "three") {
          flyBy(0, 1);
        } else if (event.shiftKey) {
          zoomBy(1.16);
          setStatus(language === "de" ? "Zoom: näher" : "Zoom: closer");
        } else {
          panByViewport(0, -0.12);
          setStatus(language === "de" ? "Verschoben: Norden" : "Moved: north");
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsTouring(false);
        if (viewerMode === "three" && event.altKey) {
          tiltBy(6);
          setStatus(language === "de" ? "3D-Neigung: tiefer" : "3D tilt: lower");
        } else if (viewerMode === "three" && event.shiftKey) {
          flyForwardBy(0, -1);
        } else if (viewerMode === "three") {
          flyBy(0, -1);
        } else if (event.shiftKey) {
          zoomBy(0.86);
          setStatus(language === "de" ? "Zoom: weiter" : "Zoom: farther");
        } else {
          panByViewport(0, 0.12);
          setStatus(language === "de" ? "Verschoben: Süden" : "Moved: south");
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
        if (viewerMode === "three") {
          // Held Space arms continuous flight; a plain tap still toggles
          // the tour on key release (see handleKeyUp).
          if (!spaceHeldRef.current && !event.repeat) {
            spaceHeldRef.current = true;
            spaceUsedForFlightRef.current = false;
          }
        } else {
          toggleTour();
        }
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        void copyViewLink();
      } else if (event.key === "+" || event.key === "=") {
        zoomBy(1.24);
      } else if (event.key === "-") {
        zoomBy(0.81);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        if (spaceHeldRef.current) {
          const tapped = !spaceUsedForFlightRef.current;
          stopHeldFlight();
          if (
            tapped &&
            viewerMode === "three" &&
            isReady &&
            !isReferenceOpen &&
            !isHelpOpen &&
            !isRepositoryOpen
          ) {
            toggleTour();
          }
        }
        return;
      }
      if (FLIGHT_KEYS.includes(event.key)) {
        if (heldFlightKeysRef.current.delete(event.key)) {
          updateHeldFlight();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", stopHeldFlight);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", stopHeldFlight);
      stopHeldFlight();
    };
  }, [
    closeReferenceMap,
    copy.home,
    copyViewLink,
    flyBy,
    flyForwardBy,
    focusLandmarkByOffset,
    goHome,
    isHelpOpen,
    isReady,
    isReferenceOpen,
    isRepositoryOpen,
    language,
    panByViewport,
    rotateBy,
    setFlightInput,
    tiltBy,
    toggleTour,
    toggleLightingMode,
    toggleMinecraftMode,
    toggleMusic,
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
    if (!isRepositoryOpen) {
      const target = repositoryReturnFocusRef.current;
      if (target?.isConnected) {
        target.focus();
      }
      repositoryReturnFocusRef.current = null;
      return;
    }
    const timer = window.setTimeout(
      () => closeRepositoryButtonRef.current?.focus(),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [isRepositoryOpen]);

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
      setStatus("Bereit · Ready");
    });
    viewer.addHandler("open-failed", () => {
      setIsMapReady(false);
      setStatus("DZI nicht gefunden · DZI not found");
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
    const viewer = viewerRef.current;
    // Feed the voxel post-processor the on-screen position of a fixed map
    // point so the block grid is anchored to the world and stays glued to
    // the geometry while the user pans/zooms, instead of shimmering across
    // a fixed screen-space grid.
    const readAnchor = () => {
      if (!viewer) {
        return null;
      }
      const point = viewer.viewport.pixelFromPoint(
        new OpenSeadragon.Point(0, 0),
        true,
      );
      return { x: point.x, y: point.y };
    };
    const processor = MinecraftDziPostProcessor.attach(host, readAnchor);
    // Hard palette snap by default; ordered dithering fades in only at
    // the deepest zoom to avoid banding on large flat block faces.
    const applyDither = () => {
      if (!processor || !viewer) {
        return;
      }
      const zoom = viewer.viewport.getZoom(true);
      const deepest = viewer.viewport.getMaxZoom() * 0.72;
      processor.setDitherStrength(zoom >= deepest ? 1 : 0);
    };
    applyDither();
    viewer?.addHandler("zoom", applyDither);
    return () => {
      viewer?.removeHandler("zoom", applyDither);
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
        }, 280);
      }}
    >
      <section
        className="map-stage"
        data-viewer-mode={viewerMode}
        aria-label={
          language === "de"
            ? "Isometrische Berlin-Karte"
            : "Isometric Berlin map"
        }
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
              setStatus(
                language === "de"
                  ? "Amtliches 3D-Mesh bereit"
                  : "Official 3D mesh ready",
              );
            }}
            onError={(message) => {
              setIsThreeReady(false);
              setStatus(
                `${language === "de" ? "3D nicht verfügbar" : "3D unavailable"}: ${message}`,
              );
              setViewerMode("map");
            }}
            onWarning={(message) => {
              setStatus(
                `${language === "de" ? "3D-Hinweis" : "3D notice"}: ${message}`,
              );
            }}
            onViewChange={({ azimuthDegrees, polarDegrees, underside }) => {
              setRotation(mapRotationForThreeAzimuth(azimuthDegrees));
              setThreePolarDegrees(polarDegrees);
              setIsThreeUnderside(underside);
            }}
          />
        ) : null}
      </section>
      {minecraftSpark ? (
        <span
          key={minecraftSpark.id}
          className="minecraft-tap-spark"
          style={{ left: minecraftSpark.x, top: minecraftSpark.y }}
          aria-hidden="true"
        />
      ) : null}
      {discoveryLandmark &&
      mobileSheet === null &&
      !isHelpOpen &&
      !isReferenceOpen &&
      !isRepositoryOpen ? (
        <aside className="discovery-note" role="status" aria-live="polite">
          {discoveryNoteFor(discoveryLandmark, language)}
        </aside>
      ) : null}

      <header className="topbar">
        <button
          type="button"
          className="brand"
          aria-label={copy.projectAndCurrent}
          title={`Isometric Berlin · Regierungsviertel · ${PROJECT_VERSION}`}
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
                ? `Isometric Berlin · Regierungsviertel · ${PROJECT_VERSION}`
                : landmarkShortLabel(selectedLandmark?.name ?? status)}
            </strong>
            <small>
              {selectedIndex >= 0 ? selectedIndex + 1 : 1}/{landmarks.length || 1}
              {` · ${viewerMode === "three" ? "3D" : "2D"}`}
              {lightingMode === "minecraft" ? " · Voxel" : ""}
            </small>
          </span>
        </button>
        <div className="toolbar" aria-label={copy.controls}>
          <button
            type="button"
            className="mobile-overflow"
            aria-label={copy.moreActions}
            aria-expanded={mobileSheet === "overflow"}
            title={copy.moreActions}
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
            aria-label={copy.home}
            disabled={!isReady}
            title={copy.home}
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
          <div
            className="visual-mode-switch"
            role="group"
            aria-label={copy.visualModes}
          >
            <button
              type="button"
              aria-label={copy.day}
              aria-pressed={lightingMode === "day"}
              title={`${copy.day} (D)`}
              onClick={() => selectVisualMode("day")}
            >
              <Sun size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.night}
              aria-pressed={lightingMode === "night"}
              title={`${copy.night} (D)`}
              onClick={() => selectVisualMode("night")}
            >
              <Moon size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.minecraft}
              aria-pressed={lightingMode === "minecraft"}
              title={`${copy.minecraft} (M)`}
              onClick={() => selectVisualMode("minecraft")}
            >
              <MinecraftCubeIcon size={18} />
            </button>
          </div>
          <button
            type="button"
            className="language-toggle"
            aria-label={`${copy.language}: ${language === "de" ? "Deutsch" : "English"}`}
            title={language === "de" ? "Switch to English" : "Auf Deutsch wechseln"}
            onClick={toggleLanguage}
          >
            <Languages size={17} aria-hidden="true" />
            <span>{language.toUpperCase()}</span>
          </button>
          <button
            type="button"
            aria-label={isMusicEnabled ? copy.musicOff : copy.musicOn}
            aria-pressed={isMusicEnabled}
            title={`${isMusicEnabled ? copy.musicOff : copy.musicOn} (B)`}
            onClick={toggleMusic}
          >
            {isMusicEnabled ? (
              <Volume2 size={18} aria-hidden="true" />
            ) : (
              <VolumeX size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label={copy.showAttractions}
            aria-pressed={isLandmarkRailOpen}
            title={copy.attractions}
            onClick={() => setIsLandmarkRailOpen((open) => !open)}
          >
            <List size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="zoom-action"
            aria-label={copy.zoomIn}
            disabled={!isReady}
            title={copy.zoomIn}
            onClick={() => zoomBy(1.6)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="zoom-action"
            aria-label={copy.zoomOut}
            disabled={!isReady}
            title={copy.zoomOut}
            onClick={() => zoomBy(0.625)}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.previousAttraction}
            disabled={!canNavigateLandmarks}
            title={copy.previousAttraction}
            onClick={() => {
              setIsTouring(false);
              focusLandmarkByOffset(-1);
            }}
          >
            <SkipBack size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={isTouring ? copy.stopTour : copy.startTour}
            aria-pressed={isTouring}
            disabled={!canNavigateLandmarks}
            title={isTouring ? copy.stopTour : copy.startTour}
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
            aria-label={copy.nextAttraction}
            disabled={!canNavigateLandmarks}
            title={copy.nextAttraction}
            onClick={() => {
              setIsTouring(false);
              focusLandmarkByOffset(1);
            }}
          >
            <SkipForward size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.helpTitle}
            aria-pressed={isHelpOpen}
            title={`${copy.helpTitle} (?)`}
            onClick={() => setIsHelpOpen((open) => !open)}
          >
            <Keyboard size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Repository und Download / Repository and download"
            aria-pressed={isRepositoryOpen}
            title="Öffentliches GitHub-Repository / Public GitHub repository"
            onClick={openRepository}
          >
            <Github size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.copyLink}
            disabled={!selectedLandmark}
            title={`${copy.copyLink} (L)`}
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
              ? copy.showControls
              : copy.hideControls
          }
          aria-pressed={isChromeHidden}
          title={
            isChromeHidden
              ? copy.showControls
              : copy.hideControls
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
          aria-label={copy.alignMove}
          aria-expanded={mobileSheet === "compass"}
          disabled={!isReady}
          title={copy.alignMove}
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
            {copy.coach}
          </button>
        ) : null}
      </div>

      {viewerMode === "three" && !isChromeHidden ? (
        <div className="flight-joystick-wrap">
          <FlightJoystick
            disabled={!isReady}
            label={
              language === "de"
                ? "Flug-Joystick: Daumen ziehen zum Fliegen"
                : "Flight joystick: drag with your thumb to fly"
            }
            onInput={setFlightInput}
          />
        </div>
      ) : null}

      <aside className="orientation-pill" aria-label={copy.orientation}>
        <Compass aria-hidden="true" size={16} />
        <span>
          {viewerMode === "three"
            ? `${Math.round(threePolarDegrees)}°`
            : (orientation?.short ?? `${Math.round(rotation)}°`)}
        </span>
        <small>
          {viewerMode === "three"
            ? `${orientation ? orientationLabel(orientation.short, language) : copy.freelyRotated} · ${
                isThreeUnderside ? copy.underside : "3D"
              }`
            : isFlipped
              ? `${orientation ? orientationLabel(orientation.short, language) : copy.freelyRotated} · ${language === "de" ? "gespiegelt" : "mirrored"}`
              : orientation
                ? orientationLabel(orientation.short, language)
                : copy.freelyRotated}
        </small>
      </aside>

      <aside className="view-controls" aria-label={copy.alignMove}>
        <div className="control-row" role="group" aria-label={copy.orientation}>
          {ORIENTATIONS.map((candidate) => (
            <button
              key={candidate.short}
              type="button"
              aria-label={orientationLabel(candidate.short, language)}
              aria-pressed={isRotationActive(rotation, candidate.degrees)}
              disabled={!isReady}
              title={orientationLabel(candidate.short, language)}
              onClick={() => applyRotation(candidate.degrees)}
            >
              <span>{orientationShort(candidate.short, language)}</span>
            </button>
          ))}
        </div>
        {viewerMode === "three" ? (
          <div
            className="control-row movement-controls"
            role="group"
            aria-label={copy.flight}
          >
            <button
              type="button"
              aria-label={copy.flyForward}
              disabled={!isReady}
              title={`${copy.flyForward} (Shift + ↑)`}
              onClick={() => flyForwardBy(0, 1)}
            >
              <ArrowUp size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.flyLeft}
              disabled={!isReady}
              title={`${copy.flyLeft} (Shift + ←)`}
              onClick={() => flyForwardBy(-1, 0)}
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.flyBack}
              disabled={!isReady}
              title={`${copy.flyBack} (Shift + ↓)`}
              onClick={() => flyForwardBy(0, -1)}
            >
              <ArrowDown size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.flyRight}
              disabled={!isReady}
              title={`${copy.flyRight} (Shift + →)`}
              onClick={() => flyForwardBy(1, 0)}
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
                aria-label={copy.tiltUp}
                disabled={!isReady}
                title={`${copy.tiltUp} (Alt/Option + ↑)`}
                onClick={() => tiltBy(-10)}
              >
                <ArrowUp size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={copy.tiltDown}
                disabled={!isReady}
                title={`${copy.tiltDown} (Alt/Option + ↓)`}
                onClick={() => tiltBy(10)}
              >
                <ArrowDown size={17} aria-hidden="true" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-label={copy.rotateLeft}
            disabled={!isReady}
            title={copy.rotateLeft}
            onClick={() => rotateBy(-90)}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.rotateRight}
            disabled={!isReady}
            title={copy.rotateRight}
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
            aria-label={copy.resetOrientation}
            disabled={!isReady}
            title={copy.resetOrientation}
            onClick={resetOrientation}
          >
            <Compass size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.reference}
            aria-pressed={isReferenceOpen}
            disabled={!isReady}
            title={copy.reference}
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
          aria-label={copy.alignMove}
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
            <strong>{copy.alignMove}</strong>
            <button
              type="button"
              aria-label={copy.closeControls}
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
                aria-label={orientationLabel(candidate.short, language)}
                aria-pressed={isRotationActive(rotation, candidate.degrees)}
                disabled={!isReady}
                onClick={() => applyRotation(candidate.degrees)}
              >
                <strong>{orientationShort(candidate.short, language)}</strong>
              </button>
            ))}
            <button
              type="button"
              aria-label={viewerMode === "three" ? copy.flyForward : copy.northUp}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three"
                  ? flyForwardBy(0, 1)
                  : panByViewport(0, -0.12)
              }
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={viewerMode === "three" ? copy.flyLeft : copy.westUp}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three"
                  ? flyForwardBy(-1, 0)
                  : panByViewport(-0.12, 0)
              }
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={viewerMode === "three" ? copy.flyBack : copy.southUp}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three"
                  ? flyForwardBy(0, -1)
                  : panByViewport(0, 0.12)
              }
            >
              <ArrowDown size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={viewerMode === "three" ? copy.flyRight : copy.eastUp}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three"
                  ? flyForwardBy(1, 0)
                  : panByViewport(0.12, 0)
              }
            >
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.rotateLeft}
              disabled={!isReady}
              onClick={() => rotateBy(-15)}
            >
              <RotateCcw size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.rotateRight}
              disabled={!isReady}
              onClick={() => rotateBy(15)}
            >
              <RotateCw size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={viewerMode === "three" ? copy.tiltUp : copy.zoomIn}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? tiltBy(-8) : zoomBy(1.24)
              }
            >
              <ChevronUp size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={viewerMode === "three" ? copy.tiltDown : copy.zoomOut}
              disabled={!isReady}
              onClick={() =>
                viewerMode === "three" ? tiltBy(8) : zoomBy(0.81)
              }
            >
              <ChevronDown size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="mobile-sheet-footer" role="group" aria-label={copy.mode}>
            <button
              type="button"
              aria-label={copy.oppositeView}
              disabled={!isReady}
              onClick={toggleHorizontalFlip}
            >
              <FlipHorizontal2 size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.underside}
              aria-pressed={viewerMode === "three" && isThreeUnderside}
              disabled={!isReady}
              onClick={flipVertical}
            >
              <FlipVertical2 size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.resetOrientation}
              disabled={!isReady}
              onClick={resetOrientation}
            >
              <Rotate3D size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.reference}
              disabled={!isReady}
              onClick={() => {
                setMobileSheet(null);
                openReferenceMap();
              }}
            >
              <MapPinned size={19} aria-hidden="true" />
            </button>
          </div>
        </aside>
      ) : null}

      {mobileSheet === "overflow" ? (
        <aside
          className="mobile-sheet mobile-overflow-sheet"
          role="dialog"
          aria-label={copy.moreActions}
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
            <strong>{copy.actions}</strong>
            <button
              type="button"
              aria-label={copy.closeActions}
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
              <span>{copy.home}</span>
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
            <button
              type="button"
              aria-pressed={lightingMode === "day"}
              onClick={() => selectVisualMode("day")}
            >
              <Sun size={20} aria-hidden="true" />
              <span>{copy.day}</span>
            </button>
            <button
              type="button"
              aria-pressed={lightingMode === "night"}
              onClick={() => selectVisualMode("night")}
            >
              <Moon size={20} aria-hidden="true" />
              <span>{copy.night}</span>
            </button>
            <button
              type="button"
              aria-pressed={lightingMode === "minecraft"}
              onClick={() => selectVisualMode("minecraft")}
            >
              <MinecraftCubeIcon size={20} />
              <span>{copy.minecraft}</span>
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
              <span>{copy.attractions}</span>
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
              <span>{copy.previous}</span>
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
              <span>{copy.tour}</span>
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
              <span>{copy.next}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSheet(null);
                setIsHelpOpen(true);
              }}
            >
              <Keyboard size={20} aria-hidden="true" />
              <span>{copy.help}</span>
            </button>
            <button type="button" onClick={openRepository}>
              <Github size={20} aria-hidden="true" />
              <span>{copy.repository}</span>
            </button>
            <button type="button" onClick={toggleLanguage}>
              <Languages size={20} aria-hidden="true" />
              <span>{language === "de" ? "English" : "Deutsch"}</span>
            </button>
            <button
              type="button"
              aria-pressed={isMusicEnabled}
              onClick={toggleMusic}
            >
              {isMusicEnabled ? (
                <Volume2 size={20} aria-hidden="true" />
              ) : (
                <VolumeX size={20} aria-hidden="true" />
              )}
              <span>{isMusicEnabled ? copy.musicOff : copy.musicOn}</span>
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
              <span>{copy.link}</span>
            </button>
          </div>
        </aside>
      ) : null}

      {isLandmarkRailOpen ? (
        <aside className="landmark-rail" aria-label={copy.attractions}>
          <div className="rail-heading">
            <LocateFixed aria-hidden="true" size={17} />
            <span>{copy.attractions}</span>
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
                aria-label={`${copy.attraction}: ${landmark.name}`}
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
                <small>{roleLabel(landmark.role, language)}</small>
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
            <span>{copy.focus}</span>
          </div>
          <strong>{selectedLandmark.name}</strong>
          <small>{roleLabel(selectedLandmark.role, language)}</small>
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
          aria-label={copy.reference}
          onClick={closeReferenceMap}
        >
          <div className="reference-panel" onClick={(event) => event.stopPropagation()}>
            <header className="reference-header">
              <div className="reference-title">
                <MapPinned aria-hidden="true" size={18} />
                <strong>{copy.reference}</strong>
              </div>
              <button
                ref={closeReferenceButtonRef}
                type="button"
                aria-label={copy.closeReference}
                title={copy.closeReference}
                onClick={closeReferenceMap}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <img
              src={referenceMapUrl}
              alt={
                language === "de"
                  ? "Top-down-Referenzkarte mit OSM, LoD2 und nummerierten Sehenswürdigkeiten"
                  : "Top-down reference map with OSM, LoD2, and numbered sights"
              }
            />
          </div>
        </div>
      ) : null}

      {isRepositoryOpen ? (
        <div
          className="reference-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Projekt-Repository und Download / Project repository and download"
          onClick={closeRepository}
        >
          <div
            className="repository-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="reference-header">
              <div className="reference-title">
                <Github aria-hidden="true" size={18} />
                <strong>Projekt / Project</strong>
              </div>
              <button
                ref={closeRepositoryButtonRef}
                type="button"
                aria-label="Repository-Hinweis schließen / Close repository information"
                title="Schließen / Close"
                onClick={closeRepository}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="repository-content">
              <div className="repository-language-grid">
                <section lang="de">
                  <span className="repository-language">Deutsch</span>
                  <h2>Offenes Projekt und vollständiger Quellcode</h2>
                  <p>
                    Diese Website gehört zum öffentlichen GitHub-Repository
                    <strong> Klotzkette/isometric-berlin</strong>. Dort liegen
                    Quellcode, Datenquellen, Methodik, Tests und alle Releases.
                  </p>
                </section>
                <section lang="en">
                  <span className="repository-language">English</span>
                  <h2>Open project and complete source code</h2>
                  <p>
                    This website belongs to the public GitHub repository
                    <strong> Klotzkette/isometric-berlin</strong>. It contains
                    the source code, data sources, methodology, tests, and every
                    release.
                  </p>
                </section>
              </div>
              <div className="repository-url-row">
                <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                  {REPOSITORY_URL}
                </a>
                <button
                  type="button"
                  aria-label="Repository-Link kopieren / Copy repository link"
                  title="Link kopieren / Copy link"
                  onClick={() => void copyRepositoryLink()}
                >
                  <Copy size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="repository-actions">
                <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                  <ExternalLink size={18} aria-hidden="true" />
                  <span>Repository öffnen / Open repository</span>
                </a>
                <a href={DOWNLOAD_URL}>
                  <Download size={18} aria-hidden="true" />
                  <span>Viewer herunterladen / Download viewer</span>
                </a>
              </div>
              <small>
                {PROJECT_VERSION} · öffentlich / public · MIT-Code · Open-Data-Modell
              </small>
            </div>
          </div>
        </div>
      ) : null}

      {isHelpOpen ? (
        <div
          className="reference-modal"
          role="dialog"
          aria-modal="true"
          aria-label={copy.helpTitle}
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="help-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="reference-header">
              <div className="reference-title">
                <Keyboard aria-hidden="true" size={18} />
                <strong>{copy.helpTitle}</strong>
              </div>
              <button
                type="button"
                aria-label={copy.closeHelp}
                title={copy.closeHelp}
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
                    ? language === "de"
                      ? "Bildschirmbezogen durch die 3D-Isometrie verschieben"
                      : "Move through the 3D isometry in screen directions"
                    : language === "de"
                      ? "Karte in Meterlage verschieben"
                      : "Move the map in metric space"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>
                  {viewerMode === "three"
                    ? language === "de"
                      ? "Entlang der Blickrichtung vorwärts / rückwärts fliegen und seitwärts versetzen"
                      : "Fly forward / backward along the view heading and strafe sideways"
                    : language === "de"
                      ? "Ansicht drehen oder zoomen"
                      : "Rotate or zoom the view"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>Alt</kbd>/<kbd>Option</kbd> + <kbd>←</kbd> <kbd>→</kbd>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>
                  {viewerMode === "three"
                    ? language === "de"
                      ? "Kamera drehen und stufenlos bis in die Untersicht neigen"
                      : "Orbit and tilt the camera continuously into the underside view"
                    : language === "de"
                      ? "Ansicht drehen und neigen"
                      : "Rotate and tilt the view"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>PageUp</kbd> <kbd>PageDown</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Vorige / nächste Sehenswürdigkeit"
                    : "Previous / next sight"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>Leertaste</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Kurz tippen: Sehenswürdigkeiten-Tour starten / pausieren"
                    : "Tap: start / pause the sights tour"}
                </dd>
              </div>
              {viewerMode === "three" ? (
                <div>
                  <dt>
                    <kbd>Leertaste</kbd> halten + <kbd>←</kbd> <kbd>→</kbd>
                    <kbd>↑</kbd> <kbd>↓</kbd>
                  </dt>
                  <dd>
                    {language === "de"
                      ? "Flugmodus: gleichmäßig fliegen (mit Shift: Höhe ändern); auf dem Handy übernimmt der Daumen-Joystick unten links"
                      : "Flight mode: fly smoothly (with Shift: change altitude); on phones the bottom-left thumb joystick does the same"}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>
                  <kbd>+</kbd> <kbd>=</kbd> <kbd>−</kbd>
                </dt>
                <dd>{language === "de" ? "Vergrößern / verkleinern" : "Zoom in / out"}</dd>
              </div>
              <div>
                <dt>
                  <kbd>Home</kbd> <kbd>0</kbd>
                </dt>
                <dd>{language === "de" ? "Gesamtansicht zeigen" : "Show overview"}</dd>
              </div>
              <div>
                <dt>
                  <kbd>L</kbd>
                </dt>
                <dd>{copy.copyLink}</dd>
              </div>
              <div>
                <dt>
                  <kbd>?</kbd>
                </dt>
                <dd>
                  {language === "de" ? "Diese Hilfe ein- / ausblenden" : "Toggle this help"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>D</kbd>
                </dt>
                <dd>
                  {language === "de" ? "Tag- / Nachtbeleuchtung umschalten" : "Toggle day / night lighting"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>M</kbd>
                </dt>
                <dd>
                  {language === "de" ? "Minecraft-Modus ein- / ausschalten" : "Toggle Minecraft mode"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>B</kbd>
                </dt>
                <dd>{isMusicEnabled ? copy.musicOff : copy.musicOn}</dd>
              </div>
              <div>
                <dt>
                  <kbd>Esc</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Hilfe / Referenzkarte schließen, Tour stoppen"
                    : "Close help / reference map and stop the tour"}
                </dd>
              </div>
            </dl>
            <p className="help-hint">
              {viewerMode === "three"
                ? language === "de"
                  ? "3D: Linke Maustaste dreht, Mausrad zoomt, rechte Maustaste verschiebt. Zwei Finger fliegen per Swipe, zoomen per Pinch und drehen per Twist; drei Finger steuern Drehung und Neigung bis unter das Gelände."
                  : "3D: Left-drag orbits, the wheel zooms, and right-drag pans. Two fingers fly by swiping, zoom by pinching, and rotate by twisting; three fingers control orbit and tilt into the underside."
                : language === "de"
                  ? "Detailkarte: ziehen zum Verschieben, Shift + ziehen zum freien Drehen und scrollen zum Zoomen. Zwei Finger zoomen, verschieben und drehen gleichzeitig."
                  : "Detail map: drag to pan, Shift-drag to rotate freely, and scroll to zoom. Two fingers zoom, pan, and rotate together."}
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
              ? copy.dataClose
              : copy.dataOpen
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
