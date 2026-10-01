# v1.0.63 source and release review

Pipeline step 10: requested squares, monuments, courtyard architecture and
City West streets inside the unchanged approved bounds. The 93-place tour,
camera controls and viewing distance stay unchanged. This revision uses
source-bound procedural geometry; it does not load photographs or fonts.

## Places and source contracts

| Area | Delivered model work | Evidence and limitations |
|---|---|---|
| Karl-Marx-Allee / Strausberger Platz | Additional sash transoms, lintels and sill shadows on the retained avenue; Fritz Kühn's open supported ring, copper plates, basin and jets | [Eastern places](east-places-v163.md); the intact fountain is a documented reconstruction choice during the 2026 works |
| Alexanderplatz | Urania-Weltzeituhr with open space below the drum, time-zone faces and planetary rings; Brunnen der Völkerfreundschaft with seventeen rhombic bowls and ceramic band | Exact OSM anchors; fountain/clock component proportions and static representative inscriptions are not a new survey or live time service |
| Hackescher Markt / Hackesche Höfe | Source station and court building parts, courtyard facade materials, windows, roof surfaces, paving and mapped passages | [Hackescher Markt source contract](hackescher-markt-v163.md); fifty parts preserve the actual court topology rather than introducing invented square courtyards |
| Rosenthaler Platz | Eleven source parents / forty parts, with the correctly located Circus Hostel and distinct neighbouring hotel | [Eastern places](east-places-v163.md#rosenthaler-platz-supplement); mapped floor counts, retained source roofs and explicit palette estimates |
| Ernst-Reuter-Platz | Two source basin outlines, mapped island surfaces/benches, fountain groups and the Telefunken tower | [West squares](west-squares-v163.md); exact mapped boundaries remain distinct from rounded inventory dimensions |
| Wittenbergplatz / KaDeWe | Station entrance building, the two-post memorial sign with its twelve place names, KaDeWe's retained source body, windows, entrance and glazed roof indication | [West squares](west-squares-v163.md); the glass vault is an explicit visual estimate above the retained flat source roof |
| Ku'damm / Uhlandstraße / Fasanenstraße / Meinekestraße | Source-aligned fronts, sidewalks and raised curbs along the finite named corridors | [West streets](west-streets-v163.md); 360 outer LoD2 parents / 1,484 parts and 324 retained core fronts; eleven boundary parents keep their existing ownership |

The western street pass does not claim that every window or facade colour has
been measured. It retains source roof/footprint variation and adds thin,
street-facing window fields, frames, sills, cornices and shopfront indications.
Core prism heights remain unchanged; no measured component is stretched to a
different generic height. Untagged sidewalk widths and small curb dimensions
are labelled display estimates. Existing City West hero identities remain
outside that general pass.

## Source and representation preservation

Berlin LoD2 supplies measured building parts under dl-de/zero-2-0.
OpenStreetMap supplies feature identities, streets, basins and access geometry
under ODbL 1.0. Every supplement retains its original source rings and archive
or API provenance. Original core records remain available when explicit
recognition replacements take ownership.

The avenue preservation report compares old and new coloured-position triangle
multisets: all previous drawn triangles and navigation survive; its native
packets remain byte-identical. Outer west and Rosenthaler exporters replace
only their explicit parent identities, retain all unowned source triangles,
and preserve original road, water and bridge navigation. The source-bound open
Weltzeituhr replaces only its false three-metre occupied canopy envelope.

All four drawn modes use the same complete model on pointer and touch devices.
Minecraft has independent orthogonal geometry. The established v1.0.62
cooperative loading, cancellation, geometry residency and input scheduling
remain in place. This is a preservation contract, not a claim that added
geometry has zero rendering cost or that every phone is crash-proof.

City West street geometry is prepared offline into 21 independently streamed
512 m packets. The largest final decoded packet is 6,556,175 bytes, below the
existing 12 MiB cap. Both representations' 42 compressed files total
23,372,852 bytes, including their retained base geometry; that is not the
download delta. The final check inspected 1,764,822 new stored vertices against
the approved polygon and found no out-of-bounds vertex. The source audit
records the detailed counts and unowned-triangle accounting.

Core-only detail packets contain empty navigation and do not enlarge the
surrounding-city ground footprint. Existing core buildings stay visible while
those optional detail packets are absent. The complete offline package now measures about 225.7 MiB uncompressed; its
finite archive ceiling is adjusted from 215 to 230 MiB for this requested
source detail. Live packet and GPU residency limits remain unchanged.
No new browser-side facade compiler,
worker or unbounded visited-packet cache is introduced.

## Visual-reference credits

Eleven new reference-only Wikimedia file records are mirrored in
`geo_data/regierungsviertel/wikimedia_references.json` and the shipped
`dzi/regierungsviertel/wikimedia_attribution.json`; all 405 earlier entries
remain unchanged. The global count becomes 416. The file pages, photographers
and exact licence URLs accompany every record. The standard attribution and
visible Wikimedia reference notice remain required in the viewer.

| Subject | File and photographer | Licence |
|---|---|---|
| Schwebender Ring | [Schwebender Ring.jpg](https://commons.wikimedia.org/wiki/File:Schwebender_Ring.jpg), Lukas Beck | CC BY-SA 4.0 |
| Völkerfreundschaft fountain | [Brunnen der Voelkerfreundschaft Berlin 1.jpg](https://commons.wikimedia.org/wiki/File:Brunnen_der_Voelkerfreundschaft_Berlin_1.jpg), Manfred Brückels | CC BY-SA 3.0 |
| Weltzeituhr | [Weltzeituhr 2.png](https://commons.wikimedia.org/wiki/File:Weltzeituhr_2.png), Enrico Mevius | CC BY-SA 3.0 |
| KaDeWe | [KaDeWe front.jpg](https://commons.wikimedia.org/wiki/File:KaDeWe_front.jpg), Gellerj; perspective correction Arch2all | CC BY-SA 3.0 |
| Wittenbergplatz entrance | [U-Bahnhof Wittenbergplatz 0686.jpg](https://commons.wikimedia.org/wiki/File:U-Bahnhof_Wittenbergplatz_0686.jpg), Dosseman | CC BY-SA 4.0 |
| Wittenbergplatz memorial | [Orte des Schreckens](https://commons.wikimedia.org/wiki/File:Gedenktafel_Wittenbergplatz_(Sch%C3%B6n)_Orte_des_Schreckens.jpg), OTFW, Berlin | CC BY-SA 3.0 |
| Ernst-Reuter-Platz fountain | [Brunnen Berlin-Charlottenburg, Ernst-Reuter-Platz, 1.jpg](https://commons.wikimedia.org/wiki/File:Brunnen_Berlin-Charlottenburg,_Ernst-Reuter-Platz,_1.jpg), Manfred Brückels | CC BY-SA 3.0 |
| Hackesche Höfe, first court | [Berlin-mitte-hacke-hof1-osten.jpg](https://commons.wikimedia.org/wiki/File:Berlin-mitte-hacke-hof1-osten.jpg), Bgabel | CC BY-SA 3.0 |
| Hackesche Höfe, exterior | [Berlin-Mitte-hacke-hoefe-aussen.jpg](https://commons.wikimedia.org/wiki/File:Berlin-Mitte-hacke-hoefe-aussen.jpg), Bgabel | CC BY-SA 3.0 |
| Rosenthaler Platz | [Mitte Rosenthaler Platz.jpg](https://commons.wikimedia.org/wiki/File:Mitte_Rosenthaler_Platz.jpg), Fridolin freudenfett | CC BY-SA 4.0 |
| Hackescher Markt | [Hackescher Markt November 2013.jpg](https://commons.wikimedia.org/wiki/File:Hackescher_Markt_November_2013.jpg), Arild Vågen | CC BY-SA 3.0 |

## Validation

- Production TypeScript/Vite build passed. Ruff format/check passed for all
  194 Python files.
- The full Python run passed 589 tests; its sole initial failure was the
  still-present v1.0.62 offline package manifest. After repackaging, all 65
  release-readiness tests passed. All 20 new Python source/preservation tests
  passed, including the final published western packets.
- The integration Bun run passed 91 tests / 192,343 assertions across the new
  models, pedestrian navigation, mode continuity, progressive loading,
  static transforms and park batching. The final component rerun passed all
  18 tests; the clock lettering correction was checked again separately.
- Desktop Chrome rendered all twelve requested review views without page or
  console errors or WebGL context loss. Visual review covered the square
  models, station/court openings, Endell facade and street fronts. It found
  and corrected the world-clock pavement depth overlap, outward lettering
  direction and displaced station label.
- Mobile WebKit (iPhone 13 profile) passed eighteen view samples through Day,
  Schwellenraum, Minecraft, Night, Snowstorm and back to Day. Mobile Chrome
  (Pixel 5 profile) passed six samples through Day and Schwellenraum. Every
  new model appeared exactly once in the appropriate representation.
  Peak observed WebGL buffer allocation was 104,064,571 and 103,344,777 bytes
  respectively; both runs had zero page errors, crashes or context losses.
  Buffers do not include textures, framebuffer or driver allocations.
- The [browser-check record](city-places-v163-browser-checks.json) preserves
  the per-view observations. `scripts/smoke_city_places_v163.py` reproduces
  the inspection with real browser engines and the production build.
- Offline release readiness, local HTTP/package integrity and fresh-context
  startup gates passed for desktop Chrome and mobile WebKit.
- An independent read-only integration review found no blocking source
  ownership, duplicate-model or v1.0.62 preservation issue.

The browser profiles run on the host, not physical iPhones or Android phones.
No universal frame-rate claim or crash-free guarantee is asserted. All source
quality and residency limits described above remain in force.

## Release artifacts

Both downloads and the hosted viewer use this production build.

| File | Bytes | SHA-256 |
|---|---:|---|
| `isometric-berlin-regierungsviertel-local.zip` | 168,262,796 | `05e4aa95fbc82602a37e0d0237eebd618ff10f565515d7e83d813be372c8bb23` |
| `isometric-berlin-viewer-v1.0.63.tar.gz` | 168,064,425 | `9ed2435f31975ac5dcab9f739280e73f2f87ac05330be1345250654cb5c17853` |
