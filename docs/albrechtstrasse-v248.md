# Albrechtstraße 131 facade — v248

This small Step 10 addition treats only the already rendered plaza-facing walls
of LoD2 owner `DEBE06YYB0000PVc`. The pale rounded building visible across
Hermann-Ehlers-Platz is Albrechtstraße 131 / Düppelstraße, not Rathaus Steglitz
or Das Schloss. The lower neighbouring Düppelstraße 41 is outside this change.

The original v182 owner has a plain extruded wall shell. The addition gives its
long front, ten original corner facets and two southern returns pale framed
windows, divided grey-blue glazing, a plinth separation and horizontal cornices.
A wider first upper-floor register is distinguished from the narrower higher
openings. Corner panes are individually clipped to the actual curved source
facets; a straight chord never replaces that contour. Existing shops and doors
below Y7.4, the complete source envelope, roof and all earlier detail remain.

Facade bay counts, small dimensions, colour and floor subdivisions are explicit
photo-guided estimates, not a measured window survey or a current shopfront
inventory. This limited addition does not reconstruct the photographic pitched
roof, signage, interiors or the neighbouring buildings.

## Sources and credits

- Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen,
  3D-Gebäudemodell LoD2, `dl-de/zero-2-0`: exact retained owner and delivered wall
  triangles in `ring182--7_13.drawn.json.gz` and its independent native packet.
  Their immutable SHA-256 receipts are checked before generation. The official
  [Berlin Open Data catalogue](https://daten.berlin.de/datensaetze/3d-gebaudemodelle-im-level-of-detail-2-lod-2-3c7c49af)
  confirms Datenlizenz Deutschland – Zero – Version 2.0. An initial v248 draft
  incorrectly wrote `by`; this documentation typo was corrected without changing
  any earlier source licence, geometry or runtime byte.
- [Landesdenkmalamt Berlin, object 09065472](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065472):
  residential/commercial building Albrechtstraße 131 / Düppelstraße, 1911–1913,
  architect F. Gericke. Identity and history reference.
- [Muns, 20 April 2013, Wikimedia Commons photograph](https://commons.wikimedia.org/wiki/File:130420-Steglitz-Albrechtstra%C3%9Fe-131-Ehlers-Platz.JPG),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/): exterior form,
  pale surrounds, broader lower windows and cornice hierarchy. Reference only;
  no image pixels, photograph or texture are bundled or loaded.

## Geometry and limits

`albrechtstrasseV248Details.json` supplies 229 `boxes` and 160 `nativeRows` for
concatenation into the existing Steglitz instance batches. No new draw call,
material, surface, texture, streaming descriptor, animation or navigation solid
is needed. The added instance attributes occupy 17,404 B drawn and 12,160 B
native; complete drawn detail is shared by desktop and touch.

Native glazing is independently placed on 20 collinear-merged runs of the
existing orthogonal packet contour. It does not inherit drawn rotations or
float outside a diagonal proxy. The complete older native shell remains.
The existing packet datum Y3 is retained. All fittings are supported by actual
wall triangles, sit at least 40 mm outside them and finish below Y27; frame,
glass and mullions use distinct offsets to avoid coplanar fighting.

Python tests replay all rows, verify immutable previous-source hashes, match
every fitting to complete source triangles and check exposure against the owner
and neighbours. Three.js tests cast rays through glazing back onto the original
packet walls and verify independent native matrices and both byte allocations.
Parent integration tests check the unchanged earlier batch prefixes and total
Steglitz caps of 900,000 / 2,250,000 bytes.

Review view: eye `[-3445,140,6890]`, target `[-3500,3.025,6815]`.
Closer view: eye `[-3518,19,6837]`, target `[-3510,15,6805]`.
