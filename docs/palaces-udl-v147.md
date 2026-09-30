# Eastern Unter den Linden palaces, Friedrich II and Schloss roofs — v1.0.47

Pipeline step 10. This bounded addition uses the existing OSM identities and
complete official LoD2 sheets. It adds no tour stop, remote image request,
photographic texture, scan, whole-city download or future architectural proposal.
All four drawn modes use the same full static model on desktop and mobile.
Minecraft has one separate native cube batch, including the palace envelopes.

## Metric anchors and retained sources

`build_palaces_udl_source.py` extracts three parents from the already retained
[Berlin LoD2 tile 391_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip)
(source creation 2 March 2026, Geoportal Berlin, dl-de/zero-2-0). The committed
36,697-byte `palacesUdlSource.json` keeps every source wall and roof polygon,
part identity, source hash, and previous display prism unchanged.

| Ensemble | OSM identity | LoD2 parent | Parts | Replaced runtime prism IDs |
|---|---|---|---:|---|
| Kronprinzenpalais | relation/4284350 | DEBE01YYK00007bf | 11 | `-4284350` |
| Prinzessinnenpalais, including elevated link | way/24247322; link way/17728387 | DEBE01YYK00002xT | 5 | `24247322`, `17728387` |
| Kronprinzenpalais entrance portico | relation/4284350 | DEBE01YYK0001yuk | 1 | None; independently retained source part |

Original ground values are 3.265 m, 2.766 m and 4.502 m in the scene's
E389500/N5820000/H30 coordinate frame. A uniform per-building display
translation of +1.935 m for Kronprinzenpalais and its portico, or +2.434 m for
Prinzessinnenpalais, preserves the previously delivered street datum of 5.2 m.
These are explicit display corrections, not new elevation measurements.
The original pitched and flat roof geometry is unchanged. The three old
9 m fallback prisms remain in source records for provenance.

The garden behind Kronprinzenpalais and the open narrow northern court between
its wing and colonnade remain empty. No new ground plate fills either garden.
The head building, mansard wing, elevated bridge, lower rear parts and separate
portico are all present. The source-bound courtyard test samples `[1740,223]`;
the garden sample is `[1722,280]`.

`node/262455591` in retained `osm.gpkg` anchors Friedrich's monument at scene
`[1440.98647896654, 214.18792091310024]`. Its OSM record and source hash are
included independently of the palace geometry. No geographic relocation is
inferred from historic photographs or the monument's earlier Potsdam siting.

The Schloss retains all seventeen original parts, all courts, the source
64.870 m dome top and the existing published 70 m silhouette. This revision
changes its supplemental recognition detail only, in
`SchlossNaturkundeFacades.ts`. Naturkunde geometry is unchanged.

## Architecture and evidence limits

The [Kronprinzenpalais monument record 09095949](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095949)
identifies Strack's upper attic storey, Corinthian order, high entrance altan,
eastern wing/colonnade, and the 1968–70 Paulick reconstruction. Its distinct
three-level, light-stone front receives framed windows, pilasters, capitals,
cornices, rooftop balustrades and four simplified rooftop figures. The source
portico roof is supported by six procedural columns. The north colonnade remains
open with eleven procedural columns. Those counts, bay subdivisions and local
member dimensions are visual display fits, not additional survey dimensions.

The [Prinzessinnenpalais record 09095951](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095951)
distinguishes the long Diterichs mansard wing from Gentz's head building and the
Schinkel-designed connection over Oberwallstraße. The pale elevations receive
two principal window levels, dormers, shallow pilasters, central round windows
and a distinct red-brown roof. The source mansard is preserved beneath the
procedural dormers. No historic café lettering or temporary advertising is
reproduced. The public garden remains the delivered mapped garden and path
network.

The [Friedrich II monument record 09060118](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09060118)
and [Bildhauerei in Berlin inventory](https://bildhauerei-in-berlin.de/bildwerk/reiterstandbild-friedrich-der-grosse-5108/)
identify Christian Daniel Rauch's equestrian monument, granite base, patinated
bronze and cast-iron enclosure. The latter publishes **13.5 m overall** and
identifies Strack's fence/lamp design and four restored lamp standards. The
model keeps a stepped red-grey base, bronze inscription zone, standing-figure
register, four corner horse/rider groups, shallow attic relief cues and the
principal mounted king facing east. Separate legs, a lifted foreleg, neck,
muzzle, ears, tail, reins, riding boots, coat and tricorn give the principal
figure its reading. Local dimensions, anonymous relief silhouettes, lamp
positions and the 8.2/5.3 m socle/horse subdivision are procedural estimates.
No names, inscription artwork or scan is copied.

The [Humboldt Forum 2024 annual report](https://www.humboldtforum.org/wp-content/uploads/2025/09/HF_Jahresbericht_2024.pdf)
(pages 52–53) documents eight **3.30 m** prophets installed on the cupola gallery
in March 2024. The existing licensed 2025 dome photograph supports three
windows per octagonal drum face, pilasters, layered cornices, open balusters,
copper ribs, small round roof openings and the open lantern. The [institution's
lantern account](https://www.humboldtforum.org/de/magazin/artikel/die-sache-mit-dem-kreuz/)
identifies eight supporting angels and the palm-branch canopy. These receive
simple procedural silhouettes beneath the gold cap and cross.

The [30 April 2025 institutional sculpture dossier](https://www.humboldtforum.org/wp-content/uploads/2025/04/20250430_Presseinformation_Balustradenfiguren-2.pdf)
identifies nineteen **new contemporary sculptures**, averaging 3.14 m including
the plinth: four each above portals 1, 2, 4 and 5, plus three western-corner and
Eosanderschulter figures. The [institutional completion programme](https://www.humboldtforum.org/de/programm/termin/fuehrung/balustradenfiguren-ueber-portal-4-und-rekonstruktion-des-portaldurchgangs-5-147362/)
provides the completed-project context. The existing two-figure portal groups
on the north/south fronts now have four silhouettes each, plus the three
western figures. The pre-existing west-portal pair remains. The new works are
not described as recovered historical copies. Model artists identified by the
dossier: Kai Rötger, Andreas Klein and Klaus W. Rieck (portal 1); Schubert
Steinmetz und Bildhauer GmbH and Hartmut Witschel (portal 2); Andreas A. Hoferick
(portal 4); Eckhart Böhm and Ada Kösler (portal 5); Valerie Otte (western group).
The model supplies generic code-built figures, without copying protected
sculpture geometry. Other proposed roof extensions are not represented.

## Openings, ownership and collision

Three source classes require explicit display-only corrections to closed LoD2
lower envelopes:

- Bridge part `DEBE3Dat7eRC0lD2`: only wall triangles below the arch are omitted
  from display. Its exact original roof survives. The local arch is centred at
  `[1686.65,242.36]`, with a 9.3 m display opening and underside at 10.5–14.1 m.
- Colonnade parts `DEBE3DtTJwLxtfvr` and `DEBE3DiqJWtP1g11`: the source roof and
  upper 0.65 m band remain, supported by explicit columns.
- Portico `DEBE01YYK0001yuk`: the same roof/band rule preserves the measured
  projecting roof while opening the approach between the columns.

All original source surfaces remain in JSON. `palacesUdlPartBaseAt` drives the
rendered opening, native wall bases and `palacesUdlWalkableAt` point-clear
contract. The viewer must sample the walking capsule as it does other authored
interiors. `palacesUdlSupportSolidAt` protects the actual columns. Every other
source part remains solid from the delivered base to its actual roof plane.

`friedrichMonumentSolidAt` uses the oriented core, four narrow fence sides and
four lamp bases. The surroundings are not a radial building obstacle. The
fence's outer envelope has **5.660 m** measured clearance from the delivered
road polygons; the four lamps are separately bounded inside the same median.
The native batch owns both the complete surface-only palace envelope and its
block-form sculpture. `isPalacesUdlReplacementColumn` removes only source and
old exact footprint columns, never a broad rectangular area around the gardens.

Integration contract:

1. Add `createPalacesAndFriedrich()` as a lazy drawn root and
   `createMinecraftPalacesAndFriedrich()` as its separate native root.
2. Include `PALACES_UDL_PRISM_IDS` in generic shell/facade exclusion. Keep all
   seventeen official parts eligible in the collision replacement loop,
   including the independent portico that has no old prism ID.
3. Use `palacesUdlPartRoofAt`, `palacesUdlPartBaseAt` and
   `palacesUdlWalkableAt(x,y,z,sourceId?)`; preserve granular column collision.
4. Filter `node/262455591` from the generic monument pass in both modes.
   Use the dedicated solid predicate for its ground-level collision.
5. Register both names from `palacesUdlProfile.ts` with the normal mode system.
   The old Schloss root already calls the refined model.

## Inspected external photo references

Each file was inspected at 1,000-pixel thumbnail width through Wikimedia's
imageinfo endpoint. Files were stored only under `/tmp/palaces-v147`; none is
bundled or fetched at runtime. New records are supplied merge-ready in
`/tmp/palaces-v147-references.json`, for both attribution inventories.

| File | Author | Licence | Observed role |
|---|---|---|---|
| [Kronprinzenpalais (Berlin), 2024 (01).jpg](https://commons.wikimedia.org/wiki/File:Kronprinzenpalais_(Berlin),_2024_(01).jpg) | Bahnfrend | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | North front, upper balustrade, altan, open colonnade and figures |
| [Berlin, Mitte, Unter den Linden, Prinzessinnenpalais 01.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden,_Prinzessinnenpalais_01.jpg) | Jörg Zägel | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Long mansard wing, central round windows, dormers; historic café use is not copied |
| [Berlin, Mitte, Unter den Linden, Prinzessinnenpalais 04.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden,_Prinzessinnenpalais_04.jpg) | Beek100 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Distinct three-bay head building and lower garden wing |
| [2023 Reiterstandbild Friedrich der Große (1).jpg](https://commons.wikimedia.org/wiki/File:2023_Reiterstandbild_Friedrich_der_Gro%C3%9Fe_(1).jpg) | Bärwinkel,Klaus | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Monument side, materials, fence and main/corner mounted figures |
| [2023 Reiterstandbild Friedrich der Große (2).jpg](https://commons.wikimedia.org/wiki/File:2023_Reiterstandbild_Friedrich_der_Gro%C3%9Fe_(2).jpg) | Bärwinkel,Klaus | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Front quarter, lifted foreleg, tricorn, open lower figure register |
| [2023 Reiterstandbild Friedrich der Große (3).jpg](https://commons.wikimedia.org/wiki/File:2023_Reiterstandbild_Friedrich_der_Gro%C3%9Fe_(3).jpg) | Bärwinkel,Klaus | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Rear/avenue orientation, fence and street separation |
| [The Dome Of Berlin Palace.jpg](https://commons.wikimedia.org/wiki/File:The_Dome_Of_Berlin_Palace.jpg) | AusleseBeeren | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Existing v1.0.37 credit reused; 8 March 2025 dome, prophets, drum and lantern |

The Commons `Artist` metadata, rather than filename inference, determines the
04.jpg credit to **Beek100**. The 2009 princess-palace views supply architectural
form only; present-day tenant identity is not inferred from them. A.Savin's FAL
photos were not used because the repository's permitted photo list is narrower.

## Bounded budgets and focused validation

Counts include attribute/index buffers and all instance transforms/colours.
There is no frame update, LOD-driven detail loss or phone-specific drawn model.

| Layer | Draws | Instances | Buffer bytes |
|---|---:|---:|---:|
| Palais source sheets + facade + Friedrich | 6 | 2,277 | 241,476 |
| Native palais surfaces + facade + Friedrich | 1 | 5,360 | 408,008 |
| Schloss + unchanged Naturkunde detail | 5 | 4,059 | 326,940 |
| Native Schloss + unchanged Naturkunde detail | 1 | 2,757 | 210,180 |

The Schloss source-sheet and native-envelope budgets are unchanged from
v1.0.37. The additional roof details explicitly raise the prior facade-only
ceilings to 340,000 bytes drawn and 220,000 bytes native; no old details were
removed to meet the new limits.

Validation completed:

- Two focused Python tests: exact re-extraction equality, retained previous
  prisms, all seventeen part envelopes/roof sheets, exact monument anchor and
  approved-bounds containment. Focused Ruff format/check passes.
- Ten frontend tests across `palaces-udl.test.ts` and the existing
  `schloss-naturkunde.test.ts`: courtyard/garden samples, source IDs, static
  image-free batches, native cube prototypes, bridge raycasts in both modes,
  passage and column point-clear contracts, monument anchor/height/street
  approaches, dome/lantern silhouette and bounded allocations.
- TypeScript `tsc --noEmit -p tsconfig.json` passes after concurrent modules
  completed their type corrections. Integrated scene/browser QA belongs to
  the release review, not the source-photo inspection above.
