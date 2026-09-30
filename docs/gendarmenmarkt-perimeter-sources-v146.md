# Gendarmenmarkt perimeter — source and facade research, v1.0.46

Research date: 2026-09-30. Pipeline step 6: bounded source fusion and visual
reference preparation. This note supplements the measured LoD2/OSM extraction;
it does not define replacement geometry or surveyed facade dimensions. Related
notes: [Gendarmenmarkt v138](gendarmenmarkt-v138.md) and
[Mitte v138](behren42-mitte-v138.md).

## Identity and source boundaries

| Place | Verified identity/address | Exact local source association |
| --- | --- | --- |
| Dentons | Berlin office, Markgrafenstraße 33, Quartier 30; this is not a claim about a global headquarters | OSM node `9436604541`; LoD2 `DEBE01YYK00001GO` |
| EINSTEIN KAFFEE Gendarmenmarkt | Corner cafe, Markgrafenstraße 34 | OSM node `440923198`; LoD2 `DEBE01YYK0000Dkf` |
| Hilton Berlin | Anton-Wilhelm-Amo-Straße 30, formerly Mohrenstraße 30; south of the square | OSM node `86001840`; LoD2 `DEBE01YYK0001ujw` |
| BBAW | Berlin-Brandenburgische Akademie der Wissenschaften, campus contact Jägerstraße 22/23; historic square-facing building at Markgrafenstraße 38 | Campus OSM node `549366121` lies on eastern LoD2 `DEBE01YYK00001lT`; the western square frontage is separate LoD2 `DEBE01YYK00001jU` |
| Newton Bar | Restaurant/bar premises Charlottenstraße 57; corporate seat at 56 is a different address field | OSM node `86005430`; whole Quartier 205 LoD2 parent `DEBE01YYK00001H9` |
| Borchardt | Französische Straße 47 | OSM node `86001798`; LoD2 `DEBE01YYK00005Ja` |
| Quartier 206 | Friedrichstraße 71–74, western portion of the Jägerstraße/Taubenstraße block; not the entire block on the square | LoD2 `DEBE01YYK0000ER0`; confirm the extracted exterior edges before applying treatment |
| Lutter & Wegner | Charlottenstraße 56, current premises since 1997 | LoD2 `DEBE01YYK00006Rw` |
| HfM Hanns Eisler / Augustiner | Charlottenstraße 55 / Jägerstraße 20; present 1907–08 building, not the earlier orphanage | LoD2 `DEBE01YYK000078B` |
| Hotel Luc | Charlottenstraße 50, Autograph Collection; former Sofitel | LoD2 `DEBE01YYK00006fK` |
| Erdinger am Gendarmenmarkt | Jägerstraße 56, corner in the Markgrafenstraße 39–41 residential ensemble | LoD2 `DEBE01YYK0000Bz7` |

The LoD2 identifiers above were resolved against the committed local data by
the parallel envelope extraction. POIs identify establishments, not the full
extent of a parent building. In particular Newton is a local storefront within
Quartier 205, and the BBAW campus POI does not identify the square-facing wing.
Use the extraction's coordinates rather than geocoding these addresses again.

Official identity references:

- [Dentons Berlin office](https://www.dentons.com/en/global-presence/europe/germany/berlin)
  and its [September 2025 directions](https://www.dentons.com/-/media/pdfs/other/directions-to-berlin-office-de-sept2025.ashx).
  Reception is on the fifth floor; garage access is Kronenstraße 43.
- [Einstein Gendarmenmarkt](https://einstein-kaffee.de/standorte/standorte-berlin/gendarmenmarkt/).
  This is separate from the already modeled Einstein Unter den Linden.
- [Hilton Berlin](https://www.hilton.com/en/hotels/berhitw-hilton-berlin/).
  The requested south-square hotel is Hilton, not Hyatt.
- [BBAW contact](https://www.bbaw.de/kontakt),
  [BBAW building history flyer](https://www.bbaw.de/files-bbaw/service/publikationen-bestellen/BBAW_Flyer_Infotafel_v10.pdf),
  and [SSP campus description](https://www.ssp.ag/referenzen/berlin-brandenburgische-akademie-der-wissenschaft/).
  The campus combines the 1903 Seehandlung frontage, a 1930s Jägerstraße part
  and a 1920s Taubenstraße part. The
  [Wissenschaftslounge](https://www.bbaw.de/wissenschaftslounge) is a future
  reconstruction project, not an existing facade to import.
- [Newton](https://newtonbar.de/) and
  [operator imprint](https://newton-bar.de/Impressum.html).
- [Borchardt contact](https://www.borchardt-restaurant.de/kontakt) and
  [restoration architect Müller Reimann](https://www.mueller-reimann.de/projekte/haus-borchardt).
  The 1899 townhouse remained individually legible when integrated into the
  Hofgarten development and restored in 1993–95.
- [Lutter & Wegner contact](https://l-w-berlin.de/kontakt/) and
  [operator history](https://l-w-berlin.de/geschichte/).
  The historical premises at Charlottenstraße 49 are not today's building.
- [HfM locations](https://www.hfm-berlin.de/hochschule/ueber-die-hochschule/standorte/)
  and [Landesdenkmalamt object 09075005](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075005).
- [Hotel Luc official Marriott page](https://www.marriott.com/en-us/hotels/berag-hotel-luc-autograph-collection/overview/).
  The English restaurant page now uses YOU. Berlin while some German text still
  says Heritage. Use the verified hotel name rather than inferring a current
  restaurant sign from the older Sofitel photograph.
- [Erdinger contact](https://erdingerberlin.de/?page_id=94) and the
  [Landesdenkmalamt Markgrafenstraße ensemble description](https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/emarkgrafenstrasse_2020-10-21.pdf).

## Architectural readings for implementation

The counts below describe visible registers in the inspected view. They are
recognition cues, not complete surveys of all elevations. Exact external
edges, heights, steps, roofs and courts remain those of the LoD2 payload.
Window widths, relief depths, frame sections and color values are procedural
display choices. Never repeat a tenant name around an entire source parent.

### Dentons / Quartier 30, Markgrafenstraße 33

The original architect's [Quartier 30 page](https://www.vasconi.fr/fr/les-projets/projet/bureaux-commerces/quartier-30-gendarmenmarkt)
identifies the Markgrafenstraße HAUS 1 by Claude Vasconi within the larger
Coenen/Tesar/Vasconi collaboration. The completed complex dates to 2001.
Its street front has cool gray stone bands, long dark blue-gray window ribbons
with narrow metal mullions and transoms, and shallow projecting slab/sunshade
edges at each floor. A large upper overhang covers recessed dark top glazing
with three horizontal louver rails. The short northern return has about eight
narrow window bays in the photographed ribbon. The glazed inner-court grid
must not be applied to the stone-banded street elevation. The Dentons name is
a local entrance cue, not the character of the entire architecture.

Original architect photos were viewed locally as `/tmp/gm-photos/vasconi-q30-0.jpg`
and `vasconi-q30-4.jpg`; court `vasconi-q30-5.jpg` was checked specifically to
avoid confusing the elevations. They are external visual references only;
no free-license assertion, no bundled image or runtime texture.

### Einstein, Markgrafenstraße 34

The [operator's exterior photograph](https://einstein-kaffee.de/wp-content/uploads/2021/10/EINSTEIN-KAFFEE-Berlin-Gendarmenmarkt.jpg)
shows tan/ochre stone slabs, a rounded cylindrical corner, broad dark green
two-by-two upper window frames, and an olive-green polished-stone ground
plinth. Pale metal double doors and transom sit behind a shallow clear glass
canopy on metal ribs wrapping the corner. White EINSTEIN KAFFEE lettering and
small brown square signs belong to this storefront; cream cafe umbrellas are
optional recognition detail. The corner geometry is the first recognition
priority, not enlarged lettering.

[Contemporary Bauwelt documentation](https://www.bauwelt.de/themen/bw_1997-07_Wohn-_und_Geschaeftshaus_Markgrafenstrasse_34-2107664.html)
identifies the Kleihues building at 34. A secondary address summary encountered
during research swapped the architect assignments at 34/36; prefer this
contemporary source and the operator's actual corner view. The operator image
is reference-only, not a Commons or bundled asset.

### Hilton south facade

Warm cream stone/plaster, red clay-tile pitched roof and dark burgundy window
frames. Four straight upper window registers sit above a two-storey base.
Paired openings are divided by narrow cream pilasters; broader blind strips
carry long capsule/shield-shaped grooves. The lower two levels have broad
round arches and the ground level reads as an arcade. At the central entrance
a dark projecting canopy sits below a faceted, rounded glass oriel; a revolving
door is visible beneath. Thin balcony rails extend across some lower upper
windows and the centre stack. Keep the source roof and the arched entrance
hierarchy; a plain repeated square-window grid misses this building.

### BBAW square frontage

Pale gray-beige masonry with a rusticated base and small round basement
apertures. The main opening sequence changes by level: tall rectangular lower
windows, round-arched middle windows, near-square top windows, then a deep
cornice and red hipped roof. Outer bays have small iron balconies. The academy
name is near the upper facade. This treatment belongs to the square-facing
Seehandlung wing; do not propagate it around the later campus wings merely
because the OSM campus point lands there. The 2026 Commons view is particularly
useful because it confirms the actual surviving frontage.

### Quartier 205 and local Newton storefront

Quartier 205 uses a rigorous pale tan square masonry grid with dark square
windows, usually divided two-by-two. Cuboid projections/recesses and terrace
setbacks with black rails make the roofline; the centre is taller and recessed.
The square-facing centre has a broad entrance recess and greenish glass canopy.
The [developer's own acquisition release](https://www.prnewswire.co.uk/news-releases/tishman-speyer-acquires-quartier-205-in-berlin-520488082.html)
confirms the full-block Ungers development completed in 1995.

Newton belongs only to the storefront nearest its exact OSM node. Use a bounded
dark entrance/window field and its name locally if the existing evidence
supports that edge. No whole-block Newton branding and no reproduction of
Helmut Newton photographic murals. The inspected Commons view establishes
Quartier 205's architecture, not a surveyed Newton doorway width or bay count.

### Quartier 206

Light gray/off-white stone with thin continuous dark graphite horizontal
ribbons. Projecting angular/prismatic bay chains contrast with narrow ribbon
windows. The dark upper setback/pitched surface has repeated pale dormer-like
tabs. At the corner a tall recessed glass portal sits under a projecting square
slab. This western Friedrichstraße building is distinct from the traditional
Hanns Eisler/Lutter frontage toward the square. Old retail names visible in the
2009 reference are not evidence of current tenants.

### Borchardt townhouse

Russet/red sandstone and white frames; four vertical bay groups, with single
broad outer openings and paired inner openings. Ground shops plus four upper
window rows are visible. A long iron balcony spans the two central groups,
carried by three pairs of curled brackets; each outer side doorway has a smaller
balcony and paired polished dark columns. One upper row has triangular heads,
the top row segmental heads and a deep frieze. F. W. BORCHARDT lettering, red
central awning and the narrow, richly modeled facade distinguish it from the
larger modern building behind. Keep this townhouse's identity bounded to its
source frontage.

### Immediate square peers

| Building | Distinctive visible form/material |
| --- | --- |
| Lutter & Wegner | Gray-beige ornate stone frames, ochre spandrels, white-framed windows in grouped triples across four upper rows; broad segmental heads in the top row. Rounded corner oriel/drum, ribbed gray zinc turret with oval openings and domed cap. Green ground awnings and arched street openings. |
| HfM / Augustiner | Warm sandstone, flat-lintel ground openings and four upper rows. Colossal flat pilasters span the lower three upper levels, with shallow rectangular spandrel panels; deep bracketed cornice separates the uppermost row. Dark brown two-column, three-pane-height frames. Steep red roof has paired-window stone dormers below flush roof windows. Keep Augustiner signs at ground level. |
| Hotel Luc, former Sofitel | Pale gray-beige, ground round arches, five upper window rows with paired pale frames, grooved pilasters and shield-like spandrels; red mansard with two dormer rows and round heads. The 2017 photo is architecture evidence only; omit its obsolete Sofitel branding. |
| Erdinger / Markgrafenstraße 41 corner | Cream framing, paired dark windows/French rails, projecting first-floor dining bays with balconies above; four straight upper rows above the two-level base and red mansard roof. The corner has a narrow vertical accent. |

The official Markgrafenstraße 39–41 ensemble description distinguishes three
facade characters rather than one repeating generic block: the northern
French/Markgraf corner has ground arcades and triplet windows; the middle has
gray paired-window flanks and pale mosaic fields with dark red gridding; the
southern Jäger corner has dining bays and robust paired-window frames. The
1985–87 Prasser/Borner ensemble has eight levels including two roof levels,
with seven on the Französische Straße side. Do not homogenize these parts.

## Inspected free photographic references

These are external visual-QA references only, with `photo_bundled: false`.
The prepared metadata array is `/tmp/gendarmenmarkt-perimeter-wikimedia-v146.json`
for the implementing agent to merge into both maintained reference manifests.
Temporary image paths below are researcher conveniences, not repository assets.

| Subject / local inspection | Commons reference and attribution |
| --- | --- |
| Hilton facade `/tmp/gm-photos/0.jpg` | [Berlin-Gendarmenmarkt, Hilton-Hotel](https://commons.wikimedia.org/wiki/File:Berlin-Gendarmenmarkt,_Hilton-Hotel.JPG), Dguendel, CC BY 3.0 |
| Hilton entrance `/tmp/gm-photos/1.jpg` | [Hilton Berlin Eingang](https://commons.wikimedia.org/wiki/File:Hilton_Berlin_Eingang.JPG), Andrevishay, public domain |
| Academy `/tmp/gm-photos/2.jpg` | [BBAW 2026-05-26](https://commons.wikimedia.org/wiki/File:BBAW-berlin-geb%C3%A4ude-vom-gendarmenmarkt-ecke-jaegerstr-2026-05-26.jpg), Ixicon, CC0 |
| Q206 `/tmp/gm-photos/5.jpg` | [Friedrichstraße 71–74, Quartier 206](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Friedrichstrasse_71-74,_Quartier_206.jpg), Jörg Zägel, CC BY-SA 3.0 |
| Q205 `/tmp/gm-photos/6.jpg` | [Quartier 205 Berlin-Mitte](https://commons.wikimedia.org/wiki/File:Quartier_205_Berlin-Mitte.jpg), BMG Rights Management, CC BY-SA 3.0 |
| Borchardt `/tmp/gm-photos/7.jpg` | [Weinhandlung Borchardt 02](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Franz%C3%B6sische_Strasse,_Weinhandlung_Borchardt_02.jpg), Jörg Zägel, CC BY-SA 3.0 |
| Borchardt detail `/tmp/gm-photos/8.jpg` | [Weinhandlung Borchardt 06](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Franz%C3%B6sische_Strasse,_Weinhandlung_Borchardt_06.jpg), Jörg Zägel, CC BY-SA 3.0 |
| East Jäger corner `/tmp/gm-photos/9.jpg` | [View to Jägerstraße](https://commons.wikimedia.org/wiki/File:Berlin-Gendarmenmarkt,_view_to_the_J%C3%A4gerstra%C3%9Fe.JPG), Dguendel, CC BY 3.0 |
| Lutter `/tmp/gm-photos/12.jpg` | [Handelsstätte Friedrichstadt 01](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Charlottenstrasse,_Handelsstaette_Friedrichstadt_01.jpg), Jörg Zägel, CC BY-SA 3.0 |
| Hotel facade `/tmp/gm-photos/14.jpg` | [Sofitel Berlin Gendarmenmarkt 2017-1](https://commons.wikimedia.org/wiki/File:Sofitel_Berlin_Gendarmenmarkt_2017-1.jpg), AccorHotels Germany, CC BY-SA 3.0 de |
| HfM `/tmp/gm-photos/15.jpg` | [Charlottenstraße 55, object 09075005](https://commons.wikimedia.org/wiki/File:Berlin_Mitte_Charlottenstra%C3%9Fe_55_(09075005).JPG), Kvikk, CC BY-SA 3.0 |

No source photograph has been committed. No photos, logos, protected murals or
website assets should become runtime textures. The source note deliberately
does not resolve hidden courtyard facades, every full-elevation bay count, or
tenant lettering absent from a current primary source. Those uncertainties
must remain bounded procedural choices rather than claimed measurements.


## Implemented source/display contract

The committed supplement contains 16 building groups, 30 official parents and
152 unaltered LoD2 parts. All original wall/roof sheets and the four explicit
courtyard rings are retained. The 109 earlier display prisms remain verbatim in
both the canonical payload and this supplement; their duplicate rendering is
replaced by the complete source models. Three courtyard rings are open to the
sky; Hotel Luc's fourth court has a separate source roof overhead and remains
walkable beneath it.

The 216 street fronts follow original wall endpoints and measured eaves. The
extractor checks multiple street rays, including self-occlusion, and clips only
the lower facade where an actual low porch is in front. Einstein's small curved
corner facets retain their exact planes. The geometric evidence is unchanged;
window counts, relief dimensions and colours are photo-proportioned display
estimates rather than individually measured fenestration.

Shared static, texture-free batches provide full drawn detail on desktop and
mobile. Minecraft uses separate exposed wall/roof courses and cube-based facade
details. Covered-court roof-only parts do not become invisible solid buildings
in either rendering or pedestrian collision. The Schiller monument, theatre,
churches, square, streets and 93-stop catalogue are retained.

Regenerate with `uv run python -m scripts.build_gendarmenmarkt_perimeter_source`.
The process reads retained raw LoD2/OSM files and performs no network requests.
