# Nikolaikirche and the immediate Nikolaiviertel

Step 10 corrects the existing rendered church and selected fronts around
Nikolaikirchplatz. This is a geometry and facade correction, not a district
palette change or a claim of a new photogrammetric survey.

## The visible error

The published v1.0.232 church used the ordinary V169 house-window recipe:
small rectangular panes repeated every 3.25 m vertically. Its two official
LoD2 parts had no separate material binding, so the default cream wall and
grey roof covered both the church and its westwork. The generalized official
tower part also contained one large sloping gable beneath the V239 needles.
Keeping these simplified visible surfaces while adding thin details could
not produce the photographed building.

The original two LoD2 parts remain archived under parent
`DEBE01YYK00001VX` (tower `DEBE3DJ5QoacFhgE`, nave `DEBE3DUWfKmI0Hwu`).
The correction distinguishes the measured footprint/envelope from the
authored, photograph-derived roof and opening dimensions. Original evidence
is retained even where its generalized appearance is superseded.

## Reference evidence

- [Berlin monument authority: Nikolaikirche](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011267).
- [Berlin monument authority: Nikolaiviertel ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011266).
- [Restoration contractor RAO: tower restoration, 2016–2021](https://www.rao-berlin.de/projekt/denkmalrestauration-der-nikolaikirche-berlin/).
- [Museum Nikolaikirche](https://www.berlin.museum/museum/nikolaikirche).
- [Senate ISEK Nikolaiviertel, July 2021](https://www.berlin.de/sen/stadtentwicklung/_assets/quartiersentwicklung/foerderprogramme/lebendige-zentren-und-quartiere/be211101_isek_nikolaiviertel_endbericht_juli2021_barrierefrei_klein.pdf?ts=1758291378).

The restoration photographs show two clocks on the west facade, grouped
lancets and pale blind panels in the red-brick stages, mixed grey fieldstone
below, and two green copper helmets with flared feet. The annexes and the
terracotta hall roof require their own forms. ISEK photographs distinguish
the lower reconstructed houses at the church from larger perimeter blocks.
Proposed public-space works in that document are not treated as completed.
Reference photographs are external evidence; no photograph pixels or protected
plans are included in the viewer.

The house pass covers 14 supported frontage profiles from eight existing
building families: Knoblauchhaus, individual reconstructed Bürgerhäuser,
Zum Nußbaum and Ephraim-Palais. Window axes, blind fields, storeys and trim are
checked against their own exterior references. The palace retains its existing
gilt balcony and pilaster details. A separately mapped balcony-strip family,
`DEBE00YYUf00009S`, had become a solid apartment-like shell in front of those
details. Its exact 28.128 m² source footprint now supports open balcony plates,
columns and rails, with navigation limited to those physical parts. The palace
body and surrounding ground retain their existing ownership. The remaining west row and the exact
Nikolaikirchplatz 3 / Poststraße 21–22 assignment still need individually matched
exterior evidence; this pass does not claim their complete reconstruction.
The [frontage record](nikolai-quarter-v353.md) lists each supported owner and
photograph.

## Ownership and delivery

Corrections use the existing `4_0` and `nikolai239-4_0` host lifetimes in both
Drawn and Native, plus the Drawn-only `4_0-alt-mitte-v169-1` outline companion.
The latter retires exactly 473 church-owned segments; neighbouring outlines
remain intact. Each successor checks the complete original and prepared
packet before retiring exact owned triangles, line segments or navigation
records. The quarter correction precedes the church correction in the finite
catalogue; unrelated houses, ground, courtyards and routes remain intact.
Native is constructed independently with cardinal surfaces. Both corrections
cover the same five host/mode keys: `drawn:4_0`, `minecraft:4_0`,
`drawn:nikolai239-4_0`, `minecraft:nikolai239-4_0` and
`drawn:4_0-alt-mitte-v169-1`. The quarter uses five lazy recipe files totalling
387,919 compressed source bytes; the church uses one file containing its five
transactions, 242,372 compressed source bytes. Their combined recipe payload
is 630,291 bytes. These are measured source-recipe sizes, not public-site or
offline-package totals.

The previously unmodelled Wappenbrunnen uses its existing official inventory
point. Its octagonal basin, three steps, bowls, bear, shield and open wrought-iron
canopy follow the documented six-metre overall height and four-metre basin
diameter. Small sculpture details are authored approximations. Its single local
mesh shares verified ground support and retirement with the existing amenity
controller; it does not add a permanent city-wide model. See the separate
[church](nikolaikirche-v353.md) and [fountain](nikolai-fountain-v353.md) receipts.

All 3,087 static descriptors and 6,174 Drawn/Native packets remain present.
All six modes, the 93-stop tour, mobile detail and live/startup/Worker limits
remain unchanged. Construction recipes are bundled and load from the viewer's
own origin. The [pre-existing northern refinement guard issue](known-rendering-issues-v351.md)
is separate from these corrections.
