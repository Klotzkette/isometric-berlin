# Southern ordinary-house clusters — v320

This Step 10 part of the fifty-cluster pass contains sixteen distinct local
groups and exactly four retained source owners per group. Twelve groups lie
inside the Ringbahn and four outside. The full selection is in
[`cluster-facades-v320-south-profile.json`](../geo_data/regierungsviertel/cluster-facades-v320-south-profile.json).

| Local group | Actual selected front streets | Source treatment |
| --- | --- | --- |
| Bergmannkiez west | Bergmannstraße | Four exact v188 generic grids replaced |
| Chamissoplatz | Willibald-Alexis-Straße | Four exact v188 generic grids replaced |
| Graefekiez | Dieffenbachstraße | Four exact v188 generic grids replaced |
| Reichenberger/Lausitzer group | Reichenberger Straße | Four exact v188 generic grids replaced |
| Wrangelkiez | Wrangelstraße | Four exact v188 generic grids replaced |
| Schillerkiez | Herrfurthstraße | Four previously untreated ordinary source fronts |
| Reuterkiez | Lenaustraße by Hobrechtstraße | Four previously untreated ordinary source fronts |
| Flughafenstraße | Flughafenstraße | Four previously untreated ordinary source fronts |
| Donaukiez | Donaustraße | Four previously untreated ordinary source fronts |
| Emser/Sonnenallee group | Emserstraße and Siegfriedstraße | Four previously untreated ordinary source fronts |
| Akazienkiez | Belziger Straße | Four exact v188 generic grids replaced |
| Cranach/Becker group | Peter-Vischer-Straße and Beckerstraße | Four previously untreated ordinary source fronts |
| Steglitz | Albrechtstraße | Four previously untreated ordinary source fronts |
| Alt-Treptow | Plesser Straße by Elsenstraße | Four previously untreated ordinary source fronts |
| Adlershof | Dörpfeldstraße | Four exact v230 generic grids replaced |
| Köpenick old-town group | Freiheit and Laurenzstraße | Four exact v230 generic grids replaced |

These are local street groups rather than administrative district boundaries.
For example, the Cranach/Becker group retains the actual source positions near
Friedenau without changing the Schöneberg boundary. Buildings without a safe
native front were replaced in the selection by other positively admitted local
owners; none of the sixteen claimed groups is empty.

## Source admission and preservation

The twenty-four v188 and eight v230 owners reuse their complete immutable
front receipts. Every original generic fitting triangle, including its colour
words and multiplicity, is replayed before its precise replacement is admitted.
The original bodies, roof sheets, courtyard holes, navigation and linework are
retained. The newer Wrangel owner `DEBE02YY400002Nz` is excluded because its
dedicated v301 treatment already exists.

The other thirty-two fronts require complete existing generic drawn wall
triangles and independently constructed cardinal native wall coverage. Every
span must also lie on an edge of the selected source owner's navigation ring
with its exact original vertical datum. Native spans shorter than 3.2 m are
not used in this regional selection. Mapped doors remain separate and the
common compiler cuts their apertures out of new paint and fitting cells.

Positive ordinary-use evidence comes from the retained
`raw/outskirts-v187/candidate.gpkg` OSM source. Each selected original polygon
records apartments or residential use, has no named/nonresidential tag and no
explicit wall-paint/material tag. Its overlap with the complete retained body
footprint is at least 0.72. Protected mapped footprints, earlier generic fitting
owners and the common compiler's dedicated-owner veto are checked separately.

The small frozen
[`cluster-facades-v320-south-ordinary-evidence.json.gz`](../geo_data/regierungsviertel/cluster-facades-v320-south-ordinary-evidence.json.gz)
retains all thirty-two positive OSM records with complete polygons and tags,
their original body records, source packet hashes and the raw-source hash.
It is evidence, not a runtime city packet. Independently checking all sixty-four
selected identities also found no intersection with the explicit mapped material
owner receipts of v232, v254 or v263. Their recorded paint therefore retains its
priority elsewhere.

## Architectural context and limits

Every group has its own opening proportions, frame/reveal/sill dimensions,
transom proportion, base course and restrained material family. These dimensions
and unknown paint tones are contextual display estimates. No individual window
survey, new entrance, shop tenant, balcony or roof shape is inferred. Existing
estimated body heights remain identified as estimates rather than becoming
claimed surveyed floor counts.

The references are linked and credited per group in the profile. In particular,
the Landesdenkmalamt's
[Chamissoplatz ensemble description](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030459)
distinguishes earlier restrained fronts from later decorated buildings. The
[Köpenick facade guidance](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/stadtentwicklungsamt/stadtplanung/erhaltungs-verordnungen/artikel.94605.php)
distinguishes low eighteenth-century houses from varied later construction.
The [Neukölln IFEK](https://www.berlin.de/ba-neukoelln/politik-und-verwaltung/aemter/stadtentwicklungsamt/stadtplanung/weitere-staedtebauliche-planungen/ifek-hermannstrasse_2015.pdf)
records losses of historic decoration: missing gable towers and old stucco are
not blindly reconstructed. The profile uses public contextual descriptions and
their credited exterior references; it does not claim a photographic survey of
each selected house. No photograph, plan page, bitmap or texture is distributed.

## Regional checks

The strict common compiler accepts all sixty-four selected owners in both
families. The isolated southern result has thirty-four mode/host packet keys,
35,528 drawn triangles and 28,480 native triangles, with visible new windows for
every selected owner. No source body or roof triangle is retired. This is a
regional compiler check; integrated runtime, browser and publication checks
belong to the coordinating fifty-cluster task.

Two focused Python tests independently replay the frozen positive-use records,
polygon overlaps, exact original packet/body receipts, selected owner counts,
inner/outer balance and absence of conflicts with mapped material receipts.
