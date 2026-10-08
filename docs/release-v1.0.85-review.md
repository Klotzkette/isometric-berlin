# v1.0.85 — modest school and neighbourhood detail

## Delivered scope

- Gymnasium Steglitz, Gymnasium Tiergarten, Berlin Metropolitan School,
  Kastanienbaum-Grundschule and John-Lennon-Gymnasium gain small source-bound
  masonry/copper edge accents. Existing school shells, windows, roofs, open
  courts and the Tiergarten hand remain. John-Lennon accents follow its existing
  +6.91 m rigid terrain translation.
- Ackerhalle / REWE gains terracotta courses, fine portal arch/fan divisions
  and geometric lettering. Rosenthaler Platz gains shallow facade profiles;
  Otto-Weidt-Platz receives ground-seated stone benches along four mapped curves.
- Kulturbrauerei gains brick pilasters, courses and arched window profiles,
  constrained below actual source wall/roof boundaries. Hagenauer Straße gains
  restrained facade accents and kerbs; Weinbergspark gains 78 small flowering
  shrubs inside seven existing planted beds.
- “Corinna Höfe” is interpreted as **Choriner Höfe**, a stated working
  assumption rather than a confirmed correction. Only the identified Choriner
  Straße 84 building receives this pass's small accents; all other houses remain.
- Richardplatz is interpreted as the Berlin square in **Neukölln**. The
  Richardplatz/Schudomastraße and Wiener/Forster Straße corridors receive
  shallow profiles on 113 existing street-front owners and source-aligned
  kerbs. Görlitzer Park gains mapped path edges and 39 mapped wooden benches.

## Fidelity and runtime

This is modest procedural recognition, not a facade survey. Member sections,
window subdivisions, plant species/spacing, colours and seat sizes are recorded
display estimates. Exact source owners, mapped courses and source hashes are
documented in [schools](schools-v185.md), [public places](public-places-v185.md),
[north](north-v185.md) and [southern streets](south-kiez-v185.md).

No original city geometry, packet, source inventory, terrain, navigation,
view distance or detail is deleted or simplified. The additions use 13 static
drawn batches or 12 independent native Minecraft batches. Only the active
representation creates scene/GPU objects. Buffers are final-sized, transforms
are frozen, and existing mode-family unregister/disposal remains in force.
Touch receives the same detail; no new texture or per-frame effect is introduced.
The published 2008 Ackerhalle photograph is an attributed external reference
only; its old shop name is not reproduced and no photographic pixels are shipped.

## Validation — 8 October 2026

- Full Python run: 896 passed, four skipped, five initial failures while new
  source data/version/build/package files were still changing. Four source and
  cached-version failures passed on rerun against final files. The remaining
  readiness test passed after final packaging. No unresolved failure remains.
- Final targeted new Python checks: ten passed; the school terrain correction
  additionally passed its source-containment and datum tests.
- Eight Bun tests / 130,953 assertions passed for the four additions in drawn
  and native form. Ruff check/format, TypeScript and production build passed.
- Desktop Chrome exercised 13 requested locations. Changed Otto-Weidt,
  Kulturbrauerei, Weinbergspark, Ackerhalle and John-Lennon views were checked
  again after the relevant source/datum corrections.
- WebKit with an iPhone 13 browser profile passed Day, Night, Schwellenraum,
  Snow, Flood, Minecraft and return to Day at Kulturbrauerei, with no page or
  console errors and no context loss. The instrumented WebGL buffer peak was
  230,969,055 bytes; this is not total browser-process memory. An initial QA
  camera seed collided with the startup camera transition; waiting for that
  transition before seeding resolved the harness assertion without app changes.
- Independent source-preservation review found only additive integration and
  no removal from existing source packets or model families.
- Final release-readiness and local package HTTP launch checks passed for
  v1.0.85. The last Ackerhalle close-up also confirmed readable front-facing
  lettering and the removal of the new centre pier from the arched entrance.

Final extracted package: **562,716,408 bytes**, within the unchanged 540 MiB
archive allowance. This allowance does not alter runtime residency limits.

SHA-256:

```text
248a32eeb73805eafbd73aa5db53963cd8ef5f5322de87ffff972203cb0243b6  isometric-berlin-regierungsviertel-local.zip
11820b27d68859e1990b1f1ef32ba1325db25738b97a6258d113c28d09847130  isometric-berlin-viewer-v1.0.85.tar.gz
```

Browser profiles cannot emulate a physical phone's RAM limit or guarantee
crash-free operation on every device.
