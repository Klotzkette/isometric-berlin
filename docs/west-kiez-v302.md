# West Kiez v302: complete source houses and individual street fronts

This finite pass covers 32 mapped addresses in City West and Schöneberg. The
main defect was geometric: several core fallback houses were 9–18m extrusions,
although the official source contains articulated, taller front/rear buildings,
bays, lower wings and roofs. Existing v188 fronts used one 3.8m opening grid;
v235/v254 only fitted some existing openings. A palette change could not repair
these missing volumes or distinguish the street fronts.

## Complete core corrections

`WestKiezV302Core.ts` constructs all 89 official leaf parts of 15 complete
parents, with 16 mapped addresses. The exact original 18 fallback prisms remain
in the source receipt. No parent is clipped to its street wall. Absolute source
coordinates use X=E−389500, Y=NHN−30, Z=5820000−N; no manual height lift is used.
All source walls, articulated roof sheets and ring holes are retained. The
independent native model uses precompiled cardinal wall/roof surface members.

The last column below is the **whole parent's maximum vertical extent**, not a
claim that its street-facing villa has that height. Several families include
higher rear buildings.

| Mapped address | Official parent | Leaf parts | Exact old prism and height | Whole family extent |
| --- | --- | ---: | --- | ---: |
| Bleibtreustraße 17 | DEBE04YY50000Bhx | 5 | 19761855 (10m) | 25.82m |
| Schlüterstraße 45 | DEBE04YY50000AsE | 8 | 42296377 (16.5m) | 29.80m |
| Bleibtreustraße 40 | DEBE04YY50000DzX | 4 | 29917217 (18m) | 26.27m |
| Wielandstraße 5 | DEBE04AL4sc0000u | 4 | 32450215 (21m) | 25.29m |
| Bleibtreustraße 42 | DEBE04YY50000MOh | 5 | 57687257 (18m) | 24.73m |
| Bleibtreustraße 15, Bleibtreustraße 16 | DEBE04YY50000C9m | 17 | 45220398 (16.5m), 57687278 (10m) | 28.93m |
| Wielandstraße 13 | DEBE04YY500009i1 | 4 | -1607691 (15m) | 25.48m |
| Fasanenstraße 25 | DEBE04YY50000FEf | 5 | 48472662 (15m) | 29.23m |
| Knesebeckstraße 68-69 | DEBE04YY50000NGG | 8 | 57727687 (15m) | 25.11m |
| Savignyplatz 4 | DEBE04YY50000KcL | 4 | 50262322 (27m) | 23.56m |
| Savignyplatz 13 | DEBE04YY50000P2l | 6 | 45132556 (27m), 07969154 (18m) | 23.51m |
| Fasanenstraße 24 | DEBE04YY500007zt | 3 | 48472661 (9m) | 18.30m |
| Fasanenstraße 23 | DEBE04YY500007bB | 6 | 62057645 (13.5m), 07891900 (9m) | 26.93m |
| Savignyplatz 3 | DEBE04YY500009Vw | 3 | 50262320 (27m) | 23.78m |
| Knesebeckstraße 33/34 | DEBE04YY50000HBF | 7 | 05407694 (18m) | 26.07m |
The original and official footprints are not identical. Their complete source
alignment differences, including 77.985m² of old footprint outside the official
families, remain in `west-kiez-v302-core-source.json.gz`. These small mapped
alignment corrections are deliberate; the module does not claim unchanged XZ
boundaries. No unrelated owner is admitted. All 552 retired native tuples are
present in the actual full affected source rows and exclusively owned by these
18 original prisms; no shared tuple is retired. Both complete source admission
and complete attached replacement are required before original geometry/nav
can yield. There are 89 granular nav solids with their source rings, holes,
minimums and roof-aware tops, not one bounding box.

Native navigation separately follows the actual upper cap of every compiled
body box, including stepped roofs and gable-wall tops. Each source leaf retains
its own cap profile and true courtyard ring. `westKiezV302Solids(false)` keeps
measured drawn roofs; `true` uses the compact exact native rectangle unions.
The separate navigation-only JSON cannot import model recipes into the Worker.

The entire official envelope supplies the actual silhouette. Shallow window
joinery and courses follow each real wall polygon. The modern Wielandstraße5
has narrower tall glazing, distinct from the historic houses. Small joinery
centres, spacing, colours and dimensions remain display estimates. Free rear
and courtyard walls retain a neutral estimated fitting complement, so retiring
an old coarse prism does not leave its rear sides blank. Party walls and source
parts blocking the outward probe are excluded. This is not a claim that every
backyard window was photographed or surveyed.

Existing glazing members in the required core use a deterministic estimated
38% warm night occupancy, without extra window geometry or timers. A shared
face-shaded box primitive keeps the native volumes legible by day. Streamed
Fasanen fittings retain the ordinary tile material and its existing lifetime.

## Street packets and exact retirement

Sixteen additional mapped houses are refined in their existing stream packets:
Akazienstraße12,14,15,17,30; Goltzstraße32; Crellestraße5,8,9,15,16,36;
Landshuter Straße15; Hauptstraße146; Stuttgarter Platz16,19. The real address
point/polygon must resolve to one actual original source owner. Existing
source triangles verify the whole target wall, including its original height.
A v188 companion carries existing front replacement; otherwise the original
primary packet carries the new shallow fittings. Houses/courtyards are not
filled with invented blocks.

Goltzstraße32 has independently counted seven main Goltz axes and five return
axes toward Hohenstaufenstraße, over five storeys. The procedural fittings
interpret its pale glazed brick, dark vertical piers, red spandrel accents,
small sash lights and cornice hierarchy. They are original code geometry; no
reference pixels are bundled. Its existing measured body/roof remains intact.
The source supports Akazienstraße30's small sash variation and strong courses,
Landshuter15's decorated Renaissance surrounds, and the restrained early
Crellestraße15/16 treatment. Other small opening dimensions and spacing are
estimated, not claimed to be exact photographic counts. Hauptstraße146 has
only its mapped address/body as specific evidence and receives neutral shallow
frames; no historic ornament, tenant, sign or opening-time claim is inferred.

Fasanenstraße23/24/25 have old v163 fitting geometry. Their three complete new
front/rear fitting families live exclusively in those original tile lifetimes;
the required factory retains their complete source bodies but does not create
a second copy of their fittings. The actual historical `core_detail`,
per-owner `native_detail` and clipping replay identifies all old fitting
triangles, including duplicate triangles. Its original encoded parts remain
byte-identical. Full original packet mesh/nav/line guards and the complete new
append fingerprint precede index retirement. Actual v235/v254 owner evidence
and an independent delivered-rectangle replay each find zero later fittings of
these selected owners; no later appended part is erased.

There are 18 plans across nine existing tile pairs. The retirements are exactly
552 v188 fitting triangles, 866 drawn v163 fitting triangles and 2,312 native
v163 fitting triangles. Complete old bodies, roofs, lines, navigation and
unrelated fittings remain. Two existing StreetCurvesV276 road appends legitimately
change prepared navigation: `drawn:-3_6` pins2831834486 after raw2811163608 and
`drawn:-2_6` pins1269267644 after raw482955759. The offline guard step invokes
that real preparer and rejects any other changed prepared-nav value. No line
stream changes. Defaults are closed; capture occurs before older
preparers, append after them, and retirement is private to the complete decoded
packet. Cancellation allocates no scene object. Missing source/append/revoked
admission leaves the old fitting indices intact. New native faces are actually
cardinal; full drawn mobile/touch uses the same complete geometry.

## Sources, reference limits and credits

- [Geoportal Berlin official LoD2 download](https://gdi.berlin.de/data/a_lod2/atom/):
  full `LoD2_385_5818.zip` and `LoD2_386_5818.zip`; exact archive SHA256, all
  parent/leaf/surface rings and coordinates retained in the source receipt.
  Geometry: Datenlizenz Deutschland Zero2.0 (`dl-de/zero-2-0`).
- [OpenStreetMap](https://www.openstreetmap.org/copyright): exact retained public
  address nodes/ways and prior source-owner identities, ODbL1.0. Raw source PBF
  SHA256 is retained. No private occupant identity is inferred.
- [Landesdenkmalamt: Bleibtreustraße17](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020361)
  and [district Wintergarten ensemble23–25](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/villen/artikel.196549.php):
  source-specific historic forms, actual villas, courts and reconstruction
  history. District photographs are external references only.
- [District: Bleibtreustraße15–17](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/wohnhaeuser/artikel.190103.php),
  [district monument register](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/geschichte/artikel.240397.php):
  Bleibtreu40/42, Knesebeck68–69, Wieland13, Stuttgarter16/19 identity and history.
- [Primus: Wielandstraße5](https://primusimmobilien.de/de/portfolio/wielandstrasse-5):
  completed2023 architecture and operator photograph. External reference only.
  [Wielandstraße13 operator](https://www.city-concept.de/projekte/wielandstrasse-13)
  supports the distinct protected historic identity.
- [Literaturhaus building history](https://li-be.de/haus/geschichte/),
  [2026 Lotto foundation reference](https://www.lotto-stiftung-berlin.de/projekte/40-jahre-literaturhaus-in-berlin/):
  Fasanenstraße23 building context. Renovation/current return dates do not
  establish a currently open restaurant; no such operational claim is made.
- [Goltz32/Hohenstaufen corner](https://bildhauerei-in-berlin.de/bildwerk/mietshaus-hohenstaufenstrasse-goltzstrasse-10465/):
  Nicola Vösgen research for Bildhauerei in Berlin; **Pauline Ahrens,2023,
  CC BY4.0 photograph**. This photograph was directly inspected to count front
  axes/storeys and interpret material bands. It is not redistributed.
- [Akazien12](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066354),
  [14](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066355),
  [15](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066356),
  [17](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066357),
  [30](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066358);
  [Crelle5/6](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066423),
  [8](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066424),
  [9](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066425),
  [15](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066426),
  [16](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066427),
  [36](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066428);
  [Landshuter15/Haberland1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066609):
  individual primary monument records. Short factual paraphrases guide original
  code members; no full text or reference pixels are bundled.

This pass does not claim all streets in either district are now photographically
complete. It corrects the named finite set, with measured envelopes and a
clearly separated estimated small-fittings layer. No navigation route, coverage,
texture request, animation timer, tour stop or higher runtime/package cap is added.

## Reproduction and checks

Run `uv run python -m scripts.build_west_kiez_v302`, then
`uv run python -m scripts.build_west_kiez_v302_packets`, followed in `src/app` by
`bun scripts/hash_west_kiez_v302.ts` and
`bun scripts/capture-west-kiez-v302-prepared.ts`. The JS step is required:
`JSON.stringify(raw.nav)` follows JS number serialization, not Python's.
Run `uv run python -m scripts.build_west_kiez_v302_native_nav` for the independent
navigation-only exact cap unions; it verifies attribution against every actual
model native row and never rewrites model geometry.

`tests/test_west_kiez_v302.py` independently reopens both official archives and
compares every leaf part, verifies all exact old prisms/full native rows and
exclusive tuples, native cardinal faces, unchanged packet caps and complete
fitting-only retirements. Bun tests validate full compiled buffers, private
completeness, exact source rejection, identical touch geometry, full plan
admission, cancellation, append revocation and every unretired original index.
Root owns shared transaction integration, full decoder and browser/release checks.
