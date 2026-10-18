# Central named sites v230

This bounded addition covers the Wasserturm Prenzlauer Berg, Kollwitzplatz,
Choriner Höfe at Choriner Straße 84, the single block immediately east of
Weinbergsweg, and John-Lennon-Gymnasium. It does not enlarge district coverage or
change source residency budgets. All additions use procedural colour and geometry;
no photograph, font, or texture is bundled.

## Sources and limits

- The [Pankow museum's official water-tower history](https://www.berlin.de/museum-pankow/geschichte-vor-ort/touristisches-wegeleitsystem/dokumente/05-stele-wasserturm-water-tower-.pdf)
  identifies the round main tower, six residential storeys and the older narrow
  standpipe tower. Its published 30 m figure conflicts with the retained main
  LoD2 parent's 40.842 m vertical extent. The complete measured LoD2 sheets govern
  the represented envelope; the conflict is retained explicitly. Neither source
  is silently rewritten. Aperture proportions, twelve radial display bays, brick
  courses and colours remain recognition estimates, not a surveyed facade.
- [Pankow's parks department](https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/ausstellung/artikel.1513005.php)
  identifies the Kollwitzplatz bronze by Gustav Seitz. The small seated silhouette
  uses exact OSM node `603037654`; dimensions and orientation are estimated.
  Eight benches use recorded points. Lawn edges, playground wall `321034937` and
  metal fence `321034938` follow retained OSM geometry. Unrecorded bench direction
  faces into the park and is explicitly estimated. Existing roads and paths stay.
- [Frank Schiffer's project account](https://www.frankschiffer.com/projekte/haus-aus-stein/)
  identifies Choriner Straße 84 as the 2012 *Haus aus Stein*, with street house,
  side wing, courtyard house and stepped upper storeys. This is the specific
  modern building, not a historical tenement proxy. Fine masonry joints reuse the
  existing v185 bay rhythm; coping follows retained level roof edges, including
  the setbacks. No terrace is filled and no second window grid is introduced.
  [Collignon's ensemble account](https://www.collignonarchitektur.com/de/projekte/choriner-hoefe)
  distinguishes the wider Choriner Höfe project from the individual house.
- The east-Weinbergsweg block is bounded by the mapped Weinbergsweg,
  Fehrbelliner Straße, Choriner Straße and Zehdenicker Straße courses. Only 24
  exposed street walls of 20 existing source owners receive thin transoms and
  base courses. The v169 aperture formula is replayed exactly, including clipped
  wall limits, parent ground, and rigid terrain offsets. Measured wall/roof sheets,
  prior paint, windows, party walls and courtyards remain unchanged.
- The [official monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080444)
  and [school's contact page](https://jlgym-berlin.de/jlg/index.php/node/25)
  identify John-Lennon-Gymnasium at Zehdenicker Straße 17. Small brick window-head
  keys and glazing highlights reuse the v205 apertures. The entire original
  `DEBE01YYK000064P` source remains at its existing rigid +6.91 m terrain offset.

The finite retained source subset is `central-named-v230-source.json`, with input
SHA-256 records, original water-tower sheets, exact OSM park geometry, selected
street walls and limitations. Face/member clipping receipts are in
`central-named-v230-evidence.json`. The offline replay scripts are
`build_central_named_v230.py` and `build_central_named_ownership_v230.py`.
The first reads the frozen subset; the ownership audit independently replays the
original retained exporter against the unchanged original packets.

## Exact water-tower ownership

Only `DEBE03YY600002e7` in surrounding chunk `6_-4` transfers. The receipt proves
476 original coloured triangles across drawn/native modes, corresponding ink and
complete navigation records. All other triangles and source rows remain. Changed
packets or changed navigation rows fail open. The replacement contains all 125
original wall/roof sheets, including all four sloped roofs, under one rigid
translation from source ground 24.594 to display ground 3. The native reading uses
234 independently rasterised surface blocks, not a textured or rotated drawn
mesh. The older standpipe tower `DEBE03YY60001rAp` remains an independent retained
owner; only small cornice accents are added there.

Required integration before retiring old owners:

- `createCentralNamedEnvelopesV230(native)` and `createCentralNamedV230(native)`.
- Compose `centralNamedV230Ownership.json.records` / `.lineRecords` into the
  existing exact packet transfer, including parked/restored packets.
- Compose `transferCentralNamedNavigationV230(tile, nav)` from
  `centralNamedPacketNavigationV230.ts` into packet navigation.
- `centralNamedV230RoofAt(x,z,native)`, `centralNamedV230GroundAt(x,z,feet,native)`
  and `centralNamedV230SolidAt(x,y,z,radius,native)` provide new body support and
  collision. No separate terrain extension is needed. Ground queries never lift
  a walker from below to the roof. Native roof support is computed from actual
  independent cell tops. The small native spatial index retains numeric bounds,
  not decoded rendering rows or materials.
- Register weak `sites` fields for `centralNamedV230.json`,
  `centralNamedV230Envelopes.json` and `centralNamedV230Native.json`.

All five accent groups and the one complete shell are independently culled and
frozen. Touch devices receive the same geometry. Drawn/native construction arrays
are consumed synchronously and not retained in scene metadata. No callbacks,
textures, extra lights or animation are introduced. The five runtime JSON files total approximately 468 KiB uncompressed, 66 KiB gzip;
final package measurements remain the release gate. The largest accent family has
4,872 native instances, under 0.4 MiB of instance transforms and colours.

## Suggested visual checks

Coordinates are scene metres, with camera position and look-at target separated.
Use the same poses for drawn and native modes:

| Site | Camera | Look at |
|---|---|---|
| Wasserturm | `[3288,65,-1683]` | `[3236.36,22,-1629.52]` |
| Kollwitzplatz | `[3228,39,-1800]` | `[3158,5,-1860]` |
| Choriner Straße 84 | `[2413,26,-1276]` | `[2348,18,-1294]` |
| East Weinbergsweg block | `[2147,42,-1465]` | `[2238,18,-1404]` |
| John-Lennon-Gymnasium | `[2244,25,-1327]` | `[2261,20,-1282]` |

Focused Python tests verify input hashes, finite block selection, actual face
containment, prior aperture preservation, all original roof/wall triangles and
mapped bench anchors. Bun tests verify exact-sized frozen independently culled
batches, axis-aligned native transforms, roof-facing shading without vertex
changes, actual drawn/native support, no upward teleport, and lossless exact
packet transfer with conservative changed-input guards. Full build and real
browser verification belong to the release integration run.
