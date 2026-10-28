import { expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { Group } from 'three';
import source from '../../src/data/zooGroundsV165Source.json';
import { freezeStaticSceneTransforms } from '../../src/staticSceneTransforms';
import { letteringStrokePaths } from '../../src/drawnLettering';
import { pointInWorldRing } from '../../src/chancelleryExtensionProfile';
import { appendZooRecognitionV255 } from '../../src/ZooRecognitionV255';
import { appendZooHippoV256 } from '../../src/ZooHippoV256';
import { appendZooWestV276, compactZooWestV276Rows } from '../../src/zooWestV276';
import type { RetainedZooAnimalV282 } from '../../src/ZooAnimalsV282';
import receipt from '../fixtures/zoo-animals-v282-source-replay.json';
import { replaySourceV281 } from './coreMaterialV281';
import { staticGeometryAudit } from './staticGeometryAudit';

/** These two exact source inverses retain the old factory and append recipe.
 * They fail closed on edits outside the animal ownership transfer. No saved
 * full-city geometry, runtime git dependency or production test switch. */
function guardedSources(): { current: string; legacy: string } {
  const current = readFileSync(new URL('../../src/ZooGroundsV165.ts', import.meta.url), 'utf8');
  const legacy = replaySourceV281(current, receipt[0]);
  replaySourceV281(readFileSync(new URL('../../src/zooWestV276.ts', import.meta.url), 'utf8'), receipt[1]);
  return { current, legacy };
}

function factory(code: string, captured: RetainedZooAnimalV282[]): (native: boolean) => Group {
  // Only the verified local recipe is evaluated. Its explicit imports are
  // supplied from the same modules as production; TypeScript erasure changes
  // no geometry, colour conversion or source row order.
  const bindings = {
    ...THREE, source, freezeStaticSceneTransforms, letteringStrokePaths, pointInWorldRing,
    appendZooRecognitionV255, appendZooHippoV256, appendZooWestV276, compactZooWestV276Rows,
    createZooAnimalsV282(_site: string, _native: boolean, animals: RetainedZooAnimalV282[]) {
      captured.push(...animals); return new THREE.Group();
    },
  };
  const recipe = code.slice(code.indexOf('type P =')).replace(/^export /gm, '');
  const javascript = new Bun.Transpiler({ loader: 'ts', target: 'browser' }).transformSync(recipe);
  return new Function(...Object.keys(bindings), javascript + '\nreturn create;')(...Object.values(bindings));
}

export function disposeZooReplayV282(root: Group): void {
  const resources = new Set<{ dispose(): void }>();
  root.traverse(object => {
    object.userData.disposeZooAnimalsV282?.();
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    if (object instanceof THREE.InstancedMesh) resources.add(object);
    for (const material of [object.material, object.userData.dayMaterial, object.userData.nightMaterial].flat())
      if (material) resources.add(material);
  });
  for (const resource of resources) resource.dispose();
  root.clear();
}

/** Compare the submitted current architecture/materials against the exact
 * source factory with only animals omitted. The returned legacy root still
 * has every original animal in its old ordering, so callers keep their frozen
 * pre-animation full-root hashes, counts and native-volume assertions. */
export function replayZooBeforeAnimalsV282(root: Group, native: boolean): Group {
  const code = guardedSources(), captured: RetainedZooAnimalV282[] = [];
  const control = factory(code.current, captured)(native);
  const moving = root.children.find(object => object.userData.zooAnimalsV282)!;
  expect(moving).toBeDefined();
  // The original source polygon accepts eight mountain animals, not all nine
  // candidate offsets, plus two condors and the three v276 wolves.
  expect(captured).toHaveLength(13);
  expect(captured.filter(animal => animal.id.startsWith('zoo-mountain-'))).toHaveLength(8);
  expect(captured.filter(animal => animal.id.startsWith('zoo-condor-'))).toHaveLength(2);
  expect(captured.filter(animal => animal.id.startsWith('zoo-v276-wolf-'))).toHaveLength(3);
  expect(new Set(captured.map(animal => animal.id)).size).toBe(captured.length);
  expect(moving.userData.animalIds.slice(0, captured.length)).toEqual(captured.map(animal => animal.id));
  const index = root.children.indexOf(moving);
  try {
    moving.removeFromParent();
    // Includes exact geometry/indices, colours, transforms and day/night
    // materials of every submitted house, path, fence, rock and furnishing.
    expect(staticGeometryAudit(root)).toEqual(staticGeometryAudit(control));
  } finally {
    root.children.splice(index, 0, moving); moving.parent = root;
    disposeZooReplayV282(control);
  }
  return factory(code.legacy, [])(native);
}
