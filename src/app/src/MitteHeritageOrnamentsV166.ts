import { Vector3 } from "three";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { mitteHeritageV166ParentOffset } from "./mitteHeritageV166Profile";

type P = [number, number, number];
type Sheet = { color: number; triangles: number[][][] };
export type MitteHeritageOrnamentRows = { boxes: number[][]; surfaces: Sheet[] };

export const MITTE_HERITAGE_ORNAMENT_V166_PROFILE = Object.freeze({
  heine: {
    osmNode: "1884384977", x: 1961.049, z: -1476.786, groundY: 3,
    approximateFigureHeight: 2.10, approximatePlinthHeight: 1.30,
    bronze: 0x454B42, limestone: 0xB4B09C,
    // Facing the photographed approach; heading remains a visual estimate.
    yaw: -0.99,
  },
  elisabeth: {
    frontA: [1775.406, -1525.68], frontB: [1793.749, -1528.219],
    groundY: 3, sourceRidgeY: 21.122, porticoWidth: 14, projection: 3.2,
    pierAxes: [-6.3, -3.78, -1.26, 1.26, 3.78, 6.3],
    pierWidth: .72, pierBottomY: 3.50, pierTopY: 11.4, pierFrontOffset: 2.6,
    stone: 0xC9C4B2,
  },
  jandorf: {
    osmWay: "33791235", parentId: "DEBE01YYK0000Dia", mainPartId: "DEBE3Dqh9NPHTUx9",
    // Circle fitted to the surveyed curved corner; crown dimensions are photographic estimates.
    cornerX: 1916.027, cornerZ: -1508.834, cornerRadius: 8.003,
    sourceEaveY: 27.053, sourceRidgeY: 32.825, crownBaseY: 30.1, crownTopY: 43.65,
    streetEdges: [[[1908.630, -1505.778], [1902.026, -1539.372]], [[1947.310, -1512.230], [1915.717, -1500.836]]],
    copper: 0x79998A, stone: 0xB8AD96,
  },
});

class Detail {
  boxes: number[][] = [];
  surfaces: Sheet[] = [];
  surfaceCellSize = .13;
  private nativeFaceCells = new Map<string, number[]>();
  constructor(readonly native: boolean) {}
  box(color: number, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0): void {
    if (!this.native || Math.abs(yaw) < 1e-10) {
      this.boxes.push([x, y, z, w, h, d, this.native ? 0 : yaw, color]);
      return;
    }
    // Independent axis-aligned stepped solids. No rotated matrix survives.
    const nx = Math.max(1, Math.ceil(w / .28)), nz = Math.max(1, Math.ceil(d / .28));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const u = (i + .5) * w / nx - w / 2, v = (j + .5) * d / nz - d / 2;
      this.boxes.push([x + Math.cos(yaw) * u + Math.sin(yaw) * v, y, z - Math.sin(yaw) * u + Math.cos(yaw) * v, w / nx, h, d / nz, 0, color]);
    }
  }
  face(color: number, ring: P[]): void {
    if (!this.native) {
      this.surfaces.push({ color, triangles: ring.slice(1, -1).map((p, i) => [ring[0], p, ring[i + 2]]) });
      return;
    }
    const size = this.surfaceCellSize;
    for (let t = 1; t < ring.length - 1; t++) {
      const a = new Vector3(...ring[0]), b = new Vector3(...ring[t]), c = new Vector3(...ring[t + 1]);
      const n = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)) / (size * 1.1)));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const p = a.clone().addScaledVector(b.clone().sub(a), i / n).addScaledVector(c.clone().sub(a), j / n);
        const k = [Math.round(p.x / size), Math.round(p.y / size), Math.round(p.z / size)];
        this.nativeFaceCells.set(`${size}:${k}`, [k[0] * size, k[1] * size, k[2] * size, size, size, size, 0, color]);
      }
    }
  }
  line(color: number, a: P, b: P, width: number): void {
    const av = new Vector3(...a), bv = new Vector3(...b), delta = bv.clone().sub(av);
    if (this.native) {
      const n = Math.max(1, Math.ceil(delta.length() / Math.max(.10, width)));
      for (let i = 0; i <= n; i++) {
        const p = av.clone().addScaledVector(delta, i / n);
        this.box(color, p.x, p.y, p.z, width, Math.max(width, Math.abs(delta.y) / n + .015), width);
      }
      return;
    }
    const axis = delta.normalize(), u = new Vector3().crossVectors(axis, Math.abs(axis.y) < .9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize().multiplyScalar(width / 2);
    const v = new Vector3().crossVectors(axis, u).normalize().multiplyScalar(width / 2);
    const ring = (p: Vector3): P[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => p.clone().addScaledVector(u, i).addScaledVector(v, j).toArray() as P);
    const start = ring(av), end = ring(bv);
    this.face(color, start); this.face(color, end);
    for (let i = 0; i < 4; i++) this.face(color, [start[i], start[(i + 1) % 4], end[(i + 1) % 4], end[i]]);
  }
  finish(): MitteHeritageOrnamentRows {
    this.boxes.push(...this.nativeFaceCells.values());
    return { boxes: this.boxes, surfaces: this.surfaces };
  }
}

function heine(g: Detail): void {
  const profile = MITTE_HERITAGE_ORNAMENT_V166_PROFILE.heine;
  const { x, z, yaw } = profile;
  const at = (u: number, y: number, v: number): P => [x - Math.cos(yaw) * u + Math.sin(yaw) * v, y, z + Math.sin(yaw) * u + Math.cos(yaw) * v];
  const box = (color: number, u: number, y: number, v: number, w: number, h: number, d: number) => { const p = at(u, y, v); g.box(color, ...p, w, h, d, yaw); };
  const line = (color: number, a: P, b: P, width: number) => g.line(color, at(...a), at(...b), width);
  const face = (color: number, points: P[]) => g.face(color, points.map(p => at(...p)));
  const bronze = profile.bronze, lit = 0x5B6354, dark = 0x30382F, stone = profile.limestone;

  // Limestone plinth and continuous bronze relief band, not a generic statue pole.
  box(0x8E9287, 0, 3.045, 0, 2.15, .09, 1.65);
  box(stone, 0, 3.37, 0, 1.96, .56, 1.42);
  box(stone, 0, 3.895, 0, 1.96, .49, 1.42);
  box(0xC2BEA9, 0, 4.225, 0, 2.00, .17, 1.45);
  for (const v of [-.72, .72]) box(dark, 0, 3.90, v, 1.96, .44, .04);
  for (const u of [-.99, .99]) box(dark, u, 3.90, 0, .04, .44, 1.42);
  for (const v of [-.75, .75]) for (let i = 0; i < 7; i++) {
    const u = -.81 + i * .245, h = i % 3 === 0 ? .16 : .11;
    // Small independent relief silhouettes; no poem or inscription reproduced.
    box(lit, u, 3.99, v, .065, .07, .045);
    line(bronze, [u, 3.95, v], [u + .035, 3.78, v], .045);
    line(lit, [u, 3.90, v], [u - .09, 3.93 + h * .3, v], .027);
    line(bronze, [u + .03, 3.78, v], [u + .09, 3.70, v], .035);
  }
  box(bronze, 0, 4.335, 0, 1.72, .05, 1.16);

  // Ten-sided changing cross-sections describe cloth, shoulder and limb forms.
  const tube = (color: number, centres: P[], radii: [number, number][]) => {
    const rings: P[][] = centres.map((c, i) => {
      const previous = new Vector3(...centres[Math.max(0, i - 1)]), next = new Vector3(...centres[Math.min(centres.length - 1, i + 1)]);
      const axis = next.sub(previous).normalize();
      const u = new Vector3().crossVectors(axis, Math.abs(axis.y) > .8 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)).normalize();
      const v = new Vector3().crossVectors(axis, u).normalize();
      return Array.from({ length: 10 }, (_, j) => {
        const t = j * Math.PI / 5;
        return new Vector3(...c).addScaledVector(u, Math.cos(t) * radii[i][0]).addScaledVector(v, Math.sin(t) * radii[i][1]).toArray() as P;
      });
    });
    face(color, rings[0]); face(color, rings[rings.length - 1]);
    for (let i = 1; i < rings.length; i++) for (let j = 0; j < 10; j++) face(j % 4 === 0 ? lit : color, [rings[i - 1][j], rings[i - 1][(j + 1) % 10], rings[i][(j + 1) % 10], rings[i][j]]);
  };
  const ellipsoid = (color: number, centre: P, radii: P) => {
    const rings = Array.from({ length: 7 }, (_, i) => Array.from({ length: 12 }, (_, j): P => {
      const a = -Math.PI / 2 + i * Math.PI / 6, b = j * Math.PI / 6;
      return [centre[0] + Math.cos(a) * Math.cos(b) * radii[0], centre[1] + Math.sin(a) * radii[1], centre[2] + Math.cos(a) * Math.sin(b) * radii[2]];
    }));
    for (let i = 1; i < rings.length; i++) for (let j = 0; j < 12; j++) face(color, [rings[i - 1][j], rings[i - 1][(j + 1) % 12], rings[i][(j + 1) % 12], rings[i][j]]);
  };

  // Stool legs and spaces between the diverging legs remain open.
  box(dark, 0, 4.94, -.18, .68, .085, .60);
  for (const u of [-.26, .26]) for (const v of [-.41, .02]) box(bronze, u, 4.64, v, .065, .56, .065);
  tube(bronze, [[-.18, 5.00, -.16], [-.44, 5.09, .02], [-.55, 5.02, .17]], [[.25, .20], [.23, .18], [.19, .16]]);
  tube(bronze, [[.17, 5.00, -.15], [.42, 5.01, .04], [.51, 4.97, .23]], [[.25, .20], [.23, .18], [.18, .16]]);
  tube(bronze, [[-.55, 5.02, .17], [-.52, 4.70, .21], [-.48, 4.44, .24]], [[.19, .17], [.15, .12], [.105, .11]]);
  tube(bronze, [[.51, 4.97, .23], [.63, 4.66, .36], [.77, 4.44, .46]], [[.19, .18], [.145, .12], [.105, .095]]);
  ellipsoid(bronze, [-.51, 4.425, .33], [.14, .075, .25]);
  ellipsoid(bronze, [.80, 4.425, .54], [.19, .075, .23]);
  tube(bronze, [[0, 5.00, -.12], [-.015, 5.22, -.13], [0, 5.61, -.15], [0, 5.76, -.12]], [[.34, .23], [.28, .21], [.40, .24], [.32, .19]]);
  // Broad coat skirts, lapels and sculpted folds.
  face(bronze, [[-.29, 5.26, .07], [-.48, 4.90, .06], [-.31, 4.70, -.04], [-.18, 5.00, .13]]);
  face(dark, [[.23, 5.28, .06], [.40, 4.93, .14], [.45, 4.67, -.04], [.24, 4.92, -.14]]);
  face(lit, [[-.30, 5.72, .055], [-.07, 5.50, .115], [-.04, 5.75, .105]]);
  face(lit, [[.29, 5.72, .05], [-.07, 5.50, .12], [.11, 5.74, .11]]);
  for (const a of [-.19, .16]) line(lit, [a, 5.15, .095], [a * 1.15, 5.44, .10], .016);
  line(lit, [-.44, 4.70, .32], [-.48, 4.95, .32], .020);
  line(lit, [.64, 4.63, .48], [.54, 4.90, .38], .020);

  // The asymmetrical declaiming pose is the monument's primary recognition cue.
  tube(bronze, [[-.32, 5.65, -.12], [-.56, 5.43, -.04], [-.91, 5.24, .10]], [[.17, .15], [.135, .12], [.085, .075]]);
  ellipsoid(bronze, [-1.00, 5.22, .15], [.13, .075, .10]);
  for (let i = 0; i < 4; i++) line(lit, [-1.07 + i * .025, 5.235, .21], [-1.095 + i * .025, 5.18, .245], .020);
  tube(bronze, [[.32, 5.66, -.12], [.58, 5.40, -.06], [.48, 5.77, .12]], [[.17, .15], [.145, .13], [.078, .075]]);
  ellipsoid(bronze, [.47, 5.82, .15], [.085, .13, .08]);
  for (let i = 0; i < 4; i++) line(lit, [.43 + i * .026, 5.81, .205], [.42 + i * .026, 5.92, .19], .019);
  // Neck, swept hair, projecting nose and restrained facial divisions.
  tube(bronze, [[-.015, 5.72, -.10], [-.025, 5.97, -.07]], [[.13, .115], [.105, .10]]);
  ellipsoid(bronze, [-.025, 6.13, -.075], [.195, .245, .17]);
  ellipsoid(dark, [-.04, 6.28, -.09], [.195, .10, .165]);
  ellipsoid(lit, [-.035, 6.095, .080], [.04, .08, .060]);
  line(dark, [-.13, 6.16, .073], [-.055, 6.15, .097], .017);
  line(dark, [.018, 6.15, .097], [.092, 6.17, .070], .017);
  line(dark, [-.091, 6.015, .067], [.035, 6.015, .078], .016);
  for (let i = 0; i < 5; i++) line(lit, [-.17 + i * .055, 6.28, .005], [-.15 + i * .05, 6.33, -.08], .015);
}

function elisabeth(g: Detail): void {
  const p = MITTE_HERITAGE_ORNAMENT_V166_PROFILE.elisabeth;
  const [a, b] = [p.frontA, p.frontB], dx = b[0] - a[0], dz = b[1] - a[1];
  const yaw = Math.atan2(-dz, dx), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
  const at = (u: number, y: number, v: number): P => [cx + Math.cos(yaw) * u + Math.sin(yaw) * v, y, cz - Math.sin(yaw) * u + Math.cos(yaw) * v];
  const box = (color: number, u: number, y: number, v: number, w: number, h: number, d: number) => { const q = at(u, y, v); g.box(color, ...q, w, h, d, yaw); };
  const face = (color: number, ring: P[]) => g.face(color, ring.map(q => at(...q)));
  const line = (color: number, a: P, b: P, width: number) => g.line(color, at(...a), at(...b), width);
  const stone = p.stone, light = 0xDAD5C1, shadow = 0xAEA995, roof = 0x777B72;
  // Shallow three-step approach under an open porch, with no facade infill.
  for (let i = 0; i < 3; i++) box(shadow, 0, 3.07 + i * .14, 1.85 - i * .17, 14.4 - i * .16, .14, 4.3 - i * .34);
  for (const u of p.pierAxes) {
    box(shadow, u, 3.45, p.pierFrontOffset, .92, .15, .92);
    box(stone, u, (p.pierBottomY + p.pierTopY) / 2, p.pierFrontOffset, p.pierWidth, p.pierTopY - p.pierBottomY, p.pierWidth);
    box(light, u, 11.38, p.pierFrontOffset, .80, .16, .80);
    box(light, u, 11.52, p.pierFrontOffset, .92, .16, .92);
  }
  box(stone, 0, 12.1, 1.6, 14, 1.0, 3.2);
  for (const [y, w, h] of [[11.61, 14.1, .18], [12.67, 14.25, .17], [12.92, 14.50, .20]]) box(light, 0, y, 1.6, w, h, 3.35);
  // Five open column gaps remain below the entablature; dentils above it.
  for (let i = 0; i < 54; i++) box(shadow, -6.9 + i * 13.8 / 53, 12.81, 3.29, .09, .12, .10);
  const base = 13.05, apex = 15.08;
  face(stone, [[-7.1, base, 3.22], [7.1, base, 3.22], [0, apex, 3.22]]);
  face(roof, [[-7.1, base, 0], [-7.1, base, 3.22], [0, apex, 3.22], [0, apex, 0]]);
  face(roof, [[7.1, base, 3.22], [7.1, base, 0], [0, apex, 0], [0, apex, 3.22]]);
  line(light, [-7.1, base, 3.31], [0, apex, 3.31], .22);
  line(light, [0, apex, 3.31], [7.1, base, 3.31], .22);
  line(shadow, [-6.6, base + .14, 3.35], [0, apex - .24, 3.35], .09);
  line(shadow, [0, apex - .24, 3.35], [6.6, base + .14, 3.35], .09);
  // Small palmettes and the main ridge cross visible in the photograph.
  for (const [u, y, v, size] of [[0, apex, 3.1, .42], [-7.05, base, 3.1, .25], [7.05, base, 3.1, .25], [0, p.sourceRidgeY, .1, .48]]) {
    for (let i = -3; i <= 3; i++) line(shadow, [u, y + .06, v], [u + i * size / 4, y + size * (1 - Math.abs(i) * .10), v], .065);
  }
  line(light, [0, p.sourceRidgeY + .45, .1], [0, p.sourceRidgeY + 1.70, .1], .075);
  line(light, [-.42, p.sourceRidgeY + 1.28, .1], [.42, p.sourceRidgeY + 1.28, .1], .075);
}

function jandorf(g: Detail): void {
  const p = MITTE_HERITAGE_ORNAMENT_V166_PROFILE.jandorf;
  const stone = p.stone, light = 0xCBC1AA, recess = 0x857D6B, glass = 0x526560, copper = p.copper;
  // Architectural cells may be coarser than the human figure's .13 m cells.
  g.surfaceCellSize = .30;
  type Front = { x: number; z: number; tx: number; tz: number; nx: number; nz: number; width: number; corner?: boolean };
  const fronts: Front[] = [];
  for (const [a, b] of p.streetEdges) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
    const bays = Math.round(length / 2.1), pitch = length / bays;
    for (let i = 0; i < bays; i++) fronts.push({ x: a[0] + tx * (i + .5) * pitch, z: a[1] + tz * (i + .5) * pitch, tx, tz, nx: tz, nz: -tx, width: pitch * .73 });
  }
  // The short surveyed corner facets are each below the generic facade cutoff;
  // windows follow the actual eight-metre-radius curve instead of a blank corner.
  for (let i = 0; i < 5; i++) {
    const a = 1.61 + (i + .5) * (2.75 - 1.61) / 5;
    fronts.push({ x: p.cornerX + Math.cos(a) * p.cornerRadius, z: p.cornerZ + Math.sin(a) * p.cornerRadius, tx: -Math.sin(a), tz: Math.cos(a), nx: Math.cos(a), nz: Math.sin(a), width: 1.43, corner: true });
  }
  for (const f of fronts) {
    const at = (u: number, y: number, out: number): P => [f.x + f.tx * u + f.nx * out, y, f.z + f.tz * u + f.nz * out];
    const box = (c: number, u: number, y: number, out: number, w: number, h: number, d: number) => g.box(c, ...at(u, y, out), w, h, d, Math.atan2(-f.tz, f.tx));
    const line = (c: number, a: P, b: P, w: number) => g.line(c, at(...a), at(...b), w);
    if (f.corner) {
      for (const y of [5.4, 9.65, 13.9, 18.15]) {
        box(light, 0, y, .12, f.width + .22, 3.37, .21);
        box(glass, 0, y, .25, f.width, 3.15, .13);
        box(light, 0, y, .34, .065, 3.15, .10);
        box(light, 0, y + .38, .35, f.width, .075, .10);
        box(light, 0, y - 1.73, .30, f.width + .25, .18, .32);
      }
      box(stone, -f.width / 2 - .17, 15.0, .19, .26, 23.2, .28);
    }
    // Three selling floors above the shopfront, then the small admin storey.
    // The relief band masks the generic upper pane rows on the two street faces.
    box(stone, 0, 23.375, .35, f.width + .24, 6.75, .14);
    const radius = f.width / 2, spring = 18.83;
    box(stone, 0, 19.53, .35, f.width + .24, 1.45, .14);
    const arch: P[] = Array.from({ length: 13 }, (_, i): P => {
      const a = Math.PI - i * Math.PI / 12; return [Math.cos(a) * radius, spring + Math.sin(a) * radius, .45];
    });
    g.face(glass, arch.map(q => at(...q)));
    for (let i = 0; i < arch.length - 1; i++) line(light, arch[i], arch[i + 1], .105);
    box(light, 0, spring + radius / 2, .49, .07, radius, .08);
    // Relief cartouches and broad capstones in the band over the arches.
    box(recess, 0, 21.50, .45, .64, .75, .07);
    for (const u of [-.33, .33]) box(light, u, 21.50, .49, .095, .86, .13);
    for (const y of [21.10, 21.90]) box(light, 0, y, .49, .74, .08, .13);
    box(stone, 0, 21.50, .55, .23, .38, .18);
    // Narrow administration-storey windows tucked below the broad roof eaves.
    box(light, 0, 24.70, .46, f.width + .16, 3.02, .20);
    box(glass, 0, 24.70, .59, f.width, 2.75, .13);
    box(light, 0, 24.70, .70, .07, 2.75, .10);
    box(light, 0, 25.32, .70, f.width, .07, .10);
  }

  // Octagonal corner roof rider. LoD2's four large roof sheets omit this crown;
  // all those sheets remain underneath the additive photographic estimate.
  const cx = p.cornerX, cz = p.cornerZ, rotation = Math.PI / 8;
  const at = (a: number, y: number, r: number): P => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
  const lathe = (profile: [number, number][], c: number) => {
    for (let k = 1; k < profile.length; k++) for (let i = 0; i < 8; i++) {
      const a = rotation + i * Math.PI / 4, b = a + Math.PI / 4;
      g.face(i % 3 === 0 ? c - 0x080807 : c, [at(a, ...profile[k - 1]), at(b, ...profile[k - 1]), at(b, ...profile[k]), at(a, ...profile[k])]);
    }
  };
  lathe([[30.1, 2.48], [32.9, 2.48]], 0x87998B);
  for (const y of [30.5, 31.0, 31.5, 32.0, 32.5]) lathe([[y, 2.49], [y + .055, 2.49]], 0x697C71);
  lathe([[32.9, 2.62], [33.15, 2.62]], 0x4F6258);
  for (let i = 0; i < 8; i++) {
    const a = rotation + i * Math.PI / 4, b = a + Math.PI / 4;
    g.face(0x394D46, [at(a, 33.15, 2.46), at(b, 33.15, 2.46), at(b, 34.42, 2.46), at(a, 34.42, 2.46)]);
    for (const t of [a, (a + b) / 2]) g.line(0xA4AC95, at(t, 33.13, 2.50), at(t, 34.45, 2.50), .095);
  }
  lathe([[34.40, 3.03], [34.66, 3.03], [35.25, 2.70], [36.15, 2.47], [37.0, 1.94], [37.45, 1.40]], copper);
  lathe([[37.45, 1.40], [38.72, 1.40]], 0x719082);
  lathe([[38.72, 1.70], [38.92, 1.70], [39.48, 1.51], [40.03, 1.32], [40.45, .84], [40.73, .28], [43.4, .035]], copper);
  for (let i = 0; i < 8; i++) {
    const a = rotation + i * Math.PI / 4;
    for (const [y0, r0, y1, r1] of [[34.68, 3.02, 35.25, 2.70], [35.25, 2.70, 36.15, 2.47], [36.15, 2.47, 37.45, 1.40], [38.95, 1.69, 40.45, .84]]) g.line(0x587869, at(a, y0, r0), at(a, y1, r1), .052);
    g.line(0x4F6C5F, at(a, 37.70, 1.42), at(a, 38.50, 1.42), .055);
  }
  g.box(0x4D5B4E, cx, 43.53, cz, .22, .24, .22);
}

/** Additive rows only: existing LoD2 roofs, walls and generic facade owners stay intact. */
export function createMitteHeritageOrnamentRows(native: boolean): MitteHeritageOrnamentRows {
  const result: MitteHeritageOrnamentRows = { boxes: [], surfaces: [] };
  const h=MITTE_HERITAGE_ORNAMENT_V166_PROFILE.heine;
  const authors: [((detail: Detail)=>void),number][] = [
    [heine,terrainGroundAt(h.x,h.z,h.groundY,native)-h.groundY],
    [elisabeth,mitteHeritageV166ParentOffset("DEBE01YYK00000AU")],
    [jandorf,mitteHeritageV166ParentOffset(MITTE_HERITAGE_ORNAMENT_V166_PROFILE.jandorf.parentId)],
  ];
  for(const [author,offset] of authors){
    const detail=new Detail(native);author(detail);
    const rows=detail.finish();
    result.boxes.push(...rows.boxes.map(r=>[r[0],r[1]+offset,...r.slice(2)]));
    result.surfaces.push(...rows.surfaces.map(s=>({...s,triangles:s.triangles.map(t=>t.map(p=>[p[0],p[1]+offset,p[2]]))})));
  }
  return result;
}
