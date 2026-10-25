# Northern ordinary-house corrections v271 / release 1.0.171

The two supplied screenshots show a missed appearance layer, rather than
missing window geometry. Detailed Alt-Mitte v169 houses did not use the primary
city palette, and the older v213 correction retained uniform unknown wall and
roof paint. Separate v166/v168 shells at the park edge needed a different proof.
Kollwitzplatz uses primary city shells and has its own missed corner matches.

## Scope and evidence

* [Alt-Mitte correction](north-mitte-colours-v271.md): 1,043 drawn and 427 native
  source families, around Weinberg, Zion, Arkona and Kastanienallee.
* [Legacy park-edge correction](weinberg-legacy-materials-v271.md): 73 drawn and
  49 native families in older street/scheunen source layers.
* [Kollwitz correction](kollwitz-materials-v271.md): 433 ordinary owners: 408 around
  Kollwitzplatz and 25 on the northern Kastanienallee, including all 19 existing
  verified street fronts. The earlier facade fittings on 166 of those owners
  remain byte-identical.

Thus 1,549 distinct drawn source families receive safely attributable colour
corrections. The independent native proof changes 680 families (427 + 49 + 204);
it never borrows the drawn proof. Northern Kastanienallee changes 25 drawn and
9 native owners; the other 16 native owners remain protected by ambiguity
rejection. Existing authored facades and mapped material colours retain
priority. Twelve restrained plaster tones and varied roof tones replace only
unknown defaults. These are contextual display estimates; the viewer screenshots
do not establish actual paint colours. No claim of house-by-house photographic
accuracy is made. The owner subsequently confirmed that the dictated
“Altonaer Platz” means nearby Arkonaplatz; that area is included in the correction.

## Preservation and runtime

Only exact existing colour cells change during cooperative packet construction.
Encoded source fingerprints, source planes, incident triangles and independently
proved native surfaces guard every correction. Ambiguous native joined surfaces
remain unchanged. All coordinates, indices, roof sheets, windows, linework,
courtyard holes, streets, navigation and public source packets remain intact.
There are no additional GPU buffers, draws, roots, textures, animation or
per-frame work. Full mobile detail, 93 tour stops, initial flight mode and every
residency/decode/prefetch budget are unchanged. Tiny eager key indexes reject
unrelated packets before accessing receipt fields. The larger v169 receipt map
uses the existing lossless weak encoding; the two small maps remain ordinary
eager data below the unchanged compression admission threshold.

## Visual verification

The internal app browser compared identical camera views using real production
chunk factories and actual adjacent packets. Weinberg/Zion before and after
both contain 958,384 triangles, 31,754,964 geometry bytes and 17 draw calls.
The Kollwitz comparison contains 158,176 triangles, 3,934,440 geometry bytes and
17 draw calls in both versions. Drawn facades now visibly separate warm stone,
ochre, rose and subdued cooler tones; source roof and window contours remain.
Independent native rendering is also inspected. The final northern Kastanienallee
view includes primary bodies and all retained kiez209/danzigerfront244 companions:
65,829 drawn triangles / 1,523,502 geometry bytes / 8 draws; independent native
202,790 triangles / 4,088,820 geometry bytes / 5 draws. Temporary QA crops/harnesses
are not shipped. These bounded views are not a full mobile endurance test.

## Validation and publication

* Complete Python suite, batched to keep the final corridor and package checks
  on the final inputs: **1,948 passed, 4 skipped** (1,864 + 80 release + 4
  Kollwitz checks). The main run took 1,896.63 s. The two existing warnings are
  missing CRS metadata in temporary geometry-test outputs.
* **85 Bun checks passed**: 13 new colour checks, 10 exact lossless-data checks,
  and 62 surrounding/runtime regressions. TypeScript and the production build
  passed (17.67 s); whole-repository Ruff format/lint and whitespace checks passed.
* Independent source review found no remaining missing native neighbour blocker
  or unsafe selected native triangle. The northern street exception is exactly
  17 fitting-only identities; other authored/material protection remains intact.
* Both complete portable archives passed the unchanged full validators and their
  uploaded sizes/SHA-256 matched. The package contains 4,747 files / 926,707,214 B.

The source release is `v1.0.171` at
`470fcfdf59a427fa7554e9287073cd935b58fe9e`. The owner confirmed Arkonaplatz during
final validation; no geometric scope change was needed.

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Local ZIP | 760,184,059 | `69aad5757cd947f4f26379bbfddb81c99da469fe8d69d5e642bf3a64d9f1574b` |
| Static tar.gz | 759,414,223 | `5ab1d351105c96d0c1868602a730c1a51ab18cb9acb3390fb024eb51f4bb250f` |

[Versioned downloads](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.171).
The public Pages deployment at
`1d97f6203e4b87bfa28c94bb5db65a3b92c6ba8b` completed successfully
([workflow run](https://github.com/Klotzkette/isometric-berlin/actions/runs/40226883822)).
All ten hosted index/manifest/attribution/runtime/worker byte checks match the
prepared package. Both published archive sizes and SHA-256 digests match; the
three withdrawn Columbiahalle recordings remain HTTP 404.

The complete deployment is **1,064,036,719 B**, **9,705,105 B below 1 GiB**.
All **328** assets in the exact preceding v169/v170 live closures remain:
32 prior-only assets / 137,329,505 B. Only 15 stale older hashed assets were
removed. No hosted geometry overrides or detail reductions were introduced.
[Live viewer](https://klotzkette.github.io/isometric-berlin/).
