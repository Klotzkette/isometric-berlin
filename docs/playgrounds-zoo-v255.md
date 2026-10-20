# Step 10 — Large playgrounds, Zoo Berlin and Tierpark, v1.0.155

The owner's request covers twenty large Berlin playgrounds, named examples and
both distinct zoological gardens. Existing buildings, surfaces, paths, equipment
and all earlier detail remain. Static additions use the existing bounded loading
and disposal machinery with identical drawn detail on mobile and desktop.

## Selection and source limits

The complete official GRIS WFS playground inventory retrieved on 20 October 2026
contains 1,886 records with distinct `pitid` identities. We sort `katasterfl`
descending and retain twenty complete feature geometries, including holes.
This is **gross cadastral area**, including ancillary grounds; it is not the
size of equipment footprints, net playable area, popularity or visitor capacity.
The published `nettospfl` values are retained separately, including zeros.
No incomplete map query or general park polygon is used to establish this rank.

Primary sources:

- [Berlin Open Data inventory and licence](https://daten.berlin.de/datensaetze/grunanlagenbestand-berlin-einschliesslich-der-offentlichen-spielplatze-wfs-737fd0a4), dl-de-zero-2.0.
- [Official field definitions](https://gdi.berlin.de/data/gruenanlagen/docs/Datenformatbeschreibung_Gruenanlagen_Spielplaetze.pdf).
- [Official playground statistics and gross-area explanation](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/daten-und-fakten/spielplaetze/).
- Retained OpenStreetMap extract, 29 September 2026, ODbL-1.0, supplies mapped
  devices, surfaces, paths and furnishings. Device dimensions and schematic
  construction remain labelled display estimates; an unrecorded object is not
  silently claimed to have been surveyed.

`playgrounds-v255-ranking-ledger.json.gz` retains every official record's
properties and the full response digest; `playgrounds-v255-official.geojson`
retains the selected complete geometry in EPSG:25833. The raw WFS download stays
outside the repository. `scripts/select_playgrounds_v255.py` rejects partial or
duplicate-identity inventories before producing the frozen selection.

Additional official site records cover Helmholtzplatz, Weinbergspark including
its separate Plansche, Gipsdreieck including Joachimstraße and both nearby
Bellevue candidates (Bartningallee and John-Foster-Dulles-Allee). “Kiezdreieck”
is provisionally interpreted as the user's previously requested Gipsdreieck.
The Zoo's playground belongs to the separate Zoo recognition model.

## Zoo and Tierpark

See [Zoo recognition](zoo-recognition-v255.md) and
[Tierpark architecture and gardens](tierpark-v255.md) for exact source identities,
primary architectural references, retained geometry receipts and dimensional
limitations. Zoo Berlin and Tierpark Friedrichsfelde remain separate sites.
Reference photographs and protected visitor plans are neither traced nor bundled.

## Runtime and preservation

No new animation, photographic texture, tour stop or live memory allowance is
introduced. New playground scope is limited to the exact selected footprints,
not surrounding districts. Native geometry is independently orthogonal.

The existing hospital constructor's `boxes`, `blocks` and `padTriangles` now use
the established lossless constructor-field compression. They are immutable
construction inputs copied synchronously into geometry/instance buffers. The
separate small helipad navigation data remains strongly available. No source
value or rendered hospital geometry is removed to accommodate the new details.
The same lossless lifetime applies to the audited Tacheles construction fields.
Pure source-index initializers and pure Alt-Mitte wrapper assembly let the build
exclude unused construction families from the background worker. A production
graph test checks that boundary, and complete value hashes verify both used
Alt-Mitte families against every unchanged source packet.

Tierpark preparation and playground annotations belong to the streaming caller.
The shared geometry decoder remains byte-identical to the previous source,
allowing existing large hashed assets to be reused. Preparation cooperatively
yields and observes cancellation; an aborted unpublished root is disposed.
Tests compare all ten Tierpark family packets with explicit preparation.

The finite catalogue contains 2,190 descriptors, within a 2,208-descriptor and
2.125 MiB metadata allowance. Resident geometry and transfer budgets do not grow.
Four retained Weinberg pitch sheets and their 47 native runs receive a 2 cm
display-layer separation before the existing terrain projection, eliminating
coplanar overlap without changing source geometry, terrain or navigation.

## Validation and publication

- Python: the complete suite initially passed 1,676 cases with four skips.
  The remaining failures concerned the enlarged finite catalogue, historical
  manifest receipts and version constants. After correcting those expectations,
  fresh affected-module runs passed 66 cases, 22 receipt cases, the city-coverage
  case, seven Grunewald/east-city cases and the focused integration cases.
  Final playground/ranking/integration tests, including narrow native paths,
  pass all ten cases.
- Bun checks cover Zoo instances and roof support, all ten Tierpark packets,
  cooperative cancellation/disposal, independent native geometry, source
  equality, lossless constructor-cache collection, worker exclusions and the
  unchanged worker ceiling. TypeScript and the production build pass.
- Browser: 14 playground views across desktop drawn/native and iPhone WebKit,
  followed by three corrected Weinberg views, pass without page errors,
  graphics errors or lost contexts. The final Zoo/Tierpark build passes all
  19 desktop drawn/native and iPhone WebKit views.
- The narrow new native paths use contained 0.5 m cells; other surface cells
  retain their 2 m raster. All 39 drawn packets and all non-path native
  triangles/navigation are unchanged by that correction. Only 17 native
  packets change, adding 248,305 compressed bytes. The largest decoded
  playground packet is 2,336,918 bytes, below the existing 4 MiB limit.
- `uv run ruff format .`, `uv run ruff check .` and `git diff --check` pass.

The final narrow-path browser check also passes. The final focused Bun run
passes 11 cases with 2,229 assertions.

The complete portable package has 4,725 files and 931,504,439 bytes
(888.352 MiB), below the unchanged 889 MiB offline ceiling. ZIP and TAR contents,
launchers, versions and asset receipts pass the release audit.

| Archive | Bytes | SHA-256 |
|---|---:|---|
| ZIP | 751,520,652 | `036ef6abfbc24500aaa60aa7c8300993ccdf16e081ced2e63f317f293ad31405` |
| TAR.GZ | 750,721,545 | `6f815e44bdd64b0fb38f6f7205e4a4887472dd48ce177332f349b70389c94f1e` |

The verified Pages union preserves all 324 hashed assets belonging to the two
previous live versions, with 29 older-only files. Total size is 1,064,730,640
bytes, leaving 9,011,184 bytes below 1 GiB. Only older superseded assets are
pruned; the current portable site is published completely.

Published on 20 October 2026:

- Source/tag `v1.0.155`: `98f42fa8`.
- Pages commit: `3added86bf9d91d44d46a6ec6bd23e374dc0e15a`.
- GitHub Pages workflow `39433977032` completed successfully.
- [Release and downloads](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.155):
  both uploaded archive sizes and GitHub SHA-256 digests match the table.
- Hosted HTML, package manifest, complete city manifest and sampled drawn/native
  playground packets match the checked portable files byte-for-byte.
- Nine additional public-browser cases pass: Zoo pagoda, Tierpark palace/gardens
  and Werner-Sylten-Weg in desktop drawn/native and iPhone WebKit. No page errors,
  graphics errors or lost contexts occurred.

[Public viewer](https://klotzkette.github.io/isometric-berlin/).
