# Step 10 — Spree bridge bodies, paths and railings (v1.0.142)

This is a bounded refinement of existing Spree crossings, with no new city
coverage. Existing bridge plans and street axes remain the geometric anchors.
Road, foot and rail use are distinguished before adding lanes or pavements.

## Sources and interpretation

- Retained OpenStreetMap bridge footprints, including closed `man_made=bridge`
  ways in the lines layer, supply the complete bridge outlines. Associated
  highway ways supply lane counts, access, sidewalks and construction status.
  © OpenStreetMap contributors, ODbL-1.0.
- [Berlin bridge inventory, 2025–2040 masterplan](https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf?ts=1779280609)
  is the existing source for the separately surveyed core profiles.
- [Landesdenkmalamt: Marschallbrücke, 09030073](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030073)
  distinguishes the present two-span bridge from its former three spans: only
  the north footway retains the historic arch; the south is a steel beam.
- [Landesdenkmalamt: Moabiter Brücke, 09050376](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050376)
  describes three shallow arches, dark basalt-lava facing and stone parapets.
- [Berlin: Elsenbrücke replacement](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/brueckenbau/elsenbruecke/)
  documents the ongoing works and temporary crossings. Retained mapped
  construction geometry must not be presented as a completed future bridge.

Primary pages checked 19 October 2026. No reference photograph or texture is
bundled. Untagged vertical dimensions, individual railing members, pavement
heights, paint widths and dash intervals are display estimates, not a survey
or an operational traffic plan.

## Preservation and delivery

The previously detailed named bridges and both Monbijou arms retain their
architecture. Exact source-cluster receipts protect unrelated bridges, railway
crossings and original terrain. Outer additions share their existing packet
lifetime; no live decode, residency or prefetch limit is raised. Drawn mobile
geometry is identical to desktop, with a separate orthogonal native reading.

## Generated scope and validation

The ordinary-bridge catalogue contains 24 mapped outlines. Twelve complete
core owners replace only the corresponding generic estimates, after their
entire unchanged 4 m source-cell set and sampled deck datum match: Ebertsbrücke,
Friedrichsbrücke, Gerickesteg, Gotzkowskybrücke, Hansabrücke, Lessingbrücke,
Liebknechtbrücke, Lutherbrücke, Marschallbrücke, Moabiter Brücke, Rathausbrücke
and Wullenwebersteg. Luther's previously authored metal railings and pylons
remain; this supplement does not double them.

Eleven owners add one mesh to each affected existing primary packet:
Charlottenburg's Schlossbrücke, Caprivibrücke, Röntgenbrücke, Siemenssteg,
Mühlendammbrücke, Jannowitzbrücke, Michaelbrücke, Schillingbrücke, Elsenbrücke,
Parkwegbrücke and Köpenick's Dammbrücke. There are 20 enriched family packets
and no extra manifest entries. Rohrdammbrücke is retained in the catalogue but
lies outside every current primary packet; it is explicitly **not rendered**
by this change. Mühlendamm's 39.91 m² bank portion owned by the existing core
is left untouched. Thus 23 of the 24 catalogued crossings receive this work.

Underdecks have closed physical bodies with arch soffits rather than flat
slabs decorated with arch silhouettes. Exact mapped end bands support the
body; the documented Moabiter and Marschall span counts additionally place
two and one interior piers, respectively. Unknown interior pier counts are
not invented. Mühlendamm’s mapped construction roadway and footway remain
unmarked neutral work surfaces; they are not reinterpreted as open sidewalks
or completed traffic lanes. Pavements, curbs and positively tagged lane separators follow
retained road axes. Untagged residual footway widths remain estimates. Every
new deck, footway, curb and paint surface supplies the same navigation height;
side barriers block sideways escape without closing either approach.

The two finite core families contain 509,322 / 3,354,147 bytes of packed
geometry (drawn / native). Their 5,946,780-byte constructor JSON uses the
existing lossless weak cache, so roots retain decoded buffers and navigation,
not the original mesh object graph. Outer additions total 244,482 / 2,962,785
packed bytes and increase the 20 gzip packets by 1,354,291 bytes in total.
The largest enriched packet is 5,225,562 decoded bytes, within the unchanged
12 MiB packet bound. Full drawn geometry is identical on desktop and mobile.

`tests/test_spree_bridges_v242.py` checks exact preservation of every previous
mesh, line and navigation value, complete core footprint coverage, source
lane provenance, original ground ownership, and axis alignment of every new
native triangle. `src/app/tests/spree-bridges-v242.test.ts` checks deck/curb
heights, barrier height/radius behavior, holes, open approaches and the weak
constructor cache. All eight focused tests pass. Core raycast and atomic
replacement tests are maintained separately in the core bridge suite.

Historical packet-preservation checks use `scripts/spree_bridge_lineage_v242.py`
only for the twenty exact receipt paths. It verifies the current gzip hash,
removes exactly the appended bridge mesh and named navigation field, and
compares every remaining JSON value with the immutable v1.0.141 packet before
returning predecessor bytes. Only the corresponding byte-count/hash metadata
may normalize; unrelated geometry, navigation, scope and descriptors remain
subject to the original tests. Negative controls reject altered old content
even when the outer gzip receipt has been recomputed to match that alteration.

Rebuild with `uv run python -m scripts.build_spree_bridges_v242`. This stages
the outer packet additions without changing public assets. After validation,
`--apply-staged` verifies all source/public/manifest hash receipts before
atomically publishing each packet and changing only its existing manifest
byte counts and hash. A changed original owner aborts publication.

## Release checks

The production build passes with a 16,164,032-byte progressive worker, below
the unchanged 16 MiB ceiling. The bridge constructor is injected only by the
main-thread viewer, so its decoder and source payload do not enter that worker.
The complete downloadable package is 925,076,598 bytes (882.222 MiB). Only its
offline size ceiling changes to 884 MiB; the live packet, decode, prefetch and
resident limits remain unchanged. Package readiness, all 80 release tests and
the local HTTP package smoke pass. Uploaded ZIP/TAR/checksum bytes are verified
against GitHub's reported digests.

A WebKit iPhone 13 emulation completed 42 views across day, night, snowstorm,
flood, Schwellenraum, Minecraft and return to day, including six bridge/wide-city
positions. No page errors, crashes, context loss or fallback to the start page
were observed. This is browser emulation, not a physical-device guarantee.

The corresponding Chrome desktop sweep also passes all 42 views with no errors
or context loss (84 views across the two engines). Close views of Marschall-,
Moabiter- and Caprivibrücke were visually inspected.

The full Python run passed 1,540 tests, with four skips. Its 13 failures and four
setup errors were resolved and selectively rerun: the bridge additions needed
strict predecessor-aware historical checks, one replay had encountered a full
local disk, and release readiness had run before the new build. Forty-three
unique targeted source/preservation tests and the 80 final release tests pass.
The lineage helper accepts only the twenty named packets, verifies their new
hashes, removes exactly the single appended mesh and named navigation field,
and compares every remaining value to immutable release v1.0.141 before
allowing an older preservation test to replay. No historical geometry assertion
is relaxed. Ruff format/check pass.

A separate cold Minecraft WebKit start followed by return to day also passes,
with matching visible bridge families and no context loss.
