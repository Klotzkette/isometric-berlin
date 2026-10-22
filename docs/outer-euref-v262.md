# Step 10 — outer houses and EUREF campus, v262

Release 1.0.162 refines existing coverage without changing the 93-place tour,
source geometry policy, mobile quality or live delivery/residency limits.

## Changes and scope

- A restrained eight-wall/eight-roof fallback replaces bright unknown-material
  paint in eligible primary house packets. Explicit mapped material colours and
  individually authored architecture retain precedence. The 1,635 qualifying
  descriptor identities are an eligibility inventory, not a house count.
- 78 previously untreated houses in 15 sampled outer tiles gain 409 drawn or
  308 independently orthogonal native windows, including frames and sills.
  The 45,531-byte recipes use existing packet lifetimes and renderer batches.
- 24 houses receive complete measured roofs: eight each in Spandau,
  Niederschönhausen and Adlershof. Pankow yielded no exact eligible match in
  the bounded local source audit and remains untouched by this roof transfer.
- The EUREF campus is aligned with its retained Schöneberg source owners.
  Gasometer framing, green base mantle, glazing and terrace distinguish the
  current structure; eight historical owners retain full measured building parts.

This is not a survey of every Berlin location. Positions of the selected owners
are checked against retained official footprints and mapped campus identities;
open courts, streets and unrelated owners remain preserved. Window rhythm,
unknown paint, small fittings and the conflicting Gasometer inner-envelope fit
are explicit presentation estimates, not surveyed details.

## Detailed evidence

- [Outer palette and street-window receipts](outer-houses-v262.md)
- [Complete measured roof transfers](outer-roofs-v262.md)
- [EUREF source geometry and current campus](euref-campus-v262.md)

## Integration and validation

Roof/facade preparation uses the existing cooperative decoder and atomic
transaction. Original public house packets remain immutable. Roof retirement
only occurs after a valid complete replacement is prepared. Native models are
independent axis-aligned geometry. No added photograph, video, animation or
external rendering process is used.

Internal-app-browser checks cover actual Köpenick source walls, Spandau drawn
and native roofs, a Niederschönhausen sample, plus the EUREF campus. Adlershof
roof packets are covered by exact decoder/source checks.
Only the local model under review is loaded at a time, with explicit disposal
between views. No external Safari or browser process is started.

The final production build and TypeScript checks pass. The targeted runtime
suite passes 80 tests, including all six EUREF packets retaining their earlier
v233 roof and door additions; 101 targeted Python/source/readiness tests pass.
The complete staged release readiness gate passes.
The broad historical Python suite was also started: 137 checks passed before
it was interrupted after 310 seconds to limit local resource use. It is not
reported as a completed full-suite run.

Six already-packed water/ground strings are gzip-encoded losslessly at build
time and decoded lazily once into a strong field cache. They remain byte-exact
and retain the existing ownership lifetime; no WeakRef is used for strings.
This saves about 4.3 MB across the changed production chunks. The hosted tree,
including both prior live asset graphs, measures 1,072,665,646 bytes, below the
1 GiB hosting limit by 1,076,178 bytes. No source asset or retained graph is
removed to obtain that saving. The source release is commit `5b40a0e0` / tag `v1.0.162`. Both downloadable
archives passed the unchanged complete archive validators and GitHub SHA-256
checks. The package contains 4,747 files / 933,183,458 bytes (889.953 MiB).
The hosted commit is `4933f7ad547e3db8f5e22d90ad44d26ff86c97a8`.

- ZIP: 755,818,972 bytes; SHA-256
  `76532688d70a64a8e51f73df2a28a4d80d27b4302557eb6cb5a78d298b696ef2`.
- Static tarball: 755,021,667 bytes; SHA-256
  `71f1734238e99e1a57c964bc6a7e456ea2d0048314db7e5222778cfe5372584e`.

GitHub Pages workflow `39744553249` succeeded. A fresh HTTP verification matched
all 14 checked deployed files byte-for-byte with the staged release, including
the six EUREF packets, active manifest, source credits and changed runtime chunks.
Both remote archive sizes/digests match; all three withdrawn Columbiahalle
recording URLs still return HTTP 404. Internal-browser final drawn/native
checks reported no warnings or errors; its temporary tab and local server
were closed afterwards.
