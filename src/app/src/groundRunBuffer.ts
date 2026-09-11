export type GroundRun = { classId: number; run: number; xStart: number; zOffset: number };

const RUNS_PER_CHUNK = 4096;
const STRIDE = 4;

/** Double precision, without one retained JS object per source ground run. */
export class GroundRunBuffer {
  private chunks: Float64Array[] = [];
  length = 0;

  push(classId: number, run: number, xStart: number, zOffset: number): void {
    const chunkIndex = Math.floor(this.length / RUNS_PER_CHUNK);
    const chunk = this.chunks[chunkIndex] ??=
      new Float64Array(RUNS_PER_CHUNK * STRIDE);
    const offset = (this.length % RUNS_PER_CHUNK) * STRIDE;
    chunk[offset] = classId;
    chunk[offset + 1] = run;
    chunk[offset + 2] = xStart;
    chunk[offset + 3] = zOffset;
    this.length++;
  }

  forEach(visit: (classId: number, run: number, xStart: number, zOffset: number) => void): void {
    for (let index = 0; index < this.length; index++) {
      const chunk = this.chunks[Math.floor(index / RUNS_PER_CHUNK)];
      const offset = (index % RUNS_PER_CHUNK) * STRIDE;
      visit(chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]);
    }
  }

}
