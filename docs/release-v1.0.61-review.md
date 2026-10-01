# v1.0.61 — City West and Karl-Marx-Allee

## Scope and place names

Pipeline step 10. The owner's spoken “Kurfürstendammsallee” and
“Bessarionplatz” are interpreted as Karl-Marx-Allee and nearby Bersarinplatz.
Both landmark pairs are refined: the stepped towers at Strausberger Platz
and the domed towers at Frankfurter Tor. The named hotel at Breitscheidplatz
is interpreted as Waldorf Astoria in the Zoofenster alongside Upper West;
the existing Ritz-Carlton at Potsdamer Platz is retained.

The city boundary and 93-place tour remain unchanged. All four drawn modes
retain the same complete static model detail on pointer and touch devices;
Minecraft uses independent native geometry. Existing source records remain.
No photograph, crop, logo image or photographic texture is bundled or loaded.

## Source distinctions

- Zoofenster / Waldorf Astoria and Upper West: complete official LoD2 walls,
  roof planes and thirty parts replace only their two old maximum-height OSM
  prisms. Thin facade articulation follows the measured planes; its small
  window subdivisions are display interpretations, not surveys.
- Europa-Center: retain the full mapped low complex and existing OSM tower
  anchors. Refine the dark glass/aluminium/grey-spandrel hierarchy. The
  [operator's account](https://europa-center-berlin.de/timeline/der-punkt-auf-dem-i/)
  specifies the ten-metre Mercedes star and two revolutions per minute.
  The star turns around its upright axis through the existing render scheduler.
  Only cached visible star objects are updated; geometry is never rebuilt.
  Hidden tabs and the reduced-motion preference pause the animation.
- Karl-Marx-Allee: refine only the explicitly selected existing LoD2 identities
  in the already published outer-city scope. Existing bounded chunk loading
  and disposal also carry the refined geometry, avoiding a separate runtime
  constructor for the avenue. See the source-specific documents for precise
  measured envelopes, reference-derived facade cues and any roof conflicts.

## Verification

- 568 Python tests validated: 566 passed in the full run; the release-readiness
  case passed after rebuilding the versioned package, plus one subsequent native
  facade-colour regression. Two existing CRS warnings
  come from geometry test fixtures.
- 73 focused Bun tests passed, including City West, tower source/navigation,
  single-model ownership, surrounding chunks and pedestrian integration. The
  five tower/ownership tests passed again after native facade colour correction.
- TypeScript/Vite production build, Ruff, local HTTP package smoke and release
  readiness passed. The worker excludes the large visual tower payload.
- All 323 original Zoofenster/Upper West native columns are owned exactly,
  with zero missed or neighbouring columns removed. Original central-city
  mesh payloads, bounds and catalogue remain byte-identical to v1.0.60.
- Five outer-city chunks retain 281,916 unowned triangles; mapped roads,
  water and unrelated navigation remain intact. Their largest decoded packet
  stays below 4.2 MiB against the existing 12 MiB limit.
- Desktop Chrome completed 36 viewpoint/mode samples without page errors or
  graphics-context loss. Each tower representation appeared exactly once,
  and one visible Mercedes star rotated in every mode. Visual checks include
  both tower pairs, avenue facades and the close roof-star silhouette.
- Mobile WebKit completed the same 36 viewpoint/mode samples on the final
  build with no page errors or graphics-context loss. Star rotation and
  single-model ownership passed throughout. Observed GPU buffer allocations
  peaked at 109,692,340 bytes; this is not total browser/process memory.
- After the desktop run, only the five native avenue packets' facade colours
  changed: narrow windows now colour cells only when their centres fall inside
  the actual window triangle. Triangle positions and navigation are unchanged,
  all five drawn packets remain byte-identical, and mobile WebKit plus the
  seven avenue source/preservation tests cover the final packets.

Browser phone profiles exercise Chromium/WebKit mobile paths; they cannot
establish the physical memory limits of an iPhone. The prior v1.0.60 native
WebKit worker crash observation remains unresolved; this architectural work
must not be described as fixing that unrelated engine failure.
