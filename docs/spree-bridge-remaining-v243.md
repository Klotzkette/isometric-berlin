# Step 10 — remaining Spree bridge audit, v243

Audit date: 19 October 2026. This is a follow-up inventory, **not rendered
work or a coverage extension**. v243 itself refines only the three separately
documented Museum Island bridges. No outer packet is changed by this audit.

The retained `raw/outskirts-v187/candidate.gpkg` OSM source was queried for
mapped bridge polygons/closed ways intersecting named Spree river axes.
Existing primary packets were then checked using their actual `nav.ground`
polygons, rather than bounding boxes or a building-detail companion. Source
IDs and areas below permit a small subsequent selection without regenerating
the outer city. Source width, elevation and ornamental estimates still need
their normal explicit provenance.

## Best bounded follow-ups

| Crossing | Exact mapped owner and existing delivery | Evidence and remaining work |
| --- | --- | --- |
| New northwestern Elsenbrücke deck | Bridge way `1488075245`, primary road `1448208864`; 2,713.86 m² fully supported by `ring182-11_5` and `ring182-12_5` at current ground datum 3 m. | v242 includes temporary eastern deck `1017420119`, but omits this newer outline. The [current Berlin construction page](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/brueckenbau/elsenbruecke/) confirms three lanes toward Treptow on the completed northwest half and three toward Friedrichshain on temporary bridges. Use the retained three-lane, one-way road and actual footway evidence; do not present unfinished later construction as complete. |
| Schillingbrücke structure | Existing v242 bridge way `334070717`, packet `7_2`. | Its simplified OSM `bridge:structure=beam` tag does not describe the whole structure. [Landesdenkmalamt 09010026](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010026) identifies retained masonry piers/arches and the 1912 cantilevered steel footway widening. A later correction should preserve v242 source/navigation and replace only the evidenced incorrect structural estimate. Verify exact spans from primary drawings/photos before generating them. |
| Ringbahnbrücke Oberspree | Bridge way `333893460`; 1,371.82 m² fully supported by `ring182-12_5`. Four mapped light-rail bridge axes: `22768991`, `28200405`, `28200408`, `28200410`. | The [heritage record 09095002](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095002%2CT) describes the larger historic railway structure with half-parabolic girders. Fit recognition to the retained current outline and four actual axes; do not infer six current tracks from the historical description, or add motor-road paint/ordinary pedestrian lanes. The road-only v242 extractor would need an explicit rail path. |

An eventual packet supplement should append only source-clipped geometry and
matching navigation under the same existing packet lifetime, with complete
predecessor receipts and unchanged residency limits. Drawn mobile detail must
remain identical; native geometry remains independently orthogonal. The
Elsenbrücke source tag conflict (`humpback` on outline, `beam` on highway)
must be recorded rather than silently interpreted as a surveyed section.

## Additional verification needed

- **Oberbaumbrücke**, way `288514442`: its 4,582.20 m² outline has complete
  support in `9_3` and `9_4`, with two source one-way carriageways, mapped
  footways and elevated subway tracks. The v183 source JSON retains its ring,
  but `SpreeLandmarksV183.ts` actually constructs Molecule Man only. No named
  Oberbaum constructor was found in current runtime TypeScript. Therefore the
  earlier assumption that the ring proves a complete authored bridge is not
  sufficient. Before adding details, inspect the actual source meshes and
  track ownership to avoid duplicating an unnamed structure. Its two levels,
  towers and arches warrant a dedicated bounded model, not a generic deck.
- **Rohrdammbrücke**, way `659122810`: 1,901.16 m², zero intersection with
  current delivered `manifest.footprint`, zero primary packet support. Its
  v242 catalogue entry remains intentionally unrendered. Do not put a bridge
  in blank space or broaden district coverage implicitly.
- Treskowbrücke has 99.55% ground support; Stubenrauchbrücke 84.03%; Kaisersteg
  66.62%; Wilhelm-Spindler-Brücke 87.28%; Minna-Todenhagen-Brücke 47.10%.
  These need explicit approach/coverage handling before complete models can
  be claimed. Salvador-Allende's mapped halves have no usable current ground
  support despite a nearby packet bounding box.
- Way `375699623` is the Ringbahn/Fernbahn crossing and Jungfernheidesteg,
  **not Mörschbrücke**. The [district's Mörschbrücke record](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/bruecken/artikel.178352.php)
  locates that different bridge over Westhafenkanal. Preserve the distinction.

No site photographs, source raster tiles or imagery are bundled by this audit.
