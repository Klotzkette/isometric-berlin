import {
  BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";
import { EUROPACITY_PROFILE } from "./expandedCityProfiles";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { hbfNorthPointInRing } from "./HbfNorthApproachProfile";

type Point = readonly [number, number];
const campus = EUROPACITY_PROFILE.upbeat;
const capHeight = 1.63;
const capBaseY = campus.groundY + campus.heightM - 4.15;
const cyan = 0x36bbeb;

// Official DKB campus view STAND-035 shows two sets of mounted blue letters.
// Anchor to the two visible facade edges of the existing source footprint.
export const DKB_LETTERING_V313 = {
  source: "https://www.dkb.de/presse/mediathek",
  photo: "STAND-035_3981x2250.jpg",
  street: "Heidestraße 26–28",
  faceSegments: [
    { start: [-644.37, -1947.76] as Point, end: [-629.73, -1943.02] as Point, proportion: 0.75 },
    { start: [-623.38, -1944.75] as Point, end: [-619.79, -1955.11] as Point, proportion: 0.73 },
  ],
} as const;

function nativeCellFaces(): Point[] {
  const ring = campus.footprintWorldM;
  const minX = Math.min(...ring.map(point => point[0]));
  const minZ = Math.min(...ring.map(point => point[1]));
  const maxX = Math.max(...ring.map(point => point[0]));
  const maxZ = Math.max(...ring.map(point => point[1]));
  const cells: Point[] = [];
  for (let x = minX + 1.5; x < maxX; x += 3) {
    for (let z = minZ + 1.5; z < maxZ; z += 3) {
      if (x >= campus.towerTierEastClipWorldX && hbfNorthPointInRing(x, z, ring)) cells.push([x, z]);
    }
  }
  return cells;
}

export function createDkbLetteringV313(native = false): Group {
  const root = new Group();
  // Preserve the existing lookup name for landmark controls.
  root.name = "DKB rooftop lettering";
  root.userData = { ...DKB_LETTERING_V313, lettering: "DKB", blockNative: native, keepInMinecraft: native, textureFree: true };
  const glyphs = letteringStrokePaths("DKB", capHeight);
  const cells = native ? nativeCellFaces() : [];
  const geometry = new BoxGeometry();
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: cyan });
  const night = new MeshStandardMaterial({ color: cyan, emissive: cyan, emissiveIntensity: 0.38, roughness: 0.7 });
  const forward = new Vector3(0, 0, 1);
  for (const [faceIndex, face] of DKB_LETTERING_V313.faceSegments.entries()) {
    const dx = face.end[0] - face.start[0], dz = face.end[1] - face.start[1];
    const length = Math.hypot(dx, dz), tx = dx / length, tz = dz / length;
    const nx = -tz, nz = tx;
    const centreX = face.start[0] + dx * face.proportion, centreZ = face.start[1] + dz * face.proportion;
    const at = (u: number, y: number) => new Vector3(centreX + tx * u + nx * 0.18, capBaseY + y, centreZ + tz * u + nz * 0.18);
    const members: Matrix4[] = [];
    const emitted = new Set<string>();
    const useX = Math.abs(nx) > Math.abs(nz);
    const normalIndex = useX ? 0 : 1, tangentIndex = useX ? 1 : 0;
    const outward = Math.sign(useX ? nx : nz);
    for (const path of glyphs) {
      for (let i = 1; i < path.length; i++) {
        const a = at(...path[i - 1]), b = at(...path[i]);
        const direction = b.clone().sub(a);
        const span = direction.length();
        if (span <= 0.001) continue;
        if (!native) {
          members.push(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(forward, direction.normalize()), new Vector3(0.25, 0.25, span + 0.21)));
          continue;
        }
        const steps = Math.ceil(span / 0.12);
        for (let step = 0; step <= steps; step++) {
          const p = a.clone().lerp(b, step / steps);
          const plan = [p.x, p.z];
          let surface = -Infinity;
          for (const cell of cells) {
            if (Math.abs(plan[tangentIndex] - cell[tangentIndex]) > 1.49) continue;
            const edge = cell[normalIndex] * outward + 1.44;
            if (Math.abs(edge - plan[normalIndex] * outward) < 2.1) surface = Math.max(surface, edge);
          }
          if (!Number.isFinite(surface)) continue;
          plan[normalIndex] = (surface + 0.10) * outward;
          plan[tangentIndex] = Math.round(plan[tangentIndex] / 0.16) * 0.16;
          p.set(plan[0], Math.round(p.y / 0.16) * 0.16, plan[1]);
          const key = `${p.x},${p.y},${p.z}`;
          if (emitted.has(key)) continue;
          emitted.add(key);
          members.push(new Matrix4().compose(p, new Quaternion(), new Vector3(0.22, 0.22, 0.22)));
        }
      }
    }
    const letters = new InstancedMesh(geometry, day, members.length);
    letters.name = `DKB cyan facade letters ${faceIndex + 1}`;
    members.forEach((matrix, i) => letters.setMatrixAt(i, matrix));
    letters.userData = { dayMaterial: day, nightMaterial: night, keepInMinecraft: native, blockNative: native };
    letters.computeBoundingSphere();
    root.add(letters);
  }
  return freezeStaticSceneTransforms(root);
}
