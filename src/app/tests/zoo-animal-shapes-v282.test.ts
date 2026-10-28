import { describe, expect, test } from 'bun:test';
import { BoxGeometry, BufferAttribute, BufferGeometry } from 'three';
import {
  ZOO_ANIMAL_SPECIES_V282, zooAnimalShapeV282, zooAnimalChamferedBoxV282,
  type ZooAnimalBoxV282, type ZooAnimalSpeciesV282,
} from '../src/zooAnimalShapesV282';
import { animalConvexHullV282, animalHullsTouchV282 } from './helpers/animalConvexContactV282';

const shapes = () => [
  ...ZOO_ANIMAL_SPECIES_V282.map(s => [s, undefined] as const),
  ...['polar', 'sun', 'spectacled'].map(v => ['bear', v] as const),
  ...['king', 'african', 'humboldt'].map(v => ['penguin', v] as const),
  ...['red-ruffed', 'black-and-white-ruffed', 'collared'].map(v => ['lemur', v] as const),
  ['camel', 'dromedary'] as const,
  ['stork', 'black'] as const,
];
function bounds(rows: readonly ZooAnimalBoxV282[]) {
  const extent = (axis: 'x' | 'y' | 'z', dimension: 'w' | 'h' | 'd') => [
    Math.min(...rows.map(r => r[axis] - r[dimension] / 2)),
    Math.max(...rows.map(r => r[axis] + r[dimension] / 2)),
  ] as const;
  const x = extent('x', 'w'), y = extent('y', 'h'), z = extent('z', 'd');
  return { x, y, z, length: x[1] - x[0], height: y[1] - y[0], width: z[1] - z[0] };
}
const overlaps = (a: ZooAnimalBoxV282, b: ZooAnimalBoxV282) => (
  Math.abs(a.x - b.x) <= (a.w + b.w) / 2 + 1e-8 &&
  Math.abs(a.y - b.y) <= (a.h + b.h) / 2 + 1e-8 &&
  Math.abs(a.z - b.z) <= (a.d + b.d) / 2 + 1e-8
);
function drawnPrimitive(): BufferGeometry {
  const primitive = zooAnimalChamferedBoxV282(), geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(primitive.positions), 3));
  geometry.setIndex([...primitive.indices]); return geometry;
}

describe('v282 bounded original zoo animal shapes', () => {
  test('drawn chamfers retain full contact planes and a closed outward-facing manifold', () => {
    const geometry = zooAnimalChamferedBoxV282(), { positions, indices } = geometry;
    expect(geometry).toBe(zooAnimalChamferedBoxV282());
    expect(Object.isFrozen(geometry)).toBe(true);
    expect(Object.isFrozen(positions)).toBe(true);
    expect(Object.isFrozen(indices)).toBe(true);
    expect(positions).toHaveLength(72);
    expect(indices).toHaveLength(132);
    const edges = new Map<string, number[]>();
    for (let i = 0; i < indices.length; i += 3) {
      const tri = indices.slice(i, i + 3);
      const [a, b, c] = tri.map(index => positions.slice(index * 3, index * 3 + 3));
      const ab = b.map((v, axis) => v - a[axis]), ac = c.map((v, axis) => v - a[axis]);
      const normal = [ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      expect(normal.reduce((sum, n, axis) => sum + n * a[axis], 0)).toBeGreaterThan(0);
      for (let j = 0; j < 3; j++) {
        const from = tri[j], to = tri[(j + 1) % 3], key = [Math.min(from, to), Math.max(from, to)].join(',');
        const directions = edges.get(key) ?? []; directions.push(from < to ? 1 : -1); edges.set(key, directions);
      }
    }
    for (const directions of edges.values()) { expect(directions.length).toBe(2); expect(directions[0] + directions[1]).toBe(0); }
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const face = Array.from({ length: positions.length / 3 }, (_, i) => positions.slice(i * 3, i * 3 + 3))
        .filter(vertex => vertex[axis] === sign * .5);
      expect(face).toHaveLength(4);
      for (const vertex of face) for (let other = 0; other < 3; other++)
        if (other !== axis) expect(Math.abs(vertex[other])).toBe(.44);
    }
  });
  test('every requested species has an immutable, cached, independent cardinal recipe', () => {
    expect(ZOO_ANIMAL_SPECIES_V282).toHaveLength(29);
    const signatures = new Set<string>();
    for (const [species, variant] of shapes()) {
      const rows = zooAnimalShapeV282(species, variant);
      expect(rows).toBe(zooAnimalShapeV282(species, variant));
      expect(Object.isFrozen(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(5);
      expect(rows.length).toBeLessThanOrEqual(70);
      for (const row of rows) {
        expect(Object.isFrozen(row)).toBe(true);
        expect(Object.keys(row).sort()).toEqual(['color', 'd', 'h', 'part', 'w', 'x', 'y', 'z']);
        for (const k of ['x', 'y', 'z', 'w', 'h', 'd'] as const) expect(Number.isFinite(row[k])).toBe(true);
        for (const k of ['w', 'h', 'd'] as const) expect(row[k]).toBeGreaterThan(0);
        expect(Number.isInteger(row.color)).toBe(true);
        expect(row.color).toBeGreaterThanOrEqual(0);
        expect(row.color).toBeLessThanOrEqual(0xffffff);
        expect(row.part.length).toBeGreaterThan(0);
      }
      expect(rows.some(r => r.part === 'body')).toBe(true);
      expect(rows.some(r => r.part === 'head')).toBe(true);
      const shapeBounds = bounds(rows);
      expect(shapeBounds.y[0]).toBeCloseTo(0, 10);
      expect(shapeBounds.height).toBeLessThan(5.5);
      expect(shapeBounds.length).toBeLessThan(6.5);
      expect(shapeBounds.width).toBeLessThan(4);
      const signature = JSON.stringify(rows);
      expect(signatures.has(signature)).toBe(false);
      signatures.add(signature);
    }
    expect(() => zooAnimalShapeV282('unknown' as ZooAnimalSpeciesV282)).toThrow('Unknown zoo animal species');
    expect(zooAnimalShapeV282('bear', 'brown')).toBe(zooAnimalShapeV282('bear'));
  });

  test('limbs, ears, plumage and colour patches stay connected to each body', () => {
    for (const [species, variant] of shapes()) {
      const rows = zooAnimalShapeV282(species, variant);
      const connected = new Set([rows.findIndex(row => row.part === 'body')]);
      for (let pass = 0; pass < rows.length; pass++) {
        let changed = false;
        for (let i = 0; i < rows.length; i++) if (!connected.has(i)) {
          if ([...connected].some(j => overlaps(rows[i], rows[j]))) { connected.add(i); changed = true; }
        }
        if (!changed) break;
      }
      const detached = rows.filter((_, i) => !connected.has(i));
      expect({ species, variant, detached }).toEqual({ species, variant, detached: [] });
    }
  });

  test('all species and variants also remain connected with convex drawn chamfers', () => {
    const rounded = drawnPrimitive(), cube = new BoxGeometry(1, 1, 1);
    try {
      // Negative control: these AABBs overlap, but the small box occupies the
      // clipped corner. Contact is real only after moving it onto a full face.
      const corner = new BoxGeometry(.02, .02, .02).translate(.49, .49, .49);
      const body = animalConvexHullV282(rounded, 0, rounded.index!.count);
      const detached = animalConvexHullV282(corner, 0, corner.index!.count);
      expect(detached.min.every((value, axis) => value < body.max[axis])).toBe(true);
      expect(animalHullsTouchV282(body, detached)).toBe(false);
      corner.translate(0, -.49, -.49);
      expect(animalHullsTouchV282(body, animalConvexHullV282(corner, 0, corner.index!.count))).toBe(true);
      corner.dispose();
      for (const [species, variant] of shapes()) {
        const rows = zooAnimalShapeV282(species, variant);
        const hulls = rows.map(row => {
          const geometry = (row.part === 'body' || row.part === 'head' ? rounded : cube).clone();
          geometry.scale(row.w, row.h, row.d).translate(row.x, row.y, row.z);
          const hull = animalConvexHullV282(geometry, 0, geometry.index!.count);
          geometry.dispose(); return hull;
        });
        const connected = new Set([rows.findIndex(row => row.part === 'body')]);
        for (let pass = 0; pass < rows.length; pass++) {
          let changed = false;
          for (let i = 0; i < rows.length; i++) if (!connected.has(i)
            && [...connected].some(j => animalHullsTouchV282(hulls[i], hulls[j], 1e-6))) {
            connected.add(i); changed = true;
          }
          if (!changed) break;
        }
        const detached = rows.flatMap((row, index) => connected.has(index) ? [] : [`${index}: ${row.part}`]);
        expect({ species, variant, detached }).toEqual({ species, variant, detached: [] });
      }
    } finally { rounded.dispose(); cube.dispose(); }
  });

  test('recognition relies on silhouette and scale as well as coat colour', () => {
    const shape = (s: ZooAnimalSpeciesV282, v?: string) => bounds(zooAnimalShapeV282(s, v));
    expect(shape('giraffe').height).toBeGreaterThan(shape('elephant-african').height);
    expect(shape('elephant-african').height).toBeGreaterThan(shape('bear').height * 1.8);
    expect(shape('rabbit').height).toBeLessThan(shape('wolf').height);
    expect(shape('condor').width).toBeGreaterThan(shape('condor').height * 2.5);
    expect(shape('snake').height).toBeLessThan(.3);
    expect(shape('alligator').length).toBeGreaterThan(shape('alligator').height * 5);
    expect(shape('giraffe').height).toBeGreaterThan(shape('giraffe').width * 4);
    expect(shape('penguin', 'king').height).toBeGreaterThan(shape('penguin', 'african').height * 1.5);
    expect(shape('bear', 'polar').length).toBeGreaterThan(shape('bear', 'sun').length * 1.5);
    const african = zooAnimalShapeV282('elephant-african');
    const asian = zooAnimalShapeV282('elephant-asian');
    const largestEar = (rows: readonly ZooAnimalBoxV282[]) => Math.max(...rows
      .filter(r => r.part === 'head' && Math.abs(r.z) > .6).map(r => r.w * r.h));
    expect(largestEar(african)).toBeGreaterThan(largestEar(asian) * 2);
    const neckHeight = (s: ZooAnimalSpeciesV282) => Math.max(...zooAnimalShapeV282(s)
      .filter(r => r.part === 'head').map(r => r.y + r.h / 2));
    expect(neckHeight('stork')).toBeGreaterThan(neckHeight('chicken') * 2);
    for (const species of ['condor', 'penguin', 'pelican', 'ibis', 'stork', 'marabou'] as const) {
      expect(zooAnimalShapeV282(species).some(r => r.part === 'wing-left')).toBe(true);
      expect(zooAnimalShapeV282(species).some(r => r.part === 'wing-right')).toBe(true);
    }
    for (const species of ['gorilla', 'orangutan', 'chimpanzee'] as const) {
      const arms = zooAnimalShapeV282(species).filter(r => r.part.startsWith('leg-front'));
      expect(Math.max(...arms.map(r => r.h))).toBeGreaterThan(1);
      expect(zooAnimalShapeV282(species).some(r => r.part === 'tail')).toBe(false);
    }
    const ringTail = zooAnimalShapeV282('lemur').filter(r => r.part === 'tail');
    expect(new Set(ringTail.map(r => r.color)).size).toBe(2);
    expect(new Set(zooAnimalShapeV282('lemur', 'red-ruffed')
      .filter(r => r.part === 'tail').map(r => r.color)).size).toBe(1);
    // One-hump and two-hump silhouettes differ geometrically, not just in their labels.
    expect(zooAnimalShapeV282('camel').length).toBeGreaterThan(zooAnimalShapeV282('camel', 'dromedary').length);
  });
});
