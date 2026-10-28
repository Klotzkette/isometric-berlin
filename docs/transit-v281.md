# Step 10 v281 – tram railheads and actual U-Bahn entrance frames

The retained central tram routes now carry 107 additional pairs of narrow railheads along 10,484.20 m of existing source axes. These are existing mapped tracks, not new service, expanded coverage or newly inferred connections. At Oranienburger Tor three positively mapped street-to-basement stairs gain complete descents and supported green portals. The four existing Brandenburger Tor stairs retain their modern stainless/glass identity and now have supported paired S/U panels instead of the former isolated U sign.

## Source boundary and measurements

`geo_data/regierungsviertel/transit-v281-source.json` retains 117 bounded records from the existing ODbL Berlin snapshot, including all selected rail tags and the three stair ways/top nodes. The record SHA-256 is `4f1bb4f223f6fe4b3f1f267bcc2343a80368bc56e564bf7d79856d3967c4853c`. Every new runtime rail course equals the previous `rail-lines.json` catenary course, including original vertices and endpoint gaps. Gauge 1,435 mm is positively tagged. The six v270 Oranienburger courses, all v249 Danziger courses and their geometry remain unchanged.

Four selected bridge courses (`way/104669627:0`, `way/165409970:0`, `way/291670883:0`, `way/291670888:0`) retain their previous owners and are excluded from this supplementary ground-level rail pass. Neither a flat land height nor a new connection is invented for them. Real discontinuities between distinct source nodes remain discontinuities. Shared source vertices obtain bounded offset miters, including across source-way boundaries; crossings choose the straightest evidenced continuation.

The Oranienburger stairs are `way/378658639` → `node/1080586511` (30 steps), `way/378662082` → `node/3820768526` (27 steps), and `way/378662084` → `node/3820768527` (28 steps). Their source tags explicitly say `highway=steps`, `incline=up`, `level=-1;0`; each upper endpoint coincides with its `railway=subway_entrance` node. A wheelchair tag on a broader access node does not invent a ramp. Lift points and unmapped underground continuations remain untouched.

Unsurveyed recognition fittings are explicit display estimates: 2.3 m clear stair width, 17 cm risers, 40 cm bottom landing, portal dimensions and colour, frame and sign mounting coordinates, 75 mm visible rail-head width, and rendering separation above the existing road surface. The modern Brandenburger paired-sign detail follows the S-Bahn operator photograph; it is deliberately not replaced by Oranienburger Tor's historic green arch. The Oranienburger photograph dates to 2012 and establishes its recognition form rather than a current dimensional survey. Complete reference and photographic credits are in [transit-v281-references.json](transit-v281-references.json); no photograph or raster texture is bundled.

## Geometry and ownership

Drawn rails use actual source axes and mitered edge strips. The independent native form uses horizontal cardinal treads at at most 0.5 m intervals. Both are partitioned into fourteen fixed 512 m culling batches, use two shared materials, have no animation and retain full touch-device detail. Drawn rails contain 10,706 quads / 1,156,248 buffer bytes; native rails contain 84,312 quads / 6,070,464 buffer bytes. The runtime rail JSON is approximately 56 KiB, including a compact, unchanged 156 × 101 subset of central height cells.

An independent surface audit caught an important height-owner mismatch: the older Alt-Mitte height helper switches to surrounding-city terrain outside its core mask. Near the Hauptbahnhof that could put supplemental rails more than one metre below the actual central road owner. V281 instead samples the original central ground cells directly throughout its bounded track extent. Existing road geometry and terrain remain unchanged. The audit checks 321 source-route positions against the original smooth and native terrain samplers; 217 also hit actual rendered road/paving owners. Their drawn rail-head separation is 0.0207–0.1142 m, a display clearance including retained road tessellation and differing paving lifts, not a surveyed rail-bed elevation.

Each new stair is one static instanced batch: 929 total drawn instances and 3,517 native instances. Source-aligned walls, the complete descent, handrails and closed bottom landing remain independently represented. Native boxes overlap by 2 mm at seams to avoid float-precision cracks without replacing them with a broad enclosing box. Green portal crossbars physically connect both posts and the blue panel. The modern Brandenburger frame's posts reach into the existing wall coping, its transverse supports connect both S/U panels, both faces have readable ivory strokes, and the stair approach remains open.

`UbahnSurfaceAperturesV281.ts` cuts only the three evidenced mouths from named ground owners. It retains original vertices, untouched index triples, interpolated attributes and the exact outside complement. Native openings use the existing independent quarter-metre footprint construction. Neither nearby structures nor remote paving are removed.

## Integration

`RequiredSiteEnvelopesV209.ts` attaches the fourteen rail batches and three complete stair batches using the existing incremental transaction. `ThreeViewer.tsx` applies the new cuts at both existing v261 worker/late-surface hooks and integrates floor and solid queries in both navigation paths. `IsometricCityWorld.ts` and `MinecraftVoxelWorld.ts` cut the initial ground instances; the final required-site pass also catches the remaining named owners. `pedestrianNavigation.ts` registers only the three represented safety sides of each actual stair when the complete central source owners are present. The mapped upper approach remains open.

The pre-existing seven v261 stairs, their step counts, special forms and navigation remain intact. Only the sign construction branch of their Brandenburger subset changes. Existing central source JSON, coverage, 93 named stops, resident limits, worker concurrency and raster/media policy are unchanged.

## Focused validation

Run from the repository root:

```sh
uv run python scripts/build_transit_v281.py
uv run pytest -q tests/test_transit_v281.py
uv run ruff check scripts/build_transit_v281.py scripts/prepare_transit_surface_audit_v281.py tests/test_transit_v281.py
bun test ./src/app/tests/transit-v281.test.ts ./src/app/tests/transit-v281-surfaces.test.ts ./src/app/tests/ubahn-entrances-v261.test.ts ./src/app/tests/tacheles-rails-v270.test.ts
```

The surface test clips a read-only copy of existing source road polygons to small sampled areas, then uses the real road constructors. Quantisation-induced invalid polygons are repaired only in that transient audit copy. No source or public artifact is rewritten. It also verifies that the three new mouth apertures are open in the actual road owners. The other tests cover exact source ownership, reproducibility, measured gauge and stair counts, shared-vertex joins and real gaps, native orthogonality, complete descents, both readable sign faces, connected physical support, original-ground complements and material disposal.

Useful internal-browser views: Oranienburger Tor at `[1092.316, 5.38, -764.078]`, `[1103.246, 5.38, -627.497]`, and `[1101.931, 5.38, -645.487]`. Full release and visual QA are performed by the integrating task.
