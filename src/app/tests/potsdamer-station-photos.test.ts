import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Box3, Color, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";
import { createPotsdamerSouthStationPhotoDrawn } from "../src/PotsdamerStationDrawn";
import { createDistantBuildingShells, createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles, createPedestrianState, pedestrianPointIsBlocked, type PedestrianEnvironment } from "../src/pedestrianNavigation";
import { POTSDAMER_DETAIL_PROFILE } from "../src/expandedCityProfiles";
import {
  POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT as receipt,
  potsdamerSouthStationPhotoBlocks, preparePotsdamerSouthStationPhotoTransfer,
} from "../src/PotsdamerStationPhotoDetails";
import { POTSDAMER_STATION_PHOTO_STRIP_RECEIPT as strip, canReplacePotsdamerSouthStationPhoto } from "../src/potsdamerStationPhotoOwnership";
import { potsdamerStationStripPhotoMembers, potsdamerStationStripPhotoNativeBlocks } from "../src/potsdamerStationPhotoStrip";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import type { VoxelPayload } from "../src/terrainPayload";

const profile = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;
const hall = profile.halls[1];
const payload = voxels as unknown as VoxelPayload;
const current = readFileSync(new URL("../src/PotsdamerStationDrawn.ts", import.meta.url), "utf8");
const previous = gunzipSync(Buffer.from("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", "base64")).toString();
type Call = { kind: string; values: any[] };
const plain = (v: any): any => v instanceof Vector3 ? v.toArray() : v;

/** Replay the actual current and preceding functions with identical retained
 * sources. This records the original primitive recipes independently of new
 * claims, so missing glass, stairs or southern geometry cannot pass unnoticed. */
function recorded(source: string): Call[] {
  const calls: Call[] = [];
  const begin = source.indexOf("function addPotsdamerEntranceHalls(");
  const end = source.indexOf("function addPotsdamerEntranceHallLettering(", begin);
  const body = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(begin, end));
  const capture = (kind: string) => (...values: any[]) => calls.push({ kind, values: values.slice(1).map(plain) });
  const run = new Function("POTSDAMER_DETAIL_PROFILE", "Vector3", "GLASS", "DARK_FRAME",
    "addPolygonPrism", "addLocalBox", "addBeamBetween", "rotatedLocalOffset",
    `${body}; return addPotsdamerEntranceHalls;`)(POTSDAMER_DETAIL_PROFILE, Vector3,
      0xa7d1d8, 0x29373a, capture("prism"), capture("box"), capture("beam"),
      (x: number, z: number, yaw: number) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)]);
  run({}, new Map([["Mall of Berlin", {}]]));
  return calls;
}

test("source roof correction retains both measured plans, every stair and the entire north hall", () => {
  const before = recorded(previous), after = recorded(current);
  const retained = (calls: Call[]) => calls.filter(c => ![0x29373a, 0xa7d1d8, profile.ownerPhotoRecognition.steelTone].includes(c.values[0]));
  expect(retained(after)).toEqual(retained(before));
  const south = (c: Call) => c.kind === "prism" ? c.values[1][0][1] > 1100 : c.values[1][2] > 1100;
  expect(after.filter(c => !south(c))).toEqual(before.filter(c => !south(c)));
  expect(after.filter(c => c.values[0] === 0xa7d1d8)).toHaveLength(8);
  expect(after.filter(c => c.kind === "prism").map(c => c.values[1]))
    .toEqual(before.filter(c => c.kind === "prism").map(c => c.values[1]));
  expect(hall.sourceRoofYM - hall.sourceGroundYM).toBeCloseTo(hall.officialHeightM, 7);
  const roof = after.find(c => c.kind === "prism" && south(c))!;
  expect(roof.values[2] + roof.values[3]).toBeCloseTo(14.178, 7);
  expect(profile.halls.map(h => [h.sourceBuildingId, h.officialHeightM, h.footprintRingWorldM.length])).toEqual([
    ["DEBE01YYK0002SCt", 9.414, 6], ["DEBE01YYK0000BRX", 14.696, 10],
  ]);
  // Three low sill pieces replace no previous window or grid member.
  expect(after.length - before.length).toBe(3);
  expect(after.filter(c => c.values[0] === profile.ownerPhotoRecognition.steelTone).length)
    .toBe(before.filter(c => c.values[0] === 0x29373a && south(c)).length + 3);
});

test("front and return inscriptions are on their fascia faces and drawn detail is identical on touch", () => {
  const landmarks = [{ name: "Mall of Berlin", world: [0, 0, 0] as [number, number, number] }];
  const full = createExpandedCityDetails(landmarks, { detailProfile: "full" });
  const mobile = createExpandedCityDetails(landmarks, { detailProfile: "mobile" });
  const get = (root: Group) => root.getObjectByName("Potsdamer Platz station entrance halls")!;
  expect(staticGeometryAudit(get(full))).toEqual(staticGeometryAudit(get(mobile)));
  const bounds = new Box3().setFromObject(get(full));
  expect(bounds.max.y).toBeCloseTo(profile.halls[0].groundY + profile.halls[0].officialHeightM, 4);
  for (const h of profile.halls) {
    const sign = full.getObjectByName(`Potsdamer Platz ${h.key} hall fascia lettering`) as Mesh;
    const dx = sign.position.x - h.centerWorldM[0], dz = sign.position.z - h.centerWorldM[1];
    const z = dx * Math.sin(h.rotationY) + dz * Math.cos(h.rotationY);
    expect(z * h.frontSide).toBeCloseTo(h.footprintSizeM[1] / 2 + (h.key === "south" ? .012 : -.03), 7);
    expect(sign.userData.sourceBuildingId).toBe(h.sourceBuildingId);
  }
  const side = full.getObjectByName("Potsdamer Platz south hall east fascia lettering") as Mesh;
  expect(side).toBeDefined();
  const dx = side.position.x - hall.centerWorldM[0], dz = side.position.z - hall.centerWorldM[1];
  expect(dx * Math.cos(hall.rotationY) - dz * Math.sin(hall.rotationY)).toBeCloseTo(hall.footprintSizeM[0] / 2 + .012, 7);
  expect(side.rotation.y).toBeCloseTo(hall.rotationY + Math.PI / 2, 8);
  const rear = full.getObjectByName("Potsdamer Platz south hall south fascia lettering") as Mesh;
  expect(rear).toBeDefined();
  const rx = rear.position.x - hall.centerWorldM[0], rz = rear.position.z - hall.centerWorldM[1];
  expect(rx * Math.sin(hall.rotationY) + rz * Math.cos(hall.rotationY)).toBeCloseTo(hall.footprintSizeM[1] / 2 + .012, 7);
  expect(rear.rotation.y).toBeCloseTo(hall.rotationY, 8);
  disposeStaticAudit(full); disposeStaticAudit(mobile);
});

test("the existing south steel bays are in front of painted glass in actual merged geometry", () => {
  const root = createPotsdamerSouthStationPhotoDrawn(prisms.buildings)!;
  root.updateMatrixWorld(true);
  const body = root.getObjectByName("Potsdamer Platz station entrance halls bodies") as Mesh;
  expect(body).toBeDefined();
  const [width, depth] = hall.footprintSizeM;
  const glazedHeight = hall.sourceRoofYM - hall.groundY - .82 - .34;
  const y = hall.groundY + glazedHeight / 2 + .17;
  const point = (x: number, z: number) => new Vector3(
    hall.centerWorldM[0] + x * Math.cos(hall.rotationY) + z * Math.sin(hall.rotationY),
    y, hall.centerWorldM[1] - x * Math.sin(hall.rotationY) + z * Math.cos(hall.rotationY));
  const firstColour = (origin: Vector3, toward: Vector3) => {
    const hits = new Raycaster(origin, toward.sub(origin).normalize(), 0, 3).intersectObject(body);
    expect(hits.length).toBeGreaterThan(0);
    const colors = body.geometry.getAttribute("color");
    return [colors.getX(hits[0].face!.a), colors.getY(hits[0].face!.a), colors.getZ(hits[0].face!.a)];
  };
  const paint = (hex: number) => new Color(hex).toArray().map(value => Math.round(value * 255) / 255);
  for (let bay = 1; bay < profile.roofBayCountAcross; bay++) {
    const x = -width / 2 + width * bay / profile.roofBayCountAcross;
    expect(firstColour(point(x, depth / 2 + 1), point(x, depth / 2 - 1)))
      .toEqual(paint(profile.ownerPhotoRecognition.steelTone));
  }
  for (let bay = 1; bay < profile.roofBayCountDepth; bay++) {
    const z = -depth / 2 + depth * bay / profile.roofBayCountDepth;
    expect(firstColour(point(width / 2 + 1, z), point(width / 2 - 1, z)))
      .toEqual(paint(profile.ownerPhotoRecognition.steelTone));
  }
  // A pane between the existing posts is still present at the same height.
  const paneX = -width / 2 + width * 2.5 / profile.roofBayCountAcross;
  expect(firstColour(point(paneX, depth / 2 + 1), point(paneX, depth / 2 - 1)))
    .toEqual(paint(0xa7d1d8));
  expect(staticGeometryAudit(root).budget.draws).toBe(6);
  disposeStaticAudit(root);
});

test("independent native pair retires exactly its 45 original columns and rejects changed evidence", () => {
  const transfer = preparePotsdamerSouthStationPhotoTransfer(prisms.buildings, payload);
  expect(transfer).not.toBeNull();
  for (const row of [...receipt.columns, ...strip.columns]) {
    expect(transfer!.replacesColumn(...row)).toBeTrue();
    expect(transfer!.replacesColumn(row[0], row[1], row[2], row[3] + 1, row[4])).toBeFalse();
    expect(transfer!.replacesColumn(row[0], row[1], row[2], row[3], row[4] + 1)).toBeFalse();
  }
  expect(transfer!.replacesColumn(68, 250, 54, 174, 4)).toBeFalse(); // north hall stays retained
  for (const z of [284, 285]) expect(transfer!.replacesColumn(77, z, 55, 175, 3)).toBeTrue();
  expect(preparePotsdamerSouthStationPhotoTransfer(undefined, payload)).toBeNull();
  const source = receipt.previousPrism;
  expect(preparePotsdamerSouthStationPhotoTransfer([{ ...source, h_dm: source.h_dm + 1 }], payload)).toBeNull();
  expect(preparePotsdamerSouthStationPhotoTransfer([source, source], payload)).toBeNull();
  expect(preparePotsdamerSouthStationPhotoTransfer([source], { ...payload, cell_m: 2 })).toBeNull();
  expect(preparePotsdamerSouthStationPhotoTransfer([source], { ...payload, building_rows: undefined, buildings: [] })).toBeNull();
  const first = receipt.columns[0];
  expect(preparePotsdamerSouthStationPhotoTransfer([source], { ...payload, building_rows: undefined,
    buildings: [...receipt.columns.map(r => [...r] as [number, number, number, number, number]),
      [first[0], first[1], first[2], first[3] + 1, first[4]]] })).toBeNull();
  const foreign = { ...source, id: "new-neighbour", ring: [[2890, 11250], [2910, 11250], [2910, 11270], [2890, 11270]] };
  expect(preparePotsdamerSouthStationPhotoTransfer([source, strip.previousPrism, foreign], payload)).toBeNull();
  disposeStaticAudit(transfer!.group);
});

test("canonical cell-centre ownership proves the 43 south cells independently of their edge neighbours", () => {
  const contains = (ring: number[][], x: number, z: number) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const owners = (x: number, z: number) => prisms.buildings.filter(p =>
    contains(p.ring, x, z) && !(p.holes ?? []).some(h => contains(h, x, z))).map(p => p.id);
  for (const [x, z, low, high, kind] of receipt.columns) {
    expect(owners((x + .5) * 40, (z + .5) * 40)).toEqual(["K0000BRX"]);
    expect((high - low) / 10).toBe(Math.ceil(hall.officialHeightM / payload.cell_m) * payload.cell_m);
    expect(kind).toBe(4);
  }
  for (const z of [284, 285]) expect(owners(3100, (z + .5) * 40)).toEqual(["64904393"]);
});

test("native model remains hollow with open stair approaches, orthogonal boxes and bounded allocation", () => {
  const rows = potsdamerSouthStationPhotoBlocks();
  expect(rows.filter(r => r.role === "corner-post")).toHaveLength(4);
  expect(rows.filter(r => r.role === "rear-mullion")).toHaveLength(9);
  expect(rows.filter(r => r.role === "side-mullion")).toHaveLength(10);
  expect(rows.filter(r => r.role === "stair-step")).toHaveLength(198);
  expect(rows.some(r => r.role === "fascia-lettering")).toBeTrue();
  for (const r of rows) {
    const dx = r.position[0] - hall.centerWorldM[0], dz = r.position[2] - hall.centerWorldM[1];
    const x = dx * Math.cos(hall.rotationY) - dz * Math.sin(hall.rotationY);
    const z = dx * Math.sin(hall.rotationY) + dz * Math.cos(hall.rotationY);
    expect(r.position[1] + r.size[1] / 2).toBeLessThanOrEqual(hall.sourceRoofYM + 1e-7);
    if (r.position[1] > hall.groundY + .4 && r.position[1] < hall.groundY + 2 && z * hall.frontSide > hall.footprintSizeM[1] / 2 - .8)
      expect(Math.abs(x)).toBeGreaterThan(11); // no added door/front rail/solid mass
  }
  const transfer = preparePotsdamerSouthStationPhotoTransfer(prisms.buildings, payload)!;
  const matrix = new Matrix4();
  transfer.group.traverse(o => {
    expect(o.matrixAutoUpdate).toBeFalse();
    if (!(o instanceof InstancedMesh)) return;
    expect(o.geometry.getAttribute("uv")).toBeUndefined();
    expect((o.material as any).map).toBeNull();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, matrix);
      for (const at of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[at]).toBe(0);
    }
  });
  const audit = staticGeometryAudit(transfer.group);
  expect(audit.budget.draws).toBe(2);
  expect(audit.budget.bytes).toBeLessThan(580_000);
  expect(audit.budget.instances).toBeLessThan(12_000);
  disposeStaticAudit(transfer.group);
});

test("exact south generic glass yields in both source render paths only with required replacement enabled", () => {
  const source = JSON.parse(JSON.stringify(receipt.previousPrism));
  const inputs = { ...prisms, buildings: [source, strip.previousPrism] } as unknown as PrismPayload;
  const before = createDistantBuildingShells(inputs, inputs.buildings);
  const after = createDistantBuildingShells(inputs, inputs.buildings, { potsdamerStationPhoto: true });
  expect(after.children).toHaveLength(0);
  expect(new Box3().setFromObject(before).max.y).toBeCloseTo(20.1, 4);
  const detailed = createIsometricCity(inputs, null, null, null,
    { includeContext: false, potsdamerStationPhoto: true });
  expect(detailed.getObjectByName("LoD2 glass prisms")).toBeUndefined();
  const changed = { ...source, h_dm: source.h_dm + 1 };
  const changedInputs = { ...inputs, buildings: [changed] };
  const retained = createDistantBuildingShells(changedInputs, changedInputs.buildings,
    { potsdamerStationPhoto: true });
  expect(retained.children.length).toBeGreaterThan(0);
  const complete = createPotsdamerSouthStationPhotoDrawn(inputs.buildings)!;
  expect(new Box3().setFromObject(complete).max.y).toBeCloseTo(hall.sourceRoofYM, 4);
  expect(complete.userData.keepInMinecraft).toBeFalse();
  expect(createPotsdamerSouthStationPhotoDrawn(undefined)).toBeNull();
  expect(createPotsdamerSouthStationPhotoDrawn([source, source])).toBeNull();
  expect(createPotsdamerSouthStationPhotoDrawn([changed])).toBeNull();
  for (const root of [before, after, detailed, retained, complete]) disposeStaticAudit(root);
});

test("walking roof uses the same exact south datum and retains unrelated and changed source behaviour", () => {
  const source = JSON.parse(JSON.stringify(receipt.previousPrism));
  const north = prisms.buildings.find(p => p.id === "K0002SCt")!;
  const rows = { buildings: [source, north] };
  const original = compilePedestrianObstacles(rows);
  const corrected = compilePedestrianObstacles(rows, () => "day", { potsdamerStationPhoto: true });
  const unique = (index: typeof corrected) => [...new Set([...index.cells.values()].flat())];
  expect(unique(corrected).filter(o => o.sourceId === north.id))
    .toEqual(unique(original).filter(o => o.sourceId === north.id));
  const exact = unique(corrected).filter(o => o.sourceId === source.id);
  expect(exact).toHaveLength(1);
  expect(exact[0].kind).toBe("polygon");
  if (exact[0].kind === "polygon") expect(exact[0].topAt!(hall.centerWorldM[0], hall.centerWorldM[1])).toBeCloseTo(14.178, 7);
  const environment: PedestrianEnvironment = {
    bounds: { minX: 250, maxX: 350, minZ: 990, maxZ: 1190 },
    groundAt: () => hall.groundY, obstacles: corrected, water: [],
  };
  const state = createPedestrianState(environment, { x: hall.centerWorldM[0], z: hall.centerWorldM[1], groundYHint: 20.1 });
  expect(state.groundY).toBeCloseTo(hall.sourceRoofYM, 7);
  const changed = { ...source, h_dm: source.h_dm + 1 };
  const untouched = compilePedestrianObstacles({ buildings: [changed] }, () => "day", { potsdamerStationPhoto: true });
  expect(unique(untouched)[0].maxY).toBeCloseTo(20.2, 7);
  let nativeAdmitted = false;
  const modeAware = compilePedestrianObstacles({ buildings: [source] }, () => "minecraft",
    { potsdamerStationPhoto: () => nativeAdmitted });
  const obstacle = unique(modeAware)[0];
  expect(obstacle.kind).toBe("polygon");
  if (obstacle.kind === "polygon") {
    expect(obstacle.topAt!(hall.centerWorldM[0], hall.centerWorldM[1])).toBeCloseTo(20.1, 7);
    nativeAdmitted = true;
    expect(obstacle.topAt!(hall.centerWorldM[0], hall.centerWorldM[1])).toBeCloseTo(14.178, 7);
    nativeAdmitted = false;
    expect(obstacle.topAt!(hall.centerWorldM[0], hall.centerWorldM[1])).toBeCloseTo(20.1, 7);
  }
});


test("the separate strip retains every original corner/edge and adds only bounded native frame courses", () => {
  const members = potsdamerStationStripPhotoMembers();
  expect(members).toHaveLength(14);
  for (let i = 0; i < 4; i++) {
    const a = strip.fullSourceRingWorldM[i], b = strip.fullSourceRingWorldM[(i + 1) % 4];
    const post = members.find(m => m.corner === i)!;
    expect([post.a[0], post.a[2]]).toEqual([...a]);
    expect([post.b[0], post.b[2]]).toEqual([...a]);
    for (const role of ["east-strip-upper-edge", "east-strip-lower-edge"])
      expect(members.some(m => m.role === role && m.a[0] === a[0] && m.a[2] === a[1] && m.b[0] === b[0] && m.b[2] === b[1])).toBeTrue();
  }
  const blocks = potsdamerStationStripPhotoNativeBlocks();
  expect(blocks).toHaveLength(178);
  const all = potsdamerSouthStationPhotoBlocks();
  expect(all.slice(7418)).toEqual(blocks);
  expect(createHash("sha256").update(JSON.stringify(all.slice(0, 7418))).digest("hex"))
    .toBe("66df6aa335546724ebfa7912679cb8385ddf7b70634b917e4a1880854b45ffd8");
  for (const a of strip.fullSourceRingWorldM) {
    const stack = blocks.filter(r => r.role === "east-strip-corner-post" && r.position[0] === a[0] && r.position[2] === a[1]);
    expect(stack).toHaveLength(9);
    expect(Math.min(...stack.map(r => r.position[1] - r.size[1] / 2))).toBeCloseTo(strip.groundYM, 7);
    expect(Math.max(...stack.map(r => r.position[1] + r.size[1] / 2))).toBeCloseTo(strip.alignedRoofYM - .06, 7);
  }
  const drawn = createPotsdamerSouthStationPhotoDrawn(prisms.buildings)!;
  const roof = drawn.getObjectByName("Complete OSM 464904393 roof-edge thin glass") as Mesh;
  expect(roof).toBeDefined();
  const points = roof.geometry.getAttribute("position");
  for (const [x, z] of strip.fullSourceRingWorldM)
    expect(Array.from({ length: points.count }, (_, i) => [points.getX(i), points.getY(i), points.getZ(i)])
      .some(p => Math.abs(p[0] - x) < .0001 && Math.abs(p[2] - z) < .0001 && Math.abs(p[1] - strip.alignedRoofYM) < .0001)).toBeTrue();
  expect((roof.material as any).transparent).toBeTrue();
  disposeStaticAudit(drawn);
});

test("missing, changed, duplicate strip or unexpected native owners fail the complete paired transaction", () => {
  const source = receipt.previousPrism, sourceStrip = strip.previousPrism;
  const pairs: readonly unknown[][] = [[source], [source, { ...sourceStrip, h_dm: 91 }], [source, sourceStrip, sourceStrip]];
  for (const rows of pairs) {
    expect(canReplacePotsdamerSouthStationPhoto(rows)).toBeFalse();
    expect(createPotsdamerSouthStationPhotoDrawn(rows)).toBeNull();
    expect(preparePotsdamerSouthStationPhotoTransfer(rows, payload)).toBeNull();
  }
  const all = [...receipt.columns, ...strip.columns].map(r => [...r] as [number, number, number, number, number]);
  const flat = { ...payload, building_rows: undefined, buildings: all };
  const valid = preparePotsdamerSouthStationPhotoTransfer([source, sourceStrip], flat)!;
  expect(valid).not.toBeNull();
  expect(valid.group.userData.transferredColumns).toBe(45);
  disposeStaticAudit(valid.group);
  expect(preparePotsdamerSouthStationPhotoTransfer([source, sourceStrip], { ...flat, buildings: all.slice(0, -1) })).toBeNull();
  expect(preparePotsdamerSouthStationPhotoTransfer([source, sourceStrip], { ...flat, buildings: [...all, [77, 284, 55, 176, 3]] })).toBeNull();
  const foreign = { ...sourceStrip, id: "unexpected-strip-owner" };
  expect(preparePotsdamerSouthStationPhotoTransfer([source, sourceStrip, foreign], flat)).toBeNull();
});

test("strip navigation switches from fallback mass to only the actually visible family steel", () => {
  let admitted = false, mode: "day" | "minecraft" = "day";
  const index = compilePedestrianObstacles({ buildings: [JSON.parse(JSON.stringify(strip.previousPrism))] },
    () => mode, { potsdamerStationPhoto: () => admitted });
  const ring = strip.fullSourceRingWorldM;
  const x = (ring[0][0] + ring[1][0]) * .375 + (ring[2][0] + ring[3][0]) * .125;
  const z = (ring[0][1] + ring[1][1]) * .375 + (ring[2][1] + ring[3][1]) * .125;
  expect(pedestrianPointIsBlocked(x, z, 7, index)).toBeTrue();
  admitted = true;
  for (const family of ["day", "minecraft"] as const) {
    mode = family;
    expect(pedestrianPointIsBlocked(x, z, 7, index)).toBeFalse();
    expect(pedestrianPointIsBlocked(ring[0][0], ring[0][1], 7, index)).toBeTrue();
  }
  const unique = [...new Set([...index.cells.values()].flat())].filter(o => o.sourceId === strip.previousPrism.id);
  const sheet = unique.find(o => o.minY === strip.alignedRoofYM - .04 && o.maxY === strip.alignedRoofYM)!;
  expect(sheet.kind).toBe("polygon");
  if (sheet.kind === "polygon") {
    expect(sheet.topAt!(x, z)).toBe(Number.NEGATIVE_INFINITY);
    mode = "day";
    expect(sheet.topAt!(x, z)).toBeCloseTo(strip.alignedRoofYM, 7);
    admitted = false;
    expect(sheet.topAt!(x, z)).toBe(Number.NEGATIVE_INFINITY);
  }
});
