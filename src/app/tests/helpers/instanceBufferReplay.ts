import { expect } from "bun:test";
import type { InstancedMesh } from "three";

type RecordDelta = { index: number; data: string };
export type InstanceBufferDelta = {
  beforeCount: number; afterCount: number; retainedCount: number;
  removed: RecordDelta[]; added: RecordDelta[];
};

export function decodedInstance(record: RecordDelta): Float32Array {
  const bytes = Buffer.from(record.data, "base64");
  expect(bytes.byteLength).toBe(76);
  return new Float32Array(bytes.buffer, bytes.byteOffset, 19);
}

/** Reconstruct the frozen legacy hash from live buffers plus narrowly audited
 * removals. Every retained matrix/color byte and its order is checked by the
 * old hash; additions must exactly match their individually inspected receipt.
 * No second world or full-sized copied buffer is needed.
 */
export function replayLegacyInstanceHash(mesh: InstancedMesh, delta: InstanceBufferDelta): string {
  expect(mesh.count).toBe(delta.afterCount);
  expect(delta.retainedCount + delta.removed.length).toBe(delta.beforeCount);
  expect(delta.retainedCount + delta.added.length).toBe(delta.afterCount);
  for (const [records, count] of [[delta.removed,delta.beforeCount],[delta.added,delta.afterCount]] as const)
    for (let i=0;i<records.length;i++) {
      expect(records[i].index).toBeGreaterThan(i ? records[i-1].index : -1);
      expect(records[i].index).toBeLessThan(count);
      expect(Buffer.from(records[i].data,"base64").byteLength).toBe(76);
    }
  const hash = new Bun.CryptoHasher("sha256");
  for (const [attribute, stride, offset] of [[mesh.instanceMatrix,64,0],[mesh.instanceColor,12,64]] as const) {
    expect(attribute).not.toBeNull();
    const array=attribute!.array;
    const live=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
    expect(live.byteLength).toBe(delta.afterCount*stride);
    let oldIndex=0,newIndex=0,removedIndex=0,addedIndex=0;
    while(oldIndex<delta.beforeCount || newIndex<delta.afterCount) {
      const removed=delta.removed[removedIndex], added=delta.added[addedIndex];
      if(removed?.index===oldIndex) {
        hash.update(Buffer.from(removed.data,"base64").subarray(offset,offset+stride));
        oldIndex++;removedIndex++;continue;
      }
      if(added?.index===newIndex) {
        expect(live.subarray(newIndex*stride,(newIndex+1)*stride))
          .toEqual(Buffer.from(added.data,"base64").subarray(offset,offset+stride));
        newIndex++;addedIndex++;continue;
      }
      const length=Math.min((removed?.index??delta.beforeCount)-oldIndex,
        (added?.index??delta.afterCount)-newIndex);
      expect(length).toBeGreaterThan(0);
      hash.update(live.subarray(newIndex*stride,(newIndex+length)*stride));
      oldIndex+=length;newIndex+=length;
    }
    expect(removedIndex).toBe(delta.removed.length);
    expect(addedIndex).toBe(delta.added.length);
  }
  return hash.digest("hex");
}
