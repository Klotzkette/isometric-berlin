# Public green-space surfaces in Berlin

This pass colours verified vegetation within Berlin’s dedicated public green spaces. The GRIS snapshot contains 2,563 green-space records and 1,886 playground records. The ALKIS snapshot contains 9,972 vegetation features. The compiler distinguishes grass, ornamental beds, shrubs, and broadleaf, conifer and unspecified woodland. Additional explicitly mapped OpenStreetMap land-cover polygons can supply a material where the official vegetation layer is sparse. The colours are stylized and have no claim to survey the current foliage or season. [Berlin GRIS open data](https://daten.berlin.de/datensaetze/grunanlagenbestand-berlin-einschliesslich-der-offentlichen-spielplatze-wfs-737fd0a4) · [Berlin ALKIS open data](https://www.geoportal.de/info/78d98821-42e2-3c82-a0f7-1baad959b74e) · [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright)

The eligible polygons meet an existing flat ground or park face in each published packet. The process preserves holes and subtracts waterways, buildings, streets, paths, playgrounds, sports pitches, mapped hard surfaces and earlier authored grounds. Native uses complete cardinal cells inside both the land-cover polygon and the retained floor. The additions use the existing local packet lifetime. Earlier geometry, original navigation, the prior mode detail and the project boundary remain in place. Tiles that can carry an existing U-Bahn aperture keep their original material. No photograph or map raster is distributed with the paint.

The compiled catalogue contains 937 mode-specific recipes on 475 map tiles, in 63 bounded shards. The additions cover 435 registry sites in at least one mode and 420 in both. They paint about 4.65 km² in Drawn and 4.24 km² in Native. The shards total 13,059,105 raw bytes and 4,019,439 bytes in the deterministic gzip preflight. The complete offline evidence in `geo_data/regierungsviertel/public-green-v329-evidence.json.gz` accounts for every GRIS record separately. One over-budget packet was omitted. A record with no emitted surface has no material change from this pass.

## Reproduction

Retain the source GeoPackages in `geo_data/regierungsviertel/raw/public-green-v329/`. The GRIS layer names are `gruenanlagen:gruenanlagen` and `gruenanlagen:spielplaetze`. The ALKIS layer is `alkis:gewaesservegetationflaechen`, filtered on `bezeich = AX_Vegetationsmerkmal`. Request GeoPackage output in EPSG:25833. The compiler verifies the exact input hashes and reads the existing local September 2026 OSM extract. [GRIS WFS](https://gdi.berlin.de/services/wfs/gruenanlagen?SERVICE=WFS&REQUEST=GetCapabilities) · [ALKIS WFS](https://gdi.berlin.de/services/wfs/alkis?SERVICE=WFS&REQUEST=GetCapabilities) · [Berlin OSM extract](https://download.geofabrik.de/europe/germany/berlin.html)

Run the compiler into a separate destination, using the retained Hasenheide path mask. The final path revision was also checked against the actual packed vegetation triangles and has zero overlap in both modes.

```sh
uv run python scripts/build_public_green_v329.py \
  --source geo_data/regierungsviertel/raw/public-green-v329 \
  --path-evidence geo_data/regierungsviertel/raw/public-green-v329/park-gap-footprints-v329.geojson \
  --output /tmp/public-green-v329-reproduction
```
