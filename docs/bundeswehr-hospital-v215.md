# Bundeswehrkrankenhaus: correction of the obsolete modern gable

This correction concerns only modern main-ward leaf `DEBE3DbYCNYOhBDw`
(`CNYOhBDw`), within parent `DEBE01YYK0000365`. The visible v214 pointed roof was
not a newly invented facade: it came from retained LoD2 roof type 5000, already
resident in the Alt-Mitte v169 source packets. Adding v214 window detail had not
corrected that envelope.

## Evidence and limits

- [DBV, main building / Haus 1.1](https://www.dbv-ingenieure.de/referenzen/bundeswehrkrankenhaus-berlin-hauptgebaeude/)
  identifies the six-storey main building and the 2014–2020 refurbishment with
  technical roof extension.
- [DHL, campus building history](https://www.dhl-architekten.de/projekt/bundeswehrkrankenhaus-berlin-bauunterhaltung/)
  distinguishes the historic 1850–1853 hospital from later additions. Historic
  pavilion roofs must therefore not be flattened with the modern wing.
- [Marek Śliwecki's 2017 street photograph](https://commons.wikimedia.org/wiki/File:Berlin_Bundeswehrkrankenhaus_Berlin.jpg)
  shows the flat parapet, cream cladding and turquoise window rhythm. Already
  credited under CC BY-SA 4.0 in both photograph-reference manifests. No photo
  pixels are packaged as textures.
- Berlin DOP2025 orthophoto (`dop_2025_fruehjahr`, layer `dop_2025`) was inspected
  at UTM bounds 389340–389650 / 5821650–5821900. It shows flat end decks and a
  rectangular central technical roof, with pitched historic roofs behind it.
- 33 Berlin bDOM GetFeatureInfo samples, preserved in
  `bundeswehr-hospital-v215-bdom.json`, place the main flat deck near 62.0 m NHN
  and the technical roof near 66.2 m NHN. The original family display offset
  −28.122 m is retained: scene heights 33.878 and 38.078 m. The technical roof
  plan is an orthophoto interpretation clipped to the exact source footprint;
  its corners, cladding and wall openings are not claimed as surveyed details.

The original LoD2 archive, v169 source families, v169 render packets and v214
facade/pad data remain unchanged. The old and corrected complete source leaf,
original packet SHA-256 hashes, exact triangle/line receipts and fitting row
changes are recorded in `bundeswehr-hospital-v215-correction.json`.

## Construction and preservation

The lower source walls, closures and their `sourcePolygonId` provenance survive.
Only the old upper gable is replaced by a full flat deck, raised perimeter walls
and the central technical storey. The other eleven parts of this parent and all
other hospital parents retain their source geometry. Original ink shared with
unchanged parts survives even where this leaf no longer uses it.

Exact fingerprint-guarded transfer removes 3,717 obsolete triangles across the
resident drawn shell, streamed gable glazing and native geometry difference.
Fifty-three obsolete ink segments transfer; 25 edges shared with other parts stay.
The correction adds 1,143 drawn triangles and 2,857 native triangles. Native
meshes use the existing 2 m surface-only voxel authoring, without hidden solid
fill; every unchanged native triangle remains in its original packet.

Nine drawn and twelve native v214 upper-gable fitting rows would float above the
corrected deck and are retired by audited row index. All lower window/sill rows,
other owners, helipad and animated rescue helicopter remain intact.

The corrected geometry is required during the unpublished Alt-Mitte construction
transaction in every mode, with ordinary buffer accounting and cancellation
cleanup. It is not an optional streamed facade. Native correction bytes are only
loaded with native mode. Roof navigation follows the same correction, preserving
higher overlapping source owners and unchanged native cells. Touch and pointer
profiles use the same geometry and limits.

Focused checks cover immutable packets, footprint/lower-wall preservation,
flat deck heights, exact transfer guards and unrelated indices, native orthogonal
geometry, fitting ownership, roof navigation, required resident construction and
full/touch core equality. Root performs full build and browser release review.
