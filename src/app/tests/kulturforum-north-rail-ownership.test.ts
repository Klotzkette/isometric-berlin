import { expect, test } from 'bun:test';
import { Mesh, type Object3D } from 'three';
import { createIsometricCity, type PrismPayload } from '../src/IsometricCityWorld';
import { createConcertHalls } from '../src/ConcertHalls';
import { createKulturforumMuseums } from '../src/KulturforumMuseums';
import { createHbfNorthApproach } from '../src/HbfNorthApproach';
import type { VoxelPayload } from '../src/MinecraftVoxelWorld';

const prisms: PrismPayload = { schema_version: 1, classes: [], buildings: [] };
const ground: VoxelPayload = {
  schema_version: 1, cell_m: 4, classes: ['grass'],
  grid: { cols: 2, rows: 2, min_x_idx: 0, min_z_idx: 0 },
  ground_height: { cols: 2, rows: 2, stride_cells: 1, y_dm: [52, 52, 52, 52] },
  ground_rows: [[], []], water_top_y_m: -1.15,
};
const names = [
  'Philharmonie and Kammermusiksaal exact source surfaces',
  'Kulturforum museums source architecture',
  'Hauptbahnhof north rail portals and Döberitzer Grünzug',
];
function counts(root: Object3D): number[] {
  return names.map(name => {
    let count = 0;
    root.traverse(object => { if (object.name === name) count++; });
    return count;
  });
}
function dispose(root: Object3D): void {
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}

test('standalone and staged construction each retain exactly one complete new model', () => {
  const standalone = createIsometricCity(prisms, ground);
  expect(counts(standalone)).toEqual([1, 1, 1]);
  dispose(standalone);

  const staged = createIsometricCity(prisms, ground, null, null, { includeKulturforumAndNorthRail: false });
  expect(counts(staged)).toEqual([0, 0, 0]);
  staged.add(createConcertHalls(), createKulturforumMuseums(), createHbfNorthApproach(() => 5.2));
  expect(counts(staged)).toEqual([1, 1, 1]);
  dispose(staged);
}, 30_000);
