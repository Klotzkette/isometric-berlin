# Ku’damm and Tauentzien architecture, v235

Step 10 adds readable glazing, shallow reveals and narrow profiles to the
**existing** street-facing opening fields throughout both named streets. It
retains the old opening rhythm and every original roof, wall, navigation record,
line and encoded mesh part. Existing v163/v165 opening dimensions are themselves
illustrative, not measured individual historic window positions; this refinement
does not elevate them to survey evidence.

The authoritative footprint/roof inputs remain the retained Berlin LoD2 source
and original OSM core footprints in `west-streets-v163.json` and
`tauentzien-v165.json`. The former already contains **360 complete measured
houses** and 324 core-prism frontage records; the latter contains 28 core records.
No additional roof mass is needed where those complete measured sheets already
exist. All 192 v233 roof owners and current dedicated hero owners are excluded.
The 11 retained v163 boundary parents remain untouched; no missing geographic
area, wing or roof pitch is invented.

## Coverage and presentation

The full mapped named-road courses are audited from Rathenauplatz/Halensee to
Breitscheidplatz and onward along Tauentzienstraße to Wittenbergplatz. Both source
axes meet at the existing Breitscheidplatz junction. Ku’damm source bounds are
XZ `[-5889.864,1542.334,-2462.383,2549.753]`; Tauentzien bounds are
`[-2464.584,1548.995,-2019.710,1850.995]`. These are source course bounds, not a
claim to have individually measured every building elevation.

| Section | Drawn fields | Native exposed cell faces | Drawn owners |
| --- | ---: | ---: | ---: |
| West / Halensee | 460 | 215 | 20 |
| Lehniner Platz | 391 | 213 | 23 |
| Central Ku’damm | 2,064 | 1,880 | 60 |
| Breitscheidplatz | 1,504 | 1,493 | 39 |
| Tauentzienstraße | 1,295 | 1,831 | 24 |

There are 164 distinct drawn owners (section counts can share an owner), including
31 existing Schaubühne fields, 48 Maison-de-France fields, 51 Haus-Cumberland
fields and 34 ECO-Haus fields. Their measured/retained silhouettes stay intact.
The current facade description for Maison de France and Schaubühne’s horseshoe
front/chimney were checked against the primary references below. No historical
1920s window bands, guessed red theatre cladding or brass on every Maison window
are introduced. The existing theatre roof parts are the geometric evidence.

All new glass hues, fine profile widths and **5 cm reveal depth** are modest
presentation estimates. They are applied only inside exact old glazing fields;
original sill/mullion axes remain visible. Existing mapped v233 door fields have
priority. Native geometry is separately bound to the actual delivered orthogonal
exposed glass cell faces, rather than being copied from the slanted drawn plane.

Smooth rear blocks 102–240 m south of the Ku’damm behind Schaubühne are retained
older LoD2 parent envelopes outside this frontage scope. They are not a streaming
failure or a duplicate Schaubühne shell. This pass does not blanket-detail those
unrelated rear blocks.

## Atomic packet lifecycle

`scripts/build_boulevard_architecture_v235.py` verifies every drawn opening
against the two original delivered glass triangles. Unmatched/cut fields fail
closed. Native fields bind exact exposed orthogonal face bounds. Immutable
source packet hashes and per-field geometry live in
`geo_data/regierungsviertel/boulevard-architecture-v235-evidence.json.gz`.

`prepareBoulevardArchitectureV235` validates the full original part fingerprint
cooperatively before allocating a bounded extra part. It preserves all original
part object identities and appends only `boulevard-architecture-v235`. The eager
26-key index avoids hydrating unrelated weak packet recipes. Data are 744,473
JSON bytes, 13 existing tile IDs / 26 mode packets, 5,714 drawn fields and 5,632
native faces. No separate scene roots, textures, animation, caches or residency
budget changes are introduced. All modes/mobile use the same source policy.

The combined v233/v235 audit across 486 packet families remains below existing
limits: maximum 6 parts, 280,328 vertices and 1,332,768 indices. Root’s measured
full additions, including the independent road layer, sum to 4,258,050 drawn and
3,918,774 native decoded bytes across all packets; these are not simultaneous
resident totals. Maximum per-packet increments are 1,002,306 / 1,502,598 bytes,
including three drawn and one native index-width promotions. No source payload
or nav record is rewritten.

## Replay and visual checks

Focused Python tests replay the original packet SHA, exact drawn opening
triangles/native faces, protected owners and five-section coverage. Focused Bun
tests exercise every prepared packet, original references/nav/lines, orthogonal
native profiles, idempotence, limits, corrupt fingerprints, wrong origins,
invalid recipes and cancellation. The root runs combined integration separately.

Useful existing-scene camera locations (world XYZ, fov 45):

- Lehniner Platz toward Schaubühne: eye `[-4680,30,2070]`, target `[-4745,17,2140]`.
- Central Ku’damm: eye `[-3500,25,1860]`, target `[-3500,14,1920]`.
- West / Halensee: eye `[-5350,25,2290]`, target `[-5320,14,2230]`.

Primary context references:
[Schaubühne architecture](https://www.schaubuehne.de/de/seiten/architektur.html),
[Maison de France, Berlin monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096298).
