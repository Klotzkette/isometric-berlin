import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import source from "./data/eurefV262.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type V = [number, number, number];
type Face = typeof source.faces[number];
export const EUREF_V262_PROFILE = Object.freeze({
  center: source.gasometer.center, bounds: [-1345, 3950, -980, 4315],
  camera: { position: [-1255, 132, 4345], target: [-1100, 30, 4137], spanM: 330 },
  gasometerCamera: { position: [-1160, 72, 4250], target: [-1057.14, 43, 4149.08], spanM: 125 },
  sourceSha256: source.sourceSha256, sourceOwners: source.buildings.map(b => b.id),
  status: source.status, frameHeightM: 78, terraceHeightM: 66, baseMantleHeightM: 16,
  framePosts: 24, frameRings: 7, fullStaticDetailOnTouch: true,
  budgetBytes: 2_100_000,
});

function inside(u: number, y: number, ring: number[][]): boolean {
  let found = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && u < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) found = !found;
  }
  return found;
}

/** Additive fittings around retained shells; eight historical roof corrections
 * are separately source-complete, exact-receipted ordinary city packets. */
export function createEurefCampusV262(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group();
  root.name = "EUREF campus v262 — current Gasometer and source-bound campus";
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true, additiveOnly: true,
    sourceGeometryRetained: true, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, eurefCampusV262: true, sourceOwners: EUREF_V262_PROFILE.sourceOwners };
  const matrices: number[] = [], colors: number[] = [];
  const m = new Matrix4(), scale = new Vector3(), position = new Vector3(), q = new Quaternion(), up = new Vector3(0, 1, 0), tint = new Color();
  const counts: Record<string, number> = {};
  function emit(at: number[], size: number[], yaw: number, color: number, role: string): void {
    m.makeRotationY(native ? 0 : yaw); m.scale(scale.set(size[0], size[1], size[2]));
    m.setPosition(at[0], at[1], at[2]); matrices.push(...m.elements);
    tint.setHex(color); colors.push(tint.r, tint.g, tint.b); counts[role] = (counts[role] ?? 0) + 1;
  }
  function beam(a: V, b: V, width: number, color: number, role: string): void {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], length = Math.hypot(dx, dy, dz);
    if (length < .00001) return;
    if (native) {
      // Independent staircase courses, never a rotated smooth primitive.
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / .95));
      for (let i = 0; i < n; i++) {
        const t = (i + .5) / n;
        emit([a[0] + dx * t, a[1] + dy * t, a[2] + dz * t],
          [Math.abs(dx) / n + width, Math.abs(dy) / n + width, Math.abs(dz) / n + width], 0, color, role);
      }
    } else {
      q.setFromUnitVectors(up, position.set(dx, dy, dz).normalize());
      m.compose(position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, scale.set(width, length, width));
      matrices.push(...m.elements); tint.setHex(color); colors.push(tint.r, tint.g, tint.b); counts[role] = (counts[role] ?? 0) + 1;
    }
  }
  function panel(f: Face, u: number, y: number, w: number, h: number, color: number, role: string, out = .16, depth = .085): void {
    if (![[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]].every(([du, dy]) => inside(u + du * w / 2, y + dy * h / 2, f.polygon))) return;
    const pad = native ? 1.5 + out : out;
    const point = (s: number): V => [f.a[0] + f.d[0] * s + f.n[0] * pad, y, f.a[1] + f.d[1] * s + f.n[1] * pad];
    if (!native) emit(point(u), [w, h, depth], -Math.atan2(f.d[1], f.d[0]), color, role);
    else {
      const n = Math.max(1, Math.ceil(w / 3.0));
      for (let i = 0; i < n; i++) emit(point(u - w / 2 + (i + .5) * w / n),
        [Math.max(.09, Math.abs(f.d[0]) * w / n + Math.abs(f.n[0]) * depth), h,
          Math.max(.09, Math.abs(f.d[1]) * w / n + Math.abs(f.n[1]) * depth)], 0, color, role);
    }
  }
  const glass = 0x597B82, pale = 0xD1CFBA, brick = 0xA96749, steel = 0x555F63;
  // Modern block rhythm and the historical industrial window fields use only
  // the exact measured exterior sheets; all bay dimensions remain estimates.
  for (const f of source.faces) {
    const historic = f.kind === "brick", timber = f.kind === "timber";
    const pitch = historic ? 3.6 : f.kind === "workshop" ? 3.8 : 3.1;
    const floor = historic ? 3.8 : f.kind === "office" ? 3.5 : 3.2;
    const n = Math.max(1, Math.round(f.length / pitch));
    const w = Math.min(historic ? 1.45 : 2.55, f.length / n * .78);
    // Source ground differs slightly per measured wing; stay within its face.
    for (let y = Math.max(3, f.lo) + 2.1; y < f.hi - 1.1; y += floor) for (let i = 0; i < n; i++) {
      const u = (i + .5) * f.length / n, h = historic ? 2.25 : 2.3;
      panel(f, u, y, w + .2, h + .18, historic ? 0xC48B67 : timber ? 0xB9986D : pale, "window-surround", .12);
      panel(f, u, y, w, h, glass, "campus-window", .23);
      panel(f, u, y, .065, h, historic ? 0xD4C8A9 : steel, "window-mullion", .29);
      if (historic) {
        panel(f, u, y + .35, w, .065, 0xD4C8A9, "industrial-transom", .31);
        panel(f, u, y - h / 2 - .12, w + .3, .12, 0xD7BE9D, "brick-sill", .32, .2);
      }
    }
    for (const y of [Math.max(3, f.lo) + .45, f.hi - .42]) panel(f, f.length / 2, y, f.length - .14, .18,
      historic ? brick : timber ? 0x8B6B47 : pale, "source-edge-cornice", .28, .18);
    if (!historic && f.kind !== "workshop") for (let y = Math.max(3, f.lo) + 3.6; y < f.hi - .5; y += floor)
      panel(f, f.length / 2, y, f.length - .12, .20, timber ? 0x937349 : 0xBEBEAD, "modern-floor-band", .30);
  }

  // Haus 14's curved elevations consist of tiny surveyed facets. Continuous
  // window ribbons follow that full source perimeter instead of dropping the
  // facets merely because ordinary rectangular bays do not fit on them.
  for (const building of source.buildings.filter(b => b.kind === "round-office")) for (const outline of building.rings) {
    const [bx, bz] = building.center;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, r = Math.hypot(mx - bx, mz - bz);
      const pad = native ? 1.7 : .15, nx = (mx - bx) / r, nz = (mz - bz) / r;
      for (let floor = 0; floor < 9; floor++) {
        const y = 3 + (floor + .5) * building.height / 9;
        const color = (i + floor) % 4 === 0 ? 0x9CA995 : 0x6F9191;
        const w = native ? Math.abs(dx) + Math.abs(nx) * .12 : length + .02;
        const d = native ? Math.abs(dz) + Math.abs(nz) * .12 : .1;
        emit([mx + nx * pad, y, mz + nz * pad], [Math.max(.06, w), building.height / 9 - .5, Math.max(.06, d)], -Math.atan2(dz, dx), color, "haus14-curved-window-ribbon");
        emit([mx + nx * (pad + .04), y + building.height / 18 - .16, mz + nz * (pad + .04)],
          [Math.max(.06, w), .32, Math.max(.06, d)], -Math.atan2(dz, dx), 0xD2D4B8, "haus14-curved-floor-band");
      }
    }
  }

  const [cx, ground, cz] = source.gasometer.center;
  const gas = source.buildings.find(b => b.kind === "gasometer")!;
  const ring = gas.rings[0];
  // The complete retained 65.484 m source envelope remains present. Its plan
  // follows the historic outer ring, unlike the inconsistent smaller OSM inner
  // body; facade fit is an explicit display reconciliation, not a glass survey.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const midx = (a[0] + b[0]) / 2, midz = (a[1] + b[1]) / 2, radial = Math.hypot(midx - cx, midz - cz);
    const nx = (midx - cx) / radial, nz = (midz - cz) / radial, offset = native ? 1.7 : .16;
    const at = (y: number, extra = 0): V => [midx + nx * (offset + extra), y, midz + nz * (offset + extra)];
    const skin = (y: number, h: number, color: number, role: string, w = length, extra = 0): void => {
      if (!native) emit(at(y, extra), [w, h, .10], -Math.atan2(dz, dx), color, role);
      else emit(at(y, extra), [Math.max(.17, Math.abs(dx) * w / length + Math.abs(nx) * .14), h,
        Math.max(.17, Math.abs(dz) * w / length + Math.abs(nz) * .14)], 0, color, role);
    };
    skin(ground + 8, 16, i % 3 === 0 ? 0x3E5A45 : 0x46634A, "historic-green-mantle");
    for (let j = 0; j < 13; j++) {
      const lo = ground + 16 + j * (49.484 / 13), high = ground + 16 + (j + 1) * (49.484 / 13);
      skin((lo + high) / 2, high - lo - .24, (i + j) % 7 < 2 ? 0x617D86 : 0x485F6D, "gasometer-current-glazing", length * .93);
      skin(high - .08, .16, 0xA6AFAC, "gasometer-floor-band", length, .08);
    }
    skin(ground + 40.8, 49.4, 0xABB4AF, "gasometer-vertical-mullion", .07, .13);
    skin(ground + 66.6, 1.1, 0x8BA1A2, "terrace-parapet", length, .11);
    // Terrace sits at the operator's approximately 66 m above local ground;
    // independent 0.52 m display reconciliation with the measured roof datum.
    if (native) {
      const n = Math.max(1, Math.ceil(length / 1.5));
      for (let j = 0; j < n; j++) emit([a[0] + dx * (j + .5) / n, ground + 65.95, a[1] + dz * (j + .5) / n],
        [Math.abs(dx) / n + 1.5, .1, Math.abs(dz) / n + 1.5], 0, 0xA0A59A, "terrace-edge");
    } else emit(at(ground + 65.95, -.5), [length + .04, .1, 1.2], -Math.atan2(dz, dx), 0xA0A59A, "terrace-edge");
  }
  const radius = native ? source.gasometer.nativeFrameRadiusEstimateM : source.gasometer.frameRadiusEstimateM;
  const point = (i: number, h: number): V => {
    const angle = 2 * Math.PI * i / 24;
    return [cx + Math.cos(angle) * radius, ground + h, cz + Math.sin(angle) * radius];
  };
  // 24 uprights, seven horizontal rings and six diagonal-braced storeys are
  // documented structural counts. Member widths/ring heights are estimates.
  const levels = [0, 13, 26, 39, 52, 65, 78];
  for (let i = 0; i < 24; i++) {
    // Unsplit vertical native posts avoid pointless stacked hidden cubes.
    emit(point(i, 39), [.48, 78, .48], 0, steel, "gasometer-frame-post");
    for (const h of levels) {
      beam(point(i, h + .14), point(i + 1, h + .14), .30, steel, "gasometer-ring-girder");
      if (h > 0) beam(point(i, h - .28), point(i + 1, h - .28), .12, 0x8B9390, "gasometer-ring-flange");
    }
    for (let j = 0; j < 6; j++) {
      beam(point(i, levels[j] + .55), point(i + 1, levels[j + 1] - .55), .12, 0x727B7B, "gasometer-cross-brace");
      beam(point(i + 1, levels[j] + .55), point(i, levels[j + 1] - .55), .12, 0x727B7B, "gasometer-cross-brace");
    }
    for (const h of [13, 26, 39, 52, 65, 78]) emit(point(i, h), [.83, .7, .83], 0, 0x6E7775, "gasometer-post-collar");
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .82, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0);
  mesh.count = colors.length / 3; mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = native ? "Independent axis-aligned EUREF facade and Gasometer frame blocks" : "Measured-facade EUREF fittings and open 78 m Gasometer frame";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native,
    blockNative: native, keepInMinecraft: native, roleCounts: counts, fullStaticDetailOnTouch: true };
  root.add(mesh); return freezeStaticSceneTransforms(root);
}
