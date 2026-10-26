import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import source from "./data/northCultureV274Source.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { HERZ_JESU_V274_SECTIONS } from "./herzJesuV274Profile";

type P = [number, number, number];
type V = [number, number];
type Item = { matrix: Matrix4; color: number; role: string };
type Face = { a: number[]; b: number[]; normal: number[]; bottom: number; top: number };

/** Named-site fittings share one final-sized batch; native never rotates cubes. */
export class NorthCulturePlanV274 {
  readonly items: Item[] = [];
  constructor(readonly native: boolean) {}
  box(p: P, w: number, h: number, d: number, yaw: number, color: number, role: string): void {
    if (!this.native || Math.abs(yaw) < 1e-8) {
      const matrix = new Matrix4().makeRotationY(this.native ? 0 : yaw);
      matrix.scale(new Vector3(w, h, d)); matrix.setPosition(...p);
      this.items.push({ matrix, color, role }); return;
    }
    const tx = Math.cos(yaw), tz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
    if (w * d > 6) {
      // Sample the actual rotated footprint in world axes, never its filled AABB.
      const ex = Math.abs(tx * w / 2) + Math.abs(nx * d / 2), ez = Math.abs(tz * w / 2) + Math.abs(nz * d / 2);
      const cell = .65;
      for (let x = Math.floor((p[0] - ex) / cell) * cell + cell / 2; x < p[0] + ex; x += cell)
        for (let z = Math.floor((p[2] - ez) / cell) * cell + cell / 2; z < p[2] + ez; z += cell) {
          const dx = x - p[0], dz = z - p[2];
          if (Math.abs(dx * tx + dz * tz) <= w / 2 && Math.abs(dx * nx + dz * nz) <= d / 2)
            this.box([x, p[1], z], cell, h, cell, 0, color, role);
        }
      return;
    }
    const n = Math.max(1, Math.ceil(w / .45));
    for (let i = 0; i < n; i++) {
      const u = (i + .5) * w / n - w / 2;
      this.box([p[0] + tx * u, p[1], p[2] + tz * u],
        Math.max(.06, Math.abs(tx) * w / n + Math.abs(nx) * d), h,
        Math.max(.06, Math.abs(tz) * w / n + Math.abs(nz) * d), 0, color, role);
    }
  }
  rod(a: P, b: P, width: number, color: number, role: string): void {
    const start = new Vector3(...a), end = new Vector3(...b), axis = end.clone().sub(start), len = axis.length();
    if (len < .001) return;
    if (this.native) {
      const n = Math.max(1, Math.ceil(len / Math.max(.16, width)));
      for (let i = 0; i <= n; i++) this.box(start.clone().lerp(end, i / n).toArray() as P, width, width, width, 0, color, role);
    } else this.items.push({ matrix: new Matrix4().compose(start.add(end).multiplyScalar(.5),
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize()), new Vector3(width, len, width)), color, role });
  }
  face(f: Face, u: number, y: number, w: number, h: number, d: number, color: number, role: string, out = .35): void {
    const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const tx = (f.b[0] - f.a[0]) / length, tz = (f.b[1] - f.a[1]) / length;
    this.box([f.a[0] + tx * u + f.normal[0] * out, y, f.a[1] + tz * u + f.normal[1] * out], w, h, d, -Math.atan2(tz, tx), color, role);
  }
  arch(f: Face, u: number, y: number, radius: number, color: number, role: string, out = .65): void {
    const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const t = [(f.b[0] - f.a[0]) / length, (f.b[1] - f.a[1]) / length];
    const p = (a: number): P => [f.a[0] + t[0] * (u + Math.cos(a) * radius) + f.normal[0] * out,
      y + Math.sin(a) * radius, f.a[1] + t[1] * (u + Math.cos(a) * radius) + f.normal[1] * out];
    for (let i = 0; i < 16; i++) this.rod(p(i * Math.PI / 16), p((i + 1) * Math.PI / 16), .16, color, role);
  }
  label(f: Face, text: string, u: number, y: number, height: number, color: number, out = .75): void {
    // The shared alphabet returns centred paths and has no exclamation glyph.
    // Keep the photographed COMICS! punctuation as two local geometric strokes.
    const exclamation = text.endsWith("!");
    const paths = letteringStrokePaths(exclamation ? text.slice(0, -1) : text, height);
    if (exclamation) {
      const x = Math.max(...paths.flat().map(p => p[0])) + height * .35;
      paths.push([[x, height * .30], [x, height]], [[x, 0], [x, height * .08]]);
    }
    const xs = paths.flat().map(p => p[0]), center = (Math.min(...xs) + Math.max(...xs)) / 2;
    const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), tx = (f.b[0] - f.a[0]) / length, tz = (f.b[1] - f.a[1]) / length;
    const p = (v: readonly number[]): P => [f.a[0] + tx * (u + v[0] - center) + f.normal[0] * out,
      y + v[1], f.a[1] + tz * (u + v[0] - center) + f.normal[1] * out];
    for (const path of paths) for (let i = 1; i < path.length; i++) this.rod(p(path[i - 1]), p(path[i]), Math.max(.035, height * .09), color, "lettering");
  }
  mesh(name: string): InstancedMesh {
    const geo = new BoxGeometry(); geo.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .9 });
    const mesh = new InstancedMesh(geo, day, 0), colors = new Float32Array(this.items.length * 3), matrices = new Float32Array(this.items.length * 16), c = new Color();
    this.items.forEach((v, i) => { v.matrix.toArray(matrices, i * 16); c.setHex(v.color).toArray(colors, i * 3); });
    mesh.count = this.items.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.name = name; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: this.native, keepInMinecraft: this.native,
      roles: [...new Set(this.items.map(v => v.role))], fullStaticDetailOnTouch: true };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
  }
}

function face(a: number[], b: number[], outward: V, bottom = 3, top = 28): Face {
  return { a, b, normal: outward, bottom, top };
}

/** The missing upper campanile is proportioned to the LDA plan and 55m height. */
export function planHerzJesuV274(native = false): NorthCulturePlanV274 {
  const p = new NorthCulturePlanV274(native), s = source.herzJesu;
  const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len = Math.hypot(dx, dz), t: V = [dx / len, dz / len], n: V = [t[1], -t[0]];
  const f = face(s.a, s.b, n), yaw = -Math.atan2(t[1], t[0]), [cx, cz] = s.towerCenter;
  const stone = 0xb4ac94, trim = 0xd0c2a0, dark = 0x38403d;
  // The lower measured church sheets remain; only their missing vertical tower
  // and the source-aligned stone street facing are added.
  for (const q of HERZ_JESU_V274_SECTIONS) p.box([cx, q.y, cz], q.width, q.height, q.depth, yaw, q.color, q.role);
  for (let side = 0; side < 4; side++) {
    const angle = yaw + side * Math.PI / 2, tx = Math.cos(angle), tz = -Math.sin(angle), nx = Math.sin(angle), nz = Math.cos(angle);
    const tf = face([cx - tx * 4.35 + nx * 4.25, cz - tz * 4.35 + nz * 4.25], [cx + tx * 4.35 + nx * 4.25, cz + tz * 4.35 + nz * 4.25], [nx, nz]);
    for (const u of [1.9, 4.35, 6.8]) {
      p.face(tf, u, 44.2, 1.22, 3.6, .08, dark, "triple-belfry-opening", .08);
      p.arch(tf, u, 45.7, .61, trim, "belfry-arch", .15);
      for (const yy of [42.8, 43.4, 44, 44.6, 45.2]) p.face(tf, u, yy, 1.19, .10, .10, 0x69695a, "belfry-louver", .16);
    }
    for (const u of [2.6, 6.1]) { p.face(tf, u, 38.7, 1.0, 2.05, .08, dark, "paired-tower-opening", .08); p.arch(tf, u, 39.6, .50, trim, "paired-tower-arch", .15); }
  }
  p.rod([cx, 56.5, cz], [cx, 58, cz], .12, 0x847a54, "tower-cross");
  p.rod([cx - t[0] * .45, 57.5, cz - t[1] * .45], [cx + t[0] * .45, 57.5, cz + t[1] * .45], .12, 0x847a54, "tower-cross");
  p.face(f, len / 2, 14.9, len - .3, 23.8, .12, stone, "limestone-street-front", .48);
  for (const y of [4, 9.4, 15.7, 23.8, 26.5]) p.face(f, len / 2, y, len - .2, .24, .24, trim, "romanesk-cornice", .60);
  for (const u of [5.3, 13.2, 20]) {
    const w = u === 13.2 ? 3.3 : 1.7;
    p.face(f, u, 5.6, w, 4.6, .10, 0x554939, "arched-entry", .63);
    p.arch(f, u, 7.8, w / 2, trim, "portal-arch", .73);
    for (const side of [-1, 1]) p.face(f, u + side * (w / 2 + .22), 5.7, .23, 4.8, .22, trim, "portal-column", .68);
  }
  for (const u of [10.2, 13.2, 16.2]) {
    p.face(f, u, 17.8, 1.75, 5.5, .08, 0x52625e, "triple-romanesk-window", .63);
    p.arch(f, u, 20.45, .87, trim, "window-arch", .73);
    p.face(f, u, 17.8, .08, 5.4, .08, trim, "window-mullion", .72);
  }
  return p;
}

export function planGroberUnfugV274(native = false): NorthCulturePlanV274 {
  const p = new NorthCulturePlanV274(native), s = source.groberUnfug, g = s.groundY;
  const edges = [[s.a, s.corner], [s.corner, s.b]];
  for (const [i, [a, b]] of edges.entries()) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), t: V = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const f = face(a, b, [-t[1], t[0]], g, g + 4.8), start = i ? 0 : len - 10.5, end = i ? 9.5 : len;
    p.face(f, (start + end) / 2, g + 2.35, end - start, 4.7, .11, 0xdfd9c7, "shop-stone-surround", .47);
    for (let u = start + 1.55; u < end - 1; u += 3.25) {
      const door = i === 0 && u > end - 3;
      p.face(f, u, g + (door ? 1.5 : 2), door ? 1.7 : 2.3, door ? 2.8 : 2.6, .08, door ? 0x3c454b : 0xbca16b, "comic-shop-glazing", .56);
      p.face(f, u, g + 2, .075, 2.7, .10, 0x3d4244, "shop-mullion", .64);
      p.face(f, u, g + .63, 2.55, .14, .22, 0x8d8c7e, "shop-stone-sill", .61);
      if (door) p.arch(f, u, g + 2.9, .85, 0x6d6b60, "comic-door-arch", .65);
      else for (const k of [-.6, -.2, .2, .6]) p.face(f, u + k, g + .95, .28, .40 + (k + .6) * .1, .06, k < 0 ? 0x8f5942 : 0x697f81, "comic-display", .66);
    }
    p.face(f, (start + end) / 2, g + 4.65, end - start + .08, .24, .35, 0xccc7b8, "shop-cornice", .58);
    for (let y = g + .5; y < g + 4.4; y += .65) p.face(f, i ? .65 : len - .65, y, 1.2, .025, .04, 0xb7b09d, "corner-stone-joint", .58);
    p.label(f, i ? "GROBER UNFUG" : "COMICS!", (start + end) / 2, g + 3.75, i ? .42 : .62, i ? 0x772a2b : 0xc4a024);
  }
  return p;
}

/** Existing source faces at the built Torstraße 49 complex; no proposal facade. */
export function planSchoenhauserTorV274(native = false, nativeRuns: readonly (readonly number[])[] = []): NorthCulturePlanV274 {
  if (native && nativeRuns.length === 0) throw new Error("Native Tor fittings require their retained source cells");
  const p = new NorthCulturePlanV274(native);
  // Only the four receipted, externally exposed crown faces. Whole-parent
  // centroid heuristics also selected internal seams and invented extra doors.
  for (const f of source.schoenhauserTorFaces) {
    const first = p.items.length;
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    p.face(f, len / 2, f.top - .16, len, .22, .22, 0xc5ceca, "built-tor-crown-edge", .34);
    const count = Math.max(2, Math.round(len / 2.8));
    for (const y of [f.top - 1.8, f.top - 4.9, f.top - 8.0]) {
      p.face(f, len / 2, y, len - .15, .10, .16, 0x6d7a7b, "glazed-crown-transom", .38);
      // Visible external sunshades, not another invented window grid.
      for (let blade = 0; blade < 4; blade++) p.face(f, len / 2, y - .2 - blade * .16, len - .15, .055, .19, 0x8a9695, "crown-sunshade", .44);
    }
    for (let bay = 0; bay <= count; bay++) p.face(f, .15 + (len - .3) * bay / count, f.top - 4.5, .07, 8.7, .12, 0xc2c9c4, "upper-crown-mullion", .39);
    if (native) {
      // The existing independent 2m source skin can protrude beyond its
      // measured face. Fit only these finite new members outside the exact
      // occupied cells, preserving every original cell and facade subdivision.
      const cells = nativeRuns.filter(r => r[1]+r[4]/2 > f.top-9 && r[1]-r[4]/2 < f.top+.1 &&
        r[0]+r[3]/2 > Math.min(f.a[0],f.b[0])-3 && r[0]-r[3]/2 < Math.max(f.a[0],f.b[0])+3 &&
        r[2]+r[5]/2 > Math.min(f.a[1],f.b[1])-3 && r[2]-r[5]/2 < Math.max(f.a[1],f.b[1])+3);
      for (let i=first;i<p.items.length;i++) {
        const e=p.items[i].matrix.elements;
        let clearance=0;
        for (const r of cells) {
          if (e[13]+e[5]/2 <= r[1]-r[4]/2 || e[13]-e[5]/2 >= r[1]+r[4]/2) continue;
          let entry=-Infinity,exit=Infinity;
          for (const [position,half,axis,cellPosition,cellHalf] of [
            [e[12],e[0]/2,f.normal[0],r[0],r[3]/2],
            [e[14],e[10]/2,f.normal[1],r[2],r[5]/2],
          ]) {
            const low=cellPosition-cellHalf-half-.03-position,high=cellPosition+cellHalf+half+.03-position;
            if(Math.abs(axis)<1e-9){if(low>0||high<0){entry=Infinity;break;}}
            else {const a=low/axis,b=high/axis;entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
          }
          if(exit>=Math.max(entry,0)&&entry<=3.1)clearance=Math.max(clearance,exit);
        }
        if(clearance>3.1)throw new Error("Native Tor source clearance exceeds its bounded face allowance");
        e[12]+=f.normal[0]*clearance;e[14]+=f.normal[1]*clearance;
      }
    }
  }
  return p;
}

export function createNorthCultureV274(native = false): Group {
  const root = new Group(); root.name = "Herz Jesu and Grober Unfug source recognition v274";
  root.userData = { sourceParentIds: source.ownerIds, sourceSha256: source.sourceSha256, sourceGeometryRetained: true,
    textureFree: true, fullStaticDetailOnTouch: true, blockNative: native, keepInMinecraft: native, sourceStatus: source.policy };
  root.add(planHerzJesuV274(native).mesh("Herz-Jesu campanile and Romanesque street front"));
  root.add(planGroberUnfugV274(native).mesh("Grober Unfug corner shop, arched opening and comic displays"));
  return freezeStaticSceneTransforms(root);
}
