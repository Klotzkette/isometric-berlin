import { createHash } from "node:crypto";
import { Group, InstancedMesh, Mesh } from "three";
import {
  buildColumnToneLookup,
  buildMinecraftVoxelWorldSteps,
  createMinecraftVoxelWorld,
  type MinecraftVoxelDetailProfile,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import { completeCooperatively } from "../src/cooperativeWork";

const root = new URL("../public/mesh/regierungsviertel/", import.meta.url);
const payload: VoxelPayload = await Bun.file(
  new URL("minecraft-voxels.json", root),
).json();
const prisms = await Bun.file(new URL("lod2-prisms.json", root)).json();
const scene = await Bun.file(new URL("scene.json", root)).json();
const detailProfile: MinecraftVoxelDetailProfile = process.argv.includes(
  "--mobile",
)
  ? "mobile"
  : "full";
const reference = process.env.MINECRAFT_REFERENCE_MODULE
  ? await import(process.env.MINECRAFT_REFERENCE_MODULE)
  : null;
const started = performance.now();
const tones = (reference?.buildColumnToneLookup ?? buildColumnToneLookup)(prisms);
const lookupMs = performance.now() - started;
const cooperative = process.argv.includes("--cooperative");
if (reference && cooperative) {
  throw new Error("Historical comparison uses the synchronous constructor");
}
const slices: number[] = [];
let taskCount = 0;
function* measuredSteps() {
  const steps = buildMinecraftVoxelWorldSteps(
    new Group(),
    payload,
    tones,
    scene.tiergartentunnel,
    {
      detailProfile,
      sourcePrisms: prisms.buildings,
    },
  );
  for (;;) {
    const begin = performance.now();
    const next = steps.next();
    slices.push(performance.now() - begin);
    if (next.done) return next.value;
    yield;
  }
}
const world = cooperative
  ? await completeCooperatively(measuredSteps(), {
      isCancelled: () => false,
      yieldTask: () => {
        taskCount += 1;
        return new Promise((resolve) => setTimeout(resolve, 0));
      },
    })
  : (reference?.createMinecraftVoxelWorld ?? createMinecraftVoxelWorld)(
      payload,
      tones,
      scene.tiergartentunnel,
      { detailProfile, sourcePrisms: prisms.buildings },
    );
const buildMs = performance.now() - started - lookupMs;
const hash = createHash("sha256");
let instances = 0;
let renderables = 0;
let bufferBytes = 0;
const buffers = new Set<ArrayBufferLike>();
world.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  renderables += 1;
  hash.update(JSON.stringify([object.name, object.matrix.elements]));
  const attributes = [
    object.geometry.index,
    ...Object.values(object.geometry.attributes),
  ];
  if (object instanceof InstancedMesh) {
    instances += object.count;
    hash.update(JSON.stringify([object.count, object.instanceMatrix.count]));
    attributes.push(object.instanceMatrix, object.instanceColor);
  }
  for (const attribute of attributes) {
    if (!attribute || !("array" in attribute)) continue;
    const { array } = attribute;
    hash.update(
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
    );
    if (!buffers.has(array.buffer)) {
      buffers.add(array.buffer);
      bufferBytes += array.buffer.byteLength;
    }
  }
});
console.log(
  JSON.stringify(
    {
      detailProfile,
      lookupMs: Number(lookupMs.toFixed(2)),
      buildMs: Number(buildMs.toFixed(2)),
      cooperative,
      taskCount,
      maxSliceMs: Number(Math.max(0, ...slices).toFixed(2)),
      p95SliceMs: Number(
        (
          slices.sort((a, b) => a - b)[Math.floor(slices.length * 0.95)] ?? 0
        ).toFixed(2),
      ),
      instances,
      renderables,
      bufferBytes,
      sha256: hash.digest("hex"),
      rssMiB: Number((process.memoryUsage.rss() / 1024 / 1024).toFixed(1)),
    },
    null,
    2,
  ),
);
