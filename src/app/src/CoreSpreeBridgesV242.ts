import { Group, Material, Mesh, type Object3D } from "three";
import { createSurroundingCityChunk, type SurroundingNavigation } from "./SurroundingCityGeometry";
import { spreeBridgeCoreOwnerV242, spreeBridgeCorePacketsV242, spreeBridgeFloorAtV242,
  spreeBridgeSolidAtV242, type SpreeBridgeCorePacketV242 } from "./SpreeBridgesV242";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { VoxelPayload } from "./terrainPayload";
import type { VisualMode } from "./visualMode";

const DRAWN = "Mapped core Spree bridges v242 drawn";
const NATIVE = "Mapped core Spree bridges v242 native";
type Resident = { origin: [number, number, number]; nav: SurroundingNavigation;
  bounds: [number, number, number, number] };
type Pair = { drawn: Resident; native: Resident };
type Holder = { pairs: Pair[] };
// Navigation is compiled before geometry. Its small holder is filled only after
// both complete families decode; callbacks never retain the terrain payload.
const residents = new WeakMap<VoxelPayload, Holder>();
const rootResidents = new WeakMap<Object3D, Holder>();
function holderFor(ground: VoxelPayload): Holder {
  let holder = residents.get(ground);
  if (!holder) { holder = { pairs: [] }; residents.set(ground, holder); }
  return holder;
}

function resident(origin: [number, number, number], nav: SurroundingNavigation): Resident {
  const bounds: Resident["bounds"] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of [...nav.spreeBridgesV242!.floors, ...nav.spreeBridgesV242!.solids]) for (const [x, z] of p.ring) {
    bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], z);
    bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], z);
  }
  return { origin: [...origin], nav, bounds };
}

function near(p: Resident, x: number, z: number, radius = 0): boolean {
  return x + radius >= p.bounds[0] && x - radius <= p.bounds[2] &&
    z + radius >= p.bounds[1] && z - radius <= p.bounds[3];
}

function dispose(root: Group): void {
  const materials = new Set<Material>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    for (const value of Object.values(object.userData)) if (value instanceof Material) materials.add(value);
  });
  for (const material of materials) material.dispose();
  root.clear();
}

function decode(packet: SpreeBridgeCorePacketV242, native: boolean) {
  if (packet.meshes.length !== 1 || packet.meshes[0].kind !== "spree-bridges-v242" ||
      !packet.nav.spreeBridgesV242?.floors.length) throw new Error("Incomplete core bridge owner");
  const built = createSurroundingCityChunk(packet, `spree-core-v242-${packet.owner}`, native);
  const mesh = built.root.children[0];
  // A source owner is replaced only by its complete decoded group, never by an
  // empty named shell or a partial family. Decoder validates every source index.
  const bytes = (value: string) => value.length / 4 * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  if (built.root.children.length !== 1 || !(mesh instanceof Mesh) ||
      mesh.geometry.getAttribute("position").count !== bytes(packet.meshes[0].positions) / 6 ||
      !mesh.geometry.index?.count || mesh.geometry.index.count !== bytes(packet.meshes[0].indices) / 4) {
    dispose(built.root); throw new Error("Incomplete decoded core bridge");
  }
  built.root.userData.spreeBridgeOwnerV242 = packet.owner;
  built.root.userData.spreeBridgeNameV242 = packet.name;
  return built;
}

export function createCoreSpreeBridgesV242(ground: VoxelPayload,
  loadPackets = spreeBridgeCorePacketsV242) {
  const root = new Group(); root.name = "Mapped core Spree bridges v242";
  const drawn = new Group(); drawn.name = DRAWN;
  const native = new Group(); native.name = NATIVE; native.visible = false;
  root.add(drawn, native);
  const holder = holderFor(ground); holder.pairs = [];
  rootResidents.set(root, holder);
  const owners: string[] = [], failed: string[] = [];
  // The source module lazily parses a lossless literal. Read each mode only
  // once per construction transaction, and release encoded bodies afterwards.
  let drawnPackets: SpreeBridgeCorePacketV242[] | undefined;
  let nativePackets: SpreeBridgeCorePacketV242[] | undefined;
  root.userData.sourceOwnersV242 = owners;
  root.userData.failedOwnersV242 = failed;
  root.userData.geometryBytesV242 = 0;
  return {
    root,
    /** Caller must first exclude the independently authored named profiles. */
    replace(cluster: Array<[number, number]>): boolean {
      const owner = spreeBridgeCoreOwnerV242(ground, cluster);
      if (!owner || owners.includes(owner)) return false;
      let first: ReturnType<typeof decode> | undefined;
      let second: ReturnType<typeof decode> | undefined;
      try {
        const a = (drawnPackets ??= loadPackets(false)).filter(p => p.owner === owner);
        const b = (nativePackets ??= loadPackets(true)).filter(p => p.owner === owner);
        if (a.length !== 1 || b.length !== 1) return false;
        first = decode(a[0], false); second = decode(b[0], true);
        drawn.add(first.root); native.add(second.root);
        holder.pairs.push({ drawn: resident(first.origin, first.nav),
          native: resident(second.origin, second.nav) });
        owners.push(owner);
        root.userData.geometryBytesV242 += first.geometryBytes + second.geometryBytes;
        return true;
      } catch {
        if (first) dispose(first.root);
        if (second) dispose(second.root);
        failed.push(owner);
        return false; // The entire old generic owner remains as the fallback.
      }
    },
    finish(): Group { return freezeStaticSceneTransforms(root); },
  };
}

export function setCoreSpreeBridgePresentationV242(root: Object3D, mode: VisualMode): void {
  const drawn = root.getObjectByName(DRAWN), native = root.getObjectByName(NATIVE);
  if (drawn) drawn.visible = mode !== "minecraft";
  if (native) native.visible = mode === "minecraft";
}

export function createCoreSpreeBridgeNavigationV242(ground: VoxelPayload, visualMode: () => VisualMode,
  existingRoot?: Object3D) {
  const holder = holderFor(ground);
  // A cold native visit can later build drawn terrain while reusing the same
  // signature bridges. Bind the new terrain's early callbacks to that actual
  // published root instead of reconstructing or trusting unbuilt source data.
  const reused = existingRoot?.getObjectByName("Mapped core Spree bridges v242");
  const existing = reused && rootResidents.get(reused);
  if (existing) holder.pairs = existing.pairs;
  return {
    floorAt(x: number, z: number): number | null {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      let top: number | null = null;
      for (const pair of holder.pairs) {
        const p = visualMode() === "minecraft" ? pair.native : pair.drawn;
        const localX = x - p.origin[0], localZ = z - p.origin[2];
        if (!near(p, localX, localZ)) continue;
        const y = spreeBridgeFloorAtV242(p.nav, localX, localZ);
        if (y !== null) top = Math.max(top ?? -Infinity, y);
      }
      return top;
    },
    solidAt(x: number, y: number, z: number, radius = 0): boolean {
      if (![x, y, z, radius].every(Number.isFinite) || radius < 0) return false;
      return holder.pairs.some(pair => {
        const p = visualMode() === "minecraft" ? pair.native : pair.drawn;
        const localX = x - p.origin[0], localZ = z - p.origin[2];
        return near(p, localX, localZ, radius) && spreeBridgeSolidAtV242(p.nav, localX, y, localZ, radius);
      });
    },
  };
}
