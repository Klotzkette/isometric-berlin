import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Sphere,
  IcosahedronGeometry,
  Float32BufferAttribute,
  type Vector3,
} from "three";
import first from "./data/tiergartenTreeFirstV379.json";

type Family = 0 | 1;
type Block = [number, number, Family, number, string];
type Stand = {
  group: Group;
  legacy: Group;
  cells: Map<string, Group>;
  focus: string;
  queue: Block[];
};
const firstBlocks = first.blocks as Block[];
const styles = first.styles;
const stride = 15;
const maxDetailedCells = 9;
const turns = Array.from({ length: 12 }, (_, i) => [
  Math.cos((i * Math.PI) / 6),
  Math.sin((i * Math.PI) / 6),
]);

/** Three lobes from the botanical broadleaf profile, in one 60-triangle draw primitive. */
function firstLeafCrown(): BufferGeometry {
  const lobe = new IcosahedronGeometry(1, 0);
  const corners = lobe.getAttribute("position");
  const points: number[] = [];
  for (const [x, y, z, r] of [
    [-0.3, -0.04, 0.13, 0.84],
    [0.29, 0.12, -0.17, 0.84],
    [0.01, 0.72, 0.01, 0.56],
  ]) {
    for (let i = 0; i < corners.count; i++) {
      points.push(
        x + r * corners.getX(i),
        y + 0.75 * r * corners.getY(i),
        z + r * corners.getZ(i),
      );
    }
  }
  lobe.dispose();
  const crown = new BufferGeometry();
  crown.setAttribute("position", new Float32BufferAttribute(points, 3));
  crown.center();
  const vertices = crown.getAttribute("position");
  let radius = 0,
    halfHeight = 0;
  for (let i = 0; i < vertices.count; i++) {
    radius = Math.max(radius, Math.hypot(vertices.getX(i), vertices.getZ(i)));
    halfHeight = Math.max(halfHeight, Math.abs(vertices.getY(i)));
  }
  crown.scale(1 / radius, 1 / halfHeight, 1 / radius);
  crown.computeVertexNormals();
  return crown;
}

export interface TiergartenArrivalStateV379 {
  native: boolean;
  hidden: boolean;
  nativeComplete: boolean;
  drawnComplete: boolean;
  legacyDrawn: boolean;
  snow: boolean;
}

export function createTiergartenTreeArrivalV379(
  scene: Group | import("three").Scene,
  mobile: boolean,
  requestFill: () => Promise<Block[]> = () =>
    import("./data/tiergartenTreeFillV379.json").then(
      (m) => m.default as Block[],
    ),
) {
  const root = new Group();
  root.name = "Großer Tiergarten · kartierte Bäume beim Anflug";
  scene.add(root);
  const stands: Array<Stand | undefined> = [];
  let disposed = false;
  let fill: Block[] | undefined;
  let fetchStarted = false;
  let retryAfter = 0;
  let leafCrown: BufferGeometry | undefined, cone: ConeGeometry | undefined;
  let stem: CylinderGeometry | undefined, box: BoxGeometry | undefined;
  const foliage = new MeshLambertMaterial({ flatShading: true });
  const bark = new MeshLambertMaterial({ flatShading: true });
  const mat = new Matrix4(),
    color = new Color();
  const key = (b: Block) => b[0] + "," + b[1] + "," + b[3];

  function release(group: Group) {
    group.removeFromParent();
    group.traverse((obj) => {
      if (obj instanceof InstancedMesh) obj.dispose();
    });
    group.clear();
  }
  function drop(f: Family) {
    const stand = stands[f];
    if (stand) {
      release(stand.group);
      stands[f] = undefined;
    }
  }

  // Every transform is uploaded once. Primitive geometry and materials are shared
  // by first-frame and near-camera batches, but the instance buffers are owned by each batch.
  function makeBatch(blocks: Block[], native: boolean, name: string): Group {
    const owner = new Group();
    owner.name = name;
    if (!blocks.length) {
      owner.userData.treeCount = 0;
      return owner;
    }
    const decoded = blocks.map((b) => {
      const raw = atob(b[4]);
      const u8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      return { bx: b[0] * 256, bz: b[1] * 256, view: new DataView(u8.buffer) };
    });
    const sizes = [0, 0, 0]; // trunks, rounded/block crowns, conifers
    for (const b of decoded) {
      for (let i = 0; i < b.view.byteLength; i += stride) {
        if (mobile && !b.view.getUint8(i + 14)) continue;
        const shape = styles[b.view.getUint16(i + 12, true)][0];
        sizes[0]++;
        sizes[shape === 1 ? 2 : 1]++;
        if (shape === 3) sizes[1]++;
      }
    }
    owner.userData.treeCount = sizes[0];
    function instanced(
      slot: number,
      geometry: BufferGeometry,
      material: MeshLambertMaterial,
      label: string,
    ) {
      const mesh = new InstancedMesh(geometry, material, sizes[slot]);
      mesh.name = label;
      mesh.matrixAutoUpdate = false;
      owner.add(mesh);
      return mesh;
    }
    const trunks = instanced(
      0,
      native
        ? (box ??= new BoxGeometry())
        : (stem ??= new CylinderGeometry(1, 1.12, 1, 5)),
      bark,
      "Vermessene Baumstämme",
    );
    const crowns = instanced(
      1,
      native ? (box ??= new BoxGeometry()) : (leafCrown ??= firstLeafCrown()),
      foliage,
      "Vermessene Baumkronen",
    );
    const conifers = sizes[2]
      ? instanced(
          2,
          (cone ??= new ConeGeometry(1, 2, 7)),
          foliage,
          "Nadelkronen",
        )
      : undefined;
    const bounds = new Box3();
    let ti = 0,
      ci = 0,
      ni = 0;
    function put(
      mesh: InstancedMesh,
      ix: number,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      paint: number,
      variant = 0,
    ) {
      mat.makeScale(w, h, d);
      if (variant) {
        const [cos, sin] = turns[variant];
        mat.elements[0] = cos * w;
        mat.elements[2] = -sin * w;
        mat.elements[8] = sin * d;
        mat.elements[10] = cos * d;
      }
      mat.setPosition(x, y, z);
      mesh.setMatrixAt(ix, mat);
      mesh.setColorAt(ix, color.setHex(paint));
    }
    for (const { bx, bz, view } of decoded) {
      for (let i = 0; i < view.byteLength; i += stride) {
        if (mobile && !view.getUint8(i + 14)) continue;
        const x = bx + view.getUint16(i, true) / 100,
          z = bz + view.getUint16(i + 2, true) / 100;
        const y = view.getInt16(i + 4, true) / 1000,
          h = view.getUint16(i + 6, true) / 100;
        const cr = view.getUint16(i + 8, true) / 100,
          tr = view.getUint16(i + 10, true) / 1000;
        const [shape, leaf, wood, ratioOrCap, variant] =
          styles[view.getUint16(i + 12, true)];
        const height = native
          ? Math.max(2, h - 6)
          : Math.max(0.4, (h * ratioOrCap) / 100);
        const radius = native ? tr * 2 : tr;
        // The measurements bound the actual vertices, including the extra native crown.
        const reach = Math.max(cr, tr * 1.12, 0.35);
        bounds.min.x = Math.min(bounds.min.x, x - reach);
        bounds.max.x = Math.max(bounds.max.x, x + reach);
        bounds.min.z = Math.min(bounds.min.z, z - reach);
        bounds.max.z = Math.max(bounds.max.z, z + reach);
        bounds.min.y = Math.min(bounds.min.y, y);
        bounds.max.y = Math.max(
          bounds.max.y,
          y + height + (native ? 12 : Math.max(0.8, h - height)),
        );
        put(trunks, ti++, x, y + height / 2, z, radius, height, radius, wood);
        if (native) {
          put(crowns, ci++, x, y + height + 3.8, z, cr * 2, 7.6, cr * 2, leaf);
          if (shape === 3)
            put(
              crowns,
              ci++,
              x,
              y + height + 7.6 + 2.2,
              z,
              5.2,
              4.4,
              5.2,
              ratioOrCap,
            );
        } else {
          const half = Math.max(0.8, h - height) / 2;
          if (shape === 1)
            put(conifers!, ni++, x, y + height + half, z, cr, half, cr, leaf);
          else
            put(
              crowns,
              ci++,
              x,
              y + height + half,
              z,
              cr,
              half,
              cr,
              leaf,
              variant,
            );
        }
      }
    }
    // Avoid another instance-matrix scan on the first GPU frame.
    if (!bounds.isEmpty())
      for (const obj of owner.children) {
        const mesh = obj as InstancedMesh;
        mesh.boundingBox = bounds.clone();
        mesh.boundingSphere = bounds.getBoundingSphere(new Sphere());
      }
    return owner;
  }
  function initialize(f: Family) {
    const group = new Group();
    group.name = f
      ? "Tiergarten · erste Blockkronen"
      : "Tiergarten · erste Katasterkronen";
    const uncovered = makeBatch(
      firstBlocks.filter((b) => b[2] === f && !b[3]),
      !!f,
      "Erste Kronen im gesamten Park",
    );
    const legacy = makeBatch(
      firstBlocks.filter((b) => b[2] === f && b[3]),
      !!f,
      "Vom frühen Ostbestand übernommene Kronen",
    );
    group.add(uncovered, legacy);
    root.add(group);
    group.userData.firstTreeCount =
      uncovered.userData.treeCount + legacy.userData.treeCount;
    const stand: Stand = {
      group,
      legacy,
      cells: new Map(),
      focus: "",
      queue: [],
    };
    stands[f] = stand;
    return stand;
  }

  function update(
    target: Vector3,
    eye: Vector3,
    state: TiergartenArrivalStateV379,
    now: number,
  ) {
    if (disposed) return false;
    let changed = false;
    if (state.nativeComplete && stands[1]) {
      drop(1);
      changed = true;
    }
    if (state.drawnComplete && stands[0]) {
      drop(0);
      changed = true;
    }
    const f: Family = state.native ? 1 : 0;
    const complete = state.native ? state.nativeComplete : state.drawnComplete;
    const distance = eye.distanceTo(target);
    const dx = Math.max(-2720 - target.x, target.x - 380, 0),
      dz = Math.max(-130 - target.z, target.z - 1040, 0);
    const show =
      !complete && !state.hidden && dx * dx + dz * dz < (distance + 750) ** 2;
    if (root.visible !== show) {
      root.visible = show;
      changed = true;
    }
    if (!show) {
      // On departure, keep only the reusable park-wide silhouettes. A trip to
      // another district cannot retain nine recently visited detail buffers.
      if (changed)
        for (const stand of stands) {
          if (!stand) continue;
          for (const owned of stand.cells.values()) release(owned);
          stand.cells.clear();
          stand.queue = [];
          stand.focus = "";
        }
      return changed;
    }
    const other = stands[f === 1 ? 0 : 1];
    if (other?.group.visible) {
      other.group.visible = false;
      changed = true;
    }
    if (!stands[f]) changed = true;
    const stand = stands[f] ?? initialize(f);
    if (!stand.group.visible) {
      stand.group.visible = true;
      changed = true;
    }
    const showLegacy = !!f || !state.legacyDrawn;
    if (stand.legacy.visible !== showLegacy) {
      stand.legacy.visible = showLegacy;
      changed = true;
    }
    if (root.userData.snow !== state.snow) {
      foliage.emissive.setHex(state.snow ? 0x91a09d : 0);
      root.userData.snow = state.snow;
      changed = true;
    }
    if (!fill && !fetchStarted && now >= retryAfter) {
      fetchStarted = true;
      void requestFill()
        .then((rows) => {
          if (!disposed) fill = rows;
        })
        .catch(() => {
          fetchStarted = false;
          retryAfter = performance.now() + 5000;
        });
    }
    if (!fill) return changed;
    // Quantized camera focus prevents build/evict oscillation on tiny mouse motions.
    const x = Math.floor(target.x / 64) * 64 + 32,
      z = Math.floor(target.z / 64) * 64 + 32;
    const focus = x + "," + z + "," + Number(showLegacy);
    if (stand.focus !== focus) {
      stand.focus = focus;
      const score = (b: Block) =>
        ((b[0] + 0.5) * 256 - x) ** 2 + ((b[1] + 0.5) * 256 - z) ** 2;
      const nearby = fill
        .filter((b) => {
          if (b[2] !== f || (!showLegacy && b[3])) return false;
          const dx = Math.max(b[0] * 256 - x, x - (b[0] + 1) * 256, 0);
          const dz = Math.max(b[1] * 256 - z, z - (b[1] + 1) * 256, 0);
          return dx * dx + dz * dz <= 490 ** 2;
        })
        .sort((a, b) => score(a) - score(b))
        .slice(0, maxDetailedCells);
      const wanted = new Set(nearby.map(key));
      for (const [id, owned] of stand.cells)
        if (!wanted.has(id)) {
          release(owned);
          stand.cells.delete(id);
          changed = true;
        }
      stand.queue = nearby.filter((b) => !stand.cells.has(key(b)));
    }
    const block = stand.queue.shift();
    if (block) {
      const id = key(block);
      const near = makeBatch(
        [block],
        !!f,
        "Tiergarten · örtliche Baumgruppe " + id,
      );
      stand.group.add(near);
      stand.cells.set(id, near);
      changed = true;
    }
    return changed;
  }
  return {
    root,
    update,
    dispose() {
      disposed = true;
      drop(0);
      drop(1);
      root.removeFromParent();
      foliage.dispose();
      bark.dispose();
      leafCrown?.dispose();
      cone?.dispose();
      stem?.dispose();
      box?.dispose();
      fill = undefined;
    },
  };
}
