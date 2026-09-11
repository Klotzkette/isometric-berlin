import { smoothSurfaceRing, surfaceCurveOptions, type SurfacePayload } from "../src/IsometricCityWorld";
const file = Bun.file(`${import.meta.dir}/../public/mesh/regierungsviertel/surface-polygons.json`);
const bytes = await file.bytes();
const payload = JSON.parse(new TextDecoder().decode(bytes)) as SurfacePayload;
await Bun.write(process.argv[2], JSON.stringify({
  source_sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  water: payload.water.map(surface => ({
    kind: surface.kind,
    ring: smoothSurfaceRing(surface.ring, surfaceCurveOptions(surface)),
    holes: (surface.holes ?? []).map(ring => smoothSurfaceRing(ring, surfaceCurveOptions(surface))),
  })),
}));
