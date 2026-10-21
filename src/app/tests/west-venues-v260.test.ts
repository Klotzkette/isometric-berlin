import { describe, expect, test } from 'bun:test';
import { InstancedMesh, Mesh } from 'three';
import { createWestVenuesV260 } from '../src/WestVenuesV260';
import { WEST_VENUES_V260_PRISM_IDS, westVenuesV260SourceColumn, westVenuesV260RoofAt } from '../src/westVenuesV260Profile';
function metrics(native: boolean, mobileLike = false) {
  const root = createWestVenuesV260(native, { mobileLike }); let calls = 0, bytes = 0, instances = 0;
  root.traverse(o => {
    expect(o.matrixAutoUpdate).toBe(false);
    if (!(o instanceof Mesh)) return;
    calls++; expect(o.userData.textureFree).toBe(true);
    for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
    if (o instanceof InstancedMesh) {
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); instances += o.count;
      if (native) for (let i = 0; i < o.count; i++) for (const k of [1, 2, 4, 6, 8, 9]) expect(Math.abs(o.instanceMatrix.array[i * 16 + k])).toBe(0);
    }
  }); return { calls, bytes, instances };
}
describe('West venues complete v260 required models', () => {
  test('full drawn detail on touch and one independent orthogonal native batch', () => {
    const drawn = metrics(false), native = metrics(true);
    expect(metrics(false, true)).toEqual(drawn); expect(metrics(true, true)).toEqual(native);
    expect(drawn.calls).toBe(2); expect(native.calls).toBe(1);
    expect(drawn.bytes).toBeLessThan(700_000); expect(native.bytes).toBeLessThan(1_500_000);
    console.log({ drawn, native });
  });
  test('exact previous owners and heights gate substitution, roofs use measured profiles', () => {
    expect([...WEST_VENUES_V260_PRISM_IDS].sort()).toEqual(['16160637', '32861687', '48793287']);
    expect(westVenuesV260SourceColumn(-2941, 1276, 5.2, 17.2)).toBe(true);
    expect(westVenuesV260SourceColumn(-2941, 1276, 5.2, 18.2)).toBe(false);
    expect(westVenuesV260SourceColumn(-2900, 1276, 5.2, 17.2)).toBe(false);
    expect(westVenuesV260RoofAt(-2940, 1280)).toBeGreaterThan(35);
    expect(westVenuesV260RoofAt(0, 0)).toBe(null);
  });
});
