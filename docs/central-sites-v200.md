# Central sites v200 (Step 10 / v1.0.100)

This bounded round improves Heckmannhöfe, the Delivery Hero headquarters frontage,
the former barracks on Geschwister-Scholl-Straße, the HU main building's north
garden-facing walls, and the existing Bebelplatz pavement. It does not expand
coverage or reduce any previous packet. No photographs or textures are shipped.
The separate [crossing correction](central-sites-v200-correction.md) removes one
misinterpreted underground station, not a real street-corner building.

## Identity and scope

All building IDs below have prefix `DEBE01YYK000`.

| Site | Measured owners | Treatment and evidence limit |
| --- | --- | --- |
| Delivery Hero | `04EC`, `0C4T` | The company's current address is Oranienburger Straße 70. `04EC` is the postwar corner institute (1958–1963), `0C4T` the historic telephone exchange along Tucholskystraße 6–14. The latter gets documented clinker, projecting vertical piers and clay-plate inserts. The corner keeps a restrained neutral palette; its exact material is not established by the primary text. |
| HU former barracks | `08Om`, `04Qe`, `06Bw`, `02p7` | Kaiser Alexander-Garde-Grenadier-Kaserne, Geschwister-Scholl-Straße 7/8, 1898–1902. The western university parts and the eastern historic counterpart receive bounded sandstone/plaster/brick cues and window frames. Their original measured roof/gable/tower forms remain. The simpler western reconstruction does not acquire a copy of the eastern tower ornament. |
| Heckmannhöfe | `0BdM`, `01Gd`, `04Hv`, `025l`, `0Epg`, `05xT`, `05n7` | Three real courts from Oranienburger Straße 32 toward Auguststraße. The first/rear residential houses and lower commercial/coach-house fronts get different restrained proportions. Sandstone/terracotta restoration colors are documented for Auguststraße 9; exact colors of the other yard fronts are estimates. Existing measured court holes and open spaces remain. |
| HU main building | `0Cm9` | Only six unembellished north garden-facing wall planes. The 17-axis Linden front, Corinthian order, sculpture, gates, southern forecourt and v168 ornament remain untouched. No second HU shell. |
| Bebelplatz | OSM way `205728152` | Sparse texture-free joint lines within the existing measured `surface=sett` plaza. The original library room, glass aperture and roof patch are excluded. These joints are display estimates, not a surveyed paving plan. |

Primary references and their deliberately limited claims are frozen in
`geo_data/regierungsviertel/central-sites-v200-source.json`: Delivery Hero's
imprint, the Landesdenkmalamt entries 09035281, 09020488, 09075018, 09080251,
09035042 and 09095954, the Forum Museumsinsel owner, and the Heckmannhöfe
operator. The local LoD2 source records supply measured position, height and roof
forms; OSM supplies identity/context and the existing site/plaza outline.
Building envelope data retains the existing Geoportal Berlin dl-de/zero-2-0
attribution and OSM context retains ODbL attribution. No new Commons files are
used. Colors, window pitches, floor subdivisions, shallow framing and relief
thicknesses are explicitly estimates; no individual opening is claimed surveyed.

## Source geometry, replacement and passage protection

Ten owners were previously retained *reference-only* LoD2 records because the old
OSM-to-LoD2 family matcher was conservative. Their complete non-ground wall and
roof sheets now render once in the new factory. The three already rendered
owners and HU main building receive facade presentation only. Every old input
record and all old packets remain byte-identical. Exact source polygon IDs and
record hashes are recorded in `centralSitesV200Evidence.json`.

The generator selects only ground-connected vertical walls with free outward
space, checks every 0.35 m subspan, clips facade members against both the original
wall polygon and its retained clear intervals, and never bridges a hole with a
bounding rectangle. Heckmann selection stays on actual court-facing planes and
the two entry houses; HU garden selection stays north of the already authored
front. All 12,735 box projections are checked against these source polygons.
No new free-standing court wall, invented passage closure, tower or courtyard
roof is introduced. New collision footprints preserve every original hole;
roof heights interpolate the original planar roof triangles.

Only five complete Heckmann placeholder families are replaced at runtime:

| Old prism | New complete parent | Exact old native columns |
| --- | --- | ---: |
| `-5759915` | `0BdM` | 60 |
| `80339718` | `04Hv` | 9 |
| `86993630` | `0Epg` | 9 |
| `86993613` | `05xT` | 4 |
| `86993634` | `05n7` | 17 |

All 99 column centers belong to these exact old footprints, with no other
retained prism at their centers. The predicate checks each frozen center and
its original bottom/top before terrain translation. Native heights include the
original four-metre rounding; a matching point with another height is retained.
The receipt includes the complete old prism and source footprint. Source union
coverage is complete under the existing 0.25 m source quantization allowance;
raw unbuffered differences are narrow edge strips of 2.765, 0.460, 0.243, 0.426
and 0.318 m², not missing building parts. This is an exact source-owner upgrade,
not geographic culling. `centralSitesV200ReplacementProfile.ts` owns these five
IDs; the unrelated station correction uses a different explicit set.

Delivery Hero prism `99124892` and HU prisms `43088813`/`65316158` remain intact,
including the older family's unmatched 20.948/13.151 m². Measured roof planes of
`04EC`/`0C4T` are at least 28.776/30.117 m above the world datum, higher than the
old drawn/native roofs at 20.2/21.2 m. `04Qe` and `06Bw` are at least
26.766/20.402 m where they intersect the old main prism (top 17.5 m). The low
`08Om` annex roof is 8.77 m, above the separate old annex roof at 7.3 m drawn or
8.3 m native. At its junction, the retained main prism overlaps 0.128772 m² of
low roof in a narrow quantized strip, bounds `[1355.795,-308.308,1356.073,-304.692]`.
That existing geometry is intentionally retained; the adjacent measured high
wall is also complete. No unsupported blanket removal masks this difference.

## Runtime and performance

`CentralSitesV200.ts` exports `createCentralSitesV200(native)`. The existing lazy
outline landmark family constructs one mode at a time and owns disposal. The
same static data and details are used on desktop and touch. Drawn uses one
source-sheet mesh plus one exact-sized instance batch; native uses one instance
batch. Native source shells are surface-only one-metre cells; fine facade cues
use the established half-metre lattice. Same-color touching cells are coalesced
without changing their cube union. Drawn paint/frame/glass/mullion layers use the
validated v197 depth separation. No textures, shadow maps, animation, global
camera changes or increased streaming budgets are introduced.

Final payload: 15 owners including the plaza, 10 newly rendered complete source
shells, 110 selected wall planes, 1,317 drawn triangles, 12,735 drawn boxes and
25,156 native runs. The exact GPU allocation is 1,110,744 bytes in two drawn calls
or 1,912,504 bytes in one native call. The runtime JSON is approximately 2.78 MB
raw / 265 KB gzip. `surfaces`, `boxes`, `blocks` use the existing exact weak-data
allowlist so decoded construction arrays are not held strongly across mode
changes. Evidence is not imported into the runtime factory.

`centralSitesV200NavigationForPrism(id)` exposes source polygons and the rigid
terrain lift for early core obstacle registration. The five replaced Heckmann
prisms use their source roofs; HQ/HU source obstacles are additional and deduped
by source ID. `centralSitesV200RoofAt` is for landing/roof collision, not a global
ground sampler. `centralSitesV200SolidAt` remains the source-bound collision helper for tests;
production uses the early core index and adds no duplicate late obstacle. No
walking camera is teleported onto a roof.

## Reproduction and verification

```sh
uv run python scripts/build_central_sites_v200.py
uv run python scripts/build_central_sites_v200_replacements.py
uv run pytest tests/test_central_sites_v200.py -q
uv run ruff check scripts/build_central_sites_v200*.py tests/test_central_sites_v200.py
cd src/app
bun test tests/central-sites-v200.test.ts
bun --bun tsc -b
```

The Python tests check every emitted facade box, all supplied source polygon
identities/vertices, source hashes, every original courtyard hole, the memorial
exclusion, the five exact replacement owners and 99 unique native columns,
budgets, and deterministic regeneration. Bun checks both factories, exact
terrain datums, static/disposable ownership, native orthogonal transforms, roof
collision/landing, untouched public court points, and height-safe replacement.
Root owns integrated Viewer screenshots, release checks and package validation.
