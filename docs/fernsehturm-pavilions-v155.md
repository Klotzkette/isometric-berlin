# Fernsehturm foot pavilions — v1.0.55

Pipeline step 10. The owner's requested additional Alexanderplatz detail now
includes the distinctive pavilion ensemble directly around the Fernsehturm.
This is a bounded additive supplement in the existing east lobe. The complete
station, tower, Rathaus, Marienkirche, monuments, source streets, trees and
93-place catalogue are unchanged.

## Metric evidence and scope

`fernsehturmPavilionSource.json` retains all **16 parents / 22 parts** from the
existing official `LoD2_392_5820.zip` archive, created 2 March 2026. The 53 KB
supplement keeps every original wall/roof sheet, ground ring, source elevation,
identity and archive SHA-256. Regenerate it with
`uv run python -m scripts.build_fernsehturm_pavilion_source`.
No current ordinary prism is present within this new ensemble, and none is
suppressed. The original `schlossEastSource.json` and civic/public-realm source
files remain byte-for-byte unchanged.

[Landesdenkmalamt inventory 09065023,T,002](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065023)
identifies Walter Herzog, Herbert Aust and Rolf Heider's 1969–72 pavilion
ensemble: two-storey glazed wings, inclined cantilevered roofs and a terrace
organized around the tower. This implementation adds that enduring structure;
it does not invent a completed future Forum landscape or reproduce old shop
brands as if they were current.

## Representation and explicit conflicts

The measured building shells retain their source shapes and elevations. Two
bands of procedural glazing, slender mullions, door handles, pale gallery edges,
rails, four source-bound staircases and the thin folded canopies make the
pavilions readable close to the tower. The upper-gallery height, facade pitch,
member widths, pane colours and stair risers are labelled procedural photograph
fits, not a measured facade survey. A small plinth closes the gap between the
source floor elevation and the existing scene ground without moving either.

Several LoD2 records generalize open construction as solid volumes:

- The nine folded-roof parents retain their measured roof sheets, but their
  ground-to-roof side walls are not shown as opaque wedges under cantilevers.
- The gallery/eaves record retains its measured top roof sheets. Its solid
  ground-to-roof hull would mask the glazing; that hull is not drawn. An
  additional first-floor terrace uses the same narrow footprint.
- Four staircase footprints become stepped surfaces instead of flat-roof boxes.
  Their original source sheets remain in the source supplement.
- The narrow entrance bridge is open below its first-floor level. Its exact
  plan and roof remain; its generalized lower side walls are clipped only in
  the labelled display representation.

These exceptions are recorded in the source conflict policy. No prior rendered
feature is removed. The tower architecture and its vapour effect are separate.

The four drawn modes keep identical complete geometry on touch and pointer.
Minecraft uses its own surface-only cube batch. No image, texture, font,
external request, per-frame construction or hidden solid infill is introduced.

## References and licensing

Both references were downloaded only to `/tmp`, inspected, and supplied to the
root release process as `/tmp/v155-alexander-reference-additions.json`:

- [*Pavillon Fernsehturm Berlin*](https://commons.wikimedia.org/wiki/File:Pavillon_Fernsehturm_Berlin.jpg),
  Conbrio, 24 February 2006, CC BY-SA 3.0: pale thin cantilever, folded underside,
  upper glazing and stair/gallery construction.
- [*Berlin fernsehturm pavillon*](https://commons.wikimedia.org/wiki/File:Berlin_fernsehturm_pavillon.jpg),
  Dieter Brügmann, 29 March 2005, CC BY-SA 3.0: two-storey window bands, projecting
  gallery, white parapets and broad stairs. Historical advertising is omitted.

These are architectural recognition references, not present-day tenant surveys.
The new 2026 official metric data anchor the envelope. No photograph or crop is
committed or used as runtime texture.

## Validation

Three Python tests reproduce the source exactly, retain all 22 parts, confirm no
part overlaps the earlier source identities and check every vertex against the
unchanged bounds. Three focused frontend tests verify finite bounded buffers,
full touch parity, separate native geometry, a rendered ray through a measured
cantilever, solid roof/open air below it, and continuous real pedestrian
controller ascent/descent of all four staircases. The six earlier public-realm
tests still pass, including Neptune's ten-metre top, native water clearance,
all Forum trees and walking from the monument plinth.

| Additive pavilion model | Draws | Instances | Geometry + instance bytes |
| --- | ---: | ---: | ---: |
| Drawn | 2 | 3,486 | 320,232 |
| Native Minecraft | 1 | 9,099 | 692,172 |

The original public-realm contribution remains 392,792 drawn / 334,728 native
bytes; all added bytes belong to this new child root. Local real Chrome WebGL
views were inspected from above, isometric, entrance and west-facing wings, in
both drawn and native forms. Browser-engine rendering is not a physical older
phone memory guarantee. The root release review records production checks.
