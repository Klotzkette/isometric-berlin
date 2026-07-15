import type { VisualMode } from "../../visualMode";
import {
  type DecorativeSpawn,
  type SpawnCategory,
  SPAWN_CATEGORY_ORDER,
  SPAWN_SCHEDULE,
  buildSpawnPlan,
} from "./spawns";

/**
 * Overlay fade duration when entering or leaving Minecraft mode.
 * The mode-switch contract requires this to stay at or below 200 ms;
 * it must match the `minecraft-life-fade-*` animation duration in
 * styles.css.
 */
export const MODE_FADE_MS = 180;

const DWELL_TICK_MS = 500;
const TOAST_VISIBLE_MS = 3200;
const FRAME_SAMPLE_SIZE = 60;
const DEFAULT_FRAME_MS = 16.7;

export type LifecyclePhase = "hidden" | "entering" | "active" | "leaving";

export type LifecycleState = {
  announcedCategory: SpawnCategory | null;
  phase: LifecyclePhase;
  spawns: readonly DecorativeSpawn[];
};

export type LifecycleEnvironment = {
  dayOfWeek: number;
  devicePixelRatio: number;
  zoomBucket: number;
};

/**
 * Every timer the spawn system uses is created through this interface so
 * the controller can keep a complete handle registry (for strict teardown)
 * and tests can substitute a manual clock.
 */
export type Scheduler = {
  cancelAnimationFrame(handle: number): void;
  clearInterval(handle: number): void;
  clearTimeout(handle: number): void;
  now(): number;
  requestAnimationFrame(callback: (timestamp: number) => void): number;
  setInterval(callback: () => void, intervalMs: number): number;
  setTimeout(callback: () => void, delayMs: number): number;
};

function browserScheduler(): Scheduler {
  return {
    cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
    clearInterval: (handle) => window.clearInterval(handle),
    clearTimeout: (handle) => window.clearTimeout(handle),
    now: () => performance.now(),
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  };
}

/**
 * Which dwell thresholds have been reached (and which categories have been
 * announced) during this page load. Deliberately in-memory only — never
 * persisted to localStorage — so a reload restarts the schedule while a
 * mode round-trip within the same page load restores reached categories
 * immediately.
 */
export class SpawnThresholdMemory {
  private readonly announced = new Set<SpawnCategory>();
  private readonly reached = new Set<SpawnCategory>();

  clear(): void {
    this.announced.clear();
    this.reached.clear();
  }

  isAnnounced(category: SpawnCategory): boolean {
    return this.announced.has(category);
  }

  isReached(category: SpawnCategory): boolean {
    return this.reached.has(category);
  }

  markAnnounced(category: SpawnCategory): void {
    this.announced.add(category);
  }

  markReached(category: SpawnCategory): void {
    this.reached.add(category);
  }

  reachedSnapshot(): ReadonlySet<SpawnCategory> {
    return new Set(this.reached);
  }
}

/** Shared page-load memory used by the real viewer. */
export const pageLoadSpawnMemory = new SpawnThresholdMemory();

function spawnsEqual(
  left: readonly DecorativeSpawn[],
  right: readonly DecorativeSpawn[],
): boolean {
  if (left === right) {
    return true;
  }
  return (
    left.length === right.length &&
    left.every((spawn, index) => spawn.id === right[index].id)
  );
}

function statesEqual(left: LifecycleState, right: LifecycleState): boolean {
  return (
    left.phase === right.phase &&
    left.announcedCategory === right.announcedCategory &&
    spawnsEqual(left.spawns, right.spawns)
  );
}

/**
 * The single owner of the Minecraft decoration lifecycle. Keyed on the
 * visual mode: entering Minecraft starts the dwell schedule (restoring
 * categories whose thresholds were already reached this page load), and
 * leaving it fades out and then strictly tears down every spawn and every
 * timer handle. Outside Minecraft mode (once the ≤ 200 ms fade completes)
 * the controller holds zero spawns and zero live handles.
 */
export class MinecraftLifecycleController {
  private readonly frameHandles = new Set<number>();
  private readonly intervalHandles = new Set<number>();
  private readonly timeoutHandles = new Set<number>();
  private readonly listeners = new Set<() => void>();
  private readonly memory: SpawnThresholdMemory;
  private readonly scheduler: Scheduler;
  private averageFrameMs = DEFAULT_FRAME_MS;
  private disposed = false;
  private dwellInterval: number | null = null;
  private dwellStartedAt = 0;
  private environment: LifecycleEnvironment = {
    dayOfWeek: 0,
    devicePixelRatio: 1,
    zoomBucket: 2,
  };
  private fadeTimeout: number | null = null;
  private frameHandle: number | null = null;
  private frameSamples: number[] = [];
  private lastFrameTimestamp: number | null = null;
  private mode: VisualMode = "day";
  private state: LifecycleState = {
    announcedCategory: null,
    phase: "hidden",
    spawns: [],
  };
  private toastTimeout: number | null = null;

  constructor(options?: {
    memory?: SpawnThresholdMemory;
    scheduler?: Scheduler;
  }) {
    this.memory = options?.memory ?? pageLoadSpawnMemory;
    this.scheduler = options?.scheduler ?? browserScheduler();
  }

  readonly getState = (): LifecycleState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Live handle registry size (timeouts + intervals + animation frames). */
  get activeTimerHandleCount(): number {
    return (
      this.frameHandles.size +
      this.intervalHandles.size +
      this.timeoutHandles.size
    );
  }

  setEnvironment(environment: LifecycleEnvironment): void {
    if (this.disposed) {
      return;
    }
    const changed =
      environment.dayOfWeek !== this.environment.dayOfWeek ||
      environment.devicePixelRatio !== this.environment.devicePixelRatio ||
      environment.zoomBucket !== this.environment.zoomBucket;
    this.environment = { ...environment };
    if (changed && this.mode === "minecraft") {
      this.refreshPlan();
    }
  }

  setMode(mode: VisualMode): void {
    if (this.disposed || mode === this.mode) {
      return;
    }
    const wasMinecraft = this.mode === "minecraft";
    this.mode = mode;
    if (mode === "minecraft") {
      this.enter();
    } else if (wasMinecraft) {
      this.leave();
    }
  }

  /** The explicit reset control: forget reached thresholds, restart dwell. */
  resetSchedule(): void {
    if (this.disposed) {
      return;
    }
    this.memory.clear();
    if (this.mode !== "minecraft") {
      return;
    }
    this.dwellStartedAt = this.scheduler.now();
    this.clearToastTimer();
    this.setState({ ...this.state, announcedCategory: null, spawns: [] });
    this.refreshPlan();
  }

  /** Immediate teardown (component unmount): no fade, no surviving handle. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.stopDwellTicker();
    this.stopFrameProfiler();
    this.clearToastTimer();
    this.clearFadeTimer();
    this.disposed = true;
    this.listeners.clear();
    this.state = { announcedCategory: null, phase: "hidden", spawns: [] };
  }

  private enter(): void {
    // Cancel a pending leave fade so a quick re-entry never loses spawns.
    this.clearFadeTimer();
    this.dwellStartedAt = this.scheduler.now();
    this.averageFrameMs = DEFAULT_FRAME_MS;
    this.setState({ ...this.state, phase: "entering" });
    this.refreshPlan();
    this.startDwellTicker();
    this.startFrameProfiler();
    this.fadeTimeout = this.registerTimeout(() => {
      this.fadeTimeout = null;
      if (this.mode === "minecraft") {
        this.setState({ ...this.state, phase: "active" });
      }
    }, MODE_FADE_MS);
  }

  private leave(): void {
    // Timers stop immediately; only the bounded fade timeout remains, and
    // when it fires the registry is empty and the overlay renders nothing.
    this.stopDwellTicker();
    this.stopFrameProfiler();
    this.clearToastTimer();
    this.clearFadeTimer();
    if (this.state.phase === "hidden") {
      return;
    }
    this.setState({ ...this.state, announcedCategory: null, phase: "leaving" });
    this.fadeTimeout = this.registerTimeout(() => {
      this.fadeTimeout = null;
      this.setState({ announcedCategory: null, phase: "hidden", spawns: [] });
    }, MODE_FADE_MS);
  }

  private refreshPlan(): void {
    if (this.disposed || this.mode !== "minecraft") {
      return;
    }
    const elapsedMs = this.scheduler.now() - this.dwellStartedAt;
    for (const category of SPAWN_CATEGORY_ORDER) {
      if (elapsedMs >= SPAWN_SCHEDULE[category]) {
        this.memory.markReached(category);
      }
    }
    const spawns = buildSpawnPlan({
      averageFrameMs: this.averageFrameMs,
      dayOfWeek: this.environment.dayOfWeek,
      devicePixelRatio: this.environment.devicePixelRatio,
      elapsedMs,
      reachedCategories: this.memory.reachedSnapshot(),
      zoomBucket: this.environment.zoomBucket,
    });
    let announcedCategory = this.state.announcedCategory;
    const visible = new Set(spawns.map((spawn) => spawn.category));
    const next = SPAWN_CATEGORY_ORDER.find(
      (category) =>
        visible.has(category) && !this.memory.isAnnounced(category),
    );
    if (next) {
      this.memory.markAnnounced(next);
      announcedCategory = next;
      this.clearToastTimer();
      this.toastTimeout = this.registerTimeout(() => {
        this.toastTimeout = null;
        this.setState({ ...this.state, announcedCategory: null });
      }, TOAST_VISIBLE_MS);
    }
    this.setState({ ...this.state, announcedCategory, spawns });
  }

  private startDwellTicker(): void {
    this.stopDwellTicker();
    const handle = this.scheduler.setInterval(
      () => this.refreshPlan(),
      DWELL_TICK_MS,
    );
    this.intervalHandles.add(handle);
    this.dwellInterval = handle;
  }

  private stopDwellTicker(): void {
    if (this.dwellInterval !== null) {
      this.scheduler.clearInterval(this.dwellInterval);
      this.intervalHandles.delete(this.dwellInterval);
      this.dwellInterval = null;
    }
  }

  private startFrameProfiler(): void {
    this.stopFrameProfiler();
    const step = (timestamp: number): void => {
      if (this.frameHandle !== null) {
        this.frameHandles.delete(this.frameHandle);
        this.frameHandle = null;
      }
      if (this.disposed || this.mode !== "minecraft") {
        return;
      }
      if (this.lastFrameTimestamp !== null) {
        this.frameSamples.push(timestamp - this.lastFrameTimestamp);
        if (this.frameSamples.length >= FRAME_SAMPLE_SIZE) {
          this.averageFrameMs =
            this.frameSamples.reduce((sum, sample) => sum + sample, 0) /
            this.frameSamples.length;
          this.frameSamples = [];
          this.refreshPlan();
        }
      }
      this.lastFrameTimestamp = timestamp;
      this.frameHandle = this.scheduler.requestAnimationFrame(step);
      this.frameHandles.add(this.frameHandle);
    };
    this.frameHandle = this.scheduler.requestAnimationFrame(step);
    this.frameHandles.add(this.frameHandle);
  }

  private stopFrameProfiler(): void {
    if (this.frameHandle !== null) {
      this.scheduler.cancelAnimationFrame(this.frameHandle);
      this.frameHandles.delete(this.frameHandle);
      this.frameHandle = null;
    }
    this.lastFrameTimestamp = null;
    this.frameSamples = [];
  }

  private registerTimeout(callback: () => void, delayMs: number): number {
    const handle = this.scheduler.setTimeout(() => {
      this.timeoutHandles.delete(handle);
      callback();
    }, delayMs);
    this.timeoutHandles.add(handle);
    return handle;
  }

  private clearFadeTimer(): void {
    if (this.fadeTimeout !== null) {
      this.scheduler.clearTimeout(this.fadeTimeout);
      this.timeoutHandles.delete(this.fadeTimeout);
      this.fadeTimeout = null;
    }
  }

  private clearToastTimer(): void {
    if (this.toastTimeout !== null) {
      this.scheduler.clearTimeout(this.toastTimeout);
      this.timeoutHandles.delete(this.toastTimeout);
      this.toastTimeout = null;
    }
  }

  private setState(next: LifecycleState): void {
    if (statesEqual(this.state, next)) {
      return;
    }
    this.state = next;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
