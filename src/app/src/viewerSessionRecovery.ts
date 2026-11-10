import type { NavigationSnapshot } from "./navigationContinuity";
import { PRELOAD_RECOVERY_URL_PARAM } from "./preloadRecovery";
import { isVisualMode, type VisualMode } from "./visualMode";

export const VIEWER_VISIT_HISTORY_KEY = "isometricBerlinViewerVisit";
const CHECKPOINT_INTERVAL_MS = 10_000;
// Match the in-memory navigation trail without importing the renderer.
const MAX_WALKING_CHECKPOINTS = 48;

type Browser = Pick<Window, "history" | "location">;

export type ViewerVisit = {
  mode: VisualMode;
  navigation: NavigationSnapshot | null;
  selected: string | null;
};

function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 10_000_000;
}

function angle(value: unknown): value is number {
  return number(value) && value > 0 && value < 180;
}

function pose(value: unknown): boolean {
  if (!record(value) || !onlyKeys(value, ["position", "target"])) return false;
  const { position, target } = value;
  const point = (v: unknown): v is [number, number, number] =>
    Array.isArray(v) && v.length === 3 && number(v[0]) && number(v[1]) && number(v[2]);
  return point(position) && point(target) && position.some((v, i) => v !== target[i]);
}

function walkingState(value: unknown): boolean {
  return value === null || (record(value) && onlyKeys(value, [
    "descentFromFlight", "grounded", "groundLayer", "groundY", "insideTunnel",
    "jumpOffset", "jumpOriginY", "pitch", "verticalVelocity", "x", "yaw", "z",
  ]) && typeof value.grounded === "boolean" && typeof value.insideTunnel === "boolean"
    && (value.groundLayer === "surface" || value.groundLayer === "tunnel")
    && [value.groundY, value.jumpOffset, value.pitch, value.verticalVelocity, value.x, value.yaw, value.z].every(number)
    && (value.descentFromFlight === undefined || typeof value.descentFromFlight === "boolean")
    && (value.jumpOriginY === undefined || number(value.jumpOriginY)));
}

function validNavigation(value: unknown): value is NavigationSnapshot {
  if (!record(value) || !onlyKeys(value, [
    "pose", "fov", "near", "far", "minDistance", "maxDistance", "focusedCameraFov", "underside", "pedestrian",
  ])) return false;
  const { pedestrian } = value;
  if (!pose(value.pose) || !angle(value.fov) || (value.focusedCameraFov !== null && !angle(value.focusedCameraFov))
    || !number(value.near) || value.near <= 0 || !number(value.far) || value.far <= value.near
    || !number(value.minDistance) || value.minDistance < 0 || !number(value.maxDistance) || value.maxDistance < value.minDistance
    || typeof value.underside !== "boolean" || !record(pedestrian) || !onlyKeys(pedestrian, [
      "enabled", "requested", "state", "savedPose", "savedFov", "savedNear", "savedUnderside", "recoveryHistory",
    ])) return false;
  const { recoveryHistory: history } = pedestrian;
  return typeof pedestrian.enabled === "boolean" && typeof pedestrian.requested === "boolean"
    && (!pedestrian.enabled || (pedestrian.requested && pedestrian.state !== null))
    && walkingState(pedestrian.state) && (pedestrian.savedPose === null || pose(pedestrian.savedPose))
    && angle(pedestrian.savedFov) && number(pedestrian.savedNear) && pedestrian.savedNear > 0
    && typeof pedestrian.savedUnderside === "boolean" && record(history) && onlyKeys(history, ["checkpoints", "lastRecorded"])
    && Array.isArray(history.checkpoints) && history.checkpoints.length <= MAX_WALKING_CHECKPOINTS
    && [...history.checkpoints].every(entry => entry !== null && walkingState(entry)) && walkingState(history.lastRecorded);
}

function entryHref(browser: Browser): string {
  const url = new URL(browser.location.href);
  // The existing guarded Vite reload can mark the same entry in its query.
  url.searchParams.delete(PRELOAD_RECOVERY_URL_PARAM);
  return url.href;
}

function visitAt(value: unknown, href: string): ViewerVisit | null {
  if (!record(value) || value.schema !== 1 || value.href !== href || typeof value.mode !== "string" || !isVisualMode(value.mode)) {
    return null;
  }
  return {
    mode: value.mode,
    navigation: validNavigation(value.navigation) ? value.navigation : null,
    selected: typeof value.selected === "string" && value.selected.length <= 160 ? value.selected : null,
  };
}

/** Fresh entries have no checkpoint. A re-created entry can retain its own. */
export function readViewerVisit(browser: Browser): ViewerVisit | null {
  try {
    const state: unknown = browser.history.state;
    return record(state) ? visitAt(state[VIEWER_VISIT_HISTORY_KEY], entryHref(browser)) : null;
  } catch {
    return null;
  }
}

export function saveViewerVisit(browser: Browser, visit: ViewerVisit): void {
  try {
    const state: unknown = browser.history.state;
    if (state !== null && !record(state)) return;
    const href = entryHref(browser);
    const previous = state?.[VIEWER_VISIT_HISTORY_KEY];
    const earlier = visitAt(previous, href);
    const navigation = validNavigation(visit.navigation) ? visit.navigation : earlier?.navigation ?? null;
    const selected = visit.selected ?? earlier?.selected ?? null;
    const next = { schema: 1, href, mode: visit.mode, navigation, selected };
    if (earlier?.mode === visit.mode && record(previous) && previous.selected === selected
      && previous.navigation === earlier.navigation
      && JSON.stringify(earlier.navigation) === JSON.stringify(navigation)) return;
    browser.history.replaceState({ ...state, [VIEWER_VISIT_HISTORY_KEY]: next }, "");
  } catch {
    // A blocked history write cannot interrupt the running viewer.
  }
}

export function watchViewerVisit(
  windowTarget: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval">,
  page: Pick<Document, "addEventListener" | "removeEventListener" | "hidden">,
  save: () => void,
): () => void {
  const saveVisible = () => { if (!page.hidden) save(); };
  const saveHidden = () => { if (page.hidden) save(); };
  const timer = windowTarget.setInterval(saveVisible, CHECKPOINT_INTERVAL_MS);
  windowTarget.addEventListener("pagehide", save);
  page.addEventListener("visibilitychange", saveHidden);
  return () => {
    windowTarget.clearInterval(timer);
    windowTarget.removeEventListener("pagehide", save);
    page.removeEventListener("visibilitychange", saveHidden);
  };
}
