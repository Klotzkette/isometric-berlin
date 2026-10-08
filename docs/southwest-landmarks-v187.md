# Southwest recognition, v1.0.87

This step-10 supplement implements the owner's 8 October request for better
Steglitz-centre recognition and good initial outlines at Domäne Dahlem,
Freie Universität and Mexikoplatz. It is independent of the new district,
street, forest and lake coverage. All earlier source assets remain unchanged.

## Source ownership and form

The compact frozen source is
`geo_data/regierungsviertel/southwest-landmarks-v187-source.json.gz`.
It keeps all **25 official LoD2 parents / 134 parts / 3,832 wall-and-roof
triangles**, and the exact retained OSM identities. Source ZIP fingerprints
and rigid display-datum offsets are in the adjacent evidence JSON.

- FU: five official owners, including the complete 101-part main owner
  `DEBE06YYB00009Fd`; its source footprint and roof sheets retain the mat
  layout, open courts, separate levels and the Philological Library envelope.
  The matching OSM records are Rostlaube `relation/32590`, Silberlaube
  `relation/6018664`, common section `way/26763411` and library
  `way/379437309`. Small source owners on the complex's roofs share the same
  rigid datum instead of being incorrectly pulled down to street level.
- Domäne Dahlem: nineteen complete source parents, including the four-part
  Herrenhaus `DEBE06YYB0000EU0` / `way/30432417`, former cowshed/dairy,
  horse stable/forge, Remise, shops and ancillary houses. Existing mapped
  yard, field and paths are not filled with invented structures. Small OSM
  sheds without an official match remain eligible for the new coverage layer.
- Mexikoplatz station: `DEBE06YYA00003aT` / `way/237543019`. Its original
  curved ground outline and all generalized source roofs remain. OSM's
  `roof:shape=onion` and the official heritage account support the cupola
  identity. A **416-triangle independently authored curved recognition skin**
  is centred on the main source ridge; its local radius/height/profile are
  explicitly display estimates. The source roof is not removed or reshaped.
- Existing Rathaus Steglitz, Gutshaus and Das Schloss receive just **36 thin
  clipped edge profiles**. Their existing complete v182 geometry, crane,
  memorial, facade rows and v185 school refinement remain unchanged. No new
  shell overlaps these earlier models.

`geo_data/regierungsviertel/southwest-landmarks-v187-exclusions.geojson`
contains exact CRS84 footprints of the 25 complete new official owners.
Only these owners may replace matching new generic coverage. It does not
exclude the whole farmyard, campus or district, and does not alter existing
Steglitz ownership. The OSM and official inventories remain retained.

## Recognition evidence and limits

The [FU university account](https://www.fu-berlin.de/sites/75seiten/15-labyrinth/index.html)
describes the modular layout and identifies the Rostlaube's replacement bronze
cladding. Consequently the drawn reading uses muted bronze alongside the
Silberlaube's silver-grey fields, rather than claiming the original Corten
panels survive unchanged. The [FU archive](https://www.fu-berlin.de/sites/uniarchiv/fugeschichte/archivschaufenster/rostlaube/index.html)
provides the 1973/1979 sequence and internal street system.

The [Domäne's own museum account](https://www.domaene-dahlem.de/museum/herrenhaus/)
identifies the manor/landgut. The [Berlin heritage inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075616)
identifies the Jugendstil Mexikoplatz station. These are identity and material
sources, not facade surveys. Individual window divisions, sills, roof colours
and the additional cupola profile are modest procedural interpretation.
Rostlaube glazing rows are bounded to its mapped two-storey reading; silver
parts use at most three display rows. No protected photograph or plan is
traced or bundled; no new photographic reference attribution is required.

Official sources: `https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip`, tiles
`383_5812`, `383_5813`, `379_5811`, Geoportal Berlin, **dl-de/zero-2-0**.
The retained 29 September 2026 Geofabrik Berlin PBF supplies OSM identities and
exact footprints, **ODbL-1.0**. Source hashes are frozen in the source/evidence
files. Each parent keeps its source wall/roof coordinates and internal heights;
only its rigid presentation ground datum changes. The campus shares a datum.
This supplement is not a terrain survey.

## Runtime and checks

`createSouthWestLandmarksV187(minecraft)` creates exactly four independently
culled site groups. Full/mobile drawn geometry is identical. Drawn models use
complete static triangle shells, fine source edges and final-sized box-instance
buffers. Native Minecraft creates only its own exterior unit-cell skin,
losslessly merging adjacent equal cells; no smooth double or hidden filled
building interiors is introduced. Neither representation allocates textures,
reflection targets, animations or per-frame geometry work.

The drawn/native JSON is approximately 0.99 / 1.67 MB uncompressed. Actual
active GPU buffers are tested below 1.6 MB drawn and 55,000 merged boxes in
native mode. Both representations use the same lazy parent-family lifetime;
metadata for both remains in the shared lazy bundle, but only the active
representation receives GPU geometry.

Three Python tests verify all exact owner exclusions, every measured part,
reproducible drawn output, exact per-part navigation heights/holes and the unchanged earlier Steglitz source hash.
`src/app/src/data/southWestLandmarksV187Navigation.json` contains those 134
measured physical parts; the estimated cupola is not mislabeled as survey data.
Two Bun tests verify bounds, immutable transforms, no UV/image allocation,
independent site culling and native orthogonality. Isolated Chrome previews
of FU, the Domäne and Mexikoplatz load without page errors; the site layouts,
open courts and new cupola were visually inspected. Integration/mobile and
release checks belong to the root release task.

```sh
uv run python scripts/build_southwest_landmarks_v187.py
uv run pytest -q tests/test_southwest_landmarks_v187.py
cd src/app
bun test tests/southwest-landmarks-v187.test.ts
```
