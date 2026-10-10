import { Group } from "three";
import source from "./gendarmenmarktPerimeterSource.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  GendarmenmarktFacadeBuilder as Builder, perimeterEdgeLength as length,
  type PerimeterFacadeEdge as Edge,
} from "./GendarmenmarktFacadeBuilder";

type Style = {
  wall: number; trim: number; frame: number; glass: number; roof: number;
  pitch: number; upperFloors: number; kind: "historic" | "hilton" | "academy" | "office" | "striped" | "borchardt" | "einstein";
  upperArches?: boolean;
};
// Photo-proportioned material/architectural readings, not surveyed RGB/bay data.
const OFFICE: Style = { wall: 0xc9bca0, trim: 0xe0d4b7, frame: 0x374447, glass: 0x506975,
  roof: 0x6d726c, pitch: 3.7, upperFloors: 6, kind: "office" };
const HISTORIC: Style = { wall: 0xd1c6ae, trim: 0xe6ddc8, frame: 0xc5c7b5, glass: 0x53656a,
  roof: 0x9c5541, pitch: 3.7, upperFloors: 4, kind: "historic" };

export const GENDARMENMARKT_FACADE_STYLES: Record<string, Style> = {
  hilton: { ...HISTORIC, wall: 0xdfd8c2, frame: 0x624448, upperFloors: 4, pitch: 3.2, kind: "hilton" },
  academy: { ...HISTORIC, wall: 0xc9c7b9, trim: 0xdeddd1, upperFloors: 3, pitch: 3.8, kind: "academy" },
  einstein: { ...OFFICE, wall: 0xbca979, trim: 0xd3c398, frame: 0x354d41, upperFloors: 5, kind: "einstein" },
  dentons: { ...OFFICE, wall: 0xc8ceca, trim: 0xe0e2d9, frame: 0x38464d,
    kind: "striped", upperFloors: 6 },
  newton: { ...OFFICE },
  quartier205: { ...OFFICE },
  quartier206: { ...OFFICE, wall: 0xd8d5c8, trim: 0xe2dfd3, roof: 0x555d60, kind: "striped", pitch: 3.9 },
  borchardt: { ...HISTORIC, wall: 0xb57960, trim: 0xd39a79, frame: 0xe6e4d6, roof: 0x596768, pitch: 3.8, kind: "borchardt" },
  lutterWegner: { ...HISTORIC, wall: 0xcac2ad, trim: 0xded5bf, roof: 0x727c7b, upperArches: true },
  hannsEisler: { ...OFFICE, wall: 0xcbbb99, trim: 0xddd0b4, frame: 0x514943, roof: 0x985341, upperFloors: 4 },
  charlottenNorthwest: { ...HISTORIC, wall: 0xd7cabb, upperFloors: 5 },
  erdinger: { ...HISTORIC, wall: 0xdfd8bc, frame: 0x5a5a55, kind: "hilton" },
  markgrafenSoutheastNorth: { ...OFFICE, wall: 0xe0d9c3, trim: 0xe9e1cd, upperFloors: 5 },
  taipei: { ...OFFICE, wall: 0x787b7a, trim: 0x969994, frame: 0xc2c9c4, roof: 0x626d6c, upperFloors: 7 },
  franzoesischeNorthwest: { ...HISTORIC, wall: 0xcbbb9e, frame: 0x645d50, upperFloors: 3 },
  franzoesischeNorth: { ...HISTORIC, wall: 0xd1c2a5, frame: 0x645d50, upperFloors: 2 },
  franzoesischeNortheast: { ...OFFICE, wall: 0xd7d3c5, trim: 0xe2decf, upperFloors: 5 },
};
export const GENDARMENMARKT_PERIMETER_GROUP_NAME = "Gendarmenmarkt source-bound perimeter facades";
export const MINECRAFT_GENDARMENMARKT_PERIMETER_GROUP_NAME = "Block-native Gendarmenmarkt perimeter facades";

export function gendarmenmarktFacadeStyle(key: string): Style {
  return GENDARMENMARKT_FACADE_STYLES[key] ?? HISTORIC;
}

/** Thin finish panels follow source edges; they never bridge a court or street. */
function finishFace(b: Builder, edge: Edge, style: Style): void {
  const l = length(edge), h = edge.wallTopY - edge.wallBaseY;
  b.face(edge, l / 2, edge.wallBaseY + h / 2, l, h, .08, style.wall, .13);
  b.face(edge, l / 2, edge.wallBaseY + .24, l, .4, .22, style.trim, .21);
  b.face(edge, l / 2, edge.wallTopY - .2, l, .32, .48, style.trim, .30);
  if (style.kind !== "office" && style.kind !== "striped") {
    b.face(edge, l / 2, edge.wallTopY - .55, l, .13, .3, style.trim, .25);
  }
}

function groundStorefront(b: Builder, edge: Edge, style: Style, top: number): void {
  const l = length(edge), base = edge.wallBaseY;
  const bays = Math.max(1, Math.round(l / (style.kind === "hilton" ? style.pitch * 2 : style.pitch)));
  const pitch = l / bays, h = top - base;
  if (h < 2.1) return;
  for (let i = 0; i < bays; i++) {
    const u = (i + .5) * pitch;
    if (style.kind === "hilton") {
      for (const f of [.235, .735]) b.window(edge, u, base + h * f, pitch * .77,
        h * .43, style.trim, style.frame, style.glass, true, .34);
      b.face(edge, u, base + h * .49, pitch, .27, .4, style.trim, .33);
    } else if (style.kind === "academy") {
      for (const side of [-1, 1]) b.window(edge, u + side * pitch * .17,
        base + h * .45, pitch * .25, h * .53, style.trim, style.frame, style.glass, true, .34);
    } else b.window(edge, u, base + h * .48, pitch * .72, h * .8, style.trim, style.frame,
      style.glass, style.kind === "historic", .34);
    if (!b.minecraft) b.face(edge, u, base + h * .25, .09, h * .4, .1, style.frame, .48);
    // Thin lower transoms differentiate the already-authored storefront frames
    // without declaring a new door, entrance permission or tenant (v183).
    b.face(edge, u, base + .65, pitch * .68, .10, .13, style.frame, .45);
  }
  b.face(edge, l / 2, top, l, .26, .45, style.trim, .31);
}

function ordinaryFacade(b: Builder, edge: Edge, style: Style, base: number, referenceTop: number): void {
  const l = length(edge), total = referenceTop - base;
  const office = style.kind === "office" || style.kind === "striped" || style.kind === "einstein";
  const groundHeight = Math.min(style.kind === "hilton" ? 7.2 : style.kind === "academy" ? 3.5 : 4.7, total * .3);
  const upperBottom = base + groundHeight;
  const upperHeight = total - groundHeight - .75;
  const floorPitch = upperHeight / style.upperFloors;
  const bays = Math.max(1, Math.round(l / style.pitch)), pitch = l / bays;
  if (l < .65) {
    // Measured short facets describe the rounded Einstein corner. Continuous
    // glass bands follow each original plane; do not fit a full framed bay into
    // every 0.36 m source segment.
    for (let floor = 0; floor <= style.upperFloors; floor++) {
      const y = floor === 0 ? base + groundHeight / 2 : upperBottom + (floor - .5) * floorPitch;
      const h = floor === 0 ? groundHeight * .8 : floorPitch * .78;
      if (y - h / 2 < edge.wallBaseY || y + h / 2 > edge.wallTopY - .3) continue;
      b.face(edge, l / 2, y, l + .015, h, .12, style.glass, .32, "glass");
      b.face(edge, l / 2, y - h * .1, l, .08, .08, style.frame, .42);
    }
    return;
  }
  if (edge.wallBaseY < base + .5) groundStorefront(b, edge, style, Math.min(upperBottom, edge.wallTopY));
  const floors = style.kind === "academy" ? style.upperFloors :
    Math.max(style.upperFloors, Math.ceil((edge.wallTopY - upperBottom) / floorPitch));
  for (let floor = 0; floor < floors; floor++) {
    const y = style.kind === "academy" ? base + total * [.34, .635, .865][floor] : upperBottom + (floor + .5) * floorPitch;
    const h = style.kind === "academy" ? total * [.23, .20, .13][floor] : floorPitch * .78;
    if (y - h / 2 < edge.wallBaseY || y + h / 2 > edge.wallTopY - .3) continue;
    if (style.kind === "striped") {
      b.face(edge, l / 2, y, l - .15, h, .12, style.glass, .32, "glass");
      for (let j = 0; j <= bays * 2; j++) b.face(edge, j * pitch / 2, y, .095, h, .12, style.frame, .43);
      for (const dy of [-h / 2 - .12, 0, h / 2 + .12]) {
        b.face(edge, l / 2, y + dy, l, .16, .18, style.frame, .41);
      }
    } else for (let i = 0; i < bays; i++) {
      const u = (i + .5) * pitch;
      const arched = style.kind === "academy" ? floor === 1 : style.upperArches === true && floor === style.upperFloors - 1;
      b.window(edge, u, y, pitch * (office ? .75 : .55), h, style.trim,
        style.frame, style.glass, arched, .32, style.kind === "academy");
      if (style.kind === "hilton") {
        b.face(edge, u - pitch * .45, y, .21, floorPitch, .23, style.trim, .27);
        if (floor === 1) b.rail(edge, u, y - h * .06, pitch * .85, .9, 0x717d7b);
      }
      if (style.kind === "historic" && floor === 1 && i % 3 === 1) {
        b.face(edge, u, y - h / 2 - .2, pitch * .76, .22, .65, style.trim, .65);
        b.rail(edge, u, y - h / 2 + .8, pitch * .73, .98, 0x4c5350);
      }
      if (style.kind === "academy" && !b.minecraft && i % 5 === 0 && floor === 2) {
        b.rail(edge, u, y - h * .2, pitch * .8, .75, 0x535b58);
      }
    }
    b.face(edge, l / 2, upperBottom + floor * floorPitch, l, office ? .15 : .24, .25, style.trim, .26);
    if (style.kind === "striped") b.face(edge, l / 2, upperBottom + floor * floorPitch,
      l, .22, .65, style.trim, .43);
  }
  if (style.kind === "striped") {
    b.face(edge, l / 2, edge.wallTopY - .25, l, .32, 1.0, style.trim, .55);
    for (const drop of [.75, 1.13, 1.51]) b.face(edge, l / 2, edge.wallTopY - drop,
      l, .1, .20, style.frame, .4);
  }
  if (style.kind === "office") b.rail(edge, l / 2, edge.wallTopY + .75, l, .18, style.frame);
  if (!office && !b.minecraft && edge.wallBaseY < base + .5) {
    for (let row = 1; row < 7; row++) {
      b.face(edge, l / 2, base + groundHeight * row / 7, l, .045, .055, 0xa8a194, .185);
    }
  }
}

function borchardtFacade(b: Builder, edge: Edge, style: Style): void {
  const l = length(edge), base = edge.wallBaseY, h = edge.wallTopY - base;
  const floors = [base + h * .11, base + h * .32, base + h * .54, base + h * .73, base + h * .9];
  const positions = [.105, .32, .435, .565, .68, .895];
  for (let floor = 0; floor < floors.length; floor++) {
    const y = floors[floor], wh = h * (floor === 0 ? .17 : .14);
    for (const [i, fraction] of positions.entries()) {
      const u = fraction * l;
      b.window(edge, u, y, l * (i === 0 || i === 5 ? .105 : .084), wh,
        style.trim, style.frame, style.glass, floor === 4, .32, true);
    }
    b.face(edge, l / 2, y + wh / 2 + .3, l, .18, .28, style.trim, .3);
  }
  // Four pediments cover the two paired centre bays and the two single sides.
  for (const [u, width] of [[l * .105, l * .16], [l * .3775, l * .235],
    [l * .6225, l * .235], [l * .895, l * .16]]) {
    const y = floors[3] + h * .075;
    const a = b.point(edge, u - width / 2, y, .6);
    const peak = b.point(edge, u, y + width * .23, .6);
    const c = b.point(edge, u + width / 2, y, .6);
    b.beam(a, peak, .18, style.trim); b.beam(peak, c, .18, style.trim);
    b.face(edge, u, y, width, .25, .45, style.trim, .47);
  }
  const balconyY = floors[2] - h * .075;
  b.face(edge, l / 2, balconyY, l * .63, .24, 1.2, style.trim, .72);
  b.rail(edge, l / 2, balconyY + 1.0, l * .61, 1.32, 0x3f4b47);
  for (const f of [.24, .5, .76]) {
    b.face(edge, l * f, balconyY - .5, .36, 1.0, .58, style.trim, .62);
    b.beam(b.point(edge, l * f, balconyY - 1.05, .3),
      b.point(edge, l * f, balconyY - .08, 1.12), .3, style.trim);
  }
  for (const f of [.105, .895]) for (const side of [-1, 1]) {
    b.face(edge, l * f + side * l * .064, floors[0], .24, h * .19, .26, 0x484a43, .55);
  }
  const awningY = base + h * .22;
  b.face(edge, l / 2, awningY, l * .61, .2, 1.65, 0xa34637, .96);
  b.sign(edge, "BORCHARDT", l / 2, awningY - .45, .32, l * .58, 0xf3e5c9, 0xa34637, 1.82);
  b.sign(edge, "F. W. BORCHARDT", l / 2, edge.wallTopY - .6, .4, l * .82, 0x99634f, style.trim, .47);
  if (!b.minecraft) for (let row = 1; row < 24; row++) {
    const y = base + row * h / 24;
    for (const f of [.025, .975]) b.face(edge, l * f, y, l * .045, .05, .07, 0x98664f, .22);
  }
}

function characteristicMembers(b: Builder, edge: Edge, key: string, style: Style): void {
  const l = length(edge), base = edge.wallBaseY, height = edge.wallTopY - base;
  if (l < 5 || height < 10) return;
  if (key === "hannsEisler" || key === "franzoesischeNorth" || key === "franzoesischeNorthwest") {
    const bays = Math.max(2, Math.round(l / style.pitch)), pitch = l / bays;
    const bottom = base + height * .23, top = base + height * .80;
    for (let i = 0; i <= bays; i++) {
      const u = i * pitch;
      b.face(edge, u, (bottom + top) / 2, .43, top - bottom, .35, style.trim, .42);
      b.face(edge, u, top, .68, .28, .5, style.trim, .49);
      b.face(edge, u, bottom, .66, .28, .5, style.trim, .49);
    }
    b.face(edge, l / 2, top + .3, l, .45, .68, style.trim, .44);
    if (!b.minecraft) for (let i = 0; i < bays * 2; i++) b.face(edge, (i + .5) * pitch / 2,
      top + .04, .14, .27, .55, style.trim, .52);
  }
  if (key === "lutterWegner") {
    const bays = Math.max(1, Math.round(l / style.pitch)), pitch = l / bays;
    for (let i = 0; i < bays; i++) for (let floor = 1; floor <= 3; floor++) {
      b.face(edge, (i + .5) * pitch, base + height * (.2 + floor * .18), pitch * .52,
        .6, .12, 0xb69d68, .29);
    }
  }
  if (key === "erdinger") {
    const bays = Math.max(1, Math.round(l / 6.4)), pitch = l / bays;
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * pitch, width = pitch * .75;
      b.face(edge, u, base + 5.4, width, 2.8, 1.0, style.wall, .5);
      b.window(edge, u, base + 5.4, width * .85, 2.3, style.trim, style.frame, style.glass, false, 1.1);
      b.rail(edge, u, base + 7.9, width, 1.1, 0x4d5149);
    }
  }
  if (key === "taipei" && !b.minecraft) {
    const cols = Math.max(1, Math.round(l / style.pitch));
    for (let col = 0; col <= cols; col++) for (let row = 0; row < 7; row++) {
      b.face(edge, col * l / cols, base + height * (row + .5) / 7, .09, .09, .06, 0xc0c3bd, .2);
    }
  }
}

type Building = typeof source.buildings[number];
function longestFront(building: Building, street?: RegExp): Edge | undefined {
  const fronts = building.streetFronts.filter(edge => !street || street.test(edge.street));
  return [...fronts].sort((a, b) => length(b) - length(a))[0];
}

function nearAnchorFront(building: Building, street?: RegExp): { edge: Edge; u: number } | undefined {
  const anchor = building.osmAnchors[0]?.positionXZ;
  if (!anchor) return;
  let best: { edge: Edge; u: number; distance: number } | undefined;
  for (const edge of building.streetFronts) {
    if (edge.wallBaseY > 6.5 || (street && !street.test(edge.street))) continue;
    const l = length(edge), dx = (edge.endXZ[0] - edge.startXZ[0]) / l;
    const dz = (edge.endXZ[1] - edge.startXZ[1]) / l;
    const u = Math.max(1, Math.min(l - 1, (anchor[0] - edge.startXZ[0]) * dx + (anchor[1] - edge.startXZ[1]) * dz));
    const distance = Math.hypot(anchor[0] - edge.startXZ[0] - dx * u, anchor[1] - edge.startXZ[1] - dz * u);
    if (l > 2 && (!best || distance < best.distance)) best = { edge, u, distance };
  }
  return best;
}

function specialEntrance(b: Builder, building: Building, style: Style): void {
  const anchored = nearAnchorFront(building, building.key === "hilton" ? /Mohren|Amo/ :
    building.key === "dentons" || building.key === "einstein" ? /Markgraf/ :
      building.key === "newton" ? /Charlotten/ : undefined);
  const edge = building.key === "academy" ? longestFront(building, /Markgraf/) : anchored?.edge;
  if (!edge || edge.wallBaseY > 6.5 || length(edge) < 3) return;
  const l = length(edge), base = Math.min(...building.streetFronts.map(e => e.wallBaseY));
  let u = building.key === "academy" ? l / 2 : anchored!.u;
  if (building.key === "hilton") {
    // The OSM hotel POI is inside the lobby, not at the entrance. The measured
    // semicircular LoD2 porch fixes the real entry bay along this street axis.
    const porch = building.officialParts.find(p => p.id === "DEBE3DaxQzUzfwX8")!;
    const px = (Math.min(...porch.ring.map(p => p[0])) + Math.max(...porch.ring.map(p => p[0]))) / 2;
    const pz = (Math.min(...porch.ring.map(p => p[1])) + Math.max(...porch.ring.map(p => p[1]))) / 2;
    u = ((px - edge.startXZ[0]) * (edge.endXZ[0] - edge.startXZ[0]) +
      (pz - edge.startXZ[1]) * (edge.endXZ[1] - edge.startXZ[1])) / l;
    b.face(edge, u, base + 3.5, 20, .36, 3.6, 0x465351, 1.6);
    b.sign(edge, "HILTON BERLIN", u, base + 3.75, .43, 9, 0xe8e5d8, 0x465351, 3.5);
    // Faceted, glazed entrance oriel beneath the retained roof/facade envelope.
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 7;
      const c = a + Math.PI / 7;
      const p = b.point(edge, u + Math.sin(a) * 2.9, base + 5.1, .3 + Math.cos(a) * 2.0);
      const q = b.point(edge, u + Math.sin(c) * 2.9, base + 5.1, .3 + Math.cos(c) * 2.0);
      b.box([(p[0] + q[0]) / 2, p[1], (p[2] + q[2]) / 2],
        [Math.hypot(q[0] - p[0], q[2] - p[2]), 2.7, .12], 0x6e8585,
        -Math.atan2(q[2] - p[2], q[0] - p[0]), "glass");
      b.box(p, [.10, 2.8, .10], 0x4e5b58);
    }
    b.face(edge, u, base + 17.6, 4.8, 20.5, .15, style.glass, .65, "glass");
    for (const dx of [-2.4, -1.2, 0, 1.2, 2.4]) b.face(edge, u + dx, base + 17.6,
      .13, 20.5, .15, style.frame, .78);
    for (let j = 0; j < 10; j++) b.face(edge, u, base + 8.15 + j * 2.0, 4.8, .1, .15, style.frame, .78);
    for (const rise of [9.4, 13.8, 18.2]) b.rail(edge, u, base + rise, 4.9, 1.18, 0x717d7b);
  } else if (building.key === "academy") {
    b.sign(edge, "AKADEMIE DER WISSENSCHAFTEN", u, edge.wallTopY - 1.0,
      .4, Math.min(30, l * .85), 0x575954, style.wall, .38);
  } else if (building.key === "einstein") {
    b.face(edge, u, base + 3.3, Math.min(7, l), .16, 1.45, 0xb8c6bd, .9);
    b.sign(edge, "EINSTEIN KAFFEE", u, base + 3.55, .32, 6, 0xf1eee1, 0x526052);
  } else if (building.key === "dentons") {
    b.sign(edge, "DENTONS", u, base + 2.9, .25, 2.6, 0xe8e8df, 0x424d54);
  } else if (building.key === "newton") {
    b.face(edge, u, base + 3.25, 6.5, .16, 1.7, 0x4b4740, .96);
    b.sign(edge, "NEWTON BAR", u, base + 3.4, .4, 6.3, 0xe5d1ac, 0x47433d, 1.87);
  } else if (building.key === "lutterWegner") {
    b.face(edge, u, base + 3.3, 5.5, .18, 1.8, 0x435c4b, 1.05);
    b.sign(edge, "LUTTER WEGNER", u, base + 3, .24, 5.3, 0xe9e4cc, 0x435c4b, 2);
  }
}

/** All four drawn modes use this same source-bound, frozen, texture-free layer. */
export function createGendarmenmarktPerimeterFacades(
  minecraft = false,
  options: { includeLegacyQuartier206Facade?: boolean } = {},
): Group {
  const root = new Group();
  root.name = minecraft ? MINECRAFT_GENDARMENMARKT_PERIMETER_GROUP_NAME : GENDARMENMARKT_PERIMETER_GROUP_NAME;
  root.userData = { sourceBound: true, textureFree: true, fullAndMobileIdentical: true,
    blockNative: minecraft, keepInMinecraft: minecraft, facadeOnly: true, photographsBundled: false, refinementV183: "Recessed sill drip edges and storefront lower transoms on existing source facades" };
  for (const building of source.buildings) {
    if (building.key === "quartier206" && options.includeLegacyQuartier206Facade === false) continue;
    const style = gendarmenmarktFacadeStyle(building.key), builder = new Builder(minecraft, true);
    const fronts = building.streetFronts.filter(edge => length(edge) > (building.key === "einstein" ? .29 : 1.7) && edge.wallTopY - edge.wallBaseY > 2.0);
    if (fronts.length === 0) continue;
    const base = Math.min(...fronts.map(edge => edge.wallBaseY));
    // The prevailing street eave sets the grid; a single high corner/roof face
    // must not stretch all the lower storeys of an entire block.
    const eaveWeights = new Map<number, number>();
    for (const edge of fronts) {
      const top = Math.round(edge.wallTopY * 2) / 2;
      eaveWeights.set(top, (eaveWeights.get(top) ?? 0) + length(edge));
    }
    const referenceTop = [...eaveWeights].sort((a, b) => b[1] - a[1])[0][0];
    const borchardt = longestFront(building, /Franz/);
    for (const edge of fronts) {
      const edgeStyle = building.key === "academy" && edge.parentId !== "DEBE01YYK00001jU"
        ? { ...OFFICE, wall: style.wall, trim: style.trim, upperFloors: 4 } : style;
      finishFace(builder, edge, edgeStyle);
      if (building.key === "borchardt" && edge === borchardt) borchardtFacade(builder, edge, style);
      else ordinaryFacade(builder, edge, edgeStyle, base, Number.isFinite(referenceTop) ? referenceTop : edge.wallTopY);
      characteristicMembers(builder, edge, building.key, edgeStyle);
    }
    specialEntrance(builder, building, style);
    const child = builder.finish(building.name);
    child.userData = { ...child.userData, buildingKey: building.key, sourcePrismIds: building.prismIds,
      sourceFacadeCount: fronts.length, materialEvidence: "primary descriptions and credited external references" };
    root.add(child);
  }
  return freezeStaticSceneTransforms(root);
}
