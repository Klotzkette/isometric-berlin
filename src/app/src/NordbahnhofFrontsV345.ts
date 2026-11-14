import { Group } from "three";
import source from "./data/nordbahnhofFrontsV345.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createSourceWallHostVerifierV344 } from "./sourceWallHostV344";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Site = typeof source.buildings[number];
type Front = Site["fronts"][number];
type Panel = { u: number; y: number; w: number; h: number; d: number; out: number; color: number };

/** Retained OSM storeys on measured source walls. Bay widths and shallow
 * joinery are contextual display fits; no doors, signs or rooms are invented. */
export function nordbahnhofPanelsV345(site: Site, front: Front): Panel[] {
  const length = Math.hypot(front.endXZ[0] - front.startXZ[0], front.endXZ[1] - front.startXZ[1]);
  const low = front.wallBaseY, top = front.wallTopY, height = top - low;
  const panels: Panel[] = [];
  const face = (u: number, y: number, w: number, h: number, color: number, d = .08, out = .32) => {
    const left = Math.max(.012, u - w / 2), right = Math.min(length - .012, u + w / 2);
    const bottom = Math.max(low + .012, y - h / 2), upper = Math.min(top - .012, y + h / 2);
    if (right - left > .025 && upper - bottom > .025) panels.push({u: (left + right) / 2, y: (bottom + upper) / 2, w: right - left, h: upper - bottom, d, out, color});
  };
  // Same retained wall shade masks the older approximate pane grid without
  // removing or changing the exact roof, body, navigation or source words.
  face(length / 2, low + height / 2, length, height, site.wall, .07, .18);
  face(length / 2, low + .32, length, .6, 0x9e9e95, .09, .26);
  face(length / 2, top - .20, length, .14, 0xd8d8cf, .14, .29);
  const pitch = height / site.levels, bays = Math.max(1, Math.round(length / 3.8)), step = length / bays;
  for (let level = 0; level < site.levels; level++) for (let bay = 0; bay < bays; bay++) {
    const u = (bay + .5) * step, y = low + (level + .53) * pitch;
    const w = Math.min(2.1, step * .53), h = pitch * .59;
    face(u, y, w + .17, h + .17, 0xb0b0a6, .11, .29);
    face(u, y, w, h, 0x71898d, .06, .36);
    face(u, y - h * .12, w - .08, h * .68, 0x536970, .035, .40);
    face(u, y, .065, h, 0xdcded6, .07, .43);
    face(u, y + h * .21, w, .07, 0xdcded6, .07, .43);
    face(u, y - h / 2 - .10, w + .23, .13, 0xd0d0c7, .22, .34);
  }
  return panels;
}
function rows(site: Site, front: Front, native: boolean): number[][] {
  const dx = front.endXZ[0] - front.startXZ[0], dz = front.endXZ[1] - front.startXZ[1], length = Math.hypot(dx, dz);
  const panels = nordbahnhofPanelsV345(site, front);
  if (!native) return panels.map(p => [front.startXZ[0] + dx / length * p.u - dz / length * front.outwardSide * p.out,
    p.y, front.startXZ[1] + dz / length * p.u + dx / length * front.outwardSide * p.out,
    p.w, p.h, p.d, -Math.atan2(dz, dx), p.color]);
  const result: number[][] = [];
  for (const host of front.nativeFaces) {
    const component = host.axis === 0 ? dz / length : dx / length, halfU = Math.abs(component);
    if (halfU < .1) continue;
    for (const p of panels) {
      const left = Math.max(host.u - halfU, p.u - p.w / 2), right = Math.min(host.u + halfU, p.u + p.w / 2);
      const bottom = Math.max(host.bottom + .012, p.y - p.h / 2), top = Math.min(host.top - .012, p.y + p.h / 2);
      if (right - left < .026 || top - bottom < .026) continue;
      const along = host.along + 1 + ((left + right) / 2 - host.u) / component, width = (right - left) / halfU;
      const outside = host.coordinate + host.sign * (p.out - .08);
      result.push(host.axis === 0 ? [outside, (bottom + top) / 2, along, p.d, top - bottom, width, p.color] :
        [along, (bottom + top) / 2, outside, width, top - bottom, p.d, p.color]);
    }
  }
  return result;
}
/** Called after Alt-Mitte bodies exist and before compaction; every face must
 * have its unchanged, actual decoded host in the correct world position. */
export function createNordbahnhofFrontsV345(world: Group, native = false): Group {
  const root = new Group(), verify = createSourceWallHostVerifierV344(world, native);
  root.name = `Nordbahnhof source-bound fronts v345${native ? " native" : ""}`;
  const admitted: string[] = [], rejected: string[] = [];
  let instances = 0;
  for (const site of source.buildings) {
    const shapes: number[][] = [];
    for (const front of site.fronts) {
      if (!verify(native ? front.nativeReceipts : front.drawnReceipts)) { rejected.push(site.owner); continue; }
      shapes.push(...rows(site, front, native));
    }
    if (!shapes.length) continue;
    const mesh = justicePalaceV183Boxes(shapes, native);
    mesh.name = `${site.name} · ${site.owner}`;
    mesh.userData.facadeOnly = true;
    root.add(mesh); admitted.push(site.owner); instances += shapes.length;
  }
  root.userData = {nordbahnhofFrontsV345: true, sourceGeometryRetained: true, sourceBound: true,
    admitted, rejected, instances, instanceBytes: instances * 76, replacementOwners: [],
    fullAndMobileIdentical: true, keepInMinecraft: native, blockNative: native, nativeMinecraft: native};
  return freezeStaticSceneTransforms(root);
}
