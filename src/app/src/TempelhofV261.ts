import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import source from "./data/tempelhofV261.json";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type V = [number, number, number];
export const TEMPELHOF_V261_PROFILE = Object.freeze({
  sourceOwner: "DEBE07YY9000088X", sourcePolygon: source.front.id,
  entranceOwner: "DEBE07YY90002dsj", entrancePolygon: source.entranceFront.id,
  memorial: source.monument, bounds: [990, 3886, 1129, 4092],
  camera: { position: [1042, 39, 3982], target: [1097, 15, 4063], spanM: 110 },
  monumentCamera: { position: [966, 17, 3912], target: [995, 12, 3890], spanM: 31 },
  status: source.status, sourceSha256: source.sourceSha256,
  budgetBytes: 300_000,
});

/** Complete earlier airports remain untouched: this contains only named fittings
 * and the previously absent, independently modelled Airlift Memorial. */
export function createTempelhofV261(native = false): Group {
  const root = new Group();
  root.name = "Tempelhof main entrance and Luftbrückendenkmal v261";
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true, additiveOnly: true,
    sourceGeometryRetained: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    tempelhofV261: true, memorialHeightM: 20, westPointingRibs: 3 };
  const boxes: number[][] = native ? source.blocks.map(b => [...b]) : [];
  const positions: number[] = [], colors: number[] = [], tint = new Color();
  const triangle = (a: number[], b: number[], c: number[], color: number): void => {
    tint.setHex(color);
    for (const p of [a, b, c]) { positions.push(...p); colors.push(tint.r, tint.g, tint.b); }
  };
  if (!native) for (const [color, a, b, c] of source.triangles as [number, number[], number[], number[]][]) triangle(a, b, c, color);
  // The attested dedication follows the curved southern bronze band. No names
  // are invented where the reference does not resolve the individual letters.
  const inscription = source.monument.inscription.replace("/", " ");
  const dedication = letteringStrokePaths(inscription, .12);
  const inscriptionLayout = letteringLayout(inscription, .12);
  const slash = inscriptionLayout.glyphs[source.monument.inscription.indexOf("/")];
  const slashX = slash.leftM - inscriptionLayout.totalWidthM / 2;
  dedication.push([[slashX, 0], [slashX + slash.advanceM, .12]]);
  const dedicationX = dedication.flat().map(p => p[0]), dedicationMin = Math.min(...dedicationX);
  const dedicationWidth = Math.max(...dedicationX) - dedicationMin;
  const [mx, my, mz] = source.monument.anchor;
  const onBand = (u: number, v: number): V => {
    const t = Math.PI * (.95 - .9 * (u - dedicationMin) / dedicationWidth);
    const x = 2.125 * Math.cos(t);
    if (!native) return [mx + x, my + .17 + v, mz + 3.54 * Math.sin(t)];
    const strip = Math.min(23, Math.max(0, Math.floor((x + 2.1) / 4.2 * 24)));
    const sx = -2.1 + (strip + .5) * 4.2 / 24;
    return [mx + x, my + .17 + v, mz + 3.5 * Math.sqrt(1 - (sx / 2.1) ** 2) + .052];
  };
  for (const path of dedication) for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l === 0) continue;
    if (native) {
      const steps = Math.max(1, Math.ceil(l / .025));
      for (let j = 0; j < steps; j++) {
        const aa = onBand(p[0] + (q[0] - p[0]) * j / steps, p[1] + (q[1] - p[1]) * j / steps);
        const bb = onBand(p[0] + (q[0] - p[0]) * (j + 1) / steps, p[1] + (q[1] - p[1]) * (j + 1) / steps);
        boxes.push([(aa[0] + bb[0]) / 2, (aa[1] + bb[1]) / 2, (aa[2] + bb[2]) / 2,
          Math.abs(aa[0] - bb[0]) + .014, Math.abs(aa[1] - bb[1]) + .014, .016, 0xC1B48B]);
      }
    } else {
      const ux = -(q[1] - p[1]) / l * .007, uy = (q[0] - p[0]) / l * .007;
      const aa = onBand(p[0] + ux, p[1] + uy), bb = onBand(q[0] + ux, q[1] + uy);
      const cc = onBand(q[0] - ux, q[1] - uy), dd = onBand(p[0] - ux, p[1] - uy);
      triangle(aa, bb, cc, 0xC1B48B); triangle(aa, cc, dd, 0xC1B48B);
    }
  }
  const r = source.front.rings[0], a = r[0], b = r[1];
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const dx = (b[0] - a[0]) / length, dz = (b[2] - a[2]) / length;
  const nx = dz, nz = -dx, yaw = -Math.atan2(dz, dx), low = r[2][1];
  // The low entrance hall projects more than 6 m beyond the high window wall.
  // Anchor its doors, canopy and lettering to its own exact LoD2 front sheet.
  const er = source.entranceFront.rings[0], ea = er[0], eb = er[1];
  const entranceLength = Math.hypot(eb[0] - ea[0], eb[2] - ea[2]);
  const ex = (eb[0] - ea[0]) / entranceLength, ez = (eb[2] - ea[2]) / entranceLength;
  const entranceLow = er[2][1], entranceTop = ea[1];
  const point = (u: number, y: number, out: number, entrance = false): V => entrance
    ? [ea[0] + ex * u + ez * out, y, ea[2] + ez * u - ex * out]
    : [a[0] + dx * u + nx * out, y, a[2] + dz * u + nz * out];
  const panel = (u: number, y: number, width: number, height: number, depth: number,
    color: number, out = .44, entrance = false): void => {
    if (!native) boxes.push([...point(u, y, out, entrance), width, height, depth,
      entrance ? -Math.atan2(ez, ex) : yaw, color]);
    else {
      const px = entrance ? ex : dx, pz = entrance ? ez : dz;
      const count = Math.max(1, Math.ceil(width / .45));
      // The older 2 m orthogonal portico skin reaches farther than the upper
      // sheet at diagonal grid corners; its separate entrance skin must clear it.
      for (let i = 0; i < count; i++) boxes.push([...point(u - width / 2 + (i + .5) * width / count, y, out + (entrance ? 2.5 : 1.7), entrance),
        Math.abs(px) * width / count + Math.abs(pz) * depth, height,
        Math.abs(pz) * width / count + Math.abs(px) * depth, color]);
    }
  };
  const stroke = (p: number[], q: number[], width: number, color: number, out: number, entrance = false): void => {
    if (native) {
      const count = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / .14));
      for (let i = 0; i < count; i++) panel(p[0] + (q[0] - p[0]) * (i + .5) / count,
        p[1] + (q[1] - p[1]) * (i + .5) / count, Math.max(width, Math.abs(q[0] - p[0]) / count),
        Math.max(width, Math.abs(q[1] - p[1]) / count), .08, color, out, entrance);
      return;
    }
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = -(q[1] - p[1]) / l * width / 2, uy = (q[0] - p[0]) / l * width / 2;
    const x = point(p[0] + ux, p[1] + uy, out, entrance), y = point(q[0] + ux, q[1] + uy, out, entrance);
    const z = point(q[0] - ux, q[1] - uy, out, entrance), w = point(p[0] - ux, p[1] - uy, out, entrance);
    triangle(x, y, z, color); triangle(x, z, w, color);
  };
  // The existing v194 three-row glazed openings stay intact. Add their actual
  // crossbars, paired upper casements, and the entrance glazing beneath them.
  const count = Math.round(length / 3.35), pitch = length / count, frame = 0xD5C9AD;
  for (let i = 0; i < count; i++) {
    const u = (i + .5) * pitch;
    panel(u, low + 10.2, 2.3, .11, .075, frame);
    panel(u, low + 7.65, 2.3, .085, .075, frame);
    panel(u, low + 12.7, 2.3, .085, .075, frame);
    for (const y of [low + 19.7, low + 23.3]) panel(u, y, 2.3, .075, .075, frame);
    const eu = (i + .5) * entranceLength / count;
    panel(eu, entranceLow + 2.0, 2.55, 3.7, .09, 0x55676A, .20, true);
    for (const side of [-1, 0, 1]) panel(eu + side * 1.275, entranceLow + 2.0, .12, 3.85, .13, 0xBEBAA2, .32, true);
    panel(eu, entranceLow + 3.35, 2.55, .10, .1, 0xBEBAA2, .34, true);
    if (i > 5 && i < 16) panel(eu + .45, entranceLow + 1.55, .06, .48, .10, 0xDFD3A8, .42, true);
  }
  panel(entranceLength / 2, entranceTop + .05, entranceLength - .6, .28, 1.4, 0x9B9D90, .62, true);
  panel(entranceLength / 2, entranceTop + .20, entranceLength - .6, .08, 1.55, 0xD1CDB9, .65, true);
  panel(length / 2, 29.95, length - .2, .22, .32, 0xDAD6C7, .15);
  panel(length / 2, 28.7, length - .2, .11, .23, 0xB6B09C, .16);
  // Round gold-toned roof frieze medallions are visible in the primary front view.
  for (let i = 0; i < 11; i++) {
    const u = (i + .5) * length / 11;
    if (native) { panel(u, 29.32, .48, .48, .12, 0xB69B53, .38); panel(u, 29.32, .19, .19, .14, 0xDCD6B7, .47); }
    else for (let j = 0; j < 24; j++) {
      const t = j * Math.PI / 12, next = (j + 1) * Math.PI / 12;
      const p = point(u + Math.cos(t) * .25, 29.32 + Math.sin(t) * .25, .32);
      const q = point(u + Math.cos(next) * .25, 29.32 + Math.sin(next) * .25, .32);
      triangle(point(u, 29.32, .32), p, q, 0xB69B53);
    }
  }
  const text = "ZENTRALFLUGHAFEN", paths = letteringStrokePaths(text, .86);
  const extent = paths.flat().map(p => p[0]), middle = (Math.max(...extent) + Math.min(...extent)) / 2;
  // Source ring runs opposite exterior screen-right; invert local U exactly once.
  for (const path of paths) for (let i = 1; i < path.length; i++) stroke(
    [entranceLength / 2 - (path[i - 1][0] - middle) * 1.28, entranceTop + .28 + path[i - 1][1]],
    [entranceLength / 2 - (path[i][0] - middle) * 1.28, entranceTop + .28 + path[i][1]], .075, 0xDFDED0, 1.43, true);

  const detail = justicePalaceV183Boxes(boxes, native);
  detail.name = native ? "Independent orthogonal THF entrance and airlift blocks" : "Retained-window THF entrance fittings";
  root.add(detail);
  if (!native) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .95 });
    const mesh = new Mesh(geometry, day); mesh.name = "Three west-bending airlift ribs, half-round base and entrance lettering";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true }; root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
