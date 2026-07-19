# Task 09 — Grand expansion: Kulturforum, Leipziger Platz, Hamburger Bahnhof, whole Tiergarten

**Pipeline step:** 1–8 (bounds → data → mesh → viewer; see `AGENTS.md` §5)
**Status:** todo — **blocked in the Claude Code remote environment**
(outbound network to `gdi.berlin.de` and `overpass-api.de` answers
CONNECT 403; run from Codex or a local checkout with open egress).
**Owner-set scope (2026-07-19, supersedes the task-06 southern lobe):**
extend the map so ALL of the following are inside the rendered area and
recognisable:

- Kulturforum complete: Philharmonie (already inside), St.
  Matthäus-Kirche (52.5077, 13.3689), Gemäldegalerie (52.5085,
  13.3667), Neue Nationalgalerie (52.5065, 13.3672), Staatsbibliothek
  (52.5074, 13.3702)
- Leipziger Platz octagon complete with Mall of Berlin (52.5104,
  13.3801), Kollhoff-Tower (52.5093, 13.3757)
- Hamburger Bahnhof (52.5285, 13.3722)
- Geschichtspark Ehemaliges Zellengefängnis Moabit (52.5290, 13.3660)
- The WHOLE Großer Tiergarten incl. Siegessäule (52.5145, 13.3501)
  and every monument in the park ("alle Denkmäler supergenau
  isometrisch" — the drawn-monument layer from v0.13.0 scales
  automatically once the OSM data covers them)

## Why it is blocked here

`buildings.gpkg`/`osm.gpkg` are clipped exactly to the committed
`bounds.geojson` (verified: 0 LoD2 buildings outside the polygon), and
`alkis.gpkg` carries parcels only. Refetching LoD2 ATOM tiles and
Overpass extracts for the larger polygon needs egress this environment
denies by policy. Everything downstream (voxels, prisms, street
details, monuments, kerbs, signals) is already polygon-driven and will
absorb the new data without code changes.

## Procedure (run where the network is open)

1. Extend `geo_data/regierungsviertel/bounds.geojson` to the new
   polygon (Tiergarten west edge ≈ E 387900, Moabit north edge ≈
   N 5821400, Leipziger Platz east edge ≈ E 390250, Landwehrkanal
   south edge ≈ N 5818350; keep it a lobed polygon, not a blanket
   rectangle, to hold payload sizes).
2. Refetch: `fetch_lod2`, `fetch_osm`, `fetch_official_support`,
   `fetch_official_details`, `fuse_sources` (fused manifest must list
   every source; nothing silently dropped).
3. Rebuild payloads: `build_minecraft_voxels`, `build_isometric_prisms`,
   `build_park_details`, `build_street_details` (traffic signals AND
   monuments come along automatically).
4. New mesh tiles (photogrammetry fallback + hero crops):
   `fetch_berlin_mesh` + `prepare_webgl_mesh`; check bundle size
   against `docs/perplexity-hosting.md` limits.
5. Landmarks: add the POIs above to `landmarks.geojson` with tour
   order + camera presets; regenerate scene manifest and alignment
   artefacts (task-08 procedure).
6. Viewer: widen `REGIERUNGSVIERTEL_FLIGHT_BOUNDS`
   (`src/app/src/cameraNavigation.ts`); extend the Tiergartentunnel
   centreline if the new polygon reaches the true south portal;
   recognition models for Neue Nationalgalerie (glass hall — the
   transparent-prism + mullion path fits perfectly), St. Matthäus
   (brick, striped), Philharmonie tent roof, Kollhoff brick tower,
   Siegessäule column + Viktoria.
7. Full gates + release train.

## Acceptance criteria

- [ ] All listed POIs inside bounds, each recognisable and a landmark.
- [ ] All data steps re-run; `fused_sources.json` regenerated.
- [ ] Payload budgets respected (prisms/voxels/DZI within the hosting
      limits; document the new sizes).
- [ ] Flight bounds, DZI, reference/overview assets regenerated.
- [ ] Full gate suite green.
