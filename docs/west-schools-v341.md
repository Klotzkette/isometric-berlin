# School and City West fine detail — v341 / Step 10

This bounded pass improves the two named schools, the northern planted areas
at Savignyplatz and the existing commercial glazing along Kurfürstendamm and
Tauentzienstraße. It retains the complete earlier measured buildings, roofs,
windows, furniture, streets, paving, navigation and native envelopes.

## Existing architecture and source support

- **Gymnasium Steglitz:** inset cream-grey sash beads and a split lower
  meeting rail fit inside the already corrected historic panes. They use the
  admitted v250/v251/v273 opening rows and remain disabled if the preceding
  photo correction is not admitted. The sport hall, Aula, clock gable, modern
  wing and original mullions remain intact. The source is the owner's earlier
  courtyard/Heesestraße photographs, the
  [school](https://gymnasiumsteglitz.de/) and its retained
  [virtual tour](https://rundgang.gymnasiumsteglitz.de/#g281). This does not
  infer another window register or claim an aperture survey.
- **Gymnasium Tiergarten:** narrow pale aluminium profiles add depth to the
  existing source-supported jambs from v274. The
  [architect's renovation project](https://tgw-architekten.de/menzel-oberschule/)
  was checked again, including its facade photograph. It shows the retained
  white rendered modern block, red vertical members and narrow metal glazing
  profiles. Existing measured parts, blue Aula and the historic brick school
  remain. The photograph is reference-only and is not distributed as a texture.
- **Savignyplatz:** the
  [district's account](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/plaetze/artikel.156595.php)
  confirms the historic garden composition and restored planted areas. Small
  foliage clusters fill residual gaps in only two retained OSM scrub polygons,
  ways **252591398** and **58422317**, within original park relation **5462503**.
  Original roads, water, building footprints and existing shrub footprints
  are excluded before a 0.52 m inset. Existing lawns, all paths and the actual
  trees remain. No unverified new pergola or planting boundary is added.
- **Kurfürstendamm and Tauentzienstraße:** fine metal meeting stiles and
  two-sided sill returns use the exact admitted v254 commercial rectangles,
  already matched to actual delivered source triangles. The two streets have
  **1,569 drawn openings / 2,703 independent native exposed faces** across
  **18 existing mode packets**. No second window grid, tenant names or new
  doorway positions are introduced. The original geographic/owner evidence
  and limits are documented in [west-shopfronts-v254.md](west-shopfronts-v254.md).

Profile widths, the extra 3–4 cm depth, small colour differences, foliage height
and density are explicit presentation estimates. These changes improve close
views of retained models; they are not a complete photographic reconstruction
of every building along these streets. Plant species are not asserted.

## Delivery and preservation

School details use the existing instanced-box primitive in one additional
batch per school. Drawn adds 1,344 Steglitz and 452 Tiergarten instances;
independently generated cardinal native rows add 1,410 and 332 respectively.
Their combined new matrix/colour attributes are 136,496 bytes drawn or
132,392 bytes native, plus two small shared-shape geometry buffers.

The Savigny recipe is **8,258 bytes**, with 245 source-contained anchors and
735 lobes in one batch. Drawn uses low faceted foliage; native uses only
axis-aligned boxes. Actual existing ground datums are recorded separately for
both modes. The new matrix/colour attributes are 55,860 bytes. Complete
CityWest groups remain 1,571,868 bytes drawn and 1,863,068 bytes native, within
the existing 2.5 MB local bound. Its batch accounting is now four/two.

`prepareWestShopfrontsV341` appends one shared-material packet part only after
the original encoded part fingerprints, origin and preceding v254 layer match.
Moved or modified source data retains the original rendering; repeated calls
and cancelled preparation leave it unchanged. Existing mesh objects, lines and
navigation retain identity. Across all 18 deferred packets the extra decoded
geometry is 1,537,920 bytes, not simultaneous resident memory. The tested
complete packet reaches at most 179,459 vertices and 621,477 indices, under
the unchanged 400,000 / 2,400,000 / 16 caps.

Every device receives identical static detail in its chosen representation.
There is no texture, new source packet, runtime network request, coverage
change, animation loop, quality reduction or increase to residency limits.
Construction packet recipes remain lazily accessed under the existing weak
lossless-data lifecycle. All additions participate in their existing factories
and normal scene/packet disposal.

## Verification

27 scoped Bun tests pass, including the existing historic school correction,
source-bound window, complete CityWest, school courtyard, native lazy-loading
and shopfront contracts. New tests exercise every real street packet, unchanged
old part identities, bounded in-aperture geometry, cardinal native faces,
corrupted source rejection, cancellation, idempotence and actual school factory
integration. One Python test reproduces both garden polygons, verifies every
anchor and its separate terrain datum, and checks the unchanged original hashes.

Regenerate only the garden recipe and its evidence with
`uv run --no-sync python -m scripts.build_savigny_garden_v341`.
Source attribution remains Berlin LoD2 (dl-de/zero-2-0) and OpenStreetMap
contributors (ODbL-1.0). Root integration owns the full viewer inspection,
strict source-history capture, release checks and public publication.
