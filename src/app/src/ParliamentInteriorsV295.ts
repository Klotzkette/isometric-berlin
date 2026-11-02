import { BoxGeometry, Color, Euler, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { MINECRAFT_PALETTE } from "./visual-modes/minecraft/palette";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { reichstagRampPoints } from "./ReichstagDome";
import { REICHSTAG_DOME_EVIDENCE as DOME } from "./HeroArchitectureEvidence";
import { PARLIAMENT_FLIGHTS_V295 as FLIGHTS, PARLIAMENT_INTERIORS_V295 as P, PARLIAMENT_LOCAL_AIR_V295 as AIR, parliamentFlightTopV295, parliamentBerlinRoofTopV295, parliamentLocalPointV295, parliamentWorldPointV295, parliamentYawV295, type ParliamentSiteV295 as Site, type ParliamentPointV295 as Point } from "./parliamentInteriorsV295Profile";
export const PARLIAMENT_INTERIORS_GROUP_V295 = "Parliament public rooms and circulation v295";
export const PARLIAMENT_INTERIORS_BUDGET_V295 = { drawnInstances: 6500, nativeInstances: 15000, drawnBatches: 1, nativeBatches: 1, textureFree: true } as const;
type Member = {
  site: Site;
  position: Point;
  size: Point;
  yaw: number;
  tilt: number;
  color: number;
  role: string;
  solid: boolean;
};
const C = { stone: 0xd5d0c4, floor: 0xbdbeb7, light: 0xebe9df, dark: 0x343c40, metal: 0xa3afb2, blue: 0x586eb0, wood: 0xc7a574, chair: 0x3b3e40, glass: 0x8aa7aa, green: 0x658d76 };
class Plan {
  readonly members: Member[] = [];
  constructor(readonly native: boolean) { }
  box(site: Site, p: Point, s: Point, color: number, role: string, solid = false, yaw = 0, tilt = 0): void {
    if (s.some(n => n <= 0 || !Number.isFinite(n)))
      throw new Error(`Invalid parliament member ${role}`);
    const world = parliamentWorldPointV295(site, p), angle = parliamentYawV295(site) + yaw;
    if (!this.native) {
      this.members.push({ site, position: world, size: s, yaw: angle, tilt, color, role, solid });
      return;
    }
    // Independently cardinal courses. Long walls use bounded short courses,
    // never one oversized rotated smooth-model bounding rectangle.
    const along = s[0] > s[2] ? 0 : 2, n = Math.max(1, Math.ceil(s[along] / 2));
    const part = [...s] as Point;
    part[along] /= n;
    for (let i = 0; i < n; i++) {
      const offset = (i + .5) * part[along] - s[along] / 2, c = Math.cos(yaw), sn = Math.sin(yaw);
      const lp: Point = [p[0] + (along === 0 ? offset * c : offset * sn), p[1], p[2] + (along === 0 ? -offset * sn : offset * c)];
      const w = parliamentWorldPointV295(site, lp), a = Math.abs(Math.cos(angle)), b = Math.abs(Math.sin(angle));
      this.members.push({ site, position: w, size: [part[0] * a + part[2] * b, s[1] + Math.abs(Math.sin(tilt)) * s[2], part[0] * b + part[2] * a], yaw: 0, tilt: 0, color, role, solid });
    }
  }
  floor(site: Site, x0: number, x1: number, z0: number, z1: number, top: number, color: number, role: string, contains?: (x: number, z: number) => boolean): void {
    if (!this.native && !contains) {
      this.box(site, [(x0 + x1) / 2, top - .16, (z0 + z1) / 2], [x1 - x0, .32, z1 - z0], color, role);
      return;
    }
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => parliamentWorldPointV295(site, [x, top, z]));
    const minX = Math.floor(Math.min(...corners.map(p => p[0]))), maxX = Math.ceil(Math.max(...corners.map(p => p[0]))), minZ = Math.floor(Math.min(...corners.map(p => p[2]))), maxZ = Math.ceil(Math.max(...corners.map(p => p[2])));
    const step = this.native ? 1 : .65;
    for (let z = minZ; z < maxZ; z += step) {
      let start: number | null = null;
      const append = (end: number) => {
        if (start === null)
          return;
        const n = Math.ceil((end - start) / 8), width = (end - start) / n;
        for (let i = 0; i < n; i++)
          this.members.push({ site, position: [start + (i + .5) * width, top - .16, z + step / 2], size: [width, .32, step], yaw: 0, tilt: 0, color, role, solid: false });
        start = null;
      };
      for (let x = minX; x <= maxX + step / 2; x += step) {
        const inside = x < maxX && [x, x + step].every(xx => [z, z + step].every(zz => { const q = parliamentLocalPointV295(site, xx, top, zz); return q[0] >= x0 - 1e-8 && q[0] <= x1 + 1e-8 && q[2] >= z0 - 1e-8 && q[2] <= z1 + 1e-8 && (!contains || contains(q[0], q[2])); }));
        if (inside) {
          if (start === null)
            start = x;
        }
        else
          append(x);
      }
    }
  }
}
function stairs(plan: Plan): void {
  for (const f of FLIGHTS) {
    const dx = f.to[0] - f.from[0], dz = f.to[2] - f.from[2], len = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx);
    for (let i = 0; i < f.steps; i++) {
      const t = (i + .5) / f.steps, top = f.from[1] + (i + 1) / f.steps * (f.to[1] - f.from[1]);
      plan.box(f.site, [f.from[0] + dx * t, top - .12, f.from[2] + dz * t], [len / f.steps + .025, .24, f.width], C.stone, f.id + " tread", false, yaw);
    }
    // Handrails sit outside the actual tread width, preserving body clearance.
    for (const sign of [-1, 1])
      for (let i = 4; i < f.steps; i += 4) {
        const t = i / f.steps, top = f.from[1] + t * (f.to[1] - f.from[1]);
        plan.box(f.site, [f.from[0] + dx * t - sign * dz / len * (f.width / 2 + .12), top + .5, f.from[2] + dz * t + sign * dx / len * (f.width / 2 + .12)], [.09, 1, .09], C.metal, f.id + " rail post", true);
      }
    for (const sign of [-1, 1])
      for (let i = 0; i < f.steps; i += 2) {
        const t = (i + 1) / f.steps, top = f.from[1] + t * (f.to[1] - f.from[1]);
        plan.box(f.site, [f.from[0] + dx * t - sign * dz / len * (f.width / 2 + .12), top + 1.0, f.from[2] + dz * t + sign * dx / len * (f.width / 2 + .12)], [len / f.steps * 2 + .04, .08, .08], C.metal, f.id + " handrail", true, yaw);
      }
  }
  for (let i = 1; i <= 8; i++) {
    const x = i % 2 ? -28 : -44, y = P.reichstag.floor + i * 2.5;
    plan.floor("reichstag", x - 1.2, x + 1.2, -9.1, -2.9, y, C.stone, "foyer switchback landing");
  }
  plan.floor("abgeordnetenhaus", -7, 7, -31.8, -28.2, 9.5, C.stone, "grand stair half landing");
  plan.floor("abgeordnetenhaus", -7, 7, -18.2, -14.5, 13, C.stone, "grand stair top landing");
}
function seat(plan: Plan, site: Site, x: number, z: number, top: number, yaw: number, color: number): void {
  plan.box(site, [x, top + .43, z], [.58, .13, .59], color, `${site} seat cushion`, true, yaw);
  plan.box(site, [x - Math.sin(yaw) * .23, top + .84, z - Math.cos(yaw) * .23], [.58, .78, .13], color, `${site} seat back`, true, yaw);
  plan.box(site, [x + Math.sin(yaw) * .55, top + .77, z + Math.cos(yaw) * .55], [.78, .10, .45], site === "reichstag" ? C.light : C.wood, `${site} desk`, true, yaw);
  plan.box(site, [x, top + .23, z], [.12, .36, .12], C.metal, `${site} seat pedestal`);
}
function reichstag(plan: Plan): void {
  const site = "reichstag", floor = P.reichstag.floor, terrace = P.reichstag.terrace;
  plan.floor(site, -23.2, 23.2, -25.2, 25.2, floor, C.floor, "plenary chamber floor");
  plan.floor(site, -48, -23, -10, 10, floor, C.stone, "west entrance foyer floor");
  plan.floor(site, -60, -46, -2, 2, floor, C.stone, "open west public doorway floor");
  plan.floor(site, -46, -19, -8, -5.35, terrace, C.stone, "roof terrace stair connection");
  plan.floor(site, -46, -42.8, -5.35, -2, terrace, C.stone, "roof terrace west landing");
  plan.floor(site, -26.6, -19, -5.35, -2, terrace, C.stone, "roof terrace dome landing");
  plan.floor(site, -21.3, 21.3, -21.3, 21.3, terrace, C.stone, "dome annular terrace", (x, z) => Math.hypot(x, z) >= 5.7 && Math.hypot(x, z) <= 21.1);
  for (const side of [-1, 1]) {
    plan.box(site, [0, 17.5, side * 25.05], [46.4, 19.8, .28], C.light, "plenary side lining", true);
    plan.box(site, [side * 23.05, 17.5, 0], [.28, 19.8, 50.2], C.light, "plenary east-west lining", true);
    // The west central aisle is explicitly open through the lining.
    plan.box(site, [-35.5, 12.1, side * 9.85], [25, 9, .25], C.stone, "foyer wall", true);
    plan.floor(site, -20.8, 19.5, side < 0 ? -24.6 : 21.4, side < 0 ? -21.4 : 24.6, 14.3, C.dark, "public visitor side balcony");
    plan.box(site, [-.6, 14.87, side * 21.4], [40.4, 1.12, .10], C.metal, "visitor balcony rail", true);
    for (let j = 0; j < 24; j++)
      seat(plan, site, -19.5 + j * 1.6, side * 23, 14.3, side < 0 ? 0 : Math.PI, C.chair);
  }
  // Replace the centre of the west lining by its exact two outside members.
  const west = plan.members.filter(m => m.role === "plenary east-west lining" && parliamentLocalPointV295(site, ...m.position)[0] < 0);
  for (const m of west) {
    const at = plan.members.indexOf(m);
    if (at >= 0)
      plan.members.splice(at, 1);
  }
  for (const z of [-14, 14])
    plan.box(site, [-23.05, 17.5, z], [.28, 19.8, 22], C.light, "west chamber wall outside doorway", true);
  plan.box(site, [-23.05, 22.5, 0], [.28, 9.8, 6], C.light, "west chamber door lintel", true);
  // Seven fanned rows/six sectors contain 630 display chairs. Sector geometry
  // is an estimate, never a party allocation or an exact current seat map.
  for (let row = 0; row < 7; row++) {
    const radius = 9 + row * 1.9, count = 9 + row * 2;
    for (let sector = 0; sector < 6; sector++)
      for (let i = 0; i < count; i++) {
        const angle = (-100 + sector * 200 / 6 + 3.3 + (i + .5) / count * (200 / 6 - 6.6)) * Math.PI / 180;
        const x = 10 - Math.cos(angle) * radius, z = Math.sin(angle) * radius, y = floor;
        seat(plan, site, x, z, y, Math.PI / 2 - angle, C.blue);
      }
  }
  plan.box(site, [19.5, floor + .3, 0], [5.8, .6, 13], C.light, "presidium dais", true);
  plan.box(site, [19.4, floor + 1.3, 0], [1.4, .3, 10], C.light, "presidium desk", true);
  plan.box(site, [16.7, floor + .72, 0], [1.2, 1.45, 1.6], C.dark, "speakers lectern", true);
  plan.box(site, [15.2, floor + .77, 0], [1.2, .14, 3.6], C.light, "stenographers table", true);
  for (const side of [-1, 1])
    for (let i = 0; i < 10; i++)
      seat(plan, site, 16.8 - i * .7, side * 10.7, floor, side < 0 ? 0 : Math.PI, C.blue);
  // Procedural silver eagle silhouette: public national symbol, no image.
  plan.box(site, [22.5, 18, 0], [.22, 4.0, 2.6], C.metal, "silver federal eagle body");
  plan.box(site, [22.5, 20.5, -.25], [.22, 1.4, 1.4], C.metal, "silver federal eagle head");
  for (const side of [-1, 1])
    for (let i = 0; i < 7; i++)
      plan.box(site, [22.5, 19.1 - i * .25, side * (1.7 + i * .48)], [.22, 2.6 - i * .22, .52], C.metal, "silver federal eagle wing feather");
  for (const z of [-20.7, 20.7])
    for (const x of [-18, -10.8, -3.6, 3.6, 10.8, 18])
      plan.box(site, [x, 17.3, z], [.55, 19.4, .55], C.stone, "slender chamber column", true);
  // Two documented public lifts; cabin/shaft fittings are display estimates.
  for (const z of [4.2, 7.6]) {
    for (const sx of [-1, 1])
      plan.box(site, [-34 + sx * 1.15, 17.595, z], [.13, 20, .13], C.metal, "public lift guide", true);
    plan.box(site, [-34, floor + .13, z], [2.3, .25, 2.4], C.dark, "public lift cabin floor");
    plan.box(site, [-34, floor + 2.6, z], [2.3, .20, 2.4], C.metal, "public lift cabin roof");
  }
  // Dome exhibition/viewing lecterns sit inside the documented ramps.
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) / 8 * Math.PI * 2, r = 11.6;
    plan.box(site, [Math.cos(a) * r, terrace + .55, Math.sin(a) * r], [.16, 1.1, .16], C.metal, "panorama lectern support", true);
    plan.box(site, [Math.cos(a) * r, terrace + 1.12, Math.sin(a) * r], [1.8, .12, .85], C.light, "panorama viewing lectern", true, -a, .22);
  }
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2;
    plan.box(site, [Math.cos(a) * 5.7, terrace + .55, Math.sin(a) * 5.7], [.075, 1.1, .075], C.metal, "plenary light-well guard", true);
  }
  // Independent 30-row/12-sector native facets replace only the four coarse
  // inner-cone proxy cubes after the complete room is admitted. Their square
  // corners otherwise intersect the actual public ramp capsule.
  if (plan.native)
    for (let row = 0; row < 30; row++)
      for (let sector = 0; sector < 12; sector++) {
        const t = (row + .5) / 30, a = (sector + .5) * Math.PI / 6, r = 2.4 + 5.4 * t;
        const world: Point = [P.reichstag.anchor[0] + Math.cos(a) * r, terrace + 18 * t, P.reichstag.anchor[2] + Math.sin(a) * r], q = parliamentLocalPointV295(site, ...world);
        plan.box(site, q, [.16, .54, r * Math.PI / 6 * .94], (row + sector) % 3 === 0 ? 0xc4d5dc : 0xe1e8e9, "native daylight mirror panel", true, -a - parliamentYawV295(site));
      }
  // Native replacement is a finer cardinal reading of the retained full ramps.
  if (plan.native)
    for (let route = 0; route < 2; route++) {
      const points = reichstagRampPoints(route * Math.PI);
      for (let i = 0; i < 160; i++) {
        const a = points[i], b = points[i + 1], mid = a.clone().add(b).multiplyScalar(.5), p: Point = [mid.x, terrace + Math.max(a.y, b.y) - .12, mid.z];
        // Smooth dome is unrotated in world coordinates; compensate the building
        // frame so the independent cardinal route follows that same public ramp.
        const world: Point = [P.reichstag.anchor[0] + p[0], p[1], P.reichstag.anchor[2] + p[2]], q = parliamentLocalPointV295(site, ...world);
        plan.box(site, q, [Math.abs(b.x - a.x) + 1.9, .24, Math.abs(b.z - a.z) + 1.9], C.metal, "native dome visitor tread");
      }
    }
}
function abgeordnetenhaus(plan: Plan): void {
  const site = "abgeordnetenhaus", f = P.abgeordnetenhaus.floor;
  plan.floor(site, -10, 10, -18, 1.5, 6, C.stone, "historic entrance hall floor");
  plan.floor(site, -1.6, 1.6, 1.5, 2.1, 6, C.stone, "central public portal threshold");
  plan.floor(site, -3, 3, -44, -16, 13, C.stone, "Wandelhalle approach");
  plan.floor(site, -20, 20, -80, -44, f, C.floor, "Berlin plenary hall floor");
  for (const side of [-1, 1]) {
    plan.box(site, [side * 19.8, 21.4, -62], [.24, 16.8, 36], C.wood, "plenary pale wood wall", true);
    plan.floor(site, side < 0 ? -20 : 17.4, side < 0 ? -17.4 : 20, -77, side < 0 ? -60.5 : -46, 18, C.light, "Berlin visitor side gallery");
    plan.box(site, [side * 17.3, 18.55, side < 0 ? -70 : -61.5], [.12, 1.1, side < 0 ? 14 : 31], C.metal, "Berlin visitor gallery rail", true);
    for (let k = 0; k < 11; k++) {
      const v = -75 + k * 2.5;
      if (side < 0 && v > -64)
        continue;
      seat(plan, site, side * 18.6, v, 18, side < 0 ? Math.PI / 2 : -Math.PI / 2, C.chair);
    }
    for (let i = 0; i < 36; i++)
      plan.box(site, [side * 19.62, 26.1, -79.5 + i], [.3, 6.6, .14], C.metal, "clerestory acoustic vertical fin");
  }
  plan.box(site, [0, 21.4, -79.85], [40, 16.8, .24], C.wood, "north presidium wall", true);
  for (const u of [-11.6, 11.6])
    plan.box(site, [u, 21.4, -44.15], [16.8, 16.8, .24], C.wood, "south wall outside entry", true);
  plan.box(site, [0, 25.1, -44.15], [6.4, 9.4, .24], C.light, "south entry overhead wall", true);
  plan.floor(site, -17.4, 17.4, -48, -44, 18, C.light, "Berlin south visitor balcony");
  plan.box(site, [0, 18.55, -48.1], [34.8, 1.1, .12], C.metal, "Berlin south balcony rail", true);
  for (let i = 0; i < 17; i++)
    seat(plan, site, -16 + i * 2, -45.5, 18, Math.PI, C.chair);
  // A fan of grey seats and pale desks matches the current public hall photos.
  // Display count/coordinates are not presented as a current mandate diagram.
  for (let row = 0; row < 5; row++) {
    const count = 17 + row * 8, radius = 6.1 + row * 2.05;
    for (let i = 0; i < count; i++) {
      const a = (-112 + (i + .5) / count * 224) * Math.PI / 180;
      if (Math.abs(Math.sin(a) * radius) < 1.05)
        continue; // central walkable aisle
      seat(plan, site, Math.sin(a) * radius, -65 + Math.cos(a) * radius, f, Math.PI + a, C.chair);
    }
  }
  plan.box(site, [0, f + .32, -75.8], [13, .64, 3], C.wood, "Berlin presidium dais", true);
  plan.box(site, [0, f + 1.25, -75.8], [10, .22, 1.1], C.wood, "Berlin presidium desk", true);
  plan.box(site, [0, f + .78, -73], [1.6, 1.56, 1.1], C.wood, "Berlin speakers lectern", true);
  for (const side of [-1, 1])
    for (let i = 0; i < 8; i++)
      seat(plan, site, side * (4 + i * .75), -72.2, f, side < 0 ? -Math.PI / 2 : Math.PI / 2, C.chair);
  // Three vertical ceremonial banners, with a small procedural Berlin bear.
  for (const [u, color] of [[-3.5, 0xd2b447], [0, 0xf0ece1], [3.5, 0x284b8b]] as const) {
    plan.box(site, [u, 22.1, -79.54], [2.2, 6.5, .13], color, "Berlin ceremonial banner");
  }
  for (const [u, color] of [[-4.23, 0x272b2e], [-3.5, 0xa33836], [-2.77, 0xd2b447]] as const)
    plan.box(site, [u, 22.1, -79.42], [.73, 6.5, .14], color, "German banner vertical stripe");
  plan.box(site, [0, 22.1, -79.39], [.8, 2.7, .16], C.dark, "procedural Berlin bear body");
  plan.box(site, [0, 23.7, -79.39], [.8, .8, .16], C.dark, "procedural Berlin bear head");
  for (const u of [-.5, .5]) {
    plan.box(site, [u, 24.1, -79.39], [.3, .3, .16], C.dark, "procedural Berlin bear ear");
    plan.box(site, [u, 21.4, -79.39], [.6, .35, .16], C.dark, "procedural Berlin bear leg");
  }
  // Historic entrance hall: stone piers, high framed openings and paired stairs.
  for (const u of [-8, 8])
    for (const v of [-4, -11])
      plan.box(site, [u, 12, v], [.85, 12, .85], C.stone, "entrance hall stone pier", true);
  for (const v of [-4, -11])
    plan.box(site, [0, 17.8, v], [17, .5, .85], C.light, "entrance hall stone lintel");
}
let drawn: readonly Member[] | undefined, native: readonly Member[] | undefined;
function members(isNative = false): readonly Member[] {
  if (isNative && native)
    return native;
  if (!isNative && drawn)
    return drawn;
  const p = new Plan(isNative);
  stairs(p);
  reichstag(p);
  abgeordnetenhaus(p);
  if(isNative)for(const m of p.members){
    m.color=MINECRAFT_PALETTE.reduce((best,c)=>{const distance=(n:number)=>[16,8,0].reduce((sum,shift)=>sum+(((m.color>>shift)&255)-((n>>shift)&255))**2,0);return distance(c)<distance(best)?c:best;},MINECRAFT_PALETTE[0] as number);
  }
  if (isNative)
    native = p.members;
  else
    drawn = p.members;
  return p.members;
}
export function parliamentInteriorMembersV295(isNative = false): readonly Member[] { return members(isNative); }
export function createParliamentInteriorsV295(options: {
  native?: boolean;
} = {}): Group {
  const isNative = options.native === true, items = members(isNative), root = new Group();
  root.name = PARLIAMENT_INTERIORS_GROUP_V295 + (isNative ? " native" : " drawn");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .78, metalness: .05 });
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(items.length * 16), colors = new Float32Array(items.length * 3), m = new Matrix4(), q = new Quaternion(), tint = new Color();
  items.forEach((item, i) => { q.setFromEuler(new Euler(item.tilt, item.yaw, 0, "YXZ")); m.compose(new Vector3(...item.position), q, new Vector3(...item.size)); matrices.set(m.elements, i * 16); tint.setHex(item.color).toArray(colors, i * 3); });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.count = items.length;
  mesh.name = isNative ? "Independent cardinal parliament interiors" : "Parliament interior room furniture and stairs";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  root.userData = { parliamentInteriorsV295: true, profile: P, native: isNative, fullStaticDetailOnTouch: true, textureFree: true, estimatedInteriorPlan: true, sourceSheetsRetained: true, nativeMirrorPanels: isNative ? 360 : undefined, counts: items.reduce<Record<string, number>>((a, m) => (a[m.role] = (a[m.role] ?? 0) + 1, a), {}) };
  return freezeStaticSceneTransforms(root);
}
function inRect(u: number, v: number, x0: number, x1: number, z0: number, z1: number, r = 0): boolean { return u >= x0 - r && u <= x1 + r && v >= z0 - r && v <= z1 + r; }
/** Source-ID-bound public air only. No other building or courtyard is ignored. */
export function parliamentWalkableInteriorV295(x: number, y: number, z: number, sourceId?: string): boolean {
  if (!sourceId)
    return false;
  const site: Site | undefined = (P.reichstag.sourceIds as readonly string[]).includes(sourceId) ? "reichstag" : (P.abgeordnetenhaus.sourceIds as readonly string[]).includes(sourceId) ? "abgeordnetenhaus" : undefined;
  if (!site)
    return false;
  const [u, , v] = parliamentLocalPointV295(site, x, y, z);
  if (site === "reichstag")
    return AIR.reichstag.some(b => u >= b.min[0] && u <= b.max[0] && v >= b.min[2] && v <= b.max[2] && y >= b.min[1] - .05 && (y <= b.max[1] || y >= (sourceId === "K0002MCN" ? 33.1 : 40.1) - .02));
  return y >= 5.95 && y <= 29.8 && ((inRect(u, v, -10, 10, -18, -2) || inRect(u, v, -1.6, 1.6, -2, 3.2)) || inRect(u, v, -8, 8, -33, -14) || inRect(u, v, -3, 3, -44, -14) || inRect(u, v, -20, 20, -80, -44));
}
/** Exact represented room/door/stair air, independent of a generic source
* obstacle ID. This is solely for replacing the old schematic Reichstag props;
* ordinary foreign owners still require source-ID-bound navigation admission. */
export function parliamentLegacyInteriorAirV295(x: number, y: number, z: number, radius = 0): boolean {
  const [u, , v] = parliamentLocalPointV295("reichstag", x, y, z);
  return AIR.reichstag.some(b => u - radius >= b.min[0] && u + radius <= b.max[0] && v - radius >= b.min[2] && v + radius <= b.max[2] && y >= b.min[1] - .05 && y <= b.max[1]);
}
/** Only the represented west lower-dome doorway replaces the legacy native
* shell collision. All other dome shell, mirrors and furniture still collide. */
export function parliamentDomePortalAirV295(x: number, y: number, z: number): boolean {
  const [u, , v] = parliamentLocalPointV295("reichstag", x, y, z);
  return u >= -22 && u <= -17 && v >= -8.5 && v <= -1.5 && y >= P.reichstag.terrace - .1 && y <= P.reichstag.terrace + 3.5;
}
const rampRoutes = [reichstagRampPoints(), reichstagRampPoints(Math.PI)];
export function parliamentGroundAtV295(mode: string, x: number, z: number, currentGroundY?: number): number | null {
  let site: Site;
  if (Math.abs(x - P.reichstag.anchor[0]) < 80 && Math.abs(z - P.reichstag.anchor[2]) < 45)
    site = "reichstag";
  else if (Math.abs(x - 658.3) < 65 && z > 1190 && z < 1305)
    site = "abgeordnetenhaus";
  else
    return null;
  const [u, , v] = parliamentLocalPointV295(site, x, 0, z), hint = currentGroundY ?? (site === "reichstag" ? P.reichstag.floor : 6), candidates: number[] = [], circulation: {
    height: number;
    distance: number;
  }[] = [];
  if (site === "reichstag") {
    if (inRect(u, v, -23.2, 23.2, -25.2, 25.2) || inRect(u, v, -48, -23, -10, 10) || inRect(u, v, -60, -46, -2, 2))
      candidates.push(P.reichstag.floor);
    if (inRect(u, v, -46, -19, -8, -2))
      candidates.push(P.reichstag.terrace);
    const dx = x - P.reichstag.anchor[0], dz = z - P.reichstag.anchor[2], radius = Math.hypot(dx, dz);
    if (radius >= 5.7 && radius <= 21.1)
      candidates.push(P.reichstag.terrace);
    if (radius >= 7.8 && radius <= Math.sqrt(DOME.platformAreaM2 / Math.PI + 7.8 ** 2))
      candidates.push(P.reichstag.terrace + DOME.platformHeightAboveTerraceM);
    for (const points of rampRoutes)
      for (let i = 0; i < 160; i++) {
        const a = points[i], b = points[i + 1], vx = b.x - a.x, vz = b.z - a.z, raw = ((dx - a.x) * vx + (dz - a.z) * vz) / (vx * vx + vz * vz);
        if (raw < -1e-7 || raw > 1 + 1e-7)
          continue;
        const t = Math.max(0, Math.min(1, raw)), distance = Math.hypot(dx - a.x - vx * t, dz - a.z - vz * t);
        if (distance < .88)
          circulation.push({ height: P.reichstag.terrace + (mode === "minecraft" ? Math.max(a.y, b.y) : a.y + (b.y - a.y) * t), distance });
      }
    for (let i = 1; i <= 8; i++) {
      const xx = i % 2 ? -28 : -44;
      if (inRect(u, v, xx - 1.2, xx + 1.2, -9.1, -2.9))
        candidates.push(P.reichstag.floor + i * 2.5);
    }
  }
  else {
    const roof = hint > 29 ? parliamentBerlinRoofTopV295(x, z) : null;
    if (roof !== null)
      candidates.push(roof);
    if (inRect(u, v, -10, 10, -18, 2.1))
      candidates.push(6);
    if (inRect(u, v, -3, 3, -44, -16) || inRect(u, v, -7, 7, -18.2, -14.5) || inRect(u, v, -20, 20, -80, -44))
      candidates.push(13);
    if (inRect(u, v, -7, 7, -31.8, -28.2))
      candidates.push(9.5);
    if (inRect(u, v, -20, -17.4, -77, -60.5) || inRect(u, v, 17.4, 20, -77, -46) || inRect(u, v, -17.4, 17.4, -48, -44))
      candidates.push(18);
  }
  for (const f of FLIGHTS) {
    if (f.site !== site)
      continue;
    const top = parliamentFlightTopV295(f, u, v);
    if (top !== null)
      circulation.push({ height: top, distance: 0 });
  }
  // The geometrically nearest reachable ramp segment wins over the floor
  // underneath it. Taking the tallest neighbouring ribbon skips levels;
  // taking the closest floor height prevents the first stair from ascending.
  const routes = circulation.filter(p => p.height <= hint + .6 && p.height >= hint - 4);
  if (routes.length)
    return routes.reduce((best, p) => p.distance < best.distance - 1e-7 || (Math.abs(p.distance - best.distance) < 1e-7 && Math.abs(p.height - hint) < Math.abs(best.height - hint)) ? p : best).height;
  const reachable = candidates.filter(n => n <= hint + .6 && n >= hint - 4);
  return reachable.length ? Math.max(...reachable) : null;
}
let solidGrids: Map<string, Member[]>[] | undefined;
function grid(isNative: boolean): Map<string, Member[]> {
  if (!solidGrids)
    solidGrids = [new Map(), new Map()];
  const g = solidGrids[isNative ? 1 : 0];
  if (g.size)
    return g;
  for (const m of members(isNative)) {
    if (!m.solid)
      continue;
    const c = Math.abs(Math.cos(m.yaw)), s = Math.abs(Math.sin(m.yaw)), rx = (m.size[0] * c + m.size[2] * s) / 2 + .6, rz = (m.size[0] * s + m.size[2] * c) / 2 + .6;
    for (let x = Math.floor((m.position[0] - rx) / 4); x <= Math.floor((m.position[0] + rx) / 4); x++)
      for (let z = Math.floor((m.position[2] - rz) / 4); z <= Math.floor((m.position[2] + rz) / 4); z++) {
        const key = `${x},${z}`, list = g.get(key) ?? [];
        list.push(m);
        g.set(key, list);
      }
  }
  return g;
}
export function parliamentSolidAtV295(mode: string, x: number, y: number, z: number, radius = 0): boolean {
  if (!(Math.abs(x - P.reichstag.anchor[0]) < 80 && Math.abs(z - P.reichstag.anchor[2]) < 45) && !(Math.abs(x - 658.3) < 65 && z > 1190 && z < 1305))
    return false;
  for (const m of grid(mode === "minecraft").get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []) {
    if (y < m.position[1] - m.size[1] / 2 - radius || y > m.position[1] + m.size[1] / 2 + radius)
      continue;
    const dx = x - m.position[0], dz = z - m.position[2], c = Math.cos(m.yaw), s = Math.sin(m.yaw);
    if (Math.abs(dx * c - dz * s) <= m.size[0] / 2 + radius && Math.abs(dx * s + dz * c) <= m.size[2] / 2 + radius)
      return true;
  }
  // The retained mirror cone is a physical surface; the roof skylight guard
  // and panorama desks are already represented by their granular solids.
  if (y >= P.reichstag.terrace && y <= P.reichstag.terrace + 18) {
    const r = Math.hypot(x - P.reichstag.anchor[0], z - P.reichstag.anchor[2]);
    if (r <= 2.4 + (y - P.reichstag.terrace) / 18 * 5.4 + radius)
      return true;
  }
  return false;
}
