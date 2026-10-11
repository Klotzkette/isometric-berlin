import { Group } from "three";
import source from "./data/gendarmenBndContextV214Source.json";
import { perimeterEdgeLength, perimeterFacadePoint, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { GENDARMEN_BND_CONTEXT_V214_PROFILE } from "./gendarmenBndContextV214Profile";

type Edge = PerimeterFacadeEdge;
type Member = { site: string; role: string; row: number[]; outward: number[] };
const C = { stone: 0xded6be, shadow: 0x8d8c7e, cream: 0xe3deca,
  aluminium: 0xd3c49d, glass: 0x78919a, frame: 0x59666a, brick: 0x777a72,
  joint: 0x5d655e, rail: 0xafb6b0 };

/** Every member is attached to a retained street plane. No new building masses. */
export function gendarmenBndContextV214Members(): Member[] {
  const members: Member[] = [];
  for (const building of source.buildings) {
    const site = building.key;
    for (const edge of building.fronts) {
      const e: Edge = edge, length = perimeterEdgeLength(e);
      const base = e.wallBaseY, top = e.wallTopY, h = top - base;
      const face = (role: string, u: number, y: number, w: number, hh: number,
        d: number, color: number, out = .3) => {
        const position = perimeterFacadePoint(e, u, y, out);
        members.push({ site, role, outward: [
          -(e.endXZ[1] - e.startXZ[1]) / length * e.outwardSide,
          (e.endXZ[0] - e.startXZ[0]) / length * e.outwardSide,
        ], row: [...position, w, hh, d,
          -Math.atan2(e.endXZ[1] - e.startXZ[1], e.endXZ[0] - e.startXZ[0]), color] });
      };
      if (site !== "living108" && site !== "feuerland") {
        // Material-specific cornice returns clarify the already reconstructed
        // perimeter without painting over a single earlier opening or ornament.
        const historic = ["hilton", "academy", "borchardt", "lutterWegner", "hannsEisler",
          "charlottenNorthwest", "erdinger", "franzoesischeNorthwest", "franzoesischeNorth"].includes(site);
        const colour = site === "borchardt" ? 0xc79a7a : site === "taipei" ? 0x9b9f98 : C.stone;
        face("eave-soffit", length / 2, top - .12, length, .10, historic ? .60 : .26, C.shadow, .43);
        face("cornice-drip", length / 2, top + .015, length, .075, historic ? .68 : .33, colour, .44);
        if (historic) {
          // Dentils are restricted to the documented bracketed HfM frontage.
          if (site === "hannsEisler") for (let u = .5; u < length - .3; u += .85) {
            face("hfm-cornice-bracket", u, top - .34, .18, .30, .35, colour, .48);
          }
          // Short corner returns make the retained cornice depth visible.
          for (const u of [.12, length - .12]) face("cornice-return", u, top - .08, .24, .24, .7, colour, .43);
        } else if (site === "dentons") {
          for (const drop of [.63, 1.0, 1.37]) {
            face("q30-recessed-upper-louvre", length / 2, top - drop, length - .1, .055, .16, C.frame, .58);
          }
        }
        continue;
      }
      // The two northern residential fronts were still generic. A source-plane
      // skin expresses their independently documented aluminium / clinker-plaster
      // identities. Original measured wall/roof sheets and courts remain below.
      const living = site === "living108";
      const darkTower = !living && top > 29.2;
      const wall = living ? C.aluminium : darkTower ? C.brick : C.cream;
      face("source-plane-cladding", length / 2, base + h / 2, length, h, .045, wall, .21);
      face("parapet-cap", length / 2, top - .035, length, .07, .24, living ? C.cream : C.rail, .3);
      if (length < 1.7) {
        // L108's measured short folded returns are opaque metal, not extra bays.
        if (living) face("folded-return-edge", length - .055, base + h / 2, .075, h, .14, C.cream, .32);
        continue;
      }
      const bays = Math.max(1, Math.round(length / (living ? 2.35 : 3.0)));
      const pitch = length / bays;
      const floorPitch = living ? 3.29 : 3.48;
      const datum = 5.2;
      // Public ground passages stay as delivered; the photographic window
      // rhythm is fitted only above the ground storey, never across a doorway.
      for (let level = 1; level < 9; level++) {
        const y = datum + (level + .5) * floorPitch;
        const wh = floorPitch * (living ? .78 : .77);
        if (y - wh / 2 < base + .15 || y + wh / 2 > top - .3) continue;
        for (let bay = 0; bay < bays; bay++) {
          const u = (bay + .5) * pitch, ww = pitch * (living ? .83 : .52);
          face("window-reveal", u, y, ww + .14, wh + .14, .12, C.frame, .31);
          face("window-glass", u, y, ww, wh, .08, C.glass, .40);
          face("window-centre-frame", u, y, .07, wh, .1, C.frame, .46);
          face("window-lower-transom", u, y - wh * .20, ww, .06, .09, C.frame, .46);
          face("window-sill", u, y - wh / 2 - .1, ww + .26, .13, .30, living ? C.cream : C.rail, .40);
          if (living) {
            // Progressive fold depth, from the measured zig-zag faces and
            // builder's photograph; a folded metal hood, not historic moulding.
            for (let step = 0; step < 5; step++) face("folded-aluminium-hood",
              u - pitch / 2 + (step + .5) * pitch / 5,
              y + wh / 2 + .14, pitch / 5, .18,
              .12 + step * .055, C.aluminium, .37 + step * .0275);
          } else {
            // French rails and shallow alternating projecting balconies are
            // characteristic of the inspected public street elevation.
            const balcony = level >= 2 && level <= 5 && bays >= 3 &&
              (darkTower ? bay === Math.floor(bays / 2) : bay === 0 || bay === bays - 1);
            const out = balcony ? 1.05 : .57;
            if (balcony) face("balcony-slab", u, y - wh / 2 - .16, ww + .45, .18, .85, wall, .68);
            face("balcony-top-rail", u, y - wh / 2 + .93, ww + .22, .07, .07, C.rail, out);
            for (let j = 0; j < 5; j++) face("balcony-baluster", u + (j / 4 - .5) * (ww + .17),
              y - wh / 2 + .48, .045, .91, .055, C.rail, out);
          }
        }
        if (!living) face("clinker-floor-joint", length / 2, y + floorPitch / 2 - .11,
          length, .055, .07, darkTower ? C.joint : 0xc7c6b8, .27);
      }
    }
  }
  return members;
}

/** Independent axis-aligned facade cells, merged only when colour and row match. */
export function gendarmenBndContextV214NativeRows(members: readonly Member[]): number[][] {
  const grid = GENDARMEN_BND_CONTEXT_V214_PROFILE.nativeGridM;
  const cells = new Map<string, [number, number, number, number]>();
  for (const { row: r, outward } of members) {
    const nx = Math.max(1, Math.ceil(r[3] / grid)), ny = Math.max(1, Math.ceil(r[4] / grid));
    const nz = Math.max(1, Math.ceil(r[5] / grid));
    const c = Math.cos(r[6]), s = Math.sin(r[6]);
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const x = r[3] * ((ix + .5) / nx - .5), z = r[5] * ((iz + .5) / nz - .5);
      // The retained native source shell has two-metre cells. Keep its new
      // facade reading just outside that skin without replacing the old shell.
      const gx = Math.round((r[0] + outward[0] * 1.1 + x * c + z * s) / grid);
      const gy = Math.round((r[1] + r[4] * ((iy + .5) / ny - .5)) / grid);
      const gz = Math.round((r[2] + outward[1] * 1.1 - x * s + z * c) / grid);
      cells.set(`${gx}:${gy}:${gz}`, [gx, gy, gz, r[7]]);
    }
  }
  const sorted = [...cells.values()].sort((a, b) => a[3] - b[3] || a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const rows: number[][] = [];
  for (let i = 0; i < sorted.length;) {
    const [x, y, z, colour] = sorted[i]; let end = i + 1;
    while (end < sorted.length && sorted[end][3] === colour && sorted[end][2] === z &&
      sorted[end][1] === y && sorted[end][0] === x + end - i) end++;
    const count = end - i;
    rows.push([(x + (count - 1) / 2) * grid, y * grid, z * grid, count * grid, grid, grid, colour]);
    i = end;
  }
  return rows;
}

export function createGendarmenBndContextV214(minecraft = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group();
  root.name = minecraft ? "Gendarmenmarkt and BND neighbours v214 native" : "Gendarmenmarkt and BND neighbours v214";
  const members = gendarmenBndContextV214Members();
  // Two compact batches permit independent frustum rejection of both districts.
  for (const neighbourhood of ["gendarmenmarkt", "bnd-neighbours"]) {
    const selected = members.filter(m => (m.site === "living108" || m.site === "feuerland") === (neighbourhood === "bnd-neighbours"));
    const mesh = justicePalaceV183Boxes(minecraft ? gendarmenBndContextV214NativeRows(selected) : selected.map(m => m.row), minecraft);
    mesh.name = `${neighbourhood} source-attached exterior detail`;
    root.add(mesh);
  }
  root.userData = { sourceBound: true, facadeOnly: true, textureFree: true,
    gendarmenBndContextV214: true, sourceGeometryRetained: true, replacementOwners: [],
    fullStaticDetailOnTouch: true, fullAndMobileIdentical: true,
    blockNative: minecraft, keepInMinecraft: minecraft, nativeMinecraft: minecraft,
    preservedOwnerIds: source.buildings.flatMap(b => b.ownerIds),
    displayEstimate: "Member sizes, window/rail rhythm and colours are reference-based recognition fits, not a facade survey" };
  return freezeStaticSceneTransforms(root);
}
