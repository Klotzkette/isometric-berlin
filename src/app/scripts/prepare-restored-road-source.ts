import { smoothSurfaceRing, surfaceCurveOptions, type SurfacePayload } from "../src/IsometricCityWorld";
import { BRANDENBURG_APPROACH_SCOPE } from "../src/brandenburgApproachScopeData";
import { BEBEL_LIBRARY_GROUND_PATCH } from "../src/bebelplatzMemorialProfile";
import { HAND_MIT_UHR_PROFILE } from "../src/gymnasiumTiergartenProfile";
import { T4_MEMORIAL_PROFILE } from "../src/TiergartenMonuments";

const path = `${import.meta.dir}/../public/mesh/regierungsviertel/surface-polygons.json`;
const bytes = await Bun.file(path).bytes();
const source = JSON.parse(new TextDecoder().decode(bytes)) as SurfacePayload;
await Bun.write(process.argv[2], JSON.stringify({
  source_sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  // Reuse the actual renderer's curves; no separate approximation or simplifier.
  roads: source.roads?.filter(p => p.kind === "asphalt" || p.kind === "paving").map(p => ({
    kind: p.kind,
    ring: smoothSurfaceRing(p.ring, surfaceCurveOptions(p)),
    holes: p.holes?.map(h => smoothSurfaceRing(h, surfaceCurveOptions(p))) ?? [],
  })),
  approach: BRANDENBURG_APPROACH_SCOPE,
  bebel: BEBEL_LIBRARY_GROUND_PATCH,
  hand: HAND_MIT_UHR_PROFILE,
  t4: T4_MEMORIAL_PROFILE,
}));
