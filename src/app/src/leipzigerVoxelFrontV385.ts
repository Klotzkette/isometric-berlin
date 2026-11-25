import profiles from "./data/leipzigerVoxelFrontsV385.json";

type Key = keyof typeof profiles;
type Point = [number, number, number];
type Span = [lo: number, hi: number, outsetAtLo: number, outsetAtHi: number];
type Bands = [top: number, spans: Span[]][];

/** Transfer facade coordinates to the exposed faces of the original four-metre
 * voxel columns. Each span is one straight, axis-aligned face in world space. */
export class LeipzigerVoxelFrontV385 {
  private readonly tx: number;
  private readonly tz: number;
  private readonly nx: number;
  private readonly nz: number;
  private readonly bands: Bands;

  constructor(
    key: Key,
    readonly a: readonly number[],
    b: readonly number[],
    side: number,
  ) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    this.tx = (b[0] - a[0]) / length;
    this.tz = (b[1] - a[1]) / length;
    this.nx = -this.tz * side;
    this.nz = this.tx * side;
    this.bands = profiles[key] as Bands;
  }

  private raised(spans: Span[], out: number): Span[] {
    // Offset adjoining block faces to their common corner. Sliding each face
    // independently leaves cracks at convex corners of the four-metre grid.
    const lines = spans.map(([lo, hi, d0, d1]) => {
      const slope = (d1 - d0) / (hi - lo);
      return {
        lo,
        hi,
        slope,
        intercept: d0 - slope * lo + out * Math.hypot(1, slope),
      };
    });
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1],
        next = lines[i];
      if (
        Math.abs(spans[i - 1][1] - spans[i][0]) > 0.002 ||
        Math.abs(spans[i - 1][3] - spans[i][2]) > 0.004 ||
        Math.abs(prev.slope - next.slope) < 0.003
      )
        continue;
      const u = (next.intercept - prev.intercept) / (prev.slope - next.slope);
      prev.hi = u;
      next.lo = u;
    }
    return lines
      .filter((s) => s.hi > s.lo + 0.001)
      .map(({ lo, hi, slope, intercept }) => [
        lo,
        hi,
        slope * lo + intercept,
        slope * hi + intercept,
      ]);
  }

  private pointOn(span: Span, u: number, y: number): Point {
    const [lo, hi, d0, d1] = span;
    const d = d0 + ((d1 - d0) * (u - lo)) / (hi - lo);
    return [
      this.a[0] + this.tx * u + this.nx * d,
      y,
      this.a[1] + this.tz * u + this.nz * d,
    ];
  }

  point(u: number, y: number, out: number): Point | undefined {
    const band = this.bands.find(([top]) => top >= y);
    const span =
      band && this.raised(band[1], out).find(([lo, hi]) => lo <= u && u <= hi);
    return span && this.pointOn(span, u, y);
  }

  panels(
    u: number,
    y: number,
    w: number,
    h: number,
    d: number,
    out: number,
    emit: (center: Point, size: Point, yaw: number) => void,
  ) {
    let bottom = -Infinity;
    for (const [top, spans] of this.bands) {
      const y0 = Math.max(y - h / 2, bottom),
        y1 = Math.min(y + h / 2, top);
      bottom = top;
      if (y1 - y0 < 0.002) continue;
      const cy = (y0 + y1) / 2;
      for (const span of this.raised(spans, out)) {
        const left = Math.max(u - w / 2, span[0]),
          right = Math.min(u + w / 2, span[1]);
        if (right - left < 0.002) continue;
        const a = this.pointOn(span, left, cy),
          b = this.pointOn(span, right, cy);
        const dx = b[0] - a[0],
          dz = b[2] - a[2];
        emit(
          [(a[0] + b[0]) / 2, cy, (a[2] + b[2]) / 2],
          [Math.hypot(dx, dz), y1 - y0, d],
          -Math.atan2(dz, dx),
        );
      }
    }
  }
}
