import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { MOABIT_COAL_V281 as P, moabitCoalFacetsV281, moabitCoalFloorV281At, moabitCoalMembersV281, moabitCoalNativeMembersV281, type CoalBoxV281 } from './moabitCoalV281Profile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

const COAL = [0x343a39, 0x3e4543, 0x303735, 0x454b48, 0x373e3b];
function material(vertexColors = true) {
  return { dayMaterial: new MeshBasicMaterial({ vertexColors, side: DoubleSide }), nightMaterial: new MeshStandardMaterial({ vertexColors, roughness: .96, flatShading: true, side: DoubleSide }) };
}

function heap(): Mesh {
  const positions: number[] = [], tones: number[] = [], color = new Color();
  const emit = (vertices: number[][], tone: number) => { for (const p of vertices) { positions.push(...p); color.setHex(tone).toArray(tones, tones.length); } };
  const ring = P.heap.ring.slice(0, -1).map(([x, z]) => [x, P.groundY + .045, z]);
  emit([ring[0], ring[1], ring[2], ring[0], ring[2], ring[3]], COAL[0]);
  moabitCoalFacetsV281().forEach((triangle, index) => emit(triangle, COAL[index % COAL.length]));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(tones), 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const materials = material(), mesh = new Mesh(geometry, materials.dayMaterial);
  mesh.name = 'Mapped open Moabit coal heap with estimated faceted stockpiles';
  mesh.userData = { ...materials, textureFree: true };
  return mesh;
}

function instances(native: boolean): InstancedMesh {
  const matrices: number[] = [], tones: number[] = [], matrix = new Matrix4(), color = new Color();
  const put = (m: Matrix4, tone: number) => { matrices.push(...m.elements); color.setHex(tone).toArray(tones, tones.length); };
  if (native) {
    const rows: CoalBoxV281[] = moabitCoalNativeMembersV281(), step = P.nativeCell;
    for (let z = -2148; z < -2062; z += step) {
      let run: { start: number; end: number; top: number; tone: number } | undefined;
      const flush = () => { if (run) rows.push([(run.start + run.end) / 2, (P.groundY + run.top) / 2, z + step / 2, run.end - run.start, run.top - P.groundY, step, run.tone]); run = undefined; };
      for (let x = -1574; x < -1458; x += step) {
        const y = moabitCoalFloorV281At(x + step / 2, z + step / 2, true), tone = COAL[Math.abs(Math.round((y ?? 0) * 4)) % COAL.length];
        if (y === null) { flush(); continue; }
        if (run && run.top === y && run.tone === tone) run.end = x + step;
        else { flush(); run = { start: x, end: x + step, top: y, tone }; }
      }
      flush();
    }
    for (const [x, y, z, w, h, d, tone] of rows) { matrix.makeScale(w, h, d); matrix.setPosition(x, y, z); put(matrix, tone); }
  } else {
    for (const p of moabitCoalMembersV281()) {
      const along = new Vector3(...p.b).sub(new Vector3(...p.a)), length = along.length(); along.normalize();
      const side = Math.hypot(along.x, along.z) > 1e-9 ? new Vector3(along.z, 0, -along.x).normalize() : new Vector3(1, 0, 0);
      const depth = new Vector3().crossVectors(side, along);
      matrix.makeBasis(side, along, depth); matrix.scale(new Vector3(p.width, length, p.depth));
      matrix.setPosition((p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2); put(matrix, p.tone);
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv'); geometry.deleteAttribute('normal');
  // The boxes carry instanceColor, not a per-vertex color attribute. Enabling
  // both would multiply their real colour by the missing (black) vertex value.
  const materials = material(false), mesh = new InstancedMesh(geometry, materials.dayMaterial, 0);
  mesh.count = matrices.length / 16;
  mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(tones), 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = native ? 'Moabit independent cardinal coal yard, conveyor and open cranes' : 'Moabit coal handling: open trusses, rails, trolley, grabs and conveyors';
  mesh.userData = { ...materials, textureFree: true, nativeMinecraft: native, keepInMinecraft: native, blockNative: native };
  return mesh;
}

/** Purely additive: full mobile detail, no source retirement or new descriptors. */
export function createMoabitCoalV281(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = 'Moabit coal unloading, stockyard and travelling bridge — v281';
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true, nativeMinecraft: native, keepInMinecraft: native, blockNative: native, sourceIds: [P.heap.id, P.craneTravel.id, P.shipUnloader.id, P.quayConveyor.id, P.roadConveyor.id, P.yardConveyor.id], sourceInterpretation: P.interpretation };
  if (!native) root.add(heap()); root.add(instances(native));
  return freezeStaticSceneTransforms(root);
}
