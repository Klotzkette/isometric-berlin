# Steppengarten shelter — exact correction v283

The reported tall object next to the Beethoven–Haydn–Mozart memorial is the
**Schutzhütte am Steppengarten**, about 55 metres northeast of the monument.
It is the only retained official building within 150 metres of the monument.
The exact identity is Berlin LoD2 **DEBE00YYT600005H** / original core prism
**T600005H**, beside OSM shelter **node 317399384**. This is a low park shelter,
not another office building or the musicians' monument itself.

## Evidence

- [Arbeitskreis Steppengarten's history](https://www.steppengarten.de/home/geschichte)
  identifies the limestone shelter and its terrace as part of the garden built
  between January and May 1953. This is the current garden stewardship group's
  own account, including its account of surviving inventory.
- [Stiftung Denkmalschutz Berlin, Arbeitskreis Steppengarten](https://www.xn--brger-fr-denkmale-22bg.de/arbeitskreis-steppengarten.html)
  publishes the captioned [shelter photograph, IMG_2518](https://www.xn--brger-fr-denkmale-22bg.de/images/IMG_2518.jpg),
  credited **Kieback/Holst**. It shows a low limestone structure with a dark,
  shallow pitched roof and open gable. The photograph is reference-only;
  no photograph or texture is redistributed.
- [Exact OSM node](https://api.openstreetmap.org/api/0.6/node/317399384)
  is tagged `amenity=shelter`, checked 25 May 2026, at 52.5140681, 13.3710298.
- [Geoportal Berlin LoD2 tile 389_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5819.zip)
  supplies the unchanged four-corner roof plan, original ground 3.496 m in the
  viewer datum, and all **eight original wall/roof sheets**. Its ALKIS function
  `51009_1610` means **Überdachung**, independently inconsistent with an opaque
  office mass. The original height 20.646 m is preserved as conflicting evidence.
- Official DOP 2025 spring and nine bDOM point responses, retrieved 28 October 2026,
  show/read surrounding tree crowns. bDOM values range 39.89–52.20 m NHN and **do
  not establish a roof height**. Full requests, responses and source hashes
  remain in `geo_data/regierungsviertel/steppengarten-shelter-v283-source.json.gz`.

The retained exact plan is approximately 8.49 × 4.72 m, with bounding box 9.62 × 8.28 m
because it is rotated. World datum remains `x=E−389500`, `z=5820000−N`,
`y=NHN−30`; no source X/Z point or ground datum is relocated.

## Correction and its limits

The replacement has limestone long walls and rear wall, separate short front
piers, an open west gable and shallow dark roof. Eave 2.45 m and ridge 3.25 m above
the retained source ground, wall height 2.30 m, masonry thicknesses, block courses
and front divisions are **explicit photographic recognition estimates**. They
are not claimed to be surveyed dimensions. The two source roof plans and ridge
X/Z coordinates remain complete; their vertical shape is remapped into this
small estimated envelope. All original sheets remain separately immutable.

The photographed terrace's curved outer boundary is not metrically established
by these sources. No invented terrace outline replaces existing park surfaces,
paths, stairs, trees or ground. The nearby composer monument remains unchanged.

Drawn rendering uses the complete roof with a 0.16 m underside/fascia and restrained
limestone courses. Minecraft has an independent cardinal model: 0.5 m roof cells,
0.25 m wall cells, quarter-metre stepped roof heights. Both use the same low
site identity and original ground. Navigation follows separate roof slabs and
wall solids; the gable approach and centre remain open below the roof in both
families. There is no invisible twenty-metre collision prism.

The new model is added atomically to required site construction before the old
owner is retired. Drawn full construction, refinement worker, permanent distant
coverage and native construction share an explicit activation flag. Retirement
matches the **complete exact original prism fingerprint**, plus precisely
**three original exclusive 4 m native column tuples**. Missing, altered or duplicate
owners do not retire; new overlapping neighbours protect their native cells.
No source packet is modified, no broad erase rectangle is used, and no coverage,
tour stop, texture, animation or runtime residency allowance is added.

## Validation

- Offline Python generator and original-source/ownership replay: 3 tests passed.
- Actual drawn/native model, native orthogonality, open navigation, fail-closed
  retirement and distant-coverage integration: 4 Bun tests passed, 1,665 assertions.
- Focused Ruff formatting/lint passed. An initial project TypeScript check
  passed; a later repeat was killed by the OS under severe disk/memory pressure
  and is not counted as a final pass. Root integration owns the serial final check.
- No production build or browser was launched by this subtask. Browser visual
  QA and release verification belong to the integrating coordinator.

Reproduction:

```sh
uv run --offline --no-sync python -B -m scripts.build_steppengarten_shelter_v283
```

The runtime JSON is 51,867 bytes. Original immutable evidence, estimated geometry
and exact obsolete-owner receipts are kept distinct. Full drawn detail is equal
on mobile and desktop; the existing source/package limits remain unchanged.
