# v1.0.65 — Zoo and City West

Pipeline step 10. The approved bounds, 93-place tour, movement, image quality,
viewing distance and earlier city detail remain intact. This is a bounded
source-based architectural refinement, with separate native Minecraft models.

## Model and evidence

- Bahnhof Zoologischer Garten now uses its complete measured hall composition,
  transparent side glazing, structural framing, six mapped track courses and
  three platforms. The real shallow roofs remain opaque. Amerika Haus receives
  its measured seven-part building and entrance facade. Exact source identities
  replace the previous coarse hall envelopes and mapped indoor room proxies;
  their original records remain in the evidence. See
  [station source contract](zoo-station-v165.md).
- Schleusenkrug gains its measured building, glazing, sign and path-cleared
  beer-garden tables. The Zoo uses mapped paths, ponds, habitat boundaries and
  measured animal houses, including the birdhouses, condor aviary and mountain
  ungulate group. Rock relief, fences and small furniture are visual estimates,
  not surveyed equipment. Current sources identify ibex, takin and Himalayan
  tahr. The Zoo's 2016 report records the last Arctic fox leaving for Neumünster;
  an invented current Arctic-fox enclosure is not added. No protected visitor
  map or landscape plan was traced. See [Zoo source contract](zoo-grounds-v165.md).
- Bikini Berlin keeps all 103 source parts and its open stair/terrace geometry;
  balustrades, handrails and glazing become more specific. Huthmacher-Haus uses
  all ten official source parts, retaining its height and footprint conflict
  with the former OSM estimate as evidence. The already-detailed Zoofenster,
  Upper West and Europa-Center remain intact. See
  [skyline source contract](bikini-skyline-v165.md).
- Kranzler Eck uses four complete official parents, nineteen parts and all 215
  wall/roof surfaces. This replaces the old rectangular tower with the measured
  narrow glass wedge. The pavilion has a striped sloping awning, white/gold
  railings and vector lettering. Fine facade spacing and awning proportions are
  visual estimates. The inspected 2009 photo is used for architecture, not its
  historical tenant signs. The five old prism records are retained verbatim.
- Tauentzienstraße gains thin facade detail on 28 existing source envelopes,
  source-aligned pavements and curbs. It leaves detailed landmarks, including
  the Gedächtniskirche, under their existing owners. Every earlier mesh and every
  navigation field in the affected stream packets is byte-value identical;
  one additional core packet has empty navigation and cannot take ownership of
  the terrain. `tauentzien-v165-preservation.json` stores the v1.0.64 baselines.

## Preservation and memory

Pointer and touch share complete drawn detail. Geometry is prepared offline,
instanced and installed in cancellable construction steps. There are no image
textures or downloaded fonts. Kranzler's 44,484 native surface cells merge
losslessly into 1,251 orthogonal source runs: positions, empty space and colors
are unchanged. Raw evidence is not imported into the live model. The complete
built site measures about 236.4 MiB. The offline archive guard
therefore rises from 230 to 240 MiB; live packet, decode and GPU residency
limits stay unchanged. The new static models add a bounded cost; no universal
frame-rate or crash-free guarantee is claimed.

The old coarse Zoo/Kranzler authoring is retired only after its complete new
source owners are installed. Unrelated church and Urania geometry hashes stay
frozen. A separate v165 static fixture documents this explicit ownership change;
earlier fixtures are not overwritten. Minecraft likewise gets a separately
recorded cumulative v165 fixture.

## Attribution

Twelve inspected free-license references were appended to both Wikimedia
manifests, bringing each to 437 records; every earlier record remains unchanged.
All photos are attribution-only, never bundled or used as runtime textures.
Kranzler reference: [Times, CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Cafe_Kranzler_Berlin_Kurfuerstendamm.jpg).
Other per-file credits and source dates are in the three linked source contracts.
Berlin LoD2 is dl-de/zero-2-0; OSM geometry is ODbL 1.0. The viewer's existing
visible attribution remains in place.

## Validation and artifacts

- Production TypeScript/Vite build passed. Ruff format/check passed for all
  212 Python files. The complete Python suite passed 617 tests with two existing
  pyogrio CRS warnings in fixture tests.
- The focused model/full-detail run passed 72 Bun tests / 90,580 assertions;
  progressive construction, cancellation and new navigation passed another
  25 tests / 7,895 assertions. Four full/mobile native-world construction tests
  passed against the separately recorded v165 signatures.
- Final desktop Chrome checks covered seven district views and three additional
  Schleusenkrug approaches. Mobile WebKit with the iPhone 13 profile passed
  24 samples across Day, Schwellenraum, Minecraft, Night, Snowstorm and return
  to Day. Mobile Chrome with the Pixel 5 profile passed six samples across Day
  and Schwellenraum. Each new model appeared exactly once in the correct mode.
- Every final sample recorded zero page/console errors, crashes or WebGL context
  losses. Peak observed WebGL buffer allocations were 193,363,403 bytes for the
  WebKit route and 190,172,455 bytes for mobile Chrome. On return to the final
  Kranzler Day view, WebKit held the same 90,984,302 bytes / 800 buffer handles
  as on its initial visit. These counts exclude textures, framebuffers and
  driver allocations.
- Static release readiness, local HTTP/package integrity and fresh packaged
  Chrome and mobile WebKit startup gates passed. Both cold starts recorded
  zero page/console errors and zero failed critical requests.
- Independent read-only review found no blocking source preservation, model
  ownership, duplicate rendering, navigation, cancellation/disposal or
  attribution issue. The complete earlier 425 reference records remain intact
  in each manifest, followed by the same twelve new entries.

The [browser-check record](zoo-citywest-v165-browser-checks.json) preserves the
measurements and resolved visual findings. Reproduce the district checks with
`scripts/smoke_zoo_citywest_v165.py`. Host-emulated browser profiles do not
establish physical iPhone memory limits or universal crash-free operation.

Both downloads and the hosted viewer use the same production build.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `isometric-berlin-regierungsviertel-local.zip` | 170,445,862 | `8636c206348f90e554e68aa61f43d9064b89ac6cee190c3a3de3b48c54d50399` |
| `isometric-berlin-viewer-v1.0.65.tar.gz` | 170,199,017 | `43bc7de2d063311c9778015d87d9d96cba2bd0888751dd1409e82fa1720e38c9` |
