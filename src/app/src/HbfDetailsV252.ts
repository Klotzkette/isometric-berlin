import { Euler, Quaternion, Vector3 } from "three";
import street from "./data/hbfStreetDetailsV252.json";
import { MINECRAFT_ARCHITECTURAL_BLOCKS as BLOCK } from "./visual-modes/minecraft/palette";

type Point = [number, number, number];
type Member = { position: Point; size: Point; color: number; role: string };
type Transform = { position: Point; rotation: Point; scale: Point };

export const HBF_DETAILS_V252 = {
  source: "geo_data/regierungsviertel/hbf-details-v252-source.json",
  stationPlan: "https://www.bahnhof.de/downloads/station-plans/1071.pdf",
  sourceSha256: street.sourceSha256,
  stairStatus: "Schematic tread subdivisions of retained flights; not a surveyed stair or new walking route.",
  deepTopZ: 72.8,
  deepBottomZ: 81.8,
  deepTopY: -5.15,
  deepBottomY: -14.055,
} as const;

/** Exact receipt for the four old unsupported deep runs. A changed upstream
 * flight retains its own endpoints until a new receipt has been reviewed. */
export function hbfFlightEndpointsV252(from: Point, to: Point): { from: Point; to: Point; corrected: boolean } {
  const side = Math.sign(from[2]), edge = Math.sign(from[0]);
  const expected = [edge * 5.2, -5.4, side * 76, edge * 9.5, -14.53, side * (76 + 9.13 * 1.9)];
  if (!side || !edge || ![...from, ...to].every((v, i) => Math.abs(v - expected[i]) < 0.000001)) {
    return { from, to, corrected: false };
  }
  return {
    from: [edge * 5.2, HBF_DETAILS_V252.deepTopY, side * HBF_DETAILS_V252.deepTopZ],
    to: [edge * 9.5, HBF_DETAILS_V252.deepBottomY, side * HBF_DETAILS_V252.deepBottomZ],
    corrected: true,
  };
}

/** Horizontal tread caps in the existing inclined ridge batch. Original ridges,
 * glass, handrails and bands remain. Sections are explicit display estimates. */
export function hbfHorizontalTreadsV252(
  from: Point, to: Point, carrierRotation: Quaternion,
): Transform[] {
  const delta = new Vector3(...to).sub(new Vector3(...from));
  const centre = new Vector3(...to).add(new Vector3(...from)).multiplyScalar(0.5);
  const inverse = carrierRotation.clone().invert();
  const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(delta.x, delta.z));
  const rotation = new Euler().setFromQuaternion(inverse.clone().multiply(yaw));
  const count = Math.ceil(Math.abs(delta.y) / 0.24);
  return Array.from({ length: count - 1 }, (_, index) => {
    const t = (index + 1) / count;
    const position = new Vector3(...from).addScaledVector(delta, t);
    position.y += 0.34;
    position.sub(centre).applyQuaternion(inverse);
    return {
      position: position.toArray() as Point,
      rotation: [rotation.x, rotation.y, rotation.z] as Point,
      // Existing ridge cube has dimensions [2.1, .09, .16].
      scale: [1, 0.7, 2.6] as Point,
    };
  });
}

/** Native concourse has no deep cut. A flat, block-built tread/side-line symbol
 * communicates the descent location without inventing a hole through its floor. */
export function hbfNativeDescentCuesV252(floorY: number): Member[] {
  const members: Member[] = [];
  for (const side of [-1, 1]) for (const edge of [-1, 1]) {
    for (let step = 0; step < 8; step++) members.push({
      position: [edge * 5.2, floorY + 0.035, side * (69 + step * 0.7)],
      size: [2.1, 0.045, 0.18], color: BLOCK.iron,
      role: "Hauptbahnhof v252 native schematic descent floor cue",
    });
    for (const flank of [-1, 1]) members.push({
      position: [edge * 5.2 + flank * 1.3, floorY + 0.035, side * 71.45],
      size: [0.18, 0.045, 5.9], color: BLOCK.silver,
      role: "Hauptbahnhof v252 native schematic descent floor cue",
    });
  }
  return members;
}

type StreetBuilder = {
  native: boolean;
  beam(a: Point, b: Point, width: number, height: number, tint: number): void;
};

/** Reuses the north-approach member batch, material, lifetime and terrain datum.
 * Full drawn detail is shared by touch and pointer. Native beams are orthogonal
 * block runs; all original road sheets/upstands remain intact. */
export function appendHbfStreetsV252(
  parts: StreetBuilder, terrainAt: (x: number, z: number) => number,
): void {
  const draw = (points: number[][], width: number, lift: number, height: number, tint: number, dashed: boolean) => {
    let chainage = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 0.001) continue;
      for (let start = 0; start < length;) {
        const phase = (chainage + start) % 6;
        const end = Math.min(length, start + (dashed ? (phase < 3 ? 3 : 6) - phase : 8));
        if (!dashed || phase < 3) {
          const at = (d: number): Point => {
            const x = a[0] + dx * d / length, z = a[1] + dz * d / length;
            return [x, terrainAt(x, z) + lift, z];
          };
          parts.beam(at(start), at(end), width, height, tint);
        }
        start = end + 0.000001;
      }
      chainage += length;
    }
  };
  for (const cap of street.curbCaps) {
    if (parts.native) {
      draw(cap.points, 0.28, 0.35, 0.05, 0xd7d4c8, false);
      continue;
    }
    // Existing district kerbs already have a 22 cm top at ground + .32 m.
    // Show individual stones with sparse joints, without coplanar duplicate caps.
    let carried = 0;
    for (let i = 1; i < cap.points.length; i++) {
      const a = cap.points[i - 1], b = cap.points[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 0.001) continue;
      for (let d = 2.2 - carried; d < length; d += 2.2) {
        const x = a[0] + dx * d / length, z = a[1] + dz * d / length;
        const nx = -dz / length * 0.1, nz = dx / length * 0.1, y = terrainAt(x, z) + 0.336;
        parts.beam([x - nx, y, z - nz], [x + nx, y, z + nz], 0.035, 0.014, 0x909185);
      }
      carried = (carried + length) % 2.2;
    }
  }
  for (const line of street.paint) draw(line.points, 0.15, 0.215, 0.025, 0xf2f0e8, line.dashed);
}
