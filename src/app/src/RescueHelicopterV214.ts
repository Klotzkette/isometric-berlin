import {
  Box3, BoxGeometry, BufferAttribute, BufferGeometry, Camera, Color, CylinderGeometry,
  DynamicDrawUsage, Frustum, Group, Matrix4, Mesh, MeshBasicMaterial,
  Sphere, SphereGeometry, Vector3,
} from "three";

export type RescueHelipadV214 = { centre: readonly number[]; approach: readonly number[] };
export const RESCUE_HELICOPTER_V214 = Object.freeze({
  cycleSeconds: 64, approachHeightM: 20, approachDistanceM: 22,
  frameIntervalMs: 50, maxBufferBytes: 350_000,
});
const ease = (t: number) => { const s = Math.max(0, Math.min(1, t)); return s * s * (3 - 2 * s); };

/** Illustrated repeatable approach, touchdown, dwell and departure, not a real flight route. */
export function rescueHelicopterPoseV214(seconds: number, pose = { height: 20, distance: 22 }): typeof pose {
  const t = ((seconds % 64) + 64) % 64;
  if (t < 22) {
    const progress = ease(t / 22);
    pose.height = 20 * (1 - progress); pose.distance = 22 * (1 - progress);
  } else if (t < 32) {
    pose.height = 0; pose.distance = 0;
  } else if (t < 45) {
    pose.height = 20 * ease((t - 32) / 13); pose.distance = 0;
  } else {
    pose.height = 20; pose.distance = 22 * ease((t - 45) / 19);
  }
  return pose;
}

/** A single small moving mesh: one reusable position buffer, no textures/timers/shadow rebuilds. */
export function createRescueHelicopterV214(pad: RescueHelipadV214, native = false): Group {
  const root = new Group(); root.name = "Red rescue helicopter landing at Bundeswehrkrankenhaus v214";
  root.userData = { rescueHelicopterV214: true, illustrativeFlight: true, textureFree: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: native, elapsedSeconds: 0, heightAbovePad: 20 };
  const local: number[] = [], colors: number[] = [], moving: number[] = [];
  const color = new Color(), normal = new Vector3(), light = new Vector3(-.4, 1, -.25).normalize();
  const add = (geometry: BufferGeometry, hex: number, motion = 0) => {
    const position = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    const index = geometry.index;
    for (let j = 0; j < (index?.count ?? position.count); j++) {
      const i = index ? index.getX(j) : j;
      local.push(position.getX(i), position.getY(i), position.getZ(i)); moving.push(motion);
      normal.fromBufferAttribute(normals, i);
      color.setHex(hex).multiplyScalar(.68 + .32 * Math.max(0, normal.dot(light)));
      colors.push(color.r, color.g, color.b);
    }
    geometry.dispose();
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, hex: number, motion = 0, yaw = 0) => {
    const geometry = new BoxGeometry(w, h, d); geometry.rotateY(yaw).translate(x, y, z); add(geometry, hex, motion);
  };
  const ellipsoid = (x: number, y: number, z: number, w: number, h: number, d: number, hex: number) => {
    if (native) { box(x, y, z, w * 1.8, h * 1.8, d * 1.8, hex); return; }
    add(new SphereGeometry(1, 16, 8).scale(w, h, d).translate(x, y, z), hex);
  };
  const strut = (from: number[], to: number[], radius: number, hex: number) => {
    const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
    const geometry = native ? new BoxGeometry(radius * 2, direction.length(), radius * 2)
      : new CylinderGeometry(radius, radius, direction.length(), 6);
    const rotation = new Matrix4().lookAt(a, b, new Vector3(0, 1, 0));
    // Cylinder's long axis is Y; orient directly to the segment.
    geometry.rotateX(Math.PI / 2).applyMatrix4(rotation).translate((a.x+b.x)/2, (a.y+b.y)/2, (a.z+b.z)/2);
    add(geometry, hex);
  };
  // Original generic medical-aircraft illustration, not a copy of a local operator's livery.
  ellipsoid(0, 1.85, 0, 1.16, 1.02, 2.6, 0xbd272c);
  ellipsoid(0, 2.13, -1.48, .99, .74, 1.15, 0x245668);
  box(0, 1.22, -1.82, 1.67, .18, 1.48, 0xd93536);
  box(0, 2.36, -2.3, .09, 1.0, .09, 0xbb262b);
  for (const side of [-1, 1]) {
    box(side * 1.065, 2.02, -.32, .10, .67, .93, 0x245668);
    box(side * 1.102, 1.36, -.32, .09, .57, .97, 0xd63c3f);
    box(side * 1.15, 1.49, -.65, .04, .065, .23, 0xe3e1d1);
    // White fields carry visible red crosses on both cabin sides.
    box(side * 1.073, 1.87, 1.0, .15, .83, .83, 0xfaf7ed);
    box(side * 1.155, 1.87, 1.0, .025, .59, .19, 0xd52229);
    box(side * 1.16, 1.87, 1.0, .025, .19, .59, 0xd52229);
    ellipsoid(side * .52, 2.95, .54, .42, .32, 1.12, 0xc52e32);
    box(side * .55, 2.97, 1.5, .52, .28, .28, 0x303a3c);
    strut([side * .8, 1.18, -.8], [side * 1.18, .22, -.8], .075, 0x8e9697);
    strut([side * .8, 1.18, 1.0], [side * 1.18, .22, 1.0], .075, 0x8e9697);
    strut([side * 1.18, .22, -2.05], [side * 1.18, .22, 1.9], .10, 0x909795);
    strut([side * 1.18, .22, -2.05], [side * 1.18, .47, -2.45], .10, 0x909795);
  }
  strut([0, 2.1, 1.8], [0, 2.85, 5.95], .22, 0xc12e32);
  box(0, 3.28, 5.9, .18, 2.0, .72, 0xc42c31);
  box(0, 2.63, 4.9, 2.45, .12, .59, 0xdf4843);
  box(0, 3.62, .24, .17, 1.1, .17, 0x555d5c);
  box(0, 4.18, .24, .57, .19, .57, 0x909a97);
  for (let blade = 0; blade < 4; blade++) {
    const angle = blade * Math.PI / 2;
    box(Math.cos(angle)*2.7, 4.3, .24-Math.sin(angle)*2.7, 4.8, .055, .23, 0x313b3e, 1, angle);
    box(Math.cos(angle)*5.08, 4.3, .24-Math.sin(angle)*5.08, .28, .059, .24, 0xf0d17d, 1, angle);
  }
  box(.21, 3.25, 5.9, .09, 1.34, .11, 0x323b3d, 2);
  box(.21, 3.25, 5.9, .09, .11, 1.34, 0x323b3d, 2);

  const retained = new Float32Array(local), roles = new Uint8Array(moving);
  const geometry = new BufferGeometry();
  const positions = new BufferAttribute(new Float32Array(retained.length), 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positions); geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  const day = new MeshBasicMaterial({ vertexColors: true });
  const night = new MeshBasicMaterial({ vertexColors: true, color: 0xb3c5d3 });
  const aircraft = new Mesh(geometry, day); aircraft.name = "Medical airframe, red crosses and two moving rotors";
  aircraft.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, rescueHelicopterV214: true };
  aircraft.castShadow = false; root.add(aircraft);
  const [cx, cy, cz] = pad.centre, length = Math.hypot(...pad.approach);
  const ax = pad.approach[0] / length, az = pad.approach[1] / length;
  // Local -Z is the nose, aimed from the approach point toward the pad.
  const yaw = Math.atan2(ax, az), c = Math.cos(yaw), s = Math.sin(yaw);
  const bounds = new Sphere(new Vector3(cx+ax*11, cy+12, cz+az*11), 30);
  geometry.boundingSphere = bounds.clone(); geometry.boundingBox = bounds.getBoundingBox(new Box3());
  const projection = new Matrix4(), frustum = new Frustum(), pose = { height: 20, distance: 22 };
  let elapsed = 0, lastTimestamp: number | undefined, lastPaint = -Infinity, waterLevel = -Infinity;
  const write = () => {
    rescueHelicopterPoseV214(elapsed, pose);
    // A submerged landing pad becomes a holding approach in the fictional flood mode.
    if (waterLevel > cy) pose.height = Math.max(pose.height, waterLevel-cy+4);
    const angle = elapsed * 9, rc = Math.cos(angle), rs = Math.sin(angle);
    const tc = Math.cos(angle*1.6), ts = Math.sin(angle*1.6);
    for (let i = 0; i < roles.length; i++) {
      let x=retained[i*3], y=retained[i*3+1], z=retained[i*3+2];
      if (roles[i] === 1) { const oldX=x; z-=.24; x=oldX*rc+z*rs; z=z*rc-oldX*rs+.24; }
      else if (roles[i] === 2) { const oldY=y-3.25; z-=5.9; y=oldY*tc-z*ts+3.25; z=oldY*ts+z*tc+5.9; }
      positions.setXYZ(i, cx+ax*pose.distance+x*c+z*s, cy+pose.height+y, cz+az*pose.distance+z*c-x*s);
    }
    positions.needsUpdate = true;
    root.userData.elapsedSeconds = elapsed; root.userData.heightAbovePad = pose.height;
  };
  write();
  root.userData.update = (timestamp: number, camera: Camera, reducedMotion = false, floodLevel?: number): boolean => {
    const nextWaterLevel = Number.isFinite(floodLevel) ? floodLevel! : -Infinity;
    const environmentChanged = nextWaterLevel !== waterLevel;
    waterLevel = nextWaterLevel;
    if (environmentChanged) write();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const onScreen = root.visible && frustum.setFromProjectionMatrix(projection).intersectsSphere(bounds);
    if (!onScreen || reducedMotion) {
      lastTimestamp = undefined; return environmentChanged && onScreen;
    }
    if (lastTimestamp !== undefined) elapsed = (elapsed + Math.min(.1, Math.max(0, (timestamp-lastTimestamp)/1000))) % 64;
    lastTimestamp = timestamp;
    if (timestamp-lastPaint < RESCUE_HELICOPTER_V214.frameIntervalMs) return environmentChanged;
    lastPaint=timestamp; write(); return true;
  };
  root.userData.bufferBytes = retained.byteLength + roles.byteLength + positions.array.byteLength + geometry.getAttribute("color").array.byteLength;
  root.updateMatrixWorld(true); root.traverse(object => { object.matrixAutoUpdate=false; });
  return root;
}
