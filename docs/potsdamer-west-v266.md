# Potsdamer West — v266

This bounded Step-10 pass completes the recognisable upper silhouette of the Atrium Tower / former debis headquarters west of Tilla-Durieux-Park. The separate ventilation shaft carries the green square crown. It adds shallow vertical secondary rails to the previously modelled Rogers buildings. All previous geometry and detail remain rendered; no owner is suppressed and the 93-stop tour is unchanged.

## Identity and primary evidence

The [Berlin Senate's 2026 Lenné brief](https://www.berlin.de/sen/uvk/_assets/natur-gruen/stadtgruen/peter-joseph-lenne-preis/2026/lenne-prize-task-a-2026-en.pdf?ts=1776667600) places the Piano Forum Tower, Rogers atrium buildings, Isozaki southern building and western debis/Atrium Tower in their park sequence. The [current operator](https://www.potsdamerplatz.de/de/office-leasing/atriumtower/) identifies Renzo Piano and the double facade. Its exterior photograph and the [architect's project photographs](https://www.rpbw.com/project/postdamer-platz) show the green lattice on the separate slender shaft, alongside the lower office roof. [Kardorff Ingenieure](https://www.kardorff.de/en/projects/atrium-tower-berlin) publishes the ensemble's 106 m height. The shaft footprint is mapped OSM way `591305860`.

The historical PwC reference belongs to the already modelled Forum Tower at Potsdamer Platz 11. PwC's [current office page](https://www.pwc.de/de/standorte/berlin.html) gives Kapelle-Ufer 4. No present tenant branding is inferred or added. The existing Forum Tower's complete source parts and authored detail remain untouched.

## Geometry and preservation

The offline evidence retains eleven complete official LoD2 parts, 185 measured wall/roof sheets, eleven complete delivered prisms, the preceding v214 source evidence, mapped upper footprints and immutable input hashes. Nine upper source-plan parts begin at the existing complex's 60.1 m viewer top. The mapped shaft ring remains rectangular; its 0.0374 m² rounding mismatch with the delivered coarse envelope is explicitly recorded. Other upper footprints are clipped by less than 0.72 m² to that envelope.

The published 106 m shaft height is applied above the existing 5.1 m base. The 85 m office roof and the 3.85 m lower-storey interpretation are **estimates**, since the available complete coarse LoD2 owner does not distinguish these heights. The green crown has a four-by-four square grid on all four sides, silver grid framing, terracotta shaft joints and separate glass office bands with narrow mullions. Small facade dimensions and colours are illustrative estimates from the cited photographs.

A limitation remains visible: the earlier whole-complex coarse 55 m extrusion is preserved, including its over-high lower wings. This additive pass does not claim a complete measured correction of those wings. No roof, lower source sheet, courtyard, prior fitting, collision or ground surface is removed.

The drawn model contains 786 shell vertices and 1,141 fitting instances in two renderables. Full drawn detail is identical on touch devices. The independent native construction uses 13,957 orthogonal instances in one renderable and no smooth-shell duplicate. Its surface columns expand only during construction. Runtime JSON is 147,454 bytes; compressed offline evidence is 38,150 bytes. Geometry/instance buffers are about 116 kB drawn and 1.062 MB native. Texture, loading and world budgets are unchanged.

## Validation and review

Focused Python preservation, ownership and geometry checks: 4 passed. Focused Bun source, touch-parity, allocation and orthogonality checks: 4 passed. Ruff formatting and checks passed. Integrated browser review is performed by the coordinating task.

Review cameras (position → target):

- Tower: `[-111,116,1590]` → `[57,67,1474]`.
- Green crown: `[95,122,1534]` → `[61.35,105.5,1482.81]`.
- Park sequence: `[395,128,1435]` → `[149,39,1290]`.

Generation: `uv run --no-sync python scripts/build_potsdamer_west_v266.py`. Tests: `uv run --no-sync pytest tests/test_potsdamer_west_v266.py -q` and, in `src/app`, `bun test tests/potsdamer-west-v266.test.ts`.
