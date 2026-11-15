# Schwanenwerder and Pfaueninsel

Schwanenwerder now uses **111 complete official LoD2 building families, 206 leaf
parts and 2,178 source sheets** for villas and ancillary buildings. These replace
91 exactly identified former OSM extrusion owners across four existing V187
streamed tiles. Every source wall, roof pitch, wing, footprint ring and courtyard
hole is retained. Drawn roofs use measured triangles; Native is a separately
sampled cardinal exterior with matching merged roof-cap navigation. The island,
bridge, existing streets, vegetation, shoreline and all unrelated buildings stay.

The finite island boundary and **97 current mapped building footprints** come
from the [Geofabrik Berlin extract](https://download.geofabrik.de/europe/germany/berlin.html)
with data through 13 November 2026. Complete measured families come from the
Geoportal Berlin [LoD2 375/5812](https://gdi.berlin.de/data/a_lod2/atom/LoD2_375_5812.zip)
and [LoD2 376/5812](https://gdi.berlin.de/data/a_lod2/atom/LoD2_376_5812.zip)
tiles (dl-de/zero-2-0). The retained source contains exact geometry, current OSM
matches, hashes and the old-owner replacement graph. The building families must
match current mapped footprints; uncertain groups are excluded together rather
than leaving partially replaced buildings.

The six retained ambiguous owners are OSM ways 1221242897, 231631979, 289803766,
289803767, 557785975 and 557785986. Their previous complete geometry remains;
they are not claimed as newly measured. Neutral finish, window widths and fine
subdivisions on the 111 measured bodies are explicitly **recognition estimates**,
not a photographic survey of every private villa. The 1,811 aperture groups are
clipped to the actual exposed source wall, preserving roof shapes and avoiding
internal joins. Garages and sheds do not acquire residential window grids.

Public heritage references identify the historic ensemble without personal
occupant information: [Haus Monheim](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075575),
[Schwanenhof](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075236) and
[the garden at Inselstraße 28](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09045954).
The [Berlin municipal island description](https://www.berlin.de/tourismus/inseln/10383658-6228302-schwanenwerder.html)
confirms the mix of historic and later houses, the bridge and ring road, and the
lack of public shore access. No fictional public shoreline path is added.

Pfaueninsel retains its complete V194/V326 island, mapped paths, gardens,
Kavalierhaus, Meierei, Maschinenhaus, Luisentempel and six roaming peacocks.
Current post-restoration photographs on the
[SPSG palace restoration page](https://www.spsg.de/schloesser-gaerten/masterplan/sip2-projekte/schloss-pfaueninsel-gesamtsanierung)
were visually inspected: Daniel Lindner's garden frontage and Andreas Wendt's
upper-tower view. Their image hashes and credits are in the evidence. No image
pixels or restoration mural artwork enter the viewer.

The previously missing raised clock drum, clock faces, blue-grey zinc dome and
finial now sit on the correct southern source tower. Annular cornices, corbels,
open arched iron bridge braces and vertical struts enrich the existing body.
These small dimensions are photo interpretation anchored to the exact source
tower centres. The original 99 Drawn fittings and all 222 Native boxes stay.
The added mesh has 3,230 Drawn or 962 independent cardinal Native triangles.
Its roof/navigation follows the actual final representation, including the
higher Native finial cell.

The castle attachment validates the actual host's surface/index bytes, all
instance matrices, colours and box geometry before constructing anything. It
shares that exact castle group's attachment and disposal. Navigation closes
when that host or detail is detached, hidden, altered or disposed. Legitimate
GPU retirement and source interleaving remain supported. The outer outline
layer exposes the same gated solid/roof callbacks; changing family releases the
old reference before rebuilding.

Schwanenwerder uses eight lazy SourceQuarter plans, with exact whole-owner
triangle, roof-ink and navigation retirement. Published V190 first-contributor
height offsets are replayed for the five affected old owners, including shared
walls; other triangles and navigation remain unchanged. The raw recipe is
3,945,078 bytes, gzip 1,231,038 bytes; maximum measured decoded tile geometry is
918,960 bytes. Pfauen construction arrays are independently lossless/weak, about
65 kB compressed together. All live packet, startup, residency and Worker limits
remain unchanged. Mobile uses identical Drawn detail.

Validation: four focused Bun tests, 1,302 assertions, 58 sampled villa roofs,
all eight actual packet transfers and six castle roof rays; negative tests for
wrong family, missing body, modified source matrices and detached host. All
Native castle triangles are cardinal. A full `createOuterThinOutlines` smoke
verified Drawn/Native roof callbacks and their closure after complete disposal.
Both Python compilers pass Ruff.

Reproduce with `uv run python scripts/build_schwanenwerder_v346.py`; its checked-in
source is sufficient. `--extract` additionally requires the two hashed LoD2
archives, the current shared PBF and the retained V187 source inventory.
`uv run python scripts/build_pfaueninsel_details_v346.py` uses retained V194
source geometry and pinned inspected-photo metadata. Run the focused tests with
`bun test tests/schwanenwerder-v346.test.ts tests/pfaueninsel-details-v346.test.ts`
from `src/app`.
