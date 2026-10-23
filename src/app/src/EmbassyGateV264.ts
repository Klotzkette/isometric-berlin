import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/embassyGateV264.json";
type V = [number, number, number];
type Frame = { origin: V; yaw: number; side: number };
export type EmbassyFlagV264 = "uk" | "us" | "fr" | "eu";
const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .4 : 1;
  return [Math.cos(a) * r, Math.sin(a) * r];
});
function inStar(x: number, y: number, radius: number): boolean {
  let inside = false; x /= radius; y /= radius;
  for (let i = 0, j = 9; i < 10; j = i++) {
    const [xi, yi] = STAR[i], [xj, yj] = STAR[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const BLUE = 0x193d76, RED = 0xb62837, WHITE = 0xf5f2e7, GOLD = 0xe6c653;
const UK: Frame = { origin: [598.18, 4.6, 374], yaw: -Math.PI / 2, side: 1 };
const US: Frame = { origin: [461.062, 4.82, 359.499], yaw: .0875, side: -1 };
const FR: Frame = { origin: [518.712, 4.7, 231.25], yaw: .0872, side: 1 };
export const EMBASSY_GATE_V264_PROFILE = { ...source, drawCallBudget: 2, budgetBytes: 300_000, flagCount: 4,
  staticFlags: true, photographsBundled: false, sourceGeometryRetained: true, fullStaticDetailOnTouch: true, nativeIndependentOrthogonal: true } as const;

/** Unit coordinates run from hoist to fly and top to bottom. */
export function embassyFlagColorAtV264(kind: EmbassyFlagV264, u: number, v: number): number {
  if (kind === "fr") return u < 1 / 3 ? BLUE : u < 2 / 3 ? WHITE : RED;
  if (kind === "uk") {
    const x = u * 2 - 1, y = v - .5;
    if (Math.abs(x) < .16 || Math.abs(y) < .08) return RED;
    if (Math.abs(x) < .26 || Math.abs(y) < .13) return WHITE;
    // Counterchanged St Patrick saltire inside St Andrew's white saltire.
    const d = y - x / 2, e = y + x / 2;
    if ((x < 0 ? d > 0 && d < .065 : d < 0 && d > -.065) ||
      (x < 0 ? e < 0 && e > -.065 : e > 0 && e < .065)) return RED;
    if (Math.abs(d) < .105 || Math.abs(e) < .105) return WHITE;
    return BLUE;
  }
  if (kind === "eu") {
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6;
      if (inStar((u - .5) * 1.5 - Math.sin(a) * .3, v - .5 - Math.cos(a) * .3, .044)) return GOLD;
    }
    return BLUE;
  }
  if (u < .4 && v < 7 / 13) {
    for (let row = 0; row < 9; row++) for (let col = 0; col < (row % 2 ? 5 : 6); col++) {
      const x = (col + (row % 2 ? 1 : .5)) * .4 / 6, y = (row + .5) * (7 / 13) / 9;
      if (inStar((u - x) * 1.9, v - y, .026)) return WHITE;
    }
    return BLUE;
  }
  return Math.min(12, Math.floor(v * 13)) % 2 ? WHITE : RED;
}

/** Add shallow recognition details, preserving all original source owners. */
export function createEmbassyGateV264(native = false): Group {
  const root = new Group(); root.name = "Three gate embassies and national flags v264";
  root.userData = { ...EMBASSY_GATE_V264_PROFILE, blockNative: native, nativeMinecraft: native, keepInMinecraft: native };
  const boxes: number[][] = [], positions: number[] = [], colors: number[] = [], tint = new Color();
  const point = (f: Frame, u: number, y: number, depth: number): V => {
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw), d = depth * f.side;
    return [f.origin[0] + u * c + d * s, f.origin[1] + y, f.origin[2] - u * s + d * c];
  };
  const triangle = (a: V, b: V, c: V, color: number): void => { tint.setHex(color);
    for (const p of [a, b, c]) { positions.push(...p); colors.push(tint.r, tint.g, tint.b); }
  };
  const quad = (a: V, b: V, c: V, d: V, color: number): void => { triangle(a, b, c, color); triangle(a, c, d, color); };
  const panel = (f: Frame, u: number, y: number, depth: number, w: number, h: number, t: number, color: number): void => {
    if (!native) { boxes.push([...point(f, u, y, depth), w, h, t, f.yaw, color]); return; }
    // Independent orthogonal strips; never rotate a copied smooth mesh.
    const count = Math.max(1, Math.ceil(w / 1.4)), c = Math.abs(Math.cos(f.yaw)), s = Math.abs(Math.sin(f.yaw));
    for (let i = 0; i < count; i++) boxes.push([...point(f, u - w / 2 + (i + .5) * w / count, y, depth), c * w / count + s * t, h, s * w / count + c * t, color]);
  };
  const line = (f: Frame, a: V, b: V, t: number, color: number): void => {
    const steps = Math.max(1, Math.ceil(Math.hypot(...a.map((v, i) => v - b[i])) / .24));
    for (let i = 0; i < steps; i++) { const q = a.map((v, j) => v + (b[j] - v) * (i + .5) / steps) as V;
      panel(f, q[0], q[1], q[2], Math.max(t, Math.abs(b[0] - a[0]) / steps), Math.max(t, Math.abs(b[1] - a[1]) / steps), Math.max(t, Math.abs(b[2] - a[2]) / steps), color);
    }
  };
  const flag = (kind: EmbassyFlagV264, f: Frame, u: number, top: number, depth: number, w: number, h: number): void => {
    const cols = kind === "us" ? 120 : 80, rows = kind === "us" ? 65 : 40;
    // Same-colour runs merge offline at construction. Static, image-free fields.
    for (let row = 0; row < rows; row++) { let start = 0;
      while (start < cols) {
        const color = embassyFlagColorAtV264(kind, (start + .5) / cols, (row + .5) / rows); let end = start + 1;
        while (end < cols && embassyFlagColorAtV264(kind, (end + .5) / cols, (row + .5) / rows) === color) end++;
        const left = u + w * start / cols, right = u + w * end / cols, y1 = top - h * row / rows, y2 = top - h * (row + 1) / rows;
        if (native) panel(f, (left + right) / 2, (y1 + y2) / 2, depth, right - left, y1 - y2, .075, color);
        else quad(point(f, left, y1, depth), point(f, right, y1, depth), point(f, right, y2, depth), point(f, left, y2, depth), color);
        start = end;
      }
    }
  };
  // Existing UK sandstone, windows, roof and source shells remain.
  for (const z of [359.8,363.25,366.7,381.3,384.75,388.2]) for (let floor = 0; floor < 4; floor++) {
    const u = z - 374, y = 4 + floor * 4.25;
    panel(UK,u,y,native ? 1.35 : .64,.10,2.35,.12,0xadb8b5);
    panel(UK,u,y+1.21,native ? 1.35 : .62,2.25,.11,.26,0xc5b89c);
  }
  for (let course = 0; course < 34; course++) { const y = .35 + course * .60;
    for (const [u,width] of (y > 5.5 && y < 19.5 ? [[-11.4,8.5],[11.4,8.5]] : [[0,31.7]])) panel(UK,u,y,native ? 1.48 : .97,width,.026,.025,0xb7a98c);
  }
  // The photo's opening occupies the lower middle storeys, rather than
  // extending almost to the roof as the old decorative dark panel did.
  panel(UK,0,7.7,native ? 1.6 : .6,13.4,6.6,.42,0x26383e);
  panel(UK,0,15.55,native ? 1.6 : .6,13.4,8.7,.3,0xd9cfbd);
  for (const u of [-4.8,-1.6,1.6,4.8]) for (const y of [12.5,16.75]) {
    panel(UK,u,y,native ? 1.85 : .82,2.15,2.35,.15,0x60747a);
    panel(UK,u,y,native ? 1.96 : .94,.10,2.35,.09,0xadb8b5);
    panel(UK,u,y-1.34,native ? 1.98 : .96,2.65,.22,.18,0xb9b1a2);
  }
  // Correct the horizontal barrel to the photo's vertical violet cylinder.
  for (let i = 0; i < (native ? 20 : 40); i++) {
    const n = native ? 20 : 40, a = Math.PI*i/n, b = Math.PI*(i+1)/n;
    const u1 = 4 + Math.cos(a)*2.95, u2 = 4 + Math.cos(b)*2.95, d1 = 1.25 + Math.sin(a)*3, d2 = 1.25 + Math.sin(b)*3;
    if (native) panel(UK,(u1+u2)/2,8.25,Math.max(d1,d2),Math.abs(u2-u1)+.08,5.5,.3,i%4 ? 0x8064a1 : 0x765a97);
    else {
      quad(point(UK,u1,5.5,d1),point(UK,u2,5.5,d2),point(UK,u2,11,d2),point(UK,u1,11,d1),i%5 ? 0x8064a1 : 0x79609b);
      triangle(point(UK,4,11,1.25),point(UK,u1,11,d1),point(UK,u2,11,d2),0x8a72a6);
    }
  }
  if (native) for (let i=0;i<20;i++) {
    const u=-2.95+(i+.5)*5.9/20, extent=3*Math.sqrt(1-(u/2.95)**2);
    panel(UK,4+u,11,1.25+extent/2,5.9/20,.18,extent,0x8a72a6);
  }
  // Blue trapezoidal projection with a long glazed side and narrow pale ribs.
  for (let i = 0; i < 14; i++) { const u = -6.3+(i+.5)*5.9/14, out = 3.4+i/13*1.1;
    panel(UK,u,8.5,out,5.9/14+.018,5.2,.3,0x80b5c4);
    panel(UK,u,9.15,out+.18,5.9/14-.075,3.4,.07,i%3 ? 0x67878e : 0xb7cbcd);
  }
  panel(UK,-3.35,11.16,4,6.1,.23,1.7,0x8bc2cf); panel(UK,-3.35,5.8,4,6.1,.23,1.7,0x75aaba);
  for (let bar=0;bar<8;bar++) panel(UK,-1.1+bar*.25,2,1.8,.055,3.8,.09,0x919a98);
  line(UK,[3.6,4.7,2.1],[3.6,18.2,6.3],.095,0xa6aaa6); flag("uk",UK,3.65,17.75,6.25,3.2,1.6);
  // Ribbed French base leaves the existing Rue de France portal uncovered.
  for (let row=0;row<16;row++) for (const [u,w] of [[-15.75,20.7],[13.5,25.2]]) panel(FR,u,.23+row*.245,native ? 1.45 : 1.1,w,.075,.12,row%3 ? 0xa9a79c : 0xc7c5ba);
  for (const u of [-22.7,-17,-11.3,5,10.7,16.4,22.1]) {
    for (const side of [-1,1]) panel(FR,u+side*1.77,9.2,native ? 1.5 : .88,.17,7.48,.3,0xd9d5c8);
    for (const y of [7.2,11.6]) panel(FR,u,y,native ? 1.5 : .9,3.44,.085,.11,0xcbd3cd);
    for (let p=0;p<9;p++) panel(FR,u-1.45+p*.36,5.81,native ? 1.55 : 1.22,.045,.7,.055,0x4c5454);
  }
  for (let bay=0;bay<12;bay++) panel(FR,-23.85+bay*4.32,15.05,native ? 1.5 : .88,.08,2.35,.1,0xc6ceca);
  panel(FR,-2.25,4.45,2.0,6.4,.22,2.5,0xa2a8a2);
  panel(FR,-2.25,4.6,3.2,6.4,.10,.16,0xd4d6ca);
  // Reference shows the pair together on the entrance canopy, EU to the
  // viewer's left and France to the right, rather than on separate bays.
  for (const u of [-3.8,-1.25]) line(FR,[u,4.5,2.1],[u,9.3,2.1],.08,0x697573);
  flag("eu",FR,-3.75,9.15,2.15,2.1,1.4); flag("fr",FR,-1.20,9.15,2.15,2.1,1.4);
  // US divided casements, deep reveals and lintel shades over retained windows.
  for (let floor=0;floor<4;floor++) for (const u of [-17,-12.2,-7.4,-2.6,2.2,7]) {
    const y=3+floor*4.35, out=native ? 1.45 : .84;
    for (const side of [-1,1]) panel(US,u+side*1.55,y,out,.13,2.66,.23,0xe4dfcf);
    panel(US,u,y-.15,out,3.05,.10,.1,0xe3e3d9); panel(US,u,y+1.4,out+.16,3.5,.13,.65,0xe3dccb); panel(US,u,y-1.3,out,3.3,.12,.35,0xdcd5c3);
  }
  for (let seam=0;seam<31;seam++) panel(US,-3.4,.48+seam*.64,native ? 1.1 : .48,33.5,.025,.03,0xb7ae99);
  for (const u of [-1.45,1,3.45,5.9]) { for (const side of [-1,1]) panel(US,u+side,23.25,-1.7,.09,3,.1,0x828e8c); panel(US,u,23.25,-1.69,2,.09,.12,0x828e8c); }
  for (let rib=-3;rib<=3;rib++) panel(US,12.65+rib*1.05,7.88+(3-Math.abs(rib))*.24,3.25,.075,.14,2.1,0xc1c8c1);
  line(US,[11.05,8.9,4.2],[11.05,22.3,4.2],.08,0xb8bcb4); flag("us",US,11.1,21.85,4.25,3.8,2);
  const batch=justicePalaceV183Boxes(boxes,native); batch.name=native ? "Embassy v264 independent orthogonal fittings and flags" : "Embassy v264 retained-facade fittings"; root.add(batch);
  if (!native) {
    const geometry=new BufferGeometry(); geometry.setAttribute("position",new BufferAttribute(new Float32Array(positions),3)); geometry.setAttribute("color",new BufferAttribute(new Float32Array(colors),3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}), night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.86});
    const mesh=new Mesh(geometry,day); mesh.name="Embassy v264 curved conference room and static national flag fields"; mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true}; root.add(mesh);
  }
  root.userData.instances=boxes.length; return freezeStaticSceneTransforms(root);
}
