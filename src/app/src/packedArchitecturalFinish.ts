import { BufferAttribute, type Mesh } from "three";
import { finishes, finishPaints, type SurfaceFinish } from "./architecturalFinishTypes";
import { civicPacketFinish } from "./civicArchitecturalFinish";
import { skylinePacketFinish } from "./skylineFinishes";

const lengthBits = 2048;
const startBits = lengthBits * 4;
// Four runs fit a single vertex uniform vector. Keep room for Three's own
// uniforms even on a minimum-capability WebGL2 device.
const maxUniformRuns = 512;

export class PackedArchitecturalFinish {
  private runs: number[] = [];

  mark(vertex: number, id = 1): void {
    const last = this.runs.length - 1;
    if (last >= 0) {
      const code = this.runs[last];
      const start = Math.floor(code / startBits);
      const length = Math.floor((code % startBits) / 4) + 1;
      if (code % 4 === id - 1 && vertex === start + length && length < lengthBits) {
        this.runs[last] += 4;
        return;
      }
    }
    this.runs.push(vertex * startBits + id - 1);
  }

  *markPart(kind: string, words: Uint16Array, start: number, count: number, linear16: boolean): Generator<void> {
    const profile = civicPacketFinish(kind) ?? skylinePacketFinish(kind);
    if (!profile) return;
    if (typeof profile === "string") {
      const role = finishes.indexOf(profile) + 1;
      for (let i = start; i < start + count; i += lengthBits) {
        const length = Math.min(lengthBits, start + count - i);
        this.runs.push(i * startBits + (length - 1) * 4 + role - 1);
      }
      return;
    }
    const lookup = packedPaints(profile, linear16);
    for (let block = start; block < start + count; block += 8192) {
      const end = Math.min(start + count, block + 8192);
      for (let i = block; i < end; i++) {
        const p = i * 6 + 3;
        const key = words[p] * 4294967296 + words[p + 1] * 65536 + words[p + 2];
        const role = lookup.get(key);
        if (role) this.mark(i, role);
      }
      yield;
    }
  }

  /** Sparse selections use uniforms. Dense selections use one byte per
   * vertex and count against the existing tile budget. */
  attach(mesh: Mesh): number {
    if (!this.runs.length) return 0;
    if (this.runs.length <= maxUniformRuns && this.runs[this.runs.length - 1] <= 0xffffffff) {
      mesh.userData.architecturalRuns = this.runs;
      return 0;
    }
    const tags = new Uint8Array(mesh.geometry.getAttribute("position").count);
    for (const code of this.runs) {
      const start = Math.floor(code / startBits);
      const length = Math.floor((code % startBits) / 4) + 1;
      tags.fill(code % 4 + 1, start, start + length);
    }
    mesh.geometry.setAttribute("architecturalFinishId", new BufferAttribute(tags, 1));
    return tags.byteLength;
  }
}

const bytePaints = new WeakMap<object, Map<number, number>>();
const wordPaints = new WeakMap<object, Map<number, number>>();

function packedPaints(profile: Exclude<SurfaceFinish, string>, linear16: boolean) {
  const cache = linear16 ? wordPaints : bytePaints;
  let lookup = cache.get(profile);
  if (lookup) return lookup;
  lookup = new Map<number, number>();
  const scale = linear16 ? 65535 : 255;
  const factor = linear16 ? 1 : 257;
  for (const { color, id } of finishPaints(profile)) {
    const key = factor * (Math.round(color.r * scale) * 4294967296 +
      Math.round(color.g * scale) * 65536 + Math.round(color.b * scale));
    // If linear quantisation merges two surface types, keep the source paint.
    const previous = lookup.get(key);
    lookup.set(key, previous === undefined || previous === id ? id : 0);
  }
  cache.set(profile, lookup);
  return lookup;
}
