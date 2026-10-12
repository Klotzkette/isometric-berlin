import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createLegoGiraffeV216 } from "./LegoGiraffeV216";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const LEGOLAND_V216_GROUP = "LEGOLAND entrance and current yellow brick giraffe v216";
// OSM node 429567552 is the underground attraction's POI, NOT the sculpture.
// DOP 2025 + the two credited July 2022 photos locate its street-side approach
// between retained LoD2 owners buyDLWGH and ORetJTt6. These are visual alignment
// estimates, not surveyed door/sculpture corners. No source owner is removed.
export const LEGOLAND_V216_GIRAFFE = [61.3, 5.18, 1053.3] as const;
export const LEGOLAND_V216_PAVILION = [65, 5.18, 1039.8] as const;
const SILVER = 0xb9c6c8, DARK = 0x34444a, YELLOW = 0xffd52b;

export function createLegolandEntranceV216(minecraft = false): Group {
  const root = new Group(); root.name = LEGOLAND_V216_GROUP;
  root.userData = { legolandV216: true, nativeMinecraft: minecraft,
    keepInMinecraft: minecraft, fullStaticDetailOnTouch: true, textureFree: true,
    geometryStatus: "Photo/DOP-aligned recognition estimate; sculpture and doorway not surveyed",
    sourceGeometryRetained: true };
  // A bounded sett apron, confirmed by OSM footway 779525528 and DOP, over
  // the older coarse grass. Heights sample the retained 16 m terrain field;
  // the existing broad ground runs top out at 5.1 m. A 6 cm clearance keeps
  // this small flat paved landing free of coincident grass surfaces.
  // The median behind the sign remains outside this pedestrian wedge.
  const apron = [[55.6, 5.16, 1054.8], [56.3, 5.16, 1057.2],
    [67.3, 5.16, 1056.7], [71.5, 5.16, 1043.8],
    [68.5, 5.16, 1035.5], [61.8, 5.16, 1035.5],
    [60.8, 5.16, 1049.6]];
  // Five fixed triangles preserve the concave median boundary.
  const positions: number[] = [];
  for (const [a, b, c] of [[0, 1, 6], [1, 2, 6], [2, 3, 6], [3, 4, 6], [4, 5, 6]]) {
    positions.push(...apron[a], ...apron[b], ...apron[c]);
  }
  const pavingGeometry = new BufferGeometry();
  pavingGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  pavingGeometry.computeVertexNormals(); pavingGeometry.computeBoundingSphere();
  const paving = new Mesh(pavingGeometry, new MeshBasicMaterial({ color: 0x858b8c }));
  paving.name = "LEGOLAND source-aligned sett approach";
  paving.userData = { keepInMinecraft: minecraft, blockNative: minecraft,
    dayMaterial: paving.material, nightMaterial: new MeshStandardMaterial({ color: 0x858b8c, roughness: .98 }),
    sourceWay: "779525528", boundaryStatus: "DOP-aligned estimated apron, original mapped path retained" };
  root.add(paving);
  const giraffe = createLegoGiraffeV216(minecraft);
  giraffe.position.set(...LEGOLAND_V216_GIRAFFE);
  giraffe.rotation.y = Math.PI - .2;
  root.add(giraffe);

  const pavilion = new Group(); pavilion.name = "LEGOLAND glazed entrance pavilion";
  pavilion.position.set(...LEGOLAND_V216_PAVILION);
  pavilion.rotation.y = .38;
  const rows: number[][] = [], panes: number[][] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
    rows.push([x, y, z, w, h, d, 0, color]);
  };
  const glass = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    panes.push([x, y, z, w, h, d]);
  };
  const text = (label: string, height: number, x: number, y: number, z: number, color: number) => {
    // Letter strokes are short surface blocks in the same final-count batch.
    for (const path of letteringStrokePaths(label, height)) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (height * .11)));
        for (let s = 0; s <= n; s++) {
          const t = s / n;
          box(x + a[0] + (b[0] - a[0]) * t, y + a[1] + (b[1] - a[1]) * t,
            z, height * .14, height * .14, .024, color);
        }
      }
    }
  };
  // Low freestanding glazed ticket/entry pavilion; ground-level double doors
  // remain distinct from the unrelated shop lift inside the Forum.
  box(0, .035, 0, 5.3, .07, 5.8, 0x777b79);
  box(0, 3.55, 0, 5.7, .17, 6.2, SILVER);
  box(0, 3.45, 0, 5.42, .08, 5.92, DARK);
  for (const x of [-2.5, 2.5]) {
    for (const z of [-2.75, -.9, .9, 2.75]) box(x, 1.75, z, .09, 3.5, .09, SILVER);
    glass(x, 1.6, 0, .045, 3.05, 5.4);
    box(x, 1.1, 0, .07, .07, 5.5, SILVER);
  }
  glass(0, 1.55, -2.76, 5, 3, .045);
  // Glass doors, rails, silver jambs and offset handles make the entrance read
  // from a walking view, rather than a featureless closed rectangular proxy.
  for (const x of [-2.5, -1.4, 0, 1.4, 2.5]) box(x, 1.35, 2.78, .075, 2.7, .1, SILVER);
  for (const x of [-.7, .7]) {
    glass(x, 1.32, 2.78, 1.32, 2.57, .04);
    box(x, .2, 2.81, 1.3, .18, .06, SILVER);
    box(x < 0 ? -.16 : .16, 1.22, 2.87, .045, .48, .06, DARK);
  }
  for (const x of [-1.96, 1.96]) glass(x, 1.3, 2.77, 1, 2.5, .04);
  box(0, 3.02, 2.87, 5.05, .74, .12, 0xf7f6e7);
  text("LEGOLAND", .36, 0, 2.99, 2.952, 0x171c22);
  text("DISCOVERY CENTRE", .16, 0, 2.77, 2.952, 0x333b40);
  box(-2.18, 3.11, 2.96, .4, .4, .035, 0xd82b30);
  text("LEGO", .083, -2.18, 3.07, 2.985, 0xffffff);
  // Small brick columns frame the entrance; they never obstruct the doors.
  for (const x of [-2.2, 2.2]) {
    const colors = [0x267dba, YELLOW, 0xd32c32, 0x398d57];
    for (let course = 0; course < 4; course++) {
      box(x, .25 + course * .49, 3.02, .45, .47, .4, colors[course]);
      for (const sx of [-.12, .12]) box(x + sx, .50 + course * .49, 3.02, .1, .065, .13, colors[course]);
    }
  }
  const members = justicePalaceV183Boxes(minecraft ? rows.map(r => [...r.slice(0, 6), r[7]]) : rows, minecraft);
  members.name = "LEGOLAND door frames brick jambs and geometric lettering";
  pavilion.add(members);
  const glazing = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({
    color: new Color(0x96c6d2), transparent: true, opacity: .26, roughness: .26,
    depthWrite: false,
  }), panes.length);
  const matrix = new Matrix4();
  panes.forEach((p, i) => {
    matrix.makeScale(p[3], p[4], p[5]); matrix.setPosition(p[0], p[1], p[2]); glazing.setMatrixAt(i, matrix);
  });
  glazing.name = "LEGOLAND transparent entry glazing";
  glazing.userData = { keepInMinecraft: minecraft, blockNative: minecraft };
  glazing.computeBoundingBox(); glazing.computeBoundingSphere(); pavilion.add(glazing);
  root.add(pavilion);

  // Glass sign tower in the planted median immediately behind the giraffe.
  // Its yellow panel belongs here, not on a new invented building facade.
  const marker = new Group(); marker.name = "LEGOLAND yellow wayfinding panel";
  marker.position.set(58.8, 5.16, 1046.4); marker.rotation.y = .12;
  rows.length = 0;
  for (const x of [-1.48, 1.48]) box(x, 2.2, 0, .09, 4.4, .1, SILVER);
  for (const y of [1.12, 2.62, 4.35]) box(0, y, 0, 3.06, .09, .1, SILVER);
  box(0, 1.89, .02, 2.92, 1.4, .09, YELLOW);
  // Upper glazing is hinted by thin neutral blue strips to avoid another
  // transparent sorting layer next to the giraffe's silhouette.
  for (const x of [-.75, 0, .75]) box(x, 3.47, 0, .032, 1.7, .035, 0x87a4aa);
  text("LEGOLAND", .30, 0, 1.86, .09, 0x111923);
  text("DISCOVERY CENTRE", .105, 0, 1.62, .09, 0x9f2524);
  const wayfinding = justicePalaceV183Boxes(minecraft ? rows.map(r => [...r.slice(0, 6), r[7]]) : rows, minecraft);
  marker.add(wayfinding); root.add(marker);
  return freezeStaticSceneTransforms(root);
}
