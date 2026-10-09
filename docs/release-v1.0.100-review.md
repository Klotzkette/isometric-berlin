# v1.0.100 — Regional outlines, Berlin boundary and central courtyards

Step 10 implements the explicitly requested five Ortsteile, finite regional
outlines, boundary lines and named central refinements. The detailed original
city, 93 tour stops, controls and existing CPU/GPU residency limits remain.

## New coverage

[Five districts](east-city-v200.md): Adlershof, Niederschönhausen,
Alt-Hohenschönhausen, Neu-Hohenschönhausen and Oberschöneweide. Exact source
boundaries minus all previous coverage add 33.100176 km². The 199 new cells
contain 26,017 LoD2/OSM building envelopes, source roads, waters and open spaces.
All 1,677 older descriptors and their actual packet bytes are checked against
v1.0.99. The new manifest has 1,876 cells and fits the unchanged 2 MiB limit;
each new packet fits the previous transfer ceilings. Added compressed packet
storage is 57,070,292 bytes for both independent drawn/native readings, not an
eager memory allocation.

[Regional outlines](regional-outlines-v200.md): finite BER with T1/T2, piers,
tower and two runways; Grünheide (Mark)'s village around Werlsee and Peetzsee;
both complete mapped A10 directional rings. Source topology resolves eight
missing relation members through actual connecting OSM ways. No invented
straight joins or filled motorway interior. Fourteen static batches occupy
1.87 MB drawn / 2.47 MB native GPU buffers. Only the selected family is built.

[Berlin boundary and Wall](berlin-boundaries-v200.md): current ALKIS state
border in grey-green and complete mapped 1989 Grenzmauer layer in red. Two
indexed line batches preserve source vertices and disconnected parts; the two
explicit underwater-border sections remain historical lines, not wall masses.
The historical source is preliminary aerial-image mapping, not cadastral
survey accuracy. Total additional line buffers: 459,316 bytes.

Ordinary new district/region terrain uses the established y=3 outline datum.
This release does not claim a new regional elevation survey. Previously
measured park and landscape relief is retained. The established flood surface
scope remains unchanged; this outline request does not expand its water mesh.

## Central corrections

[Central sites](central-sites-v200.md) add measured LoD2 shells and restrained
facade recognition at Heckmannhöfe, the Delivery Hero headquarters and the
former HU barracks, plus the HU courtyard and Bebelplatz. Ten complete source
owners replace five exact coarse Heckmann owners and supplement retained HQ/HU
owners. The courtyard openings and real roof heights also govern navigation.
The drawn model occupies 1,110,744 GPU bytes in two batches; native uses
1,912,504 bytes in one batch.

[The intersection correction](central-sites-v200-correction.md) removes only
the erroneous above-ground extrusion of underground S-Bahn owner 98956069.
Its retained OSM record explicitly says underground, layer -1. The actual
street, tram wires and twelve neighbouring buildings remain.
[Three-phase native receipts](minecraft-construction-v200.md) reproduce the
old v192 baseline exactly with the new exclusions disabled, then account for
every removed instance and newly exposed neighbour window. The historical
fixture remains committed.

## Runtime and verification

Camera reach and conservative far clipping derive from the finite combined
scope; all new vertices stay inside. The region remains in the existing metric
coordinate frame, with less than 5 mm Float32 coordinate rounding. Source ground
is available before lazy visual construction, and mode switches retain the same
remote pose. The local walking minimap borrows nearby source polygons and rejects
distant cells without copying geometry or allocating another city raster.

Audited constructor fields are weakly cached. Tests compare actual factory
buffers, materials and transforms before/after collection and across the
strong-cache compatibility fallback. New groups share the established family
disposal and GPU residency manager. No timers, lights or image textures are added.
Additional geographic data has a finite cost; this is not a guarantee against
operating-system termination on every physical phone.

The full Python run collected 1,097 tests: 1,089 passed and four skipped;
four initial failures were outdated expansion assertions or the still-v199
local package. After the exact append-only receipt updates and package build,
all 88 tests in the affected modules pass. The final new-source tests also pass
(16), including full source-coordinate and complete topology checks.

The final integration Bun run passes 56 tests. The separate construction and
intersection audit passes 13 tests; five central-site tests include the actual
core navigation index, courtyard holes and source roof landing. Ruff format,
Ruff check, TypeScript and production build pass. Release-readiness checks pass
for the packaged v1.0.100 viewer.

Chrome and mobile WebKit each completed all six modes across 52 views without
page errors or unwanted runtime resets. Visual review caught architectural-ink
fading wrongly applying to the new boundary lines. A narrow exclusion for those
two marked line objects fixes this without changing older lines. The actual
collector/update/remount regression suite passes (32 tests). After rebuilding,
both browsers additionally passed 12 boundary views each across all six modes,
checking visible ancestry, authored opacity/depth behavior and family switching.
The red Wall course and state boundary were also reviewed in saved screenshots.

The final package passes release readiness and the local HTTP-launcher smoke
check. Both archives have SHA-256 receipts. The published site is built from
that exact package; older hashed assets are retained for already-open tabs.
