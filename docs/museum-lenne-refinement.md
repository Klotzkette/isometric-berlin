# Musikinstrumenten-Museum and Lennéstraße architecture

The museum portion is superseded by the [v1.0.11 correction](music-museum-correction-v111.md),
which fixes the absolute elevation, complete roof and separate public entrance.
The Lenné buildings below remain unchanged.

Step 10, v1.0.5. The museum/SIM and the five separate towers at Lennéstraße
3, 5, 7, 9 and 11 receive source-bound recognition details. These are context
buildings; the tour inventory does not change.

## Identity and source geometry

The museum remains OSM way `22990151`, Berlin LoD2 parent
`DEBE01YYK0002Kgr`. All fourteen delivered source parts are retained.
The [museum's institutional history](https://www.simpk.de/museum/sammlung/geschichte.html)
establishes the 1984 building by Edgar Wisniewski after Hans Scharoun's plans.

The law firm named by the owner is
[CMS Hasche Sigle, Lennéstraße 7](https://cms.law/de/deu/office/berlin).
The five towers are distinct from the Sony Center and Beisheim/Parkside facades.
Bounded OSM address nodes, the CMS POI and exact LoD2 parts establish the mapping:

| Address | Address node | OSM building | LoD2 parent | Parts |
|---|---|---|---|---:|
| Lennéstraße 11 | `884695165` | `13760716` | `DEBE01YYK0002KkP` | 5 |
| Lennéstraße 9 | `884695062` | `13760719` | `DEBE01YYK0002O4m` | 8 |
| Lennéstraße 7 / CMS | `884694986` | `13760721` | `DEBE01YYK0002N8w` | 2 |
| Lennéstraße 5 | `884694916` | `13760720` | `DEBE01YYK0002SCQ` | 5 |
| Lennéstraße 3 | `884694818` | `26741679` | `DEBE01YYK0002TDz` | 2 |

CMS POI `9706958017` lies inside the number 7 tower. Address nodes were checked
against a bounded OSM API map extract on 8 September 2026. Only these factual
identities and the 36 exact selected prism records are committed; raw API data
and photographs remain outside the repository.

The compact `museumLennePrisms.json` copies the delivered decimetre records
without modifying coordinates, heights, roof codes or parts. Full/mobile and
cold Minecraft construction use the same source subset. Tests compare all
records with the shipped LoD2 payload.

## Specific architectural reading

The museum receives staggered narrow gray panel courses, the triangular gold
relief field, two oval upper openings with grilles, small slit windows,
grouped institute glazing with external louvres, the low entrance glazing and
wide flat entrance canopy. Eight rooflight teeth occupy the upper 2.4 m of
the main hall's existing 15.1 m source envelope. Its wall/cap height becomes
17.0 m in viewer coordinates; all eight crests remain at the delivered 19.4 m
top. The source record itself remains unchanged. Roof support follows the
actual valley, slope or Minecraft stair height instead of a flat maximum.
Panel courses and facade trim on the four small pitched source parts stop at
the existing renderer's derived eaves, leaving those roof slopes exposed.

The [architect's number 3 account](https://www.collignonarchitektur.com/de/projekte/lennestrasse-3)
describes continuous floor-height glazing and exposed horizontal bands, with
vertical structure behind the facade. Number 3 accordingly has the lightest
exterior grid. The [number 5 account](https://www.collignonarchitektur.com/de/projekte/lennestrasse-5)
describes silver metal, large north glazing and piers tapering upward. These
piers are explicitly modelled. Both primary records state ten storeys.

Number 7 receives pale stone wall fields, floor-height dark openings, fine
paired mullions and glazing guards. The original
[Viterra development handover notice](https://www.openpr.de/news/7630/Viterra-Development-uebergibt-Bueroprojekt-Lennstrasse-an-BVK.html)
documents its ten-storey natural-stone facade. Number 9 keeps projecting bay
sills; number 11 keeps its separate pale frame and source setbacks. All five
retain their source roof/part hierarchy and remain separated by open gaps.

The two dated street photographs guide facade vocabulary and material contrasts,
not current occupants or measured bay counts. Equal floor/window subdivisions,
panel sizes, grille spacing, relief tessellation, canopy projection and rooflight
depths are procedural display estimates. No poster artwork, instrument photograph,
logo texture or promotional banner is reproduced.

## Recorded source differences

- LoD2 calls the number 5 ensemble “Botschaft Botsuana.” That original source
  name is retained in its source data; it is not taken as evidence of a current
  embassy occupancy. The exact OSM address and architect's completed-building
  record establish the present architectural identity.
- OSM tags number 3 as apartments, whereas the architect identifies the
  completed building as an office building. This detail pass makes no current
  occupancy claim and does not change either source record.
- Number 9's OSM building records nine levels, while the current
  [BNP Paribas property account](https://www.bnppre.de/gewerbeimmobilien/berlin/buero-mieten/B13790/)
  explicitly describes ten storeys. The visible facade uses ten subdivisions
  within the unchanged LoD2 height. Number 11 retains the mapped nine-level
  reading; no independent facade survey is claimed.
- The main museum's flat LoD2 roof code omits its visible rooflight teeth.
  The new surface divides the existing height envelope rather than raising
  the building or silently replacing the source record. Other museum roof
  codes and parts remain unchanged.

## Visual references and limits

Actually inspected Commons files, all reference-only and packaged as attribution:

- Andreas Praefcke, [Berlin Musikinstrumentenmuseum 01.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Musikinstrumentenmuseum_01.jpg),
  CC BY 3.0, April 2009: entrance, gray panels, gold relief and rooflights.
- Magnus Manske, [State Institute for Music Research.jpg](https://commons.wikimedia.org/wiki/File:State_Institute_for_Music_Research.jpg),
  CC BY-SA 3.0, uploaded 2017: grouped glazing, louvres and metal frame.
- Manfred Brückels, [Berlin Tiergartenrand Lennéstr.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Tiergartenrand_Lenn%C3%A9str.jpg),
  CC BY-SA 3.0, circa 2008: pale stone window fields and guards.
- Fridolin freudenfett / Peter Kuley, [TiergartenLennestraße.jpg](https://commons.wikimedia.org/wiki/File:TiergartenLennestra%C3%9Fe.jpg),
  CC BY-SA 3.0, 25 April 2011: the distinct five-tower sequence.

No photograph, crop, texture or traced facade artwork is bundled or requested at
runtime. Smooth details share the existing isometric parent's Day, Night,
Snowstorm and Schwellenraum presentation. Minecraft receives its own block
batch; only the coarse main exhibition-hall columns are replaced. Facade
details on every other retained voxel part sample the actual exposed cell skin
so they do not disappear inside the coarse source cubes.

Two renderables cover the complete drawn ensemble; Minecraft uses one batch.
Full/mobile bounds are 890/430 KB for drawn geometry and 490 KB for Minecraft,
including instance matrices and colors. Automated checks cover source identity,
outward facade orientation, finite geometry, all five separated tower gaps,
the canopy approach, source maximum roof height and actual mesh raycasts for
roof support and exposed drawn/Minecraft glazing. Offline views use the actual
Three.js triangles and instance matrices; they are not browser screenshots.
