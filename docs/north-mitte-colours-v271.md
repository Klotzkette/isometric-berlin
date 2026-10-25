# Step 10 — photographed northern-Mitte grey blocks, v271

The supplied phone views show the measured Alt-Mitte v169 building layer around
Weinbergspark, Zionskirchplatz and Arkonaplatz, extending into Kastanienallee.
This layer is distinct from both the core prism palette and the primary outer
`city` packet palette. The v262/v263 ordinary-house paint pass does not affect
its `alt-mitte-v169` mesh kind. The v213 source-surface correction intentionally
retained unknown old facade paint and assigned the same neutral roof fallback.
Consequently, additional v239 window trims did not resolve the repeated paint.

This adapter corrects that finite source layer. Kollwitzplatz lies outside its
source catalogue; its separate primary-packet correction is not counted here.

## Selection and evidence

Three finite display-selection rectangles enclose the requested Weinbergspark,
Zionskirchplatz/Arkonaplatz and Kastanienallee approaches. They are recorded in
`scripts/build_north_mitte_colours_v271.py` and the compressed evidence. They do
not extend city coverage or assert administrative boundaries. A representative
point inside the full measured family footprint selects the complete family;
no house is cut or recoloured on only one side of a selection boundary. Courts
and all footprint rings remain part of the retained source. Source families can
belong to more than one named selection.

The audit considers **1,078 official source families**. The existing v213
protection, inherited hero/glass appearances, v193 Zionskirchplatz treatment,
Choriner Höfe v250 and John-Lennon-Gymnasium v250 remain protected. Two modern
owners are also excluded pending their dedicated facade interpretation:
`DEBE01YYK00002CB` (Kastanienallee 63/64) and `DEBE01YYK0000FDO`
(Weinbergsweg 14). Their architect descriptions distinguish the two street
facades and the care home's individual colour concept; a generic facade recipe
would erase that distinction. Reference URLs are retained in the overall v271
source review.

**1,049 families** are eligible in principle. Actual unambiguous existing
vertices change for **1,043 drawn families** and **427 native families**. The
separate native count is lower because the established two-metre blocks often
overlap adjacent source envelopes. Such ambiguous matches remain unchanged.

Twelve restrained mineral-plaster display tones distinguish unobserved ordinary
wall paint; six separate slate, grey and muted brown tones distinguish roofs.
The assignment is stable per complete official source identity across all
packet seams. These are **contextual display estimates, not surveyed current
colours**. Existing mapped colour/material tags block fallback changes by role,
including unrecognised or compound colour strings. A house with an explicit red
roof can therefore retain that roof while its unknown wall paint changes.
No new window position, historic ornament or roof form is inferred.

## Exact preservation and integration

The compiler reuses v213's true source-plane, full polygon/hole containment,
original colour and centimetre-precision triangle proof. All original incident
triangles must agree before a shared vertex changes, and a rejected corner
keeps the complete connected face network unchanged. Protected and unselected
neighbours remain blockers in the native proof. Their search area follows the
union of the **complete selected family footprints plus 5.7 m**, covering both
2.84-m native-envelope expansions even where a selected family extends beyond
a display-selection rectangle. Outside neighbours remain ineligible for paint.
Native wall and roof roles have
independent eligibility; known roof materials cannot acquire fallback paint
through an eligible wall.

Every receipt is guarded by the exact immutable encoded position, colour and
index fingerprint. The runtime changes only selected existing colour cells,
after v213 and before the later explicit appearance writers. All old packet
bytes, coordinates, indices, source roof sheets, window quads, linework, courts,
ground, road and navigation records stay intact. No geometry, GPU attributes,
buffers, draw calls, texture, resident root or per-frame work is added.

A **15-key eager index** rejects unrelated packets and mesh kinds before any
construction receipt field is accessed. The current receipt remains strongly
held across the existing cooperative validation and write yields. The existing
full mobile detail, independent native geometry, all residency/decode budgets
and 93 tour stops are unchanged.

The resulting existing-buffer corrections are:

| Existing cells / surfaces | Drawn | Native |
| --- | ---: | ---: |
| Colour vertices | 49,205 | 22,800 |
| Wall triangles | 22,394 | 13,463 |
| Roof triangles | 13,033 | 11,135 |

The runtime receipt JSON is **219,898 bytes**, **64,815 gzip bytes**. The
compressed source/protection/packet evidence is **29,499 bytes**. Public packet
files remain byte-identical, including both independent mode families.

## Checks

Six Python tests pass: finite selection/court preservation; every immutable
packet digest and packed range; explicit material and authored-owner priority;
independent native material-role blockers; full-family blocker scope beyond
selection edges; and the two real native boundary regressions in `3_-4` and
`3_-3`. The boundary review removed 43 unsafe native colour assignments while
preserving all drawn assignments and the selected owner counts.
Three Bun tests pass with 81
assertions over all 15 real packet/mode receipts: the exact final colour writes
after v213, unchanged coordinates and original encoded bytes, idempotence,
early unrelated-key rejection without a receipt read, and changed-source
refusal. Scoped Ruff formatting and lint pass. Integration build and visual
review are recorded in the overall v271 release notes.

```sh
uv run --no-sync python -m scripts.build_north_mitte_colours_v271
uv run --no-sync pytest tests/test_north_mitte_colours_v271.py
cd src/app && bun test tests/north-mitte-colours-v271.test.ts
```
