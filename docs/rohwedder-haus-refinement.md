# Detlev-Rohwedder-Haus architecture evidence (v1.0.7, step 10)

The ministry now uses a complete source-bound campus facade layer rather than
the former 184 m generic slab at the navigation point. The original building
payload remains unchanged. All coordinates below use the viewer's EPSG:25833
origin `(389500, 5820000, 30)`; committed outline coordinates are decimetres.

## Metric and identity contract

`rohwedderHausPrisms.json` copies 21 records from the committed LoD2 payload:

- Four main parts of `DEBE01YYK00000sk`: `BpVfJNGl`, `b2fhmrSW`,
  `H1fcpzly`, `nU6RPfQE`. Their original top elevations are 39.0, 38.3,
  31.5 and 24.9 m in the viewer frame.
- Five northwest parts of `DEBE01YYK000052O`, retaining the original
  `Bundesrechnungshof` source name rather than asserting a current tenant.
- Three southern parts of `DEBE01YYK00007sI`.
- Two low service parts of `DEBE01YYK0000580`.
- `K00002QC`, `K0000FSo`, `K00006PB`, `K000042J`, `K0000D45`, `K00005uY`.
- `K0001yJa`, the measured 31.1 m central Ehrenhof risalit, whose actual east
  face carries the nine tall hall windows. Adding panes to the main wing
  behind this source part would hide every tall pane.

The record also retains five exact neighbouring LoD2 records solely as
occluders for the cold Minecraft facade factory; it never draws those twice.
Source footprints, heights, roof codes and open courtyard complements stay
unchanged. Three source roof types use the existing generic roof fitter; a
regression compares frozen facade-top values with that same runtime fitter.

Identity and campus enclosure come from [OSM relation 280070](https://www.openstreetmap.org/relation/280070),
retrieved 2026-09-08. Its outer way is `217520114`; four courtyard inner ways
are `41953736`, `41953732`, `41953731` and `41953735`. The exact iron-screen
axis is [way 134681699](https://www.openstreetmap.org/way/134681699), with
three retained vertices: `[863.879,1121.308]`, `[865.047,1125.240]`,
`[877.259,1166.351]`. Its local 4.8 m height and bar spacing are photographed
display estimates. Collision follows the same line between viewer Y=5 and 9.8.

## Primary facts and explicit source conflicts

The [Landesdenkmalamt record 09095987](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095987)
documents Ernst Sagebiel's 1935–36 ministry, shell-limestone cladding, small
upright windows, the Leipziger Straße pier vestibule and the gated Wilhelmstraße
Ehrenhof. It also records the removal of historical sculptural emblems. The
model shows the present building and does not recreate removed symbols.

The [BMF building history](https://www.bundesfinanzministerium.de/Web/DE/Ministerium/Geschichte/geschichte.html)
supports the five-to-seven-storey wing complex and retention of natural-stone
facades. The [1996 Bundestag account](https://dserver.bundestag.de/btd/13/065/1306594.pdf)
places building 1A within the Detlev-Rohwedder-Haus context. This supports the
northwest campus interpretation without claiming its current room allocation.

Conflicts are retained explicitly:

1. OSM tags the facade `marble`; the LDA names shell limestone. Display colours
   and wall-joint vocabulary follow the LDA and photographs; the OSM tag is
   not silently recategorised as measured material evidence.
2. The OSM inner courtyard omits the protruding `K0001yJa` risalit. Its measured
   LoD2 envelope remains authoritative for both visible body and pane placement.
3. The northwest LoD2 parent has a legacy Bundesrechnungshof name. All five
   parts remain as original records and receive the photographed campus
   limestone treatment; the viewer does not rename their source records.
4. The coarse voxel payload can round a roof upward and uses ground samples
   differing by a few decimetres from individual source bases. Only qualifying
   source-centred columns are capped to the exact LoD2 maximum; the 0.6 m
   tolerance accommodates that ground difference. Taller unrelated columns
   remain unchanged. Without this check some 39 m roof lanterns were hidden
   by retained columns reaching 41.1 m.

No facade-opening survey exists in the repository. Bay rhythm, row heights,
stone joints, shallow reveals, eight/six-pane frame cues, console proportions,
lantern spacing, grilles and current ministry lettering are procedural display
estimates. The low vestibules use shallow shadow recesses over retained source
bodies; this change does not add a traversable government-building interior.
No mural artwork, photographic reference or texture is bundled or loaded.

## Actually viewed free photographic references

Per-file API metadata was saved in the ignored raw folder; the seven files
below were actually inspected. Source photographs stay external.

| File | Creator | Licence | Use |
|---|---|---|---|
| [Berlin, Mitte, Wilhelmstraße, Detlev-Rohwedder-Haus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Wilhelmstraße,_Detlev-Rohwedder-Haus.jpg) | Jörg Zägel | CC BY-SA 3.0 | Stone plates, upright windows, corner piers |
| [Berlin-Detlev-Rohwedder-Haus-Bundesfinanzministerium-02-2023-gje X.jpg](https://commons.wikimedia.org/wiki/File:Berlin-Detlev-Rohwedder-Haus-Bundesfinanzministerium-02-2023-gje_X.jpg) | Gerd Eichmann | CC BY 4.0 | 2023 Leipziger Straße arcade and representative window order |
| [Detlev-Rohwedder-Haus Luftaufnahme.jpg](https://commons.wikimedia.org/wiki/File:Detlev-Rohwedder-Haus_Luftaufnahme.jpg) | Gavailer | CC BY-SA 4.0 | 2016 source-wing/courtyard and roof-lantern vocabulary |
| [Detlev-Rohwedder-Haus exterior 2.JPG](https://commons.wikimedia.org/wiki/File:Detlev-Rohwedder-Haus_exterior_2.JPG) | BrokenSphere | CC BY-SA 3.0 | Frame cross-bars, console sills and hood profiles |
| [Rohwedder-Haus Fenstergitter 2013-08-29 ama fec (2).JPG](https://commons.wikimedia.org/wiki/File:Rohwedder-Haus_Fenstergitter_2013-08-29_ama_fec_(2).JPG) | Monika Angela Arnold (=44penguins) | CC BY-SA 2.5 | Iron window grilles |
| [Federal Ministry of Finance.jpg](https://commons.wikimedia.org/wiki/File:Federal_Ministry_of_Finance.jpg) | Magnus Manske | CC BY-SA 3.0 | Nine tall Ehrenhof hall fields, upper row, balcony, entrance screen |
| [Panoramafoto Reichsluftfahrtministerium 2017.jpg](https://commons.wikimedia.org/wiki/File:Panoramafoto_Reichsluftfahrtministerium_2017.jpg) | Maddriver371 | CC BY-SA 4.0 | Ehrenhof/front-wing relationship and current fence |

The fetched A.Savin FAL image and the ambiguously attributed PD courtyard image
were neither viewed nor used. They do not support any model decision.

## Geometry and QA

One instanced cube batch per profile, no UVs and no runtime image assets:

| Profile | Instances | Rendered instance vertices | Stored geometry + instance bytes |
|---|---:|---:|---:|
| Drawn full | 29,272 | 702,528 | 2,225,320 |
| Drawn mobile | 11,944 | 286,656 | 908,392 |
| Minecraft full | 16,105 | 386,520 | 1,224,628 |
| Minecraft mobile | 11,307 | 271,368 | 859,980 |

These figures cover the new detail layer, excluding unchanged source bodies.
Mobile retains all 21 parts, the nine main hall fields, upper office row,
47 roof lights, 32 monumental glazing fields and complete entrance fence.
It reduces cladding joints, cross-bars and fence microdetail. Minecraft uses
stepped roof lights, block windows and pixel letters with no rotated sloping
detail planes. The retained oblique source walls still determine plan rotation.

`src/app/tests/rohwedder-haus-architecture.test.ts` checks exact source equality,
source-fitter roof agreement, all four bounded texture-free profiles, court
complements, fence collision and cold-load occluder parity. Raycasters hit the
actual first-facing triangles of all 32 monumental glazing fields against
retained drawn walls and coarse Minecraft cubes; all 47 block roof lights also
pass downward visibility rays with those cubes present. Orthographic software
QA renders export the real Three.js triangles and instance matrices with face
culling; east, north, Ehrenhof and Minecraft views were inspected. This is
geometry QA, not a substitute claim for an interactive browser/device test.
