import {
  BoxGeometry, Color, DynamicDrawUsage, Frustum, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  Sphere, Vector3, type Camera, type Object3D,
} from "three";
import { HAUPTBAHNHOF_ACCESS, hauptbahnhofDoorApproachAt } from "./HauptbahnhofAccessProfile";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291 } from "./HbfCirculationV291";

type Point = readonly [number, number, number];
export type HbfMotionDescriptorV291 =
  | { kind: "doors"; side: -1 | 1; translations: Point[] }
  | { kind: "lift"; shaftIndexes: number[]; initialFloors: number[] }
  | { kind: "escalator"; from: Point; to: Point; direction: -1 | 1 };
type Frame = { native: boolean; bakedWorld: boolean };
type MovingMesh = Mesh | InstancedMesh;
type Target = { mesh: MovingMesh; descriptor: HbfMotionDescriptorV291; baseline: Float32Array | null; initialY: number };
type Owner = { root: Object3D; frame: Frame; targets: Target[]; inverse: Matrix4; sphere: Sphere; lastSeconds: number; eligible: boolean };

export const HBF_MOTION_FRAME_MS_V291 = 50;
export const HBF_LIFT_DWELL_SECONDS_V291 = 3;
export const HBF_LIFT_SPEED_MPS_V291 = 1.8;
export const HBF_ESCALATOR_SPEED_MPS_V291 = 0.5;
const LIFT_STOPS_V291 = [4, 3, 2, 1, 0, 1, 2, 3, 4] as const;
const DOOR_SIDES_V291 = [-1, 1] as const;
const liftLevels = HBF_CIRCULATION_V291.levels;
const liftStopTimes = LIFT_STOPS_V291.reduce<number[]>((times, stop, index) => {
  if (index === 0) return [0];
  const previousStop = LIFT_STOPS_V291[index - 1];
  times.push(times[index - 1] + HBF_LIFT_DWELL_SECONDS_V291 +
    Math.abs(liftLevels[stop].topLocalY - liftLevels[previousStop].topLocalY) / HBF_LIFT_SPEED_MPS_V291);
  return times;
}, []);

type LiftTrip = {
  shaftIndex: number;
  from: number;
  to: number;
  floor: number;
  phase: "waiting" | "riding";
};

export type HbfLiftRide = LiftTrip | (Omit<LiftTrip, "phase"> & { phase: "arrived" });

/** All five real stops, with a finite dwell at each end and intermediate floor. */
export function hbfLiftFloorAtV291(seconds: number, shaftIndex: number): number {
  return liftFloorAtPhase(Math.max(0, Number.isFinite(seconds) ? seconds : 0) + shaftIndex * 7.1);
}

function liftFloorAtPhase(phase: number): number {
  const levels = liftLevels;
  const stops = LIFT_STOPS_V291;
  const period = liftStopTimes[stops.length - 1];
  let time = (phase % period + period) % period;
  for (let index = 0; index < stops.length - 1; index++) {
    const from = levels[stops[index]].topLocalY;
    const to = levels[stops[index + 1]].topLocalY;
    if (time <= HBF_LIFT_DWELL_SECONDS_V291) return from;
    time -= HBF_LIFT_DWELL_SECONDS_V291;
    const duration = Math.abs(to - from) / HBF_LIFT_SPEED_MPS_V291;
    if (time <= duration) return from + (to - from) * time / duration;
    time -= duration;
  }
  return levels[4].topLocalY;
}

/** Reduced motion keeps functional access immediate, with no closing on a visitor. */
export function hbfDoorOpenFractionV291(current: number, wantsOpen: boolean, dt: number, immediate = false): number {
  const target = wantsOpen ? 1 : 0;
  if (immediate) return target;
  const duration = wantsOpen ? HAUPTBAHNHOF_ACCESS.doorOpenSeconds : HAUPTBAHNHOF_ACCESS.doorCloseSeconds;
  const delta = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0)) / duration;
  return wantsOpen ? Math.min(1, current + delta) : Math.max(0, current - delta);
}

/** Cloneable descriptors survive Worker transfer. Only the tiny moving buffers stay dynamic. */
export function markHbfMotionFrameV291(root: Object3D, native: boolean, bakedWorld = false): void {
  root.userData.hbfMotionFrameV291 = { native, bakedWorld } satisfies Frame;
}

export function markHbfMovingMeshV291(mesh: MovingMesh, descriptor: HbfMotionDescriptorV291): void {
  mesh.userData.hbfMotionV291 = descriptor;
  mesh.userData.hbfMovingFixtureV291 = true;
  mesh.castShadow = false;
  if (mesh instanceof InstancedMesh) mesh.instanceMatrix.setUsage(DynamicDrawUsage);
}

/** One shared clock across families, called only by the existing viewer frame loop. */
export function createHbfStationRuntimeV291() {
  const owners = new Map<Object3D, Owner>();
  const projection = new Matrix4(), frustum = new Frustum(), frameMatrix = new Matrix4();
  const cameraWorld = new Vector3(), cameraLocal = new Vector3(), scale = new Vector3(1, 1, 1);
  const frameRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), HBF_CIRCULATION_V291.frame.rotationDegrees * Math.PI / 180);
  const bakedFrame = new Matrix4().compose(new Vector3(...HBF_CIRCULATION_V291.frame.anchorWorld), frameRotation, scale);
  const doorOpen = [0, 0];
  const liftOffsets = Array<number>(HBF_CIRCULATION_V291.shafts.length).fill(0);
  const posedLiftFloors = liftOffsets.map((_, index) => hbfLiftFloorAtV291(0, index));
  let liftTrip: LiftTrip | null = null;
  let liftPassenger: HbfLiftRide | null = null;
  let seconds = 0, lastTimestamp: number | null = null, lastPaint: number | null = null;
  let previousNative: boolean | null = null;
  let disposed = false;
  const liftFloor = (index: number) => liftTrip?.shaftIndex === index
    ? liftTrip.floor : liftFloorAtPhase(seconds + index * 7.1 + liftOffsets[index]);
  const pose = (owner: Owner, selection: "all" | "doors" | "mechanical" = "all"): void => {
    for (const target of owner.targets) {
      const { mesh, descriptor, baseline } = target;
      if (selection === "doors" && descriptor.kind !== "doors") continue;
      if (selection === "mechanical" && descriptor.kind === "doors") continue;
      if (mesh instanceof InstancedMesh && baseline) {
        const array = mesh.instanceMatrix.array;
        for (let row = 0; row < mesh.count; row++) {
          const offset = row * 16;
          if (descriptor.kind === "doors") {
            const delta = descriptor.translations[row];
            const fraction = doorOpen[descriptor.side < 0 ? 0 : 1];
            array[offset + 12] = baseline[offset + 12] + delta[0] * fraction;
            array[offset + 13] = baseline[offset + 13] + delta[1] * fraction;
            array[offset + 14] = baseline[offset + 14] + delta[2] * fraction;
          } else if (descriptor.kind === "lift") {
            const index = descriptor.shaftIndexes[row];
            posedLiftFloors[index] = liftFloor(index);
            array[offset + 13] = baseline[offset + 13] + posedLiftFloors[index] - descriptor.initialFloors[row];
          } else {
            const from = descriptor.from, to = descriptor.to;
            const run = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
            const phase = descriptor.direction * seconds * HBF_ESCALATOR_SPEED_MPS_V291 / run;
            const t = ((row / mesh.count + phase) % 1 + 1) % 1;
            array[offset + 12] = from[0] + (to[0] - from[0]) * t;
            array[offset + 13] = from[1] + (to[1] - from[1]) * t - 0.08;
            array[offset + 14] = from[2] + (to[2] - from[2]) * t;
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
      } else if (descriptor.kind === "lift") {
        const index = descriptor.shaftIndexes[0];
        posedLiftFloors[index] = liftFloor(index);
        mesh.position.y = target.initialY + posedLiftFloors[index] - descriptor.initialFloors[0];
        mesh.updateMatrix();
      }
    }
    if (selection !== "doors") owner.lastSeconds = seconds;
  };
  return {
    hasLiftCabins(native: boolean): boolean {
      for (const owner of owners.values()) {
        if (owner.eligible && owner.frame.native === native &&
          owner.targets.some(target => target.descriptor.kind === "lift")) return true;
      }
      return false;
    },
    requestLiftRide(shaftIndex: number, from: number, to: number): boolean {
      if (disposed || liftTrip || from === to || !HBF_CIRCULATION_V291.shafts[shaftIndex] ||
        !liftLevels[from] || !liftLevels[to]) return false;
      liftTrip = { shaftIndex, from, to, floor: posedLiftFloors[shaftIndex], phase: "waiting" };
      liftPassenger = liftTrip;
      return true;
    },
    cancelLiftRide(): void {
      // The cabin completes its movement even if the visitor changes modes.
      liftPassenger = null;
    },
    get liftRide(): HbfLiftRide | null { return liftPassenger; },
    get liftAvailable(): boolean { return !liftTrip; },
    liftCabinFloor(index: number): number { return posedLiftFloors[index]; },
    register(root: Object3D): void {
      if (disposed) return;
      root.traverse(object => {
        const frame = object.userData.hbfMotionFrameV291 as Frame | undefined;
        if (!frame || owners.has(object)) return;
        const targets: Target[] = [];
        object.traverse(child => {
          const descriptor = child.userData.hbfMotionV291 as HbfMotionDescriptorV291 | undefined;
          if (!descriptor || !(child instanceof Mesh)) return;
          if (child instanceof InstancedMesh) child.instanceMatrix.setUsage(DynamicDrawUsage);
          targets.push({ mesh: child, descriptor,
            baseline: child instanceof InstancedMesh ? new Float32Array(child.instanceMatrix.array) : null,
            initialY: child.position.y });
        });
        if (!targets.length) return;
        const owner: Owner = { root: object, frame, targets, inverse: new Matrix4(), sphere: new Sphere(new Vector3(0, 0, 0), 115), lastSeconds: -1, eligible: false };
        owners.set(object, owner);
        pose(owner);
      });
    },
    release(root: Object3D): void {
      root.traverse(object => { owners.delete(object); });
    },
    update(timestamp: number, camera: Camera, native: boolean, reducedMotion: boolean, suspended: boolean): boolean {
      if (disposed || !Number.isFinite(timestamp)) return false;
      const familyChanged = previousNative !== native;
      previousNative = native;
      camera.getWorldPosition(cameraWorld);
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection, camera.coordinateSystem);
      let active = false, doorChanged = false;
      const dt = lastTimestamp === null ? 0 : Math.max(0, Math.min(.1, (timestamp - lastTimestamp) / 1000));
      for (const owner of owners.values()) {
        owner.eligible = false;
        if (owner.frame.native !== native) continue;
        let visible = true;
        for (let p: Object3D | null = owner.root; p; p = p.parent) if (!p.visible) visible = false;
        owner.root.updateWorldMatrix(true, false);
        frameMatrix.copy(owner.root.matrixWorld);
        if (owner.frame.bakedWorld) frameMatrix.multiply(bakedFrame);
        owner.inverse.copy(frameMatrix).invert();
        cameraLocal.copy(cameraWorld).applyMatrix4(owner.inverse);
        const nearby = cameraLocal.lengthSq() < 450 * 450;
        const sphere = owner.sphere;
        sphere.center.set(0, 0, 0).applyMatrix4(frameMatrix);
        const onScreen = nearby && frustum.intersectsSphere(sphere);
        owner.eligible = !suspended && visible && (onScreen || cameraLocal.lengthSq() < 120 * 120);
        if (owner.eligible) active = true;
        if (!suspended && visible && owner.targets.some(target => target.descriptor.kind === "doors")) for (const side of DOOR_SIDES_V291) {
          const index = side < 0 ? 0 : 1;
          const wantsOpen = hauptbahnhofDoorApproachAt(cameraLocal.x, cameraLocal.y, cameraLocal.z, side);
          const immediate = reducedMotion || (wantsOpen && Math.abs(cameraLocal.z - side * 90) <= 4);
          const next = hbfDoorOpenFractionV291(doorOpen[index], wantsOpen, dt, immediate);
          if (next !== doorOpen[index]) { doorOpen[index] = next; doorChanged = true; }
        }
      }
      if (suspended || !active) { lastTimestamp = null; lastPaint = null; return false; }
      if (lastTimestamp !== null && !reducedMotion) seconds += dt;
      lastTimestamp = timestamp;
      const due = lastPaint === null || timestamp - lastPaint >= HBF_MOTION_FRAME_MS_V291;
      const animate = !reducedMotion && due;
      const trip = liftTrip;
      let reachedStop = false;
      if (trip) {
        const stop = liftLevels[trip.phase === "waiting" ? trip.from : trip.to].topLocalY;
        const remaining = stop - trip.floor;
        const step = HBF_LIFT_SPEED_MPS_V291 * dt;
        if (reducedMotion || Math.abs(remaining) <= step) {
          reachedStop = true;
          trip.floor = stop;
          if (trip.phase === "waiting") trip.phase = "riding";
          else {
            const stopIndex = LIFT_STOPS_V291.indexOf(trip.to as typeof LIFT_STOPS_V291[number]);
            const phase = liftStopTimes[stopIndex] ?? 0;
            liftOffsets[trip.shaftIndex] = phase - seconds - trip.shaftIndex * 7.1;
            liftTrip = null;
            if (liftPassenger) liftPassenger = { ...trip, phase: "arrived" };
          }
        } else trip.floor += Math.sign(remaining) * step;
      }
      let changed = false;
      for (const owner of owners.values()) {
        if (!owner.eligible) continue;
        if (familyChanged || (reducedMotion && owner.lastSeconds !== seconds)) { pose(owner); changed = true; }
        else {
          if (animate || reachedStop) { pose(owner, "mechanical"); changed = true; }
          if (doorChanged) { pose(owner, "doors"); changed = true; }
        }
      }
      if (due) lastPaint = timestamp;
      return changed;
    },
    dispose(): void { disposed = true; owners.clear(); lastTimestamp = null; lastPaint = null; },
    get size(): number { return owners.size; },
    get elapsedSeconds(): number { return seconds; },
  };
}

/** Independent cardinal moving fixtures for the native family, never rotated cubes. */
export function createHbfNativeMovingFixturesV291(): Group {
  const root = new Group();
  root.name = "Minecraft Hauptbahnhof moving doors, steps and panoramic cabins v291";
  markHbfMotionFrameV291(root, true, true);
  const geometry = new BoxGeometry(1, 1, 1);
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .5 });
  const glassDay = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .42, depthWrite: false });
  const glassNight = new MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .32, depthWrite: false, roughness: .26 });
  const matrix = new Matrix4(), color = new Color();
  const batch = (name: string, rows: { point: Point; size: Point; color: number }[], glass = false): InstancedMesh => {
    const mesh = new InstancedMesh(geometry, glass ? glassDay : day, rows.length);
    mesh.name = name;
    rows.forEach((row, index) => {
      matrix.makeScale(...row.size); matrix.setPosition(...row.point);
      mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, color.setHex(row.color));
    });
    mesh.userData.dayMaterial = glass ? glassDay : day; mesh.userData.nightMaterial = glass ? glassNight : night;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    // A fixed bound covers every stop/step phase, including the deep floor.
    mesh.boundingSphere = new Sphere(new Vector3(...HBF_CIRCULATION_V291.frame.anchorWorld), 115);
    root.add(mesh); return mesh;
  };
  const angle = HBF_CIRCULATION_V291.frame.rotationDegrees * Math.PI / 180;
  for (const side of [-1, 1] as const) {
    const rows: { point: Point; size: Point; color: number }[] = [], translations: Point[] = [];
    for (const centre of [-1.745, 1.745]) for (const leafSide of [-1, 1]) for (let panel = 0; panel < 2; panel++) {
      const closedX = centre + leafSide * (.2875 + panel * .575);
      const openX = centre + leafSide * 1.4375;
      rows.push({ point: hbfLocalToWorldV291([closedX, 2.7, side * 89.1 + panel * .14]), size: [.52, 4.9, .34], color: 0x789da5 });
      translations.push([(openX - closedX) * Math.cos(angle), 0, -(openX - closedX) * Math.sin(angle)]);
    }
    markHbfMovingMeshV291(batch("Minecraft Hauptbahnhof telescopic sliding entrance doors", rows), { kind: "doors", side, translations });
  }
  const cabinParts = [
    { glass: false, name: "Minecraft Hauptbahnhof six moving lift cabins", parts: [
      [0,.08,0,2.4,.16,2.4,0x98a6aa], [0,3.13,0,2.4,.16,2.4,0x98a6aa],
    ] },
    { glass: true, name: "Minecraft Hauptbahnhof moving lift cabin glass", parts: [
      [-1.05,1.6,0,.22,2.9,2.1,0x6c8f9a], [1.05,1.6,0,.22,2.9,2.1,0x6c8f9a],
      [0,1.6,-1.05,1.9,2.9,.2,0xa0bdc4], [0,1.6,1.05,1.9,2.9,.2,0xa0bdc4],
    ] },
  ];
  for (const { glass, name, parts } of cabinParts) {
    const rows: { point: Point; size: Point; color: number }[] = [];
    const shaftIndexes: number[] = [], initialFloors: number[] = [];
    HBF_CIRCULATION_V291.shafts.forEach((shaft, shaftIndex) => {
      const floor = hbfLiftFloorAtV291(0, shaftIndex);
      const centre = hbfLocalToWorldV291([shaft.x, 0, shaft.z]);
      for (const [dx, dy, dz, w, h, d, color] of parts) {
        rows.push({ point: [centre[0] + dx, centre[1] + floor + dy, centre[2] + dz], size: [w, h, d], color });
        shaftIndexes.push(shaftIndex);
        initialFloors.push(floor);
      }
    });
    markHbfMovingMeshV291(batch(name, rows, glass), { kind: "lift", shaftIndexes, initialFloors });
  }
  for (const flight of HBF_CIRCULATION_V291.flights) {
    if (flight.kind !== "escalator") continue;
    const from = hbfLocalToWorldV291(flight.from), to = hbfLocalToWorldV291(flight.to);
    const run = Math.hypot(to[0]-from[0], to[1]-from[1], to[2]-from[2]);
    const count = Math.max(8, Math.ceil(run / .55));
    // A cap is wide across its own flight, including the new east-west upper
    // flights. Bake that footprint into cardinal dimensions instead of turning
    // a cube or applying the north-south cap dimensions to every heading.
    const horizontal = Math.hypot(to[0]-from[0],to[2]-from[2]);
    const ux = (to[0]-from[0])/horizontal, uz = (to[2]-from[2])/horizontal;
    const capWidth = flight.widthM-.75, capDepth = .5;
    const capSize: Point = [Math.abs(uz)*capWidth+Math.abs(ux)*capDepth,.16,
      Math.abs(ux)*capWidth+Math.abs(uz)*capDepth];
    const rows = Array.from({ length: count }, (_, index) => ({ point: [from[0]+(to[0]-from[0])*index/count, from[1]+(to[1]-from[1])*index/count-.08, from[2]+(to[2]-from[2])*index/count] as Point, size: capSize, color: 0x78868b }));
    markHbfMovingMeshV291(batch("Minecraft moving escalator steps " + flight.id, rows), { kind: "escalator", from, to, direction: flight.direction });
  }
  return root;
}
