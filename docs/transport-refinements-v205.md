# Transport recognition refinements v205

Step 10 adds small source-bound details to BER, all 27 Ringbahn stations and
the western A100/A115 outlines. The six existing source/runtime payloads named
in `transport-refinements-v205-evidence.json` remain byte-identical. No owner,
triangle, platform, route, navigation envelope, residency limit or existing
hero is removed. There is no broad packet regeneration.

## BER Willy Brandt

The retained v200 `ber-map.osm` contains 21 explicitly mapped T1 building parts
that the original regional outline did not show separately: glass hall
`way/519141137`, main pier `way/519141134`, the large roof `way/1082978657`,
and 18 colonnade columns `way/1429967664` through `way/1429967681`.
Their complete original tags and geographic rings are retained in
`geo_data/regierungsviertel/ber-v205-parts-source.json`, together with the
existing T2, north/south pier and DFS tower records.

The roof, hall and columns now form a recognizable layered terminal silhouette.
T2 and both piers receive exact roof caps; the DFS tower receives a crown band
within its original 70 m outline. Individual glass mullion spacing, crown-band
height, shallow cap thickness, subdued colours and stripe dimensions are display
subdivisions, not surveyed facade details. No photo textures or external image
references were used.

The two runway widths are the OSM values 45 m and 60 m. The northern 3,600 m
pavement comprises `way/4645618` and the two separately mapped displaced
threshold sections `way/509961148` and `way/509961149`; these are one runway.
The southern 4,000 m runway is `way/95201688`. Every source-axis vertex remains.
Threshold accents respect the approximately 298 m offsets at either northern
end. The OSM axes run east to west, so the visible east-end labels are 24R/24L
and the west-end labels 06L/06R. No old 07/25 designators are added.

The source's existing local ground display datum remains y=3 m; OSM `ele=48`
is not silently introduced as a different vertical origin. Explicit building
part height/min_height tags take precedence for the new part only: the roof
is 34–36 m above the display datum, while the retained generic T1 outline has
height=32 m. Both source statements remain visible and recorded; neither is
claimed to be a new height survey. The old collision envelopes remain intact.
Filled drawn caps preserve all inner rings. Native caps use independent wholly
contained orthogonal runs, with stepped glass/frame details, rather than a
hidden smooth building. Ground runway markings use sparse blocks in native mode.

Primary references checked 2026-10-10:

- [Airport operator: airport facilities](https://corporate.berlin-airport.de/en/company-media/berlin-brandenburg-airport/flughafenanlagen.html):
  T1/T2 between parallel runways, terminal hall and colonnades; T5 will not reopen.
- [Airport operator: terminals](https://ber.berlin-airport.de/de/orientierung/terminals.html):
  all passenger arrivals/departures use T1 and T2; they are connected on foot.
- [Operator runway renaming notice, 2024-10-01](https://corporate.berlin-airport.de/de/unternehmen-presse/presseportal/pressemitteilungen/2024-10-01-slb-umbenennung.html):
  06L/24R and 06R/24L effective 2024-10-03, with no relocation of either runway.

## Ringbahn stations

The complete v190 inventory remains 39 unique stations, including all 27 on the
Ring and all 14 on the Stadtbahn. Each Ring station now has additional small
S-Bahn wayfinding markers on actual `light_rail=yes` platforms. Regional and
long-distance platforms never receive an S-Bahn mark. Marker locations are
contained display placements, not claims of surveyed sign positions. Both faces
read correctly; native signs are axis-aligned so their white strokes remain in
front of their backing.

Four source roof polygons without an existing retained building owner receive
thin canopy surfaces: Schönhauser Allee `way/36218351`; Westhafen
`way/375394534`, `way/438832765`, `way/44426688`. Their x/z rings, holes and v190
heights remain exact. Existing roof envelopes at every other station and the
complete Ostkreuz model are preserved. Wedding receives markers, but no guessed
replacement roof: the [DB notice dated 2026-01-13](https://www.deutschebahn.com/de/presse/presse-regional/pr-berlin-de/aktuell/presseinformationen/S-Bahn-Halt-in-Wedding-voraussichtlich-wieder-ab-Anfang-Februar-13715742)
describes fire damage and planned work, which does not establish the completed
roof geometry as of October. This is an uncertainty about the new detail,
not a claim that the station or roof is currently closed.

The station count is also corroborated by the
[S-Bahn operator's Ringbahn description](https://sbahn.berlin/aktuelles/artikel/150-jahre-ringbahn-was-fuer-ein-jubilaeum/).
Platform heights remain the existing declared display/LoD2 envelope heights;
this pass makes no new surveyed railway-level claim.

## Western motorway outlines

203 mapped A100/A115 source ways west of x=-1000 receive paired carriageway
edges. The selection is an explicit geometric filter over the complete retained
v179 source. OSM lane counts are available for 188 ways; the remaining ways use
a stated two-lane display-width estimate. Width is lanes × 3.5 m + 2.5 m;
it is not a road-width survey. Offset curves retain source bends. No asphalt
carpet, invented bridge deck, viaduct or new navigation surface is introduced.

All centerline sources stay untouched at their original 3.55 m cartographic
grade. New lines are offset by 0.01 m and follow the exact same terrain-relative
projection as `OuterThinOutlines`. Four mapped tunnel ways have dashed edges;
construction ways are excluded. Bridge/layer tags are retained in the receipt
but are not converted into invented elevation profiles. The existing A111 layer
is unchanged and is not duplicated. Native mode retains the project's sparse
cartographic line convention for these motorway outlines.

Current works are a reason to avoid claiming speculative final bridge shapes:
[Autobahn operator news](https://www.autobahn.de/aktuelles/news?tx_kesearch_pi1%5Bfilter_1_420%5D=syscat21)
and [DEGES Rudolf-Wissell-Brücke project](https://www.deges.de/projekte/projekt/ersatzneubau-und-fahrbahnsanierung-der-rudolf-wissell-bruecke-auf-der-autobahn-a-100/).

## Runtime, integration and checks

- `createRegionOutlinesV200` retains its original fourteen exact line batches
  and adds `createBerAirportV205`. BER: 4 drawn calls / 180,040 CPU geometry bytes;
  1 native call / 1,065,488 bytes, below 2 MiB in either mode.
- `createRailStationsV190` appends details inside existing station batches.
  Both modes retain 36 root children and have 74 mesh batches. The complete
  drawn layer is 13,076 instances / 1,074,872 bytes; native is 90,365 instances /
  6,910,364 bytes. All pre-existing test budgets remain unchanged.
- `createWesternMotorwaysV205(native)` is an additive OutlineLandmarks import.
  It uses finite local batches, standard day/night materials, computed bounds,
  static transforms and normal existing disposal; no timers or closures retain
  construction rows. All new JSON payloads together are approximately 155 KB.
- No textures, dynamic lights, touch detail reductions or new residency budgets.

Focused checks:

```sh
uv run python scripts/build_transport_refinements_v205.py
uv run pytest -q tests/test_transport_refinements_v205.py tests/test_region_outlines_v200.py
cd src/app
bun test --isolate --timeout 60000 tests/transport-refinements-v205.test.ts tests/rail-stations-v190.test.ts tests/region-outlines-v200.test.ts
bun --bun x tsc -b --pretty false
```

Useful review cameras (world x/y/z): BER eye `[9240,190,17730]`, target
`[8950,22,17420]`; Westhafen eye `[-1900,58,-1850]`, target
`[-1789.6,9,-1975.0]`; Schönhauser Allee eye `[3160,45,-3200]`, target
`[3069.5,10,-3308.8]`. Airport extents also include both complete runways;
the source and generated extents are finite and require no new world scope.

OSM contributions retain ODbL 1.0 attribution. Existing Geoportal notices remain.
The operator/project pages supply factual verification only and no copied media.
The bounded `ber-v205-parts-source.json` and `motorway-v205-lanes-source.json`
archives make the builder replay exactly in a clean checkout without any ignored
raw cache. A regression rejects raw XML parsing and verifies every replayed
payload against its committed content.
