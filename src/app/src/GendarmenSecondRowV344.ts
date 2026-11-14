import { Group } from "three";
import source from "./data/gendarmenSecondRowV344.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createSourceWallHostVerifierV344 } from "./sourceWallHostV344";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Site = typeof source.buildings[number];
type Front = Site["fronts"][number];
type Panel = { role: string; u: number; y: number; w: number; h: number; d: number; color: number; out: number };
const INK = 0x5b625e, GLASS = 0x607574, TRIM = 0xd7cfba, LIGHT = 0xe2dccd;

/** Public exterior recognition fits, measured only in footprint/eave geometry.
 * Storey/axis rhythm and shallow moulding dimensions follow the cited photos.
 * No shop names, interior rooms or replacement building masses are invented. */
export function gendarmenSecondRowPanelsV344(site: Site, front: Front, native = false): Panel[] {
  const length = Math.hypot(front.endXZ[0] - front.startXZ[0], front.endXZ[1] - front.startXZ[1]);
  const base = front.wallBaseY, top = front.wallTopY, height = top - base;
  const panels: Panel[] = [];
  const face = (role: string, u: number, y: number, w: number, h: number, color: number, d = .09, out = .27) => {
    // Every new detail remains inside the measured vertical facade rectangle.
    const x0 = Math.max(.012, u - w / 2), x1 = Math.min(length - .012, u + w / 2);
    const y0 = Math.max(base + .015, y - h / 2), y1 = Math.min(top - .015, y + h / 2);
    if (x1 - x0 > .025 && y1 - y0 > .025) panels.push({ role, u: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, d, color, out });
  };
  const band = (role: string, y: number, h: number, color = TRIM, depth = .26) => face(role, length / 2, y, length, h, color, depth, .30);
  const window = (u: number, y: number, w: number, h: number, arch = false, frame = INK, divisions = 2) => {
    face("window-reveal", u, y, w + .18, h + .18, frame, .11, .29);
    face("window-glass", u, y, w, h, GLASS, .06, .36);
    face("window-sill", u, y - h / 2 - .1, w + .32, .15, TRIM, .3, .34);
    for (let i = 1; i < divisions; i++) face("window-mullion", u - w / 2 + w * i / divisions, y, .06, h, frame, .08, .42);
    face("window-transom", u, y + h * .17, w, .065, frame, .08, .42);
    if (arch) {
      // Opaque spandrel shoulders recover the arched opening without making
      // transparent cavities in the retained closed source envelope.
      const steps = native ? 7 : 12, radius = Math.min(w / 2, h * .28);
      for (let i = 0; i < steps; i++) {
        const x = ((i + .5) / steps - .5) * w;
        const rise = radius * Math.sqrt(Math.max(0, 1 - (x / (w / 2)) ** 2));
        const cap = radius - rise;
        if (cap > .025) face("arch-spandrel", u + x, y + h / 2 - cap / 2, w / steps + .015, cap, site.wall, .09, .47);
        face("arched-window-hood", u + x, y + h / 2 - cap + .12, w / steps + .025, .16, TRIM, .13, .48);
      }
    }
  };
  // The original 0.125m generic sill sheets stay below this 0.215m skin.
  // The actual metric wall, all roof sheets and courts remain untouched.
  face("source-wall-finish", length / 2, base + height / 2, length, height, site.wall, .07, .18);
  band("stone-plinth", base + .40, .78, 0xa39f90, .11);
  band("eave-shadow", top - .35, .14, 0x8b887c, .27);
  band("eave-cornice", top - .15, .16, LIGHT, .39);
  const key = site.key, pitch = height / site.floors;
  const modern = key === "hausvogtei1" || key === "hausvogtei2";
  const palace = key === "manheimer" || key === "tauben26";
  let bays = Math.max(1, Math.round(length / (modern ? 4.5 : palace ? 4.4 : 3.6)));
  if (key === "mendelssohnBank") bays = 7;
  if (key === "tauben26") bays = 3;
  if (key === "hausvogtei1") bays = 5;
  if (key === "bosch") bays = 8;
  // The two measured shallow bows at no.2 are actual LoD2 faces. Its short
  // returns are glazed as partial windows rather than acquiring extra axes.
  if (key === "hausvogtei2" && !native) bays = 1;
  const bay = length / bays;
  for (let level = 0; level < site.floors; level++) {
    const y = base + pitch * (level + .53);
    if (modern || key === "hausvoigt" || key === "bosch" || key === "mendelssohnHouse") {
      band("floor-sill-band", base + pitch * level + .12, modern ? .16 : .10,
        modern ? 0xb2aa97 : TRIM, modern ? .23 : .17);
    }
    for (let i = 0; i < bays; i++) {
      const u = bay * (i + .5);
      let w = Math.min(bay * (modern ? .79 : palace ? .69 : .49), modern ? 4.0 : palace ? 4.0 : 2.0);
      let h = pitch * (modern ? .71 : palace ? .73 : .58);
      if (key === "mendelssohnBank") { w = bay * .48; h = pitch * .51; }
      if (key === "hausvoigt") { w = bay * .65; h = pitch * (level === 1 ? .74 : .56); }
      const gate = level === 0 && ((key === "mendelssohnBank" && i === 0) ||
        (key === "bosch" && i === Math.floor(bays / 2)) || (key === "mendelssohnHouse" && i === 0));
      if (gate) {
        face("entrance-stone-frame", u, base + pitch * .48, bay * .84, pitch * .9, TRIM, .24, .32);
        face("entrance-timber", u, base + pitch * .43, bay * .64, pitch * .78, 0x655448, .12, .49);
        face("entrance-door-joint", u, base + pitch * .43, .06, pitch * .77, 0x3a3d39, .08, .57);
        face("door-handle", u + .16, base + 1.3, .05, .35, 0xc0b391, .10, .61);
        continue;
      }
      window(u, y, w, h, key === "manheimer" && level === 0,
        key === "hausvogtei2" ? 0x356b72 : key === "bosch" || key === "mendelssohnHouse" ? 0xd9d8cd : INK,
        modern || key === "tauben26" ? 3 : 2);
      if (key === "mendelssohnBank") {
        if (level === 0) for (let bar = 0; bar < 5; bar++) face("bank-wrought-iron-grille", u + (bar / 4 - .5) * w * .83, y, .045, h, 0x4d5350, .06, .49);
        else {
          face("bank-classical-lintel", u, y + h / 2 + .32, w + .62, .22, TRIM, .40, .38);
          for (const side of [-1, 1]) face("bank-console", u + side * (w / 2 + .17), y + h / 2 + .12, .14, .36, TRIM, .26, .36);
        }
      }
      if (key === "tauben26" && level >= 2) {
        for (const side of [-1, 1]) face("bow-window-side-jamb", u + side * w * .43, y, .09, h, LIGHT, .24, .45);
        face("spandrel-panel", u, y - pitch / 2 + .30, w * .72, .34, 0xb4ae99, .13, .29);
      }
      if (key === "manheimer" && level === 2) {
        face("classical-window-apron", u, y - h / 2 - .28, w, .34, TRIM, .22, .32);
        for (let b = 0; b < 5; b++) face("balustrade-spindle", u + (b / 4 - .5) * w * .85, y - h / 2 + .32, .08, .62, TRIM, .14, .49);
        face("balustrade-top", u, y - h / 2 + .64, w + .16, .09, LIGHT, .19, .48);
      }
    }
  }
  if (palace) {
    // Monumental fluted pilasters are the differentiating architecture of
    // Manheimer and the three bowed window bays of Reichhelm's Tauben26.
    const bottom = base + pitch * (key === "tauben26" ? 2 : 1), end = top - pitch;
    for (let i = 0; i <= bays; i++) {
      const u = Math.min(length - .23, Math.max(.23, i * bay));
      face("colossal-pilaster", u, (bottom + end) / 2, .60, end - bottom, TRIM, .34, .37);
      for (const shift of [-.18, 0, .18]) face("pilaster-flute", u + shift, (bottom + end) / 2, .045, end - bottom - .4, 0xa7a18e, .06, .57);
      face("ionic-capital", u, end - .14, .96, .28, LIGHT, .39, .43);
      for (const sign of [-1, 1]) face("capital-volute", u + sign * .36, end - .21, .23, .30, TRIM, .43, .45);
      face("pilaster-base", u, bottom + .10, .86, .23, LIGHT, .41, .43);
    }
    band("entablature", top - pitch, .30, LIGHT, .45);
    for (let u = .3; u < length - .2; u += .65) face("dentil", u, top - pitch - .23, .17, .22, TRIM, .28, .43);
    if (key === "tauben26") {
      band("first-floor-balcony-slab", base + pitch + .05, .20, TRIM, .65);
      band("first-floor-balcony-rail", base + pitch + .95, .075, INK, .10);
      for (let u = .25; u < length; u += .38) face("first-floor-balcony-baluster", u, base + pitch + .53, .045, .83, INK, .08, .59);
    }
  }
  if (key === "mendelssohnBank") {
    band("bank-central-stringcourse", base + pitch, .30, LIGHT, .36);
    band("bank-attic-lower-rail", top - .95, .16, TRIM, .33);
    for (let u = .3; u < length - .2; u += .58) face("bank-attic-baluster", u, top - .62, .15, .58, TRIM, .23, .32);
    for (let y = base + .8; y < top - 1.4; y += .64) band("sandstone-course-joint", y, .028, 0xb4ac99, .075);
  }
  return panels;
}

function drawnRows(site: Site, front: Front): number[][] {
  const dx = front.endXZ[0] - front.startXZ[0], dz = front.endXZ[1] - front.startXZ[1];
  const length = Math.hypot(dx, dz), nx = -dz / length * front.outwardSide, nz = dx / length * front.outwardSide;
  return gendarmenSecondRowPanelsV344(site, front).map(p => [
    front.startXZ[0] + dx / length * p.u + nx * p.out, p.y,
    front.startXZ[1] + dz / length * p.u + nz * p.out,
    p.w, p.h, p.d, -Math.atan2(dz, dx), p.color,
  ]);
}

/** Native facade pieces are clipped to real exposed cardinal support columns.
 * Their planes, lengths and y-runs come from the independent native packet.
 * No rotated boxes, mesh voxelisation, shifted smooth fronts or guessed shells. */
function nativeRows(site: Site, front: Front): number[][] {
  const panels = gendarmenSecondRowPanelsV344(site, front, true), result: number[][] = [];
  const dx = front.endXZ[0] - front.startXZ[0], dz = front.endXZ[1] - front.startXZ[1], length = Math.hypot(dx, dz);
  for (const host of front.nativeFaces) {
    const component = host.axis === 0 ? dz / length : dx / length;
    const centre = host.along + 1;
    const halfU = Math.abs(component);
    for (const p of panels) {
      const u0 = Math.max(host.u - halfU, p.u - p.w / 2), u1 = Math.min(host.u + halfU, p.u + p.w / 2);
      const y0 = Math.max(host.bottom + .012, p.y - p.h / 2), y1 = Math.min(host.top - .012, p.y + p.h / 2);
      if (u1 - u0 < .026 || y1 - y0 < .026 || Math.abs(component) < .1) continue;
      const along = centre + ((u0 + u1) / 2 - host.u) / component;
      const width = (u1 - u0) / Math.abs(component), out = p.out - .08;
      result.push(host.axis === 0 ? [host.coordinate + host.sign * out, (y0 + y1) / 2, along, p.d, y1 - y0, width, p.color] :
        [along, (y0 + y1) / 2, host.coordinate + host.sign * out, width, y1 - y0, p.d, p.color]);
    }
  }
  return result;
}

/** Must run on the complete, un-compacted resident world. Missing, retired or
 * moved host triangles produce no floating detail and no replacement owner. */
export function createGendarmenSecondRowV344(world: Group, native = false): Group {
  const root = new Group(), verify = createSourceWallHostVerifierV344(world, native);
  root.name = native ? "Gendarmenmarkt second row v344 native" : "Gendarmenmarkt second row v344";
  const admitted: string[] = [], rejected: string[] = [];
  let count = 0, fronts = 0, nativeFaces = 0;
  for (const site of source.buildings) {
    const rows: number[][] = [];
    const candidates = native && site.nativeFronts ? site.nativeFronts : site.fronts;
    for (const front of candidates) {
      if (!verify(native ? front.nativeReceipts : front.drawnReceipts)) { rejected.push(`${site.key}:${front.sourcePolygonId}`); continue; }
      rows.push(...(native ? nativeRows(site, front) : drawnRows(site, front)));
      fronts++;
      if (native) nativeFaces += front.nativeFaces.length;
    }
    if (!rows.length) continue;
    const mesh = justicePalaceV183Boxes(rows, native);
    mesh.name = `${site.name} · source-attached facade`;
    mesh.userData.facadeOnly = true;
    mesh.userData.sourceParent = site.owner;
    root.add(mesh); admitted.push(site.key); count += rows.length;
  }
  root.userData = {
    textureFree: true, facadeOnly: true, gendarmenSecondRowV344: true,
    sourceGeometryRetained: true, sourceBound: true, replacementOwners: [],
    admitted, rejected, fronts, nativeFaces, instances: count,
    instanceBytes: count * 76, fullAndMobileIdentical: true,
    keepInMinecraft: native, blockNative: native, nativeMinecraft: native,
    displayEstimate: "Photo-based exterior recognition; measured wall/eave hosts, fitted axes/materials/mouldings. No interior reconstruction.",
  };
  return freezeStaticSceneTransforms(root);
}
