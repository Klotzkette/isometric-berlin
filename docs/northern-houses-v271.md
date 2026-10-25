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
  verified street fronts. The 166 earlier facade fittings remain byte-identical.

Thus 1,549 distinct drawn source families receive safely attributable colour
corrections. The independent native proof changes 680 families (427 + 49 + 204);
it never borrows the drawn proof. Northern Kastanienallee changes 25 drawn and
9 native owners; the other 16 native owners remain protected by ambiguity
rejection. Existing authored facades and mapped material colours retain
priority. Twelve restrained plaster tones and varied roof tones replace only
unknown defaults. These are contextual display estimates; the viewer screenshots
do not establish actual paint colours. No claim of house-by-house photographic
accuracy is made. The dictated “Altonaer Platz” is provisionally interpreted as
nearby Arkonaplatz; the clarification remains unanswered.

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

The 13 focused Bun checks pass, including exact positions/non-receipted colours,
source immutability, invalid-input atomic rejection and tiny-key early rejection.
The 62 surrounding/runtime regressions pass. TypeScript and the production build
pass; whole-repository Ruff formatting/lint and whitespace checks pass. Component
Python checks and independent source review confirm the boundary exclusions and
the nine northern Kastanienallee street courses. The complete Python run and
final public-byte/archive receipts are appended after publication.
