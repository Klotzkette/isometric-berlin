import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  MINECRAFT_UNTER_DEN_LINDEN_ENTRANCE_GROUP_NAME, UNTER_DEN_LINDEN_ENTRANCE_DESCENT_M,
  UNTER_DEN_LINDEN_ENTRANCE_GROUP_NAME, UNTER_DEN_LINDEN_ENTRANCE_RUNS,
  UNTER_DEN_LINDEN_ENTRANCE_SOURCE, UNTER_DEN_LINDEN_ENTRANCE_REGIONS, unterDenLindenOpeningIntersectsCell,
  UNTER_DEN_LINDEN_ENTRANCE_SURFACE_Y,
} from "./unterDenLindenEntrancesProfile";

type Point = [number, number, number];
type GroundSampler = (x: number, z: number) => number;

function buildEntrances(native: boolean, ground: GroundSampler): Group {
  const root = new Group();
  root.name = native ? MINECRAFT_UNTER_DEN_LINDEN_ENTRANCE_GROUP_NAME : UNTER_DEN_LINDEN_ENTRANCE_GROUP_NAME;
  root.userData = { textureFree: true, blockNative: native, keepInMinecraft: native,
    source: UNTER_DEN_LINDEN_ENTRANCE_SOURCE, entranceCount: 5, liftCount: 2,
    geometryStatus: UNTER_DEN_LINDEN_ENTRANCE_SOURCE.displayStatus };
  const boxes: { p: Point; s: Point; yaw: number; color: number }[] = [];
  const box = (p: Point, s: Point, color: number, yaw = 0) => {
    if (native) {
      const [x, y, z] = s, c = Math.abs(Math.cos(yaw)), t = Math.abs(Math.sin(yaw));
      boxes.push({ p, s: [Math.max(.12, x * c + z * t), y, Math.max(.12, x * t + z * c)], yaw: 0, color });
    } else boxes.push({ p, s, yaw, color });
  };
  const pavingVertices: number[] = [];
  for (const region of UNTER_DEN_LINDEN_ENTRANCE_REGIONS) {
    if (native) {
      // Only shallow exposed paving; every complete half-metre cell clears holes.
      const cell = .5;
      for (let x = region.minX; x < region.maxX; x += cell) for (let z = region.minZ; z < region.maxZ; z += cell) {
        if (unterDenLindenOpeningIntersectsCell(x, z, cell)) continue;
        box([x + cell / 2, ground(x + cell / 2, z + cell / 2) - .06, z + cell / 2], [cell, .12, cell], 0xc6c3b5);
      }
    } else {
      const outer = [[region.minX, region.minZ], [region.maxX, region.minZ], [region.maxX, region.maxZ], [region.minX, region.maxZ]];
      const rings = [outer, ...region.openings.map(opening => opening.ring)];
      const flat = rings.flat();
      for (const triangle of ShapeUtils.triangulateShape(rings[0].map(p => new Vector2(...p as [number, number])),
        rings.slice(1).map(r => r.map(p => new Vector2(...p as [number, number]))))) {
        for (const index of triangle) { const [x, z] = flat[index]; pavingVertices.push(x, ground(x, z), z); }
      }
    }
  }
  if (pavingVertices.length) {
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(pavingVertices, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ color: 0xc6c3b5, side: DoubleSide });
    const paving = new Mesh(geometry, day); paving.name = "Exact source-axis U-Bahn mouths in bounded replacement paving";
    paving.userData.dayMaterial = day; paving.userData.nightMaterial = new MeshStandardMaterial({ color: 0xc6c3b5, side: DoubleSide });
    paving.userData.textureFree = true; root.add(paving);
  }
  for (const run of UNTER_DEN_LINDEN_ENTRANCE_RUNS) {
    const base = ground(...run.top as [number, number]);
    const yaw = -Math.atan2(run.uz, run.ux), depth = UNTER_DEN_LINDEN_ENTRANCE_DESCENT_M;
    const point = (u: number, v: number, y: number): Point =>
      [run.top[0] + run.ux * u + run.nx * v, y, run.top[1] + run.uz * u + run.nz * v];
    const tread = run.length / run.stepCount, rise = depth / run.stepCount;
    const moving = "conveying" in run.tags;
    for (let step = 0; step < run.stepCount; step++) {
      box(point((step + .5) * tread, 0, base - step * rise - .1),
        [tread + .025, .2, run.width], moving ? 0x778687 : 0xb8b8ac, yaw);
      if (!native) box(point(step * tread + .03, 0, base - step * rise + .009),
        [.045, .018, run.width - .12], moving ? 0xb8b79b : 0xe8dfbe, yaw);
    }
    box(point(run.length - .2, 0, base - depth - .12), [.4, .24, run.width], 0x354648, yaw);
    for (const side of [-1, 1]) {
      const v = side * (run.width / 2 + .10);
      box(point(run.length / 2, v, base - depth / 2), [run.length, depth, .18], 0xaaa99c, yaw);
      box(point(run.length / 2, v, base + .17), [run.length, .34, .25], 0xc7c6b8, yaw);
      box(point(run.length / 2, v, base + 1.05), [run.length, native ? .15 : .07, .1], 0x657071, yaw);
      const posts = Math.ceil(run.length / 1.5);
      for (let i = 0; i <= posts; i++) box(point(i * run.length / posts, v, base + .65),
        [native ? .14 : .07, .8, .1], 0x657071, yaw);
    }
    box(point(run.length + .08, 0, base - depth / 2 + .15), [.16, depth + .3, run.width + .4], 0xaaa99c, yaw);
    // Upper mouth remains open. Only stair lanes receive a marker and tactile field.
    if (!moving) {
      const side = run.width / 2 + .4;
      box(point(-.3, side, base + 1.7), [.13, 3.4, .13], 0x53666c, yaw);
      box(point(-.3, side, base + 3.12), [.17, 1.05, 1.1], 0x23508c, yaw);
      for (const signSide of [-1, 1]) {
        for (const v of [-.26, .26]) box(point(-.3 + signSide * .1, side + v, base + 3.15), [.045, .56, .12], 0xf2f0e4, yaw);
        box(point(-.3 + signSide * .1, side, base + 2.91), [.045, .12, .56], 0xf2f0e4, yaw);
      }
      if ("tactile_paving" in run.tags && run.tags.tactile_paving === "yes") for (let line = 0; line < 8; line++) box(
        point(-.3 - line * .08, 0, base + .025), [.035, .035, run.width], 0xdfdbc7, yaw);
    }
  }
  for (const lift of UNTER_DEN_LINDEN_ENTRANCE_SOURCE.lifts) {
    const [x, z] = lift.point, base = ground(x, z), width = 2.6, depth = 2;
    const dx = lift.entrancePoint[0] - x, dz = lift.entrancePoint[1] - z;
    const length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length, yaw = -Math.atan2(uz, ux);
    const point = (u: number, v: number, y: number): Point => [x + ux * u - uz * v, y, z + uz * u + ux * v];
    box(point(0, 0, base + .1), [width + .15, .2, depth + .15], 0xc3c4b8, yaw);
    // Glazing uses opaque drawn colour fields to avoid transparent depth-sorting.
    for (const side of [-1, 1]) {
      box(point(0, side * depth / 2, base + 1.5), [width, 3, .08], 0x87a3a6, yaw);
      for (const end of [-1, 1]) box(point(end * width / 2, side * depth / 2, base + 1.5), [.12, 3, .12], 0x616e70, yaw);
    }
    box(point(-width / 2, 0, base + 1.5), [.08, 3, depth], 0x789699, yaw);
    box(point(width / 2, 0, base + 1.5), [.12, 3, .08], 0x616e70, yaw);
    box(point(0, 0, base + 3.08), [width + .2, .18, depth + .2], 0xaebdbb, yaw);
    box(point(width / 2 + .1, 0, base + 2.7), [.1, .35, .85], 0x25528b, yaw);
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const mesh = new InstancedMesh(geometry, day, boxes.length);
  const matrix = new Matrix4(), position = new Vector3(), scale = new Vector3(), rotation = new Quaternion(), colour = new Color();
  boxes.forEach(({ p, s, yaw, color }, i) => {
    matrix.compose(position.set(...p), rotation.setFromAxisAngle(new Vector3(0, 1, 0), yaw), scale.set(...s));
    mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, colour.setHex(color));
  });
  mesh.name = native ? "Mapped U-Bahn native stairs rails and lifts" : "Mapped U-Bahn stairs railings and lifts";
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .88 });
  mesh.userData.textureFree = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

export function createUnterDenLindenEntrances(ground: GroundSampler = () => UNTER_DEN_LINDEN_ENTRANCE_SURFACE_Y): Group { return buildEntrances(false, ground); }
export function createMinecraftUnterDenLindenEntrances(ground: GroundSampler = () => UNTER_DEN_LINDEN_ENTRANCE_SURFACE_Y): Group { return buildEntrances(true, ground); }
