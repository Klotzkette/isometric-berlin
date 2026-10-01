import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
} from "three";
import source from "./data/concertHallsSource.json";
import { CONCERT_HALL_PROFILE } from "./concertHallsProfile";
import { addBox, createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import { createLetteringTexture } from "./drawnLettering";
import { markArchitecturalInk } from "./architecturalInk";

// Verified by the focused geometry test. Keep this initializer pure: the
// geometry worker imports world constructors for navigation but never builds
// these hall factories, and must not retain their source mesh JSON for a count.
export const CONCERT_HALL_RENDER_BUDGET = /* @__PURE__ */ Object.freeze({
  sourceParts: 27,
  sourcePolygons: 288,
  sourceTriangles: 846,
  goldJoints: 453,
  nativeBlocks: 7097,
});

/** Both mobile and desktop use the same complete source surfaces and details. */
export function createConcertHalls(): Group {
  const group = new Group();
  group.name = "Philharmonie and Kammermusiksaal exact source surfaces";
  group.userData.concertHalls = CONCERT_HALL_PROFILE;
  group.userData.renderBudget = CONCERT_HALL_RENDER_BUDGET;
  const builder = createBuilder();
  for (const surface of source.surfaceGroups) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(surface.triangles.flat(2), 3));
    paintGeometry(geometry, surface.color);
    builder.parts.push(geometry);
  }
  // Each joint terminates on the actual curved roof edge. No floating bars,
  // broad façade screens, generated roof cones or horizontal radial spokes.
  const jointBuilder = createBuilder();
  for (const [x, y, z, height, yaw, color] of source.goldJoints) {
    addBox(jointBuilder, color, x, y, z, 0.085, height, 0.075, yaw, false);
  }
  for (const [x, y, z, width, height, yaw] of source.foyerWindows) {
    addBox(jointBuilder, 0x68888c, x, y, z, width, height, .10, yaw, false);
    for (const u of [-width / 2, 0, width / 2]) {
      addBox(jointBuilder, 0xe5e8de, x + Math.cos(yaw) * u, y, z - Math.sin(yaw) * u, .10, height + .14, .15, yaw, false);
    }
    for (const v of [-height / 2, height / 2]) addBox(jointBuilder, 0xe5e8de, x, y + v, z, width + .15, .10, .15, yaw, false);
  }
  // The independent wraparound canopy is an overhead slab, not an occupied
  // volume. Retain its exact source top/outline; a shallow fascia and two
  // photo-bounded support positions articulate the open entrance below it.
  for (const [a, b] of source.canopyEdges) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([
      ...a, ...b, b[0], b[1] - .35, b[2],
      ...a, b[0], b[1] - .35, b[2], a[0], a[1] - .35, a[2],
    ], 3));
    paintGeometry(geometry, 0xe7e8df);
    builder.parts.push(geometry);
  }
  for (const [x,z,topY] of [[-236.25,1070.3,8.904],[-227.05,1083.4,8.904],[-204.35,979.0,7.35],[-200.4,969.9,7.1]]) addBox(jointBuilder, 0xe7e8df, x, (4.1 + topY) / 2, z, .38, topY - 4.1, .38, 0, false);
  const body = finishDrawnGroup(builder, { name: "Concert halls measured shells" })!;
  body.traverse((object) => {
    if (object instanceof Mesh) {
      // Source surface winding is retained; both sides remain visible at
      // shallow façade junctions without duplicating source triangles.
      for (const material of [object.userData.dayMaterial, object.userData.nightMaterial]) {
        if (material) material.side = DoubleSide;
      }
    }
  });
  group.add(body);
  const joints = finishDrawnGroup(jointBuilder, { name: "Concert halls gold panel seams" });
  if (joints) group.add(joints);

  const edges = new BufferGeometry();
  edges.setAttribute("position", new Float32BufferAttribute(source.roofEdges.flat(2), 3));
  const ink = new LineSegments(edges, markArchitecturalInk(new LineBasicMaterial({ color: 0x727a7a }), "detail"));
  ink.name = "Concert halls true roof folds and silver edges";
  group.add(ink);
  group.add(createEntrances());
  return group;
}

function createEntrances(): Group {
  const group = new Group();
  const builder = createBuilder();
  for (const entrance of CONCERT_HALL_PROFILE.mainEntrances) {
    const [a, b] = entrance.wall;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const length = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
    // The relevant westward-facing exterior normal is perpendicular to the
    // exact supporting source wall; OSM entrance points are nearby anchors.
    const nx = -Math.abs(dz / length), nz = dx * Math.sign(dz) / length;
    const x = (a[0] + b[0]) / 2 + nx * 0.13;
    const z = (a[1] + b[1]) / 2 + nz * 0.13;
    const width = length - 0.8;
    const centreY = entrance.groundY + entrance.heightM / 2;
    addBox(builder, 0x5d797d, x, centreY, z, width, entrance.heightM, 0.13, yaw, false);
    for (let bay = 0; bay <= 8; bay++) {
      const offset = -width / 2 + width * bay / 8;
      addBox(builder, 0xd7dcda, x + dx / length * offset, centreY, z + dz / length * offset, 0.11, entrance.heightM + 0.12, 0.19, yaw, false);
    }
    for (const height of [0.14, entrance.heightM * .72, entrance.heightM]) {
      addBox(builder, 0xd7dcda, x, entrance.groundY + height, z, width + .2, .11, .2, yaw, false);
    }
    // Narrow white lintel belongs to the low foyer, rather than a deep gold
    // canopy projected from the high concert-shell wall.
    addBox(builder, 0xe7e8df, x, entrance.groundY + entrance.heightM + .28, z, width + .65, .38, .42, yaw, false);
    const text = entrance.name.toUpperCase();
    const texture = createLetteringTexture({ text, bandWidthM: width - .3, bandHeightM: .35,
      capHeightM: .24, fieldColor: "#e7e8df", letterColor: "#293332", texelsPerMetre: 120 });
    const label = new Mesh(new PlaneGeometry(width - .3, .35), new MeshBasicMaterial({ map: texture, color: texture ? 0xffffff : 0xe7e8df, side: DoubleSide }));
    label.name = `${text} entrance lettering`;
    label.userData.lettering = text;
    label.userData.kulturforumEntrance = true;
    label.userData.fallbackWithoutCanvas = texture === null;
    label.position.set(x + nx * .23, entrance.groundY + entrance.heightM + .28, z + nz * .23);
    label.rotation.y = Math.atan2(nx, nz);
    group.add(label);
    for (let bay = 0; bay < 8; bay++) {
      const offset = -width / 2 + width * (bay + .78) / 8;
      addBox(builder, 0xc9d0ca, x + dx / length * offset + nx * .13, entrance.groundY + 1.25, z + dz / length * offset + nz * .13, .07, .5, .08, yaw, false);
    }
  }
  group.add(finishDrawnGroup(builder, { name: "Concert halls mapped main entrance glass doors" })!);
  return group;
}

/** Independent blocks trace the exact sloping source surfaces; no hidden fill. */
export function createMinecraftConcertHalls(): Group {
  const root = new Group();
  root.name = "Philharmonie and Kammermusiksaal native surface blocks";
  root.userData.concertHalls = CONCERT_HALL_PROFILE;
  const blocks = [...source.nativeBlocks.map(([x, y, z, color]) => [x, y, z,
    source.foyerWindows.some(([wx,wy,wz]) => Math.abs(y-wy) < 1.15 && (x-wx)**2 + (z-wz)**2 < 2.2**2) ? 0x68888c : color, source.nativeBlockM]), ...nativeEntranceBlocks()];
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  const dayMaterial = new MeshBasicMaterial();
  const nightMaterial = new MeshStandardMaterial({ flatShading: true, roughness: .93 });
  const mesh = new InstancedMesh(geometry, dayMaterial, blocks.length);
  mesh.name = "Concert halls source-native gold white and silver blocks";
  mesh.userData.blockNative = true;
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  const matrix = new Matrix4(), color = new Color();
  blocks.forEach(([x, y, z, tone, size], index) => {
    matrix.makeScale(size, size, size);
    matrix.setPosition(x, y, z);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.setHex(tone));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return root;
}

function nativeEntranceBlocks(): number[][] {
  const blocks: number[][] = [];
  for (const entry of CONCERT_HALL_PROFILE.mainEntrances) {
    const [a, b] = entry.wall;
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const columns = Math.floor(length - 1), height = 3;
    const nx = -Math.abs(dz / length), nz = dx * Math.sign(dz) / length;
    for (let column = 0; column < columns; column++) {
      const u = (column + .5) / columns;
      for (let row = 0; row <= height; row++) {
        const color = row === height || column === 0 || column === columns - 1 ? 0xe7e8df : 0x5d797d;
        blocks.push([a[0] + dx * u + nx * .5, entry.groundY + row + .5, a[1] + dz * u + nz * .5, color, 1]);
      }
    }
  }
  for (const [x,z,topY] of [[-236.25,1070.3,9],[-227.05,1083.4,9],[-204.35,979.0,7.5],[-200.4,969.9,7.5]]) for (let y=4.6;y<topY;y++) blocks.push([x,y,z,0xe7e8df,1]);
  return blocks;
}
