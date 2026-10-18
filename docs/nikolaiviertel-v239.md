# Nikolaiviertel and Nikolaikirche — v239

Step 10 adds bounded recognition to the existing Nikolaiviertel. The complete
v169 LoD2 models already supply the measured walls, roofs and courts; the old
outer-v159 resolved-outline table is historical evidence, **not** the current
rendered ownership. No old roof, wall, window, packet, navigation record or core
owner is removed or replaced by this pass.

## Scope and source retention

The finite selection follows OSM residential/heritage way `312391532`, retrieved
19 October 2026 (51,580.705 m²). It is an existing neighbourhood inside the
approved coverage, not a new coverage polygon. Source records must have at least
98% of their complete footprint inside that boundary and more than 50 m² area.
This selects **35 active official families / 68 parts** from the retained
`alt-mitte-v169/source-391_5819-00.json.gz`. All selected records are copied
verbatim into `nikolaiviertel-v239-source.json.gz`, including every original
coordinate, polygon ID, hole, inherited height datum and ownership binding.
Seven retained/conflicting families remain unmodified and receive no speculative
second source shell. Smaller auxiliary records likewise remain untouched.

The original `4_0.drawn.json.gz`, `4_0.minecraft.json.gz`, core LoD2 prism file
and core voxel file have frozen SHA-256 receipts. The builder asserts all four
before writing the separate addition. The new packet contains no ground or
navigation solids. Roads, public squares, the church approach, courts and all
existing street furniture remain intact. The source archive records the bounded
OSM map URL/hash, exact entrance identities and authoritative references.

## Recognition and measured/estimated distinction

| Place | Exact retained official owner | Addition |
|---|---|---|
| Nikolaikirche | `DEBE01YYK00001VX` | Two octagonal copper spires, terminal masts, western stone string courses, measured roof-edge accents and mapped west-door surround |
| Ephraim-Palais | `DEBE01YYK00004FS` | Paired slender pilasters along the measured rounded corner, belt profiles and open gilt balcony rail members |
| Knoblauchhaus | `DEBE01YYK00003ze` | Lintel and sill profiles around retained aperture positions and measured eave/roof outlines |
| Gerichtslaube | `DEBE01YYK00009Rh` | Brick-toned lintels and measured roof/cornice accents; no invented arcade excavation |
| Zum Nußbaum | `DEBE01YYK00009i8` | Small lintel, eave and measured gable/roof accents |
| Existing surrounding houses | Complete IDs in the source archive | Thin eave profiles, source-wall downpipes and actual roof-edge accents |

The source geometry of the church comprises two parts and includes the broad
western tower body, but its highest point is only 54.1 m above its ground. The
same retained OSM identity `way/23813200` explicitly maps **84.4 m overall tower
height**. The independent addition restores the documented two-spire silhouette
without deleting or flattening any measured source roof.

The tower parent is `DEBE01YYK00001VX`; the western tower part is
`DEBE3DJ5QoacFhgE`. Two positions are derived from quarter points along that
part's minimum rotated rectangle, centred on its footprint:

- `[2410.700, 291.266]` and `[2410.587, 281.107]` in viewer X/Z.
- The additive copper profile starts at viewer Y `56.95` and ends at `87.4`,
  which equals the existing church ground Y `3` plus mapped total height `84.4`.
- Spire sectional radii, rib thicknesses, the intermediate break and finials
  are explicit procedural estimates, not a surveyed reconstruction. The metric
  source establishes the tower location and total height, not those sections.

All other members are thin additions against actual source planes or exact roof
edge courses. No new ordinary-house window grid is generated. Named-house
lintels/sills deliberately reuse the established v169 aperture rhythm; earlier
glass, mullions and complete window counts remain visible and unchanged.
Detailed colours, dimensions and rhythm remain architectural recognition
estimates. A source roof edge does not establish a surveyed gutter, so downpipe
and cornice placement is labelled interpretation rather than measured fittings.

Exactly two currently mapped entrance nodes qualify for surrounds:
`node/540682142` at official owner `DEBE01YYK0000742` (0.415 m from its source
wall) and `node/1096083389` at the church west wall (0.033 m). The addition makes
no new navigable opening or interior, and does not invent doors at the named
houses lacking a qualifying mapped node.

## Primary evidence

- [Berlin monument inventory: Nikolaiviertel, 09011266](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011266)
  establishes the distinction between retained historical buildings, reconstructed
  houses and the 1980s panel-built ensemble, with its gable groups and arcades.
- [Berlin monument inventory: Nikolaikirche, 09011267](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011267)
  establishes the stone westwork, brick hall/ambulatory, Blankenstein's twin
  spires and reconstructed Gothic detail. The source inventory is kept intact.
- [RAO, contracted restoration of the Nikolaikirche](https://www.rao-berlin.de/projekt/denkmalrestauration-der-nikolaikirche-berlin/)
  identifies the fieldstone lower tower, brick upper work and copper helmets.
- [Berlin monument inventory: Ephraim-Palais, 09011270](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011270)
  and [Berlin's historical account](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/berlin-mitte-codes/artikel.1135546.php)
  establish the rounded Rococo corner, paired columns and gilt balcony railings.
- [Berlin monument inventory: Knoblauchhaus, 09011272](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011272)
  and [Knoblauchhaus operator](https://www.knoblauchhaus.de/) identify the retained
  house at Poststraße 23, distinct from the reconstructed neighbouring ensemble.
- Museum identities are checked against the operator's
  [Nikolaikirche](https://www.berlin.museum/museum/nikolaikirche) and
  [Ephraim-Palais](https://www.berlin.museum/museum/ephraim-palais) pages.

No reference photograph, protected plan, image texture, downloaded font or logo
is bundled. Geometry attribution remains Geoportal Berlin (dl-de/zero-2-0) and
© OpenStreetMap contributors (ODbL-1.0).

## Delivery, memory and tests

Integrate the one descriptor from
`nikolaiviertel-v239-manifest-addition.json`: **`nikolai239-4_0`**. Both families
use the existing cancellable city packet loader. No required runtime replacement
or custom global scene group is needed, and no residency/prefetch cap changes.
All drawn modes share the same complete detail on desktop and mobile. Native
mode uses independent axis-aligned 0.75 m stepped members and a 1 m surface-only
spire skin; it does not rotate the drawn geometry or fill hidden spire interiors.

| Family | Compressed bytes | Decoded bytes | Vertices | Indices | GPU array bytes |
|---|---:|---:|---:|---:|---:|
| Drawn | 122,773 | 440,435 | 11,964 | 55,620 | 254,808 |
| Native | 767,068 | 3,184,295 | 82,091 | 412,308 | 2,634,324 |

Each family contributes one ordinary packet mesh/draw call. Source archive size
is 95,653 bytes and it is not loaded by the viewer. The small addition keeps the
existing packet/byte/residency limits and all prior city data.

Five focused tests verify exact retained record equality, frozen prior payload
hashes, finite mapped selection, twin-spire positions and height, source entrance
matching, manifest hashes/lengths, empty navigation, bounded memory, orthogonal
native normals and absence of replacement glazing or shells. Run:

```
uv run python scripts/build_nikolaiviertel_v239.py
uv run pytest -q tests/test_nikolaiviertel_v239.py
```

Visual review targets: Nikolaikirche `[2440,40,285]`, west approach
`[2330,45,290]`, Ephraim-Palais `[2415,15,391]`, Knoblauchhaus `[2405,11,327]`.
The full runtime/mobile/mode review belongs to the integrated v239 release.
