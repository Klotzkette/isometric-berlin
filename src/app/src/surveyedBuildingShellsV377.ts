import type {
  SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh,
} from "./SurroundingCityGeometry";
import { surroundingPacketFingerprint } from "./surroundingPacketFingerprint";

type Shell = { id: string; parentId: string; roofIndexStart: number; mesh: SurroundingPackedMesh };
type Cut = { mesh: number; fingerprint: number; triangles: number[] };
type Receipt = { origin: number[]; records: Cut[]; lineFingerprint: number | null; segments: number[]; owners: string[] };
export type ShellSourceV377 = { tiles: Record<string, Shell[]> };
export type ShellRetirementsV377 = { packets: Record<string, Receipt> };
export type ShellDataV377 = { shells: ShellSourceV377; retirements: ShellRetirementsV377 };

type Admission = {
  shells: Shell[]; receipt: Receipt; roofs: Map<string, number[][][]>;
  figures: { owner: string; firstIndex: number; count: number; roofIndexStart: number }[];
};

const encodedBytes = (text: string) => text.length / 4 * 3 - (text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0);

function validOffsets(indices: readonly number[], max: number): boolean {
  return indices.every((value, i) => Number.isInteger(value) && value >= 0 && value < max &&
    (i === 0 || value > indices[i - 1]));
}

/** A changed source, missing body or foreign ink receipt preserves the whole original tile. */
export function* admitSurveyedShellsV377(
  chunk: SurroundingCityChunk, tile: string, sources: ShellDataV377,
): Generator<void, Admission | undefined> {
  const shells = sources.shells.tiles[tile], receipt = sources.retirements.packets[tile];
  if (!shells?.length || !receipt?.records.length || receipt.origin.some((v, i) => v !== chunk.origin[i])) return;
  const keys = new Set(shells.map(s => s.id));
  if (keys.size !== receipt.owners.length || receipt.owners.some(id => !keys.has(id))) return;
  for (const shell of shells) {
    const mesh = shell.mesh, indices = encodedBytes(mesh.indices) / 4;
    if (mesh.kind !== "surveyed-building-shells-v377" || mesh.positionType !== "u16cm" || !indices ||
      !Number.isInteger(shell.roofIndexStart) || shell.roofIndexStart < 0 || shell.roofIndexStart % 3 !== 0 ||
      shell.roofIndexStart > indices || !chunk.nav.buildings.some(row => row.sourceId === shell.id)) return;
  }
  for (const record of receipt.records) {
    const part = chunk.meshes[record.mesh];
    if (!part || part.kind !== "city" || !record.triangles.length ||
        !validOffsets(record.triangles, encodedBytes(part.indices) / 12) ||
        (yield* surroundingPacketFingerprint(part)) !== record.fingerprint) return;
  }
  if (receipt.segments.length) {
    if (!chunk.lines || !validOffsets(receipt.segments, encodedBytes(chunk.lines.positions) / 12)) return;
    const ink = { positions: chunk.lines.positions, colors: chunk.lines.colors ?? "", indices: "" };
    if ((yield* surroundingPacketFingerprint(ink)) !== receipt.lineFingerprint) return;
  }
  return { shells, receipt, roofs: new Map(), figures: [] };
}

/** Retire only the named indices/old ink endpoints; all predecessor attributes
 * remain available to the independent older geometry receipts. Roof navigation
 * reuses the signed-off rendered triangles, including low wings and courtyards. */
export function* applySurveyedShellPartV377(
  state: Admission, chunk: SurroundingCityChunk, part: SurroundingPackedMesh, meshIndex: number,
  vertices: Uint16Array, indices: Uint16Array | Uint32Array, start: number, count: number,
): Generator<void> {
  for (const record of state.receipt.records) if (record.mesh === meshIndex) {
    for (const local of record.triangles) {
      const i = start + local * 3;
      indices[i + 1] = indices[i]; indices[i + 2] = indices[i];
    }
  }
  const shell = state.shells.find(candidate => candidate.mesh === part);
  if (!shell) return;
  state.figures.push({ owner: shell.id, firstIndex: start, count, roofIndexStart: shell.roofIndexStart });
  const roofs = state.roofs.get(shell.id) ?? [];
  state.roofs.set(shell.id, roofs);
  const corners = new Map<number, number[]>();
  for (let i = shell.roofIndexStart; i + 2 < count; i += 3) {
    const face = [];
    for (let j = 0; j < 3; j++) {
      const index = indices[start + i + j];
      let point = corners.get(index);
      if (!point) {
        const p = index * 6;
        point = [vertices[p] / 100, chunk.origin[1] + vertices[p + 1] / 100, vertices[p + 2] / 100];
        corners.set(index, point);
      }
      face.push(point);
    }
    roofs.push(face);
    if (roofs.length % 1024 === 0) yield;
  }
}

export function retireSurveyedShellInkV377(state: Admission, values: Uint16Array, stride: number): void {
  for (const segment of state.receipt.segments) {
    const a = segment * stride * 2;
    values[a + stride] = values[a];
    values[a + stride + 1] = values[a + 1];
    values[a + stride + 2] = values[a + 2];
  }
}

export function surveyedShellNavigationV377(nav: SurroundingNavigation, state: Admission): SurroundingNavigation {
  const heights = new Map<string, Map<number, { height: number; triangles: number[][][] }>>();
  return { ...nav, buildings: nav.buildings.map(building => {
    const roof = state.roofs.get(building.sourceId);
    if (!roof) return building;
    const ground = nav.groundY + (building.groundOffset ?? 0);
    const bases = heights.get(building.sourceId) ?? new Map();
    heights.set(building.sourceId, bases);
    let mapped = bases.get(ground);
    if (!mapped) {
      let height = building.minHeight;
      const corners = new Map<number[], number[]>();
      const triangles = roof.map(face => face.map(p => {
        let point = corners.get(p);
        if (!point) {
          point = [p[0], p[1] - ground, p[2]];
          height = Math.max(height, point[1]);
          corners.set(p, point);
        }
        return point;
      }));
      mapped = { height, triangles };
      bases.set(ground, mapped);
    }
    return { ...building, height: mapped.height, roofTriangles: mapped.triangles };
  }) };
}
