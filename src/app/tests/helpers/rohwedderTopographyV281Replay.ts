import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, type Object3D, Vector3 } from "three";
import { planRohwedderHaus } from "../../src/RohwedderHausArchitecture";
import { ROHWEDDER_HAUS_SOURCE } from "../../src/rohwedderHausProfile";
import { planTopographyTerror } from "../../src/TopographyTerrorArchitecture";
import { TOPOGRAPHY_EXHIBITION_ROLE_V281 } from "../../src/TopographyExhibitionV281";
import { TOPOGRAPHY_TERROR_SOURCE, topographySourceGroundAt } from "../../src/topographyTerrorProfile";
import coreAudit from "../fixtures/core-material-native-v281-audit.json";
import { replaySourceV281 } from "./coreMaterialV281";
import { restoreLegacyInstances, type InstanceBufferDelta } from "./instanceBufferReplay";
import { staticGeometryAudit } from "./staticGeometryAudit";

type Row = { position: readonly number[]; size: readonly number[]; yaw: number; color: number; roll?: number; pitch?: number };
function record(row: Row, index: number) {
  const matrix = new Matrix4().makeRotationY(row.yaw);
  if (row.roll) matrix.multiply(new Matrix4().makeRotationZ(row.roll));
  if (row.pitch) matrix.multiply(new Matrix4().makeRotationX(row.pitch));
  matrix.scale(new Vector3().fromArray(row.size)).setPosition(row.position[0], row.position[1], row.position[2]);
  const bytes = new Float32Array(19);
  matrix.toArray(bytes); new Color(row.color).toArray(bytes, 16);
  return { index, data: Buffer.from(bytes.buffer).toString("base64") };
}

function assertSource(name: string) {
  const receipt = coreAudit.sourceReplay.find(r => r.path === `src/app/src/${name}.ts`)!;
  expect(receipt).toBeDefined();
  replaySourceV281(readFileSync(new URL(`../../src/${name}.ts`, import.meta.url), "utf8"), receipt);
}

/** Temporarily substitute only a test buffer reconstructed from actual retained
 * rows and individually checked additions. Every material, geometry attribute,
 * index, world transform and other object remains the live production value. */
function auditDelta(root: Object3D, mesh: InstancedMesh, delta: InstanceBufferDelta) {
  const current = staticGeometryAudit(root), prior = restoreLegacyInstances(mesh, delta);
  const count = mesh.count, matrices = mesh.instanceMatrix, colors = mesh.instanceColor;
  try {
    mesh.count = prior.count;
    mesh.instanceMatrix = new InstancedBufferAttribute(prior.instanceMatrix.array, 16);
    mesh.instanceColor = new InstancedBufferAttribute(prior.instanceColor!.array, 3);
    const historical = staticGeometryAudit(root), difference = delta.afterCount - delta.beforeCount;
    expect(current.budget.instances - historical.budget.instances).toBe(difference);
    expect(current.budget.bytes - historical.budget.bytes).toBe(difference * 76);
    expect(current.budget.draws).toBe(historical.budget.draws);
    expect(current.budget.vertices).toBe(historical.budget.vertices);
    return historical;
  } finally {
    mesh.count = count; mesh.instanceMatrix = matrices; mesh.instanceColor = colors;
  }
}

export function auditRohwedderBeforeV281(root: Object3D, profile: "full" | "mobile", minecraft: boolean) {
  assertSource("RohwedderHausArchitecture");
  const plan = planRohwedderHaus(undefined, { minecraft, mobileLike: profile === "mobile" });
  expect(root.children).toHaveLength(1);
  const mesh = root.children[0] as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh); expect(mesh.count).toBe(plan.length);
  const added = plan.flatMap((row, i) => row.sourceId === ROHWEDDER_HAUS_SOURCE.entranceFence.osm &&
    ["v281 screen metal edge", "v281 lower gate medallion"].includes(row.role) ? [record(row, i)] : []);
  expect(added).toHaveLength(minecraft ? 99 : 348);
  return auditDelta(root, mesh, { beforeCount: mesh.count - added.length, afterCount: mesh.count,
    retainedCount: mesh.count - added.length, removed: [], added });
}

/** The 24 old panels use the complete original recipe from the source replay.
 * Recompute their retained mapped anchors independently of the new panel module;
 * no new panel coordinates or rows can redefine the frozen old fingerprint. */
function previousTopographyPanels(): Row[] {
  const tr = TOPOGRAPHY_TERROR_SOURCE.trench.ring;
  const frame = (a: readonly number[], b: readonly number[]) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    return { a, length, dx, dz, nx: dz, nz: -dx };
  };
  const north = frame(tr[1], tr[2]), south = frame(tr[0], tr[3]), pitch = north.length / 72;
  const rows: Row[] = [];
  for (let i = 0; i < 72; i += 3) {
    const u = (i + .5) * pitch, x = north.a[0] + north.dx * u + north.nx * -3.45,
      z = north.a[1] + north.dz * u + north.nz * -3.45, ground = topographySourceGroundAt(x, z);
    rows.push({ position: [south.a[0] + south.dx * u + south.nx * -.35, ground + 1.31,
      south.a[1] + south.dz * u + south.nz * -.35], size: [pitch * .7, 1.3, .055],
      yaw: -Math.atan2(south.dz, south.dx), color: 0xd9ded5 });
  }
  return rows;
}

export function auditTopographyBeforeV281(root: Object3D, profile: "full" | "mobile", minecraft: boolean) {
  assertSource("TopographyTerrorArchitecture");
  const plan = planTopographyTerror({ minecraft, mobileLike: profile === "mobile" }).filter(row => !row.glass);
  const mesh = root.getObjectByName("Topography steel concrete masonry details") as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh);
  const panels = previousTopographyPanels(), added: InstanceBufferDelta["added"] = [], removed: InstanceBufferDelta["removed"] = [];
  for (let i = 0; i < plan.length; i++) {
    if (!plan[i].role.startsWith(TOPOGRAPHY_EXHIBITION_ROLE_V281)) continue;
    const oldIndex = i - added.length + removed.length;
    removed.push(record(panels[removed.length], oldIndex));
    for (let j = 0; j < 8; j++) {
      expect(plan[i + j].role.startsWith(TOPOGRAPHY_EXHIBITION_ROLE_V281)).toBe(true);
      added.push(record(plan[i + j], i + j));
    }
    i += 7;
  }
  expect(removed).toHaveLength(24); expect(added).toHaveLength(192);
  return auditDelta(root, mesh, { beforeCount: mesh.count - 168, afterCount: mesh.count,
    retainedCount: mesh.count - 192, removed, added });
}
