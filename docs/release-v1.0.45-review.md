# v1.0.45 — Schiller monument on Gendarmenmarkt

Step 10 replaces the old recognition sketch at its retained OSM anchor with a
more faithful procedural reconstruction: six octagonal marble steps, a moulded
pedestal, four separate basins and lion masks, four seated allegories with their
distinct attributes, the clothed and laurel-crowned poet, and ornamental iron
railings. The 8 m socle and 2.95 m standing figure follow the published inventory.
Nine inspected photographs establish clothing, poses and ornament. Source
conflicts, credits and estimated intermediate proportions are documented in
[the source review](schiller-monument-v145.md). This is an isometric procedural
model, not a sculpture scan.

The full drawn model is identical on mobile and desktop. It has 1,987 instances,
five draws and 365,164 bytes of geometry/instance buffers. Minecraft uses 997
native cubes in one draw and 76,708 bytes. Replacing the previous 77-cube sketch
adds exactly 920 instances, one draw and 70,856 bytes to either Minecraft world
profile. No photo textures are loaded. Existing square, theatre, churches,
terrain, street data and the 93-stop catalogue are retained. Solid bounds follow
the stepped core and enclosure; the surrounding square remains traversable.

Validation:

- All 459 Python tests pass; Ruff format/check, TypeScript and production build
  pass. Release readiness, local-package HTTP smoke and diff checks pass.
- The complete frontend run executed 2,250 tests: 2,248 passed and two reported
  the expected obsolete Minecraft appearance signatures. Independent synchronous
  full/mobile builds established the replacement signatures and the exact
  accounted delta above. After updating those fixtures, all four tests in that
  construction suite passed against cooperative builds. No other failures.
- The 22 focused monument, Gendarmenmarkt and memorial-protection tests pass,
  covering finite geometry, bounded cost, material round trips, placement and
  clear approaches.
- Production Chrome desktop and touch WebKit completed day, night, snow,
  Schwellenraum, Minecraft and return-to-day transitions without runtime errors.
  Each mode exposed exactly one appropriate monument; screenshots were inspected.
  Touch WebKit is browser emulation, not a physical iPhone test.
- An independent final diff review found no release blockers.

Independent Minecraft buffer signatures:

| Profile | Instances | Draws | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,849,664 | 120 | 293,594,321 | `9643c0b1ae3dc617e4feb217fb41d8b1da970dc5bc95f4a42d33c2109fcb51b2` |
| Mobile | 1,066,800 | 118 | 81,647,201 | `15374bc2c8b234206abb8817b250eced51433725653f62bda80120572fdcae8d` |
