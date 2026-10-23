# Prenzlauer Berg landmarks — v264

Step 10 refines three existing named sites without extending coverage, changing
93 tour stops, mobile detail or any live packet/residency limit. Existing source
files and older authored windows/roofs remain byte-for-byte unchanged. Photographs
are external visual references only; no pixels, texture or font is shipped.

## Source and interpretation

- **Wasserturm:** [Museum Pankow's history](https://www.berlin.de/museum-pankow/geschichte-vor-ort/touristisches-wegeleitsystem/dokumente/05-stele-wasserturm-water-tower-.pdf),
  [heritage record 09070141](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09070141)
  and [the owner's exterior photograph](https://www.gewobag.de/ueber-uns/pressebilder/)
  (Sabine Dobre / Gewobag) support the cylindrical residential shaft, vertical
  masonry divisions and ornamental tank frieze. Twelve narrow pilasters occupy
  intervals between the v230 window axes; 72 small slots and shallow round corbels
  articulate the upper masonry. Their count, small dimensions and colours are
  visual estimates. All six existing window storeys, the older standpipe and
  complete v230 shell remain. The earlier published 30 m versus retained 40.842 m
  source-height conflict remains explicit; v264 does not resize the tower. The
  coarse upper source roof is retained, not reconstructed from the photograph.
- **Synagoge Rykestraße:** [the Jewish community](https://jg-berlin.org/religion/synagogen-in-berlin/synagoge-rykestrasse/)
  and [heritage record 09070254](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09070254)
  identify Johann Hoeniger's courtyard brick basilica. Brick cornice arcading,
  narrow pilasters, gable coping and small glazing subdivisions follow its
  retained v205 source planes. Every subdivision reuses an existing aperture,
  and all three earlier rose windows survive. The gable star and tiny fittings
  are procedural interpretation, not measured conservation detail. Existing
  v205 Mazbln references and their CC BY-SA 3.0 credits remain unchanged.
- **Zeiss-Großplanetarium:** [Stiftung Planetarium Berlin](https://www.planetarium.berlin/zeiss-grossplanetarium)
  supplies the published 30 m external dome diameter; the [Landesdenkmalamt's
  2025 record and exterior](https://www.berlin.de/landesdenkmalamt/aktivitaeten/kurzmeldungen/2025/artikel.1521460.php)
  document the metal dome, brick adjoining volumes and glazed curved entrance.
  The exterior photograph is © Stiftung Planetarium Berlin / Natalie Toczek.
  The cached coarse LoD2 upper envelope conflicts with that exterior: its angular
  cone and tall annex walls do not represent the photographed rounded silver
  dome over a low curved glazed foyer. V264 therefore explicitly replaces the
  visible vertical envelope of two precisely identified source owners. The first
  immutable source archive retains **all 342 original sheets**; the separate
  correction archive retains **all 94 sheets** of the adjoining concentric arc.
  The files and source vertices are evidence, not silently overwritten geometry.
  Both original footprint rings and every hole remain verbatim in the rendered
  lower body and navigation. All reconstructed upper triangles lie within their
  union; no neighboring footprint is changed.

  The silver dome's maximum diameter is 30 m. Its plan center is tied to the
  retained crown, while the rounded vertical profile is a photograph-based
  estimate. The display base/equator/top are y=8.4/17.721/32.721; the last value
  keeps the earlier source maximum as a contextual anchor and **is not independent
  confirmation of a measured height**. The low brick annex roof y=8.4 and foyer
  glazing top y=7.6 are estimates. The separate narrow circular lobe in the source
  footprint supports the photographed concrete cylinder and blue glazed crown:
  radius 4.42 m, shaft top y=20.5 and crown top y=23 are all display estimates.
  Panel pitch, colors, framing and concrete channels are estimated too. There is
  no claim of a complete facade survey. The official photograph's pixels remain
  external and are not shipped.

## Exact ownership and ground

Two same-site owners transfer in tile `7_-6`: primary `DEBE03YY6000044a`
(original OSM identity `way329262981`) and `DEBE00YYMM000010`. The second owner's
complete ring is the adjoining concentric west arc, approximately 14–16 m from
that dome center, rather than an unrelated building. It joins the original main
footprint around the independently published 30 m dome. The correction archive
records that association and retains every original sheet separately.

`prenzlbergV264Ownership.json` independently replays the retained exporter:

| Source owner | Drawn proxy triangles | Native proxy triangles | Drawn ink segments | Exact nav rows drawn/native |
|---|---:|---:|---:|---:|
| `DEBE03YY6000044a` | 502 | 325 | 168 | 1 / 1 |
| `DEBE00YYMM000010` | 139 | 80 | 47 | 1 / 5 |
| Total | 641 | 405 | 215 | 2 / 6 |

All unrelated packet triangles, lines and navigation rows remain identical.
Every native arc sub-row requires its own exact match. Changed packet attributes
fail open; changed navigation rows remain while independently exact rows may
transfer. Original compressed packets are not rewritten. The production
transaction constructs the required replacement before enabling source transfer.

The old primary proxy stores rounded source ground 18.56 m and height 29.74 m.
Its complete cached sheets have minimum 18.580 m and maximum 48.301 m. Their
historic display offset was −15.580 m, giving y=3…32.721. The corrected body's
base remains **y=3**, matching the original packet `groundY=3`; the source datum
18.580 is not incorrectly used as the visible ground. The arc's original
source minimum/maximum 21.915/36.940 m remain unchanged in evidence. Its false
15.02/16 m proxy extrusion is explicitly replaced by the low foyer profile.

Drawn support and collision follow the corrected triangles. Native support
follows actual independent one-metre surface cells. Tests cover y=8.4/9 annex
support, y=32.721/33 dome support and y=23/24 crown support, with no upward
teleport from ground y=3. Surface blocks use no hidden solid fill. No terrain
pad, path or new ground footprint is introduced.

## Runtime and integration

Required functions are `createPrenzlbergEnvelopesV264(native)` and then
`createPrenzlbergV264(native)`. `prenzlbergV264Ownership.json.records` and
`.lineRecords` join the existing optional exact-owner transaction; production
opts in only after required geometry is constructed. Packet navigation uses
`transferPrenzlbergNavigationV264(tile, nav)`. Scene queries are
`prenzlbergV264RoofAt`, `prenzlbergV264GroundAt`, `prenzlbergV264SolidAt` and
`prenzlbergV264TerrainAt` (no terrain pads). The `sites` constructor arrays in
`prenzlbergV264.json`, `prenzlbergV264Envelopes.json` and `prenzlbergV264Native.json`
participate in existing weak constructor-data/lossless packing. Numeric navigation
indexes do not retain construction rows or colours.

Each mode has three accent batches and one Planetarium envelope batch, all
frozen and independently bounded. Drawn full/mobile are identical: **4,030 fitting
instances plus 2,575 reconstruction triangles**, **586,108 bytes** of
geometry/matrix/color attributes. Native uses **3,332 independent accent blocks
plus 860 merged surface blocks**; **4 renderables and 320,896 bytes** of attributes.
The five runtime JSONs total **941,659 bytes**, **136,123 bytes gzip** before
production packing. Correction adds no renderable compared with the initial
v264 implementation; the additional curved dome vertices are bounded required
geometry, with no change to packet or residency ceilings. No animation loop,
light, texture, streaming descriptor or new live residency allowance is introduced.

| Site | Camera position | Look at |
|---|---|---|
| Wasserturm crown | `[3288,65,-1683]` | `[3236.36,25,-1629.52]` |
| Rykestraße courtyard gable | `[3196,38,-1687]` | `[3230,16,-1743]` |
| Planetarium entrance/roof | `[3846,45,-2540]` | `[3896,18,-2596]` |

`build_prenzlberg_v264.py --extract --ownership` reads cached source geometry and
creates the source/correction snapshots, exact proxy receipts and runtime payloads.
Ordinary replay needs neither `--extract` nor network. Seven focused Python checks
cover predecessor hashes, all 342+94 original sheets against the cached archive,
exact footprint preservation, published diameter and rounded cap, low annex,
fitting containment, independent native coverage, exact scope and reproducibility.
Four Bun checks cover exact buffer capacities, native orthogonality, reconstruction
vertex identity, roof support and lossless multiowner triangle/line/nav transfer,
including changed-input guards. Both suites and Ruff passed. Independent review
also verified that every full triangle projection remains inside the original
source union (outside area zero), not merely its vertices. IAB drawn review
confirmed the rounded silver dome and low annex; release build and remaining
mode review belong to the root release check.
