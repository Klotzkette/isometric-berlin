import { plugin } from "bun";
import { resolve } from "node:path";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";
import { geometryPreservationV206 } from "./helpers/geometryPreservationV206";

// Retained reproduction tool for the compact immutable-source proxy receipt.
// Run with `bun tests/capture-nationalgalerie-v221.ts`; historical hash guards
// reject captures whose transitive dependencies no longer reproduce v220.
const releasedBase = "d7b7a3a7a452fc330950f2cfbc5034e441c59915";
const modulePath = "src/app/src/ExpandedCityDetails.ts";
const git = (path: string) => {
  const result = Bun.spawnSync(["git", "show", `${releasedBase}:${path}`]);
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString();
};
const source = git(modulePath);
const monumentsPath = "src/app/src/TiergartenMonuments.ts";
const monumentsSource = git(monumentsPath);
const streetText = git("src/app/public/mesh/regierungsviertel/street-details.json");
const groundText = git("src/app/public/mesh/regierungsviertel/minecraft-voxels.json");
const landmarksText = git("src/app/public/mesh/regierungsviertel/scene.json");
const landmarks = JSON.parse(landmarksText).landmarks;
const removedName = "Der Bogenschütze (Henry Moore)";
const removed = landmarks.filter((landmark: { name: string }) => landmark.name === removedName);
if (removed.length !== 1) throw new Error("Historical Archer identity must be unique");
const sha256 = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
plugin({ name: "immutable v220 ExpandedCityDetails", setup(build) {
  build.onLoad({ filter: /\/ExpandedCityDetails\.ts$/ }, () => ({
    contents: source, loader: "ts", resolveDir: resolve(import.meta.dir, "../src"),
  }));
  build.onLoad({ filter: /\/TiergartenMonuments\.ts$/ }, () => ({
    contents: monumentsSource, loader: "ts", resolveDir: resolve(import.meta.dir, "../src"),
  }));
}});
const { createExpandedCityDetails } = await import("../src/ExpandedCityDetails");
const profiles = {} as Record<string, unknown>;
for (const detailProfile of ["full", "mobile"] as const) {
  const capture = (input: typeof landmarks) => {
    const root = createExpandedCityDetails(input, { detailProfile });
    try {
      const records = geometryPreservationV206(root);
      return { static: staticGeometryAudit(root), allRecordsSha256: sha256(JSON.stringify(records)), objects: records.length };
    } finally { disposeStaticAudit(root); }
  };
  profiles[detailProfile] = {
    complete: capture(landmarks),
    withoutExactObsoleteArcher: capture(landmarks.filter((landmark: { name: string }) => landmark.name !== removedName)),
  };
  if ((profiles[detailProfile] as any).complete.static.hash !== "b44183ee7aae60860280b1df48dcb0b74807a2a16a59477dd704cd3a36190c49")
    throw new Error("The immutable v220 expanded-city control no longer reproduces its original hash");
}
const { createTiergartenMonuments } = await import("../src/TiergartenMonuments");
const street = JSON.parse(streetText), ground = JSON.parse(groundText);
const keys = ["node/1881346242", "node/1881346251"];
const captureMonuments = (externallyModelledSourceKeys?: Set<string>) => {
  const root = createTiergartenMonuments(street, ground, { externallyModelledSourceKeys })!;
  try {
    const records = geometryPreservationV206(root);
    return { static: staticGeometryAudit(root), allRecordsSha256: sha256(JSON.stringify(records)), objects: records.length,
      externallyModelledSourceKeys: root.userData.externallyModelledSourceKeys };
  } finally { disposeStaticAudit(root); }
};
const output = {
  releasedBase,
  method: "Immutable v1.0.120 ExpandedCityDetails module and shipped landmark catalogue read from Git. Full and mobile historical captures differ only by withholding the unique named Archer input, suppressing precisely its obsolete merged torus and ink edges. Current runtime receives the complete unmodified catalogue and must reproduce every historical complement byte, ordered object/header and material/world-transform digest. No historical fixture is changed.",
  source: { path: modulePath, sha256: sha256(source), landmarksSha256: sha256(landmarksText) },
  removedLandmark: removed[0], profiles,
  tiergarten: {
    method: "The immutable factory receives the complete unchanged street and ground payloads. Its existing externallyModelledSourceKeys option suppresses only the two exact artwork nodes while retaining source accounting; the current factory must reproduce that complete historical complement.",
    source: { path: monumentsPath, sha256: sha256(monumentsSource), streetSha256: sha256(streetText), groundSha256: sha256(groundText) },
    removedKeys: keys,
    removedEntries: street.monuments.filter((entry: { osm_key: string }) => keys.includes(entry.osm_key)),
    complete: captureMonuments(), withoutExactObsoleteProxies: captureMonuments(new Set(keys)),
  },
};
if (output.tiergarten.complete.static.hash !== "77e510b6bdbce3ac7b14d166551989cf9f18fadab46ad92a7e0955bb777bf288")
  throw new Error("The immutable v220 monument control no longer reproduces its original hash");
await Bun.write(resolve(import.meta.dir, "fixtures/nationalgalerie-v221-obsolete-archer.json"), JSON.stringify(output, null, 2) + "\n");
