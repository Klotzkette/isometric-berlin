# Outer-city transport recovery — v1.0.180 / Step 10

The owner reports very slow or stuck construction near Reuter-West, Eiswerder
and Zitadelle Spandau. Investigation establishes two distinct issues: a
reproducible transport stall in the shared loader, corrected here, and an
existing source-coverage gap around the Reuter-West cooling tower. The latter
cannot be filled by waiting for downloads; a bounded extension is proposed
separately and still awaits owner approval.

The existing regional payloads are intact: all 56 drawn and native assets in
the 28 descriptors within 800 metres of these three sites return HTTP 200 and
match their source lengths and SHA-256 digests. The published manifest also
matches the retained local manifest. This verifies existing packets; it does
not establish continuous ground coverage throughout those radii. The cooling
tower is a required landmark model, independent of surrounding streamed ground.

## Transport correction

The previous loader has a reproducible head-of-line transport stall. A
foreground response that stops providing bytes holds the serial pump
indefinitely, even when both subsequent prefetched responses have completed.
Refreshing visibility does not release that wait. This is a demonstrated
failure mode, not proof of the particular network conditions on the owner's device.

Both foreground and prefetched transfers now have a 15-second inactivity guard
around response headers and each pending raw-byte read. Receiving bytes renews
the deadline, so a slow but progressing download has no total-duration cutoff.
JSON parsing and geometry construction have no transport timer. A stuck request
releases the serial queue even if its underlying cancellation never settles;
late responses cannot publish. The failed packet uses the existing 30-second
retry cooldown while subsequent packets continue.

Page hiding, renderer suspension, mode changes and disposal cancel transport
without treating deliberate cancellation as a failed packet. Manifest loading
also suspends and resumes without consuming a failed attempt. Existing byte
validation, gzip handling, serial decode/publication, two-packet/4 MiB prefetch
and geometry-residency limits are unchanged. No city payload, source geometry,
mobile detail or tour stop has changed.

## Separate Reuter-West coverage gap

The retained v230 coverage represents the cooling tower and its base in an
exact **9,974.054 m²** footprint. At all four cardinal points only 150 metres
from the tower, both actual runtime ground functions return no ground and no
streaming descriptor owns the location. The nearest streamed ground is
approximately **548.029 metres** away. Five surrounding tile interiors have
no descriptor from any source family. These are absent source areas, not
unfinished downloads or missing parts of the required tower.

A read-only proposal covers the mapped Reuter-West site, OSM way `454730438`,
and a narrow mapped connection along Großer Spreering, Boltonstraße and
Nonnendammallee. It adds **328,263.300 m²**, approximately **0.328 km²**, after
subtracting existing coverage. The complete review envelope is 339,614.464 m².
Thirteen boundary-building footprints are kept whole. Seventy cached building
footprints intersect the envelope; this is a source inventory, not a count of
approved replacements. Complete measured owner/part review remains pending,
and three required LoD2 source tiles are not yet cached. The proposed 25-metre
road half-width is a display envelope, not a surveyed legal boundary.

The concrete proposal and map were presented to the owner. Approval remains
pending under AGENTS.md section 11's requirement for an approved, documented
bounds revision. No new coverage has been generated or added. This proposal
preserves the existing tower and does not extend to all Siemensstadt or Spandau.
Its local evidence is `reuter-runtime-ownership.json` and
`reuter-coverage-proposal.json` / `.png` in the v280 verification cache.

## Verification

The focused regression suite passes 60 tests with 817 assertions. Its two
queue-liveness regressions fail against the previous v279 loader as expected.
Independent review adds eight adversarial transport checks and two checks that
an undefined rejection remains a rejection. Full TypeScript checking and Ruff
pass. The [machine-readable receipt](outer-loading-v280-verification.json)
records hashes, regional asset and ownership audits, and release progress.

The regional production constructors retain all geometry, with no packet-bound
overhang. Workstation constructor timings are local measurements only; they
are not phone benchmarks or guarantees against every future stall.

The first normal production build failed because the local disk filled while
writing a generated JavaScript chunk. After removal of only the exact reviewed
failed dist files, the production build passed in 3 minutes 33 seconds using
a cache-only storage adapter. Original startup and worker budget plugins stayed
active. All 315 emitted files / 205,672,179 bytes were verified against the final
bundle: 193,389,959 byte-identical bytes were hardlinked from the prior package,
and 12,282,220 bytes were newly written. No output bytes or source assets were
changed. The adapter's all-plugin `writeBundle` guard was strengthened after
this build started; that stronger guard was not exercised by this run. The
loaded original guard was sufficient for the known current plugins, which have
no `writeBundle` hook. This guard-only follow-up changed no output logic.

The complete public payload was subsequently staged and the package HTTP smoke
passed. The package contains 4,750 files / 934,456,238 bytes. Both deterministic
ZIP and tar archives pass their unchanged complete validators, sequentially
in RAM without additional disk archive copies. Pages preflight retains the
complete v179/v178 asset closures and totals 959,009,745 bytes, leaving
114,732,079 bytes below 1 GiB. Both archives and their checksums are uploaded to the verified v1.0.180 draft;
publication and live checks have now passed.

The internal app browser exercised the actual packaged production city with
a controlled stall in `outer187--22_-6`'s Minecraft response. In the decisive
second control, the camera stayed unchanged while the server delivered 32 bytes
and held the remainder for 35 seconds. Subsequent packet requests continued
before that server release: the first observed response was after 22.343279
seconds, and 26 subsequent packet responses arrived before release. The stale
connection was reset and the same packet received a normal successful retry
after 52.374512 seconds. The browser logged the expected transfer-stall warning
and no errors. These observed timings include browser scheduling and are not
an exact 15-second recovery-time guarantee.

Screenshots `spandau-minecraft-recovered.png` and `spandau-day-recovered.png`
show the retained Spandau/Zitadelle/Eiswerder city after recovery and after
returning to Day. This is bounded desktop internal-browser testing, not a
physical-phone or endurance claim. It does not resolve the separate Reuter
coverage gap. No external browser was used.

The complete Python suite passes **2,107 tests**, with four skips and two
existing CRS warnings, in 3,077.14 seconds. Both uploaded archives match the
validated local bytes and their remote SHA-256 digests. Version **1.0.180** is
published as a GitHub release and on Pages. The live index, manifest and actual
owning chunks of both changed loader modules match the verified package byte
for byte. The withdrawn Columbiahalle recordings remain HTTP 404. The complete
public tree remains 959,009,745 bytes with both preceding live asset closures
retained. This release fixes transport liveness; the separately proposed
Reuter-West coverage extension remains unapproved and unbuilt.
