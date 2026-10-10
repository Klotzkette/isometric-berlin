# Step 10 — BMAS campus and Quartier 206, v1.0.108

This bounded refinement addresses the existing Berlin BMAS campus and the
existing Quartier 206 shell. The BMAS contact page identifies Wilhelmstraße 49
and the visitor service at Regine-Hildebrandt-Haus, Wilhelmstraße 50. Its own
visitor tour distinguishes the main building, Kleisthaus, former
Ritterschaftsbank, southern extension and Regine-Hildebrandt-Haus. These are
parts of this one source-bound campus, not permission to invent additional
BMAS office addresses. Historical Mohrenstraße addresses in the photographic
references describe their dated captions.

## Retained owners and source geometry

The BMAS campus uses OSM `way/1351208381` and 25 official LoD2 leaves from these
six parent families:

| Parent | Photographic / official identification |
| --- | --- |
| `DEBE01YYK00001ld` | Main office wings |
| `DEBE01YYK00004My` | Kleisthaus |
| `DEBE01YYK000054P` | Former Ritterschaftsbank |
| `DEBE01YYK0000FJA`, `DEBE01YYK00001xE` | Southern additions |
| `DEBE01AL5DR00005` | Regine-Hildebrandt-Haus |

Quartier 206 uses all 16 existing `officialParts` in
`gendarmenmarktPerimeterSource.json`. Only its exact old decorative facade
recipe is replaced by the default-true `includeLegacyQuartier206Facade` gate;
production passes false. All source sheets, every other perimeter facade,
source voxels, navigation and tour entries remain intact. The new Quartier
206 overlay follows exactly the 23 previously identified street-wall faces.
No courtyard wall, glass canopy, tenant branding or new circulation barrier
is invented. The source receipt retains source-coordinate rings, holes,
individual parts, the old placement offsets, source hash receipts and the
independent native enclosure receipt.

## Architectural reading

BMAS street facades receive pale Muschelkalk, four-storey narrow framed-window
rhythms, sills and hoods, and the three tall framed Mauerstraße portals.
Kleisthaus receives its rustication, giant-order pilasters, capitals and
cornice dentils. The bank has rustication, two round-headed window rows,
rectangular intermediate openings, small attic windows and a dentilled eave.
The southern office additions and six-storey Regine building have pale stone,
punched openings, thin courses, glass and selected cream blinds. Unobserved
opposed interior-court windows are not newly generated; all earlier courtyard
geometry and detail remain visible.

Quartier 206 retains its measured projecting parts and roof construction.
Its new thin finish adds pale limestone courses, dark window ribbons, fine
stone joints, mullions, storefront transoms, the heavy cornice and tall corner
glazing. Six upper levels and the storefront share one prevailing street-eave
datum, so short source oriel sheets cannot acquire six compressed storeys.

Every window rhythm, RGB colour, frame depth, blind position, portal
proportion and stone course is a bounded visual estimate, not a facade survey.
Existing measured roof/footprint vertices and open courts remain unchanged.
Source wall readings are aligned to the vertical XZ projection of their
retained source planes; tiny original source-wall inclinations remain in the
complete source shell. Photographs and protected plans are not bundled or used
as runtime textures. Six freely licensed visual references and the official
building descriptions are individually recorded in
[`labour-quartier-v208-sources.json`](labour-quartier-v208-sources.json).

## Native visibility, memory and verification

Minecraft uses its own axis-aligned finishing members. Their complete
horizontal and vertical extents clear a conservative union of the unchanged
original 4 m voxel columns, independent Alt-Mitte v169 1 m spans and the
retained dedicated 2.5 m Quartier 206 shell. The Bun test independently
constructs the actual latter shell and compares every new Q206 block against
its runtime matrices. The source model is never erased to expose a new pane.
When an unchanged quantized peer closes a source recess, no new finishing tile
is placed inside it or moved across the neighbouring building. These new-only
omissions are recorded by family; they do not remove earlier detail.

Native members are subdivided at at most 2 m along BMAS fronts and 2.5 m along
Quartier 206, retaining their length, height and colour. This avoids thousands
of unnecessary one-metre duplicates without changing prior geometry. Full
static detail is identical on desktop and touch devices. Each new world owns
its buffers and materials; instanced arrays are allocated once at exact size.

The frozen implementation has 9,883 drawn instances plus 156 veneer triangles
in two draw calls, or 18,004 native instances in one draw call. Each
representation uses less than 1.5 MiB of geometry attributes and indices. There
are no images, textures, per-frame work, new chunks, residency increases,
collision changes or new tour stops. Existing shared mode lighting applies.

Focused verification: three Python checks cover input hashes, all original
Q206 source data and placements, exact face clipping and every native box
against independently reconstructed old source columns. Three Bun checks
cover actual Q206 shell clearance, complete touch allocation parity, fixed
buffer sizes, terrain offsets, absence of textures, frozen transforms and
per-world disposal independence.

Rebuild with `uv run python -m scripts.build_labour_quartier_v208`.
