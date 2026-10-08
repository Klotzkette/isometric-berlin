import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { FrontSide, InstancedMesh, Mesh, Object3D } from 'three';
import { createWestSquaresV163, createMinecraftWestSquaresV163, WEST_SQUARES_V188_PROFILE } from '../src/WestSquaresV163';
import refinement from '../src/data/westSquaresV188Detail.json';

function signature(root: Object3D): string {
  const hash = createHash('sha256');
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    for (const key of Object.keys(o.geometry.attributes).sort()) hash.update(Buffer.from(o.geometry.attributes[key].array.buffer));
    if (o.geometry.index) hash.update(Buffer.from(o.geometry.index.array.buffer));
    if (o instanceof InstancedMesh) {
      hash.update(Buffer.from(o.instanceMatrix.array.buffer));
      if (o.instanceColor) hash.update(Buffer.from(o.instanceColor.array.buffer));
    }
  });
  return hash.digest('hex');
}

function stats(root: Object3D) {
  let bytes = 0, calls = 0, triangles = 0;
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    calls++;
    for (const attr of Object.values(o.geometry.attributes)) bytes += attr.array.byteLength;
    if (o.geometry.index) bytes += o.geometry.index.array.byteLength;
    if (o instanceof InstancedMesh) bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o instanceof InstancedMesh ? o.count : 1);
  });
  return { bytes, calls, triangles };
}

describe('bounded KaDeWe Tauentzien and Wittenbergplatz v188', () => {
  it('keeps the unrelated Ernst-Reuter drawn and native geometry byte identical to v187', () => {
    const name = 'Ernst-Reuter mapped lawns paving two basins and 41 small jets';
    expect(signature(createWestSquaresV163().getObjectByName(name)!)).toBe('c5e75aa1c67240b5088b3c7672183eef697bc0a169f880b3e320ac09b307f4f4');
    expect(signature(createMinecraftWestSquaresV163().getObjectByName(name)!)).toBe('223e8dff7c6b3b1688d81969a8468e0bf77a49f17e814d77f9028e8b2dbc70d1');
  });
  it('uses the existing seven drawn calls and four native calls within explicit finite allocations', () => {
    const drawn = stats(createWestSquaresV163()), native = stats(createMinecraftWestSquaresV163());
    expect(drawn.calls).toBe(7); expect(native.calls).toBe(4);
    expect(drawn.bytes).toBeLessThan(1_800_000); expect(native.bytes).toBeLessThan(3_100_000);
    expect(drawn.triangles).toBeLessThan(115_000);
    expect(native.triangles).toBeLessThan(WEST_SQUARES_V188_PROFILE.maxNativeBlocks * 12);
  });
  it('renders all 132 collar triangles facing upward with the existing FrontSide material', () => {
    const key = (points: number[][]) => points.map(p => p.map(Math.fround).join(',')).sort().join('|');
    const expected = new Set(refinement.roofCollar.map(t => key(t.points)));
    const matched = new Set<string>();
    const root = createWestSquaresV163().getObjectByName('KaDeWe entrance lettering and glazed barrel-roof recognition')!;
    root.traverse(o => {
      if (!(o instanceof Mesh)) return;
      const positions = o.geometry.getAttribute('position'), index = o.geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const points = [0, 1, 2].map(j => {
          const vertex = index.getX(i + j);
          return [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)];
        });
        const identity = key(points);
        if (!expected.has(identity)) continue;
        matched.add(identity);
        const [a, b, c] = points;
        const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        expect(normalY).toBeGreaterThan(0);
        expect(o.userData.dayMaterial.side).toBe(FrontSide);
        expect(o.userData.nightMaterial.side).toBe(FrontSide);
      }
    });
    expect(matched.size).toBe(132);
  });
  it('keeps source identities explicit and roof measurements qualified', () => {
    expect([...WEST_SQUARES_V188_PROFILE.pavingOwners].sort()).toEqual(['26369804', '26369805', '5396406', '5748424']);
    expect(WEST_SQUARES_V188_PROFILE.roadOwners.length).toBeGreaterThan(10);
    expect(WEST_SQUARES_V188_PROFILE.roofSource).toContain('display estimates');
    expect(refinement.roofCollar.length).toBe(132);
    expect(refinement.facadeBands.length).toBe(174);
    expect(WEST_SQUARES_V188_PROFILE.glassHall.baseY + WEST_SQUARES_V188_PROFILE.glassHall.rise).toBeLessThan(43);
  });
});
