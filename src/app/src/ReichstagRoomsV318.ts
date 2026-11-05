import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from "three";
import { parliamentRetainedPlanV295, parliamentClipGeometryV295 } from "./ParliamentRetainedEnvelopeV295";
import { PARLIAMENT_INTERIORS_V295 as P, PARLIAMENT_OPENINGS_V295, parliamentLocalPointV295, parliamentWorldPointV295 as W } from "./parliamentInteriorsV295Profile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
type Point = [number, number, number];
type Plan = { box(site: "reichstag", p: Point, s: Point, color: number, role: string, solid?: boolean, yaw?: number, tilt?: number): void };

/** Publicly documented fittings inside the already admitted public room.
 * Coordinates and small dimensions are explicit photo-guided estimates. */
export function appendReichstagRoomsV318(plan: Plan): void {
  const f = P.reichstag.floor, blue = 0x6466a4, silver = 0xabb5b8;
  // The raised chair belongs to the sitting president; two lower places are
  // the secretaries. No named politician or current party allocation is drawn.
  for (const z of [-2.9, 0, 2.9]) {
    const h = z === 0 ? 1.3 : 1.0;
    plan.box("reichstag", [21.2, f + 1.05, z], [.75, .16, .8], blue, "sitting president and secretaries chair cushion", true);
    plan.box("reichstag", [21.55, f + 1.05 + h / 2, z], [.16, h, .8], blue, z === 0 ? "raised president chair back" : "secretary chair back", true);
    plan.box("reichstag", [20.5, f + 1.52, z], [.17, .035, .23], 0x30363a, "presidium display");
  }
  for (const z of [-4.7, 4.7]) plan.box("reichstag", [19.4, f + 1.54, z], [.12, .35, .06], 0x343c40, "presidium gooseneck microphone");
  // The government and Bundesrat have separate long desks at either side.
  for (const side of [-1, 1]) {
    plan.box("reichstag", [13.65, f + .76, side * 11.55], [7.45, .14, .6], 0xdddcd5, side < 0 ? "government bench continuous desk" : "Bundesrat continuous desk", true);
    for (let i = 0; i < 10; i++) plan.box("reichstag", [16.8 - i * .7, f + .95, side * 10.7], [.48, .26, .14], blue, "government and Bundesrat upholstered headrest", false);
    plan.box("reichstag", [21.95, 16, side * 7.5], [.09, .28, 3.0], 0x322e2d, "red chamber clock backing");
    for (let i = 0; i < 4; i++) plan.box("reichstag", [21.87, 16, side * 7.5 + (i - 1.5) * .32], [.04, .16, .12], 0xd05e49, "chamber clock digit cue");
    // Tall slender flag poles and cloth entirely INSIDE the hall.
    const z = side * 8.8;
    plan.box("reichstag", [21.4, f + 2.6, z], [.045, 5.2, .045], silver, "interior flagpole", true);
    if (side < 0) for (let band = 0; band < 3; band++) plan.box("reichstag", [21.4, f + 4.5 - band * .38, z + .65], [.04, .38, 1.25], [0x292b2d, 0xa83f3c, 0xd8b55c][band], "German chamber flag");
    else {
      plan.box("reichstag", [21.4, f + 4.1, z + .65], [.04, 1.15, 1.25], 0x355597, "European chamber flag");
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; plan.box("reichstag", [21.36, f + 4.1 + Math.cos(a) * .32, z + .65 + Math.sin(a) * .32], [.02, .045, .045], 0xe1bd58, "European flag star cue"); }
    }
  }
  plan.box("reichstag", [16.7, f + 1.5, 0], [1.35, .12, 1.75], silver, "speakers sloping lectern desktop", true, 0, .14);
  for (const z of [-.42, .42]) plan.box("reichstag", [16.4, f + 1.83, z], [.045, .50, .045], 0x33383a, "lectern twin microphone");
  // Reveals, vault ribs and modern steel bridges in the existing west foyer.
  for (const x of [-45, -39.5, -25]) {
    for (const z of [-9.55, 9.55]) plan.box("reichstag", [x, 11.45, z], [.5, 7.3, .3], 0xc7c0b3, "foyer stone pilaster", true);
    for (let i = 0; i < 6; i++) { const a = (i + .5) / 12 * Math.PI; plan.box("reichstag", [x, 14.8 + Math.sin(a) * 2, Math.cos(a) * 9.35], [.28, .22, 1.7], 0xd8d2c7, "foyer barrel vault rib", false, 0, -a + Math.PI / 2); }
  }
  // Glass lifts retain their existing open approach and actual guide columns.
  for (const z of [4.2, 7.6]) for (let y = 9; y < 27; y += 3) plan.box("reichstag", [-35.1, y, z], [.08, .07, 2.2], silver, "public lift shaft landing frame");
}

function inside(x: number, z: number, ring: readonly number[][]): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes; }
  return yes;
}
export const REICHSTAG_LEVELS_V318 = [
  { y: 5.3, color: 0x8f918a, name: "service level" },
  { y: 7.595, color: 0x526c97, name: "plenary level" },
  { y: 14.3, color: 0x527663, name: "visitor level" },
  { y: 19.1, color: 0x895358, name: "presidial level" },
  { y: 24.1, color: 0x999c98, name: "parliamentary group level" },
] as const;
/** Only the exhibit shows the otherwise closed functional wings. Complete
 * source footprint and SIX courtyard holes bound every slab. These are not
 * surveyed private room plans or newly opened pedestrian routes. */
export function createReichstagSectionRoomsV318(native = false): Group {
  const root = new Group(), source = parliamentRetainedPlanV295(); root.name = "Reichstag reversible longitudinal section floors";
  const ring = source.ring.map(p => [p[0] / 10, p[1] / 10]), holes = (source.holes ?? []).map(r => r.map(p => [p[0] / 10, p[1] / 10]));
  const positions: number[] = [], colors: number[] = [], color = new Color(), matrices: number[] = [], matrix = new Matrix4();
  const add = (p: Point, size: Point, tint: number) => { matrix.compose(new Vector3(...p), new Quaternion(), new Vector3(...size)); matrices.push(...matrix.elements); color.setHex(tint).toArray(colors, colors.length); };
  // The visible cut ends of the wing slabs have a small real thickness. Each
  // short member is contained in the complete retained plan, clear of courts.
  for (const level of REICHSTAG_LEVELS_V318) for (let v = -68; v < 68; v += .8) {
    if (Math.abs(v) < 26) continue;
    const p = W("reichstag", [-7.85, level.y - .14, v]);
    if ([p[0] - .12, p[0] + .12].every(x => [p[2] - .42, p[2] + .42].every(z => inside(x, z, ring) && holes.every(h => !inside(x, z, h)))))
      add(p, [.20, .24, .82], 0x92958c);
  }
  if (!native) {
    const points = [...ring, ...holes.flat()], contours = ShapeUtils.triangulateShape(ring.map(p => new Vector2(...p as [number, number])), holes.map(r => r.map(p => new Vector2(...p as [number, number]))));
    for (const level of REICHSTAG_LEVELS_V318) for (const tri of contours) for (const i of tri) positions.push(points[i][0], level.y - .02, points[i][1]);
    const full = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3)); full.computeVertexNormals();
    const clipped = parliamentClipGeometryV295(full, PARLIAMENT_OPENINGS_V295.reichstag); if (clipped !== full) full.dispose();
    const day = new MeshBasicMaterial({ color: 0xc9c6bc, side: DoubleSide }), night = new MeshStandardMaterial({ color: 0xc9c6bc, side: DoubleSide, roughness: .8 });
    const mesh = new Mesh(clipped, day); mesh.userData = { dayMaterial: day, nightMaterial: night }; mesh.name = "Measured wing footprint floors with complete courtyard holes"; root.add(mesh);
  } else {
    const minX = Math.floor(Math.min(...ring.map(p => p[0]))), maxX = Math.ceil(Math.max(...ring.map(p => p[0]))), minZ = Math.floor(Math.min(...ring.map(p => p[1]))), maxZ = Math.ceil(Math.max(...ring.map(p => p[1])));
    for (const level of REICHSTAG_LEVELS_V318) for (let z = minZ; z < maxZ; z++) {
      let start: number | null = null;
      for (let x = minX; x <= maxX; x++) {
        const contained = x < maxX && [x, x + 1].every(xx => [z, z + 1].every(zz => inside(xx, zz, ring) && holes.every(h => !inside(xx, zz, h)) && PARLIAMENT_OPENINGS_V295.reichstag.every(c => c.planes.some(p => p[0] * xx + p[1] * level.y + p[2] * zz + p[3] < -.01))));
        if (contained && start === null) start = x;
        if (!contained && start !== null) { add([(x + start) / 2, level.y - .12, z + .5], [x - start, .24, 1], 0xc9c6bc); start = null; }
      }
    }
  }
  // Coloured door reveals make the official level coding visible at the cut.
  for (const level of REICHSTAG_LEVELS_V318.slice(1)) for (const side of [-1, 1]) {
    for (const v of [40, 49, 58]) {
      const p = W("reichstag", [1.2, level.y + 1.15, side * v]);
      add(p, [.12, 2.3, 1.15], level.color);
      for (const u of [7, 25, 39]) add(W("reichstag", [u, level.y + .4, side * (v - 2.1)]), [2.4, .13, 1.0], 0xb4a991);
    }
  }
  if (matrices.length) {
    const g = new BoxGeometry(); g.deleteAttribute("uv"); const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .8 });
    const mesh = new InstancedMesh(g, day, 0); mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16); mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3); mesh.count = matrices.length / 16; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.userData = { dayMaterial: day, nightMaterial: night }; root.add(mesh);
  }
  root.userData = { native, sectionOnly: true, estimatedInteriorPlan: true, fullStaticDetailOnTouch: true, sourceCourtyardCount: holes.length, sourceSheetsRetained: true };
  return freezeStaticSceneTransforms(root);
}
