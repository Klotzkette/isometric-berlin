import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import type { SurroundingChunkGeometry, SurroundingNavigation } from "./SurroundingCityGeometry";

export const jannowitzHostsV380: ReadonlySet<string> = new Set(["5_0", "5_1", "6_1"]);

type Part = { name: string; n: number; i: number; data: string };
type Packet = { parts: Part[] } & NonNullable<SurroundingNavigation["spreeBridgesV242"]>;

export async function attachJannowitzV380(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
  if (!jannowitzHostsV380.has(id) || signal.aborted || entry.root.userData.jannowitzV380) return;
  const [tileX, tileZ] = id.split("_").map(Number);
  if (entry.origin[0] !== 512 * tileX || entry.origin[1] !== -10 || entry.origin[2] !== 512 * tileZ) return;
  const file = (native ? "native_" : "drawn_") + id;
  const packet: Packet = (await import(`./data/jannowitzV380/${file}.json`)).default;
  if (signal.aborted || entry.root.userData.jannowitzV380) return;
  entry.root.userData.jannowitzV380 = true;
  for (const part of packet.parts) {
    const { n, i } = part;
    if (n < 1 || n > 65535 || i < 3 || i % 3 || i > 300000) throw Error("Ungültige Jannowitz-Geometrie");
    const packed = gunzipSync(decodeBase64Bytes(part.data), { out: new Uint8Array(9 * n + 2 * i) });
    const xyz = new Uint16Array(3 * n), indices = new Uint16Array(i);
    for (let axis = 0; axis < 3; axis++) {
      let value = 0;
      for (let v = 0; v < n; v++) {
        const j = axis * n + v;
        value = (value + packed[j] + (packed[3 * n + j] << 8)) & 65535;
        xyz[3 * v + axis] = value;
      }
    }
    let value = 0;
    for (let j = 0; j < i; j++) {
      value = (value + packed[9 * n + j] + (packed[9 * n + i + j] << 8)) & 65535;
      if (value >= n) throw Error("Ungültiger Jannowitz-Dreiecksindex");
      indices[j] = value;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(xyz, 3));
    g.setAttribute("color", new BufferAttribute(packed.slice(6 * n, 9 * n), 3, true));
    g.setIndex(new BufferAttribute(indices, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const night = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide, roughness: .9 });
    const day = native ? night : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const mesh = new Mesh(g, day);
    mesh.name = part.name;
    mesh.scale.setScalar(.01);
    if (id === "5_0") mesh.position.set(2650, -2, 400);
    else mesh.position.set(3000, -2, 500);
    mesh.userData = { dayMaterial: day, nightMaterial: night, jannowitzV380: true, keepInMinecraft: native };
    attachWorldSpaceDetail(entry, mesh);
  }
  if (packet.solids.length) {
    const existing = entry.nav.spreeBridgesV242 ?? { floors: [], solids: [] };
    entry.nav.spreeBridgesV242 = { floors: [...existing.floors, ...packet.floors], solids: [...existing.solids, ...packet.solids] };
  }
}
