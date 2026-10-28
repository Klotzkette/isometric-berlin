import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Frustum,
  Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Sphere, Vector3, type Camera, type Object3D,
} from 'three';
import placements from './data/zooAnimalsV282.json';
import { zooAnimalChamferedBoxV282, zooAnimalShapeV282, type ZooAnimalSpeciesV282 } from './zooAnimalShapesV282';
import {
  advanceZooAnimalClockV282, createZooAnimalClockV282, prepareZooAnimalRouteV282,
  sampleZooAnimalPoseV282, type ZooAnimalClockV282, type ZooAnimalPoseV282,
  type ZooAnimalRouteV282,
} from './zooAnimalMotionV282';

/** Exact authored members transferred from static owners, in world metres. */
export type RetainedZooAnimalV282 = {
  id: string; anchor: [number, number, number]; boxes: number[][];
  surfaces: { color: number; triangles: number[][][] }[];
  linearColors?: boolean;
  /** Original authored +X-facing orientation, in Three.js Y rotation radians. */
  heading?: number;
};
type Route = { id: string; siteId: string; routeXZ: number[][]; groundY: number; speed: number; phase: number };
type Placement = Route & { species: ZooAnimalSpeciesV282; variant?: string; habitatId: string };
type Data = { animals: Placement[]; retainedRoutes?: Route[] };
const data = placements as Data;
type Member = { row: number[]; gait: number; linear: boolean };
type DrawnLimb = { start: number; end: number; gait: number; top: number };
type Actor = {
  id: string; route: ZooAnimalRouteV282 | null; anchor: [number, number, number];
  pose: ZooAnimalPoseV282; members: Member[]; start: number; end: number;
  nativeStart: number; nativeEnd: number; heading: number; drawnLimbs: DrawnLimb[];
};
export type ZooAnimalHandleV282 = {
  root: Group; siteId: string; native: boolean; bounds: Sphere;
  update: (seconds: number) => void; dispose: () => void; disposed: boolean;
  geometryBytes: number; bufferCount: number;
  unregister?: () => void;
};

function prepare(route: Route): ZooAnimalRouteV282 {
  const points = route.routeXZ;
  const closed = points.length > 2 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1];
  return prepareZooAnimalRouteV282({ ...route, animalId: route.id,
    routeXZ: (closed ? points.slice(0, -1) : points) as [number, number][] });
}
function belongs(x: number, z: number, tileId?: string): boolean {
  return !tileId || tileId === 'outer187-' + Math.floor(x / 512) + '_' + Math.floor(z / 512);
}
function quarterX(x: number, z: number, q: number): number { return q === 0 ? x : q === 1 ? z : q === 2 ? -x : -z; }
function quarterZ(x: number, z: number, q: number): number { return q === 0 ? z : q === 1 ? -x : q === 2 ? -z : x; }
function gaitFor(part: string): number {
  if (part.startsWith('leg-')) return part === 'leg-front-left' || part === 'leg-back-right' ? 1 : -1;
  return 0;
}

/** Small independently owned batches; no architecture is marked dynamic. */
export function createZooAnimalsV282(
  siteId: 'zoo' | 'tierpark', native: boolean,
  retained: readonly RetainedZooAnimalV282[] = [], tileId?: string,
): Group {
  const root = new Group();
  root.name = (native ? 'Minecraft' : 'Drawn') + ' moving zoo animals v282 ' + siteId;
  const actors: Actor[] = [], positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const vertexMap = new Map<string, number>(), color = new Color();
  // The two families have independent primitive topology. Existing owners are
  // transferred verbatim; new drawn bodies have a low-poly rounded silhouette.
  const cube = new BoxGeometry(1, 1, 1), rounded = new BufferGeometry();
  const chamfered = zooAnimalChamferedBoxV282();
  rounded.setAttribute('position', new BufferAttribute(new Float32Array(chamfered.positions), 3));
  rounded.setIndex([...chamfered.indices]);
  const triangle = (actor: Actor, c: number, points: number[][], linear = false, memberKey = ''): void => {
    if (linear) color.setRGB((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255);
    else color.setHex(c);
    for (const p of points) {
      const x = p[0] - actor.anchor[0], y = p[1] - actor.anchor[1], z = p[2] - actor.anchor[2];
      const key = actor.id + ':' + memberKey + ':' + x + ',' + y + ',' + z + ':' + c + ':' + linear;
      let index = vertexMap.get(key);
      if (index === undefined) {
        index = positions.length / 3; vertexMap.set(key, index);
        positions.push(x, y, z); colors.push(color.r, color.g, color.b);
      }
      indices.push(index);
    }
  };
  const actorFor = (id: string, anchor: [number, number, number], route?: Route): Actor => {
    const actor: Actor = { id, route: route ? prepare(route) : null, anchor,
      pose: { x: anchor[0], y: anchor[1], z: anchor[2], quarterTurn: 0, gait: 0 }, members: [],
      start: positions.length / 3, end: 0, nativeStart: 0, nativeEnd: 0, heading: 0, drawnLimbs: [] };
    actors.push(actor); return actor;
  };
  const addBox = (actor: Actor, row: number[], organic = false, gait = 0, linear = false,
    joint?: { part: string; top: number }): void => {
    if (native) { actor.members.push({ row, gait, linear }); return; }
    const start = positions.length / 3;
    const g = organic ? rounded : cube, p = g.getAttribute('position'), ii = g.index;
    const count = ii ? ii.count : p.count, co = Math.cos(row[6]), si = Math.sin(row[6]);
    for (let i = 0; i < count; i += 3) {
      const tri: number[][] = [];
      for (let j = 0; j < 3; j++) {
        const k = ii ? ii.getX(i + j) : i + j, x = p.getX(k) * row[3], z = p.getZ(k) * row[5];
        tri.push([row[0] + co * x + si * z, row[1] + p.getY(k) * row[4], row[2] - si * x + co * z]);
      }
      triangle(actor, row[7], tri, linear, joint?.part);
    }
    if (gait && joint) actor.drawnLimbs.push({ start, end: positions.length / 3, gait, top: joint.top });
  };
  for (const old of retained) {
    const route = data.retainedRoutes?.find(r => r.id === old.id && r.siteId === siteId);
    const actor = actorFor(old.id, old.anchor, route);
    actor.heading = old.heading ?? 0;
    for (const row of old.boxes) addBox(actor, row, false, 0, old.linearColors);
    for (const surface of old.surfaces) for (const tri of surface.triangles) triangle(actor, surface.color, tri, old.linearColors);
    actor.end = positions.length / 3;
  }
  for (const item of data.animals) {
    if (item.siteId !== siteId || !belongs(item.routeXZ[0][0], item.routeXZ[0][1], tileId)) continue;
    const anchor: [number, number, number] = [item.routeXZ[0][0], item.groundY, item.routeXZ[0][1]];
    const actor = actorFor(item.id, anchor, item);
    const shape = zooAnimalShapeV282(item.species, item.variant), jointTops = new Map<string, number>();
    for (const part of shape) if (gaitFor(part.part))
      jointTops.set(part.part, Math.max(jointTops.get(part.part) ?? 0, part.y + part.h / 2));
    for (const part of shape) {
      const top = jointTops.get(part.part);
      addBox(actor, [anchor[0] + part.x, anchor[1] + part.y, anchor[2] + part.z,
        part.w, part.h, part.d, 0, part.color], part.part === 'body' || part.part === 'head', gaitFor(part.part), false,
        top === undefined ? undefined : { part: part.part, top });
    }
    actor.end = positions.length / 3;
  }
  cube.dispose(); rounded.dispose(); vertexMap.clear();
  if (!actors.length) return root;
  const baseline = new Float32Array(positions), live = new Float32Array(baseline.length);
  const positionAttribute = new BufferAttribute(live, 3).setUsage(DynamicDrawUsage);
  let surface: Mesh | null = null, instances: InstancedMesh | null = null, bytes = 0, buffers = 0;
  const materials = (vertexColors: boolean) => {
    const day = new MeshBasicMaterial({ color: 0xffffff, vertexColors, side: DoubleSide });
    const night = new MeshStandardMaterial({ color: 0xffffff, vertexColors, side: DoubleSide, roughness: .95, flatShading: true });
    return { day, night };
  };
  if (indices.length) {
    const g = new BufferGeometry(); g.setAttribute('position', positionAttribute);
    g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3)); g.setIndex(indices);
    const m = materials(true); surface = new Mesh(g, m.day);
    surface.name = 'Source-preserved and faceted moving animal surfaces';
    surface.userData = { dayMaterial: m.day, nightMaterial: m.night, textureFree: true };
    root.add(surface); bytes += live.byteLength + colors.length * 4 + g.index!.array.byteLength; buffers += 3;
  }
  const instanceCount = actors.reduce((n, a) => n + a.members.length, 0);
  if (instanceCount) {
    const g = new BoxGeometry(1, 1, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv');
    const m = materials(false); instances = new InstancedMesh(g, m.day, instanceCount);
    instances.instanceMatrix.setUsage(DynamicDrawUsage);
    let index = 0;
    for (const actor of actors) {
      actor.nativeStart = index;
      for (const { row, linear } of actor.members) {
        if (linear) color.setRGB((row[7] >> 16 & 255) / 255, (row[7] >> 8 & 255) / 255, (row[7] & 255) / 255);
        else color.setHex(row[7]);
        instances.setColorAt(index++, color);
      }
      actor.nativeEnd = index;
    }
    instances.name = 'Independent cardinal moving animal blocks';
    instances.userData = { dayMaterial: m.day, nightMaterial: m.night, textureFree: true };
    root.add(instances); bytes += instances.instanceMatrix.array.byteLength + instances.instanceColor!.array.byteLength +
      g.getAttribute('position').array.byteLength + g.index!.array.byteLength; buffers += 4;
  }
  // Construction arrays must not linger in the updater's closure environment.
  positions.length = 0; colors.length = 0; indices.length = 0;
  const matrix = new Matrix4();
  const bounds = new Sphere();
  // Bounds cover complete routes plus bodies, never just the sampled pose.
  const boundPoints: Vector3[] = [];
  let radius = 0;
  for (const actor of actors) {
    for (let i = actor.start * 3; i < actor.end * 3; i += 3) radius = Math.max(radius, Math.hypot(baseline[i], baseline[i + 1], baseline[i + 2]));
    for (const { row } of actor.members) radius = Math.max(radius,
      Math.hypot(row[0] - actor.anchor[0], row[1] - actor.anchor[1], row[2] - actor.anchor[2]) + Math.hypot(row[3], row[4], row[5]) / 2);
    if (actor.route) for (const [x, z] of actor.route.routeXZ) boundPoints.push(new Vector3(x, actor.route.groundY, z));
    else boundPoints.push(new Vector3(...actor.anchor));
  }
  bounds.setFromPoints(boundPoints); bounds.radius += radius + .1;
  if (surface) surface.geometry.boundingSphere = bounds.clone();
  if (instances) instances.boundingSphere = bounds.clone();
  const handle: ZooAnimalHandleV282 = {
    root, siteId, native, bounds, geometryBytes: bytes, bufferCount: buffers, disposed: false,
    update: seconds => {
      if (handle.disposed) return;
      for (const actor of actors) {
        const pose = actor.pose;
        if (actor.route) sampleZooAnimalPoseV282(actor.route, seconds, pose);
        else { pose.y = actor.anchor[1] + .012 * (1 - Math.cos(seconds * 1.3)); }
        // Retained members are in their original world-facing pose. Remove
        // that heading before applying the route direction, or they sidestep.
        const heading = actor.route ? actor.heading : 0;
        const q = ((pose.quarterTurn - Math.round(heading / (Math.PI / 2))) % 4 + 4) % 4;
        const angle = pose.quarterTurn * Math.PI / 2 - heading, co = Math.cos(angle), si = Math.sin(angle);
        for (let i = actor.start * 3; i < actor.end * 3; i += 3) {
          live[i] = pose.x + (native ? quarterX(baseline[i], baseline[i + 2], q) : co * baseline[i] + si * baseline[i + 2]);
          live[i + 1] = pose.y + baseline[i + 1];
          live[i + 2] = pose.z + (native ? quarterZ(baseline[i], baseline[i + 2], q) : -si * baseline[i] + co * baseline[i + 2]);
        }
        // All members of one limb share an affine shear: its body attachment
        // stays fixed while its foot moves, without separating foot and leg.
        // Sparse ranges own only new drawn limbs; retained source vertices
        // and the orthogonal native geometry keep their existing treatment.
        for (const limb of actor.drawnLimbs) for (let i = limb.start * 3; i < limb.end * 3; i += 3) {
          const stride = pose.gait * limb.gait * .05 * Math.max(0, 1 - baseline[i + 1] / limb.top);
          live[i] += co * stride;
          live[i + 2] -= si * stride;
        }
        if (instances) for (let i = 0; i < actor.members.length; i++) {
          const { row, gait } = actor.members[i], x = row[0] - actor.anchor[0] + pose.gait * gait * .05,
            z = row[2] - actor.anchor[2];
          matrix.makeScale(q % 2 ? row[5] : row[3], row[4], q % 2 ? row[3] : row[5]);
          matrix.setPosition(pose.x + quarterX(x, z, q), pose.y + row[1] - actor.anchor[1], pose.z + quarterZ(x, z, q));
          instances.setMatrixAt(actor.nativeStart + i, matrix);
        }
      }
      if (surface) positionAttribute.needsUpdate = true;
      if (instances) instances.instanceMatrix.needsUpdate = true;
    },
    dispose: () => { handle.disposed = true; handle.unregister?.(); },
  } as ZooAnimalHandleV282 & { unregister?: () => void };
  root.userData = { zooAnimalsV282: handle, animalIds: actors.map(a => a.id), textureFree: true,
    fullStaticDetailOnTouch: true, disposeZooAnimalsV282: () => handle.dispose() };
  handle.update(0);
  return root;
}

/** One runtime registry and one clock per zoo survive presentation remounts. */
export function createZooAnimalRuntimeV282() {
  const handles = new Map<ZooAnimalHandleV282, number>();
  const clocks = new Map<string, ZooAnimalClockV282>();
  const frustum = new Frustum(), projection = new Matrix4(), cameraPosition = new Vector3();
  const visible = (h: ZooAnimalHandleV282, camera: Camera, native: boolean): boolean => {
    if (h.disposed || h.native !== native || h.bounds.radius <= 0) return false;
    for (let p: Object3D | null = h.root; p; p = p.parent) if (!p.visible) return false;
    // All animal buffers use world metres; an outer packet's inverse-origin
    // child transform restores that space under its positioned parent.
    if (cameraPosition.distanceToSquared(h.bounds.center) > (3500 + h.bounds.radius) ** 2) return false;
    return frustum.intersectsSphere(h.bounds);
  };
  return {
    register(root: Object3D): void {
      root.traverse(object => {
        const h = object.userData.zooAnimalsV282 as (ZooAnimalHandleV282 & { unregister?: () => void }) | undefined;
        if (!h || h.disposed || handles.has(h)) return;
        h.unregister = () => handles.delete(h);
        if (!clocks.has(h.siteId)) clocks.set(h.siteId, createZooAnimalClockV282());
        const seconds = clocks.get(h.siteId)!.elapsedSeconds;
        handles.set(h, seconds); h.update(seconds);
      });
    },
    update(timestamp: number, camera: Camera, native: boolean, suspended: boolean): boolean {
      let changed = false;
      camera.getWorldPosition(cameraPosition);
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection, camera.coordinateSystem);
      for (const [site, clock] of clocks) {
        let active = false;
        if (!suspended) for (const h of handles.keys()) if (h.siteId === site && visible(h, camera, native)) { active = true; break; }
        const due = advanceZooAnimalClockV282(clock, timestamp, active);
        if (!due && !suspended) continue;
        for (const h of handles.keys()) if (h.siteId === site && visible(h, camera, native)
          && (due || handles.get(h) !== clock.elapsedSeconds)) {
          // A paused family switch still publishes the same shared pose once.
          // It neither advances the clock nor requests continuous frames.
          h.update(clock.elapsedSeconds); handles.set(h, clock.elapsedSeconds); changed = true;
        }
      }
      return changed;
    },
    dispose(): void { for (const h of handles.keys()) h.dispose(); handles.clear(); clocks.clear(); },
    get size(): number { return handles.size; },
  };
}
