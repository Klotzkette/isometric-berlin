/** Verified memorial models on actual currently resident terrain. */
import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial,
} from "three";
import source from "./data/namedGravesV347.json";
import wallSource from "./data/wallMarkersV352.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";

type Solid = { ring: number[][]; low: number; high: number };
type Model = { mesh: { positions: string; colors: string; indices: string }; solids: Solid[]; bounds: number[] };
type Site = { key: string; id: string; name: string; anchor: number[]; models: { drawn: Model; minecraft: Model } };
export type NamedGraveSupportV347 = {
  ground: (x: number, z: number) => number | null;
  water: (x: number, z: number) => boolean;
  blocked: (x: number, y: number, z: number) => boolean;
};
export const NAMED_GRAVE_SITES_V347 = source.sites as Site[];
export const WALL_MARKER_SITES_V352 = wallSource.sites as Site[];
// The three 180 m admission disks are pairwise disjoint (source receipt/test).
// They share the original controller, one live mesh/material and no new timer.
const MEMORIAL_SITES = [...NAMED_GRAVE_SITES_V347, ...WALL_MARKER_SITES_V352];
const RADIUS = 180;

export function namedGraveGeometryV347(model: Model): BufferGeometry {
  const positions = new Uint16Array(decodeBase64Bytes(model.mesh.positions).buffer);
  const colors = decodeBase64Bytes(model.mesh.colors);
  const indices = new Uint32Array(decodeBase64Bytes(model.mesh.indices).buffer);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Rounded centimetre faces and the collision rings use the same coordinates. */
function contains(ring: number[][], x: number, z: number, radius: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
    const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length2)) : 0;
    if ((x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2 <= Math.max(radius, 1e-6) ** 2) return true;
  }
  return inside;
}

type Active = { site: Site; native: boolean; y: number; mesh: Mesh; model: Model };

export function createNamedGravesV347() {
  const root = new Group();
  root.name = "Verified graves and Wall memorial locations";
  root.userData.textureFree = true;
  const active = new Map<string, Active>();
  let samplingSupport = false;

  function release(key: string): void {
    const entry = active.get(key);
    if (!entry) return;
    entry.mesh.removeFromParent();
    entry.mesh.geometry.dispose();
    (entry.mesh.material as MeshStandardMaterial).dispose();
    active.delete(key);
  }

  function releaseAll(): boolean {
    const changed = active.size > 0;
    for (const key of active.keys()) release(key);
    return changed;
  }

  function supportHeight(site: Site, native: boolean, support: NamedGraveSupportV347): number | null {
    const [x, z] = site.anchor;
    const y = support.ground(x, z);
    if (y === null || !Number.isFinite(y)) return null;
    // The outer rim and every corner matter: a centre-only check can bridge an
    // unloaded tile, path edge or Native terrain step. No guessed Y fallback.
    const model = site.models[native ? "minecraft" : "drawn"];
    const [minX, minZ, maxX, maxZ] = model.bounds;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
      const sx = x + minX + (maxX - minX) * i / 4;
      const sz = z + minZ + (maxZ - minZ) * j / 4;
      const floor = support.ground(sx, sz);
      if (floor === null || !Number.isFinite(floor) || Math.abs(floor - y) > .06 ||
        support.water(sx, sz) || support.blocked(sx, floor, sz)) return null;
    }
    return y;
  }

  return {
    root,
    refresh(x: number, z: number, native: boolean, support: NamedGraveSupportV347): boolean {
      let changed = false;
      for (const site of MEMORIAL_SITES) {
        const nearby = (site.anchor[0] - x) ** 2 + (site.anchor[1] - z) ** 2 <= RADIUS ** 2;
        let y: number | null = null;
        // Existing model solids must not reject their own source floor on the
        // next scan. All unrelated world obstacles still participate normally.
        samplingSupport = true;
        try { y = nearby ? supportHeight(site, native, support) : null; }
        finally { samplingSupport = false; }
        const old = active.get(site.key);
        if (old && (y === null || old.native !== native || Math.abs(old.y - y) > .001)) {
          release(site.key);
          changed = true;
        }
        if (y === null || active.has(site.key)) continue;
        const model = site.models[native ? "minecraft" : "drawn"];
        const mesh = new Mesh(namedGraveGeometryV347(model), new MeshStandardMaterial({
          vertexColors: true, roughness: .9, metalness: 0, side: DoubleSide,
        }));
        mesh.name = site.name;
        mesh.scale.setScalar(.01);
        mesh.position.set(site.anchor[0] - 4, y - 10, site.anchor[1] - 4);
        mesh.userData = { textureFree: true, blockNative: native, nativeMinecraft: native, sourceId: site.id };
        mesh.updateMatrix();
        mesh.matrixAutoUpdate = false;
        root.add(mesh);
        active.set(site.key, { site, native, y, mesh, model });
        changed = true;
      }
      return changed;
    },
    solidAt(x: number, y: number, z: number, radius: number, native: boolean): boolean {
      if (samplingSupport || !root.parent || !root.visible || !root.parent.visible) return false;
      for (const entry of active.values()) {
        if (entry.native !== native) continue;
        const dx = x - entry.site.anchor[0], dz = z - entry.site.anchor[1], dy = y - entry.y;
        if (Math.abs(dx) > 4 + radius || Math.abs(dz) > 4 + radius) continue;
        for (const solid of entry.model.solids) if (dy >= solid.low && dy <= solid.high && contains(solid.ring, dx, dz, radius)) return true;
      }
      return false;
    },
    release: releaseAll,
    dispose(): void { releaseAll(); root.removeFromParent(); },
  };
}
