# Step 10 — Wedding, Poststadion and Stadtbad Tiergarten (v229)

Bounded additive recognition, retaining every old building, roof, road, lawn,
rail source and memorial detail. Drawn geometry is identical on touch and pointer;
Minecraft uses separately sampled orthogonal blocks. No texture, new light,
photograph, audio, tour stop or residency-budget change is introduced.

## Verified identities and interpretation

- **S-Bahnhof Wedding**: node614445865; platform relation5559039, `level=1`;
  roof way26556185, `layer=2`. The preceding v190 generic default incorrectly
  put this elevated platform at y3.96. Its *complete* existing Group now moves
  rigidly +6.5m, once, before freezing: platform, source roof outline, benches,
  names and the two v205 S markers all retain their local bytes. Other station
  groups and the original Ring course remain unchanged. New platform y10.46,
  ground y5.2, rise5.26m are explicitly **display estimates**, not surveying.
  Retained stair levels/counts independently establish an ascending access.
  Five exact stair runs and four mapped landings are reconstructed
  at the central and eastern approaches. Width2.35m, handrails and portal sizes
  are estimates; the platform stair hole remains intact. Height-sensitive support
  cannot pull a ground walker up to the platform. Source data digests are retained
  in `stationCorrection`; the prior station JSON datasets remain unchanged.
- **Gerichtstraße / former Nettelbeckplatz**: officially **Martha-Ndumbe-Platz**
  since 12 October 2025. The mapped square relation4717544 is triangular; the
  round landmark is the fountain **Tanz auf dem Vulkan** (1988, Ludmila
  Seefried-Matejková), exact way25277454. Its complete mapped outer basin is
  retained; abstract stepped volcanic core, two dancing couples, singer and
  pianist add recognition. Poses, material and internal dimensions are estimates.
  The published approximate7m basin and mapped9.53m outer envelope differ; the
  map controls the outer surround while the inner basin uses a7m reading.
  The square's existing buildings, roads, trees and paving are untouched.
- **Stadtbad Tiergarten**, Seydlitzstraße7, way30912220: twelve exact retained
  official LoD2 leaves. Every part retains its old displayed prism datum; no
  uniform hill translation and no replacement roof. Additive west-hall glazing,
  metal mullions, wooden wave cues and geometric entrance lettering use measured
  wall planes. Those small subdivisions are estimates. The operator's glass
  facade and wood waves are documented by Berlin's 2024 renovation account.
  The outside pool is still identified as construction in the retained 2026
  source/operating information and is not presented as a completed water basin.
- **SportPark Poststadion**: seven named/mapped football fields and seven tennis
  courts receive only clipped markings, open goals and sparse net cues. All
  actual pitch rings are retained. No broad replacement carpet, stadium shell
  or adjoining Vabali spa pool is added. Ground heights use a bounded exact
  excerpt of the *delivered* ground-context16m field (drawn bilinear, native
  nearest-cell), rather than an independent DGM approximation.
- **Geschichtspark Zellengefängnis Moabit**: the prior v157/v183 model already
  retains all19 mapped red-brick wall segments (ways53178124,105495351,
  498279237,498279239), mortar, whitewash and three open entrances. Current
  retained PBF comparison found no missing perimeter fence. It is therefore
  preserved; a fictional duplicate fence or audio layer is not added. Real
  browser QA should verify the standing walls and the three access gaps.

## Evidence and public references

Metric source: retained Geofabrik Berlin PBF `berlin-260929.osm.pbf` (OSM/ODbL1.0),
Geoportal Berlin official [LoD2 tile388/5820](https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5820.zip)
(dl-de/zero-2-0), existing complete `ground-context.json`. Original source
coordinates and pool wall/roof sheets live in the small v229 source receipt;
only the bounded runtime profile is bundled.

- [Berlin district resolution for Martha-Ndumbe-Platz](https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2025/artikel.1578936.php)
- [Berlin.de, renaming on12October2025](https://www.berlin.de/aktuelles/9967483-958090-nettelbeckplatz-heisst-jetzt-martha-ndum.html)
- [Public art inventory, Tanz auf dem Vulkan](https://bildhauerei-in-berlin.de/bildwerk/tanz-auf-dem-vulkan-5222/)
- [S-Bahn Berlin, Wedding station](https://sbahn.berlin/fahren/bahnhofsuebersicht/wedding/)
- [DB, January2026 fire and damaged canopy](https://www.deutschebahn.com/de/presse/presse-regional/pr-berlin-de/aktuell/presseinformationen/S-Bahn-Halt-in-Wedding-voraussichtlich-wieder-ab-Anfang-Februar-13715742)
- [Berliner Bäder-Betriebe, Stadtbad Tiergarten](https://www.berlinerbaeder.de/baeder/detail/stadtbad-tiergarten/)
- [Berlin, renovation and wooden waves](https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/nachhaltige-erneuerung/aktuell/artikel.1443898.php)
- [Sports park operator](https://sportparkpoststadion.de/informationen/der-sportpark)
- [Berlin, Geschichtspark](https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html)

These pages supply identity/factual architectural cues only; no website image,
protected plan, photo crop or texture is bundled.

## Construction and integration

`uv run python -m scripts.build_wedding_moabit_v229 --extract` reads bounded
retained PBF and the single official ZIP. Without `--extract`, runtime generation
replays the committed source receipt. `createWeddingMoabitV229(native)` is the
new required root. The existing rail constructor directly invokes
`applyWeddingStationHeightV229` before freezing. Root navigation can use
`weddingStationFloorAtV229(x,z,currentFeetY,native)` and
`weddingStationSolidAtV229(x,y,z,radius,native)`; only represented stair rails
are solid. Decoded runtime JSON uses a WeakRef; scene nodes never retain it.

Current profile: 17,352 bytes JSON; 20 culled meshes, 4,483 drawn instances plus
three thin source canopies and 18,646 independent native instances. Instance
matrix/color arrays occupy 340,708 / 1,417,096 bytes.
The old rail-family vertex/instance counts stay identical. Python replay/source
checks and actual geometry stair raycasts pass; every tread is tested in both
representations. Prior rail-station tests remain green. Final browser checks
must wait for real late surrounding/surface packets before assessing visibility.
Recommended views: Wedding central access(-236,-2667), eastern access(-85,-2772),
plaza fountain(-73,-2869), Stadtbad west(-820,-963), Poststadion(-793,-1257),
memorial walls(-329,-906). Check both drawn/native and one touch view, with
stair ascent/descent and ground-level underpass remaining separate.

Final access connectivity check: retained OSM way 363581647 (level 1) supplies the 3.843 m eastern landing between the upper stair and platform relation 5559039. It is represented as the fourth horizontal landing with the same exact source endpoints, rails and height-gated support; no source platform enlargement.

Production walking uncovered the old source canopy prism 26556185 at y5.2–8.2,
which competed with the elevated station. Its complete original row is pinned
in `stationCorrection.previousCoreRoof`; only a byte-equivalent row transfers
to the exact mapped canopy at y14.84–14.96. Native source ownership is separately
recorded by `weddingStationCorePreviousV229.json` and
`scripts/build_wedding_station_core_previous_v229.py`: 73 exact old columns; the
overlapping foreign column remains. Both navigation and representation preserve
the overhead opening. Forty small orthogonal native cells reconnect the upper
stairs where the older 1.5m raster had enlarged the source hole; these stay in
the mapped platform footprint and do not replace its full native deck.

Actual movement-step regression now climbs both complete accesses, reaches
y10.46 and descends to5.2 in Drawn and Native against the real previous Core
roof owner. Actual canopy ray hits match the thin roof collision at14.96. The
global roof-support priority is unchanged.

The final complete-Core movement regression also caught eastern access canopy
owners 73863640 and 65379920. Their complete original rows and source footprints
are retained, and their old closed 5.2–8.2m generic prisms transfer to thin ascending
roofs. The grade is a disclosed display estimate (3.6m above the access start,
following the mapped level0-to-level1 direction), not surveyed architecture. The
three-owner native receipt now has79 uncontested columns. Both accesses and two
ground-level routes pass against the whole supplied Core obstacle index; eastern
canopy rays independently check every stair tread's head clearance. Full extension
obstacles remain part of the final production browser run, not a mocked unit claim.

Final variable-frame regression reproduced two local support errors without
requiring any geometry change: floating-point projection could place the exact
eastern landing endpoint a few ulps outside its segment, and a 100ms descending
frame could exceed the former 0.55m gate while collision substeps still used that
frame's starting height. The existing stair footprint now accepts a 1µm endpoint
tolerance, and its height gate is 0.8m (1.3m normal walking distance times the
steepest mapped slope, plus one tread). Platform and roof height gates are
unchanged; street pedestrians cannot snap to the elevated deck. Both complete
accesses pass ascent/descent with 16/33/50/100ms frames and 30ms steering against
the complete Core. Four focused movement tests pass with 4,532 assertions; the
existing rendered geometry and memory counts above remain unchanged. Browser
route probes must release the movement key synchronously on arrival to avoid
counting a controller overshoot during the Playwright round trip as a fall.
