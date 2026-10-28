import { expect } from "bun:test";
import { Group, InstancedBufferAttribute, InstancedMesh } from "three";
import source from "../../src/data/altMitteTransportV206.json";
import additions from "../../src/data/mainStreetSignalsV254.json";
import { altMitteSignalPayloadV206, altMitteTransportGroundV206 } from "../../src/AltMitteTransportV206";
import { createTrafficSignals, type TrafficSignalPlacement } from "../../src/TrafficSignals";
import { disposeStaticAudit } from "./staticGeometryAudit";

/** Replay only v254's exact OSM keys. Retained signal rows and all geometry,
 * materials and transforms outside those keys continue to come from live data. */
export function restoreSignalsPreviousV254(root: Group): () => void {
  const groups = root.children.filter(node => node.name === "OSM traffic signals");
  expect(groups).toHaveLength(1);
  const site = groups[0], payload = altMitteSignalPayloadV206();
  const currentPlacements = payload.traffic_signal_placements!;
  const oldPlacements = source.signals.map(record => ({ ...record, refined_v206: true,
    native_ground_y_m: altMitteTransportGroundV206(record.position_dm[0] / 10, record.position_dm[1] / 10, true),
  })) as TrafficSignalPlacement[];
  expect(oldPlacements).toHaveLength(430);
  const changed = new Set(additions.signals.map(record => record.osm_key));
  const beforeKeys = new Set(oldPlacements.map(record => record.osm_key));
  expect(currentPlacements.filter(record => !beforeKeys.has(record.osm_key))).toHaveLength(28);
  const oldControl = createTrafficSignals({ ...payload, traffic_signal_placements: oldPlacements,
    traffic_signals_dm: oldPlacements.map(record => record.source_dm) }, null, { native: true })!;
  const currentControl = createTrafficSignals(payload, null, { native: true })!;
  const cleanups: (() => void)[] = [];
  try {
    expect(site.children.map(node => node.name)).toEqual(currentControl.children.map(node => node.name));
    expect(site.children.map(node => node.name)).toEqual(oldControl.children.map(node => node.name));
    for (const node of site.children) {
      expect(node).toBeInstanceOf(InstancedMesh);
      const mesh = node as InstancedMesh;
      const old = oldControl.getObjectByName(node.name) as InstancedMesh;
      const current = currentControl.getObjectByName(node.name) as InstancedMesh;
      const isIsland = node.name === "traffic signal verified island bases";
      const select = (placements: TrafficSignalPlacement[]) => isIsland
        ? placements.filter(record => record.placement === "verified_island") : placements;
      const oldRows = select(oldPlacements), currentRows = select(currentPlacements);
      const byKey = new Map(currentRows.map((record, index) => [record.osm_key, index]));
      const multiplicity = node.name === "traffic signal lamps" ? 3 : node.name === "traffic signal visor hoods v206" ? 5 : 1;
      expect(mesh.count).toBe(currentRows.length * multiplicity);
      expect(old.count).toBe(oldRows.length * multiplicity);
      const matrix = mesh.instanceMatrix, color = mesh.instanceColor, count = mesh.count;
      const project = (attribute: InstancedBufferAttribute, previous: InstancedBufferAttribute, expected: InstancedBufferAttribute) => {
        const result = new Float32Array(previous.array.length), stride = attribute.itemSize * multiplicity;
        expect(attribute.array.length).toBe(expected.array.length);
        currentRows.forEach((record, index) => {
          if (changed.has(record.osm_key)) expect(Array.from(attribute.array.slice(index * stride, (index + 1) * stride)))
            .toEqual(Array.from(expected.array.slice(index * stride, (index + 1) * stride)));
        });
        oldRows.forEach((record, index) => {
          const live = byKey.get(record.osm_key)!;
          expect(live).toBeDefined();
          const values = changed.has(record.osm_key) ? previous.array.slice(index * stride, (index + 1) * stride)
            : attribute.array.slice(live * stride, (live + 1) * stride);
          result.set(values, index * stride);
        });
        return new InstancedBufferAttribute(result, attribute.itemSize, attribute.normalized, attribute.meshPerAttribute).setUsage(attribute.usage);
      };
      mesh.instanceMatrix = project(matrix, old.instanceMatrix, current.instanceMatrix);
      if (color) mesh.instanceColor = project(color, old.instanceColor!, current.instanceColor!);
      mesh.count = old.count;
      cleanups.push(() => { mesh.instanceMatrix = matrix; mesh.instanceColor = color; mesh.count = count; });
    }
  } catch (error) { cleanups.reverse().forEach(restore => restore()); throw error; }
  finally { disposeStaticAudit(oldControl); disposeStaticAudit(currentControl); }
  return () => { cleanups.reverse().forEach(restore => restore()); };
}
