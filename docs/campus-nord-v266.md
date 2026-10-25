# Campus Nord: Mensa, Rhoda-Erdmann-Haus and Tieranatomisches Theater

Step 10, v266, checked 25 October 2026. The bounded supplement retains all
eleven parts of the Mensa's former Charité washhouse at Hannoversche Straße 7,
all three parts of the Rhoda-Erdmann-Haus at Philippstraße 13, and the complete
existing v155 Tieranatomisches Theater. No tour stop, coverage, residency,
decode, prefetch or touch-detail limit changes.

The [Mensa architect](https://www.peb-plus.de/mensa-nord) documents the 2005–09
conversion, glass foyer and garden dining room. Its project photograph shows
red brick, pale horizontal brick courses, shallow segmental window heads,
attic grilles and thin dark foyer framing. These are source-wall-bound display
estimates, not surveyed window coordinates. The photograph is external
reference only; its author is not individually credited on the project page.
The [operator](https://www.stw.berlin/mensen/einrichtungen/humboldt-universit%C3%A4t-zu-berlin/mensa-hu-nord.html)
confirms the distinct address. All eleven measured parts stay; this includes
the small `NCyflTcN` boundary appendage omitted by an initial ten-part count.

The [Rhoda-Erdmann-Haus architect](https://bodamer-faber.net/projekte/bildung/forschungs-und-laborgebaeude-fuer-lebenswissenschaften-der-humboldt-universitaet-zu-berlin/)
documents the three/four-storey step, two entrances and conserved courtyard.
Werner Huthmacher's exterior photograph supports the horizontal glazing and
three green metal band tones. The existing LoD2 polygon facets supply the
curved perimeter; thin strips follow every exposed edge. The roof and retained
height step remain intact. No roof plant or new courtyard building is invented.

The [theatre restoration architect](https://mueller-reimann.de/projekte/anatomisches-theater-humboldt-universitaet)
provides current exterior photographs by Stefan Müller. The complete existing
v155 body, dome, drum, Gerlach wing, windows, cornices and reliefs remain. Only
fine dome standing seams, radial fanlight bars and frieze grooves are added.
Their coordinates follow the existing source-ring bays and faceted/native
roof height function. File hashes record the unmodified earlier constructor,
source and profile.

## The one required source correction

`DEBE01YYK0001xN5` / core `K0001xN5` is the U-shaped projecting Mensa foyer
canopy. Its official LoD2 volume includes nine ground-to-roof closing wall
sheets, but the architect's photograph shows an open cantilever. Keeping this
solid would conceal the entire new glazed foyer. The exact source is retained
in the evidence, including every original wall, ground and roof vertex.
Only its closing proxy walls yield after required replacement construction.
The complete measured nine-vertex roof remains at source world Y 10.527m;
the separate foyer and its source height remain untouched. Small source height
differences between canopy/foyer are retained, not silently homogenised.

Immutable Alt-Mitte v169 geometry duplicates that same owner. The dedicated
receipt reproduces its unchanged full source model and transfers exactly
25 shell triangles, 104 facade triangles, 470 native triangles and 24 exclusive
ink segments. Shared ink and every other triangle remain. Packet fingerprints
fail closed on changed data. The former canopy navigation leaf uses its exact
full ring/height/source fingerprint. Two exclusively owned coarse core voxel
columns may yield; mixed columns remain. The independent Alt-Mitte native
owner is fully transferred, so no neighbouring native owner is rebuilt.

The elevated canopy collider spans Y 10.387–10.547m, leaving the existing
ground route clear. Drawn collision uses the measured ring; native collision
uses the exact half-metre squares rendered for the roof. No new ground slab,
stairs or speculative support column is added. Existing terrain/path data
remains authoritative.

## Integration and validation

`createCampusNordV266(native, {mobileLike?, diagnostics?})` is one required
static model transaction in each family. It must succeed before enabling
`isCampusCanopySourceV266`, `createCampusCanopyColumnTesterV266`, the two exact
packet-transfer generators and `isCampusCanopyPreviousPartV266`. Navigation
uses `campusCanopySolidsV266` for both modes with live mode gates. All helpers
are in the small `CampusNordV266Profile.ts`; none changes a global budget.

The new native family consists entirely of axis-aligned boxes, including
facade strips on oblique source walls. Drawn/touch detail is identical. One
instanced material pair serves all fittings; the drawn measured roof is a
second renderable. Runtime source excerpt is about 8.5KB and the packet
receipt 4.6KB. Diagnostic row arrays are temporary unless explicitly requested.
No photographic texture is bundled, decoded or loaded by the viewer.

Measured totals: drawn 9,995 instances, two renderables and 760,772 geometry/
instance attribute bytes; native 24,591 instances, one renderable and 1,869,564
bytes. The native canopy's 434 roof squares share their exact rings and heights
with navigation. These are deterministic full-detail totals, including touch.

Focused Bun checks cover complete roof vertices, exact and changed source
fingerprints, passable ground below the canopy, rendered/native collision
agreement, exact packet transfer with changed-payload rejection, finite
orthogonal matrices, buffer bounds and identical touch detail. Two Python
checks rebuild the evidence, verify retained theatre files, test all foreign
core owners against exclusive cells and hash the immutable Alt-Mitte packets.
The separate full-source navigation test preloads Alt-Mitte navigation and uses
the complete core voxel/prism payloads. It walks the whole canopy-front segment
in drawn, native and drawn again using one live obstacle index, without respawn
or height jumps, and checks solid roof height with free space below and above.
At the southwest roof tip it also verifies the real drawn/native footprint
difference after each live mode switch, catching a stale drawn-only collider.

Suggested internal-browser cameras:

| Site | Position | Target |
| --- | --- | --- |
| Mensa glazed front | `[672,42,-932]` | `[735,11,-1010]` |
| Rhoda-Erdmann-Haus | `[650,74,-800]` | `[750,14,-865]` |
| Tieranatomisches Theater | `[617,48,-626]` | `[679,14,-678]` |
| Whole bounded campus | `[550,165,-806]` | `[726,14,-850]` |

The canopy-only ground sample is `[723,-998]`; front walking segment is
`[719.7,-1002]` to `[726.2,-994]`, under the preserved roof and outside the
retained glass foyer. Use the live terrain height, approximately world Y 5.2m.
