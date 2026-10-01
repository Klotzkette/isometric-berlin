# Bounded Mitte street refinement

Pipeline step 10 retains 150 mapped OSM ways along Mulackstraße, Alte
Schönhauser Straße, Linienstraße, Auguststraße, Ackerstraße, Tucholskystraße,
Krausnickstraße and Oranienburger Straße. The explicit task rectangle
13.383–13.417° E / 52.5195–52.5373° N clips the road selection inside the
approved project polygon. In particular, Ackerstraße ends at the cemetery
area; this is not an unrestricted extension along similarly named streets.

`mitte-streets-v166.json` retains 437 complete official parent families with
1,029 original parts, including all wall, roof and ground sheets and open
courts. Archive URLs and hashes accompany them. Source XYZ positions keep
millimetre precision and only the established family translation to the
outer `y=3` plane. An additional 540 existing core prism records are retained
verbatim; these receive thin front details without replacing their geometry.

The street layer excludes 7,417 authored and suppressed identities: the
runtime `PRISM_SUPPRESSED_IDS`, recursively retained source identifiers,
published manifest owners, and **every source owner already carrying a
partId in prior packet navigation**. This includes the complete new
Alexander-north module, reserved Mitte heritage/cemetery buildings and the
existing Rosenthaler families `DEBE01YYK00000lz` / `DEBE01YYK000033r`.
Generic street decoration must not cover or replace these authored models.

Procedural shopfronts, windows, frames, sills and cornices fit wholly inside
existing street-facing wall surfaces. Source streets and existing asphalt
boundaries position the pavement/curb supplements, with intersections,
footprints and water cut out. Dimensions of untagged sidewalks, fine facade
subdivisions and the neutral material palette are explicitly display
estimates. No photographic source or sampled color is used for this pass.

Drawn modes retain complete exact source roofs and all bounded detail on
touch and pointer devices. Minecraft uses a separate orthogonal surface-cell
reading, with no hidden solid interiors. Native navigation keeps conservative
cell-top envelopes; exact metric heights remain in the source records.

Reproduce with:

```sh
uv run python scripts/build_mitte_streets_v166.py --out /tmp/v166-mitte-streets
```

`--refresh-source` repeats the bounded source selection and current ownership
audit. The generator writes 15 isolated candidate chunk pairs, one new
`mitte-street-fronts-v166` mesh per affected mode/chunk, and a descriptor patch.
It never writes the published packets or shared manifest. Every previous
mesh remains byte-for-byte unchanged in those candidates. Candidate navigation
replaces only the listed newly owned coarse parents with their complete leaf
parts, keeping all unrelated navigation byte-for-byte identical.

Before publication, the centralized v166 source-ownership operation must
remove only the former coarse triangles of these 437 parents and then merge
the new mesh and refined navigation. The original coarse source remains in
the canonical evidence cache. Copying a whole candidate packet directly to
publication would retain a duplicate coarse mass and is not the intended
integration operation.

`mitte-streets-v166-audit.json` records every affected packet's added and
retained triangle counts, compressed/decoded bytes, street-surface metrics
and source hash. The largest candidate stays below the established 12 MiB
decoded ceiling. `mitte-streets-v166-preservation.json` records prior mesh and
unowned-navigation hashes. Tests compare the exact source prisms, verify
selection bounds and ownership exclusion, and inspect all candidate native
triangles for orthogonality while checking earlier packet preservation.
