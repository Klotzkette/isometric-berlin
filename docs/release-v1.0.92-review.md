# v1.0.92 — Central approaches and station detail

## Delivered scope

A bounded step-10 refinement around the six requested centres:

- [Hauptbahnhof and Chancellery](government-approaches-v192.md): thin frames for
  the twelve open public portals, and small rails/louvres on the existing loggias.
- [Brandenburg/Pariser and Potsdamer Platz](centre-access-v192.md): metal framing,
  legible U signage and names at the Pariser entrance; railing supports and DB
  signs in the two existing Potsdamer entrance halls.
- [Alexanderplatz](station-details-v192.md): longitudinal station-roof members, small luminaires and
  geometric platform labels; facade lettering is centred and faces the reader.
- [Bahnhof Zoo](station-details-v192.md): the exact mapped entrance-O roof owner becomes an open glass
  canopy with posts and small signs. Its original coarse record remains in the
  source receipt; unrelated buildings and underground geometry stay intact.

This is a small architectural round, not a resurvey of every surrounding
building. Measured source envelopes and mapped anchors remain distinct from
photo-guided, unsurveyed member sizes, counts and colours. No reference photograph
or image texture is bundled. New per-file credits join the existing closed
Sources & licenses menu.

## Preservation and runtime

Existing city packets, source geometry, roads, shorelines, trees, the 93-place
tour, viewing distance, resolution and resident budgets remain unchanged.
The only newly suppressed old coarse owner is the individually recorded Zoo
canopy; its replacement retains the full mapped roof ring and tagged height.
Minecraft uses its own native additions and the mode lifecycle releases the old
family before rebuilding. Touch and pointer keep the same drawn detail.

The added component buffers total 131,204 bytes in drawn modes (nine draw calls)
and 313,360 bytes in Minecraft (six additional draw calls). These counts exclude
the unchanged surrounding city and browser/driver overhead. No new textures or
continuous animation are introduced.

## Validation

- The complete Python sweep finished with 988 passing and four skipped tests.
  Its only initial failure inspected the still-old local package during the
  rebuild; the final 79 release-readiness/source tests pass against v1.0.92.
- Focused Bun checks pass: government approaches, unchanged station openings,
  architectural transforms, native palette/envelopes, central entrance details,
  Alex/Zoo source ownership, roof/lettering bounds and shared-mode disposal.
- Production TypeScript/Vite build, Ruff, package readiness and extracted-package
  launch checks pass. Original city packets and all 511 earlier credits remain;
  four new external references are appended in both credit manifests.
- Fresh Chrome: 14 overview/close views across all six centres, plus three final
  unobstructed approaches, with no page or console errors.
- Mobile WebKit with the iPhone 13 browser profile: seven sequential visits through
  all six modes and back to day; no errors, crashes or WebGL context-loss events.
  Tracked GPU vertex/index/instance buffers peak at 224.0 MiB for this route.
  This excludes texture/driver memory and does not reproduce physical iPhone RAM.
- Independent review caught native Zoo lettering hidden by its own stepped sign.
  The corrected offset follows the actual projected backing extent; 78 drawn/native
  glyph raycasts now hit the letters before the background.

The [native construction audit](minecraft-construction-v192.md) passes all 37
constructor/voxel tests. Full and mobile synchronous/cooperative buffers match
byte-for-byte; historical fixtures remain frozen. No viewing-distance, source-detail or mobile quality
reduction is introduced.
