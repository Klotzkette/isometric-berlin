# Berlin McDonald’s restaurants — source and geometry audit

The current public operator locator contains **40 restaurant locations inside the
exact Berlin state boundary**. All 40 are cross-identified with the 40 active
McDonald’s restaurant objects in the retained Berlin OSM snapshot. Nine further
matching OSM objects are historical or nonrestaurant features, and remain explicit
exclusions. The audit covers the published directory; it cannot guarantee an
unlisted opening or an unreported closure.

**18 restaurants receive visible improvements:** nine supported facade signs
and nine previously absent mapped buildings. The authored Hauptbahnhof restaurant
remains intact. Ten indoor or upper-floor concessions receive no invented outside
facade. Three mall/platform frontages and eight other locations remain unresolved where preceding fittings, an
exact authored replacement, ambiguous ownership or a missing supported facade
prevent a defensible addition. Every branch has a recorded outcome below.

## Sources and identity

- [McDonald’s official restaurant finder](https://www.mcdonalds.com/de/de-de/restaurant-suche.html), retrieved 2026-11-15. Its published widget's `locations/all` endpoint returned 1,406 unique German location identifiers, with no pagination metadata. Every point was tested against the retained exact Berlin state polygon; neither postal-city strings nor a radius around the centre define the selection. Zero postal-Berlin points lay outside, and zero inside points used another postal city. BER Airport is outside Berlin and is not counted.
- All forty published location detail records were read for branch identity, public business address, services and reference-photo URLs. Public contacts, opening hours, operator personal details and private notes are excluded from the retained record contract. Runtime code never contacts the operator or an external map service.
- [Geofabrik Berlin, 13 November 2026](https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf), OpenStreetMap contributors, ODbL 1.0. Restaurant identities, actual building polygons, storeys where mapped, and mapped tenant levels. Official identifiers/full addresses take priority; a single nearby matching brand point may resolve identity but never establishes the host facade. Ambiguous nearby matches, reused OSM identities and future-opening records fail compilation.
- Berlin Geoportal LoD2 and retained source geometry establish existing wall owners. Berlin ATKIS DGM1 / dl-de-zero-2.0 supplies the nine new buildings' original 1m terrain samples; source tiles, download hashes, sampled cells and vertical datum are retained separately. World vertical coordinate is DHHN2016 NHN minus 30 metres.

Official points are not surveyed entrances. For example, Alexa's published point
is about 191m from its mapped second-floor food-court tenant. Its identity is
resolved by address and its level is preserved, without placing a street facade
at the directory pin. Ostkreuz's official photograph shows the platform-F
concession; Spandau Arcaden's photograph shows a high shared mall logo, and the
East Side Mall photo does not establish the selected tenant frontage. Those three
wall-sign candidates were excluded after photo review. Attached McCafé services
do not create duplicate restaurants.

## Visible geometry and limits

The nine existing-building additions use original geometric yellow arches,
white bitmap lettering and a restrained charcoal sign background. Drawn uses
curved ribbon geometry; Native uses an independently cardinal pixel silhouette.
The brand family is supported by official reference photographs. Fitting size,
height and the selected road-facing clear wall area are display estimates, not
claims of a measured sign or entrance. Existing windows and older fittings take
priority. No image, logo artwork or font texture is redistributed.

Each old-host sign is checked against both the prepared predecessor and the fully
decoded production geometry, including later facade finishes. Its entire padded
width/height sample rectangle must have coplanar retained wall support and no
crossing older fitting. Production proofs verify unchanged older position,
colour and triangle words, navigation, source ordering, metadata, linework and
material shader/uniform behaviour in both modes. The compact recipe shares the
host’s admission and retirement, expands lazily and has no separate resident
scene or network request.

The nine new buildings are Rudower Straße100, Markstraße16, Alt-Mahlsdorf60,
Bitterfelder Straße9, Osdorfer Straße125a, Kurt-Schumacher-Damm38,
Großbeerenstraße22, Wendenschloßstraße2 and Prenzlauer Promenade45. All nine
operator main photographs were inspected. Their individual pitched/flat roofs,
green/charcoal roof colours, plaster/wood-like fascia colours, glazed fronts and
one- or two-storey proportions are represented. Exact Drawn footprints come from
the mapped buildings; Native is independently rasterized to cardinal 1m cells.
OSM storeys exist for Bitterfelder Straße, Großbeerenstraße and Prenzlauer
Promenade. Storey metres, the other heights, roof rises, glazing bay dimensions
and sign placements are explicitly estimated from the photographs. DGM samples
establish a median floor level and a foundation extending to the lowest sampled
ground. All nine source footprints lack preceding surrounding ground in both
modes. A finite ground mesh and navigation domain therefore cover only each
actual building footprint at its DGM median height. Existing ground is independently
subtracted in Drawn and Native, and remains unchanged; no district or approach
surface is invented. These are source-anchored recognition models, not photographic
surveys.

No entrance aperture, pylon, playground, terrace, drive-through lane or current
menu/price is invented. A published McDrive service alone is insufficient evidence
for a lane layout. Existing restaurant geometry and navigation are never replaced
by a new approximate shell. New source-owned chunks use the existing surrounding
queue, cancellation and retirement machinery in all six modes.

## Storage and reproduction

- Nine existing-host recipes: one compact module, 6,978 bytes uncompressed before bundling.
- Nine new hosts / eighteen gzip payloads: 88,821 bytes total; no external images or texture assets.
- Current source facts, source hashes and full outcomes are in `geo_data/regierungsviertel/mcdonalds-v351-*.json.gz`.
- Module integration: `mcdonaldsEntriesV351`, kind `mcdonalds-v351`, follows the fuel additions. New host prefix: `mcdonalds351-`.

```sh
uv run python -m scripts.build_mcdonalds_inventory_v351 --fetch --extract
uv run python -m scripts.extract_mcdonalds_buildings_v351
uv run python -m scripts.build_mcdonalds_v351
bun run src/app/scripts/capture-mcdonalds-v351.ts geo_data/regierungsviertel/raw/city-v351/mcdonalds-compact.json geo_data/regierungsviertel/mcdonalds-v351-evidence.json.gz
uv run python -m scripts.build_mcdonalds_v351 --publish
bun run src/app/scripts/verify-mcdonalds-v351.ts
uv run python -m scripts.build_mcdonalds_supplements_v351
uv run pytest -q tests/test_mcdonalds_v351.py
bun test src/app/tests/mcdonalds-v351.test.ts
```

Terrain extraction is a separate bounded offline source step; its recorded DGM
cells are reused by the supplement compiler. The manifest delta is integrated
only after the shared public-size and source-ownership checks. Previously
published source packages and immutable history are retained.

## Per-branch outcomes

| Operator ID | Public address | Outcome |
| --- | --- | --- |
| 212 | Clayallee 121 | Existing fittings/replacement preserved; unresolved sign |
| 312 | Rudower Straße 100 | Exact mapped building supplement |
| 385 | Markstraße 16 | Exact mapped building supplement |
| 658 | Hermannplatz 2-3 | Supported sign on retained building |
| 709 | Am Juliusturm 40-46 | Supported sign on retained building |
| 717 | Alt-Mahlsdorf 60 | Exact mapped building supplement |
| 788 | Bitterfelder Straße 9 | Exact mapped building supplement |
| 796 | Alt-Friedrichsfelde 61 | Supported sign on retained building |
| 835 | Adlergestell 289a | No supported paired facade; unresolved |
| 892 | Hansastraße 1 | Supported sign on retained building |
| 987 | Charlottenburger Chaussee 49 | Supported sign on retained building |
| 992 | Am Borsigturm 2 | Indoor/upper-floor tenant; no invented exterior |
| 994 | Kantstraße 111a | Supported sign on retained building |
| 1061 | Alboinstraße 4 | No supported paired facade; unresolved |
| 1079 | Am Ostbahnhof 9 | Indoor/upper-floor tenant; no invented exterior |
| 1113 | Mecklenburgische Straße 65-68 | Supported sign on retained building |
| 1129 | Heerstraße 666 | Supported sign on retained building |
| 1173 | Osdorfer Str. 125a | Exact mapped building supplement |
| 1194 | Klosterstraße 3 | Mall/platform frontage unresolved; no ground-level sign invented |
| 1202 | Kurt-Schumacher-Damm 38 | Exact mapped building supplement |
| 1323 | Karl-Marx-Straße 66 | Ambiguous overlapping owners; unresolved |
| 1326 | Osloer Straße | Indoor/upper-floor tenant; no invented exterior |
| 1384 | Europaplatz 1 | Existing station interior preserved |
| 1385 | General-Pape-Straße 1 | Indoor/upper-floor tenant; no invented exterior |
| 1403 | Marzahner Promenade 1a | Indoor/upper-floor tenant; no invented exterior |
| 1418 | Wrangelstraße 35 | Supported sign on retained building |
| 1430 | Sonnenallee 254 | No supported paired facade; unresolved |
| 1435 | Grunerstraße 20 | Indoor/upper-floor tenant; no invented exterior |
| 1477 | Großbeerenstraße 22 | Exact mapped building supplement |
| 1539 | Friedrichstr. 141-142 | Indoor/upper-floor tenant; no invented exterior |
| 1550 | Friedrichstraße 207 | Authored core building; unresolved tenant facade |
| 1564 | Wendenschloßstraße 2 | Exact mapped building supplement |
| 1672 | Leipziger Platz 12-13 | Indoor/upper-floor tenant; no invented exterior |
| 1688 | Prenzlauer Promenade 45 | Exact mapped building supplement |
| 1721 | Hanne-Sobek-Platz 1 | Indoor/upper-floor tenant; no invented exterior |
| 1723 | Sonntagsstraße 37 | Mall/platform frontage unresolved; no ground-level sign invented |
| 1733 | Hardenbergplatz 11 | Indoor/upper-floor tenant; no invented exterior |
| 1823 | Tauentzienstraße 9-12 | Authored core building; unresolved tenant facade |
| 1867 | Tamara-Danz-Straße 11 | Mall/platform frontage unresolved; no ground-level sign invented |
| 1930 | Schloßstraße 4-5 | Existing fittings/replacement preserved; unresolved sign |
