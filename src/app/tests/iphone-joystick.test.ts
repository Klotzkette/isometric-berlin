import { describe, expect, test } from "bun:test";
import { MathUtils, PerspectiveCamera, TOUCH, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ts from "typescript";
import {
  beginJoystickTap,
  cancelJoystickTap,
  createJoystickTapState,
  endJoystickTap,
  moveJoystickTap,
} from "../src/joystickGestures";
import {
  createPedestrianState, isPedestrianSprintDoubleActivation,
  PEDESTRIAN_IDLE_INPUT, stepPedestrian,
} from "../src/pedestrianNavigation";
import { continuousFlightSpeeds, REGIERUNGSVIERTEL_FLIGHT_BOUNDS } from "../src/cameraNavigation";
import { minecraftHeroCollisionEnabled } from "../src/minecraftHeroNavigation";
import { constrainSurfaceCameraRig } from "../src/surfaceCameraNavigation";

// Exercise the shipped React handlers, not a second implementation of their
// movement/gesture logic. The tiny host below supplies hooks, refs and bubbling
// without WebGL or a browser. OrbitControls itself is the installed dependency.
const appSource = await Bun.file(new URL("../src/App.tsx", import.meta.url)).text();
const componentSource = appSource.slice(
  appSource.indexOf("const JOYSTICK_RADIUS_PX"),
  appSource.indexOf("function HoldControlButton("),
);
const compiledComponent = ts.transpileModule(componentSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;

class ElementHost extends EventTarget {
  style: Record<string, string> = {};
  clientHeight = 844;
  clientWidth = 390;
  rect = { left: 14, top: 500, width: 128, height: 128 };
  rectReads = 0;
  rejectCapture = false;
  captures = new Set<number>();
  child: ElementHost | null = null;

  constructor(readonly ownerDocument: EventTarget) { super(); }
  getRootNode(): EventTarget { return this.ownerDocument; }
  getBoundingClientRect(): typeof this.rect { this.rectReads += 1; return this.rect; }
  focused = false;
  focus(): void { this.focused = true; }
  contains(node: unknown): boolean { return node === this || node === this.child; }
  setPointerCapture(id: number): void {
    if (this.rejectCapture) throw new Error("Pointer capture rejected");
    this.captures.add(id);
  }
  hasPointerCapture(id: number): boolean { return this.captures.has(id); }
  releasePointerCapture(id: number): void { this.captures.delete(id); }
}

type Props = {
  disabled: boolean;
  resetKey: string;
  label: string;
  onInput: (x: number, y: number, speedMultiplier?: number) => void;
  onJump?: () => void;
};
type Tree = { props: Record<string, any>; children: Tree[] };
type Hook = { value?: any; deps?: unknown[]; cleanup?: () => void };
type PointerOptions = {
  id?: number;
  x?: number;
  y?: number;
  at?: number;
  pointerType?: string;
  button?: number;
  buttons?: number;
};

function nativePointer(type: string, options: PointerOptions = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: options.id ?? 1,
    pointerType: options.pointerType ?? "touch",
    isPrimary: true,
    button: options.button ?? 0,
    buttons: options.buttons ?? 1,
    clientX: options.x ?? 78, clientY: options.y ?? 564,
    pageX: options.x ?? 78, pageY: options.y ?? 564,
  });
  Object.defineProperty(event, "timeStamp", { value: options.at ?? 1_000 });
  return event;
}

function joystickHost(overrides: Partial<Props> = {}) {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const window = Object.assign(new EventTarget(), {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  const pad = new ElementHost(document);
  const knob = new ElementHost(document);
  knob.rect = { left: 58, top: 544, width: 40, height: 40 };
  pad.child = knob;
  const values: [number, number][] = [];
  const speeds: number[] = [];
  const props: Props = {
    disabled: false, resetKey: "day", label: "Joystick",
    ...overrides,
    onInput: (x, y, speed = 1) => {
      values.push([x, y]);
      speeds.push(speed);
      overrides.onInput?.(x, y, speed);
    },
  };
  const hooks: Hook[] = [];
  let nowMs = 1_000;
  let cursor = 0;
  let pendingEffects: (() => void)[] = [];
  let tree: Tree;
  const changed = (a: unknown[] | undefined, b: unknown[]) =>
    a === undefined || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const useRef = (initial: unknown) => {
    const hook = hooks[cursor] ??= { value: { current: initial } };
    cursor += 1;
    return hook.value;
  };
  const useCallback = (callback: (...args: any[]) => any, deps: unknown[]) => {
    const hook = hooks[cursor] ??= {};
    cursor += 1;
    if (changed(hook.deps, deps)) { hook.value = callback; hook.deps = deps; }
    return hook.value;
  };
  const useEffect = (effect: () => (() => void) | undefined, deps: unknown[]) => {
    const hook = hooks[cursor] ??= {};
    cursor += 1;
    if (changed(hook.deps, deps)) {
      pendingEffects.push(() => { hook.cleanup?.(); hook.cleanup = effect(); });
      hook.deps = deps;
    }
  };
  const bindings = {
    React: { createElement: (_tag: string, props: Tree["props"], ...children: Tree[]) => ({ props, children }) },
    useRef, useCallback, useEffect, window, document, Node: ElementHost,
    performance: { now: () => nowMs },
    beginJoystickTap, cancelJoystickTap, createJoystickTapState,
    endJoystickTap, moveJoystickTap, isPedestrianSprintDoubleActivation,
  };
  const component = new Function(...Object.keys(bindings), `${compiledComponent}; return FlightJoystick;`)(
    ...Object.values(bindings),
  ) as (props: Props) => Tree;
  const render = (next: Partial<Props> = {}) => {
    Object.assign(props, next);
    cursor = 0;
    pendingEffects = [];
    tree = component(props);
    tree.props.ref.current = pad;
    tree.children[0].props.ref.current = knob;
    pendingEffects.forEach((effect) => effect());
  };
  render();
  values.length = 0;
  speeds.length = 0;
  const handlers: Record<string, string> = {
    pointerdown: "onPointerDown", pointermove: "onPointerMove",
    pointerup: "onPointerUp", pointercancel: "onPointerCancel",
    lostpointercapture: "onLostPointerCapture",
  };
  const emit = (type: string, options: PointerOptions = {}) => {
    nowMs = options.at ?? nowMs;
    const native = nativePointer(type, options) as Event & Record<string, any>;
    let stopped = false;
    const event = {
      pointerId: native.pointerId, pointerType: native.pointerType,
      isPrimary: native.isPrimary, button: native.button, buttons: native.buttons,
      clientX: native.clientX, clientY: native.clientY, timeStamp: native.timeStamp,
      currentTarget: pad, target: pad, nativeEvent: native,
      preventDefault: () => native.preventDefault(),
      stopPropagation: () => { stopped = true; native.stopPropagation(); },
    };
    tree.props[handlers[type]](event);
    // React's root is below ownerDocument. Only events that the actual pad
    // handler allows to bubble can reach OrbitControls' document listener.
    if (!stopped) document.dispatchEvent(native);
    return { stopped, defaultPrevented: native.defaultPrevented };
  };
  return {
    document, window, pad, knob, values, render, emit,
    lastInput: () => values.at(-1),
    lastSpeed: () => speeds.at(-1),
    pendingFrames: () => frames.size,
    frame: (at: number) => {
      nowMs = at;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(at));
    },
    unmount: () => hooks.forEach((hook) => hook.cleanup?.()),
  };
}

// Connect the actual component to the actual viewer adapter and frame step.
// Only the scene is a small fixture; speed and held-input logic are not copied.
const viewerSource = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const viewerAst = ts.createSourceFile("ThreeViewer.tsx", viewerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function viewerNode(predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (predicate(node)) found ??= node;
    ts.forEachChild(node, visit);
  };
  visit(viewerAst);
  if (!found) throw new Error("Viewer navigation node missing");
  return found;
}
function executeViewer(source: string, bindings: Record<string, unknown>): any {
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), compiled)(...Object.values(bindings));
}
function heldMovementRig(walking = false) {
  const camera = new PerspectiveCamera(39);
  camera.position.set(0, 100, 2_200);
  const controls = { target: new Vector3(0, 80, 2_200 - Math.sqrt(200 ** 2 - 20 ** 2)) };
  camera.lookAt(controls.target);
  const environment = { bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }, groundAt: () => 4, water: [] };
  let pedestrian = createPedestrianState(environment, { x: 0, z: 0, yaw: 0 });
  const runtime = {
    camera, controls, lightingMode: "day",
    pedestrian: { enabled: walking, environment: null },
    navigationScratch: {
      delta: new Vector3(), heading: new Vector3(), right: new Vector3(),
      boundedTarget: new Vector3(), boundedRequest: new Vector3(),
    },
  };
  const flightInputRef = { current: new Vector3() };
  const flightSpeedMultiplierRef = { current: 1 };
  const pedestrianInputRef = { current: { ...PEDESTRIAN_IDLE_INPUT } };
  const adapter = viewerNode((node) => ts.isPropertyAssignment(node) && node.name.getText(viewerAst) === "setFlightInput") as ts.PropertyAssignment;
  const setInput = executeViewer(`return (${adapter.initializer.getText(viewerAst)});`, {
    MathUtils, runtimeRef: { current: runtime }, flightInputRef,
    flightSpeedMultiplierRef, pedestrianInputRef, markSurfaceInteraction: () => {},
  });
  const bounded = viewerNode((node) => ts.isFunctionDeclaration(node) && node.name?.text === "applyBoundedCameraRigTranslation");
  const applyBoundedCameraRigTranslation = executeViewer(`${bounded.getText(viewerAst)}; return applyBoundedCameraRigTranslation;`, {
    REGIERUNGSVIERTEL_FLIGHT_BOUNDS, minecraftHeroCollisionEnabled,
  });
  const frameStep = viewerNode((node) => ts.isVariableDeclaration(node) && node.name.getText(viewerAst) === "applyContinuousFlight") as ts.VariableDeclaration;
  const fly = executeViewer(`let wasFlying = false; return (${frameStep.initializer!.getText(viewerAst)});`, {
    camera, controls, runtime, flightInputRef, flightSpeedMultiplierRef,
    continuousFlightSpeeds, flightSpeedScratch: { horizontal: 0, vertical: 0 },
    applyBoundedCameraRigTranslation, markSurfaceInteraction: () => {},
    notifyView: () => {}, onViewChangeRef: { current: () => {} },
  });
  return {
    camera, controls,
    onInput: (strafe: number, forward: number, speed = 1) => setInput(strafe, forward, 0, speed),
    pedestrian: () => pedestrian,
    frame: (dt: number) => {
      if (walking) pedestrian = stepPedestrian(pedestrian, pedestrianInputRef.current, dt, environment).state;
      else {
        fly(dt);
        constrainSurfaceCameraRig(camera, controls.target, environment.groundAt);
      }
    },
  };
}

function orbitRig(document: EventTarget) {
  const canvas = new ElementHost(document);
  const camera = new PerspectiveCamera(39, 390 / 844, 0.25, 6_000);
  camera.position.set(0, 100, 200);
  const controls = new OrbitControls(camera, canvas as unknown as HTMLElement);
  controls.enableDamping = false;
  controls.rotateSpeed = 1.45;
  controls.minPolarAngle = 0.06;
  controls.maxPolarAngle = Math.PI - 0.06;
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE };
  controls.update();
  return { camera, controls, canvas };
}

describe("iPhone joystick gesture ownership and stability", () => {
  for (const fps of [30, 60, 120]) {
    test(`stationary held edge accelerates and keeps flying at 3x without pointer moves (${fps} Hz)`, () => {
      const rig = heldMovementRig();
      const host = joystickHost({ onInput: rig.onInput });
      const offset = rig.camera.position.clone().sub(rig.controls.target);
      try {
        host.emit("pointerdown", { at: 1_000 });
        host.emit("pointermove", { y: 520, at: 1_000 });
        expect(host.lastInput()).toEqual([0, 1]);
        expect(host.lastSpeed()).toBe(1);
        for (let frame = 1; frame <= fps; frame++) {
          host.frame(1_000 + frame * 1_000 / fps);
          rig.frame(1 / fps);
        }
        expect(host.lastSpeed()).toBe(3);
        expect(host.pendingFrames()).toBe(0);
        const atFullSpeed = rig.camera.position.clone();
        const inputCalls = host.values.length;
        // Three more seconds hold the same thumb coordinate, with no new
        // input callbacks at all once the short ramp has finished.
        for (let frame = 1; frame <= 3 * fps; frame++) {
          host.frame(2_000 + frame * 1_000 / fps);
          rig.frame(1 / fps);
        }
        expect(host.values.length).toBe(inputCalls);
        expect(rig.camera.position.distanceTo(atFullSpeed)).toBeCloseTo(3 * 1_620, 6);
        expect(rig.camera.position.clone().sub(rig.controls.target).distanceTo(offset)).toBeLessThan(1e-9);
        expect(rig.camera.position.y).toBe(100);
        expect(host.pad.rectReads).toBe(1);
        host.emit("pointerup", { y: 520, at: 5_000 });
        const stopped = rig.camera.position.clone();
        host.frame(6_000); rig.frame(1 / fps);
        expect(rig.camera.position.equals(stopped)).toBeTrue();
        expect(host.lastSpeed()).toBe(1);
      } finally { host.unmount(); }
    });
  }

  test("edge acceleration uses elapsed time; precision input and a fresh gesture reset the boost", () => {
    const host = joystickHost();
    try {
      host.emit("pointerdown", { y: 520, at: 1_000 });
      host.frame(1_250);
      expect(host.lastSpeed()).toBe(1);
      host.frame(1_625);
      expect(host.lastSpeed()).toBe(2);
      host.frame(2_000);
      expect(host.lastSpeed()).toBe(3);
      host.emit("pointermove", { y: 534, at: 2_100 });
      expect(host.lastInput()![1]).toBeCloseTo(0.65);
      expect(host.lastSpeed()).toBe(1);
      expect(host.pendingFrames()).toBe(0);
      host.frame(10_000);
      expect(host.lastSpeed()).toBe(1);
      host.emit("pointermove", { y: 520, at: 10_000 });
      expect(host.lastSpeed()).toBe(1);
      host.frame(11_000);
      expect(host.lastSpeed()).toBe(3);
    } finally { host.unmount(); }
    expect(host.pendingFrames()).toBe(0);
  });

  test("stationary walking edge reaches 39 m/s and release stops immediately", () => {
    const rig = heldMovementRig(true);
    const host = joystickHost({ onInput: rig.onInput });
    try {
      host.emit("pointerdown", { y: 520, at: 1_000 });
      host.frame(2_000);
      const start = rig.pedestrian();
      for (let frame = 0; frame < 120; frame++) rig.frame(1 / 60);
      expect(Math.hypot(rig.pedestrian().x - start.x, rig.pedestrian().z - start.z)).toBeCloseTo(78, 6);
      expect(rig.pedestrian().yaw).toBe(start.yaw);
      expect(rig.pedestrian().pitch).toBe(start.pitch);
      host.emit("pointerup", { y: 520, at: 4_000 });
      const stopped = rig.pedestrian();
      rig.frame(1 / 60);
      expect(rig.pedestrian()).toBe(stopped);
    } finally { host.unmount(); }
  });

  test("boosted flight retains the finite city boundary", () => {
    const rig = heldMovementRig();
    const host = joystickHost({ onInput: rig.onInput });
    try {
      host.emit("pointerdown", { y: 520, at: 1_000 });
      host.frame(2_000);
      for (let frame = 0; frame < 600; frame++) rig.frame(1 / 60);
      expect(rig.controls.target.z).toBe(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min.z);
      expect(rig.camera.position.y).toBe(100);
    } finally { host.unmount(); }
  });

  test("the outer edge of the larger coarse-pointer knob also starts neutral", () => {
    const host = joystickHost();
    try {
      host.knob.rect = { left: 54, top: 540, width: 48, height: 48 };
      host.emit("pointerdown", { x: 100, y: 564 });
      expect(host.lastInput()!.every(value => value === 0)).toBeTrue();
      host.emit("pointermove", { x: 100, y: 520 });
      expect(host.lastInput()).toEqual([0, 1]);
      expect(host.pad.rectReads).toBe(1);
      expect(host.knob.rectReads).toBe(1);
      host.emit("pointerup", { x: 100, y: 520 });
      expect(host.lastInput()).toEqual([0, 0]);
    } finally { host.unmount(); }
  });

  test("off-centre knob grips stay neutral and mouse/touch/pen produce identical drags", () => {
    const trajectories: Array<Array<[number, number]>> = [];
    for (const pointerType of ["mouse", "touch", "pen"]) {
      const host = joystickHost();
      try {
        // Desktop and phone place differently sized pads in different corners.
        host.pad.rect = pointerType === "mouse"
          ? { left: 306, top: 700, width: 82, height: 82 }
          : { left: 14, top: 500, width: 128, height: 128 };
        const x = host.pad.rect.left + host.pad.rect.width / 2 + 16;
        const y = host.pad.rect.top + host.pad.rect.height / 2 - 8;
        host.emit("pointerdown", { pointerType, x, y });
        expect(host.lastInput()!.every(value => value === 0)).toBeTrue();
        const path: Array<[number, number]> = [];
        for (const [dx, dy] of [[0, -20], [0, -44], [44, 0], [-31, 31], [180, -180], [0, 0]]) {
          host.emit("pointermove", { pointerType, x: x + dx, y: y + dy });
          path.push(host.lastInput()!);
        }
        expect(path[1][0]).toBe(0);
        expect(path[1][1]).toBe(1);
        expect(path[2][0]).toBe(1);
        expect(path[2][1]).toBeCloseTo(0);
        expect(path[4][0]).toBeCloseTo(Math.SQRT1_2);
        host.emit("pointerup", { pointerType, x, y });
        expect(host.lastInput()).toEqual([0, 0]);
        expect(host.pad.rectReads).toBe(1);
        trajectories.push(path);
      } finally { host.unmount(); }
    }
    expect(trajectories[0]).toEqual(trajectories[1]);
    expect(trajectories[1]).toEqual(trajectories[2]);
  });

  test("a lost mouse release cannot leave hover movement or a pending jump", () => {
    let jumps = 0;
    const host = joystickHost({ onJump: () => { jumps += 1; } });
    try {
      host.emit("pointerdown", { pointerType: "mouse" });
      host.emit("pointermove", { pointerType: "mouse", y: 520 });
      expect(host.lastInput()![1]).toBe(1);
      host.emit("pointermove", { pointerType: "mouse", y: 520, buttons: 0 });
      expect(host.lastInput()).toEqual([0, 0]);
      host.emit("pointermove", { pointerType: "mouse", y: 510 });
      expect(host.lastInput()).toEqual([0, 0]);
      host.emit("pointerup", { pointerType: "mouse" });
      expect(jumps).toBe(0);
    } finally { host.unmount(); }
  });

  test("reproduces the real OrbitControls foreign-touch sky pitch", () => {
    const document = new EventTarget();
    const { camera, controls, canvas } = orbitRig(document);
    try {
      canvas.dispatchEvent(nativePointer("pointerdown", { id: 1, x: 300, y: 300 }));
      document.dispatchEvent(nativePointer("pointermove", { id: 2, x: 78, y: 600 }));
      expect(controls.getPolarAngle()).toBeCloseTo(0.06, 8);
      // Just two pixels from the real canvas finger now pitches the view
      // through the ground into the sky because the foreign finger moved
      // OrbitControls' previous coordinate hundreds of pixels away.
      document.dispatchEvent(nativePointer("pointermove", { id: 1, x: 300, y: 298 }));
      expect(camera.getWorldDirection(new Vector3()).y).toBeGreaterThan(0.99);
      expect(camera.position.y).toBeLessThan(-220);
    } finally { controls.dispose(); }
  });

  for (const pointerType of ["touch", "pen"]) {
    test(`the actual ${pointerType} pad cannot orbit an existing canvas gesture, and canvas look still works`, () => {
      const host = joystickHost();
      const { camera, controls, canvas } = orbitRig(host.document);
      try {
        canvas.dispatchEvent(nativePointer("pointerdown", { id: 1, x: 300, y: 300 }));
        const before = camera.position.clone();
        for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
          expect(host.emit(type, { id: 2, x: 78, y: 520, pointerType }).stopped).toBeTrue();
          expect(camera.position.distanceTo(before)).toBeLessThan(1e-10);
        }
        const initialPolar = controls.getPolarAngle();
        host.document.dispatchEvent(nativePointer("pointermove", { id: 1, x: 300, y: 298 }));
        expect(controls.getPolarAngle()).toBeGreaterThan(initialPolar);
        expect(controls.getPolarAngle() - initialPolar).toBeLessThan(0.03);
        expect(camera.getWorldDirection(new Vector3()).y).toBeLessThan(0);
      } finally { controls.dispose(); host.unmount(); }
    });
  }

  test("desktop mouse retains movement, focuses navigation and jumps only after completed double-clicks", () => {
    let jumps = 0;
    const host = joystickHost({ onJump: () => { jumps += 1; } });
    try {
      const mouse = { pointerType: "mouse" };
      host.emit("pointerdown", { ...mouse, button: 2, y: 520, at: 1_000 });
      host.emit("pointermove", { ...mouse, y: 520, at: 1_010 });
      expect(host.values).toHaveLength(0);
      expect(host.pad.captures.size).toBe(0);
      expect(host.pad.rectReads).toBe(0);
      expect(host.pad.focused).toBeFalse();

      host.emit("pointerdown", { ...mouse, y: 520, at: 1_200 });
      expect(host.lastInput()![1]).toBe(1);
      expect(host.pad.focused).toBeTrue();
      host.emit("pointermove", { ...mouse, x: 122, at: 1_220 });
      expect(host.lastInput()![0]).toBe(1);
      host.emit("pointerup", { ...mouse, x: 122, at: 1_240 });
      expect(host.lastInput()).toEqual([0, 0]);
      expect(host.pad.hasPointerCapture(1)).toBeFalse();
      expect(jumps).toBe(0);
      // The previous drag cannot count as the first click.
      host.emit("pointerdown", { ...mouse, at: 1_350 });
      host.emit("pointerup", { ...mouse, at: 1_390 });
      expect(jumps).toBe(0);
      host.emit("pointerdown", { ...mouse, at: 1_500 });
      expect(jumps).toBe(0);
      host.emit("pointerup", { ...mouse, at: 1_560 });
      expect(jumps).toBe(1);
      expect(host.lastInput()).toEqual([0, 0]);
    } finally { host.unmount(); }
  });

  test("holds a stable origin across Safari viewport changes and does no move-time layout reads", () => {
    const host = joystickHost();
    try {
      host.emit("pointerdown");
      host.emit("pointermove", { y: 534 });
      const before = host.lastInput();
      host.pad.rect = { ...host.pad.rect, top: 460 };
      host.emit("pointermove", { y: 534 });
      expect(host.lastInput()).toEqual(before);
      expect(host.lastInput()![1]).toBeCloseTo(0.65, 10);
      expect(host.pad.rectReads).toBe(1);
      expect(host.knob.style.transform).toBe("translate(0px, -30px)");
      host.emit("pointerup", { y: 534 });
      host.emit("pointerdown", { y: 524 });
      expect(host.lastInput()!.every((value) => value === 0)).toBeTrue();
      expect(host.pad.rectReads).toBe(2);
    } finally { host.unmount(); }
  });

  test("filters neutral thumb wobble but retains full radial travel immediately", () => {
    const host = joystickHost();
    try {
      host.emit("pointerdown");
      for (const [x, y] of [[78, 564], [80, 564], [78, 560]]) {
        host.emit("pointermove", { x, y });
        expect(host.lastInput()!.every((value) => value === 0)).toBeTrue();
      }
      for (const [x, y, expected] of [[78, 520, [0, 1]], [122, 564, [1, 0]], [78, 608, [0, -1]] ] as const) {
        host.emit("pointermove", { x, y });
        expect(host.lastInput()![0]).toBeCloseTo(expected[0], 10);
        expect(host.lastInput()![1]).toBeCloseTo(expected[1], 10);
      }
      host.emit("pointermove", { x: 178, y: 464 });
      expect(Math.hypot(...host.lastInput()!)).toBeCloseTo(1, 10);
      expect(host.lastInput()![0]).toBeCloseTo(Math.SQRT1_2, 10);
      expect(host.lastInput()![1]).toBeCloseTo(Math.SQRT1_2, 10);
    } finally { host.unmount(); }
  });

  test("capture rejection stops safely and the next gesture recovers", () => {
    const host = joystickHost();
    try {
      host.pad.rejectCapture = true;
      expect(() => host.emit("pointerdown", { y: 520 })).not.toThrow();
      expect(host.lastInput()).toEqual([0, 0]);
      host.emit("pointermove", { y: 520 });
      expect(host.lastInput()).toEqual([0, 0]);
      host.pad.rejectCapture = false;
      host.emit("pointerdown", { id: 2, y: 520 });
      expect(host.lastInput()![1]).toBe(1);
    } finally { host.unmount(); }
  });

  test("release, cancellation, capture loss, mode changes and blur clear held movement", () => {
    const host = joystickHost();
    try {
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
        host.emit("pointerdown", { y: 520, at: 1_000 });
        host.frame(1_625);
        expect(host.lastInput()![1]).toBe(1);
        expect(host.lastSpeed()).toBe(2);
        host.emit(type);
        expect(host.lastInput()).toEqual([0, 0]);
        expect(host.pendingFrames()).toBe(0);
        host.frame(2_000);
        expect(host.lastSpeed()).toBe(1);
        expect(host.knob.style.transform).toBe("translate(0px, 0px)");
        host.emit("pointermove", { y: 520 });
        expect(host.lastInput()).toEqual([0, 0]);
      }
      host.emit("pointerdown", { y: 520 });
      host.render({ resetKey: "night" });
      expect(host.lastInput()).toEqual([0, 0]);
      host.emit("pointerdown", { y: 520 });
      host.window.dispatchEvent(new Event("blur"));
      expect(host.lastInput()).toEqual([0, 0]);
      expect(host.pendingFrames()).toBe(0);
      host.emit("pointerdown", { y: 520 });
      host.document.hidden = true;
      host.document.dispatchEvent(new Event("visibilitychange"));
      expect(host.lastInput()).toEqual([0, 0]);
      expect(host.pendingFrames()).toBe(0);
      host.document.hidden = false;
      host.emit("pointerdown", { y: 520 });
      host.render({ disabled: true });
      expect(host.lastInput()).toEqual([0, 0]);
      host.emit("pointerdown", { y: 520 });
      expect(host.lastInput()).toEqual([0, 0]);
    } finally { host.unmount(); }
  });

  test("one completed touch tap jumps, but a hold or returning drag cannot", () => {
    let jumps = 0;
    const host = joystickHost({ onJump: () => { jumps += 1; } });
    try {
      host.emit("pointerdown", { at: 1_000 });
      expect(jumps).toBe(0);
      host.emit("pointerup", { at: 1_060 });
      host.emit("lostpointercapture", { at: 1_061 });
      expect(jumps).toBe(1);
      expect(host.lastInput()).toEqual([0, 0]);
      host.emit("pointerdown", { at: 1_200 });
      host.emit("pointermove", { at: 1_230, y: 520 });
      host.emit("pointermove", { at: 1_250 });
      host.emit("pointerup", { at: 1_270 });
      expect(jumps).toBe(1);
      host.emit("pointerdown", { at: 2_000 });
      host.emit("pointerup", { at: 2_500 });
      expect(jumps).toBe(1);
      host.emit("pointerdown", { pointerType: "pen", at: 3_000 });
      host.emit("pointerup", { pointerType: "pen", at: 3_060 });
      expect(jumps).toBe(2);
    } finally { host.unmount(); }
  });
});
