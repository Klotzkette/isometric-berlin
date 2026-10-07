# Civic buildings, theatres and western landmarks — v1.0.82

This is the owner's requested restrained first pass: source roof edges,
shallow windows and floor bands. It adds no replacement solid building,
does not suppress existing source parts and does not replace any earlier
landmark detail. The same source detail is used on desktop and mobile.
The paired Minecraft layer uses axis-aligned facade panels; the measured
roof outlines remain explicitly cartographic hairlines.

## Delivered scope

The 20 retained Berlin LoD2 parents cover Rathaus Tiergarten, the current
Rathaus Mitte at Karl-Marx-Allee 31, Altes Stadthaus, Schillertheater,
Deutsche Oper Berlin, Staatsoper Unter den Linden, the rbb Fernsehzentrum,
Haus des Rundfunks and the four-wing Estrel Hotel. The Estrel Tower
construction site (`way/32664053`) is deliberately not substituted for the
hotel. The new Rathaus development (`way/1532296165`) is not confused with
the current Rathaus Mitte either.

Funkturm receives finer secondary steel bracing and two shallow glazing
bands at the operator's 55 m restaurant and 126 m viewing levels. These
follow the existing taper and retain the complete earlier 147 m outline.
Hella Santarossa's **Blauer Obelisk** is a 15 m stack of blue cube forms at
OSM node `558903414`, with a small basin outline. Cube count, local widths
and basin size are labelled recognition estimates.

Deutsches Theater, Maxim Gorki, Konzerthaus, Neue Synagoge, the Oranien
corridors and Savignyplatz retain their already dedicated, much richer
source models. This pass does not add a competing generic facade over them.
The contextual street/building fill is handled by the independent ring
supplement.

## Evidence and limits

- Exact plan, roof edges, source wall polygons and source height ranges:
  [Berlin LoD2 source tiles](../geo_data/regierungsviertel/city-recognition-v182-evidence.json),
  **dl-de/zero-2-0**, with per-tile URLs and SHA-256.
- [Nine bounded OSM geometry selections](../geo_data/regierungsviertel/city-recognition-v182-osm.json),
  retained Geofabrik extract dated 2026-09-29, **ODbL-1.0**. Source identities
  are explicit, never fuzzy runtime searches.
- [Deutsche Oper, LDA 09096099](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096099):
  its Bismarckstraße front is blind stone; glazing is on the sides. The
  additive window pass explicitly excludes that southern front.
- [Schillertheater, LDA 09020358](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020358):
  retained cubic building hierarchy and low foyer; no new window grid is
  placed on upper fly-tower surfaces.
- [Staatsoper, LDA 09095952](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095952):
  north-facing portico, plaster building and retained stage hierarchy.
- [Rathaus Tiergarten, LDA 09050351](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050351)
  and [Berlin's Rathaus Mitte account](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558583.php):
  distinct civic identities and the latter's blue slab/frontage reading.
- [Estrel operator's history](https://www.estrel.com/de/media/pressemitteilungen/mitteilung/estrel-berlin-feiert-30-jaehriges-jubilaeum):
  the existing four-wing 1994/95 hotel is separate from the newer tower.
- [rbb's architectural account](https://www.rbb-online.de/unternehmen/der_rbb/struktur/standorte/berlin.html):
  the separate Poelzig triangular radio building and raised television slabs.
- [Messe Berlin Funkturm facts](https://www.messe-berlin.de/de/veranstalter/locations/funkturm/fakten).
- [Theodor-Heuss-Platz, district account](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/plaetze/artikel.157064.php):
  blue blown-glass cubes and the published 15 m artwork height.
- [Altes Stadthaus, Berlin](https://www.berlin.de/sehenswuerdigkeiten/3561541-3558930-altes-und-neues-stadthaus.html)
  and [LDA restoration record](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/altes-stadthaus-640948.php):
  the 80 m tower and restored Fortuna. This is the former DDR Council of
  Ministers building, not the separate former SED Central Committee building.

The generalized official Stadthaus parent is only 27.53 m high and omits
the real tower. Its original body remains untouched. A separate thin
two-drum, colonnade, cupola and Fortuna silhouette reaches the published
80 m height. The official **DOP spring 2025** positions the west tower;
local widths, drum heights and the small figure are display estimates.
The rbb parent similarly stops at 22.5 m. Its retained body is supplemented
by two thin slab outlines, aligned to the DOP and operator's 13/14-storey
description; their 55.5/58.8 m display heights are estimates, not measured
LoD2 or verified current surveying. No hidden mass replaces these conflicts.

DOP was inspected locally through
`https://gdi.berlin.de/services/wms/dop_2025_fruehjahr`, layer `dop_2025`,
EPSG:25833 boxes `[382820,5818940,383095,5819120]` and
`[392140,5819600,392285,5819755]`. It remains QA evidence only; no photo,
crop, raster texture or proprietary plan is shipped.

All window/band positions are **procedural display estimates clipped to
source wall polygons**, not a claim to exact surveyed facade bay counts.
This lightweight pass is deliberately not a complete architectural survey.

## Reproduction and budget

Run `uv run python scripts/build_city_recognition_v182.py` with the named
official LoD2 ZIPs in the existing ignored raw cache. The committed bounded
OSM selection is sufficient; initial extraction caches are no longer needed.
No runtime network request is added.

The generated overlay is approximately 1.66 MB JSON, 20,596 line segments
and 7,403 shallow cube instances, in **two draw calls** per active
representation. It contains no second building shell, texture or animation.
Focused Python checks cover identities, source conflicts, budgets and
the blind opera front; Bun checks cover both frozen scene representations.
