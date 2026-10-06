# Narrow city connectors, v1.0.80

Pipeline step 3 supplies the owner-approved, sparse connections from
Funkturm/ICC and Steglitzer Kreisel to the existing detailed city. The source
supplement is `geo_data/regierungsviertel/outer-connectors-v180.json` and its
reusable extractor is `scripts/extract_outer_connectors_v180.py`. It changes
neither `bounds.geojson` nor any previous source record. Runtime preparation,
finite outline bounds and release checks are owned by the integration.

## Exact evidence and licence

The existing [Geofabrik Berlin extract dated 29 September 2026](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf)
contains OpenStreetMap data through `2026-09-29T20:22:51Z`. The extractor checks
its SHA-256 against the retained v179 source manifest. Geometry is
© OpenStreetMap contributors, ODbL 1.0. OSM identities, all source vertices,
complete footprint exteriors and all courtyard rings survive. Nothing is
traced from images, simplified, moved or joined by an invented straight line.
Raw candidates remain under ignored `raw/v180/`.

Two **already-cached** official Berlin LoD2 tiles, `383_5818` and `387_5815`,
provide matched parent heights where available. Their URLs, archive hashes and
dl-de/zero-2-0 licence are in `officialHeightSources`. Matching requires at
least 85% coverage of the selected OSM footprint by one official parent.
The artifact keeps the official parent identity and matching fraction. This
uses surveyed vertical envelopes together with mapped OSM plan outlines; it
does not claim the OSM and LoD2 footprints are geometrically identical. No
additional whole-city data or imagery was downloaded.

Preserve the viewer's existing attribution:
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0).

## Continuous mapped routes and delivered-city seams

The west route follows **Messedamm and Neue Kantstraße**. The detailed City
West already starts across Neue Kantstraße at longitude 13.282 and continues
toward Kantstraße, so the supplement stops at mapped junction vertices shortly
inside that city. Seventeen short mapped service/footway/steps ways connect the
Funkturm entrance and ICC frontage to this street network. Both existing
landmark footprints have zero plan distance to the included mapped entrance
network. Some Messe service links carry `access=private`; this is cartographic
context, not a statement that those ways are public walking routes.

The south route follows the existing **Schloßstraße** through **Rheinstraße
and Hauptstraße** into Schöneberg. Existing Schloßstraße source geometry is
not copied: `existingLineOverrides` supplies corridor/width metadata for its
99 participating ways. The other four retained v179 Schloßstraße ways stay
intact and outside these metadata additions.

| Connector | Exact city-side shared vertex, lon/lat | Source ways present in delivered city | Existing-city overlap |
| --- | --- | --- | --- |
| ICC/Funkturm → City West | 13.2826329, 52.5064735 | Neue Kantstraße ways 4446497 and 450086119 | 185.063 m |
| Steglitzer Kreisel → Schöneberg | 13.3464925, 52.4804531 | Hauptstraße ways 1126373243 and 1126373244 | 183.005 m |

The exact way identities above are verified against
`src/app/public/mesh/surrounding-berlin-v159/source-inventory.json.gz`, with its
SHA-256 retained in QA. These are actual delivered streets, not merely points
inside a broad scope polygon. Both complete connector graphs are connected
through shared, original OSM vertices. The source-network lengths are
1,283.191 m west and 7,821.293 m south; these sum separately mapped carriageways
and branches, and are not single-direction travel distances. No geometric
proximity snap is used as a graph connection.

Street records retain mapped `width`, `lanes`, `oneway`, `bridge`, `tunnel`,
`layer` and `access` values where present. `displayWidthM` prioritizes an
explicit OSM width, otherwise uses a labelled lane-count or conservative class
estimate. Offsetting these centerlines for thin road-edge strokes is a display
operation, not surveyed curb geometry. Source widths and lane counts are
dated map evidence, not live traffic information.

## Street-facing buildings and Kreisel identity

The candidate band is **45 m from either mapped carriageway**. A rear building
is removed from the new candidate set where its nearest approach from the
street crosses another mapped building larger than 50 m² by more than 1 m;
a 0.2 m inset prevents shared edges from blocking a frontage. Roofs and kiosks
do not block the selection. This removes 98 rear candidates. It is a finite
cartographic frontage rule, not a visibility simulation or an authorization
to populate the districts.

Selected buildings retain their entire source footprints, including rear
wings and courtyards. They are **not clipped into artificial building shapes**.
Buildings intersecting the retained detailed-city area are excluded completely
from the supplement, avoiding a second wire envelope over existing detail.
There are 279 retained footprint records: 10 west and 269 south, with all
12 source courtyard rings. Previous v179 landmark footprints are excluded by
source identity. Neither their geometry nor the existing city is replaced.

The Steglitzer Kreisel receives two separately identified source envelopes:

- **Way 34782007:** the actual mapped low commercial podium, OSM height 6.5 m.
- **Way 34782006:** the separately named **Kreisel-Parkhaus**, OSM height 28 m
  and 11 levels. The mapped metric height is retained; floor-count conversion
  is not substituted.

The retained v179 tower is still way 34782008 at 118.5 m. The podium and parking
are additional envelopes beside/under that tower, not a replacement of it.
The neighbouring shopping centre **Das Schloss** remains its own named way
28504291 if selected as ordinary street frontage; it is never mislabelled as
the Kreisel podium. Elaborate individual building parts, tiny columns and
ambiguous historical subdivisions from `raw/v179/kreisel-all.json` are not
needed for this sparse outline representation.

## Height evidence, bounds and verification

The final footprint records contain:

- 61 matched official Berlin LoD2 parent vertical envelopes;
- 20 explicit OSM metric heights;
- 141 labelled display estimates derived from mapped storey counts
  (3 m per ordinary floor, 2.5 m per tagged roof floor);
- 57 explicitly unsurveyed display heights where neither source provides
  a usable metric height or floor count.

Every record retains its height source, estimate flag and available original
OSM height/floor tags. LoD2 wins over OSM for confidently matched ordinary
frontages; the two explicitly identified Kreisel envelopes keep their mapped
metric OSM heights. Ground levels, road grades, facade divisions and wire-frame
member spacing are not surveyed by this artifact.

The supplement is **317,622 bytes** uncompressed: 158 new independent lines,
99 metadata-only existing-line overrides, 279 footprints and two city-seam
anchors. All exterior and courtyard rings are closed and valid. QA confirms
zero overlap area with detailed-city building scope, zero duplicate v179
geometry identities, connected original-vertex graphs and two delivered-road
attachments. The source is smaller than 0.4 MB; the separately measured runtime
budget remains an integration check.

Reproduce using the retained PBF, cached source ZIPs and prior manifests:

```bash
uv run python scripts/extract_outer_connectors_v180.py
uv run ruff check scripts/extract_outer_connectors_v180.py
```

No full-city rebuild, broad district fill, raster/photographic texture,
new tour stop or network service is introduced.
