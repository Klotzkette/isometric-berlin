# Arkonaplatz — v1.0.93

Step 10 adds a small, static public-space layer through
`createArkonaplatzV193(minecraft = false)`. Existing building envelopes, park
surfaces, streets, steps, play areas and source paths remain unchanged. There
is no replacement of existing ground geometry and no regeneration of city
packets. A narrowly clipped central paving sheet corrects the previously
generic green surface beneath the market.

## Retained evidence

The cached 29 September 2026 OSM extract provides park relation **14583948**,
its two green/playground halves and the intervening paved market strip. The
complete source rings, path vertices and selected point features are retained
in `geo_data/regierungsviertel/arkonaplatz-v193-source.geojson`. Coordinates use
the existing metric viewer frame: x = EPSG:25833 easting − 389500;
z = 5820000 − northing. Source hashes are in the accompanying evidence JSON.

The park centre is `[2119.107336286351, -1988.0333650268071]`. The flea-market
anchor is OSM node **2736078705**, `[2124.525136126962, -1975.5765480604023]`;
the separately mapped Friday market is node **1302119815**. Berlin's
[official city portal](https://www.berlin.de/special/shopping/flohmaerkte/1998213-1724959-flohmarkt-am-arkonaplatz.html)
describes the small Sunday flea market beneath linden trees, with books,
records, furniture and second-hand objects. The
[operator](https://www.flohmarkt-arkonaplatz.de/oeffnungszeiten) confirms Sunday
operation. The scene is a representative market arrangement, **not current
occupancy**, a vendor survey or a timetable simulation. No specific stall,
vendor, sign, product artwork or person is copied.

The square has 129 mapped tree nodes within the convex envelope of its two
park halves, including their perimeter and the central strip. Of these, 95
lie strictly inside the mapped park polygon; the other 34 are on surrounding
paved edges or in the intervening strip. The canonical
park-details payload contains no matching trees here; the previous outer-city
generator supplies ground and buildings, not these tree nodes. The layer adds
all 129 exact anchors. Untagged height, crown spread, trunk width and green
shades are restrained display estimates. Minecraft keeps a deterministic
65-tree subset under the existing owner-requested tree reduction; all 129
source records remain available and every drawn mode retains them all.

Sixteen mapped bench nodes receive small slatted seats. Untagged orientation
and dimensions are declared estimates, facing the local square. Two mapped
C-shaped flowerbed rings receive narrow stone edge cues only. All trees and
props use `terrainGroundAt(x,z,3,native)` independently, so the two terrain
samplers remain consistent. The square crosses the Weinberg relief boundary: its
terrain rises from 3 m to approximately 15.7 m (15.86 m in the native sampling).
Tabletops and canopies retain rigid frames, but all 100 legs/posts reach the
individually sampled local surface; they no longer float or bury on the slope.

Fifteen small stalls occupy free parts of the central strip; ten have low,
light fabric canopies and five are open tables. Books/records, frame shapes
and old-radio cues are simple independent geometry. The offline placement
rejects actual grass/flowerbed/playground polygons, mapped trunks within 2 m
and all source footway/step corridors within 1.25 m of their centres. Stalls
also retain at least 0.8 m between their envelopes. The block representation
keeps at least a 2 m walking corridor despite conservative cube rounding.

## Central paving correction

Close visual QA showed that the earlier generic ground remained green between
the retained narrow path strips, incorrectly reading as lawn beneath the
market. The new paving is exactly the convex envelope of park relation 14583948
minus that **complete** park, restricted to a quadrilateral joining four exact
source park-endpoint vertices. Actual grass, flowerbeds and playgrounds, plus
small estimated 0.65 m apertures around mapped tree trunks, are subtracted.
This adds **1,884.103674 m²** only in the central paved strip, with no intrusion
into the park halves or unrelated thin wedges around their perimeter. All 15
stall envelopes are wholly inside it. It is a source-derived recognition
surface, not a separately surveyed paving polygon.

The warm-gray drawn sheet retains its outline and holes, triangulated and
subdivided through `drapeTerrainTriangle` at the active relief grid. Its top is
local terrain + 0.07 m, below the retained source paths at + 0.12 m. The native
reading independently uses 7,111 fully contained half-metre tiles, merged only
where adjacent tile heights are identical, with a top at native terrain +
0.08 m. This preserves native terraces and tree apertures without thousands
of separate draw calls. No old path, terrain vertex or public-space layer is
removed.

## Visual reference

[Berlin Arkonaplatz Flohmarkt.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Arkonaplatz_Flohmarkt.jpg)
— **Andreas Praefcke**, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
via Wikimedia Commons. The photograph was inspected for pale canvas, simple
metal/wood frames, tabletop stock and the leafy market setting. It is a
non-bundled reference; no image pixels or textures enter the viewer. Exact
metadata is in `arkonaplatz-v193-credits.json`. The city-portal photograph is
not used as a visual source.

## Bounds and verification

Each representation is four independently culled, frozen batches with
final-count buffers. Drawn: **1,085 instances / 352,604 bytes**, including one
triangulated paving sheet. Native: **5,201 instances / 397,868 bytes**. There are no new animation callbacks,
textures, lights, network requests or increased city-residency budgets. The
native market is a separate 24 cm world-axis block interpretation; it does
not retain a smooth duplicate. Trunks/crowns use compact independent native
boxes rather than a hidden solid voxel fill.

`uv run pytest tests/test_arkonaplatz_v193.py -q` passes four tests covering
source identity/ring retention, existing-tree deduplication, all market
clearances, exact paving/park separation, native containment and
provenance/bounded data. `bun test
tests/arkonaplatz-v193.test.ts` passes five tests (89,646 assertions) covering
ground anchors, source immutability, actual market geometry/path clearance,
both constructors, finite matrices, native axes, material disposal handles,
static transforms, buffer limits, every draped vertex, exact paving area,
native terrace heights and individual support feet. Focused Ruff checks pass. Viewer-wide
integration, visual comparison and release validation are recorded by the
parent task.

Fixed comparison poses are exported in `ARKONAPLATZ_V193_PROFILE.cameras`:
centre `[2120,24,-1980] → [2120,8,-2000]`, span 65 m;
market `[2125,17.1,-1945] → [2115,7.1,-1985]`, span 65 m.
These corrected close poses remain inside the public square.
