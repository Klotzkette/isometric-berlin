# Finite outskirts and landmark recognition — v1.0.87

The owner's 8 October request authorizes another bounded step-10 presentation
supplement: a more recognizable Funkturm, Olympiapark and Spandau, the southwest
through Dahlem/Zehlendorf to Mexikoplatz, Grunewald and the Wannsee shore, and
mapped eastern connections to Köpenick, Müggelsee and Tierpark Friedrichsfelde.
This is not a rectangular fill of all Berlin or a complete detailed model of
those boroughs. The original central city, its details and its 93-place tour
remain unchanged.

## Geographic selection

The new finite scope is in
[`bounds-outskirts-v187.geojson`](../geo_data/regierungsviertel/bounds-outskirts-v187.geojson).
The reproducible selection is recorded in
[`outskirts-v187-scope-evidence.json`](../geo_data/regierungsviertel/outskirts-v187-scope-evidence.json).
It combines five named neighbourhood windows with exact mapped street corridors
and selected landscape geometry:

| New neighbourhood window | Interpretation |
|---|---|
| Olympiapark | Named architectural/sports models and surrounding mapped context |
| Spandau Altstadt–Zitadelle | Initial city outlines and the distinct fortress reading |
| Steglitz–Dahlem–Zehlendorf–Mexikoplatz | Source street/building context, campus and farm ensemble |
| Tierpark Friedrichsfelde | Park context, mapped enclosures/barriers and named buildings |
| Köpenick Altstadt | Initial urban outlines, Schloss, Rathaus and St. Laurentius |

The street links follow retained OSM ways, including Heerstraße and the
Ruhleben/Spandau connection; Unter den Eichen, Berliner Straße, Clayallee and
Argentinische Allee; and the Frankfurter Allee/Treskowallee, Oberspree/Köpenick
and Müggelsee approaches. Source courses are buffered by 85 m for bounded
street-facing context. They are not straight invented lines between landmarks.
Repeated street names outside the stated western/eastern selection are excluded.

Grunewald woodland, its selected lakes, the Havel/Wannsee banks and Müggelsee
use mapped polygons within explicit landscape limits. A 40 m shore allowance
keeps the water edge and immediate land readable, including the opposite
Wannsee bank. The bounds are a union of these actual selections; intervening
unrequested areas are not implicitly rebuilt. Genuine parks, water, courts,
fields and other unbuilt spaces remain open.

The previous detailed-city, v182 ring-city and v183 coverage polygons are
subtracted exactly. The resulting **128.764 km² additional presentation area**
includes substantial forest and water; it does not mean that much new urban
construction. `bounds.geojson` is unchanged, and
`bounds-retained-v186.geojson` records the combined prior coverage used for
subtraction. Existing v179/v180 source outlines remain available.

## Source accounting and limits

The generated supplement manifest records:

| Quantity | Count |
|---|---:|
| Additional 512 m spatial packets per representation | 822 |
| Resolved building source records before dedicated-owner substitution | 46,551 |
| Records anchored to available official LoD2 parent envelopes | 8,082 |
| Remaining OSM building records | 38,469 |
| Illustrative new woodland trees | 10,794 |

These are source/delivery counts, not a claim of 46,551 independently surveyed
houses. Official LoD2 parents can contain multiple parts. Available LoD2
footprints and vertical envelopes have precedence; OSM contributes uncovered
building geometry and semantic context. Tagged metric heights and storeys are
used where present; remaining heights and untagged road widths have explicit
fallback provenance. The independent source inventory retains that evidence.

The retained Geofabrik Berlin extract is dated 29 September 2026 and licensed
**ODbL-1.0**. Official Berlin LoD2 is **dl-de/zero-2-0**. The supplement manifest
records source archive fingerprints, source URLs, height/width evidence and its
compressed inventory receipt. This pass introduces no photographic materials.

Generic new outer terrain stays at the established flat presentation datum
`y=3 m`; this is a declared display estimate, not a new DGM terrain survey.
The sparse woodland trees are deterministic illustrative placement within
mapped woods, approximately a 42 m sampling lattice with small offsets. They
avoid mapped paths, roads, rail, water and buildings. Their positions, heights
and crowns are not individual official tree measurements.

## Named models and source conflicts

The additional model families are described separately:

- [Western landmarks](west-landmarks-v187.md): Funkturm steelwork/decks,
  Olympiastadion and sports facilities, Glockenturm and Zitadelle Spandau.
- [Southwest landmarks](southwest-landmarks-v187.md): modest additive Steglitz
  edges, complete FU and Domäne Dahlem source parts, Mexikoplatz station.
- [Eastern landmarks](east-landmarks-v187.md): Tierpark buildings and mapped
  zoo features, plus the Köpenick architectural group.

Known measured envelopes and source roof/ground sheets stay distinct from
recognition annotations such as glazing divisions, bell-chamber members,
terraces or the Mexikoplatz cupola. Documented source-model conflicts, including
the closed generic Olympic bowl and upper bell chamber, retain their original
profiles in the evidence and receive explicit presentation treatment. No
claim is made that all small architectural components are surveyed.

Dedicated full models substitute only documented new source-owner footprints;
the original source inventory remains. Exact prior city packets and existing
Steglitz details are preserved. Navigation uses the dedicated displayed parts
rather than spreading one compound parent's tallest roof across its entire
footprint. The stadium's open sunken bowl has its own bounded ground treatment.

## Delivery and validation boundary

The new packets append to the existing bounded serial loader. Its mobile
loading/residency budgets and the previous city detail are unchanged. Geometry
is prepared offline, indexed/instanced and spatially culled. The separately
selected drawn and native Minecraft readings do not allocate a second active
city. Drawn touch and pointer devices receive the same source detail. No new
image textures, reflection targets or per-frame geometry construction are
introduced by these additions.

The expanded downloadable data set is larger, but its geographic coverage is
not eagerly instantiated in full at startup. Finite packets and independently
culled named-model groups constrain active rendering work.

Reproduction uses `scripts/build_outskirts_v187.py` and the three documented
landmark generators. Source/ownership checks, measured budgets and standalone
model tests are recorded in their respective documents. Integrated browser,
mobile, packaging and publication verification belong to the release review;
this scope document does not assert that publication has already completed.
