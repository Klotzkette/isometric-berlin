import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, TOUCH, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ts from "typescript";
import {
  beginJoystickTap,
  cancelJoystickTap,
  createJoystickTapState,
  endJoystickTap,
  moveJoystickTap,
} from "../src/joystickGestures";
import { isPedestrianSprintDoubleActivation } from "../src/pedestrianNavigation";

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
  onInput: (x: number, y: number) => void;
  onTouchDoubleTap?: () => void;
  onDoubleActivate?: () => void;
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
};

function nativePointer(type: string, options: PointerOptions = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: options.id ?? 1,
    pointerType: options.pointerType ?? "touch",
    isPrimary: true,
    button: options.button ?? 0,
    clientX: options.x ?? 78, clientY: options.y ?? 564,
    pageX: options.x ?? 78, pageY: options.y ?? 564,
  });
  Object.defineProperty(event, "timeStamp", { value: options.at ?? 1_000 });
  return event;
}

function joystickHost(overrides: Partial<Props> = {}) {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const window = new EventTarget();
  const pad = new ElementHost(document);
  const knob = new ElementHost(document);
  pad.child = knob;
  const values: [number, number][] = [];
  const props: Props = {
    disabled: false, resetKey: "day", label: "Joystick",
    onInput: (x, y) => values.push([x, y]), ...overrides,
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
      isPrimary: native.isPrimary, button: native.button,
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
    unmount: () => hooks.forEach((hook) => hook.cleanup?.()),
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

  test("desktop mouse retains forward, strafe, release and sprint without accepting right clicks", () => {
    let sprints = 0;
    let jumps = 0;
    const host = joystickHost({
      onDoubleActivate: () => { sprints += 1; },
      onTouchDoubleTap: () => { jumps += 1; },
    });
    try {
      const mouse = { pointerType: "mouse" };
      // A rejected secondary click neither moves nor seeds a sprint pair.
      expect(host.emit("pointerdown", { ...mouse, button: 2, y: 520, at: 1_000 }).stopped).toBeTrue();
      host.emit("pointermove", { ...mouse, y: 520, at: 1_010 });
      expect(host.values).toHaveLength(0);
      expect(host.pad.captures.size).toBe(0);
      expect(host.pad.rectReads).toBe(0);

      host.emit("pointerdown", { ...mouse, y: 520, at: 1_200 });
      expect(sprints).toBe(0);
      expect(host.lastInput()![0]).toBe(0);
      expect(host.lastInput()![1]).toBe(1);
      expect(host.pad.hasPointerCapture(1)).toBeTrue();
      host.emit("pointermove", { ...mouse, x: 122, at: 1_220 });
      expect(host.lastInput()![0]).toBe(1);
      expect(host.lastInput()![1]).toBeCloseTo(0, 10);
      host.emit("pointerup", { ...mouse, x: 122, at: 1_240 });
      expect(host.lastInput()).toEqual([0, 0]);
      expect(host.pad.hasPointerCapture(1)).toBeFalse();

      host.emit("pointerdown", { ...mouse, at: 1_350 });
      expect(sprints).toBe(1);
      host.emit("pointerup", { ...mouse, at: 1_390 });
      expect(host.lastInput()).toEqual([0, 0]);
      expect(jumps).toBe(0);
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
        host.emit("pointerdown", { y: 520 });
        expect(host.lastInput()![1]).toBe(1);
        host.emit(type);
        expect(host.lastInput()).toEqual([0, 0]);
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
      host.emit("pointerdown", { y: 520 });
      host.render({ disabled: true });
      expect(host.lastInput()).toEqual([0, 0]);
      host.emit("pointerdown", { y: 520 });
      expect(host.lastInput()).toEqual([0, 0]);
    } finally { host.unmount(); }
  });

  test("completed touch double-tap still jumps once and a drag cannot become a tap", () => {
    let jumps = 0;
    const host = joystickHost({ onTouchDoubleTap: () => { jumps += 1; } });
    const tap = (at: number) => {
      host.emit("pointerdown", { at });
      host.emit("pointerup", { at: at + 60 });
      host.emit("lostpointercapture", { at: at + 61 });
    };
    try {
      tap(1_000);
      expect(jumps).toBe(0);
      host.emit("pointerdown", { at: 1_200 });
      expect(jumps).toBe(0);
      host.emit("pointerup", { at: 1_260 });
      expect(jumps).toBe(1);
      expect(host.lastInput()).toEqual([0, 0]);
      tap(2_000);
      host.emit("pointerdown", { at: 2_200 });
      host.emit("pointermove", { at: 2_230, y: 520 });
      host.emit("pointermove", { at: 2_250 });
      host.emit("pointerup", { at: 2_270 });
      expect(jumps).toBe(1);
      tap(2_400);
      expect(jumps).toBe(1);
    } finally { host.unmount(); }
  });
});
