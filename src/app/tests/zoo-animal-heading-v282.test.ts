import { expect, test } from 'bun:test';
import { InstancedMesh, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { createZooAnimalsV282, createZooAnimalRuntimeV282, type RetainedZooAnimalV282 } from '../src/ZooAnimalsV282';
import { prepareZooAnimalRouteV282, sampleZooAnimalPoseV282 } from '../src/zooAnimalMotionV282';
import data from '../src/data/zooAnimalsV282.json';
const route = data.retainedRoutes.find(a => a.id === 'zoo-v276-wolf-2')!;
const prepared = prepareZooAnimalRouteV282({ ...route, animalId: route.id, routeXZ: route.routeXZ as [number, number][] });
function dispose(root: ReturnType<typeof createZooAnimalsV282>): void {
  root.userData.zooAnimalsV282.dispose();
  root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); o.userData.dayMaterial.dispose(); o.userData.nightMaterial.dispose(); if (o instanceof InstancedMesh) o.dispose(); } });
}
test('retained authored headings face forward along each route segment in both families', () => {
  for (const native of [false, true]) for (const heading of native ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [.4, Math.PI, -Math.PI / 2]) {
    const old: RetainedZooAnimalV282 = { id: route.id, anchor: [0, 0, 0], heading, surfaces: [],
      boxes: [[Math.cos(heading), 1, -Math.sin(heading), .2, .2, .2, native ? 0 : heading, 0xaabbcc]] };
    const root = createZooAnimalsV282('zoo', native, [old], 'no-new-figures');
    try {
      const pose = { x: 0, y: 0, z: 0, quarterTurn: 0, gait: 0 }, directions = new Set<number>();
      for (let seconds = 0; seconds < 200; seconds += 2) {
        root.userData.zooAnimalsV282.update(seconds); sampleZooAnimalPoseV282(prepared, seconds, pose); directions.add(pose.quarterTurn);
        const m = root.children[0] as Mesh, center = new Vector3();
        if (m instanceof InstancedMesh) center.set(m.instanceMatrix.array[12], m.instanceMatrix.array[13], m.instanceMatrix.array[14]);
        else { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) center.add(new Vector3(p.getX(i), p.getY(i), p.getZ(i)).divideScalar(p.count)); }
        expect(Math.abs(center.x - pose.x - Math.cos(pose.quarterTurn * Math.PI / 2))).toBeLessThan(.001);
        expect(Math.abs(center.z - pose.z + Math.sin(pose.quarterTurn * Math.PI / 2))).toBeLessThan(.001);
      }
      expect(directions.size).toBe(4);
    } finally { dispose(root); }
  }
});
test('a partially visible zoo keeps animating when its bounding centre is outside the viewport', () => {
  const fixtures: RetainedZooAnimalV282[] = [100, 300].map((x, i) => ({ id: 'frustum-edge-' + i, anchor: [x, 0, 200], surfaces: [], boxes: [[x, 1, 200, 1, 2, 1, 0, 0xabcdef]] }));
  const root = createZooAnimalsV282('zoo', true, fixtures, 'no-new-figures'), runtime = createZooAnimalRuntimeV282(); runtime.register(root);
  const camera = new PerspectiveCamera(20, 1, .1, 2000); camera.position.set(100, 20, 260); camera.lookAt(100, 1, 200); camera.updateMatrixWorld();
  expect(root.userData.zooAnimalsV282.bounds.center.clone().project(camera).x).toBeGreaterThan(1.35);
  try { runtime.update(0, camera, true, false); expect(runtime.update(100, camera, true, false)).toBe(true); camera.lookAt(100, 1, 500); camera.updateMatrixWorld(); expect(runtime.update(200, camera, true, false)).toBe(false); }
  finally { runtime.dispose(); dispose(root); }
});
