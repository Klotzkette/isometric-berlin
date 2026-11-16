import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { HBF_SOUTH_TOWER_V354, hbfSouthTowerBadgeFacesV354, hbfSouthTowerNativeBadgesV354 } from '../src/HbfSouthTowerV354';
import prisms from '../public/mesh/regierungsviertel/lod2-prisms.json';
import voxels from '../public/mesh/regierungsviertel/minecraft-voxels.json';
import scene from '../public/mesh/regierungsviertel/scene.json';
import { createArchitecturalSignature, type HauptbahnhofModelSignature } from '../src/ArchitecturalLandmarks';
import { createDistantBuildingShells, isHauptbahnhofFootprintSuppressed, PRISM_SUPPRESSED_IDS } from '../src/IsometricCityWorld';
import { createMinecraftArchitecturalLandmarks, minecraftArchitecturalReplacementAt } from '../src/MinecraftArchitecturalLandmarks';
const south = prisms.buildings.find(b => b.id === 'dKfobOID')!;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const signature = scene.architectural_signatures.find(s => s.id === 'hauptbahnhof-model') as HauptbahnhofModelSignature;

test('authored north-side pylon and all its fittings are absent; entrances remain', () => {
  const station = createArchitecturalSignature(signature) as Group;
  const names: string[] = []; station.traverse(o => names.push(o.name));
  expect(names.filter(name => /DB pylon|pylon DB badge/.test(name))).toEqual([]);
  expect(station.userData.dbPylon).toBeUndefined();
  expect(station.getObjectByName('Hauptbahnhof Europaplatz entrance facade')).toBeDefined();
  expect(station.getObjectByName('Hauptbahnhof Washingtonplatz entrance facade')).toBeDefined();
  expect(new Box3().setFromObject(station).max.y).toBeLessThan(signature.anchor_world[1] + 60);
});
test('complete real south source record is unchanged and Drawn still builds it', () => {
  expect(hash(JSON.stringify(south))).toBe('9d1d6991cdba04cbd1342d9d410cbb51533db569e1a1b161030d0501d407c4c1');
  expect(PRISM_SUPPRESSED_IDS.has(south.id)).toBe(false);
  expect(isHauptbahnhofFootprintSuppressed(south)).toBe(false);
  const world = createDistantBuildingShells(prisms, [south]);
  expect(world.userData.visibleBuildingCount).toBe(1);
  const bounds = new Box3().setFromObject(world);
  expect(bounds.min.x).toBeCloseTo(-174.5, 3); expect(bounds.max.x).toBeCloseTo(-161.9, 3);
  expect(bounds.min.z).toBeCloseTo(-632, 3); expect(bounds.max.z).toBeCloseTo(-620.1, 3);
  expect(bounds.max.y).toBeCloseTo(67.2, 3);
  expect(bounds.min.z).toBeGreaterThan(signature.anchor_world[2]);
});
test('Native retains the five high southern source columns and creates no north tower', () => {
  const columns: number[][] = [];
  for (let zi = -158; zi <= -155; zi++) {
    for (const [offset, count, base, top, material] of voxels.building_rows[zi - voxels.grid.min_z_idx]) {
      for (let j = 0; j < count; j++) {
        const xi = voxels.grid.min_x_idx + offset + j, x = xi * 4 + 2, z = zi * 4 + 2;
        if (x >= -176 && x <= -160 && top > 600) columns.push([x, z, base, top, material]);
      }
    }
  }
  expect(columns).toEqual([[-170,-626,50,690,4],[-166,-626,50,690,4],[-174,-622,50,690,4],[-170,-622,50,690,4],[-166,-622,50,690,4]]);
  for (const [x,z] of columns) expect(minecraftArchitecturalReplacementAt(x,z)).not.toBe('berlin-hauptbahnhof');
  const station = createMinecraftArchitecturalLandmarks().getObjectByName('Minecraft Berlin Hauptbahnhof block signature')!;
  expect(new Box3().setFromObject(station).max.y).toBeLessThan(signature.anchor_world[1] + 60);
});

test('three DB badges follow the real source walls in world coordinates with no new body', () => {
  const station = createArchitecturalSignature(signature) as Group;
  const badges = station.getObjectByName('Washingtonplatz retained south tower DB badges v354') as Group;
  expect(badges.children).toHaveLength(3);
  expect(badges.userData.sourceId).toBe(south.id);
  for (const [i, face] of hbfSouthTowerBadgeFacesV354().entries()) {
    const mesh = badges.children[i] as Mesh, position = mesh.getWorldPosition(new Vector3());
    expect(mesh.geometry.type).toBe('PlaneGeometry');
    expect(mesh.userData.lettering).toBe('DB');
    expect(mesh.userData.preserveInkAtNight).toBe(true);
    expect(position.x).toBeCloseTo(face.x,5);expect(position.z).toBeCloseTo(face.z,5);
    expect(position.y).toBeCloseTo(HBF_SOUTH_TOWER_V354.badgeCentreY,5);
    const [a,b] = HBF_SOUTH_TOWER_V354.edges[i];
    expect(south.ring).toContainEqual(a.map(v=>Math.round(v*10)));
    expect(south.ring).toContainEqual(b.map(v=>Math.round(v*10)));
    expect(face.z).toBeGreaterThan(signature.anchor_world[2]);
  }
  const native=hbfSouthTowerNativeBadgesV354();expect(native).toHaveLength(84);
  for(const block of native){
    expect(block.position[2]).toBeGreaterThan(signature.anchor_world[2]);
    expect(block.position[1]).toBeGreaterThan(55);expect(block.position[1]).toBeLessThan(60);
    expect(Math.min(block.size[0],block.size[2])).toBe(.12);
    expect(block.position.every(Number.isFinite)).toBe(true);
  }
});
