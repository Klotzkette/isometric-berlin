/** Inventory each exact core owner above the v377 ranking floor in the existing drawn renderer. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { Group, InstancedMesh, LineSegments, Matrix4, Mesh, Vector3 } from "three";
import {
  createIsometricCityCore, PRISM_SUPPRESSED_IDS, isHauptbahnhofFootprintSuppressed, isFriedrichstrasseStationFootprintSuppressed, isInterimOfficeFootprintSuppressed, type IsometricCityBuildOptions, type PrismBuilding, type PrismPayload,
} from "../src/IsometricCityWorld";
import { correctGardenPrismsV358 } from "../src/LehrterGardenPayloadV358";
import { prepareRequiredFidelityV288 } from "../src/RequiredFidelityV288";
import { canReplacePotsdamerSouthStationPhoto } from "../src/potsdamerStationPhotoOwnership";
import { canReplacePotsdamerNorthPavilion } from "../src/PotsdamerPavilionOwnership";
import { potsdamerPavilionTerrainAdmitted } from "../src/PotsdamerPavilionRoutes";
import { prepareNordbahnhofDrawn } from "../src/NordbahnhofPublicAccess";
import type { VoxelPayload } from "../src/terrainPayload";

import { isBayerCampusSourceV277 } from "../src/bayerCampusV277Ownership";
import { isRkiMoabitSourceV277 } from "../src/rkiMoabitV277Ownership";
import { isAEGCampusCorePrismV241 } from "../src/aegCampusV241CorePrevious";
import { createArchitecturalSignature, type ArchitecturalSignature } from "../src/ArchitecturalLandmarks";
import { createParliamentArchitecture } from "../src/ParliamentArchitecture";
import { createBundesratArchitecture } from "../src/BundesratArchitecture";
import { createRohwedderHausArchitecture } from "../src/RohwedderHausArchitecture";
import { createEuropacityArchitecture } from "../src/EuropacityArchitecture";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const source = read("../public/mesh/regierungsviertel/lod2-prisms.json");
const prisms = correctGardenPrismsV358(JSON.parse(source.toString()) as PrismPayload);
const ground = JSON.parse(read("../public/mesh/regierungsviertel/ground-context.json").toString()) as VoxelPayload;
const minimumVolumeM3 = 80_000;

function ringAreaM2(ring: number[][]): number {
  let twiceAreaDm2 = 0;
  for (const [index, [x, z]] of ring.entries()) {
    const [nextX, nextZ] = ring[(index + 1) % ring.length];
    twiceAreaDm2 += x * nextZ - z * nextX;
  }
  return Math.abs(twiceAreaDm2) / 200;
}

const owners = new Map<string, { volume: number; parts: PrismBuilding[] }>();
for (const part of prisms.buildings) {
  const area = ringAreaM2(part.ring) - (part.holes ?? []).reduce((sum, hole) => sum + ringAreaM2(hole), 0);
  const owner = owners.get(part.id) ?? { volume: 0, parts: [] };
  owner.volume += Math.max(0, area) * Math.max(0, part.h_dm) / 10;
  owner.parts.push(part);
  owners.set(part.id, owner);
}

// Compile the worker's actual local constructor argument as in northRuntimeActualV310.
// This keeps every predecessor exclusion and each detail flag coupled to the shipped call.
const workerBytes = read("../src/progressiveWorld.worker.ts");
const worker = ts.createSourceFile("progressiveWorld.worker.ts", workerBytes.toString(), ts.ScriptTarget.Latest, true);
const factoryOptions: ts.ObjectLiteralExpression[] = [];
function visit(node: ts.Node): void {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "createIsometricCityCore") {
    const options = node.arguments[4];
    if (!options || !ts.isObjectLiteralExpression(options)) throw Error("Unrecognized worker constructor options");
    factoryOptions.push(options);
  }
  ts.forEachChild(node, visit);
}
visit(worker);
if (factoryOptions.length !== 1) throw Error("Expected the single authoritative worker constructor");
const fidelity = prepareRequiredFidelityV288(prisms, ground, false, true, false, true, true);
const stationPhotoAdmitted = canReplacePotsdamerSouthStationPhoto(prisms.buildings);
const input = {
  hbfCirculationV291: true, parliamentInteriorsV295: true,
  parliamentaryDiningV296: fidelity.parliamentaryDining, waterfrontV296: fidelity.waterfront,
  nordbahnhofCuts: prepareNordbahnhofDrawn(prisms.buildings, ground)?.cuts,
};
const bindings = {
  input, stationPhotoAdmitted,
  northPavilionAdmitted: stationPhotoAdmitted && canReplacePotsdamerNorthPavilion(prisms.buildings) && potsdamerPavilionTerrainAdmitted(ground),
  moabitMitteV300: fidelity.moabitMitte, westKiezV302: fidelity.westKiez, historicDomV288: fidelity.historicDom,
  potsdamerCorridorV288: fidelity.potsdamerCorridor, chancelleryCanopySourceV289: fidelity.chancelleryCanopy,
};
const optionsScript = ts.transpileModule(`const options = ${factoryOptions[0].getText(worker)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const makeOptions = new Function(...Object.keys(bindings), "buildings", optionsScript + "return options;");
const workerPrisms = { ...prisms, buildings: [] }; // build() releases this array after district partitioning.

function measure(root: Group) {
  let axes = 0, verticalAxes = 0, mullions = 0, panes = 0, bodyTriangles = 0;
  const partNames: string[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    const geometry = object.geometry;
    const positions = geometry.getAttribute("position");
    if (!positions) return;
    const count = geometry.index?.count ?? positions.count;
    partNames.push(object.name);
    if (object.name === "LoD2 prism buildings" || object.name === "LoD2 glass prisms") bodyTriangles += count / 3;
    if (object instanceof LineSegments && ["LoD2 facade axes", "LoD2 glass mullions"].includes(object.name)) {
      for (let at = 0; at + 1 < count; at += 2) {
        const first = geometry.index?.getX(at) ?? at, last = geometry.index?.getX(at + 1) ?? at + 1;
        const dy = Math.abs(positions.getY(first) - positions.getY(last));
        const dxz = Math.hypot(positions.getX(first) - positions.getX(last), positions.getZ(first) - positions.getZ(last));
        if (dy + dxz <= .001) continue;
        if (object.name === "LoD2 glass mullions") mullions++;
        else {
          axes++;
          if (dxz <= .001 && dy > .1) verticalAxes++;
        }
      }
    }
    if (object instanceof InstancedMesh && /(?:ordinary windows|window panes)/i.test(object.name) && !/lit window|lit facade/i.test(object.name)) {
      for (let i = 0; i < object.count; i++) {
        const m = object.instanceMatrix.array, offset = i * 16;
        if (Math.hypot(m[offset], m[offset + 1], m[offset + 2]) > .001 && Math.hypot(m[offset + 4], m[offset + 5], m[offset + 6]) > .001) panes++;
      }
    }
  });
  return { axes, verticalAxes, mullions, panes, bodyTriangles, partNames };
}

// Resolve source-bound ownership tables contributing to the exact suppression set, so a
// retired generic core is identified by its named successor family wherever it is declared.
const core = ts.createSourceFile("IsometricCityWorld.ts", read("../src/IsometricCityWorld.ts").toString(), ts.ScriptTarget.Latest, true);
const imported = new Map<string, { path: string; name: string }>();
let suppressionItems: ts.NodeArray<ts.Expression> | undefined;
for (const statement of core.statements) {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const entry of named.elements) imported.set(entry.name.text, {
        name: entry.propertyName?.text ?? entry.name.text, path: statement.moduleSpecifier.text,
      });
    }
  }
  if (ts.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations.find((d) => d.name.getText(core) === "PRISM_SUPPRESSED_IDS");
    const constructor = declaration?.initializer;
    if (constructor && ts.isNewExpression(constructor) && constructor.arguments?.length === 1 && ts.isArrayLiteralExpression(constructor.arguments[0])) {
      suppressionItems = constructor.arguments[0].elements;
    }
  }
}
if (!suppressionItems) throw Error("Missing complete legacy suppression table");
const suppressionTables = new Map<string, string>();
for (const item of suppressionItems) {
  if (ts.isStringLiteral(item)) {
    suppressionTables.set(item.text, "IsometricCityWorld.ts: " + item.text);
    continue;
  }
  const expr = ts.isSpreadElement(item) ? item.expression : item;
  if (!ts.isIdentifier(expr)) continue;
  const symbol = imported.get(expr.text);
  if (!symbol) continue;
  const table = (await import(new URL("../src/" + symbol.path + ".ts", import.meta.url).href))[symbol.name];
  for (const member of typeof table === "string" ? [table] : table) suppressionTables.set(member, expr.text);
}

function suppressedReason(part: PrismBuilding): string | undefined {
  if (isBayerCampusSourceV277(part)) return "BayerCampusV277";
  if (isRkiMoabitSourceV277(part)) return "RkiMoabitV277";
  if (isAEGCampusCorePrismV241(part)) return "AEGCampusV241";
  if (PRISM_SUPPRESSED_IDS.has(part.id)) return suppressionTables.get(part.id);
  if (isInterimOfficeFootprintSuppressed(part)) return "Interim office footprint";
  if (isFriedrichstrasseStationFootprintSuppressed(part)) return "Friedrichstraße station";
  if (isHauptbahnhofFootprintSuppressed(part)) return "Hauptbahnhof";
}
const manifest = JSON.parse(read("../public/mesh/regierungsviertel/scene.json").toString());
const signature = (manifest.architectural_signatures as ArchitecturalSignature[]).find((s) => s.id === "reichstag-model");
if (!signature) throw Error("Missing Reichstag signature");

// These eleven source prisms deliberately retain opaque massing. Check the separate real
// context renderer at their original exterior or courtyard walls, within the source elevation.
const recognition = [
  { ids: ["K0002MCN"], name: "Reichstag", root: createArchitecturalSignature(signature, { parliamentInteriorsV295: true })!, batch: /window|glazing/i },
  { ids: ["m9aqs23l", "FAoRPGwK"], name: "ParliamentArchitecture", root: createParliamentArchitecture(prisms), batch: /facade and roof details/ },
  { ids: ["lZJjdWRB"], name: "BundesratArchitecture", root: createBundesratArchitecture(prisms), batch: /glazing/ },
  { ids: ["H1fcpzly", "BpVfJNGl"], name: "RohwedderHausArchitecture", root: createRohwedderHausArchitecture(prisms, { diagnostics: true }), batch: /facade blocks/ },
  { ids: ["42141455", "37662427", "37662426", "3sq00006"], name: "EuropacityArchitecture",
    root: createEuropacityArchitecture({ sourcePrisms: prisms.buildings, fineReliefV341: true }), batch: /framed glazing/ },
  { ids: ["JUgwVTiy"], name: "EINZ", root: createExpandedCityDetails(
      manifest.landmarks.filter((p: { name: string }) => p.name === "KPMG Europacity"),
      { detailProfile: "full", includeLegacyAnhalter: false, includePotsdamerSouthHall: false },
    ), batch: /^Expanded architecture and public-realm details bodies$/ },
];

function wallProof(part: PrismBuilding) {
  const owner = recognition.find((site) => site.ids.includes(part.id));
  if (!owner) return;
  const { root, batch, name } = owner;
  root.updateMatrixWorld(true);
  const low = part.y0_dm / 10 + 1, high = (part.y0_dm + part.h_dm) / 10 - 1;
  const segments = [part.ring, ...(part.holes ?? [])].flatMap((ring) => ring.map(([xDm, zDm], index) => {
    const x = xDm / 10, z = zDm / 10, next = ring[(index + 1) % ring.length];
    const dx = next[0] / 10 - x, dz = next[1] / 10 - z;
    return { x, z, dx, dz, length2: dx * dx + dz * dz };
  }));
  const points = new Set<string>(), heights = new Set<number>(), members = new Map<string, number>();
  const point = new Vector3(), matrix = new Matrix4();
  function hit(member: string): void {
    if (point.y < low || point.y > high) return;
    for (const wall of segments) {
      if (!wall.length2) continue;
      const x = point.x - wall.x, z = point.z - wall.z;
      const t = Math.max(0, Math.min(1, (x * wall.dx + z * wall.dz) / wall.length2));
      if (Math.hypot(x - t * wall.dx, z - t * wall.dz) > 1.5) continue;
      const key = [point.x, point.y, point.z].map((n) => Math.round(n * 100)).join(",");
      if (!points.has(key)) {
        points.add(key);
        heights.add(Math.round(point.y));
        members.set(member, (members.get(member) ?? 0) + 1);
      }
      return;
    }
  }
  root.traverse((mesh) => {
    if (!(mesh instanceof Mesh) || !batch.test(mesh.name)) return;
    if (mesh instanceof InstancedMesh) {
      for (let i = 0; i < mesh.count; i++) {
        const plannedRole = root.userData.blocks?.[i]?.role;
        if (plannedRole && !/window|glaz|mullion/i.test(plannedRole)) continue;
        mesh.getMatrixAt(i, matrix);
        point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
        hit(mesh.name);
      }
    } else {
      const position = mesh.geometry.getAttribute("position");
      if (!position) return;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        hit(mesh.name || mesh.parent?.name || name);
      }
    }
  });
  return { renderer: name, wallPoints: points.size, heightMetreBins: heights.size, batches: Object.fromEntries(members) };
}

const rows = [];
for (const [id, owner] of [...owners].sort((a, b) => b[1].volume - a[1].volume)) {
  if (owner.volume < minimumVolumeM3) break;
  const options = makeOptions(...Object.values(bindings), owner.parts) as IsometricCityBuildOptions;
  const root = createIsometricCityCore(workerPrisms, null, null, null, options);
  const detail = measure(root);
  const recognition = wallProof(owner.parts[0]);
  const suppression = detail.partNames.length ? undefined : suppressedReason(owner.parts[0]);
  if (recognition && (recognition.wallPoints < 10 || recognition.heightMetreBins < 2)) throw Error(`Insufficient separate facade geometry for ${id}`);
  if (!detail.verticalAxes && !detail.panes && !detail.mullions && !recognition && !suppression) throw Error(`Unclassified core facade ${id}`);
  const status = suppression ? "retired-prism" : recognition ? "recognition-facade"
    : detail.panes ? "window-panes" : detail.mullions ? "glass-mullions" : "facade-axes";
  rows.push({ id: "CORE-" + id, status, volumeM3: Math.round(owner.volume * 100) / 100, ...detail, recognition, suppression });
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      object.geometry.dispose();
      for (const material of new Set([object.material, object.userData.dayMaterial, object.userData.nightMaterial].flat())) material?.dispose();
      if (object instanceof InstancedMesh) object.dispose();
    }
  });
  root.clear();
}
const result = {
  schemaVersion: 1, sourceSha256: sha(source), workerSha256: sha(workerBytes),
  minimumVolumeM3, evaluatedPrismParts: prisms.buildings.length, evaluatedOwners: owners.size,
  metric: "Sum of (outer ring area minus courts) times retained prism height by case-sensitive owner ID.",
  measured: "Completed drawn source-owner factory; nondegenerate vertical facade-axis segments, visible pane instances and glass mullion segments. Context evidence counts unique vertices or instance centres within 1.5 m of source walls between 1 m above the base and 1 m below the top.",
  scope: "A retired-prism row identifies a removed generic input and its owning source family. A separately rendered current owner has its own identity. Facade axes and estimated panes describe existing display geometry.",
  counts: Object.fromEntries([...new Set(rows.map((r) => r.status))].sort().map((k) => [k, rows.filter((r) => r.status === k).length])),
  rows,
};
const output = process.argv[2];
if (!output) throw Error("Pass an output filename");
writeFileSync(output, JSON.stringify(result) + "\n");
