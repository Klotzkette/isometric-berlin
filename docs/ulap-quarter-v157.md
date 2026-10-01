# Current ULAP quarter buildings (step 10)

`ulapQuarterSource.json` preserves 34 existing display parts across six
identified groups: the police office complex, surviving Urania hall, adjacent
four-storey offices, Alt-Moabit 5, the southern police courtyard buildings and
the existing single-storey Invalidenstraße 59 commercial building. Source
identities, original LoD2 outlines, all previous viewer-prism records, source
height envelopes and the original roof planes remain explicit.

Nineteen parts belonging to the former Landeslabor are kept as excluded source
provenance and receive no new refinement. The supplied October 2026 site audit
records their conflict with the current demolition evidence. This module does
not rebuild demolished buildings or depict the future ULAP planning proposal.

## Source roles

- Berlin LoD2 tiles `388_5820` and `389_5820`, creation date 2 March 2026:
  metric footprints, total heights and native roof sheets. Original roof
  elevations are translated to each existing viewer ground. The 388 tile was
  fetched from `https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5820.zip`;
  raw CityGML remains in the ignored source directory.
- OSM building/site identities and level tags are recorded per group in the
  source JSON. Four levels at the adjacent office wing, three at Alt-Moabit 5
  and one at Invalidenstraße 59 guide their restrained facade rhythms.
- [Landesdenkmalamt 09050426](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050426)
  identifies the surviving 1888–89 Urania hall within the 1963–66 police
  complex. Its historic exterior is not reconstructed: the contemporary
  brick exterior is the representation.
- Bodo Kubrak's [*Invalidenstraße 58 (Berlin-Moabit).jpg*](https://commons.wikimedia.org/wiki/File:Invalidenstra%C3%9Fe_58_(Berlin-Moabit).jpg),
  24 July 2014, CC0 1.0, guides the orange-red curved blind hall, pale/silver
  roof edges and small lower service openings. The per-file credit is included
  in the shared Wikimedia manifests.

No photograph, crop or texture is bundled or fetched at runtime. Individual
bay spacing, window sizes, mortar courses, roof-edge trim and service-opening
positions are display estimates rather than measured facade data. Other office
groups receive restrained surface windows and plinth/eaves without invented
historic ornament, logos or claimed internal room arrangements. Their current
drawn source bodies and palette are retained.

## Geometry and integration

`createUlapQuarter()` adds one compact facade batch. The Urania's upper hall
remains windowless; only its low service frontage receives small openings.
Native `createMinecraftUlapQuarter()` is a separate wall/stepped-roof surface
batch, with no hidden solid infill and no smooth double. Replace the coarse
native building columns only through `isUlapQuarterColumn(x,z)`; it tests the
34 exact source footprints and leaves the open courtyards and park untouched.

The viewer's existing fitted roofs remain the drawn roof owners. Native roofs
use the retained LoD2 sheets and never exceed the corresponding source height.
No landmark catalogue record, terrain, path, water or street is changed.

| Representation | Draw calls | Instances | Geometry and instance bytes |
| --- | ---: | ---: | ---: |
| Drawn | 1 | 4,452 | 339,000 |
| Native Minecraft | 1 | 7,480 | 569,128 |

Touch and pointer produce identical buffers within each style. Diagnostic
detail records are opt-in and discarded during production construction.
Focused tests cover retained parts and current-state exclusions, open courtyard
masking, Urania's blank upper facade, source roof limits, finite buffers, one
batch per style, absent textures and full/mobile equality.
