import { describe, expect, test } from 'bun:test';
import {
  BufferAttribute, DynamicDrawUsage, Group, InstancedMesh, Mesh,
  PerspectiveCamera, Ray, Vector3, type Material,
} from 'three';
import {
  createZooAnimalsV282, createZooAnimalRuntimeV282,
  type RetainedZooAnimalV282, type ZooAnimalHandleV282,
} from '../src/ZooAnimalsV282';
import { zooAnimalChamferedBoxV282, zooAnimalShapeV282, type ZooAnimalSpeciesV282 } from '../src/zooAnimalShapesV282';
import { prepareZooAnimalRouteV282, sampleZooAnimalPoseV282 } from '../src/zooAnimalMotionV282';
import { parkStaticAttribute, parkStaticGeometrySteps, parkStaticInstancesSteps } from '../src/losslessStaticStorage';
import data from '../src/data/zooAnimalsV282.json';
import { animalConvexHullV282, animalHullsTouchV282 } from './helpers/animalConvexContactV282';

function handle(root: Group): ZooAnimalHandleV282 { return root.userData.zooAnimalsV282; }
function mesh(root: Group): Mesh {
  return root.children.find(o => o instanceof Mesh && !(o instanceof InstancedMesh)) as Mesh;
}
function blocks(root: Group): InstancedMesh {
  return root.children.find(o => o instanceof InstancedMesh) as InstancedMesh;
}
function finish(steps: Generator<void, number>): number {
  let next = steps.next(); while (!next.done) next = steps.next(); return next.value;
}
function dispose(root: Group): void {
  handle(root)?.dispose();
  const materials = new Set<Material>();
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    if (o instanceof InstancedMesh) o.dispose();
    o.geometry.dispose();
    for (const material of [o.userData.dayMaterial, o.userData.nightMaterial]) if (material) materials.add(material);
  });
  for (const material of materials) material.dispose();
  root.clear();
}
function cameraFor(root: Group): PerspectiveCamera {
  const camera = new PerspectiveCamera(60, 1, .1, 10000), center = handle(root).bounds.center;
  camera.position.copy(center).add(new Vector3(0, 500, 500));
  camera.lookAt(center); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); return camera;
}
function firstBodyCenter(root: Group): number[] {
  if (handle(root).native) return Array.from(blocks(root).instanceMatrix.array.subarray(12, 15));
  const p = mesh(root).geometry.getAttribute('position'), result = [0, 0, 0];
  const count = zooAnimalChamferedBoxV282().positions.length / 3;
  for (let i = 0; i < count; i++) {
    result[0] += p.getX(i) / count; result[1] += p.getY(i) / count; result[2] += p.getZ(i) / count;
  }
  return result;
}
function sameCenter(a: number[], b: number[]): void {
  for (let axis = 0; axis < 3; axis++) expect(Math.abs(a[axis] - b[axis])).toBeLessThan(.001);
}
const fixture: RetainedZooAnimalV282 = {
  id: 'retained-test-no-route', anchor: [100, 2, 200],
  boxes: [[100, 3, 200, 2, 2, 4, 0, 0x7799bb]],
  surfaces: [{ color: 0x804020, triangles: [[[101, 2, 200], [101.5, 2, 200], [101, 2.5, 200]]] }],
};

describe('v282 bounded animal scene integration', () => {
  test('every placed drawn individual has connected actual convex members, including bevelled corner attachments', () => {
    let checked = 0;
    for (const site of ['zoo', 'tierpark'] as const) {
      const root = createZooAnimalsV282(site, false);
      try {
        const geometry = mesh(root).geometry;
        let offset = 0;
        for (const animal of data.animals.filter(a => a.siteId === site)) {
          const shape = zooAnimalShapeV282(animal.species as ZooAnimalSpeciesV282, animal.variant);
          const hulls = shape.map(part => {
            const count = part.part === 'body' || part.part === 'head'
              ? zooAnimalChamferedBoxV282().indices.length : 36;
            const hull = animalConvexHullV282(geometry, offset, count); offset += count; return hull;
          });
          const connected = new Set([0]);
          for (let pass = 0; pass < hulls.length; pass++) {
            let grew = false;
            for (let i = 0; i < hulls.length; i++) if (!connected.has(i)
              && [...connected].some(j => animalHullsTouchV282(hulls[i], hulls[j]))) {
              connected.add(i); grew = true;
            }
            if (!grew) break;
          }
          const detached = shape.flatMap((part, index) => connected.has(index) ? []
            : [`${animal.id}: ${animal.species}/${animal.variant} member ${index} ${part.part}`]);
          expect(detached).toEqual([]);
          checked++;
        }
        expect(offset).toBe(geometry.index!.count);
      } finally { dispose(root); }
    }
    expect(checked).toBe(data.animals.length);
  });
  test('actual drawn bodies meet every supporting leg rather than floating above it', () => {
    const root = createZooAnimalsV282('zoo', false);
    try {
      const animal = data.animals.find(a => a.siteId === 'zoo')!;
      const shape = zooAnimalShapeV282(animal.species as ZooAnimalSpeciesV282, animal.variant);
      const surfaces = mesh(root), p = surfaces.geometry.getAttribute('position'), index = surfaces.geometry.index!;
      const vertices = [new Vector3(), new Vector3(), new Vector3()], hit = new Vector3();
      const bodyIndexCount = zooAnimalChamferedBoxV282().indices.length;
      const legs = shape.filter(row => row.part.startsWith('leg-') && row.h > .2);
      expect(legs).toHaveLength(4);
      for (const leg of legs) {
        const origin = new Vector3(animal.routeXZ[0][0] + leg.x, animal.groundY - .1,
          animal.routeXZ[0][1] + leg.z);
        const ray = new Ray(origin, new Vector3(0, 1, 0));
        let firstIntersectionY = Infinity;
        for (let i = 0; i < bodyIndexCount; i += 3) {
          for (let j = 0; j < 3; j++) vertices[j].fromBufferAttribute(p, index.getX(i + j));
          if (ray.intersectTriangle(vertices[0], vertices[1], vertices[2], false, hit))
            firstIntersectionY = Math.min(firstIntersectionY, hit.y);
        }
        expect(Number.isFinite(firstIntersectionY)).toBe(true);
        expect(firstIntersectionY).toBeLessThanOrEqual(animal.groundY + leg.y + leg.h / 2 + .001);
        expect(firstIntersectionY).toBeGreaterThan(animal.groundY + .5);
      }
    } finally { dispose(root); }
  });
  test('retained cuboids and triangle vertices survive the exact zero pose in both families', () => {
    for (const native of [false, true]) {
      const root = createZooAnimalsV282('zoo', native, [fixture], 'no-new-figures');
      try {
        expect(root.userData.animalIds).toEqual([fixture.id]);
        const surfaces = mesh(root), p = surfaces.geometry.getAttribute('position'), index = surfaces.geometry.index!;
        expect(index.count).toBe(native ? 3 : 39);
        const lastTriangle = Array.from({ length: 3 }, (_, i) => {
          const k = index.getX(index.count - 3 + i); return [p.getX(k), p.getY(k), p.getZ(k)];
        });
        expect(lastTriangle).toEqual(fixture.surfaces[0].triangles[0]);
        if (native) {
          expect(blocks(root).count).toBe(1);
          expect(Array.from(blocks(root).instanceMatrix.array)).toEqual([
            2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 4, 0, 100, 3, 200, 1,
          ]);
        } else {
          const corners = new Set<string>();
          for (let i = 0; i < index.count - 3; i++) {
            const k = index.getX(i); corners.add([p.getX(k), p.getY(k), p.getZ(k)].join(','));
          }
          const expected = new Set<string>();
          for (const x of [99, 101]) for (const y of [2, 4]) for (const z of [198, 202])
            expected.add([x, y, z].join(','));
          expect(corners).toEqual(expected);
        }
        const source = JSON.stringify(fixture);
        handle(root).update(5); handle(root).update(0);
        expect(JSON.stringify(fixture)).toBe(source);
        for (let i = 0; i < p.count; i++) expect(handle(root).bounds.containsPoint(
          new Vector3(p.getX(i), p.getY(i), p.getZ(i)))).toBe(true);
      } finally { dispose(root); }
    }
  });

  test('already linear packed surface colours are not converted through sRGB a second time', () => {
    for (const native of [false, true]) {
      const root = createZooAnimalsV282('tierpark', native,
        [{ ...fixture, boxes: [], linearColors: true }], 'no-new-figures');
      try {
        const colors = mesh(root).geometry.getAttribute('color');
        for (let i = 0; i < colors.count; i++) expect([colors.getX(i), colors.getY(i), colors.getZ(i)])
          .toEqual([Math.fround(128 / 255), Math.fround(64 / 255), Math.fround(32 / 255)]);
        handle(root).update(9);
        expect(colors.getX(0)).toBe(Math.fround(128 / 255));
      } finally { dispose(root); }
    }
  });

  test('both sites keep the same individuals and routes, with cardinal native poses inside their body envelopes', () => {
    for (const site of ['zoo', 'tierpark'] as const) {
      const drawn = createZooAnimalsV282(site, false), native = createZooAnimalsV282(site, true);
      try {
        const animals = data.animals.filter(a => a.siteId === site), nativeMesh = blocks(native);
        expect(drawn.userData.animalIds).toEqual(animals.map(a => a.id));
        expect(native.userData.animalIds).toEqual(drawn.userData.animalIds);
        expect(new Set(native.userData.animalIds).size).toBe(animals.length);
        for (const seconds of [0, .25, 19.75, 97]) {
          handle(drawn).update(seconds); handle(native).update(seconds);
          sameCenter(firstBodyCenter(drawn), firstBodyCenter(native));
          let offset = 0;
          for (const animal of animals) {
            const shape = zooAnimalShapeV282(animal.species as ZooAnimalSpeciesV282, animal.variant);
            const points = animal.routeXZ as [number, number][];
            const closed = points.length > 2 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1];
            const route = prepareZooAnimalRouteV282({ ...animal, animalId: animal.id,
              routeXZ: closed ? points.slice(0, -1) : points });
            const pose = sampleZooAnimalPoseV282(route, seconds,
              { x: 0, y: 0, z: 0, quarterTurn: 0, gait: 0 });
            let lowestFoot = Infinity;
            for (let i = 0; i < shape.length; i++) {
              const values = nativeMesh.instanceMatrix.array.subarray((offset + i) * 16, (offset + i + 1) * 16);
              for (const k of [1, 2, 4, 6, 8, 9]) expect(values[k]).toBe(0);
              for (const k of [0, 5, 10]) expect(values[k]).toBeGreaterThan(0);
              expect(values[15]).toBe(1);
              lowestFoot = Math.min(lowestFoot, values[13] - values[5] / 2);
              for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
                const x = values[12] + sx * values[0] / 2, z = values[14] + sz * values[10] / 2;
                expect(Math.hypot(x - pose.x, z - pose.z)).toBeLessThan(animal.bodyRadius + .052);
                expect(handle(native).bounds.containsPoint(new Vector3(x, values[13], z))).toBe(true);
              }
            }
            expect(lowestFoot).toBeGreaterThanOrEqual(animal.groundY - .001);
            expect(lowestFoot).toBeLessThanOrEqual(animal.groundY + .041);
            offset += shape.length;
          }
          expect(offset).toBe(nativeMesh.count);
        }
      } finally { dispose(drawn); dispose(native); }
    }
  });

  test('shared runtime pauses hidden or suspended scenes and keeps time through family and drawn-theme changes', () => {
    const drawn = createZooAnimalsV282('zoo', false), native = createZooAnimalsV282('zoo', true);
    const expected = createZooAnimalsV282('zoo', true), parent = new Group();
    parent.add(drawn, native);
    const runtime = createZooAnimalRuntimeV282(), camera = cameraFor(drawn);
    try {
      runtime.register(parent); runtime.register(parent);
      expect(runtime.size).toBe(2);
      expect(runtime.update(0, camera, false, false)).toBe(true);
      expect(runtime.update(100, camera, false, false)).toBe(true);
      const moving = firstBodyCenter(drawn);
      parent.visible = false;
      expect(runtime.update(10000, camera, false, false)).toBe(false);
      expect(firstBodyCenter(drawn)).toEqual(moving);
      parent.visible = true;
      expect(runtime.update(20000, camera, false, false)).toBe(true);
      expect(firstBodyCenter(drawn)).toEqual(moving);
      expect(runtime.update(20100, camera, false, true)).toBe(false);
      expect(runtime.update(40100, camera, false, false)).toBe(true);
      expect(firstBodyCenter(drawn)).toEqual(moving);
      // Minecraft resumes the same per-zoo clock, rather than starting a new loop.
      expect(runtime.update(40200, camera, true, false)).toBe(true);
      handle(expected).update(.2);
      sameCenter(firstBodyCenter(native), firstBodyCenter(expected));
      // Day/night/snow/flood all use this same drawn family. Water does not
      // enter the pose sampler or replace the mapped ground height.
      let timestamp = 40300, elapsed = .3;
      for (let themeChange = 0; themeChange < 4; themeChange++) {
        expect(runtime.update(timestamp, camera, false, false)).toBe(true);
        handle(expected).update(elapsed);
        sameCenter(firstBodyCenter(drawn), firstBodyCenter(expected));
        timestamp += 100; elapsed += .1;
      }
      handle(native).dispose();
      expect(runtime.size).toBe(1);
      const frozen = firstBodyCenter(native);
      handle(native).update(1000);
      expect(firstBodyCenter(native)).toEqual(frozen);
      runtime.dispose(); expect(runtime.size).toBe(0);
      expect(runtime.update(50000, camera, false, false)).toBe(false);
    } finally { runtime.dispose(); dispose(drawn); dispose(native); dispose(expected); }
  });

  test('offscreen animals stop without catching up when the camera returns', () => {
    const root = createZooAnimalsV282('tierpark', true), runtime = createZooAnimalRuntimeV282();
    const camera = cameraFor(root), center = handle(root).bounds.center;
    try {
      runtime.register(root); runtime.update(0, camera, true, false);
      runtime.update(100, camera, true, false);
      const before = firstBodyCenter(root);
      camera.position.copy(center).add(new Vector3(5000 + handle(root).bounds.radius, 0, 0));
      camera.lookAt(center); camera.updateMatrixWorld();
      expect(runtime.update(1000, camera, true, false)).toBe(false);
      expect(firstBodyCenter(root)).toEqual(before);
      const returned = cameraFor(root);
      expect(runtime.update(100000, returned, true, false)).toBe(true);
      expect(firstBodyCenter(root)).toEqual(before);
    } finally { runtime.dispose(); dispose(root); }
  });

  test('lossless static parking leaves animated positions and matrices writable and intact', () => {
    for (const native of [false, true]) {
      const root = createZooAnimalsV282('tierpark', native);
      try {
        const moving = native ? blocks(root).instanceMatrix : mesh(root).geometry.getAttribute('position') as BufferAttribute;
        const original = moving.array, length = original.byteLength;
        expect(moving.usage).toBe(DynamicDrawUsage);
        expect(finish(parkStaticAttribute(moving, true))).toBe(0);
        finish(parkStaticGeometrySteps(root, true)); finish(parkStaticInstancesSteps(root));
        expect(moving.array).toBe(original);
        expect(original.byteLength).toBe(length);
        expect(Object.getOwnPropertyDescriptor(moving, 'array')?.get).toBeUndefined();
        const before = Array.from(original.slice(0, 32));
        handle(root).update(3);
        expect(moving.array).toBe(original);
        expect(Array.from(original.slice(0, 32))).not.toEqual(before);
      } finally { dispose(root); }
    }
  });
});
