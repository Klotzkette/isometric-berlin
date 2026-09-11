import { simulationStartLabel } from "./simulationStartViews";
import { StartupPresentation } from "./StartupPresentation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
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
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  Suspense,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { PedestrianPose, ThreeViewerHandle } from "./ThreeViewer";
import type { NavigationSnapshot } from "./navigationContinuity";
import type { PedestrianMiniMapHandle } from "./PedestrianMiniMap";
import {
  ThreeViewerErrorBoundary,
  ThreeViewerLoadErrorFallback,
} from "./ThreeViewerErrorBoundary";
import { PedestrianMiniMap } from "./PedestrianMiniMap";
import {
  AmbientSoundscape,
  isAmbientAudioSupported,
} from "./AmbientSoundscape";
import { DuskChiptune, isChiptuneSupported } from "./DuskChiptune";
import {
  SCHWELLENRAUM_ENTER_FADE_SECONDS,
  SchwellenraumSoundscape,
  isSchwellenraumAudioSupported,
  type SchwellenraumMix,
} from "./SchwellenraumSoundscape";
import {
  registerFirstGestureStart,
  registerVisibleAutoplayRetry,
  shouldStopAudioOnToggleTap,
} from "./audioAutostart";
import { registerAudioLifecycle } from "./audioLifecycle";
import {
  browserUsesMobileViewerProfile,
  mobileWorldFamilyChanges,
  threeViewerWorldFamily,
  viewerRuntimeFailureDecision,
} from "./viewerResidency";
import {
  CONTROL_DOCK_SIDE_STORAGE_KEY,
  type ControlDockSide,
  controlDockSideFromStored,
  oppositeControlDockSide,
} from "./controlDock";
import {
  heldNavigationInput,
  heldPedestrianInput,
  holdNavigationKey,
  isPedestrianHighJumpDoubleActivation,
  pedestrianMovementActivation,
} from "./navigationInput";
import bundledLandmarkPayload from "./data/regierungsviertel-landmarks.json";
import {
  isPedestrianJumpKey,
  isReservedBrowserChord,
} from "./keyboardShortcuts";
import {
  beginJoystickTap,
  cancelJoystickTap,
  createJoystickTapState,
  endJoystickTap,
  moveJoystickTap,
  type JoystickPointerSample,
} from "./joystickGestures";
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
  normalizeRotation,
  rotationDistance,
} from "./viewerGestures";
import {
  FEATURED_SIGHT_NAMES,
  featuredSights,
  findSightBySlug,
  nextSimulationStartSight,
  parseViewHash,
  sightSlug,
} from "./viewNavigation";
import {
  loadThreeViewerComponent,
} from "./viewerEngineLoader";

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

function browserStartStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function initialSimulationStart(): { name: string; automatic: boolean } {
  if (typeof window === "undefined") {
    return { name: DEFAULT_FOCUS_LANDMARK, automatic: true };
  }
  const landmarks = (bundledLandmarkPayload as LandmarkPayload).landmarks;
  const explicit = findSightBySlug(
    landmarks,
    parseViewHash(window.location.hash).landmarkSlug,
  );
  return explicit
    ? { name: explicit.name, automatic: false }
    : { name: nextSimulationStartSight(browserStartStorage()), automatic: true };
}

const INITIAL_SIMULATION_START = initialSimulationStart();

type MobileSheet = "compass" | "overflow" | null;

const LazyThreeViewer = lazy(loadThreeViewerComponent);

const CHROME_STORAGE_KEY = "isometric-berlin.chromeHidden";
const COACH_STORAGE_KEY = "isometric-berlin.seenCoachMark";
const MUSIC_MUTED_STORAGE_KEY = "isometric-berlin.musicMuted";

const ATTRIBUTION =
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia · Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)";

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

function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

function cssUrl(path: string): string {
  return `url(${JSON.stringify(path)})`;
}

function resolveCssAssetUrl(path: string): string {
  if (typeof document === "undefined") return path;
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
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
): string {
  const params = new URLSearchParams();
  const orientation = ORIENTATIONS.find((candidate) =>
    isRotationActive(candidate.degrees, rotation),
  );
  params.set("landmark", sightSlug(landmark.name));
  params.set("view", orientation?.short ?? `${Math.round(rotation)}deg`);
  const url = new URL(window.location.href);
  url.hash = "";
  return `${url.toString()}#${params}`;
}

const JOYSTICK_RADIUS_PX = 44;
const JOYSTICK_DEAD_ZONE_PX = 4;

function FlightJoystick({
  disabled,
  label,
  resetKey,
  onJump,
  onInput,
}: {
  disabled: boolean;
  label: string;
  resetKey: string;
  onJump?: () => void;
  onInput: (horizontal: number, vertical: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLSpanElement | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const tapStateRef = useRef(createJoystickTapState());
  const inputRef = useRef(onInput);
  inputRef.current = onInput;
  const jumpEnabled = onJump !== undefined;

  const pointerSample = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): JoystickPointerSample => ({
    at: event.timeStamp,
    button: event.button,
    isPrimary: event.isPrimary,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    x: event.clientX,
    y: event.clientY,
  });

  const applyFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = originRef.current;
      if (!origin) {
        return;
      }
      // Keep the gesture's origin stable when Safari's browser chrome or the
      // safe-area layout moves the pad while the thumb is still down.
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      const length = Math.hypot(dx, dy);
      const scale =
        length > JOYSTICK_RADIUS_PX ? JOYSTICK_RADIUS_PX / length : 1;
      const x = dx * scale;
      const y = dy * scale;
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      const strength = Math.max(0, Math.min(1,
        (length - JOYSTICK_DEAD_ZONE_PX) /
        (JOYSTICK_RADIUS_PX - JOYSTICK_DEAD_ZONE_PX),
      ));
      const inputScale = length > 0 ? strength / length : 0;
      inputRef.current(dx * inputScale, -dy * inputScale);
    },
    [],
  );

  const release = useCallback(() => {
    pointerIdRef.current = null;
    originRef.current = null;
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(0px, 0px)";
    }
    inputRef.current(0, 0);
  }, []);

  useEffect(() => {
    cancelJoystickTap(tapStateRef.current);
    release();
  }, [disabled, resetKey, jumpEnabled, release]);

  useEffect(() => {
    const reset = () => {
      cancelJoystickTap(tapStateRef.current);
      release();
    };
    const visibility = () => {
      if (document.hidden) reset();
    };
    const otherPointer = (event: PointerEvent) => {
      if (!["touch", "pen", "mouse"].includes(event.pointerType)) return;
      if (
        (pointerIdRef.current !== null && pointerIdRef.current !== event.pointerId) ||
        !(event.target instanceof Node && baseRef.current?.contains(event.target))
      ) {
        cancelJoystickTap(tapStateRef.current);
      }
    };
    window.addEventListener("blur", reset);
    window.addEventListener("pointerdown", otherPointer, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("pointerdown", otherPointer, true);
      document.removeEventListener("visibilitychange", visibility);
      cancelJoystickTap(tapStateRef.current);
      pointerIdRef.current = null;
      inputRef.current(0, 0);
    };
  }, [release]);

  return (
    <div
      ref={baseRef}
      className="flight-joystick"
      role="application"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      data-disabled={disabled ? "true" : undefined}
      onPointerDown={(event) => {
        // OrbitControls listens for moves/up on ownerDocument during a canvas
        // gesture. Keep every pad pointer out of that separate camera gesture.
        event.stopPropagation();
        event.preventDefault();
        if (disabled || (event.pointerType === "mouse" && event.button !== 0)) {
          return;
        }
        if (pointerIdRef.current !== null) {
          cancelJoystickTap(tapStateRef.current);
          return;
        }
        event.currentTarget.focus({ preventScroll: true });
        if (jumpEnabled) {
          beginJoystickTap(tapStateRef.current, pointerSample(event));
        }
        pointerIdRef.current = event.pointerId;
        const rect = event.currentTarget.getBoundingClientRect();
        const centreX = rect.left + rect.width / 2;
        const centreY = rect.top + rect.height / 2;
        // Grabbing any part of the visible knob starts neutral. Otherwise a
        // slightly off-centre mouse click already strafed before the drag,
        // and a straight forward drag retained that sideways bias. Touch,
        // pen and mouse now use the same stable grip point. Pressing the
        // surrounding pad still requests its direction immediately.
        const knobWidth = knobRef.current?.getBoundingClientRect().width ?? 40;
        const knobRadius = knobWidth > 0 ? knobWidth / 2 : 20;
        const grabsKnob = Math.hypot(
          event.clientX - centreX, event.clientY - centreY,
        ) <= knobRadius;
        originRef.current = grabsKnob
          ? { x: event.clientX, y: event.clientY }
          : { x: centreX, y: centreY };
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // A rejected capture must never leave movement held after the
          // pointer leaves the pad. The next gesture can start normally.
          cancelJoystickTap(tapStateRef.current);
          release();
          return;
        }
        applyFromEvent(event);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (pointerIdRef.current !== event.pointerId) {
          return;
        }
        if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
          // Recover from a release outside the browser even if pointer-up
          // was lost. Hovering back onto the pad must not keep flying.
          cancelJoystickTap(tapStateRef.current);
          release();
          return;
        }
        moveJoystickTap(tapStateRef.current, pointerSample(event));
        applyFromEvent(event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        if (pointerIdRef.current === event.pointerId) {
          const jump = endJoystickTap(
            tapStateRef.current, pointerSample(event),
            event.pointerType === "mouse" ? "double" : "single",
          );
          release();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (jump) onJump?.();
        }
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        if (pointerIdRef.current === event.pointerId) {
          cancelJoystickTap(tapStateRef.current);
          release();
        }
      }}
      onLostPointerCapture={(event) => {
        event.stopPropagation();
        if (pointerIdRef.current === event.pointerId) {
          cancelJoystickTap(tapStateRef.current);
          release();
        }
      }}
    >
      <span
        ref={knobRef}
        className="flight-joystick-knob"
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

  const ambientSoundscapeRef = useRef<AmbientSoundscape | null>(null);
  const ambientStartAttemptRef = useRef(0);
  const ambientActivatedRef = useRef(false);
  // "Dusk Republic": enabled on every load, but Web Audio starts only from
  // the visitor's first gesture. Turning it off applies to this session.
  const chiptuneRef = useRef<DuskChiptune | null>(null);
  const chiptuneStartAttemptRef = useRef(0);
  const chiptuneActivatedRef = useRef(false);
  const soundtrackIntentRef = useRef(isChiptuneSupported());
  const schwellenraumSoundscapeRef =
    useRef<SchwellenraumSoundscape | null>(null);
  const schwellenraumStartAttemptRef = useRef(0);
  const schwellenraumActivatedRef = useRef(false);
  const schwellenraumMixRef = useRef<SchwellenraumMix>({
    room: !isMusicMutedByUser(),
    score: isChiptuneSupported(),
  });
  const [isSoundtrackEnabled, setIsSoundtrackEnabled] = useState(
    soundtrackIntentRef.current,
  );
  // Intent is on from the first frame; playback waits for user activation.
  // The toggle follows actual sound and never claims to play over silence.
  const [isSoundtrackAudible, setIsSoundtrackAudible] = useState(false);
  const soundtrackAudibleRef = useRef(isSoundtrackAudible);
  soundtrackAudibleRef.current = isSoundtrackAudible;
  const threeViewerRef = useRef<ThreeViewerHandle | null>(null);

  const closeRepositoryButtonRef = useRef<HTMLButtonElement | null>(null);
  const repositoryReturnFocusRef = useRef<HTMLElement | null>(null);

  // Held-key state for continuous pan, flight and orbit.
  const heldFlightKeysRef = useRef(new Set<string>());
  const pedestrianMovementActivationRef = useRef({
    count: 0,
    key: "",
    lastActivationAt: 0,
  });
  const lastPedestrianJumpActivationAtRef = useRef(0);
  const pedestrianSprintLockedRef = useRef(false);
  const pedestrianFastRunLockedRef = useRef(false);
  const initialFocusAppliedRef = useRef(false);

  const landmarkButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const brandRevealTimerRef = useRef<number | null>(null);
  const minecraftSparkTimerRef = useRef<number | null>(null);
  const activeThreeViewerKeyRef = useRef("");
  const retainedNavigationRef = useRef<NavigationSnapshot | null>(null);
  const latestPedestrianPoseRef = useRef<PedestrianPose | null>(null);
  const pedestrianMiniMapRef = useRef<PedestrianMiniMapHandle | null>(null);
  const threeViewerAutoRecoveryUsedRef = useRef(false);
  const threeViewerGenerationRef = useRef(0);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const openingLandmarkRef = useRef<string | null>(
    INITIAL_SIMULATION_START.automatic ? INITIAL_SIMULATION_START.name : null,
  );
  const [selected, setSelected] = useState<string>(INITIAL_SIMULATION_START.name);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const copy = UI_COPY[language];
  const [status, setStatus] = useState(copy.loadingCity);

  const [lightingMode, setLightingMode] =
    useState<VisualMode>(initialLightingMode);
  const lightingModeRef = useRef<VisualMode>(lightingMode);
  // "Licht an/aus": persisted like mute (nightLighting.ts), independent of
  // the visual mode itself. Only night reads it — day/minecraft ignore it
  // entirely, see resolveNightLightsOn.
  const [nightLightsOn, setNightLightsOn] = useState<boolean>(
    isNightLightsOnByUser,
  );
  const [rainEnabled, setRainEnabled] = useState(false);
  // Snowfall has its own preference so switching back to Day/Night/Minecraft/
  // Schwellenraum never turns a previous rain choice into an unexpected
  // shower. Snowstorm
  // keeps its established falling-snow default, but the same weather control
  // can now pause and resume it.
  const [snowfallEnabled, setSnowfallEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  const [isThreeReady, setIsThreeReady] = useState(false);
  const [threeRuntimeError, setThreeRuntimeError] = useState<string | null>(
    null,
  );
  const [threeViewerGeneration, setThreeViewerGeneration] = useState(0);
  const [isThreeUnderside, setIsThreeUnderside] = useState(false);
  const [isPedestrianMode, setIsPedestrianMode] = useState(false);
  const [isPedestrianSprinting, setIsPedestrianSprinting] = useState(false);
  const [isPedestrianFastRunning, setIsPedestrianFastRunning] = useState(false);
  const [threePolarDegrees, setThreePolarDegrees] = useState(58);
  const [rotation, setRotation] = useState(NORTH_UP_ROTATION);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRepositoryOpen, setIsRepositoryOpen] = useState(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState(false);
  const [isMusicAudible, setIsMusicAudible] = useState(false);
  const musicAudibleRef = useRef(isMusicAudible);
  musicAudibleRef.current = isMusicAudible;
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
  const [persistentThreeWorld] = useState(
    () => !browserUsesMobileViewerProfile(),
  );

  const threeViewerFamily = threeViewerWorldFamily(
    lightingMode,
    persistentThreeWorld,
  );
  const threeViewerInstanceKey = `${threeViewerFamily}-${threeViewerGeneration}`;
  activeThreeViewerKeyRef.current = threeViewerInstanceKey;

  const sceneUrl = useMemo(
    () => assetPath("mesh/regierungsviertel/scene.json"),
    [],
  );

  const pedestrianMapUrl = useMemo(
    () => assetPath("dzi/regierungsviertel/pedestrian_map.png"),
    [],
  );
  const startupBackdropUrl = useMemo(
    () =>
      assetPath(
        "dzi/regierungsviertel/startup-map.jpg",
      ),
    [],
  );
  const viewerStaticBackdropStyle = useMemo(
    () =>
      ({
        "--viewer-static-backdrop-image": cssUrl(
          resolveCssAssetUrl(startupBackdropUrl),
        ),
      }) as CSSProperties,
    [startupBackdropUrl],
  );
  const selectedLandmark = useMemo(
    () =>
      landmarks.find((landmark) => landmark.name === selected) ??
      landmarks[0] ??
      null,
    [landmarks, selected],
  );
  const selectedDisplayName = openingLandmarkRef.current === selected
    ? simulationStartLabel(selected)
    : selectedLandmark?.name;
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
  const isReady = isThreeReady;
  const canNavigateLandmarks = isReady && landmarks.length > 0;
  const selectionProgress =
    landmarks.length > 0 && selectedIndex >= 0
      ? ((selectedIndex + 1) / landmarks.length) * 100
      : 0;

  const disablePedestrianMode = useCallback(() => {
    pedestrianSprintLockedRef.current = false;
    pedestrianFastRunLockedRef.current = false;
    pedestrianMovementActivationRef.current = {
      count: 0,
      key: "",
      lastActivationAt: 0,
    };
    setIsPedestrianSprinting(false);
    setIsPedestrianFastRunning(false);
    threeViewerRef.current?.setPedestrianSprint(false);
    threeViewerRef.current?.setPedestrianFastRun(false);
    setIsPedestrianMode(false);
    threeViewerRef.current?.setPedestrianMode(false);
  }, []);

  const handlePedestrianPoseChange = useCallback(
    (pose: PedestrianPose | null) => {
      latestPedestrianPoseRef.current = pose;
      pedestrianMiniMapRef.current?.setPose(pose);
    },
    [],
  );

  const recoverNavigation = useCallback(() => {
    const result = threeViewerRef.current?.recoverPedestrian() ?? "unavailable";
    if (result === "flight") disablePedestrianMode();
    else {
      threeViewerRef.current?.setPedestrianFastRun(pedestrianFastRunLockedRef.current);
      threeViewerRef.current?.setPedestrianSprint(pedestrianSprintLockedRef.current);
    }
    setStatus(language === "de"
      ? result === "flight" ? "Über dem Hindernis · du kannst weiterfliegen"
        : result === "unavailable" ? "Hier ist noch kein freier Ausstieg verfügbar"
          : "Wieder auf freiem Weg · Blickrichtung beibehalten"
      : result === "flight" ? "Above the obstacle · continue flying"
        : result === "unavailable" ? "No clear exit is available here yet"
          : "Back on a clear path · heading preserved");
  }, [disablePedestrianMode, language]);

  const focusLandmark = useCallback(
    (landmark: Landmark, immediate = false, openingView = false) => {
      const shouldMoveImmediately = immediate || prefersReducedMotion();
      if (!openingView) openingLandmarkRef.current = null;
      disablePedestrianMode();
      setSelected(landmark.name);
      setStatus(`${copy.focus}: ${openingView ? simulationStartLabel(landmark.name) : landmarkShortLabel(landmark.name)}`);
      threeViewerRef.current?.focusLandmark(
        landmark.name,
        shouldMoveImmediately,
        openingView,
      );
    },
    [copy.focus, disablePedestrianMode],
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
    lightingModeRef.current = lightingMode;
  }, [lightingMode]);

  useEffect(() => {
    soundtrackIntentRef.current = isSoundtrackEnabled;
  }, [isSoundtrackEnabled]);

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
    schwellenraumStartAttemptRef.current += 1;
    const ambient = ambientSoundscapeRef.current;
    ambientSoundscapeRef.current = null;
    ambientActivatedRef.current = false;
    const chiptune = chiptuneRef.current;
    chiptuneRef.current = null;
    chiptuneActivatedRef.current = false;
    const schwellenraum = schwellenraumSoundscapeRef.current;
    schwellenraumSoundscapeRef.current = null;
    schwellenraumActivatedRef.current = false;
    ambient?.dispose();
    void chiptune?.dispose();
    schwellenraum?.dispose();
  }, []);

  useEffect(() => {
    const unregister = registerAudioLifecycle({
      dispose: disposeAllAudio,
      documentTarget: document,
      resume: () => {
        if (lightingModeRef.current === "schwellenraum") {
          void schwellenraumSoundscapeRef.current?.setSuspended(false);
          return;
        }
        void ambientSoundscapeRef.current?.setSuspended(false);
        void chiptuneRef.current?.setSuspended(false);
      },
      suspend: () => {
        void ambientSoundscapeRef.current?.setSuspended(true);
        void chiptuneRef.current?.setSuspended(true);
        void schwellenraumSoundscapeRef.current?.setSuspended(true);
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

  const suspendStandardAudio = useCallback(
    (fadeSeconds = 0) => {
      if (lightingModeRef.current !== "schwellenraum") {
        return;
      }
      if (fadeSeconds > 0) {
        void ambientSoundscapeRef.current?.fadeToSuspended(fadeSeconds);
        void chiptuneRef.current?.fadeToSuspended(fadeSeconds);
      } else {
        void ambientSoundscapeRef.current?.setSuspended(true);
        void chiptuneRef.current?.setSuspended(true);
      }
    },
    [],
  );

  const startSchwellenraumAudio = useCallback(
    async (
      mix: SchwellenraumMix = schwellenraumMixRef.current,
      options: { silent?: boolean } = {},
    ) => {
      const { silent = false } = options;
      const normalizedMix = {
        room: Boolean(mix.room),
        score: Boolean(mix.score),
      };
      schwellenraumMixRef.current = normalizedMix;
      setIsMusicEnabled(normalizedMix.room);
      soundtrackIntentRef.current = normalizedMix.score;
      setIsSoundtrackEnabled(normalizedMix.score);

      if (!isSchwellenraumAudioSupported()) {
        setIsMusicAudible(false);
        setIsSoundtrackAudible(false);
        suspendStandardAudio();
        if (!silent) {
          setStatus(copy.schwellenraumAudioUnsupported);
        }
        return false;
      }
      if (typeof document !== "undefined" && document.hidden) {
        return false;
      }

      const soundscape =
        schwellenraumSoundscapeRef.current ?? new SchwellenraumSoundscape();
      schwellenraumSoundscapeRef.current = soundscape;
      soundscape.setMix(normalizedMix);
      if (!normalizedMix.room && !normalizedMix.score) {
        schwellenraumStartAttemptRef.current += 1;
        soundscape.stop(0.08);
        setIsMusicAudible(false);
        setIsSoundtrackAudible(false);
        suspendStandardAudio();
        return true;
      }

      if (!silent) {
        setStatus(copy.schwellenraumAudioStarting);
      }
      const attempt = ++schwellenraumStartAttemptRef.current;
      let started = false;
      try {
        started = await soundscape.start();
      } catch {
        started = false;
      }
      if (
        attempt !== schwellenraumStartAttemptRef.current ||
        soundscape !== schwellenraumSoundscapeRef.current ||
        lightingModeRef.current !== "schwellenraum"
      ) {
        return false;
      }

      const audible = started && soundscape.audible;
      schwellenraumActivatedRef.current = audible;
      setIsMusicAudible(audible && normalizedMix.room);
      setIsSoundtrackAudible(audible && normalizedMix.score);
      // Let the quiet replacement establish itself before retiring the
      // standard layers. On an unsupported/blocked start, silence is still a
      // truer fallback than leaking the ordinary soundtrack into this mode.
      suspendStandardAudio(
        started ? SCHWELLENRAUM_ENTER_FADE_SECONDS : 0,
      );
      if (!silent) {
        setStatus(
          started
            ? copy.schwellenraumAudioOn
            : copy.schwellenraumAudioUnsupported,
        );
      }
      return started;
    },
    [
      copy.schwellenraumAudioOn,
      copy.schwellenraumAudioStarting,
      copy.schwellenraumAudioUnsupported,
      suspendStandardAudio,
    ],
  );

  const startMusic = useCallback(
    async (options: { rememberMute?: boolean; silent?: boolean } = {}) => {
      const { rememberMute = true, silent = false } = options;
      if (lightingModeRef.current === "schwellenraum") {
        return false;
      }
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
      // This ref is intentionally mutable across the await above; reset the
      // entry-guard narrowing so TypeScript models the possible mode change.
      const modeChangedToSchwellenraum =
        (lightingModeRef.current as VisualMode) === "schwellenraum";
      if (
        attempt !== ambientStartAttemptRef.current ||
        modeChangedToSchwellenraum
      ) {
        if (ambientSoundscapeRef.current === soundscape) {
          if (failed) {
            soundscape.dispose();
            ambientSoundscapeRef.current = null;
            ambientActivatedRef.current = false;
          } else if (started) {
            void soundscape.setSuspended(true);
          }
        } else if (started) {
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
          ambientActivatedRef.current = false;
        }
      }
      setIsMusicEnabled(started);
      ambientActivatedRef.current = started && soundscape.audible;
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
  // Audibility changes during the first held navigation key. Keep the toggle
  // identity stable so that change cannot tear down the keyboard listeners and
  // clear the held keys. The ref still follows the latest playback state.
  const toggleMusic = useCallback(async () => {
    if (lightingModeRef.current === "schwellenraum") {
      if (shouldStopAudioOnToggleTap(musicAudibleRef.current)) {
        const nextMix = { ...schwellenraumMixRef.current, room: false };
        schwellenraumMixRef.current = nextMix;
        schwellenraumSoundscapeRef.current?.setMix(nextMix);
        setIsMusicEnabled(false);
        setIsMusicAudible(false);
        rememberMusicMuted(true);
        if (!nextMix.score) {
          schwellenraumStartAttemptRef.current += 1;
          schwellenraumSoundscapeRef.current?.stop();
        }
        setStatus(copy.schwellenraumRoomOff);
        return;
      }
      rememberMusicMuted(false);
      const started = await startSchwellenraumAudio(
        { ...schwellenraumMixRef.current, room: true },
        { silent: true },
      );
      if (lightingModeRef.current !== "schwellenraum") {
        return;
      }
      setStatus(
        started
          ? copy.schwellenraumRoomOn
          : copy.schwellenraumAudioUnsupported,
      );
      return;
    }
    if (shouldStopAudioOnToggleTap(musicAudibleRef.current)) {
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
  }, [
    copy.musicOff,
    copy.schwellenraumAudioUnsupported,
    copy.schwellenraumRoomOff,
    copy.schwellenraumRoomOn,
    startMusic,
    startSchwellenraumAudio,
  ]);

  const startSoundtrack = useCallback(
    async (
      options: {
        preserveIntentOnFailure?: boolean;
        silent?: boolean;
      } = {},
    ) => {
      const { preserveIntentOnFailure = false, silent = false } = options;
      if (lightingModeRef.current === "schwellenraum") {
        return false;
      }
      const unsupportedMessage =
        language === "de"
          ? "Soundtrack wird von diesem Browser nicht unterstützt"
          : "Soundtrack is not supported by this browser";
      if (!isChiptuneSupported()) {
        soundtrackIntentRef.current = false;
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
      const modeChangedToSchwellenraum =
        (lightingModeRef.current as VisualMode) === "schwellenraum";
      if (
        attempt !== chiptuneStartAttemptRef.current ||
        modeChangedToSchwellenraum
      ) {
        if (chiptuneRef.current === player) {
          if (failed) {
            await player.dispose();
            chiptuneRef.current = null;
            chiptuneActivatedRef.current = false;
          } else if (started) {
            void player.setSuspended(true);
          }
        } else if (started) {
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
        soundtrackIntentRef.current = started;
        setIsSoundtrackEnabled(started);
      }
      chiptuneActivatedRef.current = started && player.audible;
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
      if (lightingModeRef.current === "schwellenraum") {
        const soundscape = schwellenraumSoundscapeRef.current;
        const mix = soundscape?.currentMix ?? schwellenraumMixRef.current;
        const audible = soundscape?.audible ?? false;
        setIsSoundtrackAudible(audible && mix.score);
        setIsMusicAudible(audible && mix.room);
        return;
      }
      setIsSoundtrackAudible(chiptuneRef.current?.audible ?? false);
      setIsMusicAudible(ambientSoundscapeRef.current?.audible ?? false);
    };
    sync();
    const timer = window.setInterval(sync, 700);
    return () => window.clearInterval(timer);
  }, []);

  // Before user activation, show the pending intent without claiming playback.
  const isSoundtrackWaiting = isSoundtrackEnabled && !isSoundtrackAudible;
  const soundtrackOnLabel = isSoundtrackWaiting
    ? lightingMode === "schwellenraum"
      ? copy.schwellenraumAudioWaiting
      : copy.soundtrackWaiting
    : lightingMode === "schwellenraum"
      ? copy.schwellenraumScoreOn
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
    if (lightingModeRef.current === "schwellenraum") {
      if (shouldStopAudioOnToggleTap(soundtrackAudibleRef.current)) {
        const nextMix = { ...schwellenraumMixRef.current, score: false };
        schwellenraumMixRef.current = nextMix;
        schwellenraumSoundscapeRef.current?.setMix(nextMix);
        soundtrackIntentRef.current = false;
        setIsSoundtrackEnabled(false);
        setIsSoundtrackAudible(false);
        if (!nextMix.room) {
          schwellenraumStartAttemptRef.current += 1;
          schwellenraumSoundscapeRef.current?.stop();
        }
        setStatus(copy.schwellenraumScoreOff);
        return;
      }
      const started = await startSchwellenraumAudio(
        { ...schwellenraumMixRef.current, score: true },
        { silent: true },
      );
      if (lightingModeRef.current !== "schwellenraum") {
        return;
      }
      setStatus(
        started
          ? copy.schwellenraumScoreOn
          : copy.schwellenraumAudioUnsupported,
      );
      return;
    }
    if (shouldStopAudioOnToggleTap(soundtrackAudibleRef.current)) {
      chiptuneStartAttemptRef.current += 1;
      chiptuneRef.current?.stop();
      soundtrackIntentRef.current = false;
      setIsSoundtrackEnabled(false);
      setIsSoundtrackAudible(false);
      setStatus(copy.soundtrackOff);
      return;
    }
    soundtrackIntentRef.current = true;
    setIsSoundtrackEnabled(true);
    await startSoundtrack();
  }, [
    copy.schwellenraumAudioUnsupported,
    copy.schwellenraumScoreOff,
    copy.schwellenraumScoreOn,
    copy.soundtrackOff,
    startSchwellenraumAudio,
    startSoundtrack,
  ]);

  const resumeStandardAudio = useCallback(() => {
    if (lightingModeRef.current === "schwellenraum") {
      return;
    }
    // These start calls are deliberately made in the mode-selection call
    // stack. Both engines reach AudioContext.resume() before their first
    // await, preserving the exit gesture on iOS even when the page opened
    // directly in Schwellenraum and no standard graph exists yet.
    if (!isMusicMutedByUser() && isAmbientAudioSupported()) {
      void startMusic({ rememberMute: false, silent: true });
    } else {
      ambientStartAttemptRef.current += 1;
      ambientSoundscapeRef.current?.stop();
    }
    if (soundtrackIntentRef.current && isChiptuneSupported()) {
      void startSoundtrack({
        preserveIntentOnFailure: true,
        silent: true,
      });
    } else {
      chiptuneStartAttemptRef.current += 1;
      chiptuneRef.current?.stop();
    }
  }, [startMusic, startSoundtrack]);

  // Restore only audio that already played after a user gesture. A fresh
  // page stays silent through focus/pageshow until the first activation below;
  // even creating a suspended AudioContext on mount can trigger a warning.
  useEffect(() => {
    const unregisterAmbient = registerVisibleAutoplayRetry({
      documentTarget: document,
      isActivated: () => ambientActivatedRef.current,
      isAudible: () => ambientSoundscapeRef.current?.audible ?? false,
      isEnabled: () =>
        lightingModeRef.current !== "schwellenraum" &&
        !isMusicMutedByUser() &&
        isAmbientAudioSupported(),
      start: () => startMusic({ rememberMute: false, silent: true }),
      windowTarget: window,
    });
    const unregisterSoundtrack = registerVisibleAutoplayRetry({
      documentTarget: document,
      isActivated: () => chiptuneActivatedRef.current,
      isAudible: () => chiptuneRef.current?.audible ?? false,
      isEnabled: () =>
        lightingModeRef.current !== "schwellenraum" && isSoundtrackEnabled,
      start: () =>
        startSoundtrack({ preserveIntentOnFailure: true, silent: true }),
      windowTarget: window,
    });
    const unregisterSchwellenraum = registerVisibleAutoplayRetry({
      documentTarget: document,
      isActivated: () => schwellenraumActivatedRef.current,
      isAudible: () => schwellenraumSoundscapeRef.current?.audible ?? false,
      isEnabled: () => {
        const mix = schwellenraumMixRef.current;
        return (
          lightingModeRef.current === "schwellenraum" &&
          (mix.room || mix.score) &&
          isSchwellenraumAudioSupported()
        );
      },
      start: () =>
        startSchwellenraumAudio(schwellenraumMixRef.current, { silent: true }),
      windowTarget: window,
    });
    return () => {
      unregisterAmbient();
      unregisterSoundtrack();
      unregisterSchwellenraum();
    };
  }, [
    isSoundtrackEnabled,
    startMusic,
    startSchwellenraumAudio,
    startSoundtrack,
  ]);

  // Build and start audio synchronously on the first browser activation.
  // Capture listeners also see map gestures whose handlers stop propagation.
  useEffect(() => {
    if (typeof window === "undefined" || !isAmbientAudioSupported()) {
      return;
    }
    return registerFirstGestureStart({
      isMuted: () =>
        lightingModeRef.current === "schwellenraum" || isMusicMutedByUser(),
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
      isMuted: () =>
        lightingModeRef.current === "schwellenraum" || !isSoundtrackEnabled,
      start: () =>
        startSoundtrack({ preserveIntentOnFailure: true, silent: true }),
      target: window,
    });
  }, [isSoundtrackEnabled, startSoundtrack]);

  useEffect(() => {
    if (typeof window === "undefined" || !isSchwellenraumAudioSupported()) {
      return;
    }
    return registerFirstGestureStart({
      isMuted: () => {
        const mix = schwellenraumMixRef.current;
        return (
          lightingModeRef.current !== "schwellenraum" ||
          (!mix.room && !mix.score)
        );
      },
      start: () =>
        startSchwellenraumAudio(schwellenraumMixRef.current, { silent: true }),
      target: window,
    });
  }, [startSchwellenraumAudio]);

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
      window.sessionStorage.setItem("isometric-berlin.attributionSeen", "true");
    } catch {
      // Source attribution remains visible when session storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (isCompactLayout && (isLandmarkRailOpen || mobileSheet !== null)) {
      setIsAttributionOpen(false);
    }
  }, [isCompactLayout, isLandmarkRailOpen, mobileSheet]);

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

  useEffect(() => {
    if (!isPedestrianMode) {
      latestPedestrianPoseRef.current = null;
      pedestrianMiniMapRef.current?.setPose(null);
    }
  }, [isPedestrianMode]);

  const applyRotation = useCallback((degrees: number) => {
    const next = normalizeRotation(degrees);
    threeViewerRef.current?.setAzimuth(threeAzimuthForMapRotation(next));
    setRotation(next);
  }, []);

  const rotateBy = useCallback((delta: number) => {
    threeViewerRef.current?.rotateBy(delta);
  }, []);

  const showOppositeView = useCallback(() => {
    threeViewerRef.current?.rotateBy(180);
    setStatus(language === "de" ? "3D-Gegenansicht" : "Opposite 3D view");
  }, [language]);

  const toggleUnderside = useCallback(() => {
    disablePedestrianMode();
    const next = !isThreeUnderside;
    setIsThreeUnderside(next);
    threeViewerRef.current?.setUnderside(next);
    setStatus(next
      ? language === "de"
        ? "Untergrundübersicht · Bahn und Straßentunnel sichtbar"
        : "Underground overview · rail and road tunnels visible"
      : language === "de" ? "3D-Oberansicht" : "3D surface view");
  }, [disablePedestrianMode, isThreeUnderside, language]);

  const resetOrientation = useCallback(() => {
    disablePedestrianMode();
    threeViewerRef.current?.reset();
    setRotation(NORTH_UP_ROTATION);
    setIsThreeUnderside(false);
    setThreePolarDegrees(58);
    setStatus(language === "de" ? "3D-Gesamtansicht" : "3D overview");
  }, [disablePedestrianMode, language]);

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
      if (enabled) {
        pedestrianFastRunLockedRef.current = false;
      }
      setIsPedestrianSprinting(enabled);
      setIsPedestrianFastRunning(false);
      threeViewerRef.current?.setPedestrianSprint(enabled);
      threeViewerRef.current?.setPedestrianFastRun(false);
      if (announce) {
        setStatus(enabled ? copy.pedestrianSprintOn : copy.pedestrianSprintOff);
      }
    },
    [copy.pedestrianSprintOff, copy.pedestrianSprintOn],
  );

  const togglePedestrianSprint = useCallback(() => {
    const nextLocked = !pedestrianSprintLockedRef.current;
    pedestrianSprintLockedRef.current = nextLocked;
    pedestrianFastRunLockedRef.current = false;
    const heldSprint = heldFlightKeysRef.current.has("Shift");
    applyPedestrianSprint(nextLocked || heldSprint, true);
  }, [applyPedestrianSprint]);

  const togglePedestrianFastRun = useCallback(() => {
    const nextLocked = !pedestrianFastRunLockedRef.current;
    pedestrianFastRunLockedRef.current = nextLocked;
    pedestrianSprintLockedRef.current = false;
    const heldSprint = heldFlightKeysRef.current.has("Shift");
    setIsPedestrianFastRunning(nextLocked);
    setIsPedestrianSprinting(!nextLocked && heldSprint);
    threeViewerRef.current?.setPedestrianFastRun(nextLocked);
    threeViewerRef.current?.setPedestrianSprint(!nextLocked && heldSprint);
    setStatus(
      nextLocked ? copy.pedestrianFastRunOn : copy.pedestrianFastRunOff,
    );
  }, [copy.pedestrianFastRunOff, copy.pedestrianFastRunOn]);

  const triggerPedestrianJump = useCallback((higher = false) => {
    const jumped = threeViewerRef.current?.jumpPedestrian(higher) ?? false;
    if (jumped) {
      setStatus(higher ? copy.pedestrianHighJump : copy.pedestrianJump);
    }
    return jumped;
  }, [copy.pedestrianHighJump, copy.pedestrianJump]);

  const zoomBy = useCallback((factor: number) => {
    threeViewerRef.current?.zoomBy(factor);
  }, []);

  const goHome = useCallback(() => {
    disablePedestrianMode();
    threeViewerRef.current?.reset();
    setRotation(NORTH_UP_ROTATION);
    setIsThreeUnderside(false);
  }, [disablePedestrianMode]);

  const tiltBy = useCallback((degrees: number) => {
    threeViewerRef.current?.tiltBy(degrees);
  }, []);

  const copyViewLink = useCallback(async () => {
    if (!selectedLandmark) {
      return;
    }
    const url = viewUrlFor(selectedLandmark, rotation);
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
  }, [language, rotation, selectedLandmark]);

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
      const previous = lightingModeRef.current;
      lightingModeRef.current = next;
      const changesMobileWorldFamily = mobileWorldFamilyChanges(
        previous,
        next,
        persistentThreeWorld,
      );
      if (changesMobileWorldFamily) {
        // Keep only numeric navigation data: the previous world and WebGL
        // context are still fully released on phones. During rapid switches
        // retain the last valid pose rather than a half-built default camera.
        retainedNavigationRef.current =
          threeViewerRef.current?.captureNavigation() ?? retainedNavigationRef.current;
        // React unmounts the previous ThreeViewer before constructing the new
        // family, releasing its scene, parsed payloads and WebGL context. A
        // phone therefore never retains the full drawn and voxel worlds at
        // the same time. Browser cache still avoids repeat network transfer.
        setIsThreeReady(false);
        setThreeRuntimeError(null);
        threeViewerAutoRecoveryUsedRef.current = false;
      }
      if (next === "schwellenraum" && previous !== "schwellenraum") {
        // Invalidate any normal-layer start that was still waiting for the
        // browser when this mode-selection gesture arrived. Its post-await
        // guard will silence the stale graph without changing the user's two
        // retained bus intentions.
        ambientStartAttemptRef.current += 1;
        chiptuneStartAttemptRef.current += 1;
        const mix = {
          room: !isMusicMutedByUser(),
          score: soundtrackIntentRef.current,
        };
        schwellenraumMixRef.current = mix;
        // This call reaches AudioContext.resume() synchronously inside the
        // mode-button gesture; its long fade then hands over from the two
        // ordinary layers without a click or a silence gap.
        void startSchwellenraumAudio(mix, { silent: true });
      } else if (
        previous === "schwellenraum" &&
        next !== "schwellenraum"
      ) {
        schwellenraumStartAttemptRef.current += 1;
        schwellenraumSoundscapeRef.current?.stop();
        resumeStandardAudio();
      }
      setLightingMode(next);
      if (isPedestrianMode) {
        threeViewerRef.current?.focusNavigation();
      }
      setStatus(
        next === "minecraft"
          ? `${copy.minecraft} · Premium Voxel`
          : next === "night"
            ? copy.night
            : next === "snowstorm"
              ? copy.snowstorm
              : next === "schwellenraum"
                ? copy.schwellenraum
                : copy.day,
      );
    },
    [
      copy,
      isPedestrianMode,
      persistentThreeWorld,
      resumeStandardAudio,
      startSchwellenraumAudio,
    ],
  );

  const resetToDefaultView = useCallback(() => {
    disablePedestrianMode();
    const target = resolveResetView();
    selectVisualMode(target.lightingMode);
    retainedNavigationRef.current = null;
    setRotation(target.rotationDegrees);
    setIsThreeUnderside(target.isUnderside);
    setThreePolarDegrees(58);
    threeViewerRef.current?.reset();

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
  ]);

  const toggleMinecraftMode = useCallback(() => {
    const next: VisualMode = lightingMode === "minecraft" ? "day" : "minecraft";
    selectVisualMode(next);
  }, [lightingMode, selectVisualMode]);

  const togglePedestrianMode = useCallback(() => {
    const next = !isPedestrianMode;
    pedestrianSprintLockedRef.current = false;
    pedestrianFastRunLockedRef.current = false;
    pedestrianMovementActivationRef.current = {
      count: 0,
      key: "",
      lastActivationAt: 0,
    };
    lastPedestrianJumpActivationAtRef.current = 0;
    applyPedestrianSprint(false);
    heldFlightKeysRef.current.clear();
    setFlightInput(0, 0, 0);
    setPanInput(0, 0);
    setOrbitInput(0, 0);
    setIsTouring(false);
    setMobileSheet(null);
    setIsPedestrianMode(next);
    if (next) {

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
    if (lightingMode === "schwellenraum") {
      setStatus(copy.schwellenraumWeatherStatic);
      return;
    }
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
    copy.schwellenraumWeatherStatic,
    copy.snowfallActive,
    copy.snowfallInactive,
    lightingMode,
  ]);

  const reloadAfterThreeViewerFailure = useCallback(() => {
    window.location.reload();
  }, []);

  const handleThreeViewerRuntimeError = useCallback(
    (message: string, failedInstanceKey: string) => {
      if (activeThreeViewerKeyRef.current !== failedInstanceKey) {
        return;
      }
      console.error(`Isometric Berlin 3D: ${message}`);
      const navigation = threeViewerRef.current?.captureNavigation() ?? retainedNavigationRef.current;
      retainedNavigationRef.current = navigation;
      setIsPedestrianMode(navigation?.pedestrian.requested ?? false);
      setIsThreeReady(false);
      setIsThreeUnderside(navigation?.underside ?? false);

      // A lost mobile context commonly recovers once the old canvas and all
      // of its CPU/GPU allocations are actually destroyed. Remount exactly
      // once per world family; a persistent failure offers an explicit reload.
      if (
        viewerRuntimeFailureDecision(
          threeViewerAutoRecoveryUsedRef.current,
        ) === "restart-clean"
      ) {
        threeViewerAutoRecoveryUsedRef.current = true;
        // The snapshot contains only navigation data, never the failed scene.
        // Do not let the ordinary opening-focus effect overwrite its pose.
        initialFocusAppliedRef.current = navigation !== null;
        if (!navigation) {
          const nextStart = nextSimulationStartSight(browserStartStorage());
          openingLandmarkRef.current = nextStart;
          setSelected(nextStart);
        }
        threeViewerGenerationRef.current += 1;
        setThreeViewerGeneration(threeViewerGenerationRef.current);
        setThreeRuntimeError(null);
        setStatus(
          language === "de"
            ? "3D wird speicherschonend neu gestartet"
            : "Restarting 3D with a clean memory state",
        );
        return;
      }

      setThreeRuntimeError(message);
      setStatus(
        `${language === "de" ? "3D nicht verfügbar" : "3D unavailable"}: ${message}`,
      );
    },
    [language],
  );

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

  const openRepository = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      repositoryReturnFocusRef.current = document.activeElement;
    }
    setIsTouring(false);
    setMobileSheet(null);
    setIsHelpOpen(false);

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
        applyRotation(hashRotation);
      }
      // Apply the shared compass orientation first. A landmark may own a precise
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
      "Space",
      "w",
      "a",
      "s",
      "d",
      "q",
      "e",
    ];
    const navigationKey = (event: KeyboardEvent): string =>
      isPedestrianJumpKey(event)
        ? "Space"
        : event.key.length === 1
          ? event.key.toLowerCase()
          : event.key;
    const updateHeldNavigation = () => {
      if (isPedestrianMode) {
        const input = heldPedestrianInput(heldFlightKeysRef.current);
        const fastRun = pedestrianFastRunLockedRef.current;
        const sprint =
          !fastRun && (input.sprint || pedestrianSprintLockedRef.current);
        setPanInput(0, 0);
        setFlightInput(input.strafe, input.forward, 0);
        setOrbitInput(input.turn, input.look);
        threeViewerRef.current?.setPedestrianFastRun(fastRun);
        threeViewerRef.current?.setPedestrianSprint(sprint);
        setIsPedestrianFastRunning(fastRun);
        setIsPedestrianSprinting(sprint);
        return;
      }
      const { flight, orbit, pan } = heldNavigationInput(
        heldFlightKeysRef.current,
      );
      setPanInput(pan.horizontal, pan.vertical);
      setFlightInput(flight.strafe, flight.forward, flight.vertical);
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
          (event.key === "Enter" || isPedestrianJumpKey(event))
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
        !isHelpOpen &&
        !isRepositoryOpen &&
        isReady
      ) {
        if (isPedestrianJumpKey(event)) {
          event.preventDefault();
          if (!event.repeat) {
            const now = performance.now();
            const higher = isPedestrianHighJumpDoubleActivation(
              lastPedestrianJumpActivationAtRef.current,
              now,
            );
            lastPedestrianJumpActivationAtRef.current = higher ? 0 : now;
            triggerPedestrianJump(higher);
          }
          return;
        }
        const key = navigationKey(event);
        if (key === "Shift") {
          event.preventDefault();
          const changed = holdNavigationKey(heldFlightKeysRef.current, key);
          if (!event.repeat) {
            setStatus(copy.pedestrianSprintOn);
          }
          if (changed) updateHeldNavigation();
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
          let changed = false;
          if (event.shiftKey) {
            changed = holdNavigationKey(heldFlightKeysRef.current, "Shift");
          } else {
            changed = heldFlightKeysRef.current.delete("Shift");
          }
          let paceToggled = false;
          if (
            !event.repeat &&
            !event.shiftKey &&
            ["w", "a", "s", "d"].includes(key)
          ) {
            const now = performance.now();
            const activation = pedestrianMovementActivation(
              pedestrianMovementActivationRef.current,
              key,
              now,
            );
            pedestrianMovementActivationRef.current = activation;
            if (activation.count === 3) {
              pedestrianMovementActivationRef.current = {
                count: 0,
                key: "",
                lastActivationAt: 0,
              };
              if (!pedestrianFastRunLockedRef.current) {
                togglePedestrianFastRun();
              } else {
                setStatus(copy.pedestrianFastRunOn);
              }
              paceToggled = true;
            } else if (
              activation.count === 2 &&
              key === "w" &&
              !pedestrianFastRunLockedRef.current
            ) {
              togglePedestrianSprint();
              paceToggled = true;
            }
          }
          changed = holdNavigationKey(heldFlightKeysRef.current, key) || changed;
          if (!event.repeat && !paceToggled) {
            setStatus(
              event.shiftKey &&
                ["ArrowLeft", "ArrowRight", "a", "d"].includes(key)
                ? language === "de"
                  ? "Zu Fuß · Blickrichtung drehen"
                  : "On foot · turn the view"
                : language === "de"
                  ? "Zu Fuß · bewegen und umschauen"
                  : "On foot · move and look around",
            );
          }
          if (changed) updateHeldNavigation();
          return;
        }
      }
      if (
        !isHelpOpen &&
        !isRepositoryOpen &&
        isReady
      ) {
        const key = navigationKey(event);
        if (["w", "a", "s", "d", "Shift", "Space"].includes(key)) {
          event.preventDefault();
          let changed = false;
          if (event.shiftKey) {
            changed = holdNavigationKey(heldFlightKeysRef.current, "Shift");
          } else if (key !== "Shift") {
            changed = heldFlightKeysRef.current.delete("Shift");
          }
          changed = holdNavigationKey(heldFlightKeysRef.current, key) || changed;
          if (!event.repeat) {
            setStatus(
              language === "de"
                ? "Schweben · WASD bewegt, Leertaste steigt, Shift sinkt"
                : "Hover · WASD moves, Space rises, Shift descends",
            );
          }
          if (changed) updateHeldNavigation();
          return;
        }
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMinecraftMode();
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
      if (isHelpOpen || isRepositoryOpen || !isReady) {
        return;
      }
      if (
        (event.key === "Shift" || event.key === "Alt") &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some((key) =>
          heldFlightKeysRef.current.has(key),
        )
      ) {
        event.preventDefault();
        if (holdNavigationKey(heldFlightKeysRef.current, event.key)) {
          updateHeldNavigation();
        }
        return;
      }
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        let changed = false;
        if (event.shiftKey) {
          changed = holdNavigationKey(heldFlightKeysRef.current, "Shift");
        } else {
          changed = heldFlightKeysRef.current.delete("Shift");
        }
        if (event.altKey) {
          changed =
            holdNavigationKey(heldFlightKeysRef.current, "Alt") || changed;
        } else {
          changed = heldFlightKeysRef.current.delete("Alt") || changed;
        }
        changed =
          holdNavigationKey(heldFlightKeysRef.current, event.key) || changed;
        if (!event.repeat) {
          setStatus(language === "de"
            ? "Blickrichtung · Pfeil nach oben schaut nach oben"
            : "View direction · Up arrow looks up");
        }
        if (changed) updateHeldNavigation();
        return;
      }
      if (event.key === "Home" || event.key === "0") {
        event.preventDefault();
        goHome();
        setStatus(copy.home);
      } else if (event.key === "PageDown") {
        event.preventDefault();
        setIsTouring(false);
        focusLandmarkByOffset(1);
      } else if (event.key === "PageUp") {
        event.preventDefault();
        setIsTouring(false);
        focusLandmarkByOffset(-1);
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
      const key = navigationKey(event);
      if (NAVIGATION_KEYS.includes(key)) {
        if (heldFlightKeysRef.current.delete(key)) {
          updateHeldNavigation();
        }
      }
    };
    const handleWindowBlur = () => {
      stopHeldNavigation();
      const fastRun = pedestrianFastRunLockedRef.current;
      const sprint = !fastRun && pedestrianSprintLockedRef.current;
      setIsPedestrianFastRunning(fastRun);
      setIsPedestrianSprinting(sprint);
      threeViewerRef.current?.setPedestrianFastRun(fastRun);
      threeViewerRef.current?.setPedestrianSprint(sprint);
    };
    // Handle navigation once before browser defaults scroll the page.
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
    copy.home,
    copyViewLink,
    focusLandmarkByOffset,
    goHome,
    isHelpOpen,
    isPedestrianMode,
    isReady,
    isRepositoryOpen,
    language,
    resetToDefaultView,
    rotateBy,
    setFlightInput,
    setOrbitInput,
    setPanInput,
    toggleTour,
    toggleMinecraftMode,
    toggleFullscreen,
    toggleMusic,
    toggleNightLights,
    togglePedestrianMode,
    togglePedestrianFastRun,
    togglePedestrianSprint,
    toggleSoundtrack,
    triggerPedestrianJump,
    zoomBy,
  ]);

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
    // A gesture in the city means the user took over — stop teleporting.
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

  // Apply the selected opening view once the 3D scene can accept navigation.
  useEffect(() => {
    if (
      !isReady ||
      isPedestrianMode ||
      landmarks.length === 0 ||
      initialFocusAppliedRef.current
    ) {
      return;
    }
    initialFocusAppliedRef.current = true;
    const landmark = selectedLandmark ?? landmarks[0];
    focusLandmark(landmark, true, openingLandmarkRef.current === landmark.name);
  }, [
    focusLandmark,
    isPedestrianMode,
    isReady,
    landmarks,
    selectedLandmark,
  ]);

  const schwellenraumMode = lightingMode === "schwellenraum";
  const snowfallMode = lightingMode === "snowstorm";
  const precipitationEnabled = schwellenraumMode
    ? false
    : snowfallMode
      ? snowfallEnabled
      : rainEnabled;
  const precipitationOnLabel = snowfallMode ? copy.snowfallOn : copy.rainOn;
  const precipitationOffLabel = snowfallMode ? copy.snowfallOff : copy.rainOff;
  const precipitationLabel = snowfallMode ? copy.snowfall : copy.rain;
  const musicOnLabel = schwellenraumMode
    ? copy.schwellenraumRoomOn
    : copy.musicOn;
  const musicOffLabel = schwellenraumMode
    ? copy.schwellenraumRoomOff
    : copy.musicOff;
  const soundtrackOffLabel = schwellenraumMode
    ? copy.schwellenraumScoreOff
    : copy.soundtrackOff;
  const soundtrackName = schwellenraumMode
    ? copy.schwellenraumSound
    : copy.soundtrack;

  return (
    <main
      ref={appShellRef}
      className={[
        "app-shell",
        isTouring ? "app-shell--touring" : "",
        `app-shell--${lightingMode}`,
        "app-shell--viewer-three",
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
        data-viewer-mode="three"
        style={viewerStaticBackdropStyle}
        aria-label={
          language === "de"
            ? "Isometrisches Berlin"
            : "Isometric Berlin"
        }
      >
        <div className="viewer-static-backdrop" aria-hidden="true" />

        {threeRuntimeError ? (
            <ThreeViewerLoadErrorFallback
              detail={copy.threeLoadErrorDetail}
              message={copy.threeLoadError}
              reloadLabel={copy.reloadPage}
              onReload={reloadAfterThreeViewerFailure}
            />
          ) : (
          <ThreeViewerErrorBoundary
            key={threeViewerInstanceKey}
            detail={copy.threeLoadErrorDetail}
            message={copy.threeLoadError}
            reloadLabel={copy.reloadPage}
            onReload={reloadAfterThreeViewerFailure}
          >
            <Suspense
              fallback={
                <div
                  className="three-viewer is-active"
                >
                  <StartupPresentation
                    label={copy.loadingCity}
                    percentage={0}
                    showBackdrop
                  />
                </div>
              }
            >
              <LazyThreeViewer
                ref={threeViewerRef}
                active
                canvasAriaLabel={
                  isPedestrianMode ? copy.pedestrianCanvas : copy.threeD
                }
                lightingMode={lightingMode}
                nightLightsOn={resolveNightLightsOn(
                  lightingMode,
                  nightLightsOn,
                )}
                pedestrianMode={isPedestrianMode}
                precipitationEnabled={precipitationEnabled}
                progressLabel={copy.loadingCity}
                sceneUrl={sceneUrl}
                selectedLandmark={selected}
                openingLandmark={openingLandmarkRef.current}
                initialNavigation={retainedNavigationRef.current}
                onReady={() => {
                  if (
                    activeThreeViewerKeyRef.current !==
                    threeViewerInstanceKey
                  ) {
                    return;
                  }
                  setIsThreeReady(true);
                  // The mounted viewer owns its restored copy now. A later
                  // reset or error remount must not reuse it.
                  retainedNavigationRef.current = null;
                  threeViewerRef.current?.setPedestrianFastRun(pedestrianFastRunLockedRef.current);
                  threeViewerRef.current?.setPedestrianSprint(pedestrianSprintLockedRef.current);
                  setThreeRuntimeError(null);
                  setStatus(
                    language === "de"
                      ? "Isometrische Ansicht bereit"
                      : "Isometric view ready",
                  );
                }}
                onError={(message) => {
                  handleThreeViewerRuntimeError(
                    message,
                    threeViewerInstanceKey,
                  );
                }}
                onPedestrianPoseChange={handlePedestrianPoseChange}
                onPedestrianRespawn={() => {
                  setStatus(
                    language === "de"
                      ? "Wasser ist nicht begehbar · am Ufer geblieben"
                      : "Water is not walkable · remained at the shoreline",
                  );
                }}
                onWarning={(message) => {
                  setStatus(
                    `${language === "de" ? "3D-Hinweis" : "3D notice"}: ${message}`,
                  );
                }}
                onViewChange={({
                  azimuthDegrees,
                  polarDegrees,
                  underside,
                }) => {
                  setRotation(mapRotationForThreeAzimuth(azimuthDegrees));
                  setThreePolarDegrees(polarDegrees);
                  setIsThreeUnderside(underside);
                }}
              />
            </Suspense>
          </ThreeViewerErrorBoundary>
          )}
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
                : landmarkShortLabel(selectedDisplayName ?? status)}
            </strong>
            <small>
              {selectedIndex >= 0 ? selectedIndex + 1 : 1}/
              {landmarks.length || 1}
              {" · 3D"}
              {isPedestrianMode
                ? language === "de"
                  ? " · Zu Fuß"
                  : " · Walk"
                : ""}
              {lightingMode === "minecraft" ? " · Voxel" : ""}
              {lightingMode === "snowstorm" ? " · Snow" : ""}
              {lightingMode === "schwellenraum" ? " · Schwellenraum" : ""}
            </small>
          </span>
        </button>
        <div className="toolbar" aria-label={copy.controls}>
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
            <button
              type="button"
              aria-label={copy.schwellenraum}
              aria-pressed={lightingMode === "schwellenraum"}
              title={copy.schwellenraum}
              onClick={() => selectVisualMode("schwellenraum")}
            >
              <Sparkles size={18} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="weather-toggle"
            aria-label={
              schwellenraumMode
                ? copy.schwellenraumWeatherStatic
                : precipitationEnabled
                ? precipitationOffLabel
                : precipitationOnLabel
            }
            aria-pressed={precipitationEnabled}
            title={
              schwellenraumMode
                ? copy.schwellenraumWeatherStatic
                : precipitationEnabled
                ? precipitationOffLabel
                : precipitationOnLabel
            }
            disabled={schwellenraumMode}
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
            aria-label={isMusicAudible ? musicOffLabel : musicOnLabel}
            aria-pressed={isMusicAudible}
            title={`${isMusicAudible ? musicOffLabel : musicOnLabel} (B)`}
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
              isSoundtrackAudible ? soundtrackOffLabel : soundtrackOnLabel
            }
            aria-pressed={isSoundtrackAudible}
            className={`soundtrack-toggle${
              isSoundtrackAudible ? " is-active" : ""
            }${isSoundtrackWaiting ? " is-waiting" : ""}`}
            title={`${
              isSoundtrackAudible ? soundtrackOffLabel : soundtrackOnLabel
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

      <button
        type="button"
        className="mobile-overflow"
        aria-label={copy.moreActions}
        aria-expanded={mobileSheet === "overflow"}
        aria-haspopup="dialog"
        aria-controls="mobile-actions"
        title={copy.moreActions}
        onClick={() => {
          setIsChromeHidden(false);
          setMobileSheet((current) => current === "overflow" ? null : "overflow");
        }}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
        <span>{copy.mode}</span>
      </button>

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

      {!isChromeHidden ? (
        <div className="flight-joystick-wrap">
          <FlightJoystick
            disabled={!isReady}
            resetKey={lightingMode}
            label={
              isPedestrianMode
                ? language === "de"
                  ? "Geh-Joystick: ziehen zum Laufen; kurz tippen oder mit der Maus doppelklicken zum Springen. Leertaste springt ebenfalls"
                  : "Walking joystick: drag to move; tap or mouse double-click to jump. Space also jumps"
                : language === "de"
                  ? "Flug-Joystick: ziehen zum Vorwärts-, Rückwärts- und Seitwärtsfliegen"
                  : "Flight joystick: drag to fly forward, backward or sideways"
            }
            onJump={
              isPedestrianMode ? () => triggerPedestrianJump() : undefined
            }
            onInput={(strafe, forward) => setFlightInput(strafe, forward, 0)}
          />
        </div>
      ) : null}

      {isPedestrianMode && !isChromeHidden ? (
        <PedestrianMiniMap
          ref={pedestrianMiniMapRef}
          imageUrl={pedestrianMapUrl}
          initialPose={latestPedestrianPoseRef.current}
          language={language}
          northUpRotation={NORTH_UP_ROTATION}
          onOrientationChange={applyRotation}
          orientationDegrees={rotation}
          orientations={ORIENTATIONS.map((candidate) => ({
            degrees: candidate.degrees,
            label: orientationLabel(candidate.short, language),
            short: candidate.short,
          }))}
        />
      ) : null}

      {isPedestrianMode && !isChromeHidden ? (
        <button
          type="button"
          className="pedestrian-jump-button"
          aria-label={copy.pedestrianJump}
          title={`${copy.pedestrianJump} (Space · ${
            language === "de" ? "Tipp / Doppelklick" : "tap / double-click"
          })`}
          onClick={() => triggerPedestrianJump()}
        >
          <ArrowUpFromLine size={22} aria-hidden="true" />
        </button>
      ) : null}

      {!isChromeHidden && !(isCompactLayout && isAttributionOpen) &&
        (isPedestrianMode || lightingMode === "minecraft" || lightingMode === "schwellenraum") ? (
        <button
          type="button"
          className="navigation-recovery-button"
          disabled={!isReady}
          onClick={recoverNavigation}
          title={language === "de" ? "Einen freien Weg in der Nähe finden" : "Find a clear way out nearby"}
        >
          {language === "de" ? "Freikommen" : "Get unstuck"}
        </button>
      ) : null}

      <aside className="orientation-pill" aria-label={copy.orientation}>
        <Compass aria-hidden="true" size={16} />
        <span>
          {isPedestrianMode
              ? isPedestrianFastRunning
                ? "8×"
                : isPedestrianSprinting
                  ? "4×"
                : language === "de"
                  ? "1,80 m"
                  : "1.80 m"
              : `${Math.round(threePolarDegrees)}°`}
        </span>
        <small>
          {isPedestrianMode
              ? `${copy.pedestrian} · ${
                  isPedestrianFastRunning
                    ? copy.pedestrianFastRun
                    : isPedestrianSprinting
                      ? copy.pedestrianSprint
                    : language === "de"
                      ? "1,80 m"
                      : "1.80 m"
                }`
              : `${orientation ? orientationLabel(orientation.short, language) : copy.freelyRotated} · ${
                  isThreeUnderside ? copy.underside : "3D"
                }`}
        </small>
      </aside>

      <aside className="view-controls" aria-label={copy.alignMove}>
        <div className="desktop-navigation-guide">
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
                    ? "Vorwärts gehen (W), doppelklicken für Sprint"
                    : "Walk forward (W), double-click for sprint"
                  : `${copy.flyForward} (W)`
              }
              onActivate={() => flyForwardBy(0, 1)}
              onDoubleActivate={
                isPedestrianMode ? togglePedestrianSprint : undefined
              }
              onHoldStart={() => setFlightInput(0, 1, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <span aria-hidden="true">W</span>
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
                  : `${copy.flyLeft} (A)`
              }
              onActivate={() => flyForwardBy(-1, 0)}
              onHoldStart={() => setFlightInput(-1, 0, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <span aria-hidden="true">A</span>
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
                    ? "Rückwärts gehen (S)"
                    : "Walk backward (S)"
                  : `${copy.flyBack} (S)`
              }
              onActivate={() => flyForwardBy(0, -1)}
              onHoldStart={() => setFlightInput(0, -1, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <span aria-hidden="true">S</span>
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
                  : `${copy.flyRight} (D)`
              }
              onActivate={() => flyForwardBy(1, 0)}
              onHoldStart={() => setFlightInput(1, 0, 0)}
              onHoldEnd={() => setFlightInput(0, 0, 0)}
            >
              <span aria-hidden="true">D</span>
            </HoldControlButton>
          </div>
          <div className="desktop-navigation-legend">
            <p><kbd>W</kbd> {language === "de" ? "vor" : "forward"} · <kbd>S</kbd> {language === "de" ? "zurück" : "back"}</p>
            <p><kbd>A</kbd> / <kbd>D</kbd> {language === "de" ? "seitwärts" : "strafe left / right"}</p>
            <p><kbd>↑</kbd> / <kbd>↓</kbd> {language === "de" ? "hoch / runter schauen" : "look up / down"}</p>
            <p><kbd>←</kbd> / <kbd>→</kbd> {language === "de" ? "links / rechts schauen" : "look left / right"}</p>
            <p>{language === "de" ? "Maus ziehen: umsehen" : "Mouse drag: look around"}</p>
          </div>
        </div>
        <p className="desktop-height-guide">
          <kbd>{language === "de" ? "Leertaste" : "Space"}</kbd>{" "}
          {isPedestrianMode
            ? language === "de" ? "springen" : "jump"
            : language === "de" ? "steigen" : "rise"}
          {" · "}<kbd>Shift</kbd>{" "}
          {isPedestrianMode
            ? language === "de" ? "sprinten" : "sprint"
            : language === "de" ? "sinken" : "descend"}
        </p>
        <div
          className="control-row"
          role="group"
          aria-label={copy.viewTransform}
        >
          <>
              <HoldControlButton
                ariaLabel={copy.tiltUp}
                disabled={!isReady}
                title={`${copy.tiltUp} (↑)`}
                onActivate={() => tiltBy(10)}
                onHoldStart={() => setOrbitInput(0, 1)}
                onHoldEnd={() => setOrbitInput(0, 0)}
              >
                <ArrowUp size={17} aria-hidden="true" />
              </HoldControlButton>
              <HoldControlButton
                ariaLabel={copy.tiltDown}
                disabled={!isReady}
                title={`${copy.tiltDown} (↓)`}
                onActivate={() => tiltBy(-10)}
                onHoldStart={() => setOrbitInput(0, -1)}
                onHoldEnd={() => setOrbitInput(0, 0)}
              >
                <ArrowDown size={17} aria-hidden="true" />
              </HoldControlButton>
            </>
          <HoldControlButton
            ariaLabel={copy.rotateLeft}
            disabled={!isReady}
            title={`${copy.rotateLeft} (←)`}
            onActivate={() => rotateBy(-15)}
            onHoldStart={() => setOrbitInput(-1, 0)}
            onHoldEnd={() => setOrbitInput(0, 0)}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </HoldControlButton>
          <HoldControlButton
            ariaLabel={copy.rotateRight}
            disabled={!isReady}
            title={`${copy.rotateRight} (→)`}
            onActivate={() => rotateBy(15)}
            onHoldStart={() => setOrbitInput(1, 0)}
            onHoldEnd={() => setOrbitInput(0, 0)}
          >
            <RotateCw size={17} aria-hidden="true" />
          </HoldControlButton>
          <button
            type="button"
            aria-label={
              copy.oppositeView
            }
            aria-pressed={false}
            disabled={!isReady}
            title={
              copy.oppositeView
            }
            onClick={showOppositeView}
          >
            <FlipHorizontal2 size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={
              copy.trueUnderside
            }
            aria-pressed={isThreeUnderside}
            disabled={!isReady || isPedestrianMode}
            title={
              copy.trueUnderside
            }
            onClick={toggleUnderside}
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
            className="dock-side-toggle"
            aria-label={controlDockSide === "left" ? copy.moveControlsRight : copy.moveControlsLeft}
            title={controlDockSide === "left" ? copy.moveControlsRight : copy.moveControlsLeft}
            onClick={toggleControlDockSide}
          >
            {controlDockSide === "left" ? (
              <PanelRight size={16} aria-hidden="true" />
            ) : (
              <PanelLeft size={16} aria-hidden="true" />
            )}
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
        >
          <div className="mobile-sheet-handle" aria-hidden="true" />
          <div
            className="mobile-sheet-title"
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
                copy.flyForward
              }
              disabled={!isReady}
              onClick={() =>
                flyForwardBy(0, 1)
              }
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.flyLeft}
              disabled={!isReady}
              onClick={() =>
                flyForwardBy(-1, 0)
              }
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.flyBack}
              disabled={!isReady}
              onClick={() =>
                flyForwardBy(0, -1)
              }
            >
              <ArrowDown size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.flyRight}
              disabled={!isReady}
              onClick={() =>
                flyForwardBy(1, 0)
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
              aria-label={copy.tiltUp}
              disabled={!isReady}
              onClick={() =>
                tiltBy(8)
              }
            >
              <ChevronUp size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.tiltDown}
              disabled={!isReady}
              onClick={() =>
                tiltBy(-8)
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
              onClick={showOppositeView}
            >
              <FlipHorizontal2 size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={copy.underside}
              aria-pressed={isThreeUnderside}
              disabled={!isReady || isPedestrianMode}
              onClick={toggleUnderside}
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
          id="mobile-actions"
          className="mobile-sheet mobile-overflow-sheet"
          role="dialog"
          aria-label={copy.moreActions}
        >
          <div className="mobile-sheet-handle" aria-hidden="true" />
          <div
            className="mobile-sheet-title"
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
          <div
            className="mobile-visual-mode-grid"
            role="group"
            aria-label={copy.visualModes}
          >
            <button
              type="button"
              aria-pressed={lightingMode === "day"}
              onClick={() => {
                selectVisualMode("day");
                setMobileSheet(null);
              }}
            >
              <Sun size={20} aria-hidden="true" />
              <span>{copy.day}</span>
            </button>
            <button
              type="button"
              aria-pressed={lightingMode === "night"}
              onClick={() => {
                selectVisualMode("night");
                setMobileSheet(null);
              }}
            >
              <Moon size={20} aria-hidden="true" />
              <span>{copy.night}</span>
            </button>
            <button
              type="button"
              aria-pressed={lightingMode === "minecraft"}
              onClick={() => {
                selectVisualMode("minecraft");
                setMobileSheet(null);
              }}
            >
              <MinecraftCubeIcon size={20} />
              <span>{copy.minecraft}</span>
            </button>
            <button
              type="button"
              aria-pressed={lightingMode === "snowstorm"}
              onClick={() => {
                selectVisualMode("snowstorm");
                setMobileSheet(null);
              }}
            >
              <Snowflake size={20} aria-hidden="true" />
              <span>
                {language === "de" ? (
                  <>Schnee<wbr />sturm</>
                ) : copy.snowstorm}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={lightingMode === "schwellenraum"}
              onClick={() => {
                selectVisualMode("schwellenraum");
                setMobileSheet(null);
              }}
            >
              <Sparkles size={20} aria-hidden="true" />
              <span>Schwellen<wbr />raum</span>
            </button>
          </div>
          {supportsNightLightsToggle(lightingMode) ? (
            <button
              type="button"
              className="mobile-light-toggle"
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
              aria-pressed={isPedestrianMode}
              onClick={togglePedestrianMode}
            >
              <Footprints size={20} aria-hidden="true" />
              <span>{copy.pedestrian}</span>
            </button>
            <button
              type="button"
              className="weather-toggle"
              aria-pressed={precipitationEnabled}
              aria-label={
                schwellenraumMode
                  ? copy.schwellenraumWeatherStatic
                  : precipitationEnabled
                  ? precipitationOffLabel
                  : precipitationOnLabel
              }
              disabled={schwellenraumMode}
              onClick={togglePrecipitation}
            >
              {snowfallMode ? (
                <CloudSnow size={20} aria-hidden="true" />
              ) : (
                <CloudRain size={20} aria-hidden="true" />
              )}
              <span>
                {schwellenraumMode
                  ? copy.schwellenraumWeatherStatic
                  : precipitationEnabled
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
              aria-label={isMusicAudible ? musicOffLabel : musicOnLabel}
              onClick={toggleMusic}
            >
              {isMusicAudible ? (
                <Volume2 size={20} aria-hidden="true" />
              ) : (
                <VolumeX size={20} aria-hidden="true" />
              )}
              <span>{isMusicAudible ? musicOffLabel : musicOnLabel}</span>
            </button>
            <button
              type="button"
              data-audio-toggle="soundtrack"
              aria-label={
                isSoundtrackAudible ? soundtrackOffLabel : soundtrackOnLabel
              }
              aria-pressed={isSoundtrackAudible}
              className="soundtrack-toggle"
              onClick={() => {
                setMobileSheet(null);
                void toggleSoundtrack();
              }}
            >
              <Music size={20} aria-hidden="true" />
              <span>{soundtrackName}</span>
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
          <strong>{selectedDisplayName}</strong>
          <small>{roleLabel(selectedLandmark.role, language)}</small>
          <span>
            {selectedIndex >= 0 ? selectedIndex + 1 : 1} / {landmarks.length}
          </span>
          <div className="selection-progress" aria-hidden="true">
            <span style={{ width: `${selectionProgress}%` }} />
          </div>
        </aside>
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
                  {language === "de"
                    ? "↑ schaut nach oben, ↓ nach unten; ← / → schwenkt den Blick nach links / rechts"
                    : "↑ looks up, ↓ looks down; ← / → turns the view left / right"}
                </dd>
              </div>
              <div>
                <dt><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></dt>
                <dd>
                  {language === "de"
                    ? "Gedrückt halten: W vorwärts, S rückwärts, A seitwärts nach links, D seitwärts nach rechts – relativ zur Blickrichtung"
                    : "Hold: W forward, S backward, A strafe left, D strafe right, relative to the view heading"}
                </dd>
              </div>
              <div>
                <dt>{language === "de" ? "Maus ziehen" : "Mouse drag"}</dt>
                <dd>
                  {language === "de"
                    ? "Linke Maustaste halten und ziehen: umsehen; nach oben ziehen schaut nach oben"
                    : "Hold the left mouse button and drag to look around; dragging up looks up"}
                </dd>
              </div>
              <div>
                <dt>
                  <kbd>Alt</kbd>/<kbd>Option</kbd> + <kbd>←</kbd> <kbd>→</kbd>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>
                  {isPedestrianMode
                      ? language === "de"
                        ? "Blickrichtung mit dem Kopf nach links / rechts und oben / unten bewegen"
                        : "Move your head left / right and look up / down"
                      : language === "de"
                        ? "Kamera drehen und stufenlos bis in die Untersicht neigen"
                        : "Orbit and tilt the camera continuously into the underside view"}
                </dd>
              </div>
              {isPedestrianMode ? <div>
                  <dt>
                    <kbd>Shift</kbd> + <kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd>{" "}
                    <kbd>→</kbd>
                  </dt>
                  <dd>
                    {language === "de"
                      ? "Im Spaziergang stufenlos nach links / rechts drehen; Q / E dreht ebenfalls"
                      : "Turn smoothly left / right while walking; Q / E also turn"}
                  </dd>
                </div> : null}
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
                  <kbd>{language === "de" ? "Leertaste" : "Space"}</kbd>
                  {!isPedestrianMode ? <> / <kbd>Shift</kbd></> : null}
                </dt>
                <dd>
                  {language === "de"
                    ? isPedestrianMode
                      ? "Einmal: springen (6,2 m); zweimal schnell: höher springen (10,5 m)"
                      : "Schweben: Leertaste halten zum Steigen, Shift halten zum Sinken – auch mit WASD und Pfeiltasten; wie beim Minecraft-Flug"
                    : isPedestrianMode
                      ? "Once: jump (6.2 m); twice quickly: jump higher (10.5 m)"
                      : "Hover: hold Space to rise, Shift to descend, also while using WASD and arrow keys, like Minecraft flight"}
                </dd>
              </div>
              {isPedestrianMode ? (
                <div>
                  <dt>
                    <kbd>Shift</kbd> / <kbd>W</kbd> <kbd>W</kbd>
                  </dt>
                  <dd>
                    {language === "de"
                      ? "Shift halten oder Vorwärts doppeltippen; mit der Maus geht auch ein Doppelklick auf die 3D-Fläche: Sprint mit vierfacher Geschwindigkeit ein- / ausschalten"
                      : "Hold Shift or double-tap forward; a mouse double-click on the 3D view also toggles four-times sprint speed"}
                  </dd>
                </div>
              ) : null}
              {isPedestrianMode ? (
                <div>
                  <dt>
                    <kbd>W</kbd> <kbd>W</kbd> <kbd>W</kbd>
                  </dt>
                  <dd>
                    {language === "de"
                      ? "Dieselbe WASD-Taste dreimal schnell drücken: Schnelllauf mit achtfacher Geschwindigkeit ein- / ausschalten"
                      : "Press the same WASD key three times quickly: toggle fast run at eight-times speed"}
                  </dd>
                </div>
              ) : null}
              <div>
                  <dt>{language === "de" ? "Steuerkreise" : "Control pads"}</dt>
                  <dd>
                    {language === "de"
                      ? isPedestrianMode
                        ? "Am orangefarbenen Joystick mit Maus oder Finger ziehen: vorwärts, rückwärts und seitwärts gehen. Kurzer Touch-Tipp oder Maus-Doppelklick springt; Leertaste ebenfalls. Im Bild ziehen zum Umsehen"
                        : "Am orangefarbenen Joystick mit Maus oder Finger ziehen: vorwärts, rückwärts und seitwärts fliegen. Die WASD-Knöpfe können ebenfalls gedrückt gehalten werden"
                      : isPedestrianMode
                        ? "Drag the orange joystick with a mouse or finger to walk forward, backward or sideways. A short touch tap or mouse double-click jumps; so does Space. Drag the view to look around"
                        : "Drag the orange joystick with a mouse or finger to fly forward, backward or sideways. The WASD buttons also move continuously while held"}
                  </dd>
                </div>
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
                <dd>{isMusicEnabled ? musicOffLabel : musicOnLabel}</dd>
              </div>
              <div>
                <dt>
                  <kbd>T</kbd>
                </dt>
                <dd>
                  {schwellenraumMode
                    ? copy.schwellenraumScoreShortcut
                    : copy.soundtrackShortcut}
                </dd>
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
                    ? "Hilfe schließen, Tour stoppen"
                    : "Close help and stop the tour"}
                </dd>
              </div>
            </dl>
            <p className="help-hint">
              {isPedestrianMode
                  ? language === "de"
                    ? "Spaziergang: WASD bewegt, Maus oder ein Finger bewegt den Kopf, das Mausrad läuft vor und zurück. Pfeile drehen den Blick: nach oben schaut nach oben. Leertaste springt, zweimal Leertaste springt höher; Sprungknopf, kurzer Joystick-Tipp und Maus-Doppelklick auf den Joystick springen normal. Gebäude, Bäume, Laternen, Mauern und feste Spielgeräte sind solide. Wasser ist eine feste Ufergrenze und setzt dich niemals zurück."
                    : "Walk: WASD moves, the mouse or one finger moves your head, and the mouse wheel walks forward and back. Arrow keys turn the view: Up looks up. Space jumps; double Space jumps higher, while the jump button, a short joystick tap or a mouse double-click on the joystick perform a normal jump. Buildings, trees, lamp posts, walls, and fixed playground equipment are solid. Water is a solid shoreline and never resets your position."
                  : language === "de"
                    ? "3D: W/S fliegt vorwärts/rückwärts, A/D seitwärts nach links/rechts. ↑/↓ schaut nach oben/unten, ←/→ schwenkt nach links/rechts. Leertaste steigt, Shift sinkt, auch während der Bewegung. Das Mausrad zoomt am Zeiger. Mit linker Maustaste ziehen: Blick folgt der Maus, nach oben ist oben. Rechte Maustaste oder Shift + Ziehen verschiebt. Auf Touchscreens verschieben zwei Finger per Swipe und zoomen per Pinch; drei Finger steuern Drehung und Neigung bis unter das Gelände."
                    : "3D: W/S flies forward/backward, A/D strafes left/right. ↑/↓ looks up/down, ←/→ turns left/right. Space rises and Shift descends, also while moving. The mouse wheel zooms at the pointer. Left-drag looks in the drag direction: upward looks up. Right-drag or Shift-drag pans. On touchscreens, two fingers swipe and pinch; three fingers control orbit and tilt into the underside."}
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
          onClick={() => {
            if (isCompactLayout && !isAttributionOpen) {
              setIsLandmarkRailOpen(false);
              setMobileSheet(null);
            }
            setIsAttributionOpen((open) => !open);
          }}
        >
          <Info size={18} aria-hidden="true" />
        </button>
        <span className="attribution-copy">
          <span>
            {ATTRIBUTION}
          </span>
          <span>{status}</span>
        </span>
      </footer>
    </main>
  );
}
