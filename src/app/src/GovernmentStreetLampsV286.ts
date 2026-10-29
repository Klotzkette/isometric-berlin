import { CatmullRomCurve3, Vector3 } from "three";

type Vec = [number, number, number];
export type GovernmentStreetLampAnchorV286 = {
  id: string;
  x: number;
  z: number;
  /** Three.js Y rotation. Zero places the dish centre toward world -X. */
  yawRadians: number;
  /** Existing source height above the pole's sampled ground, if known. */
  heightM?: number;
};
export type GovernmentStreetLampPartsV286 = {
  native: boolean;
  box(position: Vec, size: Vec, tint: number, yaw?: number): void;
  beam(a: Vec, b: Vec, width: number, height: number, tint: number): void;
  polygon(ring: number[][], holes: number[][][], heightAt: (x: number, z: number) => number, tint: number): void;
};

/** Only this tint denotes the lamp's luminous face. The host may route it to
 * its existing nightLightsOn-controlled emission material; no light is added.
 */
export const GOVERNMENT_STREET_LAMP_UNDERSIDE_V286 = 0x646d63;
const TINT = { pole: 0x969f99, collar: 0xa2a9a2, controller: 0x858e87, arm: 0x8e9890, rim: 0x89948b, back: 0xa6ada4 };
export const GOVERNMENT_STREET_LAMPS_V286 = {
  photoEvidenceId: "government-district-streetlamps-owner-photos-v286",
  sourcePhotoNumbers: [2, 3, 5, 6, 7],
  geometryStatus: "Passed anchors and any passed heights retain source ownership; slender taper, S-neck, tilted dished head and material tones are owner-photo display estimates, not a manufacturer identification or survey",
  maxAnchorsPerAppend: 64,
  overallHeightM: 7.22,
  postHeightM: 5.4,
  headRadiusXM: 1.05,
  headRadiusZM: .82,
  headCentreXM: -.58,
  headCentreYM: 6.69,
  headTiltDegrees: 25,
  dishDepthM: .045,
  sheetThicknessM: .045,
  nativeCellM: .32,
  fullStaticDetailOnTouch: true,
  textureFree: true,
  sourceGeometryRetained: true,
  automaticOldLampRetirement: false,
} as const;

const P = GOVERNMENT_STREET_LAMPS_V286;
const slope = Math.tan(P.headTiltDegrees * Math.PI / 180);
function dishY(x: number, z: number): number {
  const radius2 = ((x - P.headCentreXM) / P.headRadiusXM) ** 2 + (z / P.headRadiusZM) ** 2;
  return P.headCentreYM - (x - P.headCentreXM) * slope + P.dishDepthM * Math.max(0, 1 - radius2);
}
function circle(radiusX: number, radiusZ: number, centreX: number, count: number): number[][] {
  return Array.from({ length: count }, (_, i) => {
    const angle = i * Math.PI * 2 / count;
    return [centreX + radiusX * Math.cos(angle), radiusZ * Math.sin(angle)];
  });
}
const rim = circle(P.headRadiusXM, P.headRadiusZM, P.headCentreXM, 24);
const centrePlate = circle(P.headRadiusXM * .30, P.headRadiusZM * .30, P.headCentreXM, 12);

/** Add only explicitly supplied lamps to the host's shared static batches.
 * This module neither chooses positions nor removes earlier street furniture.
 * Return value counts host primitive callbacks, not extra meshes or lights.
 */
export function appendGovernmentStreetLampsV286(
  parts: GovernmentStreetLampPartsV286,
  terrainAt: (x: number, z: number) => number,
  anchors: readonly GovernmentStreetLampAnchorV286[],
): number {
  if (anchors.length > P.maxAnchorsPerAppend) throw new RangeError("Street-lamp append exceeds its bounded anchor inventory");
  const ids = new Set<string>();
  // Validate the whole input before writing to a shared batch.
  for (const a of anchors) {
    if (!a.id || ids.has(a.id) || ![a.x, a.z, a.yawRadians, a.heightM ?? P.overallHeightM].every(Number.isFinite) || (a.heightM ?? P.overallHeightM) <= 0) throw new Error("Street-lamp anchors require unique IDs and finite coordinates/heights");
    ids.add(a.id);
  }
  const grounds = anchors.map(a => terrainAt(a.x, a.z));
  if (!grounds.every(Number.isFinite)) throw new Error("Street-lamp ground must be finite at every source anchor");
  let emitted = 0;
  for (let ai = 0; ai < anchors.length; ai++) {
    const a = anchors[ai], ground = grounds[ai], height = a.heightM ?? P.overallHeightM, sy = height / P.overallHeightM;
    const c = Math.cos(a.yawRadians), s = Math.sin(a.yawRadians);
    const at = (x: number, y: number, z = 0): Vec => [a.x + c * x + s * z, ground + y * sy, a.z - s * x + c * z];
    const localXZ = (x: number, z: number): [number, number] => [(x - a.x) * c - (z - a.z) * s, (x - a.x) * s + (z - a.z) * c];
    const box = (position: Vec, size: Vec, tint: number, yaw = 0) => { parts.box(position, size, tint, yaw); emitted++; };
    const beam = (p: Vec, q: Vec, width: number, memberHeight: number, tint: number) => { parts.beam(p, q, width, memberHeight, tint); emitted++; };
    const plate = (outer: number[][], holes: number[][][], y: (x: number, z: number) => number, tint: number) => {
      const worldRing = (ring: number[][]) => ring.map(p => { const q = at(p[0], 0, p[1]); return [q[0], q[2]]; });
      parts.polygon(worldRing(outer), holes.map(worldRing), (x, z) => { const p = localXZ(x, z); return ground + y(p[0], p[1]) * sy; }, tint); emitted++;
    };
    const courses = parts.native ? 4 : 6;
    for (let i = 0; i < courses; i++) {
      const h = P.postHeightM / courses, width = .285 - .085 * (i + .5) / courses;
      box(at(0, (i + .5) * h), [width, (h + .006) * sy, width], TINT.pole, parts.native ? 0 : a.yawRadians);
    }
    // The small separate controller/collar is visible immediately below the
    // S-neck. Its cap is cylindrical in drawn modes and square in native.
    if (parts.native) {
      box(at(0, 5.45), [.32, .42 * sy, .32], TINT.collar);
    } else {
      const collar = circle(.15, .15, 0, 12);
      for (let i = 0; i < collar.length; i++) { const p = collar[i], q = collar[(i + 1) % collar.length]; beam(at(p[0], 5.45, p[1]), at(q[0], 5.45, q[1]), .035, .42 * sy, TINT.collar); }
      plate(collar, [], () => 5.66, TINT.collar);
    }
    box(at(-.11, 5.23, .035), [.13, .22 * sy, .19], TINT.controller, parts.native ? 0 : a.yawRadians);
    const armEnd: Vec = [.44, dishY(.44, 0), 0];
    if (parts.native) {
      // An independent connected stair profile, never rotated smooth beams.
      const steps: Vec[] = [[.12, 5.36, 0], [.12, 5.56, 0], [.24, 5.72, 0], [.38, 5.86, 0], [.46, 6.02, 0], [.44, 6.16, 0], armEnd];
      for (let i = 1; i < steps.length; i++) {
        const p = at(...steps[i - 1]), q = at(...steps[i]);
        box([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], [Math.abs(q[0] - p[0]) + .12, Math.abs(q[1] - p[1]) + .12 * sy, Math.abs(q[2] - p[2]) + .12], TINT.arm);
      }
      const centre = at(P.headCentreXM, 0), cell = P.nativeCellM;
      const halfX = Math.hypot(P.headRadiusXM * c, P.headRadiusZM * s), halfZ = Math.hypot(P.headRadiusXM * s, P.headRadiusZM * c);
      for (let ix = -Math.ceil(halfX / cell); ix <= Math.ceil(halfX / cell); ix++) for (let iz = -Math.ceil(halfZ / cell); iz <= Math.ceil(halfZ / cell); iz++) {
        const x = centre[0] + ix * cell, z = centre[2] + iz * cell, local = localXZ(x, z);
        const radius2 = ((local[0] - P.headCentreXM) / P.headRadiusXM) ** 2 + (local[1] / P.headRadiusZM) ** 2;
        if (radius2 > 1) continue;
        const y = ground + dishY(...local) * sy;
        box([x, Math.min(ground + height - .06 * sy, y + .03 * sy), z], [cell, .12 * sy, cell], radius2 > .76 ? TINT.rim : TINT.back);
        box([x, y - .09 * sy, z], [cell, .12 * sy, cell], GOVERNMENT_STREET_LAMP_UNDERSIDE_V286);
      }
      box(at(.38, dishY(.38, 0) - .025), [.23, .16 * sy, .23], TINT.rim);
    } else {
      const path = new CatmullRomCurve3([new Vector3(.12, 5.36, 0), new Vector3(.13, 5.58, 0), new Vector3(.39, 5.84, 0), new Vector3(.47, 6.02, 0), new Vector3(...armEnd)]).getPoints(12);
      for (let i = 1; i < path.length; i++) { const p = path[i - 1], q = path[i]; beam(at(p.x, p.y, p.z), at(q.x, q.y, q.z), .075, .075 * sy, TINT.arm); }
      for (let i = 0; i < rim.length; i++) { const p = rim[i], q = rim[(i + 1) % rim.length]; beam(at(p[0], dishY(...p as [number, number]), p[1]), at(q[0], dishY(...q as [number, number]), q[1]), .035, .04 * sy, TINT.rim); }
      // The two nested rings supply actual shallow dish geometry, while the
      // central cap and thin dark underside retain distinct front/back reads.
      for (const underside of [false, true]) {
        const heightAt = (x: number, z: number) => dishY(x, z) - (underside ? P.sheetThicknessM : 0);
        const tint = underside ? GOVERNMENT_STREET_LAMP_UNDERSIDE_V286 : TINT.back;
        plate(rim, [centrePlate], heightAt, tint); plate(centrePlate, [], heightAt, tint);
      }
    }
  }
  return emitted;
}
