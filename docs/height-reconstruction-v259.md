# v259 / 1.0.159 — confirmed missing upper structures

## Finding and scope

A citywide retained-source audit found no shared renderer height cap. The drawn
and native pipelines preserve supplied heights; the outer packet format rejects
overflow instead of silently clipping it. All twenty cached original core LoD2
archives were compared with retained heights: no record had an original geometric
height more than 3 m above its stored height. Older OSM fallback heights of 14 m
for churches and 18 m for cathedral/tower objects can leave incomplete silhouettes;
some coarse official parents also omit distinctive upper structures.

This bounded correction fixes three confirmed delivered gaps, not every possible
remaining citywide omission. St Thomas already reaches 56 m and is untouched.
Sankt Paulus Moabit remains a documented follow-up: its coarse core prism needs
a separately receipted complete-source replacement, not an overlapping tower.

| Site | Existing body height | New total height | Evidence strength |
| --- | ---: | ---: | --- |
| Emmauskirche, Lausitzer Platz | 23.64 m | 74 m | Parish history; surviving tower and modern smaller nave |
| Apostel-Paulus, Schöneberg | 26.86 m | 86 m | Parish's 2024 anniversary publication, PDF page 2 |
| LUX/Narva tower, Rotherstraße 11 | 27.58 m | 63 m | Explicit OSM height; architect confirms five-storey glass upper addition |

Heights are above the retained outer ground plane (scene Y=3 m), giving scene tops
77, 89 and 66 m. Tower placement follows original source geometry. Church shaft
widths, upper storey divisions, pinnacles, clock and opening dimensions are
photo-guided estimates, not surveyed measurements. The LUX height has not been
independently surveyed here. No demolished historical nave is reconstructed.

## Sources

- [Emmaus current parish](https://www.evkgk.de/emmaus-kirche) and
  [parish location history](https://www.evkgk.de/uber-uns/standorte).
  The 74 m statement was present in the indexed official history; the current
  shortened overview may omit that sentence.
- [Emmaus parish archive](https://emmaus.de/) and its
  [current exterior reference](https://emmaus.de/imgs/header/header_emmaus-front-320x600-20170215.jpg).
- [Apostel-Paulus, 130-year parish publication, 2024](https://www.ev-apg.de/uploads/9cJfR4ax/Festschrift-130-Jahre-APG-Web.pdf):
  PDF page 2 states 86 m; pages 14–15 describe war damage and rebuilding.
- [LUX owner in OSM](https://www.openstreetmap.org/way/23971070).
- [&MICA architect project](https://undmica.de/projekte/2131/): five-storey
  glass upper addition; distinguish photographs from proposed visualisations.
- [Hans Glave exterior photograph published by &MICA](https://undmica.de/wp-content/uploads/2023/10/LUX_Tower_Fotos_Hans_Glave-5-768x542.jpg.webp).

Primary source geometries, original payload identities and immutable hashes are
retained in `geo_data/regierungsviertel/height-reconstruction-v259-source.json.gz`.
No external images or PDF pages are shipped as application assets.

## Preservation and delivery

Three independent drawn/native companion packets append to the immutable v1.0.158
manifest. Every old descriptor, packet, navigation solid, coverage footprint and
existing detail remains. A verified predecessor adapter rejects unknown manifest
changes, corrupt additions and changes to the six affected base payloads.
Native upper structures use independent axis-aligned stepped geometry.

The additions use existing disposal and distance-based streaming. No global
runtime model, animation, texture, tour stop or residency increase is introduced.
The existing 2,208 descriptor, 2.125 MiB catalogue and 891 MiB package caps remain.

## Validation

- Full Ruff format/check and TypeScript/Vite build passed.
- 39 targeted Python tests passed, including 21 new semantic, preservation and
  corruption tests; 80 streaming/GPU-residency tests passed (918 assertions).
- Independent regeneration reproduced all six new packets, the addition and
  evidence byte-for-byte; frozen source and six original owner packets unchanged.
- New transfer total: 163,040 bytes; drawn geometry 179,868 bytes and native
  geometry 183,552 bytes across the three sites.
- Package: 4,735 files, 934,164,745 bytes (890.889 MiB), within the unchanged
  891 MiB allowance. Release readiness and local package smoke passed.
- Existing visible tiles intentionally survive wide-view retirement pressure;
  the 24 MiB surrounding-city value is an offscreen retirement threshold, not
  a hard limit for all visible geometry. No policy was changed or relaxed.
- Chrome desktop and WebKit iPhone emulation passed all 12 site/family views,
  four wide-view transitions, and mode switches, with no page errors, crashes or
  WebGL errors. Screenshots confirm complete spires/glass upper block. These are
  finite regression checks, not a guarantee against every device memory limit.
- Complete ZIP and static TAR archive validators passed, including every
  packaged member and unchanged offline size limits. Uploaded archive sizes and
  SHA-256 digests agree with GitHub's asset receipts. Checksums are in
  `releases/SHA256SUMS-v1.0.159.txt`.
- Public deployment verification follows below after completion.
