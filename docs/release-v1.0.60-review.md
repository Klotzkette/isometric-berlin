# v1.0.60 — Kulturforum and the northern Hauptbahnhof approach

## Scope and retained quality

This Step 10 refinement is limited to Philharmonie, Kammermusiksaal,
Musikinstrumenten-Museum, Kunstgewerbemuseum, Gemäldegalerie and the northern
railway approach with the Döberitzer Grünzug. The v1.0.59 city boundary,
surrounding-city chunks, existing detailed city sources and 93-place tour are
retained. The four drawn modes use identical static detail on mobile and
desktop. Minecraft has separate source-bound block geometry.

The revised shells retain the official source records. Their source walls and
roof planes replace flattened display extrusions only for explicitly listed
building identities; neighbouring buildings remain eligible for full detail.
Facade joints, doors and small architectural members are documented display
interpretations, not facade surveys. No photograph or photographic texture is
bundled or loaded.

## Source distinctions

- Philharmonie and Kammermusiksaal: Berlin LoD2 supplies the complete building
  parts and shaped roof planes; OSM anchors the entrance locations. Licensed
  reference photographs distinguish grey metal roofs, gold wall cladding and
  pale lower foyers.
- Musikinstrumenten-Museum: retain the corrected fifteen-part shell, fourteen
  rooflight bands, separate low entrance canopy and neighbouring Philharmonie
  source wing. Refine entrance and facade recognition without changing Lenné
  buildings.
- Kunstgewerbemuseum and Gemäldegalerie: retain complete official source
  walls and roofs. Correct the basement-to-street height interpretation and
  distinguish red brick/concrete/metal at Kunstgewerbemuseum from the gallery's
  pale stone and blind street-facing window fields.
- Northern railway and park: OSM supplies mapped alignments. Grün Berlin's
  [opening announcement](https://gruen-berlin.de/pressemitteilung/doeberitzer-gruenzug-neuer-freiraum-am-hauptbahnhof-eroeffnet)
  identifies the Döberitzer Grünzug and distinguishes its opened first section
  from later works. Unmeasured intermediate rail grades and structural member
  dimensions remain explicit presentation estimates.

## Verification

- Concert halls: 27 source parts, 288 rendered source polygons / 846 triangles;
  all 665 legacy columns covered by exact, height-aware ownership. Both
  independently recorded entrance canopies remain open below their roofs.
  Museum shells retain all 234 polygons and their original source identities.
- Mainline and S21 openings use bounded terrain cuts. Tests compare every
  outside terrain fragment, the intersecting lawn's exact remainder and
  retained old rail fragments. No original city mesh payload or surrounding-city
  chunk changed.
- Independently compared all Lenné-only geometry, paint and transforms with
  v1.0.59: identical in drawn full/mobile and both native profiles. The existing
  fourteen Musikinstrumenten-Museum rooflight bands remain intact.
- 557 Python tests passed (two existing CRS warnings in test fixtures); all
  seven northern-rail source tests passed again after the final floor split.
  101 focused Bun tests / 12,335 assertions passed, including source roofs,
  native ownership, mode-specific canopy clearance, portal openings and drawn
  lettering. TypeScript, the production build and Ruff checks passed.
- A construction regression verifies exactly one complete instance of each
  new model in both standalone and staged viewer assembly. Both museum signs
  face outward, and the Gemäldegalerie entrance occupies the exposed Piazzetta
  wall of the retained shared foyer instead of a wall hidden inside it.
- Downloadable ZIP and static tarball were rebuilt; local HTTP package smoke
  and release-readiness checks passed.

| New complete layer | Draw calls | Stored geometry / instance bytes |
|---|---:|---:|
| Concert halls, drawn | 6 | 506,314 |
| Concert halls, native | 1 | 539,732 |
| Two museums, drawn | 2 | 269,816 |
| Two museums, native | 1 | 1,455,228 |
| Northern rail and green corridor, drawn | 2 | 283,672 |
| Northern rail and green corridor, native | 1 | 2,366,756 |

All new drawn geometry is identical on mobile and desktop. No additional
animation loop, texture, light source or speculative world warmup was added.
The complete existing Lenné layer is included in the separate museum budget
record, rather than counted as new geometry here.

Desktop Chrome completed 60 viewpoint/mode samples with no errors or context
loss. The final subsequent change partitions the tunnel floor into affine grade
sections so its triangles cannot cover sleepers; it retains the same footprint.

The serial WebKit repeat completed 60 viewpoint/mode samples through Day,
Schwellenraum, Minecraft, Night, Snowstorm and Day, with no page errors or
context loss. All three new model roots were present exactly once. Measured
GPU buffer storage peaked at 153,713,858 bytes and ended at 73,225,510 bytes;
mobile speculative warmup stayed off. This route preceded only the final
sub-metre portal ownership seam correction, planar floor split and native
caption clearance, which are checked separately below.

One Playwright WebKit Development process crashed during the initial final-build
route at the museum-to-railway transition. The macOS crash report records a
native invalid-pointer fault in incoming worker-message string deserialization,
not a JavaScript exception or an OOM termination. Last measured GPU buffer
storage was 77,525,272 bytes (117,907,540 peak) with no context loss. These
counters exclude native/JavaScript heap and cannot exclude memory pressure.
The cause is not established; a passing repeat must not be described as a fix.
Browser phone profiles do not reproduce physical iPhone memory limits.

The final production build passed eight further affected-view samples each in
mobile WebKit and desktop Chrome, covering Day and Minecraft. Visual inspection
confirmed readable signs, a clear portal head and visible sleepers on all four
mainline tracks. No final spot-run page errors or context loss were recorded.

The release ZIP is 147,720,667 bytes and the static tarball 147,537,774 bytes.
Pages retains all 1,671 previously published files, including prior hashed
asset graphs, and occupies 354,964,986 bytes after the update.
