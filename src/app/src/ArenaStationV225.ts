import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, ShapeGeometry, Vector2 } from "three";
import envelope from "./data/arenaStationV225Envelopes.json";
import profile from "./data/arenaStationV225Profile.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { insideRingV225, stationPointV225, stationStructureV225, STATION_V225, type SiteBoxV225 } from "./arenaStationV225Structure";

export const ARENA_STATION_V225_CAMERAS = {
  arena: { position: [4740, 105, 1720], target: [4870, 21, 1510], spanM: 235 },
  station: { position: [5380, 70, 1615], target: [5309.548, 11.96, 1508.006], spanM: 135 },
};
function group(native: boolean, required: boolean): Group {
  const root = new Group(); root.name = `Arena and Warschauer station v225 ${required ? "required source bodies" : "recognition fittings"}${native ? " native" : ""}`;
  root.userData = { arenaStationV225: true, requiredBeforeNavigation: required,
    textureFree: true, fullStaticDetailOnTouch: true, blockNative: native,
    nativeMinecraft: native, keepInMinecraft: native, sourceOwnerIds: [profile.arena.id, profile.station.id],
    originalSourceSheetsRetained: true, sourceXZPreserved: true, sourceReceipt: "arena-station-v225-source.json",
    newScopeArea: 0, stationColumns: 28, stationOpenTrackLevel: true };
  return root;
}
/** Separate native representation: orthogonal member fragments, never rotated
 * smooth boxes. The same source course and structural complement are retained. */
function nativeRows(rows: readonly SiteBoxV225[]): number[][] {
  const result: number[][] = [];
  for (const [x, y, z, w, h, d, yaw, color] of rows) {
    const c = Math.cos(yaw), s = Math.sin(yaw), count = Math.max(1, Math.ceil(w / 1.5));
    for (let i = 0; i < count; i++) {
      const u = w * ((i + .5) / count - .5);
      result.push([x + c * u, y, z - s * u, Math.max(.12, Math.abs(c) * w / count + Math.abs(s) * d),
        h, Math.max(.12, Math.abs(s) * w / count + Math.abs(c) * d), color]);
    }
  }
  return result;
}
function addBoxes(root: Group, rows: SiteBoxV225[], native: boolean, name: string): void {
  const mesh = justicePalaceV183Boxes(native ? nativeRows(rows) : rows, native); mesh.name = name;
  root.add(mesh);
}
function beam(rows: SiteBoxV225[], a: number[], b: number[], y: number, h: number, d: number, color: number): void {
  rows.push([(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1]), h, d,
    -Math.atan2(b[1] - a[1], b[0] - a[0]), color]);
}
function station(root: Group, native: boolean): void {
  const s = STATION_V225, f = s.frame, rows = stationStructureV225();
  const yaw = -Math.atan2(f.dz, f.dx), ring = s.rings[0];
  // Exact OSM slab plans; complete rail void remains open below y=9.96.
  if (native) {
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x += 2)
      for (let z = Math.floor(Math.min(...zs)); z < Math.max(...zs); z += 2)
        if (insideRingV225(ring, x + 1, z + 1)) for (const [y, h, color] of [[10.96, 2, 0xb5b8b3], [19.76, .4, 0x707a76]])
          rows.push([x + 1, y, z + 1, 2, h, 2, 0, color]);
  } else {
    for (const [y, color] of [[11.96, 0xb5b8b3], [9.96, 0x939b97], [19.96, 0x707a76]]) {
      const shape = new Shape(ring.map(([x, z]) => new Vector2(x, -z)));
      const geometry = new ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2); geometry.translate(0, y, 0); geometry.deleteAttribute("uv");
      const day = new MeshBasicMaterial({ color, side: DoubleSide });
      const night = new MeshStandardMaterial({ color, side: DoubleSide, roughness: .85 });
      const mesh = new Mesh(geometry, day); mesh.name = `Warschauer exact source slab ${y}`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true }; root.add(mesh);
    }
  }
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    beam(rows, a, b, 10.96, 2, .16, 0xb5b8b3);
    beam(rows, a, b, 19.71, .5, .3, 0x707a76);
  }
  for (const side of [-1, 1]) {
    const [x, z] = stationPointV225(0, side * 13.8);
    rows.push([x, 15.8, z, 56, 7.2, .12, yaw, 0x658087]);
    for (let i = 0; i <= 28; i++) {
      const [px, pz] = stationPointV225(-28 + 2 * i, side * 13.94);
      rows.push([px, 15.8, pz, .12, 7.4, .2, yaw, 0xc3ccc9]);
    }
    for (const y of [12.2, 15.9, 19.5]) rows.push([x, y, z, 56, .12, .24, yaw, 0xd1d5cc]);
  }
  for (const u of [-28.1, 28.1]) {
    // West bridge entrance keeps a genuine open middle doorway.
    for (const v of [-9.6, 9.6]) {
      const [x, z] = stationPointV225(u, v);
      rows.push([x, 15.8, z, 8, 7.2, .12, yaw + Math.PI / 2, 0x658087]);
    }
    const a = stationPointV225(u, -13.8), b = stationPointV225(u, 13.8);
    beam(rows, a, b, 19.5, .3, .3, 0xd1d5cc);
    const p = stationPointV225(u, 0);
    rows.push([p[0], 17.5, p[1], 11.2, 3.8, .12, yaw + Math.PI / 2, 0x658087]);
    for (const v of [-12, -8, -4, 0, 4, 8, 12]) {
      const q = stationPointV225(u + (u > 0 ? .1 : -.1), v);
      rows.push([q[0], Math.abs(v) < 5 ? 17.5 : 15.8, q[1], .12, Math.abs(v) < 5 ? 3.8 : 7.4, .18, yaw, 0xc3ccc9]);
    }
  }
  for (let u = -25; u <= 25; u += 10) {
    const a = stationPointV225(u, -13.3), b = stationPointV225(u, 13.3);
    beam(rows, a, b, 19.2, .23, .23, 0xc6cec9);
    // Shallow segmented fish-belly lower chord under the flat roof.
    for (let i = 0; i < 8; i++) {
      const v = -13.3 + 26.6 * (i + .5) / 8;
      const p = stationPointV225(u, v);
      rows.push([p[0], 18.15 + .8 * (v / 13.3) ** 2, p[1], 26.6 / 8, .16, .16, yaw + Math.PI / 2, 0xaebbb7]);
    }
  }
  // The dated 2022 station photograph shows its name high on the east glazing.
  // Use original vector capitals without a font, logo or photographic texture.
  for (const path of letteringStrokePaths("WARSCHAUER STRASSE", .92)) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .13));
    for (let j = 0; j < n; j++) {
      const t = (j + .5) / n, v = -a[0] - (b[0] - a[0]) * t;
      const [x, z] = stationPointV225(native ? 28.8 : 28.36, v);
      rows.push([x, 18.25 + a[1] + (b[1] - a[1]) * t, z, .14, .14, .12, yaw + Math.PI / 2, 0xeff0df]);
    }
  }
  addBoxes(root, rows, native, "Warschauer 28 supports, elevated technical floor, glazed entrance hall and steel roof members");
}
/** Required complete source ownership, attached before old audited boxes yield. */
export function createArenaStationEnvelopesV225(native = false): Group {
  const root = group(native, true), arena = group(native, true); arena.name = "Uber Arena all 33 measured source parts v225";
  if (native) {
    const mesh = justicePalaceV183Boxes(envelope.blocks, true); mesh.name = "Uber Arena independent one metre source-surface runs"; arena.add(mesh);
  } else {
    const positions = new Float32Array(envelope.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0));
    const colors = new Float32Array(positions.length), tint = new Color(); let offset = 0;
    for (const surface of envelope.surfaces) {
      tint.setHex(surface.color);
      for (const triangle of surface.triangles) for (const p of triangle) {
        positions.set(p, offset); tint.toArray(colors, offset); offset += 3;
      }
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .8 });
    const mesh = new Mesh(geometry, day); mesh.name = "Uber Arena complete 646 measured sheets";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true }; arena.add(mesh);
  }
  root.add(arena);
  const hall = group(native, true); hall.name = "S-Bahnhof Warschauer Straße open hall v225"; station(hall, native); root.add(hall);
  return freezeStaticSceneTransforms(root);
}
/** Additive surface fittings, with unchanged detail for touch and pointer. */
export function createArenaStationV225(native = false): Group {
  const root = group(native, false), rows: SiteBoxV225[] = [], ring = profile.arena.frontPart;
  // The first fifty source vertices describe the exposed bowed front; the
  // return ring is the internal border of the measured foyer part.
  for (let i = 1; i < 50; i++) {
    const a = ring[i - 1], b = ring[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < .35) continue;
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    const aa = [a[0] + dz * .14, a[1] - dx * .14], bb = [b[0] + dz * .14, b[1] - dx * .14];
    for (const y of [15.6, 18.6, 21.6, 24.6, 27.7]) beam(rows, aa, bb, y, .09, .12, 0xd1dcdb);
    rows.push([aa[0], 21.65, aa[1], .1, 12.2, .16, -Math.atan2(dz, dx), 0xc9d2d0]);
    beam(rows, aa, bb, 14.8, .6, .35, 0xd8d7c9);
  }
  // Source-supported current name, drawn using the existing original vector
  // alphabet; exact trademark typography is deliberately not copied.
  const label = "UBER ARENA", height = 34 / letteringLayout(label, 1).totalWidthM;
  const signCourse = ring.slice(51, 65), lengths = signCourse.slice(1).map((p, i) => Math.hypot(p[0] - signCourse[i][0], p[1] - signCourse[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0), base = 33;
  const signPoint = (u: number): [number, number, number] => {
    let distance = total * .55 + u;
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i] || i === lengths.length - 1) {
        const a = signCourse[i], b = signCourse[i + 1], t = distance / lengths[i];
        const dx = (b[0] - a[0]) / lengths[i], dz = (b[1] - a[1]) / lengths[i], out = native ? 1.1 : .25;
        return [a[0] + (b[0] - a[0]) * t - dz * out, a[1] + (b[1] - a[1]) * t + dx * out, -Math.atan2(dz, dx)];
      }
      distance -= lengths[i];
    }
    throw new Error("Missing source facade course");
  };
  for (const path of letteringStrokePaths(label, height)) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .28));
    for (let j = 0; j < n; j++) {
      const t = (j + .5) / n, u = a[0] + (b[0] - a[0]) * t;
      const [x, z, yaw] = signPoint(u);
      rows.push([x, base + a[1] + (b[1] - a[1]) * t, z, .29, .29, .22, yaw, 0xf3f2e9]);
    }
  }
  addBoxes(root, rows, native, "Uber Arena bowed source glass mullions, stone band and current name");
  root.userData.additiveOnly = true;
  return freezeStaticSceneTransforms(root);
}
