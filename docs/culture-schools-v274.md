# School and culture architecture v274 / v1.0.174

This Step 10 pass addresses the requested named schools, theatres and northern
Mitte fronts. It makes bounded architectural corrections, not a claim that all
Berlin houses have been surveyed anew or that browser memory failures are
impossible. The existing v173 ordinary-house colour corrections and Steglitz
photo-window correction remain; this pass does not recolour those sources.

| Requested places | Change / evidence |
| --- | --- |
| Gymnasium Tiergarten, Kastanienbaum-Grundschule, John-Lennon-Gymnasium, BMS, BeSmart Academy, Kita Fürstenberger Straße 4/5, Choriner Höfe | Source-bound windows, terrace/rail members and complete measured BMS upper envelope; [school evidence](schools-courts-v274.md) |
| Schiller-Theater, Deutsche Oper, Staatsoper, Komische Oper main house, GRIPS | Full measured first two building families and bounded entrance/facade details for the other three; [opera evidence](opera-theatres-v274.md) |
| Deutsches Theater, Berliner Ensemble, Volksbühne, Heinrich-Böll-Stiftung, Friedrichstadt-Palast | Roof monitors, stage/coping structures, atrium framing and corrected Palast stage placement; [central theatre evidence](central-theatres-v274.md) |
| Herz-Jesu-Kirche, Grober Unfug, Suhrkamp, Schönhauser Tor | Documented tall campanile, distinct operator/architect-photo fittings on retained source axes; [northern evidence](north-culture-v274.md) |
| Auguststraße, Oranienburger Straße / Neue Synagoge surroundings | Reveals/heads on verified retained upper panes; photo-specific and named landmark owners protected; [street evidence](august-fronts-v274.md) |
| Linienstraße | Existing v239 upper fronts, v265 mapped entrances and v273 colours reviewed and retained; no duplicate window register |
| Neue Synagoge itself | Existing complete v167 preserved facade, portals and three domes retained. The demolished rear prayer hall stays open; no invented reconstruction |

“Corinna-Höfe/Zedernicker Straße” is resolved as Choriner Höfe/Zehdenicker
Straße. The daycare is the operator-confirmed Kindergärten City site on
Fürstenberger Straße 4/5 near Arkonaplatz. “Theaterbuchmacher” was explicitly
clarified as the Volksbühne's stage tower and stage roof structures.

All new additions use procedural geometry without photograph textures or video.
No new residency or loading limit, hidden fallback quality setting, city-coverage
rectangle or tour-stop change is introduced. Full mobile static detail remains.
New geometry still has a real allocation cost, stated in each site document;
construction data is losslessly compressed and not attached to scene roots.

The production build additionally uses Zopfli Gzip for 48 exact, SHA-256-bound
JSON fields in already changed bundles. Each compressed value is inflated and
compared byte-for-byte before acceptance. The original zlib admission decision,
Base64/Base85 codecs, eager/strong/weak ownership and tree shaking remain intact;
changed or unlisted source fields keep the previous compressor. Compression is
serialized at build time with a per-build cache that is cleared after the build.
The compressor and its WebAssembly are not viewer assets. The isolated field
measurement saved 4,665,573 encoded bytes; final bundle and retained-public-asset
sizes are recorded in the publication receipt. This is a transfer-size saving,
not a claim of equivalent decoded-memory savings.

## Validation and remaining uncertainty

Targeted tests cover source retention, exact replacement guards, native
orthogonality, roof collision, source-clipped window details, material identity,
full mobile parity and constructor exceptions. The whole repository Python,
TypeScript, production-build and package checks are recorded separately in the
publication receipt when complete.

The internal app browser reported unavailable. No external Safari or other
browser was opened. Local geometry inspection images are source/model
projections, not rendered browser screenshots or an iPhone endurance test.
Unmeasured joinery, shop signs, roof fittings and colours remain documented
visual estimates. Existing Kita terrain offsets and the old BMS lower-shell
approximation are preserved explicitly, rather than mislabeled as surveyed.
