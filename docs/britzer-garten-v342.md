# Britzer Garten: mapped landscape and architecture

This finite named-site addition represents the Britzer Garten rather than a
rectangular neighbourhood expansion. The two retained Berlin GRIS records
`00008100:000a6b88` (Britzer Garten) and `00008100:0012db81` (Britzer Garten,
Teilstück) form an **867,572.135m²** polygon union. The park intersects no
previous Drawn or Native ground, water, road, bridge or building owner in the
pinned v1.0.221 manifest (`5566e5db`). Every prior packet remains unchanged.
The old OSM garden relation is smaller than the municipal green-space parcel;
it supplies local semantics, not permission for a rectangular fill.

The immutable bounded source clip is
`geo_data/regierungsviertel/britzer-garten-v342-source.json.gz`.
The source builder records every original OSM identity, complete official
LoD2 wall/roof sheet, exact GRIS ring, original archive hash, and the previous
manifest receipt. Raw city archives and reference photographs do not ship.

## Landscape and circulation

The exact mapped Hauptsee, Südsee, Ostsee, Irissee, Teichbach and
Kopfweidenpfuhl shorelines and island exclusions sit in measured terrain.
Berlin DGM1 supports a four-metre triangulated Drawn grid; Native independently
samples the cell centres and constructs cardinal stepped platforms. Surface
and walking use the same retained signed centimetre height field, through the
existing `gardenTerrainV330` packet format. The retained grid spans 36.10–63.08m
NHN; values outside the actual park polygon are neither rendered nor walkable.
Existing point sources identify Britzer Höhe and Aussichtsberg within the relief.

Mapped path centreline vertices, material tags, water boundaries, lawns,
flowerbeds and woodland polygons remain distinct. Tagged widths take priority;
unrecorded widths use the existing documented path-class display estimates.
Mapped footbridges receive visible decks, rails and matching floor/rail navigation.
Their vertical fit interpolates the measured banks, with small deck segments
sharing exactly the represented floor height. Deck elevations and widths without
OSM measurements are estimates. The explicitly closed damaged bridge,
private service crossing and unsupported playground bridge are not advertised as
public routes.

Individually mapped trees are counted separately from estimated canopy masses
inside actual mapped woodland polygons. The latter depict woodland cover, not
a claimed tree survey. They remain clear of mapped water, buildings, paths,
clearings and the individual tree positions, and add no invented trunk obstacles.
Mapped hedge courses and flowerbed outlines receive bounded planting detail;
plant spacing, crown shapes, species impressions and summer flower colours are
illustrative. No autumn reference colours are forced onto the summer landscape.

The Parkbahn's original 600mm-gauge line courses are visible with paired rails
and sleepers. **No moving train or current operating timetable is invented**:
the operator explicitly reports that operation is paused until further notice.

## Characteristic architecture

The complete interior-site LoD2 building leaves retain their original coordinates,
wall sheets and roofs. Café am See/Seestern, Orangerie, Karl-Foerster-Pavillon,
Milchbar and the smaller park structures therefore have measured individual
forms. The café's irregular roof and the green roofs/glazed garden fronts of the
Orangerie and Karl-Foerster-Pavillon are distinguished using operator photographs.
Small window subdivisions, frames, glazing colours and material tones are display
estimates. Marginal official leaves crossing the named boundary are retained as
evidence and explicitly listed as unresolved boundary leaves; no neighbouring
building is cut into a spurious sliver. This pass does not claim a surveyed public
interior or roof-access route.

Native is independently constructed from cardinal cells whose tops sample the
original measured roof faces. It is not a rotated copy of the smooth geometry.

The Kalenderplatz has its mapped paving outline, 14m inclined open-lattice
Gnomon, schematic astronomical metal inlays and Susanne Mahlmeister's two
separately mapped groups of twelve steel spears. The Gnomon's height is documented;
its polar inclination follows the local latitude. Rod spacing, member thickness,
inlay geometry and spear inclinations are reference-derived estimates, not a
working calibrated sundial or a claim of measured sculptural reproduction.

## Sources and credits

- [Grün Berlin: current park plan](https://www.britzergarten.de/besuch-planen/besucherinformationen/parkplan/),
  including the [February2025 plan](https://www.britzergarten.de/fileadmin/britzergarten/images/6_PDFs_Dokumente/Britzer_Garten_Plan_2025.pdf).
- [Café am See and Grotten](https://www.britzergarten.de/erlebnisse/kunst-architektur/cafe-am-see-grotten/):
  Engelbert Kremser's earth-formed concrete architecture; external photographs
  ©Andy Rumball, ©Dominik Butzmann and ©Grün Berlin.
- [Orangerie](https://www.britzergarten.de/erlebnisse/kunst-architektur/orangerie/):
  glass frontage and planted sloping roof; external photographs ©Grün Berlin.
- [Karl-Foerster-Pavillon](https://www.britzergarten.de/erlebnisse/kunst-architektur/karl-foerster-pavillon/):
  Christoph Langhof's pavilion and current Freilandlabor use; external
  photographs ©Konstantin Börner and ©Grün Berlin.
- [Kosmologischer Park and Kalenderplatz](https://www.britzergarten.de/erlebnisse/kunst-architektur/kosmologischer-park-kalenderplatz/):
  Jürgen Zilling, Clod Zillich and Jasper Haffmann; Susanne Mahlmeister's paired
  spear ensembles; Gnomon photograph ©Lutz Griesbach, other external
  photographs ©Grün Berlin and ©Dominik Butzmann.
- [Rosengarten](https://www.britzergarten.de/blueten-gaerten/gaerten/rosengarten/)
  and [Modellboothafen](https://www.britzergarten.de/events/modellboothafen/)
  distinguish horticultural and waterfront identities. No unsupported fixed boat
  position is added.
- [Parkbahn status and gauge](https://www.britzergarten.de/events/parkbahn/),
  verified14November2026: operation currently paused.
- [Berlin GRIS](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/gruenflaecheninformationssystem-gris/karten-online/),
  [DGM1](https://gdi.berlin.de/data/dgm1/) and
  [LoD2](https://gdi.berlin.de/data/a_lod2/): Land Berlin / Geoportal Berlin,
  [Datenlizenz Deutschland Zero2.0](https://www.govdata.de/dl-de/zero-2-0).
- ©[OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
  ODbL1.0; retained Geofabrik Berlin snapshot29September2026.

All photographs and plan artwork remain external references. No image pixels,
photographic textures, new fonts, runtime media requests or eager city imports
are added. Full Drawn geometry is identical on mobile and desktop. Existing
packet/decode/vertex/index/residency limits, six visual modes and93tour stops stay
unchanged. The parent integration adds only the measured static descriptors and
new finite footprint, plus exact terrain-ID admission for these new packets.

## Bounded delivery and verification

The finished park has 12 spatial primaries and 13 detail companions: 50 gzip
assets for the two independent geometry families, totalling 14,126,366 bytes.
The largest asset is 643,190 compressed bytes / 2,483,583 decoded bytes;
the largest packet contains 97,549 vertices or 248,592 indices. Existing runtime
limits are unchanged. The narrow final parcel tip in `britzer342-7_20` contains
no complete Native ground cell, so its Native counterpart is deliberately empty.

The addition includes 55 complete surveyed LoD2 leaves. Seven boundary-crossing
leaves remain explicit source evidence without partially reproducing a neighbour.
The 238 mapped tree records are separate from 2,815 estimated woodland canopy
masses. The mapped rail courses total 4,910.54m inside this finite parcel, without
claiming to include the operator's complete railway outside the source scope.

Five Python checks cover exact municipal boundaries, untouched prior owners,
water/island exclusions, independent Native roofs, all emitted packet budgets,
and measured terrain/walking agreement. The existing navigation format rounds
rings to centimetres; GIS union checks canonicalize collapsed boundary returns
without deleting packet points. Lake/ground/bridge overlap is confined to a
1.5cm edge band (under 0.05m² per Drawn tile; zero in Native).

The actual Bun city controller passes 79 assertions covering both geometry
families, companion-before-primary loading, measured ground ray hits, lake
exclusion, bridge-floor priority, building collision, remount and disposal.
Reference and packet checks do not replace the parent integration's browser
inspection and release checks.
