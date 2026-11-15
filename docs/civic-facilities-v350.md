# Primary schools, childcare and pharmacies

V350 checks the complete retained inventories: 439 verified primary-school main
sites, 2,941 childcare records and 666 current pharmacy-directory entries. These
are facility locations, not measured entrances or a photographic facade survey.
The education and pharmacy evidence files distinguish source dates, unresolved
combined-school primary stages, older childcare records and pharmacy address
exceptions.

The visible addition consists of 1,070 small wall plates for 1,094 facilities:
97 primary schools, 817 childcare facilities and 180 pharmacies. Co-located
facilities of one category share a plate. The complete names remain in the audit;
the texture-free 3D lettering uses a short name and category. Plate dimensions,
lettering, placement and neutral/red colours are recognition estimates, not a
claim about the actual business sign or entrance. No door, window or facade
colour was invented or replaced.

## Physical association

The compiler accepts an unambiguous directory point inside a retained building,
or a unique full-address match to an actual mapped building whose footprint
overlaps the retained building by at least 90% in both directions. The tracked
`civic-facilities-v350-address-buildings.json.gz` retains these exact source
polygons and binds both inventory SHA-256 hashes. A changed inventory invalidates
the address cache. No nearest-building fallback is used.

Each candidate needs independently emitted literal wall triangles in Drawn and
Native. The final pass applies previous geometry retirements and navigation
changes, proves all plate corners and its centre against the retained wall, and
avoids existing projecting fittings. A plate may shift along the same measured
wall to a clear supported position. Native plates follow its own cardinal wall;
they are not a snap of the Drawn position.

All 4,046 inventory records have an explicit outcome:

| Outcome | Facilities |
| --- | ---: |
| Supported visible recognition plate | 1,094 |
| Point/address not resolved to a retained building footprint | 1,877 |
| No supported visible wall in both geometry families | 932 |
| Earlier fitting or retired wall preserved | 83 |
| Older childcare entry without current-directory confirmation | 36 |
| Ambiguous independent building hosts | 23 |
| Upper-floor pharmacy without verified floor support | 1 |

Unresolved points include locations represented by separate authored/core models
or beyond the current retained building shells. They do not receive floating
markers or a guessed neighbouring building. This release does **not** assert
that all Berlin facilities have a newly reconstructed facade.

## Runtime and preservation

Twenty-nine lazy compact modules contain 503,713 bytes of source JSON for 449
hosts. Shared geometric glyphs expand only for a requested admitted host, with
at most eleven plates in the measured release. Expanded binary plans are weakly
cached; the existing packet decoder owns rendering, cancellation and disposal.
The existing whole-source lossless codec reduces the 29 module payloads to
155,661 transformed bytes; it decodes each compact object only when that lazy
module is imported. All 29 roundtrips and 898 expanded plans were compared with
the original data. This is the repository's existing codec and ownership model.
There are no new textures, network datasets, timers, workers or residency limits.
The compiler keeps every facility outcome rather than stopping at a sample cap.

All 898 Drawn/Native host families are checked through the complete production
decoder before and after the addition. Existing interleaved position/colour
words, triangle indices, ink and navigation remain identical after accounting
for the inserted plaque vertices. Older catalogue entries, ground overlays,
transport and Neukölln replacements are included. No admitted host needs an
extra companion or a larger mesh budget. The final production proof also checks
source-kind order, old transfer/aperture metadata and day/night material hooks
and shader uniforms with the procedural ground finish enabled. Wall support and
clearance are additionally checked against the fully decoded old body, including
its older hardcoded retirement passes.

The adjoining access-path work is documented separately in the education/path
evidence. It uses mapped paths clipped to actual retained floor and does not
infer entrances, crossings or slopes from a directory point.

## Reproduction

1. Build the frozen education and pharmacy inventories and exact-address cache.
2. Run `uv run python -m scripts.build_civic_facilities_v350`.
3. From `src/app`, run `bun scripts/capture-civic-facilities-v350.ts
   ../../geo_data/regierungsviertel/raw/city-v350/civic-facilities-compact.json
   ../../geo_data/regierungsviertel/civic-facilities-v350-evidence.json.gz`.
4. Run `uv run python -m scripts.build_civic_facilities_v350 --publish`.
5. From `src/app`, run `bun scripts/verify-civic-facilities-v350.ts` and
   `bun test tests/civic-facilities-v350.test.ts`.

The frozen inputs and all admitted/unresolved outcomes are retained under
`geo_data/regierungsviertel`; current main and Worker build/package checks remain
the release owner's responsibility.
