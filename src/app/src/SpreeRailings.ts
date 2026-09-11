import {
  BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  Quaternion, Vector3,
} from "three";
import source from "./data/spreeRailings.json";
import { districtStreetTerrainSampler } from "./DistrictStreets";
import type { VoxelPayload } from "./MinecraftVoxelWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const SPREE_RAILING_NAME = "Mapped Spree bank railings";
export const SPREE_RAILING_MAX_INSTANCES = 12_000;
type Member = { a: Vector3; b: Vector3; width: number; color: number };

/** Actual OSM courses; only the unmeasured rail members are display subdivisions. */
export function createSpreeRailings(ground: VoxelPayload, blockMode = false): Group {
  const root = new Group(); root.name = SPREE_RAILING_NAME;
  root.userData.source = source.source;
  root.userData.sourceRunIds = source.rails.map(rail => rail.id);
  root.userData.blockNative = blockMode;
  const terrainAt = districtStreetTerrainSampler(ground);
  const members: Member[] = [];
  const add = (a: Vector3, b: Vector3, width: number, color: number): void => {
    if (a.distanceToSquared(b) > 0.0001) members.push({ a, b, width, color });
  };
  for (const rail of source.rails) {
    const height = rail.height_m;
    const color = 0x39413c;
    const postWidth = blockMode ? 0.125 : 0.075;
    const barWidth = blockMode ? 0.09 : 0.045;
    let first = true;
    for (let i = 1; i < rail.points_m.length; i++) {
      const [ax, az] = rail.points_m[i - 1], [bx, bz] = rail.points_m[i];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.01) continue;
      const nx = -(bz - az) / length, nz = (bx - ax) / length;
      const point = (t: number): Vector3 => {
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        // Sample the land side of the thin source barrier, instead of letting
        // a shoreline interpolation sink its foot into the adjacent water.
        const y = Math.max(terrainAt(x, z), terrainAt(x + nx * 0.6, z + nz * 0.6),
          terrainAt(x - nx * 0.6, z - nz * 0.6)) + 0.11;
        return new Vector3(x, y, z);
      };
      const panels = Math.max(1, Math.ceil(length / 2.4));
      for (let panel = 0; panel < panels; panel++) {
        const a = point(panel / panels), b = point((panel + 1) / panels);
        if (first) {
          add(a.clone(), a.clone().add(new Vector3(0, height + 0.035, 0)), postWidth, color);
          first = false;
        }
        add(b.clone(), b.clone().add(new Vector3(0, height + 0.035, 0)), postWidth, color);
        for (const lift of [0.19, height]) {
          add(a.clone().add(new Vector3(0, lift, 0)), b.clone().add(new Vector3(0, lift, 0)),
            barWidth, color);
        }
        const bars = Math.max(2, Math.ceil(length / panels / (blockMode ? 0.28 : 0.2)));
        for (let bar = 1; bar < bars; bar++) {
          const base = a.clone().lerp(b, bar / bars);
          add(base.clone().add(new Vector3(0, 0.19, 0)), base.clone().add(new Vector3(0, height, 0)),
            blockMode ? 0.075 : 0.025, color);
        }
      }
    }
  }
  if (members.length > SPREE_RAILING_MAX_INSTANCES) throw new Error("Spree railing instance budget exceeded");
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshBasicMaterial({ color: 0x778491 });
  const mesh = new InstancedMesh(geometry, day, members.length);
  mesh.name = `${SPREE_RAILING_NAME} members`;
  mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  const matrix = new Matrix4(), rotation = new Quaternion(), scale = new Vector3();
  const up = new Vector3(0, 1, 0), center = new Vector3(), direction = new Vector3(), color = new Color();
  members.forEach((member, i) => {
    direction.subVectors(member.b, member.a);
    scale.set(member.width, direction.length(), member.width);
    rotation.setFromUnitVectors(up, direction.normalize());
    center.addVectors(member.a, member.b).multiplyScalar(0.5);
    mesh.setMatrixAt(i, matrix.compose(center, rotation, scale));
    mesh.setColorAt(i, color.setHex(member.color));
  });
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  root.add(mesh);
  root.userData.memberCount = members.length;
  return freezeStaticSceneTransforms(root);
}
