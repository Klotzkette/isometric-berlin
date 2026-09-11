import { heapStats } from "bun:jsc";
import { BRIDGE_PROFILES } from "../src/IsometricCityWorld.ts";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld.ts";
import { createPedestrianBridgeGround } from "../src/PedestrianBridgeGround.ts";
import { createSpreebogenLawnGroundAt } from "../src/SpreebogenPark.ts";
import type { VisualMode } from "../src/visualMode.ts";

// Run separately from the test suite: WeakRef collection needs explicit JSC
// garbage collection and completed job turns. --report-only also measures the
// old implementation without requiring its source payload to be released.
const reportOnly = Bun.argv.includes("--report-only");
const sourceUrl = new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url);
const modes: VisualMode[] = ["day", "night", "snowstorm", "minecraft", "schwellenraum"];
// Fingerprints from the original factories: 18,291 turf positions and 14,625
// bridge positions across the five modes, including deck boundaries/outside.
const expectedSamples = {
  lawn: "d02988f40f0cb8c4703c5db0d8a90f8b824b3bb07a75fbd2bd65e335a1fcf41f",
  bridge: "6dac581ec2795102d6d373c6f851cadb3b397e405da34e1b2a28c284c922c36b",
  combined: "14468cb93f8bdbe48b5db25ac85b84b8ba04220d2a205abf039c55c1c79e6c76",
};
type Query = (x: number, z: number) => number | null;

async function collect(): Promise<number> {
  for (let turn = 0; turn < 8; turn += 1) {
    Bun.gc(true);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return heapStats().heapSize;
}

function sampleQueries(lawn: Query | undefined, bridge: Query | undefined, setMode: (mode: VisualMode) => void): string {
  const hash = new Bun.CryptoHasher("sha256");
  if (lawn) {
    for (let x = -200; x <= 200; x += 2) for (let z = -430; z <= -250; z += 2) {
      hash.update(JSON.stringify(lawn(x, z)) + "\n");
    }
  }
  if (bridge) for (const mode of modes) {
    setMode(mode);
    for (const profile of BRIDGE_PROFILES) {
      if (!profile.surveyedDeck || !profile.axis) continue;
      const axisLength = Math.hypot(...profile.axis);
      for (let along = -12; along <= 12; along += 1) for (let across = -6; across <= 6; across += 1) {
        const u = profile.surveyedDeck.halfLengthM * along / 10;
        const v = profile.surveyedDeck.halfWidthM * across / 5;
        const curve = (profile.curveSagittaM ?? 0) * Math.max(0, 1 - (u / profile.surveyedDeck.halfLengthM) ** 2);
        const x = profile.world[0] + (u * profile.axis[0] - (v + curve) * profile.axis[1]) / axisLength;
        const z = profile.world[1] + (u * profile.axis[1] + (v + curve) * profile.axis[0]) / axisLength;
        hash.update(JSON.stringify(bridge(x, z)) + "\n");
      }
    }
  }
  return hash.digest("hex");
}

function compile(kind: "lawn" | "bridge" | "combined", source: string) {
  const ground = JSON.parse(source) as VoxelPayload;
  const payloadReference = new WeakRef(ground);
  const sourceHash = Bun.hash(JSON.stringify(ground));
  Bun.gc(true);
  const parsedHeapBytes = heapStats().heapSize;
  let mode: VisualMode = "day";
  const lawn = kind !== "bridge" ? createSpreebogenLawnGroundAt(ground) : undefined;
  const bridge = kind !== "lawn" ? createPedestrianBridgeGround(ground, () => mode, 0.42) : undefined;
  if (Bun.hash(JSON.stringify(ground)) !== sourceHash) throw new Error("Source payload changed");
  const setMode = (next: VisualMode): void => { mode = next; };
  return { payloadReference, parsedHeapBytes, lawn, bridge, setMode };
}

const kind = Bun.argv.includes("--lawn") ? "lawn" : Bun.argv.includes("--bridge") ? "bridge" : "combined";
const source = await Bun.file(sourceUrl).text();
const baselineHeapBytes = await collect();
// End the complete construction stack before collecting. Keeping the parsed
// source in a suspended async activation can itself extend its JSC lifetime.
const queries = await new Promise<ReturnType<typeof compile>>((resolve) => {
  setTimeout(() => resolve(compile(kind, source)), 0);
});
const samplesSha256 = sampleQueries(queries.lawn, queries.bridge, queries.setMode);
const retainedHeapBytes = await collect();
const payloadRetained = queries.payloadReference.deref() !== undefined;
if (samplesSha256 !== expectedSamples[kind]) throw new Error(`${kind} ground-height samples changed`);
console.log(JSON.stringify({
  kind,
  sourceBytes: Bun.file(sourceUrl).size,
  parsedSourceHeapBytes: queries.parsedHeapBytes - baselineHeapBytes,
  retainedQueryHeapBytes: retainedHeapBytes - baselineHeapBytes,
  payloadRetained,
  samplesSha256,
}));
if (!reportOnly && payloadRetained) throw new Error(`${kind} query retains the decoded ground payload`);
