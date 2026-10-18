# Western industrial sites — Step 10 / v230

The bounded source covers the whole mapped Eiswerder island, the Reuter-West
cooling tower, and 15 named Westhafen warehouse / administration buildings.
No surrounding district is generated.

## Sources and limits

- [InselCampus site history](https://www.inselcampus.berlin/historie): surviving
  industrial buildings, later reuse and both island bridges. The dated OSM cache
  supplies the island boundary, 76 building outlines, paths and land-use context.
  Existing island ground, water, bridges and paths remain. 97 official LoD2
  parents provide complete walls/roofs; uncovered mapped residual footprints
  remain explicitly estimated OSM envelopes, not surveyed roofs.
- [Berlin heritage inventory, Westhafen 09050366](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050366):
  clinker facades, pale stone trim, loading openings, large hipped roofs and roof
  projections. Storage and administration towers are original measured parts,
  not new generic masses. The separately authored **Zollspeicher is untouched**.
- [BEW/LAGeTSi environmental assessment (2025)](https://www.berlin.de/lagetsi/_assets/documents/kwk-25/komprimiert_anlage-02_uvp_bericht_bew_reuter-west-berlin_rfb_rev01_neu.pdf?ts=1762447569)
  identifies the existing cooling tower as **100 m** high. Retained OSM
  `way/26131445` independently records that height and its roughly 103 m diameter.
  The conflicting 74 m in the older VDE description is not used. LoD2 contains
  only the low service/basin base; its original sheets remain intact.
- [Axel Mauruszat, HKW Reuter West Kuehlturm.jpg (2007)](https://commons.wikimedia.org/wiki/File:HKW_Reuter_West_Kuehlturm.jpg),
  attribution-only license: reference for the pale concrete shell, dark vertical
  lower-middle stripes and panel rhythm. No photo/texture is bundled. Intermediate
  radial proportions and 0.9 m shell thickness are explicit visual estimates.
  The mouth is an annulus, never a filled disk.

Geometry comes from retained official `a_lod2` archives `LoD2_379_5823`,
`LoD2_380_5821`, `LoD2_387_5821`, `LoD2_387_5822`. Their hashes and all selected
leaf sheets are retained in `west-industrial-source-v230.json`. Original X/Z
coordinates stay unchanged; each parent receives one rigid vertical translation
to the existing 3 m world-ground datum. Opening rhythms, trim and untagged shades
are explicitly estimates clipped to actual exposed source walls. Shared party
walls and tiny fallback slivers get no speculative pane grid.

## Preservation and runtime

`westIndustrialV230Ownership.json` independently replays 91 previous owners in
both packet modes: 14,134 original colored triangles and 696 unique ink segments.
Six shared boundary-line claims are explicitly consolidated. Original packet
fingerprints guard every transfer; unrelated triangles, lines and navigation stay
unchanged. Existing v188, v209 and new v230 facade companions have zero owner
intersections with these sites.

Ten spatially local groups are required before navigation starts, with independent
frustum culling. Native skins are separately sampled onto a 1 m orthogonal grid;
source-wall fittings also have independent unrotated blocks. No construction
arrays are stored on scene metadata. Register `sites` as a weak construction field
for `westIndustrialV230Envelopes.json` and `westIndustrialV230Native.json`.
The compact navigation is resident; its first native use copies only actual skin
block bounds into a spatial index, never source colors or fitting arrays.

New geography is limited to the exact cooling-tower footprint plus its original
attached service base: **9,974.05 m²**, world bounds
`[-8989.294, -2019.436, -8855.155, -1909.938]`.
`west-industrial-v230-required-extent.json` retains its nonrectangular geometry.
Eiswerder and Westhafen are already within old bounds. No runtime budget, mobile
quality threshold, texture count or original packet is changed.

## Integration and verification

- `createWestIndustrialV230(native)` from `WestIndustrialV230.ts` is a required root.
- `westIndustrialV230RoofAt`, `TerrainAt`, `GroundAt`, `SolidAt` from
  `westIndustrialV230Navigation.ts` use the same signatures as v229 court navigation.
  The hollow tower has radius-dependent drawn collision; native collision/support
  uses actual rendered source-skin cells.
- `transferWestIndustrialNavigationV230(tile, nav)` plus the ownership receipt
  belong before packet upload/navigation, including late loading and mode changes.

Replay from retained data:

```sh
uv run python scripts/build_west_industrial_v230.py --extract
uv run python scripts/build_west_industrial_ownership_v230.py
uv run python scripts/build_west_industrial_models_v230.py
uv run pytest tests/test_west_industrial_v230.py -q
cd src/app
bun test tests/west-industrial-v230.test.ts
```

Runtime JSON including receipts is 8.49 MB; gzip total approximately 1.06 MB.
Tests cover complete island/warehouse coverage, every retained source part,
independent old-packet replay, unique transfer claims, native integer boundaries,
complete collision bounds, actual Three.js rays through the open mouth / upper
rim, native support matching rendered blocks, and unchanged unrelated navigation.
