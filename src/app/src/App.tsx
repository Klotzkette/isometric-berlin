import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
  Box as BoxIcon,
  ChevronDown,
  ChevronUp,
  CloudRain,
  CloudSnow,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FlipHorizontal2,
  FlipVertical2,
  Footprints,
  Github,
  Home,
  Info,
  Keyboard,
  Languages,
  Lightbulb,
  LightbulbOff,
  Link2,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPinned,
  Maximize2,
  Minus,
  Minimize2,
  Music,
  Moon,
  MoreHorizontal,
  Pause,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Rotate3D,
  SkipBack,
  SkipForward,
  Snowflake,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import OpenSeadragon from "openseadragon";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ThreeViewer, type ThreeViewerHandle } from "./ThreeViewer";
import {
  AmbientSoundscape,
  isAmbientAudioSupported,
} from "./AmbientSoundscape";
import { DuskChiptune, isChiptuneSupported } from "./DuskChiptune";
import {
  registerFirstGestureStart,
  registerVisibleAutoplayRetry,
  shouldStopAudioOnToggleTap,
} from "./audioAutostart";
import { registerAudioLifecycle } from "./audioLifecycle";
import { heldNavigationInput } from "./cameraNavigation";
import {
  CONTROL_DOCK_SIDE_STORAGE_KEY,
  type ControlDockSide,
  controlDockSideFromStored,
  oppositeControlDockSide,
} from "./controlDock";
import {
  heldPedestrianInput,
  isPedestrianSprintDoubleActivation,
} from "./pedestrianNavigation";
import bundledLandmarkPayload from "./data/regierungsviertel-landmarks.json";
import { landmarkPixelCoordinates } from "./landmarkCoordinates";
import { isReservedBrowserChord } from "./keyboardShortcuts";
import {
  LANGUAGE_STORAGE_KEY,
  UI_COPY,
  type Language,
  initialLanguage,
} from "./localization";
import { type VisualMode, resolveInitialVisualMode } from "./visualMode";
import {
  isNightLightsOnByUser,
  rememberNightLightsOn,
  resolveNightLightsOn,
  supportsNightLightsToggle,
} from "./nightLighting";
import {
  DEFAULT_FOCUS_LANDMARK,
  NORTH_UP_ROTATION,
  resolveResetView,
} from "./resetView";
import { MinecraftCubeIcon } from "./visual-modes/minecraft/MinecraftCubeIcon";
import { MinecraftDziPostProcessor } from "./visual-modes/minecraft/MinecraftDziPostProcessor";
import {
  DOWNLOAD_URL,
  PROJECT_VERSION,
  REPOSITORY_URL,
} from "./projectMetadata";
import {
  COMPACT_LAYOUT_MEDIA_QUERY,
  chromeHiddenForLayout,
  observeCompactLayout,
  shouldPersistChromePreference,
} from "./responsiveLayout";
import {
  PEN_GESTURE_SETTINGS,
  TOUCH_GESTURE_SETTINGS,
  normalizeRotation,
  rotationDistance,
  rotationDeltaFromMouseDrag,
  snapRotationToCardinals,
} from "./viewerGestures";
import {
  FEATURED_SIGHT_NAMES,
  featuredSights,
  findSightBySlug,
  parseViewHash,
  sightSlug,
} from "./viewNavigation";

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
  Bundeskanzleramt: "Kanzleramt",
  "Marie-Elisabeth-Lüders-Haus": "M.-E.-Lüders-Haus",
  "Paul-Löbe-Haus": "Paul-Löbe-Haus",
  Reichstagsgebäude: "Reichstag",
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
  Zollpackhof: "Zollpackhof",
  "Gustav-Heinemann-Brücke": "Gustav-Heinemann-Brücke",
  Spreebogen: "Spreebogen",
  "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)":
    "Tiergartentunnel",
  "Schweizerische Botschaft": "Schweizer Botschaft",
  "Fahne der Einheit": "Fahne der Einheit",
  "Quadriga mit Victoria": "Quadriga",
  "Starbucks Pariser Platz": "Starbucks Pariser Platz",
};

const THREE_NORTH_AZIMUTH = 40;
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
    const context = canvas.getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return context ? "three" : "map";
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
    const storedHidden =
      window.localStorage.getItem(CHROME_STORAGE_KEY) === "true";
    const compact = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches;
    return chromeHiddenForLayout(storedHidden, compact);
  } catch {
    return false;
  }
}

function initialControlDockSide(): ControlDockSide {
  try {
    return controlDockSideFromStored(
      window.localStorage.getItem(CONTROL_DOCK_SIDE_STORAGE_KEY),
    );
  } catch {
    return "left";
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
  return (
    {
      N: copy.northUp,
      O: copy.eastUp,
      S: copy.southUp,
      W: copy.westUp,
    }[short] ?? short
  );
}

function orientationShort(short: string, language: Language): string {
  return language === "en" && short === "O" ? "E" : short;
}

function landmarkShortLabel(name: string): string {
  return LANDMARK_SHORT_LABELS[name] ?? name;
}

function isFeaturedSight(name: string): boolean {
  return (FEATURED_SIGHT_NAMES as readonly string[]).includes(name);
}

function focusZoomForLandmark(name: string): number {
  return name === "Bundeskanzleramt" ? 4.35 : 3.1;
}

function mapPointForLandmark(
  viewer: OpenSeadragon.Viewer,
  landmark: Landmark,
): OpenSeadragon.Point {
  const contentSize = viewer.world.getItemAt(0)?.getContentSize();
  const { x, y } = landmarkPixelCoordinates(
    landmark,
    contentSize?.x ?? bundledLandmarkPayload.image.width,
    contentSize?.y ?? bundledLandmarkPayload.image.height,
  );
  return viewer.viewport.imageToViewportCoordinates(x, y);
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

function viewUrlFor(
  landmark: Landmark,
  rotation: number,
  isFlipped: boolean,
): string {
  const params = new URLSearchParams();
  const orientation = ORIENTATIONS.find((candidate) =>
    isRotationActive(candidate.degrees, rotation),
  );
  params.set("landmark", sightSlug(landmark.name));
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
  className = "",
  disabled,
  label,
  onDoubleActivate,
  onInput,
}: {
  className?: string;
  disabled: boolean;
  label: string;
  onDoubleActivate?: () => void;
  onInput: (horizontal: number, vertical: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const lastActivationAtRef = useRef(0);
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
      const scale =
        length > JOYSTICK_RADIUS_PX ? JOYSTICK_RADIUS_PX / length : 1;
      const x = dx * scale;
      const y = dy * scale;
      setKnob({ x, y });
      onInput(x / JOYSTICK_RADIUS_PX, -y / JOYSTICK_RADIUS_PX);
    },
    [onInput],
  );

  const release = useCallback(() => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onInput(0, 0);
  }, [onInput]);

  return (
    <div
      ref={baseRef}
      className={`flight-joystick ${className}`.trim()}
      role="application"
      aria-label={label}
      data-disabled={disabled ? "true" : undefined}
      onPointerDown={(event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        const now = performance.now();
        if (
          onDoubleActivate &&
          isPedestrianSprintDoubleActivation(
            lastActivationAtRef.current,
            now,
          )
        ) {
          lastActivationAtRef.current = 0;
          onDoubleActivate();
        } else {
          lastActivationAtRef.current = now;
        }
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

function HoldControlButton({
  ariaLabel,
  children,
  disabled,
  onActivate,
  onDoubleActivate,
  onHoldEnd,
  onHoldStart,
  title,
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled: boolean;
  onActivate: () => void;
  onDoubleActivate?: () => void;
  onHoldEnd: () => void;
  onHoldStart: () => void;
  title: string;
}) {
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartedAtRef = useRef(0);
  const onActivateRef = useRef(onActivate);
  const onDoubleActivateRef = useRef(onDoubleActivate);
  const onHoldEndRef = useRef(onHoldEnd);
  const onHoldStartRef = useRef(onHoldStart);
  onActivateRef.current = onActivate;
  onDoubleActivateRef.current = onDoubleActivate;
  onHoldEndRef.current = onHoldEnd;
  onHoldStartRef.current = onHoldStart;

  const release = useCallback((pointerId?: number, activateTap = true) => {
    if (
      pointerIdRef.current === null ||
      (pointerId !== undefined && pointerIdRef.current !== pointerId)
    ) {
      return;
    }
    const wasTap = performance.now() - pointerStartedAtRef.current < 90;
    pointerIdRef.current = null;
    onHoldEndRef.current();
    if (activateTap && wasTap) {
      onActivateRef.current();
    }
  }, []);

  useEffect(() => () => release(undefined, false), [release]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      title={title}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) {
          return;
        }
        event.preventDefault();
        pointerIdRef.current = event.pointerId;
        pointerStartedAtRef.current = performance.now();
        event.currentTarget.setPointerCapture(event.pointerId);
        onHoldStartRef.current();
      }}
      onPointerUp={(event) => release(event.pointerId)}
      onPointerCancel={(event) => release(event.pointerId)}
      onLostPointerCapture={(event) => release(event.pointerId)}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        // Pointer activation is handled above so a held button never emits an
        // extra step on release. Keyboard activation still gets one exact step.
        if (event.detail === 0) {
          onActivateRef.current();
        }
      }}
      onDoubleClick={(event) => {
        if (onDoubleActivateRef.current) {
          event.preventDefault();
          onDoubleActivateRef.current();
        }
      }}
    >
      {children}
    </button>
  );
}

export function App() {
  const appShellRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ambientSoundscapeRef = useRef<AmbientSoundscape | null>(null);
  const ambientStartAttemptRef = useRef(0);
  // "Dusk Republic": enabled on every load, but Web Audio starts only from
  // the visitor's first gesture. Turning it off applies to this session.
  const chiptuneRef = useRef<DuskChiptune | null>(null);
  const chiptuneStartAttemptRef = useRef(0);
  const [isSoundtrackEnabled, setIsSoundtrackEnabled] = useState(() =>
    isChiptuneSupported(),
  );
  // Intent is on from the first frame, but a browser that blocks autoplay
  // leaves the page silent. The toggle follows this, not the intent, so it
  // never claims to be playing over silence.
  const [isSoundtrackAudible, setIsSoundtrackAudible] = useState(false);
  const threeViewerRef = useRef<ThreeViewerHandle | null>(null);
  const closeReferenceButtonRef = useRef<HTMLButtonElement | null>(null);
  const referenceReturnFocusRef = useRef<HTMLElement | null>(null);
  const closeRepositoryButtonRef = useRef<HTMLButtonElement | null>(null);
  const repositoryReturnFocusRef = useRef<HTMLElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  // Held-key state for continuous pan, flight and orbit.
  const heldFlightKeysRef = useRef(new Set<string>());
  const lastPedestrianForwardActivationAtRef = useRef(0);
  const pedestrianSprintLockedRef = useRef(false);
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
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const copy = UI_COPY[language];
  const [status, setStatus] = useState(copy.loadingMesh);
  const [viewerMode, setViewerMode] = useState<ViewerMode>(initialViewerMode);
  const [lightingMode, setLightingMode] =
    useState<VisualMode>(initialLightingMode);
  // "Licht an/aus": persisted like mute (nightLighting.ts), independent of
  // the visual mode itself. Only night reads it — day/minecraft ignore it
  // entirely, see resolveNightLightsOn.
  const [nightLightsOn, setNightLightsOn] = useState<boolean>(
    isNightLightsOnByUser,
  );
  const [rainEnabled, setRainEnabled] = useState(false);
  // Snowfall has its own preference so switching back to Day/Night/Minecraft
  // never turns a previous rain choice into an unexpected shower. Snowstorm
  // keeps its established falling-snow default, but the same weather control
  // can now pause and resume it.
  const [snowfallEnabled, setSnowfallEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isThreeReady, setIsThreeReady] = useState(false);
  const [isThreeUnderside, setIsThreeUnderside] = useState(false);
  const [isPedestrianMode, setIsPedestrianMode] = useState(false);
  const [isPedestrianSprinting, setIsPedestrianSprinting] = useState(false);
  const [threePolarDegrees, setThreePolarDegrees] = useState(58);
  const [rotation, setRotation] = useState(NORTH_UP_ROTATION);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRepositoryOpen, setIsRepositoryOpen] = useState(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState(false);
  const [isMusicAudible, setIsMusicAudible] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const [isChromeHidden, setIsChromeHidden] = useState(initialChromeHidden);
  const [controlDockSide, setControlDockSide] = useState<ControlDockSide>(
    initialControlDockSide,
  );
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [showCoachMark, setShowCoachMark] = useState(() => !hasSeenCoachMark());
  const [showBrandTitle, setShowBrandTitle] = useState(false);
  const [minecraftSpark, setMinecraftSpark] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [isAttributionOpen, setIsAttributionOpen] = useState(() => {
    try {
      const seen = window.sessionStorage.getItem(
        "isometric-berlin.attributionSeen",
      );
      window.sessionStorage.setItem("isometric-berlin.attributionSeen", "true");
      return seen !== "true";
    } catch {
      return true;
    }
  });
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches,
  );
  const [isLandmarkRailOpen, setIsLandmarkRailOpen] = useState(
    () => !window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches,
  );
  const [keepThreeWarm] = useState(
    () => !window.matchMedia("(pointer: coarse)").matches,
  );
  const compactCoachActive = showCoachMark && isCompactLayout;

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
  const featuredLandmarks = useMemo(
    () => featuredSights(landmarks),
    [landmarks],
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

  const disablePedestrianMode = useCallback(() => {
    pedestrianSprintLockedRef.current = false;
    lastPedestrianForwardActivationAtRef.current = 0;
    setIsPedestrianSprinting(false);
    threeViewerRef.current?.setPedestrianSprint(false);
    setIsPedestrianMode(false);
    threeViewerRef.current?.setPedestrianMode(false);
  }, []);

  const focusLandmark = useCallback(
    (landmark: Landmark, immediate = false) => {
      const shouldMoveImmediately = immediate || prefersReducedMotion();
      disablePedestrianMode();
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
      const point = mapPointForLandmark(viewer, landmark);
      const mobileOffset = isCompactLayout
        ? viewer.viewport.deltaPointsFromPixels(new OpenSeadragon.Point(0, 32))
        : new OpenSeadragon.Point(0, 0);
      viewer.viewport.zoomTo(
        focusZoomForLandmark(landmark.name),
        undefined,
        shouldMoveImmediately,
      );
      viewer.viewport.panTo(point.plus(mobileOffset), shouldMoveImmediately);
    },
    [copy.focus, disablePedestrianMode, isCompactLayout, viewerMode],
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

  const disposeAllAudio = useCallback(() => {
    ambientStartAttemptRef.current += 1;
    chiptuneStartAttemptRef.current += 1;
    const ambient = ambientSoundscapeRef.current;
    ambientSoundscapeRef.current = null;
    const chiptune = chiptuneRef.current;
    chiptuneRef.current = null;
    ambient?.dispose();
    void chiptune?.dispose();
  }, []);

  useEffect(() => {
    const unregister = registerAudioLifecycle({
      dispose: disposeAllAudio,
      documentTarget: document,
      resume: () => {
        void ambientSoundscapeRef.current?.setSuspended(false);
        void chiptuneRef.current?.setSuspended(false);
      },
      suspend: () => {
        void ambientSoundscapeRef.current?.setSuspended(true);
        void chiptuneRef.current?.setSuspended(true);
      },
      windowTarget: window,
    });
    return () => {
      unregister();
      disposeAllAudio();
    };
  }, [disposeAllAudio]);

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
        setIsMusicAudible(false);
        if (!silent) {
          setStatus(unsupportedMessage);
        }
        return false;
      }
      if (typeof document !== "undefined" && document.hidden) {
        return false;
      }
      if (!silent) {
        setStatus(copy.musicStarting);
      }
      const attempt = ++ambientStartAttemptRef.current;
      const soundscape =
        ambientSoundscapeRef.current ?? new AmbientSoundscape();
      ambientSoundscapeRef.current = soundscape;
      let started = false;
      let failed = false;
      try {
        started = await soundscape.start();
      } catch {
        failed = true;
      }
      if (attempt !== ambientStartAttemptRef.current) {
        if (started && ambientSoundscapeRef.current !== soundscape) {
          soundscape.dispose();
        }
        return false;
      }
      if (failed) {
        soundscape.dispose();
      }
      if (ambientSoundscapeRef.current !== soundscape) {
        if (started) {
          soundscape.dispose();
        }
        return false;
      }
      if (!started) {
        soundscape.stop();
        if (ambientSoundscapeRef.current === soundscape) {
          ambientSoundscapeRef.current = null;
        }
      }
      setIsMusicEnabled(started);
      setIsMusicAudible(started && soundscape.audible);
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

  // Branches on audibility (see shouldStopAudioOnToggleTap), not on the
  // `isMusicEnabled` intent flag: consistent with the soundtrack toggle
  // below and immune to the same first-gesture race, even though
  // `isMusicEnabled` starts `false` here (see the useState above) and so
  // was not actually exposed to it in practice.
  const toggleMusic = useCallback(async () => {
    if (shouldStopAudioOnToggleTap(isMusicAudible)) {
      ambientStartAttemptRef.current += 1;
      ambientSoundscapeRef.current?.stop();
      setIsMusicEnabled(false);
      setIsMusicAudible(false);
      // Remember explicit mute so the auto-start effect stays quiet on the
      // next visit / interaction.
      rememberMusicMuted(true);
      setStatus(copy.musicOff);
      return;
    }
    await startMusic();
  }, [copy.musicOff, isMusicAudible, startMusic]);

  const startSoundtrack = useCallback(
    async (
      options: {
        preserveIntentOnFailure?: boolean;
        silent?: boolean;
      } = {},
    ) => {
      const { preserveIntentOnFailure = false, silent = false } = options;
      const unsupportedMessage =
        language === "de"
          ? "Soundtrack wird von diesem Browser nicht unterstützt"
          : "Soundtrack is not supported by this browser";
      if (!isChiptuneSupported()) {
        setIsSoundtrackEnabled(false);
        setIsSoundtrackAudible(false);
        if (!silent) {
          setStatus(unsupportedMessage);
        }
        return false;
      }
      if (typeof document !== "undefined" && document.hidden) {
        return false;
      }
      const attempt = ++chiptuneStartAttemptRef.current;
      const player = chiptuneRef.current ?? new DuskChiptune();
      chiptuneRef.current = player;
      let started = false;
      let failed = false;
      try {
        started = await player.start();
      } catch {
        failed = true;
      }
      if (attempt !== chiptuneStartAttemptRef.current) {
        if (started && chiptuneRef.current !== player) {
          await player.dispose();
        }
        return false;
      }
      if (failed) {
        await player.dispose();
      }
      if (chiptuneRef.current !== player) {
        if (started) {
          await player.dispose();
        }
        return false;
      }
      if (started || !preserveIntentOnFailure) {
        setIsSoundtrackEnabled(started);
      }
      setIsSoundtrackAudible(started && player.audible);
      if (!silent) {
        setStatus(started ? copy.soundtrackOn : unsupportedMessage);
      }
      return started;
    },
    [copy.soundtrackOn, language],
  );

  // Both engines can fall silent without us asking — autoplay blocks, tab
  // suspension, a context the browser reclaims. Poll the truth rather than
  // trusting the last thing we told the player to do.
  useEffect(() => {
    const sync = () => {
      setIsSoundtrackAudible(chiptuneRef.current?.audible ?? false);
      setIsMusicAudible(ambientSoundscapeRef.current?.audible ?? false);
    };
    sync();
    const timer = window.setInterval(sync, 700);
    return () => window.clearInterval(timer);
  }, []);

  // Intent without sound is the state the browser's autoplay block leaves
  // us in: say "waiting for a click" rather than pretending to be off.
  const isSoundtrackWaiting = isSoundtrackEnabled && !isSoundtrackAudible;
  const soundtrackOnLabel = isSoundtrackWaiting
    ? copy.soundtrackWaiting
    : copy.soundtrackOn;

  // Mobile-only race (v0.56.2): the visitor's first tap anywhere on the
  // page — e.g. the "…" overflow button that opens this very sheet — is
  // itself a "first gesture" and can already have started the soundtrack
  // via registerFirstGestureStart before the tap on THIS button lands.
  // `isSoundtrackEnabled` reflects on-load INTENT (true from the first
  // render, see the useState above) and can therefore already be `true`
  // even though nothing has played yet. Branching on it here made that
  // first real tap toggle straight back off — the reported "Dusk Republic
  // can't be tapped on mobile" bug: audible went true→(tap)→false in one
  // gesture. Branch on `isSoundtrackAudible` (what the visitor can
  // actually hear) instead, so the very first tap always ends in "on",
  // never a same-gesture double toggle, matching the desktop behaviour
  // where the toggle button itself is the first gesture and no race
  // exists.
  const toggleSoundtrack = useCallback(async () => {
    if (shouldStopAudioOnToggleTap(isSoundtrackAudible)) {
      chiptuneStartAttemptRef.current += 1;
      chiptuneRef.current?.stop();
      setIsSoundtrackEnabled(false);
      setIsSoundtrackAudible(false);
      setStatus(copy.soundtrackOff);
      return;
    }
    await startSoundtrack();
  }, [copy.soundtrackOff, isSoundtrackAudible, startSoundtrack]);

  // Build both procedural graphs while they are suspended. There are no media
  // files in this soundtrack; the generated reverb/noise/wave buffers are the
  // assets to warm, leaving the first permitted gesture only the resume call.
  useEffect(() => {
    if (typeof window === "undefined" || document.hidden) {
      return;
    }
    if (!isMusicMutedByUser() && isAmbientAudioSupported()) {
      const ambient = ambientSoundscapeRef.current ?? new AmbientSoundscape();
      ambientSoundscapeRef.current = ambient;
      ambient.prepare();
    }
    if (isChiptuneSupported()) {
      const chiptune = chiptuneRef.current ?? new DuskChiptune();
      chiptuneRef.current = chiptune;
      chiptune.prepare();
    }
  }, []);

  // Try before the first paint and before ThreeViewer's passive loading work.
  // Chrome origins with autoplay permission therefore hear the first scheduled
  // note as soon as the UI appears. Fresh origins still require the gesture
  // fallback below; no web application can override that browser policy.
  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isMusicMutedByUser() && isAmbientAudioSupported()) {
      void startMusic({ rememberMute: false, silent: true });
    }
    if (isChiptuneSupported()) {
      void startSoundtrack({ preserveIntentOnFailure: true, silent: true });
    }
  }, [startMusic, startSoundtrack]);

  // A page opened in a background tab is deliberately silent while hidden.
  // Retry as soon as Chrome first exposes or restores it, while leaving a
  // genuinely blocked fresh origin to the first-gesture path below.
  useEffect(() => {
    const unregisterAmbient = registerVisibleAutoplayRetry({
      documentTarget: document,
      isAudible: () => ambientSoundscapeRef.current?.audible ?? false,
      isEnabled: () => !isMusicMutedByUser() && isAmbientAudioSupported(),
      start: () => startMusic({ rememberMute: false, silent: true }),
      windowTarget: window,
    });
    const unregisterSoundtrack = registerVisibleAutoplayRetry({
      documentTarget: document,
      isAudible: () => chiptuneRef.current?.audible ?? false,
      isEnabled: () => isSoundtrackEnabled,
      start: () =>
        startSoundtrack({ preserveIntentOnFailure: true, silent: true }),
      windowTarget: window,
    });
    return () => {
      unregisterAmbient();
      unregisterSoundtrack();
    };
  }, [isSoundtrackEnabled, startMusic, startSoundtrack]);

  // A phone never allows the load-time attempt above, so the real start is
  // the visitor's FIRST gesture — including a map drag, which is why these
  // listeners run in the capture phase (see audioAutostart.ts).
  useEffect(() => {
    if (typeof window === "undefined" || !isAmbientAudioSupported()) {
      return;
    }
    return registerFirstGestureStart({
      isMuted: isMusicMutedByUser,
      start: () => startMusic({ rememberMute: false, silent: true }),
      target: window,
    });
  }, [startMusic]);

  useEffect(() => {
    if (typeof window === "undefined" || !isChiptuneSupported()) {
      return;
    }
    return registerFirstGestureStart({
      // Dusk Republic deliberately has no persisted mute key: turning the
      // ambient layer off must never suppress the independent soundtrack.
      isMuted: () => !isSoundtrackEnabled,
      start: () =>
        startSoundtrack({ preserveIntentOnFailure: true, silent: true }),
      target: window,
    });
  }, [isSoundtrackEnabled, startSoundtrack]);

  useEffect(() => {
    if (!shouldPersistChromePreference(isCompactLayout)) {
      return;
    }
    try {
      window.localStorage.setItem(CHROME_STORAGE_KEY, String(isChromeHidden));
    } catch {
      // The viewer remains usable when storage is blocked.
    }
  }, [isChromeHidden, isCompactLayout]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CONTROL_DOCK_SIDE_STORAGE_KEY,
        controlDockSide,
      );
    } catch {
      // Side selection is optional when storage is blocked.
    }
  }, [controlDockSide]);

  useEffect(
    () =>
      observeCompactLayout(
        window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY),
        setIsCompactLayout,
        window.visualViewport,
      ),
    [],
  );

  useEffect(() => {
    if (!isCompactLayout) {
      return;
    }
    setIsChromeHidden((hidden) => chromeHiddenForLayout(hidden, true));
    setIsLandmarkRailOpen(false);
    setMobileSheet(null);
  }, [isCompactLayout]);

  const applyRotation = useCallback(
    (degrees: number) => {
      const next = normalizeRotation(degrees);
      if (viewerMode === "three") {
        threeViewerRef.current?.setAzimuth(threeAzimuthForMapRotation(next));
        setRotation(next);
        return;
      }
      viewerRef.current?.viewport.setRotation(next);
      setRotation(next);
    },
    [viewerMode],
  );

  const rotateBy = useCallback(
    (delta: number) => {
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
    },
    [viewerMode],
  );

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
      disablePedestrianMode();
      const next = !isThreeUnderside;
      setIsThreeUnderside(next);
      threeViewerRef.current?.setUnderside(next);
      setStatus(
        next
          ? language === "de"
            ? "Untergrundübersicht · Bahn und Straßentunnel sichtbar"
            : "Underground overview · rail and road tunnels visible"
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
  }, [disablePedestrianMode, isThreeUnderside, language, viewerMode]);

  const resetOrientation = useCallback(() => {
    if (viewerMode === "three") {
      disablePedestrianMode();
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
  }, [disablePedestrianMode, language, viewerMode]);

  const panByViewport = useCallback((dx: number, dy: number) => {
    const viewport = viewerRef.current?.viewport;
    if (!viewport) {
      return;
    }
    const bounds = viewport.getBounds();
    viewport.panBy(
      new OpenSeadragon.Point(bounds.width * dx, bounds.height * dy),
      true,
    );
    viewport.applyConstraints(true);
  }, []);

  const flyBy = useCallback(
    (horizontal: number, vertical: number) => {
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
    },
    [language],
  );

  const flyForwardBy = useCallback(
    (strafe: number, forward: number) => {
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
    },
    [copy.flyBack, copy.flyForward, copy.flyLeft, copy.flyRight],
  );

  const setFlightInput = useCallback(
    (strafe: number, forward: number, vertical: number) => {
      if (strafe !== 0 || forward !== 0 || vertical !== 0) {
        setIsTouring(false);
      }
      threeViewerRef.current?.setFlightInput(strafe, forward, vertical);
    },
    [],
  );

  const setPanInput = useCallback((horizontal: number, vertical: number) => {
    if (horizontal !== 0 || vertical !== 0) {
      setIsTouring(false);
    }
    threeViewerRef.current?.setPanInput(horizontal, vertical);
  }, []);

  const setOrbitInput = useCallback((horizontal: number, vertical: number) => {
    if (horizontal !== 0 || vertical !== 0) {
      setIsTouring(false);
    }
    threeViewerRef.current?.setOrbitInput(horizontal, vertical);
  }, []);

  const applyPedestrianSprint = useCallback(
    (enabled: boolean, announce = false) => {
      setIsPedestrianSprinting(enabled);
      threeViewerRef.current?.setPedestrianSprint(enabled);
      if (announce) {
        setStatus(enabled ? copy.pedestrianSprintOn : copy.pedestrianSprintOff);
      }
    },
    [copy.pedestrianSprintOff, copy.pedestrianSprintOn],
  );

  const togglePedestrianSprint = useCallback(() => {
    const nextLocked = !pedestrianSprintLockedRef.current;
    pedestrianSprintLockedRef.current = nextLocked;
    const heldSprint = heldFlightKeysRef.current.has("Shift");
    applyPedestrianSprint(nextLocked || heldSprint, true);
  }, [applyPedestrianSprint]);

  const zoomBy = useCallback(
    (factor: number) => {
      if (viewerMode === "three") {
        threeViewerRef.current?.zoomBy(factor);
        return;
      }
      viewerRef.current?.viewport.zoomBy(factor, undefined, true);
    },
    [viewerMode],
  );

  const goHome = useCallback(() => {
    if (viewerMode === "three") {
      disablePedestrianMode();
      threeViewerRef.current?.reset();
      setRotation(NORTH_UP_ROTATION);
      setIsThreeUnderside(false);
      return;
    }
    viewerRef.current?.viewport.goHome();
  }, [disablePedestrianMode, viewerMode]);

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
      setStatus(
        language === "de" ? "Ansicht-Link kopiert" : "View link copied",
      );
    } catch {
      setStatus(
        language === "de"
          ? "Ansicht-Link in Adresszeile"
          : "View link in address bar",
      );
    }
  }, [isFlipped, language, rotation, selectedLandmark]);

  const toggleTour = useCallback(() => {
    if (!canNavigateLandmarks) {
      return;
    }
    setIsTouring((current) => {
      const next = !current;
      if (next) {
        disablePedestrianMode();
      }
      setStatus(
        next ? (language === "de" ? "Tour läuft" : "Tour running") : copy.ready,
      );
      if (next && selectedIndex < 0) {
        focusLandmark(landmarks[0], true);
      }
      return next;
    });
  }, [
    canNavigateLandmarks,
    copy.ready,
    disablePedestrianMode,
    focusLandmark,
    landmarks,
    language,
    selectedIndex,
  ]);

  const selectVisualMode = useCallback(
    (next: VisualMode) => {
      setLightingMode(next);
      setStatus(
        next === "minecraft"
          ? `${copy.minecraft} · Premium Voxel`
          : next === "night"
            ? copy.night
            : next === "snowstorm"
              ? copy.snowstorm
              : copy.day,
      );
    },
    [copy],
  );

  const resetToDefaultView = useCallback(() => {
    disablePedestrianMode();
    const target = resolveResetView();
    selectVisualMode(target.lightingMode);
    setRotation(target.rotationDegrees);
    setIsThreeUnderside(target.isUnderside);
    setThreePolarDegrees(58);
    if (viewerMode === "three") {
      threeViewerRef.current?.reset();
    } else {
      viewerRef.current?.viewport.setRotation(target.rotationDegrees);
      viewerRef.current?.viewport.setFlip(target.isFlipped);
    }
    setIsFlipped(target.isFlipped);
    const hero = landmarks.find((entry) => entry.name === target.focus);
    if (hero) {
      focusLandmark(hero);
    } else {
      setSelected(target.focus);
    }
    setStatus(language === "de" ? "Standardansicht" : "Default view");
  }, [
    disablePedestrianMode,
    focusLandmark,
    landmarks,
    language,
    selectVisualMode,
    viewerMode,
  ]);

  const toggleLightingMode = useCallback(() => {
    selectVisualMode(lightingMode === "day" ? "night" : "day");
  }, [lightingMode, selectVisualMode]);

  const toggleMinecraftMode = useCallback(() => {
    const next: VisualMode = lightingMode === "minecraft" ? "day" : "minecraft";
    selectVisualMode(next);
  }, [lightingMode, selectVisualMode]);

  const toggleSnowstormMode = useCallback(() => {
    const next: VisualMode = lightingMode === "snowstorm" ? "day" : "snowstorm";
    selectVisualMode(next);
  }, [lightingMode, selectVisualMode]);

  const togglePedestrianMode = useCallback(() => {
    const next = !isPedestrianMode;
    pedestrianSprintLockedRef.current = false;
    lastPedestrianForwardActivationAtRef.current = 0;
    applyPedestrianSprint(false);
    heldFlightKeysRef.current.clear();
    setFlightInput(0, 0, 0);
    setPanInput(0, 0);
    setOrbitInput(0, 0);
    setIsTouring(false);
    setMobileSheet(null);
    setIsPedestrianMode(next);
    if (next) {
      setViewerMode("three");
      setIsThreeUnderside(false);
    }
    threeViewerRef.current?.setPedestrianMode(next);
    setStatus(next ? copy.pedestrianOn : copy.pedestrianOff);
  }, [
    applyPedestrianSprint,
    copy.pedestrianOff,
    copy.pedestrianOn,
    isPedestrianMode,
    setFlightInput,
    setOrbitInput,
    setPanInput,
  ]);

  // "Licht an/aus": only meaningful in night mode (supportsNightLightsToggle
  // guards the UI too), persisted exactly like music mute.
  const toggleNightLights = useCallback(() => {
    if (!supportsNightLightsToggle(lightingMode)) {
      return;
    }
    setNightLightsOn((current) => {
      const next = !current;
      rememberNightLightsOn(next);
      setStatus(next ? copy.nightLightsOn : copy.nightLightsOff);
      return next;
    });
  }, [copy, lightingMode]);

  const togglePrecipitation = useCallback(() => {
    if (lightingMode === "snowstorm") {
      setSnowfallEnabled((current) => {
        const next = !current;
        setStatus(next ? copy.snowfallActive : copy.snowfallInactive);
        return next;
      });
      return;
    }
    setRainEnabled((current) => {
      const next = !current;
      setStatus(next ? copy.rainActive : copy.rainInactive);
      return next;
    });
  }, [
    copy.rainActive,
    copy.rainInactive,
    copy.snowfallActive,
    copy.snowfallInactive,
    lightingMode,
  ]);

  const toggleViewerMode = useCallback(() => {
    const next = viewerMode === "three" ? "map" : "three";
    if (next === "map") {
      disablePedestrianMode();
    }
    if (next === "map" && !keepThreeWarm) {
      setIsThreeReady(false);
    }
    setViewerMode(next);
    setStatus(next === "three" ? copy.loadingMesh : copy.loadingMap);
  }, [
    copy.loadingMap,
    copy.loadingMesh,
    disablePedestrianMode,
    keepThreeWarm,
    viewerMode,
  ]);

  const toggleChrome = useCallback(() => {
    setMobileSheet(null);
    setIsChromeHidden((hidden) => !hidden);
  }, []);

  const toggleControlDockSide = useCallback(() => {
    setControlDockSide((current) => {
      const next = oppositeControlDockSide(current);
      setStatus(
        next === "right" ? copy.controlsMovedRight : copy.controlsMovedLeft,
      );
      return next;
    });
  }, [copy.controlsMovedLeft, copy.controlsMovedRight]);

  const toggleFullscreen = useCallback(async () => {
    const shell = appShellRef.current;
    if (!shell) {
      return;
    }
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }
    const mobileLike =
      window.innerWidth <= 1_024 ||
      window.matchMedia("(pointer: coarse)").matches;
    if (mobileLike) {
      setIsPseudoFullscreen(true);
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (shell.requestFullscreen) {
        await Promise.race([
          shell.requestFullscreen({ navigationUI: "hide" }),
          new Promise<void>((resolve) => window.setTimeout(resolve, 450)),
        ]);
        if (document.fullscreenElement) {
          return;
        }
      }
    } catch {
      // iOS Safari does not expose element fullscreen for ordinary pages.
    }
    setIsPseudoFullscreen(true);
  }, [isPseudoFullscreen]);

  useEffect(() => {
    const update = () => {
      const active = document.fullscreenElement !== null;
      setIsFullscreen(active);
      if (active) {
        setIsPseudoFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
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
      // A three-finger drag on the 3D canvas is the camera tilt; only
      // swipes that start on the chrome may toggle the chrome.
      if (
        event.target instanceof Element &&
        event.target.closest(".three-canvas, canvas")
      ) {
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
    const payload = bundledLandmarkPayload as LandmarkPayload;
    setLandmarks(sortLandmarksForTour(payload.landmarks));
  }, []);

  useEffect(() => {
    if (landmarks.length === 0) {
      return;
    }
    const applyHash = () => {
      const viewHash = parseViewHash(window.location.hash);
      const hashLandmark = findSightBySlug(landmarks, viewHash.landmarkSlug);
      const hashRotation = rotationFromHashValue(viewHash.rotationValue);
      if (hashRotation !== null) {
        rotationRef.current = hashRotation;
        applyRotation(hashRotation);
      }
      if (viewHash.flipped !== null) {
        flipRef.current = viewHash.flipped;
        setIsFlipped(viewHash.flipped);
        viewerRef.current?.viewport.setFlip(viewHash.flipped);
      }
      // Apply the shared map orientation first. A landmark may own a precise
      // close-up camera (notably the Tiergartentunnel bore); applying the
      // generic rotation afterwards used to destroy that framing.
      if (hashLandmark) {
        focusLandmark(hashLandmark, true);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
    };
  }, [applyRotation, focusLandmark, landmarks]);

  useEffect(() => {
    const NAVIGATION_KEYS = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Shift",
      "Alt",
      "w",
      "a",
      "s",
      "d",
      "q",
      "e",
    ];
    const navigationKey = (key: string): string =>
      key.length === 1 ? key.toLowerCase() : key;
    const updateHeldNavigation = () => {
      if (isPedestrianMode) {
        const input = heldPedestrianInput(heldFlightKeysRef.current);
        const sprint = input.sprint || pedestrianSprintLockedRef.current;
        setPanInput(0, 0);
        setFlightInput(input.strafe, input.forward, 0);
        setOrbitInput(input.turn, input.look);
        threeViewerRef.current?.setPedestrianSprint(sprint);
        setIsPedestrianSprinting(sprint);
        return;
      }
      const { flight, orbit, pan } = heldNavigationInput(
        heldFlightKeysRef.current,
      );
      setPanInput(pan.horizontal, pan.vertical);
      setFlightInput(flight.strafe, flight.forward, 0);
      setOrbitInput(orbit.horizontal, orbit.vertical);
    };
    const stopHeldNavigation = () => {
      if (heldFlightKeysRef.current.size > 0) {
        heldFlightKeysRef.current.clear();
        setFlightInput(0, 0, 0);
        setPanInput(0, 0);
        setOrbitInput(0, 0);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      // Browser chords (Cmd+L, Ctrl+D, …) must never be hijacked by the
      // single-letter shortcuts below.
      if (isReservedBrowserChord(event)) {
        return;
      }
      if (event.key === "Escape") {
        stopHeldNavigation();
        setIsPseudoFullscreen(false);
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
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePedestrianMode();
        return;
      }
      if (
        isPedestrianMode &&
        viewerMode === "three" &&
        !isReferenceOpen &&
        !isHelpOpen &&
        !isRepositoryOpen &&
        isReady
      ) {
        if (event.key === " ") {
          event.preventDefault();
          if (!event.repeat && threeViewerRef.current?.jumpPedestrian()) {
            setStatus(copy.pedestrianJump);
          }
          return;
        }
        const key = navigationKey(event.key);
        if (key === "Shift") {
          event.preventDefault();
          heldFlightKeysRef.current.add(key);
          if (!event.repeat) {
            setStatus(copy.pedestrianSprintOn);
          }
          updateHeldNavigation();
          return;
        }
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "w",
            "a",
            "s",
            "d",
            "q",
            "e",
          ].includes(key)
        ) {
          event.preventDefault();
          let sprintToggled = false;
          if (!event.repeat && (key === "ArrowUp" || key === "w")) {
            const now = performance.now();
            if (
              isPedestrianSprintDoubleActivation(
                lastPedestrianForwardActivationAtRef.current,
                now,
              )
            ) {
              lastPedestrianForwardActivationAtRef.current = 0;
              togglePedestrianSprint();
              sprintToggled = true;
            } else {
              lastPedestrianForwardActivationAtRef.current = now;
            }
          }
          heldFlightKeysRef.current.add(key);
          if (!event.repeat && !sprintToggled) {
            setStatus(
              language === "de"
                ? "Zu Fuß · bewegen und umschauen"
                : "On foot · move and look around",
            );
          }
          updateHeldNavigation();
          return;
        }
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
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        toggleSnowstormMode();
        return;
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        toggleNightLights();
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetToDefaultView();
        return;
      }
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        void toggleMusic();
        return;
      }
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        void toggleSoundtrack();
        return;
      }
      if (isReferenceOpen || isHelpOpen || isRepositoryOpen || !isReady) {
        return;
      }
      if (
        viewerMode === "three" &&
        (event.key === "Shift" || event.key === "Alt") &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some((key) =>
          heldFlightKeysRef.current.has(key),
        )
      ) {
        event.preventDefault();
        heldFlightKeysRef.current.add(event.key);
        updateHeldNavigation();
        return;
      }
      if (
        viewerMode === "three" &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        if (event.shiftKey) {
          heldFlightKeysRef.current.add("Shift");
        } else {
          heldFlightKeysRef.current.delete("Shift");
        }
        if (event.altKey) {
          heldFlightKeysRef.current.add("Alt");
        } else {
          heldFlightKeysRef.current.delete("Alt");
        }
        heldFlightKeysRef.current.add(event.key);
        if (!event.repeat) {
          setStatus(
            event.altKey
              ? language === "de"
                ? "Stufenlos drehen und neigen"
                : "Smooth orbit and tilt"
              : event.shiftKey
                ? language === "de"
                  ? "Stufenlos entlang der Blickrichtung fliegen"
                  : "Smooth flight along the view heading"
                : language === "de"
                  ? "Stufenlos in der Ansicht verschieben"
                  : "Smooth screen-relative movement",
          );
        }
        updateHeldNavigation();
        return;
      }
      if (event.key === "Home" || event.key === "0") {
        event.preventDefault();
        goHome();
        setStatus(copy.home);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setIsTouring(false);
        if (event.shiftKey) {
          rotateBy(8);
          setStatus(language === "de" ? "Drehung: rechts" : "Rotation: right");
        } else {
          panByViewport(0.12, 0);
          setStatus(language === "de" ? "Verschoben: Osten" : "Moved: east");
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIsTouring(false);
        if (event.shiftKey) {
          rotateBy(-8);
          setStatus(language === "de" ? "Drehung: links" : "Rotation: left");
        } else {
          panByViewport(-0.12, 0);
          setStatus(language === "de" ? "Verschoben: Westen" : "Moved: west");
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIsTouring(false);
        if (event.shiftKey) {
          zoomBy(1.16);
          setStatus(language === "de" ? "Zoom: näher" : "Zoom: closer");
        } else {
          panByViewport(0, -0.12);
          setStatus(language === "de" ? "Verschoben: Norden" : "Moved: north");
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsTouring(false);
        if (event.shiftKey) {
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
        if (!event.repeat) {
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
      const key = navigationKey(event.key);
      if (NAVIGATION_KEYS.includes(key)) {
        if (heldFlightKeysRef.current.delete(key)) {
          updateHeldNavigation();
        }
      }
    };
    const handleWindowBlur = () => {
      stopHeldNavigation();
      setIsPedestrianSprinting(pedestrianSprintLockedRef.current);
      threeViewerRef.current?.setPedestrianSprint(
        pedestrianSprintLockedRef.current,
      );
    };
    // Capture phase + preventDefault below beat OpenSeadragon's own
    // canvas key handling, so arrows/+/- act exactly once.
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      stopHeldNavigation();
    };
  }, [
    closeReferenceMap,
    copy.home,
    copyViewLink,
    focusLandmarkByOffset,
    goHome,
    isHelpOpen,
    isPedestrianMode,
    isReady,
    isReferenceOpen,
    isRepositoryOpen,
    language,
    panByViewport,
    resetToDefaultView,
    rotateBy,
    setFlightInput,
    setOrbitInput,
    setPanInput,
    toggleTour,
    toggleLightingMode,
    toggleMinecraftMode,
    toggleSnowstormMode,
    toggleFullscreen,
    toggleMusic,
    toggleNightLights,
    togglePedestrianMode,
    togglePedestrianSprint,
    toggleSoundtrack,
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
    const timer = window.setTimeout(
      () => closeReferenceButtonRef.current?.focus(),
      0,
    );
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
    if (!isTouring) {
      return;
    }
    // A gesture on the map means the user took over — stop teleporting.
    const stopTourOnGesture = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".three-canvas, canvas")
      ) {
        setIsTouring(false);
      }
    };
    window.addEventListener("pointerdown", stopTourOnGesture, true);
    return () => {
      window.removeEventListener("pointerdown", stopTourOnGesture, true);
    };
  }, [isTouring]);

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
      animationTime: 0.12,
      blendTime: 0.06,
      constrainDuringPan: true,
      immediateRender: true,
      minPixelRatio: 0.5,
      minZoomImageRatio: 0.56,
      maxZoomPixelRatio: 6,
      zoomPerClick: 1.6,
      showRotationControl: true,
      visibilityRatio: 1,
      homeFillsViewer: false,
      // Input must lead the picture, not wait behind a long camera spring.
      springStiffness: 18,
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
        console.debug(`[viewer] touch momentum ${average.toFixed(1)} ms/frame`);
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
        params.set("landmark", sightSlug(selectedRef.current));
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
      // Zoom relative to the furthest-out view; the post-processor sizes
      // blocks in world units from this so they stay glued under zoom, not
      // only under pan.
      const minZoom = viewer.viewport.getMinZoom() || 1;
      const scale = viewer.viewport.getZoom(true) / minZoom;
      return { x: point.x, y: point.y, scale };
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
    if (viewerMode !== "map" || !viewer || !isMapReady || !selectedLandmark) {
      return;
    }
    viewer.clearOverlays();
    const marker = document.createElement("div");
    marker.className = "map-marker map-marker--selected";
    marker.dataset.label = landmarkShortLabel(selectedLandmark.name);
    marker.setAttribute("aria-hidden", "true");
    viewer.addOverlay({
      element: marker,
      location: mapPointForLandmark(viewer, selectedLandmark),
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
      isPedestrianMode ||
      landmarks.length === 0 ||
      initialFocusModeRef.current === viewerMode
    ) {
      return;
    }
    initialFocusModeRef.current = viewerMode;
    focusLandmark(selectedLandmark ?? landmarks[0], true);
  }, [
    focusLandmark,
    isPedestrianMode,
    isReady,
    landmarks,
    selectedLandmark,
    viewerMode,
  ]);

  const snowfallMode = lightingMode === "snowstorm";
  const precipitationEnabled = snowfallMode ? snowfallEnabled : rainEnabled;
  const precipitationOnLabel = snowfallMode ? copy.snowfallOn : copy.rainOn;
  const precipitationOffLabel = snowfallMode ? copy.snowfallOff : copy.rainOff;
  const precipitationLabel = snowfallMode ? copy.snowfall : copy.rain;

  return (
    <main
      ref={appShellRef}
      className={[
        "app-shell",
        isTouring ? "app-shell--touring" : "",
        `app-shell--${lightingMode}`,
        `app-shell--viewer-${viewerMode}`,
        isPedestrianMode ? "app-shell--pedestrian" : "",
        isChromeHidden ? "app-shell--chrome-hidden" : "",
        `app-shell--controls-${controlDockSide}`,
        isPseudoFullscreen ? "app-shell--pseudo-fullscreen" : "",
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
        setMinecraftSpark({
          id: Date.now(),
          x: event.clientX,
          y: event.clientY,
        });
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
            canvasAriaLabel={
              isPedestrianMode ? copy.pedestrianCanvas : copy.threeD
            }
            lightingMode={lightingMode}
            nightLightsOn={resolveNightLightsOn(lightingMode, nightLightsOn)}
            pedestrianMode={isPedestrianMode}
            precipitationEnabled={precipitationEnabled}
            progressLabel={copy.loadingMesh}
            sceneUrl={sceneUrl}
            selectedLandmark={selected}
            onReady={() => {
              setIsThreeReady(true);
              setStatus(
                language === "de"
                  ? "Isometrische Ansicht bereit"
                  : "Isometric view ready",
              );
            }}
            onError={(message) => {
              console.error(`Isometric Berlin 3D: ${message}`);
              setIsPedestrianMode(false);
              setIsThreeReady(false);
              setStatus(
                `${language === "de" ? "3D nicht verfügbar" : "3D unavailable"}: ${message}`,
              );
              setViewerMode("map");
            }}
            onPedestrianRespawn={() => {
              setStatus(
                language === "de"
                  ? "Wasser betreten · zurück am Pariser Platz"
                  : "Entered water · back at Pariser Platz",
              );
            }}
            onPedestrianSprintToggle={togglePedestrianSprint}
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
        {rainEnabled && viewerMode === "map" && lightingMode !== "snowstorm" ? (
          <div
            className={`map-rain map-rain--${lightingMode}`}
            aria-hidden="true"
          />
        ) : null}
        {lightingMode === "snowstorm" && viewerMode === "map" ? (
          <div
            className={
              snowfallEnabled ? "map-snowstorm is-active" : "map-snowstorm"
            }
            aria-hidden="true"
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
              {selectedIndex >= 0 ? selectedIndex + 1 : 1}/
              {landmarks.length || 1}
              {` · ${viewerMode === "three" ? "3D" : "2D"}`}
              {isPedestrianMode
                ? language === "de"
                  ? " · Zu Fuß"
                  : " · Walk"
                : ""}
              {lightingMode === "minecraft" ? " · Voxel" : ""}
              {lightingMode === "snowstorm" ? " · Snow" : ""}
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
            className="toolbar-reset"
            aria-label={copy.resetView}
            disabled={!isReady}
            title={`${copy.resetView} (R)`}
            onClick={resetToDefaultView}
          >
            <RefreshCw size={18} aria-hidden="true" />
            <span className="toolbar-reset-text">{copy.resetViewShort}</span>
          </button>
          <button
            type="button"
            aria-label={
              viewerMode === "three" ? copy.switchToMap : copy.switchToThreeD
            }
            aria-pressed={viewerMode === "three"}
            title={viewerMode === "three" ? copy.map : copy.threeD}
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
            className="pedestrian-mode-toggle"
            aria-label={copy.pedestrian}
            aria-pressed={isPedestrianMode}
            title={`${copy.pedestrian} (P)`}
            onClick={togglePedestrianMode}
          >
            <Footprints size={18} aria-hidden="true" />
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
            {supportsNightLightsToggle(lightingMode) ? (
              <button
                type="button"
                className="night-lights-toggle"
                aria-label={
                  nightLightsOn ? copy.nightLightsOff : copy.nightLightsOn
                }
                aria-pressed={nightLightsOn}
                title={`${nightLightsOn ? copy.nightLightsOff : copy.nightLightsOn} (N)`}
                onClick={toggleNightLights}
              >
                {nightLightsOn ? (
                  <Lightbulb size={17} aria-hidden="true" />
                ) : (
                  <LightbulbOff size={17} aria-hidden="true" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={copy.minecraft}
              aria-pressed={lightingMode === "minecraft"}
              title={`${copy.minecraft} (M)`}
              onClick={() => selectVisualMode("minecraft")}
            >
              <MinecraftCubeIcon size={18} />
            </button>
            <button
              type="button"
              aria-label={copy.snowstorm}
              aria-pressed={lightingMode === "snowstorm"}
              title={`${copy.snowstorm} (S)`}
              onClick={() => selectVisualMode("snowstorm")}
            >
              <Snowflake size={18} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="weather-toggle"
            aria-label={
              precipitationEnabled
                ? precipitationOffLabel
                : precipitationOnLabel
            }
            aria-pressed={precipitationEnabled}
            title={
              precipitationEnabled
                ? precipitationOffLabel
                : precipitationOnLabel
            }
            onClick={togglePrecipitation}
          >
            {snowfallMode ? (
              <CloudSnow size={18} aria-hidden="true" />
            ) : (
              <CloudRain size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label={
              isFullscreen || isPseudoFullscreen
                ? copy.fullscreenExit
                : copy.fullscreenEnter
            }
            aria-pressed={isFullscreen || isPseudoFullscreen}
            title={`${
              isFullscreen || isPseudoFullscreen
                ? copy.fullscreenExit
                : copy.fullscreenEnter
            } (F)`}
            onClick={toggleFullscreen}
          >
            {isFullscreen || isPseudoFullscreen ? (
              <Minimize2 size={18} aria-hidden="true" />
            ) : (
              <Maximize2 size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="language-toggle"
            aria-label={`${copy.language}: ${language === "de" ? "Deutsch" : "English"}`}
            title={
              language === "de" ? "Switch to English" : "Auf Deutsch wechseln"
            }
            onClick={toggleLanguage}
          >
            <Languages size={17} aria-hidden="true" />
            <span>{language.toUpperCase()}</span>
          </button>
          <button
            type="button"
            data-audio-toggle="ambient"
            aria-label={isMusicAudible ? copy.musicOff : copy.musicOn}
            aria-pressed={isMusicAudible}
            title={`${isMusicAudible ? copy.musicOff : copy.musicOn} (B)`}
            onClick={toggleMusic}
          >
            {isMusicAudible ? (
              <Volume2 size={18} aria-hidden="true" />
            ) : (
              <VolumeX size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            data-audio-toggle="soundtrack"
            aria-label={
              isSoundtrackAudible ? copy.soundtrackOff : soundtrackOnLabel
            }
            aria-pressed={isSoundtrackAudible}
            className={`soundtrack-toggle${
              isSoundtrackAudible ? " is-active" : ""
            }${isSoundtrackWaiting ? " is-waiting" : ""}`}
            title={`${
              isSoundtrackAudible ? copy.soundtrackOff : soundtrackOnLabel
            } (T)`}
            onClick={toggleSoundtrack}
          >
            <Music size={18} aria-hidden="true" />
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
            disabled={!isReady || isPedestrianMode}
            title={copy.zoomIn}
            onClick={() => zoomBy(1.6)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="zoom-action"
            aria-label={copy.zoomOut}
            disabled={!isReady || isPedestrianMode}
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
          aria-label={isChromeHidden ? copy.showControls : copy.hideControls}
          aria-pressed={isChromeHidden}
          title={isChromeHidden ? copy.showControls : copy.hideControls}
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
              isPedestrianMode
                ? language === "de"
                  ? "Geh-Joystick: ziehen zum Laufen, doppeltippen für Sprint"
                  : "Walking joystick: drag to walk, double-tap for sprint"
                : language === "de"
                  ? "Flug-Joystick: Daumen ziehen zum Fliegen"
                  : "Flight joystick: drag with your thumb to fly"
            }
            onDoubleActivate={
              isPedestrianMode ? togglePedestrianSprint : undefined
            }
            onInput={(strafe, forward) => setFlightInput(strafe, forward, 0)}
          />
        </div>
      ) : null}

      {viewerMode === "three" && !isChromeHidden ? (
        <div className="orbit-joystick-wrap">
          <FlightJoystick
            className="orbit-joystick"
            disabled={!isReady}
            label={
              isPedestrianMode
                ? language === "de"
                  ? "Blick-Joystick: mit der Maus Kopf drehen und heben"
                  : "Look joystick: drag to turn and raise your head"
                : language === "de"
                  ? "Orbit-Joystick: mit der Maus ziehen zum Drehen und Neigen"
                  : "Orbit joystick: drag with the mouse to orbit and tilt"
            }
            onInput={setOrbitInput}
          />
        </div>
      ) : null}

      {viewerMode === "three" && isPedestrianMode && !isChromeHidden ? (
        <button
          type="button"
          className="pedestrian-jump-button"
          aria-label={copy.pedestrianJump}
          title={`${copy.pedestrianJump} (Space)`}
          onClick={() => threeViewerRef.current?.jumpPedestrian()}
        >
          <ArrowUpFromLine size={22} aria-hidden="true" />
        </button>
      ) : null}

      <aside className="orientation-pill" aria-label={copy.orientation}>
        <Compass aria-hidden="true" size={16} />
        <span>
          {viewerMode === "three"
            ? isPedestrianMode
              ? isPedestrianSprinting
                ? "4×"
                : language === "de"
                  ? "1,80 m"
                  : "1.80 m"
              : `${Math.round(threePolarDegrees)}°`
            : (orientation?.short ?? `${Math.round(rotation)}°`)}
        </span>
        <small>
          {viewerMode === "three"
            ? isPedestrianMode
              ? `${copy.pedestrian} · ${
                  isPedestrianSprinting
                    ? copy.pedestrianSprint
                    : language === "de"
                      ? "1,80 m"
                      : "1.80 m"
                }`
              : `${orientation ? orientationLabel(orientation.short, language) : copy.freelyRotated} · ${
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
        <div
          className="control-row control-row--orientation"
          role="group"
          aria-label={copy.orientation}
        >
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
          <button
            type="button"
            className="dock-side-toggle"
            aria-label={
              controlDockSide === "left"
                ? copy.moveControlsRight
                : copy.moveControlsLeft
            }
            title={
              controlDockSide === "left"
                ? copy.moveControlsRight
                : copy.moveControlsLeft
            }
            onClick={toggleControlDockSide}
          >
            {controlDockSide === "left" ? (
              <PanelRight size={16} aria-hidden="true" />
            ) : (
              <PanelLeft size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        {viewerMode === "three" ? (
          <div
            className="control-row movement-controls"
            role="group"
            aria-label={isPedestrianMode ? copy.pedestrian : copy.flight}
          >
            <HoldControlButton
              ariaLabel={
                isPedestrianMode
                  ? language === "de"
                    ? "Vorwärts gehen"
                    : "Walk forward"
                  : copy.flyForward
              }
              disabled={!isReady}
              title={
                isPedestrianMode
                  ? language === "de"
                    ? "Vorwärts gehen (W / ↑), doppelklicken für Sprint"
                    : "Walk forward (W / ↑), double-click for sprint"
                  : `${copy.flyForward} (Shift + ↑)`
              }
              onActivate={() => flyForwardBy(0, 1)}
              onDoubleActivate={
                isPedestrianMode ? togglePedestrianSprint : undefined
              }
              onHoldStart={() => setFlightInput(0, 1, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <ArrowUp size={17} aria-hidden="true" />
            </HoldControlButton>
            <HoldControlButton
              ariaLabel={
                isPedestrianMode
                  ? language === "de"
                    ? "Nach links gehen"
                    : "Walk left"
                  : copy.flyLeft
              }
              disabled={!isReady}
              title={
                isPedestrianMode
                  ? language === "de"
                    ? "Nach links gehen (A)"
                    : "Walk left (A)"
                  : `${copy.flyLeft} (Shift + ←)`
              }
              onActivate={() => flyForwardBy(-1, 0)}
              onHoldStart={() => setFlightInput(-1, 0, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </HoldControlButton>
            <HoldControlButton
              ariaLabel={
                isPedestrianMode
                  ? language === "de"
                    ? "Rückwärts gehen"
                    : "Walk backward"
                  : copy.flyBack
              }
              disabled={!isReady}
              title={
                isPedestrianMode
                  ? language === "de"
                    ? "Rückwärts gehen (S / ↓)"
                    : "Walk backward (S / ↓)"
                  : `${copy.flyBack} (Shift + ↓)`
              }
              onActivate={() => flyForwardBy(0, -1)}
              onHoldStart={() => setFlightInput(0, -1, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <ArrowDown size={17} aria-hidden="true" />
            </HoldControlButton>
            <HoldControlButton
              ariaLabel={
                isPedestrianMode
                  ? language === "de"
                    ? "Nach rechts gehen"
                    : "Walk right"
                  : copy.flyRight
              }
              disabled={!isReady}
              title={
                isPedestrianMode
                  ? language === "de"
                    ? "Nach rechts gehen (D)"
                    : "Walk right (D)"
                  : `${copy.flyRight} (Shift + →)`
              }
              onActivate={() => flyForwardBy(1, 0)}
              onHoldStart={() => setFlightInput(1, 0, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <ArrowRight size={17} aria-hidden="true" />
            </HoldControlButton>
          </div>
        ) : null}
        <div
          className="control-row"
          role="group"
          aria-label={copy.viewTransform}
        >
          {viewerMode === "three" ? (
            <>
              <HoldControlButton
                ariaLabel={copy.tiltUp}
                disabled={!isReady}
                title={`${copy.tiltUp} (Alt/Option + ↑)`}
                onActivate={() => tiltBy(-10)}
                onHoldStart={() => setOrbitInput(0, 1)}
                onHoldEnd={() => setOrbitInput(0, 0)}
              >
                <ArrowUp size={17} aria-hidden="true" />
              </HoldControlButton>
              <HoldControlButton
                ariaLabel={copy.tiltDown}
                disabled={!isReady}
                title={`${copy.tiltDown} (Alt/Option + ↓)`}
                onActivate={() => tiltBy(10)}
                onHoldStart={() => setOrbitInput(0, -1)}
                onHoldEnd={() => setOrbitInput(0, 0)}
              >
                <ArrowDown size={17} aria-hidden="true" />
              </HoldControlButton>
            </>
          ) : null}
          <HoldControlButton
            ariaLabel={copy.rotateLeft}
            disabled={!isReady}
            title={`${copy.rotateLeft} (Alt/Option + ←)`}
            onActivate={() => rotateBy(-15)}
            onHoldStart={() => setOrbitInput(-1, 0)}
            onHoldEnd={() => setOrbitInput(0, 0)}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </HoldControlButton>
          <HoldControlButton
            ariaLabel={copy.rotateRight}
            disabled={!isReady}
            title={`${copy.rotateRight} (Alt/Option + →)`}
            onActivate={() => rotateBy(15)}
            onHoldStart={() => setOrbitInput(1, 0)}
            onHoldEnd={() => setOrbitInput(0, 0)}
          >
            <RotateCw size={17} aria-hidden="true" />
          </HoldControlButton>
          <button
            type="button"
            aria-label={
              viewerMode === "three" ? copy.oppositeView : copy.flipHorizontal
            }
            aria-pressed={viewerMode === "map" && isFlipped}
            disabled={!isReady}
            title={
              viewerMode === "three" ? copy.oppositeView : copy.flipHorizontal
            }
            onClick={toggleHorizontalFlip}
          >
            <FlipHorizontal2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={
              viewerMode === "three" ? copy.trueUnderside : copy.flipVertical
            }
            aria-pressed={viewerMode === "three" && isThreeUnderside}
            disabled={!isReady || isPedestrianMode}
            title={
              viewerMode === "three" ? copy.trueUnderside : copy.flipVertical
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
              aria-label={
                viewerMode === "three" ? copy.flyForward : copy.northUp
              }
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
          <div
            className="mobile-sheet-footer"
            role="group"
            aria-label={copy.mode}
          >
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
              disabled={!isReady || isPedestrianMode}
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
            <button
              type="button"
              aria-label={
                controlDockSide === "left"
                  ? copy.moveControlsRight
                  : copy.moveControlsLeft
              }
              title={
                controlDockSide === "left"
                  ? copy.moveControlsRight
                  : copy.moveControlsLeft
              }
              onClick={toggleControlDockSide}
            >
              {controlDockSide === "left" ? (
                <PanelRight size={19} aria-hidden="true" />
              ) : (
                <PanelLeft size={19} aria-hidden="true" />
              )}
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
              aria-pressed={isPedestrianMode}
              onClick={togglePedestrianMode}
            >
              <Footprints size={20} aria-hidden="true" />
              <span>{copy.pedestrian}</span>
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
            {supportsNightLightsToggle(lightingMode) ? (
              <button
                type="button"
                aria-pressed={nightLightsOn}
                aria-label={
                  nightLightsOn ? copy.nightLightsOff : copy.nightLightsOn
                }
                onClick={toggleNightLights}
              >
                {nightLightsOn ? (
                  <Lightbulb size={20} aria-hidden="true" />
                ) : (
                  <LightbulbOff size={20} aria-hidden="true" />
                )}
                <span>
                  {nightLightsOn ? copy.nightLightsOn : copy.nightLightsOff}
                </span>
              </button>
            ) : null}
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
              aria-pressed={lightingMode === "snowstorm"}
              onClick={() => selectVisualMode("snowstorm")}
            >
              <Snowflake size={20} aria-hidden="true" />
              <span>{copy.snowstorm}</span>
            </button>
            <button
              type="button"
              className="weather-toggle"
              aria-pressed={precipitationEnabled}
              aria-label={
                precipitationEnabled
                  ? precipitationOffLabel
                  : precipitationOnLabel
              }
              onClick={togglePrecipitation}
            >
              {snowfallMode ? (
                <CloudSnow size={20} aria-hidden="true" />
              ) : (
                <CloudRain size={20} aria-hidden="true" />
              )}
              <span>
                {precipitationEnabled
                  ? precipitationOffLabel
                  : precipitationLabel}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={isFullscreen || isPseudoFullscreen}
              aria-label={
                isFullscreen || isPseudoFullscreen
                  ? copy.fullscreenExit
                  : copy.fullscreenEnter
              }
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen || isPseudoFullscreen ? (
                <Minimize2 size={20} aria-hidden="true" />
              ) : (
                <Maximize2 size={20} aria-hidden="true" />
              )}
              <span>
                {isFullscreen || isPseudoFullscreen
                  ? copy.fullscreenExit
                  : copy.fullscreenEnter}
              </span>
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
              data-audio-toggle="ambient"
              aria-pressed={isMusicAudible}
              onClick={toggleMusic}
            >
              {isMusicAudible ? (
                <Volume2 size={20} aria-hidden="true" />
              ) : (
                <VolumeX size={20} aria-hidden="true" />
              )}
              <span>{isMusicAudible ? copy.musicOff : copy.musicOn}</span>
            </button>
            <button
              type="button"
              data-audio-toggle="soundtrack"
              aria-label={
                isSoundtrackAudible ? copy.soundtrackOff : soundtrackOnLabel
              }
              aria-pressed={isSoundtrackAudible}
              className="soundtrack-toggle"
              onClick={() => {
                setMobileSheet(null);
                void toggleSoundtrack();
              }}
            >
              <Music size={20} aria-hidden="true" />
              <span>{copy.soundtrack}</span>
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
            <small>{featuredLandmarks.length}</small>
          </div>
          <div className="landmark-list">
            {featuredLandmarks.map((landmark) => (
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
                  "is-priority",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!isReady}
                onClick={() => {
                  setIsTouring(false);
                  focusLandmark(landmark);
                  if (isCompactLayout) {
                    setIsLandmarkRailOpen(false);
                  }
                }}
              >
                <span className="landmark-row">
                  <span className="landmark-index">
                    {String(landmarks.indexOf(landmark) + 1).padStart(2, "0")}
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
            isFeaturedSight(selectedLandmark.name)
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
          <div
            className="reference-panel"
            onClick={(event) => event.stopPropagation()}
          >
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
                {PROJECT_VERSION} · öffentlich / public · MIT-Code ·
                Open-Data-Modell
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
                    ? isPedestrianMode
                      ? language === "de"
                        ? "Vor / zurück gehen und nach links / rechts drehen"
                        : "Walk forward / back and turn left / right"
                      : language === "de"
                        ? "Gedrückt halten: gleichmäßig bildschirmbezogen durch die 3D-Isometrie verschieben"
                        : "Hold: move smoothly through the 3D isometry in screen directions"
                    : language === "de"
                      ? "Karte in Meterlage verschieben"
                      : "Move the map in metric space"}
                </dd>
              </div>
              {!isPedestrianMode ? <div>
                <dt>
                  <kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>
                  {viewerMode === "three"
                    ? language === "de"
                      ? "Gedrückt halten: entlang der Blickrichtung vorwärts / rückwärts fliegen und seitwärts versetzen"
                      : "Hold: fly forward / backward along the view heading and strafe sideways"
                    : language === "de"
                      ? "Ansicht drehen oder zoomen"
                      : "Rotate or zoom the view"}
                </dd>
              </div> : null}
              <div>
                <dt>
                  <kbd>Alt</kbd>/<kbd>Option</kbd> + <kbd>←</kbd> <kbd>→</kbd>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>
                  {viewerMode === "three"
                    ? isPedestrianMode
                      ? language === "de"
                        ? "Blickrichtung mit dem Kopf nach links / rechts und oben / unten bewegen"
                        : "Move your head left / right and look up / down"
                      : language === "de"
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
                    ? isPedestrianMode
                      ? "Springen (maximal etwa 5,4 m über dem Boden)"
                      : "Kurz tippen: Sehenswürdigkeiten-Tour starten / pausieren"
                    : isPedestrianMode
                      ? "Jump (up to about 5.4 m above the ground)"
                      : "Tap: start / pause the sights tour"}
                </dd>
              </div>
              {isPedestrianMode ? (
                <div>
                  <dt>
                    <kbd>Shift</kbd> / <kbd>W</kbd> <kbd>W</kbd>
                  </dt>
                  <dd>
                    {language === "de"
                      ? "Shift halten oder Vorwärts, Karte beziehungsweise Geh-Joystick doppeltippen: Sprint mit vierfacher Geschwindigkeit ein- / ausschalten"
                      : "Hold Shift or double-tap forward, the map, or the walking pad: toggle four-times sprint speed"}
                  </dd>
                </div>
              ) : null}
              {isPedestrianMode ? (
                <div>
                  <dt>
                    <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>
                  </dt>
                  <dd>
                    {language === "de"
                      ? "Vorwärts, seitwärts und rückwärts gehen; Q / E drehen ebenfalls"
                      : "Walk forward, sideways, and back; Q / E also turn"}
                  </dd>
                </div>
              ) : null}
              {viewerMode === "three" ? (
                <div>
                  <dt>{language === "de" ? "Steuerkreise" : "Control pads"}</dt>
                  <dd>
                    {language === "de"
                      ? isPedestrianMode
                        ? "Mit der Maus am Blick-Kreis ziehen oder die Pfeilknöpfe gedrückt halten; auf Touch-Geräten übernimmt der Geh-Joystick unten links, Doppeltipp schaltet Sprint"
                        : "Mit der Maus am Orbit-Kreis ziehen oder die Pfeilknöpfe gedrückt halten; auf Touch-Geräten übernimmt der Flug-Joystick unten links"
                      : isPedestrianMode
                        ? "Drag the desktop look pad or hold the arrow buttons; on touch devices use the bottom-left walking joystick, and double-tap it for sprint"
                        : "Drag the desktop orbit pad or hold the arrow buttons; on touch devices use the bottom-left flight joystick"}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>
                  <kbd>+</kbd> <kbd>=</kbd> <kbd>−</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Vergrößern / verkleinern"
                    : "Zoom in / out"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>Home</kbd> <kbd>0</kbd>
                </dt>
                <dd>
                  {language === "de" ? "Gesamtansicht zeigen" : "Show overview"}
                </dd>
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
                  {language === "de"
                    ? "Diese Hilfe ein- / ausblenden"
                    : "Toggle this help"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>D</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Tag- / Nachtbeleuchtung umschalten"
                    : "Toggle day / night lighting"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>M</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Minecraft-Modus ein- / ausschalten"
                    : "Toggle Minecraft mode"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>S</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Schneesturm ein- / ausschalten"
                    : "Toggle the snowstorm"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>F</kbd>
                </dt>
                <dd>
                  {isFullscreen || isPseudoFullscreen
                    ? copy.fullscreenExit
                    : copy.fullscreenEnter}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>N</kbd>
                </dt>
                <dd>
                  {language === "de"
                    ? "Licht an / aus im Nachtmodus (Mondlicht)"
                    : "Toggle lights on / off in night mode (moonlight)"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>R</kbd>
                </dt>
                <dd>{copy.resetView}</dd>
              </div>
              <div>
                <dt>
                  <kbd>B</kbd>
                </dt>
                <dd>{isMusicEnabled ? copy.musicOff : copy.musicOn}</dd>
              </div>
              <div>
                <dt>
                  <kbd>T</kbd>
                </dt>
                <dd>{copy.soundtrackShortcut}</dd>
              </div>
              <div>
                <dt>
                  <kbd>P</kbd>
                </dt>
                <dd>{copy.pedestrian}</dd>
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
                ? isPedestrianMode
                  ? language === "de"
                    ? "Spaziergang: Mit Maus oder einem Finger ziehen, um den Kopf zu bewegen. Der Geh-Joystick bewegt; der Sprungknopf oder die Leertaste springt. Flug, Zoom und Untersicht sind gesperrt. Wasser setzt dich am Pariser Platz wieder ab."
                    : "Walk: drag with the mouse or one finger to move your head. The walking pad moves; the jump button or Space jumps. Flight, zoom, and underside are locked. Water returns you to Pariser Platz."
                  : language === "de"
                    ? "3D: Linke Maustaste verschiebt direkt, Mausrad zoomt am Zeiger, rechte Maustaste dreht. Auf dem Trackpad verschiebt Zwei-Finger-Scroll; Pinch zoomt am Fingermittelpunkt. Auf Touchscreens verschieben zwei Finger per Swipe und zoomen per Pinch; Doppeltipp zoomt ebenfalls an dieser Stelle. Drei Finger steuern Drehung und Neigung bis unter das Gelände."
                    : "3D: Left-drag pans directly, the mouse wheel zooms at the pointer, and right-drag orbits. On a trackpad, two-finger scroll pans and pinch zooms at the finger midpoint. On touchscreens, two fingers swipe to pan and pinch to zoom; double-tap zooms at that point too. Three fingers control orbit and tilt into the underside."
                : language === "de"
                  ? "Detailkarte: ziehen zum Verschieben, Shift + ziehen zum freien Drehen und scrollen zum Zoomen. Zwei Finger verschieben die Karte oder fliegen per Pinch hinein; drehen über die Pfeiltasten-Knöpfe."
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
          aria-label={isAttributionOpen ? copy.dataClose : copy.dataOpen}
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
