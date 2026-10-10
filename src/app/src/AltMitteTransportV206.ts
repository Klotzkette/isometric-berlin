import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
} from "three";
import source from "./data/altMitteTransportV206.json";
import ground from "./data/altMitteTransportGroundV206.json";
import type { StreetDetailsPayload, TrafficSignalPlacement } from "./TrafficSignals";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type PaintRow = readonly number[];
type Signal = TrafficSignalPlacement & {
  heading_rad: number;
  refined_v206: true;
  ground_y_m: number;
  native_ground_y_m: number;
};
const GRID = 0.25;

function insideRing(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function inCore(x: number, z: number): boolean {
  return insideRing(x, z, ground.core.ring) && !ground.core.holes.some(ring => insideRing(x, z, ring));
}

/** Same original core height cells / outer DGM field as the actual road owners. */
export function altMitteTransportGroundV206(x: number, z: number, native = false): number {
  if (!inCore(x, z)) return terrainGroundAt(x, z, ground.outerGroundY, native);
  const sx = (x - ground.origin[0]) / ground.step - (native ? 0 : 0.5);
  const sz = (z - ground.origin[1]) / ground.step - (native ? 0 : 0.5);
  const ix = Math.floor(sx), iz = Math.floor(sz);
  const sample = (cx: number, cz: number): number => ground.heightsDm[
    Math.max(0, Math.min(ground.rows - 1, cz)) * ground.cols + Math.max(0, Math.min(ground.cols - 1, cx))
  ] / 10;
  if (native) return sample(ix, iz);
  const a = sx - ix, b = sz - iz;
  return (sample(ix, iz) * (1 - a) + sample(ix + 1, iz) * a) * (1 - b) +
    (sample(ix, iz + 1) * (1 - a) + sample(ix + 1, iz + 1) * a) * b;
}

/** Above actual road skins (core .14/.18m, outer .09m), without a floating plate. */
export function altMittePaintHeightV206(x: number, z: number, native = false): number {
  const core = inCore(x, z);
  return altMitteTransportGroundV206(x, z, native) + (core ? (native ? 0.025 : 0.205) : 0.115);
}

function signals(): Signal[] {
  return source.signals.map(record => {
    const x = record.position_dm[0] / 10, z = record.position_dm[1] / 10;
    return {
      ...record,
      position_dm: [record.position_dm[0], record.position_dm[1]],
      source_dm: [record.source_dm[0], record.source_dm[1]],
      refined_v206: true,
      ground_y_m: altMitteTransportGroundV206(x, z) + (inCore(x, z) ? 0.18 : 0),
      native_ground_y_m: altMitteTransportGroundV206(x, z, true),
    } as Signal;
  });
}

/** Merge by stable OSM identity; preserve every unrelated entry and raw source. */
export function withAltMitteTrafficV206(street: StreetDetailsPayload): StreetDetailsPayload {
  if (!street.traffic_signal_placements) return street;
  const additions = signals();
  const byKey = new Map(additions.map(record => [record.osm_key, record]));
  const present = new Set(street.traffic_signal_placements.map(record => record.osm_key));
  const placements = street.traffic_signal_placements.map(record => byKey.get(record.osm_key) ?? record);
  for (const record of additions) if (!present.has(record.osm_key)) placements.push(record);
  return {
    ...street,
    traffic_signal_placements: placements,
    traffic_signals_dm: [...street.traffic_signals_dm, ...additions.filter(record => !present.has(record.osm_key)).map(record => record.source_dm)],
  };
}

/** The native outline family owns only this bounded set of physical signals. */
export function altMitteSignalPayloadV206(): StreetDetailsPayload {
  const placements = signals();
  return {
    schema_version: 7,
    source: source.source,
    traffic_signal_placements: placements,
    traffic_signals_dm: placements.map(record => record.source_dm),
  };
}

function nativeRows(runs: readonly PaintRow[], heightAt = altMittePaintHeightV206): number[][] {
  // Offline pixels were checked with their full square footprint against the
  // source road and district. Each lossless run stops at native terrain steps.
  return runs.map(([ix, iz, count, yellow]) => {
    const x = (ix + count / 2) * GRID, z = (iz + 0.5) * GRID;
    return [x, z, count * GRID, GRID, 0, yellow, heightAt(x, z, true)];
  });
}

/** Fixed, independently culled 512m paint batches; identical on touch/pointer. */
export function createAltMitteTransportV206(
  native = false,
  payload: Pick<typeof source, "source" | "cells"> & { counts: Record<string, unknown> } = source,
  heightAt = altMittePaintHeightV206,
): Group {
  const root = new Group();
  root.name = "Source-tagged Alt-Mitte crossings and street paint v206";
  root.userData.source = payload.source;
  root.userData.native = native;
  root.userData.sourceCounts = payload.counts;
  for (const cell of payload.cells) {
    const rows: readonly PaintRow[] = native ? nativeRows(cell.nativeRuns, heightAt) : cell.rows;
    const count = rows.length;
    const positions = new Float32Array(count * 12);
    const colors = new Uint8Array(count * 12);
    const indices = count * 4 >= 65535 ? new Uint32Array(count * 6) : new Uint16Array(count * 6);
    for (let i = 0; i < count; i++) {
      const row = rows[i], [x, z, length, width, yaw, yellow] = row;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      for (let j = 0; j < 4; j++) {
        const u = (j === 0 || j === 3 ? -1 : 1) * length / 2;
        const v = (j < 2 ? -1 : 1) * width / 2;
        const px = x + c * u - s * v, pz = z + s * u + c * v;
        const offset = i * 12 + j * 3;
        positions[offset] = px;
        positions[offset + 1] = native ? row[6] : heightAt(px, pz);
        positions[offset + 2] = pz;
        colors[offset] = 235; colors[offset + 1] = yellow ? 166 : 232; colors[offset + 2] = yellow ? 20 : 217;
      }
      indices.set([i*4, i*4+2, i*4+1, i*4, i*4+3, i*4+2], i*6);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const night = new MeshBasicMaterial({ color: 0x8e999d, vertexColors: true, side: DoubleSide });
    const mesh = new Mesh(geometry, day);
    mesh.name = `Alt-Mitte source paint ${cell.cell.join(":")}${native ? " native" : ""}`;
    mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
    mesh.userData.staticAntiFlicker = true;
    mesh.renderOrder = 3;
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
