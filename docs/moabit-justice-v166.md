# Moabit justice buildings and Lesser-Ury-Weg (v1.0.66)

Step 10 replaces the low Kriminalgericht/JVA fallback envelopes with complete
Berlin LoD2 surfaces and adds exterior recognition detail to twelve residential
buildings beside Lesser-Ury-Weg. This is the **current JVA Moabit**, not JVA
Tegel and not the former Lehrter Straße prison memorial park. Existing ULAP,
Geschichtspark, officers' houses, roads, trees and paths keep their ownership.

## Measured source and ownership

The cached official [LoD2 tile 388_5820](https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5820.zip)
uses dl-de/zero-2-0. The generator extracts 48 complete parents, 139 leaf parts
and all 2,363 original wall/roof sheets. The original rings, holes, elevations
and archive SHA-256 remain in `moabitJusticeV166Evidence.json`. Each complete
parent receives only a rigid vertical translation to the established 5.2 m
viewer ground; no source footprint or roof is simplified.

| Ensemble | Parents | Parts | Identity |
|---|---:|---:|---|
| Kriminalgericht Moabit | 1 | 15 | LoD2 `DEBE01YYK0002Nu1`; [OSM relation 7721745](https://www.openstreetmap.org/relation/7721745) |
| JVA Moabit buildings | 35 | 105 | [OSM site way 172318650](https://www.openstreetmap.org/way/172318650); main star `DEBE01YYK0002Sgs` |
| Lesser-Ury-Weg residential buildings | 12 | 19 | Within 48 m of [way 4410152](https://www.openstreetmap.org/way/4410152) / [way 1097924830](https://www.openstreetmap.org/way/1097924830), using complete selected parents |

The source court footprint retains four large courtyards and nine smaller
source light wells. Its translated dome/tower tops are 51.299, 61.634 and
63.064 m in viewer coordinates. The previous OSM court prism `-7721745` had
only a 9 m estimated height. Original source records are preserved beside the
correction. Official current roof geometry takes precedence over approximate
historical descriptive heights: [LDA 09050355](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050355)
describes the approximately 210 m front, two 60 m towers and 48 m corner dome.
Those rounded published heights are not used to distort the LoD2 source.

Exactly 45 current viewer prism identities are replaced. Their complete prior
records and measured overlap ratios are archived in the evidence; all exceed
90% coverage by the selected source footprints. Most exceed 98%; the remaining
alignment differences are retained as explicit OSM/LoD2 source differences.
The runtime predicate also checks the original base and voxelized height when
identifying old native columns. It does not suppress a whole district rectangle.
Existing ULAP parents `DEBE01YYK0002LQf`, `DEBE01YYK0002Q0J` and
`DEBE01YYK0002MoE` are explicitly excluded from the new owner.

## Exterior interpretation and references

[LDA 09050319](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050319)
describes the JVA's yellow/red brickwork, narrow segment-headed windows,
projecting brick divisions and central domed hall. The
[official JVA history](https://www.berlin.de/justizvollzug/anstalten/jva-moabit/die-anstalt/historie/)
distinguishes the existing 1877–1881 complex from the earlier, demolished
Lehrter Straße prison. Only exterior recognition geometry is authored.

The following freely licensed photographs were inspected at 960 px. They remain
external references: no photograph, crop or photographic texture is bundled.

| Reference | Author / licence | Used observations |
|---|---|---|
| [Moabit Alt-Moabit Untersuchungshaftanstalt-1.jpg](https://commons.wikimedia.org/wiki/File:Moabit_Alt-Moabit_Untersuchungshaftanstalt-1.jpg) | Fridolin freudenfett (Peter Kuley), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Ochre brick fronts, repeated narrow dark windows, visible pale metal bars, light lintels/sills and roof-edge banding |
| [MoabitTurmstraße Kriminalgericht-1.jpg](https://commons.wikimedia.org/wiki/File:MoabitTurmstra%C3%9Fe_Kriminalgericht-1.jpg) | Fridolin freudenfett (Peter Kuley), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Pale stone facade, tall divided windows, projecting surrounds and cornices, corner dome and dark pitched roof |
| [Lesser-Ury-Weg.jpg](https://commons.wikimedia.org/wiki/File:Lesser-Ury-Weg.jpg) | Shisma, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Beige residential walls and white window frames; tree-covered view limits claims about other facade details |

Window spacing, surrounds, cornice thickness, bar diameter/spacing and material
swatches are procedural display estimates. Every drawn member is clipped inside
its measured source wall polygon. Barred windows occur only on the six selected
historic prison parents; garages, utility structures and nearby housing do not
receive the prison grille template. No interior or vanished historical building
has been invented. Fine sculpture/dormer details not resolved by the inspected
reference or source are not claimed as a survey.

## Runtime and native representation

Drawn pointer and touch profiles use identical static geometry in all four
drawn modes. The measured source triangle batch and compact facade batch total
two draw calls, 48,611 facade instances and **4,383,584 GPU buffer bytes**.
Stored vertices total 19,149, including the single instanced cube geometry.
Day/night materials are texture-free and transforms are frozen.

Minecraft independently samples the source wall/roof surface skin at one-metre
cells. It retains 136,491 occupied cells with no hidden solid fill; exact
adjacent cells of the same colour compact to 18,072 orthogonal runs. Windows
recolour existing surface cells. A second independent orthogonal block template
places three vertical bars and two stepped cross-bars at each of 3,200 authored
window positions. The final native profile has **53,272 instances**, two draw
calls and **4,049,968 GPU buffer bytes**. No smooth drawn facade appears beneath
it. Compact per-window anchors avoid storing 96,000 repeated short bar blocks.
The runtime source JSON remains below 5 MiB.

Navigation uses source footprint holes and exact measured roof triangles;
Minecraft queries its own surface columns. The four main courtyards remain
unoccupied in both representations. Source and native data stay separate from
the larger, non-runtime provenance file.

## Reproduction and validation

```sh
uv run python scripts/build_moabit_justice_v166.py
uv run ruff check scripts/build_moabit_justice_v166.py tests/test_moabit_justice_v166.py
uv run pytest tests/test_moabit_justice_v166.py -q
bun test src/app/tests/moabit-justice-v166.test.ts
```

The focused Python checks pass (4); the focused Bun checks pass (3). They verify
exact part/surface preservation, rigid source translation, courtyard holes,
retained tall roof envelopes, exact legacy identities, lossless native cell
compaction, zero native rotation, complete source triangle submission and GPU
budgets. No whole-app build, browser run or full native-world test was performed
by this bounded module task; the release integrator handles those shared checks.
