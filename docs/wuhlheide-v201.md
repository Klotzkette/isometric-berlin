# Wuhlheide amphitheatre — v1.0.101 / Step 10

This bounded refinement corrects the Parkbühne Wuhlheide's flat terrain and two
incorrect solid building proxies. No surrounding building, path, road, tree,
water polygon or earlier source vertex is removed.

## Geometry and evidence

* OSM venue `way/43106382`, grandstand `way/20418995`, tensile stage roof
  `way/33468397`. Full source vertices/tags and geographic and viewer coordinates
  are retained in `geo_data/regierungsviertel/wuhlheide-v201-source.json.gz`.
* The old `OSM-way-20418995` is explicitly `building=grandstand`, `covered=no`:
  it was rendered as a solid nine-metre building. The roof `OSM-way-33468397`
  was rendered as a solid three-metre building. Both were in `east200-22_12`.
  Their **exact replayed colour/position triangle and line multisets** alone are
  removed, rather than clearing a rectangle or footprint that might include the
  retained FOH, toilets or backstage buildings.
* Official DGM1 `DGM1_400_5812.zip`, member
  `dgm1_33_400_5812_2_be.xyz`, provides the earthwork. All 78,897 source 1m
  samples within `[11536,6416,11808,6704]` are retained. Runtime terrain samples
  are4m apart; this is a new local refinement of formerly flat ground. A32m
  apron blends into the existing baseline. Native mode uses4m terrace cells.
* Display coordinates: `x=E25833−389500`, `z=5820000−N25833`; `y=NHN−30`.
  Returned terrain offsets are **total NHN−33**, not an increment on other hills.
  The arena floor is about3.85m and the rim about15.6m in scene coordinates.
  Thus the floor is recessed relative to the raised earthwork, **not below the
  old global y=3 plane**. Existing ground surfaces are draped to the measured
  field, so no old flat plate covers the bowl.
* The [venue operator](https://www.wuhlheide.de/location/geschichte) describes
  the rubble embankments, terraced oval and22.5×16m playing stage. The
  [Berlin monument record09046018](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046018)
  identifies the earthwork, limestone retaining walls, outside stairs and later
  lightweight tent roof. The [official DGM description](https://www.berlin.de/sen/stadt/stadtdaten/geoinformation/landesvermessung/geotopographie-atkis/dgm-digitale-gelaendemodelle/)
  documents the1m terrain grid, EPSG25833 and DHHN2016 vertical datum.
* Stair routes retain their full OSM courses; six radial stairs are explicitly
  tagged80 steps. Backless benches follow terrain contours clipped to the
  exact C-shaped seating footprint and leave mapped aisles/FOH open.
* The complete scalloped roof footprint remains. Four tensile peaks, inclined
  steel legs and a raised playing deck are photographic **display
  interpretations**. Roof elevations14.7–24.5m, deck6.4m, bench spacing and
  widths, steel dimensions and untagged stair widths are not survey claims.
  Native roof columns connect adjacent heights, so they do not leave open seams.

## Permitted photographic references

No photographic pixels or textures are embedded. The photographs supply
recognition cues only; no metric tracing or colour sampling is used.

* [BerlinWuhlheide-2014.JPG](https://commons.wikimedia.org/wiki/File:BerlinWuhlheide-2014.JPG)
  by **Lugnuts**, [CC BY-SA3.0](https://creativecommons.org/licenses/by-sa/3.0/).
  Viewed for four roof peaks, inclined supports and curved backless bench rows.
* [Wuhlheide Konzert Green Day2022-06-01 Bild1.jpg](https://commons.wikimedia.org/wiki/File:Wuhlheide_Konzert_Green_Day_2022-06-01_Bild_1.jpg)
  by **Strubbl**, [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Viewed to corroborate the modern roof and open spectator slopes.

The matching attribution records are in `wuhlheide-v201-evidence.json`; they are also appended to `wikimedia_references.json` and the packaged
`wikimedia_attribution.json`. Release NOTICE is maintained by the integrator. Geometry
based on these recognition references is attributed accordingly.

## Runtime and navigation

`createWuhlheideV201(native=false)` has two static texture-free mesh batches per
style, with day/night materials owned by the existing family lifecycle. It has
no timers, lights, textures, mode cache or rebuild closure. Constructor-only
`sites` fields in both model JSON files are eligible for the audited weak cache;
small navigation and terrain fields must remain readable.

`wuhlheideTerrainOffsetV201(x,z,native=false)` is the shared bounded field.
`wuhlheideGroundAt` only supplies the stage deck; the stadium is no longer a
solid building. `wuhlheideSolidAt` supplies the roof and eight slender supports,
leaving the floor and radial access paths passable. Existing neighbouring source
building collisions retain rings/holes/heights and receive the same rigid terrain
translation as their complete geometry. Ground/road/water/bridge nav stays exact.

## Reproduction and immutable preservation

```
uv run python scripts/build_wuhlheide_v201.py
uv run python scripts/integrate_wuhlheide_v201.py
uv run pytest tests/test_wuhlheide_v201.py -q
cd src/app && bun test tests/wuhlheide-v201.test.ts
```

The model generator reads the committed reduced source after its first extraction.
Raw prerequisites for initial extraction are the bounded OSM API XML and official
DGM archive under `geo_data/regierungsviertel/raw/wuhlheide-v201/`.
The packet preparer always starts from the immutable **v1.0.100** tag, never
successively deforms already modified geometry. It stages12 files for6 existing
packet descriptors, without writing public assets or the master manifest.

`wuhlheide-v201-packet-checkpoint.json.gz` preserves the complete old packet bytes;
`wuhlheide-v201-packet-audit.json` records old/new hashes, exact removed source
multisets and owner records, and every subsequent triangle/line placement run.
Source triangles retain XZ coverage/colours; terrain subdivision only inserts grid
intersections. Non-ground owners, including trees where present, translate
rigidly. **No tree is removed.** Building count stays byte-for-byte consistent
with old descriptor semantics except57→55 for the two explicit replacements.

Largest staged packet:448,564 bytes compressed and1,493,164 bytes decoded. All
packets stay below the unchanged650,000 /2,600,000-byte limits. Four Python tests
and four Bun tests verify source/height agreement, full roof coverage, open
navigation, independent native geometry and a1.2MiB per-style GPU ceiling.
